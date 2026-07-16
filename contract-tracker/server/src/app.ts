import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { authenticate } from './middleware/auth';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { getDatabase } from './database';
import authRouter from './routes/auth';
import contractsRouter from './routes/contracts';
import invoicesRouter from './routes/invoices';
import paymentsRouter from './routes/payments';
import shipmentsRouter from './routes/shipments';
import dashboardRouter from './routes/dashboard';
import { UPLOAD_DIR, CORS_ORIGIN } from './config';
import { isSafeStorageName, getPreviewContentType } from './utils/fileUtils';

/**
 * 简易登录频率限制中间件（不依赖外部包）
 */
function loginRateLimiter() {
  const attempts = new Map<string, { count: number; resetAt: number }>();
  const WINDOW_MS = 15 * 60 * 1000; // 15 分钟窗口
  const MAX_ATTEMPTS = 10;

  // 定期清理过期记录
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of attempts) {
      if (now > val.resetAt) attempts.delete(key);
    }
  }, 5 * 60 * 1000);

  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const rawIp = req.ip || req.socket.remoteAddress || 'unknown';
    const ip = Array.isArray(rawIp) ? rawIp[0] : rawIp;
    const key = `login:${ip}`;
    const now = Date.now();
    const entry = attempts.get(key);

    if (entry && now < entry.resetAt && entry.count >= MAX_ATTEMPTS) {
      res.status(429).json({ code: 42900, data: null, message: '登录尝试过多，请15分钟后再试' });
      return;
    }

    if (!entry || now > entry.resetAt) {
      attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    } else {
      entry.count++;
    }
    next();
  };
}

/**
 * 统一的附件预览/下载响应（带 Token 验证 + 路径遍历防护）
 */
function serveAttachment(
  tableName: string,
  req: express.Request,
  res: express.Response,
  mode: 'preview' | 'download'
): void {
  const db = getDatabase();
  const id = parseInt(String(req.params.id), 10);

  if (isNaN(id)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的附件ID' });
    return;
  }

  // 验证 access_token（必须参数）
  const token = req.query.token as string | undefined;
  if (!token) {
    res.status(401).json({ code: 40100, data: null, message: '缺少访问凭证' });
    return;
  }

  const row = db.prepare(
    `SELECT original_name, storage_name, access_token FROM ${tableName} WHERE id = ?`
  ).get(id) as { original_name: string; storage_name: string; access_token: string } | undefined;

  if (!row || !row.storage_name) {
    res.status(404).json({ code: 40400, data: null, message: '附件不存在' });
    return;
  }

  // Verify token
  if (row.access_token !== token) {
    res.status(403).json({ code: 40300, data: null, message: '访问凭证无效' });
    return;
  }

  // 路径遍历防护
  if (!isSafeStorageName(row.storage_name)) {
    res.status(400).json({ code: 40000, data: null, message: '非法的文件路径' });
    return;
  }

  const fp = path.join(UPLOAD_DIR, row.storage_name);
  if (!fs.existsSync(fp)) {
    res.status(404).json({ code: 40400, data: null, message: '附件文件已丢失' });
    return;
  }

  if (mode === 'download') {
    res.download(fp, row.original_name);
  } else {
    res.setHeader('Content-Type', getPreviewContentType(row.original_name));
    res.setHeader('Content-Disposition', 'inline');
    fs.createReadStream(fp).pipe(res);
  }
}

export function createApp(): express.Application {
  const app = express();

  // Middleware
  const corsOptions: cors.CorsOptions = {};
  if (CORS_ORIGIN) {
    corsOptions.origin = CORS_ORIGIN.split(',').map(s => s.trim());
  }
  // 局域网环境下默认允许所有来源（花生壳外网访问需要），
  // 如需限制，在 .env 中设置 CORS_ORIGIN 即可
  app.use(cors(corsOptions));
  app.use(express.json());

  // Debug logging — only in non-production
  if (process.env.NODE_ENV !== 'production') {
    app.use((req, _res, next) => {
      if (req.url.includes('/invoices') || req.url.includes('/payments'))
        console.log(`[REQ] ${req.method} ${req.url}`);
      next();
    });
  }

  // Login rate limiter
  app.use('/api/auth/login', loginRateLimiter());

  // Public routes
  app.use('/api/auth', authRouter);

  // User management routes (admin only)
  app.get('/api/users', authenticate, (req, res) => {
    const db = getDatabase();
    const user = (req as any).user!;
    if (user.role !== 'admin') {
      res.status(403).json({ code: 40300, data: null, message: '仅管理员可操作' });
      return;
    }
    const rows = db.prepare('SELECT id, username, display_name, role, created_at FROM users ORDER BY id').all();
    res.json({ code: 0, data: rows, message: 'ok' });
  });

  // POST /api/users - 创建新用户（仅admin）
  app.post('/api/users', authenticate, (req, res) => {
    const db = getDatabase();
    const adminUser = (req as any).user!;
    if (adminUser.role !== 'admin') {
      res.status(403).json({ code: 40300, data: null, message: '仅管理员可操作' });
      return;
    }
    const { username, password, display_name, role } = req.body;
    if (!username || !password || !display_name) {
      res.status(400).json({ code: 40000, data: null, message: '缺少必填字段' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ code: 40000, data: null, message: '密码至少6位' });
      return;
    }
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      res.status(409).json({ code: 40900, data: null, message: '用户已存在' });
      return;
    }
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(password, 10);
    const validRole = (role === 'admin' || role === 'sales') ? role : 'sales';
    const result = db.prepare(
      'INSERT INTO users (username, password, display_name, role) VALUES (?, ?, ?, ?)'
    ).run(username, hash, display_name, validRole);
    const newUser = db.prepare(
      'SELECT id, username, display_name, role, created_at FROM users WHERE id = ?'
    ).get(result.lastInsertRowid);
    res.status(201).json({ code: 0, data: newUser, message: '用户创建成功' });
  });

  app.put('/api/users/:id', authenticate, (req, res) => {
    const db = getDatabase();
    const user = (req as any).user!;
    if (user.role !== 'admin') {
      res.status(403).json({ code: 40300, data: null, message: '仅管理员可操作' });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    const { display_name } = req.body;
    if (!display_name) {
      res.status(400).json({ code: 40000, data: null, message: '请提供昵称' });
      return;
    }
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ code: 40400, data: null, message: '用户不存在' });
      return;
    }
    db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(display_name, id);
    const updated = db.prepare('SELECT id, username, display_name, role, created_at FROM users WHERE id = ?').get(id);
    res.json({ code: 0, data: updated, message: '用户信息更新成功' });
  });

  app.put('/api/users/:id/password', authenticate, (req, res) => {
    const db = getDatabase();
    const adminUser = (req as any).user!;
    if (adminUser.role !== 'admin') {
      res.status(403).json({ code: 40300, data: null, message: '仅管理员可操作' });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    const { password } = req.body;
    if (!password || password.length < 6) {
      res.status(400).json({ code: 40000, data: null, message: '密码至少6位' });
      return;
    }
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ code: 40400, data: null, message: '用户不存在' });
      return;
    }
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hash, id);
    res.json({ code: 0, data: null, message: '密码修改成功' });
  });

  // DELETE /api/users/:id - 删除用户（仅admin，不能删自己，检查关联合同）
  app.delete('/api/users/:id', authenticate, (req, res) => {
    const db = getDatabase();
    const adminUser = (req as any).user!;
    if (adminUser.role !== 'admin') {
      res.status(403).json({ code: 40300, data: null, message: '仅管理员可操作' });
      return;
    }
    const id = parseInt(String(req.params.id), 10);
    if (id === adminUser.id) {
      res.status(400).json({ code: 40000, data: null, message: '不能删除自己' });
      return;
    }
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!existing) {
      res.status(404).json({ code: 40400, data: null, message: '用户不存在' });
      return;
    }
    // 检查该用户是否有关联合同
    const contractCount = db.prepare('SELECT COUNT(*) as count FROM contracts WHERE salesperson_id = ?').get(id) as { count: number };
    if (contractCount.count > 0) {
      res.status(400).json({
        code: 40000,
        data: { contractCount: contractCount.count },
        message: `该用户名下还有 ${contractCount.count} 个合同，请先转移或删除合同后再删除用户`,
      });
      return;
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ code: 0, data: null, message: '用户删除成功' });
  });

  // Attachment preview/download — Token-based auth via ?token= query parameter
  // 预览/下载需要携带 access_token（前端从已认证的附件列表 API 获取）
  app.get('/api/contracts/attachments/:id/preview', (req, res) => serveAttachment('contract_attachments', req, res, 'preview'));
  app.get('/api/contracts/attachments/:id/download', (req, res) => serveAttachment('contract_attachments', req, res, 'download'));
  app.get('/api/invoices/attachments/:id/preview', (req, res) => serveAttachment('invoice_attachments', req, res, 'preview'));
  app.get('/api/invoices/attachments/:id/download', (req, res) => serveAttachment('invoice_attachments', req, res, 'download'));
  app.get('/api/payments/attachments/:id/preview', (req, res) => serveAttachment('payment_attachments', req, res, 'preview'));
  app.get('/api/payments/attachments/:id/download', (req, res) => serveAttachment('payment_attachments', req, res, 'download'));
  app.get('/api/shipments/attachments/:id/preview', (req, res) => serveAttachment('shipment_attachments', req, res, 'preview'));
  app.get('/api/shipments/attachments/:id/download', (req, res) => serveAttachment('shipment_attachments', req, res, 'download'));

  // Protected routes
  app.use('/api/dashboard', authenticate, dashboardRouter);
  app.use('/api/contracts', authenticate, contractsRouter);
  app.use('/api', authenticate, invoicesRouter);
  app.use('/api', authenticate, paymentsRouter);
  app.use('/api', authenticate, shipmentsRouter);

  // Serve static files (优先 .gz)
  const clientDistPath = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use((req, res, next) => {
    if (!(req.headers['accept-encoding'] || '').includes('gzip')) return next();
    const gz = path.join(clientDistPath, req.path + '.gz');
    if (!fs.existsSync(gz)) return next();
    if (req.path.endsWith('.js')) { res.set('Content-Encoding','gzip'); res.set('Content-Type','application/javascript'); res.set('Cache-Control','no-cache'); res.sendFile(gz); return; }
    if (req.path.endsWith('.css')) { res.set('Content-Encoding','gzip'); res.set('Content-Type','text/css'); res.set('Cache-Control','no-cache'); res.sendFile(gz); return; }
    next();
  });
  app.use(express.static(clientDistPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    },
  }));

  // SPA fallback for non-API routes
  app.get('*', (_req, res) => {
    const indexPath = path.join(clientDistPath, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(404).json({ code: 40400, data: null, message: '资源未找到' });
      }
    });
  });

  // Error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

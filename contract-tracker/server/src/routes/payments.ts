import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { getDatabase } from '../database';
import { authenticate } from '../middleware/auth';
import { UPLOAD_DIR, UPLOAD_FILE_SIZE_LIMIT } from '../config';
import { fixFilenameEncoding, ALLOWED_UPLOAD_MIMES } from '../utils/fileUtils';

const router = Router();

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb) => cb(null, UPLOAD_DIR),
  filename: (_req: Request, file: Express.Multer.File, cb) => {
    const uniqueName = `pay-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_FILE_SIZE_LIMIT },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (ALLOWED_UPLOAD_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error('仅支持 PDF 和图片格式'));
  },
});

// GET /api/contracts/:id/payments
router.get('/contracts/:id/payments', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const contractId = parseInt(req.params.id as string, 10);
  if (isNaN(contractId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的合同ID' });
    return;
  }
  const rows = db.prepare('SELECT * FROM payments WHERE contract_id = ? ORDER BY payment_date DESC').all(contractId);
  res.json({ code: 0, data: rows, message: 'ok' });
});

// POST /api/contracts/:id/payments
router.post('/contracts/:id/payments', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const contractId = parseInt(req.params.id as string, 10);
  const { payment_date, amount, status } = req.body;
  if (isNaN(contractId) || !payment_date || amount == null) {
    res.status(400).json({ code: 40000, data: null, message: '缺少必填字段' });
    return;
  }
  const finalStatus = (status === '已收款' || status === '未收款') ? status : '未收款';
  const result = db.prepare('INSERT INTO payments (contract_id, payment_date, amount, status) VALUES (?, ?, ?, ?)').run(contractId, payment_date, amount, finalStatus);
  const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ code: 0, data: row, message: '收款记录创建成功' });
});

// PUT /api/payments/:id
router.put('/payments/:id', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const id = parseInt(req.params.id as string, 10);
  const { payment_date, amount, status } = req.body;

  // 检查记录是否存在
  const existing = db.prepare('SELECT id FROM payments WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ code: 40400, data: null, message: '收款记录不存在' });
    return;
  }

  if (status && status !== '已收款' && status !== '未收款') {
    res.status(400).json({ code: 40000, data: null, message: '无效的回款状态' });
    return;
  }

  db.prepare("UPDATE payments SET payment_date = COALESCE(?, payment_date), amount = COALESCE(?, amount), status = COALESCE(?, status), updated_at = datetime('now') WHERE id = ?")
    .run(payment_date || null, amount != null ? amount : null, status || null, id);
  const row = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
  res.json({ code: 0, data: row, message: '收款记录更新成功' });
});

// DELETE /api/payments/:id
router.delete('/payments/:id', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const id = parseInt(req.params.id as string, 10);

  // Clean up attachment files from disk
  const attachments = db.prepare('SELECT storage_name FROM payment_attachments WHERE payment_id = ?').all(id) as Array<{ storage_name: string }>;
  for (const att of attachments) {
    const fp = path.join(UPLOAD_DIR, att.storage_name);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  db.prepare('DELETE FROM payments WHERE id = ?').run(id);
  res.json({ code: 0, data: null, message: '删除成功' });
});

// ===== Payment Multi-File Attachment Routes =====

router.post('/payments/:id/upload', authenticate, upload.array('files', 10), (req: Request, res: Response) => {
  const db = getDatabase();
  const paymentId = parseInt(req.params.id as string, 10);
  const files = (req as any).files as Express.Multer.File[];

  if (isNaN(paymentId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的收款记录ID' });
    return;
  }

  if (!files || files.length === 0) {
    res.status(400).json({ code: 40000, data: null, message: '请选择要上传的文件' });
    return;
  }

  const saved: any[] = [];
  for (const file of files) {
    const originalName = fixFilenameEncoding(file.originalname);
    const accessToken = crypto.randomBytes(16).toString('hex');
    const r = db.prepare(
      'INSERT INTO payment_attachments (payment_id, original_name, storage_name, file_size, access_token) VALUES (?, ?, ?, ?, ?)'
    ).run(paymentId, originalName, file.filename, file.size, accessToken);
    saved.push({
      id: r.lastInsertRowid, original_name: originalName, storage_name: file.filename, file_size: file.size, access_token: accessToken,
    });
  }

  res.json({ code: 0, data: saved, message: '上传成功' });
});

router.get('/payments/:id/attachments', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const paymentId = parseInt(req.params.id as string, 10);

  if (isNaN(paymentId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的收款记录ID' });
    return;
  }

  const rows = db.prepare(
    'SELECT id, original_name, file_size, access_token, created_at FROM payment_attachments WHERE payment_id = ? ORDER BY created_at DESC'
  ).all(paymentId);

  res.json({ code: 0, data: rows, message: 'ok' });
});

router.delete('/attachments/payment/:id', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const attachmentId = parseInt(req.params.id as string, 10);

  if (isNaN(attachmentId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的附件ID' });
    return;
  }

  const row = db.prepare(
    'SELECT id, storage_name FROM payment_attachments WHERE id = ?'
  ).get(attachmentId) as { id: number; storage_name: string } | undefined;

  if (!row) {
    res.status(404).json({ code: 40400, data: null, message: '附件不存在' });
    return;
  }

  if (row.storage_name) {
    const fp = path.join(UPLOAD_DIR, row.storage_name);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  db.prepare('DELETE FROM payment_attachments WHERE id = ?').run(attachmentId);
  res.json({ code: 0, data: null, message: '附件删除成功' });
});

/**
 * GET /api/payments/tracking - 回款跟踪
 */
router.get('/payments/tracking', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const status = req.query.status as string | undefined;
  const keyword = req.query.keyword as string | undefined;
  const sortBy = req.query.sortBy as string | undefined;
  const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'ASC' : 'DESC';

  const SORT_COLUMNS: Record<string, string> = {
    payment_date:    'p.payment_date',
    contract_no:     'c.contract_no',
    contract_name:   'c.contract_name',
    party:           'c.party',
    contract_amount: 'c.amount',
    amount:          'p.amount',
    status:          'p.status',
  };
  const sortColumn = SORT_COLUMNS[sortBy || ''] || 'p.payment_date';

  let sql = `
    SELECT p.id, p.contract_id, p.payment_date, p.amount, p.status, p.created_at,
           c.contract_no, c.contract_name, c.party, c.amount as contract_amount
    FROM payments p
    JOIN contracts c ON p.contract_id = c.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (status && (status === '已收款' || status === '未收款')) {
    sql += ' AND p.status = ?';
    params.push(status);
  }
  if (keyword && keyword.trim()) {
    sql += ' AND (c.contract_no LIKE ? OR c.party LIKE ? OR c.contract_name LIKE ?)';
    const kw = `%${keyword.trim()}%`;
    params.push(kw, kw, kw);
  }

  sql += ` ORDER BY ${sortColumn} ${sortOrder}`;
  const rows = db.prepare(sql).all(...params);
  res.json({ code: 0, data: rows, message: 'ok' });
});

export default router;

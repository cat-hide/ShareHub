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
    const uniqueName = `inv-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
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

/**
 * GET /api/contracts/:id/invoices - 获取某合同下的所有开票记录
 */
router.get('/contracts/:contractId/invoices', (req: Request, res: Response) => {
  const db = getDatabase();
  const user = req.user!;
  const contractId = parseInt(req.params.contractId as string, 10);

  if (isNaN(contractId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的合同ID' });
    return;
  }

  let contractQuery = 'SELECT id FROM contracts WHERE id = ?';
  const contractParams: unknown[] = [contractId];

  if (user.role === 'sales') {
    contractQuery += ' AND salesperson_id = ?';
    contractParams.push(user.id);
  }

  const contract = db.prepare(contractQuery).get(...contractParams);
  if (!contract) {
    res.status(404).json({ code: 40400, data: null, message: '合同不存在或无权访问' });
    return;
  }

  const invoices = db.prepare('SELECT * FROM invoices WHERE contract_id = ? ORDER BY invoice_date DESC').all(contractId);
  res.json({ code: 0, data: invoices, message: 'ok' });
});

/**
 * POST /api/contracts/:id/invoices - 新增开票记录
 */
router.post('/contracts/:contractId/invoices', (req: Request, res: Response) => {
  const db = getDatabase();
  const user = req.user!;
  const contractId = parseInt(req.params.contractId as string, 10);

  if (isNaN(contractId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的合同ID' });
    return;
  }

  let contractQuery = 'SELECT id FROM contracts WHERE id = ?';
  const contractParams: unknown[] = [contractId];

  if (user.role === 'sales') {
    contractQuery += ' AND salesperson_id = ?';
    contractParams.push(user.id);
  }

  const contract = db.prepare(contractQuery).get(...contractParams);
  if (!contract) {
    res.status(404).json({ code: 40400, data: null, message: '合同不存在或无权访问' });
    return;
  }

  const { invoice_no, invoice_date, amount, invoice_type } = req.body;

  if (!invoice_no || !invoice_date || amount == null) {
    res.status(400).json({ code: 40000, data: null, message: '缺少必填字段' });
    return;
  }

  if (typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({ code: 40000, data: null, message: '开票金额必须为正数' });
    return;
  }

  const result = db.prepare(
    'INSERT INTO invoices (contract_id, invoice_no, invoice_date, amount, invoice_type) VALUES (?, ?, ?, ?, ?)'
  ).run(contractId, invoice_no, invoice_date, amount, invoice_type || '增值税专用发票');

  const newInvoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(result.lastInsertRowid);
  db.prepare("UPDATE contracts SET updated_at = datetime('now') WHERE id = ?").run(contractId);

  res.status(201).json({ code: 0, data: newInvoice, message: '开票记录创建成功' });
});

/**
 * PUT /api/invoices/:id - 修改开票记录
 */
router.put('/invoices/:id', (req: Request, res: Response) => {
  const db = getDatabase();
  const user = req.user!;
  const invoiceId = parseInt(req.params.id as string, 10);

  if (isNaN(invoiceId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的开票记录ID' });
    return;
  }

  const invoice = db.prepare(
    'SELECT i.*, c.salesperson_id FROM invoices i JOIN contracts c ON i.contract_id = c.id WHERE i.id = ?'
  ).get(invoiceId) as { id: number; contract_id: number; salesperson_id: number } | undefined;

  if (!invoice) {
    res.status(404).json({ code: 40400, data: null, message: '开票记录不存在' });
    return;
  }

  if (user.role === 'sales' && invoice.salesperson_id !== user.id) {
    res.status(403).json({ code: 40300, data: null, message: '无权操作此记录' });
    return;
  }

  const { invoice_no, invoice_date, amount, invoice_type } = req.body;

  db.prepare(`
    UPDATE invoices SET
      invoice_no = COALESCE(?, invoice_no),
      invoice_date = COALESCE(?, invoice_date),
      amount = COALESCE(?, amount),
      invoice_type = COALESCE(?, invoice_type),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    invoice_no || null, invoice_date || null, amount != null ? amount : null, invoice_type || null, invoiceId
  );

  const updated = db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId);
  db.prepare("UPDATE contracts SET updated_at = datetime('now') WHERE id = ?").run(invoice.contract_id);

  res.json({ code: 0, data: updated, message: '开票记录更新成功' });
});

/**
 * DELETE /api/invoices/:id - 删除开票记录
 */
router.delete('/invoices/:id', (req: Request, res: Response) => {
  const db = getDatabase();
  const user = req.user!;
  const invoiceId = parseInt(req.params.id as string, 10);

  if (isNaN(invoiceId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的开票记录ID' });
    return;
  }

  const invoice = db.prepare(
    'SELECT i.*, c.salesperson_id FROM invoices i JOIN contracts c ON i.contract_id = c.id WHERE i.id = ?'
  ).get(invoiceId) as { id: number; contract_id: number; salesperson_id: number } | undefined;

  if (!invoice) {
    res.status(404).json({ code: 40400, data: null, message: '开票记录不存在' });
    return;
  }

  if (user.role === 'sales' && invoice.salesperson_id !== user.id) {
    res.status(403).json({ code: 40300, data: null, message: '无权操作此记录' });
    return;
  }

  // Clean up attachment files from disk
  const attachments = db.prepare('SELECT storage_name FROM invoice_attachments WHERE invoice_id = ?').all(invoiceId) as Array<{ storage_name: string }>;
  for (const att of attachments) {
    const fp = path.join(UPLOAD_DIR, att.storage_name);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  db.prepare('DELETE FROM invoices WHERE id = ?').run(invoiceId);
  db.prepare("UPDATE contracts SET updated_at = datetime('now') WHERE id = ?").run(invoice.contract_id);

  res.json({ code: 0, data: null, message: '开票记录删除成功' });
});

// ===== Invoice Multi-File Attachment Routes =====

router.post('/invoices/:id/upload', authenticate, upload.array('files', 10), (req: Request, res: Response) => {
  const db = getDatabase();
  const invoiceId = parseInt(req.params.id as string, 10);
  const files = (req as any).files as Express.Multer.File[];

  if (isNaN(invoiceId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的开票记录ID' });
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
      'INSERT INTO invoice_attachments (invoice_id, original_name, storage_name, file_size, access_token) VALUES (?, ?, ?, ?, ?)'
    ).run(invoiceId, originalName, file.filename, file.size, accessToken);
    saved.push({
      id: r.lastInsertRowid, original_name: originalName, storage_name: file.filename, file_size: file.size, access_token: accessToken,
    });
  }

  res.json({ code: 0, data: saved, message: '上传成功' });
});

router.get('/invoices/:id/attachments', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const invoiceId = parseInt(req.params.id as string, 10);

  if (isNaN(invoiceId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的开票记录ID' });
    return;
  }

  const rows = db.prepare(
    'SELECT id, original_name, file_size, access_token, created_at FROM invoice_attachments WHERE invoice_id = ? ORDER BY created_at DESC'
  ).all(invoiceId);

  res.json({ code: 0, data: rows, message: 'ok' });
});

router.delete('/attachments/invoice/:id', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const attachmentId = parseInt(req.params.id as string, 10);

  if (isNaN(attachmentId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的附件ID' });
    return;
  }

  const row = db.prepare(
    'SELECT id, storage_name FROM invoice_attachments WHERE id = ?'
  ).get(attachmentId) as { id: number; storage_name: string } | undefined;

  if (!row) {
    res.status(404).json({ code: 40400, data: null, message: '附件不存在' });
    return;
  }

  if (row.storage_name) {
    const fp = path.join(UPLOAD_DIR, row.storage_name);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  db.prepare('DELETE FROM invoice_attachments WHERE id = ?').run(attachmentId);
  res.json({ code: 0, data: null, message: '附件删除成功' });
});

export default router;

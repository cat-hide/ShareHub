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
    const uniqueName = `ship-${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
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

// GET /api/contracts/:id/shipments
router.get('/contracts/:id/shipments', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const contractId = parseInt(req.params.id as string, 10);
  if (isNaN(contractId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的合同ID' });
    return;
  }
  const rows = db.prepare('SELECT * FROM shipments WHERE contract_id = ? ORDER BY shipment_date DESC').all(contractId);
  res.json({ code: 0, data: rows, message: 'ok' });
});

// POST /api/contracts/:id/shipments
router.post('/contracts/:id/shipments', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const contractId = parseInt(req.params.id as string, 10);
  const {
    shipment_date, description,
    material_id, shipped_quantity, material_code, material_name, specification, unit,
  } = req.body;
  if (isNaN(contractId) || !shipment_date) {
    res.status(400).json({ code: 40000, data: null, message: '缺少必填字段' });
    return;
  }
  const result = db.prepare(`
    INSERT INTO shipments (contract_id, shipment_date, description, material_id, shipped_quantity, material_code, material_name, specification, unit)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    contractId, shipment_date, description || null, material_id || null,
    shipped_quantity || 0, material_code || null, material_name || null,
    specification || null, unit || null,
  );
  const row = db.prepare('SELECT * FROM shipments WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ code: 0, data: row, message: '发货记录创建成功' });
});

// PUT /api/shipments/:id
router.put('/shipments/:id', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const id = parseInt(req.params.id as string, 10);
  const {
    shipment_date, description,
    material_id, shipped_quantity, material_code, material_name, specification, unit,
  } = req.body;

  // 检查记录是否存在
  const existing = db.prepare('SELECT id FROM shipments WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ code: 40400, data: null, message: '发货记录不存在' });
    return;
  }

  // 使用 COALESCE 模式（与 invoices 保持一致）
  db.prepare(`
    UPDATE shipments SET
      shipment_date = COALESCE(?, shipment_date),
      description = COALESCE(?, description),
      material_id = COALESCE(?, material_id),
      shipped_quantity = COALESCE(?, shipped_quantity),
      material_code = COALESCE(?, material_code),
      material_name = COALESCE(?, material_name),
      specification = COALESCE(?, specification),
      unit = COALESCE(?, unit),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    shipment_date || null,
    description != null ? description : null,
    material_id != null ? material_id : null,
    shipped_quantity != null ? shipped_quantity : null,
    material_code != null ? material_code : null,
    material_name != null ? material_name : null,
    specification != null ? specification : null,
    unit != null ? unit : null,
    id,
  );
  const row = db.prepare('SELECT * FROM shipments WHERE id = ?').get(id);
  res.json({ code: 0, data: row, message: '发货记录更新成功' });
});

// DELETE /api/shipments/:id
router.delete('/shipments/:id', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const id = parseInt(req.params.id as string, 10);

  // Clean up attachment files from disk
  const attachments = db.prepare('SELECT storage_name FROM shipment_attachments WHERE shipment_id = ?').all(id) as Array<{ storage_name: string }>;
  for (const att of attachments) {
    const fp = path.join(UPLOAD_DIR, att.storage_name);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  // Clean up legacy attachment
  const s = db.prepare('SELECT ship_attachment_path FROM shipments WHERE id = ?').get(id) as { ship_attachment_path: string } | undefined;
  if (!s) { res.status(404).json({ code: 40400, data: null, message: '记录不存在' }); return; }
  if (s.ship_attachment_path) {
    const fp = path.join(UPLOAD_DIR, s.ship_attachment_path);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }
  db.prepare('DELETE FROM shipments WHERE id = ?').run(id);
  res.json({ code: 0, data: null, message: '删除成功' });
});

// ===== Shipment Multi-File Attachment Routes =====

router.post('/shipments/:id/upload', authenticate, upload.array('files', 10), (req: Request, res: Response) => {
  const db = getDatabase();
  const shipmentId = parseInt(req.params.id as string, 10);
  const files = (req as any).files as Express.Multer.File[];

  if (isNaN(shipmentId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的发货记录ID' });
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
      'INSERT INTO shipment_attachments (shipment_id, original_name, storage_name, file_size, access_token) VALUES (?, ?, ?, ?, ?)'
    ).run(shipmentId, originalName, file.filename, file.size, accessToken);
    saved.push({
      id: r.lastInsertRowid, original_name: originalName, storage_name: file.filename, file_size: file.size, access_token: accessToken,
    });
  }

  res.json({ code: 0, data: saved, message: '上传成功' });
});

router.get('/shipments/:id/attachments', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const shipmentId = parseInt(req.params.id as string, 10);

  if (isNaN(shipmentId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的发货记录ID' });
    return;
  }

  const rows = db.prepare(
    'SELECT id, original_name, file_size, access_token, created_at FROM shipment_attachments WHERE shipment_id = ? ORDER BY created_at DESC'
  ).all(shipmentId);

  res.json({ code: 0, data: rows, message: 'ok' });
});

router.delete('/attachments/shipment/:id', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const attachmentId = parseInt(req.params.id as string, 10);

  if (isNaN(attachmentId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的附件ID' });
    return;
  }

  const row = db.prepare(
    'SELECT id, storage_name FROM shipment_attachments WHERE id = ?'
  ).get(attachmentId) as { id: number; storage_name: string } | undefined;

  if (!row) {
    res.status(404).json({ code: 40400, data: null, message: '附件不存在' });
    return;
  }

  if (row.storage_name) {
    const fp = path.join(UPLOAD_DIR, row.storage_name);
    if (fs.existsSync(fp)) fs.unlinkSync(fp);
  }

  db.prepare('DELETE FROM shipment_attachments WHERE id = ?').run(attachmentId);
  res.json({ code: 0, data: null, message: '附件删除成功' });
});

export default router;

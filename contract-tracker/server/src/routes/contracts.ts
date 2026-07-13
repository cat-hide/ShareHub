import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { getDatabase } from '../database';
import { authenticate } from '../middleware/auth';
import { exportContractsExcel } from '../utils/export';
import { UPLOAD_DIR, UPLOAD_FILE_SIZE_LIMIT } from '../config';
import { fixFilenameEncoding, ALLOWED_UPLOAD_MIMES } from '../utils/fileUtils';

const router = Router();

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueName = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: UPLOAD_FILE_SIZE_LIMIT },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (ALLOWED_UPLOAD_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 PDF 和图片格式'));
    }
  },
});

/** 判断前端传值是否为"有效的已提供值"（null/undefined/空串视为未传） */
function isProvided(val: unknown): boolean {
  return val !== null && val !== undefined && val !== '';
}

/**
 * 获取数据权限过滤条件（sales 只看自己，admin 看全部）
 */
function getAccessFilter(userRole: string, userId: number): { filterSql: string; params: unknown[] } {
  return { filterSql: '', params: [] };
}

/**
 * GET /api/contracts - 合同列表（分页+筛选）
 */
router.get('/', (req: Request, res: Response) => {
  const db = getDatabase();
  const user = req.user!;

  const page = Math.max(parseInt(req.query.page as string) || 1, 1);
  const pageSize = Math.min(Math.max(parseInt(req.query.pageSize as string) || 10, 1), 100);
  const status = req.query.status as string | undefined;
  const keyword = req.query.keyword as string | undefined;
  const startDate = req.query.startDate as string | undefined;
  const endDate = req.query.endDate as string | undefined;
  const sortBy = req.query.sortBy as string | undefined;
  const sortOrder = (req.query.sortOrder as string) === 'asc' ? 'ASC' : 'DESC';

  const { filterSql, params: accessParams } = getAccessFilter(user.role, user.id);
  console.log(`[contracts.list] user=${user.username} role=${user.role} id=${user.id} filter="${filterSql}"`);

  const conditions: string[] = [];
  const queryParams: unknown[] = [];

  if (status && ['进行中', '已完成', '已终止'].includes(status)) {
    conditions.push('c.status = ?');
    queryParams.push(status);
  }

  if (keyword && keyword.trim()) {
    conditions.push('(c.contract_no LIKE ? OR c.contract_name LIKE ? OR c.party LIKE ?)');
    const kw = `%${keyword.trim()}%`;
    queryParams.push(kw, kw, kw);
  }

  if (startDate) {
    conditions.push('c.signed_date >= ?');
    queryParams.push(startDate);
  }
  if (endDate) {
    conditions.push('c.signed_date <= ?');
    queryParams.push(endDate);
  }

  const allConditionParts: string[] = ['1=1', ...conditions];
  const cleanFilter = filterSql.replace(/^AND\s+/i, '');
  if (cleanFilter) {
    allConditionParts.push(cleanFilter);
  }
  const fullWhereSql = 'WHERE ' + allConditionParts.join(' AND ');
  const allParams = [...queryParams, ...accessParams];

  // Count total
  const countSql = `SELECT COUNT(*) as total FROM contracts c ${fullWhereSql}`;
  const { total } = db.prepare(countSql).get(...allParams) as { total: number };

  // Dynamic ORDER BY — whitelist to prevent SQL injection
  const SORT_COLUMNS: Record<string, string> = {
    signed_date:      'c.signed_date',
    contract_no:      'c.contract_no',
    project_no:       'c.project_no',
    project_name:     'c.project_name',
    party:            'c.party',
    contract_name:    'c.contract_name',
    amount:           'c.amount',
    status:           'c.status',
    salesperson:      'salesperson_name',
    invoiced:         'invoiced_amount',
    paid:             'paid_amount',
  };
  const sortColumn = SORT_COLUMNS[sortBy || ''] || 'c.updated_at';

  const offset = (page - 1) * pageSize;
  const listSql = `
    SELECT
      c.*,
      COALESCE(c.salesperson_name, u.display_name) AS salesperson_name,
      COALESCE(inv.invoiced_amount, 0) AS invoiced_amount,
      COALESCE(pay.paid_amount, 0) AS paid_amount,
      COALESCE(ship.total_shipped, 0) AS shipped_qty,
      COALESCE(mat.total_qty, 0) AS total_qty
    FROM contracts c
    LEFT JOIN users u ON c.salesperson_id = u.id
    LEFT JOIN (
      SELECT contract_id, SUM(amount) AS invoiced_amount FROM invoices GROUP BY contract_id
    ) inv ON c.id = inv.contract_id
    LEFT JOIN (
      SELECT contract_id, SUM(amount) AS paid_amount FROM payments WHERE status = '已收款' GROUP BY contract_id
    ) pay ON c.id = pay.contract_id
    LEFT JOIN (
      SELECT s.contract_id, SUM(s.shipped_quantity) AS total_shipped FROM shipments s GROUP BY s.contract_id
    ) ship ON c.id = ship.contract_id
    LEFT JOIN (
      SELECT contract_id, SUM(quantity) AS total_qty FROM contract_materials GROUP BY contract_id
    ) mat ON c.id = mat.contract_id
    ${fullWhereSql}
    ORDER BY ${sortColumn} ${sortOrder}
    LIMIT ? OFFSET ?
  `;

  const rows = db.prepare(listSql).all(...allParams, pageSize, offset) as Array<{
    id: number; contract_no: string; contract_name: string; party: string;
    amount: number; signed_date: string; status: string; salesperson_id: number;
    salesperson_name: string; invoiced_amount: number; paid_amount: number;
    shipped_qty: number; total_qty: number; created_at: string; updated_at: string;
  }>;

  const list = rows.map(row => ({
    ...row,
    payment_progress: row.amount > 0 ? Math.round((row.paid_amount / row.amount) * 100) : 0,
    ship_progress: row.total_qty > 0 ? Math.round((row.shipped_qty / row.total_qty) * 100) : 0,
    invoice_progress: row.amount > 0 ? Math.round((row.invoiced_amount / row.amount) * 100) : 0,
  }));

  res.json({ code: 0, data: { list, total, page, pageSize }, message: 'ok' });
});

/**
 * GET /api/contracts/export - 导出合同台账 Excel
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { status, keyword, startDate, endDate } = req.query as Record<string, string | undefined>;
    const buffer = await exportContractsExcel({ status, keyword, startDate, endDate });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=contracts_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ code: 50000, data: null, message: '导出失败' });
  }
});

// ==============================================================
// Attachment routes
// ==============================================================

router.get('/attachments/:id/download', (req: Request, res: Response) => {
  // This is handled by the token-based route in app.ts, redirect to app-level handler
  // (kept for backward compatibility but the main handler is in app.ts)
  const id = parseInt(req.params.id as string, 10);
  const token = req.query.token as string;
  if (token) {
    res.redirect(`/api/contracts/attachments/${id}/download?token=${encodeURIComponent(token)}`);
    return;
  }
  res.status(401).json({ code: 40100, data: null, message: '缺少访问凭证' });
});

router.get('/attachments/:id/preview', (req: Request, res: Response) => {
  const id = parseInt(req.params.id as string, 10);
  const token = req.query.token as string;
  if (token) {
    res.redirect(`/api/contracts/attachments/${id}/preview?token=${encodeURIComponent(token)}`);
    return;
  }
  res.status(401).json({ code: 40100, data: null, message: '缺少访问凭证' });
});

router.delete('/attachments/:id', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const attachmentId = parseInt(req.params.id as string, 10);

  if (isNaN(attachmentId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的附件ID' });
    return;
  }

  const row = db.prepare(
    'SELECT id, storage_name, contract_id FROM contract_attachments WHERE id = ?'
  ).get(attachmentId) as { id: number; storage_name: string; contract_id: number } | undefined;

  if (!row) {
    res.status(404).json({ code: 40400, data: null, message: '附件不存在' });
    return;
  }

  if (row.storage_name) {
    const filePath = path.join(UPLOAD_DIR, row.storage_name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  db.prepare('DELETE FROM contract_attachments WHERE id = ?').run(attachmentId);
  res.json({ code: 0, data: null, message: '附件删除成功' });
});

// ==============================================================
// Contract Materials routes
// ==============================================================

router.get('/:id/materials', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const contractId = parseInt(req.params.id as string, 10);

  if (isNaN(contractId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的合同ID' });
    return;
  }

  const rows = db.prepare('SELECT * FROM contract_materials WHERE contract_id = ? ORDER BY id ASC').all(contractId);
  res.json({ code: 0, data: rows, message: 'ok' });
});

router.post('/:id/materials', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const contractId = parseInt(req.params.id as string, 10);
  const {
    material_code, material_name, specification, unit,
    quantity, unit_price, subtotal, tax_rate, tax_amount, total_with_tax, remark,
  } = req.body;

  if (isNaN(contractId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的合同ID' });
    return;
  }

  if (!material_name) {
    res.status(400).json({ code: 40000, data: null, message: '物料名称为必填项' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO contract_materials (contract_id, material_code, material_name, specification, unit, quantity, unit_price, subtotal, tax_rate, tax_amount, total_with_tax, remark)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    contractId, material_code || null, material_name, specification || null, unit || null,
    quantity || 0, unit_price || 0, subtotal || 0, tax_rate || 0, tax_amount || 0,
    total_with_tax || 0, remark || null,
  );

  const row = db.prepare('SELECT * FROM contract_materials WHERE id = ?').get(result.lastInsertRowid);
  db.prepare("UPDATE contracts SET updated_at = datetime('now') WHERE id = ?").run(contractId);

  res.status(201).json({ code: 0, data: row, message: '物料添加成功' });
});

router.put('/materials/:id', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const materialId = parseInt(req.params.id as string, 10);
  const {
    material_code, material_name, specification, unit,
    quantity, unit_price, subtotal, tax_rate, tax_amount, total_with_tax, remark,
  } = req.body;

  if (isNaN(materialId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的物料ID' });
    return;
  }

  const existing = db.prepare('SELECT * FROM contract_materials WHERE id = ?').get(materialId);
  if (!existing) {
    res.status(404).json({ code: 40400, data: null, message: '物料不存在' });
    return;
  }

  db.prepare(`
    UPDATE contract_materials SET
      material_code = COALESCE(?, material_code),
      material_name = COALESCE(?, material_name),
      specification = COALESCE(?, specification),
      unit = COALESCE(?, unit),
      quantity = COALESCE(?, quantity),
      unit_price = COALESCE(?, unit_price),
      subtotal = COALESCE(?, subtotal),
      tax_rate = COALESCE(?, tax_rate),
      tax_amount = COALESCE(?, tax_amount),
      total_with_tax = COALESCE(?, total_with_tax),
      remark = COALESCE(?, remark)
    WHERE id = ?
  `).run(
    isProvided(material_code) ? material_code : null,
    isProvided(material_name) ? material_name : null,
    isProvided(specification) ? specification : null,
    isProvided(unit) ? unit : null,
    quantity != null ? quantity : null,
    unit_price != null ? unit_price : null,
    subtotal != null ? subtotal : null,
    tax_rate != null ? tax_rate : null,
    tax_amount != null ? tax_amount : null,
    total_with_tax != null ? total_with_tax : null,
    isProvided(remark) ? remark : null,
    materialId,
  );

  const row = db.prepare('SELECT * FROM contract_materials WHERE id = ?').get(materialId);
  const matRow = row as { contract_id: number } | undefined;
  if (matRow) {
    db.prepare("UPDATE contracts SET updated_at = datetime('now') WHERE id = ?").run(matRow.contract_id);
  }

  res.json({ code: 0, data: row, message: '物料更新成功' });
});

router.delete('/materials/:id', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const materialId = parseInt(req.params.id as string, 10);

  if (isNaN(materialId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的物料ID' });
    return;
  }

  const existing = db.prepare('SELECT * FROM contract_materials WHERE id = ?').get(materialId);
  if (!existing) {
    res.status(404).json({ code: 40400, data: null, message: '物料不存在' });
    return;
  }

  const matRow = existing as { contract_id: number };
  db.prepare('DELETE FROM contract_materials WHERE id = ?').run(materialId);
  db.prepare("UPDATE contracts SET updated_at = datetime('now') WHERE id = ?").run(matRow.contract_id);

  res.json({ code: 0, data: null, message: '物料删除成功' });
});

// ==============================================================
// Contract upload / attachment list routes
// ==============================================================

router.post('/:id/upload', authenticate, upload.array('files', 10), (req: Request, res: Response) => {
  const db = getDatabase();
  const user = req.user!;
  const contractId = parseInt(req.params.id as string, 10);
  const files = (req as Request & { files: Express.Multer.File[] }).files;

  if (isNaN(contractId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的合同ID' });
    return;
  }

  const { filterSql, params: accessParams } = getAccessFilter(user.role, user.id);
  const contract = db.prepare(
    `SELECT * FROM contracts AS c WHERE c.id = ? ${filterSql}`
  ).get(contractId, ...accessParams);

  if (!contract) {
    res.status(404).json({ code: 40400, data: null, message: '合同不存在或无权操作' });
    return;
  }

  if (!files || files.length === 0) {
    res.status(400).json({ code: 40000, data: null, message: '请选择要上传的文件' });
    return;
  }

  const savedFiles = [];
  for (const file of files) {
    const originalName = fixFilenameEncoding(file.originalname);
    const accessToken = crypto.randomBytes(16).toString('hex');

    const result = db.prepare(
      'INSERT INTO contract_attachments (contract_id, original_name, storage_name, file_size, access_token) VALUES (?, ?, ?, ?, ?)'
    ).run(contractId, originalName, file.filename, file.size, accessToken);

    savedFiles.push({
      id: result.lastInsertRowid,
      original_name: originalName,
      storage_name: file.filename,
      file_size: file.size,
      access_token: accessToken,
    });
  }

  res.json({ code: 0, data: savedFiles, message: '附件上传成功' });
});

router.get('/:id/attachments', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const contractId = parseInt(req.params.id as string, 10);

  if (isNaN(contractId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的合同ID' });
    return;
  }

  const rows = db.prepare(
    'SELECT id, original_name, storage_name, file_size, access_token, created_at FROM contract_attachments WHERE contract_id = ? ORDER BY created_at DESC'
  ).all(contractId);

  res.json({ code: 0, data: rows, message: 'ok' });
});

/**
 * POST /api/contracts - 新增合同
 */
router.post('/', (req: Request, res: Response) => {
  const db = getDatabase();
  const user = req.user!;
  const { contract_no, project_no, project_name, contract_name, party, amount, signed_date, status } = req.body;

  if (!contract_no || !contract_name || !party || amount == null || !signed_date) {
    res.status(400).json({ code: 40000, data: null, message: '缺少必填字段' });
    return;
  }

  if (typeof amount !== 'number' || amount <= 0) {
    res.status(400).json({ code: 40000, data: null, message: '合同金额必须为正数' });
    return;
  }

  const existing = db.prepare('SELECT id FROM contracts WHERE contract_no = ?').get(contract_no);
  if (existing) {
    res.status(409).json({ code: 40900, data: null, message: '合同编号已存在' });
    return;
  }

  const validStatuses = ['进行中', '已完成', '已终止'];
  const finalStatus = status && validStatuses.includes(status) ? status : '进行中';

  const salespersonId = user.role === 'sales' ? user.id : (req.body.salesperson_id || null);
  const salespersonName = req.body.salesperson_name || null;

  const result = db.prepare(`
    INSERT INTO contracts (contract_no, project_no, project_name, contract_name, party, amount, signed_date, status, salesperson_id, salesperson_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(contract_no, project_no || null, project_name || null, contract_name, party, amount, signed_date, finalStatus, salespersonId, salespersonName);

  const newContract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ code: 0, data: newContract, message: '合同创建成功' });
});

/**
 * GET /api/contracts/:id - 合同详情
 */
router.get('/:id', (req: Request, res: Response) => {
  const db = getDatabase();
  const user = req.user!;
  const contractId = parseInt(req.params.id as string, 10);

  if (isNaN(contractId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的合同ID' });
    return;
  }

  const { filterSql, params: accessParams } = getAccessFilter(user.role, user.id);

  const contract = db.prepare(`
    SELECT
      c.*,
      COALESCE(c.salesperson_name, u.display_name) AS salesperson_name,
      COALESCE(inv.invoiced_amount, 0) AS invoiced_amount,
      COALESCE(pay.paid_amount, 0) AS paid_amount,
      COALESCE(ship.total_shipped, 0) AS shipped_qty,
      COALESCE(mat.total_qty, 0) AS total_qty
    FROM contracts c
    LEFT JOIN users u ON c.salesperson_id = u.id
    LEFT JOIN (SELECT contract_id, SUM(amount) AS invoiced_amount FROM invoices GROUP BY contract_id) inv ON c.id = inv.contract_id
    LEFT JOIN (SELECT contract_id, SUM(amount) AS paid_amount FROM payments WHERE status = '已收款' GROUP BY contract_id) pay ON c.id = pay.contract_id
    LEFT JOIN (SELECT s.contract_id, SUM(s.shipped_quantity) AS total_shipped FROM shipments s GROUP BY s.contract_id) ship ON c.id = ship.contract_id
    LEFT JOIN (SELECT contract_id, SUM(quantity) AS total_qty FROM contract_materials GROUP BY contract_id) mat ON c.id = mat.contract_id
    WHERE c.id = ? ${filterSql}
  `).get(contractId, ...accessParams) as Record<string, unknown> | undefined;

  if (!contract) {
    res.status(404).json({ code: 40400, data: null, message: '合同不存在' });
    return;
  }

  const attachments = db.prepare(
    'SELECT id, original_name, file_size, access_token, created_at FROM contract_attachments WHERE contract_id = ? ORDER BY created_at DESC'
  ).all(contractId);

  const invoices = db.prepare('SELECT * FROM invoices WHERE contract_id = ? ORDER BY invoice_date DESC').all(contractId) as Array<{
    id: number; contract_id: number; invoice_no: string; invoice_date: string;
    amount: number; invoice_type: string; created_at: string; updated_at: string;
  }>;

  const { OVERDUE_DAYS } = require('../config');
  const invoicesWithPayments = invoices.map(invoice => {
    const invoiceDate = new Date(invoice.invoice_date);
    const overdueDate = new Date(invoiceDate);
    overdueDate.setDate(overdueDate.getDate() + OVERDUE_DAYS);
    return { ...invoice, paid_amount: 0, is_overdue: new Date() > overdueDate };
  });

  const c = contract as { amount: number; paid_amount: number; invoiced_amount: number; total_qty: number; shipped_qty: number };
  const paymentProgress = c.amount > 0 ? Math.round((c.paid_amount / c.amount) * 100) : 0;
  const shipProgress = c.total_qty > 0 ? Math.round((c.shipped_qty / c.total_qty) * 100) : 0;
  const invoiceProgress = c.amount > 0 ? Math.round((c.invoiced_amount / c.amount) * 100) : 0;

  res.json({
    code: 0,
    data: { ...contract, attachments, invoices: invoicesWithPayments, payment_progress: paymentProgress, ship_progress: shipProgress, invoice_progress: invoiceProgress },
    message: 'ok',
  });
});

/**
 * PUT /api/contracts/:id - 修改合同
 */
router.put('/:id', (req: Request, res: Response) => {
  const db = getDatabase();
  const user = req.user!;
  const contractId = parseInt(req.params.id as string, 10);

  if (isNaN(contractId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的合同ID' });
    return;
  }

  const { filterSql, params: accessParams } = getAccessFilter(user.role, user.id);
  const contract = db.prepare(`SELECT * FROM contracts AS c WHERE c.id = ? ${filterSql}`).get(contractId, ...accessParams);

  if (!contract) {
    res.status(404).json({ code: 40400, data: null, message: '合同不存在或无权操作' });
    return;
  }

  const { contract_no, project_no, project_name, contract_name, party, amount, signed_date, status, salesperson_id } = req.body;

  if (contract_no && contract_no !== (contract as Record<string, unknown>).contract_no) {
    const existing = db.prepare('SELECT id FROM contracts WHERE contract_no = ? AND id != ?').get(contract_no, contractId);
    if (existing) {
      res.status(409).json({ code: 40900, data: null, message: '合同编号已存在' });
      return;
    }
  }

  const validStatuses = ['进行中', '已完成', '已终止'];
  const updateStatus = status && validStatuses.includes(status) ? status : (contract as Record<string, unknown>).status;

  // 修复：使用 isProvided 判断，支持清零和空字符串
  db.prepare(`
    UPDATE contracts SET
      contract_no = COALESCE(?, contract_no),
      project_no = COALESCE(?, project_no),
      project_name = COALESCE(?, project_name),
      contract_name = COALESCE(?, contract_name),
      party = COALESCE(?, party),
      amount = COALESCE(?, amount),
      signed_date = COALESCE(?, signed_date),
      status = ?,
      salesperson_id = COALESCE(?, salesperson_id),
      salesperson_name = COALESCE(?, salesperson_name),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    isProvided(contract_no) ? contract_no : null,
    isProvided(project_no) ? project_no : null,
    isProvided(project_name) ? project_name : null,
    isProvided(contract_name) ? contract_name : null,
    isProvided(party) ? party : null,
    amount != null ? amount : null,
    isProvided(signed_date) ? signed_date : null,
    updateStatus,
    salesperson_id != null ? salesperson_id : null,
    isProvided(req.body.salesperson_name) ? req.body.salesperson_name : null,
    contractId
  );

  const updated = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId);
  res.json({ code: 0, data: updated, message: '合同更新成功' });
});

/**
 * DELETE /api/contracts/:id - 删除合同
 */
router.delete('/:id', (req: Request, res: Response) => {
  const db = getDatabase();
  const user = req.user!;
  const contractId = parseInt(req.params.id as string, 10);

  if (isNaN(contractId)) {
    res.status(400).json({ code: 40000, data: null, message: '无效的合同ID' });
    return;
  }

  const { filterSql, params: accessParams } = getAccessFilter(user.role, user.id);
  const contract = db.prepare(`SELECT * FROM contracts AS c WHERE c.id = ? ${filterSql}`).get(contractId, ...accessParams);

  if (!contract) {
    res.status(404).json({ code: 40400, data: null, message: '合同不存在或无权操作' });
    return;
  }

  // Clean up attachment files from disk
  const attachments = db.prepare('SELECT storage_name FROM contract_attachments WHERE contract_id = ?').all(contractId) as Array<{ storage_name: string }>;
  for (const att of attachments) {
    const filePath = path.join(UPLOAD_DIR, att.storage_name);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  db.prepare('DELETE FROM contracts WHERE id = ?').run(contractId);
  res.json({ code: 0, data: null, message: '合同删除成功' });
});

export default router;

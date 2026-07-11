import ExcelJS from 'exceljs';
import { getDatabase } from '../database';

// ---------------------------------------------------------------
// 表头样式常量
// ---------------------------------------------------------------
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE0E0E0' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, size: 11 };
const HEADER_ALIGN: Partial<ExcelJS.Alignment> = {
  horizontal: 'center',
  vertical: 'middle',
};
const HEADER_HEIGHT = 22;

const AMOUNT_FORMAT = '#,##0.00';
const DATE_COL_WIDTH = 15;

/** 为指定 worksheet 的首行批量设置表头样式 */
function styleHeaderRow(ws: ExcelJS.Worksheet, colCount: number): void {
  const row = ws.getRow(1);
  row.height = HEADER_HEIGHT;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.alignment = HEADER_ALIGN;
  }
}

/** 将百分比数值(0-100)格式化为"65%"字符串 */
function pct(val: number): string {
  return `${Math.round(val)}%`;
}

// ---------------------------------------------------------------
// 导出入口
// ---------------------------------------------------------------

/**
 * 导出五页 Excel 台账（仅 admin 使用，不做数据权限过滤）
 * Sheet 1: 合同列表
 * Sheet 2: 合同物料明细
 * Sheet 3: 发货明细
 * Sheet 4: 开票明细
 * Sheet 5: 收款明细
 */
interface ExportFilter {
  status?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
}

function buildWhereSql(filter: ExportFilter): { sql: string; params: unknown[] } {
  const conditions: string[] = ['1=1'];
  const params: unknown[] = [];
  if (filter.status && ['进行中', '已完成', '已终止'].includes(filter.status)) {
    conditions.push('c.status = ?');
    params.push(filter.status);
  }
  if (filter.keyword?.trim()) {
    conditions.push('(c.contract_no LIKE ? OR c.contract_name LIKE ? OR c.party LIKE ?)');
    const kw = `%${filter.keyword.trim()}%`;
    params.push(kw, kw, kw);
  }
  if (filter.startDate) {
    conditions.push('c.signed_date >= ?');
    params.push(filter.startDate);
  }
  if (filter.endDate) {
    conditions.push('c.signed_date <= ?');
    params.push(filter.endDate);
  }
  return { sql: 'WHERE ' + conditions.join(' AND '), params };
}

export async function exportContractsExcel(filter: ExportFilter = {}): Promise<ExcelJS.Buffer> {
  const db = getDatabase();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '合同跟踪平台';
  workbook.created = new Date();

  const { sql: whereSql, params } = buildWhereSql(filter);

  // Collect matching contract IDs for subsequent sheets
  const matchingIds = db.prepare(
    `SELECT c.id FROM contracts c ${whereSql}`
  ).all(...params).map((r: any) => r.id);

  if (matchingIds.length === 0) {
    // Still create sheets but empty
  }

  // ---- Sheet 1: 合同列表 ----
  await buildContractSheet(workbook, db, whereSql, params);

  // ---- Sheet 2-5: detail sheets filtered by matching contract IDs ----
  // Use parameterized IN clause to prevent SQL injection
  const placeholders = matchingIds.length > 0 ? matchingIds.map(() => '?').join(',') : '?';
  const idsParams: unknown[] = matchingIds.length > 0 ? matchingIds : [0];
  await buildMaterialSheet(workbook, db, placeholders, idsParams);
  await buildShipmentSheet(workbook, db, placeholders, idsParams);
  await buildInvoiceSheet(workbook, db, placeholders, idsParams);
  await buildPaymentSheet(workbook, db, placeholders, idsParams);

  return workbook.xlsx.writeBuffer();
}

// ---------------------------------------------------------------
// Sheet 1: 合同列表
// ---------------------------------------------------------------
async function buildContractSheet(
  workbook: ExcelJS.Workbook,
  db: ReturnType<typeof getDatabase>,
  whereSql: string,
  params: unknown[],
): Promise<void> {
  const rows = db.prepare(`
    SELECT
      c.signed_date,
      c.contract_no,
      c.project_no,
      c.project_name,
      c.party,
      c.contract_name,
      c.amount,
      c.status,
      COALESCE(c.salesperson_name, u.display_name) AS salesperson_name,
      COALESCE(inv.invoiced_amount, 0) AS invoiced_amount,
      COALESCE(pay.paid_amount, 0)   AS paid_amount,
      COALESCE(ship.total_shipped, 0) AS shipped_qty,
      COALESCE(mat.total_qty, 0)      AS total_qty
    FROM contracts c
    LEFT JOIN users u ON c.salesperson_id = u.id
    LEFT JOIN (
      SELECT contract_id, SUM(amount) AS invoiced_amount
      FROM invoices
      GROUP BY contract_id
    ) inv ON c.id = inv.contract_id
    LEFT JOIN (
      SELECT contract_id, SUM(amount) AS paid_amount
      FROM payments
      WHERE status = '已收款'
      GROUP BY contract_id
    ) pay ON c.id = pay.contract_id
    LEFT JOIN (
      SELECT s.contract_id, SUM(s.shipped_quantity) AS total_shipped
      FROM shipments s
      GROUP BY s.contract_id
    ) ship ON c.id = ship.contract_id
    LEFT JOIN (
      SELECT contract_id, SUM(quantity) AS total_qty
      FROM contract_materials
      GROUP BY contract_id
    ) mat ON c.id = mat.contract_id
    ${whereSql}
    ORDER BY c.signed_date DESC
  `).all(...params) as Array<{
    signed_date: string | null;
    contract_no: string;
    project_no: string | null;
    project_name: string | null;
    party: string;
    contract_name: string;
    amount: number;
    status: string;
    salesperson_name: string | null;
    invoiced_amount: number;
    paid_amount: number;
    shipped_qty: number;
    total_qty: number;
  }>;

  const ws = workbook.addWorksheet('合同列表');

  const headers = [
    '签约日期', '合同编号', '项目号', '项目名称', '签约方',
    '合同标的', '合同金额', '状态', '业务员',
    '已开票金额', '已回款金额', '开票进度', '回款进度', '发货进度',
  ];
  ws.addRow(headers);
  styleHeaderRow(ws, headers.length);

  for (const r of rows) {
    const invoiceProgress = r.amount > 0
      ? Math.round((r.invoiced_amount / r.amount) * 100) : 0;
    const paymentProgress = r.amount > 0
      ? Math.round((r.paid_amount / r.amount) * 100) : 0;
    const shipProgress = r.total_qty > 0
      ? Math.round((r.shipped_qty / r.total_qty) * 100) : 0;

    ws.addRow([
      r.signed_date || '-',
      r.contract_no,
      r.project_no || '-',
      r.project_name || '-',
      r.party,
      r.contract_name,
      r.amount,
      r.status,
      r.salesperson_name || '-',
      r.invoiced_amount,
      r.paid_amount,
      pct(invoiceProgress),
      pct(paymentProgress),
      pct(shipProgress),
    ]);
  }

  // 列宽 & 格式
  ws.getColumn(1).width = DATE_COL_WIDTH;   // 签约日期
  ws.getColumn(2).width = 18;               // 合同编号
  ws.getColumn(3).width = 15;               // 项目号
  ws.getColumn(4).width = 22;               // 项目名称
  ws.getColumn(5).width = 24;               // 签约方
  ws.getColumn(6).width = 30;               // 合同标的
  ws.getColumn(7).width = 16;               // 合同金额
  ws.getColumn(7).numFmt = AMOUNT_FORMAT;
  ws.getColumn(8).width = 10;               // 状态
  ws.getColumn(9).width = 12;               // 业务员
  ws.getColumn(10).width = 16;              // 已开票金额
  ws.getColumn(10).numFmt = AMOUNT_FORMAT;
  ws.getColumn(11).width = 16;              // 已回款金额
  ws.getColumn(11).numFmt = AMOUNT_FORMAT;
  ws.getColumn(12).width = 12;              // 开票进度
  ws.getColumn(13).width = 12;              // 回款进度
  ws.getColumn(14).width = 12;              // 发货进度
}

// ---------------------------------------------------------------
// Sheet 2: 合同物料明细
// ---------------------------------------------------------------
async function buildMaterialSheet(
  workbook: ExcelJS.Workbook,
  db: ReturnType<typeof getDatabase>,
  placeholders: string,
  ids: unknown[],
): Promise<void> {
  const rows = db.prepare(`
    SELECT
      cm.material_code,
      cm.material_name,
      cm.specification,
      cm.unit,
      cm.quantity,
      cm.unit_price,
      cm.subtotal,
      cm.tax_rate,
      cm.tax_amount,
      cm.total_with_tax,
      cm.remark,
      c.contract_no,
      c.contract_name
    FROM contract_materials cm
    JOIN contracts c ON cm.contract_id = c.id
    WHERE cm.contract_id IN (${placeholders})
    ORDER BY c.contract_no, cm.id
  `).all(...ids) as Array<{
    material_code: string | null;
    material_name: string;
    specification: string | null;
    unit: string | null;
    quantity: number;
    unit_price: number;
    subtotal: number;
    tax_rate: number;
    tax_amount: number;
    total_with_tax: number;
    remark: string | null;
    contract_no: string;
    contract_name: string;
  }>;

  const ws = workbook.addWorksheet('合同物料明细');

  const headers = [
    '合同编号', '合同名称', '物料编码', '物料名称', '规格型号',
    '单位', '数量', '不含税单价', '不含税小计', '税率',
    '税额', '价税合计', '备注',
  ];
  ws.addRow(headers);
  styleHeaderRow(ws, headers.length);

  for (const r of rows) {
    ws.addRow([
      r.contract_no,
      r.contract_name,
      r.material_code || '-',
      r.material_name,
      r.specification || '-',
      r.unit || '-',
      r.quantity,
      r.unit_price,
      r.subtotal,
      r.tax_rate,
      r.tax_amount,
      r.total_with_tax,
      r.remark || '-',
    ]);
  }

  // 列宽 & 格式
  ws.getColumn(1).width = 18;              // 合同编号
  ws.getColumn(2).width = 24;              // 合同名称
  ws.getColumn(3).width = 14;              // 物料编码
  ws.getColumn(4).width = 18;              // 物料名称
  ws.getColumn(5).width = 18;              // 规格型号
  ws.getColumn(6).width = 8;               // 单位
  ws.getColumn(7).width = 10;              // 数量
  ws.getColumn(8).width = 14;              // 不含税单价
  ws.getColumn(8).numFmt = AMOUNT_FORMAT;
  ws.getColumn(9).width = 14;              // 不含税小计
  ws.getColumn(9).numFmt = AMOUNT_FORMAT;
  ws.getColumn(10).width = 10;             // 税率
  ws.getColumn(10).numFmt = '0.00%';
  ws.getColumn(11).width = 14;             // 税额
  ws.getColumn(11).numFmt = AMOUNT_FORMAT;
  ws.getColumn(12).width = 14;             // 价税合计
  ws.getColumn(12).numFmt = AMOUNT_FORMAT;
  ws.getColumn(13).width = 20;             // 备注
}

// ---------------------------------------------------------------
// Sheet 3: 发货明细
// ---------------------------------------------------------------
async function buildShipmentSheet(
  workbook: ExcelJS.Workbook,
  db: ReturnType<typeof getDatabase>,
  placeholders: string,
  ids: unknown[],
): Promise<void> {
  const rows = db.prepare(`
    SELECT
      s.shipment_date,
      s.material_code,
      s.material_name,
      s.specification,
      s.unit,
      s.shipped_quantity,
      s.description,
      c.contract_no,
      c.contract_name
    FROM shipments s
    JOIN contracts c ON s.contract_id = c.id
    WHERE s.contract_id IN (${placeholders})
    ORDER BY c.contract_no, s.shipment_date
  `).all(...ids) as Array<{
    shipment_date: string;
    material_code: string | null;
    material_name: string | null;
    specification: string | null;
    unit: string | null;
    shipped_quantity: number;
    description: string | null;
    contract_no: string;
    contract_name: string;
  }>;

  const ws = workbook.addWorksheet('发货明细');

  const headers = [
    '合同编号', '合同名称', '发货日期', '物料编码', '物料名称',
    '规格型号', '单位', '发货数量', '备注',
  ];
  ws.addRow(headers);
  styleHeaderRow(ws, headers.length);

  for (const r of rows) {
    ws.addRow([
      r.contract_no,
      r.contract_name,
      r.shipment_date,
      r.material_code || '-',
      r.material_name || '-',
      r.specification || '-',
      r.unit || '-',
      r.shipped_quantity,
      r.description || '-',
    ]);
  }

  // 列宽 & 格式
  ws.getColumn(1).width = 18;              // 合同编号
  ws.getColumn(2).width = 24;              // 合同名称
  ws.getColumn(3).width = DATE_COL_WIDTH;  // 发货日期
  ws.getColumn(4).width = 14;              // 物料编码
  ws.getColumn(5).width = 18;              // 物料名称
  ws.getColumn(6).width = 18;              // 规格型号
  ws.getColumn(7).width = 8;               // 单位
  ws.getColumn(8).width = 12;              // 发货数量
  ws.getColumn(9).width = 24;              // 备注
}

// ---------------------------------------------------------------
// Sheet 4: 开票明细
// ---------------------------------------------------------------
async function buildInvoiceSheet(
  workbook: ExcelJS.Workbook,
  db: ReturnType<typeof getDatabase>,
  placeholders: string,
  ids: unknown[],
): Promise<void> {
  const rows = db.prepare(`
    SELECT
      i.invoice_no,
      i.invoice_date,
      i.invoice_type,
      i.amount,
      c.contract_no,
      c.contract_name
    FROM invoices i
    JOIN contracts c ON i.contract_id = c.id
    WHERE i.contract_id IN (${placeholders})
    ORDER BY c.contract_no, i.invoice_date
  `).all(...ids) as Array<{
    invoice_no: string;
    invoice_date: string;
    invoice_type: string;
    amount: number;
    contract_no: string;
    contract_name: string;
  }>;

  const ws = workbook.addWorksheet('开票明细');

  const headers = [
    '合同编号', '合同名称', '发票号码', '开票日期', '发票类型', '金额',
  ];
  ws.addRow(headers);
  styleHeaderRow(ws, headers.length);

  for (const r of rows) {
    ws.addRow([
      r.contract_no,
      r.contract_name,
      r.invoice_no,
      r.invoice_date,
      r.invoice_type,
      r.amount,
    ]);
  }

  // 列宽 & 格式
  ws.getColumn(1).width = 18;              // 合同编号
  ws.getColumn(2).width = 24;              // 合同名称
  ws.getColumn(3).width = 18;              // 发票号码
  ws.getColumn(4).width = DATE_COL_WIDTH;  // 开票日期
  ws.getColumn(5).width = 18;              // 发票类型
  ws.getColumn(6).width = 16;              // 金额
  ws.getColumn(6).numFmt = AMOUNT_FORMAT;
}

// ---------------------------------------------------------------
// Sheet 5: 收款明细
// ---------------------------------------------------------------
async function buildPaymentSheet(
  workbook: ExcelJS.Workbook,
  db: ReturnType<typeof getDatabase>,
  placeholders: string,
  ids: unknown[],
): Promise<void> {
  const rows = db.prepare(`
    SELECT
      p.payment_date,
      p.amount,
      p.status,
      c.contract_no,
      c.contract_name
    FROM payments p
    JOIN contracts c ON p.contract_id = c.id
    WHERE p.contract_id IN (${placeholders})
    ORDER BY c.contract_no, p.payment_date
  `).all(...ids) as Array<{
    payment_date: string;
    amount: number;
    status: string;
    contract_no: string;
    contract_name: string;
  }>;

  const ws = workbook.addWorksheet('收款明细');

  const headers = [
    '合同编号', '合同名称', '收款日期', '收款金额', '回款状态',
  ];
  ws.addRow(headers);
  styleHeaderRow(ws, headers.length);

  for (const r of rows) {
    ws.addRow([
      r.contract_no,
      r.contract_name,
      r.payment_date,
      r.amount,
      r.status,
    ]);
  }

  // 列宽 & 格式
  ws.getColumn(1).width = 18;              // 合同编号
  ws.getColumn(2).width = 24;              // 合同名称
  ws.getColumn(3).width = DATE_COL_WIDTH;  // 收款日期
  ws.getColumn(4).width = 16;              // 收款金额
  ws.getColumn(4).numFmt = AMOUNT_FORMAT;
  ws.getColumn(5).width = 12;              // 回款状态
}

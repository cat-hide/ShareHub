import { Router, Request, Response } from 'express';
import { getDatabase } from '../database';

const router = Router();

/**
 * GET /api/dashboard/stats - 数据看板统计
 */
router.get('/stats', (_req: Request, res: Response) => {
  const db = getDatabase();

  // 合同概览
  const contractStats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(amount) AS total_amount,
      SUM(CASE WHEN status = '进行中' THEN 1 ELSE 0 END) AS ongoing,
      SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) AS completed,
      SUM(CASE WHEN status = '已终止' THEN 1 ELSE 0 END) AS terminated
    FROM contracts
  `).get() as { total: number; total_amount: number | null; ongoing: number; completed: number; terminated: number };

  // 开票统计
  const invoiceStats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(amount), 0) AS total_amount
    FROM invoices
  `).get() as { total: number; total_amount: number };

  // 回款统计
  const paymentStats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(amount), 0) AS total_paid,
      COALESCE(SUM(CASE WHEN status = '未收款' THEN amount ELSE 0 END), 0) AS total_pending
    FROM payments
  `).get() as { total: number; total_paid: number; total_pending: number };

  // 发货统计
  const shipmentStats = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(shipped_quantity), 0) AS total_shipped
    FROM shipments
  `).get() as { total: number; total_shipped: number };

  // 最近合同（前 5 条）
  const recentContracts = db.prepare(`
    SELECT c.id, c.contract_no, c.contract_name, c.party, c.amount, c.status, c.signed_date,
           COALESCE(c.salesperson_name, u.display_name) AS salesperson_name
    FROM contracts c
    LEFT JOIN users u ON c.salesperson_id = u.id
    ORDER BY c.updated_at DESC
    LIMIT 5
  `).all();

  // 物料总数
  const materialStats = db.prepare(`
    SELECT
      COUNT(DISTINCT contract_id) AS contract_count,
      COUNT(*) AS total_items
    FROM contract_materials
  `).get() as { contract_count: number; total_items: number };

  // 回款率
  const totalPaid = paymentStats.total_paid as number;
  const totalAmount = contractStats.total_amount || 0;
  const paymentRate = totalAmount > 0 ? Math.round((totalPaid / totalAmount) * 100) : 0;

  // 开票率
  const totalInvoiced = invoiceStats.total_amount as number;
  const invoiceRate = totalAmount > 0 ? Math.round((totalInvoiced / totalAmount) * 100) : 0;

  res.json({
    code: 0,
    data: {
      contracts: {
        total: contractStats.total,
        ongoing: contractStats.ongoing,
        completed: contractStats.completed,
        terminated: contractStats.terminated,
        totalAmount: totalAmount,
      },
      invoices: {
        total: invoiceStats.total,
        totalAmount: totalInvoiced,
        rate: invoiceRate,
      },
      payments: {
        total: paymentStats.total,
        totalPaid,
        totalPending: paymentStats.total_pending,
        rate: paymentRate,
      },
      shipments: {
        total: shipmentStats.total,
        totalShipped: shipmentStats.total_shipped,
      },
      materials: {
        contractCount: materialStats.contract_count,
        totalItems: materialStats.total_items,
      },
      recentContracts,
    },
    message: 'ok',
  });
});

export default router;

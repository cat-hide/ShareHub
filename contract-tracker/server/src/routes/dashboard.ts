import { Router, Request, Response } from 'express';
import { getDatabase } from '../database';

const router = Router();

router.get('/stats', (_req: Request, res: Response) => {
  const db = getDatabase();

  // 合同概览
  const c = db.prepare(`
    SELECT
      COUNT(*) AS total,
      COALESCE(SUM(amount), 0) AS total_amount,
      SUM(CASE WHEN status='进行中' THEN 1 ELSE 0 END) AS ongoing,
      SUM(CASE WHEN status='已完成' THEN 1 ELSE 0 END) AS done,
      SUM(CASE WHEN status='已终止' THEN 1 ELSE 0 END) AS stopped
    FROM contracts
  `).get() as any;

  // 开票
  const inv = db.prepare(`SELECT COUNT(*) AS cnt, COALESCE(SUM(amount),0) AS amt FROM invoices`).get() as any;

  // 回款
  const pay = db.prepare(`
    SELECT
      COUNT(*) AS cnt,
      COALESCE(SUM(CASE WHEN status='已收款' THEN amount ELSE 0 END),0) AS paid,
      COALESCE(SUM(CASE WHEN status!='已收款' THEN amount ELSE 0 END),0) AS pending
    FROM payments
  `).get() as any;

  // 发货
  const ship = db.prepare(`SELECT COUNT(*) AS cnt, COALESCE(SUM(shipped_quantity),0) AS qty FROM shipments`).get() as any;

  // 物料
  const mat = db.prepare(`SELECT COUNT(DISTINCT contract_id) AS c_cnt, COUNT(*) AS items FROM contract_materials`).get() as any;

  // 最近合同
  const recent = db.prepare(`
    SELECT c.id, c.contract_no, c.contract_name, c.party, c.amount, c.status, c.signed_date,
           COALESCE(c.salesperson_name, u.display_name) AS salesperson_name
    FROM contracts c
    LEFT JOIN users u ON c.salesperson_id = u.id
    ORDER BY c.updated_at DESC LIMIT 5
  `).all();

  const totalAmt = c.total_amount as number;
  const paid = pay.paid as number;
  const invoiced = inv.amt as number;
  const payRate = totalAmt > 0 ? Math.round((paid / totalAmt) * 100) : 0;
  const invRate = totalAmt > 0 ? Math.round((invoiced / totalAmt) * 100) : 0;

  res.json({
    code: 0,
    data: {
      contracts: { total: c.total, ongoing: c.ongoing, done: c.done, stopped: c.stopped, totalAmount: totalAmt },
      invoices:  { total: inv.cnt, totalAmount: invoiced, rate: invRate },
      payments:  { total: pay.cnt, totalPaid: paid, totalPending: pay.pending, rate: payRate },
      shipments: { total: ship.cnt, totalShipped: ship.qty },
      materials: { contractCount: mat.c_cnt, totalItems: mat.items },
      recentContracts: recent,
    },
    message: 'ok',
  });
});

export default router;

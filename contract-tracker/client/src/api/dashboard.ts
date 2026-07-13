import client from './client';

export interface DashboardStats {
  contracts: {
    total: number;
    ongoing: number;
    done: number;
    stopped: number;
    totalAmount: number;
  };
  invoices: { total: number; totalAmount: number; rate: number };
  payments: { total: number; totalPaid: number; totalPending: number; rate: number };
  shipments: { total: number; totalShipped: number };
  materials: { contractCount: number; totalItems: number };
  recentContracts: Array<{
    id: number; contract_no: string; contract_name: string; party: string;
    amount: number; status: string; signed_date: string; salesperson_name: string | null;
  }>;
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const res = await client.get('/dashboard/stats');
  return res.data.data;
}

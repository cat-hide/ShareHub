import { useState, useCallback } from 'react';
import type { Invoice, InvoiceWithPayments } from '../types';
import * as invoicesApi from '../api/invoices';

interface UseInvoicesReturn {
  invoices: InvoiceWithPayments[];
  loading: boolean;
  error: string | null;
  fetchInvoices: (contractId: number) => Promise<void>;
  addInvoice: (contractId: number, data: { invoice_no: string; invoice_date: string; amount: number; invoice_type: string }) => Promise<boolean>;
  updateInvoice: (id: number, data: Partial<Invoice>) => Promise<boolean>;
  removeInvoice: (id: number) => Promise<boolean>;
}

/**
 * 开票管理 Hook（收款已独立，不在此处管理）
 */
export function useInvoices(): UseInvoicesReturn {
  const [invoices, setInvoices] = useState<InvoiceWithPayments[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async (contractId: number) => {
    setLoading(true);
    setError(null);
    try {
      const invRes = await invoicesApi.getInvoices(contractId);
      console.log('[useInvoices.fetchInvoices] API response:', invRes);
      if (invRes.code === 0) {
        const list = invRes.data as InvoiceWithPayments[];
        console.log('[useInvoices.fetchInvoices] Got', list.length, 'invoices from API');
        // Calculate overdue status for each invoice
        const OVERDUE_DAYS = 60;
        const enriched = list.map(inv => {
          const paidAmount = 0; // payments are now independent
          const invoiceDate = new Date(inv.invoice_date);
          const overdueDate = new Date(invoiceDate);
          overdueDate.setDate(overdueDate.getDate() + OVERDUE_DAYS);
          const isOverdue = new Date() > overdueDate && paidAmount < inv.amount;
          return { ...inv, paid_amount: paidAmount, is_overdue: isOverdue };
        });
        console.log('[useInvoices.fetchInvoices] Setting', enriched.length, 'enriched invoices');
        setInvoices(enriched);
      } else {
        console.error('[useInvoices.fetchInvoices] API error code:', invRes.code, 'message:', invRes.message);
        setError(invRes.message);
      }
    } catch (err) {
      console.error('[useInvoices.fetchInvoices] Caught error:', err);
      setError(err instanceof Error ? err.message : '获取开票记录失败');
    } finally {
      setLoading(false);
    }
  }, []);

  const addInvoice = useCallback(async (contractId: number, data: {
    invoice_no: string;
    invoice_date: string;
    amount: number;
    invoice_type: string;
  }): Promise<boolean> => {
    try {
      const res = await invoicesApi.createInvoice(contractId, data);
      if (res.code === 0) {
        await fetchInvoices(contractId);
        return true;
      }
      setError(res.message);
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增开票记录失败');
      return false;
    }
  }, [fetchInvoices]);

  const updateInvoice = useCallback(async (id: number, data: Partial<Invoice>): Promise<boolean> => {
    try {
      const res = await invoicesApi.updateInvoice(id, data);
      if (res.code === 0) {
        setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, ...res.data } : inv));
        return true;
      }
      setError(res.message);
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : '修改开票记录失败');
      return false;
    }
  }, []);

  const removeInvoice = useCallback(async (id: number): Promise<boolean> => {
    try {
      const res = await invoicesApi.deleteInvoice(id);
      if (res.code === 0) {
        setInvoices(prev => prev.filter(inv => inv.id !== id));
        return true;
      }
      setError(res.message);
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除开票记录失败');
      return false;
    }
  }, []);

  return { invoices, loading, error, fetchInvoices, addInvoice, updateInvoice, removeInvoice };
}

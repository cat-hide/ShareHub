import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@mui/material';
import type { Invoice } from '../types';

interface InvoiceFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { invoice_no: string; invoice_date: string; amount: number; invoice_type: string }) => Promise<boolean>;
  initialData?: Invoice | null;
  loading?: boolean;
}

/**
 * 开票记录表单（弹窗形式）
 */
export default function InvoiceForm({ open, onClose, onSubmit, initialData, loading }: InvoiceFormProps) {
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState('');
  const [amount, setAmount] = useState('');
  const [invoiceType, setInvoiceType] = useState('增值税专用发票');
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {
    if (initialData) {
      setInvoiceNo(initialData.invoice_no);
      setInvoiceDate(initialData.invoice_date);
      setAmount(String(initialData.amount));
      setInvoiceType(initialData.invoice_type);
    } else {
      setInvoiceNo('');
      setInvoiceDate('');
      setAmount('');
      setInvoiceType('增值税专用发票');
    }
    setErrors({});
  }, [initialData, open]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!invoiceNo.trim()) newErrors.invoiceNo = '请输入发票号码';
    if (!invoiceDate) newErrors.invoiceDate = '请选择开票日期';
    if (!amount || parseFloat(amount) <= 0) newErrors.amount = '请输入有效的开票金额';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const ok = await onSubmit({
      invoice_no: invoiceNo.trim(),
      invoice_date: invoiceDate,
      amount: parseFloat(amount),
      invoice_type: invoiceType,
    });

    if (ok) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit}>
        <DialogTitle>{initialData ? '编辑开票记录' : '新增开票记录'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 0.5 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="发票号码"
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                error={!!errors.invoiceNo}
                helperText={errors.invoiceNo}
                disabled={loading}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel>发票类型</InputLabel>
                <Select
                  value={invoiceType}
                  label="发票类型"
                  onChange={(e) => setInvoiceType(e.target.value)}
                  disabled={loading}
                >
                  <MenuItem value="增值税专用发票">增值税专用发票</MenuItem>
                  <MenuItem value="增值税普通发票">增值税普通发票</MenuItem>
                  <MenuItem value="电子发票">电子发票</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="开票金额"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                error={!!errors.amount}
                helperText={errors.amount}
                disabled={loading}
                inputProps={{ min: 0, step: 0.01 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                required
                label="开票日期"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                error={!!errors.invoiceDate}
                helperText={errors.invoiceDate}
                disabled={loading}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>取消</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? '保存中...' : initialData ? '更新' : '新增'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

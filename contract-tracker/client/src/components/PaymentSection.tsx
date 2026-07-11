import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Button, Chip, Dialog,
  DialogTitle, DialogContent, DialogActions, TextField,
  Tooltip, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import type { Payment, PaymentCreatePayload, PaymentAttachment } from '../types';
import * as paymentsApi from '../api/payments';
import ConfirmDialog from './ConfirmDialog';

function formatAmount(a: number) { return a.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(d: string) { if (!d) return ''; const dt = new Date(d); return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`; }

interface Props {
  payments: Payment[];
  contractId: number;
  onRefresh: () => void;
}

export default function PaymentSection({ payments, contractId, onRefresh }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Payment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formStatus, setFormStatus] = useState('未收款');
  const [formLoading, setFormLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [deleteAttachTarget, setDeleteAttachTarget] = useState<PaymentAttachment | null>(null);
  const [attachmentsMap, setAttachmentsMap] = useState<Record<number, PaymentAttachment[]>>({});

  const fetchAttachments = useCallback(async (paymentId: number) => {
    try {
      const { data } = await paymentsApi.getPaymentAttachments(paymentId);
      setAttachmentsMap(prev => ({ ...prev, [paymentId]: data }));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    payments.forEach(p => {
      if (!(p.id in attachmentsMap)) {
        fetchAttachments(p.id);
      }
    });
  }, [payments, fetchAttachments, attachmentsMap]);

  const openAdd = () => {
    setEditTarget(null);
    setFormDate(''); setFormAmount(''); setFormStatus('未收款');
    setDialogOpen(true);
  };

  const openEdit = (p: Payment) => {
    setEditTarget(p);
    setFormDate(p.payment_date);
    setFormAmount(String(p.amount));
    setFormStatus(p.status || '未收款');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formDate || !formAmount) return;
    setFormLoading(true);
    try {
      if (editTarget) {
        await paymentsApi.updatePayment(editTarget.id, { payment_date: formDate, amount: parseFloat(formAmount), status: formStatus });
      } else {
        await paymentsApi.createPayment(contractId, { payment_date: formDate, amount: parseFloat(formAmount), status: formStatus });
      }
      setDialogOpen(false);
      onRefresh();
    } finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await paymentsApi.deletePayment(deleteTarget.id);
    setDeleteTarget(null);
    onRefresh();
  };

  const handleUpload = async (id: number, files: FileList) => {
    setUploadingId(id);
    try {
      await paymentsApi.uploadPaymentAttachments(id, Array.from(files));
      await fetchAttachments(id);
      onRefresh();
    } finally { setUploadingId(null); }
  };

  const handleDeleteAttachment = async () => {
    if (!deleteAttachTarget) return;
    try {
      await paymentsApi.deletePaymentAttachment(deleteAttachTarget.id);
      for (const [payId, atts] of Object.entries(attachmentsMap)) {
        if (atts.some(a => a.id === deleteAttachTarget.id)) {
          await fetchAttachments(parseInt(payId));
          break;
        }
      }
    } finally { setDeleteAttachTarget(null); }
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>收款记录</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openAdd}>新增收款</Button>
      </Box>

      {payments.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>暂无收款记录</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>收款日期</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">实际收款金额</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>回款状态</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>银行回单</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.map(p => {
                const atts = attachmentsMap[p.id] || [];
                return (
                  <TableRow key={p.id} hover>
                    <TableCell>{formatDate(p.payment_date)}</TableCell>
                    <TableCell align="right">{formatAmount(p.amount)}</TableCell>
                    <TableCell>
                      <Chip size="small" label={p.status || '未收款'}
                        color={p.status === '已收款' ? 'success' : 'warning'} />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {atts.map(att => (
                          <Box key={att.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Chip label={att.original_name} size="small" variant="outlined"
                              sx={{ maxWidth: 160, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
                            <Typography variant="caption" color="text.secondary">{paymentsApi.formatFileSize(att.file_size)}</Typography>
                            <Tooltip title="预览">
                              <IconButton size="small" href={paymentsApi.getPaymentAttachmentPreviewUrl(att.id, att.access_token)} target="_blank">
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="下载">
                              <IconButton size="small" href={paymentsApi.getPaymentAttachmentDownloadUrl(att.id, att.access_token)} target="_blank">
                                <DownloadIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="删除">
                              <IconButton size="small" color="error" onClick={() => setDeleteAttachTarget(att)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ))}
                        <label>
                          <input type="file" hidden multiple accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => e.target.files && handleUpload(p.id, e.target.files)} />
                          <Button size="small" variant="text" component="span" startIcon={<CloudUploadIcon />}
                            disabled={uploadingId === p.id}>上传回单</Button>
                        </label>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => openEdit(p)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(p)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editTarget ? '编辑收款记录' : '新增收款记录'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField label="收款日期" type="date" fullWidth required value={formDate}
              onChange={e => setFormDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="实际收款金额" type="number" fullWidth required value={formAmount}
              onChange={e => setFormAmount(e.target.value)} inputProps={{ min: 0, step: 0.01 }} />
            <FormControl fullWidth>
              <InputLabel>回款状态</InputLabel>
              <Select value={formStatus} label="回款状态"
                onChange={e => setFormStatus(e.target.value)}>
                <MenuItem value="未收款">未收款</MenuItem>
                <MenuItem value="已收款">已收款</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button onClick={handleSave} variant="contained" disabled={formLoading || !formDate || !formAmount}>
            {formLoading ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="确认删除" content="确定删除该收款记录？关联的银行回单也将被删除。"
        confirmText="删除" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} danger />
      <ConfirmDialog open={!!deleteAttachTarget} title="确认删除" content={`确定删除附件 "${deleteAttachTarget?.original_name}"？`}
        onConfirm={handleDeleteAttachment} onCancel={() => setDeleteAttachTarget(null)} danger />
    </Paper>
  );
}

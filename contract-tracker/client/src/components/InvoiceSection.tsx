import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Tooltip, Button, Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import type { InvoiceWithPayments, InvoiceAttachment } from '../types';
import * as invoicesApi from '../api/invoices';
import StatusChip from './StatusChip';
import InvoiceForm from './InvoiceForm';
import ConfirmDialog from './ConfirmDialog';

interface InvoiceSectionProps {
  invoices: InvoiceWithPayments[];
  onAddInvoice: (contractId: number, data: any) => Promise<boolean>;
  onUpdateInvoice: (id: number, data: any) => Promise<boolean>;
  onDeleteInvoice: (id: number) => Promise<boolean>;
  contractId: number;
}

function formatAmount(a: number) { return a.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(d: string) { if (!d) return ''; const dt = new Date(d); return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`; }

export default function InvoiceSection({ invoices, onAddInvoice, onUpdateInvoice, onDeleteInvoice, contractId }: InvoiceSectionProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [deleteAttachTarget, setDeleteAttachTarget] = useState<InvoiceAttachment | null>(null);
  const [attachmentsMap, setAttachmentsMap] = useState<Record<number, InvoiceAttachment[]>>({});

  const handleAdd = async (data: any) => { setActionLoading(true); const r = await onAddInvoice(contractId, data); setActionLoading(false); return r; };
  const handleUpdate = async (data: any) => { if (!editTarget) return false; setActionLoading(true); const r = await onUpdateInvoice(editTarget.id, data); setActionLoading(false); return r; };
  const handleDelete = async () => { if (!deleteTarget) return; setActionLoading(true); await onDeleteInvoice(deleteTarget.id); setActionLoading(false); setDeleteTarget(null); };

  const fetchAttachments = useCallback(async (invoiceId: number) => {
    try {
      const { data } = await invoicesApi.getInvoiceAttachments(invoiceId);
      setAttachmentsMap(prev => ({ ...prev, [invoiceId]: data }));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    invoices.forEach(inv => {
      if (!(inv.id in attachmentsMap)) {
        fetchAttachments(inv.id);
      }
    });
  }, [invoices, fetchAttachments, attachmentsMap]);

  const handleUpload = async (id: number, files: FileList) => {
    setUploadingId(id);
    try {
      await invoicesApi.uploadInvoiceAttachments(id, Array.from(files));
      await fetchAttachments(id);
    } finally { setUploadingId(null); }
  };

  const handleDeleteAttachment = async () => {
    if (!deleteAttachTarget) return;
    try {
      await invoicesApi.deleteInvoiceAttachment(deleteAttachTarget.id);
      // Find the invoice id from attachmentsMap
      for (const [invId, atts] of Object.entries(attachmentsMap)) {
        if (atts.some(a => a.id === deleteAttachTarget.id)) {
          await fetchAttachments(parseInt(invId));
          break;
        }
      }
    } finally { setDeleteAttachTarget(null); }
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="h6" fontWeight={600}>开票记录</Typography>
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => { setEditTarget(null); setFormOpen(true); }}>新增开票</Button>
      </Box>

      {invoices.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>暂无开票记录</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>发票号码</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>发票类型</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">开票金额</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>开票日期</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>逾期状态</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>发票附件</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {invoices.map(inv => {
                const atts = attachmentsMap[inv.id] || [];
                return (
                  <TableRow key={inv.id} hover>
                    <TableCell>{inv.invoice_no}</TableCell>
                    <TableCell>{inv.invoice_type}</TableCell>
                    <TableCell align="right">{formatAmount(inv.amount)}</TableCell>
                    <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                    <TableCell>{inv.is_overdue ? <StatusChip status="" type="overdue" /> : '-'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {atts.map(att => (
                          <Box key={att.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Chip label={att.original_name} size="small" variant="outlined"
                              sx={{ maxWidth: 160, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
                            <Typography variant="caption" color="text.secondary">{invoicesApi.formatFileSize(att.file_size)}</Typography>
                            <Tooltip title="预览">
                              <IconButton size="small" href={invoicesApi.getInvoiceAttachmentPreviewUrl(att.id, att.access_token)} target="_blank">
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="下载">
                              <IconButton size="small" href={invoicesApi.getInvoiceAttachmentDownloadUrl(att.id, att.access_token)} target="_blank">
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
                            onChange={(e) => e.target.files && handleUpload(inv.id, e.target.files)} />
                          <Button size="small" variant="text" component="span" startIcon={<CloudUploadIcon />}
                            disabled={uploadingId === inv.id}>上传附件</Button>
                        </label>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => { setEditTarget(inv); setFormOpen(true); }}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(inv)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <InvoiceForm open={formOpen} onClose={() => { setFormOpen(false); setEditTarget(null); }}
        onSubmit={editTarget ? handleUpdate : handleAdd} initialData={editTarget} loading={actionLoading} />
      <ConfirmDialog open={!!deleteTarget} title="确认删除" content="确定删除该开票记录？"
        onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} danger />
      <ConfirmDialog open={!!deleteAttachTarget} title="确认删除" content={`确定删除附件 "${deleteAttachTarget?.original_name}"？`}
        onConfirm={handleDeleteAttachment} onCancel={() => setDeleteAttachTarget(null)} danger />
    </Paper>
  );
}

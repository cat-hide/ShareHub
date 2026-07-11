import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Paper, Grid, Button, Alert, Snackbar,
  LinearProgress, Divider,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
import DeleteIcon from '@mui/icons-material/Delete';
import PreviewIcon from '@mui/icons-material/Preview';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import StatusChip from '../components/StatusChip';
import InvoiceSection from '../components/InvoiceSection';
import PaymentSection from '../components/PaymentSection';
import ShippingSection from '../components/ShippingSection';
import MaterialSection from '../components/MaterialSection';
import LoadingOverlay from '../components/LoadingOverlay';
import * as contractsApi from '../api/contracts';
import * as paymentsApi from '../api/payments';
import * as shipmentsApi from '../api/shipments';
import { useInvoices } from '../hooks/useInvoices';
import type { ContractDetail, Payment, Shipment, ContractMaterial, ContractAttachment } from '../types';

function formatAmount(a: number) { return a.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatDate(d: string) { if (!d) return ''; const dt = new Date(d); return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`; }

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const contractId = parseInt(id || '0', 10);

  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [materials, setMaterials] = useState<ContractMaterial[]>([]);
  const [uploading, setUploading] = useState(false);

  const { invoices, fetchInvoices, addInvoice, updateInvoice, removeInvoice } = useInvoices();
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async () => {
    if (isNaN(contractId)) { setError('无效的合同ID'); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const [cRes, pRes, sRes, mRes] = await Promise.all([
        contractsApi.getContract(contractId),
        paymentsApi.getPayments(contractId),
        shipmentsApi.getShipments(contractId),
        contractsApi.getMaterials(contractId),
      ]);
      if (cRes.code === 0) {
        setContract(cRes.data);
        setPayments(pRes.code === 0 ? pRes.data : []);
        setShipments(sRes.code === 0 ? sRes.data : []);
        setMaterials(mRes.code === 0 ? mRes.data : []);
        await fetchInvoices(contractId);
      } else { setError(cRes.message); }
    } catch (err) { setError(err instanceof Error ? err.message : '加载失败'); }
    finally { setLoading(false); }
  }, [contractId, fetchInvoices]);

  useEffect(() => { loadData(); }, [loadData]);

  const refreshPayments = useCallback(async () => {
    const pRes = await paymentsApi.getPayments(contractId);
    if (pRes.code === 0) setPayments(pRes.data);
  }, [contractId]);

  const refreshShipments = useCallback(async () => {
    const sRes = await shipmentsApi.getShipments(contractId);
    if (sRes.code === 0) setShipments(sRes.data);
    // Also refresh contract detail to update progress
    const cRes = await contractsApi.getContract(contractId);
    if (cRes.code === 0) setContract(cRes.data);
  }, [contractId]);

  const refreshMaterials = useCallback(async () => {
    const mRes = await contractsApi.getMaterials(contractId);
    if (mRes.code === 0) setMaterials(mRes.data);
    // Also refresh contract detail to update progress
    const cRes = await contractsApi.getContract(contractId);
    if (cRes.code === 0) setContract(cRes.data);
  }, [contractId]);

  const handleFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const res = await contractsApi.uploadAttachments(contractId, Array.from(files));
      if (res.code === 0) {
        setSnackbar({ open: true, message: `成功上传 ${res.data.length} 个附件`, severity: 'success' });
        await loadData();
      } else {
        setSnackbar({ open: true, message: res.message, severity: 'error' });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: '上传失败: ' + (err instanceof Error ? err.message : '未知错误'),
        severity: 'error',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    if (!window.confirm('确定要删除该附件吗？')) return;

    try {
      const res = await contractsApi.deleteAttachment(attachmentId);
      if (res.code === 0) {
        setSnackbar({ open: true, message: '删除成功', severity: 'success' });
        await loadData();
      } else {
        setSnackbar({ open: true, message: res.message, severity: 'error' });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: '删除失败: ' + (err instanceof Error ? err.message : '未知错误'),
        severity: 'error',
      });
    }
  };

  const attachments: ContractAttachment[] = contract?.attachments || [];

  if (loading) return <LoadingOverlay open message="加载合同详情..." />;
  if (error || !contract) return (
    <Box>
      <Alert severity="error" sx={{ mb: 2 }}>{error || '合同不存在'}</Alert>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/contracts')}>返回合同列表</Button>
    </Box>
  );

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/contracts')}>返回</Button>
        <Typography variant="h5" fontWeight={600} sx={{ flex: 1 }}>合同详情</Typography>
        <Button variant="contained" startIcon={<EditIcon />} onClick={() => navigate(`/contracts/${contractId}/edit`)}>编辑合同</Button>
      </Box>

      {/* Contract Info */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">签约日期</Typography>
            <Typography variant="body1">{formatDate(contract.signed_date)}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">合同状态</Typography>
            <Box sx={{ mt: 0.5 }}><StatusChip status={contract.status} type="contract" /></Box>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">合同编号</Typography>
            <Typography variant="body1" fontWeight={500}>{contract.contract_no}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">项目号</Typography>
            <Typography variant="body1">{contract.project_no || '-'}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">签约方</Typography>
            <Typography variant="body1">{contract.party}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">合同标的</Typography>
            <Typography variant="body1" fontWeight={500}>{contract.contract_name}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">合同金额</Typography>
            <Typography variant="body1" fontWeight={500}>{formatAmount(contract.amount)} 元</Typography>
          </Grid>
          {contract.salesperson_name && (
            <Grid item xs={12} sm={6}>
              <Typography variant="caption" color="text.secondary">业务员</Typography>
              <Typography variant="body1">{contract.salesperson_name}</Typography>
            </Grid>
          )}
        </Grid>

        {/* ===== Multi-Attachment Display ===== */}
        {attachments.length > 0 ? (
          <Box sx={{ mt: 2 }}>
            {attachments.map((att) => (
              <Box
                key={att.id}
                sx={{
                  mt: 1, p: 2, border: '1px solid', borderColor: 'divider',
                  borderRadius: 2, bgcolor: 'grey.50',
                  display: 'flex', alignItems: 'center', gap: 1,
                }}
              >
                <AttachFileIcon fontSize="small" color="primary" />
                <Typography variant="body2" sx={{ flex: 1, fontWeight: 500 }}>
                  {att.original_name} ({contractsApi.formatFileSize(att.file_size)})
                </Typography>
                <Button
                  size="small" variant="outlined" startIcon={<PreviewIcon />}
                  onClick={() => window.open(contractsApi.getAttachmentPreviewUrl(att.id, att.access_token), '_blank')}
                  disabled={uploading}
                >
                  预览
                </Button>
                <Button
                  size="small" variant="outlined" startIcon={<DownloadIcon />}
                  onClick={() => window.open(contractsApi.getAttachmentDownloadUrl(att.id, att.access_token), '_blank')}
                  disabled={uploading}
                >
                  下载
                </Button>
                <Button
                  size="small" variant="outlined" color="error" startIcon={<DeleteIcon />}
                  onClick={() => handleDeleteAttachment(att.id)}
                  disabled={uploading}
                >
                  删除
                </Button>
              </Box>
            ))}
          </Box>
        ) : (
          <Box sx={{ mt: 2, p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">暂无附件</Typography>
          </Box>
        )}

        {/* Upload new files */}
        <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant="contained" component="label" startIcon={<UploadIcon />}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? '上传中...' : '上传合同附件'}
          </Button>
          <Typography variant="caption" color="text.secondary">
            支持 PDF、JPG、PNG、GIF、WEBP、BMP 格式，最大 50MB，可多选
          </Typography>
        </Box>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp,application/pdf,image/jpeg,image/png,image/gif,image/webp,image/bmp"
          onChange={handleFilesChange}
        />

        <Divider sx={{ my: 2 }} />

        {/* Progress Section */}
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom>发货进度</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <LinearProgress variant="determinate" value={contract.ship_progress || 0}
                  color={contract.ship_progress >= 100 ? 'success' : 'info'} sx={{ height: 10, borderRadius: 5 }} />
              </Box>
              <Typography variant="body2" fontWeight={600}>{contract.ship_progress || 0}%</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom>开票进度</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <LinearProgress variant="determinate" value={contract.invoice_progress || 0}
                  color={contract.invoice_progress >= 100 ? 'success' : 'secondary'} sx={{ height: 10, borderRadius: 5 }} />
              </Box>
              <Typography variant="body2" fontWeight={600}>{contract.invoice_progress || 0}%</Typography>
            </Box>
          </Grid>
          <Grid item xs={12} md={4}>
            <Typography variant="subtitle2" gutterBottom>回款进度</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ flex: 1 }}>
                <LinearProgress variant="determinate" value={contract.payment_progress}
                  color={contract.payment_progress >= 100 ? 'success' : 'primary'} sx={{ height: 10, borderRadius: 5 }} />
              </Box>
              <Typography variant="body2" fontWeight={600}>{contract.payment_progress}%</Typography>
            </Box>
          </Grid>
        </Grid>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary">合同金额</Typography>
            <Typography variant="body2">{formatAmount(contract.amount)} 元</Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary">已开票金额</Typography>
            <Typography variant="body2">{formatAmount(contract.invoiced_amount)} 元</Typography>
          </Grid>
          <Grid item xs={4}>
            <Typography variant="caption" color="text.secondary">已回款金额</Typography>
            <Typography variant="body2" color={contract.paid_amount >= contract.amount ? 'success.main' : 'text.primary'}>
              {formatAmount(contract.paid_amount)} 元
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* 物料明细 */}
      <MaterialSection materials={materials} contractId={contractId} onRefresh={refreshMaterials} />

      {/* 发货记录 */}
      <ShippingSection shipments={shipments} contractId={contractId} onRefresh={refreshShipments} />

      {/* 开票记录 */}
      <InvoiceSection
        invoices={invoices}
        onAddInvoice={addInvoice}
        onUpdateInvoice={updateInvoice}
        onDeleteInvoice={removeInvoice}
        contractId={contractId}
      />

      {/* 收款记录（独立） */}
      <PaymentSection payments={payments} contractId={contractId} onRefresh={refreshPayments} />

      <Snackbar open={snackbar.open} autoHideDuration={3000} onClose={() => setSnackbar(p => ({ ...p, open: false }))}>
        <Alert severity={snackbar.severity} variant="filled">{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Grid,
  Typography,
  Chip,
  Alert,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import PreviewIcon from '@mui/icons-material/Preview';
import type { ContractCreatePayload, Contract, ContractAttachment } from '../types';
import {
  uploadAttachments,
  deleteAttachment,
  formatFileSize,
  getAttachmentDownloadUrl,
  getAttachmentPreviewUrl,
  getAttachments,
} from '../api/contracts';

interface ContractFormProps {
  initialData?: Contract | null;
  onSubmit: (data: ContractCreatePayload) => Promise<boolean>;
  loading?: boolean;
  contractId?: number;
}

/**
 * 合同表单组件（新增/编辑共用）
 */
export default function ContractForm({ initialData, onSubmit, loading, contractId }: ContractFormProps) {
  const [contractNo, setContractNo] = useState('');
  const [projectNo, setProjectNo] = useState('');
  const [projectName, setProjectName] = useState('');
  const [contractName, setContractName] = useState('');
  const [party, setParty] = useState('');
  const [amount, setAmount] = useState('');
  const [signedDate, setSignedDate] = useState('');
  const [status, setStatus] = useState('进行中');
  const [salespersonId, setSalespersonId] = useState<number | ''>('');
  const [salespersonName, setSalespersonName] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [attachments, setAttachments] = useState<ContractAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      setContractNo(initialData.contract_no);
      setProjectNo(initialData.project_no || '');
      setProjectName((initialData as any).project_name || '');
      setContractName(initialData.contract_name);
      setParty(initialData.party);
      setAmount(String(initialData.amount));
      setSignedDate(initialData.signed_date);
      setStatus(initialData.status);
      setSalespersonId((initialData as any).salesperson_id || '');
      setSalespersonName((initialData as any).salesperson_name || '');
    } else {
      setContractNo('');
      setProjectNo('');
      setProjectName('');
      setContractName('');
      setParty('');
      setAmount('');
      setSignedDate('');
      setStatus('进行中');
      setSalespersonId('');
      setSalespersonName('');
      setAttachments([]);
      setSelectedFiles([]);
    }
  }, [initialData]);

  // Load existing attachments when editing
  useEffect(() => {
    if (contractId && initialData) {
      getAttachments(contractId).then(res => {
        if (res.code === 0) {
          setAttachments(res.data);
        }
      }).catch(() => {
        // fail silently
      });
    } else {
      setAttachments([]);
    }
  }, [contractId, initialData]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!contractNo.trim()) {
      newErrors.contractNo = '请输入合同编号';
    }
    if (!contractName.trim()) {
      newErrors.contractName = '请输入合同名称';
    }
    if (!party.trim()) {
      newErrors.party = '请输入签约方';
    }
    if (!amount || parseFloat(amount) <= 0) {
      newErrors.amount = '请输入有效的合同金额';
    }
    if (!signedDate) {
      newErrors.signedDate = '请选择签约日期';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const data: ContractCreatePayload = {
      contract_no: contractNo.trim(),
      project_no: projectNo.trim() || undefined,
      project_name: projectName.trim() || undefined,
      contract_name: contractName.trim(),
      party: party.trim(),
      amount: parseFloat(amount),
      signed_date: signedDate,
      status,
      salesperson_id: salespersonId || undefined,
      salesperson_name: salespersonName.trim() || undefined,
    };

    const success = await onSubmit(data);

    // Auto-upload selected files after contract save (for new or existing contracts)
    if (success && selectedFiles.length > 0 && contractId) {
      setUploading(true);
      try {
        const res = await uploadAttachments(contractId, selectedFiles);
        if (res.code === 0) {
          setUploadMsg({ type: 'success', text: `成功上传 ${res.data.length} 个附件` });
          setSelectedFiles([]);
          // Reload attachments
          const attRes = await getAttachments(contractId);
          if (attRes.code === 0) {
            setAttachments(attRes.data);
          }
        } else {
          setUploadMsg({ type: 'error', text: res.message });
        }
      } catch (err) {
        setUploadMsg({ type: 'error', text: err instanceof Error ? err.message : '附件上传失败' });
      } finally {
        setUploading(false);
      }
    }
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFiles(Array.from(e.target.files));
      // Reset input so re-selecting the same files works
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUploadSelected = async () => {
    if (!contractId || selectedFiles.length === 0) return;
    setUploading(true);
    try {
      const res = await uploadAttachments(contractId, selectedFiles);
      if (res.code === 0) {
        setUploadMsg({ type: 'success', text: `成功上传 ${res.data.length} 个附件` });
        setSelectedFiles([]);
        const attRes = await getAttachments(contractId);
        if (attRes.code === 0) {
          setAttachments(attRes.data);
        }
      } else {
        setUploadMsg({ type: 'error', text: res.message });
      }
    } catch (err) {
      setUploadMsg({ type: 'error', text: err instanceof Error ? err.message : '附件上传失败' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    setUploading(true);
    try {
      const res = await deleteAttachment(attachmentId);
      if (res.code === 0) {
        setAttachments(prev => prev.filter(a => a.id !== attachmentId));
        setUploadMsg({ type: 'success', text: '附件已删除' });
      } else {
        setUploadMsg({ type: 'error', text: res.message });
      }
    } catch (err) {
      setUploadMsg({ type: 'error', text: err instanceof Error ? err.message : '删除附件失败' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            required
            label="签约日期"
            type="date"
            value={signedDate}
            onChange={(e) => setSignedDate(e.target.value)}
            error={!!errors.signedDate}
            helperText={errors.signedDate}
            disabled={loading}
            InputLabelProps={{ shrink: true }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            required
            label="合同编号"
            value={contractNo}
            onChange={(e) => setContractNo(e.target.value)}
            error={!!errors.contractNo}
            helperText={errors.contractNo}
            disabled={loading}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="项目号"
            value={projectNo}
            onChange={(e) => setProjectNo(e.target.value)}
            disabled={loading}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="项目名称"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            disabled={loading}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            required
            label="签约方"
            value={party}
            onChange={(e) => setParty(e.target.value)}
            error={!!errors.party}
            helperText={errors.party}
            disabled={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            required
            label="合同标的"
            value={contractName}
            onChange={(e) => setContractName(e.target.value)}
            error={!!errors.contractName}
            helperText={errors.contractName}
            disabled={loading}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            required
            label="合同金额"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            error={!!errors.amount}
            helperText={errors.amount}
            disabled={loading}
            inputProps={{ min: 0, step: 0.01 }}
          />
        </Grid>
        <Grid item xs={12} sm={4}>
          <FormControl fullWidth>
            <InputLabel>合同状态</InputLabel>
            <Select
              value={status}
              label="合同状态"
              onChange={(e) => setStatus(e.target.value)}
              disabled={loading}
            >
              <MenuItem value="进行中">进行中</MenuItem>
              <MenuItem value="已完成">已完成</MenuItem>
              <MenuItem value="已终止">已终止</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={12} sm={4}>
          <TextField
            fullWidth
            label="业务员"
            value={salespersonName}
            onChange={(e) => setSalespersonName(e.target.value)}
            disabled={loading}
          />
        </Grid>
      </Grid>

      {/* ===== 附件上传区域（仅编辑模式显示） ===== */}
      {initialData && (
        <Box sx={{ mt: 3, p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>合同附件</Typography>

          {/* Existing attachment list */}
          {attachments.length > 0 && (
            <List dense sx={{ mb: 1 }}>
              {attachments.map((att) => (
                <ListItem
                  key={att.id}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 0.5,
                    bgcolor: 'grey.50',
                  }}
                >
                  <ListItemText
                    primary={att.original_name}
                    secondary={formatFileSize(att.file_size)}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      size="small"
                      title="预览"
                      onClick={() => window.open(getAttachmentPreviewUrl(att.id, att.access_token), '_blank')}
                    >
                      <PreviewIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      title="下载"
                      onClick={() => window.open(getAttachmentDownloadUrl(att.id, att.access_token), '_blank')}
                    >
                      <DownloadIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      title="删除"
                      onClick={() => handleDeleteAttachment(att.id)}
                      disabled={uploading}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}

          {/* File selection and upload */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.bmp"
              style={{ display: 'none' }}
              onChange={handleFilesChange}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<CloudUploadIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {selectedFiles.length > 0
                ? `已选择 ${selectedFiles.length} 个文件`
                : '选择文件'}
            </Button>
            {selectedFiles.length > 0 && contractId && (
              <Button
                size="small"
                variant="contained"
                onClick={handleUploadSelected}
                disabled={uploading}
              >
                上传
              </Button>
            )}
          </Box>

          {/* Selected files preview */}
          {selectedFiles.length > 0 && (
            <Box sx={{ mt: 1 }}>
              {selectedFiles.map((file, idx) => (
                <Chip
                  key={idx}
                  label={`${file.name} (${formatFileSize(file.size)})`}
                  size="small"
                  sx={{ mr: 0.5, mb: 0.5 }}
                  onDelete={() => setSelectedFiles(prev => prev.filter((_, i) => i !== idx))}
                />
              ))}
            </Box>
          )}

          {uploadMsg && (
            <Alert severity={uploadMsg.type} sx={{ mt: 1 }} onClose={() => setUploadMsg(null)}>
              {uploadMsg.text}
            </Alert>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            支持 PDF、JPG、PNG、GIF、WEBP、BMP 格式，最大 50MB，可多选文件
          </Typography>
        </Box>
      )}

      <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
        <Button type="submit" variant="contained" disabled={loading}>
          {loading ? '保存中...' : initialData ? '更新合同' : '创建合同'}
        </Button>
      </Box>
    </Box>
  );
}

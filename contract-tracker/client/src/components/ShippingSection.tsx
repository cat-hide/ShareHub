import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Chip, MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';
import type { Shipment, ShipmentAttachment, ContractMaterial } from '../types';
import * as shipmentsApi from '../api/shipments';
import ConfirmDialog from './ConfirmDialog';

function formatDate(d: string) {
  if (!d) return '';
  const dt = new Date(d);
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
}

interface Props {
  shipments: Shipment[];
  contractId: number;
  onRefresh: () => void;
  loading?: boolean;
  materials: ContractMaterial[];
}

export default function ShippingSection({ shipments, contractId, onRefresh, loading, materials }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Shipment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shipment | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formMaterialId, setFormMaterialId] = useState<number | ''>('');
  const [formShippedQty, setFormShippedQty] = useState<number>(0);
  const [formMaterialCode, setFormMaterialCode] = useState('');
  const [formMaterialName, setFormMaterialName] = useState('');
  const [formSpecification, setFormSpecification] = useState('');
  const [formUnit, setFormUnit] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [deleteAttachTarget, setDeleteAttachTarget] = useState<ShipmentAttachment | null>(null);
  const [attachmentsMap, setAttachmentsMap] = useState<Record<number, ShipmentAttachment[]>>({});

  const fetchAttachments = useCallback(async (shipmentId: number) => {
    try {
      const { data } = await shipmentsApi.getShipmentAttachments(shipmentId);
      setAttachmentsMap(prev => ({ ...prev, [shipmentId]: data }));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    shipments.forEach(s => {
      if (!(s.id in attachmentsMap)) {
        fetchAttachments(s.id);
      }
    });
  }, [shipments, fetchAttachments, attachmentsMap]);

  const resetForm = () => {
    setFormDate('');
    setFormDesc('');
    setFormMaterialId('');
    setFormShippedQty(0);
    setFormMaterialCode('');
    setFormMaterialName('');
    setFormSpecification('');
    setFormUnit('');
  };

  const openAdd = () => {
    setEditTarget(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (s: Shipment) => {
    setEditTarget(s);
    setFormDate(s.shipment_date);
    setFormDesc(s.description || '');
    setFormMaterialId(s.material_id || '');
    setFormShippedQty(s.shipped_quantity || 0);
    setFormMaterialCode(s.material_code || '');
    setFormMaterialName(s.material_name || '');
    setFormSpecification(s.specification || '');
    setFormUnit(s.unit || '');
    setDialogOpen(true);
  };

  /** When user selects a material from dropdown, auto-fill the fields */
  const handleMaterialSelect = (matId: number) => {
    setFormMaterialId(matId);
    const mat = materials.find(m => m.id === matId);
    if (mat) {
      setFormMaterialCode(mat.material_code || '');
      setFormMaterialName(mat.material_name);
      setFormSpecification(mat.specification || '');
      setFormUnit(mat.unit || '');
    }
  };

  const handleSave = async () => {
    if (!formDate) return;
    setFormLoading(true);
    try {
      const payload = {
        shipment_date: formDate,
        description: formDesc || undefined,
        material_id: formMaterialId || null,
        shipped_quantity: formShippedQty,
        material_code: formMaterialCode || undefined,
        material_name: formMaterialName || undefined,
        specification: formSpecification || undefined,
        unit: formUnit || undefined,
      };
      let ok: boolean;
      if (editTarget) {
        const res = await shipmentsApi.updateShipment(editTarget.id, payload);
        ok = res.code === 0;
      } else {
        const res = await shipmentsApi.createShipment(contractId, payload);
        ok = res.code === 0;
      }
      if (ok) { setDialogOpen(false); onRefresh(); }
    } finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await shipmentsApi.deleteShipment(deleteTarget.id);
    if (res.code === 0) { setDeleteTarget(null); onRefresh(); }
  };

  const handleUpload = async (id: number, files: FileList) => {
    setUploadingId(id);
    try {
      await shipmentsApi.uploadShipmentAttachments(id, Array.from(files));
      await fetchAttachments(id);
      onRefresh();
    } finally { setUploadingId(null); }
  };

  const handleDeleteAttachment = async () => {
    if (!deleteAttachTarget) return;
    try {
      await shipmentsApi.deleteShipmentAttachment(deleteAttachTarget.id);
      for (const [shipId, atts] of Object.entries(attachmentsMap)) {
        if (atts.some(a => a.id === deleteAttachTarget.id)) {
          await fetchAttachments(parseInt(shipId));
          break;
        }
      }
    } finally { setDeleteAttachTarget(null); }
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>发货记录</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openAdd}>新增发货</Button>
      </Box>

      {shipments.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>暂无发货记录</Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>发货日期</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>物料编码</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>物料名称</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>规格型号</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>单位</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">发货数量</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>发货说明</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>发货单</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shipments.map(s => {
                const atts = attachmentsMap[s.id] || [];
                return (
                  <TableRow key={s.id} hover>
                    <TableCell>{formatDate(s.shipment_date)}</TableCell>
                    <TableCell>{s.material_code || '-'}</TableCell>
                    <TableCell>{s.material_name || '-'}</TableCell>
                    <TableCell>{s.specification || '-'}</TableCell>
                    <TableCell>{s.unit || '-'}</TableCell>
                    <TableCell align="right">{s.shipped_quantity || 0}</TableCell>
                    <TableCell>{s.description || '-'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {atts.map(att => (
                          <Box key={att.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Chip label={att.original_name} size="small" variant="outlined"
                              sx={{ maxWidth: 160, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }} />
                            <Typography variant="caption" color="text.secondary">{shipmentsApi.formatFileSize(att.file_size)}</Typography>
                            <Tooltip title="预览">
                              <IconButton size="small" href={shipmentsApi.getShipmentAttachmentPreviewUrl(att.id, att.access_token)} target="_blank">
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="下载">
                              <IconButton size="small" href={shipmentsApi.getShipmentAttachmentDownloadUrl(att.id, att.access_token)} target="_blank">
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
                            onChange={(e) => e.target.files && handleUpload(s.id, e.target.files)} />
                          <Button size="small" variant="text" component="span" startIcon={<CloudUploadIcon />}
                            disabled={uploadingId === s.id}>上传</Button>
                        </label>
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton size="small" onClick={() => openEdit(s)}><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(s)}><DeleteIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editTarget ? '编辑发货记录' : '新增发货记录'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              select
              label="选择物料"
              fullWidth
              value={formMaterialId}
              onChange={e => handleMaterialSelect(Number(e.target.value))}
            >
              <MenuItem value=""><em>不关联物料</em></MenuItem>
              {materials.map(mat => (
                <MenuItem key={mat.id} value={mat.id}>
                  {mat.material_name}{mat.specification ? ` (${mat.specification})` : ''}
                </MenuItem>
              ))}
            </TextField>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField label="物料编码" fullWidth value={formMaterialCode}
                onChange={e => setFormMaterialCode(e.target.value)}
                InputLabelProps={{ shrink: true }} />
              <TextField label="物料名称" fullWidth value={formMaterialName}
                onChange={e => setFormMaterialName(e.target.value)}
                InputLabelProps={{ shrink: true }} />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField label="规格型号" fullWidth value={formSpecification}
                onChange={e => setFormSpecification(e.target.value)}
                InputLabelProps={{ shrink: true }} />
              <TextField label="单位" fullWidth value={formUnit}
                onChange={e => setFormUnit(e.target.value)}
                InputLabelProps={{ shrink: true }} />
            </Box>
            <TextField label="发货数量" type="number" fullWidth value={formShippedQty || ''}
              onChange={e => setFormShippedQty(parseFloat(e.target.value) || 0)}
              inputProps={{ min: 0, step: 'any' }} />
            <TextField label="发货日期" type="date" fullWidth required value={formDate}
              onChange={e => setFormDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField label="发货说明" fullWidth multiline rows={2} value={formDesc}
              onChange={e => setFormDesc(e.target.value)} placeholder="如：第一批设备发货 - 服务器10台" />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button onClick={handleSave} variant="contained" disabled={formLoading || !formDate}>
            {formLoading ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="确认删除" content="确定删除该发货记录？关联的发货单附件也将被删除。"
        confirmText="删除" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} danger />
      <ConfirmDialog open={!!deleteAttachTarget} title="确认删除" content={`确定删除附件 "${deleteAttachTarget?.original_name}"？`}
        onConfirm={handleDeleteAttachment} onCancel={() => setDeleteAttachTarget(null)} danger />
    </Paper>
  );
}

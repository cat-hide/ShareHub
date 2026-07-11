import React, { useState } from 'react';
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { ContractMaterial, MaterialCreatePayload } from '../types';
import * as contractsApi from '../api/contracts';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  materials: ContractMaterial[];
  contractId: number;
  onRefresh: () => void;
}

function formatAmount(a: number): string {
  return a.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 从价税合计反推：不含税小计=合计/(1+税率)，税额=合计-小计，单价=小计/数量 */
function calcFromTotal(qty: number, total: number, rate: number) {
  const subtotal = qty > 0 ? Math.round(total / (1 + rate) * 100) / 100 : 0;
  const taxAmount = Math.round((total - subtotal) * 100) / 100;
  const unitPrice = qty > 0 ? Math.round(subtotal / qty * 100) / 100 : 0;
  return { subtotal, taxAmount, unitPrice };
}

const EMPTY_FORM: MaterialCreatePayload = {
  material_name: '',
  material_code: '',
  specification: '',
  unit: '',
  quantity: 0,
  unit_price: 0,
  subtotal: 0,
  tax_rate: 0.13,
  tax_amount: 0,
  total_with_tax: 0,
  remark: '',
};

export default function MaterialSection({ materials, contractId, onRefresh }: Props) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ContractMaterial | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractMaterial | null>(null);
  const [form, setForm] = useState<MaterialCreatePayload>({ ...EMPTY_FORM });
  const [formLoading, setFormLoading] = useState(false);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setDialogOpen(true);
  };

  const openEdit = (m: ContractMaterial) => {
    setEditTarget(m);
    setForm({
      material_name: m.material_name,
      material_code: m.material_code || '',
      specification: m.specification || '',
      unit: m.unit || '',
      quantity: m.quantity,
      unit_price: m.unit_price,
      subtotal: m.subtotal,
      tax_rate: m.tax_rate,
      tax_amount: m.tax_amount,
      total_with_tax: m.total_with_tax,
      remark: m.remark || '',
    });
    setDialogOpen(true);
  };

  /** Recalc computed fields when qty/price/rate change */
  const handleFieldChange = (field: keyof MaterialCreatePayload, value: string) => {
    setForm(prev => {
      const updated = { ...prev };
      if (field === 'total_with_tax' || field === 'tax_rate' || field === 'quantity') {
        const numVal = parseFloat(value) || 0;
        (updated as any)[field] = numVal;
        const qty = field === 'quantity' ? numVal : updated.quantity;
        const total = field === 'total_with_tax' ? numVal : updated.total_with_tax;
        const rate = field === 'tax_rate' ? numVal : updated.tax_rate;
        const { subtotal, taxAmount, unitPrice } = calcFromTotal(qty, total, rate);
        updated.subtotal = subtotal;
        updated.tax_amount = taxAmount;
        updated.unit_price = unitPrice;
      } else {
        (updated as any)[field] = value;
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (!form.material_name.trim()) return;
    setFormLoading(true);
    try {
      let ok = false;
      if (editTarget) {
        const res = await contractsApi.updateMaterial(editTarget.id, form);
        ok = res.code === 0;
      } else {
        const res = await contractsApi.createMaterial(contractId, form);
        ok = res.code === 0;
      }
      if (ok) { setDialogOpen(false); onRefresh(); }
    } finally { setFormLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await contractsApi.deleteMaterial(deleteTarget.id);
    if (res.code === 0) { setDeleteTarget(null); onRefresh(); }
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>物料明细</Typography>
        <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openAdd}>新增物料</Button>
      </Box>

      {materials.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>暂无物料明细</Typography>
      ) : (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 1400 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>物料编码</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>物料名称</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>规格型号</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>单位</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">数量</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">不含税单价</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">不含税小计</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">税率</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">税额</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="right">价税合计</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>备注</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {materials.map(m => (
                <TableRow key={m.id} hover>
                  <TableCell>{m.material_code || '-'}</TableCell>
                  <TableCell>{m.material_name}</TableCell>
                  <TableCell>{m.specification || '-'}</TableCell>
                  <TableCell>{m.unit || '-'}</TableCell>
                  <TableCell align="right">{m.quantity}</TableCell>
                  <TableCell align="right">{formatAmount(m.unit_price)}</TableCell>
                  <TableCell align="right">{formatAmount(m.subtotal)}</TableCell>
                  <TableCell align="right">{(m.tax_rate * 100).toFixed(0)}%</TableCell>
                  <TableCell align="right">{formatAmount(m.tax_amount)}</TableCell>
                  <TableCell align="right">{formatAmount(m.total_with_tax)}</TableCell>
                  <TableCell>{m.remark || '-'}</TableCell>
                  <TableCell align="center">
                    <IconButton size="small" onClick={() => openEdit(m)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => setDeleteTarget(m)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editTarget ? '编辑物料' : '新增物料'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
              <TextField label="物料编码" value={form.material_code}
                onChange={e => handleFieldChange('material_code', e.target.value)} />
              <TextField label="物料名称" required value={form.material_name}
                onChange={e => handleFieldChange('material_name', e.target.value)} />
              <TextField label="规格型号" value={form.specification}
                onChange={e => handleFieldChange('specification', e.target.value)} />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
              <TextField label="单位" value={form.unit}
                onChange={e => handleFieldChange('unit', e.target.value)} />
              <TextField label="数量" type="number" value={form.quantity || ''}
                onChange={e => handleFieldChange('quantity', e.target.value)}
                inputProps={{ min: 0, step: 'any' }} />
              <TextField label="不含税单价" type="number" value={form.unit_price || ''}
                InputProps={{ readOnly: true }} helperText="自动计算" />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
              <TextField label="不含税小计" type="number" value={form.subtotal || ''}
                InputProps={{ readOnly: true }} helperText="自动计算" />
              <TextField label="税率" type="number" value={form.tax_rate || ''}
                onChange={e => handleFieldChange('tax_rate', e.target.value)}
                inputProps={{ min: 0, max: 1, step: 'any' }} helperText="小数形式（0.13 = 13%）" />
              <TextField label="税额" type="number" value={form.tax_amount || ''}
                InputProps={{ readOnly: true }} helperText="自动计算" />
            </Box>
            <TextField label="价税合计" type="number" value={form.total_with_tax || ''}
              onChange={e => handleFieldChange('total_with_tax', e.target.value)}
              inputProps={{ min: 0, step: 'any' }} helperText="输入后自动反推" />
            <TextField label="备注" multiline rows={2} value={form.remark}
              onChange={e => handleFieldChange('remark', e.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button onClick={handleSave} variant="contained" disabled={formLoading || !form.material_name.trim()}>
            {formLoading ? '保存中...' : '保存'}
          </Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!deleteTarget} title="确认删除" content={`确定删除物料 "${deleteTarget?.material_name}"？`}
        confirmText="删除" onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} danger />
    </Paper>
  );
}

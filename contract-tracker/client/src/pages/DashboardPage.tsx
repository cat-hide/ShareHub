import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, CircularProgress,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReceiptIcon from '@mui/icons-material/Receipt';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { fetchDashboardStats } from '../api/dashboard';
import type { DashboardStats } from '../api/dashboard';

const fm = (v: number) => v.toLocaleString('zh-CN', { minimumFractionDigits: 2 });

export default function DashboardPage() {
  const [s, setS] = useState<DashboardStats | null>(null);
  const nav = useNavigate();

  const [err, setErr] = useState('');

  useEffect(() => {
    fetchDashboardStats().then(setS).catch((e: any) => {
      setErr(e?.response?.data?.message || e?.message || '加载失败');
    });
  }, []);

  if (err) return <Box sx={{ textAlign: 'center', pt: 8 }}><Typography color="error">{err}</Typography></Box>;
  if (!s) return <Box sx={{ display: 'flex', justifyContent: 'center', pt: 8 }}><CircularProgress /></Box>;

  const { contracts, invoices, payments, shipments, materials, recentContracts } = s;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>数据看板</Typography>

      {/* 核心指标 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <SC icon={<DescriptionIcon />} color="#1976d2" label="合同总数" v={contracts.total} u="份" />
        <SC icon={<AttachMoneyIcon />} color="#2e7d32" label="合同总金额" v={`¥${fm(contracts.totalAmount)}`} />
        <SC icon={<ReceiptIcon />} color="#ed6c02" label="已开票" v={`¥${fm(invoices.totalAmount)}`} u={`开票率 ${invoices.rate}%`} />
        <SC icon={<AttachMoneyIcon />} color="#9c27b0" label="已回款" v={`¥${fm(payments.totalPaid)}`} u={`回款率 ${payments.rate}%`} />
      </Box>

      {/* 进度 + 状态 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
        {/* 进度条 */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>开票与回款进度</Typography>
            {[
              { label: '开票进度', pct: invoices.rate, sub: `${invoices.total} 张 / ¥${fm(invoices.totalAmount)}`, color: '#1976d2' },
              { label: '回款进度', pct: payments.rate, sub: `¥${fm(payments.totalPaid)} 已收 / ¥${fm(payments.totalPending)} 待收`, color: '#2e7d32' },
            ].map((item) => (
              <Box key={item.label} sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">{item.label}</Typography>
                  <Typography variant="body2" color="text.secondary">{item.pct}%</Typography>
                </Box>
                <Box sx={{ height: 10, borderRadius: 5, bgcolor: '#e0e0e0', overflow: 'hidden' }}>
                  <Box sx={{ width: `${Math.min(item.pct, 100)}%`, height: '100%', bgcolor: item.color, borderRadius: 5, transition: 'width 0.5s' }} />
                </Box>
                <Typography variant="caption" color="text.secondary">{item.sub}</Typography>
              </Box>
            ))}
          </CardContent>
        </Card>

        {/* 状态分布 */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>合同状态分布</Typography>
            {[
              { label: '进行中', v: contracts.ongoing, color: '#1976d2' },
              { label: '已完成', v: contracts.done, color: '#2e7d32' },
              { label: '已终止', v: contracts.stopped, color: '#d32f2f' },
            ].map((item) => {
              const pct = contracts.total > 0 ? Math.round((item.v / contracts.total) * 100) : 0;
              return (
                <Box key={item.label} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="body2">{item.label}</Typography>
                    <Typography variant="body2" fontWeight={600}>{item.v} 份 ({pct}%)</Typography>
                  </Box>
                  <Box sx={{ height: 10, borderRadius: 5, bgcolor: '#e0e0e0', overflow: 'hidden' }}>
                    <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: item.color, borderRadius: 5, transition: 'width 0.5s' }} />
                  </Box>
                </Box>
              );
            })}
          </CardContent>
        </Card>
      </Box>

      {/* 发货 / 物料 */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <MC label="发货记录" v={shipments.total} u="条" color="#0288d1" icon={<LocalShippingIcon />} />
        <MC label="发货总数" v={shipments.totalShipped} u="件" color="#0288d1" icon={<LocalShippingIcon />} />
        <MC label="涉及物料" v={materials.totalItems} u="项" color="#00838f" icon={<ReceiptIcon />} />
        <MC label="物料合同" v={materials.contractCount} u="份" color="#00838f" icon={<DescriptionIcon />} />
      </Box>

      {/* 最近合同 */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>最近更新的合同</Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>合同编号</TableCell><TableCell>合同名称</TableCell><TableCell>签约方</TableCell>
                  <TableCell align="right">金额</TableCell><TableCell>状态</TableCell><TableCell>业务员</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentContracts.map((r) => (
                  <TableRow key={r.id} hover sx={{ cursor: 'pointer' }} onClick={() => nav(`/contracts/${r.id}`)}>
                    <TableCell>{r.contract_no}</TableCell>
                    <TableCell>{r.contract_name}</TableCell>
                    <TableCell>{r.party}</TableCell>
                    <TableCell align="right">¥{fm(r.amount)}</TableCell>
                    <TableCell>
                      <Chip label={r.status} size="small" color={r.status === '已完成' ? 'success' : r.status === '已终止' ? 'error' : 'info'} />
                    </TableCell>
                    <TableCell>{r.salesperson_name || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}

// 统计卡片
function SC({ icon, color, label, v, u }: { icon: React.ReactNode; color: string; label: string; v: string | number; u?: string }) {
  return (
    <Card>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.3 }}>{v}</Typography>
          {u ? <Typography variant="caption" color="text.secondary">{u}</Typography> : null}
        </Box>
      </CardContent>
    </Card>
  );
}

// 迷你卡片
function MC({ label, v, u, color, icon }: { label: string; v: number; u: string; color: string; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent sx={{ textAlign: 'center', py: 2 }}>
        <Box sx={{ color, mb: 0.5 }}>{icon}</Box>
        <Typography variant="h5" fontWeight={700}>{v}</Typography>
        <Typography variant="body2" color="text.secondary">{u}</Typography>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </CardContent>
    </Card>
  );
}

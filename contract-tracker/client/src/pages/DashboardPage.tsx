import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReceiptIcon from '@mui/icons-material/Receipt';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { fetchDashboardStats, type DashboardStats } from '../api/dashboard';
import { useNavigate } from 'react-router-dom';

const formatMoney = (v: number) =>
  v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusColor: Record<string, 'info' | 'success' | 'error'> = {
  '进行中': 'info',
  '已完成': 'success',
  '已终止': 'error',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LinearProgress />;
  if (!stats) return <Typography>加载失败</Typography>;

  const { contracts, invoices, payments, shipments, materials, recentContracts } = stats;

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
        数据看板
      </Typography>

      {/* ---- 第一行：概览卡片 ---- */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <StatCard
          icon={<DescriptionIcon />}
          color="#1976d2"
          label="合同总数"
          value={contracts.total}
          sub="份"
        />
        <StatCard
          icon={<AttachMoneyIcon />}
          color="#2e7d32"
          label="合同总金额"
          value={`¥${formatMoney(contracts.totalAmount)}`}
        />
        <StatCard
          icon={<ReceiptIcon />}
          color="#ed6c02"
          label="已开票金额"
          value={`¥${formatMoney(invoices.totalAmount)}`}
          sub={`开票率 ${invoices.rate}%`}
        />
        <StatCard
          icon={<AttachMoneyIcon />}
          color="#9c27b0"
          label="已回款金额"
          value={`¥${formatMoney(payments.totalPaid)}`}
          sub={`回款率 ${payments.rate}%`}
        />
      </Box>

      {/* ---- 第二行：进度概览 + 状态分布 ---- */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
        {/* 开票 & 回款进度 */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              开票与回款进度
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2">开票进度</Typography>
                <Typography variant="body2" color="text.secondary">{invoices.rate}%</Typography>
              </Box>
              <LinearProgress variant="determinate" value={invoices.rate} sx={{ height: 8, borderRadius: 4 }} />
              <Typography variant="caption" color="text.secondary">
                {invoices.total} 张发票 / ¥{formatMoney(invoices.totalAmount)}
              </Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="body2">回款进度</Typography>
                <Typography variant="body2" color="text.secondary">{payments.rate}%</Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={payments.rate}
                color="success"
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary">
                ¥{formatMoney(payments.totalPaid)} 已收 / ¥{formatMoney(payments.totalPending)} 待收
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* 合同状态分布 */}
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              合同状态分布
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
              {[
                { label: '进行中', value: contracts.ongoing, color: '#1976d2' },
                { label: '已完成', value: contracts.completed, color: '#2e7d32' },
                { label: '已终止', value: contracts.terminated, color: '#d32f2f' },
              ].map((item) => {
                const pct = contracts.total > 0 ? Math.round((item.value / contracts.total) * 100) : 0;
                return (
                  <Box key={item.label}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2">{item.label}</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {item.value} 份 ({pct}%)
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ flex: 1, height: 10, borderRadius: 5, bgcolor: '#e0e0e0', overflow: 'hidden' }}>
                        <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: item.color, borderRadius: 5, transition: 'width 0.5s' }} />
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </CardContent>
        </Card>
      </Box>

      {/* ---- 第三行：其他统计 ---- */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        <MiniCard label="发货记录" value={shipments.total} unit="条" color="#0288d1" icon={<LocalShippingIcon />} />
        <MiniCard label="发货总数" value={shipments.totalShipped} unit="件" color="#0288d1" icon={<LocalShippingIcon />} />
        <MiniCard label="涉及物料" value={materials.totalItems} unit="项" color="#00838f" icon={<ReceiptIcon />} />
        <MiniCard label="物料合同" value={materials.contractCount} unit="份" color="#00838f" icon={<DescriptionIcon />} />
      </Box>

      {/* ---- 最近合同 ---- */}
      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            最近更新的合同
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>合同编号</TableCell>
                  <TableCell>合同名称</TableCell>
                  <TableCell>签约方</TableCell>
                  <TableCell align="right">金额</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>业务员</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentContracts.map((rc) => (
                  <TableRow
                    key={rc.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/contracts/${rc.id}`)}
                  >
                    <TableCell>{rc.contract_no}</TableCell>
                    <TableCell>{rc.contract_name}</TableCell>
                    <TableCell>{rc.party}</TableCell>
                    <TableCell align="right">¥{formatMoney(rc.amount)}</TableCell>
                    <TableCell>
                      <Chip label={rc.status} size="small" color={statusColor[rc.status] || 'default'} />
                    </TableCell>
                    <TableCell>{rc.salesperson_name || '-'}</TableCell>
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

// ---- 小卡片组件 ----
function StatCard({ icon, color, label, value, sub }: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          {icon}
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.3 }}>{value}</Typography>
          {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
        </Box>
      </CardContent>
    </Card>
  );
}

function MiniCard({ label, value, unit, color, icon }: {
  label: string;
  value: number;
  unit: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent sx={{ textAlign: 'center', py: 2 }}>
        <Box sx={{ color, mb: 0.5 }}>{icon}</Box>
        <Typography variant="h5" fontWeight={700}>{value}</Typography>
        <Typography variant="body2" color="text.secondary">{unit}</Typography>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </CardContent>
    </Card>
  );
}

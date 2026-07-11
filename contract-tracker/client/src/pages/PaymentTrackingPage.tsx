import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, ToggleButtonGroup, ToggleButton, TextField,
  InputAdornment, TableSortLabel,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import client from '../api/client';

interface TrackingItem {
  id: number; contract_id: number; payment_date: string; amount: number; status: string;
  contract_no: string; contract_name: string; party: string; contract_amount: number;
}

// ===== 列定义 =====
const COLUMNS = [
  { id: 'payment_date', label: '收款日期', initialWidth: 120 },
  { id: 'contract_no', label: '合同编号', initialWidth: 140 },
  { id: 'contract_name', label: '合同名称', initialWidth: 200 },
  { id: 'party', label: '签约方', initialWidth: 150 },
  { id: 'contract_amount', label: '合同金额', align: 'right' as const, initialWidth: 120 },
  { id: 'amount', label: '收款金额', align: 'right' as const, initialWidth: 120 },
  { id: 'status', label: '状态', initialWidth: 80 },
];

const SORTABLE = new Set(COLUMNS.map(c => c.id));
const MIN_COL_WIDTH = 50;
const WIDTH_STORAGE_KEY = 'payment_tracking_col_widths';

function getSavedWidths(): Record<string, number> {
  try {
    const s = localStorage.getItem(WIDTH_STORAGE_KEY);
    return s ? JSON.parse(s) : {};
  } catch { return {}; }
}

function saveWidths(w: Record<string, number>) {
  localStorage.setItem(WIDTH_STORAGE_KEY, JSON.stringify(w));
}

/** 可拖拽调整列宽 + 排序的表头单元格 */
function HeaderCell({ col, width, onResize, sortBy, sortOrder, onSort }: {
  col: typeof COLUMNS[number];
  width: number;
  onResize: (colId: string, newWidth: number) => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (colId: string) => void;
}) {
  const startXRef = useRef(0);
  const startWRef = useRef(width);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWRef.current = width;
    const onMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startXRef.current;
      onResize(col.id, Math.max(MIN_COL_WIDTH, startWRef.current + diff));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [col.id, width, onResize]);

  const active = sortBy === col.id;
  const direction = active ? sortOrder : 'asc';

  return (
    <TableCell
      sx={{
        fontWeight: 600, width, maxWidth: width, minWidth: width,
        position: 'relative', overflow: 'visible', userSelect: 'none',
        cursor: 'pointer', textAlign: col.align || 'left',
      }}
      onClick={() => onSort(col.id)}
    >
      <TableSortLabel active={active} direction={direction}>
        {col.label}
      </TableSortLabel>
      <Box
        onMouseDown={onMouseDown}
        sx={{
          position: 'absolute', top: 0, right: -4, width: 8, height: '100%',
          cursor: 'col-resize', zIndex: 10,
          '&:hover': { backgroundColor: 'rgba(0,0,0,0.08)' },
        }}
      />
    </TableCell>
  );
}

export default function PaymentTrackingPage() {
  const [items, setItems] = useState<TrackingItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState('payment_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const [colWidths, setColWidths] = useState<Record<string, number>>(getSavedWidths);
  const getW = (col: typeof COLUMNS[number]) => colWidths[col.id] || col.initialWidth;
  const handleResize = useCallback((colId: string, newWidth: number) => {
    setColWidths(prev => { const n = { ...prev, [colId]: newWidth }; saveWidths(n); return n; });
  }, []);

  const fetchData = useCallback(async () => {
    const params: Record<string, string> = { sortBy, sortOrder };
    if (statusFilter !== 'all') params.status = statusFilter;
    if (keyword.trim()) params.keyword = keyword.trim();
    const r = await client.get('/payments/tracking', { params });
    setItems(r.data.data);
  }, [statusFilter, keyword, sortBy, sortOrder]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSort = (colId: string) => {
    setSortBy(colId);
    setSortOrder(prev => (sortBy === colId && prev === 'asc' ? 'desc' : 'asc'));
  };

  const received = items.filter(i => i.status === '已收款');
  const unreceived = items.filter(i => i.status === '未收款');
  const totalReceived = received.reduce((s, i) => s + i.amount, 0);
  const totalUnreceived = unreceived.reduce((s, i) => s + i.amount, 0);

  const renderCell = (col: typeof COLUMNS[number], item: TrackingItem) => {
    const sx = {
      width: getW(col), maxWidth: getW(col), minWidth: getW(col),
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
      textAlign: col.align || ('left' as const),
    };
    switch (col.id) {
      case 'payment_date': return <TableCell sx={sx}>{item.payment_date}</TableCell>;
      case 'contract_no':
        return <TableCell sx={sx}><Chip size="small" label={item.contract_no} component="a" href={`/contracts/${item.contract_id}`} clickable /></TableCell>;
      case 'contract_name': return <TableCell sx={sx}>{item.contract_name}</TableCell>;
      case 'party': return <TableCell sx={sx}>{item.party}</TableCell>;
      case 'contract_amount': return <TableCell sx={sx}>¥{item.contract_amount.toLocaleString()}</TableCell>;
      case 'amount':
        return <TableCell sx={sx}><Typography fontWeight={600}>¥{item.amount.toLocaleString()}</Typography></TableCell>;
      case 'status':
        return <TableCell sx={sx}><Chip size="small" label={item.status} color={item.status === '已收款' ? 'success' : 'warning'} /></TableCell>;
      default: return <TableCell sx={sx}>-</TableCell>;
    }
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>回款跟踪</Typography>

      <Box sx={{ display: 'flex', gap: 3, mb: 2 }}>
        <Typography variant="body1">已收款: <strong style={{color:'#2e7d32'}}>¥{totalReceived.toLocaleString()}</strong> ({received.length}笔)</Typography>
        <Typography variant="body1">未收款: <strong style={{color:'#e65100'}}>¥{totalUnreceived.toLocaleString()}</strong> ({unreceived.length}笔)</Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <ToggleButtonGroup
          size="small"
          value={statusFilter}
          exclusive
          onChange={(_, v) => { if (v) setStatusFilter(v); }}
        >
          <ToggleButton value="all">全部</ToggleButton>
          <ToggleButton value="已收款">已收款</ToggleButton>
          <ToggleButton value="未收款">未收款</ToggleButton>
        </ToggleButtonGroup>
        <TextField
          size="small"
          placeholder="搜索合同编号 / 签约方 / 合同名称"
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          sx={{ minWidth: 300 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
          }}
        />
      </Box>

      <TableContainer component={Paper}>
        <Table size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              {COLUMNS.map(col => (
                <HeaderCell
                  key={col.id}
                  col={col}
                  width={getW(col)}
                  onResize={handleResize}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map(item => (
              <TableRow key={item.id} sx={item.status === '未收款' ? { bgcolor: '#fff3e0' } : {}}>
                {COLUMNS.map(col => (
                  <React.Fragment key={col.id}>{renderCell(col, item)}</React.Fragment>
                ))}
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  暂无匹配的收款记录
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

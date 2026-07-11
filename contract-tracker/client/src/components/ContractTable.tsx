import React, { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  IconButton,
  Tooltip,
  Typography,
  Box,
  LinearProgress,
  TableSortLabel,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { ContractListItem } from '../types';
import StatusChip from './StatusChip';

interface ContractTableProps {
  list: ContractListItem[];
  total: number;
  page: number;
  pageSize: number;
  loading: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onPageChange: (page: number, pageSize: number) => void;
  onDelete: (contract: ContractListItem) => void;
  onSort?: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
}

/**
 * 格式化金额（千分位分隔 + 两位小数）
 */
function formatAmount(amount: number): string {
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * 格式化日期
 */
function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// ===== 可拖拽调整列宽 =====
interface ColumnDef {
  id: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  initialWidth: number;
}

const COLUMNS: ColumnDef[] = [
  { id: 'signed_date', label: '签约日期', initialWidth: 120 },
  { id: 'contract_no', label: '合同编号', initialWidth: 140 },
  { id: 'project_no', label: '项目号', initialWidth: 120 },
  { id: 'project_name', label: '项目名称', initialWidth: 130 },
  { id: 'party', label: '签约方', initialWidth: 140 },
  { id: 'contract_name', label: '合同标的', initialWidth: 200 },
  { id: 'amount', label: '合同金额', align: 'right', initialWidth: 120 },
  { id: 'status', label: '状态', initialWidth: 90 },
  { id: 'salesperson', label: '业务员', initialWidth: 90 },
  { id: 'invoiced', label: '已开票', align: 'right', initialWidth: 100 },
  { id: 'paid', label: '已回款', align: 'right', initialWidth: 100 },
  { id: 'ship_progress', label: '发货进度', initialWidth: 150 },
  { id: 'invoice_progress', label: '开票进度', initialWidth: 150 },
  { id: 'progress', label: '回款进度', initialWidth: 150 },
  { id: 'actions', label: '操作', align: 'center', initialWidth: 110 },
];

// ===== 可排序列 ID 白名单（进度列和操作列不参与排序） =====
const SORTABLE_COLUMNS = new Set([
  'signed_date', 'contract_no', 'project_no', 'project_name',
  'party', 'contract_name', 'amount', 'status', 'salesperson',
  'invoiced', 'paid',
]);

const MIN_COL_WIDTH = 50;

/**
 * 可拖拽调整列宽 + 可排序的表头
 */
function ResizableHeader({ col, width, onResize, sortBy, sortOrder, onSort }: {
  col: ColumnDef;
  width: number;
  onResize: (colId: string, newWidth: number) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (colId: string) => void;
}) {
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = width;

    const handleMouseMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startXRef.current;
      const newWidth = Math.max(MIN_COL_WIDTH, startWidthRef.current + diff);
      onResize(col.id, newWidth);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [col.id, width, onResize]);

  const sortable = SORTABLE_COLUMNS.has(col.id);
  const active = sortBy === col.id;
  const direction = active ? sortOrder || 'asc' : 'asc';

  const handleSortClick = () => {
    if (sortable && onSort) {
      onSort(col.id);
    }
  };

  return (
    <TableCell
      sx={{
        fontWeight: 600,
        width,
        maxWidth: width,
        minWidth: width,
        position: 'relative',
        overflow: 'visible',
        textAlign: col.align || 'left',
        userSelect: 'none',
        cursor: sortable ? 'pointer' : 'default',
      }}
      onClick={handleSortClick}
    >
      {sortable ? (
        <TableSortLabel active={active} direction={direction}>
          {col.label}
        </TableSortLabel>
      ) : (
        col.label
      )}
      {/* Resize handle */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          position: 'absolute',
          top: 0,
          right: -4,
          width: 8,
          height: '100%',
          cursor: 'col-resize',
          zIndex: 10,
          '&:hover': { backgroundColor: 'rgba(0,0,0,0.08)' },
        }}
      />
    </TableCell>
  );
}

/**
 * 合同列表表格（可拖拽调整列宽）
 */
export default function ContractTable({
  list,
  total,
  page,
  pageSize,
  loading,
  sortBy,
  sortOrder,
  onPageChange,
  onDelete,
  onSort,
}: ContractTableProps) {
  const navigate = useNavigate();

  // Column widths state (persisted via localStorage key)
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem('contract_table_col_widths');
      if (saved) return { ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return {};
  });

  const getColWidth = (col: ColumnDef) => colWidths[col.id] || col.initialWidth;

  const handleResize = useCallback((colId: string, newWidth: number) => {
    setColWidths(prev => {
      const next = { ...prev, [colId]: newWidth };
      localStorage.setItem('contract_table_col_widths', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleSort = useCallback((colId: string) => {
    if (!onSort) return;
    let newOrder: 'asc' | 'desc' = 'asc';
    if (sortBy === colId && sortOrder === 'asc') {
      newOrder = 'desc';
    }
    onSort(colId, newOrder);
  }, [onSort, sortBy, sortOrder]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    onPageChange(newPage + 1, pageSize);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    onPageChange(1, parseInt(event.target.value, 10));
  };

  const renderCell = (col: ColumnDef, contract: ContractListItem) => {
    const width = getColWidth(col);
    const sx = {
      width,
      maxWidth: width,
      minWidth: width,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
      textAlign: col.align || ('left' as const),
    };

    switch (col.id) {
      case 'contract_no':
        return <TableCell sx={sx}>{contract.contract_no}</TableCell>;
      case 'contract_name':
        return <TableCell sx={sx}>{contract.contract_name}</TableCell>;
      case 'party':
        return <TableCell sx={sx}>{contract.party}</TableCell>;
      case 'project_no':
        return <TableCell sx={sx}>{(contract as any).project_no || '-'}</TableCell>;
      case 'project_name':
        return <TableCell sx={sx}>{(contract as any).project_name || '-'}</TableCell>;
      case 'amount':
        return <TableCell sx={sx}>{formatAmount(contract.amount)}</TableCell>;
      case 'signed_date':
        return <TableCell sx={sx}>{formatDate(contract.signed_date)}</TableCell>;
      case 'status':
        return <TableCell sx={sx}><StatusChip status={contract.status} type="contract" /></TableCell>;
      case 'salesperson':
        return <TableCell sx={sx}>{contract.salesperson_name || '-'}</TableCell>;
      case 'invoiced':
        return <TableCell sx={sx}>{formatAmount(contract.invoiced_amount)}</TableCell>;
      case 'paid':
        return <TableCell sx={sx}>{formatAmount(contract.paid_amount)}</TableCell>;
      case 'ship_progress':
        return (
          <TableCell sx={sx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 40 }}>
                <LinearProgress
                  variant="determinate"
                  value={contract.ship_progress || 0}
                  color={contract.ship_progress >= 100 ? 'success' : 'info'}
                />
              </Box>
              <Typography variant="caption" sx={{ flexShrink: 0 }}>{contract.ship_progress || 0}%</Typography>
            </Box>
          </TableCell>
        );
      case 'invoice_progress':
        return (
          <TableCell sx={sx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 40 }}>
                <LinearProgress
                  variant="determinate"
                  value={contract.invoice_progress || 0}
                  color={contract.invoice_progress >= 100 ? 'success' : 'secondary'}
                />
              </Box>
              <Typography variant="caption" sx={{ flexShrink: 0 }}>{contract.invoice_progress || 0}%</Typography>
            </Box>
          </TableCell>
        );
      case 'progress':
        return (
          <TableCell sx={sx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 40 }}>
                <LinearProgress
                  variant="determinate"
                  value={contract.payment_progress}
                  color={contract.payment_progress >= 100 ? 'success' : 'primary'}
                />
              </Box>
              <Typography variant="caption" sx={{ flexShrink: 0 }}>{contract.payment_progress}%</Typography>
            </Box>
          </TableCell>
        );
      case 'actions':
        return (
          <TableCell sx={sx}>
            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
              <Tooltip title="查看详情">
                <IconButton size="small" onClick={() => navigate(`/contracts/${contract.id}`)}>
                  <VisibilityIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="编辑">
                <IconButton size="small" onClick={() => navigate(`/contracts/${contract.id}/edit`)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="删除">
                <IconButton size="small" color="error" onClick={() => onDelete(contract)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </TableCell>
        );
      default:
        return <TableCell sx={sx}>-</TableCell>;
    }
  };

  return (
    <Paper sx={{ width: '100%' }}>
      <TableContainer sx={{ maxHeight: 'calc(100vh - 280px)', overflowX: 'auto' }}>
        <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
          <TableHead>
            <TableRow>
              {COLUMNS.map(col => (
                <ResizableHeader
                  key={col.id}
                  col={col}
                  width={getColWidth(col)}
                  onResize={handleResize}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">加载中...</Typography>
                </TableCell>
              </TableRow>
            ) : list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS.length} sx={{ textAlign: 'center', py: 4 }}>
                  <Typography color="text.secondary">暂无数据</Typography>
                </TableCell>
              </TableRow>
            ) : (
              list.map((contract) => (
                <TableRow
                  key={contract.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/contracts/${contract.id}`)}
                >
                  {COLUMNS.map(col => (
                    <React.Fragment key={col.id}>
                      {renderCell(col, contract)}
                    </React.Fragment>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        rowsPerPageOptions={[5, 10, 20, 50]}
        component="div"
        count={total}
        rowsPerPage={pageSize}
        page={page - 1}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        labelRowsPerPage="每页"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} / 共 ${count} 条`}
      />
    </Paper>
  );
}

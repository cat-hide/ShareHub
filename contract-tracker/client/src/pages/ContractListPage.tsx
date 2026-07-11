import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  Typography,
  Alert,
  Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import ContractFilter from '../components/ContractFilter';
import ContractTable from '../components/ContractTable';
import ConfirmDialog from '../components/ConfirmDialog';
import { useContracts } from '../hooks/useContracts';
import * as contractsApi from '../api/contracts';
import type { ContractQuery, ContractListItem } from '../types';

const FILTER_STORAGE_KEY = 'contract_list_filter';

/** 读取会话中保存的筛选条件 */
function getSavedFilter(): ContractQuery | null {
  try {
    const raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** 保存筛选条件到会话 */
function saveFilter(query: ContractQuery) {
  try {
    sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(query));
  } catch { /* quota exceeded, ignore */ }
}

/** 清除保存的筛选条件 */
export function clearContractFilter() {
  sessionStorage.removeItem(FILTER_STORAGE_KEY);
}

/**
 * 合同列表页面
 */
export default function ContractListPage() {
  const navigate = useNavigate();
  const { data, loading, error, fetchContracts } = useContracts();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [currentQuery, setCurrentQuery] = useState<ContractQuery>({ page: 1, pageSize: 10 });

  const [deleteTarget, setDeleteTarget] = useState<ContractListItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [sortBy, setSortBy] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const loadContracts = useCallback(async (query: ContractQuery) => {
    setCurrentQuery(query);
    if (query.page !== undefined) setPage(query.page);
    if (query.pageSize !== undefined) setPageSize(query.pageSize);
    if (query.sortBy !== undefined) setSortBy(query.sortBy);
    if (query.sortOrder !== undefined) setSortOrder(query.sortOrder);
    saveFilter(query);
    await fetchContracts(query);
  }, [fetchContracts]);

  // Restore saved filter once on mount
  const [initialFilter] = useState<ContractQuery | undefined>(() => getSavedFilter() || undefined);

  useEffect(() => {
    if (initialFilter) {
      loadContracts({ ...initialFilter, page: 1, pageSize: initialFilter.pageSize || 10 });
    } else {
      loadContracts({ page: 1, pageSize: 10 });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePageChange = (newPage: number, newPageSize: number) => {
    loadContracts({ ...currentQuery, page: newPage, pageSize: newPageSize });
  };

  const handleSort = (newSortBy: string, newSortOrder: 'asc' | 'desc') => {
    setSortBy(newSortBy);
    setSortOrder(newSortOrder);
    loadContracts({ ...currentQuery, page: 1, sortBy: newSortBy, sortOrder: newSortOrder });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await contractsApi.deleteContract(deleteTarget.id);
      if (res.code === 0) {
        setSnackbar({ open: true, message: '合同删除成功', severity: 'success' });
        loadContracts(currentQuery);
      } else {
        setSnackbar({ open: true, message: res.message, severity: 'error' });
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '删除失败',
        severity: 'error',
      });
    } finally {
      setDeleteLoading(false);
      setDeleteTarget(null);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await contractsApi.exportContracts({
        status: currentQuery.status,
        keyword: currentQuery.keyword,
        startDate: currentQuery.startDate,
        endDate: currentQuery.endDate,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `合同台账_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSnackbar({ open: true, message: '导出成功', severity: 'success' });
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '导出失败',
        severity: 'error',
      });
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={600}>
          合同列表
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={handleExport}>
            导出 Excel
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/contracts/new')}>
            新增合同
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <ContractFilter onSearch={loadContracts} loading={loading} initialQuery={initialFilter} />

      <ContractTable
        list={data?.list || []}
        total={data?.total || 0}
        page={page}
        pageSize={pageSize}
        loading={loading}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onPageChange={handlePageChange}
        onDelete={(contract) => setDeleteTarget(contract)}
        onSort={handleSort}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="确认删除"
        content={`确定要删除合同「${deleteTarget?.contract_name || ''}」吗？关联的开票记录和收款记录也将一并删除。`}
        confirmText={deleteLoading ? '删除中...' : '删除'}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        danger
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Alert,
  Snackbar,
} from '@mui/material';
import ContractForm from '../components/ContractForm';
import LoadingOverlay from '../components/LoadingOverlay';
import * as contractsApi from '../api/contracts';
import type { ContractCreatePayload, Contract } from '../types';

/**
 * 新增/编辑合同页面
 */
export default function ContractFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  useEffect(() => {
    if (isEdit && id) {
      setLoading(true);
      setError(null);
      contractsApi
        .getContract(parseInt(id, 10))
        .then((res) => {
          if (res.code === 0) {
            setContract(res.data);
          } else {
            setError(res.message);
          }
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : '获取合同信息失败');
        })
        .finally(() => setLoading(false));
    }
  }, [isEdit, id]);

  const handleSubmit = async (data: ContractCreatePayload): Promise<boolean> => {
    setSubmitLoading(true);
    try {
      let res;
      if (isEdit && id) {
        res = await contractsApi.updateContract(parseInt(id, 10), data);
      } else {
        res = await contractsApi.createContract(data);
      }

      if (res.code === 0) {
        setSnackbar({
          open: true,
          message: isEdit ? '合同更新成功' : '合同创建成功',
          severity: 'success',
        });
        setTimeout(() => {
          navigate(`/contracts/${res.data.id}`);
        }, 500);
        return true;
      } else {
        setSnackbar({ open: true, message: res.message, severity: 'error' });
        return false;
      }
    } catch (err) {
      setSnackbar({
        open: true,
        message: err instanceof Error ? err.message : '操作失败',
        severity: 'error',
      });
      return false;
    } finally {
      setSubmitLoading(false);
    }
  };

  if (loading) {
    return <LoadingOverlay open message="加载合同信息..." />;
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" fontWeight={600} mb={3}>
        {isEdit ? '编辑合同' : '新增合同'}
      </Typography>

      <Paper sx={{ p: 3, maxWidth: 800 }}>
        <ContractForm
          initialData={contract}
          onSubmit={handleSubmit}
          loading={submitLoading}
          contractId={id ? parseInt(id, 10) : undefined}
        />
      </Paper>

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

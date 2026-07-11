import { useState, useCallback } from 'react';
import type { ContractListItem, ContractQuery, PaginatedData } from '../types';
import * as contractsApi from '../api/contracts';

interface UseContractsReturn {
  data: PaginatedData<ContractListItem> | null;
  loading: boolean;
  error: string | null;
  fetchContracts: (query: ContractQuery) => Promise<void>;
}

/**
 * 合同列表查询 Hook
 */
export function useContracts(): UseContractsReturn {
  const [data, setData] = useState<PaginatedData<ContractListItem> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContracts = useCallback(async (query: ContractQuery) => {
    setLoading(true);
    setError(null);
    try {
      const response = await contractsApi.getContracts(query);
      if (response.code === 0) {
        setData(response.data);
      } else {
        setError(response.message);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取合同列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, fetchContracts };
}

import React, { useState } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  Stack,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import type { ContractQuery } from '../types';

interface ContractFilterProps {
  onSearch: (query: ContractQuery) => void;
  loading?: boolean;
  initialQuery?: ContractQuery;
}

export default function ContractFilter({ onSearch, loading, initialQuery }: ContractFilterProps) {
  const [keyword, setKeyword] = useState(initialQuery?.keyword || '');
  const [status, setStatus] = useState(initialQuery?.status || '');
  const [startDate, setStartDate] = useState(initialQuery?.startDate || '');
  const [endDate, setEndDate] = useState(initialQuery?.endDate || '');

  const handleSearch = () => {
    onSearch({
      keyword: keyword.trim() || undefined,
      status: status || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: 1,
      pageSize: 10,
    });
  };

  const handleReset = () => {
    setKeyword('');
    setStatus('');
    setStartDate('');
    setEndDate('');
    onSearch({ page: 1, pageSize: 10 });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <Box sx={{ mb: 2, p: 2, backgroundColor: 'background.paper', borderRadius: 1 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
        <TextField
          size="small"
          label="搜索关键字"
          placeholder="合同编号/名称/签约方"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{ minWidth: 200 }}
        />
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>合同状态</InputLabel>
          <Select
            value={status}
            label="合同状态"
            onChange={(e) => setStatus(e.target.value)}
          >
            <MenuItem value="">全部</MenuItem>
            <MenuItem value="进行中">进行中</MenuItem>
            <MenuItem value="已完成">已完成</MenuItem>
            <MenuItem value="已终止">已终止</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small"
          label="签约开始日期"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ max: endDate || undefined }}
        />
        <TextField
          size="small"
          label="签约结束日期"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          InputLabelProps={{ shrink: true }}
          inputProps={{ min: startDate || undefined }}
        />
        <Button
          variant="contained"
          startIcon={<SearchIcon />}
          onClick={handleSearch}
          disabled={loading}
        >
          搜索
        </Button>
        <Button
          variant="outlined"
          startIcon={<ClearIcon />}
          onClick={handleReset}
          disabled={loading}
        >
          重置
        </Button>
      </Stack>
    </Box>
  );
}

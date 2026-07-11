import React from 'react';
import { Chip } from '@mui/material';

interface StatusChipProps {
  status: string;
  type?: 'contract' | 'payment' | 'overdue';
}

/**
 * 状态标签组件
 */
export default function StatusChip({ status, type = 'contract' }: StatusChipProps) {
  if (type === 'overdue') {
    return (
      <Chip
        label="逾期"
        size="small"
        color="error"
        variant="outlined"
      />
    );
  }

  if (type === 'payment') {
    let color: 'default' | 'error' | 'warning' | 'success' = 'default';
    switch (status) {
      case '未回款':
        color = 'error';
        break;
      case '部分回款':
        color = 'warning';
        break;
      case '已回款':
        color = 'success';
        break;
    }
    return <Chip label={status} size="small" color={color} />;
  }

  // Contract status
  let color: 'default' | 'info' | 'success' | 'error' = 'default';
  switch (status) {
    case '进行中':
      color = 'info';
      break;
    case '已完成':
      color = 'success';
      break;
    case '已终止':
      color = 'error';
      break;
  }
  return <Chip label={status} size="small" color={color} />;
}

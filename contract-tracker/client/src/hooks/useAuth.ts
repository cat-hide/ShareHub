import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * 认证 Hook
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

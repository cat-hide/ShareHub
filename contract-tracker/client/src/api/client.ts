import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type { ApiResponse } from '../types';

const client = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// Request interceptor: auto-add token
client.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 auto-redirect
client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiResponse<null>>) => {
    if (error.response) {
      const { status, data } = error.response;
      if (status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        // Redirect to login, preserving current location
        const currentPath = window.location.pathname + window.location.search;
        if (currentPath !== '/login') {
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        }
      }
      return Promise.reject(new Error(data?.message || `请求失败 (${status})`));
    }
    if (error.request) {
      return Promise.reject(new Error('网络连接异常，请检查网络后重试'));
    }
    return Promise.reject(error);
  }
);

export default client;

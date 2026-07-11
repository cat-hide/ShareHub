import client from './client';
import type { ApiResponse, LoginRequest, LoginResponse, User } from '../types';

/**
 * 登录
 */
export async function login(data: LoginRequest): Promise<ApiResponse<LoginResponse>> {
  const response = await client.post<ApiResponse<LoginResponse>>('/auth/login', data);
  return response.data;
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(): Promise<ApiResponse<User>> {
  const response = await client.get<ApiResponse<User>>('/auth/me');
  return response.data;
}

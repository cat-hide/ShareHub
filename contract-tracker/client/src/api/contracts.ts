import client from './client';
import type {
  ApiResponse,
  PaginatedData,
  ContractListItem,
  ContractDetail,
  ContractCreatePayload,
  ContractQuery,
  ContractAttachment,
  ContractMaterial,
  MaterialCreatePayload,
} from '../types';

/**
 * 获取合同列表（分页+筛选）
 */
export async function getContracts(query: ContractQuery): Promise<ApiResponse<PaginatedData<ContractListItem>>> {
  const response = await client.get<ApiResponse<PaginatedData<ContractListItem>>>('/contracts', {
    params: query,
  });
  return response.data;
}

/**
 * 获取合同详情
 */
export async function getContract(id: number): Promise<ApiResponse<ContractDetail>> {
  const response = await client.get<ApiResponse<ContractDetail>>(`/contracts/${id}`);
  return response.data;
}

/**
 * 新增合同
 */
export async function createContract(data: ContractCreatePayload): Promise<ApiResponse<ContractDetail>> {
  const response = await client.post<ApiResponse<ContractDetail>>('/contracts', data);
  return response.data;
}

/**
 * 修改合同
 */
export async function updateContract(id: number, data: Partial<ContractCreatePayload>): Promise<ApiResponse<ContractDetail>> {
  const response = await client.put<ApiResponse<ContractDetail>>(`/contracts/${id}`, data);
  return response.data;
}

/**
 * 删除合同
 */
export async function deleteContract(id: number): Promise<ApiResponse<null>> {
  const response = await client.delete<ApiResponse<null>>(`/contracts/${id}`);
  return response.data;
}

/**
 * 上传合同附件（多文件）
 */
export async function uploadAttachments(contractId: number, files: File[]): Promise<ApiResponse<Array<{ id: number; original_name: string; storage_name: string; file_size: number }>>> {
  const formData = new FormData();
  files.forEach(file => formData.append('files', file));
  const response = await client.post<
    ApiResponse<Array<{ id: number; original_name: string; storage_name: string; file_size: number }>>
  >(`/contracts/${contractId}/upload`, formData);
  return response.data;
}

/**
 * 获取合同附件列表
 */
export async function getAttachments(contractId: number): Promise<ApiResponse<ContractAttachment[]>> {
  const response = await client.get<ApiResponse<ContractAttachment[]>>(`/contracts/${contractId}/attachments`);
  return response.data;
}

/**
 * 删除附件（按附件ID）
 */
export async function deleteAttachment(attachmentId: number): Promise<ApiResponse<null>> {
  const response = await client.delete<ApiResponse<null>>(`/contracts/attachments/${attachmentId}`);
  return response.data;
}

/**
 * 获取附件下载 URL（携带 access_token 进行安全验证）
 */
export function getAttachmentDownloadUrl(attachmentId: number, accessToken: string): string {
  return `/api/contracts/attachments/${attachmentId}/download?token=${encodeURIComponent(accessToken)}`;
}

/**
 * 获取附件预览 URL（携带 access_token 进行安全验证）
 */
export function getAttachmentPreviewUrl(attachmentId: number, accessToken: string): string {
  return `/api/contracts/attachments/${attachmentId}/preview?token=${encodeURIComponent(accessToken)}`;
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * 导出合同台账 Excel
 */
export async function exportContracts(query?: Record<string, string | undefined>): Promise<Blob> {
  const response = await client.get('/contracts/export', {
    responseType: 'blob',
    params: query,
  });
  return response.data;
}

// ==================== 物料明细 API ====================

/**
 * 获取合同物料列表
 */
export async function getMaterials(contractId: number): Promise<ApiResponse<ContractMaterial[]>> {
  const response = await client.get<ApiResponse<ContractMaterial[]>>(`/contracts/${contractId}/materials`);
  return response.data;
}

/**
 * 新增物料行
 */
export async function createMaterial(contractId: number, data: MaterialCreatePayload): Promise<ApiResponse<ContractMaterial>> {
  const response = await client.post<ApiResponse<ContractMaterial>>(`/contracts/${contractId}/materials`, data);
  return response.data;
}

/**
 * 修改物料行
 */
export async function updateMaterial(materialId: number, data: Partial<MaterialCreatePayload>): Promise<ApiResponse<ContractMaterial>> {
  const response = await client.put<ApiResponse<ContractMaterial>>(`/contracts/materials/${materialId}`, data);
  return response.data;
}

/**
 * 删除物料行
 */
export async function deleteMaterial(materialId: number): Promise<ApiResponse<null>> {
  const response = await client.delete<ApiResponse<null>>(`/contracts/materials/${materialId}`);
  return response.data;
}

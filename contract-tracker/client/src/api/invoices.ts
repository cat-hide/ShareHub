import client from './client';
import type { ApiResponse, Invoice, InvoiceCreatePayload, InvoiceAttachment } from '../types';

/**
 * 获取某合同下的所有开票记录
 */
export async function getInvoices(contractId: number): Promise<ApiResponse<Invoice[]>> {
  const response = await client.get<ApiResponse<Invoice[]>>(`/contracts/${contractId}/invoices`);
  return response.data;
}

/**
 * 新增开票记录
 */
export async function createInvoice(contractId: number, data: InvoiceCreatePayload): Promise<ApiResponse<Invoice>> {
  const response = await client.post<ApiResponse<Invoice>>(`/contracts/${contractId}/invoices`, data);
  return response.data;
}

/**
 * 修改开票记录
 */
export async function updateInvoice(id: number, data: Partial<InvoiceCreatePayload>): Promise<ApiResponse<Invoice>> {
  const response = await client.put<ApiResponse<Invoice>>(`/invoices/${id}`, data);
  return response.data;
}

/**
 * 删除开票记录
 */
export async function deleteInvoice(id: number): Promise<ApiResponse<null>> {
  const response = await client.delete<ApiResponse<null>>(`/invoices/${id}`);
  return response.data;
}

/** 上传发票附件（多文件） */
export async function uploadInvoiceAttachments(invoiceId: number, files: File[]): Promise<ApiResponse<any>> {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  const response = await client.post<ApiResponse<any>>(`/invoices/${invoiceId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/** 获取发票附件列表 */
export async function getInvoiceAttachments(invoiceId: number): Promise<ApiResponse<InvoiceAttachment[]>> {
  const response = await client.get<ApiResponse<InvoiceAttachment[]>>(`/invoices/${invoiceId}/attachments`);
  return response.data;
}

/** 删除发票附件 */
export async function deleteInvoiceAttachment(attachmentId: number): Promise<ApiResponse<null>> {
  const response = await client.delete<ApiResponse<null>>(`/attachments/invoice/${attachmentId}`);
  return response.data;
}

/** 获取发票附件预览URL（携带 access_token 进行安全验证） */
export function getInvoiceAttachmentPreviewUrl(attachmentId: number, accessToken: string): string {
  return `/api/invoices/attachments/${attachmentId}/preview?token=${encodeURIComponent(accessToken)}`;
}

/** 获取发票附件下载URL（携带 access_token 进行安全验证） */
export function getInvoiceAttachmentDownloadUrl(attachmentId: number, accessToken: string): string {
  return `/api/invoices/attachments/${attachmentId}/download?token=${encodeURIComponent(accessToken)}`;
}

/** 格式化文件大小 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

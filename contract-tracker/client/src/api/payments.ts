import client from './client';
import type { ApiResponse, Payment, PaymentCreatePayload, PaymentAttachment } from '../types';

/** 获取某合同下的所有收款记录（独立收款） */
export async function getPayments(contractId: number): Promise<ApiResponse<Payment[]>> {
  const response = await client.get<ApiResponse<Payment[]>>(`/contracts/${contractId}/payments`);
  return response.data;
}

/** 新增收款 */
export async function createPayment(contractId: number, data: PaymentCreatePayload): Promise<ApiResponse<Payment>> {
  const response = await client.post<ApiResponse<Payment>>(`/contracts/${contractId}/payments`, data);
  return response.data;
}

/** 修改收款 */
export async function updatePayment(id: number, data: Partial<PaymentCreatePayload>): Promise<ApiResponse<Payment>> {
  const response = await client.put<ApiResponse<Payment>>(`/payments/${id}`, data);
  return response.data;
}

/** 删除收款 */
export async function deletePayment(id: number): Promise<ApiResponse<null>> {
  const response = await client.delete<ApiResponse<null>>(`/payments/${id}`);
  return response.data;
}

/** 上传银行回单（多文件） */
export async function uploadPaymentAttachments(paymentId: number, files: File[]): Promise<ApiResponse<any>> {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  const response = await client.post<ApiResponse<any>>(`/payments/${paymentId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/** 获取收款附件列表 */
export async function getPaymentAttachments(paymentId: number): Promise<ApiResponse<PaymentAttachment[]>> {
  const response = await client.get<ApiResponse<PaymentAttachment[]>>(`/payments/${paymentId}/attachments`);
  return response.data;
}

/** 删除收款附件 */
export async function deletePaymentAttachment(attachmentId: number): Promise<ApiResponse<null>> {
  const response = await client.delete<ApiResponse<null>>(`/attachments/payment/${attachmentId}`);
  return response.data;
}

/** 获取收款附件预览URL（携带 access_token 进行安全验证） */
export function getPaymentAttachmentPreviewUrl(attachmentId: number, accessToken: string): string {
  return `/api/payments/attachments/${attachmentId}/preview?token=${encodeURIComponent(accessToken)}`;
}

/** 获取收款附件下载URL（携带 access_token 进行安全验证） */
export function getPaymentAttachmentDownloadUrl(attachmentId: number, accessToken: string): string {
  return `/api/payments/attachments/${attachmentId}/download?token=${encodeURIComponent(accessToken)}`;
}

/** 格式化文件大小 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

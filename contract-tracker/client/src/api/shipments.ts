import client from './client';
import type { ApiResponse, Shipment, ShipmentCreatePayload, ShipmentAttachment } from '../types';

/** 获取合同下所有发货记录 */
export async function getShipments(contractId: number): Promise<ApiResponse<Shipment[]>> {
  const response = await client.get<ApiResponse<Shipment[]>>(`/contracts/${contractId}/shipments`);
  return response.data;
}

/** 新增发货记录 */
export async function createShipment(contractId: number, data: ShipmentCreatePayload): Promise<ApiResponse<Shipment>> {
  const response = await client.post<ApiResponse<Shipment>>(`/contracts/${contractId}/shipments`, data);
  return response.data;
}

/** 修改发货记录 */
export async function updateShipment(id: number, data: Partial<ShipmentCreatePayload>): Promise<ApiResponse<Shipment>> {
  const response = await client.put<ApiResponse<Shipment>>(`/shipments/${id}`, data);
  return response.data;
}

/** 删除发货记录 */
export async function deleteShipment(id: number): Promise<ApiResponse<null>> {
  const response = await client.delete<ApiResponse<null>>(`/shipments/${id}`);
  return response.data;
}

/** 上传发货单附件（多文件） */
export async function uploadShipmentAttachments(shipmentId: number, files: File[]): Promise<ApiResponse<any>> {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  const response = await client.post<ApiResponse<any>>(`/shipments/${shipmentId}/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
}

/** 获取发货附件列表 */
export async function getShipmentAttachments(shipmentId: number): Promise<ApiResponse<ShipmentAttachment[]>> {
  const response = await client.get<ApiResponse<ShipmentAttachment[]>>(`/shipments/${shipmentId}/attachments`);
  return response.data;
}

/** 删除发货附件 */
export async function deleteShipmentAttachment(attachmentId: number): Promise<ApiResponse<null>> {
  const response = await client.delete<ApiResponse<null>>(`/attachments/shipment/${attachmentId}`);
  return response.data;
}

/** 获取发货附件预览URL（携带 access_token 进行安全验证） */
export function getShipmentAttachmentPreviewUrl(attachmentId: number, accessToken: string): string {
  return `/api/shipments/attachments/${attachmentId}/preview?token=${encodeURIComponent(accessToken)}`;
}

/** 获取发货附件下载URL（携带 access_token 进行安全验证） */
export function getShipmentAttachmentDownloadUrl(attachmentId: number, accessToken: string): string {
  return `/api/shipments/attachments/${attachmentId}/download?token=${encodeURIComponent(accessToken)}`;
}

/** 格式化文件大小 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

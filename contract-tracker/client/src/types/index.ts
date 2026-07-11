// ==================== 用户 ====================
export interface User {
  id: number;
  username: string;
  display_name: string;
  role: 'sales' | 'admin';
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// ==================== 合同 ====================
export interface Contract {
  id: number;
  contract_no: string;
  project_no: string;
  project_name?: string;
  contract_name: string;
  party: string;
  amount: number;
  signed_date: string;
  status: '进行中' | '已完成' | '已终止';
  salesperson_id: number;
  attachment_name?: string | null;
  attachment_path?: string | null;
  attachment_size?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ContractListItem extends Contract {
  salesperson_name?: string;
  invoiced_amount: number;
  paid_amount: number;
  payment_progress: number;
  shipped_qty: number;
  total_qty: number;
  ship_progress: number;
  invoice_progress: number;
}

export interface ContractAttachment {
  id: number;
  original_name: string;
  file_size: number;
  access_token: string;
  created_at: string;
}

export interface ContractDetail extends Contract {
  salesperson_name?: string;
  invoiced_amount: number;
  paid_amount: number;
  payment_progress: number;
  shipped_qty: number;
  total_qty: number;
  ship_progress: number;
  invoice_progress: number;
  invoices: InvoiceWithPayments[];
  attachments?: ContractAttachment[];
}

export interface ContractQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  keyword?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface ContractCreatePayload {
  contract_no: string;
  project_no?: string;
  project_name?: string;
  contract_name: string;
  party: string;
  amount: number;
  signed_date: string;
  status: string;
  salesperson_id?: number;
  salesperson_name?: string;
}

// ==================== 合同物料明细 ====================
export interface ContractMaterial {
  id: number;
  contract_id: number;
  material_code?: string;
  material_name: string;
  specification?: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_with_tax: number;
  remark?: string;
  created_at: string;
}

export interface MaterialCreatePayload {
  material_code?: string;
  material_name: string;
  specification?: string;
  unit?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_with_tax: number;
  remark?: string;
}

// ==================== 开票 ====================
export interface Invoice {
  id: number;
  contract_id: number;
  invoice_no: string;
  invoice_date: string;
  amount: number;
  invoice_type: string;
  inv_attachment_name?: string | null;
  inv_attachment_path?: string | null;
  inv_attachment_size?: number | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceWithPayments extends Invoice {
  paid_amount: number;
  is_overdue: boolean;
}

export interface InvoiceCreatePayload {
  invoice_no: string;
  invoice_date: string;
  amount: number;
  invoice_type: string;
}

export interface InvoiceAttachment {
  id: number;
  original_name: string;
  file_size: number;
  access_token: string;
  created_at: string;
}

// ==================== 收款（独立，不跟开票走） ====================
export interface Payment {
  id: number;
  contract_id: number;
  payment_date: string;
  amount: number;
  status: string;
  pay_attachment_name?: string | null;
  pay_attachment_path?: string | null;
  pay_attachment_size?: number | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentCreatePayload {
  payment_date: string;
  amount: number;
  status: string;
}

export interface PaymentAttachment {
  id: number;
  original_name: string;
  file_size: number;
  access_token: string;
  created_at: string;
}

// ==================== 发货记录 ====================
export interface Shipment {
  id: number;
  contract_id: number;
  shipment_date: string;
  description?: string | null;
  material_id?: number | null;
  shipped_quantity: number;
  material_code?: string | null;
  material_name?: string | null;
  specification?: string | null;
  unit?: string | null;
  ship_attachment_name?: string | null;
  ship_attachment_path?: string | null;
  ship_attachment_size?: number | null;
  created_at: string;
  updated_at: string;
}

export interface ShipmentCreatePayload {
  shipment_date: string;
  description?: string;
  material_id?: number | null;
  shipped_quantity?: number;
  material_code?: string;
  material_name?: string;
  specification?: string;
  unit?: string;
}

export interface ShipmentAttachment {
  id: number;
  original_name: string;
  file_size: number;
  access_token: string;
  created_at: string;
}

// ==================== API 响应 ====================
export interface ApiResponse<T> {
  code: number;
  data: T;
  message: string;
}

export interface PaginatedData<T> {
  list: T[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * contract-tracker API 综合测试脚本
 *
 * 测试范围：
 *   - 登录认证 (成功/失败/鉴权)
 *   - 合同 CRUD (列表/详情/新增/修改/删除)
 *   - 开票记录 CRUD (新增/修改)
 *   - 收款记录 CRUD (新增/修改)
 *   - 数据权限控制 (sales 隔离 / admin 全量)
 *
 * 用法: npx tsx src/test-api.ts
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

// ============================================================
// 类型定义
// ============================================================

interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

interface LoginData {
  token: string;
  user: { id: number; username: string; display_name: string; role: string };
}

interface Contract {
  id: number;
  contract_no: string;
  contract_name: string;
  party: string;
  amount: number;
  signed_date: string;
  status: string;
  salesperson_id: number;
  salesperson_name: string;
  invoiced_amount: number;
  paid_amount: number;
  payment_progress: number;
  created_at: string;
  updated_at: string;
}

interface ContractListData {
  list: Contract[];
  total: number;
  page: number;
  pageSize: number;
}

interface ContractDetail extends Contract {
  invoices: InvoiceWithPayment[];
  payment_progress: number;
}

interface Invoice {
  id: number;
  contract_id: number;
  invoice_no: string;
  invoice_date: string;
  amount: number;
  invoice_type: string;
  created_at: string;
  updated_at: string;
}

interface InvoiceWithPayment extends Invoice {
  payments: Payment[];
  paid_amount: number;
  is_overdue: boolean;
}

interface Payment {
  id: number;
  invoice_id: number;
  payment_date: string;
  amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

// ============================================================
// 测试框架
// ============================================================

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const BASE_URL = 'http://localhost:3001';
let passedCount = 0;
let failedCount = 0;
const failures: Array<{ name: string; error: string }> = [];

function createClient(token?: string): AxiosInstance {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return axios.create({ baseURL: BASE_URL, headers, validateStatus: () => true });
}

async function runTest(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passedCount++;
    console.log(`  ✅ ${name}`);
  } catch (err: unknown) {
    failedCount++;
    const msg = err instanceof Error ? err.message : String(err);
    failures.push({ name, error: msg });
    console.log(`  ❌ ${name} — ${msg}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertMatch(actual: string, pattern: RegExp, label: string): void {
  if (!pattern.test(actual)) {
    throw new Error(`${label}: "${actual}" does not match ${pattern}`);
  }
}

// ============================================================
// 测试用例
// ============================================================

async function main(): Promise<void> {
  console.log('\n========================================');
  console.log('  合同执行情况跟踪平台 API 测试');
  console.log('========================================\n');

  // ---------- 1. 登录认证 ----------
  console.log('[1] 登录认证');

  let sales1Token = '';
  let sales2Token = '';
  let adminToken = '';

  await runTest('登录成功 (sales1/123456)', async () => {
    const res = await createClient().post<ApiResponse<LoginData>>('/api/auth/login', {
      username: 'sales1',
      password: '123456',
    });
    assertEqual(res.status, 200, 'HTTP 状态码');
    assertEqual(res.data.code, 0, '业务 code');
    assert(res.data.data.token.length > 0, '应返回 token');
    assertEqual(res.data.data.user.username, 'sales1', '用户名');
    assertEqual(res.data.data.user.display_name, '张三', '显示名');
    assertEqual(res.data.data.user.role, 'sales', '角色');
    sales1Token = res.data.data.token;
  });

  await runTest('登录成功 (admin/admin123)', async () => {
    const res = await createClient().post<ApiResponse<LoginData>>('/api/auth/login', {
      username: 'admin',
      password: 'admin123',
    });
    assertEqual(res.status, 200, 'HTTP 状态码');
    assertEqual(res.data.code, 0, '业务 code');
    assertEqual(res.data.data.user.role, 'admin', '角色');
    adminToken = res.data.data.token;
  });

  await runTest('登录失败 (密码错误)', async () => {
    const res = await createClient().post<ApiResponse<null>>('/api/auth/login', {
      username: 'sales1',
      password: 'wrong_password',
    });
    assertEqual(res.status, 401, 'HTTP 状态码应为 401');
    assertEqual(res.data.code, 40100, '业务 code 应为 40100');
    assertMatch(res.data.message, /用户名或密码错误/, '错误消息');
  });

  await runTest('登录失败 (空用户名)', async () => {
    const res = await createClient().post<ApiResponse<null>>('/api/auth/login', {
      username: '',
      password: '123456',
    });
    assertEqual(res.status, 400, 'HTTP 状态码应为 400');
    assertEqual(res.data.code, 40000, '业务 code');
  });

  await runTest('获取当前用户信息', async () => {
    const res = await createClient(sales1Token).get<ApiResponse>('/api/auth/me');
    assertEqual(res.status, 200, 'HTTP 状态码');
    assertEqual(res.data.code, 0, '业务 code');
    assertEqual(res.data.data.username, 'sales1', '用户名');
    assertEqual(res.data.data.display_name, '张三', '显示名');
  });

  await runTest('无 token 访问返回 401', async () => {
    const res = await createClient().get<ApiResponse<null>>('/api/auth/me');
    assertEqual(res.status, 401, 'HTTP 状态码应为 401');
    assertEqual(res.data.code, 40100, '业务 code');
    assertEqual(res.data.message, '未登录', '错误消息');
  });

  await runTest('无 token 访问合同接口返回 401', async () => {
    const res = await createClient().get<ApiResponse<null>>('/api/contracts');
    assertEqual(res.status, 401, 'HTTP 状态码应为 401');
    assertEqual(res.data.code, 40100, '业务 code');
  });

  // ---------- 2. 合同 CRUD ----------
  console.log('\n[2] 合同 CRUD');

  // Login sales2 first
  const r2 = await createClient().post<ApiResponse<LoginData>>('/api/auth/login', {
    username: 'sales2',
    password: '123456',
  });
  sales2Token = r2.data.data.token;

  let createdContractId = 0;
  let createdContractNo = '';

  await runTest('获取合同列表 (分页)', async () => {
    const res = await createClient(sales1Token).get<ApiResponse<ContractListData>>('/api/contracts?page=1&pageSize=10');
    assertEqual(res.status, 200, 'HTTP 状态码');
    assertEqual(res.data.code, 0, '业务 code');
    assert(Array.isArray(res.data.data.list), 'list 应为数组');
    assert(res.data.data.total >= 0, 'total 应 >= 0');
    assertEqual(res.data.data.page, 1, '页码');
    assertEqual(res.data.data.pageSize, 10, '每页条数');
  });

  await runTest('新增合同 (sales1)', async () => {
    const now = Date.now();
    const contractNo = `TEST-HT-${now}`;
    const res = await createClient(sales1Token).post<ApiResponse<Contract>>('/api/contracts', {
      contract_no: contractNo,
      contract_name: '测试合同-自动化测试',
      party: '测试有限公司',
      amount: 100000,
      signed_date: '2025-01-01',
      status: '进行中',
    });
    assertEqual(res.status, 201, 'HTTP 状态码应为 201');
    assertEqual(res.data.code, 0, '业务 code');
    assert(res.data.data.id > 0, '应返回合同 ID');
    assertEqual(res.data.data.contract_no, contractNo, '合同编号');
    assertEqual(res.data.data.salesperson_id, 2, 'sales1 的 ID 应为 2');
    createdContractId = res.data.data.id;
    createdContractNo = contractNo;
  });

  await runTest('获取合同详情', async () => {
    assert(createdContractId > 0, '需要有已创建的合同');
    const res = await createClient(sales1Token).get<ApiResponse<ContractDetail>>(
      `/api/contracts/${createdContractId}`
    );
    assertEqual(res.status, 200, 'HTTP 状态码');
    assertEqual(res.data.code, 0, '业务 code');
    assertEqual(res.data.data.id, createdContractId, '合同 ID');
    assertEqual(res.data.data.contract_no, createdContractNo, '合同编号');
    assert(Array.isArray(res.data.data.invoices), '应包含 invoices 数组');
    assert(typeof res.data.data.payment_progress === 'number', '应包含 payment_progress');
  });

  await runTest('修改合同', async () => {
    assert(createdContractId > 0, '需要有已创建的合同');
    const res = await createClient(sales1Token).put<ApiResponse<Contract>>(
      `/api/contracts/${createdContractId}`,
      { contract_name: '测试合同-已修改', amount: 200000 }
    );
    assertEqual(res.status, 200, 'HTTP 状态码');
    assertEqual(res.data.code, 0, '业务 code');
    assertEqual(res.data.data.contract_name, '测试合同-已修改', '合同名已更新');
    assertEqual(res.data.data.amount, 200000, '金额已更新');
  });

  // ---------- 3. 开票记录 CRUD ----------
  console.log('\n[3] 开票记录 CRUD');

  let createdInvoiceId = 0;

  await runTest('新增开票记录', async () => {
    assert(createdContractId > 0, '需要有已创建的合同');
    const res = await createClient(sales1Token).post<ApiResponse<Invoice>>(
      `/api/contracts/${createdContractId}/invoices`,
      {
        invoice_no: `INV-TEST-${Date.now()}`,
        invoice_date: '2025-02-01',
        amount: 100000,
        invoice_type: '增值税专用发票',
      }
    );
    assertEqual(res.status, 201, 'HTTP 状态码应为 201');
    assertEqual(res.data.code, 0, '业务 code');
    assert(res.data.data.id > 0, '应返回开票 ID');
    createdInvoiceId = res.data.data.id;
  });

  await runTest('修改开票记录', async () => {
    assert(createdInvoiceId > 0, '需要有已创建的开票');
    const res = await createClient(sales1Token).put<ApiResponse<Invoice>>(
      `/api/invoices/${createdInvoiceId}`,
      { amount: 50000 }
    );
    assertEqual(res.status, 200, 'HTTP 状态码');
    assertEqual(res.data.code, 0, '业务 code');
    assertEqual(res.data.data.amount, 50000, '开票金额已更新');
  });

  // ---------- 4. 收款记录 CRUD ----------
  console.log('\n[4] 收款记录 CRUD');

  let createdPaymentId = 0;

  await runTest('新增收款记录', async () => {
    assert(createdInvoiceId > 0, '需要有已创建的开票');
    const res = await createClient(sales1Token).post<ApiResponse<Payment>>(
      `/api/invoices/${createdInvoiceId}/payments`,
      {
        payment_date: '2025-03-01',
        amount: 30000,
      }
    );
    assertEqual(res.status, 201, 'HTTP 状态码应为 201');
    assertEqual(res.data.code, 0, '业务 code');
    assert(res.data.data.id > 0, '应返回收款 ID');
    createdPaymentId = res.data.data.id;
  });

  await runTest('修改收款记录', async () => {
    assert(createdPaymentId > 0, '需要有已创建的收款');
    const res = await createClient(sales1Token).put<ApiResponse<Payment>>(
      `/api/payments/${createdPaymentId}`,
      { amount: 40000 }
    );
    assertEqual(res.status, 200, 'HTTP 状态码');
    assertEqual(res.data.code, 0, '业务 code');
    assertEqual(res.data.data.amount, 40000, '收款金额已更新');
  });

  // ---------- 5. 数据权限验证 ----------
  console.log('\n[5] 数据权限验证');

  await runTest('sales1 看不到 sales2 的合同', async () => {
    // sales2 的合同是 HT-2024-003 (salesperson_id=3)
    const res = await createClient(sales1Token).get<ApiResponse<ContractDetail>>('/api/contracts/3');
    // sales1 (id=2) 不能访问 sales2 (id=3) 的合同
    assertEqual(res.status, 404, 'HTTP 状态码应为 404');
    assertEqual(res.data.code, 40400, '业务 code');
  });

  await runTest('sales1 无法修改 sales2 的合同', async () => {
    const res = await createClient(sales1Token).put('/api/contracts/3', {
      contract_name: '企图修改',
    });
    assertEqual(res.status, 404, 'HTTP 状态码应为 404');
    assertEqual(res.data.code, 40400, '业务 code');
  });

  await runTest('sales1 无法删除 sales2 的合同', async () => {
    const res = await createClient(sales1Token).delete('/api/contracts/3');
    assertEqual(res.status, 404, 'HTTP 状态码应为 404');
    assertEqual(res.data.code, 40400, '业务 code');
  });

  await runTest('admin 可以看到全部合同', async () => {
    const res = await createClient(adminToken).get<ApiResponse<ContractListData>>(
      '/api/contracts?page=1&pageSize=100'
    );
    assertEqual(res.status, 200, 'HTTP 状态码');
    assertEqual(res.data.code, 0, '业务 code');
    // admin 应能看到所有 3 个种子合同 + 1 个新建的
    assert(res.data.data.total >= 4, 'admin 应看到至少 4 个合同');
  });

  await runTest('admin 可以访问任何合同详情', async () => {
    // sales2 的合同 (HT-2024-003)
    const res = await createClient(adminToken).get<ApiResponse<ContractDetail>>('/api/contracts/3');
    assertEqual(res.status, 200, 'HTTP 状态码');
    assertEqual(res.data.code, 0, '业务 code');
    assertEqual(res.data.data.contract_no, 'HT-2024-003', '合同编号验证');
  });

  // ---------- 6. 删除测试数据 ----------
  console.log('\n[6] 清理测试数据');

  await runTest('删除测试合同 (CASCADE 删除关联开票和收款)', async () => {
    assert(createdContractId > 0, '需要有已创建的合同');
    const res = await createClient(sales1Token).delete(`/api/contracts/${createdContractId}`);
    assertEqual(res.status, 200, 'HTTP 状态码');
    assertEqual(res.data.code, 0, '业务 code');
    assertEqual(res.data.message, '合同删除成功', '删除成功消息');

    // 验证已删除
    const getRes = await createClient(sales1Token).get(`/api/contracts/${createdContractId}`);
    assertEqual(getRes.status, 404, '删除后查询应返回 404');
  });

  // ---------- 7. 边界测试 ----------
  console.log('\n[7] 边界测试');

  await runTest('新增合同 - 重复编号返回 409', async () => {
    const res = await createClient(sales1Token).post('/api/contracts', {
      contract_no: 'HT-2024-001',  // 已存在的编号
      contract_name: '重复合同测试',
      party: '测试公司',
      amount: 1000,
      signed_date: '2025-01-01',
    });
    assertEqual(res.status, 409, 'HTTP 状态码应为 409');
    assertEqual(res.data.code, 40900, '业务 code');
  });

  await runTest('新增合同 - 金额为负数返回 400', async () => {
    const res = await createClient(sales1Token).post('/api/contracts', {
      contract_no: `INVALID-AMT-${Date.now()}`,
      contract_name: '金额无效合同',
      party: '测试公司',
      amount: -100,
      signed_date: '2025-01-01',
    });
    assertEqual(res.status, 400, 'HTTP 状态码应为 400');
    assertEqual(res.data.code, 40000, '业务 code');
  });

  await runTest('新增合同 - 缺少必填字段返回 400', async () => {
    const res = await createClient(sales1Token).post('/api/contracts', {
      contract_name: '缺少字段合同',
    });
    assertEqual(res.status, 400, 'HTTP 状态码应为 400');
    assertEqual(res.data.code, 40000, '业务 code');
  });

  // ---------- 测试结果汇总 ----------
  const total = passedCount + failedCount;
  console.log('\n========================================');
  console.log('  测试结果汇总');
  console.log('========================================');
  console.log(`  总计: ${total}  |  通过: ${passedCount}  |  失败: ${failedCount}`);
  console.log('========================================\n');

  if (failures.length > 0) {
    console.log('失败测试明细:');
    failures.forEach((f) => console.log(`  - ${f.name}: ${f.error}`));
    console.log();
    process.exit(1);
  } else {
    console.log('🎉 所有测试通过!\n');
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('测试执行异常:', err);
  process.exit(1);
});

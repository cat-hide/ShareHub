/**
 * 全局配置（集中管理环境变量和常量）
 */

/** JWT 密钥 — 必须通过环境变量设置，不再使用硬编码 fallback */
export const JWT_SECRET: string = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('[FATAL] JWT_SECRET 环境变量未设置。请在 .env 文件中配置强随机密钥。');
    process.exit(1);
  }
  return secret;
})();

export const JWT_EXPIRES_IN = '7d';
export const PORT = parseInt(process.env.PORT || '3001', 10);

/** 文件上传目录 */
export const UPLOAD_DIR = (() => {
  const p = require('path');
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR;
  return p.join(__dirname, '..', 'uploads');
})();

/** 开票逾期天数阈值 */
export const OVERDUE_DAYS = parseInt(process.env.OVERDUE_DAYS || '60', 10);

/** Excel 导入路径（通过环境变量配置，不再硬编码个人桌面路径） */
export const EXCEL_IMPORT_PATH = process.env.EXCEL_IMPORT_PATH || '';

/** CORS 允许的来源（逗号分隔，留空表示允许所有） */
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '';

/** 附件上传大小限制 (50MB) */
export const UPLOAD_FILE_SIZE_LIMIT = 50 * 1024 * 1024;

import path from 'path';

/**
 * 附件预览支持的 MIME 类型映射（集中管理，避免各处重复）
 */
export const PREVIEW_MIME_TYPES: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

/**
 * Multer 允许上传的 MIME 类型
 */
export const ALLOWED_UPLOAD_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
];

/**
 * 修复中文文件名乱码（busboy 默认 latin1 编码到 node Buffer）
 */
export function fixFilenameEncoding(originalName: string): string {
  try {
    const decoded = Buffer.from(originalName, 'latin1').toString('utf8');
    // 如果原始没有中文但转换后出现了中文，说明 busboy 用了 latin1 编码
    if (/[\u4e00-\u9fa5]/.test(decoded) && !/[\u4e00-\u9fa5]/.test(originalName)) {
      return decoded;
    }
  } catch (_e) {
    // ignore encoding errors
  }
  return originalName;
}

/**
 * 防止路径遍历攻击
 * 验证 storage_name 不包含路径穿越字符
 */
export function isSafeStorageName(name: string): boolean {
  if (!name || name.includes('..') || path.isAbsolute(name) || name.includes('\\')) {
    return false;
  }
  return true;
}

/**
 * 获取文件预览 Content-Type
 */
export function getPreviewContentType(originalFileName: string): string {
  const ext = path.extname(originalFileName).toLowerCase();
  return PREVIEW_MIME_TYPES[ext] || 'application/octet-stream';
}

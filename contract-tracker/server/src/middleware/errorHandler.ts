import { Request, Response, NextFunction } from 'express';

/**
 * 统一错误处理中间件
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error]', err.message);
  console.error(err.stack);

  res.status(500).json({
    code: 50000,
    data: null,
    message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message,
  });
}

/**
 * 404 处理
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    code: 40400,
    data: null,
    message: '请求的资源不存在',
  });
}

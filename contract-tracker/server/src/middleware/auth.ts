import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';

export interface JwtPayload {
  id: number;
  role: string;
  username: string;
}

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * JWT 验证中间件
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 40100, data: null, message: '未登录' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;
    req.user = decoded;
    next();
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ code: 40101, data: null, message: '令牌过期' });
      return;
    }
    res.status(401).json({ code: 40100, data: null, message: '无效的令牌' });
  }
}

/**
 * 角色检查中间件
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ code: 40100, data: null, message: '未登录' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ code: 40300, data: null, message: '无权限' });
      return;
    }
    next();
  };
}

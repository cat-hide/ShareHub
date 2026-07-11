import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database';
import { authenticate } from '../middleware/auth';
import { JWT_SECRET } from '../config';

const router = Router();

/**
 * POST /api/auth/login - 用户登录
 */
router.post('/login', (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ code: 40000, data: null, message: '用户名和密码不能为空' });
    return;
  }

  const db = getDatabase();
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as {
    id: number;
    username: string;
    password: string;
    display_name: string;
    role: string;
  } | undefined;

  if (!user) {
    res.status(401).json({ code: 40100, data: null, message: '用户名或密码错误' });
    return;
  }

  const isPasswordValid = bcrypt.compareSync(password, user.password);
  if (!isPasswordValid) {
    res.status(401).json({ code: 40100, data: null, message: '用户名或密码错误' });
    return;
  }

  const token = jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    JWT_SECRET,
    { expiresIn: 604800 }
  );

  res.json({
    code: 0,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
      },
    },
    message: '登录成功',
  });
});

/**
 * GET /api/auth/me - 获取当前用户信息
 */
router.get('/me', authenticate, (req: Request, res: Response) => {
  const db = getDatabase();
  const user = db.prepare('SELECT id, username, display_name, role, created_at FROM users WHERE id = ?').get(req.user!.id) as {
    id: number;
    username: string;
    display_name: string;
    role: string;
    created_at: string;
  } | undefined;

  if (!user) {
    res.status(404).json({ code: 40400, data: null, message: '用户不存在' });
    return;
  }

  res.json({
    code: 0,
    data: user,
    message: 'ok',
  });
});

export default router;

import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../lib/mockDb';
import { createJWT } from '../../middleware/auth';

interface LoginRequest {
  username: string;
  password: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body as LoginRequest;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const admin = await mockDb.validateAdmin(username, password);

    if (!admin) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const token = createJWT({
      sub: admin.id,
      telegram_id: admin.telegram_id || 0,
      level: admin.level
    });

    await mockDb.updateAdminLastLogin(admin.id);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: admin.id,
        username: admin.username,
        display_name: admin.display_name,
        level: admin.level,
        permissions: admin.permissions
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: '登录失败，请稍后重试' });
  }
}

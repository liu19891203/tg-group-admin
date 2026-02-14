import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../../lib/mockDb';
import { verifyJWT } from '../../../middleware/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权' });
    }

    const token = authHeader.slice(7);
    const payload = verifyJWT(token);

    if (!payload) {
      return res.status(401).json({ error: 'Token 无效或已过期' });
    }

    const admin = await mockDb.findAdminById(payload.sub);

    if (!admin) {
      return res.status(404).json({ error: '用户不存在' });
    }

    return res.status(200).json({ 
      data: {
        id: admin.id,
        telegram_id: admin.telegram_id,
        username: admin.username,
        display_name: admin.display_name,
        level: admin.level,
        permissions: admin.permissions
      }
    });

  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({ error: '获取用户信息失败' });
  }
}

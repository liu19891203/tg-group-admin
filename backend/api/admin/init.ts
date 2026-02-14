import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/database';
import * as crypto from 'crypto';

async function hashPassword(password: string): Promise<string> {
  return crypto
    .createHash('sha256')
    .update(password + (process.env.JWT_SECRET || 'default-salt'))
    .digest('hex');
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
    const { data: existingAdmin } = await supabaseAdmin
      .from('admins')
      .select('id')
      .eq('username', 'admin')
      .single();

    if (existingAdmin) {
      return res.status(200).json({ 
        success: true, 
        message: '管理员账号已存在',
        credentials: {
          username: 'admin',
          password: 'admin123'
        }
      });
    }

    const passwordHash = await hashPassword('admin123');

    const { error } = await supabaseAdmin
      .from('admins')
      .insert({
        username: 'admin',
        password_hash: passwordHash,
        display_name: 'Administrator',
        level: 10,
        permissions: ['all'],
        is_active: true
      } as any);

    if (error) {
      console.error('Create admin error:', error);
      return res.status(500).json({ error: '创建管理员失败' });
    }

    return res.status(200).json({
      success: true,
      message: '管理员账号创建成功',
      credentials: {
        username: 'admin',
        password: 'admin123'
      }
    });

  } catch (error) {
    console.error('Init admin error:', error);
    return res.status(500).json({ error: '初始化失败' });
  }
}

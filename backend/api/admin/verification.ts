import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../lib/mockDb';

interface VerificationConfig {
  enabled: boolean;
  type: 'math' | 'image' | 'gif' | 'channel';
  timeout: number;
  punishment: 'kick' | 'ban' | 'mute';
  channel_id?: string;
  difficulty?: number;
  verification_message?: string;
  success_message?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权' });
    }

    if (req.method === 'GET') {
      // 获取验证配置
      const groupId = req.query.groupId as string;
      if (!groupId) {
        return res.status(400).json({ error: '群组ID不能为空' });
      }

      // 模拟获取群组配置
      const defaultConfig: VerificationConfig = {
        enabled: false,
        type: 'math',
        timeout: 300,
        punishment: 'kick',
        difficulty: 1,
        verification_message: '',
        success_message: ''
      };

      return res.status(200).json({ data: defaultConfig });

    } else if (req.method === 'POST' || req.method === 'PUT') {
      // 更新验证配置
      const { groupId, config } = req.body as {
        groupId: string;
        config: VerificationConfig;
      };

      if (!groupId || !config) {
        return res.status(400).json({ error: '参数不完整' });
      }

      // 验证配置格式
      if (!['math', 'image', 'gif', 'channel'].includes(config.type)) {
        return res.status(400).json({ error: '验证类型无效' });
      }

      if (config.type === 'channel' && !config.channel_id) {
        return res.status(400).json({ error: '频道验证需要指定频道ID' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '验证配置已更新',
        config 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Verification config error:', error);
    return res.status(500).json({ error: '操作失败' });
  }
}

import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../lib/mockDb';

interface AntiSpamConfig {
  enabled: boolean;
  max_messages: number;
  time_window: number;
  punishment: 'delete' | 'warn' | 'mute' | 'kick' | 'ban';
  mute_duration?: number;
  warn_limit?: number;
  check_duplicates: boolean;
  duplicate_threshold: number;
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
      const groupId = req.query.groupId as string;
      if (!groupId) {
        return res.status(400).json({ error: '群组ID不能为空' });
      }

      const defaultConfig: AntiSpamConfig = {
        enabled: false,
        max_messages: 5,
        time_window: 10,
        punishment: 'mute',
        mute_duration: 300,
        warn_limit: 3,
        check_duplicates: true,
        duplicate_threshold: 3
      };

      return res.status(200).json({ data: defaultConfig });

    } else if (req.method === 'POST' || req.method === 'PUT') {
      const { groupId, config } = req.body as {
        groupId: string;
        config: AntiSpamConfig;
      };

      if (!groupId || !config) {
        return res.status(400).json({ error: '参数不完整' });
      }

      // 验证配置格式
      if (config.max_messages < 1 || config.max_messages > 100) {
        return res.status(400).json({ error: '消息数量限制应在1-100之间' });
      }

      if (config.time_window < 1 || config.time_window > 300) {
        return res.status(400).json({ error: '时间窗口应在1-300秒之间' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '刷屏处理配置已更新',
        config 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Anti-spam config error:', error);
    return res.status(500).json({ error: '操作失败' });
  }
}

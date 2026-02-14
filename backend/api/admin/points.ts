import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../lib/mockDb';

interface PointsConfig {
  enabled: boolean;
  daily_limit: number;
  per_message: number;
  checkin_base: number;
  checkin_bonus: number[];
  rank_keyword: string;
}

interface UserPoints {
  user_id: string;
  telegram_id: number;
  username: string;
  display_name: string;
  total_points: number;
  today_points: number;
  checkin_streak: number;
  last_checkin: string;
  rank: number;
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

      const defaultConfig: PointsConfig = {
        enabled: true,
        daily_limit: 100,
        per_message: 0.2,
        checkin_base: 10,
        checkin_bonus: [2, 5, 10, 20],
        rank_keyword: '积分排行'
      };

      return res.status(200).json({ data: defaultConfig });

    } else if (req.method === 'POST' || req.method === 'PUT') {
      const { groupId, config } = req.body as {
        groupId: string;
        config: PointsConfig;
      };

      if (!groupId || !config) {
        return res.status(400).json({ error: '参数不完整' });
      }

      // 验证配置格式
      if (config.daily_limit < 0 || config.daily_limit > 1000) {
        return res.status(400).json({ error: '每日积分上限应在0-1000之间' });
      }

      if (config.per_message < 0 || config.per_message > 10) {
        return res.status(400).json({ error: '每条消息积分应在0-10之间' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '积分配置已更新',
        config 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Points config error:', error);
    return res.status(500).json({ error: '操作失败' });
  }
}

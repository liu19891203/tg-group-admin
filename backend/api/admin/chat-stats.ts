import { VercelRequest, VercelResponse } from '@vercel/node';

interface ChatStats {
  total_messages: number;
  total_members: number;
  active_members: number;
  messages_today: number;
  average_messages_per_day: number;
  top_posters: Array<{
    user_id: string;
    username: string;
    message_count: number;
  }>;
  activity_by_hour: number[];
  activity_by_day: number[];
}

interface StatsConfig {
  enabled: boolean;
  track_messages: boolean;
  track_members: boolean;
  retention_days: number;
  exclude_bots: boolean;
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

      // 模拟统计数据
      const stats: ChatStats = {
        total_messages: 125680,
        total_members: 1234,
        active_members: 456,
        messages_today: 892,
        average_messages_per_day: 756,
        top_posters: [
          { user_id: '1', username: 'Alice', message_count: 1256 },
          { user_id: '2', username: 'Bob', message_count: 987 },
          { user_id: '3', username: 'Charlie', message_count: 756 },
          { user_id: '4', username: 'David', message_count: 654 },
          { user_id: '5', username: 'Eve', message_count: 543 }
        ],
        activity_by_hour: [
          12, 15, 8, 5, 3, 2, 4, 8, 25, 45, 67, 89,
          98, 87, 76, 65, 78, 89, 92, 85, 78, 56, 34, 18
        ],
        activity_by_day: [156, 178, 189, 167, 145, 123, 98]
      };

      const config: StatsConfig = {
        enabled: true,
        track_messages: true,
        track_members: true,
        retention_days: 30,
        exclude_bots: true
      };

      return res.status(200).json({ 
        data: {
          stats,
          config
        }
      });

    } else if (req.method === 'POST' || req.method === 'PUT') {
      const { groupId, config } = req.body as {
        groupId: string;
        config: StatsConfig;
      };

      if (!groupId || !config) {
        return res.status(400).json({ error: '参数不完整' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '统计配置已更新',
        config 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Chat stats error:', error);
    return res.status(500).json({ error: '操作失败' });
  }
}

import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../lib/mockDb';

interface LotteryConfig {
  enabled: boolean;
  type: 'basic' | 'points' | 'lotto';
  title: string;
  description: string;
  prize: string;
  prize_image?: string;
  total_winners: number;
  points_cost?: number;
  start_time: string;
  end_time: string;
  conditions: {
    follow_channel?: string;
    min_messages?: number;
    join_group_days?: number;
    must_have_username?: boolean;
  };
  status: 'draft' | 'active' | 'ended';
}

interface LotteryParticipant {
  user_id: string;
  telegram_id: number;
  username: string;
  display_name: string;
  tickets: number;
  joined_at: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
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
      const lotteryId = req.query.lotteryId as string;
      
      if (!groupId) {
        return res.status(400).json({ error: '群组ID不能为空' });
      }

      // 模拟抽奖列表
      const lotteries: LotteryConfig[] = [
        {
          enabled: true,
          type: 'basic',
          title: '新用户欢迎抽奖',
          description: '欢迎新用户加入群组，参与抽奖赢取精美礼品！',
          prize: '精美礼品一份',
          total_winners: 3,
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          conditions: {
            follow_channel: '@example_channel',
            min_messages: 5
          },
          status: 'active'
        },
        {
          enabled: true,
          type: 'points',
          title: '积分大抽奖',
          description: '使用积分参与抽奖，赢取丰厚奖励！',
          prize: '100积分',
          total_winners: 5,
          points_cost: 10,
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          conditions: {},
          status: 'active'
        },
        {
          enabled: true,
          type: 'lotto',
          title: '乐透大奖',
          description: '选择你的幸运数字，赢取超级大奖！',
          prize: '神秘大奖',
          total_winners: 1,
          start_time: new Date().toISOString(),
          end_time: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          conditions: {
            follow_channel: '@example_channel',
            must_have_username: true
          },
          status: 'active'
        }
      ];

      return res.status(200).json({ 
        data: lotteries,
        total: lotteries.length 
      });

    } else if (req.method === 'POST') {
      // 创建新抽奖
      const { groupId, lottery } = req.body as {
        groupId: string;
        lottery: LotteryConfig;
      };

      if (!groupId || !lottery) {
        return res.status(400).json({ error: '参数不完整' });
      }

      // 验证抽奖配置
      if (!lottery.title || !lottery.prize) {
        return res.status(400).json({ error: '抽奖标题和奖品不能为空' });
      }

      if (lottery.type === 'points' && !lottery.points_cost) {
        return res.status(400).json({ error: '积分抽奖需要设置积分消耗' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '抽奖创建成功',
        lottery: { 
          ...lottery, 
          id: Math.random().toString(36).substr(2, 9),
          status: 'draft'
        }
      });

    } else if (req.method === 'PUT') {
      // 更新抽奖
      const { groupId, lotteryId, updates } = req.body as {
        groupId: string;
        lotteryId: string;
        updates: Partial<LotteryConfig>;
      };

      if (!groupId || !lotteryId) {
        return res.status(400).json({ error: '参数不完整' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '抽奖更新成功'
      });

    } else if (req.method === 'DELETE') {
      // 删除抽奖
      const { groupId, lotteryId } = req.body as {
        groupId: string;
        lotteryId: string;
      };

      if (!groupId || !lotteryId) {
        return res.status(400).json({ error: '参数不完整' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '抽奖删除成功'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Lottery config error:', error);
    return res.status(500).json({ error: '操作失败' });
  }
}

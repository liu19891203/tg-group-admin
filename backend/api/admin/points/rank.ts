import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../../lib/mockDb';

interface RankRequest {
  groupId: string;
  limit?: number;
  period?: 'today' | 'week' | 'month' | 'all';
}

interface UserRank {
  rank: number;
  user_id: string;
  telegram_id: number;
  username: string;
  display_name: string;
  total_points: number;
  today_points: number;
  checkin_streak: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { groupId, limit = 10, period = 'all' } = req.body as RankRequest;

    if (!groupId) {
      return res.status(400).json({ error: '群组ID不能为空' });
    }

    // 模拟用户积分数据
    const mockUsers: UserRank[] = [
      {
        rank: 1,
        user_id: 'user1',
        telegram_id: 123456789,
        username: 'top_user',
        display_name: '积分达人',
        total_points: 1500,
        today_points: 50,
        checkin_streak: 7
      },
      {
        rank: 2,
        user_id: 'user2',
        telegram_id: 987654321,
        username: 'active_member',
        display_name: '活跃成员',
        total_points: 1200,
        today_points: 45,
        checkin_streak: 5
      },
      {
        rank: 3,
        user_id: 'user3',
        telegram_id: 555555555,
        username: 'regular_user',
        display_name: '普通用户',
        total_points: 800,
        today_points: 30,
        checkin_streak: 3
      },
      {
        rank: 4,
        user_id: 'user4',
        telegram_id: 111111111,
        username: 'newbie',
        display_name: '新成员',
        total_points: 300,
        today_points: 20,
        checkin_streak: 1
      },
      {
        rank: 5,
        user_id: 'user5',
        telegram_id: 222222222,
        username: 'casual_user',
        display_name: '休闲用户',
        total_points: 250,
        today_points: 15,
        checkin_streak: 2
      }
    ];

    // 根据时间段筛选数据
    let filteredUsers = mockUsers;
    if (period === 'today') {
      filteredUsers = mockUsers.map(user => ({
        ...user,
        total_points: user.today_points
      })).sort((a, b) => b.total_points - a.total_points);
    }

    // 设置排名
    filteredUsers = filteredUsers
      .slice(0, limit)
      .map((user, index) => ({
        ...user,
        rank: index + 1
      }));

    return res.status(200).json({
      success: true,
      period,
      limit,
      total_users: mockUsers.length,
      ranks: filteredUsers
    });

  } catch (error) {
    console.error('Rank error:', error);
    return res.status(500).json({ error: '获取排行榜失败' });
  }
}

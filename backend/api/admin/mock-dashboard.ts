import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock 仪表盘数据
const mockDashboardData = {
  total_groups: 5,
  total_users: 1280,
  total_messages: 56800,
  total_points_issued: 25600,
  active_groups: 4,
  new_users_today: 23,
  messages_today: 1250,
  top_groups: [
    { id: '1', title: '测试群组1', member_count: 500 },
    { id: '2', title: '测试群组2', member_count: 350 },
    { id: '3', title: '测试群组3', member_count: 280 },
    { id: '4', title: '测试群组4', member_count: 150 }
  ],
  recent_activity: [
    { id: '1', action: '用户加入', target_type: 'user', target_id: '123456', created_at: '2024-01-15T10:30:00Z' },
    { id: '2', action: '消息发送', target_type: 'message', target_id: '789012', created_at: '2024-01-15T10:25:00Z' },
    { id: '3', action: '积分奖励', target_type: 'points', target_id: '345678', created_at: '2024-01-15T10:20:00Z' },
    { id: '4', action: '签到完成', target_type: 'checkin', target_id: '901234', created_at: '2024-01-15T10:15:00Z' },
    { id: '5', action: '用户离开', target_type: 'user', target_id: '567890', created_at: '2024-01-15T10:10:00Z' }
  ]
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        return res.status(200).json({
          success: true,
          data: mockDashboardData
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

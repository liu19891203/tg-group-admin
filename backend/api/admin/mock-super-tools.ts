import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock 超级工具数据
const mockStatus = {
  deleted_accounts_count: 5,
  old_messages_count: 1280,
  last_cleanup: '2024-01-15 10:30:00'
};

const mockLogs = [
  {
    id: '1',
    action: 'delete_history',
    params: { days: 7 },
    result: { deleted_count: 150, failed_count: 0 },
    created_at: '2024-01-15T10:30:00Z'
  },
  {
    id: '2',
    action: 'kick_deleted_accounts',
    params: {},
    result: { kicked_count: 3, failed_count: 0 },
    created_at: '2024-01-14T15:20:00Z'
  },
  {
    id: '3',
    action: 'clean_inactive',
    params: { inactive_days: 30 },
    result: { kicked_count: 12, failed_count: 1 },
    created_at: '2024-01-13T09:00:00Z'
  }
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    switch (req.method) {
      case 'GET':
        if (action === 'logs') {
          return res.status(200).json({
            success: true,
            data: mockLogs
          });
        }
        return res.status(200).json({
          success: true,
          data: mockStatus
        });

      case 'POST':
        const { action: toolAction, params } = req.body || {};
        
        let result: any = {};
        
        switch (toolAction) {
          case 'delete_history':
            result = { deleted_count: 150, failed_count: 0 };
            break;
          case 'kick_deleted_accounts':
            result = { kicked_count: 5, failed_count: 0 };
            break;
          case 'clean_inactive':
            result = { kicked_count: 10, failed_count: 1 };
            break;
          default:
            result = { message: '操作完成' };
        }
        
        return res.status(200).json({
          success: true,
          data: result
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Super tools API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

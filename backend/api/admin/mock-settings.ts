import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock 管理员列表
const mockAdmins = [
  {
    id: '1',
    user_id: '123456789',
    username: 'admin1',
    first_name: '管理员',
    last_name: '一号',
    role: 'super_admin',
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: '2',
    user_id: '987654321',
    username: 'admin2',
    first_name: '管理员',
    last_name: '二号',
    role: 'admin',
    created_at: '2024-01-10T00:00:00Z'
  }
];

// Mock 通用设置
const mockGeneralSettings = {
  bot_name: '群管机器人',
  welcome_message: '欢迎加入群组！',
  auto_delete_commands: true,
  maintenance_mode: false
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  try {
    switch (req.method) {
      case 'GET':
        // 获取管理员列表
        return res.status(200).json({
          success: true,
          data: mockAdmins
        });

      case 'POST':
        // 添加管理员或保存设置
        if (req.body && req.body.user_id) {
          // 添加管理员
          const newAdmin = {
            id: String(mockAdmins.length + 1),
            ...req.body,
            created_at: new Date().toISOString()
          };
          mockAdmins.push(newAdmin);
          return res.status(200).json({
            success: true,
            data: newAdmin
          });
        } else {
          // 保存通用设置
          return res.status(200).json({
            success: true,
            data: { ...mockGeneralSettings, ...req.body }
          });
        }

      case 'DELETE':
        // 删除管理员
        if (id) {
          const index = mockAdmins.findIndex(a => a.id === id);
          if (index > -1) {
            mockAdmins.splice(index, 1);
          }
        }
        return res.status(200).json({
          success: true,
          message: '管理员已删除'
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Settings API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

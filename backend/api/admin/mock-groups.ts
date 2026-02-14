import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock 群组数据
const mockGroups = [
  {
    id: 'demo-1',
    chat_id: -1001234567890,
    title: '测试群组1',
    username: 'test_group_1',
    chat_type: 'supergroup',
    is_active: true,
    member_count: 500,
    message_count: 12500,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-15T10:30:00Z'
  },
  {
    id: 'demo-2',
    chat_id: -1001234567891,
    title: '测试群组2',
    username: 'test_group_2',
    chat_type: 'supergroup',
    is_active: true,
    member_count: 350,
    message_count: 8200,
    created_at: '2024-01-05T00:00:00Z',
    updated_at: '2024-01-14T15:20:00Z'
  }
];

// Mock 群组管理员数据
const mockGroupAdmins: Record<string, any[]> = {
  'demo-1': [
    {
      id: '1',
      user_id: '123456789',
      username: 'admin1',
      first_name: '管理员',
      last_name: '一号',
      role: 'super_admin',
      permissions: ['*'],
      created_at: '2024-01-01T00:00:00Z'
    },
    {
      id: '2',
      user_id: '987654321',
      username: 'admin2',
      first_name: '管理员',
      last_name: '二号',
      role: 'admin',
      permissions: ['manage_messages', 'manage_users'],
      created_at: '2024-01-10T00:00:00Z'
    }
  ],
  'demo-2': [
    {
      id: '3',
      user_id: '111222333',
      username: 'admin3',
      first_name: '管理员',
      last_name: '三号',
      role: 'admin',
      permissions: ['manage_messages'],
      created_at: '2024-01-05T00:00:00Z'
    }
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

  const { pathname } = new URL(req.url || '', `http://localhost:3000`);
  
  // 解析路径参数
  // /api/admin/groups -> 群组列表
  // /api/admin/groups/:id -> 单个群组
  // /api/admin/groups/:id/admins -> 群组管理员
  // /api/admin/groups/:id/toggle -> 切换群组状态
  
  const pathMatch = pathname.match(/\/api\/admin\/groups(?:\/([\w-]+))?(?:\/(admins|toggle))?/);
  
  if (!pathMatch) {
    return res.status(404).json({ error: 'Not found', pathname });
  }
  
  const groupId = pathMatch[1];
  const subResource = pathMatch[2];

  try {
    switch (req.method) {
      case 'GET':
        if (!groupId) {
          // 获取群组列表
          return res.status(200).json({
            success: true,
            data: mockGroups,
            total: mockGroups.length,
            page: 1,
            limit: 20
          });
        } else if (subResource === 'admins') {
          // 获取群组管理员列表
          const admins = mockGroupAdmins[groupId] || [];
          return res.status(200).json({
            success: true,
            data: admins
          });
        } else {
          // 获取单个群组
          const group = mockGroups.find(g => g.id === groupId);
          if (!group) {
            return res.status(404).json({ error: 'Group not found' });
          }
          return res.status(200).json({
            success: true,
            data: group
          });
        }

      case 'POST':
        if (subResource === 'toggle' && groupId) {
          // 切换群组状态
          const group = mockGroups.find(g => g.id === groupId);
          if (group) {
            group.is_active = !group.is_active;
            return res.status(200).json({
              success: true,
              data: group
            });
          }
          return res.status(404).json({ error: 'Group not found' });
        }
        // 创建新群组
        return res.status(201).json({
          success: true,
          data: { id: 'new-group', ...req.body }
        });

      case 'PUT':
        if (groupId) {
          const group = mockGroups.find(g => g.id === groupId);
          if (!group) {
            return res.status(404).json({ error: 'Group not found' });
          }
          // 更新管理员权限
          if (subResource === 'admins' && req.body.adminId) {
            const admins = mockGroupAdmins[groupId] || [];
            const admin = admins.find(a => a.id === req.body.adminId);
            if (admin) {
              admin.permissions = req.body.permissions || admin.permissions;
              return res.status(200).json({
                success: true,
                data: admin
              });
            }
            return res.status(404).json({ error: 'Admin not found' });
          }
          // 更新群组
          return res.status(200).json({
            success: true,
            data: { ...group, ...req.body }
          });
        }
        return res.status(400).json({ error: 'Group ID required' });

      case 'DELETE':
        if (groupId && subResource === 'admins') {
          // 删除管理员
          const admins = mockGroupAdmins[groupId];
          if (admins) {
            const index = admins.findIndex(a => a.id === req.query.adminId);
            if (index > -1) {
              admins.splice(index, 1);
            }
          }
          return res.status(200).json({
            success: true,
            message: 'Admin removed'
          });
        }
        if (groupId) {
          // 删除群组
          return res.status(200).json({
            success: true,
            message: 'Group deleted'
          });
        }
        return res.status(400).json({ error: 'Group ID required' });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Groups API error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

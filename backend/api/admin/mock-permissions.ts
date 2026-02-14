import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../lib/mockDb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action } = req.query;

    if (action === 'matrix') {
      return await getPermissionMatrix(req, res);
    }

    if (action === 'batch-update') {
      return await batchUpdatePermissions(req, res);
    }

    if (action === 'roles') {
      return await getRoles(req, res);
    }

    switch (req.method) {
      case 'GET':
        return await getPermissions(req, res);
      case 'POST':
      case 'PUT':
        return await updatePermissions(req, res);
      case 'DELETE':
        return await removeAdmin(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Mock Permissions API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 获取权限矩阵
async function getPermissionMatrix(req: VercelRequest, res: VercelResponse) {
  try {
    const matrixData = mockDb.getPermissionMatrix();

    return res.status(200).json({
      success: true,
      data: matrixData
    });

  } catch (error: any) {
    console.error('Get permission matrix error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 获取角色列表
async function getRoles(req: VercelRequest, res: VercelResponse) {
  try {
    const roles = [
      {
        id: 'super_admin',
        name: '最高管理员',
        description: '拥有所有权限，可以管理其他管理员',
        level: 10,
        permissions: ['*']
      },
      {
        id: 'admin',
        name: '管理员',
        description: '拥有大部分管理权限',
        level: 8,
        permissions: ['manage_settings', 'manage_members', 'view_logs', 'send_messages']
      },
      {
        id: 'moderator',
        name: '版主',
        description: '拥有基础管理权限',
        level: 5,
        permissions: ['view_logs', 'manage_keywords', 'delete_messages']
      },
      {
        id: 'member',
        name: '成员',
        description: '普通成员权限',
        level: 1,
        permissions: ['view_stats', 'participate_lottery']
      }
    ];

    return res.status(200).json({
      success: true,
      data: roles
    });

  } catch (error: any) {
    console.error('Get roles error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 批量更新权限
async function batchUpdatePermissions(req: VercelRequest, res: VercelResponse) {
  try {
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: '缺少更新数据'
      });
    }

    console.log('Mock: 批量更新权限:', updates);

    return res.status(200).json({
      success: true,
      data: {
        updated_count: updates.length,
        message: '权限更新成功'
      }
    });

  } catch (error: any) {
    console.error('Batch update permissions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 获取权限配置（简化版）
async function getPermissions(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id } = req.query;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    const mockData = {
      owner_id: 123456789,
      admins: [
        {
          telegram_user_id: 123456789,
          username: 'admin_user',
          first_name: 'Admin',
          last_name: 'User',
          is_owner: true,
          is_anonymous: false,
          can_manage_chat: true,
          can_delete_messages: true,
          can_restrict_members: true,
          can_promote_members: true,
          can_change_info: true,
          can_invite_users: true,
          bot_permissions: {
            can_manage_settings: true,
            can_manage_admins: true,
            can_manage_auto_delete: true,
            can_manage_auto_ban: true,
            can_manage_keywords: true,
            can_view_logs: true,
            can_send_messages: true,
            can_manage_members: true,
            can_view_stats: true
          },
          added_at: new Date().toISOString()
        }
      ],
      templates: []
    };

    return res.status(200).json({
      success: true,
      data: mockData
    });

  } catch (error: any) {
    console.error('Get permissions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 更新权限（简化版）
async function updatePermissions(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, telegram_user_id, permissions } = req.body;

    if (!group_id || !telegram_user_id) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    console.log('Mock: 更新权限', { group_id, telegram_user_id, permissions });

    return res.status(200).json({
      success: true,
      data: {
        id: 'mock_id',
        group_id,
        telegram_user_id,
        permissions,
        updated_at: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('Update permissions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 移除管理员（简化版）
async function removeAdmin(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, telegram_user_id } = req.query;

    if (!group_id || !telegram_user_id) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    console.log('Mock: 移除管理员', { group_id, telegram_user_id });

    return res.status(200).json({
      success: true,
      data: { message: '管理员已移除' }
    });

  } catch (error: any) {
    console.error('Remove admin error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
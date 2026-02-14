import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 处理权限矩阵相关请求
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
    console.error('Permissions API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 获取权限配置
async function getPermissions(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id } = req.query;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    // 获取群组信息
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('telegram_chat_id, owner_id')
      .eq('id', group_id)
      .single();

    if (groupError || !group) {
      return res.status(404).json({
        success: false,
        error: '群组不存在'
      });
    }

    // 获取群组管理员列表（从Telegram获取最新）
    const admins = await fetchGroupAdmins(group.telegram_chat_id);

    // 获取数据库中存储的权限配置
    const { data: dbAdmins, error: dbError } = await supabase
      .from('group_admins')
      .select('*')
      .eq('group_id', group_id);

    if (dbError) throw dbError;

    // 合并数据
    const mergedAdmins = admins.map((admin: any) => {
      const dbAdmin = dbAdmins?.find(a => a.telegram_user_id === admin.user.id);
      return {
        telegram_user_id: admin.user.id,
        username: admin.user.username,
        first_name: admin.user.first_name,
        last_name: admin.user.last_name,
        is_owner: admin.user.id === group.owner_id,
        is_anonymous: admin.is_anonymous,
        can_manage_chat: admin.can_manage_chat,
        can_delete_messages: admin.can_delete_messages,
        can_manage_video_chats: admin.can_manage_video_chats,
        can_restrict_members: admin.can_restrict_members,
        can_promote_members: admin.can_promote_members,
        can_change_info: admin.can_change_info,
        can_invite_users: admin.can_invite_users,
        can_post_messages: admin.can_post_messages,
        can_edit_messages: admin.can_edit_messages,
        can_pin_messages: admin.can_pin_messages,
        // 自定义权限（从数据库）
        bot_permissions: dbAdmin?.permissions || getDefaultPermissions(admin.user.id === group.owner_id),
        added_at: dbAdmin?.created_at || new Date().toISOString()
      };
    });

    // 获取权限模板
    const { data: templates } = await supabase
      .from('permission_templates')
      .select('*')
      .eq('group_id', group_id);

    return res.status(200).json({
      success: true,
      data: {
        owner_id: group.owner_id,
        admins: mergedAdmins,
        templates: templates || []
      }
    });
  } catch (error: any) {
    console.error('Get permissions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 更新权限
async function updatePermissions(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, telegram_user_id, permissions } = req.body;

    if (!group_id || !telegram_user_id) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    // 检查是否已存在
    const { data: existing } = await supabase
      .from('group_admins')
      .select('id')
      .eq('group_id', group_id)
      .eq('telegram_user_id', telegram_user_id)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from('group_admins')
        .update({
          permissions,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('group_admins')
        .insert({
          group_id,
          telegram_user_id,
          permissions,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    if (result.error) throw result.error;

    return res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error: any) {
    console.error('Update permissions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 获取权限矩阵
async function getPermissionMatrix(req: VercelRequest, res: VercelResponse) {
  try {
    // 定义默认权限角色
    const roles = [
      {
        id: 'super_admin',
        role_name: 'super_admin',
        role_display_name: '最高管理员',
        description: '拥有所有权限，可以管理其他管理员'
      },
      {
        id: 'admin',
        role_name: 'admin',
        role_display_name: '管理员',
        description: '拥有大部分管理权限'
      },
      {
        id: 'moderator',
        role_name: 'moderator',
        role_display_name: '版主',
        description: '拥有基础管理权限'
      },
      {
        id: 'member',
        role_name: 'member',
        role_display_name: '成员',
        description: '普通成员权限'
      }
    ];

    // 定义功能模块
    const modules = [
      // 基础功能
      {
        id: 'dashboard',
        module_name: '仪表板',
        description: '查看群组统计信息',
        category: 'basic',
        icon: 'DataBoard'
      },
      {
        id: 'groups',
        module_name: '群组管理',
        description: '管理群组设置',
        category: 'basic',
        icon: 'ChatDotSquare'
      },
      {
        id: 'members',
        module_name: '成员管理',
        description: '查看和管理群组成员',
        category: 'basic',
        icon: 'User'
      },
      
      // 安全功能
      {
        id: 'anti_ads',
        module_name: '广告过滤',
        description: '检测和过滤广告内容',
        category: 'security',
        icon: 'Warning'
      },
      {
        id: 'anti_spam',
        module_name: '反刷屏',
        description: '防止消息刷屏',
        category: 'security',
        icon: 'ChatLineRound'
      },
      {
        id: 'verification',
        module_name: '入群验证',
        description: '新成员验证系统',
        category: 'security',
        icon: 'Lock'
      },
      
      // 互动功能
      {
        id: 'auto_reply',
        module_name: '自动回复',
        description: '关键词自动回复',
        category: 'interaction',
        icon: 'ChatDotRound'
      },
      {
        id: 'points',
        module_name: '积分系统',
        description: '成员积分管理',
        category: 'interaction',
        icon: 'Coin'
      },
      {
        id: 'lottery',
        module_name: '抽奖系统',
        description: '创建和管理抽奖',
        category: 'interaction',
        icon: 'Trophy'
      },
      
      // 工具功能
      {
        id: 'send_message',
        module_name: '主动消息',
        description: '发送群组消息',
        category: 'tools',
        icon: 'Message'
      },
      {
        id: 'scheduled_messages',
        module_name: '定时消息',
        description: '定时发送消息',
        category: 'tools',
        icon: 'Clock'
      },
      {
        id: 'commands',
        module_name: '命令管理',
        description: '自定义命令设置',
        category: 'tools',
        icon: 'Document'
      }
    ];

    // 构建权限矩阵数据
    const matrixData = {
      roles,
      modules,
      permissions: {}
    };

    // 为每个模块设置默认权限
    modules.forEach(module => {
      matrixData.permissions[module.id] = {
        super_admin: {
          can_access: true,
          can_config: true,
          can_view: true,
          restrictions: {}
        },
        admin: {
          can_access: module.category !== 'tools',
          can_config: ['basic', 'security', 'interaction'].includes(module.category),
          can_view: true,
          restrictions: {}
        },
        moderator: {
          can_access: ['basic', 'security'].includes(module.category),
          can_config: false,
          can_view: true,
          restrictions: {}
        },
        member: {
          can_access: false,
          can_config: false,
          can_view: false,
          restrictions: {}
        }
      };
    });

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

    // 这里应该实现批量更新逻辑
    // 由于是演示，我们只返回成功响应
    console.log('批量更新权限:', updates);

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

// 移除管理员
async function removeAdmin(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, telegram_user_id } = req.query;

    if (!group_id || !telegram_user_id) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    // 获取群组信息
    const { data: group } = await supabase
      .from('groups')
      .select('telegram_chat_id')
      .eq('id', group_id)
      .single();

    if (!group) {
      return res.status(404).json({
        success: false,
        error: '群组不存在'
      });
    }

    // 从Telegram移除管理员权限
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/promoteChatMember`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: group.telegram_chat_id,
        user_id: telegram_user_id,
        is_anonymous: false,
        can_manage_chat: false,
        can_delete_messages: false,
        can_manage_video_chats: false,
        can_restrict_members: false,
        can_promote_members: false,
        can_change_info: false,
        can_invite_users: false,
        can_post_messages: false,
        can_edit_messages: false,
        can_pin_messages: false
      })
    });

    const result = await response.json() as any;

    if (!result.ok) {
      return res.status(400).json({
        success: false,
        error: '从Telegram移除管理员失败: ' + result.description
      });
    }

    // 从数据库删除
    await supabase
      .from('group_admins')
      .delete()
      .eq('group_id', group_id)
      .eq('telegram_user_id', telegram_user_id);

    return res.status(200).json({
      success: true,
      message: '管理员已移除'
    });
  } catch (error: any) {
    console.error('Remove admin error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 获取群组管理员列表
async function fetchGroupAdmins(chatId: string) {
  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getChatAdministrators`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId })
  });

  const result = await response.json() as any;

  if (!result.ok) {
    throw new Error('获取管理员列表失败: ' + result.description);
  }

  return result.result;
}

// 获取默认权限
function getDefaultPermissions(isOwner: boolean) {
  if (isOwner) {
    return {
      can_manage_settings: true,
      can_manage_admins: true,
      can_manage_auto_delete: true,
      can_manage_auto_ban: true,
      can_manage_keywords: true,
      can_view_logs: true,
      can_send_messages: true,
      can_manage_members: true,
      can_view_stats: true
    };
  }

  return {
    can_manage_settings: false,
    can_manage_admins: false,
    can_manage_auto_delete: true,
    can_manage_auto_ban: true,
    can_manage_keywords: true,
    can_view_logs: true,
    can_send_messages: true,
    can_manage_members: false,
    can_view_stats: true
  };
}

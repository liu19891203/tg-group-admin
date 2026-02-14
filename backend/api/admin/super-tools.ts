import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getSuperToolsStatus(req, res);
      case 'POST':
        return await executeSuperTool(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Super tools API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 获取超级工具状态
async function getSuperToolsStatus(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id } = req.query;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    // 获取已删除账户数量
    const { data: deletedAccounts, error: deletedError } = await supabase
      .from('group_members')
      .select('id', { count: 'exact' })
      .eq('group_id', group_id)
      .eq('is_deleted_account', true);

    // 获取可清理的历史消息数量
    const { data: oldMessages, error: messagesError } = await supabase
      .from('chat_messages')
      .select('id', { count: 'exact' })
      .eq('group_id', group_id)
      .lt('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    return res.status(200).json({
      success: true,
      data: {
        deleted_accounts_count: deletedAccounts?.length || 0,
        old_messages_count: oldMessages?.length || 0,
        last_cleanup: null // 可以从操作日志中获取
      }
    });
  } catch (error: any) {
    console.error('Get super tools status error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 执行超级工具
async function executeSuperTool(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, action, params = {} } = req.body;

    if (!group_id || !action) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    // 获取群组信息
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('telegram_chat_id')
      .eq('id', group_id)
      .single();

    if (groupError || !group) {
      return res.status(404).json({
        success: false,
        error: '群组不存在'
      });
    }

    let result;

    switch (action) {
      case 'delete_history':
        result = await deleteHistoryMessages(group.telegram_chat_id, params);
        break;
      case 'kick_deleted_accounts':
        result = await kickDeletedAccounts(group_id, group.telegram_chat_id);
        break;
      case 'clean_inactive':
        result = await cleanInactiveMembers(group_id, group.telegram_chat_id, params);
        break;
      default:
        return res.status(400).json({
          success: false,
          error: '未知操作'
        });
    }

    // 记录操作日志
    await supabase
      .from('super_tools_logs')
      .insert({
        group_id,
        action,
        params,
        result,
        created_at: new Date().toISOString()
      });

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Execute super tool error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 删除历史消息
async function deleteHistoryMessages(chatId: string, params: any) {
  const { days = 7, user_id, message_type } = params;
  
  // 计算截止日期
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  
  // 从数据库获取要删除的消息
  let query = supabase
    .from('chat_messages')
    .select('telegram_message_id')
    .eq('telegram_chat_id', chatId)
    .lt('created_at', cutoffDate.toISOString());

  if (user_id) {
    query = query.eq('telegram_user_id', user_id);
  }

  if (message_type) {
    query = query.eq('message_type', message_type);
  }

  const { data: messages, error } = await query.limit(100);

  if (error) throw error;

  let deletedCount = 0;
  let failedCount = 0;

  // 批量删除消息
  for (const message of messages || []) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_id: message.telegram_message_id
        })
      });

      const result = await response.json() as any;

      if (result.ok) {
        deletedCount++;
        // 从数据库删除记录
        await supabase
          .from('chat_messages')
          .delete()
          .eq('telegram_message_id', message.telegram_message_id);
      } else {
        failedCount++;
      }
    } catch (err) {
      failedCount++;
    }
  }

  return {
    action: 'delete_history',
    deleted_count: deletedCount,
    failed_count: failedCount,
    total_processed: (messages || []).length
  };
}

// 踢出已删除账户
async function kickDeletedAccounts(groupId: string, chatId: string) {
  // 获取已删除账户列表
  const { data: deletedAccounts, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .eq('is_deleted_account', true);

  if (error) throw error;

  let kickedCount = 0;
  let failedCount = 0;

  for (const account of deletedAccounts || []) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/banChatMember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          user_id: account.telegram_user_id,
          revoke_messages: false
        })
      });

      const result = await response.json() as any;

      if (result.ok) {
        kickedCount++;
        // 从数据库删除成员记录
        await supabase
          .from('group_members')
          .delete()
          .eq('id', account.id);
      } else {
        failedCount++;
      }
    } catch (err) {
      failedCount++;
    }
  }

  return {
    action: 'kick_deleted_accounts',
    kicked_count: kickedCount,
    failed_count: failedCount,
    total_processed: (deletedAccounts || []).length
  };
}

// 清理不活跃成员
async function cleanInactiveMembers(groupId: string, chatId: string, params: any) {
  const { inactive_days = 30 } = params;
  
  const cutoffDate = new Date(Date.now() - inactive_days * 24 * 60 * 60 * 1000);
  
  // 获取不活跃成员
  const { data: inactiveMembers, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .lt('last_activity_at', cutoffDate.toISOString())
    .eq('role', 'member'); // 只清理普通成员

  if (error) throw error;

  let kickedCount = 0;
  let failedCount = 0;

  for (const member of inactiveMembers || []) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/kickChatMember`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          user_id: member.telegram_user_id
        })
      });

      const result = await response.json() as any;

      if (result.ok) {
        kickedCount++;
        // 更新成员状态
        await supabase
          .from('group_members')
          .delete()
          .eq('id', member.id);
      } else {
        failedCount++;
      }
    } catch (err) {
      failedCount++;
    }
  }

  return {
    action: 'clean_inactive',
    kicked_count: kickedCount,
    failed_count: failedCount,
    total_processed: (inactiveMembers || []).length,
    inactive_days
  };
}

// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/database';
import { cacheManager } from '../../lib/cache';
import { TelegramUpdate, TelegramChatMemberUpdated } from '../types/telegram';
import { verificationService } from '../services/verificationService';
import { sendMessage, restrictChatMember } from '../../lib/api';

export async function handleChatMember(req: VercelRequest, res: VercelResponse) {
  try {
    const update = req.body as TelegramUpdate;
    const chatMemberUpdate = update.chat_member || update.my_chat_member;

    if (!chatMemberUpdate) {
      return res.status(200).json({ handled: false, reason: 'No chat member update' });
    }

    const chat = chatMemberUpdate.chat;
    const user = chatMemberUpdate.from;
    const oldStatus = chatMemberUpdate.old_chat_member?.status;
    const newStatus = chatMemberUpdate.new_chat_member?.status;

    console.log(`Chat member update in ${chat.id}: ${oldStatus} -> ${newStatus} for user ${user.id}`);

    const group = await cacheManager.getGroup(chat.id);
    if (!group) {
      return res.status(200).json({ handled: false, reason: 'Group not found' });
    }

    if (newStatus === 'member' && (!oldStatus || oldStatus === 'left')) {
      await handleUserJoin(group.id, chat.id, user, group);
    } else if (newStatus === 'kicked' || newStatus === 'left') {
      await handleUserLeave(group.id, chat.id, user);
    } else if (newStatus === 'administrator' || newStatus === 'creator') {
      await handleAdminChange(group.id, chat.id, user);
    }

    await cacheManager.invalidateGroup(chat.id);

    return res.status(200).json({ handled: true });

  } catch (error) {
    console.error('Chat member handler error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}

async function handleUserJoin(
  groupId: string,
  chatId: number,
  user: {
    id: number;
    username?: string;
    first_name: string;
    last_name?: string;
    is_bot?: boolean;
  },
  group: { id: string; title: string }
) {
  if (user.is_bot) return;

  console.log(`User ${user.username || user.first_name} joined group ${group.title}`);

  // 创建或获取用户
  const dbUser = await cacheManager.getOrCreateUser(user.id, {
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name
  });

  // 添加到 group_members 表
  if (dbUser) {
    const { error } = await supabase
      .from('group_members')
      .upsert({
        group_id: groupId,
        user_id: dbUser.id,
        is_active: true,
        joined_at: new Date().toISOString()
      }, {
        onConflict: 'group_id,user_id'
      });
    
    if (error) {
      console.error('Failed to add member to group_members:', error);
    } else {
      console.log(`Added user ${user.id} to group_members for group ${groupId}`);
    }
  }

  const config = await cacheManager.getGroupConfig(groupId);
  if (!config?.verification_config.enabled) {
    return;
  }

  await verificationService.startVerification(
    groupId,
    chatId,
    user.id,
    user.username,
    config.verification_config
  );
}

async function handleUserLeave(
  groupId: string,
  chatId: number,
  user: {
    id: number;
    username?: string;
    first_name: string;
  }
) {
  console.log(`User ${user.username || user.first_name} left group ${groupId}`);

  // 获取用户的 UUID
  const { data: userData } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', user.id)
    .single();

  if (userData) {
    // 更新 group_members 表中的状态
    const { error } = await supabase
      .from('group_members')
      .update({
        is_active: false,
        left_at: new Date().toISOString()
      })
      .eq('group_id', groupId)
      .eq('user_id', userData.id);
    
    if (error) {
      console.error('Failed to update member status:', error);
    } else {
      console.log(`Updated user ${user.id} status to inactive in group ${groupId}`);
    }
  }
}

async function handleAdminChange(
  groupId: string,
  chatId: number,
  user: {
    id: number;
    username?: string;
    first_name: string;
  }
) {
  console.log(`User ${user.username || user.first_name} became admin in group ${groupId}`);
}

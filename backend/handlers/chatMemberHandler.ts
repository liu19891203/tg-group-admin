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
  },
  group: { id: string; title: string }
) {
  if (user.is_bot) return;

  console.log(`User ${user.username || user.first_name} joined group ${group.title}`);

  await cacheManager.getOrCreateUser(user.id, {
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name
  });

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

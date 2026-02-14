// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../lib/database';
import { redis, createCacheKey } from '../lib/redis';
import { TelegramUpdate } from '../types/telegram';
import { Group, GroupConfig, User } from '../types/database';

interface CacheData {
  group?: Group;
  config?: GroupConfig;
  user?: User;
}

export class CacheManager {
  private static instance: CacheManager;
  private ttl = 300;

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  async getGroup(chatId: number): Promise<Group | null> {
    const cacheKey = createCacheKey('group', chatId);
    const cached = await redis.get<Group>(cacheKey);
    
    if (cached) return cached;

    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('chat_id', chatId)
      .single();

    if (data) {
      await redis.setex(cacheKey, this.ttl, data);
    }

    return data;
  }

  async getGroupConfig(groupId: string): Promise<GroupConfig | null> {
    const cacheKey = createCacheKey('config', groupId);
    const cached = await redis.get<GroupConfig>(cacheKey);
    
    if (cached) return cached;

    const { data } = await supabase
      .from('group_configs')
      .select('*')
      .eq('group_id', groupId)
      .single();

    if (data) {
      await redis.setex(cacheKey, this.ttl, data);
    }

    return data;
  }

  async getOrCreateUser(telegramId: number, userInfo?: {
    username?: string;
    first_name: string;
    last_name?: string;
    language_code?: string;
  }, groupId?: string): Promise<User | null> {
    const cacheKey = createCacheKey('user', telegramId);
    const cached = await redis.get<User>(cacheKey);
    
    if (cached) return cached;

    let { data } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (!data && userInfo) {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          telegram_id: telegramId,
          username: userInfo.username,
          first_name: userInfo.first_name,
          last_name: userInfo.last_name,
          language_code: userInfo.language_code
        })
        .select()
        .single();

      if (!error && newUser) {
        data = newUser;
      }
    } else if (data && userInfo) {
      // 检测账号变更
      await this.detectAccountChange(data, userInfo, groupId);
    }

    if (data) {
      await redis.setex(cacheKey, this.ttl, data);
    }

    return data;
  }

  // 检测账号变更（昵称或用户名）
  private async detectAccountChange(
    existingUser: User,
    newUserInfo: {
      username?: string;
      first_name: string;
      last_name?: string;
    },
    groupId?: string
  ): Promise<void> {
    const oldNickname = existingUser.display_name || `${existingUser.first_name} ${existingUser.last_name || ''}`.trim();
    const newNickname = `${newUserInfo.first_name} ${newUserInfo.last_name || ''}`.trim();
    const oldUsername = existingUser.username;
    const newUsername = newUserInfo.username;

    const nicknameChanged = oldNickname !== newNickname;
    const usernameChanged = oldUsername !== newUsername;

    if (!nicknameChanged && !usernameChanged) return;

    // 确定变更类型
    let changeType: string;
    if (nicknameChanged && usernameChanged) {
      changeType = 'both';
    } else if (nicknameChanged) {
      changeType = 'nickname';
    } else {
      changeType = 'username';
    }

    // 记录变更历史
    await supabase.from('account_change_history').insert({
      user_id: existingUser.id,
      group_id: groupId || null,
      change_type: changeType,
      old_nickname: nicknameChanged ? oldNickname : null,
      new_nickname: nicknameChanged ? newNickname : null,
      old_username: usernameChanged ? oldUsername : null,
      new_username: usernameChanged ? newUsername : null,
      changed_at: new Date().toISOString()
    });

    // 更新用户信息
    await supabase
      .from('users')
      .update({
        username: newUsername,
        first_name: newUserInfo.first_name,
        last_name: newUserInfo.last_name,
        display_name: newNickname,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingUser.id);

    console.log(`Account change detected for user ${existingUser.telegram_id}: ${changeType}`);
  }

  async invalidateGroup(chatId: number): Promise<void> {
    const cacheKey = createCacheKey('group', chatId);
    await redis.del(cacheKey);
  }

  async invalidateConfig(groupId: string): Promise<void> {
    const cacheKey = createCacheKey('config', groupId);
    await redis.del(cacheKey);
  }

  async invalidateUser(telegramId: number): Promise<void> {
    const cacheKey = createCacheKey('user', telegramId);
    await redis.del(cacheKey);
  }
}

export const cacheManager = CacheManager.getInstance();

export async function handleUpdate(update: TelegramUpdate): Promise<{
  handled: boolean;
  response?: Record<string, unknown>;
}> {
  try {
    const chatId = update.message?.chat?.id || 
                   update.callback_query?.message?.chat?.id ||
                   update.my_chat_member?.chat?.id ||
                   update.chat_member?.chat?.id;

    if (!chatId) {
      return { handled: false, response: { error: 'No chat ID found' } };
    }

    const group = await cacheManager.getGroup(chatId);

    if (!group) {
      console.log(`Group not found for chat_id: ${chatId}`);
      return { handled: false };
    }

    if (!group.is_active) {
      return { handled: false };
    }

    const config = await cacheManager.getGroupConfig(group.id);

    return {
      handled: true,
      response: {
        group_id: group.id,
        chat_id: chatId,
        config_exists: !!config
      }
    };

  } catch (error) {
    console.error('Error handling update:', error);
    return { handled: false, response: { error: 'Internal error' } };
  }
}

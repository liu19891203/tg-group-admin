import { supabase } from '../lib/database';
import { cacheManager } from '../lib/cache';
import { Redis } from '@upstash/redis';
import { sendMessage, restrictChatMember, kickChatMember } from '../lib/api';
import { TelegramMessage } from '../types/telegram';

interface WarnConfig {
  enabled: boolean;
  max_warns: number;
  warn_expiry_hours: number;
  punishment: 'mute' | 'kick' | 'ban';
  mute_duration: number;
  warn_message: string;
  max_warn_message: string;
  auto_reset: boolean;
  notify_admins: boolean;
  admin_chat_id?: number;
}

interface WarnRecord {
  id: string;
  user_id: string;
  telegram_id: number;
  group_id: string;
  chat_id: number;
  reason: string;
  warned_by: number;
  warn_count: number;
  expires_at: string;
  created_at: string;
}

interface WarnResult {
  success: boolean;
  warn_count: number;
  max_warns: number;
  action?: 'warned' | 'muted' | 'kicked' | 'banned';
  message?: string;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    return null;
  }
  
  return new Redis({ url, token });
}

export const warnService = {
  async warnUser(
    message: TelegramMessage,
    reason: string,
    config: WarnConfig,
    warnedBy: number
  ): Promise<WarnResult> {
    if (!config.enabled) {
      return { success: false, warn_count: 0, max_warns: config.max_warns };
    }

    const chatId = message.chat.id;
    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || '用户';

    if (!userId) {
      return { success: false, warn_count: 0, max_warns: config.max_warns };
    }

    const redis = getRedis();
    const key = `warns:${chatId}:${userId}`;

    let warnCount = 1;
    let warnRecord: WarnRecord | null = null;

    if (redis) {
      const existing = await redis.get<{ count: number; reasons: string[] }>(key);
      if (existing) {
        warnCount = existing.count + 1;
      }
      
      await redis.setex(key, config.warn_expiry_hours * 3600, {
        count: warnCount,
        reasons: [...(existing?.reasons || []), reason]
      });
    } else {
      const { data: existingRecord } = await supabase
        .from('user_warnings')
        .select('*')
        .eq('telegram_id', userId)
        .eq('chat_id', chatId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingRecord) {
        warnCount = existingRecord.warn_count + 1;
        await supabase
          .from('user_warnings')
          .update({ 
            warn_count: warnCount, 
            reason: `${existingRecord.reason}; ${reason}`,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingRecord.id);
        warnRecord = { ...existingRecord, warn_count: warnCount };
      } else {
        const expiresAt = new Date(Date.now() + config.warn_expiry_hours * 3600 * 1000);
        const { data: newRecord } = await supabase
          .from('user_warnings')
          .insert({
            telegram_id: userId,
            chat_id: chatId,
            reason: reason,
            warned_by: warnedBy,
            warn_count: 1,
            expires_at: expiresAt.toISOString()
          })
          .select()
          .single();
        warnRecord = newRecord;
      }
    }

    await this.logWarning(chatId, userId, reason, warnedBy, warnCount);

    if (warnCount >= config.max_warns) {
      const actionResult = await this.executePunishment(message, config, warnCount);
      
      if (config.auto_reset) {
        await this.clearWarnings(chatId, userId);
      }

      await sendMessage(chatId, 
        config.max_warn_message
          .replace('{user}', username)
          .replace('{count}', warnCount.toString())
          .replace('{max}', config.max_warns.toString())
      );

      if (config.notify_admins && config.admin_chat_id) {
        await sendMessage(config.admin_chat_id,
          `⚠️ 用户 @${username} 在群组 ${chatId} 达到警告上限\n` +
          `警告次数: ${warnCount}/${config.max_warns}\n` +
          `执行操作: ${config.punishment}`
        );
      }

      return {
        success: true,
        warn_count: warnCount,
        max_warns: config.max_warns,
        action: actionResult.action,
        message: `达到警告上限，已执行${config.punishment}操作`
      };
    }

    const warnMessage = config.warn_message
      .replace('{user}', username)
      .replace('{count}', warnCount.toString())
      .replace('{max}', config.max_warns.toString())
      .replace('{reason}', reason);

    await sendMessage(chatId, warnMessage);

    return {
      success: true,
      warn_count: warnCount,
      max_warns: config.max_warns,
      action: 'warned',
      message: `警告已记录 (${warnCount}/${config.max_warns})`
    };
  },

  async executePunishment(
    message: TelegramMessage,
    config: WarnConfig,
    warnCount: number
  ): Promise<{ action: 'muted' | 'kicked' | 'banned' }> {
    const chatId = message.chat.id;
    const userId = message.from?.id;

    if (!userId) {
      return { action: 'kicked' };
    }

    switch (config.punishment) {
      case 'mute':
        await restrictChatMember(chatId, userId, {
          canSendMessages: false,
          canSendMediaMessages: false,
          canSendOtherMessages: false,
          canAddWebPagePreviews: false
        }, Math.floor(Date.now() / 1000) + config.mute_duration);
        return { action: 'muted' };

      case 'kick':
        await kickChatMember(chatId, userId);
        return { action: 'kicked' };

      case 'ban':
        await kickChatMember(chatId, userId);
        return { action: 'banned' };

      default:
        return { action: 'kicked' };
    }
  },

  async clearWarnings(chatId: number, userId: number): Promise<void> {
    const redis = getRedis();
    const key = `warns:${chatId}:${userId}`;

    if (redis) {
      await redis.del(key);
    }

    await supabase
      .from('user_warnings')
      .update({ is_active: false })
      .eq('chat_id', chatId)
      .eq('telegram_id', userId);
  },

  async getWarnCount(chatId: number, userId: number): Promise<number> {
    const redis = getRedis();
    const key = `warns:${chatId}:${userId}`;

    if (redis) {
      const data = await redis.get<{ count: number }>(key);
      return data?.count || 0;
    }

    const { data } = await supabase
      .from('user_warnings')
      .select('warn_count')
      .eq('chat_id', chatId)
      .eq('telegram_id', userId)
      .gt('expires_at', new Date().toISOString())
      .single();

    return data?.warn_count || 0;
  },

  async getWarnHistory(
    chatId: number,
    userId?: number,
    limit: number = 20
  ): Promise<WarnRecord[]> {
    let query = supabase
      .from('user_warnings')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (userId) {
      query = query.eq('telegram_id', userId);
    }

    const { data } = await query;
    return data || [];
  },

  async logWarning(
    chatId: number,
    userId: number,
    reason: string,
    warnedBy: number,
    warnCount: number
  ): Promise<void> {
    await supabase.from('operation_logs').insert({
      action: 'user_warning',
      target_type: 'user',
      target_id: userId.toString(),
      new_value: {
        chat_id: chatId,
        reason,
        warned_by: warnedBy,
        warn_count: warnCount
      }
    });
  },

  async setWarnConfig(groupId: string, config: Partial<WarnConfig>): Promise<void> {
    await supabase
      .from('group_configs')
      .update({ warn_config: config })
      .eq('group_id', groupId);
    
    await cacheManager.invalidateConfig(groupId);
  },

  async getWarnConfig(groupId: string): Promise<WarnConfig> {
    const { data } = await supabase
      .from('group_configs')
      .select('warn_config')
      .eq('group_id', groupId)
      .single();

    return data?.warn_config || {
      enabled: false,
      max_warns: 3,
      warn_expiry_hours: 24,
      punishment: 'mute',
      mute_duration: 3600,
      warn_message: '⚠️ {user} 已被警告 ({count}/{max})\n原因: {reason}',
      max_warn_message: '🚫 {user} 达到警告上限 ({count}/{max})，已执行处罚',
      auto_reset: true,
      notify_admins: false
    };
  },

  async reduceWarning(chatId: number, userId: number, amount: number = 1): Promise<number> {
    const redis = getRedis();
    const key = `warns:${chatId}:${userId}`;

    if (redis) {
      const data = await redis.get<{ count: number; reasons: string[] }>(key);
      if (data) {
        const newCount = Math.max(0, data.count - amount);
        if (newCount === 0) {
          await redis.del(key);
        } else {
          await redis.setex(key, 86400, {
            count: newCount,
            reasons: data.reasons.slice(0, newCount)
          });
        }
        return newCount;
      }
      return 0;
    }

    const { data: existing } = await supabase
      .from('user_warnings')
      .select('*')
      .eq('chat_id', chatId)
      .eq('telegram_id', userId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existing) {
      const newCount = Math.max(0, existing.warn_count - amount);
      await supabase
        .from('user_warnings')
        .update({ warn_count: newCount })
        .eq('id', existing.id);
      return newCount;
    }

    return 0;
  }
};

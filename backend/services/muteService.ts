import { supabase } from '../lib/database';
import { cacheManager } from '../lib/cache';
import { Redis } from '@upstash/redis';
import { sendMessage, restrictChatMember, getChatMember } from '../lib/api';
import { TelegramMessage } from '../types/telegram';

interface MuteConfig {
  enabled: boolean;
  default_duration: number;
  max_duration: number;
  allow_custom_duration: boolean;
  mute_message: string;
  unmute_message: string;
  log_mutes: boolean;
  notify_user: boolean;
  progressive_mute: boolean;
  progressive_durations: number[];
}

interface MuteRecord {
  id: string;
  user_id: string;
  telegram_id: number;
  group_id: string;
  chat_id: number;
  muted_by: number;
  duration: number;
  reason: string;
  mute_type: 'manual' | 'auto' | 'progressive';
  unmuted_at?: string;
  unmuted_by?: number;
  is_active: boolean;
  created_at: string;
  expires_at: string;
}

interface MuteResult {
  success: boolean;
  duration: number;
  expires_at?: string;
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

export const muteService = {
  async muteUser(
    message: TelegramMessage,
    duration: number,
    reason: string,
    mutedBy: number,
    config: MuteConfig
  ): Promise<MuteResult> {
    if (!config.enabled) {
      return { success: false, duration: 0, message: '禁言功能未启用' };
    }

    const chatId = message.chat.id;
    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || '用户';

    if (!userId) {
      return { success: false, duration: 0, message: '无法获取用户ID' };
    }

    const memberInfo = await getChatMember(chatId, userId);
    if (memberInfo && ['creator', 'administrator'].includes(memberInfo.status)) {
      return { success: false, duration: 0, message: '无法禁言管理员' };
    }

    let actualDuration = duration;
    let muteType: 'manual' | 'auto' | 'progressive' = 'manual';

    if (config.progressive_mute && duration === 0) {
      const muteCount = await this.getMuteCount(chatId, userId);
      const durations = config.progressive_durations.length > 0 
        ? config.progressive_durations 
        : [300, 900, 3600, 86400, 604800];
      
      const durationIndex = Math.min(muteCount, durations.length - 1);
      actualDuration = durations[durationIndex];
      muteType = 'progressive';
    }

    if (actualDuration > config.max_duration) {
      actualDuration = config.max_duration;
    }

    const expiresAt = Math.floor(Date.now() / 1000) + actualDuration;

    const success = await restrictChatMember(chatId, userId, {
      canSendMessages: false,
      canSendMediaMessages: false,
      canSendOtherMessages: false,
      canAddWebPagePreviews: false
    }, expiresAt);

    if (!success) {
      return { success: false, duration: actualDuration, message: '禁言操作失败' };
    }

    const redis = getRedis();
    const key = `mute:${chatId}:${userId}`;

    if (redis) {
      await redis.setex(key, actualDuration, {
        muted_by: mutedBy,
        duration: actualDuration,
        reason,
        mute_type: muteType
      });
    }

    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    const groupId = groupData?.id;

    if (groupId) {
      await supabase.from('user_mutes').insert({
        telegram_id: userId,
        group_id: groupId,
        chat_id: chatId,
        muted_by: mutedBy,
        duration: actualDuration,
        reason,
        mute_type: muteType,
        is_active: true,
        expires_at: new Date(expiresAt * 1000).toISOString()
      });
    }

    if (config.log_mutes) {
      await this.logMute(chatId, userId, mutedBy, actualDuration, reason, muteType);
    }

    const muteMessage = config.mute_message
      .replace('{user}', username)
      .replace('{duration}', this.formatDuration(actualDuration))
      .replace('{reason}', reason);

    if (config.notify_user) {
      await sendMessage(chatId, muteMessage);
    }

    return {
      success: true,
      duration: actualDuration,
      expires_at: new Date(expiresAt * 1000).toISOString(),
      message: `已禁言用户 ${actualDuration} 秒`
    };
  },

  async unmuteUser(
    chatId: number,
    userId: number,
    unmutedBy: number,
    config: MuteConfig
  ): Promise<{ success: boolean; message: string }> {
    const success = await restrictChatMember(chatId, userId, {
      canSendMessages: true,
      canSendMediaMessages: true,
      canSendOtherMessages: true,
      canAddWebPagePreviews: true
    });

    if (!success) {
      return { success: false, message: '解除禁言失败' };
    }

    const redis = getRedis();
    const key = `mute:${chatId}:${userId}`;

    if (redis) {
      await redis.del(key);
    }

    await supabase
      .from('user_mutes')
      .update({
        is_active: false,
        unmuted_at: new Date().toISOString(),
        unmuted_by: unmutedBy
      })
      .eq('chat_id', chatId)
      .eq('telegram_id', userId)
      .eq('is_active', true);

    if (config.notify_user) {
      await sendMessage(chatId, config.unmute_message.replace('{user}', `用户 ${userId}`));
    }

    return { success: true, message: '已解除禁言' };
  },

  async getMuteCount(chatId: number, userId: number): Promise<number> {
    const { count } = await supabase
      .from('user_mutes')
      .select('*', { count: 'exact', head: true })
      .eq('chat_id', chatId)
      .eq('telegram_id', userId);

    return count || 0;
  },

  async getActiveMutes(chatId: number, limit: number = 50): Promise<MuteRecord[]> {
    const { data } = await supabase
      .from('user_mutes')
      .select('*')
      .eq('chat_id', chatId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  },

  async getMuteHistory(
    chatId: number,
    userId?: number,
    limit: number = 20
  ): Promise<MuteRecord[]> {
    let query = supabase
      .from('user_mutes')
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

  async isMuted(chatId: number, userId: number): Promise<boolean> {
    const redis = getRedis();
    const key = `mute:${chatId}:${userId}`;

    if (redis) {
      const exists = await redis.exists(key);
      return exists === 1;
    }

    const { data } = await supabase
      .from('user_mutes')
      .select('id')
      .eq('chat_id', chatId)
      .eq('telegram_id', userId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    return !!data;
  },

  async logMute(
    chatId: number,
    userId: number,
    mutedBy: number,
    duration: number,
    reason: string,
    muteType: string
  ): Promise<void> {
    await supabase.from('operation_logs').insert({
      action: 'user_mute',
      target_type: 'user',
      target_id: userId.toString(),
      new_value: {
        chat_id: chatId,
        muted_by: mutedBy,
        duration,
        reason,
        mute_type: muteType
      }
    });
  },

  formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds}秒`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}分钟`;
    } else if (seconds < 86400) {
      return `${Math.floor(seconds / 3600)}小时`;
    } else if (seconds < 604800) {
      return `${Math.floor(seconds / 86400)}天`;
    } else {
      return `${Math.floor(seconds / 604800)}周`;
    }
  },

  parseDuration(input: string): number {
    const match = input.match(/^(\d+)(s|m|h|d|w)?$/i);
    if (!match) return 0;

    const value = parseInt(match[1]);
    const unit = match[2]?.toLowerCase() || 's';

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      case 'w': return value * 604800;
      default: return value;
    }
  },

  async setMuteConfig(groupId: string, config: Partial<MuteConfig>): Promise<void> {
    await supabase
      .from('group_configs')
      .update({ mute_config: config })
      .eq('group_id', groupId);
    
    await cacheManager.invalidateConfig(groupId);
  },

  async getMuteConfig(groupId: string): Promise<MuteConfig> {
    const { data } = await supabase
      .from('group_configs')
      .select('mute_config')
      .eq('group_id', groupId)
      .single();

    return data?.mute_config || {
      enabled: true,
      default_duration: 300,
      max_duration: 86400,
      allow_custom_duration: true,
      mute_message: '🔇 {user} 已被禁言 {duration}\n原因: {reason}',
      unmute_message: '🔊 {user} 已被解除禁言',
      log_mutes: true,
      notify_user: true,
      progressive_mute: false,
      progressive_durations: [300, 900, 3600, 86400, 604800]
    };
  },

  async cleanupExpiredMutes(): Promise<number> {
    const now = new Date().toISOString();

    const { data: expiredMutes } = await supabase
      .from('user_mutes')
      .select('id, chat_id, telegram_id')
      .eq('is_active', true)
      .lt('expires_at', now);

    if (!expiredMutes || expiredMutes.length === 0) {
      return 0;
    }

    await supabase
      .from('user_mutes')
      .update({ is_active: false })
      .in('id', expiredMutes.map(m => m.id));

    return expiredMutes.length;
  }
};

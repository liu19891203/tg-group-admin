import { supabase } from '../lib/database';
import { AntiSpamConfig } from '../types/database';
import { TelegramMessage } from '../types/telegram';
import { deleteMessage, restrictChatMember, kickChatMember, sendMessage } from '../lib/api';
import { Redis } from '@upstash/redis';

interface SpamCheckResult {
  isSpam: boolean;
  reason: 'frequency' | 'duplicate' | 'none';
  messageCount: number;
  duplicateCount: number;
  timeWindow: number;
  confidence: number;
}

interface SpamPunishmentResult {
  action: string;
  duration?: number;
}

interface MessageRecord {
  timestamp: number;
  text: string;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    console.warn('Redis not configured, spam detection will use in-memory fallback');
    return null;
  }
  
  return new Redis({ url, token });
}

const memoryCache = new Map<string, MessageRecord[]>();

function getMemoryKey(chatId: number, userId: number): string {
  return `${chatId}:${userId}`;
}

function cleanOldMessages(messages: MessageRecord[], windowMs: number): MessageRecord[] {
  const now = Date.now();
  return messages.filter(m => now - m.timestamp < windowMs);
}

export const antiSpamService = {
  async check(
    userId: number,
    chatId: number,
    text: string,
    config?: AntiSpamConfig
  ): Promise<SpamCheckResult> {
    if (!config?.enabled) {
      return { 
        isSpam: false, 
        reason: 'none',
        messageCount: 0, 
        duplicateCount: 0,
        timeWindow: 0, 
        confidence: 0 
      };
    }

    const redis = getRedis();
    const now = Date.now();
    const windowMs = (config.time_window || 10) * 1000;
    const key = `spam:${chatId}:${userId}`;

    let messages: MessageRecord[];

    if (redis) {
      const stored = await redis.get<MessageRecord[]>(key) || [];
      messages = stored;
    } else {
      const memKey = getMemoryKey(chatId, userId);
      messages = memoryCache.get(memKey) || [];
    }

    const recentMessages = cleanOldMessages(messages, windowMs);
    const messageCount = recentMessages.length + 1;
    
    const normalizedText = text.toLowerCase().trim();
    const duplicateCount = recentMessages.filter(m => 
      m.text.toLowerCase().trim() === normalizedText
    ).length + 1;

    const newMessages = [...recentMessages, { timestamp: now, text }];
    
    if (redis) {
      await redis.setex(key, Math.ceil(windowMs / 1000), newMessages);
    } else {
      const memKey = getMemoryKey(chatId, userId);
      memoryCache.set(memKey, newMessages);
      setTimeout(() => {
        const current = memoryCache.get(memKey) || [];
        memoryCache.set(memKey, cleanOldMessages(current, windowMs));
      }, windowMs);
    }

    const maxMessages = config.max_messages || 5;
    const duplicateThreshold = config.duplicate_threshold || 3;

    if (messageCount >= maxMessages) {
      return {
        isSpam: true,
        reason: 'frequency',
        messageCount,
        duplicateCount,
        timeWindow: config.time_window || 10,
        confidence: Math.min(messageCount / maxMessages, 1)
      };
    }

    if (duplicateCount >= duplicateThreshold) {
      return {
        isSpam: true,
        reason: 'duplicate',
        messageCount,
        duplicateCount,
        timeWindow: config.time_window || 10,
        confidence: Math.min(duplicateCount / duplicateThreshold, 1)
      };
    }

    return {
      isSpam: false,
      reason: 'none',
      messageCount,
      duplicateCount,
      timeWindow: config.time_window || 10,
      confidence: 0
    };
  },

  async punish(
    message: TelegramMessage,
    result: SpamCheckResult,
    config?: AntiSpamConfig
  ): Promise<SpamPunishmentResult> {
    const chatId = message.chat.id;
    const userId = message.from?.id;

    if (!userId) {
      return { action: 'none' };
    }

    const punishConfig = config || {
      enabled: true,
      max_messages: 5,
      time_window: 10,
      duplicate_threshold: 3,
      punishment: 'mute' as const,
      mute_duration: 300
    };

    const username = message.from?.username || message.from?.first_name || '用户';
    const reasonText = result.reason === 'frequency' 
      ? `发送了 ${result.messageCount} 条消息` 
      : `重复发送相同消息 ${result.duplicateCount} 次`;

    switch (punishConfig.punishment) {
      case 'delete':
        await deleteMessage(chatId, message.message_id);
        await sendMessage(chatId, `⚠️ @${username} ${reasonText}，消息已删除。`, { parseMode: 'HTML' });
        return { action: 'deleted' };

      case 'warn':
        const warnMsg = punishConfig.warn_message || 
          `⚠️ @${username} 请勿刷屏！${reasonText}。继续刷屏将被处罚。`;
        await sendMessage(chatId, warnMsg, { parseMode: 'HTML' });
        return { action: 'warned' };

      case 'mute':
        await deleteMessage(chatId, message.message_id);
        const muteResult = await this.muteUser(chatId, userId, punishConfig.mute_duration || 300);
        await sendMessage(chatId, 
          `🔇 @${username} ${reasonText}，已被禁言 ${Math.floor((punishConfig.mute_duration || 300) / 60)} 分钟。`,
          { parseMode: 'HTML' }
        );
        return muteResult;

      case 'kick':
        await deleteMessage(chatId, message.message_id);
        const kickResult = await this.kickUser(chatId, userId);
        await sendMessage(chatId, 
          `👢 @${username} ${reasonText}，已被踢出群组。`,
          { parseMode: 'HTML' }
        );
        return kickResult;

      case 'ban':
        await deleteMessage(chatId, message.message_id);
        const banResult = await this.banUser(chatId, userId);
        await sendMessage(chatId, 
          `🚫 @${username} ${reasonText}，已被封禁。`,
          { parseMode: 'HTML' }
        );
        return banResult;

      default:
        await deleteMessage(chatId, message.message_id);
        return { action: 'deleted' };
    }
  },

  async muteUser(chatId: number, userId: number, durationSeconds: number): Promise<SpamPunishmentResult> {
    try {
      await restrictChatMember(chatId, userId, {
        canSendMessages: false,
        canSendMediaMessages: false,
        canSendOtherMessages: false,
        canAddWebPagePreviews: false
      }, Math.floor(Date.now() / 1000) + durationSeconds);

      return {
        action: 'muted',
        duration: durationSeconds
      };
    } catch (error) {
      console.error('Mute user error:', error);
      return { action: 'mute_failed' };
    }
  },

  async kickUser(chatId: number, userId: number): Promise<SpamPunishmentResult> {
    try {
      await kickChatMember(chatId, userId);
      return { action: 'kicked' };
    } catch (error) {
      console.error('Kick user error:', error);
      return { action: 'kick_failed' };
    }
  },

  async banUser(chatId: number, userId: number): Promise<SpamPunishmentResult> {
    try {
      await kickChatMember(chatId, userId);
      return { action: 'banned' };
    } catch (error) {
      console.error('Ban user error:', error);
      return { action: 'ban_failed' };
    }
  },

  async getSpamStats(chatId: number, userId?: number): Promise<{
    totalDetected: number;
    recentCount: number;
    lastDetected?: string;
  }> {
    const redis = getRedis();
    
    if (!redis) {
      return { totalDetected: 0, recentCount: 0 };
    }

    if (userId) {
      const key = `spam:${chatId}:${userId}`;
      const messages = await redis.get<MessageRecord[]>(key) || [];
      const now = Date.now();
      const recentMessages = messages.filter(m => now - m.timestamp < 86400000);

      return {
        totalDetected: messages.length,
        recentCount: recentMessages.length,
        lastDetected: messages.length > 0 
          ? new Date(messages[messages.length - 1].timestamp).toISOString() 
          : undefined
      };
    }

    return {
      totalDetected: 0,
      recentCount: 0
    };
  },

  async clearSpamRecord(chatId: number, userId: number): Promise<void> {
    const redis = getRedis();
    
    if (redis) {
      const key = `spam:${chatId}:${userId}`;
      await redis.del(key);
    } else {
      const memKey = getMemoryKey(chatId, userId);
      memoryCache.delete(memKey);
    }
  }
};

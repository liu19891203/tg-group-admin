// @ts-nocheck
import { supabase } from '../lib/database';
import { AntiSpamConfig } from '../types/database';
import { TelegramMessage } from '../types/telegram';
import { deleteMessage, restrictChatMember } from '../lib/api';
import { Redis } from '@upstash/redis';

interface SpamCheckResult {
  isSpam: boolean;
  messageCount: number;
  timeWindow: number;
  confidence: number;
}

interface SpamPunishmentResult {
  action: string;
  duration?: number;
}

export const antiSpamService = {
  async check(
    userId: number,
    chatId: number,
    config?: AntiSpamConfig
  ): Promise<SpamCheckResult> {
    if (!config?.enabled) {
      return { isSpam: false, messageCount: 0, timeWindow: 0, confidence: 0 };
    }

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });

    const key = `spam:${chatId}:${userId}`;
    const now = Date.now();
    const windowMs = (config.time_window || 10) * 1000;

    const messages = await redis.get<number[]>(key) || [];

    const recentMessages = messages.filter(t => now - t < windowMs);

    const messageCount = recentMessages.length + 1;

    await redis.setex(key, windowMs / 1000, [...recentMessages, now]);

    if (messageCount >= (config.max_messages || 5)) {
      return {
        isSpam: true,
        messageCount,
        timeWindow: config.time_window || 10,
        confidence: Math.min(messageCount / (config.max_messages || 5), 1)
      };
    }

    return {
      isSpam: false,
      messageCount,
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
      punishment: 'mute',
      mute_duration: 300
    };

    switch (punishConfig.punishment) {
      case 'mute':
        return await this.muteUser(chatId, userId, punishConfig.mute_duration || 300);

      case 'ban':
        return await this.banUser(chatId, userId);

      case 'delete':
        await deleteMessage(chatId, message.message_id);
        return { action: 'deleted' };

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

  async banUser(chatId: number, userId: number): Promise<SpamPunishmentResult> {
    try {
      const { kickChatMember } = await import('../../lib/api');
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
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });

    if (userId) {
      const key = `spam:${chatId}:${userId}`;
      const messages = await redis.get<number[]>(key) || [];
      const now = Date.now();
      const recentMessages = messages.filter(t => now - t < 86400000);

      return {
        totalDetected: messages.length,
        recentCount: recentMessages.length,
        lastDetected: messages.length > 0 ? new Date(messages[messages.length - 1]).toISOString() : undefined
      };
    }

    return {
      totalDetected: 0,
      recentCount: 0
    };
  },

  async clearSpamRecord(chatId: number, userId: number): Promise<void> {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });

    const key = `spam:${chatId}:${userId}`;
    await redis.del(key);
  }
};

// @ts-nocheck
import { supabase } from '../lib/database';
import { cacheManager } from '../lib/cache';
import { AntiAdsConfig } from '../types/database';
import { TelegramMessage } from '../types/telegram';
import { deleteMessage, sendMessage } from '../lib/api';
import { InlineKeyboardButton } from '../types/database';

interface AdsCheckResult {
  isAds: boolean;
  type: string;
  matchedKeyword?: string;
  confidence: number;
}

interface PunishmentResult {
  action: string;
  message?: string;
}

export const adFilterService = {
  async check(
    text: string,
    config: AntiAdsConfig,
    message?: TelegramMessage
  ): Promise<AdsCheckResult> {
    if (!config.enabled) {
      return { isAds: false, type: 'none', confidence: 0 };
    }

    const result: AdsCheckResult = {
      isAds: false,
      type: 'none',
      confidence: 0
    };

    if (config.sticker_ads) {
      const stickerCheck = this.checkStickerAds(message);
      if (stickerCheck.isAds) {
        return stickerCheck;
      }
    }

    if (config.keyword_ads && config.keywords?.length > 0) {
      const keywordCheck = this.checkKeywordAds(text, config.keywords);
      if (keywordCheck.isAds) {
        return keywordCheck;
      }
    }

    if (config.link_ads) {
      const linkCheck = this.checkLinkAds(text);
      if (linkCheck.isAds) {
        return linkCheck;
      }
    }

    return result;
  },

  checkStickerAds(message?: TelegramMessage): AdsCheckResult {
    if (!message?.sticker) {
      return { isAds: false, type: 'none', confidence: 0 };
    }

    const stickerSet = message.sticker.set_name || '';
    const hasAtSymbol = stickerSet.includes('@');

    if (hasAtSymbol) {
      return {
        isAds: true,
        type: 'sticker_ad',
        confidence: 0.9
      };
    }

    return { isAds: false, type: 'none', confidence: 0 };
  },

  checkKeywordAds(text: string, keywords: string[]): AdsCheckResult {
    const lowerText = text.toLowerCase();

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      if (lowerText.includes(lowerKeyword)) {
        return {
          isAds: true,
          type: 'keyword_ad',
          matchedKeyword: keyword,
          confidence: 0.8
        };
      }
    }

    return { isAds: false, type: 'none', confidence: 0 };
  },

  checkLinkAds(text: string): AdsCheckResult {
    const linkRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(linkRegex);

    if (!matches) {
      return { isAds: false, type: 'none', confidence: 0 };
    }

    for (const link of matches) {
      if (link.includes('t.me') || link.includes('telegram.me')) {
        if (link.includes('joinchat') || link.includes('+')) {
          return {
            isAds: true,
            type: 'invite_link',
            matchedKeyword: link,
            confidence: 0.95
          };
        }
      }

      const hasReferral = link.includes('ref=') || link.includes('?ref=');
      if (hasReferral) {
        return {
          isAds: true,
          type: 'referral_link',
          matchedKeyword: link,
          confidence: 0.9
        };
      }
    }

    return { isAds: false, type: 'none', confidence: 0 };
  },

  async punish(
    message: TelegramMessage,
    result: AdsCheckResult,
    config: AntiAdsConfig,
    groupId: string
  ): Promise<PunishmentResult> {
    const chatId = message.chat.id;
    const userId = message.from?.id;

    switch (config.punishment) {
      case 'delete':
        await deleteMessage(chatId, message.message_id);
        await this.logViolation(groupId, userId, result, 'delete');
        return { action: 'deleted' };

      case 'warn':
        await deleteMessage(chatId, message.message_id);
        const warnCount = await this.incrementWarnCount(userId, groupId);

        await sendMessage(chatId, 
          `⚠️ 检测到广告内容，已删除\n\n@${message.from?.username || '用户'} 第 ${warnCount} 次警告\n连续 ${config.warn_limit} 次警告将被踢出`
        );

        if (warnCount >= config.warn_limit) {
          await this.resetWarnCount(userId, groupId);
          return { action: 'kick', message: '因广告警告次数过多被踢出' };
        }

        await this.logViolation(groupId, userId, result, 'warn');
        return { action: 'warned', warnCount };

      case 'mute':
        await deleteMessage(chatId, message.message_id);
        await this.logViolation(groupId, userId, result, 'mute');
        return { action: 'muted' };

      case 'ban':
        await deleteMessage(chatId, message.message_id);
        await this.logViolation(groupId, userId, result, 'ban');
        return { action: 'banned' };

      default:
        return { action: 'none' };
    }
  },

  async incrementWarnCount(userId: number | undefined, groupId: string): Promise<number> {
    if (!userId) return 0;

    const key = `warns:${groupId}:${userId}`;
    const { Redis } = await import('../../lib/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });

    const count = await redis.incr(key);
    await redis.expire(key, 86400 * 7);

    return count;
  },

  async resetWarnCount(userId: number, groupId: string): Promise<void> {
    const key = `warns:${groupId}:${userId}`;
    const { Redis } = await import('../../lib/redis');
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });
    await redis.del(key);
  },

  async logViolation(
    groupId: string,
    userId: number | undefined,
    result: AdsCheckResult,
    action: string
  ): Promise<void> {
    await supabase.from('operation_logs').insert({
      admin_id: 'system',
      action: `ads_filter:${action}`,
      target_type: 'user',
      target_id: userId?.toString(),
      new_value: {
        group_id: groupId,
        ads_type: result.type,
        matched_keyword: result.matchedKeyword
      }
    });
  },

  addKeyword(keyword: string, groupId: string): Promise<void> {
    return this.updateKeywords(groupId, keywords => [...(keywords || []), keyword]);
  },

  removeKeyword(keyword: string, groupId: string): Promise<void> {
    return this.updateKeywords(groupId, keywords => 
      (keywords || []).filter(k => k.toLowerCase() !== keyword.toLowerCase())
    );
  },

  private async updateKeywords(
    groupId: string,
    updateFn: (keywords: string[]) => string[]
  ): Promise<void> {
    const { data: config } = await supabase
      .from('group_configs')
      .select('anti_ads_config')
      .eq('group_id', groupId)
      .single();

    if (config) {
      const keywords = updateFn(config.anti_ads_config.keywords || []);
      await supabase
        .from('group_configs')
        .update({ anti_ads_config: { ...config.anti_ads_config, keywords } })
        .eq('group_id', groupId);

      await cacheManager.invalidateConfig(groupId);
    }
  }
};

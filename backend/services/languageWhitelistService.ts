import { supabase } from '../lib/database';
import { Redis } from '@upstash/redis';
import { TelegramMessage } from '../types/telegram';

interface LanguageWhitelistConfig {
  enabled: boolean;
  allowed_languages: string[];
  detection_method: 'fasttext' | 'cld3' | 'google' | 'local';
  api_key?: string;
  api_url?: string;
  confidence_threshold: number;
  action: 'delete' | 'warn' | 'mute' | 'kick';
  warn_message: string;
  mute_duration: number;
  max_warnings: number;
  whitelist_users: number[];
  whitelist_commands: boolean;
  min_message_length: number;
}

interface LanguageDetectionResult {
  language: string;
  confidence: number;
  is_allowed: boolean;
  provider: string;
}

interface LanguageRecord {
  id: string;
  telegram_id: number;
  chat_id: number;
  message_id: number;
  message_text: string;
  detected_language: string;
  confidence: number;
  is_allowed: boolean;
  action_taken: string;
  created_at: string;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    return null;
  }
  
  return new Redis({ url, token });
}

const LANGUAGE_NAMES: Record<string, string> = {
  'zh': '中文',
  'en': 'English',
  'ja': '日本語',
  'ko': '한국어',
  'ru': 'Русский',
  'es': 'Español',
  'fr': 'Français',
  'de': 'Deutsch',
  'ar': 'العربية',
  'pt': 'Português',
  'it': 'Italiano',
  'th': 'ไทย',
  'vi': 'Tiếng Việt',
  'id': 'Bahasa Indonesia',
  'ms': 'Bahasa Melayu',
  'tr': 'Türkçe',
  'pl': 'Polski',
  'nl': 'Nederlands',
  'hi': 'हिन्दी',
  'bn': 'বাংলা',
  'uk': 'Українська',
  'cs': 'Čeština',
  'sv': 'Svenska',
  'hu': 'Magyar',
  'ro': 'Română',
  'el': 'Ελληνικά',
  'he': 'עברית',
  'fa': 'فارسی',
  'ur': 'اردو',
  'ta': 'தமிழ்',
  'te': 'తెలుగు',
  'ml': 'മലയാളം',
  'unknown': '未知'
};

export const languageWhitelistService = {
  async checkMessage(
    message: TelegramMessage,
    config: LanguageWhitelistConfig
  ): Promise<LanguageDetectionResult | null> {
    if (!config.enabled) {
      return null;
    }

    const userId = message.from?.id;
    if (userId && config.whitelist_users.includes(userId)) {
      return null;
    }

    const text = message.text || message.caption;
    if (!text) {
      return null;
    }

    if (config.whitelist_commands && text.startsWith('/')) {
      return null;
    }

    if (text.length < config.min_message_length) {
      return null;
    }

    let result: LanguageDetectionResult;

    switch (config.detection_method) {
      case 'fasttext':
        result = await this.detectWithFastText(text, config.api_url || '');
        break;
      case 'cld3':
        result = await this.detectWithCLD3(text, config.api_url || '');
        break;
      case 'google':
        result = await this.detectWithGoogle(text, config.api_key || '');
        break;
      case 'local':
      default:
        result = await this.detectLocally(text);
        break;
    }

    result.is_allowed = config.allowed_languages.includes(result.language) || 
                        result.confidence < config.confidence_threshold;

    if (!result.is_allowed) {
      await this.handleDisallowedLanguage(message, result, config);
    }

    await this.recordDetection(message, result);

    return result;
  },

  async detectLocally(text: string): Promise<LanguageDetectionResult> {
    const patterns: Record<string, RegExp> = {
      'zh': /[\u4e00-\u9fff\u3400-\u4dbf]/,
      'ja': /[\u3040-\u309f\u30a0-\u30ff]/,
      'ko': /[\uac00-\ud7af]/,
      'th': /[\u0e00-\u0e7f]/,
      'ar': /[\u0600-\u06ff]/,
      'he': /[\u0590-\u05ff]/,
      'ru': /[\u0400-\u04ff]/,
      'el': /[\u0370-\u03ff]/,
      'hi': /[\u0900-\u097f]/,
      'bn': /[\u0980-\u09ff]/,
      'ta': /[\u0b80-\u0bff]/,
      'te': /[\u0c00-\u0c7f]/,
      'ml': /[\u0d00-\u0d7f]/,
      'gu': /[\u0a80-\u0aff]/,
      'pa': /[\u0a00-\u0a7f]/,
      'fa': /[\ufb50-\ufdff\ufe70-\ufeff]/
    };

    const scores: Record<string, number> = {};
    let totalMatches = 0;

    for (const [lang, pattern] of Object.entries(patterns)) {
      const matches = text.match(pattern);
      if (matches) {
        scores[lang] = matches.length;
        totalMatches += matches.length;
      }
    }

    if (totalMatches === 0) {
      if (/[a-zA-Z]/.test(text)) {
        const englishRatio = (text.match(/[a-zA-Z]/g) || []).length / text.length;
        return {
          language: 'en',
          confidence: englishRatio,
          is_allowed: true,
          provider: 'local'
        };
      }
      
      return {
        language: 'unknown',
        confidence: 0,
        is_allowed: true,
        provider: 'local'
      };
    }

    let maxLang = 'unknown';
    let maxScore = 0;

    for (const [lang, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score;
        maxLang = lang;
      }
    }

    return {
      language: maxLang,
      confidence: maxScore / text.length,
      is_allowed: true,
      provider: 'local'
    };
  },

  async detectWithFastText(text: string, apiUrl: string): Promise<LanguageDetectionResult> {
    try {
      const response = await fetch(`${apiUrl}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      const data = await response.json();

      if (data.language) {
        return {
          language: data.language.replace('__label__', ''),
          confidence: data.confidence || 0.9,
          is_allowed: true,
          provider: 'fasttext'
        };
      }
    } catch (error) {
      console.error('FastText detection error:', error);
    }

    return this.detectLocally(text);
  },

  async detectWithCLD3(text: string, apiUrl: string): Promise<LanguageDetectionResult> {
    try {
      const response = await fetch(`${apiUrl}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      const data = await response.json();

      if (data.language) {
        return {
          language: data.language,
          confidence: data.confidence || 0.9,
          is_allowed: true,
          provider: 'cld3'
        };
      }
    } catch (error) {
      console.error('CLD3 detection error:', error);
    }

    return this.detectLocally(text);
  },

  async detectWithGoogle(text: string, apiKey: string): Promise<LanguageDetectionResult> {
    try {
      const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2/detect?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ q: text })
        }
      );

      const data = await response.json();

      if (data.data?.detections?.[0]?.[0]) {
        const detection = data.data.detections[0][0];
        return {
          language: detection.language,
          confidence: detection.confidence || 0.9,
          is_allowed: true,
          provider: 'google'
        };
      }
    } catch (error) {
      console.error('Google detection error:', error);
    }

    return this.detectLocally(text);
  },

  async handleDisallowedLanguage(
    message: TelegramMessage,
    result: LanguageDetectionResult,
    config: LanguageWhitelistConfig
  ): Promise<void> {
    const chatId = message.chat.id;
    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || '用户';
    const messageId = message.message_id;

    if (!userId) return;

    const redis = getRedis();
    const warnKey = `lang_warns:${chatId}:${userId}`;

    let warnCount = 0;
    if (redis) {
      warnCount = await redis.incr(warnKey);
      await redis.expire(warnKey, 86400 * 7);
    }

    const languageName = LANGUAGE_NAMES[result.language] || result.language;
    const allowedNames = config.allowed_languages.map(l => LANGUAGE_NAMES[l] || l).join(', ');

    switch (config.action) {
      case 'delete':
        await this.deleteMessage(chatId, messageId);
        await this.sendMessage(chatId, 
          `⚠️ @${username} 请使用允许的语言\n` +
          `检测到语言: ${languageName}\n` +
          `允许的语言: ${allowedNames}`
        );
        break;

      case 'warn':
        await this.deleteMessage(chatId, messageId);
        await this.sendMessage(chatId,
          config.warn_message
            .replace('{user}', username)
            .replace('{language}', languageName)
            .replace('{allowed}', allowedNames)
            .replace('{count}', warnCount.toString())
            .replace('{max}', config.max_warnings.toString())
        );
        
        if (warnCount >= config.max_warnings) {
          await this.muteUser(chatId, userId, config.mute_duration);
          if (redis) await redis.del(warnKey);
        }
        break;

      case 'mute':
        await this.deleteMessage(chatId, messageId);
        await this.muteUser(chatId, userId, config.mute_duration);
        await this.sendMessage(chatId,
          `🔇 @${username} 因使用不允许的语言已被禁言\n` +
          `检测到语言: ${languageName}`
        );
        break;

      case 'kick':
        await this.deleteMessage(chatId, messageId);
        await this.kickUser(chatId, userId);
        await this.sendMessage(chatId,
          `🚫 @${username} 因使用不允许的语言已被移出群组\n` +
          `检测到语言: ${languageName}`
        );
        break;
    }
  },

  async deleteMessage(chatId: number, messageId: number): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    try {
      await fetch(
        `https://api.telegram.org/bot${botToken}/deleteMessage?chat_id=${chatId}&message_id=${messageId}`
      );
    } catch (error) {
      console.error('Delete message error:', error);
    }
  },

  async sendMessage(chatId: number, text: string): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    try {
      await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
          })
        }
      );
    } catch (error) {
      console.error('Send message error:', error);
    }
  },

  async muteUser(chatId: number, userId: number, duration: number): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    const untilDate = Math.floor(Date.now() / 1000) + duration;

    try {
      await fetch(
        `https://api.telegram.org/bot${botToken}/restrictChatMember`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            user_id: userId,
            permissions: {
              can_send_messages: false,
              can_send_media_messages: false,
              can_send_other_messages: false,
              can_add_web_page_previews: false
            },
            until_date: untilDate
          })
        }
      );
    } catch (error) {
      console.error('Mute user error:', error);
    }
  },

  async kickUser(chatId: number, userId: number): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    try {
      await fetch(
        `https://api.telegram.org/bot${botToken}/kickChatMember?chat_id=${chatId}&user_id=${userId}`
      );
    } catch (error) {
      console.error('Kick user error:', error);
    }
  },

  async recordDetection(
    message: TelegramMessage,
    result: LanguageDetectionResult
  ): Promise<void> {
    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', message.chat.id)
      .single();

    if (!groupData) return;

    await supabase.from('language_detections').insert({
      telegram_id: message.from?.id,
      group_id: groupData.id,
      chat_id: message.chat.id,
      message_id: message.message_id,
      message_text: (message.text || message.caption || '').substring(0, 500),
      detected_language: result.language,
      confidence: result.confidence,
      is_allowed: result.is_allowed,
      provider: result.provider,
      action_taken: result.is_allowed ? 'none' : 'handled'
    });
  },

  getLanguageName(code: string): string {
    return LANGUAGE_NAMES[code] || code;
  },

  getSupportedLanguages(): { code: string; name: string }[] {
    return Object.entries(LANGUAGE_NAMES)
      .filter(([code]) => code !== 'unknown')
      .map(([code, name]) => ({ code, name }));
  },

  async getDetectionStats(
    chatId: number,
    days: number = 7
  ): Promise<{
    total_detections: number;
    disallowed_count: number;
    allowed_count: number;
    by_language: Record<string, number>;
    top_disallowed: { language: string; count: number }[];
  }> {
    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) {
      return {
        total_detections: 0,
        disallowed_count: 0,
        allowed_count: 0,
        by_language: {},
        top_disallowed: []
      };
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: detections } = await supabase
      .from('language_detections')
      .select('is_allowed, detected_language')
      .eq('group_id', groupData.id)
      .gte('created_at', startDate.toISOString());

    let disallowedCount = 0;
    let allowedCount = 0;
    const byLanguage: Record<string, number> = {};
    const disallowedByLanguage: Record<string, number> = {};

    for (const detection of detections || []) {
      if (detection.is_allowed) {
        allowedCount++;
      } else {
        disallowedCount++;
        disallowedByLanguage[detection.detected_language] = 
          (disallowedByLanguage[detection.detected_language] || 0) + 1;
      }

      byLanguage[detection.detected_language] = 
        (byLanguage[detection.detected_language] || 0) + 1;
    }

    const topDisallowed = Object.entries(disallowedByLanguage)
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total_detections: (detections?.length || 0),
      disallowed_count: disallowedCount,
      allowed_count: allowedCount,
      by_language: byLanguage,
      top_disallowed: topDisallowed
    };
  },

  async getLanguageWhitelistConfig(groupId: string): Promise<LanguageWhitelistConfig> {
    const { data } = await supabase
      .from('group_configs')
      .select('language_whitelist_config')
      .eq('group_id', groupId)
      .single();

    return data?.language_whitelist_config || {
      enabled: false,
      allowed_languages: ['zh', 'en'],
      detection_method: 'local',
      confidence_threshold: 0.7,
      action: 'delete',
      warn_message: '⚠️ {user} 请使用允许的语言\n检测到语言: {language}\n允许的语言: {allowed}\n警告次数: {count}/{max}',
      mute_duration: 3600,
      max_warnings: 3,
      whitelist_users: [],
      whitelist_commands: true,
      min_message_length: 3
    };
  },

  async setLanguageWhitelistConfig(
    groupId: string,
    config: Partial<LanguageWhitelistConfig>
  ): Promise<void> {
    await supabase
      .from('group_configs')
      .update({ language_whitelist_config: config })
      .eq('group_id', groupId);
  }
};

export default languageWhitelistService;

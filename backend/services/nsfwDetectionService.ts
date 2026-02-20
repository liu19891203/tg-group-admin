import { supabase } from '../lib/database';
import { Redis } from '@upstash/redis';
import { TelegramMessage } from '../types/telegram';

interface NSFWConfig {
  enabled: boolean;
  provider: 'sightengine' | 'deepai' | 'nsfwjs' | 'custom';
  api_key?: string;
  api_url?: string;
  threshold: number;
  action: 'delete' | 'warn' | 'mute' | 'kick' | 'ban';
  warn_threshold: number;
  mute_duration: number;
  log_detections: boolean;
  notify_admins: boolean;
  admin_chat_id?: number;
  check_photos: boolean;
  check_videos: boolean;
  check_documents: boolean;
  whitelist_users: number[];
}

interface NSFWResult {
  is_nsfw: boolean;
  confidence: number;
  categories: {
    porn: number;
    hentai: number;
    sexy: number;
    neutral: number;
  };
  provider: string;
  processing_time: number;
}

interface DetectionRecord {
  id: string;
  telegram_id: number;
  chat_id: number;
  message_id: number;
  file_type: string;
  file_id: string;
  is_nsfw: boolean;
  confidence: number;
  categories: Record<string, number>;
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

export const nsfwDetectionService = {
  async detectImage(
    message: TelegramMessage,
    config: NSFWConfig
  ): Promise<NSFWResult | null> {
    if (!config.enabled) {
      return null;
    }

    const userId = message.from?.id;
    if (userId && config.whitelist_users.includes(userId)) {
      return null;
    }

    let fileUrl: string | null = null;
    let fileType = 'photo';

    if (message.photo && message.photo.length > 0 && config.check_photos) {
      const largestPhoto = message.photo[message.photo.length - 1];
      fileUrl = await this.getFileUrl(largestPhoto.file_id);
      fileType = 'photo';
    } else if (message.video && config.check_videos) {
      fileUrl = await this.getFileUrl(message.video.file_id);
      fileType = 'video';
    } else if (message.document && config.check_documents) {
      const mimeType = message.document.mime_type || '';
      if (mimeType.startsWith('image/')) {
        fileUrl = await this.getFileUrl(message.document.file_id);
        fileType = 'document';
      }
    }

    if (!fileUrl) {
      return null;
    }

    const startTime = Date.now();
    let result: NSFWResult;

    switch (config.provider) {
      case 'sightengine':
        result = await this.detectWithSightEngine(fileUrl, config.api_key || '');
        break;
      case 'deepai':
        result = await this.detectWithDeepAI(fileUrl, config.api_key || '');
        break;
      case 'nsfwjs':
        result = await this.detectWithNSFWJS(fileUrl, config.api_url || '');
        break;
      case 'custom':
        result = await this.detectWithCustomAPI(fileUrl, config.api_url || '', config.api_key || '');
        break;
      default:
        return null;
    }

    result.processing_time = Date.now() - startTime;

    if (result.is_nsfw) {
      await this.handleNSFWContent(message, result, config, fileType);
    }

    await this.recordDetection(message, result, fileType);

    return result;
  },

  async detectWithSightEngine(imageUrl: string, apiKey: string): Promise<NSFWResult> {
    try {
      const [apiUser, apiSecret] = apiKey.split(':');
      
      const response = await fetch('https://api.sightengine.com/1.0/check.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          url: imageUrl,
          models: 'nudity-2.1',
          api_user: apiUser,
          api_secret: apiSecret
        })
      });

      const data = await response.json();

      if (data.status === 'success') {
        return {
          is_nsfw: data.nudity.sexual_activity > 0.5 || data.nudity.sexual_display > 0.5,
          confidence: Math.max(data.nudity.sexual_activity, data.nudity.sexual_display),
          categories: {
            porn: data.nudity.sexual_activity || 0,
            hentai: 0,
            sexy: data.nudity.sexual_display || 0,
            neutral: data.nudity.none || 0
          },
          provider: 'sightengine',
          processing_time: 0
        };
      }
    } catch (error) {
      console.error('SightEngine detection error:', error);
    }

    return this.getDefaultResult('sightengine');
  },

  async detectWithDeepAI(imageUrl: string, apiKey: string): Promise<NSFWResult> {
    try {
      const response = await fetch('https://api.deepai.org/api/nsfw-detector', {
        method: 'POST',
        headers: {
          'Api-Key': apiKey
        },
        body: new URLSearchParams({
          image: imageUrl
        })
      });

      const data = await response.json();

      if (data.output) {
        const nsfwScore = data.output.nsfw_score || 0;
        return {
          is_nsfw: nsfwScore > 0.5,
          confidence: nsfwScore,
          categories: {
            porn: nsfwScore,
            hentai: 0,
            sexy: 0,
            neutral: 1 - nsfwScore
          },
          provider: 'deepai',
          processing_time: 0
        };
      }
    } catch (error) {
      console.error('DeepAI detection error:', error);
    }

    return this.getDefaultResult('deepai');
  },

  async detectWithNSFWJS(imageUrl: string, apiUrl: string): Promise<NSFWResult> {
    try {
      const response = await fetch(`${apiUrl}/classify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ image: imageUrl })
      });

      const data = await response.json();

      if (data.predictions) {
        const pornScore = data.predictions.Porn || 0;
        const hentaiScore = data.predictions.Hentai || 0;
        const sexyScore = data.predictions.Sexy || 0;
        const neutralScore = data.predictions.Neutral || 0;

        const maxNsfwScore = Math.max(pornScore, hentaiScore, sexyScore);

        return {
          is_nsfw: maxNsfwScore > 0.5,
          confidence: maxNsfwScore,
          categories: {
            porn: pornScore,
            hentai: hentaiScore,
            sexy: sexyScore,
            neutral: neutralScore
          },
          provider: 'nsfwjs',
          processing_time: 0
        };
      }
    } catch (error) {
      console.error('NSFWJS detection error:', error);
    }

    return this.getDefaultResult('nsfwjs');
  },

  async detectWithCustomAPI(imageUrl: string, apiUrl: string, apiKey: string): Promise<NSFWResult> {
    try {
      const response = await fetch(`${apiUrl}/detect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({ image_url: imageUrl })
      });

      const data = await response.json();

      if (data.result) {
        return {
          is_nsfw: data.result.is_nsfw || false,
          confidence: data.result.confidence || 0,
          categories: data.result.categories || {
            porn: 0,
            hentai: 0,
            sexy: 0,
            neutral: 1
          },
          provider: 'custom',
          processing_time: 0
        };
      }
    } catch (error) {
      console.error('Custom API detection error:', error);
    }

    return this.getDefaultResult('custom');
  },

  getDefaultResult(provider: string): NSFWResult {
    return {
      is_nsfw: false,
      confidence: 0,
      categories: {
        porn: 0,
        hentai: 0,
        sexy: 0,
        neutral: 1
      },
      provider,
      processing_time: 0
    };
  },

  async getFileUrl(fileId: string): Promise<string | null> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return null;

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`
      );
      const data = await response.json();

      if (data.ok) {
        return `https://api.telegram.org/file/bot${botToken}/${data.result.file_path}`;
      }
    } catch (error) {
      console.error('Get file URL error:', error);
    }

    return null;
  },

  async handleNSFWContent(
    message: TelegramMessage,
    result: NSFWResult,
    config: NSFWConfig,
    fileType: string
  ): Promise<void> {
    const chatId = message.chat.id;
    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || '用户';
    const messageId = message.message_id;

    if (!userId) return;

    const action = config.action;

    switch (action) {
      case 'delete':
        await this.deleteMessage(chatId, messageId);
        break;
      case 'warn':
        await this.deleteMessage(chatId, messageId);
        await this.warnUser(chatId, userId, '发送不当内容');
        break;
      case 'mute':
        await this.deleteMessage(chatId, messageId);
        await this.muteUser(chatId, userId, config.mute_duration);
        break;
      case 'kick':
        await this.deleteMessage(chatId, messageId);
        await this.kickUser(chatId, userId);
        break;
      case 'ban':
        await this.deleteMessage(chatId, messageId);
        await this.banUser(chatId, userId);
        break;
    }

    if (config.notify_admins && config.admin_chat_id) {
      await this.notifyAdmins(
        config.admin_chat_id,
        chatId,
        userId,
        username,
        result,
        fileType,
        action
      );
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

  async warnUser(chatId: number, userId: number, reason: string): Promise<void> {
    const redis = getRedis();
    const key = `nsfw_warns:${chatId}:${userId}`;

    if (redis) {
      const warns = await redis.incr(key);
      await redis.expire(key, 86400 * 7);
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

  async banUser(chatId: number, userId: number): Promise<void> {
    await this.kickUser(chatId, userId);
  },

  async notifyAdmins(
    adminChatId: number,
    chatId: number,
    userId: number,
    username: string,
    result: NSFWResult,
    fileType: string,
    action: string
  ): Promise<void> {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return;

    const message = `🚨 检测到不当内容\n\n` +
      `群组: ${chatId}\n` +
      `用户: @${username} (${userId})\n` +
      `类型: ${fileType}\n` +
      `置信度: ${(result.confidence * 100).toFixed(1)}%\n` +
      `分类: Porn ${(result.categories.porn * 100).toFixed(1)}%, ` +
      `Sexy ${(result.categories.sexy * 100).toFixed(1)}%\n` +
      `处理: ${action}`;

    try {
      await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: adminChatId,
            text: message
          })
        }
      );
    } catch (error) {
      console.error('Notify admins error:', error);
    }
  },

  async recordDetection(
    message: TelegramMessage,
    result: NSFWResult,
    fileType: string
  ): Promise<void> {
    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', message.chat.id)
      .single();

    if (!groupData) return;

    await supabase.from('nsfw_detections').insert({
      telegram_id: message.from?.id,
      group_id: groupData.id,
      chat_id: message.chat.id,
      message_id: message.message_id,
      file_type: fileType,
      file_id: message.photo?.[0]?.file_id || message.video?.file_id || message.document?.file_id,
      is_nsfw: result.is_nsfw,
      confidence: result.confidence,
      categories: result.categories,
      provider: result.provider,
      action_taken: result.is_nsfw ? 'handled' : 'none'
    });
  },

  async getDetectionStats(
    chatId: number,
    days: number = 7
  ): Promise<{
    total_detections: number;
    nsfw_count: number;
    safe_count: number;
    by_type: Record<string, number>;
    by_provider: Record<string, number>;
  }> {
    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) {
      return {
        total_detections: 0,
        nsfw_count: 0,
        safe_count: 0,
        by_type: {},
        by_provider: {}
      };
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: detections } = await supabase
      .from('nsfw_detections')
      .select('is_nsfw, file_type, provider')
      .eq('group_id', groupData.id)
      .gte('created_at', startDate.toISOString());

    let nsfwCount = 0;
    let safeCount = 0;
    const byType: Record<string, number> = {};
    const byProvider: Record<string, number> = {};

    for (const detection of detections || []) {
      if (detection.is_nsfw) {
        nsfwCount++;
      } else {
        safeCount++;
      }

      byType[detection.file_type] = (byType[detection.file_type] || 0) + 1;
      byProvider[detection.provider] = (byProvider[detection.provider] || 0) + 1;
    }

    return {
      total_detections: (detections?.length || 0),
      nsfw_count: nsfwCount,
      safe_count: safeCount,
      by_type: byType,
      by_provider: byProvider
    };
  },

  async getNSFWConfig(groupId: string): Promise<NSFWConfig> {
    const { data } = await supabase
      .from('group_configs')
      .select('nsfw_config')
      .eq('group_id', groupId)
      .single();

    return data?.nsfw_config || {
      enabled: false,
      provider: 'deepai',
      threshold: 0.7,
      action: 'delete',
      warn_threshold: 3,
      mute_duration: 3600,
      log_detections: true,
      notify_admins: false,
      check_photos: true,
      check_videos: true,
      check_documents: true,
      whitelist_users: []
    };
  },

  async setNSFWConfig(groupId: string, config: Partial<NSFWConfig>): Promise<void> {
    await supabase
      .from('group_configs')
      .update({ nsfw_config: config })
      .eq('group_id', groupId);
  }
};

export default nsfwDetectionService;

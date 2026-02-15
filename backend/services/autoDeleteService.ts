import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  
  supabaseInstance = createClient(url, key);
  return supabaseInstance;
}

const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    return getSupabase()[prop as keyof SupabaseClient];
  }
});

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export interface AutoDeleteConfig {
  enabled: boolean;
  delete_commands: boolean;
  delete_after_seconds: number;
  delete_bot_messages: boolean;
  delete_media: boolean;
  exceptions: string[];
  rules?: AutoDeleteRule[];
}

export interface AutoDeleteRule {
  type: 'porn' | 'external' | 'sticker' | 'link' | 'long' | 'video' | 'doc' | 'exec' | 'forward' | 'command' | 'media' | 'contact' | 'premium_emoji' | 'archive' | 'all';
  keywords?: string[];
  regex?: string;
  delete_after?: number;
  notify: boolean;
}

export interface PendingDeleteMessage {
  id: string;
  chat_id: number;
  message_id: number;
  delete_at: string;
  reason?: string;
  created_at: string;
}

async function callTelegramApi(method: string, params: Record<string, any>): Promise<any> {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return response.json();
}

export const autoDeleteService = {
  async check(message: any, config: AutoDeleteConfig): Promise<{ shouldDelete: boolean; reason?: string; delay: number }> {
    if (!config.enabled) {
      return { shouldDelete: false, delay: 0 };
    }

    const text = message.text || message.caption || '';
    const delay = config.delete_after_seconds || 0;

    if (config.delete_commands && text.startsWith('/')) {
      const hasException = config.exceptions?.some(kw => text.toLowerCase().includes(kw.toLowerCase()));
      if (!hasException) {
        return { shouldDelete: true, reason: 'command', delay };
      }
    }

    if (config.delete_media) {
      const hasMedia = message.photo || message.video || message.document || message.audio || message.voice;
      if (hasMedia) {
        const hasException = config.exceptions?.some(kw => text.toLowerCase().includes(kw.toLowerCase()));
        if (!hasException) {
          return { shouldDelete: true, reason: 'media', delay };
        }
      }
    }

    if (config.rules && config.rules.length > 0) {
      for (const rule of config.rules) {
        const result = await this.checkRule(message, rule, text);
        if (result.shouldDelete) {
          return { shouldDelete: true, reason: result.reason, delay: rule.delete_after || delay };
        }
      }
    }

    return { shouldDelete: false, delay: 0 };
  },

  async checkRule(message: any, rule: AutoDeleteRule, text: string): Promise<{ shouldDelete: boolean; reason?: string }> {
    switch (rule.type) {
      case 'command':
        if (text.startsWith('/')) {
          return { shouldDelete: true, reason: 'command' };
        }
        break;

      case 'media':
        if (message.photo || message.video || message.document || message.audio || message.voice) {
          return { shouldDelete: true, reason: 'media' };
        }
        break;

      case 'sticker':
        if (message.sticker) {
          return { shouldDelete: true, reason: 'sticker' };
        }
        break;

      case 'video':
        if (message.video || message.video_note) {
          return { shouldDelete: true, reason: 'video' };
        }
        break;

      case 'doc':
        if (message.document && !message.document.mime_type?.startsWith('image/')) {
          return { shouldDelete: true, reason: 'document' };
        }
        break;

      case 'exec':
        if (message.document) {
          const execExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.js', '.jar'];
          const filename = message.document.file_name?.toLowerCase() || '';
          if (execExtensions.some(ext => filename.endsWith(ext))) {
            return { shouldDelete: true, reason: 'executable' };
          }
        }
        break;

      case 'archive':
        if (message.document) {
          const archiveExtensions = ['.zip', '.rar', '.7z', '.tar', '.gz'];
          const filename = message.document.file_name?.toLowerCase() || '';
          if (archiveExtensions.some(ext => filename.endsWith(ext))) {
            return { shouldDelete: true, reason: 'archive' };
          }
        }
        break;

      case 'link':
        const urlPattern = /https?:\/\/[^\s]+/gi;
        if (urlPattern.test(text)) {
          if (rule.keywords && rule.keywords.length > 0) {
            const hasException = rule.keywords.some(kw => text.toLowerCase().includes(kw.toLowerCase()));
            if (!hasException) {
              return { shouldDelete: true, reason: 'link' };
            }
          } else {
            return { shouldDelete: true, reason: 'link' };
          }
        }
        break;

      case 'forward':
        if (message.forward_from || message.forward_from_chat) {
          return { shouldDelete: true, reason: 'forward' };
        }
        break;

      case 'contact':
        if (message.contact) {
          return { shouldDelete: true, reason: 'contact' };
        }
        break;

      case 'premium_emoji':
        if (message.entities) {
          const hasPremiumEmoji = message.entities.some((e: any) => e.type === 'custom_emoji');
          if (hasPremiumEmoji) {
            return { shouldDelete: true, reason: 'premium_emoji' };
          }
        }
        break;

      case 'long':
        const threshold = 1000;
        if (text.length > threshold) {
          return { shouldDelete: true, reason: 'long_message' };
        }
        break;

      case 'all':
        return { shouldDelete: true, reason: 'all_messages' };

      default:
        break;
    }

    if (rule.keywords && rule.keywords.length > 0) {
      const hasKeyword = rule.keywords.some(kw => text.toLowerCase().includes(kw.toLowerCase()));
      if (hasKeyword) {
        return { shouldDelete: true, reason: 'keyword_match' };
      }
    }

    if (rule.regex) {
      try {
        const regex = new RegExp(rule.regex, 'i');
        if (regex.test(text)) {
          return { shouldDelete: true, reason: 'regex_match' };
        }
      } catch (e) {
        console.error('Invalid regex pattern:', rule.regex);
      }
    }

    return { shouldDelete: false };
  },

  async scheduleDelete(chatId: number, messageId: number, delaySeconds: number, reason?: string): Promise<void> {
    const deleteAt = new Date(Date.now() + delaySeconds * 1000).toISOString();

    const { error } = await supabase
      .from('pending_delete_messages')
      .insert({
        chat_id: chatId,
        message_id: messageId,
        delete_at: deleteAt,
        reason: reason
      });

    if (error) {
      console.error('Error scheduling message delete:', error);
    } else {
      console.log('Message scheduled for delete:', { chatId, messageId, deleteAt, reason });
    }
  },

  async deleteNow(chatId: number, messageId: number): Promise<boolean> {
    try {
      const result = await callTelegramApi('deleteMessage', {
        chat_id: chatId,
        message_id: messageId
      });

      if (result.ok) {
        console.log('Message deleted:', { chatId, messageId });
        return true;
      } else {
        console.error('Failed to delete message:', result);
        return false;
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      return false;
    }
  },

  async processPendingDeletes(): Promise<{ processed: number; success: number; failed: number }> {
    const now = new Date().toISOString();

    const { data: pendingMessages, error } = await supabase
      .from('pending_delete_messages')
      .select('*')
      .lte('delete_at', now)
      .limit(100);

    if (error) {
      console.error('Error fetching pending deletes:', error);
      return { processed: 0, success: 0, failed: 0 };
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      return { processed: 0, success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;
    const processedIds: string[] = [];

    for (const msg of pendingMessages) {
      const deleted = await this.deleteNow(msg.chat_id, msg.message_id);
      
      if (deleted) {
        success++;
      } else {
        failed++;
      }
      
      processedIds.push(msg.id);
    }

    if (processedIds.length > 0) {
      await supabase
        .from('pending_delete_messages')
        .delete()
        .in('id', processedIds);
    }

    console.log(`Processed ${pendingMessages.length} pending deletes: ${success} success, ${failed} failed`);
    return { processed: pendingMessages.length, success, failed };
  },

  async handleAutoDelete(message: any, config: AutoDeleteConfig): Promise<void> {
    const result = await this.check(message, config);

    if (result.shouldDelete) {
      const chatId = message.chat.id;
      const messageId = message.message_id;

      if (result.delay > 0) {
        await this.scheduleDelete(chatId, messageId, result.delay, result.reason);
      } else {
        await this.deleteNow(chatId, messageId);
      }
    }
  }
};

export default autoDeleteService;

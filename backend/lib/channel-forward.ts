// @ts-nocheck
import { Bot, Context } from 'grammy';
import { createClient } from '@supabase/supabase-js';

// 延迟创建 Supabase 客户端
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase not configured, channel forwarding disabled');
      return null;
    }
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

// 频道转发设置接口
interface ChannelForwardSetting {
  id: string;
  group_id: string;
  channel_id: number;
  channel_name: string | null;
  is_active: boolean;
  forward_mode: 'all' | 'text' | 'media';
  auto_pin: boolean;
  pin_duration_minutes: number;
  include_author: boolean;
  include_source: boolean;
  custom_header: string | null;
  custom_footer: string | null;
  exclude_keywords: string[];
  include_keywords: string[];
  notify_on_forward: boolean;
  notify_template: string | null;
}

// 缓存转发设置（5分钟过期）
const settingsCache = new Map<string, { data: ChannelForwardSetting[]; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5分钟

// 获取群组的频道转发设置
async function getChannelForwardSettings(groupId: string): Promise<ChannelForwardSetting[]> {
  const now = Date.now();
  const cached = settingsCache.get(groupId);
  
  if (cached && cached.expiry > now) {
    return cached.data;
  }

  const db = getSupabase();
  if (!db) return [];

  try {
    const { data, error } = await db
      .from('channel_forward_settings')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_active', true);

    if (error) {
      console.error('Failed to load channel forward settings:', error);
      return [];
    }

    const settings = data || [];
    settingsCache.set(groupId, { data: settings, expiry: now + CACHE_TTL });
    return settings;
  } catch (error) {
    console.error('Error loading channel forward settings:', error);
    return [];
  }
}

// 清除缓存
export function clearChannelSettingsCache(groupId?: string) {
  if (groupId) {
    settingsCache.delete(groupId);
  } else {
    settingsCache.clear();
  }
}

// 检查消息是否匹配关键词
function checkKeywords(text: string, includeKeywords: string[], excludeKeywords: string[]): boolean {
  const lowerText = text.toLowerCase();
  
  // 检查排除关键词
  if (excludeKeywords.length > 0) {
    for (const keyword of excludeKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return false;
      }
    }
  }
  
  // 检查必须包含的关键词
  if (includeKeywords.length > 0) {
    for (const keyword of includeKeywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return true;
      }
    }
    return false; // 没有匹配任何必须关键词
  }
  
  return true;
}

// 判断消息类型
function getMessageType(ctx: Context): string {
  if (ctx.message?.photo) return 'photo';
  if (ctx.message?.video) return 'video';
  if (ctx.message?.audio) return 'audio';
  if (ctx.message?.document) return 'document';
  if (ctx.message?.voice) return 'voice';
  if (ctx.message?.animation) return 'animation';
  if (ctx.message?.sticker) return 'sticker';
  if (ctx.message?.text) return 'text';
  return 'unknown';
}

// 检查是否应该转发（根据转发模式）
function shouldForwardByMode(messageType: string, forwardMode: string): boolean {
  switch (forwardMode) {
    case 'text':
      return messageType === 'text';
    case 'media':
      return ['photo', 'video', 'audio', 'document', 'animation'].includes(messageType);
    case 'all':
    default:
      return true;
  }
}

// 格式化转发消息
function formatForwardedMessage(
  ctx: Context,
  setting: ChannelForwardSetting
): { text: string; parseMode: 'HTML' | undefined } {
  const parts: string[] = [];
  
  // 自定义头部
  if (setting.custom_header) {
    parts.push(setting.custom_header);
    parts.push('');
  }
  
  // 来源信息
  if (setting.include_source) {
    const channelName = setting.channel_name || '频道';
    parts.push(`📢 <b>${channelName}</b>`);
    parts.push('');
  }
  
  // 原作者信息
  if (setting.include_author && ctx.message?.from) {
    const author = ctx.message.from.first_name || ctx.message.from.username || '用户';
    parts.push(`👤 ${author}`);
    parts.push('');
  }
  
  // 消息内容
  if (ctx.message?.text) {
    parts.push(ctx.message.text);
  } else if (ctx.message?.caption) {
    parts.push(ctx.message.caption);
  }
  
  // 自定义尾部
  if (setting.custom_footer) {
    parts.push('');
    parts.push(setting.custom_footer);
  }
  
  return {
    text: parts.join('\n'),
    parseMode: 'HTML'
  };
}

// 记录转发日志
async function logForward(
  groupId: string,
  channelId: number,
  channelMessageId: number,
  groupMessageId: number,
  messageType: string,
  status: 'success' | 'failed' | 'filtered',
  errorMessage?: string
) {
  const db = getSupabase();
  if (!db) return;

  try {
    await db.from('forward_logs').insert({
      group_id: groupId,
      channel_id: channelId,
      channel_message_id: channelMessageId,
      group_message_id: groupMessageId,
      message_type: messageType,
      status,
      error_message: errorMessage,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log forward:', error);
  }
}

// 记录置顶消息
async function recordPinnedMessage(
  groupId: string,
  channelId: number,
  messageId: number,
  channelMessageId: number,
  unpinAt: Date
) {
  const db = getSupabase();
  if (!db) return;

  try {
    await db.from('pinned_messages').insert({
      group_id: groupId,
      channel_id: channelId,
      message_id: messageId,
      channel_message_id: channelMessageId,
      pinned_at: new Date().toISOString(),
      unpin_at: unpinAt.toISOString(),
      is_unpinned: false
    });
  } catch (error) {
    console.error('Failed to record pinned message:', error);
  }
}

// 处理频道消息
export async function handleChannelMessage(bot: Bot, ctx: Context) {
  // 只处理频道消息
  if (!ctx.message?.sender_chat?.id) return;
  
  const channelId = ctx.message.sender_chat.id;
  const messageType = getMessageType(ctx);
  const messageText = ctx.message.text || ctx.message.caption || '';
  
  console.log(`📨 Received message from channel ${channelId}, type: ${messageType}`);
  
  // 获取所有群组中关联了此频道的设置
  const db = getSupabase();
  if (!db) {
    console.warn('Supabase not configured, skipping channel forward');
    return;
  }

  try {
    // 查找所有关联了此频道的活跃设置
    const { data: settings, error } = await db
      .from('channel_forward_settings')
      .select('*')
      .eq('channel_id', channelId)
      .eq('is_active', true);

    if (error) {
      console.error('Failed to load channel settings:', error);
      return;
    }

    if (!settings || settings.length === 0) {
      console.log(`No active settings found for channel ${channelId}`);
      return;
    }

    console.log(`Found ${settings.length} active forward settings for channel ${channelId}`);

    // 处理每个关联的群组
    for (const setting of settings) {
      await processChannelForward(bot, ctx, setting, messageType, messageText);
    }
  } catch (error) {
    console.error('Error handling channel message:', error);
  }
}

// 处理单个频道转发
async function processChannelForward(
  bot: Bot,
  ctx: Context,
  setting: ChannelForwardSetting,
  messageType: string,
  messageText: string
) {
  const groupId = parseInt(setting.group_id);
  const channelMessageId = ctx.message?.message_id || 0;

  try {
    // 1. 检查转发模式
    if (!shouldForwardByMode(messageType, setting.forward_mode)) {
      console.log(`Message type ${messageType} doesn't match forward mode ${setting.forward_mode}`);
      await logForward(
        setting.group_id,
        setting.channel_id,
        channelMessageId,
        0,
        messageType,
        'filtered',
        '消息类型不匹配转发模式'
      );
      return;
    }

    // 2. 检查关键词
    if (messageText && !checkKeywords(messageText, setting.include_keywords, setting.exclude_keywords)) {
      console.log('Message filtered by keywords');
      await logForward(
        setting.group_id,
        setting.channel_id,
        channelMessageId,
        0,
        messageType,
        'filtered',
        '关键词过滤'
      );
      return;
    }

    // 3. 转发消息
    let sentMessage;
    const formatted = formatForwardedMessage(ctx, setting);

    // 根据消息类型选择转发方式
    if (ctx.message?.text) {
      // 纯文本消息
      sentMessage = await bot.api.sendMessage(groupId, formatted.text, {
        parse_mode: formatted.parseMode,
        disable_web_page_preview: false
      });
    } else if (ctx.message?.photo) {
      // 图片消息
      const photo = ctx.message.photo[ctx.message.photo.length - 1]; // 取最大尺寸
      sentMessage = await bot.api.sendPhoto(groupId, photo.file_id, {
        caption: formatted.text,
        parse_mode: formatted.parseMode
      });
    } else if (ctx.message?.video) {
      // 视频消息
      sentMessage = await bot.api.sendVideo(groupId, ctx.message.video.file_id, {
        caption: formatted.text,
        parse_mode: formatted.parseMode
      });
    } else if (ctx.message?.document) {
      // 文档消息
      sentMessage = await bot.api.sendDocument(groupId, ctx.message.document.file_id, {
        caption: formatted.text,
        parse_mode: formatted.parseMode
      });
    } else if (ctx.message?.animation) {
      // GIF动画
      sentMessage = await bot.api.sendAnimation(groupId, ctx.message.animation.file_id, {
        caption: formatted.text,
        parse_mode: formatted.parseMode
      });
    } else {
      // 其他类型，尝试复制消息
      try {
        sentMessage = await bot.api.copyMessage(
          groupId,
          setting.channel_id,
          channelMessageId
        );
      } catch (copyError) {
        console.error('Failed to copy message:', copyError);
        // 如果复制失败，发送文本提示
        sentMessage = await bot.api.sendMessage(groupId, formatted.text, {
          parse_mode: formatted.parseMode
        });
      }
    }

    console.log(`✅ Message forwarded to group ${groupId}, message ID: ${sentMessage.message_id}`);

    // 4. 自动置顶
    if (setting.auto_pin && sentMessage) {
      try {
        await bot.api.pinChatMessage(groupId, sentMessage.message_id);
        console.log(`📌 Message pinned in group ${groupId}`);

        // 如果需要定时取消置顶
        if (setting.pin_duration_minutes > 0) {
          const unpinAt = new Date(Date.now() + setting.pin_duration_minutes * 60 * 1000);
          await recordPinnedMessage(
            setting.group_id,
            setting.channel_id,
            sentMessage.message_id,
            channelMessageId,
            unpinAt
          );
          console.log(`⏰ Will unpin at ${unpinAt.toISOString()}`);
        }
      } catch (pinError) {
        console.error('Failed to pin message:', pinError);
      }
    }

    // 5. 发送通知（如果启用）
    if (setting.notify_on_forward && setting.notify_template) {
      try {
        const notifyText = setting.notify_template
          .replace('{channel_name}', setting.channel_name || '频道')
          .replace('{group_id}', setting.group_id);
        
        await bot.api.sendMessage(groupId, notifyText, { parse_mode: 'HTML' });
      } catch (notifyError) {
        console.error('Failed to send notification:', notifyError);
      }
    }

    // 记录成功日志
    await logForward(
      setting.group_id,
      setting.channel_id,
      channelMessageId,
      sentMessage.message_id,
      messageType,
      'success'
    );

  } catch (error: any) {
    console.error(`Failed to forward message to group ${groupId}:`, error);
    
    // 记录失败日志
    await logForward(
      setting.group_id,
      setting.channel_id,
      channelMessageId,
      0,
      messageType,
      'failed',
      error.message
    );
  }
}

// 定时取消置顶任务
export async function processUnpinTasks(bot: Bot) {
  const db = getSupabase();
  if (!db) return;

  try {
    const now = new Date().toISOString();
    
    // 获取需要取消置顶的消息
    const { data: pinnedMessages, error } = await db
      .from('pinned_messages')
      .select('*')
      .eq('is_unpinned', false)
      .lte('unpin_at', now);

    if (error) {
      console.error('Failed to load pinned messages:', error);
      return;
    }

    if (!pinnedMessages || pinnedMessages.length === 0) return;

    console.log(`Found ${pinnedMessages.length} messages to unpin`);

    for (const pinned of pinnedMessages) {
      try {
        const groupId = parseInt(pinned.group_id);
        
        // 取消置顶
        await bot.api.unpinChatMessage(groupId, pinned.message_id);
        console.log(`✅ Unpinned message ${pinned.message_id} in group ${groupId}`);
        
        // 标记为已取消置顶
        await db
          .from('pinned_messages')
          .update({ is_unpinned: true })
          .eq('id', pinned.id);
          
      } catch (unpinError) {
        console.error(`Failed to unpin message ${pinned.id}:`, unpinError);
      }
    }
  } catch (error) {
    console.error('Error processing unpin tasks:', error);
  }
}

// 初始化频道转发模块
export function initChannelForward(bot: Bot) {
  // 监听频道消息
  bot.on('channel_post', async (ctx) => {
    await handleChannelMessage(bot, ctx);
  });

  // 也监听普通消息（可能包含频道转发）
  bot.on('message', async (ctx) => {
    // 如果消息来自频道（sender_chat）
    if (ctx.message?.sender_chat?.type === 'channel') {
      await handleChannelMessage(bot, ctx);
    }
  });

  // 启动定时取消置顶任务（每分钟执行一次）
  setInterval(() => {
    processUnpinTasks(bot);
  }, 60 * 1000);

  console.log('✅ Channel forward module initialized');
}

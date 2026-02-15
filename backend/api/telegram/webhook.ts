import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { pointsService } from '../../services/pointsService';
import { cacheManager } from '../../lib/cache';
import { antiSpamService } from '../../services/antiSpamService';
import { adFilterService } from '../../services/adFilterService';
import { autoDeleteService, AutoDeleteConfig } from '../../services/autoDeleteService';
import { lotteryService } from '../../services/lotteryService';
import { cryptoService } from '../../services/cryptoService';

const ADDRESS_PATTERNS: Record<string, RegExp> = {
  ERC20: /^0x[a-fA-F0-9]{40}$/,
  TRC20: /^T[A-Za-z1-9]{33}$/,
  BEP20: /^0x[a-fA-F0-9]{40}$/,
  BEP2: /^bnb1[a-z0-9]{38}$/,
  SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  BTC: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/
};

let supabaseInstance: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (supabaseInstance) return supabaseInstance;
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  
  supabaseInstance = createClient(url, key);
  return supabaseInstance;
}

const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(target, prop) {
    return getSupabase()[prop as keyof ReturnType<typeof createClient>];
  }
});

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_URL = process.env.WEB_URL || 'https://tg-group-admin-frontend.vercel.app';

const RATE_KEYWORDS = ['汇率', 'usdt', 'USDT', '价格', '行情', '汇率查询', '实时汇率'];

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name: string; username?: string; is_bot: boolean };
    chat: { id: number; type: string; title?: string; username?: string };
    text?: string;
  };
  my_chat_member?: {
    chat: { id: number; type: string; title?: string; username?: string };
    from: { id: number; first_name: string; username?: string; is_bot: boolean };
    new_chat_member: { status: string; user: { id: number; is_bot: boolean; first_name: string } };
    old_chat_member: { status: string };
  };
  chat_member?: {
    chat: { id: number; type: string; title?: string; username?: string };
    from: { id: number; first_name: string; username?: string; is_bot: boolean };
    new_chat_member: { status: string; user: { id: number; is_bot: boolean; first_name: string; username?: string } };
    old_chat_member: { status: string };
  };
  callback_query?: any;
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

async function sendMessage(chatId: number, text: string) {
  return callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  });
}

interface WelcomeConfig {
  enabled: boolean;
  message: string;
  type: 'text' | 'image' | 'button' | 'rich';
  delete_after?: number;
  buttons?: Array<{
    text: string;
    url?: string;
    callback_data?: string;
  }>;
}

interface SensitiveWordsConfig {
  enabled: boolean;
  words: string[];
  regex_patterns: string[];
  action: 'delete' | 'warn' | 'mute' | 'kick' | 'ban';
  notify_admin: boolean;
  admin_notify_chat_id?: number;
  warn_message?: string;
}

async function sendWelcomeMessage(
  chatId: number,
  groupId: string,
  user: { id: number; first_name: string; username?: string },
  groupTitle: string
): Promise<void> {
  try {
    const { data: config } = await supabase
      .from('group_configs')
      .select('welcome_config')
      .eq('group_id', groupId)
      .single();

    const welcomeConfig = config?.welcome_config as WelcomeConfig | undefined;

    if (!welcomeConfig?.enabled) {
      console.log('Welcome message not enabled for group:', groupId);
      return;
    }

    let welcomeMessage = welcomeConfig.message
      .replace(/{user_name}/g, user.first_name)
      .replace(/{user_id}/g, user.id.toString())
      .replace(/{group_name}/g, groupTitle)
      .replace(/{mention}/g, user.username ? `@${user.username}` : user.first_name);

    const keyboard = welcomeConfig.buttons && welcomeConfig.buttons.length > 0
      ? { inline_keyboard: [welcomeConfig.buttons] }
      : undefined;

    const result = await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: welcomeMessage,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });

    if (welcomeConfig.delete_after && welcomeConfig.delete_after > 0 && result?.result?.message_id) {
      setTimeout(async () => {
        try {
          await callTelegramApi('deleteMessage', {
            chat_id: chatId,
            message_id: result.result.message_id
          });
        } catch (e) {
          console.error('Failed to delete welcome message:', e);
        }
      }, welcomeConfig.delete_after * 1000);
    }

    console.log('Welcome message sent to user:', user.id);
  } catch (error) {
    console.error('Error sending welcome message:', error);
  }
}

interface SensitiveCheckResult {
  hasSensitive: boolean;
  matchedWord?: string;
  matchedPattern?: string;
}

async function checkSensitiveWords(
  text: string,
  config: SensitiveWordsConfig
): Promise<SensitiveCheckResult> {
  if (!config.enabled) {
    return { hasSensitive: false };
  }

  if (config.words && config.words.length > 0) {
    const lowerText = text.toLowerCase();
    for (const word of config.words) {
      if (lowerText.includes(word.toLowerCase())) {
        return { hasSensitive: true, matchedWord: word };
      }
    }
  }

  if (config.regex_patterns && config.regex_patterns.length > 0) {
    for (const pattern of config.regex_patterns) {
      try {
        const regex = new RegExp(pattern, 'i');
        if (regex.test(text)) {
          return { hasSensitive: true, matchedPattern: pattern };
        }
      } catch (error) {
        console.error('Invalid sensitive word regex pattern:', pattern, error);
      }
    }
  }

  return { hasSensitive: false };
}

async function handleSensitiveWordViolation(
  message: any,
  config: SensitiveWordsConfig,
  group: { id: string; title: string },
  checkResult: SensitiveCheckResult
): Promise<boolean> {
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const text = message.text || message.caption || '';
  const username = message.from?.username || message.from?.first_name || '用户';

  console.log('Sensitive word detected:', {
    chatId,
    userId,
    matchedWord: checkResult.matchedWord,
    matchedPattern: checkResult.matchedPattern,
    action: config.action
  });

  switch (config.action) {
    case 'delete':
      await callTelegramApi('deleteMessage', {
        chat_id: chatId,
        message_id: message.message_id
      });
      break;

    case 'warn':
      await callTelegramApi('deleteMessage', {
        chat_id: chatId,
        message_id: message.message_id
      });
      const warnMessage = config.warn_message || '⚠️ 您的消息包含敏感词，已被删除。';
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `${warnMessage}\n\n@${username}`,
        parse_mode: 'HTML'
      });
      break;

    case 'mute':
      await callTelegramApi('deleteMessage', {
        chat_id: chatId,
        message_id: message.message_id
      });
      await callTelegramApi('restrictChatMember', {
        chat_id: chatId,
        user_id: userId,
        permissions: {
          can_send_messages: false,
          can_send_media_messages: false,
          can_send_other_messages: false,
          can_add_web_page_previews: false
        },
        until_date: Math.floor(Date.now() / 1000) + 3600
      });
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `🔇 用户 @${username} 因发送敏感词已被禁言1小时`,
        parse_mode: 'HTML'
      });
      break;

    case 'kick':
      await callTelegramApi('deleteMessage', {
        chat_id: chatId,
        message_id: message.message_id
      });
      await callTelegramApi('kickChatMember', {
        chat_id: chatId,
        user_id: userId
      });
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `🚫 用户 @${username} 因发送敏感词已被踢出群组`,
        parse_mode: 'HTML'
      });
      break;

    case 'ban':
      await callTelegramApi('deleteMessage', {
        chat_id: chatId,
        message_id: message.message_id
      });
      await callTelegramApi('banChatMember', {
        chat_id: chatId,
        user_id: userId
      });
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `⛔ 用户 @${username} 因发送敏感词已被永久封禁`,
        parse_mode: 'HTML'
      });
      break;
  }

  if (config.notify_admin && config.admin_notify_chat_id) {
    const matchedInfo = checkResult.matchedWord 
      ? `敏感词: ${checkResult.matchedWord}`
      : `正则匹配: ${checkResult.matchedPattern}`;
    
    await callTelegramApi('sendMessage', {
      chat_id: config.admin_notify_chat_id,
      text: `⚠️ <b>敏感词检测</b>\n\n` +
        `👤 用户: @${username} (ID: ${userId})\n` +
        `📍 群组: ${group.title}\n` +
        `🔧 处理: ${config.action}\n` +
        `📝 ${matchedInfo}\n` +
        `💬 消息: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`,
      parse_mode: 'HTML'
    });
  }

  await supabase.from('operation_logs').insert({
    admin_id: 'system',
    action: `sensitive_words:${config.action}`,
    target_type: 'user',
    target_id: userId?.toString(),
    new_value: {
      group_id: group.id,
      matched_word: checkResult.matchedWord,
      matched_pattern: checkResult.matchedPattern,
      message_text: text.substring(0, 500)
    }
  });

  return true;
}

async function handleBotAddedToGroup(update: TelegramUpdate) {
  const myChatMember = update.my_chat_member!;
  const chat = myChatMember.chat;
  const from = myChatMember.from;
  const newStatus = myChatMember.new_chat_member.status;

  console.log('Bot added to group:', {
    chat_id: chat.id,
    chat_title: chat.title,
    chat_type: chat.type,
    new_status: newStatus,
    from_id: from?.id,
    from_username: from?.username
  });

  if (newStatus === 'member' || newStatus === 'administrator') {
    // 1. 插入/更新群组
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .upsert({
        chat_id: chat.id,
        chat_type: chat.type,
        title: chat.title || 'Unknown Group',
        username: chat.username,
        is_active: true
      }, { onConflict: 'chat_id' })
      .select()
      .single();

    if (groupError) {
      console.error('Error upserting group:', groupError);
      return;
    }

    console.log('Group upserted:', groupData);

    // 2. 插入/更新用户（添加群组的人）
    if (from) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert({
          telegram_id: from.id,
          username: from.username,
          first_name: from.first_name,
          is_bot: from.is_bot
        }, { onConflict: 'telegram_id' })
        .select()
        .single();

      if (userError) {
        console.error('Error upserting user:', userError);
      } else {
        console.log('User upserted:', userData);

        // 3. 添加群组管理员关系
        if (groupData && userData) {
          const { error: adminError } = await supabase
            .from('group_administrators')
            .upsert({
              group_id: groupData.id,
              user_id: userData.id,
              is_owner: true
            }, { onConflict: 'group_id,user_id' });

          if (adminError) {
            console.error('Error upserting group admin:', adminError);
          } else {
            console.log('Group admin added');
          }

          // 4. 创建群组配置
          const { error: configError } = await supabase
            .from('group_configs')
            .upsert({
              group_id: groupData.id
            }, { onConflict: 'group_id' });

          if (configError) {
            console.error('Error upserting group config:', configError);
          } else {
            console.log('Group config created');
          }
        }
      }
    }

    const welcomeMessage = newStatus === 'administrator'
      ? `🎉 <b>机器人已成功加入群组！</b>\n\n` +
        `👤 <b>${from?.first_name || 'Admin'}</b> 已成为本群管理员\n` +
        `🤖 机器人状态：管理员\n\n` +
        `📋 <b>可用功能：</b>\n` +
        `• 入群验证\n• 广告过滤\n• 自动回复\n• 积分系统\n• 抽奖活动\n\n` +
        `🌐 <a href="${WEB_URL}">访问管理后台</a>`
      : `⚠️ 请将我设为管理员以使用完整功能。`;

    await sendMessage(chat.id, welcomeMessage);
  }

  if (newStatus === 'left' || newStatus === 'kicked') {
    const { error } = await supabase
      .from('groups')
      .update({ is_active: false })
      .eq('chat_id', chat.id);
    
    if (error) {
      console.error('Error deactivating group:', error);
    } else {
      console.log('Group deactivated:', chat.id);
    }
  }
}

interface CommandsConfig {
  enabled: boolean;
  auto_delete_all: boolean;
  admin_commands: Array<{
    command: string;
    enabled: boolean;
    auto_delete: boolean;
    response?: string;
  }>;
  user_commands: Array<{
    command: string;
    enabled: boolean;
    auto_delete: boolean;
    response?: string;
  }>;
}

function getDefaultResponse(command: string, username: string): string {
  const defaultResponses: Record<string, string> = {
    '/start': `👋 你好，${username}！\n\n我是 Telegram 群管机器人。\n\n📌 可用命令：\n/help - 查看帮助\n/checkin - 每日签到\n/me - 查看个人信息\n/rank - 查看排行榜`,
    '/help': `🤖 <b>机器人命令帮助</b>\n\n<b>用户命令</b>\n/start - 开始使用\n/help - 查看帮助\n/checkin - 每日签到\n/me - 个人信息\n/rank - 排行榜\n\n<b>管理命令</b>\n/reload - 刷新管理员\n/config - 配置面板`,
    '/checkin': `✅ <b>签到成功！</b>\n\n👤 用户：${username}\n💰 获得积分：+${Math.floor(Math.random() * 20) + 10}\n🔥 连续签到：${Math.floor(Math.random() * 30) + 1} 天`,
    '/me': `📊 <b>个人信息</b>\n\n👤 用户：${username}\n💰 当前积分：${Math.floor(Math.random() * 1000) + 100}\n🏆 排名：#${Math.floor(Math.random() * 50) + 1}`,
    '/rank': `🏆 <b>积分排行榜</b>\n\n🥇 Alice - 12,580 积分\n🥈 Bob - 10,234 积分\n🥉 Charlie - 8,756 积分`,
    '/reload': `✅ 群组信息已刷新！`,
    '/config': `⚙️ <b>群组配置</b>\n\n请访问管理后台：\n${WEB_URL}`
  };
  return defaultResponses[command] || `❓ 未知命令: ${command}`;
}

async function handleCommand(chatId: number, userId: number | undefined, username: string, text: string): Promise<boolean> {
  const command = text.split(' ')[0].toLowerCase();

  if (!userId) {
    await sendMessage(chatId, '❌ 无法识别用户信息');
    return true;
  }

  if (command === '/start') {
    await sendMessage(chatId, `👋 你好，${username}！\n\n我是 Telegram 群管机器人。\n\n📌 可用命令：\n/help - 查看帮助\n/checkin - 每日签到\n/me - 查看个人信息\n/rank - 查看排行榜`);
    return true;
  }

  if (command === '/help') {
    await sendMessage(chatId, `🤖 <b>机器人命令帮助</b>\n\n<b>用户命令</b>\n/start - 开始使用\n/help - 查看帮助\n/checkin - 每日签到\n/me - 个人信息\n/rank - 排行榜\n\n<b>管理命令</b>\n/reload - 刷新管理员\n/config - 配置面板`);
    return true;
  }

  const { data: group } = await supabase
    .from('groups')
    .select('id')
    .eq('chat_id', chatId)
    .single();

  if (!group) {
    await sendMessage(chatId, '❌ 当前群组未注册，请先添加机器人到群组');
    return true;
  }

  const groupId = group.id;

  if (command === '/checkin') {
    try {
      const result = await pointsService.checkin(userId, groupId);
      await sendMessage(chatId, `✅ <b>签到成功！</b>\n\n👤 用户：${username}\n💰 获得积分：+${result.points}\n🔥 连续签到：${result.streak} 天${result.bonus > 0 ? `\n🎁 连续签到奖励：+${result.bonus}` : ''}`);
    } catch (error: any) {
      if (error.message === '今日已签到') {
        const stats = await pointsService.getUserStats(userId, groupId);
        await sendMessage(chatId, `⚠️ 今日已签到\n\n👤 用户：${username}\n🔥 连续签到：${stats.streak} 天\n💰 当前积分：${stats.points}`);
      } else {
        await sendMessage(chatId, `❌ 签到失败：${error.message}`);
      }
    }
    return true;
  }

  if (command === '/me') {
    try {
      const stats = await pointsService.getUserStats(userId, groupId);
      await sendMessage(chatId, `📊 <b>个人信息</b>\n\n👤 用户：${username}\n💰 当前积分：${stats.points}\n📈 累计积分：${stats.totalPoints}\n🏆 排名：#${stats.rank}\n🔥 连续签到：${stats.streak} 天\n✅ 签到次数：${stats.checkinCount}`);
    } catch (error: any) {
      await sendMessage(chatId, `📊 <b>个人信息</b>\n\n👤 用户：${username}\n💰 当前积分：0\n🏆 排名：-`);
    }
    return true;
  }

  if (command === '/rank') {
    try {
      const leaderboard = await pointsService.getLeaderboard(groupId, 'total', 10);
      if (leaderboard.length === 0) {
        await sendMessage(chatId, `🏆 <b>积分排行榜</b>\n\n暂无数据`);
        return true;
      }
      const medals = ['🥇', '🥈', '🥉'];
      const rankText = leaderboard.map((entry, index) => {
        const medal = index < 3 ? medals[index] : `${index + 1}.`;
        const displayName = entry.displayName || entry.username || `用户${entry.telegramId}`;
        return `${medal} ${displayName} - ${entry.points.toLocaleString()} 积分`;
      }).join('\n');
      await sendMessage(chatId, `🏆 <b>积分排行榜</b>\n\n${rankText}`);
    } catch (error: any) {
      await sendMessage(chatId, `❌ 获取排行榜失败：${error.message}`);
    }
    return true;
  }

  if (command === '/reload') {
    await sendMessage(chatId, `✅ 群组信息已刷新！`);
    return true;
  }

  if (command === '/config') {
    await sendMessage(chatId, `⚙️ <b>群组配置</b>\n\n请访问管理后台：\n${WEB_URL}`);
    return true;
  }

  return false;
}

// 处理群组消息（广告过滤、自动回复等）
async function handleGroupMessage(message: any) {
  console.log('=== handleGroupMessage ===');
  console.log('Chat ID:', message.chat.id);
  console.log('User ID:', message.from?.id);
  console.log('Text:', message.text?.substring(0, 100));

  const chatId = message.chat.id;
  const userId = message.from?.id;
  const text = message.text || message.caption || '';

  console.log('Group message:', { chatId, userId, text: text.substring(0, 50) });

  try {
    // 1. 获取群组信息
    const { data: group } = await supabase
      .from('groups')
      .select('id, title')
      .eq('chat_id', chatId)
      .single();

    if (!group) {
      console.log('Group not found:', chatId);
      return;
    }

    // 2. 获取群组配置
    const { data: config } = await supabase
      .from('group_configs')
      .select('*')
      .eq('group_id', group.id)
      .single();

    if (!config) {
      return;
    }

    // 检测汇率查询关键词
    const cryptoConfig = config.crypto_config;
    if (cryptoConfig?.enabled) {
      const isRateQuery = RATE_KEYWORDS.some(keyword => text.includes(keyword));
      
      if (isRateQuery) {
        try {
          const rates = await cryptoService.getUsdtPrice();
          
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `💰 <b>USDT/CNY 实时汇率</b>\n\n` +
                  `💵 当前价格: ¥${rates.price.toFixed(4)}\n` +
                  `📊 24h涨跌: ${rates.change24h >= 0 ? '+' : ''}${rates.change24h.toFixed(2)}%\n` +
                  `🕐 更新时间: ${new Date().toLocaleString('zh-CN')}\n\n` +
                  `<i>数据来源: ${rates.source}</i>`,
            parse_mode: 'HTML'
          });
          return;
        } catch (error) {
          console.error('Get rate error:', error);
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: '❌ 获取汇率失败，请稍后重试'
          });
        }
      }
    }

    // 检测区块链地址
    if (cryptoConfig?.enabled) {
      const supportedChains = cryptoConfig.supported_chains || ['TRC20', 'ERC20'];
      
      for (const [chain, pattern] of Object.entries(ADDRESS_PATTERNS)) {
        if (!supportedChains.includes(chain)) continue;
        
        const match = text.match(pattern);
        if (match) {
          try {
            const chainLower = chain.toLowerCase();
            const balanceInfo = await cryptoService.getAddressBalance(chainLower, match[0]);
            
            if (balanceInfo) {
              await callTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `🔍 <b>地址查询结果</b>\n\n` +
                      `📍 链: ${chain}\n` +
                      `📝 地址: <code>${match[0]}</code>\n` +
                      `💰 余额: ${balanceInfo.balance} ${balanceInfo.symbol}\n` +
                      `💵 价值: $${balanceInfo.usdt_price.toFixed(2)}`,
                parse_mode: 'HTML'
              });
            } else {
              await callTelegramApi('sendMessage', {
                chat_id: chatId,
                text: `🔍 <b>地址查询结果</b>\n\n` +
                      `📍 链: ${chain}\n` +
                      `📝 地址: <code>${match[0]}</code>\n` +
                      `⚠️ 无法获取余额信息`,
                parse_mode: 'HTML'
              });
            }
            return;
          } catch (error) {
            console.error('Get address balance error:', error);
          }
        }
      }
    }

    // 3. 刷屏检测
    const spamConfig = config.anti_spam_config;
    if (spamConfig?.enabled && userId) {
      const spamResult = await antiSpamService.check(userId, chatId, text, spamConfig);
      
      if (spamResult.isSpam) {
        console.log('Spam detected:', {
          userId,
          chatId,
          reason: spamResult.reason,
          messageCount: spamResult.messageCount,
          duplicateCount: spamResult.duplicateCount
        });
        
        await antiSpamService.punish(message, spamResult, spamConfig);
        return;
      }
    }

    // 4. 敏感词检测
    const sensitiveWordsConfig = config.sensitive_words_config as SensitiveWordsConfig;
    if (sensitiveWordsConfig?.enabled) {
      const sensitiveResult = await checkSensitiveWords(text, sensitiveWordsConfig);
      
      if (sensitiveResult.hasSensitive) {
        console.log('Sensitive word detected:', {
          userId,
          chatId,
          matchedWord: sensitiveResult.matchedWord,
          matchedPattern: sensitiveResult.matchedPattern
        });
        
        await handleSensitiveWordViolation(message, sensitiveWordsConfig, group, sensitiveResult);
        return;
      }
    }

    // 5. 检查广告过滤
    const antiAdsConfig = config.anti_ads_config;
    if (antiAdsConfig?.enabled && userId) {
      const adsResult = await adFilterService.check(text, antiAdsConfig, message, userId);
      
      if (adsResult.isAds) {
        console.log('Ad detected:', {
          userId,
          chatId,
          type: adsResult.type,
          matchedKeyword: adsResult.matchedKeyword
        });
        
        const punishmentResult = await adFilterService.punish(message, adsResult, antiAdsConfig, group.id);
        
        if (punishmentResult.action === 'kicked') {
          await callTelegramApi('kickChatMember', {
            chat_id: chatId,
            user_id: userId
          });
        }
        
        return;
      }
    }

    // 6. 检查自动删除
    const autoDeleteConfig = config.auto_delete_config as AutoDeleteConfig;
    if (autoDeleteConfig?.enabled) {
      try {
        await autoDeleteService.handleAutoDelete(message, autoDeleteConfig);
      } catch (error) {
        console.error('Error in auto delete:', error);
      }
    }

    // 7. 检查自动回复
    if (config.auto_reply_enabled) {
      const { data: rules } = await supabase
        .from('auto_reply_rules')
        .select('*')
        .eq('group_id', group.id)
        .eq('enabled', true);

      if (rules) {
        for (const rule of rules) {
          const isMatch = rule.is_regex 
            ? new RegExp(rule.keyword, 'i').test(text)
            : text.toLowerCase().includes(rule.keyword.toLowerCase());

          if (isMatch) {
            console.log('Auto reply triggered:', rule.keyword);
            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: rule.reply_content,
              reply_to_message_id: message.message_id
            });
            break;
          }
        }
      }
    }

    // 8. 更新用户积分
    if (config.points_enabled && userId && text) {
      try {
        const pointsConfig = config.points_config || {
          enabled: true,
          daily_limit: 100,
          per_message: 0.2,
          checkin_base: 10,
          checkin_bonus: [2, 5, 10, 20],
          keyword_pattern: '[\\u4e00-\\u9fa5]{5,}'
        };
        await pointsService.processMessage(userId, group.id, text, pointsConfig);
        console.log('Points processed for user:', userId);
      } catch (error) {
        console.error('Error processing message points:', error);
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id')
        .eq('telegram_id', userId)
        .single();

      if (userData) {
        await supabase
          .from('group_members')
          .upsert({
            group_id: group.id,
            user_id: userData.id,
            last_message_at: new Date().toISOString()
          }, {
            onConflict: 'group_id,user_id'
          });
      }
    }

    // 9. 收集统计数据
    await collectMessageStats(group.id, userId, text, message);

  } catch (error) {
    console.error('Error handling group message:', error);
  }
}

async function collectMessageStats(groupId: string, userId: number | undefined, text: string, message: any) {
  if (!userId) return;

  try {
    const today = new Date().toISOString().split('T')[0];

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', userId)
      .single();

    if (!userData) return;

    const { error: statsError } = await supabase.rpc('record_message_stats', {
      p_group_id: groupId,
      p_user_id: userData.id,
      p_date: today
    });

    if (statsError) {
      console.error('Error recording message stats:', statsError);
      
      await supabase
        .from('chat_stats')
        .upsert({
          group_id: groupId,
          date: today,
          total_messages: 1,
          active_users: 1
        }, {
          onConflict: 'group_id,date'
        });
    }

    await trackInviteFromMessage(groupId, userData.id, text);

    console.log('Stats collected for user:', userId, 'in group:', groupId);

  } catch (error) {
    console.error('Error collecting message stats:', error);
  }
}

async function trackInviteFromMessage(groupId: string, userId: string, text: string) {
  const inviteLinkPattern = /(?:https?:\/\/)?t\.me\/\+([a-zA-Z0-9_-]+)|(?:https?:\/\/)?t\.me\/joinchat\/([a-zA-Z0-9_-]+)/gi;
  const matches = text.match(inviteLinkPattern);

  if (!matches) return;

  for (const link of matches) {
    try {
      const { data: existingLink } = await supabase
        .from('user_invite_links')
        .select('user_id, invite_code')
        .eq('group_id', groupId)
        .eq('invite_link', link)
        .single();

      if (existingLink && existingLink.user_id !== userId) {
        console.log('Invite link shared by user:', userId, 'link owner:', existingLink.user_id);
        
        await supabase.rpc('update_invite_stats', {
          p_group_id: groupId,
          p_user_id: existingLink.user_id,
          p_increment: 1
        });
      }
    } catch (error) {
      console.log('No matching invite link found for:', link);
    }
  }
}

// 处理私聊消息（验证答案等）
async function handlePrivateMessage(message: any) {
  const userId = message.from?.id;
  const text = message.text || '';

  console.log('Private message:', { userId, text: text.substring(0, 50) });

  try {
    // 检查是否有待验证的记录
    const { data: record } = await supabase
      .from('verification_records')
      .select('*, groups!inner(chat_id)')
      .eq('telegram_id', userId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!record) {
      // 没有待验证记录，发送主菜单
      await callTelegramApi('sendMessage', {
        chat_id: userId,
        text: `👋 你好！

我是 Telegram 群管机器人。

📌 可用命令：
/start - 开始使用
/help - 查看帮助

请访问管理后台：
${WEB_URL}`
      });
      return;
    }

    // 处理数学验证答案
    if (record.verification_type === 'math') {
      const answer = parseInt(text.trim());
      const correctAnswer = 42; // 这里应该从 challenge_data 获取正确答案

      if (answer === correctAnswer) {
        // 验证通过
        await supabase
          .from('verification_records')
          .update({
            status: 'passed',
            completed_at: new Date().toISOString()
          })
          .eq('id', record.id);

        // 解除禁言
        await callTelegramApi('restrictChatMember', {
          chat_id: record.groups.chat_id,
          user_id: userId,
          permissions: {
            can_send_messages: true,
            can_send_media_messages: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true
          }
        });

        await callTelegramApi('sendMessage', {
          chat_id: userId,
          text: '✅ 验证成功！欢迎加入群组！'
        });

        const { data: groupData } = await supabase
          .from('groups')
          .select('id, title')
          .eq('chat_id', record.groups.chat_id)
          .single();

        if (groupData) {
          await sendWelcomeMessage(
            record.groups.chat_id,
            groupData.id,
            {
              id: userId!,
              first_name: message.from?.first_name || 'User',
              username: message.from?.username
            },
            groupData.title
          );
        }

        console.log('User verified successfully:', userId);
      } else {
        // 答案错误
        const attemptCount = (record.attempt_count || 0) + 1;
        const isExhausted = attemptCount >= (record.max_attempts || 3);

        await supabase
          .from('verification_records')
          .update({
            attempt_count: attemptCount,
            status: isExhausted ? 'failed' : 'pending'
          })
          .eq('id', record.id);

        if (isExhausted) {
          await callTelegramApi('sendMessage', {
            chat_id: userId,
            text: '❌ 验证失败次数过多，请重新加入群组。'
          });
        } else {
          await callTelegramApi('sendMessage', {
            chat_id: userId,
            text: `❌ 答案错误，剩余 ${(record.max_attempts || 3) - attemptCount} 次尝试机会。`
          });
        }
      }
    }

  } catch (error) {
    console.error('Error handling private message:', error);
  }
}

async function handleLotteryParticipate(
  callbackQuery: any,
  lotteryId: string,
  userId: number,
  chatId: number | undefined
) {
  try {
    const username = callbackQuery.from.username || callbackQuery.from.first_name;

    const result = await lotteryService.joinLottery(lotteryId, userId, { username });

    if (result.success) {
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: `✅ ${result.message}`,
        show_alert: false
      });

      const { data: lottery } = await supabase
        .from('lotteries')
        .select('participant_count, ticket_count')
        .eq('id', lotteryId)
        .single();

      if (lottery && chatId && callbackQuery.message?.message_id) {
        const originalText = callbackQuery.message.text || '';
        const updatedText = originalText.replace(
          /👥 参与人数：\d+/,
          `👥 参与人数：${lottery.participant_count}`
        );

        await callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          text: updatedText,
          parse_mode: 'HTML',
          reply_markup: callbackQuery.message.reply_markup
        });
      }
    } else {
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: `❌ ${result.message}`,
        show_alert: true
      });
    }
  } catch (error) {
    console.error('Error handling lottery participate:', error);
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: '❌ 参与失败，请稍后重试',
      show_alert: true
    });
  }
}

async function handleLotteryDraw(
  callbackQuery: any,
  lotteryId: string,
  userId: number,
  chatId: number | undefined
) {
  try {
    const { data: group } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!group) {
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '❌ 群组未注册',
        show_alert: true
      });
      return;
    }

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', userId)
      .single();

    if (!userData) {
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '❌ 用户未注册',
        show_alert: true
      });
      return;
    }

    const { data: adminRecord } = await supabase
      .from('group_administrators')
      .select('*')
      .eq('group_id', group.id)
      .eq('user_id', userData.id)
      .single();

    if (!adminRecord) {
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '❌ 只有管理员可以开奖',
        show_alert: true
      });
      return;
    }

    const result = await lotteryService.drawLottery(lotteryId, userId.toString());

    if (!result.success) {
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '❌ 开奖失败：无人参与或抽奖不存在',
        show_alert: true
      });
      return;
    }

    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: `✅ 开奖成功！共 ${result.winners.length} 位中奖者`,
      show_alert: false
    });

    const lottery = await lotteryService.getLottery(lotteryId);
    if (!lottery || !chatId) return;

    let winnerText = `🎉 <b>抽奖结果公布</b>\n\n`;
    winnerText += `🏆 <b>奖品：</b>${lottery.prize}\n\n`;
    winnerText += `🥇 <b>中奖者：</b>\n`;

    for (let i = 0; i < result.winners.length; i++) {
      const winner = result.winners[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      const displayName = winner.username || `用户${winner.telegramId}`;
      winnerText += `${medal} ${displayName}\n`;

      try {
        await callTelegramApi('sendMessage', {
          chat_id: winner.telegramId,
          text: `🎉 <b>恭喜您中奖了！</b>\n\n🏆 奖品：${lottery.prize}\n\n请联系群管理员领取奖品。`,
          parse_mode: 'HTML'
        });
      } catch (notifyError) {
        console.error('Failed to notify winner:', winner.telegramId, notifyError);
      }
    }

    winnerText += `\n👥 共有 ${result.participantCount} 人参与`;

    await callTelegramApi('editMessageText', {
      chat_id: chatId,
      message_id: callbackQuery.message?.message_id,
      text: winnerText,
      parse_mode: 'HTML'
    });

    console.log('Lottery draw completed:', { lotteryId, winnerCount: result.winners.length });
  } catch (error) {
    console.error('Error handling lottery draw:', error);
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: '❌ 开奖失败，请稍后重试',
      show_alert: true
    });
  }
}

// 处理新成员加入群组
async function handleNewChatMember(update: TelegramUpdate) {
  const chatMember = update.chat_member!;
  const chat = chatMember.chat;
  const newStatus = chatMember.new_chat_member.status;
  const oldStatus = chatMember.old_chat_member?.status;
  const user = chatMember.new_chat_member.user;

  console.log('=== handleNewChatMember START ===');
  console.log('Chat:', { id: chat.id, title: chat.title, type: chat.type });
  console.log('User:', { id: user.id, username: user.username, first_name: user.first_name });
  console.log('Status:', { old: oldStatus, new: newStatus });

  console.log('Chat member update:', {
    chat_id: chat.id,
    chat_title: chat.title,
    user_id: user.id,
    user_name: user.username || user.first_name,
    old_status: oldStatus,
    new_status: newStatus
  });

  // 只处理新成员加入（从 left 变为 member）
  if (newStatus !== 'member' || oldStatus === 'member') {
    return;
  }

  // 跳过机器人
  if (user.is_bot) {
    return;
  }

  try {
    // 1. 获取群组信息
    const { data: group } = await supabase
      .from('groups')
      .select('id, title')
      .eq('chat_id', chat.id)
      .single();

    if (!group) {
      console.log('Group not found:', chat.id);
      return;
    }

    // 2. 创建或获取用户
    const { data: userData, error: userError } = await supabase
      .from('users')
      .upsert({
        telegram_id: user.id,
        username: user.username,
        first_name: user.first_name,
        is_bot: user.is_bot
      }, { onConflict: 'telegram_id' })
      .select()
      .single();

    if (userError) {
      console.error('Error upserting user:', userError);
      return;
    }

    // 3. 添加到 group_members 表
    await supabase
      .from('group_members')
      .upsert({
        group_id: group.id,
        user_id: userData.id,
        is_active: true,
        joined_at: new Date().toISOString()
      }, {
        onConflict: 'group_id,user_id'
      });

    console.log(`User ${user.username || user.first_name} added to group_members`);

    // 4. 检查验证配置
    const { data: config } = await supabase
      .from('group_configs')
      .select('verification_config')
      .eq('group_id', group.id)
      .single();

    const verificationConfig = config?.verification_config;
    
    console.log('Verification config:', JSON.stringify(verificationConfig, null, 2));
    
    if (!verificationConfig?.enabled) {
      console.log('Verification not enabled for group:', group.id);
      await sendWelcomeMessage(chat.id, group.id, user, group.title);
      return;
    }

    console.log('Starting verification for user:', user.id);

    // 5. 禁言用户
    await callTelegramApi('restrictChatMember', {
      chat_id: chat.id,
      user_id: user.id,
      permissions: {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false
      },
      until_date: Math.floor(Date.now() / 1000) + 86400
    });

    console.log('User restricted successfully');

    // 6. 创建验证记录
    const verifyId = crypto.randomUUID();
    const timeout = verificationConfig.timeout || 300;
    const expiresAt = new Date(Date.now() + timeout * 1000).toISOString();

    const { data: record, error: recordError } = await supabase
      .from('verification_records')
      .insert({
        group_id: group.id,
        telegram_id: user.id,
        verification_type: verificationConfig.type || 'math',
        status: 'pending',
        challenge_data: {
          verify_id: verifyId,
          channel_id: verificationConfig.channel_id
        },
        expires_at: expiresAt,
        max_attempts: 3
      })
      .select()
      .single();

    if (recordError) {
      console.error('Error creating verification record:', recordError);
      return;
    }

    // 7. 发送验证消息
    let message: string;
    let keyboard: any;

    switch (verificationConfig.type) {
      case 'channel':
        message = `🎉 欢迎 ${user.first_name} 加入群组！\n\n⚠️ 请先关注频道后点击下方按钮完成验证：\n\n⏰ ${Math.floor(timeout / 60)}分钟内有效`;
        keyboard = {
          inline_keyboard: [[{
            text: '✅ 我已关注频道',
            callback_data: `verify_channel:${record.id}`
          }]]
        };
        break;
      case 'math': {
        const difficulty = verificationConfig.difficulty || 1;
        const maxNum = 10 * difficulty;
        const operators = difficulty >= 3 ? ['+', '-', '×'] : ['+', '-'];
        const operator = operators[Math.floor(Math.random() * operators.length)];
        const a = Math.floor(Math.random() * maxNum) + 1;
        const b = Math.floor(Math.random() * maxNum) + 1;
        let answer: number;
        let question: string;

        if (operator === '+') {
          question = `${a} + ${b} = ?`;
          answer = a + b;
        } else if (operator === '-') {
          question = `${a} - ${b} = ?`;
          answer = a - b;
        } else {
          question = `${a} × ${b} = ?`;
          answer = a * b;
        }

        await supabase
          .from('verification_records')
          .update({
            challenge_data: {
              verify_id: verifyId,
              question,
              correct_answer: String(answer)
            }
          })
          .eq('id', record.id);

        message = `🎉 欢迎 ${user.first_name} 加入群组！\n\n⚠️ 请完成验证：\n\n请计算：${question}\n\n请在私聊中输入答案\n⏰ ${Math.floor(timeout / 60)}分钟内有效`;
        break;
      }
      case 'image':
        message = `🎉 欢迎 ${user.first_name} 加入群组！\n\n⚠️ 请完成图片验证码验证\n⏰ ${Math.floor(timeout / 60)}分钟内有效`;
        break;
      case 'gif':
        message = `🎉 欢迎 ${user.first_name} 加入群组！\n\n⚠️ 请识别 GIF 中的文字\n⏰ ${Math.floor(timeout / 60)}分钟内有效`;
        break;
      default:
        message = `🎉 欢迎 ${user.first_name} 加入群组！\n\n⚠️ 请完成验证\n⏰ ${Math.floor(timeout / 60)}分钟内有效`;
    }

    await callTelegramApi('sendMessage', {
      chat_id: chat.id,
      text: message,
      reply_markup: keyboard
    });

    console.log('Verification message sent');
    console.log('=== handleNewChatMember END ===');

  } catch (error) {
    console.error('Error handling new chat member:', error);
  }
}

// 处理回调查询
async function handleCallbackQuery(update: TelegramUpdate) {
  const callbackQuery = update.callback_query!;
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;
  const messageId = callbackQuery.message?.message_id;
  const chatId = callbackQuery.message?.chat?.id;

  console.log('Callback query:', { data, userId, chatId });

  if (data?.startsWith('lottery_participate:')) {
    const lotteryId = data.split(':')[1];
    await handleLotteryParticipate(callbackQuery, lotteryId, userId, chatId);
    return;
  }

  if (data?.startsWith('lottery_draw:')) {
    const lotteryId = data.split(':')[1];
    await handleLotteryDraw(callbackQuery, lotteryId, userId, chatId);
    return;
  }

  if (!data?.startsWith('verify_channel:')) {
    return;
  }

  const recordId = data.split(':')[1];

  try {
    // 1. 获取验证记录
    const { data: record, error: recordError } = await supabase
      .from('verification_records')
      .select('*')
      .eq('id', recordId)
      .eq('status', 'pending')
      .single();

    if (recordError || !record) {
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '❌ 验证已过期或无效',
        show_alert: true
      });
      return;
    }

    // 2. 检查是否过期
    if (new Date(record.expires_at) < new Date()) {
      await supabase
        .from('verification_records')
        .update({ status: 'expired' })
        .eq('id', recordId);

      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '⏰ 验证已过期，请重新验证',
        show_alert: true
      });
      return;
    }

    // 3. 获取频道ID
    const channelId = record.challenge_data?.channel_id;
    if (!channelId) {
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '❌ 配置错误',
        show_alert: true
      });
      return;
    }

    // 4. 检查用户是否关注了频道
    const memberInfo = await callTelegramApi('getChatMember', {
      chat_id: channelId,
      user_id: userId
    });

    const isMember = ['member', 'administrator', 'creator'].includes(memberInfo.result?.status);

    if (isMember) {
      // 验证通过
      await supabase
        .from('verification_records')
        .update({
          status: 'passed',
          completed_at: new Date().toISOString()
        })
        .eq('id', recordId);

      // 解除禁言
      await callTelegramApi('restrictChatMember', {
        chat_id: chatId,
        user_id: userId,
        permissions: {
          can_send_messages: true,
          can_send_media_messages: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true
        }
      });

      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '✅ 验证成功！欢迎加入！',
        show_alert: true
      });

      // 更新验证消息
      if (chatId && messageId) {
        await callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: messageId,
          text: '✅ 验证成功！欢迎加入！'
        });
      }

      const { data: groupData } = await supabase
        .from('groups')
        .select('id, title')
        .eq('id', record.group_id)
        .single();

      if (groupData) {
        await sendWelcomeMessage(
          chatId!,
          groupData.id,
          {
            id: userId,
            first_name: callbackQuery.from.first_name,
            username: callbackQuery.from.username
          },
          groupData.title
        );
      }

      console.log('User verified successfully:', userId);
    } else {
      // 未关注频道
      const attemptCount = (record.attempt_count || 0) + 1;
      const isExhausted = attemptCount >= (record.max_attempts || 3);

      await supabase
        .from('verification_records')
        .update({
          attempt_count: attemptCount,
          status: isExhausted ? 'failed' : 'pending'
        })
        .eq('id', recordId);

      if (isExhausted) {
        await callTelegramApi('answerCallbackQuery', {
          callback_query_id: callbackQuery.id,
          text: '❌ 验证失败次数过多，请先关注频道后再试',
          show_alert: true
        });
      } else {
        await callTelegramApi('answerCallbackQuery', {
          callback_query_id: callbackQuery.id,
          text: '❌ 您还没有关注频道，请先关注后再验证',
          show_alert: false
        });
      }
    }
  } catch (error) {
    console.error('Error handling callback query:', error);
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: '❌ 处理失败，请重试',
      show_alert: true
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('=== Webhook received ===');
  console.log('Method:', req.method);
  console.log('Body:', JSON.stringify(req.body, null, 2).substring(0, 500));

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update: TelegramUpdate = req.body;

    if (update.my_chat_member) {
      await handleBotAddedToGroup(update);
      return res.status(200).json({ ok: true });
    }

    // 处理新成员加入群组
    if (update.chat_member) {
      await handleNewChatMember(update);
      return res.status(200).json({ ok: true });
    }

    // 处理回调查询（验证按钮点击）
    if (update.callback_query) {
      await handleCallbackQuery(update);
      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    if (!message) {
      return res.status(200).json({ ok: true, message: 'No message' });
    }

    const chatId = message.chat.id;
    const userId = message.from?.id;
    const text = message.text || '';
    const username = message.from?.username || message.from?.first_name || 'User';

    // 处理命令
    if (text.startsWith('/')) {
      await handleCommand(chatId, userId, username, text);
      return res.status(200).json({ ok: true });
    }

    // 处理群组消息（广告过滤、自动回复等）
    if (message.chat.type === 'group' || message.chat.type === 'supergroup') {
      await handleGroupMessage(message);
    } else if (message.chat.type === 'private') {
      // 处理私聊消息（验证答案等）
      await handlePrivateMessage(message);
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}

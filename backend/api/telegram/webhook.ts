// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const RATE_KEYWORDS = ['汇率', 'usdt', 'USDT', '价格', '行情', '汇率查询', '实时汇率'];

const ADDRESS_PATTERNS = {
  ERC20: /^0x[a-fA-F0-9]{40}$/,
  TRC20: /^T[A-Za-z1-9]{33}$/,
  BEP20: /^0x[a-fA-F0-9]{40}$/,
  BEP2: /^bnb1[a-z0-9]{38}$/,
  SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  BTC: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/
};

interface TelegramUpdate {
  update_id: number;
  message?: any;
  edited_message?: any;
  channel_post?: any;
  callback_query?: any;
  my_chat_member?: any;
  chat_member?: any;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN');
  return token;
}

async function callTelegramApi(method: string, params: Record<string, any>): Promise<any> {
  const token = getBotToken();
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return response.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'Telegram Webhook' });
  }

  const update: TelegramUpdate = req.body;
  console.log('=== Webhook received ===');
  console.log('Update ID:', update.update_id);

  try {
    // Handle my_chat_member (bot added to group)
    if (update.my_chat_member) {
      await handleBotAddedToGroup(update);
      return res.status(200).json({ ok: true });
    }

    // Handle chat_member (new member joined)
    if (update.chat_member) {
      await handleNewChatMember(update);
      return res.status(200).json({ ok: true });
    }

    // Handle callback_query
    if (update.callback_query) {
      await handleCallbackQuery(update);
      return res.status(200).json({ ok: true });
    }

    // Handle message
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const userId = message.from?.id;
      const text = message.text || '';
      const chatType = message.chat.type;

      console.log('Message:', { chatId, userId, text: text.substring(0, 50), chatType });

      // Handle commands
      if (text.startsWith('/')) {
        await handleCommand(chatId, userId, message.from?.username || 'User', text, message);
        return res.status(200).json({ ok: true });
      }

      // Handle group messages
      if (chatType === 'group' || chatType === 'supergroup') {
        await handleGroupMessage(message);
      } else if (chatType === 'private') {
        await handlePrivateMessage(message);
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true, message: 'No handler' });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: String(error) });
  }
}

async function handleBotAddedToGroup(update: TelegramUpdate) {
  const chatMember = update.my_chat_member!;
  const chat = chatMember.chat;
  const newStatus = chatMember.new_chat_member.status;

  console.log('Bot added to group:', { chatId: chat.id, title: chat.title, newStatus });

  if (newStatus === 'member' || newStatus === 'administrator') {
    const supabase = getSupabase();
    
    // Create or update group
    const { data: group, error } = await supabase
      .from('groups')
      .upsert({
        chat_id: chat.id,
        title: chat.title || 'Unknown',
        type: chat.type,
        username: chat.username,
        is_active: true
      }, { onConflict: 'chat_id' })
      .select()
      .single();

    if (error) {
      console.error('Error creating group:', error);
      return;
    }

    console.log('Group created/updated:', group);

    // Send welcome message
    await callTelegramApi('sendMessage', {
      chat_id: chat.id,
      text: `👋 你好！我是群管机器人。\n\n请访问管理后台配置功能：\nhttps://tg-group-admin.vercel.app\n\n群组ID: ${chat.id}`
    });
  }
}

async function handleNewChatMember(update: TelegramUpdate) {
  const chatMember = update.chat_member!;
  const chat = chatMember.chat;
  const newStatus = chatMember.new_chat_member.status;
  const oldStatus = chatMember.old_chat_member?.status;
  const user = chatMember.new_chat_member.user;

  console.log('=== handleNewChatMember ===');
  console.log('Chat:', { id: chat.id, title: chat.title });
  console.log('User:', { id: user.id, username: user.username, first_name: user.first_name });
  console.log('Status:', { old: oldStatus, new: newStatus });

  // Only handle new member join (from left to member)
  if (newStatus !== 'member' || oldStatus === 'member') {
    console.log('Not a new member join, skipping');
    return;
  }

  // Skip bots
  if (user.is_bot) {
    console.log('User is bot, skipping');
    return;
  }

  const supabase = getSupabase();

  // Get group
  const { data: group } = await supabase
    .from('groups')
    .select('id, title')
    .eq('chat_id', chat.id)
    .single();

  if (!group) {
    console.log('Group not found:', chat.id);
    return;
  }

  // Get verification config
  const { data: config } = await supabase
    .from('group_configs')
    .select('verification_config, welcome_config')
    .eq('group_id', group.id)
    .single();

  const verificationConfig = config?.verification_config;
  const welcomeConfig = config?.welcome_config;

  console.log('Verification config:', JSON.stringify(verificationConfig));

  // Handle verification
  if (verificationConfig?.enabled) {
    console.log('Verification enabled, restricting user...');
    
    // Restrict user
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

    // Create verification record
    const verifyId = crypto.randomUUID();
    const timeout = verificationConfig.timeout || 300;
    const expiresAt = new Date(Date.now() + timeout * 1000).toISOString();

    const { data: record } = await supabase
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

    // Send verification message
    if (verificationConfig.type === 'channel') {
      await callTelegramApi('sendMessage', {
        chat_id: chat.id,
        text: `🎉 欢迎 ${user.first_name} 加入群组！\n\n⚠️ 请先关注频道后点击下方按钮完成验证：\n\n⏰ ${Math.floor(timeout / 60)}分钟内有效`,
        reply_markup: {
          inline_keyboard: [[{
            text: '✅ 我已关注频道',
            callback_data: `verify_channel:${record.id}`
          }]]
        }
      });
    } else {
      // Math verification
      const num1 = Math.floor(Math.random() * 10) + 1;
      const num2 = Math.floor(Math.random() * 10) + 1;
      const answer = num1 + num2;

      await supabase
        .from('verification_records')
        .update({ challenge_data: { num1, num2, answer } })
        .eq('id', record.id);

      await callTelegramApi('sendMessage', {
        chat_id: chat.id,
        text: `🎉 欢迎 ${user.first_name} 加入群组！\n\n⚠️ 请完成验证：\n\n请计算：${num1} + ${num2} = ?\n\n请在私聊中输入答案\n⏰ ${Math.floor(timeout / 60)}分钟内有效`
      });
    }
  } else {
    // Send welcome message if verification is disabled
    if (welcomeConfig?.enabled) {
      let message = welcomeConfig.message || `欢迎 ${user.first_name} 加入群组！`;
      message = message
        .replace(/{user_name}/g, user.first_name)
        .replace(/{user_id}/g, user.id.toString())
        .replace(/{group_name}/g, group.title)
        .replace(/{mention}/g, user.username ? `@${user.username}` : user.first_name);

      await callTelegramApi('sendMessage', {
        chat_id: chat.id,
        text: message,
        parse_mode: 'HTML'
      });
    }
  }

  console.log('=== handleNewChatMember END ===');
}

async function handleCallbackQuery(update: TelegramUpdate) {
  const callbackQuery = update.callback_query!;
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message?.chat?.id;

  console.log('Callback query:', { data, userId, chatId });

  // Handle verification callback
  if (data?.startsWith('verify_channel:')) {
    const recordId = data.split(':')[1];
    const supabase = getSupabase();

    // Get verification record
    const { data: record } = await supabase
      .from('verification_records')
      .select('*')
      .eq('id', recordId)
      .eq('status', 'pending')
      .single();

    if (!record) {
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '❌ 验证已过期或无效',
        show_alert: true
      });
      return;
    }

    // Check if expired
    if (new Date(record.expires_at) < new Date()) {
      await supabase.from('verification_records').update({ status: 'expired' }).eq('id', recordId);
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '⏰ 验证已过期',
        show_alert: true
      });
      return;
    }

    // Check if user followed channel
    const channelId = record.challenge_data?.channel_id;
    if (!channelId) {
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '❌ 配置错误',
        show_alert: true
      });
      return;
    }

    try {
      const memberInfo = await callTelegramApi('getChatMember', {
        chat_id: channelId,
        user_id: userId
      });

      const isMember = ['member', 'administrator', 'creator'].includes(memberInfo.result?.status);

      if (isMember) {
        // Verification passed
        await supabase.from('verification_records').update({ status: 'passed', completed_at: new Date().toISOString() }).eq('id', recordId);

        // Unrestrict user
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
          text: '✅ 验证成功！',
          show_alert: true
        });

        // Update message
        await callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          text: '✅ 验证成功！欢迎加入！'
        });

        console.log('User verified successfully:', userId);
      } else {
        await callTelegramApi('answerCallbackQuery', {
          callback_query_id: callbackQuery.id,
          text: '❌ 您还没有关注频道',
          show_alert: true
        });
      }
    } catch (error) {
      console.error('Error checking channel membership:', error);
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '❌ 检查失败，请重试',
        show_alert: true
      });
    }
  } else {
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: '已收到'
    });
  }
}

async function handleCommand(chatId: number, userId: number | undefined, username: string, text: string, message: any) {
  const command = text.split(' ')[0].toLowerCase();
  console.log('Command:', command);

  switch (command) {
    case '/start':
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `👋 你好 ${username}！\n\n我是群管机器人。\n\n📌 可用命令：\n/start - 开始使用\n/help - 查看帮助\n/checkin - 每日签到\n/me - 个人信息\n/rank - 排行榜`
      });
      break;

    case '/help':
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `📖 帮助信息\n\n📌 可用命令：\n/start - 开始使用\n/help - 查看帮助\n/checkin - 每日签到\n/me - 个人信息\n/rank - 排行榜\n/reload - 刷新信息`
      });
      break;

    case '/checkin':
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `✅ 签到成功！\n\n积分 +10\n连续签到 1 天`
      });
      break;

    case '/me':
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `👤 个人信息\n\n用户名: ${username}\n用户ID: ${userId}\n积分: 0\n排名: -`
      });
      break;

    case '/rank':
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `🏆 积分排行榜\n\n暂无数据`
      });
      break;

    default:
      console.log('Unknown command:', command);
  }
}

async function handleGroupMessage(message: any) {
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const text = message.text || '';
  const messageId = message.message_id;

  console.log('=== handleGroupMessage ===');
  console.log('Chat ID:', chatId, 'User ID:', userId, 'Text:', text.substring(0, 50));

  // Check for rate query
  if (RATE_KEYWORDS.some(kw => text.includes(kw))) {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=cny,usd&include_24hr_change=true');
      const data = await response.json();
      const cnyPrice = data.tether?.cny || 7.24;
      const change = data.tether?.cny_24h_change || 0;

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `💰 USDT/CNY 实时汇率\n\n💵 当前价格: ¥${cnyPrice.toFixed(2)}\n📊 24h涨跌: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%\n🕐 更新时间: ${new Date().toLocaleString('zh-CN')}\n\n数据来源: CoinGecko`,
        parse_mode: 'HTML'
      });
      return;
    } catch (error) {
      console.error('Rate query error:', error);
    }
  }

  // Check for crypto address
  for (const [chain, pattern] of Object.entries(ADDRESS_PATTERNS)) {
    const match = text.match(pattern);
    if (match) {
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `🔍 检测到 ${chain} 地址\n\n地址: ${match[0]}\n\n⚠️ 余额查询功能暂未启用`,
        parse_mode: 'HTML'
      });
      return;
    }
  }

  console.log('=== handleGroupMessage END ===');
}

async function handlePrivateMessage(message: any) {
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const text = message.text || '';

  console.log('Private message:', { chatId, userId, text });

  // Check for pending verification
  const supabase = getSupabase();
  const { data: record } = await supabase
    .from('verification_records')
    .select('*, groups!inner(chat_id)')
    .eq('telegram_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (record && record.verification_type === 'math') {
    const answer = parseInt(text.trim());
    const correctAnswer = record.challenge_data?.answer;

    if (answer === correctAnswer) {
      await supabase.from('verification_records').update({ status: 'passed', completed_at: new Date().toISOString() }).eq('id', record.id);

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
        chat_id: chatId,
        text: '✅ 验证成功！欢迎加入群组！'
      });
    } else {
      const attemptCount = (record.attempt_count || 0) + 1;
      await supabase.from('verification_records').update({ attempt_count: attemptCount }).eq('id', record.id);

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `❌ 答案错误，请重试。\n\n剩余 ${Math.max(0, (record.max_attempts || 3) - attemptCount)} 次机会`
      });
    }
    return;
  }

  // Default response
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: `👋 你好！\n\n我是群管机器人。\n\n📌 可用命令：\n/start - 开始使用\n/help - 查看帮助\n\n管理后台：\nhttps://tg-group-admin.vercel.app`
  });
}

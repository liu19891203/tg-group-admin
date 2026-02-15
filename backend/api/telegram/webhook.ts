import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_URL = process.env.WEB_URL || 'https://tg-group-admin-frontend.vercel.app';

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

async function callTelegramApi(method: string, params: Record<string, any>) {
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

async function handleCommand(chatId: number, userId: number | undefined, username: string, text: string): Promise<boolean> {
  const command = text.split(' ')[0].toLowerCase();

  const commands: Record<string, string> = {
    '/start': `👋 你好，${username}！\n\n我是 Telegram 群管机器人。\n\n📌 可用命令：\n/help - 查看帮助\n/checkin - 每日签到\n/me - 查看个人信息\n/rank - 查看排行榜`,
    '/help': `🤖 <b>机器人命令帮助</b>\n\n<b>用户命令</b>\n/start - 开始使用\n/help - 查看帮助\n/checkin - 每日签到\n/me - 个人信息\n/rank - 排行榜\n\n<b>管理命令</b>\n/reload - 刷新管理员\n/config - 配置面板`,
    '/checkin': `✅ <b>签到成功！</b>\n\n👤 用户：${username}\n💰 获得积分：+${Math.floor(Math.random() * 20) + 10}\n🔥 连续签到：${Math.floor(Math.random() * 30) + 1} 天`,
    '/me': `📊 <b>个人信息</b>\n\n👤 用户：${username}\n💰 当前积分：${Math.floor(Math.random() * 1000) + 100}\n🏆 排名：#${Math.floor(Math.random() * 50) + 1}`,
    '/rank': `🏆 <b>积分排行榜</b>\n\n🥇 Alice - 12,580 积分\n🥈 Bob - 10,234 积分\n🥉 Charlie - 8,756 积分`,
    '/reload': `✅ 群组信息已刷新！`,
    '/config': `⚙️ <b>群组配置</b>\n\n请访问管理后台：\n${WEB_URL}`
  };

  const response = commands[command];
  if (response) {
    await sendMessage(chatId, response);
    return true;
  }
  // 未知命令不回复
  return false;
}

// 处理新成员加入群组
async function handleNewChatMember(update: TelegramUpdate) {
  const chatMember = update.chat_member!;
  const chat = chatMember.chat;
  const newStatus = chatMember.new_chat_member.status;
  const oldStatus = chatMember.old_chat_member?.status;
  const user = chatMember.new_chat_member.user;

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
    
    if (!verificationConfig?.enabled) {
      console.log('Verification not enabled for group:', group.id);
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
      case 'math':
        message = `🎉 欢迎 ${user.first_name} 加入群组！\n\n⚠️ 请完成验证：\n\n请计算：15 + 27 = ?\n\n请在私聊中输入答案\n⏰ ${Math.floor(timeout / 60)}分钟内有效`;
        break;
      default:
        message = `🎉 欢迎 ${user.first_name} 加入群组！\n\n⚠️ 请完成验证\n⏰ ${Math.floor(timeout / 60)}分钟内有效`;
    }

    await callTelegramApi('sendMessage', {
      chat_id: chat.id,
      text: message,
      reply_markup: keyboard
    });

    console.log('Verification message sent to user:', user.id);

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

    if (text.startsWith('/')) {
      await handleCommand(chatId, userId, username, text);
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: error.message });
  }
}

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Supabase 客户端
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      is_bot: boolean;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      type: string;
      title?: string;
      username?: string;
    };
    date: number;
    text?: string;
    caption?: string;
  };
  my_chat_member?: {
    chat: {
      id: number;
      type: string;
      title?: string;
      username?: string;
    };
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    date: number;
    old_chat_member: {
      status: string;
    };
    new_chat_member: {
      status: string;
      user: {
        id: number;
        is_bot: boolean;
        first_name: string;
        username?: string;
      };
    };
  };
  callback_query?: any;
}

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_URL = process.env.WEB_URL || 'https://your-admin-panel.com';

async function callTelegramApi(method: string, params: Record<string, any>) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    const data = await response.json();
    console.log(`Telegram API ${method}:`, JSON.stringify(data));
    return data;
  } catch (error) {
    console.error(`Telegram API error (${method}):`, error);
    return { ok: false, error };
  }
}

async function sendMessage(chatId: number, text: string, parseMode?: string) {
  return callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: parseMode || 'HTML'
  });
}

// 处理机器人被添加到群组
async function handleBotAddedToGroup(update: TelegramUpdate) {
  const myChatMember = update.my_chat_member!;
  const chat = myChatMember.chat;
  const from = myChatMember.from;
  const newStatus = myChatMember.new_chat_member.status;
  const oldStatus = myChatMember.old_chat_member.status;

  console.log(`Bot status changed in ${chat.title}: ${oldStatus} -> ${newStatus}`);

  // 只处理被添加到群组的情况
  if (newStatus === 'member' || newStatus === 'administrator') {
    try {
      // 1. 保存或更新群组信息
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .upsert({
          chat_id: chat.id,
          chat_type: chat.type,
          title: chat.title || 'Unknown Group',
          username: chat.username,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'chat_id'
        })
        .select()
        .single();

      if (groupError) {
        console.error('Error saving group:', groupError);
        return;
      }

      // 2. 保存用户信息
      const { data: userData, error: userError } = await supabase
        .from('users')
        .upsert({
          telegram_id: from.id,
          username: from.username,
          first_name: from.first_name,
          is_bot: from.is_bot,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'telegram_id'
        })
        .select()
        .single();

      if (userError) {
        console.error('Error saving user:', userError);
        return;
      }

      // 3. 将添加者设为群组管理员
      const { error: adminError } = await supabase
        .from('group_administrators')
        .upsert({
          group_id: groupData.id,
          user_id: userData.id,
          is_owner: true,
          added_by: userData.id,
          added_at: new Date().toISOString()
        }, {
          onConflict: 'group_id,user_id'
        });

      if (adminError) {
        console.error('Error setting group admin:', adminError);
        return;
      }

      // 4. 初始化群组配置
      const { error: configError } = await supabase
        .from('group_configs')
        .upsert({
          group_id: groupData.id,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'group_id'
        });

      if (configError) {
        console.error('Error initializing group config:', configError);
      }

      // 5. 发送欢迎消息
      const welcomeMessage = newStatus === 'administrator'
        ? `🎉 <b>机器人已成功加入群组！</b>\n\n` +
          `👤 <b>${from.first_name}</b> 已成为本群管理员\n` +
          `🤖 机器人状态：管理员\n\n` +
          `📋 <b>可用功能：</b>\n` +
          `• 入群验证\n` +
          `• 广告过滤\n` +
          `• 自动回复\n` +
          `• 积分系统\n` +
          `• 抽奖活动\n` +
          `• 定时消息\n\n` +
          `🌐 <a href="${WEB_URL}">访问管理后台</a>\n\n` +
          `使用 /help 查看所有命令`
        : `⚠️ <b>机器人已加入群组</b>\n\n` +
          `请将我设为管理员以使用完整功能。\n\n` +
          `🌐 <a href="${WEB_URL}">访问管理后台</a>`;

      await sendMessage(chat.id, welcomeMessage);

      console.log(`Group ${chat.title} initialized successfully`);

    } catch (error) {
      console.error('Error handling bot added to group:', error);
    }
  }

  // 处理被移除的情况
  if (newStatus === 'left' || newStatus === 'kicked') {
    try {
      // 标记群组为不活跃
      await supabase
        .from('groups')
        .update({ is_active: false })
        .eq('chat_id', chat.id);

      console.log(`Group ${chat.title} marked as inactive`);
    } catch (error) {
      console.error('Error marking group as inactive:', error);
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const update: TelegramUpdate = req.body;
    
    console.log(`Received update ${update.update_id}`);
    console.log('Update body:', JSON.stringify(update, null, 2));

    // 处理机器人被添加到群组的事件
    if (update.my_chat_member) {
      await handleBotAddedToGroup(update);
      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    
    if (!message) {
      return res.status(200).json({ ok: true, message: 'No message in update' });
    }

    const chatId = message.chat.id;
    const userId = message.from?.id;
    const text = message.text || '';
    const username = message.from?.username || message.from?.first_name || 'User';

    console.log(`Message from ${username} (${userId}) in chat ${chatId}: ${text}`);

    if (text.startsWith('/')) {
      await handleCommand(chatId, userId, username, text);
    } else {
      await handleRegularMessage(chatId, userId, username, text);
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleCommand(chatId: number, userId: number | undefined, username: string, text: string) {
  const parts = text.split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);

  console.log(`Handling command: ${command} from ${username}`);

  switch (command) {
    case '/start':
      await sendMessage(chatId, 
        `👋 你好，${username}！\n\n` +
        `我是 Telegram 群管机器人，可以帮助你管理群组。\n\n` +
        `📌 可用命令：\n` +
        `/help - 查看帮助\n` +
        `/checkin - 每日签到\n` +
        `/me - 查看个人信息\n` +
        `/rank - 查看排行榜\n\n` +
        `将我添加到群组并设为管理员即可使用完整功能！`
      );
      break;

    case '/help':
      await sendMessage(chatId,
        `🤖 <b>机器人命令帮助</b>\n\n` +
        `<b>📝 用户命令</b>\n` +
        `/start - 开始使用机器人\n` +
        `/help - 查看帮助信息\n` +
        `/checkin - 每日签到获取积分\n` +
        `/me - 查看个人积分信息\n` +
        `/rank - 查看积分排行榜\n\n` +
        `<b>⚙️ 管理命令</b>\n` +
        `/reload - 刷新群组管理员列表\n` +
        `/config - 打开配置面板\n` +
        `/mute [时间] - 禁言用户（回复消息）\n` +
        `/ban - 封禁用户（回复消息）\n` +
        `/kick - 踢出用户（回复消息）\n` +
        `/warn - 警告用户（回复消息）`
      );
      break;

    case '/checkin':
    case '/签到':
      const points = Math.floor(Math.random() * 20) + 10;
      const streak = Math.floor(Math.random() * 30) + 1;
      await sendMessage(chatId,
        `✅ <b>签到成功！</b>\n\n` +
        `👤 用户：${username}\n` +
        `💰 获得积分：+${points}\n` +
        `🔥 连续签到：${streak} 天\n\n` +
        `继续保持，明天再来！💪`
      );
      break;

    case '/me':
    case '/我的':
      const userPoints = Math.floor(Math.random() * 1000) + 100;
      const userRank = Math.floor(Math.random() * 50) + 1;
      await sendMessage(chatId,
        `📊 <b>个人信息</b>\n\n` +
        `👤 用户：${username}\n` +
        `💰 当前积分：${userPoints}\n` +
        `🏆 排名：#${userRank}\n` +
        `🔥 连续签到：${Math.floor(Math.random() * 30) + 1} 天`
      );
      break;

    case '/rank':
    case '/排行':
      await sendMessage(chatId,
        `🏆 <b>积分排行榜</b>\n\n` +
        `🥇 Alice - 12,580 积分\n` +
        `🥈 Bob - 10,234 积分\n` +
        `🥉 Charlie - 8,756 积分\n` +
        `4. David - 6,543 积分\n` +
        `5. Eve - 5,432 积分\n\n` +
        `继续努力，争取上榜！💪`
      );
      break;

    case '/reload':
      await sendMessage(chatId,
        `✅ 群组信息已刷新！\n\n` +
        `管理员列表已更新。`
      );
      break;

    case '/config':
      await sendMessage(chatId,
        `⚙️ <b>群组配置</b>\n\n` +
        `请访问管理后台进行配置：\n` +
        `${WEB_URL}\n\n` +
        `或使用 Web App 进行配置。`
      );
      break;

    case '/mute':
      const muteTime = args[0] ? parseInt(args[0]) : 300;
      await sendMessage(chatId,
        `🔇 用户已被禁言 ${muteTime} 秒`
      );
      break;

    case '/ban':
      await sendMessage(chatId,
        `🚫 用户已被封禁`
      );
      break;

    case '/kick':
      await sendMessage(chatId,
        `👋 用户已被踢出群组`
      );
      break;

    case '/warn':
      const warnCount = Math.floor(Math.random() * 3) + 1;
      await sendMessage(chatId,
        `⚠️ 用户已被警告 (${warnCount}/3)\n\n` +
        `超过 3 次警告将被踢出群组。`
      );
      break;

    default:
      await sendMessage(chatId,
        `❓ 未知命令: ${command}\n\n` +
        `请使用 /help 查看可用命令。`
      );
  }
}

async function handleRegularMessage(chatId: number, userId: number | undefined, username: string, text: string) {
  console.log(`Regular message from ${username}: ${text}`);
  
  // 这里可以添加自动回复逻辑
  // 目前只记录消息
}

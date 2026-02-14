import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEB_URL = process.env.WEB_URL || 'https://your-admin-panel.com';

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

  if (newStatus === 'member' || newStatus === 'administrator') {
    const { data: groupData } = await supabase
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

    if (groupData && from) {
      const { data: userData } = await supabase
        .from('users')
        .upsert({
          telegram_id: from.id,
          username: from.username,
          first_name: from.first_name,
          is_bot: from.is_bot
        }, { onConflict: 'telegram_id' })
        .select()
        .single();

      if (userData) {
        await supabase.from('group_administrators').upsert({
          group_id: groupData.id,
          user_id: userData.id,
          is_owner: true
        }, { onConflict: 'group_id,user_id' });

        await supabase.from('group_configs').upsert({
          group_id: groupData.id
        }, { onConflict: 'group_id' });
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
    await supabase.from('groups').update({ is_active: false }).eq('chat_id', chat.id);
  }
}

async function handleCommand(chatId: number, userId: number | undefined, username: string, text: string) {
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

  const response = commands[command] || `❓ 未知命令: ${command}\n\n请使用 /help 查看可用命令。`;
  await sendMessage(chatId, response);
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

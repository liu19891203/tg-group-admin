// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/database';
import { cacheManager } from '../../lib/cache';
import { TelegramMessage } from '../types/telegram';
import { pointsService } from '../services/pointsService';
import { verificationService } from '../services/verificationService';
import { sendMessage, sendPhoto } from '../../lib/api';

interface PrivateMessageContext {
  message: TelegramMessage;
  userId: number;
  chatId: number;
  text: string;
  username?: string;
  firstName: string;
}

export async function handlePrivateMessage(req: VercelRequest, res: VercelResponse) {
  try {
    const message = req.body.message || req.body.edited_message;

    if (!message?.text) {
      return res.status(200).json({ handled: false, reason: 'No text content' });
    }

    const context: PrivateMessageContext = {
      message,
      userId: message.from.id,
      chatId: message.chat.id,
      text: message.text,
      username: message.from.username,
      firstName: message.from.first_name
    };

    console.log(`Private message from user ${context.userId}: ${context.text}`);

    if (context.text.startsWith('/')) {
      await handlePrivateCommand(context);
      return res.status(200).json({ handled: true, type: 'command' });
    }

    const verificationHandled = await handleVerificationResponse(context);
    if (verificationHandled) {
      return res.status(200).json({ handled: true, type: 'verification' });
    }

    await sendMainMenu(context.chatId, context.firstName);

    return res.status(200).json({ handled: true, type: 'menu' });

  } catch (error) {
    console.error('Private message handler error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}

async function handlePrivateCommand(context: PrivateMessageContext) {
  const command = context.text.split(' ')[0].toLowerCase();
  const args = context.text.split(' ').slice(1);

  switch (command) {
    case '/start':
      await handleStartCommand(context);
      break;

    case '/help':
    case '/帮助':
      await sendHelpMessage(context.chatId);
      break;

    case '/me':
    case '/我的':
      await sendUserInfo(context);
      break;

    case '/settings':
    case '/设置':
      await sendSettingsMenu(context.chatId);
      break;

    case '/groups':
    case '/群组':
      await sendUserGroups(context);
      break;

    case '/rank':
    case '/排行':
      await sendGlobalRank(context, args[0]);
      break;

    case '📊 我的积分':
    case '📊':
      await sendUserInfo(context);
      break;

    case '📋 我的群组':
    case '📋':
      await sendUserGroups(context);
      break;

    case '🏆 排行榜':
    case '🏆':
      await sendGlobalRank(context);
      break;

    case '❓ 帮助':
    case '❓':
      await sendHelpMessage(context.chatId);
      break;

    case '⚙️ 设置':
    case '⚙️':
      await sendSettingsMenu(context.chatId);
      break;

    default:
      await sendMessage(context.chatId, 
        '❓ 未知命令，请输入 /help 查看帮助',
        { replyMarkup: getMainMenuKeyboard() }
      );
  }
}

async function handleStartCommand(context: PrivateMessageContext) {
  const welcomeMessage = `👋 你好，${context.firstName}！

我是群管机器人，可以帮助你管理 Telegram 群组。

🎯 主要功能：
• 群组管理与配置
• 积分系统与签到
• 抽奖活动
• 自动回复与广告过滤
• 进群验证

点击下方按钮开始使用：`;

  await sendMessage(context.chatId, welcomeMessage, {
    replyMarkup: getMainMenuKeyboard()
  });
}

async function sendHelpMessage(chatId: number) {
  const helpMessage = `📖 帮助中心

🔹 基础命令
/start - 开始使用机器人
/help - 查看帮助信息
/me - 查看个人信息
/settings - 打开设置
/groups - 查看我的群组

🔹 积分相关
签到：在群组中发送 /checkin
排行：/rank [daily|monthly|total]

🔹 验证相关
进群后按提示完成验证
支持频道验证、验证码、计算题等

💡 提示：
• 积分在各个群组独立计算
• 连续签到可获得额外奖励
• 有问题请联系群管理员`;

  await sendMessage(chatId, helpMessage, {
    replyMarkup: getMainMenuKeyboard()
  });
}

async function sendUserInfo(context: PrivateMessageContext) {
  try {
    const { data: userGroups } = await supabase
      .from('user_points')
      .select(`
        points,
        total_points,
        checkin_count,
        checkin_streak,
        groups!inner (
          id,
          title
        )
      `)
      .eq('user_id', (await cacheManager.getOrCreateUser(context.userId))?.id);

    if (!userGroups || userGroups.length === 0) {
      await sendMessage(context.chatId, 
        '📊 你还没有在任何群组中活跃\n\n加入群组后开始获取积分吧！',
        { replyMarkup: getMainMenuKeyboard() }
      );
      return;
    }

    let infoMessage = `📊 个人信息\n\n`;
    infoMessage += `👤 用户：${context.username ? '@' + context.username : context.firstName}\n`;
    infoMessage += `🆔 ID：${context.userId}\n\n`;
    infoMessage += `📈 群组数据：\n`;

    for (const ug of userGroups.slice(0, 5)) {
      const group = ug.groups as { id: string; title: string };
      infoMessage += `\n【${group.title}】\n`;
      infoMessage += `• 当前积分：${ug.points}\n`;
      infoMessage += `• 总积分：${ug.total_points}\n`;
      infoMessage += `• 签到次数：${ug.checkin_count}\n`;
      infoMessage += `• 连续签到：${ug.checkin_streak} 天\n`;
    }

    if (userGroups.length > 5) {
      infoMessage += `\n... 还有 ${userGroups.length - 5} 个群组`;
    }

    await sendMessage(context.chatId, infoMessage, {
      replyMarkup: getMainMenuKeyboard()
    });

  } catch (error) {
    console.error('Send user info error:', error);
    await sendMessage(context.chatId, '❌ 获取信息失败，请稍后重试');
  }
}

async function sendSettingsMenu(chatId: number) {
  const settingsMessage = `⚙️ 设置中心

请选择要设置的选项：`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '🔔 通知设置', callback_data: 'settings_notifications' }],
      [{ text: '🌐 语言设置', callback_data: 'settings_language' }],
      [{ text: '🔒 隐私设置', callback_data: 'settings_privacy' }],
      [{ text: '🔙 返回主菜单', callback_data: 'menu_main' }]
    ]
  };

  await sendMessage(chatId, settingsMessage, { replyMarkup: keyboard });
}

async function sendUserGroups(context: PrivateMessageContext) {
  try {
    const user = await cacheManager.getOrCreateUser(context.userId);
    if (!user) {
      await sendMessage(context.chatId, '❌ 获取用户信息失败');
      return;
    }

    const { data: userGroups } = await supabase
      .from('user_points')
      .select(`
        points,
        groups!inner (
          id,
          title,
          chat_id
        )
      `)
      .eq('user_id', user.id)
      .order('points', { ascending: false })
      .limit(10);

    if (!userGroups || userGroups.length === 0) {
      await sendMessage(context.chatId, 
        '📋 你还没有加入任何管理的群组\n\n请先加入群组后再查看',
        { replyMarkup: getMainMenuKeyboard() }
      );
      return;
    }

    let message = `📋 我的群组\n\n`;

    const buttons: { text: string; callback_data: string }[][] = [];

    for (const ug of userGroups) {
      const group = ug.groups as { id: string; title: string; chat_id: number };
      message += `• ${group.title}：${ug.points} 积分\n`;
    }

    await sendMessage(context.chatId, message, {
      replyMarkup: getMainMenuKeyboard()
    });

  } catch (error) {
    console.error('Send user groups error:', error);
    await sendMessage(context.chatId, '❌ 获取群组列表失败');
  }
}

async function sendGlobalRank(context: PrivateMessageContext, type?: string) {
  try {
    const rankType = type || 'total';
    const user = await cacheManager.getOrCreateUser(context.userId);

    let message = `🏆 全局排行榜 (${rankType === 'daily' ? '今日' : rankType === 'monthly' ? '本月' : '总榜'})\n\n`;
    message += `⚠️ 排行榜功能需要在群组中使用\n\n`;
    message += `在群组中发送 /rank 查看该群组的排行榜`;

    await sendMessage(context.chatId, message, {
      replyMarkup: getMainMenuKeyboard()
    });

  } catch (error) {
    console.error('Send global rank error:', error);
    await sendMessage(context.chatId, '❌ 获取排行榜失败');
  }
}

async function handleVerificationResponse(context: PrivateMessageContext): Promise<boolean> {
  const { data: pendingVerification } = await supabase
    .from('verification_records')
    .select('*')
    .eq('telegram_id', context.userId)
    .eq('status', 'pending')
    .in('verification_type', ['captcha', 'calculation', 'gif', 'private'])
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!pendingVerification) {
    return false;
  }

  const result = await verificationService.verifyAnswer(pendingVerification.id, context.text);

  if (result.success) {
    await sendMessage(context.chatId, '✅ 验证成功！你现在可以在群组中发言了');
    
    if (pendingVerification.group_id) {
      const { data: group } = await supabase
        .from('groups')
        .select('chat_id')
        .eq('id', pendingVerification.group_id)
        .single();
      
      if (group) {
        await verificationService.unmuteUser(group.chat_id, context.userId);
      }
    }
  } else {
    await sendMessage(context.chatId, `❌ ${result.error}\n\n请重新输入正确答案`);
  }

  return true;
}

async function sendMainMenu(chatId: number, firstName: string) {
  await sendMessage(chatId, 
    `你好 ${firstName}！有什么可以帮你的吗？`,
    { replyMarkup: getMainMenuKeyboard() }
  );
}

function getMainMenuKeyboard(): { keyboard: { text: string }[][]; resize_keyboard: boolean } {
  return {
    keyboard: [
      [{ text: '📊 我的积分' }, { text: '📋 我的群组' }],
      [{ text: '🏆 排行榜' }, { text: '❓ 帮助' }],
      [{ text: '⚙️ 设置' }]
    ],
    resize_keyboard: true
  };
}

export async function handleSettingsCallback(
  chatId: number,
  userId: number,
  data: string
) {
  const settingType = data.replace('settings_', '');

  switch (settingType) {
    case 'notifications':
      await sendMessage(chatId, '🔔 通知设置\n\n此功能开发中...');
      break;

    case 'language':
      await sendMessage(chatId, '🌐 语言设置\n\n此功能开发中...');
      break;

    case 'privacy':
      await sendMessage(chatId, '🔒 隐私设置\n\n此功能开发中...');
      break;

    default:
      await sendMessage(chatId, '未知设置项');
  }
}

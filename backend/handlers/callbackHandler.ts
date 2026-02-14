// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/database';
import { telegram } from '../../lib/telegram';
import { answerCallbackQuery, editMessageText, sendMessage } from '../../lib/api';
import { cacheManager } from '../../lib/cache';
import { handleSettingsCallback } from './privateMessageHandler';
import { TelegramCallbackQuery } from '../types/telegram';

export async function handleCallback(req: VercelRequest, res: VercelResponse) {
  try {
    const callbackQuery = req.body.callback_query as TelegramCallbackQuery;
    
    if (!callbackQuery?.data || !callbackQuery?.id) {
      return res.status(200).json({ error: 'Invalid callback query' });
    }

    const { data, from, message } = callbackQuery;
    const userId = from.id;
    const chatId = message?.chat?.id;
    const messageId = message?.message_id;

    console.log(`Callback from user ${userId}: ${data}`);

    if (data.startsWith('verify_')) {
      await handleVerificationCallback(callbackQuery, data, userId, chatId, messageId);
    } else if (data.startsWith('lottery_')) {
      await handleLotteryCallback(callbackQuery, data, userId, chatId);
    } else if (data.startsWith('auto_reply_')) {
      await handleAutoReplyCallback(callbackQuery, data, userId, chatId);
    } else if (data.startsWith('config_')) {
      await handleConfigCallback(callbackQuery, data, userId, chatId);
    } else if (data.startsWith('settings_')) {
      if (chatId) {
        await handleSettingsCallback(chatId, userId, data);
      }
      await answerCallbackQuery(callbackQuery.id, { text: '设置已更新' });
    } else if (data.startsWith('menu_')) {
      await handleMenuCallback(callbackQuery, data, userId, chatId);
    } else {
      await answerCallbackQuery(callbackQuery.id, { text: '未知操作' });
    }

    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error('Callback handler error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}

async function handleVerificationCallback(
  callbackQuery: TelegramCallbackQuery,
  data: string,
  userId: number,
  chatId?: number,
  messageId?: number
) {
  const [type, verifyId] = data.split(':');
  
  try {
    switch (type) {
      case 'verify_channel':
        await handleChannelVerification(callbackQuery, verifyId, userId, chatId);
        break;
      case 'verify_captcha':
        await handleCaptchaVerification(callbackQuery, verifyId, userId, chatId);
        break;
      case 'verify_calc':
        await handleCalculationVerification(callbackQuery, verifyId, userId, chatId);
        break;
      case 'verify_gif':
        await handleGifVerification(callbackQuery, verifyId, userId, chatId);
        break;
      default:
        await answerCallbackQuery(callbackQuery.id, { text: '未知验证类型' });
    }
  } catch (error) {
    console.error('Verification callback error:', error);
    await answerCallbackQuery(callbackQuery.id, { text: '处理失败，请重试' });
  }
}

async function handleChannelVerification(
  callbackQuery: TelegramCallbackQuery,
  verifyId: string,
  userId: number,
  chatId?: number
) {
  const { data: record } = await supabase
    .from('verification_records')
    .select('*')
    .eq('id', verifyId)
    .eq('status', 'pending')
    .single();

  if (!record) {
    await answerCallbackQuery(callbackQuery.id, { 
      text: '❌ 验证已过期或无效',
      showAlert: true 
    });
    return;
  }

  if (new Date(record.expires_at) < new Date()) {
    await supabase
      .from('verification_records')
      .update({ status: 'expired' })
      .eq('id', verifyId);

    await answerCallbackQuery(callbackQuery.id, { 
      text: '⏰ 验证已过期，请重新验证',
      showAlert: true 
    });
    return;
  }

  const channelId = record.challenge_data?.channel_id;
  if (!channelId) {
    await answerCallbackQuery(callbackQuery.id, { text: '❌ 配置错误' });
    return;
  }

  const chatMember = await telegram.getChatMember(channelId, userId);
  const isMember = ['member', 'administrator', 'creator'].includes(chatMember.status);

  if (isMember) {
    await supabase
      .from('verification_records')
      .update({ 
        status: 'passed',
        completed_at: new Date().toISOString()
      })
      .eq('id', verifyId);

    await answerCallbackQuery(callbackQuery.id, { 
      text: '✅ 验证成功！欢迎加入！',
      showAlert: true 
    });

    if (chatId && messageId) {
      await editMessageText(chatId, messageId, '✅ 验证成功！欢迎加入！');
    }

    await telegram.restrictChatMember(chatId!, userId, {
      canSendMessages: true,
      canSendMediaMessages: true,
      canSendOtherMessages: true
    });

  } else {
    const attemptCount = (record.attempt_count || 0) + 1;
    const isExhausted = attemptCount >= (record.max_attempts || 3);

    await supabase
      .from('verification_records')
      .update({ 
        attempt_count: attemptCount,
        status: isExhausted ? 'failed' : 'pending'
      })
      .eq('id', verifyId);

    if (isExhausted) {
      await answerCallbackQuery(callbackQuery.id, { 
        text: '❌ 验证失败次数过多，请先关注频道后再试',
        showAlert: true 
      });
    } else {
      await answerCallbackQuery(callbackQuery.id, { 
        text: '❌ 您还没有关注频道，请先关注后再验证',
        showAlert: false 
      });
    }
  }
}

async function handleCaptchaVerification(
  callbackQuery: TelegramCallbackQuery,
  verifyId: string,
  userId: number,
  chatId?: number
) {
  await answerCallbackQuery(callbackQuery.id, { text: '请在私聊中输入验证码' });
}

async function handleCalculationVerification(
  callbackQuery: TelegramCallbackQuery,
  verifyId: string,
  userId: number,
  chatId?: number
) {
  await answerCallbackQuery(callbackQuery.id, { text: '请在私聊中输入答案' });
}

async function handleGifVerification(
  callbackQuery: TelegramCallbackQuery,
  verifyId: string,
  userId: number,
  chatId?: number
) {
  await answerCallbackQuery(callbackQuery.id, { text: '请在私聊中完成GIF验证码' });
}

async function handleLotteryCallback(
  callbackQuery: TelegramCallbackQuery,
  data: string,
  userId: number,
  chatId?: number
) {
  const [type, lotteryId] = data.split(':');
  
  switch (type) {
    case 'lottery_join':
      await handleLotteryJoin(callbackQuery, lotteryId, userId, chatId);
      break;
    case 'lottery_view':
      await handleLotteryView(callbackQuery, lotteryId, userId);
      break;
    default:
      await answerCallbackQuery(callbackQuery.id, { text: '未知操作' });
  }
}

async function handleLotteryJoin(
  callbackQuery: TelegramCallbackQuery,
  lotteryId: string,
  userId: number,
  chatId?: number
) {
  await answerCallbackQuery(callbackQuery.id, { text: '参与成功！祝您好运！🍀' });
}

async function handleLotteryView(
  callbackQuery: TelegramCallbackQuery,
  lotteryId: string,
  userId: number
) {
  await answerCallbackQuery(callbackQuery.id, { text: '正在加载...' });
}

async function handleAutoReplyCallback(
  callbackQuery: TelegramCallbackQuery,
  data: string,
  userId: number,
  chatId?: number
) {
  await answerCallbackQuery(callbackQuery.id, { text: '已收到反馈' });
}

async function handleConfigCallback(
  callbackQuery: TelegramCallbackQuery,
  data: string,
  userId: number,
  chatId?: number
) {
  await answerCallbackQuery(callbackQuery.id, { text: '配置已更新' });
}

async function handleMenuCallback(
  callbackQuery: TelegramCallbackQuery,
  data: string,
  userId: number,
  chatId?: number
) {
  const menuAction = data.replace('menu_', '');

  switch (menuAction) {
    case 'main':
      if (chatId) {
        await editMessageText(chatId, callbackQuery.message!.message_id, 
          '🏠 主菜单\n\n请选择操作：',
          { replyMarkup: getMainMenuInlineKeyboard() }
        );
      }
      break;

    case 'points':
      await answerCallbackQuery(callbackQuery.id, { text: '请在私聊中查看积分信息' });
      break;

    case 'groups':
      await answerCallbackQuery(callbackQuery.id, { text: '请在私聊中查看群组列表' });
      break;

    case 'help':
      await answerCallbackQuery(callbackQuery.id, { text: '请发送 /help 查看帮助' });
      break;

    default:
      await answerCallbackQuery(callbackQuery.id, { text: '未知菜单操作' });
  }
}

function getMainMenuInlineKeyboard(): { inline_keyboard: { text: string; callback_data: string }[][] } {
  return {
    inline_keyboard: [
      [{ text: '📊 我的积分', callback_data: 'menu_points' }],
      [{ text: '📋 我的群组', callback_data: 'menu_groups' }],
      [{ text: '❓ 帮助', callback_data: 'menu_help' }]
    ]
  };
}

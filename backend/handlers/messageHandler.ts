// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/database';
import { cacheManager } from '../../lib/cache';
import { telegramUpdateSchema } from '../types/validation';
import { TelegramUpdate, TelegramUser, TelegramChat } from '../types/telegram';
import { verificationService } from '../services/verificationService';
import { adFilterService } from '../services/adFilterService';
import { autoReplyService } from '../services/autoReplyService';
import { pointsService } from '../services/pointsService';
import { antiSpamService } from '../services/antiSpamService';
import { sendMessage, deleteMessage, restrictChatMember } from '../../lib/api';
import { redis, createCacheKey } from '../../lib/redis';

export async function handleMessage(req: VercelRequest, res: VercelResponse) {
  try {
    const update: TelegramUpdate = req.body;
    const message = update.message || update.edited_message;

    if (!message?.text && !message?.caption) {
      return res.status(200).json({ handled: false, reason: 'No text content' });
    }

    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text || message.caption || '';

    const group = await cacheManager.getGroup(chatId);
    if (!group) {
      return res.status(200).json({ handled: false, reason: 'Group not found' });
    }

    const config = await cacheManager.getGroupConfig(group.id);
    if (!config) {
      return res.status(200).json({ handled: false, reason: 'Config not found' });
    }

    const user = await cacheManager.getOrCreateUser(userId, {
      username: message.from.username,
      first_name: message.from.first_name,
      last_name: message.from.last_name,
      language_code: message.from.language_code
    }, group.id);

    console.log(`Processing message from user ${userId} in group ${chatId}`);

    if (text.startsWith('/')) {
      await handleCommand(message, group.id, text, userId);
      return res.status(200).json({ handled: true, type: 'command' });
    }

    const verificationCheck = await checkVerificationStatus(userId, group.id);
    if (verificationCheck.isPending) {
      if (verificationCheck.needsPrivateAnswer) {
        await handlePrivateVerificationAnswer(message, verificationCheck.recordId);
      }
      return res.status(200).json({ handled: true, type: 'verification_pending' });
    }

    const adsResult = await adFilterService.check(text, config.anti_ads_config, message);
    if (adsResult.isAds) {
      await adFilterService.punish(message, adsResult, config.anti_ads_config, group.id);
      return res.status(200).json({ handled: true, type: 'ads_filtered' });
    }

    const reply = await autoReplyService.findReply(text, group.id);
    if (reply) {
      await autoReplyService.sendReply(message.chat.id, reply);
      if (reply.delete_trigger) {
        setTimeout(() => {
          deleteMessage(chatId, message.message_id).catch(console.error);
        }, (reply.delete_delay || 0) * 1000);
      }
      return res.status(200).json({ handled: true, type: 'auto_reply', rule_id: reply.id });
    }

    const spamResult = await antiSpamService.check(userId, chatId, config.anti_spam_config);
    if (spamResult.isSpam) {
      await antiSpamService.punish(message, spamResult, config.anti_spam_config);
      return res.status(200).json({ handled: true, type: 'spam_detected' });
    }

    pointsService.processMessage(userId, group.id, text, config.points_config)
      .catch(err => console.error('Points processing error:', err));

    return res.status(200).json({ handled: true, type: 'processed' });

  } catch (error) {
    console.error('Message handler error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}

async function handleCommand(message: {
  chat: { id: number };
  from: { id: number; username?: string };
  text: string;
  message_id: number;
}, groupId: string, text: string, userId: number) {
  const command = text.split(' ')[0].toLowerCase();

  switch (command) {
    case '/checkin':
    case '/签到':
      try {
        const result = await pointsService.checkin(userId, groupId);
        await sendMessage(message.chat.id, 
          `✅ 签到成功！\n\n获得积分：+${result.points}\n连续签到：${result.streak} 天\n额外奖励：+${result.bonus} 积分\n\n加油！继续保持！💪`
        );
      } catch (error) {
        const messageText = error instanceof Error ? error.message : '签到失败';
        await sendMessage(message.chat.id, `❌ ${messageText}`);
      }
      break;

    case '/me':
    case '/我的':
      try {
        const userInfo = await pointsService.getUserStats(userId, groupId);
        await sendMessage(message.chat.id, 
          `📊 您的积分信息\n\n当前积分：${userInfo.points}\n总积分：${userInfo.totalPoints}\n连续签到：${userInfo.streak} 天\n排名：#${userInfo.rank}`
        );
      } catch (error) {
        await sendMessage(message.chat.id, '❌ 获取信息失败');
      }
      break;

    case '/rank':
    case '/排行':
      try {
        const textParts = text.split(' ');
        const type = textParts[1]?.toLowerCase() || 'total';
        const topUsers = await pointsService.getLeaderboard(groupId, type as 'daily' | 'monthly' | 'total', 10);
        
        let rankText = `🏆 积分排行 (${type === 'daily' ? '今日' : type === 'monthly' ? '本月' : '总榜'})\n\n`;
        
        topUsers.forEach((u, i) => {
          const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
          rankText += `${medal} ${u.username || '用户'}: ${u.points} 积分\n`;
        });

        await sendMessage(message.chat.id, rankText);
      } catch (error) {
        await sendMessage(message.chat.id, '❌ 获取排行榜失败');
      }
      break;

    case '/help':
    case '/帮助':
      await sendMessage(message.chat.id, 
        `🤖 机器人命令帮助\n\n📝 通用命令\n/checkin 或 /签到 - 每日签到\n/me 或 /我的 - 查看积分信息\n/rank 或 /排行 - 查看排行榜\n\n管理命令（需要管理员权限）\n/reload - 刷新群组信息\n/config - 打开配置面板`
      );
      break;

    default:
      await sendMessage(message.chat.id, '❓ 未知命令，请输入 /help 查看帮助');
  }
}

async function checkVerificationStatus(userId: number, groupId: string): Promise<{
  isPending: boolean;
  needsPrivateAnswer: boolean;
  recordId?: string;
}> {
  const { data: record } = await supabase
    .from('verification_records')
    .select('id, verification_type, status')
    .eq('telegram_id', userId)
    .eq('group_id', groupId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!record) {
    return { isPending: false, needsPrivateAnswer: false };
  }

  return {
    isPending: true,
    needsPrivateAnswer: record.verification_type === 'private',
    recordId: record.id
  };
}

async function handlePrivateVerificationAnswer(message: {
  chat: { id: number };
  from: { id: number };
  text: string;
}, recordId: string) {
  const answer = message.text?.trim();
  if (!answer) return;

  await verificationService.handlePrivateAnswer(message.from.id, recordId, answer);
}

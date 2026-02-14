import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../../lib/mockDb';

interface ParticipateRequest {
  groupId: string;
  lotteryId: string;
  userId: string;
  telegramId: number;
  username?: string;
  tickets?: number;
}

interface ParticipateResult {
  success: boolean;
  message: string;
  tickets?: number;
  total_participants?: number;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { groupId, lotteryId, userId, telegramId, username, tickets = 1 } = req.body as ParticipateRequest;

    if (!groupId || !lotteryId || !userId || !telegramId) {
      return res.status(400).json({ error: '参数不完整' });
    }

    // 模拟检查抽奖条件
    const conditions = {
      follow_channel: '@example_channel',
      min_messages: 5,
      must_have_username: true
    };

    // 检查是否关注频道（模拟）
    if (conditions.follow_channel) {
      const isFollowing = true; // 实际应该调用 Telegram API 检查
      if (!isFollowing) {
        return res.status(400).json({
          success: false,
          message: `请先关注频道 ${conditions.follow_channel}`
        });
      }
    }

    // 检查消息数量（模拟）
    if (conditions.min_messages) {
      const userMessages = 10; // 模拟用户消息数
      if (userMessages < conditions.min_messages) {
        return res.status(400).json({
          success: false,
          message: `需要在群组中发送至少 ${conditions.min_messages} 条消息`
        });
      }
    }

    // 检查用户名（模拟）
    if (conditions.must_have_username && !username) {
      return res.status(400).json({
        success: false,
        message: '需要设置 Telegram 用户名才能参与抽奖'
      });
    }

    // 模拟参与抽奖
    const result: ParticipateResult = {
      success: true,
      message: `成功参与抽奖！您获得了 ${tickets} 张抽奖券`,
      tickets: tickets,
      total_participants: Math.floor(Math.random() * 100) + 10
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('Participate lottery error:', error);
    return res.status(500).json({ error: '参与抽奖失败' });
  }
}

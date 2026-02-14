import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../../lib/mockDb';

interface DrawRequest {
  groupId: string;
  lotteryId: string;
}

interface Winner {
  user_id: string;
  telegram_id: number;
  username: string;
  display_name: string;
  prize: string;
}

interface DrawResult {
  success: boolean;
  message: string;
  winners: Winner[];
  total_participants: number;
  draw_time: string;
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
    const { groupId, lotteryId } = req.body as DrawRequest;

    if (!groupId || !lotteryId) {
      return res.status(400).json({ error: '参数不完整' });
    }

    // 模拟参与者列表
    const participants = [
      { user_id: 'user1', telegram_id: 111111111, username: 'winner1', display_name: '幸运用户1' },
      { user_id: 'user2', telegram_id: 222222222, username: 'winner2', display_name: '幸运用户2' },
      { user_id: 'user3', telegram_id: 333333333, username: 'winner3', display_name: '幸运用户3' },
      { user_id: 'user4', telegram_id: 444444444, username: 'winner4', display_name: '幸运用户4' },
      { user_id: 'user5', telegram_id: 555555555, username: 'winner5', display_name: '幸运用户5' }
    ];

    // 随机选择获奖者（模拟）
    const winnerCount = Math.min(3, participants.length);
    const winners: Winner[] = [];
    
    const shuffled = participants.sort(() => Math.random() - 0.5);
    for (let i = 0; i < winnerCount; i++) {
      winners.push({
        ...shuffled[i],
        prize: '精美礼品一份'
      });
    }

    const result: DrawResult = {
      success: true,
      message: `抽奖完成！共选出 ${winners.length} 位获奖者`,
      winners,
      total_participants: participants.length,
      draw_time: new Date().toISOString()
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('Draw lottery error:', error);
    return res.status(500).json({ error: '开奖失败' });
  }
}

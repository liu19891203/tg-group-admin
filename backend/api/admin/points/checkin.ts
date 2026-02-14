import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../../lib/mockDb';

interface CheckinRequest {
  groupId: string;
  userId: string;
  telegramId: number;
}

interface CheckinResult {
  success: boolean;
  points_earned: number;
  total_points: number;
  streak: number;
  bonus: number;
  message: string;
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
    const { groupId, userId, telegramId } = req.body as CheckinRequest;

    if (!groupId || !userId || !telegramId) {
      return res.status(400).json({ error: '参数不完整' });
    }

    // 模拟签到逻辑
    const today = new Date().toDateString();
    const lastCheckin = new Date(Date.now() - 24 * 60 * 60 * 1000).toDateString(); // 昨天
    
    // 检查是否已经签到
    if (today === lastCheckin) {
      return res.status(400).json({ 
        success: false, 
        error: '今日已签到',
        message: '您今天已经签到过了，请明天再来！'
      });
    }

    // 计算连续签到天数
    const streak = today === lastCheckin ? 2 : 1; // 简化逻辑
    
    // 计算签到奖励
    const basePoints = 10;
    const bonusMultiplier = Math.min(streak - 1, 4); // 最多4天奖励
    const bonusPoints = bonusMultiplier * 2; // 每天额外2点
    const totalPointsEarned = basePoints + bonusPoints;

    // 模拟用户数据
    const userPoints = {
      total_points: 100 + totalPointsEarned,
      today_points: totalPointsEarned,
      streak: streak,
      last_checkin: new Date().toISOString()
    };

    const result: CheckinResult = {
      success: true,
      points_earned: totalPointsEarned,
      total_points: userPoints.total_points,
      streak: userPoints.streak,
      bonus: bonusPoints,
      message: streak > 1 ? 
        `签到成功！获得${totalPointsEarned}积分（连续签到${streak}天奖励${bonusPoints}积分）` :
        `签到成功！获得${totalPointsEarned}积分`
    };

    return res.status(200).json(result);

  } catch (error) {
    console.error('Checkin error:', error);
    return res.status(500).json({ error: '签到失败' });
  }
}

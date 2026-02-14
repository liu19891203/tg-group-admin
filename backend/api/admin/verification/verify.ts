import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../../lib/mockDb';

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
    const { recordId, answer, userId, groupId } = req.body as {
      recordId: string;
      answer: string;
      userId: string;
      groupId: string;
    };

    if (!recordId || !answer || !userId || !groupId) {
      return res.status(400).json({ error: '参数不完整' });
    }

    // 模拟验证记录查找
    const verificationRecord = {
      id: recordId,
      user_id: userId,
      group_id: groupId,
      verification_type: 'math',
      challenge_data: {
        answer: '5', // 示例答案
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      },
      status: 'pending',
      attempt_count: 0,
      max_attempts: 3
    };

    // 检查是否过期
    if (new Date() > new Date(verificationRecord.challenge_data.expires_at)) {
      return res.status(400).json({ 
        success: false, 
        error: '验证已过期',
        status: 'expired'
      });
    }

    // 检查尝试次数
    if (verificationRecord.attempt_count >= verificationRecord.max_attempts) {
      return res.status(400).json({ 
        success: false, 
        error: '尝试次数已用完',
        status: 'failed'
      });
    }

    // 验证答案
    const isCorrect = answer.trim() === verificationRecord.challenge_data.answer;
    
    if (isCorrect) {
      // 验证成功
      return res.status(200).json({
        success: true,
        message: '验证成功',
        status: 'verified'
      });
    } else {
      // 验证失败
      const remainingAttempts = verificationRecord.max_attempts - verificationRecord.attempt_count - 1;
      
      return res.status(200).json({
        success: false,
        error: '答案错误',
        status: 'failed',
        remaining_attempts: remainingAttempts
      });
    }

  } catch (error) {
    console.error('Verify challenge error:', error);
    return res.status(500).json({ error: '验证失败' });
  }
}

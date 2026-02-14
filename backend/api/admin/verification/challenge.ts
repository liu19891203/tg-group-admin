import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../../lib/mockDb';

interface VerificationChallenge {
  type: 'math' | 'image' | 'gif' | 'channel';
  challenge: string;
  answer: string;
  expires_at: string;
}

function generateMathChallenge(difficulty: number = 1): VerificationChallenge {
  const num1 = Math.floor(Math.random() * 10 * difficulty) + 1;
  const num2 = Math.floor(Math.random() * 10 * difficulty) + 1;
  const operations = ['+', '-'];
  const operation = operations[Math.floor(Math.random() * operations.length)];
  
  let answer: number;
  let challenge: string;
  
  if (operation === '+') {
    answer = num1 + num2;
    challenge = `${num1} + ${num2} = ?`;
  } else {
    // 确保减法结果为正数
    const maxNum = Math.max(num1, num2);
    const minNum = Math.min(num1, num2);
    answer = maxNum - minNum;
    challenge = `${maxNum} - ${minNum} = ?`;
  }
  
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟过期
  
  return {
    type: 'math',
    challenge,
    answer: answer.toString(),
    expires_at: expiresAt.toISOString()
  };
}

function generateImageChallenge(): VerificationChallenge {
  // 生成简单的图片验证码（数字）
  const numbers = ['123', '456', '789', '234', '567', '890'];
  const answer = numbers[Math.floor(Math.random() * numbers.length)];
  
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5分钟过期
  
  return {
    type: 'image',
    challenge: `请识别图片中的数字: ${answer}`, // 实际应该返回图片URL
    answer,
    expires_at: expiresAt.toISOString()
  };
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
    const { groupId, userId, verificationType, difficulty } = req.body as {
      groupId: string;
      userId: string;
      verificationType: string;
      difficulty?: number;
    };

    if (!groupId || !userId || !verificationType) {
      return res.status(400).json({ error: '参数不完整' });
    }

    let challenge: VerificationChallenge;

    switch (verificationType) {
      case 'math':
        challenge = generateMathChallenge(difficulty);
        break;
      case 'image':
        challenge = generateImageChallenge();
        break;
      case 'channel':
        challenge = {
          type: 'channel',
          challenge: '请先关注指定频道',
          answer: 'verified',
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10分钟
        };
        break;
      case 'gif':
        challenge = {
          type: 'gif',
          challenge: '请识别GIF中的验证码',
          answer: 'gif123', // 简化示例
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        };
        break;
      default:
        return res.status(400).json({ error: '不支持的验证类型' });
    }

    // 保存验证记录到数据库
    const verificationRecord = {
      id: Math.random().toString(36).substr(2, 9),
      user_id: userId,
      group_id: groupId,
      verification_type: verificationType,
      challenge_data: challenge,
      status: 'pending',
      created_at: new Date().toISOString(),
      expires_at: challenge.expires_at
    };

    return res.status(200).json({
      success: true,
      challenge: {
        type: challenge.type,
        challenge: challenge.challenge,
        expires_at: challenge.expires_at
      },
      record_id: verificationRecord.id
    });

  } catch (error) {
    console.error('Generate challenge error:', error);
    return res.status(500).json({ error: '生成验证失败' });
  }
}

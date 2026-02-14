import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../lib/mockDb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { group_id, keyword, limit = '10' } = req.query;
    
    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID参数'
      });
    }

    if (!keyword || (keyword as string).length < 2) {
      return res.status(400).json({
        success: false,
        error: '搜索关键词至少需要2个字符'
      });
    }

    // 从mockDb搜索用户
    const users = mockDb.searchUsers(group_id as string, keyword as string, Number(limit));
    
    return res.status(200).json({
      success: true,
      data: users,
      total: users.length
    });
  } catch (error: any) {
    console.error('User search error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

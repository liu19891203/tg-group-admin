import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/database';
import { verifyAdmin } from '../../middleware/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const auth = await verifyAdmin(req);
  if (!auth) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getVerifiedLevels(req, res);
      case 'POST':
        return await saveVerifiedLevels(req, res);
      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Verified levels API error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// 获取认证等级配置
async function getVerifiedLevels(req: VercelRequest, res: VercelResponse) {
  const { group_id } = req.query;

  if (!group_id) {
    return res.status(400).json({ success: false, error: '群组ID不能为空' });
  }

  const { data, error } = await supabase
    .from('verified_levels')
    .select('*')
    .eq('group_id', group_id)
    .order('level', { ascending: true });

  if (error) {
    console.error('Error fetching verified levels:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch levels' });
  }

  // 如果数据库中没有配置，返回默认配置
  if (!data || data.length === 0) {
    const defaultLevels = [
      { level: 1, name: '普通认证', badge: '✓', color: '#67C23A' },
      { level: 2, name: '高级认证', badge: '⭐', color: '#E6A23C' },
      { level: 3, name: 'VIP认证', badge: '👑', color: '#F56C6C' }
    ];

    return res.status(200).json({
      success: true,
      data: defaultLevels
    });
  }

  return res.status(200).json({
    success: true,
    data: (data as any[]).map(item => ({
      level: (item as any).level,
      name: (item as any).name,
      badge: (item as any).badge,
      color: (item as any).color
    }))
  });
}

// 保存认证等级配置
async function saveVerifiedLevels(req: VercelRequest, res: VercelResponse) {
  const { group_id, levels } = req.body;

  if (!group_id || !levels || !Array.isArray(levels)) {
    return res.status(400).json({ success: false, error: '参数不完整' });
  }

  // 验证等级数据
  for (const level of levels) {
    if (!level.level || !level.name) {
      return res.status(400).json({ success: false, error: '等级数据不完整' });
    }
  }

  try {
    // 删除旧配置
    await supabase
      .from('verified_levels')
      .delete()
      .eq('group_id', group_id);

    // 插入新配置
    const insertData = levels.map(level => ({
      group_id,
      level: level.level,
      name: level.name,
      badge: level.badge || '',
      color: level.color || '#909399',
      updated_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('verified_levels')
      .insert(insertData as any)
      .select();

    if (error) {
      console.error('Error saving verified levels:', error);
      return res.status(500).json({ success: false, error: 'Failed to save levels' });
    }

    return res.status(200).json({
      success: true,
      message: '等级配置已保存',
      data
    });

  } catch (error) {
    console.error('Error saving verified levels:', error);
    return res.status(500).json({ success: false, error: 'Failed to save levels' });
  }
}

import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/database';
import { verifyAdmin } from '../../middleware/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
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
        return await getVerifiedMessages(req, res);
      case 'POST':
        return await saveVerifiedMessages(req, res);
      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Verified messages API error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// 获取认证消息配置
async function getVerifiedMessages(req: VercelRequest, res: VercelResponse) {
  const { group_id } = req.query;

  if (!group_id) {
    return res.status(400).json({ success: false, error: '群组ID不能为空' });
  }

  const { data, error } = await supabase
    .from('verified_messages')
    .select('*')
    .eq('group_id', group_id)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error('Error fetching verified messages:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }

  // 如果没有配置，返回默认空配置
  if (!data) {
    return res.status(200).json({
      success: true,
      data: {
        unverified_message: '',
        unverified_message_html: '',
        verified_message: '',
        verified_message_html: '',
        include_level_1: true,
        include_level_2: true,
        include_level_3: true
      }
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      unverified_message: (data as any).unverified_message,
      unverified_message_html: (data as any).unverified_message_html,
      verified_message: (data as any).verified_message,
      verified_message_html: (data as any).verified_message_html,
      include_level_1: (data as any).include_level_1,
      include_level_2: (data as any).include_level_2,
      include_level_3: (data as any).include_level_3
    }
  });
}

// 保存认证消息配置
async function saveVerifiedMessages(req: VercelRequest, res: VercelResponse) {
  const {
    group_id,
    unverified_message,
    unverified_message_html,
    verified_message,
    verified_message_html,
    include_level_1 = true,
    include_level_2 = true,
    include_level_3 = true
  } = req.body;

  if (!group_id) {
    return res.status(400).json({ success: false, error: '群组ID不能为空' });
  }

  try {
    // 使用 upsert 保存配置
    const { data, error } = await supabase
      .from('verified_messages')
      .upsert({
        group_id,
        unverified_message: unverified_message || '',
        unverified_message_html: unverified_message_html || '',
        verified_message: verified_message || '',
        verified_message_html: verified_message_html || '',
        include_level_1,
        include_level_2,
        include_level_3,
        updated_at: new Date().toISOString()
      } as any, {
        onConflict: 'group_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving verified messages:', error);
      return res.status(500).json({ success: false, error: 'Failed to save messages' });
    }

    return res.status(200).json({
      success: true,
      message: '消息配置已保存',
      data
    });

  } catch (error) {
    console.error('Error saving verified messages:', error);
    return res.status(500).json({ success: false, error: 'Failed to save messages' });
  }
}

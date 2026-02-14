import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getChannelSettings(req, res);
      case 'POST':
      case 'PUT':
        return await updateChannelSettings(req, res);
      case 'DELETE':
        return await unlinkChannel(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Channel settings API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 获取频道设置
async function getChannelSettings(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id } = req.query;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    const { data, error } = await supabase
      .from('channel_settings')
      .select('*')
      .eq('group_id', group_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // 如果没有设置，返回默认配置
    const defaultSettings = {
      group_id,
      channel_id: null,
      channel_name: null,
      is_linked: false,
      auto_unpin: false,
      unpin_delay_seconds: 0,
      capture_comments: false,
      comment_keywords: [],
      auto_reply_comments: false,
      comment_reply_template: '',
      delete_channel_messages: false,
      notify_on_link: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      data: data || defaultSettings
    });
  } catch (error: any) {
    console.error('Get channel settings error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 更新频道设置
async function updateChannelSettings(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, channel_id, channel_name, ...settings } = req.body;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    // 检查是否已存在设置
    const { data: existing } = await supabase
      .from('channel_settings')
      .select('id')
      .eq('group_id', group_id)
      .single();

    let result;
    if (existing) {
      // 更新
      result = await supabase
        .from('channel_settings')
        .update({
          channel_id,
          channel_name,
          ...settings,
          updated_at: new Date().toISOString()
        })
        .eq('group_id', group_id)
        .select()
        .single();
    } else {
      // 创建
      result = await supabase
        .from('channel_settings')
        .insert({
          group_id,
          channel_id,
          channel_name,
          ...settings,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
    }

    if (result.error) throw result.error;

    return res.status(200).json({
      success: true,
      data: result.data
    });
  } catch (error: any) {
    console.error('Update channel settings error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 取消关联频道
async function unlinkChannel(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id } = req.query;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    const { error } = await supabase
      .from('channel_settings')
      .update({
        channel_id: null,
        channel_name: null,
        is_linked: false,
        updated_at: new Date().toISOString()
      })
      .eq('group_id', group_id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: '频道已取消关联'
    });
  } catch (error: any) {
    console.error('Unlink channel error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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
        return await getAutoDeleteConfig(req, res);
      case 'POST':
        return await createAutoDeleteConfig(req, res);
      case 'PUT':
        return await updateAutoDeleteConfig(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Auto-delete API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 获取自动删除配置
async function getAutoDeleteConfig(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id } = req.query;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    const { data, error } = await supabase
      .from('auto_delete_configs')
      .select('*')
      .eq('group_id', group_id)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // 如果没有配置，返回默认配置
    const defaultConfig = {
      group_id,
      enabled: false,
      delete_porn_images: false,
      delete_external_replies: false,
      delete_service_messages: false,
      delete_channel_forward: false,
      delete_links: false,
      delete_long_messages: false,
      delete_video_messages: false,
      delete_stickers: false,
      delete_forwards: false,
      delete_archives: false,
      delete_executables: false,
      delete_documents: false,
      delete_bot_commands: false,
      delete_ad_stickers: false,
      delete_all_messages: false,
      delete_premium_emojis: false,
      delete_contacts: false,
      long_message_threshold: 1000,
      custom_keywords: [],
      delete_delay_seconds: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      data: data || defaultConfig
    });
  } catch (error: any) {
    console.error('Get auto-delete config error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 创建自动删除配置
async function createAutoDeleteConfig(req: VercelRequest, res: VercelResponse) {
  try {
    const config = req.body;

    if (!config.group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    const { data, error } = await supabase
      .from('auto_delete_configs')
      .insert({
        ...config,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Create auto-delete config error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 更新自动删除配置
async function updateAutoDeleteConfig(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id } = req.query;
    const config = req.body;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    // 先检查是否存在
    const { data: existing } = await supabase
      .from('auto_delete_configs')
      .select('id')
      .eq('group_id', group_id)
      .single();

    let result;
    if (existing) {
      // 更新
      result = await supabase
        .from('auto_delete_configs')
        .update({
          ...config,
          updated_at: new Date().toISOString()
        })
        .eq('group_id', group_id)
        .select()
        .single();
    } else {
      // 创建
      result = await supabase
        .from('auto_delete_configs')
        .insert({
          ...config,
          group_id,
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
    console.error('Update auto-delete config error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

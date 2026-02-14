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
        return await getPornDetectionConfig(req, res);
      case 'POST':
      case 'PUT':
        return await updatePornDetectionConfig(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Porn detection API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 获取色情内容检测配置
async function getPornDetectionConfig(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id } = req.query;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    const { data, error } = await supabase
      .from('porn_detection_configs')
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
      sensitivity: 'medium',           // low, medium, high
      delete_delay_seconds: 0,         // 延迟删除时间
      action: 'delete',                // delete, mute, ban, warn
      mute_duration: 3600,             // 禁言时长（秒）
      check_images: true,              // 检测图片
      check_videos: true,              // 检测视频
      check_stickers: true,            // 检测贴纸
      check_documents: false,          // 检测文档
      warning_message: '检测到违规内容，消息已被删除。',
      whitelist_users: [],             // 白名单用户
      notify_admins: true,             // 通知管理员
      log_only: false,                 // 仅记录不删除
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      data: data || defaultConfig
    });
  } catch (error: any) {
    console.error('Get porn detection config error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 更新色情内容检测配置
async function updatePornDetectionConfig(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, ...config } = req.body;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    // 检查是否已存在配置
    const { data: existing } = await supabase
      .from('porn_detection_configs')
      .select('id')
      .eq('group_id', group_id)
      .single();

    let result;
    if (existing) {
      // 更新
      result = await supabase
        .from('porn_detection_configs')
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
        .from('porn_detection_configs')
        .insert({
          group_id,
          ...config,
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
    console.error('Update porn detection config error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// 延迟创建 Supabase 客户端
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !supabaseKey) {
      return null;
    }
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

// 示例数据
const DEMO_CHANNEL_FORWARDS = [
  {
    id: 'demo-channel-1',
    group_id: 'demo-1',
    channel_id: -1001234567890,
    channel_name: '技术资讯日报',
    channel_username: 'tech_daily',
    is_active: true,
    forward_mode: 'all',
    auto_pin: true,
    pin_duration_minutes: 120,
    include_author: true,
    include_source: true,
    custom_header: '📢 最新资讯',
    custom_footer: '💬 欢迎留言讨论',
    exclude_keywords: ['广告', '推广'],
    include_keywords: [],
    notify_on_forward: false,
    created_at: '2024-01-15T08:30:00Z',
    updated_at: '2024-02-12T10:20:00Z'
  },
  {
    id: 'demo-channel-2',
    group_id: 'demo-1',
    channel_id: -1009876543210,
    channel_name: 'Python学习笔记',
    channel_username: 'python_notes',
    is_active: true,
    forward_mode: 'text',
    auto_pin: false,
    pin_duration_minutes: 0,
    include_author: false,
    include_source: true,
    custom_header: '',
    custom_footer: '',
    exclude_keywords: [],
    include_keywords: ['Python', '教程'],
    notify_on_forward: true,
    created_at: '2024-01-20T14:00:00Z',
    updated_at: '2024-02-10T16:45:00Z'
  }
];

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
        return await getChannelForwards(req, res);
      case 'POST':
        return await createChannelForward(req, res);
      case 'PUT':
        return await updateChannelForward(req, res);
      case 'DELETE':
        return await deleteChannelForward(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Channel forward API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 获取频道转发列表
async function getChannelForwards(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id } = req.query;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    const db = getSupabase();
    if (!db) {
      // 返回示例数据
      const demoData = DEMO_CHANNEL_FORWARDS.filter(c => c.group_id === group_id);
      return res.status(200).json({
        success: true,
        data: demoData.length > 0 ? demoData : DEMO_CHANNEL_FORWARDS,
        demo: true,
        message: '当前显示示例数据（数据库未配置）'
      });
    }

    const { data, error } = await db
      .from('channel_forward_settings')
      .select('*')
      .eq('group_id', group_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: data || []
    });
  } catch (error: any) {
    console.error('Get channel forwards error:', error);
    return res.status(200).json({
      success: true,
      data: DEMO_CHANNEL_FORWARDS,
      demo: true,
      message: '当前显示示例数据（服务器错误）'
    });
  }
}

// 创建频道转发
async function createChannelForward(req: VercelRequest, res: VercelResponse) {
  try {
    const {
      group_id,
      channel_id,
      channel_name,
      channel_username,
      forward_mode = 'all',
      auto_pin = false,
      pin_duration_minutes = 60,
      include_author = true,
      include_source = true,
      custom_header = '',
      custom_footer = '',
      exclude_keywords = [],
      include_keywords = [],
      notify_on_forward = false,
      notify_template = ''
    } = req.body;

    if (!group_id || !channel_id) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数：group_id 和 channel_id'
      });
    }

    const db = getSupabase();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: '数据库未配置'
      });
    }

    // 检查是否已存在
    const { data: existing } = await db
      .from('channel_forward_settings')
      .select('id')
      .eq('group_id', group_id)
      .eq('channel_id', channel_id)
      .single();

    if (existing) {
      return res.status(409).json({
        success: false,
        error: '该频道已关联到此群组'
      });
    }

    const { data, error } = await db
      .from('channel_forward_settings')
      .insert({
        group_id,
        channel_id,
        channel_name,
        channel_username,
        forward_mode,
        auto_pin,
        pin_duration_minutes,
        include_author,
        include_source,
        custom_header,
        custom_footer,
        exclude_keywords,
        include_keywords,
        notify_on_forward,
        notify_template,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as any)
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      data,
      message: '频道关联创建成功'
    });
  } catch (error: any) {
    console.error('Create channel forward error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 更新频道转发设置
async function updateChannelForward(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少频道关联ID'
      });
    }

    const db = getSupabase();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: '数据库未配置'
      });
    }

    const { data, error } = await (db
      .from('channel_forward_settings')
      .update({
        ...updateData,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single() as any);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data,
      message: '设置已更新'
    });
  } catch (error: any) {
    console.error('Update channel forward error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 删除频道转发
async function deleteChannelForward(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少频道关联ID'
      });
    }

    const db = getSupabase();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: '数据库未配置'
      });
    }

    const { error } = await db
      .from('channel_forward_settings')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: '频道关联已删除'
    });
  } catch (error: any) {
    console.error('Delete channel forward error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

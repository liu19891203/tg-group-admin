// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// 延迟创建 Supabase 客户端
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;
    if (!supabaseUrl || !supabaseKey) {
      return null;
    }
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

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
        return await getGroups(req, res);
      case 'POST':
        return await createGroup(req, res);
      case 'PUT':
        return await updateGroup(req, res);
      case 'DELETE':
        return await deleteGroup(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Groups API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 示例群组数据（用于开发和测试）
const DEMO_GROUPS = [
  {
    id: 'demo-1',
    chat_id: '-1001234567890',
    title: 'Telegram 技术交流群',
    chat_type: 'supergroup',
    username: 'tech_chat_group',
    is_active: true,
    member_count: 1250,
    created_at: '2024-01-15T08:30:00Z',
    updated_at: '2024-02-12T10:20:00Z',
    settings: {
      welcome_message: true,
      anti_spam: true,
      auto_delete: false
    }
  },
  {
    id: 'demo-2',
    chat_id: '-1009876543210',
    title: 'Python 开发者社区',
    chat_type: 'supergroup',
    username: 'python_devs',
    is_active: true,
    member_count: 3420,
    created_at: '2024-01-20T14:15:00Z',
    updated_at: '2024-02-11T16:45:00Z',
    settings: {
      welcome_message: true,
      anti_spam: true,
      auto_delete: true
    }
  },
  {
    id: 'demo-3',
    chat_id: '-1001112223334',
    title: '前端学习小组',
    chat_type: 'group',
    username: null,
    is_active: true,
    member_count: 580,
    created_at: '2024-02-01T09:00:00Z',
    updated_at: '2024-02-12T08:30:00Z',
    settings: {
      welcome_message: false,
      anti_spam: true,
      auto_delete: false
    }
  },
  {
    id: 'demo-4',
    chat_id: '-1005556667778',
    title: '产品设计师交流群',
    chat_type: 'supergroup',
    username: 'design_hub',
    is_active: false,
    member_count: 890,
    created_at: '2024-02-05T11:20:00Z',
    updated_at: '2024-02-10T15:30:00Z',
    settings: {
      welcome_message: true,
      anti_spam: false,
      auto_delete: false
    }
  },
  {
    id: 'demo-5',
    chat_id: '-1009998887776',
    title: 'AI 人工智能讨论组',
    chat_type: 'supergroup',
    username: 'ai_discussion',
    is_active: true,
    member_count: 5680,
    created_at: '2024-01-10T07:45:00Z',
    updated_at: '2024-02-12T12:00:00Z',
    settings: {
      welcome_message: true,
      anti_spam: true,
      auto_delete: true
    }
  }
];

// 获取群组列表
async function getGroups(req: VercelRequest, res: VercelResponse) {
  try {
    const db = getSupabase();
    if (!db) {
      return res.status(200).json({
        success: true,
        data: DEMO_GROUPS,
        demo: true,
        message: '当前显示示例数据（数据库未配置）'
      });
    }
    
    const { data: groups, error } = await db
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.log('Database error, returning demo groups:', error.message);
      // 数据库错误时返回示例数据
      return res.status(200).json({
        success: true,
        data: DEMO_GROUPS,
        demo: true,
        message: '当前显示示例数据（数据库连接失败）'
      });
    }

    // 如果没有数据，返回示例数据
    if (!groups || groups.length === 0) {
      return res.status(200).json({
        success: true,
        data: DEMO_GROUPS,
        demo: true,
        message: '当前显示示例数据'
      });
    }

    return res.status(200).json({
      success: true,
      data: groups
    });
  } catch (error: any) {
    console.error('Get groups error:', error);
    // 发生错误时返回示例数据，而不是报错
    return res.status(200).json({
      success: true,
      data: DEMO_GROUPS,
      demo: true,
      message: '当前显示示例数据（服务器错误）'
    });
  }
}

// 创建群组
async function createGroup(req: VercelRequest, res: VercelResponse) {
  try {
    const db = getSupabase();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: '数据库未配置'
      });
    }
    
    const { chat_id, title, chat_type, username } = req.body;

    if (!chat_id || !title) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    const { data, error } = await db
      .from('groups')
      .insert({
        chat_id,
        title,
        chat_type: chat_type || 'group',
        username,
        is_active: true
      } as any)
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Create group error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 更新群组
async function updateGroup(req: VercelRequest, res: VercelResponse) {
  try {
    const db = getSupabase();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: '数据库未配置'
      });
    }
    
    const { id } = req.query;
    const { title, is_active, settings } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (title !== undefined) updateData.title = title;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (settings !== undefined) updateData.settings = settings;

    const { data, error } = await (db
      .from('groups')
      .update(updateData)
      .eq('id', id)
      .select()
      .single() as any);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Update group error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 删除群组
async function deleteGroup(req: VercelRequest, res: VercelResponse) {
  try {
    const db = getSupabase();
    if (!db) {
      return res.status(503).json({
        success: false,
        error: '数据库未配置'
      });
    }
    
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    const { error } = await db
      .from('groups')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: '群组已删除'
    });
  } catch (error: any) {
    console.error('Delete group error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

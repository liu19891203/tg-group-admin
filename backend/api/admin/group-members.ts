import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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
        return await getGroupMembers(req, res);
      case 'POST':
        return await addGroupMember(req, res);
      case 'PUT':
        return await updateGroupMember(req, res);
      case 'DELETE':
        return await removeGroupMember(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Group members API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 获取群组成员列表
async function getGroupMembers(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, search, role, page = '1', limit = '20' } = req.query;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    let query = supabase
      .from('group_members')
      .select('*', { count: 'exact' })
      .eq('group_id', group_id);

    if (search) {
      query = query.or(`username.ilike.%${search}%,nickname.ilike.%${search}%`);
    }

    if (role) {
      query = query.eq('role', role);
    }

    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
    
    const { data, error, count } = await query
      .order('joined_at', { ascending: false })
      .range(offset, offset + parseInt(limit as string) - 1);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: data || [],
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: count || 0
      }
    });
  } catch (error: any) {
    console.error('Get group members error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 添加成员
async function addGroupMember(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, telegram_user_id, username, nickname, role = 'member' } = req.body;

    if (!group_id || !telegram_user_id) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    const { data, error } = await supabase
      .from('group_members')
      .insert({
        group_id,
        telegram_user_id,
        username,
        nickname,
        role,
        joined_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Add group member error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 更新成员信息
async function updateGroupMember(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少成员ID'
      });
    }

    const { data, error } = await supabase
      .from('group_members')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Update group member error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 移除成员
async function removeGroupMember(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少成员ID'
      });
    }

    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: '成员已移除'
    });
  } catch (error: any) {
    console.error('Remove group member error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

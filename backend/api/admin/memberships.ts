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
        return await getMemberships(req, res);
      case 'POST':
        return await createMembership(req, res);
      case 'PUT':
        return await updateMembership(req, res);
      case 'DELETE':
        return await deleteMembership(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Memberships API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 获取成员列表
async function getMemberships(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, page = '1', pageSize = '20', search } = req.query;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    const pageNum = parseInt(page as string);
    const size = parseInt(pageSize as string);
    const offset = (pageNum - 1) * size;

    // 构建查询条件
    let query = supabase
      .from('users')
      .select(`
        id,
        telegram_id,
        username,
        display_name,
        first_name,
        last_name,
        is_verified,
        created_at,
        user_points!inner(points, total_points, checkin_streak, last_activity_at)
      `)
      .eq('user_points.group_id', group_id)
      .order('user_points.points', { ascending: false })
      .range(offset, offset + size - 1);

    // 添加搜索条件
    if (search) {
      query = query.or(`username.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);
    }

    const { data: members, error, count } = await query;

    if (error) throw error;

    // 格式化返回数据
    const formattedMembers = members.map(member => ({
      id: member.id,
      telegram_id: member.telegram_id,
      username: member.username,
      display_name: member.display_name || `${member.first_name} ${member.last_name || ''}`.trim(),
      first_name: member.first_name,
      last_name: member.last_name,
      is_verified: member.is_verified,
      points: member.user_points[0]?.points || 0,
      total_points: member.user_points[0]?.total_points || 0,
      checkin_streak: member.user_points[0]?.checkin_streak || 0,
      last_activity_at: member.user_points[0]?.last_activity_at,
      created_at: member.created_at
    }));

    return res.status(200).json({
      success: true,
      data: {
        members: formattedMembers,
        total: count || 0,
        page: pageNum,
        pageSize: size
      }
    });

  } catch (error: any) {
    console.error('Get memberships error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 创建成员关系（加入群组）
async function createMembership(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, telegram_user_id, role = 'member' } = req.body;

    if (!group_id || !telegram_user_id) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    // 检查用户是否存在
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', telegram_user_id)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }

    // 检查是否已存在
    const { data: existing } = await supabase
      .from('user_points')
      .select('id')
      .eq('user_id', user.id)
      .eq('group_id', group_id)
      .single();

    if (existing) {
      return res.status(409).json({
        success: false,
        error: '用户已在群组中'
      });
    }

    // 创建成员关系
    const { data: membership, error: insertError } = await supabase
      .from('user_points')
      .insert({
        user_id: user.id,
        group_id,
        points: 0,
        total_points: 0,
        checkin_count: 0,
        checkin_streak: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(201).json({
      success: true,
      data: membership
    });

  } catch (error: any) {
    console.error('Create membership error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 更新成员信息
async function updateMembership(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query;
    const { points, total_points, checkin_streak, role } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少成员ID'
      });
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (points !== undefined) updateData.points = points;
    if (total_points !== undefined) updateData.total_points = total_points;
    if (checkin_streak !== undefined) updateData.checkin_streak = checkin_streak;

    const { data: membership, error } = await supabase
      .from('user_points')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: membership
    });

  } catch (error: any) {
    console.error('Update membership error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 删除成员关系（移出群组）
async function deleteMembership(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少成员ID'
      });
    }

    const { error } = await supabase
      .from('user_points')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: { message: '成员已移除' }
    });

  } catch (error: any) {
    console.error('Delete membership error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
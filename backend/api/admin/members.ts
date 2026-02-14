import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/database';
import { pointsService } from '../../services/pointsService';

export async function handleMembers(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return await getMembers(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Members API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMembers(req: VercelRequest, res: VercelResponse) {
  const { 
    page = 1, 
    limit = 20, 
    group_id, 
    search,
    order_by = 'points',
    order = 'desc'
  } = req.query;

  let query = supabaseAdmin
    .from('user_points')
    .select(`
      *,
      users!inner (
        id,
        telegram_id,
        username,
        display_name,
        avatar_url,
        is_verified,
        created_at
      )
    `);

  if (group_id) {
    query = query.eq('group_id', group_id);
  }

  if (search) {
    query = query.ilike('users.username', `%${search}%`);
  }

  const from = (Number(page) - 1) * Number(limit);
  const to = from + Number(limit) - 1;

  const orderColumn = order_by === 'checkin_streak' ? 'checkin_streak' : 'points';
  const orderAscending = order === 'asc';

  const { data, error, count } = await query
    .order(orderColumn, { ascending: orderAscending })
    .range(from, to);

  const totalCount = (data as any[])?.length || 0;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const members = (data as any[])?.map((mp: any, index: number) => ({
    id: mp.users.id,
    telegram_id: mp.users.telegram_id,
    username: mp.users.username,
    display_name: mp.users.display_name,
    avatar_url: mp.users.avatar_url,
    is_verified: mp.users.is_verified,
    points: mp.points,
    total_points: mp.total_points,
    checkin_streak: mp.checkin_streak,
    checkin_count: mp.checkin_count,
    last_activity_at: mp.last_activity_at,
    rank: from + index + 1,
    joined_at: mp.users.created_at
  })) || [];

  return res.status(200).json({
    data: members,
    total: count || 0,
    page: Number(page),
    limit: Number(limit),
    total_pages: Math.ceil((count || 0) / Number(limit))
  });
}

export async function handleMemberById(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return await getMember(id as string, req, res);
      case 'POST':
        return await adjustPoints(id as string, req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Member API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMember(id: string, req: VercelRequest, res: VercelResponse) {
  const { group_id } = req.query;

  let query = supabaseAdmin
    .from('users')
    .select(`
      *,
      user_points!inner (
        *,
        groups!inner (
          id,
          title,
          chat_id
        )
      )
    `)
    .eq('users.id', id);

  if (group_id) {
    query = query.eq('user_points.group_id', group_id);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return res.status(404).json({ error: 'Member not found' });
  }

  return res.status(200).json({ data });
}

async function adjustPoints(id: string, req: VercelRequest, res: VercelResponse) {
  const { group_id, change_amount, reason, admin_id } = req.body;

  if (!group_id || change_amount === undefined) {
    return res.status(400).json({ error: 'group_id and change_amount are required' });
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('telegram_id')
    .eq('id', id)
    .single();

  if (!user || !(user as any).telegram_id) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    const result = await pointsService.adjustPoints(
      (user as any).telegram_id,
      group_id,
      Number(change_amount),
      admin_id,
      reason
    );

    return res.status(200).json({ 
      success: result.success,
      before_points: result.beforePoints,
      after_points: result.afterPoints
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to adjust points' });
  }
}

export async function handlePointsLogs(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  try {
    if (method === 'GET') {
      return await getPointsLogs(req, res);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Points logs API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getPointsLogs(req: VercelRequest, res: VercelResponse) {
  const { 
    page = 1, 
    limit = 50, 
    user_id,
    group_id,
    change_type,
    start_date,
    end_date 
  } = req.query;

  let query = supabaseAdmin
    .from('points_logs')
    .select(`
      *,
      users!inner (
        telegram_id,
        username,
        display_name
      )
    `);

  if (user_id) {
    query = query.eq('user_id', user_id);
  }

  if (group_id) {
    query = query.eq('group_id', group_id);
  }

  if (change_type) {
    query = query.eq('change_type', change_type);
  }

  if (start_date) {
    query = query.gte('created_at', start_date);
  }

  if (end_date) {
    query = query.lte('created_at', end_date);
  }

  const from = (Number(page) - 1) * Number(limit);
  const to = from + Number(limit) - 1;

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({
    data: (data as any[]) || [],
    total: (data as any[])?.length || 0,
    page: Number(page),
    limit: Number(limit)
  });
}

export async function handleLeaderboard(req: VercelRequest, res: VercelResponse) {
  const { group_id, type = 'total', limit = 10 } = req.query;

  if (!group_id) {
    return res.status(400).json({ error: 'group_id is required' });
  }

  try {
    const leaderboard = await pointsService.getLeaderboard(
      group_id as string,
      type as 'daily' | 'monthly' | 'total',
      Number(limit)
    );

    return res.status(200).json({ data: leaderboard });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to get leaderboard' });
  }
}

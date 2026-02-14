import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/database';

export async function handleDashboard(req: VercelRequest, res: VercelResponse) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [totalGroups, activeGroups, totalUsers, todayMessages, monthMessages] = await Promise.all([
      supabaseAdmin.from('groups').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
      supabaseAdmin.from('groups').select('id', { count: 'exact', head: true }).eq('is_active', true).then(r => r.count || 0),
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).then(r => r.count || 0),
      supabaseAdmin.from('points_logs').select('id', { count: 'exact', head: true })
        .eq('change_type', 'message')
        .gte('created_at', `${today}T00:00:00`)
        .then(r => r.count || 0),
      supabaseAdmin.from('points_logs').select('id', { count: 'exact', head: true })
        .eq('change_type', 'message')
        .gte('created_at', monthStart)
        .then(r => r.count || 0)
    ]);

    const { data: topGroups } = await supabaseAdmin
      .from('groups')
      .select('id, title, member_count')
      .eq('is_active', true)
      .order('member_count', { ascending: false })
      .limit(5);

    const { data: recentActivity } = await supabaseAdmin
      .from('operation_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    const { data: activeUsersToday } = await supabaseAdmin
      .from('points_logs')
      .select('user_id')
      .eq('change_type', 'message')
      .gte('created_at', `${today}T00:00:00`);

    const uniqueUsers = new Set(((activeUsersToday as any[]) || []).map((p: any) => p.user_id)).size;

    return res.status(200).json({
      data: {
        total_groups: totalGroups,
        active_groups: activeGroups,
        total_users: totalUsers,
        messages_today: todayMessages,
        messages_this_month: monthMessages,
        active_users_today: uniqueUsers,
        top_groups: (topGroups as any[]) || [],
        recent_activity: (recentActivity as any[]) || []
      }
    });

  } catch (error) {
    console.error('Dashboard API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function handleStats(req: VercelRequest, res: VercelResponse) {
  const { type, group_id, start_date, end_date, granularity = 'day' } = req.query;

  try {
    switch (type) {
      case 'messages':
        return await getMessageStats(req, res);
      case 'points':
        return await getPointsStats(req, res);
      case 'activity':
        return await getActivityStats(req, res);
      default:
        return res.status(400).json({ error: 'Invalid stats type' });
    }
  } catch (error) {
    console.error('Stats API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getMessageStats(req: VercelRequest, res: VercelResponse) {
  const { group_id, start_date, end_date, granularity } = req.query;

  let query = supabaseAdmin
    .from('points_logs')
    .select('created_at, user_id', { count: 'exact' })
    .eq('change_type', 'message');

  if (group_id) {
    query = query.eq('group_id', group_id);
  }

  if (start_date) {
    query = query.gte('created_at', start_date);
  }

  if (end_date) {
    query = query.lte('created_at', end_date);
  }

  const { data, error } = await query.order('created_at', { ascending: true });

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const stats: Record<string, { count: number; users: Set<number> }> = {};

  for (const entry of (data as any[]) || []) {
    const date = (entry as any).created_at.split('T')[0];
    if (!stats[date]) {
      stats[date] = { count: 0, users: new Set() };
    }
    stats[date].count++;
    if ((entry as any).user_id) {
      stats[date].users.add((entry as any).user_id);
    }
  }

  const result = Object.entries(stats).map(([date, data]) => ({
    date,
    message_count: data.count,
    active_users: data.users.size
  }));

  return res.status(200).json({ data: result });
}

async function getPointsStats(req: VercelRequest, res: VercelResponse) {
  const { group_id } = req.query;

  let query = supabaseAdmin
    .from('user_points')
    .select('points, total_points, checkin_count, checkin_streak');

  if (group_id) {
    query = query.eq('group_id', group_id);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const dataAny = (data as any[]) || [];
  const totalPoints = dataAny.reduce((sum, p) => sum + ((p as any).total_points || 0), 0);
  const avgPoints = dataAny.length ? Math.round(totalPoints / dataAny.length) : 0;
  const totalCheckins = dataAny.reduce((sum, p) => sum + ((p as any).checkin_count || 0), 0);
  const avgCheckinStreak = dataAny.length 
    ? Math.round((dataAny.reduce((sum, p) => sum + ((p as any).checkin_streak || 0), 0) / dataAny.length) * 10) / 10 
    : 0;

  const pointsDistribution = [
    { range: '0-100', count: dataAny.filter(p => (p as any).points <= 100).length },
    { range: '101-500', count: dataAny.filter(p => (p as any).points > 100 && (p as any).points <= 500).length },
    { range: '501-1000', count: dataAny.filter(p => (p as any).points > 500 && (p as any).points <= 1000).length },
    { range: '1000+', count: dataAny.filter(p => (p as any).points > 1000).length }
  ];

  return res.status(200).json({
    data: {
      total_users: dataAny.length || 0,
      total_points: totalPoints,
      average_points: avgPoints,
      total_checkins: totalCheckins,
      average_checkin_streak: avgCheckinStreak,
      points_distribution: pointsDistribution
    }
  });
}

async function getActivityStats(req: VercelRequest, res: VercelResponse) {
  const { group_id, days = 7 } = req.query;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - Number(days));

  let query = supabaseAdmin
    .from('points_logs')
    .select('created_at, change_type, count')
    .gte('created_at', startDate.toISOString());

  if (group_id) {
    query = query.eq('group_id', group_id);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  const dailyStats: Record<string, Record<string, number>> = {};

  for (const entry of (data as any[]) || []) {
    const date = (entry as any).created_at.split('T')[0];
    const type = (entry as any).change_type;

    if (!dailyStats[date]) {
      dailyStats[date] = {};
    }
    dailyStats[date][type] = (dailyStats[date][type] || 0) + 1;
  }

  const result = Object.entries(dailyStats)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, types]) => ({
      date,
      ...types
    }));

  return res.status(200).json({ data: result });
}

export async function handleExportStats(req: VercelRequest, res: VercelResponse) {
  const { type, group_id, start_date, end_date, format = 'json' } = req.query;

  try {
    let data: unknown[];
    let filename: string;

    switch (type) {
      case 'members':
        const { data: members } = await supabaseAdmin
          .from('user_points')
          .select(`
            *,
            users!inner (telegram_id, username, display_name, created_at)
          `)
          .eq('group_id', group_id)
          .order('points', { ascending: false });

        data = members || [];
        filename = 'members_export';
        break;

      case 'points':
        const { data: pointsLogs } = await supabaseAdmin
          .from('points_logs')
          .select('*')
          .gte('created_at', start_date as string)
          .lte('created_at', end_date as string);

        data = pointsLogs || [];
        filename = 'points_export';
        break;

      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }

    if (format === 'csv') {
      const headers = Object.keys(data[0] || {});
      const csv = [
        headers.join(','),
        ...data.map(row => headers.map(h => JSON.stringify((row as Record<string, unknown>)[h] || '')).join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.status(200).send(csv);
    }

    return res.status(200).json({ data });

  } catch (error) {
    console.error('Export stats error:', error);
    return res.status(500).json({ error: 'Failed to export stats' });
  }
}

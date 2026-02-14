import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/database';
import { verifyAdmin } from '../../middleware/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const admin = await verifyAdmin(req);
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { method } = req;

  switch (method) {
    case 'GET':
      return getAccountChangeHistory(req, res);
    default:
      return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
}

async function getAccountChangeHistory(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, user_id, limit = '50', offset = '0' } = req.query;

    let query = supabase
      .from('account_change_history')
      .select(`
        *,
        user:users(telegram_id, first_name, last_name, username),
        group:groups(title, chat_id)
      `)
      .order('changed_at', { ascending: false })
      .limit(parseInt(limit as string))
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    if (group_id) {
      query = query.eq('group_id', group_id);
    }

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching account change history:', error);
      return res.status(500).json({ success: false, error: 'Failed to fetch history' });
    }

    const formattedData = (data as any[])?.map(item => ({
      id: item.id,
      user_id: item.user_id,
      group_id: item.group_id,
      change_type: item.change_type,
      old_nickname: item.old_nickname,
      new_nickname: item.new_nickname,
      old_username: item.old_username,
      new_username: item.new_username,
      changed_at: item.changed_at,
      detected_at: item.detected_at,
      user: item.user ? {
        telegram_id: item.user.telegram_id,
        first_name: item.user.first_name,
        last_name: item.user.last_name,
        username: item.user.username
      } : null,
      group: item.group ? {
        title: item.group.title,
        chat_id: item.group.chat_id
      } : null
    })) || [];

    return res.status(200).json({
      success: true,
      data: formattedData,
      pagination: {
        total: count || 0,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      }
    });

  } catch (error) {
    console.error('Error in getAccountChangeHistory:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

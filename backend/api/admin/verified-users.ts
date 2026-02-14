// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/database';
import { verifyAdmin } from '../../middleware/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const auth = await verifyAdmin(req);
  if (!auth) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getVerifiedUsers(req, res);
      case 'POST':
        return await addVerifiedUser(req, res, auth);
      case 'PUT':
        return await updateVerifiedUser(req, res);
      case 'DELETE':
        return await deleteVerifiedUser(req, res);
      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Verified users API error:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// 获取认证用户列表
async function getVerifiedUsers(req: VercelRequest, res: VercelResponse) {
  const { group_id, page = '1', limit = '20', search } = req.query;

  if (!group_id) {
    return res.status(400).json({ success: false, error: '群组ID不能为空' });
  }

  const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

  let query = supabase
    .from('verified_users')
    .select(`
      *,
      user:users(telegram_id, username, first_name, last_name, avatar_url)
    `, { count: 'exact' })
    .eq('group_id', group_id)
    .order('verified_at', { ascending: false });

  if (search) {
    query = query.or(`user.telegram_id.ilike.%${search}%,user.username.ilike.%${search}%`);
  }

  const { data, error } = await query
    .range(offset, offset + parseInt(limit as string) - 1);

  if (error) {
    console.error('Error fetching verified users:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }

  const formattedData = (data as any[])?.map((item: any) => ({
    id: item.id,
    telegram_id: item.user?.telegram_id,
    username: item.user?.username || `${item.user?.first_name} ${item.user?.last_name || ''}`.trim(),
    avatar_url: item.user?.avatar_url,
    verified_level: item.verified_level,
    verified_at: item.verified_at,
    expires_at: item.expires_at,
    notes: item.notes
  })) || [];

  return res.status(200).json({
    success: true,
    data: formattedData,
    pagination: {
      total: (data as any[])?.length || 0,
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    }
  });
}

// 添加认证用户
async function addVerifiedUser(req: VercelRequest, res: VercelResponse, auth: any) {
  const { group_id, telegram_id, username, verified_level = 1, expires_at, notes } = req.body;

  if (!group_id || !telegram_id) {
    return res.status(400).json({ success: false, error: '群组ID和用户ID不能为空' });
  }

  // 先获取用户ID
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('telegram_id', telegram_id)
    .single();

  if (userError || !userData) {
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert({
        telegram_id: telegram_id,
        username: username,
        first_name: username || 'User',
        created_at: new Date().toISOString()
      } as any)
      .select('id')
      .single();

    if (createError || !newUser) {
      return res.status(500).json({ success: false, error: 'Failed to create user' });
    }

    (userData as any) = { id: (newUser as any).id };
  }

  if (!userData) {
    return res.status(500).json({ success: false, error: 'Failed to get user data' });
  }

  const { data: existing } = await supabase
    .from('verified_users')
    .select('id')
    .eq('group_id', group_id)
    .eq('user_id', (userData as any).id)
    .single();

  if (existing) {
    return res.status(400).json({ success: false, error: '该用户已是认证用户' });
  }

  // 添加认证记录
  const { data, error } = await supabase
    .from('verified_users')
    .insert({
      group_id,
      user_id: (userData as any).id,
      verified_level,
      verified_by: (auth as any).id,
      verified_at: new Date().toISOString(),
      expires_at: expires_at || null,
      notes
    } as any)
    .select()
    .single();

  if (error) {
    console.error('Error adding verified user:', error);
    return res.status(500).json({ success: false, error: 'Failed to add verified user' });
  }

  return res.status(200).json({
    success: true,
    message: '认证用户添加成功',
    data
  });
}

// 更新认证用户
async function updateVerifiedUser(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const { verified_level, expires_at, notes } = req.body;

  if (!id) {
    return res.status(400).json({ success: false, error: '用户ID不能为空' });
  }

  const updateData: any = {
    updated_at: new Date().toISOString()
  };

  if (verified_level !== undefined) updateData.verified_level = verified_level;
  if (expires_at !== undefined) updateData.expires_at = expires_at || null;
  if (notes !== undefined) updateData.notes = notes;

  const { data, error } = await supabase
    .from('verified_users')
    .update(updateData as any)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating verified user:', error);
    return res.status(500).json({ success: false, error: 'Failed to update verified user' });
  }

  return res.status(200).json({
    success: true,
    message: '认证用户更新成功',
    data
  });
}

// 删除认证用户
async function deleteVerifiedUser(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ success: false, error: '用户ID不能为空' });
  }

  const { error } = await supabase
    .from('verified_users')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting verified user:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete verified user' });
  }

  return res.status(200).json({
    success: true,
    message: '认证用户已移除'
  });
}

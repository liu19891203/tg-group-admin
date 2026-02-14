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
const DEMO_INVITE_LINKS = [
  {
    id: 'demo-link-1',
    group_id: 'demo-1',
    user_id: 'user-1',
    invite_code: 'ABC123',
    invite_link: 'https://t.me/+ABC123XYZ',
    total_invites: 15,
    valid_invites: 12,
    pending_invites: 3,
    total_rewards: 1200,
    is_active: true,
    created_at: '2024-01-15T08:30:00Z',
    updated_at: '2024-02-12T10:20:00Z',
    user: {
      telegram_id: 123456789,
      username: 'user1',
      first_name: '张三'
    }
  },
  {
    id: 'demo-link-2',
    group_id: 'demo-1',
    user_id: 'user-2',
    invite_code: 'DEF456',
    invite_link: 'https://t.me/+DEF456UVW',
    total_invites: 8,
    valid_invites: 7,
    pending_invites: 1,
    total_rewards: 700,
    is_active: true,
    created_at: '2024-01-20T14:00:00Z',
    updated_at: '2024-02-10T16:45:00Z',
    user: {
      telegram_id: 987654321,
      username: 'user2',
      first_name: '李四'
    }
  }
];

const DEMO_LEADERBOARD = [
  { rank: 1, user_id: 'user-1', username: 'user1', first_name: '张三', valid_invites: 12, total_rewards: 1200 },
  { rank: 2, user_id: 'user-2', username: 'user2', first_name: '李四', valid_invites: 7, total_rewards: 700 },
  { rank: 3, user_id: 'user-3', username: 'user3', first_name: '王五', valid_invites: 5, total_rewards: 500 }
];

const DEMO_CONFIG = {
  is_enabled: true,
  update_frequency: 'realtime',
  show_top_count: 10,
  show_self_rank: true,
  ranking_period: 'monthly',
  message_template: '🏆 <b>邀请排行榜</b>\n\n{{leaderboard}}\n\n💡 使用 /invite 获取你的专属邀请链接',
  header_text: '🎉 本月邀请达人',
  footer_text: '🚀 邀请更多好友，赢取丰厚奖励！',
  rank_1_badge: '🥇',
  rank_2_badge: '🥈',
  rank_3_badge: '🥉',
  rank_other_badge: '🏅',
  auto_publish: false,
  publish_cron: '0 9 * * *'
};

const DEMO_VERIFICATION_RULES = [
  {
    id: 'rule-1',
    name: '停留时间验证',
    description: '被邀请人需要在群组停留至少1小时',
    is_active: true,
    priority: 1,
    verification_type: 'stay_time',
    verification_params: { minutes: 60 },
    verification_window_hours: 24,
    reward_points: 100,
    invited_reward_points: 50
  },
  {
    id: 'rule-2',
    name: '发言数量验证',
    description: '被邀请人需要发送至少3条消息',
    is_active: true,
    priority: 2,
    verification_type: 'message_count',
    verification_params: { count: 3 },
    verification_window_hours: 48,
    reward_points: 50,
    invited_reward_points: 20
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
    const { action } = req.query;

    switch (action) {
      case 'links':
        return await getInviteLinks(req, res);
      case 'leaderboard':
        return await getLeaderboard(req, res);
      case 'config':
        return await handleConfig(req, res);
      case 'rules':
        return await handleRules(req, res);
      case 'records':
        return await getInviteRecords(req, res);
      case 'stats':
        return await getInviteStats(req, res);
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
  } catch (error: any) {
    console.error('Invite stats API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 获取邀请链接列表
async function getInviteLinks(req: VercelRequest, res: VercelResponse) {
  const { group_id } = req.query;

  if (!group_id) {
    return res.status(400).json({ error: '缺少群组ID' });
  }

  const db = getSupabase();
  if (!db) {
    return res.status(200).json({
      success: true,
      data: DEMO_INVITE_LINKS,
      demo: true
    });
  }

  try {
    const { data, error } = await db
      .from('user_invite_links')
      .select(`
        *,
        user:users(telegram_id, username, first_name)
      `)
      .eq('group_id', group_id)
      .order('valid_invites', { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: data || []
    });
  } catch (error: any) {
    console.error('Get invite links error:', error);
    return res.status(200).json({
      success: true,
      data: DEMO_INVITE_LINKS,
      demo: true
    });
  }
}

// 获取排行榜
async function getLeaderboard(req: VercelRequest, res: VercelResponse) {
  const { group_id, period = 'monthly' } = req.query;

  if (!group_id) {
    return res.status(400).json({ error: '缺少群组ID' });
  }

  const db = getSupabase();
  if (!db) {
    return res.status(200).json({
      success: true,
      data: DEMO_LEADERBOARD,
      demo: true
    });
  }

  try {
    // 获取排行榜配置
    const { data: config } = await db
      .from('invite_leaderboard_config')
      .select('*')
      .eq('group_id', group_id)
      .single();

    const showTopCount = (config as any)?.show_top_count || 10;

    // 获取排行榜数据
    const { data, error } = await db
      .from('user_invite_links')
      .select(`
        *,
        user:users(telegram_id, username, first_name, avatar_url)
      `)
      .eq('group_id', group_id)
      .order('valid_invites', { ascending: false })
      .limit(showTopCount);

    if (error) throw error;

    // 添加排名
    const leaderboard = (data || []).map((item: any, index: number) => ({
      rank: index + 1,
      user_id: item.user_id,
      username: item.user?.username,
      first_name: item.user?.first_name,
      avatar_url: item.user?.avatar_url,
      valid_invites: item.valid_invites,
      total_rewards: item.total_rewards
    }));

    return res.status(200).json({
      success: true,
      data: leaderboard,
      config: config || DEMO_CONFIG
    });
  } catch (error: any) {
    console.error('Get leaderboard error:', error);
    return res.status(200).json({
      success: true,
      data: DEMO_LEADERBOARD,
      demo: true
    });
  }
}

// 处理配置
async function handleConfig(req: VercelRequest, res: VercelResponse) {
  const { group_id } = req.query;

  if (!group_id) {
    return res.status(400).json({ error: '缺少群组ID' });
  }

  const db = getSupabase();

  if (req.method === 'GET') {
    if (!db) {
      return res.status(200).json({
        success: true,
        data: DEMO_CONFIG,
        demo: true
      });
    }

    try {
      const { data, error } = await db
        .from('invite_leaderboard_config')
        .select('*')
        .eq('group_id', group_id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return res.status(200).json({
        success: true,
        data: data || DEMO_CONFIG
      });
    } catch (error: any) {
      return res.status(200).json({
        success: true,
        data: DEMO_CONFIG,
        demo: true
      });
    }
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const config = req.body;

    if (!db) {
      return res.status(200).json({
        success: true,
        message: '配置已保存（演示模式）',
        demo: true
      });
    }

    try {
      const { data, error } = await db
        .from('invite_leaderboard_config')
        .upsert({
          group_id,
          ...config,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        message: '配置已保存',
        data
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// 处理验证规则
async function handleRules(req: VercelRequest, res: VercelResponse) {
  const { group_id } = req.query;

  if (!group_id) {
    return res.status(400).json({ error: '缺少群组ID' });
  }

  const db = getSupabase();

  if (req.method === 'GET') {
    if (!db) {
      return res.status(200).json({
        success: true,
        data: DEMO_VERIFICATION_RULES,
        demo: true
      });
    }

    try {
      const { data, error } = await db
        .from('invite_verification_rules')
        .select('*')
        .eq('group_id', group_id)
        .eq('is_active', true)
        .order('priority', { ascending: true });

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data: data || []
      });
    } catch (error: any) {
      return res.status(200).json({
        success: true,
        data: DEMO_VERIFICATION_RULES,
        demo: true
      });
    }
  }

  if (req.method === 'POST') {
    const rule = req.body;

    if (!db) {
      return res.status(200).json({
        success: true,
        message: '规则已创建（演示模式）',
        demo: true
      });
    }

    try {
      const { data, error } = await db
        .from('invite_verification_rules')
        .insert({
          group_id,
          ...rule,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        message: '规则已创建',
        data
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  if (req.method === 'PUT') {
    const { id, ...rule } = req.body;

    if (!db) {
      return res.status(200).json({
        success: true,
        message: '规则已更新（演示模式）',
        demo: true
      });
    }

    try {
      const { data, error } = await (db
        .from('invite_verification_rules')
        .update({
          ...rule,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single() as any);

      if (error) throw error;

      return res.status(200).json({
        success: true,
        message: '规则已更新',
        data
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!db) {
      return res.status(200).json({
        success: true,
        message: '规则已删除（演示模式）',
        demo: true
      });
    }

    try {
      const { error } = await db
        .from('invite_verification_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return res.status(200).json({
        success: true,
        message: '规则已删除'
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// 获取邀请记录
async function getInviteRecords(req: VercelRequest, res: VercelResponse) {
  const { group_id, user_id, status } = req.query;

  if (!group_id) {
    return res.status(400).json({ error: '缺少群组ID' });
  }

  const db = getSupabase();
  if (!db) {
    return res.status(200).json({
      success: true,
      data: [],
      demo: true
    });
  }

  try {
    let query = db
      .from('invite_records')
      .select(`
        *,
        inviter:users!inviter_id(telegram_id, username, first_name),
        invited:users!invited_id(telegram_id, username, first_name)
      `)
      .eq('group_id', group_id);

    if (user_id) {
      query = query.eq('inviter_id', user_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query
      .order('invited_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: data || []
    });
  } catch (error: any) {
    console.error('Get invite records error:', error);
    return res.status(200).json({
      success: true,
      data: [],
      demo: true
    });
  }
}

// 获取邀请统计
async function getInviteStats(req: VercelRequest, res: VercelResponse) {
  const { group_id } = req.query;

  if (!group_id) {
    return res.status(400).json({ error: '缺少群组ID' });
  }

  const db = getSupabase();
  if (!db) {
    return res.status(200).json({
      success: true,
      data: {
        total_inviters: 25,
        total_invites: 156,
        valid_invites: 128,
        pending_invites: 28,
        total_rewards: 12800
      },
      demo: true
    });
  }

  try {
    // 获取统计数据
    const { data: links, error } = await db
      .from('user_invite_links')
      .select('total_invites, valid_invites, pending_invites, total_rewards')
      .eq('group_id', group_id);

    if (error) throw error;

    const stats = {
      total_inviters: links?.length || 0,
      total_invites: links?.reduce((sum: number, item: any) => sum + (item.total_invites || 0), 0) || 0,
      valid_invites: links?.reduce((sum: number, item: any) => sum + (item.valid_invites || 0), 0) || 0,
      pending_invites: links?.reduce((sum: number, item: any) => sum + (item.pending_invites || 0), 0) || 0,
      total_rewards: links?.reduce((sum: number, item: any) => sum + (item.total_rewards || 0), 0) || 0
    };

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error: any) {
    console.error('Get invite stats error:', error);
    return res.status(200).json({
      success: true,
      data: {
        total_inviters: 25,
        total_invites: 156,
        valid_invites: 128,
        pending_invites: 28,
        total_rewards: 12800
      },
      demo: true
    });
  }
}

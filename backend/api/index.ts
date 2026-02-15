import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { pointsService } from '../services/pointsService';

interface TelegramApiResponse<T = any> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

let supabaseInstance: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (supabaseInstance) return supabaseInstance;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  supabaseInstance = createClient(url, key);
  return supabaseInstance;
}

const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    return getSupabase()[prop as keyof SupabaseClient];
  }
});

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function callTelegramApi(method: string, params: Record<string, any>): Promise<{ ok: boolean; result?: any }> {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  const data = await response.json();
  return data as { ok: boolean; result?: any };
}

async function sendMessage(chatId: number, text: string): Promise<{ ok: boolean }> {
  return callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  }) as Promise<{ ok: boolean }>;
}

type Handler = (req: VercelRequest, res: VercelResponse, params: Record<string, string>) => Promise<void | VercelResponse>;

const handlers: Record<string, Handler> = {
  'GET /health': async (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  },

  'GET /admin/groups': async (req, res) => {
    // 获取群组列表
    const { data: groups, error, count } = await supabase
      .from('groups')
      .select('*', { count: 'exact' })
      .eq('is_active', true);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // 获取每个群组的成员数
    const groupIds = groups?.map(g => g.id) || [];
    let memberCounts: Record<string, number> = {};
    
    if (groupIds.length > 0) {
      const { data: membersData, error: membersError } = await supabase
        .from('group_members')
        .select('group_id')
        .in('group_id', groupIds)
        .eq('is_active', true);
      
      if (!membersError && membersData) {
        // 统计每个群组的成员数
        memberCounts = membersData.reduce((acc, member) => {
          acc[member.group_id] = (acc[member.group_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }
    }

    // 合并成员数到群组数据
    const groupsWithMemberCount = groups?.map(group => ({
      ...group,
      member_count: memberCounts[group.id] || group.member_count || 0
    })) || [];

    res.json({ 
      success: true, 
      data: groupsWithMemberCount,
      total: count || 0,
      page: 1,
      limit: 100
    });
  },

  'POST /admin/groups': async (req, res) => {
    const { data, error } = await supabase.from('groups').insert(req.body).select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'GET /admin/groups/:id': async (req, res, params) => {
    const { data, error } = await supabase
      .from('groups')
      .select('*, group_configs(*)')
      .eq('id', params.id)
      .single();
    if (error) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const result = {
      ...data,
      group_configs: data?.group_configs?.[0] || null
    };
    res.json({ success: true, data: result });
  },

  'PUT /admin/groups/:id': async (req, res, params) => {
    const { data, error } = await supabase.from('groups').update(req.body).eq('id', params.id).select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'DELETE /admin/groups/:id': async (req, res, params) => {
    const { error } = await supabase.from('groups').delete().eq('id', params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  },

  'PUT /admin/groups/:id/config': async (req, res, params) => {
    const { data, error } = await supabase
      .from('group_configs')
      .upsert({ group_id: params.id, ...req.body })
      .select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'GET /admin/dashboard': async (req, res) => {
    const [groups, users, chatStats] = await Promise.all([
      supabase.from('groups').select('id, title, member_count', { count: 'exact' }).eq('is_active', true),
      supabase.from('users').select('id', { count: 'exact' }),
      supabase.from('chat_stats').select('*').order('date', { ascending: false }).limit(7)
    ]);

    const chartData = chatStats.data?.reverse() || [];
    const labels = chartData.map(d => {
      const date = new Date(d.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    });

    res.json({
      total_groups: groups.count || 0,
      total_users: users.count || 0,
      messages_today: chartData[0]?.total_messages || 0,
      messages_this_month: chatStats.data?.reduce((sum, d) => sum + (d.total_messages || 0), 0) || 0,
      active_users_today: chartData[0]?.active_users || 0,
      top_groups: groups.data?.slice(0, 5) || [],
      recent_activity: [],
      chart: {
        labels,
        messages: chartData.map(d => d.total_messages || 0),
        activeUsers: chartData.map(d => d.active_users || 0)
      }
    });
  },

  'GET /admin/permissions': async (req, res) => {
    const { data, error } = await supabase.from('menu_permissions').select('*');
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  },

  'POST /admin/permissions': async (req, res) => {
    const { data, error } = await supabase.from('menu_permissions').upsert(req.body).select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data });
  },

  'GET /admin/users-search': async (req, res) => {
    const query = req.query.q as string;
    if (!query) {
      res.json({ success: true, data: [] });
      return;
    }
    const { data, error } = await supabase
      .from('users')
      .select('id, telegram_id, username, first_name')
      .or(`username.ilike.%${query}%,first_name.ilike.%${query}%`)
      .limit(20);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  },

  'GET /admin/menu-permissions': async (req, res) => {
    const { data, error } = await supabase.from('menu_permissions').select('*');
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  },

  'POST /admin/menu-permissions': async (req, res) => {
    const { data, error } = await supabase.from('menu_permissions').upsert(req.body).select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data });
  },

  'GET /admin/points': async (req, res) => {
    const groupId = req.query.group_id as string;
    let query = supabase
      .from('user_points')
      .select(`
        *,
        users (
          id,
          telegram_id,
          username,
          first_name,
          display_name
        )
      `)
      .order('total_points', { ascending: false });
    if (groupId) query = query.eq('group_id', groupId);
    const { data, error } = await query.limit(100);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  },

  'POST /admin/points/checkin': async (req, res) => {
    const { telegram_id, group_id } = req.body;
    
    if (!telegram_id || !group_id) {
      res.status(400).json({ success: false, error: '缺少必要参数' });
      return;
    }

    try {
      const result = await pointsService.checkin(telegram_id, group_id);
      res.json({ success: true, data: { points_added: result.points, streak: result.streak, bonus: result.bonus } });
    } catch (error: any) {
      if (error.message === '今日已签到') {
        res.status(400).json({ success: false, error: '今日已签到' });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  },

  'POST /admin/points/adjust': async (req, res) => {
    const { telegram_id, group_id, amount, admin_id, reason } = req.body;
    
    if (!telegram_id || !group_id || amount === undefined || !admin_id || !reason) {
      res.status(400).json({ success: false, error: '缺少必要参数' });
      return;
    }

    try {
      const result = await pointsService.adjustPoints(telegram_id, group_id, amount, admin_id, reason);
      res.json({ success: result.success, data: { before: result.beforePoints, after: result.afterPoints } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  'GET /admin/points/leaderboard': async (req, res) => {
    const groupId = req.query.group_id as string;
    const type = (req.query.type as 'daily' | 'monthly' | 'total') || 'total';
    const limit = parseInt(req.query.limit as string) || 10;
    
    if (!groupId) {
      res.status(400).json({ success: false, error: '缺少群组ID' });
      return;
    }

    try {
      const leaderboard = await pointsService.getLeaderboard(groupId, type, limit);
      res.json({ success: true, data: leaderboard });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  'GET /admin/lottery': async (req, res) => {
    const groupId = req.query.group_id as string;
    let query = supabase.from('lotteries').select('*').eq('is_active', true);
    if (groupId) query = query.eq('group_id', groupId);
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  },

  'POST /admin/lottery': async (req, res) => {
    const { data, error } = await supabase.from('lotteries').insert(req.body).select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'GET /admin/lottery/:id': async (req, res, params) => {
    const { data, error } = await supabase
      .from('lotteries')
      .select('*')
      .eq('id', params.id)
      .single();
    if (error) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ success: true, data });
  },

  'PUT /admin/lottery/:id': async (req, res, params) => {
    const { data, error } = await supabase
      .from('lotteries')
      .update(req.body)
      .eq('id', params.id)
      .select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'DELETE /admin/lottery/:id': async (req, res, params) => {
    const { error } = await supabase.from('lotteries').delete().eq('id', params.id);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true });
  },

  'GET /admin/lottery/:id/participants': async (req, res, params) => {
    const { data, error } = await supabase
      .from('lottery_participants')
      .select('*, users(id, telegram_id, username, first_name)')
      .eq('lottery_id', params.id)
      .order('joined_at', { ascending: false });
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  },

  'POST /admin/lottery/:id/draw': async (req, res, params) => {
    const { admin_id } = req.body;
    
    const { data: lottery, error: lotteryError } = await supabase
      .from('lotteries')
      .select('*')
      .eq('id', params.id)
      .single();

    if (lotteryError || !lottery) {
      res.status(404).json({ success: false, error: '抽奖不存在' });
      return;
    }

    if (lottery.status === 'ended') {
      res.status(400).json({ success: false, error: '抽奖已结束' });
      return;
    }

    const { data: participants, error: participantsError } = await supabase
      .from('lottery_participants')
      .select('*')
      .eq('lottery_id', params.id);

    if (participantsError) {
      res.status(500).json({ success: false, error: participantsError.message });
      return;
    }

    if (!participants || participants.length === 0) {
      res.status(400).json({ success: false, error: '无人参与抽奖' });
      return;
    }

    const tickets: { userId: string; telegramId: number }[] = [];
    for (const p of participants) {
      for (let i = 0; i < (p.ticket_count || 1); i++) {
        tickets.push({
          userId: p.user_id,
          telegramId: p.telegram_id
        });
      }
    }

    const winnerCount = Math.min(lottery.winner_count, participants.length);
    const winners: { userId: string; telegramId: number }[] = [];
    const usedIndices = new Set<number>();

    while (winners.length < winnerCount && usedIndices.size < tickets.length) {
      const index = Math.floor(Math.random() * tickets.length);
      if (!usedIndices.has(index)) {
        usedIndices.add(index);
        const winner = tickets[index];
        if (!lottery.is_repeat_winner_allowed && winners.some(w => w.userId === winner.userId)) {
          continue;
        }
        winners.push(winner);
      }
    }

    await supabase
      .from('lottery_participants')
      .update({ is_winner: false })
      .eq('lottery_id', params.id);

    const winnerIds = winners.map(w => w.userId);
    await supabase
      .from('lottery_participants')
      .update({ is_winner: true })
      .eq('lottery_id', params.id)
      .in('user_id', winnerIds);

    await supabase
      .from('lotteries')
      .update({
        status: 'ended',
        winner_ids: winnerIds,
        winner_telegram_ids: winners.map(w => w.telegramId)
      })
      .eq('id', params.id);

    for (const winner of winners) {
      try {
        await callTelegramApi('sendMessage', {
          chat_id: winner.telegramId,
          text: `🎉 恭喜您中奖了！\n\n🏆 奖品：${lottery.prize}\n\n请联系群管理员领取奖品。`,
          parse_mode: 'HTML'
        });
      } catch (e) {
        console.error('Failed to notify winner:', winner.telegramId, e);
      }
    }

    res.json({
      success: true,
      data: {
        winners: winners.map(w => ({
          user_id: w.userId,
          telegram_id: w.telegramId
        })),
        participant_count: participants.length,
        prize: lottery.prize
      }
    });
  },

  'POST /admin/lottery/:id/publish': async (req, res, params) => {
    const { chat_id } = req.body;
    
    const { data: lottery, error: lotteryError } = await supabase
      .from('lotteries')
      .select('*')
      .eq('id', params.id)
      .single();

    if (lotteryError || !lottery) {
      res.status(404).json({ success: false, error: '抽奖不存在' });
      return;
    }

    if (lottery.status !== 'draft' && lottery.status !== 'active') {
      res.status(400).json({ success: false, error: '抽奖状态不允许发布' });
      return;
    }

    let message = `🎉 <b>${lottery.title}</b>\n\n`;
    if (lottery.description) {
      message += `📝 ${lottery.description}\n\n`;
    }
    message += `🏆 奖品：${lottery.prize}\n`;
    message += `👥 参与人数：${lottery.participant_count || 0}\n`;
    
    if (lottery.end_at) {
      const endDate = new Date(lottery.end_at);
      message += `⏰ 截止时间：${endDate.toLocaleString('zh-CN')}\n`;
    }

    const keyboard = {
      inline_keyboard: [
        [{ text: '🎲 参与抽奖', callback_data: `lottery_participate:${lottery.id}` }],
        [{ text: '🎁 开奖', callback_data: `lottery_draw:${lottery.id}` }]
      ]
    };

    const result = await callTelegramApi('sendMessage', {
      chat_id: chat_id,
      text: message,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });

    if (result.ok) {
      await supabase
        .from('lotteries')
        .update({ status: 'active' })
        .eq('id', params.id);
    }

    res.json({ success: result.ok, data: result.result });
  },

  'GET /admin/scheduled-messages': async (req, res) => {
    const groupId = req.query.group_id as string;
    let query = supabase.from('scheduled_messages').select('*');
    if (groupId) query = query.eq('group_id', groupId);
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  },

  'POST /admin/scheduled-messages': async (req, res) => {
    const { data, error } = await supabase.from('scheduled_messages').insert(req.body).select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'GET /admin/auto-replies': async (req, res) => {
    const groupId = req.query.group_id as string;
    let query = supabase.from('auto_reply_rules').select('*');
    if (groupId) query = query.eq('group_id', groupId);
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  },

  'POST /admin/auto-replies': async (req, res) => {
    const { data, error } = await supabase.from('auto_reply_rules').insert(req.body).select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'GET /admin/invite-stats': async (req, res) => {
    const groupId = req.query.group_id as string;
    let query = supabase.from('invite_stats').select('*, users(*)');
    if (groupId) query = query.eq('group_id', groupId);
    const { data, error } = await query.order('invite_count', { ascending: false }).limit(50);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  },

  'GET /admin/chat-stats': async (req, res) => {
    const groupId = req.query.group_id as string;
    const { data, error } = await supabase
      .from('chat_stats')
      .select('*')
      .eq('group_id', groupId)
      .order('date', { ascending: false })
      .limit(30);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  },

  'GET /admin/verified-users': async (req, res) => {
    const groupId = req.query.group_id as string;
    let query = supabase.from('verified_users').select('*, users(*)');
    if (groupId) query = query.eq('group_id', groupId);
    const { data, error } = await query;
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  },

  'POST /admin/send-message': async (req, res) => {
    const { chat_id, text } = req.body;
    const result = await sendMessage(chat_id, text);
    res.json({ success: result.ok, data: result });
  },

  'GET /admin/crypto-rates': async (req, res) => {
    res.json({
      success: true,
      data: {
        usdt_cny: 7.24,
        exchanges: [
          { name: 'Binance', rate: 7.23, change: '+0.12%' },
          { name: 'OKX', rate: 7.25, change: '+0.08%' },
          { name: 'Huobi', rate: 7.22, change: '-0.05%' }
        ],
        updated_at: new Date().toISOString()
      }
    });
  },

  'POST /admin/crypto-query': async (req, res) => {
    const { address } = req.body;
    res.json({
      success: true,
      data: {
        address,
        network: 'TRC20',
        balance: '0.00',
        value_usd: '0.00',
        transactions: []
      }
    });
  },

  'GET /admin/config': async (req, res) => {
    const groupId = req.query.group_id as string;
    const { data, error } = await supabase.from('group_configs').select('*').eq('group_id', groupId).single();
    if (error) {
      res.status(404).json({ error: 'Config not found' });
      return;
    }
    res.json({ success: true, data });
  },

  'PUT /admin/config': async (req, res) => {
    const { group_id, ...config } = req.body;
    const { data, error } = await supabase
      .from('group_configs')
      .upsert({ group_id, ...config })
      .select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'GET /admin/anti-ads': async (req, res) => {
    const groupId = req.query.group_id as string;
    const { data, error } = await supabase.from('group_configs').select('anti_ads_config').eq('group_id', groupId).single();
    if (error) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ success: true, data: data?.anti_ads_config || {} });
  },

  'POST /admin/anti-ads': async (req, res) => {
    const { group_id, config } = req.body;
    const { data, error } = await supabase
      .from('group_configs')
      .update({ anti_ads_config: config })
      .eq('group_id', group_id)
      .select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'GET /admin/anti-spam': async (req, res) => {
    const groupId = req.query.group_id as string;
    const { data, error } = await supabase.from('group_configs').select('anti_spam_config').eq('group_id', groupId).single();
    if (error) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ success: true, data: data?.anti_spam_config || {} });
  },

  'POST /admin/anti-spam': async (req, res) => {
    const { group_id, config } = req.body;
    const { data, error } = await supabase
      .from('group_configs')
      .update({ anti_spam_config: config })
      .eq('group_id', group_id)
      .select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'GET /admin/verification': async (req, res) => {
    const groupId = req.query.group_id as string;
    const { data, error } = await supabase.from('group_configs').select('verification_config').eq('group_id', groupId).single();
    if (error) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ success: true, data: data?.verification_config || {} });
  },

  'POST /admin/verification': async (req, res) => {
    const { group_id, config } = req.body;
    const { data, error } = await supabase
      .from('group_configs')
      .update({ verification_config: config })
      .eq('group_id', group_id)
      .select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'GET /admin/auto-delete': async (req, res) => {
    const groupId = req.query.group_id as string;
    const { data, error } = await supabase.from('group_configs').select('auto_delete_config').eq('group_id', groupId).single();
    if (error) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ success: true, data: data?.auto_delete_config || {} });
  },

  'POST /admin/auto-delete': async (req, res) => {
    const { group_id, config } = req.body;
    const { data, error } = await supabase
      .from('group_configs')
      .update({ auto_delete_config: config })
      .eq('group_id', group_id)
      .select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'GET /admin/auto-ban': async (req, res) => {
    const groupId = req.query.group_id as string;
    const { data, error } = await supabase.from('auto_ban_rules').select('*').eq('group_id', groupId);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  },

  'POST /admin/auto-ban': async (req, res) => {
    const { data, error } = await supabase.from('auto_ban_rules').insert(req.body).select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'GET /admin/channel-forwards': async (req, res) => {
    const groupId = req.query.group_id as string;
    const { data, error } = await supabase.from('channel_forwards').select('*').eq('group_id', groupId);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  },

  'POST /admin/channel-forwards': async (req, res) => {
    const { data, error } = await supabase.from('channel_forwards').insert(req.body).select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'GET /admin/channel-settings': async (req, res) => {
    const groupId = req.query.group_id as string;
    const { data, error } = await supabase.from('channel_settings').select('*').eq('group_id', groupId);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  },

  'POST /admin/channel-settings': async (req, res) => {
    const { data, error } = await supabase.from('channel_settings').insert(req.body).select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'GET /admin/group-members': async (req, res) => {
    const groupId = req.query.group_id as string;
    const { data, error } = await supabase.from('group_members').select('*, users(*)').eq('group_id', groupId);
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  },

  'GET /admin/commands': async (req, res) => {
    const groupId = req.query.group_id as string;
    const { data, error } = await supabase.from('group_configs').select('commands_config').eq('group_id', groupId).single();
    if (error) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ success: true, data: data?.commands_config || {} });
  },

  'POST /admin/commands': async (req, res) => {
    const { group_id, config } = req.body;
    const { data, error } = await supabase
      .from('group_configs')
      .update({ commands_config: config })
      .eq('group_id', group_id)
      .select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'GET /admin/porn-detection': async (req, res) => {
    const groupId = req.query.group_id as string;
    const { data, error } = await supabase.from('porn_detection_settings').select('*').eq('group_id', groupId).single();
    if (error) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ success: true, data: data || {} });
  },

  'POST /admin/porn-detection': async (req, res) => {
    const { data, error } = await supabase.from('porn_detection_settings').upsert(req.body).select();
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data[0] });
  },

  'GET /admin/super-tools': async (req, res) => {
    res.json({ success: true, data: [] });
  },

  'POST /admin/super-tools/broadcast': async (req, res) => {
    const { message, group_ids } = req.body;
    let successCount = 0;
    for (const chatId of group_ids || []) {
      const result = await sendMessage(chatId, message);
      if (result.ok) successCount++;
    }
    res.json({ success: true, data: { sent: successCount, total: group_ids?.length || 0 } });
  },

  'GET /admin/memberships': async (req, res) => {
    const { data, error } = await supabase.from('group_administrators').select('*, groups(*), users(*)');
    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }
    res.json({ success: true, data: data || [] });
  },

  'GET /admin/settings': async (req, res) => {
    res.json({ success: true, data: { theme: 'light', language: 'zh-CN' } });
  },

  'POST /admin/settings': async (req, res) => {
    res.json({ success: true, data: req.body });
  },

  'POST /admin/login': async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      res.status(400).json({ success: false, error: '用户名和密码不能为空' });
      return;
    }
    
    // 查询管理员
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();
    
    if (error || !admin) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }
    
    // 验证密码 (bcrypt hash)
    const bcrypt = await import('bcryptjs');
    const isValid = await bcrypt.compare(password, admin.password_hash);
    
    if (!isValid) {
      res.status(401).json({ success: false, error: '用户名或密码错误' });
      return;
    }
    
    // 更新最后登录时间
    await supabase
      .from('admins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', admin.id);
    
    // 生成简单 token (生产环境应使用 JWT)
    const token = Buffer.from(`${admin.id}:${Date.now()}`).toString('base64');
    
    res.json({
      success: true,
      token: token,
      user: {
        id: admin.id,
        username: admin.username,
        display_name: admin.display_name,
        level: admin.level
      }
    });
  },
  
  'POST /admin/change-password': async (req, res) => {
    const { username, old_password, new_password } = req.body;
    
    if (!username || !old_password || !new_password) {
      res.status(400).json({ success: false, error: '参数不完整' });
      return;
    }
    
    if (new_password.length < 6) {
      res.status(400).json({ success: false, error: '新密码至少6位' });
      return;
    }
    
    // 查询管理员
    const { data: admin, error } = await supabase
      .from('admins')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single();
    
    if (error || !admin) {
      res.status(401).json({ success: false, error: '用户不存在' });
      return;
    }
    
    // 验证旧密码
    const bcrypt = await import('bcryptjs');
    const isValid = await bcrypt.compare(old_password, admin.password_hash);
    
    if (!isValid) {
      res.status(401).json({ success: false, error: '原密码错误' });
      return;
    }
    
    // 生成新密码 hash
    const newHash = await bcrypt.hash(new_password, 10);
    
    // 更新密码
    const { error: updateError } = await supabase
      .from('admins')
      .update({ password_hash: newHash })
      .eq('id', admin.id);
    
    if (updateError) {
      res.status(500).json({ success: false, error: '密码修改失败' });
      return;
    }
    
    res.json({ success: true, message: '密码修改成功' });
  },

  'GET /admin/auth/me': async (req, res) => {
    res.json({ success: true, data: { id: 1, username: 'admin', role: 'super_admin' } });
  },

  'POST /admin/set-webhook': async (req, res) => {
    const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://tg-group-admin.vercel.app/api/telegram/webhook';
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        allowed_updates: [
          'message',
          'edited_message',
          'channel_post',
          'edited_channel_post',
          'inline_query',
          'chosen_inline_result',
          'callback_query',
          'shipping_query',
          'pre_checkout_query',
          'poll',
          'poll_answer',
          'my_chat_member',
          'chat_member',
          'chat_join_request'
        ],
        drop_pending_updates: true
      })
    });
    
    const result = await response.json() as TelegramApiResponse;
    res.json({ success: result.ok, data: result });
  },

  'GET /admin/webhook-info': async (req, res) => {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const result = await response.json() as TelegramApiResponse;
    res.json({ success: result.ok, data: result.result });
  },

  'POST /admin/delete-webhook': async (req, res) => {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: true })
    });
    
    const result = await response.json() as TelegramApiResponse;
    res.json({ success: result.ok, data: result });
  }
};

function matchRoute(method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
  const routes = Object.keys(handlers);
  
  for (const route of routes) {
    const [routeMethod, routePath] = route.split(' ');
    if (routeMethod !== method) continue;
    
    const routeParts = routePath.split('/');
    const pathParts = path.split('/');
    
    if (routeParts.length !== pathParts.length) continue;
    
    const params: Record<string, string> = {};
    let match = true;
    
    for (let i = 0; i < routeParts.length; i++) {
      if (routeParts[i].startsWith(':')) {
        params[routeParts[i].slice(1)] = pathParts[i];
      } else if (routeParts[i] !== pathParts[i]) {
        match = false;
        break;
      }
    }
    
    if (match) {
      return { handler: handlers[route], params };
    }
  }
  
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = req.url || '/';
  const urlObj = new URL(url, 'http://localhost');
  const path = urlObj.pathname.replace(/^\/api/, '') || '/';

  const matched = matchRoute(req.method || 'GET', path);

  if (!matched) {
    res.status(404).json({ error: 'Not found', path, method: req.method });
    return;
  }

  try {
    await matched.handler(req, res, matched.params);
  } catch (error: any) {
    console.error('Handler error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

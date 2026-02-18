import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_key';

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Missing Supabase credentials');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

async function callTelegramApi(method: string, params: Record<string, any>) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return response.json();
}

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
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

  try {
    // Health check
    if (path === '/health') {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
      return;
    }

    // Set webhook
    if (path === '/admin/set-webhook' && req.method === 'POST') {
      const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://tg-group-admin.vercel.app/api/telegram/webhook';
      const result = await callTelegramApi('setWebhook', {
        url: WEBHOOK_URL,
        allowed_updates: ['message', 'edited_message', 'callback_query', 'my_chat_member', 'chat_member'],
        drop_pending_updates: true
      });
      res.json({ success: result.ok, data: result });
      return;
    }

    // Webhook info
    if (path === '/admin/webhook-info' && req.method === 'GET') {
      const result = await callTelegramApi('getWebhookInfo', {});
      res.json({ success: result.ok, data: result.result });
      return;
    }

    // Delete webhook
    if (path === '/admin/delete-webhook' && req.method === 'POST') {
      const result = await callTelegramApi('deleteWebhook', { drop_pending_updates: true });
      res.json({ success: result.ok, data: result });
      return;
    }

    // Send login code
    if (path === '/admin/auth/send-code' && req.method === 'POST') {
      const { telegramId } = req.body;
      if (!telegramId) {
        res.status(400).json({ success: false, error: '请提供 Telegram ID' });
        return;
      }

      let chatId: number;
      if (typeof telegramId === 'string' && telegramId.startsWith('@')) {
        const chatResult = await callTelegramApi('getChat', { chat_id: telegramId });
        if (!chatResult.ok) {
          res.status(400).json({ success: false, error: '无法找到该用户，请先与机器人开始对话' });
          return;
        }
        chatId = chatResult.result.id;
      } else {
        chatId = parseInt(telegramId);
      }

      const code = generateCode();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const supabase = getSupabase();
      await supabase.from('login_codes').delete().eq('telegram_id', chatId);
      
      const { error: insertError } = await supabase
        .from('login_codes')
        .insert({
          telegram_id: chatId,
          code,
          expires_at: expiresAt.toISOString()
        });

      if (insertError) {
        res.status(500).json({ success: false, error: '保存验证码失败' });
        return;
      }

      const message = `🔐 登录验证码\n\n您的验证码是: <code>${code}</code>\n\n验证码 5 分钟内有效，请勿泄露给他人。`;
      const sendResult = await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML'
      });

      if (!sendResult.ok) {
        res.status(400).json({ success: false, error: '发送验证码失败，请先与机器人开始对话' });
        return;
      }

      res.json({ success: true, message: '验证码已发送到您的 Telegram' });
      return;
    }

    // Verify login code
    if (path === '/admin/auth/verify-code' && req.method === 'POST') {
      const { telegramId, code } = req.body;
      if (!telegramId || !code) {
        res.status(400).json({ success: false, error: '请提供 Telegram ID 和验证码' });
        return;
      }

      let chatId: number;
      if (typeof telegramId === 'string' && telegramId.startsWith('@')) {
        const chatResult = await callTelegramApi('getChat', { chat_id: telegramId });
        if (!chatResult.ok) {
          res.status(400).json({ success: false, error: '验证失败' });
          return;
        }
        chatId = chatResult.result.id;
      } else {
        chatId = parseInt(telegramId);
      }

      const supabase = getSupabase();
      const { data: loginCode, error } = await supabase
        .from('login_codes')
        .select('*')
        .eq('telegram_id', chatId)
        .eq('code', code)
        .eq('used', false)
        .single();

      if (error || !loginCode) {
        res.status(400).json({ success: false, error: '验证码无效或已过期' });
        return;
      }

      if (new Date(loginCode.expires_at) < new Date()) {
        res.status(400).json({ success: false, error: '验证码已过期' });
        return;
      }

      await supabase.from('login_codes').update({ used: true }).eq('id', loginCode.id);

      // Check if admin exists
      let { data: admin } = await supabase
        .from('admins')
        .select('*')
        .eq('telegram_id', chatId)
        .single();

      if (!admin) {
        const { data: newAdmin, error: createError } = await supabase
          .from('admins')
          .insert({
            telegram_id: chatId,
            display_name: `User_${chatId}`,
            level: 0,
            is_active: true
          })
          .select()
          .single();
        if (!createError) {
          admin = newAdmin;
        }
      }

      // Generate simple token
      const token = Buffer.from(`${chatId}:${Date.now()}:${JWT_SECRET}`).toString('base64');

      res.json({
        success: true,
        data: {
          token,
          user: {
            id: admin?.id,
            telegram_id: chatId,
            display_name: admin?.display_name,
            level: admin?.level || 0
          }
        }
      });
      return;
    }

    // Get current user
    if (path === '/admin/auth/me' && req.method === 'GET') {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ success: false, error: '未授权' });
        return;
      }

      const token = authHeader.replace('Bearer ', '');
      try {
        const decoded = Buffer.from(token, 'base64').toString();
        const [telegramId] = decoded.split(':');
        
        const supabase = getSupabase();
        const { data: admin } = await supabase
          .from('admins')
          .select('*')
          .eq('telegram_id', parseInt(telegramId))
          .single();

        if (!admin) {
          res.status(401).json({ success: false, error: '用户不存在' });
          return;
        }

        res.json({
          success: true,
          data: {
            id: admin.id,
            telegram_id: admin.telegram_id,
            display_name: admin.display_name,
            level: admin.level
          }
        });
      } catch {
        res.status(401).json({ success: false, error: '无效的令牌' });
      }
      return;
    }

    // Get groups
    if (path === '/admin/groups' && req.method === 'GET') {
      const supabase = getSupabase();
      const { data: groups, error } = await supabase
        .from('groups')
        .select('*')
        .eq('is_active', true);

      if (error) {
        res.status(500).json({ success: false, error: error.message });
        return;
      }

      res.json({ success: true, data: groups || [], total: groups?.length || 0 });
      return;
    }

    // Get dashboard stats
    if (path === '/admin/dashboard' && req.method === 'GET') {
      const supabase = getSupabase();
      
      const [groupsResult, usersResult, adminsResult] = await Promise.all([
        supabase.from('groups').select('id', { count: 'exact' }).eq('is_active', true),
        supabase.from('users').select('id', { count: 'exact' }),
        supabase.from('admins').select('id', { count: 'exact' }).eq('is_active', true)
      ]);

      res.json({
        success: true,
        data: {
          totalGroups: groupsResult.count || 0,
          totalUsers: usersResult.count || 0,
          totalAdmins: adminsResult.count || 0
        }
      });
      return;
    }

    // Default response
    res.status(404).json({ error: 'Not found', path, method: req.method });
  } catch (err: any) {
    console.error('API Error:', err);
    res.status(500).json({ success: false, error: err.message || 'Internal server error' });
  }
}

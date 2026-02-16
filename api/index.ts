import { VercelRequest, VercelResponse } from '@vercel/node';

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

  // Health check
  if (path === '/health') {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
    return;
  }

  // Set webhook
  if (path === '/admin/set-webhook' && req.method === 'POST') {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const WEBHOOK_URL = process.env.WEBHOOK_URL || 'https://tg-group-admin.vercel.app/api/telegram/webhook';
    
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        allowed_updates: ['message', 'edited_message', 'callback_query', 'my_chat_member', 'chat_member'],
        drop_pending_updates: true
      })
    });
    
    const result = await response.json();
    res.json({ success: result.ok, data: result });
    return;
  }

  // Webhook info
  if (path === '/admin/webhook-info' && req.method === 'GET') {
    const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
    const result = await response.json();
    res.json({ success: result.ok, data: result.result });
    return;
  }

  // Default response
  res.status(404).json({ error: 'Not found', path, method: req.method });
}

import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { scheduledMessagesService } from '../../services/scheduledMessagesService';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CRON_SECRET = process.env.CRON_SECRET;

async function sendTelegramMessage(chatId: number | string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!BOT_TOKEN) {
    return { ok: false, error: 'BOT_TOKEN not configured' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
      })
    });

    const data = await response.json();
    return { ok: data.ok, error: data.description };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

function verifyCronAuth(req: VercelRequest): boolean {
  const cronKey = req.headers['x-cron-key'] || 
                  req.headers['authorization']?.replace('Bearer ', '') ||
                  req.query.key;

  if (!CRON_SECRET) {
    console.warn('CRON_SECRET not configured, allowing request');
    return true;
  }

  return cronKey === CRON_SECRET;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Cron-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!verifyCronAuth(req)) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized',
      message: 'Invalid or missing cron authentication'
    });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  const startTime = Date.now();
  const now = new Date();

  try {
    const { data: pendingMessages, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('is_enabled', true)
      .lte('next_send_at', now.toISOString())
      .order('next_send_at', { ascending: true })
      .limit(100);

    if (fetchError) {
      console.error('Error fetching scheduled messages:', fetchError);
      return res.status(500).json({ 
        success: false, 
        error: 'Database error',
        details: fetchError.message 
      });
    }

    if (!pendingMessages || pendingMessages.length === 0) {
      return res.json({
        success: true,
        message: 'No pending scheduled messages',
        sent: 0,
        failed: 0,
        skipped: 0,
        executionTimeMs: Date.now() - startTime
      });
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;
    const errors: Array<{ id: string; error: string }> = [];
    const processedIds: string[] = [];

    for (const msg of pendingMessages) {
      try {
        const chatId = msg.channel_id || msg.group_id;
        
        if (!chatId) {
          skipped++;
          continue;
        }

        const content = msg.message_content;
        const text = content?.text || msg.content || '';

        if (!text) {
          skipped++;
          continue;
        }

        const result = await sendTelegramMessage(chatId, text);

        if (result.ok) {
          sent++;
          processedIds.push(msg.id);

          if (msg.schedule_type === 'once') {
            await supabase
              .from('scheduled_messages')
              .update({
                is_enabled: false,
                last_sent_at: now.toISOString(),
                sent_count: (msg.sent_count || 0) + 1
              })
              .eq('id', msg.id);
          } else {
            const nextSendAt = calculateNextSendTime(msg);

            if (nextSendAt && (!msg.end_at || nextSendAt <= new Date(msg.end_at))) {
              await supabase
                .from('scheduled_messages')
                .update({
                  next_send_at: nextSendAt.toISOString(),
                  last_sent_at: now.toISOString(),
                  sent_count: (msg.sent_count || 0) + 1
                })
                .eq('id', msg.id);
            } else {
              await supabase
                .from('scheduled_messages')
                .update({
                  is_enabled: false,
                  last_sent_at: now.toISOString(),
                  sent_count: (msg.sent_count || 0) + 1
                })
                .eq('id', msg.id);
            }
          }
        } else {
          failed++;
          errors.push({ id: msg.id, error: result.error || 'Unknown error' });

          await supabase
            .from('scheduled_messages')
            .update({
              failed_count: (msg.failed_count || 0) + 1
            })
            .eq('id', msg.id);
        }
      } catch (err: any) {
        failed++;
        errors.push({ id: msg.id, error: err.message });
      }
    }

    const executionTimeMs = Date.now() - startTime;

    console.log(`[Cron] Scheduled messages processed: sent=${sent}, failed=${failed}, skipped=${skipped}, time=${executionTimeMs}ms`);

    return res.json({
      success: true,
      timestamp: now.toISOString(),
      sent,
      failed,
      skipped,
      total: pendingMessages.length,
      processedIds,
      errors: errors.length > 0 ? errors : undefined,
      executionTimeMs
    });

  } catch (error: any) {
    console.error('[Cron] Error processing scheduled messages:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message,
      executionTimeMs: Date.now() - startTime
    });
  }
}

function calculateNextSendTime(message: any): Date | null {
  const now = new Date();
  const lastSent = message.last_sent_at ? new Date(message.last_sent_at) : now;

  if (message.schedule_type === 'interval' && message.interval_minutes) {
    return new Date(lastSent.getTime() + message.interval_minutes * 60000);
  }

  if (message.schedule_type === 'cron' && message.cron_expr) {
    return getNextCronOccurrence(message.cron_expr, now);
  }

  return null;
}

const CRON_PRESETS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@hourly': '0 * * * *'
};

function getNextCronOccurrence(cronExpr: string, fromDate: Date): Date {
  const expr = CRON_PRESETS[cronExpr] || cronExpr;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = expr.split(/\s+/);

  let next = new Date(fromDate);
  next.setSeconds(0);
  next.setMilliseconds(0);
  next.setMinutes(next.getMinutes() + 1);

  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (matchesCron(next, minute, hour, dayOfMonth, month, dayOfWeek)) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }

  return new Date(fromDate.getTime() + 24 * 60 * 60 * 1000);
}

function matchesCron(date: Date, minute: string, hour: string, dayOfMonth: string, month: string, dayOfWeek: string): boolean {
  return (
    matchesField(date.getMinutes(), minute, 0, 59) &&
    matchesField(date.getHours(), hour, 0, 23) &&
    matchesField(date.getDate(), dayOfMonth, 1, 31) &&
    matchesField(date.getMonth() + 1, month, 1, 12) &&
    matchesField(date.getDay(), dayOfWeek, 0, 6)
  );
}

function matchesField(value: number, field: string, min: number, max: number): boolean {
  if (field === '*') return true;

  if (field.includes(',')) {
    return field.split(',').some(f => matchesField(value, f, min, max));
  }

  if (field.includes('/')) {
    const [base, step] = field.split('/');
    const stepNum = parseInt(step, 10);
    if (base === '*') {
      return (value - min) % stepNum === 0;
    }
    const baseNum = parseInt(base, 10);
    return (value - baseNum) % stepNum === 0;
  }

  if (field.includes('-')) {
    const [start, end] = field.split('-').map(n => parseInt(n, 10));
    return value >= start && value <= end;
  }

  return value === parseInt(field, 10);
}

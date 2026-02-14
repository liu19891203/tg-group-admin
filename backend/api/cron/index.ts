// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/database';
import { redis } from '../../lib/redis';
import { sendMessage } from '../../lib/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { cron_type } = req.query;

  try {
    switch (cron_type) {
      case 'scheduled-messages':
        return await processScheduledMessages();
      case 'daily-stats':
        return await processDailyStats();
      default:
        return res.status(400).json({ error: 'Invalid cron type' });
    }
  } catch (error) {
    console.error('Cron handler error:', error);
    return res.status(500).json({ error: 'Internal error' });
  }
}

interface ScheduledMessage {
  id: string;
  group_id: string;
  channel_id?: number;
  message_content: any;
  schedule_type: string;
  interval_minutes?: number;
  cron_expr?: string;
  is_enabled: boolean;
  sent_count?: number;
  next_send_at?: string;
  end_at?: string;
}

async function processScheduledMessages() {
  const now = new Date().toISOString();

  const { data: messages, error } = await supabaseAdmin
    .from('scheduled_messages')
    .select('*')
    .eq('is_enabled', true)
    .lte('next_send_at', now)
    .or(`end_at.isnull,end_at.gte.${now}`)
    .limit(50);

  if (error || !messages || messages.length === 0) {
    return { processed: 0 };
  }

  const results = [];

  for (const msg of messages as any[]) {
    try {
      const result = await sendScheduledMessage(msg);
      results.push(result);
    } catch (err) {
      console.error(`Failed to send scheduled message ${msg.id}:`, err);
      await (supabaseAdmin
        .from('scheduled_messages')
        .update({
          failed_count: (msg.failed_count || 0) + 1,
          next_send_at: calculateNextSendTime(msg)
        })
        .eq('id', msg.id) as any);
    }
  }

  return { processed: results.length, success: results.length };
}

async function sendScheduledMessage(msg: any): Promise<boolean> {
  const { data: group } = await supabaseAdmin
    .from('groups')
    .select('chat_id')
    .eq('id', msg.group_id)
    .single();

  if (!group || !group.chat_id) {
    throw new Error('Group not found');
  }

  const chatId = msg.channel_id || group.chat_id;
  const content = msg.message_content;

  if (content.type === 'text' || !content.type) {
    await sendMessage(chatId, content.text || '');
  } else if (content.type === 'image' && content.image_url) {
    await sendMessage(chatId, content.text || '', {
      replyMarkup: content.buttons ? {
        inline_keyboard: content.buttons.map((btn: any) => [{ text: btn.text }])
      } : undefined
    });
  }

  if (content.pin) {
    const { pinChatMessage } = await import('../../lib/api');
    await pinChatMessage(chatId, msg.message_id);
  }

  const nextSendAt = calculateNextSendTime(msg);

  await (supabaseAdmin
    .from('scheduled_messages')
    .update({
      last_sent_at: new Date().toISOString(),
      sent_count: (msg.sent_count || 0) + 1,
      next_send_at: nextSendAt
    })
    .eq('id', msg.id) as any);

  return true;
}

function calculateNextSendTime(msg: any): string | null {
  if (!msg.is_enabled) return null;

  if (msg.schedule_type === 'once') {
    return null;
  }

  if (msg.schedule_type === 'interval' && msg.interval_minutes) {
    return new Date(Date.now() + msg.interval_minutes * 60 * 1000).toISOString();
  }

  if (msg.schedule_type === 'cron' && msg.cron_expr) {
    const next = getNextCronDate(msg.cron_expr);
    return next ? next.toISOString() : null;
  }

  return null;
}

function getNextCronDate(cronExpr: string): Date | null {
  try {
    const parts = cronExpr.split(' ');
    if (parts.length < 5) return null;

    const now = new Date();
    const next = new Date(now);

    const [minute, hour, dayOfMonth, month] = parts;

    next.setSeconds(0);
    next.setMilliseconds(0);

    if (minute !== '*') {
      next.setMinutes(parseInt(minute));
      if (next <= now) {
        next.setHours(next.getHours() + 1);
      }
    }

    if (hour !== '*') {
      next.setHours(parseInt(hour));
    }

    if (dayOfMonth !== '*') {
      next.setDate(parseInt(dayOfMonth));
    }

    if (month !== '*') {
      next.setMonth(parseInt(month) - 1);
    }

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next;
  } catch {
    return null;
  }
}

async function processDailyStats() {
  const today = new Date().toISOString().split('T')[0];

  console.log(`Processing daily stats for ${today}`);

  const { data: activeLotteries } = await supabaseAdmin
    .from('lotteries')
    .select('*')
    .eq('status', 'active')
    .lt('end_at', new Date().toISOString());

  for (const lottery of (activeLotteries || []) as any[]) {
    await (supabaseAdmin
      .from('lotteries')
      .update({ status: 'ended' })
      .eq('id', lottery.id) as any);
  }

  console.log(`Daily stats completed for ${today}`);

  return { processed: true, date: today };
}

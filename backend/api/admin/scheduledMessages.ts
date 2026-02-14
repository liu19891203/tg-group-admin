// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/database';
import { sendMessage } from '../../lib/api';
import { ScheduledMessage } from '../../types/database';

export async function handleScheduledMessages(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return await getScheduledMessages(req, res);
      case 'POST':
        return await createScheduledMessage(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Scheduled messages API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getScheduledMessages(req: VercelRequest, res: VercelResponse) {
  const { page = 1, limit = 20, group_id, is_enabled } = req.query;

  let query = supabaseAdmin
    .from('scheduled_messages')
    .select('*');

  if (group_id) {
    query = query.eq('group_id', group_id);
  }

  if (is_enabled !== undefined) {
    query = query.eq('is_enabled', is_enabled === 'true');
  }

  const from = (Number(page) - 1) * Number(limit);
  const to = from + Number(limit) - 1;

  const { data, error } = await query
    .order('next_send_at', { ascending: true, nullsFirst: false })
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

async function createScheduledMessage(req: VercelRequest, res: VercelResponse) {
  const {
    group_id,
    channel_id,
    title,
    message_content,
    schedule_type,
    cron_expr,
    interval_minutes,
    start_at,
    end_at,
    created_by
  } = req.body;

  if (!group_id || !message_content || !schedule_type) {
    return res.status(400).json({ error: 'group_id, message_content, and schedule_type are required' });
  }

  let nextSendAt: string | null = null;

  if (schedule_type === 'once' && start_at) {
    nextSendAt = start_at;
  } else if (schedule_type === 'interval' && interval_minutes) {
    nextSendAt = new Date(Date.now() + interval_minutes * 60 * 1000).toISOString();
  } else if (schedule_type === 'cron' && cron_expr) {
    nextSendAt = calculateNextCronExecution(cron_expr);
  }

  const { data, error } = await supabaseAdmin
    .from('scheduled_messages')
    .insert({
      group_id,
      channel_id,
      title,
      message_content,
      schedule_type,
      cron_expr,
      interval_minutes,
      start_at,
      end_at,
      next_send_at: nextSendAt,
      created_by
    } as any)
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(201).json({ data });
}

export async function handleScheduledMessageById(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return await getScheduledMessage(id as string, res);
      case 'PUT':
        return await updateScheduledMessage(id as string, req, res);
      case 'DELETE':
        return await deleteScheduledMessage(id as string, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Scheduled message API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getScheduledMessage(id: string, res: VercelResponse) {
  const { data, error } = await supabaseAdmin
    .from('scheduled_messages')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Scheduled message not found' });
  }

  return res.status(200).json({ data });
}

async function updateScheduledMessage(id: string, req: VercelRequest, res: VercelResponse) {
  const updates = req.body;

  if (updates.message_content || updates.cron_expr || updates.interval_minutes) {
    if (updates.schedule_type === 'cron' && updates.cron_expr) {
      updates.next_send_at = calculateNextCronExecution(updates.cron_expr);
    } else if (updates.schedule_type === 'interval' && updates.interval_minutes) {
      updates.next_send_at = new Date(Date.now() + updates.interval_minutes * 60 * 1000).toISOString();
    }
  }

  const { data, error } = await (supabaseAdmin
    .from('scheduled_messages')
    .update(updates)
    .eq('id', id)
    .select()
    .single() as any);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ data });
}

async function deleteScheduledMessage(id: string, res: VercelResponse) {
  const { error } = await supabaseAdmin
    .from('scheduled_messages')
    .delete()
    .eq('id', id);

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}

function calculateNextCronExecution(cronExpr: string): string | null {
  try {
    const parts = cronExpr.split(' ');
    if (parts.length < 5) {
      return null;
    }

    const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
    const now = new Date();
    const next = new Date(now);

    next.setSeconds(0);
    next.setMilliseconds(0);

    if (minute !== '*') {
      next.setMinutes(parseInt(minute));
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
    if (dayOfWeek !== '*') {
      next.setDate(parseInt(dayOfWeek));
    }

    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }

    return next.toISOString();
  } catch {
    return null;
  }
}

export async function handleSendScheduledNow(req: VercelRequest, res: VercelResponse) {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }

  try {
    const { data: scheduled, error } = await supabaseAdmin
      .from('scheduled_messages')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !scheduled) {
      return res.status(404).json({ error: 'Scheduled message not found' });
    }

    const { data: group } = await supabaseAdmin
      .from('groups')
      .select('chat_id')
      .eq('id', (scheduled as any).group_id)
      .single();

    if (!group || !(group as any).chat_id) {
      return res.status(400).json({ error: 'Group not found' });
    }

    const chatId = (scheduled as any).channel_id || (group as any).chat_id;
    await sendMessage(chatId, (scheduled as any).message_content?.text || '', {
      replyMarkup: (scheduled as any).message_content?.buttons ? {
        inline_keyboard: ((scheduled as any).message_content.buttons as any[]).map((btn: any) => [{
          text: btn.text
        }])
      } : undefined
    });

    await (supabaseAdmin
      .from('scheduled_messages')
      .update({
        last_sent_at: new Date().toISOString(),
        sent_count: ((scheduled as any).sent_count || 0) + 1
      })
      .eq('id', id) as any);

    return res.status(200).json({ success: true, message: 'Message sent successfully' });

  } catch (error) {
    console.error('Send scheduled message error:', error);
    return res.status(500).json({ error: 'Failed to send message' });
  }
}

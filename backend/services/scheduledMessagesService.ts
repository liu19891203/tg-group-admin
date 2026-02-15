import { supabase } from '../lib/database';
import { sendMessage } from '../lib/api';
import { ScheduledMessage, MessageContent } from '../types/database';

interface CreateScheduledMessageParams {
  chatId: string | number;
  content: string;
  scheduledAt: string;
  createdBy?: string;
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  repeatUntil?: string;
  cronExpr?: string;
  intervalMinutes?: number;
  priority?: 'low' | 'normal' | 'high';
}

interface ScheduledMessageResult {
  success: boolean;
  message?: ScheduledMessage;
  error?: string;
}

interface SendScheduledMessagesResult {
  sentCount: number;
  failedCount: number;
  generatedRecurring: number;
  messages: ScheduledMessage[];
}

interface CronValidationResult {
  valid: boolean;
  parsed?: string;
  error?: string;
}

const REPEAT_INTERVALS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  yearly: 365 * 24 * 60 * 60 * 1000
};

const CRON_PRESETS: Record<string, string> = {
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
  '@monthly': '0 0 1 * *',
  '@weekly': '0 0 * * 0',
  '@daily': '0 0 * * *',
  '@hourly': '0 * * * *'
};

export class ScheduledMessagesService {
  async createScheduledMessage(params: CreateScheduledMessageParams): Promise<ScheduledMessageResult> {
    const scheduledAt = new Date(params.scheduledAt);
    const now = new Date();

    if (scheduledAt <= now) {
      return { success: false, error: '无法安排过去的时间' };
    }

    if (!params.chatId || !params.content) {
      return { success: false, error: '缺少必要参数' };
    }

    const groupId = typeof params.chatId === 'string' ? params.chatId : null;
    const channelId = typeof params.chatId === 'number' ? params.chatId : null;

    const messageContent: MessageContent = {
      type: 'text',
      text: params.content
    };

    let scheduleType: 'cron' | 'interval' | 'once' = 'once';
    if (params.cronExpr) {
      scheduleType = 'cron';
    } else if (params.repeat && params.repeat !== 'none') {
      scheduleType = 'interval';
    }

    const { data, error } = await supabase
      .from('scheduled_messages')
      .insert({
        group_id: groupId,
        channel_id: channelId,
        message_content: messageContent,
        schedule_type: scheduleType,
        cron_expr: params.cronExpr,
        interval_minutes: params.intervalMinutes || this.getIntervalMinutes(params.repeat),
        start_at: params.scheduledAt,
        end_at: params.repeatUntil,
        is_enabled: true,
        next_send_at: params.scheduledAt,
        sent_count: 0,
        failed_count: 0,
        created_by: params.createdBy
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: data };
  }

  private getIntervalMinutes(repeat?: string): number | undefined {
    if (!repeat || repeat === 'none' || repeat === 'custom') {
      return undefined;
    }
    const ms = REPEAT_INTERVALS[repeat];
    return ms ? Math.floor(ms / 60000) : undefined;
  }

  async updateScheduledMessage(id: string, updates: Partial<CreateScheduledMessageParams>): Promise<ScheduledMessageResult> {
    const { data: existing, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: '消息不存在' };
    }

    if (existing.sent_count > 0 && new Date(existing.start_at || '') < new Date()) {
      return { success: false, error: '已发送的消息无法修改' };
    }

    const updateData: Record<string, any> = {};

    if (updates.content) {
      updateData.message_content = { type: 'text', text: updates.content };
    }
    if (updates.scheduledAt) {
      updateData.start_at = updates.scheduledAt;
      updateData.next_send_at = updates.scheduledAt;
    }
    if (updates.repeat) {
      updateData.interval_minutes = this.getIntervalMinutes(updates.repeat);
    }
    if (updates.repeatUntil) {
      updateData.end_at = updates.repeatUntil;
    }
    if (updates.cronExpr) {
      updateData.cron_expr = updates.cronExpr;
      updateData.schedule_type = 'cron';
    }

    const { data, error } = await supabase
      .from('scheduled_messages')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: data };
  }

  async deleteScheduledMessage(id: string): Promise<ScheduledMessageResult> {
    const { data: existing, error: fetchError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return { success: false, error: '消息不存在' };
    }

    if (existing.is_sent && existing.schedule_type === 'once') {
      return { success: false, error: '已发送的一次性消息无法删除' };
    }

    const { error } = await supabase
      .from('scheduled_messages')
      .delete()
      .eq('id', id);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  }

  async cancelScheduledMessage(id: string): Promise<ScheduledMessageResult> {
    const { data, error } = await supabase
      .from('scheduled_messages')
      .update({ is_enabled: false })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, message: data };
  }

  async getScheduledMessages(chatId: string, options?: {
    status?: string;
    upcoming?: boolean;
  }): Promise<ScheduledMessage[]> {
    let query = supabase
      .from('scheduled_messages')
      .select('*')
      .eq('group_id', chatId);

    if (options?.status) {
      if (options.status === 'cancelled') {
        query = query.eq('is_enabled', false);
      } else if (options.status === 'pending') {
        query = query.eq('is_enabled', true);
      }
    }

    if (options?.upcoming) {
      query = query.gte('next_send_at', new Date().toISOString());
    }

    const { data, error } = await query.order('next_send_at', { ascending: true });

    if (error) {
      console.error('Error fetching scheduled messages:', error);
      return [];
    }

    return data || [];
  }

  async getScheduledMessage(id: string): Promise<ScheduledMessage | null> {
    const { data, error } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  async sendNow(id: string): Promise<ScheduledMessageResult> {
    const message = await this.getScheduledMessage(id);

    if (!message) {
      return { success: false, error: '消息不存在' };
    }

    if (!message.is_enabled) {
      return { success: false, error: '消息已被取消' };
    }

    try {
      const chatId = message.channel_id || message.group_id;
      if (!chatId) {
        return { success: false, error: '无效的聊天ID' };
      }

      const content = message.message_content as MessageContent;
      const text = content.text || '';

      await sendMessage(Number(chatId), text);

      await supabase
        .from('scheduled_messages')
        .update({
          sent_count: message.sent_count + 1,
          last_sent_at: new Date().toISOString()
        })
        .eq('id', id);

      return { success: true, message: { ...message, sent_count: message.sent_count + 1 } };
    } catch (err: any) {
      await supabase
        .from('scheduled_messages')
        .update({
          failed_count: message.failed_count + 1
        })
        .eq('id', id);

      return { success: false, error: err.message };
    }
  }

  async sendScheduledMessages(): Promise<SendScheduledMessagesResult> {
    const now = new Date().toISOString();

    const { data: messages, error } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('is_enabled', true)
      .lte('next_send_at', now)
      .order('next_send_at', { ascending: true })
      .limit(50);

    if (error || !messages) {
      return { sentCount: 0, failedCount: 0, generatedRecurring: 0, messages: [] };
    }

    let sentCount = 0;
    let failedCount = 0;
    let generatedRecurring = 0;
    const processedMessages: ScheduledMessage[] = [];

    for (const message of messages) {
      try {
        const chatId = message.channel_id || message.group_id;
        if (!chatId) {
          failedCount++;
          continue;
        }

        const content = message.message_content as MessageContent;
        const text = content.text || '';

        await sendMessage(Number(chatId), text);

        sentCount++;
        processedMessages.push(message);

        if (message.schedule_type === 'once') {
          await supabase
            .from('scheduled_messages')
            .update({
              is_enabled: false,
              last_sent_at: now,
              sent_count: message.sent_count + 1
            })
            .eq('id', message.id);
        } else {
          const nextSendAt = this.calculateNextSendTime(message);

          if (nextSendAt && (!message.end_at || nextSendAt <= new Date(message.end_at))) {
            await supabase
              .from('scheduled_messages')
              .update({
                next_send_at: nextSendAt.toISOString(),
                last_sent_at: now,
                sent_count: message.sent_count + 1
              })
              .eq('id', message.id);
            generatedRecurring++;
          } else {
            await supabase
              .from('scheduled_messages')
              .update({
                is_enabled: false,
                last_sent_at: now,
                sent_count: message.sent_count + 1
              })
              .eq('id', message.id);
          }
        }
      } catch (err) {
        failedCount++;
        await supabase
          .from('scheduled_messages')
          .update({
            failed_count: message.failed_count + 1
          })
          .eq('id', message.id);
      }
    }

    return { sentCount, failedCount, generatedRecurring, messages: processedMessages };
  }

  private calculateNextSendTime(message: ScheduledMessage): Date | null {
    const now = new Date();
    const lastSent = message.last_sent_at ? new Date(message.last_sent_at) : now;

    if (message.schedule_type === 'interval' && message.interval_minutes) {
      return new Date(lastSent.getTime() + message.interval_minutes * 60000);
    }

    if (message.schedule_type === 'cron' && message.cron_expr) {
      return this.getNextOccurrence(message.cron_expr, now);
    }

    return null;
  }

  validateCronExpression(expr: string): CronValidationResult {
    try {
      const cronExpr = CRON_PRESETS[expr] || expr;
      const parts = cronExpr.trim().split(/\s+/);

      if (parts.length !== 5) {
        return { valid: false, error: 'Cron 表达式必须包含 5 个字段' };
      }

      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

      if (!this.isValidCronField(minute, 0, 59)) {
        return { valid: false, error: '分钟字段无效' };
      }
      if (!this.isValidCronField(hour, 0, 23)) {
        return { valid: false, error: '小时字段无效' };
      }
      if (!this.isValidCronField(dayOfMonth, 1, 31)) {
        return { valid: false, error: '日期字段无效' };
      }
      if (!this.isValidCronField(month, 1, 12)) {
        return { valid: false, error: '月份字段无效' };
      }
      if (!this.isValidCronField(dayOfWeek, 0, 6)) {
        return { valid: false, error: '星期字段无效' };
      }

      return { valid: true, parsed: cronExpr };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }

  private isValidCronField(field: string, min: number, max: number): boolean {
    if (field === '*') return true;

    if (field.includes(',')) {
      return field.split(',').every(f => this.isValidCronField(f, min, max));
    }

    if (field.includes('/')) {
      const [base, step] = field.split('/');
      const stepNum = parseInt(step, 10);
      if (isNaN(stepNum) || stepNum < 1) return false;
      if (base === '*') return true;
      return this.isValidCronField(base, min, max);
    }

    if (field.includes('-')) {
      const [start, end] = field.split('-').map(n => parseInt(n, 10));
      return !isNaN(start) && !isNaN(end) && start >= min && end <= max && start <= end;
    }

    const num = parseInt(field, 10);
    return !isNaN(num) && num >= min && num <= max;
  }

  getNextOccurrence(cronExpr: string, fromDate?: Date): Date {
    const from = fromDate || new Date();
    const expr = CRON_PRESETS[cronExpr] || cronExpr;
    const [minute, hour, dayOfMonth, month, dayOfWeek] = expr.split(/\s+/);

    let next = new Date(from);
    next.setSeconds(0);
    next.setMilliseconds(0);
    next.setMinutes(next.getMinutes() + 1);

    for (let i = 0; i < 366 * 24 * 60; i++) {
      if (this.matchesCron(next, minute, hour, dayOfMonth, month, dayOfWeek)) {
        return next;
      }
      next.setMinutes(next.getMinutes() + 1);
    }

    return new Date(from.getTime() + 24 * 60 * 60 * 1000);
  }

  private matchesCron(date: Date, minute: string, hour: string, dayOfMonth: string, month: string, dayOfWeek: string): boolean {
    return (
      this.matchesField(date.getMinutes(), minute, 0, 59) &&
      this.matchesField(date.getHours(), hour, 0, 23) &&
      this.matchesField(date.getDate(), dayOfMonth, 1, 31) &&
      this.matchesField(date.getMonth() + 1, month, 1, 12) &&
      this.matchesField(date.getDay(), dayOfWeek, 0, 6)
    );
  }

  private matchesField(value: number, field: string, min: number, max: number): boolean {
    if (field === '*') return true;

    if (field.includes(',')) {
      return field.split(',').some(f => this.matchesField(value, f, min, max));
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

  async duplicateScheduledMessage(id: string, newScheduledAt: string): Promise<ScheduledMessageResult> {
    const original = await this.getScheduledMessage(id);

    if (!original) {
      return { success: false, error: '原消息不存在' };
    }

    const content = original.message_content as MessageContent;

    return this.createScheduledMessage({
      chatId: original.group_id || original.channel_id || '',
      content: content.text || '',
      scheduledAt: newScheduledAt,
      createdBy: original.created_by,
      repeat: original.interval_minutes ? 'custom' : 'none',
      cronExpr: original.cron_expr,
      intervalMinutes: original.interval_minutes
    });
  }

  async getMessageHistory(chatId: string, options?: {
    from?: string;
    to?: string;
    limit?: number;
  }): Promise<ScheduledMessage[]> {
    let query = supabase
      .from('scheduled_messages')
      .select('*')
      .eq('group_id', chatId)
      .gt('sent_count', 0)
      .order('last_sent_at', { ascending: false });

    if (options?.from) {
      query = query.gte('last_sent_at', options.from);
    }
    if (options?.to) {
      query = query.lte('last_sent_at', options.to);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return [];
    }

    return data || [];
  }

  async getScheduledStats(chatId: string): Promise<{
    totalScheduled: number;
    activeScheduled: number;
    sentToday: number;
    sentThisWeek: number;
    byRepeatType: Record<string, number>;
  }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: all, error: allError } = await supabase
      .from('scheduled_messages')
      .select('*')
      .eq('group_id', chatId);

    if (allError || !all) {
      return {
        totalScheduled: 0,
        activeScheduled: 0,
        sentToday: 0,
        sentThisWeek: 0,
        byRepeatType: {}
      };
    }

    const byRepeatType: Record<string, number> = {};
    all.forEach(msg => {
      const type = msg.schedule_type || 'once';
      byRepeatType[type] = (byRepeatType[type] || 0) + 1;
    });

    return {
      totalScheduled: all.length,
      activeScheduled: all.filter(m => m.is_enabled).length,
      sentToday: all.filter(m => m.last_sent_at && m.last_sent_at >= todayStart).length,
      sentThisWeek: all.filter(m => m.last_sent_at && m.last_sent_at >= weekStart).length,
      byRepeatType
    };
  }

  async bulkSchedule(messages: CreateScheduledMessageParams[]): Promise<{
    success: boolean;
    scheduledCount: number;
    failedCount: number;
    errors: string[];
  }> {
    let scheduledCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (const msg of messages) {
      try {
        const result = await this.createScheduledMessage(msg);
        if (result.success) {
          scheduledCount++;
        } else {
          failedCount++;
          errors.push(result.error || '未知错误');
        }
      } catch (err: any) {
        failedCount++;
        errors.push(err.message);
      }
    }

    return {
      success: true,
      scheduledCount,
      failedCount,
      errors
    };
  }
}

export const scheduledMessagesService = new ScheduledMessagesService();

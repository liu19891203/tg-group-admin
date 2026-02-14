// @ts-nocheck
import { supabaseAdmin } from '../lib/database';

interface MessageStats {
  date: string;
  message_count: number;
  active_users: number;
}

interface DailyStats {
  date: string;
  checkins: number;
  messages: number;
  new_users: number;
}

export const messageStatsService = {
  async getDailyStats(
    startDate: Date,
    endDate: Date,
    groupId?: string
  ): Promise<DailyStats[]> {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    let messageQuery = supabaseAdmin
      .from('points_logs')
      .select('created_at, user_id', { count: 'exact' })
      .eq('change_type', 'message')
      .gte('created_at', start)
      .lte('created_at', end);

    if (groupId) {
      messageQuery = messageQuery.eq('group_id', groupId);
    }

    const { data: messages } = await messageQuery;

    const statsByDate: Record<string, DailyStats> = {};

    const processDate = (date: string) => {
      if (!statsByDate[date]) {
        statsByDate[date] = {
          date,
          checkins: 0,
          messages: 0,
          new_users: 0
        };
      }
    };

    for (const msg of messages || []) {
      const date = msg.created_at.split('T')[0];
      processDate(date);
      statsByDate[date].messages++;
    }

    return Object.values(statsByDate).sort(
      (a, b) => a.date.localeCompare(b.date)
    );
  },

  async getMessageTrend(
    startDate: Date,
    endDate: Date,
    groupId?: string,
    granularity: 'hour' | 'day' | 'week' = 'day'
  ): Promise<MessageStats[]> {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    let query = supabaseAdmin
      .from('points_logs')
      .select('created_at, user_id')
      .eq('change_type', 'message')
      .gte('created_at', start)
      .lte('created_at', end);

    if (groupId) {
      query = query.eq('group_id', groupId);
    }

    const { data: messages } = await query;

    const statsByPeriod: Record<string, MessageStats> = {};

    for (const msg of messages || []) {
      const date = msg.created_at.split('T')[0];
      
      if (!statsByPeriod[date]) {
        statsByPeriod[date] = {
          date,
          message_count: 0,
          active_users: new Set()
        };
      }
      
      statsByPeriod[date].message_count++;
      statsByPeriod[date].active_users.add(msg.user_id);
    }

    return Object.values(statsByPeriod).map(stat => ({
      date: stat.date,
      message_count: stat.message_count,
      active_users: stat.active_users.size
    })).sort((a, b) => a.date.localeCompare(b.date));
  },

  async getUserActivityStats(
    userId: string,
    groupId?: string,
    days: number = 30
  ): Promise<{
    total_messages: number;
    active_days: number;
    average_messages_per_day: number;
    last_active: string | null;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabaseAdmin
      .from('points_logs')
      .select('created_at')
      .eq('user_id', userId)
      .eq('change_type', 'message')
      .gte('created_at', startDate.toISOString());

    if (groupId) {
      query = query.eq('group_id', groupId);
    }

    const { data: messages } = await query;

    const activeDays = new Set<string>();
    let totalMessages = 0;

    for (const msg of messages || []) {
      const date = msg.created_at.split('T')[0];
      activeDays.add(date);
      totalMessages++;
    }

    const lastActive = messages?.[0]?.created_at || null;

    return {
      total_messages: totalMessages,
      active_days: activeDays.size,
      average_messages_per_day: activeDays.size > 0
        ? Math.round(totalMessages / days * 10) / 10
        : 0,
      last_active: lastActive
    };
  },

  async getGroupActivitySummary(
    groupId: string,
    days: number = 7
  ): Promise<{
    total_messages: number;
    unique_users: number;
    average_messages_per_user: number;
    most_active_hour: number;
    top_active_days: { date: string; count: number }[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: messages } = await supabaseAdmin
      .from('points_logs')
      .select('created_at, user_id')
      .eq('group_id', groupId)
      .eq('change_type', 'message')
      .gte('created_at', startDate.toISOString());

    const hourlyStats: Record<number, number> = {};
    const dailyStats: Record<string, number> = {};
    const users = new Set<string>();

    for (const msg of messages || []) {
      const date = new Date(msg.created_at);
      const hour = date.getHours();
      const day = date.toISOString().split('T')[0];

      hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
      dailyStats[day] = (dailyStats[day] || 0) + 1;
      users.add(msg.user_id);
    }

    const mostActiveHour = Object.entries(hourlyStats)
      .sort(([, a], [, b]) => b - a)[0]?.[0]
      ? parseInt(Object.entries(hourlyStats)
        .sort(([, a], [, b]) => b - a)[0][0])
      : 0;

    const topActiveDays = Object.entries(dailyStats)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);

    return {
      total_messages: messages?.length || 0,
      unique_users: users.size,
      average_messages_per_day: users.size > 0
        ? Math.round((messages?.length || 0) / days * 10) / 10
        : 0,
      most_active_hour: mostActiveHour,
      top_active_days: topActiveDays
    };
  },

  async recordMessage(
    userId: string,
    groupId: string,
    messageId: string
  ): Promise<void> {
    await supabaseAdmin
      .from('message_records')
      .upsert({
        user_id: userId,
        group_id: groupId,
        message_id: messageId,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'message_id'
      });
  },

  async getWordCloudData(
    groupId: string,
    days: number = 7,
    limit: number = 100
  ): Promise<{ word: string; count: number }[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: messages } = await supabaseAdmin
      .from('points_logs')
      .select('created_at, change_amount')
      .eq('group_id', groupId)
      .eq('change_type', 'message')
      .gte('created_at', startDate.toISOString());

    const wordCounts: Record<string, number> = {};

    for (const msg of messages || []) {
      const text = String(msg.change_amount);
      const words = extractWords(text);
      
      for (const word of words) {
        if (word.length >= 2) {
          wordCounts[word] = (wordCounts[word] || 0) + 1;
        }
      }
    }

    return Object.entries(wordCounts)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
};

function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 2);
}

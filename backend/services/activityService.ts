import { supabase } from '../lib/database';
import { Redis } from '@upstash/redis';

interface ActivityConfig {
  enabled: boolean;
  track_messages: boolean;
  track_media: boolean;
  track_commands: boolean;
  track_reactions: boolean;
  leaderboard_enabled: boolean;
  leaderboard_size: number;
  inactive_threshold_days: number;
  stats_retention_days: number;
}

interface UserActivityStats {
  user_id: string;
  telegram_id: number;
  username?: string;
  display_name?: string;
  message_count: number;
  media_count: number;
  command_count: number;
  reaction_count: number;
  active_days: number;
  first_active: string;
  last_active: string;
  activity_score: number;
  rank?: number;
}

interface GroupActivityStats {
  total_messages: number;
  total_media: number;
  total_commands: number;
  active_users: number;
  new_users: number;
  left_users: number;
  average_message_length: number;
  peak_hour: number;
  peak_day: string;
  top_users: UserActivityStats[];
}

interface HourlyStats {
  hour: number;
  message_count: number;
  percentage: number;
}

interface DailyStats {
  date: string;
  message_count: number;
  active_users: number;
  new_users: number;
}

interface ActivityTrend {
  date: string;
  messages: number;
  users: number;
  engagement_rate: number;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    return null;
  }
  
  return new Redis({ url, token });
}

export const activityService = {
  async recordActivity(
    chatId: number,
    userId: number,
    activityType: 'message' | 'media' | 'command' | 'reaction',
    metadata?: Record<string, any>
  ): Promise<void> {
    const redis = getRedis();
    const today = new Date().toISOString().split('T')[0];
    const hour = new Date().getHours();

    if (redis) {
      const dailyKey = `activity:${chatId}:${today}`;
      const hourlyKey = `activity:${chatId}:${today}:${hour}`;
      const userKey = `activity:${chatId}:user:${userId}:${today}`;

      await Promise.all([
        redis.hincrby(dailyKey, `${activityType}_count`, 1),
        redis.hincrby(hourlyKey, 'count', 1),
        redis.hincrby(userKey, `${activityType}_count`, 1),
        redis.hset(userKey, { last_active: new Date().toISOString() }),
        redis.expire(dailyKey, 86400 * 30),
        redis.expire(hourlyKey, 86400 * 7),
        redis.expire(userKey, 86400 * 30)
      ]);

      const userSetKey = `activity:${chatId}:${today}:users`;
      await redis.sadd(userSetKey, userId.toString());
      await redis.expire(userSetKey, 86400 * 30);
    }

    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (groupData) {
      await supabase.from('activity_records').upsert({
        group_id: groupData.id,
        telegram_id: userId,
        activity_type: activityType,
        activity_date: today,
        activity_hour: hour,
        metadata: metadata || {}
      }, {
        onConflict: 'group_id,telegram_id,activity_date,activity_type'
      });
    }
  },

  async getUserActivity(
    chatId: number,
    userId: number,
    days: number = 30
  ): Promise<UserActivityStats> {
    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) {
      return this.getEmptyUserStats(userId);
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: activities } = await supabase
      .from('activity_records')
      .select('*')
      .eq('group_id', groupData.id)
      .eq('telegram_id', userId)
      .gte('activity_date', startDate.toISOString().split('T')[0]);

    const { data: userData } = await supabase
      .from('users')
      .select('username, display_name, first_name')
      .eq('telegram_id', userId)
      .single();

    let messageCount = 0;
    let mediaCount = 0;
    let commandCount = 0;
    let reactionCount = 0;
    const activeDays = new Set<string>();
    let firstActive: string | null = null;
    let lastActive: string | null = null;

    for (const activity of activities || []) {
      activeDays.add(activity.activity_date);
      
      switch (activity.activity_type) {
        case 'message': messageCount++; break;
        case 'media': mediaCount++; break;
        case 'command': commandCount++; break;
        case 'reaction': reactionCount++; break;
      }

      if (!firstActive || activity.activity_date < firstActive) {
        firstActive = activity.activity_date;
      }
      if (!lastActive || activity.activity_date > lastActive) {
        lastActive = activity.activity_date;
      }
    }

    const activityScore = this.calculateActivityScore({
      message_count: messageCount,
      media_count: mediaCount,
      command_count: commandCount,
      reaction_count: reactionCount,
      active_days: activeDays.size
    });

    return {
      user_id: groupData.id,
      telegram_id: userId,
      username: userData?.username,
      display_name: userData?.display_name || userData?.first_name,
      message_count: messageCount,
      media_count: mediaCount,
      command_count: commandCount,
      reaction_count: reactionCount,
      active_days: activeDays.size,
      first_active: firstActive || new Date().toISOString(),
      last_active: lastActive || new Date().toISOString(),
      activity_score: activityScore
    };
  },

  async getGroupActivity(
    chatId: number,
    days: number = 7
  ): Promise<GroupActivityStats> {
    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) {
      return this.getEmptyGroupStats();
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: activities } = await supabase
      .from('activity_records')
      .select('telegram_id, activity_type, activity_date, activity_hour')
      .eq('group_id', groupData.id)
      .gte('activity_date', startDate.toISOString().split('T')[0]);

    let totalMessages = 0;
    let totalMedia = 0;
    let totalCommands = 0;
    const hourlyStats: Record<number, number> = {};
    const dailyStats: Record<string, Set<number>> = {};
    const userStats: Record<number, UserActivityStats> = {};

    for (const activity of activities || []) {
      const userId = activity.telegram_id;
      
      if (!userStats[userId]) {
        userStats[userId] = this.getEmptyUserStats(userId);
      }

      switch (activity.activity_type) {
        case 'message':
          totalMessages++;
          userStats[userId].message_count++;
          break;
        case 'media':
          totalMedia++;
          userStats[userId].media_count++;
          break;
        case 'command':
          totalCommands++;
          userStats[userId].command_count++;
          break;
        case 'reaction':
          userStats[userId].reaction_count++;
          break;
      }

      userStats[userId].active_days++;
      userStats[userId].last_active = activity.activity_date;

      hourlyStats[activity.activity_hour] = (hourlyStats[activity.activity_hour] || 0) + 1;

      if (!dailyStats[activity.activity_date]) {
        dailyStats[activity.activity_date] = new Set();
      }
      dailyStats[activity.activity_date].add(userId);
    }

    const peakHour = Object.entries(hourlyStats)
      .sort(([, a], [, b]) => b - a)[0]?.[0]
      ? parseInt(Object.entries(hourlyStats)
        .sort(([, a], [, b]) => b - a)[0][0])
      : 0;

    const peakDay = Object.entries(dailyStats)
      .sort(([, a], [, b]) => b.size - a.size)[0]?.[0] || '';

    const topUsers = Object.values(userStats)
      .map(u => ({
        ...u,
        activity_score: this.calculateActivityScore(u)
      }))
      .sort((a, b) => b.activity_score - a.activity_score)
      .slice(0, 10);

    topUsers.forEach((user, index) => {
      user.rank = index + 1;
    });

    return {
      total_messages: totalMessages,
      total_media: totalMedia,
      total_commands: totalCommands,
      active_users: Object.keys(userStats).length,
      new_users: 0,
      left_users: 0,
      average_message_length: 0,
      peak_hour: peakHour,
      peak_day: peakDay,
      top_users: topUsers
    };
  },

  async getActivityLeaderboard(
    chatId: number,
    period: 'daily' | 'weekly' | 'monthly' = 'weekly',
    limit: number = 10
  ): Promise<UserActivityStats[]> {
    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) {
      return [];
    }

    let startDate = new Date();
    switch (period) {
      case 'daily':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    const { data: activities } = await supabase
      .from('activity_records')
      .select('telegram_id, activity_type')
      .eq('group_id', groupData.id)
      .gte('activity_date', startDate.toISOString().split('T')[0]);

    const userStats: Record<number, UserActivityStats> = {};

    for (const activity of activities || []) {
      const userId = activity.telegram_id;
      
      if (!userStats[userId]) {
        userStats[userId] = this.getEmptyUserStats(userId);
      }

      switch (activity.activity_type) {
        case 'message': userStats[userId].message_count++; break;
        case 'media': userStats[userId].media_count++; break;
        case 'command': userStats[userId].command_count++; break;
        case 'reaction': userStats[userId].reaction_count++; break;
      }
    }

    const leaderboard = Object.values(userStats)
      .map(u => ({
        ...u,
        activity_score: this.calculateActivityScore(u)
      }))
      .sort((a, b) => b.activity_score - a.activity_score)
      .slice(0, limit);

    leaderboard.forEach((user, index) => {
      user.rank = index + 1;
    });

    return leaderboard;
  },

  async getHourlyStats(
    chatId: number,
    date?: string
  ): Promise<HourlyStats[]> {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const redis = getRedis();

    if (redis) {
      const stats: HourlyStats[] = [];
      let totalMessages = 0;

      for (let hour = 0; hour < 24; hour++) {
        const key = `activity:${chatId}:${targetDate}:${hour}`;
        const count = await redis.get<number>(key) || 0;
        stats.push({ hour, message_count: count, percentage: 0 });
        totalMessages += count;
      }

      return stats.map(s => ({
        ...s,
        percentage: totalMessages > 0 ? Math.round((s.message_count / totalMessages) * 100) : 0
      }));
    }

    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) {
      return Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        message_count: 0,
        percentage: 0
      }));
    }

    const { data: activities } = await supabase
      .from('activity_records')
      .select('activity_hour')
      .eq('group_id', groupData.id)
      .eq('activity_date', targetDate)
      .eq('activity_type', 'message');

    const hourlyCounts: Record<number, number> = {};
    let total = 0;

    for (const activity of activities || []) {
      hourlyCounts[activity.activity_hour] = (hourlyCounts[activity.activity_hour] || 0) + 1;
      total++;
    }

    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      message_count: hourlyCounts[i] || 0,
      percentage: total > 0 ? Math.round(((hourlyCounts[i] || 0) / total) * 100) : 0
    }));
  },

  async getDailyStats(
    chatId: number,
    days: number = 7
  ): Promise<DailyStats[]> {
    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) {
      return [];
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: activities } = await supabase
      .from('activity_records')
      .select('activity_date, telegram_id')
      .eq('group_id', groupData.id)
      .eq('activity_type', 'message')
      .gte('activity_date', startDate.toISOString().split('T')[0]);

    const dailyData: Record<string, { messages: number; users: Set<number> }> = {};

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      dailyData[dateStr] = { messages: 0, users: new Set() };
    }

    for (const activity of activities || []) {
      if (dailyData[activity.activity_date]) {
        dailyData[activity.activity_date].messages++;
        dailyData[activity.activity_date].users.add(activity.telegram_id);
      }
    }

    return Object.entries(dailyData)
      .map(([date, data]) => ({
        date,
        message_count: data.messages,
        active_users: data.users.size,
        new_users: 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  async getActivityTrend(
    chatId: number,
    days: number = 30
  ): Promise<ActivityTrend[]> {
    const dailyStats = await this.getDailyStats(chatId, days);
    
    return dailyStats.map(stat => ({
      date: stat.date,
      messages: stat.message_count,
      users: stat.active_users,
      engagement_rate: stat.active_users > 0 
        ? Math.round((stat.message_count / stat.active_users) * 100) / 100 
        : 0
    }));
  },

  async getInactiveUsers(
    chatId: number,
    thresholdDays: number = 7
  ): Promise<{ telegram_id: number; last_active: string }[]> {
    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) {
      return [];
    }

    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - thresholdDays);

    const { data: activeUsers } = await supabase
      .from('activity_records')
      .select('telegram_id, activity_date')
      .eq('group_id', groupData.id)
      .gte('activity_date', thresholdDate.toISOString().split('T')[0]);

    const activeUserIds = new Set(activeUsers?.map(u => u.telegram_id) || []);

    const { data: allMembers } = await supabase
      .from('group_members')
      .select('telegram_id')
      .eq('group_id', groupData.id)
      .eq('is_active', true);

    const inactiveUsers: { telegram_id: number; last_active: string }[] = [];

    for (const member of allMembers || []) {
      if (!activeUserIds.has(member.telegram_id)) {
        const lastActivity = await this.getLastActivity(groupData.id, member.telegram_id);
        inactiveUsers.push({
          telegram_id: member.telegram_id,
          last_active: lastActivity || '从未活跃'
        });
      }
    }

    return inactiveUsers;
  },

  async getLastActivity(groupId: string, telegramId: number): Promise<string | null> {
    const { data } = await supabase
      .from('activity_records')
      .select('activity_date')
      .eq('group_id', groupId)
      .eq('telegram_id', telegramId)
      .order('activity_date', { ascending: false })
      .limit(1)
      .single();

    return data?.activity_date || null;
  },

  calculateActivityScore(stats: Partial<UserActivityStats>): number {
    const messageWeight = 1;
    const mediaWeight = 2;
    const commandWeight = 0.5;
    const reactionWeight = 0.3;
    const activeDayWeight = 5;

    return (
      (stats.message_count || 0) * messageWeight +
      (stats.media_count || 0) * mediaWeight +
      (stats.command_count || 0) * commandWeight +
      (stats.reaction_count || 0) * reactionWeight +
      (stats.active_days || 0) * activeDayWeight
    );
  },

  getEmptyUserStats(userId: number): UserActivityStats {
    return {
      user_id: '',
      telegram_id: userId,
      username: undefined,
      display_name: undefined,
      message_count: 0,
      media_count: 0,
      command_count: 0,
      reaction_count: 0,
      active_days: 0,
      first_active: new Date().toISOString(),
      last_active: new Date().toISOString(),
      activity_score: 0
    };
  },

  getEmptyGroupStats(): GroupActivityStats {
    return {
      total_messages: 0,
      total_media: 0,
      total_commands: 0,
      active_users: 0,
      new_users: 0,
      left_users: 0,
      average_message_length: 0,
      peak_hour: 0,
      peak_day: '',
      top_users: []
    };
  },

  async setActivityConfig(groupId: string, config: Partial<ActivityConfig>): Promise<void> {
    await supabase
      .from('group_configs')
      .update({ activity_config: config })
      .eq('group_id', groupId);
  },

  async getActivityConfig(groupId: string): Promise<ActivityConfig> {
    const { data } = await supabase
      .from('group_configs')
      .select('activity_config')
      .eq('group_id', groupId)
      .single();

    return data?.activity_config || {
      enabled: true,
      track_messages: true,
      track_media: true,
      track_commands: true,
      track_reactions: false,
      leaderboard_enabled: true,
      leaderboard_size: 10,
      inactive_threshold_days: 7,
      stats_retention_days: 90
    };
  },

  async cleanupOldRecords(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { data, error } = await supabase
      .from('activity_records')
      .delete()
      .lt('activity_date', cutoffDate.toISOString().split('T')[0])
      .select('id');

    return data?.length || 0;
  }
};

export default activityService;

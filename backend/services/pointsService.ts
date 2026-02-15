// @ts-nocheck
import { supabase } from '../lib/database';
import { cacheManager } from '../lib/cache';
import { PointsConfig } from '../types/database';
import { sendMessage } from '../lib/api';

interface CheckinResult {
  points: number;
  streak: number;
  bonus: number;
  isFirstCheckin: boolean;
}

interface UserStats {
  points: number;
  totalPoints: number;
  streak: number;
  rank: number;
  checkinCount: number;
  lastActivity?: string;
}

interface LeaderboardEntry {
  userId: string;
  telegramId: number;
  username?: string;
  displayName?: string;
  points: number;
  rank: number;
}

export const pointsService = {
  async processMessage(
    telegramId: number,
    groupId: string,
    text: string,
    config?: PointsConfig
  ): Promise<void> {
    if (!config?.enabled || !text) return;

    try {
      const user = await cacheManager.getOrCreateUser(telegramId);
      if (!user) return;

      const today = new Date().toISOString().split('T')[0];

      const { data: todayLogs } = await supabase
        .from('points_logs')
        .select('change_amount')
        .eq('user_id', user.id)
        .eq('group_id', groupId)
        .eq('change_type', 'message')
        .gte('created_at', `${today}T00:00:00`);

      const todayPoints = todayLogs?.reduce((sum, log) => sum + (log.change_amount || 0), 0) || 0;

      if (todayPoints >= (config.daily_limit || 100)) {
        return;
      }

      const points = this.calculateMessagePoints(text, config);
      if (points <= 0) return;

      const remaining = (config.daily_limit || 100) - todayPoints;
      const actualPoints = Math.min(points, remaining);

      await this.addPoints(telegramId, groupId, actualPoints, 'message', {
        reason: `发言获得积分`,
        length: text.length
      });

    } catch (error) {
      console.error('Process message points error:', error);
    }
  },

  calculateMessagePoints(text: string, config: PointsConfig): number {
    try {
      const pattern = new RegExp(config.keyword_pattern || '[\\u4e00-\\u9fa5]{5,}', 'g');
      const matches = text.match(pattern);

      if (!matches) return 0;

      const totalChars = matches.join('').length;
      const points = Math.floor(totalChars * (config.per_message || 0.2));

      return Math.min(points, (config.daily_limit || 100));

    } catch {
      return 0;
    }
  },

  async addPoints(
    telegramId: number,
    groupId: string,
    amount: number,
    changeType: 'checkin' | 'message' | 'admin_add' | 'admin_subtract' | 'lottery' | 'expired',
    options?: {
      reason?: string;
      relatedId?: string;
      adminId?: string;
      length?: number;
    }
  ): Promise<{ beforePoints: number; afterPoints: number }> {
    const user = await cacheManager.getOrCreateUser(telegramId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const { data: pointsRecord, error: selectError } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      throw selectError;
    }

    const beforePoints = pointsRecord?.points || 0;
    let afterPoints = beforePoints;

    if (changeType === 'admin_subtract' || changeType === 'expired') {
      afterPoints = Math.max(0, beforePoints - Math.abs(amount));
    } else {
      afterPoints = beforePoints + Math.abs(amount);
    }

    if (pointsRecord) {
      await supabase
        .from('user_points')
        .update({
          points: afterPoints,
          total_points: changeType === 'admin_subtract' 
            ? pointsRecord.total_points 
            : (pointsRecord.total_points || 0) + Math.abs(amount),
          last_activity_at: new Date().toISOString()
        })
        .eq('id', pointsRecord.id);
    } else {
      await supabase
        .from('user_points')
        .insert({
          user_id: user.id,
          group_id: groupId,
          points: afterPoints,
          total_points: changeType === 'admin_subtract' ? 0 : Math.abs(amount),
          last_activity_at: new Date().toISOString()
        });
    }

    await supabase.from('points_logs').insert({
      user_id: user.id,
      group_id: groupId,
      change_type: changeType,
      change_amount: changeType === 'admin_subtract' || changeType === 'expired' ? -Math.abs(amount) : Math.abs(amount),
      before_points: beforePoints,
      after_points: afterPoints,
      reason: options?.reason,
      related_id: options?.relatedId,
      created_by: options?.adminId
    });

    return { beforePoints, afterPoints };
  },

  async checkin(telegramId: number, groupId: string): Promise<CheckinResult> {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const user = await cacheManager.getOrCreateUser(telegramId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const { data: todayCheckin } = await supabase
      .from('points_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .eq('change_type', 'checkin')
      .gte('created_at', `${today}T00:00:00`)
      .single();

    if (todayCheckin) {
      throw new Error('今日已签到');
    }

    const { data: config } = await supabase
      .from('group_configs')
      .select('points_config')
      .eq('group_id', groupId)
      .single();

    const pointsConfig: PointsConfig = config?.points_config || {
      enabled: true,
      daily_limit: 100,
      per_message: 0.2,
      checkin_base: 10,
      checkin_bonus: [2, 5, 10, 20],
      keyword_pattern: '[\\u4e00-\\u9fa5]{5,}'
    };

    const { data: pointsRecord } = await supabase
      .from('user_points')
      .select('id, checkin_streak, last_checkin_at, checkin_count')
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .single();

    let streak = 1;
    let bonus = 0;
    let isFirstCheckin = !pointsRecord;

    if (pointsRecord?.last_checkin_at?.startsWith(yesterday)) {
      streak = (pointsRecord.checkin_streak || 0) + 1;
    } else if (pointsRecord?.last_checkin_at?.startsWith(today)) {
      streak = pointsRecord.checkin_streak || 1;
    } else if (pointsRecord) {
      streak = 1;
    }

    const bonusIndex = Math.min(streak - 1, (pointsConfig.checkin_bonus || []).length - 1);
    bonus = (pointsConfig.checkin_bonus || [])[bonusIndex] || 0;

    const totalPoints = (pointsConfig.checkin_base || 10) + bonus;

    await this.addPoints(telegramId, groupId, totalPoints, 'checkin', {
      reason: `签到获得：基础${pointsConfig.checkin_base || 10} + 连续签到奖励${bonus}`
    });

    if (pointsRecord?.id) {
      await supabase
        .from('user_points')
        .update({
          checkin_count: (pointsRecord.checkin_count || 0) + 1,
          checkin_streak: streak,
          last_checkin_at: new Date().toISOString()
        })
        .eq('id', pointsRecord.id);
    } else {
      const { data: newPointsRecord } = await supabase
        .from('user_points')
        .select('id')
        .eq('user_id', user.id)
        .eq('group_id', groupId)
        .single();

      if (newPointsRecord) {
        await supabase
          .from('user_points')
          .update({
            checkin_count: 1,
            checkin_streak: streak,
            last_checkin_at: new Date().toISOString()
          })
          .eq('id', newPointsRecord.id);
      }
    }

    return {
      points: totalPoints,
      streak,
      bonus,
      isFirstCheckin
    };
  },

  async getUserStats(telegramId: number, groupId: string): Promise<UserStats> {
    const user = await cacheManager.getOrCreateUser(telegramId);
    if (!user) {
      throw new Error('用户不存在');
    }

    const { data: pointsRecord } = await supabase
      .from('user_points')
      .select('*')
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .single();

    const rank = await this.getUserRank(telegramId, groupId);

    return {
      points: pointsRecord?.points || 0,
      totalPoints: pointsRecord?.total_points || 0,
      streak: pointsRecord?.checkin_streak || 0,
      rank,
      checkinCount: pointsRecord?.checkin_count || 0,
      lastActivity: pointsRecord?.last_activity_at
    };
  },

  async getUserRank(telegramId: number, groupId: string): Promise<number> {
    const user = await cacheManager.getOrCreateUser(telegramId);
    if (!user) return 0;

    const userPoints = await this.getUserPoints(telegramId, groupId);

    const { count } = await supabase
      .from('user_points')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId)
      .gt('points', userPoints);

    return (count || 0) + 1;
  },

  async getUserPoints(telegramId: number, groupId: string): Promise<number> {
    const user = await cacheManager.getOrCreateUser(telegramId);
    if (!user) return 0;

    const { data: pointsRecord } = await supabase
      .from('user_points')
      .select('points')
      .eq('user_id', user.id)
      .eq('group_id', groupId)
      .single();

    return pointsRecord?.points || 0;
  },

  async getLeaderboard(
    groupId: string,
    type: 'daily' | 'monthly' | 'total',
    limit: number = 10
  ): Promise<LeaderboardEntry[]> {
    let query = supabase
      .from('user_points')
      .select(`
        user_id,
        points,
        total_points,
        users!inner (
          telegram_id,
          username,
          display_name
        )
      `)
      .eq('group_id', groupId)
      .order(type === 'total' ? 'total_points' : 'points', { ascending: false })
      .limit(limit);

    const { data: records } = await query;

    if (!records) return [];

    return records.map((record: any, index: number) => ({
      userId: record.user_id,
      telegramId: record.users.telegram_id,
      username: record.users.username,
      displayName: record.users.display_name,
      points: type === 'total' ? record.total_points : record.points,
      rank: index + 1
    }));
  },

  async adjustPoints(
    telegramId: number,
    groupId: string,
    amount: number,
    adminId: string,
    reason: string
  ): Promise<{ success: boolean; beforePoints: number; afterPoints: number }> {
    const changeType = amount >= 0 ? 'admin_add' : 'admin_subtract';

    try {
      const result = await this.addPoints(telegramId, groupId, Math.abs(amount), changeType, {
        reason,
        adminId
      });

      return {
        success: true,
        beforePoints: result.beforePoints,
        afterPoints: result.afterPoints
      };
    } catch (error) {
      return {
        success: false,
        beforePoints: 0,
        afterPoints: 0
      };
    }
  }
};

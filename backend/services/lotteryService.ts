// @ts-nocheck
import { supabase } from '../lib/database';
import { cacheManager } from '../lib/cache';
import { Lottery, LotteryConditions, LotteryParticipant } from '../types/database';
import { sendMessage } from '../lib/api';

interface LotteryResult {
  success: boolean;
  winners: {
    userId: string;
    telegramId: number;
    username?: string;
  }[];
  prize: string;
  participantCount: number;
}

export const lotteryService = {
  async createLottery(params: {
    groupId: string;
    title: string;
    description?: string;
    type: 'basic' | 'points' | 'lotto';
    prize: string;
    prizeImageUrl?: string;
    conditions?: LotteryConditions;
    winnerCount: number;
    maxParticipants?: number;
    durationMinutes?: number;
    createdBy?: string;
  }): Promise<Lottery> {
    const now = new Date().toISOString();
    const endAt = params.durationMinutes
      ? new Date(Date.now() + params.durationMinutes * 60 * 1000).toISOString()
      : null;

    const { data, error } = await supabase
      .from('lotteries')
      .insert({
        group_id: params.groupId,
        title: params.title,
        description: params.description,
        type: params.type,
        prize: params.prize,
        prize_image_url: params.prizeImageUrl,
        conditions: params.conditions || {},
        winner_count: params.winnerCount,
        max_participants: params.maxParticipants,
        duration_minutes: params.durationMinutes,
        status: params.durationMinutes ? 'active' : 'draft',
        start_at: now,
        end_at: endAt,
        created_by: params.createdBy
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async joinLottery(
    lotteryId: string,
    telegramId: number,
    options?: {
      username?: string;
      pointsToSpend?: number;
    }
  ): Promise<{ success: boolean; message: string; ticketCount?: number }> {
    const { data: lottery, error: lotteryError } = await supabase
      .from('lotteries')
      .select('*')
      .eq('id', lotteryId)
      .single();

    if (lotteryError || !lottery) {
      return { success: false, message: '抽奖不存在' };
    }

    if (lottery.status !== 'active') {
      return { success: false, message: '抽奖未开始或已结束' };
    }

    if (lottery.end_at && new Date(lottery.end_at) < new Date()) {
      await supabase
        .from('lotteries')
        .update({ status: 'ended' })
        .eq('id', lotteryId);
      return { success: false, message: '抽奖已结束' };
    }

    if (lottery.max_participants && lottery.participant_count >= lottery.max_participants) {
      return { success: false, message: '参与人数已满' };
    }

    const user = await cacheManager.getOrCreateUser(telegramId);
    if (!user) {
      return { success: false, message: '用户不存在' };
    }

    const { data: existing, error: existError } = await supabase
      .from('lottery_participants')
      .select('*')
      .eq('lottery_id', lotteryId)
      .eq('user_id', user.id)
      .single();

    if (existError && existError.code !== 'PGRST116') {
      throw existError;
    }

    if (existing) {
      return { success: false, message: '您已参与过此抽奖' };
    }

    if (lottery.type === 'points') {
      const pointsRequired = lottery.conditions?.points_required || 0;
      const currentPoints = await this.getUserPoints(telegramId, lottery.group_id);

      if (currentPoints < pointsRequired) {
        return { success: false, message: `需要 ${pointsRequired} 积分参与` };
      }

      if (options?.pointsToSpend && options.pointsToSpend > 0) {
        await this.deductUserPoints(telegramId, lottery.group_id, options.pointsToSpend);
      }
    }

    let ticketCount = 1;
    if (lottery.type === 'lotto') {
      const price = lottery.conditions?.lotto_ticket_price || 100;
      const points = await this.getUserPoints(telegramId, lottery.group_id);
      ticketCount = Math.min(Math.floor(points / price), 10);

      if (ticketCount > 0) {
        await this.deductUserPoints(telegramId, lottery.group_id, ticketCount * price);
      } else {
        return { success: false, message: '积分不足购买乐透票' };
      }
    }

    await supabase.from('lottery_participants').insert({
      lottery_id: lotteryId,
      user_id: user.id,
      telegram_id: telegramId,
      ticket_count: ticketCount,
      points_spent: lottery.type === 'lotto' ? ticketCount * (lottery.conditions?.lotto_ticket_price || 100) : 0
    });

    await supabase
      .from('lotteries')
      .update({
        participant_count: lottery.participant_count + 1,
        ticket_count: lottery.ticket_count + ticketCount
      })
      .eq('id', lotteryId);

    return {
      success: true,
      message: `参与成功！获得 ${ticketCount} 张抽奖券`,
      ticketCount
    };
  },

  async drawLottery(lotteryId: string, adminId?: string): Promise<LotteryResult> {
    const { data: lottery, error: lotteryError } = await supabase
      .from('lotteries')
      .select('*')
      .eq('id', lotteryId)
      .single();

    if (lotteryError || !lottery) {
      return { success: false, winners: [], prize: '', participantCount: 0 };
    }

    const { data: participants, error: participantsError } = await supabase
      .from('lottery_participants')
      .select('*')
      .eq('lottery_id', lotteryId);

    if (participantsError || !participants || participants.length === 0) {
      return { success: false, winners: [], prize: lottery.prize, participantCount: 0 };
    }

    const tickets: { userId: string; telegramId: number; username?: string }[] = [];
    for (const p of participants) {
      for (let i = 0; i < p.ticket_count; i++) {
        tickets.push({
          userId: p.user_id,
          telegramId: p.telegram_id,
          username: undefined
        });
      }
    }

    const winners: { userId: string; telegramId: number; username?: string }[] = [];
    const usedTickets = new Set<number>();

    for (let i = 0; i < Math.min(lottery.winner_count, participants.length); i++) {
      if (lottery.is_repeat_winner_allowed) {
        let winnerIndex: number;
        do {
          winnerIndex = Math.floor(Math.random() * tickets.length);
        } while (usedTickets.has(winnerIndex) && usedTickets.size < tickets.length);

        usedTickets.add(winnerIndex);
        winners.push(tickets[winnerIndex]);
      } else {
        let winner: { userId: string; telegramId: number; username?: string };
        let winnerIndex: number;
        do {
          winnerIndex = Math.floor(Math.random() * participants.length);
          winner = {
            userId: participants[winnerIndex].user_id,
            telegramId: participants[winnerIndex].telegram_id,
            username: undefined
          };
        } while (winners.some(w => w.userId === winner.userId));

        winners.push(winner);
      }
    }

    await supabase
      .from('lottery_participants')
      .update({ is_winner: false })
      .eq('lottery_id', lotteryId);

    const winnerIds = winners.map(w => w.userId);
    const winnerTelegramIds = winners.map(w => w.telegramId);

    await supabase
      .from('lottery_participants')
      .update({ is_winner: true })
      .eq('lottery_id', lotteryId)
      .in('user_id', winnerIds);

    await supabase
      .from('lotteries')
      .update({
        status: 'ended',
        winner_ids: winnerIds,
        winner_telegram_ids: winnerTelegramIds
      })
      .eq('id', lotteryId);

    return {
      success: true,
      winners,
      prize: lottery.prize,
      participantCount: participants.length
    };
  },

  async getLottery(lotteryId: string): Promise<Lottery | null> {
    const { data } = await supabase
      .from('lotteries')
      .select('*')
      .eq('id', lotteryId)
      .single();

    return data;
  },

  async getActiveLotteries(groupId: string): Promise<Lottery[]> {
    const { data } = await supabase
      .from('lotteries')
      .select('*')
      .eq('group_id', groupId)
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    return data || [];
  },

  async getLotteryParticipants(lotteryId: string): Promise<LotteryParticipant[]> {
    const { data } = await supabase
      .from('lottery_participants')
      .select('*')
      .eq('lottery_id', lotteryId)
      .order('joined_at', { ascending: false });

    return data || [];
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

  async deductUserPoints(
    telegramId: number,
    groupId: string,
    amount: number
  ): Promise<void> {
    const user = await cacheManager.getOrCreateUser(telegramId);
    if (!user) return;

    await supabase
      .from('user_points')
      .update({
        points: supabase.rpc('greatest', { x: supabase.rpc('coalesce', { x: 'points', y: 0 }) - amount, y: 0 })
      })
      .eq('user_id', user.id)
      .eq('group_id', groupId);
  },

  async announceWinners(
    chatId: number,
    lottery: Lottery,
    winners: { userId: string; telegramId: number; username?: string }[]
  ): Promise<void> {
    let winnerText = `🎉 抽奖结果\n\n🏆 奖品：${lottery.prize}\n\n🥇 中奖者：\n`;

    winners.forEach((w, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      winnerText += `${medal} ${w.username || `用户${w.telegramId}`}\n`;
    });

    winnerText += `\n🎁 共有 ${lottery.participant_count} 人参与`;

    await sendMessage(chatId, winnerText);
  }
};

import { TelegramMessage } from '../types/telegram';
import { warnService } from './warnService';
import { muteService } from './muteService';
import { activityService } from './activityService';
import { entertainmentService } from './entertainmentService';
import { nsfwDetectionService } from './nsfwDetectionService';
import { languageWhitelistService } from './languageWhitelistService';
import { supabase } from '../lib/database';

interface GroupConfig {
  verification_enabled?: boolean;
  welcome_enabled?: boolean;
  auto_reply_enabled?: boolean;
  auto_delete_enabled?: boolean;
  auto_ban_enabled?: boolean;
  auto_warn_enabled?: boolean;
  auto_mute_enabled?: boolean;
  flood_control_enabled?: boolean;
  ad_block_enabled?: boolean;
  command_disable_enabled?: boolean;
  crypto_enabled?: boolean;
  members_enabled?: boolean;
  scheduled_msg_enabled?: boolean;
  points_enabled?: boolean;
  activity_stats_enabled?: boolean;
  entertainment_enabled?: boolean;
  usdt_price_enabled?: boolean;
  channel_link_enabled?: boolean;
  admin_perms_enabled?: boolean;
  nsfw_detection_enabled?: boolean;
  language_whitelist_enabled?: boolean;
  invite_links_enabled?: boolean;
  lottery_enabled?: boolean;
  verified_users_enabled?: boolean;
  warn_config?: any;
  mute_config?: any;
  activity_config?: any;
  entertainment_config?: any;
  nsfw_config?: any;
  language_whitelist_config?: any;
  anti_ads_config?: any;
  anti_spam_config?: any;
}

export const newFeaturesIntegration = {
  async processMessage(
    message: TelegramMessage,
    config: GroupConfig
  ): Promise<void> {
    const chatId = message.chat.id;
    const userId = message.from?.id;
    const text = message.text || message.caption || '';

    if (!userId) return;

    if (config.activity_stats_enabled) {
      await activityService.recordActivity(
        chatId,
        userId,
        message.photo || message.video ? 'media' : 'message'
      );
    }

    if (config.language_whitelist_enabled && text) {
      const langConfig = config.language_whitelist_config || {};
      await languageWhitelistService.checkMessage(message, {
        enabled: true,
        ...langConfig
      });
    }

    if (config.nsfw_detection_enabled && (message.photo || message.video || message.document)) {
      const nsfwConfig = config.nsfw_config || {};
      await nsfwDetectionService.detectImage(message, {
        enabled: true,
        ...nsfwConfig
      });
    }
  },

  async handleEntertainmentCommand(
    message: TelegramMessage,
    command: string,
    args: string[]
  ): Promise<{ handled: boolean; response?: string }> {
    const chatId = message.chat.id;
    const userId = message.from?.id;

    if (!userId) {
      return { handled: false };
    }

    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) {
      return { handled: false };
    }

    const { data: configData } = await supabase
      .from('group_configs')
      .select('entertainment_enabled, entertainment_config')
      .eq('group_id', groupData.id)
      .single();

    if (!configData?.entertainment_enabled) {
      return { handled: false };
    }

    const gameConfig = {
      enabled: true,
      points_reward: 50,
      points_cost: 10,
      cooldown_seconds: 30,
      max_games_per_day: 50,
      leaderboard_enabled: true,
      ...configData.entertainment_config
    };

    switch (command) {
      case 'guess':
        const guessNum = parseInt(args[0]);
        if (isNaN(guessNum)) {
          const result = await entertainmentService.startGuessNumber(message);
          return { handled: true, response: result.message };
        }
        const guessResult = await entertainmentService.guessNumber(message, guessNum, gameConfig);
        return { handled: true, response: guessResult.message };

      case 'rps':
      case 'rockpaperscissors':
        const choice = args[0]?.toLowerCase() as 'rock' | 'paper' | 'scissors';
        if (!['rock', 'paper', 'scissors'].includes(choice)) {
          return { 
            handled: true, 
            response: '🎮 石头剪刀布\n\n使用方法: /rps <rock|paper|scissors>\n示例: /rps rock' 
          };
        }
        const rpsResult = await entertainmentService.rockPaperScissors(message, choice, gameConfig);
        return { handled: true, response: rpsResult.message };

      case 'dice':
        const bet = parseInt(args[0]) || 10;
        const guess = (args[1]?.toLowerCase() || 'big') as 'big' | 'small';
        if (!['big', 'small'].includes(guess)) {
          return { 
            handled: true, 
            response: '🎲 猜大小\n\n使用方法: /dice <积分> <big|small>\n示例: /dice 10 big' 
          };
        }
        const diceResult = await entertainmentService.dice(message, bet, guess, gameConfig);
        return { handled: true, response: diceResult.message };

      case 'bj':
      case 'blackjack':
        const action = (args[0]?.toLowerCase() || 'hit') as 'hit' | 'stand' | 'double';
        const bjResult = await entertainmentService.blackjack(message, action, gameConfig);
        return { handled: true, response: bjResult.message };

      case 'roulette':
        const rouletteBet = parseInt(args[0]) || 10;
        const betType = args[1]?.toLowerCase() || 'red';
        const rouletteResult = await entertainmentService.roulette(
          message, 
          rouletteBet, 
          betType as any,
          gameConfig
        );
        return { handled: true, response: rouletteResult.message };

      case 'trivia':
        const triviaAnswer = args.join(' ');
        const triviaResult = await entertainmentService.trivia(message, triviaAnswer || undefined, gameConfig);
        return { handled: true, response: triviaResult.message };

      case 'gamestats':
        const stats = await entertainmentService.getGameStats(chatId, userId);
        return { 
          handled: true, 
          response: `📊 游戏统计\n\n总游戏数: ${stats.total_games}\n胜: ${stats.wins}\n负: ${stats.losses}\n净积分: ${stats.total_points >= 0 ? '+' : ''}${stats.total_points}` 
        };

      case 'gameleaderboard':
        const leaderboard = await entertainmentService.getGameLeaderboard(chatId);
        let leaderboardText = '🏆 游戏排行榜\n\n';
        leaderboard.forEach((entry, index) => {
          leaderboardText += `${index + 1}. ${entry.username || '匿名'} - ${entry.total_points}积分 (${entry.wins}胜)\n`;
        });
        return { handled: true, response: leaderboardText || '暂无数据' };

      default:
        return { handled: false };
    }
  },

  async handleWarnCommand(
    message: TelegramMessage,
    args: string[]
  ): Promise<{ handled: boolean; response?: string }> {
    const chatId = message.chat.id;
    const adminId = message.from?.id;

    if (!adminId) {
      return { handled: false };
    }

    const replyTo = message.reply_to_message;
    if (!replyTo) {
      return { handled: true, response: '⚠️ 请回复要警告的用户消息' };
    }

    const targetUserId = replyTo.from?.id;
    if (!targetUserId) {
      return { handled: true, response: '❌ 无法获取目标用户信息' };
    }

    const reason = args.join(' ') || '违反群规';

    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) {
      return { handled: false };
    }

    const { data: configData } = await supabase
      .from('group_configs')
      .select('warn_config')
      .eq('group_id', groupData.id)
      .single();

    const warnConfig = {
      enabled: true,
      max_warns: 3,
      warn_expiry_hours: 24,
      punishment: 'mute',
      mute_duration: 3600,
      warn_message: '⚠️ {user} 已被警告 ({count}/{max})\n原因: {reason}',
      max_warn_message: '🚫 {user} 达到警告上限 ({count}/{max})，已执行处罚',
      auto_reset: true,
      notify_admins: false,
      ...configData?.warn_config
    };

    const result = await warnService.warnUser(replyTo, reason, warnConfig, adminId);
    return { handled: true, response: result.message };
  },

  async handleMuteCommand(
    message: TelegramMessage,
    args: string[]
  ): Promise<{ handled: boolean; response?: string }> {
    const chatId = message.chat.id;
    const adminId = message.from?.id;

    if (!adminId) {
      return { handled: false };
    }

    const replyTo = message.reply_to_message;
    if (!replyTo) {
      return { handled: true, response: '⚠️ 请回复要禁言的用户消息' };
    }

    const targetUserId = replyTo.from?.id;
    if (!targetUserId) {
      return { handled: true, response: '❌ 无法获取目标用户信息' };
    }

    const durationStr = args[0] || '5m';
    const duration = muteService.parseDuration(durationStr);
    const reason = args.slice(1).join(' ') || '违反群规';

    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) {
      return { handled: false };
    }

    const { data: configData } = await supabase
      .from('group_configs')
      .select('mute_config')
      .eq('group_id', groupData.id)
      .single();

    const muteConfig = {
      enabled: true,
      default_duration: 300,
      max_duration: 86400,
      allow_custom_duration: true,
      mute_message: '🔇 {user} 已被禁言 {duration}\n原因: {reason}',
      unmute_message: '🔊 {user} 已被解除禁言',
      log_mutes: true,
      notify_user: true,
      progressive_mute: false,
      progressive_durations: [300, 900, 3600, 86400, 604800],
      ...configData?.mute_config
    };

    const result = await muteService.muteUser(replyTo, duration, reason, adminId, muteConfig);
    return { handled: true, response: result.message };
  },

  async handleActivityCommand(
    message: TelegramMessage,
    command: string
  ): Promise<{ handled: boolean; response?: string }> {
    const chatId = message.chat.id;
    const userId = message.from?.id;

    if (!userId) {
      return { handled: false };
    }

    switch (command) {
      case 'activity':
        const stats = await activityService.getGroupActivity(chatId, 7);
        let activityText = `📊 群组活跃度统计 (最近7天)\n\n`;
        activityText += `💬 消息总数: ${stats.total_messages}\n`;
        activityText += `🖼️ 媒体消息: ${stats.total_media}\n`;
        activityText += `👥 活跃用户: ${stats.active_users}\n`;
        activityText += `⏰ 活跃时段: ${stats.peak_hour}:00\n`;
        return { handled: true, response: activityText };

      case 'mystats':
        const userStats = await activityService.getUserActivity(chatId, userId, 30);
        let userStatsText = `👤 你的活跃度统计 (最近30天)\n\n`;
        userStatsText += `💬 消息数: ${userStats.message_count}\n`;
        userStatsText += `🖼️ 媒体数: ${userStats.media_count}\n`;
        userStatsText += `📅 活跃天数: ${userStats.active_days}\n`;
        userStatsText += `⭐ 活跃分数: ${userStats.activity_score}\n`;
        userStatsText += `🕐 最后活跃: ${userStats.last_active}\n`;
        return { handled: true, response: userStatsText };

      case 'activityrank':
        const leaderboard = await activityService.getActivityLeaderboard(chatId, 'weekly', 10);
        let rankText = '🏆 活跃度排行榜 (本周)\n\n';
        leaderboard.forEach((entry, index) => {
          rankText += `${index + 1}. ${entry.display_name || entry.username || '匿名'} - ${entry.activity_score}分\n`;
        });
        return { handled: true, response: rankText || '暂无数据' };

      default:
        return { handled: false };
    }
  },

  async getGroupConfig(chatId: number): Promise<GroupConfig | null> {
    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) {
      return null;
    }

    const { data: configData } = await supabase
      .from('group_configs')
      .select('*')
      .eq('group_id', groupData.id)
      .single();

    return configData || null;
  }
};

export default newFeaturesIntegration;

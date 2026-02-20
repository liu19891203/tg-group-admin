import { supabase } from '../lib/database';
import { Redis } from '@upstash/redis';
import { sendMessage } from '../lib/api';
import { TelegramMessage } from '../types/telegram';

interface GameConfig {
  enabled: boolean;
  points_reward: number;
  points_cost: number;
  cooldown_seconds: number;
  max_games_per_day: number;
  leaderboard_enabled: boolean;
}

interface GameResult {
  success: boolean;
  game_type: string;
  result: 'win' | 'lose' | 'draw';
  points_change: number;
  message: string;
  data?: Record<string, any>;
}

interface GameState {
  game_id: string;
  game_type: string;
  chat_id: number;
  user_id: number;
  state: Record<string, any>;
  created_at: string;
  expires_at: string;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!url || !token) {
    return null;
  }
  
  return new Redis({ url, token });
}

export const entertainmentService = {
  async guessNumber(
    message: TelegramMessage,
    guess: number,
    config: GameConfig
  ): Promise<GameResult> {
    if (!config.enabled) {
      return { success: false, game_type: 'guess_number', result: 'lose', points_change: 0, message: '游戏功能未启用' };
    }

    const chatId = message.chat.id;
    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || '玩家';

    if (!userId) {
      return { success: false, game_type: 'guess_number', result: 'lose', points_change: 0, message: '无法获取用户信息' };
    }

    const redis = getRedis();
    const key = `game:guess_number:${chatId}:${userId}`;

    let targetNumber: number;
    let attempts: number;
    let gameState: { target: number; attempts: number; max_attempts: number };

    if (redis) {
      const existing = await redis.get<{ target: number; attempts: number; max_attempts: number }>(key);
      
      if (existing) {
        targetNumber = existing.target;
        attempts = existing.attempts + 1;
        gameState = existing;
      } else {
        targetNumber = Math.floor(Math.random() * 100) + 1;
        attempts = 1;
        gameState = { target: targetNumber, attempts: 1, max_attempts: 10 };
        await redis.setex(key, 300, gameState);
      }

      if (guess === targetNumber) {
        await redis.del(key);
        const pointsEarned = Math.max(config.points_reward - (attempts - 1) * 10, 10);
        
        await this.awardPoints(chatId, userId, pointsEarned);
        await this.recordGameResult(chatId, userId, 'guess_number', 'win', pointsEarned);

        return {
          success: true,
          game_type: 'guess_number',
          result: 'win',
          points_change: pointsEarned,
          message: `🎉 恭喜 ${username}！你猜对了！答案就是 ${targetNumber}\n用了 ${attempts} 次机会，获得 ${pointsEarned} 积分！`,
          data: { target: targetNumber, attempts }
        };
      }

      if (attempts >= gameState.max_attempts) {
        await redis.del(key);
        await this.recordGameResult(chatId, userId, 'guess_number', 'lose', 0);

        return {
          success: true,
          game_type: 'guess_number',
          result: 'lose',
          points_change: 0,
          message: `😢 游戏结束！正确答案是 ${targetNumber}\n你已经用完了所有 ${gameState.max_attempts} 次机会。`,
          data: { target: targetNumber, attempts }
        };
      }

      gameState.attempts = attempts;
      await redis.setex(key, 300, gameState);

      const hint = guess < targetNumber ? '太小了 ⬆️' : '太大了 ⬇️';
      const remaining = gameState.max_attempts - attempts;

      return {
        success: true,
        game_type: 'guess_number',
        result: 'draw',
        points_change: 0,
        message: `🎯 ${username} 猜了 ${guess}\n${hint}\n还剩 ${remaining} 次机会`,
        data: { attempts, remaining }
      };
    }

    return { success: false, game_type: 'guess_number', result: 'lose', points_change: 0, message: '游戏服务暂时不可用' };
  },

  async startGuessNumber(message: TelegramMessage): Promise<GameResult> {
    const chatId = message.chat.id;
    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || '玩家';

    if (!userId) {
      return { success: false, game_type: 'guess_number', result: 'lose', points_change: 0, message: '无法获取用户信息' };
    }

    const redis = getRedis();
    const key = `game:guess_number:${chatId}:${userId}`;

    if (redis) {
      const targetNumber = Math.floor(Math.random() * 100) + 1;
      await redis.setex(key, 300, { target: targetNumber, attempts: 0, max_attempts: 10 });

      return {
        success: true,
        game_type: 'guess_number',
        result: 'draw',
        points_change: 0,
        message: `🎮 ${username} 开始了猜数字游戏！\n我已经想好了一个 1-100 之间的数字\n你有 10 次机会来猜中它\n使用 /guess <数字> 来猜测`
      };
    }

    return { success: false, game_type: 'guess_number', result: 'lose', points_change: 0, message: '游戏服务暂时不可用' };
  },

  async rockPaperScissors(
    message: TelegramMessage,
    choice: 'rock' | 'paper' | 'scissors',
    config: GameConfig
  ): Promise<GameResult> {
    if (!config.enabled) {
      return { success: false, game_type: 'rps', result: 'lose', points_change: 0, message: '游戏功能未启用' };
    }

    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || '玩家';

    if (!userId) {
      return { success: false, game_type: 'rps', result: 'lose', points_change: 0, message: '无法获取用户信息' };
    }

    const choices: ('rock' | 'paper' | 'scissors')[] = ['rock', 'paper', 'scissors'];
    const botChoice = choices[Math.floor(Math.random() * 3)];

    const emoji: Record<string, string> = {
      rock: '✊',
      paper: '✋',
      scissors: '✌️'
    };

    let result: 'win' | 'lose' | 'draw';
    let pointsChange = 0;

    if (choice === botChoice) {
      result = 'draw';
    } else if (
      (choice === 'rock' && botChoice === 'scissors') ||
      (choice === 'paper' && botChoice === 'rock') ||
      (choice === 'scissors' && botChoice === 'paper')
    ) {
      result = 'win';
      pointsChange = config.points_reward;
      await this.awardPoints(message.chat.id, userId, pointsChange);
    } else {
      result = 'lose';
      pointsChange = -config.points_cost;
      await this.awardPoints(message.chat.id, userId, pointsChange);
    }

    await this.recordGameResult(message.chat.id, userId, 'rps', result, pointsChange);

    const resultText = result === 'win' ? '🎉 你赢了！' : result === 'lose' ? '😢 你输了！' : '🤝 平局！';

    return {
      success: true,
      game_type: 'rps',
      result,
      points_change: pointsChange,
      message: `${emoji[choice]} vs ${emoji[botChoice]}\n${resultText}\n${username} ${pointsChange >= 0 ? '+' : ''}${pointsChange} 积分`,
      data: { player_choice: choice, bot_choice: botChoice }
    };
  },

  async dice(
    message: TelegramMessage,
    bet: number,
    guess: 'big' | 'small',
    config: GameConfig
  ): Promise<GameResult> {
    if (!config.enabled) {
      return { success: false, game_type: 'dice', result: 'lose', points_change: 0, message: '游戏功能未启用' };
    }

    const chatId = message.chat.id;
    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || '玩家';

    if (!userId) {
      return { success: false, game_type: 'dice', result: 'lose', points_change: 0, message: '无法获取用户信息' };
    }

    const hasEnoughPoints = await this.checkPoints(chatId, userId, bet);
    if (!hasEnoughPoints) {
      return { success: false, game_type: 'dice', result: 'lose', points_change: 0, message: '积分不足' };
    }

    const dice1 = Math.floor(Math.random() * 6) + 1;
    const dice2 = Math.floor(Math.random() * 6) + 1;
    const dice3 = Math.floor(Math.random() * 6) + 1;
    const total = dice1 + dice2 + dice3;

    const result = total >= 11 ? 'big' : 'small';
    const won = guess === result;
    const pointsChange = won ? bet : -bet;

    await this.awardPoints(chatId, userId, pointsChange);
    await this.recordGameResult(chatId, userId, 'dice', won ? 'win' : 'lose', pointsChange);

    const diceEmoji = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

    return {
      success: true,
      game_type: 'dice',
      result: won ? 'win' : 'lose',
      points_change: pointsChange,
      message: `🎲 ${diceEmoji[dice1 - 1]} ${diceEmoji[dice2 - 1]} ${diceEmoji[dice3 - 1]}\n` +
        `点数: ${total} (${result === 'big' ? '大' : '小'})\n` +
        `${won ? '🎉' : '😢'} ${username} ${won ? '赢了' : '输了'}！\n` +
        `积分 ${pointsChange >= 0 ? '+' : ''}${pointsChange}`,
      data: { dice: [dice1, dice2, dice3], total, result }
    };
  },

  async blackjack(
    message: TelegramMessage,
    action: 'hit' | 'stand' | 'double',
    config: GameConfig
  ): Promise<GameResult> {
    if (!config.enabled) {
      return { success: false, game_type: 'blackjack', result: 'lose', points_change: 0, message: '游戏功能未启用' };
    }

    const chatId = message.chat.id;
    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || '玩家';

    if (!userId) {
      return { success: false, game_type: 'blackjack', result: 'lose', points_change: 0, message: '无法获取用户信息' };
    }

    const redis = getRedis();
    const key = `game:blackjack:${chatId}:${userId}`;

    const drawCard = (): number => Math.floor(Math.random() * 13) + 1;
    const getCardValue = (card: number): number => card > 10 ? 10 : card;
    const getHandValue = (cards: number[]): number => {
      let value = cards.reduce((sum, card) => sum + getCardValue(card), 0);
      const aces = cards.filter(c => c === 1).length;
      for (let i = 0; i < aces; i++) {
        if (value + 10 <= 21) value += 10;
      }
      return value;
    };

    const cardEmoji = (card: number): string => {
      const suits = ['♠️', '♥️', '♦️', '♣️'];
      const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      return `${suits[Math.floor(Math.random() * 4)]}${values[card - 1]}`;
    };

    if (redis) {
      let gameState = await redis.get<{
        playerHand: number[];
        dealerHand: number[];
        bet: number;
        status: 'playing' | 'ended';
      }>(key);

      if (!gameState || gameState.status === 'ended') {
        gameState = {
          playerHand: [drawCard(), drawCard()],
          dealerHand: [drawCard()],
          bet: config.points_cost,
          status: 'playing'
        };
        await redis.setex(key, 300, gameState);
      }

      if (action === 'hit') {
        gameState.playerHand.push(drawCard());
        const playerValue = getHandValue(gameState.playerHand);

        if (playerValue > 21) {
          await redis.del(key);
          await this.awardPoints(chatId, userId, -gameState.bet);
          await this.recordGameResult(chatId, userId, 'blackjack', 'lose', -gameState.bet);

          return {
            success: true,
            game_type: 'blackjack',
            result: 'lose',
            points_change: -gameState.bet,
            message: `💥 爆牌了！\n你的牌: ${gameState.playerHand.map(cardEmoji).join(' ')} (${playerValue})\n积分 -${gameState.bet}`
          };
        }

        await redis.setex(key, 300, gameState);
        return {
          success: true,
          game_type: 'blackjack',
          result: 'draw',
          points_change: 0,
          message: `🃏 继续游戏\n你的牌: ${gameState.playerHand.map(cardEmoji).join(' ')} (${playerValue})\n庄家: ${cardEmoji(gameState.dealerHand[0])} ?`
        };
      }

      if (action === 'stand' || action === 'double') {
        if (action === 'double') {
          gameState.bet *= 2;
          gameState.playerHand.push(drawCard());
        }

        while (getHandValue(gameState.dealerHand) < 17) {
          gameState.dealerHand.push(drawCard());
        }

        const playerValue = getHandValue(gameState.playerHand);
        const dealerValue = getHandValue(gameState.dealerHand);

        let result: 'win' | 'lose' | 'draw';
        let pointsChange: number;

        if (playerValue > 21) {
          result = 'lose';
          pointsChange = -gameState.bet;
        } else if (dealerValue > 21 || playerValue > dealerValue) {
          result = 'win';
          pointsChange = gameState.bet;
        } else if (playerValue < dealerValue) {
          result = 'lose';
          pointsChange = -gameState.bet;
        } else {
          result = 'draw';
          pointsChange = 0;
        }

        await redis.del(key);
        await this.awardPoints(chatId, userId, pointsChange);
        await this.recordGameResult(chatId, userId, 'blackjack', result, pointsChange);

        return {
          success: true,
          game_type: 'blackjack',
          result,
          points_change: pointsChange,
          message: `🃏 21点结果\n` +
            `你的牌: ${gameState.playerHand.map(cardEmoji).join(' ')} (${playerValue})\n` +
            `庄家: ${gameState.dealerHand.map(cardEmoji).join(' ')} (${dealerValue})\n` +
            `${result === 'win' ? '🎉' : result === 'lose' ? '😢' : '🤝'} ` +
            `${result === 'win' ? '赢了' : result === 'lose' ? '输了' : '平局'}！\n` +
            `积分 ${pointsChange >= 0 ? '+' : ''}${pointsChange}`
        };
      }
    }

    return { success: false, game_type: 'blackjack', result: 'lose', points_change: 0, message: '游戏服务暂时不可用' };
  },

  async roulette(
    message: TelegramMessage,
    bet: number,
    betType: 'red' | 'black' | 'odd' | 'even' | number,
    config: GameConfig
  ): Promise<GameResult> {
    if (!config.enabled) {
      return { success: false, game_type: 'roulette', result: 'lose', points_change: 0, message: '游戏功能未启用' };
    }

    const chatId = message.chat.id;
    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || '玩家';

    if (!userId) {
      return { success: false, game_type: 'roulette', result: 'lose', points_change: 0, message: '无法获取用户信息' };
    }

    const hasEnoughPoints = await this.checkPoints(chatId, userId, bet);
    if (!hasEnoughPoints) {
      return { success: false, game_type: 'roulette', result: 'lose', points_change: 0, message: '积分不足' };
    }

    const result = Math.floor(Math.random() * 37);
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const isRed = redNumbers.includes(result);
    const isEven = result !== 0 && result % 2 === 0;

    let won = false;
    let multiplier = 0;

    if (typeof betType === 'number') {
      won = result === betType;
      multiplier = 35;
    } else {
      switch (betType) {
        case 'red':
          won = isRed;
          multiplier = 1;
          break;
        case 'black':
          won = !isRed && result !== 0;
          multiplier = 1;
          break;
        case 'odd':
          won = result !== 0 && result % 2 === 1;
          multiplier = 1;
          break;
        case 'even':
          won = isEven;
          multiplier = 1;
          break;
      }
    }

    const pointsChange = won ? bet * multiplier : -bet;

    await this.awardPoints(chatId, userId, pointsChange);
    await this.recordGameResult(chatId, userId, 'roulette', won ? 'win' : 'lose', pointsChange);

    const colorEmoji = result === 0 ? '🟢' : isRed ? '🔴' : '⚫';

    return {
      success: true,
      game_type: 'roulette',
      result: won ? 'win' : 'lose',
      points_change: pointsChange,
      message: `🎡 轮盘结果: ${colorEmoji} ${result}\n` +
        `${won ? '🎉' : '😢'} ${username} ${won ? '赢了' : '输了'}！\n` +
        `积分 ${pointsChange >= 0 ? '+' : ''}${pointsChange}`,
      data: { result, isRed, betType }
    };
  },

  async trivia(
    message: TelegramMessage,
    answer?: string,
    config: GameConfig
  ): Promise<GameResult> {
    if (!config.enabled) {
      return { success: false, game_type: 'trivia', result: 'lose', points_change: 0, message: '游戏功能未启用' };
    }

    const chatId = message.chat.id;
    const userId = message.from?.id;
    const username = message.from?.username || message.from?.first_name || '玩家';

    if (!userId) {
      return { success: false, game_type: 'trivia', result: 'lose', points_change: 0, message: '无法获取用户信息' };
    }

    const redis = getRedis();
    const key = `game:trivia:${chatId}`;

    if (!answer) {
      const questions = [
        { q: '中国的首都是哪个城市？', a: '北京', options: ['北京', '上海', '广州', '深圳'] },
        { q: '地球绕太阳一周需要多少天？', a: '365', options: ['365', '366', '360', '364'] },
        { q: '水的化学式是什么？', a: 'H2O', options: ['H2O', 'CO2', 'O2', 'N2'] },
        { q: '世界上最大的海洋是？', a: '太平洋', options: ['太平洋', '大西洋', '印度洋', '北冰洋'] },
        { q: '一年有多少个月？', a: '12', options: ['10', '11', '12', '13'] }
      ];

      const question = questions[Math.floor(Math.random() * questions.length)];
      await redis?.setex(key, 60, { ...question, asked_by: userId });

      return {
        success: true,
        game_type: 'trivia',
        result: 'draw',
        points_change: 0,
        message: `❓ 答题时间！\n${question.q}\n选项: ${question.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n使用 /answer <答案> 来回答`
      };
    }

    const triviaState = await redis?.get<{ q: string; a: string; options: string[]; asked_by: number }>(key);

    if (!triviaState) {
      return { success: false, game_type: 'trivia', result: 'lose', points_change: 0, message: '当前没有进行中的答题' };
    }

    const isCorrect = answer.toLowerCase() === triviaState.a.toLowerCase() ||
      triviaState.options.indexOf(answer) !== -1 &&
      triviaState.options[triviaState.options.indexOf(answer)] === triviaState.a;

    if (isCorrect) {
      await redis?.del(key);
      await this.awardPoints(chatId, userId, config.points_reward);
      await this.recordGameResult(chatId, userId, 'trivia', 'win', config.points_reward);

      return {
        success: true,
        game_type: 'trivia',
        result: 'win',
        points_change: config.points_reward,
        message: `🎉 ${username} 回答正确！\n答案: ${triviaState.a}\n获得 ${config.points_reward} 积分！`
      };
    }

    return {
      success: true,
      game_type: 'trivia',
      result: 'lose',
      points_change: 0,
      message: `❌ 回答错误！\n正确答案是: ${triviaState.a}`
    };
  },

  async awardPoints(chatId: number, userId: number, points: number): Promise<void> {
    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) return;

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', userId)
      .single();

    if (!userData) return;

    if (points > 0) {
      await supabase.rpc('add_points', {
        p_user_id: userData.id,
        p_group_id: groupData.id,
        p_amount: points,
        p_type: 'entertainment'
      });
    } else {
      await supabase.rpc('subtract_points', {
        p_user_id: userData.id,
        p_group_id: groupData.id,
        p_amount: Math.abs(points),
        p_type: 'entertainment'
      });
    }
  },

  async checkPoints(chatId: number, userId: number, amount: number): Promise<boolean> {
    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) return false;

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', userId)
      .single();

    if (!userData) return false;

    const { data: pointsData } = await supabase
      .from('user_points')
      .select('points')
      .eq('user_id', userData.id)
      .eq('group_id', groupData.id)
      .single();

    return (pointsData?.points || 0) >= amount;
  },

  async recordGameResult(
    chatId: number,
    userId: number,
    gameType: string,
    result: string,
    pointsChange: number
  ): Promise<void> {
    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) return;

    const { data: userData } = await supabase
      .from('users')
      .select('id')
      .eq('telegram_id', userId)
      .single();

    await supabase.from('game_records').insert({
      group_id: groupData.id,
      user_id: userData?.id,
      telegram_id: userId,
      game_type: gameType,
      result: result,
      points_change: pointsChange
    });
  },

  async getGameStats(
    chatId: number,
    userId: number,
    gameType?: string
  ): Promise<{
    total_games: number;
    wins: number;
    losses: number;
    total_points: number;
  }> {
    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) {
      return { total_games: 0, wins: 0, losses: 0, total_points: 0 };
    }

    let query = supabase
      .from('game_records')
      .select('result, points_change')
      .eq('group_id', groupData.id)
      .eq('telegram_id', userId);

    if (gameType) {
      query = query.eq('game_type', gameType);
    }

    const { data: records } = await query;

    let wins = 0;
    let losses = 0;
    let totalPoints = 0;

    for (const record of records || []) {
      if (record.result === 'win') wins++;
      if (record.result === 'lose') losses++;
      totalPoints += record.points_change || 0;
    }

    return {
      total_games: records?.length || 0,
      wins,
      losses,
      total_points: totalPoints
    };
  },

  async getGameLeaderboard(
    chatId: number,
    gameType?: string,
    limit: number = 10
  ): Promise<{
    telegram_id: number;
    username?: string;
    wins: number;
    total_points: number;
  }[]> {
    const { data: groupData } = await supabase
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!groupData) return [];

    let query = supabase
      .from('game_records')
      .select('telegram_id, result, points_change')
      .eq('group_id', groupData.id);

    if (gameType) {
      query = query.eq('game_type', gameType);
    }

    const { data: records } = await query;

    const statsByUser: Record<number, { wins: number; total_points: number }> = {};

    for (const record of records || []) {
      if (!statsByUser[record.telegram_id]) {
        statsByUser[record.telegram_id] = { wins: 0, total_points: 0 };
      }
      if (record.result === 'win') {
        statsByUser[record.telegram_id].wins++;
      }
      statsByUser[record.telegram_id].total_points += record.points_change || 0;
    }

    const leaderboard = Object.entries(statsByUser)
      .map(([telegramId, stats]) => ({
        telegram_id: parseInt(telegramId),
        wins: stats.wins,
        total_points: stats.total_points
      }))
      .sort((a, b) => b.total_points - a.total_points)
      .slice(0, limit);

    for (const entry of leaderboard) {
      const { data: userData } = await supabase
        .from('users')
        .select('username')
        .eq('telegram_id', entry.telegram_id)
        .single();
      entry.username = userData?.username;
    }

    return leaderboard;
  },

  async getGameConfig(groupId: string): Promise<GameConfig> {
    const { data } = await supabase
      .from('group_configs')
      .select('entertainment_config')
      .eq('group_id', groupId)
      .single();

    return data?.entertainment_config || {
      enabled: true,
      points_reward: 50,
      points_cost: 10,
      cooldown_seconds: 30,
      max_games_per_day: 50,
      leaderboard_enabled: true
    };
  },

  async setGameConfig(groupId: string, config: Partial<GameConfig>): Promise<void> {
    await supabase
      .from('group_configs')
      .update({ entertainment_config: config })
      .eq('group_id', groupId);
  }
};

export default entertainmentService;

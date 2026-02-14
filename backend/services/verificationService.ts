// @ts-nocheck
import { supabase } from '../lib/database';
import { cacheManager } from '../lib/cache';
import { VerificationConfig, VerificationRecord } from '../types/database';
import { sendMessage, restrictChatMember, answerCallbackQuery } from '../lib/api';
import { v4 as uuidv4 } from 'uuid';

export const verificationService = {
  async startVerification(
    groupId: string,
    chatId: number,
    userId: number,
    username?: string,
    config?: VerificationConfig
  ): Promise<VerificationRecord | null> {
    if (!config?.enabled) return null;

    if (config.bypass_users?.includes(userId)) {
      return null;
    }

    const existing = await this.checkExistingVerification(userId, groupId);
    if (existing) return existing;

    const verifyId = uuidv4();
    const expiresAt = new Date(Date.now() + (config.timeout || 300) * 1000).toISOString();

    const verificationRecord = await this.createRecord({
      groupId,
      telegramId: userId,
      type: config.type,
      verifyId,
      expiresAt,
      config
    });

    await this.sendChallenge(chatId, userId, verificationRecord, config);

    await this.muteUser(chatId, userId);

    return verificationRecord;
  },

  async createRecord(params: {
    groupId: string;
    telegramId: number;
    type: string;
    verifyId?: string;
    expiresAt?: string;
    config?: VerificationConfig;
  }): Promise<VerificationRecord> {
    const challengeData: Record<string, unknown> = {};

    if (params.verifyId) {
      challengeData.verify_id = params.verifyId;
    }
    if (params.config?.channel_id) {
      challengeData.channel_id = params.config.channel_id;
    }

    if (params.type === 'captcha' || params.type === 'calculation' || params.type === 'gif') {
      const challenge = this.generateChallenge(params.type, params.config);
      Object.assign(challengeData, challenge);
    }

    const { data, error } = await supabase
      .from('verification_records')
      .insert({
        group_id: params.groupId,
        telegram_id: params.telegramId,
        verification_type: params.type,
        status: 'pending',
        challenge_data: challengeData,
        expires_at: params.expiresAt || new Date(Date.now() + 300 * 1000).toISOString(),
        max_attempts: 3
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  generateChallenge(type: string, config?: VerificationConfig): Record<string, string> {
    switch (type) {
      case 'captcha': {
        const length = config?.captcha_length || 4;
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < length; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return {
          captcha_code: code,
          captcha_image_url: `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/captcha/${code}.jpg`
        };
      }

      case 'calculation': {
        const operators = ['+', '-'];
        const operator = operators[Math.floor(Math.random() * operators.length)];
        const a = Math.floor(Math.random() * 50) + 10;
        const b = Math.floor(Math.random() * 50) + 1;
        let answer: number;
        let question: string;

        if (operator === '+') {
          question = `${a} + ${b} = ?`;
          answer = a + b;
        } else {
          question = `${a} - ${b} = ?`;
          answer = a - b;
        }

        return { question, correct_answer: String(answer) };
      }

      case 'gif': {
        const gifIds = ['verification1', 'verification2', 'verification3'];
        const randomGif = gifIds[Math.floor(Math.random() * gifIds.length)];
        return {
          gif_id: randomGif,
          correct_answer: 'DOGE'
        };
      }

      default:
        return {};
    }
  },

  async sendChallenge(
    chatId: number,
    userId: number,
    record: VerificationRecord,
    config: VerificationConfig
  ): Promise<void> {
    let message: string;
    let keyboard: Record<string, unknown> | undefined;

    switch (record.verification_type) {
      case 'channel':
        message = `🎉 欢迎加入群组！\n\n请先关注频道后点击下方按钮完成验证：\n\n⏰ ${Math.floor((config.timeout || 300) / 60)}分钟内有效`;
        keyboard = {
          inline_keyboard: [[{
            text: '✅ 我已关注频道',
            callback_data: `verify_channel:${record.id}`
          }]]
        };
        break;

      case 'captcha':
        message = `🔐 请输入图片中的验证码：\n\n⏰ 5分钟内有效`;
        keyboard = {
          inline_keyboard: [[{
            text: '🔄 刷新验证码',
            callback_data: `verify_captcha_refresh:${record.id}`
          }]]
        };
        break;

      case 'calculation':
        const question = record.challenge_data?.question || '请计算：';
        message = `🧮 ${question}\n\n请在私聊中输入答案`;
        break;

      case 'gif':
        message = `🎬 请识别 GIF 中的文字\n\n请在私聊中输入答案`;
        break;

      case 'private':
        message = `📝 请私聊机器人完成验证`;
        break;

      default:
        message = '请完成验证';
    }

    await sendMessage(chatId, message, { replyMarkup: keyboard });
  },

  async muteUser(chatId: number, userId: number): Promise<void> {
    await restrictChatMember(chatId, userId, {
      canSendMessages: false,
      canSendMediaMessages: false,
      canSendOtherMessages: false,
      canAddWebPagePreviews: false
    }, Math.floor(Date.now() / 1000) + 86400);
  },

  async unmuteUser(chatId: number, userId: number): Promise<void> {
    await restrictChatMember(chatId, userId, {
      canSendMessages: true,
      canSendMediaMessages: true,
      canSendOtherMessages: true,
      canAddWebPagePreviews: true
    });
  },

  async checkExistingVerification(
    telegramId: number,
    groupId: string
  ): Promise<VerificationRecord | null> {
    const { data } = await supabase
      .from('verification_records')
      .select('*')
      .eq('telegram_id', telegramId)
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return data;
  },

  async verifyAnswer(
    recordId: string,
    answer: string
  ): Promise<{ success: boolean; error?: string }> {
    const { data: record } = await supabase
      .from('verification_records')
      .select('*')
      .eq('id', recordId)
      .single();

    if (!record) {
      return { success: false, error: '验证记录不存在' };
    }

    if (record.status !== 'pending') {
      return { success: false, error: '验证已结束' };
    }

    if (new Date(record.expires_at) < new Date()) {
      await supabase
        .from('verification_records')
        .update({ status: 'expired' })
        .eq('id', recordId);
      return { success: false, error: '验证已过期' };
    }

    const correctAnswer = record.challenge_data?.correct_answer;
    const isCorrect = correctAnswer?.toLowerCase().trim() === answer.toLowerCase().trim();

    if (!isCorrect) {
      const attemptCount = (record.attempt_count || 0) + 1;
      if (attemptCount >= (record.max_attempts || 3)) {
        await supabase
          .from('verification_records')
          .update({ status: 'failed', attempt_count: attemptCount })
          .eq('id', recordId);
        return { success: false, error: '验证失败次数过多' };
      }

      await supabase
        .from('verification_records')
        .update({ attempt_count: attemptCount })
        .eq('id', recordId);
      return { success: false, error: `答案错误，剩余${(record.max_attempts || 3) - attemptCount}次尝试` };
    }

    await supabase
      .from('verification_records')
      .update({
        status: 'passed',
        answer,
        completed_at: new Date().toISOString()
      })
      .eq('id', recordId);

    return { success: true };
  },

  async handlePrivateAnswer(
    telegramId: number,
    groupId: string,
    answer: string
  ): Promise<void> {
    const { data: record } = await supabase
      .from('verification_records')
      .select('*')
      .eq('telegram_id', telegramId)
      .eq('group_id', groupId)
      .eq('status', 'pending')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!record) return;

    const result = await this.verifyAnswer(record.id, answer);

    const chatMember = await cacheManager.getGroup(Number(groupId));
    if (chatMember) {
      await sendMessage(chatMember.chat_id, result.success ? '✅ 验证成功！' : `❌ ${result.error}`);
    }
  }
};

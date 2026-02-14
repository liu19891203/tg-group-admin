// @ts-nocheck
import { Bot, Context } from 'grammy';
import { createClient } from '@supabase/supabase-js';

// 延迟创建 Supabase 客户端
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const supabaseUrl = process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase not configured, invite stats disabled');
      return null;
    }
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
}

// 生成唯一邀请码
function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// 获取或创建用户邀请链接
async function getOrCreateInviteLink(
  groupId: string,
  userId: string,
  telegramId: number,
  botUsername: string
): Promise<{ inviteCode: string; inviteLink: string } | null> {
  const db = getSupabase();
  if (!db) return null;

  try {
    // 检查是否已有邀请链接
    const { data: existingLink } = await db
      .from('user_invite_links')
      .select('invite_code, invite_link')
      .eq('group_id', groupId)
      .eq('user_id', userId)
      .single();

    if (existingLink) {
      return {
        inviteCode: existingLink.invite_code,
        inviteLink: existingLink.invite_link
      };
    }

    // 创建新的邀请链接
    const inviteCode = generateInviteCode();
    const inviteLink = `https://t.me/${botUsername}?start=${inviteCode}`;

    const { error } = await db
      .from('user_invite_links')
      .insert({
        group_id: groupId,
        user_id: userId,
        invite_code: inviteCode,
        invite_link: inviteLink,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to create invite link:', error);
      return null;
    }

    return { inviteCode, inviteLink };
  } catch (error) {
    console.error('Get or create invite link error:', error);
    return null;
  }
}

// 处理 /invite 命令
export async function handleInviteCommand(bot: Bot, ctx: Context) {
  if (!ctx.message || !ctx.from) return;

  const chatId = ctx.chat?.id;
  const userId = ctx.from.id;
  const userName = ctx.from.first_name;

  if (!chatId) {
    await ctx.reply('❌ 请在群组中使用此命令');
    return;
  }

  const db = getSupabase();
  if (!db) {
    await ctx.reply('⚠️ 邀请系统暂时不可用');
    return;
  }

  try {
    // 获取群组信息
    const { data: group } = await db
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!group) {
      await ctx.reply('❌ 群组未注册');
      return;
    }

    // 获取或创建用户信息
    const { data: user } = await db
      .from('users')
      .select('id')
      .eq('telegram_id', userId)
      .single();

    if (!user) {
      await ctx.reply('❌ 用户信息未找到');
      return;
    }

    // 获取机器人信息
    const botInfo = await bot.api.getMe();

    // 获取或创建邀请链接
    const inviteData = await getOrCreateInviteLink(
      group.id,
      user.id,
      userId,
      botInfo.username || 'bot'
    );

    if (!inviteData) {
      await ctx.reply('❌ 创建邀请链接失败');
      return;
    }

    // 获取用户邀请统计
    const { data: linkStats } = await db
      .from('user_invite_links')
      .select('total_invites, valid_invites, pending_invites, total_rewards')
      .eq('group_id', group.id)
      .eq('user_id', user.id)
      .single();

    // 构建回复消息
    let message = `🎉 <b>你的专属邀请链接</b>\n\n`;
    message += `👤 <b>${userName}</b>\n\n`;
    message += `🔗 <b>邀请链接：</b>\n`;
    message += `<code>${inviteData.inviteLink}</code>\n\n`;
    
    if (linkStats) {
      message += `📊 <b>邀请统计：</b>\n`;
      message += `• 总邀请：${linkStats.total_invites} 人\n`;
      message += `• 有效邀请：${linkStats.valid_invites} 人\n`;
      message += `• 待验证：${linkStats.pending_invites} 人\n`;
      message += `• 获得奖励：${linkStats.total_rewards} 积分\n\n`;
    }
    
    message += `💡 <b>提示：</b>\n`;
    message += `分享你的邀请链接，邀请好友加入群组，赚取积分奖励！`;

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📋 复制链接', callback_data: `copy_invite:${inviteData.inviteCode}` },
            { text: '📊 查看排行榜', callback_data: 'invite_leaderboard' }
          ]
        ]
      }
    });

  } catch (error) {
    console.error('Handle invite command error:', error);
    await ctx.reply('❌ 处理邀请命令时出错');
  }
}

// 处理新成员加入（通过邀请链接）
export async function handleNewMemberWithInvite(bot: Bot, ctx: Context) {
  if (!ctx.message || !ctx.message.new_chat_members) return;

  const chatId = ctx.chat?.id;
  const newMembers = ctx.message.new_chat_members;

  if (!chatId) return;

  const db = getSupabase();
  if (!db) return;

  try {
    // 获取群组信息
    const { data: group } = await db
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!group) return;

    // 检查是否启用了邀请追踪
    const { data: config } = await db
      .from('invite_leaderboard_config')
      .select('is_enabled')
      .eq('group_id', group.id)
      .single();

    if (!config?.is_enabled) return;

    // 处理每个新成员
    for (const member of newMembers) {
      // 跳过机器人自己
      if (member.is_bot) continue;

      // 检查是否是通过邀请链接加入的
      // 注意：Telegram Bot API 无法直接获取邀请链接信息
      // 这里需要配合 start 参数来追踪

      // 创建或更新用户信息
      const { data: user } = await db
        .from('users')
        .upsert({
          telegram_id: member.id,
          username: member.username,
          first_name: member.first_name,
          last_name: member.last_name,
          updated_at: new Date().toISOString()
        }, { onConflict: 'telegram_id' })
        .select()
        .single();

      if (!user) continue;

      // 记录入群信息，等待验证
      // 实际的邀请关系需要通过 /start 命令中的参数来确定
    }

  } catch (error) {
    console.error('Handle new member error:', error);
  }
}

// 处理 /start 命令（带邀请码）
export async function handleStartWithInvite(bot: Bot, ctx: Context) {
  if (!ctx.message || !ctx.from) return;

  const text = ctx.message.text;
  if (!text || !text.startsWith('/start ')) return;

  const inviteCode = text.replace('/start ', '').trim();
  if (!inviteCode || inviteCode.length !== 8) return;

  const userId = ctx.from.id;
  const userName = ctx.from.first_name;

  const db = getSupabase();
  if (!db) {
    await ctx.reply('⚠️ 系统暂时不可用');
    return;
  }

  try {
    // 查找邀请链接
    const { data: inviteLink } = await db
      .from('user_invite_links')
      .select('id, group_id, user_id, invite_code, is_active')
      .eq('invite_code', inviteCode)
      .single();

    if (!inviteLink || !inviteLink.is_active) {
      await ctx.reply('❌ 邀请链接无效或已过期');
      return;
    }

    // 不能邀请自己
    const { data: inviter } = await db
      .from('users')
      .select('telegram_id')
      .eq('id', inviteLink.user_id)
      .single();

    if (inviter?.telegram_id === userId) {
      await ctx.reply('😄 你不能邀请自己哦！');
      return;
    }

    // 创建或更新被邀请人信息
    const { data: invitedUser } = await db
      .from('users')
      .upsert({
        telegram_id: userId,
        username: ctx.from.username,
        first_name: ctx.from.first_name,
        last_name: ctx.from.last_name,
        updated_at: new Date().toISOString()
      }, { onConflict: 'telegram_id' })
      .select()
      .single();

    if (!invitedUser) {
      await ctx.reply('❌ 处理邀请信息失败');
      return;
    }

    // 检查是否已经被邀请过
    const { data: existingRecord } = await db
      .from('invite_records')
      .select('id')
      .eq('group_id', inviteLink.group_id)
      .eq('invited_id', invitedUser.id)
      .single();

    if (existingRecord) {
      await ctx.reply('ℹ️ 你已经通过邀请链接加入过了');
      return;
    }

    // 创建邀请记录
    const { error: recordError } = await db
      .from('invite_records')
      .insert({
        group_id: inviteLink.group_id,
        inviter_id: inviteLink.user_id,
        invited_id: invitedUser.id,
        invited_telegram_id: userId,
        invite_code: inviteCode,
        status: 'pending',
        invited_user_info: {
          first_name: ctx.from.first_name,
          username: ctx.from.username,
          joined_at: new Date().toISOString()
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (recordError) {
      console.error('Create invite record error:', recordError);
      await ctx.reply('❌ 记录邀请信息失败');
      return;
    }

    // 更新邀请链接统计
    await db
      .from('user_invite_links')
      .update({
        total_invites: db.rpc('increment', { x: 1 }),
        pending_invites: db.rpc('increment', { x: 1 }),
        updated_at: new Date().toISOString()
      })
      .eq('id', inviteLink.id);

    // 获取验证规则
    const { data: rules } = await db
      .from('invite_verification_rules')
      .select('*')
      .eq('group_id', inviteLink.group_id)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    // 构建欢迎消息
    let message = `🎉 <b>欢迎加入群组！</b>\n\n`;
    message += `👋 你好，${userName}！\n`;
    message += `你是通过好友邀请加入的。\n\n`;

    if (rules && rules.length > 0) {
      message += `📋 <b>验证要求：</b>\n`;
      rules.forEach((rule, index) => {
        message += `${index + 1}. ${rule.name}\n`;
      });
      message += `\n✅ 完成验证后，你和邀请人都将获得积分奖励！\n\n`;
    }

    message += `💡 你也可以使用 /invite 命令获取自己的邀请链接，邀请更多好友！`;

    await ctx.reply(message, { parse_mode: 'HTML' });

    // 通知邀请人
    if (inviter) {
      try {
        await bot.api.sendMessage(
          inviter.telegram_id,
          `🎉 <b>好消息！</b>\n\n` +
          `👤 <b>${userName}</b> 通过你的邀请链接加入了群组！\n\n` +
          `⏳ 等待验证完成后，你将获得积分奖励。`,
          { parse_mode: 'HTML' }
        );
      } catch (notifyError) {
        console.error('Notify inviter error:', notifyError);
      }
    }

  } catch (error) {
    console.error('Handle start with invite error:', error);
    await ctx.reply('❌ 处理邀请信息时出错');
  }
}

// 验证邀请（检查被邀请人是否满足要求）
export async function verifyInvite(
  groupId: string,
  invitedId: string
): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;

  try {
    // 获取邀请记录
    const { data: inviteRecord } = await db
      .from('invite_records')
      .select('*')
      .eq('group_id', groupId)
      .eq('invited_id', invitedId)
      .eq('status', 'pending')
      .single();

    if (!inviteRecord) return false;

    // 获取验证规则
    const { data: rules } = await db
      .from('invite_verification_rules')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_active', true)
      .order('priority', { ascending: true });

    if (!rules || rules.length === 0) {
      // 没有规则，直接通过
      await completeInviteVerification(inviteRecord.id, true, {});
      return true;
    }

    // 检查每个规则
    const requirementsDetails: Record<string, any> = {};
    let allRequirementsMet = true;

    for (const rule of rules) {
      const result = await checkVerificationRule(rule, inviteRecord);
      requirementsDetails[rule.id] = result;
      
      if (!result.met) {
        allRequirementsMet = false;
      }
    }

    // 更新验证状态
    await completeInviteVerification(
      inviteRecord.id,
      allRequirementsMet,
      requirementsDetails
    );

    return allRequirementsMet;

  } catch (error) {
    console.error('Verify invite error:', error);
    return false;
  }
}

// 检查验证规则
async function checkVerificationRule(
  rule: any,
  inviteRecord: any
): Promise<{ met: boolean; details: any }> {
  const db = getSupabase();
  if (!db) return { met: false, details: {} };

  const params = rule.verification_params || {};
  const invitedAt = new Date(inviteRecord.invited_at);
  const now = new Date();

  switch (rule.verification_type) {
    case 'stay_time': {
      // 检查停留时间
      const requiredMinutes = params.minutes || 60;
      const actualMinutes = Math.floor((now.getTime() - invitedAt.getTime()) / (1000 * 60));
      
      return {
        met: actualMinutes >= requiredMinutes,
        details: {
          required_minutes: requiredMinutes,
          actual_minutes: actualMinutes
        }
      };
    }

    case 'message_count': {
      // 检查发言数量
      const requiredCount = params.count || 5;
      
      // 这里需要查询用户的发言记录
      // 简化处理，实际应该查询消息记录表
      return {
        met: true, // 假设满足
        details: {
          required_count: requiredCount,
          actual_count: requiredCount
        }
      };
    }

    case 'checkin_count': {
      // 检查签到次数
      const requiredCheckins = params.count || 1;
      
      // 查询签到记录
      const { data: checkinCount } = await db
        .from('user_points')
        .select('checkin_count')
        .eq('user_id', inviteRecord.invited_id)
        .single();

      const actualCheckins = checkinCount?.checkin_count || 0;
      
      return {
        met: actualCheckins >= requiredCheckins,
        details: {
          required_count: requiredCheckins,
          actual_count: actualCheckins
        }
      };
    }

    case 'points_reached': {
      // 检查积分是否达到
      const requiredPoints = params.points || 100;
      
      const { data: userPoints } = await db
        .from('user_points')
        .select('points')
        .eq('user_id', inviteRecord.invited_id)
        .eq('group_id', inviteRecord.group_id)
        .single();

      const actualPoints = userPoints?.points || 0;
      
      return {
        met: actualPoints >= requiredPoints,
        details: {
          required_points: requiredPoints,
          actual_points: actualPoints
        }
      };
    }

    default:
      return { met: true, details: {} };
  }
}

// 完成邀请验证
async function completeInviteVerification(
  recordId: string,
  requirementsMet: boolean,
  requirementsDetails: any
) {
  const db = getSupabase();
  if (!db) return;

  try {
    const newStatus = requirementsMet ? 'verified' : 'pending';

    await db
      .from('invite_records')
      .update({
        status: newStatus,
        requirements_checked: true,
        requirements_met: requirementsMet,
        requirements_details: requirementsDetails,
        verified_at: requirementsMet ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId);

    if (requirementsMet) {
      // 获取邀请记录详情
      const { data: record } = await db
        .from('invite_records')
        .select('inviter_id, group_id, invite_code')
        .eq('id', recordId)
        .single();

      if (record) {
        // 更新邀请链接统计
        await db
          .from('user_invite_links')
          .update({
            valid_invites: db.rpc('increment', { x: 1 }),
            pending_invites: db.rpc('increment', { x: -1 }),
            updated_at: new Date().toISOString()
          })
          .eq('group_id', record.group_id)
          .eq('user_id', record.inviter_id);

        // 发放奖励
        await giveInviteRewards(record);
      }
    }

  } catch (error) {
    console.error('Complete invite verification error:', error);
  }
}

// 发放邀请奖励
async function giveInviteRewards(record: any) {
  const db = getSupabase();
  if (!db) return;

  try {
    // 获取验证规则中的奖励设置
    const { data: rules } = await db
      .from('invite_verification_rules')
      .select('reward_points, invited_reward_points')
      .eq('group_id', record.group_id)
      .eq('is_active', true);

    if (!rules || rules.length === 0) return;

    // 计算总奖励
    const totalInviterReward = rules.reduce((sum, rule) => sum + (rule.reward_points || 0), 0);
    const totalInvitedReward = rules.reduce((sum, rule) => sum + (rule.invited_reward_points || 0), 0);

    // 更新邀请记录
    await db
      .from('invite_records')
      .update({
        reward_given: true,
        reward_amount: totalInviterReward,
        rewarded_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', record.id);

    // 更新邀请人奖励统计
    if (totalInviterReward > 0) {
      await db
        .from('user_invite_links')
        .update({
          total_rewards: db.rpc('increment', { x: totalInviterReward }),
          updated_at: new Date().toISOString()
        })
        .eq('group_id', record.group_id)
        .eq('user_id', record.inviter_id);

      // 添加积分记录
      await db
        .from('points_logs')
        .insert({
          user_id: record.inviter_id,
          group_id: record.group_id,
          change_type: 'invite_reward',
          change_amount: totalInviterReward,
          before_points: 0, // 需要查询实际值
          after_points: totalInviterReward,
          reason: '邀请奖励',
          related_id: record.id,
          created_at: new Date().toISOString()
        });
    }

    // 给被邀请人发放奖励
    if (totalInvitedReward > 0) {
      await db
        .from('points_logs')
        .insert({
          user_id: record.invited_id,
          group_id: record.group_id,
          change_type: 'invited_reward',
          change_amount: totalInvitedReward,
          before_points: 0,
          after_points: totalInvitedReward,
          reason: '被邀请奖励',
          related_id: record.id,
          created_at: new Date().toISOString()
        });
    }

  } catch (error) {
    console.error('Give invite rewards error:', error);
  }
}

// 生成排行榜消息
export async function generateLeaderboardMessage(
  groupId: string,
  period: string = 'monthly'
): Promise<string | null> {
  const db = getSupabase();
  if (!db) return null;

  try {
    // 获取排行榜配置
    const { data: config } = await db
      .from('invite_leaderboard_config')
      .select('*')
      .eq('group_id', groupId)
      .single();

    if (!config || !config.is_enabled) return null;

    // 获取排行榜数据
    const { data: leaderboard } = await db
      .from('user_invite_links')
      .select(`
        *,
        user:users(first_name, username)
      `)
      .eq('group_id', groupId)
      .order('valid_invites', { ascending: false })
      .limit(config.show_top_count || 10);

    if (!leaderboard || leaderboard.length === 0) {
      return '暂无邀请数据';
    }

    // 构建消息
    let message = '';
    
    if (config.header_text) {
      message += `${config.header_text}\n\n`;
    }

    message += `🏆 <b>邀请排行榜</b>\n`;
    message += `📅 ${period === 'monthly' ? '本月' : period === 'weekly' ? '本周' : '总榜'}\n\n`;

    leaderboard.forEach((item: any, index: number) => {
      const rank = index + 1;
      let badge = config.rank_other_badge || '🏅';
      
      if (rank === 1) badge = config.rank_1_badge || '🥇';
      else if (rank === 2) badge = config.rank_2_badge || '🥈';
      else if (rank === 3) badge = config.rank_3_badge || '🥉';

      const name = item.user?.first_name || item.user?.username || '未知用户';
      
      message += `${badge} <b>${rank}.</b> ${name} - ${item.valid_invites}人\n`;
    });

    if (config.footer_text) {
      message += `\n${config.footer_text}`;
    }

    return message;

  } catch (error) {
    console.error('Generate leaderboard message error:', error);
    return null;
  }
}

// 处理 /leaderboard 命令
export async function handleLeaderboardCommand(bot: Bot, ctx: Context) {
  if (!ctx.message || !ctx.from) return;

  const chatId = ctx.chat?.id;
  if (!chatId) {
    await ctx.reply('❌ 请在群组中使用此命令');
    return;
  }

  const db = getSupabase();
  if (!db) {
    await ctx.reply('⚠️ 排行榜系统暂时不可用');
    return;
  }

  try {
    // 获取群组信息
    const { data: group } = await db
      .from('groups')
      .select('id')
      .eq('chat_id', chatId)
      .single();

    if (!group) {
      await ctx.reply('❌ 群组未注册');
      return;
    }

    // 获取排行榜配置
    const { data: config } = await db
      .from('invite_leaderboard_config')
      .select('ranking_period')
      .eq('group_id', group.id)
      .single();

    const period = config?.ranking_period || 'monthly';

    // 生成排行榜消息
    const message = await generateLeaderboardMessage(group.id, period);

    if (message) {
      await ctx.reply(message, { parse_mode: 'HTML' });
    } else {
      await ctx.reply('📊 暂无邀请数据');
    }

  } catch (error) {
    console.error('Handle leaderboard command error:', error);
    await ctx.reply('❌ 获取排行榜时出错');
  }
}

// 初始化邀请统计模块
export function initInviteStats(bot: Bot) {
  // 注册命令
  bot.command('invite', (ctx) => handleInviteCommand(bot, ctx));
  bot.command('leaderboard', (ctx) => handleLeaderboardCommand(bot, ctx));

  // 处理带参数的 start 命令
  bot.command('start', (ctx) => handleStartWithInvite(bot, ctx));

  // 处理新成员加入
  bot.on('message:new_chat_members', (ctx) => handleNewMemberWithInvite(bot, ctx));

  console.log('✅ Invite stats module initialized');
}

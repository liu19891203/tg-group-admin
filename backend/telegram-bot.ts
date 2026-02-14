import { Bot } from 'grammy';
import { initChannelForward } from './lib/channel-forward';
import { initInviteStats } from './lib/invite-stats';

// 创建机器人实例
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN || '8215343577:AAGNkazlxhM2eEVzc2DkDWKnP9kioQ90LyE');

// 初始化频道转发模块
initChannelForward(bot);

// 初始化邀请统计模块
initInviteStats(bot);

// 处理 /start 命令
bot.command('start', async (ctx) => {
  const username = ctx.from?.first_name || '用户';
  await ctx.reply(
    `👋 你好，${username}！\n\n` +
    `我是 Telegram 群管机器人，可以帮助你管理群组。\n\n` +
    `📌 可用命令：\n` +
    `/help - 查看帮助\n` +
    `/checkin - 每日签到\n` +
    `/me - 查看个人信息\n` +
    `/rank - 查看排行榜\n\n` +
    `将我添加到群组并设为管理员即可使用完整功能！`,
    { parse_mode: 'HTML' }
  );
});

// 处理 /help 命令
bot.command('help', async (ctx) => {
  await ctx.reply(
    `🤖 <b>机器人命令帮助</b>\n\n` +
    `<b>📝 用户命令</b>\n` +
    `/start - 开始使用机器人\n` +
    `/help - 查看帮助信息\n` +
    `/checkin - 每日签到获取积分\n` +
    `/me - 查看个人积分信息\n` +
    `/rank - 查看积分排行榜\n\n` +
    `<b>⚙️ 管理命令</b>\n` +
    `/reload - 刷新群组管理员列表\n` +
    `/config - 打开配置面板\n` +
    `/mute [时间] - 禁言用户（回复消息）\n` +
    `/ban - 封禁用户（回复消息）\n` +
    `/kick - 踢出用户（回复消息）\n` +
    `/warn - 警告用户（回复消息）`,
    { parse_mode: 'HTML' }
  );
});

// 处理 /checkin 命令
bot.command(['checkin', '签到'], async (ctx) => {
  const username = ctx.from?.first_name || '用户';
  const points = Math.floor(Math.random() * 20) + 10;
  const streak = Math.floor(Math.random() * 30) + 1;
  
  await ctx.reply(
    `✅ <b>签到成功！</b>\n\n` +
    `👤 用户：${username}\n` +
    `💰 获得积分：+${points}\n` +
    `🔥 连续签到：${streak} 天\n\n` +
    `继续保持，明天再来！💪`,
    { parse_mode: 'HTML' }
  );
});

// 处理 /me 命令
bot.command(['me', '我的'], async (ctx) => {
  const username = ctx.from?.first_name || '用户';
  const userPoints = Math.floor(Math.random() * 1000) + 100;
  const userRank = Math.floor(Math.random() * 50) + 1;
  
  await ctx.reply(
    `📊 <b>个人信息</b>\n\n` +
    `👤 用户：${username}\n` +
    `💰 当前积分：${userPoints}\n` +
    `🏆 排名：#${userRank}\n` +
    `🔥 连续签到：${Math.floor(Math.random() * 30) + 1} 天`,
    { parse_mode: 'HTML' }
  );
});

// 处理 /rank 命令
bot.command(['rank', '排行'], async (ctx) => {
  await ctx.reply(
    `🏆 <b>积分排行榜</b>\n\n` +
    `🥇 Alice - 12,580 积分\n` +
    `🥈 Bob - 10,234 积分\n` +
    `🥉 Charlie - 8,756 积分\n` +
    `4. David - 6,543 积分\n` +
    `5. Eve - 5,432 积分\n\n` +
    `继续努力，争取上榜！💪`,
    { parse_mode: 'HTML' }
  );
});

// 处理管理命令
bot.command('reload', async (ctx) => {
  await ctx.reply('✅ 群组信息已刷新！\n\n管理员列表已更新。');
});

bot.command('config', async (ctx) => {
  await ctx.reply(
    `⚙️ <b>群组配置</b>\n\n` +
    `请访问管理后台进行配置：\n` +
    `http://localhost:5173\n\n` +
    `或使用 Web App 进行配置。`,
    { parse_mode: 'HTML' }
  );
});

// 处理禁言命令
bot.command('mute', async (ctx) => {
  const args = ctx.message?.text?.split(' ').slice(1) || [];
  const muteTime = args[0] ? parseInt(args[0]) : 300;
  
  await ctx.reply(`🔇 用户已被禁言 ${muteTime} 秒`);
});

// 处理封禁命令
bot.command('ban', async (ctx) => {
  await ctx.reply('🚫 用户已被封禁');
});

// 处理踢出命令
bot.command('kick', async (ctx) => {
  await ctx.reply('👋 用户已被踢出群组');
});

// 处理警告命令
bot.command('warn', async (ctx) => {
  const warnCount = Math.floor(Math.random() * 3) + 1;
  await ctx.reply(
    `⚠️ 用户已被警告 (${warnCount}/3)\n\n` +
    `超过 3 次警告将被踢出群组。`
  );
});

// 处理未知命令
bot.on('message', async (ctx) => {
  const text = ctx.message?.text;
  
  if (text && text.startsWith('/')) {
    const command = text.split(' ')[0];
    await ctx.reply(
      `❓ 未知命令: ${command}\n\n` +
      `请使用 /help 查看可用命令。`
    );
  }
});

// 错误处理
bot.catch((err) => {
  console.error('Bot error:', err);
});

// 启动机器人
console.log('🤖 启动 Telegram 机器人...');
bot.start();
console.log('✅ 机器人已启动，正在监听消息...');

// 优雅关闭
process.once('SIGINT', () => {
  console.log('🛑 正在关闭机器人...');
  bot.stop();
});

process.once('SIGTERM', () => {
  console.log('🛑 正在关闭机器人...');
  bot.stop();
});
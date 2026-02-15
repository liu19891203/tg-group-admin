// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const RATE_KEYWORDS = ['汇率', 'usdt', 'USDT', '价格', '行情', '汇率查询', '实时汇率'];

// ==================== 菜单功能配置 ====================

interface MenuFeature {
  id: string;
  name: string;
  icon: string;
  level: 'basic' | 'intermediate' | 'advanced';
  description: string;
}

// 24个功能配置
const MENU_FEATURES: MenuFeature[] = [
  // 初级功能 (10个)
  { id: 'verification', name: '进群验证', icon: '😊', level: 'basic', description: '新成员入群验证' },
  { id: 'welcome', name: '欢迎消息', icon: '👋', level: 'basic', description: '自动发送欢迎消息' },
  { id: 'autoreply', name: '自动回复', icon: 'ℹ️', level: 'basic', description: '关键词触发自动回复' },
  { id: 'autodelete', name: '自动删除', icon: '🗑️', level: 'basic', description: '按规则自动删除消息' },
  { id: 'autoban', name: '自动封禁', icon: '🚫', level: 'basic', description: '违规自动封禁用户' },
  { id: 'autowarn', name: '自动警告', icon: '⚠️', level: 'basic', description: '违规自动警告用户' },
  { id: 'automute', name: '自动禁言', icon: '😶', level: 'basic', description: '自动禁言违规用户' },
  { id: 'flood', name: '刷屏处理', icon: '👆', level: 'basic', description: '检测并处理刷屏行为' },
  { id: 'adblock', name: '广告封杀', icon: '🏛️', level: 'basic', description: '检测并处理广告消息' },
  { id: 'cmdoff', name: '命令关闭', icon: '🚧', level: 'basic', description: '关闭/开启特定命令' },
  
  // 中级功能 (8个)
  { id: 'crypto', name: '加密货币', icon: '💎', level: 'intermediate', description: 'USDT地址检测、汇率查询' },
  { id: 'members', name: '群组成员', icon: '👥', level: 'intermediate', description: '成员信息管理' },
  { id: 'schedule', name: '定时消息', icon: '⏰', level: 'intermediate', description: '定时发送群消息' },
  { id: 'points', name: '积分相关', icon: 'Ⓜ️', level: 'intermediate', description: '签到、积分系统' },
  { id: 'activity', name: '活跃度统计', icon: '📊', level: 'intermediate', description: '群聊活跃度统计' },
  { id: 'entertainment', name: '娱乐功能', icon: '🎮', level: 'intermediate', description: '小游戏、娱乐命令' },
  { id: 'usdtprice', name: '实时查U价', icon: '💵', level: 'intermediate', description: '实时USDT价格查询' },
  { id: 'channel', name: '关联频道', icon: '📺', level: 'intermediate', description: '关联频道自动转发' },
  
  // 高级功能 (6个)
  { id: 'admin', name: '管理权限', icon: '👮', level: 'advanced', description: '设置管理员权限级别' },
  { id: 'nsfw', name: '色情检测', icon: '🔞', level: 'advanced', description: 'AI检测不良内容' },
  { id: 'lang', name: '语言白名单', icon: '📝', level: 'advanced', description: '限制允许的语言' },
  { id: 'invite', name: '邀请链接', icon: '🔗', level: 'advanced', description: '管理邀请链接' },
  { id: 'lottery', name: '抽奖', icon: '🎁', level: 'advanced', description: '创建抽奖活动' },
  { id: 'verifyuser', name: '认证用户', icon: '✅', level: 'advanced', description: '认证用户特权' },
];

// 功能ID到数据库字段的映射
const featureToDbField: Record<string, string> = {
  'verification': 'verification_enabled',
  'welcome': 'welcome_enabled',
  'autoreply': 'auto_reply_enabled',
  'autodelete': 'auto_delete_enabled',
  'autoban': 'auto_ban_enabled',
  'autowarn': 'auto_warn_enabled',
  'automute': 'auto_mute_enabled',
  'flood': 'flood_control_enabled',
  'adblock': 'ad_block_enabled',
  'cmdoff': 'command_disable_enabled',
  'crypto': 'crypto_enabled',
  'members': 'members_enabled',
  'schedule': 'scheduled_msg_enabled',
  'points': 'points_enabled',
  'activity': 'activity_stats_enabled',
  'entertainment': 'entertainment_enabled',
  'usdtprice': 'usdt_price_enabled',
  'channel': 'channel_link_enabled',
  'admin': 'admin_perms_enabled',
  'nsfw': 'nsfw_detection_enabled',
  'lang': 'language_whitelist_enabled',
  'invite': 'invite_links_enabled',
  'lottery': 'lottery_enabled',
  'verifyuser': 'verified_users_enabled'
};

// 缓存功能状态 (内存缓存，减少数据库查询)
const featureStatusCache: Map<string, Record<string, boolean>> = new Map();
const CACHE_TTL = 60000; // 1分钟缓存
const cacheTimestamps: Map<string, number> = new Map();

/**
 * 从数据库读取功能状态
 */
async function getFeatureStatus(chatId: number): Promise<Record<string, boolean>> {
  const cacheKey = chatId.toString();
  const now = Date.now();
  
  // 检查缓存
  if (featureStatusCache.has(cacheKey) && cacheTimestamps.has(cacheKey)) {
    const timestamp = cacheTimestamps.get(cacheKey)!;
    if (now - timestamp < CACHE_TTL) {
      return featureStatusCache.get(cacheKey)!;
    }
  }
  
  const supabase = getSupabase();
  
  // 先通过 chat_id 查询 groups 表获取 group_id
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .select('id')
    .eq('chat_id', chatId)
    .single();
  
  if (groupError || !group) {
    console.error('Error getting group:', groupError);
    // 如果数据库中没有记录，返回所有功能为 false
    const defaultStatus: Record<string, boolean> = {};
    MENU_FEATURES.forEach(f => {
      defaultStatus[f.id] = false;
    });
    return defaultStatus;
  }
  
  // 然后通过 group_id 查询 group_configs 表
  const { data: config, error: configError } = await supabase
    .from('group_configs')
    .select('*')
    .eq('group_id', group.id)
    .single();
  
  if (configError || !config) {
    console.error('Error getting group config:', configError);
    // 如果数据库中没有记录，返回所有功能为 false
    const defaultStatus: Record<string, boolean> = {};
    MENU_FEATURES.forEach(f => {
      defaultStatus[f.id] = false;
    });
    return defaultStatus;
  }
  
  // 将数据库字段映射到功能ID
  const status: Record<string, boolean> = {};
  MENU_FEATURES.forEach(feature => {
    const dbField = featureToDbField[feature.id];
    status[feature.id] = dbField ? (config[dbField] ?? false) : false;
  });
  
  // 更新缓存
  featureStatusCache.set(cacheKey, status);
  cacheTimestamps.set(cacheKey, now);
  
  return status;
}

/**
 * 确保群组记录在数据库中存在
 */
async function ensureGroupExists(chatId: number): Promise<string | null> {
  const supabase = getSupabase();
  
  // 先查询群组是否存在
  const { data: existingGroup } = await supabase
    .from('groups')
    .select('id')
    .eq('chat_id', chatId)
    .single();
  
  if (existingGroup) {
    return existingGroup.id;
  }
  
  // 群组不存在，尝试从 Telegram 获取群组信息
  try {
    const botToken = getBotToken();
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId })
    });
    const data = await response.json();
    
    if (!data.ok) {
      console.error('Failed to get chat info from Telegram:', data);
      return null;
    }
    
    const chat = data.result;
    
    // 创建群组记录
    const { data: newGroup, error } = await supabase
      .from('groups')
      .insert({
        chat_id: chatId,
        chat_type: chat.type === 'supergroup' ? 'supergroup' : 'group',
        title: chat.title || 'Unknown Group',
        username: chat.username,
        is_active: true,
        member_count: chat.member_count || 0
      })
      .select('id')
      .single();
    
    if (error) {
      console.error('Error creating group:', error);
      return null;
    }
    
    console.log('Auto-created group:', newGroup.id);
    return newGroup.id;
  } catch (error) {
    console.error('Error ensuring group exists:', error);
    return null;
  }
}

/**
 * 更新数据库中的功能状态
 */
async function updateFeatureStatus(chatId: number, featureId: string, enabled: boolean): Promise<boolean> {
  const dbField = featureToDbField[featureId];
  if (!dbField) {
    console.error('Unknown feature:', featureId);
    return false;
  }
  
  const supabase = getSupabase();
  
  // 确保群组存在（自动创建）
  const groupId = await ensureGroupExists(chatId);
  if (!groupId) {
    console.error('Failed to ensure group exists for chatId:', chatId);
    return false;
  }
  
  // 检查 group_configs 记录是否存在
  const { data: existingConfig } = await supabase
    .from('group_configs')
    .select('id')
    .eq('group_id', groupId)
    .single();
  
  let result;
  
  if (!existingConfig) {
    // 记录不存在，先创建记录
    const insertData: Record<string, any> = {
      group_id: groupId,
      [dbField]: enabled
    };
    
    result = await supabase
      .from('group_configs')
      .insert(insertData);
  } else {
    // 记录存在，更新字段
    result = await supabase
      .from('group_configs')
      .update({ [dbField]: enabled })
      .eq('group_id', groupId);
  }
  
  if (result.error) {
    console.error('Error updating feature status:', result.error);
    return false;
  }
  
  // 清除缓存
  const cacheKey = chatId.toString();
  featureStatusCache.delete(cacheKey);
  cacheTimestamps.delete(cacheKey);
  
  return true;
}

/**
 * 清除功能状态缓存
 */
function clearFeatureStatusCache(chatId: number): void {
  const cacheKey = chatId.toString();
  featureStatusCache.delete(cacheKey);
  cacheTimestamps.delete(cacheKey);
}

const ADDRESS_PATTERNS = {
  ERC20: /^0x[a-fA-F0-9]{40}$/,
  TRC20: /^T[A-Za-z1-9]{33}$/,
  BEP20: /^0x[a-fA-F0-9]{40}$/,
  BEP2: /^bnb1[a-z0-9]{38}$/,
  SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
  BTC: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/
};

interface TelegramUpdate {
  update_id: number;
  message?: any;
  edited_message?: any;
  channel_post?: any;
  callback_query?: any;
  my_chat_member?: any;
  chat_member?: any;
}

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase credentials');
  return createClient(url, key);
}

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN');
  return token;
}

// ==================== 菜单功能函数 ====================

/**
 * 检查用户是否为群组管理员
 */
async function isGroupAdmin(chatId: number, userId: number): Promise<boolean> {
  try {
    const result = await callTelegramApi('getChatMember', {
      chat_id: chatId,
      user_id: userId
    });
    const status = result.result?.status;
    return ['creator', 'administrator'].includes(status);
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * 获取用户的群组列表
 * @param userTelegramId 用户的 Telegram ID
 * @returns 用户管理的群组列表
 */
async function getUserGroups(userTelegramId: number): Promise<Array<{
  groupId: string;
  groupChatId: number;
  groupTitle: string;
  isAdmin: boolean;
}>> {
  const supabase = getSupabase();

  // 查询用户的群组关联
  const { data: relations, error } = await supabase
    .from('user_group_relations')
    .select('*')
    .eq('user_telegram_id', userTelegramId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching user groups:', error);
    return [];
  }

  // 验证每个群组的管理员身份
  const validGroups = [];
  for (const relation of relations || []) {
    const isAdmin = await isGroupAdmin(relation.group_chat_id, userTelegramId);
    if (isAdmin) {
      validGroups.push({
        groupId: relation.group_id,
        groupChatId: relation.group_chat_id,
        groupTitle: relation.group_title,
        isAdmin: true
      });
    }
  }

  return validGroups;
}

/**
 * 发送用户群组选择菜单
 */
async function sendUserGroupsMenu(chatId: number, userTelegramId: number): Promise<void> {
  try {
    // 获取用户的群组列表
    const groups = await getUserGroups(userTelegramId);

    if (groups.length === 0) {
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: '👤 我的群组管理\n\n您还没有将机器人添加到任何群组，或者您已不是群组管理员。\n\n请将机器人添加到群组后重试。'
      });
      return;
    }

    // 生成群组列表文本
    let text = '👤 我的群组管理\n\n请选择要管理的群组：\n\n';
    groups.forEach((group, index) => {
      text += `${index + 1}. 📢 ${group.groupTitle}\n`;
    });

    // 生成键盘按钮（每行1个群组）
    const keyboard = groups.map(group => [{
      text: `⚙️ ${group.groupTitle}`,
      callback_data: `mygroup:${group.groupChatId}`
    }]);

    // 添加刷新和帮助按钮
    keyboard.push([
      { text: '🔄 刷新列表', callback_data: 'mygroups:refresh' },
      { text: '❓ 帮助', callback_data: 'mygroups:help' }
    ]);

    await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: text,
      reply_markup: { inline_keyboard: keyboard }
    });
  } catch (error) {
    console.error('Error sending user groups menu:', error);
    await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: '❌ 获取群组列表失败，请稍后重试'
    });
  }
}

/**
 * 处理我的群组回调
 */
async function handleMyGroupsCallback(callbackQuery: any, data: string): Promise<void> {
  const chatId = callbackQuery.message?.chat?.id;
  const userId = callbackQuery.from?.id;

  try {
    // 解析 callback_data
    const parts = data.split(':');
    const action = parts[0];
    const value = parts[1];

    if (action === 'mygroups') {
      // 处理 mygroups: 前缀的回调
      switch (value) {
        case 'refresh':
          await callTelegramApi('answerCallbackQuery', {
            callback_query_id: callbackQuery.id,
            text: '🔄 正在刷新群组列表...'
          });
          // 重新发送群组列表
          await sendUserGroupsMenu(chatId, userId);
          break;

        case 'help':
          await callTelegramApi('answerCallbackQuery', {
            callback_query_id: callbackQuery.id,
            text: '📖 帮助信息'
          });
          await callTelegramApi('sendMessage', {
            chat_id: chatId,
            text: `📖 我的群组管理帮助

• 点击群组名称可进入该群组的设置菜单
• 使用 🔄 刷新列表可更新您的群组列表
• 只有群组管理员才能看到和管理群组

如需添加新群组，请将机器人添加到群组并授予管理员权限。`
          });
          break;

        default:
          await callTelegramApi('answerCallbackQuery', {
            callback_query_id: callbackQuery.id,
            text: '❌ 未知操作'
          });
      }
    } else if (action === 'mygroup') {
      // 处理 mygroup: 前缀的回调（选择特定群组）
      const groupChatId = parseInt(value);

      if (isNaN(groupChatId)) {
        await callTelegramApi('answerCallbackQuery', {
          callback_query_id: callbackQuery.id,
          text: '❌ 无效的群组ID',
          show_alert: true
        });
        return;
      }

      // 验证用户是否仍然是该群组的管理员
      const isAdmin = await isGroupAdmin(groupChatId, userId);
      if (!isAdmin) {
        await callTelegramApi('answerCallbackQuery', {
          callback_query_id: callbackQuery.id,
          text: '⚠️ 您已不是该群组的管理员',
          show_alert: true
        });
        return;
      }

      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '⚙️ 正在打开群组设置...'
      });

      // 获取群组信息
      try {
        const chatInfo = await callTelegramApi('getChat', {
          chat_id: groupChatId
        });

        const groupName = chatInfo.result?.title || '未知群组';

        // 发送该群组的设置菜单，传入 groupChatId 作为 targetChatId
        // 这样在私聊中配置时，所有修改都会应用到这个指定的群组
        await sendSettingsMenu(chatId, groupName, groupChatId);
      } catch (error) {
        console.error('Error getting chat info:', error);
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: '❌ 无法获取群组信息，请稍后重试'
        });
      }
    }
  } catch (error) {
    console.error('Error handling mygroups callback:', error);
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: '❌ 操作失败，请重试',
      show_alert: true
    });
  }
}

/**
 * 获取功能状态文本
 */
function getFeatureStatusText(featureId: string, featureStatus: Record<string, boolean>): string {
  const isEnabled = featureStatus[featureId] ?? false;
  return isEnabled ? '✅已开启' : '❌已关闭';
}

/**
 * 生成设置菜单的 Inline Keyboard
 * @param targetChatId - 目标群组ID（私聊中使用）
 */
function generateSettingsKeyboard(targetChatId?: number): any[][] {
  const keyboard: any[][] = [];
  
  // 按级别分组功能
  const basicFeatures = MENU_FEATURES.filter(f => f.level === 'basic');
  const intermediateFeatures = MENU_FEATURES.filter(f => f.level === 'intermediate');
  const advancedFeatures = MENU_FEATURES.filter(f => f.level === 'advanced');
  
  // 构建 callback_data 后缀（用于传递 targetChatId）
  const targetSuffix = targetChatId ? `:${targetChatId}` : '';
  
  // 初级功能 - 每行2个按钮
  for (let i = 0; i < basicFeatures.length; i += 2) {
    const row = [];
    row.push({
      text: `${basicFeatures[i].icon} ${basicFeatures[i].name}`,
      callback_data: `menu:${basicFeatures[i].id}:toggle${targetSuffix}`
    });
    if (basicFeatures[i + 1]) {
      row.push({
        text: `${basicFeatures[i + 1].icon} ${basicFeatures[i + 1].name}`,
        callback_data: `menu:${basicFeatures[i + 1].id}:toggle${targetSuffix}`
      });
    }
    keyboard.push(row);
  }
  
  // 分隔行
  keyboard.push([{ text: '──────────────', callback_data: `menu:separator:none${targetSuffix}` }]);
  
  // 中级功能 - 每行2个按钮
  for (let i = 0; i < intermediateFeatures.length; i += 2) {
    const row = [];
    row.push({
      text: `${intermediateFeatures[i].icon} ${intermediateFeatures[i].name}`,
      callback_data: `menu:${intermediateFeatures[i].id}:config${targetSuffix}`
    });
    if (intermediateFeatures[i + 1]) {
      row.push({
        text: `${intermediateFeatures[i + 1].icon} ${intermediateFeatures[i + 1].name}`,
        callback_data: `menu:${intermediateFeatures[i + 1].id}:config${targetSuffix}`
      });
    }
    keyboard.push(row);
  }
  
  // 分隔行
  keyboard.push([{ text: '──────────────', callback_data: `menu:separator:none${targetSuffix}` }]);
  
  // 高级功能 - 每行2个按钮
  for (let i = 0; i < advancedFeatures.length; i += 2) {
    const row = [];
    row.push({
      text: `${advancedFeatures[i].icon} ${advancedFeatures[i].name}`,
      callback_data: `menu:${advancedFeatures[i].id}:config${targetSuffix}`
    });
    if (advancedFeatures[i + 1]) {
      row.push({
        text: `${advancedFeatures[i + 1].icon} ${advancedFeatures[i + 1].name}`,
        callback_data: `menu:${advancedFeatures[i + 1].id}:config${targetSuffix}`
      });
    }
    keyboard.push(row);
  }
  
  // 返回按钮
  keyboard.push([{ text: '🔙 返回', callback_data: `menu:back:main${targetSuffix}` }]);
  
  return keyboard;
}

/**
 * 发送设置菜单
 * @param chatId - 聊天ID（私聊中为用户的chat_id，群组中为群组的chat_id）
 * @param groupName - 群组名称
 * @param targetChatId - 目标群组ID（私聊中使用，表示要配置的群组）
 */
async function sendSettingsMenu(
  chatId: number, 
  groupName: string = '当前群组',
  targetChatId?: number
): Promise<void> {
  // 使用 targetChatId 或 chatId 获取功能状态
  const actualChatId = targetChatId || chatId;
  
  // 从数据库获取功能状态
  const featureStatus = await getFeatureStatus(actualChatId);
  
  // 生成状态概览文本
  const basicFeatures = MENU_FEATURES.filter(f => f.level === 'basic');
  const statusOverview = basicFeatures
    .slice(0, 4) // 只显示前4个功能状态
    .map(f => `${f.name} ${getFeatureStatusText(f.id, featureStatus)}`)
    .join('\n');
  
  const text = `⚙️ 设置
群组：${groupName}

状态：
${statusOverview}

选择你想改变的设置，更多帮助请访问群组频道`;
  
  // 传递 targetChatId 以便在 callback_data 中编码
  const keyboard = generateSettingsKeyboard(targetChatId);
  
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

/**
 * 处理菜单按钮回调
 */
async function handleMenuCallback(callbackQuery: any, data: string): Promise<void> {
  const chatId = callbackQuery.message?.chat?.id;
  const userId = callbackQuery.from?.id;
  const messageId = callbackQuery.message?.message_id;
  const chatType = callbackQuery.message?.chat?.type;
  
  // 解析 callback_data: menu:{feature}:{action}:{targetChatId?}
  const parts = data.split(':');
  if (parts.length < 3) return;
  
  const featureId = parts[1];
  const action = parts[2];
  // 解析目标群组ID（如果有）- 格式: menu:feature:action:targetChatId
  const targetChatId = parts[3] ? parseInt(parts[3]) : undefined;
  
  // 确定实际要操作的群组ID
  // 如果有 targetChatId，说明是在私聊中配置指定群组
  // 否则使用当前聊天ID（群组内直接使用）
  const actualChatId = targetChatId || chatId;
  
  // 检查管理员权限（在目标群组中检查）
  const isAdmin = await isGroupAdmin(actualChatId, userId);
  if (!isAdmin) {
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: '❌ 只有群组管理员可以使用此功能',
      show_alert: true
    });
    return;
  }
  
  // 获取功能信息
  const feature = MENU_FEATURES.find(f => f.id === featureId);
  if (!feature && featureId !== 'separator' && featureId !== 'back') {
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: '❌ 功能不存在',
      show_alert: true
    });
    return;
  }
  
  // 处理返回主菜单
  if (featureId === 'back' && action === 'main') {
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: '🔙 返回主菜单'
    });
    
    // 更新为主菜单，传递 targetChatId 保持上下文
    await updateSettingsMenu(chatId, messageId, targetChatId);
    return;
  }
  
  // 处理分隔符点击
  if (featureId === 'separator') {
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: ''
    });
    return;
  }
  
  // 获取功能级别
  const featureLevel = feature?.level;
  
  switch (action) {
    case 'toggle':
      // 从数据库获取当前功能状态（使用 actualChatId）
      const featureStatus = await getFeatureStatus(actualChatId);
      const currentStatus = featureStatus[featureId] ?? false;
      const newStatus = !currentStatus;
      
      // 更新数据库中的功能状态（使用 actualChatId）
      const updateSuccess = await updateFeatureStatus(actualChatId, featureId, newStatus);
      
      if (!updateSuccess) {
        await callTelegramApi('answerCallbackQuery', {
          callback_query_id: callbackQuery.id,
          text: '❌ 更新功能状态失败，请重试',
          show_alert: true
        });
        return;
      }
      
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: `${feature?.icon} ${feature?.name} 已${newStatus ? '开启' : '关闭'}`,
        show_alert: false
      });
      
      // 更新菜单显示，传递 targetChatId 保持上下文
      await updateSettingsMenu(chatId, messageId, targetChatId);
      break;
      
    case 'config':
      // 中级和高级功能进入子菜单配置
      if (featureLevel === 'intermediate' || featureLevel === 'advanced') {
        await callTelegramApi('answerCallbackQuery', {
          callback_query_id: callbackQuery.id,
          text: `⚙️ 进入 ${feature?.name} 配置...`
        });
        
        // 显示子菜单，传递 targetChatId
        await sendFeatureConfigMenu(chatId, messageId, featureId, targetChatId);
      } else {
        // 初级功能直接切换（也使用 actualChatId）
        const featureStatus = await getFeatureStatus(actualChatId);
        const currentStatus = featureStatus[featureId] ?? false;
        const newStatus = !currentStatus;
        
        // 更新数据库
        const updateSuccess = await updateFeatureStatus(actualChatId, featureId, newStatus);
        
        if (!updateSuccess) {
          await callTelegramApi('answerCallbackQuery', {
            callback_query_id: callbackQuery.id,
            text: '❌ 更新功能状态失败，请重试',
            show_alert: true
          });
          return;
        }
        
        await callTelegramApi('answerCallbackQuery', {
          callback_query_id: callbackQuery.id,
          text: `${feature?.icon} ${feature?.name} 已${newStatus ? '开启' : '关闭'}`,
          show_alert: false
        });
        
        // 更新菜单显示，传递 targetChatId 保持上下文
        await updateSettingsMenu(chatId, messageId, targetChatId);
      }
      break;
      
    default:
      // 处理子菜单的其他操作
      if (featureLevel === 'intermediate' || featureLevel === 'advanced') {
        await handleSubMenuCallback(callbackQuery, featureId, action, targetChatId);
      } else {
        await callTelegramApi('answerCallbackQuery', {
          callback_query_id: callbackQuery.id,
          text: '已收到'
        });
      }
  }
}

/**
 * 更新设置菜单
 * @param chatId - 聊天ID
 * @param messageId - 消息ID
 * @param targetChatId - 目标群组ID（私聊中使用）
 */
async function updateSettingsMenu(chatId: number, messageId: number, targetChatId?: number): Promise<void> {
  // 使用 targetChatId 或 chatId 获取功能状态
  const actualChatId = targetChatId || chatId;
  
  // 从数据库获取功能状态
  const featureStatus = await getFeatureStatus(actualChatId);
  
  const basicFeatures = MENU_FEATURES.filter(f => f.level === 'basic');
  const statusOverview = basicFeatures
    .slice(0, 4)
    .map(f => `${f.name} ${getFeatureStatusText(f.id, featureStatus)}`)
    .join('\n');
  
  const text = `⚙️ 设置
群组：当前群组

状态：
${statusOverview}

选择你想改变的设置，更多帮助请访问群组频道`;
  
  // 传递 targetChatId 以保持上下文
  const keyboard = generateSettingsKeyboard(targetChatId);
  
  await callTelegramApi('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: keyboard
    }
  });
}

// ==================== 子菜单配置界面 ====================

/**
 * 子菜单配置项接口
 */
interface SubMenuConfig {
  action: string;
  label: string;
  icon?: string;
}

/**
 * 功能子菜单配置映射
 */
const FEATURE_SUBMENU_CONFIG: Record<string, SubMenuConfig[]> = {
  // 中级功能配置项
  crypto: [
    { action: 'view_addresses', label: '查看检测地址', icon: '📋' },
    { action: 'add_address', label: '添加检测地址', icon: '➕' },
    { action: 'remove_address', label: '移除检测地址', icon: '➖' },
  ],
  members: [
    { action: 'view_list', label: '查看成员列表', icon: '📋' },
    { action: 'search_member', label: '搜索成员', icon: '🔍' },
    { action: 'export_data', label: '导出数据', icon: '📤' },
  ],
  schedule: [
    { action: 'view_scheduled', label: '查看定时任务', icon: '📋' },
    { action: 'add_schedule', label: '添加定时消息', icon: '➕' },
    { action: 'delete_schedule', label: '删除定时任务', icon: '➖' },
  ],
  points: [
    { action: 'view_settings', label: '积分设置', icon: '⚙️' },
    { action: 'view_rewards', label: '奖励配置', icon: '🎁' },
    { action: 'reset_points', label: '重置积分', icon: '🔄' },
  ],
  activity: [
    { action: 'view_stats', label: '查看统计', icon: '📊' },
    { action: 'export_stats', label: '导出统计', icon: '📤' },
    { action: 'settings', label: '统计设置', icon: '⚙️' },
  ],
  entertainment: [
    { action: 'view_games', label: '游戏列表', icon: '🎮' },
    { action: 'enable_game', label: '启用游戏', icon: '✅' },
    { action: 'disable_game', label: '禁用游戏', icon: '❌' },
  ],
  usdtprice: [
    { action: 'view_sources', label: '数据源配置', icon: '🔌' },
    { action: 'set_alert', label: '价格预警', icon: '🔔' },
    { action: 'auto_update', label: '自动更新', icon: '🔄' },
  ],
  channel: [
    { action: 'view_linked', label: '查看关联频道', icon: '📋' },
    { action: 'link_channel', label: '关联新频道', icon: '🔗' },
    { action: 'unlink_channel', label: '取消关联', icon: '❌' },
  ],
  // 高级功能配置项
  admin: [
    { action: 'view_admins', label: '查看管理员', icon: '👥' },
    { action: 'add_admin', label: '添加管理员', icon: '➕' },
    { action: 'remove_admin', label: '移除管理员', icon: '➖' },
    { action: 'set_permissions', label: '权限设置', icon: '🔐' },
  ],
  nsfw: [
    { action: 'view_settings', label: '检测设置', icon: '⚙️' },
    { action: 'set_sensitivity', label: '敏感度调节', icon: '🎚️' },
    { action: 'view_logs', label: '检测日志', icon: '📋' },
  ],
  lang: [
    { action: 'view_whitelist', label: '白名单列表', icon: '📋' },
    { action: 'add_language', label: '添加语言', icon: '➕' },
    { action: 'remove_language', label: '移除语言', icon: '➖' },
  ],
  invite: [
    { action: 'view_links', label: '查看链接', icon: '🔗' },
    { action: 'create_link', label: '创建链接', icon: '➕' },
    { action: 'revoke_link', label: '撤销链接', icon: '❌' },
    { action: 'link_stats', label: '链接统计', icon: '📊' },
  ],
  lottery: [
    { action: 'view_lotteries', label: '抽奖列表', icon: '📋' },
    { action: 'create_lottery', label: '创建抽奖', icon: '➕' },
    { action: 'end_lottery', label: '结束抽奖', icon: '🏁' },
  ],
  verifyuser: [
    { action: 'view_verified', label: '认证用户', icon: '👤' },
    { action: 'add_verified', label: '添加认证', icon: '➕' },
    { action: 'remove_verified', label: '取消认证', icon: '➖' },
    { action: 'set_privileges', label: '特权设置', icon: '👑' },
  ],
};

/**
 * 生成子菜单的 Inline Keyboard
 * @param featureId - 功能ID
 * @param targetChatId - 目标群组ID（私聊中使用）
 */
function generateSubMenuKeyboard(featureId: string, targetChatId?: number): any[][] {
  const keyboard: any[][] = [];
  const feature = MENU_FEATURES.find(f => f.id === featureId);
  const configItems = FEATURE_SUBMENU_CONFIG[featureId] || [];
  
  // 构建 callback_data 后缀（用于传递 targetChatId）
  const targetSuffix = targetChatId ? `:${targetChatId}` : '';
  
  // 添加配置项按钮 - 每行2个
  for (let i = 0; i < configItems.length; i += 2) {
    const row = [];
    const item1 = configItems[i];
    row.push({
      text: `${item1.icon || '•'} ${item1.label}`,
      callback_data: `menu:${featureId}:${item1.action}${targetSuffix}`
    });
    
    if (configItems[i + 1]) {
      const item2 = configItems[i + 1];
      row.push({
        text: `${item2.icon || '•'} ${item2.label}`,
        callback_data: `menu:${featureId}:${item2.action}${targetSuffix}`
      });
    }
    keyboard.push(row);
  }
  
  // 分隔行
  if (configItems.length > 0) {
    keyboard.push([{ text: '──────────────', callback_data: `menu:separator:none${targetSuffix}` }]);
  }
  
  // 切换开关和返回按钮
  keyboard.push([
    { 
      text: '🟢 切换开关', 
      callback_data: `menu:${featureId}:toggle${targetSuffix}` 
    },
    { 
      text: '🔙 返回', 
      callback_data: `menu:back:main${targetSuffix}` 
    }
  ]);
  
  return keyboard;
}

/**
 * 发送功能配置子菜单
 * @param chatId - 聊天ID
 * @param messageId - 消息ID（null表示发送新消息）
 * @param featureId - 功能ID
 * @param targetChatId - 目标群组ID（私聊中使用）
 */
async function sendFeatureConfigMenu(
  chatId: number, 
  messageId: number | null, 
  featureId: string,
  targetChatId?: number
): Promise<void> {
  const feature = MENU_FEATURES.find(f => f.id === featureId);
  if (!feature) {
    throw new Error(`Feature not found: ${featureId}`);
  }
  
  // 使用 targetChatId 或 chatId 获取功能状态
  const actualChatId = targetChatId || chatId;
  
  // 从数据库获取功能状态
  const featureStatus = await getFeatureStatus(actualChatId);
  const isEnabled = featureStatus[featureId] ?? false;
  
  const statusText = isEnabled ? '✅ 已开启' : '❌ 已关闭';
  const levelText = feature.level === 'intermediate' ? '中级功能' : '高级功能';
  
  const text = `${feature.icon} ${feature.name} 配置

${levelText} | 当前状态: ${statusText}

📋 ${feature.description}

🚧 此功能正在开发中，敬请期待完整版！`;
  
  // 传递 targetChatId 以保持上下文
  const keyboard = generateSubMenuKeyboard(featureId, targetChatId);
  
  if (messageId) {
    // 更新现有消息
    await callTelegramApi('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  } else {
    // 发送新消息
    await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });
  }
}

/**
 * 处理子菜单按钮回调
 * @param callbackQuery - 回调查询对象
 * @param featureId - 功能ID
 * @param action - 操作类型
 * @param targetChatId - 目标群组ID（私聊中使用）
 */
async function handleSubMenuCallback(
  callbackQuery: any, 
  featureId: string, 
  action: string,
  targetChatId?: number
): Promise<void> {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const feature = MENU_FEATURES.find(f => f.id === featureId);
  
  // 确定实际要操作的群组ID
  const actualChatId = targetChatId || chatId;
  
  if (!feature) {
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: '❌ 功能不存在',
      show_alert: true
    });
    return;
  }
  
  // 处理切换开关
  if (action === 'toggle') {
    // 从数据库获取当前功能状态
    const featureStatus = await getFeatureStatus(actualChatId);
    const currentStatus = featureStatus[featureId] ?? false;
    const newStatus = !currentStatus;
    
    // 更新数据库中的功能状态
    const updateSuccess = await updateFeatureStatus(actualChatId, featureId, newStatus);
    
    if (!updateSuccess) {
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '❌ 更新功能状态失败，请重试',
        show_alert: true
      });
      return;
    }
    
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: `${feature.icon} ${feature.name} 已${newStatus ? '开启' : '关闭'}`,
      show_alert: false
    });
    
    // 更新子菜单显示，传递 targetChatId 保持上下文
    await sendFeatureConfigMenu(chatId, messageId, featureId, targetChatId);
    return;
  }
  
  // 处理返回主菜单
  if (action === 'back') {
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: '🔙 返回主菜单'
    });
    
    // 更新为主菜单，传递 targetChatId 保持上下文
    await updateSettingsMenu(chatId, messageId, targetChatId);
    return;
  }
  
  // 处理配置项操作（开发中提示）
  const configItems = FEATURE_SUBMENU_CONFIG[featureId] || [];
  const configItem = configItems.find(item => item.action === action);
  
  if (configItem) {
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: `🚧 "${configItem.label}" 功能开发中...`,
      show_alert: true
    });
  } else {
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: '🚧 此功能正在开发中',
      show_alert: true
    });
  }
}

async function callTelegramApi(method: string, params: Record<string, any>): Promise<any> {
  const token = getBotToken();
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params)
  });
  return response.json();
}

async function checkAdminPermission(chatId: number, userId: number): Promise<boolean> {
  try {
    const result = await callTelegramApi('getChatMember', {
      chat_id: chatId,
      user_id: userId
    });

    if (!result.ok) {
      console.error('Failed to get chat member info:', result);
      return false;
    }

    const status = result.result?.status;
    return status === 'creator' || status === 'administrator';
  } catch (error) {
    console.error('Error checking admin permission:', error);
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'Telegram Webhook' });
  }

  const update: TelegramUpdate = req.body;
  console.log('=== Webhook received ===');
  console.log('Update ID:', update.update_id);

  try {
    // Handle my_chat_member (bot added to group)
    if (update.my_chat_member) {
      await handleBotAddedToGroup(update);
      return res.status(200).json({ ok: true });
    }

    // Handle chat_member (new member joined)
    if (update.chat_member) {
      await handleNewChatMember(update);
      return res.status(200).json({ ok: true });
    }

    // Handle callback_query
    if (update.callback_query) {
      await handleCallbackQuery(update);
      return res.status(200).json({ ok: true });
    }

    // Handle message
    if (update.message) {
      const message = update.message;
      const chatId = message.chat.id;
      const userId = message.from?.id;
      const text = message.text || '';
      const chatType = message.chat.type;

      console.log('Message:', { chatId, userId, text: text.substring(0, 50), chatType });

      // Handle commands
      if (text.startsWith('/')) {
        await handleCommand(chatId, userId, message.from?.username || 'User', text, message);
        return res.status(200).json({ ok: true });
      }

      // Handle group messages
      if (chatType === 'group' || chatType === 'supergroup') {
        await handleGroupMessage(message);
      } else if (chatType === 'private') {
        await handlePrivateMessage(message);
      }

      return res.status(200).json({ ok: true });
    }

    return res.status(200).json({ ok: true, message: 'No handler' });
  } catch (error) {
    console.error('Webhook error:', error);
    return res.status(500).json({ error: String(error) });
  }
}

async function handleBotAddedToGroup(update: TelegramUpdate) {
  const chatMember = update.my_chat_member!;
  const chat = chatMember.chat;
  const newStatus = chatMember.new_chat_member.status;
  const addedByUser = chatMember.from;

  console.log('Bot added to group:', { chatId: chat.id, title: chat.title, newStatus, addedBy: addedByUser?.id });

  if (newStatus === 'member' || newStatus === 'administrator') {
    const supabase = getSupabase();

    // Create or update group
    const { data: group, error } = await supabase
      .from('groups')
      .upsert({
        chat_id: chat.id,
        title: chat.title || 'Unknown',
        type: chat.type,
        username: chat.username,
        is_active: true
      }, { onConflict: 'chat_id' })
      .select()
      .single();

    if (error) {
      console.error('Error creating group:', error);
      return;
    }

    console.log('Group created/updated:', group);

    // 记录添加者信息
    if (addedByUser?.id) {
      try {
        await createUserGroupRelation(addedByUser.id, chat.id, group.id, chat.title || 'Unknown');
        console.log('User-group relation created for adder:', addedByUser.id);
      } catch (relationError) {
        console.error('Error creating user-group relation:', relationError);
      }
    }

    // Send welcome message
    await callTelegramApi('sendMessage', {
      chat_id: chat.id,
      text: `👋 你好！我是群管机器人。\n\n请访问管理后台配置功能：\nhttps://tg-group-admin.vercel.app\n\n群组ID: ${chat.id}`
    });
  }
}

/**
 * 创建用户与群组的关联关系
 */
async function createUserGroupRelation(
  userTelegramId: number,
  groupChatId: number,
  groupId: string,
  groupTitle: string
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('user_group_relations')
    .upsert({
      user_telegram_id: userTelegramId,
      group_id: groupId,
      group_chat_id: groupChatId,
      group_title: groupTitle,
      is_active: true
    }, { onConflict: 'user_telegram_id, group_chat_id' });

  if (error) {
    console.error('Error upserting user_group_relations:', error);
    throw error;
  }
}

async function handleNewChatMember(update: TelegramUpdate) {
  const chatMember = update.chat_member!;
  const chat = chatMember.chat;
  const newStatus = chatMember.new_chat_member.status;
  const oldStatus = chatMember.old_chat_member?.status;
  const user = chatMember.new_chat_member.user;

  console.log('=== handleNewChatMember ===');
  console.log('Chat:', { id: chat.id, title: chat.title });
  console.log('User:', { id: user.id, username: user.username, first_name: user.first_name });
  console.log('Status:', { old: oldStatus, new: newStatus });

  // Only handle new member join (from left to member)
  if (newStatus !== 'member' || oldStatus === 'member') {
    console.log('Not a new member join, skipping');
    return;
  }

  // Skip bots
  if (user.is_bot) {
    console.log('User is bot, skipping');
    return;
  }

  const supabase = getSupabase();

  // 确保群组存在（自动创建）
  const groupId = await ensureGroupExists(chat.id);
  if (!groupId) {
    console.log('Failed to ensure group exists:', chat.id);
    return;
  }
  
  // 获取群组信息
  const { data: group } = await supabase
    .from('groups')
    .select('id, title')
    .eq('id', groupId)
    .single();

  // Get verification config
  const { data: config } = await supabase
    .from('group_configs')
    .select('verification_config, welcome_config')
    .eq('group_id', group.id)
    .single();

  const verificationConfig = config?.verification_config;
  const welcomeConfig = config?.welcome_config;

  console.log('Verification config:', JSON.stringify(verificationConfig));

  // Handle verification
  if (verificationConfig?.enabled) {
    console.log('Verification enabled, restricting user...');
    
    // Restrict user
    await callTelegramApi('restrictChatMember', {
      chat_id: chat.id,
      user_id: user.id,
      permissions: {
        can_send_messages: false,
        can_send_media_messages: false,
        can_send_other_messages: false,
        can_add_web_page_previews: false
      },
      until_date: Math.floor(Date.now() / 1000) + 86400
    });

    // Create verification record
    const verifyId = crypto.randomUUID();
    const timeout = verificationConfig.timeout || 300;
    const expiresAt = new Date(Date.now() + timeout * 1000).toISOString();

    const { data: record } = await supabase
      .from('verification_records')
      .insert({
        group_id: group.id,
        telegram_id: user.id,
        verification_type: verificationConfig.type || 'math',
        status: 'pending',
        challenge_data: {
          verify_id: verifyId,
          channel_id: verificationConfig.channel_id
        },
        expires_at: expiresAt,
        max_attempts: 3
      })
      .select()
      .single();

    // Send verification message
    if (verificationConfig.type === 'channel') {
      await callTelegramApi('sendMessage', {
        chat_id: chat.id,
        text: `🎉 欢迎 ${user.first_name} 加入群组！\n\n⚠️ 请先关注频道后点击下方按钮完成验证：\n\n⏰ ${Math.floor(timeout / 60)}分钟内有效`,
        reply_markup: {
          inline_keyboard: [[{
            text: '✅ 我已关注频道',
            callback_data: `verify_channel:${record.id}`
          }]]
        }
      });
    } else {
      // Math verification
      const num1 = Math.floor(Math.random() * 10) + 1;
      const num2 = Math.floor(Math.random() * 10) + 1;
      const answer = num1 + num2;

      await supabase
        .from('verification_records')
        .update({ challenge_data: { num1, num2, answer } })
        .eq('id', record.id);

      await callTelegramApi('sendMessage', {
        chat_id: chat.id,
        text: `🎉 欢迎 ${user.first_name} 加入群组！\n\n⚠️ 请完成验证：\n\n请计算：${num1} + ${num2} = ?\n\n请在私聊中输入答案\n⏰ ${Math.floor(timeout / 60)}分钟内有效`
      });
    }
  } else {
    // Send welcome message if verification is disabled
    if (welcomeConfig?.enabled) {
      let message = welcomeConfig.message || `欢迎 ${user.first_name} 加入群组！`;
      message = message
        .replace(/{user_name}/g, user.first_name)
        .replace(/{user_id}/g, user.id.toString())
        .replace(/{group_name}/g, group.title)
        .replace(/{mention}/g, user.username ? `@${user.username}` : user.first_name);

      await callTelegramApi('sendMessage', {
        chat_id: chat.id,
        text: message,
        parse_mode: 'HTML'
      });
    }
  }

  console.log('=== handleNewChatMember END ===');
}

async function handleCallbackQuery(update: TelegramUpdate) {
  const callbackQuery = update.callback_query!;
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;
  const chatId = callbackQuery.message?.chat?.id;

  console.log('Callback query:', { data, userId, chatId });

  // Handle mygroups button clicks
  if (data?.startsWith('mygroup:') || data?.startsWith('mygroups:')) {
    if (!chatId) {
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '❌ 无法获取聊天信息'
      });
      return;
    }

    await handleMyGroupsCallback(callbackQuery, data);
    return;
  }

  // Handle menu button clicks
  if (data?.startsWith('menu:')) {
    if (!chatId) {
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '❌ 无法获取群组信息'
      });
      return;
    }

    await handleMenuCallback(callbackQuery, data);
    return;
  }

  // Handle verification callback
  if (data?.startsWith('verify_channel:')) {
    const recordId = data.split(':')[1];
    const supabase = getSupabase();

    // Get verification record
    const { data: record } = await supabase
      .from('verification_records')
      .select('*')
      .eq('id', recordId)
      .eq('status', 'pending')
      .single();

    if (!record) {
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '❌ 验证已过期或无效',
        show_alert: true
      });
      return;
    }

    // Check if expired
    if (new Date(record.expires_at) < new Date()) {
      await supabase.from('verification_records').update({ status: 'expired' }).eq('id', recordId);
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '⏰ 验证已过期',
        show_alert: true
      });
      return;
    }

    // Check if user followed channel
    const channelId = record.challenge_data?.channel_id;
    if (!channelId) {
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '❌ 配置错误',
        show_alert: true
      });
      return;
    }

    try {
      const memberInfo = await callTelegramApi('getChatMember', {
        chat_id: channelId,
        user_id: userId
      });

      const isMember = ['member', 'administrator', 'creator'].includes(memberInfo.result?.status);

      if (isMember) {
        // Verification passed
        await supabase.from('verification_records').update({ status: 'passed', completed_at: new Date().toISOString() }).eq('id', recordId);

        // Unrestrict user
        await callTelegramApi('restrictChatMember', {
          chat_id: chatId,
          user_id: userId,
          permissions: {
            can_send_messages: true,
            can_send_media_messages: true,
            can_send_other_messages: true,
            can_add_web_page_previews: true
          }
        });

        await callTelegramApi('answerCallbackQuery', {
          callback_query_id: callbackQuery.id,
          text: '✅ 验证成功！',
          show_alert: true
        });

        // Update message
        await callTelegramApi('editMessageText', {
          chat_id: chatId,
          message_id: callbackQuery.message.message_id,
          text: '✅ 验证成功！欢迎加入！'
        });

        console.log('User verified successfully:', userId);
      } else {
        await callTelegramApi('answerCallbackQuery', {
          callback_query_id: callbackQuery.id,
          text: '❌ 您还没有关注频道',
          show_alert: true
        });
      }
    } catch (error) {
      console.error('Error checking channel membership:', error);
      await callTelegramApi('answerCallbackQuery', {
        callback_query_id: callbackQuery.id,
        text: '❌ 检查失败，请重试',
        show_alert: true
      });
    }
  } else {
    await callTelegramApi('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      text: '已收到'
    });
  }
}

async function handleCommand(chatId: number, userId: number | undefined, username: string, text: string, message: any) {
  const command = text.split(' ')[0].toLowerCase();
  console.log('Command:', command);

  switch (command) {
    case '/start':
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `👋 你好 ${username}！\n\n我是群管机器人。\n\n📌 可用命令：\n/start - 开始使用\n/help - 查看帮助\n/mygroups - 我的群组管理\n/checkin - 每日签到\n/me - 个人信息\n/rank - 排行榜`
      });
      break;

    case '/help':
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `📖 帮助信息\n\n📌 可用命令：\n/start - 开始使用\n/help - 查看帮助\n/mygroups - 我的群组管理\n/checkin - 每日签到\n/me - 个人信息\n/rank - 排行榜\n/reload - 刷新信息`
      });
      break;

    case '/checkin':
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `✅ 签到成功！\n\n积分 +10\n连续签到 1 天`
      });
      break;

    case '/me':
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `👤 个人信息\n\n用户名: ${username}\n用户ID: ${userId}\n积分: 0\n排名: -`
      });
      break;

    case '/rank':
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `🏆 积分排行榜\n\n暂无数据`
      });
      break;

    case '/settings':
      await handleSettingsCommand(chatId, userId, message);
      break;

    case '/mygroups':
      if (!userId) {
        await callTelegramApi('sendMessage', {
          chat_id: chatId,
          text: '❌ 无法获取用户信息'
        });
        break;
      }
      await sendUserGroupsMenu(chatId, userId);
      break;

    default:
      console.log('Unknown command:', command);
  }
}

/**
 * 处理 /settings 命令
 */
async function handleSettingsCommand(chatId: number, userId: number | undefined, message: any): Promise<void> {
  console.log('=== handleSettingsCommand ===');
  
  // 检查是否在群组中
  const chatType = message.chat?.type;
  if (chatType !== 'group' && chatType !== 'supergroup') {
    await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: '⚠️ 设置菜单只能在群组中使用。\n\n请将机器人添加到群组并发送 /settings'
    });
    return;
  }

  // 检查用户是否为管理员
  if (!userId) {
    await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: '❌ 无法获取用户信息'
    });
    return;
  }

  const isAdmin = await isGroupAdmin(chatId, userId);
  if (!isAdmin) {
    await callTelegramApi('sendMessage', {
      chat_id: chatId,
      text: '⚠️ 只有群组管理员可以使用设置菜单'
    });
    return;
  }

  // 获取群组名称
  const groupName = message.chat?.title || '当前群组';
  
  // 发送设置菜单
  await sendSettingsMenu(chatId, groupName);
  
  console.log('=== handleSettingsCommand END ===');
}

async function handleGroupMessage(message: any) {
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const text = message.text || '';
  const messageId = message.message_id;

  console.log('=== handleGroupMessage ===');
  console.log('Chat ID:', chatId, 'User ID:', userId, 'Text:', text.substring(0, 50));

  // Check for rate query
  if (RATE_KEYWORDS.some(kw => text.includes(kw))) {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=cny,usd&include_24hr_change=true');
      const data = await response.json();
      const cnyPrice = data.tether?.cny || 7.24;
      const change = data.tether?.cny_24h_change || 0;

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `💰 USDT/CNY 实时汇率\n\n💵 当前价格: ¥${cnyPrice.toFixed(2)}\n📊 24h涨跌: ${change >= 0 ? '+' : ''}${change.toFixed(2)}%\n🕐 更新时间: ${new Date().toLocaleString('zh-CN')}\n\n数据来源: CoinGecko`,
        parse_mode: 'HTML'
      });
      return;
    } catch (error) {
      console.error('Rate query error:', error);
    }
  }

  // Check for crypto address
  for (const [chain, pattern] of Object.entries(ADDRESS_PATTERNS)) {
    const match = text.match(pattern);
    if (match) {
      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `🔍 检测到 ${chain} 地址\n\n地址: ${match[0]}\n\n⚠️ 余额查询功能暂未启用`,
        parse_mode: 'HTML'
      });
      return;
    }
  }

  console.log('=== handleGroupMessage END ===');
}

async function handlePrivateMessage(message: any) {
  const chatId = message.chat.id;
  const userId = message.from?.id;
  const text = message.text || '';

  console.log('Private message:', { chatId, userId, text });

  // Check for pending verification
  const supabase = getSupabase();
  const { data: record } = await supabase
    .from('verification_records')
    .select('*, groups!inner(chat_id)')
    .eq('telegram_id', userId)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (record && record.verification_type === 'math') {
    const answer = parseInt(text.trim());
    const correctAnswer = record.challenge_data?.answer;

    if (answer === correctAnswer) {
      await supabase.from('verification_records').update({ status: 'passed', completed_at: new Date().toISOString() }).eq('id', record.id);

      await callTelegramApi('restrictChatMember', {
        chat_id: record.groups.chat_id,
        user_id: userId,
        permissions: {
          can_send_messages: true,
          can_send_media_messages: true,
          can_send_other_messages: true,
          can_add_web_page_previews: true
        }
      });

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: '✅ 验证成功！欢迎加入群组！'
      });
    } else {
      const attemptCount = (record.attempt_count || 0) + 1;
      await supabase.from('verification_records').update({ attempt_count: attemptCount }).eq('id', record.id);

      await callTelegramApi('sendMessage', {
        chat_id: chatId,
        text: `❌ 答案错误，请重试。\n\n剩余 ${Math.max(0, (record.max_attempts || 3) - attemptCount)} 次机会`
      });
    }
    return;
  }

  // Handle /mygroups command
  if (text === '/mygroups') {
    await sendUserGroupsMenu(chatId, userId);
    return;
  }

  // Default response
  await callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: `👋 你好！\n\n我是群管机器人。\n\n📌 可用命令：\n/start - 开始使用\n/help - 查看帮助\n/mygroups - 我的群组管理\n\n管理后台：\nhttps://tg-group-admin.vercel.app`
  });
}

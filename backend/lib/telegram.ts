// @ts-nocheck
import { Bot, Context, session, SessionFlavor } from 'grammy';
import { FileFlavor, hydrateFiles, FileContext } from '@grammyjs/files';
import { ConversationFlavor, conversations, createConversation } from '@grammyjs/conversations';
import { TelegramUpdate, TelegramUser, TelegramChat } from '../types/telegram';
import { sendMessage, deleteMessage, restrictChatMember, getChatMember, answerCallbackQuery, editMessageText } from './api';

interface SessionData {
  waitingVerification?: string;
  lastCommand?: string;
  verificationData?: Record<string, unknown>;
}

export type BotContext = Context &
  SessionFlavor<SessionData> &
  FileContext &
  ConversationFlavor;

export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(process.env.TELEGRAM_BOT_TOKEN || '', {
    ContextConstructor: BotContext,
    webhookMode: true
  });

  bot.use(session({
    initial: () => ({}),
    getSessionKey: (ctx) => ctx.chat?.id.toString()
  }));

  bot.use(hydrateFiles(bot.token));
  bot.use(conversations());

  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`Error in ${ctx.chat?.type}:${ctx.chat?.id}`, err.error);
  });

  return bot;
}

export async function handleWebhook(update: TelegramUpdate): Promise<void> {
  const bot = global.bot as Bot<BotContext> | undefined;
  
  if (!bot) {
    console.error('Bot not initialized');
    return;
  }

  try {
    await bot.handleUpdate(update);
  } catch (error) {
    console.error('Error handling update:', error);
    throw error;
  }
}

export function extractUser(update: TelegramUpdate): TelegramUser | undefined {
  if (update.message?.from) return update.message.from;
  if (update.callback_query?.from) return update.callback_query.from;
  if (update.my_chat_member?.from) return update.my_chat_member.from;
  if (update.chat_member?.from) return update.chat_member.from;
  return undefined;
}

export function extractChat(update: TelegramUpdate): TelegramChat | undefined {
  if (update.message?.chat) return update.message.chat;
  if (update.callback_query?.message?.chat) return update.callback_query.message.chat;
  if (update.my_chat_member?.chat) return update.my_chat_member.chat;
  if (update.chat_member?.chat) return update.chat_member.chat;
  return undefined;
}

export function getChatId(update: TelegramUpdate): number | undefined {
  return extractChat(update)?.id;
}

export function getUserId(update: TelegramUpdate): number | undefined {
  return extractUser(update)?.id;
}

export function isGroupChat(update: TelegramUpdate): boolean {
  const chat = extractChat(update);
  return chat?.type === 'group' || chat?.type === 'supergroup';
}

export function isChannel(update: TelegramUpdate): boolean {
  return extractChat(update)?.type === 'channel';
}

export function getUserDisplayName(user: TelegramUser): string {
  if (user.username) return `@${user.username}`;
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.join(' ') || `User_${user.id}`;
}

export function formatMessageTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

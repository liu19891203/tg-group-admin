import axios, { AxiosInstance } from 'axios';

const BASE_URL = 'https://api.telegram.org/bot';

function getBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not set');
  }
  return token;
}

function createClient(): AxiosInstance {
  const token = getBotToken();
  return axios.create({
    baseURL: `${BASE_URL}${token}/`,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

const client = createClient();

export async function sendMessage(
  chatId: number | string,
  text: string,
  options?: {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disableWebPagePreview?: boolean;
    disableNotification?: boolean;
    protectContent?: boolean;
    replyToMessageId?: number;
    replyMarkup?: Record<string, unknown>;
  }
): Promise<{ ok: boolean; result: { message_id: number } }> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    text,
    disable_web_page_preview: options?.disableWebPagePreview ?? false,
    disable_notification: options?.disableNotification ?? false,
    protect_content: options?.protectContent ?? false
  };

  if (options?.parseMode) {
    payload.parse_mode = options.parseMode;
  }

  if (options?.replyToMessageId) {
    payload.reply_to_message_id = options.replyToMessageId;
  }

  if (options?.replyMarkup) {
    payload.reply_markup = options.replyMarkup;
  }

  return client.post('sendMessage', payload).then((res) => res.data);
}

export async function deleteMessage(
  chatId: number | string,
  messageId: number
): Promise<{ ok: boolean }> {
  return client.post('deleteMessage', {
    chat_id: chatId,
    message_id: messageId
  }).then((res) => res.data);
}

export async function restrictChatMember(
  chatId: number | string,
  userId: number,
  permissions: {
    canSendMessages?: boolean;
    canSendMediaMessages?: boolean;
    canSendPolls?: boolean;
    canSendOtherMessages?: boolean;
    canAddWebPagePreviews?: boolean;
    canChangeInfo?: boolean;
    canInviteUsers?: boolean;
    canPinMessages?: boolean;
    canManageTopics?: boolean;
  },
  untilDate?: number
): Promise<{ ok: boolean }> {
  return client.post('restrictChatMember', {
    chat_id: chatId,
    user_id: userId,
    permissions,
    until_date: untilDate
  }).then((res) => res.data);
}

export async function getChatMember(
  chatId: number | string,
  userId: number
): Promise<{
  ok: boolean;
  result: {
    status: string;
    user: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
  };
}> {
  return client.post('getChatMember', {
    chat_id: chatId,
    user_id: userId
  }).then((res) => res.data);
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  options?: {
    text?: string;
    showAlert?: boolean;
    url?: string;
    cacheTime?: number;
  }
): Promise<{ ok: boolean }> {
  const payload: Record<string, unknown> = {
    callback_query_id: callbackQueryId
  };

  if (options?.text) payload.text = options.text;
  if (options?.showAlert) payload.show_alert = options.showAlert;
  if (options?.url) payload.url = options.url;
  if (options?.cacheTime) payload.cache_time = options.cacheTime;

  return client.post('answerCallbackQuery', payload).then((res) => res.data);
}

export async function editMessageText(
  chatId: number | string,
  messageId: number,
  text: string,
  options?: {
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    replyMarkup?: Record<string, unknown>;
  }
): Promise<{ ok: boolean }> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text
  };

  if (options?.parseMode) {
    payload.parse_mode = options.parseMode;
  }

  if (options?.replyMarkup) {
    payload.reply_markup = options.replyMarkup;
  }

  return client.post('editMessageText', payload).then((res) => res.data);
}

export async function kickChatMember(
  chatId: number | string,
  userId: number,
  untilDate?: number
): Promise<{ ok: boolean }> {
  return client.post('kickChatMember', {
    chat_id: chatId,
    user_id: userId,
    until_date: untilDate
  }).then((res) => res.data);
}

export async function unbanChatMember(
  chatId: number | string,
  userId: number
): Promise<{ ok: boolean }> {
  return client.post('unbanChatMember', {
    chat_id: chatId,
    user_id: userId
  }).then((res) => res.data);
}

export async function pinChatMessage(
  chatId: number | string,
  messageId: number,
  disableNotification?: boolean
): Promise<{ ok: boolean }> {
  return client.post('pinChatMessage', {
    chat_id: chatId,
    message_id: messageId,
    disable_notification: disableNotification ?? false
  }).then((res) => res.data);
}

export async function unpinChatMessage(
  chatId: number | string,
  messageId?: number
): Promise<{ ok: boolean }> {
  const payload: Record<string, unknown> = {
    chat_id: chatId
  };

  if (messageId) {
    payload.message_id = messageId;
  }

  return client.post('unpinChatMessage', payload).then((res) => res.data);
}

export async function getChat(chatId: number | string): Promise<{
  ok: boolean;
  result: {
    id: number;
    type: string;
    title?: string;
    username?: string;
    description?: string;
    invite_link?: string;
  };
}> {
  return client.post('getChat', {
    chat_id: chatId
  }).then((res) => res.data);
}

export async function exportChatInviteLink(
  chatId: number | string
): Promise<{
  ok: boolean;
  result: string;
}> {
  return client.post('exportChatInviteLink', {
    chat_id: chatId
  }).then((res) => res.data);
}

export async function leaveChat(
  chatId: number | string
): Promise<{ ok: boolean }> {
  return client.post('leaveChat', {
    chat_id: chatId
  }).then((res) => res.data);
}

export async function sendPhoto(
  chatId: number | string,
  photo: string,
  options?: {
    caption?: string;
    parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
    disableNotification?: boolean;
    replyMarkup?: Record<string, unknown>;
  }
): Promise<{
  ok: boolean;
  result: {
    message_id: number;
    photo?: { file_id: string }[];
  };
}> {
  const payload: Record<string, unknown> = {
    chat_id: chatId,
    photo
  };

  if (options?.caption) payload.caption = options.caption;
  if (options?.parseMode) payload.parse_mode = options.parseMode;
  if (options?.disableNotification) payload.disable_notification = true;
  if (options?.replyMarkup) payload.reply_markup = options.replyMarkup;

  return client.post('sendPhoto', payload).then((res) => res.data);
}

export async function forwardMessage(
  chatId: number | string,
  fromChatId: number | string,
  messageId: number,
  disableNotification?: boolean
): Promise<{ ok: boolean }> {
  return client.post('forwardMessage', {
    chat_id: chatId,
    from_chat_id: fromChatId,
    message_id: messageId,
    disable_notification: disableNotification ?? false
  }).then((res) => res.data);
}

export async function setMyCommands(
  commands: { command: string; description: string }[],
  options?: {
    scope?: {
      type: 'default' | 'all_private_chats' | 'all_group_chats' | 'all_chat_administrators' | 'chat' | 'chat_administrators' | 'chat_member';
      chat_id?: number | string;
    };
    language_code?: string;
  }
): Promise<{ ok: boolean }> {
  const payload: Record<string, unknown> = { commands };
  
  if (options?.scope) {
    payload.scope = options.scope;
  }
  if (options?.language_code) {
    payload.language_code = options.language_code;
  }

  return client.post('setMyCommands', payload).then((res) => res.data);
}

export async function getMyCommands(
  options?: {
    scope?: {
      type: string;
      chat_id?: number | string;
    };
    language_code?: string;
  }
): Promise<{
  ok: boolean;
  result: { command: string; description: string }[];
}> {
  const payload: Record<string, unknown> = {};
  
  if (options?.scope) {
    payload.scope = options.scope;
  }
  if (options?.language_code) {
    payload.language_code = options.language_code;
  }

  return client.post('getMyCommands', payload).then((res) => res.data);
}

export async function deleteMyCommands(
  options?: {
    scope?: {
      type: string;
      chat_id?: number | string;
    };
    language_code?: string;
  }
): Promise<{ ok: boolean }> {
  const payload: Record<string, unknown> = {};
  
  if (options?.scope) {
    payload.scope = options.scope;
  }
  if (options?.language_code) {
    payload.language_code = options.language_code;
  }

  return client.post('deleteMyCommands', payload).then((res) => res.data);
}

export async function setChatMenuButton(
  chatId: number | string,
  menuButton: {
    type: 'commands' | 'web_app' | 'default';
    text?: string;
    web_app?: { url: string };
  }
): Promise<{ ok: boolean }> {
  return client.post('setChatMenuButton', {
    chat_id: chatId,
    menu_button: menuButton
  }).then((res) => res.data);
}

import { vi, beforeEach, afterEach, beforeAll, afterAll, describe, it, expect } from 'vitest';

export function createMockContext() {
  return {
    chat: { id: '123456789', type: 'group' },
    from: { id: '987654321', username: 'testuser', first_name: 'Test', is_bot: false },
    message: { message_id: 12345, text: 'Test message', date: Math.floor(Date.now() / 1000) },
    message_id: 12345,
    reply: vi.fn(),
    editMessageText: vi.fn(),
    deleteMessage: vi.fn(),
    answerCallbackQuery: vi.fn(),
    restrictChatMember: vi.fn(),
    kickChatMember: vi.fn(),
    unbanChatMember: vi.fn(),
    getChat: vi.fn().mockResolvedValue({ id: '123456789', type: 'group' }),
    getChatMember: vi.fn().mockResolvedValue({ status: 'member' }),
    sendMessage: vi.fn().mockResolvedValue({ message_id: 67890 }),
    forwardMessage: vi.fn().mockResolvedValue({ message_id: 67890 }),
    sendPhoto: vi.fn().mockResolvedValue({ message_id: 67890 }),
    sendDocument: vi.fn().mockResolvedValue({ message_id: 67890 }),
    sendSticker: vi.fn().mockResolvedValue({ message_id: 67890 }),
    sendAnimation: vi.fn().mockResolvedValue({ message_id: 67890 }),
    leaveChat: vi.fn().mockResolvedValue(true)
  };
}

export function createMockChat() {
  return {
    id: '123456789',
    type: 'supergroup',
    title: 'Test Group',
    username: 'testgroup',
    description: 'Test group description',
    invite_link: 'https://t.me/testgroup',
    member_count: 100,
    permissions: {
      can_send_messages: true,
      can_send_media_messages: true,
      can_send_other_messages: true,
      can_add_web_page_previews: true
    }
  };
}

export function createMockUser(id = '987654321') {
  return {
    id: id,
    username: `user${id}`,
    first_name: 'Test',
    last_name: 'User',
    language_code: 'en',
    is_bot: false
  };
}

export function createMockSupabase() {
  const mockSupabase = {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: vi.fn().mockResolvedValue({ data: [], error: null })
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null })
  };
  return mockSupabase;
}

export function createMockRedis() {
  const storage = new Map();
  return {
    get: vi.fn().mockImplementation((key: string) => Promise.resolve(storage.get(key))),
    set: vi.fn().mockImplementation((key: string, value: any) => {
      storage.set(key, value);
      return Promise.resolve('OK');
    }),
    del: vi.fn().mockImplementation((key: string) => {
      storage.delete(key);
      return Promise.resolve(1);
    }),
    keys: vi.fn().mockImplementation((pattern: string) => {
      const keys = Array.from(storage.keys()).filter(k => k.includes(pattern.replace('*', '')));
      return Promise.resolve(keys);
    }),
    mget: vi.fn().mockImplementation((...keys: string[]) => {
      return Promise.resolve(keys.map(k => storage.get(k)));
    }),
    mset: vi.fn().mockImplementation((...args: any[]) => {
      for (let i = 0; i < args.length; i += 2) {
        storage.set(args[i], args[i + 1]);
      }
      return Promise.resolve('OK');
    }),
    hget: vi.fn().mockImplementation((key: string, field: string) => {
      const hash = storage.get(key) || {};
      return Promise.resolve(hash[field]);
    }),
    hset: vi.fn().mockImplementation((key: string, field: string, value: any) => {
      const hash = storage.get(key) || {};
      hash[field] = value;
      storage.set(key, hash);
      return Promise.resolve(1);
    }),
    hgetall: vi.fn().mockImplementation((key: string) => {
      return Promise.resolve(storage.get(key) || {});
    }),
    hdel: vi.fn().mockImplementation((key: string, field: string) => {
      const hash = storage.get(key) || {};
      delete hash[field];
      storage.set(key, hash);
      return Promise.resolve(1);
    }),
    hincrby: vi.fn().mockImplementation((key: string, field: string, increment: number) => {
      const hash = storage.get(key) || {};
      hash[field] = (hash[field] || 0) + increment;
      storage.set(key, hash);
      return Promise.resolve(hash[field]);
    }),
    zadd: vi.fn().mockResolvedValue(1),
    zrange: vi.fn().mockResolvedValue([]),
    zrevrange: vi.fn().mockResolvedValue([]),
    zscore: vi.fn().mockResolvedValue(null),
    lpush: vi.fn().mockResolvedValue(1),
    lrange: vi.fn().mockResolvedValue([]),
    ping: vi.fn().mockResolvedValue('PONG'),
    expire: vi.fn().mockResolvedValue(1),
    ttl: vi.fn().mockResolvedValue(-1),
    clear: vi.fn().mockImplementation(() => {
      storage.clear();
      return Promise.resolve('OK');
    }),
    disconnect: vi.fn()
  };
}

export function createMockTelegram() {
  return {
    sendMessage: vi.fn().mockResolvedValue({ message_id: 12345 }),
    deleteMessage: vi.fn().mockResolvedValue(true),
    kickChatMember: vi.fn().mockResolvedValue(true),
    unbanChatMember: vi.fn().mockResolvedValue(true),
    restrictChatMember: vi.fn().mockResolvedValue(true),
    getChat: vi.fn().mockResolvedValue({ id: '123456789', type: 'group' }),
    getChatMember: vi.fn().mockResolvedValue({ status: 'member', user: createMockUser() }),
    answerCallbackQuery: vi.fn().mockResolvedValue(),
    editMessageText: vi.fn().mockResolvedValue({ message_id: 12345 }),
    sendPhoto: vi.fn().mockResolvedValue({ message_id: 12345 }),
    sendDocument: vi.fn().mockResolvedValue({ message_id: 12345 }),
    forwardMessage: vi.fn().mockResolvedValue({ message_id: 12345 }),
    exportChatInviteLink: vi.fn().mockResolvedValue('https://t.me/testgroup')
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

beforeAll(() => {
  vi.useFakeTimers();
});

afterAll(() => {
  vi.useRealTimers();
});

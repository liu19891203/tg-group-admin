import { supabase } from './database';
import { redis } from './redis';
import { Group, GroupConfig, User } from '../types/database';

interface CacheData {
  group?: Group;
  config?: GroupConfig;
  user?: User;
}

class CacheManager {
  private static instance: CacheManager;
  private ttl = 300;

  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  async getGroup(chatId: number): Promise<Group | null> {
    const cacheKey = `group:${chatId}`;
    
    try {
      const cached = await redis.get<Group>(cacheKey);
      if (cached) return cached;
    } catch (e) {
      console.warn('Redis get failed:', e);
    }

    const { data } = await supabase
      .from('groups')
      .select('*')
      .eq('chat_id', chatId)
      .single();

    if (data) {
      try {
        await redis.setex(cacheKey, this.ttl, JSON.stringify(data));
      } catch (e) {
        console.warn('Redis set failed:', e);
      }
    }

    return data;
  }

  async getGroupConfig(groupId: string): Promise<GroupConfig | null> {
    const cacheKey = `config:${groupId}`;
    
    try {
      const cached = await redis.get<GroupConfig>(cacheKey);
      if (cached) return cached;
    } catch (e) {
      console.warn('Redis get failed:', e);
    }

    const { data } = await supabase
      .from('group_configs')
      .select('*')
      .eq('group_id', groupId)
      .single();

    if (data) {
      try {
        await redis.setex(cacheKey, this.ttl, JSON.stringify(data));
      } catch (e) {
        console.warn('Redis set failed:', e);
      }
    }

    return data;
  }

  async getOrCreateUser(telegramId: number, userInfo?: {
    username?: string;
    first_name: string;
    last_name?: string;
    language_code?: string;
  }, groupId?: string): Promise<User | null> {
    const cacheKey = `user:${telegramId}`;
    
    try {
      const cached = await redis.get<User>(cacheKey);
      if (cached) return cached;
    } catch (e) {
      console.warn('Redis get failed:', e);
    }

    let { data } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();

    if (!data && userInfo) {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          telegram_id: telegramId,
          username: userInfo.username,
          first_name: userInfo.first_name,
          last_name: userInfo.last_name,
          language_code: userInfo.language_code
        })
        .select()
        .single();

      if (!error && newUser) {
        data = newUser;
      }
    }

    if (data) {
      try {
        await redis.setex(cacheKey, this.ttl, JSON.stringify(data));
      } catch (e) {
        console.warn('Redis set failed:', e);
      }
    }

    return data;
  }

  async invalidateGroup(chatId: number): Promise<void> {
    const cacheKey = `group:${chatId}`;
    try {
      await redis.del(cacheKey);
    } catch (e) {
      console.warn('Redis del failed:', e);
    }
  }

  async invalidateConfig(groupId: string): Promise<void> {
    const cacheKey = `config:${groupId}`;
    try {
      await redis.del(cacheKey);
    } catch (e) {
      console.warn('Redis del failed:', e);
    }
  }

  async invalidateUser(telegramId: number): Promise<void> {
    const cacheKey = `user:${telegramId}`;
    try {
      await redis.del(cacheKey);
    } catch (e) {
      console.warn('Redis del failed:', e);
    }
  }
}

export const cacheManager = new Proxy({} as CacheManager, {
  get(target, prop) {
    return CacheManager.getInstance()[prop as keyof CacheManager];
  }
});

export { CacheManager };

import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

let redisInstance: Redis | null = null;
let isRedisConfigured = false;

function getRedis(): Redis {
  if (redisInstance) return redisInstance;
  
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (redisUrl && redisToken) {
    try {
      redisInstance = new Redis({
        url: redisUrl,
        token: redisToken
      });
      isRedisConfigured = true;
      console.log('Redis configured successfully');
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
    }
  }
  
  if (!redisInstance) {
    console.warn('Upstash Redis credentials not configured, using in-memory fallback');
    redisInstance = new Redis({
      url: 'https://localhost',
      token: 'fallback'
    });
  }
  
  return redisInstance;
}

export const redis = new Proxy({} as Redis, {
  get(target, prop) {
    return getRedis()[prop as keyof Redis];
  }
});

export { isRedisConfigured };

let ratelimitInstance: Ratelimit | null = null;
let groupRatelimitInstance: Ratelimit | null = null;
let userRatelimitInstance: Ratelimit | null = null;

function getRatelimit(): Ratelimit {
  if (ratelimitInstance) return ratelimitInstance;
  
  try {
    ratelimitInstance = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(30, '10 s'),
      analytics: true,
      prefix: 'tgm'
    });
  } catch (error) {
    console.error('Failed to initialize Ratelimit:', error);
    throw error;
  }
  
  return ratelimitInstance;
}

function getGroupRatelimit(): Ratelimit {
  if (groupRatelimitInstance) return groupRatelimitInstance;
  
  try {
    groupRatelimitInstance = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      analytics: true,
      prefix: 'tgm:group'
    });
  } catch (error) {
    console.error('Failed to initialize GroupRatelimit:', error);
    throw error;
  }
  
  return groupRatelimitInstance;
}

function getUserRatelimit(): Ratelimit {
  if (userRatelimitInstance) return userRatelimitInstance;
  
  try {
    userRatelimitInstance = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      analytics: true,
      prefix: 'tgm:user'
    });
  } catch (error) {
    console.error('Failed to initialize UserRatelimit:', error);
    throw error;
  }
  
  return userRatelimitInstance;
}

export const ratelimit = new Proxy({} as Ratelimit, {
  get(target, prop) {
    return getRatelimit()[prop as keyof Ratelimit];
  }
});

export const groupRatelimit = new Proxy({} as Ratelimit, {
  get(target, prop) {
    return getGroupRatelimit()[prop as keyof Ratelimit];
  }
});

export const userRatelimit = new Proxy({} as Ratelimit, {
  get(target, prop) {
    return getUserRatelimit()[prop as keyof Ratelimit];
  }
});

export async function cacheSet(key: string, value: string | number | object, ttlSeconds?: number): Promise<void> {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  const r = getRedis();
  if (ttlSeconds) {
    await r.setex(key, ttlSeconds, serialized);
  } else {
    await r.set(key, serialized);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const r = getRedis();
  const value = await r.get(key);
  if (!value) return null;
  if (typeof value === 'string') return value as unknown as T;
  try {
    return JSON.parse(value as string) as T;
  } catch {
    return value as unknown as T;
  }
}

export async function cacheDel(key: string): Promise<void> {
  const r = getRedis();
  await r.del(key);
}

export async function cacheIncr(key: string, ttlSeconds?: number): Promise<number> {
  const r = getRedis();
  const result = await r.incr(key);
  if (ttlSeconds && result === 1) {
    await r.expire(key, ttlSeconds);
  }
  return result;
}

export interface CacheOptions {
  ttl?: number;
  prefix?: string;
}

export function createCacheKey(prefix: string, ...parts: (string | number)[]): string {
  return `${prefix}:${parts.join(':')}`;
}

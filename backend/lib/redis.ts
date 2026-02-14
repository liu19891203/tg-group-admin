import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
  console.warn('Upstash Redis credentials not configured');
}

export const redis = new Redis({
  url: redisUrl || '',
  token: redisToken || ''
});

export const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '10 s'),
  analytics: true,
  prefix: 'tgm'
});

export const groupRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  analytics: true,
  prefix: 'tgm:group'
});

export const userRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 m'),
  analytics: true,
  prefix: 'tgm:user'
});

export async function cacheSet(key: string, value: string | number | object, ttlSeconds?: number): Promise<void> {
  const serialized = typeof value === 'string' ? value : JSON.stringify(value);
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, serialized);
  } else {
    await redis.set(key, serialized);
  }
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const value = await redis.get(key);
  if (!value) return null;
  if (typeof value === 'string') return value as unknown as T;
  try {
    return JSON.parse(value as string) as T;
  } catch {
    return value as unknown as T;
  }
}

export async function cacheDel(key: string): Promise<void> {
  await redis.del(key);
}

export async function cacheIncr(key: string, ttlSeconds?: number): Promise<number> {
  const result = await redis.incr(key);
  if (ttlSeconds && result === 1) {
    await redis.expire(key, ttlSeconds);
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

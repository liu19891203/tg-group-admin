import { Redis } from '@upstash/redis';
import { Ratelimit } from '@upstash/ratelimit';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

let redis: Redis;
let isRedisConfigured = false;

if (redisUrl && redisToken) {
  try {
    redis = new Redis({
      url: redisUrl,
      token: redisToken
    });
    isRedisConfigured = true;
    console.log('Redis configured successfully');
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
  }
}

if (!isRedisConfigured) {
  console.warn('Upstash Redis credentials not configured, using in-memory fallback');
  redis = new Redis({
    url: 'https://localhost',
    token: 'fallback'
  });
}

export { redis, isRedisConfigured };

let ratelimit: Ratelimit;
let groupRatelimit: Ratelimit;
let userRatelimit: Ratelimit;

try {
  ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(30, '10 s'),
    analytics: true,
    prefix: 'tgm'
  });

  groupRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '1 m'),
    analytics: true,
    prefix: 'tgm:group'
  });

  userRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(20, '1 m'),
    analytics: true,
    prefix: 'tgm:user'
  });
} catch (error) {
  console.error('Failed to initialize Ratelimit:', error);
  ratelimit = null as any;
  groupRatelimit = null as any;
  userRatelimit = null as any;
}

export { ratelimit, groupRatelimit, userRatelimit };

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

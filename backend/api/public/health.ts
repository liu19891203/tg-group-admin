// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabase } from '../../lib/database';
import { redis } from '../../lib/redis';

export async function handleHealth(req: VercelRequest, res: VercelResponse) {
  try {
    const [dbStatus, redisStatus] = await Promise.all([
      checkDatabase(),
      checkRedis()
    ]);

    const allHealthy = dbStatus && redisStatus;

    const status = {
      status: allHealthy ? 'ok' : 'degraded',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        database: dbStatus,
        redis: redisStatus
      }
    };

    return res.status(allHealthy ? 200 : 503).json(status);

  } catch (error) {
    console.error('Health check error:', error);
    return res.status(503).json({
      status: 'error',
      error: 'Health check failed'
    });
  }
}

async function checkDatabase(): Promise<boolean> {
  try {
    await supabase.from('groups').select('id').limit(1).then();
    return true;
  } catch {
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  try {
    await redis.ping();
    return true;
  } catch {
    return false;
  }
}

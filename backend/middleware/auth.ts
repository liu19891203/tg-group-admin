// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../lib/database';
import { redis } from '../lib/redis';
import * as crypto from 'crypto';

interface AdminUser {
  id: string;
  telegram_id: number;
  username?: string;
  display_name?: string;
  level: number;
  permissions: string[];
  is_active: boolean;
  last_login_at?: string;
  created_at?: string;
}

interface JWTPayload {
  sub: string;
  telegram_id: number;
  level: number;
  exp: number;
  iat: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const TOKEN_EXPIRY = 7 * 24 * 60 * 60;

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return Buffer.from(str, 'base64').toString();
}

function createHmacSignature(data: string): string {
  return crypto
    .createHmac('sha256', JWT_SECRET)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export function createJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + TOKEN_EXPIRY
  }));

  const signature = createHmacSignature(`${encodedHeader}.${encodedPayload}`);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, providedSignature] = parts;
    
    const expectedSignature = createHmacSignature(`${encodedHeader}.${encodedPayload}`);
    if (providedSignature !== expectedSignature) {
      console.warn('JWT signature verification failed');
      return null;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp < now) {
      return null;
    }

    return payload as JWTPayload;
  } catch {
    return null;
  }
}

export async function verifyAdmin(req: VercelRequest): Promise<AdminUser | null> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const payload = verifyJWT(token);

  if (!payload) {
    return null;
  }

  const { data: admin } = await supabaseAdmin
    .from('admins')
    .select('*')
    .eq('telegram_id', payload.telegram_id)
    .eq('is_active', true)
    .single();

  if (!admin) {
    return null;
  }

  return admin;
}

export async function requireAdmin(req: VercelRequest, res: VercelResponse): Promise<AdminUser | null> {
  const admin = await verifyAdmin(req);

  if (!admin) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
    return null;
  }

  return admin;
}

export async function requireSuperAdmin(
  req: VercelRequest,
  res: VercelResponse
): Promise<AdminUser | null> {
  const admin = await requireAdmin(req, res);

  if (!admin) {
    return null;
  }

  if (admin.level < 10) {
    res.status(403).json({
      error: 'Forbidden',
      message: 'Super admin required'
    });
    return null;
  }

  return admin;
}

export async function handleLogin(req: VercelRequest, res: VercelResponse) {
  const { token, telegram_init_data } = req.body;

  let telegramId: number;

  if (token) {
    const payload = verifyJWT(token);
    if (!payload) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    telegramId = payload.telegram_id;
  } else if (telegram_init_data) {
    try {
      const data = JSON.parse(telegram_init_data);
      telegramId = data.user?.id;
      
      if (!telegramId) {
        return res.status(400).json({ error: 'Invalid Telegram data' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid Telegram data format' });
    }
  } else {
    return res.status(400).json({ error: 'token or telegram_init_data required' });
  }

  const { data: admin, error } = await supabaseAdmin
    .from('admins')
    .select('*')
    .eq('telegram_id', telegramId)
    .eq('is_active', true)
    .single();

  if (error || !admin) {
    return res.status(403).json({
      error: 'Access denied',
      message: 'You are not an admin'
    });
  }

  const jwtToken = createJWT({
    sub: admin.id,
    telegram_id: admin.telegram_id,
    level: admin.level
  });

  await supabaseAdmin
    .from('admins')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', admin.id);

  return res.status(200).json({
    token: jwtToken,
    expires_in: TOKEN_EXPIRY,
    admin: {
      id: admin.id,
      telegram_id: admin.telegram_id,
      username: admin.username,
      display_name: admin.display_name,
      level: admin.level,
      permissions: admin.permissions
    }
  });
}

export async function handleRefreshToken(req: VercelRequest, res: VercelResponse) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token required' });
  }

  const oldToken = authHeader.substring(7);
  const payload = verifyJWT(oldToken);

  if (!payload) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { data: admin } = await supabaseAdmin
    .from('admins')
    .select('*')
    .eq('telegram_id', payload.telegram_id)
    .eq('is_active', true)
    .single();

  if (!admin) {
    return res.status(401).json({ error: 'Admin not found' });
  }

  const newToken = createJWT({
    sub: admin.id,
    telegram_id: admin.telegram_id,
    level: admin.level
  });

  return res.status(200).json({
    token: newToken,
    expires_in: TOKEN_EXPIRY
  });
}

export async function handleGetProfile(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res);

  if (!admin) {
    return;
  }

  return res.status(200).json({
    data: {
      id: admin.id,
      telegram_id: admin.telegram_id,
      username: admin.username,
      display_name: admin.display_name,
      level: admin.level,
      permissions: admin.permissions,
      last_login_at: admin.last_login_at,
      created_at: admin.created_at
    }
  });
}

export async function handleLogout(req: VercelRequest, res: VercelResponse) {
  const admin = await requireAdmin(req, res);

  if (!admin) {
    return;
  }

  return res.status(200).json({ success: true });
}

export function checkPermission(admin: AdminUser, permission: string): boolean {
  if (admin.level >= 10) {
    return true;
  }

  return admin.permissions.includes(permission);
}

export async function rateLimitCheck(
  adminId: string,
  limit: number = 100,
  window: number = 60
): Promise<{ allowed: boolean; remaining: number; resetIn: number }> {
  const key = `ratelimit:${adminId}`;
  const now = Date.now();
  const windowMs = window * 1000;

  const current = await redis.get<number[]>(key) || [];

  const recentRequests = current.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= limit) {
    const oldest = Math.min(...recentRequests);
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.ceil((oldest + windowMs - now) / 1000)
    };
  }

  await redis.setex(key, window, [...recentRequests, now]);

  return {
    allowed: true,
    remaining: limit - recentRequests.length - 1,
    resetIn: window
  };
}

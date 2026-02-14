import { createServer } from 'http';
import { parse } from 'url';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = 3000;

const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
}

async function loadHandler(handlerPath: string) {
  try {
    const fileUrl = pathToFileURL(handlerPath).href;
    const module = await import(fileUrl);
    return module.default;
  } catch (error) {
    console.error(`Failed to load handler: ${handlerPath}`, error);
    return null;
  }
}

function createVercelResponse(res: any): any {
  let statusCode = 200;
  const response = {
    status: (code: number) => {
      statusCode = code;
      return response;
    },
    json: (data: any) => {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.end(JSON.stringify(data));
    },
    end: (data?: string) => {
      res.statusCode = statusCode;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.end(data || '');
    },
    setHeader: (name: string, value: string) => {
      res.setHeader(name, value);
      return response;
    },
    getHeader: (name: string) => res.getHeader(name),
    removeHeader: (name: string) => res.removeHeader(name),
    writeHead: (code: number, headers?: any) => {
      statusCode = code;
      if (headers) {
        Object.entries(headers).forEach(([key, value]) => {
          res.setHeader(key, value as string);
        });
      }
      return response;
    }
  };
  return response;
}

async function handleRequest(req: any, res: any) {
  const parsedUrl = parse(req.url || '/', true);
  const pathname = parsedUrl.pathname || '/';
  
  console.log(`${new Date().toISOString()} ${req.method} ${pathname}`);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  let handlerPath: string | null = null;

  if (pathname === '/api/telegram/webhook') {
    handlerPath = join(__dirname, 'api/telegram/webhook.ts');
  } else if (pathname === '/api/public/health') {
    handlerPath = join(__dirname, 'api/public/health.ts');
  } else if (pathname === '/api/public/crypto') {
    handlerPath = join(__dirname, 'api/public/crypto.ts');
  } else if (pathname === '/api/admin/invite-links' || pathname.startsWith('/api/admin/invite-links?')) {
    handlerPath = join(__dirname, 'api/admin/invite-links.ts');
  } else if (pathname === '/api/admin/verified-users' || pathname.startsWith('/api/admin/verified-users?')) {
    handlerPath = join(__dirname, 'api/admin/verified-users.ts');
  } else if (pathname === '/api/admin/chat-stats' || pathname.startsWith('/api/admin/chat-stats?')) {
    handlerPath = join(__dirname, 'api/admin/chat-stats.ts');
  } else if (pathname === '/api/admin/crypto-config' || pathname.startsWith('/api/admin/crypto-config?')) {
    handlerPath = join(__dirname, 'api/admin/crypto-config.ts');
  } else if (pathname === '/api/admin/anti-spam' || pathname.startsWith('/api/admin/anti-spam?')) {
    handlerPath = join(__dirname, 'api/admin/anti-spam.ts');
  } else if (pathname === '/api/admin/commands' || pathname.startsWith('/api/admin/commands?')) {
    handlerPath = join(__dirname, 'api/admin/commands.ts');
  } else if (pathname === '/api/admin/scheduled-messages' || pathname.startsWith('/api/admin/scheduled-messages?')) {
    handlerPath = join(__dirname, 'api/admin/scheduled-messages.ts');
  } else if (pathname.startsWith('/api/admin/lottery/')) {
    const lotteryPath = pathname.replace('/api/admin/lottery/', '');
    if (lotteryPath === 'participate') {
      handlerPath = join(__dirname, 'api/admin/lottery/participate.ts');
    } else if (lotteryPath === 'draw') {
      handlerPath = join(__dirname, 'api/admin/lottery/draw.ts');
    } else {
      handlerPath = join(__dirname, 'api/admin/lottery.ts');
    }
  } else if (pathname.startsWith('/api/admin/points/')) {
    const pointsPath = pathname.replace('/api/admin/points/', '');
    if (pointsPath === 'checkin') {
      handlerPath = join(__dirname, 'api/admin/points/checkin.ts');
    } else if (pointsPath === 'rank') {
      handlerPath = join(__dirname, 'api/admin/points/rank.ts');
    } else {
      handlerPath = join(__dirname, 'api/admin/points.ts');
    }
  } else if (pathname.startsWith('/api/admin/auto-replies/')) {
    const autoReplyPath = pathname.replace('/api/admin/auto-replies/', '');
    if (autoReplyPath === 'match') {
      handlerPath = join(__dirname, 'api/admin/auto-replies/match.ts');
    } else {
      handlerPath = join(__dirname, 'api/admin/auto-replies.ts');
    }
  } else if (pathname.startsWith('/api/admin/anti-ads/')) {
    const antiAdsPath = pathname.replace('/api/admin/anti-ads/', '');
    if (antiAdsPath === 'detect') {
      handlerPath = join(__dirname, 'api/admin/anti-ads/detect.ts');
    } else {
      handlerPath = join(__dirname, 'api/admin/anti-ads.ts');
    }
  } else if (pathname.startsWith('/api/admin/verification/')) {
    const verificationPath = pathname.replace('/api/admin/verification/', '');
    if (verificationPath === 'challenge') {
      handlerPath = join(__dirname, 'api/admin/verification/challenge.ts');
    } else if (verificationPath === 'verify') {
      handlerPath = join(__dirname, 'api/admin/verification/verify.ts');
    } else {
      handlerPath = join(__dirname, 'api/admin/verification.ts');
    }
  } else if (pathname.startsWith('/api/admin/auth/')) {
    const authPath = pathname.replace('/api/admin/auth/', '');
    handlerPath = join(__dirname, `api/admin/auth/${authPath}.ts`);
  } else if (pathname === '/api/admin/groups') {
    handlerPath = join(__dirname, 'api/admin/groups.ts');
  } else if (pathname === '/api/admin/login') {
    handlerPath = join(__dirname, 'api/admin/login.ts');
  } else if (pathname.startsWith('/api/admin/')) {
    const adminPath = pathname.replace('/api/admin/', '');
    // 处理带查询参数的路径
    const cleanPath = adminPath.split('?')[0];
    const specificPath = join(__dirname, `api/admin/${cleanPath}.ts`);
    
    // 如果特定路径不存在，使用 mock-config
    if (existsSync(specificPath)) {
      handlerPath = specificPath;
    } else {
      handlerPath = join(__dirname, 'api/admin/mock-config.ts');
    }
  } else if (pathname.startsWith('/api/cron/')) {
    handlerPath = join(__dirname, 'api/cron/index.ts');
  }

  if (handlerPath && existsSync(handlerPath)) {
    const handler = await loadHandler(handlerPath);
    if (handler) {
      try {
        await handler(req, res);
        return;
      } catch (error) {
        console.error('Handler error:', error);
        res.status(500).json({ error: 'Internal server error' });
        return;
      }
    }
  }

  if (pathname === '/' || pathname === '/health') {
    res.status(200).json({ 
      status: 'ok', 
      message: 'Telegram Group Manager Backend',
      timestamp: new Date().toISOString()
    });
    return;
  }

  res.status(404).json({ error: 'Not found', path: pathname });
}

function parseBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch {
        req.body = {};
      }
      resolve(undefined);
    });
  });
}

const server = createServer(async (req, res) => {
  await parseBody(req);
  req.query = parse(req.url || '/', true).query;
  req.headers = req.headers || {};
  const vercelRes = createVercelResponse(res);
  await handleRequest(req, vercelRes);
});

server.listen(PORT, () => {
  console.log(`\n🚀 Local development server running at http://localhost:${PORT}`);
  console.log(`📡 Telegram Webhook: http://localhost:${PORT}/api/telegram/webhook`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/health\n`);
});

import { createServer } from 'http';
import { existsSync } from 'fs';
import { join } from 'path';
import { pathToFileURL, URL } from 'url';

const __dirname = process.cwd();

const PORT = 3000;

// 设置mock环境变量
process.env.NODE_ENV = 'development';
process.env.SUPABASE_URL = 'https://mock.supabase.co';
process.env.SUPABASE_ANON_KEY = 'mock_anon_key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock_service_role_key';
process.env.JWT_SECRET = 'mock_jwt_secret_key_for_development';
process.env.TELEGRAM_BOT_TOKEN = 'mock_bot_token';

// API路由映射
const apiRoutes: Record<string, string> = {
  '/api/admin/permissions': './api/admin/mock-permissions.ts',
  '/api/admin/memberships': './api/admin/mock-memberships.ts',
  '/api/admin/groups': './api/admin/mock-groups.ts',
  '/api/admin/upload': './api/admin/mock-upload.ts',
  '/api/admin/send-message': './api/admin/mock-send-message.ts',
  '/api/admin/verification': './api/admin/mock-verification.ts',
  '/api/admin/keywords': './api/admin/mock-keywords.ts',
  '/api/admin/lottery': './api/admin/mock-lottery.ts',
  '/api/admin/channel-forwards': './api/admin/channel-forwards.ts',
  '/api/admin/invite-stats': './api/admin/invite-stats.ts',
  '/api/admin/super-tools': './api/admin/mock-super-tools.ts',
  '/api/admin/crypto': './api/admin/mock-crypto.ts',
  '/api/admin/settings': './api/admin/mock-settings.ts',
  '/api/admin/admins': './api/admin/mock-settings.ts',
  '/api/admin/dashboard': './api/admin/mock-dashboard.ts',
  // 新增API路由
  '/api/admin/menu-permissions': './api/admin/menu-permissions.ts',
  '/api/admin/users-search': './api/admin/users-search.ts',
  '/api/admin/crypto-query': './api/admin/crypto-query.ts',
  '/api/admin/crypto-rates': './api/admin/crypto-rates.ts'
};

// 默认mock响应
const defaultMockResponse = (path: string) => ({
  success: true,
  data: {
    message: `Mock API response for ${path}`,
    timestamp: new Date().toISOString()
  }
});

async function loadHandler(handlerPath: string) {
  try {
    const fullPath = join(__dirname, handlerPath);
    const fileUrl = pathToFileURL(fullPath).href;
    const module = await import(fileUrl);
    return module.default;
  } catch (error) {
    console.error(`Failed to load handler: ${handlerPath}`, error);
    return null;
  }
}

function createVercelResponse(res: any): any {
  let statusCode = 200;
  const headers: Record<string, string> = {};
  
  const response = {
    status: (code: number) => {
      statusCode = code;
      return response;
    },
    setHeader: (name: string, value: string) => {
      headers[name] = value;
      return response;
    },
    json: (data: any) => {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'application/json');
      // 应用自定义headers
      Object.entries(headers).forEach(([name, value]) => {
        res.setHeader(name, value);
      });
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.end(JSON.stringify(data));
    },
    send: (data: any) => {
      res.statusCode = statusCode;
      res.setHeader('Content-Type', 'text/plain');
      // 应用自定义headers
      Object.entries(headers).forEach(([name, value]) => {
        res.setHeader(name, value);
      });
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end(data);
    },
    end: () => {
      res.statusCode = statusCode;
      res.end();
    }
  };
  return response;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathname = url.pathname;
  const query = Object.fromEntries(url.searchParams.entries());
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.statusCode = 200;
    res.end();
    return;
  }

  // 处理API请求
  if (pathname && pathname.startsWith('/api/')) {
    let handlerPath: string | null = null;
    
    // 查找匹配的路由 - 按长度降序排序，确保更具体的路由先匹配
    const sortedRoutes = Object.entries(apiRoutes).sort((a, b) => b[0].length - a[0].length);
    
    for (const [route, handler] of sortedRoutes) {
      // 精确匹配或路径前缀匹配（确保是完整路径段）
      if (pathname === route || pathname.startsWith(route + '/') || pathname.startsWith(route + '?')) {
        handlerPath = handler;
        break;
      }
    }

    if (handlerPath) {
      const handler = await loadHandler(handlerPath);
      if (handler) {
        try {
          const vercelReq = {
            ...req,
            url: req.url,
            method: req.method,
            query,
            body: await getRequestBody(req)
          };
          
          const vercelRes = createVercelResponse(res);
          await handler(vercelReq, vercelRes);
        } catch (error) {
          console.error('Handler execution error:', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Internal server error' }));
        }
      } else {
        // 返回默认mock响应
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(defaultMockResponse(pathname)));
      }
    } else {
      // 未知API路径，返回404
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'API endpoint not found', path: pathname }));
    }
    return;
  }

  // 处理静态文件请求（用于前端开发）
  res.statusCode = 404;
  res.setHeader('Content-Type', 'text/plain');
  res.end('Not found');
});

function getRequestBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    if (req.method === 'GET') {
      resolve({});
      return;
    }

    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

server.listen(PORT, () => {
  console.log(`🚀 Mock API server running on http://localhost:${PORT}`);
  console.log('📋 Available API endpoints:');
  Object.keys(apiRoutes).forEach(route => {
    console.log(`   ${route}`);
  });
  console.log('🔧 Using mock data for development');
});
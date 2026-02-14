import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../lib/mockDb';

interface GroupCommand {
  command: string;
  description: string;
  type: 'admin' | 'user';
  enabled: boolean;
  auto_delete: boolean;
  delete_delay?: number;
  response?: string;
  permissions?: string[];
}

interface CommandConfig {
  enabled: boolean;
  auto_delete_all: boolean;
  commands: GroupCommand[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权' });
    }

    if (req.method === 'GET') {
      const groupId = req.query.groupId as string;
      if (!groupId) {
        return res.status(400).json({ error: '群组ID不能为空' });
      }

      const defaultConfig: CommandConfig = {
        enabled: true,
        auto_delete_all: true,
        commands: [
          {
            command: '/reload',
            description: '更新群组管理员，绑定频道后需要发送',
            type: 'admin',
            enabled: true,
            auto_delete: true,
            permissions: ['admin', 'owner']
          },
          {
            command: '/mute',
            description: '禁言消息主，可设定时间（秒）',
            type: 'admin',
            enabled: true,
            auto_delete: true,
            permissions: ['admin', 'owner']
          },
          {
            command: '/ban',
            description: '封禁消息主',
            type: 'admin',
            enabled: true,
            auto_delete: true,
            permissions: ['admin', 'owner']
          },
          {
            command: '/kick',
            description: '踢出消息主（踢出后可以重新加群）',
            type: 'admin',
            enabled: true,
            auto_delete: true,
            permissions: ['admin', 'owner']
          },
          {
            command: '/warn',
            description: '警告消息主（警告超过次数踢出）',
            type: 'admin',
            enabled: true,
            auto_delete: true,
            permissions: ['admin', 'owner']
          },
          {
            command: '/config',
            description: '呼出配置内容',
            type: 'admin',
            enabled: true,
            auto_delete: true,
            permissions: ['admin', 'owner']
          },
          {
            command: '/checkin',
            description: '签到获取积分',
            type: 'user',
            enabled: true,
            auto_delete: false
          },
          {
            command: '/me',
            description: '查看个人信息与积分',
            type: 'user',
            enabled: true,
            auto_delete: false
          },
          {
            command: '/help',
            description: '查看帮助信息',
            type: 'user',
            enabled: true,
            auto_delete: false
          }
        ]
      };

      return res.status(200).json({ data: defaultConfig });

    } else if (req.method === 'POST' || req.method === 'PUT') {
      const { groupId, config } = req.body as {
        groupId: string;
        config: CommandConfig;
      };

      if (!groupId || !config) {
        return res.status(400).json({ error: '参数不完整' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '命令配置已更新',
        config 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Commands config error:', error);
    return res.status(500).json({ error: '操作失败' });
  }
}

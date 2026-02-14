import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../lib/mockDb';

interface AntiAdsConfig {
  enabled: boolean;
  keywords: string[];
  punishment: 'delete' | 'warn' | 'mute' | 'kick' | 'ban';
  warn_limit: number;
  ai_enabled: boolean;
  image_scan_enabled: boolean;
  sticker_check_enabled: boolean;
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

      const defaultConfig: AntiAdsConfig = {
        enabled: false,
        keywords: ['微信', 'QQ', '加群', '私聊', '推广', '广告'],
        punishment: 'delete',
        warn_limit: 3,
        ai_enabled: false,
        image_scan_enabled: false,
        sticker_check_enabled: true
      };

      return res.status(200).json({ data: defaultConfig });

    } else if (req.method === 'POST' || req.method === 'PUT') {
      const { groupId, config } = req.body as {
        groupId: string;
        config: AntiAdsConfig;
      };

      if (!groupId || !config) {
        return res.status(400).json({ error: '参数不完整' });
      }

      // 验证配置格式
      if (!['delete', 'warn', 'mute', 'kick', 'ban'].includes(config.punishment)) {
        return res.status(400).json({ error: '惩罚措施无效' });
      }

      if (config.warn_limit < 1 || config.warn_limit > 10) {
        return res.status(400).json({ error: '警告次数限制应在1-10之间' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '广告过滤配置已更新',
        config 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Anti-ads config error:', error);
    return res.status(500).json({ error: '操作失败' });
  }
}

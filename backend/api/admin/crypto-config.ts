import { VercelRequest, VercelResponse } from '@vercel/node';

interface CryptoConfig {
  enabled: boolean;
  default_currency: string;
  update_interval: number;
  tracked_coins: string[];
  price_alerts: Array<{
    symbol: string;
    target_price: number;
    condition: 'above' | 'below';
    enabled: boolean;
  }>;
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

      const defaultConfig: CryptoConfig = {
        enabled: true,
        default_currency: 'CNY',
        update_interval: 60,
        tracked_coins: ['BTC', 'ETH', 'BNB', 'SOL', 'TON'],
        price_alerts: [
          {
            symbol: 'BTC',
            target_price: 500000,
            condition: 'above',
            enabled: true
          },
          {
            symbol: 'ETH',
            target_price: 20000,
            condition: 'above',
            enabled: true
          }
        ]
      };

      return res.status(200).json({ data: defaultConfig });

    } else if (req.method === 'POST' || req.method === 'PUT') {
      const { groupId, config } = req.body as {
        groupId: string;
        config: CryptoConfig;
      };

      if (!groupId || !config) {
        return res.status(400).json({ error: '参数不完整' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '加密货币配置已更新',
        config 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Crypto config error:', error);
    return res.status(500).json({ error: '操作失败' });
  }
}

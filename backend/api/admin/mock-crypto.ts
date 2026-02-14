import type { VercelRequest, VercelResponse } from '@vercel/node';

// Mock 加密货币配置数据
const mockCryptoConfig = {
  is_enabled: true,
  supported_coins: [
    { symbol: 'BTC', name: 'Bitcoin', is_enabled: true },
    { symbol: 'ETH', name: 'Ethereum', is_enabled: true },
    { symbol: 'USDT', name: 'Tether', is_enabled: true },
    { symbol: 'BNB', name: 'Binance Coin', is_enabled: false }
  ],
  price_update_interval: 60,
  alert_threshold: 5,
  show_market_cap: true,
  show_volume: true,
  default_currency: 'USD'
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        return res.status(200).json({
          success: true,
          data: mockCryptoConfig
        });

      case 'PUT':
        const updatedConfig = { ...mockCryptoConfig, ...req.body };
        return res.status(200).json({
          success: true,
          data: updatedConfig
        });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Crypto API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

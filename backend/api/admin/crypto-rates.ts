import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 获取实时汇率数据
    const rates = await getExchangeRates();
    
    return res.status(200).json({
      success: true,
      data: rates,
      update_time: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
    });
  } catch (error: any) {
    console.error('Get crypto rates error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 获取交易所USDT/CNY汇率
async function getExchangeRates() {
  // 模拟三大交易所的USDT/CNY汇率
  const basePrice = 7.20 + (Math.random() * 0.10 - 0.05); // 基础价格在7.15-7.25之间波动
  
  const exchanges = [
    {
      name: '币安',
      key: 'binance',
      buy_price: (basePrice + 0.01).toFixed(4),
      sell_price: (basePrice - 0.01).toFixed(4),
      change_24h: (Math.random() * 2 - 1).toFixed(2), // -1% 到 +1%
      volume_24h: (Math.random() * 1000000000 + 500000000).toFixed(0),
      logo: 'https://www.binance.com/favicon.ico'
    },
    {
      name: '欧易',
      key: 'okx',
      buy_price: (basePrice + 0.015).toFixed(4),
      sell_price: (basePrice - 0.015).toFixed(4),
      change_24h: (Math.random() * 2 - 1).toFixed(2),
      volume_24h: (Math.random() * 800000000 + 400000000).toFixed(0),
      logo: 'https://www.okx.com/favicon.ico'
    },
    {
      name: '火币',
      key: 'huobi',
      buy_price: (basePrice + 0.008).toFixed(4),
      sell_price: (basePrice - 0.008).toFixed(4),
      change_24h: (Math.random() * 2 - 1).toFixed(2),
      volume_24h: (Math.random() * 600000000 + 300000000).toFixed(0),
      logo: 'https://www.huobi.com/favicon.ico'
    }
  ];
  
  // 按买入价排序
  exchanges.sort((a, b) => parseFloat(b.buy_price) - parseFloat(a.buy_price));
  
  return {
    pair: 'USDT/CNY',
    exchanges,
    highest_buy: exchanges[0].buy_price,
    lowest_sell: exchanges[exchanges.length - 1].sell_price,
    avg_price: (exchanges.reduce((sum, ex) => sum + parseFloat(ex.buy_price), 0) / exchanges.length).toFixed(4)
  };
}

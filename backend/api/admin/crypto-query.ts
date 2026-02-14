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
    const { address, chain, page = '1', page_size = '10' } = req.query;
    
    if (!address || !chain) {
      return res.status(400).json({
        success: false,
        error: '缺少地址或链类型参数'
      });
    }

    // 验证地址格式
    const chainPatterns: Record<string, RegExp> = {
      'ERC20': /^0x[a-fA-F0-9]{40}$/,
      'TRC20': /^T[a-zA-Z0-9]{33}$/,
      'BEP20': /^0x[a-fA-F0-9]{40}$/,
      'BEP2': /^bnb[a-zA-Z0-9]{39}$/,
      'SOL': /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
      'BTC': /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/
    };

    const pattern = chainPatterns[chain as string];
    if (pattern && !pattern.test(address as string)) {
      return res.status(400).json({
        success: false,
        error: `地址格式不符合 ${chain} 标准`
      });
    }

    // 模拟查询结果
    const result = await mockQueryAddress(
      address as string, 
      chain as string, 
      Number(page), 
      Number(page_size)
    );
    
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('Crypto query error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 模拟地址查询
async function mockQueryAddress(address: string, chain: string, page: number, pageSize: number) {
  // 生成模拟余额
  const balance = (Math.random() * 100000).toFixed(2);
  const usdValue = (parseFloat(balance) * 1).toFixed(2); // USDT = 1 USD
  
  // 生成模拟交易记录
  const totalTransactions = Math.floor(Math.random() * 500) + 50;
  const totalPages = Math.ceil(totalTransactions / pageSize);
  
  const transactions = [];
  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalTransactions);
  
  for (let i = startIndex; i < endIndex; i++) {
    const isIncoming = Math.random() > 0.5;
    const amount = (Math.random() * 10000).toFixed(2);
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));
    
    transactions.push({
      tx_hash: `0x${Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      type: isIncoming ? 'incoming' : 'outgoing',
      amount: amount,
      from: isIncoming ? `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}` : address,
      to: isIncoming ? address : `0x${Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('')}`,
      timestamp: date.toISOString(),
      status: 'confirmed',
      confirmations: Math.floor(Math.random() * 100) + 10
    });
  }
  
  return {
    address,
    chain,
    token: 'USDT',
    balance,
    usd_value: usdValue,
    transaction_count: totalTransactions,
    current_page: page,
    total_pages: totalPages,
    page_size: pageSize,
    transactions
  };
}

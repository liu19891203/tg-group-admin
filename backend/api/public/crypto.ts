// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { cryptoService } from '../../services/cryptoService';

export async function handleCryptoPrice(req: VercelRequest, res: VercelResponse) {
  const { symbol, address, chain } = req.query;

  try {
    if (symbol) {
      const price = await cryptoService.getPrice(symbol as string);

      if (!price) {
        return res.status(404).json({ error: 'Cryptocurrency not found' });
      }

      return res.status(200).json({
        data: {
          symbol: price.symbol,
          name: price.name,
          price: cryptoService.formatPrice(price.current_price, price.symbol),
          price_raw: price.current_price,
          change_24h: cryptoService.formatChange(price.price_change_percentage_24h),
          market_cap: `$${(price.market_cap / 1e6).toFixed(2)}M`,
          volume: `$${(price.total_volume / 1e6).toFixed(2)}M`,
          updated_at: price.last_updated
        }
      });
    }

    if (address && chain) {
      const balance = await cryptoService.getAddressBalance(
        chain as string,
        address as string
      );

      if (!balance) {
        return res.status(404).json({ error: 'Address not found or invalid' });
      }

      return res.status(200).json({
        data: {
          address: balance.address,
          chain: balance.chain,
          balance: `${balance.balance.toFixed(2)} ${balance.symbol}`,
          balance_raw: balance.balance,
          usdt_price: `$${balance.usdt_price.toFixed(2)}`
        }
      });
    }

    const usdtPrice = await cryptoService.getUsdtPrice();

    return res.status(200).json({
      data: {
        symbol: 'USDT',
        name: 'Tether',
        price: `¥${usdtPrice.price.toFixed(2)}`,
        change_24h: cryptoService.formatChange(usdtPrice.change24h),
        source: usdtPrice.source
      }
    });

  } catch (error) {
    console.error('Crypto API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function handleCryptoBatch(req: VercelRequest, res: VercelResponse) {
  const { symbols } = req.body;

  if (!symbols || !Array.isArray(symbols)) {
    return res.status(400).json({ error: 'symbols array is required' });
  }

  try {
    const prices = await cryptoService.getPrices(symbols);

    return res.status(200).json({
      data: prices.map(p => ({
        symbol: p.symbol,
        name: p.name,
        price: cryptoService.formatPrice(p.current_price, p.symbol),
        change_24h: cryptoService.formatChange(p.price_change_percentage_24h)
      }))
    });

  } catch (error) {
    console.error('Crypto batch API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

export async function handleCryptoTrending(req: VercelRequest, res: VercelResponse) {
  try {
    const trending = await cryptoService.getTrending();

    return res.status(200).json({
      data: trending.map(t => ({
        name: t.name,
        symbol: t.symbol,
        price: cryptoService.formatPrice(t.price, t.symbol),
        change_24h: cryptoService.formatChange(t.change24h)
      }))
    });

  } catch (error) {
    console.error('Crypto trending API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

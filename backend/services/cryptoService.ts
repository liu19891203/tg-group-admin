// @ts-nocheck
import axios from 'axios';

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number;
  market_cap: number;
  total_volume: number;
  last_updated: string;
}

interface AddressInfo {
  address: string;
  chain: string;
  balance: number;
  symbol: string;
  decimals: number;
  usdt_price: number;
}

export const cryptoService = {
  async getPrice(symbol: string): Promise<CryptoPrice | null> {
    try {
      const { data } = await axios.get(`${COINGECKO_API}/simple/price`, {
        params: {
          ids: this.mapSymbolToId(symbol),
          vs_currencies: 'usd',
          include_24hr_change: true,
          include_market_cap: true,
          include_24hr_vol: true
        }
      });

      const coinId = this.mapSymbolToId(symbol);
      const coinData = data[coinId];

      if (!coinData) {
        return null;
      }

      return {
        id: coinId,
        symbol: symbol.toUpperCase(),
        name: this.getCoinName(coinId),
        current_price: coinData.usd || 0,
        price_change_percentage_24h: coinData.usd_24h_change || 0,
        market_cap: coinData.usd_market_cap || 0,
        total_volume: coinData.usd_24h_vol || 0,
        last_updated: new Date().toISOString()
      };

    } catch (error) {
      console.error('Get crypto price error:', error);
      return null;
    }
  },

  async getPrices(symbols: string[]): Promise<CryptoPrice[]> {
    try {
      const ids = symbols.map(s => this.mapSymbolToId(s)).join(',');

      const { data } = await axios.get(`${COINGECKO_API}/simple/price`, {
        params: {
          ids,
          vs_currencies: 'usd',
          include_24hr_change: true,
          include_market_cap: true,
          include_24hr_vol: true
        }
      });

      return Object.entries(data).map(([id, coinData]: [string, any]) => ({
        id,
        symbol: this.getSymbolFromId(id),
        name: this.getCoinName(id),
        current_price: coinData.usd || 0,
        price_change_percentage_24h: coinData.usd_24h_change || 0,
        market_cap: coinData.usd_market_cap || 0,
        total_volume: coinData.usd_24h_vol || 0,
        last_updated: new Date().toISOString()
      }));

    } catch (error) {
      console.error('Get crypto prices error:', error);
      return [];
    }
  },

  async getUsdtPrice(): Promise<{
    price: number;
    change24h: number;
    source: string;
  }> {
    try {
      const { data } = await axios.get(`${COINGECKO_API}/simple/price`, {
        params: {
          ids: 'tether',
          vs_currencies: 'cny',
          include_24hr_change: true
        }
      });

      const cnyPrice = data.tether?.cny || 7.2;
      const change24h = data.tether?.cny_24h_change || 0;

      return {
        price: cnyPrice,
        change24h,
        source: 'CoinGecko'
      };

    } catch {
      return {
        price: 7.2,
        change24h: 0,
        source: 'Fallback'
      };
    }
  },

  async getTrending(): Promise<{
    name: string;
    symbol: string;
    price: number;
    change24h: number;
  }[]> {
    try {
      const { data } = await axios.get(`${COINGECKO_URL}/search/trending`);
      const coins = data.coins?.slice(0, 10) || [];

      const symbols = coins.map((c: any) => c.item.symbol);
      const prices = await this.getPrices(symbols);

      return prices.map(p => ({
        name: p.name,
        symbol: p.symbol,
        price: p.current_price,
        change24h: p.price_change_percentage_24h
      }));

    } catch (error) {
      console.error('Get trending error:', error);
      return [];
    }
  },

  async getAddressBalance(
    chain: string,
    address: string
  ): Promise<AddressInfo | null> {
    try {
      switch (chain) {
        case 'trc20':
          return await this.getTrc20Balance(address);
        case 'erc20':
          return await this.getErc20Balance(address, '0xdac17f958d2ee523a2206206994597c13d831ec7');
        default:
          return null;
      }

    } catch (error) {
      console.error('Get address balance error:', error);
      return null;
    }
  },

  async getTrc20Balance(address: string): Promise<AddressInfo | null> {
    try {
      const { data } = await axios.get(
        `https://apilist.tronscan.org/api/account`,
        {
          params: {
            address
          }
        }
      );

      const trxBalance = data.trx || 0;
      const trxPrice = 0.3;

      const usdtTrc20 = data.trc20token_balances?.find(
        (t: any) => t.tokenId === 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
      );

      const usdtBalance = usdtTrc20?.balance ? parseFloat(usdtTrc20.balance) / 1e6 : 0;

      return {
        address,
        chain: 'TRC20',
        balance: usdtBalance,
        symbol: 'USDT',
        decimals: 6,
        usdt_price: trxBalance * trxPrice
      };

    } catch {
      return null;
    }
  },

  async getErc20Balance(
    address: string,
    tokenAddress: string
  ): Promise<AddressInfo | null> {
    try {
      const abi = ['function balanceOf(address) view returns (uint256)'];
      const providerUrl = `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_KEY}`;

      const { Contract, JsonRpcProvider, Wallet, formatUnits } = await import('ethers');
      const provider = new JsonRpcProvider(providerUrl);
      const contract = new Contract(tokenAddress, abi, provider);

      const balanceRaw = await contract.balanceOf(address);
      const balance = parseFloat(formatUnits(balanceRaw, 6));

      return {
        address,
        chain: 'ERC20',
        balance,
        symbol: 'USDT',
        decimals: 6,
        usdt_price: balance
      };

    } catch {
      return null;
    }
  },

  mapSymbolToId(symbol: string): string {
    const map: Record<string, string> = {
      'btc': 'bitcoin',
      'eth': 'ethereum',
      'usdt': 'tether',
      'usdc': 'usd-coin',
      'bnb': 'binancecoin',
      'sol': 'solana',
      'xrp': 'ripple',
      'ada': 'cardano',
      'doge': 'dogecoin',
      'dot': 'polkadot',
      'matic': 'matic-network',
      'link': 'chainlink',
      'uni': 'uniswap',
      'shib': 'shiba-inu',
      'avax': 'avalanche-2',
      'atom': 'cosmos',
      'luna': 'terra-luna-2',
      'ftm': 'fantom',
      'near': 'near',
      'arb': 'arbitrum'
    };

    return map[symbol.toLowerCase()] || symbol.toLowerCase();
  },

  getSymbolFromId(id: string): string {
    const map: Record<string, string> = {
      'bitcoin': 'BTC',
      'ethereum': 'ETH',
      'tether': 'USDT',
      'usd-coin': 'USDC',
      'binancecoin': 'BNB',
      'solana': 'SOL',
      'ripple': 'XRP',
      'cardano': 'ADA',
      'dogecoin': 'DOGE',
      'polkadot': 'DOT',
      'matic-network': 'MATIC',
      'chainlink': 'LINK',
      'uniswap': 'UNI',
      'shiba-inu': 'SHIB',
      'avalanche-2': 'AVAX',
      'cosmos': 'ATOM',
      'terra-luna-2': 'LUNA',
      'fantom': 'FTM',
      'near': 'NEAR',
      'arbitrum': 'ARB'
    };

    return map[id] || id.toUpperCase();
  },

  getCoinName(id: string): string {
    const map: Record<string, string> = {
      'bitcoin': 'Bitcoin',
      'ethereum': 'Ethereum',
      'tether': 'Tether',
      'usd-coin': 'USD Coin',
      'binancecoin': 'BNB',
      'solana': 'Solana',
      'ripple': 'XRP',
      'cardano': 'Cardano',
      'dogecoin': 'Dogecoin',
      'polkadot': 'Polkadot',
      'matic-network': 'Polygon',
      'chainlink': 'Chainlink',
      'uniswap': 'Uniswap',
      'shiba-inu': 'Shiba Inu',
      'avalanche-2': 'Avalanche',
      'cosmos': 'Cosmos',
      'terra-luna-2': 'Terra',
      'fantom': 'Fantom',
      'near': 'NEAR Protocol',
      'arbitrum': 'Arbitrum'
    };

    return map[id] || id;
  },

  formatPrice(price: number, symbol: string): string {
    if (price < 0.01) {
      return `$${price.toFixed(8)}`;
    } else if (price < 1) {
      return `$${price.toFixed(4)}`;
    } else if (price < 1000) {
      return `$${price.toFixed(2)}`;
    } else {
      return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
  },

  formatChange(change: number): string {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  }
};

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CryptoService } from '../../services/cryptoService';
import { createMockContext, createMockChat, createMockUser } from '../setup';

describe('CryptoService', () => {
  let cryptoService: CryptoService;
  let mockContext: any;

  beforeEach(() => {
    cryptoService = new CryptoService();
    mockContext = createMockContext();
    vi.clearAllMocks();
  });

  describe('getBalance', () => {
    it('should return correct balance for valid BTC address', async () => {
      const balance = await cryptoService.getBalance('bitcoin', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

      expect(balance).toHaveProperty('confirmed');
      expect(balance).toHaveProperty('unconfirmed');
      expect(balance).toHaveProperty('address');
    });

    it('should return zero balance for invalid address', async () => {
      const balance = await cryptoService.getBalance('bitcoin', 'invalid_address');

      expect(balance.confirmed).toBe(0);
      expect(balance.unconfirmed).toBe(0);
    });

    it('should support multiple cryptocurrencies', async () => {
      const btcBalance = await cryptoService.getBalance('bitcoin', '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');
      const ethBalance = await cryptoService.getBalance('ethereum', '0x742d35Cc6634C0532925a3b844Bc9e7595f4E3B0');

      expect(btcBalance).toHaveProperty('currency', 'BTC');
      expect(ethBalance).toHaveProperty('currency', 'ETH');
    });

    it('should handle unsupported cryptocurrency', async () => {
      await expect(
        cryptoService.getBalance('unsupported_coin', 'address123')
      ).rejects.toThrow();
    });
  });

  describe('getPrice', () => {
    it('should return current price', async () => {
      const price = await cryptoService.getPrice('bitcoin');

      expect(price).toHaveProperty('usd');
      expect(price).toHaveProperty('usd_24h_change');
      expect(price).toHaveProperty('last_updated_at');
    });

    it('should return price for multiple currencies', async () => {
      const prices = await cryptoService.getPrice(['bitcoin', 'ethereum']);

      expect(prices.bitcoin).toBeDefined();
      expect(prices.ethereum).toBeDefined();
    });

    it('should handle unsupported cryptocurrency', async () => {
      await expect(
        cryptoService.getPrice('fake_coin')
      ).rejects.toThrow();
    });
  });

  describe('getPriceWithCache', () => {
    it('should return cached price on subsequent calls', async () => {
      const price1 = await cryptoService.getPriceWithCache('bitcoin');
      const price2 = await cryptoService.getPriceWithCache('bitcoin');

      expect(price1).toEqual(price2);
    });

    it('should refresh cache after TTL', async () => {
      const price1 = await cryptoService.getPriceWithCache('bitcoin');
      
      await cryptoService.clearCache('bitcoin');
      
      const price2 = await cryptoService.getPriceWithCache('bitcoin');
      
      expect(price1).not.toEqual(price2);
    });
  });

  describe('getMultiChainBalance', () => {
    it('should return balances for multiple addresses', async () => {
      const balances = await cryptoService.getMultiChainBalance([
        { chain: 'bitcoin', address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa' },
        { chain: 'ethereum', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f4E3B0' }
      ]);

      expect(balances.length).toBe(2);
      expect(balances[0]).toHaveProperty('chain');
      expect(balances[1]).toHaveProperty('chain');
    });
  });

  describe('getHistoricalPrices', () => {
    it('should return historical price data', async () => {
      const history = await cryptoService.getHistoricalPrices('bitcoin', 7);

      expect(history.length).toBe(7);
      expect(history[0]).toHaveProperty('date');
      expect(history[0]).toHaveProperty('price');
    });

    it('should return correct number of days', async () => {
      const history30 = await cryptoService.getHistoricalPrices('bitcoin', 30);
      const history7 = await cryptoService.getHistoricalPrices('bitcoin', 7);

      expect(history30.length).toBe(30);
      expect(history7.length).toBe(7);
    });
  });

  describe('getTokenInfo', () => {
    it('should return token information', async () => {
      const info = await cryptoService.getTokenInfo('ethereum', '0x742d35Cc6634C0532925a3b844Bc9e7595f4E3B0');

      expect(info).toHaveProperty('symbol');
      expect(info).toHaveProperty('name');
      expect(info).toHaveProperty('decimals');
    });

    it('should handle invalid token address', async () => {
      await expect(
        cryptoService.getTokenInfo('ethereum', 'invalid_address')
      ).rejects.toThrow();
    });
  });

  describe('getGasPrice', () => {
    it('should return current gas price', async () => {
      const gasPrice = await cryptoService.getGasPrice('ethereum');

      expect(gasPrice).toHaveProperty('slow');
      expect(gasPrice).toHaveProperty('average');
      expect(gasPrice).toHaveProperty('fast');
      expect(gasPrice).toHaveProperty('unit');
    });

    it('should support chains with different gas mechanisms', async () => {
      const ethGas = await cryptoService.getGasPrice('ethereum');
      const btcGas = await cryptoService.getGasPrice('bitcoin');

      expect(ethGas.unit).toBe('gwei');
      expect(btcGas.unit).toBe('sat/vB');
    });
  });

  describe('estimateTransactionFee', () => {
    it('should estimate transaction fee correctly', async () => {
      const fee = await cryptoService.estimateTransactionFee({
        chain: 'ethereum',
        from: '0x742d35Cc6634C0532925a3b844Bc9e7595f4E3B0',
        to: '0x1234567890123456789012345678901234567890',
        amount: '1.0'
      });

      expect(fee).toHaveProperty('fee');
      expect(fee).toHaveProperty('feeCurrency');
      expect(fee.fee).toBeGreaterThan(0);
    });

    it('should calculate fee based on gas limit', async () => {
      const fee1 = await cryptoService.estimateTransactionFee({
        chain: 'ethereum',
        amount: '0.01'
      });
      const fee2 = await cryptoService.estimateTransactionFee({
        chain: 'ethereum',
        amount: '1.0'
      });

      expect(fee2.fee).toBeGreaterThan(fee1.fee);
    });
  });

  describe('getPortfolio', () => {
    it('should return portfolio summary', async () => {
      const portfolio = await cryptoService.getPortfolio([
        { chain: 'bitcoin', address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', holdings: 0.5 },
        { chain: 'ethereum', address: '0x742d35Cc6634C0532925a3b844Bc9e7595f4E3B0', holdings: 10 }
      ]);

      expect(portfolio).toHaveProperty('totalValue');
      expect(portfolio).toHaveProperty('breakdown');
      expect(portfolio).toHaveProperty('change24h');
    });
  });

  describe('trackAddress', () => {
    it('should add address to tracking list', async () => {
      const result = await cryptoService.trackAddress(
        '123456789',
        'bitcoin',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        'My BTC Wallet'
      );

      expect(result.success).toBe(true);
      expect(result.trackedAddress).toHaveProperty('address');
    });

    it('should reject duplicate tracking', async () => {
      await cryptoService.trackAddress(
        '123456789',
        'bitcoin',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        'Duplicate Test'
      );

      await expect(
        cryptoService.trackAddress(
          '123456789',
          'bitcoin',
          '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
          'Duplicate Test'
        )
      ).rejects.toThrow();
    });
  });

  describe('getTrackedAddresses', () => {
    it('should return tracked addresses for chat', async () => {
      await cryptoService.trackAddress(
        '123456789',
        'bitcoin',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        'Wallet 1'
      );

      const addresses = await cryptoService.getTrackedAddresses('123456789');

      expect(addresses.length).toBeGreaterThan(0);
    });
  });

  describe('untrackAddress', () => {
    it('should remove address from tracking', async () => {
      const tracked = await cryptoService.trackAddress(
        '123456789',
        'bitcoin',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        'Remove Test'
      );

      const result = await cryptoService.untrackAddress(tracked.trackedAddress.id);

      expect(result.success).toBe(true);
    });
  });

  describe('getMarketOverview', () => {
    it('should return market overview', async () => {
      const overview = await cryptoService.getMarketOverview();

      expect(overview).toHaveProperty('topGainers');
      expect(overview).toHaveProperty('topLosers');
      expect(overview).toHaveProperty('marketCap');
      expect(overview).toHaveProperty('trending');
    });
  });

  describe('formatCurrency', () => {
    it('should format cryptocurrency values correctly', async () => {
      const formatted = await cryptoService.formatCurrency(1234.5678, 'USD');

      expect(formatted).toContain('$');
      expect(formatted).toContain('1,234.57');
    });
  });
});

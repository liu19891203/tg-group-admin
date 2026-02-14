import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdFilterService } from '../../services/adFilterService';
import { createMockContext, createMockChat, createMockUser } from '../setup';

describe('AdFilterService', () => {
  let adFilterService: AdFilterService;
  let mockContext: any;

  beforeEach(() => {
    adFilterService = new AdFilterService();
    mockContext = createMockContext();
  });

  describe('checkForAds', () => {
    it('should detect sticker advertisements', async () => {
      mockContext.message = {
        sticker: { file_id: 'sticker_ad_123' },
        chat: createMockChat()
      };

      const result = await adFilterService.checkForAds(mockContext);

      expect(result.isAd).toBe(true);
      expect(result.adType).toBe('sticker');
    });

    it('should detect keyword advertisements', async () => {
      mockContext.message = {
        text: 'Buy cheap followers now! Visit spam.com',
        chat: createMockChat()
      };

      const result = await adFilterService.checkForAds(mockContext);

      expect(result.isAd).toBe(true);
      expect(result.adType).toBe('keyword');
    });

    it('should detect link advertisements', async () => {
      mockContext.message = {
        text: 'Check out my website https://spam-link.com for deals',
        chat: createMockChat()
      };

      const result = await adFilterService.checkForAds(mockContext);

      expect(result.isAd).toBe(true);
      expect(result.adType).toBe('link');
    });

    it('should not flag normal messages', async () => {
      mockContext.message = {
        text: 'Hello everyone, how are you today?',
        chat: createMockChat()
      };

      const result = await adFilterService.checkForAds(mockContext);

      expect(result.isAd).toBe(false);
    });

    it('should detect phone number spam', async () => {
      mockContext.message = {
        text: 'Contact me at +1-555-0123 for more info',
        chat: createMockChat()
      };

      const result = await adFilterService.checkForAds(mockContext);

      expect(result.isAd).toBe(true);
      expect(result.adType).toBe('phone');
    });

    it('should detect username mentions in ads', async () => {
      mockContext.message = {
        text: '@username check this out',
        entities: [{ type: 'mention', offset: 0, length: 8 }],
        chat: createMockChat()
      };

      const result = await adFilterService.checkForAds(mockContext);

      expect(result.isAd).toBe(true);
      expect(result.adType).toBe('mention');
    });
  });

  describe('checkForSoftAds', () => {
    it('should detect soft advertisements with promotional language', async () => {
      mockContext.message = {
        text: 'Amazing offer! Limited time deal! Click here for exclusive discount!',
        chat: createMockChat()
      };

      const result = await adFilterService.checkForSoftAds(mockContext);

      expect(result.isSoftAd).toBe(true);
      expect(result.score).toBeGreaterThan(0.5);
    });

    it('should not flag normal promotional content', async () => {
      mockContext.message = {
        text: 'We have updated our terms of service',
        chat: createMockChat()
      };

      const result = await adFilterService.checkForSoftAds(mockContext);

      expect(result.isSoftAd).toBe(false);
    });
  });

  describe('getAdStats', () => {
    it('should return ad statistics', async () => {
      const stats = await adFilterService.getAdStats('123456789');

      expect(stats).toHaveProperty('totalAdsBlocked');
      expect(stats).toHaveProperty('adsByType');
      expect(stats).toHaveProperty('topAdvertisers');
      expect(stats).toHaveProperty('recentAds');
    });
  });

  describe('blockUserFromAds', () => {
    it('should block user from posting ads', async () => {
      const result = await adFilterService.blockUserFromAds(
        '123456789',
        '987654321'
      );

      expect(result.success).toBe(true);
      expect(result.blockedUntil).toBeDefined();
    });

    it('should reject invalid user IDs', async () => {
      await expect(
        adFilterService.blockUserFromAds('123456789', 'invalid')
      ).rejects.toThrow();
    });
  });

  describe('unblockUserFromAds', () => {
    it('should unblock user from posting ads', async () => {
      const result = await adFilterService.unblockUserFromAds(
        '123456789',
        '987654321'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('getBlockedUsers', () => {
    it('should return list of blocked users', async () => {
      const users = await adFilterService.getBlockedUsers('123456789');

      expect(Array.isArray(users)).toBe(true);
    });
  });

  describe('addAdKeyword', () => {
    it('should add a new ad keyword', async () => {
      const result = await adFilterService.addAdKeyword(
        '123456789',
        'test_ad_keyword'
      );

      expect(result.success).toBe(true);
      expect(result.keyword).toBe('test_ad_keyword');
    });

    it('should reject duplicate keywords', async () => {
      await adFilterService.addAdKeyword('123456789', 'duplicate_test');

      await expect(
        adFilterService.addAdKeyword('123456789', 'duplicate_test')
      ).rejects.toThrow();
    });
  });

  describe('removeAdKeyword', () => {
    it('should remove an existing ad keyword', async () => {
      await adFilterService.addAdKeyword('123456789', 'remove_test');

      const result = await adFilterService.removeAdKeyword(
        '123456789',
        'remove_test'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('getAdKeywords', () => {
    it('should return list of ad keywords', async () => {
      await adFilterService.addAdKeyword('123456789', 'keyword1');
      await adFilterService.addAdKeyword('123456789', 'keyword2');

      const keywords = await adFilterService.getAdKeywords('123456789');

      expect(keywords).toContain('keyword1');
      expect(keywords).toContain('keyword2');
    });
  });

  describe('updateAdFilterConfig', () => {
    it('should update ad filter configuration', async () => {
      const config = {
        enabled: true,
        strictMode: true,
        blockStickers: true,
        autoDelete: true,
        notifyAdmins: false
      };

      const result = await adFilterService.updateAdFilterConfig(
        '123456789',
        config
      );

      expect(result.success).toBe(true);
      expect(result.config).toEqual(config);
    });
  });

  describe('getAdFilterConfig', () => {
    it('should return current ad filter configuration', async () => {
      const config = await adFilterService.getAdFilterConfig('123456789');

      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('strictMode');
      expect(config).toHaveProperty('blockStickers');
    });
  });
});

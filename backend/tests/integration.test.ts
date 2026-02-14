/**
 * Telegram Group Manager - Integration Test Suite
 * 
 * Tests end-to-end workflows combining multiple services
 * and API endpoints to ensure system reliability.
 */

import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createMockSupabase, createMockRedis, createMockTelegram } from './setup';

describe('Integration Tests', () => {
  let mockSupabase: any;
  let mockRedis: any;
  let mockTelegram: any;

  beforeAll(() => {
    mockSupabase = createMockSupabase();
    mockRedis = createMockRedis();
    mockTelegram = createMockTelegram();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('User Verification Flow', () => {
    it('should complete full verification flow', async () => {
      const userId = '987654321';
      const chatId = '123456789';

      const mockContext = {
        chat: { id: chatId },
        from: { id: userId, username: 'testuser', first_name: 'Test' },
        message_id: 12345
      };

      mockSupabase.from().select().mockResolvedValue({
        data: [{ id: 'group1', chat_id: chatId, verification_enabled: true }],
        error: null
      });

      mockRedis.hset.mockResolvedValue(1);
      mockRedis.hget.mockResolvedValue({
        status: 'pending',
        challenge: 'ABC123'
      });

      const { VerificationService } = await import('../services/verificationService');
      const verificationService = new VerificationService();

      const challenge = await verificationService.startVerification(mockContext, 'captcha');
      expect(challenge).toBeDefined();
      expect(challenge.type).toBe('captcha');

      const result = await verificationService.submitChallenge(userId, chatId, 'ABC123');
      expect(result.success).toBe(true);
    });

    it('should handle verification timeout', async () => {
      const userId = 'timeout_user';
      const chatId = '123456789';

      mockRedis.hset.mockResolvedValue(1);
      mockRedis.hget.mockResolvedValue({
        status: 'pending',
        startedAt: Date.now() - 600000,
        expiresAt: Date.now() - 300000
      });

      const { VerificationService } = await import('../services/verificationService');
      const verificationService = new VerificationService();

      const isExpired = await verificationService.isChallengeExpired(userId, chatId);
      expect(isExpired).toBe(true);
    });

    it('should send notification after verification', async () => {
      const userId = '987654321';
      const chatId = '123456789';

      mockSupabase.from().select().mockResolvedValue({
        data: [{
          id: 'group1',
          chat_id: chatId,
          welcome_enabled: true,
          welcome_message: 'Welcome {username}!'
        }],
        error: null
      });

      mockTelegram.sendMessage.mockResolvedValue({ message_id: 12345 });

      const { sendWelcomeMessage } = await import('../services/welcomeService');
      await sendWelcomeMessage(chatId, { id: userId, username: 'newuser' });
      
      expect(mockTelegram.sendMessage).toHaveBeenCalled();
    });
  });

  describe('Points System Integration', () => {
    it('should award points for various actions', async () => {
      const userId = '987654321';
      const chatId = '123456789';

      mockSupabase.from().select().mockResolvedValue({
        data: [{ id: 'user_points', user_id: userId, chat_id: chatId, points: 100 }],
        error: null
      });
      mockSupabase.from().update().mockResolvedValue({ data: [{ points: 150 }], error: null });

      const { PointsService } = await import('../services/pointsService');
      const pointsService = new PointsService();

      await pointsService.addPoints({
        chatId,
        userId,
        points: 50,
        reason: 'Test points'
      });

      const userPoints = await pointsService.getUserPoints(chatId, userId);
      expect(userPoints.totalPoints).toBeGreaterThanOrEqual(100);
    });

    it('should handle level up based on points', async () => {
      const userId = 'levelup_user';
      const chatId = '123456789';

      mockSupabase.from().select().mockResolvedValue({
        data: [{ id: 'user1', points: 950 }],
        error: null
      });
      mockSupabase.from().update().mockResolvedValue({ data: [{ level: 2 }], error: null });

      const { PointsService } = await import('../services/pointsService');
      const pointsService = new PointsService();

      await pointsService.addPoints({
        chatId,
        userId,
        points: 100,
        reason: 'Level up test'
      });

      const levelInfo = await pointsService.getLevelInfo(chatId, userId);
      expect(levelInfo.level).toBeGreaterThanOrEqual(2);
    });

    it('should prevent duplicate daily check-in', async () => {
      const userId = 'checkin_user';
      const chatId = '123456789';

      mockRedis.hget.mockResolvedValue({
        lastCheckIn: new Date().toISOString(),
        streak: 5
      });

      const { PointsService } = await import('../services/pointsService');
      const pointsService = new PointsService();

      const canCheckIn = await pointsService.canCheckIn(chatId, userId);
      expect(canCheckIn).toBe(false);
    });
  });

  describe('Ad Detection and Blocking', () => {
    it('should detect and delete advertisement', async () => {
      const chatId = '123456789';
      const userId = 'ad_user';

      const mockContext = {
        chat: { id: chatId },
        from: { id: userId, username: 'adposter' },
        message: {
          text: 'Buy followers at cheap-followers.com!',
          message_id: 12345
        }
      };

      mockSupabase.from().select().mockResolvedValue({
        data: [{
          id: 'group1',
          chat_id: chatId,
          ad_filter_enabled: true,
          block_links: true
        }],
        error: null
      });

      mockSupabase.from().insert().mockResolvedValue({ data: [{ id: 'record1' }], error: null });

      const { AdFilterService } = await import('../services/adFilterService');
      const adFilterService = new AdFilterService();

      const result = await adFilterService.checkForAds(mockContext);
      expect(result.isAd).toBe(true);
      expect(result.adType).toBe('link');
    });

    it('should track advertiser statistics', async () => {
      const userId = 'frequent_advertiser';

      mockSupabase.from().select().mockResolvedValue({
        data: [
          { id: 'ad1', user_id: userId, ad_type: 'sticker' },
          { id: 'ad2', user_id: userId, ad_type: 'keyword' },
          { id: 'ad3', user_id: userId, ad_type: 'link' }
        ],
        error: null
      });

      const { AdFilterService } = await import('../services/adFilterService');
      const adFilterService = new AdFilterService();

      const stats = await adFilterService.getAdStats('123456789');
      expect(stats.topAdvertisers).toBeDefined();
    });
  });

  describe('Auto Reply Workflow', () => {
    it('should trigger auto reply on keyword match', async () => {
      const chatId = '123456789';
      const userId = '987654321';

      const mockContext = {
        chat: { id: chatId },
        from: { id: userId },
        message: {
          text: 'Hello, how are you?',
          message_id: 12345
        }
      };

      mockSupabase.from().select().mockResolvedValue({
        data: [{
          id: 'rule1',
          chat_id: chatId,
          keyword: 'hello',
          reply: 'Hi there! How can I help you?',
          is_enabled: true
        }],
        error: null
      });

      const { AutoReplyService } = await import('../services/autoReplyService');
      const autoReplyService = new AutoReplyService();

      const result = await autoReplyService.checkAutoReply(mockContext);
      expect(result.matched).toBe(true);
      expect(result.reply).toBe('Hi there! How can I help you?');
    });

    it('should support regex pattern matching', async () => {
      const chatId = '123456789';

      mockSupabase.from().select().mockResolvedValue({
        data: [{
          id: 'rule1',
          chat_id: chatId,
          keyword: '^email:.*@.*\\.com$',
          reply: 'Please contact support.',
          is_regex: true,
          is_enabled: true
        }],
        error: null
      });

      const { AutoReplyService } = await import('../services/autoReplyService');
      const autoReplyService = new AutoReplyService();

      const mockContext: any = {
        chat: { id: chatId },
        message: { text: 'email: test@example.com' }
      };

      const result = await autoReplyService.checkAutoReply(mockContext);
      expect(result.matched).toBe(true);
    });
  });

  describe('Lottery Complete Flow', () => {
    it('should manage full lottery lifecycle', async () => {
      const chatId = '123456789';
      const lotteryId = 'lottery_1';

      mockSupabase.from().select().mockResolvedValue({
        data: [{
          id: lotteryId,
          chat_id: chatId,
          name: 'Weekly Lottery',
          status: 'active',
          prize: '1000 points',
          ticket_price: 10,
          max_participants: 100
        }],
        error: null
      });

      mockSupabase.from().select().mockResolvedValue({
        data: [],
        error: null
      });
      mockSupabase.from().insert().mockResolvedValue({ data: [{ id: 'participant1' }], error: null });

      const { LotteryService } = await import('../services/lotteryService');
      const lotteryService = new LotteryService();

      const lottery = await lotteryService.createLottery({
        chatId,
        name: 'Weekly Lottery',
        prize: '1000 points',
        ticketPrice: 10,
        maxParticipants: 100
      });

      expect(lottery.success).toBe(true);

      await lotteryService.joinLottery(lottery.lottery.id, 'user1');
      await lotteryService.joinLottery(lottery.lottery.id, 'user2');

      const details = await lotteryService.getLotteryDetails(lottery.lottery.id);
      expect(details.participants).toBe(2);

      const drawResult = await lotteryService.drawWinner(lottery.lottery.id);
      expect(drawResult.success).toBe(true);
      expect(drawResult.winner).toBeDefined();
    });
  });

  describe('Scheduled Messages Workflow', () => {
    it('should schedule and send messages', async () => {
      const chatId = '123456789';

      const { ScheduledMessagesService } = await import('../services/scheduledMessages');
      const scheduledService = new ScheduledMessagesService();

      const scheduled = await scheduledService.createScheduledMessage({
        chatId,
        content: 'Daily reminder message',
        scheduledAt: new Date(Date.now() + 3600000).toISOString()
      });

      expect(scheduled.success).toBe(true);

      const messages = await scheduledService.getScheduledMessages(chatId);
      expect(messages.length).toBeGreaterThan(0);
    });

    it('should handle recurring messages', async () => {
      const chatId = '123456789';

      const { ScheduledMessagesService } = await import('../services/scheduledMessages');
      const scheduledService = new ScheduledMessagesService();

      const recurring = await scheduledService.createScheduledMessage({
        chatId,
        content: 'Weekly newsletter',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        repeat: 'weekly'
      });

      expect(recurring.success).toBe(true);
      expect(recurring.message.repeat).toBe('weekly');
    });
  });

  describe('Crypto Price Tracking', () => {
    it('should fetch and cache prices', async () => {
      const { CryptoService } = await import('../services/cryptoService');
      const cryptoService = new CryptoService();

      const btcPrice = await cryptoService.getPrice('bitcoin');
      expect(btcPrice).toHaveProperty('usd');
      expect(btcPrice).toHaveProperty('usd_24h_change');

      const cachedPrice = await cryptoService.getPriceWithCache('bitcoin');
      expect(cachedPrice).toEqual(btcPrice);
    });

    it('should track address balances', async () => {
      const { CryptoService } = await import('../services/cryptoService');
      const cryptoService = new CryptoService();

      await cryptoService.trackAddress(
        '123456789',
        'bitcoin',
        '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        'My BTC Wallet'
      );

      const addresses = await cryptoService.getTrackedAddresses('123456789');
      expect(addresses.length).toBeGreaterThan(0);
    });
  });

  describe('Message Statistics Collection', () => {
    it('should track and aggregate message stats', async () => {
      const chatId = '123456789';
      const userId = '987654321';

      mockRedis.hincrby.mockResolvedValue(1);

      const { MessageStatsService } = await import('../services/messageStats');
      const statsService = new MessageStatsService();

      await statsService.recordMessage({
        chat: { id: chatId },
        from: { id: userId },
        message: { text: 'Test message' }
      } as any);

      const stats = await statsService.getMessageStats(chatId);
      expect(stats.totalMessages).toBeGreaterThanOrEqual(1);
    });

    it('should calculate group health score', async () => {
      const chatId = 'health_check_group';

      mockRedis.mget.mockResolvedValue([1000, 500, 100]);

      const { MessageStatsService } = await import('../services/messageStats');
      const statsService = new MessageStatsService();

      const healthScore = await statsService.getGroupHealthScore(chatId);
      expect(healthScore).toHaveProperty('overall');
      expect(healthScore.overall).toBeGreaterThanOrEqual(0);
      expect(healthScore.overall).toBeLessThanOrEqual(100);
    });
  });

  describe('Webhook Processing', () => {
    it('should process various update types', async () => {
      const { WebhookProcessor } = await import('../handlers/webhookHandler');
      const processor = new WebhookProcessor();

      const textUpdate = {
        update_id: 123456789,
        message: {
          message_id: 12345,
          text: 'Hello bot',
          from: { id: 987654321, username: 'testuser', is_bot: false },
          chat: { id: -123456789, type: 'group' },
          date: Math.floor(Date.now() / 1000)
        }
      };

      const result = await processor.processUpdate(textUpdate);
      expect(result.processed).toBe(true);
    });

    it('should handle callback queries', async () => {
      const { WebhookProcessor } = await import('../handlers/webhookHandler');
      const processor = new WebhookProcessor();

      const callbackUpdate = {
        update_id: 123456790,
        callback_query: {
          id: 'callback123',
          from: { id: 987654321, username: 'testuser' },
          message: { message_id: 12346, chat: { id: -123456789 } },
          data: 'action=confirm'
        }
      };

      const result = await processor.processUpdate(callbackUpdate);
      expect(result.processed).toBe(true);
    });
  });

  describe('Database Operations', () => {
    it('should perform CRUD operations on groups', async () => {
      mockSupabase.from().insert().mockResolvedValue({
        data: [{ id: 'new_group', chat_id: '999888', title: 'New Test Group' }],
        error: null
      });

      const { GroupService } = await import('../services/groupService');
      const groupService = new GroupService();

      const created = await groupService.createGroup({
        chatId: '999888',
        title: 'New Test Group'
      });

      expect(created.success).toBe(true);
      expect(created.group.title).toBe('New Test Group');

      mockSupabase.from().update().mockResolvedValue({
        data: [{ title: 'Updated Group Name' }],
        error: null
      });

      const updated = await groupService.updateGroup(created.group.id, {
        title: 'Updated Group Name'
      });

      expect(updated.success).toBe(true);
    });

    it('should handle member membership', async () => {
      const { MemberService } = await import('../services/memberService');
      const memberService = new MemberService();

      const { addMember } = await import('../services/memberService');
      const added = await addMember('123456789', {
        id: 'user1',
        username: 'newmember'
      });

      expect(added.success).toBe(true);

      const { getMember } = await import('../services/memberService');
      const member = await getMember('123456789', 'user1');
      expect(member).toBeDefined();
    });
  });

  describe('Performance and Rate Limiting', () => {
    it('should enforce rate limits', async () => {
      const { RateLimiter } = await import('../lib/rateLimit');
      const rateLimiter = new RateLimiter();

      const userId = 'ratelimit_test';
      const chatId = '123456789';

      for (let i = 0; i < 10; i++) {
        const allowed = await rateLimiter.check(userId, chatId, 'messages', 5, 60000);
        if (i < 5) {
          expect(allowed).toBe(true);
        } else {
          expect(allowed).toBe(false);
        }
      }
    });

    it('should cache frequently accessed data', async () => {
      const { CacheManager } = await import('../lib/cache');
      const cache = new CacheManager();

      await cache.set('test_key', { data: 'test_value' }, 300);

      const cached = await cache.get('test_key');
      expect(cached).toEqual({ data: 'test_value' });

      const deleted = await cache.delete('test_key');
      const afterDelete = await cache.get('test_key');
      expect(afterDelete).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.from().select().mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' }
      });

      const { GroupService } = await import('../services/groupService');
      const groupService = new GroupService();

      const groups = await groupService.getGroups();
      expect(groups.success).toBe(false);
      expect(groups.error).toContain('Connection failed');
    });

    it('should handle invalid input validation', async () => {
      const { ValidationService } = await import('../services/validationService');
      const validationService = new ValidationService();

      const isValidChatId = await validationService.validateChatId('invalid');
      expect(isValidChatId).toBe(false);

      const isValidPoints = await validationService.validatePoints(-100);
      expect(isValidPoints).toBe(false);
    });
  });

  describe('Data Export', () => {
    it('should export data in various formats', async () => {
      const { ExportService } = await import('../services/exportService');
      const exportService = new ExportService();

      mockSupabase.from().select().mockResolvedValue({
        data: [
          { id: '1', username: 'user1', points: 100 },
          { id: '2', username: 'user2', points: 200 }
        ],
        error: null
      });

      const jsonExport = await exportService.exportData('members', 'json');
      expect(jsonExport.format).toBe('json');

      const csvExport = await exportService.exportData('members', 'csv');
      expect(csvExport.format).toBe('csv');
    });
  });

  describe('System Health', () => {
    it('should report system status', async () => {
      const { HealthCheckService } = await import('../services/healthCheck');
      const healthService = new HealthCheckService();

      mockRedis.ping.mockResolvedValue('PONG');
      mockSupabase.from().select().mockResolvedValue({ data: [], error: null });

      const health = await healthService.checkAll();
      expect(health.status).toBe('healthy');
      expect(health.checks).toHaveProperty('database');
      expect(health.checks).toHaveProperty('redis');
    });

    it('should handle degraded status', async () => {
      const { HealthCheckService } = await import('../services/healthCheck');
      const healthService = new HealthCheckService();

      mockRedis.ping.mockRejectedValue(new Error('Redis connection failed'));

      const health = await healthService.checkAll();
      expect(health.status).toBe('degraded');
    });
  });
});

describe('Edge Cases and Error Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle concurrent requests', async () => {
    const { ConcurrencyService } = await import('../services/concurrencyService');
    const concurrencyService = new ConcurrencyService();

    const promises = Array(10).fill(null).map((_, i) =>
      concurrencyService.acquireLock(`resource_${i}`, 5000)
    );

    const results = await Promise.all(promises);
    expect(results.filter(r => r.acquired).length).toBeLessThanOrEqual(10);
  });

  it('should handle network timeouts', async () => {
    mockSupabase.from().select.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({ data: [], error: null }), 5000))
    );

    const { withTimeout } = await import('../lib/utils');
    
    await expect(
      withTimeout(
        new Promise(resolve => setTimeout(() => resolve('done'), 5000)),
        1000
      )
    ).rejects.toThrow('Timeout');
  });

  it('should handle malformed webhook payloads', async () => {
    const { WebhookProcessor } = await import('../handlers/webhookHandler');
    const processor = new WebhookProcessor();

    const invalidUpdate = {
      update_id: 123456789,
      invalid_field: 'should not exist'
    };

    const result = await processor.processUpdate(invalidUpdate as any);
    expect(result.processed).toBe(false);
    expect(result.error).toBeDefined();
  });
});

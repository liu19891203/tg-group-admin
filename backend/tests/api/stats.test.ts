import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase, createMockRedis, createMockContext } from '../setup';

describe('API Tests - Stats', () => {
  let mockSupabase: any;
  let mockRedis: any;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    mockRedis = createMockRedis();
  });

  describe('GET /api/admin/stats/overview', () => {
    it('should return overall statistics', async () => {
      const mockStats = {
        totalGroups: 5,
        totalMembers: 10000,
        totalMessages: 500000,
        activeUsers24h: 2000
      };

      mockRedis.mget.mockResolvedValue(Object.values(mockStats));

      const response = await fetch('/api/admin/stats/overview');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toBeDefined();
      expect(data.stats.totalGroups).toBe(5);
    });

    it('should include growth trends', async () => {
      const response = await fetch('/api/admin/stats/overview?include_trends=true');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.trends).toBeDefined();
      expect(data.trends.groups).toBeDefined();
      expect(data.trends.members).toBeDefined();
    });
  });

  describe('GET /api/admin/stats/messages', () => {
    it('should return message statistics', async () => {
      const mockMessageStats = {
        today: 5000,
        week: 35000,
        month: 150000
      };

      mockRedis.hgetall.mockResolvedValue(mockMessageStats);

      const response = await fetch('/api/admin/stats/messages');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toBeDefined();
    });

    it('should support date range queries', async () => {
      const response = await fetch('/api/admin/stats/messages?from=2024-01-01&to=2024-01-31');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dateRange).toBeDefined();
    });

    it('should return hourly distribution', async () => {
      const response = await fetch('/api/admin/stats/messages?group_by=hour');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.hourlyDistribution).toBeDefined();
      expect(data.hourlyDistribution.length).toBe(24);
    });

    it('should return daily distribution for week', async () => {
      const response = await fetch('/api/admin/stats/messages?group_by=day&days=7');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dailyDistribution.length).toBeLessThanOrEqual(7);
    });
  });

  describe('GET /api/admin/stats/members', () => {
    it('should return member statistics', async () => {
      const mockMemberStats = {
        total: 10000,
        active: 7500,
        newToday: 50,
        churned: 10
      };

      mockRedis.mget.mockResolvedValue(Object.values(mockMemberStats));

      const response = await fetch('/api/admin/stats/members');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toBeDefined();
    });

    it('should include member growth over time', async () => {
      const response = await fetch('/api/admin/stats/members?include_growth=true');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.growth).toBeDefined();
    });

    it('should return member distribution by group', async () => {
      const response = await fetch('/api/admin/stats/members?include_distribution=true');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.byGroup).toBeDefined();
    });
  });

  describe('GET /api/admin/stats/points', () => {
    it('should return points statistics', async () => {
      const mockPointsStats = {
        totalInCirculation: 1000000,
        totalTransactions: 50000,
        averagePerUser: 100
      };

      mockRedis.mget.mockResolvedValue(Object.values(mockPointsStats));

      const response = await fetch('/api/admin/stats/points');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toBeDefined();
    });

    it('should include points distribution', async () => {
      const response = await fetch('/api/admin/stats/points?include_distribution=true');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.distribution).toBeDefined();
    });

    it('should return top earners', async () => {
      const response = await fetch('/api/admin/stats/points?top_earners=10');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topEarners).toBeDefined();
    });

    it('should return points activity over time', async () => {
      const response = await fetch('/api/admin/stats/points?include_activity=true');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activity).toBeDefined();
    });
  });

  describe('GET /api/admin/stats/verification', () => {
    it('should return verification statistics', async () => {
      const mockVerificationStats = {
        totalVerified: 8000,
        pending: 2000,
        failedToday: 50
      };

      mockRedis.mget.mockResolvedValue(Object.values(mockVerificationStats));

      const response = await fetch('/api/admin/stats/verification');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toBeDefined();
    });

    it('should include verification method breakdown', async () => {
      const response = await fetch('/api/admin/stats/verification?include_methods=true');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.byMethod).toBeDefined();
    });

    it('should return success rate', async () => {
      const response = await fetch('/api/admin/stats/verification?include_success_rate=true');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.successRate).toBeDefined();
      expect(data.successRate).toBeGreaterThanOrEqual(0);
      expect(data.successRate).toBeLessThanOrEqual(100);
    });
  });

  describe('GET /api/admin/stats/ads', () => {
    it('should return advertisement blocking statistics', async () => {
      const mockAdStats = {
        totalBlocked: 5000,
        todayBlocked: 100,
        byType: {
          sticker: 2000,
          keyword: 2500,
          link: 500
        }
      };

      mockRedis.hgetall.mockResolvedValue(mockAdStats);

      const response = await fetch('/api/admin/stats/ads');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toBeDefined();
    });

    it('should include top advertisers', async () => {
      const response = await fetch('/api/admin/stats/ads?include_advertisers=true');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.topAdvertisers).toBeDefined();
    });

    it('should return ad blocking trend', async () => {
      const response = await fetch('/api/admin/stats/ads?include_trends=true');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.trends).toBeDefined();
    });
  });

  describe('GET /api/admin/stats/lottery', () => {
    it('should return lottery statistics', async () => {
      const mockLotteryStats = {
        totalLotteries: 100,
        totalParticipants: 5000,
        totalPrizes: 100000
      };

      mockRedis.mget.mockResolvedValue(Object.values(mockLotteryStats));

      const response = await fetch('/api/admin/stats/lottery');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toBeDefined();
    });

    it('should include recent winners', async () => {
      const response = await fetch('/api/admin/stats/lottery?include_winners=true');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recentWinners).toBeDefined();
    });

    it('should return popular lotteries', async () => {
      const response = await fetch('/api/admin/stats/lottery?include_popular=true');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.popularLotteries).toBeDefined();
    });
  });

  describe('GET /api/admin/stats/export', () => {
    it('should export statistics', async () => {
      const response = await fetch('/api/admin/stats/export');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('exportDate');
      expect(data).toHaveProperty('statistics');
    });

    it('should support specific date range', async () => {
      const response = await fetch('/api/admin/stats/export?from=2024-01-01&to=2024-01-31');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.dateRange).toBeDefined();
    });

    it('should include all categories when requested', async () => {
      const response = await fetch('/api/admin/stats/export?categories=members,messages,points');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.statistics.members).toBeDefined();
      expect(data.statistics.messages).toBeDefined();
      expect(data.statistics.points).toBeDefined();
    });

    it('should format export as JSON', async () => {
      const response = await fetch('/api/admin/stats/export?format=json');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data).toBe('object');
    });
  });

  describe('GET /api/admin/stats/realtime', () => {
    it('should return real-time statistics', async () => {
      const mockRealtime = {
        activeUsers: 500,
        messagesPerMinute: 50,
        verificationsPerMinute: 10
      };

      mockRedis.hgetall.mockResolvedValue(mockRealtime);

      const response = await fetch('/api/admin/stats/realtime');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activeUsers).toBeDefined();
    });

    it('should support streaming updates', async () => {
      const response = await fetch('/api/admin/stats/realtime?stream=true');
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
    });
  });
});

describe('API Tests - Scheduled Messages', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
  });

  describe('GET /api/admin/scheduled-messages', () => {
    it('should return scheduled messages', async () => {
      const mockMessages = [
        { id: '1', chat_id: '123456', message: 'Daily reminder', scheduled_at: '2024-01-02T00:00:00Z' },
        { id: '2', chat_id: '123456', message: 'Weekly update', scheduled_at: '2024-01-03T00:00:00Z' }
      ];

      mockSupabase.from().select().mockResolvedValue({ data: mockMessages, error: null });

      const response = await fetch('/api/admin/scheduled-messages');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.messages).toHaveLength(2);
    });

    it('should filter by chat', async () => {
      mockSupabase.from().select().mockImplementation(() => ({
        eq: () => Promise.resolve({ data: [], error: null })
      }));

      const response = await fetch('/api/admin/scheduled-messages?chat_id=123456');
      const data = await response.json();

      expect(response.status).toBe(200);
    });

    it('should return only upcoming messages', async () => {
      mockSupabase.from().select().mockImplementation(() => ({
        eq: () => ({
          gte: () => Promise.resolve({ data: [], error: null })
        })
      }));

      const response = await fetch('/api/admin/scheduled-messages?status=upcoming');
      const data = await response.json();

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/admin/scheduled-messages', () => {
    it('should create scheduled message', async () => {
      const newMessage = {
        chat_id: '123456',
        message: 'Test scheduled message',
        scheduled_at: '2024-01-02T00:00:00Z',
        repeat: 'daily'
      };

      mockSupabase.from().insert().mockResolvedValue({ data: [newMessage], error: null });

      const response = await fetch('/api/admin/scheduled-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMessage)
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.message).toBeDefined();
    });

    it('should validate required fields', async () => {
      const invalidMessage = {
        chat_id: '123456'
      };

      const response = await fetch('/api/admin/scheduled-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidMessage)
      });

      expect(response.status).toBe(400);
    });

    it('should validate cron expression', async () => {
      const messageWithCron = {
        chat_id: '123456',
        message: 'Test',
        cron_expression: 'invalid cron'
      };

      mockSupabase.from().insert().mockResolvedValue({ data: null, error: { message: 'invalid cron' } });

      const response = await fetch('/api/admin/scheduled-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messageWithCron)
      });

      expect(response.status).toBe(400);
    });

    it('should not allow past scheduling', async () => {
      const pastMessage = {
        chat_id: '123456',
        message: 'Past message',
        scheduled_at: '2020-01-01T00:00:00Z'
      };

      const response = await fetch('/api/admin/scheduled-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pastMessage)
      });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/admin/scheduled-messages/:id', () => {
    it('should update scheduled message', async () => {
      const updates = {
        message: 'Updated message',
        scheduled_at: '2024-01-03T00:00:00Z'
      };

      mockSupabase.from().update().mockResolvedValue({ data: [updates], error: null });

      const response = await fetch('/api/admin/scheduled-messages/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message.message).toBe('Updated message');
    });

    it('should return 404 for non-existent message', async () => {
      mockSupabase.from().update().mockResolvedValue({ data: [], error: null });

      const response = await fetch('/api/admin/scheduled-messages/non-existent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Test' })
      });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/scheduled-messages/:id', () => {
    it('should delete scheduled message', async () => {
      mockSupabase.from().delete().mockResolvedValue({ data: null, error: null });

      const response = await fetch('/api/admin/scheduled-messages/1', {
        method: 'DELETE'
      });

      expect(response.status).toBe(200);
    });

    it('should cancel pending scheduled message', async () => {
      mockSupabase.from().update().mockResolvedValue({ data: [{ status: 'cancelled' }], error: null });

      const response = await fetch('/api/admin/scheduled-messages/1/cancel', {
        method: 'POST'
      });

      expect(response.status).toBe(200);
    });
  });

  describe('POST /api/admin/scheduled-messages/:id/send-now', () => {
    it('should send message immediately', async () => {
      mockSupabase.from().update().mockResolvedValue({ data: [{ status: 'sent' }], error: null });

      const response = await fetch('/api/admin/scheduled-messages/1/send-now', {
        method: 'POST'
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

describe('API Tests - Authentication', () => {
  describe('POST /api/admin/login', () => {
    it('should authenticate admin user', async () => {
      const mockSupabase = createMockSupabase();
      
      mockSupabase.from().select().mockResolvedValue({
        data: [{ id: '1', email: 'admin@test.com', password_hash: 'hashed' }],
        error: null
      });

      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@test.com', password: 'password123' })
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.token).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const mockSupabase = createMockSupabase();
      
      mockSupabase.from().select().mockResolvedValue({ data: [], error: null });

      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'wrong@test.com', password: 'wrongpassword' })
      });

      expect(response.status).toBe(401);
    });

    it('should rate limit failed attempts', async () => {
      const mockSupabase = createMockSupabase();
      
      mockSupabase.from().select().mockResolvedValue({ data: [], error: null });

      for (let i = 0; i < 5; i++) {
        await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@test.com', password: 'wrong' })
        });
      }

      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'wrong' })
      });

      expect(response.status).toBe(429);
    });
  });

  describe('POST /api/admin/logout', () => {
    it('should logout user', async () => {
      const response = await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer valid_token' }
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /api/admin/me', () => {
    it('should return current user info', async () => {
      const mockSupabase = createMockSupabase();
      
      mockSupabase.from().select().mockResolvedValue({
        data: [{ id: '1', email: 'admin@test.com', role: 'admin' }],
        error: null
      });

      const response = await fetch('/api/admin/me', {
        headers: { 'Authorization': 'Bearer valid_token' }
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user).toBeDefined();
    });

    it('should reject invalid token', async () => {
      const response = await fetch('/api/admin/me', {
        headers: { 'Authorization': 'Bearer invalid_token' }
      });

      expect(response.status).toBe(401);
    });

    it('should reject missing token', async () => {
      const response = await fetch('/api/admin/me');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/admin/refresh', () => {
    it('should refresh access token', async () => {
      const response = await fetch('/api/admin/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'valid_refresh_token' })
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.token).toBeDefined();
    });

    it('should reject invalid refresh token', async () => {
      const response = await fetch('/api/admin/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: 'invalid_token' })
      });

      expect(response.status).toBe(401);
    });
  });
});

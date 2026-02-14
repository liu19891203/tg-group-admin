import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MessageStatsService } from '../../services/messageStats';
import { createMockContext, createMockChat, createMockUser } from '../setup';

describe('MessageStatsService', () => {
  let messageStatsService: MessageStatsService;
  let mockContext: any;

  beforeEach(() => {
    messageStatsService = new MessageStatsService();
    mockContext = createMockContext();
    vi.clearAllMocks();
  });

  describe('recordMessage', () => {
    it('should record a message from user', async () => {
      mockContext.message = {
        text: 'Hello everyone!',
        from: createMockUser('987654321'),
        chat: createMockChat()
      };

      const result = await messageStatsService.recordMessage(mockContext);

      expect(result.success).toBe(true);
      expect(result.messageId).toBeDefined();
    });

    it('should handle different message types', async () => {
      mockContext.message = {
        sticker: { file_id: 'sticker123' },
        from: createMockUser('987654321'),
        chat: createMockChat()
      };

      const result = await messageStatsService.recordMessage(mockContext);

      expect(result.success).toBe(true);
    });

    it('should track message length', async () => {
      mockContext.message = {
        text: 'This is a test message for tracking length.',
        from: createMockUser('987654321'),
        chat: createMockChat()
      };

      const result = await messageStatsService.recordMessage(mockContext);

      expect(result.messageLength).toBeGreaterThan(0);
    });
  });

  describe('getMessageStats', () => {
    it('should return message statistics', async () => {
      const stats = await messageStatsService.getMessageStats('123456789');

      expect(stats).toHaveProperty('totalMessages');
      expect(stats).toHaveProperty('messagesToday');
      expect(stats).toHaveProperty('messagesThisWeek');
      expect(stats).toHaveProperty('messagesThisMonth');
    });

    it('should return zero for new chat', async () => {
      const stats = await messageStatsService.getMessageStats('new_chat_123');

      expect(stats.totalMessages).toBe(0);
    });
  });

  describe('getUserStats', () => {
    it('should return statistics for specific user', async () => {
      const stats = await messageStatsService.getUserStats('123456789', '987654321');

      expect(stats).toHaveProperty('totalMessages');
      expect(stats).toHaveProperty('firstMessageDate');
      expect(stats).toHaveProperty('lastMessageDate');
    });

    it('should return empty stats for new user', async () => {
      const stats = await messageStatsService.getUserStats('123456789', 'new_user');

      expect(stats.totalMessages).toBe(0);
    });
  });

  describe('getActiveUsers', () => {
    it('should return list of active users', async () => {
      const users = await messageStatsService.getActiveUsers('123456789', 7);

      expect(Array.isArray(users)).toBe(true);
    });

    it('should sort by message count', async () => {
      const users = await messageStatsService.getActiveUsers('123456789', 30);

      for (let i = 1; i < users.length; i++) {
        expect(users[i - 1].messageCount).toBeGreaterThanOrEqual(users[i].messageCount);
      }
    });

    it('should respect limit parameter', async () => {
      const users = await messageStatsService.getActiveUsers('123456789', 30, 10);

      expect(users.length).toBeLessThanOrEqual(10);
    });
  });

  describe('getTopPosters', () => {
    it('should return top posters leaderboard', async () => {
      const posters = await messageStatsService.getTopPosters('123456789', 10);

      expect(posters.length).toBeLessThanOrEqual(10);
    });

    it('should include message count for each poster', async () => {
      const posters = await messageStatsService.getTopPosters('123456789', 10);

      posters.forEach(poster => {
        expect(poster).toHaveProperty('userId');
        expect(poster).toHaveProperty('messageCount');
      });
    });
  });

  describe('getMessagesByHour', () => {
    it('should return hourly message distribution', async () => {
      const distribution = await messageStatsService.getMessagesByHour('123456789');

      expect(distribution.length).toBe(24);
      expect(distribution[0]).toHaveProperty('hour');
      expect(distribution[0]).toHaveProperty('count');
    });

    it('should have valid hour values', async () => {
      const distribution = await messageStatsService.getMessagesByHour('123456789');

      distribution.forEach((item, index) => {
        expect(item.hour).toBe(index);
      });
    });
  });

  describe('getMessagesByDay', () => {
    it('should return daily message distribution for week', async () => {
      const distribution = await messageStatsService.getMessagesByDay('123456789', 7);

      expect(distribution.length).toBe(7);
    });

    it('should include day labels', async () => {
      const distribution = await messageStatsService.getMessagesByDay('123456789', 7);

      distribution.forEach(item => {
        expect(item).toHaveProperty('date');
        expect(item).toHaveProperty('day');
        expect(item).toHaveProperty('count');
      });
    });
  });

  describe('getMostUsedWords', () => {
    it('should return most frequently used words', async () => {
      const words = await messageStatsService.getMostUsedWords('123456789', 10);

      expect(words.length).toBeLessThanOrEqual(10);
    });

    it('should exclude stop words', async () => {
      const words = await messageStatsService.getMostUsedWords('123456789', 100);

      words.forEach(word => {
        expect(word.word).not.toMatch(/^(the|a|an|and|or|but)$/i);
      });
    });
  });

  describe('getChatActivityTrend', () => {
    it('should return activity trend data', async () => {
      const trend = await messageStatsService.getChatActivityTrend('123456789', 30);

      expect(trend.length).toBe(30);
      expect(trend[0]).toHaveProperty('date');
      expect(trend[0]).toHaveProperty('messageCount');
      expect(trend[0]).toHaveProperty('activeUsers');
    });

    it('should have dates in chronological order', async () => {
      const trend = await messageStatsService.getChatActivityTrend('123456789', 7);

      for (let i = 1; i < trend.length; i++) {
        expect(new Date(trend[i].date) >= new Date(trend[i - 1].date)).toBe(true);
      }
    });
  });

  describe('getUserActivityTimeline', () => {
    it('should return user activity timeline', async () => {
      const timeline = await messageStatsService.getUserActivityTimeline(
        '123456789',
        '987654321',
        30
      );

      expect(Array.isArray(timeline)).toBe(true);
    });

    it('should include message count per day', async () => {
      const timeline = await messageStatsService.getUserActivityTimeline(
        '123456789',
        '987654321',
        7
      );

      timeline.forEach(day => {
        expect(day).toHaveProperty('date');
        expect(day).toHaveProperty('messageCount');
      });
    });
  });

  describe('compareUsers', () => {
    it('should compare statistics between users', async () => {
      const comparison = await messageStatsService.compareUsers(
        '123456789',
        ['user1', 'user2']
      );

      expect(comparison).toHaveProperty('users');
      expect(comparison.users.length).toBe(2);
    });

    it('should include relative metrics', async () => {
      const comparison = await messageStatsService.compareUsers(
        '123456789',
        ['user1', 'user2']
      );

      expect(comparison).toHaveProperty('rankings');
    });
  });

  describe('getGroupHealthScore', () => {
    it('should calculate group health score', async () => {
      const score = await messageStatsService.getGroupHealthScore('123456789');

      expect(score).toHaveProperty('overall');
      expect(score.overall).toBeGreaterThanOrEqual(0);
      expect(score.overall).toBeLessThanOrEqual(100);
    });

    it('should include component scores', async () => {
      const score = await messageStatsService.getGroupHealthScore('123456789');

      expect(score).toHaveProperty('engagement');
      expect(score).toHaveProperty('retention');
      expect(score).toHaveProperty('diversity');
    });
  });

  describe('exportStats', () => {
    it('should export statistics in JSON format', async () => {
      const exported = await messageStatsService.exportStats('123456789');

      expect(exported).toHaveProperty('chatId');
      expect(exported).toHaveProperty('exportDate');
      expect(exported).toHaveProperty('data');
    });

    it('should include all statistics sections', async () => {
      const exported = await messageStatsService.exportStats('123456789');

      expect(exported.data).toHaveProperty('overview');
      expect(exported.data).toHaveProperty('users');
      expect(exported.data).toHaveProperty('activity');
    });
  });

  describe('clearStats', () => {
    it('should clear all statistics for chat', async () => {
      const result = await messageStatsService.clearStats('123456789');

      expect(result.success).toBe(true);
    });

    it('should reset to zero after clearing', async () => {
      await messageStatsService.clearStats('123456789');
      const stats = await messageStatsService.getMessageStats('123456789');

      expect(stats.totalMessages).toBe(0);
    });
  });

  describe('recordMessageEdit', () => {
    it('should record edited messages', async () => {
      const result = await messageStatsService.recordMessageEdit(
        '123456789',
        'msg_123',
        'Original text',
        'Edited text'
      );

      expect(result.success).toBe(true);
    });

    it('should track edit count', async () => {
      await messageStatsService.recordMessageEdit('123456789', 'msg_123', 'A', 'B');
      await messageStatsService.recordMessageEdit('123456789', 'msg_123', 'B', 'C');

      const stats = await messageStatsService.getUserStats('123456789', 'user_id');
      expect(stats.editedMessages).toBeGreaterThanOrEqual(1);
    });
  });

  describe('recordMessageDelete', () => {
    it('should record deleted messages', async () => {
      const result = await messageStatsService.recordMessageDelete(
        '123456789',
        'msg_123',
        'deleted_by_user'
      );

      expect(result.success).toBe(true);
    });
  });
});

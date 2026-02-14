import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PointsService } from '../../services/pointsService';
import { createMockContext, createMockChat, createMockUser } from '../setup';

describe('PointsService', () => {
  let pointsService: PointsService;
  let mockContext: any;

  beforeEach(() => {
    pointsService = new PointsService();
    mockContext = createMockContext();
    vi.clearAllMocks();
  });

  describe('getUserPoints', () => {
    it('should return user points', async () => {
      const points = await pointsService.getUserPoints('123456789', '987654321');

      expect(points).toHaveProperty('totalPoints');
      expect(points).toHaveProperty('level');
      expect(points).toHaveProperty('rank');
    });

    it('should return 0 points for new user', async () => {
      const points = await pointsService.getUserPoints('123456789', 'new_user');

      expect(points.totalPoints).toBe(0);
      expect(points.level).toBe(1);
    });
  });

  describe('addPoints', () => {
    it('should add points to user', async () => {
      const result = await pointsService.addPoints({
        chatId: '123456789',
        userId: '987654321',
        points: 100,
        reason: 'Test points addition'
      });

      expect(result.success).toBe(true);
      expect(result.newTotal).toBeGreaterThan(0);
    });

    it('should reject negative points', async () => {
      const result = await pointsService.addPoints({
        chatId: '123456789',
        userId: '987654321',
        points: -50,
        reason: 'Negative points'
      });

      expect(result.success).toBe(false);
    });

    it('should handle decimal points', async () => {
      const result = await pointsService.addPoints({
        chatId: '123456789',
        userId: '987654321',
        points: 10.5,
        reason: 'Decimal points'
      });

      expect(result.success).toBe(true);
    });
  });

  describe('deductPoints', () => {
    it('should deduct points from user', async () => {
      await pointsService.addPoints({
        chatId: '123456789',
        userId: '987654321',
        points: 1000,
        reason: 'Initial points'
      });

      const result = await pointsService.deductPoints({
        chatId: '123456789',
        userId: '987654321',
        points: 500,
        reason: 'Test deduction'
      });

      expect(result.success).toBe(true);
    });

    it('should not allow negative balance', async () => {
      await pointsService.addPoints({
        chatId: '123456789',
        userId: '987654321',
        points: 100,
        reason: 'Initial points'
      });

      const result = await pointsService.deductPoints({
        chatId: '123456789',
        userId: '987654321',
        points: 200,
        reason: 'Over deduction'
      });

      expect(result.success).toBe(false);
    });
  });

  describe('transferPoints', () => {
    it('should transfer points between users', async () => {
      await pointsService.addPoints({
        chatId: '123456789',
        userId: 'user1',
        points: 1000,
        reason: 'Initial points'
      });

      const result = await pointsService.transferPoints({
        chatId: '123456789',
        fromUserId: 'user1',
        toUserId: 'user2',
        points: 500
      });

      expect(result.success).toBe(true);
    });

    it('should not allow self-transfer', async () => {
      await pointsService.addPoints({
        chatId: '123456789',
        userId: 'user1',
        points: 1000,
        reason: 'Initial points'
      });

      const result = await pointsService.transferPoints({
        chatId: '123456789',
        fromUserId: 'user1',
        toUserId: 'user1',
        points: 100
      });

      expect(result.success).toBe(false);
    });
  });

  describe('checkIn', () => {
    it('should allow daily check-in', async () => {
      const result = await pointsService.checkIn('123456789', '987654321');

      expect(result.success).toBe(true);
      expect(result.pointsAwarded).toBeGreaterThan(0);
    });

    it('should not allow double check-in on same day', async () => {
      await pointsService.checkIn('123456789', '987654321');

      const result = await pointsService.checkIn('123456789', '987654321');

      expect(result.success).toBe(false);
      expect(result.message).toContain('already');
    });

    it('should award consecutive check-in bonus', async () => {
      const chatId = 'consecutive_bonus_test';
      const userId = 'bonus_user';

      await pointsService.checkIn(chatId, userId);
      await pointsService.updateUserCheckInDate(chatId, userId, 1);

      const result = await pointsService.checkIn(chatId, userId);

      expect(result.success).toBe(true);
      expect(result.isConsecutive).toBe(true);
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard', async () => {
      await pointsService.addPoints({
        chatId: '123456789',
        userId: 'user1',
        points: 1000,
        reason: 'Leaderboard test'
      });
      await pointsService.addPoints({
        chatId: '123456789',
        userId: 'user2',
        points: 2000,
        reason: 'Leaderboard test'
      });

      const leaderboard = await pointsService.getLeaderboard('123456789');

      expect(leaderboard.length).toBeGreaterThanOrEqual(2);
      expect(leaderboard[0].rank).toBe(1);
    });

    it('should support pagination', async () => {
      const leaderboard = await pointsService.getLeaderboard(
        '123456789',
        1,
        10
      );

      expect(leaderboard.length).toBeLessThanOrEqual(10);
    });

    it('should include user position when requested', async () => {
      await pointsService.addPoints({
        chatId: '123456789',
        userId: 'rank_user',
        points: 500,
        reason: 'Rank test'
      });

      const leaderboard = await pointsService.getLeaderboard(
        '123456789',
        1,
        100,
        'rank_user'
      );

      expect(leaderboard.userPosition).toBeDefined();
    });
  });

  describe('getLevelInfo', () => {
    it('should return user level information', async () => {
      await pointsService.addPoints({
        chatId: '123456789',
        userId: '987654321',
        points: 10000,
        reason: 'Level test'
      });

      const levelInfo = await pointsService.getLevelInfo('123456789', '987654321');

      expect(levelInfo).toHaveProperty('level');
      expect(levelInfo).toHaveProperty('currentPoints');
      expect(levelInfo).toHaveProperty('pointsToNextLevel');
    });

    it('should calculate level based on points', async () => {
      const level1 = await pointsService.getLevelInfo('123456789', 'user1');
      await pointsService.addPoints({
        chatId: '123456789',
        userId: 'user1',
        points: 10000,
        reason: 'Level up'
      });
      const level2 = await pointsService.getLevelInfo('123456789', 'user1');

      expect(level2.level).toBeGreaterThan(level1.level);
    });
  });

  describe('getPointsHistory', () => {
    it('should return points history', async () => {
      await pointsService.addPoints({
        chatId: '123456789',
        userId: '987654321',
        points: 100,
        reason: 'History test 1'
      });
      await pointsService.addPoints({
        chatId: '123456789',
        userId: '987654321',
        points: 50,
        reason: 'History test 2'
      });

      const history = await pointsService.getPointsHistory('123456789', '987654321');

      expect(history.length).toBeGreaterThanOrEqual(2);
    });

    it('should support pagination', async () => {
      const history = await pointsService.getPointsHistory(
        '123456789',
        '987654321',
        1,
        10
      );

      expect(history.length).toBeLessThanOrEqual(10);
    });

    it('should filter by reason', async () => {
      const filteredHistory = await pointsService.getPointsHistory(
        '123456789',
        '987654321',
        1,
        100,
        'specific_reason'
      );

      expect(filteredHistory.every(h => h.reason === 'specific_reason')).toBe(true);
    });
  });

  describe('setPoints', () => {
    it('should set exact points value', async () => {
      const result = await pointsService.setPoints({
        chatId: '123456789',
        userId: '987654321',
        points: 5000
      });

      expect(result.success).toBe(true);
      expect(result.newTotal).toBe(5000);
    });
  });

  describe('bulkAddPoints', () => {
    it('should add points to multiple users', async () => {
      const users = [
        { userId: 'bulk1', points: 100 },
        { userId: 'bulk2', points: 200 },
        { userId: 'bulk3', points: 300 }
      ];

      const result = await pointsService.bulkAddPoints({
        chatId: '123456789',
        users,
        reason: 'Bulk points addition'
      });

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(3);
    });
  });

  describe('getPointsStats', () => {
    it('should return points statistics', async () => {
      const stats = await pointsService.getPointsStats('123456789');

      expect(stats).toHaveProperty('totalPointsInCirculation');
      expect(stats).toHaveProperty('totalTransactions');
      expect(stats).toHaveProperty('topEarners');
      expect(stats).toHaveProperty('pointsDistribution');
    });
  });

  describe('updatePointsConfig', () => {
    it('should update points configuration', async () => {
      const config = {
        checkInBasePoints: 10,
        messagePoints: 5,
        invitePoints: 100,
        levelMultiplier: 1.5
      };

      const result = await pointsService.updatePointsConfig('123456789', config);

      expect(result.success).toBe(true);
    });
  });

  describe('getPointsConfig', () => {
    it('should return current points configuration', async () => {
      const config = await pointsService.getPointsConfig('123456789');

      expect(config).toHaveProperty('checkInBasePoints');
      expect(config).toHaveProperty('messagePoints');
    });
  });

  describe('levelUp', () => {
    it('should level up user', async () => {
      await pointsService.addPoints({
        chatId: '123456789',
        userId: 'levelup_user',
        points: 10000,
        reason: 'Level up test'
      });

      const result = await pointsService.levelUp('123456789', 'levelup_user');

      expect(result.success).toBe(true);
      expect(result.newLevel).toBeGreaterThan(1);
    });
  });
});

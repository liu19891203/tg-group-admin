import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LotteryService } from '../../services/lotteryService';
import { createMockContext, createMockChat, createMockUser } from '../setup';

describe('LotteryService', () => {
  let lotteryService: LotteryService;
  let mockContext: any;

  beforeEach(() => {
    lotteryService = new LotteryService();
    mockContext = createMockContext();
    vi.clearAllMocks();
  });

  describe('createLottery', () => {
    it('should create a new lottery', async () => {
      const lottery = {
        chatId: '123456789',
        name: 'Test Lottery',
        prize: '100 points',
        ticketPrice: 10,
        maxParticipants: 100,
        endTime: new Date(Date.now() + 86400000).toISOString()
      };

      const result = await lotteryService.createLottery(lottery);

      expect(result.success).toBe(true);
      expect(result.lottery).toHaveProperty('id');
      expect(result.lottery.name).toBe('Test Lottery');
    });

    it('should validate required fields', async () => {
      const lottery = {
        chatId: '123456789',
        name: '',
        prize: 'Test prize',
        ticketPrice: 10
      };

      await expect(lotteryService.createLottery(lottery as any)).rejects.toThrow();
    });

    it('should not allow negative ticket price', async () => {
      const lottery = {
        chatId: '123456789',
        name: 'Invalid Lottery',
        prize: 'Test prize',
        ticketPrice: -5
      };

      const result = await lotteryService.createLottery(lottery as any);

      expect(result.success).toBe(false);
    });

    it('should set default end time if not provided', async () => {
      const lottery = {
        chatId: '123456789',
        name: 'Default End Time Lottery',
        prize: 'Test prize',
        ticketPrice: 10
      };

      const result = await lotteryService.createLottery(lottery as any);

      expect(result.success).toBe(true);
      expect(result.lottery.endTime).toBeDefined();
    });
  });

  describe('joinLottery', () => {
    it('should allow user to join lottery', async () => {
      const lottery = await lotteryService.createLottery({
        chatId: '123456789',
        name: 'Join Test Lottery',
        prize: 'Test prize',
        ticketPrice: 10,
        maxParticipants: 100
      });

      await lotteryService.addPoints({
        chatId: '123456789',
        userId: '987654321',
        points: 100,
        reason: 'Lottery test'
      });

      const result = await lotteryService.joinLottery(
        lottery.lottery.id,
        '987654321'
      );

      expect(result.success).toBe(true);
      expect(result.ticketNumber).toBeDefined();
    });

    it('should reject user without enough points', async () => {
      const lottery = await lotteryService.createLottery({
        chatId: '123456789',
        name: 'No Points Lottery',
        prize: 'Test prize',
        ticketPrice: 100
      });

      const result = await lotteryService.joinLottery(
        lottery.lottery.id,
        'new_user'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('points');
    });

    it('should not allow duplicate entries', async () => {
      const lottery = await lotteryService.createLottery({
        chatId: '123456789',
        name: 'Duplicate Test Lottery',
        prize: 'Test prize',
        ticketPrice: 10,
        maxParticipants: 100
      });

      await lotteryService.addPoints({
        chatId: '123456789',
        userId: '987654321',
        points: 100,
        reason: 'Lottery test'
      });

      await lotteryService.joinLottery(lottery.lottery.id, '987654321');
      const result = await lotteryService.joinLottery(
        lottery.lottery.id,
        '987654321'
      );

      expect(result.success).toBe(false);
    });

    it('should reject when lottery is full', async () => {
      const lottery = await lotteryService.createLottery({
        chatId: '123456789',
        name: 'Full Lottery',
        prize: 'Test prize',
        ticketPrice: 10,
        maxParticipants: 2
      });

      await lotteryService.addPoints({
        chatId: '123456789',
        userId: 'user1',
        points: 100,
        reason: 'Lottery test'
      });
      await lotteryService.addPoints({
        chatId: '123456789',
        userId: 'user2',
        points: 100,
        reason: 'Lottery test'
      });
      await lotteryService.addPoints({
        chatId: '123456789',
        userId: 'user3',
        points: 100,
        reason: 'Lottery test'
      });

      await lotteryService.joinLottery(lottery.lottery.id, 'user1');
      await lotteryService.joinLottery(lottery.lottery.id, 'user2');

      const result = await lotteryService.joinLottery(lottery.lottery.id, 'user3');

      expect(result.success).toBe(false);
      expect(result.message).toContain('full');
    });
  });

  describe('drawWinner', () => {
    it('should select a winner from participants', async () => {
      const lottery = await lotteryService.createLottery({
        chatId: '123456789',
        name: 'Draw Test Lottery',
        prize: 'Winner prize',
        ticketPrice: 0,
        maxParticipants: 100
      });

      await lotteryService.joinLottery(lottery.lottery.id, 'user1');
      await lotteryService.joinLottery(lottery.lottery.id, 'user2');
      await lotteryService.joinLottery(lottery.lottery.id, 'user3');

      const result = await lotteryService.drawWinner(lottery.lottery.id);

      expect(result.success).toBe(true);
      expect(result.winner).toBeDefined();
      expect(['user1', 'user2', 'user3']).toContain(result.winner.userId);
    });

    it('should return null when no participants', async () => {
      const lottery = await lotteryService.createLottery({
        chatId: '123456789',
        name: 'Empty Lottery',
        prize: 'No winners',
        ticketPrice: 0,
        maxParticipants: 100
      });

      const result = await lotteryService.drawWinner(lottery.lottery.id);

      expect(result.success).toBe(false);
    });

    it('should refund points to winner', async () => {
      const lottery = await lotteryService.createLottery({
        chatId: '123456789',
        name: 'Refund Test Lottery',
        prize: '1000 points',
        ticketPrice: 10,
        maxParticipants: 10
      });

      await lotteryService.addPoints({
        chatId: '123456789',
        userId: 'winner_user',
        points: 100,
        reason: 'Lottery test'
      });

      await lotteryService.joinLottery(lottery.lottery.id, 'winner_user');
      await lotteryService.drawWinner(lottery.lottery.id);

      const userPoints = await lotteryService.getUserPoints('123456789', 'winner_user');
      expect(userPoints.totalPoints).toBeGreaterThan(90);
    });
  });

  describe('getLotteryDetails', () => {
    it('should return lottery details', async () => {
      const lottery = await lotteryService.createLottery({
        chatId: '123456789',
        name: 'Details Test Lottery',
        prize: 'Test prize',
        ticketPrice: 10
      });

      const details = await lotteryService.getLotteryDetails(lottery.lottery.id);

      expect(details).toHaveProperty('name');
      expect(details).toHaveProperty('prize');
      expect(details).toHaveProperty('participants');
      expect(details).toHaveProperty('status');
    });
  });

  describe('getActiveLotteries', () => {
    it('should return active lotteries for chat', async () => {
      await lotteryService.createLottery({
        chatId: '123456789',
        name: 'Active Lottery 1',
        prize: 'Prize 1',
        ticketPrice: 10
      });
      await lotteryService.createLottery({
        chatId: '123456789',
        name: 'Active Lottery 2',
        prize: 'Prize 2',
        ticketPrice: 20
      });

      const lotteries = await lotteryService.getActiveLotteries('123456789');

      expect(lotteries.length).toBe(2);
    });

    it('should not return ended lotteries', async () => {
      const lottery = await lotteryService.createLottery({
        chatId: '123456789',
        name: 'Ended Lottery',
        prize: 'Old prize',
        ticketPrice: 10
      });

      await lotteryService.endLottery(lottery.lottery.id);

      const lotteries = await lotteryService.getActiveLotteries('123456789');
      expect(lotteries.find(l => l.id === lottery.lottery.id)).toBeUndefined();
    });
  });

  describe('cancelLottery', () => {
    it('should cancel lottery and refund all participants', async () => {
      const lottery = await lotteryService.createLottery({
        chatId: '123456789',
        name: 'Cancel Test Lottery',
        prize: 'Test prize',
        ticketPrice: 10,
        maxParticipants: 10
      });

      await lotteryService.addPoints({
        chatId: '123456789',
        userId: 'user1',
        points: 100,
        reason: 'Lottery test'
      });
      await lotteryService.joinLottery(lottery.lottery.id, 'user1');

      const result = await lotteryService.cancelLottery(lottery.lottery.id);

      expect(result.success).toBe(true);
      expect(result.refundedCount).toBe(1);
    });
  });

  describe('endLottery', () => {
    it('should end lottery without winner', async () => {
      const lottery = await lotteryService.createLottery({
        chatId: '123456789',
        name: 'End Test Lottery',
        prize: 'Test prize',
        ticketPrice: 10
      });

      const result = await lotteryService.endLottery(lottery.lottery.id);

      expect(result.success).toBe(true);
      expect(result.lottery.status).toBe('ended');
    });
  });

  describe('getUserLotteryHistory', () => {
    it('should return lottery history for user', async () => {
      const lottery = await lotteryService.createLottery({
        chatId: '123456789',
        name: 'History Test Lottery',
        prize: 'Test prize',
        ticketPrice: 0
      });

      await lotteryService.joinLottery(lottery.lottery.id, '987654321');

      const history = await lotteryService.getUserLotteryHistory(
        '123456789',
        '987654321'
      );

      expect(history.length).toBeGreaterThan(0);
    });
  });

  describe('createLuckyDraw', () => {
    it('should create a lucky draw with instant results', async () => {
      await lotteryService.addPoints({
        chatId: '123456789',
        userId: '987654321',
        points: 100,
        reason: 'Lucky draw test'
      });

      const result = await lotteryService.createLuckyDraw({
        chatId: '123456789',
        userId: '987654321',
        betAmount: 10,
        multipliers: { win: 2, lose: 0 }
      });

      expect(result).toHaveProperty('won');
      expect(result).toHaveProperty('prize');
    });
  });

  describe('getLotteryStats', () => {
    it('should return lottery statistics', async () => {
      const stats = await lotteryService.getLotteryStats('123456789');

      expect(stats).toHaveProperty('totalLotteries');
      expect(stats).toHaveProperty('totalParticipants');
      expect(stats).toHaveProperty('totalPrizesDistributed');
      expect(stats).toHaveProperty('popularLotteries');
    });
  });

  describe('updateLotteryConfig', () => {
    it('should update lottery configuration', async () => {
      const lottery = await lotteryService.createLottery({
        chatId: '123456789',
        name: 'Config Test Lottery',
        prize: 'Original prize',
        ticketPrice: 10
      });

      const result = await lotteryService.updateLotteryConfig(lottery.lottery.id, {
        prize: 'Updated prize',
        ticketPrice: 15
      });

      expect(result.success).toBe(true);
      expect(result.lottery.prize).toBe('Updated prize');
      expect(result.lottery.ticketPrice).toBe(15);
    });
  });

  describe('getParticipants', () => {
    it('should return list of lottery participants', async () => {
      const lottery = await lotteryService.createLottery({
        chatId: '123456789',
        name: 'Participants Test Lottery',
        prize: 'Test prize',
        ticketPrice: 0,
        maxParticipants: 10
      });

      await lotteryService.joinLottery(lottery.lottery.id, 'user1');
      await lotteryService.joinLottery(lottery.lottery.id, 'user2');

      const participants = await lotteryService.getParticipants(lottery.lottery.id);

      expect(participants.length).toBe(2);
    });
  });

  describe('exportLotteryResults', () => {
    it('should export lottery results', async () => {
      const lottery = await lotteryService.createLottery({
        chatId: '123456789',
        name: 'Export Test Lottery',
        prize: 'Test prize',
        ticketPrice: 0
      });

      await lotteryService.joinLottery(lottery.lottery.id, 'user1');

      const results = await lotteryService.exportLotteryResults(lottery.lottery.id);

      expect(results).toHaveProperty('lottery');
      expect(results).toHaveProperty('participants');
      expect(results).toHaveProperty('exportDate');
    });
  });
});

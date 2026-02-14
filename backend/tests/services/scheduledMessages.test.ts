import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScheduledMessagesService } from '../../services/scheduledMessages';
import { createMockContext, createMockChat, createMockUser } from '../setup';

describe('ScheduledMessagesService', () => {
  let scheduledMessagesService: ScheduledMessagesService;
  let mockContext: any;

  beforeEach(() => {
    scheduledMessagesService = new ScheduledMessagesService();
    mockContext = createMockContext();
    vi.clearAllMocks();
  });

  describe('createScheduledMessage', () => {
    it('should create a new scheduled message', async () => {
      const message = {
        chatId: '123456789',
        content: 'Test scheduled message',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        createdBy: '987654321'
      };

      const result = await scheduledMessagesService.createScheduledMessage(message);

      expect(result.success).toBe(true);
      expect(result.message).toHaveProperty('id');
      expect(result.message.content).toBe('Test scheduled message');
    });

    it('should validate required fields', async () => {
      const invalidMessage = {
        chatId: '123456789'
      };

      await expect(
        scheduledMessagesService.createScheduledMessage(invalidMessage as any)
      ).rejects.toThrow();
    });

    it('should not allow scheduling in the past', async () => {
      const pastMessage = {
        chatId: '123456789',
        content: 'Past message',
        scheduledAt: new Date(Date.now() - 86400000).toISOString()
      };

      const result = await scheduledMessagesService.createScheduledMessage(pastMessage);

      expect(result.success).toBe(false);
      expect(result.error).toContain('past');
    });

    it('should support recurring messages', async () => {
      const recurringMessage = {
        chatId: '123456789',
        content: 'Daily reminder',
        scheduledAt: new Date(Date.now() + 3600000).toISOString(),
        repeat: 'daily',
        repeatUntil: new Date(Date.now() + 86400000 * 30).toISOString()
      };

      const result = await scheduledMessagesService.createScheduledMessage(recurringMessage);

      expect(result.success).toBe(true);
      expect(result.message.repeat).toBe('daily');
    });

    it('should set default priority', async () => {
      const message = {
        chatId: '123456789',
        content: 'Priority test',
        scheduledAt: new Date(Date.now() + 86400000).toISOString()
      };

      const result = await scheduledMessagesService.createScheduledMessage(message);

      expect(result.message.priority).toBe('normal');
    });
  });

  describe('updateScheduledMessage', () => {
    it('should update existing scheduled message', async () => {
      const created = await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Original content',
        scheduledAt: new Date(Date.now() + 86400000).toISOString()
      });

      const result = await scheduledMessagesService.updateScheduledMessage(created.message.id, {
        content: 'Updated content'
      });

      expect(result.success).toBe(true);
      expect(result.message.content).toBe('Updated content');
    });

    it('should not allow updating past messages', async () => {
      const created = await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Past message',
        scheduledAt: new Date(Date.now() - 1000).toISOString()
      });

      const result = await scheduledMessagesService.updateScheduledMessage(created.message.id, {
        content: 'Trying to update'
      });

      expect(result.success).toBe(false);
    });

    it('should update recurrence settings', async () => {
      const created = await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Recurring test',
        scheduledAt: new Date(Date.now() + 86400000).toISOString()
      });

      const result = await scheduledMessagesService.updateScheduledMessage(created.message.id, {
        repeat: 'weekly'
      });

      expect(result.success).toBe(true);
      expect(result.message.repeat).toBe('weekly');
    });
  });

  describe('deleteScheduledMessage', () => {
    it('should delete scheduled message', async () => {
      const created = await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'To be deleted',
        scheduledAt: new Date(Date.now() + 86400000).toISOString()
      });

      const result = await scheduledMessagesService.deleteScheduledMessage(created.message.id);

      expect(result.success).toBe(true);
    });

    it('should not delete already sent messages', async () => {
      const created = await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Already sent',
        scheduledAt: new Date(Date.now() - 1000).toISOString()
      });

      const result = await scheduledMessagesService.deleteScheduledMessage(created.message.id);

      expect(result.success).toBe(false);
    });
  });

  describe('cancelScheduledMessage', () => {
    it('should cancel scheduled message without deleting', async () => {
      const created = await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'To be cancelled',
        scheduledAt: new Date(Date.now() + 86400000).toISOString()
      });

      const result = await scheduledMessagesService.cancelScheduledMessage(created.message.id);

      expect(result.success).toBe(true);
      expect(result.message.status).toBe('cancelled');
    });
  });

  describe('getScheduledMessages', () => {
    it('should return all scheduled messages for chat', async () => {
      await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Message 1',
        scheduledAt: new Date(Date.now() + 86400000).toISOString()
      });
      await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Message 2',
        scheduledAt: new Date(Date.now() + 172800000).toISOString()
      });

      const messages = await scheduledMessagesService.getScheduledMessages('123456789');

      expect(messages.length).toBe(2);
    });

    it('should filter by status', async () => {
      const active = await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Active message',
        scheduledAt: new Date(Date.now() + 86400000).toISOString()
      });
      await scheduledMessagesService.cancelScheduledMessage(active.message.id);

      const messages = await scheduledMessagesService.getScheduledMessages('123456789', {
        status: 'cancelled'
      });

      expect(messages.every(m => m.status === 'cancelled')).toBe(true);
    });

    it('should return only upcoming messages', async () => {
      const now = new Date();
      await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Future message',
        scheduledAt: new Date(now.getTime() + 86400000).toISOString()
      });
      await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Past message',
        scheduledAt: new Date(now.getTime() - 86400000).toISOString()
      });

      const messages = await scheduledMessagesService.getScheduledMessages('123456789', {
        upcoming: true
      });

      expect(messages.every(m => new Date(m.scheduledAt) > now)).toBe(true);
    });
  });

  describe('getScheduledMessage', () => {
    it('should return specific scheduled message', async () => {
      const created = await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Get by ID test',
        scheduledAt: new Date(Date.now() + 86400000).toISOString()
      });

      const message = await scheduledMessagesService.getScheduledMessage(created.message.id);

      expect(message).toBeDefined();
      expect(message.content).toBe('Get by ID test');
    });

    it('should return null for non-existent message', async () => {
      const message = await scheduledMessagesService.getScheduledMessage('non-existent');

      expect(message).toBeNull();
    });
  });

  describe('sendNow', () => {
    it('should send message immediately', async () => {
      const created = await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Send now test',
        scheduledAt: new Date(Date.now() + 86400000).toISOString()
      });

      const result = await scheduledMessagesService.sendNow(created.message.id);

      expect(result.success).toBe(true);
      expect(result.message.status).toBe('sent');
    });

    it('should not send already sent messages', async () => {
      const created = await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Already sent',
        scheduledAt: new Date(Date.now() - 1000).toISOString()
      });

      const result = await scheduledMessagesService.sendNow(created.message.id);

      expect(result.success).toBe(false);
    });
  });

  describe('sendScheduledMessages', () => {
    it('should process and send due messages', async () => {
      await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Due message 1',
        scheduledAt: new Date(Date.now() - 1000).toISOString()
      });
      await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Due message 2',
        scheduledAt: new Date(Date.now() - 1000).toISOString()
      });

      const result = await scheduledMessagesService.sendScheduledMessages();

      expect(result.sentCount).toBe(2);
    });

    it('should handle recurring message generation', async () => {
      const created = await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Recurring message',
        scheduledAt: new Date(Date.now() - 1000).toISOString(),
        repeat: 'daily'
      });

      const result = await scheduledMessagesService.sendScheduledMessages();

      expect(result.generatedRecurring).toBeGreaterThan(0);
    });

    it('should skip cancelled messages', async () => {
      const created = await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Cancelled message',
        scheduledAt: new Date(Date.now() - 1000).toISOString()
      });
      await scheduledMessagesService.cancelScheduledMessage(created.message.id);

      const result = await scheduledMessagesService.sendScheduledMessages();

      const cancelledMessage = result.messages.find(m => m.id === created.message.id);
      expect(cancelledMessage).toBeUndefined();
    });
  });

  describe('validateCronExpression', () => {
    it('should validate standard cron expressions', async () => {
      const result = scheduledMessagesService.validateCronExpression('0 9 * * 1');

      expect(result.valid).toBe(true);
    });

    it('should reject invalid cron expressions', async () => {
      const result = scheduledMessagesService.validateCronExpression('invalid cron');

      expect(result.valid).toBe(false);
    });

    it('should parse cron human-readable descriptions', async () => {
      const result = scheduledMessagesService.validateCronExpression('@daily');

      expect(result.valid).toBe(true);
      expect(result.parsed).toBeDefined();
    });
  });

  describe('getNextOccurrence', () => {
    it('should calculate next occurrence', async () => {
      const next = scheduledMessagesService.getNextOccurrence('0 9 * * *');

      expect(next).toBeDefined();
      expect(next).toBeInstanceOf(Date);
    });

    it('should handle specific date input', async () => {
      const specific = new Date('2024-06-15T10:00:00Z');
      const next = scheduledMessagesService.getNextOccurrence('0 * * * *', specific);

      expect(next).toBeGreaterThan(specific);
    });
  });

  describe('duplicateScheduledMessage', () => {
    it('should create a copy of scheduled message', async () => {
      const original = await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Original message',
        scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        repeat: 'weekly'
      });

      const duplicate = await scheduledMessagesService.duplicateScheduledMessage(
        original.message.id,
        new Date(Date.now() + 172800000).toISOString()
      );

      expect(duplicate.success).toBe(true);
      expect(duplicate.message.content).toBe('Original message');
      expect(duplicate.message.id).not.toBe(original.message.id);
    });
  });

  describe('getMessageHistory', () => {
    it('should return sent message history', async () => {
      const created = await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'History test',
        scheduledAt: new Date(Date.now() - 1000).toISOString()
      });
      await scheduledMessagesService.sendNow(created.message.id);

      const history = await scheduledMessagesService.getMessageHistory('123456789');

      expect(history.length).toBeGreaterThan(0);
    });

    it('should support date filtering', async () => {
      const now = new Date();
      await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Old message',
        scheduledAt: new Date(now.getTime() - 86400000 * 10).toISOString()
      });

      const history = await scheduledMessagesService.getMessageHistory('123456789', {
        from: new Date(now.getTime() - 86400000 * 5).toISOString()
      });

      expect(history.every(m => new Date(m.sentAt) > new Date(now.getTime() - 86400000 * 5))).toBe(true);
    });
  });

  describe('getScheduledStats', () => {
    it('should return scheduling statistics', async () => {
      await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Stats test 1',
        scheduledAt: new Date(Date.now() + 86400000).toISOString()
      });
      await scheduledMessagesService.createScheduledMessage({
        chatId: '123456789',
        content: 'Stats test 2',
        scheduledAt: new Date(Date.now() + 172800000).toISOString()
      });

      const stats = await scheduledMessagesService.getScheduledStats('123456789');

      expect(stats).toHaveProperty('totalScheduled');
      expect(stats).toHaveProperty('sentToday');
      expect(stats).toHaveProperty('byRepeatType');
    });
  });

  describe('bulkSchedule', () => {
    it('should schedule multiple messages at once', async () => {
      const messages = [
        { chatId: '123456789', content: 'Bulk message 1', scheduledAt: new Date(Date.now() + 86400000).toISOString() },
        { chatId: '123456789', content: 'Bulk message 2', scheduledAt: new Date(Date.now() + 172800000).toISOString() },
        { chatId: '123456789', content: 'Bulk message 3', scheduledAt: new Date(Date.now() + 259200000).toISOString() }
      ];

      const result = await scheduledMessagesService.bulkSchedule(messages);

      expect(result.success).toBe(true);
      expect(result.scheduledCount).toBe(3);
    });

    it('should handle partial failures', async () => {
      const messages = [
        { chatId: '123456789', content: 'Valid message', scheduledAt: new Date(Date.now() + 86400000).toISOString() },
        { chatId: '123456789', content: 'Invalid message', scheduledAt: new Date(Date.now() - 86400000).toISOString() }
      ];

      const result = await scheduledMessagesService.bulkSchedule(messages);

      expect(result.success).toBe(true);
      expect(result.scheduledCount).toBe(1);
      expect(result.failedCount).toBe(1);
    });
  });
});

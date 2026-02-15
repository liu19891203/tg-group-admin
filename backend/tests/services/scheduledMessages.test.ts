import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScheduledMessagesService } from '../../services/scheduledMessagesService';

vi.mock('../../lib/database', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
          lte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          })),
          gte: vi.fn(),
          order: vi.fn()
        })),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn()
          }))
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn()
            }))
          }))
        })),
        delete: vi.fn(() => ({
          eq: vi.fn()
        }))
      }))
    }))
  }
}));

vi.mock('../../lib/api', () => ({
  sendMessage: vi.fn(() => Promise.resolve({ ok: true }))
}));

describe('ScheduledMessagesService', () => {
  let service: ScheduledMessagesService;

  beforeEach(() => {
    service = new ScheduledMessagesService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('validateCronExpression', () => {
    it('should validate standard cron expressions', () => {
      const result = service.validateCronExpression('0 9 * * 1');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid cron expressions', () => {
      const result = service.validateCronExpression('invalid cron');
      expect(result.valid).toBe(false);
    });

    it('should parse cron human-readable descriptions', () => {
      const result = service.validateCronExpression('@daily');
      expect(result.valid).toBe(true);
      expect(result.parsed).toBeDefined();
    });

    it('should validate cron with step values', () => {
      const result = service.validateCronExpression('*/5 * * * *');
      expect(result.valid).toBe(true);
    });

    it('should validate cron with range values', () => {
      const result = service.validateCronExpression('0 9-17 * * 1-5');
      expect(result.valid).toBe(true);
    });

    it('should reject cron with too few fields', () => {
      const result = service.validateCronExpression('0 9 *');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('5 个字段');
    });

    it('should validate @hourly preset', () => {
      const result = service.validateCronExpression('@hourly');
      expect(result.valid).toBe(true);
    });

    it('should validate @weekly preset', () => {
      const result = service.validateCronExpression('@weekly');
      expect(result.valid).toBe(true);
    });
  });

  describe('getNextOccurrence', () => {
    it('should calculate next occurrence for daily cron', () => {
      const next = service.getNextOccurrence('0 9 * * *');
      expect(next).toBeDefined();
      expect(next).toBeInstanceOf(Date);
    });

    it('should handle specific date input', () => {
      const specific = new Date('2024-06-15T10:00:00Z');
      const next = service.getNextOccurrence('0 * * * *', specific);
      expect(next.getTime()).toBeGreaterThan(specific.getTime());
    });

    it('should return a future date', () => {
      const now = new Date();
      const next = service.getNextOccurrence('0 0 * * *');
      expect(next.getTime()).toBeGreaterThan(now.getTime());
    });

    it('should handle @daily preset', () => {
      const next = service.getNextOccurrence('@daily');
      expect(next).toBeInstanceOf(Date);
      expect(next.getMinutes()).toBe(0);
      expect(next.getHours()).toBe(0);
    });

    it('should handle @hourly preset', () => {
      const now = new Date();
      const next = service.getNextOccurrence('@hourly', now);
      expect(next).toBeInstanceOf(Date);
      expect(next.getMinutes()).toBe(0);
    });
  });

  describe('getIntervalMinutes', () => {
    it('should return undefined for none repeat', () => {
      const service = new ScheduledMessagesService();
      const result = service['getIntervalMinutes']('none');
      expect(result).toBeUndefined();
    });

    it('should return correct minutes for daily', () => {
      const result = service['getIntervalMinutes']('daily');
      expect(result).toBe(24 * 60);
    });

    it('should return correct minutes for weekly', () => {
      const result = service['getIntervalMinutes']('weekly');
      expect(result).toBe(7 * 24 * 60);
    });

    it('should return correct minutes for monthly', () => {
      const result = service['getIntervalMinutes']('monthly');
      expect(result).toBe(30 * 24 * 60);
    });
  });

  describe('matchesField', () => {
    it('should match wildcard', () => {
      const result = service['matchesField'](5, '*', 0, 59);
      expect(result).toBe(true);
    });

    it('should match exact value', () => {
      const result = service['matchesField'](5, '5', 0, 59);
      expect(result).toBe(true);
    });

    it('should not match different value', () => {
      const result = service['matchesField'](5, '10', 0, 59);
      expect(result).toBe(false);
    });

    it('should match range', () => {
      expect(service['matchesField'](5, '1-10', 0, 59)).toBe(true);
      expect(service['matchesField'](15, '1-10', 0, 59)).toBe(false);
    });

    it('should match step values', () => {
      expect(service['matchesField'](0, '*/5', 0, 59)).toBe(true);
      expect(service['matchesField'](5, '*/5', 0, 59)).toBe(true);
      expect(service['matchesField'](10, '*/5', 0, 59)).toBe(true);
      expect(service['matchesField'](3, '*/5', 0, 59)).toBe(false);
    });

    it('should match comma-separated values', () => {
      expect(service['matchesField'](1, '1,3,5', 0, 59)).toBe(true);
      expect(service['matchesField'](3, '1,3,5', 0, 59)).toBe(true);
      expect(service['matchesField'](2, '1,3,5', 0, 59)).toBe(false);
    });
  });
});

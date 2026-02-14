import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoReplyService } from '../../services/autoReplyService';
import { createMockContext, createMockChat, createMockUser } from '../setup';

describe('AutoReplyService', () => {
  let autoReplyService: AutoReplyService;
  let mockContext: any;

  beforeEach(() => {
    autoReplyService = new AutoReplyService();
    mockContext = createMockContext();
    vi.clearAllMocks();
  });

  describe('checkAutoReply', () => {
    it('should match exact keyword and return reply', async () => {
      mockContext.message = {
        text: 'hello',
        chat: createMockChat()
      };

      const result = await autoReplyService.checkAutoReply(mockContext);

      expect(result.matched).toBe(true);
      expect(result.reply).toBeDefined();
    });

    it('should match case-insensitive keyword', async () => {
      mockContext.message = {
        text: 'HELLO',
        chat: createMockChat()
      };

      const result = await autoReplyService.checkAutoReply(mockContext);

      expect(result.matched).toBe(true);
    });

    it('should not trigger on partial matches when exact match required', async () => {
      mockContext.message = {
        text: 'hello world',
        chat: createMockChat()
      };

      const result = await autoReplyService.checkAutoReply(mockContext);

      expect(result.matched).toBe(false);
    });

    it('should trigger on partial matches when configured', async () => {
      mockContext.message = {
        text: 'hello there',
        chat: createMockChat()
      };

      const result = await autoReplyService.checkAutoReply(mockContext);

      expect(result.matched).toBe(true);
    });

    it('should match regex patterns', async () => {
      mockContext.message = {
        text: 'My email is test@example.com',
        chat: createMockChat()
      };

      const result = await autoReplyService.checkAutoReply(mockContext);

      expect(result.matched).toBe(true);
    });

    it('should select random reply when multiple replies configured', async () => {
      mockContext.message = {
        text: 'random',
        chat: createMockChat()
      };

      const replies: string[] = [];
      for (let i = 0; i < 10; i++) {
        const result = await autoReplyService.checkAutoReply(mockContext);
        if (result.matched && result.reply) {
          replies.push(result.reply);
        }
      }

      expect(replies.length).toBeGreaterThan(0);
    });
  });

  describe('createReplyRule', () => {
    it('should create a new reply rule', async () => {
      const rule = {
        keyword: 'test_keyword',
        reply: 'This is a test reply',
        chatId: '123456789',
        isRegex: false,
        isGlobal: false
      };

      const result = await autoReplyService.createReplyRule(rule);

      expect(result.success).toBe(true);
      expect(result.rule).toHaveProperty('id');
      expect(result.rule.keyword).toBe('test_keyword');
    });

    it('should validate required fields', async () => {
      const rule = {
        keyword: '',
        reply: 'Test reply',
        chatId: '123456789'
      };

      await expect(autoReplyService.createReplyRule(rule as any)).rejects.toThrow();
    });
  });

  describe('updateReplyRule', () => {
    it('should update existing reply rule', async () => {
      const rule = await autoReplyService.createReplyRule({
        keyword: 'update_test',
        reply: 'Original reply',
        chatId: '123456789'
      });

      const result = await autoReplyService.updateReplyRule(
        rule.rule.id,
        { reply: 'Updated reply' }
      );

      expect(result.success).toBe(true);
      expect(result.rule.reply).toBe('Updated reply');
    });
  });

  describe('deleteReplyRule', () => {
    it('should delete existing reply rule', async () => {
      const rule = await autoReplyService.createReplyRule({
        keyword: 'delete_test',
        reply: 'To be deleted',
        chatId: '123456789'
      });

      const result = await autoReplyService.deleteReplyRule(rule.rule.id);

      expect(result.success).toBe(true);
    });
  });

  describe('getReplyRules', () => {
    it('should return all reply rules for a chat', async () => {
      await autoReplyService.createReplyRule({
        keyword: 'rule1',
        reply: 'Reply 1',
        chatId: '123456789'
      });
      await autoReplyService.createReplyRule({
        keyword: 'rule2',
        reply: 'Reply 2',
        chatId: '123456789'
      });

      const rules = await autoReplyService.getReplyRules('123456789');

      expect(rules.length).toBe(2);
    });
  });

  describe('getReplyRuleById', () => {
    it('should return specific reply rule', async () => {
      const created = await autoReplyService.createReplyRule({
        keyword: 'get_by_id',
        reply: 'Test reply',
        chatId: '123456789'
      });

      const rule = await autoReplyService.getReplyRuleById(created.rule.id);

      expect(rule).toBeDefined();
      expect(rule.keyword).toBe('get_by_id');
    });
  });

  describe('toggleRuleEnabled', () => {
    it('should toggle rule enabled status', async () => {
      const created = await autoReplyService.createReplyRule({
        keyword: 'toggle_test',
        reply: 'Test reply',
        chatId: '123456789'
      });

      const result1 = await autoReplyService.toggleRuleEnabled(created.rule.id);
      expect(result1.rule.isEnabled).toBe(false);

      const result2 = await autoReplyService.toggleRuleEnabled(created.rule.id);
      expect(result2.rule.isEnabled).toBe(true);
    });
  });

  describe('reorderRules', () => {
    it('should reorder rules', async () => {
      const rule1 = await autoReplyService.createReplyRule({
        keyword: 'reorder1',
        reply: 'Reply 1',
        chatId: '123456789'
      });
      const rule2 = await autoReplyService.createReplyRule({
        keyword: 'reorder2',
        reply: 'Reply 2',
        chatId: '123456789'
      });

      const result = await autoReplyService.reorderRules([
        rule2.rule.id,
        rule1.rule.id
      ]);

      expect(result.success).toBe(true);
    });
  });

  describe('bulkImportRules', () => {
    it('should import multiple rules at once', async () => {
      const rules = [
        { keyword: 'import1', reply: 'Reply 1', chatId: '123456789' },
        { keyword: 'import2', reply: 'Reply 2', chatId: '123456789' },
        { keyword: 'import3', reply: 'Reply 3', chatId: '123456789' }
      ];

      const result = await autoReplyService.bulkImportRules(rules);

      expect(result.success).toBe(true);
      expect(result.importedCount).toBe(3);
    });
  });

  describe('exportRules', () => {
    it('should export rules in JSON format', async () => {
      await autoReplyService.createReplyRule({
        keyword: 'export1',
        reply: 'Reply 1',
        chatId: '123456789'
      });

      const exported = await autoReplyService.exportRules('123456789');

      expect(exported).toHaveProperty('rules');
      expect(exported).toHaveProperty('exportDate');
      expect(Array.isArray(exported.rules)).toBe(true);
    });
  });

  describe('getReplyStats', () => {
    it('should return reply statistics', async () => {
      const stats = await autoReplyService.getReplyStats('123456789');

      expect(stats).toHaveProperty('totalReplies');
      expect(stats).toHaveProperty('repliesByRule');
      expect(stats).toHaveProperty('topReplies');
    });
  });

  describe('clearReplyStats', () => {
    it('should clear reply statistics', async () => {
      const result = await autoReplyService.clearReplyStats('123456789');

      expect(result.success).toBe(true);
    });
  });

  describe('searchReplies', () => {
    it('should search replies by keyword', async () => {
      await autoReplyService.createReplyRule({
        keyword: 'search_test_123',
        reply: 'Test reply content',
        chatId: '123456789'
      });

      const results = await autoReplyService.searchReplies('search_test_123');

      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('testReplyRule', () => {
    it('should test a rule against sample text', async () => {
      const result = await autoReplyService.testReplyRule(
        'hello world',
        'hello*'
      );

      expect(result.matches).toBe(true);
    });

    it('should handle non-matching patterns', async () => {
      const result = await autoReplyService.testReplyRule(
        'goodbye world',
        'hello*'
      );

      expect(result.matches).toBe(false);
    });
  });
});

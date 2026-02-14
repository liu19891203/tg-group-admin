import { describe, it, expect, vi, beforeEach, mock } from 'vitest';
import { createMockSupabase, createMockRedis } from '../setup';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

describe('API Tests - Groups', () => {
  let mockSupabase: any;
  let mockRedis: any;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    mockRedis = createMockRedis();
  });

  describe('GET /api/admin/groups', () => {
    it('should return list of groups', async () => {
      const mockGroups = [
        { id: '1', chat_id: '123456', title: 'Test Group 1', is_active: true },
        { id: '2', chat_id: '789012', title: 'Test Group 2', is_active: true }
      ];

      mockSupabase.from().select().mockResolvedValue({ data: mockGroups, error: null });

      const response = await fetch('/api/admin/groups');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.groups).toHaveLength(2);
    });

    it('should handle empty groups list', async () => {
      mockSupabase.from().select().mockResolvedValue({ data: [], error: null });

      const response = await fetch('/api/admin/groups');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.groups).toHaveLength(0);
    });

    it('should return 500 on database error', async () => {
      mockSupabase.from().select().mockResolvedValue({ data: null, error: { message: 'DB Error' } });

      const response = await fetch('/api/admin/groups');

      expect(response.status).toBe(500);
    });

    it('should support pagination', async () => {
      const mockGroups = [
        { id: '1', chat_id: '123456', title: 'Test Group' }
      ];

      mockSupabase.from().select().mockImplementation(() => ({
        eq: () => ({
          range: () => Promise.resolve({ data: mockGroups, error: null })
        })
      }));

      const response = await fetch('/api/admin/groups?page=1&limit=10');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination).toBeDefined();
    });

    it('should filter by active status', async () => {
      mockSupabase.from().select().mockImplementation(() => ({
        eq: () => Promise.resolve({ data: [], error: null })
      }));

      const response = await fetch('/api/admin/groups?active=true');
      const data = await response.json();

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/admin/groups/:id', () => {
    it('should return group details', async () => {
      const mockGroup = {
        id: '123',
        chat_id: '123456',
        title: 'Test Group',
        config: { welcome_enabled: true }
      };

      mockSupabase.from().select().mockResolvedValue({ data: [mockGroup], error: null });

      const response = await fetch('/api/admin/groups/123');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.group).toBeDefined();
    });

    it('should return 404 for non-existent group', async () => {
      mockSupabase.from().select().mockResolvedValue({ data: [], error: null });

      const response = await fetch('/api/admin/groups/non-existent');

      expect(response.status).toBe(404);
    });

    it('should include group statistics', async () => {
      const mockGroup = {
        id: '123',
        chat_id: '123456',
        title: 'Test Group',
        member_count: 100
      };

      mockSupabase.from().select().mockResolvedValue({ data: [mockGroup], error: null });

      const response = await fetch('/api/admin/groups/123?include_stats=true');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toBeDefined();
    });
  });

  describe('POST /api/admin/groups', () => {
    it('should create a new group', async () => {
      const newGroup = {
        chat_id: '999888',
        title: 'New Group'
      };

      mockSupabase.from().insert().mockResolvedValue({ data: [newGroup], error: null });

      const response = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGroup)
      });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.group).toBeDefined();
    });

    it('should validate required fields', async () => {
      const invalidGroup = {
        title: 'Group without chat_id'
      };

      const response = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidGroup)
      });

      expect(response.status).toBe(400);
    });

    it('should reject duplicate chat_id', async () => {
      const duplicateGroup = {
        chat_id: '123456',
        title: 'Duplicate'
      };

      mockSupabase.from().insert().mockResolvedValue({
        data: null,
        error: { message: 'duplicate key value violates unique constraint' }
      });

      const response = await fetch('/api/admin/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(duplicateGroup)
      });

      expect(response.status).toBe(409);
    });
  });

  describe('PUT /api/admin/groups/:id', () => {
    it('should update group configuration', async () => {
      const updates = {
        title: 'Updated Title',
        config: { welcome_enabled: false }
      };

      mockSupabase.from().update().mockResolvedValue({ data: [updates], error: null });

      const response = await fetch('/api/admin/groups/123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.group.title).toBe('Updated Title');
    });

    it('should return 404 for non-existent group', async () => {
      mockSupabase.from().update().mockResolvedValue({ data: [], error: null });

      const response = await fetch('/api/admin/groups/non-existent', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test' })
      });

      expect(response.status).toBe(404);
    });
  });

  describe('DELETE /api/admin/groups/:id', () => {
    it('should soft delete group', async () => {
      mockSupabase.from().update().mockResolvedValue({ data: [{ is_active: false }], error: null });

      const response = await fetch('/api/admin/groups/123', {
        method: 'DELETE'
      });

      expect(response.status).toBe(200);
    });

    it('should permanently delete when force=true', async () => {
      mockSupabase.from().delete().mockResolvedValue({ data: null, error: null });

      const response = await fetch('/api/admin/groups/123?force=true', {
        method: 'DELETE'
      });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/admin/groups/:id/members', () => {
    it('should return group members', async () => {
      const mockMembers = [
        { id: '1', user_id: '987654', username: 'user1', role: 'member' },
        { id: '2', user_id: '654321', username: 'user2', role: 'admin' }
      ];

      mockSupabase.from().select().mockResolvedValue({ data: mockMembers, error: null });

      const response = await fetch('/api/admin/groups/123/members');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.members).toHaveLength(2);
    });

    it('should support pagination', async () => {
      mockSupabase.from().select().mockImplementation(() => ({
        eq: () => ({
          range: () => Promise.resolve({ data: [], error: null })
        })
      }));

      const response = await fetch('/api/admin/groups/123/members?page=2&limit=20');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination.currentPage).toBe(2);
    });

    it('should filter by role', async () => {
      mockSupabase.from().select().mockImplementation(() => ({
        eq: () => Promise.resolve({ data: [], error: null })
      }));

      const response = await fetch('/api/admin/groups/123/members?role=admin');
      const data = await response.json();

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/admin/groups/:id/config', () => {
    it('should return group configuration', async () => {
      const mockConfig = {
        welcome_enabled: true,
        verification_enabled: false,
        auto_delete: {
          enabled: true,
          delete_after: 300
        }
      };

      mockSupabase.from().select().mockResolvedValue({ data: [mockConfig], error: null });

      const response = await fetch('/api/admin/groups/123/config');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.config).toBeDefined();
    });
  });

  describe('PUT /api/admin/groups/:id/config', () => {
    it('should update group configuration', async () => {
      const configUpdates = {
        welcome_enabled: false,
        verification_type: 'captcha'
      };

      mockSupabase.from().update().mockResolvedValue({ data: [configUpdates], error: null });

      const response = await fetch('/api/admin/groups/123/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configUpdates)
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.config.welcome_enabled).toBe(false);
    });

    it('should validate configuration values', async () => {
      const invalidConfig = {
        delete_after: -100
      };

      const response = await fetch('/api/admin/groups/123/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidConfig)
      });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/admin/groups/:id/stats', () => {
    it('should return group statistics', async () => {
      const mockStats = {
        total_members: 150,
        active_members: 100,
        messages_today: 500,
        messages_week: 3000
      };

      mockRedis.hgetall.mockResolvedValue(mockStats);

      const response = await fetch('/api/admin/groups/123/stats');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.stats).toBeDefined();
    });

    it('should include trend data', async () => {
      const response = await fetch('/api/admin/groups/123/stats?include_trends=true');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.trends).toBeDefined();
    });
  });
});

describe('API Tests - Members', () => {
  let mockSupabase: any;
  let mockRedis: any;

  beforeEach(() => {
    mockSupabase = createMockSupabase();
    mockRedis = createMockRedis();
  });

  describe('GET /api/admin/members', () => {
    it('should return list of members', async () => {
      const mockMembers = [
        { id: '1', user_id: '987654', username: 'user1', points: 100 },
        { id: '2', user_id: '654321', username: 'user2', points: 200 }
      ];

      mockSupabase.from().select().mockResolvedValue({ data: mockMembers, error: null });

      const response = await fetch('/api/admin/members');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.members).toHaveLength(2);
    });

    it('should support pagination', async () => {
      mockSupabase.from().select().mockImplementation(() => ({
        range: () => Promise.resolve({ data: [], error: null })
      }));

      const response = await fetch('/api/admin/members?page=1&limit=50');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.pagination).toBeDefined();
    });

    it('should filter by group', async () => {
      mockSupabase.from().select().mockImplementation(() => ({
        eq: () => Promise.resolve({ data: [], error: null })
      }));

      const response = await fetch('/api/admin/members?group_id=123');
      const data = await response.json();

      expect(response.status).toBe(200);
    });

    it('should sort by points', async () => {
      mockSupabase.from().select().mockImplementation(() => ({
        order: () => Promise.resolve({ data: [], error: null })
      }));

      const response = await fetch('/api/admin/members?sort=points&order=desc');
      const data = await response.json();

      expect(response.status).toBe(200);
    });

    it('should search by username', async () => {
      mockSupabase.from().select().mockImplementation(() => ({
        ilike: () => Promise.resolve({ data: [], error: null })
      }));

      const response = await fetch('/api/admin/members?search=test');
      const data = await response.json();

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/admin/members/:id', () => {
    it('should return member details', async () => {
      const mockMember = {
        id: '123',
        user_id: '987654',
        username: 'testuser',
        points: 500,
        level: 5
      };

      mockSupabase.from().select().mockResolvedValue({ data: [mockMember], error: null });

      const response = await fetch('/api/admin/members/123');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.member).toBeDefined();
    });

    it('should include activity history', async () => {
      const response = await fetch('/api/admin/members/123?include_activity=true');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activity).toBeDefined();
    });

    it('should return 404 for non-existent member', async () => {
      mockSupabase.from().select().mockResolvedValue({ data: [], error: null });

      const response = await fetch('/api/admin/members/non-existent');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/admin/members/:id/points', () => {
    it('should update member points', async () => {
      mockSupabase.from().select().mockResolvedValue({
        data: [{ id: '123', points: 100 }],
        error: null
      });
      mockSupabase.from().update().mockResolvedValue({ data: [{ points: 150 }], error: null });

      const response = await fetch('/api/admin/members/123/points', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', amount: 50 })
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.newPoints).toBe(150);
    });

    it('should handle deduct action', async () => {
      mockSupabase.from().select().mockResolvedValue({
        data: [{ id: '123', points: 100 }],
        error: null
      });
      mockSupabase.from().update().mockResolvedValue({ data: [{ points: 80 }], error: null });

      const response = await fetch('/api/admin/members/123/points', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deduct', amount: 20 })
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.newPoints).toBe(80);
    });

    it('should not allow negative points', async () => {
      const response = await fetch('/api/admin/members/123/points', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set', amount: -50 })
      });

      expect(response.status).toBe(400);
    });

    it('should reject insufficient points for deduction', async () => {
      mockSupabase.from().select().mockResolvedValue({
        data: [{ id: '123', points: 10 }],
        error: null
      });

      const response = await fetch('/api/admin/members/123/points', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'deduct', amount: 20 })
      });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/admin/members/:id/role', () => {
    it('should update member role', async () => {
      mockSupabase.from().update().mockResolvedValue({ data: [{ role: 'admin' }], error: null });

      const response = await fetch('/api/admin/members/123/role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin' })
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.member.role).toBe('admin');
    });

    it('should validate role values', async () => {
      const response = await fetch('/api/admin/members/123/role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'invalid_role' })
      });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/admin/members/:id/ban', () => {
    it('should ban member', async () => {
      mockSupabase.from().update().mockResolvedValue({ data: [{ is_banned: true }], error: null });

      const response = await fetch('/api/admin/members/123/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Spam', duration: '7d' })
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should allow permanent ban', async () => {
      mockSupabase.from().update().mockResolvedValue({ data: [{ is_banned: true }], error: null });

      const response = await fetch('/api/admin/members/123/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Violations', permanent: true })
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.bannedUntil).toBeNull();
    });
  });

  describe('POST /api/admin/members/:id/unban', () => {
    it('should unban member', async () => {
      mockSupabase.from().update().mockResolvedValue({ data: [{ is_banned: false }], error: null });

      const response = await fetch('/api/admin/members/123/unban', {
        method: 'POST'
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('DELETE /api/admin/members/:id', () => {
    it('should remove member from group', async () => {
      mockSupabase.from().delete().mockResolvedValue({ data: null, error: null });

      const response = await fetch('/api/admin/members/123', {
        method: 'DELETE'
      });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/admin/members/:id/history', () => {
    it('should return member history', async () => {
      const mockHistory = [
        { action: 'join', timestamp: '2024-01-01T00:00:00Z' },
        { action: 'points_add', amount: 50, timestamp: '2024-01-02T00:00:00Z' }
      ];

      mockSupabase.from().select().mockResolvedValue({ data: mockHistory, error: null });

      const response = await fetch('/api/admin/members/123/history');
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.history).toHaveLength(2);
    });

    it('should support date filtering', async () => {
      mockSupabase.from().select().mockImplementation(() => ({
        gte: () => Promise.resolve({ data: [], error: null })
      }));

      const response = await fetch('/api/admin/members/123/history?from=2024-01-01&to=2024-01-31');
      const data = await response.json();

      expect(response.status).toBe(200);
    });
  });
});

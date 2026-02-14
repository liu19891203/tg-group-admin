import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { mount, shallowMount, VueWrapper } from '@vue/test-utils';
import { createTestingPinia } from '@pinia/testing';
import { createRouter, createWebHistory } from 'vue-router';

describe('Pinia Store Tests', () => {
  describe('Auth Store', () => {
    let authStore: any;

    beforeEach(() => {
      const pinia = createTestingPinia({
        createSpy: vi.fn
      });
      
      const wrapper = mount({ template: '<div></div>' }, {
        global: {
          plugins: [pinia]
        }
      });
      
      const { useAuthStore } = require('@/stores/auth');
      authStore = useAuthStore();
    });

    afterEach(() => {
      authStore = null;
    });

    it('should have initial state', () => {
      expect(authStore.token).toBeNull();
      expect(authStore.user).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
    });

    it('should login successfully', async () => {
      const mockResponse = {
        success: true,
        data: {
          token: 'mock_token_123',
          user: {
            id: '1',
            email: 'admin@example.com',
            name: 'Admin',
            role: 'admin'
          }
        }
      };

      vi.mock('@/api', () => ({
        login: vi.fn().mockResolvedValue(mockResponse)
      }));

      const { login } = require('@/api');
      
      await authStore.login({
        email: 'admin@example.com',
        password: 'password123'
      });

      expect(authStore.token).toBe('mock_token_123');
      expect(authStore.user.email).toBe('admin@example.com');
      expect(authStore.isAuthenticated).toBe(true);
    });

    it('should logout successfully', async () => {
      authStore.token = 'test_token';
      authStore.user = { id: '1' };
      
      await authStore.logout();

      expect(authStore.token).toBeNull();
      expect(authStore.user).toBeNull();
      expect(authStore.isAuthenticated).toBe(false);
    });

    it('should update user profile', async () => {
      const updates = {
        name: 'Updated Name',
        avatar: 'https://example.com/avatar.jpg'
      };

      await authStore.updateProfile(updates);

      expect(authStore.user.name).toBe('Updated Name');
      expect(authStore.user.avatar).toBe('https://example.com/avatar.jpg');
    });

    it('should check authentication status', () => {
      authStore.token = 'valid_token';
      
      expect(authStore.isAuthenticated).toBe(true);
    });

    it('should handle login failure', async () => {
      vi.mock('@/api', () => ({
        login: vi.fn().mockRejectedValue(new Error('Invalid credentials'))
      }));

      const { login } = require('@/api');

      await expect(
        authStore.login({
          email: 'wrong@example.com',
          password: 'wrongpassword'
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should set loading state during login', async () => {
      let resolveLogin: any;
      const loginPromise = new Promise((resolve) => {
        resolveLogin = resolve;
      });

      vi.mock('@/api', () => ({
        login: vi.fn().mockReturnValue(loginPromise)
      }));

      const { login } = require('@/api');

      const loginPromiseResult = authStore.login({
        email: 'test@example.com',
        password: 'password'
      });

      expect(authStore.loading).toBe(true);

      resolveLogin({ success: true, data: { token: 'token', user: {} } });

      await loginPromiseResult;

      expect(authStore.loading).toBe(false);
    });

    it('should handle session expiration', async () => {
      authStore.token = 'expired_token';
      authStore.user = { id: '1' };

      await authStore.handleSessionExpired();

      expect(authStore.token).toBeNull();
      expect(authStore.user).toBeNull();
    });

    it('should refresh token', async () => {
      vi.mock('@/api', () => ({
        refreshToken: vi.fn().mockResolvedValue({
          success: true,
          data: { token: 'new_token' }
        })
      }));

      const { refreshToken } = require('@/api');

      await authStore.refreshToken();

      expect(authStore.token).toBe('new_token');
    });
  });

  describe('Groups Store', () => {
    let groupsStore: any;

    beforeEach(() => {
      const pinia = createTestingPinia({
        createSpy: vi.fn
      });
      
      const wrapper = mount({ template: '<div></div>' }, {
        global: {
          plugins: [pinia]
        }
      });
      
      const { useGroupsStore } = require('@/stores/groups');
      groupsStore = useGroupsStore();
    });

    afterEach(() => {
      groupsStore = null;
    });

    it('should have initial state', () => {
      expect(groupsStore.groups).toEqual([]);
      expect(groupsStore.currentGroup).toBeNull();
      expect(groupsStore.loading).toBe(false);
    });

    it('should fetch groups', async () => {
      const mockGroups = [
        { id: '1', name: 'Group A', chatId: '12345' },
        { id: '2', name: 'Group B', chatId: '67890' }
      ];

      vi.mock('@/api', () => ({
        getGroups: vi.fn().mockResolvedValue({ data: mockGroups })
      }));

      const { getGroups } = require('@/api');

      await groupsStore.fetchGroups();

      expect(groupsStore.groups).toEqual(mockGroups);
    });

    it('should select group', () => {
      const group = { id: '1', name: 'Test Group' };
      
      groupsStore.selectGroup(group);

      expect(groupsStore.currentGroup).toEqual(group);
    });

    it('should add new group', async () => {
      const newGroup = { id: '3', name: 'New Group', chatId: '11111' };

      vi.mock('@/api', () => ({
        createGroup: vi.fn().mockResolvedValue({ data: newGroup })
      }));

      const { createGroup } = require('@/api');

      await groupsStore.addGroup(newGroup);

      expect(groupsStore.groups).toContain(newGroup);
    });

    it('should update group', async () => {
      const existingGroup = { id: '1', name: 'Original Name' };
      groupsStore.groups = [existingGroup];

      const updates = { name: 'Updated Name' };
      const updatedGroup = { ...existingGroup, ...updates };

      vi.mock('@/api', () => ({
        updateGroup: vi.fn().mockResolvedValue({ data: updatedGroup })
      }));

      const { updateGroup } = require('@/api');

      await groupsStore.updateGroup('1', updates);

      expect(groupsStore.groups[0].name).toBe('Updated Name');
    });

    it('should remove group', async () => {
      const groupToRemove = { id: '1', name: 'To Remove' };
      groupsStore.groups = [groupToRemove];

      vi.mock('@/api', () => ({
        deleteGroup: vi.fn().mockResolvedValue({ success: true })
      }));

      const { deleteGroup } = require('@/api');

      await groupsStore.removeGroup('1');

      expect(groupsStore.groups).not.toContain(groupToRemove);
    });

    it('should filter groups', async () => {
      const mockGroups = [
        { id: '1', name: 'Group A', active: true },
        { id: '2', name: 'Group B', active: false },
        { id: '3', name: 'Group C', active: true }
      ];
      groupsStore.groups = mockGroups;

      const activeGroups = groupsStore.getActiveGroups();

      expect(activeGroups.length).toBe(2);
      expect(activeGroups.every(g => g.active)).toBe(true);
    });

    it('should search groups', async () => {
      const mockGroups = [
        { id: '1', name: 'Telegram Group' },
        { id: '2', name: 'Test Group' },
        { id: '3', name: 'Another Telegram' }
      ];
      groupsStore.groups = mockGroups;

      const results = groupsStore.searchGroups('Telegram');

      expect(results.length).toBe(2);
      expect(results.every(g => g.name.includes('Telegram'))).toBe(true);
    });

    it('should handle fetch error', async () => {
      vi.mock('@/api', () => ({
        getGroups: vi.fn().mockRejectedValue(new Error('Network error'))
      }));

      const { getGroups } = require('@/api');

      await groupsStore.fetchGroups();

      expect(groupsStore.error).toBe('Network error');
    });
  });

  describe('Members Store', () => {
    let membersStore: any;

    beforeEach(() => {
      const pinia = createTestingPinia({
        createSpy: vi.fn
      });
      
      const wrapper = mount({ template: '<div></div>' }, {
        global: {
          plugins: [pinia]
        }
      });
      
      const { useMembersStore } = require('@/stores/members');
      membersStore = useMembersStore();
    });

    afterEach(() => {
      membersStore = null;
    });

    it('should have initial state', () => {
      expect(membersStore.members).toEqual([]);
      expect(membersStore.currentMember).toBeNull();
      expect(membersStore.loading).toBe(false);
    });

    it('should fetch members', async () => {
      const mockMembers = [
        { id: '1', username: 'user1', points: 100 },
        { id: '2', username: 'user2', points: 200 }
      ];

      vi.mock('@/api', () => ({
        getMembers: vi.fn().mockResolvedValue({ data: mockMembers })
      }));

      const { getMembers } = require('@/api');

      await membersStore.fetchMembers('group_1');

      expect(membersStore.members).toEqual(mockMembers);
    });

    it('should select member', () => {
      const member = { id: '1', username: 'testuser' };
      
      membersStore.selectMember(member);

      expect(membersStore.currentMember).toEqual(member);
    });

    it('should update member points', async () => {
      const member = { id: '1', username: 'user1', points: 100 };
      membersStore.members = [member];

      vi.mock('@/api', () => ({
        updateMemberPoints: vi.fn().mockResolvedValue({
          data: { ...member, points: 150 }
        })
      }));

      const { updateMemberPoints } = require('@/api');

      await membersStore.updatePoints('1', { action: 'add', amount: 50 });

      expect(membersStore.members[0].points).toBe(150);
    });

    it('should ban member', async () => {
      const member = { id: '1', username: 'user1', isBanned: false };
      membersStore.members = [member];

      vi.mock('@/api', () => ({
        banMember: vi.fn().mockResolvedValue({ success: true })
      }));

      const { banMember } = require('@/api');

      await membersStore.banMember('1');

      expect(membersStore.members[0].isBanned).toBe(true);
    });

    it('should unban member', async () => {
      const member = { id: '1', username: 'user1', isBanned: true };
      membersStore.members = [member];

      vi.mock('@/api', () => ({
        unbanMember: vi.fn().mockResolvedValue({ success: true })
      }));

      const { unbanMember } = require('@/api');

      await membersStore.unbanMember('1');

      expect(membersStore.members[0].isBanned).toBe(false);
    });

    it('should filter members by role', async () => {
      const mockMembers = [
        { id: '1', username: 'user1', role: 'admin' },
        { id: '2', username: 'user2', role: 'member' },
        { id: '3', username: 'user3', role: 'admin' }
      ];
      membersStore.members = mockMembers;

      const admins = membersStore.getMembersByRole('admin');

      expect(admins.length).toBe(2);
      expect(admins.every(m => m.role === 'admin')).toBe(true);
    });

    it('should sort members by points', async () => {
      const mockMembers = [
        { id: '1', username: 'user1', points: 100 },
        { id: '2', username: 'user2', points: 300 },
        { id: '3', username: 'user3', points: 200 }
      ];
      membersStore.members = mockMembers;

      const sorted = membersStore.getMembersByPoints();

      expect(sorted[0].points).toBe(300);
      expect(sorted[1].points).toBe(200);
      expect(sorted[2].points).toBe(100);
    });

    it('should search members', async () => {
      const mockMembers = [
        { id: '1', username: 'telegramuser' },
        { id: '2', username: 'testuser' },
        { id: '3', username: 'anotheruser' }
      ];
      membersStore.members = mockMembers;

      const results = membersStore.searchMembers('telegram');

      expect(results.length).toBe(1);
      expect(results[0].username).toBe('telegramuser');
    });
  });

  describe('Points Store', () => {
    let pointsStore: any;

    beforeEach(() => {
      const pinia = createTestingPinia({
        createSpy: vi.fn
      });
      
      const wrapper = mount({ template: '<div></div>' }, {
        global: {
          plugins: [pinia]
        }
      });
      
      const { usePointsStore } = require('@/stores/points');
      pointsStore = usePointsStore();
    });

    afterEach(() => {
      pointsStore = null;
    });

    it('should have initial state', () => {
      expect(pointsStore.transactions).toEqual([]);
      expect(pointsStore.leaderboard).toEqual([]);
      expect(pointsStore.userPoints).toBe(0);
    });

    it('should fetch user points', async () => {
      vi.mock('@/api', () => ({
        getUserPoints: vi.fn().mockResolvedValue({
          data: { totalPoints: 500, level: 5, rank: 10 }
        })
      }));

      const { getUserPoints } = require('@/api');

      await pointsStore.fetchUserPoints('group_1', 'user_1');

      expect(pointsStore.userPoints).toBe(500);
      expect(pointsStore.userLevel).toBe(5);
      expect(pointsStore.userRank).toBe(10);
    });

    it('should add points', async () => {
      const mockTransaction = {
        id: '1',
        action: 'add',
        amount: 100,
        reason: 'Test'
      };

      vi.mock('@/api', () => ({
        addPoints: vi.fn().mockResolvedValue({
          data: { ...mockTransaction, newTotal: 600 }
        })
      }));

      const { addPoints } = require('@/api');

      await pointsStore.addPoints({
        userId: 'user_1',
        amount: 100,
        reason: 'Test'
      });

      expect(pointsStore.transactions).toContainEqual(expect.objectContaining({
        action: 'add',
        amount: 100
      }));
    });

    it('should deduct points', async () => {
      pointsStore.userPoints = 500;

      vi.mock('@/api', () => ({
        deductPoints: vi.fn().mockResolvedValue({
          data: { newTotal: 400 }
        })
      }));

      const { deductPoints } = require('@/api');

      await pointsStore.deductPoints({
        userId: 'user_1',
        amount: 100
      });

      expect(pointsStore.userPoints).toBe(400);
    });

    it('should fetch leaderboard', async () => {
      const mockLeaderboard = [
        { rank: 1, username: 'user1', points: 1000 },
        { rank: 2, username: 'user2', points: 800 },
        { rank: 3, username: 'user3', points: 600 }
      ];

      vi.mock('@/api', () => ({
        getLeaderboard: vi.fn().mockResolvedValue({ data: mockLeaderboard })
      }));

      const { getLeaderboard } = require('@/api');

      await pointsStore.fetchLeaderboard('group_1');

      expect(pointsStore.leaderboard).toEqual(mockLeaderboard);
    });

    it('should handle insufficient points', async () => {
      pointsStore.userPoints = 50;

      await expect(
        pointsStore.deductPoints({
          userId: 'user_1',
          amount: 100
        })
      ).rejects.toThrow('Insufficient points');
    });

    it('should calculate level based on points', () => {
      pointsStore.userPoints = 950;
      pointsStore.calculateLevel();

      expect(pointsStore.userLevel).toBe(2);
    });

    it('should transfer points between users', async () => {
      vi.mock('@/api', () => ({
        transferPoints: vi.fn().mockResolvedValue({ success: true })
      }));

      const { transferPoints } = require('@/api');

      await pointsStore.transferPoints({
        fromUserId: 'user_1',
        toUserId: 'user_2',
        amount: 100
      });

      expect(transferPoints).toHaveBeenCalledWith({
        fromUserId: 'user_1',
        toUserId: 'user_2',
        amount: 100
      });
    });
  });

  describe('Notifications Store', () => {
    let notificationsStore: any;

    beforeEach(() => {
      const pinia = createTestingPinia({
        createSpy: vi.fn
      });
      
      const wrapper = mount({ template: '<div></div>' }, {
        global: {
          plugins: [pinia]
        }
      });
      
      const { useNotificationsStore } = require('@/stores/notifications');
      notificationsStore = useNotificationsStore();
    });

    afterEach(() => {
      notificationsStore = null;
    });

    it('should have initial state', () => {
      expect(notificationsStore.notifications).toEqual([]);
      expect(notificationsStore.unreadCount).toBe(0);
    });

    it('should add notification', () => {
      const notification = {
        id: '1',
        type: 'success',
        message: 'Operation successful',
        duration: 3000
      };

      notificationsStore.addNotification(notification);

      expect(notificationsStore.notifications).toContainEqual(expect.objectContaining({
        message: 'Operation successful'
      }));
    });

    it('should remove notification', () => {
      const notification = { id: '1', message: 'Test' };
      notificationsStore.notifications = [notification];

      notificationsStore.removeNotification('1');

      expect(notificationsStore.notifications).not.toContain(notification);
    });

    it('should mark notification as read', () => {
      const notification = { id: '1', message: 'Test', read: false };
      notificationsStore.notifications = [notification];
      notificationsStore.unreadCount = 1;

      notificationsStore.markAsRead('1');

      expect(notificationsStore.notifications[0].read).toBe(true);
      expect(notificationsStore.unreadCount).toBe(0);
    });

    it('should mark all as read', () => {
      notificationsStore.notifications = [
        { id: '1', message: 'Test 1', read: false },
        { id: '2', message: 'Test 2', read: false }
      ];
      notificationsStore.unreadCount = 2;

      notificationsStore.markAllAsRead();

      expect(notificationsStore.notifications.every(n => n.read)).toBe(true);
      expect(notificationsStore.unreadCount).toBe(0);
    });

    it('should clear all notifications', () => {
      notificationsStore.notifications = [
        { id: '1', message: 'Test' },
        { id: '2', message: 'Test 2' }
      ];
      notificationsStore.unreadCount = 2;

      notificationsStore.clearAll();

      expect(notificationsStore.notifications).toEqual([]);
      expect(notificationsStore.unreadCount).toBe(0);
    });
  });
});

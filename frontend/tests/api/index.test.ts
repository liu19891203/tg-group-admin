import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

const mockAxios = axios.create({
  baseURL: 'http://localhost:3000/api',
  timeout: 10000
});

describe('API Service Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Groups API', () => {
    it('should fetch groups list', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            { id: '1', name: 'Group A', chatId: '12345', memberCount: 100 },
            { id: '2', name: 'Group B', chatId: '67890', memberCount: 200 }
          ],
          pagination: { page: 1, limit: 10, total: 2 }
        }
      };

      vi.spyOn(axios, 'get').mockResolvedValue(mockResponse);

      const response = await mockAxios.get('/admin/groups');

      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveLength(2);
    });

    it('should create new group', async () => {
      const newGroup = {
        name: 'New Group',
        chatId: '11111',
        description: 'Test group'
      };

      const mockResponse = {
        data: {
          success: true,
          data: { id: '3', ...newGroup }
        }
      };

      vi.spyOn(axios, 'post').mockResolvedValue(mockResponse);

      const response = await mockAxios.post('/admin/groups', newGroup);

      expect(response.data.success).toBe(true);
      expect(response.data.data.name).toBe('New Group');
    });

    it('should update group', async () => {
      const updates = {
        name: 'Updated Group Name',
        description: 'Updated description'
      };

      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', ...updates }
        }
      };

      vi.spyOn(axios, 'put').mockResolvedValue(mockResponse);

      const response = await mockAxios.put('/admin/groups/1', updates);

      expect(response.data.success).toBe(true);
      expect(response.data.data.name).toBe('Updated Group Name');
    });

    it('should delete group', async () => {
      const mockResponse = {
        data: { success: true }
      };

      vi.spyOn(axios, 'delete').mockResolvedValue(mockResponse);

      const response = await mockAxios.delete('/admin/groups/1');

      expect(response.data.success).toBe(true);
    });

    it('should fetch group details', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: '1',
            name: 'Test Group',
            config: { welcome_enabled: true }
          }
        }
      };

      vi.spyOn(axios, 'get').mockResolvedValue(mockResponse);

      const response = await mockAxios.get('/admin/groups/1');

      expect(response.data.success).toBe(true);
      expect(response.data.data.config.welcome_enabled).toBe(true);
    });

    it('should handle API errors', async () => {
      vi.spyOn(axios, 'get').mockRejectedValue(new Error('Network Error'));

      await expect(mockAxios.get('/admin/groups')).rejects.toThrow('Network Error');
    });
  });

  describe('Members API', () => {
    it('should fetch members list', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            { id: '1', username: 'user1', points: 100 },
            { id: '2', username: 'user2', points: 200 }
          ],
          pagination: { page: 1, limit: 20, total: 2 }
        }
      };

      vi.spyOn(axios, 'get').mockResolvedValue(mockResponse);

      const response = await mockAxios.get('/admin/members', {
        params: { groupId: 'group_1' }
      });

      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveLength(2);
    });

    it('should update member points', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', points: 150 }
        }
      };

      vi.spyOn(axios, 'put').mockResolvedValue(mockResponse);

      const response = await mockAxios.put('/admin/members/1/points', {
        action: 'add',
        amount: 50
      });

      expect(response.data.success).toBe(true);
      expect(response.data.data.points).toBe(150);
    });

    it('should ban member', async () => {
      const mockResponse = {
        data: { success: true }
      };

      vi.spyOn(axios, 'post').mockResolvedValue(mockResponse);

      const response = await mockAxios.post('/admin/members/1/ban', {
        reason: 'Spam behavior',
        duration: '7d'
      });

      expect(response.data.success).toBe(true);
    });

    it('should unban member', async () => {
      const mockResponse = {
        data: { success: true }
      };

      vi.spyOn(axios, 'post').mockResolvedValue(mockResponse);

      const response = await mockAxios.post('/admin/members/1/unban');

      expect(response.data.success).toBe(true);
    });
  });

  describe('Auth API', () => {
    it('should login successfully', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            token: 'mock_jwt_token',
            user: {
              id: '1',
              email: 'admin@example.com',
              name: 'Admin'
            }
          }
        }
      };

      vi.spyOn(axios, 'post').mockResolvedValue(mockResponse);

      const response = await mockAxios.post('/admin/login', {
        email: 'admin@example.com',
        password: 'password123'
      });

      expect(response.data.success).toBe(true);
      expect(response.data.data.token).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const mockResponse = {
        data: { success: false, error: 'Invalid credentials' },
        status: 401
      };

      vi.spyOn(axios, 'post').mockResolvedValue(mockResponse);

      await expect(
        mockAxios.post('/admin/login', {
          email: 'wrong@example.com',
          password: 'wrongpassword'
        })
      ).rejects.toThrow();
    });

    it('should logout', async () => {
      const mockResponse = {
        data: { success: true }
      };

      vi.spyOn(axios, 'post').mockResolvedValue(mockResponse);

      const response = await mockAxios.post('/admin/logout');

      expect(response.data.success).toBe(true);
    });

    it('should refresh token', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { token: 'new_refreshed_token' }
        }
      };

      vi.spyOn(axios, 'post').mockResolvedValue(mockResponse);

      const response = await mockAxios.post('/admin/refresh', {
        refresh_token: 'valid_refresh_token'
      });

      expect(response.data.success).toBe(true);
      expect(response.data.data.token).toBe('new_refreshed_token');
    });
  });

  describe('Stats API', () => {
    it('should fetch overview stats', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            totalGroups: 5,
            totalMembers: 10000,
            activeUsers: 7500,
            messagesToday: 2500
          }
        }
      };

      vi.spyOn(axios, 'get').mockResolvedValue(mockResponse);

      const response = await mockAxios.get('/admin/stats/overview');

      expect(response.data.success).toBe(true);
      expect(response.data.data.totalGroups).toBe(5);
    });

    it('should fetch message stats', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            today: 2500,
            week: 17500,
            month: 75000
          }
        }
      };

      vi.spyOn(axios, 'get').mockResolvedValue(mockResponse);

      const response = await mockAxios.get('/admin/stats/messages');

      expect(response.data.success).toBe(true);
    });

    it('should fetch points stats', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            totalInCirculation: 1000000,
            averagePerUser: 100,
            transactionsToday: 500
          }
        }
      };

      vi.spyOn(axios, 'get').mockResolvedValue(mockResponse);

      const response = await mockAxios.get('/admin/stats/points');

      expect(response.data.success).toBe(true);
    });

    it('should export stats', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            exportDate: '2024-01-15T10:00:00Z',
            statistics: {}
          }
        }
      };

      vi.spyOn(axios, 'get').mockResolvedValue(mockResponse);

      const response = await mockAxios.get('/admin/stats/export', {
        params: { format: 'json' }
      });

      expect(response.data.success).toBe(true);
      expect(response.data.data.exportDate).toBeDefined();
    });
  });

  describe('Lottery API', () => {
    it('should fetch lotteries', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            { id: '1', name: 'Daily Lottery', status: 'active', prize: '100 points' },
            { id: '2', name: 'Weekly Lottery', status: 'pending', prize: '500 points' }
          ]
        }
      };

      vi.spyOn(axios, 'get').mockResolvedValue(mockResponse);

      const response = await mockAxios.get('/admin/lottery');

      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveLength(2);
    });

    it('should create lottery', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: '3',
            name: 'New Lottery',
            prize: '200 points',
            status: 'pending'
          }
        }
      };

      vi.spyOn(axios, 'post').mockResolvedValue(mockResponse);

      const response = await mockAxios.post('/admin/lottery', {
        name: 'New Lottery',
        prize: '200 points',
        ticketPrice: 10,
        maxParticipants: 100
      });

      expect(response.data.success).toBe(true);
      expect(response.data.data.name).toBe('New Lottery');
    });

    it('should draw lottery winner', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            winner: { userId: 'user1', username: 'WinnerUser' },
            prize: '100 points'
          }
        }
      };

      vi.spyOn(axios, 'post').mockResolvedValue(mockResponse);

      const response = await mockAxios.post('/admin/lottery/1/draw');

      expect(response.data.success).toBe(true);
      expect(response.data.data.winner).toBeDefined();
    });

    it('should cancel lottery', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            status: 'cancelled',
            refundedCount: 5
          }
        }
      };

      vi.spyOn(axios, 'post').mockResolvedValue(mockResponse);

      const response = await mockAxios.post('/admin/lottery/1/cancel');

      expect(response.data.success).toBe(true);
      expect(response.data.data.status).toBe('cancelled');
    });
  });

  describe('Auto Replies API', () => {
    it('should fetch auto replies', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            { id: '1', keyword: 'hello', reply: 'Hi there!', isEnabled: true },
            { id: '2', keyword: 'help', reply: 'How can I help?', isEnabled: true }
          ]
        }
      };

      vi.spyOn(axios, 'get').mockResolvedValue(mockResponse);

      const response = await mockAxios.get('/admin/auto-replies');

      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveLength(2);
    });

    it('should create auto reply rule', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: '3',
            keyword: 'test',
            reply: 'Test reply',
            isEnabled: true
          }
        }
      };

      vi.spyOn(axios, 'post').mockResolvedValue(mockResponse);

      const response = await mockAxios.post('/admin/auto-replies', {
        keyword: 'test',
        reply: 'Test reply'
      });

      expect(response.data.success).toBe(true);
    });

    it('should update auto reply', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', reply: 'Updated reply' }
        }
      };

      vi.spyOn(axios, 'put').mockResolvedValue(mockResponse);

      const response = await mockAxios.put('/admin/auto-replies/1', {
        reply: 'Updated reply'
      });

      expect(response.data.success).toBe(true);
    });

    it('should delete auto reply', async () => {
      const mockResponse = {
        data: { success: true }
      };

      vi.spyOn(axios, 'delete').mockResolvedValue(mockResponse);

      const response = await mockAxios.delete('/admin/auto-replies/1');

      expect(response.data.success).toBe(true);
    });
  });

  describe('Scheduled Messages API', () => {
    it('should fetch scheduled messages', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            { id: '1', content: 'Daily reminder', scheduledAt: '2024-01-16T09:00:00Z' },
            { id: '2', content: 'Weekly update', scheduledAt: '2024-01-20T10:00:00Z' }
          ]
        }
      };

      vi.spyOn(axios, 'get').mockResolvedValue(mockResponse);

      const response = await mockAxios.get('/admin/scheduled-messages');

      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveLength(2);
    });

    it('should create scheduled message', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            id: '3',
            content: 'New scheduled message',
            scheduledAt: '2024-01-17T08:00:00Z',
            status: 'scheduled'
          }
        }
      };

      vi.spyOn(axios, 'post').mockResolvedValue(mockResponse);

      const response = await mockAxios.post('/admin/scheduled-messages', {
        content: 'New scheduled message',
        scheduledAt: '2024-01-17T08:00:00Z',
        chatId: '12345'
      });

      expect(response.data.success).toBe(true);
    });

    it('should cancel scheduled message', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', status: 'cancelled' }
        }
      };

      vi.spyOn(axios, 'post').mockResolvedValue(mockResponse);

      const response = await mockAxios.post('/admin/scheduled-messages/1/cancel');

      expect(response.data.success).toBe(true);
      expect(response.data.data.status).toBe('cancelled');
    });

    it('should send scheduled message immediately', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: { id: '1', status: 'sent', sentAt: '2024-01-15T10:00:00Z' }
        }
      };

      vi.spyOn(axios, 'post').mockResolvedValue(mockResponse);

      const response = await mockAxios.post('/admin/scheduled-messages/1/send-now');

      expect(response.data.success).toBe(true);
    });
  });

  describe('Crypto API', () => {
    it('should fetch crypto prices', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            bitcoin: { usd: 50000, change24h: 2.5 },
            ethereum: { usd: 3000, change24h: -1.2 }
          }
        }
      };

      vi.spyOn(axios, 'get').mockResolvedValue(mockResponse);

      const response = await mockAxios.get('/crypto/price', {
        params: { coins: 'bitcoin,ethereum' }
      });

      expect(response.data.success).toBe(true);
      expect(response.data.data.bitcoin.usd).toBe(50000);
    });

    it('should fetch address balance', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            chain: 'bitcoin',
            address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
            balance: 1.5,
            unit: 'BTC'
          }
        }
      };

      vi.spyOn(axios, 'get').mockResolvedValue(mockResponse);

      const response = await mockAxios.get('/crypto/balance/bitcoin/1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa');

      expect(response.data.success).toBe(true);
      expect(response.data.data.balance).toBe(1.5);
    });

    it('should track address', async () => {
      const mockResponse = {
        data: { success: true }
      };

      vi.spyOn(axios, 'post').mockResolvedValue(mockResponse);

      const response = await mockAxios.post('/crypto/track', {
        chatId: '12345',
        chain: 'bitcoin',
        address: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
        label: 'My Wallet'
      });

      expect(response.data.success).toBe(true);
    });

    it('should get tracked addresses', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            { id: '1', chain: 'bitcoin', address: 'abc123', label: 'Wallet 1' },
            { id: '2', chain: 'ethereum', address: 'def456', label: 'Wallet 2' }
          ]
        }
      };

      vi.spyOn(axios, 'get').mockResolvedValue(mockResponse);

      const response = await mockAxios.get('/crypto/tracked/12345');

      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveLength(2);
    });
  });

  describe('Request Interceptors', () => {
    it('should add auth token to requests', async () => {
      const mockInterceptor = vi.fn().mockImplementation(config => ({
        ...config,
        headers: { ...config.headers, Authorization: 'Bearer test_token' }
      }));

      mockAxios.interceptors.request.use(mockInterceptor);

      await mockAxios.get('/admin/groups');

      expect(mockInterceptor).toHaveBeenCalled();
    });

    it('should handle response errors', async () => {
      const errorHandler = vi.fn();

      mockAxios.interceptors.response.use(
        response => response,
        error => {
          errorHandler(error);
          return Promise.reject(error);
        }
      );

      vi.spyOn(axios, 'get').mockRejectedValue(new Error('401 Unauthorized'));

      await expect(mockAxios.get('/admin/protected')).rejects.toThrow();

      expect(errorHandler).toHaveBeenCalled();
    });
  });
});

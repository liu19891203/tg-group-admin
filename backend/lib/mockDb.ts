// Mock database for development without Supabase

interface MockAdmin {
  id: string;
  telegram_id: number;
  username?: string;
  display_name?: string;
  level: number;
  permissions: string[];
  is_active: boolean;
}

interface MockGroup {
  id: string;
  chat_id: number;
  title: string;
  username?: string;
  is_active: boolean;
}

interface MockUser {
  id: string;
  telegram_id: number;
  username?: string;
  display_name?: string;
  first_name: string;
  last_name?: string;
  is_bot: boolean;
  is_verified: boolean;
}

interface MockMembership {
  id: string;
  user_id: string;
  group_id: string;
  points: number;
  total_points: number;
  checkin_streak: number;
  last_activity_at?: string;
}

// Mock data
export const mockDb = {
  admins: [
    {
      id: '1',
      telegram_id: 123456789,
      username: 'admin_user',
      display_name: '管理员',
      level: 10,
      permissions: ['*'],
      is_active: true
    }
  ] as MockAdmin[],

  groups: [
    {
      id: 'group1',
      chat_id: -1001234567890,
      title: '测试群组',
      username: 'test_group',
      is_active: true
    }
  ] as MockGroup[],

  users: [
    {
      id: 'user1',
      telegram_id: 123456789,
      username: 'test_user',
      display_name: '测试用户',
      first_name: 'Test',
      last_name: 'User',
      is_bot: false,
      is_verified: true
    },
    {
      id: 'user2',
      telegram_id: 987654321,
      username: 'another_user',
      display_name: '另一个用户',
      first_name: 'Another',
      last_name: 'User',
      is_bot: false,
      is_verified: false
    }
  ] as MockUser[],

  memberships: [
    {
      id: 'membership1',
      user_id: 'user1',
      group_id: 'group1',
      points: 150,
      total_points: 500,
      checkin_streak: 7,
      last_activity_at: new Date().toISOString()
    },
    {
      id: 'membership2',
      user_id: 'user2',
      group_id: 'group1',
      points: 80,
      total_points: 200,
      checkin_streak: 3,
      last_activity_at: new Date().toISOString()
    }
  ] as MockMembership[],

  // Mock methods
  findAdminById: (id: string): MockAdmin | undefined => {
    return mockDb.admins.find(admin => admin.id === id);
  },

  findAdminByTelegramId: (telegramId: number): MockAdmin | undefined => {
    return mockDb.admins.find(admin => admin.telegram_id === telegramId);
  },

  findGroupById: (id: string): MockGroup | undefined => {
    return mockDb.groups.find(group => group.id === id);
  },

  findGroupByChatId: (chatId: number): MockGroup | undefined => {
    return mockDb.groups.find(group => group.chat_id === chatId);
  },

  findUserById: (id: string): MockUser | undefined => {
    return mockDb.users.find(user => user.id === id);
  },

  findUserByTelegramId: (telegramId: number): MockUser | undefined => {
    return mockDb.users.find(user => user.telegram_id === telegramId);
  },

  getMembershipsByGroup: (groupId: string): MockMembership[] => {
    return mockDb.memberships.filter(membership => membership.group_id === groupId);
  },

  getMembershipByUserAndGroup: (userId: string, groupId: string): MockMembership | undefined => {
    return mockDb.memberships.find(membership => 
      membership.user_id === userId && membership.group_id === groupId
    );
  },

  // Mock data for permissions API
  getPermissionMatrix: () => {
    return {
      roles: [
        {
          id: 'super_admin',
          role_name: 'super_admin',
          role_display_name: '最高管理员',
          description: '拥有所有权限，可以管理其他管理员'
        },
        {
          id: 'admin',
          role_name: 'admin',
          role_display_name: '管理员',
          description: '拥有大部分管理权限'
        },
        {
          id: 'moderator',
          role_name: 'moderator',
          role_display_name: '版主',
          description: '拥有基础管理权限'
        },
        {
          id: 'member',
          role_name: 'member',
          role_display_name: '成员',
          description: '普通成员权限'
        }
      ],
      modules: [
        {
          id: 'dashboard',
          module_name: '仪表板',
          description: '查看群组统计信息',
          category: 'basic',
          icon: 'DataBoard'
        },
        {
          id: 'groups',
          module_name: '群组管理',
          description: '管理群组设置',
          category: 'basic',
          icon: 'ChatDotSquare'
        },
        {
          id: 'members',
          module_name: '成员管理',
          description: '查看和管理群组成员',
          category: 'basic',
          icon: 'User'
        }
      ]
    };
  },

  // 菜单权限相关方法
  menuPermissions: [] as any[],

  getMenuPermissions: (groupId: string): any[] => {
    return mockDb.menuPermissions.filter(p => p.group_id === groupId);
  },

  addMenuPermission: (permission: any): void => {
    mockDb.menuPermissions.push(permission);
  },

  updateMenuPermission: (permission: any): void => {
    const index = mockDb.menuPermissions.findIndex(p => p.id === permission.id);
    if (index !== -1) {
      mockDb.menuPermissions[index] = { ...mockDb.menuPermissions[index], ...permission };
    }
  },

  removeMenuPermission: (id: number): void => {
    mockDb.menuPermissions = mockDb.menuPermissions.filter(p => p.id !== id);
  },

  // 用户搜索方法
  searchUsers: (groupId: string, keyword: string, limit: number): any[] => {
    return mockDb.users
      .filter(u => 
        u.first_name.includes(keyword) || 
        u.last_name?.includes(keyword) || 
        u.username?.includes(keyword)
      )
      .slice(0, limit)
      .map(u => ({
        id: u.id,
        telegram_id: u.telegram_id,
        first_name: u.first_name,
        last_name: u.last_name,
        username: u.username,
        avatar_url: '',
        is_owner: false,
        is_admin: false
      }));
  },

  validateAdmin: (username: string, password: string): MockAdmin | null => {
    const admin = mockDb.admins.find(a => a.username === username);
    if (admin && password === 'admin123') {
      return admin;
    }
    return null;
  },

  updateAdminLastLogin: (adminId: string): void => {
    const admin = mockDb.admins.find(a => a.id === adminId);
    if (admin) {
      (admin as any).last_login_at = new Date().toISOString();
    }
  }
};
# Telegram群管机器人 - 前端代码整合文档

## 1. 项目架构概览

### 1.1 技术栈
- **前端框架**: Vue 3 + TypeScript
- **UI组件库**: Element Plus
- **状态管理**: Pinia
- **路由**: Vue Router 4
- **构建工具**: Vite
- **样式**: SCSS

### 1.2 目录结构
```
frontend/src/
├── api/                    # API接口封装
├── components/             # 公共组件
│   ├── Layout/            # 布局组件
│   ├── GroupSelector/     # 群组选择器
│   ├── MessageEditor/     # 消息编辑器
│   └── InlineKeyboardEditor/  # 内联键盘编辑器
├── views/                  # 页面视图
│   ├── Dashboard/         # 数据看板
│   ├── MenuPermissions/   # 菜单权限管理（新）
│   ├── Crypto/            # 加密货币（重构）
│   ├── InviteStats/       # 邀请统计（分页优化）
│   ├── ChatStats/         # 群聊统计
│   ├── Security/          # 安全防护功能
│   ├── Groups/            # 群组管理
│   ├── Settings/          # 系统设置
│   └── ...
├── stores/                 # Pinia状态管理
│   ├── auth.ts            # 认证状态
│   └── groups.ts          # 群组状态
├── router/                 # 路由配置
└── utils/                  # 工具函数
```

## 2. 核心功能模块整合

### 2.1 权限管理系统

#### 2.1.1 功能级别划分
```typescript
// 权限级别定义
const PermissionLevels = {
  basic: '初级功能',        // 安全防护类
  intermediate: '中级功能', // 用户互动类
  advanced: '高级功能'      // 群组管理类
}

// 各级别包含的功能菜单
const LevelMenus = {
  basic: [
    'verification',    // 入群验证
    'anti_ads',        // 广告过滤
    'anti_spam',       // 刷屏处理
    'auto_delete',     // 自动删除
    'porn_detection',  // 色情检测
    'auto_ban'         // 自动封禁
  ],
  intermediate: [
    'auto_reply',      // 自动回复
    'points',          // 积分系统
    'lottery',         // 抽奖活动
    'send_message',    // 主动消息
    'scheduled_messages'  // 定时消息
  ],
  advanced: [
    'group_members',   // 群组成员
    'channel_settings',// 频道关联
    'commands',        // 命令管理
    'verified_users',  // 认证用户
    'invite_stats',    // 邀请统计
    'chat_stats',      // 群聊统计
    'crypto',          // 加密货币
    'super_tools'      // 超级工具
  ]
}
```

#### 2.1.2 权限管理页面逻辑
**文件**: `views/MenuPermissions/index.vue`

```typescript
// 核心数据结构
interface UserPermission {
  id: number
  first_name: string
  last_name?: string
  username?: string
  avatar_url?: string
  is_owner: boolean
  is_admin: boolean
  permissions: string[]  // ['basic', 'intermediate', 'advanced']
}

// 主要功能
const userPermissions = ref<UserPermission[]>([])

// 保存用户权限（自动触发）
const saveUserPermissions = async (user: UserPermission) => {
  // 调用API保存权限配置
  // 实时更新，无需手动点击保存
}

// 添加权限用户
const addUser = async () => {
  // 1. 搜索用户
  // 2. 选择功能级别
  // 3. 添加到权限列表
}

// 移除权限用户
const removeUser = (user: UserPermission) => {
  // 确认后从列表移除
}
```

#### 2.1.3 管理员权限页面
**文件**: `views/Settings/Permissions.vue`

```typescript
// 管理员数据结构
interface Admin {
  id: number
  first_name: string
  last_name?: string
  username?: string
  avatar_url?: string
  is_owner: boolean
  level: number  // 1=管理员, 10=超级管理员
  created_at: string
}

// 功能
- 添加管理员（设置权限级别）
- 编辑管理员权限
- 移除管理员（不能移除群主）
```

### 2.2 加密货币功能

#### 2.2.1 功能架构
**文件**: `views/Crypto/index.vue`

```typescript
// 地址查询配置
interface AddressConfig {
  enabled: boolean
  supportedChains: string[]  // ['ERC20', 'TRC20', 'BEP20', ...]
  replyTemplate: string      // 消息模板
  showBalance: boolean
  showTransactions: boolean
  transactionsPerPage: number  // 默认10条
}

// 汇率查询配置
interface ExchangeRateConfig {
  enabled: boolean
  keyword: string  // 默认"汇率"
  exchanges: string[]  // ['binance', 'okx', 'huobi']
  showBuyPrice: boolean
  showSellPrice: boolean
  showChange24h: boolean
  autoRefresh: boolean
  refreshInterval: number  // 分钟
}

// 区块链地址识别规则
const ChainPatterns = {
  ERC20: /^0x[a-fA-F0-9]{40}$/,           // 以太坊
  TRC20: /^T[a-zA-Z0-9]{33}$/,            // 波场
  BEP20: /^0x[a-fA-F0-9]{40}$/,           // BSC
  BEP2: /^bnb[a-zA-Z0-9]{39}$/,           // 币安链
  SOL: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,   // Solana
  BTC: /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/    // 比特币
}
```

#### 2.2.2 消息模板变量
```typescript
// 地址查询回复模板可用变量
const AddressTemplateVars = {
  '{address}': '区块链地址',
  '{chain}': '区块链网络',
  '{balance}': 'USDT余额',
  '{usd_value}': '美元价值',
  '{transaction_count}': '交易笔数',
  '{current_page}': '当前页码',
  '{total_pages}': '总页数'
}

// 汇率查询回复模板可用变量
const RateTemplateVars = {
  '{exchange}': '交易所名称',
  '{buy_price}': '买入价',
  '{sell_price}': '卖出价',
  '{change_24h}': '24小时涨跌',
  '{update_time}': '更新时间（东八区）'
}
```

### 2.3 邀请统计功能

#### 2.3.1 分页实现
**文件**: `views/InviteStats/index.vue`

```typescript
// 分页配置
const pagination = {
  currentPage: 1,
  pageSize: 10,  // 每页10条
  total: 0
}

// 排行榜数据（分页后）
const paginatedLeaderboard = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return leaderboard.value.slice(start, end)
})

// 排名计算（考虑分页）
const getRankNumber = (index: number) => {
  // 前三名特殊显示
  if (currentPage.value === 1 && index < 3) {
    return null  // 使用奖牌图标
  }
  // 其他按页码计算
  return (currentPage.value - 1) * pageSize.value + index + 1
}
```

#### 2.3.2 统计数据结构
```typescript
interface InviteStats {
  total_inviters: number      // 邀请人数
  total_invites: number       // 总邀请次数
  valid_invites: number       // 有效邀请
  pending_invites: number     // 待验证
  total_rewards: number       // 总奖励积分
}

interface Inviter {
  user_id: number
  first_name: string
  last_name?: string
  username?: string
  invite_count: number
  valid_count: number
  reward_points: number
  last_invite_at: string
}
```

## 3. 组件整合

### 3.1 布局组件
**文件**: `components/Layout/Layout.vue`

```typescript
// 菜单结构
const menuStructure = [
  { path: '/', title: '数据看板', icon: 'HomeFilled' },
  {
    title: '初级功能',
    icon: 'Lock',
    children: [
      { path: '/verification', title: '入群验证' },
      { path: '/anti-ads', title: '广告过滤' },
      { path: '/anti-spam', title: '刷屏处理' },
      { path: '/auto-delete', title: '自动删除' },
      { path: '/porn-detection', title: '色情检测' },
      { path: '/auto-ban', title: '自动封禁' }
    ]
  },
  {
    title: '中级功能',
    icon: 'ChatLineRound',
    children: [
      { path: '/auto-reply', title: '自动回复' },
      { path: '/points', title: '积分系统' },
      { path: '/lottery', title: '抽奖活动' },
      { path: '/send-message', title: '主动消息' },
      { path: '/scheduled-messages', title: '定时消息' }
    ]
  },
  {
    title: '高级功能',
    icon: 'Setting',
    children: [
      { path: '/group-members', title: '群组成员' },
      { path: '/channel-settings', title: '频道关联' },
      { path: '/commands', title: '命令管理' },
      { path: '/verified-users', title: '认证用户' },
      { path: '/invite-stats', title: '邀请统计' },
      { path: '/chat-stats', title: '群聊统计' },
      { path: '/crypto', title: '加密货币' },
      { path: '/super-tools', title: '超级工具' }
    ]
  },
  {
    title: '权限管理',
    icon: 'UserFilled',
    children: [
      { path: '/menu-permissions', title: '菜单权限' },
      { path: '/permissions', title: '管理员权限' }
    ]
  },
  { path: '/settings', title: '系统设置', icon: 'Setting' }
]
```

### 3.2 群组选择器
**文件**: `components/GroupSelector/GroupSelector.vue`

```typescript
// 功能
- 下拉选择当前操作的群组
- 切换群组时同步更新全局状态
- 所有页面共享同一个群组状态

// 使用
const groupsStore = useGroupsStore()
const selectedGroupId = computed(() => groupsStore.selectedGroupId)
```

## 4. 状态管理整合

### 4.1 认证状态
**文件**: `stores/auth.ts`

```typescript
interface AuthState {
  token: string | null
  user: UserInfo | null
  isAuthenticated: boolean
}

// 功能
- 登录/登出
- Token管理
- 用户信息缓存
- 权限检查
```

### 4.2 群组状态
**文件**: `stores/groups.ts`

```typescript
interface GroupsState {
  groups: Group[]           // 群组列表
  currentGroup: Group | null    // 当前选中群组
  currentConfig: GroupConfig | null  // 当前群组配置
  selectedGroupId: string | null    // 选中的群组ID
  loading: boolean
}

// 核心方法
- fetchGroups()        // 获取群组列表
- fetchGroup(id)       // 获取单个群组详情
- setSelectedGroup(id) // 设置当前群组
- updateConfig(data)   // 更新群组配置
```

## 5. 路由配置整合

**文件**: `router/index.ts`

```typescript
const routes: RouteRecordRaw[] = [
  // 登录页
  { path: '/login', name: 'Login', component: Login },
  
  // 主布局
  {
    path: '/',
    component: Layout,
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'Dashboard', component: Dashboard },
      
      // 初级功能
      { path: 'verification', component: Verification },
      { path: 'anti-ads', component: AntiAds },
      { path: 'anti-spam', component: AntiSpam },
      { path: 'auto-delete', component: AutoDelete },
      { path: 'porn-detection', component: PornDetection },
      { path: 'auto-ban', component: AutoBan },
      
      // 中级功能
      { path: 'auto-reply', component: AutoReply },
      { path: 'points', component: Points },
      { path: 'lottery', component: Lottery },
      { path: 'send-message', component: SendMessage },
      { path: 'scheduled-messages', component: ScheduledMessages },
      
      // 高级功能
      { path: 'group-members', component: GroupMembers },
      { path: 'channel-settings', component: ChannelSettings },
      { path: 'commands', component: Commands },
      { path: 'verified-users', component: VerifiedUsers },
      { path: 'invite-stats', component: InviteStats },
      { path: 'chat-stats', component: ChatStats },
      { path: 'crypto', component: Crypto },
      { path: 'super-tools', component: SuperTools },
      
      // 权限管理
      { path: 'menu-permissions', component: MenuPermissions },
      { path: 'permissions', component: Permissions },
      
      // 系统设置
      { path: 'settings', component: Settings }
    ]
  }
]
```

## 6. API接口整合

**文件**: `api/index.ts`

```typescript
// 接口分类
const API = {
  // 认证
  auth: {
    login: (data) => post('/admin/login', data),
    me: () => get('/admin/auth/me')
  },
  
  // 群组
  groups: {
    list: (params) => get('/admin/groups', params),
    detail: (id) => get(`/admin/groups/${id}`),
    update: (id, data) => put(`/admin/groups/${id}`, data)
  },
  
  // 邀请统计
  inviteStats: {
    get: (groupId) => get(`/admin/invite-stats?group_id=${groupId}`),
    leaderboard: (groupId, params) => get(`/admin/invite-stats/leaderboard`, { group_id: groupId, ...params }),
    links: (groupId) => get(`/admin/invite-links?group_id=${groupId}`)
  },
  
  // 加密货币
  crypto: {
    config: (groupId) => get(`/admin/crypto-config?group_id=${groupId}`),
    updateConfig: (data) => post('/admin/crypto-config', data),
    queryAddress: (address, chain) => get(`/admin/crypto/query?address=${address}&chain=${chain}`),
    getRates: () => get('/admin/crypto/rates')
  },
  
  // 权限管理
  permissions: {
    getUsers: (groupId) => get(`/admin/permissions/users?group_id=${groupId}`),
    updateUser: (data) => post('/admin/permissions/users', data),
    removeUser: (userId) => delete_(`/admin/permissions/users/${userId}`),
    getAdmins: (groupId) => get(`/admin/permissions/admins?group_id=${groupId}`),
    addAdmin: (data) => post('/admin/permissions/admins', data),
    updateAdmin: (id, data) => put(`/admin/permissions/admins/${id}`, data),
    removeAdmin: (id) => delete_(`/admin/permissions/admins/${id}`)
  }
}
```

## 7. 公共样式整合

### 7.1 页面头部样式
```scss
// 通用页面头部
.page-header {
  margin-bottom: 24px;
  
  .page-title {
    font-size: 24px;
    font-weight: 600;
    color: #303133;
    margin: 0 0 8px 0;
    display: flex;
    align-items: center;
    gap: 12px;
    
    .title-icon {
      color: #409EFF;
    }
  }
  
  .page-subtitle {
    font-size: 14px;
    color: #909399;
    margin: 0;
  }
}
```

### 7.2 卡片样式
```scss
// 统计卡片
.stat-card {
  .stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    
    &.users { background: #ecf5ff; color: #409eff; }
    &.total { background: #f0f9eb; color: #67c23a; }
    &.valid { background: #fdf6ec; color: #e6a23c; }
    &.pending { background: #f4f4f5; color: #909399; }
    &.reward { background: #fef0f0; color: #f56c6c; }
  }
}

// 功能卡片
.feature-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  
  .feature-icon {
    width: 56px;
    height: 56px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    
    &.address { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    &.exchange { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
  }
}
```

## 8. 功能实现清单

### 8.1 已完成功能
- [x] 数据看板 (Dashboard)
- [x] 入群验证 (Verification)
- [x] 广告过滤 (AntiAds)
- [x] 刷屏处理 (AntiSpam)
- [x] 自动删除 (AutoDelete)
- [x] 色情检测 (PornDetection)
- [x] 自动封禁 (AutoBan)
- [x] 自动回复 (AutoReply)
- [x] 积分系统 (Points)
- [x] 抽奖活动 (Lottery)
- [x] 主动消息 (SendMessage)
- [x] 定时消息 (ScheduledMessages)
- [x] 群组成员 (GroupMembers)
- [x] 频道关联 (ChannelSettings)
- [x] 命令管理 (Commands)
- [x] 认证用户 (VerifiedUsers)
- [x] 邀请统计 (InviteStats) - 分页优化
- [x] 群聊统计 (ChatStats)
- [x] 加密货币 (Crypto) - 重构完成
- [x] 超级工具 (SuperTools)
- [x] 菜单权限 (MenuPermissions) - 新增
- [x] 管理员权限 (Permissions) - 保留
- [x] 系统设置 (Settings)

### 8.2 核心特性
- [x] 功能三级分类（初级/中级/高级）
- [x] 基于用户的功能权限分配
- [x] 管理员权限管理
- [x] 群组切换全局同步
- [x] 分页展示（10条/页）
- [x] 区块链地址自动识别
- [x] USDT多链支持
- [x] 交易所汇率实时查询

## 9. 已完成的后端API对接

### 9.1 后端API对接 ✅
- [x] 菜单权限保存接口 - `api/admin/menu-permissions.ts`
- [x] 用户搜索接口 - `api/admin/users-search.ts`
- [x] 区块链地址查询接口 - `api/admin/crypto-query.ts`
- [x] 交易所汇率获取接口 - `api/admin/crypto-rates.ts`
- [x] 邀请统计数据接口 - `api/admin/invite-stats.ts` (已存在)

### 9.2 权限控制 ✅
- [x] 前端路由权限守卫 - `router/index.ts`
- [x] 菜单显示权限控制 - `components/Layout/Layout.vue`
- [x] 按钮级别权限控制 - `directives/permission.ts`

### 9.3 优化项 ✅
- [x] 页面加载性能优化 - API请求优化
- [x] 数据缓存策略 - `utils/cache.ts`
- [x] 错误处理统一封装 - `utils/errorHandler.ts`
- [x] 表单验证规则完善 - `utils/validators.ts`

## 10. 新增工具函数

### 10.1 错误处理工具 (`utils/errorHandler.ts`)
```typescript
// 错误类型枚举
enum ErrorType {
  NETWORK = 'network',
  AUTH = 'auth',
  VALIDATION = 'validation',
  SERVER = 'server',
  UNKNOWN = 'unknown'
}

// 使用示例
import { handleError, withErrorHandling } from '@/utils/errorHandler'

// 自动处理错误
try {
  await api.get('/admin/data')
} catch (error) {
  handleError(error)
}

// 包装函数自动处理
const fetchData = withErrorHandling(async () => {
  return await api.get('/admin/data')
})
```

### 10.2 缓存工具 (`utils/cache.ts`)
```typescript
// 使用示例
import { cache, withCache } from '@/utils/cache'

// 直接操作缓存
cache.set('key', data, 60000)  // 缓存1分钟
const data = cache.get('key')
cache.remove('key')
cache.clear()

// 包装函数自动缓存
const fetchData = withCache(
  async (id: string) => {
    return await api.get(`/admin/data/${id}`)
  },
  (id) => `data_${id}`,  // 缓存键生成
  { expireTime: 300000 }  // 缓存5分钟
)
```

### 10.3 表单验证工具 (`utils/validators.ts`)
```typescript
// 使用示例
import { required, length, email, range, formRules } from '@/utils/validators'

// Element Plus 表单规则
const rules = {
  name: [required('请输入名称'), length(2, 50)],
  email: [required('请输入邮箱'), email()],
  age: [range(18, 100, '年龄应在18-100之间')],
  // 使用预设规则
  groupName: formRules.groupName,
  points: formRules.points
}

// 加密货币地址验证
import { cryptoAddressAuto } from '@/utils/validators'

const addressRules = {
  address: [required('请输入地址'), cryptoAddressAuto()]
}
```

### 10.4 权限指令 (`directives/permission.ts`)
```vue
<!-- 按钮级别权限控制 -->
<template>
  <!-- 需要特定权限 -->
  <el-button v-permission="'advanced'">高级功能</el-button>
  
  <!-- 多个权限满足其一 -->
  <el-button v-permission="['intermediate', 'advanced']">中级以上</el-button>
  
  <!-- 仅超级管理员 -->
  <el-button v-super-admin>系统设置</el-button>
</template>
```

## 11. 使用说明

### 11.1 权限管理使用流程
1. 超级管理员进入"权限管理" → "菜单权限"
2. 点击"添加用户"搜索并选择用户
3. 勾选功能级别（初级/中级/高级）
4. 权限自动保存
5. 被授权用户登录后只能看到对应菜单

### 11.2 加密货币配置流程
1. 进入"高级功能" → "加密货币"
2. 启用地址查询功能
3. 选择支持的区块链网络
4. 配置消息模板
5. 启用汇率查询功能
6. 设置触发关键词和显示选项

### 11.3 邀请统计查看
1. 进入"高级功能" → "邀请统计"
2. 查看顶部统计概览
3. 查看邀请排行榜（分页显示）
4. 管理邀请链接
5. 配置邀请规则

## 12. 后端API路由清单

### 12.1 已实现的API端点

| 端点 | 方法 | 描述 | 文件 |
|------|------|------|------|
| `/api/admin/menu-permissions` | GET | 获取菜单权限列表 | `menu-permissions.ts` |
| `/api/admin/menu-permissions` | POST | 添加菜单权限 | `menu-permissions.ts` |
| `/api/admin/menu-permissions` | PUT | 更新菜单权限 | `menu-permissions.ts` |
| `/api/admin/menu-permissions` | DELETE | 删除菜单权限 | `menu-permissions.ts` |
| `/api/admin/users-search` | GET | 搜索用户 | `users-search.ts` |
| `/api/admin/crypto-query` | GET | 查询区块链地址 | `crypto-query.ts` |
| `/api/admin/crypto-rates` | GET | 获取USDT/CNY汇率 | `crypto-rates.ts` |
| `/api/admin/invite-stats` | GET | 获取邀请统计 | `invite-stats.ts` |

### 12.2 开发服务器配置
**文件**: `backend/dev-server.ts`

已添加新的API路由映射：
```typescript
const apiRoutes: Record<string, string> = {
  // ... 现有路由
  '/api/admin/menu-permissions': './api/admin/menu-permissions.ts',
  '/api/admin/users-search': './api/admin/users-search.ts',
  '/api/admin/crypto-query': './api/admin/crypto-query.ts',
  '/api/admin/crypto-rates': './api/admin/crypto-rates.ts'
}
```

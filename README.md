# Telegram 群管机器人

一个功能强大的 Telegram 群组管理机器人，支持多种群管功能。

## 🚀 功能特性

### 初级功能
- 🔐 **入群验证** - 支持多种验证方式（数学题、滑块、频道订阅等）
- 🛡️ **广告过滤** - 自动检测并处理广告消息
- ⚡ **防刷屏** - 智能检测并限制刷屏行为
- 🗑️ **自动删除** - 根据规则自动删除消息
- 🔞 **色情检测** - 自动检测并处理不良内容
- 🚫 **自动封禁** - 根据规则自动封禁用户
- 💬 **自动回复** - 关键词触发自动回复

### 中级功能
- 💰 **积分系统** - 签到、互动获取积分
- 🎁 **抽奖活动** - 创建和管理群组抽奖
- 📢 **主动消息** - 管理员主动发送消息
- ⏰ **定时消息** - 定时发送群消息

### 高级功能
- 👥 **群组成员** - 管理群组成员
- 📺 **频道关联** - 关联频道自动转发
- ⚙️ **命令管理** - 自定义机器人命令
- ✅ **认证用户** - 设置认证用户特权
- 📊 **邀请统计** - 统计成员邀请数据
- 📈 **群聊统计** - 统计群组活跃度
- 💎 **加密货币** - USDT 地址查询和汇率
- 🛠️ **超级工具** - 批量操作工具

### 系统设置
- 🔑 **菜单权限** - 管理管理员权限
- 👮 **管理员权限** - 设置超级管理员
- ⚙️ **系统设置** - 全局配置

## 📦 项目结构

```
telegram-group-manager/
├── backend/                 # 后端 API
│   ├── api/                # Vercel Serverless Functions
│   ├── handlers/           # Telegram 消息处理器
│   ├── lib/                # 工具库
│   ├── middleware/         # 中间件
│   ├── services/           # 业务服务
│   └── types/              # TypeScript 类型
├── frontend/               # 前端管理面板
│   ├── src/
│   │   ├── api/           # API 请求
│   │   ├── components/    # Vue 组件
│   │   ├── router/        # 路由配置
│   │   ├── stores/        # Pinia 状态管理
│   │   └── views/         # 页面视图
│   └── dist/              # 构建产物
├── database/              # 数据库 Schema
└── docs/                  # 项目文档
```

## 🛠️ 技术栈

### 后端
- **Runtime**: Node.js 18+
- **Framework**: Vercel Serverless Functions
- **Database**: Supabase (PostgreSQL)
- **Bot Framework**: Grammy
- **Language**: TypeScript

### 前端
- **Framework**: Vue 3 + TypeScript
- **UI Library**: Element Plus
- **State Management**: Pinia
- **Build Tool**: Vite
- **Styling**: SCSS + Tailwind CSS

## 🚀 快速开始

### 前置要求
- Node.js 18+
- Supabase 账号
- Telegram Bot Token

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-username/telegram-group-manager.git
cd telegram-group-manager

# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 配置

1. 创建 Supabase 项目并执行 `database/schema.sql`
2. 复制环境变量模板：
```bash
cp backend/.env.example backend/.env
```

3. 填写环境变量：
```env
TELEGRAM_BOT_TOKEN=your_bot_token
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
```

### 开发

```bash
# 启动后端开发服务器
cd backend
npm run dev

# 启动前端开发服务器
cd frontend
npm run dev
```

### 部署

#### Vercel 部署

1. 将代码推送到 GitHub
2. 在 Vercel 导入仓库
3. 分别部署 `backend` 和 `frontend` 目录
4. 配置环境变量
5. 设置 Telegram Webhook

详细部署步骤请参考 [部署文档](docs/PROJECT_COMPLETION_REPORT.md)

## 📝 环境变量

| 变量名 | 说明 | 必填 |
|--------|------|------|
| TELEGRAM_BOT_TOKEN | Telegram Bot Token | ✅ |
| SUPABASE_URL | Supabase 项目 URL | ✅ |
| SUPABASE_SERVICE_ROLE_KEY | Supabase Service Role Key | ✅ |
| JWT_SECRET | JWT 密钥 (至少32字符) | ✅ |
| UPSTASH_REDIS_REST_URL | Upstash Redis URL | ❌ |
| UPSTASH_REDIS_REST_TOKEN | Upstash Redis Token | ❌ |

## 📄 License

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

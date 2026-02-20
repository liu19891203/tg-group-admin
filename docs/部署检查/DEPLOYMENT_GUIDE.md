# Telegram 群管机器人 - 完整部署方案

## 目录

1. [部署概述](#1-部署概述)
2. [前置准备](#2-前置准备)
3. [数据库配置](#3-数据库配置)
4. [环境变量配置](#4-环境变量配置)
5. [Vercel 部署](#5-vercel-部署)
6. [Webhook 设置](#6-webhook-设置)
7. [定时任务配置](#7-定时任务配置)
8. [验证部署](#8-验证部署)
9. [常见问题](#9-常见问题)

---

## 1. 部署概述

### 1.1 架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                           用户访问层                                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   Telegram Bot ◄────────────► Webhook ◄──────────► Vercel API      │
│        │                           │                      │         │
│        │                           │                      │         │
│        ▼                           ▼                      ▼         │
│   ┌─────────┐              ┌─────────────┐         ┌───────────┐   │
│   │ Telegram│              │  Supabase   │         │  Upstash  │   │
│   │  API    │              │ PostgreSQL  │         │   Redis   │   │
│   └─────────┘              └─────────────┘         └───────────┘   │
│                                                                     │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                    Vercel Frontend                          │   │
│   │                 (Vue 3 + Element Plus)                      │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 服务清单

| 服务 | 用途 | 免费额度 | 推荐计划 |
|------|------|----------|----------|
| **Vercel** | 前端 + 后端托管 | 100GB带宽/月 | Pro $20/月 |
| **Supabase** | PostgreSQL 数据库 | 500MB存储 | Pro $25/月 |
| **Upstash** | Redis 缓存 | 10,000请求/天 | Pay-as-you-go |
| **Telegram** | Bot API | 免费 | 免费 |

---

## 2. 前置准备

### 2.1 创建 Telegram Bot

1. 打开 Telegram，搜索 `@BotFather`
2. 发送 `/newbot` 命令
3. 按提示输入 Bot 名称和用户名
4. **保存 Bot Token**（格式：`123456789:ABCdefGHIjklMNOpqrsTUVwxyz`）

### 2.2 获取 Telegram 用户 ID

1. 在 Telegram 搜索 `@userinfobot`
2. 发送任意消息，获取你的 Telegram ID
3. 记录此 ID，用于设置超级管理员

### 2.3 注册 Supabase

1. 访问 [https://supabase.com](https://supabase.com)
2. 注册账号并创建新项目
3. 记录以下信息：
   - **Project URL**: `https://xxx.supabase.co`
   - **Anon Key**: `eyJhbGciOiJIUzI1NiIs...`
   - **Service Role Key**: `eyJhbGciOiJIUzI1NiIs...`

### 2.4 注册 Upstash Redis

1. 访问 [https://upstash.com](https://upstash.com)
2. 注册账号并创建 Redis 数据库
3. 记录以下信息：
   - **REST URL**: `https://xxx.upstash.io`
   - **REST Token**: `ATRbAAI...`

### 2.5 注册 Vercel

1. 访问 [https://vercel.com](https://vercel.com)
2. 使用 GitHub 账号登录
3. Fork 本项目到你的 GitHub

---

## 3. 数据库配置

### 3.1 初始化数据库

1. 登录 Supabase Dashboard
2. 进入 **SQL Editor**
3. 复制 `database/complete_schema.sql` 的内容
4. 执行 SQL 脚本

### 3.2 修改超级管理员

在执行 SQL 前，修改超级管理员 Telegram ID：

```sql
-- 找到这一行，修改为你的 Telegram ID
INSERT INTO admins (telegram_id, username, display_name, level, is_active)
VALUES (你的TelegramID, 'super_admin', '超级管理员', 10, true)
```

### 3.3 验证表创建

执行以下 SQL 验证：

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

应该看到以下表：
- admins
- groups
- users
- group_configs
- user_points
- ... 等 20+ 张表

---

## 4. 环境变量配置

### 4.1 完整环境变量清单

创建 `.env` 文件（后端目录）：

```env
# ============ Telegram ============
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_WEBHOOK_URL=https://your-project.vercel.app/api/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=your_random_secret_string_32chars

# ============ Supabase ============
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...

# ============ Upstash Redis ============
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=ATRbAAI...

# ============ Security ============
JWT_SECRET=your_jwt_secret_key_at_least_32_characters_long
ADMIN_INVITE_CODE=your_admin_invite_code
CRON_SECRET=your_cron_secret_for_scheduled_tasks

# ============ Application ============
NODE_ENV=production
PROJECT_NAME=telegram-group-manager
```

### 4.2 生成密钥

使用以下命令生成安全密钥：

```powershell
# 生成 JWT_SECRET (32字符)
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# 生成 WEBHOOK_SECRET (32字符)
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# 生成 CRON_SECRET (32字符)
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### 4.3 前端环境变量

创建 `frontend/.env.production`：

```env
VITE_API_URL=https://your-project.vercel.app/api
VITE_APP_TITLE=Telegram 群管机器人
```

---

## 5. Vercel 部署

### 5.1 部署后端

1. 在 Vercel Dashboard 点击 **New Project**
2. 导入你的 GitHub 仓库
3. 配置项目：
   - **Root Directory**: `backend`
   - **Framework Preset**: Other
   - **Build Command**: `npm run build`
   - **Output Directory**: 留空
   - **Install Command**: `npm install`

4. 添加环境变量（参考 4.1 节）

5. 点击 **Deploy**

### 5.2 部署前端

1. 再次点击 **New Project**
2. 导入同一仓库
3. 配置项目：
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

4. 添加环境变量：
   ```
   VITE_API_URL=https://your-backend.vercel.app/api
   ```

5. 点击 **Deploy**

### 5.3 配置域名（可选）

1. 进入项目设置 → Domains
2. 添加自定义域名
3. 配置 DNS 记录

---

## 6. Webhook 设置

### 6.1 设置 Webhook

部署完成后，调用以下 API 设置 Webhook：

```powershell
# 方法1：使用 API
curl -X POST "https://your-backend.vercel.app/api/admin/set-webhook" `
  -H "Content-Type: application/json"

# 方法2：直接调用 Telegram API
$TOKEN = "your_bot_token"
$WEBHOOK_URL = "https://your-backend.vercel.app/api/telegram/webhook"

$body = @{
    url = $WEBHOOK_URL
    allowed_updates = @(
        "message",
        "edited_message",
        "channel_post",
        "callback_query",
        "my_chat_member",
        "chat_member"
    )
    drop_pending_updates = $true
} | ConvertTo-Json

Invoke-RestMethod -Uri "https://api.telegram.org/bot$TOKEN/setWebhook" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

### 6.2 验证 Webhook

```powershell
$TOKEN = "your_bot_token"
Invoke-RestMethod -Uri "https://api.telegram.org/bot$TOKEN/getWebhookInfo"
```

检查返回的 `url` 是否正确。

### 6.3 Webhook 安全验证

在 `webhook.ts` 中添加签名验证：

```typescript
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
const hash = req.headers['x-telegram-bot-api-secret-token'];

if (hash !== secret) {
  return res.status(403).json({ error: 'Invalid secret' });
}
```

---

## 7. 定时任务配置

### 7.1 GitHub Actions 配置

项目已包含 `.github/workflows/cron.yml`，需要配置：

1. 进入 GitHub 仓库 → Settings → Secrets and variables → Actions
2. 添加以下 Secrets：
   - `VERCEL_URL`: 你的后端 URL
   - `CRON_SECRET`: 定时任务密钥

### 7.2 定时任务端点

| 端点 | 说明 | 建议频率 |
|------|------|----------|
| `/api/cron/scheduled-messages` | 发送定时消息 | 每5分钟 |
| `/api/cron/processDeletes` | 处理待删除消息 | 每1分钟 |
| `/api/cron/daily-stats` | 每日统计 | 每天0点 |

### 7.3 外部 Cron 服务（可选）

如果不使用 GitHub Actions，可以使用：

- **cron-job.org**（免费）
- **EasyCron**（免费额度）
- **AWS EventBridge**（按需付费）

配置示例：

```
URL: https://your-backend.vercel.app/api/cron/scheduled-messages
Method: POST
Headers: 
  X-Cron-Key: your_cron_secret
Schedule: */5 * * * *
```

---

## 8. 验证部署

### 8.1 健康检查

```powershell
# 检查后端
Invoke-RestMethod -Uri "https://your-backend.vercel.app/api/health"

# 检查前端
Invoke-WebRequest -Uri "https://your-frontend.vercel.app"
```

### 8.2 Bot 功能测试

1. 在 Telegram 中找到你的 Bot
2. 发送 `/start` 命令
3. 应该收到欢迎消息

### 8.3 Web 管理后台测试

1. 访问前端 URL
2. 使用 Telegram 验证码登录
3. 验证功能正常

### 8.4 数据库连接测试

```powershell
# 调用需要数据库的 API
Invoke-RestMethod -Uri "https://your-backend.vercel.app/api/admin/groups"
```

---

## 9. 常见问题

### 9.1 Webhook 不工作

**症状**：Bot 不响应消息

**排查步骤**：
1. 检查 Webhook URL 是否正确
2. 检查 Vercel 函数日志
3. 验证 Bot Token 是否有效
4. 检查 Telegram API 返回的错误信息

```powershell
# 查看 Webhook 信息
$TOKEN = "your_bot_token"
Invoke-RestMethod -Uri "https://api.telegram.org/bot$TOKEN/getWebhookInfo"
```

### 9.2 数据库连接失败

**症状**：API 返回 500 错误

**排查步骤**：
1. 检查 Supabase 项目是否暂停（免费版闲置会暂停）
2. 验证环境变量是否正确
3. 检查 Supabase 连接池设置

### 9.3 Redis 连接失败

**症状**：缓存功能不工作

**解决方案**：
- Redis 连接失败会自动降级到内存缓存
- 检查 Upstash Redis 是否超出免费额度

### 9.4 前端无法访问后端 API

**症状**：CORS 错误

**解决方案**：
1. 检查 Vercel 项目设置中的 CORS 配置
2. 确认 `VITE_API_URL` 环境变量正确

### 9.5 定时任务不执行

**症状**：定时消息未发送

**排查步骤**：
1. 检查 GitHub Actions 是否启用
2. 验证 `CRON_SECRET` 是否匹配
3. 查看 GitHub Actions 运行日志

---

## 10. 部署检查清单

### 10.1 部署前检查

- [ ] Telegram Bot 已创建，Token 已保存
- [ ] Supabase 项目已创建，数据库已初始化
- [ ] Upstash Redis 已创建
- [ ] Vercel 账号已注册
- [ ] 代码已推送到 GitHub

### 10.2 环境变量检查

- [ ] `TELEGRAM_BOT_TOKEN` 已配置
- [ ] `SUPABASE_URL` 已配置
- [ ] `SUPABASE_ANON_KEY` 已配置
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 已配置
- [ ] `UPSTASH_REDIS_REST_URL` 已配置
- [ ] `UPSTASH_REDIS_REST_TOKEN` 已配置
- [ ] `JWT_SECRET` 已配置（至少32字符）
- [ ] `TELEGRAM_WEBHOOK_URL` 已配置
- [ ] `CRON_SECRET` 已配置

### 10.3 部署后检查

- [ ] 后端部署成功
- [ ] 前端部署成功
- [ ] Webhook 已设置
- [ ] Bot 响应 `/start` 命令
- [ ] Web 管理后台可访问
- [ ] 登录功能正常
- [ ] 定时任务配置完成

---

## 11. 维护与监控

### 11.1 日志查看

- **Vercel**: Dashboard → Logs
- **Supabase**: Dashboard → Logs
- **Upstash**: Dashboard → Metrics

### 11.2 监控告警

推荐配置：
1. **Vercel Analytics** - 监控请求量和错误率
2. **Supabase Dashboard** - 监控数据库连接数和存储
3. **Uptime Robot** - 监控服务可用性

### 11.3 备份策略

- **数据库**: Supabase 自动每日备份（Pro 计划）
- **代码**: GitHub 仓库
- **环境变量**: 安全存储（如 1Password）

---

## 12. 成本估算

### 12.1 免费方案（适合测试）

| 服务 | 免费额度 | 预计用量 |
|------|----------|----------|
| Vercel | 100GB/月 | 10-20GB |
| Supabase | 500MB | 100-200MB |
| Upstash | 10K请求/天 | 5K请求/天 |

**总成本**: $0/月

### 12.2 生产方案（适合正式使用）

| 服务 | 计划 | 费用 |
|------|------|------|
| Vercel | Pro | $20/月 |
| Supabase | Pro | $25/月 |
| Upstash | Pay-as-you-go | ~$5/月 |
| **总计** | | **~$50/月** |

---

## 附录

### A. 有用的 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/admin/groups` | GET | 获取群组列表 |
| `/api/admin/webhook-info` | GET | 查看 Webhook 状态 |
| `/api/admin/set-webhook` | POST | 设置 Webhook |
| `/api/admin/auth/send-code` | POST | 发送登录验证码 |
| `/api/admin/auth/verify-code` | POST | 验证登录验证码 |

### B. Telegram Bot 命令

| 命令 | 说明 |
|------|------|
| `/start` | 开始使用 Bot |
| `/help` | 查看帮助 |
| `/settings` | 打开设置菜单（群组中） |
| `/mygroups` | 我的群组管理（私聊） |
| `/checkin` | 每日签到 |
| `/me` | 查看个人信息 |
| `/rank` | 查看排行榜 |

### C. 联系支持

如遇问题，请：
1. 查看本文档常见问题部分
2. 检查 Vercel/Supabase 日志
3. 提交 GitHub Issue

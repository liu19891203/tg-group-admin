# Telegram 群管机器人 - Vercel 部署指南

## 📋 部署前准备

### 1. 已完成的准备工作

- ✅ GitHub 仓库: https://github.com/liu19891203/tg-group-admin
- ✅ Supabase 项目: https://wakhvhdwvkhodpvfcana.supabase.co
- ✅ Telegram Bot Token: `8215343577:AAGNkazlxhM2eEVzc2DkDWKnP9kioQ90LyE`
- ✅ Upstash Redis: https://learning-cicada-13403.upstash.io
- ✅ API 已合并为单一入口（解决 Vercel 12 函数限制）

### 2. 需要的环境变量

```
TELEGRAM_BOT_TOKEN=8215343577:AAGNkazlxhM2eEVzc2DkDWKnP9kioQ90LyE
SUPABASE_URL=https://wakhvhdwvkhodpvfcana.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indha2h2aGR3dmtob2RwdmZjYW5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA1NDYwNSwiZXhwIjoyMDg2NjMwNjA1fQ.r29EPcz6b_iJhTwQb3nAvyi__uE7Zd4njuBFCkL_FRY
UPSTASH_REDIS_REST_URL=https://learning-cicada-13403.upstash.io
UPSTASH_REDIS_REST_TOKEN=ATRbAAIncDI5MzE2YTYwOWU5YjU0NDhhOGE3ZDA4NjEzMzVlOWE0OHAyMTM0MDM
JWT_SECRET=telegram_group_manager_jwt_secret_key_2024_production
```

---

## 🚀 部署步骤

### 第一步：部署后端

1. 访问 **https://vercel.com/new**
2. 选择仓库 `liu19891203/tg-group-admin`
3. 配置项目：
   - **Project Name**: `tg-group-admin-backend`
   - **Root Directory**: `backend`
   - **Framework Preset**: Other
4. 添加环境变量（Environment Variables）：

| 变量名 | 值 |
|--------|-----|
| `TELEGRAM_BOT_TOKEN` | `8215343577:AAGNkazlxhM2eEVzc2DkDWKnP9kioQ90LyE` |
| `SUPABASE_URL` | `https://wakhvhdwvkhodpvfcana.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indha2h2aGR3dmtob2RwdmZjYW5hIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTA1NDYwNSwiZXhwIjoyMDg2NjMwNjA1fQ.r29EPcz6b_iJhTwQb3nAvyi__uE7Zd4njuBFCkL_FRY` |
| `UPSTASH_REDIS_REST_URL` | `https://learning-cicada-13403.upstash.io` |
| `UPSTASH_REDIS_REST_TOKEN` | `ATRbAAIncDI5MzE2YTYwOWU5YjU0NDhhOGE3ZDA4NjEzMzVlOWE0OHAyMTM0MDM` |
| `JWT_SECRET` | `telegram_group_manager_jwt_secret_key_2024_production` |

5. 点击 **Deploy**
6. 等待部署完成，记录后端域名（如：`tg-group-admin.vercel.app`）

### 第二步：部署前端

1. 再次访问 **https://vercel.com/new**
2. 选择同一仓库 `liu19891203/tg-group-admin`
3. 配置项目：
   - **Project Name**: `tg-group-admin-frontend`
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
4. 添加环境变量：

| 变量名 | 值 |
|--------|-----|
| `VITE_API_URL` | `https://你的后端域名.vercel.app` |

5. 点击 **Deploy**
6. 等待部署完成，记录前端域名

### 第三步：设置 Telegram Webhook

在浏览器中访问以下 URL（替换后端域名）：

```
https://api.telegram.org/bot8215343577:AAGNkazlxhM2eEVzc2DkDWKnP9kioQ90LyE/setWebhook?url=https://你的后端域名/api/telegram/webhook
```

成功响应示例：
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

---

## ✅ 验证部署

### 1. 测试后端健康检查

访问：`https://你的后端域名/api/health`

应返回：
```json
{"status": "ok", "timestamp": "2024-01-01T00:00:00.000Z"}
```

### 2. 测试前端

访问前端域名，应能看到管理后台登录页面。

### 3. 测试 Telegram Bot

在 Telegram 中找到你的机器人，发送 `/start`，应收到回复。

---

## 🔧 架构说明

### API 合并方案

由于 Vercel 免费版限制最多 12 个 Serverless Functions，我们采用了以下方案：

1. **统一 API 入口** (`api/index.ts`)
   - 所有管理后台 API 请求通过 `/api/*` 路由
   - 内部路由器根据路径分发到对应处理器

2. **独立 Webhook 入口** (`api/telegram/webhook.ts`)
   - Telegram 消息推送专用
   - 处理机器人的所有交互

### 路由映射

| 前端请求 | 后端处理 |
|---------|---------|
| `GET /api/admin/groups` | 获取群组列表 |
| `POST /api/admin/groups` | 创建群组 |
| `GET /api/admin/dashboard` | 获取仪表盘数据 |
| `GET /api/admin/points` | 获取积分排行 |
| `...` | 其他 API |
| `POST /api/telegram/webhook` | Telegram 消息处理 |

---

## 🛠️ 常见问题

### Q: 部署失败怎么办？

1. 检查环境变量是否完整
2. 查看 Vercel 部署日志
3. 确认 Root Directory 设置正确

### Q: Bot 没有响应？

1. 检查 Webhook 是否设置成功
2. 确认 `TELEGRAM_BOT_TOKEN` 正确
3. 查看 Vercel 函数日志

### Q: 前端无法连接后端？

1. 检查 `VITE_API_URL` 环境变量
2. 确认后端已成功部署
3. 检查 CORS 配置

---

## � 相关链接

- [Vercel 文档](https://vercel.com/docs)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Supabase 文档](https://supabase.com/docs)

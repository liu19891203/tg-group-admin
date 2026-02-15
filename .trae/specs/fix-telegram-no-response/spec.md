# Telegram 功能无响应问题修复 - 产品需求文档

## 概述
- **摘要**: 修复 Telegram 群管机器人在 Telegram 客户端无响应的问题
- **目的**: 确保所有配置的功能在 Telegram 中正确执行
- **目标用户**: 群组管理员

## 问题分析

### 🔴 根本原因 1: Webhook 未配置 `allowed_updates`
Telegram Bot API 需要明确指定要接收的事件类型。当前代码处理了 `chat_member` 事件，但 **webhook 可能没有订阅这个事件**！

### 🔴 根本原因 2: 虚拟币功能未在 Webhook 中实现
- 前端有完整的虚拟币配置页面
- 后端 API 返回硬编码数据
- **Webhook 中没有处理地址检测和汇率查询的逻辑**

### 🔴 根本原因 3: 验证配置未正确读取
- `verification_config` 可能未正确保存到数据库
- 或者字段名不匹配

## 功能需求

### FR-1: Webhook 事件订阅
- **FR-1.1**: 设置 webhook 时必须包含 `allowed_updates` 参数
- **FR-1.2**: 必须订阅的事件类型：
  - `message` - 普通消息
  - `my_chat_member` - 机器人被添加/移除
  - `chat_member` - 群成员变动（入群验证必需）
  - `callback_query` - 按钮点击

### FR-2: 虚拟币地址检测
- **FR-2.1**: 在群组消息中检测区块链地址格式
- **FR-2.2**: 自动识别 ERC20、TRC20、BEP20、SOL、BTC 地址
- **FR-2.3**: 调用 API 查询余额并返回结果

### FR-3: 汇率查询
- **FR-3.1**: 检测"汇率"、"usdt"、"价格"等关键词
- **FR-3.2**: 调用真实 API 获取汇率
- **FR-3.3**: 返回格式化的汇率信息

### FR-4: 入群验证调试
- **FR-4.1**: 添加详细日志记录
- **FR-4.2**: 验证配置字段名匹配
- **FR-4.3**: 确保机器人有管理员权限

## 验收标准

### AC-1: Webhook 事件订阅
- **Given**: 机器人设置 webhook
- **When**: 调用 setWebhook API
- **Then**: 包含正确的 allowed_updates 参数
- **Verification**: `programmatic`

### AC-2: 虚拟币地址检测
- **Given**: 用户在群组发送区块链地址
- **When**: 地址格式匹配
- **Then**: 机器人返回余额查询结果
- **Verification**: `programmatic`

### AC-3: 汇率查询
- **Given**: 用户发送"汇率"
- **When**: 消息被处理
- **Then**: 机器人返回 USDT/CNY 汇率
- **Verification**: `programmatic`

### AC-4: 入群验证
- **Given**: 新成员加入群组
- **When**: 验证已启用
- **Then**: 成员被禁言并收到验证消息
- **Verification**: `programmatic`

## 约束
- 不修改前端界面
- 使用现有的 API 服务
- 保持向后兼容

## 开放问题
- [ ] 是否需要添加 setWebhook API 端点？
- [ ] 虚拟币 API 使用哪个服务？（当前有 cryptoService）

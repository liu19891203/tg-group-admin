# 系统性错误修复 - 产品需求文档

## 概述
- **摘要**: 系统性修复项目中的所有 TypeScript 错误和潜在问题
- **目的**: 确保项目编译无错误，功能正常运行
- **目标用户**: 开发者

## 问题分析

### TypeScript 编译错误 (39 个)

#### 1. scheduledMessagesService.ts (33 个错误)
- Supabase 表类型定义缺失
- `scheduled_messages` 表没有在数据库类型中定义
- 导致所有查询返回 `never` 类型

#### 2. api/cron/scheduled-messages.ts (2 个错误)
- `fetch` 返回类型未正确处理
- `data.ok` 和 `data.description` 不存在于 `unknown` 类型

#### 3. api/index.ts (4 个错误)
- Telegram API 返回类型未正确处理
- `result.ok` 和 `result.result` 不存在于 `unknown` 类型

### 根本原因
1. **数据库类型定义不完整** - `scheduled_messages` 表未在 `database.ts` 中定义
2. **API 响应类型缺失** - Telegram API 和其他外部 API 的响应没有类型定义

## 功能需求

### FR-1: 修复数据库类型定义
- **FR-1.1**: 在 `database.ts` 中添加 `scheduled_messages` 表类型
- **FR-1.2**: 添加所有缺失的表字段类型

### FR-2: 修复 API 响应类型
- **FR-2.1**: 定义 Telegram API 响应类型
- **FR-2.2**: 正确处理 fetch 返回的 JSON

### FR-3: 修复服务层类型
- **FR-3.1**: 为 `scheduledMessagesService` 添加正确的类型
- **FR-3.2**: 确保所有 Supabase 查询有正确的类型推断

## 验收标准

### AC-1: TypeScript 编译成功
- **Given**: 运行 `npx tsc --noEmit`
- **When**: 编译完成
- **Then**: 无错误输出
- **Verification**: `programmatic`

### AC-2: 所有服务正常工作
- **Given**: 项目部署到 Vercel
- **When**: 调用各个 API 端点
- **Then**: 返回正确响应
- **Verification**: `programmatic`

## 约束
- 不改变现有功能逻辑
- 只修复类型错误
- 保持向后兼容

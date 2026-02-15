# 系统性错误修复 - 实现计划

## [x] Task 1: 修复数据库类型定义
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在 `database.ts` 中添加 `scheduled_messages` 表的完整类型定义
  - 包含所有字段：id, group_id, channel_id, message_content, schedule_type, cron_expr, interval_minutes, start_at, end_at, next_send_at, last_sent_at, sent_count, failed_count, is_enabled, created_by, created_at, updated_at
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: TypeScript 编译无 scheduled_messages 相关错误
- **Notes**: 这是根本原因，导致 33 个错误

## [x] Task 2: 修复 Telegram API 响应类型
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在 `api/index.ts` 中定义 Telegram API 响应类型
  - 修复 setWebhook、getWebhookInfo、deleteWebhook 的响应处理
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-2.1: api/index.ts 编译无错误
- **Notes**: 4 个错误

## [x] Task 3: 修复 cron API 响应类型
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在 `api/cron/scheduled-messages.ts` 中修复 fetch 响应类型
  - 定义正确的响应接口
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-3.1: api/cron/scheduled-messages.ts 编译无错误
- **Notes**: 2 个错误

## [x] Task 4: 验证编译成功
- **Priority**: P0
- **Depends On**: Task 1, Task 2, Task 3
- **Description**: 
  - 运行 `npx tsc --noEmit` 确认无错误
  - 如有剩余错误，继续修复
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-4.1: TypeScript 编译返回 0 错误
- **Notes**: 

## 任务依赖关系
```
Task 1 (数据库类型) ─┐
Task 2 (Telegram API)┼──> Task 4 (验证编译)
Task 3 (cron API) ───┘
```

Task 1, 2, 3 可并行执行，Task 4 依赖前三个任务。

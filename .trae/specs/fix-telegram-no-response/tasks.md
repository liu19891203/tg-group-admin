# Telegram 功能无响应问题修复 - 实现计划

## [x] Task 1: 创建 setWebhook API 端点
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 创建 `/api/admin/set-webhook` 端点
  - 调用 Telegram `setWebhook` API
  - 设置 `allowed_updates` 参数包含所有需要的事件类型
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: setWebhook 返回成功
  - `programmatic` TR-1.2: getWebhookInfo 显示正确的 allowed_updates
- **Notes**: 这是根本原因！没有订阅 chat_member 事件

## [x] Task 2: 实现虚拟币地址检测
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在 `handleGroupMessage` 中添加地址检测逻辑
  - 使用正则表达式匹配 ERC20、TRC20、BEP20、SOL、BTC 地址
  - 调用 `cryptoService` 查询余额
  - 返回格式化结果
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: ERC20 地址被检测
  - `programmatic` TR-2.2: TRC20 地址被检测
  - `programmatic` TR-2.3: 余额查询结果正确返回
- **Notes**: 当前 webhook 中完全没有这个功能

## [x] Task 3: 实现汇率查询
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在 `handleGroupMessage` 中检测"汇率"等关键词
  - 调用 `cryptoService.getUSDTPrice()` 获取真实汇率
  - 返回格式化的汇率信息
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-3.1: 发送"汇率"返回汇率信息
  - `programmatic` TR-3.2: 发送"usdt"返回汇率信息
  - `programmatic` TR-3.3: 汇率数据来自真实 API
- **Notes**: 当前返回硬编码数据

## [ ] Task 4: 添加调试日志
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 在 `handleNewChatMember` 添加详细日志
  - 记录配置读取结果
  - 记录 API 调用结果
  - 记录错误详情
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-4.1: 日志包含配置信息
  - `programmatic` TR-4.2: 日志包含 API 调用结果
- **Notes**: 帮助排查问题

## [x] Task 5: 验证数据库配置字段
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 检查 `group_configs` 表的 `verification_config` 字段
  - 确保前端保存的字段名与后端读取的一致
  - 添加默认值处理
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-5.1: 配置正确保存
  - `programmatic` TR-5.2: 配置正确读取
- **Notes**: 

## 任务依赖关系
```
Task 1 (setWebhook) ──┐
Task 2 (虚拟币检测) ──┼──> 可并行执行
Task 3 (汇率查询) ────┤
Task 4 (调试日志) ────┤
Task 5 (配置验证) ────┘
```

所有任务可并行执行，无依赖关系。

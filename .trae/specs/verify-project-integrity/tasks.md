# 项目完整性验证与修复 - 实现计划

## [x] Task 1: 修复积分系统实现
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 修复签到功能，从数据库读取配置并正确累加积分
  - 实现消息积分计算和累加
  - 修复排行榜数据查询
- **Acceptance Criteria Addressed**: AC-1
- **Test Requirements**:
  - `programmatic` TR-1.1: 签到后用户积分正确增加
  - `programmatic` TR-1.2: 发送消息后积分按配置计算
  - `programmatic` TR-1.3: 排行榜显示真实积分数据
- **Notes**: 当前签到返回随机值，需要连接数据库

## [x] Task 2: 实现刷屏检测与处理
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 在 handleGroupMessage 中添加刷屏检测逻辑
  - 记录用户消息时间戳
  - 超过阈值时执行惩罚
  - 实现重复消息检测
- **Acceptance Criteria Addressed**: AC-2
- **Test Requirements**:
  - `programmatic` TR-2.1: 短时间发送超过阈值消息触发惩罚
  - `programmatic` TR-2.2: 重复消息被检测
  - `programmatic` TR-2.3: 惩罚措施正确执行
- **Notes**: 需要在内存或数据库中记录用户消息频率

## [x] Task 3: 命令管理配置生效
- **Priority**: P0
- **Depends On**: None
- **Description**: 
  - 修改 handleCommand 从数据库读取命令配置
  - 根据配置启用/禁用命令
  - 实现命令消息自动删除
  - 支持自定义命令响应
- **Acceptance Criteria Addressed**: AC-3
- **Test Requirements**:
  - `programmatic` TR-3.1: 禁用的命令无响应
  - `programmatic` TR-3.2: 启用的命令正确响应
  - `programmatic` TR-3.3: 自动删除功能生效
- **Notes**: 当前命令响应都是硬编码的

## [x] Task 4: 广告过滤配置化
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 从 group_configs 读取广告关键词配置
  - 支持正则表达式匹配
  - 实现白名单用户跳过
  - 添加更多检测规则
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-4.1: 配置的关键词被正确检测
  - `programmatic` TR-4.2: 正则表达式匹配生效
  - `programmatic` TR-4.3: 白名单用户消息不被删除
- **Notes**: 当前使用硬编码关键词列表

## [ ] Task 5: 欢迎消息发送
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 在 handleNewChatMember 中添加欢迎消息发送
  - 从数据库读取欢迎消息配置
  - 支持变量替换（用户名、群名等）
- **Acceptance Criteria Addressed**: AC-8
- **Test Requirements**:
  - `programmatic` TR-5.1: 新成员入群收到欢迎消息
  - `programmatic` TR-5.2: 变量正确替换
  - `programmatic` TR-5.3: 可配置启用/禁用
- **Notes**: 当前入群验证已实现，但欢迎消息未发送

## [x] Task 6: 统计数据收集
- **Priority**: P1
- **Depends On**: None
- **Description**: 
  - 在 handleGroupMessage 中记录消息统计
  - 更新 chat_stats 表
  - 更新用户活跃状态
  - 追踪邀请关系
- **Acceptance Criteria Addressed**: AC-7
- **Test Requirements**:
  - `programmatic` TR-6.1: 每日消息数正确统计
  - `programmatic` TR-6.2: 活跃用户数正确统计
  - `programmatic` TR-6.3: 邀请关系正确追踪
- **Notes**: 需要在消息处理时更新统计表

## [ ] Task 7: 定时消息执行器
- **Priority**: P2
- **Depends On**: None
- **Description**: 
  - 创建定时任务检查 scheduled_messages 表
  - 发送到期消息
  - 更新消息状态
  - 处理周期性消息
- **Acceptance Criteria Addressed**: AC-5
- **Test Requirements**:
  - `programmatic` TR-7.1: 到期消息被发送
  - `programmatic` TR-7.2: 周期性消息重复发送
  - `programmatic` TR-7.3: 发送后状态更新
- **Notes**: Serverless 环境需要外部触发，可能需要 Vercel Cron 或外部服务

## [ ] Task 8: 抽奖系统实现
- **Priority**: P2
- **Depends On**: None
- **Description**: 
  - 实现参与抽奖逻辑
  - 实现开奖逻辑
  - 发送中奖通知
  - 更新抽奖状态
- **Acceptance Criteria Addressed**: AC-6
- **Test Requirements**:
  - `programmatic` TR-8.1: 用户可参与抽奖
  - `programmatic` TR-8.2: 开奖随机选择中奖者
  - `programmatic` TR-8.3: 中奖通知发送
- **Notes**: 需要定义参与方式

## [ ] Task 9: 自动删除功能
- **Priority**: P2
- **Depends On**: None
- **Description**: 
  - 实现自动删除配置读取
  - 按规则删除消息
  - 支持多种删除条件
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-9.1: 配置的删除规则生效
  - `programmatic` TR-9.2: 消息在指定时间后删除
- **Notes**: 

## [x] Task 10: 敏感词检测
- **Priority**: P2
- **Depends On**: None
- **Description**: 
  - 从数据库读取敏感词列表
  - 检测并处理包含敏感词的消息
  - 支持正则表达式
- **Acceptance Criteria Addressed**: AC-4
- **Test Requirements**:
  - `programmatic` TR-10.1: 敏感词被正确检测
  - `programmatic` TR-10.2: 处理措施正确执行
- **Notes**: 

## 任务依赖关系
```
Task 1 (积分系统) ─┐
Task 2 (刷屏检测) ─┼──> 可并行执行
Task 3 (命令管理) ─┤
Task 4 (广告过滤) ─┤
Task 5 (欢迎消息) ─┤
Task 6 (统计数据) ─┤
Task 7 (定时消息) ─┤
Task 8 (抽奖系统) ─┤
Task 9 (自动删除) ─┤
Task 10 (敏感词) ──┘
```

所有任务可并行执行，无依赖关系。

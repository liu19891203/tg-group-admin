# Tasks

- [ ] Task 1: 创建用户-群组关联表
  - [ ] SubTask 1.1: 在 database/schema.sql 中添加 user_group_relations 表定义
  - [ ] SubTask 1.2: 添加索引优化查询性能
  - [ ] SubTask 1.3: 在 Supabase 中执行表创建

- [ ] Task 2: 记录群组添加者信息
  - [ ] SubTask 2.1: 修改 handleBotAddedToGroup 函数，获取添加者 telegram_id
  - [ ] SubTask 2.2: 创建 createUserGroupRelation 函数，记录用户-群组关联
  - [ ] SubTask 2.3: 在机器人被添加时自动创建关联记录

- [ ] Task 3: 实现查询用户群组列表功能
  - [ ] SubTask 3.1: 创建 getUserGroups 函数，查询 user_group_relations 表
  - [ ] SubTask 3.2: 验证用户是否仍为群组管理员
  - [ ] SubTask 3.3: 返回格式化的群组列表数据

- [ ] Task 4: 实现私聊群组选择界面
  - [ ] SubTask 4.1: 创建 sendUserGroupsMenu 函数，生成群组列表键盘
  - [ ] SubTask 4.2: 添加 /mygroups 命令处理器
  - [ ] SubTask 4.3: 实现群组选择按钮的回调处理

- [ ] Task 5: 实现私聊中配置群组功能
  - [ ] SubTask 5.1: 修改 sendSettingsMenu 支持私聊模式（传入 group_chat_id）
  - [ ] SubTask 5.2: 修改 handleMenuCallback 支持私聊中的群组配置
  - [ ] SubTask 5.3: 确保所有配置修改都应用到正确的群组

- [ ] Task 6: 更新私聊消息处理
  - [ ] SubTask 6.1: 修改 handlePrivateMessage 识别群组配置上下文
  - [ ] SubTask 6.2: 添加返回群组列表的功能
  - [ ] SubTask 6.3: 测试私聊中的完整配置流程

# Task Dependencies
```
Task 1 (创建表) ──> Task 2 (记录添加者) ──> Task 3 (查询群组)
                                              ↓
Task 4 (群组选择界面) ──> Task 5 (私聊配置) ──> Task 6 (完整流程)
```

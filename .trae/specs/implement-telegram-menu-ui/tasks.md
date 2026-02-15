# Tasks

- [x] Task 1: 实现主菜单展示功能
  - [x] SubTask 1.1: 创建菜单数据结构，定义 20 个功能的配置信息
  - [x] SubTask 1.2: 实现 `sendSettingsMenu` 函数，生成 Inline Keyboard 布局
  - [x] SubTask 1.3: 添加 `/settings` 命令处理器，显示设置菜单
  - [x] SubTask 1.4: 从数据库读取各功能当前状态并显示

- [x] Task 2: 实现按钮交互处理
  - [x] SubTask 2.1: 扩展 `handleCallbackQuery` 处理菜单按钮点击
  - [x] SubTask 2.2: 实现初级功能的状态切换（开/关）
  - [x] SubTask 2.3: 实现中级和高级功能的子菜单导航
  - [x] SubTask 2.4: 实现返回按钮功能

- [x] Task 3: 实现权限验证
  - [x] SubTask 3.1: 添加管理员权限检查函数
  - [x] SubTask 3.2: 非管理员点击按钮时显示"无权限"提示
  - [x] SubTask 3.3: 验证群组管理员身份（使用 Telegram API）

- [x] Task 4: 实现功能状态持久化
  - [x] SubTask 4.1: 更新 `group_configs` 表，添加各功能开关字段
  - [x] SubTask 4.2: 实现功能状态读取函数
  - [x] SubTask 4.3: 实现功能状态更新函数
  - [x] SubTask 4.4: 菜单显示时实时反映当前状态

- [x] Task 5: 实现子菜单配置界面
  - [x] SubTask 5.1: 创建中级功能的配置子菜单模板
  - [x] SubTask 5.2: 创建高级功能的配置子菜单模板
  - [x] SubTask 5.3: 实现子菜单到主菜单的导航
  - [x] SubTask 5.4: 实现配置项的保存功能

# Task Dependencies
```
Task 1 (主菜单展示) ──┐
Task 4 (状态持久化) ──┼──> Task 2 (按钮交互) ──> Task 5 (子菜单)
Task 3 (权限验证) ────┘
```

-- 群组成员表
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    telegram_user_id BIGINT NOT NULL,              -- Telegram 用户ID
    username VARCHAR(100),                         -- 用户名
    nickname VARCHAR(200),                         -- 昵称
    role VARCHAR(20) DEFAULT 'member',             -- 角色: member, admin, owner
    
    joined_at TIMESTAMPTZ DEFAULT NOW(),           -- 加入时间
    updated_at TIMESTAMPTZ DEFAULT NOW(),          -- 更新时间
    
    CONSTRAINT unique_member UNIQUE (group_id, telegram_user_id)
);

-- 昵称变更历史表
CREATE TABLE IF NOT EXISTS nickname_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,              -- Telegram 用户ID
    
    old_nickname VARCHAR(200),                     -- 旧昵称
    new_nickname VARCHAR(200),                     -- 新昵称
    changed_at TIMESTAMPTZ DEFAULT NOW()           -- 变更时间
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_telegram_user_id ON group_members(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_role ON group_members(role);
CREATE INDEX IF NOT EXISTS idx_nickname_history_group_id ON nickname_history(group_id);
CREATE INDEX IF NOT EXISTS idx_nickname_history_user_id ON nickname_history(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_nickname_history_changed_at ON nickname_history(changed_at DESC);

-- 添加注释
COMMENT ON TABLE group_members IS '群组成员表';
COMMENT ON COLUMN group_members.role IS '成员角色: member-普通成员, admin-管理员, owner-群主';

COMMENT ON TABLE nickname_history IS '昵称变更历史表';

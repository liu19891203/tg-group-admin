-- 超级工具操作日志表
CREATE TABLE IF NOT EXISTS super_tools_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    action VARCHAR(50) NOT NULL,                   -- 操作类型: delete_history, kick_deleted_accounts, clean_inactive
    params JSONB DEFAULT '{}',                     -- 操作参数
    result JSONB DEFAULT '{}',                     -- 操作结果
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 修改 group_members 表添加新字段
ALTER TABLE group_members 
ADD COLUMN IF NOT EXISTS is_deleted_account BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT NOW();

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_super_tools_logs_group_id ON super_tools_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_super_tools_logs_action ON super_tools_logs(action);
CREATE INDEX IF NOT EXISTS idx_super_tools_logs_created_at ON super_tools_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_members_is_deleted ON group_members(is_deleted_account);
CREATE INDEX IF NOT EXISTS idx_group_members_last_activity ON group_members(last_activity_at);

-- 添加注释
COMMENT ON TABLE super_tools_logs IS '超级工具操作日志表';
COMMENT ON COLUMN group_members.is_deleted_account IS '是否为已删除账户';
COMMENT ON COLUMN group_members.last_activity_at IS '最后活跃时间';

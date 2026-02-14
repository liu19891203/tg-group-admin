-- 自动封禁规则表
CREATE TABLE IF NOT EXISTS auto_ban_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,                    -- 规则名称
    match_type VARCHAR(20) DEFAULT 'keyword',      -- 匹配类型: keyword, regex
    pattern TEXT NOT NULL,                         -- 匹配模式（关键词或正则表达式）
    action VARCHAR(20) NOT NULL,                   -- 操作: mute, ban, kick, warn, delete
    duration INTEGER DEFAULT 0,                    -- 禁言/封禁时长（秒），0为永久
    warning_message TEXT,                          -- 警告消息
    is_regex BOOLEAN DEFAULT false,                -- 是否使用正则匹配
    is_active BOOLEAN DEFAULT true,                -- 是否启用
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_auto_ban_rules_group_id ON auto_ban_rules(group_id);
CREATE INDEX IF NOT EXISTS idx_auto_ban_rules_is_active ON auto_ban_rules(is_active);

-- 添加注释
COMMENT ON TABLE auto_ban_rules IS '自动封禁规则表';
COMMENT ON COLUMN auto_ban_rules.match_type IS '匹配类型: keyword-关键词, regex-正则表达式';
COMMENT ON COLUMN auto_ban_rules.action IS '操作类型: mute-禁言, ban-封禁, kick-踢出, warn-警告, delete-删除消息';
COMMENT ON COLUMN auto_ban_rules.duration IS '惩罚时长（秒），0表示永久';

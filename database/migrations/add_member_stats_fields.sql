-- 为 group_members 表添加统计字段
-- PostgreSQL with Supabase

-- 添加 last_message_at 字段
ALTER TABLE group_members 
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

-- 添加 message_count 字段
ALTER TABLE group_members 
ADD COLUMN IF NOT EXISTS message_count INTEGER DEFAULT 0;

-- 添加索引以优化查询
CREATE INDEX IF NOT EXISTS idx_group_members_last_message ON group_members(last_message_at DESC);

-- 添加注释
COMMENT ON COLUMN group_members.last_message_at IS '最后发言时间';
COMMENT ON COLUMN group_members.message_count IS '消息总数';

-- 群组关联频道设置表
CREATE TABLE IF NOT EXISTS channel_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    channel_id BIGINT,                             -- 频道ID
    channel_name VARCHAR(200),                     -- 频道名称
    is_linked BOOLEAN DEFAULT false,               -- 是否已关联
    
    -- 取消置顶设置
    auto_unpin BOOLEAN DEFAULT false,              -- 自动取消置顶
    unpin_delay_seconds INTEGER DEFAULT 0,         -- 取消置顶延迟（秒）
    
    -- 评论区设置
    capture_comments BOOLEAN DEFAULT false,        -- 抢占评论区
    comment_keywords TEXT[] DEFAULT '{}',          -- 评论关键词
    auto_reply_comments BOOLEAN DEFAULT false,     -- 自动回复评论
    comment_reply_template TEXT,                   -- 评论回复模板
    
    -- 其他设置
    delete_channel_messages BOOLEAN DEFAULT false, -- 删除频道消息
    notify_on_link BOOLEAN DEFAULT false,          -- 关联时通知
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_group_channel UNIQUE (group_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_channel_settings_group_id ON channel_settings(group_id);
CREATE INDEX IF NOT EXISTS idx_channel_settings_channel_id ON channel_settings(channel_id);

-- 添加注释
COMMENT ON TABLE channel_settings IS '群组关联频道设置表';
COMMENT ON COLUMN channel_settings.capture_comments IS '是否抢占评论区（自动回复频道消息）';

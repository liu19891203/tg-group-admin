-- 频道转发设置表（支持多频道关联）
CREATE TABLE IF NOT EXISTS channel_forward_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    -- 频道信息
    channel_id BIGINT NOT NULL,                    -- 频道ID (-100开头)
    channel_name VARCHAR(200),                     -- 频道名称
    channel_username VARCHAR(100),                 -- 频道用户名（公开频道）
    
    -- 转发设置
    is_active BOOLEAN DEFAULT true,                -- 是否启用转发
    forward_mode VARCHAR(20) DEFAULT 'all',        -- 转发模式：all(全部), text(仅文字), media(仅媒体)
    
    -- 置顶设置
    auto_pin BOOLEAN DEFAULT false,                -- 自动置顶转发消息
    pin_duration_minutes INTEGER DEFAULT 60,       -- 置顶持续时间（分钟），0为不自动取消
    
    -- 消息处理
    include_author BOOLEAN DEFAULT true,           -- 显示原作者
    include_source BOOLEAN DEFAULT true,           -- 显示来源频道
    custom_header TEXT,                            -- 自定义头部文本
    custom_footer TEXT,                            -- 自定义尾部文本
    
    -- 过滤设置
    exclude_keywords TEXT[] DEFAULT '{}',          -- 排除关键词（包含则不转发）
    include_keywords TEXT[] DEFAULT '{}',          -- 包含关键词（必须包含才转发，为空则不限制）
    
    -- 通知设置
    notify_on_forward BOOLEAN DEFAULT false,       -- 转发时通知
    notify_template TEXT,                          -- 通知模板
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_group_channel UNIQUE (group_id, channel_id)
);

-- 置顶消息记录表（用于定时取消置顶）
CREATE TABLE IF NOT EXISTS pinned_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    channel_id BIGINT NOT NULL,                    -- 来源频道ID
    message_id INTEGER NOT NULL,                   -- 群组中的消息ID
    channel_message_id INTEGER NOT NULL,           -- 频道中的原始消息ID
    pinned_at TIMESTAMPTZ DEFAULT NOW(),           -- 置顶时间
    unpin_at TIMESTAMPTZ,                          -- 计划取消置顶时间
    is_unpinned BOOLEAN DEFAULT false,             -- 是否已取消置顶
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 转发日志表
CREATE TABLE IF NOT EXISTS forward_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    channel_id BIGINT NOT NULL,                    -- 来源频道ID
    channel_message_id INTEGER NOT NULL,           -- 频道消息ID
    group_message_id INTEGER NOT NULL,             -- 转发到群组的消息ID
    message_type VARCHAR(50),                      -- 消息类型：text, photo, video, etc.
    status VARCHAR(20) DEFAULT 'success',          -- 状态：success, failed, filtered
    error_message TEXT,                            -- 错误信息（如果失败）
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_channel_forward_group_id ON channel_forward_settings(group_id);
CREATE INDEX IF NOT EXISTS idx_channel_forward_channel_id ON channel_forward_settings(channel_id);
CREATE INDEX IF NOT EXISTS idx_pinned_messages_group_id ON pinned_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_pinned_messages_unpin_at ON pinned_messages(unpin_at) WHERE is_unpinned = false;
CREATE INDEX IF NOT EXISTS idx_forward_logs_group_id ON forward_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_forward_logs_created_at ON forward_logs(created_at);

-- 添加注释
COMMENT ON TABLE channel_forward_settings IS '群组关联频道转发设置表（支持多频道）';
COMMENT ON TABLE pinned_messages IS '置顶消息记录表（用于定时取消置顶）';
COMMENT ON TABLE forward_logs IS '消息转发日志表';
COMMENT ON COLUMN channel_forward_settings.forward_mode IS '转发模式：all(全部), text(仅文字), media(仅媒体)';
COMMENT ON COLUMN channel_forward_settings.pin_duration_minutes IS '置顶持续时间（分钟），0表示不自动取消置顶';

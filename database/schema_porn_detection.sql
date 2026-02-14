-- 色情内容检测配置表
CREATE TABLE IF NOT EXISTS porn_detection_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    enabled BOOLEAN DEFAULT false,                 -- 是否启用
    sensitivity VARCHAR(20) DEFAULT 'medium',      -- 灵敏度: low, medium, high
    delete_delay_seconds INTEGER DEFAULT 0,        -- 延迟删除时间（秒）
    action VARCHAR(20) DEFAULT 'delete',           -- 处理方式: delete, mute, ban, warn
    mute_duration INTEGER DEFAULT 3600,            -- 禁言时长（秒）
    
    check_images BOOLEAN DEFAULT true,             -- 检测图片
    check_videos BOOLEAN DEFAULT true,             -- 检测视频
    check_stickers BOOLEAN DEFAULT true,           -- 检测贴纸
    check_documents BOOLEAN DEFAULT false,         -- 检测文档
    
    warning_message TEXT DEFAULT '检测到违规内容，消息已被删除。',
    whitelist_users JSONB DEFAULT '[]',            -- 白名单用户ID列表
    notify_admins BOOLEAN DEFAULT true,            -- 通知管理员
    log_only BOOLEAN DEFAULT false,                -- 仅记录不删除
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(group_id)
);

-- 色情内容检测日志表
CREATE TABLE IF NOT EXISTS porn_detection_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    telegram_user_id BIGINT NOT NULL,              -- 用户ID
    telegram_chat_id BIGINT NOT NULL,              -- 群组ID
    telegram_message_id BIGINT NOT NULL,           -- 消息ID
    
    content_type VARCHAR(50) NOT NULL,             -- 内容类型: image, video, sticker, document
    detection_score FLOAT,                         -- 检测分数 (0-1)
    sensitivity_level VARCHAR(20),                 -- 触发的灵敏度级别
    
    action_taken VARCHAR(50),                      -- 执行的操作
    action_result JSONB,                           -- 操作结果
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_porn_detection_configs_group_id ON porn_detection_configs(group_id);
CREATE INDEX IF NOT EXISTS idx_porn_detection_logs_group_id ON porn_detection_logs(group_id);
CREATE INDEX IF NOT EXISTS idx_porn_detection_logs_user_id ON porn_detection_logs(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_porn_detection_logs_created_at ON porn_detection_logs(created_at DESC);

-- 添加注释
COMMENT ON TABLE porn_detection_configs IS '色情内容检测配置表';
COMMENT ON TABLE porn_detection_logs IS '色情内容检测日志表';

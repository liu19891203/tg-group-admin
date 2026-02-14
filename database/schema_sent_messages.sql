-- 已发送消息记录表
CREATE TABLE IF NOT EXISTS sent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    text TEXT NOT NULL,                            -- 消息内容
    parse_mode VARCHAR(20) DEFAULT 'HTML',         -- 解析模式: HTML, Markdown, MarkdownV2
    disable_notification BOOLEAN DEFAULT false,    -- 是否静默发送
    
    telegram_message_id BIGINT,                    -- Telegram 消息ID
    status VARCHAR(20) DEFAULT 'sent',             -- 状态: sent, failed, deleted
    error_message TEXT,                            -- 错误信息（如果发送失败）
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_sent_messages_group_id ON sent_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_sent_messages_created_at ON sent_messages(created_at DESC);

-- 添加注释
COMMENT ON TABLE sent_messages IS '主动发送消息记录表';
COMMENT ON COLUMN sent_messages.status IS '消息状态: sent-已发送, failed-发送失败, deleted-已删除';

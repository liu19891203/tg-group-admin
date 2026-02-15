-- 待删除消息表（用于延迟删除功能）
CREATE TABLE IF NOT EXISTS pending_delete_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    delete_at TIMESTAMPTZ NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_pending_delete UNIQUE (chat_id, message_id)
);

-- 创建索引以加速查询
CREATE INDEX IF NOT EXISTS idx_pending_delete_messages_delete_at ON pending_delete_messages(delete_at);
CREATE INDEX IF NOT EXISTS idx_pending_delete_messages_chat_id ON pending_delete_messages(chat_id);

-- 添加注释
COMMENT ON TABLE pending_delete_messages IS '待删除消息表 - 用于存储需要延迟删除的消息';
COMMENT ON COLUMN pending_delete_messages.chat_id IS 'Telegram 群组/频道 ID';
COMMENT ON COLUMN pending_delete_messages.message_id IS 'Telegram 消息 ID';
COMMENT ON COLUMN pending_delete_messages.delete_at IS '计划删除时间';
COMMENT ON COLUMN pending_delete_messages.reason IS '删除原因（如 command, media, link 等）';

-- 创建自动清理过期记录的函数（删除超过 24 小时的记录）
CREATE OR REPLACE FUNCTION cleanup_old_pending_deletes()
RETURNS void AS $$
BEGIN
    DELETE FROM pending_delete_messages 
    WHERE delete_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- 创建处理待删除消息的函数
CREATE OR REPLACE FUNCTION get_pending_delete_messages(batch_size INTEGER DEFAULT 100)
RETURNS TABLE (
    id UUID,
    chat_id BIGINT,
    message_id BIGINT,
    reason VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT pending_delete_messages.id, 
           pending_delete_messages.chat_id, 
           pending_delete_messages.message_id,
           pending_delete_messages.reason
    FROM pending_delete_messages
    WHERE pending_delete_messages.delete_at <= NOW()
    ORDER BY pending_delete_messages.delete_at ASC
    LIMIT batch_size;
END;
$$ LANGUAGE plpgsql;

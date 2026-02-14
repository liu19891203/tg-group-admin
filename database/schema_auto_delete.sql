-- 自动删除配置表
CREATE TABLE IF NOT EXISTS auto_delete_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    -- 总开关
    enabled BOOLEAN DEFAULT false,
    
    -- 消息类型删除配置
    delete_porn_images BOOLEAN DEFAULT false,           -- 色情图片
    delete_external_replies BOOLEAN DEFAULT false,      -- 外部回复
    delete_service_messages BOOLEAN DEFAULT false,      -- 服务消息
    delete_channel_forward BOOLEAN DEFAULT false,       -- 频道马甲
    delete_links BOOLEAN DEFAULT false,                 -- 链接消息
    delete_long_messages BOOLEAN DEFAULT false,         -- 超长消息
    delete_video_messages BOOLEAN DEFAULT false,        -- 视频消息
    delete_stickers BOOLEAN DEFAULT false,              -- 贴纸消息
    delete_forwards BOOLEAN DEFAULT false,              -- 禁止转发
    delete_archives BOOLEAN DEFAULT false,              -- 压缩包
    delete_executables BOOLEAN DEFAULT false,           -- 可执行文件
    delete_documents BOOLEAN DEFAULT false,             -- 文档
    delete_bot_commands BOOLEAN DEFAULT false,          -- 其他机器人命令
    delete_ad_stickers BOOLEAN DEFAULT false,           -- 广告贴纸
    delete_all_messages BOOLEAN DEFAULT false,          -- 全部消息
    delete_premium_emojis BOOLEAN DEFAULT false,        -- 会员表情
    delete_contacts BOOLEAN DEFAULT false,              -- 分享联系人
    
    -- 配置参数
    long_message_threshold INTEGER DEFAULT 1000,        -- 超长消息阈值（字符数）
    custom_keywords TEXT[] DEFAULT '{}',                -- 自定义关键词
    delete_delay_seconds INTEGER DEFAULT 0,             -- 删除延迟（秒）
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_group_auto_delete UNIQUE (group_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_auto_delete_configs_group_id ON auto_delete_configs(group_id);

-- 添加注释
COMMENT ON TABLE auto_delete_configs IS '自动删除配置表';
COMMENT ON COLUMN auto_delete_configs.delete_porn_images IS '删除色情图片';
COMMENT ON COLUMN auto_delete_configs.delete_external_replies IS '删除外部回复消息';
COMMENT ON COLUMN auto_delete_configs.delete_service_messages IS '删除服务消息（如加入/离开通知）';
COMMENT ON COLUMN auto_delete_configs.delete_channel_forward IS '删除频道转发消息';
COMMENT ON COLUMN auto_delete_configs.delete_links IS '删除包含链接的消息';
COMMENT ON COLUMN auto_delete_configs.delete_long_messages IS '删除超长消息';
COMMENT ON COLUMN auto_delete_configs.delete_video_messages IS '删除视频消息';
COMMENT ON COLUMN auto_delete_configs.delete_stickers IS '删除贴纸消息';
COMMENT ON COLUMN auto_delete_configs.delete_forwards IS '删除转发消息';
COMMENT ON COLUMN auto_delete_configs.delete_archives IS '删除压缩包文件';
COMMENT ON COLUMN auto_delete_configs.delete_executables IS '删除可执行文件';
COMMENT ON COLUMN auto_delete_configs.delete_documents IS '删除文档文件';
COMMENT ON COLUMN auto_delete_configs.delete_bot_commands IS '删除其他机器人的命令';
COMMENT ON COLUMN auto_delete_configs.delete_ad_stickers IS '删除广告贴纸';
COMMENT ON COLUMN auto_delete_configs.delete_all_messages IS '删除所有消息（慎用）';
COMMENT ON COLUMN auto_delete_configs.delete_premium_emojis IS '删除会员表情';
COMMENT ON COLUMN auto_delete_configs.delete_contacts IS '删除分享联系人';

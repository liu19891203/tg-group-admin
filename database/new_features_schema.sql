-- ============================================
-- 新功能数据库扩展脚本
-- 包含警告、禁言、活跃度、娱乐、NSFW检测、语言白名单
-- ============================================

-- ============================================
-- 1. 警告系统表
-- ============================================

CREATE TABLE IF NOT EXISTS user_warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    reason TEXT NOT NULL,
    warned_by BIGINT NOT NULL,
    warn_count INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_warnings_telegram ON user_warnings(telegram_id);
CREATE INDEX IF NOT EXISTS idx_user_warnings_chat ON user_warnings(chat_id);
CREATE INDEX IF NOT EXISTS idx_user_warnings_active ON user_warnings(is_active, expires_at);

-- ============================================
-- 2. 禁言系统表
-- ============================================

CREATE TABLE IF NOT EXISTS user_mutes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    muted_by BIGINT NOT NULL,
    duration INTEGER NOT NULL,
    reason TEXT,
    mute_type VARCHAR(50) DEFAULT 'manual',
    unmuted_at TIMESTAMPTZ,
    unmuted_by BIGINT,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_mutes_telegram ON user_mutes(telegram_id);
CREATE INDEX IF NOT EXISTS idx_user_mutes_chat ON user_mutes(chat_id);
CREATE INDEX IF NOT EXISTS idx_user_mutes_active ON user_mutes(is_active, expires_at);

-- ============================================
-- 3. 活跃度统计表
-- ============================================

CREATE TABLE IF NOT EXISTS activity_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    activity_date DATE NOT NULL,
    activity_hour INTEGER,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_activity_record UNIQUE (group_id, telegram_id, activity_date, activity_type)
);

CREATE INDEX IF NOT EXISTS idx_activity_records_telegram ON activity_records(telegram_id);
CREATE INDEX IF NOT EXISTS idx_activity_records_group ON activity_records(group_id);
CREATE INDEX IF NOT EXISTS idx_activity_records_date ON activity_records(activity_date);
CREATE INDEX IF NOT EXISTS idx_activity_records_type ON activity_records(activity_type);

-- ============================================
-- 4. 游戏记录表
-- ============================================

CREATE TABLE IF NOT EXISTS game_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    game_type VARCHAR(50) NOT NULL,
    result VARCHAR(20) NOT NULL,
    points_change INTEGER DEFAULT 0,
    game_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_records_telegram ON game_records(telegram_id);
CREATE INDEX IF NOT EXISTS idx_game_records_group ON game_records(group_id);
CREATE INDEX IF NOT EXISTS idx_game_records_type ON game_records(game_type);
CREATE INDEX IF NOT EXISTS idx_game_records_created ON game_records(created_at DESC);

-- ============================================
-- 5. NSFW检测记录表
-- ============================================

CREATE TABLE IF NOT EXISTS nsfw_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    file_type VARCHAR(50),
    file_id VARCHAR(255),
    is_nsfw BOOLEAN DEFAULT false,
    confidence DECIMAL(5,4) DEFAULT 0,
    categories JSONB DEFAULT '{}'::jsonb,
    provider VARCHAR(50),
    action_taken VARCHAR(50) DEFAULT 'none',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nsfw_detections_telegram ON nsfw_detections(telegram_id);
CREATE INDEX IF NOT EXISTS idx_nsfw_detections_group ON nsfw_detections(group_id);
CREATE INDEX IF NOT EXISTS idx_nsfw_detections_nsfw ON nsfw_detections(is_nsfw);
CREATE INDEX IF NOT EXISTS idx_nsfw_detections_created ON nsfw_detections(created_at DESC);

-- ============================================
-- 6. 语言检测记录表
-- ============================================

CREATE TABLE IF NOT EXISTS language_detections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    chat_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    message_text TEXT,
    detected_language VARCHAR(20),
    confidence DECIMAL(5,4) DEFAULT 0,
    is_allowed BOOLEAN DEFAULT true,
    provider VARCHAR(50),
    action_taken VARCHAR(50) DEFAULT 'none',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_language_detections_telegram ON language_detections(telegram_id);
CREATE INDEX IF NOT EXISTS idx_language_detections_group ON language_detections(group_id);
CREATE INDEX IF NOT EXISTS idx_language_detections_allowed ON language_detections(is_allowed);
CREATE INDEX IF NOT EXISTS idx_language_detections_created ON language_detections(created_at DESC);

-- ============================================
-- 7. 更新 group_configs 表添加新配置字段
-- ============================================

ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS warn_config JSONB DEFAULT '{
    "enabled": false,
    "max_warns": 3,
    "warn_expiry_hours": 24,
    "punishment": "mute",
    "mute_duration": 3600,
    "warn_message": "⚠️ {user} 已被警告 ({count}/{max})\n原因: {reason}",
    "max_warn_message": "🚫 {user} 达到警告上限 ({count}/{max})，已执行处罚",
    "auto_reset": true,
    "notify_admins": false
}'::jsonb;

ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS mute_config JSONB DEFAULT '{
    "enabled": true,
    "default_duration": 300,
    "max_duration": 86400,
    "allow_custom_duration": true,
    "mute_message": "🔇 {user} 已被禁言 {duration}\n原因: {reason}",
    "unmute_message": "🔊 {user} 已被解除禁言",
    "log_mutes": true,
    "notify_user": true,
    "progressive_mute": false,
    "progressive_durations": [300, 900, 3600, 86400, 604800]
}'::jsonb;

ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS activity_config JSONB DEFAULT '{
    "enabled": true,
    "track_messages": true,
    "track_media": true,
    "track_commands": true,
    "track_reactions": false,
    "leaderboard_enabled": true,
    "leaderboard_size": 10,
    "inactive_threshold_days": 7,
    "stats_retention_days": 90
}'::jsonb;

ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS entertainment_config JSONB DEFAULT '{
    "enabled": true,
    "points_reward": 50,
    "points_cost": 10,
    "cooldown_seconds": 30,
    "max_games_per_day": 50,
    "leaderboard_enabled": true
}'::jsonb;

ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS nsfw_config JSONB DEFAULT '{
    "enabled": false,
    "provider": "deepai",
    "threshold": 0.7,
    "action": "delete",
    "warn_threshold": 3,
    "mute_duration": 3600,
    "log_detections": true,
    "notify_admins": false,
    "check_photos": true,
    "check_videos": true,
    "check_documents": true,
    "whitelist_users": []
}'::jsonb;

ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS language_whitelist_config JSONB DEFAULT '{
    "enabled": false,
    "allowed_languages": ["zh", "en"],
    "detection_method": "local",
    "confidence_threshold": 0.7,
    "action": "delete",
    "warn_message": "⚠️ {user} 请使用允许的语言\n检测到语言: {language}\n允许的语言: {allowed}\n警告次数: {count}/{max}",
    "mute_duration": 3600,
    "max_warnings": 3,
    "whitelist_users": [],
    "whitelist_commands": true,
    "min_message_length": 3
}'::jsonb;

-- ============================================
-- 8. 创建清理函数
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_warnings()
RETURNS void AS $$
BEGIN
    UPDATE user_warnings 
    SET is_active = false 
    WHERE is_active = true 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_mutes()
RETURNS void AS $$
BEGIN
    UPDATE user_mutes 
    SET is_active = false 
    WHERE is_active = true 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_activity_records(retention_days INTEGER DEFAULT 90)
RETURNS void AS $$
BEGIN
    DELETE FROM activity_records 
    WHERE activity_date < CURRENT_DATE - retention_days;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_old_game_records(retention_days INTEGER DEFAULT 30)
RETURNS void AS $$
BEGIN
    DELETE FROM game_records 
    WHERE created_at < NOW() - (retention_days || ' days')::interval;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 9. 创建统计视图
-- ============================================

CREATE OR REPLACE VIEW user_activity_summary AS
SELECT 
    ar.telegram_id,
    ar.group_id,
    COUNT(DISTINCT ar.activity_date) as active_days,
    COUNT(CASE WHEN ar.activity_type = 'message' THEN 1 END) as message_count,
    COUNT(CASE WHEN ar.activity_type = 'media' THEN 1 END) as media_count,
    COUNT(CASE WHEN ar.activity_type = 'command' THEN 1 END) as command_count,
    MAX(ar.activity_date) as last_active
FROM activity_records ar
GROUP BY ar.telegram_id, ar.group_id;

CREATE OR REPLACE VIEW group_activity_summary AS
SELECT 
    ar.group_id,
    ar.activity_date,
    COUNT(DISTINCT ar.telegram_id) as active_users,
    COUNT(CASE WHEN ar.activity_type = 'message' THEN 1 END) as message_count,
    COUNT(CASE WHEN ar.activity_type = 'media' THEN 1 END) as media_count
FROM activity_records ar
GROUP BY ar.group_id, ar.activity_date
ORDER BY ar.activity_date DESC;

CREATE OR REPLACE VIEW game_leaderboard AS
SELECT 
    gr.telegram_id,
    gr.group_id,
    COUNT(*) as total_games,
    COUNT(CASE WHEN gr.result = 'win' THEN 1 END) as wins,
    COUNT(CASE WHEN gr.result = 'lose' THEN 1 END) as losses,
    SUM(gr.points_change) as total_points
FROM game_records gr
GROUP BY gr.telegram_id, gr.group_id
ORDER BY total_points DESC;

-- ============================================
-- 10. 创建触发器
-- ============================================

CREATE TRIGGER update_user_warnings_updated_at BEFORE UPDATE ON user_warnings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 初始化完成
-- ============================================

SELECT 'New features database extension completed successfully!' as status;

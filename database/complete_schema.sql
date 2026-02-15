-- ============================================
-- 完整的数据库初始化脚本
-- 包含所有表的删除和重新创建
-- 超级管理员 Telegram ID: 7136882977
-- ============================================

-- 禁用外键检查（删除表时使用）
SET session_replication_role = 'replica';

-- ============================================
-- 1. 删除所有表（按依赖关系倒序）
-- ============================================

DROP TABLE IF EXISTS login_codes CASCADE;
DROP TABLE IF EXISTS user_group_relations CASCADE;
DROP TABLE IF EXISTS pending_delete_messages CASCADE;
DROP TABLE IF EXISTS user_invite_links CASCADE;
DROP TABLE IF EXISTS invite_records CASCADE;
DROP TABLE IF EXISTS invite_leaderboard_config CASCADE;
DROP TABLE IF EXISTS invite_verification_rules CASCADE;
DROP TABLE IF EXISTS invite_leaderboard_history CASCADE;
DROP TABLE IF EXISTS channel_forward_settings CASCADE;
DROP TABLE IF EXISTS pinned_messages CASCADE;
DROP TABLE IF EXISTS forward_logs CASCADE;
DROP TABLE IF EXISTS group_admins CASCADE;
DROP TABLE IF EXISTS permission_templates CASCADE;
DROP TABLE IF EXISTS porn_detection_configs CASCADE;
DROP TABLE IF EXISTS porn_detection_logs CASCADE;
DROP TABLE IF EXISTS super_tools_logs CASCADE;
DROP TABLE IF EXISTS channel_settings CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS nickname_history CASCADE;
DROP TABLE IF EXISTS sent_messages CASCADE;
DROP TABLE IF EXISTS auto_ban_rules CASCADE;
DROP TABLE IF EXISTS auto_delete_configs CASCADE;
DROP TABLE IF EXISTS operation_logs CASCADE;
DROP TABLE IF EXISTS account_change_history CASCADE;
DROP TABLE IF EXISTS verification_records CASCADE;
DROP TABLE IF EXISTS verified_users CASCADE;
DROP TABLE IF EXISTS verified_levels CASCADE;
DROP TABLE IF EXISTS verified_messages CASCADE;
DROP TABLE IF EXISTS lottery_participants CASCADE;
DROP TABLE IF EXISTS lotteries CASCADE;
DROP TABLE IF EXISTS scheduled_messages CASCADE;
DROP TABLE IF EXISTS points_history CASCADE;
DROP TABLE IF EXISTS user_points CASCADE;
DROP TABLE IF EXISTS keywords CASCADE;
DROP TABLE IF EXISTS group_configs CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS admins CASCADE;

-- 重新启用外键检查
SET session_replication_role = 'origin';

-- ============================================
-- 2. 创建核心表
-- ============================================

-- Admins table (管理员表)
CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE,
    username VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    display_name VARCHAR(255),
    level INTEGER DEFAULT 0,
    permissions JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_admins_telegram ON admins(telegram_id);
CREATE INDEX idx_admins_username ON admins(username);

COMMENT ON COLUMN admins.level IS '权限等级: 0=普通用户, 5=群组管理员, 10=超级管理员';

-- Groups table (群组表)
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id BIGINT UNIQUE NOT NULL,
    chat_type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    username VARCHAR(255),
    description TEXT,
    member_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_groups_chat_id ON groups(chat_id);
CREATE INDEX idx_groups_active ON groups(is_active);

-- Users table (用户表)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    language_code VARCHAR(10),
    is_bot BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_telegram ON users(telegram_id);

-- Group configs table (群组配置表)
CREATE TABLE group_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    -- 功能开关字段（与 Telegram 菜单同步）
    -- 初级功能
    verification_enabled BOOLEAN DEFAULT false,
    welcome_enabled BOOLEAN DEFAULT false,
    auto_reply_enabled BOOLEAN DEFAULT false,
    auto_delete_enabled BOOLEAN DEFAULT false,
    auto_ban_enabled BOOLEAN DEFAULT false,
    auto_warn_enabled BOOLEAN DEFAULT false,
    auto_mute_enabled BOOLEAN DEFAULT false,
    flood_control_enabled BOOLEAN DEFAULT false,
    ad_block_enabled BOOLEAN DEFAULT false,
    command_disable_enabled BOOLEAN DEFAULT false,
    
    -- 中级功能
    crypto_enabled BOOLEAN DEFAULT false,
    members_enabled BOOLEAN DEFAULT false,
    scheduled_msg_enabled BOOLEAN DEFAULT false,
    points_enabled BOOLEAN DEFAULT false,
    activity_stats_enabled BOOLEAN DEFAULT false,
    entertainment_enabled BOOLEAN DEFAULT false,
    usdt_price_enabled BOOLEAN DEFAULT false,
    channel_link_enabled BOOLEAN DEFAULT false,
    
    -- 高级功能
    admin_perms_enabled BOOLEAN DEFAULT false,
    nsfw_detection_enabled BOOLEAN DEFAULT false,
    language_whitelist_enabled BOOLEAN DEFAULT false,
    invite_links_enabled BOOLEAN DEFAULT false,
    lottery_enabled BOOLEAN DEFAULT false,
    verified_users_enabled BOOLEAN DEFAULT false,
    
    -- 详细配置对象
    welcome_config JSONB DEFAULT '{}'::jsonb,
    verification_config JSONB DEFAULT '{}'::jsonb,
    anti_ads_config JSONB DEFAULT '{}'::jsonb,
    auto_reply_config JSONB DEFAULT '{}'::jsonb,
    auto_delete_config JSONB DEFAULT '{}'::jsonb,
    anti_spam_config JSONB DEFAULT '{}'::jsonb,
    points_config JSONB DEFAULT '{}'::jsonb,
    commands_config JSONB DEFAULT '{}'::jsonb,
    crypto_config JSONB DEFAULT '{}'::jsonb,
    
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_group_config UNIQUE (group_id)
);

CREATE INDEX idx_group_configs_group ON group_configs(group_id);

-- Keywords table (关键词表)
CREATE TABLE keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    keyword VARCHAR(255) NOT NULL,
    response TEXT NOT NULL,
    is_regex BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES admins(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_keywords_group ON keywords(group_id);
CREATE INDEX idx_keywords_active ON keywords(is_active);

-- User points table (用户积分表)
CREATE TABLE user_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    checkin_count INTEGER DEFAULT 0,
    last_checkin_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_user_group_points UNIQUE (user_id, group_id)
);

CREATE INDEX idx_user_points_user ON user_points(user_id);
CREATE INDEX idx_user_points_group ON user_points(group_id);

-- Points history table (积分历史表)
CREATE TABLE points_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    points INTEGER NOT NULL,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_points_history_user ON points_history(user_id);
CREATE INDEX idx_points_history_group ON points_history(group_id);

-- Scheduled messages table (定时消息表)
CREATE TABLE scheduled_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    created_by UUID REFERENCES admins(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_messages_group ON scheduled_messages(group_id);
CREATE INDEX idx_scheduled_messages_time ON scheduled_messages(scheduled_at);

-- Lotteries table (抽奖表)
CREATE TABLE lotteries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    prize TEXT NOT NULL,
    winner_count INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'active',
    end_at TIMESTAMPTZ,
    created_by UUID REFERENCES admins(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lotteries_group ON lotteries(group_id);
CREATE INDEX idx_lotteries_status ON lotteries(status);

-- Lottery participants table (抽奖参与者表)
CREATE TABLE lottery_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lottery_id UUID NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_winner BOOLEAN DEFAULT false,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_lottery_user UNIQUE (lottery_id, user_id)
);

CREATE INDEX idx_lottery_participants_lottery ON lottery_participants(lottery_id);

-- Verified users table (认证用户表)
CREATE TABLE verified_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    level INTEGER DEFAULT 1,
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    verified_by UUID REFERENCES admins(id),
    
    CONSTRAINT unique_verified_user UNIQUE (user_id, group_id)
);

CREATE INDEX idx_verified_users_user ON verified_users(user_id);
CREATE INDEX idx_verified_users_group ON verified_users(group_id);

-- Verified levels config table (认证等级配置表)
CREATE TABLE verified_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    level INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL,
    badge VARCHAR(50),
    color VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_group_level UNIQUE (group_id, level)
);

CREATE INDEX idx_verified_levels_group ON verified_levels(group_id);

-- Verified messages config table (认证回复消息配置表)
CREATE TABLE verified_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    unverified_message TEXT,
    unverified_message_html TEXT,
    verified_message TEXT,
    verified_message_html TEXT,
    include_level_1 BOOLEAN DEFAULT true,
    include_level_2 BOOLEAN DEFAULT true,
    include_level_3 BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_group_messages UNIQUE (group_id)
);

CREATE INDEX idx_verified_messages_group ON verified_messages(group_id);

-- Verification records table (验证记录表)
CREATE TABLE verification_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending',
    challenge_type VARCHAR(50),
    challenge_data JSONB,
    answer TEXT,
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_verification_records_telegram ON verification_records(telegram_id);
CREATE INDEX idx_verification_records_group ON verification_records(group_id);

-- Account change history table (账号变更历史表)
CREATE TABLE account_change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL,
    old_value VARCHAR(255),
    new_value VARCHAR(255),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_account_changes_user ON account_change_history(user_id);
CREATE INDEX idx_account_changes_group ON account_change_history(group_id);

-- Operation logs table (操作日志表)
CREATE TABLE operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES admins(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id UUID,
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_operation_logs_admin ON operation_logs(admin_id, created_at DESC);

-- ============================================
-- 3. 创建扩展功能表
-- ============================================

-- Login verification codes table (登录验证码表)
CREATE TABLE login_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    code VARCHAR(6) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    used BOOLEAN DEFAULT false,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_login_codes_telegram ON login_codes(telegram_id);
CREATE INDEX idx_login_codes_expires ON login_codes(expires_at);
CREATE INDEX idx_login_codes_code ON login_codes(code, telegram_id) WHERE used = false;

-- User-Group Relations table (用户-群组关联表)
CREATE TABLE user_group_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_telegram_id BIGINT NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    group_chat_id BIGINT NOT NULL,
    group_title TEXT,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT unique_user_group_relation UNIQUE (user_telegram_id, group_chat_id)
);

CREATE INDEX idx_user_relations ON user_group_relations(user_telegram_id);
CREATE INDEX idx_group_relations ON user_group_relations(group_chat_id);
CREATE INDEX idx_user_group_active ON user_group_relations(user_telegram_id, is_active);

-- Pending delete messages table (待删除消息表)
CREATE TABLE pending_delete_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    delete_at TIMESTAMPTZ NOT NULL,
    reason VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_pending_delete UNIQUE (chat_id, message_id)
);

CREATE INDEX idx_pending_delete_messages_delete_at ON pending_delete_messages(delete_at);
CREATE INDEX idx_pending_delete_messages_chat_id ON pending_delete_messages(chat_id);

-- Invite stats tables (邀请统计表)
CREATE TABLE user_invite_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    invite_link VARCHAR(500) NOT NULL,
    invite_code VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_group_invite UNIQUE (user_id, group_id)
);

CREATE INDEX idx_user_invite_links_user ON user_invite_links(user_id);
CREATE INDEX idx_user_invite_links_group ON user_invite_links(group_id);

CREATE TABLE invite_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    invite_code VARCHAR(100),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_invite_record UNIQUE (invited_id, group_id)
);

CREATE INDEX idx_invite_records_inviter ON invite_records(inviter_id);
CREATE INDEX idx_invite_records_group ON invite_records(group_id);

-- Auto delete configs table (自动删除配置表)
CREATE TABLE auto_delete_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    delete_commands BOOLEAN DEFAULT false,
    delete_links BOOLEAN DEFAULT false,
    delete_forwards BOOLEAN DEFAULT false,
    delete_media BOOLEAN DEFAULT false,
    delay_seconds INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_auto_delete_group UNIQUE (group_id)
);

-- Auto ban rules table (自动封禁规则表)
CREATE TABLE auto_ban_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL,
    pattern TEXT NOT NULL,
    action VARCHAR(50) DEFAULT 'ban',
    duration INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auto_ban_rules_group ON auto_ban_rules(group_id);

-- Sent messages table (已发送消息表)
CREATE TABLE sent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id BIGINT NOT NULL,
    message_id BIGINT NOT NULL,
    message_type VARCHAR(50),
    content TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sent_messages_chat ON sent_messages(chat_id);

-- Group members table (群组成员表)
CREATE TABLE group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_group_member UNIQUE (group_id, user_id)
);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);

-- ============================================
-- 4. 创建触发器函数
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_groups_updated_at BEFORE UPDATE ON groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_points_updated_at BEFORE UPDATE ON user_points
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lotteries_updated_at BEFORE UPDATE ON lotteries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_keywords_updated_at BEFORE UPDATE ON keywords
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_group_configs_updated_at BEFORE UPDATE ON group_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 5. 插入默认数据
-- ============================================

-- Insert default super admin (Telegram ID: 7136882977)
INSERT INTO admins (telegram_id, username, display_name, level, is_active)
VALUES (7136882977, 'super_admin', '超级管理员', 10, true)
ON CONFLICT (telegram_id) DO UPDATE 
SET level = 10, is_active = true, display_name = '超级管理员';

-- Insert default password admin (for backward compatibility)
INSERT INTO admins (username, password_hash, display_name, level, is_active)
VALUES ('admin', '$2b$10$YourHashedPasswordHere', 'Administrator', 10, true)
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- 6. 创建清理函数
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_old_pending_deletes()
RETURNS void AS $$
BEGIN
    DELETE FROM pending_delete_messages 
    WHERE delete_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

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

-- ============================================
-- 初始化完成
-- ============================================

SELECT 'Database initialization completed successfully!' as status;

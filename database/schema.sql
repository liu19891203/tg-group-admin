-- Telegram Group Manager Database Schema
-- PostgreSQL with Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id BIGINT NOT NULL UNIQUE,
    chat_type VARCHAR(50) NOT NULL DEFAULT 'supergroup',
    title VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    invite_link VARCHAR(500),
    linked_channel_id BIGINT,
    is_active BOOLEAN DEFAULT true,
    member_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_groups_chat_id ON groups(chat_id);
CREATE INDEX IF NOT EXISTS idx_groups_active ON groups(is_active);

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL UNIQUE,
    username VARCHAR(255),
    display_name VARCHAR(255),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255),
    language_code VARCHAR(10) DEFAULT 'en',
    is_bot BOOLEAN DEFAULT false,
    avatar_url VARCHAR(500),
    is_verified BOOLEAN DEFAULT false,
    verified_info JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Group configs table
CREATE TABLE IF NOT EXISTS group_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    -- Feature toggle fields (24 features)
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
    crypto_enabled BOOLEAN DEFAULT false,
    members_enabled BOOLEAN DEFAULT false,
    scheduled_msg_enabled BOOLEAN DEFAULT false,
    points_enabled BOOLEAN DEFAULT false,
    activity_stats_enabled BOOLEAN DEFAULT false,
    entertainment_enabled BOOLEAN DEFAULT false,
    usdt_price_enabled BOOLEAN DEFAULT false,
    channel_link_enabled BOOLEAN DEFAULT false,
    admin_perms_enabled BOOLEAN DEFAULT false,
    nsfw_detection_enabled BOOLEAN DEFAULT false,
    language_whitelist_enabled BOOLEAN DEFAULT false,
    invite_links_enabled BOOLEAN DEFAULT false,
    lottery_enabled BOOLEAN DEFAULT false,
    verified_users_enabled BOOLEAN DEFAULT false,
    -- Config JSON fields
    welcome_config JSONB DEFAULT '{}'::jsonb,
    verification_config JSONB DEFAULT '{"enabled": false, "type": "channel", "timeout": 300, "punishment": "kick"}'::jsonb,
    anti_ads_config JSONB DEFAULT '{"enabled": false, "keywords": [], "regex_patterns": [], "whitelist_users": [], "punishment": "delete", "warn_limit": 3, "warn_message": "⚠️ 您的消息包含广告内容，已被删除。", "delete_original": true, "sticker_ads": true, "keyword_ads": true, "link_ads": true, "image_ads": false}'::jsonb,
    auto_reply_config JSONB DEFAULT '{"enabled": false}'::jsonb,
    auto_delete_config JSONB DEFAULT '{"enabled": false, "rules": []}'::jsonb,
    anti_spam_config JSONB DEFAULT '{"enabled": false, "max_messages": 5, "time_window": 10, "punishment": "mute", "mute_duration": 300}'::jsonb,
    points_config JSONB DEFAULT '{"enabled": true, "daily_limit": 100, "per_message": 0.2, "checkin_base": 10, "checkin_bonus": [2, 5, 10, 20]}'::jsonb,
    commands_config JSONB DEFAULT '{}'::jsonb,
    crypto_config JSONB DEFAULT '{"enabled": true, "default_currency": "USDT"}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_group_configs_group ON group_configs(group_id);

-- Group administrators table
CREATE TABLE IF NOT EXISTS group_administrators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_owner BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_group_admin UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_admins_group ON group_administrators(group_id);
CREATE INDEX IF NOT EXISTS idx_group_admins_user ON group_administrators(user_id);

-- Group members table
CREATE TABLE IF NOT EXISTS group_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_group_member UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

-- User points table
CREATE TABLE IF NOT EXISTS user_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    last_checkin_at TIMESTAMPTZ,
    checkin_streak INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_group_points UNIQUE (user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_user_points_group ON user_points(group_id);
CREATE INDEX IF NOT EXISTS idx_user_points_user ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_rank ON user_points(group_id, points DESC);

-- Point history table
CREATE TABLE IF NOT EXISTS point_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    points_change INTEGER NOT NULL,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_point_history_user ON point_history(user_id, group_id, created_at DESC);

-- Lotteries table
CREATE TABLE IF NOT EXISTS lotteries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    prize TEXT NOT NULL,
    prize_count INTEGER DEFAULT 1,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    participants JSONB DEFAULT '[]'::jsonb,
    winners JSONB DEFAULT '[]'::jsonb,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lotteries_group ON lotteries(group_id);
CREATE INDEX IF NOT EXISTS idx_lotteries_active ON lotteries(group_id, is_active);

-- Scheduled messages table
CREATE TABLE IF NOT EXISTS scheduled_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_html TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    is_sent BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_messages_group ON scheduled_messages(group_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_messages_pending ON scheduled_messages(is_sent, scheduled_at);

-- Auto reply rules table
CREATE TABLE IF NOT EXISTS auto_reply_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(50) NOT NULL, -- keyword, regex, command
    trigger_value TEXT NOT NULL,
    reply_content TEXT NOT NULL,
    reply_content_html TEXT,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_reply_group ON auto_reply_rules(group_id);
CREATE INDEX IF NOT EXISTS idx_auto_reply_active ON auto_reply_rules(group_id, is_active);

-- Message stats table
CREATE TABLE IF NOT EXISTS message_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    message_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_group_user_date UNIQUE (group_id, user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_message_stats_group ON message_stats(group_id, date);
CREATE INDEX IF NOT EXISTS idx_message_stats_user ON message_stats(user_id, date);

-- Invite stats table
CREATE TABLE IF NOT EXISTS invite_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invite_count INTEGER DEFAULT 0,
    invite_link VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_group_user_invite UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_invite_stats_group ON invite_stats(group_id);
CREATE INDEX IF NOT EXISTS idx_invite_stats_rank ON invite_stats(group_id, invite_count DESC);

-- Channel settings table
CREATE TABLE IF NOT EXISTS channel_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    channel_id BIGINT NOT NULL,
    channel_title VARCHAR(255),
    channel_username VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_group_channel UNIQUE (group_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_settings_group ON channel_settings(group_id);

-- Channel forwards table
CREATE TABLE IF NOT EXISTS channel_forwards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    source_channel_id BIGINT NOT NULL,
    target_channel_id BIGINT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channel_forwards_group ON channel_forwards(group_id);

-- Anti-ads rules table
CREATE TABLE IF NOT EXISTS anti_ads_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL, -- keyword, regex, domain
    rule_value TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anti_ads_group ON anti_ads_rules(group_id);

-- Auto ban rules table
CREATE TABLE IF NOT EXISTS auto_ban_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    rule_type VARCHAR(50) NOT NULL, -- keyword, regex
    rule_value TEXT NOT NULL,
    ban_duration INTEGER, -- minutes, null for permanent
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auto_ban_group ON auto_ban_rules(group_id);

-- Porn detection settings table
CREATE TABLE IF NOT EXISTS porn_detection_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT false,
    sensitivity VARCHAR(20) DEFAULT 'medium', -- low, medium, high
    action VARCHAR(50) DEFAULT 'delete', -- delete, warn, ban
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_group_porn_detection UNIQUE (group_id)
);

CREATE INDEX IF NOT EXISTS idx_porn_detection_group ON porn_detection_settings(group_id);

-- Menu permissions table
CREATE TABLE IF NOT EXISTS menu_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_key VARCHAR(100) NOT NULL UNIQUE,
    menu_name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_permissions_key ON menu_permissions(menu_key);

-- Chat stats table (for daily statistics)
CREATE TABLE IF NOT EXISTS chat_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_messages INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    new_members INTEGER DEFAULT 0,
    left_members INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_group_date_stats UNIQUE (group_id, date)
);

CREATE INDEX IF NOT EXISTS idx_chat_stats_group ON chat_stats(group_id, date);

-- Verified users table (for verification system)
CREATE TABLE IF NOT EXISTS verified_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    verified_level INTEGER DEFAULT 1, -- 1, 2, 3
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    verified_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_verified_user_group UNIQUE (user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_verified_users_group ON verified_users(group_id);
CREATE INDEX IF NOT EXISTS idx_verified_users_level ON verified_users(group_id, verified_level);

-- Verified levels config table (认证等级配置)
CREATE TABLE IF NOT EXISTS verified_levels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    level INTEGER NOT NULL, -- 等级: 1, 2, 3
    name VARCHAR(100) NOT NULL, -- 等级名称
    badge VARCHAR(50), -- 徽章/图标
    color VARCHAR(20), -- 颜色
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_group_level UNIQUE (group_id, level)
);

CREATE INDEX IF NOT EXISTS idx_verified_levels_group ON verified_levels(group_id);

-- Verified messages config table (认证回复消息配置)
CREATE TABLE IF NOT EXISTS verified_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    unverified_message TEXT, -- 未认证用户回复消息
    unverified_message_html TEXT, -- 未认证用户回复消息(HTML格式)
    verified_message TEXT, -- 已认证用户回复消息
    verified_message_html TEXT, -- 已认证用户回复消息(HTML格式)
    include_level_1 BOOLEAN DEFAULT true, -- 是否包含等级1变量
    include_level_2 BOOLEAN DEFAULT true, -- 是否包含等级2变量
    include_level_3 BOOLEAN DEFAULT true, -- 是否包含等级3变量
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_group_messages UNIQUE (group_id)
);

CREATE INDEX IF NOT EXISTS idx_verified_messages_group ON verified_messages(group_id);

-- Admins table (for web admin panel)
CREATE TABLE IF NOT EXISTS admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE,
    username VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    display_name VARCHAR(255),
    level INTEGER DEFAULT 1,
    permissions JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admins_telegram ON admins(telegram_id);
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);

-- Operation logs table
CREATE TABLE IF NOT EXISTS operation_logs (
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

CREATE INDEX IF NOT EXISTS idx_operation_logs_admin ON operation_logs(admin_id, created_at DESC);

-- Account change history table (nickname/username changes)
CREATE TABLE IF NOT EXISTS account_change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    change_type VARCHAR(50) NOT NULL, -- 'nickname', 'username'
    old_value VARCHAR(255),
    new_value VARCHAR(255),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_changes_user ON account_change_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_changes_group ON account_change_history(group_id, created_at DESC);

-- Verification records table
CREATE TABLE IF NOT EXISTS verification_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed
    challenge_type VARCHAR(50), -- math, image, etc.
    challenge_data JSONB,
    answer TEXT,
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verification_user ON verification_records(telegram_id, group_id);
CREATE INDEX IF NOT EXISTS idx_verification_pending ON verification_records(status, expires_at) WHERE status = 'pending';

-- Updated at trigger function
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

-- Insert default admin user (password: admin123)
-- Note: In production, use bcrypt hashed password
INSERT INTO admins (username, password_hash, display_name, level, is_active)
VALUES ('admin', '$2b$10$YourHashedPasswordHere', 'Administrator', 9, true)
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- Migration: Add feature toggle fields to group_configs
-- For existing tables, run these ALTER TABLE statements
-- ============================================

-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS verification_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS welcome_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS auto_reply_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS auto_delete_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS auto_ban_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS auto_warn_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS auto_mute_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS flood_control_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS ad_block_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS command_disable_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS crypto_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS members_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS scheduled_msg_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS points_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS activity_stats_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS entertainment_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS usdt_price_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS channel_link_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS admin_perms_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS nsfw_detection_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS language_whitelist_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS invite_links_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS lottery_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS verified_users_enabled BOOLEAN DEFAULT false;

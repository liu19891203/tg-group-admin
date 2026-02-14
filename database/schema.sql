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
    welcome_config JSONB DEFAULT '{}'::jsonb,
    verification_config JSONB DEFAULT '{"enabled": false, "type": "channel", "timeout": 300, "punishment": "kick"}'::jsonb,
    anti_ads_config JSONB DEFAULT '{"enabled": false, "keywords": [], "punishment": "delete", "warn_limit": 3}'::jsonb,
    auto_reply_config JSONB DEFAULT '{"enabled": false}'::jsonb,
    auto_delete_config JSONB DEFAULT '{"enabled": false, "rules": []}'::jsonb,
    anti_spam_config JSONB DEFAULT '{"enabled": false, "max_messages": 5, "time_window": 10, "punishment": "mute", "mute_duration": 300}'::jsonb,
    points_config JSONB DEFAULT '{"enabled": true, "daily_limit": 100, "per_message": 0.2, "checkin_base": 10, "checkin_bonus": [2, 5, 10, 20]}'::jsonb,
    commands_config JSONB DEFAULT '{}'::jsonb,
    crypto_config JSONB DEFAULT '{"enabled": true, "default_currency": "USDT"}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_group_configs_group_id ON group_configs(group_id);

-- User points table
CREATE TABLE IF NOT EXISTS user_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    total_points INTEGER DEFAULT 0,
    checkin_count INTEGER DEFAULT 0,
    checkin_streak INTEGER DEFAULT 0,
    last_checkin_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_group_points UNIQUE (user_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_user_points_group ON user_points(group_id, points DESC);
CREATE INDEX IF NOT EXISTS idx_user_points_user ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_streak ON user_points(checkin_streak DESC) WHERE checkin_streak > 0;

-- Points logs table
CREATE TABLE IF NOT EXISTS points_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    group_id UUID NOT NULL REFERENCES groups(id),
    change_type VARCHAR(50) NOT NULL,
    change_amount INTEGER NOT NULL,
    before_points INTEGER NOT NULL,
    after_points INTEGER NOT NULL,
    reason VARCHAR(500),
    related_id UUID,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_logs_user ON points_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_logs_group ON points_logs(group_id, created_at DESC);

-- Auto reply rules table
CREATE TABLE IF NOT EXISTS auto_reply_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    keyword VARCHAR(500) NOT NULL,
    is_regex BOOLEAN DEFAULT false,
    match_mode VARCHAR(20) DEFAULT 'contains',
    weight INTEGER DEFAULT 1,
    response_type VARCHAR(20) NOT NULL,
    response_content JSONB NOT NULL,
    require_username BOOLEAN DEFAULT false,
    delete_trigger BOOLEAN DEFAULT false,
    delete_delay INTEGER DEFAULT 0,
    cooldown INTEGER DEFAULT 0,
    is_enabled BOOLEAN DEFAULT true,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_auto_reply_group ON auto_reply_rules(group_id, is_enabled);

-- Scheduled messages table
CREATE TABLE IF NOT EXISTS scheduled_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    channel_id BIGINT,
    title VARCHAR(255),
    message_content JSONB NOT NULL,
    schedule_type VARCHAR(20) NOT NULL,
    cron_expr VARCHAR(100),
    interval_minutes INTEGER,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    is_enabled BOOLEAN DEFAULT true,
    last_sent_at TIMESTAMPTZ,
    next_send_at TIMESTAMPTZ,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_next ON scheduled_messages(next_send_at) WHERE is_enabled = true;
CREATE INDEX IF NOT EXISTS idx_scheduled_group ON scheduled_messages(group_id);

-- Lotteries table
CREATE TABLE IF NOT EXISTS lotteries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    type VARCHAR(20) NOT NULL,
    prize TEXT NOT NULL,
    prize_image_url VARCHAR(500),
    conditions JSONB DEFAULT '{}'::jsonb,
    winner_count INTEGER DEFAULT 1,
    max_participants INTEGER,
    is_repeat_winner_allowed BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'draft',
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    last_reminder_at TIMESTAMPTZ,
    winner_ids JSONB DEFAULT '[]'::jsonb,
    winner_telegram_ids JSONB DEFAULT '[]'::jsonb,
    participant_count INTEGER DEFAULT 0,
    ticket_count INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lotteries_group ON lotteries(group_id, status);
CREATE INDEX IF NOT EXISTS idx_lotteries_active ON lotteries(end_at) WHERE status = 'active';

-- Lottery participants table
CREATE TABLE IF NOT EXISTS lottery_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lottery_id UUID NOT NULL REFERENCES lotteries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    is_winner BOOLEAN DEFAULT false,
    ticket_count INTEGER DEFAULT 1,
    points_spent INTEGER DEFAULT 0,
    CONSTRAINT unique_lottery_user UNIQUE (lottery_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lottery_participants ON lottery_participants(lottery_id);

-- Verification records table
CREATE TABLE IF NOT EXISTS verification_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL,
    verification_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
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

-- Admins table
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
    change_type VARCHAR(50) NOT NULL, -- 'nickname', 'username', 'both'
    old_nickname VARCHAR(255),
    new_nickname VARCHAR(255),
    old_username VARCHAR(255),
    new_username VARCHAR(255),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    detected_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_change_user ON account_change_history(user_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_change_group ON account_change_history(group_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_change_type ON account_change_history(change_type, changed_at DESC);

-- Verified users table (认证用户)
CREATE TABLE IF NOT EXISTS verified_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    verified_level INTEGER NOT NULL DEFAULT 1, -- 认证等级: 1, 2, 3
    verified_by UUID REFERENCES users(id), -- 认证管理员
    verified_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- 过期时间, NULL表示永久
    notes TEXT, -- 备注
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_group_user_verified UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_verified_users_group ON verified_users(group_id);
CREATE INDEX IF NOT EXISTS idx_verified_users_user ON verified_users(user_id);
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

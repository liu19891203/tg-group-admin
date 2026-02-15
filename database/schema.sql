-- ============================================
-- Login verification codes table (登录验证码表)
-- 用于 Telegram 验证码登录
-- ============================================

CREATE TABLE IF NOT EXISTS login_codes (
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

CREATE INDEX IF NOT EXISTS idx_login_codes_telegram ON login_codes(telegram_id);
CREATE INDEX IF NOT EXISTS idx_login_codes_expires ON login_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_login_codes_code ON login_codes(code, telegram_id) WHERE used = false;

-- ============================================
-- Update admins table to support Telegram login
-- ============================================

-- Add telegram_id to admins if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'admins' AND column_name = 'telegram_id'
    ) THEN
        ALTER TABLE admins ADD COLUMN telegram_id BIGINT UNIQUE;
    END IF;
END
$$;

-- Update level column comment
COMMENT ON COLUMN admins.level IS '权限等级: 0=普通用户, 5=群组管理员, 10=超级管理员';

-- ============================================
-- Migration: Add feature toggle fields to group_configs
-- For existing tables, run these ALTER TABLE statements
-- ============================================

-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS verification_enabled BOOLEAN DEFAULT false;
-- ALTER TABLE group_configs ADD COLUMN IF NOT EXISTS welcome_enabled BOOLEAN DEFAULT false;
-- ... (其他字段)

-- ============================================
-- User-Group Relations table
-- 用户-群组关联表：记录用户与群组的关系，支持跨群组用户追踪
-- ============================================

CREATE TABLE IF NOT EXISTS user_group_relations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_telegram_id BIGINT NOT NULL,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    group_chat_id BIGINT NOT NULL,
    group_title TEXT,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    CONSTRAINT unique_user_group_relation UNIQUE (user_telegram_id, group_chat_id)
);

CREATE INDEX IF NOT EXISTS idx_user_relations ON user_group_relations(user_telegram_id);
CREATE INDEX IF NOT EXISTS idx_group_relations ON user_group_relations(group_chat_id);
CREATE INDEX IF NOT EXISTS idx_user_group_active ON user_group_relations(user_telegram_id, is_active);

-- ============================================
-- Insert default admin user (password: admin123)
-- Note: In production, use bcrypt hashed password
-- ============================================

INSERT INTO admins (username, password_hash, display_name, level, is_active)
VALUES ('admin', '$2b$10$YourHashedPasswordHere', 'Administrator', 10, true)
ON CONFLICT (username) DO NOTHING;

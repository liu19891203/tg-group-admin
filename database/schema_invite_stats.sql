-- 邀请统计系统数据库表结构
-- PostgreSQL with Supabase

-- 用户邀请链接表（每个用户有唯一的邀请链接）
CREATE TABLE IF NOT EXISTS user_invite_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- 链接信息
    invite_code VARCHAR(50) NOT NULL,              -- 邀请码（唯一标识）
    invite_link VARCHAR(500) NOT NULL,             -- 完整邀请链接
    
    -- 统计信息
    total_invites INTEGER DEFAULT 0,               -- 总邀请人数
    valid_invites INTEGER DEFAULT 0,               -- 有效邀请人数（通过验证）
    pending_invites INTEGER DEFAULT 0,             -- 待验证邀请人数
    
    -- 奖励信息
    total_rewards INTEGER DEFAULT 0,               -- 获得的总奖励积分
    
    -- 状态
    is_active BOOLEAN DEFAULT true,                -- 链接是否有效
    expires_at TIMESTAMPTZ,                        -- 过期时间（NULL表示永不过期）
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_group_user_invite UNIQUE (group_id, user_id),
    CONSTRAINT unique_invite_code UNIQUE (invite_code)
);

-- 邀请记录表
CREATE TABLE IF NOT EXISTS invite_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    -- 邀请关系
    inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 邀请人
    invited_id UUID REFERENCES users(id) ON DELETE SET NULL,          -- 被邀请人（可能还没注册）
    invited_telegram_id BIGINT,                                       -- 被邀请人Telegram ID
    
    -- 邀请详情
    invite_code VARCHAR(50) NOT NULL,              -- 使用的邀请码
    invited_at TIMESTAMPTZ DEFAULT NOW(),          -- 邀请时间（入群时间）
    
    -- 验证状态
    status VARCHAR(20) DEFAULT 'pending',          -- 状态: pending, verified, rejected, expired
    verified_at TIMESTAMPTZ,                       -- 验证通过时间
    verified_by UUID REFERENCES users(id),         -- 验证管理员
    
    -- 验证要求检查
    requirements_checked BOOLEAN DEFAULT false,    -- 是否已检查要求
    requirements_met BOOLEAN DEFAULT false,        -- 是否满足要求
    requirements_details JSONB DEFAULT '{}'::jsonb, -- 具体要求检查结果
    
    -- 奖励发放
    reward_given BOOLEAN DEFAULT false,            -- 是否已发放奖励
    reward_amount INTEGER,                         -- 奖励积分
    rewarded_at TIMESTAMPTZ,                       -- 奖励发放时间
    
    -- 被邀请人信息（入群时记录）
    invited_user_info JSONB DEFAULT '{}'::jsonb,   -- 被邀请人入群时的信息
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 邀请排行榜配置表
CREATE TABLE IF NOT EXISTS invite_leaderboard_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    -- 基本设置
    is_enabled BOOLEAN DEFAULT true,               -- 是否启用排行榜
    update_frequency VARCHAR(20) DEFAULT 'realtime', -- 更新频率: realtime, hourly, daily
    
    -- 显示设置
    show_top_count INTEGER DEFAULT 10,             -- 显示前N名
    show_self_rank BOOLEAN DEFAULT true,           -- 是否显示自己的排名
    
    -- 统计周期
    ranking_period VARCHAR(20) DEFAULT 'all_time', -- 统计周期: all_time, monthly, weekly
    period_start_date TIMESTAMPTZ,                 -- 周期开始时间
    
    -- 消息设置（统一消息编辑）
    message_template TEXT,                         -- 排行榜消息模板
    message_template_html TEXT,                    -- HTML格式模板
    header_text TEXT,                              -- 头部文本
    footer_text TEXT,                              -- 尾部文本
    
    -- 样式设置
    rank_1_badge VARCHAR(50) DEFAULT '🥇',         -- 第一名徽章
    rank_2_badge VARCHAR(50) DEFAULT '🥈',         -- 第二名徽章
    rank_3_badge VARCHAR(50) DEFAULT '🥉',         -- 第三名徽章
    rank_other_badge VARCHAR(50) DEFAULT '🏅',     -- 其他名次徽章
    
    -- 自动发布
    auto_publish BOOLEAN DEFAULT false,            -- 是否自动发布
    publish_cron VARCHAR(100),                     -- 自动发布Cron表达式
    last_published_at TIMESTAMPTZ,                 -- 上次发布时间
    published_message_id INTEGER,                  -- 已发布消息的ID（用于编辑）
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_group_leaderboard_config UNIQUE (group_id)
);

-- 邀请验证规则表
CREATE TABLE IF NOT EXISTS invite_verification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    -- 规则基本信息
    name VARCHAR(100) NOT NULL,                    -- 规则名称
    description TEXT,                              -- 规则描述
    is_active BOOLEAN DEFAULT true,                -- 是否启用
    priority INTEGER DEFAULT 0,                    -- 优先级（数字越小优先级越高）
    
    -- 验证类型
    verification_type VARCHAR(50) NOT NULL,        -- 类型: 
                                                   -- - stay_time（停留时间）
                                                   -- - message_count（发言数量）
                                                   -- - checkin_count（签到次数）
                                                   -- - points_reached（积分达到）
                                                   -- - custom（自定义条件）
    
    -- 验证参数
    verification_params JSONB DEFAULT '{}'::jsonb, -- 验证参数
                                                   -- stay_time: { "minutes": 60 }
                                                   -- message_count: { "count": 5 }
                                                   -- checkin_count: { "count": 1 }
                                                   -- points_reached: { "points": 100 }
                                                   -- custom: { "condition": "..." }
    
    -- 验证时间窗口
    verification_window_hours INTEGER DEFAULT 24,  -- 验证时间窗口（小时），0表示无限制
    
    -- 奖励设置
    reward_points INTEGER DEFAULT 0,               -- 验证通过后邀请人获得的积分
    invited_reward_points INTEGER DEFAULT 0,       -- 被邀请人获得的积分
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 邀请排行榜历史表（用于追踪历史排名）
CREATE TABLE IF NOT EXISTS invite_leaderboard_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    -- 排名信息
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rank_position INTEGER NOT NULL,                -- 排名位置
    valid_invites INTEGER NOT NULL,                -- 有效邀请数
    
    -- 统计周期
    period_type VARCHAR(20) NOT NULL,              -- 周期类型: daily, weekly, monthly
    period_start TIMESTAMPTZ NOT NULL,             -- 周期开始时间
    period_end TIMESTAMPTZ NOT NULL,               -- 周期结束时间
    
    -- 奖励
    reward_given BOOLEAN DEFAULT false,
    reward_amount INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_invite_links_group ON user_invite_links(group_id);
CREATE INDEX IF NOT EXISTS idx_user_invite_links_user ON user_invite_links(user_id);
CREATE INDEX IF NOT EXISTS idx_user_invite_links_code ON user_invite_links(invite_code);

CREATE INDEX IF NOT EXISTS idx_invite_records_group ON invite_records(group_id);
CREATE INDEX IF NOT EXISTS idx_invite_records_inviter ON invite_records(inviter_id);
CREATE INDEX IF NOT EXISTS idx_invite_records_invited ON invite_records(invited_id);
CREATE INDEX IF NOT EXISTS idx_invite_records_status ON invite_records(status);
CREATE INDEX IF NOT EXISTS idx_invite_records_code ON invite_records(invite_code);

CREATE INDEX IF NOT EXISTS idx_leaderboard_history_group ON invite_leaderboard_history(group_id, period_type, period_start);

-- 添加触发器更新 updated_at
CREATE TRIGGER update_user_invite_links_updated_at BEFORE UPDATE ON user_invite_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invite_records_updated_at BEFORE UPDATE ON invite_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invite_leaderboard_config_updated_at BEFORE UPDATE ON invite_leaderboard_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invite_verification_rules_updated_at BEFORE UPDATE ON invite_verification_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 添加注释
COMMENT ON TABLE user_invite_links IS '用户邀请链接表，每个用户在每个群组有唯一的邀请链接';
COMMENT ON TABLE invite_records IS '邀请记录表，记录所有的邀请关系';
COMMENT ON TABLE invite_leaderboard_config IS '邀请排行榜配置表';
COMMENT ON TABLE invite_verification_rules IS '邀请验证规则表，定义被邀请人需要满足的条件';
COMMENT ON TABLE invite_leaderboard_history IS '邀请排行榜历史记录表';

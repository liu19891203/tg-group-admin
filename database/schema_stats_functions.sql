-- 统计数据收集相关数据库函数
-- PostgreSQL with Supabase

-- 增量更新每日群组统计
CREATE OR REPLACE FUNCTION increment_chat_stats(
    p_group_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
BEGIN
    INSERT INTO chat_stats (group_id, date, total_messages, active_users)
    VALUES (p_group_id, p_date, 1, 1)
    ON CONFLICT (group_id, date) DO UPDATE
    SET 
        total_messages = chat_stats.total_messages + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 增量更新活跃用户数（需要单独调用，因为不能在消息计数时同时更新）
CREATE OR REPLACE FUNCTION increment_active_users(
    p_group_id UUID,
    p_user_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
BEGIN
    -- 检查该用户今天是否已经有消息记录
    INSERT INTO message_stats (group_id, user_id, date, message_count)
    VALUES (p_group_id, p_user_id, p_date, 1)
    ON CONFLICT (group_id, user_id, date) DO UPDATE
    SET 
        message_count = message_stats.message_count + 1,
        updated_at = NOW();
    
    -- 如果是新用户的首次消息，更新活跃用户数
    IF NOT EXISTS (
        SELECT 1 FROM message_stats 
        WHERE group_id = p_group_id AND user_id = p_user_id AND date = p_date AND message_count = 1
    ) THEN
        INSERT INTO chat_stats (group_id, date, active_users)
        VALUES (p_group_id, p_date, 1)
        ON CONFLICT (group_id, date) DO UPDATE
        SET active_users = chat_stats.active_users + 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 更新群组成员活跃状态
CREATE OR REPLACE FUNCTION update_member_activity(
    p_group_id UUID,
    p_user_id UUID
) RETURNS void AS $$
BEGIN
    -- 检查是否存在记录
    IF EXISTS (SELECT 1 FROM group_members WHERE group_id = p_group_id AND user_id = p_user_id) THEN
        UPDATE group_members
        SET 
            last_message_at = NOW(),
            message_count = COALESCE(message_count, 0) + 1,
            updated_at = NOW()
        WHERE group_id = p_group_id AND user_id = p_user_id;
    ELSE
        -- 如果不存在则创建新记录
        INSERT INTO group_members (group_id, user_id, last_message_at, message_count, is_active)
        VALUES (p_group_id, p_user_id, NOW(), 1, true)
        ON CONFLICT (group_id, user_id) DO UPDATE
        SET 
            last_message_at = NOW(),
            message_count = COALESCE(group_members.message_count, 0) + 1,
            updated_at = NOW();
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 批量更新统计数据（一条消息的完整统计更新）
CREATE OR REPLACE FUNCTION record_message_stats(
    p_group_id UUID,
    p_user_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
) RETURNS void AS $$
DECLARE
    v_is_new_active_user BOOLEAN;
BEGIN
    -- 1. 更新消息统计
    INSERT INTO message_stats (group_id, user_id, date, message_count)
    VALUES (p_group_id, p_user_id, p_date, 1)
    ON CONFLICT (group_id, user_id, date) DO UPDATE
    SET 
        message_count = message_stats.message_count + 1,
        updated_at = NOW();
    
    -- 2. 检查是否是新活跃用户（今天首次发言）
    SELECT NOT EXISTS (
        SELECT 1 FROM message_stats 
        WHERE group_id = p_group_id AND user_id = p_user_id AND date = p_date AND message_count > 1
    ) INTO v_is_new_active_user;
    
    -- 3. 更新每日统计
    INSERT INTO chat_stats (group_id, date, total_messages, active_users)
    VALUES (p_group_id, p_date, 1, CASE WHEN v_is_new_active_user THEN 1 ELSE 0 END)
    ON CONFLICT (group_id, date) DO UPDATE
    SET 
        total_messages = chat_stats.total_messages + 1,
        active_users = chat_stats.active_users + CASE WHEN v_is_new_active_user THEN 1 ELSE 0 END,
        updated_at = NOW();
    
    -- 4. 更新群组成员活跃状态
    INSERT INTO group_members (group_id, user_id, last_message_at, message_count, is_active)
    VALUES (p_group_id, p_user_id, NOW(), 1, true)
    ON CONFLICT (group_id, user_id) DO UPDATE
    SET 
        last_message_at = NOW(),
        message_count = COALESCE(group_members.message_count, 0) + 1,
        is_active = true,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 更新邀请统计
CREATE OR REPLACE FUNCTION update_invite_stats(
    p_group_id UUID,
    p_user_id UUID,
    p_increment INTEGER DEFAULT 1
) RETURNS void AS $$
BEGIN
    INSERT INTO invite_stats (group_id, user_id, invite_count)
    VALUES (p_group_id, p_user_id, p_increment)
    ON CONFLICT (group_id, user_id) DO UPDATE
    SET 
        invite_count = invite_stats.invite_count + p_increment,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- 添加注释
COMMENT ON FUNCTION increment_chat_stats IS '增量更新群组每日消息统计';
COMMENT ON FUNCTION increment_active_users IS '增量更新活跃用户数';
COMMENT ON FUNCTION update_member_activity IS '更新群组成员活跃状态';
COMMENT ON FUNCTION record_message_stats IS '批量记录消息统计数据（推荐使用）';
COMMENT ON FUNCTION update_invite_stats IS '更新邀请统计';

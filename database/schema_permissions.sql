-- 群组管理员表
CREATE TABLE IF NOT EXISTS group_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL,
    
    permissions JSONB DEFAULT '{}',                -- 自定义权限配置
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(group_id, telegram_user_id)
);

-- 权限模板表
CREATE TABLE IF NOT EXISTS permission_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    
    name VARCHAR(100) NOT NULL,                    -- 模板名称
    description TEXT,                              -- 模板描述
    permissions JSONB NOT NULL,                    -- 权限配置
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_group_admins_group_id ON group_admins(group_id);
CREATE INDEX IF NOT EXISTS idx_group_admins_user_id ON group_admins(telegram_user_id);
CREATE INDEX IF NOT EXISTS idx_permission_templates_group_id ON permission_templates(group_id);

-- 添加注释
COMMENT ON TABLE group_admins IS '群组管理员权限表';
COMMENT ON TABLE permission_templates IS '权限模板表';
COMMENT ON COLUMN group_admins.permissions IS '权限配置JSON，包含各项功能的访问权限';

-- 插入默认权限模板
INSERT INTO permission_templates (name, description, permissions) VALUES
('完全权限', '拥有所有管理权限', '{
  "can_manage_settings": true,
  "can_manage_admins": true,
  "can_manage_auto_delete": true,
  "can_manage_auto_ban": true,
  "can_manage_keywords": true,
  "can_view_logs": true,
  "can_send_messages": true,
  "can_manage_members": true,
  "can_view_stats": true
}'::jsonb),

('基础权限', '基础管理权限，不能管理其他管理员', '{
  "can_manage_settings": false,
  "can_manage_admins": false,
  "can_manage_auto_delete": true,
  "can_manage_auto_ban": true,
  "can_manage_keywords": true,
  "can_view_logs": true,
  "can_send_messages": true,
  "can_manage_members": false,
  "can_view_stats": true
}'::jsonb),

('只读权限', '只能查看，不能修改', '{
  "can_manage_settings": false,
  "can_manage_admins": false,
  "can_manage_auto_delete": false,
  "can_manage_auto_ban": false,
  "can_manage_keywords": false,
  "can_view_logs": true,
  "can_send_messages": false,
  "can_manage_members": false,
  "can_view_stats": true
}'::jsonb);

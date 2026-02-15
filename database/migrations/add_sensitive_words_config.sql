-- Add sensitive_words_config to group_configs table
-- Migration: Add sensitive word detection configuration

ALTER TABLE group_configs 
ADD COLUMN IF NOT EXISTS sensitive_words_config JSONB DEFAULT '{
  "enabled": false,
  "words": [],
  "regex_patterns": [],
  "action": "delete",
  "notify_admin": false,
  "admin_notify_chat_id": null,
  "warn_message": "⚠️ 您的消息包含敏感词，已被处理。"
}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN group_configs.sensitive_words_config IS '敏感词检测配置: enabled-是否启用, words-敏感词列表, regex_patterns-正则表达式, action-处理动作(delete/warn/mute/kick/ban), notify_admin-是否通知管理员, admin_notify_chat_id-管理员通知群ID';

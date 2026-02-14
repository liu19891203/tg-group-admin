declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
  total?: number
  page?: number
  limit?: number
}

interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
}

interface Group {
  id: string
  chat_id: number
  title: string
  username?: string
  chat_type: string
  member_count: number
  is_active: boolean
  avatar_url?: string
  invite_link?: string
  linked_channel_id?: number
  created_at?: string
  updated_at?: string
  config?: GroupConfig
}

interface User {
  id: string
  telegram_id: number
  username?: string
  first_name: string
  last_name?: string
  display_name?: string
  avatar_url?: string
  is_bot: boolean
  is_verified: boolean
}

interface GroupConfig {
  autoReply?: any
  verification?: any
  welcome?: any
  auto_delete_config?: any
  anti_spam_config?: any
  points_config?: any
  commands_config?: any
}

interface Admin {
  id: string
  user_id: string
  username?: string
  first_name: string
  last_name?: string
  role: 'super_admin' | 'admin'
  permissions: string[]
  created_at: string
}

interface Membership {
  id: string
  user_id: string
  group_id: string
  points: number
  total_points: number
  checkin_streak: number
  last_activity_at?: string
  nickname_changed_at?: string
  username_changed_at?: string
}

interface Permission {
  id: string
  name: string
  description?: string
  level: 'basic' | 'intermediate' | 'advanced'
}

interface InviteStats {
  total_inviters: number
  total_invites: number
  valid_invites: number
  pending_invites: number
  total_rewards: number
}

interface Inviter {
  user_id: number
  first_name: string
  last_name?: string
  username?: string
  invite_count: number
  valid_count: number
  reward_points: number
  last_invite_at: string
}

interface MessageTemplate {
  header_text?: string
  message_template: string
  footer_text?: string
  image_url?: string
  inline_buttons?: InlineButton[][]
  reply_buttons?: ReplyButton[]
}

interface InlineButton {
  text: string
  url?: string
  callback_data?: string
}

interface ReplyButton {
  text: string
}

interface Variable {
  key: string
  label: string
  description?: string
}

interface DashboardStats {
  total_groups: number
  total_users: number
  total_messages: number
  total_points_issued: number
  active_groups: number
  new_users_today: number
  messages_today: number
  top_groups: Array<{
    id: string
    title: string
    member_count: number
  }>
  recent_activity: Array<{
    id: string
    action: string
    target_type: string
    target_id: string
    created_at: string
  }>
}

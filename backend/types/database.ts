// Database Types for Supabase

export interface Database {
  public: {
    Tables: {
      groups: {
        Row: Group;
        Insert: Omit<Group, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Group, 'id'>>;
      };
      users: {
        Row: User;
        Insert: Omit<User, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<User, 'id'>>;
      };
      group_configs: {
        Row: GroupConfig;
        Insert: Omit<GroupConfig, 'id' | 'updated_at'>;
        Update: Partial<Omit<GroupConfig, 'id'>>;
      };
      user_points: {
        Row: UserPoints;
        Insert: Omit<UserPoints, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<UserPoints, 'id'>>;
      };
      points_logs: {
        Row: PointsLog;
        Insert: Omit<PointsLog, 'id' | 'created_at'>;
        Update: Partial<Omit<PointsLog, 'id'>>;
      };
      auto_reply_rules: {
        Row: AutoReplyRule;
        Insert: Omit<AutoReplyRule, 'id' | 'created_at' | 'used_count'>;
        Update: Partial<Omit<AutoReplyRule, 'id'>>;
      };
      scheduled_messages: {
        Row: ScheduledMessage;
        Insert: Omit<ScheduledMessage, 'id' | 'created_at' | 'sent_count' | 'failed_count'> & {
          id?: string;
          created_at?: string;
          sent_count?: number;
          failed_count?: number;
        };
        Update: Partial<ScheduledMessage>;
      };
      lotteries: {
        Row: Lottery;
        Insert: Omit<Lottery, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Lottery, 'id'>>;
      };
      lottery_participants: {
        Row: LotteryParticipant;
        Insert: Omit<LotteryParticipant, 'id' | 'joined_at'>;
        Update: Partial<Omit<LotteryParticipant, 'id'>>;
      };
      verification_records: {
        Row: VerificationRecord;
        Insert: Omit<VerificationRecord, 'id' | 'created_at'>;
        Update: Partial<Omit<VerificationRecord, 'id'>>;
      };
      admins: {
        Row: Admin;
        Insert: Omit<Admin, 'id' | 'created_at'>;
        Update: Partial<Omit<Admin, 'id'>>;
      };
      operation_logs: {
        Row: OperationLog;
        Insert: Omit<OperationLog, 'id' | 'created_at'>;
        Update: Partial<Omit<OperationLog, 'id'>>;
      };
      channel_forward_settings: {
        Row: ChannelForwardSetting;
        Insert: Omit<ChannelForwardSetting, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ChannelForwardSetting, 'id'>>;
      };
      invite_links: {
        Row: InviteLink;
        Insert: Omit<InviteLink, 'id' | 'created_at'>;
        Update: Partial<Omit<InviteLink, 'id'>>;
      };
      invite_records: {
        Row: InviteRecord;
        Insert: Omit<InviteRecord, 'id' | 'created_at'>;
        Update: Partial<Omit<InviteRecord, 'id'>>;
      };
      memberships: {
        Row: Membership;
        Insert: Omit<Membership, 'id' | 'joined_at'>;
        Update: Partial<Omit<Membership, 'id'>>;
      };
      account_change_history: {
        Row: AccountChangeHistory;
        Insert: Omit<AccountChangeHistory, 'id' | 'changed_at' | 'detected_at'>;
        Update: Partial<Omit<AccountChangeHistory, 'id'>>;
      };
      user_invite_links: {
        Row: UserInviteLink;
        Insert: Omit<UserInviteLink, 'id' | 'created_at'>;
        Update: Partial<Omit<UserInviteLink, 'id'>>;
      };
      invite_leaderboard_config: {
        Row: InviteLeaderboardConfig;
        Insert: Omit<InviteLeaderboardConfig, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<InviteLeaderboardConfig, 'id'>>;
      };
      invite_verification_rules: {
        Row: InviteVerificationRule;
        Insert: Omit<InviteVerificationRule, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<InviteVerificationRule, 'id'>>;
      };
      verified_levels: {
        Row: VerifiedLevel;
        Insert: Omit<VerifiedLevel, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<VerifiedLevel, 'id'>>;
      };
      verified_messages: {
        Row: VerifiedMessage;
        Insert: Omit<VerifiedMessage, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<VerifiedMessage, 'id'>>;
      };
      verified_users: {
        Row: VerifiedUser;
        Insert: Omit<VerifiedUser, 'id' | 'verified_at'>;
        Update: any;
      };
      pending_delete_messages: {
        Row: PendingDeleteMessage;
        Insert: Omit<PendingDeleteMessage, 'id' | 'created_at'>;
        Update: Partial<Omit<PendingDeleteMessage, 'id'>>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}

export interface Group {
  id: string;
  chat_id: number;
  chat_type: 'supergroup' | 'channel';
  title: string;
  username?: string;
  invite_link?: string;
  linked_channel_id?: number;
  is_active: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  telegram_id: number;
  username?: string;
  display_name?: string;
  first_name: string;
  last_name?: string;
  language_code?: string;
  is_bot: boolean;
  avatar_url?: string;
  is_verified: boolean;
  verified_info?: VerifiedInfo;
  created_at: string;
  updated_at: string;
}

export interface VerifiedInfo {
  cert_type: 'car' | 'teacher' | 'other';
  cert_number?: string;
  verified_at: string;
  rating?: number;
  review_count?: number;
}

export interface GroupConfig {
  id: string;
  group_id: string;
  
  // 功能开关字段（与 Telegram 菜单同步）
  // 初级功能
  verification_enabled?: boolean;
  welcome_enabled?: boolean;
  auto_reply_enabled?: boolean;
  auto_delete_enabled?: boolean;
  auto_ban_enabled?: boolean;
  auto_warn_enabled?: boolean;
  auto_mute_enabled?: boolean;
  flood_control_enabled?: boolean;
  ad_block_enabled?: boolean;
  command_disable_enabled?: boolean;
  
  // 中级功能
  crypto_enabled?: boolean;
  members_enabled?: boolean;
  scheduled_msg_enabled?: boolean;
  points_enabled?: boolean;
  activity_stats_enabled?: boolean;
  entertainment_enabled?: boolean;
  usdt_price_enabled?: boolean;
  channel_link_enabled?: boolean;
  
  // 高级功能
  admin_perms_enabled?: boolean;
  nsfw_detection_enabled?: boolean;
  language_whitelist_enabled?: boolean;
  invite_links_enabled?: boolean;
  lottery_enabled?: boolean;
  verified_users_enabled?: boolean;
  
  // 详细配置对象
  welcome_config: WelcomeConfig;
  verification_config: VerificationConfig;
  anti_ads_config: AntiAdsConfig;
  auto_reply_config: AutoReplyConfig;
  auto_delete_config: AutoDeleteConfig;
  anti_spam_config: AntiSpamConfig;
  points_config: PointsConfig;
  commands_config: CommandsConfig;
  crypto_config: CryptoConfig;
  updated_at: string;
}

export interface WelcomeConfig {
  enabled: boolean;
  message: string;
  type: 'text' | 'image' | 'button' | 'rich';
  delete_after?: number;
  buttons?: InlineKeyboardButton[];
}

export interface InlineButton {
  text: string;
  callback_data: string;
  action: 'callback' | 'url';
  url?: string;
}

export interface ReplyButton {
  text: string;
}

export interface VerificationConfig {
  enabled: boolean;
  type: 'math' | 'image' | 'gif' | 'channel';
  timeout: number;
  punishment: 'kick' | 'ban' | 'mute';
  channel_id?: string;
  difficulty?: number;
  verification_message?: string;
  success_message?: string;
  verification_image_url?: string;
  verification_image_file_id?: string;
  success_image_url?: string;
  success_image_file_id?: string;
  verification_buttons?: InlineButton[];
  success_buttons?: InlineButton[];
  verification_reply_buttons?: ReplyButton[];
  success_reply_buttons?: ReplyButton[];
  bypass_users?: number[];
  captcha_length?: number;
}

export interface CalculationQuestion {
  question: string;
  answer: string;
}

export interface AntiAdsConfig {
  enabled: boolean;
  sticker_ads: boolean;
  keyword_ads: boolean;
  link_ads: boolean;
  image_ads: boolean;
  keywords: string[];
  regex_patterns: string[];
  whitelist_users: number[];
  punishment: 'delete' | 'warn' | 'mute' | 'kick' | 'ban';
  warn_limit: number;
  warn_message: string;
  delete_original: boolean;
}

export interface AutoReplyConfig {
  enabled: boolean;
}

export interface AutoDeleteConfig {
  enabled: boolean;
  rules: AutoDeleteRule[];
}

export interface AutoDeleteRule {
  type: 'porn' | 'external' | 'sticker' | 'link' | 'long' | 'video' | 'doc' | 'exec' | 'forward';
  keywords?: string[];
  regex?: string;
  delete_after?: number;
  notify: boolean;
}

export interface AntiSpamConfig {
  enabled: boolean;
  max_messages: number;
  time_window: number;
  duplicate_threshold: number;
  punishment: 'delete' | 'warn' | 'mute' | 'kick' | 'ban';
  mute_duration: number;
  warn_message?: string;
}

export interface PointsConfig {
  enabled: boolean;
  daily_limit: number;
  per_message: number;
  checkin_base: number;
  checkin_bonus: number[];
  keyword_pattern: string;
}

export interface CommandsConfig {
  [command: string]: {
    enabled: boolean;
    cooldown?: number;
    roles?: ('admin' | 'owner')[];
  };
}

export interface CryptoConfig {
  enabled: boolean;
  default_currency: string;
  price_channel?: number;
  supported_chains?: string[];
}

export interface UserPoints {
  id: string;
  user_id: string;
  group_id: string;
  points: number;
  total_points: number;
  checkin_count: number;
  checkin_streak: number;
  last_checkin_at?: string;
  last_activity_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PointsLog {
  id: string;
  user_id: string;
  group_id: string;
  change_type: 'checkin' | 'message' | 'admin_add' | 'admin_subtract' | 'lottery' | 'expired';
  change_amount: number;
  before_points: number;
  after_points: number;
  reason?: string;
  related_id?: string;
  created_by?: string;
  created_at: string;
}

export interface AutoReplyRule {
  id: string;
  group_id: string;
  keyword: string;
  is_regex: boolean;
  match_mode: 'exact' | 'contains' | 'starts_with' | 'ends_with';
  weight: number;
  response_type: 'text' | 'image' | 'link' | 'button' | 'rich';
  response_content: ResponseContent;
  require_username: boolean;
  delete_trigger: boolean;
  delete_delay: number;
  cooldown: number;
  is_enabled: boolean;
  created_by?: string;
  created_at: string;
  used_count: number;
}

export interface ResponseContent {
  text?: string;
  image_url?: string;
  link_url?: string;
  buttons?: InlineKeyboardButton[];
}

export interface InlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
}

export interface ScheduledMessage {
  id: string;
  group_id?: string | null;
  channel_id?: number | null;
  message_content: {
    text?: string;
    parse_mode?: string;
    reply_markup?: any;
  } | MessageContent;
  schedule_type: 'once' | 'interval' | 'cron';
  cron_expr?: string;
  interval_minutes?: number;
  start_at?: string;
  end_at?: string;
  next_send_at?: string;
  last_sent_at?: string;
  sent_count: number;
  failed_count: number;
  is_enabled: boolean;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface MessageContent {
  type: 'text' | 'image' | 'button' | 'rich';
  text?: string;
  image_url?: string;
  buttons?: InlineKeyboardButton[];
  disable_preview?: boolean;
  pin?: boolean;
}

export interface Lottery {
  id: string;
  group_id: string;
  title: string;
  description?: string;
  type: 'basic' | 'points' | 'lotto';
  prize: string;
  prize_image_url?: string;
  conditions: LotteryConditions;
  winner_count: number;
  max_participants?: number;
  is_repeat_winner_allowed: boolean;
  status: 'draft' | 'active' | 'ended';
  start_at?: string;
  end_at?: string;
  duration_minutes?: number;
  last_reminder_at?: string;
  winner_ids: string[];
  winner_telegram_ids: number[];
  participant_count: number;
  ticket_count: number;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface LotteryConditions {
  min_messages?: number;
  must_follow_channel?: boolean;
  must_have_username?: boolean;
  min_join_days?: number;
  required_groups?: string[];
  points_required?: number;
  lotto_ticket_price?: number;
}

export interface LotteryParticipant {
  id: string;
  lottery_id: string;
  user_id: string;
  telegram_id: number;
  joined_at: string;
  is_winner: boolean;
  ticket_count: number;
  points_spent: number;
}

export interface VerificationRecord {
  id: string;
  user_id?: string;
  group_id: string;
  telegram_id: number;
  verification_type: 'channel' | 'private' | 'captcha' | 'calculation' | 'gif';
  status: 'pending' | 'passed' | 'failed' | 'expired';
  challenge_data?: ChallengeData;
  answer?: string;
  attempt_count: number;
  max_attempts: number;
  completed_at?: string;
  expires_at?: string;
  created_at: string;
}

export interface ChallengeData {
  verify_id?: string;
  captcha_code?: string;
  captcha_image_url?: string;
  question?: string;
  correct_answer?: string;
  channel_id?: number;
}

export interface Admin {
  id: string;
  telegram_id: number;
  username?: string;
  display_name?: string;
  level: number;
  permissions: string[];
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
}

export interface OperationLog {
  id: string;
  admin_id?: string;
  action: string;
  target_type: string;
  target_id?: string;
  old_value?: Record<string, unknown>;
  new_value?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface ChannelForwardSetting {
  id: string;
  group_id: string;
  channel_id: number;
  channel_name?: string;
  channel_username?: string;
  forward_mode: 'all' | 'filtered';
  auto_pin: boolean;
  pin_duration_minutes?: number;
  include_author: boolean;
  include_source: boolean;
  custom_header?: string;
  custom_footer?: string;
  filter_keywords?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InviteLink {
  id: string;
  group_id: string;
  user_id: string;
  telegram_id: number;
  invite_link: string;
  link_code: string;
  total_invites: number;
  valid_invites: number;
  reward_points: number;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
}

export interface InviteRecord {
  id: string;
  group_id: string;
  inviter_id: string;
  inviter_telegram_id: number;
  invitee_telegram_id: number;
  invite_link_id: string;
  status: 'pending' | 'verified' | 'expired';
  verified_at?: string;
  reward_given: boolean;
  created_at: string;
}

export interface Membership {
  id: string;
  user_id: string;
  group_id: string;
  telegram_id: number;
  nickname?: string;
  points: number;
  total_points: number;
  checkin_streak: number;
  last_checkin_at?: string;
  joined_at: string;
  left_at?: string;
  is_active: boolean;
}

export interface AccountChangeHistory {
  id: string;
  user_id: string;
  group_id: string;
  change_type: 'nickname' | 'username';
  old_nickname?: string;
  new_nickname?: string;
  old_username?: string;
  new_username?: string;
  changed_at: string;
  detected_at: string;
}

export interface VerifiedLevel {
  id: string;
  group_id: string;
  level: number;
  name: string;
  badge: string;
  color: string;
  required_points: number;
  privileges: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface VerifiedMessage {
  id: string;
  group_id: string;
  unverified_message: string;
  unverified_message_html: string;
  verified_message: string;
  verified_message_html: string;
  include_level_1: boolean;
  include_level_2: boolean;
  include_level_3: boolean;
  created_at: string;
  updated_at: string;
}

export interface VerifiedUser {
  id: string;
  group_id: string;
  user_id: string;
  verified_level: number;
  verified_by: string;
  verified_at: string;
  expires_at?: string;
  notes?: string;
  created_at: string;
}

export interface UserInviteLink {
  id: string;
  group_id: string;
  user_id: string;
  telegram_id: number;
  invite_code: string;
  invite_link: string;
  total_uses: number;
  max_uses?: number;
  is_active: boolean;
  created_at: string;
}

export interface UserPoint {
  id: string;
  user_id: string;
  group_id: string;
  telegram_id: number;
  points: number;
  total_points: number;
  level: number;
  created_at: string;
  updated_at: string;
}

export interface OperationLog {
  id: string;
  group_id: string;
  user_id?: string;
  telegram_id?: number;
  operation_type: string;
  operation_data?: Record<string, any>;
  created_at: string;
}

export interface InviteLeaderboardConfig {
  id: string;
  group_id: string;
  enabled: boolean;
  show_top_count: number;
  update_interval_minutes: number;
  message_template?: string;
  message_template_html?: string;
  scheduled_time?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InviteVerificationRule {
  id: string;
  group_id: string;
  enabled: boolean;
  required_account_age_days?: number;
  required_invites?: number;
  check_account_age: boolean;
  check_username: boolean;
  check_mobile_verified: boolean;
  action_on_fail: 'kick' | 'warn' | 'none';
  custom_message?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PendingDeleteMessage {
  id: string;
  chat_id: number;
  message_id: number;
  delete_at: string;
  reason?: string;
  created_at: string;
}

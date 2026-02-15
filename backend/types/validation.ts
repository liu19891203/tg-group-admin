import { z } from 'zod';

export const telegramUpdateSchema = z.object({
  update_id: z.number(),
  message: z.object({
    message_id: z.number(),
    from: z.object({
      id: z.number(),
      is_bot: z.boolean(),
      first_name: z.string(),
      last_name: z.string().optional(),
      username: z.string().optional(),
      language_code: z.string().optional()
    }).optional(),
    chat: z.object({
      id: z.number(),
      type: z.enum(['private', 'group', 'supergroup', 'channel']),
      title: z.string().optional(),
      username: z.string().optional()
    }),
    date: z.number(),
    text: z.string().optional(),
    caption: z.string().optional()
  }).optional(),
  callback_query: z.object({
    id: z.string(),
    from: z.object({
      id: z.number(),
      is_bot: z.boolean(),
      first_name: z.string(),
      username: z.string().optional()
    }),
    message: z.object({
      message_id: z.number(),
      chat: z.object({
        id: z.number()
      })
    }).optional(),
    data: z.string().optional()
  }).optional(),
  chat_member: z.object({
    chat: z.object({
      id: z.number()
    }),
    from: z.object({
      id: z.number(),
      is_bot: z.boolean(),
      first_name: z.string(),
      username: z.string().optional()
    }),
    date: z.number(),
    old_chat_member: z.object({
      status: z.string()
    }).optional(),
    new_chat_member: z.object({
      status: z.string(),
      user: z.object({
        id: z.number(),
        is_bot: z.boolean()
      })
    }).optional()
  }).optional(),
  my_chat_member: z.object({
    chat: z.object({
      id: z.number()
    }),
    from: z.object({
      id: z.number()
    }),
    date: z.number(),
    old_chat_member: z.object({
      status: z.string()
    }).optional(),
    new_chat_member: z.object({
      status: z.string()
    }).optional()
  }).optional()
}).partial();

export const groupConfigSchema = {
  welcome_config: z.object({
    enabled: z.boolean().default(false),
    message: z.string().default(''),
    type: z.enum(['text', 'image', 'button']).default('text'),
    image_url: z.string().optional(),
    auto_delete: z.boolean().default(false),
    delete_delay: z.number().min(0).max(300).default(60)
  }),

  verification_config: z.object({
    enabled: z.boolean().default(false),
    type: z.enum(['channel', 'private', 'captcha', 'calculation', 'gif'])
      .default('channel'),
    channel_id: z.number().optional(),
    captcha_length: z.number().min(4).max(8).default(4),
    timeout: z.number().min(60).max(1800).default(300),
    punishment: z.enum(['ban', 'mute', 'kick', 'warn']).default('kick'),
    bypass_users: z.array(z.number()).default([])
  }),

  anti_ads_config: z.object({
    enabled: z.boolean().default(false),
    sticker_ads: z.boolean().default(true),
    keyword_ads: z.boolean().default(true),
    link_ads: z.boolean().default(true),
    image_ads: z.boolean().default(false),
    keywords: z.array(z.string()).default([]),
    regex_patterns: z.array(z.string()).default([]),
    whitelist_users: z.array(z.number()).default([]),
    punishment: z.enum(['delete', 'warn', 'mute', 'kick', 'ban'])
      .default('delete'),
    warn_limit: z.number().min(1).max(10).default(3),
    warn_message: z.string().default('⚠️ 您的消息包含广告内容，已被删除。'),
    delete_original: z.boolean().default(true)
  }),

  auto_reply_config: z.object({
    enabled: z.boolean().default(false)
  }),

  auto_delete_config: z.object({
    enabled: z.boolean().default(false),
    rules: z.array(z.object({
      type: z.enum([
        'porn', 'external', 'sticker', 'link', 'long',
        'video', 'doc', 'exec', 'forward'
      ]),
      keywords: z.array(z.string()).optional(),
      regex: z.string().optional(),
      max_length: z.number().optional(),
      notify: z.boolean().default(true)
    })).default([])
  }),

  anti_spam_config: z.object({
    enabled: z.boolean().default(false),
    time_window: z.number().min(5).max(60).default(10),
    max_messages: z.number().min(3).max(20).default(5),
    punishment: z.enum(['mute', 'kick', 'ban', 'delete']).default('mute'),
    mute_duration: z.number().min(60).max(86400).default(300),
    ignore_admins: z.boolean().default(true)
  }),

  points_config: z.object({
    enabled: z.boolean().default(true),
    daily_limit: z.number().min(10).max(1000).default(100),
    per_message: z.number().min(0.1).max(2).default(0.2),
    checkin_base: z.number().min(1).max(100).default(10),
    checkin_bonus: z.array(z.number()).default([2, 5, 10, 20]),
    keyword_pattern: z.string().default('[\\u4e00-\\u9fa5]{5,}')
  }),

  commands_config: z.record(z.object({
    enabled: z.boolean(),
    cooldown: z.number().optional(),
    roles: z.array(z.enum(['admin', 'owner'])).optional()
  }))
};

export const autoReplyRuleSchema = z.object({
  group_id: z.string().uuid(),
  keyword: z.string().min(1).max(500),
  is_regex: z.boolean().default(false),
  match_mode: z.enum(['exact', 'contains', 'starts_with', 'ends_with'])
    .default('contains'),
  weight: z.number().min(1).max(100).default(1),
  response_type: z.enum(['text', 'image', 'link', 'button', 'rich']),
  response_content: z.object({
    text: z.string().optional(),
    image_url: z.string().optional(),
    link_url: z.string().optional(),
    buttons: z.array(z.object({
      text: z.string(),
      url: z.string().optional(),
      callback_data: z.string().optional()
    })).optional()
  }),
  require_username: z.boolean().default(false),
  delete_trigger: z.boolean().default(false),
  delete_delay: z.number().min(0).max(300).default(0),
  cooldown: z.number().min(0).default(0)
});

export const lotterySchema = z.object({
  group_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(['basic', 'points', 'lotto']),
  prize: z.string().min(1),
  prize_image_url: z.string().optional(),
  conditions: z.object({
    min_messages: z.number().optional(),
    must_follow_channel: z.boolean().optional(),
    must_have_username: z.boolean().optional(),
    min_join_days: z.number().optional(),
    points_required: z.number().optional(),
    lotto_ticket_price: z.number().optional()
  }).optional(),
  winner_count: z.number().min(1).max(100).default(1),
  max_participants: z.number().optional(),
  is_repeat_winner_allowed: z.boolean().default(false),
  duration_minutes: z.number().optional()
});

export const scheduledMessageSchema = z.object({
  group_id: z.string().uuid(),
  channel_id: z.number().optional(),
  title: z.string().optional(),
  message_content: z.object({
    type: z.enum(['text', 'image', 'button', 'rich']),
    text: z.string().optional(),
    image_url: z.string().optional(),
    buttons: z.array(z.object({
      text: z.string(),
      url: z.string().optional(),
      callback_data: z.string().optional()
    })).optional(),
    disable_preview: z.boolean().optional(),
    pin: z.boolean().optional()
  }),
  schedule_type: z.enum(['cron', 'interval', 'once']),
  cron_expr: z.string().optional(),
  interval_minutes: z.number().optional(),
  start_at: z.string().datetime().optional(),
  end_at: z.string().datetime().optional()
});

export const userPointsAdjustmentSchema = z.object({
  telegram_id: z.number(),
  group_id: z.string().uuid(),
  change_amount: z.number(),
  reason: z.string().min(1).max(500),
  admin_id: z.string().optional()
});

export function validateUpdate(data: unknown) {
  return telegramUpdateSchema.safeParse(data);
}

export function validateGroupConfig(config: unknown) {
  return config;
}

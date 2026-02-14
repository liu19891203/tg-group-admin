import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../../lib/mockDb';

interface MatchResult {
  matched: boolean;
  rule?: any;
  reply_content: string;
  reply_type: 'text' | 'image' | 'button' | 'mixed';
  delete_after?: number;
  delete_type: 'immediate' | 'delay';
}

function matchAutoReply(message: string, rules: any[]): MatchResult {
  const defaultResult: MatchResult = {
    matched: false,
    reply_content: '',
    reply_type: 'text',
    delete_after: 60,
    delete_type: 'delay'
  };

  // 按优先级排序
  const sortedRules = rules
    .filter(rule => rule.enabled)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    let isMatch = false;
    
    if (rule.is_regex) {
      // 正则表达式匹配
      try {
        const regex = new RegExp(rule.keyword, 'i');
        isMatch = regex.test(message);
      } catch (error) {
        console.error('正则表达式错误:', rule.keyword, error);
        continue;
      }
    } else {
      // 关键词匹配
      isMatch = message.toLowerCase().includes(rule.keyword.toLowerCase());
    }

    if (isMatch) {
      // 处理随机回复选项
      let finalContent = rule.reply_content;
      if (rule.reply_options && rule.reply_options.length > 0) {
        const randomIndex = Math.floor(Math.random() * rule.reply_options.length);
        finalContent = rule.reply_options[randomIndex];
      }

      return {
        matched: true,
        rule,
        reply_content: finalContent,
        reply_type: rule.reply_type,
        delete_after: rule.delete_after,
        delete_type: rule.delete_type
      };
    }
  }

  return defaultResult;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { groupId, message, config } = req.body as {
      groupId: string;
      message: string;
      config: any;
    };

    if (!groupId || !message) {
      return res.status(400).json({ error: '参数不完整' });
    }

    // 如果自动回复未启用或全局禁用，直接返回不匹配
    if (!config?.enabled || config?.global_disable) {
      return res.status(200).json({
        matched: false,
        reply_content: '',
        reply_type: 'text'
      });
    }

    const rules = config.rules || [];
    const result = matchAutoReply(message, rules);

    return res.status(200).json(result);

  } catch (error) {
    console.error('Auto-reply match error:', error);
    return res.status(500).json({ error: '匹配失败' });
  }
}

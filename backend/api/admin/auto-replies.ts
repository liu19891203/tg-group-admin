import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../lib/mockDb';

interface AutoReplyRule {
  id: string;
  keyword: string;
  is_regex: boolean;
  reply_type: 'text' | 'image' | 'button' | 'mixed';
  reply_content: string;
  reply_options?: string[];
  delete_after?: number;
  delete_type: 'immediate' | 'delay';
  enabled: boolean;
  priority: number;
}

interface AutoReplyConfig {
  enabled: boolean;
  rules: AutoReplyRule[];
  global_disable: boolean;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: '未授权' });
    }

    if (req.method === 'GET') {
      const groupId = req.query.groupId as string;
      if (!groupId) {
        return res.status(400).json({ error: '群组ID不能为空' });
      }

      const defaultConfig: AutoReplyConfig = {
        enabled: false,
        global_disable: false,
        rules: [
          {
            id: '1',
            keyword: '帮助',
            is_regex: false,
            reply_type: 'text',
            reply_content: '欢迎使用本机器人！\n输入 /help 查看帮助文档',
            delete_after: 60,
            delete_type: 'delay',
            enabled: true,
            priority: 1
          },
          {
            id: '2',
            keyword: '规则',
            is_regex: false,
            reply_type: 'text',
            reply_content: '群组规则：\n1. 禁止广告\n2. 禁止人身攻击\n3. 遵守法律法规',
            delete_after: 120,
            delete_type: 'delay',
            enabled: true,
            priority: 2
          }
        ]
      };

      return res.status(200).json({ data: defaultConfig });

    } else if (req.method === 'POST') {
      // 添加新规则
      const { groupId, rule } = req.body as {
        groupId: string;
        rule: AutoReplyRule;
      };

      if (!groupId || !rule) {
        return res.status(400).json({ error: '参数不完整' });
      }

      // 验证规则格式
      if (!rule.keyword.trim()) {
        return res.status(400).json({ error: '关键词不能为空' });
      }

      if (!['text', 'image', 'button', 'mixed'].includes(rule.reply_type)) {
        return res.status(400).json({ error: '回复类型无效' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '规则添加成功',
        rule: { ...rule, id: Math.random().toString(36).substr(2, 9) }
      });

    } else if (req.method === 'PUT') {
      // 更新规则
      const { groupId, ruleId, updates } = req.body as {
        groupId: string;
        ruleId: string;
        updates: Partial<AutoReplyRule>;
      };

      if (!groupId || !ruleId) {
        return res.status(400).json({ error: '参数不完整' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '规则更新成功'
      });

    } else if (req.method === 'DELETE') {
      // 删除规则
      const { groupId, ruleId } = req.body as {
        groupId: string;
        ruleId: string;
      };

      if (!groupId || !ruleId) {
        return res.status(400).json({ error: '参数不完整' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '规则删除成功'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Auto-reply config error:', error);
    return res.status(500).json({ error: '操作失败' });
  }
}

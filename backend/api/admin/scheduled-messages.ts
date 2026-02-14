import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../lib/mockDb';

interface ScheduledMessage {
  id: string;
  group_id: string;
  channel_id?: string;
  message_type: 'text' | 'photo' | 'video' | 'document';
  content: string;
  media_url?: string;
  buttons?: Array<{
    text: string;
    url?: string;
    callback_data?: string;
  }>;
  schedule_type: 'once' | 'recurring';
  schedule_time: string;
  recurring_pattern?: 'daily' | 'weekly' | 'monthly';
  recurring_days?: number[];
  timezone: string;
  enabled: boolean;
  last_sent?: string;
  next_send?: string;
  status: 'pending' | 'sent' | 'failed';
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

      // 模拟定时消息列表
      const messages: ScheduledMessage[] = [
        {
          id: '1',
          group_id: groupId,
          message_type: 'text',
          content: '早安！新的一天开始了，祝大家工作顺利！',
          schedule_type: 'recurring',
          schedule_time: '08:00',
          recurring_pattern: 'daily',
          timezone: 'Asia/Shanghai',
          enabled: true,
          next_send: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        },
        {
          id: '2',
          group_id: groupId,
          message_type: 'text',
          content: '温馨提示：请记得完成今日任务哦！',
          schedule_type: 'recurring',
          schedule_time: '14:00',
          recurring_pattern: 'daily',
          timezone: 'Asia/Shanghai',
          enabled: true,
          next_send: new Date(Date.now() + 14 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        },
        {
          id: '3',
          group_id: groupId,
          message_type: 'text',
          content: '晚安！祝大家有个好梦！',
          schedule_type: 'recurring',
          schedule_time: '22:00',
          recurring_pattern: 'daily',
          timezone: 'Asia/Shanghai',
          enabled: true,
          next_send: new Date(Date.now() + 22 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        },
        {
          id: '4',
          group_id: groupId,
          message_type: 'text',
          content: '每周提醒：请查看本周工作计划！',
          schedule_type: 'recurring',
          schedule_time: '09:00',
          recurring_pattern: 'weekly',
          recurring_days: [1],
          timezone: 'Asia/Shanghai',
          enabled: true,
          next_send: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'pending'
        }
      ];

      return res.status(200).json({ 
        data: messages,
        total: messages.length 
      });

    } else if (req.method === 'POST') {
      // 创建定时消息
      const { groupId, message } = req.body as {
        groupId: string;
        message: ScheduledMessage;
      };

      if (!groupId || !message) {
        return res.status(400).json({ error: '参数不完整' });
      }

      // 验证消息配置
      if (!message.content) {
        return res.status(400).json({ error: '消息内容不能为空' });
      }

      if (!message.schedule_time) {
        return res.status(400).json({ error: '发送时间不能为空' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '定时消息创建成功',
        scheduledMessage: { 
          ...message, 
          id: Math.random().toString(36).substr(2, 9),
          status: 'pending'
        }
      });

    } else if (req.method === 'PUT') {
      // 更新定时消息
      const { groupId, messageId, updates } = req.body as {
        groupId: string;
        messageId: string;
        updates: Partial<ScheduledMessage>;
      };

      if (!groupId || !messageId) {
        return res.status(400).json({ error: '参数不完整' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '定时消息更新成功'
      });

    } else if (req.method === 'DELETE') {
      // 删除定时消息
      const { groupId, messageId } = req.body as {
        groupId: string;
        messageId: string;
      };

      if (!groupId || !messageId) {
        return res.status(400).json({ error: '参数不完整' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '定时消息删除成功'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Scheduled messages error:', error);
    return res.status(500).json({ error: '操作失败' });
  }
}

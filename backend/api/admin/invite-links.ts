import { VercelRequest, VercelResponse } from '@vercel/node';

interface InviteLink {
  link_id: string;
  link: string;
  name: string;
  creator_id: string;
  creator_name: string;
  created_at: string;
  expires_at?: string;
  member_limit?: number;
  member_count: number;
  is_revoked: boolean;
  is_primary: boolean;
}

interface InviteConfig {
  enabled: boolean;
  auto_create: boolean;
  default_expire_days: number;
  default_member_limit: number;
  track_invites: boolean;
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

      const inviteLinks: InviteLink[] = [
        {
          link_id: '1',
          link: 'https://t.me/+ABC123XYZ',
          name: '主邀请链接',
          creator_id: '123456789',
          creator_name: 'Admin',
          created_at: '2024-01-01T00:00:00Z',
          member_count: 156,
          is_revoked: false,
          is_primary: true
        },
        {
          link_id: '2',
          link: 'https://t.me/+DEF456UVW',
          name: '活动邀请链接',
          creator_id: '123456789',
          creator_name: 'Admin',
          created_at: '2024-02-15T10:00:00Z',
          expires_at: '2024-03-15T10:00:00Z',
          member_limit: 50,
          member_count: 23,
          is_revoked: false,
          is_primary: false
        },
        {
          link_id: '3',
          link: 'https://t.me/+GHI789RST',
          name: 'VIP邀请链接',
          creator_id: '987654321',
          creator_name: 'Moderator',
          created_at: '2024-02-20T14:30:00Z',
          member_limit: 10,
          member_count: 10,
          is_revoked: false,
          is_primary: false
        }
      ];

      const config: InviteConfig = {
        enabled: true,
        auto_create: false,
        default_expire_days: 30,
        default_member_limit: 0,
        track_invites: true
      };

      return res.status(200).json({ 
        data: {
          links: inviteLinks,
          config
        }
      });

    } else if (req.method === 'POST') {
      const { groupId, link } = req.body as {
        groupId: string;
        link: Partial<InviteLink>;
      };

      if (!groupId) {
        return res.status(400).json({ error: '群组ID不能为空' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '邀请链接创建成功',
        link: {
          ...link,
          link_id: Math.random().toString(36).substr(2, 9),
          created_at: new Date().toISOString(),
          member_count: 0,
          is_revoked: false,
          is_primary: false
        }
      });

    } else if (req.method === 'PUT') {
      const { groupId, linkId, updates } = req.body as {
        groupId: string;
        linkId: string;
        updates: Partial<InviteLink>;
      };

      if (!groupId || !linkId) {
        return res.status(400).json({ error: '参数不完整' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '邀请链接更新成功'
      });

    } else if (req.method === 'DELETE') {
      const { groupId, linkId } = req.body as {
        groupId: string;
        linkId: string;
      };

      if (!groupId || !linkId) {
        return res.status(400).json({ error: '参数不完整' });
      }

      return res.status(200).json({ 
        success: true, 
        message: '邀请链接已撤销'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Invite links error:', error);
    return res.status(500).json({ error: '操作失败' });
  }
}

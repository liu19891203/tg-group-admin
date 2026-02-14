import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * 通用配置 API 处理器
 * 为尚未实现的配置接口提供 mock 响应
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const pathname = req.url?.split('?')[0] || '';
    const configType = pathname.replace('/api/admin/', '');
    
    console.log(`Mock config API: ${configType}`);

    // 处理子路径，如 porn-detection/logs
    const baseType = configType.split('/')[0];

    if (req.method === 'GET') {
      // 处理日志类请求
      if (configType.includes('/logs')) {
        return res.status(200).json({
          success: true,
          data: {
            logs: [],
            total: 0,
            page: 1,
            pageSize: 20
          }
        });
      }

      // 返回默认配置
      const defaultConfigs: Record<string, any> = {
        'auto-delete': {
          enabled: false,
          delete_delay: 30,
          delete_commands: true,
          delete_join_messages: true,
          delete_leave_messages: true,
          exclude_admins: true
        },
        'auto-ban': {
          enabled: false,
          rules: []
        },
        'permissions': {
          default_permissions: [],
          admin_permissions: []
        },
        'porn-detection': {
          enabled: false,
          sensitivity: 0.8,
          action: 'delete',
          notify_admin: true
        },
        'channel-settings': {
          linked_channels: [],
          auto_forward: false
        },
        'group-members': {
          members: [],
          total: 0
        },
        'account-change-history': {
          data: [
            {
              id: '1',
              user_id: 'user-1',
              group_id: 'group-1',
              change_type: 'nickname',
              old_nickname: '张三',
              new_nickname: '张三丰',
              old_username: 'zhangsan',
              new_username: 'zhangsan',
              changed_at: new Date().toISOString(),
              detected_at: new Date().toISOString(),
              user: {
                telegram_id: 123456789,
                first_name: '张三丰',
                last_name: '',
                username: 'zhangsan'
              },
              group: {
                title: '测试群组',
                chat_id: -1001234567890
              }
            },
            {
              id: '2',
              user_id: 'user-2',
              group_id: 'group-1',
              change_type: 'username',
              old_nickname: '李四',
              new_nickname: '李四',
              old_username: 'lisi_old',
              new_username: 'lisi_new',
              changed_at: new Date(Date.now() - 86400000).toISOString(),
              detected_at: new Date(Date.now() - 86400000).toISOString(),
              user: {
                telegram_id: 987654321,
                first_name: '李四',
                last_name: '',
                username: 'lisi_new'
              },
              group: {
                title: '测试群组',
                chat_id: -1001234567890
              }
            }
          ],
          pagination: {
            total: 2,
            limit: 50,
            offset: 0
          }
        }
      };

      const config = defaultConfigs[baseType] || {};
      
      return res.status(200).json({
        success: true,
        data: config
      });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      // 模拟保存配置
      const { config } = req.body || {};
      
      return res.status(200).json({
        success: true,
        message: '配置已保存',
        config
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Mock config error:', error);
    return res.status(500).json({ error: '操作失败' });
  }
}

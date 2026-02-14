import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../lib/mockDb';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getMemberships(req, res);
      case 'POST':
        return await createMembership(req, res);
      case 'PUT':
        return await updateMembership(req, res);
      case 'DELETE':
        return await deleteMembership(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Mock Memberships API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 获取成员列表
async function getMemberships(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, page = '1', pageSize = '20', search } = req.query;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    const pageNum = parseInt(page as string);
    const size = parseInt(pageSize as string);
    const offset = (pageNum - 1) * size;

    // 获取群组成员
    const memberships = mockDb.getMembershipsByGroup(group_id as string);
    
    // 获取用户信息
    const members = memberships.map(membership => {
      const user = mockDb.findUserById(membership.user_id);
      if (!user) return null;

      return {
        id: membership.id,
        telegram_id: user.telegram_id,
        username: user.username,
        display_name: user.display_name || `${user.first_name} ${user.last_name || ''}`.trim(),
        first_name: user.first_name,
        last_name: user.last_name,
        is_verified: user.is_verified,
        points: membership.points,
        total_points: membership.total_points,
        checkin_streak: membership.checkin_streak,
        last_activity_at: membership.last_activity_at,
        created_at: new Date().toISOString()
      };
    }).filter(Boolean);

    // 应用搜索过滤
    let filteredMembers = members;
    if (search) {
      const searchTerm = (search as string).toLowerCase();
      filteredMembers = members.filter(member => 
        member.username?.toLowerCase().includes(searchTerm) ||
        member.first_name.toLowerCase().includes(searchTerm) ||
        member.last_name?.toLowerCase().includes(searchTerm) ||
        member.display_name.toLowerCase().includes(searchTerm)
      );
    }

    // 应用分页
    const paginatedMembers = filteredMembers.slice(offset, offset + size);

    return res.status(200).json({
      success: true,
      data: {
        members: paginatedMembers,
        total: filteredMembers.length,
        page: pageNum,
        pageSize: size
      }
    });

  } catch (error: any) {
    console.error('Get memberships error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 创建成员关系（加入群组）
async function createMembership(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, telegram_user_id, role = 'member' } = req.body;

    if (!group_id || !telegram_user_id) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    // 检查用户是否存在
    const user = mockDb.findUserByTelegramId(telegram_user_id);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: '用户不存在'
      });
    }

    // 检查是否已存在
    const existing = mockDb.getMembershipByUserAndGroup(user.id, group_id);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: '用户已在群组中'
      });
    }

    // 创建成员关系
    const newMembership = {
      id: `membership_${Date.now()}`,
      user_id: user.id,
      group_id,
      points: 0,
      total_points: 0,
      checkin_streak: 0,
      last_activity_at: new Date().toISOString()
    };

    mockDb.memberships.push(newMembership);

    return res.status(201).json({
      success: true,
      data: newMembership
    });

  } catch (error: any) {
    console.error('Create membership error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 更新成员信息
async function updateMembership(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query;
    const { points, total_points, checkin_streak, role } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少成员ID'
      });
    }

    // 查找成员关系
    const membershipIndex = mockDb.memberships.findIndex(m => m.id === id);
    if (membershipIndex === -1) {
      return res.status(404).json({
        success: false,
        error: '成员关系不存在'
      });
    }

    // 更新数据
    if (points !== undefined) mockDb.memberships[membershipIndex].points = points;
    if (total_points !== undefined) mockDb.memberships[membershipIndex].total_points = total_points;
    if (checkin_streak !== undefined) mockDb.memberships[membershipIndex].checkin_streak = checkin_streak;

    return res.status(200).json({
      success: true,
      data: mockDb.memberships[membershipIndex]
    });

  } catch (error: any) {
    console.error('Update membership error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 删除成员关系（移出群组）
async function deleteMembership(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少成员ID'
      });
    }

    // 删除成员关系
    const index = mockDb.memberships.findIndex(m => m.id === id);
    if (index === -1) {
      return res.status(404).json({
        success: false,
        error: '成员关系不存在'
      });
    }

    mockDb.memberships.splice(index, 1);

    return res.status(200).json({
      success: true,
      data: { message: '成员已移除' }
    });

  } catch (error: any) {
    console.error('Delete membership error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
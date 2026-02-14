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
        return await getMenuPermissions(req, res);
      case 'POST':
        return await addMenuPermission(req, res);
      case 'PUT':
        return await updateMenuPermission(req, res);
      case 'DELETE':
        return await removeMenuPermission(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Menu Permissions API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 获取菜单权限列表
async function getMenuPermissions(req: VercelRequest, res: VercelResponse) {
  const { group_id } = req.query;
  
  if (!group_id) {
    return res.status(400).json({
      success: false,
      error: '缺少群组ID参数'
    });
  }

  try {
    // 从mockDb获取权限数据
    const permissions = mockDb.getMenuPermissions(group_id as string);
    
    return res.status(200).json({
      success: true,
      data: permissions
    });
  } catch (error: any) {
    console.error('Get menu permissions error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 添加菜单权限
async function addMenuPermission(req: VercelRequest, res: VercelResponse) {
  const { group_id, user_id, permissions } = req.body;
  
  if (!group_id || !user_id || !permissions) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数'
    });
  }

  try {
    const newPermission = {
      id: Date.now(),
      group_id,
      user_id,
      permissions, // ['basic', 'intermediate', 'advanced']
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    mockDb.addMenuPermission(newPermission);
    
    return res.status(200).json({
      success: true,
      data: newPermission,
      message: '权限添加成功'
    });
  } catch (error: any) {
    console.error('Add menu permission error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 更新菜单权限
async function updateMenuPermission(req: VercelRequest, res: VercelResponse) {
  const { id, group_id, permissions } = req.body;
  
  if (!id || !group_id || !permissions) {
    return res.status(400).json({
      success: false,
      error: '缺少必要参数'
    });
  }

  try {
    const updatedPermission = {
      id,
      group_id,
      permissions,
      updated_at: new Date().toISOString()
    };
    
    mockDb.updateMenuPermission(updatedPermission);
    
    return res.status(200).json({
      success: true,
      data: updatedPermission,
      message: '权限更新成功'
    });
  } catch (error: any) {
    console.error('Update menu permission error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 移除菜单权限
async function removeMenuPermission(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  
  if (!id) {
    return res.status(400).json({
      success: false,
      error: '缺少权限ID参数'
    });
  }

  try {
    mockDb.removeMenuPermission(Number(id));
    
    return res.status(200).json({
      success: true,
      message: '权限移除成功'
    });
  } catch (error: any) {
    console.error('Remove menu permission error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

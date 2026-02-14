import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

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
        return await getAutoBanRules(req, res);
      case 'POST':
        return await createAutoBanRule(req, res);
      case 'PUT':
        return await updateAutoBanRule(req, res);
      case 'DELETE':
        return await deleteAutoBanRule(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Auto-ban API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 获取自动封禁规则列表
async function getAutoBanRules(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id } = req.query;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    const { data, error } = await supabase
      .from('auto_ban_rules')
      .select('*')
      .eq('group_id', group_id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: data || []
    });
  } catch (error: any) {
    console.error('Get auto-ban rules error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 创建自动封禁规则
async function createAutoBanRule(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, name, match_type, pattern, action, duration, warning_message, is_regex, is_active } = req.body;

    if (!group_id || !name || !pattern || !action) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    const { data, error } = await supabase
      .from('auto_ban_rules')
      .insert({
        group_id,
        name,
        match_type: match_type || 'keyword',
        pattern,
        action,
        duration: duration || 0,
        warning_message,
        is_regex: is_regex || false,
        is_active: is_active !== false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    return res.status(201).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Create auto-ban rule error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 更新自动封禁规则
async function updateAutoBanRule(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query;
    const updates = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少规则ID'
      });
    }

    const { data, error } = await supabase
      .from('auto_ban_rules')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error: any) {
    console.error('Update auto-ban rule error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 删除自动封禁规则
async function deleteAutoBanRule(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: '缺少规则ID'
      });
    }

    const { error } = await supabase
      .from('auto_ban_rules')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: '规则已删除'
    });
  } catch (error: any) {
    console.error('Delete auto-ban rule error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// @ts-nocheck
import { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../../lib/database';
import { autoReplyService } from '../../services/autoReplyService';

export async function handleAutoReplies(req: VercelRequest, res: VercelResponse) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return await getAutoReplies(req, res);
      case 'POST':
        return await createAutoReply(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('AutoReplies API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getAutoReplies(req: VercelRequest, res: VercelResponse) {
  const { group_id, is_enabled } = req.query;

  if (!group_id) {
    return res.status(400).json({ error: 'group_id is required' });
  }

  try {
    let query = supabaseAdmin
      .from('auto_reply_rules')
      .select('*')
      .eq('group_id', group_id)
      .order('weight', { ascending: false })
      .order('created_at', { ascending: true });

    if (is_enabled !== undefined) {
      query = query.eq('is_enabled', is_enabled === 'true');
    }

    const { data, error } = await query;

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      data: data || [],
      count: data?.length || 0
    });
  } catch (error) {
    console.error('Get auto replies error:', error);
    return res.status(500).json({ error: 'Failed to get auto replies' });
  }
}

async function createAutoReply(req: VercelRequest, res: VercelResponse) {
  const {
    group_id,
    keyword,
    is_regex = false,
    match_mode = 'contains',
    weight = 1,
    response_type,
    response_content,
    require_username = false,
    delete_trigger = false,
    delete_delay = 0,
    cooldown = 0,
    created_by
  } = req.body;

  if (!group_id || !keyword || !response_type || !response_content) {
    return res.status(400).json({
      error: 'group_id, keyword, response_type, and response_content are required'
    });
  }

  try {
    const rule = await autoReplyService.createRule({
      groupId: group_id,
      keyword,
      isRegex: is_regex,
      matchMode: match_mode,
      weight,
      responseType: response_type,
      responseContent: response_content,
      requireUsername: require_username,
      deleteTrigger: delete_trigger,
      deleteDelay: delete_delay,
      cooldown,
      createdBy: created_by
    });

    return res.status(201).json({ data: rule });
  } catch (error) {
    console.error('Create auto reply error:', error);
    return res.status(500).json({ error: 'Failed to create auto reply' });
  }
}

export async function handleAutoReplyById(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return await getAutoReply(id as string, res);
      case 'PUT':
        return await updateAutoReply(id as string, req, res);
      case 'DELETE':
        return await deleteAutoReply(id as string, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('AutoReply API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getAutoReply(id: string, res: VercelResponse) {
  try {
    const { data, error } = await supabaseAdmin
      .from('auto_reply_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Auto reply rule not found' });
    }

    return res.status(200).json({ data });
  } catch (error) {
    console.error('Get auto reply error:', error);
    return res.status(500).json({ error: 'Failed to get auto reply' });
  }
}

async function updateAutoReply(id: string, req: VercelRequest, res: VercelResponse) {
  const updates = req.body;

  try {
    const { data, error } = await (supabaseAdmin
      .from('auto_reply_rules')
      .update(updates)
      .eq('id', id)
      .select()
      .single() as any);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ data });
  } catch (error) {
    console.error('Update auto reply error:', error);
    return res.status(500).json({ error: 'Failed to update auto reply' });
  }
}

async function deleteAutoReply(id: string, res: VercelResponse) {
  try {
    const { error } = await supabaseAdmin
      .from('auto_reply_rules')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete auto reply error:', error);
    return res.status(500).json({ error: 'Failed to delete auto reply' });
  }
}

export async function handleAutoReplyDuplicate(req: VercelRequest, res: VercelResponse) {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'id is required' });
  }

  try {
    const rule = await autoReplyService.duplicateRule(id);

    return res.status(201).json({ data: rule });
  } catch (error) {
    console.error('Duplicate auto reply error:', error);
    return res.status(500).json({ error: 'Failed to duplicate auto reply' });
  }
}

export async function handleAutoReplyToggle(req: VercelRequest, res: VercelResponse) {
  const { id, is_enabled } = req.body;

  if (!id || is_enabled === undefined) {
    return res.status(400).json({ error: 'id and is_enabled are required' });
  }

  try {
    await autoReplyService.toggleRule(id, is_enabled);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Toggle auto reply error:', error);
    return res.status(500).json({ error: 'Failed to toggle auto reply' });
  }
}

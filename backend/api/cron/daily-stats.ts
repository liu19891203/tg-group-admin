import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const CRON_SECRET = process.env.CRON_SECRET;

function verifyCronAuth(req: VercelRequest): boolean {
  const cronKey = req.headers['x-cron-key'] || 
                  req.headers['authorization']?.replace('Bearer ', '') ||
                  req.query.key;

  if (!CRON_SECRET) {
    console.warn('CRON_SECRET not configured, allowing request');
    return true;
  }

  return cronKey === CRON_SECRET;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Cron-Key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!verifyCronAuth(req)) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized',
      message: 'Invalid or missing cron authentication'
    });
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0];

  try {
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id')
      .eq('is_active', true);

    if (groupsError) {
      throw groupsError;
    }

    let processedGroups = 0;
    let createdStats = 0;
    let updatedStats = 0;
    const errors: string[] = [];

    for (const group of groups || []) {
      try {
        const { data: existingStats } = await supabase
          .from('chat_stats')
          .select('*')
          .eq('group_id', group.id)
          .eq('date', today)
          .single();

        if (existingStats) {
          const { error: updateError } = await supabase
            .from('chat_stats')
            .update({
              updated_at: new Date().toISOString()
            })
            .eq('id', existingStats.id);

          if (updateError) {
            errors.push(`Group ${group.id}: ${updateError.message}`);
          } else {
            updatedStats++;
          }
        } else {
          const { error: insertError } = await supabase
            .from('chat_stats')
            .insert({
              group_id: group.id,
              date: today,
              total_messages: 0,
              active_users: 0,
              new_members: 0,
              left_members: 0
            });

          if (insertError) {
            errors.push(`Group ${group.id}: ${insertError.message}`);
          } else {
            createdStats++;
          }
        }

        processedGroups++;
      } catch (err: any) {
        errors.push(`Group ${group.id}: ${err.message}`);
      }
    }

    const { error: lotteryError } = await supabase
      .from('lotteries')
      .update({ status: 'ended' })
      .eq('status', 'active')
      .lt('end_at', new Date().toISOString());

    const executionTimeMs = Date.now() - startTime;

    console.log(`[Cron] Daily stats processed: groups=${processedGroups}, created=${createdStats}, updated=${updatedStats}, time=${executionTimeMs}ms`);

    return res.json({
      success: true,
      timestamp: new Date().toISOString(),
      date: today,
      processedGroups,
      createdStats,
      updatedStats,
      errors: errors.length > 0 ? errors : undefined,
      executionTimeMs
    });

  } catch (error: any) {
    console.error('[Cron] Error processing daily stats:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error',
      message: error.message,
      executionTimeMs: Date.now() - startTime
    });
  }
}

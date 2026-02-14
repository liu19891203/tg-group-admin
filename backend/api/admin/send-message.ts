import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    switch (req.method) {
      case 'GET':
        return await getMessageHistory(req, res);
      case 'POST':
        return await sendMessage(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Send message API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 获取发送历史
async function getMessageHistory(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, limit = '20' } = req.query;

    if (!group_id) {
      return res.status(400).json({
        success: false,
        error: '缺少群组ID'
      });
    }

    const { data, error } = await supabase
      .from('sent_messages')
      .select('*')
      .eq('group_id', group_id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit as string));

    if (error) throw error;

    return res.status(200).json({
      success: true,
      data: data || []
    });
  } catch (error: any) {
    console.error('Get message history error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 发送消息
async function sendMessage(req: VercelRequest, res: VercelResponse) {
  try {
    const { 
      group_id, 
      text, 
      parse_mode = 'HTML', 
      disable_notification = false, 
      reply_markup,
      image_url,
      image_file_id 
    } = req.body;

    if (!group_id || (!text && !image_url)) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数'
      });
    }

    // 获取群组信息
    const { data: group, error: groupError } = await supabase
      .from('groups')
      .select('telegram_chat_id')
      .eq('id', group_id)
      .single();

    if (groupError || !group) {
      return res.status(404).json({
        success: false,
        error: '群组不存在'
      });
    }

    let result: any;

    // 如果有图片，使用 sendPhoto API
    if (image_url) {
      result = await sendPhotoMessage({
        chat_id: group.telegram_chat_id,
        photo: image_url,
        caption: text,
        parse_mode,
        disable_notification,
        reply_markup
      });
    } else {
      // 普通文本消息
      result = await sendTextMessage({
        chat_id: group.telegram_chat_id,
        text,
        parse_mode,
        disable_notification,
        reply_markup
      });
    }

    if (!result.ok) {
      return res.status(400).json({
        success: false,
        error: result.description || '发送失败'
      });
    }

    // 记录到数据库
    const { data: sentMessage, error: insertError } = await supabase
      .from('sent_messages')
      .insert({
        group_id,
        text: text || '(图片消息)',
        parse_mode,
        disable_notification,
        telegram_message_id: result.result.message_id,
        image_url: image_url || null,
        status: 'sent',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return res.status(200).json({
      success: true,
      data: sentMessage,
      telegram_result: result.result
    });
  } catch (error: any) {
    console.error('Send message error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

// 发送文本消息
async function sendTextMessage(params: {
  chat_id: number;
  text: string;
  parse_mode: string;
  disable_notification: boolean;
  reply_markup?: any;
}) {
  const requestBody: any = {
    chat_id: params.chat_id,
    text: params.text,
    parse_mode: params.parse_mode,
    disable_notification: params.disable_notification
  };

  if (params.reply_markup) {
    requestBody.reply_markup = params.reply_markup;
  }

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  return await response.json();
}

// 发送图片消息
async function sendPhotoMessage(params: {
  chat_id: number;
  photo: string;
  caption?: string;
  parse_mode: string;
  disable_notification: boolean;
  reply_markup?: any;
}) {
  const requestBody: any = {
    chat_id: params.chat_id,
    photo: params.photo,
    parse_mode: params.parse_mode,
    disable_notification: params.disable_notification
  };

  if (params.caption) {
    requestBody.caption = params.caption;
  }

  if (params.reply_markup) {
    requestBody.reply_markup = params.reply_markup;
  }

  const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody)
  });

  return await response.json();
}

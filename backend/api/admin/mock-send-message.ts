import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'POST') {
      return await sendMessage(req, res);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Mock Send Message API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 发送消息
async function sendMessage(req: VercelRequest, res: VercelResponse) {
  try {
    const { group_id, message, image_url, buttons } = req.body;

    console.log('Mock: 发送消息到群组', { group_id, message, image_url, buttons });

    return res.status(200).json({
      success: true,
      data: {
        message_id: Date.now(),
        sent_at: new Date().toISOString(),
        status: 'sent'
      }
    });

  } catch (error: any) {
    console.error('Send message error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
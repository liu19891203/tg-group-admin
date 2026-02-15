import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('Webhook received:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'GET request' });
  }
  
  const body = req.body;
  console.log('Update type:', 
    body.message ? 'message' : 
    body.callback_query ? 'callback_query' : 
    body.chat_member ? 'chat_member' : 
    body.my_chat_member ? 'my_chat_member' : 'unknown'
  );
  
  return res.status(200).json({ ok: true, received: true });
}

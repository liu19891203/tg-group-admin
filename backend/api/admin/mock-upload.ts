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
      return await uploadFile(req, res);
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    console.error('Mock Upload API error:', error);
    return res.status(500).json({ error: error.message });
  }
}

// 上传文件
async function uploadFile(req: VercelRequest, res: VercelResponse) {
  try {
    const { filename, filetype } = req.body;

    const mockUrl = `https://mock-cdn.example.com/uploads/${Date.now()}_${filename || 'file'}`;

    return res.status(200).json({
      success: true,
      data: {
        url: mockUrl,
        filename: filename || 'uploaded_file',
        size: 1024,
        mimetype: filetype || 'image/jpeg'
      }
    });

  } catch (error: any) {
    console.error('Upload file error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
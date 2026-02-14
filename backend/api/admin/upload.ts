import { VercelRequest, VercelResponse } from '@vercel/node';
import { createBot } from '../../lib/telegram';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // 检查是否有文件上传
    const contentType = req.headers['content-type'] || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ 
        success: false, 
        error: 'Content-Type must be multipart/form-data' 
      });
    }

    // 获取上传的文件数据
    // 注意：在 Vercel 环境中，文件上传需要特殊处理
    // 这里我们使用 base64 编码的图片数据
    const { image, filename } = req.body;

    if (!image) {
      return res.status(400).json({ 
        success: false, 
        error: 'No image data provided' 
      });
    }

    // 验证图片格式
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const base64Pattern = /^data:image\/(jpeg|png|gif|webp);base64,/;
    
    if (!base64Pattern.test(image)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid image format. Only JPG, PNG, GIF, WEBP are allowed' 
      });
    }

    // 提取 base64 数据
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // 检查文件大小 (最大 5MB)
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ 
        success: false, 
        error: 'Image size exceeds 5MB limit' 
      });
    }

    // 生成临时 URL（实际项目中应该上传到云存储）
    // 这里我们返回 base64 数据作为预览 URL
    // 实际发送时会通过 Telegram Bot API 上传
    const tempUrl = image;
    
    // 生成文件 ID（用于后续发送到 Telegram）
    const fileId = `upload_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    return res.status(200).json({
      success: true,
      data: {
        url: tempUrl,
        file_id: fileId,
        filename: filename || 'image.jpg',
        size: buffer.length
      }
    });

  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error' 
    });
  }
}

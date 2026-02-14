import { VercelRequest, VercelResponse } from '@vercel/node';
import { mockDb } from '../../../lib/mockDb';

interface MessageContent {
  text?: string;
  sticker_name?: string;
  image_url?: string;
  message_type: 'text' | 'sticker' | 'image' | 'video';
}

interface DetectionResult {
  is_ad: boolean;
  confidence: number;
  reason: string;
  matched_keywords?: string[];
  punishment: 'delete' | 'warn' | 'mute' | 'kick' | 'ban';
}

function detectAds(content: MessageContent, keywords: string[]): DetectionResult {
  const result: DetectionResult = {
    is_ad: false,
    confidence: 0,
    reason: '',
    punishment: 'delete'
  };

  // 检测文本广告
  if (content.text) {
    const text = content.text.toLowerCase();
    const matchedKeywords = keywords.filter(keyword => 
      text.includes(keyword.toLowerCase())
    );

    if (matchedKeywords.length > 0) {
      result.is_ad = true;
      result.confidence = Math.min(matchedKeywords.length * 0.3, 0.9);
      result.reason = `检测到广告关键词: ${matchedKeywords.join(', ')}`;
      result.matched_keywords = matchedKeywords;
      result.punishment = 'delete';
      return result;
    }

    // 检测联系方式
    const contactPatterns = [
      /\d{5,}/, // 长数字（可能是QQ号）
      /微信[:：]\s*\w+/,
      /QQ[:：]\s*\d+/,
      /加[微Vv]信/,
      /私聊/,
      /联系[方式]?/,
      /推广/,
      /广告/
    ];

    for (const pattern of contactPatterns) {
      if (pattern.test(text)) {
        result.is_ad = true;
        result.confidence = 0.8;
        result.reason = '检测到联系方式或推广内容';
        result.punishment = 'delete';
        return result;
      }
    }
  }

  // 检测贴纸广告
  if (content.sticker_name && content.sticker_name.includes('@')) {
    result.is_ad = true;
    result.confidence = 0.7;
    result.reason = '贴纸名称包含@引流信息';
    result.punishment = 'delete';
    return result;
  }

  // 简单的AI检测模拟（实际应该调用AI服务）
  if (content.text && content.text.length > 50) {
    const suspiciousPatterns = [
      '优惠', '折扣', '特价', '促销', '限时', '免费', '领取', '福利'
    ];
    
    const suspiciousCount = suspiciousPatterns.filter(pattern => 
      content.text!.toLowerCase().includes(pattern)
    ).length;

    if (suspiciousCount >= 2) {
      result.is_ad = true;
      result.confidence = Math.min(suspiciousCount * 0.2, 0.6);
      result.reason = 'AI检测到推广内容';
      result.punishment = 'warn';
    }
  }

  return result;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { groupId, message, config } = req.body as {
      groupId: string;
      message: MessageContent;
      config: any;
    };

    if (!groupId || !message) {
      return res.status(400).json({ error: '参数不完整' });
    }

    // 如果广告过滤未启用，直接返回非广告
    if (!config?.enabled) {
      return res.status(200).json({
        is_ad: false,
        confidence: 0,
        reason: '广告过滤未启用'
      });
    }

    const keywords = config.keywords || [];
    const result = detectAds(message, keywords);

    // 根据配置调整惩罚措施
    if (result.is_ad) {
      result.punishment = config.punishment || 'delete';
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error('Ads detection error:', error);
    return res.status(500).json({ error: '广告检测失败' });
  }
}

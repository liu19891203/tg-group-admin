import { VercelRequest, VercelResponse } from '@vercel/node';
import { autoDeleteService } from '../../services/autoDeleteService';

const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await autoDeleteService.processPendingDeletes();

    return res.status(200).json({
      success: true,
      message: `Processed ${result.processed} pending deletes`,
      ...result
    });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return res.status(500).json({ error: error.message });
  }
}

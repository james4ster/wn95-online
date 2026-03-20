import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const secret = process.env.CRON_SECRET ?? '';
  if (req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const response = await fetch(
    `${process.env.SUPABASE_URL}/functions/v1/ticker-news-cron`,
    {
      method: 'POST',
      headers: {
        'x-cron-secret': process.env.CRON_SECRET ?? '',
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await response.json();
  return res.status(200).json(data);
}

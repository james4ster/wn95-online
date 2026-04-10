export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const secret = process.env.CRON_SECRET ?? '';
  if (req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? '';

  const rankingsRes = await fetch(`${supabaseUrl}/functions/v1/power-rankings-cron`, {
    method: 'POST',
    headers: {
      'x-cron-secret': process.env.CRON_SECRET ?? '',
      'Content-Type': 'application/json',
    },
  });
  const rankingsData = await rankingsRes.json();

  return res.status(200).json({ rankings: rankingsData });
}

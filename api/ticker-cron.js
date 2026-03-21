export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET ?? '';
  if (req.headers['authorization'] !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const supabaseUrl = process.env.SUPABASE_URL ?? '';

  // Run ticker news cron
  const tickerRes = await fetch(`${supabaseUrl}/functions/v1/ticker-news-cron`, {
    method: 'POST',
    headers: {
      'x-cron-secret': process.env.CRON_SECRET ?? '',
      'Content-Type': 'application/json',
    },
  });
  const tickerData = await tickerRes.json();

  // Refresh Discord avatars
  const avatarRes = await fetch(`${supabaseUrl}/functions/v1/fetch-avatars`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY ?? ''}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  const avatarData = await avatarRes.json();

  return res.status(200).json({ ticker: tickerData, avatars: avatarData });
}

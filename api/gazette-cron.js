// api/gazette-cron.js
export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const response = await fetch(
    `${process.env.VITE_SUPABASE_URL}/functions/v1/gazette-daily-cron`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CRON_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  );

  const data = await response.json();
  return res.status(200).json(data);
}
export default async function handler(req, res) {
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
  console.log('CRON_SECRET set:', !!process.env.CRON_SECRET);

  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const response = await fetch(
    `${process.env.SUPABASE_URL}/functions/v1/gazette-daily-cron`,
    {
      method: 'POST',
      headers: {
        // Supabase gateway needs the anon key as Authorization
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        // Pass cron secret separately so your function can verify it
        'x-cron-secret': process.env.CRON_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    }
  );

  const data = await response.json();
  return res.status(200).json(data);
}
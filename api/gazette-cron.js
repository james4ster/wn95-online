// api/gazette-cron.js  (or api/gazette-cron/route.js if using App Router)
export default async function handler(req, res) {
  // Vercel automatically sets this header on cron invocations
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end('Unauthorized');
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/gazette-daily-cron`,
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
  res.status(200).json(data);
}
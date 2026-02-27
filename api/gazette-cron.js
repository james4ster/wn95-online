export default async function handler(req, res) {
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const url = 'https://gwaiwtgwdqadxmimiskf.supabase.co/functions/v1/gazette-daily-cron';
  console.log('Calling URL:', url);
  console.log('Anon key set:', !!process.env.SUPABASE_ANON_KEY);
  console.log('Anon key prefix:', process.env.SUPABASE_ANON_KEY?.slice(0, 20));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        'x-cron-secret': process.env.CRON_SECRET,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    console.log('Response status:', response.status);
    const text = await response.text();
    console.log('Raw response:', text.slice(0, 200));

    try {
      return res.status(200).json(JSON.parse(text));
    } catch {
      return res.status(200).json({ raw: text.slice(0, 200) });
    }
  } catch(e) {
    console.log('Fetch error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
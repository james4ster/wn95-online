export default async function handler(req, res) {
    if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  
    try {
      const response = await fetch(
        'https://gwaiwtgwdqadxmimiskf.supabase.co/functions/v1/fetch-avatars',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );
  
      const data = await response.json();
      return res.status(200).json(data);
  
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
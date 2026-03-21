export default async function handler(req, res) {
    const response = await fetch(
      `${process.env.WN95_SUPABASE_URL}/functions/v1/fetch-avatars`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WN95_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      }
    );
  
    const data = await response.json();
    res.status(200).json({ ok: true, ...data });
  }

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

  // 🔥 POST POWER RANKINGS NOTIFICATION TO DISCORD (BLUBBER)
  const discordRes = await fetch(process.env.DISCORD_BLUBBER_WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: `📊 Updated Weekly Power Rankings Now Available!\n👉 https://wn95-online.vercel.app/league/W/power-rankings`
    })
  });
  
  console.log("Discord status:", discordRes.status);

  return res.status(200).json({ rankings: rankingsData });
}

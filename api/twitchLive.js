import { createClient } from "@supabase/supabase-js";

// Use server-side supabase (no VITE_ prefix needed in API routes)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

let cachedToken = null;
let tokenExpiry = 0;

async function getAppAccessToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id:     process.env.TWITCH_CLIENT_ID,
      client_secret: process.env.TWITCH_CLIENT_SECRET,
      grant_type:    "client_credentials",
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to get Twitch token: ${res.status} ${txt}`);
  }

  const data = await res.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000; // refresh 1 min early
  return cachedToken;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const clientId = process.env.TWITCH_CLIENT_ID;
    if (!clientId || !process.env.TWITCH_CLIENT_SECRET) {
      return res.status(500).json({
        error: "Missing TWITCH_CLIENT_ID or TWITCH_CLIENT_SECRET in environment variables.",
      });
    }

    // ── Fetch all standings to determine latest season per league
    const { data: allStandings, error: standErr } = await supabase
      .from("standings")
      .select("season, coach");

    if (standErr) {
      console.error("Error fetching standings:", standErr.message);
    }

    const latestSeasons = {};
    allStandings?.forEach(s => {
      const league = s.season.charAt(0); // W, Q, V
      if (!latestSeasons[league] || s.season > latestSeasons[league]) {
        latestSeasons[league] = s.season;
      }
    });

    // ── Fetch managers with twitch_username AND in latest season per league
    const { data: managers, error: dbErr } = await supabase
      .from("managers")
      .select("twitch_username, coach_name")
      .not("twitch_username", "is", null)
      .neq("twitch_username", "")
      .in(
        "coach_name",
        allStandings
          .filter(s => Object.values(latestSeasons).includes(s.season))
          .map(s => s.coach)
      );

    if (dbErr) throw dbErr;
    if (!managers?.length) return res.status(200).json([]);

    const token = await getAppAccessToken();

    // Batch all usernames into ONE Twitch API call
    const params = managers
      .map(m => `user_login=${encodeURIComponent(m.twitch_username.trim())}`)
      .join("&");

    const twitchRes = await fetch(
      `https://api.twitch.tv/helix/streams?${params}&first=100`,
      {
        headers: {
          "Client-ID":     clientId,
          "Authorization": `Bearer ${token}`,
        },
      }
    );

    if (!twitchRes.ok) {
      const txt = await twitchRes.text();
      throw new Error(`Twitch streams API: ${twitchRes.status} ${txt}`);
    }

    const { data: liveStreams } = await twitchRes.json();

    const results = managers.map(m => {
      const stream = (liveStreams || []).find(
        s => s.user_login.toLowerCase() === m.twitch_username.trim().toLowerCase()
      );
      return {
        username:   m.twitch_username.trim(),
        coachName:  m.coach_name || null,
        isLive:     !!stream,
        twitchData: stream || null,
      };
    });

    return res.status(200).json(results);
  } catch (err) {
    console.error("[twitchLive]", err.message);
    return res.status(500).json({ error: err.message });
  }
}
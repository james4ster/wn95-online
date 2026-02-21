// api/twitchLive.js
import { supabase } from "../src/utils/supabaseClient";

export default async function handler(req, res) {
  try {
    // Get users from Supabase
    const { data: users, error } = await supabase
      .from("users")
      .select("twitch_username");

    if (error) throw error;

    const results = [];

    for (let u of users) {
      const response = await fetch(
        `https://api.twitch.tv/helix/streams?user_login=${u.twitch_username}`,
        {
          headers: {
            "Client-ID": process.env.TWITCH_CLIENT_ID,
            "Authorization": `Bearer ${process.env.TWITCH_OAUTH_TOKEN}`,
          },
        }
      );
      const data = await response.json();

      results.push({
        username: u.twitch_username,
        isLive: data.data?.length > 0,
        twitchData: data.data?.[0] || null,
      });
    }

    res.status(200).json(results);
  } catch (err) {
    console.error("Twitch API error:", err);
    res.status(500).json({ error: "Failed to fetch Twitch data" });
  }
}
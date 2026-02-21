// api/twitchLive.js
import { supabase } from "../src/utils/supabaseClient";

export default async function handler(req, res) {
  try {
    // Get Twitch usernames from the managers table
    const { data: managers, error } = await supabase
      .from("managers")
      .select("twitch_username");

    if (error) throw error;

    const results = [];

    for (let m of managers) {
      const response = await fetch(
        `https://api.twitch.tv/helix/streams?user_login=${m.twitch_username}`,
        {
          headers: {
            "Client-ID": process.env.TWITCH_CLIENT_ID,
            "Authorization": `Bearer ${process.env.TWITCH_OAUTH_TOKEN}`,
          },
        }
      );
      const data = await response.json();

      results.push({
        username: m.twitch_username,
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
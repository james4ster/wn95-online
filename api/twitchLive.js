// api/twitchLive.js
import fetch from "node-fetch";
import { supabase } from "../src/utils/supabaseClient";

export default async function handler(req, res) {
  try {
    // Read users from DB
    const users = await db.query("SELECT twitch_username FROM users"); 
    const results = [];

    for (let u of users.rows) {
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
        isLive: data.data.length > 0,
      });
    }

    res.status(200).json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch Twitch data" });
  }
}
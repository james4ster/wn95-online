// TwitchLiveWidget.jsx
import { useEffect, useState } from "react";

export default function TwitchLiveWidget() {
  const [liveUsers, setLiveUsers] = useState([]);

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch("/api/twitchLive");
        const data = await res.json();
        console.log("Live users:", data);
        setLiveUsers(data); // data should be an array of live users only
      } catch (err) {
        console.error("Failed to fetch live users:", err);
      }
    };

    fetchLive(); // initial fetch
    const interval = setInterval(fetchLive, 60000); // poll every minute

    return () => clearInterval(interval); // cleanup on unmount
  }, []);

  return (
    <div>
      {liveUsers.length === 0 && <p>No one is live right now.</p>}
      {liveUsers.map(user => (
        <div key={user.twitch_username} style={{ color: "green" }}>
          {user.twitch_username} is 🟢 Live
          {/* you can also show Discord ID or Twitch info if you want */}
          {user.discord_id && <span> | Discord: {user.discord_id}</span>}
        </div>
      ))}
    </div>
  );
}
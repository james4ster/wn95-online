// TwitchLiveWidget.jsx
// API fix note: twitchLive.js returns ALL managers (including offline ones).
// We filter to isLive === true on the client side.
// Make sure TWITCH_CLIENT_ID and TWITCH_OAUTH_TOKEN are set in your .env

import { useEffect, useState } from "react";

export default function TwitchLiveWidget() {
  const [streams, setStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const fetchLive = async () => {
      try {
        const res = await fetch("/api/twitchLive");
        const data = await res.json();
        // Filter to only live users — the API returns all managers including offline
        const live = (data || []).filter(u => u.isLive);
        setStreams(live);
      } catch (err) {
        console.error("Failed to fetch Twitch streams:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLive();
    const interval = setInterval(fetchLive, 60000);
    return () => clearInterval(interval);
  }, []);

  const hasLive = streams.length > 0;

  return (
    <>
      <div className={`twitch-widget ${hasLive ? "has-live" : "offline"} ${collapsed ? "collapsed" : ""}`}>
        {/* Header bar */}
        <div className="tw-header" onClick={() => setCollapsed(c => !c)}>
          <div className="tw-header-left">
            {/* Twitch icon */}
            <svg className="tw-logo" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
            </svg>
            <span className="tw-title">LIVE NOW</span>
            {hasLive && (
              <span className="tw-count">{streams.length}</span>
            )}
          </div>
          <div className="tw-header-right">
            {hasLive && <span className="live-pulse-dot" />}
            <span className="tw-chevron">{collapsed ? "▶" : "▼"}</span>
          </div>
        </div>

        {/* Stream list */}
        {!collapsed && (
          <div className="tw-body">
            {loading ? (
              <div className="tw-loading">
                <span className="tw-loading-dot" />
                <span className="tw-loading-dot" />
                <span className="tw-loading-dot" />
              </div>
            ) : !hasLive ? (
              <div className="tw-offline-msg">
                <span className="tw-offline-dot" />
                No streams active
              </div>
            ) : (
              streams.map(stream => (
                <a
                  key={stream.username}
                  href={`https://twitch.tv/${stream.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tw-stream-row"
                >
                  <span className="tw-live-indicator" />
                  <div className="tw-stream-info">
                    <span className="tw-username">{stream.username}</span>
                    {stream.twitchData?.game_name && (
                      <span className="tw-game">{stream.twitchData.game_name}</span>
                    )}
                  </div>
                  {stream.twitchData?.viewer_count != null && (
                    <span className="tw-viewers">
                      👁 {stream.twitchData.viewer_count.toLocaleString()}
                    </span>
                  )}
                  <span className="tw-watch">WATCH →</span>
                </a>
              ))
            )}
          </div>
        )}
      </div>

      <style>{`
        .twitch-widget {
          position: fixed;
          top: 80px;
          right: 1.5rem;
          z-index: 500;
          width: 240px;
          background: linear-gradient(180deg, #0e0e1a 0%, #0a0a12 100%);
          border-radius: 10px;
          overflow: hidden;
          transition: all 0.3s ease;
          font-family: 'VT323', monospace;
        }

        .twitch-widget.has-live {
          border: 2px solid rgba(0, 255, 100, 0.6);
          box-shadow:
            0 0 20px rgba(0, 255, 100, 0.25),
            0 0 40px rgba(0, 255, 100, 0.1),
            inset 0 0 20px rgba(0, 255, 100, 0.04);
        }

        .twitch-widget.offline {
          border: 2px solid rgba(100, 100, 130, 0.35);
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        }

        .twitch-widget.collapsed {
          width: 200px;
        }

        /* Header */
        .tw-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.55rem 0.85rem;
          cursor: pointer;
          user-select: none;
          transition: background 0.2s;
        }

        .twitch-widget.has-live .tw-header {
          background: linear-gradient(90deg, rgba(0,255,100,0.08) 0%, transparent 100%);
        }

        .tw-header:hover {
          background: rgba(255,255,255,0.04);
        }

        .tw-header-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .tw-logo {
          width: 14px;
          height: 14px;
          color: #9146FF;
          flex-shrink: 0;
        }

        .twitch-widget.has-live .tw-logo {
          color: #00FF64;
        }

        .tw-title {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.42rem;
          letter-spacing: 2px;
          color: #aaa;
        }

        .twitch-widget.has-live .tw-title {
          color: #00FF64;
          text-shadow: 0 0 8px rgba(0,255,100,0.6);
        }

        .tw-count {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.38rem;
          background: #00FF64;
          color: #000;
          border-radius: 3px;
          padding: 0.1rem 0.3rem;
          font-weight: bold;
        }

        .tw-header-right {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .live-pulse-dot {
          width: 8px;
          height: 8px;
          background: #00FF64;
          border-radius: 50%;
          box-shadow: 0 0 8px #00FF64;
          animation: livePulse 1.4s ease-in-out infinite;
        }

        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 8px #00FF64; }
          50% { opacity: 0.7; transform: scale(1.3); box-shadow: 0 0 16px #00FF64, 0 0 24px rgba(0,255,100,0.4); }
        }

        .tw-chevron {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.4rem;
          color: rgba(255,255,255,0.3);
        }

        /* Body */
        .tw-body {
          padding: 0 0.5rem 0.6rem;
        }

        /* Loading dots */
        .tw-loading {
          display: flex;
          justify-content: center;
          gap: 0.4rem;
          padding: 0.75rem 0;
        }

        .tw-loading-dot {
          width: 5px;
          height: 5px;
          background: rgba(255,255,255,0.3);
          border-radius: 50%;
          animation: loadBounce 1.2s ease-in-out infinite;
        }
        .tw-loading-dot:nth-child(2) { animation-delay: 0.2s; }
        .tw-loading-dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes loadBounce {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50% { opacity: 1; transform: translateY(-3px); }
        }

        /* Offline */
        .tw-offline-msg {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.35rem;
          font-size: 1.05rem;
          color: rgba(255,255,255,0.25);
        }

        .tw-offline-dot {
          width: 6px;
          height: 6px;
          background: rgba(255,255,255,0.2);
          border-radius: 50%;
          flex-shrink: 0;
        }

        /* Stream row */
        .tw-stream-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.45rem 0.35rem;
          border-radius: 6px;
          text-decoration: none;
          transition: background 0.15s;
          border-top: 1px solid rgba(0,255,100,0.08);
        }

        .tw-stream-row:first-child {
          border-top: none;
        }

        .tw-stream-row:hover {
          background: rgba(0,255,100,0.08);
        }

        .tw-live-indicator {
          width: 6px;
          height: 6px;
          background: #00FF64;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 6px #00FF64;
          animation: livePulse 1.4s ease-in-out infinite;
        }

        .tw-stream-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.05rem;
          min-width: 0;
        }

        .tw-username {
          font-size: 1.1rem;
          color: #E0E0E0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: 0.5px;
        }

        .tw-game {
          font-size: 0.85rem;
          color: rgba(135,206,235,0.5);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .tw-viewers {
          font-size: 0.85rem;
          color: rgba(255,215,0,0.6);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .tw-watch {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.32rem;
          color: #00FF64;
          letter-spacing: 1px;
          flex-shrink: 0;
          opacity: 0;
          transition: opacity 0.15s;
        }

        .tw-stream-row:hover .tw-watch {
          opacity: 1;
        }

        @media (max-width: 768px) {
          .twitch-widget {
            top: auto;
            bottom: 60px;
            right: 0.75rem;
            width: 210px;
          }
        }
      `}</style>
    </>
  );
}
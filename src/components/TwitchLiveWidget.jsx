// src/components/TwitchLiveWidget.jsx
import { useEffect, useState } from "react";

export default function TwitchLiveWidget() {
  const [all,       setAll]       = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const res = await fetch("/api/twitchLive");
        // Check content-type before parsing — catches 500 HTML error pages
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          const txt = await res.text();
          throw new Error(`Server error (${res.status}): ${txt.slice(0, 120)}`);
        }
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setAll(data || []);
        setError(null);
      } catch (err) {
        console.error("[TwitchWidget]", err.message);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetch_();
    const id = setInterval(fetch_, 60000);
    return () => clearInterval(id);
  }, []);

      const MAX = 4;

      const live = all
        .filter(u => u.isLive)
        .sort((a, b) =>
          (b.twitchData?.viewer_count || 0) -
          (a.twitchData?.viewer_count || 0)
        );

      const offline = all.filter(u => !u.isLive);

      const displayLive = live.slice(0, MAX);
      const remainingSlots = MAX - displayLive.length;
      const displayOffline =
        remainingSlots > 0 ? offline.slice(0, remainingSlots) : [];

      const hasLive = displayLive.length > 0;

  return (
    <>
      <div className={`twg ${hasLive ? "twg-live" : "twg-off"} ${collapsed ? "twg-col" : ""}`}>

        {/* ── Header ── */}
        <button className="twg-hdr" onClick={() => setCollapsed(c => !c)}>
          <svg className="twg-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
          </svg>
          <span className="twg-title">STREAMS</span>
          {hasLive && <span className="twg-badge">{live.length} LIVE</span>}
          {!hasLive && !loading && <span className="twg-badge twg-badge-off">OFFLINE</span>}
          <span className="twg-caret">{collapsed ? "▶" : "▼"}</span>
        </button>

        {/* ── Body ── */}
        {!collapsed && (
          <div className="twg-body">
            {loading ? (
              <div className="twg-dots">
                <span/><span/><span/>
              </div>
            ) : error ? (
              <div className="twg-err">
                <span className="twg-err-icon">⚠</span>
                <span className="twg-err-msg">
                  {error.includes("CLIENT_ID") || error.includes("credentials")
                    ? "Add TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET to .env"
                    : "Twitch unavailable"}
                </span>
              </div>
            ) : (
              <>
                {/* Live streams */}
                {hasLive && (
                  <div className="twg-section">
                    <div className="twg-section-lbl twg-lbl-live">● LIVE NOW</div>
                    {displayLive.map(s => (
                      <a key={s.username} href={`https://twitch.tv/${s.username}`}
                        target="_blank" rel="noopener noreferrer" className="twg-row twg-row-live">
                        <span className="twg-pulse"/>
                        <div className="twg-info">
                          <span className="twg-uname">{s.username}</span>
                          {s.twitchData?.game_name && (
                            <span className="twg-game">{s.twitchData.game_name}</span>
                          )}
                        </div>
                        {s.twitchData?.viewer_count != null && (
                          <span className="twg-viewers">
                            {s.twitchData.viewer_count.toLocaleString()}
                            <em>👁</em>
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                )}

                {/* Offline / recent */}
                {offline.length > 0 && (
                  <div className="twg-section">
                    <div className="twg-section-lbl">LEAGUE STREAMERS</div>
                    {displayOffline.map(s => (
                      <a key={s.username} href={`https://twitch.tv/${s.username}`}
                        target="_blank" rel="noopener noreferrer" className="twg-row twg-row-off">
                        <span className="twg-dot-off"/>
                        <div className="twg-info">
                          <span className="twg-uname twg-uname-off">{s.username}</span>
                          {s.coachName && <span className="twg-game">{s.coachName}</span>}
                        </div>
                        <span className="twg-watch-lbl">FOLLOW</span>
                      </a>
                    ))}
                  </div>
                )}

                {all.length === 0 && (
                  <div className="twg-empty">No streamers configured yet</div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <style>{`
        .twg {
          position: fixed;
          top: 140px; /* move it below the submenu */
          right: 1.25rem;
          z-index: 500;
          width: 230px;
          background: linear-gradient(180deg,#0b0b18 0%,#070710 100%);
          border-radius: 10px;
          overflow: hidden;
          font-family:'VT323',monospace;
          transition: box-shadow .3s, border-color .3s;
        }
        .twg-live {
          border: 1.5px solid rgba(0,255,100,.55);
          box-shadow: 0 0 18px rgba(0,255,100,.18), 0 0 40px rgba(0,255,100,.07);
        }
        .twg-off {
          border: 1.5px solid rgba(100,100,140,.3);
          box-shadow: 0 4px 20px rgba(0,0,0,.5);
        }

        /* Header */
        .twg-hdr {
          width: 100%; display: flex; align-items: center; gap: .45rem;
          padding: .5rem .75rem; cursor: pointer; background: none; border: none;
          transition: background .2s; text-align: left;
        }
        .twg-live .twg-hdr { background: rgba(0,255,100,.05); }
        .twg-hdr:hover { background: rgba(255,255,255,.04); }

        .twg-icon {
          width: 12px; height: 12px; flex-shrink: 0;
          color: rgba(145,70,255,.7);
        }
        .twg-live .twg-icon { color: #00FF64; }

        .twg-title {
          font-family: 'Press Start 2P', monospace; font-size: .38rem;
          letter-spacing: 2px; color: rgba(255,255,255,.4); flex: 1;
        }
        .twg-live .twg-title { color: #00FF64; text-shadow: 0 0 8px rgba(0,255,100,.5); }

        .twg-badge {
          font-family: 'Press Start 2P', monospace; font-size: .3rem;
          background: #00FF64; color: #000; border-radius: 3px;
          padding: .1rem .35rem; letter-spacing: 1px;
        }
        .twg-badge-off {
          background: transparent; color: rgba(255,255,255,.2);
          border: 1px solid rgba(255,255,255,.1);
        }

        .twg-caret {
          font-family: 'Press Start 2P', monospace; font-size: .35rem;
          color: rgba(255,255,255,.2);
        }

        /* Body */
        .twg-body { padding: 0 0 .5rem; }

        .twg-dots {
          display: flex; justify-content: center; gap: .35rem; padding: .75rem 0;
        }
        .twg-dots span {
          width: 4px; height: 4px; border-radius: 50%;
          background: rgba(255,255,255,.2);
          animation: twgBounce 1.2s ease-in-out infinite;
        }
        .twg-dots span:nth-child(2) { animation-delay:.15s }
        .twg-dots span:nth-child(3) { animation-delay:.3s  }
        @keyframes twgBounce {
          0%,100%{opacity:.2;transform:translateY(0)}
          50%{opacity:.8;transform:translateY(-3px)}
        }

        /* Error */
        .twg-err {
          display: flex; align-items: flex-start; gap: .4rem;
          padding: .6rem .75rem; font-size: .85rem; color: rgba(255,140,0,.7);
        }
        .twg-err-icon { font-size: 1rem; flex-shrink: 0; }
        .twg-err-msg { font-size: .85rem; line-height: 1.3; }

        /* Section labels */
        .twg-section { border-top: 1px solid rgba(255,255,255,.06); }
        .twg-section:first-child { border-top: none; }
        .twg-section-lbl {
          font-family: 'Press Start 2P', monospace; font-size: .3rem;
          letter-spacing: 1.5px; color: rgba(255,255,255,.2);
          padding: .45rem .75rem .2rem;
        }
        .twg-lbl-live { color: #00FF64; text-shadow: 0 0 6px rgba(0,255,100,.4); }

        /* Stream rows */
        .twg-row {
          display: flex; align-items: center; gap: .45rem;
          padding: .35rem .75rem; text-decoration: none;
          transition: background .15s; border-radius: 0;
        }
        .twg-row:hover { background: rgba(255,255,255,.04); }
        .twg-row-live:hover { background: rgba(0,255,100,.06); }

        .twg-pulse {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
          background: #00FF64; box-shadow: 0 0 6px #00FF64;
          animation: twgPulse 1.4s ease-in-out infinite;
        }
        @keyframes twgPulse {
          0%,100%{opacity:1;box-shadow:0 0 6px #00FF64}
          50%{opacity:.6;box-shadow:0 0 14px #00FF64,0 0 24px rgba(0,255,100,.3)}
        }

        .twg-dot-off {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
          background: rgba(255,255,255,.12);
        }

        .twg-info { flex: 1; display: flex; flex-direction: column; gap: .05rem; min-width: 0; }
        .twg-uname { font-size: 1rem; color: #E0E0E0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .twg-uname-off { color: rgba(255,255,255,.35); }
        .twg-game { font-size: .8rem; color: rgba(135,206,235,.4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .twg-viewers { font-size: .85rem; color: rgba(255,215,0,.6); white-space: nowrap; flex-shrink: 0; }
        .twg-viewers em { font-style: normal; margin-left: .15rem; }

        .twg-watch-lbl {
          font-family: 'Press Start 2P', monospace; font-size: .28rem;
          color: rgba(145,70,255,.4); letter-spacing: 1px; flex-shrink: 0;
          opacity: 0; transition: opacity .15s;
        }
        .twg-row:hover .twg-watch-lbl { opacity: 1; }

        .twg-empty {
          font-size: .95rem; color: rgba(255,255,255,.2); padding: .6rem .75rem;
          text-align: center; letter-spacing: 1px;
        }

        @media (max-width:768px) {
          .twg { top: 160px; bottom: auto; right: .75rem; width: 210px; }
        }
      `}</style>
    </>
  );
}
import { useEffect, useState } from 'react';
import { supabase } from "../utils/supabaseClient";
import TwitchLiveWidget from "../components/TwitchLiveWidget";

export default function Home() {
  const [recentGames, setRecentGames] = useState([]);
  const [topScorers, setTopScorers]   = useState([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    const fetchHomeData = async () => {
      setLoading(true);

      // Recent games — adjust column names to match your schema
      const { data: games } = await supabase
        .from('games')
        .select('*')
        .order('game', { ascending: false })
        .limit(20);

      setRecentGames(games || []);

      // Uncomment when player_stats is ready:
      // const { data: scorers } = await supabase
      //   .from('player_stats')
      //   .select('player_name, team, goals, assists, points')
      //   .order('points', { ascending: false })
      //   .limit(8);
      // setTopScorers(scorers || []);

      setLoading(false);
    };

    fetchHomeData();
  }, []);

  const leagues = [
    { name: 'WN95',    code: 'WN95',    color: '#87CEEB' },
    { name: 'The Q',   code: 'Q',       color: '#FFD700' },
    { name: 'Vintage', code: 'VTG',     color: '#FF8C00' },
  ];

  // Duplicate games for seamless looping ticker
  const tickerGames = recentGames.length > 0
    ? [...recentGames, ...recentGames]
    : null;

  return (
    <div className="home-page">

      {/* Scanline overlay for CRT effect */}
      <div className="scanlines" aria-hidden="true" />

      {/* Twitch Live Widget — fixed top-right */}
      <TwitchLiveWidget />

      {/* Discord Button — fixed, below Twitch widget */}
      <a
        href="https://discord.gg/YOUR_INVITE"
        target="_blank"
        rel="noopener noreferrer"
        className="discord-fab"
        title="Join our Discord"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
        </svg>
      </a>

      {/* ── HERO ── */}
      <header className="hero">
        <div className="hero-inner">
          <div className="hero-eyebrow">ESTABLISHED 2019</div>
          <h1 className="hero-title">
            <span className="hero-nhl">NHL</span>
            <span className="hero-95">'95</span>
            <span className="hero-online">ONLINE</span>
          </h1>
          <p className="hero-sub">RETRO HOCKEY. REAL COMPETITION.</p>

          {/* League pills — compact, no huge logos */}
          <div className="league-pills">
            {leagues.map(l => (
              <div key={l.code} className="league-pill" style={{ '--league-color': l.color }}>
                <span className="pill-dot" />
                <span className="pill-name">{l.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Decorative grid lines */}
        <div className="hero-grid" aria-hidden="true" />
      </header>

      {/* ── STATS STRIP ── */}
      <div className="stats-strip">
        {[
          { n: '3',     l: 'LEAGUES'  },
          { n: '50+',   l: 'TEAMS'    },
          { n: '200+',  l: 'MANAGERS' },
          { n: '1000+', l: 'GAMES'    },
        ].map(s => (
          <div key={s.l} className="strip-stat">
            <span className="strip-num">{s.n}</span>
            <span className="strip-lbl">{s.l}</span>
          </div>
        ))}
      </div>

      {/* ── MAIN CONTENT ── */}
      <main className="content-grid">

        {/* Recent Games column */}
        <section className="panel panel-games">
          <div className="panel-header">
            <span className="panel-icon">🏒</span>
            <span className="panel-title">RECENT RESULTS</span>
          </div>
          <div className="games-list">
            {loading ? (
              <div className="panel-loading">
                {[1,2,3,4].map(i => <div key={i} className="skeleton-row" />)}
              </div>
            ) : recentGames.length === 0 ? (
              <div className="panel-empty">SEASON DATA LOADING...</div>
            ) : (
              recentGames.slice(0, 8).map((game, i) => (
                <div key={i} className="game-row">
                  <div className="game-team game-team--home">
                    <img
                      src={`/assets/teamLogos/${game.home_team}.png`}
                      alt=""
                      className="game-logo"
                      onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                    <span className="game-team-name">{game.home_team}</span>
                  </div>
                  <div className="game-score-block">
                    <span className={`game-score ${game.home_score > game.away_score ? 'score-win' : ''}`}>
                      {game.home_score ?? '—'}
                    </span>
                    <span className="game-score-sep">:</span>
                    <span className={`game-score ${game.away_score > game.home_score ? 'score-win' : ''}`}>
                      {game.away_score ?? '—'}
                    </span>
                  </div>
                  <div className="game-team game-team--away">
                    <span className="game-team-name">{game.away_team}</span>
                    <img
                      src={`/assets/teamLogos/${game.away_team}.png`}
                      alt=""
                      className="game-logo"
                      onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Top Scorers column */}
        <section className="panel panel-scorers">
          <div className="panel-header">
            <span className="panel-icon">⭐</span>
            <span className="panel-title">TOP SCORERS</span>
          </div>
          <div className="scorers-list">
            {topScorers.length === 0 ? (
              <div className="panel-empty">STATS COMING SOON...</div>
            ) : (
              topScorers.map((s, i) => (
                <div key={i} className={`scorer-row ${i === 0 ? 'scorer-row--gold' : ''}`}>
                  <span className="scorer-rank">#{i + 1}</span>
                  <div className="scorer-info">
                    <span className="scorer-name">{s.player_name}</span>
                    <span className="scorer-team">{s.team}</span>
                  </div>
                  <div className="scorer-stats">
                    <span className="scorer-stat">{s.goals}<em>G</em></span>
                    <span className="scorer-stat">{s.assists}<em>A</em></span>
                    <span className="scorer-stat scorer-pts">{s.points}<em>P</em></span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </main>

      {/* ── BOTTOM TICKER ── */}
      <div className="ticker-bar">
        <div className="ticker-badge">SCORES</div>
        <div className="ticker-track">
          {tickerGames ? (
            <div className="ticker-reel">
              {tickerGames.map((game, i) => (
                <div key={i} className="ticker-item">
                  <img
                    src={`/assets/teamLogos/${game.home_team}.png`}
                    alt=""
                    className="ticker-logo"
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span className="ticker-team-name">{game.home_team}</span>
                  <span className={`ticker-score-val ${game.home_score > game.away_score ? 'tv-win' : ''}`}>
                    {game.home_score}
                  </span>
                  <span className="ticker-sep">–</span>
                  <span className={`ticker-score-val ${game.away_score > game.home_score ? 'tv-win' : ''}`}>
                    {game.away_score}
                  </span>
                  <span className="ticker-team-name">{game.away_team}</span>
                  <img
                    src={`/assets/teamLogos/${game.away_team}.png`}
                    alt=""
                    className="ticker-logo"
                    onError={e => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span className="ticker-divider">◆</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="ticker-placeholder">
              SCORES WILL APPEAR HERE ONCE GAMES ARE RECORDED &nbsp;◆&nbsp; STAY TUNED &nbsp;◆&nbsp;
              SCORES WILL APPEAR HERE ONCE GAMES ARE RECORDED &nbsp;◆&nbsp; STAY TUNED &nbsp;◆&nbsp;
            </div>
          )}
        </div>
      </div>

      <style>{`
        /* ── RESET & BASE ─────────────────────────────────── */
        *, *::before, *::after { box-sizing: border-box; }

        .home-page {
          min-height: 100vh;
          background: radial-gradient(ellipse 120% 60% at 50% 0%, #0d0d22 0%, #000005 60%);
          padding-bottom: 54px; /* ticker height */
          position: relative;
          overflow-x: hidden;
        }

        /* CRT scanlines */
        .scanlines {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9999;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0, 0, 0, 0.07) 2px,
            rgba(0, 0, 0, 0.07) 4px
          );
        }

        /* ── FIXED UI ─────────────────────────────────────── */
        .discord-fab {
          position: fixed;
          top: 80px;
          right: 1.5rem;
          z-index: 499; /* just below twitch widget */
          width: 46px;
          height: 46px;
          background: linear-gradient(135deg, #5865F2 0%, #4752C4 100%);
          border: 2px solid rgba(255,255,255,0.15);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          text-decoration: none;
          transition: all 0.25s ease;
          box-shadow: 0 4px 16px rgba(88,101,242,0.4);
          margin-top: 220px; /* push below twitch widget — adjust to taste */
        }

        .discord-fab svg {
          width: 22px;
          height: 22px;
        }

        .discord-fab:hover {
          transform: scale(1.12) rotate(-5deg);
          box-shadow: 0 0 24px rgba(88,101,242,0.8), 0 0 48px rgba(88,101,242,0.3);
          border-color: rgba(255,255,255,0.4);
        }

        /* ── HERO ─────────────────────────────────────────── */
        .hero {
          position: relative;
          text-align: center;
          padding: 3.5rem 2rem 2.5rem;
          overflow: hidden;
        }

        /* Subtle perspective grid on hero */
        .hero-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(135,206,235,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(135,206,235,0.04) 1px, transparent 1px);
          background-size: 60px 60px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 100%, black 0%, transparent 100%);
          -webkit-mask-image: radial-gradient(ellipse 80% 60% at 50% 100%, black 0%, transparent 100%);
        }

        .hero-inner { position: relative; z-index: 1; }

        .hero-eyebrow {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.5rem;
          letter-spacing: 5px;
          color: rgba(135,206,235,0.4);
          margin-bottom: 1.2rem;
        }

        .hero-title {
          font-family: 'Press Start 2P', monospace;
          font-size: clamp(2rem, 5vw, 3.8rem);
          line-height: 1;
          margin: 0 0 1rem;
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 0.4em;
          flex-wrap: wrap;
        }

        .hero-nhl {
          color: #87CEEB;
          text-shadow: 0 0 30px rgba(135,206,235,0.5);
        }

        .hero-95 {
          color: #FFD700;
          text-shadow: 0 0 20px #FF8C00, 0 0 40px rgba(255,140,0,0.4);
          font-size: 1.2em;
        }

        .hero-online {
          color: #FF8C00;
          text-shadow: 0 0 20px rgba(255,140,0,0.6);
          font-size: 0.7em;
          align-self: flex-end;
          padding-bottom: 0.15em;
        }

        .hero-sub {
          font-family: 'VT323', monospace;
          font-size: 1.4rem;
          color: rgba(255,255,255,0.35);
          letter-spacing: 4px;
          margin: 0 0 2rem;
        }

        /* League pills */
        .league-pills {
          display: flex;
          justify-content: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .league-pill {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.35rem 0.9rem;
          border: 1px solid color-mix(in srgb, var(--league-color) 40%, transparent);
          border-radius: 20px;
          background: color-mix(in srgb, var(--league-color) 8%, transparent);
          cursor: pointer;
          transition: all 0.2s;
        }

        .league-pill:hover {
          background: color-mix(in srgb, var(--league-color) 18%, transparent);
          border-color: var(--league-color);
          transform: translateY(-2px);
          box-shadow: 0 4px 16px color-mix(in srgb, var(--league-color) 30%, transparent);
        }

        .pill-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--league-color);
          box-shadow: 0 0 8px var(--league-color);
        }

        .pill-name {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.52rem;
          color: var(--league-color);
          letter-spacing: 1px;
        }

        /* ── STATS STRIP ──────────────────────────────────── */
        .stats-strip {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 0;
          border-top: 1px solid rgba(255,140,0,0.2);
          border-bottom: 1px solid rgba(255,140,0,0.2);
          background: linear-gradient(90deg,
            transparent 0%,
            rgba(255,140,0,0.05) 50%,
            transparent 100%
          );
          padding: 1rem 0;
        }

        .strip-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
          padding: 0.5rem 3rem;
          border-right: 1px solid rgba(255,140,0,0.15);
          transition: background 0.2s;
        }

        .strip-stat:last-child { border-right: none; }

        .strip-stat:hover {
          background: rgba(255,140,0,0.06);
        }

        .strip-num {
          font-family: 'Press Start 2P', monospace;
          font-size: 1.6rem;
          color: #FFD700;
          text-shadow: 0 0 12px rgba(255,215,0,0.4);
          line-height: 1;
        }

        .strip-lbl {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.38rem;
          color: rgba(135,206,235,0.5);
          letter-spacing: 2px;
        }

        /* ── CONTENT GRID ─────────────────────────────────── */
        .content-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }

        .panel {
          background: linear-gradient(160deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%);
          border: 2px solid rgba(135,206,235,0.18);
          border-radius: 12px;
          overflow: hidden;
        }

        .panel-header {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.85rem 1.25rem;
          background: linear-gradient(90deg, rgba(255,140,0,0.08) 0%, transparent 100%);
          border-bottom: 1px solid rgba(255,140,0,0.2);
        }

        .panel-icon { font-size: 1rem; }

        .panel-title {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.52rem;
          color: #FF8C00;
          letter-spacing: 2px;
          text-shadow: 0 0 8px rgba(255,140,0,0.4);
        }

        .panel-empty {
          padding: 2rem;
          font-family: 'VT323', monospace;
          font-size: 1.2rem;
          color: rgba(255,255,255,0.2);
          text-align: center;
          letter-spacing: 2px;
        }

        .panel-loading {
          padding: 1rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .skeleton-row {
          height: 44px;
          border-radius: 6px;
          background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
        }

        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }

        /* ── GAMES LIST ───────────────────────────────────── */
        .games-list {
          padding: 0.5rem 0;
        }

        .game-row {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 0.5rem;
          padding: 0.55rem 1.25rem;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          transition: background 0.15s;
        }

        .game-row:last-child { border-bottom: none; }
        .game-row:hover { background: rgba(255,140,0,0.06); }

        .game-team {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .game-team--home { justify-content: flex-end; flex-direction: row-reverse; }
        .game-team--away { justify-content: flex-start; }

        .game-logo {
          width: 26px;
          height: 26px;
          object-fit: contain;
          filter: drop-shadow(0 0 4px rgba(135,206,235,0.3));
        }

        .game-team-name {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.48rem;
          color: #87CEEB;
          letter-spacing: 0.5px;
        }

        .game-score-block {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          background: rgba(0,0,0,0.35);
          border: 1px solid rgba(255,140,0,0.2);
          border-radius: 6px;
          padding: 0.25rem 0.6rem;
        }

        .game-score {
          font-family: 'VT323', monospace;
          font-size: 1.6rem;
          color: rgba(255,255,255,0.5);
          line-height: 1;
          min-width: 18px;
          text-align: center;
        }

        .game-score.score-win {
          color: #FFD700;
          text-shadow: 0 0 8px rgba(255,215,0,0.5);
        }

        .game-score-sep {
          font-family: 'VT323', monospace;
          font-size: 1.2rem;
          color: rgba(255,140,0,0.4);
        }

        /* ── SCORERS LIST ─────────────────────────────────── */
        .scorers-list {
          padding: 0.5rem 0;
        }

        .scorer-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.6rem 1.25rem;
          border-bottom: 1px solid rgba(255,255,255,0.04);
          border-left: 3px solid transparent;
          transition: all 0.15s;
        }

        .scorer-row:last-child { border-bottom: none; }

        .scorer-row--gold {
          border-left-color: #FFD700;
          background: rgba(255,215,0,0.04);
        }

        .scorer-row:hover {
          background: rgba(255,140,0,0.07);
          border-left-color: #FF8C00;
          transform: translateX(3px);
        }

        .scorer-rank {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.55rem;
          color: rgba(255,140,0,0.6);
          min-width: 32px;
        }

        .scorer-row--gold .scorer-rank {
          color: #FFD700;
          text-shadow: 0 0 8px rgba(255,215,0,0.5);
        }

        .scorer-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .scorer-name {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.52rem;
          color: #E0E0E0;
        }

        .scorer-team {
          font-family: 'VT323', monospace;
          font-size: 1rem;
          color: rgba(135,206,235,0.45);
          letter-spacing: 1px;
        }

        .scorer-stats {
          display: flex;
          gap: 0.6rem;
          align-items: center;
        }

        .scorer-stat {
          font-family: 'VT323', monospace;
          font-size: 1.3rem;
          color: #aaa;
        }

        .scorer-stat em {
          font-style: normal;
          font-size: 0.8em;
          color: rgba(135,206,235,0.4);
          margin-left: 1px;
        }

        .scorer-pts {
          color: #FFD700;
          font-size: 1.6rem;
        }

        .scorer-pts em { color: rgba(255,215,0,0.4); }

        /* ── BOTTOM TICKER ────────────────────────────────── */
        .ticker-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 50px;
          display: flex;
          align-items: stretch;
          background: linear-gradient(0deg, #050510 0%, #0a0a1a 100%);
          border-top: 2px solid #FF8C00;
          z-index: 200;
          box-shadow: 0 -4px 30px rgba(255,140,0,0.2);
        }

        .ticker-badge {
          display: flex;
          align-items: center;
          padding: 0 1.25rem;
          background: #FF8C00;
          font-family: 'Press Start 2P', monospace;
          font-size: 0.52rem;
          color: #000;
          letter-spacing: 2px;
          white-space: nowrap;
          border-right: 2px solid #FFD700;
          flex-shrink: 0;
        }

        .ticker-track {
          flex: 1;
          overflow: hidden;
          display: flex;
          align-items: center;
        }

        /* Scroll animation — adjust speed via duration */
        .ticker-reel {
          display: flex;
          align-items: center;
          gap: 0;
          animation: tickerScroll 60s linear infinite;
          white-space: nowrap;
          will-change: transform;
        }

        .ticker-reel:hover { animation-play-state: paused; }

        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        .ticker-item {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0 1.5rem;
          flex-shrink: 0;
        }

        .ticker-logo {
          width: 22px;
          height: 22px;
          object-fit: contain;
          filter: drop-shadow(0 0 3px rgba(135,206,235,0.4));
        }

        .ticker-team-name {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.5rem;
          color: #87CEEB;
          letter-spacing: 0.5px;
        }

        .ticker-score-val {
          font-family: 'VT323', monospace;
          font-size: 1.7rem;
          color: rgba(255,255,255,0.55);
          line-height: 1;
          min-width: 16px;
          text-align: center;
        }

        .ticker-score-val.tv-win {
          color: #FFD700;
          text-shadow: 0 0 8px rgba(255,215,0,0.5);
        }

        .ticker-sep {
          font-family: 'VT323', monospace;
          font-size: 1.2rem;
          color: rgba(255,140,0,0.4);
        }

        .ticker-divider {
          font-size: 0.5rem;
          color: rgba(255,140,0,0.3);
          padding: 0 0.5rem;
        }

        /* Placeholder when no games */
        .ticker-placeholder {
          font-family: 'VT323', monospace;
          font-size: 1.3rem;
          color: rgba(255,255,255,0.2);
          letter-spacing: 3px;
          animation: tickerScroll 20s linear infinite;
          white-space: nowrap;
          will-change: transform;
        }

        /* ── RESPONSIVE ───────────────────────────────────── */
        @media (max-width: 1024px) {
          .content-grid { grid-template-columns: 1fr; }
          .strip-stat { padding: 0.5rem 2rem; }
        }

        @media (max-width: 768px) {
          .hero { padding: 2rem 1rem 1.5rem; }
          .hero-title { font-size: clamp(1.4rem, 7vw, 2.2rem); }
          .content-grid { padding: 1rem; gap: 1rem; }
          .strip-stat { padding: 0.5rem 1.2rem; }
          .strip-num { font-size: 1.1rem; }
          .discord-fab { margin-top: 260px; }
        }

        @media (max-width: 500px) {
          .stats-strip { gap: 0; flex-wrap: wrap; }
          .strip-stat { padding: 0.5rem 1rem; border-right: none; width: 50%; border-bottom: 1px solid rgba(255,140,0,0.1); }
          .league-pills { gap: 0.5rem; }
        }
      `}</style>
    </div>
  );
}
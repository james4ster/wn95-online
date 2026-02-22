import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from './LeagueContext';

// ─── League config (must match LeagueContext prefix values) ──────────────────
const lgPrefix = lg => (lg || '').replace(/[0-9]/g, '').trim();

const LEAGUE_CFG = {
  W: { label: 'WN95',    color: '#87CEEB', dim: 'rgba(135,206,235,.12)' },
  Q: { label: 'THE Q',   color: '#FFD700', dim: 'rgba(255,215,0,.12)'   },
  V: { label: 'VINTAGE', color: '#FF6B35', dim: 'rgba(255,107,53,.12)'  },
};
const getCfg = prefix => LEAGUE_CFG[prefix] ?? { label: prefix, color: '#aaa', dim: 'rgba(170,170,170,.08)' };

// ─── Single game card ─────────────────────────────────────────────────────────
function ScoreCard({ game, color }) {
  const homeWin = Number(game.score_home) > Number(game.score_away);
  const awayWin = Number(game.score_away) > Number(game.score_home);
  const isOT    = Number(game.ot) === 1 ||
    (game.result_home || '').toUpperCase().includes('OT') ||
    (game.result_away || '').toUpperCase().includes('OT');

  return (
    <div className="sc-card" style={{ '--lc': color }}>
      <div className="sc-accent" />
      <div className="sc-inner">
        {/* Left: logos stacked, away on top */}
        <div className="sc-teams">
          <div className="sc-team-row">
            <img src={`/assets/teamLogos/${game.away}.png`} alt={game.away} className="sc-logo"
              onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling.style.display='flex'; }} />
            <div className="sc-logo-fb">{(game.away||'').slice(0,3)}</div>
          </div>
          <div className="sc-divline" />
          <div className="sc-team-row">
            <img src={`/assets/teamLogos/${game.home}.png`} alt={game.home} className="sc-logo"
              onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling.style.display='flex'; }} />
            <div className="sc-logo-fb">{(game.home||'').slice(0,3)}</div>
          </div>
        </div>

        {/* Right: scores with OT pill centered above the score */}
        <div className="sc-scores">
          <div className="score-container">
            {isOT && <span className="sc-ot">OT</span>}
            <span className={`sc-score ${awayWin ? 'sc-win' : ''}`}>{game.score_away ?? '—'}</span>
          </div>
          <div className="score-container">
            <span className={`sc-score ${homeWin ? 'sc-win' : ''}`}>{game.score_home ?? '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="sc-card sc-skel">
      <div className="sc-accent" style={{ opacity: .15 }} />
      <div className="sc-inner">
        <div className="sc-teams">
          <div className="sc-team-row"><div className="sc-ph sc-ph-logo" /></div>
          <div className="sc-divline" />
          <div className="sc-team-row"><div className="sc-ph sc-ph-logo" /></div>
        </div>
        <div className="sc-scores">
          <div className="sc-ph sc-ph-score" />
          <div className="sc-ph sc-ph-score" />
        </div>
      </div>
    </div>
  );
}

// ─── ScoresBar ────────────────────────────────────────────────────────────────
// Place ABOVE <MainNavigation> in your layout component:
//   <ScoresBar />
//   <MainNavigation />
//   <LeagueSubNav />
//   <main>...</main>
export default function ScoresBar() {
  const { selectedLeague } = useLeague();
  const [gamesByPrefix, setGamesByPrefix] = useState({});
  const [loading, setLoading]             = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    // 1. Find most recent season per league prefix
    const { data: seasons } = await supabase
      .from('seasons').select('lg, end_date, year')
      .order('year', { ascending: false }).limit(30);

    const prefixMap = {};
    (seasons || []).forEach(s => {
      const p = lgPrefix(s.lg);
      if (!p) return;
      const ex = prefixMap[p];
      if (!ex || new Date(s.end_date) > new Date(ex.end_date)) prefixMap[p] = s;
    });

    const recentLgCodes = Object.values(prefixMap).map(s => s.lg).filter(Boolean);
    if (!recentLgCodes.length) { setLoading(false); return; }

    // 2. Fetch recent games across all leagues at once, group client-side
    const { data: games } = await supabase
      .from('games')
      .select('lg, game, home, away, score_home, score_away, ot, result_home, result_away')
      .in('lg', recentLgCodes)
      .order('game', { ascending: false });

    const byPrefix = {};
    (games || []).forEach(g => {
      const p = lgPrefix(g.lg);
      if (!byPrefix[p]) byPrefix[p] = [];
      if (byPrefix[p].length < 12) byPrefix[p].push(g);
    });

    setGamesByPrefix(byPrefix);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const cfg   = getCfg(selectedLeague);
  const games = gamesByPrefix[selectedLeague] || [];

  return (
    <>
      <div className="sb-root">
        {/* Header bar: league pill + label */}
        <div className="sb-header">
          <div className="sb-league-pill" style={{ '--lc': cfg.color }}>
            {cfg.label}
          </div>
          <span className="sb-title">RECENT RESULTS</span>
          <div className="sb-fade-right" />
        </div>

        {/* Scrollable cards */}
        <div className="sb-track">
          {loading
            ? Array.from({ length: 9 }, (_, i) => <SkeletonCard key={i} />)
            : games.length === 0
              ? <div className="sb-empty">NO RESULTS YET THIS SEASON</div>
              : games.map((g, i) => <ScoreCard key={i} game={g} color={cfg.color} />)
          }
        </div>
      </div>

      <style>{`
        /* ══ SCORES BAR  ════════════════════════════════ */
        /* Sits ABOVE the main nav — no sticky needed, just sits at page top  */
        .sb-root {
          width: 100%;
          background: linear-gradient(180deg, #050512 0%, #0a0a1e 100%);
          border-bottom: 1.5px solid rgba(255,140,0,.22);
          box-shadow: 0 3px 20px rgba(0,0,0,.7);
          display: flex;
          flex-direction: column;
          z-index: 1100; /* above MainNavigation's 1000 */
          
          top: 0;
        }

        /* Header row */
        .sb-header {
          display: flex;
          align-items: center;
          gap: .65rem;
          padding: .3rem .9rem .25rem;
          border-bottom: 1px solid rgba(255,255,255,.05);
          background: rgba(0,0,0,.3);
          position: relative;
          min-height: 26px;
          
        }
        .sb-league-pill {
          font-family: 'Press Start 2P', monospace;
          font-size: .53rem;
          color: var(--lc);
          background: color-mix(in srgb, var(--lc) 12%, transparent);
          border: 1px solid color-mix(in srgb, var(--lc) 35%, transparent);
          border-radius: 3px;
          padding: .2rem .5rem;
          letter-spacing: 1px;
          text-shadow: 0 0 8px color-mix(in srgb, var(--lc) 60%, transparent);
          flex-shrink: 0;
        }
        .sb-title {
          font-family: 'Press Start 2P', monospace;
          font-size: .56rem;
          color: rgba(255,140,2);
          letter-spacing: 3px;
        }

        /* Scrollable cards row */
        .sb-track {
          display: flex;
          align-items: stretch;
          gap: .3rem;
          overflow-x: auto;
          padding: .3rem .55rem;
          scrollbar-width: none;
          min-height: 78px;
          scroll-snap-type: x mandatory;
        }
        .sb-track::-webkit-scrollbar { display: none; }
        .sb-empty {
          display: flex;
          align-items: center;
          padding: 0 1rem;
          font-family: 'Press Start 2P', monospace;
          font-size: .28rem;
          color: rgba(255,255,255,.1);
          letter-spacing: 2px;
        }

        /* ── Score card ── */
        .sc-card {
          display: flex;
          flex-direction: column;
          min-width: 100px;
          flex-shrink: 0;
          background: linear-gradient(160deg, rgba(255,255,255,.03) 0%, rgba(0,0,0,.32) 100%);
          border: 1px solid rgba(255,255,255,.07);
          border-radius: 6px;
          overflow: hidden;
          cursor: pointer;
          transition: border-color .14s, box-shadow .14s;
          scroll-snap-align: start;
          position: relative;
        }
        .sc-card:hover {
          border-color: color-mix(in srgb, var(--lc, #87CEEB) 40%, transparent);
          box-shadow: 0 0 12px color-mix(in srgb, var(--lc, #87CEEB) 10%, transparent);
        }
        .sc-skel { opacity: .2; pointer-events: none; }

        /* Thin colored top accent line */
        .sc-accent {
          height: 2px;
          background: var(--lc, rgba(255,255,255,.1));
          opacity: .55;
        }

        .sc-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: .35rem;
          padding: .28rem .42rem .3rem;
          flex: 1;
        }

        /* Team logos stacked */
        .sc-teams { display: flex; flex-direction: column; gap: 0; flex: 1; }
        .sc-team-row {
          display: flex;
          align-items: center;
          padding: .1rem 0;
        }

        /* Prominent divider between away and home */
        .sc-divline {
          width: 100%;
          height: 1.5px;
          background: linear-gradient(90deg,
            rgba(255,255,255,.22) 0%,
            rgba(255,255,255,.08) 60%,
            rgba(255,255,255,.02) 100%);
          margin: .06rem 0;
        }

        .sc-logo {
          width: 24px; height: 24px;
          object-fit: contain;
          filter: drop-shadow(0 0 3px rgba(255,255,255,.12));
          flex-shrink: 0;
        }
        .sc-logo-fb {
          width: 24px; height: 24px;
          display: none;
          align-items: center; justify-content: center;
          background: rgba(135,206,235,.1);
          border: 1px solid rgba(135,206,235,.15);
          border-radius: 3px;
          font-family: 'Press Start 2P', monospace;
          font-size: .2rem; color: #87CEEB; flex-shrink: 0;
        }

        /* Scores */
        .sc-scores {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0;
          flex-shrink: 0;
        }
        .sc-score {
          font-family: 'VT323', monospace;
          font-size: 1.45rem;
          color: rgba(255,255,255,.38);
          line-height: 1;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          min-width: 18px;
        }
        .sc-win {
          color: #FFD700 !important;
          text-shadow: 0 0 8px rgba(255,215,0,.5) !important;
        }

        /* Score container: make relative so the OT pill can float */
        .score-container {
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;  /* centers OT pill horizontally */
        }
        
        .sc-ot {
          position: absolute;
          top: -10px;           /* fixed above score */
          left: 50%;
          transform: translateX(-50%);  /* centers horizontally */
          font-family: 'Press Start 2P', monospace;
          font-size: 0.45rem;
          color: #FF8C00;
          background: rgba(255,140,0,0.14);
          border: 1px solid rgba(255,140,0,0.38);
          border-radius: 3px;
          padding: 0.12rem 0.32rem;
          letter-spacing: 1px;
          z-index: 1;
        }

        /* Skeleton placeholders */
        .sc-ph {
          background: rgba(255,255,255,.07);
          border-radius: 3px;
          animation: sbShim 1.5s infinite;
        }
        .sc-ph-logo  { width: 24px; height: 24px; }
        .sc-ph-score { width: 16px; height: 20px; margin-bottom: 2px; }

        @keyframes sbShim {
          0%,100% { opacity: .5; }
          50%      { opacity: 1; }
        }

        @media (max-width: 600px) {
          .sc-card    { min-width: 85px; }
          .sc-logo    { width: 20px; height: 20px; }
          .sc-score   { font-size: 1.25rem; height: 20px; }
          .sc-ph-logo { width: 20px; height: 20px; }
        }
      `}</style>
    </>
  );
}
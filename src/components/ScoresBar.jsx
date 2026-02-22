// ScoresBar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// • Sticky top-of-page scores bar (sits above MainNavigation)
// • No league pill, no "RECENT RESULTS" label
// • Hover to flip card — 150ms delay so it doesn't fire while scrolling
// • Back face: H2H record large, streaks large, logos only (no codes), stats link
// • DefendingChampion banner embedded on the far right
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from './LeagueContext';
import DefendingChampion from './DefendingChampion';

const lgPrefix = lg => (lg || '').replace(/[0-9]/g, '').trim();

const LEAGUE_CFG = {
  W: { color: '#87CEEB' },
  Q: { color: '#FFD700' },
  V: { color: '#FF6B35' },
};

// ─── H2H data fetch ───────────────────────────────────────────────────────────
async function fetchH2H(teamA, teamB) {
  const { data } = await supabase
    .from('games')
    .select('game, home, away, result_home, result_away, ot, lg')
    .or(`and(home.eq.${teamA},away.eq.${teamB}),and(home.eq.${teamB},away.eq.${teamA})`)
    .order('game', { ascending: false })
    .limit(10);

  const games = data || [];
  if (!games.length) return null;

  const getResult = (g, team) => {
    const isHome = g.home === team;
    const r = ((isHome ? g.result_home : g.result_away) || '').toUpperCase();
    return r === 'W' || r === 'OTW' ? 'W' : 'L';
  };

  let winsA = 0, winsB = 0;
  games.forEach(g => {
    if (getResult(g, teamA) === 'W') winsA++; else winsB++;
  });

  // Current h2h streak (positive = win, negative = loss)
  const calcStreak = (team) => {
    if (!games.length) return 0;
    const first = getResult(games[0], team);
    let n = 0;
    for (const g of games) {
      if (getResult(g, team) === first) n++; else break;
    }
    return first === 'W' ? n : -n;
  };

  return {
    games,
    winsA, winsB,
    streakA: calcStreak(teamA),
    streakB: calcStreak(teamB),
    total: games.length,
  };
}

// ─── Streak display helper ────────────────────────────────────────────────────
function StreakBadge({ val }) {
  if (!val) return <span className="sc-streak sc-streak-none">–</span>;
  const isWin = val > 0;
  const n     = Math.abs(val);
  return (
    <span className={`sc-streak ${isWin ? 'sc-streak-w' : 'sc-streak-l'}`}>
      {isWin ? 'W' : 'L'}{n}
    </span>
  );
}

// ─── Individual card ──────────────────────────────────────────────────────────
function ScoreCard({ game, index }) {
  const [flipped, setFlipped] = useState(false);
  const [h2h,     setH2h]     = useState(null);
  const [h2hLoad, setH2hLoad] = useState(false);
  const fetchedRef             = useRef(false);
  const hoverTimerRef          = useRef(null);

  // Hover handlers — 150 ms delay prevents accidental flips
  const handleMouseEnter = () => {
    if (!game) return;
    hoverTimerRef.current = setTimeout(async () => {
      setFlipped(true);
      if (!fetchedRef.current) {
        fetchedRef.current = true;
        setH2hLoad(true);
        const result = await fetchH2H(game.away, game.home);
        setH2h(result);
        setH2hLoad(false);
      }
    }, 150);
  };

  const handleMouseLeave = () => {
    clearTimeout(hoverTimerRef.current);
    setFlipped(false);
  };

  // Cleanup on unmount
  useEffect(() => () => clearTimeout(hoverTimerRef.current), []);

  if (!game) {
    return (
      <div className="sc-wrap sc-wrap-skel" style={{ animationDelay: `${index * 0.04}s` }}>
        <div className="sc-front">
          <div className="sc-skel-row"><div className="sc-skel-logo"/><div className="sc-skel-score"/></div>
          <div className="sc-div-line"/>
          <div className="sc-skel-row"><div className="sc-skel-logo"/><div className="sc-skel-score"/></div>
        </div>
      </div>
    );
  }

  const isOT    = Number(game.ot) === 1 ||
                  (game.result_home || '').toUpperCase().includes('OT') ||
                  (game.result_away || '').toUpperCase().includes('OT');
  const homeWin = Number(game.score_home) > Number(game.score_away);
  const awayWin = Number(game.score_away) > Number(game.score_home);

  return (
    <div
      className={`sc-wrap ${flipped ? 'sc-flipped' : ''}`}
      style={{ animationDelay: `${index * 0.04}s` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* ── FRONT ── */}
      <div className="sc-card sc-front">
        {/* OT badge — top-right, clear of logos */}
        {isOT && <span className="sc-ot">OT</span>}

        <div className="sc-team-row">
          <img src={`/assets/teamLogos/${game.away}.png`} alt={game.away} className="sc-logo"
            onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling.style.display='flex'; }} />
          <div className="sc-logo-fb">{(game.away||'').slice(0,3)}</div>
          <span className={`sc-score ${awayWin ? 'sc-win' : ''}`}>{game.score_away ?? '–'}</span>
        </div>

        <div className="sc-div-line" />

        <div className="sc-team-row">
          <img src={`/assets/teamLogos/${game.home}.png`} alt={game.home} className="sc-logo"
            onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling.style.display='flex'; }} />
          <div className="sc-logo-fb">{(game.home||'').slice(0,3)}</div>
          <span className={`sc-score ${homeWin ? 'sc-win' : ''}`}>{game.score_home ?? '–'}</span>
        </div>
      </div>

      {/* ── BACK ── */}
      <div className="sc-card sc-back">
        {h2hLoad ? (
          <div className="sc-back-loading">
            <span className="sc-bl"/><span className="sc-bl"/><span className="sc-bl"/>
          </div>
        ) : h2h ? (
          <>
            {/* Away team row */}
            <div className="sc-h2h-team-row">
              <img src={`/assets/teamLogos/${game.away}.png`} alt={game.away} className="sc-h2h-logo"
                onError={e => { e.currentTarget.style.display='none'; }} />
              <span className="sc-h2h-record">{h2h.winsA}–{h2h.winsB}</span>
              <StreakBadge val={h2h.streakA} />
            </div>

            {/* VS divider with game count */}
            <div className="sc-h2h-vs-row">
              <div className="sc-h2h-line"/>
              <span className="sc-h2h-vs">L{h2h.total}</span>
              <div className="sc-h2h-line"/>
            </div>

            {/* Home team row */}
            <div className="sc-h2h-team-row">
              <img src={`/assets/teamLogos/${game.home}.png`} alt={game.home} className="sc-h2h-logo"
                onError={e => { e.currentTarget.style.display='none'; }} />
              <span className="sc-h2h-record">{h2h.winsB}–{h2h.winsA}</span>
              <StreakBadge val={h2h.streakB} />
            </div>

            {/* Mini dot history — away team perspective */}
            <div className="sc-dots-row">
              {h2h.games.slice(0, 8).map((g, i) => {
                const aIsHome = g.home === game.away;
                const r = ((aIsHome ? g.result_home : g.result_away) || '').toUpperCase();
                const win = r === 'W' || r === 'OTW';
                return <span key={i} className={`sc-mini-dot ${win ? 'sc-md-w' : 'sc-md-l'}`} title={win ? 'W' : 'L'} />;
              })}
            </div>

          </>
        ) : (
          <div className="sc-no-h2h">NO HISTORY</div>
        )}
      </div>
    </div>
  );
}

// ─── ScoresBar ────────────────────────────────────────────────────────────────
export default function ScoresBar() {
  const { selectedLeague } = useLeague();
  const [games,   setGames]   = useState([]);
  const [loading, setLoading] = useState(true);

  const color = LEAGUE_CFG[selectedLeague]?.color ?? '#aaa';

  useEffect(() => {
    if (!selectedLeague) return;
    setLoading(true); setGames([]);
    (async () => {
      const { data: seasons } = await supabase
        .from('seasons').select('lg, end_date, year')
        .order('year', { ascending: false }).limit(20);
      const ps = (seasons || []).filter(s => lgPrefix(s.lg) === selectedLeague);
      if (!ps.length) { setLoading(false); return; }
      const latest = ps.reduce((b, s) =>
        new Date(s.end_date) > new Date(b.end_date) ? s : b);
      const { data } = await supabase
        .from('games')
        .select('lg, game, home, away, score_home, score_away, ot, result_home, result_away')
        .eq('lg', latest.lg)
        .order('game', { ascending: false })
        .limit(8);
      setGames(data || []);
      setLoading(false);
    })();
  }, [selectedLeague]);

  const slots = Array.from({ length: 8 }, (_, i) => games[i] ?? null);

  return (
    <>
      <div className="sb-root" style={{ '--sb': color }}>

        {/* Scrollable cards area */}
        <div className="sb-track-wrap">
          <div className="sb-cards">
            {slots.map((g, i) => (
              <ScoreCard key={i} game={loading ? null : g} index={i} />
            ))}
          </div>
          {/* Edge fade masks */}
          <div className="sb-fade-left"  />
          <div className="sb-fade-right" />
        </div>

        {/* Defending Champion — far right of bar */}
        <DefendingChampion />
      </div>

      <style>{`
        /* ══ SCORES BAR ══════════════════════════════════════════════════════ */
        .sb-root {
          position: sticky;
          top: 0;
          z-index: 1100;
          display: flex;
          align-items: center;
          min-height: 80px;
          background: linear-gradient(180deg, #090918 0%, #050510 100%);
          border-bottom: 2px solid color-mix(in srgb, var(--sb) 40%, transparent);
          box-shadow:
            0 3px 20px rgba(0,0,0,.7),
            inset 0 -1px 0 color-mix(in srgb, var(--sb) 18%, transparent);
        }

        /* Scrollable region */
        .sb-track-wrap {
          flex: 1;
          position: relative;
          overflow: hidden;
          min-width: 0;
        }
        .sb-fade-left, .sb-fade-right {
          position: absolute; top: 0; bottom: 0; width: 32px;
          z-index: 2; pointer-events: none;
        }
        .sb-fade-left  { left:  0; background: linear-gradient(90deg,  #050510, transparent); }
        .sb-fade-right { right: 0; background: linear-gradient(-90deg, #050510, transparent); }

        .sb-cards {
          display: flex;
          gap: .55rem;
          overflow-x: auto;
          padding: .45rem .6rem;
          scrollbar-width: none;
          scroll-snap-type: x mandatory;
          align-items: center;
        }
        .sb-cards::-webkit-scrollbar { display: none; }

        /* ─────────────────────────────────────────────────────────────────── */
        /* ── CARD FLIP WRAPPER ── */
        .sc-wrap {
          flex-shrink: 0;
          width: 112px;
          height: 74px;
          perspective: 800px;
          scroll-snap-align: start;
          animation: scIn .32s ease both;
          overflow: visible;
        }
        @keyframes scIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Card: shared face styles ── */
        .sc-card {
          position: absolute; inset: 0;
          border-radius: 8px;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          transition: transform .38s cubic-bezier(.4, 0, .2, 1);
          overflow: visible;
        }

        /* Front face */
        .sc-front {
          background: linear-gradient(155deg, rgba(255,255,255,.04) 0%, rgba(0,0,0,.4) 100%);
          border: 1px solid rgba(255,255,255,.08);
          padding: .45rem .55rem .4rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transform: rotateY(0deg);
          cursor: default;
        }
        .sc-wrap:hover .sc-front {
          border-color: rgba(255,140,0,.35);
          box-shadow: 0 0 10px rgba(255,140,0,.1);
        }

        /* Back face — starts rotated */
        .sc-back {
          background: linear-gradient(160deg, #0c0c22 0%, #060610 100%);
          border: 1px solid color-mix(in srgb, var(--sb) 40%, transparent);
          box-shadow: inset 0 0 16px color-mix(in srgb, var(--sb) 6%, transparent);
          transform: rotateY(180deg);
          padding: .32rem .42rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          gap: .12rem;
        }

        /* Flip active */
        .sc-wrap.sc-flipped .sc-front { transform: rotateY(-180deg); }
        .sc-wrap.sc-flipped .sc-back  { transform: rotateY(0deg); }

        /* ── Front: team rows ── */
        .sc-team-row {
          display: flex;
          align-items: center;
          gap: .35rem;
          position: relative;
        }
        .sc-logo {
          width: 28px; height: 28px;
          object-fit: contain; flex-shrink: 0;
          filter: drop-shadow(0 0 3px rgba(255,255,255,.12));
        }
        .sc-logo-fb {
          width: 28px; height: 28px; display: none;
          align-items: center; justify-content: center;
          background: rgba(135,206,235,.1); border: 1px solid rgba(135,206,235,.15);
          border-radius: 3px; font-family: 'Press Start 2P', monospace;
          font-size: .18rem; color: #87CEEB; flex-shrink: 0;
        }
        .sc-score {
          font-family: 'VT323', monospace;
          font-size: 1.7rem;
          line-height: 1;
          color: rgba(255,255,255,.6);
          margin-left: auto;
          min-width: 20px;
          text-align: right;
        }
        .sc-win {
          color: #FFD700 !important;
          text-shadow: 0 0 10px rgba(255,215,0,.55) !important;
        }

        /* Divider between teams */
        .sc-div-line {
          height: 1.5px;
          margin: .1rem 0;
          background: linear-gradient(90deg,
            rgba(255,255,255,.22) 0%,
            rgba(255,255,255,.07) 65%,
            transparent 100%);
          border-radius: 1px;
        }

        /* OT badge — floats above the card top edge, clears scores entirely */
        .sc-ot {
          position: absolute;
          top: -4px; right: -3px;
          font-family: 'Press Start 2P', monospace;
          font-size: .28rem;
          color: #FF8C00;
          background: #070710;
          border: 1px solid rgba(255,140,0,.55);
          border-radius: 3px;
          padding: .12rem .3rem;
          line-height: 1;
          z-index: 4;
          box-shadow: 0 0 6px rgba(255,140,0,.2);
        }

        /* Skeleton */
        .sc-wrap-skel { pointer-events: none; opacity: .25; cursor: default; }
        .sc-skel-row { display: flex; align-items: center; gap: .35rem; }
        .sc-skel-logo  { width: 28px; height: 28px; background: rgba(255,255,255,.06); border-radius: 3px; flex-shrink: 0; }
        .sc-skel-score { width: 18px; height: 18px; background: rgba(255,255,255,.04); border-radius: 2px; margin-left: auto; }

        /* ══ BACK FACE ═══════════════════════════════════════════════════════ */

        /* H2H team row: logo | big record | streak badge */
        .sc-h2h-team-row {
          display: flex;
          align-items: center;
          gap: .28rem;
          width: 100%;
        }
        .sc-h2h-logo {
          width: 24px; height: 24px;
          object-fit: contain; flex-shrink: 0;
          filter: drop-shadow(0 0 3px rgba(255,255,255,.15));
        }
        .sc-h2h-record {
          font-family: 'VT323', monospace;
          font-size: 1.55rem;
          color: rgba(255,255,255,.85);
          line-height: 1;
          flex: 1;
          white-space: nowrap;
          letter-spacing: .5px;
        }

        /* Streak badge — big and readable */
        .sc-streak {
          font-family: 'Press Start 2P', monospace;
          font-size: .52rem;
          padding: .1rem .28rem;
          border-radius: 3px;
          line-height: 1;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .sc-streak-w {
          color: #00CC55;
          background: rgba(0,204,85,.14);
          border: 1px solid rgba(0,204,85,.4);
          text-shadow: 0 0 8px rgba(0,204,85,.5);
        }
        .sc-streak-l {
          color: #6B9FFF;
          background: rgba(107,159,255,.12);
          border: 1px solid rgba(107,159,255,.38);
          text-shadow: 0 0 8px rgba(107,159,255,.45);
        }
        .sc-streak-none {
          color: rgba(255,255,255,.2);
          font-size: .44rem;
        }

        /* VS divider row */
        .sc-h2h-vs-row {
          display: flex; align-items: center; gap: .25rem; width: 100%;
        }
        .sc-h2h-line {
          flex: 1; height: 1px;
          background: color-mix(in srgb, var(--sb) 18%, rgba(255,255,255,.06));
        }
        .sc-h2h-vs {
          font-family: 'Press Start 2P', monospace;
          font-size: .26rem;
          color: rgba(255,255,255,.2);
          letter-spacing: 1px;
          white-space: nowrap;
        }

        /* Mini dot history row */
        .sc-dots-row {
          display: flex; gap: 2px; align-items: center;
          width: 100%; justify-content: center;
        }
        .sc-mini-dot {
          width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0;
        }
        .sc-md-w { background: #00CC55; box-shadow: 0 0 3px rgba(0,204,85,.5); }
        .sc-md-l { background: #4477CC; box-shadow: 0 0 3px rgba(68,119,204,.4); }

        /* Game stats link */
        .sc-stats-link {
          font-family: 'Press Start 2P', monospace;
          font-size: .24rem;
          letter-spacing: .5px;
          color: color-mix(in srgb, var(--sb) 80%, rgba(255,255,255,.5));
          text-decoration: none;
          width: 100%;
          text-align: center;
          padding: .15rem .2rem;
          border: 1px solid color-mix(in srgb, var(--sb) 28%, transparent);
          border-radius: 3px;
          background: color-mix(in srgb, var(--sb) 8%, transparent);
          transition: background .15s, border-color .15s, color .15s;
          flex-shrink: 0;
        }
        .sc-stats-link:hover {
          background: color-mix(in srgb, var(--sb) 18%, transparent);
          border-color: color-mix(in srgb, var(--sb) 55%, transparent);
          color: var(--sb);
        }

        /* Loading dots */
        .sc-back-loading {
          display: flex; gap: 3px; align-items: center;
          justify-content: center; height: 100%;
        }
        .sc-bl {
          width: 4px; height: 4px; border-radius: 50%;
          background: color-mix(in srgb, var(--sb) 55%, rgba(255,255,255,.2));
          animation: blPulse 1.2s ease-in-out infinite;
        }
        .sc-bl:nth-child(2) { animation-delay: .15s; }
        .sc-bl:nth-child(3) { animation-delay: .3s;  }
        @keyframes blPulse { 0%,100%{opacity:.25} 50%{opacity:1} }

        .sc-no-h2h {
          font-family: 'Press Start 2P', monospace;
          font-size: .3rem; color: rgba(255,255,255,.2);
          letter-spacing: 1px; padding: .4rem 0;
        }

        /* ── Responsive ── */
        @media (max-width: 600px) {
          .sb-root { min-height: 64px; }
          .sc-wrap { width: 94px; height: 62px; }
          .sc-logo, .sc-h2h-logo { width: 22px; height: 22px; }
          .sc-score { font-size: 1.45rem; }
          .sc-streak { font-size: .44rem; }
          .sc-h2h-record { font-size: 1.3rem; }
        }
      `}</style>
    </>
  );
}
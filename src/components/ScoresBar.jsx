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

const lgPrefix = (lg) => (lg || '').replace(/[0-9]/g, '').trim();

const LEAGUE_CFG = {
  W: { color: '#87CEEB' },
  Q: { color: '#FFD700' },
  V: { color: '#FF6B35' },
};

// ─── H2H data fetch ───────────────────────────────────────────────────────────
async function fetchH2H(teamA, teamB, lg, isPlayoff = false, cutoffId = null) {
  // Get all seasons belonging to the same league family.
  // Example: W18 -> W18, W17, W16, W15...
  const prefix = lgPrefix(lg);

  const { data: seasons, error: seasonError } = await supabase
    .from('seasons')
    .select('lg, year')
    .order('year', { ascending: false });

  if (seasonError) {
    console.error('[ScoresBar] Season lookup error:', seasonError);
    return null;
  }

  const validLgs = (seasons || [])
    .filter((s) => lgPrefix(s.lg) === prefix)
    .map((s) => s.lg);

  if (!validLgs.length) {
    console.warn('[ScoresBar] No matching league seasons found for:', lg);
    return null;
  }

  console.log('[ScoresBar] H2H league history:', lg, '->', validLgs);

  // ─────────────────────────────────────────────────────────────────────────
  // PLAYOFF H2H — playoff history only, across all seasons in this league
  // ─────────────────────────────────────────────────────────────────────────
  if (isPlayoff) {
    let poQuery = supabase
      .from('playoff_games')
      .select(
        'id, team_code_a, team_code_b, team_a_score, team_b_score, lg, round, game_number'
      )
      .in('lg', validLgs)
      .or(
        `and(team_code_a.eq.${teamA},team_code_b.eq.${teamB}),and(team_code_a.eq.${teamB},team_code_b.eq.${teamA})`
      )
      .not('team_a_score', 'is', null);

    // Point-in-time: only history up to AND INCLUDING this game
    if (cutoffId != null) poQuery = poQuery.lte('id', cutoffId);

    const { data, error } = await poQuery
      .order('id', { ascending: false })
      .limit(10);

    if (error) {
      console.error('[ScoresBar] H2H playoff error:', error);
      return null;
    }

    const games = (data || []).map((g) => {
      const aWin = Number(g.team_a_score) > Number(g.team_b_score);
      return {
        home: g.team_code_a,
        away: g.team_code_b,
        score_home: g.team_a_score,
        score_away: g.team_b_score,
        result_home: aWin ? 'W' : 'L',
        result_away: aWin ? 'L' : 'W',
        ot: 0,
        lg: g.lg,
        _isPlayoff: true,
      };
    });

    if (!games.length) return null;

    return buildH2HResult(games, teamA, teamB);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REGULAR-SEASON H2H — regular-season history only, across all seasons
  // ─────────────────────────────────────────────────────────────────────────
  let rsQuery = supabase
  .from('games')
  .select(
    'id, legacy_game_id, home, away, score_home, score_away, result_home, result_away, ot, lg'
  )
  .in('lg', validLgs)
  .or(
    `and(home.eq.${teamA},away.eq.${teamB}),and(home.eq.${teamB},away.eq.${teamA})`
  )
  .not('score_home', 'is', null);

// Point-in-time: only history up to AND INCLUDING this game.
// Uses the DB `id` (matches ordering everywhere else in the app) — legacy_game_id
// isn't reliably populated/chronological for current-season games.
if (cutoffId != null) rsQuery = rsQuery.lte('id', cutoffId);

const { data, error } = await rsQuery
  .order('id', { ascending: false })
  .limit(10);

  if (error) {
    console.error('[ScoresBar] H2H error:', error);
    return null;
  }

  const games = data || [];

  if (!games.length) return null;

  return buildH2HResult(games, teamA, teamB);
}

// Returns 'W' | 'OTW' | 'OTL' | 'L' | 'T' from `team`'s perspective
function getOutcome(g, team) {
  const isHome = g.home === team;
  const raw = ((isHome ? g.result_home : g.result_away) || '').toUpperCase();
  if (raw === 'W' || raw === 'OTW' || raw === 'OTL' || raw === 'L' || raw === 'T') return raw;

  // Fallback to score when result column is missing
  const mine = Number(isHome ? g.score_home : g.score_away);
  const theirs = Number(isHome ? g.score_away : g.score_home);
  if (Number.isNaN(mine) || Number.isNaN(theirs)) return null;
  if (mine === theirs) return 'T';
  const isOT = Number(g.ot) === 1;
  if (mine > theirs) return isOT ? 'OTW' : 'W';
  return isOT ? 'OTL' : 'L';
}

function tallyRecord(games, team) {
  const rec = { w: 0, l: 0, t: 0, otl: 0 };
  games.forEach((g) => {
    const o = getOutcome(g, team);
    if (o === 'W' || o === 'OTW') rec.w++;
    else if (o === 'L') rec.l++;
    else if (o === 'OTL') rec.otl++;
    else if (o === 'T') rec.t++;
  });
  return rec;
}

// Streak buckets: wins (W/OTW), regulation losses, OT losses, ties — each its own run
function calcStreak(games, team) {
  if (!games.length) return null;
  const bucket = (o) => (o === 'W' || o === 'OTW' ? 'W' : o);
  const first = bucket(getOutcome(games[0], team));
  if (!first) return null;
  let count = 0;
  for (const g of games) {
    if (bucket(getOutcome(g, team)) !== first) break;
    count++;
  }
  return { type: first, count };
}

function buildH2HResult(games, teamA, teamB) {
  const validGames = games.filter(
    (g) => getOutcome(g, teamA) !== null && getOutcome(g, teamB) !== null
  );
  if (!validGames.length) return null;

  return {
    games: validGames,
    recA: tallyRecord(validGames, teamA),
    recB: tallyRecord(validGames, teamB),
    streakA: calcStreak(validGames, teamA),
    streakB: calcStreak(validGames, teamB),
    total: validGames.length,
  };
}

function fmtRecord(rec) {
  const parts = [rec.w, rec.l];
  if (rec.t > 0 || rec.otl > 0) parts.push(rec.t);
  if (rec.otl > 0) parts.push(rec.otl);
  return parts.join('–');
}

// ─── Streak display helper ────────────────────────────────────────────────────
const STREAK_CLS = { W: 'sc-streak-w', L: 'sc-streak-l', OTL: 'sc-streak-otl', T: 'sc-streak-t' };

function StreakBadge({ streak }) {
  if (!streak || !streak.count) return <span className="sc-streak sc-streak-none">–</span>;
  return (
    <span className={`sc-streak ${STREAK_CLS[streak.type] || 'sc-streak-none'}`}>
      {streak.type}
      {streak.count}
    </span>
  );
}

// ─── Individual card ──────────────────────────────────────────────────────────
function ScoreCard({ game, index }) {
  const [flipped, setFlipped] = useState(false);
  const [h2h, setH2h] = useState(null);
  const [h2hLoad, setH2hLoad] = useState(false);
  const fetchedRef = useRef(false);
  const hoverTimerRef = useRef(null);

  // Hover handlers — 150 ms delay prevents accidental flips
  const handleMouseEnter = () => {
    if (!game) return;
    hoverTimerRef.current = setTimeout(async () => {
      setFlipped(true);
      if (!fetchedRef.current) {
        fetchedRef.current = true;
        setH2hLoad(true);
        const cutoffId = game._isPlayoff
        ? game._rawId ?? null
        : game.id ?? null;
      const result = await fetchH2H(
        game.away,
        game.home,
        game.lg,
        !!game._isPlayoff,
        cutoffId
      );
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
      <div
        className="sc-wrap sc-wrap-skel"
        style={{ animationDelay: `${index * 0.04}s` }}
      >
        <div className="sc-front">
          <div className="sc-skel-row">
            <div className="sc-skel-logo" />
            <div className="sc-skel-score" />
          </div>
          <div className="sc-div-line" />
          <div className="sc-skel-row">
            <div className="sc-skel-logo" />
            <div className="sc-skel-score" />
          </div>
        </div>
      </div>
    );
  }

  const isOT =
    Number(game.ot) === 1 ||
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
        {game._isPlayoff && (
          <span
            className="sc-ot"
            style={{ color: '#FFD700', borderColor: 'rgba(255,215,0,.55)' }}
          >
            PO
          </span>
        )}
        {!game._isPlayoff && isOT && <span className="sc-ot">OT</span>}

        <div className="sc-team-row">
          <img
            src={`/assets/teamLogos/${game.away}.png`}
            alt={game.away}
            className="sc-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling.style.display = 'flex';
            }}
          />
          <div className="sc-logo-fb">{(game.away || '').slice(0, 3)}</div>
          <span className={`sc-score ${awayWin ? 'sc-win' : ''}`}>
            {game.score_away ?? '–'}
          </span>
        </div>

        {/* Replace the sc-div-line div with this */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div className="sc-div-line" style={{ flex: 1 }} />
              <span style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '.4rem',
                color: game._isPlayoff  ? 'rgba(255,215,0,.8)'  : 'rgba(255,255,255,.75)',
                letterSpacing: 1,
                flexShrink: 0,
                lineHeight: 1,
              }}>
                {game._isPlayoff
                  ? `G${game.game_number ?? '?'}`
                  : `G${game._meetingNumber ?? '?'}`
                }
              </span>
              <div className="sc-div-line" style={{ flex: 1 }} />
            </div>

          <div className="sc-team-row">
            <img
              src={`/assets/teamLogos/${game.home}.png`}
              alt={game.home}
              className="sc-logo"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.nextElementSibling.style.display = 'flex';
              }}
            />
            <div className="sc-logo-fb">{(game.home || '').slice(0, 3)}</div>
            <span className={`sc-score ${homeWin ? 'sc-win' : ''}`}>
              {game.score_home ?? '–'}
            </span>
          </div>
        </div>

      {/* ── BACK ── */}
      <div className="sc-card sc-back">
        {h2hLoad ? (
          <div className="sc-back-loading">
            <span className="sc-bl" />
            <span className="sc-bl" />
            <span className="sc-bl" />
          </div>
        ) : h2h ? (
          <>
              {/* Away team row */}
              <div className="sc-h2h-team-row">
              <img
                src={`/assets/teamLogos/${game.away}.png`}
                alt={game.away}
                className="sc-h2h-logo"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div className="sc-h2h-stack">
                <span className="sc-h2h-record">{fmtRecord(h2h.recA)}</span>
                <StreakBadge streak={h2h.streakA} />
              </div>
            </div>

            {/* VS divider with game count */}
            <div className="sc-h2h-vs-row">
              <div className="sc-h2h-line" />
              <span
                className="sc-h2h-vs"
                style={
                  game._isPlayoff
                    ? {
                        color: '#FFD700',
                        textShadow: '0 0 8px rgba(255,215,0,.6)', 
                      }
                    : {}
                }
              >
                {game._isPlayoff ? 'L10-PO' : `L${h2h.total}`}
              </span>
              <div className="sc-h2h-line" />
            </div>

            {/* Home team row */}
            <div className="sc-h2h-team-row">
              <img
                src={`/assets/teamLogos/${game.home}.png`}
                alt={game.home}
                className="sc-h2h-logo"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
             <div className="sc-h2h-stack">
               <span className="sc-h2h-record">{fmtRecord(h2h.recB)}</span>
               <StreakBadge streak={h2h.streakB} />
             </div>
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
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  const color = LEAGUE_CFG[selectedLeague]?.color ?? '#aaa';

  useEffect(() => {
    if (!selectedLeague) return;

    setLoading(true);
    setGames([]);

    (async () => {
      // 1️⃣ Fetch seasons for this league
      const { data: seasons } = await supabase
        .from('seasons')
        .select('lg, end_date, year, status')
        .order('year', { ascending: false })
        .limit(20);

      const leagueSeasons = (seasons || []).filter(
        (s) => lgPrefix(s.lg) === selectedLeague
      );

      if (!leagueSeasons.length) {
        setLoading(false);
        return;
      }

      // 2️⃣ Pick the latest season
      const latest = (() => {
        // pick active season first
        const active = leagueSeasons.find((s) => s.status === 'season');
        if (active) return active;

        // fallback to the season with the latest end_date
        return leagueSeasons.sort(
          (a, b) => new Date(b.end_date) - new Date(a.end_date)
        )[0];
      })();

      console.log('[ScoresBar] latest season:', latest.lg, latest.status);

            // 3️⃣ Fetch season games and playoff games in parallel, plus a lightweight
      // full-season id/home/away list used only to compute each pair's meeting number.
      const [{ data: seasonData }, { data: playoffData }, { data: allSeasonPairs }] = await Promise.all([
        supabase
          .from('games')
          .select(
            'lg, id, legacy_game_id, home, away, score_home, score_away, ot, result_home, result_away'
          )
          .eq('lg', latest.lg)
          .not('score_home', 'is', null)
          .order('id', { ascending: false })
          .limit(8),
        supabase
          .from('playoff_games')
          .select(
            'id, lg, team_code_a, team_code_b, team_a_score, team_b_score, game_date, round, series_number, game_number'
          )
          .eq('lg', latest.lg)
          .not('team_a_score', 'is', null)
          .order('id', { ascending: false })
          .limit(8),
        supabase
          .from('games')
          .select('id, home, away')
          .eq('lg', latest.lg)
          .not('score_home', 'is', null)
          .order('id', { ascending: true }),
      ]);

      // Build id -> meeting number map: for each unordered team pair, count which
      // numbered meeting (1st, 2nd, ...) this game was, in chronological order.
      const meetingNumberById = {};
      const pairCounts = {};
      (allSeasonPairs || []).forEach((g) => {
        const key = [g.home, g.away].sort().join('::');
        pairCounts[key] = (pairCounts[key] || 0) + 1;
        meetingNumberById[g.id] = pairCounts[key];
      });

      // 4️⃣ Normalize playoff rows
      const playoffRows = (playoffData || []).map((g) => ({
        lg: g.lg,
        legacy_game_id: g.id + 1000000, // offset so they sort above season games
        home: g.team_code_a,
        away: g.team_code_b,
        score_home: g.team_a_score,
        score_away: g.team_b_score,
        ot: 0,
        result_home: g.team_a_score > g.team_b_score ? 'W' : 'L',
        result_away: g.team_b_score > g.team_a_score ? 'W' : 'L',
        _isPlayoff: true,
        _rawId: g.id,
        round: g.round,
        game_number: g.game_number,
      }));

            // Attach meeting number to season games before merging
            const seasonRowsWithMeeting = (seasonData || []).map((g) => ({
              ...g,
              _meetingNumber: meetingNumberById[g.id] ?? null,
            }));
      
            // 5️⃣ Merge, sort, slice 8
            const all = [...playoffRows, ...seasonRowsWithMeeting]
              .sort((a, b) => (b.legacy_game_id || 0) - (a.legacy_game_id || 0))
              .slice(0, 8);

      setGames(all);
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
              <ScoreCard
                key={i}
                game={loading ? null : g}
                index={i}
                totalGames={slots.filter(Boolean).length}
              />
            ))}
          </div>
          {/* Edge fade masks */}
          <div className="sb-fade-left" />
          <div className="sb-fade-right" />
        </div>

        {/* Defending Champion — far right of bar */}
        <DefendingChampion />
      </div>

      <style>{`
        /* ══ SCORES BAR ══════════════════════════════════════════════════════ */
        .sb-root {
          /* Not sticky — scrolls away naturally when user scrolls down */
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
          width: 124px;
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
          padding: .28rem .34rem;
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
          height: 2px;
          font-size: 1rem;
          font-weight: 700;
          margin: .15rem 0;
        
          background: linear-gradient(90deg,
            rgba(255,255,255,.45) 0%,
            rgba(255,255,255,.18) 65%,
            transparent 100%);
        
          border-radius: 2px;
        }

        /* OT badge — floats above the card top edge, clears scores entirely */
        .sc-ot {
          position: absolute;
          top: -8px; right: -3px;
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
          width: 21px; height: 21px;
          object-fit: contain; flex-shrink: 0;
          filter: drop-shadow(0 0 3px rgba(255,255,255,.15));
        }
        /* Record + streak side by side — room freed up once the dots row was removed */
        .sc-h2h-stack {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          gap: .2rem;
          flex: 1;
          min-width: 0;
          overflow: visible;
          padding-right: 1px;
        }
        .sc-h2h-record {
          font-family: 'VT323', monospace;
          font-size: 1.25rem;  /* down from 1.4 */
          color: rgba(255,255,255,.85);
          line-height: 1;
          white-space: nowrap;
          letter-spacing: 0;
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sc-streak {
          font-family: 'Press Start 2P', monospace;
          font-size: .4rem;   /* down from .46 */
          padding: .1rem .2rem;
          border-radius: 3px;
          line-height: 1;
          white-space: nowrap;
          flex-shrink: 0;      /* never let it squish */
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
        .sc-streak-otl {
          color: #FFA500;
          background: rgba(255,165,0,.12);
          border: 1px solid rgba(255,165,0,.38);
          text-shadow: 0 0 8px rgba(255,165,0,.45);
        }
        .sc-streak-t {
          color: #87CEEB;
          background: rgba(135,206,235,.12);
          border: 1px solid rgba(135,206,235,.38);
          text-shadow: 0 0 8px rgba(135,206,235,.45);
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
          font-size: .4rem;
          letter-spacing: 1px;
          white-space: nowrap;
          color: rgba(255,255,255,.75);
        }

        /* Mini dot history row */
        .sc-dots-row {
          display: flex; gap: 2px; align-items: center;
          width: 100%; justify-content: center;
        }
        .sc-mini-dot {
          width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0;
        }
        .sc-md-w   { background: #00CC55; box-shadow: 0 0 3px rgba(0,204,85,.5); }
        .sc-md-l   { background: #4477CC; box-shadow: 0 0 3px rgba(68,119,204,.4); }
        .sc-md-otl { background: #FFA500; box-shadow: 0 0 3px rgba(255,165,0,.45); }
        .sc-md-t   { background: #87CEEB; box-shadow: 0 0 3px rgba(135,206,235,.4); }

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
          .sb-root {
            min-height: 64px;
          }
        
          .sc-wrap {
            width: 104px;
            height: 62px;
          }
        
          /* ── FRONT ── */
          .sc-front {
            padding: .25rem .4rem .2rem;
          }
        
          .sc-team-row {
            gap: .25rem;
          }
        
          .sc-logo {
            width: 21px;
            height: 21px;
          }
        
          .sc-div-line {
            margin: .08rem 0;
          }
        
          .sc-score {
            font-size: 1.4rem;
          }
        
          /* ── BACK ── */
          .sc-back {
            padding: .28rem .2rem;
          }
        
          .sc-h2h-logo {
            width: 18px;
            height: 18px;
          }
        
          .sc-h2h-team-row {
            width: 100%;
            min-width: 0;
            justify-content: flex-start;
            gap: .3rem;
          }
        
          .sc-h2h-stack {
            flex: 0 1 auto;
            min-width: 0;
            flex-direction: row;
            align-items: center;
            justify-content: flex-start;
            gap: 0;
            overflow: visible;
            padding-right: 0;
          }
        
          .sc-h2h-record {
            font-size: 1.15rem;
            margin-left: .15rem;
            white-space: nowrap;
            overflow: visible;
          }
        
          /* Hide streak pill on mobile */
          .sc-streak {
            display: none;
          }
        }
      `}</style>
    </>
  );
}

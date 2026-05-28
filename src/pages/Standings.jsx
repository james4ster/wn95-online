import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from '../components/LeagueContext';
import PlayoffBracket from '../components/PlayoffBracket';
import { createPortal } from 'react-dom';
import FullScreenStandingsModal from '../components/FullScreenStandingsModal';
import { usePersistedState } from '../hooks/usePersistedState';
import TeamDrawer from '../components/TeamDrawer';

function computeH2H(teamA, teamB, games) {
  let ptsA = 0,
    ptsB = 0;
  (games || []).forEach((g) => {
    const aIsHome = g.home === teamA && g.away === teamB;
    const aIsAway = g.home === teamB && g.away === teamA;
    if (!aIsHome && !aIsAway) return;
    const sA = aIsHome ? g.score_home : g.score_away;
    const sB = aIsHome ? g.score_away : g.score_home;
    if (sA > sB) ptsA += 2;
    else if (sB > sA) ptsB += 2;
    else {
      ptsA += 1;
      ptsB += 1;
    }
    if (g.ot && sB > sA && aIsHome) ptsA += 1;
    if (g.ot && sA > sB && aIsAway) ptsB += 1;
  });
  return { ptsA, ptsB };
}

function computeStandings(games) {
  const teamMap = {};
  const ensureTeam = (code) => {
    if (!teamMap[code]) {
      teamMap[code] = {
        team: code,
        coach: '',
        gp: 0,
        w: 0,
        l: 0,
        t: 0,
        otl: 0,
        otw: 0,
        pts: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        shutouts: 0,
        _lastId: -1,
      };
    }
    return teamMap[code];
  };
  games.forEach((g) => {
    const home = ensureTeam(g.home);
    const away = ensureTeam(g.away);
    const sh = g.score_home ?? 0;
    const sa = g.score_away ?? 0;
    const isOT = !!g.ot;
    if (g.id > home._lastId) {
      home.coach = g.coach_home || home.coach;
      home._lastId = g.id;
    }
    if (g.id > away._lastId) {
      away.coach = g.coach_away || away.coach;
      away._lastId = g.id;
    }
    if (!home._results) home._results = [];
    if (!away._results) away._results = [];
    home.gp++;
    away.gp++;
    home.gf += sh;
    home.ga += sa;
    away.gf += sa;
    away.ga += sh;
    if (sh === sa) {
      home.t++;
      away.t++;
      home.pts += 1;
      away.pts += 1;
      home._results.push('T');
      away._results.push('T');
    } else if (sh > sa) {
      if (isOT) {
        home.w++;
        home.otw++;
        home.pts += 2;
        away.otl++;
        away.pts += 1;
        home._results.push('W');
        away._results.push('L');
      } else {
        home.w++;
        home.pts += 2;
        away.l++;
        home._results.push('W');
        away._results.push('L');
      }
    } else {
      if (isOT) {
        away.w++;
        away.otw++;
        away.pts += 2;
        home.otl++;
        home.pts += 1;
        away._results.push('W');
        home._results.push('L');
      } else {
        away.w++;
        away.pts += 2;
        home.l++;
        away._results.push('W');
        home._results.push('L');
      }
    }
    if (sa === 0) home.shutouts++;
    if (sh === 0) away.shutouts++;
  });

  return Object.values(teamMap).map(({ _lastId, _results, ...t }) => {
    const results = _results || [];
    let streakType = null;
    let streakCount = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      if (streakType === null) {
        streakType = results[i];
        streakCount = 1;
      } else if (results[i] === streakType) {
        streakCount++;
      } else {
        break;
      }
    }
    const streak = streakType ? `${streakType}${streakCount}` : '';
    const streakVal =
      streakType === 'W' || streakType === 'OTW'
        ? streakCount
        : streakType === 'L' || streakType === 'OTL'
        ? -streakCount
        : 0;
    return {
      ...t,
      gd: t.gf - t.ga,
      pts_pct: t.gp > 0 ? t.pts / (t.gp * 2) : 0,
      streak,
      streakType,
      streakCount,
      streakVal,
    };
  });
}

function sortWithTiebreakers(teams, games) {
  const h2hCache = {};
  const getH2H = (a, b) => {
    const key = [a, b].sort().join('::');
    if (!h2hCache[key]) h2hCache[key] = computeH2H(a, b, games);
    return h2hCache[key];
  };
  const withH2H = (tierTeams) =>
    tierTeams.map((t) => {
      let h2hPts = 0;
      tierTeams.forEach((other) => {
        if (other.team === t.team) return;
        const { ptsA } = getH2H(t.team, other.team);
        h2hPts += ptsA;
      });
      return { ...t, _h2hPts: h2hPts };
    });
  const byPts = {};
  teams.forEach((t) => {
    const p = t.pts;
    if (!byPts[p]) byPts[p] = [];
    byPts[p].push(t);
  });
  const result = [];
  Object.keys(byPts)
    .map(Number)
    .sort((a, b) => b - a)
    .forEach((pts) => {
      const tier = byPts[pts];
      if (tier.length === 1) {
        result.push({ ...tier[0], _h2hPts: 0 });
      } else {
        const enriched = withH2H(tier);
        enriched.sort((a, b) => {
          if (b.gp !== a.gp && pts === 0) return b.gp - a.gp;
          if (b._h2hPts !== a._h2hPts) return b._h2hPts - a._h2hPts;
          if (b.w !== a.w) return b.w - a.w;
          return b.gd - a.gd;
        });
        result.push(...enriched);
      }
    });
  return result;
}

function SOSTooltip({ sosInfo }) {
  if (!sosInfo || !sosInfo.anchorRect) return null;
  const { data, anchorRect } = sosInfo;
  const { opponents, sos } = data;
  const tooltipW = 300;
  const fixedLeft = Math.min(
    anchorRect.left - tooltipW - 8,
    window.innerWidth - tooltipW - 16
  );
  const tooltipHeight = 80 + opponents.length * 44;
  const desiredTop = anchorRect.top + anchorRect.height / 2 - tooltipHeight / 2;
  const fixedTop = Math.max(
    16,
    Math.min(desiredTop, window.innerHeight - tooltipHeight - 16)
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: fixedTop,
        left: Math.max(8, fixedLeft),
        zIndex: 9999,
        width: tooltipW,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -8,
          background:
            'radial-gradient(ellipse at center, rgba(135,206,235,.1) 0%, transparent 70%)',
          borderRadius: 16,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          background:
            'linear-gradient(155deg, rgba(8,6,20,.98) 0%, rgba(18,14,38,.98) 100%)',
          border: '1px solid rgba(135,206,235,.5)',
          borderRadius: 12,
          boxShadow:
            '0 0 0 1px rgba(135,206,235,.15), 0 8px 32px rgba(0,0,0,.8)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 16px 8px',
            borderBottom: '1px solid rgba(135,206,235,.15)',
            background:
              'linear-gradient(90deg, rgba(135,206,235,.08) 0%, rgba(135,206,235,.04) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '.6rem',
              color: '#87CEEB',
              letterSpacing: 2,
              textShadow: '0 0 8px rgba(135,206,235,.7)',
            }}
          >
            REMAINING SOS
          </div>
          <div
            style={{
              fontFamily: "'VT323', monospace",
              fontSize: '1.3rem',
              color: '#E0E0E0',
            }}
          >
            {sos.toFixed(3)}
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '32px 1fr 56px',
            gap: '0 8px',
            padding: '6px 16px 4px',
            borderBottom: '1px solid rgba(255,255,255,.05)',
          }}
        >
          <div />
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '.45rem',
              color: 'rgba(255,255,255,.3)',
            }}
          >
            OPPONENT
          </div>
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '.45rem',
              color: 'rgba(135,206,235,.5)',
              textAlign: 'center',
            }}
          >
            PTS%
          </div>
        </div>
        {opponents.map((opp, idx) => (
          <div
            key={opp.team}
            style={{
              display: 'grid',
              gridTemplateColumns: '32px 1fr 56px',
              gap: '0 8px',
              padding: '8px 16px',
              background:
                idx % 2 === 0 ? 'rgba(255,255,255,.015)' : 'transparent',
              borderBottom:
                idx < opponents.length - 1
                  ? '1px solid rgba(255,255,255,.04)'
                  : 'none',
              alignItems: 'center',
            }}
          >
            <img
              src={`/assets/teamLogos/${opp.team}.png`}
              alt={opp.team}
              style={{
                width: 28,
                height: 28,
                objectFit: 'contain',
                filter: 'drop-shadow(0 0 4px rgba(135,206,235,.4))',
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            <span
              style={{
                fontFamily: "'VT323', monospace",
                fontSize: '1.4rem',
                color: '#E0E0E0',
                letterSpacing: 1,
                lineHeight: 1,
              }}
            >
              {opp.team}
            </span>
            <span
              style={{
                fontFamily: "'VT323', monospace",
                fontSize: '1.4rem',
                color: '#E0E0E0',
                textAlign: 'center',
              }}
            >
              {opp.pts_pct.toFixed(3)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TiebreakerTooltip({
  hoveredTeam,
  tiedStandings,
  seasonGames,
  anchorRect,
}) {
  if (!hoveredTeam || !tiedStandings || tiedStandings.length < 2 || !anchorRect)
    return null;
  const tooltipW = 360;
  const fixedLeft = window.innerWidth - tooltipW - 16;
  const tooltipHeight = 200;
  const desiredTop = anchorRect.top + anchorRect.height / 2 - tooltipHeight / 2;
  const fixedTop = Math.max(
    16,
    Math.min(desiredTop, window.innerHeight - tooltipHeight - 16)
  );
  const enriched = tiedStandings.map((s) => {
    let h2hPts = 0;
    tiedStandings.forEach((other) => {
      if (other.team === s.team) return;
      const { ptsA } = computeH2H(s.team, other.team, seasonGames);
      h2hPts += ptsA;
    });
    return { ...s, h2hPts };
  });
  const ranked = [...enriched].sort((a, b) => {
    if (b.h2hPts !== a.h2hPts) return b.h2hPts - a.h2hPts;
    if (b.w !== a.w) return b.w - a.w;
    return b.gd - a.gd;
  });
  const baseSeed = Math.min(...tiedStandings.map((s) => s._sortRank ?? 1));
  const maxH2H = Math.max(...ranked.map((r) => r.h2hPts), 1);
  const StatBar = ({ value, max, color }) => (
    <div
      style={{
        flex: 1,
        height: 5,
        background: 'rgba(255,255,255,.08)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.max(0, (value / (max || 1)) * 100)}%`,
          background: color,
          borderRadius: 2,
          boxShadow: `0 0 6px ${color}`,
          transition: 'width .4s cubic-bezier(.4,0,.2,1)',
        }}
      />
    </div>
  );
  return (
    <div
      style={{
        position: 'fixed',
        top: fixedTop,
        left: fixedLeft,
        zIndex: 9999,
        width: tooltipW,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -8,
          background:
            'radial-gradient(ellipse at center, rgba(255,215,0,.12) 0%, transparent 70%)',
          borderRadius: 16,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          background:
            'linear-gradient(155deg, rgba(8,6,20,.98) 0%, rgba(18,14,38,.98) 100%)',
          border: '1px solid rgba(255,215,0,.5)',
          borderRadius: 12,
          boxShadow:
            '0 0 0 1px rgba(255,140,0,.15), 0 8px 32px rgba(0,0,0,.8), 0 0 40px rgba(255,215,0,.1)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '10px 16px 8px',
            borderBottom: '1px solid rgba(255,215,0,.15)',
            background:
              'linear-gradient(90deg, rgba(255,140,0,.08) 0%, rgba(255,215,0,.04) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '.6rem',
              color: '#FF8C00',
              letterSpacing: 2,
              textShadow: '0 0 8px rgba(255,140,0,.7)',
            }}
          >
            TIEBREAKER
          </div>
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '.5rem',
              color: 'rgba(255,255,255,.4)',
              letterSpacing: 1,
            }}
          >
            {ranked.length} TEAMS · {ranked[0].pts} PTS
          </div>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '44px 1fr 56px 56px 56px',
            gap: '0 6px',
            padding: '6px 16px 4px',
            borderBottom: '1px solid rgba(255,255,255,.05)',
          }}
        >
          <div
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: '.45rem',
              color: 'rgba(255,255,255,.3)',
              textAlign: 'center',
            }}
          >
            SEED
          </div>
          <div />
          {['H2H', 'W', 'GD'].map((lbl) => (
            <div
              key={lbl}
              style={{
                fontFamily: "'Press Start 2P', monospace",
                fontSize: '.65rem',
                color: 'rgba(135,206,235,.5)',
                textAlign: 'center',
                letterSpacing: 1,
              }}
            >
              {lbl}
            </div>
          ))}
        </div>
        {ranked.map((row, idx) => {
          const seedNum = baseSeed + idx;
          const gdSign = row.gd > 0 ? '+' : '';
          return (
            <div
              key={row.team}
              style={{
                display: 'grid',
                gridTemplateColumns: '44px 1fr 56px 56px 56px',
                gap: '0 6px',
                padding: '9px 16px',
                background:
                  idx % 2 === 0 ? 'rgba(255,255,255,.015)' : 'transparent',
                borderBottom:
                  idx < ranked.length - 1
                    ? '1px solid rgba(255,255,255,.04)'
                    : 'none',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  fontFamily: "'VT323', monospace",
                  fontSize: '1.6rem',
                  color: '#FF8C00',
                  textAlign: 'center',
                  textShadow: '0 0 8px rgba(255,140,0,.6)',
                  lineHeight: 1,
                }}
              >
                {seedNum}
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: "'VT323', monospace",
                    fontSize: '1.5rem',
                    color: '#E0E0E0',
                    letterSpacing: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1,
                  }}
                >
                  {row.team}
                </span>
                <StatBar value={row.h2hPts} max={maxH2H} color="#FF8C00" />
              </div>
              <div
                style={{
                  fontFamily: "'VT323', monospace",
                  fontSize: '1.4rem',
                  color: '#FF8C00',
                  textAlign: 'center',
                  textShadow: '0 0 6px rgba(255,140,0,.5)',
                }}
              >
                {row.h2hPts}
              </div>
              <div
                style={{
                  fontFamily: "'VT323', monospace",
                  fontSize: '1.4rem',
                  color: '#87CEEB',
                  textAlign: 'center',
                  textShadow: '0 0 6px rgba(135,206,235,.4)',
                }}
              >
                {row.w}
              </div>
              <div
                style={{
                  fontFamily: "'VT323', monospace",
                  fontSize: '1.4rem',
                  color:
                    row.gd > 0 ? '#00FF88' : row.gd < 0 ? '#FF4444' : '#888',
                  textAlign: 'center',
                  textShadow:
                    row.gd > 0
                      ? '0 0 6px rgba(0,255,136,.5)'
                      : row.gd < 0
                      ? '0 0 6px rgba(255,68,68,.5)'
                      : 'none',
                }}
              >
                {gdSign}
                {row.gd}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

//Cutline banner
function ClinchBanner({ clinchNumber, playoffTeams }) {
  if (clinchNumber == null || !playoffTeams) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
      background: 'linear-gradient(135deg, rgba(0,30,60,.85) 0%, rgba(0,20,50,.95) 100%)',
      border: '1px solid rgba(255,215,0,.35)', borderRadius: 8,
      padding: '8px 20px', margin: '12px auto 0', maxWidth: 420,
      boxShadow: '0 0 0 1px rgba(255,140,0,.1), 0 4px 24px rgba(0,0,0,.6)',
    }}>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.5rem',
        color: 'rgba(255,215,0,.65)', letterSpacing: 2, whiteSpace: 'nowrap' }}>
        🏒 PLAYOFF CUT LINE
      </div>
      <div style={{ width: 1, height: 24, background: 'rgba(255,215,0,.2)', flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: '2.2rem',
          color: '#FFD700', lineHeight: 1, textShadow: '0 0 12px rgba(255,215,0,.6)' }}>
          {clinchNumber}
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.45rem',
          color: 'rgba(255,215,0,.5)', letterSpacing: 1, paddingBottom: 4 }}>
          PTS
        </div>
      </div>
    </div>
  );
}

function computeClinchElim(sortedStandings, playoffTeams, totalGamesPerTeam) {
  const clinched = new Set();
  const eliminated = new Set();
  if (!playoffTeams || playoffTeams <= 0 || sortedStandings.length === 0)
    return { clinched, eliminated };

  const effectiveTotal =
    totalGamesPerTeam ?? Math.max(...sortedStandings.map((t) => t.gp || 0));
  if (!effectiveTotal || effectiveTotal <= 0) return { clinched, eliminated };

  const n = sortedStandings.length;
  const maxPts = (t) =>
    (t.pts || 0) + Math.max(0, effectiveTotal - (t.gp || 0)) * 2;

  for (let r = 0; r < Math.min(playoffTeams, n); r++) {
    const myPts = sortedStandings[r].pts || 0;
    const challengers = sortedStandings
      .slice(r + 1)
      .map((t) => maxPts(t))
      .sort((a, b) => b - a);
    const spotsNeeded = playoffTeams - r;
    const bestChallengers = challengers.slice(0, spotsNeeded);
    if (
      bestChallengers.length < spotsNeeded ||
      bestChallengers[bestChallengers.length - 1] < myPts
    ) {
      clinched.add(sortedStandings[r].team);
    }
  }

  const bubblePts =
    sortedStandings[Math.min(playoffTeams - 1, n - 1)]?.pts || 0;
  for (let r = playoffTeams; r < n; r++) {
    if (maxPts(sortedStandings[r]) < bubblePts) {
      eliminated.add(sortedStandings[r].team);
    }
  }

  return { clinched, eliminated };
}

//Strenth of Schedule function
function computeSOS(teamCode, allTeams, rsGamesVs, playedGames, standingsMap) {
  if (!rsGamesVs || allTeams.length === 0) return { sos: null, opponents: [] };

  // Count how many times each opponent pair has already played
  const playedCounts = {};
  playedGames.forEach((g) => {
    if (g.score_home == null) return; // skip unplayed if any exist
    const key = [g.home, g.away].sort().join('::');
    playedCounts[key] = (playedCounts[key] || 0) + 1;
  });

  // Find opponents with remaining games
  const opponentCounts = {};
  allTeams.forEach((opp) => {
    if (opp === teamCode) return;
    const key = [teamCode, opp].sort().join('::');
    const played = playedCounts[key] || 0;
    const remaining = rsGamesVs - played;
    if (remaining > 0) {
      opponentCounts[opp] = remaining;
    }
  });

  const opponentCodes = Object.keys(opponentCounts);
  if (opponentCodes.length === 0) return { sos: null, opponents: [] };

  // Weight SOS by number of remaining games against each opponent
  let totalGames = 0;
  let weightedSum = 0;
  const opponents = opponentCodes
    .map((code) => standingsMap[code])
    .filter(Boolean)
    .map((opp) => ({ ...opp, remainingGames: opponentCounts[opp.team] }))
    .sort((a, b) => b.pts_pct - a.pts_pct);

  opponents.forEach((opp) => {
    weightedSum += opp.pts_pct * opp.remainingGames;
    totalGames += opp.remainingGames;
  });

  const sos = totalGames > 0 ? weightedSum / totalGames : null;
  return { sos, opponents };
}

/* Funtion to show playoff bracket before playoff_games table is populated */
function buildProjectedPlayoffGames(sortedStandings, playoffTeams) {
  if (!playoffTeams || sortedStandings.length < 2) return [];
  const size = Math.min(playoffTeams, sortedStandings.length);
  const seeded = sortedStandings.slice(0, size);
  const PAIRS = {
    2: [[1, 2]],
    4: [
      [1, 4],
      [2, 3],
    ],
    8: [
      [1, 8],
      [4, 5],
      [3, 6],
      [2, 7],
    ],
    16: [
      [1, 16],
      [8, 9],
      [4, 13],
      [5, 12],
      [6, 11],
      [3, 14],
      [7, 10],
      [2, 15],
    ],
  };
  const bracketSz = [2, 4, 8, 16].find((s) => size <= s) || 16;
  const pairs = PAIRS[bracketSz] || [];
  const seedMap = {};
  seeded.forEach((t, i) => {
    seedMap[i + 1] = t.team;
  });
  return pairs.map(([sA, sB], i) => ({
    lg: null,
    round: 1,
    series_number: i + 1,
    game_number: null,
    team_code_a: seedMap[sA] ?? null,
    team_code_b: seedMap[sB] ?? null,
    team_a_score: null,
    team_b_score: null,
    seed_a: sA,
    seed_b: sB,
  }));
}

export default function Standings() {
  const { selectedLeague } = useLeague();
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = usePersistedState(
    'standings_season',
    ''
  );
  const [rawGames, setRawGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playoffTeams, setPlayoffTeams] = useState(null);
  const [divisionMap, setDivisionMap] = useState([]);
  const [activeView, setActiveView] = useState('overall');
  const [playoffGames, setPlayoffGames] = useState([]);
  const [sortConfig, setSortConfig] = useState({
    key: 'default',
    direction: 'descending',
  });
  const reverseSortColumns = ['ga', 'l', 'otl'];
  const [tiebreakerInfo, setTiebreakerInfo] = useState(null);
  const [sosInfo, setSosInfo] = useState(null);

  // TeamDrawer state
  const [drawerPrimary, setDrawerPrimary] = useState(null);
  const [drawerCompare, setDrawerCompare] = useState(null);

  // Games
  const [allGames, setAllGames] = useState([]);

  // JS-driven breakpoint detection
  const [isMobileLandscape, setIsMobileLandscape] = useState(
    () =>
      window.matchMedia('(max-width: 932px) and (orientation: landscape)')
        .matches
  );
  const [isMobilePortrait, setIsMobilePortrait] = useState(
    () =>
      window.matchMedia('(max-width: 932px) and (orientation: portrait)')
        .matches
  );

  useEffect(() => {
    const mql = window.matchMedia(
      '(max-width: 932px) and (orientation: landscape)'
    );
    const mqp = window.matchMedia(
      '(max-width: 932px) and (orientation: portrait)'
    );
    const update = () => {
      setIsMobileLandscape(mql.matches);
      setIsMobilePortrait(mqp.matches);
    };
    update();
    mql.addEventListener('change', update);
    mqp.addEventListener('change', update);
    return () => {
      mql.removeEventListener('change', update);
      mqp.removeEventListener('change', update);
    };
  }, []);

  // ── PATCH 1: Series click handler for playoff bracket ─────────────────────
  // Opens TeamDrawer in compare mode with both teams from a clicked series.
  // Blocked on mobile (landscape + portrait).
  const handleSeriesClick = useCallback(
    (teamA, teamB) => {
      if (isMobileLandscape || isMobilePortrait) return;
      setDrawerPrimary(teamA);
      setDrawerCompare(teamB);
    },
    [isMobileLandscape, isMobilePortrait]
  );
  // ─────────────────────────────────────────────────────────────────────────

  const tableContainerRef = useRef(null);
  const stickyScrollRef = useRef(null);
  const [seasonTeams, setSeasonTeams] = useState([]);
  const [totalGamesPerTeam, setTotalGamesPerTeam] = useState(null);
  const [rsGamesVs, setRsGamesVs] = useState(null);
  const [compactView, setCompactView] = useState(false);
  const [fullScreenOpen, setFullScreenOpen] = useState(false);

  useEffect(() => {
    if (!selectedLeague) {
      setSeasons([]);
      setSelectedSeason('');
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('seasons')
        .select('lg, year, end_date, playoff_teams, rs_games_vs')
        .order('year', { ascending: false });
      if (error) {
        console.error('Error fetching seasons:', error);
        return;
      }
      const filtered = data.filter((s) => s.lg.startsWith(selectedLeague));
      setSeasons(filtered);
      if (filtered.length > 0)
        setSelectedSeason((prev) => {
          const match = filtered.find((s) => s.lg === prev);
          return match ? prev : filtered[0].lg;
        });
    })();
  }, [selectedLeague]);

  useEffect(() => {
    if (!selectedSeason) {
      setPlayoffTeams(null);
      return;
    }
    if (seasons.length === 0) return;
    setTiebreakerInfo(null);
    const season = seasons.find((s) => s.lg === selectedSeason);
    setPlayoffTeams(season?.playoff_teams ?? null);
    setRsGamesVs(season?.rs_games_vs ?? null);
  }, [selectedSeason, seasons]);

  useEffect(() => {
    if (!selectedLeague || !selectedSeason) {
      setRawGames([]);
      return;
    }
    if (seasons.length === 0) return;
    (async () => {
      setLoading(true);
      const [
        { data: gamesData, error },
        { data: teamsData },
        { data: allGamesData },
      ] = await Promise.all([
        supabase
          .from('games')
          .select(
            'id, home, away, score_home, score_away, ot, coach_home, coach_away'
          )
          .eq('lg', selectedSeason)
          .ilike('mode', 'season')
          .not('score_home', 'is', null)
          .order('id', { ascending: true }),
        supabase.from('teams').select('abr, coach').eq('lg', selectedSeason),
        supabase
          .from('games')
          .select('id, home, away, score_home, score_away')
          .eq('lg', selectedSeason)
          .ilike('mode', 'season')
          .order('id', { ascending: true }),
      ]);
      if (error) console.error('Error fetching games:', error);
      setRawGames(gamesData || []);
      setAllGames(allGamesData || []);
      setSeasonTeams(teamsData || []);

      const numTeams = (teamsData || []).length;
      const seasonMeta = seasons.find((s) => s.lg === selectedSeason);
      const rsVs = seasonMeta?.rs_games_vs ?? null;
      let gamesPerTeam =
        rsVs != null && numTeams > 0 ? (numTeams - 1) * rsVs : null;
      setTotalGamesPerTeam(gamesPerTeam);
      setLoading(false);
    })();
  }, [selectedLeague, selectedSeason, seasons]);

  useEffect(() => {
    if (!selectedSeason) {
      setDivisionMap([]);
      setActiveView((prev) => (prev === 'playoffs' ? prev : 'overall'));
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('historical_division_map')
        .select('*')
        .eq('season', selectedSeason);
      if (error) {
        console.error('Error fetching division map:', error);
        setDivisionMap([]);
      } else setDivisionMap(data || []);
      setActiveView((prev) => (prev === 'playoffs' ? prev : 'overall'));
    })();
  }, [selectedSeason]);

  useEffect(() => {
    if (!selectedSeason) {
      setPlayoffGames([]);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('playoff_games')
        .select(
          'lg,round,series_number,game_number,team_code_a,team_code_b,team_a_score,team_b_score,game_date,seed_a,seed_b'
        )
        .eq('lg', selectedSeason)
        .order('game_number', { ascending: true });
      if (error) console.error('Error fetching playoff_games:', error);
      setPlayoffGames(data || []);
    })();
  }, [selectedSeason]);

  const computedStandings = useMemo(() => {
    const standings = computeStandings(rawGames);
    const playedTeams = new Set(standings.map((s) => s.team));
    const zeroed = seasonTeams
      .filter(({ abr }) => !playedTeams.has(abr))
      .map(({ abr, coach }) => ({
        team: abr,
        coach: coach || '',
        gp: 0,
        w: 0,
        l: 0,
        t: 0,
        otl: 0,
        otw: 0,
        pts: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        shutouts: 0,
        pts_pct: 0,
      }));
    return [...standings, ...zeroed].map((s) => {
      const gr =
        totalGamesPerTeam != null
          ? Math.max(0, totalGamesPerTeam - (s.gp || 0))
          : null;
      return {
        ...s,
        gr,
        maxPts: gr != null ? (s.pts || 0) + gr * 2 : null,
        gf_per_g: s.gp > 0 ? s.gf / s.gp : null,
        ga_per_g: s.gp > 0 ? s.ga / s.gp : null,
      };
    });
  }, [rawGames, seasonTeams, totalGamesPerTeam]);

  const standingsMap = useMemo(() => {
    const map = {};
    computedStandings.forEach((s) => {
      map[s.team] = s;
    });
    return map;
  }, [computedStandings]);

  const sosData = useMemo(() => {
    const allTeamCodes = computedStandings.map((s) => s.team);
    const map = {};
    computedStandings.forEach((s) => {
      map[s.team] = computeSOS(
        s.team,
        allTeamCodes,
        rsGamesVs, // already in state
        rawGames, // completed games only
        standingsMap
      );
    });
    return map;
  }, [computedStandings, rsGamesVs, rawGames, standingsMap]);

  const computedStandingsWithSOS = useMemo(() => {
    return computedStandings.map((s) => ({
      ...s,
      sos: sosData[s.team]?.sos ?? null,
    }));
  }, [computedStandings, sosData]);

  const defaultSorted = useMemo(
    () =>
      sortWithTiebreakers(computedStandingsWithSOS, rawGames).map((s, idx) => ({
        ...s,
        _sortRank: idx + 1,
      })),
    [computedStandingsWithSOS, rawGames]
  );

  const sortedStandings = useMemo(() => {
    if (sortConfig.key === 'default' || sortConfig.key === 'pts') {
      return sortConfig.direction === 'descending'
        ? defaultSorted
        : [...defaultSorted].reverse();
    }
    if (sortConfig.key === 'season_rank') return defaultSorted;
    return [...defaultSorted].sort((a, b) => {
      const { key, direction } = sortConfig;
      if (a[key] === null || a[key] === undefined) return 1;
      if (b[key] === null || b[key] === undefined) return -1;
      if (typeof a[key] === 'string') {
        return direction === 'ascending'
          ? a[key].localeCompare(b[key])
          : b[key].localeCompare(a[key]);
      }
      return direction === 'ascending' ? a[key] - b[key] : b[key] - a[key];
    });
  }, [defaultSorted, sortConfig]);

  

  const isProjectedBracket =
    playoffGames.length === 0 && (playoffTeams ?? 0) > 0;
  const effectivePlayoffGames = isProjectedBracket
    ? buildProjectedPlayoffGames(defaultSorted, playoffTeams)
    : playoffGames;

  //Cutline useMemo
  const clinchNumber = useMemo(() => {
    if (!playoffTeams || defaultSorted.length <= playoffTeams) return null;
  
    const bubbleOutsider = defaultSorted[playoffTeams]; // 17th place (index 16)
    if (!bubbleOutsider) return null;
  
    return (bubbleOutsider.maxPts ?? bubbleOutsider.pts) + 1;
  }, [defaultSorted, playoffTeams]);

  const tiedPtsSet = useMemo(() => {
    const ptsCounts = {};
    sortedStandings.forEach((s) => {
      const p = Number(s.pts);
      if (!ptsCounts[p]) ptsCounts[p] = [];
      ptsCounts[p].push(s);
    });
    const result = new Set();
    Object.entries(ptsCounts).forEach(([p, teams]) => {
      if (teams.length < 2) return;
      const anyNearEnd = teams.some((t) => (t.gr ?? 0) <= 10);
      const anyHasPlayed = teams.some((t) => (t.gp || 0) > 0);
      if (anyNearEnd && anyHasPlayed) result.add(Number(p));
    });
    return result;
  }, [sortedStandings, totalGamesPerTeam]);

  const { clinched, eliminated } = useMemo(() => {
    // Clinched = anyone whose current pts >= clinchNumber
    const clinched = new Set(
      defaultSorted
        .filter((t) => clinchNumber != null && (t.pts || 0) >= clinchNumber)
        .map((t) => t.team)
    );
  
    // Eliminated = anyone whose maxPts < the bubble team's current pts
    const bubblePts = defaultSorted[playoffTeams - 1]?.pts || 0;
    const eliminated = new Set(
      defaultSorted
        .slice(playoffTeams)
        .filter((t) => (t.maxPts ?? t.pts) < bubblePts)
        .map((t) => t.team)
    );
  
    return { clinched, eliminated };
  }, [defaultSorted, playoffTeams, clinchNumber]);


  useEffect(() => {
    if (computedStandings.length > 0 && window.innerWidth <= 932) {
      setTiebreakerInfo(null);
      setFullScreenOpen(true);
    }
  }, [computedStandings.length]);

  useEffect(() => {
    const container = tableContainerRef.current;
    const sticky = stickyScrollRef.current;
    if (!container || !sticky) return;
    const inner = sticky.querySelector('.sticky-scroll-inner');
    const syncWidth = () => {
      inner.style.width = container.scrollWidth + 'px';
    };
    syncWidth();
    const ro = new ResizeObserver(syncWidth);
    ro.observe(container);
    const onContainerScroll = () => {
      sticky.scrollLeft = container.scrollLeft;
    };
    const onStickyScroll = () => {
      container.scrollLeft = sticky.scrollLeft;
    };
    container.addEventListener('scroll', onContainerScroll);
    sticky.addEventListener('scroll', onStickyScroll);
    return () => {
      ro.disconnect();
      container.removeEventListener('scroll', onContainerScroll);
      sticky.removeEventListener('scroll', onStickyScroll);
    };
  }, [sortedStandings, activeView, divisionMap]);

  const handleSort = (key) => {
    if (key === 'season_rank') {
      setSortConfig({ key: 'default', direction: 'descending' });
      return;
    }
    let direction = 'ascending';
    if (sortConfig.key === key) {
      direction =
        sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
    } else {
      direction = reverseSortColumns.includes(key) ? 'ascending' : 'descending';
    }
    setSortConfig({ key, direction });
  };

  const handleRowMouseEnter = useCallback(
    (e, team, pts) => {
      if (window.matchMedia('(hover: none)').matches) return;
      if (isMobileLandscape || isMobilePortrait) return;

      const tiedTeams = sortedStandings.filter(
        (s) => Number(s.pts) === Number(pts)
      );
      if (tiedTeams.length < 2) {
        setTiebreakerInfo(null);
        return;
      }
      const anyNearEnd = tiedTeams.some((t) => (t.gr ?? 0) <= 10);
      if (!anyNearEnd) {
        setTiebreakerInfo(null);
        return;
      }
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      setTiebreakerInfo({
        hoveredTeam: team,
        tiedStandings: tiedTeams,
        anchorRect: {
          top: r.top,
          right: r.right,
          left: r.left,
          height: r.height,
        },
      });
    },
    [sortedStandings, totalGamesPerTeam, isMobileLandscape, isMobilePortrait]
  );

  const handleRowMouseLeave = useCallback(() => {
    setTiebreakerInfo(null);
  }, []);

  const hasConferences = divisionMap.some((d) => d.conference != null);
  const hasDivisions = divisionMap.some((d) => d.division != null);
  const availableViews = {
    overall: true,
    conference: hasConferences,
    division: hasDivisions,
    playoffs: (playoffTeams ?? 0) > 0,
  };

  const getGroupedStandings = () => {
    if (divisionMap.length === 0 || activeView === 'overall') {
      return [{ title: null, subtitle: null, teams: sortedStandings }];
    }
    const sortGroup = (teams) => {
      if (
        sortConfig.key !== 'default' &&
        sortConfig.key !== 'pts' &&
        sortConfig.key !== 'season_rank'
      ) {
        return [...teams].sort((a, b) => {
          const { key, direction } = sortConfig;
          if (a[key] === null || a[key] === undefined) return 1;
          if (b[key] === null || b[key] === undefined) return -1;
          if (typeof a[key] === 'string') {
            return direction === 'ascending'
              ? a[key].localeCompare(b[key])
              : b[key].localeCompare(a[key]);
          }
          return direction === 'ascending' ? a[key] - b[key] : b[key] - a[key];
        });
      }
      return sortWithTiebreakers(teams, rawGames).map((s, idx) => ({
        ...s,
        _sortRank: idx + 1,
      }));
    };
    if (activeView === 'conference' && hasConferences) {
      const conferences = [
        ...new Set(divisionMap.map((d) => d.conference).filter(Boolean)),
      ];
      return conferences.map((conf) => {
        const teams = sortedStandings.filter(
          (s) => divisionMap.find((d) => d.team === s.team)?.conference === conf
        );
        return { title: conf, subtitle: null, teams: sortGroup(teams) };
      });
    }
    if (activeView === 'division' && hasDivisions) {
      if (hasConferences) {
        const result = [];
        const conferences = [
          ...new Set(divisionMap.map((d) => d.conference).filter(Boolean)),
        ];
        conferences.forEach((conf) => {
          const divs = [
            ...new Set(
              divisionMap
                .filter((d) => d.conference === conf)
                .map((d) => d.division)
                .filter(Boolean)
            ),
          ];
          divs.forEach((div) => {
            const teams = sortedStandings.filter((s) => {
              const ti = divisionMap.find((d) => d.team === s.team);
              return ti?.conference === conf && ti?.division === div;
            });
            result.push({
              title: conf,
              subtitle: div,
              teams: sortGroup(teams),
            });
          });
        });
        return result;
      } else {
        const divisions = [
          ...new Set(divisionMap.map((d) => d.division).filter(Boolean)),
        ];
        return divisions.map((div) => {
          const teams = sortedStandings.filter(
            (s) => divisionMap.find((d) => d.team === s.team)?.division === div
          );
          return { title: div, subtitle: null, teams: sortGroup(teams) };
        });
      }
    }
    return [{ title: null, subtitle: null, teams: sortedStandings }];
  };

  const groupedStandings = getGroupedStandings();

  const showPerGame = !isMobilePortrait;
  const showCoach = !isMobileLandscape;

  const columns = [
    { label: 'Rank', key: 'season_rank', width: '5px' },
    { label: 'Team', key: 'team', width: '5px' },
    ...(showCoach ? [{ label: 'Coach', key: 'coach', width: '55px' }] : []),
    { label: 'GP', key: 'gp', width: '5px' },
    { label: 'W', key: 'w', width: '5px' },
    { label: 'L', key: 'l', width: '5px' },
    { label: 'T', key: 't', width: '5px' },
    { label: 'OTL', key: 'otl', width: '5px' },
    { label: 'Pts', key: 'pts', width: '5px' },
    { label: 'Pts%', key: 'pts_pct', width: '10px' },
    { label: 'GF', key: 'gf', width: '10px' },
    ...(showPerGame ? [{ label: 'GF/G', key: 'gf_per_g', width: '10px' }] : []),
    { label: 'GA', key: 'ga', width: '10px' },
    ...(showPerGame ? [{ label: 'GA/G', key: 'ga_per_g', width: '10px' }] : []),
    { label: 'GD', key: 'gd', width: '10px' },
    { label: 'OTW', key: 'otw', width: '5px' },
    { label: 'SO', key: 'shutouts', width: '5px' },
    { label: 'STRK', key: 'streakVal', width: '5px' },
    { label: 'GR', key: 'gr', width: '5px' },
    {
      label: (
        <>
          <span className="col-full">MAX PTS</span>
          <span className="col-short">MAX</span>
        </>
      ),
      key: 'maxPts',
      width: '5px',
    },
    ...(!isMobilePortrait ? [{ label: 'SOS', key: 'sos', width: '10px' }] : []),
  ];

  const activeSortKey = sortConfig.key === 'default' ? 'pts' : sortConfig.key;
  const gfPerG = (s) => (s.gf_per_g != null ? s.gf_per_g.toFixed(2) : '—');
  const gaPerG = (s) => (s.ga_per_g != null ? s.ga_per_g.toFixed(2) : '—');

  return (
    <div className="standings-page">
      <div className="scoreboard-header-container">
        <div className="scoreboard-header">
          <div className="led-text">LEAGUE STANDINGS</div>
        </div>
      </div>

      <div className="control-panel">
        <div className="control-group">
          <label>SEASON</label>
          <select
            className="arcade-select"
            value={selectedSeason}
            onChange={(e) => {
              setSelectedSeason(e.target.value);
              setSortConfig({ key: 'default', direction: 'descending' });
            }}
            disabled={!selectedLeague || seasons.length === 0}
          >
            <option value="">SELECT SEASON</option>
            {seasons.map((s) => (
              <option key={s.lg} value={s.lg}>
                {s.lg} ({s.year})
              </option>
            ))}
          </select>
        </div>
      </div>

      {computedStandings.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '2rem',
          marginTop: '1rem',
        }}>
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', width: '100%' }}>
      <div className="view-tabs">
      <button
        className={`tab-button ${activeView === 'overall' ? 'active' : ''}`}
        onClick={() => setActiveView('overall')}
      >
        <span className="tab-icon">⚡</span>
        <span className="tab-text">OVERALL</span>
      </button>
      {availableViews.conference && (
        <button
          className={`tab-button ${activeView === 'conference' ? 'active' : ''}`}
          onClick={() => setActiveView('conference')}
        >
          <span className="tab-icon">🏆</span>
          <span className="tab-text">CONFERENCE</span>
        </button>
      )}
      {availableViews.division && (
        <button
          className={`tab-button ${activeView === 'division' ? 'active' : ''}`}
          onClick={() => setActiveView('division')}
        >
          <span className="tab-icon">🎯</span>
          <span className="tab-text">DIVISION</span>
        </button>
      )}
      {availableViews.playoffs && (
        <button
          className={`tab-button playoffs-tab ${activeView === 'playoffs' ? 'active' : ''}`}
          onClick={() => setActiveView('playoffs')}
        >
          <span className="tab-icon">🏅</span>
          <span className="tab-text">PLAYOFFS</span>
        </button>
      )}
    </div>
    <div
      style={{
        position: 'absolute',
        right: '8px',
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        gap: '8px',
      }}
    >
      <button
        className={`compact-toggle ${compactView ? 'active' : ''}`}
        onClick={() => setCompactView((v) => !v)}
        title="Compact View"
      >
        ⊞
      </button>
      <button
        className="compact-toggle"
        onClick={() => setFullScreenOpen(true)}
        title="Full Screen View"
      >
        ⛶
      </button>
    </div>
  </div>
  {computedStandings.length > 0 &&
  !isMobilePortrait &&
  activeView === 'overall' && (
    <ClinchBanner
      clinchNumber={clinchNumber}
      playoffTeams={playoffTeams}
    />
)}
</div>
  
)}


      {loading ? (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <div className="loading-text">LOADING DATA...</div>
        </div>
      ) : !selectedLeague ? (
        <div className="no-data">
          <div className="no-data-text">SELECT A LEAGUE FROM THE MENU</div>
        </div>
      ) : computedStandings.length === 0 ? (
        <div className="no-data">
          <div className="no-data-text">SELECT A SEASON</div>
        </div>
      ) : activeView === 'playoffs' ? (
        effectivePlayoffGames?.length ? (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <PlayoffBracket
              playoffGames={effectivePlayoffGames}
              seasonGames={rawGames}
              selectedSeason={selectedSeason}
              selectedLeague={selectedLeague}
              playoffTeams={playoffTeams}
              onSeriesClick={handleSeriesClick}
            />
          </div>
        ) : (
          <div className="no-data">
            <div className="no-data-text">NOT ENOUGH TEAMS FOR BRACKET</div>
          </div>
        )
      ) : (
        <>
          {tiebreakerInfo &&
            tiebreakerInfo.anchorRect &&
            createPortal(
              <TiebreakerTooltip
                hoveredTeam={tiebreakerInfo.hoveredTeam}
                tiedStandings={tiebreakerInfo.tiedStandings}
                seasonGames={rawGames}
                anchorRect={tiebreakerInfo.anchorRect}
              />,
              document.body
            )}

          {sosInfo &&
            sosInfo.anchorRect &&
            createPortal(<SOSTooltip sosInfo={sosInfo} />, document.body)}

          <div
            className={`table-container ${compactView ? 'compact' : ''}`}
            ref={tableContainerRef}
          >
            {groupedStandings.map((group, groupIdx) => (
              <div key={groupIdx} className="standings-group">
                {group.title && (
                  <div className="group-header">
                    <div className="group-title">
                      {group.title}
                      {group.subtitle && (
                        <span className="group-subtitle">
                          {' '}
                          - {group.subtitle}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {!group.title && group.subtitle && (
                  <div className="group-header">
                    <div className="group-title">{group.subtitle}</div>
                  </div>
                )}
                <div className="scoreboard-frame">
                  <table className="arcade-table">
                    <thead>
                      <tr>
                        {columns.map((col) => (
                          <th
                            key={col.key}
                            onClick={() => handleSort(col.key)}
                            style={{ width: col.width }}
                            className={[
                              activeSortKey === col.key ? 'sorted-column' : '',
                              col.key === 'season_rank' ? 'rank-column' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            <div className="th-content">
                              <span>{col.label}</span>
                              {activeSortKey === col.key && (
                                <span className="sort-indicator">
                                  {sortConfig.direction === 'ascending'
                                    ? '▲'
                                    : '▼'}
                                </span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.teams.map((s, idx) => {
                        const isTied = tiedPtsSet.has(Number(s.pts));
                        const isClinched = clinched.has(s.team);
                        const isElim = eliminated.has(s.team);
                        const rowClass = [
                          idx % 2 === 0 ? 'even-row' : 'odd-row',
                          playoffTeams && s._sortRank <= playoffTeams
                            ? 'playoff-team'
                            : 'non-playoff-team',
                          isTied ? 'tied-row' : '',
                          isClinched ? 'clinched-row' : '',
                          isElim ? 'eliminated-row' : '',
                        ]
                          .filter(Boolean)
                          .join(' ');
                        return (
                          <React.Fragment key={`${s.team}-${idx}`}>
                            <tr
                              className={rowClass}
                              style={{ cursor: 'pointer' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!drawerPrimary) {
                                  setDrawerPrimary(s.team);
                                  setDrawerCompare(null);
                                } else if (drawerPrimary === s.team) {
                                  setDrawerPrimary(null);
                                  setDrawerCompare(null);
                                } else if (drawerCompare === s.team) {
                                  setDrawerCompare(null);
                                } else {
                                  setDrawerCompare(s.team);
                                }
                              }}
                            >
                              <td className="rank-cell">
                                <span className="rank-badge">{idx + 1}</span>
                              </td>
                              <td className="team-cell">
                                <div className="row-banner-overlay">
                                  <img
                                    src={`/assets/banners/${s.team}.png`}
                                    alt=""
                                    className="banner-image"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                </div>
                                <div className="team-info">
                                  <div
                                    className={`logo-container${
                                      isClinched
                                        ? ' logo-clinched'
                                        : isElim
                                        ? ' logo-elim'
                                        : ''
                                    }`}
                                  >
                                    <img
                                      src={`/assets/teamLogos/${s.team}.png`}
                                      alt={s.team}
                                      className="team-logo"
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextElementSibling.style.display =
                                          'flex';
                                      }}
                                    />
                                    <div
                                      className="logo-fallback"
                                      style={{ display: 'none' }}
                                    >
                                      {s.team}
                                    </div>
                                  </div>
                                  <span className="team-code">{s.team}</span>
                                </div>
                              </td>
                              {showCoach && (
                                <td className="coach-cell">{s.coach}</td>
                              )}
                              <td
                                className={`stat-cell ${
                                  activeSortKey === 'gp' ? 'sorted-cell' : ''
                                }`}
                              >
                                {s.gp}
                              </td>
                              <td
                                className={`stat-cell ${
                                  activeSortKey === 'w' ? 'sorted-cell' : ''
                                }`}
                              >
                                {s.w}
                              </td>
                              <td
                                className={`stat-cell ${
                                  activeSortKey === 'l' ? 'sorted-cell' : ''
                                }`}
                              >
                                {s.l}
                              </td>
                              <td
                                className={`stat-cell ${
                                  activeSortKey === 't' ? 'sorted-cell' : ''
                                }`}
                              >
                                {s.t}
                              </td>
                              <td
                                className={`stat-cell ${
                                  activeSortKey === 'otl' ? 'sorted-cell' : ''
                                }`}
                              >
                                {s.otl}
                              </td>
                              <td
                                className={`stat-cell pts-cell ${
                                  activeSortKey === 'pts' ? 'sorted-cell' : ''
                                } ${isTied ? 'tied-pts' : ''}`}
                                onMouseEnter={
                                  isTied
                                    ? (e) =>
                                        handleRowMouseEnter(
                                          e,
                                          s.team,
                                          Number(s.pts)
                                        )
                                    : undefined
                                }
                                onMouseLeave={
                                  isTied ? handleRowMouseLeave : undefined
                                }
                              >
                                {s.pts}
                              </td>
                              <td
                                className={`stat-cell ${
                                  activeSortKey === 'pts_pct'
                                    ? 'sorted-cell'
                                    : ''
                                }`}
                              >
                                {s.gp > 0
                                  ? (s.pts / (s.gp * 2)).toFixed(3)
                                  : '.000'}
                              </td>
                              <td
                                className={`stat-cell ${
                                  activeSortKey === 'gf' ? 'sorted-cell' : ''
                                }`}
                              >
                                {s.gf}
                              </td>
                              {showPerGame && (
                                <td
                                  className={`stat-cell per-game-cell ${
                                    activeSortKey === 'gf_per_g'
                                      ? 'sorted-cell'
                                      : ''
                                  }`}
                                >
                                  {gfPerG(s)}
                                </td>
                              )}
                              <td
                                className={`stat-cell ${
                                  activeSortKey === 'ga' ? 'sorted-cell' : ''
                                }`}
                              >
                                {s.ga}
                              </td>
                              {showPerGame && (
                                <td
                                  className={`stat-cell ${
                                    activeSortKey === 'ga_per_g'
                                      ? 'sorted-cell'
                                      : ''
                                  }`}
                                >
                                  {gaPerG(s)}
                                </td>
                              )}
                              <td
                                className={`stat-cell ${
                                  s.gd > 0
                                    ? 'positive-gd'
                                    : s.gd < 0
                                    ? 'negative-gd'
                                    : ''
                                } ${
                                  activeSortKey === 'gd' ? 'sorted-cell' : ''
                                }`}
                              >
                                {s.gd > 0 ? '+' : ''}
                                {s.gd}
                              </td>
                              <td
                                className={`stat-cell ${
                                  activeSortKey === 'otw' ? 'sorted-cell' : ''
                                }`}
                              >
                                {s.otw}
                              </td>
                              <td
                                className={`stat-cell ${
                                  activeSortKey === 'shutouts'
                                    ? 'sorted-cell'
                                    : ''
                                }`}
                              >
                                {s.shutouts}
                              </td>
                              <td
                                className={`stat-cell streak-cell ${
                                  activeSortKey === 'streakVal'
                                    ? 'sorted-cell'
                                    : ''
                                } ${
                                  s.streakType === 'W'
                                    ? 'streak-w'
                                    : s.streakType === 'L'
                                    ? 'streak-l'
                                    : 'streak-t'
                                }`}
                              >
                                {s.streak}
                              </td>
                              <td
                                className={`stat-cell ${
                                  activeSortKey === 'gr' ? 'sorted-cell' : ''
                                }`}
                              >
                                {s.gr ?? '—'}
                              </td>
                              <td
                                className={`stat-cell ${
                                  activeSortKey === 'maxPts'
                                    ? 'sorted-cell'
                                    : ''
                                }`}
                              >
                                {s.maxPts ?? '—'}
                              </td>
                              {!isMobilePortrait &&
                                (() => {
                                  const sd = sosData[s.team];
                                  const val = sd?.sos;
                                  return (
                                    <td
                                      className={`stat-cell sos-cell ${
                                        activeSortKey === 'sos'
                                          ? 'sorted-cell'
                                          : ''
                                      } ${val != null ? 'sos-hoverable' : ''}`}
                                      onMouseEnter={(e) => {
                                        if (
                                          window.matchMedia('(hover: none)')
                                            .matches
                                        )
                                          return;
                                        if (
                                          isMobileLandscape ||
                                          isMobilePortrait
                                        )
                                          return; // add this
                                        if (!sd || val == null) return;
                                        //   return;
                                        const r =
                                          e.currentTarget.getBoundingClientRect();
                                        setSosInfo({
                                          team: s.team,
                                          data: sd,
                                          anchorRect: {
                                            top: r.top,
                                            right: r.right,
                                            left: r.left,
                                            height: r.height,
                                          },
                                        });
                                      }}
                                      onMouseLeave={() => setSosInfo(null)}
                                    >
                                      {val != null ? val.toFixed(3) : '—'}
                                    </td>
                                  );
                                })()}
                            </tr>
                            {playoffTeams && idx === playoffTeams - 1 && (
                              <tr className="playoff-cutoff-row">
                                <td
                                  colSpan={columns.length}
                                  className="playoff-cutoff-cell"
                                >
                                  <div className="playoff-cutoff-line">
                                    <div className="cutoff-glow" />
                                    <div className="cutoff-content">
                                      <div className="cutoff-diamond" />
                                      <span className="cutoff-text">
                                        PLAYOFF LINE
                                      </span>
                                      <div className="cutoff-diamond" />
                                    </div>
                                    <div className="cutoff-particles">
                                      {[1, 2, 3, 4, 5].map((n) => (
                                        <div
                                          key={n}
                                          className={`particle particle-${n}`}
                                        />
                                      ))}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
          {/* NOTE: TeamDrawer moved outside table-container — see PATCH 3 below */}
        </>
      )}

      {fullScreenOpen && (
        <FullScreenStandingsModal
          onClose={() => setFullScreenOpen(false)}
          groupedStandings={groupedStandings}
          columns={columns}
          sortConfig={sortConfig}
          playoffTeams={playoffTeams}
          clinched={clinched}
          eliminated={eliminated}
          tiedPtsSet={tiedPtsSet}
          rawGames={rawGames}
          totalGamesPerTeam={totalGamesPerTeam}
          showPerGame={showPerGame}
          showCoach={showCoach}
          gfPerG={gfPerG}
          gaPerG={gaPerG}
          sosData={sosData}
        />
      )}

      {/* PATCH 3: TeamDrawer lives here — outside both the standings table-container
          AND the playoffs block, so it renders regardless of activeView.
          Blocked on mobile (both orientations). */}
      {!isMobileLandscape && !isMobilePortrait && (
        <TeamDrawer
          selectedSeason={selectedSeason}
          computedStandings={computedStandings}
          primaryTeam={drawerPrimary}
          compareTeam={drawerCompare}
          onClose={() => {
            setDrawerPrimary(null);
            setDrawerCompare(null);
          }}
        />
      )}

      <style>{`
        html { overflow-x: auto; }
        body { overflow-x: auto; }
        .standings-page { overflow-x: visible; }
        .standings-page { padding:1rem 2rem; min-height:100vh; background:radial-gradient(ellipse at top,#0a0a15 0%,#000 100%); }
        .table-container { overflow-x: auto; display: block; width: 100%; }
        .table-container::-webkit-scrollbar { display: none; }
        .arcade-table { width: max-content; min-width: 100%; display: inline-table; }
        .scoreboard-header-container { display:flex; justify-content:center; margin-bottom:1rem; }
        .scoreboard-header { background:#000; border:6px solid #333; border-radius:8px; padding:1rem 2rem; box-shadow:0 0 0 2px #000,inset 0 0 20px rgba(0,0,0,.8),0 8px 16px rgba(0,0,0,.5),0 0 40px rgba(255,215,0,.3); position:relative; overflow:hidden; }
        .scoreboard-header::before { content:''; position:absolute; inset:0; background:repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px),repeating-linear-gradient(90deg,transparent 0px,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px); pointer-events:none; }
        .scoreboard-header::after { content:''; position:absolute; top:-50%; left:-50%; width:200%; height:200%; background:linear-gradient(45deg,transparent 30%,rgba(255,215,0,.1) 50%,transparent 70%); animation:shimmer 3s infinite; }
        @keyframes shimmer { 0%{transform:translateX(-100%) translateY(-100%) rotate(45deg)} 100%{transform:translateX(100%) translateY(100%) rotate(45deg)} }
        .led-text { font-family:'Press Start 2P',monospace; font-size:2rem; color:#FFD700; letter-spacing:6px; text-shadow:0 0 10px #FF8C00,0 0 20px #FF8C00,0 0 30px #FFD700; filter:contrast(1.3) brightness(1.2); position:relative; }
        .control-panel { display:flex; gap:2rem; justify-content:center; margin-bottom:1.5rem; flex-wrap:wrap; }
        .control-group { display:flex; flex-direction:column; gap:.5rem; }
        .control-group label { font-family:'Press Start 2P',monospace; font-size:.7rem; color:#FFD700; letter-spacing:2px; }
        .view-tabs { display:inline-flex; gap:1rem; background:linear-gradient(180deg,#0a0a15 0%,#1a1a2e 100%); padding:.75rem; border-radius:12px; border:3px solid #333; box-shadow:0 0 20px rgba(0,0,0,.5),inset 0 0 20px rgba(0,0,0,.3); justify-content:center; }
        .tab-button { display:flex; align-items:center; gap:.5rem; padding:.75rem 1.5rem; background:linear-gradient(180deg,#1a1a2e 0%,#0f0f1a 100%); border:2px solid #87CEEB; border-radius:8px; color:#87CEEB; font-family:'Press Start 2P',monospace; font-size:.65rem; cursor:pointer; transition:all .3s ease; box-shadow:0 0 10px rgba(135,206,235,.3),inset 0 0 10px rgba(135,206,235,.1); letter-spacing:1px; position:relative; overflow:hidden; }
        .tab-button::before { content:''; position:absolute; top:0; left:-100%; width:100%; height:100%; background:linear-gradient(90deg,transparent,rgba(135,206,235,.3),transparent); transition:left .5s ease; }
        .tab-button:hover::before { left:100%; }
        .tab-button:hover { border-color:#FFD700; color:#FFD700; transform:translateY(-3px); box-shadow:0 0 20px rgba(255,215,0,.6),inset 0 0 15px rgba(255,215,0,.2); }
        .tab-button.active { background:linear-gradient(180deg,#FF8C00 0%,#FF6347 100%); border-color:#FFD700; color:#FFF; box-shadow:0 0 25px rgba(255,140,0,.8),inset 0 0 20px rgba(255,215,0,.3); transform:translateY(-2px); }
        .tab-button.active::after { content:''; position:absolute; bottom:-3px; left:50%; transform:translateX(-50%); width:60%; height:3px; background:linear-gradient(90deg,transparent,#FFD700,transparent); box-shadow:0 0 10px #FFD700; animation:tab-pulse 2s ease-in-out infinite; }
        @keyframes tab-pulse { 0%,100%{opacity:.6;width:60%} 50%{opacity:1;width:80%} }
        .tab-icon { font-size:1rem; filter:drop-shadow(0 0 5px currentColor); }
        .tab-text { position:relative; z-index:1; }
        .tab-button.playoffs-tab { border-color:#FFD700; color:#FFD700; }
        .tab-button.playoffs-tab.active { background:linear-gradient(180deg,#FFD700 0%,#FF8C00 100%); color:#000; }
        .standings-group { margin-bottom:2.5rem; }
        .standings-group:last-child { margin-bottom:0; }
        .group-header { display:flex; justify-content:center; margin-bottom:1rem; }
        .group-title { font-family:'Press Start 2P',monospace; font-size:1.3rem; color:#FFD700; letter-spacing:4px; text-shadow:0 0 10px #FFD700,0 0 20px #FFD700,0 0 30px #FFD700; padding:.75rem 2rem; background:linear-gradient(180deg,#0a0a15 0%,#1a1a2e 100%); border:3px solid #FFD700; border-radius:8px; box-shadow:0 0 20px rgba(255,215,0,.5),inset 0 0 20px rgba(255,215,0,.2); position:relative; overflow:hidden; }
        .group-title::before { content:''; position:absolute; top:-50%; left:-50%; width:200%; height:200%; background:linear-gradient(45deg,transparent 30%,rgba(255,215,0,.1) 50%,transparent 70%); animation:shimmer 3s infinite; }
        .group-subtitle { font-size:.9rem; color:#87CEEB; text-shadow:0 0 8px #87CEEB; }
        .arcade-select { background:linear-gradient(180deg,#1a1a2e 0%,#0a0a15 100%); color:#87CEEB; border:3px solid #87CEEB; padding:.75rem 1rem; font-family:'VT323',monospace; font-size:1.2rem; cursor:pointer; border-radius:8px; box-shadow:0 0 10px rgba(135,206,235,.3),inset 0 0 10px rgba(135,206,235,.1); transition:all .3s ease; letter-spacing:1px; }
        .arcade-select:hover:not(:disabled) { border-color:#FFD700; color:#FFD700; transform:translateY(-2px); }
        .arcade-select:disabled { opacity:.4; cursor:not-allowed; }
        .arcade-select option { background:#1a1a2e; color:#87CEEB; }
        .scoreboard-frame { display:inline-block; width:max-content; min-width:100%; box-sizing:border-box; }
        .arcade-table td,.arcade-table th { box-sizing:border-box; }
        .arcade-table thead { background:linear-gradient(180deg,#FFD700 0%,#FF6347 100%); }
        .arcade-table th { padding:.75rem .5rem; font-family:'Press Start 2P',monospace; font-size:.6rem; color:#FFF; text-align:center; cursor:pointer; user-select:none; transition:all .3s ease; position:relative; border-right:1px solid rgba(255,255,255,.2); }
        .arcade-table td { padding:.25rem .5rem; text-align:center; font-size:1.2rem; color:#E0E0E0; border-bottom:1px solid rgba(255,140,0,.2); letter-spacing:1px; position:relative; }
        .arcade-table .rank-cell { font-family:'Press Start 2P',monospace; font-size:.9rem; color:#FF8C00; font-weight:bold; text-shadow:0 0 5px #FF8C00; position:relative; z-index:10; white-space:nowrap; }
        .rank-badge { display:inline-block; min-width:34px; text-align:center; background:#111; color:#ffb300; border:1px solid #ffb300; border-radius:6px; padding:.38rem .65rem; font-weight:700; }
        .arcade-table th:last-child { border-right:none; }
        .arcade-table th:hover:not(.rank-column) { background:linear-gradient(180deg,#FF8C00 0%,#FF8C00 100%); transform:translateY(-2px); }
        .arcade-table th.sorted-column { background:linear-gradient(180deg,#FF8C00 0%,#FFA500 100%); }
        .arcade-table th.rank-column { cursor:default; }
        .th-content { display:flex; align-items:center; justify-content:center; gap:.3rem; }
        .sort-indicator { font-size:.5rem; animation:bounce .5s ease; }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        .arcade-table tbody tr { transition:all .2s ease; position:relative; }
        .playoff-team .rank-cell::before { content:''; position:absolute; left:-8px; top:-1px; bottom:-1px; width:4px; background:linear-gradient(180deg,#00FF00 0%,#00CC00 100%); box-shadow:0 0 10px rgba(0,255,0,.6); z-index:100; }
        .tied-pts { position:relative; }
        .tied-pts::after { content:''; position:absolute; top:0; right:0; width:0; height:0; border-style:solid; border-width:0 9px 9px 0; border-color:transparent rgba(255,140,0,0.85) transparent transparent; filter:drop-shadow(0 0 3px rgba(255,140,0,0.7)); }
        .tied-row { cursor:default; }

        .sos-hoverable { position: relative; }
        .sos-hoverable::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 0;
          height: 0;
          border-style: solid;
          border-width: 0 9px 9px 0;
          border-color: transparent rgba(135,206,235,0.85) transparent transparent;
          filter: drop-shadow(0 0 3px rgba(135,206,235,0.7));
        }
        .sos-cell { cursor: default; min-width: 52px; }
        .sos-cell:hover { background: rgba(135,206,235,.12) !important; box-shadow: inset 0 0 10px rgba(135,206,235,.2) !important; }

        .row-banner-overlay { position:relative; -webkit-mask-image:linear-gradient(to right,rgba(0,0,0,.95) 0%,rgba(0,0,0,.9) 25%,rgba(0,0,0,.65) 50%,rgba(0,0,0,.25) 70%,rgba(0,0,0,.05) 85%,rgba(0,0,0,0) 100%); -webkit-mask-repeat:no-repeat; -webkit-mask-size:100% 100%; }
        .arcade-table tbody tr:hover { transform:translateZ(0) scale(1.01); }
        .arcade-table td.sorted-cell { background:rgba(255,140,0,.10)!important; box-shadow:inset 0 0 8px rgba(255,140,0,.25); }
        .banner-image { position:absolute; left:0; top:50%; transform:translateY(-50%); backface-visibility:hidden; will-change:transform; height:150%; width:auto; object-fit:contain; filter:brightness(1.3); }
        .arcade-table tbody tr { position:relative; }
        .arcade-table tbody tr:hover .banner-image { filter:brightness(1.5); transform:translateY(-50%) scale(1.03); }
        .arcade-table tbody tr.even-row { background:rgba(0,30,60,.4); }
        .arcade-table tbody tr.odd-row { background:rgba(0,20,40,.6); }
        .arcade-table tbody tr:hover { background:rgba(255,140,0,.15)!important; transform:scale(1.01); box-shadow:0 0 15px rgba(255,140,0,.4); z-index:2; }
        .playoff-cutoff-row { height:0; background:transparent; }
        .playoff-cutoff-cell { padding:0; height:0; border:none; position:relative; }
        .playoff-cutoff-line { position:relative; height:3px; background:linear-gradient(90deg,transparent 0%,rgba(255,215,0,.3) 10%,rgba(255,215,0,1) 50%,rgba(255,215,0,.3) 90%,transparent 100%); margin:.75rem 0; overflow:visible; }
        .cutoff-glow { position:absolute; top:-8px; left:0; right:0; height:20px; background:radial-gradient(ellipse at center,rgba(255,215,0,.4) 0%,transparent 70%); animation:glow-pulse 2s ease-in-out infinite; }
        @keyframes glow-pulse { 0%,100%{opacity:.6;transform:scaleY(1)} 50%{opacity:1;transform:scaleY(1.3)} }
        .cutoff-content { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); display:flex; align-items:center; gap:1rem; background:linear-gradient(180deg,#0a0a15 0%,#1a1a2e 100%); padding:.5rem 1.5rem; border:2px solid #FFD700; border-radius:4px; box-shadow:0 0 20px rgba(255,215,0,.6),inset 0 0 15px rgba(255,215,0,.2); z-index:10; }
        .cutoff-diamond { width:8px; height:8px; background:linear-gradient(135deg,#FFD700 0%,#FFA500 100%); transform:rotate(45deg); box-shadow:0 0 10px rgba(255,215,0,.8); animation:diamond-spin 4s linear infinite; }
        @keyframes diamond-spin { 0%{transform:rotate(45deg) scale(1)} 50%{transform:rotate(225deg) scale(1.2)} 100%{transform:rotate(405deg) scale(1)} }
        .cutoff-text { font-family:'Press Start 2P',monospace; font-size:.65rem; color:#FFD700; letter-spacing:2px; text-shadow:0 0 5px #FFD700,0 0 10px #FFD700,0 0 20px #FFA500; white-space:nowrap; animation:text-glow 2s ease-in-out infinite; }
        @keyframes text-glow { 0%,100%{text-shadow:0 0 5px #FFD700,0 0 10px #FFD700,0 0 20px #FFA500} 50%{text-shadow:0 0 10px #FFD700,0 0 20px #FFD700,0 0 30px #FFA500} }
        .cutoff-particles { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; overflow:visible; }
        .particle { position:absolute; width:3px; height:3px; background:#FFD700; border-radius:50%; box-shadow:0 0 8px #FFD700; opacity:0; }
        .particle-1{left:10%;animation:particle-float 3s ease-in-out infinite}
        .particle-2{left:30%;animation:particle-float 2.5s ease-in-out infinite .5s}
        .particle-3{left:50%;animation:particle-float 3.5s ease-in-out infinite 1s}
        .particle-4{left:70%;animation:particle-float 2.8s ease-in-out infinite .8s}
        .particle-5{left:90%;animation:particle-float 3.2s ease-in-out infinite .3s}
        @keyframes particle-float { 0%{opacity:0;transform:translateY(0) scale(0)} 20%{opacity:1;transform:translateY(-15px) scale(1)} 80%{opacity:1;transform:translateY(-25px) scale(1.2)} 100%{opacity:0;transform:translateY(-35px) scale(.8)} }
        .team-cell { text-align:center; padding:.25rem; }
        .team-info { display:flex; align-items:center; justify-content:center; }
        .team-code { display:none; }
        .logo-container { position:relative; width:38px; height:38px; flex-shrink:0; background:rgba(0,0,0,.6); border-radius:8px; padding:3px; border:2px solid rgba(135,206,235,.4); box-shadow:0 0 10px rgba(135,206,235,.3); transition:all .3s ease; }
        .arcade-table tbody tr:hover .logo-container { border-color:rgba(255,140,0,.8); box-shadow:0 0 15px rgba(255,140,0,.6); }
        .logo-clinched { border:3px solid #00DD60!important; box-shadow:0 0 10px rgba(0,221,96,.6),0 0 20px rgba(0,221,96,.25)!important; animation:clinch-logo-pulse 2.4s ease-in-out infinite; }
        @keyframes clinch-logo-pulse { 0%,100%{box-shadow:0 0 8px rgba(0,221,96,.5),0 0 16px rgba(0,221,96,.2);border-color:#00DD60} 50%{box-shadow:0 0 14px rgba(0,255,100,.8),0 0 28px rgba(0,255,100,.4);border-color:#00FF70} }
        .logo-elim { border:5px solid #FF0000!important; box-shadow:0 0 10px #FF0000,0 0 20px rgba(255,0,0,.4),inset 0 0 6px rgba(255,0,0,.6); filter:saturate(0.7); }
        .team-logo { width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 0 6px rgba(135,206,235,.4)); transition:all .3s ease; }
        .arcade-table tbody tr:hover .team-logo { filter:drop-shadow(0 0 15px rgba(255,140,0,1)); transform:scale(1.15); }
        .logo-fallback { display:flex; align-items:center; justify-content:center; width:100%; height:100%; background:linear-gradient(135deg,#87CEEB 0%,#4682B4 100%); border:2px solid #87CEEB; border-radius:8px; font-family:'Press Start 2P',monospace; font-size:.5rem; color:#000; font-weight:bold; }
        .coach-cell { color:#FFF; text-align:left; padding-left:1rem; }
        .pts-cell { font-weight:bold; color:#FFD700; }
        .streak-cell { font-family:'VT323',monospace; font-size:1.4rem; letter-spacing:1px; }
        .per-game-cell { font-size:1.05rem; color:#a0d4f5; }
        .arcade-table td.streak-cell.streak-w { color:#00c853; }
        .arcade-table td.streak-cell.streak-l { color:#ff0000; }
        .arcade-table td.streak-cell.streak-t { color:#888; }
        .compact .row-banner-overlay { display:none; }
        .compact .arcade-table td { padding:.1rem .35rem; font-size:.95rem; }
        .compact .arcade-table th { padding:.45rem .35rem; font-size:.48rem; }
        .compact .logo-container { width:26px; height:26px; padding:2px; }
        .compact .rank-badge { min-width:24px; padding:.2rem .4rem; font-size:.65rem; }
        .compact .coach-cell { font-size:.85rem; }
        .compact .pts-cell { font-size:1rem; }
        .compact .streak-cell { font-size:1.1rem; }
        .compact-toggle { background:rgba(135,206,235,.08); border:2px solid rgba(135,206,235,.3); border-radius:8px; color:rgba(135,206,235,.6); font-size:1.2rem; width:38px; height:38px; cursor:pointer; transition:all .2s; display:flex; align-items:center; justify-content:center; }
        .compact-toggle:hover { border-color:#FFD700; color:#FFD700; box-shadow:0 0 10px rgba(255,215,0,.3); }
        .compact-toggle.active { background:rgba(255,140,0,.15); border-color:#FF8C00; color:#FF8C00; box-shadow:0 0 12px rgba(255,140,0,.4); }
        .arcade-table td.positive-gd { color:#00c853; }
        .arcade-table td.negative-gd { color:#ff0000; }
        .sorted-cell { background:rgba(255,215,0,.15)!important; box-shadow:inset 0 0 8px rgba(255,215,0,.3)!important; }
        .arcade-table td:not(.sorted-cell) { background:transparent; }
        .loading-screen { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:400px; gap:2rem; }
        .loading-spinner { width:60px; height:60px; border:6px solid rgba(255,140,0,.2); border-top:6px solid #FFD700; border-radius:50%; animation:spin 1s linear infinite; }
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        .loading-text { font-family:'Press Start 2P',monospace; font-size:1rem; color:#87CEEB; letter-spacing:2px; animation:pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        .no-data { display:flex; justify-content:center; align-items:center; min-height:400px; }
        .no-data-text { font-family:'Press Start 2P',monospace; font-size:1.2rem; color:#FFD700; letter-spacing:3px; }
        .col-short { display:none; }
        @media (max-width:932px) and (orientation:portrait) {
          .row-banner-overlay { display:none; }
          .view-tabs { flex-direction:column; gap:.5rem; padding:.5rem; }
          .tab-button { padding:.6rem 1rem; font-size:.55rem; justify-content:center; }
          .arcade-table { width:max-content; min-width:100%; display:table; }
          .scoreboard-frame { display:inline-block; min-width:100%; }
        }
        @media (max-width:600px) {
          .standings-page { padding:.5rem!important; }
          .scoreboard-header-container { width:100%; padding:0; box-sizing:border-box; overflow:hidden; }
          .scoreboard-header { width:100%; box-sizing:border-box; padding:.5rem!important; border-width:3px!important; overflow:hidden; }
          .led-text { font-size:.7rem!important; letter-spacing:1px!important; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        }
        @media (max-width:932px) and (orientation:landscape) {
          .standings-page { padding:.5rem!important; }
          .col-full { display:none; }
          .col-short { display:inline; }
          .team-code { display:none!important; }
          .arcade-table { width:100%!important; min-width:unset!important; display:table!important; table-layout:auto!important; }
          .scoreboard-frame { width:100%!important; min-width:unset!important; display:block!important; }
          .table-container { overflow-x:auto!important; }
          .arcade-table th { padding:.35rem .1rem!important; font-size:.36rem!important; }
          .arcade-table td { padding:.2rem .1rem!important; font-size:.85rem!important; }
          .per-game-cell { font-size:.8rem!important; }
          .rank-badge { min-width:18px!important; padding:.1rem .2rem!important; font-size:.38rem!important; }
          .logo-container { width:24px!important; height:24px!important; }
        }
      `}</style>
    </div>
  );
}

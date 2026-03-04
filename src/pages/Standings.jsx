import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from '../components/LeagueContext';
import PlayoffBracket from '../components/PlayoffBracket';
import { createPortal } from 'react-dom';

/* ═══════════════════════════════════════════════════════════════
   TIEBREAKER TOOLTIP
   Shows when hovering a team that shares pts with ≥1 other team.
   Tiebreaker order: 1) H2H pts  2) Overall W  3) Goal Diff
═══════════════════════════════════════════════════════════════ */
function computeH2H(teamA, teamB, seasonGames) {
  let ptsA = 0, ptsB = 0;
  (seasonGames || []).forEach(g => {
    const aIsHome = g.home === teamA && g.away === teamB;
    const aIsAway = g.home === teamB && g.away === teamA;
    if (!aIsHome && !aIsAway) return;
    const sA = aIsHome ? g.score_home : g.score_away;
    const sB = aIsHome ? g.score_away : g.score_home;
    if (sA > sB) ptsA += 2;
    else if (sB > sA) ptsB += 2;
    else { ptsA += 1; ptsB += 1; }
    if (g.ot && sB > sA && aIsHome) ptsA += 1;
    if (g.ot && sA > sB && aIsAway) ptsB += 1;
  });
  return { ptsA, ptsB };
}

function TiebreakerTooltip({ hoveredTeam, tiedStandings, seasonGames, anchorRect }) {
  if (!hoveredTeam || !tiedStandings || tiedStandings.length < 2 || !anchorRect) return null;

  const tooltipW = 360;
  const fixedLeft = window.innerWidth - tooltipW - 16;
  const tooltipHeight = 200; // approximate tooltip height
  const fixedTop = Math.min(
        Math.max(16, anchorRect.top + anchorRect.height / 2 - tooltipHeight / 2),
        window.innerHeight - tooltipHeight - 16
      );

  const enriched = tiedStandings.map(s => {
    let h2hPts = 0;
    tiedStandings.forEach(other => {
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

  const baseSeed = Math.min(...tiedStandings.map(s => s.season_rank));
  const maxH2H = Math.max(...ranked.map(r => r.h2hPts), 1);

  const StatBar = ({ value, max, color }) => (
    <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,.08)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.max(0, (value / (max || 1)) * 100)}%`,
        background: color, borderRadius: 2,
        boxShadow: `0 0 6px ${color}`,
        transition: 'width .4s cubic-bezier(.4,0,.2,1)',
      }} />
    </div>
  );

  return (
    <div style={{
      position: 'fixed', top: fixedTop, left: fixedLeft,
     // transform: 'translateY(-50%)',
      zIndex: 9999, width: tooltipW, pointerEvents: 'none',
    }}>
      <div style={{ position: 'absolute', inset: -8, background: 'radial-gradient(ellipse at center, rgba(255,215,0,.12) 0%, transparent 70%)', borderRadius: 16, pointerEvents: 'none' }} />
      <div style={{ background: 'linear-gradient(155deg, rgba(8,6,20,.98) 0%, rgba(18,14,38,.98) 100%)', border: '1px solid rgba(255,215,0,.5)', borderRadius: 12, boxShadow: '0 0 0 1px rgba(255,140,0,.15), 0 8px 32px rgba(0,0,0,.8), 0 0 40px rgba(255,215,0,.1)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid rgba(255,215,0,.15)', background: 'linear-gradient(90deg, rgba(255,140,0,.08) 0%, rgba(255,215,0,.04) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.6rem', color: '#FF8C00', letterSpacing: 2, textShadow: '0 0 8px rgba(255,140,0,.7)' }}>TIEBREAKER</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.5rem', color: 'rgba(255,255,255,.4)', letterSpacing: 1 }}>{ranked.length} TEAMS · {ranked[0].pts} PTS</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 56px 56px 56px', gap: '0 6px', padding: '6px 16px 4px', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.45rem', color: 'rgba(255,255,255,.3)', textAlign: 'center' }}>SEED</div>
          <div />
          {['H2H', 'W', 'GD'].map(lbl => (
            <div key={lbl} style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.65rem', color: 'rgba(135,206,235,.5)', textAlign: 'center', letterSpacing: 1 }}>{lbl}</div>
          ))}
        </div>
        {ranked.map((row, idx) => {
          const seedNum = baseSeed + idx;
          const gdSign = row.gd > 0 ? '+' : '';
          return (
            <div key={row.team} style={{ display: 'grid', gridTemplateColumns: '44px 1fr 56px 56px 56px', gap: '0 6px', padding: '9px 16px', background: idx % 2 === 0 ? 'rgba(255,255,255,.015)' : 'transparent', borderBottom: idx < ranked.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none', alignItems: 'center' }}>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: '1.6rem', color: '#FF8C00', textAlign: 'center', textShadow: '0 0 8px rgba(255,140,0,.6)', lineHeight: 1 }}>{seedNum}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
                <span style={{ fontFamily: "'VT323', monospace", fontSize: '1.5rem', color: '#E0E0E0', letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1 }}>{row.team}</span>
                <StatBar value={row.h2hPts} max={maxH2H} color="#FF8C00" />
              </div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: '1.4rem', color: '#FF8C00', textAlign: 'center', textShadow: '0 0 6px rgba(255,140,0,.5)' }}>{row.h2hPts}</div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: '1.4rem', color: '#87CEEB', textAlign: 'center', textShadow: '0 0 6px rgba(135,206,235,.4)' }}>{row.w}</div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: '1.4rem', color: row.gd > 0 ? '#00FF88' : row.gd < 0 ? '#FF4444' : '#888', textAlign: 'center', textShadow: row.gd > 0 ? '0 0 6px rgba(0,255,136,.5)' : row.gd < 0 ? '0 0 6px rgba(255,68,68,.5)' : 'none' }}>{gdSign}{row.gd}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CLINCH / ELIMINATION MATH
   
   Key variables:
     maxGP   = highest GP seen across all teams = total regular season games
     remaining(t) = maxGP - t.gp
     maxPts(t)    = t.pts + remaining(t) * 2
   
   CLINCHED (team at sorted rank r, r < playoffSpots):
     Count outside teams (rank >= playoffSpots) whose maxPts STRICTLY
     exceeds this team's current pts. If that count < (playoffSpots - r),
     there aren't enough outside teams to displace this team — clinched.
     (Ties assumed to break against = conservative = never premature.)
   
   ELIMINATED (team at sorted rank r, r >= playoffSpots):
     Their maxPts STRICTLY LESS THAN the current pts of the last
     playoff team. Even winning everything they can't reach the bubble.
     (Equal pts = tiebreaker situation = not yet eliminated.)
   
   3-way tie nuance: tiebreakers are for seeding within the group,
   not for clinch/elim math — the conservative pts-only approach
   already handles this correctly since we delay elim until pts gap
   is unresolvable regardless of tiebreakers.
═══════════════════════════════════════════════════════════════ */
function computeClinchElim(sortedStandings, playoffTeams) {
  const clinched   = new Set();
  const eliminated = new Set();

  if (!playoffTeams || playoffTeams <= 0 || sortedStandings.length === 0) {
    return { clinched, eliminated };
  }

  const n = sortedStandings.length;
  // Total season length = max GP seen (teams with fewer GP have games remaining)
  const maxGP = Math.max(...sortedStandings.map(s => s.gp || 0));
  const maxPts = t => (t.pts || 0) + Math.max(0, maxGP - (t.gp || 0)) * 2;

  // Last playoff spot's current pts = the minimum pts needed to "be in" right now
  const bubbleIdx = Math.min(playoffTeams - 1, n - 1);
  const bubblePts = sortedStandings[bubbleIdx]?.pts || 0;

  // ── CLINCHED ────────────────────────────────────────────────
  for (let r = 0; r < Math.min(playoffTeams, n); r++) {
    const myPts = sortedStandings[r].pts || 0;
    // How many outside teams can still reach strictly MORE than my current pts?
    let canSurpass = 0;
    for (let j = playoffTeams; j < n; j++) {
      if (maxPts(sortedStandings[j]) > myPts) canSurpass++;
    }
    // To push me OUT of the playoffs, outside teams would need to grab
    // (playoffTeams - r) spots above/at my rank. If fewer than that
    // many can even surpass me, I'm mathematically safe.
    if (canSurpass < (playoffTeams - r)) {
      clinched.add(sortedStandings[r].team);
    }
  }

  // ── ELIMINATED ──────────────────────────────────────────────
  for (let r = playoffTeams; r < n; r++) {
    // Strictly less than — if equal, tiebreakers could still save them
    if (maxPts(sortedStandings[r]) < bubblePts) {
      eliminated.add(sortedStandings[r].team);
    }
  }

  return { clinched, eliminated };
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function Standings() {
  const { selectedLeague } = useLeague();
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playoffTeams, setPlayoffTeams] = useState(null);
  const [divisionMap, setDivisionMap] = useState([]);
  const [activeView, setActiveView] = useState('overall');
  const [playoffGames, setPlayoffGames] = useState([]);
  const [seasonGames, setSeasonGames] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'pts', direction: 'descending' });
  const reverseSortColumns = ['ga', 'l', 'otl'];
  const [tiebreakerInfo, setTiebreakerInfo] = useState(null);
  const tableContainerRef = useRef(null);

  const handleSort = (key) => {
    if (key === 'season_rank') { setSortConfig({ key: 'pts', direction: 'descending' }); return; }
    let direction = 'ascending';
    if (sortConfig.key === key) {
      direction = sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
    } else {
      direction = reverseSortColumns.includes(key) ? 'ascending' : 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedStandings = useMemo(() => [...standings].map(s => ({
    ...s,
    pts_pct: s.gp > 0 ? s.pts / (s.gp * 2) : 0,
  })).sort((a, b) => {
    const { key, direction } = sortConfig;
    if (a[key] === null) return 1;
    if (b[key] === null) return -1;
    if (typeof a[key] === 'string') {
      return direction === 'ascending' ? a[key].localeCompare(b[key]) : b[key].localeCompare(a[key]);
    }
    return direction === 'ascending' ? a[key] - b[key] : b[key] - a[key];
  }), [standings, sortConfig]);

  // Clinch/elim — recomputed whenever standings or playoffTeams changes.
  // Always evaluated against the pts-sorted view regardless of current sort column.
  const ptsSorted = useMemo(() =>
    [...standings].map(s => ({ ...s, pts_pct: s.gp > 0 ? s.pts / (s.gp * 2) : 0 }))
      .sort((a, b) => b.pts - a.pts || b.w - a.w || b.gd - a.gd),
    [standings]
  );
  const { clinched, eliminated } = useMemo(
    () => computeClinchElim(ptsSorted, playoffTeams),
    [ptsSorted, playoffTeams]
  );

  useEffect(() => {
    if (!selectedLeague) { setSeasons([]); setSelectedSeason(''); return; }
    (async () => {
      const { data, error } = await supabase.from('seasons').select('lg, year, end_date, playoff_teams').order('year', { ascending: false });
      if (error) { console.error('Error fetching seasons:', error); return; }
      const filtered = data.filter(s => s.lg.startsWith(selectedLeague));
      setSeasons(filtered);
      if (filtered.length > 0) setSelectedSeason(filtered[0].lg);
    })();
  }, [selectedLeague]);

  useEffect(() => {
    if (!selectedSeason) { setPlayoffTeams(null); return; }
    const season = seasons.find(s => s.lg === selectedSeason);
    setPlayoffTeams(season?.playoff_teams ?? null);
  }, [selectedSeason, seasons]);

  useEffect(() => {
    if (!selectedLeague || !selectedSeason) { setStandings([]); return; }
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.from('standings').select('*').eq('season', selectedSeason).order('season_rank', { ascending: true });
      if (error) console.error('Error fetching standings:', error);
      else setStandings(data || []);
      setLoading(false);
    })();
  }, [selectedLeague, selectedSeason]);

  useEffect(() => {
    if (!selectedSeason) { setDivisionMap([]); setActiveView('overall'); return; }
    (async () => {
      const { data, error } = await supabase.from('historical_division_map').select('*').eq('season', selectedSeason);
      if (error) { console.error('Error fetching division map:', error); setDivisionMap([]); }
      else setDivisionMap(data || []);
      setActiveView('overall');
    })();
  }, [selectedSeason]);

  useEffect(() => {
    if (!selectedSeason) { setPlayoffGames([]); return; }
    (async () => {
      const { data, error } = await supabase.from('playoff_games')
        .select('lg,round,series_number,game_number,team_code_a,team_code_b,team_a_score,team_b_score,game_date,seed_a,seed_b')
        .eq('lg', selectedSeason).order('game_number', { ascending: true });
      if (error) console.error('Error fetching playoff_games:', error);
      setPlayoffGames(data || []);
    })();
  }, [selectedSeason]);

  useEffect(() => {
    if (!selectedSeason) { setSeasonGames([]); return; }
    (async () => {
      const { data, error } = await supabase.from('games')
        .select('id,home,away,score_home,score_away,ot')
        .eq('lg', selectedSeason).eq('mode', 'Season');
      if (error) console.error('Error fetching season games:', error);
      setSeasonGames(data || []);
    })();
  }, [selectedSeason]);

  const handleRowMouseEnter = useCallback((e, team, pts) => {
    const tiedTeams = sortedStandings.filter(s => Number(s.pts) === Number(pts));
    if (tiedTeams.length < 2) { setTiebreakerInfo(null); return; }
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const top = r.top, right = r.right, left = r.left, height = r.height;
    setTiebreakerInfo({ hoveredTeam: team, tiedStandings: tiedTeams, anchorRect: { top, right, left, height } });
  }, [sortedStandings]);

  const handleRowMouseLeave = useCallback(() => { setTiebreakerInfo(null); }, []);

  const hasConferences = divisionMap.some(d => d.conference != null);
  const hasDivisions   = divisionMap.some(d => d.division   != null);
  const availableViews = {
    overall:    true,
    conference: hasConferences,
    division:   hasDivisions,
    playoffs:   (playoffTeams ?? 0) > 0,
  };

  const getGroupedStandings = () => {
    if (divisionMap.length === 0 || activeView === 'overall') {
      return [{ title: null, subtitle: null, teams: sortedStandings }];
    }
    if (activeView === 'conference' && hasConferences) {
      const conferences = [...new Set(divisionMap.map(d => d.conference).filter(Boolean))];
      return conferences.map(conf => ({
        title: conf, subtitle: null,
        teams: sortedStandings.filter(s => divisionMap.find(d => d.team === s.team)?.conference === conf),
      }));
    }
    if (activeView === 'division' && hasDivisions) {
      if (hasConferences) {
        const result = [];
        const conferences = [...new Set(divisionMap.map(d => d.conference).filter(Boolean))];
        conferences.forEach(conf => {
          const divs = [...new Set(divisionMap.filter(d => d.conference === conf).map(d => d.division).filter(Boolean))];
          divs.forEach(div => {
            result.push({
              title: conf, subtitle: div,
              teams: sortedStandings.filter(s => {
                const ti = divisionMap.find(d => d.team === s.team);
                return ti?.conference === conf && ti?.division === div;
              }),
            });
          });
        });
        return result;
      } else {
        const divisions = [...new Set(divisionMap.map(d => d.division).filter(Boolean))];
        return divisions.map(div => ({
          title: div, subtitle: null,
          teams: sortedStandings.filter(s => divisionMap.find(d => d.team === s.team)?.division === div),
        }));
      }
    }
    return [{ title: null, subtitle: null, teams: sortedStandings }];
  };

  const groupedStandings = getGroupedStandings();

  const tiedPtsSet = useMemo(() => {
    const ptsCounts = {};
    sortedStandings.forEach(s => {
      const p = Number(s.pts);
      ptsCounts[p] = (ptsCounts[p] || 0) + 1;
    });
    return new Set(Object.entries(ptsCounts).filter(([, count]) => count > 1).map(([p]) => Number(p)));
  }, [sortedStandings]);

  const columns = [
    { label: 'Rank',  key: 'season_rank', width: '5px' },
    { label: 'Team',  key: 'team',        width: '5px' },
    { label: 'Coach', key: 'coach',       width: '55px' },
    { label: 'GP',    key: 'gp',          width: '5px' },
    { label: 'W',     key: 'w',           width: '5px' },
    { label: 'L',     key: 'l',           width: '5px' },
    { label: 'T',     key: 't',           width: '5px' },
    { label: 'OTL',   key: 'otl',         width: '5px' },
    { label: 'Pts',   key: 'pts',         width: '5px' },
    { label: 'Pts%',  key: 'pts_pct',     width: '10px' },
    { label: 'GF',    key: 'gf',          width: '10px' },
    { label: 'GA',    key: 'ga',          width: '10px' },
    { label: 'GD',    key: 'gd',          width: '10px' },
    { label: 'OTW',   key: 'otw',         width: '5px' },
    { label: 'SO',    key: 'shutouts',    width: '5px' },
  ];

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
            onChange={e => { setSelectedSeason(e.target.value); setSortConfig({ key: 'pts', direction: 'descending' }); }}
            disabled={!selectedLeague || seasons.length === 0}
          >
            <option value="">SELECT SEASON</option>
            {seasons.map(s => <option key={s.lg} value={s.lg}>{s.lg} ({s.year})</option>)}
          </select>
        </div>
      </div>

      {standings.length > 0 && (
        <div className="view-tabs-container">
          <div className="view-tabs">
            <button className={`tab-button ${activeView === 'overall' ? 'active' : ''}`} onClick={() => setActiveView('overall')}>
              <span className="tab-icon">⚡</span><span className="tab-text">OVERALL</span>
            </button>
            {availableViews.conference && (
              <button className={`tab-button ${activeView === 'conference' ? 'active' : ''}`} onClick={() => setActiveView('conference')}>
                <span className="tab-icon">🏆</span><span className="tab-text">CONFERENCE</span>
              </button>
            )}
            {availableViews.division && (
              <button className={`tab-button ${activeView === 'division' ? 'active' : ''}`} onClick={() => setActiveView('division')}>
                <span className="tab-icon">🎯</span><span className="tab-text">DIVISION</span>
              </button>
            )}
            {availableViews.playoffs && (
              <button className={`tab-button playoffs-tab ${activeView === 'playoffs' ? 'active' : ''}`} onClick={() => setActiveView('playoffs')}>
                <span className="tab-icon">🏅</span><span className="tab-text">PLAYOFFS</span>
              </button>
            )}
          </div>
        </div>
      )}



      {loading ? (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <div className="loading-text">LOADING DATA...</div>
        </div>
      ) : !selectedLeague ? (
        <div className="no-data"><div className="no-data-text">SELECT A LEAGUE FROM THE MENU</div></div>
      ) : standings.length === 0 ? (
        <div className="no-data"><div className="no-data-text">SELECT A SEASON</div></div>
      ) : activeView === 'playoffs' ? (
        playoffGames?.length ? (
          <PlayoffBracket
            playoffGames={playoffGames}
            seasonGames={seasonGames}
            selectedSeason={selectedSeason}
            selectedLeague={selectedLeague}
          />
        ) : (
          <div className="no-data"><div className="no-data-text">NOT ENOUGH TEAMS FOR BRACKET</div></div>
        )
      ) : (
        <>
          {tiebreakerInfo && tiebreakerInfo.anchorRect && createPortal(
            <TiebreakerTooltip
              hoveredTeam={tiebreakerInfo.hoveredTeam}
              tiedStandings={tiebreakerInfo.tiedStandings}
              seasonGames={seasonGames}
              anchorRect={tiebreakerInfo.anchorRect}
            />,
            document.body
          )}

          <div className="table-container" ref={tableContainerRef}>
            {groupedStandings.map((group, groupIdx) => (
              <div key={groupIdx} className="standings-group">
                {group.title && (
                  <div className="group-header">
                    <div className="group-title">
                      {group.title}
                      {group.subtitle && <span className="group-subtitle"> - {group.subtitle}</span>}
                    </div>
                  </div>
                )}
                {!group.title && group.subtitle && (
                  <div className="group-header"><div className="group-title">{group.subtitle}</div></div>
                )}
                <div className="scoreboard-frame">
                  <table className="arcade-table">
                    <thead>
                      <tr>
                        {columns.map(col => (
                          <th
                            key={col.key}
                            onClick={() => handleSort(col.key)}
                            style={{ width: col.width }}
                            className={`${sortConfig.key === col.key ? 'sorted-column' : ''} ${col.key === 'season_rank' ? 'rank-column' : ''}`}
                          >
                            <div className="th-content">
                              <span>{col.label}</span>
                              {sortConfig.key === col.key && (
                                <span className="sort-indicator">{sortConfig.direction === 'ascending' ? '▲' : '▼'}</span>
                              )}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.teams.map((s, idx) => {
                        const isTied      = tiedPtsSet.has(Number(s.pts));
                        const isClinched  = clinched.has(s.team);
                        const isElim      = eliminated.has(s.team);

                        const rowClass = [
                          idx % 2 === 0 ? 'even-row' : 'odd-row',
                          playoffTeams && s.season_rank <= playoffTeams ? 'playoff-team' : 'non-playoff-team',
                          isTied      ? 'tied-row'      : '',
                          isClinched  ? 'clinched-row'  : '',
                          isElim      ? 'eliminated-row': '',
                        ].filter(Boolean).join(' ');

                        return (
                          <React.Fragment key={`${s.team}-${idx}`}>
                            <tr
                              className={rowClass}
                              onMouseEnter={isTied ? (e) => handleRowMouseEnter(e, s.team, Number(s.pts)) : undefined}
                              onMouseLeave={isTied ? handleRowMouseLeave : undefined}
                            >
                              <td className="rank-cell">{idx + 1}</td>

                              <td className="team-cell">
                                <div className="row-banner-overlay">
                                  <img src={`/assets/banners/${s.team}.png`} alt="" className="banner-image" onError={e => { e.target.style.display = 'none'; }} />
                                </div>
                                <div className="team-info">
                                  <div className={`logo-container${isClinched ? ' logo-clinched' : isElim ? ' logo-elim' : ''}`}>
                                    <img src={`/assets/teamLogos/${s.team}.png`} alt={s.team} className="team-logo"
                                      onError={e => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'flex'; }} />
                                    <div className="logo-fallback" style={{ display: 'none' }}>{s.team}</div>
                                  </div>
                                  <span className="team-code">{s.team}</span>
                                </div>
                              </td>
                              <td className="coach-cell">{s.coach}</td>
                              <td className={`stat-cell ${sortConfig.key === 'gp'       ? 'sorted-cell' : ''}`}>{s.gp}</td>
                              <td className={`stat-cell ${sortConfig.key === 'w'        ? 'sorted-cell' : ''}`}>{s.w}</td>
                              <td className={`stat-cell ${sortConfig.key === 'l'        ? 'sorted-cell' : ''}`}>{s.l}</td>
                              <td className={`stat-cell ${sortConfig.key === 't'        ? 'sorted-cell' : ''}`}>{s.t}</td>
                              <td className={`stat-cell ${sortConfig.key === 'otl'      ? 'sorted-cell' : ''}`}>{s.otl}</td>
                              <td className={`stat-cell pts-cell ${sortConfig.key === 'pts' ? 'sorted-cell' : ''} ${isTied ? 'tied-pts' : ''}`}>{s.pts}</td>
                              <td className={`stat-cell pts-pct-cell ${sortConfig.key === 'pts_pct' ? 'sorted-cell' : ''}`}>
                                {s.gp > 0 ? (s.pts / (s.gp * 2)).toFixed(3) : '.000'}
                              </td>
                              <td className={`stat-cell ${sortConfig.key === 'gf'       ? 'sorted-cell' : ''}`}>{s.gf}</td>
                              <td className={`stat-cell ${sortConfig.key === 'ga'       ? 'sorted-cell' : ''}`}>{s.ga}</td>
                              <td className={`stat-cell ${s.gd > 0 ? 'positive-gd' : s.gd < 0 ? 'negative-gd' : ''} ${sortConfig.key === 'gd' ? 'sorted-cell' : ''}`}>
                                {s.gd > 0 ? '+' : ''}{s.gd}
                              </td>
                              <td className={`stat-cell ${sortConfig.key === 'otw'      ? 'sorted-cell' : ''}`}>{s.otw}</td>
                              <td className={`stat-cell ${sortConfig.key === 'shutouts' ? 'sorted-cell' : ''}`}>{s.shutouts}</td>
                            </tr>

                            {playoffTeams && idx === playoffTeams - 1 && (
                              <tr className="playoff-cutoff-row">
                                <td colSpan={columns.length} className="playoff-cutoff-cell">
                                  <div className="playoff-cutoff-line">
                                    <div className="cutoff-glow" />
                                    <div className="cutoff-content">
                                      <div className="cutoff-diamond" />
                                      <span className="cutoff-text">PLAYOFF LINE</span>
                                      <div className="cutoff-diamond" />
                                    </div>
                                    <div className="cutoff-particles">
                                      {[1,2,3,4,5].map(n => <div key={n} className={`particle particle-${n}`} />)}
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
        </>
      )}

      <style>{`
        /* ── ALL ORIGINAL STYLES (preserved exactly) ── */
        .standings-page { padding:1rem 2rem; min-height:100vh; background:radial-gradient(ellipse at top,#0a0a15 0%,#000 100%); }
        .scoreboard-header-container { display:flex; justify-content:center; margin-bottom:1rem; }
        .scoreboard-header { background:#000; border:6px solid #333; border-radius:8px; padding:1rem 2rem; box-shadow:0 0 0 2px #000,inset 0 0 20px rgba(0,0,0,.8),0 8px 16px rgba(0,0,0,.5),0 0 40px rgba(255,215,0,.3); position:relative; overflow:hidden; }
        .scoreboard-header::before { content:''; position:absolute; inset:0; background:repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px),repeating-linear-gradient(90deg,transparent 0px,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px); pointer-events:none; }
        .scoreboard-header::after { content:''; position:absolute; top:-50%; left:-50%; width:200%; height:200%; background:linear-gradient(45deg,transparent 30%,rgba(255,215,0,.1) 50%,transparent 70%); animation:shimmer 3s infinite; }
        @keyframes shimmer { 0%{transform:translateX(-100%) translateY(-100%) rotate(45deg)} 100%{transform:translateX(100%) translateY(100%) rotate(45deg)} }
        .led-text { font-family:'Press Start 2P',monospace; font-size:2rem; color:#FFD700; letter-spacing:6px; text-shadow:0 0 10px #FF8C00,0 0 20px #FF8C00,0 0 30px #FFD700; filter:contrast(1.3) brightness(1.2); position:relative; }
        .control-panel { display:flex; gap:2rem; justify-content:center; margin-bottom:1.5rem; flex-wrap:wrap; }
        .control-group { display:flex; flex-direction:column; gap:.5rem; }
        .control-group label { font-family:'Press Start 2P',monospace; font-size:.7rem; color:#FFD700; letter-spacing:2px; }
        .view-tabs-container { display:flex; justify-content:center; margin-bottom:2rem; margin-top:1rem; }
        .view-tabs { display:inline-flex; gap:1rem; background:linear-gradient(180deg,#0a0a15 0%,#1a1a2e 100%); padding:.75rem; border-radius:12px; border:3px solid #333; box-shadow:0 0 20px rgba(0,0,0,.5),inset 0 0 20px rgba(0,0,0,.3); }
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
        .table-container { overflow-x:auto; border-radius:12px; }
        .scoreboard-frame { background:linear-gradient(180deg,#0a0a15 0%,#1a1a2e 100%); border:4px solid #FF0000; border-radius:12px; box-shadow:0 0 20px rgba(255,0,0,.4),0 0 40px rgba(255,0,0,.2),inset 0 0 20px rgba(255,0,0,.1); }
        .arcade-table { width:100%; border-collapse:separate; border-spacing:0; font-family:'VT323',monospace; }
        .arcade-table td,.arcade-table th { box-sizing:border-box; }
        .arcade-table thead { background:linear-gradient(180deg,#FFD700 0%,#FF6347 100%); }
        .arcade-table th { padding:.75rem .5rem; font-family:'Press Start 2P',monospace; font-size:.6rem; color:#FFF; text-align:center; cursor:pointer; user-select:none; transition:all .3s ease; position:relative; border-right:1px solid rgba(255,255,255,.2); }
        .arcade-table td { padding:.25rem .5rem; text-align:center; font-size:1.2rem; color:#E0E0E0; border-bottom:1px solid rgba(255,140,0,.2); letter-spacing:1px; position:relative; z-index:1; }
        .arcade-table .rank-cell { font-family:'Press Start 2P',monospace; font-size:.9rem; color:#FF8C00; font-weight:bold; text-shadow:0 0 5px #FF8C00; position:relative; z-index:10; white-space:nowrap; }
        .arcade-table th:last-child { border-right:none; }
        .arcade-table th:hover:not(.rank-column) { background:linear-gradient(180deg,#FF8C00 0%,#FF8C00 100%); transform:translateY(-2px); }
        .arcade-table th.sorted-column { background:linear-gradient(180deg,#FF8C00 0%,#FFA500 100%); }
        .arcade-table th.rank-column { cursor:default; }
        .th-content { display:flex; align-items:center; justify-content:center; gap:.3rem; }
        .sort-indicator { font-size:.5rem; animation:bounce .5s ease; }
        @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        .arcade-table tbody tr { transition:all .2s ease; position:relative; }
        .playoff-team .rank-cell::before { content:''; position:absolute; left:-8px; top:-1px; bottom:-1px; width:4px; background:linear-gradient(180deg,#00FF00 0%,#00CC00 100%); box-shadow:0 0 10px rgba(0,255,0,.6); z-index:100; }
        .tied-pts { position:relative; animation:tied-pulse 2s ease-in-out infinite; }
        .tied-pts::after {
          content:'';
          position:absolute;
          top:0; right:0;
          width:0; height:0;
          border-style:solid;
          border-width:0 9px 9px 0;
          border-color:transparent rgba(255,140,0,0.85) transparent transparent;
          filter:drop-shadow(0 0 3px rgba(255,140,0,0.7));
          animation:triangle-pulse 2s ease-in-out infinite;
        }
        @keyframes triangle-pulse { 0%,100%{border-color:transparent rgba(255,140,0,.6) transparent transparent} 50%{border-color:transparent rgba(255,215,0,1) transparent transparent; filter:drop-shadow(0 0 5px rgba(255,215,0,.9))} }
        @keyframes tied-pulse { 0%,100%{text-shadow:0 0 8px rgba(255,140,0,.4)} 50%{text-shadow:0 0 16px rgba(255,140,0,.9),0 0 24px rgba(255,215,0,.4)} }
        .tied-row { cursor:default; }
        .row-banner-overlay { position:absolute; left:0; top:0; bottom:0; width:400px; pointer-events:none; z-index:0; overflow:hidden; opacity:.15; transition:all .3s ease; }
        .arcade-table tbody tr:hover .row-banner-overlay { opacity:.25; width:450px; }
        .banner-image { position:absolute; left:-20px; top:50%; transform:translateY(-50%); height:140%; width:auto; object-fit:contain; filter:blur(1px) brightness(1.2); mask-image:linear-gradient(to right,rgba(0,0,0,.8) 0%,rgba(0,0,0,.7) 20%,rgba(0,0,0,.5) 40%,rgba(0,0,0,.3) 60%,rgba(0,0,0,.15) 75%,rgba(0,0,0,.05) 85%,rgba(0,0,0,0) 100%); -webkit-mask-image:linear-gradient(to right,rgba(0,0,0,.8) 0%,rgba(0,0,0,.7) 20%,rgba(0,0,0,.5) 40%,rgba(0,0,0,.3) 60%,rgba(0,0,0,.15) 75%,rgba(0,0,0,.05) 85%,rgba(0,0,0,0) 100%); }
        .arcade-table tbody tr:hover .banner-image { filter:blur(.5px) brightness(1.4); transform:translateY(-50%) scale(1.05); }
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

        /* Clinched — thick green border + glow on team logo */
        .logo-clinched {
          border:3px solid #00DD60 !important;
          box-shadow:0 0 10px rgba(0,221,96,.6), 0 0 20px rgba(0,221,96,.25) !important;
          animation:clinch-logo-pulse 2.4s ease-in-out infinite;
        }
        @keyframes clinch-logo-pulse {
          0%,100% { box-shadow:0 0 8px rgba(0,221,96,.5), 0 0 16px rgba(0,221,96,.2); border-color:#00DD60; }
          50%      { box-shadow:0 0 14px rgba(0,255,100,.8), 0 0 28px rgba(0,255,100,.4); border-color:#00FF70; }
        }
        /* Keep the glow on hover too */
        .arcade-table tbody tr:hover .logo-clinched {
          border-color:#00FF70 !important;
          box-shadow:0 0 18px rgba(0,255,100,.9), 0 0 32px rgba(0,255,100,.4) !important;
        }

        /* Eliminated — thick red border, slightly desaturated logo */
        .logo-elim {
          border: 5px solid #FF0000 !important; /* brighter, thicker */
          box-shadow:
            0 0 10px #FF0000,         /* strong outer glow */
            0 0 20px rgba(255,0,0,0.4), /* softer outer glow */
            inset 0 0 6px rgba(255,0,0,0.6); /* subtle inner glow */
          filter: saturate(0.7);       /* slightly desaturated but more contrast */
          transition: all 0.3s ease;   /* smooth effect if hover/pulsing added */
        }
        .arcade-table tbody tr:hover .logo-elim {
          border-color:#FF3333 !important;
          box-shadow:0 0 12px rgba(255,50,50,.6), 0 0 22px rgba(255,50,50,.3) !important;
          filter:saturate(0.7);
        }
        .team-logo { width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 0 6px rgba(135,206,235,.4)); transition:all .3s ease; }
        .arcade-table tbody tr:hover .team-logo { filter:drop-shadow(0 0 15px rgba(255,140,0,1)); transform:scale(1.15); }
        .logo-fallback { display:flex; align-items:center; justify-content:center; width:100%; height:100%; background:linear-gradient(135deg,#87CEEB 0%,#4682B4 100%); border:2px solid #87CEEB; border-radius:8px; font-family:'Press Start 2P',monospace; font-size:.5rem; color:#000; font-weight:bold; }
        .coach-cell { color:#FFF; text-align:left; padding-left:1rem; }
        .pts-cell { font-weight:bold; color:#FFD700; }
        .pts-pct-cell { font-size:1.1rem; color:#87CEEB; }
        .positive-gd { color:#00FF00; font-weight:bold; text-shadow:0 0 8px #00FF00; }
        .negative-gd { color:#FF0000; font-weight:bold; text-shadow:0 0 8px #FF0000; }
        .sorted-cell { background:rgba(255,215,0,.15)!important; box-shadow:inset 0 0 8px rgba(255,215,0,.3)!important; }
        .arcade-table td:not(.sorted-cell) { background:transparent; }
        .loading-screen { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:400px; gap:2rem; }
        .loading-spinner { width:60px; height:60px; border:6px solid rgba(255,140,0,.2); border-top:6px solid #FFD700; border-radius:50%; animation:spin 1s linear infinite; }
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        .loading-text { font-family:'Press Start 2P',monospace; font-size:1rem; color:#87CEEB; letter-spacing:2px; animation:pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        .no-data { display:flex; justify-content:center; align-items:center; min-height:400px; }
        .no-data-text { font-family:'Press Start 2P',monospace; font-size:1.2rem; color:#FFD700; letter-spacing:3px; }
        @media(max-width:768px){
          .led-text{font-size:1.2rem;letter-spacing:3px}
          .view-tabs{flex-direction:column;gap:.5rem;padding:.5rem}
          .tab-button{padding:.6rem 1rem;font-size:.55rem;justify-content:center}
          .arcade-table th{font-size:.5rem;padding:.5rem .25rem}
          .arcade-table td{font-size:1rem;padding:.5rem .25rem}
        }

      `}</style>
    </div>
  );
}
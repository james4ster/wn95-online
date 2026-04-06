import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

function sortWithTiebreakers(teams, games) {
  const computeH2H = (teamA, teamB) => {
    let ptsA = 0, ptsB = 0;
    (games || []).forEach(g => {
      const aIsHome = g.home === teamA && g.away === teamB;
      const aIsAway = g.home === teamB && g.away === teamA;
      if (!aIsHome && !aIsAway) return;
      const sA = aIsHome ? g.score_home : g.score_away;
      const sB = aIsHome ? g.score_away : g.score_home;
      if (sA > sB) ptsA += 2;
      else if (sB > sA) ptsB += 2;
      else { ptsA += 1; ptsB += 1; }
    });
    return { ptsA, ptsB };
  };
  const h2hCache = {};
  const getH2H = (a, b) => {
    const key = [a, b].sort().join('::');
    if (!h2hCache[key]) h2hCache[key] = computeH2H(a, b);
    return h2hCache[key];
  };
  const byPts = {};
  teams.forEach(t => {
    if (!byPts[t.pts]) byPts[t.pts] = [];
    byPts[t.pts].push(t);
  });
  const result = [];
  Object.keys(byPts).map(Number).sort((a, b) => b - a).forEach(pts => {
    const tier = byPts[pts];
    if (tier.length === 1) {
      result.push({ ...tier[0], _h2hPts: 0 });
    } else {
      const enriched = tier.map(t => {
        let h2hPts = 0;
        tier.forEach(other => {
          if (other.team === t.team) return;
          const { ptsA } = getH2H(t.team, other.team);
          h2hPts += ptsA;
        });
        return { ...t, _h2hPts: h2hPts };
      });
      enriched.sort((a, b) => {
        if (b._h2hPts !== a._h2hPts) return b._h2hPts - a._h2hPts;
        if (b.w !== a.w) return b.w - a.w;
        return b.gd - a.gd;
      });
      result.push(...enriched);
    }
  });
  return result;
}

export default function FullScreenStandingsModal({
  onClose,
  groupedStandings,
  columns,
  playoffTeams,
  clinched,
  eliminated,
  tiedPtsSet,
  rawGames,
  showPerGame,   
  showCoach,    
  gfPerG,        
  gaPerG,
}) {
  const [sortConfig, setSortConfig] = useState({ key: 'default', direction: 'descending' });
  const reverseSortColumns = ['ga', 'l', 'otl'];
  const activeSortKey = sortConfig.key === 'default' ? 'pts' : sortConfig.key;

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const handleSort = useCallback((key) => {
    if (key === 'season_rank') {
      setSortConfig({ key: 'default', direction: 'descending' });
      return;
    }
    setSortConfig(prev => {
      let direction = 'ascending';
      if (prev.key === key) {
        direction = prev.direction === 'ascending' ? 'descending' : 'ascending';
      } else {
        direction = reverseSortColumns.includes(key) ? 'ascending' : 'descending';
      }
      return { key, direction };
    });
  }, []);

  const sortedGroups = groupedStandings.map(group => {
    let teams;
    if (sortConfig.key === 'default' || sortConfig.key === 'pts' || sortConfig.key === 'season_rank') {
      teams = sortWithTiebreakers(group.teams, rawGames).map((s, i) => ({
        ...s,
        _sortRank: s._sortRank ?? i + 1,
      }));
      if (sortConfig.direction === 'ascending' && sortConfig.key !== 'default') {
        teams = [...teams].reverse();
      }
    } else {
      teams = [...group.teams].sort((a, b) => {
        const { key, direction } = sortConfig;
        if (a[key] == null) return 1;
        if (b[key] == null) return -1;
        if (typeof a[key] === 'string') {
          return direction === 'ascending' ? a[key].localeCompare(b[key]) : b[key].localeCompare(a[key]);
        }
        return direction === 'ascending' ? a[key] - b[key] : b[key] - a[key];
      });
    }
    return { ...group, teams };
  });

  return createPortal(
    <div className="fsm-overlay" onClick={onClose}>
      <div className="fsm-panel" onClick={e => e.stopPropagation()}>

        {/* ── Close bar — minimal ── */}
        <div className="fsm-topbar">
          <span className="fsm-title">⚡ STANDINGS</span>
          <button className="fsm-close-btn" onClick={onClose}>✕ ESC</button>
        </div>

        {/* ── Scrollable body — this is the scroll container so sticky thead works ── */}
        <div className="fsm-body">
          {sortedGroups.map((group, groupIdx) => (
            <div key={groupIdx} className="fsm-group">
              {(group.title || group.subtitle) && (
                <div className="fsm-group-header">
                  {group.title}{group.subtitle ? ` — ${group.subtitle}` : ''}
                </div>
              )}
              <table className="fsm-table">
                <thead>
                  <tr>
                    {columns.map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={[
                          'fsm-th',
                          activeSortKey === col.key ? 'fsm-th-sorted' : '',
                          col.key === 'season_rank' ? 'fsm-th-rank' : '',
                        ].filter(Boolean).join(' ')}
                      >
                        {col.label}
                        {activeSortKey === col.key && (
                          <span className="fsm-arrow">
                            {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.teams.map((s, idx) => {
                    const isClinched = clinched.has(s.team);
                    const isElim = eliminated.has(s.team);
                    const isTied = tiedPtsSet.has(Number(s.pts));
                    const isPlayoff = playoffTeams && s._sortRank <= playoffTeams;

                    return (
                      <React.Fragment key={`${s.team}-${idx}`}>
                        <tr className={[
                          idx % 2 === 0 ? 'fsm-even' : 'fsm-odd',
                          isPlayoff ? 'fsm-playoff' : '',
                          isClinched ? 'fsm-clinched' : '',
                          isElim ? 'fsm-elim' : '',
                        ].filter(Boolean).join(' ')}>

                          {/* Rank */}
                          <td className="fsm-td fsm-td-rank">
                            <span className="fsm-rank-badge">{idx + 1}</span>
                          </td>

                          {/* Team — logo + code */}
                          <td className="fsm-td fsm-td-team">
                            <div className="fsm-team-inner">
                              <div className={`fsm-logo-wrap ${isClinched ? 'fsm-logo-clinched' : isElim ? 'fsm-logo-elim' : ''}`}>
                                <img
                                  src={`/assets/teamLogos/${s.team}.png`}
                                  alt={s.team}
                                  className="fsm-logo"
                                  onError={e => {
                                    e.target.style.display = 'none';
                                    e.target.nextElementSibling.style.display = 'flex';
                                  }}
                                />
                                <div className="fsm-logo-fallback" style={{ display: 'none' }}>{s.team}</div>
                              </div>
                              <span className={`fsm-team-code ${isClinched ? 'fsm-code-clinched' : isElim ? 'fsm-code-elim' : ''}`}>
                                {s.team}
                              </span>
                            </div>
                          </td>

                          {/* Coach — conditional */}
                          {showCoach && <td className="fsm-td fsm-td-coach">{s.coach}</td>}

                          {/* GP */}
                          <td className={`fsm-td fsm-stat ${activeSortKey === 'gp' ? 'fsm-sorted-cell' : ''}`}>{s.gp}</td>
                          {/* W */}
                          <td className={`fsm-td fsm-stat ${activeSortKey === 'w' ? 'fsm-sorted-cell' : ''}`}>{s.w}</td>
                          {/* L */}
                          <td className={`fsm-td fsm-stat ${activeSortKey === 'l' ? 'fsm-sorted-cell' : ''}`}>{s.l}</td>
                          {/* T */}
                          <td className={`fsm-td fsm-stat ${activeSortKey === 't' ? 'fsm-sorted-cell' : ''}`}>{s.t}</td>
                          {/* OTL */}
                          <td className={`fsm-td fsm-stat ${activeSortKey === 'otl' ? 'fsm-sorted-cell' : ''}`}>{s.otl}</td>
                          {/* Pts */}
                          <td className={`fsm-td fsm-stat fsm-pts ${activeSortKey === 'pts' ? 'fsm-sorted-cell' : ''} ${isTied ? 'fsm-tied-pts' : ''}`}>{s.pts}</td>
                          {/* Pts% */}
                          <td className={`fsm-td fsm-stat ${activeSortKey === 'pts_pct' ? 'fsm-sorted-cell' : ''}`}>
                            {s.gp > 0 ? (s.pts / (s.gp * 2)).toFixed(3) : '.000'}
                          </td>
                          {/* GF */}
                          <td className={`fsm-td fsm-stat ${activeSortKey === 'gf' ? 'fsm-sorted-cell' : ''}`}>{s.gf}</td>
                          {/* GF/G */}
                            {showPerGame && (
                              <td className={`fsm-td fsm-stat ${activeSortKey === 'gf_per_g' ? 'fsm-sorted-cell' : ''}`}>
                                {gfPerG(s)}
                              </td>
                            )}
                          {/* GA */}
                          <td className={`fsm-td fsm-stat ${activeSortKey === 'ga' ? 'fsm-sorted-cell' : ''}`}>{s.ga}</td>
                          {/* GA/G */}
                              {showPerGame && (
                                <td className={`fsm-td fsm-stat ${activeSortKey === 'ga_per_g' ? 'fsm-sorted-cell' : ''}`}>
                                  {gaPerG(s)}
                                </td>
                              )}
                          {/* GD */}
                          <td className={`fsm-td fsm-stat ${s.gd > 0 ? 'fsm-pos' : s.gd < 0 ? 'fsm-neg' : ''} ${activeSortKey === 'gd' ? 'fsm-sorted-cell' : ''}`}>
                            {s.gd > 0 ? '+' : ''}{s.gd}
                          </td>
                          {/* OTW */}
                          <td className={`fsm-td fsm-stat ${activeSortKey === 'otw' ? 'fsm-sorted-cell' : ''}`}>{s.otw}</td>
                          {/* SO */}
                          <td className={`fsm-td fsm-stat ${activeSortKey === 'shutouts' ? 'fsm-sorted-cell' : ''}`}>{s.shutouts}</td>
                          {/* STRK */}
                          <td className={`fsm-td fsm-stat fsm-streak ${
                            s.streakType === 'W' || s.streakType === 'OTW' ? 'fsm-streak-w' :
                            s.streakType === 'L' || s.streakType === 'OTL' ? 'fsm-streak-l' : 'fsm-streak-t'
                          } ${activeSortKey === 'streakVal' ? 'fsm-sorted-cell' : ''}`}>
                            {s.streak}
                          </td>
                          {/* GR */}
                          <td className={`fsm-td fsm-stat ${activeSortKey === 'gr' ? 'fsm-sorted-cell' : ''}`}>{s.gr ?? '—'}</td>
                          {/* MAX PTS */}
                          <td className={`fsm-td fsm-stat ${activeSortKey === 'maxPts' ? 'fsm-sorted-cell' : ''}`}>{s.maxPts ?? '—'}</td>
                        </tr>

                        {playoffTeams && idx === playoffTeams - 1 && (
                          <tr className="fsm-cutoff-row">
                            <td colSpan={columns.length} className="fsm-cutoff-cell">
                              <div className="fsm-cutoff-line">
                                <div className="fsm-cutoff-glow" />
                                <div className="fsm-cutoff-content">
                                  <div className="fsm-cutoff-diamond" />
                                  <span className="fsm-cutoff-text">PLAYOFF LINE</span>
                                  <div className="fsm-cutoff-diamond" />
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
          ))}
        </div>
      </div>

      <style>{`
        /* ── Overlay ── */
        .fsm-overlay {
            position: fixed; inset: 0; z-index: 8000;
            background: rgba(0,0,0,.92);
            backdrop-filter: blur(6px);
            display: flex; align-items: flex-start; justify-content: center;
            padding: 0;
          }

        /* ── Panel ── */
        .fsm-panel {
            width: 100%; max-width: 1600px;
            height: 100dvh;
            background: linear-gradient(160deg, #06040f 0%, #0d0b1e 100%);
            border: 2px solid rgba(255,215,0,.35);
            border-radius: 0;
            box-shadow: 0 0 60px rgba(255,140,0,.15), 0 0 0 1px rgba(255,140,0,.08);
            display: flex; flex-direction: column;
            overflow: hidden;
          }

        /* ── Top bar — slim ── */
        .fsm-topbar {
          display: flex; align-items: center; justify-content: space-between;
          padding: .4rem 1rem;
          background: linear-gradient(90deg, rgba(255,140,0,.1) 0%, rgba(255,215,0,.04) 100%);
          border-bottom: 1px solid rgba(255,215,0,.25);
          flex-shrink: 0;
        }
        .fsm-title {
          font-family: 'Press Start 2P', monospace;
          font-size: .65rem; color: #FFD700; letter-spacing: 3px;
          text-shadow: 0 0 8px #FF8C00;
        }
        .fsm-close-btn {
            font-family: 'Press Start 2P', monospace; font-size: .45rem;
            color: #FF4444;
            background: rgba(255,68,68,.08);
            border: 1px solid rgba(255,68,68,.3); border-radius: 5px;
            padding: .35rem .7rem; cursor: pointer; letter-spacing: 2px;
            transition: all .2s;
          }
          .fsm-close-btn:hover {
            color: #FF4444; border-color: rgba(255,68,68,.5);
            box-shadow: 0 0 8px rgba(255,68,68,.2);
          }

        /* ── Body — this is THE scroll container; sticky thead works here ── */
        .fsm-body {
          flex: 1;
          overflow-y: auto;
          overflow-x: auto;
        }
        .fsm-body::-webkit-scrollbar { width: 5px; height: 5px; }
        .fsm-body::-webkit-scrollbar-track { background: rgba(255,255,255,.02); }
        .fsm-body::-webkit-scrollbar-thumb { background: rgba(255,140,0,.35); border-radius: 3px; }

        /* ── Group ── */
        .fsm-group { }
        .fsm-group-header {
          font-family: 'Press Start 2P', monospace; font-size: .6rem;
          color: #FFD700; letter-spacing: 3px;
          text-shadow: 0 0 6px #FFD700;
          padding: .4rem 0 .5rem;
          text-align: center;
        }

        /* ── Table ── */
        .fsm-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        /* ── Sticky header ── */
        .fsm-th {
          position: sticky; top: 0; z-index: 10;
          background: linear-gradient(180deg, #FFD700 0%, #FF6347 100%);
          font-family: 'Press Start 2P', monospace; font-size: .42rem;
          color: #fff; padding: .45rem .3rem;
          text-align: center; cursor: pointer; user-select: none;
          border-right: 1px solid rgba(255,255,255,.15);
          white-space: nowrap;
          transition: background .15s;
        }
        .fsm-th:last-child { border-right: none; }
        .fsm-th:hover:not(.fsm-th-rank) { background: linear-gradient(180deg, #FF8C00 0%, #FF8C00 100%); }
        .fsm-th-sorted { background: linear-gradient(180deg, #FF8C00 0%, #FFA500 100%) !important; }
        .fsm-th-rank { cursor: default; }
        .fsm-arrow { margin-left: 3px; font-size: .35rem; }

        /* ── Row colors ── */
        .fsm-even { background: rgba(0,25,50,.55); }
        .fsm-odd  { background: rgba(0,12,28,.75); }
        .fsm-table tbody tr { transition: background .12s; }
        .fsm-table tbody tr:hover { background: rgba(255,140,0,.1) !important; }

        /* playoff left bar */
        .fsm-playoff { position: relative; }
        .fsm-playoff .fsm-td-rank::before {
          content: '';
          position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
          background: linear-gradient(180deg, #00FF00, #00CC00);
          box-shadow: 0 0 6px rgba(0,255,0,.5);
        }

        /* ── Cells ── */
        .fsm-td {
          padding: .18rem .3rem;
          border-bottom: 1px solid rgba(255,140,0,.09);
          text-align: center;
          overflow: hidden;
        }

        /* Rank */
        .fsm-td-rank { position: relative; white-space: nowrap; width: 48px; }
        .fsm-rank-badge {
          display: inline-block; min-width: 24px;
          font-family: 'Press Start 2P', monospace; font-size: .48rem;
          color: #ffb300; background: #111;
          border: 1px solid #ffb300; border-radius: 4px;
          padding: .18rem .35rem; font-weight: 700;
        }

        /* Team cell */
        .fsm-td-team { width: 80px; padding: .1rem .2rem; }
        .fsm-team-inner {
          display: flex; align-items: center; gap: 5px; justify-content: center;
        }
        .fsm-logo-wrap {
          width: 24px; height: 24px; flex-shrink: 0;
          background: rgba(0,0,0,.5); border-radius: 4px; padding: 2px;
          border: 1px solid rgba(135,206,235,.35);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
        }
        .fsm-logo-clinched {
          border-color: #00DD60 !important;
          box-shadow: 0 0 6px rgba(0,221,96,.5);
        }
        .fsm-logo-elim {
          border-color: #FF0000 !important;
          filter: saturate(.5);
        }
        .fsm-logo {
          width: 100%; height: 100%; object-fit: contain;
        }
        .fsm-logo-fallback {
          display: flex; align-items: center; justify-content: center;
          width: 100%; height: 100%;
          font-family: 'Press Start 2P', monospace; font-size: .3rem;
          background: linear-gradient(135deg, #87CEEB, #4682B4);
          color: #000;
        }
        .fsm-team-code {
          font-family: 'Press Start 2P', monospace; font-size: .42rem;
          color: rgba(255,255,255,.85); letter-spacing: .5px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .fsm-code-clinched { color: #00FF88 !important; }
        .fsm-code-elim { color: #FF4444 !important; opacity: .7; }

        /* Coach */
        .fsm-td-coach {
          font-family: 'VT323', monospace; font-size: 1rem;
          color: #ddd; text-align: left; padding-left: .5rem;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: 120px;
        }

        /* Stat cells — VT323 keeps it readable at small size */
        .fsm-stat {
          font-family: 'VT323', monospace; font-size: 1.1rem;
          color: #E0E0E0; letter-spacing: .5px;
          white-space: nowrap;
        }
        .fsm-pts  { color: #FFD700; font-weight: bold; }
        .fsm-pct  { color: #87CEEB; font-size: 1rem; }
        .fsm-pos  { color: #00c853; }
        .fsm-neg  { color: #ff4444; }
       
        .fsm-streak-w { color: #00c853; }
        .fsm-streak-l { color: #ff4444; }
        .fsm-streak-t { color: #888; }

        .fsm-sorted-cell {
          background: rgba(255,140,0,.09) !important;
          box-shadow: inset 0 0 5px rgba(255,140,0,.18);
        }

        .fsm-tied-pts { position: relative; }
        .fsm-tied-pts::after {
          content: ''; position: absolute; top: 0; right: 0;
          width: 0; height: 0; border-style: solid;
          border-width: 0 6px 6px 0;
          border-color: transparent rgba(255,140,0,.85) transparent transparent;
        }

        /* ── Playoff cutoff ── */
        .fsm-cutoff-row { height: 0; background: transparent; }
        .fsm-cutoff-cell { padding: 0; height: 0; border: none; position: relative; }
        .fsm-cutoff-line {
          position: relative; height: 2px;
          background: linear-gradient(90deg, transparent 0%, rgba(255,215,0,.3) 10%, #FFD700 50%, rgba(255,215,0,.3) 90%, transparent 100%);
          margin: .5rem 0; overflow: visible;
        }
        .fsm-cutoff-glow {
          position: absolute; top: -5px; left: 0; right: 0; height: 12px;
          background: radial-gradient(ellipse at center, rgba(255,215,0,.3) 0%, transparent 70%);
        }
        .fsm-cutoff-content {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
          display: flex; align-items: center; gap: .6rem;
          background: linear-gradient(180deg, #0a0a15 0%, #1a1a2e 100%);
          padding: .25rem 1rem;
          border: 1px solid #FFD700; border-radius: 3px;
          box-shadow: 0 0 12px rgba(255,215,0,.4);
          z-index: 10;
        }
        .fsm-cutoff-diamond {
          width: 5px; height: 5px;
          background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
          transform: rotate(45deg);
          box-shadow: 0 0 6px rgba(255,215,0,.8);
        }
        .fsm-cutoff-text {
          font-family: 'Press Start 2P', monospace; font-size: .42rem;
          color: #FFD700; letter-spacing: 2px;
          text-shadow: 0 0 5px #FFD700;
          white-space: nowrap;
        }

        /* ── Status indicators ── */
        .fsm-clinched .fsm-td-rank::after {
          content: '';
          position: absolute; right: 0; top: 0; bottom: 0; width: 2px;
          background: #00DD60;
          box-shadow: 0 0 4px rgba(0,221,96,.5);
        }
        .fsm-elim { opacity: .6; filter: saturate(.45); }


        @media (max-width: 932px) {
            .fsm-team-code {
              display: none;
            }
          
            .fsm-th:nth-child(3),
            .fsm-td:nth-child(3) {
              display: none;
            }
          }

          @media (max-width: 932px) and (orientation: landscape) {
            /* Only target the TABLE and WRAP — never touch th/td display here */
            .fsm-table {
              width: 100% !important;
              min-width: unset !important;
              table-layout: fixed !important;
            }
            .fsm-table-wrap {
              width: 100% !important;
              overflow-x: hidden !important;
            }
            /* Tighten everything so columns fit */
            .fsm-th { padding: .4rem .2rem !important; font-size: .45rem !important; }
            .fsm-td { padding: .2rem .2rem !important; }
            .fsm-stat { font-size: 1.1rem !important; }
            .fsm-rank-badge { min-width: 18px !important; padding: .1rem .25rem !important; font-size: .45rem !important; }
            .fsm-logo-wrap { width: 24px !important; height: 24px !important; }
            .fsm-modal-inner {
                padding: .25rem !important;
              }
              .fsm-header {
                padding: .4rem .5rem !important;
              }
          }

        
        @media (max-width: 600px) and (orientation: portrait) {
            .fsm-team-code {
                display: none;
              }
              .view-tabs-container-outer {
                flex-direction: column;
                gap: 8px;
                align-items: center;
              }
              .view-tabs-container-outer > div:last-child {
                flex: unset !important;
                width: 100%;
                justify-content: center !important;
              }

            /* Hide columns not in the portrait shortlist */
            .fsm-th:nth-child(3),  /* Coach */
           /* .fsm-th:nth-child(4), */  /* GP */
            .fsm-th:nth-child(10), /* Pts% */
            .fsm-th:nth-child(11), /* GF */
            .fsm-th:nth-child(12), /* GA */
            .fsm-th:nth-child(14), /* OTW */
            .fsm-th:nth-child(15), /* SO */
            .fsm-th:nth-child(16), /* STRK */
            .fsm-th:nth-child(17), /* GR */
            .fsm-th:nth-child(18), /* MAX PTS */
            .fsm-td:nth-child(3),
           /* .fsm-td:nth-child(4), */
            .fsm-td:nth-child(10),
            .fsm-td:nth-child(11),
            .fsm-td:nth-child(12),
            .fsm-td:nth-child(14),
            .fsm-td:nth-child(15),
            .fsm-td:nth-child(16),
            .fsm-td:nth-child(17),
            .fsm-td:nth-child(18) {
              display: none;
            }
          
            /* Fill full width with remaining columns */
            .fsm-table {
              width: 100%;
              table-layout: auto;
            }
          
            /* Rank — fixed narrow */
            .fsm-td-rank, .fsm-th:nth-child(1) {
              width: 36px;
              min-width: 36px;
            }
          
            /* Team/logo — fixed narrow */
            .fsm-td-team, .fsm-th:nth-child(2) {
              width: 44px;
              min-width: 44px;
            }
          
            /* Stat columns — equal share of remaining space */
            .fsm-th:nth-child(4),  /* GP */
            .fsm-th:nth-child(5),  /* W */
            .fsm-th:nth-child(6),  /* L */
            .fsm-th:nth-child(7),  /* T */
            .fsm-th:nth-child(8),  /* OTL */
            .fsm-th:nth-child(9),  /* Pts */
            .fsm-th:nth-child(13), /* GD */
            .fsm-td:nth-child(5),
            .fsm-td:nth-child(6),
            .fsm-td:nth-child(7),
            .fsm-td:nth-child(8),
            .fsm-td:nth-child(9),
            .fsm-td:nth-child(13) {
              width: auto;
            }
          
            /* Bigger text and padding on portrait */
            .fsm-th { font-size: .5rem; padding: .5rem .2rem; }
            .fsm-stat { font-size: 1.5rem; }
            .fsm-td { padding: .25rem .2rem; }
            .fsm-rank-badge { font-size: .5rem; min-width: 20px; padding: .15rem .3rem; }
          
            /* Logo slightly bigger */
            .fsm-logo-wrap { width: 28px; height: 28px; }
          }


      `}</style>
    </div>,
    document.body
  );
}

import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from '../components/LeagueContext';
import PlayoffBracket from '../components/PlayoffBracket';
import { Bracket, Seed, SeedItem } from "react-brackets";


export default function Standings() {
  const { selectedLeague } = useLeague();
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [playoffTeams, setPlayoffTeams] = useState(null);
  const [divisionMap, setDivisionMap] = useState([]);
  const [activeView, setActiveView] = useState('overall'); // 'overall', 'conference', 'division'

  // Sorting state - default to Pts descending
  const [sortConfig, setSortConfig] = useState({
    key: 'pts',
    direction: 'descending',
  });

  // Define which stats are "lower is better"
  const reverseSortColumns = ['ga', 'l', 'otl'];

  const handleSort = (key) => {
    if (key === 'season_rank') {
      setSortConfig({ key: 'pts', direction: 'descending' });
      return;
    }

    let direction = 'ascending';
    if (sortConfig.key === key) {
      direction = sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
    } else {
      direction = reverseSortColumns.includes(key) ? 'ascending' : 'descending';
    }

    setSortConfig({ key, direction });
  };

  // Sorted standings with calculated pts_pct
  const sortedStandings = [...standings].map(s => ({
    ...s,
    pts_pct: s.gp > 0 ? s.pts / (s.gp * 2) : 0
  })).sort((a, b) => {
    const { key, direction } = sortConfig;

    if (a[key] === null) return 1;
    if (b[key] === null) return -1;

    if (typeof a[key] === 'string') {
      return direction === 'ascending'
        ? a[key].localeCompare(b[key])
        : b[key].localeCompare(a[key]);
    } else {
      return direction === 'ascending' ? a[key] - b[key] : b[key] - a[key];
    }
  });

  // Fetch playoff_teams when season is selected
  useEffect(() => {
    if (!selectedSeason) {
      setPlayoffTeams(null);
      return;
    }

    const season = seasons.find(s => s.lg === selectedSeason);
    console.log('Selected season:', selectedSeason);
    console.log('Found season data:', season);
    if (season && season.playoff_teams) {
      console.log('Setting playoff_teams to:', season.playoff_teams);
      setPlayoffTeams(season.playoff_teams);
    } else {
      console.log('No playoff_teams found for this season. Season object:', JSON.stringify(season));
      setPlayoffTeams(null);
    }
  }, [selectedSeason, seasons]);

  // Fetch seasons for selected league
  useEffect(() => {
    if (!selectedLeague) {
      setSeasons([]);
      setSelectedSeason('');
      return;
    }

    const fetchSeasons = async () => {
      const { data, error } = await supabase
        .from('seasons')
        .select('lg, year, end_date, playoff_teams')
        .order('year', { ascending: false });

      if (error) {
        console.error('Error fetching seasons:', error);
        setSeasons([]);
        return;
      }

      const filtered = data.filter((s) => s.lg.startsWith(selectedLeague));
      setSeasons(filtered);
      if (filtered.length > 0) setSelectedSeason(filtered[0].lg);
    };
    fetchSeasons();
  }, [selectedLeague]);

  // Fetch standings
  useEffect(() => {
    if (!selectedLeague || !selectedSeason) {
      setStandings([]);
      return;
    }

    const fetchStandings = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('standings')
        .select('*')
        .eq('season', selectedSeason)
        .order('season_rank', { ascending: true });

      if (error) console.error('Error fetching standings:', error);
      else setStandings(data || []);

      setLoading(false);
    };
    fetchStandings();
  }, [selectedLeague, selectedSeason]);

  // Fetch division map for historical seasons
  useEffect(() => {
    if (!selectedSeason) {
      setDivisionMap([]);
      setActiveView('overall');
      return;
    }

    const fetchDivisionMap = async () => {
      const { data, error } = await supabase
        .from('historical_division_map')
        .select('*')
        .eq('season', selectedSeason);

      if (error) {
        console.error('Error fetching division map:', error);
        setDivisionMap([]);
      } else {
        console.log('Division map data:', data);
        setDivisionMap(data || []);
      }
      
      // Reset to overall view when season changes
      setActiveView('overall');
    };
    fetchDivisionMap();
  }, [selectedSeason]);

  const columns = [
    { label: 'Rank', key: 'season_rank', width: '5px' },
    { label: 'Team', key: 'team', width: '5px' },
    { label: 'Coach', key: 'coach', width: '55px' },
    { label: 'GP', key: 'gp', width: '5px' },
    { label: 'W', key: 'w', width: '5px' },
    { label: 'L', key: 'l', width: '5px' },
    { label: 'T', key: 't', width: '5px' },
    { label: 'OTL', key: 'otl', width: '5px' },
    { label: 'Pts', key: 'pts', width: '5px' },
    { label: 'Pts%', key: 'pts_pct', width: '10px' },
    { label: 'GF', key: 'gf', width: '10px' },
    { label: 'GA', key: 'ga', width: '10px' },
    { label: 'GD', key: 'gd', width: '10px' },
    { label: 'OTW', key: 'otw', width: '5px' },
    { label: 'SO', key: 'shutouts', width: '5px' },
  ];

  // Determine what views are available
  const hasConferences = divisionMap.some(d => d.conference !== null && d.conference !== undefined);
  const hasDivisions = divisionMap.some(d => d.division !== null && d.division !== undefined);
  const availableViews = {
    overall: true,
    conference: hasConferences,
    division: hasDivisions,
    playoffs: playoffTeams > 0,
  };

  // Generate playoff bracket matchups from seeded standings
  const generateBracket = () => {
    if (!playoffTeams || sortedStandings.length < playoffTeams) return null;
    const seeds = sortedStandings
      .slice()
      .sort((a, b) => (a.season_rank || 0) - (b.season_rank || 0))
      .slice(0, playoffTeams);

    const n = playoffTeams; // e.g. 16
    const rounds = Math.log2(n); // e.g. 4 rounds for 16 teams
    const firstRoundMatchups = [];
    for (let i = 0; i < n / 2; i++) {
      firstRoundMatchups.push({
        home: seeds[i],
        away: seeds[n - 1 - i],
        homeLabel: `#${i + 1}`,
        awayLabel: `#${n - i}`,
      });
    }
    return { seeds, firstRoundMatchups, totalRounds: rounds, totalTeams: n };
  };

  const bracket = generateBracket();

  // Get grouped standings based on active view
  const getGroupedStandings = () => {
    if (divisionMap.length === 0 || activeView === 'overall') {
      return [{ title: null, subtitle: null, teams: sortedStandings }];
    }

    if (activeView === 'conference' && hasConferences) {
      // Group ONLY by conference - no division sub-grouping
      const conferences = [...new Set(divisionMap.map(d => d.conference).filter(c => c))];
      return conferences.map(conf => {
        const confTeams = sortedStandings.filter(s => {
          const teamInfo = divisionMap.find(d => d.team === s.team);
          return teamInfo?.conference === conf;
        });
        return { title: conf, subtitle: null, teams: confTeams };
      });
    }

    if (activeView === 'division' && hasDivisions) {
      if (hasConferences) {
        // Has both conferences AND divisions - group by conference header, then division sub-header
        const conferences = [...new Set(divisionMap.map(d => d.conference).filter(c => c))];
        const result = [];
        conferences.forEach(conf => {
          const divisionsInConf = [...new Set(
            divisionMap.filter(d => d.conference === conf).map(d => d.division).filter(d => d)
          )];
          divisionsInConf.forEach(div => {
            const divTeams = sortedStandings.filter(s => {
              const teamInfo = divisionMap.find(d => d.team === s.team);
              return teamInfo?.conference === conf && teamInfo?.division === div;
            });
            result.push({ title: conf, subtitle: div, teams: divTeams });
          });
        });
        return result;
      } else {
        // Divisions only, no conferences
        const divisions = [...new Set(divisionMap.map(d => d.division).filter(d => d))];
        return divisions.map(div => {
          const divTeams = sortedStandings.filter(s => {
            const teamInfo = divisionMap.find(d => d.team === s.team);
            return teamInfo?.division === div;
          });
          return { title: div, subtitle: null, teams: divTeams };
        });
      }
    }

    return [{ title: null, subtitle: null, teams: sortedStandings }];
  };

  const groupedStandings = getGroupedStandings();

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
              setSortConfig({ key: 'pts', direction: 'descending' });
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

      {/* View Tabs */}
      {standings.length > 0 && (
        <div className="view-tabs-container">
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
        </div>
      )}

      {loading ? (
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <div className="loading-text">LOADING DATA...</div>
        </div>
      ) : !selectedLeague ? (
        <div className="no-data">
          <div className="no-data-text">SELECT A LEAGUE FROM THE MENU</div>
        </div>
      ) : standings.length === 0 ? (
        <div className="no-data">
          <div className="no-data-text">SELECT A SEASON</div>
        </div>
      ) : activeView === 'playoffs' && bracket ? (
        <div className="bracket-container">
          <div className="bracket-title-row">
            <div className="bracket-season-label">{selectedSeason} PLAYOFF BRACKET</div>
            <div className="bracket-teams-label">{bracket.totalTeams}-TEAM FIELD</div>
          </div>
          <div className="bracket-wrapper">
            {/* LEFT SIDE: seeds 1-8 */}
            <div className="bracket-side bracket-left">
              {bracket.firstRoundMatchups.slice(0, bracket.totalTeams / 4).map((m, i) => (
                <div key={i} className="bracket-matchup">
                  <div className="bracket-team home-team">
                    <div className="bracket-logo-wrap">
                      <img
                        src={`/assets/teamLogos/${m.home.team}.png`}
                        alt={m.home.team}
                        className="bracket-logo"
                        onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                      />
                      <div className="bracket-logo-fallback" style={{display:'none'}}>{m.home.team}</div>
                    </div>
                    <span className="bracket-seed">{m.homeLabel}</span>
                    <span className="bracket-team-name">{m.home.team}</span>
                    <span className="bracket-pts">{m.home.pts}pts</span>
                  </div>
                  <div className="bracket-vs">VS</div>
                  <div className="bracket-team away-team">
                    <div className="bracket-logo-wrap">
                      <img
                        src={`/assets/teamLogos/${m.away.team}.png`}
                        alt={m.away.team}
                        className="bracket-logo"
                        onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                      />
                      <div className="bracket-logo-fallback" style={{display:'none'}}>{m.away.team}</div>
                    </div>
                    <span className="bracket-seed">{m.awayLabel}</span>
                    <span className="bracket-team-name">{m.away.team}</span>
                    <span className="bracket-pts">{m.away.pts}pts</span>
                  </div>
                </div>
              ))}
            </div>

            {/* CENTER TROPHY */}
            <div className="bracket-center">
              <div className="bracket-trophy">🏆</div>
              <div className="bracket-champion-label">CHAMPION</div>
              <div className="bracket-round-labels">
                {Array.from({ length: bracket.totalRounds }, (_, i) => (
                  <div key={i} className="bracket-round-label">
                    {i === 0 ? 'R1' : i === 1 ? 'QF' : i === 2 ? 'SF' : 'FINAL'}
                  </div>
                ))}
              </div>
            </div>

            {/* RIGHT SIDE: seeds 9-16 */}
            <div className="bracket-side bracket-right">
              {bracket.firstRoundMatchups.slice(bracket.totalTeams / 4).map((m, i) => (
                <div key={i} className="bracket-matchup">
                  <div className="bracket-team home-team">
                    <div className="bracket-logo-wrap">
                      <img
                        src={`/assets/teamLogos/${m.home.team}.png`}
                        alt={m.home.team}
                        className="bracket-logo"
                        onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                      />
                      <div className="bracket-logo-fallback" style={{display:'none'}}>{m.home.team}</div>
                    </div>
                    <span className="bracket-seed">{m.homeLabel}</span>
                    <span className="bracket-team-name">{m.home.team}</span>
                    <span className="bracket-pts">{m.home.pts}pts</span>
                  </div>
                  <div className="bracket-vs">VS</div>
                  <div className="bracket-team away-team">
                    <div className="bracket-logo-wrap">
                      <img
                        src={`/assets/teamLogos/${m.away.team}.png`}
                        alt={m.away.team}
                        className="bracket-logo"
                        onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }}
                      />
                      <div className="bracket-logo-fallback" style={{display:'none'}}>{m.away.team}</div>
                    </div>
                    <span className="bracket-seed">{m.awayLabel}</span>
                    <span className="bracket-team-name">{m.away.team}</span>
                    <span className="bracket-pts">{m.away.pts}pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
      ) : (
        <div className="table-container">
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
                          className={`${sortConfig.key === col.key ? 'sorted-column' : ''} ${col.key === 'season_rank' ? 'rank-column' : ''}`}
                        >
                          <div className="th-content">
                            <span>{col.label}</span>
                            {sortConfig.key === col.key && (
                              <span className="sort-indicator">
                                {sortConfig.direction === 'ascending' ? '▲' : '▼'}
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {group.teams.map((s, idx) => (
                      <React.Fragment key={`${s.team}-${idx}`}>
                        <tr className={`${idx % 2 === 0 ? 'even-row' : 'odd-row'} ${playoffTeams && s.season_rank <= playoffTeams ? 'playoff-team' : 'non-playoff-team'}`}>
                          <td className="rank-cell">
                            {idx + 1}
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
                              <div className="logo-container">
                                <img
                                  src={`/assets/teamLogos/${s.team}.png`}
                                  alt={s.team}
                                  className="team-logo"
                                  onError={(e) => {
                                    console.log(`Failed to load logo for team: ${s.team}`, e.target.src);
                                    e.target.style.display = 'none';
                                    e.target.nextElementSibling.style.display = 'flex';
                                  }}
                                  onLoad={() => {
                                    console.log(`Successfully loaded logo for team: ${s.team}`);
                                  }}
                                />
                                <div className="logo-fallback" style={{ display: 'none' }}>
                                  {s.team}
                                </div>
                              </div>
                              <span className="team-code">{s.team}</span>
                            </div>
                          </td>
                          <td className="coach-cell">{s.coach}</td>
                          <td className={`stat-cell ${sortConfig.key === 'gp' ? 'sorted-cell' : ''}`}>{s.gp}</td>
                          <td className={`stat-cell ${sortConfig.key === 'w' ? 'sorted-cell' : ''}`}>{s.w}</td>
                          <td className={`stat-cell ${sortConfig.key === 'l' ? 'sorted-cell' : ''}`}>{s.l}</td>
                          <td className={`stat-cell ${sortConfig.key === 't' ? 'sorted-cell' : ''}`}>{s.t}</td>
                          <td className={`stat-cell ${sortConfig.key === 'otl' ? 'sorted-cell' : ''}`}>{s.otl}</td>
                          <td className={`stat-cell pts-cell ${sortConfig.key === 'pts' ? 'sorted-cell' : ''}`}>{s.pts}</td>
                          <td className={`stat-cell pts-pct-cell ${sortConfig.key === 'pts_pct' ? 'sorted-cell' : ''}`}>
                            {s.gp > 0 ? (s.pts / (s.gp * 2)).toFixed(3) : '.000'}
                          </td>
                          <td className={`stat-cell ${sortConfig.key === 'gf' ? 'sorted-cell' : ''}`}>{s.gf}</td>
                          <td className={`stat-cell ${sortConfig.key === 'ga' ? 'sorted-cell' : ''}`}>{s.ga}</td>
                          <td className={`stat-cell ${s.gd > 0 ? 'positive-gd' : s.gd < 0 ? 'negative-gd' : ''} ${sortConfig.key === 'gd' ? 'sorted-cell' : ''}`}>
                            {s.gd > 0 ? '+' : ''}{s.gd}
                          </td>
                          <td className={`stat-cell ${sortConfig.key === 'otw' ? 'sorted-cell' : ''}`}>{s.otw}</td>
                          <td className={`stat-cell ${sortConfig.key === 'shutouts' ? 'sorted-cell' : ''}`}>{s.shutouts}</td>
                        </tr>
                        {/* Playoff Cutoff Line */}
                        {playoffTeams && idx === playoffTeams - 1 && (
                          <tr className="playoff-cutoff-row">
                            <td colSpan={columns.length} className="playoff-cutoff-cell">
                              <div className="playoff-cutoff-line">
                                <div className="cutoff-glow"></div>
                                <div className="cutoff-content">
                                  <div className="cutoff-diamond"></div>
                                  <span className="cutoff-text">PLAYOFF LINE</span>
                                  <div className="cutoff-diamond"></div>
                                </div>
                                <div className="cutoff-particles">
                                  <div className="particle particle-1"></div>
                                  <div className="particle particle-2"></div>
                                  <div className="particle particle-3"></div>
                                  <div className="particle particle-4"></div>
                                  <div className="particle particle-5"></div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .standings-page {
          padding: 1rem 2rem;
          min-height: 100vh;
          background: radial-gradient(ellipse at top, #0a0a15 0%, #000000 100%);
        }

        .scoreboard-header-container {
          display: flex;
          justify-content: center;
          margin-bottom: 1rem;
        }

        .scoreboard-header {
          background: #000000;
          border: 6px solid #333;
          border-radius: 8px;
          padding: 1rem 2rem;
          box-shadow: 0 0 0 2px #000, inset 0 0 20px rgba(0, 0, 0, 0.8), 0 8px 16px rgba(0, 0, 0, 0.5), 0 0 40px rgba(255, 215, 0, 0.3);
          position: relative;
          overflow: hidden;
        }

        .scoreboard-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255, 215, 0, 0.03) 2px, rgba(255, 215, 0, 0.03) 4px), repeating-linear-gradient(90deg, transparent 0px, transparent 2px, rgba(255, 215, 0, 0.03) 2px, rgba(255, 215, 0, 0.03) 4px);
          pointer-events: none;
        }

        .scoreboard-header::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, transparent 30%, rgba(255, 215, 0, 0.1) 50%, transparent 70%);
          animation: shimmer 3s infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
          100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }

        .led-text {
          font-family: 'Press Start 2P', monospace;
          font-size: 2rem;
          color: #FFD700;
          letter-spacing: 6px;
          text-shadow: 0 0 10px #FF8C00, 0 0 20px #FF8C00, 0 0 30px #FFD700;
          filter: contrast(1.3) brightness(1.2);
          position: relative;
        }

        .control-panel {
          display: flex;
          gap: 2rem;
          justify-content: center;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .control-group label {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.7rem;
          color: #FF8C00;
          letter-spacing: 2px;
          text-shadow: 0 0 5px #FF8C00;
        }

        /* VIEW TABS - SEXY ARCADE STYLE */
        .view-tabs-container {
          display: flex;
          justify-content: center;
          margin-bottom: 2rem;
          margin-top: 1rem;
        }

        .view-tabs {
          display: inline-flex;
          gap: 1rem;
          background: linear-gradient(180deg, #0a0a15 0%, #1a1a2e 100%);
          padding: 0.75rem;
          border-radius: 12px;
          border: 3px solid #333;
          box-shadow: 0 0 20px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(0, 0, 0, 0.3);
        }

        .tab-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          background: linear-gradient(180deg, #1a1a2e 0%, #0f0f1a 100%);
          border: 2px solid #87CEEB;
          border-radius: 8px;
          color: #87CEEB;
          font-family: 'Press Start 2P', monospace;
          font-size: 0.65rem;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 0 10px rgba(135, 206, 235, 0.3), inset 0 0 10px rgba(135, 206, 235, 0.1);
          letter-spacing: 1px;
          position: relative;
          overflow: hidden;
        }

        .tab-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(135, 206, 235, 0.3), transparent);
          transition: left 0.5s ease;
        }

        .tab-button:hover::before {
          left: 100%;
        }

        .tab-button:hover {
          border-color: #FFD700;
          color: #FFD700;
          transform: translateY(-3px);
          box-shadow: 0 0 20px rgba(255, 215, 0, 0.6), inset 0 0 15px rgba(255, 215, 0, 0.2);
        }

        .tab-button.active {
          background: linear-gradient(180deg, #FF8C00 0%, #FF6347 100%);
          border-color: #FFD700;
          color: #FFF;
          box-shadow: 0 0 25px rgba(255, 140, 0, 0.8), inset 0 0 20px rgba(255, 215, 0, 0.3);
          transform: translateY(-2px);
        }

        .tab-button.active::after {
          content: '';
          position: absolute;
          bottom: -3px;
          left: 50%;
          transform: translateX(-50%);
          width: 60%;
          height: 3px;
          background: linear-gradient(90deg, transparent, #FFD700, transparent);
          box-shadow: 0 0 10px #FFD700;
          animation: tab-pulse 2s ease-in-out infinite;
        }

        @keyframes tab-pulse {
          0%, 100% { opacity: 0.6; width: 60%; }
          50% { opacity: 1; width: 80%; }
        }

        .tab-icon {
          font-size: 1rem;
          filter: drop-shadow(0 0 5px currentColor);
        }

        .tab-text {
          position: relative;
          z-index: 1;
        }

        /* GROUP HEADERS FOR CONFERENCES/DIVISIONS */
        .standings-group {
          margin-bottom: 2.5rem;
        }

        .standings-group:last-child {
          margin-bottom: 0;
        }

        .group-header {
          display: flex;
          justify-content: center;
          margin-bottom: 1rem;
        }

        .group-title {
          font-family: 'Press Start 2P', monospace;
          font-size: 1.3rem;
          color: #FFD700;
          letter-spacing: 4px;
          text-shadow: 
            0 0 10px #FFD700,
            0 0 20px #FFD700,
            0 0 30px #FF8C00,
            0 0 40px #FF8C00;
          padding: 0.75rem 2rem;
          background: linear-gradient(180deg, #0a0a15 0%, #1a1a2e 100%);
          border: 3px solid #FFD700;
          border-radius: 8px;
          box-shadow: 
            0 0 20px rgba(255, 215, 0, 0.5),
            inset 0 0 20px rgba(255, 215, 0, 0.2);
          position: relative;
          overflow: hidden;
        }

        .group-title::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, transparent 30%, rgba(255, 215, 0, 0.1) 50%, transparent 70%);
          animation: shimmer 3s infinite;
        }

        .group-subtitle {
          font-size: 0.9rem;
          color: #87CEEB;
          text-shadow: 
            0 0 8px #87CEEB,
            0 0 15px #87CEEB;
        }

        .arcade-select {
          background: linear-gradient(180deg, #1a1a2e 0%, #0a0a15 100%);
          color: #87CEEB;
          border: 3px solid #87CEEB;
          padding: 0.75rem 1rem;
          font-family: 'VT323', monospace;
          font-size: 1.2rem;
          cursor: pointer;
          border-radius: 8px;
          box-shadow: 0 0 10px rgba(135, 206, 235, 0.3), inset 0 0 10px rgba(135, 206, 235, 0.1);
          transition: all 0.3s ease;
          letter-spacing: 1px;
        }

        .arcade-select:hover:not(:disabled) {
          border-color: #FF8C00;
          color: #FF8C00;
          box-shadow: 0 0 15px rgba(255, 140, 0, 0.5), inset 0 0 15px rgba(255, 140, 0, 0.1);
          transform: translateY(-2px);
        }

        .arcade-select:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .arcade-select option {
          background: #1a1a2e;
          color: #87CEEB;
        }

        .table-container {
          overflow-x: auto;
          border-radius: 12px;
        }

        .scoreboard-frame {
          background: linear-gradient(180deg, #0a0a15 0%, #1a1a2e 100%);
          border: 4px solid #FF0000;
          border-radius: 12px;
          box-shadow: 0 0 20px rgba(255, 0, 0, 0.4), 0 0 40px rgba(255, 0, 0, 0.2), inset 0 0 20px rgba(255, 0, 0, 0.1);
        }

        .arcade-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-family: 'VT323', monospace;
        }

        .arcade-table td, .arcade-table th {
          box-sizing: border-box;
        }

        .arcade-table thead {
          background: linear-gradient(180deg, #FF8C00 0%, #FF6347 100%);
        }

        .arcade-table th {
          padding: 0.75rem 0.5rem;
          font-family: 'Press Start 2P', monospace;
          font-size: 0.6rem;
          color: #FFF;
          text-align: center;
          cursor: pointer;
          user-select: none;
          transition: all 0.3s ease;
          position: relative;
          border-right: 1px solid rgba(255, 255, 255, 0.2);
        }

        .arcade-table td {
          padding: 0.25rem 0.5rem;
          text-align: center;
          font-size: 1.2rem;
          color: #E0E0E0;
          border-bottom: 1px solid rgba(255, 140, 0, 0.2);
          letter-spacing: 1px;
          position: relative;
          z-index: 1;
        }

        .arcade-table .rank-cell {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.9rem;
          color: #FF8C00;
          font-weight: bold;
          text-shadow: 0 0 5px #FF8C00;
          position: relative;
          z-index: 10;
        }

        .arcade-table th:last-child {
          border-right: none;
        }

        .arcade-table th:hover:not(.rank-column) {
          background: linear-gradient(180deg, #FFD700 0%, #FF8C00 100%);
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }

        .arcade-table th.sorted-column {
          background: linear-gradient(180deg, #FFD700 0%, #FFA500 100%);
          box-shadow: inset 0 0 10px rgba(255, 255, 255, 0.3), 0 0 15px rgba(255, 140, 0, 0.6);
        }

        .arcade-table th.rank-column {
          cursor: default;
        }

        .th-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.3rem;
        }

        .sort-indicator {
          font-size: 0.5rem;
          animation: bounce 0.5s ease;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        .arcade-table tbody tr {
          transition: all 0.2s ease;
          position: relative;
        }

        /* Playoff Team Highlighting */
        .playoff-team .rank-cell::before {
          content: '';
          position: absolute;
          left: -8px;
          top: -1px;
          bottom: -1px;
          width: 4px;
          background: linear-gradient(180deg, #00FF00 0%, #00CC00 100%);
          box-shadow: 0 0 10px rgba(0, 255, 0, 0.6), inset 0 0 5px rgba(0, 255, 0, 0.4);
          z-index: 100;
        }

        /* Banner Overlay - Crazy Sleek Transparent Effect */
        .row-banner-overlay {
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 400px;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
          opacity: 0.15;
          transition: all 0.3s ease;
        }

        .arcade-table tbody tr:hover .row-banner-overlay {
          opacity: 0.25;
          width: 450px;
        }

        .banner-image {
          position: absolute;
          left: -20px;
          top: 50%;
          transform: translateY(-50%);
          height: 140%;
          width: auto;
          object-fit: contain;
          filter: blur(1px) brightness(1.2);
          mask-image: linear-gradient(
            to right,
            rgba(0, 0, 0, 0.8) 0%,
            rgba(0, 0, 0, 0.7) 20%,
            rgba(0, 0, 0, 0.5) 40%,
            rgba(0, 0, 0, 0.3) 60%,
            rgba(0, 0, 0, 0.15) 75%,
            rgba(0, 0, 0, 0.05) 85%,
            rgba(0, 0, 0, 0) 100%
          );
          -webkit-mask-image: linear-gradient(
            to right,
            rgba(0, 0, 0, 0.8) 0%,
            rgba(0, 0, 0, 0.7) 20%,
            rgba(0, 0, 0, 0.5) 40%,
            rgba(0, 0, 0, 0.3) 60%,
            rgba(0, 0, 0, 0.15) 75%,
            rgba(0, 0, 0, 0.05) 85%,
            rgba(0, 0, 0, 0) 100%
          );
        }

        .arcade-table tbody tr:hover .banner-image {
          filter: blur(0.5px) brightness(1.4);
          transform: translateY(-50%) scale(1.05);
        }

        .arcade-table tbody tr.even-row {
          background: rgba(0, 30, 60, 0.4);
        }

        .arcade-table tbody tr.odd-row {
          background: rgba(0, 20, 40, 0.6);
        }

        .arcade-table tbody tr:hover {
          background: rgba(255, 140, 0, 0.15) !important;
          transform: scale(1.01);
          box-shadow: 0 0 15px rgba(255, 140, 0, 0.4), inset 0 0 20px rgba(255, 140, 0, 0.1);
          z-index: 2;
        }



        /* PLAYOFF CUTOFF LINE - ABSOLUTELY SEXY */
        .playoff-cutoff-row {
          height: 0;
          background: transparent;
        }

        .playoff-cutoff-cell {
          padding: 0;
          height: 0;
          border: none;
          position: relative;
        }

        .playoff-cutoff-line {
          position: relative;
          height: 3px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 215, 0, 0.3) 10%,
            rgba(255, 215, 0, 1) 50%,
            rgba(255, 215, 0, 0.3) 90%,
            transparent 100%
          );
          margin: 0.75rem 0;
          overflow: visible;
        }

        .cutoff-glow {
          position: absolute;
          top: -8px;
          left: 0;
          right: 0;
          height: 20px;
          background: radial-gradient(ellipse at center, rgba(255, 215, 0, 0.4) 0%, transparent 70%);
          animation: glow-pulse 2s ease-in-out infinite;
        }

        @keyframes glow-pulse {
          0%, 100% {
            opacity: 0.6;
            transform: scaleY(1);
          }
          50% {
            opacity: 1;
            transform: scaleY(1.3);
          }
        }

        .cutoff-content {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          gap: 1rem;
          background: linear-gradient(180deg, #0a0a15 0%, #1a1a2e 100%);
          padding: 0.5rem 1.5rem;
          border: 2px solid #FFD700;
          border-radius: 4px;
          box-shadow: 0 0 20px rgba(255, 215, 0, 0.6), inset 0 0 15px rgba(255, 215, 0, 0.2);
          z-index: 10;
        }

        .cutoff-diamond {
          width: 8px;
          height: 8px;
          background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
          transform: rotate(45deg);
          box-shadow: 0 0 10px rgba(255, 215, 0, 0.8), inset 0 0 5px rgba(255, 255, 255, 0.5);
          animation: diamond-spin 4s linear infinite;
        }

        @keyframes diamond-spin {
          0% { transform: rotate(45deg) scale(1); }
          50% { transform: rotate(225deg) scale(1.2); }
          100% { transform: rotate(405deg) scale(1); }
        }

        .cutoff-text {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.65rem;
          color: #FFD700;
          letter-spacing: 2px;
          text-shadow: 
            0 0 5px #FFD700,
            0 0 10px #FFD700,
            0 0 20px #FFA500,
            0 0 30px #FF8C00;
          white-space: nowrap;
          animation: text-glow 2s ease-in-out infinite;
        }

        @keyframes text-glow {
          0%, 100% {
            text-shadow: 
              0 0 5px #FFD700,
              0 0 10px #FFD700,
              0 0 20px #FFA500;
          }
          50% {
            text-shadow: 
              0 0 10px #FFD700,
              0 0 20px #FFD700,
              0 0 30px #FFA500,
              0 0 40px #FF8C00;
          }
        }

        .cutoff-particles {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          overflow: visible;
        }

        .particle {
          position: absolute;
          width: 3px;
          height: 3px;
          background: #FFD700;
          border-radius: 50%;
          box-shadow: 0 0 8px #FFD700, 0 0 15px #FFA500;
          opacity: 0;
        }

        .particle-1 {
          left: 10%;
          animation: particle-float 3s ease-in-out infinite;
        }

        .particle-2 {
          left: 30%;
          animation: particle-float 2.5s ease-in-out infinite 0.5s;
        }

        .particle-3 {
          left: 50%;
          animation: particle-float 3.5s ease-in-out infinite 1s;
        }

        .particle-4 {
          left: 70%;
          animation: particle-float 2.8s ease-in-out infinite 0.8s;
        }

        .particle-5 {
          left: 90%;
          animation: particle-float 3.2s ease-in-out infinite 0.3s;
        }

        @keyframes particle-float {
          0% {
            opacity: 0;
            transform: translateY(0) scale(0);
          }
          20% {
            opacity: 1;
            transform: translateY(-15px) scale(1);
          }
          80% {
            opacity: 1;
            transform: translateY(-25px) scale(1.2);
          }
          100% {
            opacity: 0;
            transform: translateY(-35px) scale(0.8);
          }
        }



        .team-cell {
          text-align: center;
          padding: 0.25rem;
        }

        .team-info {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .team-code { display: none; }

        .logo-container {
          position: relative;
          width: 38px;
          height: 38px;
          flex-shrink: 0;
          background: rgba(0, 0, 0, 0.6);
          border-radius: 8px;
          padding: 3px;
          border: 2px solid rgba(135, 206, 235, 0.4);
          box-shadow: 0 0 10px rgba(135, 206, 235, 0.3);
          transition: all 0.3s ease;
        }

        .arcade-table tbody tr:hover .logo-container {
          border-color: rgba(255, 140, 0, 0.8);
          box-shadow: 0 0 15px rgba(255, 140, 0, 0.6);
        }

        .team-logo {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 0 6px rgba(135, 206, 235, 0.4));
          transition: all 0.3s ease;
        }

        .arcade-table tbody tr:hover .team-logo {
          filter: drop-shadow(0 0 15px rgba(255, 140, 0, 1)) drop-shadow(0 0 25px rgba(255, 140, 0, 0.6));
          transform: scale(1.15);
        }

        .logo-fallback {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          background: linear-gradient(135deg, #87CEEB 0%, #4682B4 100%);
          border: 2px solid #87CEEB;
          border-radius: 8px;
          font-family: 'Press Start 2P', monospace;
          font-size: 0.5rem;
          color: #000;
          font-weight: bold;
          box-shadow: 0 0 10px rgba(135, 206, 235, 0.5);
        }

        .coach-cell {
          color: #FFFFFF;
          text-align: left;
          padding-left: 1rem;
        }

        .stat-cell {
          transition: all 0.2s ease;
        }

        .pts-cell {
          font-weight: bold;
          color: #FFD700;
        }

        .pts-pct-cell {
          font-size: 1.1rem;
          color: #87CEEB;
        }

        .positive-gd {
          color: #00FF00;
          font-weight: bold;
          text-shadow: 0 0 8px #00FF00;
        }

        .negative-gd {
          color: #FF0000;
          font-weight: bold;
          text-shadow: 0 0 8px #FF0000;
        }

        .sorted-cell {
          background: rgba(255, 215, 0, 0.15) !important;
          box-shadow: inset 0 0 8px rgba(255, 215, 0, 0.3) !important;
        }

        /* Explicitly reset non-sorted cells */
        .arcade-table td:not(.sorted-cell) {
          background: transparent;
        }

        .loading-screen {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          gap: 2rem;
        }

        .loading-spinner {
          width: 60px;
          height: 60px;
          border: 6px solid rgba(255, 140, 0, 0.2);
          border-top: 6px solid #FF8C00;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          box-shadow: 0 0 20px rgba(255, 140, 0, 0.5);
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .loading-text {
          font-family: 'Press Start 2P', monospace;
          font-size: 1rem;
          color: #87CEEB;
          letter-spacing: 2px;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.5; text-shadow: 0 0 5px #87CEEB; }
          50% { opacity: 1; text-shadow: 0 0 20px #FF8C00; }
        }

        .no-data {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
        }

        .no-data-text {
          font-family: 'Press Start 2P', monospace;
          font-size: 1.2rem;
          color: #FF8C00;
          text-shadow: 0 0 10px #FF8C00, 0 0 20px #FF8C00;
          letter-spacing: 3px;
          animation: glow-pulse 2s ease-in-out infinite;
        }

        @media (max-width: 768px) {
          .led-text {
            font-size: 1.2rem;
            letter-spacing: 3px;
          }
          .scoreboard-header {
            padding: 1rem 1.5rem;
          }
          .control-panel {
            flex-direction: column;
            gap: 1rem;
          }
          .view-tabs {
            flex-direction: column;
            gap: 0.5rem;
            padding: 0.5rem;
          }
          .tab-button {
            padding: 0.6rem 1rem;
            font-size: 0.55rem;
            justify-content: center;
          }
          .tab-icon {
            font-size: 0.9rem;
          }
          .group-title {
            font-size: 0.9rem;
            letter-spacing: 2px;
            padding: 0.5rem 1rem;
          }
          .arcade-table th {
            font-size: 0.5rem;
            padding: 0.5rem 0.25rem;
          }
          .arcade-table td {
            font-size: 1rem;
            padding: 0.5rem 0.25rem;
          }
          .logo-container {
            width: 36px;
            height: 36px;
          }
          .team-name {
            font-size: 0.6rem;
          }
          .coach-cell {
            font-size: 0.9rem;
          }
          .rank-badge {
            min-width: 28px;
            height: 28px;
          }
          .rank-number {
            font-size: 0.7rem;
          }
          .cutoff-text {
            font-size: 0.5rem;
            letter-spacing: 1px;
          }
          .cutoff-content {
            padding: 0.4rem 1rem;
            gap: 0.5rem;
          }
        }
        /* ── PLAYOFFS TAB ── */
        .tab-button.playoffs-tab {
          border-color: #FFD700;
          color: #FFD700;
        }
        .tab-button.playoffs-tab.active {
          background: linear-gradient(180deg, #FFD700 0%, #FF8C00 100%);
          color: #000;
        }

        /* ── PLAYOFF BRACKET ── */
        .bracket-container {
          padding: 1.5rem 2rem;
          max-width: 1400px;
          margin: 0 auto;
        }

        .bracket-title-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .bracket-season-label {
          font-family: 'Press Start 2P', monospace;
          font-size: 1rem;
          color: #FFD700;
          text-shadow: 0 0 15px #FFD700, 0 0 30px #FF8C00;
          letter-spacing: 3px;
        }

        .bracket-teams-label {
          font-family: 'VT323', monospace;
          font-size: 1.4rem;
          color: #87CEEB;
          letter-spacing: 2px;
        }

        .bracket-wrapper {
          display: grid;
          grid-template-columns: 1fr 120px 1fr;
          gap: 1.5rem;
          align-items: center;
        }

        .bracket-side {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .bracket-matchup {
          background: linear-gradient(180deg, rgba(0,20,40,0.8) 0%, rgba(0,10,25,0.9) 100%);
          border: 2px solid rgba(255,140,0,0.4);
          border-radius: 10px;
          padding: 0.6rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          transition: all 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .bracket-matchup::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, #FF8C00, transparent);
          opacity: 0.6;
        }

        .bracket-matchup:hover {
          border-color: #FFD700;
          box-shadow: 0 0 20px rgba(255,215,0,0.3);
          transform: scale(1.02);
        }

        .bracket-team {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 0.5rem;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .home-team {
          background: rgba(0,255,0,0.06);
          border: 1px solid rgba(0,255,0,0.15);
        }

        .away-team {
          background: rgba(255,100,0,0.06);
          border: 1px solid rgba(255,100,0,0.15);
        }

        .bracket-logo-wrap {
          width: 30px;
          height: 30px;
          flex-shrink: 0;
          background: rgba(0,0,0,0.5);
          border-radius: 6px;
          padding: 2px;
          border: 1px solid rgba(135,206,235,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .bracket-logo {
          width: 100%;
          height: 100%;
          object-fit: contain;
        }

        .bracket-logo-fallback {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.35rem;
          color: #87CEEB;
          text-align: center;
        }

        .bracket-seed {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.55rem;
          color: #FF8C00;
          min-width: 28px;
          text-shadow: 0 0 6px #FF8C00;
        }

        .bracket-team-name {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.6rem;
          color: #FFF;
          letter-spacing: 1px;
          flex: 1;
        }

        .bracket-pts {
          font-family: 'VT323', monospace;
          font-size: 1rem;
          color: #FFD700;
          letter-spacing: 1px;
          white-space: nowrap;
        }

        .bracket-vs {
          text-align: center;
          font-family: 'Press Start 2P', monospace;
          font-size: 0.5rem;
          color: rgba(135,206,235,0.5);
          letter-spacing: 2px;
          padding: 0.1rem 0;
        }

        /* CENTER */
        .bracket-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
        }

        .bracket-trophy {
          font-size: 3.5rem;
          filter: drop-shadow(0 0 15px rgba(255,215,0,0.8));
          animation: trophy-pulse 2s ease-in-out infinite;
        }

        @keyframes trophy-pulse {
          0%, 100% { fil// src/components/PlayoffBracket.jsx
          import React from 'react';
          
          export default function PlayoffBracket({ bracket, selectedSeason }) {
            if (!bracket) return null;
          
            return (
              <div className="bracket-preview-container">
                <h2>{selectedSeason} PLAYOFF DETAILS</h2>
                <div className="series-list">
                  {bracket.firstRoundMatchups.map((m, idx) => (
                    <div key={idx} className="series-card">
                      <div className="team-row">
                        <span className="team-seed">{m.homeLabel}</span>
                        <span className="team-name">{m.home.team}</span>
                        <span className="team-pts">{m.home.pts} pts</span>
                        <span className="team-score">Score: {m.home.score || '-'}</span>
                      </div>
                      <div className="vs-row">VS</div>
                      <div className="team-row">
                        <span className="team-seed">{m.awayLabel}</span>
                        <span className="team-name">{m.away.team}</span>
                        <span className="team-pts">{m.away.pts} pts</span>
                        <span className="team-score">Score: {m.away.score || '-'}</span>
                      </div>
                      <div className="series-meta">
                        Series Winner: {m.winner || '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          }
          ter: drop-shadow(0 0 10px rgba(255,215,0,0.6)); transform: scale(1); }
          50%       { filter: drop-shadow(0 0 25px rgba(255,215,0,1)); transform: scale(1.08); }
        }

        .bracket-champion-label {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.55rem;
          color: #FFD700;
          letter-spacing: 2px;
          text-shadow: 0 0 10px #FFD700;
          text-align: center;
        }

        .bracket-round-labels {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          align-items: center;
        }

        .bracket-round-label {
          font-family: 'VT323', monospace;
          font-size: 1rem;
          color: rgba(135,206,235,0.5);
          letter-spacing: 2px;
        }

        @media (max-width: 768px) {
          .bracket-wrapper {
            grid-template-columns: 1fr;
          }
          .bracket-center { display: none; }
          .bracket-season-label { font-size: 0.7rem; }
        }

      `}</style>
    </div>
  );
}
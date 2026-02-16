import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function Standings() {
  const [leagues, setLeagues] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState('');
  const [selectedSeason, setSelectedSeason] = useState('');
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(false);

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

  // Fetch leagues
  useEffect(() => {
    const fetchLeagues = async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select('league_code, league_name')
        .order('league_code');

      if (error) console.error('Error fetching leagues:', error);
      else setLeagues(data || []);
    };
    fetchLeagues();
  }, []);

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
        .select('lg, year, end_date')
        .order('lg', { ascending: true });

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

  const columns = [
    { label: 'Rank', key: 'season_rank', width: '50px' },
    { label: 'Team', key: 'team', width: '85px' },
    { label: 'Coach', key: 'coach', width: '160px' },
    { label: 'GP', key: 'gp', width: '40px' },
    { label: 'W', key: 'w', width: '40px' },
    { label: 'L', key: 'l', width: '40px' },
    { label: 'OTL', key: 'otl', width: '40px' },
    { label: 'Pts', key: 'pts', width: '45px' },
    { label: 'Pts%', key: 'pts_pct', width: '55px' },
    { label: 'GF', key: 'gf', width: '40px' },
    { label: 'GA', key: 'ga', width: '40px' },
    { label: 'GD', key: 'gd', width: '45px' },
    { label: 'OTW', key: 'otw', width: '40px' },
    { label: 'SO', key: 'shutouts', width: '40px' },
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
          <label>LEAGUE</label>
          <select
            className="arcade-select"
            value={selectedLeague}
            onChange={(e) => {
              setSelectedLeague(e.target.value);
              setSelectedSeason('');
              setStandings([]);
              setSortConfig({ key: 'pts', direction: 'descending' });
            }}
          >
            <option value="">SELECT LEAGUE</option>
            {leagues.map((l) => (
              <option key={l.league_code} value={l.league_code}>
                {l.league_code} {l.league_name ? `- ${l.league_name}` : ''}
              </option>
            ))}
          </select>
        </div>

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

      {loading ? (
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <div className="loading-text">LOADING DATA...</div>
        </div>
      ) : standings.length === 0 ? (
        <div className="no-data">
          <div className="no-data-text">SELECT LEAGUE & SEASON</div>
        </div>
      ) : (
        <div className="table-container">
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
                {sortedStandings.map((s, idx) => (
                  <tr key={s.season_rank || idx} className={idx % 2 === 0 ? 'even-row' : 'odd-row'}>
                    <td className="rank-cell">
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
                      {idx + 1}
                    </td>
                    <td className="team-cell">
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
                      </div>
                    </td>
                    <td className="coach-cell">{s.coach}</td>
                    <td className={`stat-cell ${sortConfig.key === 'gp' ? 'sorted-cell' : ''}`}>{s.gp}</td>
                    <td className={`stat-cell ${sortConfig.key === 'w' ? 'sorted-cell' : ''}`}>{s.w}</td>
                    <td className={`stat-cell ${sortConfig.key === 'l' ? 'sorted-cell' : ''}`}>{s.l}</td>
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
                ))}
              </tbody>
            </table>
          </div>
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
          color: #FF8C00;
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

        .rank-cell {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.9rem;
          color: #FF8C00;
          font-weight: bold;
          text-shadow: 0 0 5px #FF8C00;
        }

        .team-cell {
          text-align: center;
          padding-left: 0;
        }

        .team-info {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
        }

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
        }
      `}</style>
    </div>
  );
}
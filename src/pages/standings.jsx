import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function Standings() {
  const [leagues, setLeagues] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState('');
  const [selectedSeason, setSelectedSeason] = useState('');
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(false);

  // Sorting state
  const [sortConfig, setSortConfig] = useState({
    key: 'season_rank',
    direction: 'ascending',
  });

  // Define which stats are "lower is better"
  const reverseSortColumns = ['ga', 'l', 'otl'];

  const handleSort = (key) => {
    if (key === 'season_rank') {
      // Reset to default rank sorting
      setSortConfig({ key: 'season_rank', direction: 'ascending' });
      return;
    }

    let direction = 'ascending';

    // If clicking same column, toggle direction
    if (sortConfig.key === key) {
      direction =
        sortConfig.direction === 'ascending' ? 'descending' : 'ascending';
    } else {
      // New column - set default direction based on stat type
      direction = reverseSortColumns.includes(key) ? 'ascending' : 'descending';
    }

    setSortConfig({ key, direction });
  };

  // Sorted standings
  const sortedStandings = [...standings].sort((a, b) => {
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
    { label: 'Rank', key: 'season_rank', width: '60px' },
    { label: 'Team', key: 'team', width: '140px' },
    { label: 'Coach', key: 'coach', width: '140px' },
    { label: 'GP', key: 'gp', width: '50px' },
    { label: 'W', key: 'w', width: '50px' },
    { label: 'L', key: 'l', width: '50px' },
    { label: 'OTL', key: 'otl', width: '50px' },
    { label: 'Pts', key: 'pts', width: '60px' },
    { label: 'GF', key: 'gf', width: '60px' },
    { label: 'GA', key: 'ga', width: '60px' },
    { label: 'GD', key: 'gd', width: '60px' },
    { label: 'OTW', key: 'otw', width: '50px' },
    { label: 'SO', key: 'shutouts', width: '50px' },
  ];

  return (
    <div className="standings-page">
      {/* Scoreboard Header */}
      <div className="scoreboard-header-container">
        <div className="scoreboard-header">
          <div className="led-text">LEAGUE STANDINGS</div>
        </div>
      </div>

      {/* Control Panel */}
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
              setSortConfig({ key: 'season_rank', direction: 'ascending' });
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
              setSortConfig({ key: 'season_rank', direction: 'ascending' });
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

      {/* Standings Display */}
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
                      className={`
                        ${sortConfig.key === col.key ? 'sorted-column' : ''}
                        ${col.key === 'season_rank' ? 'rank-column' : ''}
                      `}
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
                  <tr
                    key={idx}
                    className={idx % 2 === 0 ? 'even-row' : 'odd-row'}
                  >
                    <td className="rank-cell">
                      <span className="rank-number">{s.season_rank}</span>
                    </td>
                    <td className="team-cell">{s.team}</td>
                    <td className="coach-cell">{s.coach}</td>
                    <td
                      className={sortConfig.key === 'gp' ? 'sorted-cell' : ''}
                    >
                      {s.gp}
                    </td>
                    <td className={sortConfig.key === 'w' ? 'sorted-cell' : ''}>
                      {s.w}
                    </td>
                    <td className={sortConfig.key === 'l' ? 'sorted-cell' : ''}>
                      {s.l}
                    </td>
                    <td
                      className={sortConfig.key === 'otl' ? 'sorted-cell' : ''}
                    >
                      {s.otl}
                    </td>
                    <td
                      className={sortConfig.key === 'pts' ? 'sorted-cell' : ''}
                    >
                      {s.pts}
                    </td>
                    <td
                      className={sortConfig.key === 'gf' ? 'sorted-cell' : ''}
                    >
                      {s.gf}
                    </td>
                    <td
                      className={sortConfig.key === 'ga' ? 'sorted-cell' : ''}
                    >
                      {s.ga}
                    </td>
                    <td
                      className={`
                      ${
                        s.gd > 0 ? 'positive-gd' : s.gd < 0 ? 'negative-gd' : ''
                      }
                      ${sortConfig.key === 'gd' ? 'sorted-cell' : ''}
                    `}
                    >
                      {s.gd > 0 ? '+' : ''}
                      {s.gd}
                    </td>
                    <td
                      className={sortConfig.key === 'otw' ? 'sorted-cell' : ''}
                    >
                      {s.otw}
                    </td>
                    <td
                      className={
                        sortConfig.key === 'shutouts' ? 'sorted-cell' : ''
                      }
                    >
                      {s.shutouts}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .standings-page {
          padding: 2rem;
          min-height: 100vh;
        }

        /* Scoreboard Header - LED Matrix Style */
        .scoreboard-header-container {
          display: flex;
          justify-content: center;
          margin-bottom: 2rem;
        }

        .scoreboard-header {
          background: #000000;
          border: 6px solid #333;
          border-radius: 8px;
          padding: 1.5rem 3rem;
          box-shadow: 
            0 0 0 2px #000,
            inset 0 0 20px rgba(0, 0, 0, 0.8),
            0 8px 16px rgba(0, 0, 0, 0.5);
          position: relative;
        }

        .scoreboard-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: 
            repeating-linear-gradient(
              0deg,
              transparent 0px,
              transparent 2px,
              rgba(255, 215, 0, 0.03) 2px,
              rgba(255, 215, 0, 0.03) 4px
            ),
            repeating-linear-gradient(
              90deg,
              transparent 0px,
              transparent 2px,
              rgba(255, 215, 0, 0.03) 2px,
              rgba(255, 215, 0, 0.03) 4px
            );
          pointer-events: none;
        }

        .led-text {
          font-family: 'Press Start 2P', monospace;
          font-size: 2rem;
          color: #FFD700;
          letter-spacing: 6px;
          
          filter: contrast(1.3) brightness(1.2);
          position: relative;
        }

        /* Control Panel */
        .control-panel {
          display: flex;
          gap: 2rem;
          justify-content: center;
          margin-bottom: 3rem;
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
          color: #00FFFF;
          letter-spacing: 2px;
          text-shadow: 0 0 5px #00FFFF;
        }

        .arcade-select {
          background: linear-gradient(180deg, #1a1a2e 0%, #0a0a15 100%);
          color: #00FFFF;
          border: 3px solid #00FFFF;
          padding: 0.75rem 1rem;
          font-family: 'VT323', monospace;
          font-size: 1.2rem;
          cursor: pointer;
          border-radius: 8px;
          box-shadow: 
            0 0 10px rgba(0, 255, 255, 0.3),
            inset 0 0 10px rgba(0, 255, 255, 0.1);
          transition: all 0.3s ease;
          letter-spacing: 1px;
        }

        .arcade-select:hover:not(:disabled) {
          border-color: #FFD700;
          color: #FFD700;
          box-shadow: 
            0 0 15px rgba(255, 215, 0, 0.5),
            inset 0 0 15px rgba(255, 215, 0, 0.1);
          transform: translateY(-2px);
        }

        .arcade-select:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .arcade-select option {
          background: #1a1a2e;
          color: #00FFFF;
        }

        /* Table Container */
        .table-container {
          overflow-x: auto;
          border-radius: 12px;
        }

        .scoreboard-frame {
          background: linear-gradient(180deg, #0a0a15 0%, #1a1a2e 100%);
          border: 4px solid #FF0000;
          border-radius: 12px;
          box-shadow: 
            0 0 20px rgba(255, 0, 0, 0.4),
            inset 0 0 20px rgba(255, 0, 0, 0.1);
        }

        /* Arcade Table */
        .arcade-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          font-family: 'VT323', monospace;
        }

        /* Table Header */
        .arcade-table thead {
          background: linear-gradient(180deg, #00FFFF 0%, #0080FF 100%);
        }

        .arcade-table th {
          padding: 0.75rem 0.5rem;
          font-family: 'Press Start 2P', monospace;
          font-size: 0.6rem;
          color: #000;
          text-align: center;
          cursor: pointer;
          user-select: none;
          transition: all 0.3s ease;
          position: relative;
          border-right: 1px solid rgba(0, 0, 0, 0.2);
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
          box-shadow: 
            inset 0 0 10px rgba(255, 255, 255, 0.3),
            0 0 15px rgba(255, 215, 0, 0.6);
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

        /* Table Rows */
        .arcade-table tbody tr {
          transition: all 0.2s ease;
        }

        .arcade-table tbody tr.even-row {
          background: rgba(0, 30, 60, 0.4);
        }

        .arcade-table tbody tr.odd-row {
          background: rgba(0, 20, 40, 0.6);
        }

        .arcade-table tbody tr:hover {
          background: rgba(0, 255, 255, 0.15);
          transform: scale(1.01);
          box-shadow: 0 0 15px rgba(0, 255, 255, 0.3);
        }

        /* Table Cells */
        .arcade-table td {
          padding: 0.6rem 0.5rem;
          text-align: center;
          font-size: 1.2rem;
          color: #E0E0E0;
          border-bottom: 1px solid rgba(0, 255, 255, 0.1);
          letter-spacing: 1px;
        }

        /* Rank Cell */
        .rank-cell {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.9rem;
          color: #FFD700;
          font-weight: bold;
        }

        .rank-number {
          text-shadow: 0 0 5px #FFD700;
        }

        /* Team & Coach Cells */
        .team-cell {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.7rem;
          color: #00FFFF;
          text-align: left;
          padding-left: 1rem;
          text-shadow: 0 0 5px #00FFFF;
        }

        .coach-cell {
          color: #FFFFFF;
          text-align: left;
          padding-left: 1rem;
        }

        /* Goal Differential Color Coding */
        .positive-gd {
          color: #00FF00;
          font-weight: bold;
          text-shadow: 0 0 5px #00FF00;
        }

        .negative-gd {
          color: #FF0000;
          font-weight: bold;
          text-shadow: 0 0 5px #FF0000;
        }

        /* Sorted Cell Highlight */
        .sorted-cell {
          background: rgba(255, 215, 0, 0.15);
          box-shadow: inset 0 0 8px rgba(255, 215, 0, 0.3);
        }

        /* Loading Screen */
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
          border: 6px solid rgba(0, 255, 255, 0.2);
          border-top: 6px solid #00FFFF;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .loading-text {
          font-family: 'Press Start 2P', monospace;
          font-size: 1rem;
          color: #00FFFF;
          letter-spacing: 2px;
          animation: pulse 1.5s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        /* No Data Screen */
        .no-data {
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 400px;
        }

        .no-data-text {
          font-family: 'Press Start 2P', monospace;
          font-size: 1.2rem;
          color: #FFD700;
          text-shadow: 0 0 10px #FFD700;
          letter-spacing: 3px;
        }

        /* Responsive */
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

          .team-cell,
          .coach-cell {
            font-size: 0.6rem;
          }
        }
      `}</style>
    </div>
  );
}

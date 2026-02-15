import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);

      const { data, error } = await supabase
        .from('unique_teams_vw')
        .select('team, arena, coach');

      if (error) {
        console.error('Error fetching teams:', error);
      } else {
        // Sort A → Z robustly
        const sorted = data.sort((a, b) =>
          a.team.trim().toLowerCase().localeCompare(b.team.trim().toLowerCase())
        );
        setTeams(sorted);
      }

      setLoading(false);
    };

    fetchTeams();
  }, []);

  if (loading) return <p className="loading">Loading teams...</p>;

  return (
    <div className="teams-page">
      <h1 className="page-title">Teams</h1>

      <div className="teams-grid">
        {teams.map((team, index) => (
          <div key={index} className="team-card">
            {team.logo_url && (
              <img src={team.logo_url} alt={team.team} className="team-logo" />
            )}
            <div className="team-info">
              <h2 className="team-name">{team.team}</h2>
              <p className="team-coach">Coach: {team.coach}</p>
              <p className="team-arena">Arena: {team.arena}</p>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        /* Fonts */
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        @font-face {
          font-family: 'Scoreboard';
          src: url('/fonts/scoreboard.ttf') format('truetype');
          font-weight: normal;
          font-style: normal;
        }

        /* Page */
        .teams-page {
          background: #111;
          padding: 2rem;
          min-height: 100vh;
          font-family: 'Press Start 2P', monospace;
          color: #ffffff;
        }

        /* Header */
        .page-title {
          font-family: 'Scoreboard', sans-serif;
          color: #ffb800;
          text-align: center;
          font-size: 3rem;
          margin-bottom: 2.5rem;
        }

        /* Grid layout */
        .teams-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1rem;
        }

        /* Team cards */
        .team-card {
          background: #1f1f1f;
          border-radius: 12px;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          border: 1px solid #333;
          font-family: 'Press Start 2P', monospace;
        }

        .team-card:hover {
          transform: translateY(-6px);
          box-shadow:
            0 0 10px #ffb800,
            0 0 20px #ffb800,
            0 0 30px #ffaa33,
            0 0 40px #ffaa33 inset;
        }

        /* Logo glow on hover */
        .team-logo {
          width: 80px;
          height: 80px;
          object-fit: contain;
          margin-bottom: 1rem;
          transition: filter 0.3s ease, transform 0.3s ease;
        }

        .team-card:hover .team-logo {
          filter: drop-shadow(0 0 6px #ffb800) drop-shadow(0 0 10px #ffaa33);
          transform: scale(1.1);
        }

        /* Team info */
        .team-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          width: 100%;
        }

        .team-name {
          font-size: 1.2rem;
          font-weight: bold;
          margin-bottom: 0.25rem;
          color: #ffffff;
          transition: color 0.3s ease, text-shadow 0.3s ease;
        }

        .team-card:hover .team-name {
          color: #ffb800;
          text-shadow:
            0 0 2px #ffb800,
            0 0 4px #ffb800,
            0 0 6px #ffaa33;
        }

        .team-coach,
        .team-arena {
          font-size: 0.9rem;
          color: #cccccc;
          margin: 0;
        }

        /* Loading */
        .loading {
          color: #ffffff;
          text-align: center;
          margin-top: 3rem;
          font-size: 1rem;
        }

        /* Responsive */
        @media (max-width: 500px) {
          .page-title {
            font-size: 2rem;
          }
          .team-name {
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
}

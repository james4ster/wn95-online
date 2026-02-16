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
        .select('team, abr, coach');

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

  if (loading) {
    return (
      <div className="teams-page">
        <div className="loading-screen">
          <div className="loading-spinner"></div>
          <div className="loading-text">LOADING TEAMS...</div>
        </div>
        <style>{teamStyles}</style>
      </div>
    );
  }

  return (
    <div className="teams-page">
      {/* Page Header */}
      <div className="scoreboard-header-container">
        <div className="scoreboard-header">
          <div className="led-text">TEAM DIRECTORY</div>
        </div>
      </div>

      {/* Teams Grid */}
      <div className="teams-grid">
        {teams.map((team, index) => (
          <div key={index} className="team-card">
            {/* Banner Background */}
            <div className="card-banner-overlay">
              <img
                src={`/assets/banners/${team.abr}.png`}
                alt=""
                className="card-banner-image"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>

            {/* Team Logo */}
            <div className="logo-showcase">
              <div className="logo-glow-ring"></div>
              <img
                src={`/assets/teamLogos/${team.abr}.png`}
                alt={team.team}
                className="team-logo"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextElementSibling.style.display = 'flex';
                }}
              />
              <div className="logo-fallback" style={{ display: 'none' }}>
                {team.abr}
              </div>
            </div>

            {/* Team Info */}
            <div className="team-info">
              <h2 className="team-name">{team.team}</h2>
              <div className="coach-label">HEAD COACH</div>
              <div className="coach-name">{team.coach}</div>
            </div>

            {/* Hover indicator */}
            <div className="card-click-hint">VIEW DETAILS →</div>
          </div>
        ))}
      </div>

      <style>{teamStyles}</style>
    </div>
  );
}

const teamStyles = `
  .teams-page {
    padding: 1rem 2rem;
    min-height: 100vh;
    background: radial-gradient(ellipse at top, #0a0a15 0%, #000000 100%);
  }

  /* Scoreboard Header - Same as Standings */
  .scoreboard-header-container {
    display: flex;
    justify-content: center;
    margin-bottom: 2rem;
  }

  .scoreboard-header {
    background: #000000;
    border: 6px solid #333;
    border-radius: 8px;
    padding: 1rem 2rem;
    box-shadow: 
      0 0 0 2px #000,
      inset 0 0 20px rgba(0, 0, 0, 0.8),
      0 8px 16px rgba(0, 0, 0, 0.5),
      0 0 40px rgba(255, 140, 0, 0.3);
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
    background: 
      repeating-linear-gradient(
        0deg,
        transparent 0px,
        transparent 2px,
        rgba(255, 140, 0, 0.03) 2px,
        rgba(255, 140, 0, 0.03) 4px
      ),
      repeating-linear-gradient(
        90deg,
        transparent 0px,
        transparent 2px,
        rgba(255, 140, 0, 0.03) 2px,
        rgba(255, 140, 0, 0.03) 4px
      );
    pointer-events: none;
  }

  .scoreboard-header::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: linear-gradient(
      45deg,
      transparent 30%,
      rgba(255, 140, 0, 0.1) 50%,
      transparent 70%
    );
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

  /* Teams Grid - Wider cards for banner showcase */
  .teams-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
    padding: 0.5rem;
    max-width: 1600px;
    margin: 0 auto;
  }

  /* Team Card - SEXY Banner-First Design */
  .team-card {
    background: linear-gradient(180deg, #0a0a15 0%, #1a1a2e 100%);
    border: 3px solid #FF8C00;
    border-radius: 16px;
    padding: 0;
    display: flex;
    flex-direction: column;
    position: relative;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    box-shadow: 
      0 4px 20px rgba(255, 140, 0, 0.3),
      inset 0 0 20px rgba(255, 140, 0, 0.05);
    height: 280px;
  }

  .team-card:hover {
    transform: translateY(-12px) scale(1.03);
    border-color: #FFD700;
    box-shadow: 
      0 8px 35px rgba(255, 140, 0, 0.7),
      0 12px 50px rgba(255, 140, 0, 0.5),
      inset 0 0 30px rgba(255, 140, 0, 0.2);
    z-index: 10;
  }

  /* Banner Background - FULL CARD HEIGHT */
  .card-banner-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 60%;
    opacity: 0.25;
    overflow: hidden;
    z-index: 0;
    transition: all 0.4s ease;
    mask-image: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.9) 0%,
      rgba(0, 0, 0, 0.7) 40%,
      rgba(0, 0, 0, 0.3) 70%,
      rgba(0, 0, 0, 0) 100%
    );
    -webkit-mask-image: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.9) 0%,
      rgba(0, 0, 0, 0.7) 40%,
      rgba(0, 0, 0, 0.3) 70%,
      rgba(0, 0, 0, 0) 100%
    );
  }

  .team-card:hover .card-banner-overlay {
    opacity: 0.4;
    height: 65%;
  }

  .card-banner-image {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    height: auto;
    object-fit: cover;
    filter: blur(0px) brightness(1.3);
    transition: all 0.4s ease;
  }

  .team-card:hover .card-banner-image {
    filter: blur(0px) brightness(1.6);
    transform: translate(-50%, -50%) scale(1.08);
  }

  /* Logo Showcase - Overlapping Banner */
  .logo-showcase {
    position: absolute;
    top: 35%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 120px;
    height: 120px;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .logo-glow-ring {
    position: absolute;
    width: 130px;
    height: 130px;
    border: 4px solid #87CEEB;
    border-radius: 50%;
    box-shadow: 
      0 0 20px rgba(135, 206, 235, 0.6),
      0 0 40px rgba(135, 206, 235, 0.3),
      inset 0 0 20px rgba(135, 206, 235, 0.3);
    transition: all 0.4s ease;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(5px);
  }

  .team-card:hover .logo-glow-ring {
    border-color: #FF8C00;
    box-shadow: 
      0 0 30px rgba(255, 140, 0, 1),
      0 0 60px rgba(255, 140, 0, 0.6),
      inset 0 0 30px rgba(255, 140, 0, 0.4);
    transform: scale(1.15) rotate(180deg);
    border-width: 5px;
  }

  .team-logo {
    width: 100px;
    height: 100px;
    object-fit: contain;
    filter: drop-shadow(0 0 10px rgba(135, 206, 235, 0.7));
    transition: all 0.4s ease;
    z-index: 1;
  }

  .team-card:hover .team-logo {
    filter: drop-shadow(0 0 25px rgba(255, 140, 0, 1)) 
           drop-shadow(0 0 45px rgba(255, 140, 0, 0.8))
           drop-shadow(0 0 60px rgba(255, 215, 0, 0.6));
    transform: scale(1.2) rotate(-5deg);
  }

  .logo-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100px;
    height: 100px;
    background: linear-gradient(135deg, #87CEEB 0%, #4682B4 100%);
    border: 3px solid #87CEEB;
    border-radius: 50%;
    font-family: 'Press Start 2P', monospace;
    font-size: 0.9rem;
    color: #000;
    font-weight: bold;
    box-shadow: 0 0 15px rgba(135, 206, 235, 0.6);
    text-align: center;
    padding: 0.5rem;
    line-height: 1.2;
  }

  /* Team Info - Bottom Section */
  .team-info {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    z-index: 1;
    padding: 1.25rem 1rem 1rem 1rem;
    background: linear-gradient(
      to top,
      rgba(10, 10, 21, 0.95) 0%,
      rgba(10, 10, 21, 0.85) 70%,
      rgba(10, 10, 21, 0) 100%
    );
    backdrop-filter: blur(2px);
  }

  .team-name {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.85rem;
    color: #87CEEB;
    text-shadow: 0 0 10px #87CEEB;
    text-align: center;
    margin: 0;
    transition: all 0.3s ease;
    letter-spacing: 1px;
    line-height: 1.5;
    max-width: 90%;
  }

  .team-card:hover .team-name {
    color: #FFD700;
    text-shadow: 
      0 0 12px #FFD700,
      0 0 24px #FF8C00,
      0 0 36px #FF8C00;
    transform: scale(1.08);
  }

  .coach-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.45rem;
    color: #FF8C00;
    letter-spacing: 2px;
    opacity: 0.8;
    margin-top: 0.25rem;
  }

  .coach-name {
    font-family: 'VT323', monospace;
    font-size: 1.4rem;
    color: #E0E0E0;
    letter-spacing: 1.5px;
    transition: all 0.3s ease;
    font-weight: bold;
  }

  .team-card:hover .coach-name {
    color: #FFD700;
    text-shadow: 0 0 12px #FFD700;
    transform: scale(1.05);
  }

  /* Click Hint */
  .card-click-hint {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.5rem;
    color: #FF8C00;
    letter-spacing: 1px;
    opacity: 0;
    transform: translateY(10px);
    transition: all 0.3s ease;
    z-index: 1;
    margin-top: 0.5rem;
  }

  .team-card:hover .card-click-hint {
    opacity: 1;
    transform: translateY(0);
  }

  /* Loading Screen */
  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 60vh;
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
    animation: pulse-text 1.5s ease-in-out infinite;
  }

  @keyframes pulse-text {
    0%, 100% { 
      opacity: 0.5; 
      text-shadow: 0 0 5px #87CEEB;
    }
    50% { 
      opacity: 1; 
      text-shadow: 0 0 20px #FF8C00;
    }
  }

  /* Responsive */
  @media (max-width: 1200px) {
    .teams-grid {
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    }
  }

  @media (max-width: 768px) {
    .led-text {
      font-size: 1.2rem;
      letter-spacing: 3px;
    }

    .scoreboard-header {
      padding: 0.75rem 1.5rem;
    }

    .teams-grid {
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 1rem;
    }

    .team-card {
      height: 240px;
    }

    .logo-showcase {
      width: 100px;
      height: 100px;
      top: 32%;
    }

    .logo-glow-ring {
      width: 110px;
      height: 110px;
    }

    .team-logo {
      width: 85px;
      height: 85px;
    }

    .team-name {
      font-size: 0.7rem;
    }

    .coach-name {
      font-size: 1.2rem;
    }
  }

  @media (max-width: 480px) {
    .teams-grid {
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    }

    .team-card {
      height: 220px;
    }

    .logo-showcase {
      width: 80px;
      height: 80px;
      top: 30%;
    }

    .logo-glow-ring {
      width: 90px;
      height: 90px;
    }

    .team-logo {
      width: 70px;
      height: 70px;
    }

    .led-text {
      font-size: 0.9rem;
      letter-spacing: 2px;
    }

    .team-name {
      font-size: 0.6rem;
    }

    .coach-label {
      font-size: 0.4rem;
    }

    .coach-name {
      font-size: 1rem;
    }
  }
`;
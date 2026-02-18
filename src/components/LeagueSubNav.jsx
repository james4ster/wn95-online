import React from 'react';
import { NavLink } from 'react-router-dom';
import { useLeague } from './LeagueContext';

export default function LeagueSubNav() {
  const { selectedLeague } = useLeague();

  if (!selectedLeague) {
    return null;
  }

  return (
    <div className="league-subnav">
      <div className="subnav-container">
        <NavLink 
          to={`/league/${selectedLeague}/Standings`} 
          className={({ isActive }) => `subnav-link ${isActive ? 'active' : ''}`}
        >
          <span className="subnav-icon">📊</span>
          <span>STANDINGS</span>
        </NavLink>

        <NavLink 
          to={`/league/${selectedLeague}/stats`} 
          className={({ isActive }) => `subnav-link ${isActive ? 'active' : ''}`}
        >
          <span className="subnav-icon">⭐</span>
          <span>PLAYER STATS</span>
        </NavLink>

        <NavLink 
          to={`/league/${selectedLeague}/managers`} 
          className={({ isActive }) => `subnav-link ${isActive ? 'active' : ''}`}
        >
          <span className="subnav-icon">👔</span>
          <span>MANAGERS</span>
        </NavLink>

        <NavLink 
          to={`/league/${selectedLeague}/schedule`} 
          className={({ isActive }) => `subnav-link ${isActive ? 'active' : ''}`}
        >
          <span className="subnav-icon">📅</span>
          <span>SCHEDULE</span>
        </NavLink>

        <NavLink 
          to={`/league/${selectedLeague}/teams`} 
          className={({ isActive }) => `subnav-link ${isActive ? 'active' : ''}`}
        >
          <span className="subnav-icon">🛡️</span>
          <span>TEAMS</span>
        </NavLink>
      </div>

      <style>{`
        .league-subnav {
          background: linear-gradient(180deg, #0f0f1a 0%, #05050a 100%);
          border-bottom: 3px solid #87CEEB;
          box-shadow: 
            0 4px 15px rgba(135, 206, 235, 0.3),
            inset 0 -2px 10px rgba(135, 206, 235, 0.15);
          position: sticky;
          top: 70px;
          z-index: 999;
        }

        .subnav-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          gap: 0.5rem;
          overflow-x: auto;
        }

        .subnav-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 1rem 1.5rem;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          color: #87CEEB;
          font-family: 'VT323', monospace;
          font-size: 1.1rem;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.3s ease;
          letter-spacing: 1px;
          white-space: nowrap;
          position: relative;
        }

        .subnav-link::before {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, transparent, #87CEEB, transparent);
          transform: scaleX(0);
          transition: transform 0.3s ease;
        }

        .subnav-link:hover::before {
          transform: scaleX(1);
        }

        .subnav-link:hover {
          color: #FFD700;
          background: rgba(135, 206, 235, 0.1);
        }

        .subnav-link.active {
          color: #FFD700;
          background: rgba(255, 215, 0, 0.1);
          border-bottom-color: #FFD700;
          box-shadow: 0 -2px 15px rgba(255, 215, 0, 0.4);
        }

        .subnav-link.active::before {
          background: linear-gradient(90deg, transparent, #FFD700, transparent);
          transform: scaleX(1);
        }

        .subnav-icon {
          font-size: 1.2rem;
          filter: drop-shadow(0 0 5px currentColor);
        }

        @media (max-width: 768px) {
          .league-subnav {
            top: 60px;
          }

          .subnav-container {
            padding: 0 1rem;
            gap: 0.25rem;
          }

          .subnav-link {
            padding: 0.75rem 1rem;
            font-size: 0.9rem;
          }

          .subnav-link span:not(.subnav-icon) {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
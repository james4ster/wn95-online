import React from 'react';
import { NavLink } from 'react-router-dom';
import { useLeague } from './LeagueContext';

export default function LeagueSubNav() {
  const { selectedLeague } = useLeague();

  if (!selectedLeague) return null;

  return (
    <div id="league-subnav" className="league-subnav">
      <div className="subnav-inner">
        <NavLink
          to={`/league/${selectedLeague}/standings`}
          className={({ isActive }) => `snl${isActive ? ' snl-on' : ''}`}
        >
          <span className="sni">📈</span>
          <span className="snt">STANDINGS</span>
        </NavLink>

        <NavLink
          to={`/league/${selectedLeague}/scores`}
          className={({ isActive }) => `snl${isActive ? ' snl-on' : ''}`}
        >
          <span className="sni">🚨</span>
          <span className="snt">SCORES</span>
        </NavLink>

        <NavLink
          to={`/league/${selectedLeague}/schedule`}
          className={({ isActive }) => `snl${isActive ? ' snl-on' : ''}`}
        >
          <span className="sni">📅</span>
          <span className="snt">SCHEDULE</span>
        </NavLink>

        <NavLink
          to={`/league/${selectedLeague}/teams`}
          className={({ isActive }) => `snl${isActive ? ' snl-on' : ''}`}
        >
          <span className="sni">🛡️</span>
          <span className="snt">ROSTERS</span>
        </NavLink>

        <NavLink
          to={`/league/${selectedLeague}/stats`}
          className={({ isActive }) => `snl${isActive ? ' snl-on' : ''}`}
        >
          <span className="sni">📊</span>
          <span className="snt">STATS</span>
        </NavLink>

        <NavLink
          to={`/league/${selectedLeague}/transactions`}
          className={({ isActive }) => `snl${isActive ? ' snl-on' : ''}`}
        >
          <span className="sni">🔄</span>
          <span className="snt">TRANSACTIONS</span>
        </NavLink>

        <NavLink
          to={`/league/${selectedLeague}/managers`}
          className={({ isActive }) => `snl${isActive ? ' snl-on' : ''}`}
        >
          <span className="sni">👔</span>
          <span className="snt">MANAGERS</span>
        </NavLink>

        <NavLink
          to="/media"
          className={({ isActive }) => `snl${isActive ? ' snl-on' : ''}`}
        >
          <span className="sni">🎬</span>
          <span className="snt">MEDIA</span>
        </NavLink>
      </div>

      <style>{`
        .league-subnav {
          position: sticky;
          top: 76px;
          z-index: 990;
          width: 100%;
          background: linear-gradient(180deg, #0d0d1f 0%, #040409 100%);
          border-bottom: 3px solid #87CEEB;
          box-shadow:
            0 3px 16px rgba(135, 206, 235, 0.22),
            inset 0 -1px 8px rgba(135, 206, 235, 0.08);
          transform: translateZ(0);
        }

        .subnav-inner {
          display: flex;
          align-items: stretch;
          justify-content: center;
          padding: 0 14px;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .subnav-inner::-webkit-scrollbar { display: none; }

        .snl {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0 1.6rem;
          height: 48px;
          color: rgba(135, 206, 235, 0.65);
          font-family: 'VT323', monospace;
          font-size: 1.15rem;
          letter-spacing: 1.5px;
          text-decoration: none;
          white-space: nowrap;
          flex-shrink: 0;
          position: relative;
          transition: color 0.15s, background 0.15s;
          border-bottom: 3px solid transparent;
          margin-bottom: -3px;
        }

        .snl::after {
          content: '';
          position: absolute;
          bottom: -3px;
          left: 18%; right: 18%;
          height: 3px;
          background: linear-gradient(90deg, transparent, #87CEEB, transparent);
          opacity: 0;
          transition: opacity 0.15s;
        }

        .snl:hover {
          color: #FFD700;
          background: rgba(255, 215, 0, 0.05);
        }
        .snl:hover::after { opacity: 1; }

        .snl-on {
          color: #FFD700;
          background: rgba(255, 215, 0, 0.07);
          border-bottom-color: #FFD700;
        }
        .snl-on::after {
          background: linear-gradient(90deg, transparent, #FFD700, transparent);
          opacity: 1;
        }

        .sni {
          font-size: 1rem;
          line-height: 1;
          flex-shrink: 0;
        }
        .snt {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.6rem;
          letter-spacing: 2px;
        }

        @media (max-width: 768px) {
          .league-subnav { top: 64px; }
          .snl { padding: 0 0.85rem; }
          .snt { display: none; }
        }
        @media (max-width: 480px) {
          .snl { padding: 0 0.6rem; height: 42px; }
        }
      `}</style>
    </div>
  );
}

import React, { useLayoutEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLeague } from './LeagueContext';

const FALLBACK_TOP = 152; // px — used until elements are measured

function useHeaderHeight() {
  const [top, setTop] = useState(FALLBACK_TOP);

  useLayoutEffect(() => {
    function measure() {
      const scores = document.getElementById('scores-bar') 
        || document.querySelector('.scores-bar, [data-scores-bar]');
      const nav    = document.getElementById('main-nav') 
        || document.querySelector('.main-nav, header > nav, [data-main-nav]');

      const sh = scores ? scores.offsetHeight : 80;
      const nh = nav    ? nav.offsetHeight    : 72;

      setTop(sh + nh);
    }

    measure();

    window.addEventListener('resize', measure, { passive: true });

    const mo = new MutationObserver(measure);
    mo.observe(document.body, { childList: true, subtree: true, attributes: false });

    return () => {
      window.removeEventListener('resize', measure);
      mo.disconnect();
    };
  }, []);

  return top;
}

export default function LeagueSubNav() {
  const { selectedLeague } = useLeague();
  const topPx = useHeaderHeight();

  if (!selectedLeague) return null;

  return (
    <div
      id="league-subnav"
      className="league-subnav"
      style={{ top: `${topPx}px` }}
    >
      <div className="subnav-container">
        <NavLink
          to={`/league/${selectedLeague}/standings`}
          className={({ isActive }) => `subnav-link${isActive ? ' active' : ''}`}
        >
          <span className="subnav-icon">📈</span>
          <span className="subnav-txt">STANDINGS</span>
        </NavLink>

        <NavLink
          to={`/league/${selectedLeague}/stats`}
          className={({ isActive }) => `subnav-link${isActive ? ' active' : ''}`}
        >
          <span className="subnav-icon">📊</span>
          <span className="subnav-txt">STATS</span>
        </NavLink>

        <NavLink
          to={`/league/${selectedLeague}/managers`}
          className={({ isActive }) => `subnav-link${isActive ? ' active' : ''}`}
        >
          <span className="subnav-icon">👔</span>
          <span className="subnav-txt">MANAGERS</span>
        </NavLink>

        <NavLink
          to={`/league/${selectedLeague}/schedule`}
          className={({ isActive }) => `subnav-link${isActive ? ' active' : ''}`}
        >
          <span className="subnav-icon">📅</span>
          <span className="subnav-txt">SCHEDULE</span>
        </NavLink>

        <NavLink
          to={`/league/${selectedLeague}/teams`}
          className={({ isActive }) => `subnav-link${isActive ? ' active' : ''}`}
        >
          <span className="subnav-icon">🛡️</span>
          <span className="subnav-txt">TEAMS</span>
        </NavLink>
      </div>

      <style>{`
        .league-subnav {
          position: sticky;
          top: ${topPx}px;
          z-index: 998;
          background: linear-gradient(180deg, #0f0f1a 0%, #05050a 100%);
          border-bottom: 3px solid #87CEEB;
          box-shadow: 0 4px 15px rgba(135, 206, 235, 0.3),
                      inset 0 -2px 10px rgba(135, 206, 235, 0.15);
        }

        .subnav-container {
          display: flex;
          gap: 0.25rem;
          overflow-x: auto;
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
        }
        .subnav-container::-webkit-scrollbar { display: none; }

        .subnav-link {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.85rem 1.3rem;
          background: transparent;
          border: none;
          border-bottom: 3px solid transparent;
          margin-bottom: -3px;
          color: #87CEEB;
          font-family: 'VT323', monospace;
          font-size: 1.1rem;
          text-decoration: none;
          cursor: pointer;
          transition: color 0.2s ease, background 0.2s ease;
          letter-spacing: 1px;
          white-space: nowrap;
          position: relative;
        }

        .subnav-link::after {
          content: '';
          position: absolute;
          bottom: -3px; left: 20%; right: 20%;
          height: 3px;
          background: linear-gradient(90deg, transparent, #87CEEB, transparent);
          transform: scaleX(0);
          transform-origin: center;
          transition: transform 0.2s ease;
        }
        .subnav-link:hover::after { transform: scaleX(1); }

        .subnav-link:hover {
          color: #FFD700;
          background: rgba(135, 206, 235, 0.07);
        }

        .subnav-link.active {
          color: #FFD700;
          background: rgba(255, 215, 0, 0.07);
          border-bottom-color: #FFD700;
        }
        .subnav-link.active::after {
          background: linear-gradient(90deg, transparent, #FFD700, transparent);
          transform: scaleX(1);
        }

        .subnav-icon {
          font-size: 1.05rem;
          filter: drop-shadow(0 0 4px currentColor);
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .subnav-container { padding: 0 0.6rem; gap: 0.05rem; }
          .subnav-link { padding: 0.65rem 0.75rem; }
          .subnav-txt  { display: none; }
        }
      `}</style>
    </div>
  );
}
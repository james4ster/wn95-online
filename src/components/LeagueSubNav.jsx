import React from 'react';
import { NavLink } from 'react-router-dom';
import { useLeague } from './LeagueContext';

/**
 * PURE CSS STICKY CASCADE — zero JavaScript, zero scroll listeners, zero lag
 * ────────────────────────────────────────────────────────────────────────────
 *
 * How the full sticky stack works:
 *
 *   ┌─────────────────────────────────┐
 *   │  ScoresBar                      │  position: sticky; top: 0; z-index: 1100
 *   │  height: 80px + 2px border      │  → locks at top of viewport on scroll
 *   ├─────────────────────────────────┤
 *   │  MainNavigation                 │  position: sticky; top: 82px; z-index: 1000
 *   │  height: 72px + 4px border      │  → locks flush under ScoresBar on scroll
 *   ├─────────────────────────────────┤
 *   │  LeagueSubNav  ← THIS FILE      │  position: sticky; top: 158px; z-index: 990
 *   │                                 │  → locks flush under MainNav on scroll
 *   ├─────────────────────────────────┤
 *   │  Page content                   │  scrolls freely beneath all three bars
 *   └─────────────────────────────────┘
 *
 * The key insight:
 *   Both elements use `position: sticky`. The browser compositor handles this
 *   at the GPU layer — no JavaScript runs during scroll at all.
 *   There is no frame delay, no state update, no re-render, no jump.
 *
 *   top: 72px = exact height of MainNav (desktop)
 *   top: 60px = exact height of MainNav (mobile, per MainNavigation CSS)
 *
 *   These are hardcoded because MainNav height never changes dynamically.
 *   Hardcoding is more reliable than measuring — no mount flash, no mismatch.
 *
 * REQUIREMENT: For `position: sticky` to work, NO ancestor element can have
 *   `overflow: hidden`, `overflow: auto`, or `overflow: scroll` set.
 *   Check `.app`, `body`, `html` if sticking breaks.
 */

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
          to={`/league/${selectedLeague}/managers`}
          className={({ isActive }) => `snl${isActive ? ' snl-on' : ''}`}
        >
          <span className="sni">👔</span>
          <span className="snt">MANAGERS</span>
        </NavLink>

                
      </div>

      <style>{`
        /* ── Sticky bar ─────────────────────────────────────────────────────────
         * top: 76px = MainNav height (72px) + its 4px border-bottom.
         * This places the SubNav flush against the bottom edge of the MainNav.
         * z-index 990 sits below MainNav (1000) so dropdown menus overlap SubNav.
         * ─────────────────────────────────────────────────────────────────────── */
        .league-subnav {
          position: sticky;
          top: 76px;   /* MainNav: 72px height + 4px border-bottom */
          z-index: 990;
          width: 100%;
          background: linear-gradient(180deg, #0d0d1f 0%, #040409 100%);
          border-bottom: 3px solid #87CEEB;
          box-shadow:
            0 3px 16px rgba(135, 206, 235, 0.22),
            inset 0 -1px 8px rgba(135, 206, 235, 0.08);
          /* Promote to GPU compositing layer — eliminates sub-pixel jitter */
          transform: translateZ(0);
        }

        /* ── Tab strip ─────────────────────────────────────────────────────────── */
        .subnav-inner {
          display: flex;
          align-items: stretch;
          overflow-x: auto;
          max-width: 1400px;
          margin: 0 auto;
          scrollbar-width: none;
        }
        .subnav-inner::-webkit-scrollbar { display: none; }

        /* ── Individual tab link ────────────────────────────────────────────────── */
        .snl {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0 1.4rem;
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
          /* Bottom active indicator */
          border-bottom: 3px solid transparent;
          margin-bottom: -3px;
        }

        /* Hover glow line */
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

        /* Active / current page */
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

        /* ── Mobile ──────────────────────────────────────────────────────────────
         * MainNavigation switches to height: 60px at max-width: 768px.
         * Adjust top accordingly: 60px + 4px border = 64px.
         * ─────────────────────────────────────────────────────────────────────── */
        @media (max-width: 768px) {
          .league-subnav { top: 64px; } /* MainNav mobile: 60px + 4px border */
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
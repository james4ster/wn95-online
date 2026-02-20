import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from './LeagueContext';

export default function MainNavigation() {
  const [leagues, setLeagues] = useState([]);
  const [showLeagueDropdown, setShowLeagueDropdown] = useState(false);
  const { selectedLeague, setSelectedLeague } = useLeague();
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLeagues = async () => {
      const { data, error } = await supabase
        .from('leagues')
        .select('*')
        .order('league_code');
      if (!error) setLeagues(data || []);
    };
    fetchLeagues();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowLeagueDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLeagueSelect = (leagueCode) => {
    setSelectedLeague(leagueCode);
    setShowLeagueDropdown(false);
    navigate(`/league/${leagueCode}/standings`);
  };

  const currentLeague = leagues.find(l => l.league_code === selectedLeague);

  return (
    <nav className="main-navigation">
      <div className="nav-container">

        {/* LOGO */}
        <Link to="/" className="nav-logo">
          <img
            src="/assets/leagueLogos/mainLogo.png"
            alt="WN95HL"
            className="logo-image"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextElementSibling.style.display = 'block';
            }}
          />
          <span className="logo-text-fallback">WN95HL</span>
        </Link>

        {/* RIGHT SIDE */}
        <div className="nav-links">

          <Link to="/" className="nav-link">
            <span className="nav-icon">🏠</span>
            <span className="link-label">HOME</span>
          </Link>

          <Link to="/players" className="nav-link">
  <span className="nav-icon">🏒</span>
  <span className="link-label">PLAYERS</span>
</Link>

          {/* LEAGUE DROPDOWN */}
          <div className="nav-dropdown" ref={dropdownRef}>
            <button
              className={`nav-link dropdown-trigger ${selectedLeague ? 'league-active' : ''}`}
              onClick={() => setShowLeagueDropdown(!showLeagueDropdown)}
            >
              <span className="nav-icon">🏆</span>
              <span className="link-label">
                {currentLeague ? (currentLeague.league_name || currentLeague.league_code) : 'LEAGUES'}
              </span>
              <span className={`dropdown-arrow ${showLeagueDropdown ? 'open' : ''}`}>▼</span>
            </button>

            {showLeagueDropdown && (
              <div className="league-dropdown-menu">
                <div className="dropdown-header">— SELECT LEAGUE —</div>
                {leagues.map((league) => (
                  <button
                    key={league.league_code}
                    className={`league-option ${selectedLeague === league.league_code ? 'selected' : ''}`}
                    onClick={() => handleLeagueSelect(league.league_code)}
                  >
                    <div className="league-option-inner">
                      <span className="league-opt-code">{league.league_code}</span>
                      {league.league_name && (
                        <span className="league-opt-name">{league.league_name}</span>
                      )}
                    </div>
                    {selectedLeague === league.league_code && (
                      <span className="league-check">▶</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* DISCORD BUTTON */}
          <a
            href="https://discord.gg/YOUR_INVITE_CODE"
            target="_blank"
            rel="noopener noreferrer"
            className="discord-btn"
          >
            <div className="discord-btn-inner">
              <svg className="discord-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.001.022.01.043.027.056a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              <span className="discord-label">DISCORD</span>
              <span className="discord-live-dot"></span>
            </div>
            <div className="discord-glow-ring"></div>
          </a>

        </div>
      </div>

      <style>{`
        .main-navigation {
          background: linear-gradient(180deg, #1a1a2e 0%, #0a0a15 100%);
          border-bottom: 4px solid #FF8C00;
          box-shadow:
            0 4px 20px rgba(255,140,0,0.5),
            0 2px 40px rgba(255,140,0,0.2),
            inset 0 -1px 0 rgba(255,215,0,0.2);
          position: sticky;
          top: 0;
          z-index: 1000;
        }

        .nav-container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 72px;
        }

        /* ── LOGO ── */
        .nav-logo {
          text-decoration: none;
          display: flex;
          align-items: center;
        }

        .logo-image {
          height: 52px;
          width: auto;
          object-fit: contain;
          filter: drop-shadow(0 0 8px rgba(255,215,0,0.5));
          transition: all 0.3s ease;
        }

        .nav-logo:hover .logo-image {
          filter: drop-shadow(0 0 15px rgba(255,215,0,0.8)) drop-shadow(0 0 25px rgba(255,140,0,0.5));
          transform: scale(1.05);
        }

        .logo-text-fallback {
          display: none;
          font-family: 'Press Start 2P', monospace;
          font-size: 1.5rem;
          color: #FFD700;
          letter-spacing: 4px;
          text-shadow: 0 0 10px #FFD700, 0 0 20px #FF8C00;
        }

        /* ── NAV LINKS ── */
        .nav-links {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }

        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.6rem 1.1rem;
          background: transparent;
          border: 2px solid transparent;
          border-radius: 8px;
          color: #87CEEB;
          font-family: 'Press Start 2P', monospace;
          font-size: 0.65rem;
          text-decoration: none;
          cursor: pointer;
          transition: all 0.3s ease;
          letter-spacing: 1px;
          position: relative;
          overflow: hidden;
        }

        .nav-link::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(135,206,235,0.15), transparent);
          transition: left 0.5s ease;
        }

        .nav-link:hover::before { left: 100%; }

        .nav-link:hover {
          border-color: #87CEEB;
          color: #FFF;
          box-shadow: 0 0 15px rgba(135,206,235,0.4), inset 0 0 8px rgba(135,206,235,0.1);
          transform: translateY(-2px);
        }

        .nav-link.league-active {
          border-color: #FFD700;
          color: #FFD700;
          background: rgba(255,215,0,0.07);
          box-shadow: 0 0 18px rgba(255,215,0,0.4), inset 0 0 10px rgba(255,215,0,0.1);
        }

        .nav-icon { font-size: 1rem; }
        .link-label { position: relative; z-index: 1; }

        /* ── LEAGUE DROPDOWN ── */
        .nav-dropdown { position: relative; }
        .dropdown-trigger { background: rgba(255,140,0,0.05); }

        .dropdown-arrow {
          font-size: 0.5rem;
          margin-left: 0.4rem;
          transition: transform 0.3s ease;
          opacity: 0.7;
        }
        .dropdown-arrow.open { transform: rotate(180deg); }

        .league-dropdown-menu {
          position: absolute;
          top: calc(100% + 12px);
          left: 0;
          min-width: 280px;
          background: linear-gradient(180deg, #1a1a2e 0%, #08080f 100%);
          border: 2px solid #FF8C00;
          border-radius: 12px;
          box-shadow:
            0 12px 40px rgba(0,0,0,0.9),
            0 0 30px rgba(255,140,0,0.35),
            inset 0 0 20px rgba(255,140,0,0.04);
          padding: 0.5rem;
          max-height: 440px;
          overflow-y: auto;
          animation: dropdown-appear 0.2s ease;
        }

        @keyframes dropdown-appear {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .dropdown-header {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.48rem;
          color: #FF8C00;
          text-align: center;
          padding: 0.6rem 0.5rem;
          letter-spacing: 2px;
          border-bottom: 1px solid rgba(255,140,0,0.25);
          margin-bottom: 0.5rem;
          text-shadow: 0 0 8px #FF8C00;
        }

        .league-option {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.7rem 1rem;
          background: transparent;
          border: 1px solid transparent;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: left;
          margin-bottom: 0.2rem;
        }

        .league-option-inner {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .league-opt-code {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.72rem;
          letter-spacing: 2px;
          color: #FFF;
        }

        .league-opt-name {
          font-family: 'Press Start 2P', monospace;
          font-size: 0.48rem;
          color: #87CEEB;
          opacity: 0.75;
          letter-spacing: 1px;
        }

        .league-check {
          font-size: 0.65rem;
          color: #FFD700;
          text-shadow: 0 0 8px #FFD700;
        }

        .league-option:hover {
          background: rgba(135,206,235,0.07);
          border-color: rgba(135,206,235,0.3);
          transform: translateX(4px);
        }

        .league-option:hover .league-opt-code { color: #87CEEB; }

        .league-option.selected {
          background: rgba(255,215,0,0.1);
          border-color: rgba(255,215,0,0.4);
          box-shadow: 0 0 12px rgba(255,215,0,0.15), inset 0 0 8px rgba(255,215,0,0.08);
        }

        .league-option.selected .league-opt-code { color: #FFD700; }

        /* ── DISCORD BUTTON - subtle but still sexy ── */
        .discord-btn {
          position: relative;
          display: inline-flex;
          align-items: center;
          text-decoration: none;
          margin-left: 0.25rem;
        }

        .discord-btn-inner {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.55rem 1rem;
          background: rgba(88,101,242,0.15);
          border: 1px solid rgba(114,137,218,0.5);
          border-radius: 8px;
          color: rgba(114,137,218,0.9);
          font-family: 'Press Start 2P', monospace;
          font-size: 0.58rem;
          letter-spacing: 1px;
          transition: all 0.3s ease;
          overflow: hidden;
          box-shadow: 0 0 8px rgba(88,101,242,0.2);
        }

        .discord-btn-inner::before {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
          transition: left 0.5s ease;
        }

        .discord-btn:hover .discord-btn-inner::before { left: 100%; }

        .discord-btn:hover .discord-btn-inner {
          background: rgba(88,101,242,0.3);
          border-color: rgba(114,137,218,0.9);
          color: #fff;
          transform: translateY(-1px);
          box-shadow: 0 0 18px rgba(88,101,242,0.5);
        }

        .discord-glow-ring { display: none; }

        .discord-icon {
          width: 15px;
          height: 15px;
          flex-shrink: 0;
          opacity: 0.85;
        }

        .discord-btn:hover .discord-icon { opacity: 1; }

        .discord-label { position: relative; z-index: 1; }

        .discord-live-dot {
          width: 6px;
          height: 6px;
          background: #3ba55c;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 4px #3ba55c;
          animation: live-blink 2.5s ease-in-out infinite;
        }

        @keyframes live-blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.4; }
        }

        /* ── MOBILE ── */
        @media (max-width: 768px) {
          .nav-container { padding: 0 1rem; height: 60px; }
          .logo-text { font-size: 1.1rem; letter-spacing: 3px; }
          .nav-links { gap: 0.4rem; }
          .nav-link { padding: 0.5rem 0.65rem; font-size: 0.55rem; }
          .link-label { display: none; }
          .nav-icon { font-size: 1.1rem; }
          .discord-label { display: none; }
          .discord-btn-inner { padding: 0.5rem 0.75rem; }
          .league-dropdown-menu { min-width: 230px; }
        }
      `}</style>
    </nav>
  );
}
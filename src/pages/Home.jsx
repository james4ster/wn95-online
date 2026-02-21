import { useEffect, useState } from 'react';
import { supabase } from "../utils/supabaseClient";
import TwitchLiveWidget from "../components/TwitchLiveWidget";

export default function Home() {
  const [recentGames, setRecentGames] = useState([]);
  const [topScorers, setTopScorers] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHomeData = async () => {
      setLoading(true);

      // Fetch recent games
      const { data: games } = await supabase
        .from('games')
        .select('*')
        .order('game', { ascending: false })
        .limit(10);

      // Fetch top scorers
      /*const { data: scorers } = await supabase
        .from('player_stats')
        .select('player_name, team, goals, assists, points')
        .order('points', { ascending: false })
        .limit(8);

      setRecentGames(games || []);
      setTopScorers(scorers || []); */
      setLoading(false);
    };

    fetchHomeData();
  }, []);

  useEffect(() => {
    const fetchManagers = async () => {
      const { data, error } = await supabase
        .from('managers')
        .select('twitch_username, coach_name');

      if (error) console.error('Error fetching managers:', error);
      else setManagers(data || []);
    };

    fetchManagers();
  }, []);

  const leagues = [
    { name: 'WN95', code: 'WN95', logo: '/assets/leagueLogos/w.png' },
    { name: 'The Q', code: 'The Q', logo: '/assets/leagueLogos/q.png' },
    { name: 'Vintage', code: 'Vintage', logo: '/assets/leagueLogos/vintage.png' },
  ];

  return (
    <div className="home-page">
      {/* Discord Button - Top Right Fixed */}
      <a 
        href="https://discord.gg/YOUR_INVITE" 
        target="_blank" 
        rel="noopener noreferrer"
        className="discord-button-fixed"
      >
        <svg className="discord-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      </a>

      {/* Twitch Live Panel */}
      <div className="twitch-panel-wrapper">
        <TwitchLiveWidget managers={managers} />
      </div>

      {/* Compact Hero Title */}
      <div className="compact-hero">
        <div className="hero-title">NHL '95 ONLINE</div>
      </div>

      {/* Leagues Strip */}
      <div className="leagues-strip">
        {leagues.map((league, idx) => (
          <div key={idx} className="league-badge">
            <img 
              src={league.logo} 
              alt={league.name}
              className="league-mini-logo"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextElementSibling.style.display = 'flex';
              }}
            />
            <div className="league-mini-fallback" style={{ display: 'none' }}>
              {league.code}
            </div>
            <div className="league-mini-name">{league.code}</div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="main-content-grid">
        {/* Left Column - Top Scorers */}
        <div className="content-section">
          <div className="section-header-compact">
            <div className="section-title-compact">⭐ TOP SCORERS</div>
          </div>
          <div className="scorers-list">
            {topScorers.map((scorer, idx) => (
              <div key={idx} className="scorer-row">
                <div className="scorer-rank-mini">{idx + 1}</div>
                <div className="scorer-details">
                  <div className="scorer-name-mini">{scorer.player_name}</div>
                  <div className="scorer-team-mini">{scorer.team}</div>
                </div>
                <div className="scorer-stats-mini">
                  <span className="stat-mini">{scorer.goals}G</span>
                  <span className="stat-mini">{scorer.assists}A</span>
                  <span className="stat-mini highlight-mini">{scorer.points}P</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column - Stats Dashboard */}
        <div className="content-section">
          <div className="section-header-compact">
            <div className="section-title-compact">📊 LEAGUE STATS</div>
          </div>
          <div className="stats-dashboard">
            <div className="stat-box">
              <div className="stat-number">3</div>
              <div className="stat-label">Leagues</div>
            </div>
            <div className="stat-box">
              <div className="stat-number">50+</div>
              <div className="stat-label">Teams</div>
            </div>
            <div className="stat-box">
              <div className="stat-number">200+</div>
              <div className="stat-label">Players</div>
            </div>
            <div className="stat-box">
              <div className="stat-number">1000+</div>
              <div className="stat-label">Games</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Ticker */}
      <div className="scores-ticker">
        <div className="ticker-label">RECENT RESULTS</div>
        <div className="ticker-scroll">
          <div className="ticker-content">
            {recentGames.concat(recentGames).map((game, idx) => (
              <div key={idx} className="ticker-game">
                <span className="ticker-team">{game.home_team}</span>
                <span className="ticker-score">{game.home_score}</span>
                <span className="ticker-vs">-</span>
                <span className="ticker-score">{game.away_score}</span>
                <span className="ticker-team">{game.away_team}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{homeStyles}</style>
    </div>
  );
}

const homeStyles = `
  .home-page {
    min-height: 100vh;
    background: radial-gradient(ellipse at top, #0a0a15 0%, #000000 100%);
    padding: 1rem 0 0 0;
    position: relative;
  }

  /* Discord Button - Fixed Top Right */
  .discord-button-fixed {
    position: fixed;
    top: 80px;
    right: 2rem;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #FF8C00 0%, #FF6347 100%);
    border: 3px solid #FFD700;
    border-radius: 50%;
    color: #FFF;
    text-decoration: none;
    transition: all 0.3s ease;
    box-shadow: 
      0 4px 20px rgba(255, 140, 0, 0.4),
      inset 0 0 20px rgba(255, 255, 255, 0.1);
    cursor: pointer;
  }

  .discord-button-fixed:hover {
    transform: scale(1.15);
    box-shadow: 
      0 0 30px rgba(255, 140, 0, 1),
      0 0 50px rgba(255, 140, 0, 0.7),
      inset 0 0 30px rgba(255, 255, 255, 0.3);
    border-color: #FFF;
  }

  .discord-icon {
    width: 32px;
    height: 32px;
  }

  /* Compact Hero */
  .compact-hero {
    text-align: center;
    padding: 1rem 2rem 1.5rem 2rem;
  }

  .hero-title {
    font-family: 'Press Start 2P', monospace;
    font-size: 2.5rem;
    color: #FF8C00;
    letter-spacing: 4px;
    text-shadow: 0 0 15px #FF8C00, 0 0 30px #FFD700;
    margin-bottom: 0.5rem;
  }

  .hero-tagline {
    font-family: 'VT323', monospace;
    font-size: 1.4rem;
    color: #87CEEB;
    letter-spacing: 2px;
  }

  /* Leagues Strip - Compact Horizontal */
  .leagues-strip {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 3rem;
    padding: 1.5rem 2rem;
    background: linear-gradient(90deg, 
      rgba(255, 140, 0, 0.1) 0%,
      rgba(135, 206, 235, 0.1) 50%,
      rgba(255, 140, 0, 0.1) 100%
    );
    border-top: 2px solid rgba(255, 140, 0, 0.3);
    border-bottom: 2px solid rgba(135, 206, 235, 0.3);
  }

  .league-badge {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.3s ease;
    cursor: pointer;
  }

  .league-badge:hover {
    transform: translateY(-5px);
  }

  .league-mini-logo {
    width: 80px;
    height: 80px;
    object-fit: contain;
    filter: drop-shadow(0 0 10px rgba(135, 206, 235, 0.5));
    transition: all 0.3s ease;
  }

  .league-badge:hover .league-mini-logo {
    filter: drop-shadow(0 0 20px rgba(255, 140, 0, 1));
    transform: scale(1.15);
  }

  .league-mini-fallback {
    width: 80px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #87CEEB 0%, #4682B4 100%);
    border-radius: 12px;
    font-family: 'Press Start 2P', monospace;
    font-size: 1rem;
    color: #000;
    font-weight: bold;
  }

  .league-mini-name {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.7rem;
    color: #87CEEB;
    letter-spacing: 1px;
    transition: all 0.3s ease;
  }

  .league-badge:hover .league-mini-name {
    color: #FFD700;
    text-shadow: 0 0 10px #FFD700;
  }

  /* Main Content Grid */
  .main-content-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    padding: 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .content-section {
    background: linear-gradient(135deg, #1a1a2e 0%, #0a0a15 100%);
    border: 3px solid #87CEEB;
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: 
      0 0 20px rgba(135, 206, 235, 0.3),
      inset 0 0 20px rgba(135, 206, 235, 0.05);
  }

  .section-header-compact {
    margin-bottom: 1.5rem;
  }

  .section-title-compact {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.9rem;
    color: #FF8C00;
    letter-spacing: 2px;
    text-shadow: 0 0 10px #FF8C00;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid rgba(255, 140, 0, 0.3);
  }

  /* Top Scorers List */
  .scorers-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .scorer-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.3);
    border-left: 3px solid #87CEEB;
    border-radius: 6px;
    transition: all 0.2s ease;
  }

  .scorer-row:hover {
    background: rgba(255, 140, 0, 0.1);
    border-left-color: #FF8C00;
    transform: translateX(5px);
  }

  .scorer-row:nth-child(1) {
    border-left-color: #FFD700;
    background: rgba(255, 215, 0, 0.05);
  }

  .scorer-rank-mini {
    font-family: 'Press Start 2P', monospace;
    font-size: 1.2rem;
    color: #FF8C00;
    min-width: 35px;
    text-align: center;
  }

  .scorer-row:nth-child(1) .scorer-rank-mini {
    color: #FFD700;
    text-shadow: 0 0 10px #FFD700;
  }

  .scorer-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }

  .scorer-name-mini {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.7rem;
    color: #87CEEB;
  }

  .scorer-team-mini {
    font-family: 'VT323', monospace;
    font-size: 1rem;
    color: #999;
  }

  .scorer-stats-mini {
    display: flex;
    gap: 0.75rem;
    align-items: center;
  }

  .stat-mini {
    font-family: 'VT323', monospace;
    font-size: 1.3rem;
    color: #E0E0E0;
  }

  .stat-mini.highlight-mini {
    color: #FFD700;
    font-weight: bold;
    font-size: 1.5rem;
  }

  /* Stats Dashboard */
  .stats-dashboard {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .stat-box {
    background: rgba(0, 0, 0, 0.3);
    border: 2px solid #87CEEB;
    border-radius: 8px;
    padding: 1.5rem 1rem;
    text-align: center;
    transition: all 0.3s ease;
  }

  .stat-box:hover {
    border-color: #FF8C00;
    background: rgba(255, 140, 0, 0.1);
    transform: scale(1.05);
  }

  .stat-number {
    font-family: 'Press Start 2P', monospace;
    font-size: 2.5rem;
    color: #FFD700;
    text-shadow: 0 0 15px #FFD700;
    margin-bottom: 0.5rem;
  }

  .stat-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.6rem;
    color: #87CEEB;
    letter-spacing: 1px;
  }

  /* Bottom Ticker - Sports Style */
  .scores-ticker {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(90deg, #1a1a2e 0%, #0a0a15 50%, #1a1a2e 100%);
    border-top: 3px solid #FF8C00;
    display: flex;
    align-items: center;
    height: 50px;
    z-index: 100;
    box-shadow: 0 -4px 20px rgba(255, 140, 0, 0.3);
  }

  .ticker-label {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.7rem;
    color: #FFD700;
    background: #FF8C00;
    padding: 0.75rem 1.5rem;
    letter-spacing: 2px;
    white-space: nowrap;
    border-right: 3px solid #FFD700;
  }

  .ticker-scroll {
    flex: 1;
    overflow: hidden;
    position: relative;
  }

  .ticker-content {
    display: flex;
    gap: 3rem;
    animation: ticker-scroll 50s linear infinite;
    padding: 0 2rem;
  }

  @keyframes ticker-scroll {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(-50%);
    }
  }

  .ticker-game {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .ticker-team {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.8rem;
    color: #87CEEB;
  }

  .ticker-score {
    font-family: 'VT323', monospace;
    font-size: 1.8rem;
    color: #FFD700;
    font-weight: bold;
  }

  .ticker-vs {
    font-family: 'Press Start 2P', monospace;
    font-size: 0.6rem;
    color: #FF8C00;
  }

  /* Responsive */
  @media (max-width: 1024px) {
    .main-content-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .hero-title {
      font-size: 1.5rem;
      letter-spacing: 2px;
    }

    .hero-tagline {
      font-size: 1.1rem;
    }

    .discord-button-fixed {
      width: 50px;
      height: 50px;
      top: 70px;
      right: 1rem;
    }

    .discord-icon {
      width: 24px;
      height: 24px;
    }

    .leagues-strip {
      gap: 1.5rem;
    }

    .league-mini-logo {
      width: 60px;
      height: 60px;
    }

    .main-content-grid {
      padding: 1rem;
      gap: 1rem;
    }

    .stats-dashboard {
      grid-template-columns: 1fr;
    }

    .ticker-label {
      font-size: 0.5rem;
      padding: 0.5rem 1rem;
    }

    .ticker-team {
      font-size: 0.6rem;
    }

    .ticker-score {
      font-size: 1.4rem;
    }
  }
`;
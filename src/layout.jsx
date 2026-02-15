import React from 'react';
import logo from './assets/leagueLogos/mainLogo.png';

export default function Layout({ children, setPage }) {
  return (
    <div className="sega-bg min-h-screen flex flex-col font-press-start text-white">
      {/* Header */}
      <header className="hero-bar">
        <img src={logo} alt="NHL '95 Logo" className="logo" />
        <nav className="hero-nav">
          <button
            onClick={() => setPage('standings')}
            className="hover:text-neon-cyan px-2 py-1 rounded bg-neon-purple/20"
          >
            Standings
          </button>
          <button
            onClick={() => setPage('schedule')}
            className="hover:text-neon-cyan px-2 py-1 rounded bg-neon-purple/20"
          >
            Schedule
          </button>
          <button
            onClick={() => setPage('teams')}
            className="hover:text-neon-cyan px-2 py-1 rounded bg-neon-purple/20"
          >
            Teams
          </button>
        </nav>
      </header>

      {/* Main content with NHL95 ice rink background */}
      <main
        className="flex-1 p-6 nhl95-bg crt-curve"
        style={{
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Blue Lines */}
        <div className="blue-line-left" />
        <div className="blue-line-right" />

        {/* Ice Effects */}
        <div className="ice-texture" />
        <div className="skate-marks" />

        {/* Content Container - sits above background effects */}
        <div style={{ position: 'relative', zIndex: 3 }}>{children}</div>
      </main>

      {/* Footer */}
      <footer className="p-4 border-t-4 border-neon-red text-center text-sm">
        &copy; {new Date().getFullYear()} Retro Hockey League
      </footer>
    </div>
  );
}

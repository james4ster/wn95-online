import React, { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { LeagueProvider } from './components/LeagueContext';
import MainNavigation from './components/MainNavigation';
import LeagueSubNav from './components/LeagueSubNav';
import Home from './pages/Home';
import Standings from './pages/Standings';
import Schedule from './pages/Schedule';
import Teams from './pages/Teams';
import Managers from './pages/Managers';
import Players from './pages/Players';
import Stats from './pages/Stats';
import Scores from './pages/Scores';
import ScoresBar from './components/ScoresBar';
import Media from './pages/Media';
import Transactions from './pages/Transactions';

function App() {
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      if (args[0].includes('player_stats')) {
        console.log('Detected player_stats fetch!', new Error().stack);
      }
      return originalFetch(...args);
    };
  }, []);

  return (
    <LeagueProvider>
      <Router>
        <div className="app">
          {/*
           * ScoresBar — NOT sticky, scrolls away naturally.
           * NO wrapper div — sticky elements must be direct children
           * of the scroll container. A wrapper div confines the sticky
           * element inside itself, so it can never actually stick.
           */}
          <ScoresBar />

          {/*
           * MainNavigation — position: sticky; top: 0
           * Locks to top of viewport as ScoresBar scrolls away.
           */}
          <MainNavigation />

          {/*
           * LeagueSubNav — position: sticky; top: 76px
           * Locks flush under MainNav (72px height + 4px border).
           */}
          <LeagueSubNav />

          <Routes>
            <Route path="/" element={<Home />} />
            <Route
              path="/league/:leagueCode/standings"
              element={<Standings />}
            />
            <Route path="/league/:leagueCode/stats" element={<Stats />} />
            <Route path="/league/:leagueCode/managers" element={<Managers />} />
            <Route path="/league/:leagueCode/schedule" element={<Schedule />} />
            <Route path="/players" element={<Players />} />
            <Route path="/league/:leagueCode/teams" element={<Teams />} />
            <Route path="/league/:leagueCode/scores" element={<Scores />} />
            <Route
              path="/league/:leagueId/transactions"
              element={<Transactions />}
            />
            <Route path="/media" element={<Media />} />
          </Routes>
          <Analytics />
        </div>
      </Router>
    </LeagueProvider>
  );
}

export default App;

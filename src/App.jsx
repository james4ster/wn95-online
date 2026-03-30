import React, { useEffect } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
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
import StreamOverlayStandings from './overlays/StreamOverlayStandings';
import StreamOverlayMatchupDefault from './overlays/StreamOverlayMatchupDefault';
import StreamOverlayMatchupIcey from './overlays/StreamOverlayMatchupIcey';
import PodcastOverlay from './overlays/PodcastOverlay';
import PodcastCtrl from './overlays/PodcastCtrl';

const OVERLAY_PATHS = [
  '/overlay-standings',
  '/overlay-matchup-default',
  '/overlay-matchup-icey',
  '/overlay-podcast',
  '/overlay-podcast-ctrl',
];

function AppShell() {
  const location = useLocation();
  const isOverlay = OVERLAY_PATHS.some(p => location.pathname.startsWith(p));

  if (isOverlay) {
    return (
      <Routes>
        <Route path="/overlay-standings"        element={<StreamOverlayStandings />} />
        <Route path="/overlay-matchup-default"  element={<StreamOverlayMatchupDefault />} />
        <Route path="/overlay-matchup-icey"     element={<StreamOverlayMatchupIcey />} />
        <Route path="/overlay-podcast-ctrl"     element={<PodcastCtrl />} />
        <Route path="/overlay-podcast"          element={<PodcastOverlay />} />
      </Routes>
    );
  }

  return (
    <div className="app">
      <ScoresBar />
      <MainNavigation />
      <LeagueSubNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/league/:leagueCode/standings" element={<Standings />} />
        <Route path="/league/:leagueCode/stats" element={<Stats />} />
        <Route path="/league/:leagueCode/managers" element={<Managers />} />
        <Route path="/league/:leagueCode/schedule" element={<Schedule />} />
        <Route path="/players" element={<Players />} />
        <Route path="/league/:leagueCode/teams" element={<Teams />} />
        <Route path="/league/:leagueCode/scores" element={<Scores />} />
        <Route path="/league/:leagueId/transactions" element={<Transactions />} />
        <Route path="/media" element={<Media />} />
      </Routes>
      <Analytics />
    </div>
  );
}

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
        <AppShell />
      </Router>
    </LeagueProvider>
  );
}

export default App;

import React from 'react';
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


function App() {
  return (
    <LeagueProvider>
      <Router>
        <div className="app">
          <MainNavigation />
          <LeagueSubNav />
          
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/league/:leagueCode/standings" element={<Standings />} />
            <Route path="/league/:leagueCode/stats" element={<div>Player Stats Coming Soon</div>} />
            <Route path="/league/:leagueCode/managers" element={<Managers />} />
            <Route path="/league/:leagueCode/schedule" element={<Schedule />} />
            <Route path="/players" element={<Players />} />
            <Route path="/league/:leagueCode/teams" element={<Teams />} /> 
          </Routes>
        </div>
      </Router>
    </LeagueProvider>
  );
}

export default App;
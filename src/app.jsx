import React, { useState } from 'react';
import Layout from './layout';
import Home from './pages/home';
import Standings from './pages/standings';
import Schedule from './pages/schedule';
import Teams from './pages/teams';

export default function App() {
  const [page, setPage] = useState('home');

  const renderPage = () => {
    switch (page) {
      case 'home':
        return <Home />;
      case 'standings':
        return <Standings />;
      case 'schedule':
        return <Schedule />;
      case 'teams':
        return <Teams />;
      default:
        return <Home />;
    }
  };

  return <Layout setPage={setPage}>{renderPage()}</Layout>;
}
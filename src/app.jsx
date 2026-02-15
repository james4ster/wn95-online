import React, { useState } from 'react';
import Layout from './layout';
import Standings from './pages/standings';
import Schedule from './pages/schedule';
import Teams from './pages/teams';

export default function App() {
  const [page, setPage] = useState('standings');

  const renderPage = () => {
    switch (page) {
      case 'standings':
        return <Standings />;
      case 'schedule':
        return <Schedule />;
      case 'teams':
        return <Teams />;
      default:
        return <Standings />;
    }
  };

  return <Layout setPage={setPage}>{renderPage()}</Layout>;
}

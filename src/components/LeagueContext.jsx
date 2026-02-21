import React, { createContext, useContext, useState, useEffect } from 'react';

const LeagueContext = createContext();

export const useLeague = () => {
  const context = useContext(LeagueContext);
  if (!context) {
    throw new Error('useLeague must be used within LeagueProvider');
  }
  return context;
};

export const LeagueProvider = ({ children }) => {
  const [selectedLeague, setSelectedLeague] = useState(
    localStorage.getItem('selectedLeague') || 'W'  // ← default to 'W'
  );

  useEffect(() => {
    if (selectedLeague) {
      localStorage.setItem('selectedLeague', selectedLeague);
    }
  }, [selectedLeague]);

  return (
    <LeagueContext.Provider value={{ selectedLeague, setSelectedLeague }}>
      {children}
    </LeagueContext.Provider>
  );
};
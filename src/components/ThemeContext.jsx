import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

export const DARK = {
  pageBg:        'radial-gradient(ellipse at top, #0a0a15 0%, #000000 100%)',
  navBg:         'linear-gradient(180deg, #1a1a2e 0%, #0a0a15 100%)',
  subnavBg:      'linear-gradient(180deg, #0f0f1a 0%, #05050a 100%)',
  cardBg:        'linear-gradient(135deg, #1a1a2e 0%, #0a0a15 100%)',
  dropdownBg:    'linear-gradient(180deg, #1a1a2e 0%, #08080f 100%)',
  tickerBg:      'linear-gradient(90deg, #1a1a2e 0%, #0a0a15 50%, #1a1a2e 100%)',
  rowBg:         'rgba(0, 0, 0, 0.3)',
  rowHoverBg:    'rgba(255, 140, 0, 0.1)',
  statBoxBg:     'rgba(0, 0, 0, 0.3)',
  segaBg:        '#0b0b1d',
  textPrimary:   '#FFFFFF',
  textSecondary: '#87CEEB',
  textMuted:     '#999999',
  textAccent:    '#FF8C00',
  textGold:      '#FFD700',
  borderAccent:  '#FF8C00',
  borderBlue:    '#87CEEB',
  borderGold:    '#FFD700',
  toggleBg:      'rgba(255,255,255,0.1)',
  toggleBorder:  'rgba(255,255,255,0.3)',
  toggleColor:   '#FFD700',
};

export const LIGHT = {
  pageBg:        'radial-gradient(ellipse at top, #e8f0f8 0%, #d0dff0 100%)',
  navBg:         'linear-gradient(180deg, #0d1b2a 0%, #060e18 100%)',
  subnavBg:      'linear-gradient(180deg, #0f2030 0%, #071520 100%)',
  cardBg:        'linear-gradient(135deg, #ffffff 0%, #eaf2fb 100%)',
  dropdownBg:    'linear-gradient(180deg, #ffffff 0%, #e8f0f8 100%)',
  tickerBg:      'linear-gradient(90deg, #0d1b2a 0%, #0a1520 50%, #0d1b2a 100%)',
  rowBg:         'rgba(255, 255, 255, 0.7)',
  rowHoverBg:    'rgba(180, 90, 0, 0.08)',
  statBoxBg:     'rgba(255, 255, 255, 0.85)',
  segaBg:        '#e8f0f8',
  textPrimary:   '#0a0f1a',
  textSecondary: '#0d3358',
  textMuted:     '#3a3a4a',
  textAccent:    '#7a3200',
  textGold:      '#5a4400',
  borderAccent:  '#7a3200',
  borderBlue:    '#1a5276',
  borderGold:    '#7a6000',
  toggleBg:      'rgba(0,0,0,0.08)',
  toggleBorder:  'rgba(0,0,0,0.2)',
  toggleColor:   '#7a3200',
};

export const ThemeProvider = ({ children }) => {
  const [isDark, setIsDark] = useState(
    () => localStorage.getItem('theme') !== 'light'
  );

  useEffect(() => {
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggle = () => setIsDark(prev => !prev);
  const theme  = isDark ? DARK : LIGHT;

  return (
    <ThemeContext.Provider value={{ isDark, toggle, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};
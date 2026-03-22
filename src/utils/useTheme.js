// src/hooks/useTheme.js
// Drop this in your hooks/ or utils/ folder.
// Usage:  const { theme, toggleTheme } = useTheme();

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'wn95-theme';
const DEFAULT_THEME = 'dark';

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
        root.setAttribute('data-theme', 'light');
      } else {
        root.removeAttribute('data-theme');
      }
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return { theme, toggleTheme };
}
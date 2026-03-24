// src/components/ThemeToggle.jsx
// Drop this anywhere in your nav/header.
// Requires useTheme hook from ../hooks/useTheme (or wherever you put it).

import { useTheme } from '../utils/useTheme';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
  onClick={toggleTheme}
  title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
  style={{
    background: isLight ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.3)',
    border: `1px solid ${isLight ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}`,
    borderRadius: '6px',
    cursor: 'pointer',
    padding: '4px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.15s',
    color: isLight ? '#ffffff' : 'var(--text-secondary)',
  }}
>
  <span style={{ fontSize: 14 }}>{isLight ? '☀️' : '🌙'}</span>
  <span style={{ fontFamily: '"Press Start 2P", monospace', fontSize: 8, letterSpacing: 1 }}>
    {isLight ? 'LIGHT' : 'DARK'}
  </span>
</button>
  );
}
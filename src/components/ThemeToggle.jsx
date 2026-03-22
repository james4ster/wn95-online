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
        background: 'none',
        border: '1.5px solid var(--border-dim)',
        borderRadius: 6,
        cursor: 'pointer',
        padding: '4px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all .15s',
        color: 'var(--text-secondary)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent-blue)';
        e.currentTarget.style.color = 'var(--accent-blue)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-dim)';
        e.currentTarget.style.color = 'var(--text-secondary)';
      }}
    >
      <span style={{ fontSize: 14 }}>{isLight ? '☀️' : '🌙'}</span>
      <span style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 8,
        letterSpacing: 1,
      }}>
       {isLight ? 'LIGHT' : 'DARK'}
      </span>
    </button>
  );
}
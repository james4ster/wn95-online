import React from 'react';

export default function Schedule() {
  const games = [
    { home: 'Ice Wolves', away: 'Frost Bears', date: 'Feb 20' },
    { home: 'Blizzard Hawks', away: 'Ice Wolves', date: 'Feb 21' },
    { home: 'Frost Bears', away: 'Blizzard Hawks', date: 'Feb 22' },
  ];

  return (
    <div>
      <h2 className="text-2xl neon-glow mb-4">Schedule</h2>
      <ul className="space-y-2">
        {games.map((game, index) => (
          <li
            key={index}
            className="p-3 border border-neon-pink rounded hover:bg-neon-blue/10"
          >
            {game.date}: {game.home} vs {game.away}
          </li>
        ))}
      </ul>
    </div>
  );
}

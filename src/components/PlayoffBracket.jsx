import React from 'react';

export default function PlayoffBracket({ bracket, selectedSeason }) {
  if (!bracket) return null;

  return (
    <div className="bracket-preview-container">
      <h2>{selectedSeason} PLAYOFF DETAILS</h2>
      <div className="series-list">
        {bracket.firstRoundMatchups.map((m, idx) => (
          <div key={idx} className="series-card">
            <div className="team-row">
              <span className="team-seed">{m.homeLabel}</span>
              <span className="team-name">{m.home.team}</span>
              <span className="team-pts">{m.home.pts} pts</span>
              <span className="team-score">Score: {m.home.score || '-'}</span>
            </div>
            <div className="vs-row">VS</div>
            <div className="team-row">
              <span className="team-seed">{m.awayLabel}</span>
              <span className="team-name">{m.away.team}</span>
              <span className="team-pts">{m.away.pts} pts</span>
              <span className="team-score">Score: {m.away.score || '-'}</span>
            </div>
            <div className="series-meta">
              Series Winner: {m.winner || '-'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

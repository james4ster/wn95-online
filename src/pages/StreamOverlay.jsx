import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

// ── Config ─────────────────────────────────────────────────────────────────
const PLAYOFF_TEAMS = 8; // adjust to your league's playoff cutoff

// ── Compute standings from raw games ──────────────────────────────────────
function computeStandings(games, teams) {
  const map = {};
  const ensure = code => {
    if (!map[code]) map[code] = { team: code, gp:0, w:0, l:0, t:0, otl:0, pts:0, gf:0, ga:0 };
    return map[code];
  };
  (games || []).forEach(g => {
    const h = ensure(g.home), a = ensure(g.away);
    const sh = g.score_home ?? 0, sa = g.score_away ?? 0;
    h.gp++; a.gp++; h.gf += sh; h.ga += sa; a.gf += sa; a.ga += sh;
    if (sh === sa) { h.t++; a.t++; h.pts++; a.pts++; }
    else if (sh > sa) {
      if (g.ot) { h.w++; h.pts += 2; a.otl++; a.pts++; }
      else       { h.w++; h.pts += 2; a.l++; }
    } else {
      if (g.ot) { a.w++; a.pts += 2; h.otl++; h.pts++; }
      else       { a.w++; a.pts += 2; h.l++; }
    }
  });
  (teams || []).forEach(t => {
    if (!map[t.abr]) map[t.abr] = { team: t.abr, gp:0, w:0, l:0, t:0, otl:0, pts:0, gf:0, ga:0 };
  });
  return Object.values(map).sort((a,b) =>
    b.pts - a.pts || b.w - a.w || (b.gf - b.ga) - (a.gf - a.ga)
  );
}

// ── Compute scorers from game_raw_scoring ─────────────────────────────────
function computeScorers(raw) {
  const map = {};
  const ensure = (name, team) => {
    if (!map[name]) map[name] = { player: name, team, g: 0, a: 0, pts: 0 };
    return map[name];
  };
  (raw || []).forEach(row => {
    if (row.goal_player_name)       { const p = ensure(row.goal_player_name, row.g_team);       p.g++; p.pts++; }
    if (row.assist_primary_name)    { const p = ensure(row.assist_primary_name, row.g_team);    p.a++; p.pts++; }
    if (row.assist_secondary_name)  { const p = ensure(row.assist_secondary_name, row.g_team);  p.a++; p.pts++; }
  });
  return Object.values(map)
    .sort((a,b) => b.pts - a.pts || b.g - a.g || a.player.localeCompare(b.player))
    .slice(0, 10);
}

// ══════════════════════════════════════════════════════════════════════════
export default function StreamOverlay() {
  const [data, setData] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: seasons } = await supabase
        .from('seasons')
        .select('lg')
        .order('year', { ascending: false })
        .limit(1);
      const lg = seasons?.[0]?.lg;
      if (!lg) return;

      const [
        { data: games },
        { data: teams },
        { data: rawScoring },
      ] = await Promise.all([
        supabase.from('games')
          .select('id, home, away, score_home, score_away, ot')
          .eq('lg', lg).ilike('mode', 'season')
          .not('score_home', 'is', null)
          .order('id', { ascending: true }),
        supabase.from('teams').select('abr').eq('lg', lg),
        supabase.from('game_raw_scoring')
          .select('goal_player_name, assist_primary_name, assist_secondary_name, g_team')
          .eq('season', lg).eq('mode', 'season'),
      ]);

      const last10 = [...(games || [])].reverse().slice(0, 10);

      setData({
        season: lg,
        scores: last10,
        standings: computeStandings(games, teams),
        scorers: computeScorers(rawScoring),
      });
    }
    load();
  }, []);

  if (!data) return (
    <div style={{
      width: 480, padding: '2rem', textAlign: 'center',
      fontFamily: "'Press Start 2P', monospace", fontSize: '.6rem',
      color: '#FFD700',
    }}>
      LOADING...
    </div>
  );

  return (
    <div className="ov-root">
      <div className="ov-scanlines" />

      <div className="ov-header">
        <div className="ov-header-left">
          <span className="ov-bolt">⚡</span>
          <span className="ov-logo-text">NHL95 ONLINE</span>
        </div>
        <div className="ov-season-badge">{data.season}</div>
      </div>

      <div className="ov-panels">
        <ScoresPanel   games={data.scores} />
        <Divider label="STANDINGS" />
        <StandingsPanel rows={data.standings} />
        <Divider label="TOP SCORERS" />
        <ScorersPanel  rows={data.scorers} />
      </div>

      <div className="ov-footer">
        <span className="ov-footer-text">WN95HL.COM</span>
        <span className="ov-footer-sep">·</span>
        <span className="ov-footer-text">LIVE STATS</span>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ov-root {
          width: 480px;
          font-family: 'VT323', monospace;
          position: relative;
          background: linear-gradient(170deg, rgba(4,2,14,.97) 0%, rgba(8,6,22,.97) 100%);
          border: 1px solid rgba(255,215,0,.4);
          border-radius: 10px;
          overflow: hidden;
          box-shadow:
            0 0 0 1px rgba(255,140,0,.1),
            0 0 40px rgba(255,140,0,.15),
            0 0 80px rgba(255,215,0,.05),
            inset 0 0 60px rgba(0,0,0,.4);
        }

        .ov-scanlines {
          position: absolute; inset: 0; z-index: 200; pointer-events: none;
          background: repeating-linear-gradient(
            0deg, transparent 0px, transparent 3px,
            rgba(0,0,0,.05) 3px, rgba(0,0,0,.05) 4px
          );
        }

        /* Header */
        .ov-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: .5rem .85rem;
          background: linear-gradient(90deg, rgba(255,140,0,.2) 0%, rgba(255,215,0,.05) 100%);
          border-bottom: 1px solid rgba(255,215,0,.2);
        }
        .ov-header-left { display: flex; align-items: center; gap: 8px; }
        .ov-bolt { font-size: 1rem; filter: drop-shadow(0 0 6px #FF8C00); animation: bpulse 2s ease-in-out infinite; }
        @keyframes bpulse { 0%,100%{filter:drop-shadow(0 0 4px #FF8C00)} 50%{filter:drop-shadow(0 0 10px #FFD700)} }
        .ov-logo-text {
          font-family: 'Press Start 2P', monospace;
          font-size: .52rem; color: #FFD700; letter-spacing: 2px;
          text-shadow: 0 0 10px rgba(255,215,0,.5);
        }
        .ov-season-badge {
          font-family: 'Press Start 2P', monospace; font-size: .38rem;
          color: rgba(135,206,235,.65);
          background: rgba(135,206,235,.07);
          border: 1px solid rgba(135,206,235,.18);
          border-radius: 4px; padding: .18rem .45rem; letter-spacing: 1px;
        }

        /* Section dividers */
        .ov-divider {
          display: flex; align-items: center; gap: 8px;
          padding: .3rem .7rem;
          background: linear-gradient(90deg, rgba(255,140,0,.12) 0%, rgba(255,215,0,.04) 100%);
          border-top: 1px solid rgba(255,215,0,.15);
          border-bottom: 1px solid rgba(255,215,0,.15);
        }
        .ov-divider-label {
          font-family: 'Press Start 2P', monospace; font-size: .38rem;
          color: #FF8C00; letter-spacing: 2px;
          text-shadow: 0 0 6px rgba(255,140,0,.4);
          white-space: nowrap;
        }
        .ov-divider-line {
          flex: 1; height: 1px;
          background: linear-gradient(90deg, rgba(255,140,0,.4), transparent);
        }

        /* Panel */
        .ov-panel { padding: .4rem .7rem; }

        /* Table shared */
        .ov-table { width: 100%; border-collapse: collapse; }
        .ov-th {
          font-family: 'Press Start 2P', monospace; font-size: .3rem;
          color: rgba(255,255,255,.4); padding: .18rem .3rem;
          text-align: center; letter-spacing: .5px;
          border-bottom: 1px solid rgba(255,215,0,.12);
        }
        .ov-th.al { text-align: left; padding-left: .5rem; }
        .ov-tbody tr:nth-child(even) { background: rgba(255,255,255,.025); }
        .ov-td {
          font-family: 'VT323', monospace; font-size: 1.05rem;
          color: #D0D0D0; padding: .07rem .3rem;
          text-align: center;
          border-bottom: 1px solid rgba(255,255,255,.03);
        }
        .ov-td.al { text-align: left; padding-left: .5rem; }

        /* Scores */
        .ov-score-team {
          font-family: 'Press Start 2P', monospace; font-size: .36rem;
          letter-spacing: .5px;
        }
        .ov-score-team.win  { color: #FFD700; text-shadow: 0 0 5px rgba(255,215,0,.4); }
        .ov-score-team.lose { color: rgba(255,255,255,.35); }
        .ov-score-num { font-size: 1.35rem !important; }
        .ov-score-num.win  { color: #FFD700 !important; }
        .ov-score-num.lose { color: rgba(255,255,255,.3) !important; }
        .ov-score-sep { color: rgba(255,255,255,.12) !important; font-size: .9rem !important; }
        .ov-ot {
          font-family: 'Press Start 2P', monospace; font-size: .26rem;
          color: #87CEEB; background: rgba(135,206,235,.1);
          border: 1px solid rgba(135,206,235,.22);
          border-radius: 2px; padding: .06rem .18rem;
          margin-left: 3px; vertical-align: middle;
        }

        /* Standings */
        .ov-rank {
          font-family: 'Press Start 2P', monospace !important;
          font-size: .3rem !important; color: rgba(255,140,0,.65) !important;
          width: 20px;
        }
        .ov-team-cell { text-align: left !important; padding-left: .4rem !important; }
        .ov-team-inner { display: flex; align-items: center; gap: 5px; }
        .ov-logo { width: 16px; height: 16px; object-fit: contain; border-radius: 2px; }
        .ov-code {
          font-family: 'Press Start 2P', monospace; font-size: .3rem;
          color: rgba(255,255,255,.7);
        }
        .ov-pts  { color: #FFD700 !important; font-size: 1.15rem !important; }
        .ov-pos  { color: #00c853 !important; }
        .ov-neg  { color: #ff4444 !important; }
        .ov-cutoff td {
          padding: 0 !important; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,215,0,.45), transparent) !important;
          border: none !important;
        }

        /* Scorers */
        .ov-skr-name { font-size: 1.1rem !important; color: #E8E8E8 !important; }
        .ov-skr-team {
          font-family: 'Press Start 2P', monospace !important;
          font-size: .28rem !important; color: rgba(135,206,235,.55) !important;
        }
        .ov-skr-pts { color: #FFD700 !important; font-size: 1.2rem !important; }
        .ov-skr-g   { color: #87CEEB !important; }
        .ov-skr-a   { color: rgba(255,255,255,.45) !important; }

        /* Footer */
        .ov-footer {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: .28rem .7rem;
          background: rgba(0,0,0,.25);
          border-top: 1px solid rgba(255,215,0,.08);
        }
        .ov-footer-text {
          font-family: 'Press Start 2P', monospace;
          font-size: .28rem; color: rgba(255,255,255,.18); letter-spacing: 1.5px;
        }
        .ov-footer-sep { color: rgba(255,215,0,.25); font-size: .7rem; line-height: 1; }
      `}</style>
    </div>
  );
}

function Divider({ label }) {
  return (
    <div className="ov-divider">
      <span className="ov-divider-label">{label}</span>
      <div className="ov-divider-line" />
    </div>
  );
}

function ScoresPanel({ games }) {
  if (!games.length) return (
    <div className="ov-panel" style={{ color: 'rgba(255,255,255,.2)', fontSize: '.85rem', textAlign: 'center' }}>
      NO GAMES YET
    </div>
  );
  return (
    <div className="ov-panel">
      <table className="ov-table">
        <tbody className="ov-tbody">
          {games.map(g => {
            const hw = g.score_home > g.score_away;
            const aw = g.score_away > g.score_home;
            return (
              <tr key={g.id}>
                <td className="ov-td" style={{ textAlign: 'right' }}>
                  <span className={`ov-score-team ${hw ? 'win' : 'lose'}`}>{g.home}</span>
                </td>
                <td className="ov-td" style={{ width: 26 }}>
                  <span className={`ov-score-num ${hw ? 'win' : 'lose'}`}>{g.score_home}</span>
                </td>
                <td className="ov-score-sep" style={{ width: 10 }}>–</td>
                <td className="ov-td" style={{ width: 26 }}>
                  <span className={`ov-score-num ${aw ? 'win' : 'lose'}`}>{g.score_away}</span>
                </td>
                <td className="ov-td" style={{ textAlign: 'left' }}>
                  <span className={`ov-score-team ${aw ? 'win' : 'lose'}`}>{g.away}</span>
                  {g.ot && <span className="ov-ot">OT</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function StandingsPanel({ rows }) {
  const top = rows.slice(0, 10);
  return (
    <div className="ov-panel">
      <table className="ov-table">
        <thead>
          <tr>
            <th className="ov-th" style={{ width: 20 }}>#</th>
            <th className="ov-th al">TEAM</th>
            <th className="ov-th">GP</th>
            <th className="ov-th">W</th>
            <th className="ov-th">L</th>
            <th className="ov-th">OTL</th>
            <th className="ov-th">PTS</th>
            <th className="ov-th">GD</th>
          </tr>
        </thead>
        <tbody className="ov-tbody">
          {top.map((s, i) => {
            const gd = s.gf - s.ga;
            return (
              <React.Fragment key={s.team}>
                <tr>
                  <td className="ov-td ov-rank">{i + 1}</td>
                  <td className="ov-td ov-team-cell">
                    <div className="ov-team-inner">
                      <img src={`/assets/teamLogos/${s.team}.png`} alt={s.team}
                        className="ov-logo" onError={e => e.target.style.display='none'} />
                      <span className="ov-code">{s.team}</span>
                    </div>
                  </td>
                  <td className="ov-td">{s.gp}</td>
                  <td className="ov-td">{s.w}</td>
                  <td className="ov-td">{s.l}</td>
                  <td className="ov-td">{s.otl}</td>
                  <td className="ov-td ov-pts">{s.pts}</td>
                  <td className={`ov-td ${gd > 0 ? 'ov-pos' : gd < 0 ? 'ov-neg' : ''}`}>
                    {gd > 0 ? '+' : ''}{gd}
                  </td>
                </tr>
                {i === PLAYOFF_TEAMS - 1 && (
                  <tr className="ov-cutoff"><td colSpan={8} /></tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ScorersPanel({ rows }) {
  if (!rows.length) return (
    <div className="ov-panel" style={{ color: 'rgba(255,255,255,.2)', fontSize: '.85rem', textAlign: 'center' }}>
      NO SCORING DATA
    </div>
  );
  return (
    <div className="ov-panel">
      <table className="ov-table">
        <thead>
          <tr>
            <th className="ov-th" style={{ width: 20 }}>#</th>
            <th className="ov-th al">PLAYER</th>
            <th className="ov-th">TEAM</th>
            <th className="ov-th">G</th>
            <th className="ov-th">A</th>
            <th className="ov-th">PTS</th>
          </tr>
        </thead>
        <tbody className="ov-tbody">
          {rows.map((s, i) => (
            <tr key={`${s.player}-${i}`}>
              <td className="ov-td ov-rank">{i + 1}</td>
              <td className="ov-td ov-skr-name al">{s.player}</td>
              <td className="ov-td ov-skr-team">{s.team}</td>
              <td className="ov-td ov-skr-g">{s.g}</td>
              <td className="ov-td ov-skr-a">{s.a}</td>
              <td className="ov-td ov-skr-pts">{s.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
    if (row.goal_player_name)      { const p = ensure(row.goal_player_name, row.g_team);      p.g++; p.pts++; }
    if (row.assist_primary_name)   { const p = ensure(row.assist_primary_name, row.g_team);   p.a++; p.pts++; }
    if (row.assist_secondary_name) { const p = ensure(row.assist_secondary_name, row.g_team); p.a++; p.pts++; }
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

      setData({
        season: lg,
        standings: computeStandings(games, teams),
        scorers: computeScorers(rawScoring),
      });
    }
    load();
  }, []);

  if (!data) return (
    <div className="ov-loading">LOADING...</div>
  );

  return (
    <div className="ov-page">
      <div className="ov-root">
        <div className="ov-scanlines" />

        {/* Header */}
        <div className="ov-header">
          <div className="ov-header-left">
            <span className="ov-bolt">⚡</span>
            <span className="ov-logo-text">NHL95 ONLINE</span>
          </div>
          <div className="ov-season-badge">{data.season}</div>
        </div>

        {/* Standings — all teams */}
        <div className="ov-section-label">STANDINGS</div>
        <StandingsPanel rows={data.standings} />

        {/* Divider */}
        <div className="ov-divider" />

        {/* Top Scorers */}
        <div className="ov-section-label">TOP SCORERS</div>
        <ScorersPanel rows={data.scorers} />

        {/* Footer */}
        <div className="ov-footer">
          <span className="ov-footer-text">WN95HL.COM</span>
          <span className="ov-footer-sep">·</span>
          <span className="ov-footer-text">LIVE STATS</span>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* Full page — push overlay to right */
        .ov-page {
          width: 100vw;
          min-height: 100vh;
          display: flex;
          justify-content: flex-end;
          align-items: flex-start;
          background: transparent;
          padding: 12px;
          font-family: 'VT323', monospace;
        }

        .ov-loading {
          position: fixed; right: 12px; top: 12px;
          font-family: 'Press Start 2P', monospace;
          font-size: .5rem; color: #FFD700;
          background: rgba(0,0,0,.9);
          padding: 1rem; border-radius: 8px;
          border: 1px solid rgba(255,215,0,.3);
        }

        /* ── Root card ── */
        .ov-root {
          width: 320px;
          position: relative;
          background: linear-gradient(170deg, rgba(4,2,14,.96) 0%, rgba(8,6,22,.96) 100%);
          border: 1px solid rgba(255,215,0,.35);
          border-radius: 8px;
          overflow: hidden;
          box-shadow:
            0 0 0 1px rgba(255,140,0,.08),
            0 0 30px rgba(255,140,0,.12),
            inset 0 0 40px rgba(0,0,0,.4);
        }

        /* CRT scanlines */
        .ov-scanlines {
          position: absolute; inset: 0; z-index: 200; pointer-events: none;
          background: repeating-linear-gradient(
            0deg, transparent 0px, transparent 3px,
            rgba(0,0,0,.04) 3px, rgba(0,0,0,.04) 4px
          );
        }

        /* ── Header ── */
        .ov-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: .4rem .6rem;
          background: linear-gradient(90deg, rgba(255,140,0,.18) 0%, rgba(255,215,0,.04) 100%);
          border-bottom: 1px solid rgba(255,215,0,.2);
        }
        .ov-header-left { display: flex; align-items: center; gap: 6px; }
        .ov-bolt {
          font-size: .85rem;
          filter: drop-shadow(0 0 5px #FF8C00);
          animation: bpulse 2s ease-in-out infinite;
        }
        @keyframes bpulse {
          0%,100% { filter: drop-shadow(0 0 3px #FF8C00); }
          50%      { filter: drop-shadow(0 0 8px #FFD700); }
        }
        .ov-logo-text {
          font-family: 'Press Start 2P', monospace;
          font-size: .45rem; color: #FFD700; letter-spacing: 1.5px;
          text-shadow: 0 0 8px rgba(255,215,0,.4);
        }
        .ov-season-badge {
          font-family: 'Press Start 2P', monospace; font-size: .32rem;
          color: rgba(135,206,235,.6);
          background: rgba(135,206,235,.07);
          border: 1px solid rgba(135,206,235,.15);
          border-radius: 3px; padding: .15rem .35rem; letter-spacing: 1px;
        }

        /* ── Section label ── */
        .ov-section-label {
          font-family: 'Press Start 2P', monospace; font-size: .34rem;
          color: #FF8C00; letter-spacing: 2px;
          text-shadow: 0 0 6px rgba(255,140,0,.4);
          padding: .28rem .6rem .15rem;
          background: linear-gradient(90deg, rgba(255,140,0,.1) 0%, transparent 100%);
          border-bottom: 1px solid rgba(255,140,0,.12);
        }

        /* ── Divider ── */
        .ov-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,215,0,.3), transparent);
          margin: .1rem 0;
        }

        /* ── Tables shared ── */
        .ov-table { width: 100%; border-collapse: collapse; }
        .ov-th {
          font-family: 'Press Start 2P', monospace; font-size: .26rem;
          color: rgba(255,255,255,.35); padding: .15rem .25rem;
          text-align: center; letter-spacing: .3px;
          border-bottom: 1px solid rgba(255,215,0,.1);
          background: rgba(0,0,0,.2);
        }
        .ov-th.al { text-align: left; padding-left: .5rem; }
        .ov-tbody tr:nth-child(even) { background: rgba(255,255,255,.02); }
        .ov-td {
          font-family: 'VT323', monospace; font-size: .95rem;
          color: #C8C8C8; padding: .04rem .25rem;
          text-align: center;
          border-bottom: 1px solid rgba(255,255,255,.025);
        }
        .ov-td.al { text-align: left; padding-left: .4rem; }

        /* ── Standings specific ── */
        .ov-rank {
          font-family: 'Press Start 2P', monospace !important;
          font-size: .26rem !important;
          color: rgba(255,140,0,.55) !important;
          width: 16px;
        }
        .ov-team-cell { text-align: left !important; padding-left: .3rem !important; }
        .ov-team-inner { display: flex; align-items: center; gap: 4px; }
        .ov-logo {
          width: 14px; height: 14px; object-fit: contain;
          border-radius: 2px; flex-shrink: 0;
        }
        .ov-code {
          font-family: 'Press Start 2P', monospace; font-size: .26rem;
          color: rgba(255,255,255,.7); letter-spacing: .3px;
        }
        .ov-pts  { color: #FFD700 !important; font-size: 1rem !important; }
        .ov-pos  { color: #00c853 !important; }
        .ov-neg  { color: #ff4444 !important; }
        .ov-cutoff td {
          padding: 0 !important; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,215,0,.4), transparent) !important;
          border: none !important;
        }
        /* Playoff teams slightly brighter */
        .ov-playoff-row .ov-td { color: #E0E0E0 !important; }

        /* ── Scorers specific ── */
        .ov-skr-name { font-size: 1rem !important; color: #E0E0E0 !important; }
        .ov-skr-team {
          font-family: 'Press Start 2P', monospace !important;
          font-size: .24rem !important;
          color: rgba(135,206,235,.5) !important;
        }
        .ov-skr-pts { color: #FFD700 !important; font-size: 1.05rem !important; }
        .ov-skr-g   { color: #87CEEB !important; }
        .ov-skr-a   { color: rgba(255,255,255,.4) !important; }

        /* ── Footer ── */
        .ov-footer {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: .22rem .6rem;
          background: rgba(0,0,0,.2);
          border-top: 1px solid rgba(255,215,0,.07);
        }
        .ov-footer-text {
          font-family: 'Press Start 2P', monospace;
          font-size: .24rem; color: rgba(255,255,255,.15); letter-spacing: 1px;
        }
        .ov-footer-sep { color: rgba(255,215,0,.2); font-size: .6rem; line-height: 1; }
      `}</style>
    </div>
  );
}

// ── Full Standings Panel ──────────────────────────────────────────────────────
function StandingsPanel({ rows }) {
  return (
    <table className="ov-table">
      <thead>
        <tr>
          <th className="ov-th" style={{ width: 16 }}>#</th>
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
        {rows.map((s, i) => {
          const gd = s.gf - s.ga;
          const isPlayoff = i < PLAYOFF_TEAMS;
          return (
            <React.Fragment key={s.team}>
              <tr className={isPlayoff ? 'ov-playoff-row' : ''}>
                <td className="ov-td ov-rank">{i + 1}</td>
                <td className="ov-td ov-team-cell">
                  <div className="ov-team-inner">
                    <img
                      src={`/assets/teamLogos/${s.team}.png`}
                      alt={s.team}
                      className="ov-logo"
                      onError={e => e.target.style.display = 'none'}
                    />
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
  );
}

// ── Top Scorers Panel ─────────────────────────────────────────────────────────
function ScorersPanel({ rows }) {
  if (!rows.length) return (
    <div style={{ color: 'rgba(255,255,255,.2)', fontSize: '.8rem', textAlign: 'center', padding: '.4rem' }}>
      NO SCORING DATA
    </div>
  );
  return (
    <table className="ov-table">
      <thead>
        <tr>
          <th className="ov-th" style={{ width: 16 }}>#</th>
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
  );
}

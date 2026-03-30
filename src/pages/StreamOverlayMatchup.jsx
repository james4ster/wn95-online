import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';

const CURRENT_MODE = 'season';
const PLAYOFF_TEAMS = 8;

// ── Helpers ────────────────────────────────────────────────────────────────
function computeStandings(games, teams) {
  const map = {};
  const ensure = code => {
    if (!map[code]) map[code] = { team: code, gp:0, w:0, l:0, t:0, otl:0, pts:0, gf:0, ga:0, so:0 };
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
      if (sa === 0) h.so++;
    } else {
      if (g.ot) { a.w++; a.pts += 2; h.otl++; h.pts++; }
      else       { a.w++; a.pts += 2; h.l++; }
      if (sh === 0) a.so++;
    }
  });
  (teams || []).forEach(t => {
    if (!map[t.abr]) map[t.abr] = { team: t.abr, gp:0, w:0, l:0, t:0, otl:0, pts:0, gf:0, ga:0, so:0 };
  });
  return Object.values(map).sort((a,b) =>
    b.pts - a.pts || b.w - a.w || (b.gf - b.ga) - (a.gf - a.ga)
  );
}

function computeRosterStats(rawScoring, teamCode) {
  const map = {};
  const ensure = name => {
    if (!map[name]) map[name] = { player: name, g: 0, a: 0, pts: 0 };
    return map[name];
  };
  (rawScoring || []).filter(r => r.g_team === teamCode).forEach(row => {
    if (row.goal_player_name)      { const p = ensure(row.goal_player_name);      p.g++; p.pts++; }
    if (row.assist_primary_name)   { const p = ensure(row.assist_primary_name);   p.a++; p.pts++; }
    if (row.assist_secondary_name) { const p = ensure(row.assist_secondary_name); p.a++; p.pts++; }
  });
  return Object.values(map).sort((a,b) => b.pts - a.pts || b.g - a.g || a.player.localeCompare(b.player));
}

function computeH2H(allGames, teamA, teamB) {
  const matchups = (allGames || []).filter(g =>
    (g.home === teamA && g.away === teamB) || (g.home === teamB && g.away === teamA)
  );
  let aW = 0, bW = 0, ties = 0, aGF = 0, aGA = 0, aSO = 0, bSO = 0;
  matchups.forEach(g => {
    const sh = g.score_home ?? 0, sa = g.score_away ?? 0;
    const hIsA = g.home === teamA;
    const gfA = hIsA ? sh : sa;
    const gaA = hIsA ? sa : sh;
    aGF += gfA; aGA += gaA;
    if (sh === sa) { ties++; }
    else if (gfA > gaA) {
      aW++;
      if (gaA === 0) aSO++;
    } else {
      bW++;
      if (gfA === 0) bSO++;
    }
  });
  const gp = matchups.length;
  return {
    aW, bW, ties, gp,
    aGFpg: gp ? (aGF / gp).toFixed(2) : '—',
    aGApg: gp ? (aGA / gp).toFixed(2) : '—',
    bGFpg: gp ? (aGA / gp).toFixed(2) : '—',
    bGApg: gp ? (aGF / gp).toFixed(2) : '—',
    aSO, bSO,
  };
}

// ══════════════════════════════════════════════════════════════════════════
export default function StreamOverlayMatchup() {
  const [allTeams, setAllTeams]       = useState([]);
  const [currentLg, setCurrentLg]     = useState(null);
  const [pendingA, setPendingA]       = useState('');
  const [pendingB, setPendingB]       = useState('');
  const [matchupData, setMatchupData] = useState(null);
  const [loading, setLoading]         = useState(false);
  const [showPanel, setShowPanel]     = useState(false);

  useEffect(() => {
    async function bootstrap() {
      const { data: seasons } = await supabase
        .from('seasons').select('lg')
        .ilike('lg', 'W%').order('lg', { ascending: false }).limit(1);
      const lg = seasons?.[0]?.lg;
      if (!lg) return;
      setCurrentLg(lg);
      const { data: teams } = await supabase
        .from('teams').select('abr, team').eq('lg', lg).order('abr');
      setAllTeams(teams || []);
      if (teams?.length >= 2) { setPendingA(teams[0].abr); setPendingB(teams[1].abr); }
    }
    bootstrap();
  }, []);

  useEffect(() => {
    const handler = e => { if (e.key === '`' || e.key === '~') setShowPanel(p => !p); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const loadMatchup = useCallback(async (a, b, lg) => {
    if (!a || !b || !lg || a === b) return;
    setLoading(true); setMatchupData(null);
    const [
      { data: currentGames },
      { data: allGames },
      { data: rawScoring },
      { data: teams },
    ] = await Promise.all([
      supabase.from('games').select('id,home,away,score_home,score_away,ot')
        .eq('lg', lg).ilike('mode', CURRENT_MODE).not('score_home','is',null),
      supabase.from('games').select('home,away,score_home,score_away,ot')
        .ilike('mode', CURRENT_MODE).not('score_home','is',null)
        .or(`and(home.eq.${a},away.eq.${b}),and(home.eq.${b},away.eq.${a})`),
      supabase.from('game_raw_scoring')
        .select('goal_player_name,assist_primary_name,assist_secondary_name,g_team')
        .eq('season', lg).eq('mode', CURRENT_MODE),
      supabase.from('teams').select('abr,team').eq('lg', lg),
    ]);

    const standings = computeStandings(currentGames, teams);
    const rank = code => { const i = standings.findIndex(s => s.team === code); return i === -1 ? null : i + 1; };

    setMatchupData({
      teamA: {
        code: a,
        record: standings.find(s => s.team === a) || { gp:0,w:0,l:0,otl:0,t:0,pts:0,gf:0,ga:0,so:0 },
        rank: rank(a),
        roster: computeRosterStats(rawScoring, a),
      },
      teamB: {
        code: b,
        record: standings.find(s => s.team === b) || { gp:0,w:0,l:0,otl:0,t:0,pts:0,gf:0,ga:0,so:0 },
        rank: rank(b),
        roster: computeRosterStats(rawScoring, b),
      },
      h2h: computeH2H(allGames, a, b),
      standings,
      season: lg,
    });
    setLoading(false);
  }, []);

  const handleApply = () => {
    if (pendingA && pendingB && pendingA !== pendingB) {
      setShowPanel(false);
      loadMatchup(pendingA, pendingB, currentLg);
    }
  };

  const hasMatchup = !!matchupData;

  return (
    <div className="ov-page">

      {/* ── Setup Panel ── */}
      {showPanel && (
        <div className="setup-panel">
          <div className="setup-title">⚡ MATCHUP SETUP</div>
          <div className="setup-note">Press ~ to close</div>
          <div className="setup-row">
            <label className="setup-label">TEAM A</label>
            <select className="setup-select" value={pendingA} onChange={e => setPendingA(e.target.value)}>
              <option value="">-- SELECT --</option>
              {allTeams.map(t => <option key={t.abr} value={t.abr}>{t.abr}{t.team ? ` — ${t.team}` : ''}</option>)}
            </select>
          </div>
          <div className="setup-row">
            <label className="setup-label">TEAM B</label>
            <select className="setup-select" value={pendingB} onChange={e => setPendingB(e.target.value)}>
              <option value="">-- SELECT --</option>
              {allTeams.map(t => <option key={t.abr} value={t.abr}>{t.abr}{t.team ? ` — ${t.team}` : ''}</option>)}
            </select>
          </div>
          {pendingA && pendingB && pendingA === pendingB && <div className="setup-error">Teams must be different</div>}
          <button className="setup-apply" onClick={handleApply} disabled={!pendingA || !pendingB || pendingA === pendingB}>APPLY</button>
        </div>
      )}

      {/* ── Empty ── */}
      {!hasMatchup && !loading && (
        <div className="ov-root ov-empty">
          <div className="ov-scanlines" />
          <div className="ov-header">
            <span className="ov-bolt">⚡</span>
            <span className="ov-logo-text">WN95HL</span>
          </div>
          <div className="empty-msg">
            <div className="empty-title">MATCHUP OVERLAY</div>
            <div className="empty-sub">Press <span className="key">~</span> to select teams</div>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="ov-root ov-empty">
          <div className="ov-scanlines" />
          <div className="loading-pulse">LOADING...</div>
        </div>
      )}

      {/* ── Main Overlay ── */}
      {hasMatchup && !loading && (
        <div className="ov-root">
          <div className="ov-scanlines" />

          {/* Header */}
          <div className="ov-header">
            <div className="ov-header-left">
              <span className="ov-bolt">⚡</span>
              <span className="ov-logo-text">WN95HL</span>
            </div>
            <div className="ov-season-badge">{matchupData.season}</div>
          </div>

          {/* H2H Hero */}
          <H2HHero h2h={matchupData.h2h} teamA={matchupData.teamA} teamB={matchupData.teamB} />

          {/* Team A Panel */}
          <TeamPanel team={matchupData.teamA} accentColor="#87CEEB" />

          {/* Team separator */}
          <div className="team-sep">
            <div className="team-sep-line" />
            <span className="team-sep-text">VS</span>
            <div className="team-sep-line" />
          </div>

          {/* Team B Panel */}
          <TeamPanel team={matchupData.teamB} accentColor="#FF8C00" />

          {/* Standings */}
          <div className="section-header">
            <span className="section-header-text">STANDINGS</span>
          </div>
          <StandingsPanel
            rows={matchupData.standings}
            highlightA={matchupData.teamA.code}
            highlightB={matchupData.teamB.code}
          />

          {/* Footer */}
          <div className="ov-footer">
            <span className="ov-footer-text">WN95HL.COM</span>
            <span className="ov-footer-sep">·</span>
            <span className="ov-footer-text">LIVE STATS</span>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323:wght@400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ov-page {
          width: 100vw; min-height: 100vh;
          display: flex; justify-content: flex-end; align-items: flex-start;
          background: transparent; padding: 12px;
          font-family: 'VT323', monospace;
          position: relative;
        }

        /* ── Setup Panel ── */
        .setup-panel {
          position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
          z-index: 999;
          background: linear-gradient(160deg, rgba(4,2,20,.98), rgba(10,6,30,.98));
          border: 1px solid rgba(255,215,0,.5); border-radius: 10px;
          padding: 1.4rem 1.6rem; width: 340px;
          box-shadow: 0 0 40px rgba(255,140,0,.25), 0 0 80px rgba(0,0,0,.8);
        }
        .setup-title {
          font-family: 'Press Start 2P', monospace; font-size: .55rem;
          color: #FFD700; letter-spacing: 2px;
          text-shadow: 0 0 10px rgba(255,215,0,.5); margin-bottom: .25rem;
        }
        .setup-note {
          font-family: 'Press Start 2P', monospace; font-size: .3rem;
          color: rgba(255,255,255,.2); margin-bottom: 1.2rem; letter-spacing: 1px;
        }
        .setup-row { display: flex; flex-direction: column; gap: .4rem; margin-bottom: 1rem; }
        .setup-label {
          font-family: 'Press Start 2P', monospace; font-size: .34rem;
          color: #FF8C00; letter-spacing: 1px;
        }
        .setup-select {
          font-family: 'VT323', monospace; font-size: 1.3rem;
          background: rgba(0,0,0,.6); color: #E0E0E0;
          border: 1px solid rgba(255,215,0,.3); border-radius: 4px;
          padding: .35rem .6rem; width: 100%; outline: none; cursor: pointer;
        }
        .setup-select:focus { border-color: rgba(255,215,0,.7); }
        .setup-error {
          font-family: 'Press Start 2P', monospace; font-size: .3rem;
          color: #ff4444; margin-bottom: .6rem;
        }
        .setup-apply {
          font-family: 'Press Start 2P', monospace; font-size: .42rem;
          letter-spacing: 2px; color: #000;
          background: linear-gradient(135deg, #FFD700, #FF8C00);
          border: none; border-radius: 4px;
          padding: .6rem 1rem; width: 100%;
          cursor: pointer; transition: opacity .15s;
        }
        .setup-apply:hover:not(:disabled) { opacity: .85; }
        .setup-apply:disabled { opacity: .3; cursor: not-allowed; }

        /* ── Root card ── */
        .ov-root {
          width: 380px; position: relative;
          background: linear-gradient(170deg, rgba(4,2,14,.97) 0%, rgba(8,6,22,.97) 100%);
          border: 1px solid rgba(255,215,0,.4); border-radius: 10px;
          overflow: hidden;
          box-shadow:
            0 0 0 1px rgba(255,140,0,.1),
            0 0 40px rgba(255,140,0,.15),
            inset 0 0 60px rgba(0,0,0,.5);
        }
        .ov-empty { width: 280px; }

        .ov-scanlines {
          position: absolute; inset: 0; z-index: 200; pointer-events: none;
          background: repeating-linear-gradient(0deg,
            transparent 0px, transparent 3px,
            rgba(0,0,0,.05) 3px, rgba(0,0,0,.05) 4px);
        }

        /* ── Header ── */
        .ov-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: .5rem .75rem;
          background: linear-gradient(90deg, rgba(255,140,0,.2) 0%, rgba(255,215,0,.05) 100%);
          border-bottom: 1px solid rgba(255,215,0,.25);
        }
        .ov-header-left { display: flex; align-items: center; gap: 8px; }
        .ov-bolt {
          font-size: 1rem;
          filter: drop-shadow(0 0 5px #FF8C00);
          animation: bpulse 2s ease-in-out infinite;
        }
        @keyframes bpulse {
          0%,100% { filter: drop-shadow(0 0 3px #FF8C00); }
          50%      { filter: drop-shadow(0 0 10px #FFD700); }
        }
        .ov-logo-text {
          font-family: 'Press Start 2P', monospace; font-size: .55rem;
          color: #FFD700; letter-spacing: 2px;
          text-shadow: 0 0 10px rgba(255,215,0,.5);
        }
        .ov-season-badge {
          font-family: 'Press Start 2P', monospace; font-size: .38rem;
          color: rgba(135,206,235,.7);
          background: rgba(135,206,235,.08);
          border: 1px solid rgba(135,206,235,.2);
          border-radius: 4px; padding: .18rem .4rem; letter-spacing: 1px;
        }

        /* ── H2H Hero ── */
        .h2h-hero {
          padding: .8rem .75rem .65rem;
          background: rgba(0,0,0,.3);
          border-bottom: 2px solid rgba(255,215,0,.15);
        }
        .h2h-hero-teams {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: .6rem;
        }
        .h2h-team-block {
          display: flex; flex-direction: column; align-items: center; gap: .3rem;
          flex: 1;
        }
        .h2h-logo {
          width: 52px; height: 52px; object-fit: contain;
          filter: drop-shadow(0 0 6px rgba(255,215,0,.25));
        }
        .h2h-team-code {
          font-family: 'Press Start 2P', monospace; font-size: .55rem;
          color: #FFFFFF; letter-spacing: 1px;
        }
        .h2h-team-rank {
          font-family: 'Press Start 2P', monospace; font-size: .32rem;
          color: rgba(255,140,0,.7);
        }
        .h2h-center {
          display: flex; flex-direction: column; align-items: center;
          gap: .15rem; padding: 0 .5rem;
        }
        .h2h-record-row {
          display: flex; align-items: center; gap: .3rem;
        }
        .h2h-wins-num {
          font-family: 'VT323', monospace; font-size: 3.2rem;
          color: #FFD700; line-height: 1;
          text-shadow: 0 0 12px rgba(255,215,0,.5);
        }
        .h2h-dash {
          font-family: 'VT323', monospace; font-size: 2rem;
          color: rgba(255,255,255,.2); line-height: 1;
        }
        .h2h-label-small {
          font-family: 'Press Start 2P', monospace; font-size: .28rem;
          color: rgba(255,140,0,.6); letter-spacing: 2px;
        }
        .h2h-gp-label {
          font-family: 'Press Start 2P', monospace; font-size: .26rem;
          color: rgba(255,255,255,.2); letter-spacing: 1px;
        }
        /* H2H stat grid */
        .h2h-stats-grid {
          display: grid; grid-template-columns: 1fr auto 1fr;
          gap: .2rem .4rem; align-items: center;
        }
        .h2h-stat-val {
          font-family: 'VT323', monospace; font-size: 1.3rem;
          color: #C8D8E8; line-height: 1;
        }
        .h2h-stat-val.left  { text-align: right; }
        .h2h-stat-val.right { text-align: left; }
        .h2h-stat-key {
          font-family: 'Press Start 2P', monospace; font-size: .22rem;
          color: rgba(255,255,255,.25); text-align: center; letter-spacing: .5px;
        }

        /* ── Team Panel ── */
        .team-panel { padding: .5rem 0 .3rem; }
        .team-panel-header {
          display: flex; align-items: center; gap: 10px;
          padding: .3rem .75rem .4rem;
          border-bottom: 1px solid rgba(255,255,255,.06);
        }
        .team-panel-logo {
          width: 32px; height: 32px; object-fit: contain;
          filter: drop-shadow(0 0 4px rgba(255,215,0,.2));
        }
        .team-panel-code {
          font-family: 'Press Start 2P', monospace; font-size: .6rem;
          color: #FFFFFF; letter-spacing: 1px; flex: 1;
        }
        .team-panel-rank {
          font-family: 'Press Start 2P', monospace; font-size: .38rem;
          color: rgba(255,140,0,.8);
          background: rgba(255,140,0,.1);
          border: 1px solid rgba(255,140,0,.2);
          border-radius: 4px; padding: .12rem .3rem;
        }

        /* Record bar */
        .record-bar {
          display: flex; align-items: stretch;
          border-top: 1px solid rgba(255,255,255,.04);
          border-bottom: 1px solid rgba(255,255,255,.04);
          background: rgba(0,0,0,.2);
          margin-bottom: .3rem;
        }
        .record-cell {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: .3rem .1rem;
          border-right: 1px solid rgba(255,255,255,.04);
        }
        .record-cell:last-child { border-right: none; }
        .record-cell-val {
          font-family: 'VT323', monospace; font-size: 1.6rem;
          line-height: 1; color: #E8E8E8;
        }
        .record-cell-val.gold { color: #FFD700; }
        .record-cell-val.green { color: #00e676; }
        .record-cell-val.red   { color: #ff5252; }
        .record-cell-key {
          font-family: 'Press Start 2P', monospace; font-size: .22rem;
          color: rgba(255,255,255,.28); letter-spacing: .5px; margin-top: 1px;
        }

        /* Roster table */
        .roster-table { width: 100%; border-collapse: collapse; }
        .roster-th {
          font-family: 'Press Start 2P', monospace; font-size: .28rem;
          color: rgba(255,255,255,.35); padding: .18rem .5rem;
          text-align: center; letter-spacing: .5px;
          background: rgba(0,0,0,.25);
          border-bottom: 1px solid rgba(255,215,0,.1);
        }
        .roster-th.al { text-align: left; }
        .roster-tbody tr { border-bottom: 1px solid rgba(255,255,255,.03); }
        .roster-tbody tr:nth-child(even) { background: rgba(255,255,255,.02); }
        .roster-td {
          font-family: 'VT323', monospace; font-size: 1.25rem;
          color: #C0C8D0; padding: .06rem .5rem;
          text-align: center; line-height: 1.2;
        }
        .roster-td.al  { text-align: left; color: #E0E8F0; }
        .roster-td.pts { color: #FFD700; font-size: 1.3rem; }
        .roster-td.g   { color: #87CEEB; }
        .roster-td.a   { color: rgba(200,210,220,.55); }
        .no-data {
          font-family: 'Press Start 2P', monospace; font-size: .3rem;
          color: rgba(255,255,255,.15); text-align: center; padding: .7rem;
        }

        /* ── VS separator ── */
        .team-sep {
          display: flex; align-items: center; gap: .5rem;
          padding: .3rem .75rem;
          background: rgba(0,0,0,.15);
        }
        .team-sep-line { flex: 1; height: 1px; background: rgba(255,215,0,.2); }
        .team-sep-text {
          font-family: 'Press Start 2P', monospace; font-size: .35rem;
          color: rgba(255,215,0,.4); letter-spacing: 3px;
        }

        /* ── Section header ── */
        .section-header {
          display: flex; align-items: center;
          padding: .35rem .75rem .2rem;
          background: linear-gradient(90deg, rgba(255,140,0,.12) 0%, transparent 100%);
          border-top: 1px solid rgba(255,215,0,.15);
          border-bottom: 1px solid rgba(255,140,0,.1);
        }
        .section-header-text {
          font-family: 'Press Start 2P', monospace; font-size: .36rem;
          color: #FF8C00; letter-spacing: 2px;
          text-shadow: 0 0 6px rgba(255,140,0,.4);
        }

        /* ── Standings ── */
        .standings-table { width: 100%; border-collapse: collapse; }
        .std-th {
          font-family: 'Press Start 2P', monospace; font-size: .25rem;
          color: rgba(255,255,255,.3); padding: .15rem .4rem;
          text-align: center; letter-spacing: .3px;
          background: rgba(0,0,0,.2);
          border-bottom: 1px solid rgba(255,215,0,.08);
        }
        .std-th.al { text-align: left; }
        .std-tbody tr { border-bottom: 1px solid rgba(255,255,255,.025); }
        .std-tbody tr:nth-child(even) { background: rgba(255,255,255,.015); }

        /* highlighted playing teams */
        .std-row-highlight-a { background: rgba(135,206,235,.08) !important; }
        .std-row-highlight-b { background: rgba(255,140,0,.08) !important; }

        .std-td {
          font-family: 'VT323', monospace; font-size: 1.1rem;
          color: #B8C0C8; padding: .04rem .4rem;
          text-align: center; line-height: 1.2;
        }
        .std-td.al { text-align: left; }
        .std-rank {
          font-family: 'Press Start 2P', monospace !important;
          font-size: .24rem !important; color: rgba(255,140,0,.5) !important;
        }
        .std-team-cell { display: flex; align-items: center; gap: 5px; }
        .std-logo {
          width: 14px; height: 14px; object-fit: contain; flex-shrink: 0;
        }
        .std-code {
          font-family: 'Press Start 2P', monospace; font-size: .27rem;
          color: rgba(255,255,255,.75);
        }
        .std-code.highlight-a { color: #87CEEB; }
        .std-code.highlight-b { color: #FF8C00; }
        .std-pts  { color: #FFD700 !important; font-size: 1.15rem !important; }
        .std-pos  { color: #00e676 !important; }
        .std-neg  { color: #ff5252 !important; }
        .std-cutoff td {
          padding: 0 !important; height: 2px !important;
          background: linear-gradient(90deg, transparent, rgba(255,215,0,.35), transparent) !important;
          border: none !important;
        }
        .std-playoff .std-td { color: #D8E0E8 !important; }

        /* ── Footer ── */
        .ov-footer {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: .28rem .75rem;
          background: rgba(0,0,0,.25);
          border-top: 1px solid rgba(255,215,0,.08);
        }
        .ov-footer-text {
          font-family: 'Press Start 2P', monospace;
          font-size: .26rem; color: rgba(255,255,255,.14); letter-spacing: 1px;
        }
        .ov-footer-sep { color: rgba(255,215,0,.2); font-size: .7rem; line-height: 1; }

        /* ── Empty / Loading ── */
        .empty-msg { padding: 1.8rem .75rem; text-align: center; }
        .empty-title {
          font-family: 'Press Start 2P', monospace; font-size: .5rem;
          color: rgba(255,215,0,.4); letter-spacing: 2px; margin-bottom: .8rem;
        }
        .empty-sub {
          font-family: 'VT323', monospace; font-size: 1.2rem;
          color: rgba(255,255,255,.25);
        }
        .key {
          font-family: 'Press Start 2P', monospace; font-size: .7rem;
          color: #FF8C00;
        }
        .loading-pulse {
          font-family: 'Press Start 2P', monospace; font-size: .45rem;
          color: #FFD700; text-align: center; padding: 1.8rem;
          animation: bpulse 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// ── H2H Hero ──────────────────────────────────────────────────────────────────
function H2HHero({ h2h, teamA, teamB }) {
  return (
    <div className="h2h-hero">
      {/* Logos + big win numbers */}
      <div className="h2h-hero-teams">
        <div className="h2h-team-block">
          <img src={`/assets/teamLogos/${teamA.code}.png`} alt={teamA.code} className="h2h-logo"
            onError={e => e.target.style.display='none'} />
          <span className="h2h-team-code">{teamA.code}</span>
          {teamA.rank && <span className="h2h-team-rank">#{teamA.rank} IN LEAGUE</span>}
        </div>

        <div className="h2h-center">
          <span className="h2h-label-small">ALL-TIME H2H</span>
          <div className="h2h-record-row">
            <span className="h2h-wins-num">{h2h.aW}</span>
            <span className="h2h-dash">–</span>
            <span className="h2h-wins-num">{h2h.bW}</span>
          </div>
          {h2h.ties > 0 && <span className="h2h-gp-label">T: {h2h.ties}</span>}
          <span className="h2h-gp-label">{h2h.gp} GP PLAYED</span>
        </div>

        <div className="h2h-team-block">
          <img src={`/assets/teamLogos/${teamB.code}.png`} alt={teamB.code} className="h2h-logo"
            onError={e => e.target.style.display='none'} />
          <span className="h2h-team-code">{teamB.code}</span>
          {teamB.rank && <span className="h2h-team-rank">#{teamB.rank} IN LEAGUE</span>}
        </div>
      </div>

      {/* H2H stat grid: GF/g, GA/g, SO */}
      {h2h.gp > 0 && (
        <div className="h2h-stats-grid">
          <span className="h2h-stat-val left">{h2h.aGFpg}</span>
          <span className="h2h-stat-key">GF/GP</span>
          <span className="h2h-stat-val right">{h2h.bGFpg}</span>

          <span className="h2h-stat-val left">{h2h.aGApg}</span>
          <span className="h2h-stat-key">GA/GP</span>
          <span className="h2h-stat-val right">{h2h.bGApg}</span>

          <span className="h2h-stat-val left">{h2h.aSO}</span>
          <span className="h2h-stat-key">SO</span>
          <span className="h2h-stat-val right">{h2h.bSO}</span>
        </div>
      )}
    </div>
  );
}

// ── Team Panel ────────────────────────────────────────────────────────────────
function TeamPanel({ team }) {
  const { code, record, rank, roster } = team;
  const gd = record.gf - record.ga;

  return (
    <div className="team-panel">
      {/* Header: logo + code + rank */}
      <div className="team-panel-header">
        <img src={`/assets/teamLogos/${code}.png`} alt={code} className="team-panel-logo"
          onError={e => e.target.style.display='none'} />
        <span className="team-panel-code">{code}</span>
        {rank && <span className="team-panel-rank">#{rank}</span>}
      </div>

      {/* Record bar */}
      <div className="record-bar">
        {[
          { key:'GP',  val: record.gp,  cls:'' },
          { key:'W',   val: record.w,   cls:'' },
          { key:'L',   val: record.l,   cls:'' },
          { key:'OTL', val: record.otl, cls:'' },
          { key:'PTS', val: record.pts, cls:'gold' },
          { key:'SO',  val: record.so,  cls:'' },
          { key:'GD',  val: (gd>0?'+':'')+gd, cls: gd>0?'green':gd<0?'red':'' },
        ].map(({ key, val, cls }) => (
          <div className="record-cell" key={key}>
            <span className={`record-cell-val ${cls}`}>{val}</span>
            <span className="record-cell-key">{key}</span>
          </div>
        ))}
      </div>

      {/* Roster */}
      {roster.length === 0 ? (
        <div className="no-data">NO STATS YET</div>
      ) : (
        <table className="roster-table">
          <thead>
            <tr>
              <th className="roster-th al">PLAYER</th>
              <th className="roster-th">G</th>
              <th className="roster-th">A</th>
              <th className="roster-th">PTS</th>
            </tr>
          </thead>
          <tbody className="roster-tbody">
            {roster.map((p, i) => (
              <tr key={`${p.player}-${i}`}>
                <td className="roster-td al">{p.player}</td>
                <td className="roster-td g">{p.g}</td>
                <td className="roster-td a">{p.a}</td>
                <td className="roster-td pts">{p.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Standings Panel ───────────────────────────────────────────────────────────
function StandingsPanel({ rows, highlightA, highlightB }) {
  return (
    <table className="standings-table">
      <thead>
        <tr>
          <th className="std-th" style={{ width: 20 }}>#</th>
          <th className="std-th al">TEAM</th>
          <th className="std-th">GP</th>
          <th className="std-th">W</th>
          <th className="std-th">L</th>
          <th className="std-th">OTL</th>
          <th className="std-th">PTS</th>
          <th className="std-th">GD</th>
        </tr>
      </thead>
      <tbody className="std-tbody">
        {rows.map((s, i) => {
          const gd = s.gf - s.ga;
          const isA = s.team === highlightA;
          const isB = s.team === highlightB;
          const isPlayoff = i < PLAYOFF_TEAMS;
          let rowClass = isPlayoff ? 'std-playoff' : '';
          if (isA) rowClass += ' std-row-highlight-a';
          if (isB) rowClass += ' std-row-highlight-b';
          return (
            <React.Fragment key={s.team}>
              <tr className={rowClass.trim()}>
                <td className="std-td std-rank">{i + 1}</td>
                <td className="std-td al">
                  <div className="std-team-cell">
                    <img src={`/assets/teamLogos/${s.team}.png`} alt={s.team} className="std-logo"
                      onError={e => e.target.style.display='none'} />
                    <span className={`std-code${isA?' highlight-a':isB?' highlight-b':''}`}>{s.team}</span>
                  </div>
                </td>
                <td className="std-td">{s.gp}</td>
                <td className="std-td">{s.w}</td>
                <td className="std-td">{s.l}</td>
                <td className="std-td">{s.otl}</td>
                <td className="std-td std-pts">{s.pts}</td>
                <td className={`std-td ${gd>0?'std-pos':gd<0?'std-neg':''}`}>{gd>0?'+':''}{gd}</td>
              </tr>
              {i === PLAYOFF_TEAMS - 1 && (
                <tr className="std-cutoff"><td colSpan={8} /></tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

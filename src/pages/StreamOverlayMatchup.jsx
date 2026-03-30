/* This is a Prod ready version that keeps current react theme - prior to trying totally different layout */

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';

const CURRENT_MODE = 'season';
const PLAYOFF_TEAMS = 16;

// ── Helpers ────────────────────────────────────────────────────────────────
const norm = s => (s || '').trim().toLowerCase();

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

const lastName = name => {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
};

function computeRosterStats(rawScoring, teamCode) {
  const map = {};
  const ensure = name => {
    const key = lastName(name);
    if (!map[key]) map[key] = { player: key, g: 0, a: 0, pts: 0 };
    return map[key];
  };
  (rawScoring || []).filter(r => r.g_team === teamCode).forEach(row => {
    if (row.goal_player_name)      { const p = ensure(row.goal_player_name);      p.g++; p.pts++; }
    if (row.assist_primary_name)   { const p = ensure(row.assist_primary_name);   p.a++; p.pts++; }
    if (row.assist_secondary_name) { const p = ensure(row.assist_secondary_name); p.a++; p.pts++; }
  });
  return Object.values(map).sort((a,b) => b.pts - a.pts || b.g - a.g || a.player.localeCompare(b.player));
}

// Manager-based H2H — matches on coach_home/coach_away so renamed teams still count
function computeH2H(allGames, mgrANorm, mgrBNorm) {
  const matchups = (allGames || []).filter(g => {
    const h = norm(g.coach_home || '');
    const a = norm(g.coach_away || '');
    return (h === mgrANorm && a === mgrBNorm) || (h === mgrBNorm && a === mgrANorm);
  });

  let aW = 0, bW = 0, ties = 0, aGF = 0, aGA = 0, aSO = 0, bSO = 0;
  matchups.forEach(g => {
    const sh = Number(g.score_home ?? 0), sa = Number(g.score_away ?? 0);
    const hIsA = norm(g.coach_home || '') === mgrANorm;
    const gfA = hIsA ? sh : sa;
    const gaA = hIsA ? sa : sh;
    aGF += gfA; aGA += gaA;
    if (sh === sa) {
      ties++;
    } else if (gfA > gaA) {
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
        .from('teams').select('abr,team,coach').eq('lg', lg).order('abr');
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
      { data: teams },
      { data: rawScoring },
    ] = await Promise.all([
      supabase.from('games')
        .select('id,home,away,score_home,score_away,ot,coach_home,coach_away')
        .eq('lg', lg).ilike('mode', CURRENT_MODE).not('score_home','is',null),
      supabase.from('teams').select('abr,team,coach').eq('lg', lg),
      supabase.from('game_raw_scoring')
        .select('goal_player_name,assist_primary_name,assist_secondary_name,g_team')
        .eq('season', lg).eq('mode', CURRENT_MODE),
    ]);

    const standings = computeStandings(currentGames, teams);
    const rank = code => { const i = standings.findIndex(s => s.team === code); return i === -1 ? null : i + 1; };

    // Resolve current coaches for the two selected teams
    const teamAInfo = (teams || []).find(t => t.abr === a);
    const teamBInfo = (teams || []).find(t => t.abr === b);
    const coachANorm = norm(teamAInfo?.coach || '');
    const coachBNorm = norm(teamBInfo?.coach || '');

    // Fetch all-time W-league season games across all seasons for manager H2H
    const { data: historicalGames } = await supabase
      .from('games')
      .select('score_home,score_away,ot,coach_home,coach_away')
      .ilike('lg', 'W%')
      .ilike('mode', CURRENT_MODE)
      .not('score_home','is',null);

    setMatchupData({
      teamA: {
        code: a,
        coach: teamAInfo?.coach || a,
        coachNorm: coachANorm,
        rank: rank(a),
        roster: computeRosterStats(rawScoring, a),
      },
      teamB: {
        code: b,
        coach: teamBInfo?.coach || b,
        coachNorm: coachBNorm,
        rank: rank(b),
        roster: computeRosterStats(rawScoring, b),
      },
      h2h: computeH2H(historicalGames || [], coachANorm || norm(a), coachBNorm || norm(b)),
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
            <CustomSelect
              value={pendingA}
              onChange={setPendingA}
              options={allTeams.map(t => ({ value: t.abr, label: `${t.abr}${t.team ? ` — ${t.team}` : ''}` }))}
              placeholder="-- SELECT --"
            />
          </div>
          <div className="setup-row">
            <label className="setup-label">TEAM B</label>
            <CustomSelect
              value={pendingB}
              onChange={setPendingB}
              options={allTeams.map(t => ({ value: t.abr, label: `${t.abr}${t.team ? ` — ${t.team}` : ''}` }))}
              placeholder="-- SELECT --"
            />
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

      {/* ── Main Overlay — two separate fixed panels ── */}
      {hasMatchup && !loading && (
        <>
          {/* PANEL LEFT: Standings */}
          <div className="ov-panel ov-panel-left">
            <div className="ov-scanlines" />
            <div className="ov-header">
              <div className="ov-header-left">
                <span className="ov-bolt">⚡</span>
                <span className="ov-logo-text">WN95HL</span>
              </div>
              <div className="ov-season-badge">{matchupData.season}</div>
            </div>
            <div className="panel-section-header">
              <span className="panel-section-text">STANDINGS</span>
            </div>
            <StandingsPanel
              rows={matchupData.standings}
              highlightA={matchupData.teamA.code}
              highlightB={matchupData.teamB.code}
            />
            <div className="ov-footer">
              <span className="ov-footer-text">WN95HL.COM · LIVE STATS</span>
            </div>
          </div>

          {/* PANEL RIGHT: H2H + Teams stacked */}
          <div className="ov-panel ov-panel-right">
            <div className="ov-scanlines" />
            <H2HHero h2h={matchupData.h2h} teamA={matchupData.teamA} teamB={matchupData.teamB} />
            <TeamPanel team={matchupData.teamA} />
            <div className="team-sep">
              <div className="team-sep-line" />
              <span className="team-sep-text">VS</span>
              <div className="team-sep-line" />
            </div>
            <TeamPanel team={matchupData.teamB} />
          </div>
        </>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323:wght@400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ov-page {
          width: 100vw; min-height: 100vh;
          background: transparent;
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
        /* ── Custom dropdown (replaces native select for Streamlabs compat) ── */
        .csel { position: relative; width: 100%; user-select: none; }
        .csel-trigger {
          font-family: 'VT323', monospace; font-size: 1.3rem;
          background: rgba(0,0,0,.6); color: #E0E0E0;
          border: 1px solid rgba(255,215,0,.3); border-radius: 4px;
          padding: .3rem .6rem; width: 100%; cursor: pointer;
          display: flex; align-items: center; justify-content: space-between; gap: .4rem;
        }
        .csel-trigger:hover { border-color: rgba(255,215,0,.6); }
        .csel-trigger.open  { border-color: rgba(255,215,0,.8); border-bottom-left-radius: 0; border-bottom-right-radius: 0; }
        .csel-arrow { font-size: .9rem; color: rgba(255,215,0,.6); flex-shrink: 0; line-height: 1; }
        .csel-placeholder { color: rgba(255,255,255,.3); }
        .csel-list {
          position: absolute; top: 100%; left: 0; right: 0; z-index: 1000;
          background: rgba(8,4,24,.98);
          border: 1px solid rgba(255,215,0,.5); border-top: none;
          border-bottom-left-radius: 4px; border-bottom-right-radius: 4px;
          max-height: 220px; overflow-y: auto;
          box-shadow: 0 8px 24px rgba(0,0,0,.8);
        }
        .csel-list::-webkit-scrollbar { width: 4px; }
        .csel-list::-webkit-scrollbar-track { background: rgba(0,0,0,.3); }
        .csel-list::-webkit-scrollbar-thumb { background: rgba(255,215,0,.3); border-radius: 2px; }
        .csel-option {
          font-family: 'VT323', monospace; font-size: 1.2rem;
          color: #D0D8E0; padding: .25rem .6rem; cursor: pointer;
          border-bottom: 1px solid rgba(255,255,255,.04);
        }
        .csel-option:hover   { background: rgba(255,215,0,.12); color: #FFD700; }
        .csel-option.selected { background: rgba(255,140,0,.18); color: #FF8C00; }
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

        /* ── Shared panel card ── */
        .ov-panel {
          position: fixed; top: 12px;
          background: linear-gradient(170deg, rgba(4,2,14,.97) 0%, rgba(8,6,22,.97) 100%);
          border: 1px solid rgba(255,215,0,.4); border-radius: 10px;
          overflow: hidden;
          box-shadow:
            0 0 0 1px rgba(255,140,0,.1),
            0 0 30px rgba(255,140,0,.12),
            inset 0 0 60px rgba(0,0,0,.5);
        }
        .ov-panel-left { left: 12px; width: 130px; display: flex; flex-direction: column; }
        .ov-panel-right { right: 12px; width: 220px; }

        /* Empty/loading */
        .ov-root {
          position: relative;
          background: linear-gradient(170deg, rgba(4,2,14,.97) 0%, rgba(8,6,22,.97) 100%);
          border: 1px solid rgba(255,215,0,.4); border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 0 0 1px rgba(255,140,0,.1), 0 0 30px rgba(255,140,0,.12);
        }
        .ov-empty { width: 260px; position: fixed; top: 12px; right: 12px; }

        .ov-scanlines {
          position: absolute; inset: 0; z-index: 200; pointer-events: none;
          background: repeating-linear-gradient(0deg,
            transparent 0px, transparent 3px,
            rgba(0,0,0,.05) 3px, rgba(0,0,0,.05) 4px);
        }

        /* ── Header ── */
        .ov-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: .4rem .55rem;
          background: linear-gradient(90deg, rgba(255,140,0,.2) 0%, rgba(255,215,0,.05) 100%);
          border-bottom: 1px solid rgba(255,215,0,.25);
        }
        .ov-header-left { display: flex; align-items: center; gap: 5px; }
        .ov-bolt {
          font-size: .85rem;
          filter: drop-shadow(0 0 5px #FF8C00);
          animation: bpulse 2s ease-in-out infinite;
        }
        @keyframes bpulse {
          0%,100% { filter: drop-shadow(0 0 3px #FF8C00); }
          50%      { filter: drop-shadow(0 0 10px #FFD700); }
        }
        .ov-logo-text {
          font-family: 'Press Start 2P', monospace; font-size: .44rem;
          color: #FFD700; letter-spacing: 2px;
          text-shadow: 0 0 10px rgba(255,215,0,.5);
        }
        .ov-season-badge {
          font-family: 'Press Start 2P', monospace; font-size: .3rem;
          color: rgba(135,206,235,.85);
          background: rgba(135,206,235,.1);
          border: 1px solid rgba(135,206,235,.3);
          border-radius: 3px; padding: .12rem .3rem; letter-spacing: 1px;
        }

        /* ── Section header ── */
        .panel-section-header {
          padding: .26rem .5rem .2rem;
          background: linear-gradient(90deg, rgba(255,140,0,.18) 0%, transparent 100%);
          border-bottom: 1px solid rgba(255,140,0,.2);
        }
        .panel-section-text {
          font-family: 'Press Start 2P', monospace; font-size: .36rem;
          color: #FF8C00; letter-spacing: 2px;
          text-shadow: 0 0 6px rgba(255,140,0,.4);
        }

        /* ── H2H Hero ── */
        .h2h-hero {
          padding: .55rem .55rem .45rem;
          background: rgba(0,0,0,.3);
          border-bottom: 2px solid rgba(255,215,0,.15);
        }
        .h2h-hero-teams {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: .4rem;
        }
        .h2h-team-block {
          display: flex; flex-direction: column; align-items: center; gap: .18rem; flex: 1;
        }
        .h2h-logo {
          width: 48px; height: 48px; object-fit: contain;
          filter: drop-shadow(0 0 6px rgba(255,215,0,.3));
        }

        .h2h-center {
          display: flex; flex-direction: column; align-items: center;
          gap: .06rem; padding: 0 .3rem;
        }
        .h2h-record-row { display: flex; align-items: center; gap: .18rem; }
        .h2h-wins-num {
          font-family: 'VT323', monospace; font-size: 2.4rem;
          color: #FFD700; line-height: 1;
          text-shadow: 0 0 12px rgba(255,215,0,.5);
        }
        .h2h-dash {
          font-family: 'VT323', monospace; font-size: 1.5rem;
          color: rgba(255,255,255,.2); line-height: 1;
        }
        .h2h-label-small {
          font-family: 'Press Start 2P', monospace; font-size: .24rem;
          color: rgba(255,140,0,.7); letter-spacing: 2px;
        }
        .h2h-gp-label {
          font-family: 'Press Start 2P', monospace; font-size: .22rem;
          color: rgba(255,255,255,.25); letter-spacing: 1px;
        }
        .h2h-stats-grid {
          display: grid; grid-template-columns: 1fr auto 1fr;
          gap: .1rem .28rem; align-items: center;
        }
        .h2h-stat-val.left  { text-align: right; }
        .h2h-stat-val.right { text-align: left; }
        .h2h-stat-key {
            font-family: 'Press Start 2P', monospace; font-size: .24rem;
            color: rgba(255,255,255,.85); text-align: center;
          }
          .h2h-stat-val {
            font-family: 'VT323', monospace; font-size: 1.25rem;
            color: #E8F0F8; line-height: 1;
          }

        /* ── VS separator (horizontal, between stacked team panels) ── */
        .team-sep {
          display: flex; align-items: center; gap: .4rem;
          padding: .18rem .55rem;
          background: rgba(0,0,0,.15);
        }
        .team-sep-line { flex: 1; height: 1px; background: rgba(255,215,0,.2); }
        .team-sep-text {
          font-family: 'Press Start 2P', monospace; font-size: .3rem;
          color: rgba(255,215,0,.4); letter-spacing: 3px;
        }

        /* ── Team Panel ── */
        .team-panel { display: flex; flex-direction: column; }
        .team-panel-header {
          display: flex; align-items: center; gap: 5px;
          padding: .22rem .45rem;
          border-bottom: 1px solid rgba(255,255,255,.06);
          background: rgba(0,0,0,.15);
        }
        .team-panel-logo {
          width: 20px; height: 20px; object-fit: contain;
          filter: drop-shadow(0 0 3px rgba(255,215,0,.2));
        }
        .team-panel-code {
          font-family: 'Press Start 2P', monospace; font-size: .44rem;
          color: #FFFFFF; letter-spacing: 1px; flex: 1;
        }
        .team-panel-rank {
          font-family: 'Press Start 2P', monospace; font-size: .34rem;
          color: rgba(255,140,0,.95);
          background: rgba(255,140,0,.15);
          border: 1px solid rgba(255,140,0,.4);
          border-radius: 3px; padding: .08rem .22rem;
        }

        /* Roster table */
        .roster-table { width: 100%; border-collapse: collapse; }
        .roster-th {
            font-family: 'Press Start 2P', monospace; font-size: .28rem;
            color: rgba(255,255,255,.5); padding: .12rem .3rem;
            text-align: center;
            background: rgba(0,0,0,.22);
            border-bottom: 1px solid rgba(255,215,0,.08);
          }
        .roster-th.al { text-align: left; }
        .roster-tbody tr { border-bottom: 1px solid rgba(255,255,255,.022); }
        .roster-tbody tr:nth-child(even) { background: rgba(255,255,255,.016); }
        .roster-td {
            font-family: 'VT323', monospace; font-size: 1.1rem;
            color: #C0C8D0; padding: .02rem .3rem;
            text-align: center; line-height: 1.12;
          }
         
        .roster-td.al  { text-align: left; color: #DDE5EE; }
        .roster-td.pts { color: #FFD700; font-size: 1.15rem; }
        .roster-td.g   { color: #87CEEB; }
        .roster-td.a   { color: rgba(200,210,220,.5); }
        .no-data {
          font-family: 'Press Start 2P', monospace; font-size: .26rem;
          color: rgba(255,255,255,.14); text-align: center; padding: .5rem;
        }

        /* ── Standings ── */
        .standings-table { width: 100%; border-collapse: collapse; }
        .std-th {
            font-family: 'Press Start 2P', monospace; font-size: .28rem;
            color: rgba(255,255,255,.36); padding: .14rem .08rem;
            text-align: center;
            background: rgba(0,0,0,.2);
            border-bottom: 1px solid rgba(255,215,0,.08);
          }
        .std-tbody tr { border-bottom: 1px solid rgba(255,255,255,.02); }

        /* ── BRIGHT highlight rows — yellow border all sides ── */
        .std-row-highlight-a {
          background: rgba(135,206,235,.25) !important;
          box-shadow:
            inset 0 1px 0 #FFD700,
            inset 0 -1px 0 #FFD700,
            inset 3px 0 0 #87CEEB,
            inset -3px 0 0 #87CEEB;
        }
        .std-row-highlight-b {
          background: rgba(255,140,0,.25) !important;
          box-shadow:
            inset 0 1px 0 #FFD700,
            inset 0 -1px 0 #FFD700,
            inset 3px 0 0 #FF8C00,
            inset -3px 0 0 #FF8C00;
        }

        .std-td {
            font-family: 'VT323', monospace; font-size: 1.25rem;
            color: #A8B8C0; padding: .04rem .1rem;
            text-align: center; line-height: 1.15;
          }
        .std-rank {
            font-family: 'Press Start 2P', monospace !important;
            font-size: .3rem !important; color: rgba(255,140,0,.7) !important;
          }
        /* Logo-only team cell */
        .std-logo {
          width: 16px; height: 16px; object-fit: contain;
          display: block; margin: 0 auto;
          vertical-align: middle;
        }
        .std-logo.logo-highlight-a {
          filter: drop-shadow(0 0 4px #87CEEB) drop-shadow(0 0 2px rgba(135,206,235,.8));
        }
        .std-logo.logo-highlight-b {
          filter: drop-shadow(0 0 4px #FF8C00) drop-shadow(0 0 2px rgba(255,140,0,.8));
        }
        .std-pts { color: #FFD700 !important; font-size: 1.28rem !important; }
        .std-cutoff td {
          padding: 0 !important; height: 2px !important;
          background: linear-gradient(90deg, transparent, rgba(255,215,0,.4), transparent) !important;
          border: none !important;
        }
        .std-playoff .std-td { color: #CCD8E0 !important; }

        /* ── Footer ── */
        .ov-footer {
          display: flex; align-items: center; justify-content: center;
          padding: .2rem .5rem;
          background: rgba(0,0,0,.25);
          border-top: 1px solid rgba(255,215,0,.08);
          margin-top: auto;
        }
        .ov-footer-text {
          font-family: 'Press Start 2P', monospace;
          font-size: .2rem; color: rgba(255,255,255,.14); letter-spacing: 1px;
        }

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
          font-family: 'Press Start 2P', monospace; font-size: .7rem; color: #FF8C00;
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
      <div className="h2h-hero-teams">
        <div className="h2h-team-block">
          <img src={`/assets/teamLogos/${teamA.code}.png`} alt={teamA.code} className="h2h-logo"
            onError={e => e.target.style.display='none'} />
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
        </div>
      </div>
      {h2h.gp > 0 && (
        <div className="h2h-stats-grid">
          <span className="h2h-stat-val left">{h2h.aGFpg}</span>
          <span className="h2h-stat-key">GF/g</span>
          <span className="h2h-stat-val right">{h2h.bGFpg}</span>
          <span className="h2h-stat-val left">{h2h.aGApg}</span>
          <span className="h2h-stat-key">GA/g</span>
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
  const { code, rank, roster } = team;
  return (
    <div className="team-panel">
      <div className="team-panel-header">
        <img src={`/assets/teamLogos/${code}.png`} alt={code} className="team-panel-logo"
          onError={e => e.target.style.display='none'} />
        <span className="team-panel-code">{code}</span>
        {rank && <span className="team-panel-rank">#{rank}</span>}
      </div>
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

// ── Custom Select (div-based, fully CSS-styleable in Streamlabs) ──────────────
function CustomSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value);

  return (
    <div className="csel" ref={ref}>
      <div
        className={`csel-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        <span className={selected ? '' : 'csel-placeholder'}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="csel-arrow">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="csel-list">
          {options.map(o => (
            <div
              key={o.value}
              className={`csel-option${o.value === value ? ' selected' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              {o.label}
            </div>
          ))}
        </div>
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
        <th className="std-th" style={{ width: 12 }}>#</th>
        <th className="std-th" style={{ width: 22 }}></th>
        <th className="std-th">W</th>
        <th className="std-th">L</th>
        <th className="std-th">PTS</th>
        </tr>
      </thead>
      <tbody className="std-tbody">
        {rows.map((s, i) => {
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
                <td className="std-td">
                  <img src={`/assets/teamLogos/${s.team}.png`} alt={s.team}
                    className={`std-logo${isA?' logo-highlight-a':isB?' logo-highlight-b':''}`}
                    onError={e => e.target.style.display='none'} />
                </td>
                <td className="std-td">{s.w}</td>
                <td className="std-td">{s.l}</td>
                <td className="std-td std-pts">{s.pts}</td>
              </tr>
              {i === PLAYOFF_TEAMS - 1 && (
                <tr className="std-cutoff"><td colSpan={5} /></tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}

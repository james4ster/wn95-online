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

    const teamAInfo = (teams || []).find(t => t.abr === a);
    const teamBInfo = (teams || []).find(t => t.abr === b);
    const coachANorm = norm(teamAInfo?.coach || '');
    const coachBNorm = norm(teamBInfo?.coach || '');

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
          <div className="setup-title">MATCHUP SETUP</div>
          <div className="setup-note">Press ~ to close</div>
          <div className="setup-row">
            <label className="setup-label">TEAM A</label>
            <CustomSelect
              value={pendingA}
              onChange={setPendingA}
              options={allTeams.map(t => ({ value: t.abr, label: `${t.abr}${t.team ? ` — ${t.team}` : ''}` }))}
              placeholder="— SELECT —"
            />
          </div>
          <div className="setup-row">
            <label className="setup-label">TEAM B</label>
            <CustomSelect
              value={pendingB}
              onChange={setPendingB}
              options={allTeams.map(t => ({ value: t.abr, label: `${t.abr}${t.team ? ` — ${t.team}` : ''}` }))}
              placeholder="— SELECT —"
            />
          </div>
          {pendingA && pendingB && pendingA === pendingB && <div className="setup-error">Teams must be different</div>}
          <button className="setup-apply" onClick={handleApply} disabled={!pendingA || !pendingB || pendingA === pendingB}>
            LOAD MATCHUP
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
      {!hasMatchup && !loading && (
        <div className="ov-idle">
          <div className="idle-brand">
            <span className="idle-dot" />
            WN95HL
          </div>
          <div className="idle-hint">Press <kbd>~</kbd> to select teams</div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="ov-idle">
          <div className="idle-brand loading-pulse">LOADING</div>
        </div>
      )}

      {/* ── Main Overlay ── */}
      {hasMatchup && !loading && (
        <>
          {/* LEFT — Standings */}
          <div className="ov-panel ov-panel-left">
            <div className="panel-head">
              <span className="panel-brand">WN95HL</span>
              <span className="panel-season">{matchupData.season}</span>
            </div>
            <div className="panel-rule-label">STANDINGS</div>
            <StandingsPanel
              rows={matchupData.standings}
              highlightA={matchupData.teamA.code}
              highlightB={matchupData.teamB.code}
            />
          </div>

          {/* RIGHT — H2H + Teams */}
          <div className="ov-panel ov-panel-right">
            <div className="panel-head">
              <span className="panel-brand">WN95HL</span>
              <span className="panel-season">{matchupData.season}</span>
            </div>
            <H2HHero h2h={matchupData.h2h} teamA={matchupData.teamA} teamB={matchupData.teamB} />
            <TeamPanel team={matchupData.teamA} side="a" />
            <div className="team-divider">
              <div className="divider-line" />
              <span className="divider-vs">VS</span>
              <div className="divider-line" />
            </div>
            <TeamPanel team={matchupData.teamB} side="b" />
          </div>
        </>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800;900&family=Barlow:wght@400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ───────────────────────────────────────────────
           TOKENS
        ─────────────────────────────────────────────── */
        :root {
          --bg-panel:     #0d1117;
          --bg-raised:    #131920;
          --bg-stripe:    rgba(255,255,255,0.025);
          --border:       rgba(255,255,255,0.08);
          --border-mid:   rgba(255,255,255,0.14);

          --ice:          #7dd3fc;
          --ice-dim:      rgba(125,211,252,0.12);
          --ice-border:   rgba(125,211,252,0.3);

          --amber:        #fbbf24;
          --amber-dim:    rgba(251,191,36,0.1);
          --amber-border: rgba(251,191,36,0.28);

          --text-primary:   #f1f5f9;
          --text-secondary: #94a3b8;
          --text-dim:       #475569;

          --cutoff:       rgba(125,211,252,0.35);

          --font-display: 'Barlow Condensed', sans-serif;
          --font-body:    'Barlow', sans-serif;
        }

        /* ───────────────────────────────────────────────
           PAGE
        ─────────────────────────────────────────────── */
        .ov-page {
          width: 100vw; min-height: 100vh;
          background: transparent;
          font-family: var(--font-body);
          position: relative;
        }

        /* ───────────────────────────────────────────────
           SETUP PANEL
        ─────────────────────────────────────────────── */
        .setup-panel {
          position: fixed; top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          z-index: 999;
          background: var(--bg-panel);
          border: 1px solid var(--border-mid);
          border-top: 2px solid var(--ice);
          border-radius: 6px;
          padding: 24px;
          width: 320px;
          box-shadow: 0 24px 48px rgba(0,0,0,0.7);
        }
        .setup-title {
          font-family: var(--font-display);
          font-size: 14px; font-weight: 800;
          letter-spacing: 3px; color: var(--text-primary);
          margin-bottom: 2px;
        }
        .setup-note {
          font-size: 11px; color: var(--text-dim);
          margin-bottom: 20px;
        }
        .setup-row {
          display: flex; flex-direction: column; gap: 6px;
          margin-bottom: 14px;
        }
        .setup-label {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 2px; color: var(--text-secondary);
        }
        .setup-error {
          font-size: 11px; color: #f87171;
          margin-bottom: 10px;
        }
        .setup-apply {
          font-family: var(--font-display);
          font-size: 13px; font-weight: 800;
          letter-spacing: 2px; color: var(--bg-panel);
          background: var(--ice);
          border: none; border-radius: 4px;
          padding: 10px; width: 100%;
          cursor: pointer; transition: opacity .15s;
        }
        .setup-apply:hover:not(:disabled) { opacity: .85; }
        .setup-apply:disabled { opacity: .3; cursor: not-allowed; }

        /* Custom select */
        .csel { position: relative; width: 100%; user-select: none; }
        .csel-trigger {
          font-family: var(--font-display);
          font-size: 16px; font-weight: 600;
          background: var(--bg-raised); color: var(--text-primary);
          border: 1px solid var(--border-mid);
          border-radius: 4px;
          padding: 8px 10px;
          width: 100%; cursor: pointer;
          display: flex; align-items: center; justify-content: space-between;
        }
        .csel-trigger.open { border-color: var(--ice); }
        .csel-arrow { font-size: 10px; color: var(--text-dim); }
        .csel-placeholder { color: var(--text-dim); }
        .csel-list {
          position: absolute; top: 100%; left: 0; right: 0; z-index: 1000;
          background: var(--bg-panel);
          border: 1px solid var(--ice-border); border-top: none;
          border-radius: 0 0 4px 4px;
          max-height: 200px; overflow-y: auto;
        }
        .csel-option {
          font-family: var(--font-display); font-size: 15px; font-weight: 600;
          color: var(--text-secondary); padding: 7px 10px;
          cursor: pointer;
          border-bottom: 1px solid var(--border);
        }
        .csel-option:hover { background: var(--ice-dim); color: var(--ice); }
        .csel-option.selected { background: var(--ice-dim); color: var(--ice); }

        /* ───────────────────────────────────────────────
           IDLE / LOADING
        ─────────────────────────────────────────────── */
        .ov-idle {
          position: fixed; top: 12px; right: 12px;
          background: var(--bg-panel);
          border: 1px solid var(--border);
          border-top: 2px solid var(--ice);
          border-radius: 6px;
          padding: 14px 18px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .idle-brand {
          display: flex; align-items: center; gap: 8px;
          font-family: var(--font-display);
          font-size: 13px; font-weight: 900;
          letter-spacing: 3px; color: var(--text-primary);
        }
        .idle-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--ice);
          box-shadow: 0 0 8px var(--ice);
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%,100% { opacity: 1; } 50% { opacity: .3; }
        }
        .idle-hint {
          font-size: 12px; color: var(--text-dim);
        }
        .idle-hint kbd {
          font-family: var(--font-display); font-size: 12px;
          color: var(--ice);
          background: var(--ice-dim);
          border: 1px solid var(--ice-border);
          border-radius: 3px; padding: 0 4px;
        }
        .loading-pulse { animation: pulse 0.8s ease-in-out infinite; }

        /* ───────────────────────────────────────────────
           SHARED PANEL
        ─────────────────────────────────────────────── */
        .ov-panel {
          position: fixed; top: 12px;
          background: var(--bg-panel);
          border: 1px solid var(--border);
          border-top: 2px solid var(--ice);
          border-radius: 6px;
          overflow: hidden;
        }

        .ov-panel-left  { left: 12px;  width: 148px; }
        .ov-panel-right { right: 12px; width: 226px; }

        /* Panel header */
        .panel-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 8px 10px;
          background: var(--bg-raised);
          border-bottom: 1px solid var(--border);
        }
        .panel-brand {
          font-family: var(--font-display);
          font-size: 13px; font-weight: 900;
          letter-spacing: 3px; color: var(--text-primary);
        }
        .panel-season {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 1.5px; color: var(--ice);
          background: var(--ice-dim);
          border: 1px solid var(--ice-border);
          border-radius: 3px; padding: 2px 6px;
        }

        /* Section rule label */
        .panel-rule-label {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 800;
          letter-spacing: 3px; color: var(--ice);
          padding: 5px 10px 4px;
          background: var(--ice-dim);
          border-bottom: 1px solid var(--ice-border);
        }

        /* ───────────────────────────────────────────────
           STANDINGS TABLE
        ─────────────────────────────────────────────── */
        .standings-table {
          width: 100%; border-collapse: collapse;
        }
        .standings-table thead th {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 800;
          letter-spacing: 2px;
          color: var(--text-primary);
          padding: 5px 4px;
          text-align: center;
          background: var(--bg-raised);
          border-bottom: 1px solid var(--border-mid);
        }
        .standings-table thead th.al { text-align: left; padding-left: 8px; }
        .standings-table tbody tr {
          border-bottom: 1px solid rgba(255,255,255,0.03);
        }
        .standings-table tbody tr:nth-child(even) {
          background: var(--bg-stripe);
        }

        .std-td {
          font-family: var(--font-display);
          font-size: 15px; font-weight: 600;
          color: var(--text-secondary);
          padding: 3px 4px;
          text-align: center; line-height: 1;
        }
        .std-rank {
          font-size: 9px !important; font-weight: 700 !important;
          color: var(--text-dim) !important;
          width: 18px;
        }
        .std-logo-cell { width: 26px; padding: 2px 2px; }
        .std-logo {
          width: 18px; height: 18px; object-fit: contain;
          display: block; margin: 0 auto;
        }
        .std-pts {
          font-weight: 800 !important;
          color: var(--text-primary) !important;
        }

        /* Highlight A */
        .std-row-a {
          background: var(--ice-dim) !important;
          border-left: 2px solid var(--ice) !important;
        }
        .std-row-a .std-td { color: #bae6fd !important; }
        .std-row-a .std-pts { color: var(--ice) !important; }

        /* Highlight B */
        .std-row-b {
          background: var(--amber-dim) !important;
          border-left: 2px solid var(--amber) !important;
        }
        .std-row-b .std-td { color: #fde68a !important; }
        .std-row-b .std-pts { color: var(--amber) !important; }

        /* Below playoff cutoff */
        .std-row-out .std-td {
          color: var(--text-dim) !important;
          opacity: 0.7;
        }
        .std-row-out .std-pts { color: var(--text-dim) !important; }

        /* Cutoff line */
        .std-cutoff td {
          padding: 0 !important; height: 1px !important;
          background: var(--cutoff) !important;
          border: none !important;
        }

        /* ───────────────────────────────────────────────
           H2H HERO
        ─────────────────────────────────────────────── */
        .h2h-hero {
          padding: 12px 12px 10px;
          background: var(--bg-raised);
          border-bottom: 1px solid var(--border);
        }
        .h2h-section-label {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 800;
          letter-spacing: 3px; color: var(--ice);
          margin-bottom: 10px;
        }
        .h2h-teams-row {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 10px;
        }
        .h2h-team-block {
          display: flex; flex-direction: column; align-items: center; gap: 5px;
          flex: 1;
        }
        .h2h-logo {
          width: 44px; height: 44px; object-fit: contain;
        }
        .h2h-team-code {
          font-family: var(--font-display);
          font-size: 12px; font-weight: 800;
          letter-spacing: 1px; color: var(--text-secondary);
        }

        .h2h-center {
          display: flex; flex-direction: column; align-items: center; gap: 1px;
          padding: 0 6px;
        }
        .h2h-record-row {
          display: flex; align-items: baseline; gap: 3px;
        }
        .h2h-wins {
          font-family: var(--font-display);
          font-size: 40px; font-weight: 900;
          line-height: 1; color: var(--text-primary);
        }
        .h2h-dash {
          font-family: var(--font-display);
          font-size: 24px; font-weight: 300;
          color: var(--text-dim); line-height: 1;
        }
        .h2h-ties-label {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          color: var(--text-dim); letter-spacing: 1px;
        }
        .h2h-gp-label {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          color: var(--text-dim); letter-spacing: 1px;
        }

        /* H2H stat grid */
        .h2h-stats-grid {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 2px 0;
          padding-top: 8px;
          border-top: 1px solid var(--border);
        }
        .h2h-stat-val {
          font-family: var(--font-display);
          font-size: 16px; font-weight: 700;
          color: var(--text-primary); line-height: 1;
        }
        .h2h-stat-val.left  { text-align: right; }
        .h2h-stat-val.right { text-align: left; }
        .h2h-stat-key {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 800;
          letter-spacing: 2px; color: var(--text-secondary);
          text-align: center; padding: 0 8px;
        }

        /* ───────────────────────────────────────────────
           TEAM PANELS
        ─────────────────────────────────────────────── */
        .team-divider {
          display: flex; align-items: center; gap: 8px;
          padding: 4px 12px;
        }
        .divider-line { flex: 1; height: 1px; background: var(--border); }
        .divider-vs {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 800;
          letter-spacing: 3px; color: var(--text-dim);
        }

        .team-panel { display: flex; flex-direction: column; }
        .team-panel-header {
          display: flex; align-items: center; gap: 7px;
          padding: 6px 10px;
          background: var(--bg-raised);
          border-bottom: 1px solid var(--border);
        }
        .team-panel-logo {
          width: 20px; height: 20px; object-fit: contain; flex-shrink: 0;
        }
        .team-panel-code {
          font-family: var(--font-display);
          font-size: 15px; font-weight: 900;
          letter-spacing: 1px; color: var(--text-primary);
          flex: 1;
        }
        .team-panel-rank {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 800;
          letter-spacing: 1px; color: var(--text-secondary);
        }

        /* Roster table */
        .roster-table { width: 100%; border-collapse: collapse; }
        .roster-table thead th {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 800;
          letter-spacing: 2px;
          color: var(--text-primary);
          padding: 4px 6px;
          text-align: center;
          background: rgba(0,0,0,0.3);
          border-bottom: 1px solid var(--border-mid);
        }
        .roster-table thead th.al { text-align: left; }
        .roster-table tbody tr {
          border-bottom: 1px solid rgba(255,255,255,0.025);
        }
        .roster-table tbody tr:nth-child(even) { background: var(--bg-stripe); }

        .r-td {
          font-family: var(--font-display);
          font-size: 14px; font-weight: 600;
          color: var(--text-secondary);
          padding: 3px 6px;
          text-align: center; line-height: 1;
        }
        .r-td.al {
          text-align: left;
          color: var(--text-primary); font-weight: 700;
        }
        .r-td.g  { color: var(--ice); }
        .r-td.pts {
          color: var(--text-primary); font-weight: 800;
          font-size: 15px;
        }

        .no-data {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 2px; color: var(--text-dim);
          text-align: center; padding: 10px;
        }
      `}</style>
    </div>
  );
}

// ── H2H Hero ──────────────────────────────────────────────────────────────────
function H2HHero({ h2h, teamA, teamB }) {
  return (
    <div className="h2h-hero">
      <div className="h2h-section-label">ALL-TIME H2H</div>
      <div className="h2h-teams-row">
        <div className="h2h-team-block">
          <img
            src={`/assets/teamLogos/${teamA.code}.png`}
            alt={teamA.code}
            className="h2h-logo"
            onError={e => e.target.style.display = 'none'}
          />
          <span className="h2h-team-code">{teamA.code}</span>
        </div>

        <div className="h2h-center">
          <div className="h2h-record-row">
            <span className="h2h-wins">{h2h.aW}</span>
            <span className="h2h-dash">–</span>
            <span className="h2h-wins">{h2h.bW}</span>
          </div>
          {h2h.ties > 0 && <span className="h2h-ties-label">T: {h2h.ties}</span>}
          <span className="h2h-gp-label">{h2h.gp} GP</span>
        </div>

        <div className="h2h-team-block">
          <img
            src={`/assets/teamLogos/${teamB.code}.png`}
            alt={teamB.code}
            className="h2h-logo"
            onError={e => e.target.style.display = 'none'}
          />
          <span className="h2h-team-code">{teamB.code}</span>
        </div>
      </div>

      {h2h.gp > 0 && (
        <div className="h2h-stats-grid">
          <span className="h2h-stat-val left">{h2h.aGFpg}</span>
          <span className="h2h-stat-key">GF/G</span>
          <span className="h2h-stat-val right">{h2h.bGFpg}</span>

          <span className="h2h-stat-val left">{h2h.aGApg}</span>
          <span className="h2h-stat-key">GA/G</span>
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
function TeamPanel({ team, side }) {
  const { code, rank, roster } = team;
  return (
    <div className="team-panel">
      <div className="team-panel-header">
        <img
          src={`/assets/teamLogos/${code}.png`}
          alt={code}
          className="team-panel-logo"
          onError={e => e.target.style.display = 'none'}
        />
        <span className="team-panel-code">{code}</span>
        {rank && <span className="team-panel-rank">#{rank}</span>}
      </div>

      {roster.length === 0 ? (
        <div className="no-data">NO STATS YET</div>
      ) : (
        <table className="roster-table">
          <thead>
            <tr>
              <th className="al">PLAYER</th>
              <th>G</th>
              <th>A</th>
              <th>PTS</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((p, i) => (
              <tr key={`${p.player}-${i}`}>
                <td className="r-td al">{p.player}</td>
                <td className="r-td g">{p.g}</td>
                <td className="r-td">{p.a}</td>
                <td className="r-td pts">{p.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ── Custom Select ─────────────────────────────────────────────────────────────
function CustomSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);

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
          <th className="al" style={{ width: 18 }}>#</th>
          <th style={{ width: 26 }}></th>
          <th>W</th>
          <th>L</th>
          <th>PTS</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s, i) => {
          const isA = s.team === highlightA;
          const isB = s.team === highlightB;
          const isOut = i >= PLAYOFF_TEAMS;

          let rowClass = '';
          if (isA) rowClass = 'std-row-a';
          else if (isB) rowClass = 'std-row-b';
          else if (isOut) rowClass = 'std-row-out';

          return (
            <React.Fragment key={s.team}>
              <tr className={rowClass}>
                <td className="std-td std-rank">{i + 1}</td>
                <td className="std-logo-cell">
                  <img
                    src={`/assets/teamLogos/${s.team}.png`}
                    alt={s.team}
                    className="std-logo"
                    onError={e => e.target.style.display = 'none'}
                  />
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

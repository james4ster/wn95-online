import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';

// ── Config ─────────────────────────────────────────────────────────────────
const CURRENT_MODE = 'season';

// ── Helpers ────────────────────────────────────────────────────────────────
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
  let aW = 0, bW = 0, ties = 0;
  matchups.forEach(g => {
    const sh = g.score_home ?? 0, sa = g.score_away ?? 0;
    if (sh === sa) { ties++; }
    else if (sh > sa) { if (g.home === teamA) aW++; else bW++; }
    else              { if (g.away === teamA) aW++; else bW++; }
  });
  return { aW, bW, ties, gp: matchups.length };
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

  // ── Load league + teams once ──────────────────────────────────────────
  useEffect(() => {
    async function bootstrap() {
      const { data: seasons } = await supabase
        .from('seasons')
        .select('lg')
        .ilike('lg', 'W%')
        .order('lg', { ascending: false })
        .limit(1);

      const lg = seasons?.[0]?.lg;
      if (!lg) return;
      setCurrentLg(lg);

      const { data: teams } = await supabase
        .from('teams')
        .select('abr, team')
        .eq('lg', lg)
        .order('abr');

      setAllTeams(teams || []);

      if (teams?.length >= 2) {
        setPendingA(teams[0].abr);
        setPendingB(teams[1].abr);
      }
    }
    bootstrap();
  }, []);

  // ── Tilde key toggle ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = e => { if (e.key === '`' || e.key === '~') setShowPanel(p => !p); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Fetch matchup data ────────────────────────────────────────────────
  const loadMatchup = useCallback(async (a, b, lg) => {
    if (!a || !b || !lg || a === b) return;
    setLoading(true);
    setMatchupData(null);

    const [
      { data: currentGames },
      { data: allGames },
      { data: rawScoring },
      { data: teams },
    ] = await Promise.all([
      supabase.from('games')
        .select('id, home, away, score_home, score_away, ot')
        .eq('lg', lg).ilike('mode', CURRENT_MODE)
        .not('score_home', 'is', null),
      supabase.from('games')
        .select('home, away, score_home, score_away, ot')
        .ilike('mode', CURRENT_MODE)
        .not('score_home', 'is', null)
        .or(`and(home.eq.${a},away.eq.${b}),and(home.eq.${b},away.eq.${a})`),
      supabase.from('game_raw_scoring')
        .select('goal_player_name, assist_primary_name, assist_secondary_name, g_team')
        .eq('season', lg).eq('mode', CURRENT_MODE),
      supabase.from('teams').select('abr, team').eq('lg', lg),
    ]);

    const standings = computeStandings(currentGames, teams);
    const rank = code => {
      const idx = standings.findIndex(s => s.team === code);
      return idx === -1 ? null : idx + 1;
    };

    setMatchupData({
      teamA: {
        code: a,
        record: standings.find(s => s.team === a) || { gp:0, w:0, l:0, otl:0, t:0, pts:0, gf:0, ga:0 },
        rank: rank(a),
        roster: computeRosterStats(rawScoring, a),
      },
      teamB: {
        code: b,
        record: standings.find(s => s.team === b) || { gp:0, w:0, l:0, otl:0, t:0, pts:0, gf:0, ga:0 },
        rank: rank(b),
        roster: computeRosterStats(rawScoring, b),
      },
      h2h: computeH2H(allGames, a, b),
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

      {/* ── Hidden Setup Panel ── */}
      {showPanel && (
        <div className="setup-panel">
          <div className="setup-title">⚡ MATCHUP SETUP</div>
          <div className="setup-note">Press ~ to close</div>
          <div className="setup-row">
            <label className="setup-label">TEAM A</label>
            <select
              className="setup-select"
              value={pendingA}
              onChange={e => setPendingA(e.target.value)}
            >
              <option value="">-- SELECT --</option>
              {allTeams.map(t => (
                <option key={t.abr} value={t.abr}>{t.abr}{t.team ? ` — ${t.team}` : ''}</option>
              ))}
            </select>
          </div>
          <div className="setup-row">
            <label className="setup-label">TEAM B</label>
            <select
              className="setup-select"
              value={pendingB}
              onChange={e => setPendingB(e.target.value)}
            >
              <option value="">-- SELECT --</option>
              {allTeams.map(t => (
                <option key={t.abr} value={t.abr}>{t.abr}{t.team ? ` — ${t.team}` : ''}</option>
              ))}
            </select>
          </div>
          {pendingA && pendingB && pendingA === pendingB && (
            <div className="setup-error">Teams must be different</div>
          )}
          <button
            className="setup-apply"
            onClick={handleApply}
            disabled={!pendingA || !pendingB || pendingA === pendingB}
          >
            APPLY
          </button>
        </div>
      )}

      {/* ── Empty state ── */}
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

      {/* ── Matchup card ── */}
      {hasMatchup && !loading && (
        <div className="ov-root">
          <div className="ov-scanlines" />

          <div className="ov-header">
            <div className="ov-header-left">
              <span className="ov-bolt">⚡</span>
              <span className="ov-logo-text">WN95HL</span>
            </div>
            <div className="ov-matchup-badge">
              <span className="badge-team">{matchupData.teamA.code}</span>
              <span className="badge-vs">VS</span>
              <span className="badge-team">{matchupData.teamB.code}</span>
            </div>
            <div className="ov-season-badge">{matchupData.season}</div>
          </div>

          <H2HStrip h2h={matchupData.h2h} teamA={matchupData.teamA.code} teamB={matchupData.teamB.code} />
          <TeamPanel team={matchupData.teamA} />
          <div className="ov-divider" />
          <TeamPanel team={matchupData.teamB} />

          <div className="ov-footer">
            <span className="ov-footer-text">WN95HL.COM</span>
            <span className="ov-footer-sep">·</span>
            <span className="ov-footer-text">LIVE STATS</span>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .ov-page {
          width: 100vw; min-height: 100vh;
          display: flex; justify-content: flex-end; align-items: flex-start;
          background: transparent; padding: 12px;
          font-family: 'VT323', monospace;
          position: relative;
        }

        .setup-panel {
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          z-index: 999;
          background: linear-gradient(160deg, rgba(4,2,20,.98), rgba(10,6,30,.98));
          border: 1px solid rgba(255,215,0,.5);
          border-radius: 10px;
          padding: 1.2rem 1.4rem;
          width: 320px;
          box-shadow: 0 0 40px rgba(255,140,0,.25), 0 0 80px rgba(0,0,0,.8);
        }
        .setup-title {
          font-family: 'Press Start 2P', monospace; font-size: .5rem;
          color: #FFD700; letter-spacing: 2px;
          text-shadow: 0 0 10px rgba(255,215,0,.5);
          margin-bottom: .2rem;
        }
        .setup-note {
          font-family: 'Press Start 2P', monospace; font-size: .28rem;
          color: rgba(255,255,255,.2); margin-bottom: 1rem; letter-spacing: 1px;
        }
        .setup-row { display: flex; flex-direction: column; gap: .3rem; margin-bottom: .8rem; }
        .setup-label {
          font-family: 'Press Start 2P', monospace; font-size: .3rem;
          color: #FF8C00; letter-spacing: 1px;
        }
        .setup-select {
          font-family: 'VT323', monospace; font-size: 1.1rem;
          background: rgba(0,0,0,.6); color: #E0E0E0;
          border: 1px solid rgba(255,215,0,.3); border-radius: 4px;
          padding: .3rem .5rem; width: 100%;
          outline: none; cursor: pointer;
        }
        .setup-select:focus { border-color: rgba(255,215,0,.7); }
        .setup-error {
          font-family: 'Press Start 2P', monospace; font-size: .28rem;
          color: #ff4444; margin-bottom: .5rem;
        }
        .setup-apply {
          font-family: 'Press Start 2P', monospace; font-size: .38rem;
          letter-spacing: 2px; color: #000;
          background: linear-gradient(135deg, #FFD700, #FF8C00);
          border: none; border-radius: 4px;
          padding: .5rem 1rem; width: 100%;
          cursor: pointer; transition: opacity .15s;
        }
        .setup-apply:hover:not(:disabled) { opacity: .85; }
        .setup-apply:disabled { opacity: .3; cursor: not-allowed; }

        .ov-root {
          width: 320px; position: relative;
          background: linear-gradient(170deg, rgba(4,2,14,.96) 0%, rgba(8,6,22,.96) 100%);
          border: 1px solid rgba(255,215,0,.35); border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 0 0 1px rgba(255,140,0,.08), 0 0 30px rgba(255,140,0,.12), inset 0 0 40px rgba(0,0,0,.4);
        }
        .ov-empty { width: 240px; }

        .ov-scanlines {
          position: absolute; inset: 0; z-index: 200; pointer-events: none;
          background: repeating-linear-gradient(0deg, transparent 0px, transparent 3px, rgba(0,0,0,.04) 3px, rgba(0,0,0,.04) 4px);
        }

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
          font-family: 'Press Start 2P', monospace; font-size: .45rem;
          color: #FFD700; letter-spacing: 1.5px;
          text-shadow: 0 0 8px rgba(255,215,0,.4);
        }
        .ov-matchup-badge { display: flex; align-items: center; gap: 4px; }
        .badge-team {
          font-family: 'Press Start 2P', monospace; font-size: .3rem;
          color: #87CEEB; letter-spacing: .5px;
        }
        .badge-vs {
          font-family: 'Press Start 2P', monospace; font-size: .22rem;
          color: rgba(255,140,0,.6);
        }
        .ov-season-badge {
          font-family: 'Press Start 2P', monospace; font-size: .28rem;
          color: rgba(135,206,235,.6);
          background: rgba(135,206,235,.07);
          border: 1px solid rgba(135,206,235,.15);
          border-radius: 3px; padding: .12rem .3rem; letter-spacing: 1px;
        }

        .h2h-strip {
          display: flex; align-items: center; justify-content: center; gap: 0;
          padding: .25rem .6rem;
          background: rgba(0,0,0,.25);
          border-bottom: 1px solid rgba(255,215,0,.08);
        }
        .h2h-label {
          font-family: 'Press Start 2P', monospace; font-size: .26rem;
          color: rgba(255,140,0,.6); letter-spacing: 1px; margin-right: .5rem;
        }
        .h2h-block { display: flex; align-items: center; gap: 3px; }
        .h2h-team-code {
          font-family: 'Press Start 2P', monospace; font-size: .26rem;
          color: rgba(255,255,255,.4);
        }
        .h2h-wins {
          font-family: 'VT323', monospace; font-size: 1.1rem;
          color: #FFD700; line-height: 1;
        }
        .h2h-sep { color: rgba(255,255,255,.15); font-size: .7rem; margin: 0 .25rem; }
        .h2h-gp {
          font-family: 'Press Start 2P', monospace; font-size: .22rem;
          color: rgba(255,255,255,.2); margin-left: .4rem;
        }

        .team-section-label {
          display: flex; align-items: center; gap: 6px;
          padding: .28rem .5rem .2rem;
          background: linear-gradient(90deg, rgba(255,140,0,.12) 0%, transparent 100%);
          border-bottom: 1px solid rgba(255,140,0,.1);
        }
        .team-logo {
          width: 18px; height: 18px; object-fit: contain;
          border-radius: 2px; flex-shrink: 0;
        }
        .team-code-label {
          font-family: 'Press Start 2P', monospace; font-size: .32rem;
          color: rgba(255,255,255,.8); letter-spacing: .5px; flex: 1;
        }
        .team-rank {
          font-family: 'Press Start 2P', monospace; font-size: .24rem;
          color: rgba(255,140,0,.5);
        }

        .record-row {
          display: flex; align-items: center; justify-content: space-between;
          padding: .18rem .5rem;
          background: rgba(0,0,0,.15);
          border-bottom: 1px solid rgba(255,255,255,.03);
        }
        .record-stat { display: flex; flex-direction: column; align-items: center; gap: 1px; }
        .record-val {
          font-family: 'VT323', monospace; font-size: 1.05rem;
          color: #E0E0E0; line-height: 1;
        }
        .record-val.pts { color: #FFD700; }
        .record-val.gd-pos { color: #00c853; }
        .record-val.gd-neg { color: #ff4444; }
        .record-key {
          font-family: 'Press Start 2P', monospace; font-size: .2rem;
          color: rgba(255,255,255,.25); letter-spacing: .3px;
        }

        .ov-table { width: 100%; border-collapse: collapse; }
        .ov-th {
          font-family: 'Press Start 2P', monospace; font-size: .22rem;
          color: rgba(255,255,255,.3); padding: .12rem .25rem;
          text-align: center; letter-spacing: .3px;
          border-bottom: 1px solid rgba(255,215,0,.08);
          background: rgba(0,0,0,.2);
        }
        .ov-th.al { text-align: left; padding-left: .5rem; }
        .ov-tbody tr:nth-child(even) { background: rgba(255,255,255,.02); }
        .ov-td {
          font-family: 'VT323', monospace; font-size: .88rem;
          color: #B0B0B0; padding: .02rem .25rem;
          text-align: center;
          border-bottom: 1px solid rgba(255,255,255,.02);
        }
        .ov-td.al { text-align: left; padding-left: .4rem; color: #D0D0D0; }
        .ov-td.pts { color: #FFD700; }
        .ov-td.g   { color: #87CEEB; }
        .ov-td.a   { color: rgba(255,255,255,.4); }
        .no-data {
          font-family: 'Press Start 2P', monospace; font-size: .26rem;
          color: rgba(255,255,255,.15); text-align: center; padding: .5rem;
        }

        .ov-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,215,0,.3), transparent);
          margin: .1rem 0;
        }

        .ov-footer {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: .22rem .6rem;
          background: rgba(0,0,0,.2);
          border-top: 1px solid rgba(255,215,0,.07);
        }
        .ov-footer-text {
          font-family: 'Press Start 2P', monospace;
          font-size: .22rem; color: rgba(255,255,255,.12); letter-spacing: 1px;
        }
        .ov-footer-sep { color: rgba(255,215,0,.2); font-size: .6rem; line-height: 1; }

        .empty-msg { padding: 1.2rem .6rem; text-align: center; }
        .empty-title {
          font-family: 'Press Start 2P', monospace; font-size: .38rem;
          color: rgba(255,215,0,.4); letter-spacing: 2px; margin-bottom: .6rem;
        }
        .empty-sub {
          font-family: 'VT323', monospace; font-size: .95rem;
          color: rgba(255,255,255,.25);
        }
        .key {
          font-family: 'Press Start 2P', monospace; font-size: .55rem;
          color: #FF8C00;
        }
        .loading-pulse {
          font-family: 'Press Start 2P', monospace; font-size: .38rem;
          color: #FFD700; text-align: center; padding: 1.2rem;
          animation: bpulse 1s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// ── H2H Strip ─────────────────────────────────────────────────────────────────
function H2HStrip({ h2h, teamA, teamB }) {
  return (
    <div className="h2h-strip">
      <span className="h2h-label">H2H</span>
      <div className="h2h-block">
        <span className="h2h-team-code">{teamA}</span>
        <span className="h2h-wins">&nbsp;{h2h.aW}</span>
      </div>
      <span className="h2h-sep">–</span>
      <div className="h2h-block">
        <span className="h2h-wins">{h2h.bW}&nbsp;</span>
        <span className="h2h-team-code">{teamB}</span>
      </div>
      {h2h.ties > 0 && <span className="h2h-sep">(T:{h2h.ties})</span>}
      <span className="h2h-gp">({h2h.gp} GP)</span>
    </div>
  );
}

// ── Team Panel ────────────────────────────────────────────────────────────────
function TeamPanel({ team }) {
  const { code, record, rank, roster } = team;
  const gd = record.gf - record.ga;

  return (
    <>
      <div className="team-section-label">
        <img
          src={`/assets/teamLogos/${code}.png`}
          alt={code}
          className="team-logo"
          onError={e => e.target.style.display = 'none'}
        />
        <span className="team-code-label">{code}</span>
        {rank && <span className="team-rank">#{rank}</span>}
      </div>

      <div className="record-row">
        {[
          { key: 'GP',  val: record.gp,  cls: '' },
          { key: 'W',   val: record.w,   cls: '' },
          { key: 'L',   val: record.l,   cls: '' },
          { key: 'OTL', val: record.otl, cls: '' },
          { key: 'PTS', val: record.pts, cls: 'pts' },
          { key: 'GD',  val: (gd > 0 ? '+' : '') + gd, cls: gd > 0 ? 'gd-pos' : gd < 0 ? 'gd-neg' : '' },
        ].map(({ key, val, cls }) => (
          <div className="record-stat" key={key}>
            <span className={`record-val ${cls}`}>{val}</span>
            <span className="record-key">{key}</span>
          </div>
        ))}
      </div>

      {roster.length === 0 ? (
        <div className="no-data">NO STATS YET</div>
      ) : (
        <table className="ov-table">
          <thead>
            <tr>
              <th className="ov-th al">PLAYER</th>
              <th className="ov-th">G</th>
              <th className="ov-th">A</th>
              <th className="ov-th">PTS</th>
            </tr>
          </thead>
          <tbody className="ov-tbody">
            {roster.map((p, i) => (
              <tr key={`${p.player}-${i}`}>
                <td className="ov-td al">{p.player}</td>
                <td className="ov-td g">{p.g}</td>
                <td className="ov-td a">{p.a}</td>
                <td className="ov-td pts">{p.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

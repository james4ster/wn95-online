// Dashboard.jsx — v4 League History + Team Profile
// Props: allGames, allSeasons, leagueGames, managers, mgrMeta, teamStatsRows,
//        computedStandings, champData, allSeasonsData

import { useState, useMemo, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell, LabelList,
  ComposedChart, ZAxis,
} from 'recharts';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  orange: '#FF8C00', gold: '#FFD700', sky: '#87CEEB',
  green: '#00DD55', red: '#FF4444', purple: '#B48EFF',
  teal: '#00D4AA', pink: '#FF6B9D', lime: '#C6F135',
  bg: '#00000a', bgCard: 'rgba(8,8,24,.97)', bgCard2: 'rgba(12,12,32,.97)',
  border: 'rgba(255,140,0,.2)', borderDim: 'rgba(255,255,255,.08)',
  textDim: 'rgba(255,255,255,.38)', textMid: 'rgba(255,255,255,.62)',
  textBright: 'rgba(255,255,255,.92)',
};
const F = {
  px: "'Press Start 2P',monospace",
  vt: "'VT323',monospace",
  bc: "'Barlow Condensed',sans-serif",
};

// Distinct palette for up to 20 teams on scatter plots
const TEAM_PAL = [
  '#FF8C00','#87CEEB','#FFD700','#00DD55','#B48EFF',
  '#00D4AA','#FF6B9D','#FFB347','#4FC3F7','#69F0AE',
  '#F06292','#AED581','#4DD0E1','#CE93D8','#FFCC02',
  '#80DEEA','#EF9A9A','#A5D6A7','#90CAF9','#FFAB91',
];

const norm = s => (s || '').toString().trim().toLowerCase();
const seasonNum = lg => { const n = parseInt((lg || '').replace(/\D/g, ''), 10); return isNaN(n) ? 0 : n; };
const PLAYOFF_VALS = new Set(['PO', 'PLAYOFF', 'PLAYOFFS', 'P', 'POST', 'POSTSEASON']);
const rsOnly = g => !g._isPlayoff && !PLAYOFF_VALS.has((g.mode || '').trim().toUpperCase());

const MEDAL = ['🥇', '🥈', '🥉'];

// ─── Shared primitives ────────────────────────────────────────────────────────
function TeamLogo({ code, size = 28, style = {} }) {
  const [err, setErr] = useState(false);
  if (!code) return null;
  if (err) return (
    <div style={{ width: size, height: size, borderRadius: 4, background: 'rgba(255,140,0,.15)', border: '1px solid rgba(255,140,0,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: F.px, fontSize: size * 0.22, color: C.orange, flexShrink: 0, ...style }}>
      {code.slice(0, 3)}
    </div>
  );
  return <img src={`/assets/teamLogos/${code}.png`} alt={code} onError={() => setErr(true)}
    style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 0 4px rgba(255,255,255,.18))', ...style }} />;
}

const TT = { background: 'rgba(4,4,18,.99)', border: `1px solid ${C.border}`, borderRadius: 10, fontFamily: F.vt, fontSize: '1.3rem', color: C.textBright, padding: '12px 18px', boxShadow: '0 6px 32px rgba(0,0,0,.9)' };

function Card({ title, subtitle, accent = C.orange, children, style = {}, collapsible = true }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ background: C.bgCard, border: `1px solid ${accent}22`, borderRadius: 16, padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: open ? 14 : 0, boxShadow: `0 0 0 1px ${C.borderDim}, 0 8px 40px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.03)`, ...style }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', cursor: collapsible ? 'pointer' : 'default' }} onClick={collapsible ? () => setOpen(o => !o) : undefined}>
        <div>
          <div style={{ fontFamily: F.px, fontSize: '.58rem', color: accent, letterSpacing: 2, lineHeight: 1.5 }}>{title}</div>
          {subtitle && open && <div style={{ fontFamily: F.bc, fontSize: '1.05rem', color: C.textDim, marginTop: 5, letterSpacing: .5, fontWeight: 400 }}>{subtitle}</div>}
        </div>
        {collapsible && (
          <div style={{ fontFamily: F.px, fontSize: '.32rem', color: C.textDim, padding: '5px 12px', border: `1px solid ${C.borderDim}`, borderRadius: 6, userSelect: 'none', flexShrink: 0, marginLeft: 12 }}>
            {open ? '▼ COLLAPSE' : '▶ EXPAND'}
          </div>
        )}
      </div>
      {open && <div>{children}</div>}
    </div>
  );
}

function Empty({ icon = '📊', msg = 'NO DATA' }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 220, gap: 12 }}>
      <span style={{ fontSize: 42, opacity: .15 }}>{icon}</span>
      <span style={{ fontFamily: F.px, fontSize: '.52rem', color: C.textDim, letterSpacing: 2 }}>{msg}</span>
    </div>
  );
}

function BigSelect({ value, onChange, options, color = C.orange, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      {label && <span style={{ fontFamily: F.px, fontSize: '.46rem', color, letterSpacing: 2, whiteSpace: 'nowrap' }}>{label}</span>}
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
        <select value={value} onChange={e => onChange(e.target.value)}
          style={{ fontFamily: F.px, fontSize: '.7rem', padding: '.7rem 2.8rem .7rem 1.2rem', background: 'rgba(0,0,20,.9)', border: `2px solid ${color}55`, borderRadius: 9, color, cursor: 'pointer', appearance: 'none', letterSpacing: 1, minWidth: 200, transition: 'border-color .15s', lineHeight: 1.4 }}
          onFocus={e => e.target.style.borderColor = color}
          onBlur={e => e.target.style.borderColor = `${color}55`}>
          {options.map(o => <option key={o.value ?? o} value={o.value ?? o} style={{ fontFamily: 'monospace', fontSize: '15px' }}>{o.label ?? o}</option>)}
        </select>
        <span style={{ position: 'absolute', right: 12, pointerEvents: 'none', color: C.textDim, fontSize: 17 }}>▾</span>
      </div>
    </div>
  );
}

function TabBtn({ id, current, onChange, children, accent = C.orange }) {
  const on = current === id;
  return (
    <button onClick={() => onChange(id)}
      style={{ fontFamily: F.px, fontSize: '.52rem', letterSpacing: 1.5, padding: '.8rem 2rem', borderRadius: 9, border: `2px solid ${on ? accent : C.borderDim}`, background: on ? `${accent}22` : 'rgba(255,255,255,.03)', color: on ? accent : C.textDim, cursor: 'pointer', transition: 'all .14s', boxShadow: on ? `0 0 18px ${accent}30` : 'none' }}>
      {children}
    </button>
  );
}

function ModeBtn({ mode, current, onChange, children }) {
  const on = current === mode;
  return (
    <button onClick={() => onChange(mode)}
      style={{ fontFamily: F.px, fontSize: '.46rem', letterSpacing: 1, padding: '.65rem 1.4rem', borderRadius: 8, border: `2px solid ${on ? C.orange : C.borderDim}`, background: on ? `${C.orange}22` : 'transparent', color: on ? C.orange : C.textDim, cursor: 'pointer', transition: 'all .14s' }}>
      {children}
    </button>
  );
}

function FullscreenToggle({ active, onClick }) {
  return (
    <button onClick={onClick}
      style={{ fontFamily: F.px, fontSize: '.5rem', letterSpacing: 1.5, padding: '.8rem 1.6rem', borderRadius: 9, border: `2px solid ${active ? C.red : C.borderDim}`, background: active ? `${C.red}1a` : 'rgba(255,255,255,.03)', color: active ? C.red : C.textDim, cursor: 'pointer', transition: 'all .14s', display: 'flex', alignItems: 'center', gap: 8 }}>
      {active ? '✕ EXIT FULLSCREEN' : '⛶ FULLSCREEN'}
    </button>
  );
}

function Divider({ label, accent = C.border }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
      <div style={{ flex: 1, height: 2, background: `linear-gradient(to right,transparent,${accent})` }} />
      {label && <span style={{ fontFamily: F.px, fontSize: '.64rem', color: C.textDim, letterSpacing: 3 }}>{label}</span>}
      <div style={{ flex: 1, height: 2, background: `linear-gradient(to left,transparent,${accent})` }} />
    </div>
  );
}

function StatPill({ label, value, color = C.orange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 16px', background: `${color}10`, border: `1px solid ${color}28`, borderRadius: 12, minWidth: 78 }}>
      <div style={{ fontFamily: F.vt, fontSize: '2.6rem', color, lineHeight: 1, textShadow: `0 0 20px ${color}44`, letterSpacing: 1 }}>{value ?? '—'}</div>
      <div style={{ fontFamily: F.px, fontSize: '.3rem', color: `${color}88`, letterSpacing: 1, textAlign: 'center', whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  );
}

// ─── Data builders ────────────────────────────────────────────────────────────

function gameResult(sh, sa, ot, side) {
  const ms = side === 'home' ? sh : sa, os = side === 'home' ? sa : sh;
  if (ms > os) return 'W';
  if (os > ms) return ot ? 'OTL' : 'L';
  return 'T';
}

// Build per-coach per-season aggregates from games
// Returns Map<coachNorm, Map<season, {gp,w,l,otl,t,gf,ga,pts,so}>>
function buildAllSeasonStats(games) {
  const out = new Map();
  for (const g of games) {
    if (!rsOnly(g)) continue;
    const sh = Number(g.score_home || 0), sa = Number(g.score_away || 0), ot = !!g.ot;
    const lg = g.lg; if (!lg) continue;
    const add = (coach, ms, os, side) => {
      if (!coach) return;
      const cn = norm(coach);
      if (!out.has(cn)) out.set(cn, new Map());
      const seasons = out.get(cn);
      if (!seasons.has(lg)) seasons.set(lg, { gp: 0, w: 0, l: 0, otl: 0, t: 0, gf: 0, ga: 0, pts: 0, so: 0, coach: coach.trim() });
      const s = seasons.get(lg);
      s.gp++; s.gf += ms; s.ga += os;
      const res = gameResult(sh, sa, ot, side);
      if (res === 'W') { s.w++; s.pts += 2; }
      else if (res === 'OTL') { s.otl++; s.pts += 1; }
      else if (res === 'T') { s.t++; s.pts += 1; }
      else s.l++;
      if (os === 0) s.so++;
    };
    add(g.coach_home, sh, sa, 'home');
    add(g.coach_away, sa, sh, 'away');
  }
  // Compute derived
  for (const [, seasons] of out) {
    for (const [, s] of seasons) {
      s.ptsPct = s.gp > 0 ? +((s.pts / (s.gp * 2)) * 100).toFixed(1) : 0;
      s.gfpg = s.gp > 0 ? +(s.gf / s.gp).toFixed(2) : 0;
      s.gapg = s.gp > 0 ? +(s.ga / s.gp).toFixed(2) : 0;
      s.gd = s.gf - s.ga;
      s.gdpg = s.gp > 0 ? +((s.gf - s.ga) / s.gp).toFixed(2) : 0;
      s.wpct = s.gp > 0 ? +((s.w / s.gp) * 100).toFixed(1) : 0;
    }
  }
  return out;
}

// Build per-coach career totals (sum over RS seasons)
function buildCareerTotals(allSeasonStats) {
  const out = [];
  for (const [cn, seasons] of allSeasonStats) {
    let gp = 0, w = 0, l = 0, otl = 0, t = 0, gf = 0, ga = 0, pts = 0, so = 0;
    let coachName = cn;
    for (const [, s] of seasons) {
      gp += s.gp; w += s.w; l += s.l; otl += s.otl; t += s.t;
      gf += s.gf; ga += s.ga; pts += s.pts; so += s.so;
      coachName = s.coach || coachName;
    }
    const maxPts = gp * 2;
    out.push({
      cn, name: coachName, gp, w, l, otl, t, gf, ga, pts, so,
      ptsPct: maxPts > 0 ? +((pts / maxPts) * 100).toFixed(1) : 0,
      gfpg: gp > 0 ? +(gf / gp).toFixed(2) : 0,
      gapg: gp > 0 ? +(ga / gp).toFixed(2) : 0,
      gd: gf - ga,
      gdpg: gp > 0 ? +((gf - ga) / gp).toFixed(2) : 0,
      wpct: gp > 0 ? +((w / gp) * 100).toFixed(1) : 0,
      seasons: seasons.size,
    });
  }
  return out.sort((a, b) => b.ptsPct - a.ptsPct);
}

// Build flat list of all {coach, season, ...stats} records for leaderboards
function buildSeasonRecords(allSeasonStats) {
  const out = [];
  for (const [cn, seasons] of allSeasonStats) {
    for (const [lg, s] of seasons) {
      if (s.gp < 10) continue; // skip tiny sample
      out.push({ cn, season: lg, n: seasonNum(lg), ...s });
    }
  }
  return out;
}

// Per-season league-wide averages
function buildLeagueAvgBySeason(allSeasonStats, allSeasons) {
  const bySeason = {};
  for (const [, seasons] of allSeasonStats) {
    for (const [lg, s] of seasons) {
      if (!bySeason[lg]) bySeason[lg] = { totalPts: 0, totalMaxPts: 0, totalGF: 0, totalGP: 0, n: 0 };
      bySeason[lg].totalPts += s.pts;
      bySeason[lg].totalMaxPts += s.gp * 2;
      bySeason[lg].totalGF += s.gf;
      bySeason[lg].totalGP += s.gp;
      bySeason[lg].n++;
    }
  }
  const out = {};
  for (const [lg, d] of Object.entries(bySeason)) {
    out[lg] = {
      ptsPct: d.totalMaxPts > 0 ? +((d.totalPts / d.totalMaxPts) * 100).toFixed(1) : 50,
      gfpg: d.totalGP > 0 ? +(d.totalGF / d.totalGP).toFixed(2) : 0,
    };
  }
  return out;
}

// Build advanced stats aggregates per coach from teamStatsRows
function buildAdvStats(teamStatsRows) {
  if (!teamStatsRows?.length) return [];
  const byCoach = {};
  for (const row of teamStatsRows) {
    const cn = norm(row.coach || '');
    if (!cn) continue;
    if (!byCoach[cn]) byCoach[cn] = { name: (row.coach || '').trim(), shots: 0, goals: 0, pp_goals: 0, pp_opps: 0, pk_ga: 0, pk_opps: 0, br_goals: 0, br_shots: 0, passes_c: 0, passes_a: 0, penalties: 0, gp: 0 };
    const s = byCoach[cn];
    s.shots += Number(row.shots || 0);
    s.goals += Number(row.goals || row.gf || 0);
    s.pp_goals += Number(row.pp_goals || 0);
    s.pp_opps += Number(row.pp_opps || row.pp_opportunities || 0);
    s.pk_ga += Number(row.pk_goals_against || 0);
    s.pk_opps += Number(row.pk_opps || row.pk_opportunities || 0);
    s.br_goals += Number(row.breakaway_goals || 0);
    s.br_shots += Number(row.breakaway_shots || 0);
    s.passes_c += Number(row.passes_completed || row.pass_completions || 0);
    s.passes_a += Number(row.passes_attempted || row.pass_attempts || 0);
    s.penalties += Number(row.penalties || 0);
    s.gp += Number(row.gp || 1);
  }
  return Object.entries(byCoach).map(([cn, s]) => ({
    cn, name: s.name,
    shPct: s.shots > 0 ? +((s.goals / s.shots) * 100).toFixed(1) : 0,
    ppPct: s.pp_opps > 0 ? +((s.pp_goals / s.pp_opps) * 100).toFixed(1) : 0,
    pkPct: s.pk_opps > 0 ? +(((s.pk_opps - s.pk_ga) / s.pk_opps) * 100).toFixed(1) : 0,
    brPct: s.br_shots > 0 ? +((s.br_goals / s.br_shots) * 100).toFixed(1) : 0,
    passPct: s.passes_a > 0 ? +((s.passes_c / s.passes_a) * 100).toFixed(1) : 0,
    penPG: s.gp > 0 ? +(s.penalties / s.gp).toFixed(2) : 0,
    gp: s.gp,
  }));
}

// Champ lookup: lg → norm(coachName)
function buildChampMap(allSeasonsData, managers, mgrMeta) {
  const out = {};
  if (!allSeasonsData?.length) return out;
  const idToCoach = {};
  if (managers?.length) {
    for (const m of managers) {
      const id = String(m.id || m.manager_id || '');
      const name = norm(m.coach_name || m.coach || m.name || '');
      if (id && name) idToCoach[id] = name;
    }
  }
  if (mgrMeta) {
    for (const [key, meta] of Object.entries(mgrMeta)) {
      const id = String(meta.id || meta.manager_id || key);
      const name = norm(meta.coach_name || meta.coach || meta.name || '');
      if (id && name && !idToCoach[id]) idToCoach[id] = name;
    }
  }
  for (const row of allSeasonsData) {
    const lg = row.lg || row.season;
    const cid = String(row.season_champion_manager_id || '');
    if (lg && cid && idToCoach[cid]) out[lg] = idToCoach[cid];
  }
  return out;
}

// Build career stats for a single coach (for Team Profile)
function buildCoachSeasonStats(games, coachName, allSeasons) {
  const cn = norm(coachName);
  const map = {};
  for (const g of games) {
    const hc = norm(g.coach_home || ''), ac = norm(g.coach_away || '');
    if (hc !== cn && ac !== cn) continue;
    const lg = g.lg; if (!lg) continue;
    if (!map[lg]) map[lg] = { gp: 0, w: 0, l: 0, t: 0, otl: 0, gf: 0, ga: 0, so: 0 };
    const s = map[lg];
    const sh = Number(g.score_home || 0), sa = Number(g.score_away || 0), ot = !!g.ot;
    const isHome = hc === cn;
    const ms = isHome ? sh : sa, os = isHome ? sa : sh;
    s.gp++; s.gf += ms; s.ga += os;
    const res = gameResult(sh, sa, ot, isHome ? 'home' : 'away');
    if (res === 'W') s.w++;
    else if (res === 'L') s.l++;
    else if (res === 'OTL') s.otl++;
    else s.t++;
    if (os === 0) s.so++;
  }
  return allSeasons.filter(lg => map[lg]).sort((a, b) => seasonNum(a) - seasonNum(b)).map(lg => {
    const s = map[lg];
    const pts = s.w * 2 + s.t + s.otl;
    const maxPts = s.gp * 2;
    return { season: lg, n: seasonNum(lg), ...s, pts, ptsPct: maxPts > 0 ? +((pts / maxPts) * 100).toFixed(1) : 0, gfpg: s.gp > 0 ? +(s.gf / s.gp).toFixed(2) : 0, gapg: s.gp > 0 ? +(s.ga / s.gp).toFixed(2) : 0, diff: s.gf - s.ga };
  });
}

function buildClutch(games, coachName) {
  const cn = norm(coachName);
  let sf_w = 0, sf_g = 0, ot_w = 0, ot_g = 0, lead2_w = 0, lead2_g = 0, trail_w = 0, trail_g = 0, close_w = 0, close_g = 0;
  for (const g of games) {
    const hc = norm(g.coach_home || ''), ac = norm(g.coach_away || '');
    if (hc !== cn && ac !== cn) continue;
    const isHome = hc === cn;
    const sh = Number(g.score_home || 0), sa = Number(g.score_away || 0), ot = !!g.ot;
    const ms = isHome ? sh : sa, os = isHome ? sa : sh;
    const won = ms > os, mg = Math.abs(ms - os);
    if (ot) { ot_g++; if (won) ot_w++; }
    if (mg === 1) { close_g++; if (won) close_w++; }
    const h1 = Number(g.home_1p_g ?? -1), a1 = Number(g.away_1p_g ?? -1);
    if (h1 >= 0 && a1 >= 0) {
      const my1 = isHome ? h1 : a1, op1 = isHome ? a1 : h1;
      if (my1 > 0 && op1 === 0) { sf_g++; if (won) sf_w++; }
      const h2 = Number(g.home_2p_g ?? -1), a2 = Number(g.away_2p_g ?? -1);
      if (h2 >= 0 && a2 >= 0) {
        const my2 = isHome ? h1 + h2 : a1 + a2, op2 = isHome ? a1 + a2 : h1 + h2;
        if (my2 > op2) { lead2_g++; if (won) lead2_w++; }
        if (my2 < op2) { trail_g++; if (won) trail_w++; }
      }
    }
  }
  const pct = (w, g) => g > 0 ? Math.round((w / g) * 100) : 0;
  return [
    { stat: 'SCORED\nFIRST', fullStat: 'SCORED FIRST', value: pct(sf_w, sf_g), gp: sf_g },
    { stat: '1-GOAL\nGAMES', fullStat: '1-GOAL GAMES', value: pct(close_w, close_g), gp: close_g },
    { stat: 'OT W%', fullStat: 'OT W%', value: pct(ot_w, ot_g), gp: ot_g },
    { stat: 'HELD\nLEAD P2', fullStat: 'HELD LEAD P2', value: pct(lead2_w, lead2_g), gp: lead2_g },
    { stat: 'COMEBACK\nW%', fullStat: 'COMEBACK W%', value: pct(trail_w, trail_g), gp: trail_g },
  ];
}

function buildHomAway(games, coachName) {
  const cn = norm(coachName);
  const h = { gp: 0, w: 0, l: 0, t: 0, otl: 0, gf: 0, ga: 0 }, a = { gp: 0, w: 0, l: 0, t: 0, otl: 0, gf: 0, ga: 0 };
  for (const g of games) {
    const hc = norm(g.coach_home || ''), ac = norm(g.coach_away || '');
    if (hc !== cn && ac !== cn) continue;
    const sh = Number(g.score_home || 0), sa = Number(g.score_away || 0), ot = !!g.ot;
    if (hc === cn) {
      h.gp++; h.gf += sh; h.ga += sa;
      const r = gameResult(sh, sa, ot, 'home');
      if (r === 'W') h.w++; else if (r === 'T') h.t++; else if (r === 'OTL') h.otl++; else h.l++;
    } else {
      a.gp++; a.gf += sa; a.ga += sh;
      const r = gameResult(sh, sa, ot, 'away');
      if (r === 'W') a.w++; else if (r === 'T') a.t++; else if (r === 'OTL') a.otl++; else a.l++;
    }
  }
  const row = (s, label) => ({ label, gp: s.gp, w: s.w, l: s.l, t: s.t, otl: s.otl, wpct: s.gp > 0 ? +((s.w / s.gp) * 100).toFixed(1) : 0, gfpg: s.gp > 0 ? +(s.gf / s.gp).toFixed(2) : 0, gapg: s.gp > 0 ? +(s.ga / s.gp).toFixed(2) : 0 });
  return [row(h, 'HOME'), row(a, 'AWAY')];
}

function buildPlayoffByGame(games, coachName) {
  const cn = norm(coachName);
  const byGame = {};
  for (let i = 1; i <= 7; i++) byGame[i] = { w: 0, l: 0, gp: 0 };
  for (const g of games) {
    if (!g._isPlayoff && !PLAYOFF_VALS.has((g.mode || '').toUpperCase())) continue;
    const hc = norm(g.coach_home || ''), ac = norm(g.coach_away || '');
    if (hc !== cn && ac !== cn) continue;
    const gn = Number(g.game_number || 0); if (!gn || gn > 7) continue;
    const sh = Number(g.score_home || 0), sa = Number(g.score_away || 0), ot = !!g.ot;
    const isHome = hc === cn;
    const res = gameResult(sh, sa, ot, isHome ? 'home' : 'away');
    byGame[gn].gp++;
    if (res === 'W') byGame[gn].w++; else if (res !== 'T') byGame[gn].l++;
  }
  return Object.entries(byGame).filter(([, v]) => v.gp > 0).map(([n, v]) => ({ game: `G${n}`, n: +n, w: v.w, l: v.l, gp: v.gp, wpct: v.gp > 0 ? +((v.w / v.gp) * 100).toFixed(0) : 0 }));
}

function buildFinishTrend(games, coachName, allSeasons, champMap, playoffGames) {
  const cn = norm(coachName);

  // ── 1. Build regular-season standings per season ──────────────────────────
  const perSeason = {};
  for (const g of games) {
    if (!rsOnly(g)) continue;
    const lg = g.lg; if (!lg) continue;
    if (!perSeason[lg]) perSeason[lg] = {};
    const sh = Number(g.score_home || 0), sa = Number(g.score_away || 0), ot = !!g.ot;
    const add = (coach, ms, os) => {
      if (!coach) return;
      const c = norm(coach);
      if (!perSeason[lg][c]) perSeason[lg][c] = { pts: 0, gp: 0, gf: 0, ga: 0, coach: coach.trim() };
      const s = perSeason[lg][c];
      s.gp++; s.gf += ms; s.ga += os;
      if (ms > os) s.pts += 2; else if (ms === os) s.pts += 1; else if (ot) s.pts += 1;
    };
    add(g.coach_home, sh, sa); add(g.coach_away, sa, sh);
  }

  // ── 2. Build playoff participants per season from playoff_games ───────────
  //    A coach made playoffs if their team_code appears in team_code_a OR team_code_b
  //    We need a coach→season lookup, so first build a teamCode→coachNorm map per season
  const teamCoachBySeason = {};  // lg → { teamCode → coachNorm }
  for (const g of games) {
    if (!rsOnly(g)) continue;
    const lg = g.lg; if (!lg) continue;
    if (!teamCoachBySeason[lg]) teamCoachBySeason[lg] = {};
    const homeCode = (g.home || '').trim().toUpperCase();
    const awayCode = (g.away || '').trim().toUpperCase();
    if (homeCode && g.coach_home) teamCoachBySeason[lg][homeCode] = norm(g.coach_home);
    if (awayCode && g.coach_away) teamCoachBySeason[lg][awayCode] = norm(g.coach_away);
  }

  // Build: lg → Set<coachNorm> of playoff participants
  const playoffParticipants = {};  // lg → Set<coachNorm>
  // Build: lg → coachNorm of champion (winner of final round's last game)
  const champBySeason = {};        // lg → coachNorm

  if (playoffGames?.length) {
    // Group by season
    const byLg = {};
    for (const pg of playoffGames) {
      const lg = pg.lg; if (!lg) continue;
      if (!byLg[lg]) byLg[lg] = [];
      byLg[lg].push(pg);
    }

    for (const [lg, pGames] of Object.entries(byLg)) {
      const tcMap = teamCoachBySeason[lg] || {};
      if (!playoffParticipants[lg]) playoffParticipants[lg] = new Set();

      for (const pg of pGames) {
        // Both teams in team_code_a and team_code_b are playoff participants
        if (pg.team_code_a) {
          const c = tcMap[pg.team_code_a];
          if (c) playoffParticipants[lg].add(c);
        }
        if (pg.team_code_b) {
          const c = tcMap[pg.team_code_b];
          if (c) playoffParticipants[lg].add(c);
        }
      }

      // Champion = winner of highest round, highest game_number
      const sorted = [...pGames].sort((a, b) =>
        (b.round || 0) - (a.round || 0) ||
        (b.game_number || 0) - (a.game_number || 0)
      );
      const final = sorted[0];
      if (final && final.team_a_score != null && final.team_b_score != null) {
        const winnerCode = Number(final.team_a_score) > Number(final.team_b_score)
          ? final.team_code_a
          : final.team_code_b;
        const winnerCoach = tcMap[winnerCode];
        if (winnerCoach) champBySeason[lg] = winnerCoach;
      }
    }
  }

  // ── 3. Build per-season result rows for this coach ────────────────────────
  return allSeasons
    .filter(lg => perSeason[lg]?.[cn])
    .sort((a, b) => seasonNum(a) - seasonNum(b))
    .map(lg => {
      const standings = Object.entries(perSeason[lg])
        .map(([c, s]) => ({ c, pts: s.pts, gf: s.gf, ga: s.ga }))
        .sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga));
      const pos = standings.findIndex(s => s.c === cn) + 1;
      const total = standings.length;
      const s = perSeason[lg][cn];

      // Use actual playoff_games data if available; fall back to position estimate
      const madePlayoffs = playoffParticipants[lg]
        ? playoffParticipants[lg].has(cn)
        : pos <= Math.ceil(total / 2);

      const isChamp = champBySeason[lg] === cn;

      return {
        season: lg, n: seasonNum(lg), pos, total,
        pts: s.pts, gp: s.gp,
        ptsPct: s.gp > 0 ? +((s.pts / (s.gp * 2)) * 100).toFixed(1) : 0,
        madePlayoffs,
        isChamp,
      };
    });
}

function buildStreaks(games, coachName, allSeasons) {
  const cn = norm(coachName);
  const bySeason = {};
  const sorted = [...games].filter(rsOnly).sort((a, b) => (a.id || 0) - (b.id || 0));
  for (const g of sorted) {
    const hc = norm(g.coach_home || ''), ac = norm(g.coach_away || '');
    if (hc !== cn && ac !== cn) continue;
    const lg = g.lg; if (!lg) continue;
    if (!bySeason[lg]) bySeason[lg] = [];
    const sh = Number(g.score_home || 0), sa = Number(g.score_away || 0), ot = !!g.ot;
    const isHome = hc === cn;
    const res = gameResult(sh, sa, ot, isHome ? 'home' : 'away');
    bySeason[lg].push(res === 'W' ? 'W' : (res === 'L' || res === 'OTL') ? 'L' : 'T');
  }
  const longest = (arr, t) => { let max = 0, cur = 0; for (const r of arr) { if (r === t) { cur++; max = Math.max(max, cur); } else cur = 0; } return max; };
  return allSeasons.filter(lg => bySeason[lg]).sort((a, b) => seasonNum(a) - seasonNum(b)).map(lg => ({ season: lg, longestW: longest(bySeason[lg], 'W'), longestL: longest(bySeason[lg], 'L') }));
}

// ─── LEAGUE VIEW CHARTS ───────────────────────────────────────────────────────

// Scatter: GF/G (x) vs GA/G (y) — lower GA is better, so flip Y
function OffenseDefenseMap({ data, highlightCn, height = 700 }) {
  if (!data.length) return <Empty />;
  const avgGF = data.reduce((s, d) => s + d.gfpg, 0) / data.length;
  const avgGA = data.reduce((s, d) => s + d.gapg, 0) / data.length;

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    const isHL = highlightCn && norm(payload.name) === norm(highlightCn);
    const r = isHL ? 15 : 11;
    const color = payload._color;
    return (
      <g>
        <circle cx={cx} cy={cy} r={r + 4} fill={`${color}22`} />
        <circle cx={cx} cy={cy} r={r} fill={color} stroke={isHL ? '#fff' : C.bg} strokeWidth={isHL ? 3 : 2} />
        <text x={cx} y={cy - r - 8} textAnchor="middle" fill={isHL ? '#fff' : color} fontFamily={F.bc} fontSize={isHL ? 18 : 15} fontWeight={isHL ? 700 : 500} opacity={isHL ? 1 : 0.9}>
          {payload.name}
        </text>
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 40, right: 40, bottom: 50, left: 30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
        <XAxis type="number" dataKey="gfpg" name="GF/G" domain={['auto', 'auto']}
          tick={{ fontFamily: F.vt, fontSize: 24, fill: C.textDim }} tickLine={false} axisLine={{ stroke: C.borderDim }}
          label={{ value: '← OFFENSE: GF/G →', position: 'insideBottom', offset: -22, fontFamily: F.px, fontSize: 11, fill: C.textDim, letterSpacing: 2 }} />
        <YAxis type="number" dataKey="gapg" name="GA/G" reversed domain={['auto', 'auto']}
          tick={{ fontFamily: F.vt, fontSize: 24, fill: C.textDim }} tickLine={false} axisLine={false}
          label={{ value: '↑ DEFENSE: GA/G (lower=better) ↑', angle: -90, position: 'insideLeft', offset: 18, fontFamily: F.px, fontSize: 10, fill: C.textDim }} />
        <Tooltip cursor={false} content={({ active, payload }) => {
          if (!active || !payload?.[0]) return null;
          const d = payload[0].payload;
          return <div style={TT}>
            <div style={{ fontFamily: F.px, fontSize: '.5rem', color: d._color, marginBottom: 6 }}>{d.name}</div>
            <div>GF/G: <strong style={{ color: C.green }}>{d.gfpg}</strong></div>
            <div>GA/G: <strong style={{ color: C.red }}>{d.gapg}</strong></div>
            <div>PTS%: <strong style={{ color: C.gold }}>{d.ptsPct}%</strong></div>
            <div style={{ color: C.textDim, fontSize: '1.1rem', marginTop: 4 }}>{d.gp} GP · {d.seasons} seasons</div>
          </div>;
        }} />
        <ReferenceLine x={avgGF} stroke="rgba(255,255,255,.12)" strokeDasharray="6 4" label={{ value: 'LG AVG', position: 'top', fontFamily: F.px, fontSize: 9, fill: C.textDim }} />
        <ReferenceLine y={avgGA} stroke="rgba(255,255,255,.12)" strokeDasharray="6 4" />
        <Scatter data={data} shape={<CustomDot />} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// Scatter: GF/G (x) vs SF/G (y) — shooting efficiency
function ShotGoalMap({ data, highlightCn }) {
  if (!data.length) return <Empty />;

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    const isHL = highlightCn && norm(payload.name) === norm(highlightCn);
    const r = isHL ? 11 : 8;
    const color = payload._color;
    return (
      <g>
        <circle cx={cx} cy={cy} r={r + 3} fill={`${color}22`} />
        <circle cx={cx} cy={cy} r={r} fill={color} stroke={isHL ? '#fff' : C.bg} strokeWidth={isHL ? 2.5 : 1.5} />
        <text x={cx} y={cy - r - 6} textAnchor="middle" fill={isHL ? '#fff' : color} fontFamily={F.bc} fontSize={isHL ? 14 : 12} fontWeight={isHL ? 700 : 400} opacity={isHL ? 1 : 0.85}>
          {payload.name}
        </text>
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={500}>
      <ScatterChart margin={{ top: 30, right: 30, bottom: 40, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
        <XAxis type="number" dataKey="shPct" name="SH%" domain={['auto', 'auto']}
          tick={{ fontFamily: F.vt, fontSize: 20, fill: C.textDim }} tickLine={false} axisLine={{ stroke: C.borderDim }}
          label={{ value: '← SHOOTING %  →', position: 'insideBottom', offset: -18, fontFamily: F.px, fontSize: 9, fill: C.textDim, letterSpacing: 2 }} />
        <YAxis type="number" dataKey="gfpg" name="GF/G" domain={['auto', 'auto']}
          tick={{ fontFamily: F.vt, fontSize: 20, fill: C.textDim }} tickLine={false} axisLine={false}
          label={{ value: '↑ GF/G ↑', angle: -90, position: 'insideLeft', offset: 14, fontFamily: F.px, fontSize: 8, fill: C.textDim }} />
        <Tooltip cursor={false} content={({ active, payload }) => {
          if (!active || !payload?.[0]) return null;
          const d = payload[0].payload;
          return <div style={TT}>
            <div style={{ fontFamily: F.px, fontSize: '.44rem', color: d._color, marginBottom: 6 }}>{d.name}</div>
            <div>SH%: <strong style={{ color: C.orange }}>{d.shPct}%</strong></div>
            <div>GF/G: <strong style={{ color: C.green }}>{d.gfpg}</strong></div>
            <div style={{ color: C.textDim, fontSize: '1rem', marginTop: 4 }}>{d.gp} GP</div>
          </div>;
        }} />
        <Scatter data={data} shape={<CustomDot />} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// Special teams scatter: PP% vs PK%
function SpecialTeamsMap({ data, highlightCn }) {
  if (!data.length) return <Empty />;
  const avgPP = data.reduce((s, d) => s + d.ppPct, 0) / data.length;
  const avgPK = data.reduce((s, d) => s + d.pkPct, 0) / data.length;

  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    const isHL = highlightCn && norm(payload.name) === norm(highlightCn);
    const r = isHL ? 11 : 8;
    const color = payload._color;
    return (
      <g>
        <circle cx={cx} cy={cy} r={r + 3} fill={`${color}22`} />
        <circle cx={cx} cy={cy} r={r} fill={color} stroke={isHL ? '#fff' : C.bg} strokeWidth={isHL ? 2.5 : 1.5} />
        <text x={cx} y={cy - r - 6} textAnchor="middle" fill={isHL ? '#fff' : color} fontFamily={F.bc} fontSize={isHL ? 14 : 12} fontWeight={isHL ? 700 : 400} opacity={isHL ? 1 : 0.85}>
          {payload.name}
        </text>
      </g>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={500}>
      <ScatterChart margin={{ top: 30, right: 30, bottom: 40, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
        <XAxis type="number" dataKey="ppPct" name="PP%" domain={['auto', 'auto']}
          tick={{ fontFamily: F.vt, fontSize: 20, fill: C.textDim }} tickLine={false} axisLine={{ stroke: C.borderDim }}
          label={{ value: '← POWER PLAY % →', position: 'insideBottom', offset: -18, fontFamily: F.px, fontSize: 9, fill: C.textDim, letterSpacing: 2 }} />
        <YAxis type="number" dataKey="pkPct" name="PK%" domain={['auto', 'auto']}
          tick={{ fontFamily: F.vt, fontSize: 20, fill: C.textDim }} tickLine={false} axisLine={false}
          label={{ value: '↑ PENALTY KILL % ↑', angle: -90, position: 'insideLeft', offset: 14, fontFamily: F.px, fontSize: 8, fill: C.textDim }} />
        <Tooltip cursor={false} content={({ active, payload }) => {
          if (!active || !payload?.[0]) return null;
          const d = payload[0].payload;
          return <div style={TT}>
            <div style={{ fontFamily: F.px, fontSize: '.44rem', color: d._color, marginBottom: 6 }}>{d.name}</div>
            <div>PP%: <strong style={{ color: C.gold }}>{d.ppPct}%</strong></div>
            <div>PK%: <strong style={{ color: C.sky }}>{d.pkPct}%</strong></div>
          </div>;
        }} />
        <ReferenceLine x={avgPP} stroke="rgba(255,255,255,.1)" strokeDasharray="6 4" />
        <ReferenceLine y={avgPK} stroke="rgba(255,255,255,.1)" strokeDasharray="6 4" />
        <Scatter data={data} shape={<CustomDot />} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

// Horizontal ranked bar — all coaches sorted by metric
// Horizontal ranked bar — all coaches sorted by metric
// Horizontal ranked bar — all coaches sorted by metric, with pagination
function RankedBar({ data, metric, unit = '', label, color = C.orange, highlightCn, sortDir = 'desc', pageSize = 10 }) {
  if (!data.length) return <Empty />;
  const sorted = [...data].sort((a, b) => sortDir === 'asc' ? a[metric] - b[metric] : b[metric] - a[metric]);
  const max = Math.max(...sorted.map(r => r[metric]));

  const [visibleCount, setVisibleCount] = useState(Math.min(pageSize, sorted.length));
  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;
  const showingAll = visibleCount >= sorted.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visible.map((row, i) => {
        const isHL = highlightCn && norm(row.name) === norm(highlightCn);
        const pct = max > 0 ? (row[metric] / max) * 100 : 0;
        const barColor = isHL ? C.gold : (row._color || color);
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isHL ? '8px 12px' : '5px 12px', borderRadius: 8, background: isHL ? `${C.gold}12` : 'transparent', border: isHL ? `1px solid ${C.gold}30` : '1px solid transparent', transition: 'all .2s' }}>
            <div style={{ fontFamily: F.vt, fontSize: '1.8rem', color: i < 3 ? [C.gold, 'rgba(192,192,192,.9)', '#cd7f32'][i] : C.textDim, minWidth: 30, textAlign: 'right' }}>{i + 1}</div>
            <div style={{ fontFamily: F.bc, fontSize: '1.1rem', color: isHL ? C.gold : C.textMid, minWidth: 170, fontWeight: isHL ? 700 : 400, letterSpacing: .3 }}>{row.name}</div>
            <div style={{ flex: 1, height: 12, background: 'rgba(255,255,255,.05)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(to right,${barColor}88,${barColor})`, borderRadius: 6, transition: 'width .5s ease' }} />
            </div>
            <div style={{ fontFamily: F.vt, fontSize: '2rem', color: isHL ? C.gold : C.textBright, minWidth: 72, textAlign: 'right', letterSpacing: 1 }}>
              {row[metric]}{unit}
            </div>
          </div>
        );
      })}
      {sorted.length > pageSize && (
        <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
          {hasMore && (
            <button onClick={() => setVisibleCount(v => Math.min(v + pageSize, sorted.length))}
              style={{ fontFamily: F.px, fontSize: '.4rem', letterSpacing: 1, padding: '.6rem 1.2rem', borderRadius: 7, border: `1.5px solid ${color}44`, background: `${color}10`, color, cursor: 'pointer', transition: 'all .14s' }}>
              ▼ NEXT {Math.min(pageSize, sorted.length - visibleCount)}
            </button>
          )}
          {hasMore && (
            <button onClick={() => setVisibleCount(sorted.length)}
              style={{ fontFamily: F.px, fontSize: '.4rem', letterSpacing: 1, padding: '.6rem 1.2rem', borderRadius: 7, border: `1.5px solid ${C.borderDim}`, background: 'transparent', color: C.textDim, cursor: 'pointer', transition: 'all .14s' }}>
              SHOW ALL ({sorted.length})
            </button>
          )}
          {showingAll && visibleCount > pageSize && (
            <button onClick={() => setVisibleCount(pageSize)}
              style={{ fontFamily: F.px, fontSize: '.4rem', letterSpacing: 1, padding: '.6rem 1.2rem', borderRadius: 7, border: `1.5px solid ${C.borderDim}`, background: 'transparent', color: C.textDim, cursor: 'pointer', transition: 'all .14s' }}>
              ▲ COLLAPSE
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── TOP 15 LEADERBOARD ───────────────────────────────────────────────────────
function Leaderboard({ records, metric, label, unit = '', higherBetter = true, coachName = '', accent = C.orange, minGP = 10 }) {
  const filtered = records.filter(r => r.gp >= minGP);
  const sorted = [...filtered].sort((a, b) => higherBetter ? b[metric] - a[metric] : a[metric] - b[metric]);
  const top = sorted.slice(0, 15);
  if (!top.length) return <Empty />;
  const max = Math.max(...top.map(r => r[metric]));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {top.map((r, i) => {
        const isHL = coachName && norm(r.name || r.coach) === norm(coachName);
        const val = r[metric];
        const pct = max > 0 ? (val / max) * 100 : 0;
        const rankColor = i === 0 ? C.gold : i === 1 ? 'rgba(192,192,192,.9)' : i === 2 ? '#cd7f32' : C.textDim;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: isHL ? '9px 14px' : '6px 14px', borderRadius: 10, background: i < 3 ? `${[C.gold,'rgba(192,192,192,.5)','#cd7f32'][i]}0d` : isHL ? `${accent}0d` : 'transparent', border: `1px solid ${i < 3 ? [C.gold,'rgba(192,192,192,.3)','#cd7f32'][i] : isHL ? accent : 'transparent'}22`, transition: 'all .18s' }}>
            <div style={{ fontFamily: F.vt, fontSize: '2rem', color: rankColor, minWidth: 36, textAlign: 'right', lineHeight: 1 }}>
              {i < 3 ? MEDAL[i] : i + 1}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 160 }}>
              <div style={{ fontFamily: F.bc, fontSize: '1.1rem', color: isHL ? C.gold : C.textBright, fontWeight: isHL ? 700 : 500 }}>{r.name || r.coach}</div>
              <div style={{ fontFamily: F.px, fontSize: '.3rem', color: C.textDim, marginTop: 2 }}>{r.season} · {r.gp} GP</div>
            </div>
            <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,.05)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: i === 0 ? `linear-gradient(to right,${C.gold}88,${C.gold})` : `linear-gradient(to right,${accent}55,${accent})`, borderRadius: 5, transition: 'width .4s ease' }} />
            </div>
            <div style={{ fontFamily: F.vt, fontSize: '2.2rem', color: i === 0 ? C.gold : i < 3 ? C.textBright : C.textMid, minWidth: 80, textAlign: 'right', textShadow: i === 0 ? `0 0 18px ${C.gold}55` : 'none' }}>
              {val}{unit}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TEAM PROFILE CHARTS ──────────────────────────────────────────────────────

function FinishTrend({ data }) {
  if (!data?.length) return <Empty msg="NO SEASON DATA" />;
  const CustomDot = (props) => {
    const { cx, cy, payload } = props;
    if (!payload) return null;
    const color = payload.isChamp ? C.gold : payload.madePlayoffs ? C.green : C.red;
    const size = payload.isChamp ? 13 : 8;
    return (
      <g>
        <circle cx={cx} cy={cy} r={size} fill={color} stroke={C.bg} strokeWidth={2.5} />
        {payload.isChamp && <text x={cx} y={cy - 20} textAnchor="middle" fontSize={18} fill={C.gold}>🏆</text>}
      </g>
    );
  };
  return (
    <ResponsiveContainer width="100%" height={320}>
      <ComposedChart data={data} margin={{ top: 32, right: 20, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
        <XAxis dataKey="season" tick={{ fontFamily: F.px, fontSize: 10, fill: C.textDim }} tickLine={false} axisLine={{ stroke: C.borderDim }} />
        <YAxis reversed domain={[1, 'dataMax+1']} tick={{ fontFamily: F.vt, fontSize: 20, fill: C.textDim }} tickLine={false} axisLine={false} label={{ value: 'FINISH', angle: -90, position: 'insideLeft', offset: 14, fontFamily: F.px, fontSize: 7, fill: C.textDim }} />
        <Tooltip content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          const d = payload[0]?.payload;
          return <div style={TT}>
            <div style={{ fontFamily: F.px, fontSize: '.44rem', color: C.sky, marginBottom: 6 }}>{label}</div>
            <div>Finished <strong>#{d.pos}</strong> of {d.total}</div>
            <div style={{ color: C.gold }}>PTS%: {d.ptsPct}%</div>
            <div style={{ color: d.madePlayoffs ? C.green : C.red }}>{d.madePlayoffs ? '✓ Made Playoffs' : '✗ Missed Playoffs'}</div>
            {d.isChamp && <div style={{ color: C.gold }}>🏆 CHAMPION</div>}
          </div>;
        }} />
        <Line type="monotone" dataKey="pos" stroke={C.sky} strokeWidth={3} dot={<CustomDot />} activeDot={false} />
        <Legend content={() => (
          <div style={{ display: 'flex', gap: 18, justifyContent: 'center', paddingTop: 10 }}>
            {[{ c: C.gold, l: '🏆 CHAMPION' }, { c: C.green, l: 'PLAYOFFS' }, { c: C.red, l: 'MISSED' }].map((x, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: F.px, fontSize: 9, color: C.textDim }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: x.c }} />{x.l}
              </div>
            ))}
          </div>
        )} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function CareerArc({ trend, coachName, leagueAvgMap, metric }) {
  const meta = { ptsPct: { label: 'PTS%', suffix: '%', ref: 50 }, gfpg: { label: 'GF/G', suffix: '' }, gapg: { label: 'GA/G', suffix: '' }, diff: { label: 'GD', suffix: '', ref: 0 } }[metric] || { label: 'PTS%', suffix: '%', ref: 50 };
  if (!trend.length) return <Empty msg="NO SEASONS FOUND" />;
  const data = trend.map(t => ({ season: t.season, [coachName]: t[metric] ?? t.ptsPct, 'LG AVG': leagueAvgMap?.[t.season]?.[metric === 'ptsPct' ? 'ptsPct' : 'gfpg'] ?? null }));
  return (
    <ResponsiveContainer width="100%" height={340}>
      <ComposedChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" />
        <XAxis dataKey="season" tick={{ fontFamily: F.px, fontSize: 10, fill: C.textDim }} tickLine={false} axisLine={{ stroke: C.borderDim }} />
        <YAxis tick={{ fontFamily: F.vt, fontSize: 20, fill: C.textDim }} tickLine={false} axisLine={false} />
        <Tooltip content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          return <div style={TT}><div style={{ fontFamily: F.px, fontSize: '.42rem', color: C.orange, marginBottom: 6 }}>{label}</div>{payload.map((p, i) => <div key={i} style={{ color: p.color }}>{p.name}: <strong>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}{meta.suffix}</strong></div>)}</div>;
        }} />
        {meta.ref != null && <ReferenceLine y={meta.ref} stroke="rgba(255,255,255,.1)" strokeDasharray="5 3" />}
        <Line type="monotone" dataKey={coachName} stroke={C.orange} strokeWidth={3.5} dot={{ r: 7, fill: C.orange, stroke: C.bg, strokeWidth: 2 }} activeDot={{ r: 10 }} connectNulls />
        {metric === 'ptsPct' && <Line type="monotone" dataKey="LG AVG" stroke="rgba(255,255,255,.2)" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Build "Team DNA" radar data — 5 dimensions normalized to league range, team vs league avg
// Build full Team DNA percentile data across all tracked categories
function buildTeamDNA(coachName, careerTotals, advStats, teamStatsRows) {
  const cn = norm(coachName);
  const team = careerTotals.find(d => d.cn === cn);
  const teamAdv = advStats.find(d => d.cn === cn);
  if (!team) return null;

  const pool = careerTotals.filter(d => d.gp >= 10);
  const advPool = advStats.filter(d => d.gp >= 10);

  // Compute percentile rank (0-100), optionally inverted (lower raw = better)
  const percentile = (val, arr, key, invert = false) => {
    if (val == null || !arr.length) return null;
    const vals = arr.map(d => d[key]).filter(v => v != null && isFinite(v));
    if (!vals.length) return null;
    const sorted = [...vals].sort((a, b) => a - b);
    const rank = sorted.filter(v => v <= val).length;
    let pct = Math.round((rank / sorted.length) * 100);
    if (invert) pct = 100 - pct;
    return Math.max(0, Math.min(100, pct));
  };

  // Compute actual rank position (1 = best)
  const rankPos = (val, arr, key, higherBetter = true) => {
    if (val == null || !arr.length) return null;
    const sorted = [...arr].filter(d => d[key] != null).sort((a, b) => higherBetter ? b[key] - a[key] : a[key] - b[key]);
    return sorted.findIndex(d => d.cn === cn) + 1;
  };

  // Build per-coach aggregates from teamStatsRows for zone time, PS%, SHG, PPG
  const extraByCoach = {};
  for (const row of (teamStatsRows || [])) {
    const rcn = norm(row.coach || ''); if (!rcn) continue;
    if (!extraByCoach[rcn]) extraByCoach[rcn] = {
      cn: rcn, name: (row.coach || '').trim(),
      atk_secs: 0, def_secs: 0, ps_att: 0, ps_g: 0,
      sh_g: 0, pp_g: 0, xa_shots: 0, xg: 0, gp: 0,
    };
    const s = extraByCoach[rcn];
    // zone time — stored as avg seconds per game in teamStatsRows as atk_time_avg/def_time_avg, or raw seconds
    const atkSecs = Number(row.atk_time_avg || row.atk_secs || 0);
    const defSecs = Number(row.def_time_avg || row.def_secs || 0);
    const gp = Number(row.gp || 1);
    s.atk_secs += atkSecs * gp;
    s.def_secs += defSecs * gp;
    s.ps_att += Number(row.ps_att || row.ps_attempts || 0);
    s.ps_g += Number(row.ps_g || row.ps_goals || 0);
    s.sh_g += Number(row.sh_g || row.shg || 0);
    s.pp_g += Number(row.pp_g || row.pp_goals || 0);
    s.xa_shots += Number(row.xa_shots || row['1xa'] || 0);
    s.xg += Number(row.xg || row['1xg'] || 0);
    s.gp += gp;
  }
  const extraPool = Object.values(extraByCoach).filter(d => d.gp >= 10).map(d => ({
    ...d,
    atkAvg: d.gp > 0 ? d.atk_secs / d.gp : 0,
    defAvg: d.gp > 0 ? d.def_secs / d.gp : 0,
    psPct: d.ps_att > 0 ? +((d.ps_g / d.ps_att) * 100).toFixed(1) : 0,
    shgPG: d.gp > 0 ? +(d.sh_g / d.gp).toFixed(3) : 0,
    ppgPG: d.gp > 0 ? +(d.pp_g / d.gp).toFixed(3) : 0,
    xgPct: d.xa_shots > 0 ? +((d.xg / d.xa_shots) * 100).toFixed(1) : 0,
  }));
  const myExtra = extraPool.find(d => d.cn === cn);

  const secsToMMSS = s => { if (!s) return '0:00'; const m = Math.floor(s / 60), sec = Math.round(s % 60); return `${m}:${String(sec).padStart(2, '0')}`; };

  const cats = [];

  // ── Core scoring ──
  cats.push({ group: 'SCORING', key: 'gfpg', label: 'GF/G', raw: team.gfpg, pct: percentile(team.gfpg, pool, 'gfpg'), rank: rankPos(team.gfpg, pool, 'gfpg'), total: pool.length, higherBetter: true, unit: '', desc: 'Goals for per game' });
  cats.push({ group: 'SCORING', key: 'gapg', label: 'GA/G', raw: team.gapg, pct: percentile(team.gapg, pool, 'gapg', true), rank: rankPos(team.gapg, pool, 'gapg', false), total: pool.length, higherBetter: false, unit: '', desc: 'Goals against per game (lower = better)' });
  cats.push({ group: 'SCORING', key: 'gdpg', label: 'GD/G', raw: team.gdpg, pct: percentile(team.gdpg, pool, 'gdpg'), rank: rankPos(team.gdpg, pool, 'gdpg'), total: pool.length, higherBetter: true, unit: '', desc: 'Goal differential per game' });
  cats.push({ group: 'SCORING', key: 'so', label: 'SHUTOUTS', raw: team.so, pct: percentile(team.so, pool, 'so'), rank: rankPos(team.so, pool, 'so'), total: pool.length, higherBetter: true, unit: '', desc: 'Career shutouts' });

  // ── Advanced shooting ──
  if (teamAdv) {
    cats.push({ group: 'SHOOTING', key: 'shPct', label: 'SH%', raw: `${teamAdv.shPct}%`, pct: percentile(teamAdv.shPct, advPool, 'shPct'), rank: rankPos(teamAdv.shPct, advPool, 'shPct'), total: advPool.length, higherBetter: true, unit: '', desc: 'Shooting percentage' });
    cats.push({ group: 'SHOOTING', key: 'brPct', label: 'BR%', raw: `${teamAdv.brPct}%`, pct: percentile(teamAdv.brPct, advPool, 'brPct'), rank: rankPos(teamAdv.brPct, advPool, 'brPct'), total: advPool.length, higherBetter: true, unit: '', desc: 'Breakaway conversion %' });
  }
  if (myExtra) {
    cats.push({ group: 'SHOOTING', key: 'xgPct', label: '1X%', raw: `${myExtra.xgPct}%`, pct: percentile(myExtra.xgPct, extraPool, 'xgPct'), rank: extraPool.findIndex(d => d.cn === cn) + 1, total: extraPool.length, higherBetter: true, unit: '', desc: 'Expected goals conversion (1X%)' });
  }

  // ── Special teams ──
  if (teamAdv) {
    cats.push({ group: 'SPECIAL TEAMS', key: 'ppPct', label: 'PP%', raw: `${teamAdv.ppPct}%`, pct: percentile(teamAdv.ppPct, advPool, 'ppPct'), rank: rankPos(teamAdv.ppPct, advPool, 'ppPct'), total: advPool.length, higherBetter: true, unit: '', desc: 'Power play %' });
    cats.push({ group: 'SPECIAL TEAMS', key: 'pkPct', label: 'PK%', raw: `${teamAdv.pkPct}%`, pct: percentile(teamAdv.pkPct, advPool, 'pkPct'), rank: rankPos(teamAdv.pkPct, advPool, 'pkPct'), total: advPool.length, higherBetter: true, unit: '', desc: 'Penalty kill %' });
  }
  if (myExtra) {
    cats.push({ group: 'SPECIAL TEAMS', key: 'ppgPG', label: 'PPG/G', raw: myExtra.ppgPG.toFixed(3), pct: percentile(myExtra.ppgPG, extraPool, 'ppgPG'), rank: [...extraPool].sort((a, b) => b.ppgPG - a.ppgPG).findIndex(d => d.cn === cn) + 1, total: extraPool.length, higherBetter: true, unit: '', desc: 'PP goals per game' });
    cats.push({ group: 'SPECIAL TEAMS', key: 'shgPG', label: 'SHG/G', raw: myExtra.shgPG.toFixed(3), pct: percentile(myExtra.shgPG, extraPool, 'shgPG'), rank: [...extraPool].sort((a, b) => b.shgPG - a.shgPG).findIndex(d => d.cn === cn) + 1, total: extraPool.length, higherBetter: true, unit: '', desc: 'Short-handed goals per game' });
    if (myExtra.ps_att > 0) cats.push({ group: 'SPECIAL TEAMS', key: 'psPct', label: 'PS%', raw: `${myExtra.psPct}%`, pct: percentile(myExtra.psPct, extraPool.filter(d => d.ps_att > 0), 'psPct'), rank: [...extraPool.filter(d => d.ps_att > 0)].sort((a, b) => b.psPct - a.psPct).findIndex(d => d.cn === cn) + 1, total: extraPool.filter(d => d.ps_att > 0).length, higherBetter: true, unit: '', desc: 'Penalty shot %' });
  }

  // ── Zone time ──
  if (myExtra) {
    cats.push({ group: 'ZONE TIME', key: 'atkAvg', label: 'ATK TIME', raw: secsToMMSS(myExtra.atkAvg), pct: percentile(myExtra.atkAvg, extraPool, 'atkAvg'), rank: [...extraPool].sort((a, b) => b.atkAvg - a.atkAvg).findIndex(d => d.cn === cn) + 1, total: extraPool.length, higherBetter: true, unit: '', desc: 'Avg attack zone time per game' });
    cats.push({ group: 'ZONE TIME', key: 'defAvg', label: 'DEF TIME', raw: secsToMMSS(myExtra.defAvg), pct: percentile(myExtra.defAvg, extraPool, 'defAvg', true), rank: [...extraPool].sort((a, b) => a.defAvg - b.defAvg).findIndex(d => d.cn === cn) + 1, total: extraPool.length, higherBetter: false, unit: '', desc: 'Avg defensive zone time per game (lower = better)' });
  }

  // ── Passing & discipline ──
  if (teamAdv) {
    cats.push({ group: 'PASSING & DISCIPLINE', key: 'passPct', label: 'PASS%', raw: `${teamAdv.passPct}%`, pct: percentile(teamAdv.passPct, advPool, 'passPct'), rank: rankPos(teamAdv.passPct, advPool, 'passPct'), total: advPool.length, higherBetter: true, unit: '', desc: 'Pass completion %' });
    cats.push({ group: 'PASSING & DISCIPLINE', key: 'penPG', label: 'PEN/G', raw: teamAdv.penPG, pct: percentile(teamAdv.penPG, advPool, 'penPG', true), rank: rankPos(teamAdv.penPG, advPool, 'penPG', false), total: advPool.length, higherBetter: false, unit: '', desc: 'Penalties per game (lower = better)' });
  }

  // Radar subset — 5-6 most meaningful for the polygon
  const radarDims = cats.filter(c => ['gfpg','gapg','ppPct','pkPct','shPct','passPct'].includes(c.key) && c.pct != null)
    .map(c => ({ stat: c.label, fullStat: c.desc, value: c.pct, raw: c.raw }));
  // fallback if no adv stats
  if (radarDims.length < 3) {
    ['gfpg','gapg','gdpg'].forEach(k => {
      const c = cats.find(x => x.key === k);
      if (c && !radarDims.find(r => r.stat === c.label)) radarDims.push({ stat: c.label, fullStat: c.desc, value: c.pct, raw: c.raw });
    });
  }

  return { cats, radarDims };
}

// Percentile bar color: red → yellow → green gradient based on score (0-100)
function pctColor(pct) {
  if (pct == null) return C.textDim;
  if (pct >= 80) return C.green;
  if (pct >= 60) return C.teal;
  if (pct >= 40) return C.gold;
  if (pct >= 20) return C.orange;
  return C.red;
}

function TeamDNARadar({ data, height = 420 }) {
  if (!data) return <Empty msg="NOT ENOUGH DATA" />;

  const { cats, radarDims } = data;

  const CustomTick = ({ x, y, payload }) => {
    const lines = (payload.value || '').split('\n');
    return <text x={x} y={y} textAnchor="middle" fill={C.textMid} fontFamily={F.px} fontSize={11}>{lines.map((l, i) => <tspan key={i} x={x} dy={i === 0 ? 0 : 15}>{l}</tspan>)}</text>;
  };

  // Group categories for the breakdown panel
  const groups = [...new Set(cats.map(c => c.group))];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* ── Radar polygon ── */}
      {radarDims.length >= 3 && (
        <div>
          <div style={{ fontFamily: F.px, fontSize: '.38rem', color: C.textDim, letterSpacing: 3, marginBottom: 10 }}>PERCENTILE RADAR · 50 = LEAGUE AVERAGE</div>
          <ResponsiveContainer width="100%" height={height}>
            <RadarChart data={radarDims} margin={{ top: 30, right: 50, bottom: 30, left: 50 }}>
              <PolarGrid stroke="rgba(255,255,255,.08)" />
              <PolarAngleAxis dataKey="stat" tick={<CustomTick />} />
              <Radar name="LEAGUE AVG" dataKey={() => 50} stroke="rgba(255,255,255,.15)" fill="transparent" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
              <Radar name={data.coachName || 'TEAM'} dataKey="value" stroke={C.orange} fill={C.orange} fillOpacity={0.22} strokeWidth={3.5} dot={{ r: 7, fill: C.orange, stroke: C.bg, strokeWidth: 2.5 }} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = radarDims.find(d => d.stat === label);
                if (!row || row.value == null) return null;
                return <div style={TT}>
                  <div style={{ fontFamily: F.px, fontSize: '.42rem', color: C.orange, marginBottom: 4 }}>{row.fullStat}</div>
                  <div>Value: <strong style={{ color: C.gold }}>{row.raw}</strong></div>
                  <div style={{ color: pctColor(row.value), marginTop: 2 }}>Percentile: <strong>{row.value}</strong> / 100</div>
                </div>;
              }} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Full percentile breakdown by group ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {groups.map(group => (
          <div key={group}>
            {/* Group header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ fontFamily: F.px, fontSize: '.44rem', color: C.textDim, letterSpacing: 3 }}>{group}</div>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.07)' }} />
            </div>

            {/* Category rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cats.filter(c => c.group === group).map((cat, i) => {
                const color = pctColor(cat.pct);
                const pct = cat.pct ?? 0;
                const rankLabel = cat.rank != null && cat.total != null ? `#${cat.rank} of ${cat.total}` : '';
                const isElite = pct >= 80;
                const isPoor = pct <= 20;

                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 80px 90px 100px', alignItems: 'center', gap: 14, padding: '10px 16px', borderRadius: 10, background: isElite ? `${C.green}0a` : isPoor ? `${C.red}0a` : 'rgba(255,255,255,.025)', border: `1px solid ${isElite ? C.green + '30' : isPoor ? C.red + '25' : C.borderDim}`, transition: 'all .2s' }}>

                    {/* Label + description */}
                    <div>
                      <div style={{ fontFamily: F.px, fontSize: '.38rem', color, letterSpacing: 1 }}>{cat.label}</div>
                      {cat.higherBetter === false && <div style={{ fontFamily: F.px, fontSize: '.26rem', color: C.textDim, marginTop: 2 }}>lower=better</div>}
                    </div>

                    {/* Percentile bar */}
                    <div style={{ position: 'relative' }}>
                      {/* Track with league avg marker */}
                      <div style={{ height: 12, background: 'rgba(255,255,255,.06)', borderRadius: 6, overflow: 'visible', position: 'relative' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(to right, ${color}55, ${color})`, borderRadius: 6, transition: 'width .5s ease' }} />
                        {/* League avg marker at 50% */}
                        <div style={{ position: 'absolute', left: '50%', top: -3, bottom: -3, width: 2, background: 'rgba(255,255,255,.25)', borderRadius: 1 }} />
                      </div>
                      {/* Percentile ticks */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 3 }}>
                        {[0, 25, 50, 75, 100].map(t => (
                          <div key={t} style={{ fontFamily: F.px, fontSize: '.22rem', color: C.textDim }}>{t}</div>
                        ))}
                      </div>
                    </div>

                    {/* Percentile number */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: F.vt, fontSize: '2.4rem', color, lineHeight: 1, textShadow: isElite ? `0 0 14px ${C.green}55` : isPoor ? `0 0 10px ${C.red}44` : 'none' }}>{pct}</div>
                      <div style={{ fontFamily: F.px, fontSize: '.26rem', color: C.textDim, marginTop: 1 }}>PCTILE</div>
                    </div>

                    {/* Rank */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontFamily: F.vt, fontSize: '1.7rem', color: cat.rank === 1 ? C.gold : C.textMid, lineHeight: 1, textShadow: cat.rank === 1 ? `0 0 14px ${C.gold}55` : 'none' }}>
                        {cat.rank === 1 ? '👑' : ''} {rankLabel}
                      </div>
                      <div style={{ fontFamily: F.px, fontSize: '.26rem', color: C.textDim, marginTop: 1 }}>RANK</div>
                    </div>

                    {/* Actual value */}
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: F.vt, fontSize: '2.2rem', color: C.textBright, lineHeight: 1 }}>{cat.raw}</div>
                      <div style={{ fontFamily: F.px, fontSize: '.26rem', color: C.textDim, marginTop: 1 }}>VALUE</div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

function HomeAwaySplit({ data }) {
  if (!data?.[0]?.gp) return <Empty msg="NO DATA" />;
  const SLOT_COLORS = [C.orange, C.teal];
  const metrics = [{ key: 'wpct', label: 'WIN%', suffix: '%' }, { key: 'gfpg', label: 'GF/G', suffix: '' }, { key: 'gapg', label: 'GA/G', suffix: '' }];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {metrics.map(m => {
        const maxVal = Math.max(...data.map(x => x[m.key] || 0));
        return (
          <div key={m.key}>
            <div style={{ fontFamily: F.px, fontSize: '.46rem', color: C.textDim, letterSpacing: 2, marginBottom: 8 }}>{m.label}</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {data.map((d, i) => {
                const val = d[m.key];
                const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
                const isWinner = val === maxVal && data[0][m.key] !== data[1][m.key];
                const color = SLOT_COLORS[i];
                return (
                  <div key={i} style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontFamily: F.px, fontSize: '.44rem', color }}>{d.label}</span>
                      <span style={{ fontFamily: F.vt, fontSize: '1.8rem', color: isWinner ? C.gold : C.textMid }}>{val}{m.suffix}{isWinner ? ' ★' : ''}</span>
                    </div>
                    <div style={{ height: 11, background: 'rgba(255,255,255,.06)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(to right,${color}99,${color})`, borderRadius: 5, transition: 'width .4s ease' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, background: `${SLOT_COLORS[i]}0c`, border: `1px solid ${SLOT_COLORS[i]}28`, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontFamily: F.vt, fontSize: '2.2rem', color: SLOT_COLORS[i] }}>{d.gp} GP</div>
            <div style={{ fontFamily: F.px, fontSize: '.44rem', color: C.textDim, marginTop: 4, marginBottom: 6 }}>{d.label} RECORD</div>
            <div style={{ fontFamily: F.vt, fontSize: '1.9rem', color: C.textBright, letterSpacing: 1 }}>
              {d.w}-{d.l}{d.t > 0 ? `-${d.t}` : ''}{d.otl > 0 ? `-${d.otl}` : ''}
              <span style={{ fontFamily: F.px, fontSize: '.32rem', color: C.textDim, marginLeft: 8 }}>
                {d.t > 0 || d.otl > 0 }
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StreakChart({ data }) {
  if (!data?.length) return <Empty msg="NO DATA" />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 14, right: 14, left: -8, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" vertical={false} />
        <XAxis dataKey="season" tick={{ fontFamily: F.px, fontSize: 9, fill: C.textDim }} tickLine={false} axisLine={{ stroke: C.borderDim }} />
        <YAxis tick={{ fontFamily: F.vt, fontSize: 20, fill: C.textDim }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: 'rgba(255,140,0,.05)' }} content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          return <div style={TT}><div style={{ fontFamily: F.px, fontSize: '.4rem', color: C.orange, marginBottom: 5 }}>{label}</div>{payload.map((p, i) => p.value > 0 && <div key={i} style={{ color: p.fill }}>{p.name}: <strong>{p.value}</strong></div>)}</div>;
        }} />
        <Bar dataKey="longestW" name="WIN STREAK" fill={C.green} radius={[6, 6, 0, 0]} barSize={18}>
          <LabelList dataKey="longestW" position="top" formatter={v => v > 0 ? v : ''} style={{ fontFamily: F.px, fontSize: 8, fill: C.green }} />
        </Bar>
        <Bar dataKey="longestL" name="LOSS STREAK" fill={`${C.red}88`} radius={[6, 6, 0, 0]} barSize={18}>
          <LabelList dataKey="longestL" position="top" formatter={v => v > 0 ? v : ''} style={{ fontFamily: F.px, fontSize: 8, fill: C.red }} />
        </Bar>
        <Legend wrapperStyle={{ fontFamily: F.px, fontSize: 8, color: C.textDim, paddingTop: 6 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PlayoffByGame({ data }) {
  if (!data?.length) return <Empty icon="🏅" msg="NO PLAYOFF DATA" />;
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 14, right: 14, left: -8, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.05)" vertical={false} />
        <XAxis dataKey="game" tick={{ fontFamily: F.vt, fontSize: 22, fill: C.textMid }} tickLine={false} axisLine={{ stroke: C.borderDim }} />
        <YAxis tick={{ fontFamily: F.vt, fontSize: 20, fill: C.textDim }} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: 'rgba(255,140,0,.05)' }} content={({ active, payload, label }) => {
          if (!active || !payload?.length) return null;
          const d = data.find(x => x.game === label);
          return <div style={TT}><div style={{ fontFamily: F.px, fontSize: '.42rem', color: C.gold, marginBottom: 5 }}>{label}</div><div style={{ color: C.green }}>W: {d?.w}</div><div style={{ color: C.red }}>L: {d?.l}</div><div>WIN%: {d?.wpct}%</div></div>;
        }} />
        <Bar dataKey="w" name="WINS" stackId="a" fill={C.green}>
          <LabelList dataKey="w" position="center" style={{ fontFamily: F.vt, fontSize: 20, fill: C.bg, fontWeight: 700 }} />
        </Bar>
        <Bar dataKey="l" name="LOSSES" stackId="a" fill={`${C.red}99`} radius={[5, 5, 0, 0]}>
          <LabelList dataKey="l" position="center" style={{ fontFamily: F.vt, fontSize: 20, fill: C.bg, fontWeight: 700 }} />
        </Bar>
        <Legend wrapperStyle={{ fontFamily: F.px, fontSize: 8, color: C.textDim, paddingTop: 6 }} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard({ allGames, allSeasons, leagueGames, managers, mgrMeta, teamStatsRows, computedStandings, champData, allSeasonsData, playoffGames }) {
  const [view, setView] = useState('LEAGUE');         // 'LEAGUE' | 'TEAM'
  const [seasonFilter, setSeasonFilter] = useState('ALL');
  const [gameMode, setGameMode] = useState('RS');     // RS | PO | ALL
  const [coach, setCoach] = useState('');
  const [arcMetric, setArcMetric] = useState('ptsPct');
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = fullscreen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [fullscreen]);

  // Unique coach list from games
  const coachList = useMemo(() => {
    const s = new Set();
    for (const g of leagueGames) {
      if (g.coach_home) s.add(g.coach_home.trim());
      if (g.coach_away) s.add(g.coach_away.trim());
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [leagueGames]);

  useEffect(() => { if (!coach && coachList.length) setCoach(coachList[0]); }, [coachList]);

  // Season-filtered games for LEAGUE view
  const rsGames = useMemo(() => leagueGames.filter(rsOnly), [leagueGames]);
  const seasonFilteredGames = useMemo(() => {
    if (seasonFilter === 'ALL') return rsGames;
    return rsGames.filter(g => g.lg === seasonFilter);
  }, [rsGames, seasonFilter]);

  // Games for TEAM view (respects mode toggle)
  const modeFilteredGames = useMemo(() => {
    if (gameMode === 'RS') return rsGames;
    if (gameMode === 'PO') return leagueGames.filter(g => g._isPlayoff || PLAYOFF_VALS.has((g.mode || '').toUpperCase()));
    return leagueGames;
  }, [leagueGames, rsGames, gameMode]);

  // Core stats
  const allSeasonStats = useMemo(() => buildAllSeasonStats(leagueGames), [leagueGames]);
  const careerTotals = useMemo(() => buildCareerTotals(allSeasonStats), [allSeasonStats]);
  const seasonRecords = useMemo(() => buildSeasonRecords(allSeasonStats), [allSeasonStats]);
  const leagueAvgMap = useMemo(() => buildLeagueAvgBySeason(allSeasonStats, allSeasons), [allSeasonStats, allSeasons]);
  const advStats = useMemo(() => buildAdvStats(teamStatsRows), [teamStatsRows]);
  const champMap = useMemo(() => buildChampMap(allSeasonsData, managers, mgrMeta), [allSeasonsData, managers, mgrMeta]);

  // Season-filtered career totals for scatter plots
  const filteredCareerTotals = useMemo(() => {
    if (seasonFilter === 'ALL') return careerTotals;
    return buildCareerTotals(buildAllSeasonStats(seasonFilteredGames));
  }, [seasonFilter, seasonFilteredGames, careerTotals]);

  // Assign stable colors to coaches
  const coachColorMap = useMemo(() => {
    const sorted = [...coachList].sort((a, b) => a.localeCompare(b));
    const out = {};
    sorted.forEach((c, i) => { out[norm(c)] = TEAM_PAL[i % TEAM_PAL.length]; });
    return out;
  }, [coachList]);

  // Scatter data — career totals with color
  const scatterData = useMemo(() => filteredCareerTotals.filter(d => d.gp >= 10).map(d => ({ ...d, _color: coachColorMap[d.cn] || C.textDim })), [filteredCareerTotals, coachColorMap]);

  // Advanced stats scatter — merged with career totals
  const advScatterData = useMemo(() => {
    const totalsMap = Object.fromEntries(careerTotals.map(d => [d.cn, d]));
    return advStats.filter(d => d.gp >= 10).map(d => ({ ...d, ...(totalsMap[d.cn] || {}), name: d.name, _color: coachColorMap[d.cn] || C.textDim }));
  }, [advStats, careerTotals, coachColorMap]);

  // Season records with coach name attached
  const namedSeasonRecords = useMemo(() => seasonRecords.map(r => ({ ...r, name: r.coach || r.cn })), [seasonRecords]);

  // TEAM view data
  const teamTrend = useMemo(() => coach ? buildCoachSeasonStats(modeFilteredGames, coach, allSeasons) : [], [modeFilteredGames, coach, allSeasons]);
  const teamFinish = useMemo(() => coach ? buildFinishTrend(leagueGames, coach, allSeasons, champMap, playoffGames) : [], [leagueGames, coach, allSeasons, champMap, playoffGames]);
  const teamDNA = useMemo(() => coach ? buildTeamDNA(coach, careerTotals, advStats, teamStatsRows) : null, [coach, careerTotals, advStats, teamStatsRows]);
  const teamStreaks = useMemo(() => coach ? buildStreaks(modeFilteredGames, coach, allSeasons) : [], [modeFilteredGames, coach, allSeasons]);
  const teamPoByGame = useMemo(() => coach ? buildPlayoffByGame(leagueGames, coach) : [], [leagueGames, coach]);
  const teamSummary = useMemo(() => {
    if (!teamTrend.length) return null;
    const gp = teamTrend.reduce((s, t) => s + t.gp, 0), w = teamTrend.reduce((s, t) => s + t.w, 0);
    const gf = teamTrend.reduce((s, t) => s + t.gf, 0), ga = teamTrend.reduce((s, t) => s + t.ga, 0);
    const pts = teamTrend.reduce((s, t) => s + t.pts, 0), so = teamTrend.reduce((s, t) => s + t.so, 0);
    return { gp, w, ptsPct: gp > 0 ? ((pts / (gp * 2)) * 100).toFixed(1) : '—', wpct: gp > 0 ? ((w / gp) * 100).toFixed(1) : '—', gfpg: gp > 0 ? (gf / gp).toFixed(2) : '—', gapg: gp > 0 ? (ga / gp).toFixed(2) : '—', gd: gf - ga, so, seasons: teamTrend.length, champs: teamFinish.filter(f => f.isChamp).length };
  }, [teamTrend, teamFinish]);

  const ARC_METRICS = [{ key: 'ptsPct', label: 'PTS%' }, { key: 'gfpg', label: 'GF/G' }, { key: 'gapg', label: 'GA/G' }, { key: 'diff', label: 'GD' }];

  const seasonOptions = useMemo(() => [{ value: 'ALL', label: 'ALL SEASONS' }, ...[...allSeasons].sort((a, b) => seasonNum(b) - seasonNum(a)).map(s => ({ value: s, label: s }))], [allSeasons]);

  return (
    <div style={{
      background: C.bg,
      minHeight: '100vh',
      padding: '24px 28px 80px',
      maxWidth: fullscreen ? 'none' : 1680,
      margin: '0 auto',
      ...(fullscreen ? { position: 'fixed', inset: 0, zIndex: 9999, overflowY: 'auto' } : {}),
    }}>

      {/* ── Top nav ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <TabBtn id="LEAGUE" current={view} onChange={setView} accent={C.gold}>🏒 LEAGUE HISTORY</TabBtn>
          <TabBtn id="TEAM" current={view} onChange={setView} accent={C.orange}>👤 TEAM PROFILE</TabBtn>
        </div>

        {view === 'LEAGUE' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14 }}>
            <BigSelect value={seasonFilter} onChange={setSeasonFilter} options={seasonOptions} color={C.gold} label="SEASON" />
            <FullscreenToggle active={fullscreen} onClick={() => setFullscreen(f => !f)} />
          </div>
        )}

        {view === 'TEAM' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <BigSelect value={coach} onChange={setCoach} options={coachList.map(c => ({ value: c, label: c }))} color={C.orange} label="COACH" />
            <div style={{ display: 'flex', gap: 8 }}>
              <ModeBtn mode="RS" current={gameMode} onChange={setGameMode}>RS</ModeBtn>
              <ModeBtn mode="PO" current={gameMode} onChange={setGameMode}>PO</ModeBtn>
              <ModeBtn mode="ALL" current={gameMode} onChange={setGameMode}>ALL</ModeBtn>
            </div>
            <FullscreenToggle active={fullscreen} onClick={() => setFullscreen(f => !f)} />
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* LEAGUE VIEW                                               */}
      {/* ══════════════════════════════════════════════════════════ */}
      {view === 'LEAGUE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Scatter 1: Offense vs Defense */}
          <Card title="OFFENSE vs DEFENSE MAP" accent={C.teal}
            subtitle={`GF/G (x-axis) vs GA/G (y-axis, reversed — top is better defense) · ${seasonFilter === 'ALL' ? 'all-time career averages' : seasonFilter} · hover for details`}>
            {scatterData.length >= 2
              ? <OffenseDefenseMap data={scatterData} height={fullscreen ? 850 : 700} />
              : <Empty msg="NOT ENOUGH DATA" />}
          </Card>

          {/* Ranked bar: All-Time PTS% */}
          <Card title="ALL-TIME PTS% RANKING" accent={C.gold}
            subtitle={`Points percentage across ${seasonFilter === 'ALL' ? 'entire career' : seasonFilter} · RS only`}>
            <RankedBar data={filteredCareerTotals.filter(d => d.gp >= 10)} metric="ptsPct" unit="%" label="PTS%" color={C.gold} sortDir="desc" pageSize={10} />
          </Card>

          {/* Ranked bar: GF/G */}
          <Card title="GOALS FOR / GAME RANKING" accent={C.green}
            subtitle="Average goals scored per game (RS)">
            <RankedBar data={filteredCareerTotals.filter(d => d.gp >= 10)} metric="gfpg" label="GF/G" color={C.green} sortDir="desc" pageSize={10} />
          </Card>

          {/* Ranked bar: GA/G */}
          <Card title="GOALS AGAINST / GAME RANKING" accent={C.red}
            subtitle="Average goals allowed per game">
            <RankedBar data={filteredCareerTotals.filter(d => d.gp >= 10)} metric="gapg" label="GA/G" color={C.red} sortDir="asc" pageSize={10} />
          </Card>

          {/* Ranked bar: Win% */}
          <Card title="WIN % RANKING" accent={C.orange}
            subtitle="Overall win percentage (RS)">
            <RankedBar data={filteredCareerTotals.filter(d => d.gp >= 10)} metric="wpct" unit="%" label="WIN%" color={C.orange} sortDir="desc" pageSize={10} />
          </Card>

          {/* Advanced stats scatter: SH% vs GF/G */}
          {advScatterData.length >= 2 && (
            <Card title="SHOOTING EFFICIENCY MAP" accent={C.purple}
              subtitle="Shooting % (x) vs GF/G (y) — upper right = convert chances into goals">
              <ShotGoalMap data={advScatterData} />
            </Card>
          )}

          {/* Advanced stats scatter: PP% vs PK% */}
          {advScatterData.length >= 2 && (
            <Card title="SPECIAL TEAMS MAP" accent={C.sky}
              subtitle="Power Play % (x) vs Penalty Kill % (y) — upper right = elite on both ends">
              <SpecialTeamsMap data={advScatterData} />
            </Card>
          )}

          {/* Advanced ranked bars */}
          {advStats.length > 0 && (
            <>
              <Card title="POWER PLAY % RANKING" accent={C.gold} collapsible
                subtitle="PP goals / PP opportunities">
                <RankedBar data={advScatterData.filter(d => d.ppPct > 0)} metric="ppPct" unit="%" color={C.gold} />
              </Card>
              <Card title="PENALTY KILL % RANKING" accent={C.sky} collapsible
                subtitle="PK success rate — higher is better">
                <RankedBar data={[...advScatterData.filter(d => d.pkPct > 0)].sort((a, b) => b.pkPct - a.pkPct)} metric="pkPct" unit="%" color={C.sky} />
              </Card>
              <Card title="SHOOTING % RANKING" accent={C.orange} collapsible
                subtitle="Goals / shots">
                <RankedBar data={advScatterData.filter(d => d.shPct > 0)} metric="shPct" unit="%" color={C.orange} />
              </Card>
              <Card title="BREAKAWAY % RANKING" accent={C.purple} collapsible
                subtitle="Breakaway goals / breakaway shots">
                <RankedBar data={advScatterData.filter(d => d.brPct > 0)} metric="brPct" unit="%" color={C.purple} />
              </Card>
              <Card title="PASS COMPLETION % RANKING" accent={C.teal} collapsible
                subtitle="Completed passes / attempted passes">
                <RankedBar data={advScatterData.filter(d => d.passPct > 0)} metric="passPct" unit="%" color={C.teal} />
              </Card>
              <Card title="PENALTIES PER GAME RANKING" accent={C.red} collapsible
                subtitle="Lower is better">
                <RankedBar data={[...advScatterData.filter(d => d.penPG > 0)].sort((a, b) => a.penPG - b.penPG)} metric="penPG" color={C.red} />
              </Card>
            </>
          )}

          <Divider label="ALL-TIME SINGLE-SEASON RECORDS · TOP 15" accent="rgba(255,215,0,.35)" />

          {/* Top 15 leaderboards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(540px,1fr))', gap: 24 }}>

            <Card title="BEST PTS% · SINGLE SEASON" accent={C.gold}
              subtitle="Min 10 GP · highest points percentage in a single season">
              <Leaderboard records={namedSeasonRecords} metric="ptsPct" unit="%" accent={C.gold} />
            </Card>

            <Card title="MOST GF/G · SINGLE SEASON" accent={C.green}
              subtitle="Highest goals scored per game in a single season">
              <Leaderboard records={namedSeasonRecords} metric="gfpg" accent={C.green} />
            </Card>

            <Card title="BEST GA/G · SINGLE SEASON" accent={C.sky}
              subtitle="Lowest goals allowed per game — lower is better">
              <Leaderboard records={namedSeasonRecords} metric="gapg" higherBetter={false} accent={C.sky} />
            </Card>

            <Card title="BEST WIN% · SINGLE SEASON" accent={C.orange}
              subtitle="Highest win percentage in a single season">
              <Leaderboard records={namedSeasonRecords} metric="wpct" unit="%" accent={C.orange} />
            </Card>

            <Card title="BEST GOAL DIFF / GAME · SINGLE SEASON" accent={C.teal}
              subtitle="Best GD per game in a single season">
              <Leaderboard records={namedSeasonRecords} metric="gdpg" accent={C.teal} />
            </Card>

            <Card title="MOST SHUTOUTS · SINGLE SEASON" accent={C.purple}
              subtitle="Most shutouts in a single regular season">
              <Leaderboard records={namedSeasonRecords} metric="so" accent={C.purple} />
            </Card>

            {advStats.length > 0 && (() => {
              // Build per-season advanced stat records
              const advBySeason = [];
              for (const row of (teamStatsRows || [])) {
                const cn = norm(row.coach || ''); if (!cn) continue;
                const lg = row.lg || row.season; if (!lg) continue;
                const gp = Number(row.gp || 1);
                if (gp < 10) continue;
                const pp_opps = Number(row.pp_opps || row.pp_opportunities || 0);
                const pk_opps = Number(row.pk_opps || row.pk_opportunities || 0);
                const pk_ga = Number(row.pk_goals_against || 0);
                const br_shots = Number(row.breakaway_shots || 0);
                advBySeason.push({
                  cn, season: lg, n: seasonNum(lg), gp,
                  name: (row.coach || '').trim(),
                  ppPct: pp_opps > 0 ? +((Number(row.pp_goals || 0) / pp_opps) * 100).toFixed(1) : 0,
                  pkPct: pk_opps > 0 ? +(((pk_opps - pk_ga) / pk_opps) * 100).toFixed(1) : 0,
                  brPct: br_shots > 0 ? +((Number(row.breakaway_goals || 0) / br_shots) * 100).toFixed(1) : 0,
                  shPct: Number(row.shots || 0) > 0 ? +((Number(row.goals || row.gf || 0) / Number(row.shots)) * 100).toFixed(1) : 0,
                });
              }
              return (
                <>
                  <Card title="BEST PP% · SINGLE SEASON" accent={C.gold}
                    subtitle="Best power play percentage in a single season">
                    <Leaderboard records={advBySeason.filter(r => r.ppPct > 0)} metric="ppPct" unit="%" accent={C.gold} />
                  </Card>
                  <Card title="BEST PK% · SINGLE SEASON" accent={C.sky}
                    subtitle="Best penalty kill percentage in a single season">
                    <Leaderboard records={advBySeason.filter(r => r.pkPct > 0)} metric="pkPct" unit="%" accent={C.sky} />
                  </Card>
                  <Card title="BEST BREAKAWAY% · SINGLE SEASON" accent={C.purple}
                    subtitle="Best breakaway conversion in a single season">
                    <Leaderboard records={advBySeason.filter(r => r.brPct > 0)} metric="brPct" unit="%" accent={C.purple} />
                  </Card>
                  <Card title="BEST SH% · SINGLE SEASON" accent={C.orange}
                    subtitle="Best shooting percentage in a single season">
                    <Leaderboard records={advBySeason.filter(r => r.shPct > 0)} metric="shPct" unit="%" accent={C.orange} />
                  </Card>
                </>
              );
            })()}
          </div>

          {/* All-Time Records Table */}
          <Card title="ALL-TIME RECORDS" accent={C.pink} collapsible
            subtitle="Career regular season totals for all coaches · sorted by PTS%">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
                <thead>
                  <tr>
                    {['#', 'COACH', 'SEASONS', 'GP', 'W', 'L', 'OTL', 'T', 'PTS', 'PTS%', 'GF/G', 'GA/G', 'GD', 'SO'].map((h, i) => (
                      <th key={i} style={{ fontFamily: F.px, fontSize: '.32rem', color: C.textDim, padding: '10px 10px', borderBottom: `1px solid ${C.borderDim}`, textAlign: i < 2 ? 'left' : 'right', letterSpacing: 1, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {careerTotals.filter(r => r.gp >= 10).map((r, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent', transition: 'background .15s' }}>
                      <td style={{ fontFamily: F.vt, fontSize: '1.7rem', color: i < 3 ? [C.gold, 'rgba(192,192,192,.8)', '#cd7f32'][i] : C.textDim, padding: '9px 10px', textAlign: 'right' }}>{i + 1}</td>
                      <td style={{ fontFamily: F.bc, fontSize: '1.1rem', color: C.textBright, padding: '9px 10px', fontWeight: 600 }}>{r.name}</td>
                      {[r.seasons, r.gp, r.w, r.l, r.otl, r.t, r.pts].map((v, j) => (
                        <td key={j} style={{ fontFamily: F.vt, fontSize: '1.7rem', color: C.textMid, padding: '9px 10px', textAlign: 'right' }}>{v}</td>
                      ))}
                      <td style={{ fontFamily: F.vt, fontSize: '1.7rem', color: C.gold, padding: '9px 10px', textAlign: 'right', textShadow: i === 0 ? `0 0 12px ${C.gold}66` : 'none' }}>{r.ptsPct}%</td>
                      <td style={{ fontFamily: F.vt, fontSize: '1.7rem', color: C.green, padding: '9px 10px', textAlign: 'right' }}>{r.gfpg}</td>
                      <td style={{ fontFamily: F.vt, fontSize: '1.7rem', color: C.red, padding: '9px 10px', textAlign: 'right' }}>{r.gapg}</td>
                      <td style={{ fontFamily: F.vt, fontSize: '1.7rem', color: r.gd >= 0 ? C.green : C.red, padding: '9px 10px', textAlign: 'right' }}>{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                      <td style={{ fontFamily: F.vt, fontSize: '1.7rem', color: C.sky, padding: '9px 10px', textAlign: 'right' }}>{r.so}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════ */}
      {/* TEAM PROFILE VIEW                                         */}
      {/* ══════════════════════════════════════════════════════════ */}
      {view === 'TEAM' && coach && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Coach banner */}
          <div style={{ padding: '20px 24px', background: `${C.orange}0c`, border: `1px solid ${C.orange}30`, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
            <div style={{ fontFamily: F.px, fontSize: '.72rem', color: C.orange, letterSpacing: 2 }}>{coach}</div>
            {teamSummary && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginLeft: 8 }}>
                <StatPill label="SEASONS" value={teamSummary.seasons} color={C.textMid} />
                <StatPill label="GP" value={teamSummary.gp} color={C.textMid} />
                <StatPill label="WIN%" value={`${teamSummary.wpct}%`} color={C.orange} />
                <StatPill label="PTS%" value={`${teamSummary.ptsPct}%`} color={C.gold} />
                <StatPill label="GF/G" value={teamSummary.gfpg} color={C.green} />
                <StatPill label="GA/G" value={teamSummary.gapg} color={C.red} />
                <StatPill label="GD" value={teamSummary.gd > 0 ? `+${teamSummary.gd}` : teamSummary.gd} color={teamSummary.gd >= 0 ? C.green : C.red} />
                <StatPill label="SO" value={teamSummary.so} color={C.sky} />
                {teamSummary.champs > 0 && <StatPill label="🏆 TITLES" value={teamSummary.champs} color={C.gold} />}
              </div>
            )}
          </div>

          {/* Career Arc */}
          <Card title="CAREER ARC" accent={C.orange}
            subtitle={`${coach} season-by-season performance · ${gameMode === 'RS' ? 'Regular Season' : gameMode === 'PO' ? 'Playoffs' : 'All Games'}`}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {ARC_METRICS.map(m => (
                <button key={m.key} onClick={() => setArcMetric(m.key)}
                  style={{ fontFamily: F.px, fontSize: '.42rem', padding: '8px 16px', borderRadius: 7, border: `1.5px solid ${arcMetric === m.key ? C.orange : C.borderDim}`, background: arcMetric === m.key ? `${C.orange}18` : 'transparent', color: arcMetric === m.key ? C.orange : C.textDim, cursor: 'pointer', letterSpacing: 1, transition: 'all .12s' }}>
                  {m.label}
                </button>
              ))}
            </div>
            <CareerArc trend={teamTrend} coachName={coach} leagueAvgMap={leagueAvgMap} metric={arcMetric} />
          </Card>

          {/* Standings Finish */}
          <Card title="STANDINGS FINISH" accent={C.sky}
            subtitle="Season-end placement across all regular seasons · 🏆 = champion">
            <FinishTrend data={teamFinish} />
          </Card>

          {/* Season Streaks */}
          <Card title="SEASON STREAKS" accent={C.green}
            subtitle="Longest win and loss streak per regular season">
            <StreakChart data={teamStreaks} />
          </Card>

          {/* Team DNA */}
          <Card title="TEAM DNA" accent={C.purple}
            subtitle="How this team's profile compares to the league across key dimensions (percentile rank, 50 = league average)">
            <TeamDNARadar data={teamDNA} height={460} />
          </Card>

          
          {/*COMMENTED OUT DUE TO ERROR WITH teamHA until I can resolve
           Home vs Away 
          <Card title="HOME vs AWAY" accent={C.teal}
            subtitle="Split performance breakdown">
            <HomeAwaySplit data={teamHA} />
          </Card> */}

          {/* Playoff Game-by-Game */}
          <Card title="PLAYOFF GAME-BY-GAME" accent={C.gold}
            subtitle="W/L record in each game number across all playoff appearances">
            <PlayoffByGame data={teamPoByGame} />
          </Card>

          {/* Where they rank league-wide */}
          <Card title={`WHERE ${coach.toUpperCase()} RANKS`} accent={C.pink}
            subtitle="Career ranking vs all-time league averages">
            {(() => {
              const sorted = [...careerTotals.filter(d => d.gp >= 10)];
              const rank = (arr, metric, higherBetter = true) => {
                const s = [...arr].sort((a, b) => higherBetter ? b[metric] - a[metric] : a[metric] - b[metric]);
                return s.findIndex(d => norm(d.name) === norm(coach)) + 1;
              };
              const total = sorted.length;
              const rows = [
                { label: 'PTS%', rankVal: rank(sorted, 'ptsPct'), value: sorted.find(d => norm(d.name) === norm(coach))?.ptsPct + '%', color: C.gold },
                { label: 'WIN%', rankVal: rank(sorted, 'wpct'), value: sorted.find(d => norm(d.name) === norm(coach))?.wpct + '%', color: C.orange },
                { label: 'GF/G', rankVal: rank(sorted, 'gfpg'), value: sorted.find(d => norm(d.name) === norm(coach))?.gfpg, color: C.green },
                { label: 'GA/G', rankVal: rank(sorted, 'gapg', false), value: sorted.find(d => norm(d.name) === norm(coach))?.gapg, color: C.red },
                { label: 'GD/G', rankVal: rank(sorted, 'gdpg'), value: sorted.find(d => norm(d.name) === norm(coach))?.gdpg, color: C.teal },
              ];
              return (
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {rows.map((r, i) => r.rankVal > 0 && (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '14px 20px', background: `${r.color}0e`, border: `1px solid ${r.color}28`, borderRadius: 12, minWidth: 110 }}>
                      <div style={{ fontFamily: F.vt, fontSize: '3.2rem', color: r.color, lineHeight: 1, textShadow: `0 0 22px ${r.color}44` }}>#{r.rankVal}</div>
                      <div style={{ fontFamily: F.px, fontSize: '.3rem', color: `${r.color}88`, letterSpacing: 1 }}>{r.label}</div>
                      <div style={{ fontFamily: F.vt, fontSize: '1.6rem', color: C.textMid, marginTop: 2 }}>{r.value}</div>
                      <div style={{ fontFamily: F.px, fontSize: '.26rem', color: C.textDim }}>of {total}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </Card>

        </div>
      )}

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,.04); border-radius: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,140,0,.3); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,140,0,.5); }
      `}</style>
    </div>
  );
}
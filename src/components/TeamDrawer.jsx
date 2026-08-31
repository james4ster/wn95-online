// KEY FIXES:
// 1. Column names corrected: home_brk_g→home_break_goals, home_brk_amt→home_break_attempts,
//    home_atk_time→home_attack (parsed as MM:SS), home_shg→home_shg (was correct)
// 2. True competition ranking (ties share rank, next rank skips)
// 3. H2H section redesigned: last-10 record W-L-T-OTL format, PO badge, no redundant data
// 4. All rank arrays rebuilt with correct column mappings

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../utils/supabaseClient';
import { computeClinchScenario, computeRemainingOpponents } from '../utils/clinchEngine';
import { computeStandings, sortStandings } from '../utils/standingsCalc';


// ─── helpers ────────────────────────────────────────────────────────────────

// Parse "HH:MM:SS" or "MM:SS" — DB stores as "06:16:00" meaning 6min 16sec
function parseTimeToSeconds(val) {
  if (!val) return 0;
  const str = String(val).trim();
  const parts = str.split(':').map(Number);
  if (parts.length >= 2) return parts[0] * 60 + parts[1]; // take MM:SS, ignore HH
  return 0;
}

function buildTeamStats(rows) {
  if (!rows?.length) return [];
  const map = {};
  const ensure = (team) => {
    if (!map[team]) {
      map[team] = {
        team,
        totals: {
          gp: 0, shots: 0, goals: 0, chk: 0, pim: 0,
          pp_g: 0, pp_amt: 0, opp_pp_g: 0, opp_pp_amt: 0,
          fow: 0, fo_total: 0, shg: 0,
          brk_g: 0, brk_amt: 0,
          atk_secs: 0, def_secs: 0,
        },
      };
    }
    return map[team];
  };

  rows.forEach((r) => {
    const home = r.home;
    const away = r.away;
    if (!home || !away) return;
    const h = ensure(home).totals;
    const a = ensure(away).totals;
    h.gp += 1; a.gp += 1;
    h.goals      += r.home_score          || 0;  a.goals     += r.away_score          || 0;
    h.shots      += r.home_shots          || 0; a.shots      += r.away_shots          || 0;
    h.chk        += r.home_chk            || 0; a.chk        += r.away_chk            || 0;
    h.pim        += r.home_pim            || 0; a.pim        += r.away_pim            || 0;
    h.pp_g       += r.home_pp_g           || 0; a.pp_g       += r.away_pp_g           || 0;
    h.pp_amt     += r.home_pp_amt         || 0; a.pp_amt     += r.away_pp_amt         || 0;
    h.fow        += r.home_fow            || 0; a.fow        += r.away_fow            || 0;
    h.fo_total   += r.fo_total            || 0; a.fo_total   += r.fo_total            || 0;
    h.shg        += r.home_shg            || 0; a.shg        += r.away_shg            || 0;
    h.opp_pp_g   += r.away_pp_g           || 0; a.opp_pp_g   += r.home_pp_g           || 0;
    h.opp_pp_amt += r.away_pp_amt         || 0; a.opp_pp_amt += r.home_pp_amt         || 0;
    // FIXED: correct column names from DB
    h.brk_g      += r.home_break_goals    || 0; a.brk_g      += r.away_break_goals    || 0;
    h.brk_amt    += r.home_break_attempts || 0; a.brk_amt    += r.away_break_attempts || 0;
    // FIXED: parse time strings correctly (DB: "06:16:00" = 6min 16sec)
    h.atk_secs   += parseTimeToSeconds(r.home_attack); a.atk_secs += parseTimeToSeconds(r.away_attack);
    h.def_secs   += parseTimeToSeconds(r.away_attack); a.def_secs += parseTimeToSeconds(r.home_attack);
  });
  return Object.values(map);
}

function fmtTime(seconds) {
  if (seconds == null || isNaN(seconds) || seconds === 0) return null;
  const totalSec = Math.round(seconds);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function deriveStats(t) {
  if (!t) return {};
  return {
    ppPct:        t.pp_amt      ? ((t.pp_g / t.pp_amt) * 100).toFixed(1)                : null,
    pkPct:        t.opp_pp_amt  ? (100 - (t.opp_pp_g / t.opp_pp_amt) * 100).toFixed(1) : null,
    foPct:        t.fo_total    ? ((t.fow / t.fo_total) * 100).toFixed(1)                : null,
    shotsPerGame: t.gp          ? (t.shots / t.gp).toFixed(1)                            : null,
    hitsPerGame:  t.gp          ? (t.chk   / t.gp).toFixed(1)                            : null,
    pimPerGame:   t.gp          ? (t.pim   / t.gp).toFixed(1)                            : null,
    shPct:        t.shots       ? ((t.goals / t.shots) * 100).toFixed(1)                : null,
    brkPct:       t.brk_amt     ? ((t.brk_g / t.brk_amt) * 100).toFixed(1)              : null,
    atkPerGame:   fmtTime(t.gp  ? t.atk_secs / t.gp : null),
    defPerGame:   fmtTime(t.gp  ? t.def_secs / t.gp : null),
    atkSecPerGame: t.gp         ? t.atk_secs / t.gp : null,
    defSecPerGame: t.gp         ? t.def_secs / t.gp : null,
  };
}

function rankColor(r, total) {
  if (!r || !total) return 'rgba(255,255,255,.35)';
  const pct = r / total;
  if (r === 1)     return '#FFD700';
  if (r <= 3)      return '#FF8C00';
  if (pct <= 0.25) return '#87CEEB';
  if (pct <= 0.5)  return 'rgba(255,255,255,.6)';
  return 'rgba(255,255,255,.3)';
}

/** TRUE competition ranking — rank = count of players strictly better + 1
 *  e.g. if 120 players have 2+ assists and you have 1, you rank #121, not #20
 */
function rankVal(val, allVals, hi = true) {
  if (val == null || val === '' || !allVals?.length) return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;

  const nums = allVals.map(v => parseFloat(v)).filter(v => !isNaN(v));
  // Count how many values are strictly better than n
  const betterCount = nums.filter(v => hi ? v > n + 0.0001 : v < n - 0.0001).length;
  return betterCount + 1;
}

/** Rank a value within computedStandings by key — TRUE competition ranking */
function rankInStandings(myVal, key, computedStandings, hi = true) {
  if (myVal == null) return null;
  const vals = (computedStandings || [])
    .map(s => s[key])
    .filter(v => v != null && !isNaN(Number(v)));
  return rankVal(myVal, vals, hi);
}

/** TRUE competition ranking for players — rank = count of players strictly better + 1 */
function computeLeagueRanks(allPlayers, statKeys) {
  const ranks = {};
  statKeys.forEach((key) => {
    const nums = allPlayers
      .filter(p => p[key] != null && p[key] !== '' && !isNaN(parseFloat(p[key])))
      .map(p => ({ name: p.player_name, val: parseFloat(p[key]) }));

    allPlayers.forEach(p => {
      const n = parseFloat(p[key]);
      if (isNaN(n)) return;
      if (!ranks[p.player_name]) ranks[p.player_name] = {};
      // Count players strictly better (higher is better for all current uses)
      const betterCount = nums.filter(({ val }) => val > n + 0.0001).length;
      ranks[p.player_name][key] = betterCount + 1;
    });
  });
  return ranks;
}

/** Build all team rank arrays in one pass.
 *  IMPORTANT: store values rounded to same precision as the display strings
 *  so that rankVal's parseFloat comparison works correctly.
 *  e.g. ptsPct display = "68.8" → store 68.8 (1 dp), not 68.8333...
 */
function buildAllTeamRankArrays(allTeamTotals, computedStandings) {
  const arr = (fn) => allTeamTotals.map(fn).filter(v => v != null && !isNaN(parseFloat(v)));
  return {
    allPP:     arr(t => t.derived?.ppPct),       // already toFixed(1) string
    allPK:     arr(t => t.derived?.pkPct),
    allSHG:    arr(t => t.totals?.shg),
    allFO:     arr(t => t.derived?.foPct),
    allSPG:    arr(t => t.derived?.shotsPerGame),
    allHPG:    arr(t => t.derived?.hitsPerGame),
    allSHP:    arr(t => t.derived?.shPct),
    allBRK:    arr(t => t.derived?.brkPct),
    allPIM:    arr(t => t.derived?.pimPerGame),
    allATKsec: arr(t => t.totals?.gp > 0 ? t.totals.atk_secs / t.totals.gp : null),
    allDEFsec: arr(t => t.totals?.gp > 0 ? t.totals.def_secs / t.totals.gp : null),
    // Round to same dp as display values so parseFloat comparison succeeds
    allPtsPct: (computedStandings || [])
      .map(s => s.gp > 0 ? parseFloat(((s.pts / (s.gp * 2)) * 100).toFixed(1)) : null)
      .filter(v => v != null),
    allGfPerG: (computedStandings || [])
      .map(s => s.gp > 0 ? parseFloat((s.gf / s.gp).toFixed(2)) : null)
      .filter(v => v != null),
    allGaPerG: (computedStandings || [])
      .map(s => s.gp > 0 ? parseFloat((s.ga / s.gp).toFixed(2)) : null)
      .filter(v => v != null),
    total: Math.max((computedStandings || []).length, allTeamTotals.length, 1),
  };
}

// ─── style constants ─────────────────────────────────────────────────────────

const thStyle = {
  fontFamily: "'Press Start 2P', monospace",
  fontSize: '.38rem',
  color: 'rgba(255,255,255,.4)',
  textAlign: 'center',
  padding: '6px 4px',
  borderBottom: '1px solid rgba(255,255,255,.1)',
  letterSpacing: 1,
  fontWeight: 400,
};
const tdStyle = {
  padding: '5px 4px',
  textAlign: 'center',
  verticalAlign: 'middle',
};

// ─── sub-components ──────────────────────────────────────────────────────────

function StatRow({ label, value, rank, colorVal = null, total = 1 }) {
  const dispVal = (value != null && value !== '') ? String(value) : '—';
  let valColor = 'rgba(255,255,255,.85)';
  if (colorVal === 'gd' && value != null) {
    const n = parseFloat(value);
    valColor = n > 0 ? '#00c853' : n < 0 ? '#ff4444' : '#888';
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto 1fr',
      alignItems: 'center',
      padding: '5px 14px',
      borderBottom: '1px solid rgba(255,255,255,.04)',
    }}>
      {/* Value — right-aligned, close to label */}
      <div style={{ fontFamily: "'VT323', monospace", fontSize: '1.2rem', color: valColor, letterSpacing: .5, textAlign: 'right', paddingRight: 14 }}>
        {dispVal}
      </div>
      {/* Label — center, fixed width */}
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.35)', fontFamily: "'Press Start 2P', monospace", fontSize: '.58rem', letterSpacing: 1, whiteSpace: 'nowrap', minWidth: 100 }}>
        {label}
      </div>
      {/* Rank — left-aligned, close to label */}
      <div style={{ textAlign: 'left', paddingLeft: 14 }}>
        {rank != null
          ? <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.5rem', color: rankColor(rank, total) }}>#{rank}</span>
          : <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.5rem', color: 'rgba(255,255,255,.12)' }}>—</span>
        }
      </div>
    </div>
  );
}

function CompareStatRow({ label, valA, valB, rank_a, rank_b, total, higherIsBetter = true, suffix = '' }) {
  const fmt   = (v) => (v == null || v === '' ? '—' : `${v}${suffix}`);
  const nA    = parseFloat(valA);
  const nB    = parseFloat(valB);
  const aWins = !isNaN(nA) && !isNaN(nB) && (higherIsBetter ? nA > nB : nA < nB);
  const bWins = !isNaN(nA) && !isNaN(nB) && (higherIsBetter ? nB > nA : nB < nA);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr 110px 1fr 44px', alignItems: 'center', padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,.06)', fontFamily: "'VT323', monospace", fontSize: '1.15rem', letterSpacing: .5 }}>
      <div style={{ textAlign: 'left',  color: rankColor(rank_a, total), fontFamily: "'Press Start 2P', monospace", fontSize: '.5rem' }}>{rank_a ? `#${rank_a}` : '—'}</div>
      <div style={{ textAlign: 'left',  color: aWins ? '#FF8C00' : 'rgba(255,255,255,.8)', fontWeight: aWins ? 700 : 400 }}>{fmt(valA)}</div>
      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,.35)', fontFamily: "'Press Start 2P', monospace", fontSize: '.6rem', letterSpacing: 1 }}>{label}</div>
      <div style={{ textAlign: 'right', color: bWins ? '#87CEEB'  : 'rgba(255,255,255,.8)', fontWeight: bWins ? 700 : 400 }}>{fmt(valB)}</div>
      <div style={{ textAlign: 'right', color: rankColor(rank_b, total), fontFamily: "'Press Start 2P', monospace", fontSize: '.5rem' }}>{rank_b ? `#${rank_b}` : '—'}</div>
    </div>
  );
}

function PlayerTable({ players, statKeys, colLabels, ranks, title, leagueTotal, accentColor }) {
  const sorted = useMemo(() =>
    [...players].sort((a, b) => (b.points ?? b.saves ?? 0) - (a.points ?? a.saves ?? 0)),
    [players]
  );
  if (!sorted.length) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      {title && (
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.4rem', color: accentColor ? `${accentColor}99` : 'rgba(135,206,235,.65)', letterSpacing: 2, marginBottom: 6, paddingLeft: 2 }}>
          {title}
        </div>
      )}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '26%' }} />
            {statKeys.map((_, i) => <col key={i} style={{ width: `${74 / statKeys.length}%` }} />)}
          </colgroup>
          <thead>
            <tr>
              <th style={thStyle}>PLAYER</th>
              {colLabels.map((l, i) => <th key={i} style={thStyle}>{l}</th>)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, idx) => (
              <tr key={p.player_name + idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,.03)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <td style={{ ...tdStyle, textAlign: 'left', paddingLeft: 8, color: '#E8E8E8', fontFamily: "'Barlow Condensed', sans-serif", fontSize: '.95rem', fontWeight: 600, letterSpacing: .5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.player_name}
                </td>
                {statKeys.map((key) => {
                  const val  = p[key];
                  const r    = ranks?.[p.player_name]?.[key];
                  const disp = (val != null && val !== '') ? val : '—';
                  return (
                    <td key={key} style={tdStyle}>
                      <span style={{ fontFamily: "'VT323', monospace", fontSize: '1.2rem', color: '#E0E0E0' }}>{disp}</span>
                      {r != null && (
                        <span style={{ fontSize: '.42rem', fontFamily: "'Press Start 2P', monospace", color: rankColor(r, leagueTotal), marginLeft: 3 }}>
                          ({r})
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function aggregateAndEnrichGoalies(rawGoalies) {
  const map = {};
  rawGoalies.forEach((r) => {
    const k = `${r.team_code}::${r.player_name}`;
    if (!map[k]) map[k] = {
      player_name: r.player_name, team_code: r.team_code,
      goals_against: 0, saves: 0, shutouts: 0, shots_against: 0,
      goals: 0, assists: 0, points: 0, _gp: 0,
    };
    map[k].goals_against  += r.goals_against  || 0;
    map[k].saves          += r.saves          || 0;
    map[k].shutouts       += r.shutouts       || 0;
    map[k].shots_against  += r.shots_against  || 0;
    map[k].goals          += r.goals          || 0;
    map[k].assists        += r.assists        || 0;
    map[k].points         += r.points         || 0;
    map[k]._gp            += 1;
  });
  return Object.values(map).map(p => ({
    ...p,
    _gaa:   (p._gp > 0 && p.shots_against > 0) ? (p.goals_against / p._gp).toFixed(2) : null,
    _svpct: (p._gp > 0 && p.shots_against > 0) ? ((p.saves / p.shots_against) * 100).toFixed(1) : null,
  }));
}

// ─── H2H log — REDESIGNED ────────────────────────────────────────────────────

function H2HLog({ games, teamA, teamB }) {
  if (!games?.length) {
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.46rem', color: 'rgba(135,206,235,.65)', letterSpacing: 2, marginBottom: 7 }}>
          HEAD TO HEAD
        </div>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.38rem', color: 'rgba(255,255,255,.2)', textAlign: 'center', padding: '20px 0', letterSpacing: 1 }}>
          NO GAMES PLAYED BETWEEN THESE TEAMS
        </div>
      </div>
    );
  }

  const last10 = games.slice(0, 10);

  // Build W-L-T-OTL record from teamA perspective over last 10
  let wA = 0, lA = 0, tA = 0, otlA = 0;
  let wB = 0, lB = 0, tB = 0, otlB = 0;

  last10.forEach((g) => {
    const aIsHome = g._homeTeam === teamA;
    const sA = aIsHome ? g._homeScore : g._awayScore;
    const sB = aIsHome ? g._awayScore : g._homeScore;
    if (sA > sB) {
      if (g._ot) { wA++; otlB++; } else { wA++; lB++; }
    } else if (sB > sA) {
      if (g._ot) { otlA++; wB++; } else { lA++; wB++; }
    } else {
      tA++; tB++;
    }
  });

  const fmtRecord = (w, l, t, otl) => {
    const parts = [w, l];
    if (t > 0 || otl > 0) parts.push(t);
    if (otl > 0) parts.push(otl);
    return parts.join('-');
  };

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.46rem', color: 'rgba(135,206,235,.65)', letterSpacing: 2, marginBottom: 10 }}>
        HEAD TO HEAD — LAST {last10.length}
      </div>

      {/* Record summary — compact, no redundant data */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 10, background: 'linear-gradient(135deg, rgba(255,140,0,.07) 0%, rgba(0,0,0,.3) 50%, rgba(135,206,235,.07) 100%)', borderRadius: 8, border: '1px solid rgba(255,255,255,.07)' }}>

        {/* Team A */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ width: 28, height: 28, background: 'rgba(0,0,0,.4)', borderRadius: 6, border: '1px solid rgba(255,140,0,.35)', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
            <img src={`/assets/teamLogos/${teamA}.png`} alt={teamA} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
          </div>
          {/* L10 record — large */}
          <div style={{ fontFamily: "'VT323', monospace", fontSize: '2.1rem', color: '#FF8C00', lineHeight: 1, textShadow: '0 0 16px rgba(255,140,0,.6)', letterSpacing: 1 }}>
            {fmtRecord(wA, lA, tA, otlA)}
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.3rem', color: 'rgba(255,140,0,.45)', letterSpacing: 1 }}>{teamA} L{last10.length}</div>
        </div>

        {/* Center VS */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.32rem', color: 'rgba(255,255,255,.18)', letterSpacing: 2 }}>VS</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.25rem', color: 'rgba(255,255,255,.2)', letterSpacing: 1, whiteSpace: 'nowrap' }}>W-L-T-OTL</div>
        </div>

        {/* Team B */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{ width: 28, height: 28, background: 'rgba(0,0,0,.4)', borderRadius: 6, border: '1px solid rgba(135,206,235,.35)', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
            <img src={`/assets/teamLogos/${teamB}.png`} alt={teamB} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
          </div>
          <div style={{ fontFamily: "'VT323', monospace", fontSize: '2.1rem', color: '#87CEEB', lineHeight: 1, textShadow: '0 0 16px rgba(135,206,235,.6)', letterSpacing: 1 }}>
            {fmtRecord(wB, lB, tB, otlB)}
          </div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.3rem', color: 'rgba(135,206,235,.45)', letterSpacing: 1 }}>{teamB} L{last10.length}</div>
        </div>
      </div>

      {/* Game-by-game log */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {last10.map((g, idx) => {
          const aIsHome = g._homeTeam === teamA;
          const sA      = aIsHome ? g._homeScore : g._awayScore;
          const sB      = aIsHome ? g._awayScore : g._homeScore;
          const aWon    = sA > sB;
          const bWon    = sB > sA;
          const isOT    = !!g._ot;
          const isPO    = !!g._isPlayoff;
          return (
            <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto 1fr auto', alignItems: 'center', gap: 6, padding: '5px 10px', background: isPO ? 'rgba(255,215,0,.04)' : 'rgba(255,255,255,.03)', borderRadius: 5, border: isPO ? '1px solid rgba(255,215,0,.12)' : '1px solid rgba(255,255,255,.05)', borderLeft: aWon ? '3px solid #FF8C00' : bWon ? '3px solid #87CEEB' : '3px solid rgba(255,255,255,.12)' }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '.95rem', color: aWon ? '#FF8C00' : 'rgba(255,255,255,.35)', letterSpacing: .5, textAlign: 'right' }}>{teamA}</span>
              <span style={{ fontFamily: "'VT323', monospace", fontSize: '1.5rem', color: aWon ? '#FFD700' : 'rgba(255,255,255,.3)', minWidth: 22, textAlign: 'center', lineHeight: 1 }}>{sA}</span>
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.3rem', color: 'rgba(255,255,255,.2)' }}>–</span>
              <span style={{ fontFamily: "'VT323', monospace", fontSize: '1.5rem', color: bWon ? '#FFD700' : 'rgba(255,255,255,.3)', minWidth: 22, textAlign: 'center', lineHeight: 1 }}>{sB}</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '.95rem', color: bWon ? '#87CEEB' : 'rgba(255,255,255,.35)', letterSpacing: .5 }}>{teamB}</span>
              {/* Badges: OT and/or PO */}
              <div style={{ display: 'flex', gap: 3, justifyContent: 'flex-end', minWidth: 40 }}>
                {isOT && !isPO && <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.28rem', color: '#87CEEB', border: '1px solid rgba(135,206,235,.35)', borderRadius: 3, padding: '2px 3px' }}>OT</span>}
                {isPO && <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.28rem', color: '#FFD700', border: '1px solid rgba(255,215,0,.4)', borderRadius: 3, padding: '2px 3px', background: 'rgba(255,215,0,.07)' }}>PO</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamSectionDivider({ team, accentColor, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 10px' }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${accentColor}66)` }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 10px 4px 6px', background: `linear-gradient(135deg, ${accentColor}18, ${accentColor}08)`, border: `1px solid ${accentColor}44`, borderRadius: 20, boxShadow: `0 0 12px ${accentColor}22` }}>
        <div style={{ width: 24, height: 24, background: 'rgba(0,0,0,.4)', borderRadius: 6, border: `1px solid ${accentColor}55`, padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <img src={`/assets/teamLogos/${team}.png`} alt={team} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
        </div>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '1rem', color: accentColor, letterSpacing: 1, lineHeight: 1, textShadow: `0 0 8px ${accentColor}66` }}>{team}</div>
          <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.28rem', color: `${accentColor}77`, letterSpacing: 1, marginTop: 1 }}>{label}</div>
        </div>
      </div>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${accentColor}66)` }} />
    </div>
  );
}

function LabelDivider({ label, accentColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 10px' }}>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${accentColor}33)` }} />
      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.3rem', color: `${accentColor}66`, letterSpacing: 2, padding: '2px 8px', border: `1px solid ${accentColor}22`, borderRadius: 4 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${accentColor}33)` }} />
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,140,0,.2) 30%, rgba(255,140,0,.2) 70%, transparent)', margin: '14px 0' }} />;
}

// ── Single-team stat panel ────────────────────────────────────────────────────
function SingleTeamStats({ totals, derived, standing, allTeamTotals, computedStandings }) {
  const ra = buildAllTeamRankArrays(allTeamTotals, computedStandings);

  const ptsPct = standing?.gp > 0 ? ((standing.pts / (standing.gp * 2)) * 100).toFixed(1) : null;
  const gfPerG = standing?.gp > 0 ? (standing.gf / standing.gp).toFixed(2) : null;
  const gaPerG = standing?.gp > 0 ? (standing.ga / standing.gp).toFixed(2) : null;

  const rows = [
    { label: 'PTS',
      val:  standing?.pts,
      rank: rankInStandings(standing?.pts, 'pts', computedStandings, true) },
    { label: 'W',
      val:  standing?.w,
      rank: rankInStandings(standing?.w, 'w', computedStandings, true) },
    { label: 'PTS%',
      val:  ptsPct != null ? `${ptsPct}%` : null,
      rank: rankVal(ptsPct, ra.allPtsPct, true) },
    { label: 'GF',
      val:  standing?.gf,
      rank: rankInStandings(standing?.gf, 'gf', computedStandings, true) },
    { label: 'GF/G',
      val:  gfPerG,
      rank: rankVal(gfPerG, ra.allGfPerG, true) },
    { label: 'GA',
      val:  standing?.ga,
      rank: rankInStandings(standing?.ga, 'ga', computedStandings, false) },
    { label: 'GA/G',
      val:  gaPerG,
      rank: rankVal(gaPerG, ra.allGaPerG, false) },
    { label: 'GD',
      val:  standing?.gd != null ? (standing.gd > 0 ? `+${standing.gd}` : String(standing.gd)) : null,
      rank: rankInStandings(standing?.gd, 'gd', computedStandings, true),
      colorMode: 'gd' },
    { label: 'PP%',
      val:  derived?.ppPct != null ? `${derived.ppPct}%` : null,
      rank: rankVal(derived?.ppPct, ra.allPP, true) },
    { label: 'PK%',
      val:  derived?.pkPct != null ? `${derived.pkPct}%` : null,
      rank: rankVal(derived?.pkPct, ra.allPK, true) },
    { label: 'SHG',
      val:  totals?.shg,
      rank: rankVal(totals?.shg, ra.allSHG, true) },
    { label: 'SH%',
      val:  derived?.shPct != null ? `${derived.shPct}%` : null,
      rank: rankVal(derived?.shPct, ra.allSHP, true) },
    { label: 'BR%',
      val:  derived?.brkPct != null ? `${derived.brkPct}%` : null,
      rank: rankVal(derived?.brkPct, ra.allBRK, true) },
    { label: 'FO%',
      val:  derived?.foPct != null ? `${derived.foPct}%` : null,
      rank: rankVal(derived?.foPct, ra.allFO, true) },
    { label: 'SHOTS/G',
      val:  derived?.shotsPerGame,
      rank: rankVal(derived?.shotsPerGame, ra.allSPG, true) },
    { label: 'HITS/G',
      val:  derived?.hitsPerGame,
      rank: rankVal(derived?.hitsPerGame, ra.allHPG, true) },
    { label: 'ATK/G',   val: derived?.atkPerGame,  rank: rankVal(derived?.atkSecPerGame, ra.allATKsec, true) },
    { label: 'DEF/G',   val: derived?.defPerGame,  rank: rankVal(derived?.defSecPerGame, ra.allDEFsec, false) },
    { label: 'PIM/G',   val: derived?.pimPerGame,  rank: rankVal(derived?.pimPerGame, ra.allPIM, true) },
  ];

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.46rem', color: 'rgba(135,206,235,.65)', letterSpacing: 2, marginBottom: 7 }}>TEAM STATS</div>
      <div style={{ background: 'rgba(255,255,255,.025)', borderRadius: 8, border: '1px solid rgba(255,255,255,.06)', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', padding: '4px 14px', borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.03)' }}>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.35rem', color: 'rgba(255,255,255,.25)', textAlign: 'right', paddingRight: 14 }}>VALUE</span>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.35rem', color: 'rgba(255,255,255,.25)', textAlign: 'center', minWidth: 100 }}>STAT</span>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.35rem', color: 'rgba(255,255,255,.25)', paddingLeft: 14 }}>RANK</span>
        </div>
        {rows.map((r) => (
          <StatRow
            key={r.label}
            label={r.label}
            value={r.val}
            rank={r.rank}
            colorVal={r.colorMode}
            total={ra.total}
          />
        ))}
      </div>
    </div>
  );
}

// ── Compare two teams stat panel ─────────────────────────────────────────────
function CompareTeamStats({ totalsA, totalsB, derivedA, derivedB, teamA, teamB, standingsA, standingsB, allTeamTotals, computedStandings }) {
  const ra = buildAllTeamRankArrays(allTeamTotals, computedStandings);
  const { total } = ra;

  const ptsPctA = standingsA?.gp > 0 ? ((standingsA.pts / (standingsA.gp * 2)) * 100).toFixed(1) : null;
  const ptsPctB = standingsB?.gp > 0 ? ((standingsB.pts / (standingsB.gp * 2)) * 100).toFixed(1) : null;
  const gfPerGA = standingsA?.gp > 0 ? (standingsA.gf / standingsA.gp).toFixed(2) : null;
  const gfPerGB = standingsB?.gp > 0 ? (standingsB.gf / standingsB.gp).toFixed(2) : null;
  const gaPerGA = standingsA?.gp > 0 ? (standingsA.ga / standingsA.gp).toFixed(2) : null;
  const gaPerGB = standingsB?.gp > 0 ? (standingsB.ga / standingsB.gp).toFixed(2) : null;

  const rows = [
    { label: 'PTS',
      vA: standingsA?.pts, vB: standingsB?.pts,
      rA: rankInStandings(standingsA?.pts, 'pts', computedStandings, true),
      rB: rankInStandings(standingsB?.pts, 'pts', computedStandings, true), hi: true },
    { label: 'W',
      vA: standingsA?.w, vB: standingsB?.w,
      rA: rankInStandings(standingsA?.w, 'w', computedStandings, true),
      rB: rankInStandings(standingsB?.w, 'w', computedStandings, true), hi: true },
    { label: 'PTS%',
      vA: ptsPctA, vB: ptsPctB,
      rA: rankVal(ptsPctA, ra.allPtsPct, true), rB: rankVal(ptsPctB, ra.allPtsPct, true), hi: true, suffix: '%' },
    { label: 'GF',
      vA: standingsA?.gf, vB: standingsB?.gf,
      rA: rankInStandings(standingsA?.gf, 'gf', computedStandings, true),
      rB: rankInStandings(standingsB?.gf, 'gf', computedStandings, true), hi: true },
    { label: 'GF/G',
      vA: gfPerGA, vB: gfPerGB,
      rA: rankVal(gfPerGA, ra.allGfPerG, true), rB: rankVal(gfPerGB, ra.allGfPerG, true), hi: true },
    { label: 'GA',
      vA: standingsA?.ga, vB: standingsB?.ga,
      rA: rankInStandings(standingsA?.ga, 'ga', computedStandings, false),
      rB: rankInStandings(standingsB?.ga, 'ga', computedStandings, false), hi: false },
    { label: 'GA/G',
      vA: gaPerGA, vB: gaPerGB,
      rA: rankVal(gaPerGA, ra.allGaPerG, false), rB: rankVal(gaPerGB, ra.allGaPerG, false), hi: false },
    { label: 'GD',
      vA: standingsA?.gd, vB: standingsB?.gd,
      rA: rankInStandings(standingsA?.gd, 'gd', computedStandings, true),
      rB: rankInStandings(standingsB?.gd, 'gd', computedStandings, true), hi: true },
    { label: 'PP%',
      vA: derivedA?.ppPct, vB: derivedB?.ppPct,
      rA: rankVal(derivedA?.ppPct, ra.allPP, true), rB: rankVal(derivedB?.ppPct, ra.allPP, true), hi: true, suffix: '%' },
    { label: 'PK%',
      vA: derivedA?.pkPct, vB: derivedB?.pkPct,
      rA: rankVal(derivedA?.pkPct, ra.allPK, true), rB: rankVal(derivedB?.pkPct, ra.allPK, true), hi: true, suffix: '%' },
    { label: 'SHG',
      vA: totalsA?.shg, vB: totalsB?.shg,
      rA: rankVal(totalsA?.shg, ra.allSHG, true), rB: rankVal(totalsB?.shg, ra.allSHG, true), hi: true },
    { label: 'SH%',
      vA: derivedA?.shPct, vB: derivedB?.shPct,
      rA: rankVal(derivedA?.shPct, ra.allSHP, true), rB: rankVal(derivedB?.shPct, ra.allSHP, true), hi: true, suffix: '%' },
    { label: 'BR%',
      vA: derivedA?.brkPct, vB: derivedB?.brkPct,
      rA: rankVal(derivedA?.brkPct, ra.allBRK, true), rB: rankVal(derivedB?.brkPct, ra.allBRK, true), hi: true, suffix: '%' },
    { label: 'FO%',
      vA: derivedA?.foPct, vB: derivedB?.foPct,
      rA: rankVal(derivedA?.foPct, ra.allFO, true), rB: rankVal(derivedB?.foPct, ra.allFO, true), hi: true, suffix: '%' },
    { label: 'SHOTS/G',
      vA: derivedA?.shotsPerGame, vB: derivedB?.shotsPerGame,
      rA: rankVal(derivedA?.shotsPerGame, ra.allSPG, true), rB: rankVal(derivedB?.shotsPerGame, ra.allSPG, true), hi: true },
    { label: 'HITS/G',
      vA: derivedA?.hitsPerGame, vB: derivedB?.hitsPerGame,
      rA: rankVal(derivedA?.hitsPerGame, ra.allHPG, true), rB: rankVal(derivedB?.hitsPerGame, ra.allHPG, true), hi: true },
    { label: 'ATK/G',
      vA: derivedA?.atkPerGame, vB: derivedB?.atkPerGame,
      rA: rankVal(derivedA?.atkSecPerGame, ra.allATKsec, true),
      rB: rankVal(derivedB?.atkSecPerGame, ra.allATKsec, true), hi: true },
    { label: 'DEF/G',
      vA: derivedA?.defPerGame, vB: derivedB?.defPerGame,
      rA: rankVal(derivedA?.defSecPerGame, ra.allDEFsec, false),
      rB: rankVal(derivedB?.defSecPerGame, ra.allDEFsec, false),
      hi: false },
  ];

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.46rem', color: 'rgba(135,206,235,.65)', letterSpacing: 2, marginBottom: 10 }}>TEAM STATS</div>
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.25)' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'linear-gradient(to right, rgba(255,140,0,.12), rgba(255,140,0,.03))', borderRight: '1px solid rgba(255,255,255,.08)' }}>
          <div style={{ width: 30, height: 30, flexShrink: 0, background: 'rgba(0,0,0,.5)', borderRadius: 6, border: '1px solid rgba(255,140,0,.4)', padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={`/assets/teamLogos/${teamA}.png`} alt={teamA} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.target.style.display='none'; }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '1rem', color: '#FF8C00', letterSpacing: 1.5 }}>{teamA}</div>
            {standingsA && <div style={{ fontFamily: "'VT323', monospace", fontSize: '.8rem', color: 'rgba(255,140,0,.5)' }}>{standingsA.w}W–{standingsA.l}L · {standingsA.pts}PTS</div>}
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '8px 10px', background: 'linear-gradient(to left, rgba(135,206,235,.12), rgba(135,206,235,.03))' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: '1rem', color: '#87CEEB', letterSpacing: 1.5 }}>{teamB}</div>
            {standingsB && <div style={{ fontFamily: "'VT323', monospace", fontSize: '.8rem', color: 'rgba(135,206,235,.5)' }}>{standingsB.w}W–{standingsB.l}L · {standingsB.pts}PTS</div>}
          </div>
          <div style={{ width: 30, height: 30, flexShrink: 0, background: 'rgba(0,0,0,.5)', borderRadius: 6, border: '1px solid rgba(135,206,235,.4)', padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={`/assets/teamLogos/${teamB}.png`} alt={teamB} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.target.style.display='none'; }} />
          </div>
        </div>
      </div>
      {rows.map((r) => (
        <CompareStatRow key={r.label} label={r.label} valA={r.vA} valB={r.vB} rank_a={r.rA} rank_b={r.rB} total={total} higherIsBetter={r.hi} suffix={r.suffix || ''} />
      ))}
    </div>
  );
}

function TeamIdentity({ team, standing, accentColor }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <div style={{ width: 42, height: 42, flexShrink: 0, background: 'rgba(0,0,0,.4)', borderRadius: 8, border: `2px solid ${accentColor}44`, padding: 3, boxShadow: `0 0 12px ${accentColor}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img src={`/assets/teamLogos/${team}.png`} alt={team} style={{ width: '100%', height: '100%', objectFit: 'contain' }} onError={e => { e.target.style.display = 'none'; }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: '1.3rem', color: accentColor, letterSpacing: 1, lineHeight: 1, textShadow: `0 0 12px ${accentColor}66`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team}</div>
        {standing && (
          <div style={{ fontFamily: "'VT323', monospace", fontSize: '1rem', color: 'rgba(255,255,255,.45)', lineHeight: 1.2 }}>
            {standing.w}W–{standing.l}L{standing.t ? `–${standing.t}T` : ''} · {standing.pts}PTS
          </div>
        )}
      </div>
    </div>
  );
}

function ImpactRow({ rival, accentColor }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: '8px 10px', marginBottom: 6, borderRadius: 6,
      background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)',
      borderLeft: `3px solid ${rival.relation === 'ahead' ? '#87CEEB' : '#FF8C00'}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <img src={`/assets/teamLogos/${rival.team}.png`} alt={rival.team}
            style={{ width: 22, height: 22, objectFit: 'contain' }}
            onError={(e) => { e.target.style.display = 'none'; }} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '.95rem', color: '#E0E0E0', letterSpacing: .5 }}>
            {rival.team}
          </span>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.32rem', color: rival.relation === 'ahead' ? '#87CEEB' : '#FF8C00', letterSpacing: 1 }}>
            {rival.relation === 'ahead' ? 'AHEAD' : 'BEHIND'}
          </span>
        </div>
        <span style={{ fontFamily: "'VT323', monospace", fontSize: '1.05rem', color: 'rgba(255,255,255,.6)' }}>
          {rival.pts} PTS · {rival.gr} GR · MAX {rival.maxPts}
        </span>
      </div>

      <div style={{ fontFamily: "'VT323', monospace", fontSize: '1.05rem', color: '#FFD700', marginTop: 2 }}>
        {rival.needText}
      </div>

      {rival.remainingOpponents?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
          {rival.remainingOpponents.map((o) => (
            <span key={o.team} style={{
              fontFamily: "'VT323', monospace", fontSize: '.85rem',
              color: o.team === rival.h2hOpponent ? '#FFD700' : 'rgba(255,255,255,.45)',
              background: 'rgba(0,0,0,.3)', border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 4, padding: '2px 6px',
            }}>
              vs {o.team} ({o.gamesLeft})
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function computeBestWorstSeed(team, sortedStandings) {
  if (!sortedStandings?.length) return null;
  const me = sortedStandings.find(s => s.team === team);
  if (!me || me.maxPts == null) return null;

  const others = sortedStandings.filter(s => s.team !== team);

  // Best possible: this team wins out (maxPts), every rival held to their
  // floor (current pts). Worst possible: this team's current pts stand,
  // every rival wins out (their maxPts). Same independent per-team
  // ceiling/floor convention already used for clinch/elimination.
  const bestSeed  = others.filter(o => (o.pts ?? 0) > me.maxPts).length + 1;
  const worstSeed = others.filter(o => (o.maxPts ?? o.pts ?? 0) > me.pts).length + 1;

  return { bestSeed, worstSeed };
}


function ClinchPanel({ data, accentColor, playoffTeams, seasonTeams, rawGames, rsGamesVs, tiebreakerRuleset, sortedStandings }) {
  if (!data) {
    return (
      <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.42rem', color: 'rgba(255,255,255,.25)', textAlign: 'center', padding: '30px 0' }}>
        NO DATA
      </div>
    );
  }

  if (data.status === 'no-data') {
    return (
      <div style={{ padding: '24px 14px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.48rem', color: 'rgba(255,255,255,.4)', letterSpacing: 1, lineHeight: 2 }}>
          SCHEDULE DATA UNAVAILABLE
        </div>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: '1.2rem', color: 'rgba(255,255,255,.45)', marginTop: 8 }}>
          This season is missing games-per-team info, so clinch scenarios can't be projected.
        </div>
      </div>
    );
  }

  if (data.status === 'too-early') {
    return (
      <div style={{ padding: '24px 14px', textAlign: 'center' }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.48rem', color: 'rgba(255,255,255,.4)', letterSpacing: 1, lineHeight: 2 }}>
          TOO EARLY TO PROJECT
        </div>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: '1.2rem', color: 'rgba(255,255,255,.45)', marginTop: 8 }}>
          {data.team} has {data.gr} games remaining.<br />
          Check back in about {data.gamesUntilProjection} more games.
        </div>
      </div>
    );
  }

  if (data.status === 'clinched') {
    const bw = computeBestWorstSeed(data.team, sortedStandings);
    return (
      <div style={{ padding: '18px 14px', textAlign: 'center', background: 'rgba(0,221,96,.08)', border: '1px solid rgba(0,221,96,.4)', borderRadius: 10, boxShadow: '0 0 20px rgba(0,221,96,.15)' }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.6rem', color: '#00DD60', letterSpacing: 1, marginBottom: 6 }}>✅ CLINCHED</div>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: '1.3rem', color: 'rgba(255,255,255,.7)' }}>Seed #{data.seed} · {data.pts} PTS</div>
        {bw && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(0,221,96,.2)' }}>
            <div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.64rem', color: 'rgba(0,221,96,.65)', letterSpacing: 1, marginBottom: 4 }}>BEST POSSIBLE</div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: '1.6rem', color: '#00DD60' }}>Seed #{bw.bestSeed}</div>
            </div>
            <div style={{ width: 1, background: 'rgba(255,255,255,.1)' }} />
            <div>
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.64rem', color: 'rgba(255,176,0,.65)', letterSpacing: 1, marginBottom: 4 }}>WORST POSSIBLE</div>
              <div style={{ fontFamily: "'VT323', monospace", fontSize: '1.6rem', color: '#FFB000' }}>Seed #{bw.worstSeed}</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (data.status === 'eliminated') {
    return (
      <div style={{ padding: '18px 14px', textAlign: 'center', background: 'rgba(255,0,0,.08)', border: '1px solid rgba(255,0,0,.4)', borderRadius: 10 }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.6rem', color: '#FF4444', letterSpacing: 1, marginBottom: 6 }}>❌ ELIMINATED</div>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: '1.3rem', color: 'rgba(255,255,255,.6)' }}>Max {data.maxPts} PTS — can't reach the cutoff</div>
      </div>
    );
  }

  const ptsBehindCutoff = data.cutoffTeam ? data.cutoffTeam.pts - data.pts : null;
  const ptsAheadOfBubble = data.bubbleTeam ? data.pts - data.bubbleTeam.pts : null;
  const inPlayoffs = ptsBehindCutoff != null && ptsBehindCutoff <= 0;

  return (
    <div>
      <div style={{ padding: '12px 14px', marginBottom: 14, background: `linear-gradient(135deg, ${accentColor}18, rgba(0,0,0,.3))`, border: `1px solid ${accentColor}44`, borderRadius: 10 }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.5rem', color: accentColor, letterSpacing: 1, marginBottom: 6 }}>
          SEED #{data.seed} · {data.pts} PTS · {data.gr ?? '—'} GAMES LEFT
        </div>
        <div style={{ fontFamily: "'VT323', monospace", fontSize: '1.15rem', color: 'rgba(255,255,255,.75)', lineHeight: 1.5 }}>
          {inPlayoffs ? (
            <>Currently in the playoff picture.{data.bubbleTeam && <> Leads #{playoffTeams + 1} ({data.bubbleTeam.team}) by {ptsAheadOfBubble} pts.</>}</>
          ) : (
            data.cutoffTeam && <>{ptsBehindCutoff} pts back of #{playoffTeams} ({data.cutoffTeam.team}).</>
          )}
        </div>
      </div>

      <WhatIfStandings
        simTeams={[data.team, ...(data.allCandidates || []).map(c => c.team)]}
        targetTeam={data.team}
        sortedStandings={sortedStandings}  // ← add this prop
        seasonTeams={seasonTeams}
        rawGames={rawGames}
        rsGamesVs={rsGamesVs}
        tiebreakerRuleset={tiebreakerRuleset}
        accentColor={accentColor}
        playoffTeams={playoffTeams}
      />  
    </div>
  );
}

function canonicalPair(a, b) {
  return a < b ? [a, b] : [b, a];
}


// Given a "mover" team's own result (WIN/OTW/TIE/OTL/LOSS) against an opponent, resolve it
// to the A/B-relative code buildSyntheticGame expects, where x/y is the alphabetical pair.
function codeForOutcome(mover, x, y, outcome) {
  const moverIsX = mover === x;
  const map = {
    WIN:  moverIsX ? 'A_W'   : 'B_W',
    OTW:  moverIsX ? 'A_OTW' : 'B_OTW',
    TIE:  'TIE',
    OTL:  moverIsX ? 'B_OTW' : 'A_OTW',
    LOSS: moverIsX ? 'B_W'   : 'A_W',
  };
  return map[outcome];
}

function buildSyntheticGame(x, y, resultCode, key) {
  let score_home = 0, score_away = 0, ot = false;
  switch (resultCode) {
    case 'A_W':   score_home = 1; score_away = 0; break;
    case 'A_OTW': score_home = 1; score_away = 0; ot = true; break;
    case 'TIE':   score_home = 0; score_away = 0; break;
    case 'B_OTW': score_home = 0; score_away = 1; ot = true; break;
    case 'B_W':   score_home = 0; score_away = 1; break;
    default: return null;
  }
  return { id: `hyp-${key}`, home: x, away: y, score_home, score_away, ot, coach_home: '', coach_away: '' };
}

const RESULT_OPTIONS = [
  { outcome: 'WIN',  label: 'W',   color: '#00DD60' },
  { outcome: 'OTW',  label: 'OTW', color: '#4DE0A0' },
  { outcome: 'TIE',  label: 'T',   color: '#87CEEB' },
  { outcome: 'OTL',  label: 'OTL', color: '#FFA500' },
  { outcome: 'LOSS', label: 'L',   color: '#FF4444' },
];

// Matchups between pairs of displayed teams (for the manual toggle grid)
function buildSimMatchups(simTeams, seasonTeams, rawGames, rsGamesVs) {
  const sorted = [...simTeams].sort();
  const pairs = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const [x, y] = [sorted[i], sorted[j]];
      const oppList = computeRemainingOpponents(x, seasonTeams, rawGames, rsGamesVs ?? 2);
      const match = oppList.find((o) => o.team === y);
      if (match && match.gamesLeft > 0) pairs.push({ x, y, count: match.gamesLeft });
    }
  }
  return pairs;
}


// Only the target's own remaining games — the primary editable set. Independent of
// which teams happen to be in the bubble-range candidate pool.
function buildTargetMatchups(target, seasonTeams, rawGames, rsGamesVs) {
  const opponents = computeRemainingOpponents(target, seasonTeams, rawGames, rsGamesVs ?? 2);
  return opponents
    .map(({ team: opp, gamesLeft }) => {
      const [x, y] = canonicalPair(target, opp);
      return { x, y, count: gamesLeft };
    })
    .sort((a, b) => (a.x === target ? a.y : a.x).localeCompare(b.x === target ? b.y : b.x));
}

// MatchupRow — single-row segmented slider between two team logos.
// Segment position/color communicates the outcome, not just the label:
// far-left/orange = leftTeam big win, far-right/blue = rightTeam big win,
// middle-gray = tie, with narrower OT segments flanking it.
function MatchupRow({ x, y, idx, count, current, onSet, focusTeam }) {
  const focusIsX = focusTeam === x;
  const leftTeam  = focusIsX ? x : y;
  const rightTeam = focusIsX ? y : x;

  // seg.outcome is defined relative to leftTeam; setResult always expects
  // the outcome relative to x, so flip it when leftTeam is actually y.
  const toXRelative = (outcome) => {
    if (focusIsX) return outcome;
    const flip = { WIN: 'LOSS', OTW: 'OTL', TIE: 'TIE', OTL: 'OTW', LOSS: 'WIN' };
    return flip[outcome];
  };

  // Outcomes are always defined relative to leftTeam's perspective here;
  // codeForOutcome below resolves them back to the actual mover (x or y).
  const SEGMENTS = [
    { outcome: 'WIN',  flex: 1.3, label: 'W',   title: `${leftTeam} regulation win` },
    { outcome: 'OTW',  flex: 1.1, label: 'OTW', title: `${leftTeam} OT win` },
    { outcome: 'TIE',  flex: 0.8, label: 'T',   title: 'Tie' },
    { outcome: 'OTL',  flex: 1.1, label: 'OTL', title: `${rightTeam} OT win` },
    { outcome: 'LOSS', flex: 1.3, label: 'W',   title: `${rightTeam} regulation win` },
  ];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 10px', marginBottom: 6, borderRadius: 10,
      background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.08)',
    }}>
      {/* Left team */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 60, flexShrink: 0 }}>
        <img src={`/assets/teamLogos/${leftTeam}.png`} alt={leftTeam}
          style={{ width: 26, height: 26, objectFit: 'contain', flexShrink: 0 }}
          onError={e => { e.target.style.display = 'none'; }} />
      </div>

      {/* Segmented slider */}
      <div style={{
        flex: 1, display: 'flex', height: 36, borderRadius: 8, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,.14)', background: 'rgba(0,0,0,.35)',
      }}>
        {SEGMENTS.map((seg, i) => {
          const code = codeForOutcome(focusIsX ? x : y, x, y, seg.outcome);
          const active = current === code;
          const color = i < 2 ? '#FF8C00' : i > 2 ? '#87CEEB' : '#9AA5B1';
          return (
            <button
              key={seg.outcome}
              title={seg.title}
              onClick={() => onSet(toXRelative(seg.outcome))}
              style={{
                flex: seg.flex,
                border: 'none',
                borderRight: i < 4 ? '1px solid rgba(255,255,255,.08)' : 'none',
                background: active ? `linear-gradient(180deg, ${color}45, ${color}20)` : 'transparent',
                color: active ? color : 'rgba(255,255,255,.32)',
                fontFamily: "'Press Start 2P', monospace",
                fontSize: seg.label.length > 2 ? '.48rem' : '.62rem',
                letterSpacing: 1,
                cursor: 'pointer',
                boxShadow: active ? `inset 0 0 14px ${color}55` : 'none',
                transition: 'all .15s',
              }}
            >
              {seg.label}
            </button>
          );
        })}
      </div>

      {/* Right team */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 60, flexShrink: 0, justifyContent: 'flex-end' }}>
        <img src={`/assets/teamLogos/${rightTeam}.png`} alt={rightTeam}
          style={{ width: 26, height: 26, objectFit: 'contain', flexShrink: 0 }}
          onError={e => { e.target.style.display = 'none'; }} />
      </div>

      {count > 1 && (
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.42rem',
          color: 'rgba(255,255,255,.25)', flexShrink: 0, marginLeft: 4 }}>
          {idx + 1}/{count}
        </span>
      )}
    </div>
  );
}


// ALL of a team's remaining games league-wide, regardless of who else is displayed —
// this is what powers Win All / Lose All so the target's true ceiling/floor shows up
// even against opponents not currently listed in the table.
function buildFullScheduleKeys(team, seasonTeams, rawGames, rsGamesVs) {
  const opponents = computeRemainingOpponents(team, seasonTeams, rawGames, rsGamesVs ?? 2);
  const entries = [];
  opponents.forEach(({ team: opp, gamesLeft }) => {
    const [x, y] = canonicalPair(team, opp);
    for (let idx = 0; idx < gamesLeft; idx++) {
      entries.push({ key: `${x}::${y}::${idx}`, x, y });
    }
  });
  return entries;
}

function WhatIfStandings({ simTeams, targetTeam, seasonTeams, rawGames,
  tiebreakerRuleset, rsGamesVs, accentColor, playoffTeams, sortedStandings }) {

  const [hypResults, setHypResults] = useState({});

  // Build target's own matchups
  const targetMatchups = useMemo(
    () => buildTargetMatchups(targetTeam, seasonTeams, rawGames, rsGamesVs),
    [targetTeam, seasonTeams, rawGames, rsGamesVs]
  );

    // Rival matchups — games between OTHER bubble teams (not involving the target)
    const rivalMatchups = useMemo(() => {
      const bubbleTeams = simTeams.filter(t => t !== targetTeam);
      return buildSimMatchups(bubbleTeams, seasonTeams, rawGames, rsGamesVs);
    }, [simTeams, targetTeam, seasonTeams, rawGames, rsGamesVs]);
  
      // Each rival's OWN remaining schedule, regardless of who the opponent is —
  // grouped by rival so the UI can collapse each team's games independently.
  // Dedupes against pairs already shown in rivalMatchups so no game appears twice.
  const rivalOwnMatchupGroups = useMemo(() => {
    const bubbleTeams = simTeams.filter(t => t !== targetTeam);
    const alreadyShown = new Set(rivalMatchups.map(m => `${m.x}::${m.y}`));
    const seen = new Set();
    const groups = [];
    bubbleTeams.forEach((rival) => {
      const matchups = buildTargetMatchups(rival, seasonTeams, rawGames, rsGamesVs).filter((m) => {
        const key = `${m.x}::${m.y}`;
        if (alreadyShown.has(key) || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (matchups.length > 0) {
        const totalGames = matchups.reduce((sum, m) => sum + m.count, 0);
        groups.push({ team: rival, matchups, totalGames });
      }
    });
    return groups;
  }, [simTeams, targetTeam, rivalMatchups, seasonTeams, rawGames, rsGamesVs]);

  // Recompute standings with hypothetical results injected
  const whatIfRows = useMemo(() => {
    const syntheticGames = Object.values(hypResults)
      .map(({ x, y, code }, i) => buildSyntheticGame(x, y, code, i))
      .filter(Boolean);
    const merged = [...rawGames, ...syntheticGames];
    const standings = computeStandings(merged);
    const fullSorted = sortStandings(standings, merged, tiebreakerRuleset)
      .map((s, idx) => ({ ...s, rank: idx + 1 }));

    // Show: 6 above playoff line + all below who are still alive (up to 8 below)
    const bubbleStart = 0;
    const bubbleEnd   = Math.min(fullSorted.length, playoffTeams + 8);
    return fullSorted.slice(bubbleStart, bubbleEnd);
  }, [hypResults, rawGames, tiebreakerRuleset, playoffTeams]);

  const setResult = (x, y, idx, outcome) => {
    const key = `${x}::${y}::${idx}`;
    const newCode = codeForOutcome(x, x, y, outcome);
    setHypResults(prev => {
      const next = { ...prev };
      if (prev[key]?.code === newCode) delete next[key];
      else next[key] = { x, y, code: newCode };
      return next;
    });
  };

  const applyToAll = (outcome) => {
    const entries = buildFullScheduleKeys(targetTeam, seasonTeams, rawGames, rsGamesVs);
    setHypResults(prev => {
      const next = { ...prev };
      entries.forEach(({ key, x, y }) => {
        next[key] = { x, y, code: codeForOutcome(targetTeam, x, y, outcome) };
      });
      return next;
    });
  };

  const clearAll = () => setHypResults({});
  const hasHyp = Object.keys(hypResults).length > 0;

  // Find where playoff line falls within the displayed slice
  const cutIdx = whatIfRows.findIndex(r => r.rank === playoffTeams + 1);

  const renderMatchupGroup = (matchups, isFocusGroup) =>
    matchups.map(({ x, y, count }) =>
      Array.from({ length: count }).map((_, idx) => {
        const key = `${x}::${y}::${idx}`;
        // For rival matchups, show from the perspective of whichever is closer to bubble
        const focusForRow = isFocusGroup ? targetTeam : (simTeams.includes(x) ? x : y);
        return (
          <MatchupRow key={key} x={x} y={y} idx={idx} count={count}
            focusTeam={focusForRow}
            current={hypResults[key]?.code}
            onSet={(outcome) => setResult(x, y, idx, outcome)} />
        );
      })
    );

  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>

      {/* LEFT: matchup controls */}
      <div style={{ width: 380, flexShrink: 0 }}>

        {/* Quick-fill buttons */}
                <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          <button onClick={() => applyToAll('WIN')}
            style={quickBtnStyle('#00DD60')}>🔥 {targetTeam} WINS OUT</button>
          <button onClick={() => applyToAll('LOSS')}
            style={quickBtnStyle('#FF4444')}>💀 {targetTeam} LOSES OUT</button>
          <button onClick={clearAll}
            style={{ ...quickBtnStyle('#87CEEB'), visibility: hasHyp ? 'visible' : 'hidden' }}>
            ↺ RESET
          </button>
        </div>

        {/* Target's own games */}
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.64rem',
          color: accentColor, letterSpacing: 2, marginBottom: 8 }}>
          {targetTeam}'S REMAINING GAMES
        </div>
        {targetMatchups.length === 0
          ? <div style={{ fontFamily: "'VT323', monospace", fontSize: '1rem',
              color: 'rgba(255,255,255,.3)', marginBottom: 14 }}>No games remaining</div>
          : <div style={{ marginBottom: 16 }}>{renderMatchupGroup(targetMatchups, true)}</div>
        }

                {/* Other bubble matchups */}
                {rivalMatchups.length > 0 && (
          <>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.64rem',
              color: 'rgba(135,206,235,.6)', letterSpacing: 2, marginBottom: 8 }}>
              IMPACT MATCHUPS
            </div>
            <div style={{ marginBottom: 16 }}>{renderMatchupGroup(rivalMatchups, false)}</div>
          </>
        )}

                {/* Rivals' own games — collapsed per-team accordion to limit scroll */}
                {rivalOwnMatchupGroups.length > 0 && (
          <>
            <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.64em',
              color: 'rgba(255,255,255,.35)', letterSpacing: 2, marginBottom: 8 }}>
              OTHER IMPACT GAMES
            </div>
            {rivalOwnMatchupGroups.map(({ team, matchups, totalGames }) => (
              <details key={team} style={{
                marginBottom: 6, borderRadius: 8, overflow: 'hidden',
                background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.07)',
              }}>
                <summary style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                  cursor: 'pointer', userSelect: 'none',
                }}>
                  <img src={`/assets/teamLogos/${team}.png`} alt={team}
                    style={{ width: 22, height: 22, objectFit: 'contain' }}
                    onError={e => { e.target.style.display = 'none'; }} />
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: '.95rem', color: '#E0E0E0' }}>
                    {team}
                  </span>
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.42rem', color: 'rgba(255,255,255,.3)', marginLeft: 'auto' }}>
                    {totalGames} GAME{totalGames === 1 ? '' : 'S'}
                  </span>
                </summary>
                <div style={{ padding: '2px 10px 8px' }}>
                  {matchups.map(({ x, y, count }) =>
                    Array.from({ length: count }).map((_, idx) => {
                      const key = `${x}::${y}::${idx}`;
                      return (
                        <MatchupRow key={key} x={x} y={y} idx={idx} count={count}
                          focusTeam={team}
                          current={hypResults[key]?.code}
                          onSet={(outcome) => setResult(x, y, idx, outcome)} />
                      );
                    })
                  )}
                </div>
              </details>
            ))}
          </>
        )}
      </div>

      {/* RIGHT: what-if standings */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.64rem',
          color: 'rgba(255,255,255,.35)', letterSpacing: 2, marginBottom: 8 }}>
          PROJECTED STANDINGS
        </div>
        <div style={{ borderRadius: 10, overflow: 'hidden',
          border: '1px solid rgba(255,255,255,.08)', background: 'rgba(0,0,0,.25)' }}>

          {/* Header */}
          <div style={{ display: 'grid',
            gridTemplateColumns: '36px 1fr 36px 32px 32px 32px 32px 44px',
            gap: 4, padding: '7px 10px',
            background: 'rgba(255,255,255,.04)',
            borderBottom: '1px solid rgba(255,255,255,.08)' }}>
            {['#', 'TEAM', 'GP', 'W', 'L', 'T', 'OTL', 'PTS'].map((h, i) => (
              <div key={i} style={{ fontFamily: "'Press Start 2P', monospace",
                fontSize: '.48rem', color: 'rgba(255,255,255,.3)',
                textAlign: i <= 1 ? 'left' : 'center' }}>{h}</div>
            ))}
          </div>

          {whatIfRows.map((s, idx) => {
            const inPlayoffs  = s.rank <= playoffTeams;
            const isTarget    = s.team === targetTeam;
            const showCutline = cutIdx > 0 && idx === cutIdx - 1;

            return (
              <React.Fragment key={s.team}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr 36px 32px 32px 32px 32px 44px',
                  gap: 4, padding: '8px 10px', alignItems: 'center',
                  background: isTarget
                    ? `${accentColor}1a`
                    : idx % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent',
                  borderLeft: isTarget
                    ? `3px solid ${accentColor}`
                    : inPlayoffs ? '3px solid rgba(0,255,100,.3)' : '3px solid transparent',
                  transition: 'background .2s',
                }}>
                  {/* Rank badge */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <span style={{
                      fontFamily: "'Press Start 2P', monospace", fontSize: '.5rem',
                      color: inPlayoffs ? '#FFD700' : 'rgba(255,255,255,.3)',
                      background: 'rgba(0,0,0,.4)',
                      border: `1px solid ${inPlayoffs ? 'rgba(255,215,0,.4)' : 'rgba(255,255,255,.1)'}`,
                      borderRadius: 5, padding: '3px 5px',
                      minWidth: 24, textAlign: 'center',
                    }}>{s.rank}</span>
                  </div>

                  {/* Logo + name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <img src={`/assets/teamLogos/${s.team}.png`} alt={s.team}
                      style={{ width: 22, height: 22, objectFit: 'contain', flexShrink: 0 }}
                      onError={e => { e.target.style.display = 'none'; }} />
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: isTarget ? 800 : 600,
                      fontSize: isTarget ? '1.05rem' : '1rem',
                      color: isTarget ? accentColor : inPlayoffs ? '#E0E0E0' : 'rgba(255,255,255,.5)',
                      letterSpacing: .5,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{s.team}</span>
                  </div>

                  {/* Stats */}
                  {['gp', 'w', 'l', 't', 'otl'].map(k => (
                    <div key={k} style={{ textAlign: 'center',
                      fontFamily: "'VT323', monospace", fontSize: '1.1rem',
                      color: inPlayoffs ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.35)' }}>
                      {s[k]}
                    </div>
                  ))}

                  {/* PTS — bold, gold */}
                  <div style={{ textAlign: 'center',
                    fontFamily: "'VT323', monospace", fontSize: '1.25rem',
                    color: isTarget ? accentColor : inPlayoffs ? '#FFD700' : 'rgba(255,255,255,.35)',
                    fontWeight: 700 }}>
                    {s.pts}
                  </div>
                </div>

                {/* Playoff cutline */}
                {showCutline && (
                  <div style={{
                    height: 2,
                    background: 'linear-gradient(90deg, transparent, #FFD700 15%, #FFD700 85%, transparent)',
                    boxShadow: '0 0 10px rgba(255,215,0,.5)',
                    margin: '1px 0', position: 'relative',
                  }}>
                    <span style={{
                      position: 'absolute', left: '50%', top: -7,
                      transform: 'translateX(-50%)',
                      background: '#0a0a15', padding: '0 8px',
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: '.28rem', color: '#FFD700', letterSpacing: 1,
                      whiteSpace: 'nowrap',
                    }}>◆ PLAYOFF LINE ◆</span>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
          {[
            { color: accentColor,          label: 'Selected team' },
            { color: 'rgba(0,255,100,.5)', label: 'In playoffs' },
            { color: 'rgba(255,255,255,.3)',label: 'Outside playoffs' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 3, height: 14, background: color, borderRadius: 2 }} />
              <span style={{ fontFamily: "'Press Start 2P', monospace",
                fontSize: '.28rem', color: 'rgba(255,255,255,.3)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function quickBtnStyle(color) {
  return {
    fontFamily: "'Press Start 2P', monospace", fontSize: '.42rem', letterSpacing: 1,
    padding: '11px 16px', borderRadius: 8, cursor: 'pointer',
    border: `1px solid ${color}66`, background: `${color}18`, color,
    boxShadow: `0 0 12px ${color}22`, transition: 'all .15s',
  };
}

// ─── main component ──────────────────────────────────────────────────────────

export default function TeamDrawer({
  selectedSeason, computedStandings, primaryTeam, compareTeam, onClose,
  sortedStandings, playoffTeams, clinched, eliminated, rawGames, seasonTeams, rsGamesVs, tiebreakerRuleset,
  activeTab, setActiveTab,
}) {
  const [dataMode, setDataMode]                 = useState('season');
  //const [activeTab, setActiveTab]               = useState('stats'); // 'stats' | 'clinch'
  const [loading, setLoading]                   = useState(false);
  const [allSkaters, setAllSkaters]             = useState([]);
  const [allGoalies, setAllGoalies]             = useState([]);
  const [allTeamGameStats, setAllTeamGameStats] = useState([]);
  const [h2hGames, setH2hGames]                 = useState([]);
  const [hasPlayoffData, setHasPlayoffData]     = useState(false);
  const [clinchFocusTeam, setClinchFocusTeam]   = useState(null);

  const drawerRef  = useRef(null);
  const isCompare  = !!primaryTeam && !!compareTeam;

  // ── data fetch ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedSeason || !primaryTeam) return;
    let cancelled = false;
    setLoading(true);

    const lgPrefix = selectedSeason.replace(/[0-9]/g, '').trim();

    const skatersQ = supabase
      .from('game_stats_skaters')
      .select('player_name, team_code, goals, assists, points, shots, chk, pim, playoff_game_id')
      .eq('lg', selectedSeason)
      .not('player_name', 'is', null);

    const goaliesQ = supabase
      .from('game_stats_goalies')
      .select('player_name, team_code, goals_against, saves, shutouts, shots_against, goals, assists, points, playoff_game_id')
      .eq('lg', selectedSeason)
      .not('player_name', 'is', null);

    const teamStatsQ = supabase
      .from('game_stats_team')
      .select('*')
      .eq('season', selectedSeason);

    // Cross-season H2H: regular season games
    const h2hRegQ = isCompare
      ? supabase
          .from('games')
          .select('id, lg, home, away, score_home, score_away, ot')
          .ilike('lg', `${lgPrefix}%`)
          .or(`and(home.eq.${primaryTeam},away.eq.${compareTeam}),and(home.eq.${compareTeam},away.eq.${primaryTeam})`)
          .not('score_home', 'is', null)
          .order('id', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] });

    // Cross-season H2H: playoff games
    const h2hPoQ = isCompare
      ? supabase
          .from('playoff_games')
          .select('id, lg, team_code_a, team_code_b, team_a_score, team_b_score, ot')
          .ilike('lg', `${lgPrefix}%`)
          .or(`and(team_code_a.eq.${primaryTeam},team_code_b.eq.${compareTeam}),and(team_code_a.eq.${compareTeam},team_code_b.eq.${primaryTeam})`)
          .not('team_a_score', 'is', null)
          .order('id', { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] });

    Promise.all([skatersQ, goaliesQ, teamStatsQ, h2hRegQ, h2hPoQ]).then(([s, g, ts, h2hReg, h2hPo]) => {
      if (cancelled) return;

      const skaters   = s.data  || [];
      const goalies   = g.data  || [];
      const teamStats = ts.data || [];

      const regGames = (h2hReg.data || []).map(r => ({
        _homeTeam:  r.home,
        _awayTeam:  r.away,
        _homeScore: r.score_home ?? 0,
        _awayScore: r.score_away ?? 0,
        _ot:        !!r.ot,
        _isPlayoff: false,
        _sortId:    r.id || 0,
      }));

      const poGames = (h2hPo.data || []).map(r => ({
        _homeTeam:  r.team_code_a,
        _awayTeam:  r.team_code_b,
        _homeScore: r.team_a_score ?? 0,
        _awayScore: r.team_b_score ?? 0,
        _ot:        !!r.ot,
        _isPlayoff: true,
        _sortId:    r.id || 0,
      }));

      // Merge all H2H games (RS + PO), sort newest first, take 10
      const allH2H = [...poGames, ...regGames]
        .sort((a, b) => {
          const aPO = a._isPlayoff ? 1 : 0;
          const bPO = b._isPlayoff ? 1 : 0;
          if (bPO !== aPO) return bPO - aPO;
          return (b._sortId || 0) - (a._sortId || 0);
        })
        .slice(0, 10);

      const hasPlayoff = skaters.some(r => r.playoff_game_id != null);
      const isPlayoff  = dataMode === 'playoff';
      const anyPoStats = teamStats.some(r => r.playoff_game_id != null);
      const filterSkGo = isPlayoff ? r => r.playoff_game_id != null  : r => r.playoff_game_id == null;
      const filterTeam = isPlayoff ? r => r.playoff_game_id != null  : r => !anyPoStats || r.playoff_game_id == null;

      setHasPlayoffData(hasPlayoff);
      setAllSkaters(skaters.filter(filterSkGo));
      setAllGoalies(goalies.filter(filterSkGo));
      setAllTeamGameStats(teamStats.filter(filterTeam));
      setH2hGames(allH2H);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [selectedSeason, primaryTeam, compareTeam, dataMode]);

  // ── player aggregations ───────────────────────────────────────────────────
  const aggregatedSkaters = useMemo(() => {
    const map = {};
    allSkaters.forEach((r) => {
      const k = `${r.team_code}::${r.player_name}`;
      if (!map[k]) map[k] = { player_name: r.player_name, team_code: r.team_code, goals: 0, assists: 0, points: 0, shots: 0, chk: 0, pim: 0 };
      map[k].goals += r.goals || 0; map[k].assists += r.assists || 0; map[k].points += r.points || 0;
      map[k].shots += r.shots || 0; map[k].chk     += r.chk     || 0; map[k].pim    += r.pim    || 0;
    });
    return Object.values(map);
  }, [allSkaters]);

  const aggregatedGoalies = useMemo(() => aggregateAndEnrichGoalies(allGoalies), [allGoalies]);

  // ── Clinch scenario data ──────────────────────────────────────────────────
  const clinchDataA = useMemo(() => {
    if (!sortedStandings || !playoffTeams || !primaryTeam) return null;
    return computeClinchScenario({
      team: primaryTeam,
      sortedStandings,
      playoffTeams,
      clinched: clinched || new Set(),
      eliminated: eliminated || new Set(),
      rawGames: rawGames || [],
      seasonTeams: seasonTeams || [],
      rsGamesVs,
    });
  }, [primaryTeam, sortedStandings, playoffTeams, clinched, eliminated, rawGames, seasonTeams, rsGamesVs]);

  const clinchDataB = useMemo(() => {
    if (!sortedStandings || !playoffTeams || !compareTeam) return null;
    return computeClinchScenario({
      team: compareTeam,
      sortedStandings,
      playoffTeams,
      clinched: clinched || new Set(),
      eliminated: eliminated || new Set(),
      rawGames: rawGames || [],
      seasonTeams: seasonTeams || [],
      rsGamesVs,
    });
  }, [compareTeam, sortedStandings, playoffTeams, clinched, eliminated, rawGames, seasonTeams, rsGamesVs]);

  // Goalie ranks — TRUE competition ranking
  const goalieRanks = useMemo(() => {
    const active = aggregatedGoalies.filter(p => p._gp > 0 && p.shots_against > 0);

    // Base ranks for raw counting stats — TRUE competition ranking
    const base = computeLeagueRanks(aggregatedGoalies, ['saves', 'shutouts', 'shots_against', 'goals_against']);

    // GAA and SV% are handled below with count-based ranking

    active.forEach(p => {
      if (!base[p.player_name]) base[p.player_name] = {};
      if (p._gaa != null) {
        const n = parseFloat(p._gaa);
        // GAA: lower is better — count players with strictly lower GAA
        const betterCount = active.filter(x => x._gaa != null && parseFloat(x._gaa) < n - 0.0001).length;
        base[p.player_name]._gaa = betterCount + 1;
      }
      if (p._svpct != null) {
        const n = parseFloat(p._svpct);
        // SV%: higher is better — count players with strictly higher SV%
        const betterCount = active.filter(x => x._svpct != null && parseFloat(x._svpct) > n + 0.0001).length;
        base[p.player_name]._svpct = betterCount + 1;
      }
    });

    return base;
  }, [aggregatedGoalies]);

  const skaterRanks = useMemo(() =>
    computeLeagueRanks(aggregatedSkaters, ['goals','assists','points','shots','chk','pim']),
    [aggregatedSkaters]
  );
  const leagueSkaterCount = useMemo(() => new Set(aggregatedSkaters.map(p => p.player_name)).size, [aggregatedSkaters]);
  const leagueGoalieCount = useMemo(() =>
    new Set(aggregatedGoalies.filter(p => p._gp > 0 && p.shots_against > 0).map(p => p.player_name)).size,
    [aggregatedGoalies]
  );

  // ── team stat aggregations ────────────────────────────────────────────────
  const allTeamTotals = useMemo(() =>
    buildTeamStats(allTeamGameStats).map(t => ({
      ...t,
      derived:  deriveStats(t.totals),
      standing: computedStandings.find(s => s.team === t.team),
    })),
    [allTeamGameStats, computedStandings]
  );

  const entryA   = allTeamTotals.find(t => t.team === primaryTeam);
  const entryB   = allTeamTotals.find(t => t.team === compareTeam);
  const totalsA  = entryA?.totals;
  const totalsB  = entryB?.totals;
  const derivedA = entryA?.derived;
  const derivedB = entryB?.derived;

  const standingA = computedStandings.find(s => s.team === primaryTeam);
  const standingB = computedStandings.find(s => s.team === compareTeam);
  const skatersA  = aggregatedSkaters.filter(p => p.team_code === primaryTeam);
  const skatersB  = aggregatedSkaters.filter(p => p.team_code === compareTeam);
  const goaliesA  = aggregatedGoalies.filter(p => p.team_code === primaryTeam);
  const goaliesB  = aggregatedGoalies.filter(p => p.team_code === compareTeam);

  if (!primaryTeam) return null;

  const clinchTeam   = isCompare ? (clinchFocusTeam || primaryTeam) : primaryTeam;
  const clinchAccent = clinchTeam === primaryTeam ? '#FF8C00' : '#87CEEB';
  const clinchData   = clinchTeam === primaryTeam ? clinchDataA : clinchDataB;

  const goalieStatKeys  = ['saves', 'shots_against', 'goals_against', 'shutouts', '_gaa', '_svpct'];
  const goalieColLabels = ['SV', 'SA', 'GA', 'SO', 'GAA', 'SV%'];

  const drawerWidth = activeTab === 'clinch'
  ? 'clamp(680px, 68vw, 1040px)'
  : 'clamp(500px, 52vw, 820px)';

  return createPortal(
    <>
        <div ref={drawerRef} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: drawerWidth, transition: 'width .25s cubic-bezier(.4,0,.2,1)', zIndex: 1001, background: 'linear-gradient(170deg, #0c0b1a 0%, #0f0e22 40%, #0a0a14 100%)', borderLeft: '1px solid rgba(255,140,0,.25)', boxShadow: '-8px 0 40px rgba(0,0,0,.7), -2px 0 0 rgba(255,140,0,.1)', display: 'flex', flexDirection: 'column', animation: 'tdSlideIn .28s cubic-bezier(.4,0,.2,1)', overflowY: 'hidden' }}>

        {/* ── HEADER ── */}
        <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid rgba(255,140,0,.15)', background: 'linear-gradient(90deg, rgba(255,140,0,.07) 0%, transparent 100%)', flexShrink: 0, position: 'sticky', top: 0, zIndex: 10, backdropFilter: 'blur(12px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <TeamIdentity team={primaryTeam} standing={standingA} accentColor="#FF8C00" />
            {isCompare && (
              <>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.5rem', color: 'rgba(255,255,255,.25)', padding: '0 4px' }}>vs</div>
                <TeamIdentity team={compareTeam} standing={standingB} accentColor="#87CEEB" />
              </>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
              {hasPlayoffData && (
                <div style={{ display: 'flex', background: 'rgba(255,255,255,.06)', borderRadius: 6, padding: 2, gap: 2 }}>
                  {['season', 'playoff'].map((m) => (
                    <button key={m} onClick={() => setDataMode(m)}
                      style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.35rem', letterSpacing: 1, padding: '5px 8px', borderRadius: 4, border: 'none', cursor: 'pointer', background: dataMode === m ? (m === 'playoff' ? '#FFD700' : 'rgba(135,206,235,.2)') : 'transparent', color: dataMode === m ? (m === 'playoff' ? '#000' : '#87CEEB') : 'rgba(255,255,255,.35)', transition: 'all .2s' }}>
                      {m === 'season' ? 'RS' : 'PO'}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={onClose}
                style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, color: 'rgba(255,255,255,.5)', cursor: 'pointer', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', transition: 'all .2s' }}
                onMouseEnter={e => { e.currentTarget.style.background='rgba(255,60,60,.2)'; e.currentTarget.style.color='#ff6b6b'; }}
                onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,.06)'; e.currentTarget.style.color='rgba(255,255,255,.5)'; }}>✕</button>
            </div>
          </div>
          
          {!isCompare && <div style={{ marginTop: 8, fontFamily: "'Press Start 2P', monospace", fontSize: '.3rem', color: 'rgba(255,255,255,.2)', letterSpacing: 1 }}>CLICK ANY OTHER TEAM ROW TO COMPARE</div>}

            {playoffTeams > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                {['stats', 'clinch'].map((tabKey) => (
                  <button
                    key={tabKey}
                    onClick={() => setActiveTab(tabKey)}
                    style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: '.42rem',
                      letterSpacing: 1,
                      padding: '7px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      border: activeTab === tabKey ? '1px solid #FFD700' : '1px solid rgba(255,255,255,.12)',
                      background: activeTab === tabKey ? 'linear-gradient(180deg, rgba(255,140,0,.25), rgba(255,140,0,.08))' : 'rgba(255,255,255,.04)',
                      color: activeTab === tabKey ? '#FFD700' : 'rgba(255,255,255,.4)',
                      transition: 'all .2s',
                    }}
                  > 
                    {tabKey === 'stats' ? 'TEAM STATS' : 'PLAYOFF SCENARIO'} 
                  </button>
                ))}
              </div>
            )}
            </div>

        {/* ── BODY ── */}
        <div style={{ padding: '14px 18px', flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 16 }}>
              <div style={{ width: 36, height: 36, border: '3px solid rgba(255,140,0,.2)', borderTop: '3px solid #FFD700', borderRadius: '50%', animation: 'tdSpin 1s linear infinite' }} />
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.5rem', color: '#87CEEB', letterSpacing: 2 }}>LOADING...</div>
            </div>
                                        ) : activeTab === 'clinch' ? (
                                          <>
                                            {isCompare && (
                                              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                                                {[
                                                  { team: primaryTeam, color: '#FF8C00' },
                                                  { team: compareTeam, color: '#87CEEB' },
                                                ].map(({ team, color }) => {
                                                  const active = clinchTeam === team;
                                                  return (
                                                    <button
                                                      key={team}
                                                      onClick={() => setClinchFocusTeam(team)}
                                                      style={{
                                                        display: 'flex', alignItems: 'center', gap: 6,
                                                        padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                                                        border: active ? `1px solid ${color}` : '1px solid rgba(255,255,255,.12)',
                                                        background: active ? `${color}20` : 'rgba(255,255,255,.04)',
                                                        fontFamily: "'Press Start 2P', monospace", fontSize: '.42rem', letterSpacing: 1,
                                                        color: active ? color : 'rgba(255,255,255,.4)',
                                                        transition: 'all .15s',
                                                      }}
                                                    >
                                                      <img src={`/assets/teamLogos/${team}.png`} alt={team}
                                                        style={{ width: 18, height: 18, objectFit: 'contain' }}
                                                        onError={e => { e.target.style.display = 'none'; }} />
                                                      {team}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            )}
                                            <TeamSectionDivider team={clinchTeam} accentColor={clinchAccent} label="PLAYOFF PATH" />
                                            <ClinchPanel data={clinchData} accentColor={clinchAccent} playoffTeams={playoffTeams}
                                              seasonTeams={seasonTeams} rawGames={rawGames} rsGamesVs={rsGamesVs}
                                              tiebreakerRuleset={tiebreakerRuleset} sortedStandings={sortedStandings} />
                                          </>
                                        ) : isCompare ? (
                      <>
               <TeamSectionDivider team={primaryTeam} accentColor="#FF8C00" label="SKATERS" />
              <PlayerTable players={skatersA} statKeys={['goals','assists','points','shots','chk','pim']} colLabels={['G','A','PTS','S','HIT','PIM']} ranks={skaterRanks} title="" leagueTotal={leagueSkaterCount} accentColor="#FF8C00" />
              <LabelDivider label="GOALIES" accentColor="#FF8C00" />
              <PlayerTable players={goaliesA} statKeys={goalieStatKeys} colLabels={goalieColLabels} ranks={goalieRanks} title="" leagueTotal={leagueGoalieCount} accentColor="#FF8C00" />

              <TeamSectionDivider team={compareTeam} accentColor="#87CEEB" label="SKATERS" />
              <PlayerTable players={skatersB} statKeys={['goals','assists','points','shots','chk','pim']} colLabels={['G','A','PTS','S','HIT','PIM']} ranks={skaterRanks} title="" leagueTotal={leagueSkaterCount} accentColor="#87CEEB" />
              <LabelDivider label="GOALIES" accentColor="#87CEEB" />
              <PlayerTable players={goaliesB} statKeys={goalieStatKeys} colLabels={goalieColLabels} ranks={goalieRanks} title="" leagueTotal={leagueGoalieCount} accentColor="#87CEEB" />

              <Divider />
              <CompareTeamStats totalsA={totalsA} totalsB={totalsB} derivedA={derivedA} derivedB={derivedB} teamA={primaryTeam} teamB={compareTeam} standingsA={standingA} standingsB={standingB} allTeamTotals={allTeamTotals} computedStandings={computedStandings} />

              <Divider />
              <H2HLog games={h2hGames} teamA={primaryTeam} teamB={compareTeam} />
            </>
          ) : (
            <>
              <PlayerTable players={skatersA} statKeys={['goals','assists','points','shots','chk','pim']} colLabels={['G','A','PTS','S','HIT','PIM']} ranks={skaterRanks} title="SKATERS" leagueTotal={leagueSkaterCount} />
              <PlayerTable players={goaliesA} statKeys={goalieStatKeys} colLabels={goalieColLabels} ranks={goalieRanks} title="GOALIES" leagueTotal={leagueGoalieCount} />
              <Divider />
              <SingleTeamStats totals={totalsA} derived={derivedA} standing={standingA} allTeamTotals={allTeamTotals} computedStandings={computedStandings} />
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes tdSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes tdSpin    { to { transform: rotate(360deg); } }
      `}</style>
    </>,
    document.body
  );
}

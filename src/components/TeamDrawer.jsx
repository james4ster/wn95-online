// KEY FIXES:
// 1. Column names corrected: home_brk_g→home_break_goals, home_brk_amt→home_break_attempts,
//    home_atk_time→home_attack (parsed as MM:SS), home_shg→home_shg (was correct)
// 2. True competition ranking (ties share rank, next rank skips)
// 3. H2H section redesigned: last-10 record W-L-T-OTL format, PO badge, no redundant data
// 4. All rank arrays rebuilt with correct column mappings

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../utils/supabaseClient';

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
          gp: 0, shots: 0, chk: 0, pim: 0,
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
    shPct:        t.brk_amt     ? ((t.brk_g / t.brk_amt) * 100).toFixed(1)              : null,
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

/** TRUE competition ranking — ties share rank, next rank skips */
function rankVal(val, allVals, hi = true) {
  if (val == null || val === '' || !allVals?.length) return null;
  const n = parseFloat(val);
  if (isNaN(n)) return null;

  const nums = allVals.map(v => parseFloat(v)).filter(v => !isNaN(v));
  // Sort unique values
  const sorted = [...new Set(nums)].sort((a, b) => hi ? b - a : a - b);
  const idx = sorted.findIndex(v => Math.abs(v - n) < 0.001);
  return idx >= 0 ? idx + 1 : null;
}

/** Rank a value within computedStandings by key — TRUE competition ranking */
function rankInStandings(myVal, key, computedStandings, hi = true) {
  if (myVal == null) return null;
  const vals = (computedStandings || [])
    .map(s => s[key])
    .filter(v => v != null && !isNaN(Number(v)));
  return rankVal(myVal, vals, hi);
}

/** TRUE competition ranking for players */
function computeLeagueRanks(allPlayers, statKeys) {
  const ranks = {};
  statKeys.forEach((key) => {
    // Build sorted unique values
    const nums = allPlayers
      .filter(p => p[key] != null && p[key] !== '' && !isNaN(parseFloat(p[key])))
      .map(p => parseFloat(p[key]));
    const sorted = [...new Set(nums)].sort((a, b) => b - a);

    allPlayers.forEach(p => {
      const n = parseFloat(p[key]);
      if (isNaN(n)) return;
      if (!ranks[p.player_name]) ranks[p.player_name] = {};
      const idx = sorted.findIndex(v => Math.abs(v - n) < 0.001);
      ranks[p.player_name][key] = idx >= 0 ? idx + 1 : null;
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
    { label: 'DEF/G',   val: derived?.defPerGame,  rank: rankVal(derived?.defSecPerGame, ra.allDEFsec, true) },
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
      rA: rankVal(derivedA?.defSecPerGame, ra.allDEFsec, true),
      rB: rankVal(derivedB?.defSecPerGame, ra.allDEFsec, true), hi: true },
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

// ─── main component ──────────────────────────────────────────────────────────

export default function TeamDrawer({ selectedSeason, computedStandings, primaryTeam, compareTeam, onClose }) {
  const [dataMode, setDataMode]                 = useState('season');
  const [loading, setLoading]                   = useState(false);
  const [allSkaters, setAllSkaters]             = useState([]);
  const [allGoalies, setAllGoalies]             = useState([]);
  const [allTeamGameStats, setAllTeamGameStats] = useState([]);
  const [h2hGames, setH2hGames]                 = useState([]);
  const [hasPlayoffData, setHasPlayoffData]     = useState(false);

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

  // Goalie ranks — TRUE competition ranking
  const goalieRanks = useMemo(() => {
    const active = aggregatedGoalies.filter(p => p._gp > 0 && p.shots_against > 0);

    // Base ranks for raw counting stats — TRUE competition ranking
    const base = computeLeagueRanks(aggregatedGoalies, ['saves', 'shutouts', 'shots_against', 'goals_against']);

    // GAA: lower is better — active only, TRUE competition ranking
    const gaaVals = active
      .filter(p => p._gaa != null)
      .map(p => parseFloat(p._gaa))
      .filter(v => !isNaN(v));
    const gaaSortedUniq = [...new Set(gaaVals)].sort((a, b) => a - b); // ascending (lower = better)

    // SV%: higher is better — active only, TRUE competition ranking
    const svVals = active
      .filter(p => p._svpct != null)
      .map(p => parseFloat(p._svpct))
      .filter(v => !isNaN(v));
    const svSortedUniq = [...new Set(svVals)].sort((a, b) => b - a); // descending

    active.forEach(p => {
      if (!base[p.player_name]) base[p.player_name] = {};
      if (p._gaa != null) {
        const n = parseFloat(p._gaa);
        const idx = gaaSortedUniq.findIndex(v => Math.abs(v - n) < 0.001);
        base[p.player_name]._gaa = idx >= 0 ? idx + 1 : null;
      }
      if (p._svpct != null) {
        const n = parseFloat(p._svpct);
        const idx = svSortedUniq.findIndex(v => Math.abs(v - n) < 0.001);
        base[p.player_name]._svpct = idx >= 0 ? idx + 1 : null;
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

  const goalieStatKeys  = ['saves', 'shots_against', 'goals_against', 'shutouts', '_gaa', '_svpct'];
  const goalieColLabels = ['SV', 'SA', 'GA', 'SO', 'GAA', 'SV%'];

  return createPortal(
    <>
      <div ref={drawerRef} style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'clamp(500px, 52vw, 820px)', zIndex: 1001, background: 'linear-gradient(170deg, #0c0b1a 0%, #0f0e22 40%, #0a0a14 100%)', borderLeft: '1px solid rgba(255,140,0,.25)', boxShadow: '-8px 0 40px rgba(0,0,0,.7), -2px 0 0 rgba(255,140,0,.1)', display: 'flex', flexDirection: 'column', animation: 'tdSlideIn .28s cubic-bezier(.4,0,.2,1)', overflowY: 'hidden' }}>

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
        </div>

        {/* ── BODY ── */}
        <div style={{ padding: '14px 18px', flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 16 }}>
              <div style={{ width: 36, height: 36, border: '3px solid rgba(255,140,0,.2)', borderTop: '3px solid #FFD700', borderRadius: '50%', animation: 'tdSpin 1s linear infinite' }} />
              <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: '.5rem', color: '#87CEEB', letterSpacing: 2 }}>LOADING...</div>
            </div>
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

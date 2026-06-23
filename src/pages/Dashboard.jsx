// Dashboard.jsx — v5 Full-Screen Visualization Explorer
// Props: allGames, allSeasons, leagueGames, managers, mgrMeta, teamStatsRows,
//        computedStandings, champData, allSeasonsData

import { useState, useMemo, useEffect, useRef } from 'react';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  orange: '#FF8C00', gold: '#FFD700', sky: '#87CEEB',
  green: '#00DD55', red: '#FF4444', purple: '#B48EFF',
  teal: '#00D4AA', pink: '#FF6B9D', lime: '#C6F135',
  bg: '#03030a', bgPanel: 'rgba(10,10,26,.97)', bgCard: 'rgba(13,13,30,.9)',
  border: 'rgba(255,140,0,.2)', borderDim: 'rgba(255,255,255,.08)',
  textDim: 'rgba(255,255,255,.38)', textMid: 'rgba(255,255,255,.62)',
  textBright: 'rgba(255,255,255,.94)',
};
const F = {
  px: "'Press Start 2P',monospace",
  vt: "'VT323',monospace",
  bc: "'Barlow Condensed',sans-serif",
};

const norm = s => (s || '').toString().trim().toLowerCase();
const seasonNum = lg => { const n = parseInt((lg || '').replace(/\D/g, ''), 10); return isNaN(n) ? 0 : n; };
const PLAYOFF_VALS = new Set(['PO', 'PLAYOFF', 'PLAYOFFS', 'P', 'POST', 'POSTSEASON']);
const rsOnly = g => !g._isPlayoff && !PLAYOFF_VALS.has((g.mode || '').trim().toUpperCase());


// Preload images so Dashboard logos display in Safari
function usePreloadedImages(urls) {
  const [loaded, setLoaded] = useState(false);
  const cache = useRef({});

  useEffect(() => {
    if (!urls?.length) { setLoaded(true); return; }
    let remaining = urls.length;
    urls.forEach(url => {
      if (cache.current[url]) { remaining--; if (!remaining) setLoaded(true); return; }
      const img = new Image();
      img.onload = img.onerror = () => {
        cache.current[url] = img;
        remaining--;
        if (!remaining) setLoaded(true);
      };
      img.src = url;  // no crossOrigin needed for same-origin
    });
  }, [urls?.join(',')]);

  return { loaded, cache: cache.current };
}

function gameResult(sh, sa, ot, side) {
  const ms = side === 'home' ? sh : sa, os = side === 'home' ? sa : sh;
  if (ms > os) return 'W';
  if (os > ms) return ot ? 'OTL' : 'L';
  return 'T';
}

// ─── Team logo with graceful fallback ────────────────────────────────────────
function TeamLogo({ code, size = 32, color = C.orange, style = {} }) {
  const [err, setErr] = useState(false);
  if (!code || err) return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `${color}1c`, border: `1.5px solid ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: F.px, fontSize: size * 0.26, color, flexShrink: 0, ...style,
    }}>
      {(code || '?').slice(0, 3).toUpperCase()}
    </div>
  );
  return (
    <img src={`/assets/teamLogos/${code}.png`} alt={code} onError={() => setErr(true)}
      style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, filter: 'drop-shadow(0 0 6px rgba(255,255,255,.2))', ...style }} />
  );
}

// ─── Data builders (career + season aggregates) ──────────────────────────────

function buildAllSeasonStats(games) {
  const out = new Map();
  for (const g of games) {
    if (!rsOnly(g)) continue;
    const sh = Number(g.score_home || 0), sa = Number(g.score_away || 0), ot = !!g.ot;
    const lg = g.lg; if (!lg) continue;
    const homeCode = (g.home || g.home_code || g.team_code_home || '').toString().trim().toUpperCase();
    const awayCode = (g.away || g.away_code || g.team_code_away || '').toString().trim().toUpperCase();
    const add = (coach, ms, os, side, code) => {
      if (!coach) return;
      const cn = norm(coach);
      if (!out.has(cn)) out.set(cn, new Map());
      const seasons = out.get(cn);
      if (!seasons.has(lg)) seasons.set(lg, { gp: 0, w: 0, l: 0, otl: 0, t: 0, gf: 0, ga: 0, pts: 0, so: 0, coach: coach.trim(), code });
      const s = seasons.get(lg);
      s.gp++; s.gf += ms; s.ga += os;
      if (code) s.code = code;
      const res = gameResult(sh, sa, ot, side);
      if (res === 'W') { s.w++; s.pts += 2; }
      else if (res === 'OTL') { s.otl++; s.pts += 1; }
      else if (res === 'T') { s.t++; s.pts += 1; }
      else s.l++;
      if (os === 0) s.so++;
    };
    add(g.coach_home, sh, sa, 'home', homeCode);
    add(g.coach_away, sa, sh, 'away', awayCode);
  }
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

function buildCareerTotals(allSeasonStats) {
  const out = [];
  for (const [cn, seasons] of allSeasonStats) {
    let gp = 0, w = 0, l = 0, otl = 0, t = 0, gf = 0, ga = 0, pts = 0, so = 0, code = null, coachName = cn;
    for (const [, s] of seasons) {
      gp += s.gp; w += s.w; l += s.l; otl += s.otl; t += s.t;
      gf += s.gf; ga += s.ga; pts += s.pts; so += s.so;
      coachName = s.coach || coachName;
      if (s.code) code = s.code;
    }
    const maxPts = gp * 2;
    out.push({
      cn, name: coachName, code, gp, w, l, otl, t, gf, ga, pts, so,
      ptsPct: maxPts > 0 ? +((pts / maxPts) * 100).toFixed(1) : 0,
      gfpg: gp > 0 ? +(gf / gp).toFixed(2) : 0,
      gapg: gp > 0 ? +(ga / gp).toFixed(2) : 0,
      gd: gf - ga,
      gdpg: gp > 0 ? +((gf - ga) / gp).toFixed(2) : 0,
      wpct: gp > 0 ? +((w / gp) * 100).toFixed(1) : 0,
      seasons: seasons.size,
    });
  }
  return out;
}

function buildSeasonRecords(allSeasonStats) {
  const out = [];
  for (const [cn, seasons] of allSeasonStats) {
    for (const [lg, s] of seasons) {
      if (s.gp < 10) continue;
      out.push({ cn, name: s.coach, code: s.code, season: lg, n: seasonNum(lg), ...s });
    }
  }
  return out;
}

// mm:ss formatter for time-based averages (values stored in seconds)
function secsToClock(totalSecs) {
  if (totalSecs == null || isNaN(totalSecs)) return '0:00';
  const s = Math.round(totalSecs);
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// Pull a numeric field trying several possible source-row key spellings
function num(row, ...keys) {
  for (const k of keys) {
    if (row[k] != null && row[k] !== '') return Number(row[k]);
  }
  return 0;
}

// Time fields arrive as "MM:SS:00" strings — the trailing segment isn't
// seconds, ignore it. Number() on a colon string returns NaN, so this
// can't reuse num().
function numTime(row, ...keys) {
  for (const k of keys) {
    if (row[k] != null && row[k] !== '') {
      const parts = String(row[k]).trim().split(':').map(Number);
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return parts[0] * 60 + parts[1]; // MM:SS
      }
      return Number(row[k]) || 0;
    }
  }
  return 0;
}

function buildAdvStats(teamStatsRows) {
  if (!teamStatsRows?.length) return [];
  const byCoach = {};
  for (const row of teamStatsRows) {
    const cn = norm(row.coach || '');
    if (!cn) continue;
    const code = (row.team_code || row.code || '').toString().trim().toUpperCase();
    if (!byCoach[cn]) byCoach[cn] = {
      name: (row.coach || '').trim(), code: code || null, gp: 0,
      // scoring
      pp_g: 0, sh_g: 0, ot_g: 0,
      // shots
      shots: 0, shots_ag: 0, goals: 0, goals_ag: 0,
      // special teams
      pp_opps: 0, pp_shots: 0, pp_time_total: 0, pk_opps: 0, pk_ga: 0, sh_time_total: 0,
      ps_att: 0, ps_g: 0,
      // faceoffs
      fo_won: 0, fo_total: 0,
      // passing
      pass_att: 0, pass_comp: 0,
      // physical
      chk: 0, chk_ag: 0,
      // danger / expected goals
      break_g: 0, break_att: 0, xa_shots: 0, xg: 0,
      // zone time
      atk_time_total: 0, def_time_total: 0,
    };
    const s = byCoach[cn];
    if (code) s.code = code;
    const gp = num(row, 'gp') || 1;
    s.gp += gp;

    s.pp_g += num(row, 'pp_g', 'pp_goals');
    s.sh_g += num(row, 'sh_g', 'shg', 'sh_goals');
    s.ot_g += num(row, 'ot_g', 'ot_goals');

    s.shots += num(row, 'shots', 'sf');
    s.shots_ag += num(row, 'shots_ag', 'sa');
    s.goals += num(row, 'goals', 'gf');
    s.goals_ag += num(row, 'goals_ag', 'ga');

    s.pp_opps += num(row, 'pp_amt', 'pp_opps', 'pp_opportunities');
    s.pp_shots += num(row, 'pp_shots');
    s.pp_time_total  += numTime(row, 'pp_time_avg', 'pp_time') * gp;
    s.pk_opps += num(row, 'pk_opps', 'pk_opportunities');
    s.pk_ga += num(row, 'pk_goals_against', 'pk_ga');
    s.sh_time_total  += numTime(row, 'sh_time_avg', 'sh_time') * gp;
    s.ps_att += num(row, 'ps_att', 'penalty_shot_attempts');
    s.ps_g += num(row, 'ps_g', 'penalty_shot_goals');

    s.fo_won += num(row, 'fo_won');
    s.fo_total += num(row, 'fo_total');

    s.pass_att += num(row, 'pass_att', 'passes_attempted', 'pass_attempts');
    s.pass_comp += num(row, 'pass_comp', 'passes_completed', 'pass_completions');

    s.chk += num(row, 'chk', 'checks');
    s.chk_ag += num(row, 'chk_ag', 'checks_against');

    s.break_g += num(row, 'break_g', 'breakaway_goals');
    s.break_att += num(row, 'break_att', 'breakaway_attempts', 'breakaway_shots');
    s.xa_shots += num(row, 'xa_shots', '1xa');
    s.xg += num(row, 'xg', '1xg');

    s.atk_time_total += numTime(row, 'atk_time_avg', 'atk_time') * gp;
    s.def_time_total += numTime(row, 'def_time_avg', 'def_time') * gp;
  }

  return Object.entries(byCoach).map(([cn, s]) => {
    const gp = s.gp || 1;
    return {
      cn, name: s.name, code: s.code, gp: s.gp,
      // scoring
      ppGoals: s.pp_g, shGoals: s.sh_g, otGoals: s.ot_g,
      // shots
      shots: s.shots, shotsAg: s.shots_ag, shotDiff: s.shots - s.shots_ag,
      sfpg: +(s.shots / gp).toFixed(2), sapg: +(s.shots_ag / gp).toFixed(2),
      shPct: s.shots > 0 ? +((s.goals / s.shots) * 100).toFixed(1) : 0,
      svPct: s.shots_ag > 0 ? +((1 - s.goals_ag / s.shots_ag) * 100).toFixed(1) : 0,
      // special teams
      ppPct: s.pp_opps > 0 ? +((s.pp_g / s.pp_opps) * 100).toFixed(1) : 0,
      ppAttempts: s.pp_opps, ppShots: s.pp_shots,
      ppTimeAvg: +(s.pp_time_total / gp).toFixed(1),
      pkPct: s.pk_opps > 0 ? +(((s.pk_opps - s.pk_ga) / s.pk_opps) * 100).toFixed(1) : 0,
      shTimeAvg: +(s.sh_time_total / gp).toFixed(1),
      psAttempts: s.ps_att, psGoals: s.ps_g,
      psPct: s.ps_att > 0 ? +((s.ps_g / s.ps_att) * 100).toFixed(1) : 0,
      // faceoffs
      foWon: s.fo_won, foTotal: s.fo_total,
      foPct: s.fo_total > 0 ? +((s.fo_won / s.fo_total) * 100).toFixed(1) : 0,
      // passing
      passAtt: s.pass_att, passComp: s.pass_comp,
      passPct: s.pass_att > 0 ? +((s.pass_comp / s.pass_att) * 100).toFixed(1) : 0,
      passAttPg: +(s.pass_att / gp).toFixed(1), passCompPg: +(s.pass_comp / gp).toFixed(1),
      // physical
      chk: s.chk, chkAg: s.chk_ag,
      chkPg: +(s.chk / gp).toFixed(2), chkAgPg: +(s.chk_ag / gp).toFixed(2),
      // danger
      brGoals: s.break_g, brAttempts: s.break_att,
      brPct: s.break_att > 0 ? +((s.break_g / s.break_att) * 100).toFixed(1) : 0,
      xgPct: s.xa_shots > 0 ? +((s.xg / s.xa_shots) * 100).toFixed(1) : 0,
      xaShots: s.xa_shots, xg: s.xg,
      // Combined danger-chance conversion: breakaways + one-timers + penalty shots
      dangerGoals: s.break_g + s.xg + s.ps_g,
      dangerAtt: s.break_att + s.xa_shots + s.ps_att,
      dangerPct: (s.break_att + s.xa_shots + s.ps_att) > 0
        ? +(((s.break_g + s.xg + s.ps_g) / (s.break_att + s.xa_shots + s.ps_att)) * 100).toFixed(1)
        : 0,

      // zone time (raw seconds avg per game, for both numeric sort and clock display)
      atkTimeAvg: +(s.atk_time_total / gp).toFixed(1),
      defTimeAvg: +(s.def_time_total / gp).toFixed(1),
      // legacy aliases kept for safety
      penPG: 0,
    };
  });
}

function buildAdvSeasonRecords(teamStatsRows) {
  const out = new Map(); // key: `${cn}|${lg}`

  for (const row of (teamStatsRows || [])) {
    const cn = norm(row.coach || ''); if (!cn) continue;
    const lg = row.lg || row.season; if (!lg) continue;
    const code = (row.team_code || row.code || '').toString().trim().toUpperCase();
    const key = `${cn}|${lg}`;

    if (!out.has(key)) {
      out.set(key, {
        cn, season: lg, n: seasonNum(lg), name: (row.coach || '').trim(),
        code: code || null, gp: 0,
        ppGoals: 0, shGoals: 0, otGoals: 0,
        shots: 0, shotsAg: 0,
        goals: 0, goals_ag: 0,
        pp_opps: 0, pp_shots: 0, pp_time_total: 0,
        pk_opps: 0, pk_ga: 0, sh_time_total: 0,
        ps_att: 0, ps_g: 0,
        fo_won: 0, fo_total: 0,
        pass_att: 0, pass_comp: 0,
        chk: 0, chk_ag: 0,
        break_g: 0, break_att: 0,
        xa_shots: 0, xg: 0,
        atk_time_total: 0, def_time_total: 0,
      });
    }

    const s = out.get(key);
    if (code) s.code = code;
    const gp = num(row, 'gp') || 1;
    s.gp += gp;

    s.ppGoals  += num(row, 'pp_g', 'pp_goals');
    s.shGoals  += num(row, 'sh_g', 'shg', 'sh_goals');
    s.otGoals  += num(row, 'ot_g', 'ot_goals');
    s.shots    += num(row, 'shots', 'sf');
    s.shotsAg  += num(row, 'shots_ag', 'sa');
    s.goals    += num(row, 'goals', 'gf');
    s.goals_ag += num(row, 'goals_ag', 'ga');
    s.pp_opps  += num(row, 'pp_amt', 'pp_opps', 'pp_opportunities');
    s.pp_shots += num(row, 'pp_shots');
    s.pp_time_total  += numTime(row, 'pp_time_avg', 'pp_time') * gp;
    s.pk_opps  += num(row, 'pk_opps', 'pk_opportunities');
    s.pk_ga    += num(row, 'pk_goals_against', 'pk_ga');
    s.sh_time_total  += numTime(row, 'sh_time_avg', 'sh_time') * gp;
    s.ps_att   += num(row, 'ps_att', 'penalty_shot_attempts');
    s.ps_g     += num(row, 'ps_g', 'penalty_shot_goals');
    s.fo_won   += num(row, 'fo_won');
    s.fo_total += num(row, 'fo_total');
    s.pass_att  += num(row, 'pass_att', 'passes_attempted', 'pass_attempts');
    s.pass_comp += num(row, 'pass_comp', 'passes_completed', 'pass_completions');
    s.chk      += num(row, 'chk', 'checks');
    s.chk_ag   += num(row, 'chk_ag', 'checks_against');
    s.break_g  += num(row, 'break_g', 'breakaway_goals');
    s.break_att += num(row, 'break_att', 'breakaway_attempts', 'breakaway_shots');
    s.xa_shots += num(row, 'xa_shots', '1xa');
    s.xg       += num(row, 'xg', '1xg');
    s.atk_time_total += numTime(row, 'atk_time_avg', 'atk_time') * gp;
    s.def_time_total += numTime(row, 'def_time_avg', 'def_time') * gp;
  }

  const result = [];
  for (const s of out.values()) {
    if (s.gp < 10) continue;
    const gp = s.gp;
    result.push({
      cn: s.cn, season: s.season, n: s.n, gp, name: s.name, code: s.code,
      ppGoals: s.ppGoals, shGoals: s.shGoals, otGoals: s.otGoals,
      shots: s.shots, shotsAg: s.shotsAg, shotDiff: s.shots - s.shotsAg,
      sfpg: +(s.shots / gp).toFixed(2), sapg: +(s.shotsAg / gp).toFixed(2),
      shPct:  s.shots   > 0 ? +((s.goals    / s.shots)   * 100).toFixed(1) : 0,
      svPct:  s.shotsAg > 0 ? +((1 - s.goals_ag / s.shotsAg) * 100).toFixed(1) : 0,
      ppPct:  s.pp_opps > 0 ? +((s.ppGoals  / s.pp_opps) * 100).toFixed(1) : 0,
      ppAttempts: s.pp_opps, ppShots: s.pp_shots,
      ppTimeAvg: +(s.pp_time_total / gp).toFixed(1),
      pkPct:  s.pk_opps > 0 ? +(((s.pk_opps - s.pk_ga) / s.pk_opps) * 100).toFixed(1) : 0,
      shTimeAvg: +(s.sh_time_total / gp).toFixed(1),
      psAttempts: s.ps_att, psGoals: s.ps_g,
      psPct:  s.ps_att  > 0 ? +((s.ps_g     / s.ps_att)  * 100).toFixed(1) : 0,
      foWon: s.fo_won, foTotal: s.fo_total,
      foPct:  s.fo_total > 0 ? +((s.fo_won   / s.fo_total) * 100).toFixed(1) : 0,
      passAtt: s.pass_att, passComp: s.pass_comp,
      passPct: s.pass_att > 0 ? +((s.pass_comp / s.pass_att) * 100).toFixed(1) : 0,
      passAttPg:  +(s.pass_att  / gp).toFixed(1),
      passCompPg: +(s.pass_comp / gp).toFixed(1),
      chk: s.chk, chkAg: s.chk_ag,
      chkPg:   +(s.chk    / gp).toFixed(2),
      chkAgPg: +(s.chk_ag / gp).toFixed(2),
      brGoals: s.break_g, brAttempts: s.break_att,
      brPct:   s.break_att > 0 ? +((s.break_g  / s.break_att) * 100).toFixed(1) : 0,
      xgPct:   s.xa_shots > 0 ? +((s.xg       / s.xa_shots)  * 100).toFixed(1) : 0,
      xaShots: s.xa_shots, xg: s.xg,
      // Combined danger-chance conversion: breakaways + one-timers + penalty shots
      dangerGoals: s.break_g + s.xg + s.ps_g,
      dangerAtt: s.break_att + s.xa_shots + s.ps_att,
      dangerPct: (s.break_att + s.xa_shots + s.ps_att) > 0
        ? +(((s.break_g + s.xg + s.ps_g) / (s.break_att + s.xa_shots + s.ps_att)) * 100).toFixed(1)
        : 0,
      atkTimeAvg: +(s.atk_time_total / gp).toFixed(1),
      defTimeAvg: +(s.def_time_total / gp).toFixed(1),
    });
  }
  return result;
}

// ─── Category registry ────────────────────────────────────────────────────────
// Each category defines: key (field name to read), label, unit, higherBetter,
// group (for sidebar sectioning), color, icon, adv (requires teamStatsRows),
// fmt (optional custom value formatter, e.g. for mm:ss clock display)
const CATEGORIES = [
  // ── OVERALL ──
  { key: 'ptsPct', label: 'Points %',             unit: '%', higherBetter: true,  group: 'OVERALL', color: C.gold,   icon: '📈' },
  { key: 'wpct',   label: 'Win %',                unit: '%', higherBetter: true,  group: 'OVERALL', color: C.orange, icon: '🏆' },
  { key: 'gdpg',   label: 'Goal Diff / Game',     unit: '',  higherBetter: true,  group: 'OVERALL', color: C.teal,   icon: '⚖️' },

  // ── SCORING ──
  { key: 'gf',     label: 'Goals For',            unit: '',  higherBetter: true,  group: 'SCORING', color: C.green,  icon: '⚡', adv: false },
  { key: 'ga',     label: 'Goals Against',        unit: '',  higherBetter: false, group: 'SCORING', color: C.sky,    icon: '🛡', adv: false },
  { key: 'gd',     label: 'Goal Differential',    unit: '',  higherBetter: true,  group: 'SCORING', color: C.teal,   icon: '⚖️' },
  { key: 'gfpg',   label: 'Goals For / Game',     unit: '',  higherBetter: true,  group: 'SCORING', color: C.green,  icon: '⚡' },
  { key: 'gapg',   label: 'Goals Against / Game', unit: '',  higherBetter: false, group: 'SCORING', color: C.sky,    icon: '🛡' },
  { key: 'ppGoals',label: 'Power Play Goals',     unit: '',  higherBetter: true,  group: 'SCORING', color: C.gold,   icon: '💥', adv: true },
  { key: 'shGoals',label: 'Short-Handed Goals',   unit: '',  higherBetter: true,  group: 'SCORING', color: C.lime,   icon: '🩳', adv: true },
  { key: 'otGoals',label: 'Overtime Goals',       unit: '',  higherBetter: true,  group: 'SCORING', color: C.purple, icon: '⏱', adv: true },
  { key: 'so',     label: 'Shutouts',             unit: '',  higherBetter: true,  group: 'SCORING', color: C.purple, icon: '🔒' },

  // ── SHOTS ──
  { key: 'shots',   label: 'Shots For',           unit: '',  higherBetter: true,  group: 'SHOTS', color: C.orange, icon: '🎯', adv: true },
  { key: 'shotsAg', label: 'Shots Against',       unit: '',  higherBetter: false, group: 'SHOTS', color: C.sky,    icon: '🥅', adv: true },
  { key: 'shotDiff',label: 'Shot Differential',   unit: '',  higherBetter: true,  group: 'SHOTS', color: C.teal,   icon: '⚖️', adv: true },
  { key: 'sfpg',    label: 'Shots For / Game',    unit: '',  higherBetter: true,  group: 'SHOTS', color: C.orange, icon: '🎯', adv: true },
  { key: 'sapg',    label: 'Shots Against / Game',unit: '',  higherBetter: false, group: 'SHOTS', color: C.sky,    icon: '🥅', adv: true },
  { key: 'shPct',   label: 'Shooting %',          unit: '%', higherBetter: true,  group: 'SHOTS', color: C.orange, icon: '🎯', adv: true },
  { key: 'svPct',   label: 'Save %',              unit: '%', higherBetter: true,  group: 'SHOTS', color: C.sky,    icon: '🧤', adv: true },

  // ── SPECIAL TEAMS ──
  { key: 'ppPct',     label: 'Power Play %',          unit: '%', higherBetter: true,  group: 'SPECIAL TEAMS', color: C.gold, icon: '⚡', adv: true },
  { key: 'ppAttempts',label: 'Power Play Attempts',   unit: '',  higherBetter: true,  group: 'SPECIAL TEAMS', color: C.gold, icon: '🔢', adv: true },
  { key: 'ppShots',   label: 'Power Play Shots',      unit: '',  higherBetter: true,  group: 'SPECIAL TEAMS', color: C.gold, icon: '🎯', adv: true },
  { key: 'ppTimeAvg', label: 'Avg Power Play Time / Game', unit: 'clock', higherBetter: true,  group: 'SPECIAL TEAMS', color: C.gold, icon: '⏱', adv: true },
  { key: 'pkPct',     label: 'Penalty Kill %',        unit: '%', higherBetter: true,  group: 'SPECIAL TEAMS', color: C.teal, icon: '🛡', adv: true },
  { key: 'shTimeAvg', label: 'Avg Short-Handed Time / Game', unit: 'clock', higherBetter: false, group: 'SPECIAL TEAMS', color: C.teal, icon: '⏱', adv: true },
  { key: 'psAttempts',label: 'Penalty Shot Attempts', unit: '',  higherBetter: true,  group: 'SPECIAL TEAMS', color: C.pink, icon: '🎯', adv: true },
  { key: 'psGoals',   label: 'Penalty Shot Goals',    unit: '',  higherBetter: true,  group: 'SPECIAL TEAMS', color: C.pink, icon: '💥', adv: true },
  { key: 'psPct',     label: 'Penalty Shot %',        unit: '%', higherBetter: true,  group: 'SPECIAL TEAMS', color: C.pink, icon: '🎯', adv: true },

  // ── FACEOFFS ──
  { key: 'foWon',   label: 'Faceoffs Won',     unit: '',  higherBetter: true, group: 'FACEOFFS', color: C.lime, icon: '🥍', adv: true },
  { key: 'foTotal', label: 'Faceoffs Total',   unit: '',  higherBetter: true, group: 'FACEOFFS', color: C.lime, icon: '🥍', adv: true },
  { key: 'foPct',   label: 'Faceoff Win %',    unit: '%', higherBetter: true, group: 'FACEOFFS', color: C.lime, icon: '🥍', adv: true },

  // ── PASSING ──
  { key: 'passAtt',     label: 'Pass Attempts',         unit: '',  higherBetter: true, group: 'PASSING', color: C.sky, icon: '🏒', adv: true },
  { key: 'passComp',    label: 'Pass Completions',      unit: '',  higherBetter: true, group: 'PASSING', color: C.sky, icon: '🏒', adv: true },
  { key: 'passPct',     label: 'Pass Completion %',     unit: '%', higherBetter: true, group: 'PASSING', color: C.sky, icon: '🏒', adv: true },
  { key: 'passAttPg',   label: 'Pass Attempts / Game',  unit: '',  higherBetter: true, group: 'PASSING', color: C.sky, icon: '🏒', adv: true },
  { key: 'passCompPg',  label: 'Pass Completions / Game', unit: '', higherBetter: true, group: 'PASSING', color: C.sky, icon: '🏒', adv: true },

  // ── PHYSICAL ──
  { key: 'chk',      label: 'Checks',              unit: '', higherBetter: true,  group: 'PHYSICAL', color: C.red, icon: '💢', adv: true },
  { key: 'chkAg',    label: 'Checks Against',      unit: '', higherBetter: false, group: 'PHYSICAL', color: C.red, icon: '💢', adv: true },
  { key: 'chkPg',    label: 'Checks / Game',       unit: '', higherBetter: true,  group: 'PHYSICAL', color: C.red, icon: '💢', adv: true },
  { key: 'chkAgPg',  label: 'Checks Against / Game', unit: '', higherBetter: false, group: 'PHYSICAL', color: C.red, icon: '💢', adv: true },

  // ── DANGER / EXPECTED GOALS ──
  { key: 'brGoals',   label: 'Breakaway Goals',     unit: '',  higherBetter: true, group: 'DANGER', color: C.pink,   icon: '💨', adv: true },
  { key: 'brAttempts',label: 'Breakaway Attempts',  unit: '',  higherBetter: true, group: 'DANGER', color: C.pink,   icon: '💨', adv: true },
  { key: 'brPct',     label: 'Breakaway Goal %',    unit: '%', higherBetter: true, group: 'DANGER', color: C.pink,   icon: '💨', adv: true },
  { key: 'xaShots',   label: 'Expected Goal Shots (1XA)', unit: '', higherBetter: true, group: 'DANGER', color: C.purple, icon: '🔮', adv: true },
  { key: 'xg',        label: 'Expected Goals (1XG)',unit: '',  higherBetter: true, group: 'DANGER', color: C.purple, icon: '🔮', adv: true },
  { key: 'xgPct',     label: '1X Conversion Rate',  unit: '%', higherBetter: true, group: 'DANGER', color: C.purple, icon: '🔮', adv: true },
  { key: 'dangerPct', label: 'Danger Chance Conversion %', unit: '%', higherBetter: true, group: 'DANGER', color: C.red, icon: '🚨', adv: true, chartType: 'bar' },

  // ── ZONE TIME ──
  { key: 'atkTimeAvg', label: 'Avg Attack Zone Time / Game',     unit: 'clock', higherBetter: true,  group: 'ZONE TIME', color: C.green, icon: '⚔️', adv: true },
  { key: 'defTimeAvg', label: 'Avg Defensive Zone Time / Game',  unit: 'clock', higherBetter: false, group: 'ZONE TIME', color: C.sky,    icon: '🏠', adv: true },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function ScopeToggle({ scope, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 14px' }}>
      {['ALL-TIME', 'SEASON'].map(s => {
        const on = scope === s;
        return (
          <button key={s} onClick={() => onChange(s)}
            style={{
              fontFamily: F.px, fontSize: '.42rem', letterSpacing: 1.2,
              padding: '.85rem 1rem', borderRadius: 10, textAlign: 'left',
              border: `2px solid ${on ? C.orange : C.borderDim}`,
              background: on ? `linear-gradient(135deg,${C.orange}26,${C.orange}0c)` : 'rgba(255,255,255,.02)',
              color: on ? C.orange : C.textDim, cursor: 'pointer',
              transition: 'all .18s', boxShadow: on ? `0 0 22px ${C.orange}28` : 'none',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
            <span style={{ fontSize: 15 }}>{s === 'ALL-TIME' ? '🏛️' : '🌟'}</span>
            <span>
              <div>{s === 'ALL-TIME' ? 'CAREER TOTALS' : 'BEST SEASONS'}</div>
              <div style={{ fontFamily: F.bc, fontSize: '.62rem', color: on ? `${C.orange}aa` : C.textDim, letterSpacing: .3, marginTop: 3, fontWeight: 400 }}>
                {s === 'ALL-TIME' ? 'cumulative, entire history' : 'top single-season ever'}
              </div>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CategoryRow({ cat, active, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
        padding: '9px 14px', border: 'none', borderLeft: `3px solid ${active ? cat.color : 'transparent'}`,
        background: active ? `linear-gradient(90deg,${cat.color}1c,transparent)` : 'transparent',
        color: active ? cat.color : C.textMid, cursor: 'pointer', textAlign: 'left',
        transition: 'all .15s', fontFamily: F.bc, fontSize: '.92rem',
      }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,.04)'; }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
      <span style={{ fontSize: 14, opacity: active ? 1 : .6 }}>{cat.icon}</span>
      <span style={{ fontWeight: active ? 700 : 400, letterSpacing: .2 }}>{cat.label}</span>
      {active && <span style={{ marginLeft: 'auto', fontSize: 10 }}>▶</span>}
    </button>
  );
}

function Sidebar({ scope, setScope, activeKey, setActiveKey, hasAdv }) {
  const groups = useMemo(() => {
    const visible = CATEGORIES.filter(c => !c.adv || hasAdv);
    const out = {};
    for (const c of visible) { if (!out[c.group]) out[c.group] = []; out[c.group].push(c); }
    return out;
  }, [hasAdv]);

  return (
    <div style={{
      width: 270, flexShrink: 0, height: '100vh', overflowY: 'auto',
      background: C.bgPanel, borderRight: `1px solid ${C.border}`,
      display: 'flex', flexDirection: 'column', gap: 18, padding: '20px 0 28px',
      position: 'sticky', top: 0,
    }}>
      {/* Title */}
      <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20 }}>🏒</span>
        <div>
          <div style={{ fontFamily: F.px, fontSize: '.42rem', color: C.orange, letterSpacing: 1.5, lineHeight: 1.5 }}>WN95HL</div>
          <div style={{ fontFamily: F.bc, fontSize: '.85rem', color: C.textDim, letterSpacing: .5 }}>League Explorer</div>
        </div>
      </div>

      <div style={{ height: 1, background: C.borderDim, margin: '0 14px' }} />

      <ScopeToggle scope={scope} onChange={setScope} />

      <div style={{ height: 1, background: C.borderDim, margin: '0 14px' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {Object.entries(groups).map(([groupName, cats]) => (
          <div key={groupName} style={{ marginBottom: 6 }}>
            <div style={{ fontFamily: F.px, fontSize: '.46rem', color: C.textDim, letterSpacing: 2, padding: '8px 14px 6px' }}>{groupName}</div>
            {cats.map(c => (
              <CategoryRow key={c.key} cat={c} active={activeKey === c.key} onClick={() => setActiveKey(c.key)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Scale helpers (hand-rolled, no chart library) ───────────────────────────
function linearScale(domain, range) {
  const [d0, d1] = domain, [r0, r1] = range;
  const span = d1 - d0 || 1;
  return v => r0 + ((v - d0) / span) * (r1 - r0);
}

// Simple deterministic pseudo-random jitter seeded by a string, so the same
// point always lands in the same vertical lane across re-renders.
function seededJitter(key, spread) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return ((h % 1000) / 1000 - 0.5) * spread;
}

// ─── Main visualization: true scatter / dot plot with logo markers ──────────
function ScatterVisualization({ rows, cat, scope }) {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [containerRef, setContainerRef] = useState(null);
  const [dims, setDims] = useState({ w: 1000, h: 600 });

  useEffect(() => { setMounted(false); setHovered(null); const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t); }, [cat.key, scope]);

  useEffect(() => {
    if (!containerRef) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDims({ w: width, h: height });
      }
    });
    ro.observe(containerRef);
    return () => ro.disconnect();
  }, [containerRef]);

  const points = useMemo(() => {
    const s = [...rows].sort((a, b) => cat.higherBetter ? b[cat.key] - a[cat.key] : a[cat.key] - b[cat.key]);
    return s.slice(0, 20);
  }, [rows, cat]);

  const logoUrls = useMemo(() => [...new Set(points.map(p => p.code).filter(Boolean).map(c => `/assets/teamLogos/${c}.png`))], [points]);
  const { cache } = usePreloadedImages(logoUrls);

  if (!points.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, color: C.textDim }}>
        <span style={{ fontSize: 48, opacity: .2 }}>📊</span>
        <span style={{ fontFamily: F.px, fontSize: '.5rem', letterSpacing: 2 }}>NO DATA AVAILABLE</span>
      </div>
    );
  }

  const fmt = v => {
    if (v == null) return '—';
    if (cat.unit === 'clock') return secsToClock(v);
    if (cat.unit === '%') return `${v}%`;
    if (Number.isInteger(v)) return v;
    return v.toFixed(2);
  };

  // Plot geometry
  const MARGIN = { top: 70, right: 90, bottom: 70, left: 90 };
  const plotW = Math.max(dims.w - MARGIN.left - MARGIN.right, 200);
  const plotH = Math.max(dims.h - MARGIN.top - MARGIN.bottom, 200);

  const vals = points.map(p => p[cat.key]);
  let vMin = Math.min(...vals), vMax = Math.max(...vals);
  const pad = (vMax - vMin) * 0.12 || Math.abs(vMax) * 0.1 || 1;
  vMin -= pad; vMax += pad;

  // X = value axis (always left→right regardless of higher/lower-better,
  // but we flip so "best" is visually toward the right side)
  const xScale = cat.higherBetter
    ? linearScale([vMin, vMax], [0, plotW])
    : linearScale([vMax, vMin], [0, plotW]); // inverted: lower value -> further right -> "better" still reads left-to-right as worse->best

  // Y = single lane with deterministic jitter + slight rank-based offset so
  // points spread vertically like a beeswarm instead of stacking in a line
  const laneCount = 7;
  const yScale = linearScale([0, laneCount - 1], [plotH * 0.12, plotH * 0.88]);

  const positioned = points.map((p, i) => {
    const key = `${p.cn}-${p.season || 'career'}`;
    const baseLane = i % laneCount;
    const jitterLane = baseLane + seededJitter(key, 1.6);
    return {
      ...p,
      _x: xScale(p[cat.key]),
      _y: yScale(Math.max(0, Math.min(laneCount - 1, jitterLane))),
      _rank: i,
    };
  });

  const radiusFor = (rank) => rank === 0 ? 30 : rank < 3 ? 25 : rank < 8 ? 20 : 16;

  // Axis ticks
  const tickCount = 6;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const t = i / (tickCount - 1);
    const val = cat.higherBetter ? vMin + t * (vMax - vMin) : vMax - t * (vMax - vMin);
    return { x: t * plotW, val };
  });

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 40px 24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 8, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 30 }}>{cat.icon}</span>
          <h1 style={{ fontFamily: F.px, fontSize: '1.5rem', color: cat.color, letterSpacing: 2, margin: 0, textShadow: `0 0 30px ${cat.color}44` }}>
            {cat.label.toUpperCase()}
          </h1>
          <span style={{ fontFamily: F.bc, fontSize: '1.3rem', color: C.textDim, letterSpacing: .5 }}>
            {scope === 'ALL-TIME' ? 'Career totals — entire history' : 'Best single-season performances — all-time'}
          </span>
        </div>
        <div style={{ fontFamily: F.px, fontSize: '10px', color: C.textDim, letterSpacing: 1.5, marginTop: 8 }}>
          TOP {points.length} {cat.higherBetter ? '· HIGHER = BETTER' : '· LOWER = BETTER'} · MIN 10 GP · HOVER A LOGO FOR DETAILS
        </div>
      </div>

      {/* Plot area */}
      <div ref={setContainerRef} style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <svg width="100%" height="100%" style={{ overflow: 'visible', display: 'block' }}>
          <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>

            {/* Gridlines + axis */}
            {ticks.map((t, i) => (
              <g key={i}>
                <line x1={t.x} y1={0} x2={t.x} y2={plotH} stroke="rgba(255,255,255,.05)" strokeWidth={1} />
                <text x={t.x} y={plotH + 28} textAnchor="middle" fill={C.textDim} fontFamily={F.vt} fontSize={17}>
                  {cat.unit === 'clock' ? secsToClock(t.val)
                    : cat.unit === '%' ? `${Math.round(t.val)}%`
                    : Math.round(t.val * 100) / 100}
                </text>
              </g>
            ))}
            <line x1={0} y1={plotH} x2={plotW} y2={plotH} stroke={C.borderDim} strokeWidth={1.5} />

            {/* direction labels */}
            <text x={0} y={plotH + 50} textAnchor="start" fill={C.textDim} fontFamily={F.px} fontSize={9} letterSpacing={1}>
              {cat.higherBetter ? 'LOWER' : 'WORSE'}
            </text>
            <text x={plotW} y={plotH + 50} textAnchor="end" fill={cat.color} fontFamily={F.px} fontSize={9} letterSpacing={1}>
              {cat.higherBetter ? '★ BEST' : '★ BEST'}
            </text>

            {/* Connector + glow for #1 */}
            {positioned.filter(p => p._rank === 0).map(p => (
              <circle key={'glow-' + p.cn} cx={p._x} cy={p._y} r={radiusFor(0) + 14}
                fill={cat.color} opacity={mounted ? 0.16 : 0}
                style={{ transition: 'opacity .6s ease' }} />
            ))}

            {/* Points */}
            {positioned.map((p, i) => {
              const r = radiusFor(p._rank);
              const isHover = hovered === i;
              const isTop3 = p._rank < 3;
              return (
                // Outer <g> carries ONLY the entrance translate, animated via SVG's native
                // transform attribute (not CSS) so it's never touched by hover state changes.
                <g key={p.cn + (p.season || '')}
                  transform={`translate(${mounted ? p._x : p._x},${mounted ? p._y : plotH / 2})`}
                  style={{
                    opacity: mounted ? 1 : 0,
                    transition: `transform .6s cubic-bezier(.2,.8,.2,1) ${i * 0.02}s, opacity .5s ease ${i * 0.02}s`,
                  }}>
                  {/* Inner <g> carries ONLY the hover scale, pinned to local origin (0,0) —
                      this separation is what fixes the jitter: scaling never interacts with
                      the entrance position, and the origin never shifts based on rendered children. */}
                  <g
                    style={{
                      cursor: 'pointer',
                      transform: `scale(${isHover ? 1.18 : 1})`,
                      transformOrigin: '0px 0px',
                      transformBox: 'fill-box',
                      transition: 'transform .18s cubic-bezier(.2,.8,.2,1)',
                    }}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}>
                    {/* invisible oversized hit-area keeps the hover boundary stable regardless
                        of which visual elements (ring/crown/disc) are present for this rank */}
                    <circle r={r + 10} fill="transparent" />
                    {/* ring for podium */}
                    {isTop3 && (
                      <circle r={r + 4} fill="none" stroke={p._rank === 0 ? C.gold : p._rank === 1 ? '#d8d8e0' : '#cd7f32'} strokeWidth={2.5}
                        opacity={isHover ? 1 : 0.8} />
                    )}
                    {/* backing disc so logos with transparent bg still read clearly */}
                    <circle r={r} fill={C.bg} stroke={isHover ? cat.color : 'rgba(255,255,255,.15)'} strokeWidth={isHover ? 2.5 : 1.5} />
                    {cache[`/assets/teamLogos/${p.code}.png`]?.complete
                        ? <image href={`/assets/teamLogos/${p.code}.png`} x={-r * 0.78} y={-r * 0.78} width={r * 1.56} height={r * 1.56} style={{ pointerEvents: 'none' }} />
                        : <text x={0} y={4} textAnchor="middle" fontSize={r * 0.5} fill={cat.color} style={{ pointerEvents: 'none' }}>{(p.code || '?').slice(0,3)}</text>
                    }

                    {p._rank === 0 && (
                      <text x={0} y={-r - 12} textAnchor="middle" fontSize={18}>👑</text>
                    )}
                  </g>
                </g>
              );
            })}
          </g>
        </svg>

        {/* Tooltip */}
        {hovered != null && positioned[hovered] && (() => {
          const p = positioned[hovered];
          const left = MARGIN.left + p._x;
          const top = MARGIN.top + p._y;
          const flipLeft = left > dims.w - 220;
          return (
            <div style={{
              position: 'absolute',
              left: flipLeft ? left - 230 : left + 32,
              top: Math.max(8, top - 70),
              background: 'rgba(4,4,18,.99)', border: `1px solid ${cat.color}55`, borderRadius: 12,
              padding: '16px 20px', minWidth: 220, pointerEvents: 'none', zIndex: 20,
              boxShadow: `0 10px 40px rgba(0,0,0,.7), 0 0 24px ${cat.color}22`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <TeamLogo code={p.code} size={28} color={cat.color} />
                <div style={{ fontFamily: F.bc, fontSize: '1.15rem', color: C.textBright, fontWeight: 700 }}>{p.name}</div>
              </div>
              <div style={{ fontFamily: F.vt, fontSize: '2.2rem', color: cat.color, lineHeight: 1, textShadow: `0 0 14px ${cat.color}55` }}>
                {fmt(p[cat.key])}
              </div>
              <div style={{ fontFamily: F.px, fontSize: '.6rem', color: C.gold, marginTop: 10, letterSpacing: .5, lineHeight: 1.4 }}>
                {p._rank === 0 ? '👑 #1 ALL-TIME' : `RANK #${p._rank + 1}`}
              </div>
              <div style={{ fontFamily: F.bc, fontSize: '1rem', color: C.textMid, marginTop: 6, letterSpacing: .3 }}>
                {scope === 'SEASON' ? `${p.season} · ${p.gp} GP` : `${p.seasons} seasons · ${p.gp} GP`}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function DangerBarChart({ rows, cat, scope }) {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(null);

  useEffect(() => { setMounted(false); const t = setTimeout(() => setMounted(true), 30); return () => clearTimeout(t); }, [cat.key, scope]);

  const points = useMemo(() => {
    const withAtt = rows.filter(r => (r.dangerAtt || 0) > 0);
    return [...withAtt].sort((a, b) => b.dangerPct - a.dangerPct).slice(0, 15);
  }, [rows]);

  if (!points.length) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, color: C.textDim }}>
        <span style={{ fontSize: 48, opacity: .2 }}>📊</span>
        <span style={{ fontFamily: F.px, fontSize: '.5rem', letterSpacing: 2 }}>NO DATA AVAILABLE</span>
      </div>
    );
  }

  const maxPct = Math.max(...points.map(p => p.dangerPct), 1);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '32px 40px 24px', overflowY: 'auto' }}>
      <div style={{ marginBottom: 20, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 30 }}>{cat.icon}</span>
          <h1 style={{ fontFamily: F.px, fontSize: '1.5rem', color: cat.color, letterSpacing: 2, margin: 0, textShadow: `0 0 30px ${cat.color}44` }}>
            {cat.label.toUpperCase()}
          </h1>
          <span style={{ fontFamily: F.bc, fontSize: '1.3rem', color: C.textDim, letterSpacing: .5 }}>
            {scope === 'ALL-TIME' ? 'Career totals — entire history' : 'Best single-season performances — all-time'}
          </span>
        </div>
        <div style={{ fontFamily: F.px, fontSize: '.3rem', color: C.textDim, letterSpacing: 1.5, marginTop: 8 }}>
          TOP {points.length} · BREAKAWAYS + ONE-TIMERS + PENALTY SHOTS · MIN 10 GP
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {points.map((p, i) => {
          const pct = p.dangerPct;
          const barW = mounted ? (pct / maxPct) * 100 : 0;
          const isHover = hovered === i;
          return (
            <div key={p.cn + (p.season || '')}
              onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
              <div style={{ width: 28, fontFamily: F.px, fontSize: '.5rem', color: i < 3 ? C.gold : C.textDim, textAlign: 'right' }}>{i + 1}</div>
              <TeamLogo code={p.code} size={30} color={cat.color} />
              <div style={{ width: 150, fontFamily: F.bc, fontSize: '1rem', color: C.textBright, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.name}
              </div>
              <div style={{ flex: 1, position: 'relative', height: 26, background: 'rgba(255,255,255,.04)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${barW}%`, background: `linear-gradient(90deg, ${cat.color}88, ${cat.color})`,
                  borderRadius: 6, transition: `width .6s cubic-bezier(.2,.8,.2,1) ${i * 0.03}s`,
                  boxShadow: isHover ? `0 0 14px ${cat.color}88` : 'none',
                }} />
              </div>
              <div style={{ width: 64, fontFamily: F.vt, fontSize: '1.4rem', color: cat.color, textAlign: 'right' }}>
                {pct}%
              </div>
              <div style={{ width: 220, fontFamily: F.bc, fontSize: '.85rem', color: C.textDim, whiteSpace: 'nowrap' }}>
                BRK {p.brGoals}/{p.brAttempts} · 1X {p.xg}/{p.xaShots} · PS {p.psGoals}/{p.psAttempts}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAIN DASHBOARD ───────────────────────────────────────────────────────────
export default function Dashboard({ allGames, allSeasons, leagueGames, managers, mgrMeta, teamStatsRows, computedStandings, champData, allSeasonsData }) {
  const [scope, setScope] = useState('ALL-TIME');
  const [activeKey, setActiveKey] = useState('ptsPct');

  const allSeasonStats = useMemo(() => buildAllSeasonStats(leagueGames), [leagueGames]);
  const careerTotals = useMemo(() => buildCareerTotals(allSeasonStats).filter(d => d.gp >= 10), [allSeasonStats]);
  const seasonRecords = useMemo(() => buildSeasonRecords(allSeasonStats), [allSeasonStats]);
  const advStats = useMemo(() => buildAdvStats(teamStatsRows).filter(d => d.gp >= 10), [teamStatsRows]);
  const advSeasonRecords = useMemo(() => buildAdvSeasonRecords(teamStatsRows), [teamStatsRows]);

  const hasAdv = advStats.length > 0;

  const activeCat = useMemo(() => CATEGORIES.find(c => c.key === activeKey) || CATEGORIES[0], [activeKey]);

  // rows = the full pool of data points to rank & plot for the current scope+category.
  // ALL-TIME: one row per coach (career cumulative totals across their entire history).
  // SEASON: one row per coach-PER-SEASON (every season any team ever played is its own
  // data point), so the top 20 reflects the best single-season performances ever,
  // regardless of which season they happened in. No season picker needed.
  const rows = useMemo(() => {
    if (scope === 'ALL-TIME') {
      if (activeCat.adv) {
        const totalsMap = Object.fromEntries(careerTotals.map(d => [d.cn, d]));
        return advStats.map(d => ({ ...d, seasons: totalsMap[d.cn]?.seasons || 1 }));
      }
      return careerTotals;
    }
    // SEASON scope — every team-season is independent; no filtering by a single season.
    return activeCat.adv ? advSeasonRecords : seasonRecords;
  }, [scope, activeCat, careerTotals, advStats, seasonRecords, advSeasonRecords]);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: C.bg, overflow: 'hidden' }}>
      <Sidebar
        scope={scope} setScope={setScope}
        activeKey={activeKey} setActiveKey={setActiveKey}
        hasAdv={hasAdv}
      />
      <div style={{ flex: 1, height: '100vh', overflow: 'hidden', position: 'relative' }}>
        {/* ambient glow background */}
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 75% 15%, ${activeCat.color}10, transparent 55%)`, pointerEvents: 'none', transition: 'background 0.6s ease' }} />
        {activeCat.chartType === 'bar'
          ? <DangerBarChart rows={rows} cat={activeCat} scope={scope} />
          : <ScatterVisualization rows={rows} cat={activeCat} scope={scope} />}
      </div>

      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 7px; height: 7px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,.03); }
        ::-webkit-scrollbar-thumb { background: rgba(255,140,0,.3); border-radius: 4px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,140,0,.5); }
      `}</style>
    </div>
  );
}

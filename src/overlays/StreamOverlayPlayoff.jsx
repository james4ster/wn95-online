import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import CenteredAd from '../components/CenteredAd';
import { AD_DISPLAY_SECONDS, pickRandomAd } from '../utils/adUtils';

// ── Constants ──────────────────────────────────────────────────────────────
const POLL_INTERVAL = 10000; //30000;
//const AD_DISPLAY_SECONDS = 8; // how long ads stay visible

const ROUND_LABELS = {
  1: 'QUARTERFINALS',
  2: 'SEMIFINALS',
  3: 'CONFERENCE FINALS',
  4: 'BRULE CHAMPIONSHIP',
};

/* MOVED THESE TO adUtils.js
// Slot A = bottom-left, Slot B = bottom-right
// Drop your ad image paths here (or leave null to hide that slot)
const AD_IMAGES = [
  'bellnbell.jpg',
  'blubber.jpg',
  'cancast-rural.jpg',
  'cancast.jpg',
  'darkside.jpg',
  'houdinisliquor.jpg',
  'justbabes.jpg',
  'knightswear.jpg',
  'la-hanger.jpg',
  'liv95.jpg',
  'tanking.jpg',
  'vaginat-9_v1.png',
  'wolfncline.jpg',
];
*/

/*function pickRandomAd() {
  return AD_IMAGES[Math.floor(Math.random() * AD_IMAGES.length)];
}
*/
const norm  = s => (s || '').trim().toLowerCase();
const svPct = (saves, sa) => (sa > 0 ? (saves / sa).toFixed(3).replace('0.', '.') : '—');

// Format seconds to M:SS
function secToMMSS(totalSec) {
  if (!totalSec && totalSec !== 0) return '0:00';
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── ATK parsing ────────────────────────────────────────────────────────────
function parseTimeToSeconds(raw) {
  if (raw == null || raw === '') return 0;
  const str = String(raw).trim();
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
  }
  if (parts.length === 2) {
    if (parts[0] > 59) return parts[0];
    return parts[0] * 60 + (parts[1] || 0);
  }
  const n = parseInt(str, 10);
  return isNaN(n) ? 0 : n;
}

function timeStrToSec(t) {
  return parseTimeToSeconds(t);
}

// "J Hemsky" style
function fmtName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const initial = parts[0][0].toUpperCase();
  const last    = parts[parts.length - 1];
  return `${initial} ${last}`;
}

// ── Data helpers ───────────────────────────────────────────────────────────
function getSeriesScore(playoffGames, teamA, teamB) {
  let aW = 0, bW = 0;
  (playoffGames || []).forEach(g => {
    if (g.team_a_score == null || g.team_b_score == null) return;
    const aIsCodeA = g.team_code_a === teamA;
    const aScore = aIsCodeA ? g.team_a_score : g.team_b_score;
    const bScore = aIsCodeA ? g.team_b_score : g.team_a_score;
    if (aScore > bScore) aW++;
    else if (bScore > aScore) bW++;
  });
  return { aW, bW };
}

function buildCumulativeSkaterStatsFromRaw(rawScoring, teamCode) {
  const map = {};
  const ensure = name => {
    if (!name || !name.trim()) return null;
    const key = name.trim();
    if (!map[key]) map[key] = { name: key, g: 0, a: 0, pts: 0 };
    return key;
  };
  (rawScoring || [])
    .filter(r => r.g_team === teamCode)
    .forEach(r => {
      const scorer = ensure(r.goal_player_name);
      if (scorer) { map[scorer].g++; map[scorer].pts++; }
      const pa = ensure(r.assist_primary_name);
      if (pa) { map[pa].a++; map[pa].pts++; }
      const sa = ensure(r.assist_secondary_name);
      if (sa) { map[sa].a++; map[sa].pts++; }
    });
  return Object.values(map).sort((a, b) => b.pts - a.pts || b.g - a.g);
}

function buildTeamSeriesStats(teamStats, rawScoring, playoffGames, teamCode) {
  let gf = 0, ga = 0, sh = 0, sa = 0;
  let brG = 0, brA = 0;
  let oneG = 0, oneA = 0;
  let atkSec = 0, atkGames = 0;
  let ppg = 0, ppAmt = 0, shg = 0;
  let totalSaves = 0, totalSA = 0;

  (rawScoring || []).forEach(r => {
    if (!playoffGames.find(g => g.id === r.playoff_game_id)) return;
    if (r.g_team === teamCode) gf++;
    else ga++;
  });

  playoffGames.forEach(pg => {
    if (pg.team_a_score == null) return;
    const ts = (teamStats || []).find(t => t.playoff_game_id === pg.id);
    if (!ts) return;
    const isHome = ts.home === teamCode;

    const mySH = isHome ? (ts.home_shots || 0) : (ts.away_shots || 0);
    const mySA = isHome ? (ts.away_shots || 0) : (ts.home_shots || 0);
    sh += mySH;
    sa += mySA;

    const gameRaw = (rawScoring || []).filter(r => r.playoff_game_id === pg.id);
    const gameGA  = gameRaw.filter(r => r.g_team !== teamCode).length;
    totalSA    += mySA;
    totalSaves += Math.max(0, mySA - gameGA);

    brG += isHome ? (ts.home_break_goals    || 0) : (ts.away_break_goals    || 0);
    brA += isHome ? (ts.home_break_attempts || 0) : (ts.away_break_attempts || 0);

    oneG += isHome ? (ts.home_one_timer_goals    || ts.home_onetimer_goals    || 0)
                   : (ts.away_one_timer_goals    || ts.away_onetimer_goals    || 0);
    oneA += isHome ? (ts.home_one_timer_attempts || ts.home_onetimer_attempts || 0)
                   : (ts.away_one_timer_attempts || ts.away_onetimer_attempts || 0);

    const atkRaw = isHome ? ts.home_attack : ts.away_attack;
      if (atkRaw != null && atkRaw !== '') {
        const atkStr = String(atkRaw).trim();
        const parts  = atkStr.split(':').map(Number);
        let sec = 0;
        if (parts.length === 3) {
          // MM:SS:00 — minutes:seconds:frames
          sec = parts[0] * 60 + parts[1];
        } else if (parts.length === 2) {
          // Could be MM:SS or raw seconds:frames — treat as MM:SS
          sec = parts[0] * 60 + parts[1];
        } else {
          sec = parseInt(atkStr, 10) || 0;
        }
        // Only count games where ATK is a plausible value (> 30 seconds)
        // to avoid averaging in zeroed-out or corrupt rows
        if (sec > 30) { atkSec += sec; atkGames++; }
    }

    ppg    += isHome ? (ts.home_pp_g   || 0) : (ts.away_pp_g   || 0);
    ppAmt  += isHome ? (ts.home_pp_amt || 0) : (ts.away_pp_amt || 0);
    shg    += isHome ? (ts.home_shg    || ts.home_sh_goals || 0)
                     : (ts.away_shg    || ts.away_sh_goals || 0);
  });

  const gamesPlayed  = playoffGames.filter(g => g.team_a_score != null).length;
  const atkAvg       = atkGames > 0 ? secToMMSS(Math.round(atkSec / atkGames)) : '—';
  const brPct        = brA > 0 ? `${((brG / brA) * 100).toFixed(0)}%` : '—';
  const onePct       = oneA > 0 ? `${((oneG / oneA) * 100).toFixed(0)}%` : '—';
  const ppPct        = ppAmt > 0 ? `${((ppg / ppAmt) * 100).toFixed(0)}%` : '—';
  const seriesSvPct  = totalSA > 0 ? svPct(totalSaves, totalSA) : '—';

  return {
    gf, ga, sh, sa, gamesPlayed,
    brG, brA, brPct,
    oneG, oneA, onePct,
    atkAvg,
    ppg, ppAmt, ppPct,
    shg,
    seriesSvPct, totalSaves, totalSA,
  };
}

// ── Aggregate team stats from regular-season games ─────────────────────────
function buildH2HTeamStats(rsGames, rsTeamStats, coachA, coachB, teamA, teamB, filterLg) {
  let gf = 0, ga = 0, sh = 0, sa = 0;
  let brG = 0, brA = 0;
  let oneG = 0, oneA = 0;
  let atkSec = 0, atkGames = 0;
  let ppg = 0, ppAmt = 0, shg = 0;
  let totalSaves = 0, totalSA = 0;
  let gp = 0;

  (rsGames || []).forEach(g => {
    const h = norm(g.coach_home || ''), a = norm(g.coach_away || '');
    if (!((h === coachA && a === coachB) || (h === coachB && a === coachA))) return;
    if (filterLg && g.lg !== filterLg) return;
    if (g.score_home == null || g.score_away == null) return;
    gp++;

    const hIsA  = h === coachA;
    const myGF  = hIsA ? Number(g.score_home) : Number(g.score_away);
    const myGA  = hIsA ? Number(g.score_away) : Number(g.score_home);
    gf += myGF;
    ga += myGA;

    const ts = (rsTeamStats || []).find(t => t.game_id === g.id);
    if (!ts) return;

    const isHome = hIsA;
    const mySH   = isHome ? (ts.home_shots || 0) : (ts.away_shots || 0);
    const mySA   = isHome ? (ts.away_shots || 0) : (ts.home_shots || 0);
    sh += mySH;
    sa += mySA;

    totalSA    += mySA;
    totalSaves += Math.max(0, mySA - myGA);

    brG += isHome ? (ts.home_break_goals    || 0) : (ts.away_break_goals    || 0);
    brA += isHome ? (ts.home_break_attempts || 0) : (ts.away_break_attempts || 0);

    oneG += isHome ? (ts.home_one_timer_goals    || ts.home_onetimer_goals    || 0)
                   : (ts.away_one_timer_goals    || ts.away_onetimer_goals    || 0);
    oneA += isHome ? (ts.home_one_timer_attempts || ts.home_onetimer_attempts || 0)
                   : (ts.away_one_timer_attempts || ts.away_onetimer_attempts || 0);

    const atkRaw = isHome ? ts.home_attack : ts.away_attack;
    if (atkRaw != null && atkRaw !== '') {
      const parts = String(atkRaw).trim().split(':').map(Number);
      const sec   = parts.length === 2
        ? (parts[0] > 59 ? parts[0] : parts[0] * 60 + parts[1])
        : parseInt(atkRaw, 10) || 0;
      if (sec > 0) { atkSec += sec; atkGames++; }
    }

    ppg   += isHome ? (ts.home_pp_g   || 0) : (ts.away_pp_g   || 0);
    ppAmt += isHome ? (ts.home_pp_amt || 0) : (ts.away_pp_amt || 0);
    shg   += isHome ? (ts.home_shg    || ts.home_sh_goals || 0)
                    : (ts.away_shg    || ts.away_sh_goals || 0);
  });

  const atkAvg      = atkGames > 0 ? secToMMSS(Math.round(atkSec / atkGames)) : '—';
  const brPct       = brA > 0 ? `${((brG / brA) * 100).toFixed(0)}%` : '—';
  const onePct      = oneA > 0 ? `${((oneG / oneA) * 100).toFixed(0)}%` : '—';
  const ppPct       = ppAmt > 0 ? `${((ppg / ppAmt) * 100).toFixed(0)}%` : '—';
  const seriesSvPct = totalSA > 0 ? svPct(totalSaves, totalSA) : '—';

  return {
    gp, gf, ga, sh, sa,
    brG, brA, brPct,
    oneG, oneA, onePct,
    atkAvg,
    ppg, ppAmt, ppPct,
    shg,
    seriesSvPct, totalSaves, totalSA,
    gfpg: gp > 0 ? (gf / gp).toFixed(2) : '—',
    gapg: gp > 0 ? (ga / gp).toFixed(2) : '—',
  };
}

// ── Playoff scoring leaders builder ───────────────────────────────────────
// Aggregates pts/g/a/hits across ALL series in the round from game_raw_scoring
// and game_stats_skater. Returns top-N arrays for each category.
function buildScoringLeaders(allRoundRawScoring, allRoundSkaterStats, topN = 5) {
  if (!allRoundRawScoring && !allRoundSkaterStats) return { pts: [], goals: [], assists: [], hits: [] };
  // Points, Goals, Assists from raw scoring
  const ptMap  = {};
  const gMap   = {};
  const aMap   = {};

  (allRoundRawScoring || []).forEach(r => {
    const scorer = r.goal_player_name?.trim();
    const pa     = r.assist_primary_name?.trim();
    const sa     = r.assist_secondary_name?.trim();
    const team   = r.g_team || '';
    if (scorer) {
      if (!ptMap[scorer]) ptMap[scorer] = { name: scorer, val: 0, team };
      if (!gMap[scorer])  gMap[scorer]  = { name: scorer, val: 0, team };
      ptMap[scorer].val++;
      gMap[scorer].val++;
    }
    if (pa) {
      if (!ptMap[pa]) ptMap[pa] = { name: pa, val: 0, team };
      ptMap[pa].val++;
      if (!aMap[pa])  aMap[pa]  = { name: pa, val: 0, team };
      aMap[pa].val++;
    }
    if (sa) {
      if (!ptMap[sa]) ptMap[sa] = { name: sa, val: 0, team };
      ptMap[sa].val++;
      if (!aMap[sa])  aMap[sa]  = { name: sa, val: 0, team };
      aMap[sa].val++;
    }
  });

  console.log(
    'SKATER STATS ENTERING LEADERS',
    allRoundSkaterStats?.length,
    allRoundSkaterStats?.slice(0,5)
  );

  // Hits from game_stats_skater.chk
  const hMap = {};
  (allRoundSkaterStats || []).forEach(r => {
    const name = r.player_name?.trim();
    if (!name) return;
    const hits = Number(r.chk || r.checks || r.hits || 0);
    if (!hMap[name]) hMap[name] = { name, val: 0, team: r.team_code || '' };
    hMap[name].val += hits;
  });

  const rank = map => {
    const sorted = Object.values(map)
      .filter(x => x.val > 0)
      .sort((a, b) => b.val - a.val);
    sorted.forEach((entry, i) => {
      entry.rank = i === 0 ? 1 : entry.val === sorted[i - 1].val ? sorted[i - 1].rank : i + 1;
    });
    return sorted.slice(0, topN);
  };

  const hitsRanked = rank(hMap);

  return {
    pts:     rank(ptMap),
    goals:   rank(gMap),
    assists: rank(aMap),
    hits:    hitsRanked,
  };
}

// ── Build other-series items for the ticker ────────────────────────────────
// Takes all series in the current round (grouped by series_number), excludes
// the focused matchup, and returns one scroll item per series showing seeds,
// teams, and series score.
function buildOtherSeriesItems(allRoundGames, focusTeamA, focusTeamB) {
  if (!allRoundGames?.length) return [];

  const roundNums = [...new Set(allRoundGames.map(g => g.round).filter(Boolean))].sort((a,b) => a-b);
  const items = [];

  roundNums.forEach(roundNum => {
    const roundGames = allRoundGames.filter(g => g.round === roundNum);
    const bySeriesNum = {};
    roundGames.forEach(g => {
      const key = `${g.round}-${g.series_number ?? `${g.team_code_a}-${g.team_code_b}`}`;
      if (!bySeriesNum[key]) bySeriesNum[key] = [];
      bySeriesNum[key].push(g);
    });

    const seriesItems = [];
    Object.values(bySeriesNum).forEach(games => {
      const g0 = games[0];
      const tA = g0.team_code_a;
      const tB = g0.team_code_b;
      if (
        (tA === focusTeamA && tB === focusTeamB) ||
        (tA === focusTeamB && tB === focusTeamA)
      ) return;

      const seedA      = g0.seed_a;
      const seedB      = g0.seed_b;
      const winsNeeded = Math.ceil((g0.series_length || 7) / 2);
      let wA = 0, wB = 0;
      games.forEach(g => {
        if (g.team_a_score == null || g.team_b_score == null) return;
        if (g.team_a_score > g.team_b_score) wA++;
        else if (g.team_b_score > g.team_a_score) wB++;
      });
      const seriesOver = wA >= winsNeeded || wB >= winsNeeded;
      seriesItems.push({ type: 'other-series', tA, tB, seedA, seedB, wA, wB, winsNeeded, seriesOver });
    });

    if (seriesItems.length === 0) return;

    // R1 has 8 total matchups — show 4 per row (2 rows)
    // All other rounds fit on one row
    const chunkSize = roundNum === 1 ? 4 : seriesItems.length;
    for (let i = 0; i < seriesItems.length; i += chunkSize) {
      items.push({
        type: 'round-row',
        roundLabel: `R${roundNum}`,
        series: seriesItems.slice(i, i + chunkSize),
      });
    }
  });

  return items;
}

// ── Scroll item builder ────────────────────────────────────────────────────
// PRE-GAME-2 (fewer than 1 completed game):
//   SEASON H2H + ALL TIME H2H (unchanged)
//
// POST-GAME-1 (≥1 completed game):
//   1. PLAYOFF SERIES  — game scores (with pts/goals leaders), NO per-game team stats
//   2. OTHER SERIES    — other matchups in this round, seeds + series score
//   3. SCORING LEADERS — top 5 pts / goals / assists / hits across whole round
function buildScrollItems(
  playoffGames, rawScoring, teamStats,
  teamA, teamB,
  h2h,
  allRoundGames,
  allRoundRawScoring, allRoundSkaterStats
) {
  const completed = (playoffGames || []).filter(
    g => g.team_a_score != null && g.team_b_score != null
  );

  const isPostGame1 = completed.length >= 1;
  const items = [];

  // ══════════════════════════════════════════════════════════════════
  // PRE-GAME-2 MODE  (before any games are complete)
  // ══════════════════════════════════════════════════════════════════
  if (!isPostGame1) {
    // ── SEASON H2H ─────────────────────────────────────────────────
    if (h2h && h2h.seasonGP > 0) {
      items.push({ type: 'section-header', label: 'SEASON H2H' });
      items.push({
        type: 'h2h-record-with-scores',
        teamA, teamB,
        aW: h2h.seasonAW, bW: h2h.seasonBW, ties: h2h.seasonTies, gp: h2h.seasonGP,
        games: h2h.seasonGames || [],
      });
      if (h2h.seasonStatsA) {
        items.push({
          type: 'h2h-both-stats',
          teamA, teamB,
          statsA: h2h.seasonStatsA,
          statsB: h2h.seasonStatsB,
        });
      }
    }

    // ── ALL TIME H2H ───────────────────────────────────────────────
    if (h2h && h2h.allTimeGP > 0) {
      items.push({ type: 'section-header', label: 'ALL TIME H2H' });
      items.push({
        type: 'h2h-record',
        teamA, teamB,
        aW: h2h.allTimeAW, bW: h2h.allTimeBW, ties: h2h.allTimeTies, gp: h2h.allTimeGP,
      });
      if (h2h.allTimeStatsA) {
        items.push({
          type: 'h2h-both-stats',
          teamA, teamB,
          statsA: h2h.allTimeStatsA,
          statsB: h2h.allTimeStatsB,
        });
      }
    }

    // Always show scoring leaders and other series if any data exists (even pre-game-1)
     // Show all playoff series regardless of game count
     const otherSeriesEarly = buildOtherSeriesItems(allRoundGames, null, null);
     if (otherSeriesEarly.length > 0) {
       items.push({ type: 'section-header', label: 'PLAYOFF UPDATE' });
       otherSeriesEarly.forEach(s => items.push(s));
     }
    const leadersEarly = buildScoringLeaders(allRoundRawScoring, allRoundSkaterStats, 5);
    const hasAnyEarly = leadersEarly &&
      ((leadersEarly.pts?.length > 0) || (leadersEarly.goals?.length > 0) ||
       (leadersEarly.assists?.length > 0) || (leadersEarly.hits?.length > 0));
    if (hasAnyEarly) {
      items.push({ type: 'section-header', label: 'PLAYOFF LEADERS' });
      if (leadersEarly.pts.length > 0)     items.push({ type: 'leaders', category: 'PTS',  entries: leadersEarly.pts,     accent: 'blue',    teamA, teamB });
      if (leadersEarly.goals.length > 0)   items.push({ type: 'leaders', category: 'G',    entries: leadersEarly.goals,   accent: 'blue',    teamA, teamB });
      if (leadersEarly.assists.length > 0) items.push({ type: 'leaders', category: 'A',    entries: leadersEarly.assists, accent: 'blue', teamA, teamB });
      if (leadersEarly.hits.length > 0)    items.push({ type: 'leaders', category: 'HITS', entries: leadersEarly.hits,    accent: 'red',     teamA, teamB });
    }
    console.log('PRE-GAME-1 ITEMS', items.map(i => i.type + (i.label ? ':'+i.label : '') + (i.category ? ':'+i.category : '')));

    return items;
  }

  // ══════════════════════════════════════════════════════════════════
  // POST-GAME-1 MODE
  // ══════════════════════════════════════════════════════════════════

  // ── SECTION 1: PLAYOFF SERIES — scores only (no per-game team stats) ─
  items.push({ type: 'section-header', label: 'CURRENT SERIES' });
  items.push({ type: 'scores-sub-header' });

  completed.forEach(g => {
    const gid      = g.id;
    const gameRaw  = (rawScoring || []).filter(r => r.playoff_game_id === gid);
    const aIsCodeA = g.team_code_a === teamA;
    const aScore   = aIsCodeA ? g.team_a_score : g.team_b_score;
    const bScore   = aIsCodeA ? g.team_b_score : g.team_a_score;
    const winner   = aScore > bScore ? teamA : teamB;

    const scorerMap = {};
    gameRaw.forEach(r => {
      if (!r.goal_player_name) return;
      scorerMap[r.goal_player_name] = (scorerMap[r.goal_player_name] || 0) + 1;
    });
    const sortedScorers = Object.entries(scorerMap).sort((a, b) => b[1] - a[1]);
    const topGoals  = sortedScorers[0]?.[1] || 0;
    const gLeaders  = topGoals > 0
      ? sortedScorers.filter(([, cnt]) => cnt === topGoals)
          .map(([name, cnt]) => `${fmtName(name)}${cnt > 1 ? ` (${cnt})` : ''}`)
          .join(', ')
      : '—';

    const ptMap = {};
    gameRaw.forEach(r => {
      [r.goal_player_name, r.assist_primary_name, r.assist_secondary_name].forEach(n => {
        if (n?.trim()) ptMap[n.trim()] = (ptMap[n.trim()] || 0) + 1;
      });
    });
    const sortedPts  = Object.entries(ptMap).sort((a, b) => b[1] - a[1]);
    const topPts     = sortedPts[0]?.[1] || 0;
    const ptsLeaders = topPts > 0
      ? sortedPts.filter(([, c]) => c === topPts)
          .map(([name, c]) => `${fmtName(name)} ${c}`).join(', ')
      : '—';

    items.push({
      type: 'game-score',
      gameNum: g.game_number, aScore, bScore, teamA, teamB, winner,
      ptsLeaders, gLeaders,
    });
  });

  // ── SECTION 2: OTHER SERIES ───────────────────────────────────────────
  const otherSeriesItems = buildOtherSeriesItems(allRoundGames, null, null);
  if (otherSeriesItems.length > 0) {
    items.push({ type: 'section-header', label: 'PLAYOFF UPDATE' });
    otherSeriesItems.forEach(s => items.push(s));
  }

  // ── SECTION 3: SCORING LEADERS ────────────────────────────────────────
  const leaders = buildScoringLeaders(allRoundRawScoring, allRoundSkaterStats, 5);

  console.log('LEADERS DEBUG', {
    pts: leaders.pts?.length,
    goals: leaders.goals?.length,
    assists: leaders.assists?.length,
    hits: leaders.hits?.length,
    hitsData: leaders.hits
  });

  const hasAny = leaders &&
    ((leaders.pts?.length > 0) || (leaders.goals?.length > 0) ||
     (leaders.assists?.length > 0) || (leaders.hits?.length > 0));

  if (hasAny) {
    items.push({ type: 'section-header', label: 'PLAYOFF LEADERS' });

    if (leaders.pts.length > 0)     items.push({ type: 'leaders', category: 'PTS',  entries: leaders.pts,     accent: 'blue',     teamA, teamB });
    if (leaders.goals.length > 0)   items.push({ type: 'leaders', category: 'G',    entries: leaders.goals,   accent: 'blue',     teamA, teamB });
    if (leaders.assists.length > 0) items.push({ type: 'leaders', category: 'A',    entries: leaders.assists, accent: 'blue',     teamA, teamB });
    if (leaders.hits.length > 0)    items.push({ type: 'leaders', category: 'HITS', entries: leaders.hits,    accent: 'blue',     teamA, teamB });
  }

  return items;
}

// ── Auto-scale hook ────────────────────────────────────────────────────────
function useOverlayScale(baseW = 1280, baseH = 720) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const calc = () => setScale(Math.min(window.innerWidth / baseW, window.innerHeight / baseH));
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [baseW, baseH]);
  return scale;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function StreamOverlayPlayoff() {
  const [showPanel, setShowPanel] = useState(false);
  const [allTeams,  setAllTeams]  = useState([]);
  const [currentLg, setCurrentLg] = useState(null);
  const [pendingA,  setPendingA]  = useState('');
  const [pendingB,  setPendingB]  = useState('');
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  // Ad states
  const [adVisible, setAdVisible]   = useState(false);
  const [adImage, setAdImage] = useState(null);
  const [adGameNum, setAdGameNum] = useState(null);
  const adTimerRef = useRef(null);
  const lastGameCountRef = useRef(null); // tracks completed game count across polls

  const pollRef = useRef(null);
  const scale   = useOverlayScale();

  const getParams = () => {
    const p = new URLSearchParams(window.location.search);
    return {
      teamA:  p.get('teamA')  || '',
      teamB:  p.get('teamB')  || '',
      lg:     p.get('lg')     || '',
      round:  p.get('round')  ? parseInt(p.get('round'))  : null,
      series: p.get('series') ? parseInt(p.get('series')) : null,
    };
  };

  // Trigger ad display for AD_DISPLAY_SECONDS
  const triggerAd = useCallback((playoffGames) => {
    clearTimeout(adTimerRef.current);
  
    const completed = playoffGames.filter(g =>
      g.team_a_score != null && g.team_b_score != null
    );
  
    const seriesLength = playoffGames?.[0]?.series_length || 7;
  
    const nextGameNum = Math.min(completed.length + 1, seriesLength);
  
  // Handle Ads //
    const img = pickRandomAd();
    setAdGameNum(nextGameNum);     // 🔒 LOCK IT HERE
    setAdImage(img);
    setAdVisible(true);
  
    adTimerRef.current = setTimeout(() => {
      setAdVisible(false);
      setAdGameNum(null);          // optional cleanup
    }, AD_DISPLAY_SECONDS * 1000);
  }, []);

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
      const params = getParams();
      if (params.teamA && params.teamB) {
        setPendingA(params.teamA);
        setPendingB(params.teamB);
        loadMatchup(params.teamA, params.teamB, params.lg || lg, params.round, params.series);
      } else if (teams?.length >= 2) {
        setPendingA(teams[0].abr);
        setPendingB(teams[1].abr);
        setShowPanel(true);
      }
    }
    bootstrap();
  }, []);

  useEffect(() => {
    const h = e => { if (e.key === '`' || e.key === '~') setShowPanel(p => !p); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // Helpers to display personalized banner colors on side panels
  function hexToRgb(hex) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return `${r}, ${g}, ${b}`;
  }
  
  function getLuminance(hex) {
    const r = parseInt(hex.slice(1,3), 16) / 255;
    const g = parseInt(hex.slice(3,5), 16) / 255;
    const b = parseInt(hex.slice(5,7), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const loadMatchup = useCallback(async (tA, tB, lg, round, series, isPoll = false) => {
    if (!tA || !tB || !lg || tA === tB) return;
    setLoading(true);

    // ── Focused series games ────────────────────────────────────────────
    const { data: allPgRows, error: pgErr } = await supabase
      .from('playoff_games').select('*')
      .ilike('lg', 'W%').eq('lg', lg).order('game_number');
    if (pgErr) console.error('playoff_games error:', pgErr);

    let playoffGames = (allPgRows || []).filter(g =>
      (g.team_code_a === tA && g.team_code_b === tB) ||
      (g.team_code_a === tB && g.team_code_b === tA)
    );
    if (round  != null) playoffGames = playoffGames.filter(g => g.round         === round);
    if (series != null) playoffGames = playoffGames.filter(g => g.series_number === series);
    if (playoffGames.length > 0 && round == null) {
      const maxRound = Math.max(...playoffGames.map(g => g.round));
      playoffGames = playoffGames.filter(g => g.round === maxRound);
    }

    const game1         = playoffGames.find(g => g.game_number === 1) || playoffGames[0];
    const seedA         = game1?.team_code_a === tA ? game1?.seed_a : game1?.seed_b;
    const seedB         = game1?.team_code_a === tA ? game1?.seed_b : game1?.seed_a;
    const pgIds         = playoffGames.map(g => g.id).filter(Boolean);
    const completed     = playoffGames.filter(g => g.team_a_score != null);
    const derivedRound  = playoffGames[0]?.round         || 1;
    const derivedSeries = playoffGames[0]?.series_number || 1;
    const seriesLength  = playoffGames[0]?.series_length || 7;
    const winsNeeded    = Math.ceil(seriesLength / 2);

    // ── Detect new completed game (for ad trigger on polls) ─────────────
    const newGameCount = completed.length;
    if (isPoll && lastGameCountRef.current !== null && newGameCount > lastGameCountRef.current) {
      triggerAd(playoffGames);
    }
    lastGameCountRef.current = newGameCount;

    // ── Scoring data for focused series ────────────────────────────────
    let rawScoring = [], teamStats = [];
    if (pgIds.length > 0) {
      const [{ data: rs, error: rsErr }, { data: ts }] = await Promise.all([
        supabase.from('game_raw_scoring').select('*').in('playoff_game_id', pgIds),
        supabase.from('game_stats_team').select('*').in('playoff_game_id', pgIds),
      ]);
      if (rsErr) console.error('raw_scoring error:', rsErr);
      rawScoring = rs || [];
      teamStats  = ts || [];
    }

    // ── ALL games in this round (for other-series + scoring leaders) ────
    const allRoundGames = (allPgRows || []).filter(g => g.lg === lg);    
    const allRoundPgIds = allRoundGames.map(g => g.id).filter(Boolean);

    let allRoundRawScoring = [];
    let allRoundSkaterStats = [];
    const completedRoundIds = allRoundGames
      .filter(g => g.team_a_score != null)
      .map(g => g.id)
      .filter(Boolean);

    if (completedRoundIds.length > 0) {
      const [{ data: ars }, { data: ask }] = await Promise.all([
        supabase.from('game_raw_scoring').select('*').in('playoff_game_id', completedRoundIds),
        supabase.from('game_stats_skaters').select('player_name,team_code,chk,playoff_game_id')
          .in('playoff_game_id', completedRoundIds),
      ]);
      allRoundRawScoring  = ars || [];
      allRoundSkaterStats = ask || [];
    }

    // ── H2H data ────────────────────────────────────────────────────────
    const { data: teamRows } = await supabase.from('teams').select('abr,coach,color_primary,color_secondary').eq('lg', lg);
    const coachA = norm((teamRows || []).find(t => t.abr === tA)?.coach || tA);
    const coachB = norm((teamRows || []).find(t => t.abr === tB)?.coach || tB);

    const { data: allRsGames } = await supabase
      .from('games')
      .select('id,lg,score_home,score_away,ot,coach_home,coach_away')
      .ilike('lg', 'W%')
      .ilike('mode', 'season')
      .not('score_home', 'is', null);

    const h2hGames = (allRsGames || []).filter(g => {
      const h = norm(g.coach_home || ''), a = norm(g.coach_away || '');
      return (h === coachA && a === coachB) || (h === coachB && a === coachA);
    });

    const h2hGameIds = h2hGames.map(g => g.id).filter(Boolean);
    let rsTeamStats = [];
    if (h2hGameIds.length > 0) {
      const { data: rts } = await supabase
        .from('game_stats_team')
        .select('*')
        .in('game_id', h2hGameIds);
      rsTeamStats = rts || [];
    }

    // ── All-time record ─────────────────────────────────────────────────
    let atAW = 0, atBW = 0, atTies = 0;
    h2hGames.forEach(g => {
      const h = norm(g.coach_home || ''), a = norm(g.coach_away || '');
      const sh = Number(g.score_home ?? 0), sa = Number(g.score_away ?? 0);
      const hIsA = h === coachA;
      const gfA = hIsA ? sh : sa, gaA = hIsA ? sa : sh;
      if (sh === sa) atTies++;
      else if (gfA > gaA) atAW++;
      else atBW++;
    });
    const allTimeGP = atAW + atBW + atTies;

    // ── Season record + per-game scores ────────────────────────────────
    const seasonGames = h2hGames.filter(g => g.lg === lg);
    let sAW = 0, sBW = 0, sTies = 0;
    const seasonGameScores = [];
    seasonGames.forEach(g => {
      const h = norm(g.coach_home || ''), a = norm(g.coach_away || '');
      const sh = Number(g.score_home ?? 0), sa = Number(g.score_away ?? 0);
      const hIsA = h === coachA;
      const aScore = hIsA ? sh : sa;
      const bScore = hIsA ? sa : sh;
      let winner = null;
      if (sh === sa) sTies++;
      else if (aScore > bScore) { sAW++; winner = tA; }
      else { sBW++; winner = tB; }
      seasonGameScores.push({ aScore, bScore, winner, ot: g.ot });
    });
    const seasonGP = sAW + sBW + sTies;

    const seasonStatsA  = buildH2HTeamStats(h2hGames, rsTeamStats, coachA, coachB, tA, tB, lg);
    const seasonStatsB  = buildH2HTeamStats(h2hGames, rsTeamStats, coachB, coachA, tB, tA, lg);
    const allTimeStatsA = buildH2HTeamStats(h2hGames, rsTeamStats, coachA, coachB, tA, tB, null);
    const allTimeStatsB = buildH2HTeamStats(h2hGames, rsTeamStats, coachB, coachA, tB, tA, null);

    const h2h = {
      seasonGP, seasonAW: sAW, seasonBW: sBW, seasonTies: sTies,
      seasonGames: seasonGameScores,
      seasonStatsA, seasonStatsB,
      allTimeGP, allTimeAW: atAW, allTimeBW: atBW, allTimeTies: atTies,
      allTimeStatsA, allTimeStatsB,
    };


    const { aW, bW } = getSeriesScore(playoffGames, tA, tB);
    const leftTeam  = (seedA != null && seedB != null && seedA > seedB) ? tA : tB;
    const rightTeam = leftTeam === tA ? tB : tA;
    const leftWins  = leftTeam === tA ? aW : bW;
    const rightWins = rightTeam === tA ? aW : bW;
    const leftSeed  = leftTeam === tA ? seedA : seedB;
    const rightSeed = rightTeam === tA ? seedA : seedB;

    const teamRowA = (teamRows || []).find(t => t.abr === tA);
    const teamRowB = (teamRows || []).find(t => t.abr === tB);
    const colorA = teamRowA?.color_primary || '#1a1a2e';
    const colorB = teamRowB?.color_primary || '#1a1a2e';
    const leftColor  = leftTeam === tA ? colorA : colorB;
    const rightColor = leftTeam === tA ? colorB : colorA;

    setData({
      teamA: tA, teamB: tB, 
      leftTeam, rightTeam, leftWins, rightWins, leftSeed, rightSeed,
      winsNeeded, seriesLength, totalGames: completed.length,
      nextGameNum: Math.min(completed.length + 1, seriesLength),
      roundLabel: ROUND_LABELS[derivedRound] || `ROUND ${derivedRound}`,
      roundNum: derivedRound, seriesNum: derivedSeries,
      skaterStatsA: buildCumulativeSkaterStatsFromRaw(rawScoring, tA),
      skaterStatsB: buildCumulativeSkaterStatsFromRaw(rawScoring, tB),
      teamSeriesStatsA: buildTeamSeriesStats(teamStats, rawScoring, playoffGames, tA),
      teamSeriesStatsB: buildTeamSeriesStats(teamStats, rawScoring, playoffGames, tB),
      scrollItems: buildScrollItems(
        playoffGames, rawScoring, teamStats,
        tA, tB,
        h2h,
        allRoundGames,
        allRoundRawScoring, allRoundSkaterStats
      ),
      leftColor,rightColor,lg, season: lg,
    });
    setLoading(false);
  }, [triggerAd]);

  const handleApply = useCallback(() => {
    if (!pendingA || !pendingB || pendingA === pendingB) return;
    const p = new URLSearchParams({ lg: currentLg, teamA: pendingA, teamB: pendingB });
    window.history.replaceState(null, '', `?${p.toString()}`);
    setShowPanel(false);
    lastGameCountRef.current = null; // reset so first load doesn't falsely trigger ad
    loadMatchup(pendingA, pendingB, currentLg, null, null, false);
  }, [pendingA, pendingB, currentLg, loadMatchup]);

  useEffect(() => {
    if (!data) return;
    pollRef.current = setInterval(() => {
      const params = getParams();
      loadMatchup(
        params.teamA || data.teamA, params.teamB || data.teamB,
        params.lg || data.lg,
        params.round  != null ? params.round  : data.roundNum,
        params.series != null ? params.series : data.seriesNum,
        true, // isPoll = true — enables ad trigger
      );
    }, POLL_INTERVAL);
    return () => clearInterval(pollRef.current);
  }, [data, loadMatchup]);

  return (
    <div className="po-root" style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
      {showPanel && (
        <SetupPanel allTeams={allTeams}
          pendingA={pendingA} setPendingA={setPendingA}
          pendingB={pendingB} setPendingB={setPendingB}
          onApply={handleApply} />
      )}
      {!data && !loading && <EmptyState />}
      {loading && !data && <LoadingState />}
      {data && <PlayoffLayout data={data} loading={loading} />}
      {/* Center ads — only render when adVisible and slots are configured */}
      <CenteredAd visible={adVisible} gameNum={adGameNum} adImage={adImage} />
      <Styles />
    </div>
  );
}


// ── Playoff Layout ─────────────────────────────────────────────────────────
function PlayoffLayout({ data, loading }) {
  const {
    leftTeam, rightTeam, leftWins, rightWins, leftSeed, rightSeed,
    roundLabel, nextGameNum, winsNeeded,
    skaterStatsA, skaterStatsB,
    teamSeriesStatsA, teamSeriesStatsB,
    teamA, teamB, scrollItems, season,
  } = data;


  const stableScrollItems = React.useMemo(
    () => scrollItems,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(scrollItems)]
  );

  const leftIsA      = leftTeam === teamA;
  const leftSkaters  = leftIsA ? skaterStatsA : skaterStatsB;
  const rightSkaters = leftIsA ? skaterStatsB : skaterStatsA;
  const leftStats    = leftIsA ? teamSeriesStatsA : teamSeriesStatsB;
  const rightStats   = leftIsA ? teamSeriesStatsB : teamSeriesStatsA;

  const seriesStatus = () => {
    if (leftWins  === winsNeeded) return `${leftTeam} WINS SERIES`;
    if (rightWins === winsNeeded) return `${rightTeam} WINS SERIES`;
    if (leftWins  === rightWins)  return `SERIES TIED ${leftWins}-${rightWins}`;
    const leader = leftWins > rightWins ? leftTeam : rightTeam;
    const lw = Math.max(leftWins, rightWins), tw = Math.min(leftWins, rightWins);
    return `${leader} LEADS ${lw}-${tw}`;
  };

  return (
    <>
      {/* Top Bar */}
      <div className="po-topbar">
        <div className="po-topbar-left">
          <span className="po-round-label">{roundLabel}</span>
        </div>
        <div className="po-topbar-center">
          <img src="/assets/leagueLogos/mainLogo-512.png" className="po-league-logo" alt="WN95HL"
            onError={e => { e.target.style.display='none'; }} />
        </div>
        <div className="po-topbar-right">
          <span className="po-game-label">GAME {nextGameNum}</span>
          <span className="po-sep-dot">·</span>
          <span className="po-series-status">{seriesStatus()}</span>
          {loading && <span className="po-live-dot" />}
        </div>
      </div>

      {/* Series Hero Bar */}
      <SeriesHero
        leftTeam={leftTeam} rightTeam={rightTeam}
        leftWins={leftWins} rightWins={rightWins}
        leftSeed={leftSeed} rightSeed={rightSeed}
        winsNeeded={winsNeeded}
      />

      {/* Side Panels */}
      <div className="po-side-left">
        <SidePanel team={leftTeam} skaters={leftSkaters} teamStats={leftStats}
          teamColor={data.leftColor} />
      </div>
      <div className="po-side-right">
        <SidePanel team={rightTeam} skaters={rightSkaters} teamStats={rightStats}
          teamColor={data.rightColor} />
      </div>

      {/* Bottom Scroller */}
      <BottomScroller items={stableScrollItems} />
    </>
  );
}

// ── Series Hero Bar ────────────────────────────────────────────────────────
function SeriesHero({ leftTeam, rightTeam, leftWins, rightWins, leftSeed, rightSeed, winsNeeded }) {
  return (
    <div className="po-series-bar">
      <div className="po-hero-half left">
        <span className="po-hero-wins">{leftWins}</span>
        <SeriesDots wins={leftWins} winsNeeded={winsNeeded} side="left" />
        <img src={`/assets/teamLogos/${leftTeam}.png`} className="po-hero-logo" alt={leftTeam}
          onError={e => e.target.style.display='none'} />
        <div className="po-hero-seed">{leftSeed != null ? `#${leftSeed}` : ''}</div>
      </div>
      <div className="po-hero-divider">
        <div className="po-hero-divider-line" />
      </div>
      <div className="po-hero-half right">
        <div className="po-hero-seed">{rightSeed != null ? `#${rightSeed}` : ''}</div>
        <img src={`/assets/teamLogos/${rightTeam}.png`} className="po-hero-logo" alt={rightTeam}
          onError={e => e.target.style.display='none'} />
        <SeriesDots wins={rightWins} winsNeeded={winsNeeded} side="right" />
        <span className="po-hero-wins">{rightWins}</span>
      </div>
    </div>
  );
}

// ── Series Dots ────────────────────────────────────────────────────────────
function SeriesDots({ wins, winsNeeded, side }) {
  return (
    <div className={`po-dots po-dots-${side}`}>
      {Array.from({ length: winsNeeded }, (_, i) => (
        <div key={i} className={`po-dot ${i < wins ? 'filled' : 'empty'} ${side}`} />
      ))}
    </div>
  );
}

// ── Side Panel ─────────────────────────────────────────────────────────────
const SKATER_ROWS     = 8;
const SKATER_ROW_H    = 28;
const SKATER_HEAD_H   = 22;
const SKATER_FIXED_H  = SKATER_HEAD_H + SKATER_ROWS * SKATER_ROW_H;

function SidePanel({ team, skaters, teamStats, teamColor }) {
  const gp = teamStats?.gamesPlayed || 0;
  return (
    <div className="po-side-panel">
      <div className="po-side-header" style={teamColor ? {
        background: `linear-gradient(90deg, color-mix(in srgb, ${teamColor} 50%, black) 0%, transparent 100%)`
      } : {}}>
        <img src={`/assets/teamLogos/${team}.png`} className="po-side-logo" alt={team}
          onError={e => e.target.style.display='none'} />
        <span className="po-side-code">{team}</span>
      </div>

      <div style={{ minHeight: `${SKATER_FIXED_H}px` }}>
        {skaters.length === 0 ? (
          <div className="po-no-data">SERIES UPCOMING</div>
        ) : (
          <>
            <div className="po-section-label">SKATERS</div>
            <table className="po-table">
              <thead>
                <tr>
                  <th className="po-th al">PLAYER</th>
                  <th className="po-th">G</th>
                  <th className="po-th">A</th>
                  <th className="po-th">PTS</th>
                </tr>
              </thead>
              <tbody>
                {skaters.slice(0, SKATER_ROWS).map((p, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'po-tr-even' : ''}>
                    <td className="po-td al">{fmtName(p.name)}</td>
                    <td className="po-td g">{p.g}</td>
                    <td className="po-td a">{p.a}</td>
                    <td className="po-td pts">{p.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {gp > 0 && teamStats && (
        <>
          <div className="po-side-divider" />
          <div className="po-section-label">SERIES STATS</div>
          <div className="po-stats-grid">
            <StatRow label="GF"  value={teamStats.gf}  sub={`${(teamStats.gf/gp).toFixed(1)}/gm`}  accent="gold" />
            <StatRow label="GA"  value={teamStats.ga}  sub={`${(teamStats.ga/gp).toFixed(1)}/gm`}  accent="red" />
            <StatRow label="SV%" value={teamStats.seriesSvPct}
              sub={teamStats.totalSA > 0 ? `${teamStats.totalSaves}/${teamStats.totalSA}` : null}
              accent="green" />
            <StatRow label="SH"  value={teamStats.sh}  sub={`${(teamStats.sh/gp).toFixed(1)}/gm`} />
            <StatRow label="SA"  value={teamStats.sa}  sub={`${(teamStats.sa/gp).toFixed(1)}/gm`} />
            <StatRow label="BRK" value={`${teamStats.brG}/${teamStats.brA}`} sub={teamStats.brPct} />
            {teamStats.oneA > 0 && (
              <>
                <StatRow label="1xG" value={teamStats.oneG} accent="blue" />
                <StatRow label="1xA" value={teamStats.oneA} />
                <StatRow label="1x%" value={teamStats.onePct} accent="blue" />
              </>
            )}
            <StatRow label="ATK" value={teamStats.atkAvg} sub="avg/gm" />
            <StatRow label="PPG" value={`${teamStats.ppg}/${teamStats.ppAmt}`} sub={teamStats.ppPct} accent="blue" />
            {teamStats.shg > 0 && (
              <StatRow label="SHG" value={teamStats.shg} accent="green" />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function StatRow({ label, value, sub, accent }) {
  const valClass = `po-stat-val${accent ? ` accent-${accent}` : ''}`;
  return (
    <div className="po-stat-row">
      <span className="po-stat-label">{label}</span>
      <span className={valClass}>{value ?? '—'}</span>
      {sub && <span className="po-stat-sub">{sub}</span>}
    </div>
  );
}

// ── Bottom Scroller ────────────────────────────────────────────────────────
// -- Scroll Speed
const ROW_HOLD_MS = 6400;
const SLIDE_MS    = 520;

function flattenToRows(items) {
  const rows = [];
  let currentSection = '';
  let currentRound   = null;

  console.log('FLATTEN INPUT', items?.length, '→ types:', items?.map(i => i.type));


  items.forEach(item => {
    switch (item.type) {
      case 'section-header':
        currentSection = item.label;
        currentRound   = null;
        break;
      case 'scores-sub-header':
        break;
        case 'round-row':
          // round label comes from item.roundLabel, passed through to _round
          rows.push({ ...item, _section: currentSection, _round: item.roundLabel });
          break;
      default:
        rows.push({ ...item, _section: currentSection, _round: currentRound });
        break;
    }
  });

  console.log('FLATTEN OUTPUT', rows.length, '→', rows.map(r => r.type + ':' + r._section));

  return rows;
}

function renderScrollRow(row) {
  if (!row) return null;

  switch (row.type) {

    case 'game-score':
      return (
        <span className="vsc-row">
          <span className="vsc-pill">GM{row.gameNum}</span>
          <span className={`vsc-team${row.winner === row.teamA ? ' win' : ''}`}>{row.teamA}</span>
          <span className="vsc-score">{row.aScore} – {row.bScore}</span>
          <span className={`vsc-team${row.winner === row.teamB ? ' win' : ''}`}>{row.teamB}</span>
          <span className="vsc-bullet">·</span>
          <span className="vsc-stat">PTS <span className="vsc-val">{row.ptsLeaders}</span></span>
          <span className="vsc-bullet">·</span>
          <span className="vsc-stat">G <span className="vsc-val">{row.gLeaders}</span></span>
        </span>
      );

    case 'other-series': {
      const { tA, tB, seedA, seedB, wA, wB, winsNeeded, seriesOver } = row;
      const leftIsA  = seedA != null && seedB != null ? seedA <= seedB : true;
      const lt = leftIsA ? tA : tB;
      const rt = leftIsA ? tB : tA;
      const ls = leftIsA ? seedA : seedB;
      const rs = leftIsA ? seedB : seedA;
      const lw = leftIsA ? wA : wB;
      const rw = leftIsA ? wB : wA;
      const leader    = lw > rw ? lt : rw > lw ? rt : null;
      const leaderW   = Math.max(lw, rw);
      const trailerW  = Math.min(lw, rw);
      const statusStr = seriesOver
        ? `${lw > rw ? lt : rt} wins`
        : lw === rw
          ? `tied ${lw}-${rw}`
          : `${leader} leads ${leaderW}-${trailerW}`;
      return (
        <span className="vsc-row">
          <span className="vsc-seed">{ls != null ? `(${ls})` : ''}</span>
          <span className={`vsc-team${lw >= winsNeeded ? ' win' : ''}`}>{lt}</span>
          <span className="vsc-series-score">{lw}</span>
          <span className="vsc-series-dash">–</span>
          <span className="vsc-series-score">{rw}</span>
          <span className={`vsc-team${rw >= winsNeeded ? ' win' : ''}`}>{rt}</span>
          <span className="vsc-seed">{rs != null ? `(${rs})` : ''}</span>
          <span className="vsc-bullet">·</span>
          <span className="vsc-muted">{statusStr}</span>
        </span>
      );
    }

    case 'leaders': {
      const accentClass = row.accent !== 'default' ? ` accent-${row.accent}` : '';
      const focusTeams  = new Set([row.teamA, row.teamB].filter(Boolean));
      return (
        <span className="vsc-row">
          <span className="vsc-pill">{row.category}</span>
          {row.entries.map((e, i) => {
            const isFocus = focusTeams.size > 0 && focusTeams.has(e.team);
            return (
              <React.Fragment key={i}>
                <span className="vsc-leader-rank">{e.rank}.</span>
                <span className={`vsc-leader-name${accentClass}${isFocus ? ' focus' : ''}`}>
                  {fmtName(e.name)}
                </span>
                {e.team && (
                  <span className={`vsc-leader-team${isFocus ? ' focus' : ''}`}>
                    {e.team}
                  </span>
                )}
                <span className={`vsc-leader-val${accentClass}${isFocus ? ' focus' : ''}`}>
                  {e.val}
                </span>
                {i < row.entries.length - 1 && <span className="vsc-leader-sep">|</span>}
              </React.Fragment>
            );
          })}
        </span>
      );
    }

    case 'h2h-record':
      return (
        <span className="vsc-row">
          <span className="vsc-pill">RECORD</span>
          <span className="vsc-team">{row.teamA}</span>
          <span className="vsc-score">{row.aW}W</span>
          <span className="vsc-muted">–</span>
          <span className="vsc-score">{row.bW}W</span>
          {row.ties > 0 && <span className="vsc-muted">{row.ties}T</span>}
          <span className="vsc-team">{row.teamB}</span>
          <span className="vsc-bullet">·</span>
          <span className="vsc-muted">{row.gp} GP</span>
        </span>
      );

    case 'h2h-record-with-scores':
      return (
        <span className="vsc-row">
          <span className="vsc-pill">H2H</span>
          <span className="vsc-team">{row.teamA}</span>
          <span className="vsc-score">{row.aW}W</span>
          <span className="vsc-muted">–</span>
          <span className="vsc-score">{row.bW}W</span>
          {row.ties > 0 && <span className="vsc-muted">{row.ties}T</span>}
          <span className="vsc-team">{row.teamB}</span>
          {row.games.length > 0 && <span className="vsc-round-sep">│</span>}
          {row.games.map((g, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="vsc-bullet">·</span>}
              <span className="vsc-pill">G{i + 1}</span>
              <span className={`vsc-team${g.winner === row.teamA ? ' win' : ''}`}>{row.teamA}</span>
              <span className="vsc-score">{g.aScore}–{g.bScore}</span>
              <span className={`vsc-team${g.winner === row.teamB ? ' win' : ''}`}>{row.teamB}</span>
              {g.ot ? <span className="vsc-muted vsc-ot">OT</span> : null}
            </React.Fragment>
          ))}
        </span>
      );

    case 'h2h-both-stats': {
      const renderTeamStats = (team, s) => {
        if (!s) return null;
        return (
          <>
            <span className="vsc-pill">{team}</span>
            <span className="vsc-stat">GF/G <span className="vsc-val accent-gold">{s.gfpg}</span></span>
            <span className="vsc-bullet">·</span>
            <span className="vsc-stat">GA/G <span className="vsc-val accent-red">{s.gapg}</span></span>
            <span className="vsc-bullet">·</span>
            <span className="vsc-stat">SV% <span className="vsc-val accent-green">{s.seriesSvPct}</span></span>
            {s.brA > 0 && (<><span className="vsc-bullet">·</span><span className="vsc-stat">BRK <span className="vsc-val">{s.brPct}</span></span></>)}
            {s.ppAmt > 0 && (<><span className="vsc-bullet">·</span><span className="vsc-stat">PP <span className="vsc-val accent-blue">{s.ppPct}</span></span></>)}
         {/* COMMENTING OUT TEMPORARITLY AS CALCULATION IS OFF?
           {s.atkAvg !== '—' && (<><span className="vsc-bullet">·</span><span className="vsc-stat">ATK <span className="vsc-val">{s.atkAvg}</span></span></>)} */ }
          </>
        );
      };
      return (
        <span className="vsc-row">
          {renderTeamStats(row.teamA, row.statsA)}
          {row.statsB && <><span className="vsc-round-sep">│</span>{renderTeamStats(row.teamB, row.statsB)}</>}
        </span>
      );
    }

    case 'h2h-game-score':
      return (
        <span className="vsc-row">
          <span className="vsc-pill">G{row.idx}</span>
          <span className={`vsc-team${row.winner === row.teamA ? ' win' : ''}`}>{row.teamA}</span>
          <span className="vsc-score">{row.aScore} – {row.bScore}</span>
          <span className={`vsc-team${row.winner === row.teamB ? ' win' : ''}`}>{row.teamB}</span>
          {g.ot ? <span className="vsc-muted vsc-ot">OT</span> : null}
        </span>
      );

    case 'round-row': {
      return (
        <span className="vsc-row">
          {row.series.map((s, si) => {
            const { tA, tB, seedA, seedB, wA, wB, winsNeeded, seriesOver } = s;
            const leftIsA  = seedA != null && seedB != null ? seedA <= seedB : true;
            const lt = leftIsA ? tA : tB;
            const rt = leftIsA ? tB : tA;
            const ls = leftIsA ? seedA : seedB;
            const rs = leftIsA ? seedB : seedA;
            const lw = leftIsA ? wA : wB;
            const rw = leftIsA ? wB : wA;
            const notStarted = wA === 0 && wB === 0 && !seriesOver;
            return (
              <React.Fragment key={si}>
                {si > 0 && <span className="vsc-round-sep">│</span>}
                <span className="vsc-seed">{ls != null ? `(${ls})` : ''}</span>
                <span className={`vsc-team${lw >= winsNeeded ? ' win' : ''}`}>{lt}</span>
                {notStarted
                  ? <span className="vsc-muted">vs</span>
                  : <><span className="vsc-series-score">{lw}</span>
                    <span className="vsc-series-dash">–</span>
                    <span className="vsc-series-score">{rw}</span></>
                }
                <span className={`vsc-team${rw >= winsNeeded ? ' win' : ''}`}>{rt}</span>
                <span className="vsc-seed">{rs != null ? `(${rs})` : ''}</span>
              </React.Fragment>
            );
          })}
        </span>
      );
    }

    default:
      return null;
  }
}

function BugLabel({ section, round }) {
  return (
    <div className="vsc-bug">
      <span className="vsc-bug-chevron">▶</span>
      <span className="vsc-bug-label">{section}</span>
      {round && <span className="vsc-bug-round">{round}</span>}
    </div>
  );
}

function BottomScroller({ items }) {
  const rows = React.useMemo(() => flattenToRows(items || []), [items]);
  const [bugLabel, setBugLabel] = useState({ section: '', round: null });
  const [cells, setCells] = useState({ top: null, bottom: null });

  const columnRef     = useRef(null);
  const idxRef        = useRef(0);
  const timerRef      = useRef(null);
  const rowsRef       = useRef(rows);
  const runLoopRef    = useRef(null);  // ← ADD THIS

  useEffect(() => { rowsRef.current = rows; }, [rows]);

  // Define runLoop as a ref so it always calls the latest version of itself
  runLoopRef.current = () => {
    const rows = rowsRef.current;
    if (!rows.length) return;

    const idx     = idxRef.current;
    const nextIdx = idx === rows.length - 1 ? 0 : idx + 1;

    const row = rows[idx];
    setBugLabel({ section: row._section || '', round: row._round || null });
    setCells({ top: rows[idx], bottom: rows[nextIdx] });

    if (columnRef.current) {
      columnRef.current.style.transition = 'none';
      columnRef.current.style.transform  = 'translateY(0)';
    }

    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const incomingRow = rows[nextIdx];
      setBugLabel({ section: incomingRow._section || '', round: incomingRow._round || null });

      if (columnRef.current) {
        columnRef.current.style.transition = `transform ${SLIDE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        columnRef.current.style.transform  = 'translateY(-50%)';
      }

      timerRef.current = setTimeout(() => {
        idxRef.current = nextIdx;
        runLoopRef.current();  // ← always calls the latest version
      }, SLIDE_MS);
    }, ROW_HOLD_MS);
  };

  useEffect(() => {
    if (!rows.length) return;
    idxRef.current = 0;
    clearTimeout(timerRef.current);
    runLoopRef.current();
    return () => clearTimeout(timerRef.current);
  }, [rows]);

  if (!rows.length) return null;

  return (
    <div className="po-scroller">
      <BugLabel section={bugLabel.section} round={bugLabel.round} />
      <div className="vsc-stage">
        <div className="vsc-column" ref={columnRef}>
          <div className="vsc-cell">{renderScrollRow(cells.top)}</div>
          <div className="vsc-cell">{renderScrollRow(cells.bottom)}</div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ label }) { return null; }
function SubHeader({ label })     { return null; }

// ── Setup Panel ────────────────────────────────────────────────────────────
function SetupPanel({ allTeams, pendingA, setPendingA, pendingB, setPendingB, onApply }) {
  return (
    <div className="sp-panel">
      <div className="sp-title">⚡ PLAYOFF OVERLAY SETUP</div>
      <div className="sp-note">Press ~ to close</div>
      <div className="sp-row">
        <label className="sp-label">TEAM A</label>
        <CustomSelect value={pendingA} onChange={setPendingA}
          options={allTeams.map(t => ({ value: t.abr, label: `${t.abr}${t.team ? ` — ${t.team}` : ''}` }))}
          placeholder="-- SELECT --" />
      </div>
      <div className="sp-row">
        <label className="sp-label">TEAM B</label>
        <CustomSelect value={pendingB} onChange={setPendingB}
          options={allTeams.map(t => ({ value: t.abr, label: `${t.abr}${t.team ? ` — ${t.team}` : ''}` }))}
          placeholder="-- SELECT --" />
      </div>
      {pendingA && pendingB && pendingA === pendingB && (
        <div className="sp-error">Teams must be different</div>
      )}
      <button className="sp-apply" onClick={onApply}
        disabled={!pendingA || !pendingB || pendingA === pendingB}>APPLY</button>
    </div>
  );
}

function CustomSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const selected = options.find(o => o.value === value);
  return (
    <div className="csel" ref={ref}>
      <div className={`csel-trigger${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
        <span className={selected ? '' : 'csel-ph'}>{selected ? selected.label : placeholder}</span>
        <span className="csel-arr">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="csel-list">
          {options.map(o => (
            <div key={o.value} className={`csel-opt${o.value === value ? ' sel' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false); }}>{o.label}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="po-empty">
      <div className="po-scanlines" />
      <div className="po-empty-inner">
        <img src="/assets/leagueLogos/mainLogo-512.png" className="po-empty-logo" alt="WN95HL"
          onError={e => e.target.style.display='none'} />
        <div className="po-empty-title">PLAYOFF OVERLAY</div>
        <div className="po-empty-sub">Press <span className="key">~</span> to configure</div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="po-empty">
      <div className="po-scanlines" />
      <div className="po-loading">LOADING...</div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
function Styles() {
  return <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323:wght@400&family=Barlow+Condensed:wght@400;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .po-root {
      width: 1280px; height: 720px;
      position: relative; overflow: hidden;
      background: transparent;
      font-family: 'Barlow Condensed', sans-serif;
    }
    .po-scanlines {
      position: absolute; inset: 0; z-index: 10; pointer-events: none;
      background: repeating-linear-gradient(0deg,
        transparent 0px, transparent 3px,
        rgba(0,0,0,.04) 3px, rgba(0,0,0,.04) 4px);
    }

    /* ── TOP BAR ── */
    .po-topbar {
      position: absolute; top: 0; left: 0; right: 0; height: 44px;
      background: linear-gradient(90deg,
        rgba(3,1,12,.97) 0%, rgba(8,4,24,.97) 40%,
        rgba(8,4,24,.97) 60%, rgba(3,1,12,.97) 100%);
      border-bottom: 2px solid rgba(255,215,0,.35);
      display: flex; align-items: center; padding: 0 14px;
      box-shadow: 0 2px 20px rgba(0,0,0,.6);
      position: relative;
    }
    .po-topbar-left {
      flex: 1;
      display: flex;
      align-items: center;
      padding-left: 4px;
    }
    .po-topbar-center {
      position: absolute;
      left: 0; right: 0;
      display: flex; align-items: center; justify-content: center;
      height: 100%;
      pointer-events: none;
    }
    .po-topbar-right {
      flex: 1; display: flex; align-items: center;
      justify-content: flex-end; gap: 10px; padding-right: 4px;
    }
    .po-league-logo {
      height: 38px; width: auto; object-fit: contain;
      filter: drop-shadow(0 0 8px rgba(255,215,0,.5));
    }
    .po-empty-logo {
      height: 80px; width: auto; object-fit: contain;
      filter: drop-shadow(0 0 18px rgba(255,215,0,.35));
      margin-bottom: .5rem;
    }
    .po-round-label {
      font-family: 'Press Start 2P', monospace; font-size: .68rem;
      color: #FF8C00; letter-spacing: 2px;
      text-shadow: 0 0 8px rgba(255,140,0,.5);
    }
    .po-sep-dot {
      font-family: 'VT323', monospace; font-size: 1.4rem;
      color: rgba(255,255,255,.2);
    }
    .po-game-label {
      font-family: 'Barlow Condensed', sans-serif; font-weight: 700;
      font-size: 1.05rem; letter-spacing: 3px;
      color: rgba(255,255,255,.65);
    }
    .po-series-status {
      font-family: 'Barlow Condensed', sans-serif; font-weight: 800;
      font-size: 1.1rem; letter-spacing: 2px;
      color: #87CEEB; text-shadow: 0 0 10px rgba(135,206,235,.4);
    }
    .po-live-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #4cff91; box-shadow: 0 0 7px #4cff91;
      animation: livepulse 1.2s ease-in-out infinite;
    }
    @keyframes livepulse { 0%,100%{opacity:1} 50%{opacity:.3} }

    /* ── SERIES HERO BAR ── */
    .po-series-bar {
      position: absolute; top: 44px; left: 210px; right: 210px; height: 96px;
      background: linear-gradient(180deg, rgba(4,2,16,.97), rgba(6,3,20,.94));
      border-bottom: 2px solid rgba(255,215,0,.18);
      display: flex; align-items: stretch;
      box-shadow: 0 4px 24px rgba(0,0,0,.5);
    }
    .po-hero-half {
      flex: 1;
      display: flex;
      align-items: center;
      padding: 0 16px;
    }
    .po-hero-half.left  { flex-direction: row; justify-content: space-between; }
    .po-hero-half.right { flex-direction: row-reverse; justify-content: space-between; }
    .po-hero-divider {
      width: 2px; flex-shrink: 0;
      display: flex; align-items: stretch;
    }
    .po-hero-divider-line {
      width: 2px; flex: 1;
      background: linear-gradient(
        180deg,
        transparent 0%,
        rgba(255,215,0,.15) 15%,
        rgba(255,215,0,.55) 40%,
        rgba(255,255,255,.8) 50%,
        rgba(255,215,0,.55) 60%,
        rgba(255,215,0,.15) 85%,
        transparent 100%
      );
      box-shadow: 0 0 10px rgba(255,215,0,.45), 0 0 22px rgba(255,215,0,.15);
    }
    .po-hero-seed {
      font-family: 'Press Start 2P', monospace; font-size: 1rem;
      color: #FFD700; letter-spacing: 1px;
      background: rgba(255,215,0,.08);
      border: 1px solid rgba(255,215,0,.35);
      border-radius: 4px; padding: .22rem .5rem;
      line-height: 1; white-space: nowrap;
      text-shadow: 0 0 10px rgba(255,215,0,.6);
      flex-shrink: 0; min-width: 3rem; text-align: center;
    }
    .po-hero-logo {
      width: 74px; height: 74px; object-fit: contain;
      filter: drop-shadow(0 0 12px rgba(255,215,0,.25));
      flex-shrink: 0;
    }
    .po-hero-wins {
      font-family: 'Barlow Condensed', sans-serif; font-weight: 800;
      font-size: 5.6rem; line-height: 1; color: #FFD700;
      text-shadow: 0 0 28px rgba(255,215,0,.45), 0 2px 8px rgba(0,0,0,.9);
      flex-shrink: 0; min-width: 3.4rem; text-align: center;
    }
    .po-dots {
      display: flex; align-items: center; gap: 7px; flex-shrink: 0;
    }
    .po-dot {
      width: 13px; height: 13px; border-radius: 50%;
      transition: all .3s ease;
    }
    .po-dot.filled.left {
      background: radial-gradient(circle, #87CEEB, #4a9fc4);
      box-shadow: 0 0 9px rgba(135,206,235,.8), 0 0 18px rgba(135,206,235,.3);
    }
    .po-dot.filled.right {
      background: radial-gradient(circle, #FF8C00, #cc6600);
      box-shadow: 0 0 9px rgba(255,140,0,.8), 0 0 18px rgba(255,140,0,.3);
    }
    .po-dot.empty { background: transparent; border: 2px solid rgba(255,255,255,.18); }

    /* ── SIDE PANELS ── */
    .po-side-left, .po-side-right {
      position: absolute; top: 44px; bottom: 36px; width: 208px;
      background: linear-gradient(170deg, rgba(3,1,12,.96), rgba(6,3,18,.96));
      border: 1px solid rgba(255,215,0,.22);
      overflow-y: auto; overflow-x: hidden;
    }
    .po-side-left  { left: 0;  border-left: none; border-radius: 0 0 6px 0; }
    .po-side-right { right: 0; border-right: none; border-radius: 0 0 0 6px; }
    .po-side-left::-webkit-scrollbar,
    .po-side-right::-webkit-scrollbar { width: 0; }

    .po-side-panel { display: flex; flex-direction: column; }

    .po-side-header {
      display: flex; align-items: center; gap: 8px;
      padding: .45rem .55rem;
      background: linear-gradient(90deg, rgba(255,140,0,.18), transparent);
      border-bottom: 1px solid rgba(255,215,0,.18);
      position: sticky; top: 0; z-index: 2;
    }
    .po-side-logo {
      width: 28px; height: 28px; object-fit: contain;
      filter: drop-shadow(0 0 4px rgba(255,215,0,.28));
    }
    .po-side-code {
      font-family: 'Press Start 2P', monospace; font-size: .86rem;
      color: #FFF; letter-spacing: 1px;
    }
    .po-section-label {
      font-family: 'Press Start 2P', monospace; font-size: .48rem;
      color: #FF8C00; letter-spacing: 2px;
      padding: .3rem .55rem .16rem;
      background: rgba(255,140,0,.06);
      border-bottom: 1px solid rgba(255,140,0,.14);
      border-top: 1px solid rgba(255,255,255,.03);
    }
    .po-table { width: 100%; border-collapse: collapse; }
    .po-th {
      font-family: 'Press Start 2P', monospace; font-size: .40rem;
      color: rgba(255,255,255,.45); padding: .14rem .32rem;
      text-align: center;
      background: rgba(0,0,0,.2);
      border-bottom: 1px solid rgba(255,215,0,.06);
    }
    .po-th.al { text-align: left; }
    .po-tr-even { background: rgba(255,255,255,.017); }
    .po-td {
      font-family: 'VT323', monospace; font-size: 1.28rem;
      color: #C8D8E8; padding: .08rem .32rem;
      text-align: center; line-height: 1.25;
    }
    .po-td.al  { text-align: left; color: #EEF2F8; }
    .po-td.pts { color: #FFD700; font-size: 1.35rem; font-weight: 700; }
    .po-td.g   { color: #9DDDFF; }
    .po-td.a   { color: #8AACCC; }
    .po-no-data {
      font-family: 'Press Start 2P', monospace; font-size: .42rem;
      color: rgba(255,255,255,.13); text-align: center; padding: 2rem .5rem;
    }

    /* ── STATS SECTION ── */
    .po-side-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,215,0,.3), transparent);
      margin: .4rem .55rem;
    }
    .po-stats-grid {
      display: flex; flex-direction: column; gap: 0;
      padding: .1rem 0 .5rem;
    }
    .po-stat-row {
      display: grid;
      grid-template-columns: 2.6rem 1fr auto;
      align-items: center;
      padding: .22rem .55rem;
      border-bottom: 1px solid rgba(255,255,255,.04);
      gap: .3rem;
    }
    .po-stat-row:nth-child(even) { background: rgba(255,255,255,.017); }
    .po-stat-label {
      font-family: 'Press Start 2P', monospace; font-size: .40rem;
      color: rgba(255,255,255,.5); letter-spacing: 1px; text-align: left;
    }
    .po-stat-val {
      font-family: 'VT323', monospace; font-size: 1.42rem;
      color: #FFFFFF; text-align: left; line-height: 1;
    }
    .po-stat-val.accent-gold  { color: #FFD700; text-shadow: 0 0 8px rgba(255,215,0,.4); }
    .po-stat-val.accent-red   { color: #ff6e6e; }
    .po-stat-val.accent-blue  { color: #87CEEB; text-shadow: 0 0 8px rgba(135,206,235,.4); }
    .po-stat-val.accent-green { color: #4cff91; text-shadow: 0 0 8px rgba(76,255,145,.4); }
    .po-stat-sub {
      font-family: 'Barlow Condensed', sans-serif; font-size: .78rem;
      color: rgba(255,255,255,.38); text-align: right; white-space: nowrap;
    }

    /* ── BOTTOM SCROLLER (vertical rolling) ── */
    .po-scroller {
      position: absolute; bottom: 0; left: 0; right: 0; height: 36px;
      background: linear-gradient(90deg,
        rgba(2,1,8,.99) 0%, rgba(6,3,18,.99) 15%,
        rgba(6,3,18,.99) 85%, rgba(2,1,8,.99) 100%);
      border-top: 2px solid rgba(255,215,0,.28);
      display: flex; align-items: stretch;
      overflow: hidden;
    }
    .vsc-bug {
      flex-shrink: 0;
      display: flex; align-items: center; gap: 6px;
      padding: 0 10px;
      background: rgba(255,215,0,.08);
      border-right: 2px solid rgba(255,215,0,.28);
      white-space: nowrap;
    }
    .vsc-bug-chevron {
      font-family: 'Press Start 2P', monospace; font-size: .46rem;
      color: rgba(255,215,0,.5);
    }
    .vsc-bug-label {
      font-family: 'Press Start 2P', monospace; font-size: .56rem;
      color: #FFD700; letter-spacing: 2px;
      text-shadow: 0 0 8px rgba(255,215,0,.45);
    }
    .vsc-bug-round {
      font-family: 'Press Start 2P', monospace; font-size: .44rem;
      color: #FF8C00;
      background: rgba(255,140,0,.16);
      border: 1px solid rgba(255,140,0,.3);
      border-radius: 2px; padding: .08rem .28rem;
      letter-spacing: 1px; line-height: 1;
    }
    .vsc-stage {
      flex: 1; overflow: hidden; position: relative;
    }
    .vsc-column {
      display: flex; flex-direction: column;
      height: 72px;
      will-change: transform;
      contain: strict;
    }
    .vsc-cell {
      height: 36px; flex-shrink: 0;
      display: flex; align-items: center;
      padding: 0 16px;
      overflow: hidden;
    }
    .vsc-row {
      display: inline-flex; align-items: center; gap: 7px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1rem; font-weight: 600; letter-spacing: .4px;
      white-space: nowrap;
    }
    .vsc-pill {
      font-family: 'Press Start 2P', monospace; font-size: .54rem;
      color: #FF8C00; letter-spacing: 1px;
      background: rgba(255,140,0,.14);
      border: 1px solid rgba(255,140,0,.3);
      border-radius: 2px; padding: .1rem .3rem;
    }
    .vsc-team {
      font-family: 'Barlow Condensed', sans-serif; font-weight: 800;
      font-size: 1.05rem; color: rgba(255,255,255,.65);
      letter-spacing: 1px; text-transform: uppercase;
    }
    .vsc-team.win { color: #FFD700; text-shadow: 0 0 7px rgba(255,215,0,.4); }
    .vsc-score {
      font-family: 'Barlow Condensed', sans-serif; font-weight: 800;
      font-size: 1.25rem; color: #E8F0F8;
    }
    .vsc-series-score {
      font-family: 'Barlow Condensed', sans-serif; font-weight: 800;
      font-size: 1.4rem; color: #FFD700;
      text-shadow: 0 0 6px rgba(255,215,0,.3);
      min-width: 1.1rem; text-align: center;
    }
    .vsc-series-dash {
      font-family: 'Barlow Condensed', sans-serif; font-weight: 600;
      font-size: 1rem; color: rgba(255,255,255,.3);
    }
    .vsc-seed {
      font-family: 'Press Start 2P', monospace;
      font-size: .62rem;
      color: rgba(255, 215, 0, 0.95);
    }
    .vsc-bullet { color: rgba(255,215,0,.28); font-size: .85rem; }
    .vsc-stat   { color: rgba(255,255,255,.42); font-size: 1.25rem; font-weight: 600; }
    .vsc-val    { color: #87CEEB; font-weight: 700; font-size: 1.25rem}
    .vsc-val.accent-gold  { color: #FFD700; }
    .vsc-val.accent-red   { color: #ff8a8a; }
    .vsc-val.accent-green { color: #4cff91; }
    .vsc-val.accent-blue  { color: #87CEEB; }
    .vsc-muted  { color: rgba(255,255,255,.28); font-size: .9rem; }
    .vsc-ot     { font-family: 'Press Start 2P', monospace; font-size: .44rem; color: rgba(255,140,0,.6); }
    .vsc-leader-rank {
      font-family: 'Press Start 2P', monospace; font-size: .44rem;
      color: rgba(255,255,255,.3);
    }
    .vsc-leader-name {
      font-family: 'Barlow Condensed', sans-serif; font-weight: 700;
      font-size: 1.05rem; color: #E8F0F8; letter-spacing: .3px;
    }
    .vsc-leader-name.accent-gold { color: #FFD700; }
    .vsc-leader-name.accent-blue { color: #87CEEB; }
    .vsc-leader-name.accent-red  { color: #ff9090; }
    .vsc-leader-team {
      font-family: 'Press Start 2P', monospace; font-size: .42rem;
      color: rgba(255,140,0,.55); letter-spacing: .5px;
    }
    .vsc-leader-val {
      font-family: 'VT323', monospace; font-size: 1.3rem;
      color: rgba(255,255,255,.7);
    }
    .vsc-leader-val.accent-gold { color: #FFD700; }
    .vsc-leader-val.accent-blue { color: #87CEEB; }
    .vsc-leader-val.accent-red  { color: #ff9090; }
    .vsc-leader-sep {
      color: rgba(255,255,255,.15); font-size: .85rem; margin: 0 2px;
    }
    .vsc-leader-name.focus {
      color: #ffffff;
      text-shadow: 0 0 8px rgba(255,255,255,.5);
    }
    .vsc-leader-team.focus {
      color: #FFD700;
      text-shadow: 0 0 6px rgba(255,215,0,.5);
    }
    .vsc-leader-val.focus {
      color: #FFD700;
      text-shadow: 0 0 8px rgba(255,215,0,.4);
    }
    .vsc-round-sep {
      color: rgba(255,215,0,.2); font-size: 1rem; margin: 0 6px;
    }

    /* ── CENTERED AD ── */
      .po-center-ad {
        position: absolute;
        left: 210px; right: 210px;
        top: 44px; bottom: 36px;
        z-index: 50;
        display: flex; align-items: center; justify-content: center;
        pointer-events: none;
        opacity: 0;
        transform: scale(0.92);
        transition: opacity 0.45s ease, transform 0.45s ease;
      }
      .po-center-ad.visible {
        opacity: 1;
        transform: scale(1);
      }
      .po-center-ad-inner {
        background: linear-gradient(160deg, rgba(4,2,20,.97), rgba(10,6,30,.97));
        border: 2px solid rgba(255,215,0,.55);
        border-radius: 10px;
        padding: 1.4rem 2rem;
        display: flex; flex-direction: column; align-items: center; gap: 1rem;
        box-shadow: 0 0 60px rgba(255,140,0,.2), 0 0 120px rgba(0,0,0,.8);
        width: 100%; max-width: 680px;
      }
      .po-center-ad-title {
        font-family: 'Press Start 2P', monospace; font-size: .78rem;
        color: #FFD700; letter-spacing: 3px;
        text-shadow: 0 0 12px rgba(255,215,0,.5);
        text-align: center;
      }
      .po-center-ad-presented {
        color: rgba(255,255,255,.45);
        font-size: .62rem;
        letter-spacing: 2px;
        margin-left: 8px;
      }
      .po-center-ad-img {
        max-width: 520px; max-height: 260px;
        width: auto; height: auto;
        object-fit: contain;
        border-radius: 6px;
        border: 1px solid rgba(255,215,0,.18);
        filter: drop-shadow(0 0 16px rgba(255,215,0,.15));
      }
      .po-center-ad-footer {
        font-family: 'Barlow Condensed', sans-serif; font-weight: 600;
        font-size: .95rem; color: rgba(255,255,255,.35);
        letter-spacing: 1px; text-align: center;
      }
      .po-center-ad-brand {
        color: #FF8C00;
        font-weight: 800;
      }
      .po-center-ad-div {
        color: rgba(255,255,255,.25);
      }

    /* ── EMPTY / LOADING ── */
    .po-empty {
      position: absolute; inset: 0;
      background: linear-gradient(170deg, rgba(4,2,14,.97), rgba(8,6,22,.97));
      display: flex; align-items: center; justify-content: center;
    }
    .po-empty-inner {
      text-align: center; display: flex; flex-direction: column;
      align-items: center; gap: .8rem;
    }
    .po-empty-title {
      font-family: 'Press Start 2P', monospace; font-size: 1.2rem;
      color: rgba(255,215,0,.4); letter-spacing: 2px;
    }
    .po-empty-sub {
      font-family: 'VT323', monospace; font-size: 1.4rem;
      color: rgba(255,255,255,.25);
    }
    .key {
      font-family: 'Press Start 2P', monospace; font-size: 1.6rem; color: #FF8C00;
    }
    .po-loading {
      font-family: 'Press Start 2P', monospace; font-size: 1rem;
      color: #FFD700; animation: bpulse 1s ease-in-out infinite;
    }
    @keyframes bpulse {
      0%,100% { filter: drop-shadow(0 0 4px #FF8C00); opacity: 1; }
      50%      { filter: drop-shadow(0 0 12px #FFD700); opacity: .6; }
    }

    /* ── SETUP PANEL ── */
    .sp-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
      z-index: 999;
      background: linear-gradient(160deg, rgba(4,2,20,.98), rgba(10,6,30,.98));
      border: 1px solid rgba(255,215,0,.5); border-radius: 10px;
      padding: 1.4rem 1.6rem; width: 320px;
      box-shadow: 0 0 40px rgba(255,140,0,.22), 0 0 80px rgba(0,0,0,.8);
    }
    .sp-title {
      font-family: 'Press Start 2P', monospace; font-size: .92rem;
      color: #FFD700; letter-spacing: 2px; margin-bottom: .25rem;
    }
    .sp-note {
      font-family: 'Press Start 2P', monospace; font-size: .5rem;
      color: rgba(255,255,255,.2); margin-bottom: 1.1rem;
    }
    .sp-row  { display: flex; flex-direction: column; gap: .35rem; margin-bottom: .9rem; }
    .sp-label { font-family: 'Press Start 2P', monospace; font-size: .56rem; color: #FF8C00; }
    .sp-error {
      font-family: 'Press Start 2P', monospace; font-size: .5rem;
      color: #ff4444; margin-bottom: .5rem;
    }
    .sp-apply {
      font-family: 'Press Start 2P', monospace; font-size: .72rem;
      letter-spacing: 2px; color: #000;
      background: linear-gradient(135deg, #FFD700, #FF8C00);
      border: none; border-radius: 4px;
      padding: .55rem 1rem; width: 100%;
      cursor: pointer; transition: opacity .15s;
    }
    .sp-apply:hover:not(:disabled) { opacity: .85; }
    .sp-apply:disabled { opacity: .3; cursor: not-allowed; }

    .csel { position: relative; width: 100%; user-select: none; }
    .csel-trigger {
      font-family: 'VT323', monospace; font-size: 1.25rem;
      background: rgba(0,0,0,.6); color: #E0E0E0;
      border: 1px solid rgba(255,215,0,.3); border-radius: 4px;
      padding: .28rem .55rem; width: 100%; cursor: pointer;
      display: flex; align-items: center; justify-content: space-between; gap: .4rem;
    }
    .csel-trigger:hover { border-color: rgba(255,215,0,.6); }
    .csel-trigger.open  { border-color: rgba(255,215,0,.8); border-bottom-left-radius:0; border-bottom-right-radius:0; }
    .csel-arr { font-size: .85rem; color: rgba(255,215,0,.6); flex-shrink:0; }
    .csel-ph  { color: rgba(255,255,255,.3); }
    .csel-list {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 1000;
      background: rgba(8,4,24,.98);
      border: 1px solid rgba(255,215,0,.5); border-top: none;
      border-bottom-left-radius: 4px; border-bottom-right-radius: 4px;
      max-height: 200px; overflow-y: auto;
      box-shadow: 0 8px 24px rgba(0,0,0,.8);
    }
    .csel-opt {
      font-family: 'VT323', monospace; font-size: 1.15rem;
      color: #D0D8E0; padding: .22rem .55rem; cursor: pointer;
      border-bottom: 1px solid rgba(255,255,255,.04);
    }
    .csel-opt:hover { background: rgba(255,215,0,.11); color: #FFD700; }
    .csel-opt.sel   { background: rgba(255,140,0,.17); color: #FF8C00; }
  `}</style>;
}

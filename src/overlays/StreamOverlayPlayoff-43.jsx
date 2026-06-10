import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';

// ── Constants ──────────────────────────────────────────────────────────────
const POLL_INTERVAL = 60000;

const ROUND_LABELS = {
  1: 'QUARTERFINALS',
  2: 'SEMIFINALS',
  3: 'CONFERENCE FINALS',
  4: 'BRULE CHAMPIONSHIP',
};

// Root canvas: 1024×768 (4:3)
// Topbar: 62px | Scroller: 50px | Sidebars: 370px each | Center gap: 284px
const ROOT_W    = 1920;
const ROOT_H    = 1080;
const TOPBAR_H  = 88;
const SCROLL_H  = 50;
const SIDE_W    = 393;
const SKATER_ROWS = 8;

const norm  = (s) => (s || '').trim().toLowerCase();
const svPct = (saves, sa) =>
  sa > 0 ? (saves / sa).toFixed(3).replace('0.', '.') : '—';

function secToMMSS(totalSec) {
  if (!totalSec && totalSec !== 0) return '0:00';
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function parseTimeToSeconds(raw) {
  if (raw == null || raw === '') return 0;
  const str = String(raw).trim();
  if (!str) return 0;
  const parts = str.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + (parts[2] || 0);
  if (parts.length === 2) return parts[0] > 59 ? parts[0] : parts[0] * 60 + (parts[1] || 0);
  const n = parseInt(str, 10);
  return isNaN(n) ? 0 : n;
}

function fmtName(fullName) {
  if (!fullName) return '';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0][0].toUpperCase()} ${parts[parts.length - 1]}`;
}

// ── Data helpers ───────────────────────────────────────────────────────────
function getSeriesScore(playoffGames, teamA, teamB) {
  let aW = 0, bW = 0;
  (playoffGames || []).forEach((g) => {
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
  const ensure = (name) => {
    if (!name || !name.trim()) return null;
    const key = name.trim();
    if (!map[key]) map[key] = { name: key, g: 0, a: 0, pts: 0 };
    return key;
  };
  (rawScoring || [])
    .filter((r) => r.g_team === teamCode)
    .forEach((r) => {
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
  let brG = 0, brA = 0, oneG = 0, oneA = 0;
  let atkSec = 0, atkGames = 0;
  let ppg = 0, ppAmt = 0, shg = 0, pim = 0;;
  let totalSaves = 0, totalSA = 0;

  (rawScoring || []).forEach((r) => {
    if (!playoffGames.find((g) => g.id === r.playoff_game_id)) return;
    if (r.g_team === teamCode) gf++;
    else ga++;
  });

  playoffGames.forEach((pg) => {
    if (pg.team_a_score == null) return;
    const ts = (teamStats || []).find((t) => t.playoff_game_id === pg.id);
    if (!ts) return;
    const isHome = ts.home === teamCode;
    const mySH = isHome ? ts.home_shots || 0 : ts.away_shots || 0;
    const mySA = isHome ? ts.away_shots || 0 : ts.home_shots || 0;
    sh += mySH; sa += mySA;
    const gameRaw = (rawScoring || []).filter((r) => r.playoff_game_id === pg.id);
    const gameGA  = gameRaw.filter((r) => r.g_team !== teamCode).length;
    totalSA += mySA;
    totalSaves += Math.max(0, mySA - gameGA);
    brG += isHome ? ts.home_break_goals || 0 : ts.away_break_goals || 0;
    brA += isHome ? ts.home_break_attempts || 0 : ts.away_break_attempts || 0;
    oneG += isHome
      ? ts.home_one_timer_goals || ts.home_onetimer_goals || 0
      : ts.away_one_timer_goals || ts.away_onetimer_goals || 0;
    oneA += isHome
      ? ts.home_one_timer_attempts || ts.home_onetimer_attempts || 0
      : ts.away_one_timer_attempts || ts.away_onetimer_attempts || 0;
    const atkRaw = isHome ? ts.home_attack : ts.away_attack;
    if (atkRaw != null && atkRaw !== '') {
      const p = String(atkRaw).split(':').map(Number);
      const sec = p[0] * 60 + p[1];
      if (sec > 0) { atkSec += sec; atkGames++; }
    }
    ppg  += isHome ? ts.home_pp_g   || 0 : ts.away_pp_g   || 0;
    ppAmt += isHome ? ts.home_pp_amt || 0 : ts.away_pp_amt || 0;
    shg  += isHome ? ts.home_shg || ts.home_sh_goals || 0 : ts.away_shg || ts.away_sh_goals || 0;
    pim  += isHome ? ts.home_pens || 0 : ts.away_pens || 0;
  });

  const gamesPlayed = playoffGames.filter((g) => g.team_a_score != null).length;
  return {
    gf, ga, sh, sa, gamesPlayed, brG, brA,
    brPct:  brA  > 0 ? `${((brG  / brA)  * 100).toFixed(0)}%` : '—',
    oneG, oneA,
    onePct: oneA > 0 ? `${((oneG / oneA) * 100).toFixed(0)}%` : '—',
    atkAvg: atkGames > 0 ? secToMMSS(Math.round(atkSec / atkGames)) : '—',
    ppg, ppAmt,
    ppPct:  ppAmt > 0 ? `${((ppg  / ppAmt) * 100).toFixed(0)}%` : '—',
    shg,
    seriesSvPct: totalSA > 0 ? svPct(totalSaves, totalSA) : '—',
    totalSaves, totalSA,
    pim,
  };
}

function buildH2HTeamStats(rsGames, rsTeamStats, coachA, coachB, teamA, teamB, filterLg) {
  let gf = 0, ga = 0, sh = 0, sa = 0;
  let brG = 0, brA = 0, oneG = 0, oneA = 0;
  let atkSec = 0, atkGames = 0;
  let ppg = 0, ppAmt = 0, shg = 0, pim = 0;
  let totalSaves = 0, totalSA = 0, gp = 0;

  (rsGames || []).forEach((g) => {
    const h = norm(g.coach_home || ''), a = norm(g.coach_away || '');
    if (!((h === coachA && a === coachB) || (h === coachB && a === coachA))) return;
    if (filterLg && g.lg !== filterLg) return;
    if (g.score_home == null || g.score_away == null) return;
    gp++;
    const hIsA  = h === coachA;
    const myGF  = hIsA ? Number(g.score_home) : Number(g.score_away);
    const myGA  = hIsA ? Number(g.score_away) : Number(g.score_home);
    gf += myGF; ga += myGA;
    const ts = (rsTeamStats || []).find((t) => t.game_id === g.id);
    if (!ts) return;
    const isHome = hIsA;
    const mySH = isHome ? ts.home_shots || 0 : ts.away_shots || 0;
    const mySA = isHome ? ts.away_shots || 0 : ts.home_shots || 0;
    sh += mySH; sa += mySA;
    totalSA += mySA;
    totalSaves += Math.max(0, mySA - myGA);
    brG += isHome ? ts.home_break_goals || 0 : ts.away_break_goals || 0;
    brA += isHome ? ts.home_break_attempts || 0 : ts.away_break_attempts || 0;
    oneG += isHome
      ? ts.home_one_timer_goals || ts.home_onetimer_goals || 0
      : ts.away_one_timer_goals || ts.away_onetimer_goals || 0;
    oneA += isHome
      ? ts.home_one_timer_attempts || ts.home_onetimer_attempts || 0
      : ts.away_one_timer_attempts || ts.away_onetimer_attempts || 0;
    const atkRaw = isHome ? ts.home_attack : ts.away_attack;
    if (atkRaw != null && atkRaw !== '') {
      const p = String(atkRaw).split(':').map(Number);
      const sec = p[0] * 60 + p[1];
      if (sec > 0) { atkSec += sec; atkGames++; }
    }
    ppg   += isHome ? ts.home_pp_g   || 0 : ts.away_pp_g   || 0;
    ppAmt += isHome ? ts.home_pp_amt || 0 : ts.away_pp_amt || 0;
    shg   += isHome ? ts.home_shg || ts.home_sh_goals || 0 : ts.away_shg || ts.away_sh_goals || 0;
  });

  return {
    gp, gf, ga, sh, sa, brG, brA,
    brPct:  brA  > 0 ? `${((brG  / brA)  * 100).toFixed(0)}%` : '—',
    oneG, oneA,
    onePct: oneA > 0 ? `${((oneG / oneA) * 100).toFixed(0)}%` : '—',
    atkAvg: atkGames > 0 ? secToMMSS(Math.round(atkSec / atkGames)) : '—',
    ppg, ppAmt,
    ppPct:  ppAmt > 0 ? `${((ppg  / ppAmt) * 100).toFixed(0)}%` : '—',
    shg,
    seriesSvPct: totalSA > 0 ? svPct(totalSaves, totalSA) : '—',
    totalSaves, totalSA,
    gfpg: gp > 0 ? (gf / gp).toFixed(2) : '—',
    gapg: gp > 0 ? (ga / gp).toFixed(2) : '—',
  };
}

function buildScrollItems(playoffGames, rawScoring, teamStats, teamA, teamB, h2h) {
  const completed = (playoffGames || []).filter(
    (g) => g.team_a_score != null && g.team_b_score != null
  );
  const items = [];

  // SECTION 1: PLAYOFF SERIES
  if (completed.length >= 1) {
    items.push({ type: 'section-header', label: 'PLAYOFF SERIES' });
    items.push({ type: 'scores-sub-header' });
    completed.forEach((g) => {
      const gid     = g.id;
      const gameRaw = (rawScoring || []).filter((r) => r.playoff_game_id === gid);
      const aIsCodeA = g.team_code_a === teamA;
      const aScore   = aIsCodeA ? g.team_a_score : g.team_b_score;
      const bScore   = aIsCodeA ? g.team_b_score : g.team_a_score;
      const winner   = aScore > bScore ? teamA : teamB;
      const scorerMap = {};
      gameRaw.forEach((r) => {
        if (!r.goal_player_name) return;
        scorerMap[r.goal_player_name] = (scorerMap[r.goal_player_name] || 0) + 1;
      });
      const sortedScorers = Object.entries(scorerMap).sort((a, b) => b[1] - a[1]);
      const topGoals  = sortedScorers[0]?.[1] || 0;
      const gLeaders  = topGoals > 0
        ? sortedScorers.filter(([, cnt]) => cnt === topGoals)
            .map(([name, cnt]) => `${fmtName(name)}${cnt > 1 ? ` (${cnt})` : ''}`).join(', ')
        : '—';
      const ptMap = {};
      gameRaw.forEach((r) => {
        [r.goal_player_name, r.assist_primary_name, r.assist_secondary_name].forEach((n) => {
          if (n?.trim()) ptMap[n.trim()] = (ptMap[n.trim()] || 0) + 1;
        });
      });
      const sortedPts  = Object.entries(ptMap).sort((a, b) => b[1] - a[1]);
      const topPts     = sortedPts[0]?.[1] || 0;
      const ptsLeaders = topPts > 0
        ? sortedPts.filter(([, c]) => c === topPts).map(([name, c]) => `${fmtName(name)} ${c}`).join(', ')
        : '—';
      items.push({ type: 'game-score', gameNum: g.game_number, aScore, bScore, teamA, teamB, winner, ptsLeaders, gLeaders });
    });

    if ((teamStats || []).length > 0) {
      items.push({ type: 'teamstats-sub-header' });
      completed.forEach((g) => {
        const ts = (teamStats || []).find((t) => t.playoff_game_id === g.id);
        if (!ts) return;
        const aIsHome = ts.home === teamA;
        items.push({
          type: 'team-stats', gameNum: g.game_number, teamA, teamB,
          shotA: aIsHome ? ts.home_shots : ts.away_shots,
          shotB: aIsHome ? ts.away_shots : ts.home_shots,
          atkA:  aIsHome ? ts.home_attack : ts.away_attack,
          atkB:  aIsHome ? ts.away_attack : ts.home_attack,
          bkA:   aIsHome ? `${ts.home_break_goals}/${ts.home_break_attempts}` : `${ts.away_break_goals}/${ts.away_break_attempts}`,
          bkB:   aIsHome ? `${ts.away_break_goals}/${ts.away_break_attempts}` : `${ts.home_break_goals}/${ts.home_break_attempts}`,
          ppA:   aIsHome ? `${ts.home_pp_g}/${ts.home_pp_amt}` : `${ts.away_pp_g}/${ts.away_pp_amt}`,
          ppB:   aIsHome ? `${ts.away_pp_g}/${ts.away_pp_amt}` : `${ts.home_pp_g}/${ts.home_pp_amt}`,
          pimA:  aIsHome ? ts.home_pens : ts.away_pens,
          pimB:  aIsHome ? ts.away_pens : ts.home_pens,
          fowA:  aIsHome ? ts.home_fow : ts.away_fow,
          fowB:  aIsHome ? ts.away_fow : ts.home_fow,
        });
      });
    }
  }

  // SECTION 2: SEASON H2H — only show before any playoff games are played
  if (h2h && h2h.seasonGP > 0 && completed.length === 0) {
    items.push({ type: 'section-header', label: 'SEASON H2H' });
    items.push({ type: 'h2h-record', teamA, teamB, aW: h2h.seasonAW, bW: h2h.seasonBW, ties: h2h.seasonTies, gp: h2h.seasonGP });
    (h2h.seasonGames || []).forEach((g, i) => {
      items.push({ type: 'h2h-game-score', idx: i + 1, teamA, teamB, aScore: g.aScore, bScore: g.bScore, winner: g.winner, ot: g.ot && g.ot !== '0' && g.ot !== 0 ? g.ot : null });
    });
    if (h2h.seasonStatsA) {
      items.push({ type: 'h2h-team-stats', team: teamA, stats: h2h.seasonStatsA });
      items.push({ type: 'h2h-team-stats', team: teamB, stats: h2h.seasonStatsB });
    }
  }

  // SECTION 3: ALL TIME H2H
  if (h2h && h2h.allTimeGP > 0) {
    items.push({ type: 'section-header', label: 'ALL TIME H2H' });
    items.push({ type: 'h2h-record', teamA, teamB, aW: h2h.allTimeAW, bW: h2h.allTimeBW, ties: h2h.allTimeTies, gp: h2h.allTimeGP });
    if (h2h.allTimeStatsA) {
      items.push({ type: 'h2h-team-stats', team: teamA, stats: h2h.allTimeStatsA });
      items.push({ type: 'h2h-team-stats', team: teamB, stats: h2h.allTimeStatsB });
    }
  }

  return items;
}

function useOverlayScale(baseW, baseH) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const calc = () =>
      setScale(Math.min(window.innerWidth / baseW, window.innerHeight / baseH));
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [baseW, baseH]);
  return scale;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function StreamOverlayPlayoff43() {
  const [showPanel, setShowPanel] = useState(false);
  const [allTeams,  setAllTeams]  = useState([]);
  const [currentLg, setCurrentLg] = useState(null);
  const [pendingA,  setPendingA]  = useState('');
  const [pendingB,  setPendingB]  = useState('');
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const pollRef = useRef(null);
  const scale   = useOverlayScale(ROOT_W, ROOT_H);

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

  useEffect(() => {
    async function bootstrap() {
      const { data: seasons } = await supabase
        .from('seasons').select('lg').ilike('lg', 'W%').order('lg', { ascending: false }).limit(1);
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
    const h = (e) => { if (e.key === '`' || e.key === '~') setShowPanel((p) => !p); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const loadMatchup = useCallback(async (tA, tB, lg, round, series) => {
    if (!tA || !tB || !lg || tA === tB) return;
    setLoading(true);

    const { data: allPgRows, error: pgErr } = await supabase
      .from('playoff_games').select('*').ilike('lg', 'W%').eq('lg', lg).order('game_number');
    if (pgErr) console.error('playoff_games error:', pgErr);

    let playoffGames = (allPgRows || []).filter(
      (g) => (g.team_code_a === tA && g.team_code_b === tB) || (g.team_code_a === tB && g.team_code_b === tA)
    );
    if (round  != null) playoffGames = playoffGames.filter((g) => g.round         === round);
    if (series != null) playoffGames = playoffGames.filter((g) => g.series_number === series);
    if (playoffGames.length > 0 && round == null) {
      const maxRound = Math.max(...playoffGames.map((g) => g.round));
      playoffGames = playoffGames.filter((g) => g.round === maxRound);
    }

    const game1       = playoffGames.find((g) => g.game_number === 1) || playoffGames[0];
    const seedA       = game1?.team_code_a === tA ? game1?.seed_a : game1?.seed_b;
    const seedB       = game1?.team_code_a === tA ? game1?.seed_b : game1?.seed_a;
    const pgIds       = playoffGames.map((g) => g.id).filter(Boolean);
    const completed   = playoffGames.filter((g) => g.team_a_score != null);
    const derivedRound  = playoffGames[0]?.round         || 1;
    const derivedSeries = playoffGames[0]?.series_number || 1;
    const seriesLength  = playoffGames[0]?.series_length || 7;
    const winsNeeded    = Math.ceil(seriesLength / 2);

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

    const { data: teamRows } = await supabase.from('teams').select('abr,coach').eq('lg', lg);
    const coachA = norm((teamRows || []).find((t) => t.abr === tA)?.coach || tA);
    const coachB = norm((teamRows || []).find((t) => t.abr === tB)?.coach || tB);

    const { data: allRsGames } = await supabase
      .from('games').select('id,lg,score_home,score_away,ot,coach_home,coach_away')
      .ilike('lg', 'W%').ilike('mode', 'season').not('score_home', 'is', null);

    const h2hGames = (allRsGames || []).filter((g) => {
      const h = norm(g.coach_home || ''), a = norm(g.coach_away || '');
      return (h === coachA && a === coachB) || (h === coachB && a === coachA);
    });

    const h2hGameIds = h2hGames.map((g) => g.id).filter(Boolean);
    let rsTeamStats = [];
    if (h2hGameIds.length > 0) {
      const { data: rts } = await supabase.from('game_stats_team').select('*').in('game_id', h2hGameIds);
      rsTeamStats = rts || [];
    }

    let atAW = 0, atBW = 0, atTies = 0;
    h2hGames.forEach((g) => {
      const h = norm(g.coach_home || ''), a = norm(g.coach_away || '');
      const sh = Number(g.score_home ?? 0), sa = Number(g.score_away ?? 0);
      const hIsA = h === coachA;
      const gfA = hIsA ? sh : sa, gaA = hIsA ? sa : sh;
      if (sh === sa) atTies++;
      else if (gfA > gaA) atAW++;
      else atBW++;
    });

    const seasonGames = h2hGames.filter((g) => g.lg === lg);
    let sAW = 0, sBW = 0, sTies = 0;
    const seasonGameScores = [];
    seasonGames.forEach((g) => {
      const h = norm(g.coach_home || ''), a = norm(g.coach_away || '');
      const sh = Number(g.score_home ?? 0), sa = Number(g.score_away ?? 0);
      const hIsA = h === coachA;
      const aScore = hIsA ? sh : sa, bScore = hIsA ? sa : sh;
      let winner = null;
      if (sh === sa) sTies++;
      else if (aScore > bScore) { sAW++; winner = tA; }
      else { sBW++; winner = tB; }
      seasonGameScores.push({ aScore, bScore, winner, ot: g.ot && g.ot !== '0' && g.ot !== 0 ? g.ot : null });
    });

    const h2h = {
      seasonGP: sAW + sBW + sTies, seasonAW: sAW, seasonBW: sBW, seasonTies: sTies,
      seasonGames: seasonGameScores,
      seasonStatsA: buildH2HTeamStats(h2hGames, rsTeamStats, coachA, coachB, tA, tB, lg),
      seasonStatsB: buildH2HTeamStats(h2hGames, rsTeamStats, coachB, coachA, tB, tA, lg),
      allTimeGP: atAW + atBW + atTies, allTimeAW: atAW, allTimeBW: atBW, allTimeTies: atTies,
      allTimeStatsA: buildH2HTeamStats(h2hGames, rsTeamStats, coachA, coachB, tA, tB, null),
      allTimeStatsB: buildH2HTeamStats(h2hGames, rsTeamStats, coachB, coachA, tB, tA, null),
    };

    const { aW, bW } = getSeriesScore(playoffGames, tA, tB);
    // Higher seed = lower number = right side (challenger); lower seed = left side (home)
    const leftTeam  = seedA != null && seedB != null && seedA > seedB ? tA : tB;
    const rightTeam = leftTeam === tA ? tB : tA;

    setData({
      teamA: tA, teamB: tB, leftTeam, rightTeam,
      leftWins:  leftTeam  === tA ? aW : bW,
      rightWins: rightTeam === tA ? aW : bW,
      leftSeed:  leftTeam  === tA ? seedA : seedB,
      rightSeed: rightTeam === tA ? seedA : seedB,
      winsNeeded, seriesLength,
      totalGames: completed.length,
      nextGameNum: Math.min(completed.length + 1, seriesLength),
      roundLabel: ROUND_LABELS[derivedRound] || `ROUND ${derivedRound}`,
      roundNum: derivedRound, seriesNum: derivedSeries,
      skaterStatsA:    buildCumulativeSkaterStatsFromRaw(rawScoring, tA),
      skaterStatsB:    buildCumulativeSkaterStatsFromRaw(rawScoring, tB),
      teamSeriesStatsA: buildTeamSeriesStats(teamStats, rawScoring, playoffGames, tA),
      teamSeriesStatsB: buildTeamSeriesStats(teamStats, rawScoring, playoffGames, tB),
      scrollItems: buildScrollItems(playoffGames, rawScoring, teamStats, tA, tB, h2h),
      lg, season: lg,
    });
    setLoading(false);
  }, []);

  const handleApply = useCallback(() => {
    if (!pendingA || !pendingB || pendingA === pendingB) return;
    const p = new URLSearchParams({ lg: currentLg, teamA: pendingA, teamB: pendingB });
    window.history.replaceState(null, '', `?${p.toString()}`);
    setShowPanel(false);
    loadMatchup(pendingA, pendingB, currentLg, null, null);
  }, [pendingA, pendingB, currentLg, loadMatchup]);

  useEffect(() => {
    if (!data) return;
    pollRef.current = setInterval(() => {
      const params = getParams();
      loadMatchup(
        params.teamA || data.teamA, params.teamB || data.teamB,
        params.lg    || data.lg,
        params.round  != null ? params.round  : data.roundNum,
        params.series != null ? params.series : data.seriesNum
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
      <Styles />
    </div>
  );
}

// ── Playoff Layout ─────────────────────────────────────────────────────────
function PlayoffLayout({ data, loading }) {
  const {
    leftTeam, rightTeam, leftWins, rightWins, leftSeed, rightSeed,
    roundLabel, nextGameNum, winsNeeded,
    skaterStatsA, skaterStatsB, teamSeriesStatsA, teamSeriesStatsB,
    teamA, teamB, scrollItems,
  } = data;

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
      {/* ── TOP BAR ── */}
      <div className="po-topbar">
        <div className="po-topbar-left">
          <span className="po-round-label">{roundLabel}</span>
        </div>
        <div className="po-topbar-center">
          <img src="/assets/leagueLogos/mainLogo-512.png" className="po-league-logo" alt="WN95HL"
            onError={(e) => { e.target.style.display = 'none'; }} />
        </div>
        <div className="po-topbar-right">
          <span className="po-game-label">GAME {nextGameNum}</span>
          <span className="po-sep-dot">·</span>
          <span className="po-series-status">{seriesStatus()}</span>
          {loading && <span className="po-live-dot" />}
        </div>
      </div>

      {/* ── LEFT SIDEBAR ── */}
      <div className="po-side-left">
        <SidePanel43
          team={leftTeam}
          wins={leftWins}
          seed={leftSeed}
          winsNeeded={winsNeeded}
          side="left"
          skaters={leftSkaters}
          teamStats={leftStats}
        />
      </div>

      {/* ── RIGHT SIDEBAR ── */}
      <div className="po-side-right">
        <SidePanel43
          team={rightTeam}
          wins={rightWins}
          seed={rightSeed}
          winsNeeded={winsNeeded}
          side="right"
          skaters={rightSkaters}
          teamStats={rightStats}
        />
      </div>

      {/* ── BOTTOM SCROLLER ── */}
      <BottomScroller items={scrollItems} />
    </>
  );
}

// ── Side Panel (4:3 version — hero block at top) ───────────────────────────
// Hero block: logo + code + seed on one row; big wins number + dots on next row
function SidePanel43({ team, wins, seed, winsNeeded, side, skaters, teamStats }) {
  const gp = teamStats?.gamesPlayed || 0;

  return (
    <div className="po-side-panel">

      {/* HERO BLOCK ─────────────────────────────────────────── */}
      <div className="po-hero-block">
        {/* Row 1: logo · team code · seed badge */}
        <div className="po-hero-identity">
          <img src={`/assets/teamLogos/${team}.png`} className="po-hero-logo" alt={team}
            onError={(e) => (e.target.style.display = 'none')} />
          <span className="po-hero-code">{team}</span>
          {seed != null && <span className="po-hero-seed">#{seed}</span>}
        </div>
        {/* Row 2: big wins count + series dots */}
        <div className="po-hero-score-row">
          <span className="po-hero-wins">{wins}</span>
          <div className="po-dots-col">
            {Array.from({ length: winsNeeded }, (_, i) => (
              <div key={i} className={`po-dot ${i < wins ? 'filled' : 'empty'} ${side}`} />
            ))}
          </div>
        </div>
      </div>

      {/* DIVIDER */}
      <div className="po-hero-divider" />

      {/* SKATERS ────────────────────────────────────────────── */}
      {/* SKATERS — fixed height so series stats always align ── */}
      <div style={{ minHeight: '228px' }}>
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

      {/* SERIES STATS ───────────────────────────────────────── */}
      {gp > 0 && teamStats && (
        <>
          <div className="po-stats-divider" />
          <div className="po-section-label">SERIES STATS</div>
          <div className="po-stats-grid">
            <StatRow label="GF"  value={teamStats.gf}  sub={`${(teamStats.gf/gp).toFixed(1)}/gm`}  accent="gold" />
            <StatRow label="GA"  value={teamStats.ga}  sub={`${(teamStats.ga/gp).toFixed(1)}/gm`}  accent="red" />
            <StatRow label="SV%" value={teamStats.seriesSvPct}
              sub={teamStats.totalSA > 0 ? `${teamStats.totalSaves}/${teamStats.totalSA}` : null} accent="green" />
            <StatRow label="SH"  value={teamStats.sh}  sub={`${(teamStats.sh/gp).toFixed(1)}/gm`} />
            <StatRow label="SA"  value={teamStats.sa}  sub={`${(teamStats.sa/gp).toFixed(1)}/gm`} />
            <StatRow label="BRK" value={`${teamStats.brG}/${teamStats.brA}`} sub={teamStats.brPct} />
            <StatRow label="PEN" value={teamStats.pim} />
            {teamStats.oneA > 0 && (
              <>
                <StatRow label="1xG" value={teamStats.oneG} accent="blue" />
                <StatRow label="1xA" value={teamStats.oneA} />
                <StatRow label="1x%" value={teamStats.onePct} accent="blue" />
              </>
            )}
            <StatRow label="ATK" value={teamStats.atkAvg} sub="avg/gm" />
            <StatRow label="PPG" value={`${teamStats.ppg}/${teamStats.ppAmt}`} sub={teamStats.ppPct} accent="blue" />
            {teamStats.shg > 0 && <StatRow label="SHG" value={teamStats.shg} accent="green" />}
          </div>
        </>
      )}
    </div>
  );
}

function StatRow({ label, value, sub, accent }) {
  return (
    <div className="po-stat-row">
      <span className="po-stat-label">{label}</span>
      <span className={`po-stat-val${accent ? ` accent-${accent}` : ''}`}>{value ?? '—'}</span>
      {sub && <span className="po-stat-sub">{sub}</span>}
    </div>
  );
}

// ── Bottom Scroller ────────────────────────────────────────────────────────
function BottomScroller({ items }) {
  const posRef   = useRef(0);
  const frameRef = useRef(null);
  const innerRef = useRef(null);
  const [x, setX] = useState(0);
  const itemsKey = items.length;

  useEffect(() => { posRef.current = 0; }, [itemsKey]);

  useEffect(() => {
    const SPEED = 0.8;
    const tick = () => {
      if (innerRef.current) {
        const half = innerRef.current.scrollWidth / 2;
        if (half > 0) { posRef.current = (posRef.current + SPEED) % half; setX(posRef.current); }
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  if (!items?.length) return null;

  const renderItem = (item, idx) => {
    switch (item.type) {
      case 'section-header':
        return (
          <span key={`sec-${idx}`} className="sc-section-hdr">
            <span className="sc-hdr-chevron">▶</span>
            {item.label}
            <span className="sc-hdr-chevron">◀</span>
          </span>
        );
      case 'scores-sub-header':
        return <span key={`shdr-${idx}`} className="sc-sub-hdr">SCORES</span>;
      case 'teamstats-sub-header':
        return <span key={`shdr-${idx}`} className="sc-sub-hdr">TEAM STATS</span>;
      case 'game-score':
        return (
          <span key={idx} className="sc-item">
            <span className="sc-pill">GM{item.gameNum}</span>
            <span className={`sc-team${item.winner === item.teamA ? ' win' : ''}`}>{item.teamA}</span>
            <span className="sc-score">{item.aScore} – {item.bScore}</span>
            <span className={`sc-team${item.winner === item.teamB ? ' win' : ''}`}>{item.teamB}</span>
            <span className="sc-bullet">·</span>
            <span className="sc-stat">PTS <span className="sc-val">{item.ptsLeaders}</span></span>
            <span className="sc-bullet">·</span>
            <span className="sc-stat">G <span className="sc-val">{item.gLeaders}</span></span>
          </span>
        );
      case 'team-stats':
        return (
          <span key={idx} className="sc-item">
            <span className="sc-pill">GM{item.gameNum} STATS</span>
            <span className="sc-stat">SOG <span className="sc-val">{item.teamA} {item.shotA}–{item.shotB} {item.teamB}</span></span>
            <span className="sc-bullet">·</span>
            <span className="sc-stat">ATK <span className="sc-val">
              {secToMMSS((() => { const p = String(item.atkA).split(':').map(Number); return p[0] * 60 + p[1]; })())}
              /{secToMMSS((() => { const p = String(item.atkB).split(':').map(Number); return p[0] * 60 + p[1]; })())}
            </span></span>
            <span className="sc-bullet">·</span>
            <span className="sc-stat">BK <span className="sc-val">{item.bkA}/{item.bkB}</span></span>
            <span className="sc-bullet">·</span>
            <span className="sc-stat">PP <span className="sc-val">{item.ppA}/{item.ppB}</span></span>
            <span className="sc-bullet">·</span>
            <span className="sc-stat">PIM <span className="sc-val">{item.pimA}/{item.pimB}</span></span>
            <span className="sc-bullet">·</span>
            <span className="sc-stat">FO <span className="sc-val">{item.fowA}/{item.fowB}</span></span>
          </span>
        );
      case 'h2h-record':
        return (
          <span key={idx} className="sc-item">
            <span className="sc-pill">RECORD</span>
            <span className="sc-team">{item.teamA}</span>
            <span className="sc-score">{item.aW}W</span>
            <span className="sc-muted">–</span>
            <span className="sc-score">{item.bW}W</span>
            {item.ties > 0 && <span className="sc-muted">{item.ties}T</span>}
            <span className="sc-team">{item.teamB}</span>
            <span className="sc-bullet">·</span>
            <span className="sc-muted">{item.gp} GP</span>
          </span>
        );
      case 'h2h-game-score':
        return (
          <span key={idx} className="sc-item">
            <span className="sc-pill">G{item.idx}</span>
            <span className={`sc-team${item.winner === item.teamA ? ' win' : ''}`}>{item.teamA}</span>
            <span className="sc-score">{item.aScore} – {item.bScore}</span>
            <span className={`sc-team${item.winner === item.teamB ? ' win' : ''}`}>{item.teamB}</span>
            {item.ot && <span className="sc-muted sc-ot">OT</span>}
          </span>
        );
      case 'h2h-team-stats': {
        const s = item.stats;
        return (
          <span key={idx} className="sc-item">
            <span className="sc-pill">{item.team}</span>
            <span className="sc-stat">GF/G <span className="sc-val accent-gold">{s.gfpg}</span></span>
            <span className="sc-bullet">·</span>
            <span className="sc-stat">GA/G <span className="sc-val accent-red">{s.gapg}</span></span>
            <span className="sc-bullet">·</span>
            <span className="sc-stat">SV% <span className="sc-val accent-green">{s.seriesSvPct}</span></span>
            {s.sh > 0 && <><span className="sc-bullet">·</span><span className="sc-stat">SH <span className="sc-val">{(s.sh/s.gp).toFixed(1)}</span></span></>}
            {s.brA > 0 && <><span className="sc-bullet">·</span><span className="sc-stat">BRK <span className="sc-val">{s.brPct}</span></span></>}
            {s.ppAmt > 0 && <><span className="sc-bullet">·</span><span className="sc-stat">PP <span className="sc-val accent-blue">{s.ppPct}</span></span></>}
            {s.atkAvg !== '—' && <><span className="sc-bullet">·</span><span className="sc-stat">ATK <span className="sc-val">{s.atkAvg}</span></span></>}
          </span>
        );
      }
      default: return null;
    }
  };

  const nodes = items.map(renderItem).filter(Boolean);
  return (
    <div className="po-scroller">
      <div className="po-scroller-inner" ref={innerRef} style={{ transform: `translateX(-${x}px)` }}>
        {nodes}{nodes}
      </div>
    </div>
  );
}

// ── Setup / Utils ──────────────────────────────────────────────────────────
function SetupPanel({ allTeams, pendingA, setPendingA, pendingB, setPendingB, onApply }) {
  return (
    <div className="sp-panel">
      <div className="sp-title">⚡ PLAYOFF OVERLAY SETUP</div>
      <div className="sp-note">Press ~ to close</div>
      <div className="sp-row">
        <label className="sp-label">TEAM A</label>
        <CustomSelect value={pendingA} onChange={setPendingA}
          options={allTeams.map((t) => ({ value: t.abr, label: `${t.abr}${t.team ? ` — ${t.team}` : ''}` }))}
          placeholder="-- SELECT --" />
      </div>
      <div className="sp-row">
        <label className="sp-label">TEAM B</label>
        <CustomSelect value={pendingB} onChange={setPendingB}
          options={allTeams.map((t) => ({ value: t.abr, label: `${t.abr}${t.team ? ` — ${t.team}` : ''}` }))}
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
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const selected = options.find((o) => o.value === value);
  return (
    <div className="csel" ref={ref}>
      <div className={`csel-trigger${open ? ' open' : ''}`} onClick={() => setOpen((o) => !o)}>
        <span className={selected ? '' : 'csel-ph'}>{selected ? selected.label : placeholder}</span>
        <span className="csel-arr">{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div className="csel-list">
          {options.map((o) => (
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
          onError={(e) => (e.target.style.display = 'none')} />
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
  return (
    <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323:wght@400&family=Barlow+Condensed:wght@400;600;700;800&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .po-root {
      width: ${ROOT_W}px; height: ${ROOT_H}px;
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
      position: absolute; top: 0; left: 0; right: 0; height: ${TOPBAR_H}px;
      background: linear-gradient(90deg,
        rgba(3,1,12,.97) 0%, rgba(8,4,24,.97) 40%,
        rgba(8,4,24,.97) 60%, rgba(3,1,12,.97) 100%);
      border-bottom: 2px solid rgba(255,215,0,.4);
      display: flex; align-items: center; padding: 0 16px;
      box-shadow: 0 2px 20px rgba(0,0,0,.6);
    }
    .po-topbar-left  { flex: 1; display: flex; align-items: center; }
    .po-topbar-center {
      position: absolute; left: 0; right: 0;
      display: flex; align-items: center; justify-content: center;
      height: 100%; pointer-events: none;
    }
    .po-topbar-right {
      flex: 1; display: flex; align-items: center;
      justify-content: flex-end; gap: 12px;
    }
    .po-league-logo {
        height: 76px; width: auto; object-fit: contain;
        filter: drop-shadow(0 0 10px rgba(255,215,0,.55));
    }
    .po-empty-logo {
      height: 90px; width: auto; object-fit: contain;
      filter: drop-shadow(0 0 18px rgba(255,215,0,.35)); margin-bottom: .6rem;
    }
    .po-round-label {
      font-family: 'Press Start 2P', monospace; font-size: .72rem;
      color: #FF8C00; letter-spacing: 2px;
      text-shadow: 0 0 8px rgba(255,140,0,.5);
    }
    .po-sep-dot {
      font-family: 'VT323', monospace; font-size: 1.6rem;
      color: rgba(255,255,255,.2);
    }
    .po-game-label {
      font-family: 'Barlow Condensed', sans-serif; font-weight: 700;
      font-size: 1.1rem; letter-spacing: 3px; color: rgba(255,255,255,.65);
    }
    .po-series-status {
      font-family: 'Barlow Condensed', sans-serif; font-weight: 800;
      font-size: 1.2rem; letter-spacing: 2px;
      color: #87CEEB; text-shadow: 0 0 10px rgba(135,206,235,.4);
    }
    .po-live-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #4cff91; box-shadow: 0 0 8px #4cff91;
      animation: livepulse 1.2s ease-in-out infinite;
    }
    @keyframes livepulse { 0%,100%{opacity:1} 50%{opacity:.3} }

    /* ── SIDE PANELS ── */
    .po-side-left, .po-side-right {
      position: absolute; top: ${TOPBAR_H}px; bottom: ${SCROLL_H}px;
      width: ${SIDE_W}px;
      background: linear-gradient(170deg, rgba(3,1,12,.96), rgba(6,3,18,.96));
      border: 1px solid rgba(255,215,0,.22);
      overflow-y: auto; overflow-x: hidden;
    }
    .po-side-left  { left: 0;  border-left: none;  border-radius: 0 0 6px 0; }
    .po-side-right { right: 0; border-right: none; border-radius: 0 0 0 6px; }
    .po-side-left::-webkit-scrollbar,
    .po-side-right::-webkit-scrollbar { width: 0; }
    .po-side-panel { display: flex; flex-direction: column; }

    /* ── HERO BLOCK (inside sidebar) ── */
    .po-hero-block {
      padding: .6rem .7rem .5rem;
      background: linear-gradient(160deg, rgba(255,140,0,.12), rgba(255,215,0,.04));
      border-bottom: 2px solid rgba(255,215,0,.22);
    }
    .po-hero-identity {
      display: flex; align-items: center; gap: 10px;
      margin-bottom: .45rem;
    }
    .po-hero-logo {
      height: 72px; width: auto; object-fit: contain; flex-shrink: 0;
      filter: drop-shadow(0 0 8px rgba(255,215,0,.3));
    }
    .po-hero-code {
      font-family: 'Press Start 2P', monospace; font-size: 1.05rem;
      color: #FFFFFF; letter-spacing: 1px;
      text-shadow: 0 0 10px rgba(255,255,255,.2);
    }
    .po-hero-seed {
      font-family: 'Press Start 2P', monospace; font-size: .82rem;
      color: #FFD700;
      background: rgba(255,215,0,.1);
      border: 1px solid rgba(255,215,0,.4); border-radius: 4px;
      padding: .2rem .45rem; line-height: 1;
      text-shadow: 0 0 8px rgba(255,215,0,.5);
      margin-left: auto;
    }
    .po-hero-score-row {
      display: flex; align-items: center; gap: 14px;
    }
    .po-hero-wins {
      font-family: 'Barlow Condensed', sans-serif; font-weight: 800;
      font-size: 4.6rem; line-height: 1; color: #FFD700;
      text-shadow: 0 0 30px rgba(255,215,0,.5), 0 2px 8px rgba(0,0,0,.9);
      min-width: 3.2rem; text-align: center; flex-shrink: 0;
    }
    .po-dots-col {
      display: flex; flex-direction: row; flex-wrap: wrap;
      align-items: center; gap: 7px;
    }
    .po-dot {
      width: 14px; height: 14px; border-radius: 50%;
      transition: all .3s ease; flex-shrink: 0;
    }
    .po-dot.filled.left  {
      background: radial-gradient(circle, #87CEEB, #4a9fc4);
      box-shadow: 0 0 10px rgba(135,206,235,.8), 0 0 20px rgba(135,206,235,.3);
    }
    .po-dot.filled.right {
      background: radial-gradient(circle, #FF8C00, #cc6600);
      box-shadow: 0 0 10px rgba(255,140,0,.8), 0 0 20px rgba(255,140,0,.3);
    }
    .po-dot.empty { background: transparent; border: 2px solid rgba(255,255,255,.2); }

    .po-hero-divider {
      height: 1px;
      background: linear-gradient(90deg, rgba(255,215,0,.4), rgba(255,215,0,.1), transparent);
    }
    .po-stats-divider {
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,215,0,.28), transparent);
      margin: .35rem .6rem;
    }

    /* ── SKATERS + STATS ── */
    .po-section-label {
        font-family: 'Press Start 2P', monospace; font-size: .52rem;
        color: #FF8C00; letter-spacing: 2px;
        padding: .35rem .6rem .18rem;
      background: rgba(255,140,0,.06);
      border-bottom: 1px solid rgba(255,140,0,.14);
      border-top: 1px solid rgba(255,255,255,.03);
    }
    .po-table { width: 100%; border-collapse: collapse; }
    .po-th {
      font-family: 'Press Start 2P', monospace; font-size: .64rem;
      color: rgba(255,255,255,.42); padding: .08rem .3rem;
      text-align: center; background: rgba(0,0,0,.2);
      border-bottom: 1px solid rgba(255,215,0,.06);
    }
    .po-th.al { text-align: left; }
    .po-tr-even { background: rgba(255,255,255,.018); }
    .po-td {
      font-family: 'VT323', monospace; font-size: 1.15rem;
      color: #C8D8E8; padding: .03rem .3rem;
      text-align: center; line-height: 1.25;
    }
    .po-td.al  { text-align: left; color: #EEF2F8; }
    .po-td.pts { color: #FFD700; font-size: 1.38rem; font-weight: 700; }
    .po-td.g   { color: #9DDDFF; }
    .po-td.a   { color: #8AACCC; }
    .po-no-data {
      font-family: 'Press Start 2P', monospace; font-size: .4rem;
      color: rgba(255,255,255,.13); text-align: center; padding: 2.5rem .5rem;
    }
    .po-stats-grid { display: flex; flex-direction: column; padding: .08rem 0 .5rem; }
    .po-stat-row {
      display: grid; grid-template-columns: 2.6rem 1fr auto;
      align-items: center; padding: .1rem .5rem;
      border-bottom: 1px solid rgba(255,255,255,.04); gap: .3rem;
    }
    .po-stat-row:nth-child(even) { background: rgba(255,255,255,.018); }
    .po-stat-label {
        font-family: 'Press Start 2P', monospace; font-size: .50rem;
        color: rgba(255,255,255,.85); letter-spacing: 1px;
      }
    .po-stat-val {
      font-family: 'VT323', monospace; font-size: 1.28rem;
      color: #FFFFFF; text-align: left; line-height: 1;
    }
    .po-stat-val.accent-gold  { color: #FFD700; text-shadow: 0 0 8px rgba(255,215,0,.4); }
    .po-stat-val.accent-red   { color: #ff6e6e; }
    .po-stat-val.accent-blue  { color: #87CEEB; text-shadow: 0 0 8px rgba(135,206,235,.4); }
    .po-stat-val.accent-green { color: #4cff91; text-shadow: 0 0 8px rgba(76,255,145,.4); }
    .po-stat-sub {
       font-family: 'Barlow Condensed', sans-serif; font-size: .96rem;
       color: rgba(255,255,255,.36); text-align: right; white-space: nowrap;
    }

    /* ── BOTTOM SCROLLER ── */
    .po-scroller {
      position: absolute; bottom: 0; left: 0; right: 0; height: ${SCROLL_H}px;
      background: linear-gradient(90deg,
        rgba(2,1,8,.99) 0%, rgba(6,3,18,.99) 15%,
        rgba(6,3,18,.99) 85%, rgba(2,1,8,.99) 100%);
      border-top: 2px solid rgba(255,215,0,.32); overflow: hidden;
    }
    .po-scroller-inner {
      display: flex; align-items: center;
      height: 100%; white-space: nowrap; will-change: transform;
    }
    .sc-item {
        display: inline-flex; align-items: center; gap: 8px; padding: 0 30px;
        font-family: 'Barlow Condensed', sans-serif;
        font-size: .95rem; font-weight: 600; letter-spacing: .4px;
      border-right: 2px solid rgba(255,215,0,.08);
    }
    .sc-section-hdr {
        display: inline-flex; align-items: center; gap: 10px;
        padding: 0 26px; margin: 0 4px;
        font-family: 'Press Start 2P', monospace; font-size: .52rem;
      color: #FFD700; letter-spacing: 3px;
      text-shadow: 0 0 10px rgba(255,215,0,.6);
      background: rgba(255,215,0,.08);
      border-left: 3px solid rgba(255,215,0,.6);
      border-right: 3px solid rgba(255,215,0,.6);
      height: 100%;
    }
    .sc-hdr-chevron { color: rgba(255,215,0,.5); font-size: .62rem; }
    .sc-sub-hdr {
      display: inline-flex; align-items: center;
      padding: 0 18px; margin: 0 8px;
      font-family: 'Press Start 2P', monospace; font-size: .48rem;
      color: rgba(255,140,0,.55); letter-spacing: 2px;
      border-left: 1px solid rgba(255,140,0,.22);
      border-right: 1px solid rgba(255,140,0,.22);
      height: 100%;
    }
    .sc-pill {
      font-family: 'Press Start 2P', monospace; font-size: .58rem;
      color: #FF8C00; background: rgba(255,140,0,.14);
      border: 1px solid rgba(255,140,0,.3); border-radius: 2px; padding: .1rem .32rem;
    }
    .sc-team  { font-family: 'Barlow Condensed', sans-serif; font-weight: 800; font-size: 1.1rem; color: rgba(255,255,255,.65); letter-spacing: 1px; }
    .sc-team.win { color: #FFD700; text-shadow: 0 0 7px rgba(255,215,0,.4); }
    .sc-score { font-family: 'Barlow Condensed', sans-serif; font-weight: 800; font-size: 1.3rem; color: #E8F0F8; }
    .sc-bullet { color: rgba(255,215,0,.28); font-size: .9rem; }
    .sc-stat   { color: rgba(255,255,255,.42); font-size: 1rem; font-weight: 600; }
    .sc-val    { color: #87CEEB; font-weight: 700; }
    .sc-val.accent-gold  { color: #FFD700; }
    .sc-val.accent-red   { color: #ff8a8a; }
    .sc-val.accent-green { color: #4cff91; }
    .sc-val.accent-blue  { color: #87CEEB; }
    .sc-muted  { color: rgba(255,255,255,.28); font-size: .95rem; }
    .sc-ot     { font-family: 'Press Start 2P', monospace; font-size: .48rem; color: rgba(255,140,0,.6); }

    /* ── EMPTY / LOADING ── */
    .po-empty {
      position: absolute; inset: 0;
      background: linear-gradient(170deg, rgba(4,2,14,.97), rgba(8,6,22,.97));
      display: flex; align-items: center; justify-content: center;
    }
    .po-empty-inner { text-align: center; display: flex; flex-direction: column; align-items: center; gap: .9rem; }
    .po-empty-title { font-family: 'Press Start 2P', monospace; font-size: 1.3rem; color: rgba(255,215,0,.4); letter-spacing: 2px; }
    .po-empty-sub   { font-family: 'VT323', monospace; font-size: 1.5rem; color: rgba(255,255,255,.25); }
    .key            { font-family: 'Press Start 2P', monospace; font-size: 1.7rem; color: #FF8C00; }
    .po-loading {
      font-family: 'Press Start 2P', monospace; font-size: 1.1rem;
      color: #FFD700; animation: bpulse 1s ease-in-out infinite;
    }
    @keyframes bpulse { 0%,100% { filter: drop-shadow(0 0 4px #FF8C00); opacity: 1; } 50% { filter: drop-shadow(0 0 14px #FFD700); opacity: .6; } }

    /* ── SETUP PANEL ── */
    .sp-panel {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 999;
      background: linear-gradient(160deg, rgba(4,2,20,.98), rgba(10,6,30,.98));
      border: 1px solid rgba(255,215,0,.5); border-radius: 10px;
      padding: 1.4rem 1.6rem; width: 340px;
      box-shadow: 0 0 40px rgba(255,140,0,.22), 0 0 80px rgba(0,0,0,.8);
    }
    .sp-title { font-family: 'Press Start 2P', monospace; font-size: .92rem; color: #FFD700; letter-spacing: 2px; margin-bottom: .25rem; }
    .sp-note  { font-family: 'Press Start 2P', monospace; font-size: .5rem;  color: rgba(255,255,255,.2); margin-bottom: 1.1rem; }
    .sp-row   { display: flex; flex-direction: column; gap: .35rem; margin-bottom: .9rem; }
    .sp-label { font-family: 'Press Start 2P', monospace; font-size: .56rem; color: #FF8C00; }
    .sp-error { font-family: 'Press Start 2P', monospace; font-size: .5rem;  color: #ff4444; margin-bottom: .5rem; }
    .sp-apply {
      font-family: 'Press Start 2P', monospace; font-size: .72rem; letter-spacing: 2px; color: #000;
      background: linear-gradient(135deg, #FFD700, #FF8C00);
      border: none; border-radius: 4px; padding: .55rem 1rem; width: 100%;
      cursor: pointer; transition: opacity .15s;
    }
    .sp-apply:hover:not(:disabled) { opacity: .85; }
    .sp-apply:disabled { opacity: .3; cursor: not-allowed; }
    .csel { position: relative; width: 100%; user-select: none; }
    .csel-trigger {
      font-family: 'VT323', monospace; font-size: 1.25rem; background: rgba(0,0,0,.6); color: #E0E0E0;
      border: 1px solid rgba(255,215,0,.3); border-radius: 4px; padding: .28rem .55rem; width: 100%;
      cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: .4rem;
    }
    .csel-trigger:hover { border-color: rgba(255,215,0,.6); }
    .csel-trigger.open  { border-color: rgba(255,215,0,.8); border-bottom-left-radius:0; border-bottom-right-radius:0; }
    .csel-arr  { font-size: .85rem; color: rgba(255,215,0,.6); flex-shrink:0; }
    .csel-ph   { color: rgba(255,255,255,.3); }
    .csel-list {
      position: absolute; top: 100%; left: 0; right: 0; z-index: 1000;
      background: rgba(8,4,24,.98); border: 1px solid rgba(255,215,0,.5); border-top: none;
      border-bottom-left-radius: 4px; border-bottom-right-radius: 4px;
      max-height: 220px; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,.8);
    }
    .csel-opt { font-family: 'VT323', monospace; font-size: 1.15rem; color: #D0D8E0; padding: .22rem .55rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,.04); }
    .csel-opt:hover { background: rgba(255,215,0,.11); color: #FFD700; }
    .csel-opt.sel   { background: rgba(255,140,0,.17); color: #FF8C00; }
  `}</style>
  );
}

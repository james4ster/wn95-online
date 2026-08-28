// utils/clinchEngine.js
// Playoff clinch/elimination scenario engine — pure functions, no React/Supabase deps.

export const CLINCH_CONFIG = {
    GAMES_PER_OPPONENT: 2,
    MAX_GR_FOR_PROJECTION: 12,   // "too early" gate — target team's own games remaining
    BUBBLE_BUFFER: 4,            // how many spots above/below the cutoff to scan for impact
    DETAIL_GR_THRESHOLD: 10,     // a rival only gets listed once ITS games remaining is this low
  };
  
  export function computeRemainingOpponents(teamAbr, seasonTeams, games, gamesPerOpponent = CLINCH_CONFIG.GAMES_PER_OPPONENT) {
    const playedCountByOpp = {};
    const t = teamAbr.toLowerCase();
  
    games.forEach((g) => {
      const home = g.home?.toLowerCase();
      const away = g.away?.toLowerCase();
      if (home !== t && away !== t) return;
      if (g.score_home == null) return;
      const opp = home === t ? away : home;
      playedCountByOpp[opp] = (playedCountByOpp[opp] || 0) + 1;
    });
  
    return (seasonTeams || [])
      .filter((s) => s.abr.toLowerCase() !== t)
      .map((s) => {
        const done = playedCountByOpp[s.abr.toLowerCase()] || 0;
        return { team: s.abr, gamesLeft: Math.max(0, gamesPerOpponent - done) };
      })
      .filter((o) => o.gamesLeft > 0);
  }
  
  // Minimum points a trailing rival needs, at minimum, to have ANY chance of catching target
  // (assumes target earns 0 more points — the bare "still alive" bar, not a guarantee).
  function pointsNeededToStayAlive(rival, target) {
    return Math.max(0, target.pts - rival.pts + 1);
  }
  
  // Minimum points a leading rival needs to guarantee finishing above target regardless of
  // what target does (i.e. exceeds target's own ceiling).
  function pointsNeededToLockOut(rival, target) {
    return Math.max(0, target.maxPts - rival.pts + 1);
  }
  
  export function computeClinchScenario({
    team, sortedStandings, playoffTeams, clinched, eliminated, rawGames, seasonTeams, rsGamesVs,
  }) {
    const target = sortedStandings.find((s) => s.team === team);
    if (!target || !playoffTeams) return null;
  
    const seed = sortedStandings.findIndex((s) => s.team === team) + 1;
    const targetIdx = sortedStandings.indexOf(target);
    const base = { team, seed, pts: target.pts, gr: target.gr, maxPts: target.maxPts };
  
    // Guard: if this season's games-remaining data isn't resolvable, say so explicitly
    // instead of silently producing a broken "bubble" result.
    if (target.gr == null || target.maxPts == null) {
      return { status: 'no-data', ...base };
    }
  
    if (clinched.has(team)) {
        // Nearby seeds around this team's own spot — purely informational,
        // since a clinched team has nothing left to fight for at the cutoff line.
        const nearbyStart = Math.max(0, targetIdx - CLINCH_CONFIG.BUBBLE_BUFFER);
        const nearbyEnd    = Math.min(sortedStandings.length, targetIdx + CLINCH_CONFIG.BUBBLE_BUFFER + 1);
        const nearbySeeds = sortedStandings.slice(nearbyStart, nearbyEnd).map((t) => ({
          team: t.team,
          pts: t.pts,
          seed: sortedStandings.indexOf(t) + 1,
        }));
        return { status: 'clinched', ...base, nearbySeeds };
      }

    if (eliminated.has(team)) return { status: 'eliminated', ...base };
  
    if (target.gr > CLINCH_CONFIG.MAX_GR_FOR_PROJECTION) {
      return { status: 'too-early', ...base, gamesUntilProjection: target.gr - CLINCH_CONFIG.MAX_GR_FOR_PROJECTION };
    }
  
    const { BUBBLE_BUFFER, DETAIL_GR_THRESHOLD, GAMES_PER_OPPONENT } = CLINCH_CONFIG;
    const startIdx = Math.max(0, playoffTeams - BUBBLE_BUFFER - 1);
    const endIdx = Math.min(sortedStandings.length, playoffTeams + BUBBLE_BUFFER);
    
    const windowTeams = sortedStandings.slice(startIdx, endIdx).filter((t) => t.team !== team);
  
    // Mathematically alive against target at all (ceiling/floor still overlap)
    const mathematicallyAlive = windowTeams.filter(
      (t) => t.maxPts != null && t.pts != null && t.maxPts >= target.pts && t.pts <= target.maxPts
    );
  
    // Of those, only ones with few enough games left to say something concrete
    const impactDetails = mathematicallyAlive
      .filter((t) => t.gr != null && t.gr <= DETAIL_GR_THRESHOLD)
      .map((t) => {
        const relation = sortedStandings.indexOf(t) < targetIdx ? 'ahead' : 'behind';
        const remainingOpponents = computeRemainingOpponents(t.team, seasonTeams, rawGames, rsGamesVs ?? GAMES_PER_OPPONENT);
        const h2hGamesLeft = remainingOpponents.find((o) => o.team === team)?.gamesLeft || 0;
        const maxAvail = (t.gr || 0) * 2;
  
        let needText;
        if (relation === 'behind') {
          const need = pointsNeededToStayAlive(t, target);
          needText = need > maxAvail
            ? `Can no longer catch ${team} even with a perfect finish`
            : `Needs at least ${need} pt${need === 1 ? '' : 's'} from its final ${t.gr} game${t.gr === 1 ? '' : 's'} to stay alive`;
        } else {
          const need = pointsNeededToLockOut(t, target);
          needText = need <= 0
            ? `Has already clinched ahead of ${team}`
            : need > maxAvail
            ? `Can't fully lock out ${team} yet — needs help even with a perfect finish`
            : `Needs ${need} more pt${need === 1 ? '' : 's'} from its final ${t.gr} game${t.gr === 1 ? '' : 's'} to clinch ahead of ${team}`;
        }
  
        return { team: t.team, pts: t.pts, gr: t.gr, maxPts: t.maxPts, relation, needText, h2hGamesLeft, remainingOpponents };
      });
  
        const tooEarlyCount = mathematicallyAlive.length - impactDetails.length;
        const cutoffTeam = sortedStandings[playoffTeams - 1] || null;
        const bubbleTeam = sortedStandings[playoffTeams] || null;

        // Full "could pass / could be passed by" pool — broader than impactDetails, which is
        // narrowed to teams close enough to project text for. Used by the what-if simulator.
        const allCandidates = mathematicallyAlive.map((t) => ({
            team: t.team,
            relation: sortedStandings.indexOf(t) < targetIdx ? 'ahead' : 'behind',
        }));

        return {
            status: 'bubble',
            ...base,
            cutoffTeam: cutoffTeam ? { team: cutoffTeam.team, pts: cutoffTeam.pts } : null,
            bubbleTeam: bubbleTeam ? { team: bubbleTeam.team, pts: bubbleTeam.pts } : null,
            impactDetails,
            tooEarlyCount,
            allCandidates,
        };
  }
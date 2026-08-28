// standingsCalc.js
// Standings computation + tiebreaker logic, shared by Standings.jsx and TeamDrawer.jsx.
// Lives outside both so neither has to import the other (avoids a circular import).

export function computeH2H(teamA, teamB, games) {
    let ptsA = 0,
      ptsB = 0;
    (games || []).forEach((g) => {
      const aIsHome = g.home === teamA && g.away === teamB;
      const aIsAway = g.home === teamB && g.away === teamA;
      if (!aIsHome && !aIsAway) return;
      const sA = aIsHome ? g.score_home : g.score_away;
      const sB = aIsHome ? g.score_away : g.score_home;
      if (sA > sB) ptsA += 2;
      else if (sB > sA) ptsB += 2;
      else {
        ptsA += 1;
        ptsB += 1;
      }
      if (g.ot && sB > sA && aIsHome) ptsA += 1;
      if (g.ot && sA > sB && aIsAway) ptsB += 1;
    });
    return { ptsA, ptsB };
  }
  
  // Shared core for the W18+ tiebreaker rule: wins -> h2h pts (within win-tier)
  // -> h2h GD (within h2h-tier) -> season GD.
  // Takes a group of teams already tied on points, returns them in final seed order.
  // Every team is annotated with h2hPts/h2hGD computed against the FULL points-tied
  // group (for tooltip display), plus internal _tier* fields used only for sorting.
  export function orderTiedGroupV2(tierTeams, games) {
    const withDisplayStats = tierTeams.map((t) => {
      let h2hPts = 0;
      let h2hGD = 0;
      tierTeams.forEach((o) => {
        if (o.team === t.team) return;
        h2hPts += computeH2H(t.team, o.team, games).ptsA;
        games.forEach((g) => {
          const isHome = g.home === t.team && g.away === o.team;
          const isAway = g.home === o.team && g.away === t.team;
          if (!isHome && !isAway) return;
          const sT = isHome ? g.score_home : g.score_away;
          const sO = isHome ? g.score_away : g.score_home;
          h2hGD += sT - sO;
        });
      });
      return { ...t, h2hPts, h2hGD };
    });
  
    const byWins = groupBy(withDisplayStats, 'w');
    const winTiers = Object.keys(byWins).map(Number).sort((a, b) => b - a);
    const result = [];
  
    winTiers.forEach((w) => {
      const winGroup = byWins[w];
      if (winGroup.length === 1) {
        result.push(winGroup[0]);
        return;
      }
      const withTierH2HPts = winGroup.map((t) => ({
        ...t,
        _tierH2hPts: winGroup
          .filter((o) => o.team !== t.team)
          .reduce((sum, o) => sum + computeH2H(t.team, o.team, games).ptsA, 0),
      }));
  
      const byH2HPts = groupBy(withTierH2HPts, '_tierH2hPts');
      Object.keys(byH2HPts)
        .map(Number)
        .sort((a, b) => b - a)
        .forEach((hp) => {
          const h2hGroup = byH2HPts[hp];
          if (h2hGroup.length === 1) {
            result.push(h2hGroup[0]);
            return;
          }
          const withTierGD = h2hGroup.map((t) => {
            const tierGD = h2hGroup
              .filter((o) => o.team !== t.team)
              .reduce((acc, o) => {
                games.forEach((g) => {
                  const isHome = g.home === t.team && g.away === o.team;
                  const isAway = g.home === o.team && g.away === t.team;
                  if (!isHome && !isAway) return;
                  const sT = isHome ? g.score_home : g.score_away;
                  const sO = isHome ? g.score_away : g.score_home;
                  acc += sT - sO;
                });
                return acc;
              }, 0);
            return { ...t, _tierH2hGD: tierGD };
          });
          withTierGD.sort((a, b) => b._tierH2hGD - a._tierH2hGD || b.gd - a.gd);
          result.push(...withTierGD);
        });
    });
  
    return result;
  }
  
  // v2 Tiebreakers — W18+
  // Points -> wins -> h2h pts (within win-tier) -> h2h GD (within h2h-tier) -> season GD
  export function sortWithTiebreakersV2(teams, games) {
    const byPts = groupBy(teams, 'pts');
    return Object.entries(byPts)
      .sort(([a], [b]) => b - a)
      .flatMap(([, tier]) =>
        tier.length === 1 ? tier : orderTiedGroupV2(tier, games)
      );
  }
  
  export function computeStandings(games) {
    const teamMap = {};
    const ensureTeam = (code) => {
      if (!teamMap[code]) {
        teamMap[code] = {
          team: code,
          coach: '',
          gp: 0,
          w: 0,
          l: 0,
          t: 0,
          otl: 0,
          otw: 0,
          pts: 0,
          gf: 0,
          ga: 0,
          gd: 0,
          shutouts: 0,
          _lastId: -1,
        };
      }
      return teamMap[code];
    };
    games.forEach((g) => {
      const home = ensureTeam(g.home);
      const away = ensureTeam(g.away);
      const sh = g.score_home ?? 0;
      const sa = g.score_away ?? 0;
      const isOT = !!g.ot;
      if (g.id > home._lastId) {
        home.coach = g.coach_home || home.coach;
        home._lastId = g.id;
      }
      if (g.id > away._lastId) {
        away.coach = g.coach_away || away.coach;
        away._lastId = g.id;
      }
      if (!home._results) home._results = [];
      if (!away._results) away._results = [];
      home.gp++;
      away.gp++;
      home.gf += sh;
      home.ga += sa;
      away.gf += sa;
      away.ga += sh;
      if (sh === sa) {
        home.t++;
        away.t++;
        home.pts += 1;
        away.pts += 1;
        home._results.push('T');
        away._results.push('T');
      } else if (sh > sa) {
        if (isOT) {
          home.w++;
          home.otw++;
          home.pts += 2;
          away.otl++;
          away.pts += 1;
          home._results.push('W');
          away._results.push('L');
        } else {
          home.w++;
          home.pts += 2;
          away.l++;
          home._results.push('W');
          away._results.push('L');
        }
      } else {
        if (isOT) {
          away.w++;
          away.otw++;
          away.pts += 2;
          home.otl++;
          home.pts += 1;
          away._results.push('W');
          home._results.push('L');
        } else {
          away.w++;
          away.pts += 2;
          home.l++;
          away._results.push('W');
          home._results.push('L');
        }
      }
      if (sa === 0) home.shutouts++;
      if (sh === 0) away.shutouts++;
    });
  
    return Object.values(teamMap).map(({ _lastId, _results, ...t }) => {
      const results = _results || [];
      let streakType = null;
      let streakCount = 0;
      for (let i = results.length - 1; i >= 0; i--) {
        if (streakType === null) {
          streakType = results[i];
          streakCount = 1;
        } else if (results[i] === streakType) {
          streakCount++;
        } else {
          break;
        }
      }
      const streak = streakType ? `${streakType}${streakCount}` : '';
      const streakVal =
        streakType === 'W' || streakType === 'OTW'
          ? streakCount
          : streakType === 'L' || streakType === 'OTL'
          ? -streakCount
          : 0;
      return {
        ...t,
        gd: t.gf - t.ga,
        pts_pct: t.gp > 0 ? t.pts / (t.gp * 2) : 0,
        streak,
        streakType,
        streakCount,
        streakVal,
      };
    });
  }
  
  // Original tiebreakers - W1 - W17
  export function sortWithTiebreakers(teams, games) {
    const h2hCache = {};
    const getH2H = (a, b) => {
      const key = [a, b].sort().join('::');
      if (!h2hCache[key]) h2hCache[key] = computeH2H(a, b, games);
      return h2hCache[key];
    };
    const withH2H = (tierTeams) =>
      tierTeams.map((t) => {
        let h2hPts = 0;
        tierTeams.forEach((other) => {
          if (other.team === t.team) return;
          const { ptsA } = getH2H(t.team, other.team);
          h2hPts += ptsA;
        });
        return { ...t, _h2hPts: h2hPts };
      });
    const byPts = {};
    teams.forEach((t) => {
      const p = t.pts;
      if (!byPts[p]) byPts[p] = [];
      byPts[p].push(t);
    });
    const result = [];
    Object.keys(byPts)
      .map(Number)
      .sort((a, b) => b - a)
      .forEach((pts) => {
        const tier = byPts[pts];
        if (tier.length === 1) {
          result.push({ ...tier[0], _h2hPts: 0 });
        } else {
          const enriched = withH2H(tier);
          enriched.sort((a, b) => {
            if (b.gp !== a.gp && pts === 0) return b.gp - a.gp;
            if (b._h2hPts !== a._h2hPts) return b._h2hPts - a._h2hPts;
            if (b.w !== a.w) return b.w - a.w;
            return b.gd - a.gd;
          });
          result.push(...enriched);
        }
      }); 
    return result;
  } 
  
  export function groupBy(items, key) {
    return items.reduce((acc, item) => {
      const k = item[key];
      (acc[k] ||= []).push(item);
      return acc;
    }, {});
  }
  
  export function sortStandings(teams, games, ruleset) {
    return ruleset === 'v2_wins_h2h_gd'
      ? sortWithTiebreakersV2(teams, games)
      : sortWithTiebreakers(teams, games); // v1, untouched
  }
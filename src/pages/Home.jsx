async function fetchGazetteEdition({
  leagueLabel,
  recentForm,
  winStreaks,
  lossStreaks,
  currentSeason,
  teamNameMap,
  topScorers,
  recentGames,
  isPlayoffActive,
  playoffSeriesData,
  gameStats,
  managers,
  teams,
}) {
  const today = new Date().toISOString().split('T')[0];
  const season = currentSeason?.lg || leagueLabel;

  // ── Map manager_id → traits safely
  const traitsMap = (managers || []).reduce((acc, m) => {
    if (m?.manager_traits) {
      try {
        const key = m.id ?? m.coach_name; // fallback
        acc[key] =
          typeof m.manager_traits === 'string'
            ? JSON.parse(m.manager_traits)
            : m.manager_traits;
      } catch (err) {
        console.warn('[Gazette] Failed to parse traits for', m.coach_name, err);
      }
    }
    return acc;
  }, {});

  console.log('[Gazette] traitsMap keys:', Object.keys(traitsMap));
  console.log('[Gazette] traitsMap sample:', Object.values(traitsMap)[0] || {});

  // ── Map team_code → manager_id
  const teamManagerMap = (teams || []).reduce((acc, t) => {
    if (t.manager_id) acc[t.abr] = t.manager_id;
    return acc;
  }, {});

  // ── Cache key
  const cacheKey = isPlayoffActive ? `${leagueLabel}_playoff` : leagueLabel;

  // ── Try DB cache first
  try {
    const { data: cached } = await supabase
      .from('gazette_cache')
      .select('data, date')
      .eq('league', cacheKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (cached?.date === today && cached?.data) {
      console.log('[Gazette] ✅ Serving from DB cache');
      return cached.data;
    }
  } catch (e) {
    console.log('[Gazette] No DB cache found, generating live');
  }

  console.log('[Gazette] ⚠️ Cache miss — calling AI');

  const tn = (code) => teamNameMap[code] || { city: code, nickname: code, full: code };

  // ── Build streak lines
  const hotLines = (recentForm?.hot || [])
    .slice(0, 5)
    .map((t) => `${tn(t.team).full} [${t.team}]: ${t.w}W-${t.l}L last 10`)
    .join(' | ');
  const coldLines = (recentForm?.cold || [])
    .slice(0, 5)
    .map((t) => `${tn(t.team).full} [${t.team}]: ${t.w}W-${t.l}L last 10`)
    .join(' | ');
  const winLines = (winStreaks || [])
    .slice(0, 5)
    .map((s) => `${tn(s.team).full} [${s.team}]: W${s.count}`)
    .join(' | ');
  const lossLines = (lossStreaks || [])
    .slice(0, 5)
    .map((s) => `${tn(s.team).full} [${s.team}]: L${s.count}`)
    .join(' | ');

  // ── Top scorers
  const scorerLines = (topScorers || [])
    .slice(0, 6)
    .map((s) => {
      const n = tn(s.g_team);
      const ach = s.fourGoalGame
        ? ' 🔥 4-GOAL GAME'
        : s.hatTrick
        ? ' 🎩 HAT TRICK'
        : s.bigNight
        ? ' ⭐ BIG NIGHT'
        : '';
      const best =
        s.bestGame && s.bestGame.g + s.bestGame.a > 0
          ? ` (best game: ${s.bestGame.g}G ${s.bestGame.a}A)`
          : '';
      return `${s.goal_player_name} (${n.full} / ${s.g_team}): ${s.goals}G ${s.assists}A${best}${ach}`;
    })
    .join(' | ');

  // ── Recent games
  const gameLines = (recentGames || [])
    .slice(0, 8)
    .map((g) => {
      const home = tn(g.home).full;
      const away = tn(g.away).full;
      return `${home} ${g.score_home}-${g.score_away} ${away}${g.ot ? ' (OT)' : ''}`;
    })
    .join(' | ');

  // ── Name references
  const allCodes = [
    ...new Set([
      ...(recentForm?.hot || []).map((t) => t.team),
      ...(recentForm?.cold || []).map((t) => t.team),
      ...(winStreaks || []).map((s) => s.team),
      ...(lossStreaks || []).map((s) => s.team),
    ]),
  ];

  const nameRef = allCodes
    .map((code) => {
      const n = tn(code);
      return `${code} = "${n.full}" (city: ${n.city}, nickname: ${n.nickname}${
        n.coach ? `, coach: ${n.coach}` : ''
      })`;
    })
    .join('\n');

  // ── Playoff summary
  const playoffBlock =
    isPlayoffActive && playoffSeriesData?.length
      ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏒 PLAYOFF MODE — ACTIVE
${playoffSeriesData
  .map((s) => {
    const teamA = tn(s.team_code_a).full;
    const teamB = tn(s.team_code_b).full;
    const winsA = s.wins_a ?? 0;
    const winsB = s.wins_b ?? 0;
    const needed = Math.ceil((s.series_length ?? 7) / 2);
    const leader = winsA > winsB ? teamA : winsB > winsA ? teamB : null;
    const advanced = winsA >= needed ? teamA : winsB >= needed ? teamB : null;
    const statusLine = advanced
      ? `🏆 ${advanced} ADVANCES to Round ${s.round + 1}!`
      : leader
      ? `${leader} leads ${Math.max(winsA, winsB)}-${Math.min(winsA, winsB)}`
      : `Series tied ${winsA}-${winsB}`;
    return `Round ${s.round} | ${teamA} vs ${teamB} | ${statusLine}`;
  })
  .join('\n')}
- If a team just clinched a series (ADVANCES), that is THE lead story — cover_line must reflect it.
- Use story_type "milestone" for a clinch, "playoff_push" for a close series lead.
- Reference round numbers and series scores in your writing.`
      : '';

  const relevantTeams = [
    ...new Set([
      ...(recentForm?.hot || []).map((t) => t.team),
      ...(recentForm?.cold || []).map((t) => t.team),
      ...(winStreaks || []).map((s) => s.team),
      ...(lossStreaks || []).map((s) => s.team),
      ...(playoffSeriesData || []).flatMap((s) => [s.team_code_a, s.team_code_b]),
    ]),
  ];

  // ── Build traits lines safely
  const traitsLines =
    relevantTeams
      .map((code) => {
        const managerId = teamManagerMap[code];
        const traits = traitsMap[managerId];
        const coachName = (teams.find((t) => t.abr === code) ?? {}).coach ?? 'Unknown';

        if (!traits) return null;

        const teamName = teamNameMap[code]?.full || code;
        return `${teamName} (${code}) — coached by ${coachName}, who is a ${traits.media}, ${traits.style} strategist with a ${traits.philosophy} philosophy and a ${traits.temperament} temperament.`;
      })
      .filter(Boolean)
      .join('\n') || 'No traits available';

  console.log('[Gazette] Traits lines:\n', traitsLines);

  // ── Build prompt
  const angles = [
    'hot_streak',
    'win_streak',
    'cold_streak',
    'loss_streak',
    'big_win',
    'playoff_push',
    'milestone',
    'comeback',
    'rivalry',
  ];
  const angleHint = angles[new Date().getDate() % angles.length];

  const prompt = `You are the sharp-tongued editor of ${leagueLabel} MAGAZINE for season ${season}.
Today's story angle: "${isPlayoffActive ? 'PLAYOFF ACTION' : angleHint}".
${playoffBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
  TEAM TRAITS
${traitsLines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEAM NAME REFERENCE
Use the city name OR the nickname in all written text — never the raw code.
${nameRef}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
LIVE LEAGUE DATA
Hot teams (last 10): ${hotLines || 'none'}
Cold teams (last 10): ${coldLines || 'none'}
Active win streaks: ${winLines || 'none'}
Active loss streaks: ${lossLines || 'none'}
${scorerLines ? `Recent game top scorers: ${scorerLines}` : ''}
${
  gameLines
    ? `Recent results (use EXACTLY — never invent scores or matchups): ${gameLines}`
    : 'No games in last 24 hours.'
}
${
  gameStats
    ? `\nDetailed game stats (USE THESE ONLY — never invent stats not listed here):\n${gameStats}`
    : ''
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
WRITING RULES
- Use city OR nickname in all written text — never raw codes. Mix it up naturally.
- When a coach is listed, you MAY quote them by name. Use coach name in quote_attr when it makes sense.
- If a scorer has 🎩 HAT TRICK or 🔥 4-GOAL GAME, that IS the story — lead the cover with it.
- If a scorer has ⭐ BIG NIGHT, mention them prominently in a blurb.
- Pull quote: if a hat trick or 4-goal game happened, quote that player or their coach.
- Be dramatic and hyperbolic — this is a sports magazine.
- NEVER invent statistics. Only mention saves, shots, hits, faceoffs, or power play numbers if they appear in the game stats block above.
- ENSURE the manager traits are used in the quote or bottom line

━━━━━━━━━━━━━━━━━━━━━━━━━━━
Respond ONLY with valid JSON, zero other text:
{
"featured_team": "ONE team code from the reference list above — use exact code",
"story_type": "one of: hot_streak|win_streak|cold_streak|loss_streak|big_win|elimination|playoff_push|milestone|comeback|rivalry|idle",
"cover_line": "3-6 ALL CAPS words. Punchy magazine cover.",
"cover_sub": "12-18 words. Punchy supporting line.",
"blurb_1": { "tag": "2-3 ALL CAPS words", "headline": "6-9 words", "detail": "8-12 words" },
"blurb_2": { "tag": "2-3 ALL CAPS WORDS", "headline": "6-9 words", "detail": "8-12 words" },
"blurb_3": { "tag": "2-3 ALL CAPS WORDS", "headline": "6-9 words", "detail": "8-12 words" },
"pull_quote": "12-20 words. Dramatic fake quote.",
"quote_attr": "— [Coach or player name], Role, ${leagueLabel}",
"bottom_line": "7-11 words. Use the manager traits for tone.",
"edition": "Vol. ${Math.floor(Math.random() * 30) + 1} · Issue ${Math.floor(Math.random() * 80) + 1}"
}`;

  // ── Call the AI
  const result = await supabase.functions.invoke('gazette-generate', {
    body: { messages: [{ role: 'user', content: prompt }] },
  });

  if (result.error) throw new Error(result.error.message);

  const raw =
    result.data?.text || result.data?.message?.content?.[0]?.text || '';
  const match = raw.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in response');
  const data = JSON.parse(match[0]);

  // ── Write back to DB cache
  try {
    await supabase.from('gazette_cache').upsert({
      league: cacheKey,
      date: today,
      data,
    });
    console.log('[Gazette] ✅ Written to DB cache');
  } catch (e) {
    console.warn('[Gazette] Failed to write to DB cache:', e);
  }

  return data;
}

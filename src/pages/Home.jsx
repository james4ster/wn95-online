// ── Add traits for featured SUM team ───────────────────────────
const traitsBlock =
  isPlayoffActive && traitsMap?.['SUM']
    ? `
━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEAM TRAITS — SUM
SUM (${teamNameMap['SUM']?.full || 'Sumter Trash'}):
${Object.entries(traitsMap['SUM'])
  .map(([trait, value]) => `- ${trait}: ${value}`)
  .join('\n')}`
    : '';

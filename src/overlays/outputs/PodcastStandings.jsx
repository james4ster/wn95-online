import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../../utils/supabaseClient'

const SEASON = 'W17'
const LEAGUE = 'W'
const PLAYOFF_CUTOFF = 16 // adjust to match your league

// ─── Pure logic (ported from Standings.jsx) ──────────────────────────────────

function computeH2H(teamA, teamB, games) {
  let ptsA = 0, ptsB = 0
  ;(games || []).forEach((g) => {
    const aIsHome = g.home === teamA && g.away === teamB
    const aIsAway = g.home === teamB && g.away === teamA
    if (!aIsHome && !aIsAway) return
    const sA = aIsHome ? g.score_home : g.score_away
    const sB = aIsHome ? g.score_away : g.score_home
    if (sA > sB) ptsA += 2
    else if (sB > sA) ptsB += 2
    else { ptsA += 1; ptsB += 1 }
    if (g.ot && sB > sA && aIsHome) ptsA += 1
    if (g.ot && sA > sB && aIsAway) ptsB += 1
  })
  return { ptsA, ptsB }
}

function computeStandings(games) {
  const teamMap = {}
  const ensure = (code) => {
    if (!teamMap[code]) teamMap[code] = {
      team: code, gp: 0, w: 0, l: 0, t: 0, otl: 0, otw: 0,
      pts: 0, gf: 0, ga: 0, shutouts: 0, _results: [], _lastId: -1,
    }
    return teamMap[code]
  }
  games.forEach((g) => {
    const home = ensure(g.home)
    const away = ensure(g.away)
    const sh = g.score_home ?? 0
    const sa = g.score_away ?? 0
    const isOT = !!g.ot
    home.gp++; away.gp++
    home.gf += sh; home.ga += sa
    away.gf += sa; away.ga += sh
    if (sh === sa) {
      home.t++; away.t++; home.pts++; away.pts++
      home._results.push('T'); away._results.push('T')
    } else if (sh > sa) {
      if (isOT) {
        home.w++; home.otw++; home.pts += 2; away.otl++; away.pts++
        home._results.push('OTW'); away._results.push('OTL')
      } else {
        home.w++; home.pts += 2; away.l++
        home._results.push('W'); away._results.push('L')
      }
    } else {
      if (isOT) {
        away.w++; away.otw++; away.pts += 2; home.otl++; home.pts++
        away._results.push('OTW'); home._results.push('OTL')
      } else {
        away.w++; away.pts += 2; home.l++
        away._results.push('W'); home._results.push('L')
      }
    }
    if (sa === 0) home.shutouts++
    if (sh === 0) away.shutouts++
  })
  return Object.values(teamMap).map(({ _lastId, _results, ...t }) => {
    const results = _results || []
    let streakType = null, streakCount = 0
    for (let i = results.length - 1; i >= 0; i--) {
      if (!streakType) { streakType = results[i]; streakCount = 1 }
      else if (results[i] === streakType) streakCount++
      else break
    }
    return {
      ...t,
      gd: t.gf - t.ga,
      pts_pct: t.gp > 0 ? t.pts / (t.gp * 2) : 0,
      streak: streakType ? `${streakType}${streakCount}` : '',
      streakType, streakCount,
      streakVal: (streakType === 'W' || streakType === 'OTW') ? streakCount
        : (streakType === 'L' || streakType === 'OTL') ? -streakCount : 0,
    }
  })
}

function sortWithTiebreakers(teams, games) {
  const h2hCache = {}
  const getH2H = (a, b) => {
    const key = [a, b].sort().join('::')
    if (!h2hCache[key]) h2hCache[key] = computeH2H(a, b, games)
    return h2hCache[key]
  }
  const withH2H = (tier) => tier.map((t) => {
    let h2hPts = 0
    tier.forEach((o) => {
      if (o.team === t.team) return
      const { ptsA } = getH2H(t.team, o.team)
      h2hPts += ptsA
    })
    return { ...t, _h2hPts: h2hPts }
  })
  const byPts = {}
  teams.forEach((t) => { if (!byPts[t.pts]) byPts[t.pts] = []; byPts[t.pts].push(t) })
  const result = []
  Object.keys(byPts).map(Number).sort((a, b) => b - a).forEach((pts) => {
    const tier = byPts[pts]
    if (tier.length === 1) { result.push({ ...tier[0], _h2hPts: 0 }); return }
    const enriched = withH2H(tier)
    enriched.sort((a, b) => {
      if (b._h2hPts !== a._h2hPts) return b._h2hPts - a._h2hPts
      if (b.w !== a.w) return b.w - a.w
      return b.gd - a.gd
    })
    result.push(...enriched)
  })
  return result
}

function computeClinchElim(sorted, playoffTeams, totalGP) {
  const clinched = new Set(), eliminated = new Set()
  if (!playoffTeams || !totalGP || sorted.length === 0) return { clinched, eliminated }
  const n = sorted.length
  const maxPts = (t) => (t.pts || 0) + Math.max(0, totalGP - (t.gp || 0)) * 2
  const bubblePts = sorted[Math.min(playoffTeams - 1, n - 1)]?.pts || 0
  for (let r = 0; r < Math.min(playoffTeams, n); r++) {
    const myPts = sorted[r].pts || 0
    let couldFinishAbove = 0
    for (let j = playoffTeams; j < n; j++) {
      if (maxPts(sorted[j]) > myPts) couldFinishAbove++
    }
    if (couldFinishAbove < playoffTeams - r) clinched.add(sorted[r].team)
  }
  for (let r = playoffTeams; r < n; r++) {
    if (maxPts(sorted[r]) < bubblePts) eliminated.add(sorted[r].team)
  }
  return { clinched, eliminated }
}

// ─── Tiebreaker tooltip (broadcast-styled) ───────────────────────────────────

function TiebreakerPanel({ tiedStandings, games, anchorIdx, totalRows }) {
  if (!tiedStandings || tiedStandings.length < 2) return null

  const enriched = tiedStandings.map((s) => {
    let h2hPts = 0
    tiedStandings.forEach((o) => {
      if (o.team === s.team) return
      const { ptsA } = computeH2H(s.team, o.team, games)
      h2hPts += ptsA
    })
    return { ...s, h2hPts }
  }).sort((a, b) => {
    if (b.h2hPts !== a.h2hPts) return b.h2hPts - a.h2hPts
    if (b.w !== a.w) return b.w - a.w
    return b.gd - a.gd
  })

  const maxH2H = Math.max(...enriched.map(r => r.h2hPts), 1)

  // Position: show above or below depending on row position
  const showAbove = anchorIdx > totalRows / 2

  return (
    <div style={{
      position: 'absolute',
      right: -320,
      top: showAbove ? 'auto' : 0,
      bottom: showAbove ? 0 : 'auto',
      width: 300,
      zIndex: 200,
      pointerEvents: 'none',
    }}>
      {/* glow bg */}
      <div style={{
        position: 'absolute', inset: -6,
        background: 'radial-gradient(ellipse, rgba(204,26,26,0.2) 0%, transparent 70%)',
        borderRadius: 12,
      }} />
      <div style={{
        background: 'linear-gradient(155deg, rgba(8,4,4,0.98) 0%, rgba(20,8,8,0.98) 100%)',
        border: '1px solid rgba(204,26,26,0.6)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px rgba(204,26,26,0.15), 0 8px 32px rgba(0,0,0,0.9), 0 0 30px rgba(204,26,26,0.15)',
      }}>
        {/* Header */}
        <div style={{
          padding: '8px 14px',
          borderBottom: '1px solid rgba(204,26,26,0.2)',
          background: 'linear-gradient(90deg, rgba(204,26,26,0.15) 0%, transparent 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 10, fontWeight: 900,
            color: '#cc1a1a', letterSpacing: '0.2em',
          }}>TIEBREAKER</div>
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em',
          }}>{enriched.length} TEAMS · {enriched[0].pts} PTS</div>
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '28px 1fr 44px 40px 44px',
          gap: '0 4px', padding: '5px 14px 3px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          {['#', '', 'H2H', 'W', 'GD'].map((h, i) => (
            <div key={i} style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 9, fontWeight: 700,
              color: i === 0 ? 'transparent' : 'rgba(255,255,255,0.3)',
              letterSpacing: '0.15em', textAlign: i > 1 ? 'center' : 'left',
            }}>{h}</div>
          ))}
        </div>

        {/* Rows */}
        {enriched.map((row, idx) => {
          const gdSign = row.gd > 0 ? '+' : ''
          const isFirst = idx === 0
          return (
            <div key={row.team} style={{
              display: 'grid', gridTemplateColumns: '28px 1fr 44px 40px 44px',
              gap: '0 4px', padding: '8px 14px',
              background: isFirst ? 'rgba(204,26,26,0.08)' : idx % 2 === 0 ? 'rgba(255,255,255,0.015)' : 'transparent',
              borderBottom: idx < enriched.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              alignItems: 'center',
            }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 16, fontWeight: 900,
                color: isFirst ? '#cc1a1a' : 'rgba(255,255,255,0.25)',
                lineHeight: 1,
              }}>{idx + 1}</div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <img
                    src={`/assets/teamLogos/${row.team}.png`}
                    alt={row.team}
                    style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }}
                    onError={e => e.target.style.display = 'none'}
                  />
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 14, fontWeight: 700,
                    color: isFirst ? '#fff' : '#aaa',
                    letterSpacing: '0.05em',
                  }}>{row.team}</span>
                </div>
                {/* H2H bar */}
                <div style={{ height: 2, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.max(4, (row.h2hPts / maxH2H) * 100)}%`,
                    background: isFirst ? '#cc1a1a' : 'rgba(255,255,255,0.2)',
                    borderRadius: 1,
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>

              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 16, fontWeight: 700, textAlign: 'center',
                color: isFirst ? '#cc1a1a' : 'rgba(255,255,255,0.5)',
              }}>{row.h2hPts}</div>

              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 16, fontWeight: 700, textAlign: 'center',
                color: 'rgba(255,255,255,0.5)',
              }}>{row.w}</div>

              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 16, fontWeight: 700, textAlign: 'center',
                color: row.gd > 0 ? '#22c55e' : row.gd < 0 ? '#ef4444' : '#555',
              }}>{gdSign}{row.gd}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PodcastStandings() {
  const [rawGames, setRawGames] = useState([])
  const [seasonTeams, setSeasonTeams] = useState([])
  const [totalGamesPerTeam, setTotalGamesPerTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hoveredTeam, setHoveredTeam] = useState(null)
  const [hoveredIdx, setHoveredIdx] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [{ data: games }, { data: teams }, { data: seasons }] = await Promise.all([
        supabase.from('games')
          .select('id, home, away, score_home, score_away, ot')
          .eq('lg', SEASON)
          .ilike('mode', 'season')
          .not('score_home', 'is', null)
          .order('id', { ascending: true }),
        supabase.from('teams').select('abr, coach').eq('lg', SEASON),
        supabase.from('seasons').select('rs_games_vs').eq('lg', SEASON).single(),
      ])
      setRawGames(games || [])
      setSeasonTeams(teams || [])
      const numTeams = (teams || []).length
      const rsVs = seasons?.rs_games_vs ?? null
      if (rsVs != null && numTeams > 0) setTotalGamesPerTeam((numTeams - 1) * rsVs)
      setLoading(false)
    }
    load()
  }, [])

  const computedStandings = useMemo(() => {
    const standings = computeStandings(rawGames)
    const played = new Set(standings.map(s => s.team))
    const zeroed = seasonTeams
      .filter(({ abr }) => !played.has(abr))
      .map(({ abr, coach }) => ({
        team: abr, coach: coach || '', gp: 0, w: 0, l: 0, t: 0,
        otl: 0, otw: 0, pts: 0, gf: 0, ga: 0, gd: 0, shutouts: 0,
        pts_pct: 0, streak: '', streakType: null, streakCount: 0, streakVal: 0,
      }))
    return [...standings, ...zeroed].map(s => {
      const gr = totalGamesPerTeam != null ? Math.max(0, totalGamesPerTeam - (s.gp || 0)) : null
      return { ...s, gr, maxPts: gr != null ? s.pts + gr * 2 : null }
    })
  }, [rawGames, seasonTeams, totalGamesPerTeam])

  const sorted = useMemo(() =>
    sortWithTiebreakers(computedStandings, rawGames).map((s, i) => ({ ...s, _sortRank: i + 1 })),
    [computedStandings, rawGames]
  )

  const { clinched, eliminated } = useMemo(() =>
    computeClinchElim(sorted, PLAYOFF_CUTOFF, totalGamesPerTeam),
    [sorted, totalGamesPerTeam]
  )

  const tiedPtsSet = useMemo(() => {
    const counts = {}
    sorted.forEach(s => { const p = Number(s.pts); if (!counts[p]) counts[p] = []; counts[p].push(s) })
    const result = new Set()
    Object.entries(counts).forEach(([p, teams]) => {
      if (teams.length < 2) return
      if (teams.some(t => (t.gr ?? 999) <= 10) && teams.some(t => (t.gp || 0) > 0))
        result.add(Number(p))
    })
    return result
  }, [sorted, totalGamesPerTeam])

  const handleMouseEnter = useCallback((team, pts, idx) => {
    if (!tiedPtsSet.has(Number(pts))) return
    setHoveredTeam(team)
    setHoveredIdx(idx)
  }, [tiedPtsSet])

  const handleMouseLeave = useCallback(() => {
    setHoveredTeam(null)
    setHoveredIdx(null)
  }, [])

  if (loading) return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: '#cc1a1a', letterSpacing: '0.2em' }}>
        LOADING...
      </div>
    </div>
  )

  const COLS = [
    { key: 'rank',   label: '#',    w: 36 },
    { key: 'team',   label: 'TEAM', w: 180 },
    { key: 'gp',     label: 'GP',   w: 48 },
    { key: 'w',      label: 'W',    w: 48 },
    { key: 'l',      label: 'L',    w: 48 },
    { key: 'otl',    label: 'OTL',  w: 52 },
    { key: 'pts',    label: 'PTS',  w: 60 },
    { key: 'pts_pct',label: 'PCT',  w: 64 },
    { key: 'gf',     label: 'GF',   w: 52 },
    { key: 'ga',     label: 'GA',   w: 52 },
    { key: 'gd',     label: 'GD',   w: 60 },
    { key: 'streak', label: 'STRK', w: 64 },
    { key: 'gr',     label: 'GR',   w: 48 },
  ]

  const totalW = COLS.reduce((s, c) => s + c.w, 0)

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,900;1,700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes bnb-row-in {
          from { opacity: 0; transform: translateX(-12px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes bnb-clinch-pulse {
          0%,100% { box-shadow: 0 0 6px rgba(34,197,94,0.5); border-color: rgba(34,197,94,0.6); }
          50%     { box-shadow: 0 0 14px rgba(34,197,94,0.9); border-color: rgba(34,197,94,1); }
        }
        @keyframes bnb-tied-corner {
          0%,100% { border-color: transparent rgba(204,26,26,0.7) transparent transparent; }
          50%     { border-color: transparent rgba(255,80,80,1) transparent transparent; }
        }
        .bnb-row { animation: bnb-row-in 0.3s ease both; }
        .bnb-row:hover .bnb-logo { transform: scale(1.15); filter: drop-shadow(0 0 6px rgba(204,26,26,0.8)) !important; }
      `}</style>

      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        padding: '16px 24px 12px',
        boxSizing: 'border-box',
        fontFamily: "'Barlow Condensed', sans-serif",
        overflow: 'hidden',
      }}>

        {/* ── Section header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexShrink: 0,
        }}>
          <div style={{ width: 3, height: 28, background: '#cc1a1a', borderRadius: 2 }} />
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '0.18em' }}>
            STANDINGS
          </div>
          <div style={{ fontSize: 12, color: '#cc1a1a', letterSpacing: '0.2em', fontWeight: 700, marginTop: 2 }}>
            {SEASON}
          </div>
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(204,26,26,0.4), transparent)' }} />
          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
              <span style={{ fontSize: 9, color: '#555', letterSpacing: '0.15em' }}>CLINCHED</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#cc1a1a' }} />
              <span style={{ fontSize: 9, color: '#555', letterSpacing: '0.15em' }}>TIEBREAKER</span>
            </div>
          </div>
        </div>

        {/* ── Table header ── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: COLS.map(c => `${c.w}px`).join(' '),
          background: '#cc1a1a',
          borderRadius: '3px 3px 0 0',
          padding: '0 4px',
          flexShrink: 0,
          clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 100%, 0 100%)',
        }}>
          {COLS.map(col => (
            <div key={col.key} style={{
              padding: '7px 6px',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: col.key === 'team' ? 9 : 9,
              fontWeight: 900,
              color: col.key === 'pts' ? '#fff' : 'rgba(255,255,255,0.85)',
              letterSpacing: '0.15em',
              textAlign: col.key === 'rank' || col.key === 'team' ? 'left' : 'center',
            }}>{col.label}</div>
          ))}
        </div>

        {/* ── Rows ── */}
        <div style={{ flex: 1, overflowY: 'hidden', position: 'relative' }}>
          {sorted.map((s, idx) => {
            const isTied = tiedPtsSet.has(Number(s.pts))
            const isClinched = clinched.has(s.team)
            const isElim = eliminated.has(s.team)
            const isHovered = hoveredTeam === s.team
            const isPlayoff = idx < PLAYOFF_CUTOFF
            const isCutoff = idx === PLAYOFF_CUTOFF - 1
            const gdSign = s.gd > 0 ? '+' : ''
            const tiedTeams = isTied ? sorted.filter(t => Number(t.pts) === Number(s.pts)) : []

            const rowBg = isHovered
              ? 'rgba(204,26,26,0.12)'
              : idx % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent'

            return (
              <div key={s.team}>
                <div
                  className="bnb-row"
                  onMouseEnter={() => handleMouseEnter(s.team, s.pts, idx)}
                  onMouseLeave={handleMouseLeave}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: COLS.map(c => `${c.w}px`).join(' '),
                    background: rowBg,
                    padding: '0 4px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    alignItems: 'center',
                    cursor: isTied ? 'default' : 'default',
                    animationDelay: `${idx * 0.03}s`,
                    position: 'relative',
                    transition: 'background 0.15s',
                    minHeight: 46,
                  }}
                >
                  {/* Playoff side accent */}
                  {isPlayoff && (
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
                      background: isClinched ? '#22c55e' : 'rgba(204,26,26,0.5)',
                      boxShadow: isClinched ? '0 0 6px #22c55e' : 'none',
                    }} />
                  )}

                  {/* RANK */}
                  <div style={{
                    fontSize: 13, fontWeight: 900,
                    color: isPlayoff ? (isClinched ? '#22c55e' : '#cc1a1a') : '#333',
                    paddingLeft: 8, letterSpacing: '0.05em',
                  }}>{idx + 1}</div>

                  {/* TEAM */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', paddingLeft: 2 }}>
                    {/* Banner bg */}
                    <div style={{
                      position: 'absolute', left: 0, right: 0, top: 0, bottom: 0,
                      overflow: 'hidden', pointerEvents: 'none',
                    }}>
                      <img
                        src={`/assets/banners/${s.team}.png`}
                        alt=""
                        style={{
                          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                          height: '130%', width: 'auto', objectFit: 'contain',
                          opacity: 0.12, filter: 'saturate(0.5)',
                          maskImage: 'linear-gradient(to right, rgba(0,0,0,0.9) 0%, transparent 100%)',
                          WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0.9) 0%, transparent 100%)',
                        }}
                        onError={e => e.target.style.display = 'none'}
                      />
                    </div>

                    {/* Logo */}
                    <div style={{
                      width: 30, height: 30, flexShrink: 0, position: 'relative', zIndex: 1,
                      border: isClinched
                        ? '1.5px solid rgba(34,197,94,0.7)'
                        : isElim
                          ? '1.5px solid rgba(239,68,68,0.4)'
                          : '1.5px solid rgba(255,255,255,0.1)',
                      borderRadius: 4,
                      background: 'rgba(0,0,0,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      animation: isClinched ? 'bnb-clinch-pulse 2.4s ease-in-out infinite' : 'none',
                    }}>
                      <img
                        className="bnb-logo"
                        src={`/assets/teamLogos/${s.team}.png`}
                        alt={s.team}
                        style={{
                          width: 24, height: 24, objectFit: 'contain',
                          filter: isElim ? 'saturate(0.3) brightness(0.6)' : 'none',
                          transition: 'all 0.2s ease',
                        }}
                        onError={e => e.target.style.display = 'none'}
                      />
                    </div>

                    {/* Team code */}
                    <span style={{
                      fontSize: 16, fontWeight: 700,
                      color: isElim ? '#333' : '#fff',
                      letterSpacing: '0.08em', position: 'relative', zIndex: 1,
                    }}>{s.team}</span>

                    {/* Tiebreaker indicator */}
                    {isTied && (
                      <div style={{
                        position: 'absolute', top: 0, right: 0,
                        width: 0, height: 0,
                        borderStyle: 'solid',
                        borderWidth: '0 8px 8px 0',
                        borderColor: 'transparent #cc1a1a transparent transparent',
                        animation: 'bnb-tied-corner 1.5s ease-in-out infinite',
                      }} />
                    )}

                    {/* Tiebreaker tooltip */}
                    {isHovered && isTied && (
                      <TiebreakerPanel
                        tiedStandings={tiedTeams}
                        games={rawGames}
                        anchorIdx={idx}
                        totalRows={sorted.length}
                      />
                    )}
                  </div>

                  {/* GP */}
                  <StatCell value={s.gp} />
                  {/* W */}
                  <StatCell value={s.w} />
                  {/* L */}
                  <StatCell value={s.l} dim />
                  {/* OTL */}
                  <StatCell value={s.otl} dim />

                  {/* PTS — highlighted */}
                  <div style={{
                    textAlign: 'center', fontSize: 18, fontWeight: 900,
                    color: isTied ? '#ff6060' : isPlayoff ? '#fff' : '#666',
                    letterSpacing: '0.05em',
                    textShadow: isPlayoff && !isTied ? '0 0 10px rgba(255,255,255,0.2)' : 'none',
                  }}>{s.pts}</div>

                  {/* PCT */}
                  <div style={{
                    textAlign: 'center', fontSize: 13, fontWeight: 600,
                    color: 'rgba(255,255,255,0.35)', letterSpacing: '0.02em',
                  }}>{s.gp > 0 ? (s.pts / (s.gp * 2)).toFixed(3) : '.000'}</div>

                  {/* GF */}
                  <StatCell value={s.gf} />
                  {/* GA */}
                  <StatCell value={s.ga} dim />

                  {/* GD */}
                  <div style={{
                    textAlign: 'center', fontSize: 14, fontWeight: 700,
                    color: s.gd > 0 ? '#22c55e' : s.gd < 0 ? '#ef4444' : '#444',
                    letterSpacing: '0.05em',
                  }}>{gdSign}{s.gd}</div>

                  {/* STREAK */}
                  <div style={{
                    textAlign: 'center', fontSize: 14, fontWeight: 700,
                    letterSpacing: '0.05em',
                    color: (s.streakType === 'W' || s.streakType === 'OTW') ? '#22c55e'
                      : (s.streakType === 'L' || s.streakType === 'OTL') ? '#ef4444'
                      : '#555',
                  }}>{s.streak || '—'}</div>

                  {/* GR */}
                  <div style={{
                    textAlign: 'center', fontSize: 13, fontWeight: 600,
                    color: s.gr === 0 ? '#cc1a1a' : 'rgba(255,255,255,0.25)',
                  }}>{s.gr ?? '—'}</div>
                </div>

                {/* Playoff cutoff line */}
                {isCutoff && (
                  <div style={{ position: 'relative', height: 2, margin: '0', flexShrink: 0 }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(90deg, transparent, rgba(204,26,26,0.8) 20%, rgba(204,26,26,0.8) 80%, transparent)',
                    }} />
                    <div style={{
                      position: 'absolute', left: '50%', top: '50%',
                      transform: 'translate(-50%, -50%)',
                      background: '#0a0a0a',
                      padding: '0 12px',
                      fontSize: 8, fontWeight: 900, color: '#cc1a1a',
                      letterSpacing: '0.25em', whiteSpace: 'nowrap',
                    }}>PLAYOFF LINE</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function StatCell({ value, dim }) {
  return (
    <div style={{
      textAlign: 'center', fontSize: 15, fontWeight: 600,
      color: dim ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)',
      letterSpacing: '0.03em',
    }}>{value ?? '—'}</div>
  )
}

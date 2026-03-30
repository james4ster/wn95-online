import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { supabase } from '../../utils/supabaseClient'

const PLAYOFF_CUTOFF = 16

// ─── Pure logic ───────────────────────────────────────────────────────────────

function computeH2H(teamA, teamB, games) {
  let wA = 0, wB = 0, gfA = 0, gfB = 0
  ;(games || []).forEach((g) => {
    const aIsHome = g.home === teamA && g.away === teamB
    const aIsAway = g.home === teamB && g.away === teamA
    if (!aIsHome && !aIsAway) return
    const sA = aIsHome ? g.score_home : g.score_away
    const sB = aIsHome ? g.score_away : g.score_home
    gfA += sA; gfB += sB
    if (sA > sB) wA++
    else if (sB > sA) wB++
  })
  return { wA, wB, gfA, gfB }
}

function computeH2HPts(teamA, teamB, games) {
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
      pts: 0, gf: 0, ga: 0, shutouts: 0, _results: [],
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
  return Object.values(teamMap).map(({ _results, ...t }) => {
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
    }
  })
}

function sortWithTiebreakers(teams, games) {
  const h2hCache = {}
  const getH2HPts = (a, b) => {
    const key = [a, b].sort().join('::')
    if (!h2hCache[key]) h2hCache[key] = computeH2HPts(a, b, games)
    return h2hCache[key]
  }
  const withH2H = (tier) => tier.map((t) => {
    let h2hPts = 0
    tier.forEach((o) => {
      if (o.team === t.team) return
      const { ptsA } = getH2HPts(t.team, o.team)
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

// ─── Clinch/Elim: correct logic ──────────────────────────────────────────────
// A team is CLINCHED if no team outside the top N can mathematically overtake them.
// A team is ELIMINATED if their max possible points < the current bubble pts.

function computeClinchElim(sorted, playoffTeams, totalGP) {
  const clinched = new Set()
  const eliminated = new Set()
  if (!playoffTeams || !totalGP || sorted.length === 0) return { clinched, eliminated }

  const n = sorted.length
  const maxPts = (t) => (t.pts || 0) + Math.max(0, totalGP - (t.gp || 0)) * 2

  // The "bubble" — the team currently at the last playoff spot
  const bubbleTeam = sorted[Math.min(playoffTeams - 1, n - 1)]
  const bubblePts = bubbleTeam?.pts || 0

  for (let r = 0; r < n; r++) {
    const team = sorted[r]
    if (r < playoffTeams) {
      // Check if any outside team can surpass this team's pts
      let threatsAbove = 0
      for (let j = playoffTeams; j < n; j++) {
        if (maxPts(sorted[j]) >= team.pts) threatsAbove++
      }
      // Clinched if fewer outside teams can pass me than spots ahead of me + 1
      if (threatsAbove < playoffTeams - r) {
        clinched.add(team.team)
      }
    } else {
      // Eliminated: my max points can't reach the current bubble pts
      if (maxPts(team) < bubblePts) {
        eliminated.add(team.team)
      }
    }
  }
  return { clinched, eliminated }
}

// ─── Schedule Hover Panel ────────────────────────────────────────────────────

function ScheduleHoverPanel({ team, remainingGames, allGames, allTimeRecords, idx, totalRows }) {
  if (!team || !remainingGames) return null

  const showLeft = false // always show to left of logo area for this layout

  const opponents = remainingGames.map(g => {
    const opp = g.home === team ? g.away : g.home
    const isHome = g.home === team

    // All time record vs this opponent
    const { wA, wB, gfA, gfB } = computeH2H(team, opp, allGames)

    return { opp, isHome, w: wA, l: wB, gfA, gfB }
  })

  // Group by opponent
  const oppMap = {}
  opponents.forEach(({ opp, isHome, w, l, gfA, gfB }) => {
    if (!oppMap[opp]) oppMap[opp] = { opp, games: 0, isHome, w, l, gfA, gfB }
    oppMap[opp].games++
  })
  const oppList = Object.values(oppMap)

  const showAbove = idx >= totalRows / 2

  return (
    <div style={{
      position: 'absolute',
      right: 'calc(100% + 12px)',
      top: showAbove ? 'auto' : -8,
      bottom: showAbove ? -8 : 'auto',
      width: 320,
      zIndex: 500,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'linear-gradient(160deg, #0f0505 0%, #120a0a 100%)',
        border: '1px solid rgba(204,26,26,0.5)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px rgba(204,26,26,0.1), 0 12px 40px rgba(0,0,0,0.95), 0 0 40px rgba(204,26,26,0.1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '10px 16px',
          borderBottom: '1px solid rgba(204,26,26,0.2)',
          background: 'rgba(204,26,26,0.12)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <img src={`/assets/teamLogos/${team}.png`} alt={team}
            style={{ width: 28, height: 28, objectFit: 'contain' }}
            onError={e => e.target.style.display = 'none'} />
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '0.12em' }}>
              {team} REMAINING
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: '#cc1a1a', letterSpacing: '0.2em', marginTop: 1 }}>
              {opponents.length} GAMES LEFT · ALL-TIME H2H
            </div>
          </div>
        </div>

        {/* Column headers */}
        <div style={{
          display: 'grid', gridTemplateColumns: '36px 1fr 80px 60px',
          padding: '5px 14px 4px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          {['', 'OPP', 'RECORD', 'GF-GA'].map((h, i) => (
            <div key={i} style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 9, fontWeight: 900, color: '#cc1a1a',
              letterSpacing: '0.18em', textAlign: i > 1 ? 'center' : 'left',
            }}>{h}</div>
          ))}
        </div>

        {/* Opponent rows */}
        {oppList.map(({ opp, games, w, l, gfA, gfB }, i) => {
          const record = `${w}-${l}`
          const isWinning = w > l
          const isLosing = l > w
          return (
            <div key={opp} style={{
              display: 'grid', gridTemplateColumns: '36px 1fr 80px 60px',
              padding: '8px 14px',
              alignItems: 'center',
              background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
              borderBottom: i < oppList.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <img src={`/assets/teamLogos/${opp}.png`} alt={opp}
                style={{ width: 26, height: 26, objectFit: 'contain' }}
                onError={e => e.target.style.display = 'none'} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '0.08em',
                }}>{opp}</span>
                <span style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 10, color: '#444', letterSpacing: '0.1em',
                }}>{games}x REMAINING</span>
              </div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 17, fontWeight: 900, textAlign: 'center',
                color: isWinning ? '#22c55e' : isLosing ? '#ef4444' : '#888',
                letterSpacing: '0.05em',
              }}>{record}</div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 13, fontWeight: 600, textAlign: 'center',
                color: 'rgba(255,255,255,0.4)',
              }}>{gfA}-{gfB}</div>
            </div>
          )
        })}

        {oppList.length === 0 && (
          <div style={{
            padding: '20px 14px', textAlign: 'center',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 13, color: '#444', letterSpacing: '0.15em',
          }}>NO GAMES REMAINING</div>
        )}
      </div>
    </div>
  )
}

// ─── Tiebreaker Tooltip ───────────────────────────────────────────────────────

function TiebreakerPanel({ tiedStandings, games, anchorIdx, totalRows }) {
  if (!tiedStandings || tiedStandings.length < 2) return null
  const enriched = tiedStandings.map((s) => {
    let h2hPts = 0
    tiedStandings.forEach((o) => {
      if (o.team === s.team) return
      const { ptsA } = computeH2HPts(s.team, o.team, games)
      h2hPts += ptsA
    })
    return { ...s, h2hPts }
  }).sort((a, b) => b.h2hPts - a.h2hPts || b.w - a.w || b.gd - a.gd)

  const showAbove = anchorIdx > totalRows / 2

  return (
    <div style={{
      position: 'absolute',
      right: -310,
      top: showAbove ? 'auto' : 0,
      bottom: showAbove ? 0 : 'auto',
      width: 290,
      zIndex: 300,
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'linear-gradient(155deg, #080404 0%, #140808 100%)',
        border: '1px solid rgba(204,26,26,0.6)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px rgba(204,26,26,0.15), 0 8px 32px rgba(0,0,0,0.9)',
      }}>
        <div style={{
          padding: '8px 14px', borderBottom: '1px solid rgba(204,26,26,0.2)',
          background: 'rgba(204,26,26,0.15)',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 11, fontWeight: 900, color: '#cc1a1a', letterSpacing: '0.2em',
        }}>TIEBREAKER · {enriched[0].pts} PTS</div>
        <div style={{
          display: 'grid', gridTemplateColumns: '24px 1fr 44px 36px 44px',
          padding: '5px 14px 3px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}>
          {['#', '', 'H2H', 'W', 'GD'].map((h, i) => (
            <div key={i} style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 9, fontWeight: 900,
              color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em',
              textAlign: i > 1 ? 'center' : 'left',
            }}>{h}</div>
          ))}
        </div>
        {enriched.map((row, idx) => (
          <div key={row.team} style={{
            display: 'grid', gridTemplateColumns: '24px 1fr 44px 36px 44px',
            padding: '8px 14px', alignItems: 'center',
            background: idx === 0 ? 'rgba(204,26,26,0.1)' : idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
            borderBottom: idx < enriched.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
          }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 900,
              color: idx === 0 ? '#cc1a1a' : '#333',
            }}>{idx + 1}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={`/assets/teamLogos/${row.team}.png`} alt={row.team}
                style={{ width: 20, height: 20, objectFit: 'contain' }}
                onError={e => e.target.style.display = 'none'} />
              <span style={{
                fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, fontWeight: 700,
                color: idx === 0 ? '#fff' : '#999',
              }}>{row.team}</span>
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, textAlign: 'center', color: idx === 0 ? '#cc1a1a' : '#555' }}>{row.h2hPts}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, textAlign: 'center', color: '#555' }}>{row.w}</div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif", fontSize: 16, fontWeight: 700, textAlign: 'center',
              color: row.gd > 0 ? '#22c55e' : row.gd < 0 ? '#ef4444' : '#444',
            }}>{row.gd > 0 ? '+' : ''}{row.gd}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 20

export default function PodcastStandings() {
  const [season, setSeason] = useState(null)
  const [rawGames, setRawGames] = useState([])
  const [allGames, setAllGames] = useState([]) // all games ever (for h2h hover)
  const [seasonTeams, setSeasonTeams] = useState([])
  const [scheduledGames, setScheduledGames] = useState([]) // unplayed scheduled games
  const [totalGamesPerTeam, setTotalGamesPerTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [hoveredTeam, setHoveredTeam] = useState(null)
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [hoveredForSchedule, setHoveredForSchedule] = useState(null)
  const [page, setPage] = useState(0) // 0 = top 20, 1 = rest
  const logoRefs = useRef({})

  // ── Load current season dynamically ──
  useEffect(() => {
    const load = async () => {
      setLoading(true)

      // Get current W season (max lg where status = 'season' or most recent)
      const { data: seasons } = await supabase
        .from('seasons')
        .select('*')
        .ilike('lg', 'W%')
        .order('lg', { ascending: false })
        .limit(5)

      let currentSeason = null
      if (seasons) {
        currentSeason = seasons.find(s => s.status === 'season') || seasons[0]
      }
      if (!currentSeason) { setLoading(false); return }
      setSeason(currentSeason)

      const lg = currentSeason.lg

      const [
        { data: games },
        { data: teams },
        { data: scheduled },
        { data: historical },
      ] = await Promise.all([
        supabase.from('games')
          .select('id, home, away, score_home, score_away, ot')
          .eq('lg', lg)
          .ilike('mode', 'season')
          .not('score_home', 'is', null)
          .order('id', { ascending: true }),
        supabase.from('teams').select('abr, coach').eq('lg', lg),
        // Unplayed games (no score) for schedule hover
        supabase.from('games')
          .select('id, home, away, game_date')
          .eq('lg', lg)
          .ilike('mode', 'season')
          .is('score_home', null)
          .order('id', { ascending: true }),
        // All historical games for all-time H2H
        supabase.from('games')
          .select('id, home, away, score_home, score_away, ot')
          .not('score_home', 'is', null),
      ])

      setRawGames(games || [])
      setAllGames(historical || [])
      setSeasonTeams(teams || [])
      setScheduledGames(scheduled || [])

      const numTeams = (teams || []).length
      const rsVs = currentSeason?.rs_games_vs ?? null
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
      .map(({ abr }) => ({
        team: abr, gp: 0, w: 0, l: 0, t: 0, otl: 0, otw: 0,
        pts: 0, gf: 0, ga: 0, gd: 0, shutouts: 0,
        pts_pct: 0, streak: '', streakType: null, streakCount: 0,
      }))
    return [...standings, ...zeroed].map(s => {
      const gr = totalGamesPerTeam != null ? Math.max(0, totalGamesPerTeam - (s.gp || 0)) : null
      return { ...s, gr, maxPts: gr != null ? s.pts + gr * 2 : null }
    })
  }, [rawGames, seasonTeams, totalGamesPerTeam])

  const sorted = useMemo(() =>
    sortWithTiebreakers(computedStandings, rawGames).map((s, i) => ({ ...s, _rank: i + 1 })),
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

  // Remaining games per team
  const remainingByTeam = useMemo(() => {
    const map = {}
    scheduledGames.forEach(g => {
      if (!map[g.home]) map[g.home] = []
      if (!map[g.away]) map[g.away] = []
      map[g.home].push(g)
      map[g.away].push(g)
    })
    return map
  }, [scheduledGames])

  const handleMouseEnterRow = useCallback((team, pts, idx) => {
    if (tiedPtsSet.has(Number(pts))) {
      setHoveredTeam(team)
      setHoveredIdx(idx)
    }
  }, [tiedPtsSet])

  const handleMouseLeaveRow = useCallback(() => {
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
    { key: 'rank',    label: '#',    w: 36 },
    { key: 'team',    label: 'TEAM', w: 190, flex: true },
    { key: 'gp',      label: 'GP',   w: 48 },
    { key: 'w',       label: 'W',    w: 48 },
    { key: 'l',       label: 'L',    w: 48 },
    { key: 'otl',     label: 'OTL',  w: 52 },
    { key: 'pts',     label: 'PTS',  w: 60 },
    { key: 'pts_pct', label: 'PCT',  w: 64 },
    { key: 'gf',      label: 'GF',   w: 52 },
    { key: 'ga',      label: 'GA',   w: 52 },
    { key: 'gd',      label: 'GD',   w: 60 },
    { key: 'streak',  label: 'STRK', w: 64 },
    { key: 'gr',      label: 'GR',   w: 48 },
  ]

  const gridCols = COLS.map(c => c.flex ? '1fr' : `${c.w}px`).join(' ')

  // Pagination
  const topPage  = sorted.slice(0, PAGE_SIZE)
  const restPage = sorted.slice(PAGE_SIZE)
  const displayRows = page === 0 ? topPage : restPage
  const hasMore = sorted.length > PAGE_SIZE

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,900;1,700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes bnb-row-in { from { opacity:0; transform:translateX(-8px); } to { opacity:1; transform:translateX(0); } }
        @keyframes bnb-clinch-pulse {
          0%,100% { box-shadow: 0 0 6px rgba(34,197,94,0.5); border-color: rgba(34,197,94,0.6); }
          50%     { box-shadow: 0 0 14px rgba(34,197,94,0.9); border-color: rgba(34,197,94,1); }
        }
        @keyframes bnb-tied-corner {
          0%,100% { border-color: transparent rgba(204,26,26,0.7) transparent transparent; }
          50%     { border-color: transparent rgba(255,80,80,1) transparent transparent; }
        }
        .bnb-row { animation: bnb-row-in 0.25s ease both; }
        .bnb-logo-wrap:hover .bnb-logo { transform: scale(1.2); filter: drop-shadow(0 0 8px rgba(204,26,26,0.9)) !important; }
      `}</style>

      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        padding: '14px 20px 10px',
        boxSizing: 'border-box',
        fontFamily: "'Barlow Condensed', sans-serif",
        overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12, flexShrink: 0 }}>
          <div style={{ width: 3, height: 28, background: '#cc1a1a', borderRadius: 2 }} />
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '0.18em' }}>STANDINGS</div>
          <div style={{ fontSize: 12, color: '#cc1a1a', letterSpacing: '0.2em', fontWeight: 700, marginTop: 2 }}>
            {season?.lg || ''}
          </div>
          {page === 1 && (
            <div style={{ fontSize: 11, color: '#444', letterSpacing: '0.15em', fontWeight: 600 }}>
              #{PAGE_SIZE + 1}–{sorted.length}
            </div>
          )}
          <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(204,26,26,0.4), transparent)' }} />
          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 5px #22c55e' }} />
              <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.12em', fontWeight: 700 }}>CLINCHED</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#444' }} />
              <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.12em', fontWeight: 700 }}>ELIM</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#cc1a1a' }} />
              <span style={{ fontSize: 10, color: '#555', letterSpacing: '0.12em', fontWeight: 700 }}>TIED</span>
            </div>
          </div>
          {/* Scroll arrow */}
          {hasMore && (
            <button
              onClick={() => setPage(p => p === 0 ? 1 : 0)}
              style={{
                background: 'rgba(204,26,26,0.15)', border: '1px solid rgba(204,26,26,0.4)',
                borderRadius: 4, padding: '5px 14px', cursor: 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 12, fontWeight: 900, color: '#cc1a1a',
                letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {page === 0 ? `▼ #${PAGE_SIZE + 1}–${sorted.length}` : `▲ TOP ${PAGE_SIZE}`}
            </button>
          )}
        </div>

        {/* ── Column headers ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: gridCols,
          background: '#cc1a1a',
          borderRadius: '3px 3px 0 0',
          padding: '0 6px',
          flexShrink: 0,
          clipPath: 'polygon(0 0, calc(100% - 14px) 0, 100% 100%, 0 100%)',
        }}>
          {COLS.map(col => (
            <div key={col.key} style={{
              padding: '8px 6px',
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 12,
              fontWeight: 900,
              color: col.key === 'pts' ? '#fff' : 'rgba(255,255,255,0.9)',
              letterSpacing: '0.15em',
              textAlign: (col.key === 'rank' || col.key === 'team') ? 'left' : 'center',
            }}>{col.label}</div>
          ))}
        </div>

        {/* ── Rows ── */}
        <div style={{ flex: 1, overflowY: 'hidden', position: 'relative' }}>
          {displayRows.map((s, i) => {
            const globalIdx = page === 0 ? i : PAGE_SIZE + i
            const isTied = tiedPtsSet.has(Number(s.pts))
            const isClinched = clinched.has(s.team)
            const isElim = eliminated.has(s.team)
            const isHovered = hoveredTeam === s.team
            const isPlayoff = globalIdx < PLAYOFF_CUTOFF
            const isCutoff = globalIdx === PLAYOFF_CUTOFF - 1
            const gdSign = s.gd > 0 ? '+' : ''
            const tiedTeams = isTied ? sorted.filter(t => Number(t.pts) === Number(s.pts)) : []

            const rowBg = isHovered
              ? 'rgba(204,26,26,0.1)'
              : globalIdx % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent'

            return (
              <div key={s.team}>
                <div
                  className="bnb-row"
                  onMouseEnter={() => handleMouseEnterRow(s.team, s.pts, globalIdx)}
                  onMouseLeave={handleMouseLeaveRow}
                  style={{
                    display: 'grid', gridTemplateColumns: gridCols,
                    background: rowBg,
                    padding: '0 6px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    alignItems: 'center',
                    animationDelay: `${i * 0.025}s`,
                    position: 'relative',
                    transition: 'background 0.15s',
                    minHeight: 42,
                  }}
                >
                  {/* Playoff left accent */}
                  {isPlayoff && (
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
                      background: isClinched ? '#22c55e' : 'rgba(204,26,26,0.5)',
                      boxShadow: isClinched ? '0 0 6px #22c55e' : 'none',
                    }} />
                  )}

                  {/* RANK */}
                  <div style={{
                    fontSize: 13, fontWeight: 900, paddingLeft: 8, letterSpacing: '0.05em',
                    color: isPlayoff ? (isClinched ? '#22c55e' : '#cc1a1a') : '#333',
                  }}>{globalIdx + 1}</div>

                  {/* TEAM */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative', paddingLeft: 2 }}>
                    {/* Banner BG */}
                    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, overflow: 'hidden', pointerEvents: 'none' }}>
                      <img src={`/assets/banners/${s.team}.png`} alt=""
                        style={{
                          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                          height: '130%', width: 'auto', objectFit: 'contain',
                          opacity: 0.1, filter: 'saturate(0.5)',
                          maskImage: 'linear-gradient(to right, rgba(0,0,0,0.9) 0%, transparent 100%)',
                          WebkitMaskImage: 'linear-gradient(to right, rgba(0,0,0,0.9) 0%, transparent 100%)',
                        }}
                        onError={e => e.target.style.display = 'none'} />
                    </div>

                    {/* Logo with schedule hover */}
                    <div
                      className="bnb-logo-wrap"
                      style={{
                        width: 30, height: 30, flexShrink: 0, position: 'relative', zIndex: 1,
                        border: isClinched
                          ? '1.5px solid rgba(34,197,94,0.7)'
                          : isElim ? '1.5px solid rgba(239,68,68,0.25)'
                          : '1.5px solid rgba(255,255,255,0.1)',
                        borderRadius: 4, background: 'rgba(0,0,0,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'default',
                        animation: isClinched ? 'bnb-clinch-pulse 2.4s ease-in-out infinite' : 'none',
                      }}
                      onMouseEnter={() => setHoveredForSchedule({ team: s.team, idx: globalIdx })}
                      onMouseLeave={() => setHoveredForSchedule(null)}
                    >
                      <img className="bnb-logo"
                        src={`/assets/teamLogos/${s.team}.png`} alt={s.team}
                        style={{
                          width: 24, height: 24, objectFit: 'contain',
                          filter: isElim ? 'saturate(0.2) brightness(0.5)' : 'none',
                          transition: 'all 0.2s ease',
                        }}
                        onError={e => e.target.style.display = 'none'} />

                      {/* Schedule hover panel */}
                      {hoveredForSchedule?.team === s.team && (
                        <ScheduleHoverPanel
                          team={s.team}
                          remainingGames={remainingByTeam[s.team] || []}
                          allGames={allGames}
                          idx={globalIdx}
                          totalRows={sorted.length}
                        />
                      )}
                    </div>

                    {/* Team code */}
                    <span style={{
                      fontSize: 16, fontWeight: 700, letterSpacing: '0.08em',
                      color: isElim ? '#3a3a3a' : '#fff',
                      position: 'relative', zIndex: 1,
                    }}>{s.team}</span>

                    {/* Tiebreaker corner */}
                    {isTied && (
                      <div style={{
                        position: 'absolute', top: 0, right: 0,
                        width: 0, height: 0, borderStyle: 'solid',
                        borderWidth: '0 8px 8px 0',
                        borderColor: 'transparent #cc1a1a transparent transparent',
                        animation: 'bnb-tied-corner 1.5s ease-in-out infinite',
                      }} />
                    )}

                    {/* Tiebreaker tooltip */}
                    {isHovered && isTied && (
                      <TiebreakerPanel
                        tiedStandings={tiedTeams} games={rawGames}
                        anchorIdx={globalIdx} totalRows={sorted.length}
                      />
                    )}
                  </div>

                  <StatCell value={s.gp} />
                  <StatCell value={s.w} />
                  <StatCell value={s.l} dim />
                  <StatCell value={s.otl} dim />

                  {/* PTS */}
                  <div style={{
                    textAlign: 'center', fontSize: 18, fontWeight: 900, letterSpacing: '0.05em',
                    color: isTied ? '#ff6060' : isPlayoff ? '#fff' : '#555',
                    textShadow: isPlayoff && !isTied ? '0 0 10px rgba(255,255,255,0.15)' : 'none',
                  }}>{s.pts}</div>

                  {/* PCT */}
                  <div style={{
                    textAlign: 'center', fontSize: 13, fontWeight: 600, letterSpacing: '0.02em',
                    color: 'rgba(255,255,255,0.3)',
                  }}>{s.gp > 0 ? (s.pts / (s.gp * 2)).toFixed(3) : '.000'}</div>

                  <StatCell value={s.gf} />
                  <StatCell value={s.ga} dim />

                  {/* GD */}
                  <div style={{
                    textAlign: 'center', fontSize: 14, fontWeight: 700, letterSpacing: '0.05em',
                    color: s.gd > 0 ? '#22c55e' : s.gd < 0 ? '#ef4444' : '#444',
                  }}>{gdSign}{s.gd}</div>

                  {/* STREAK */}
                  <div style={{
                    textAlign: 'center', fontSize: 14, fontWeight: 700, letterSpacing: '0.05em',
                    color: (s.streakType === 'W' || s.streakType === 'OTW') ? '#22c55e'
                      : (s.streakType === 'L' || s.streakType === 'OTL') ? '#ef4444' : '#444',
                  }}>{s.streak || '—'}</div>

                  {/* GR */}
                  <div style={{
                    textAlign: 'center', fontSize: 13, fontWeight: 600,
                    color: s.gr === 0 ? '#cc1a1a' : 'rgba(255,255,255,0.25)',
                  }}>{s.gr ?? '—'}</div>
                </div>

                {/* Playoff cutoff line */}
                {isCutoff && (
                  <div style={{ position: 'relative', height: 2, flexShrink: 0 }}>
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(90deg, transparent, rgba(204,26,26,0.8) 20%, rgba(204,26,26,0.8) 80%, transparent)',
                    }} />
                    <div style={{
                      position: 'absolute', left: '50%', top: '50%',
                      transform: 'translate(-50%,-50%)',
                      background: '#0a0a0a', padding: '0 12px',
                      fontSize: 9, fontWeight: 900, color: '#cc1a1a', letterSpacing: '0.25em', whiteSpace: 'nowrap',
                    }}>PLAYOFF LINE</div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── Scroll indicator ── */}
        {hasMore && (
          <div style={{
            flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 8,
          }}>
            <button
              onClick={() => setPage(p => p === 0 ? 1 : 0)}
              style={{
                background: 'rgba(204,26,26,0.1)', border: '1px solid rgba(204,26,26,0.3)',
                borderRadius: 4, padding: '4px 24px', cursor: 'pointer',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 11, fontWeight: 900, color: '#cc1a1a', letterSpacing: '0.2em',
              }}
            >
              {page === 0 ? `▼ SHOW #${PAGE_SIZE + 1}–${sorted.length}` : `▲ SHOW TOP ${PAGE_SIZE}`}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function StatCell({ value, dim }) {
  return (
    <div style={{
      textAlign: 'center', fontSize: 15, fontWeight: 600, letterSpacing: '0.03em',
      color: dim ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.6)',
    }}>{value ?? '—'}</div>
  )
}

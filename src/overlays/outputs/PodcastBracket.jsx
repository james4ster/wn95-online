/* Brackets for podcast */
import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../utils/supabaseClient'

// ─── Seeding pairs — standard 16-team bracket ────────────────────────────────
// [ [1,16], [8,9], [4,13], [5,12], [3,14], [6,11], [2,15], [7,10] ]
// First round grouped into 4 pods (conference halves)
const FIRST_ROUND_PAIRS = [
  [1,16],[8,9],
  [4,13],[5,12],
  [3,14],[6,11],
  [2,15],[7,10],
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeAllTimeH2H(teamA, teamB, games) {
  let wA = 0, wB = 0, t = 0, gfA = 0, gfB = 0, soA = 0, soB = 0
  const last10 = []
  games.forEach(g => {
    const aIsHome = g.home === teamA && g.away === teamB
    const aIsAway = g.home === teamB && g.away === teamA
    if (!aIsHome && !aIsAway) return
    const sA = aIsHome ? g.score_home : g.score_away
    const sB = aIsHome ? g.score_away : g.score_home
    gfA += sA; gfB += sB
    if (sB === 0) soA++
    if (sA === 0) soB++
    if (sA > sB) { wA++; last10.push({ winner: teamA, sA, sB, ot: g.ot, id: g.id }) }
    else if (sB > sA) { wB++; last10.push({ winner: teamB, sA, sB, ot: g.ot, id: g.id }) }
    else { t++; last10.push({ winner: null, sA, sB, ot: g.ot, id: g.id }) }
  })
  last10.sort((a, b) => b.id - a.id)
  return { wA, wB, t, gfA, gfB, soA, soB, gp: wA + wB + t, last10: last10.slice(0, 10) }
}

function computePlayoffH2H(teamA, teamB, games) {
  return computeAllTimeH2H(teamA, teamB, games.filter(g => g.mode?.toLowerCase() === 'playoff' || g.mode?.toLowerCase() === 'playoffs'))
}

// ─── Bracket logic ───────────────────────────────────────────────────────────

function buildBracket(standings) {
  const byRank = {}
  standings.forEach(s => { byRank[s._rank] = s })
  return FIRST_ROUND_PAIRS.map(([high, low]) => ({
    high: byRank[high] || null,
    low:  byRank[low]  || null,
    highSeed: high,
    lowSeed:  low,
  }))
}

// ─── H2H Detail Panel ────────────────────────────────────────────────────────

function H2HPanel({ teamA, teamB, allGames, playoffGames }) {
  if (!teamA || !teamB) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 48, opacity: 0.06 }}>⚔</div>
        <div style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 16, fontWeight: 700, color: '#2a2a2a',
          letterSpacing: '0.2em', textTransform: 'uppercase',
        }}>SELECT A MATCHUP</div>
        <div style={{ fontSize: 11, color: '#222', fontFamily: 'monospace', letterSpacing: '0.1em' }}>
          click any first-round pair to load stats
        </div>
      </div>
    )
  }

  const allTime    = computeAllTimeH2H(teamA, teamB, allGames)
  const playoff    = computePlayoffH2H(teamA, teamB, playoffGames)
  const { last10 } = allTime

  const aLeads = allTime.wA > allTime.wB
  const bLeads = allTime.wB > allTime.wA

  const barPct = (v, total) => total === 0 ? 50 : Math.round((v / total) * 100)
  const aBar = barPct(allTime.wA, allTime.wA + allTime.wB)
  const bBar = 100 - aBar

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      gap: 0, overflow: 'hidden',
    }}>
      {/* ── VS Header ── */}
      <div style={{
        flexShrink: 0,
        padding: '14px 20px 12px',
        borderBottom: '1px solid rgba(204,26,26,0.2)',
        background: 'linear-gradient(180deg, rgba(204,26,26,0.08) 0%, transparent 100%)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Team A */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
            <img src={`/assets/teamLogos/${teamA}.png`} alt={teamA}
              style={{ width: 48, height: 48, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(204,26,26,0.4))' }}
              onError={e => e.target.style.display = 'none'} />
            <div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '0.12em', lineHeight: 1,
              }}>{teamA}</div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', marginTop: 3,
                color: aLeads ? '#22c55e' : '#666',
              }}>{allTime.wA}W · {allTime.gfA}GF</div>
            </div>
          </div>

          {/* Center VS badge */}
          <div style={{ flexShrink: 0, padding: '0 16px', textAlign: 'center' }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 11, fontWeight: 900, color: '#cc1a1a', letterSpacing: '0.3em', marginBottom: 4,
            }}>H2H</div>
            <div style={{
              fontSize: 32, fontWeight: 900, color: '#cc1a1a',
              fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.05em',
              textShadow: '0 0 20px rgba(204,26,26,0.5)',
            }}>VS</div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 10, color: '#444', letterSpacing: '0.15em', marginTop: 4,
            }}>{allTime.gp} GAMES</div>
          </div>

          {/* Team B */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'flex-end' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '0.12em', lineHeight: 1,
              }}>{teamB}</div>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 13, fontWeight: 700, letterSpacing: '0.15em', marginTop: 3,
                color: bLeads ? '#22c55e' : '#666',
              }}>{allTime.wB}W · {allTime.gfB}GF</div>
            </div>
            <img src={`/assets/teamLogos/${teamB}.png`} alt={teamB}
              style={{ width: 48, height: 48, objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(204,26,26,0.4))' }}
              onError={e => e.target.style.display = 'none'} />
          </div>
        </div>

        {/* Win bar */}
        <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 0, height: 6, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            width: `${aBar}%`, height: '100%',
            background: aLeads ? 'linear-gradient(90deg, #cc1a1a, #ff4444)' : '#2a2a2a',
            transition: 'width 0.6s ease',
          }} />
          <div style={{
            width: `${bBar}%`, height: '100%',
            background: bLeads ? 'linear-gradient(90deg, #ff4444, #cc1a1a)' : '#2a2a2a',
            transition: 'width 0.6s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: '#555', letterSpacing: '0.1em' }}>{aBar}%</span>
          {allTime.t > 0 && <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: '#444', letterSpacing: '0.1em' }}>{allTime.t}T</span>}
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: '#555', letterSpacing: '0.1em' }}>{bBar}%</span>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div style={{ flexShrink: 0, display: 'grid', gridTemplateColumns: '1fr 1px 1fr', padding: '12px 20px', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {/* All-time col */}
        <div style={{ paddingRight: 16 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 900, color: '#cc1a1a', letterSpacing: '0.2em', marginBottom: 8 }}>ALL-TIME</div>
          <StatRow label="WINS" valA={allTime.wA} valB={allTime.wB} />
          <StatRow label="GOALS" valA={allTime.gfA} valB={allTime.gfB} />
          <StatRow label="GA" valA={allTime.gfB} valB={allTime.gfA} lowerBetter />
          <StatRow label="SHUTOUTS" valA={allTime.soA} valB={allTime.soB} />
        </div>

        <div style={{ background: 'rgba(255,255,255,0.05)' }} />

        {/* Playoff col */}
        <div style={{ paddingLeft: 16 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 900, color: '#cc1a1a', letterSpacing: '0.2em', marginBottom: 8 }}>PLAYOFFS ONLY</div>
          {playoff.gp > 0 ? (
            <>
              <StatRow label="WINS" valA={playoff.wA} valB={playoff.wB} />
              <StatRow label="GOALS" valA={playoff.gfA} valB={playoff.gfB} />
              <StatRow label="GA" valA={playoff.gfB} valB={playoff.gfA} lowerBetter />
              <StatRow label="SHUTOUTS" valA={playoff.soA} valB={playoff.soB} />
            </>
          ) : (
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#333', letterSpacing: '0.15em', paddingTop: 8 }}>
              NO PLAYOFF HISTORY
            </div>
          )}
        </div>
      </div>

      {/* ── Last 10 ── */}
      <div style={{ flex: 1, padding: '10px 20px 12px', overflow: 'hidden' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, fontWeight: 900, color: '#cc1a1a', letterSpacing: '0.2em', marginBottom: 8 }}>
          LAST 10 MEETINGS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {last10.length === 0 && (
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, color: '#333', letterSpacing: '0.15em' }}>
              NO GAMES PLAYED
            </div>
          )}
          {last10.map((g, i) => {
            const aWon = g.winner === teamA
            const bWon = g.winner === teamB
            const tied = g.winner === null
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 10px',
                background: i % 2 === 0 ? 'rgba(255,255,255,0.025)' : 'transparent',
                borderRadius: 3,
              }}>
                {/* Game number */}
                <div style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 10, color: '#333', letterSpacing: '0.1em', width: 20, flexShrink: 0,
                }}>G{last10.length - i}</div>

                {/* Team A side */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 14, fontWeight: aWon ? 900 : 600, letterSpacing: '0.08em',
                    color: aWon ? '#fff' : '#444',
                  }}>{teamA}</span>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 20, fontWeight: 900,
                    color: aWon ? '#22c55e' : tied ? '#888' : '#ef4444',
                    minWidth: 24, textAlign: 'right',
                  }}>{g.sA}</span>
                </div>

                {/* Dash */}
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14, color: '#333', flexShrink: 0 }}>—</div>

                {/* Team B side */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 20, fontWeight: 900,
                    color: bWon ? '#22c55e' : tied ? '#888' : '#ef4444',
                    minWidth: 24, textAlign: 'left',
                  }}>{g.sB}</span>
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 14, fontWeight: bWon ? 900 : 600, letterSpacing: '0.08em',
                    color: bWon ? '#fff' : '#444',
                  }}>{teamB}</span>
                </div>

                {/* OT badge */}
                {g.ot && (
                  <div style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontSize: 9, fontWeight: 900, color: '#cc1a1a',
                    letterSpacing: '0.15em', width: 24, textAlign: 'right', flexShrink: 0,
                  }}>OT</div>
                )}
                {!g.ot && <div style={{ width: 24 }} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function StatRow({ label, valA, valB, lowerBetter }) {
  const aWins = lowerBetter ? valA < valB : valA > valB
  const bWins = lowerBetter ? valB < valA : valB > valA
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 18, fontWeight: 900,
        color: aWins ? '#fff' : '#444',
        width: 44, textAlign: 'left',
        textShadow: aWins ? '0 0 8px rgba(255,255,255,0.2)' : 'none',
      }}>{valA}</div>
      <div style={{
        flex: 1, textAlign: 'center',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 9, fontWeight: 900, color: '#333', letterSpacing: '0.18em',
      }}>{label}</div>
      <div style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        fontSize: 18, fontWeight: 900,
        color: bWins ? '#fff' : '#444',
        width: 44, textAlign: 'right',
        textShadow: bWins ? '0 0 8px rgba(255,255,255,0.2)' : 'none',
      }}>{valB}</div>
    </div>
  )
}

// ─── Matchup Card ─────────────────────────────────────────────────────────────

function MatchupCard({ pair, selected, onClick, allGames }) {
  const { high, low, highSeed, lowSeed } = pair
  const teamA = high?.team
  const teamB = low?.team
  const isSelected = selected
  const h2h = (teamA && teamB) ? computeAllTimeH2H(teamA, teamB, allGames) : null

  return (
    <div
      onClick={onClick}
      style={{
        background: isSelected
          ? 'linear-gradient(135deg, rgba(204,26,26,0.15) 0%, rgba(204,26,26,0.08) 100%)'
          : 'rgba(255,255,255,0.025)',
        border: isSelected
          ? '1px solid rgba(204,26,26,0.6)'
          : '1px solid rgba(255,255,255,0.07)',
        borderRadius: 6,
        cursor: 'pointer',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        position: 'relative',
      }}
    >
      {isSelected && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
          background: '#cc1a1a',
          boxShadow: '0 0 8px #cc1a1a',
        }} />
      )}

      {/* Team rows */}
      {[{ seed: highSeed, t: high }, { seed: lowSeed, t: low }].map(({ seed, t }, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 12px 8px 14px',
          borderBottom: i === 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
        }}>
          {/* Seed */}
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 12, fontWeight: 900, color: '#cc1a1a',
            width: 18, flexShrink: 0, letterSpacing: '0.05em',
          }}>{seed}</div>

          {/* Logo */}
          <div style={{
            width: 28, height: 28, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {t ? (
              <img src={`/assets/teamLogos/${t.team}.png`} alt={t.team}
                style={{ width: 26, height: 26, objectFit: 'contain' }}
                onError={e => e.target.style.display = 'none'} />
            ) : (
              <div style={{ width: 26, height: 26, border: '1px dashed #222', borderRadius: 3 }} />
            )}
          </div>

          {/* Team name */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 16, fontWeight: 700, color: t ? '#fff' : '#333',
              letterSpacing: '0.08em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{t?.team || 'TBD'}</div>
          </div>

          {/* PTS */}
          <div style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: 15, fontWeight: 900, color: '#555',
            letterSpacing: '0.05em', flexShrink: 0,
          }}>{t?.pts ?? ''}</div>
        </div>
      ))}

      {/* H2H mini record */}
      {h2h && h2h.gp > 0 && (
        <div style={{
          padding: '4px 14px 5px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          background: 'rgba(0,0,0,0.2)',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontSize: 10, color: '#444', letterSpacing: '0.15em',
          display: 'flex', gap: 10,
        }}>
          <span>H2H</span>
          <span style={{ color: '#666' }}>{h2h.wA}–{h2h.wB}{h2h.t > 0 ? `–${h2h.t}` : ''}</span>
          <span style={{ marginLeft: 'auto' }}>{h2h.gp} GP</span>
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function PodcastBracket({ sortedStandings }) {
  const [allGames, setAllGames] = useState([])
  const [playoffGames, setPlayoffGames] = useState([])
  const [season, setSeason] = useState(null)
  const [standings, setStandings] = useState(sortedStandings || [])
  const [loading, setLoading] = useState(true)
  const [selectedPair, setSelectedPair] = useState(null) // index into bracket

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      // Get current season
      const { data: seasons } = await supabase
        .from('seasons')
        .select('*')
        .ilike('lg', 'W%')
        .order('lg', { ascending: false })
        .limit(5)

      const currentSeason = seasons?.find(s => s.status === 'season') || seasons?.[0]
      if (!currentSeason) { setLoading(false); return }
      setSeason(currentSeason)
      const lg = currentSeason.lg

      const [
        { data: historical },
        { data: playoffs },
        { data: games },
        { data: teams },
      ] = await Promise.all([
        supabase.from('games').select('id, home, away, score_home, score_away, ot, mode').not('score_home', 'is', null),
        supabase.from('games').select('id, home, away, score_home, score_away, ot, mode').ilike('mode', 'playoff%').not('score_home', 'is', null),
        // Season games for standings (if not passed in as props)
        sortedStandings ? { data: null } : supabase.from('games')
          .select('id, home, away, score_home, score_away, ot')
          .eq('lg', lg).ilike('mode', 'season').not('score_home', 'is', null).order('id', { ascending: true }),
        sortedStandings ? { data: null } : supabase.from('teams').select('abr, coach').eq('lg', lg),
      ])

      setAllGames(historical || [])
      setPlayoffGames(playoffs || [])

      if (!sortedStandings && games && teams) {
        // Build standings inline (simplified — re-use logic from PodcastStandings)
        const built = buildInlineStandings(games, teams)
        setStandings(built)
      }

      setLoading(false)
    }
    load()
  }, [])

  const bracket = useMemo(() => buildBracket(standings), [standings])
  const selectedMatchup = selectedPair !== null ? bracket[selectedPair] : null

  if (loading) return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 18, color: '#cc1a1a', letterSpacing: '0.2em' }}>LOADING BRACKET...</div>
    </div>
  )

  // Layout: left ~400px = bracket, right = H2H panel
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@0,400;0,600;0,700;0,900;1,700&display=swap" rel="stylesheet" />
      <style>{`
        @keyframes bnb-card-in { from { opacity:0; transform:translateX(-6px); } to { opacity:1; transform:translateX(0); } }
        @keyframes bnb-glow {
          0%,100% { box-shadow: 0 0 12px rgba(204,26,26,0.4); }
          50%      { box-shadow: 0 0 24px rgba(204,26,26,0.7); }
        }
        .bnb-matchup-card { animation: bnb-card-in 0.25s ease both; }
        .bnb-matchup-card:hover { border-color: rgba(204,26,26,0.4) !important; }
      `}</style>

      <div style={{
        width: '100%', height: '100%',
        display: 'flex', gap: 0,
        fontFamily: "'Barlow Condensed', sans-serif",
        overflow: 'hidden',
      }}>

        {/* ══ LEFT: BRACKET ══ */}
        <div style={{
          width: 380,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid rgba(204,26,26,0.2)',
          padding: '14px 16px',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexShrink: 0 }}>
            <div style={{ width: 3, height: 24, background: '#cc1a1a', borderRadius: 2 }} />
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '0.18em' }}>BRACKET</div>
            <div style={{ fontSize: 11, color: '#cc1a1a', letterSpacing: '0.2em', fontWeight: 700, marginTop: 1 }}>
              {season?.lg || ''} · FIRST ROUND
            </div>
          </div>

          {/* Bracket pairs in 2 columns */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            flex: 1,
            overflow: 'hidden',
          }}>
            {/* Left conference (pairs 0-3) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Conference label */}
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 9, fontWeight: 900, color: '#333', letterSpacing: '0.2em',
                textAlign: 'center', paddingBottom: 2,
              }}>EAST</div>
              {bracket.slice(0, 4).map((pair, i) => (
                <div key={i} className="bnb-matchup-card" style={{ animationDelay: `${i * 0.05}s` }}>
                  <MatchupCard
                    pair={pair}
                    selected={selectedPair === i}
                    onClick={() => setSelectedPair(selectedPair === i ? null : i)}
                    allGames={allGames}
                  />
                </div>
              ))}
            </div>

            {/* Right conference (pairs 4-7) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 9, fontWeight: 900, color: '#333', letterSpacing: '0.2em',
                textAlign: 'center', paddingBottom: 2,
              }}>WEST</div>
              {bracket.slice(4, 8).map((pair, i) => (
                <div key={i + 4} className="bnb-matchup-card" style={{ animationDelay: `${(i + 4) * 0.05}s` }}>
                  <MatchupCard
                    pair={pair}
                    selected={selectedPair === i + 4}
                    onClick={() => setSelectedPair(selectedPair === i + 4 ? null : i + 4)}
                    allGames={allGames}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ══ RIGHT: H2H PANEL ══ */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'rgba(0,0,0,0.2)',
        }}>
          {/* Panel header */}
          <div style={{
            flexShrink: 0,
            padding: '14px 20px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{ width: 3, height: 24, background: '#cc1a1a', borderRadius: 2, opacity: selectedMatchup ? 1 : 0.3 }} />
            <div style={{ fontSize: 20, fontWeight: 900, color: selectedMatchup ? '#fff' : '#333', letterSpacing: '0.18em' }}>
              {selectedMatchup
                ? `${selectedMatchup.high?.team || 'TBD'} vs ${selectedMatchup.low?.team || 'TBD'}`
                : 'MATCHUP DETAIL'}
            </div>
            {selectedMatchup && (
              <div style={{ fontSize: 10, color: '#cc1a1a', letterSpacing: '0.2em', fontWeight: 700 }}>
                #{selectedMatchup.highSeed} vs #{selectedMatchup.lowSeed}
              </div>
            )}
            <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(204,26,26,0.3), transparent)' }} />
            {selectedMatchup && (
              <button
                onClick={() => setSelectedPair(null)}
                style={{
                  background: 'transparent', border: '1px solid #2a2a2a',
                  borderRadius: 4, padding: '4px 12px', cursor: 'pointer',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontSize: 10, color: '#444', letterSpacing: '0.15em',
                }}
              >✕ CLOSE</button>
            )}
          </div>

          {/* H2H content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <H2HPanel
              teamA={selectedMatchup?.high?.team || null}
              teamB={selectedMatchup?.low?.team || null}
              allGames={allGames}
              playoffGames={playoffGames}
            />
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Inline standings builder (used if sortedStandings not passed as prop) ───

function buildInlineStandings(games, teams) {
  const teamMap = {}
  const ensure = (code) => {
    if (!teamMap[code]) teamMap[code] = { team: code, gp: 0, w: 0, l: 0, otl: 0, pts: 0, gf: 0, ga: 0, gd: 0 }
    return teamMap[code]
  }
  games.forEach(g => {
    const h = ensure(g.home), a = ensure(g.away)
    const sh = g.score_home ?? 0, sa = g.score_away ?? 0
    h.gp++; a.gp++; h.gf += sh; h.ga += sa; a.gf += sa; a.ga += sh
    if (sh > sa) { if (g.ot) { h.w++; h.pts += 2; a.otl++; a.pts++ } else { h.w++; h.pts += 2; a.l++ } }
    else if (sa > sh) { if (g.ot) { a.w++; a.pts += 2; h.otl++; h.pts++ } else { a.w++; a.pts += 2; h.l++ } }
    else { h.pts++; a.pts++ }
  })
  const zeroed = (teams || []).filter(({ abr }) => !teamMap[abr]).map(({ abr }) => ({
    team: abr, gp: 0, w: 0, l: 0, otl: 0, pts: 0, gf: 0, ga: 0, gd: 0,
  }))
  const all = [...Object.values(teamMap).map(t => ({ ...t, gd: t.gf - t.ga })), ...zeroed]
  all.sort((a, b) => b.pts - a.pts || b.w - a.w || b.gd - a.gd)
  return all.map((t, i) => ({ ...t, _rank: i + 1 }))
}

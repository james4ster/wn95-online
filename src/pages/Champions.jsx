import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../utils/supabaseClient'
import BracketModal from '../components/BracketModal'

/*
  ChampionsPage
  ──────────────
  Fetches all completed seasons (season_champion_manager_id not null),
  resolves champion + runner-up team codes, and renders the Hall of Champions.

  Data flow:
    seasons  (season_champion_manager_id, lg, end_date, status)
      → teams (abr, team, manager_id)                       — resolves champion abr
      → playoff_games (lg, round, wins)                     — resolves runner-up abr
*/

const lgPrefix = (lg = '') => lg.replace(/[0-9]/g, '').trim()

// Derive champion abr from manager_id → teams lookup
// Derive runner-up from the final round of playoff_games for that lg
function useChampionsData() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)

      // 1. Seasons with a crowned champion only
      const { data: seasons } = await supabase
        .from('seasons')
        .select('lg, season_champion_manager_id, end_date, status, year')
        .not('season_champion_manager_id', 'is', null)
        .neq('status', 'season') // exclude active regular seasons
        .order('end_date', { ascending: false })

      if (!seasons?.length) { setLoading(false); return }

      // 2. All teams (manager_id → abr + name)
      const { data: teams } = await supabase
        .from('teams')
        .select('abr, team, manager_id, lg')

      const managerToTeam = {}
      teams?.forEach(t => {
        // key by manager_id + lg to handle manager owning different teams across seasons
        managerToTeam[`${t.manager_id}__${t.lg}`] = t
        // fallback key without lg
        if (!managerToTeam[t.manager_id]) managerToTeam[t.manager_id] = t
      })

      // 3. For each season, grab playoff_games to find runner-up
      const lgList = seasons.map(s => s.lg)
      const { data: playoffGames } = await supabase
        .from('playoff_games')
        .select('lg, round, series_number, team_code_a, team_code_b, team_a_score, team_b_score, series_length')
        .in('lg', lgList)
        .not('team_a_score', 'is', null)

      // Group playoff games by lg
      const gamesByLg = {}
      playoffGames?.forEach(g => {
        if (!gamesByLg[g.lg]) gamesByLg[g.lg] = []
        gamesByLg[g.lg].push(g)
      })

      // For each lg, find the final series (max round, series_number = 1)
      // and determine the runner-up (team that lost)
      function getRunnerUp(lg, championAbr) {
        const games = gamesByLg[lg] || []
        if (!games.length) return null
        const maxRound = Math.max(...games.map(g => g.round))
        const finalGames = games.filter(g => g.round === maxRound && g.series_number === 1)
        if (!finalGames.length) return null

        // Compute wins per team in the final series
        let winsA = 0, winsB = 0
        const { team_code_a, team_code_b, series_length = 7 } = finalGames[0]
        const needed = Math.ceil(series_length / 2)

        finalGames.forEach(g => {
          if ((g.team_a_score ?? 0) > (g.team_b_score ?? 0)) winsA++
          else winsB++
        })

        // Runner-up is the loser
        if (winsA >= needed) return team_code_b
        if (winsB >= needed) return team_code_a
        // Series still in progress — return whichever isn't the champion
        return team_code_a === championAbr ? team_code_b : team_code_a
      }

      // 4. Build champion rows
      const champRows = seasons.map(season => {
        const champTeam =
          managerToTeam[`${season.season_champion_manager_id}__${season.lg}`] ||
          managerToTeam[season.season_champion_manager_id]

        if (!champTeam) return null

        const championAbr = champTeam.abr
        const runnerUpAbr = getRunnerUp(season.lg, championAbr)

        // Find runner-up team name
        const ruTeam = teams?.find(t => t.abr === runnerUpAbr && t.lg === season.lg)
          || teams?.find(t => t.abr === runnerUpAbr)

        // Final series result
        const games = (gamesByLg[season.lg] || [])
        const maxRound = games.length ? Math.max(...games.map(g => g.round)) : 0
        const finalGames = games.filter(g => g.round === maxRound && g.series_number === 1)
        let winsChamp = 0, winsRu = 0
        finalGames.forEach(g => {
          const aWon = (g.team_a_score ?? 0) > (g.team_b_score ?? 0)
          if (g.team_code_a === championAbr) { if (aWon) winsChamp++; else winsRu++ }
          else { if (!aWon) winsChamp++; else winsRu++ }
        })
        const seriesResult = winsChamp || winsRu ? `${winsChamp}-${winsRu}` : null

        return {
          lg: season.lg,
          prefix: lgPrefix(season.lg),
          endDate: season.end_date,
          championAbr,
          championName: champTeam.team,
          runnerUpAbr,
          runnerUpName: ruTeam?.team || runnerUpAbr,
          seriesResult,
        }
      }).filter(Boolean)

      setRows(champRows)
      setLoading(false)
    }

    load()
  }, [])

  return { rows, loading }
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function TrophyHero({ prefix }) {
  const trophySrc = `/assets/awards/${prefix.toLowerCase()}_champ.png`
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '2.5rem 1rem 1.5rem',
      position: 'relative',
    }}>
      {/* Glow behind trophy */}
      <div style={{
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,215,0,.18) 0%, transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%,-50%)',
        pointerEvents: 'none',
      }} />

      <img
        src={trophySrc}
        alt={`${prefix} Championship Trophy`}
        style={{
          width: 120,
          height: 'auto',
          objectFit: 'contain',
          filter: 'drop-shadow(0 0 24px rgba(255,215,0,.55)) drop-shadow(0 0 60px rgba(255,215,0,.2))',
          animation: 'trophyFloat 4s ease-in-out infinite',
          position: 'relative',
          zIndex: 1,
        }}
        onError={e => {
          e.currentTarget.style.display = 'none'
          e.currentTarget.nextSibling.style.display = 'block'
        }}
      />
      <div style={{ display: 'none', fontSize: 80 }}>🏆</div>

      <div style={{
        marginTop: '1.2rem',
        fontFamily: '"Press Start 2P",monospace',
        fontSize: 'clamp(12px,2vw,18px)',
        color: '#FFD700',
        letterSpacing: 4,
        textAlign: 'center',
        textShadow: '0 0 30px rgba(255,215,0,.5), 0 0 60px rgba(255,215,0,.2)',
        lineHeight: 1.8,
      }}>
        HALL OF CHAMPIONS
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '.6rem',
        marginTop: '.6rem',
      }}>
        <div style={{ height: 1, width: 50, background: 'linear-gradient(90deg,transparent,rgba(255,215,0,.4))' }} />
        <span style={{
          fontFamily: '"VT323",monospace',
          fontSize: 18,
          color: 'rgba(255,215,0,.4)',
          letterSpacing: 3,
        }}>ETERNAL GLORY</span>
        <div style={{ height: 1, width: 50, background: 'linear-gradient(90deg,rgba(255,215,0,.4),transparent)' }} />
      </div>
    </div>
  )
}

function ChampionCard({ row, index, onShowBracket }) {
  const isLatest = index === 0
  const acc = isLatest ? '#FFD700' : 'rgba(255,215,0,.55)'

  return (
    <div style={{
      position: 'relative',
      borderRadius: 12,
      overflow: 'hidden',
      border: `1px solid ${isLatest ? 'rgba(255,215,0,.35)' : 'rgba(255,255,255,.07)'}`,
      background: '#07071a',
      marginBottom: '1.25rem',
    }}>

      {/* Banner as background */}
      <div style={{ position: 'relative', minHeight: isLatest ? 110 : 72 }}>
        <img
          src={`/assets/banners/${row.championAbr}.png`}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0.55,
            filter: 'saturate(1.8) brightness(1.1)',
          }}
          onError={e => { e.currentTarget.style.display = 'none' }}
        />

        {/* Gradient overlay — left stays readable, right fades to dark */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, rgba(4,4,18,.05) 0%, rgba(4,4,18,.3) 50%, rgba(4,4,18,.75) 100%)',
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          bbackground: 'linear-gradient(180deg,transparent 60%,rgba(4,4,18,.7) 100%)',
        }} />

        {/* Content row */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          alignItems: 'center',
          gap: '1.5rem',
          padding: isLatest ? '1.5rem 1.5rem 1.25rem' : '1rem 1.25rem',
        }}>

          {/* Champion logo */}
          <div style={{
            flexShrink: 0,
            width: isLatest ? 150 : 108,
            height: isLatest ? 150 : 108,
            borderRadius: 10,
            background: 'rgba(255,255,255,.04)',
            border: `1px solid ${isLatest ? 'rgba(255,215,0,.3)' : 'rgba(255,255,255,.1)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isLatest ? '0 0 30px rgba(255,215,0,.2), 0 0 60px rgba(255,215,0,.08)' : 'none',
          }}>
            <img
              src={`/assets/teamLogos/${row.championAbr}.png`}
              alt={row.championName}
              style={{
                width: isLatest ? 124 : 88,
                height: isLatest ? 124 : 88,
                objectFit: 'contain',
                filter: isLatest
                  ? 'drop-shadow(0 0 14px rgba(255,215,0,.5)) drop-shadow(0 0 28px rgba(255,215,0,.2))'
                  : 'drop-shadow(0 0 6px rgba(255,215,0,.2))',
              }}
              onError={e => {
                e.currentTarget.style.display = 'none'
                e.currentTarget.nextSibling.style.display = 'flex'
              }}
            />
            <div style={{
              display: 'none',
              fontFamily: '"Press Start 2P",monospace',
              fontSize: 10,
              color: 'rgba(255,255,255,.3)',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
            }}>{row.championAbr}</div>
          </div>

          {/* Champion info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Season badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.5rem', flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: '"Press Start 2P",monospace',
                fontSize: isLatest ? 11 : 8,
                color: acc,
                letterSpacing: 2,
                textShadow: `0 0 10px ${acc}88`,
              }}>{row.lg}</span>
              
            </div>

            {/* Champion name */}
            <div style={{
              fontFamily: '"Press Start 2P",monospace',
              fontSize: isLatest ? 13 : 9,
              color: '#fff',
              letterSpacing: 1,
              lineHeight: 1.7,
              marginBottom: '.5rem',
              textShadow: '0 0 20px rgba(255,255,255,.15)',
            }}>{row.championName}</div>

            {/* Runner up */}
            {row.runnerUpAbr && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '.5rem',
                marginTop: '.7rem',
              }}>
                <img
                  src={`/assets/teamLogos/${row.runnerUpAbr}.png`}
                  alt=""
                  aria-hidden="true"
                  style={{
                    width: 22,
                    height: 22,
                    objectFit: 'contain',
                    filter: 'grayscale(.5)',
                    opacity: .65,
                  }}
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
                <span style={{
                  fontFamily: '"VT323",monospace',
                  fontSize: 17,
                  color: 'rgba(255,255,255,.4)',
                  letterSpacing: .5,
                }}>
                  Runner-up: {row.runnerUpName}
                  {row.seriesResult ? ` · ${row.seriesResult}` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Show bracket button */}
          <button
            onClick={() => onShowBracket(row.lg)}
            style={{
              flexShrink: 0,
              fontFamily: '"Press Start 2P",monospace',
              fontSize: 8,
              color: 'rgba(255,140,0,.7)',
              background: 'rgba(255,140,0,.07)',
              border: '1px solid rgba(255,140,0,.2)',
              borderRadius: 6,
              padding: '.4rem .65rem',
              cursor: 'pointer',
              letterSpacing: 1,
              lineHeight: 1.7,
              transition: 'all .15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(255,140,0,.14)'
              e.currentTarget.style.borderColor = 'rgba(255,140,0,.4)'
              e.currentTarget.style.color = '#FF8C00'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(255,140,0,.07)'
              e.currentTarget.style.borderColor = 'rgba(255,140,0,.2)'
              e.currentTarget.style.color = 'rgba(255,140,0,.7)'
            }}
            aria-label={`View ${row.lg} playoff bracket`}
          >
            🏒<br/>BRACKET
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Home panel (compact, drop below Spotlight in cg-a) ────────────────────────

export function ChampionsHomePanel({ onNavigateToChampions }) {
  const { rows, loading } = useChampionsData()
  const recent = rows.slice(0, 5)

  return (
    <section style={{
      border: '1.5px solid rgba(255,215,0,.12)',
      borderRadius: 10,
      overflow: 'hidden',
      background: 'linear-gradient(155deg,rgba(255,215,0,.03) 0%,rgba(0,0,0,.3) 100%)',
    }}>
      {/* Panel header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '.38rem',
        padding: '.48rem .82rem',
        background: 'linear-gradient(90deg,rgba(255,215,0,.08),transparent)',
        borderBottom: '1px solid rgba(255,215,0,.1)',
      }}>
        <img
        src="/assets/awards/w_champ.png"
        alt=""
        aria-hidden="true"
        style={{ width: 22, height: 22, objectFit: 'contain', filter: 'drop-shadow(0 0 4px rgba(255,215,0,.5))' }}
        onError={e => { e.currentTarget.style.display = 'none' }}
        />
        <span style={{
          flex: 1,
          fontFamily: '"Press Start 2P",monospace',
          fontSize: 10,
          color: '#FFD700',
          letterSpacing: 2,
          textShadow: '0 0 6px rgba(255,215,0,.3)',
        }}>CHAMPIONS</span>
        <button
          onClick={onNavigateToChampions}
          style={{
            fontFamily: '"Press Start 2P",monospace',
            fontSize: 7,
            color: 'rgba(255,215,0,.45)',
            background: 'rgba(255,215,0,.06)',
            border: '1px solid rgba(255,215,0,.15)',
            borderRadius: 3,
            padding: '.18rem .4rem',
            cursor: 'pointer',
            letterSpacing: 1,
          }}
        >ALL →</button>
      </div>

      {/* Rows */}
      <div style={{ padding: '.1rem 0' }}>
        {loading
          ? [1,2,3,4,5].map(i => (
              <div key={i} style={{
                height: 36,
                margin: '.2rem .72rem',
                borderRadius: 4,
                background: 'linear-gradient(90deg,rgba(255,255,255,.03),rgba(255,255,255,.07),rgba(255,255,255,.03))',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.6s infinite',
              }} />
            ))
          : recent.map((row, i) => (
              <div
                key={row.lg}
                onClick={onNavigateToChampions}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && onNavigateToChampions()}
                aria-label={`${row.lg} champion: ${row.championName}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '.38rem',
                  padding: '.32rem .68rem',
                  borderBottom: i < recent.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                  cursor: 'pointer',
                  transition: 'background .1s',
                  background: i === 0 ? 'rgba(255,215,0,.04)' : 'transparent',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,215,0,.07)'}
                onMouseLeave={e => e.currentTarget.style.background = i === 0 ? 'rgba(255,215,0,.04)' : 'transparent'}
              >
                <span style={{
                  fontFamily: '"Press Start 2P",monospace',
                  fontSize: 8,
                  color: i === 0 ? '#FFD700' : 'rgba(255,255,255,.55)',
                  minWidth: 24,
                  flexShrink: 0,
                }}>{row.lg}</span>

                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: 4,
                  background: 'rgba(255,255,255,.04)',
                  border: `1px solid ${i === 0 ? 'rgba(255,215,0,.2)' : 'rgba(255,255,255,.07)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  boxShadow: i === 0 ? '0 0 6px rgba(255,215,0,.15)' : 'none',
                }}>
                  <img
                    src={`/assets/teamLogos/${row.championAbr}.png`}
                    alt=""
                    aria-hidden="true"
                    style={{ width: 24, height: 24, objectFit: 'contain' }}
                    onError={e => { e.currentTarget.style.display = 'none' }}
                  />
                </div>

                <span style={{
                  flex: 1,
                  fontFamily: '"Press Start 2P",monospace',
                  fontSize: 9,
                    color: i === 0 ? '#FFD700' : 'rgba(255,255,255,.85)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>{row.championAbr}</span>

                {row.seriesResult && (
                  <span style={{
                    fontFamily: '"VT323",monospace',
                    fontSize: 18,
                    color: 'rgba(255,255,255,.6)',
                    flexShrink: 0,
                  }}>{row.seriesResult}</span>
                )}

                {row.runnerUpAbr && (
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: 3,
                    background: 'rgba(255,255,255,.03)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    filter: 'grayscale(.5)',
                    opacity: .5,
                  }}>
                    <img
                      src={`/assets/teamLogos/${row.runnerUpAbr}.png`}
                      alt=""
                      aria-hidden="true"
                      style={{ width: 17, height: 17, objectFit: 'contain' }}
                      onError={e => { e.currentTarget.style.display = 'none' }}
                    />
                  </div>
                )}

                <span style={{ fontSize: 10, color: 'rgba(255,255,255,.12)' }} aria-hidden="true">→</span>
              </div>
            ))
        }
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
    </section>
  )
}

// ── Full Champions page ────────────────────────────────────────────────────────
function TitleLeaderboard({ rows }) {
    const counts = useMemo(() => {
      const map = {}
      rows.forEach(r => {
        if (!map[r.championAbr]) map[r.championAbr] = { abr: r.championAbr, name: r.championName, count: 0 }
        map[r.championAbr].count++
      })
      return Object.values(map).sort((a, b) => b.count - a.count)
    }, [rows])
  
    if (!counts.length) return null
    const max = counts[0].count
  
    return (
      <div style={{
        marginTop: '2.5rem',
        borderTop: '1px solid rgba(255,255,255,.06)',
        paddingTop: '2rem',
      }}>
        <div style={{
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '1rem',
  marginBottom: '1.8rem',
}}>
  <div style={{ height: 1, width: 60, background: 'linear-gradient(90deg,transparent,rgba(255,215,0,.3))' }} />
  <span style={{
    fontFamily: '"Press Start 2P",monospace',
    fontSize: 10,
    color: 'rgba(255,215,0,.5)',
    letterSpacing: 5,
    textShadow: '0 0 20px rgba(255,215,0,.2)',
  }}>BRULE COUNT</span>
  <div style={{ height: 1, width: 60, background: 'linear-gradient(90deg,rgba(255,215,0,.3),transparent)' }} />
</div>
  
  <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem', maxWidth: 480, margin: '0 auto' }}>
          {counts.map((t) => (
            <div key={t.abr} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '.6rem .9rem',
              borderRadius: 8,
              background: 'rgba(255,255,255,.02)',
              border: '1px solid rgba(255,255,255,.05)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* fill bar */}
              <div style={{
                position: 'absolute',
                inset: 0,
                width: `${(t.count / max) * 100}%`,
                background: 'linear-gradient(90deg, rgba(255,215,0,.06) 0%, transparent 100%)',
                pointerEvents: 'none',
              }} />
  
              <img
                src={`/assets/teamLogos/${t.abr}.png`}
                alt={t.name}
                style={{ width: 42, height: 42, objectFit: 'contain', flexShrink: 0, position: 'relative', zIndex: 1 }}
                onError={e => { e.currentTarget.style.opacity = '0' }}
              />
  
              <span style={{
                flex: 1,
                fontFamily: '"Press Start 2P",monospace',
                fontSize: 9,
                color: 'rgba(255,255,255,.55)',
                letterSpacing: 1,
                position: 'relative',
                zIndex: 1,
              }}>{t.name}</span>
  
              <div style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '.3rem',
                position: 'relative',
                zIndex: 1,
                flexShrink: 0,
              }}>
                <span style={{
                  fontFamily: '"VT323",monospace',
                  fontSize: 38,
                  lineHeight: 1,
                  color: t.count === max ? 'rgba(255,215,0,.9)' : 'rgba(255,255,255,.35)',
                  textShadow: t.count === max ? '0 0 20px rgba(255,215,0,.4)' : 'none',
                }}>{t.count}</span>
                
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }


export default function ChampionsPage() {
  const { rows, loading } = useChampionsData()
  const [bracketLg, setBracketLg] = useState(null)

  // Derive prefix from first row's lg (e.g. "W17" → "W")
  const prefix = useMemo(() => rows[0]?.prefix || 'W', [rows])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse 100% 40% at 50% -5%, #0f0f28, transparent 55%), #04040c',
      paddingBottom: '4rem',
      fontFamily: '"VT323",monospace',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Scanlines */}
      <div style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 9997,
        background: 'repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.055) 2px,rgba(0,0,0,.055) 4px)',
      }} aria-hidden="true" />

      {/* Ambient glow */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 30% at 50% 10%, rgba(255,215,0,.06), transparent 60%)',
      }} aria-hidden="true" />

      <style>{`
        @keyframes trophyFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1rem', position: 'relative', zIndex: 2 }}>

        {/* Trophy hero */}
        <TrophyHero prefix={prefix} />

        {/* Divider */}
        <div style={{
          height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(255,215,0,.25),transparent)',
          marginBottom: '2rem',
        }} />

        {/* Champion cards */}
        {loading
          ? [1,2,3].map(i => (
              <div key={i} style={{
                height: 160,
                borderRadius: 12,
                background: 'rgba(255,255,255,.02)',
                border: '1px solid rgba(255,255,255,.05)',
                marginBottom: '1.25rem',
                animation: 'shimmer 1.6s infinite',
                backgroundSize: '200% 100%',
                backgroundImage: 'linear-gradient(90deg,rgba(255,255,255,.02),rgba(255,255,255,.05),rgba(255,255,255,.02))',
              }} />
            ))
          : rows.map((row, i) => (
              <ChampionCard
                key={row.lg}
                row={row}
                index={i}
                onShowBracket={(lg) => setBracketLg(lg)}
              />
            ))
        }

        {!loading && rows.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            fontFamily: '"Press Start 2P",monospace',
            fontSize: 10,
            color: 'rgba(255,255,255,.2)',
            letterSpacing: 2,
            lineHeight: 2,
          }}>NO CHAMPIONS CROWNED YET</div>
        )}

        {/* Footer stat */}
        {!loading && rows.length > 0 && (
          <div style={{
            textAlign: 'center',
            marginTop: '1rem',
            fontFamily: '"VT323",monospace',
            fontSize: 22,
            color: 'rgba(255,255,255,.45)',
            letterSpacing: 3,
            lineHeight: 2.5,
          }}>
            {rows.length} SEASONS · {new Set(rows.map(r => r.championAbr)).size} DIFFERENT CHAMPIONS
          </div>
        )}
      </div>

      {!loading && rows.length > 0 && <TitleLeaderboard rows={rows} />}

      {/* Bracket popup */}
      {bracketLg && (
        <BracketModal
          lg={bracketLg}
          onClose={() => setBracketLg(null)}
        />
      )}
    </div>
  )
}
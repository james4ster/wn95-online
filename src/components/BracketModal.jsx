import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../utils/supabaseClient'
import PlayoffBracket from './PlayoffBracket'

/*
  BracketModal
  ─────────────
  Fetches playoff_games + season games for the given lg,
  then renders <PlayoffBracket> in a full-screen portal overlay.
  Mirrors exactly what Standings.jsx does for the playoffs view.

  Props:
    lg       — season string e.g. "W16"
    onClose  — called when ✕ or backdrop clicked
*/
export default function BracketModal({ lg, onClose }) {
  const overlayRef = useRef(null)
  const [playoffGames, setPlayoffGames] = useState([])
  const [seasonGames, setSeasonGames] = useState([])
  const [playoffTeams, setPlayoffTeams] = useState(null)
  const [loading, setLoading] = useState(true)

  // Derive prefix e.g. "W17" → "W"
  const selectedLeague = lg.replace(/[0-9]/g, '').trim()

  // Fetch data — same queries Standings uses
  useEffect(() => {
    if (!lg) return
    setLoading(true)

    Promise.all([
      supabase
        .from('playoff_games')
        .select('lg,round,series_number,game_number,team_code_a,team_code_b,team_a_score,team_b_score,game_date,seed_a,seed_b')
        .eq('lg', lg)
        .order('game_number', { ascending: true }),
      supabase
        .from('games')
        .select('id,home,away,score_home,score_away,ot,coach_home,coach_away')
        .eq('lg', lg)
        .ilike('mode', 'season')
        .not('score_home', 'is', null)
        .order('id', { ascending: true }),
      supabase
        .from('seasons')
        .select('playoff_teams')
        .eq('lg', lg)
        .single(),
    ]).then(([pgRes, sgRes, seasonRes]) => {
      setPlayoffGames(pgRes.data || [])
      setSeasonGames(sgRes.data || [])
      setPlayoffTeams(seasonRes.data?.playoff_teams ?? null)
      setLoading(false)
    })
  }, [lg])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Lock body scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const handleBackdropClick = (e) => {
    if (e.target === overlayRef.current) onClose()
  }

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,.88)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        overflowY: 'auto',
        padding: '2rem 1rem',
        backdropFilter: 'blur(4px)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${lg} playoff bracket`}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1200,
          background: '#07071a',
          border: '1px solid rgba(255,140,0,.2)',
          borderRadius: 12,
          overflow: 'hidden',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '.65rem 1rem',
          background: 'linear-gradient(90deg,rgba(255,140,0,.08),transparent)',
          borderBottom: '1px solid rgba(255,140,0,.12)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <span style={{ fontSize: 14 }}>🏒</span>
            <span style={{
              fontFamily: '"Press Start 2P",monospace',
              fontSize: 10,
              color: '#FF8C00',
              letterSpacing: 2,
            }}>
              {lg} PLAYOFF BRACKET
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close bracket"
            style={{
              background: 'rgba(220,0,0,.15)',
              border: '1px solid rgba(220,0,0,.35)',
              borderRadius: 6,
              color: 'rgba(255,80,80,.8)',
              cursor: 'pointer',
              fontFamily: '"Press Start 2P",monospace',
              fontSize: 10,
              padding: '.3rem .6rem',
              lineHeight: 1,
              transition: 'all .15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(220,0,0,.3)'
              e.currentTarget.style.color = '#fff'
              e.currentTarget.style.borderColor = 'rgba(220,0,0,.6)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(220,0,0,.15)'
              e.currentTarget.style.color = 'rgba(255,80,80,.8)'
              e.currentTarget.style.borderColor = 'rgba(220,0,0,.35)'
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1rem', overflowX: 'auto' }}>
          {loading ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 300,
              gap: '1.5rem',
            }}>
              <div style={{
                width: 48,
                height: 48,
                border: '5px solid rgba(255,140,0,.2)',
                borderTop: '5px solid #FFD700',
                borderRadius: '50%',
                animation: 'bracketSpin 1s linear infinite',
              }} />
              <span style={{
                fontFamily: '"Press Start 2P",monospace',
                fontSize: 9,
                color: '#87CEEB',
                letterSpacing: 2,
              }}>LOADING BRACKET...</span>
              <style>{`@keyframes bracketSpin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : playoffGames.length === 0 ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 200,
              fontFamily: '"Press Start 2P",monospace',
              fontSize: 10,
              color: 'rgba(255,255,255,.3)',
              letterSpacing: 2,
            }}>
              NO BRACKET DATA FOR {lg}
            </div>
          ) : (
            <PlayoffBracket
              playoffGames={playoffGames}
              seasonGames={seasonGames}
              selectedSeason={lg}
              selectedLeague={selectedLeague}
              playoffTeams={playoffTeams}
              onSeriesClick={() => {}}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
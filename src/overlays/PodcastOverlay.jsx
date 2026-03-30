import { useState, useEffect, useRef } from 'react'
import { supabase } from '../utils/supabaseClient'

// ─── placeholder imports – swap for your real components ───
// import Standings from './Standings'
// import PlayoffBracket from './PlayoffBracket'
// import H2H from './H2H'
// import PlayerStats from './PlayerStats'

const YOUTUBE_URL = 'https://www.youtube.com/@BellNBellNHL95Podcast'
const TWITCH_URL  = 'https://www.twitch.tv/shawntbay'

// ── SVG icons ──────────────────────────────────────────────
const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4l6.3 3.6-6.3 3.6z"/>
  </svg>
)
const TwitchIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M11.6 6H13v4.5h-1.4V6zm3.8 0h1.4v4.5h-1.4V6zM2.4 0L0 2.6v18.8h6V24l3.4-2.6H13l6-6V0H2.4zm15.2 14.6-3 2.6H11l-2.4 2.4v-2.4H4.8V1.8h12.8v12.8z"/>
  </svg>
)

// ── Ticker ──────────────────────────────────────────────────
function Ticker({ items }) {
  const ref = useRef(null)
  if (!items || items.length === 0) return null
  const text = items.join('   ·   ')
  return (
    <div style={{ overflow: 'hidden', width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}>
      <style>{`
        @keyframes bnb-ticker {
          0%   { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .bnb-ticker-inner {
          display: inline-block;
          white-space: nowrap;
          animation: bnb-ticker 30s linear infinite;
          color: #e0e0e0;
          font-family: 'Barlow Condensed', 'Oswald', sans-serif;
          font-size: 13px;
          letter-spacing: 0.04em;
        }
      `}</style>
      <span className="bnb-ticker-inner">{text}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{text}</span>
    </div>
  )
}

// ── Content panel ────────────────────────────────────────────
function ContentPanel({ scene, data }) {
  if (scene === 'logo' || !scene) return <LogoSlate />

  // These render your actual app components.
  // Replace the placeholder divs with real imports once wired up.
  const panels = {
    standings:  <PlaceholderPanel label="Standings" icon="🏒" />,
    bracket:    <PlaceholderPanel label="Playoff Bracket" icon="🏆" />,
    h2h:        <PlaceholderPanel label="Head-to-Head" icon="⚔️" data={data} />,
    playerstats:<PlaceholderPanel label="Player Stats" icon="📊" />,
  }
  return panels[scene] || <LogoSlate />
}

function PlaceholderPanel({ label, icon }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 16,
    }}>
      <div style={{ fontSize: 48, opacity: 0.15 }}>{icon}</div>
      <div style={{
        fontFamily: "'Barlow Condensed', 'Oswald', sans-serif",
        fontSize: 28, fontWeight: 700,
        color: '#cc1a1a', letterSpacing: '0.1em',
        textTransform: 'uppercase', opacity: 0.4,
      }}>{label}</div>
      <div style={{ fontSize: 11, color: '#444', fontFamily: 'monospace' }}>
        component pending
      </div>
    </div>
  )
}

// ── Logo / Holding Slate ─────────────────────────────────────
function LogoSlate() {
  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 24, position: 'relative',
    }}>
      {/* Scanline texture overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
        pointerEvents: 'none',
      }} />

      {/* Logo area */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
        zIndex: 1,
      }}>
        {/* Logo image — swap src when clean PNG is available */}
        <div style={{
          width: 140, height: 140,
          borderRadius: 8,
          background: '#0d0d0d',
          border: '1px solid #2a0a0a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <img
            src="/assets/bellnbell-logo.png"
            alt="Bell-N-Bell"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
          />
          {/* Fallback if image missing */}
          <div style={{
            display: 'none', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', width: '100%', height: '100%',
          }}>
            <div style={{
              fontFamily: "'Barlow Condensed', 'Oswald', sans-serif",
              fontSize: 22, fontWeight: 900, color: '#cc1a1a',
              letterSpacing: '0.05em', lineHeight: 1.1, textAlign: 'center',
            }}>
              BELL<br/>N<br/>BELL
            </div>
          </div>
        </div>

        {/* Title lockup */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: "'Barlow Condensed', 'Oswald', sans-serif",
            fontSize: 32, fontWeight: 900,
            color: '#ffffff', letterSpacing: '0.12em',
            textTransform: 'uppercase', lineHeight: 1,
          }}>BELL-N-BELL</div>
          <div style={{
            fontFamily: "'Barlow Condensed', 'Oswald', sans-serif",
            fontSize: 13, fontWeight: 500,
            color: '#cc1a1a', letterSpacing: '0.25em',
            textTransform: 'uppercase', marginTop: 4,
          }}>THE NHL95 PODCAST</div>
        </div>
      </div>

      {/* Red divider line */}
      <div style={{ width: 180, height: 1, background: 'linear-gradient(90deg, transparent, #cc1a1a, transparent)', zIndex: 1 }} />

      {/* Social links — only shown on holding slate */}
      <div style={{ display: 'flex', gap: 20, zIndex: 1 }}>
        <a
          href={YOUTUBE_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            color: '#ff4444', textDecoration: 'none',
            fontFamily: "'Barlow Condensed', 'Oswald', sans-serif",
            fontSize: 12, fontWeight: 600, letterSpacing: '0.1em',
            padding: '6px 12px',
            border: '1px solid rgba(204,26,26,0.3)',
            borderRadius: 3,
            background: 'rgba(204,26,26,0.08)',
            transition: 'background 0.2s',
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(204,26,26,0.18)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(204,26,26,0.08)'}
        >
          <YouTubeIcon /> YOUTUBE
        </a>
        <a
          href={TWITCH_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            color: '#a970ff', textDecoration: 'none',
            fontFamily: "'Barlow Condensed', 'Oswald', sans-serif",
            fontSize: 12, fontWeight: 600, letterSpacing: '0.1em',
            padding: '6px 12px',
            border: '1px solid rgba(169,112,255,0.3)',
            borderRadius: 3,
            background: 'rgba(169,112,255,0.08)',
            transition: 'background 0.2s',
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(169,112,255,0.18)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(169,112,255,0.08)'}
        >
          <TwitchIcon /> TWITCH
        </a>
      </div>
    </div>
  )
}

// ── Main overlay ─────────────────────────────────────────────
export default function PodcastOverlay() {
  const [state, setState] = useState({
    scene: 'logo',
    ticker_mode: 'scores',     // 'scores' | 'custom'
    ticker_text: '',
    ep_number: '',
    ep_date: '',
  })
  const [tickerItems, setTickerItems] = useState([])
  const [prevScene, setPrevScene] = useState(null)
  const [transitioning, setTransitioning] = useState(false)

  // ── Supabase realtime subscription ──────────────────────────
  useEffect(() => {
    // Fetch initial state
    supabase
      .from('podcast_overlay_state')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => { if (data) applyState(data) })

    // Subscribe to changes
    const channel = supabase
      .channel('podcast_overlay')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'podcast_overlay_state',
        filter: 'id=eq.1',
      }, ({ new: newState }) => applyState(newState))
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  // ── Fetch ticker data when mode is 'scores' ──────────────────
  useEffect(() => {
    if (state.ticker_mode === 'scores') {
      supabase
        .from('games')
        .select('home_team, away_team, home_score, away_score, game_date')
        .order('game_date', { ascending: false })
        .limit(8)
        .then(({ data }) => {
          if (data) {
            setTickerItems(data.map(g =>
              `${g.away_team} ${g.away_score} — ${g.home_team} ${g.home_score}`
            ))
          }
        })
    } else if (state.ticker_mode === 'custom' && state.ticker_text) {
      setTickerItems(state.ticker_text.split('|').map(s => s.trim()).filter(Boolean))
    }
  }, [state.ticker_mode, state.ticker_text])

  function applyState(newState) {
    setTransitioning(true)
    setTimeout(() => {
      setState(prev => ({ ...prev, ...newState }))
      setTransitioning(false)
    }, 280)
  }

  const containerStyle = {
    width: '1920px',
    height: '1080px',
    position: 'relative',
    background: '#0a0a0a',
    overflow: 'hidden',
    fontFamily: "'Barlow Condensed', 'Oswald', sans-serif",
  }

  // ── Layout constants ─────────────────────────────────────────
  const TOP_H       = 52
  const BOTTOM_H    = 38
  const LEFT_W      = 560   // ~29% for video
  const DIVIDER_W   = 2
  const CONTENT_X   = LEFT_W + DIVIDER_W
  const CONTENT_W   = 1920 - CONTENT_X
  const BODY_TOP    = TOP_H
  const BODY_BOTTOM = 1080 - BOTTOM_H
  const BODY_H      = BODY_BOTTOM - BODY_TOP
  const SLOT_H      = Math.floor(BODY_H / 3)   // 330px each

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet" />

      <div style={containerStyle}>

        {/* ── Noise/grain overlay ── */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 100, pointerEvents: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          opacity: 0.4,
        }} />

        {/* ══════════════════════════════════════════
            TOP BAR
        ══════════════════════════════════════════ */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          height: TOP_H,
          background: '#0f0f0f',
          borderBottom: '1px solid #1e1e1e',
          display: 'flex', alignItems: 'center',
          zIndex: 10,
        }}>
          {/* Red left accent bar */}
          <div style={{ width: 3, height: '100%', background: '#cc1a1a', flexShrink: 0 }} />

          {/* EP + Date */}
          <div style={{ paddingLeft: 18, paddingRight: 32 }}>
            {state.ep_number && (
              <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', letterSpacing: '0.15em', lineHeight: 1 }}>
                EP {state.ep_number}
              </div>
            )}
            <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.1em', marginTop: 2 }}>
              {state.ep_date || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toUpperCase()}
            </div>
          </div>

          {/* Vertical divider */}
          <div style={{ width: 1, height: 28, background: '#1e1e1e' }} />

          {/* Center — Logo */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 28, height: 1, background: 'linear-gradient(90deg, transparent, #cc1a1a)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <img
                src="/assets/bellnbell-logo.png"
                alt=""
                style={{ height: 34, width: 'auto', objectFit: 'contain' }}
                onError={e => e.target.style.display = 'none'}
              />
              <div>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '0.12em', lineHeight: 1 }}>
                  BELL-N-BELL
                </div>
                <div style={{ fontSize: 9, color: '#cc1a1a', letterSpacing: '0.3em', marginTop: 1 }}>
                  THE NHL95 PODCAST
                </div>
              </div>
            </div>
            <div style={{ width: 28, height: 1, background: 'linear-gradient(90deg, #cc1a1a, transparent)' }} />
          </div>

          {/* Vertical divider */}
          <div style={{ width: 1, height: 28, background: '#1e1e1e' }} />

          {/* Live bug + clock */}
          <div style={{ paddingLeft: 24, paddingRight: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', background: '#cc1a1a',
                boxShadow: '0 0 6px #cc1a1a',
                animation: 'bnb-pulse 2s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#cc1a1a', letterSpacing: '0.2em' }}>LIVE</span>
            </div>
            <LiveClock />
          </div>
        </div>

        {/* ══════════════════════════════════════════
            LEFT — VIDEO SLOTS
        ══════════════════════════════════════════ */}
        <div style={{
          position: 'absolute',
          top: TOP_H, left: 0,
          width: LEFT_W, height: BODY_H,
          background: '#080808',
          borderRight: '1px solid #1a1a1a',
        }}>
          {/* Section label */}
          <div style={{
            position: 'absolute', top: 8, left: 14,
            fontSize: 9, color: '#2a2a2a', letterSpacing: '0.2em', fontWeight: 600,
          }}>VIDEO FEEDS</div>

          {[
            { label: 'HOST 1', active: true },
            { label: 'HOST 2', active: true },
            { label: 'GUEST', active: false },
          ].map((slot, i) => (
            <div key={i} style={{
              position: 'absolute',
              top: i * SLOT_H,
              left: 0, width: LEFT_W, height: SLOT_H,
              borderBottom: i < 2 ? '1px solid #141414' : 'none',
            }}>
              {/* Top accent bar */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: slot.active ? '#cc1a1a' : '#1e1e1e',
                opacity: slot.active ? 0.8 : 1,
              }} />

              {/* Slot inner — transparent so OBS video shows through */}
              <div style={{
                position: 'absolute',
                top: 2, left: 12, right: 12, bottom: 12,
                border: slot.active
                  ? '1px solid rgba(204,26,26,0.2)'
                  : '1px dashed #1e1e1e',
                borderRadius: 2,
                background: slot.active ? 'transparent' : 'rgba(255,255,255,0.01)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {!slot.active && (
                  <span style={{ fontSize: 10, color: '#222', letterSpacing: '0.15em' }}>
                    {slot.label}
                  </span>
                )}
              </div>

              {/* Active indicator dot */}
              <div style={{
                position: 'absolute', top: 10, left: 22,
                width: 6, height: 6, borderRadius: '50%',
                background: slot.active ? '#cc1a1a' : '#1e1e1e',
                boxShadow: slot.active ? '0 0 5px #cc1a1a' : 'none',
              }} />

              {/* Name tag at bottom */}
              <div style={{
                position: 'absolute', bottom: 16, left: 20,
                fontSize: 11, fontWeight: 700, letterSpacing: '0.15em',
                color: slot.active ? 'rgba(255,255,255,0.5)' : '#1e1e1e',
              }}>{slot.label}</div>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════
            DIVIDER — thin vertical line with accent
        ══════════════════════════════════════════ */}
        <div style={{
          position: 'absolute',
          top: TOP_H, left: LEFT_W,
          width: DIVIDER_W, height: BODY_H,
          background: '#cc1a1a',
          opacity: 0.35,
        }} />

        {/* ══════════════════════════════════════════
            RIGHT — MAIN CONTENT PANEL
        ══════════════════════════════════════════ */}
        <div style={{
          position: 'absolute',
          top: TOP_H, left: CONTENT_X,
          width: CONTENT_W, height: BODY_H,
          background: '#0a0a0a',
          transition: 'opacity 0.28s ease',
          opacity: transitioning ? 0 : 1,
        }}>
          <ContentPanel scene={state.scene} data={state} />
        </div>

        {/* ══════════════════════════════════════════
            BOTTOM BAR — lower third ticker
        ══════════════════════════════════════════ */}
        <div style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: BOTTOM_H,
          background: '#0f0f0f',
          borderTop: '1px solid #1a1a1a',
          display: 'flex', alignItems: 'center',
          zIndex: 10,
        }}>
          {/* Red label pill */}
          <div style={{
            flexShrink: 0,
            height: '100%',
            padding: '0 16px',
            background: '#cc1a1a',
            display: 'flex', alignItems: 'center',
            clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)',
          }}>
            <span style={{
              fontSize: 10, fontWeight: 900, color: '#fff', letterSpacing: '0.2em',
            }}>WN95</span>
          </div>

          {/* Scene label */}
          <div style={{
            flexShrink: 0, padding: '0 16px 0 12px',
            fontSize: 10, fontWeight: 700, color: '#cc1a1a',
            letterSpacing: '0.2em', textTransform: 'uppercase',
            borderRight: '1px solid #1e1e1e',
          }}>
            {state.scene === 'logo' ? 'ON AIR' : state.scene?.replace('_', ' ') || 'ON AIR'}
          </div>

          {/* Ticker */}
          <div style={{ flex: 1, paddingLeft: 16, overflow: 'hidden', height: '100%', display: 'flex', alignItems: 'center' }}>
            <Ticker items={tickerItems} />
          </div>
        </div>

        {/* Pulse animation */}
        <style>{`
          @keyframes bnb-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>

      </div>
    </>
  )
}

function LiveClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setTime(fmt())
    const t = setInterval(() => setTime(fmt()), 1000)
    return () => clearInterval(t)
  }, [])
  return (
    <span style={{
      fontSize: 11, color: '#333', letterSpacing: '0.1em',
      fontFamily: 'monospace',
    }}>{time}</span>
  )
}

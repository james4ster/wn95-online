import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabaseClient'

const SCENES = [
  { key: 'logo',        label: 'Intro Slate',     icon: '🎙️', desc: 'Logo + social links' },
  { key: 'standings',   label: 'Standings',        icon: '🏒', desc: 'League table' },
  { key: 'bracket',     label: 'Playoff Bracket',  icon: '🏆', desc: 'Bracket view' },
  { key: 'h2h',         label: 'Head-to-Head',     icon: '⚔️', desc: 'Pick two teams' },
  { key: 'playerstats', label: 'Player Stats',     icon: '📊', desc: 'Leaderboard' },
]

export default function PodcastCtrl() {
  const [state, setState] = useState({
    scene: 'logo',
    ticker_mode: 'scores',
    ticker_text: '',
    ep_number: '',
    ep_date: '',
  })
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [liveScene, setLiveScene] = useState('logo')

  useEffect(() => {
    supabase
      .from('podcast_overlay_state')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) {
          setState({ ...data })
          setLiveScene(data.scene)
        }
      })

    const channel = supabase
      .channel('ctrl_sync')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'podcast_overlay_state',
        filter: 'id=eq.1',
      }, ({ new: s }) => setLiveScene(s.scene))
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  async function push(patch) {
    const next = { ...state, ...patch }
    setState(next)
    setSaving(true)
    const { error } = await supabase
      .from('podcast_overlay_state')
      .update({ ...next, updated_at: new Date().toISOString() })
      .eq('id', 1)
    setSaving(false)
    if (!error) setLastSaved(new Date())
  }

  const s = {
    root: {
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#e0e0e0',
      fontFamily: "'Barlow Condensed', 'Oswald', sans-serif",
      padding: '0 0 60px',
    },
    header: {
      background: '#0f0f0f',
      borderBottom: '1px solid #1e1e1e',
      padding: '14px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    logo: {
      fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '0.12em',
    },
    subtitle: { fontSize: 11, color: '#cc1a1a', letterSpacing: '0.2em', marginTop: 2 },
    status: {
      display: 'flex', alignItems: 'center', gap: 8,
      fontSize: 11, color: '#555', letterSpacing: '0.1em',
    },
    dot: (active) => ({
      width: 7, height: 7, borderRadius: '50%',
      background: active ? '#cc1a1a' : '#333',
      boxShadow: active ? '0 0 5px #cc1a1a' : 'none',
    }),
    section: {
      padding: '20px 24px 0',
    },
    sectionLabel: {
      fontSize: 10, color: '#444', letterSpacing: '0.25em',
      fontWeight: 700, marginBottom: 12,
      textTransform: 'uppercase',
    },
    sceneGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 10,
    },
    sceneBtn: (active, isLive) => ({
      padding: '14px 12px',
      background: active ? 'rgba(204,26,26,0.15)' : '#111',
      border: isLive
        ? '1px solid #cc1a1a'
        : active
          ? '1px solid rgba(204,26,26,0.4)'
          : '1px solid #1e1e1e',
      borderRadius: 4,
      cursor: 'pointer',
      textAlign: 'left',
      transition: 'all 0.15s',
      position: 'relative',
    }),
    sceneBtnIcon: { fontSize: 20, lineHeight: 1, marginBottom: 6 },
    sceneBtnLabel: {
      fontSize: 14, fontWeight: 700, color: '#fff',
      letterSpacing: '0.05em', lineHeight: 1,
    },
    sceneBtnDesc: { fontSize: 11, color: '#555', marginTop: 3 },
    livePip: {
      position: 'absolute', top: 8, right: 8,
      fontSize: 9, color: '#cc1a1a', letterSpacing: '0.15em', fontWeight: 700,
    },
    divider: { height: 1, background: '#141414', margin: '20px 0' },
    row: { display: 'flex', gap: 10, alignItems: 'flex-start' },
    label: { fontSize: 11, color: '#555', letterSpacing: '0.15em', marginBottom: 6 },
    input: {
      width: '100%',
      background: '#111', border: '1px solid #1e1e1e',
      borderRadius: 3, padding: '9px 12px',
      color: '#e0e0e0', fontSize: 14,
      fontFamily: "'Barlow Condensed', sans-serif",
      outline: 'none',
      boxSizing: 'border-box',
    },
    tickerToggle: (active) => ({
      flex: 1, padding: '10px',
      background: active ? 'rgba(204,26,26,0.12)' : '#111',
      border: active ? '1px solid rgba(204,26,26,0.4)' : '1px solid #1e1e1e',
      borderRadius: 3, cursor: 'pointer',
      textAlign: 'center',
      fontSize: 12, fontWeight: 700,
      color: active ? '#ff6060' : '#555',
      letterSpacing: '0.1em',
      transition: 'all 0.15s',
    }),
    goLive: {
      display: 'block', width: '100%',
      padding: '16px',
      background: saving ? '#1a0808' : 'rgba(204,26,26,0.18)',
      border: '1px solid rgba(204,26,26,0.5)',
      borderRadius: 4,
      color: saving ? '#555' : '#ff4444',
      fontSize: 15, fontWeight: 900,
      letterSpacing: '0.2em', cursor: 'pointer',
      transition: 'all 0.15s',
      textTransform: 'uppercase',
      fontFamily: "'Barlow Condensed', sans-serif",
    },
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet" />
      <div style={s.root}>

        {/* Header */}
        <div style={s.header}>
          <div>
            <div style={s.logo}>BELL-N-BELL CTRL</div>
            <div style={s.subtitle}>OVERLAY CONTROLLER</div>
          </div>
          <div style={s.status}>
            <div style={s.dot(true)} />
            <span>OVERLAY CONNECTED</span>
            {lastSaved && (
              <span style={{ color: '#2a2a2a' }}>
                · saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Episode info */}
        <div style={s.section}>
          <div style={s.sectionLabel}>Episode Info</div>
          <div style={s.row}>
            <div style={{ flex: '0 0 100px' }}>
              <div style={s.label}>EPISODE #</div>
              <input
                style={s.input}
                placeholder="47"
                value={state.ep_number}
                onChange={e => setState(p => ({ ...p, ep_number: e.target.value }))}
                onBlur={() => push({ ep_number: state.ep_number })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={s.label}>DATE</div>
              <input
                style={s.input}
                type="date"
                value={state.ep_date}
                onChange={e => push({ ep_date: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div style={{ ...s.divider, margin: '20px 24px 0' }} />

        {/* Scene selector */}
        <div style={s.section}>
          <div style={s.sectionLabel}>Active Scene</div>
          <div style={s.sceneGrid}>
            {SCENES.map(scene => {
              const isActive = state.scene === scene.key
              const isLive = liveScene === scene.key
              return (
                <button
                  key={scene.key}
                  style={s.sceneBtn(isActive, isLive)}
                  onClick={() => push({ scene: scene.key })}
                >
                  {isLive && <div style={s.livePip}>● LIVE</div>}
                  <div style={s.sceneBtnIcon}>{scene.icon}</div>
                  <div style={s.sceneBtnLabel}>{scene.label}</div>
                  <div style={s.sceneBtnDesc}>{scene.desc}</div>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ ...s.divider, margin: '20px 24px 0' }} />

        {/* Ticker */}
        <div style={s.section}>
          <div style={s.sectionLabel}>Ticker Mode</div>
          <div style={s.row}>
            <button
              style={s.tickerToggle(state.ticker_mode === 'scores')}
              onClick={() => push({ ticker_mode: 'scores' })}
            >
              📺 RECENT SCORES
            </button>
            <button
              style={s.tickerToggle(state.ticker_mode === 'custom')}
              onClick={() => push({ ticker_mode: 'custom' })}
            >
              ✏️ CUSTOM TEXT
            </button>
          </div>

          {state.ticker_mode === 'custom' && (
            <div style={{ marginTop: 10 }}>
              <div style={s.label}>CUSTOM TICKER TEXT (separate items with |)</div>
              <input
                style={s.input}
                placeholder="Topic one | Topic two | Topic three"
                value={state.ticker_text}
                onChange={e => setState(p => ({ ...p, ticker_text: e.target.value }))}
                onBlur={() => push({ ticker_text: state.ticker_text })}
              />
            </div>
          )}
        </div>

        <div style={{ ...s.divider, margin: '20px 24px 0' }} />

        {/* Push to live */}
        <div style={s.section}>
          <button style={s.goLive} disabled={saving} onClick={() => push({})}>
            {saving ? 'PUSHING...' : '⬆ PUSH TO OVERLAY'}
          </button>
        </div>

      </div>
    </>
  )
}

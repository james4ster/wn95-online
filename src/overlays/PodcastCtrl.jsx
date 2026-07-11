import { useState, useEffect } from 'react'
import { supabase } from '../utils/supabaseClient'

const SCENES = [
  { key: 'logo',        label: 'Intro Slate',    icon: '🎙️', desc: 'Logo + social links' },
  { key: 'standings',   label: 'Standings',       icon: '🏒', desc: 'League table' },
  { key: 'bracket',     label: 'Playoff Bracket', icon: '🏆', desc: 'Bracket + H2H' },
  { key: 'h2h',         label: 'Head-to-Head',    icon: '⚔️', desc: 'Pick two teams' },
  { key: 'playerstats', label: 'Player Stats',    icon: '📊', desc: 'Leaderboard' },
]

export default function PodcastCtrl() {
  const [state, setState] = useState({
    scene: 'logo',
    ticker_mode: 'scores',
    ticker_text: '',
    ep_number: '',
    ep_date: '',
  })
  const [saving,     setSaving]     = useState(false)
  const [lastSaved,  setLastSaved]  = useState(null)
  const [liveScene,  setLiveScene]  = useState('logo')
  const [logoErr,    setLogoErr]    = useState(false)

  useEffect(() => {
    supabase
      .from('podcast_overlay_state')
      .select('*')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data) { setState({ ...data }); setLiveScene(data.scene) }
      })
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
    if (!error) { setLastSaved(new Date()); setLiveScene(next.scene) }
  }

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&display=swap" rel="stylesheet" />

      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #0a0a0a; }

        .ctrl-root {
          min-height: 100vh;
          background: #0a0a0a;
          color: #e0e0e0;
          font-family: 'Barlow Condensed', 'Oswald', sans-serif;
          padding-bottom: 60px;
        }

        /* ── HEADER ── */
        .ctrl-header {
          background: #0d0d0d;
          border-bottom: 1px solid #1a1a1a;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .ctrl-logo-img {
          height: 44px;
          width: auto;
          object-fit: contain;
          filter: drop-shadow(0 0 6px rgba(204,26,26,0.4));
          flex-shrink: 0;
        }
        .ctrl-logo-fallback {
          display: flex;
          flex-direction: column;
        }
        .ctrl-logo-text { font-size: 18px; font-weight: 900; color: #fff; letter-spacing: 0.12em; }
        .ctrl-logo-sub  { font-size: 10px; color: #cc1a1a; letter-spacing: 0.2em; margin-top: 1px; }
        .ctrl-status {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 11px;
          color: #444;
          letter-spacing: 0.1em;
          flex-shrink: 0;
        }
        .ctrl-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #cc1a1a;
          box-shadow: 0 0 5px #cc1a1a;
          flex-shrink: 0;
        }
        .ctrl-saved { color: #2a2a2a; font-size: 10px; white-space: nowrap; }

        /* ── SECTIONS ── */
        .ctrl-section { padding: 18px 20px 0; }
        .ctrl-section-label {
          font-size: 10px; color: #3a3a3a; letter-spacing: 0.25em;
          font-weight: 700; margin-bottom: 12px; text-transform: uppercase;
        }
        .ctrl-divider { height: 1px; background: #141414; margin: 18px 20px 0; }

        /* ── EPISODE ROW ── */
        .ctrl-ep-row { display: flex; gap: 10px; }
        .ctrl-ep-num { flex: 0 0 90px; }
        .ctrl-ep-date { flex: 1; }
        .ctrl-field-label { font-size: 11px; color: #444; letter-spacing: 0.15em; margin-bottom: 5px; }
        .ctrl-input {
          width: 100%;
          background: #111; border: 1px solid #1e1e1e; border-radius: 4;
          padding: 10px 12px;
          color: #e0e0e0; font-size: 15px;
          font-family: 'Barlow Condensed', sans-serif;
          outline: none;
          -webkit-appearance: none;
          border-radius: 4px;
        }
        .ctrl-input:focus { border-color: rgba(204,26,26,0.4); }

        /* ── SCENE GRID — 1 column on mobile, 3 on wider ── */
        .ctrl-scene-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        @media (min-width: 560px) {
          .ctrl-scene-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
          }
        }

        .ctrl-scene-btn {
          padding: 14px 16px;
          background: #111;
          border: 1px solid #1e1e1e;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s;
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
        }
        @media (min-width: 560px) {
          .ctrl-scene-btn { flex-direction: column; gap: 4px; }
          .ctrl-scene-btn .btn-icon { margin-bottom: 2px; }
        }
        .ctrl-scene-btn.active {
          background: rgba(204,26,26,0.12);
          border-color: rgba(204,26,26,0.4);
        }
        .ctrl-scene-btn.live {
          border-color: #cc1a1a;
          background: rgba(204,26,26,0.12);
        }
        .btn-icon { font-size: 22px; line-height: 1; flex-shrink: 0; }
        .btn-body { display: flex; flex-direction: column; gap: 2px; flex: 1; }
        .btn-label { font-size: 16px; font-weight: 700; color: #fff; letter-spacing: 0.05em; line-height: 1; }
        .btn-desc  { font-size: 12px; color: #555; line-height: 1; }
        .live-pip  {
          position: absolute; top: 8px; right: 10px;
          font-size: 9px; color: #cc1a1a; letter-spacing: 0.15em; font-weight: 700;
          font-family: 'Barlow Condensed', sans-serif;
        }

        /* ── TICKER ── */
        .ctrl-ticker-row { display: flex; gap: 8px; }
        .ctrl-ticker-btn {
          flex: 1; padding: 11px 8px;
          background: #111; border: 1px solid #1e1e1e;
          border-radius: 4px; cursor: pointer;
          text-align: center;
          font-size: 13px; font-weight: 700;
          color: #555; letter-spacing: 0.1em;
          font-family: 'Barlow Condensed', sans-serif;
          transition: all 0.15s;
        }
        .ctrl-ticker-btn.active {
          background: rgba(204,26,26,0.1);
          border-color: rgba(204,26,26,0.4);
          color: #ff6060;
        }

        /* ── GO LIVE ── */
        .ctrl-go-live {
          display: block; width: 100%;
          padding: 18px;
          background: rgba(204,26,26,0.15);
          border: 1px solid rgba(204,26,26,0.5);
          border-radius: 6px;
          color: #ff4444;
          font-size: 16px; font-weight: 900;
          letter-spacing: 0.2em; cursor: pointer;
          transition: all 0.15s;
          text-transform: uppercase;
          font-family: 'Barlow Condensed', sans-serif;
          /* Tap target */
          min-height: 56px;
        }
        .ctrl-go-live:disabled {
          background: #1a0808;
          color: #444;
          cursor: default;
        }
        .ctrl-go-live:not(:disabled):active {
          background: rgba(204,26,26,0.25);
        }
      `}</style>

      <div className="ctrl-root">

        {/* Header */}
        <div className="ctrl-header">
          {!logoErr
            ? <img
                src="/assets/mediaLogos/bnbLogo.png"
                alt="Bell-n-Bell"
                className="ctrl-logo-img"
                onError={() => setLogoErr(true)}
              />
            : null
          }
          <div className="ctrl-logo-fallback">
            <div className="ctrl-logo-text">BELL-N-BELL</div>
            <div className="ctrl-logo-sub">OVERLAY CTRL</div>
          </div>
          <div className="ctrl-status">
            <div className="ctrl-dot" />
            <span>LIVE</span>
            {lastSaved && (
              <span className="ctrl-saved">· {lastSaved.toLocaleTimeString()}</span>
            )}
          </div>
        </div>

        {/* Episode info */}
        <div className="ctrl-section">
          <div className="ctrl-section-label">Episode Info</div>
          <div className="ctrl-ep-row">
            <div className="ctrl-ep-num">
              <div className="ctrl-field-label">EP #</div>
              <input
                className="ctrl-input"
                placeholder="47"
                value={state.ep_number}
                onChange={e => setState(p => ({ ...p, ep_number: e.target.value }))}
                onBlur={() => push({ ep_number: state.ep_number })}
              />
            </div>
            <div className="ctrl-ep-date">
              <div className="ctrl-field-label">DATE</div>
              <input
                className="ctrl-input"
                type="date"
                value={state.ep_date}
                onChange={e => push({ ep_date: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="ctrl-divider" />

        {/* Scene selector */}
        <div className="ctrl-section">
          <div className="ctrl-section-label">Active Scene</div>
          <div className="ctrl-scene-grid">
            {SCENES.map(scene => {
              const isActive = state.scene === scene.key
              const isLive   = liveScene === scene.key
              return (
                <button
                  key={scene.key}
                  className={`ctrl-scene-btn${isActive ? ' active' : ''}${isLive ? ' live' : ''}`}
                  onClick={() => push({ scene: scene.key })}
                >
                  {isLive && <div className="live-pip">● LIVE</div>}
                  <div className="btn-icon">{scene.icon}</div>
                  <div className="btn-body">
                    <div className="btn-label">{scene.label}</div>
                    <div className="btn-desc">{scene.desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="ctrl-divider" />

        {/* Ticker */}
        <div className="ctrl-section">
          <div className="ctrl-section-label">Ticker Mode</div>
          <div className="ctrl-ticker-row">
            <button
              className={`ctrl-ticker-btn${state.ticker_mode === 'scores' ? ' active' : ''}`}
              onClick={() => push({ ticker_mode: 'scores' })}
            >
              📺 RECENT SCORES
            </button>
            <button
              className={`ctrl-ticker-btn${state.ticker_mode === 'custom' ? ' active' : ''}`}
              onClick={() => push({ ticker_mode: 'custom' })}
            >
              ✏️ CUSTOM TEXT
            </button>
          </div>

          {state.ticker_mode === 'custom' && (
            <div style={{ marginTop: 10 }}>
              <div className="ctrl-field-label">CUSTOM TEXT (separate items with |)</div>
              <input
                className="ctrl-input"
                placeholder="Topic one | Topic two | Topic three"
                value={state.ticker_text}
                onChange={e => setState(p => ({ ...p, ticker_text: e.target.value }))}
                onBlur={() => push({ ticker_text: state.ticker_text })}
              />
            </div>
          )}
        </div>

        <div className="ctrl-divider" />

        {/* Push live */}
        <div className="ctrl-section">
          <button className="ctrl-go-live" disabled={saving} onClick={() => push({})}>
            {saving ? 'PUSHING...' : '⬆ PUSH TO OVERLAY'}
          </button>
        </div>

      </div>
    </>
  )
}
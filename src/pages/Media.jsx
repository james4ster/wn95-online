import React, { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';

function fmtViews(n) {
  if (!n) return '0';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000)    return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

function fmtDuration(secs) {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  return `${m}:${String(s).padStart(2,'0')}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  <  7) return `${days}d ago`;
  return fmtDate(iso);
}

/* ─── Card ──────────────────────────────────────────────────── */
function MediaCard({ item, rank, onClick }) {
  const [thumbErr,  setThumbErr]  = useState(false);
  const [avatarErr, setAvatarErr] = useState(false);

  const thumb = item.thumbnail_url
    ? item.thumbnail_url.replace('{width}','480').replace('{height}','272')
    : null;

  const isHighlight = item.media_type === 'highlight';

  return (
    <div className="mc" onClick={() => onClick(item)} style={{ '--i': rank }}>

      {/* Thumbnail */}
      <div className="mc-thumb">
        {!thumbErr && thumb
          ? <img src={thumb} alt={item.title} className="mc-img" onError={() => setThumbErr(true)} />
          : <div className="mc-thumb-blank"><span>📺</span></div>
        }
        <div className="mc-hover"><div className="mc-play">▶</div></div>

        {/* Type pill */}
        <div className={`mc-type ${isHighlight ? 'mc-type--hl' : 'mc-type--clip'}`}>
          {isHighlight ? '★ HIGHLIGHT' : '✂ CLIP'}
        </div>

        {/* Duration */}
        {item.duration > 0 && (
          <div className="mc-dur">{fmtDuration(Math.round(item.duration))}</div>
        )}

        {/* Live */}
        {item.is_live && (
          <div className="mc-live"><span className="mc-live-dot" />LIVE</div>
        )}
      </div>

      {/* Body */}
      <div className="mc-body">
        <div className="mc-title">{item.title}</div>

        {/* Broadcaster row */}
        <div className="mc-caster-row">
          <div className="mc-av">
            {!avatarErr && item.broadcaster_avatar
              ? <img src={item.broadcaster_avatar} alt="" className="mc-av-img"
                  referrerPolicy="no-referrer" onError={() => setAvatarErr(true)} />
              : <div className="mc-av-fb">{(item.broadcaster_name||'?')[0].toUpperCase()}</div>
            }
            {item.is_live && <div className="mc-av-ring" />}
          </div>
          <div className="mc-caster-info">
            <span className="mc-caster-name">{item.broadcaster_name}</span>
            <span className="mc-caster-handle">twitch.tv/{item.broadcaster_twitch}</span>
          </div>
        </div>

        {/* Date + views */}
        <div className="mc-footer-row">
          <span className="mc-date">{fmtDate(item.created_at)}</span>
          <span className="mc-views">👁 {fmtViews(item.view_count)}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal ─────────────────────────────────────────────────── */
function MediaModal({ item, onClose }) {
  const [avatarErr, setAvatarErr] = useState(false);

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  if (!item) return null;

  const isHighlight = item.media_type === 'highlight';
  const embedSrc = item.embed_url
    ? `${item.embed_url}&parent=${window.location.hostname}&autoplay=true`
    : null;

  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>✕</button>

        <div className="modal-embed">
          {embedSrc
            ? <iframe src={embedSrc} className="modal-iframe" allowFullScreen frameBorder="0" scrolling="no" title={item.title} />
            : <div className="modal-no-embed">
                <span style={{fontSize:'2rem'}}>📺</span>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="modal-ext-link">
                  WATCH ON TWITCH ↗
                </a>
              </div>
          }
        </div>

        <div className="modal-foot">
          <div className="modal-foot-left">
            <div className="modal-av">
              {!avatarErr && item.broadcaster_avatar
                ? <img src={item.broadcaster_avatar} alt="" className="modal-av-img"
                    referrerPolicy="no-referrer" onError={() => setAvatarErr(true)} />
                : <div className="modal-av-fb">{(item.broadcaster_name||'?')[0].toUpperCase()}</div>
              }
              {item.is_live && <div className="modal-av-ring" />}
            </div>
            <div>
              <div className="modal-title">{item.title}</div>
              <div className="modal-sub">
                <span className="modal-name">{item.broadcaster_name}</span>
                <span className="modal-sep">·</span>
                <span className="modal-handle">twitch.tv/{item.broadcaster_twitch}</span>
                {item.game_name && <><span className="modal-sep">·</span><span className="modal-game">{item.game_name}</span></>}
                <span className="modal-sep">·</span>
                <span className={`modal-pill ${isHighlight ? 'modal-pill--hl' : 'modal-pill--clip'}`}>
                  {isHighlight ? '★ HIGHLIGHT' : '✂ CLIP'}
                </span>
              </div>
            </div>
          </div>
          <div className="modal-foot-right">
            <div className="modal-stat"><span className="modal-sv">{fmtViews(item.view_count)}</span><span className="modal-sl">VIEWS</span></div>
            <div className="modal-stat"><span className="modal-sv">{fmtDuration(Math.round(item.duration||0))}</span><span className="modal-sl">LENGTH</span></div>
            <div className="modal-stat"><span className="modal-sv">{fmtDate(item.created_at)}</span><span className="modal-sl">POSTED</span></div>
            <div className="modal-links">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="modal-btn modal-btn--tw">TWITCH ↗</a>
              {item.is_live && (
                <a href={`https://twitch.tv/${item.broadcaster_twitch}`} target="_blank" rel="noopener noreferrer" className="modal-btn modal-btn--live">
                  <span className="mc-live-dot" style={{width:6,height:6}} /> WATCH LIVE
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════ */
export default function Media() {
  const [items,      setItems]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [activeItem, setActiveItem] = useState(null);
  const lastFetch = useRef(0);

  const fetchMedia = useCallback(async () => {
    if (Date.now() - lastFetch.current < 30_000) return;
    setLoading(true);
    setError(null);
    try {
      const result = await supabase.functions.invoke('twitch-highlights');
      if (result.error) throw new Error(result.error.message);
      const { clips = [] } = result.data || {};
      setItems(clips);
      lastFetch.current = Date.now();
    } catch (e) {
      setError(e.message || 'Failed to load media');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  const liveCount = [...new Set(
    items.filter(i => i.is_live).map(i => i.broadcaster_login)
  )].length;

  return (
    <div className="mp">
      <div className="mp-scanlines" aria-hidden />

      {/* ── Header ── */}
      <div className="mp-header-wrap">
        <div className="mp-header">
          <div className="mp-led">MEDIA</div>
        </div>
        <div className="mp-subtitle">Recent Highlights</div>
      </div>

      {/* ── Live banner ── */}
      {liveCount > 0 && !loading && (
        <div className="mp-live-bar">
          <span className="mp-live-dot" />
          <span className="mp-live-txt">
            {liveCount} LEAGUE MEMBER{liveCount > 1 ? 'S' : ''} LIVE RIGHT NOW
          </span>
          <span className="mp-live-dot" />
        </div>
      )}

      {/* ── States ── */}
      {loading ? (
        <div className="mp-loading">
          <div className="mp-spinner" />
          <div className="mp-loading-txt">LOADING HIGHLIGHTS...</div>
          <div className="mp-loading-sub">Fetching clips &amp; highlights from league streamers</div>
        </div>
      ) : error ? (
        <div className="mp-error">
          <div style={{fontSize:'2rem'}}>📡</div>
          <div className="mp-error-title">BROADCAST INTERRUPTED</div>
          <div className="mp-error-body">
            {error.includes('TWITCH_CLIENT_ID')
              ? 'Add TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET to your Supabase edge function secrets.'
              : error}
          </div>
          <button className="mp-retry" onClick={() => { lastFetch.current = 0; fetchMedia(); }}>↻ RETRY</button>
        </div>
      ) : items.length === 0 ? (
        <div className="mp-empty">
          <div style={{fontSize:'2.5rem',opacity:.3}}>🎬</div>
          <div className="mp-empty-title">NO MEDIA FOUND</div>
          <div className="mp-empty-sub">Make sure managers have <code>twitch_username</code> set and have posted clips or highlights.</div>
        </div>
      ) : (
        <div className="mp-grid">
          {items.map((item, i) => (
            <MediaCard key={item.id} item={item} rank={i} onClick={setActiveItem} />
          ))}
        </div>
      )}

      {activeItem && <MediaModal item={activeItem} onClose={() => setActiveItem(null)} />}

      <style>{`
        .mp {
          padding: 1rem 2rem 4rem;
          min-height: 100vh;
          background: radial-gradient(ellipse at top, #0a0a15 0%, #000 100%);
          position: relative; overflow-x: hidden;
        }
        .mp-scanlines {
          position: fixed; inset: 0; pointer-events: none; z-index: 9997;
          background: repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.04) 2px,rgba(0,0,0,.04) 4px);
        }

        /* ── HEADER ── */
        .mp-header-wrap { display: flex; flex-direction: column; align-items: center; margin-bottom: 1.75rem; gap: .6rem; }
        .mp-header {
          background: #000; border: 6px solid #333; border-radius: 8px; padding: 1rem 2rem;
          box-shadow: 0 0 0 2px #000, inset 0 0 20px rgba(0,0,0,.8), 0 8px 16px rgba(0,0,0,.5), 0 0 40px rgba(255,215,0,.3);
          position: relative; overflow: hidden;
        }
        .mp-header::before {
          content: ''; position: absolute; inset: 0;
          background: repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px),
                      repeating-linear-gradient(90deg,transparent 0px,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px);
          pointer-events: none;
        }
        .mp-header::after {
          content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
          background: linear-gradient(45deg,transparent 30%,rgba(255,215,0,.1) 50%,transparent 70%);
          animation: mpShimmer 3s infinite;
        }
        @keyframes mpShimmer { 0%{transform:translateX(-100%) translateY(-100%) rotate(45deg)} 100%{transform:translateX(100%) translateY(100%) rotate(45deg)} }
        .mp-led {
          font-family: 'Press Start 2P', monospace; font-size: 2rem; color: #FFD700;
          letter-spacing: 6px; text-shadow: 0 0 10px #FF8C00, 0 0 20px #FF8C00, 0 0 30px #FFD700;
          filter: contrast(1.3) brightness(1.2); position: relative;
        }
        .mp-subtitle {
          font-family: 'VT323', monospace; font-size: 1.35rem;
          color: rgba(135,206,235,.55); letter-spacing: 3px; text-transform: uppercase;
        }

        /* ── LIVE BAR ── */
        .mp-live-bar {
          display: flex; align-items: center; justify-content: center; gap: 1rem;
          background: linear-gradient(90deg,transparent,rgba(255,0,0,.08),rgba(255,0,0,.12),rgba(255,0,0,.08),transparent);
          border-top: 1px solid rgba(255,50,50,.3); border-bottom: 1px solid rgba(255,50,50,.3);
          padding: .55rem 2rem; margin-bottom: 1.5rem;
        }
        .mp-live-dot {
          width: 8px; height: 8px; border-radius: 50%; background: #FF3333;
          box-shadow: 0 0 10px #FF3333; animation: mpBlink 1s ease-in-out infinite; flex-shrink: 0;
        }
        @keyframes mpBlink { 0%,100%{opacity:1} 50%{opacity:.2} }
        .mp-live-txt {
          font-family: 'Press Start 2P', monospace; font-size: .6rem; color: #FF4444;
          letter-spacing: 2px; text-shadow: 0 0 10px rgba(255,50,50,.6);
        }

        /* ── GRID ── */
        .mp-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.25rem;
        }

        /* ── CARD ── */
        .mc {
          background: linear-gradient(155deg, rgba(13,13,26,.95), rgba(6,6,16,.98));
          border: 1.5px solid rgba(255,255,255,.07);
          border-radius: 14px; overflow: hidden; cursor: pointer;
          transition: all .25s cubic-bezier(.4,0,.2,1);
          animation: mcReveal .4s ease both;
          animation-delay: calc(var(--i) * 0.035s);
        }
        @keyframes mcReveal {
          from { opacity:0; transform:translateY(14px) scale(.97); }
          to   { opacity:1; transform:translateY(0)    scale(1);   }
        }
        .mc:hover {
          border-color: rgba(255,140,0,.45);
          transform: translateY(-5px) scale(1.01);
          box-shadow: 0 18px 40px rgba(0,0,0,.5), 0 0 20px rgba(255,140,0,.12);
        }

        /* Thumbnail */
        .mc-thumb {
          position: relative; width: 100%; padding-top: 56.25%;
          overflow: hidden; background: #050510;
        }
        .mc-img {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; transition: transform .4s ease;
        }
        .mc:hover .mc-img { transform: scale(1.05); }
        .mc-thumb-blank {
          position: absolute; inset: 0; display: flex; align-items: center;
          justify-content: center; font-size: 2.5rem; opacity: .2;
        }
        .mc-hover {
          position: absolute; inset: 0; background: rgba(0,0,0,.52);
          display: flex; align-items: center; justify-content: center;
          opacity: 0; transition: opacity .22s;
        }
        .mc:hover .mc-hover { opacity: 1; }
        .mc-play {
          width: 52px; height: 52px; border-radius: 50%;
          background: rgba(255,140,0,.88); color: #fff;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.2rem; padding-left: 4px;
          box-shadow: 0 0 28px rgba(255,140,0,.6);
          transform: scale(.8); transition: transform .2s;
        }
        .mc:hover .mc-play { transform: scale(1); }

        /* Badges */
        .mc-type {
          position: absolute; top: 8px; left: 8px;
          font-family: 'Press Start 2P', monospace; font-size: .38rem;
          padding: .22rem .48rem; border-radius: 4px; letter-spacing: .5px;
        }
        .mc-type--clip {
          background: rgba(0,0,0,.8); color: rgba(135,206,235,.85);
          border: 1px solid rgba(135,206,235,.25);
        }
        .mc-type--hl {
          background: rgba(255,165,0,.18); color: #FFD700;
          border: 1px solid rgba(255,215,0,.4);
          box-shadow: 0 0 8px rgba(255,215,0,.2);
        }
        .mc-dur {
          position: absolute; bottom: 8px; right: 8px;
          background: rgba(0,0,0,.85); border-radius: 4px;
          font-family: 'Press Start 2P', monospace; font-size: .42rem;
          color: #fff; padding: .18rem .38rem;
        }
        .mc-live {
          position: absolute; top: 8px; right: 8px;
          background: rgba(200,0,0,.9); border-radius: 4px;
          font-family: 'Press Start 2P', monospace; font-size: .4rem;
          color: #fff; padding: .2rem .45rem;
          display: flex; align-items: center; gap: .28rem;
          animation: mcLivePulse 1.2s ease-in-out infinite;
        }
        @keyframes mcLivePulse { 0%,100%{box-shadow:0 0 6px rgba(255,0,0,.4)} 50%{box-shadow:0 0 18px rgba(255,0,0,.8)} }
        .mc-live-dot {
          width: 5px; height: 5px; border-radius: 50%; background: #fff;
          animation: mpBlink 1s ease-in-out infinite; flex-shrink: 0;
        }

        /* Card body */
        .mc-body { padding: .8rem .95rem .95rem; display: flex; flex-direction: column; gap: .6rem; }

        .mc-title {
          font-family: 'VT323', monospace; font-size: 1.2rem; color: #EDE8DF;
          line-height: 1.35; letter-spacing: .3px;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }

        /* Broadcaster row */
        .mc-caster-row { display: flex; align-items: center; gap: .5rem; }
        .mc-av {
          position: relative; width: 30px; height: 30px; flex-shrink: 0;
          border-radius: 50%; overflow: hidden;
          border: 1.5px solid rgba(135,206,235,.35); background: rgba(0,0,0,.5);
        }
        .mc-av-img { width: 100%; height: 100%; object-fit: cover; }
        .mc-av-fb {
          width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
          font-family: 'Press Start 2P', monospace; font-size: .42rem; color: #FFD700;
          background: linear-gradient(135deg,#1a1a3e,#0d0d25);
        }
        .mc-av-ring {
          position: absolute; inset: -2px; border-radius: 50%;
          border: 2px solid #FF3333; box-shadow: 0 0 6px #FF3333;
        }
        .mc-caster-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .mc-caster-name {
          font-family: 'VT323', monospace; font-size: 1.15rem;
          color: #FFD700; letter-spacing: .5px; line-height: 1;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .mc-caster-handle {
          font-family: 'VT323', monospace; font-size: 1rem;
          color: rgba(180,150,255,.75); letter-spacing: .3px; line-height: 1;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* Date + views row */
        .mc-footer-row {
          display: flex; align-items: center; justify-content: space-between;
          border-top: 1px solid rgba(255,255,255,.05); padding-top: .5rem;
        }
        .mc-date {
          font-family: 'VT323', monospace; font-size: 1.15rem;
          color: #ffffff; letter-spacing: .5px;
        }
        .mc-views {
          font-family: 'VT323', monospace; font-size: 1.05rem;
          color: rgba(255,255,255,.4);
        }

        /* ── MODAL ── */
        .modal-back {
          position: fixed; inset: 0; z-index: 10000;
          background: rgba(0,0,0,.9); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          padding: 1.5rem; animation: modalFadeIn .2s ease;
        }
        @keyframes modalFadeIn { from{opacity:0} to{opacity:1} }
        .modal-box {
          background: linear-gradient(160deg,#0d0d1a,#080810);
          border: 2px solid rgba(255,215,0,.3); border-radius: 16px; overflow: hidden;
          width: 100%; max-width: 860px; position: relative;
          box-shadow: 0 30px 80px rgba(0,0,0,.85), 0 0 60px rgba(255,215,0,.06);
          animation: modalSlide .25s cubic-bezier(.4,0,.2,1);
        }
        @keyframes modalSlide { from{transform:scale(.94) translateY(18px);opacity:0} to{transform:scale(1) translateY(0);opacity:1} }
        .modal-x {
          position: absolute; top: .7rem; right: .7rem; z-index: 10;
          width: 30px; height: 30px; border-radius: 7px;
          background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.12);
          color: rgba(255,255,255,.55); cursor: pointer; font-size: .85rem;
          display: flex; align-items: center; justify-content: center; transition: all .15s;
        }
        .modal-x:hover { background: rgba(255,50,50,.2); color: #fff; }
        .modal-embed { width: 100%; padding-top: 56.25%; position: relative; background: #000; }
        .modal-iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; }
        .modal-no-embed {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 1rem;
        }
        .modal-ext-link {
          font-family: 'Press Start 2P', monospace; font-size: .55rem; color: #9146FF;
          text-decoration: none; border: 1px solid rgba(145,70,255,.4);
          padding: .5rem 1rem; border-radius: 6px;
        }
        .modal-foot {
          display: flex; align-items: center; justify-content: space-between;
          gap: 1rem; padding: .9rem 1.2rem; flex-wrap: wrap;
          border-top: 1px solid rgba(255,215,0,.1);
        }
        .modal-foot-left { display: flex; align-items: center; gap: .8rem; flex: 1; min-width: 0; }
        .modal-av {
          position: relative; width: 44px; height: 44px; border-radius: 50%;
          overflow: hidden; flex-shrink: 0; border: 2px solid rgba(255,215,0,.4);
        }
        .modal-av-img { width: 100%; height: 100%; object-fit: cover; }
        .modal-av-fb {
          width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
          font-family: 'Press Start 2P', monospace; font-size: .85rem; color: #FFD700;
          background: linear-gradient(135deg,#1a1a3e,#0d0d25);
        }
        .modal-av-ring {
          position: absolute; inset: -2px; border-radius: 50%;
          border: 2.5px solid #FF3333; box-shadow: 0 0 10px #FF3333;
        }
        .modal-title { font-family: 'VT323', monospace; font-size: 1.25rem; color: #E8E0D0; margin-bottom: .2rem; }
        .modal-sub { display: flex; align-items: center; gap: .35rem; flex-wrap: wrap; font-family: 'VT323', monospace; font-size: .95rem; }
        .modal-name   { color: rgba(255,215,0,.85); }
        .modal-sep    { color: rgba(255,255,255,.2); }
        .modal-handle { color: rgba(180,150,255,.75); }
        .modal-game   { color: rgba(135,206,235,.5); }
        .modal-pill {
          font-family: 'Press Start 2P', monospace; font-size: .32rem;
          padding: .15rem .38rem; border-radius: 3px; letter-spacing: .5px;
        }
        .modal-pill--clip { background: rgba(135,206,235,.08); color: rgba(135,206,235,.7); border: 1px solid rgba(135,206,235,.2); }
        .modal-pill--hl   { background: rgba(255,215,0,.1); color: #FFD700; border: 1px solid rgba(255,215,0,.3); }
        .modal-foot-right { display: flex; align-items: center; gap: .8rem; flex-shrink: 0; flex-wrap: wrap; }
        .modal-stat { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .modal-sv { font-family: 'VT323', monospace; font-size: 1.25rem; color: #FFD700; text-shadow: 0 0 8px rgba(255,215,0,.35); line-height: 1; }
        .modal-sl { font-family: 'Press Start 2P', monospace; font-size: .3rem; color: rgba(255,165,0,.45); letter-spacing: 1px; }
        .modal-links { display: flex; gap: .4rem; }
        .modal-btn {
          font-family: 'Press Start 2P', monospace; font-size: .4rem;
          padding: .32rem .65rem; border-radius: 6px; text-decoration: none;
          transition: all .15s; letter-spacing: .5px; display: flex; align-items: center; gap: .3rem;
        }
        .modal-btn--tw { color: #9146FF; border: 1px solid rgba(145,70,255,.4); background: rgba(145,70,255,.08); }
        .modal-btn--tw:hover { background: rgba(145,70,255,.2); }
        .modal-btn--live { color: #FF3333; border: 1px solid rgba(255,50,50,.4); background: rgba(255,50,50,.1); animation: mcLivePulse 1.5s ease-in-out infinite; }

        /* ── LOADING / ERROR / EMPTY ── */
        .mp-loading, .mp-error, .mp-empty {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; min-height: 400px; gap: 1rem; text-align: center; padding: 2rem;
        }
        .mp-spinner {
          width: 60px; height: 60px; border: 6px solid rgba(255,140,0,.2);
          border-top: 6px solid #FFD700; border-radius: 50%; animation: mpSpin 1s linear infinite;
        }
        @keyframes mpSpin { to{transform:rotate(360deg)} }
        .mp-loading-txt {
          font-family: 'Press Start 2P', monospace; font-size: 1rem; color: #87CEEB;
          letter-spacing: 2px; animation: mpPulse 1.5s ease-in-out infinite;
        }
        @keyframes mpPulse { 0%,100%{opacity:.5} 50%{opacity:1} }
        .mp-loading-sub { font-family: 'VT323', monospace; font-size: 1.1rem; color: rgba(255,255,255,.25); }
        .mp-error-title { font-family: 'Press Start 2P', monospace; font-size: .8rem; color: #FF4444; letter-spacing: 3px; }
        .mp-error-body { font-family: 'VT323', monospace; font-size: 1.15rem; color: rgba(255,255,255,.4); max-width: 480px; line-height: 1.6; }
        .mp-retry {
          font-family: 'Press Start 2P', monospace; font-size: .55rem; color: #FFD700;
          border: 2px solid rgba(255,215,0,.4); background: rgba(255,215,0,.06);
          border-radius: 8px; padding: .6rem 1.25rem; cursor: pointer; transition: all .2s; letter-spacing: 1px;
        }
        .mp-retry:hover { background: rgba(255,215,0,.15); transform: translateY(-2px); }
        .mp-empty-title { font-family: 'Press Start 2P', monospace; font-size: 1rem; color: rgba(255,215,0,.55); letter-spacing: 3px; }
        .mp-empty-sub { font-family: 'VT323', monospace; font-size: 1.1rem; color: rgba(255,255,255,.3); max-width: 400px; line-height: 1.6; }
        .mp-empty-sub code { background: rgba(135,206,235,.1); color: #87CEEB; padding: .1rem .3rem; border-radius: 3px; }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .mp { padding: 1rem 1rem 4rem; }
          .mp-led { font-size: 1.3rem; letter-spacing: 3px; }
          .mp-grid { grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap: 1rem; }
          .modal-foot { flex-direction: column; }
          .modal-foot-right { width: 100%; justify-content: space-between; }
        }
        @media (max-width: 600px) {
          .mp-led { font-size: 1rem; }
          .mp-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}
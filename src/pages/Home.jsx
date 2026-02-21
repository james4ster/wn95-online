import { useEffect, useState, useCallback } from 'react';
import { supabase } from "../utils/supabaseClient";
import TwitchLiveWidget from "../components/TwitchLiveWidget";

// ─── Live countdown hook ──────────────────────────────────────────────────────
function useCountdown(targetDate) {
  const [t, setT] = useState(null);
  useEffect(() => {
    if (!targetDate) return;
    const tick = () => {
      const diff = new Date(targetDate) - Date.now();
      if (diff <= 0) return setT({ d:0, h:0, m:0, s:0, done:true });
      setT({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000)  / 60000),
        s: Math.floor((diff % 60000)    / 1000),
        done: false,
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetDate]);
  return t;
}

const p2 = n => String(n).padStart(2, '0');

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, action }) {
  return (
    <div className="sh">
      <span className="sh-icon">{icon}</span>
      <span className="sh-title">{title}</span>
      {action && <span className="sh-action">{action}</span>}
    </div>
  );
}

function Skeleton({ h = 40, mb = 6 }) {
  return <div className="skel" style={{ height: h, marginBottom: mb }} />;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [recentGames,   setRecentGames]   = useState([]);
  const [champions,     setChampions]     = useState([]);
  const [activeSeason,  setActiveSeason]  = useState(null);
  const [globalStats,   setGlobalStats]   = useState({ games: null, teams: null });
  const [discordEvents, setDiscordEvents] = useState([]);
  const [recentTrades,  setRecentTrades]  = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [evtLoading,    setEvtLoading]    = useState(true);

  const countdown = useCountdown(activeSeason?.end_date ?? null);

  // ── Main data load ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);

      const [
        { data: games },
        { count: gameCount },
        { data: seasons },
        { data: champRows },
      ] = await Promise.all([
        supabase.from('games').select('*').order('game', { ascending: false }).limit(30),
        supabase.from('games').select('*', { count: 'exact', head: true }),
        supabase.from('seasons').select('*').order('year', { ascending: false }).limit(20),
        supabase.from('standings')
          .select('team, season, season_rank')
          .eq('season_rank', 1)
          .order('season', { ascending: false })
          .limit(9),
      ]);

      // Unique team count from game data
      const teamSet = new Set();
      (games || []).forEach(g => { teamSet.add(g.home_team); teamSet.add(g.away_team); });

      // Active season = earliest end_date that's still in the future
      const now = Date.now();
      const future = (seasons || [])
        .filter(s => s.end_date && new Date(s.end_date) > now)
        .sort((a, b) => new Date(a.end_date) - new Date(b.end_date));
      setActiveSeason(future[0] ?? null);

      // Defending champions — one per league prefix (e.g. W, Q, V)
      const seen = new Set();
      const champs = (champRows || []).filter(c => {
        const prefix = (c.season || '').replace(/[0-9]/g, '');
        if (seen.has(prefix)) return false;
        seen.add(prefix); return true;
      });

      // Trades — uncomment when table is ready
      // const { data: trades } = await supabase.from('trades')
      //   .select('*').order('trade_date', { ascending: false }).limit(8);
      // setRecentTrades(trades || []);

      setRecentGames(games || []);
      setChampions(champs);
      setGlobalStats({ games: gameCount ?? 0, teams: teamSet.size });
      setLoading(false);
    })();
  }, []);

  // ── Discord events — via Supabase Edge Function ────────────────────────────
  // Both edge functions fire on mount and every 10 min.
  // fetch-avatars updates the DB in the background; we only track events in state.
  useEffect(() => {
    const refresh = async () => {
      const [eventsResult] = await Promise.allSettled([
        supabase.functions.invoke('discord-events'),
        supabase.functions.invoke('fetch-avatars'), // background, updates DB
      ]);

      if (eventsResult.status === 'fulfilled') {
        const { data, error } = eventsResult.value;
        if (!error && Array.isArray(data)) setDiscordEvents(data.slice(0, 6));
        else if (error) console.warn('[discord-events]', error.message);
      }
      setEvtLoading(false);
    };

    setEvtLoading(true);
    refresh();
    const id = setInterval(refresh, 10 * 60 * 1000); // every 10 minutes
    return () => clearInterval(id);
  }, []);

  const tickerList = recentGames.length > 0 ? [...recentGames, ...recentGames] : [];

  const leagues = [
    { label: 'WN95',    color: '#87CEEB' },
    { label: 'The Q',   color: '#FFD700' },
    { label: 'Vintage', color: '#FF6B35' },
  ];

  const fmtEvt = iso => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  };

  return (
    <div className="hp">
      <div className="scanlines" aria-hidden />

      {/* Fixed widgets */}
      <TwitchLiveWidget />
      

      {/* ══ HERO ══════════════════════════════════════════════════════════ */}
      <header className="hero">
        <div className="hero-grid" aria-hidden />
        <div className="hero-inner">
          <p className="hero-eyebrow">ESTABLISHED 2019</p>
          <h1 className="hero-wordmark">
            <span className="hw-nhl">NHL</span>
            <span className="hw-95">'95</span>
            <span className="hw-online">ONLINE</span>
          </h1>
          <p className="hero-tagline">RETRO HOCKEY · REAL COMPETITION</p>
          <div className="hero-leagues">
            {leagues.map(l => (
              <div key={l.label} className="hl" style={{'--c': l.color}}>
                <span className="hl-dot" />
                <span className="hl-name">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ══ PULSE BAR — countdown + global stats ══════════════════════════ */}
      <div className="pulse-bar">
        {/* Countdown */}
        <div className="cd-wrap">
          {!activeSeason ? (
            <span className="cd-offseason">⏸ OFF-SEASON</span>
          ) : !countdown ? (
            <span className="cd-loading">LOADING…</span>
          ) : countdown.done ? (
            <span className="cd-ended">🏆 SEASON COMPLETE</span>
          ) : (
            <>
              <span className="cd-label">
                <span className="cd-dot">◆</span>
                {activeSeason.lg} ENDS IN
              </span>
              <div className="cd-clock">
                {[{v:countdown.d,u:'D'},{v:countdown.h,u:'H'},{v:countdown.m,u:'M'},{v:countdown.s,u:'S'}].map(({v,u}) => (
                  <div key={u} className="cd-unit">
                    <span className="cd-n">{p2(v)}</span>
                    <span className="cd-u">{u}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Global stats — real numbers, compact */}
        <div className="gs-wrap">
          {[
            { n: 3,                                          l: 'LEAGUES' },
            { n: loading ? '—' : globalStats.teams,         l: 'TEAMS'   },
            { n: loading ? '—' : (globalStats.games ?? 0).toLocaleString(), l: 'GAMES'   },
          ].map(s => (
            <div key={s.l} className="gs-item">
              <span className="gs-n">{s.n}</span>
              <span className="gs-l">{s.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ══ CONTENT GRID ══════════════════════════════════════════════════ */}
      <div className="cg">

        {/* ── COL 1: Champions + Recent Results ── */}
        <div className="cg-col">

          {/* Defending Champions */}
          <section className="panel">
            <SectionHeader icon="🏆" title="DEFENDING CHAMPIONS" />
            <div className="champs">
              {loading ? (
                [1,2,3].map(i => <div key={i} className="champ-skel" />)
              ) : champions.length === 0 ? (
                <div className="panel-empty">SEASON IN PROGRESS</div>
              ) : (
                champions.map((c, i) => {
                  const league = (c.season || '').replace(/[0-9]/g, '') || '—';
                  return (
                    <div key={i} className="champ-card">
                      <div className="cc-league">{league}</div>
                      <div className="cc-logo-wrap">
                        <img src={`/assets/teamLogos/${c.team}.png`} alt={c.team}
                          className="cc-logo"
                          onError={e => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling.style.display = 'flex';
                          }} />
                        <div className="cc-fallback">{c.team}</div>
                      </div>
                      <span className="cc-team">{c.team}</span>
                      <span className="cc-season">{c.season}</span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Recent Results */}
          <section className="panel">
            <SectionHeader icon="🏒" title="RECENT RESULTS" />
            <div className="results">
              {loading
                ? [1,2,3,4,5,6].map(i => <Skeleton key={i} h={42} mb={0} />)
                : recentGames.length === 0
                  ? <div className="panel-empty">NO RESULTS YET</div>
                  : recentGames.slice(0, 9).map((g, i) => (
                    <div key={i} className="result-row">
                      <div className="rr-team rr-home">
                        <img src={`/assets/teamLogos/${g.home_team}.png`} alt=""
                          className="rr-logo" onError={e => { e.currentTarget.style.display = 'none'; }} />
                        <span className="rr-name">{g.home_team}</span>
                      </div>
                      <div className="rr-score">
                        <span className={`rr-n ${g.home_score > g.away_score ? 'rr-w' : ''}`}>{g.home_score ?? '—'}</span>
                        <span className="rr-dash">–</span>
                        <span className={`rr-n ${g.away_score > g.home_score ? 'rr-w' : ''}`}>{g.away_score ?? '—'}</span>
                      </div>
                      <div className="rr-team rr-away">
                        <span className="rr-name">{g.away_team}</span>
                        <img src={`/assets/teamLogos/${g.away_team}.png`} alt=""
                          className="rr-logo" onError={e => { e.currentTarget.style.display = 'none'; }} />
                      </div>
                    </div>
                  ))
              }
            </div>
          </section>
        </div>

        {/* ── COL 2: Discord Events + Transactions ── */}
        <div className="cg-col">

          {/* Discord Events */}
          <section className="panel panel-discord">
            <SectionHeader
              icon={<svg style={{width:13,height:13,color:'#5865F2',verticalAlign:'middle'}} viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.62.874-1.395 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.1.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>}
              title="UPCOMING EVENTS"
              action={<a href="https://discord.gg/YOUR_INVITE" target="_blank" rel="noopener noreferrer" className="sh-discord-link">JOIN SERVER →</a>}
            />
            <div className="events">
              {evtLoading ? (
                [1,2,3].map(i => <Skeleton key={i} h={62} mb={0} />)
              ) : discordEvents.length === 0 ? (
                <div className="panel-empty events-cta">
                  <p>🎮 No upcoming events right now.</p>
                  <p className="events-setup">
                    Set <code>DISCORD_BOT_TOKEN</code> + <code>DISCORD_GUILD_ID</code> in .env to pull events live.
                  </p>
                </div>
              ) : (
                discordEvents.map(ev => (
                  <a key={ev.id} href={ev.url} target="_blank" rel="noopener noreferrer"
                    className="event-row">
                    <div className="ev-cal">
                      <span className="ev-mon">
                        {new Date(ev.startTime).toLocaleDateString('en-US', { month: 'short' })}
                      </span>
                      <span className="ev-day">
                        {new Date(ev.startTime).getDate()}
                      </span>
                    </div>
                    <div className="ev-info">
                      <span className="ev-name">{ev.name}</span>
                      <span className="ev-time">{fmtEvt(ev.startTime)}</span>
                      {ev.description && (
                        <span className="ev-desc">
                          {ev.description.length > 72
                            ? ev.description.slice(0, 72) + '…'
                            : ev.description}
                        </span>
                      )}
                    </div>
                    <div className="ev-right">
                      {ev.status === 2 && <span className="ev-live-badge">● LIVE</span>}
                      {ev.userCount > 0 && (
                        <span className="ev-count">{ev.userCount}</span>
                      )}
                    </div>
                  </a>
                ))
              )}
            </div>
          </section>

          {/* Recent Transactions */}
          <section className="panel">
            <SectionHeader icon="🔄" title="TRANSACTIONS" />
            <div className="transactions">
              {recentTrades.length === 0 ? (
                <div className="tx-placeholder">
                  <div className="tx-icon">📋</div>
                  <div className="tx-msg">TRADE TRACKER</div>
                  <div className="tx-sub">Transaction history coming soon</div>
                </div>
              ) : (
                recentTrades.map((t, i) => (
                  <div key={i} className="tx-row">
                    <div className="tx-teams">
                      <span className="tx-team">{t.from_team}</span>
                      <span className="tx-arrow">⇄</span>
                      <span className="tx-team">{t.to_team}</span>
                    </div>
                    <span className="tx-player">{t.player_name}</span>
                    <span className="tx-date">{t.trade_date}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ══ BOTTOM TICKER ═════════════════════════════════════════════════ */}
      <div className="ticker">
        <div className="ticker-tag">SCORES</div>
        <div className="ticker-track">
          {tickerList.length > 0 ? (
            <div className="ticker-reel">
              {tickerList.map((g, i) => (
                <span key={i} className="ti">
                  <img src={`/assets/teamLogos/${g.home_team}.png`} alt="" className="ti-logo"
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                  <span className="ti-team">{g.home_team}</span>
                  <span className={`ti-score ${g.home_score > g.away_score ? 'ti-w' : ''}`}>{g.home_score}</span>
                  <span className="ti-sep">–</span>
                  <span className={`ti-score ${g.away_score > g.home_score ? 'ti-w' : ''}`}>{g.away_score}</span>
                  <span className="ti-team">{g.away_team}</span>
                  <img src={`/assets/teamLogos/${g.away_team}.png`} alt="" className="ti-logo"
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                  <span className="ti-diamond">◆</span>
                </span>
              ))}
            </div>
          ) : (
            <span className="ticker-placeholder">
              RECENT SCORES WILL APPEAR HERE &nbsp;◆&nbsp; STAY TUNED FOR RESULTS &nbsp;◆&nbsp;
              RECENT SCORES WILL APPEAR HERE &nbsp;◆&nbsp; STAY TUNED FOR RESULTS &nbsp;◆&nbsp;
            </span>
          )}
        </div>
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        .hp {
          min-height: 100vh;
          background:
            radial-gradient(ellipse 120% 40% at 50% -5%, #0f0f28 0%, transparent 60%),
            #00000a;
          padding-bottom: 52px;
          overflow-x: hidden;
          position: relative;
        }

        /* CRT scanlines */
        .scanlines {
          position: fixed; inset: 0; pointer-events: none; z-index: 9997;
          background: repeating-linear-gradient(
            0deg, transparent, transparent 2px,
            rgba(0,0,0,.055) 2px, rgba(0,0,0,.055) 4px
          );
        }

        

        /* ── HERO ──────────────────────────────────────────── */
        .hero {
          position: relative; text-align: center;
          padding: 3rem 2rem 2rem; overflow: hidden;
        }
        .hero-grid {
          position: absolute; inset: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(135,206,235,.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(135,206,235,.03) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: radial-gradient(ellipse 80% 100% at 50% 100%, black, transparent 70%);
          -webkit-mask-image: radial-gradient(ellipse 80% 100% at 50% 100%, black, transparent 70%);
        }
        .hero-inner { position: relative; z-index: 1; }

        .hero-eyebrow {
          font-family: 'Press Start 2P', monospace; font-size: .42rem;
          letter-spacing: 6px; color: rgba(135,206,235,.25); margin-bottom: 1rem;
        }
        .hero-wordmark {
          font-family: 'Press Start 2P', monospace;
          font-size: clamp(1.8rem, 5.5vw, 3.6rem);
          display: flex; align-items: baseline; justify-content: center;
          gap: .35em; flex-wrap: wrap; margin: 0 0 .75rem; line-height: 1;
        }
        .hw-nhl   { color: #87CEEB; text-shadow: 0 0 28px rgba(135,206,235,.35); }
        .hw-95    { color: #FFD700; font-size: 1.22em; text-shadow: 0 0 22px #FF8C00, 0 0 50px rgba(255,140,0,.25); }
        .hw-online { color: #FF8C00; font-size: .65em; padding-bottom: .22em; align-self: flex-end; text-shadow: 0 0 18px rgba(255,140,0,.45); }

        .hero-tagline {
          font-family: 'VT323', monospace; font-size: 1.25rem;
          color: rgba(255,255,255,.22); letter-spacing: 5px; margin: 0 0 1.6rem;
        }

        .hero-leagues { display: flex; justify-content: center; gap: .55rem; flex-wrap: wrap; }
        .hl {
          display: flex; align-items: center; gap: .38rem;
          padding: .28rem .8rem;
          border: 1px solid color-mix(in srgb, var(--c) 30%, transparent);
          border-radius: 20px;
          background: color-mix(in srgb, var(--c) 6%, transparent);
          cursor: pointer; transition: all .2s;
        }
        .hl:hover {
          background: color-mix(in srgb, var(--c) 14%, transparent);
          border-color: var(--c); transform: translateY(-2px);
          box-shadow: 0 4px 12px color-mix(in srgb, var(--c) 22%, transparent);
        }
        .hl-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--c); box-shadow: 0 0 5px var(--c); }
        .hl-name { font-family: 'Press Start 2P', monospace; font-size: .46rem; color: var(--c); letter-spacing: 1px; }

        /* ── PULSE BAR ─────────────────────────────────────── */
        .pulse-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: .8rem 2rem; flex-wrap: wrap; gap: .75rem;
          border-top: 1px solid rgba(255,140,0,.15);
          border-bottom: 1px solid rgba(135,206,235,.08);
          background: linear-gradient(90deg, rgba(255,140,0,.05) 0%, transparent 50%, rgba(135,206,235,.03) 100%);
        }

        .cd-wrap { display: flex; flex-direction: column; gap: .35rem; }
        .cd-label {
          font-family: 'Press Start 2P', monospace; font-size: .38rem;
          color: #FF8C00; letter-spacing: 2px; text-shadow: 0 0 6px rgba(255,140,0,.35);
          display: flex; align-items: center; gap: .4rem;
        }
        .cd-dot { color: #FFD700; }
        .cd-offseason, .cd-loading, .cd-ended {
          font-family: 'Press Start 2P', monospace; font-size: .42rem;
          color: rgba(255,255,255,.22); letter-spacing: 2px;
        }
        .cd-ended { color: #FFD700; }

        .cd-clock { display: flex; gap: .4rem; }
        .cd-unit {
          display: flex; flex-direction: column; align-items: center; gap: .08rem;
          background: rgba(0,0,0,.45); border: 1px solid rgba(255,140,0,.2);
          border-radius: 5px; padding: .28rem .6rem; min-width: 48px;
        }
        .cd-n {
          font-family: 'VT323', monospace; font-size: 1.8rem; color: #FFD700;
          text-shadow: 0 0 10px rgba(255,215,0,.35); line-height: 1;
        }
        .cd-u {
          font-family: 'Press Start 2P', monospace; font-size: .28rem;
          color: rgba(135,206,235,.4); letter-spacing: 1px;
        }

        .gs-wrap { display: flex; gap: 1.25rem; align-items: center; }
        .gs-item { display: flex; flex-direction: column; align-items: center; gap: .1rem; }
        .gs-n {
          font-family: 'Press Start 2P', monospace; font-size: .95rem;
          color: #FFD700; text-shadow: 0 0 8px rgba(255,215,0,.3); line-height: 1;
        }
        .gs-l {
          font-family: 'Press Start 2P', monospace; font-size: .28rem;
          color: rgba(135,206,235,.35); letter-spacing: 2px;
        }

        /* ── CONTENT GRID ──────────────────────────────────── */
        .cg {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 1.2rem; padding: 1.5rem 2rem;
          max-width: 1400px; margin: 0 auto;
        }
        .cg-col { display: flex; flex-direction: column; gap: 1.2rem; }

        /* ── PANELS ────────────────────────────────────────── */
        .panel {
          border: 1.5px solid rgba(135,206,235,.12);
          border-radius: 10px; overflow: hidden;
          background: linear-gradient(155deg, rgba(255,255,255,.02) 0%, rgba(0,0,0,.25) 100%);
        }

        .sh {
          display: flex; align-items: center; gap: .5rem;
          padding: .7rem 1.1rem;
          background: linear-gradient(90deg, rgba(255,140,0,.07) 0%, transparent 100%);
          border-bottom: 1px solid rgba(255,140,0,.12);
        }
        .sh-icon { font-size: .9rem; }
        .sh-title {
          flex: 1; font-family: 'Press Start 2P', monospace; font-size: .44rem;
          color: #FF8C00; letter-spacing: 2px; text-shadow: 0 0 6px rgba(255,140,0,.3);
        }
        .sh-action {}
        .sh-discord-link {
          font-family: 'Press Start 2P', monospace; font-size: .35rem;
          color: #5865F2; text-decoration: none; letter-spacing: 1px;
          transition: color .15s;
        }
        .sh-discord-link:hover { color: #7289DA; }

        .panel-empty {
          padding: 1.5rem 1.1rem; font-family: 'VT323', monospace;
          font-size: 1.1rem; color: rgba(255,255,255,.18);
          text-align: center; letter-spacing: 2px;
        }

        .skel {
          background: linear-gradient(90deg,
            rgba(255,255,255,.03) 0%, rgba(255,255,255,.065) 50%, rgba(255,255,255,.03) 100%);
          background-size: 200% 100%;
          animation: shimmer 1.6s infinite;
          border-radius: 4px;
        }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

        /* ── CHAMPIONS ─────────────────────────────────────── */
        .champs { display: flex; gap: .65rem; padding: 1rem 1.1rem; flex-wrap: wrap; }
        .champ-skel {
          flex: 1; min-width: 90px; height: 115px; border-radius: 8px;
          background: linear-gradient(90deg, rgba(255,215,0,.03) 0%, rgba(255,215,0,.06) 50%, rgba(255,215,0,.03) 100%);
          background-size: 200% 100%; animation: shimmer 1.6s infinite;
        }
        .champ-card {
          flex: 1; min-width: 90px;
          display: flex; flex-direction: column; align-items: center; gap: .35rem;
          padding: .8rem .5rem;
          background: linear-gradient(160deg, rgba(255,215,0,.06) 0%, rgba(0,0,0,.25) 100%);
          border: 1px solid rgba(255,215,0,.18); border-radius: 8px;
          transition: all .2s;
        }
        .champ-card:hover {
          border-color: rgba(255,215,0,.45);
          transform: translateY(-3px);
          box-shadow: 0 6px 18px rgba(255,215,0,.12);
        }
        .cc-league {
          font-family: 'Press Start 2P', monospace; font-size: .33rem;
          background: rgba(255,215,0,.12); border: 1px solid rgba(255,215,0,.3);
          color: #FFD700; padding: .12rem .45rem; border-radius: 3px; letter-spacing: 1px;
        }
        .cc-logo-wrap { position: relative; width: 50px; height: 50px; }
        .cc-logo { width: 50px; height: 50px; object-fit: contain; filter: drop-shadow(0 0 7px rgba(255,215,0,.35)); }
        .cc-fallback {
          position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
          background: linear-gradient(135deg,#87CEEB,#4682B4); border-radius: 7px;
          font-family: 'Press Start 2P', monospace; font-size: .38rem; color: #000;
        }
        .cc-team { font-family: 'Press Start 2P', monospace; font-size: .42rem; color: #E0E0E0; letter-spacing: .5px; text-align: center; }
        .cc-season { font-family: 'VT323', monospace; font-size: .95rem; color: rgba(255,215,0,.45); }

        /* ── RESULTS ───────────────────────────────────────── */
        .results { padding: .25rem 0; }
        .result-row {
          display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: .4rem;
          padding: .42rem 1.1rem;
          border-bottom: 1px solid rgba(255,255,255,.035);
          transition: background .12s;
        }
        .result-row:last-child { border-bottom: none; }
        .result-row:hover { background: rgba(255,140,0,.045); }
        .rr-team { display: flex; align-items: center; gap: .35rem; }
        .rr-home { justify-content: flex-end; flex-direction: row-reverse; }
        .rr-logo { width: 22px; height: 22px; object-fit: contain; filter: drop-shadow(0 0 3px rgba(135,206,235,.25)); }
        .rr-name { font-family: 'Press Start 2P', monospace; font-size: .4rem; color: #87CEEB; letter-spacing: .5px; }
        .rr-score {
          display: flex; align-items: center; gap: .22rem;
          background: rgba(0,0,0,.4); border: 1px solid rgba(255,140,0,.15);
          border-radius: 5px; padding: .18rem .5rem;
        }
        .rr-n { font-family: 'VT323', monospace; font-size: 1.45rem; color: rgba(255,255,255,.4); line-height: 1; min-width: 14px; text-align: center; }
        .rr-w { color: #FFD700; text-shadow: 0 0 6px rgba(255,215,0,.45); }
        .rr-dash { font-family: 'VT323', monospace; font-size: 1.1rem; color: rgba(255,140,0,.3); }

        /* ── DISCORD EVENTS ────────────────────────────────── */
        .events { padding: .2rem 0; }
        .event-row {
          display: flex; align-items: flex-start; gap: .7rem;
          padding: .6rem 1.1rem; text-decoration: none;
          border-bottom: 1px solid rgba(255,255,255,.035);
          transition: background .12s;
        }
        .event-row:last-child { border-bottom: none; }
        .event-row:hover { background: rgba(88,101,242,.06); }
        .ev-cal {
          display: flex; flex-direction: column; align-items: center;
          background: rgba(88,101,242,.12); border: 1px solid rgba(88,101,242,.25);
          border-radius: 6px; padding: .28rem .5rem; min-width: 40px; flex-shrink: 0;
        }
        .ev-mon { font-family: 'Press Start 2P', monospace; font-size: .28rem; color: #7289DA; text-transform: uppercase; }
        .ev-day { font-family: 'VT323', monospace; font-size: 1.4rem; color: #fff; line-height: 1; }
        .ev-info { flex: 1; display: flex; flex-direction: column; gap: .18rem; min-width: 0; }
        .ev-name { font-family: 'Press Start 2P', monospace; font-size: .42rem; color: #E0E0E0; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .ev-time { font-family: 'VT323', monospace; font-size: .95rem; color: rgba(135,206,235,.45); }
        .ev-desc { font-family: 'VT323', monospace; font-size: .9rem; color: rgba(255,255,255,.25); overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
        .ev-right { display: flex; flex-direction: column; align-items: flex-end; gap: .25rem; flex-shrink: 0; }
        .ev-live-badge {
          font-family: 'Press Start 2P', monospace; font-size: .28rem; letter-spacing: 1px;
          background: rgba(0,255,100,.12); border: 1px solid rgba(0,255,100,.35);
          color: #00FF64; padding: .12rem .38rem; border-radius: 3px;
          animation: blink 1.4s ease-in-out infinite;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.5} }
        .ev-count { font-family: 'VT323', monospace; font-size: .9rem; color: rgba(255,255,255,.22); }

        .events-cta { text-align: left !important; padding: 1.1rem !important; }
        .events-cta p { margin: 0 0 .4rem; font-size: 1rem !important; }
        .events-setup { font-size: .85rem !important; color: rgba(255,255,255,.15) !important; letter-spacing: 0 !important; }
        .events-setup code { background: rgba(255,255,255,.07); padding: .1rem .28rem; border-radius: 3px; font-size: inherit; }

        /* ── TRANSACTIONS ──────────────────────────────────── */
        .transactions { padding: .5rem 0; }
        .tx-placeholder {
          display: flex; flex-direction: column; align-items: center; gap: .45rem;
          padding: 1.6rem 1rem;
        }
        .tx-icon { font-size: 1.8rem; opacity: .35; }
        .tx-msg { font-family: 'Press Start 2P', monospace; font-size: .44rem; color: rgba(255,255,255,.22); letter-spacing: 2px; }
        .tx-sub { font-family: 'VT323', monospace; font-size: 1rem; color: rgba(255,255,255,.15); letter-spacing: 1px; }
        .tx-row {
          display: flex; align-items: center; gap: .6rem;
          padding: .5rem 1.1rem; border-bottom: 1px solid rgba(255,255,255,.035);
          transition: background .12s;
        }
        .tx-row:hover { background: rgba(255,140,0,.04); }
        .tx-teams { display: flex; align-items: center; gap: .3rem; }
        .tx-team { font-family: 'Press Start 2P', monospace; font-size: .38rem; color: #87CEEB; }
        .tx-arrow { color: #FF8C00; font-size: 1.1rem; }
        .tx-player { flex: 1; font-family: 'VT323', monospace; font-size: 1.05rem; color: #E0E0E0; }
        .tx-date { font-family: 'VT323', monospace; font-size: .9rem; color: rgba(255,255,255,.22); }

        /* ── TICKER ────────────────────────────────────────── */
        .ticker {
          position: fixed; bottom: 0; left: 0; right: 0; height: 50px;
          display: flex; align-items: stretch;
          background: linear-gradient(0deg,#030310 0%,#070718 100%);
          border-top: 2px solid #FF8C00; z-index: 200;
          box-shadow: 0 -4px 24px rgba(255,140,0,.18);
        }
        .ticker-tag {
          display: flex; align-items: center; padding: 0 1.1rem;
          background: #FF8C00; font-family: 'Press Start 2P', monospace;
          font-size: .48rem; color: #000; letter-spacing: 2px;
          white-space: nowrap; border-right: 2px solid #FFD700; flex-shrink: 0;
        }
        .ticker-track { flex: 1; overflow: hidden; display: flex; align-items: center; }
        .ticker-reel {
          display: inline-flex; align-items: center;
          animation: scroll 80s linear infinite;
          white-space: nowrap; will-change: transform;
        }
        .ticker-reel:hover { animation-play-state: paused; }
        @keyframes scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .ti { display: inline-flex; align-items: center; gap: .42rem; padding: 0 1.1rem; flex-shrink: 0; }
        .ti-logo { width: 20px; height: 20px; object-fit: contain; filter: drop-shadow(0 0 2px rgba(135,206,235,.3)); }
        .ti-team { font-family: 'Press Start 2P', monospace; font-size: .44rem; color: #87CEEB; }
        .ti-score { font-family: 'VT323', monospace; font-size: 1.6rem; color: rgba(255,255,255,.45); line-height: 1; min-width: 13px; text-align: center; }
        .ti-score.ti-w { color: #FFD700; text-shadow: 0 0 6px rgba(255,215,0,.45); }
        .ti-sep { font-family: 'VT323', monospace; font-size: 1.1rem; color: rgba(255,140,0,.3); }
        .ti-diamond { font-size: .45rem; color: rgba(255,140,0,.28); padding: 0 .25rem; }
        .ticker-placeholder {
          font-family: 'VT323', monospace; font-size: 1.15rem; color: rgba(255,255,255,.16);
          letter-spacing: 3px; animation: scroll 22s linear infinite;
          white-space: nowrap; will-change: transform;
        }

        /* ── RESPONSIVE ────────────────────────────────────── */
        @media (max-width:1100px) {
          .cg { grid-template-columns: 1fr; }
          .pulse-bar { flex-direction: column; align-items: flex-start; }
          .gs-wrap { gap: 1rem; }
        }
        @media (max-width:768px) {
          .hero { padding: 2rem 1rem 1.5rem; }
          .hero-wordmark { font-size: clamp(1.4rem,8vw,2.2rem); }
          .cg { padding: 1rem; gap: 1rem; }
          .pulse-bar { padding: .75rem 1rem; }
          .cd-clock { flex-wrap: wrap; }
          .discord-fab { margin-top: 300px; }
        }
        @media (max-width:500px) {
          .hero-leagues { gap: .4rem; }
          .gs-wrap { gap: .75rem; }
        }
      `}</style>
    </div>
  );
}
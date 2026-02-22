import { useEffect, useState, useCallback } from 'react';
import { supabase } from "../utils/supabaseClient";
import TwitchLiveWidget from "../components/TwitchLiveWidget";
import { useLeague } from "../components/LeagueContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const lgPrefix = lg => (lg || '').replace(/[0-9]/g, '').trim();
const LEAGUE_CONFIG = [
  { prefix: 'W', label: 'WN95',    color: '#87CEEB', dimColor: 'rgba(135,206,235,.15)' },
  { prefix: 'Q', label: 'THE Q',   color: '#FFD700', dimColor: 'rgba(255,215,0,.15)'   },
  { prefix: 'V', label: 'VINTAGE', color: '#FF6B35', dimColor: 'rgba(255,107,53,.15)'  },
];
const leagueCfg = prefix => LEAGUE_CONFIG.find(l => l.prefix === prefix) ?? {
  prefix, label: prefix, color: '#aaa', dimColor: 'rgba(170,170,170,.1)',
};

// ─── Countdown for the single selected league ─────────────────────────────────
function useLeagueCountdown(season) {
  const [tick, setTick] = useState(null);
  useEffect(() => {
    if (!season) return;
    const calc = () => {
      if (!season.end_date) { setTick({ done: true, seasonLabel: season.lg }); return; }
      const diff = new Date(season.end_date) - Date.now();
      if (diff <= 0) { setTick({ done: true, seasonLabel: season.lg }); return; }
      setTick({
        done: false, seasonLabel: season.lg,
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
        urgent: diff < 48 * 3600000,
        warning: diff < 7 * 86400000,
      });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [season]);
  return tick;
}

const p2 = n => String(n ?? 0).padStart(2, '0');

function daysUntil(iso) {
  if (!iso) return null;
  const diff = new Date(iso) - Date.now();
  if (diff < 0) return null;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'TODAY';
  if (days === 1) return 'TOMORROW';
  return `${days}D`;
}

// ─── Countdown widget ─────────────────────────────────────────────────────────
function LeagueCountdown({ cfg, tick }) {
  const urgentColor = tick?.urgent ? '#FF3B3B' : tick?.warning ? '#FFB800' : cfg.color;
  return (
    <div className="lc" style={{ '--lc': urgentColor, '--lcd': cfg.dimColor }}>
      <div className="lc-top">
        <span className="lc-dot" style={{ background: urgentColor, boxShadow: `0 0 6px ${urgentColor}` }} />
        <div className="lc-labels">
          <span className="lc-name">{cfg.label}</span>
          {tick?.seasonLabel && <span className="lc-season">{tick.seasonLabel}</span>}
        </div>
      </div>
      {!tick ? (
        <span className="lc-awaiting">AWAITING SCHEDULE</span>
      ) : tick.done ? (
        <div className="lc-complete"><span>🏆</span><span className="lc-done-txt">SEASON COMPLETE</span></div>
      ) : (
        <div className="lc-clock">
          {[{ v: tick.d, u: 'DAYS' }, { v: tick.h, u: 'HRS' }, { v: tick.m, u: 'MIN' }, { v: tick.s, u: 'SEC' }].map(({ v, u }) => (
            <div key={u} className="lc-unit">
              <span className="lc-n">{p2(v)}</span>
              <span className="lc-u">{u}</span>
            </div>
          ))}
        </div>
      )}
      {tick && !tick.done && tick.d < 7 && (
        <div className="lc-urgency">{tick.urgent ? '🚨 FINALS IMMINENT' : '⚡ FINAL WEEK'}</div>
      )}
    </div>
  );
}

function SectionHeader({ icon, title, action }) {
  return (
    <div className="sh">
      <span className="sh-icon">{icon}</span>
      <span className="sh-title">{title}</span>
      {action && <div className="sh-action">{action}</div>}
    </div>
  );
}

// ─── Home ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const { selectedLeague } = useLeague();
  const cfg = leagueCfg(selectedLeague);

  const [currentSeason, setCurrentSeason] = useState(null);
  const [winStreaks,     setWinStreaks]     = useState([]);
  const [lossStreaks,    setLossStreaks]    = useState([]);
  const [discordEvents, setDiscordEvents]  = useState([]);
  const [recentTrades,  setRecentTrades]   = useState([]);
  const [loading,       setLoading]        = useState(true);
  const [evtLoading,    setEvtLoading]     = useState(true);

  const tick = useLeagueCountdown(currentSeason);

  // ── Reload when league changes ─────────────────────────────────────────────
  const loadLeagueData = useCallback(async (prefix) => {
    if (!prefix) return;
    setLoading(true);
    setCurrentSeason(null);
    setWinStreaks([]);
    setLossStreaks([]);

    const { data: seasons } = await supabase
      .from('seasons').select('*').order('year', { ascending: false }).limit(20);

    const prefixSeasons = (seasons || []).filter(s => lgPrefix(s.lg) === prefix);
    if (!prefixSeasons.length) { setLoading(false); return; }

    const latestSeason = prefixSeasons.reduce((best, s) =>
      new Date(s.end_date) > new Date(best.end_date) ? s : best
    );
    setCurrentSeason(latestSeason);

    const { data: allGames } = await supabase
      .from('games')
      .select('lg, game, home, away, result_home, result_away')
      .eq('lg', latestSeason.lg)
      .order('game', { ascending: false });

    // Streak calculation
    const teamHistory = {};
    (allGames || []).forEach(g => {
      const homeIsWin = ['W','OTW'].includes((g.result_home || '').toUpperCase());
      const awayIsWin = ['W','OTW'].includes((g.result_away || '').toUpperCase());
      if (!teamHistory[g.home]) teamHistory[g.home] = [];
      if (!teamHistory[g.away]) teamHistory[g.away] = [];
      teamHistory[g.home].push({ win: homeIsWin });
      teamHistory[g.away].push({ win: awayIsWin });
    });

    const wins = [], losses = [];
    Object.entries(teamHistory).forEach(([team, history]) => {
      if (!history.length) return;
      const first = history[0].win;
      let count = 0;
      for (const h of history) { if (h.win === first) count++; else break; }
      if (first) wins.push({ team, count });
      else losses.push({ team, count });
    });
    wins.sort((a, b) => b.count - a.count);
    losses.sort((a, b) => b.count - a.count);

    setWinStreaks(wins.slice(0, 3));
    setLossStreaks(losses.slice(0, 3));
    setLoading(false);
  }, []);

  useEffect(() => { loadLeagueData(selectedLeague); }, [selectedLeague, loadLeagueData]);

  // ── Discord events (league-agnostic, shows all) ────────────────────────────
  useEffect(() => {
    const refresh = async () => {
      setEvtLoading(true);
      const result = await supabase.functions.invoke('discord-events');
      if (!result.error && Array.isArray(result.data)) setDiscordEvents(result.data.slice(0, 5));
      else if (result.error) console.warn('[discord-events]', result.error.message);
      setEvtLoading(false);
      supabase.functions.invoke('hyper-endpoint').catch(console.error);
    };
    refresh();
    const id = setInterval(refresh, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const fmtEvt = iso => iso
    ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '';

  return (
    <div className="hp">
      <div className="scanlines" aria-hidden />

      {/* Twitch always visible regardless of selected league */}
      <TwitchLiveWidget />

      {/* ══ SEASON COUNTDOWN — selected league only ════════════════════════ */}
      <div className="countdown-bar">
        <div className="cb-inner">
          <div className="cb-label">⏱ SEASON COUNTDOWN</div>
          <div className="cb-leagues">
            <LeagueCountdown cfg={cfg} tick={tick} />
          </div>
        </div>
      </div>

      {/* ══ CONTENT GRID ══════════════════════════════════════════════════════ */}
      <div className="cg">
        {/* COL 1 */}
        <div className="cg-col">

          {/* Top Scorers placeholder */}
          <section className="panel">
            <SectionHeader icon="⭐" title="TOP SCORERS" />
            <div className="scorers">
              <div className="coming-soon">
                <div className="cs-rows">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="cs-row" style={{ opacity: 1 - i * 0.14 }}>
                      <span className="cs-rank">#{i}</span>
                      <div className="cs-bar-wrap"><div className="cs-bar" style={{ width: `${100 - i * 14}%` }} /></div>
                      <span className="cs-pts">—</span>
                    </div>
                  ))}
                </div>
                <div className="cs-label">PLAYER STATS COMING SOON</div>
              </div>
            </div>
          </section>

          {/* Transactions placeholder */}
          <section className="panel">
            <SectionHeader icon="🔄" title="TRANSACTIONS" />
            <div className="transactions">
              {recentTrades.length === 0 ? (
                <div className="tx-placeholder">
                  <span className="tx-icon">📋</span>
                  <span className="tx-msg">TRADE TRACKER COMING SOON</span>
                </div>
              ) : recentTrades.slice(0, 5).map((t, i) => (
                <div key={i} className="tx-row">
                  <div className="tx-teams">
                    <span className="tx-team">{t.from_team}</span>
                    <span className="tx-arrow">⇄</span>
                    <span className="tx-team">{t.to_team}</span>
                  </div>
                  <span className="tx-player">{t.player_name}</span>
                  <span className="tx-date">{t.trade_date}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* COL 2 */}
        <div className="cg-col">

          {/* Discord Events */}
          <section className="panel">
            <SectionHeader
              icon={<svg style={{width:12,height:12,color:'#5865F2',verticalAlign:'middle',flexShrink:0}} viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.62.874-1.395 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.1.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>}
              title="UPCOMING EVENTS"
              action={<a href="https://discord.gg/YOUR_INVITE" target="_blank" rel="noopener noreferrer" className="sh-discord-link">JOIN →</a>}
            />
            <div className="events">
              {evtLoading ? (
                [1,2,3].map(i => <div key={i} className="skel" style={{height:44,margin:'.25rem .85rem'}} />)
              ) : discordEvents.length === 0 ? (
                <div className="panel-empty events-cta">
                  <p>🎮 No upcoming events.</p>
                  <p className="events-setup">Deploy <code>discord-events</code> edge function.</p>
                </div>
              ) : discordEvents.map(ev => {
                const du = daysUntil(ev.startTime);
                const isToday = du === 'TODAY', isTomorrow = du === 'TOMORROW';
                return (
                  <a key={ev.id} href={ev.url} target="_blank" rel="noopener noreferrer" className="event-row">
                    <div className="ev-cal">
                      <span className="ev-mon">{new Date(ev.startTime).toLocaleDateString('en-US', { month: 'short' })}</span>
                      <span className="ev-day">{new Date(ev.startTime).getDate()}</span>
                    </div>
                    <div className="ev-info">
                      <span className="ev-name">{ev.name}</span>
                      <span className="ev-time">{fmtEvt(ev.startTime)}</span>
                    </div>
                    <div className="ev-right">
                      {ev.status === 2
                        ? <span className="ev-live-badge">● LIVE</span>
                        : du ? <span className={`ev-du ${isToday ? 'ev-du-today' : isTomorrow ? 'ev-du-soon' : ''}`}>{du}</span>
                        : null}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>

          {/* Live Streaks */}
          <section className="panel">
            <SectionHeader icon="🔥" title="STREAKS" />
            <div className="streaks-panel">
              {loading ? (
                <div className="streak-loading">
                  {[1,2,3].map(i => <div key={i} className="skel" style={{height:32,margin:'.2rem .85rem'}} />)}
                </div>
              ) : (
                <>
                  <div className="streak-section">
                    <div className="streak-section-lbl streak-w-lbl">🔥 HOT STREAKS</div>
                    {winStreaks.length === 0
                      ? <div className="streak-empty">No active win streaks</div>
                      : winStreaks.map((s, i) => (
                          <div key={s.team} className="streak-row">
                            <span className="streak-rank">#{i + 1}</span>
                            <img src={`/assets/teamLogos/${s.team}.png`} alt={s.team} className="streak-logo"
                              onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling.style.display='flex'; }} />
                            <div className="streak-logo-fb">{s.team.slice(0,3)}</div>
                            <span className="streak-team">{s.team}</span>
                            <div className="streak-dots">
                              {Array.from({length: Math.min(s.count,8)}, (_,j) => <span key={j} className="sd sd-w" />)}
                              {s.count > 8 && <span className="sd-more">+{s.count-8}</span>}
                            </div>
                            <span className="streak-count streak-count-w">{s.count}W</span>
                          </div>
                        ))}
                  </div>
                  <div className="streak-divider" />
                  <div className="streak-section">
                    <div className="streak-section-lbl streak-l-lbl">🥶 COLD STREAKS</div>
                    {lossStreaks.length === 0
                      ? <div className="streak-empty">No active loss streaks</div>
                      : lossStreaks.map((s, i) => (
                          <div key={s.team} className="streak-row">
                            <span className="streak-rank">#{i + 1}</span>
                            <img src={`/assets/teamLogos/${s.team}.png`} alt={s.team} className="streak-logo"
                              onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling.style.display='flex'; }} />
                            <div className="streak-logo-fb">{s.team.slice(0,3)}</div>
                            <span className="streak-team">{s.team}</span>
                            <div className="streak-dots">
                              {Array.from({length: Math.min(s.count,8)}, (_,j) => <span key={j} className="sd sd-l" />)}
                              {s.count > 8 && <span className="sd-more">+{s.count-8}</span>}
                            </div>
                            <span className="streak-count streak-count-l">{s.count}L</span>
                          </div>
                        ))}
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ══ TICKER ════════════════════════════════════════════════════════════ */}
      <div className="ticker">
        <div className="ticker-tag">NEWS</div>
        <div className="ticker-track">
          <span className="ticker-placeholder">
            LEAGUE NEWS &amp; UPDATES &nbsp;◆&nbsp; PODCASTS &nbsp;◆&nbsp; TRADE ANNOUNCEMENTS &nbsp;◆&nbsp; DRAFT NEWS &nbsp;◆&nbsp; SEASON EVENTS &nbsp;◆&nbsp; LEAGUE NEWS &amp; UPDATES &nbsp;◆&nbsp; PODCASTS &nbsp;◆&nbsp; TRADE ANNOUNCEMENTS &nbsp;◆&nbsp; DRAFT NEWS &nbsp;◆&nbsp; SEASON EVENTS &nbsp;◆&nbsp;
          </span>
        </div>
      </div>

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        .hp {
          min-height: 100vh;
          background: radial-gradient(ellipse 120% 40% at 50% -5%, #0f0f28 0%, transparent 60%), #00000a;
          padding-bottom: 50px; overflow-x: hidden; position: relative;
        }
        .scanlines {
          position: fixed; inset: 0; pointer-events: none; z-index: 9997;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,.055) 2px, rgba(0,0,0,.055) 4px);
        }

        /* ══ COUNTDOWN ══════════════════════════════════════ */
        .countdown-bar {
          display: flex; justify-content: center;
          padding: .8rem 1.5rem;
          border-bottom: 1px solid rgba(135,206,235,.07);
          background: linear-gradient(90deg, rgba(10,10,30,.6) 0%, rgba(5,5,15,.8) 100%);
        }
        .cb-inner { display: flex; flex-direction: column; align-items: center; gap: .5rem; width: 100%; max-width: 680px; }
        .cb-label { font-family: 'Press Start 2P', monospace; font-size: .44rem; color: rgba(255,140,0,.6); letter-spacing: 3px; }
        .cb-leagues { display: flex; gap: .85rem; flex-wrap: wrap; justify-content: center; width: 100%; }

        .lc {
          display: flex; flex-direction: column; align-items: center; gap: .35rem;
          padding: .65rem 1.1rem;
          background: color-mix(in srgb, var(--lc) 5%, rgba(0,0,0,.4));
          border: 1px solid color-mix(in srgb, var(--lc) 25%, transparent);
          border-radius: 10px; flex: 1; min-width: 220px; max-width: 580px;
          position: relative; overflow: hidden; transition: border-color .5s, box-shadow .5s;
        }
        .lc::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in srgb, var(--lc) 8%, transparent), transparent 70%);
          pointer-events: none;
        }
        .lc:has(.lc-n) { box-shadow: 0 0 28px color-mix(in srgb, var(--lc) 10%, transparent), inset 0 1px 0 color-mix(in srgb, var(--lc) 15%, transparent); }
        .lc-top { display: flex; align-items: center; gap: .45rem; justify-content: center; }
        .lc-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; animation: lcPulse 2s ease-in-out infinite; }
        @keyframes lcPulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .lc-labels { display: flex; flex-direction: column; gap: .05rem; }
        .lc-name { font-family: 'Press Start 2P', monospace; font-size: .38rem; color: var(--lc); letter-spacing: 1px; }
        .lc-season { font-family: 'VT323', monospace; font-size: .85rem; color: color-mix(in srgb, var(--lc) 55%, rgba(255,255,255,.2)); }
        .lc-clock { display: flex; gap: .3rem; align-items: center; }
        .lc-unit { display: flex; flex-direction: column; align-items: center; background: rgba(0,0,0,.55); border: 1px solid color-mix(in srgb, var(--lc) 22%, transparent); border-radius: 6px; padding: .2rem .5rem; min-width: 44px; }
        .lc-n { font-family: 'VT323', monospace; font-size: 2rem; color: var(--lc); text-shadow: 0 0 14px color-mix(in srgb, var(--lc) 60%, transparent), 0 0 30px color-mix(in srgb, var(--lc) 25%, transparent); line-height: 1; }
        .lc-u { font-family: 'Press Start 2P', monospace; font-size: .24rem; color: rgba(255,255,255,.28); letter-spacing: 1px; }
        .lc-awaiting { font-family: 'VT323', monospace; font-size: 1rem; color: rgba(255,255,255,.2); letter-spacing: 1px; }
        .lc-complete { display: flex; align-items: center; gap: .4rem; font-size: 1rem; }
        .lc-done-txt { font-family: 'Press Start 2P', monospace; font-size: .34rem; color: color-mix(in srgb, var(--lc) 60%, rgba(255,255,255,.3)); letter-spacing: 1px; }
        .lc-urgency { font-family: 'Press Start 2P', monospace; font-size: .28rem; color: var(--lc); letter-spacing: 1px; animation: blink 1s ease-in-out infinite; }

        /* ══ GRID ═══════════════════════════════════════════ */
        .cg { display: grid; grid-template-columns: 1fr 340px; gap: 1.1rem; padding: 1.1rem 1.5rem; max-width: 1300px; margin: 0 auto; }
        .cg-col { display: flex; flex-direction: column; gap: 1.1rem; }
        .panel { border: 1.5px solid rgba(135,206,235,.1); border-radius: 10px; overflow: hidden; background: linear-gradient(155deg, rgba(255,255,255,.02) 0%, rgba(0,0,0,.28) 100%); }
        .sh { display: flex; align-items: center; gap: .45rem; padding: .6rem 1rem; background: linear-gradient(90deg, rgba(255,140,0,.07) 0%, transparent 100%); border-bottom: 1px solid rgba(255,140,0,.1); }
        .sh-icon { font-size: .85rem; flex-shrink: 0; }
        .sh-title { flex: 1; font-family: 'Press Start 2P', monospace; font-size: .4rem; color: #FF8C00; letter-spacing: 2px; text-shadow: 0 0 6px rgba(255,140,0,.3); }
        .sh-discord-link { font-family: 'Press Start 2P', monospace; font-size: .32rem; color: #5865F2; text-decoration: none; letter-spacing: 1px; transition: color .15s; }
        .sh-discord-link:hover { color: #7289DA; }
        .panel-empty { padding: 1.1rem 1rem; font-family: 'VT323', monospace; font-size: 1rem; color: rgba(255,255,255,.18); text-align: center; letter-spacing: 2px; }
        .skel { background: linear-gradient(90deg, rgba(255,255,255,.03) 0%, rgba(255,255,255,.065) 50%, rgba(255,255,255,.03) 100%); background-size: 200% 100%; animation: shimmer 1.6s infinite; border-radius: 4px; }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

        /* Scorers */
        .scorers { padding: .5rem 0; }
        .coming-soon { display: flex; flex-direction: column; align-items: center; gap: .6rem; padding: .85rem 1rem 1rem; }
        .cs-rows { width: 100%; display: flex; flex-direction: column; gap: .3rem; }
        .cs-row { display: flex; align-items: center; gap: .5rem; }
        .cs-rank { font-family:'Press Start 2P',monospace; font-size:.3rem; color:rgba(255,255,255,.2); min-width:20px; }
        .cs-bar-wrap { flex:1; height:6px; background:rgba(255,255,255,.05); border-radius:3px; overflow:hidden; }
        .cs-bar { height:100%; background:linear-gradient(90deg,rgba(255,140,0,.3),rgba(255,215,0,.2)); border-radius:3px; }
        .cs-pts { font-family:'VT323',monospace; font-size:.95rem; color:rgba(255,255,255,.2); min-width:16px; text-align:right; }
        .cs-label { font-family:'Press Start 2P',monospace; font-size:.32rem; color:rgba(255,255,255,.2); letter-spacing:1px; text-align:center; }

        /* Transactions */
        .transactions { padding: .25rem 0; }
        .tx-placeholder { display:flex; flex-direction:column; align-items:center; gap:.3rem; padding:.95rem 1rem; }
        .tx-icon { font-size:1.3rem; opacity:.28; }
        .tx-msg { font-family:'Press Start 2P',monospace; font-size:.34rem; color:rgba(255,255,255,.18); letter-spacing:1px; text-align:center; }
        .tx-row { display:flex; align-items:center; gap:.45rem; padding:.38rem .9rem; border-bottom:1px solid rgba(255,255,255,.03); }
        .tx-row:last-child { border-bottom:none; }
        .tx-teams { display:flex; align-items:center; gap:.22rem; }
        .tx-team { font-family:'Press Start 2P',monospace; font-size:.34rem; color:#87CEEB; }
        .tx-arrow { color:#FF8C00; font-size:.95rem; }
        .tx-player { flex:1; font-family:'VT323',monospace; font-size:.95rem; color:#E0E0E0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .tx-date { font-family:'VT323',monospace; font-size:.82rem; color:rgba(255,255,255,.2); flex-shrink:0; }

        /* Discord Events — bumped font sizes to match streaks */
        .events { padding: .1rem 0; }
        .event-row { display: flex; align-items: center; gap: .5rem; padding: .38rem .75rem; text-decoration: none; border-bottom: 1px solid rgba(255,255,255,.03); transition: background .12s; }
        .event-row:last-child { border-bottom: none; }
        .event-row:hover { background: rgba(88,101,242,.06); }
        .ev-cal { display: flex; flex-direction: column; align-items: center; background: rgba(88,101,242,.1); border: 1px solid rgba(88,101,242,.22); border-radius: 5px; padding: .22rem .45rem; min-width: 36px; flex-shrink: 0; }
        .ev-mon { font-family:'Press Start 2P',monospace; font-size:.26rem; color:#7289DA; text-transform:uppercase; }
        .ev-day { font-family:'VT323',monospace; font-size:1.25rem; color:#fff; line-height:1; }
        .ev-info { flex:1; display:flex; flex-direction:column; gap:.12rem; min-width:0; }
        .ev-name { font-family:'Press Start 2P',monospace; font-size:.38rem; color:#E0E0E0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
        .ev-time { font-family:'VT323',monospace; font-size:1rem; color:rgba(135,206,235,.45); }
        .ev-right { display:flex; flex-direction:column; align-items:flex-end; gap:.18rem; flex-shrink:0; }
        .ev-live-badge { font-family:'Press Start 2P',monospace; font-size:.28rem; background:rgba(0,255,100,.12); border:1px solid rgba(0,255,100,.35); color:#00FF64; padding:.12rem .34rem; border-radius:3px; animation:blink 1.4s ease-in-out infinite; }
        .ev-du { font-family:'Press Start 2P',monospace; font-size:.32rem; color:rgba(255,255,255,.25); letter-spacing:1px; }
        .ev-du-today { color:#00FF64; text-shadow:0 0 8px rgba(0,255,100,.4); animation:blink 1.4s ease-in-out infinite; }
        .ev-du-soon { color:#FFD700; }
        .events-cta { text-align:left !important; padding:.85rem !important; }
        .events-cta p { margin:0 0 .3rem; font-size:.9rem !important; }
        .events-setup { font-size:.78rem !important; color:rgba(255,255,255,.15) !important; }
        .events-setup code { background:rgba(255,255,255,.07); padding:.08rem .22rem; border-radius:3px; }

        /* Streaks */
        .streaks-panel { padding: .4rem 0 .5rem; }
        .streak-loading { padding: .3rem 0; }
        .streak-section { padding: .3rem .75rem .4rem; }
        .streak-section-lbl { font-family: 'Press Start 2P', monospace; font-size: .38rem; letter-spacing: 2px; margin-bottom: .35rem; padding: .15rem 0; }
        .streak-w-lbl { color: #00CC55; }
        .streak-l-lbl { color: #6B9FFF; }
        .streak-divider { height: 1px; background: rgba(255,255,255,.07); margin: .2rem .75rem; }
        .streak-empty { font-family:'VT323',monospace; font-size:.9rem; color:rgba(255,255,255,.18); letter-spacing:1px; padding:.2rem 0; }
        .streak-row { display: flex; align-items: center; gap: .4rem; padding: .3rem 0; border-bottom: 1px solid rgba(255,255,255,.04); }
        .streak-row:last-child { border-bottom: none; }
        .streak-rank { font-family:'Press Start 2P',monospace; font-size:.38rem; color:rgba(255,255,255,.2); min-width:18px; flex-shrink:0; }
        .streak-logo { width:32px; height:32px; object-fit:contain; filter:drop-shadow(0 0 3px rgba(255,255,255,.15)); flex-shrink:0; }
        .streak-logo-fb { width:32px; height:32px; display:none; align-items:center; justify-content:center; background:rgba(135,206,235,.1); border:1px solid rgba(135,206,235,.15); border-radius:3px; font-family:'Press Start 2P',monospace; font-size:.22rem; color:#87CEEB; flex-shrink:0; }
        .streak-team { font-family:'Press Start 2P',monospace; font-size:.32rem; color:rgba(255,255,255,.55); min-width:28px; flex-shrink:0; }
        .streak-dots { display:flex; gap:2px; align-items:center; flex:1; }
        .sd { width:7px; height:7px; border-radius:2px; flex-shrink:0; }
        .sd-w { background:#00CC55; box-shadow:0 0 4px rgba(0,204,85,.5); }
        .sd-l { background:#4477CC; box-shadow:0 0 4px rgba(68,119,204,.4); }
        .sd-more { font-family:'VT323',monospace; font-size:.85rem; color:rgba(255,255,255,.3); margin-left:2px; }
        .streak-count { font-family:'Press Start 2P',monospace; font-size:.38rem; flex-shrink:0; min-width:28px; text-align:right; }
        .streak-count-w { color:#00CC55; text-shadow:0 0 8px rgba(0,204,85,.4); }
        .streak-count-l { color:#6B9FFF; text-shadow:0 0 8px rgba(107,159,255,.35); }

        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.45} }

        /* Ticker */
        .ticker { position: fixed; bottom: 0; left: 0; right: 0; height: 44px; display: flex; align-items: stretch; background: linear-gradient(0deg,#020210 0%,#06061a 100%); border-top: 2px solid #FF8C00; z-index: 200; box-shadow: 0 -4px 28px rgba(255,140,0,.18); }
        .ticker-tag { display: flex; align-items: center; padding: 0 1rem; background: linear-gradient(90deg, #FF8C00, #FF5F00); font-family: 'Press Start 2P', monospace; font-size: .44rem; color: #000; letter-spacing: 3px; white-space: nowrap; border-right: 2px solid #FFD700; flex-shrink: 0; }
        .ticker-track { flex:1; overflow:hidden; display:flex; align-items:center; position:relative; }
        .ticker-track::before,.ticker-track::after { content:''; position:absolute; top:0; bottom:0; width:36px; z-index:1; pointer-events:none; }
        .ticker-track::before { left:0; background:linear-gradient(90deg,#06061a,transparent); }
        .ticker-track::after  { right:0; background:linear-gradient(-90deg,#06061a,transparent); }
        .ticker-placeholder { font-family:'VT323',monospace; font-size:1.05rem; color:rgba(255,255,255,.15); letter-spacing:4px; animation:scroll 22s linear infinite; white-space:nowrap; will-change:transform; }
        @keyframes scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }

        /* Responsive */
        @media (max-width:1100px) { .cg { grid-template-columns:1fr; } }
        @media (min-width:1101px) and (max-width:1280px) { .cg { grid-template-columns: 1fr 300px; } }
        @media (max-width:900px) { .cb-leagues { gap:.55rem; } .lc { min-width: 180px; } }
        @media (max-width:600px) { .cg { padding:.85rem; gap:.85rem; } .lc { padding:.4rem .6rem; gap:.25rem; } .lc-n { font-size:1.25rem; } .lc-unit { min-width:32px; padding:.15rem .35rem; } }
      `}</style>
    </div>
  );
}
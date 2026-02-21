import { useEffect, useState } from 'react';
import { supabase } from "../utils/supabaseClient";
import TwitchLiveWidget from "../components/TwitchLiveWidget";

// ─── League prefix helpers ────────────────────────────────────────────────────
// lg values like "W16", "Q8", "V4" → prefix "W", "Q", "V"
const lgPrefix  = lg => (lg || '').replace(/[0-9]/g, '').trim();

const LEAGUE_CONFIG = [
  { prefix: 'W', label: 'WN95',    color: '#87CEEB', dimColor: 'rgba(135,206,235,.15)' },
  { prefix: 'Q', label: 'THE Q',   color: '#FFD700', dimColor: 'rgba(255,215,0,.15)'   },
  { prefix: 'V', label: 'VINTAGE', color: '#FF6B35', dimColor: 'rgba(255,107,53,.15)'  },
];

// Given a prefix, return its config
const leagueCfg = prefix => LEAGUE_CONFIG.find(l => l.prefix === prefix) ?? {
  prefix, label: prefix, color: '#aaa', dimColor: 'rgba(170,170,170,.1)',
};

// ─── All 3 league countdowns ticking simultaneously ───────────────────────────
function useLeagueCountdowns(latestSeasons) {
  const [ticks, setTicks] = useState({});

  useEffect(() => {
    if (!latestSeasons || latestSeasons.length === 0) return;
    const calc = () => {
      const next = {};
      latestSeasons.forEach(s => {
        const prefix = lgPrefix(s.lg);
        if (!s.end_date) { next[prefix] = { done: true, seasonLabel: s.lg }; return; }
        const diff = new Date(s.end_date) - Date.now();
        if (diff <= 0) { next[prefix] = { done: true, seasonLabel: s.lg }; return; }
        // Urgency: amber under 7 days, red under 48 hrs
        const urgent = diff < 48 * 3600000;
        const warning = diff < 7 * 86400000;
        next[prefix] = {
          done: false, seasonLabel: s.lg,
          d: Math.floor(diff / 86400000),
          h: Math.floor((diff % 86400000) / 3600000),
          m: Math.floor((diff % 3600000)  / 60000),
          s: Math.floor((diff % 60000)    / 1000),
          urgent, warning,
        };
      });
      setTicks(next);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [latestSeasons]);

  return ticks;
}

const p2 = n => String(n ?? 0).padStart(2, '0');

// ─── Days until event ─────────────────────────────────────────────────────────
function daysUntil(iso) {
  if (!iso) return null;
  const diff = new Date(iso) - Date.now();
  if (diff < 0) return null;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'TODAY';
  if (days === 1) return 'TOMORROW';
  return `${days}D`;
}

// ─── Game card ────────────────────────────────────────────────────────────────
// Layout: logos+teamcode stacked LEFT (away top, home bottom), scores RIGHT
function GameCard({ game, index }) {
  const homeWin = game && Number(game.score_home) > Number(game.score_away);
  const awayWin = game && Number(game.score_away) > Number(game.score_home);
  const prefix  = game ? lgPrefix(game.lg ?? '') : null;
  const cfg     = prefix ? leagueCfg(prefix) : null;
  const isOT    = game && (
    Number(game.ot) === 1 ||
    (game.result_home || '').toUpperCase().includes('OT') ||
    (game.result_away || '').toUpperCase().includes('OT')
  );

  if (!game) {
    return (
      <div className="gc gc-empty">
        <div className="gc-league-tag gc-league-ph" />
        <div className="gc-body">
          <div className="gc-logos">
            <div className="gc-row"><div className="gc-logo-ph" /><div className="gc-name-ph" /></div>
            <div className="gc-divline" />
            <div className="gc-row"><div className="gc-logo-ph" /><div className="gc-name-ph" /></div>
          </div>
          <div className="gc-scores">
            <div className="gc-score-ph" />
            <div className="gc-score-ph gc-score-ph-sm" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gc" style={{ animationDelay: `${index * 0.05}s` }}>
      {cfg && (
        <div className="gc-league-tag" style={{ '--gc': cfg.color, '--gcd': cfg.dimColor }}>
          {cfg.label}
        </div>
      )}
      <div className="gc-body">
        {/* Left side: away on top, home on bottom */}
        <div className="gc-logos">
          <div className="gc-row">
            <img src={`/assets/teamLogos/${game.away}.png`} alt={game.away} className="gc-logo"
              onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling.style.display='flex'; }} />
            <div className="gc-logo-fb">{(game.away||'').slice(0,3)}</div>
            <span className="gc-team-code">{game.away}</span>
          </div>
          <div className="gc-divline" />
          <div className="gc-row">
            <img src={`/assets/teamLogos/${game.home}.png`} alt={game.home} className="gc-logo"
              onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling.style.display='flex'; }} />
            <div className="gc-logo-fb">{(game.home||'').slice(0,3)}</div>
            <span className="gc-team-code">{game.home}</span>
          </div>
        </div>
        {/* Right side: away score top, home score bottom, OT badge */}
        <div className="gc-scores">
          <span className={`gc-score ${awayWin ? 'gc-win' : ''}`}>{game.score_away ?? '—'}</span>
          <span className={`gc-score ${homeWin ? 'gc-win' : ''}`}>{game.score_home ?? '—'}</span>
          {isOT && <span className="gc-ot">OT</span>}
        </div>
      </div>
    </div>
  );
}

// ─── League countdown block ───────────────────────────────────────────────────
function LeagueCountdown({ cfg, tick }) {
  const urgentColor = tick?.urgent ? '#FF3B3B'
    : tick?.warning ? '#FFB800'
    : cfg.color;

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
        <div className="lc-complete">
          <span className="lc-trophy">🏆</span>
          <span className="lc-done-txt">SEASON COMPLETE</span>
        </div>
      ) : (
        <div className="lc-clock">
          {[
            { v: tick.d, u: 'DAYS' },
            { v: tick.h, u: 'HRS'  },
            { v: tick.m, u: 'MIN'  },
            { v: tick.s, u: 'SEC'  },
          ].map(({ v, u }) => (
            <div key={u} className="lc-unit">
              <span className="lc-n">{p2(v)}</span>
              <span className="lc-u">{u}</span>
            </div>
          ))}
        </div>
      )}

      {tick && !tick.done && tick.d < 7 && (
        <div className="lc-urgency">
          {tick.urgent ? '🚨 FINALS IMMINENT' : '⚡ FINAL WEEK'}
        </div>
      )}
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ icon, title, action }) {
  return (
    <div className="sh">
      <span className="sh-icon">{icon}</span>
      <span className="sh-title">{title}</span>
      {action && <div className="sh-action">{action}</div>}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [recentGames,    setRecentGames]    = useState([]);
  const [champions,      setChampions]      = useState([]);
  const [latestSeasons,  setLatestSeasons]  = useState([]);
  const [discordEvents,  setDiscordEvents]  = useState([]);
  const [recentTrades,   setRecentTrades]   = useState([]);
  const [winStreaks,     setWinStreaks]     = useState([]);
  const [lossStreaks,    setLossStreaks]    = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [evtLoading,     setEvtLoading]     = useState(true);

  const countdowns = useLeagueCountdowns(latestSeasons);

  // ── Main data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);

      // Load seasons first — needed to know which lg codes are most recent
      const [{ data: seasons }, { data: champRows }] = await Promise.all([
        supabase.from('seasons').select('*').order('year', { ascending: false }).limit(30),
        supabase.from('standings')
          .select('team, season, season_rank')
          .eq('season_rank', 1)
          .order('season', { ascending: false })
          .limit(9),
      ]);

      // For each league PREFIX, keep the most recent season by end_date
      const prefixMap = {};
      (seasons || []).forEach(s => {
        const p = lgPrefix(s.lg);
        if (!p) return;
        const existing = prefixMap[p];
        if (!existing || new Date(s.end_date) > new Date(existing.end_date)) {
          prefixMap[p] = s;
        }
      });
      const latestSeasonsList = Object.values(prefixMap);
      setLatestSeasons(latestSeasonsList);

      // Get the lg codes for the most recent season in each league
      // e.g. ["W16", "Q19", "V4"] — then fetch the last 10 games across those
      const recentLgCodes = latestSeasonsList.map(s => s.lg).filter(Boolean);

      let games = [], allSeasonGames = [];
      if (recentLgCodes.length > 0) {
        // Fetch last 10 for display cards
        const { data: recentData } = await supabase
          .from('games')
          .select('lg, game, home, away, score_home, score_away, ot, result_home, result_away, mode')
          .in('lg', recentLgCodes)
          .order('game', { ascending: false })
          .limit(10);
        games = recentData || [];

        // Fetch ALL season games for streak calculation (games are lightweight rows)
        const { data: allData } = await supabase
          .from('games')
          .select('lg, game, home, away, result_home, result_away')
          .in('lg', recentLgCodes)
          .order('game', { ascending: false });
        allSeasonGames = allData || [];
      }

      // ── Calculate streaks from allSeasonGames ──────────────────────────────
      // Build per-team game history (most recent first) with W/L outcome
      const teamHistory = {};
      allSeasonGames.forEach(g => {
        const homeResult = (g.result_home || '').toUpperCase();
        const awayResult = (g.result_away || '').toUpperCase();
        // Normalize: W/OTW = win, L/OTL = loss
        const homeIsWin = homeResult === 'W' || homeResult === 'OTW';
        const awayIsWin = awayResult === 'W' || awayResult === 'OTW';

        if (!teamHistory[g.home]) teamHistory[g.home] = [];
        if (!teamHistory[g.away]) teamHistory[g.away] = [];
        // Games are already ordered desc (most recent first)
        teamHistory[g.home].push({ win: homeIsWin, game: g.game });
        teamHistory[g.away].push({ win: awayIsWin, game: g.game });
      });

      // For each team, count current streak (consecutive same result from most recent)
      const winStreaks = [], lossStreaks = [];
      Object.entries(teamHistory).forEach(([team, history]) => {
        if (!history.length) return;
        const first = history[0].win;
        let count = 0;
        for (const h of history) {
          if (h.win === first) count++;
          else break;
        }
        if (first) winStreaks.push({ team, count });
        else lossStreaks.push({ team, count });
      });
      winStreaks.sort((a, b) => b.count - a.count);
      lossStreaks.sort((a, b) => b.count - a.count);

      // Champions — one per league prefix
      const seen = new Set();
      const champs = (champRows || []).filter(c => {
        const p = lgPrefix(c.season);
        if (seen.has(p)) return false;
        seen.add(p); return true;
      });

      // Trades — uncomment when ready
      // const { data: trades } = await supabase
      //   .from('trades').select('*').order('trade_date', { ascending: false }).limit(5);
      // setRecentTrades(trades || []);

      setRecentGames(games || []);
      setChampions(champs);
      setWinStreaks(winStreaks.slice(0, 3));
      setLossStreaks(lossStreaks.slice(0, 3));
      setLoading(false);
    })();
  }, []);

  // ── Discord events + avatar refresh ───────────────────────────────────────
  useEffect(() => {
    const refresh = async () => {
      setEvtLoading(true);
      const result = await supabase.functions.invoke('discord-events');
      if (!result.error && Array.isArray(result.data)) {
        setDiscordEvents(result.data.slice(0, 5));
      } else if (result.error) {
        console.warn('[discord-events]', result.error.message);
      }
      setEvtLoading(false);
      supabase.functions.invoke('hyper-endpoint').catch(console.error);
    };
    refresh();
    const id = setInterval(refresh, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const gameSlots  = Array.from({ length: 10 }, (_, i) => recentGames[i] ?? null);
  const tickerList = recentGames.length > 0 ? [...recentGames, ...recentGames] : [];

  const fmtEvt = iso => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  };

  return (
    <div className="hp">
      <div className="scanlines" aria-hidden />
      <TwitchLiveWidget />

      {/* ══ TOP BAND ══════════════════════════════════════════════════════════ */}
      <div className="top-band">
        <div className="wordmark">
          <span className="wm-nhl">NHL</span>
          <span className="wm-95">'95</span>
          <span className="wm-online">ONLINE</span>
        </div>
        <div className="game-strip">
          <div className="gs-label">RECENT RESULTS</div>
          <div className="gs-cards">
            {loading
              ? Array.from({ length: 10 }, (_, i) => <GameCard key={i} game={null} index={i} />)
              : gameSlots.map((g, i) => <GameCard key={i} game={g} index={i} />)
            }
          </div>
        </div>
      </div>

      {/* ══ LEAGUE COUNTDOWNS ═════════════════════════════════════════════════ */}
      <div className="countdown-bar">
        <div className="cb-inner">
          <div className="cb-label">⏱ SEASON COUNTDOWN</div>
          <div className="cb-leagues">
            {LEAGUE_CONFIG.map(cfg => (
              <LeagueCountdown
                key={cfg.prefix}
                cfg={cfg}
                tick={countdowns[cfg.prefix] ?? null}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ══ CONTENT GRID ══════════════════════════════════════════════════════ */}
      <div className="cg">

        {/* COL 1 */}
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
                  const p   = lgPrefix(c.season);
                  const cfg = leagueCfg(p);
                  return (
                    <div key={i} className="champ-card" style={{ '--cc': cfg.color }}>
                      <div className="cc-league" style={{ color: cfg.color, borderColor: cfg.color + '55', background: cfg.color + '18' }}>
                        {cfg.label}
                      </div>
                      <div className="cc-logo-wrap">
                        <img src={`/assets/teamLogos/${c.team}.png`} alt={c.team} className="cc-logo"
                          onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling.style.display='flex'; }} />
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

          {/* Top Scorers — ready for data */}
          <section className="panel">
            <SectionHeader icon="⭐" title="TOP SCORERS" />
            <div className="scorers">
              {/* Uncomment when player_stats table is ready:
              {topScorers.map((s, i) => (
                <div key={i} className="scorer-row">
                  <span className="scorer-rank">#{i+1}</span>
                  <div className="scorer-info">
                    <span className="scorer-name">{s.player_name}</span>
                    <span className="scorer-team">{s.team}</span>
                  </div>
                  <div className="scorer-stats">
                    <span className="scorer-stat">{s.goals}<em>G</em></span>
                    <span className="scorer-stat">{s.assists}<em>A</em></span>
                    <span className="scorer-pts">{s.points}<em>P</em></span>
                  </div>
                </div>
              ))} */}
              <div className="coming-soon">
                <div className="cs-rows">
                  {[1,2,3,4,5].map(i => (
                    <div key={i} className="cs-row" style={{ opacity: 1 - i * 0.14 }}>
                      <span className="cs-rank">#{i}</span>
                      <div className="cs-bar-wrap">
                        <div className="cs-bar" style={{ width: `${100 - i * 14}%` }} />
                      </div>
                      <span className="cs-pts">—</span>
                    </div>
                  ))}
                </div>
                <div className="cs-label">PLAYER STATS COMING SOON</div>
              </div>
            </div>
          </section>

          {/* Transactions */}
          <section className="panel">
            <SectionHeader icon="🔄" title="TRANSACTIONS" />
            <div className="transactions">
              {recentTrades.length === 0 ? (
                <div className="tx-placeholder">
                  <span className="tx-icon">📋</span>
                  <span className="tx-msg">TRADE TRACKER COMING SOON</span>
                </div>
              ) : (
                recentTrades.slice(0, 5).map((t, i) => (
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

        {/* COL 2 */}
        <div className="cg-col">

          {/* Discord Events — compact */}
          <section className="panel">
            <SectionHeader
              icon={
                <svg style={{width:12,height:12,color:'#5865F2',verticalAlign:'middle',flexShrink:0}} viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.62.874-1.395 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.1.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
              }
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
              ) : (
                discordEvents.map(ev => {
                  const du = daysUntil(ev.startTime);
                  const isToday = du === 'TODAY';
                  const isTomorrow = du === 'TOMORROW';
                  return (
                    <a key={ev.id} href={ev.url} target="_blank" rel="noopener noreferrer" className="event-row">
                      <div className="ev-cal">
                        <span className="ev-mon">
                          {new Date(ev.startTime).toLocaleDateString('en-US', { month: 'short' })}
                        </span>
                        <span className="ev-day">{new Date(ev.startTime).getDate()}</span>
                      </div>
                      <div className="ev-info">
                        <span className="ev-name">{ev.name}</span>
                        <span className="ev-time">{fmtEvt(ev.startTime)}</span>
                      </div>
                      <div className="ev-right">
                        {ev.status === 2 ? (
                          <span className="ev-live-badge">● LIVE</span>
                        ) : du ? (
                          <span className={`ev-du ${isToday ? 'ev-du-today' : isTomorrow ? 'ev-du-soon' : ''}`}>
                            {du}
                          </span>
                        ) : null}
                      </div>
                    </a>
                  );
                })
              )}
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
                  {/* Winning streaks */}
                  <div className="streak-section">
                    <div className="streak-section-lbl streak-w-lbl">🔥 HOT STREAKS</div>
                    {winStreaks.length === 0 ? (
                      <div className="streak-empty">No active win streaks</div>
                    ) : winStreaks.map((s, i) => (
                      <div key={s.team} className="streak-row">
                        <span className="streak-rank">#{i + 1}</span>
                        <img src={`/assets/teamLogos/${s.team}.png`} alt={s.team}
                          className="streak-logo"
                          onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling.style.display='flex'; }} />
                        <div className="streak-logo-fb">{s.team.slice(0,3)}</div>
                        <span className="  "></span>
                        <div className="streak-dots">
                          {Array.from({length: Math.min(s.count, 8)}, (_, j) => (
                            <span key={j} className="sd sd-w" />
                          ))}
                          {s.count > 8 && <span className="sd-more">+{s.count - 8}</span>}
                        </div>
                        <span className="streak-count streak-count-w">{s.count}W</span>
                      </div>
                    ))}
                  </div>
                  <div className="streak-divider" />
                  {/* Losing streaks */}
                  <div className="streak-section">
                    <div className="streak-section-lbl streak-l-lbl">🥶 COLD STREAKS</div>
                    {lossStreaks.length === 0 ? (
                      <div className="streak-empty">No active loss streaks</div>
                    ) : lossStreaks.map((s, i) => (
                      <div key={s.team} className="streak-row">
                        <span className="streak-rank">#{i + 1}</span>
                        <img src={`/assets/teamLogos/${s.team}.png`} alt={s.team}
                          className="streak-logo"
                          onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling.style.display='flex'; }} />
                        <div className="streak-logo-fb">{s.team.slice(0,3)}</div>
                        <span className="streak-team">{s.team}</span>
                        <div className="streak-dots">
                          {Array.from({length: Math.min(s.count, 8)}, (_, j) => (
                            <span key={j} className="sd sd-l" />
                          ))}
                          {s.count > 8 && <span className="sd-more">+{s.count - 8}</span>}
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
          padding-bottom: 50px;
          overflow-x: hidden;
          position: relative;
        }

        .scanlines {
          position: fixed; inset: 0; pointer-events: none; z-index: 9997;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px,
            rgba(0,0,0,.055) 2px, rgba(0,0,0,.055) 4px);
        }

        /* ══ TOP BAND ═══════════════════════════════════════ */
        .top-band {
          display: flex; align-items: stretch;
          border-bottom: 1px solid rgba(255,140,0,.18);
          background: linear-gradient(180deg, rgba(15,15,40,.95) 0%, rgba(5,5,18,.8) 100%);
          min-height: 96px;
        }

        .wordmark {
          display: flex; flex-direction: column; justify-content: center;
          padding: .9rem 1.4rem;
          border-right: 1px solid rgba(255,140,0,.18);
          flex-shrink: 0; gap: .08rem; min-width: 105px;
          background: linear-gradient(135deg, rgba(255,140,0,.06) 0%, transparent 100%);
        }
        .wm-nhl { font-family: 'Press Start 2P', monospace; font-size: .9rem; color: #87CEEB; text-shadow: 0 0 16px rgba(135,206,235,.4); line-height: 1; }
        .wm-95  { font-family: 'Press Start 2P', monospace; font-size: 1.45rem; color: #FFD700; text-shadow: 0 0 14px #FF8C00, 0 0 30px rgba(255,140,0,.3); line-height: 1; }
        .wm-online { font-family: 'Press Start 2P', monospace; font-size: .46rem; color: #FF8C00; letter-spacing: 2px; text-shadow: 0 0 10px rgba(255,140,0,.5); }

        .game-strip {
          flex: 1; display: flex; flex-direction: column; justify-content: center;
          padding: .55rem 1rem .55rem .75rem; gap: .3rem; overflow: hidden;
        }
        .gs-label {
          font-family: 'Press Start 2P', monospace; font-size: .44rem;
          color: rgba(255,140,0,.7); letter-spacing: 3px;
        }
        .gs-cards {
          display: flex; gap: .4rem;
          overflow-x: auto; padding-bottom: .2rem;
          scrollbar-width: none;
        }
        .gs-cards::-webkit-scrollbar { display: none; }

        /* ── Game card ── */
        .gc {
          display: flex; flex-direction: column;
          background: linear-gradient(160deg, rgba(255,255,255,.035) 0%, rgba(0,0,0,.35) 100%);
          border: 1px solid rgba(135,206,235,.1);
          border-radius: 8px; flex-shrink: 0; cursor: pointer;
          transition: all .18s; overflow: hidden;
          animation: gcIn .35s ease both;
          min-width: 105px;
        }
        @keyframes gcIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

        .gc:hover {
          border-color: rgba(255,140,0,.45);
          transform: translateY(-3px);
          box-shadow: 0 6px 18px rgba(0,0,0,.5), 0 0 12px rgba(255,140,0,.12);
        }
        .gc-empty { opacity: .2; cursor: default; pointer-events: none; }

        /* League tag — full width top strip */
        .gc-league-tag {
          width: 100%; text-align: center;
          font-family: 'Press Start 2P', monospace; font-size: .28rem;
          letter-spacing: 2px;
          color: var(--gc, rgba(255,255,255,.3));
          background: var(--gcd, rgba(255,255,255,.05));
          padding: .22rem 0;
          border-bottom: 1px solid color-mix(in srgb, var(--gc, white) 20%, transparent);
        }
        .gc-league-ph {
          height: 14px;
          background: rgba(255,255,255,.05);
          color: transparent;
        }

        /* gc-body: left=logos stacked, right=scores stacked */
        .gc-body {
          display: flex; align-items: center; justify-content: space-between;
          gap: .4rem; padding: .4rem .5rem;
        }
        /* Left column: two rows of logo+teamcode */
        .gc-logos { display: flex; flex-direction: column; gap: 0; flex: 1; min-width: 0; }
        .gc-row {
          display: flex; align-items: center; gap: .28rem;
          padding: .18rem 0;
        }
        .gc-divline { height: 1px; background: rgba(255,255,255,.07); margin: .05rem 0; }
        .gc-team-code {
          font-family: 'Press Start 2P', monospace; font-size: .28rem;
          color: rgba(255,255,255,.4); letter-spacing: .5px;
          overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
        }
        .gc-name-ph { width: 24px; height: 7px; background: rgba(255,255,255,.05); border-radius: 2px; }
        /* Right column: two scores + OT badge */
        .gc-scores {
          display: flex; flex-direction: column; align-items: flex-end;
          gap: .05rem; flex-shrink: 0;
        }
        .gc-win { color: #FFD700 !important; text-shadow: 0 0 8px rgba(255,215,0,.55) !important; }
        .gc-logo { width: 22px; height: 22px; object-fit: contain; filter: drop-shadow(0 0 3px rgba(135,206,235,.2)); flex-shrink: 0; }
        .gc-logo-fb {
          width: 22px; height: 22px; display: none; align-items: center; justify-content: center;
          background: rgba(135,206,235,.1); border: 1px solid rgba(135,206,235,.15);
          border-radius: 3px; font-family: 'Press Start 2P', monospace; font-size: .22rem; color: #87CEEB; flex-shrink: 0;
        }
        .gc-score {
          font-family: 'VT323', monospace; font-size: 1.3rem;
          color: rgba(255,255,255,.4); line-height: 1; min-width: 16px; text-align: right;
          display: block;
        }
        .gc-ot {
          font-family: 'Press Start 2P', monospace; font-size: .22rem;
          color: #FF8C00; letter-spacing: 1px; margin-top: .08rem;
          background: rgba(255,140,0,.1); border: 1px solid rgba(255,140,0,.25);
          border-radius: 2px; padding: .06rem .2rem;
        }
        .gc-logo-ph { width: 22px; height: 22px; background: rgba(255,255,255,.06); border-radius: 3px; flex-shrink: 0; }
        .gc-score-ph { width: 16px; height: 13px; background: rgba(255,255,255,.06); border-radius: 2px; }
        .gc-score-ph-sm { width: 12px; }

        /* ══ COUNTDOWN BAR ══════════════════════════════════ */
        .countdown-bar {
          display: flex; justify-content: center;
          padding: .8rem 1.5rem;
          border-bottom: 1px solid rgba(135,206,235,.07);
          background: linear-gradient(90deg, rgba(10,10,30,.6) 0%, rgba(5,5,15,.8) 100%);
        }
        .cb-inner {
          display: flex; flex-direction: column; align-items: center; gap: .5rem;
          width: 100%; max-width: 900px;
        }
        .cb-label {
          font-family: 'Press Start 2P', monospace; font-size: .44rem;
          color: rgba(255,140,0,.6); letter-spacing: 3px;
        }
        .cb-leagues { display: flex; gap: .85rem; flex-wrap: wrap; justify-content: center; width: 100%; }

        /* Per-league countdown */
        .lc {
          display: flex; flex-direction: column; align-items: center; gap: .35rem;
          padding: .65rem 1.1rem;
          background: color-mix(in srgb, var(--lc) 5%, rgba(0,0,0,.4));
          border: 1px solid color-mix(in srgb, var(--lc) 25%, transparent);
          border-radius: 10px; flex: 1; min-width: 220px; max-width: 280px;
          transition: border-color .5s, box-shadow .5s;
          position: relative; overflow: hidden;
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
        .lc-unit {
          display: flex; flex-direction: column; align-items: center;
          background: rgba(0,0,0,.55); border: 1px solid color-mix(in srgb, var(--lc) 22%, transparent);
          border-radius: 6px; padding: .2rem .5rem; min-width: 44px;
        }
        .lc-n {
          font-family: 'VT323', monospace; font-size: 2rem; color: var(--lc);
          text-shadow: 0 0 14px color-mix(in srgb, var(--lc) 60%, transparent),
                       0 0 30px color-mix(in srgb, var(--lc) 25%, transparent);
          line-height: 1;
        }
        .lc-u { font-family: 'Press Start 2P', monospace; font-size: .24rem; color: rgba(255,255,255,.28); letter-spacing: 1px; }

        .lc-awaiting { font-family: 'VT323', monospace; font-size: 1rem; color: rgba(255,255,255,.2); letter-spacing: 1px; }
        .lc-complete { display: flex; align-items: center; gap: .4rem; }
        .lc-trophy { font-size: 1rem; }
        .lc-done-txt { font-family: 'Press Start 2P', monospace; font-size: .34rem; color: color-mix(in srgb, var(--lc) 60%, rgba(255,255,255,.3)); letter-spacing: 1px; }

        .lc-urgency {
          font-family: 'Press Start 2P', monospace; font-size: .28rem;
          color: var(--lc); letter-spacing: 1px;
          animation: blink 1s ease-in-out infinite;
        }

        /* ══ CONTENT GRID ═══════════════════════════════════ */
        .cg {
          display: grid; grid-template-columns: 1fr 340px;
          gap: 1.1rem; padding: 1.1rem 1.5rem;
          max-width: 1300px; margin: 0 auto;
        }
        .cg-col { display: flex; flex-direction: column; gap: 1.1rem; }

        .panel {
          border: 1.5px solid rgba(135,206,235,.1);
          border-radius: 10px; overflow: hidden;
          background: linear-gradient(155deg, rgba(255,255,255,.02) 0%, rgba(0,0,0,.28) 100%);
        }

        .sh {
          display: flex; align-items: center; gap: .45rem;
          padding: .6rem 1rem;
          background: linear-gradient(90deg, rgba(255,140,0,.07) 0%, transparent 100%);
          border-bottom: 1px solid rgba(255,140,0,.1);
        }
        .sh-icon { font-size: .85rem; flex-shrink: 0; }
        .sh-title {
          flex: 1; font-family: 'Press Start 2P', monospace; font-size: .4rem;
          color: #FF8C00; letter-spacing: 2px; text-shadow: 0 0 6px rgba(255,140,0,.3);
        }
        .sh-discord-link {
          font-family: 'Press Start 2P', monospace; font-size: .32rem;
          color: #5865F2; text-decoration: none; letter-spacing: 1px; transition: color .15s;
        }
        .sh-discord-link:hover { color: #7289DA; }

        .panel-empty {
          padding: 1.1rem 1rem; font-family: 'VT323', monospace;
          font-size: 1rem; color: rgba(255,255,255,.18); text-align: center; letter-spacing: 2px;
        }

        .skel {
          background: linear-gradient(90deg, rgba(255,255,255,.03) 0%,
            rgba(255,255,255,.065) 50%, rgba(255,255,255,.03) 100%);
          background-size: 200% 100%; animation: shimmer 1.6s infinite; border-radius: 4px;
        }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }

        /* ── Champions ── */
        .champs { display: flex; gap: .55rem; padding: .85rem .95rem; flex-wrap: wrap; }
        .champ-skel { flex:1; min-width:80px; height:108px; border-radius:8px; background:linear-gradient(90deg,rgba(255,215,0,.03) 0%,rgba(255,215,0,.06) 50%,rgba(255,215,0,.03) 100%); background-size:200% 100%; animation:shimmer 1.6s infinite; }
        .champ-card {
          flex: 1; min-width: 80px;
          display: flex; flex-direction: column; align-items: center; gap: .28rem;
          padding: .7rem .45rem;
          background: linear-gradient(160deg, rgba(255,215,0,.05) 0%, rgba(0,0,0,.3) 100%);
          border: 1px solid rgba(255,215,0,.15); border-radius: 8px; transition: all .2s;
        }
        .champ-card:hover { border-color: color-mix(in srgb, var(--cc) 50%, transparent); transform: translateY(-3px); box-shadow: 0 6px 18px rgba(0,0,0,.4); }
        .cc-league { font-family:'Press Start 2P',monospace; font-size:.28rem; padding:.1rem .38rem; border-radius:3px; border:1px solid; letter-spacing:1px; }
        .cc-logo-wrap { position:relative; width:44px; height:44px; }
        .cc-logo { width:44px; height:44px; object-fit:contain; filter:drop-shadow(0 0 6px rgba(255,215,0,.3)); }
        .cc-fallback { position:absolute; inset:0; display:none; align-items:center; justify-content:center; background:linear-gradient(135deg,#87CEEB,#4682B4); border-radius:6px; font-family:'Press Start 2P',monospace; font-size:.32rem; color:#000; }
        .cc-team { font-family:'Press Start 2P',monospace; font-size:.38rem; color:#E0E0E0; letter-spacing:.5px; text-align:center; }
        .cc-season { font-family:'VT323',monospace; font-size:.88rem; color:rgba(255,215,0,.4); }

        /* ── Top Scorers (placeholder) ── */
        .scorers { padding: .5rem 0; }
        .coming-soon {
          display: flex; flex-direction: column; align-items: center; gap: .6rem;
          padding: .85rem 1rem 1rem;
        }
        .cs-rows { width: 100%; display: flex; flex-direction: column; gap: .3rem; }
        .cs-row { display: flex; align-items: center; gap: .5rem; }
        .cs-rank { font-family:'Press Start 2P',monospace; font-size:.3rem; color:rgba(255,255,255,.2); min-width:20px; }
        .cs-bar-wrap { flex:1; height:6px; background:rgba(255,255,255,.05); border-radius:3px; overflow:hidden; }
        .cs-bar { height:100%; background:linear-gradient(90deg,rgba(255,140,0,.3),rgba(255,215,0,.2)); border-radius:3px; }
        .cs-pts { font-family:'VT323',monospace; font-size:.95rem; color:rgba(255,255,255,.2); min-width:16px; text-align:right; }
        .cs-label { font-family:'Press Start 2P',monospace; font-size:.32rem; color:rgba(255,255,255,.2); letter-spacing:1px; text-align:center; }

        /* ── Transactions ── */
        .transactions { padding: .25rem 0; }
        .tx-placeholder { display:flex; flex-direction:column; align-items:center; gap:.3rem; padding:.95rem 1rem; }
        .tx-icon { font-size:1.3rem; opacity:.28; }
        .tx-msg { font-family:'Press Start 2P',monospace; font-size:.34rem; color:rgba(255,255,255,.18); letter-spacing:1px; text-align:center; }
        .tx-row { display:flex; align-items:center; gap:.45rem; padding:.38rem .9rem; border-bottom:1px solid rgba(255,255,255,.03); transition:background .12s; }
        .tx-row:last-child { border-bottom:none; }
        .tx-row:hover { background:rgba(255,140,0,.04); }
        .tx-teams { display:flex; align-items:center; gap:.22rem; }
        .tx-team { font-family:'Press Start 2P',monospace; font-size:.34rem; color:#87CEEB; }
        .tx-arrow { color:#FF8C00; font-size:.95rem; }
        .tx-player { flex:1; font-family:'VT323',monospace; font-size:.95rem; color:#E0E0E0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .tx-date { font-family:'VT323',monospace; font-size:.82rem; color:rgba(255,255,255,.2); flex-shrink:0; }

        /* ── Discord events (compact) ── */
        .events { padding: .1rem 0; }
        .event-row {
          display: flex; align-items: center; gap: .5rem;
          padding: .35rem .75rem; text-decoration: none;
          border-bottom: 1px solid rgba(255,255,255,.03); transition: background .12s;
        }
        .event-row:last-child { border-bottom: none; }
        .event-row:hover { background: rgba(88,101,242,.06); }
        .ev-cal {
          display: flex; flex-direction: column; align-items: center;
          background: rgba(88,101,242,.1); border: 1px solid rgba(88,101,242,.22);
          border-radius: 5px; padding: .2rem .4rem; min-width: 34px; flex-shrink: 0;
        }
        .ev-mon { font-family:'Press Start 2P',monospace; font-size:.24rem; color:#7289DA; text-transform:uppercase; }
        .ev-day { font-family:'VT323',monospace; font-size:1.05rem; color:#fff; line-height:1; }
        .ev-info { flex:1; display:flex; flex-direction:column; gap:.1rem; min-width:0; }
        .ev-name { font-family:'Press Start 2P',monospace; font-size:.32rem; color:#E0E0E0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
        .ev-time { font-family:'VT323',monospace; font-size:.85rem; color:rgba(135,206,235,.4); }
        .ev-right { display:flex; flex-direction:column; align-items:flex-end; gap:.18rem; flex-shrink:0; }
        .ev-live-badge { font-family:'Press Start 2P',monospace; font-size:.24rem; background:rgba(0,255,100,.12); border:1px solid rgba(0,255,100,.35); color:#00FF64; padding:.1rem .3rem; border-radius:3px; animation:blink 1.4s ease-in-out infinite; }
        .ev-du { font-family:'Press Start 2P',monospace; font-size:.28rem; color:rgba(255,255,255,.25); letter-spacing:1px; }
        .ev-du-today { color:#00FF64; text-shadow:0 0 8px rgba(0,255,100,.4); animation:blink 1.4s ease-in-out infinite; }
        .ev-du-soon { color:#FFD700; }
        .events-cta { text-align:left !important; padding:.85rem !important; }
        .events-cta p { margin:0 0 .3rem; font-size:.9rem !important; }
        .events-setup { font-size:.78rem !important; color:rgba(255,255,255,.15) !important; letter-spacing:0 !important; }
        .events-setup code { background:rgba(255,255,255,.07); padding:.08rem .22rem; border-radius:3px; }

        /* ── Streaks placeholder ── */
        .streaks { padding: .5rem .85rem .75rem; }
        .streaks-cs { padding: .4rem 0 .6rem !important; }
        .streak-preview { display:flex; align-items:center; gap:.25rem; margin-bottom:.35rem; justify-content:center; }
        .sp-dot { width:18px; height:18px; border-radius:3px; display:flex; align-items:center; justify-content:center; font-family:'Press Start 2P',monospace; font-size:.28rem; }
        .sp-w { background:rgba(0,255,100,.15); border:1px solid rgba(0,255,100,.35); color:#00FF64; }
        .sp-l { background:rgba(255,60,60,.12); border:1px solid rgba(255,60,60,.3); color:#FF6B6B; }
        .sp-fade { font-family:'VT323',monospace; font-size:1rem; color:rgba(255,255,255,.2); }

        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.45} }

        /* ══ TICKER ═════════════════════════════════════════ */
        .ticker {
          position: fixed; bottom: 0; left: 0; right: 0; height: 44px;
          display: flex; align-items: stretch;
          background: linear-gradient(0deg,#020210 0%,#06061a 100%);
          border-top: 2px solid #FF8C00; z-index: 200;
          box-shadow: 0 -4px 28px rgba(255,140,0,.18);
        }
        .ticker-tag {
          display: flex; align-items: center; padding: 0 1rem;
          background: linear-gradient(90deg, #FF8C00, #FF5F00);
          font-family: 'Press Start 2P', monospace;
          font-size: .44rem; color: #000; letter-spacing: 3px;
          white-space: nowrap; border-right: 2px solid #FFD700; flex-shrink: 0;
        }
        .ticker-track { flex:1; overflow:hidden; display:flex; align-items:center; position:relative; }
        .ticker-track::before,.ticker-track::after { content:''; position:absolute; top:0; bottom:0; width:36px; z-index:1; pointer-events:none; }
        .ticker-track::before { left:0; background:linear-gradient(90deg,#06061a,transparent); }
        .ticker-track::after  { right:0; background:linear-gradient(-90deg,#06061a,transparent); }
        .ticker-reel { display:inline-flex; align-items:center; animation:scroll 80s linear infinite; white-space:nowrap; will-change:transform; }
        .ticker-reel:hover { animation-play-state:paused; }
        @keyframes scroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        .ti { display:inline-flex; align-items:center; gap:.38rem; padding:0 .95rem; flex-shrink:0; }
        .ti-logo { width:18px; height:18px; object-fit:contain; filter:drop-shadow(0 0 2px rgba(135,206,235,.3)); }
        .ti-team { font-family:'Press Start 2P',monospace; font-size:.4rem; color:#87CEEB; }
        .ti-score { font-family:'VT323',monospace; font-size:1.5rem; color:rgba(255,255,255,.42); line-height:1; min-width:12px; text-align:center; }
        .ti-score.ti-w { color:#FFD700; text-shadow:0 0 6px rgba(255,215,0,.45); }
        .ti-sep { font-family:'VT323',monospace; font-size:1rem; color:rgba(255,140,0,.28); }
        .ti-diamond { font-size:.38rem; color:rgba(255,140,0,.28); padding:0 .18rem; }
        .ticker-placeholder { font-family:'VT323',monospace; font-size:1.05rem; color:rgba(255,255,255,.15); letter-spacing:4px; animation:scroll 22s linear infinite; white-space:nowrap; will-change:transform; }

        /* ══ STREAKS ════════════════════════════════════════ */
        .streaks-panel { padding: .4rem 0 .5rem; }
        .streak-loading { padding: .3rem 0; }
        .streak-section { padding: .3rem .75rem .4rem; }
        .streak-section-lbl {
          font-family: 'Press Start 2P', monospace;
          font-size: .6rem;
          letter-spacing: 2px;
          margin-bottom: .35rem;
          padding: .15rem 0;
        }
        .streak-w-lbl { color: #00CC55; }
        .streak-l-lbl { color: #6B9FFF; }
        .streak-divider { height: 1px; background: rgba(255,255,255,.07); margin: .2rem .75rem; }
        .streak-empty {
          font-family: 'VT323', monospace; font-size: .9rem;
          color: rgba(255,255,255,.18); letter-spacing: 1px; padding: .2rem 0;
        }
        .streak-row {
          display: flex; align-items: center; gap: .4rem;
          padding: .3rem 0;
          border-bottom: 1px solid rgba(255,255,255,.04);
        }
        .streak-row:last-child { border-bottom: none; }
        .streak-rank {
          font-family: 'Press Start 2P', monospace; font-size: .48rem;
          color: rgba(255,255,255,.2); min-width: 18px; flex-shrink: 0;
        }
        .streak-logo {
          width: 32px; height: 32px; object-fit: contain;
          filter: drop-shadow(0 0 3px rgba(255,255,255,.15)); flex-shrink: 0;
        }
        .streak-logo-fb {
          width: 32px; height: 32px; display: none; align-items: center; justify-content: center;
          background: rgba(135,206,235,.1); border: 1px solid rgba(135,206,235,.15);
          border-radius: 3px; font-family: 'Press Start 2P', monospace; font-size: .22rem; color: #87CEEB; flex-shrink: 0;
        }
        .streak-team {
          font-family: 'Press Start 2P', monospace; font-size: .32rem;
          color: rgba(255,255,255,.55); min-width: 28px; flex-shrink: 0;
        }
        .streak-dots { display: flex; gap: 2px; align-items: center; flex: 1; }
        .sd {
          width: 7px; height: 7px; border-radius: 2px; flex-shrink: 0;
        }
        .sd-w { background: #00CC55; box-shadow: 0 0 4px rgba(0,204,85,.5); }
        .sd-l { background: #4477CC; box-shadow: 0 0 4px rgba(68,119,204,.4); }
        .sd-more {
          font-family: 'VT323', monospace; font-size: .85rem;
          color: rgba(255,255,255,.3); margin-left: 2px;
        }
        .streak-count {
          font-family: 'Press Start 2P', monospace; font-size: .48rem;
          flex-shrink: 0; min-width: 28px; text-align: right;
        }
        .streak-count-w { color: #00CC55; text-shadow: 0 0 8px rgba(0,204,85,.4); }
        .streak-count-l { color: #6B9FFF; text-shadow: 0 0 8px rgba(107,159,255,.35); }

        /* ══ RESPONSIVE ═════════════════════════════════════ */
        @media (max-width:1100px) { .cg { grid-template-columns:1fr; } }
        @media (min-width:1101px) and (max-width:1280px) { .cg { grid-template-columns: 1fr 300px; } }
        @media (max-width:900px) {
          .top-band { flex-direction:column; }
          .wordmark { flex-direction:row; align-items:center; gap:.5rem; border-right:none; border-bottom:1px solid rgba(255,140,0,.15); padding:.65rem 1rem; min-width:unset; }
          .wm-95 { font-size:1.1rem; }
          .countdown-bar { gap:.65rem; }
          .cb-leagues { gap:.55rem; }
        }
        @media (max-width:600px) {
          .cg { padding:.85rem; gap:.85rem; }
          .lc { padding:.4rem .6rem; gap:.25rem; }
          .lc-n { font-size:1.25rem; }
          .lc-unit { min-width:32px; padding:.15rem .35rem; }
          .gc { min-width:92px; }
        }
      `}</style>
    </div>
  );
}
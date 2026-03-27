import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import TwitchLiveWidget from '../components/TwitchLiveWidget';
import { useLeague } from '../components/LeagueContext';

const lgPrefix = (lg) => (lg || '').replace(/[0-9]/g, '').trim();
const LEAGUE_CONFIG = [
  { prefix: 'W', label: 'WN95', color: '#87CEEB' },
  { prefix: 'Q', label: 'THE Q', color: '#FFD700' },
  { prefix: 'V', label: 'VINTAGE', color: '#FF6B35' },
];
const leagueCfg = (prefix) =>
  LEAGUE_CONFIG.find((l) => l.prefix === prefix) ?? {
    prefix,
    label: prefix,
    color: '#aaa',
  };

const getFullTeamName = (teamCode, teams) => {
  const t = teams.find((t) => t.code === teamCode);
  return t ? t.team : teamCode;
};

// ─── Parse team row into display name parts ───────────────────────────────────
// e.g. { team:"Barrie Dolts", coach:"Dasri" }
//   → { city:"Barrie", nickname:"Dolts", full:"Barrie Dolts", coach:"Dasri" }
function parseTeamData(teamRow) {
  const fullName = teamRow?.team || '';
  const coach = teamRow?.coach || '';
  if (!fullName) return { city: '', nickname: '', full: '', coach };
  const parts = fullName.trim().split(' ');
  if (parts.length === 1)
    return { city: parts[0], nickname: parts[0], full: fullName, coach };
  const city = parts[0];
  const nickname = parts.slice(1).join(' ');
  return { city, nickname, full: fullName, coach };
}

function useLeagueCountdown(season, nextSeason) {
  const [tick, setTick] = useState(null);
  useEffect(() => {
    if (!season) return;

    if (season.status === 'playoffs') {
      setTick({ mode: 'playoffs', seasonLabel: season.lg });
      return;
    }

    const targetDate =
      season.status === 'offseason'
        ? season.start_date // ← this would be on the NEXT season row
        : season.end_date;

    if (!targetDate) {
      setTick({ mode: season.status || 'done', seasonLabel: season.lg });
      return;
    }

    const calc = () => {
      const diff = new Date(targetDate) - Date.now();
      if (diff <= 0) {
        setTick({ mode: 'done', seasonLabel: season.lg });
        return;
      }
      setTick({
        mode: season.status || 'season',
        seasonLabel: season.lg,
        nextSeasonLabel: nextSeason?.lg || null, // ← e.g. "W17"
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
  }, [season, nextSeason]);
  return tick;
}

const p2 = (n) => String(n ?? 0).padStart(2, '0');

function daysUntil(iso) {
  if (!iso) return null;
  const norm = /[Zz]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z';
  const evMs = new Date(norm).getTime();
  if (isNaN(evMs) || evMs < Date.now()) return null;
  const now = new Date(),
    ev = new Date(evMs);
  const todayMid = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const evMid = new Date(
    ev.getFullYear(),
    ev.getMonth(),
    ev.getDate()
  ).getTime();
  const days = Math.round((evMid - todayMid) / 86400000);
  if (days === 0) return 'TODAY';
  if (days === 1) return 'TMRW';
  return `${days}D`;
}

function ClockDisplay() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="ht-clock-inner">
      <span className="ht-clock-time">{time}</span>
      <span className="ht-clock-label">ET</span>
    </div>
  );
}

function InlineCountdown({ cfg, tick }) {
  const uc = tick?.urgent ? '#FF3B3B' : tick?.warning ? '#FFB800' : cfg.color;

  const renderRight = () => {
    if (!tick) return <span className="icd-awaiting">AWAITING</span>;

    if (tick.mode === 'playoffs') {
      return (
        <div className="icd-complete">
          <span style={{ fontSize: 15 }}>🏒</span>
          <span className="icd-done-txt" style={{ color: '#00BFA5' }}>
            PLAYOFFS
          </span>
        </div>
      );
    }

    if (tick.mode === 'offseason') {
      if (!tick.d && tick.d !== 0) {
        // No start_date on next season — just show offseason badge
        return (
          <div className="icd-complete">
            <span style={{ fontSize: 15 }}>☀️</span>
            <span className="icd-done-txt">OFFSEASON</span>
          </div>
        );
      }
      // Has a countdown — show it
      return (
        <div className="icd-clock">
          {[
            { v: tick.d, u: 'D' },
            { v: tick.h, u: 'H' },
            { v: tick.m, u: 'M' },
            { v: tick.s, u: 'S' },
          ].map(({ v, u }) => (
            <div key={u} className="icd-unit">
              <span className="icd-n">{p2(v)}</span>
              <span className="icd-u">{u}</span>
            </div>
          ))}
        </div>
      );
    }

    if (tick.mode === 'done') {
      return (
        <div className="icd-complete">
          <span style={{ fontSize: 15 }}>🏆</span>
          <span className="icd-done-txt">COMPLETE</span>
        </div>
      );
    }

    // Default: season countdown
    return (
      <div className="icd-clock">
        {[
          { v: tick.d, u: 'D' },
          { v: tick.h, u: 'H' },
          { v: tick.m, u: 'M' },
          { v: tick.s, u: 'S' },
        ].map(({ v, u }) => (
          <div key={u} className="icd-unit">
            <span className="icd-n">{p2(v)}</span>
            <span className="icd-u">{u}</span>
          </div>
        ))}
        {tick.d < 7 && (
          <span style={{ fontSize: 15, marginLeft: 2 }}>
            {tick.urgent ? '🚨' : '⚡'}
          </span>
        )}
      </div>
    );
  };

  // Eyebrow label changes by mode
  const eyebrow =
    tick?.mode === 'offseason'
      ? `☀️ OFFSEASON`
      : tick?.mode === 'playoffs'
      ? '🏒 PLAYOFFS ACTIVE'
      : '⏱ SEASON COUNTDOWN';

  return (
    <div className="icd" style={{ '--ic': uc }}>
      <div className="icd-left">
        <span className="icd-eyebrow">{eyebrow}</span>
        <div className="icd-meta">
          <span className="icd-dot" />
          <span className="icd-league">{cfg.label}</span>
          {tick?.mode === 'offseason' && tick?.nextSeasonLabel ? (
            <span className="icd-season">{tick.nextSeasonLabel} STARTS</span>
          ) : tick?.seasonLabel ? (
            <span className="icd-season">{tick.seasonLabel}</span>
          ) : null}
        </div>
      </div>

      <div className="icd-right">{renderRight()}</div>
    </div>
  );
}

function PanelHeader({ icon, title, action }) {
  return (
    <div className="ph">
      <span className="ph-icon">{icon}</span>
      <span className="ph-title">{title}</span>
      {action && <div className="ph-action">{action}</div>}
    </div>
  );
}

const SL_PANELS = [
  { id: 'hot', icon: '🔥', label: 'HOTTEST TEAMS', sub: 'Best record last 10' },
  {
    id: 'cold',
    icon: '🥶',
    label: 'COLDEST TEAMS',
    sub: 'Worst record last 10',
  },
  {
    id: 'wstreak',
    icon: '🏆',
    label: 'WIN STREAKS',
    sub: 'Active win streaks',
  },
  {
    id: 'lstreak',
    icon: '💀',
    label: 'LOSS STREAKS',
    sub: 'Active loss streaks',
  },
  { id: 'scorers', icon: '⭐', label: 'TOP SCORERS', sub: 'Points leaders' },
];

function Spotlight({
  recentForm,
  winStreaks,
  lossStreaks,
  loading,
  topSeasonScorers,
  isPlayoffActive,
}) {
  const [idx, setIdx] = useState(2);
 /* const timerRef = useRef(null);
  const startTimer = useCallback(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(
      () => setIdx((i) => (i + 1) % SL_PANELS.length),
      8000
    );
  }, []); 
  useEffect(() => {
    startTimer();
    return () => clearInterval(timerRef.current);
  }, [startTimer]); */
  
  const goTo = (i) => {
    setIdx(i);
  };
  const p = SL_PANELS[idx];

  const rows = () => {
    if (loading)
      return [1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="skel"
          style={{ height: 24, margin: '.12rem .65rem' }}
        />
      ));
    if (p.id === 'hot' || p.id === 'cold') {
      const list = p.id === 'hot' ? recentForm.hot : recentForm.cold;
      if (!list.length)
        return <div className="sl-empty">No data available</div>;
      return list.map((t, i) => (
        <div key={t.team} className="sl-row">
          <span className="sl-rank">#{i + 1}</span>
          <img
            src={`/assets/teamLogos/${t.team}.png`}
            alt=""
            className="sl-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className="sl-team">{t.team}</span>
          <div className="sl-dots">
            {t.last10.map((w, j) => (
              <span
                key={j}
                className={`sl-dot ${w ? 'sl-dot-w' : 'sl-dot-l'}`}
              />
            ))}
          </div>
          <span
            className={`sl-val ${
              p.id === 'hot' ? 'sl-val-hot' : 'sl-val-cold'
            }`}
          >
            {t.w}-{t.l}
          </span>
        </div>
      ));
    }
    if (p.id === 'wstreak') {
      if (!winStreaks.length)
        return <div className="sl-empty">No active win streaks</div>;
      return winStreaks.slice(0, 5).map((s, i) => (
        <div key={s.team} className="sl-row">
          <span className="sl-rank">#{i + 1}</span>
          <img
            src={`/assets/teamLogos/${s.team}.png`}
            alt=""
            className="sl-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className="sl-team">{s.team}</span>
          <div className="sl-dots">
            {Array.from({ length: Math.min(s.count, 10) }, (_, j) => (
              <span key={j} className="sl-dot sl-dot-w" />
            ))}
            {s.count > 10 && (
              <span className="sl-dots-more">+{s.count - 10}</span>
            )}
          </div>
          <span className="sl-val sl-val-hot">{s.count}W</span>
        </div>
      ));
    }
    if (p.id === 'lstreak') {
      if (!lossStreaks.length)
        return <div className="sl-empty">No active loss streaks</div>;
      return lossStreaks.slice(0, 5).map((s, i) => (
        <div key={s.team} className="sl-row">
          <span className="sl-rank">#{i + 1}</span>
          <img
            src={`/assets/teamLogos/${s.team}.png`}
            alt=""
            className="sl-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <span className="sl-team">{s.team}</span>
          <div className="sl-dots">
            {Array.from({ length: Math.min(s.count, 10) }, (_, j) => (
              <span key={j} className="sl-dot sl-dot-l" />
            ))}
            {s.count > 10 && (
              <span className="sl-dots-more">+{s.count - 10}</span>
            )}
          </div>
          <span className="sl-val sl-val-cold">{s.count}L</span>
        </div>
      ));
    }
    if (p.id === 'scorers') {
      if (!topSeasonScorers?.length)
        return <div className="sl-empty">No scorer data</div>;
      return topSeasonScorers.slice(0, 5).map((s, i) => (
        <div key={s.name} className="sl-row">
          <span className="sl-rank">#{i + 1}</span>
          <img
            src={`/assets/teamLogos/${s.team}.png`}
            alt=""
            className="sl-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />

          <span className="sl-team">
            {s.name.trim().split(' ').slice(-1)[0]}
          </span>
          <span className="sl-val sl-val-hot">{s.pts}</span>
        </div>
      ));
    }

    return (
      <div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="sl-row" style={{ opacity: 1 - i * 0.15 }}>
            <span className="sl-rank">#{i}</span>
            <div className="sl-bar-wrap">
              <div className="sl-bar" style={{ width: `${100 - i * 13}%` }} />
            </div>
            <span className="sl-val" style={{ color: 'rgba(255,255,255,.18)' }}>
              —
            </span>
          </div>
        ))}
        <div className="sl-coming">PLAYER STATS COMING SOON</div>
      </div>
    );
  };

  return (
    <section className="panel sl-panel">
      <div className="sl-tabs">
        {SL_PANELS.map((sp, i) => (
          <button
            key={sp.id}
            className={`sl-tab ${i === idx ? 'sl-tab-on' : ''}`}
            onClick={() => goTo(i)}
            title={sp.label}
          >
            {sp.icon}
          </button>
        ))}
      </div>
      <div className="sl-titlebar">
        <span className="sl-title">
          {p.icon} {p.label}
        </span>
        <span className="sl-sub">{p.sub}</span>
      </div>
      <div className="sl-body">{rows()}</div>
      
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEAGUE GAZETTE — Daily AI-Generated Newspaper
═══════════════════════════════════════════════════════════════ */


function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

const STORY_META = {
  hot_streak: { color: '#FF4500', tag: 'ON FIRE' },
  win_streak: { color: '#00C853', tag: 'WIN STREAK' },
  cold_streak: { color: '#448AFF', tag: 'COLD SPELL' },
  loss_streak: { color: '#448AFF', tag: 'LOSING SKID' },
  big_win: { color: '#FFD600', tag: 'BIG WIN' },
  elimination: { color: '#D50000', tag: 'ELIMINATED' },
  playoff_push: { color: '#00BFA5', tag: 'PLAYOFF PUSH' },
  milestone: { color: '#FFD600', tag: 'MILESTONE' },
  comeback: { color: '#FF6D00', tag: 'COMEBACK' },
  idle: { color: '#78909C', tag: 'QUIET NIGHT' },
  rivalry: { color: '#E040FB', tag: 'RIVALRY WATCH' },
};
const getMeta = (t) => STORY_META[t] || STORY_META.hot_streak;

/* ─────────────────────────────────────────────────────────────
   Fetch from Supabase edge fn
   Now receives: teamNameMap (abr→{city,nickname,full}) + topScorers
───────────────────────────────────────────────────────────── */
async function fetchGazetteEdition({ leagueLabel, currentSeason, isPlayoffActive }) {
  const today = new Date().toISOString().split('T')[0];
  const isOffseason = currentSeason?.status === 'offseason';
  const season = currentSeason?.lg || leagueLabel;

  let cacheKey;
  if (isOffseason) {
    cacheKey = `${leagueLabel}_offseason`;
  } else if (isPlayoffActive) {
    cacheKey = `${leagueLabel}_playoff`;
  } else {
    cacheKey = `${leagueLabel}_${season}`;
  }

  try {
    const res = await supabase
      .from('gazette_cache')
      .select('data, date')
      .eq('league', cacheKey)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const cached = res.data;
    if (!cached?.data) {
      console.log('[Gazette] No cache found for', cacheKey);
      return null;
    }
    if (cached.date === today) {
      console.log('[Gazette] ✅ Serving cached edition for', cacheKey);
      return typeof cached.data === 'string' ? JSON.parse(cached.data) : cached.data;
    }
    console.log('[Gazette] Cache is stale for', cacheKey);
    return null;
  } catch (e) {
    console.log('[Gazette] Cache lookup failed:', e.message);
    return null;
  }
}

/* ─────────────────────────────────────────────────────────────
   Skeleton loader
───────────────────────────────────────────────────────────── */
function GazetteSkeleton() {
  return (
    <div className="si-skel">
      <div className="si-skel-cover">
        <div
          className="si-skel-b"
          style={{ height: 12, width: '30%', marginBottom: 8 }}
        />
        <div
          className="si-skel-b"
          style={{ height: 22, width: '68%', marginBottom: 6 }}
        />
        <div className="si-skel-b" style={{ height: 14, width: '55%' }} />
      </div>
      <div className="si-skel-grid">
        <div className="si-skel-col">
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div
                className="si-skel-b"
                style={{ height: 8, width: '40%', marginBottom: 6 }}
              />
              <div
                className="si-skel-b"
                style={{ height: 14, width: '92%', marginBottom: 4 }}
              />
              <div className="si-skel-b" style={{ height: 11, width: '72%' }} />
            </div>
          ))}
        </div>
        <div className="si-skel-b si-skel-hero" />
        <div className="si-skel-col">
          <div
            className="si-skel-b"
            style={{ height: 72, borderRadius: 6, marginBottom: 14 }}
          />
          {[88, 75, 60, 50].map((w, i) => (
            <div
              key={i}
              className="si-skel-b"
              style={{ height: 10, width: `${w}%`, marginBottom: 7 }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main LeagueGazette component
   New props: teamNameMap, topScorers
───────────────────────────────────────────────────────────── */
function LeagueGazette({
  leagueLabel,
  recentForm,
  winStreaks,
  lossStreaks,
  currentSeason,
  loading: dataLoading,
  teamNameMap,
  topScorers,
  recentGames,
  isPlayoffActive,
  playoffSeriesData,
  gameStats,
  teams,
  championTeam,
}) {
  const [edition, setEdition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [featuredSrc, setFeaturedSrc] = useState(null);
  const [useBanner, setUseBanner] = useState(false);
  const probeRef = useRef(null);
  
  const team = edition?.featured_team || '';
  // Resolve to a team code even if AI returned a full name
  const teamCode =
    Object.entries(teamNameMap).find(
      ([code, info]) => info.full === team || code === team
    )?.[0] || team;

    useEffect(() => {
      if (!teamCode) return;
      setFeaturedSrc(null);
      setUseBanner(false);
    
      const isOffseason = currentSeason?.status === 'offseason';
    
      if (edition?.champion_team && currentSeason?.status === 'playoffs') {
        setFeaturedSrc(`/assets/team-art/champ/${teamCode}.png`);
        return;
      }
    
      const found = [];
      let cancelled = false;
    
      const check = (n) => {
        if (cancelled) return;
        if (n > 10) {
          found.length > 0
            ? setFeaturedSrc(found[Math.floor(Math.random() * found.length)])
            : setUseBanner(true);
          return;
        }
        const url = `/assets/team-art/random/${teamCode}${n}.png`;
        const img = new Image();
        img.onload = () => {
          if (!cancelled) {
            found.push(url);
            check(n + 1);
          }
        };
        img.onerror = () => {
          if (!cancelled) check(n + 1);
        };
        img.src = url;
      };
    
      check(1);
    
      return () => {
        cancelled = true;
      };
    }, [teamCode, edition?.champion_team, currentSeason?.status]);
  
   

    const load = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchGazetteEdition({
          leagueLabel,
          currentSeason,
          isPlayoffActive,
        });
        if (!data) {
          console.log('[Gazette] No cached edition — not displaying');
          setEdition(null);
        } else {
          setEdition(data);
        }
      } catch (e) {
        console.error('[Gazette]', e);
        setError(true);
      } finally {
        setLoading(false);
      }
    }, [leagueLabel, currentSeason?.lg, currentSeason?.status, isPlayoffActive]);

  const loadedKeyRef = useRef(null);

  useEffect(() => {
    if (!currentSeason?.lg) return;
    const key = `${leagueLabel}-${currentSeason.lg}-${isPlayoffActive}`;
    if (loadedKeyRef.current === key) return;
    loadedKeyRef.current = key;
    load();
  }, [leagueLabel, currentSeason?.lg, isPlayoffActive, load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  
  const meta = getMeta(edition?.story_type);
  const lgKey = leagueLabel?.match(/[A-Za-z]/g)?.[0]?.toLowerCase() || 'w';
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // All lookups use teamCode (the real abr), not team (which may be a full name)
  const featWin = winStreaks.find((s) => s.team === teamCode);
  const featLoss = lossStreaks.find((s) => s.team === teamCode);
  const featForm =
    recentForm.hot.find((t) => t.team === teamCode) ||
    recentForm.cold.find((t) => t.team === teamCode);

  // Full name for the hero footer — key into map by teamCode, not team
  const featFullName = teamNameMap[teamCode]?.full || teamCode;

  
  return (
    <div
      className="si-wrap"
      style={{ '--acc': meta.color, '--acc2': meta.color + '22' }}
    >
      {/* ══ MASTHEAD ══════════════════════════════════════════ */}
      <header className="si-mast">
        <div className="si-mast-left">
          <img
            src={`/assets/leagueLogos/${lgKey}.png`}
            alt={leagueLabel}
            className="si-league-logo"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <div>
            <div className="si-mast-name">{leagueLabel}</div>
            <div className="si-mast-sub">MAGAZINE</div>
          </div>
        </div>
        <div className="si-mast-mid">
          <hr className="si-hr" />
          <span className="si-mast-date">{dateStr}</span>
          <hr className="si-hr" />
        </div>
        <div className="si-mast-right">
          {edition?.edition && (
            <span className="si-issue">{edition.edition}</span>
          )}
        </div>
      </header>

      <div className="si-accent-rule" />

      {/* ══ BODY ══════════════════════════════════════════════ */}
      {loading && !edition ? (
        <GazetteSkeleton />
      ) : error ? (
        <div className="si-error">
          <span>📡</span>
          <div>
            <div className="si-err-title">PRESS ROOM DOWN</div>
            <div className="si-err-body">Edge function unavailable.</div>
          </div>
          <button className="si-refresh" onClick={handleRefresh}>
            ↻ RETRY
          </button>
        </div>
      ) : edition ? (
        <div>
          {/* ── COVER STRIP ─────────────────────────────── */}
          <div className="si-cover-strip">
            <span className="si-story-pill" style={{ background: meta.color }}>
              {meta.tag}
            </span>
            <h1 className="si-cover-line">{edition.cover_line}</h1>
            <p className="si-cover-sub">{edition.cover_sub}</p>
          </div>

          {/* ── THREE COLUMN ────────────────────────────── */}
          <div className="si-cols">
            {/* LEFT — story blurbs */}
            <aside className="si-col-left">
              {[edition.blurb_1, edition.blurb_2, edition.blurb_3]
                .filter(Boolean)
                .map((b, i) => (
                  <div key={i} className="si-blurb">
                    <div className="si-blurb-bar" />
                    <div className="si-blurb-tag">{b.tag}</div>
                    <div className="si-blurb-hed">{b.headline}</div>
                    <div className="si-blurb-dek">{b.detail}</div>
                  </div>
                ))}
            </aside>

            {/* CENTER — team hero */}
            <div className="si-col-center">
              <div className="si-hero">
              <div className="si-hero-bg">
              {featuredSrc ? (
                <img
                  src={featuredSrc}
                  alt=""
                  className={edition?.champion_team ? 'si-hero-champ' : 'si-hero-featured'}
                  onError={() => setUseBanner(true)}
                />
              ) : (
                <img
                  src={`/assets/banners/${teamCode}.png`}
                  alt=""
                  className="si-hero-banner"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              )}
              <div className="si-hero-vignette" />
            </div>
                <div className="si-hero-body">
                <img
                  src={`/assets/teamLogos/${teamCode || 'placeholder'}.png`}
                  alt={teamCode}
                  className="si-hero-logo"
                  onError={(e) => {
                    e.currentTarget.style.opacity = '0';
                  }}
                />
                </div>
                <div className="si-hero-foot">
                  {/* Show full team name in hero footer */}
                  <div className="si-hero-name-wrap">
                    <span className="si-hero-team">{featFullName}</span>
                    <span className="si-hero-code">{teamCode}</span>
                  </div>
                  <div className="si-hero-badges">
                    {featWin && (
                      <span className="si-badge si-badge-w">
                        W{featWin.count}
                      </span>
                    )}
                    {featLoss && (
                      <span className="si-badge si-badge-l">
                        L{featLoss.count}
                      </span>
                    )}
                    {featForm && (
                      <span className="si-badge si-badge-form">
                        {featForm.w}–{featForm.l}{' '}
                        <span className="si-badge-l10">L10</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT — quote + live tables */}
            <aside className="si-col-right">
              <div className="si-quote">
                <div className="si-quote-open">"</div>
                <p className="si-quote-text">{edition.pull_quote}</p>
                <div className="si-quote-attr">{edition.quote_attr}</div>
              </div>

              {/* Recent scorers callout — if we have any */}
              {topScorers.length > 0 && (
                <div className="si-table">
                  <div className="si-table-hd">
                    <span
                      className="si-table-dot"
                      style={{ background: '#FFD600' }}
                    />
                    LAST NIGHT
                  </div>
                  {topScorers.slice(0, 5).map((s, i) => (
                    <div key={i} className="si-table-row">
                      <img
                        src={`/assets/teamLogos/${s.g_team}.png`}
                        alt=""
                        className="si-table-logo"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className="si-table-team si-table-player">
                        {s.goal_player_name}
                      </span>
                      <div className="si-scorer-right">
                        {s.fourGoalGame && (
                          <span
                            className="si-achieve si-achieve-4g"
                            title="4-Goal Game"
                          >
                            🔥
                          </span>
                        )}
                        {!s.fourGoalGame && s.hatTrick && (
                          <span
                            className="si-achieve si-achieve-hat"
                            title="Hat Trick"
                          >
                            🎩
                          </span>
                        )}
                        {!s.fourGoalGame && !s.hatTrick && s.bigNight && (
                          <span
                            className="si-achieve si-achieve-big"
                            title="Big Night"
                          >
                            ⭐
                          </span>
                        )}
                        <span className="si-table-val si-val-scorer">
                          {s.goals}G {s.assists}A
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* On fire */}
              {winStreaks.length > 0 && (
                <div className="si-table">
                  <div className="si-table-hd">
                    <span
                      className="si-table-dot"
                      style={{ background: '#FF4500' }}
                    />
                    ON FIRE
                  </div>
                  {winStreaks.slice(0, 4).map((s) => (
                    <div key={s.team} className="si-table-row">
                      <img
                        src={`/assets/teamLogos/${s.team}.png`}
                        alt=""
                        className="si-table-logo"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className="si-table-team">
                        {teamNameMap[s.team]?.city || s.team}
                      </span>
                      <span className="si-table-val si-val-w">W{s.count}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Ice cold */}
              {lossStreaks.length > 0 && (
                <div className="si-table">
                  <div className="si-table-hd">
                    <span
                      className="si-table-dot"
                      style={{ background: '#448AFF' }}
                    />
                    ICE COLD
                  </div>
                  {lossStreaks.slice(0, 4).map((s) => (
                    <div key={s.team} className="si-table-row">
                      <img
                        src={`/assets/teamLogos/${s.team}.png`}
                        alt=""
                        className="si-table-logo"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className="si-table-team">
                        {teamNameMap[s.team]?.city || s.team}
                      </span>
                      <span className="si-table-val si-val-l">L{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </div>

          {/* ── BOTTOM LINE ─────────────────────────────── */}
          <div className="si-footer">
            <span className="si-footer-label">BOTTOM LINE</span>
            <span className="si-footer-text">{edition.bottom_line}</span>
          </div>
        </div>
      ) : null}

      <style>{`
        .si-wrap {
          --si-bg:      #09090e;
          --si-bg-card: #0d0d14;
          --si-border:  rgba(255,255,255,.07);
          --si-text:    rgba(225,220,210,.85);
          --si-muted:   rgba(180,175,160,.42);
          --si-serif:   'Georgia', 'Times New Roman', serif;
          font-family: 'VT323', monospace;
          background: var(--si-bg);
          border: 1px solid var(--si-border);
          border-radius: 10px;
          overflow: hidden;
          position: relative;
        }
        .si-wrap::before {
          content:''; position:absolute; inset:0; z-index:0; pointer-events:none;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='250' height='250' filter='url(%23g)' opacity='0.025'/%3E%3C/svg%3E");
          opacity:.7;
        }
        .si-wrap > * { position:relative; z-index:1; }

        .si-mast {
          display: flex; align-items: center; gap: .8rem;
          padding: .6rem .95rem .5rem;
          border-bottom: 1px solid var(--si-border);
          background: var(--si-bg);
        }
        .si-mast-left { display:flex; align-items:center; gap:.4rem; flex-shrink:0; }
        .si-league-logo {
          width:28px; height:28px; object-fit:contain;
          filter:drop-shadow(0 0 5px rgba(255,255,255,.15));
        }
        .si-mast-name {
          font-family:'Press Start 2P',monospace; font-size:11px;
          color:#fff; letter-spacing:2px; line-height:1;
        }
        .si-mast-sub {
          font-family:'Press Start 2P',monospace; font-size:6px;
          color:rgba(255,255,255,.75); letter-spacing:4px; line-height:1; margin-top:2px;
        }
        .si-mast-mid {
          flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; min-width:0;
        }
        .si-hr { width:100%; border:none; border-top:1px solid var(--si-border); margin:0; }
        .si-hr-short { flex:1; }
        .si-mast-date {
          font-family:'VT323',monospace; font-size:14px;
          color:rgba(255,255,255,.82); letter-spacing:1px; white-space:nowrap;
        }
        .si-mast-right { display:flex; align-items:center; gap:.5rem; flex-shrink:0; }
        .si-issue {
          font-family:'VT323',monospace; font-size:13px;
          color:rgba(255,255,255,.72); letter-spacing:.5px; white-space:nowrap;
        }
        .si-refresh {
          font-family:'Press Start 2P',monospace; font-size:9px;
          color:rgba(255,255,255,.3); background:rgba(255,255,255,.035);
          border:1px solid rgba(255,255,255,.07); border-radius:4px;
          padding:.2rem .45rem; cursor:pointer; transition:all .15s; line-height:1;
          white-space:nowrap;
        }
        .si-refresh:hover:not(:disabled) {
          color:rgba(255,255,255,.65); border-color:rgba(255,255,255,.18);
          background:rgba(255,255,255,.06);
        }
        .si-refresh:disabled { opacity:.3; cursor:not-allowed; }
        @keyframes siSpin { to{transform:rotate(360deg);} }

        .si-accent-rule {
          height:3px;
          background:linear-gradient(90deg, transparent 0%, var(--acc) 20%, color-mix(in srgb,var(--acc) 60%,#fff) 50%, var(--acc) 80%, transparent 100%);
          box-shadow:0 0 14px color-mix(in srgb,var(--acc) 45%,transparent);
        }

        .si-cover-strip {
          padding: .65rem .95rem .5rem;
          border-bottom: 1px solid var(--si-border);
          display:flex; flex-direction:column; gap:.28rem;
        }
        .si-story-pill {
          display:inline-block;
          font-family:'Press Start 2P',monospace; font-size:7px;
          color:#fff; letter-spacing:2.5px; padding:.18rem .5rem;
          border-radius:2px; line-height:1; align-self:flex-start;
        }
        .si-cover-line {
          font-family:'Press Start 2P',monospace;
          font-size:clamp(12px,1.45vw,17px);
          color:#fff; letter-spacing:1.5px; margin:0;
          line-height:1.55; text-transform:uppercase;
        }
        .si-cover-sub {
          font-family:'VT323',monospace; font-size:22px;
          color:rgba(210,205,190,.75); margin:0; line-height:1.35;
          font-style:italic; letter-spacing:.4px; max-width:66ch;
        }

        .si-cols {
          display:grid;
          grid-template-columns: 1fr 1.5fr 1fr;
          min-height:270px;
        }

        .si-col-left {
          display:flex; flex-direction:column; justify-content:space-evenly;
          padding:.7rem .75rem .7rem .9rem;
          border-right:1px solid var(--si-border);
          gap:.05rem;
        }
        .si-blurb {
          padding:.4rem 0 .5rem;
          border-bottom:1px solid rgba(255,255,255,.04);
        }
        .si-blurb:last-child { border-bottom:none; }
        .si-blurb-bar {
          width:18px; height:2px;
          background:var(--acc);
          box-shadow:0 0 6px color-mix(in srgb,var(--acc) 55%,transparent);
          border-radius:1px; margin-bottom:.26rem;
        }
        .si-blurb-tag {
          font-family:'Press Start 2P',monospace; font-size:6.5px;
          color:var(--acc); letter-spacing:2px; margin-bottom:.2rem;
          text-shadow:0 0 8px color-mix(in srgb,var(--acc) 45%,transparent);
        }
        .si-blurb-hed {
          font-family:'VT323',monospace; font-size:20px;
          color:rgba(235,228,210,.92); line-height:1.3; margin-bottom:.1rem;
          letter-spacing:.3px;
        }
        .si-blurb-dek {
          font-family:'VT323',monospace; font-size:17px;
          color:rgba(190,184,168,.65); line-height:1.3;
        }

        .si-col-center { display:flex; align-items:stretch; }
        .si-hero {
          flex:1; position:relative; overflow:hidden; min-height:270px;
          display:flex; flex-direction:column;
        }
        .si-hero-bg {
          position:absolute; inset:0;
          background:linear-gradient(150deg,
            color-mix(in srgb,var(--acc) 20%,#060610) 0%,
            #060610 60%
          );
        }
        .si-hero-banner {
          position:absolute; inset:0; width:100%; height:100%;
          object-fit:cover; opacity:.13;
          filter:saturate(1.8) blur(3px);
        }
        .si-hero-vignette {
          position:absolute; inset:0;
          background:
            radial-gradient(ellipse 75% 55% at 50% 35%,
              color-mix(in srgb,var(--acc) 14%,transparent) 0%,
              transparent 70%
            ),
            linear-gradient(180deg, transparent 35%, rgba(4,4,10,.96) 100%);
        }
        .si-hero-body {
          position:relative; z-index:2;
          flex:1; display:flex; align-items:center; justify-content:center;
          padding:1.1rem .8rem .4rem;
        }
        .si-hero-logo {
          width:78%; max-width:145px; height:auto; object-fit:contain;
          filter:
            drop-shadow(0 0 22px color-mix(in srgb,var(--acc) 55%,transparent))
            drop-shadow(0 0 55px color-mix(in srgb,var(--acc) 22%,transparent))
            drop-shadow(0 5px 18px rgba(0,0,0,.65));
          animation:siFloat 5s ease-in-out infinite;
        }
        @keyframes siFloat {
          0%,100%{transform:translateY(0);}
          50%{transform:translateY(-5px);}
        }
        .si-hero-foot {
          position:relative; z-index:2;
          display:flex; align-items:center; justify-content:space-between;
          padding:.35rem .75rem .4rem;
          background:linear-gradient(0deg,rgba(4,4,10,.92) 0%,transparent 100%);
        }
        .si-hero-name-wrap {
          display:flex; flex-direction:column; gap:2px;
        }
        .si-hero-team {
          font-family:'Press Start 2P',monospace; font-size:7.5px;
          color:rgba(255,255,255,.65); letter-spacing:1px; line-height:1;
        }
        .si-hero-featured {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          opacity: 0.55;
          filter: saturate(1.4);
          transition: opacity 0.4s ease;
        }
        .si-hero-champ {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: cover;
          opacity: 0.72;
          filter: saturate(1.6) brightness(1.05);
          transition: opacity 0.4s ease;
        }
        .si-hero-code {
          font-family:'VT323',monospace; font-size:12px;
          color:rgba(255,255,255,.25); letter-spacing:2px; line-height:1;
        }
        .si-hero-badges { display:flex; align-items:center; gap:.28rem; }
        .si-badge {
          font-family:'Press Start 2P',monospace; font-size:7.5px;
          padding:.15rem .32rem; border-radius:3px; line-height:1;
        }
        .si-badge-w {
          background:rgba(0,200,83,.12); color:#00C853;
          border:1px solid rgba(0,200,83,.28);
        }
        .si-badge-l {
          background:rgba(68,138,255,.12); color:#448AFF;
          border:1px solid rgba(68,138,255,.28);
        }
        .si-badge-form {
          background:rgba(255,255,255,.05); color:rgba(255,255,255,.38);
          border:1px solid rgba(255,255,255,.09);
          font-size:6.5px; letter-spacing:.5px;
        }
        .si-badge-l10 { opacity:.55; margin-left:2px; }

        .si-col-right {
          display:flex; flex-direction:column; justify-content:flex-start;
          gap:.6rem; padding:.7rem .9rem .7rem .75rem;
          border-left:1px solid var(--si-border);
        }
        .si-quote {
          position:relative;
          padding:.55rem .65rem .5rem .75rem;
          background:rgba(255,255,255,.022);
          border-left:2.5px solid var(--acc);
          border-radius:0 5px 5px 0;
        }
        .si-quote-open {
          position:absolute; top:-10px; left:7px;
          font-family:var(--si-serif); font-size:52px;
          color:color-mix(in srgb,var(--acc) 22%,transparent);
          line-height:1; pointer-events:none;
        }
        .si-quote-text {
          font-family:'VT323',monospace; font-size:19px;
          color:rgba(230,222,205,.82); font-style:italic;
          margin:0 0 .22rem; line-height:1.4; letter-spacing:.3px;
        }
        .si-quote-attr {
          font-family:'Press Start 2P',monospace; font-size:6px;
          color:var(--si-muted); letter-spacing:.8px; line-height:1.5;
        }
        .si-table { display:flex; flex-direction:column; gap:.15rem; }
        .si-table-hd {
          display:flex; align-items:center; gap:.28rem;
          font-family:'Press Start 2P',monospace; font-size:6.5px;
          color:rgba(255,255,255,.22); letter-spacing:2px;
          margin-bottom:.05rem; text-transform:uppercase;
        }
        .si-table-dot {
          width:5px; height:5px; border-radius:50%; flex-shrink:0;
          box-shadow:0 0 4px currentColor;
        }
        .si-table-row {
          display:flex; align-items:center; gap:.28rem;
          padding:.16rem .22rem; border-radius:4px; transition:background .1s;
        }
        .si-table-row:hover { background:rgba(255,255,255,.03); }
        .si-table-logo {
          width:17px; height:17px; object-fit:contain; flex-shrink:0;
          filter:drop-shadow(0 0 2px rgba(255,255,255,.1));
        }
        .si-table-team {
          flex:1; font-family:'Press Start 2P',monospace; font-size:7px;
          color:rgba(210,205,190,.45); letter-spacing:.5px;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        /* Player names in VT323 for readability */
        .si-table-player {
          font-family:'VT323',monospace !important; font-size:14px !important;
          color:rgba(220,215,200,.6) !important; letter-spacing:.3px !important;
        }
        .si-table-val {
          font-family:'Press Start 2P',monospace; font-size:7.5px; flex-shrink:0;
        }
        .si-val-w { color:#00C853; text-shadow:0 0 5px rgba(0,200,83,.4); }
        .si-val-l { color:#448AFF; text-shadow:0 0 5px rgba(68,138,255,.35); }
        .si-val-scorer { color:#FFD600; text-shadow:0 0 5px rgba(255,214,0,.35); font-size:6.5px; }
        .si-scorer-right { display:flex; align-items:center; gap:.2rem; flex-shrink:0; }
        .si-achieve { font-size:12px; line-height:1; flex-shrink:0; }
        .si-achieve-4g  { filter:drop-shadow(0 0 4px rgba(255,100,0,.8)); animation:achPulse 1.8s ease-in-out infinite; }
        .si-achieve-hat { filter:drop-shadow(0 0 4px rgba(255,215,0,.6)); }
        .si-achieve-big { filter:drop-shadow(0 0 3px rgba(255,215,0,.4)); }
        @keyframes achPulse { 0%,100%{opacity:1} 50%{opacity:.55} }

        .si-footer {
          display:flex; flex-direction:column; align-items:center; gap:.18rem;
          padding:.45rem .9rem .5rem;
          border-top:1px solid var(--si-border);
          background:rgba(255,255,255,.012);
          text-align:center;
        }
        .si-footer-text {
          font-family:'VT323',monospace; font-size:19px;
          color:rgba(190,184,168,.65); letter-spacing:.4px; font-style:italic;
          white-space:normal; word-break:break-word; text-align:center;
          width:100%;
        }
        .si-footer-label {
          font-family:'Press Start 2P',monospace; font-size:6.5px;
          color:var(--acc); letter-spacing:2px; flex-shrink:0;
          text-shadow:0 0 8px color-mix(in srgb,var(--acc) 45%,transparent);
        }
        
        .si-skel { padding:.7rem .9rem .8rem; }
        .si-skel-cover {
          display:flex; flex-direction:column; align-items:center;
          padding-bottom:.65rem; margin-bottom:.6rem;
          border-bottom:1px solid rgba(255,255,255,.05);
        }
        .si-skel-grid {
          display:grid; grid-template-columns:1fr 1.5fr 1fr;
          gap:.55rem; min-height:210px;
        }
        .si-skel-col { display:flex; flex-direction:column; justify-content:center; }
        .si-skel-hero { border-radius:7px; height:100%; min-height:200px; }
        .si-skel-b {
          background:linear-gradient(90deg,
            rgba(255,255,255,.025),
            rgba(255,255,255,.055),
            rgba(255,255,255,.025)
          );
          background-size:200% 100%;
          animation:shimmer 1.9s infinite;
          border-radius:3px;
        }

        .si-error {
          display:flex; align-items:center; gap:.7rem;
          padding:1.2rem 1rem; font-size:18px;
        }
        .si-err-title {
          font-family:'Press Start 2P',monospace; font-size:8px;
          color:rgba(255,255,255,.28); letter-spacing:1px; margin-bottom:.2rem;
        }
        .si-err-body {
          font-family:'VT323',monospace; font-size:14px; color:var(--si-muted);
        }

        .si-fadein { animation:siFadeIn .35s ease; }
        .si-fading { opacity:.4; transition:opacity .25s; }
        @keyframes siFadeIn {
          from{opacity:0;transform:translateY(3px);}
          to{opacity:1;transform:translateY(0);}
        }

        @media(max-width:920px){
          .si-cols { grid-template-columns:1fr 1fr; grid-template-rows:auto auto; }
          .si-col-center { grid-column:1/3; grid-row:1; }
          .si-col-left   { grid-column:1; grid-row:2; border-right:none; border-top:1px solid var(--si-border); }
          .si-col-right  { grid-column:2; grid-row:2; border-top:1px solid var(--si-border); }
          .si-hero { min-height:230px; }
          .si-skel-grid { grid-template-columns:1fr 1fr; }
          .si-skel-hero { grid-column:1/3; min-height:160px; }
        }
        @media(max-width:560px){
          .si-cols { grid-template-columns:1fr; }
          .si-col-center,.si-col-left,.si-col-right { grid-column:1; grid-row:auto; }
          .si-col-left,.si-col-right { border-top:1px solid var(--si-border); border-left:none; }
          .si-hero { min-height:200px; }
          .si-cover-line { font-size:11px; }
          .si-skel-grid { grid-template-columns:1fr; }
          .si-skel-hero { min-height:130px; }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HOME PAGE
═══════════════════════════════════════════════════════════════ */
export default function Home() {
  const { selectedLeague } = useLeague();
  const cfg = leagueCfg(selectedLeague);

  const [currentSeason, setCurrentSeason] = useState(null);
  const [winStreaks, setWinStreaks] = useState([]);
  const [lossStreaks, setLossStreaks] = useState([]);
  const [recentForm, setRecentForm] = useState({ hot: [], cold: [] });
  const [discordEvents, setDiscordEvents] = useState([]);
  const [recentTrades, setRecentTrades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evtLoading, setEvtLoading] = useState(true);
  const [tickerItems, setTickerItems] = useState([]);
  const [teams, setTeams] = useState([]);
  const [recentGames, setRecentGames] = useState([]);
  const [isPlayoffActive, setIsPlayoffActive] = useState(false);
  const [playoffSeriesData, setPlayoffSeriesData] = useState([]);
  const [gameStats, setGameStats] = useState('');
  const [teamNameMap, setTeamNameMap] = useState({});
  const [topScorers, setTopScorers] = useState([]);
  const [nextSeason, setNextSeason] = useState(null);
  const [newsItems, setNewsItems] = useState([]);
  const [topSeasonScorers, setTopSeasonScorers] = useState([]);
  const [seasonTeams, setSeasonTeams] = useState([]);

  const tick = useLeagueCountdown(currentSeason, nextSeason);
  const beltRef = useRef(null);
  const [beltDuration, setBeltDuration] = useState(30);

  const [championTeam, setChampionTeam] = useState(null);
  const stableSeasonTeams = useMemo(() => seasonTeams, [currentSeason?.lg]);

  useEffect(() => {
    if (!beltRef.current || !newsItems.length) return;
    requestAnimationFrame(() => {
      // Measure just ONE copy — the belt has two copies so half scrollWidth = one copy
      const oneWidth = beltRef.current.scrollWidth / 2;
      const speed = 90;
      setBeltDuration(oneWidth / speed);
    });
  }, [newsItems]);

  // Fetch all teams once for the ticker helper (code → team name)
  useEffect(() => {
    supabase
      .from('teams')
      .select('abr,team')
      .then(({ data }) => {
        if (data) setTeams(data);
      });
  }, []);

  const loadLeagueData = useCallback(async (prefix) => {
    const { data: testData, error: testError } = await supabase
      .from('ticker_news')
      .select('id, text')
      .limit(12);

    if (!prefix) return;
    setLoading(true);
    setCurrentSeason(null);
    setWinStreaks([]);
    setLossStreaks([]);
    setRecentForm({ hot: [], cold: [] });
    setTeamNameMap({});
    setTopScorers([]);
    setRecentGames([]);
    setIsPlayoffActive(false);
    setPlayoffSeriesData([]);
    setGameStats('');
    setChampionTeam(null);

    // ── Seasons ──────────────────────────────────────────────────────────
    const { data: seasons } = await supabase
      .from('seasons')
      .select('*')
      .order('year', { ascending: false })
      .limit(20);
    const ps = (seasons || []).filter((s) => lgPrefix(s.lg) === prefix);
    if (!ps.length) {
      setLoading(false);
      return;
    }
    const STATUS_PRIORITY = { playoffs: 0, season: 1, offseason: 2 };

    const latest = ps.reduce((b, s) => {
      const sPri = STATUS_PRIORITY[s.status] ?? 1;
      const bPri = STATUS_PRIORITY[b.status] ?? 1;
      if (sPri !== bPri) return sPri < bPri ? s : b;
      // Same priority — fall back to most recent end_date
      return new Date(s.end_date) > new Date(b.end_date) ? s : b;
    });
    setCurrentSeason(latest);


    // Resolve champion team abr for offseason display
      let resolvedChampion = null;
      if (latest.status === 'offseason' && latest.season_champion_manager_id) {
        // Champion is on the current (offseason) season row
        const { data: champTeam } = await supabase
          .from('teams')
          .select('abr')
          .eq('manager_id', latest.season_champion_manager_id)
          .eq('lg', latest.lg)
          .single();
        resolvedChampion = champTeam?.abr || null;
      } else if (latest.status === 'playoffs' && latest.season_champion_manager_id) {
        // Champion already crowned during playoffs
        const { data: champTeam } = await supabase
          .from('teams')
          .select('abr')
          .eq('manager_id', latest.season_champion_manager_id)
          .eq('lg', latest.lg)
          .single();
        resolvedChampion = champTeam?.abr || null;
      }
      setChampionTeam(resolvedChampion);

    /* Capture Season for Countdown */
    const futureSeasons = (seasons || [])
      .filter((s) => lgPrefix(s.lg) === prefix && s.lg !== latest.lg)
      .sort((a, b) => new Date(a.end_date) - new Date(b.end_date));
    setNextSeason(futureSeasons[0] || null);

    // ── Teams for this season → build name map (includes coach) ──────────
    // teams table uses `abr` as the team code that matches games.home/away
    const { data: fetchedTeams } = await supabase
      .from('teams')
      .select('abr, team, coach, manager_id')
      .eq('lg', latest.lg);

    const nameMap = {};
    (fetchedTeams || []).forEach((t) => {
      nameMap[t.abr] = parseTeamData(t);
    });
    setTeamNameMap(nameMap);
    setSeasonTeams(fetchedTeams || []);

    // ── Games (season + playoff merged) ──────────────────────────────────
    const [{ data: allGames }, { data: allPlayoffGames }] = await Promise.all([
      supabase
        .from('games')
        .select(
          'id,lg,legacy_game_id,home,away,score_home,score_away,result_home,result_away,ot'
        )
        .eq('lg', latest.lg)
        .order('id', { ascending: false }),
        supabase
        .from('playoff_games')
        .select('id,lg,team_code_a,team_code_b,team_a_score,team_b_score,round,game_number,series_number,series_length,game_date')
        .eq('lg', latest.lg)
        .not('team_a_score', 'is', null)
        .order('id', { ascending: false }),
    ]);

    // Normalize playoff rows to same shape as games rows
    const playoffGamesNorm = (allPlayoffGames || []).map((g) => ({
      id: g.id + 1000000, // offset so they sort above older season games
      lg: g.lg,
      legacy_game_id: g.id + 1000000,
      home: g.team_code_a,
      away: g.team_code_b,
      score_home: g.team_a_score,
      score_away: g.team_b_score,
      result_home: g.team_a_score > g.team_b_score ? 'W' : 'L',
      result_away: g.team_b_score > g.team_a_score ? 'W' : 'L',
      ot: 0,
      _isPlayoff: true,
    }));

    // Merge — playoff games float to top (most recent activity)
    const games = [...playoffGamesNorm, ...(allGames || [])];

    // ── Win/loss streaks ──────────────────────────────────────────────────
    const teamHist = {};
    games.forEach((g) => {
      const hW = ['W', 'OTW'].includes((g.result_home || '').toUpperCase());
      const aW = ['W', 'OTW'].includes((g.result_away || '').toUpperCase());
      if (!teamHist[g.home]) teamHist[g.home] = [];
      if (!teamHist[g.away]) teamHist[g.away] = [];
      teamHist[g.home].push({ win: hW });
      teamHist[g.away].push({ win: aW });
    });
    const wins = [],
      losses = [];
    Object.entries(teamHist).forEach(([team, hist]) => {
      if (!hist.length) return;
      const first = hist[0].win;
      let count = 0;
      for (const h of hist) {
        if (h.win === first) count++;
        else break;
      }
      if (first) wins.push({ team, count });
      else losses.push({ team, count });
    });
    wins.sort((a, b) => b.count - a.count);
    losses.sort((a, b) => b.count - a.count);
    setWinStreaks(wins.slice(0, 5));
    setLossStreaks(losses.slice(0, 5));

    // ── Recent form (last 10) ─────────────────────────────────────────────
    const last10 = {};
    games.forEach((g) => {
      const hW = ['W', 'OTW'].includes((g.result_home || '').toUpperCase());
      const aW = ['W', 'OTW'].includes((g.result_away || '').toUpperCase());
      [
        [g.home, hW],
        [g.away, aW],
      ].forEach(([t, w]) => {
        if (!t) return;
        if (!last10[t]) last10[t] = [];
        if (last10[t].length < 10) last10[t].push(w);
      });
    });
    const form = Object.entries(last10)
      .filter(([, a]) => a.length >= 10)
      .map(([team, arr]) => {
        const w = arr.filter(Boolean).length;
        return { team, w, l: arr.length - w, pct: w / arr.length, last10: arr };
      });
    form.sort((a, b) => b.pct - a.pct);
    setRecentForm({
      hot: form.slice(0, 5),
      cold: [...form].sort((a, b) => a.pct - b.pct).slice(0, 5),
    });
    setLoading(false);

    // ── Recent games for gazette ──────────────────────────────────────────
    // Playoff games are "more recent" by definition once playoffs start.
    // Strategy: if any playoff games exist for this season, use those exclusively.
    // Only fall back to regular-season games when there are zero playoff games.

    const isPlayoffActive = (allPlayoffGames || []).length > 0;

    // ── Top Scorers Panel - Season/Playoff cumulative scorers ─────────────────────────────────────
    const scorerQuery = isPlayoffActive
      ? supabase
          .from('game_raw_scoring')
          .select(
            'goal_player_name, assist_primary_name, assist_secondary_name, g_team, playoff_game_id'
          )
          .not('playoff_game_id', 'is', null)
          .eq('season', latest.lg)
      : supabase
          .from('game_raw_scoring')
          .select(
            'goal_player_name, assist_primary_name, assist_secondary_name, g_team, game_id'
          )
          .is('playoff_game_id', null)
          .eq('season', latest.lg);

    const { data: allScoringData } = await scorerQuery;

    if (allScoringData?.length) {
      const playerTotals = {};

      const ensure = (name, team) => {
        if (!name) return;
        if (!playerTotals[name])
          playerTotals[name] = { name, team, g: 0, a: 0, gp: new Set() };
      };

      allScoringData.forEach((play) => {
        const gameKey = play.playoff_game_id || play.game_id;
        if (play.goal_player_name) {
          ensure(play.goal_player_name, play.g_team);
          playerTotals[play.goal_player_name].g++;
          playerTotals[play.goal_player_name].gp.add(gameKey);
          playerTotals[play.goal_player_name].team = play.g_team;
        }
        if (play.assist_primary_name) {
          ensure(play.assist_primary_name, play.g_team);
          playerTotals[play.assist_primary_name].a++;
          playerTotals[play.assist_primary_name].gp.add(gameKey);
        }
        if (play.assist_secondary_name) {
          ensure(play.assist_secondary_name, play.g_team);
          playerTotals[play.assist_secondary_name].a++;
          playerTotals[play.assist_secondary_name].gp.add(gameKey);
        }
      });

      const sorted = Object.values(playerTotals)
        .map((p) => ({
          name: p.name,
          team: p.team,
          g: p.g,
          a: p.a,
          pts: p.g + p.a,
          gp: p.gp.size,
        }))
        .sort((a, b) => b.pts - a.pts || b.g - a.g)
        .slice(0, 10);

      setTopSeasonScorers(sorted);
    }

    // Recent playoff games (last 5 by id, already fetched above)
    const recentPlayoffNorm = (allPlayoffGames || []).slice(0, 5).map((g) => ({
      home: g.team_code_a,
      away: g.team_code_b,
      score_home: g.team_a_score,
      score_away: g.team_b_score,
      ot: 0,
      _isPlayoff: true,
      round: g.round,
      game_number: g.game_number,
    }));

    // Only pull recent season games when no playoff games exist at all
    let recentSeasonNorm = [];
    if (!isPlayoffActive) {
      const yesterday = new Date(
        Date.now() - 24 * 60 * 60 * 1000
      ).toISOString();
      const { data: recentSeasonData } = await supabase
        .from('games')
        .select('home, away, score_home, score_away, ot')
        .eq('lg', latest.lg)
        .not('score_home', 'is', null)
        .gte('updated_at', yesterday);
      recentSeasonNorm = recentSeasonData || [];
    }

    setRecentGames([...recentPlayoffNorm, ...recentSeasonNorm]);
    setIsPlayoffActive(isPlayoffActive);

    // ── Compute series standings for gazette ──────────────────────────────
    const seriesMap = {};
    (allPlayoffGames || []).forEach((g) => {
      const key = `${g.round}-${g.series_number}`;
      if (!seriesMap[key]) {
        seriesMap[key] = {
          round: g.round,
          series_number: g.series_number,
          team_code_a: g.team_code_a,
          team_code_b: g.team_code_b,
          series_length: g.series_length ?? 7,
          wins_a: 0,
          wins_b: 0,
        };
      }
      if ((g.team_a_score ?? 0) > (g.team_b_score ?? 0))
        seriesMap[key].wins_a++;
      else seriesMap[key].wins_b++;
    });
    const computedSeriesData = Object.values(seriesMap).sort(
      (a, b) => b.round - a.round || a.series_number - b.series_number
    );
    setPlayoffSeriesData(computedSeriesData);

    // ── Top scorers — playoff takes priority over regular season ──────────────
    // Use playoff_game_id from recentPlayoffNorm; only use season IDs as fallback.
    // Use most recently played series only
      const maxDate = (allPlayoffGames || []).reduce((best, g) => 
      (g.game_date ?? '') > best ? (g.game_date ?? '') : best, '');
      const mostRecentGame = (allPlayoffGames || []).find((g) => g.game_date === maxDate);
      const recentSeriesGames = (allPlayoffGames || []).filter(
      (g) => g.round === mostRecentGame?.round && 
            g.series_number === mostRecentGame?.series_number
      );
    const recentPlayoffIds = recentSeriesGames.slice(0, 5).map((g) => g.id);
    const recentSeasonIds = isPlayoffActive
      ? [] // suppress season scoring when playoffs are active
      : (allGames || []).slice(0, 5).map((g) => g.id);

    const scoringQueries = [];
    if (recentPlayoffIds.length > 0) {
      scoringQueries.push(
        supabase
          .from('game_raw_scoring')
          .select(
            'game_id, playoff_game_id, goal_player_name, assist_primary_name, assist_secondary_name, g_team'
          )
          .in('playoff_game_id', recentPlayoffIds)
      );
    }
    if (recentSeasonIds.length > 0) {
      scoringQueries.push(
        supabase
          .from('game_raw_scoring')
          .select(
            'game_id, playoff_game_id, goal_player_name, assist_primary_name, assist_secondary_name, g_team'
          )
          .in('game_id', recentSeasonIds)
          .is('playoff_game_id', null)
      );
    }

    const scoringResults = await Promise.all(scoringQueries);
    // Playoff scoring takes priority — put it first
    const scoringData = scoringResults.flatMap((r) => r.data || []);

    // ── Fetch game stats for the gazette prompt ───────────────────────────
    let gameStatsLines = '';
    if (recentPlayoffIds.length > 0) {
      const { data: statsData } = await supabase
        .from('game_stats_team')
        .select('*')
        .in('playoff_game_id', recentPlayoffIds);

      if (statsData?.length) {
        gameStatsLines = statsData
          .map((s) => {
            const hName = nameMap[s.home]?.full || s.home;
            const aName = nameMap[s.away]?.full || s.away;
            const homeSaves = (s.away_shots || 0) - (s.away_score || 0);
            const awaySaves = (s.home_shots || 0) - (s.home_score || 0);
            const foTotal = (s.home_fow || 0) + (s.away_fow || 0) || 1;
            const homeFoPct = (((s.home_fow || 0) / foTotal) * 100).toFixed(0);
            const awayFoPct = (((s.away_fow || 0) / foTotal) * 100).toFixed(0);
            return [
              `GAME: ${hName} ${s.home_score}-${s.away_score} ${aName}`,
              `  Shots: ${hName} ${s.home_shots} | ${aName} ${s.away_shots}`,
              `  Saves: ${hName} goalie ${homeSaves} saves | ${aName} goalie ${awaySaves} saves`,
              `  Checks: ${hName} ${s.home_chk || 0} | ${aName} ${
                s.away_chk || 0
              }`,
              `  Faceoffs: ${hName} ${
                s.home_fow || 0
              } won (${homeFoPct}%) | ${aName} ${
                s.away_fow || 0
              } won (${awayFoPct}%)`,
              `  Power play: ${hName} ${s.home_pp_g || 0}/${
                s.home_pp_amt || 0
              } | ${aName} ${s.away_pp_g || 0}/${s.away_pp_amt || 0}`,
              `  Breakaways: ${hName} ${s.home_break_goals || 0}/${
                s.home_break_attempts || 0
              } | ${aName} ${s.away_break_goals || 0}/${
                s.away_break_attempts || 0
              }`,
            ].join('\n');
          })
          .join('\n\n');
      }
    }
    setGameStats(gameStatsLines);

    if (scoringData.length > 0) {
      const playerMap = {};

      const ensurePlayer = (name, team, gameKey) => {
        if (!name) return;
        if (!playerMap[name])
          playerMap[name] = {
            goal_player_name: name,
            g_team: team,
            totalGoals: 0,
            totalAssists: 0,
            gameBreakdown: {},
          };
        if (!playerMap[name].gameBreakdown[gameKey])
          playerMap[name].gameBreakdown[gameKey] = { g: 0, a: 0 };
      };

      scoringData.forEach((play) => {
        // Use playoff_game_id if present, otherwise game_id as the unique game key
        const gameKey = play.playoff_game_id
          ? `po-${play.playoff_game_id}`
          : `s-${play.game_id}`;

        if (play.goal_player_name) {
          ensurePlayer(play.goal_player_name, play.g_team, gameKey);
          playerMap[play.goal_player_name].totalGoals++;
          playerMap[play.goal_player_name].gameBreakdown[gameKey].g++;
          playerMap[play.goal_player_name].g_team = play.g_team;
        }
        if (play.assist_primary_name) {
          ensurePlayer(play.assist_primary_name, play.g_team, gameKey);
          playerMap[play.assist_primary_name].totalAssists++;
          playerMap[play.assist_primary_name].gameBreakdown[gameKey].a++;
        }
        if (play.assist_secondary_name) {
          ensurePlayer(play.assist_secondary_name, play.g_team, gameKey);
          playerMap[play.assist_secondary_name].totalAssists++;
          playerMap[play.assist_secondary_name].gameBreakdown[gameKey].a++;
        }
      });

      const scorerList = Object.values(playerMap)
        .filter((p) => p.totalGoals > 0 || p.totalAssists > 0)
        .map((p) => {
          const points = p.totalGoals + p.totalAssists;
          const hatTrick = Object.values(p.gameBreakdown).some(
            (gb) => gb.g >= 3
          );
          const bigNight = points >= 5;
          const fourGoalGame = Object.values(p.gameBreakdown).some(
            (gb) => gb.g >= 4
          );
          const bestGame = Object.values(p.gameBreakdown).reduce(
            (best, gb) => (gb.g + gb.a > best.g + best.a ? gb : best),
            { g: 0, a: 0 }
          );
          return {
            goal_player_name: p.goal_player_name,
            g_team: p.g_team,
            goals: p.totalGoals,
            assists: p.totalAssists,
            points,
            hatTrick,
            fourGoalGame,
            bigNight,
            bestGame,
          };
        })
        .sort((a, b) => {
          const aScore =
            (a.fourGoalGame ? 100 : 0) +
            (a.hatTrick ? 50 : 0) +
            (a.bigNight ? 20 : 0) +
            a.points;
          const bScore =
            (b.fourGoalGame ? 100 : 0) +
            (b.hatTrick ? 50 : 0) +
            (b.bigNight ? 20 : 0) +
            b.points;
          return bScore - aScore;
        });

      setTopScorers(scorerList.slice(0, 8));
    }

    // ── Ticker items ──────────────────────────────────────────────────────────
    // DROP THIS IN: replaces the existing "// ── Ticker items ──" block
    // inside loadLeagueData, right after setTickerItems([]) in the reset block
    // and before the closing brace of loadLeagueData.
    // Nothing else in Home.jsx changes.

    setTickerItems([]);

    // ── Fetch ticker news ─────────────────────────────────────────────────────
    const tickerRes = await fetch(
      'https://gwaiwtgwdqadxmimiskf.supabase.co/rest/v1/ticker_news?select=text&order=created_at.desc&limit=8',
      {
        headers: {
          apikey:
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YWl3dGd3ZHFhZHhtaW1pc2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTIyMTksImV4cCI6MjA4NjY2ODIxOX0.VH-QhNSFcpNQv3VLi2Zb8riSbF2hIbjVgwBkHLuJqTo',
          Authorization:
            'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3YWl3dGd3ZHFhZHhtaW1pc2tmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwOTIyMTksImV4cCI6MjA4NjY2ODIxOX0.VH-QhNSFcpNQv3VLi2Zb8riSbF2hIbjVgwBkHLuJqTo',
        },
      }
    );
    const tickerJson = await tickerRes.json();
    if (tickerJson?.length) setNewsItems(tickerJson.map((r) => r.text));
  }, []);

  useEffect(() => {
    loadLeagueData(selectedLeague);
  }, [selectedLeague, loadLeagueData]);

  useEffect(() => {
    const refresh = async () => {
      setEvtLoading(true);
      const result = await supabase.functions.invoke('discord-events');
      if (!result.error && Array.isArray(result.data))
        setDiscordEvents(result.data.slice(0, 6));
      else if (result.error)
        console.warn('[discord-events]', result.error.message);
      setEvtLoading(false);
      supabase.functions.invoke('hyper-endpoint').catch(console.error);
    };
    refresh();
    const id = setInterval(refresh, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  /* Discord Confirmed Trades channel tracker*/
  useEffect(() => {
    const refresh = async () => {
      // Check cache first
      try {
        const cached = JSON.parse(
          localStorage.getItem('discord_trades_cache') || '{}'
        );
        if (cached.data && Date.now() - cached.ts < 15 * 60 * 1000) {
          setRecentTrades(cached.data);
          // still fetch events separately or cache those too
        } else {
          const tradesResult = await supabase.functions.invoke(
            'discord-trade-tracker'
          );
          if (!tradesResult.error && Array.isArray(tradesResult.data)) {
            const data = tradesResult.data.slice(0, 5);
            setRecentTrades(data);
            localStorage.setItem(
              'discord_trades_cache',
              JSON.stringify({ data, ts: Date.now() })
            );
          }
        }
      } catch {
        const tradesResult = await supabase.functions.invoke(
          'discord-trade-tracker'
        );
        if (!tradesResult.error && Array.isArray(tradesResult.data))
          setRecentTrades(tradesResult.data.slice(0, 5));
      }

      setEvtLoading(true);
      const eventsResult = await supabase.functions.invoke('discord-events');
      if (!eventsResult.error && Array.isArray(eventsResult.data))
        setDiscordEvents(eventsResult.data.slice(0, 6));
      else if (eventsResult.error)
        console.warn('[discord-events]', eventsResult.error.message);
      setEvtLoading(false);
      supabase.functions.invoke('hyper-endpoint').catch(console.error);
    };
    refresh();
    const id = setInterval(refresh, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const fmtTime = (iso) =>
    iso
      ? new Date(iso).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
      : '';
  const displayItems = newsItems.length > 0 ? newsItems : [''];

  return (
    <div className="hp">
      <div className="scanlines" aria-hidden />

      <div className="cg">
        {/* ── LEFT COLUMN ── */}
        <div className="cg-a">
          <InlineCountdown cfg={cfg} tick={tick} />
          <Spotlight
            recentForm={recentForm}
            winStreaks={winStreaks}
            lossStreaks={lossStreaks}
            loading={loading}
            topSeasonScorers={topSeasonScorers}
            isPlayoffActive={isPlayoffActive}
          />
         {/* ======== UNCOMMENTING THIS WILL DISPLAY TRANSACTIONS PANEL ==================== 
            <section className="panel">
            <PanelHeader icon="🔄" title="TRANSACTIONS" />

            <div className="tx-body">
              {recentTrades.length === 0 ? (
                <div className="tx-ph">
                  <span style={{ fontSize: 18, opacity: 0.2 }}>📋</span>
                  <span className="tx-ph-msg">NO RECENT TRANSACTIONS</span>
                </div>
              ) : (
                recentTrades.slice(0, 5).map((t, i) => (
                  <div key={i} className="tx-row tx-row-tip">
                    <span className="tx-player">{t.text}</span>
                    <div className="tx-tooltip">{t.text}</div>
                  </div>
                ))
              )}
            </div>
                </section> { */ }
        </div>

        {/* ── CENTER COLUMN — GAZETTE ── */}
        <div className="cg-b">
          <LeagueGazette
            leagueLabel={cfg.label}
            recentForm={recentForm}
            winStreaks={winStreaks}
            lossStreaks={lossStreaks}
            currentSeason={currentSeason}
            loading={loading}
            teamNameMap={teamNameMap}
            topScorers={topScorers}
            recentGames={recentGames}
            isPlayoffActive={isPlayoffActive}
            playoffSeriesData={playoffSeriesData}
            gameStats={gameStats}
            teams={stableSeasonTeams}
            championTeam={championTeam}
          />
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="cg-c">
          <div className="media-cluster">
            <section className="panel twg-panel">
              <TwitchLiveWidget />
            </section>
            <section className="panel">
              <PanelHeader
                icon={
                  <svg
                    style={{
                      width: 12,
                      height: 12,
                      color: '#5865F2',
                      verticalAlign: 'middle',
                      flexShrink: 0,
                    }}
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.62.874-1.395 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.1.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
                  </svg>
                }
                title="UPCOMING EVENTS"
                action={
                  <a
                    href="https://discord.gg/QxRDBgz3"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="discord-join"
                  >
                    JOIN →
                  </a>
                }
              />
              <div className="events">
                {evtLoading ? (
                  [1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="skel"
                      style={{ height: 52, margin: '.2rem .72rem' }}
                    />
                  ))
                ) : discordEvents.length === 0 ? (
                  <div className="panel-empty ev-cta">
                    <p>🎮 No upcoming events.</p>
                    <p className="ev-setup">
                      Deploy <code>discord-events</code> edge fn.
                    </p>
                  </div>
                ) : (
                  discordEvents.map((ev) => {
                    const du = daysUntil(ev.startTime);
                    const isToday = du === 'TODAY',
                      isTmrw = du === 'TMRW';
                    return (
                      <a
                        key={ev.id}
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ev-row"
                      >
                        <div className="ev-cal">
                          <span className="ev-mon">
                            {new Date(ev.startTime).toLocaleDateString(
                              'en-US',
                              { month: 'short' }
                            )}
                          </span>
                          <span className="ev-day">
                            {new Date(ev.startTime).getDate()}
                          </span>
                        </div>
                        <div className="ev-info">
                          <span className="ev-name">{ev.name}</span>
                          <span className="ev-time">
                            {fmtTime(ev.startTime)}
                          </span>
                        </div>
                        <div className="ev-right">
                          {ev.status === 2 ? (
                            <span className="ev-live">● LIVE</span>
                          ) : du ? (
                            <span
                              className={`ev-du${
                                isToday ? ' ev-today' : isTmrw ? ' ev-tmrw' : ''
                              }`}
                            >
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
          </div>
        </div>
      </div>

      {/* HDTV TICKER */}
      <div className="hdtv-ticker">
        <div className="ht-brand">
          <div className="ht-brand-top">{cfg.label}</div>
          <div className="ht-brand-bottom">
            <span className="ht-live-dot" />
            <span>LIVE</span>
          </div>
        </div>
        <div className="ht-stage">
          <div className="ht-fade-l" />
          <div className="ht-fade-r" />
          <div className="ht-rail">
            <div
              className="ht-belt"
              ref={beltRef}
              style={{
                animationDuration: `${beltDuration}s`,
                '--belt-w': `${
                  beltRef.current ? beltRef.current.scrollWidth / 2 : 0
                }px`,
              }}
            >
              {displayItems.concat(displayItems).map((item, i) => (
                <span key={i} className="ht-story">
                  <span className={`ht-text ht-c${i % 4}`}>{item}</span>
                  <span className="ht-sep">
                    <span className="ht-sep-line" />
                    <span className="ht-sep-gem">◆</span>
                    <span className="ht-sep-line" />
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="ht-clock">
          <ClockDisplay />
        </div>
      </div>

      <style>{`
       *,*::before,*::after { box-sizing:border-box; max-width:100%; }
        html,body{background:#00000a!important;}

        .hp {
          min-height:100vh;
          background:radial-gradient(ellipse 120% 40% at 50% -5%,#0f0f28 0%,transparent 60%),#00000a;
          padding-bottom:56px;
          overflow-x:hidden;
          position:relative;
          max-width: 100vw;
        }
        .scanlines{position:fixed;inset:0;pointer-events:none;z-index:9997;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.055) 2px,rgba(0,0,0,.055) 4px);}

        .cg {
          display: grid;
          grid-template-columns: 270px 1fr 360px;
          grid-template-areas: "a b c";
          gap: .75rem;
          padding: .75rem 14px;
          max-width: 100%;
          margin: 0 auto;
          align-items: start;
        }
        .cg-a { grid-area:a; display:flex; flex-direction:column; gap:.72rem; }
        .cg-b { grid-area:b; min-width:0; }
        .cg-c { grid-area:c; display:flex; flex-direction:column; align-self:start; }

        /* ── Countdown ── */
        .icd {
          display: flex;
          flex-direction: column;  /* ← stack vertically */
          align-items: flex-start;
          gap: .3rem;
          padding: .58rem .82rem;
          background: color-mix(in srgb, var(--ic) 8%, rgba(0,0,0,.65));
          border: 1.5px solid color-mix(in srgb, var(--ic) 32%, transparent);
          border-radius: 10px;
          position: relative;
          overflow: hidden;
        }
        .icd::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 65% 100% at 0% 50%,color-mix(in srgb,var(--ic) 12%,transparent),transparent 70%);}
        .icd-left {
          display: flex;
          flex-direction: column;
          gap: .2rem;
          min-width: 0;
          width: 100%;  /* ← full width now */
        }
        .icd-eyebrow{font-family:'Press Start 2P',monospace;font-size:9px;color:rgba(255,140,0,.5);letter-spacing:2px;}
        .icd-meta{display:flex;align-items:center;gap:.38rem;}
        .icd-dot{width:6px;height:6px;border-radius:50%;background:var(--ic);box-shadow:0 0 5px var(--ic);animation:icPulse 2s ease-in-out infinite;flex-shrink:0;}
        @keyframes icPulse{0%,100%{opacity:1}50%{opacity:.35}}
        .icd-league{font-family:'Press Start 2P',monospace;font-size: 10px;color:var(--ic);letter-spacing:2px;}
        .icd-season{font-family:'VT323',monospace;font-size:17px;color:color-mix(in srgb,var(--ic) 55%,rgba(255,255,255,.25));}
        .icd-right {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          width: 100%;  /* ← full width */
        }
        .icd-awaiting{font-family:'Press Start 2P',monospace;font-size:10px;color:rgba(255,255,255,.2);letter-spacing:1px;}
        .icd-complete{display:flex;align-items:center;gap:.3rem;}
        .icd-done-txt{font-family:'Press Start 2P',monospace;font-size:10px;color:color-mix(in srgb,var(--ic) 70%,rgba(255,255,255,.3));letter-spacing:1px;}
        .icd-clock {
          display: flex;
          align-items: center;
          gap: .25rem;
          width: 100%;
          justify-content: space-between;  /* ← spread units across full width */
        }
        .icd-unit {
          flex: 1;  /* ← each unit takes equal space */
          display: flex;
          flex-direction: column;
          align-items: center;
          background: rgba(0,0,0,.6);
          border: 1px solid color-mix(in srgb, var(--ic) 22%, transparent);
          border-radius: 5px;
          padding: .2rem .22rem;
        }
        .icd-n {
          font-family: 'VT323', monospace;
          font-size: 26px;
          line-height: 1;
          color: var(--ic);
          text-shadow: 0 0 11px color-mix(in srgb, var(--ic) 65%, transparent);
        }
        .icd-u{font-family:'Press Start 2P',monospace;font-size:8px;color:rgba(255,255,255,.22);letter-spacing:2px;margin-top:1px;}

        /* ── Panels ── */
        .panel{border:1.5px solid rgba(135,206,235,.1);border-radius:10px;overflow:hidden;background:linear-gradient(155deg,rgba(255,255,255,.02) 0%,rgba(0,0,0,.3) 100%);}
        .ph{display:flex;align-items:center;gap:.38rem;padding:.48rem .82rem;background:linear-gradient(90deg,rgba(255,140,0,.07) 0%,transparent 100%);border-bottom:1px solid rgba(255,140,0,.1);flex-wrap:wrap;}
        .ph-icon{font-size:13px;flex-shrink:0;}
        .ph-title{flex:1;font-family:'Press Start 2P',monospace;font-size:11px;color:#FF8C00;letter-spacing:2px;text-shadow:0 0 6px rgba(255,140,0,.3);}
        .ph-action{flex-shrink:0;}
        .discord-join{font-family:'Press Start 2P',monospace;font-size:9px;color:#5865F2;text-decoration:none;letter-spacing:1px;border:1px solid rgba(88,101,242,.3);border-radius:4px;padding:.2rem .42rem;background:rgba(88,101,242,.07);transition:all .15s;white-space:nowrap;}
        .discord-join:hover{color:#7289DA;border-color:rgba(88,101,242,.55);}
        .panel-empty{padding:.82rem;font-family:'VT323',monospace;font-size:17px;color:rgba(255,255,255,.2);text-align:center;letter-spacing:2px;}
        .skel{background:linear-gradient(90deg,rgba(255,255,255,.03),rgba(255,255,255,.07),rgba(255,255,255,.03));background-size:200% 100%;animation:shimmer 1.6s infinite;border-radius:4px;}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}

        /* ── Spotlight ── */
        .sl-panel{overflow:visible;}
        .sl-tabs{display:flex;border-bottom:1px solid rgba(255,140,0,.1);background:rgba(0,0,0,.25);}
        .sl-tab{flex:1;padding:.35rem .15rem;font-size:14px;background:transparent;border:none;border-right:1px solid rgba(255,255,255,.04);cursor:pointer;transition:all .14s;color:rgba(255,255,255,.3);line-height:1;}
        .sl-tab:last-child{border-right:none;}
        .sl-tab:hover{background:rgba(255,140,0,.07);filter:brightness(1.4);}
        .sl-tab-on{background:rgba(255,140,0,.1)!important;border-bottom:2px solid #FF8C00!important;filter:brightness(1.6)!important;}
        .sl-titlebar{display:flex;flex-direction:column;gap:.07rem;padding:.38rem .68rem .3rem;background:linear-gradient(90deg,rgba(255,140,0,.06) 0%,transparent 100%);border-bottom:1px solid rgba(255,255,255,.04);}
        .sl-title{font-family:'Press Start 2P',monospace;font-size:10px;color:#FF8C00;letter-spacing:1.5px;text-shadow:0 0 8px rgba(255,140,0,.3);}
        .sl-sub{font-family:'VT323',monospace;font-size:14px;color:rgba(255,255,255,.22);letter-spacing:.5px;}
        .sl-body{padding:.18rem 0 .06rem;min-height:115px;}
        .sl-prog-wrap{height:3px;background:rgba(255,255,255,.05);overflow:hidden;}
        .sl-prog{height:100%;background:linear-gradient(90deg,#FF8C00,#FFD700);animation:slp 8s linear forwards;}
        @keyframes slp{from{width:0%}to{width:100%}}
        .sl-row{display:flex;align-items:center;gap:.3rem;padding:.2rem .62rem;border-bottom:1px solid rgba(255,255,255,.04);transition:background .1s;}
        .sl-row:last-child{border-bottom:none;}
        .sl-row:hover{background:rgba(255,140,0,.04);}
        .sl-rank{font-family:'Press Start 2P',monospace;font-size:9px;color:rgba(255,255,255,.2);min-width:16px;flex-shrink:0;}
        .sl-logo{width:20px;height:20px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 0 3px rgba(255,255,255,.15));}
        .sl-team{font-family:'Press Start 2P',monospace;font-size:9px;color:rgba(255,255,255,.55);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        .sl-dots{display:flex;gap:2px;flex:1;align-items:center;flex-wrap:wrap;}
        .sl-dot{width:5px;height:5px;border-radius:2px;flex-shrink:0;}
        .sl-dot-w{background:#00CC55;box-shadow:0 0 3px rgba(0,204,85,.5);}
        .sl-dot-l{background:#4477CC;box-shadow:0 0 3px rgba(68,119,204,.4);}
        .sl-dots-more{font-family:'VT323',monospace;font-size:14px;color:rgba(255,255,255,.3);margin-left:1px;}
        .sl-val{font-family:'Press Start 2P',monospace;font-size:10px;flex-shrink:0;min-width:26px;text-align:right;}
        .sl-val-hot{color:#00CC55;text-shadow:0 0 7px rgba(0,204,85,.4);}
        .sl-val-cold{color:#6B9FFF;text-shadow:0 0 7px rgba(107,159,255,.35);}
        .sl-empty{font-family:'VT323',monospace;font-size:17px;color:rgba(255,255,255,.2);text-align:center;padding:1.2rem;letter-spacing:1px;}
        .sl-bar-wrap{flex:1;height:4px;background:rgba(255,255,255,.05);border-radius:3px;overflow:hidden;}
        .sl-bar{height:100%;background:linear-gradient(90deg,rgba(255,140,0,.3),rgba(255,215,0,.2));border-radius:3px;}
        .sl-coming{font-family:'Press Start 2P',monospace;font-size:8px;color:rgba(255,255,255,.13);letter-spacing:1px;text-align:center;padding:.4rem;}

        .sl-scorer-stats { display:flex; gap:0; align-items:center; margin-left:auto; }
.sl-scorer-stat { 
  font-family:'VT323',monospace; font-size:16px; color:rgba(255,255,255,.7);
  display:flex; flex-direction:column; align-items:center; width:28px;
  flex-shrink:0;
}
        .sl-scorer-label { font-family:'Press Start 2P',monospace; font-size:6px; color:rgba(255,255,255,.25); letter-spacing:1px; }
        .sl-pts { color:#FFD700 !important; text-shadow:0 0 8px rgba(255,215,0,.4); }

        /* ── Transactions ── */
        .tx-body{padding:.12rem 0;}
        .tx-ph{display:flex;flex-direction:column;align-items:center;gap:.28rem;padding:.62rem .8rem;}
        .tx-ph-msg{font-family:'Press Start 2P',monospace;font-size:9px;color:rgba(255,255,255,.14);letter-spacing:1px;text-align:center;}
        .tx-row{display:flex;align-items:center;gap:.28rem;padding:.22rem .66rem;border-bottom:1px solid rgba(255,255,255,.03);}
        .tx-row:last-child{border-bottom:none;}
        .tx-teams{display:flex;align-items:center;gap:.14rem;}
        .tx-team{font-family:'Press Start 2P',monospace;font-size:9px;color:#87CEEB;}
        .tx-arr{color:#FF8C00;font-size:15px;}
        .tx-player{flex:1;font-family:'VT323',monospace;font-size:16px;color:#E0E0E0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .tx-date{font-family:'VT323',monospace;font-size:14px;color:rgba(255,255,255,.2);flex-shrink:0;}

        /* ── Right cluster ── */
        .media-cluster{display:flex;flex-direction:column;gap:0;border:1.5px solid rgba(88,101,242,.18);border-radius:10px;overflow:hidden;}
        .media-cluster>.panel{border:none;border-radius:0;border-bottom:1px solid rgba(88,101,242,.12);}
        .media-cluster>.panel:last-child{border-bottom:none;}
        .media-cluster>.twg-panel{border-bottom:1px solid rgba(0,255,100,.1);}
        .events{padding:.04rem 0;}
        .ev-row{display:flex;align-items:flex-start;gap:.48rem;padding:.38rem .72rem;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.03);transition:background .12s;}
        .ev-row:last-child{border-bottom:none;}
        .ev-row:hover{background:rgba(88,101,242,.07);}
        .ev-cal{display:flex;flex-direction:column;align-items:center;background:rgba(88,101,242,.1);border:1px solid rgba(88,101,242,.25);border-radius:5px;padding:.16rem .36rem;min-width:33px;flex-shrink:0;margin-top:2px;}
        .ev-mon{font-family:'Press Start 2P',monospace;font-size:8px;color:#7289DA;text-transform:uppercase;}
        .ev-day{font-family:'VT323',monospace;font-size:25px;color:#fff;line-height:1;}
        .ev-info{flex:1;display:flex;flex-direction:column;gap:.08rem;min-width:0;}
        .ev-name{font-family:'Press Start 2P',monospace;font-size:9px;color:#E0E0E0;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
        .ev-time{font-family:'VT323',monospace;font-size:15px;color:rgba(135,206,235,.5);margin-top:.04rem;}
        .ev-right{display:flex;flex-direction:column;align-items:flex-end;gap:.14rem;flex-shrink:0;padding-top:2px;}
        .ev-live{font-family:'Press Start 2P',monospace;font-size:8px;background:rgba(0,255,100,.12);border:1px solid rgba(0,255,100,.38);color:#00FF64;padding:.1rem .28rem;border-radius:3px;animation:blink 1.4s ease-in-out infinite;}
        .ev-du{font-family:'Press Start 2P',monospace;font-size:9px;color:rgba(255,255,255,.28);letter-spacing:1px;}
        .ev-today{color:#00FF64;text-shadow:0 0 8px rgba(0,255,100,.4);animation:blink 1.4s ease-in-out infinite;}
        .ev-tmrw{color:#FFD700;}
        .ev-cta{text-align:left!important;padding:.8rem!important;}
        .ev-cta p{margin:0 0 .22rem;font-size:15px!important;}
        .ev-setup{font-size:13px!important;color:rgba(255,255,255,.15)!important;}
        .ev-setup code{background:rgba(255,255,255,.07);padding:.05rem .18rem;border-radius:3px;}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.45}}

        /* ── HDTV Ticker ── */
        .hdtv-ticker {
          position:fixed; bottom:0; left:0; right:0; height:48px;
          display:flex; align-items:stretch; z-index:200;
          background:#060a16;
          border-top:3px solid #D95E00;
          box-shadow:0 -1px 0 rgba(255,185,70,0.6),0 -2px 0 rgba(0,0,0,0.9),0 -10px 40px rgba(200,75,0,0.22),inset 0 1px 0 rgba(255,140,50,0.1);
          overflow:hidden;
          font-family:'Helvetica Neue','Arial',sans-serif;
        }
        .ht-brand {
          flex-shrink:0; width:96px;
          display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px;
          background:linear-gradient(150deg,#B50000 0%,#6E0000 100%);
          border-right:2px solid rgba(0,0,0,0.5);
          position:relative; overflow:hidden;
        }
        .ht-brand::before { content:''; position:absolute; top:0; left:0; right:60%; bottom:40%; background:linear-gradient(135deg,rgba(255,255,255,0.12),transparent); pointer-events:none; }
        .ht-brand::after  { content:''; position:absolute; top:0; right:0; bottom:0; width:8px; background:linear-gradient(-90deg,rgba(0,0,0,0.35),transparent); pointer-events:none; }
        .ht-brand-top { font-family:'Press Start 2P',monospace; font-size:9.5px; font-weight:700; color:#fff; letter-spacing:1px; text-shadow:0 1px 4px rgba(0,0,0,0.9); position:relative; z-index:1; line-height:1; }
        .ht-brand-bottom { display:flex; align-items:center; gap:5px; font-size:8.5px; font-weight:800; color:rgba(255,255,255,0.55); letter-spacing:3.5px; text-transform:uppercase; line-height:1; position:relative; z-index:1; }
        .ht-live-dot { width:5px; height:5px; border-radius:50%; background:#00FF88; box-shadow:0 0 8px #00FF88,0 0 2px #00FF88; flex-shrink:0; animation:livePulse 2s ease-in-out infinite; }
        @keyframes livePulse { 0%,100%{opacity:1;box-shadow:0 0 8px #00FF88,0 0 2px #00FF88} 50%{opacity:0.35;box-shadow:0 0 2px #00FF88} }
        .ht-stage { flex:1; position:relative; overflow:hidden; border-top:1px solid rgba(255,255,255,0.04); background:repeating-linear-gradient(90deg,transparent 0,transparent 149px,rgba(255,255,255,0.018) 149px,rgba(255,255,255,0.018) 150px); }
        .ht-fade-l,.ht-fade-r { position:absolute; top:0; bottom:0; z-index:2; pointer-events:none; width:52px; }
        .ht-fade-l { left:0; background:linear-gradient(90deg,#060a16 20%,transparent); }
        .ht-fade-r { right:0; background:linear-gradient(-90deg,#060a16 20%,transparent); }
        .ht-rail { width:100%; overflow:hidden; max-width:none !important; }
        .ht-belt {
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          flex-shrink: 0;
          max-width: none !important;
          animation: beltRoll linear infinite;
          will-change: transform;
        }
        .ht-story, .ht-text, .ht-sep { max-width: none !important; }
        @keyframes beltRoll {
          from { transform: translateX(0); }
          to { transform: translateX(calc(var(--belt-w) * -1)); }
        }
        .ht-story { display:inline-flex; align-items:center; }
        .ht-text { font-size:14.5px; font-weight:600; letter-spacing:0.07em; text-transform:uppercase; line-height:1; padding:0 0.5rem; }
        .ht-c0{color:#EEF3FF;}
        .ht-c1{color:#FFD166;text-shadow:0 0 12px rgba(255,200,80,0.25);}
        .ht-c2{color:#87CEEB;text-shadow:0 0 12px rgba(135,206,235,0.2);}
        .ht-c3{color:rgba(220,230,255,0.65);}
        .ht-sep { display:inline-flex; align-items:center; gap:5px; margin:0 0.5rem; flex-shrink:0; }
        .ht-sep-line { display:inline-block; width:20px; height:1px; background:rgba(210,95,0,0.55); flex-shrink:0; }
        .ht-sep-gem { font-size:7px; color:#D95E00; text-shadow:0 0 10px rgba(217,94,0,0.9); flex-shrink:0; line-height:1; }
        .ht-clock { flex-shrink:0; width:80px; display:flex; align-items:center; justify-content:center; border-left:1.5px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.022); position:relative; }
        .ht-clock::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,rgba(217,94,0,0.5),transparent); }
        .ht-clock-inner { display:flex; flex-direction:column; align-items:center; gap:2px; }
        .ht-clock-time { font-size:15px; font-weight:700; color:#ECF1FF; letter-spacing:1.5px; font-variant-numeric:tabular-nums; line-height:1; }
        .ht-clock-label { font-size:8px; font-weight:700; color:rgba(255,255,255,0.28); letter-spacing:3px; line-height:1; }


        .tx-row-tip { position: relative; }
.tx-tooltip {
  display: none;
  position: absolute;
  bottom: 100%; left: 0;
  background: #0d0d1e;
  border: 1px solid rgba(135,206,235,.2);
  border-radius: 6px;
  padding: .4rem .6rem;
  font-family: 'VT323', monospace;
  font-size: 14px;
  color: rgba(255,255,255,.8);
  white-space: normal;
  width: 260px;
  z-index: 100;
  pointer-events: none;
}
.tx-row-tip:hover .tx-tooltip { display: block; }
        /* ── Responsive ── */
        @media(max-width:1200px){
          .cg { grid-template-columns: 340px 1fr; grid-template-areas: "a b"; }
          .cg-c { display: none; }
        }
        @media(max-width:820px){
          .cg { grid-template-columns: 1fr; grid-template-areas: "a" "b"; }
        }
        @media(max-width:600px){
          .cg { padding: .6rem 8px; gap: .6rem; }
          .ht-brand { width:72px; } .ht-brand-top { font-size:8px; }
          .ht-clock { width:62px; } .ht-clock-time { font-size:13px; }
          .ht-text { font-size:13px; }
        }
        
        /* ── Mobile hard clamp — prevents any child from forcing horizontal scroll */
        @media(max-width:480px){
          .hp { overflow-x:hidden; }
          .cg { 
            grid-template-columns: 1fr; 
            grid-template-areas: "a" "b";
            padding: .5rem 6px; 
            gap: .5rem;
            width: 100%;
            max-width: 100vw;
          }
          .cg-a, .cg-b { min-width: 0; max-width: 100%; }
          .hdtv-ticker { 
            height: 40px;
          }
          .ht-brand { width: 60px; }
          .ht-brand-top { font-size: 7px; letter-spacing: 0; }
          .ht-brand-bottom { font-size: 7px; letter-spacing: 2px; }
          .ht-clock { width: 56px; }
          .ht-clock-time { font-size: 12px; }
          .ht-text { font-size:11px; letter-spacing:0.04em; }
          .ht-sep { margin:0 0.25rem; }
          .ht-sep-line { width:12px; }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DROP-IN REPLACEMENT for Home.jsx
   Replace everything from:
     const GAZETTE_CACHE_KEY = ...
   through the closing } of LeagueGazette

   The <LeagueGazette .../> call in JSX stays exactly the same.
   All imports (useState, useCallback, supabase) already in Home.jsx
═══════════════════════════════════════════════════════════════ */

const GAZETTE_CACHE_KEY = 'league_gazette_v3';
function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

/* ─────────────────────────────────────────────────────────────
   Story angle → accent color + tag
───────────────────────────────────────────────────────────── */
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
   Fetch from Supabase edge fn → Cohere
   Prompt sends rich live data; AI picks story angle + featured team
───────────────────────────────────────────────────────────── */
async function fetchGazetteEdition({
  leagueLabel,
  recentForm,
  winStreaks,
  lossStreaks,
  currentSeason,
}) {
  const season = currentSeason?.lg || leagueLabel;

  // Build simple lines for hot/cold teams
  const hotLines = recentForm.hot
    .slice(0, 5)
    .map((t) => `${t.team}:${t.w}W-${t.l}L`)
    .join(', ');
  const coldLines = recentForm.cold
    .slice(0, 5)
    .map((t) => `${t.team}:${t.w}W-${t.l}L`)
    .join(', ');
  const winLines = winStreaks
    .slice(0, 5)
    .map((s) => `${s.team}:W${s.count}`)
    .join(', ');
  const lossLines = lossStreaks
    .slice(0, 5)
    .map((s) => `${s.team}:L${s.count}`)
    .join(', ');

  const allTeams = [
    ...new Set([
      ...recentForm.hot.map((t) => t.team),
      ...recentForm.cold.map((t) => t.team),
      ...winStreaks.map((s) => s.team),
      ...lossStreaks.map((s) => s.team),
    ]),
  ];

  // --- Load manager traits for these teams from Supabase ---
  console.log('allTeams', allTeams);
  const { data: managersData } = await supabase
    .from('managers')
    .select('abr, manager_traits')
    .in('abr', allTeams);

  const traitsMap = {};
  console.log('managersData', managersData);
  managersData?.forEach((m) => {
    try {
      traitsMap[m.abr] = JSON.parse(m.manager_traits);
    } catch {
      traitsMap[m.abr] = {};
    }
  });
  console.log('traitsMap after loop', traitsMap);

  // Prepare a string summarizing each team and manager traits
  const traitsLines = allTeams
    .map((team) => {
      const traits = traitsMap[team] || {};
      const tStr = Object.entries(traits)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      return `${team} [${tStr || 'no traits'}]`;
    })
    .join('; ');

  // Rotate angle seed daily
  const angles = [
    'hot_streak',
    'win_streak',
    'cold_streak',
    'loss_streak',
    'big_win',
    'playoff_push',
    'milestone',
    'comeback',
    'rivalry',
  ];
  const daySeed = new Date().getDate() % angles.length;
  const angleHint = angles[daySeed];

  const prompt = `You are the editor of ${leagueLabel} MAGAZINE for season ${season}. Today's angle: "${angleHint}".

LIVE DATA:
Hot teams (last 10 games): ${hotLines || 'none'}
Cold teams (last 10 games): ${coldLines || 'none'}
Win streaks: ${winLines || 'none'}
Loss streaks: ${lossLines || 'none'}
Valid team codes (use EXACTLY): ${allTeams.join(', ') || 'N/A'}

MANAGER TRAITS:
${traitsLines}

━━━━━━━━━━━━━━━━━━━━━━━━━━━
IMPORTANT INSTRUCTIONS:
- When writing pull_quote or bottom_line, explicitly use manager traits.
  - Traits should influence tone, style, be specific.
  - Example: aggressive coach → punchy quote, witty coach → clever line, strategic → emphasize tactics.
- Use the traits naturally — don’t just list them. Blend into the text.

Respond ONLY with valid JSON, zero other text:
{
  "featured_team": "ONE team code from the valid list above — pick the most newsworthy",
  "story_type": "one of: hot_streak|win_streak|cold_streak|loss_streak|big_win|elimination|playoff_push|milestone|comeback|rivalry|idle",
  "cover_line": "3-6 ALL CAPS words. Punchy magazine cover. E.g.: DYNASTY REBORN or ON THE WARPATH",
  "cover_sub": "12-18 words. Punchy supporting line expanding on the cover. Based on actual data.",
  "blurb_1": {
    "tag": "2-3 ALL CAPS words like: SWEPT / FREE FALL / SURGING / SHUTOUT",
    "headline": "6-9 words. Specific story. E.g.: Providence sweeps Highland Wolf in commanding fashion.",
    "detail": "8-12 words. One supporting stat or fact."
  },
  "blurb_2": {
    "tag": "2-3 ALL CAPS words — different angle from blurb_1",
    "headline": "6-9 words about a different team.",
    "detail": "8-12 words."
  },
  "blurb_3": {
    "tag": "2-3 ALL CAPS words — third distinct angle",
    "headline": "6-9 words about a third team or league note.",
    "detail": "8-12 words."
  },
  "pull_quote": "12-20 words. Dramatic fake quote from a player or coach on the featured team, using manager traits if possible.",
  "quote_attr": "— [Coach or player name], Role, ${leagueLabel}",
  "bottom_line": "7-11 words. One punchy verdict on the league, incorporating manager traits if appropriate.",
  "edition": "Vol. ${Math.floor(Math.random() * 30) + 1} · Issue ${
    Math.floor(Math.random() * 80) + 1
  }"
}`;

  const result = await supabase.functions.invoke('gazette-generate', {
    body: { messages: [{ role: 'user', content: prompt }] },
  });

  if (result.error) throw new Error(result.error.message);

  const raw =
    result.data?.text || result.data?.message?.content?.[0]?.text || '';
  const match = raw.replace(/```json|```/g, '').match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON found in response');

  const parsed = JSON.parse(match[0]);
  console.log('[Gazette JSON]', parsed);
  return parsed;
}

/* ─────────────────────────────────────────────────────────────
   Skeleton loader — matches magazine layout
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
   Main component
───────────────────────────────────────────────────────────── */
function LeagueGazette({
  leagueLabel,
  recentForm,
  winStreaks,
  lossStreaks,
  currentSeason,
  loading: dataLoading,
}) {
  const [edition, setEdition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
  
    try {
      const today = todayStamp();
      const playoffKey = `${leagueLabel}_playoff`;
  
      // Try playoff cache first, then regular
      let { data: cached } = await supabase
        .from('gazette_cache')
        .select('data')
        .eq('league', playoffKey)
        .eq('date', today)
        .single();
  
      if (!cached) {
        ({ data: cached } = await supabase
          .from('gazette_cache')
          .select('data')
          .eq('league', leagueLabel)
          .eq('date', today)
          .single());
      }
  
      if (cached?.data) {
        const parsed = typeof cached.data === 'string' 
          ? JSON.parse(cached.data) 
          : cached.data;
        setEdition(parsed);
        return;
      }
  
      // Fall back to generating client-side if nothing cached yet
      const data = await fetchGazetteEdition({
        leagueLabel, recentForm, winStreaks, lossStreaks, currentSeason,
      });
      setEdition(data);
  
    } catch (e) {
      console.error('[Gazette]', e);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leagueLabel, recentForm, winStreaks, lossStreaks, currentSeason]);

  useEffect(() => {
    if (!dataLoading && recentForm.hot.length > 0) load();
  }, [dataLoading, leagueLabel]);

  const handleRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  // Derived display values
  const team = edition?.featured_team ; //REPLACE WITH '' AFTER TEST
  // If featured_team is a full name, find the matching code
  const teamCode =
    Object.entries(teamNameMap).find(
      ([code, info]) => info.full === team || code === team
    )?.[0] || team;
  const meta = getMeta(edition?.story_type);
  const lgKey = leagueLabel?.match(/[A-Za-z]/g)?.[0]?.toLowerCase() || 'w';
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Find live stats for featured team
  const featWin = winStreaks.find((s) => s.team === team);
  const featLoss = lossStreaks.find((s) => s.team === team);
  const featForm =
    recentForm.hot.find((t) => t.team === team) ||
    recentForm.cold.find((t) => t.team === team);

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
          <button
            className="si-refresh"
            onClick={handleRefresh}
            disabled={loading || refreshing}
          >
            <span
              style={{
                display: 'inline-block',
                animation: refreshing ? 'siSpin .7s linear infinite' : 'none',
              }}
            >
              ↻
            </span>
          </button>
        </div>
      </header>

      {/* Accent rule */}
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
        <div
          className={
            refreshing ? 'si-content si-fading' : 'si-content si-fadein'
          }
        >
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
                {/* Atmospheric background */}
                <div className="si-hero-bg">
                  <img
                    src={`/assets/banners/${teamCode}.png`}
                    alt=""
                    className="si-hero-banner"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div className="si-hero-vignette" />
                </div>

                {/* Logo */}
                <div className="si-hero-body">
                  <img
                    src={`/assets/teamLogos/${teamCode}.png`}
                    alt={team}
                    className="si-hero-logo"
                    onError={(e) => {
                      e.currentTarget.style.opacity = '0';
                    }}
                  />
                </div>

                {/* Footer bar */}
                <div className="si-hero-foot">
                  <span className="si-hero-team">{team}</span>
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

            {/* RIGHT — quote + live table */}
            <aside className="si-col-right">
              {/* Pull quote */}
              <div className="si-quote">
                <div className="si-quote-open">"</div>
                <p className="si-quote-text">{edition.pull_quote}</p>
                <div className="si-quote-attr">{edition.quote_attr}</div>
              </div>

              {/* Live: on fire */}
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
                        src={`/assets/teamLogos/${s.teamCode}.png`}
                        alt=""
                        className="si-table-logo"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className="si-table-team">{s.team}</span>
                      <span className="si-table-val si-val-w">W{s.count}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Live: ice cold */}
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
                        src={`/assets/teamLogos/${s.teamCode}.png`}
                        alt=""
                        className="si-table-logo"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <span className="si-table-team">{s.team}</span>
                      <span className="si-table-val si-val-l">L{s.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </aside>
          </div>
          {/* /si-cols */}

          {/* ── BOTTOM LINE ─────────────────────────────── */}
          <div className="si-footer">
            <hr className="si-hr si-hr-short" />
            <span className="si-footer-label">BOTTOM LINE</span>
            <span className="si-footer-text">{edition.bottom_line}</span>
            <hr className="si-hr si-hr-short" />
          </div>
        </div>
      ) : null}

      {/* ══ STYLES ══════════════════════════════════════════ */}
      <style>{`
        /* ── Variables & reset ── */
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
        /* Noise grain */
        .si-wrap::before {
          content:''; position:absolute; inset:0; z-index:0; pointer-events:none;
          background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='250' height='250'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='250' height='250' filter='url(%23g)' opacity='0.025'/%3E%3C/svg%3E");
          opacity:.7;
        }
        .si-wrap > * { position:relative; z-index:1; }

        /* ── Masthead ── */
        .si-mast {
          display: flex;
          align-items: center;
          gap: .8rem;
          padding: .6rem .95rem .5rem;
          border-bottom: 1px solid var(--si-border);
          background: var(--si-bg);
        }
        .si-mast-left {
          display:flex; align-items:center; gap:.4rem; flex-shrink:0;
        }
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
          color:rgba(255,255,255,.28); letter-spacing:4px; line-height:1; margin-top:2px;
        }
        .si-mast-mid {
          flex:1; display:flex; flex-direction:column; align-items:center; gap:3px; min-width:0;
        }
        .si-hr {
          width:100%; border:none; border-top:1px solid var(--si-border); margin:0;
        }
        .si-hr-short { flex:1; }
        .si-mast-date {
          font-family:'VT323',monospace; font-size:14px;
          color:var(--si-muted); letter-spacing:1px; white-space:nowrap;
        }
        .si-mast-right {
          display:flex; align-items:center; gap:.5rem; flex-shrink:0;
        }
        .si-issue {
          font-family:'VT323',monospace; font-size:13px;
          color:var(--si-muted); letter-spacing:.5px; white-space:nowrap;
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

        /* Thick accent rule */
        .si-accent-rule {
          height:3px;
          background:linear-gradient(90deg, transparent 0%, var(--acc) 20%, color-mix(in srgb,var(--acc) 60%,#fff) 50%, var(--acc) 80%, transparent 100%);
          box-shadow:0 0 14px color-mix(in srgb,var(--acc) 45%,transparent);
        }

        /* ── Cover strip ── */
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
          font-family:'VT323',monospace; font-size:18px;
          color:var(--si-muted); margin:0; line-height:1.35;
          font-style:italic; letter-spacing:.4px; max-width:66ch;
        }

        /* ── Three cols ── */
        .si-cols {
          display:grid;
          grid-template-columns: 1fr 1.5fr 1fr;
          min-height:270px;
        }

        /* ── Left: blurbs ── */
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
          font-family:'VT323',monospace; font-size:17px;
          color:rgba(228,222,205,.82); line-height:1.3; margin-bottom:.1rem;
          letter-spacing:.3px;
        }
        .si-blurb-dek {
          font-family:'VT323',monospace; font-size:14px;
          color:var(--si-muted); line-height:1.3;
        }

        /* ── Center: hero ── */
        .si-col-center {
          display:flex; align-items:stretch;
        }
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
        .si-hero-team {
          font-family:'Press Start 2P',monospace; font-size:8.5px;
          color:rgba(255,255,255,.5); letter-spacing:2px;
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

        /* ── Right: quote + tables ── */
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
          font-family:'VT323',monospace; font-size:16px;
          color:rgba(230,222,205,.68); font-style:italic;
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
        .si-table-val {
          font-family:'Press Start 2P',monospace; font-size:7.5px; flex-shrink:0;
        }
        .si-val-w { color:#00C853; text-shadow:0 0 5px rgba(0,200,83,.4); }
        .si-val-l { color:#448AFF; text-shadow:0 0 5px rgba(68,138,255,.35); }

        /* ── Footer ── */
        .si-footer {
          display:flex; align-items:center; gap:.55rem;
          padding:.38rem .9rem .42rem;
          border-top:1px solid var(--si-border);
          background:rgba(255,255,255,.012);
        }
        .si-footer-label {
          font-family:'Press Start 2P',monospace; font-size:6.5px;
          color:var(--acc); letter-spacing:2px; flex-shrink:0;
          text-shadow:0 0 8px color-mix(in srgb,var(--acc) 45%,transparent);
        }
        .si-footer-text {
          font-family:'VT323',monospace; font-size:16px;
          color:var(--si-muted); letter-spacing:.4px; font-style:italic;
          flex-shrink:0;
        }

        /* ── Skeleton ── */
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

        /* ── Error ── */
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

        /* ── Animations ── */
        .si-fadein { animation:siFadeIn .35s ease; }
        .si-fading { opacity:.4; transition:opacity .25s; }
        @keyframes siFadeIn {
          from{opacity:0;transform:translateY(3px);}
          to{opacity:1;transform:translateY(0);}
        }

        /* ── Responsive ── */
        @media(max-width:920px){
          .si-cols {
            grid-template-columns:1fr 1fr;
            grid-template-rows:auto auto;
          }
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

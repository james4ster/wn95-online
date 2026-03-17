// Scores.jsx — NHL95 Arcade Scores Page
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from '../components/LeagueContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────
/// ─── Format "HH:MM:SS" → "Xm YYs" ─────────────────────────────────────────
function fmtTime(timeStr) {
  // timeStr = "HH:MM:SS"
  const [hh, mm, ss] = timeStr.split(':');
  return `${hh}:${mm}`; // HH becomes MM, MM becomes SS
}

const isBetter = (a, h, lowerWins = false) => {
  const av = parseFloat(a),
    hv = parseFloat(h);
  if (isNaN(av) || isNaN(hv) || av === hv) return null;
  return lowerWins ? av < hv : av > hv;
};

// score_type badge config
const TYPE_TAG = { PP: 'PP', SH: 'SH', EN: 'EN', PS: 'PS' }; // EV intentionally omitted
const PERIOD_LABEL = { 1: '1ST', 2: '2ND', 3: '3RD', 4: 'OT', 5: 'OT2' };

// ─── Shared logo component ────────────────────────────────────────────────────
const Logo = ({ team, size = 32 }) => (
  <img
    src={`/assets/teamLogos/${team}.png`}
    alt={team}
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      flexShrink: 0,
      display: 'block',
    }}
    onError={(e) => {
      e.currentTarget.style.opacity = '0';
    }}
  />
);

// ─── Stat bar (away | track+label | home) ─────────────────────────────────────
function StatBar({ label, awayVal, homeVal, lowerWins = false }) {
  const a = parseFloat(awayVal) || 0;
  const h = parseFloat(homeVal) || 0;
  const total = a + h;
  const awayPct = total > 0 ? (a / total) * 100 : 50;
  const winner = isBetter(awayVal, homeVal, lowerWins);
  return (
    <div className="sb">
      <span
        className={`sb-v sb-a${
          winner === true ? ' sb-w' : winner === false ? ' sb-d' : ''
        }`}
      >
        {awayVal ?? '—'}
      </span>
      <div className="sb-m">
        <div className="sb-track">
          <div
            className={`sb-fill sb-fa${winner === true ? ' sb-bright' : ''}`}
            style={{ width: `${awayPct}%` }}
          />
          <div
            className={`sb-fill sb-fh${winner === false ? ' sb-bright' : ''}`}
            style={{ width: `${100 - awayPct}%` }}
          />
        </div>
        <span className="sb-lbl">{label}</span>
      </div>
      <span
        className={`sb-v sb-h${
          winner === false ? ' sb-w' : winner === true ? ' sb-d' : ''
        }`}
      >
        {homeVal ?? '—'}
      </span>
    </div>
  );
}

// ─── Period / shots table with team logo banners ──────────────────────────────
function PeriodTable({ stats, awayTeam, homeTeam }) {
  const hasOT =
    stats.ot_flag === 1 ||
    (stats.away_ot_g ?? 0) > 0 ||
    (stats.home_ot_g ?? 0) > 0;
  const periods = [
    {
      lbl: '1ST',
      ag: stats.away_1p_g,
      hg: stats.home_1p_g,
      as: stats.away_1p_s,
      hs: stats.home_1p_s,
    },
    {
      lbl: '2ND',
      ag: stats.away_2p_g,
      hg: stats.home_2p_g,
      as: stats.away_2p_s,
      hs: stats.home_2p_s,
    },
    {
      lbl: '3RD',
      ag: stats.away_3p_g,
      hg: stats.home_3p_g,
      as: stats.away_3p_s,
      hs: stats.home_3p_s,
    },
    ...(hasOT
      ? [
          {
            lbl: 'OT',
            ag: stats.away_ot_g,
            hg: stats.home_ot_g,
            as: stats.away_ot_s,
            hs: stats.home_ot_s,
          },
        ]
      : []),
  ];
  const colSpan = periods.length + 2;

  return (
    <table className="pt">
      <thead>
        <tr>
          <th className="pt-th pt-name-col" />
          {periods.map((p) => (
            <th key={p.lbl} className="pt-th pt-p-col">
              {p.lbl}
            </th>
          ))}
          <th className="pt-th pt-tot-col">TOT</th>
        </tr>
      </thead>
      <tbody>
        {/* ══ AWAY BANNER ══ */}
        <tr>
          <td colSpan={colSpan} style={{ padding: 0 }}>
            <div className="pt-banner pt-banner-away">
              <Logo team={awayTeam} size={28} />
              <span className="pt-banner-name">{awayTeam}</span>
              <span className="pt-banner-tag">AWAY</span>
            </div>
          </td>
        </tr>
        <tr className="pt-data-row">
          <td className="pt-row-lbl">GOALS</td>
          {periods.map((p) => (
            <td key={p.lbl} className="pt-cell pt-g">
              {p.ag ?? 0}
            </td>
          ))}
          <td className="pt-cell pt-g pt-tot pt-away-tot">
            {stats.away_score}
          </td>
        </tr>
        <tr className="pt-data-row pt-sog-row">
          <td className="pt-row-lbl pt-sog-lbl">SHOTS</td>
          {periods.map((p) => (
            <td key={p.lbl} className="pt-cell pt-s">
              {p.as ?? 0}
            </td>
          ))}
          <td className="pt-cell pt-s pt-tot pt-away-tot">
            {stats.away_shots}
          </td>
        </tr>

        <tr className="pt-spacer">
          <td colSpan={colSpan} />
        </tr>

        {/* ══ HOME BANNER ══ */}
        <tr>
          <td colSpan={colSpan} style={{ padding: 0 }}>
            <div className="pt-banner pt-banner-home">
              <Logo team={homeTeam} size={28} />
              <span className="pt-banner-name">{homeTeam}</span>
              <span className="pt-banner-tag">HOME</span>
            </div>
          </td>
        </tr>
        <tr className="pt-data-row">
          <td className="pt-row-lbl">GOALS</td>
          {periods.map((p) => (
            <td key={p.lbl} className="pt-cell pt-g">
              {p.hg ?? 0}
            </td>
          ))}
          <td className="pt-cell pt-g pt-tot pt-home-tot">
            {stats.home_score}
          </td>
        </tr>
        <tr className="pt-data-row pt-sog-row">
          <td className="pt-row-lbl pt-sog-lbl">SHOTS</td>
          {periods.map((p) => (
            <td key={p.lbl} className="pt-cell pt-s">
              {p.hs ?? 0}
            </td>
          ))}
          <td className="pt-cell pt-s pt-tot pt-home-tot">
            {stats.home_shots}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

// ─── Team stats left column ───────────────────────────────────────────────────
function TeamStatsCol({ stats, awayTeam, homeTeam }) {
  const a = (k) => stats[`away_${k}`] ?? '—';
  const h = (k) => stats[`home_${k}`] ?? '—';
  const awayPP =
    stats.away_pp_amt > 0
      ? `${Math.round((stats.away_pp_g / stats.away_pp_amt) * 100)}%`
      : '0%';
  const homePP =
    stats.home_pp_amt > 0
      ? `${Math.round((stats.home_pp_g / stats.home_pp_amt) * 100)}%`
      : '0%';
  const awayPass =
    stats.away_pass_attempts > 0
      ? `${Math.round(
          (stats.away_pass_complete / stats.away_pass_attempts) * 100
        )}%`
      : '—';
  const homePass =
    stats.home_pass_attempts > 0
      ? `${Math.round(
          (stats.home_pass_complete / stats.home_pass_attempts) * 100
        )}%`
      : '—';

  return (
    <div className="tsc">
      {/* Column header */}
      <div className="col-hdr">
        <div className="col-hdr-side col-hdr-away">
          <Logo team={awayTeam} size={28} />
          <span>{awayTeam}</span>
        </div>
        <span className="col-hdr-lbl">TEAM STATS</span>
        <div className="col-hdr-side col-hdr-home">
          <span>{homeTeam}</span>
          <Logo team={homeTeam} size={28} />
        </div>
      </div>

      {/* Period grid */}
      <div className="tsc-period-wrap">
        <PeriodTable stats={stats} awayTeam={awayTeam} homeTeam={homeTeam} />
      </div>

      {/* Stat sections */}
      <div className="tsc-sec">
        <div className="tsc-sec-ttl">SHOOTING</div>
        <StatBar
          label="SHOTS ON GOAL"
          awayVal={a('shots')}
          homeVal={h('shots')}
        />
        <StatBar
          label="EXPECTED GOALS (xG)"
          awayVal={a('1xg')}
          homeVal={h('1xg')}
        />
        <StatBar
          label="EXPECTED ASSISTS (xA)"
          awayVal={a('1xa')}
          homeVal={h('1xa')}
        />
        <StatBar
          label="BREAKAWAY ATTEMPTS"
          awayVal={a('break_attempts')}
          homeVal={h('break_attempts')}
        />
        <StatBar
          label="BREAKAWAY GOALS"
          awayVal={a('break_goals')}
          homeVal={h('break_goals')}
        />
      </div>

      <div className="tsc-sec">
        <div className="tsc-sec-ttl">SPECIAL TEAMS</div>
        <StatBar
          label="POWER PLAY (G/OPP)"
          awayVal={`${a('pp_g')}/${a('pp_amt')}`}
          homeVal={`${h('pp_g')}/${h('pp_amt')}`}
        />
        <StatBar label="PP %" awayVal={awayPP} homeVal={homePP} />
        <StatBar
          label="PP SHOTS"
          awayVal={a('pp_shots')}
          homeVal={h('pp_shots')}
        />
        <StatBar
          label="PP TIME"
          awayVal={fmtTime(a('pp_mins'))}
          homeVal={fmtTime(h('pp_mins'))}
        />
        <StatBar
          label="SHORTHANDED GOALS"
          awayVal={a('shg')}
          homeVal={h('shg')}
        />
        {(stats.away_ps > 0 || stats.home_ps > 0) && (
          <StatBar
            label="SHOOTOUT (G/ATT)"
            awayVal={`${a('psg')}/${a('ps')}`}
            homeVal={`${h('psg')}/${h('ps')}`}
          />
        )}
      </div>

      <div className="tsc-sec">
        <div className="tsc-sec-ttl">POSSESSION</div>
        <StatBar
          label="ATTACK TIME"
          awayVal={fmtTime(a('attack'))}
          homeVal={fmtTime(h('attack'))}
        />
        <StatBar label="FACEOFFS WON" awayVal={a('fow')} homeVal={h('fow')} />
        <StatBar
          label="PASS COMPLETION %"
          awayVal={awayPass}
          homeVal={homePass}
        />
        <StatBar
          label="PASSES COMPLETED"
          awayVal={a('pass_complete')}
          homeVal={h('pass_complete')}
        />
        <StatBar
          label="PASS ATTEMPTS"
          awayVal={a('pass_attempts')}
          homeVal={h('pass_attempts')}
        />
        <StatBar label="CHECKS" awayVal={a('chk')} homeVal={h('chk')} />
      </div>

      <div className="tsc-sec">
        <div className="tsc-sec-ttl">DISCIPLINE</div>
        <StatBar
          label="PENALTIES"
          awayVal={a('pens')}
          homeVal={h('pens')}
          lowerWins
        />
        <StatBar
          label="PENALTY MINUTES"
          awayVal={a('pim')}
          homeVal={h('pim')}
          lowerWins
        />
      </div>
    </div>
  );
}

// ─── Single scoring play ──────────────────────────────────────────────────────
function GoalRow({ play, awayTeam, runningAway, runningHome }) {
  const isAway = play.g_team === awayTeam;
  const tag = TYPE_TAG[play.score_type];

  return (
    <div className={`gr gr-${isAway ? 'away' : 'home'}`}>
      {/* Left: time + type pill */}
      <div className="gr-time-col">
        <span className="gr-time">{play.g_time}</span>
        {tag && (
          <span className={`gr-tag gr-tag-${play.score_type}`}>{tag}</span>
        )}
      </div>

      {/* Middle: logo + scorer + assists */}
      <div className="gr-body">
        <div className="gr-logo-wrap">
          <Logo team={play.g_team} size={36} />
        </div>
        <div className="gr-text">
          <div className="gr-scorer">{play.goal_player_name}</div>
          <div className="gr-assists">
            {play.assist_primary_name || play.assist_secondary_name ? (
              <>
                <span className="gr-a-lbl">Assists: </span>
                {[play.assist_primary_name, play.assist_secondary_name]
                  .filter(Boolean)
                  .map((n, i) => (
                    <span key={i} className="gr-a-name">
                      {i > 0 && <span className="gr-a-sep"> · </span>}
                      {n}
                    </span>
                  ))}
              </>
            ) : (
              <span className="gr-unassisted">Unassisted</span>
            )}
          </div>
        </div>
      </div>

      {/* Right: running score bubble */}
      <div className="gr-score">
        <span className={`gr-rs${isAway ? ' gr-rs-lit' : ''}`}>
          {runningAway}
        </span>
        <span className="gr-rs-dash">–</span>
        <span className={`gr-rs${!isAway ? ' gr-rs-lit' : ''}`}>
          {runningHome}
        </span>
      </div>
    </div>
  );
}

// ─── Scoring / play-by-play right column ─────────────────────────────────────
function ScoringCol({ gameId, awayTeam, homeTeam, isPlayoff = false }) {
  const [plays, setPlays] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const col = isPlayoff ? 'playoff_game_id' : 'game_id';
      const { data, error } = await supabase
        .from('game_raw_scoring')
        .select('*')
        .eq(col, Number(gameId))
        .order('goal_num', { ascending: true });
      if (cancelled) return;
      if (error) console.error('Scoring fetch error:', error);
      setPlays(data ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  // Build running score per play and group by period
  const grouped = {};
  let rAway = 0,
    rHome = 0;
  (plays || []).forEach((p) => {
    if (p.g_team === awayTeam) rAway++;
    else rHome++;
    const key = p.period;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({ ...p, rAway, rHome });
  });
  const periodNums = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="sc-col">
      {/* Column header */}
      <div className="col-hdr">
        <div className="col-hdr-side col-hdr-away">
          <Logo team={awayTeam} size={28} />
          <span>{awayTeam}</span>
        </div>
        <span className="col-hdr-lbl">SCORING</span>
        <div className="col-hdr-side col-hdr-home">
          <span>{homeTeam}</span>
          <Logo team={homeTeam} size={28} />
        </div>
      </div>

      {loading ? (
        <div className="sc-spinner">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
      ) : !plays || plays.length === 0 ? (
        <div className="sc-empty">
          <div style={{ fontSize: '2.5rem', opacity: 0.25 }}>🏒</div>
          <div className="sc-empty-txt">NO SCORING DATA</div>
        </div>
      ) : (
        <div className="sc-plays">
          {periodNums.map((per) => (
            <div key={per} className="sc-period">
              {/* Period divider */}
              <div className="sc-per-hdr">
                <div className="sc-per-line" />
                <span className="sc-per-name">
                  {PERIOD_LABEL[per] ?? `P${per}`} PERIOD
                </span>
                <div className="sc-per-line" />
              </div>
              {/* Goals in this period */}
              {grouped[per].map((p) => (
                <GoalRow
                  key={p.id}
                  play={p}
                  awayTeam={awayTeam}
                  runningAway={p.rAway}
                  runningHome={p.rHome}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Full expanded panel (fetches team stats + scoring in parallel) ───────────
function GameStatsPanel({ gameId, awayTeam, homeTeam, isPlayoff = false }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const col = isPlayoff ? 'playoff_game_id' : 'game_id';
      const { data, error } = await supabase
        .from('game_stats_team')
        .select('*')
        .eq(col, Number(gameId))
        .limit(1);
      if (cancelled) return;
      if (error) console.error('Stats fetch error:', error);
      setStats(data?.[0] ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (loading)
    return (
      <div className="gsp-loader">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    );

  return (
    <div className="gsp-2col">
      {stats ? (
        <TeamStatsCol stats={stats} awayTeam={awayTeam} homeTeam={homeTeam} />
      ) : (
        <div className="gsp-no-stats">NO TEAM STATS AVAILABLE</div>
      )}
      <ScoringCol
        gameId={gameId}
        awayTeam={awayTeam}
        homeTeam={homeTeam}
        isPlayoff={isPlayoff}
      />
    </div>
  );
}

// ─── Collapsed game row ───────────────────────────────────────────────────────
function GameCard({ game, selectedTeam, index }) {
  const [open, setOpen] = useState(false);

  const isHome = selectedTeam === game.home;
  const myScore = isHome ? game.score_home : game.score_away;
  const opScore = isHome ? game.score_away : game.score_home;
  const isOT = Number(game.ot) === 1;

  let result = 'tie';
  if (myScore > opScore) result = 'win';
  else if (myScore < opScore && isOT) result = 'otl';
  else if (myScore < opScore) result = 'loss';

  const BADGE = { win: 'W', loss: 'L', otl: 'OTL', tie: 'T' };
  const RC = {
    win: { c: '#00CC55', g: 'rgba(0,204,85,.13)', s: '#00CC55' },
    loss: { c: '#5588FF', g: 'rgba(85,136,255,.08)', s: '#3B6FE8' },
    otl: { c: '#FF8C00', g: 'rgba(255,140,0,.10)', s: '#FF8C00' },
    tie: { c: '#888', g: 'rgba(128,128,128,.05)', s: '#555' },
  }[result];

  return (
    <div
      className={`gc gc-${result}${open ? ' gc-open' : ''}`}
      style={{
        '--stripe': RC.s,
        '--glow': RC.g,
        animationDelay: `${index * 0.04}s`,
      }}
    >
      <button className="gc-row" onClick={() => setOpen((o) => !o)}>
        {/* Result badge */}
        <div
          className="gc-badge"
          style={{
            color: RC.c,
            borderColor: `${RC.c}60`,
            background: `${RC.c}14`,
          }}
        >
          {game.isPlayoff ? (
            <>
              <div>{BADGE[result]}</div>
              <div
                style={{
                  fontSize: '.42rem',
                  opacity: 0.85,
                  marginTop: 3,
                  letterSpacing: 1,
                }}
              >
                R{game.round}·G{game.game_number}
              </div>
            </>
          ) : (
            BADGE[result]
          )}
        </div>

        {/* Away team */}
        <div className="gc-side gc-away">
          <Logo team={game.away} size={42} />
          <span
            className={`gc-code${game.away === selectedTeam ? ' gc-sel' : ''}`}
          >
            {game.away}
          </span>
        </div>

        {/* Score pill */}
        <div className="gc-score-pill">
          <span
            className={`gc-num${
              game.score_away > game.score_home ? ' gc-hi' : ''
            }`}
          >
            {game.score_away ?? '—'}
          </span>
          <div className="gc-sep">
            {isOT ? (
              <span className="gc-ot">OT</span>
            ) : (
              <span className="gc-dash">–</span>
            )}
          </div>
          <span
            className={`gc-num${
              game.score_home > game.score_away ? ' gc-hi' : ''
            }`}
          >
            {game.score_home ?? '—'}
          </span>
        </div>

        {/* Home team */}
        <div className="gc-side gc-home">
          <span
            className={`gc-code${game.home === selectedTeam ? ' gc-sel' : ''}`}
          >
            {game.home}
          </span>
          <Logo team={game.home} size={42} />
        </div>

        {/* Chevron */}
        <svg
          className={`gc-chev${open ? ' up' : ''}`}
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
        >
          <path
            d="M3 5l4 4 4-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="gc-panel">
          <GameStatsPanel
            gameId={game.id}
            awayTeam={game.away}
            homeTeam={game.home}
            isPlayoff={!!game.isPlayoff}
          />
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Scores() {
  const { selectedLeague } = useLeague();
  const [seasons, setSeasons] = useState([]);
  const [season, setSeason] = useState('');
  const [mode, setMode] = useState('Season');
  const [teams, setTeams] = useState([]);
  const [team, setTeam] = useState('');
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedLeague) return;
    (async () => {
      const { data } = await supabase
        .from('seasons')
        .select('lg,year')
        .ilike('lg', `${selectedLeague}%`)
        .order('year', { ascending: false });
      const codes = (data || []).map((r) => r.lg);
      setSeasons(codes);
      setSeason(codes[0] ?? '');
    })();
  }, [selectedLeague]);

  useEffect(() => {
    if (!season) {
      setTeams([]);
      setTeam('');
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('teams')
        .select('abr,team')
        .eq('lg', season)
        .order('team', { ascending: true });
      const list = (data || []).map((r) => ({ abr: r.abr, name: r.team }));
      setTeams(list);
      setTeam((t) => (list.find((x) => x.abr === t) ? t : list[0]?.abr ?? ''));
    })();
  }, [season]);

  useEffect(() => {
    if (!season || !team) return;
    setLoading(true);
    (async () => {
      let data, error;
      if (mode === 'Playoffs') {
        // Query playoff_games — normalize to same shape as games rows
        const res = await supabase
          .from('playoff_games')
          .select(
            'id,lg,round,series_number,game_number,team_code_a,team_code_b,seed_a,seed_b,team_a_score,team_b_score'
          )
          .eq('lg', season)
          .or(`team_code_a.eq.${team},team_code_b.eq.${team}`)
          .not('team_a_score', 'is', null)
          .order('round', { ascending: true })
          .order('series_number', { ascending: true })
          .order('game_number', { ascending: true });
        error = res.error;
        // Normalize playoff rows to match the shape GameCard expects
        data = (res.data || []).map((g) => ({
          id: g.id,
          lg: g.lg,
          mode: 'Playoffs',
          home: g.team_code_a, // team_code_a = home (lower seed)
          away: g.team_code_b, // team_code_b = away (higher seed)
          score_home: g.team_a_score,
          score_away: g.team_b_score,
          ot: 0, // playoff_games doesn't store OT flag yet
          round: g.round,
          series_number: g.series_number,
          game_number: g.game_number,
          isPlayoff: true, // flag for stats/scoring lookups
        }));
      } else {
        const res = await supabase
          .from('games')
          .select(
            'id,lg,legacy_game_id,mode,home,away,score_home,score_away,ot'
          )
          .eq('lg', season)
          .or(`mode.eq.Season,mode.eq.season`)
          .or(`home.eq.${team},away.eq.${team}`)
          .not('score_home', 'is', null)
          .order('game_number', { ascending: true, nullsFirst: false });
        error = res.error;
        data = res.data;
      }
      if (error) console.error(error);
      setGames(data ?? []);
      setLoading(false);
    })();
  }, [season, mode, team]);

  const rec = games.reduce(
    (acc, g) => {
      const isHome = team === g.home;
      const my = isHome ? g.score_home : g.score_away;
      const op = isHome ? g.score_away : g.score_home;
      if (my > op) acc.w++;
      else if (my < op && Number(g.ot)) acc.otl++;
      else if (my < op) acc.l++;
      else acc.t++;
      return acc;
    },
    { w: 0, l: 0, otl: 0, t: 0 }
  );

  return (
    <div className="sp">
      <style>{`
        /* ════════════════════════════════════════════════════════════════════
           PAGE
        ════════════════════════════════════════════════════════════════════ */
        .sp {
          padding: 1.5rem 2rem 6rem;
          min-height: 100vh;
          background: radial-gradient(ellipse 130% 30% at 50% 0%,rgba(15,15,40,.95) 0%,transparent 60%), #020208;
        }

        /* ── HEADER ─────────────────────────────────────────────────────── */
        .sp-hw { display:flex; justify-content:center; margin-bottom:1.8rem; }
        .sp-hb {
          background:#000; border:6px solid #333; border-radius:8px; padding:.9rem 2.5rem;
          box-shadow:0 0 0 2px #000,inset 0 0 20px rgba(0,0,0,.8),0 8px 16px rgba(0,0,0,.5),0 0 40px rgba(255,215,0,.28);
          position:relative; overflow:hidden;
          background-image:
            repeating-linear-gradient(0deg,rgba(255,215,0,.03) 0,rgba(255,215,0,.03) 1px,transparent 1px,transparent 4px),
            repeating-linear-gradient(90deg,rgba(255,215,0,.03) 0,rgba(255,215,0,.03) 1px,transparent 1px,transparent 4px);
        }
        .sp-hb::after {
          content:''; position:absolute; top:-50%; left:-50%; width:200%; height:200%;
          background:linear-gradient(45deg,transparent 30%,rgba(255,215,0,.1) 50%,transparent 70%);
          animation:shimmer 3s infinite; pointer-events:none;
        }
        @keyframes shimmer {
          0%  { transform:translateX(-100%) translateY(-100%) rotate(45deg) }
          100%{ transform:translateX(100%)  translateY(100%)  rotate(45deg) }
        }
        .sp-led {
            font-family:'Press Start 2P',monospace; font-size:2rem; color:#FFD700; letter-spacing:6px;
            text-shadow:0 0 10px #FF8C00,0 0 20px #FF8C00,0 0 30px #FFD700;
            filter:contrast(1.3) brightness(1.2); position:relative; z-index:1;
          }

        /* ── FILTERS ────────────────────────────────────────────────────── */
        .sp-fx { display:flex; gap:1.5rem; justify-content:center; flex-wrap:wrap; margin-bottom:1.25rem; }
        .sp-fg { display:flex; flex-direction:column; gap:.4rem; }
        .sp-flbl { font-family:'Press Start 2P',monospace; font-size:.6rem; color:#FF8C00; letter-spacing:2px; }
        .sp-sel {
          background:rgba(5,5,20,.9); color:#87CEEB; border:2px solid rgba(135,206,235,.3);
          padding:.55rem 1.1rem; font-family:'VT323',monospace; font-size:1.3rem;
          border-radius:8px; cursor:pointer; outline:none; min-width:160px;
          transition:border-color .2s,box-shadow .2s;
        }
        .sp-sel:hover,.sp-sel:focus { border-color:#87CEEB; box-shadow:0 0 12px rgba(135,206,235,.2); }
        .sp-sel option { background:#0a0a18; }

        /* ── RECORD STRIP ───────────────────────────────────────────────── */
        .sp-record { display:flex; justify-content:center; gap:2.5rem; margin-bottom:1.5rem; }
        .sp-rec { display:flex; flex-direction:column; align-items:center; gap:.3rem; }
        .sp-rec-num { font-family:'VT323',monospace; font-size:2.4rem; line-height:1; }
        .sp-rec-lbl { font-family:'Press Start 2P',monospace; font-size:.42rem; letter-spacing:1px; }
        .sp-rec.w  .sp-rec-num,.sp-rec.w  .sp-rec-lbl { color:#00CC55; }
        .sp-rec.l  .sp-rec-num,.sp-rec.l  .sp-rec-lbl { color:#5588FF; }
        .sp-rec.otl .sp-rec-num,.sp-rec.otl .sp-rec-lbl { color:#FF8C00; }
        .sp-rec.t  .sp-rec-num,.sp-rec.t  .sp-rec-lbl { color:#888; }

        /* ── GAME LIST ──────────────────────────────────────────────────── */
        .sp-list { max-width:1160px; margin:0 auto; display:flex; flex-direction:column; gap:.55rem; }

        /* ════════════════════════════════════════════════════════════════════
           GAME CARD (collapsed)
        ════════════════════════════════════════════════════════════════════ */
        .gc {
          border-radius:12px; overflow:hidden;
          border:1px solid rgba(255,255,255,.07);
          border-left:4px solid var(--stripe);
          box-shadow:inset 0 0 50px var(--glow);
          animation:gcIn .3s ease both;
        }
        @keyframes gcIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .gc-open { box-shadow:inset 0 0 50px var(--glow), 0 0 0 1px rgba(255,255,255,.1); }

        .gc-row {
          width:100%; display:grid;
          grid-template-columns:58px 1fr 180px 1fr 28px;
          align-items:center; gap:.8rem;
          padding:.95rem 1.1rem .95rem .85rem;
          background:linear-gradient(135deg,rgba(255,255,255,.035) 0%,rgba(0,0,0,.55) 100%);
          border:none; cursor:pointer; transition:background .15s;
        }
        .gc-row:hover { background:rgba(255,140,0,.06); }
        .gc-row:hover img { filter:drop-shadow(0 0 8px rgba(255,215,0,.3)); }

        .gc-badge {
          font-family:'Press Start 2P',monospace; font-size:.58rem;
          padding:.32rem .42rem; border-radius:5px; text-align:center;
          border:1px solid; line-height:1.4; white-space:nowrap;
        }

        .gc-side { display:flex; align-items:center; gap:.65rem; }
        .gc-away { justify-content:flex-end; }
        .gc-home { justify-content:flex-start; }

        .gc-code { font-family:'Press Start 2P',monospace; font-size:.78rem; color:rgba(255,255,255,.55); letter-spacing:1px; }
        .gc-sel  { color:#FFD700; text-shadow:0 0 10px rgba(255,215,0,.5); }

        .gc-score-pill {
          display:flex; align-items:center; justify-content:center; gap:.55rem;
          background:rgba(0,0,0,.4); border-radius:10px; padding:.45rem .7rem;
          border:1px solid rgba(255,255,255,.08);
        }
        .gc-num  { font-family:'VT323',monospace; font-size:3.2rem; line-height:1; color:rgba(255,255,255,.45); min-width:28px; text-align:center; }
        .gc-hi   { color:#FFD700; text-shadow:0 0 16px rgba(255,215,0,.6); }
        .gc-sep  { min-width:36px; text-align:center; }
        .gc-dash { font-family:'VT323',monospace; font-size:2.2rem; color:rgba(255,255,255,.12); display:block; }
        .gc-ot   { display:inline-block; font-family:'Press Start 2P',monospace; font-size:.38rem; color:#FF8C00; border:1px solid rgba(255,140,0,.55); border-radius:4px; padding:.16rem .3rem; background:rgba(255,140,0,.12); }

        .gc-chev { color:rgba(255,255,255,.2); transition:transform .22s,color .2s; flex-shrink:0; }
        .gc-chev.up { transform:rotate(180deg); color:#87CEEB; }

        /* ════════════════════════════════════════════════════════════════════
           EXPANDED PANEL SHELL
        ════════════════════════════════════════════════════════════════════ */
        .gc-panel { border-top:1px solid rgba(255,255,255,.07); background:rgba(0,0,14,.72); }

        .gsp-loader,.sc-spinner {
          display:flex; gap:7px; align-items:center; justify-content:center; padding:3rem;
        }
        .dot {
          display:inline-block; width:6px; height:6px; border-radius:50%;
          background:#87CEEB; animation:dotP 1.2s ease-in-out infinite;
        }
        .dot:nth-child(2){animation-delay:.15s} .dot:nth-child(3){animation-delay:.3s}
        @keyframes dotP { 0%,100%{opacity:.15} 50%{opacity:1} }

        .gsp-no-stats {
          display:flex; align-items:center; justify-content:center;
          font-family:'Press Start 2P',monospace; font-size:.65rem;
          color:rgba(255,255,255,.25); padding:3rem; letter-spacing:2px;
        }

        /* 2-column layout */
        .gsp-2col {
          display:grid; grid-template-columns:1fr 1fr;
          align-items:start; /* don't stretch columns to match height */
        }

        /* ════════════════════════════════════════════════════════════════════
           SHARED COLUMN HEADER
        ════════════════════════════════════════════════════════════════════ */
        .col-hdr {
          display:grid; grid-template-columns:1fr auto 1fr;
          align-items:center; gap:.75rem; padding:.85rem 1.3rem;
          background:rgba(0,0,0,.6); border-bottom:2px solid rgba(255,255,255,.08);
          position:sticky; top:0; z-index:2;
        }
        .col-hdr-side {
          display:flex; align-items:center; gap:.55rem;
          font-family:'Press Start 2P',monospace; font-size:.72rem; letter-spacing:2px; font-weight:bold;
        }
        .col-hdr-away { color:#87CEEB; justify-content:flex-end;  text-shadow:0 0 10px rgba(135,206,235,.7); }
        .col-hdr-home { color:#FF8C00; justify-content:flex-start; text-shadow:0 0 10px rgba(255,140,0,.7); }
        .col-hdr-lbl  {
          font-family:'Press Start 2P',monospace; font-size:.42rem;
          color:rgba(255,255,255,.45); letter-spacing:2px; text-align:center; white-space:nowrap;
        }

        /* ════════════════════════════════════════════════════════════════════
           TEAM STATS COLUMN
        ════════════════════════════════════════════════════════════════════ */
        .tsc { display:flex; flex-direction:column; border-right:1px solid rgba(255,255,255,.07); }

        /* ── Period table ── */
        .tsc-period-wrap { padding:1rem 1.3rem .8rem; border-bottom:1px solid rgba(255,255,255,.06); }

        .pt { width:100%; border-collapse:collapse; }

        .pt-th {
          font-family:'Press Start 2P',monospace; font-size:.45rem; letter-spacing:1px;
          color:rgba(255,255,255,.45); padding:.2rem .4rem; text-align:center;
        }
        .pt-name-col { width:72px; text-align:left; }
        .pt-p-col    { width:50px; }
        .pt-tot-col  { color:rgba(255,215,0,.7); }

        /* Banner rows */
        .pt-banner {
          display:flex; align-items:center; gap:.55rem;
          padding:.35rem .55rem;
          margin-bottom:1px;
        }
        .pt-banner-away {
          background:linear-gradient(90deg,rgba(135,206,235,.22) 0%,rgba(135,206,235,.04) 100%);
          border-left:3px solid #87CEEB;
        }
        .pt-banner-home {
          background:linear-gradient(90deg,rgba(255,140,0,.22) 0%,rgba(255,140,0,.04) 100%);
          border-left:3px solid #FF8C00;
        }
        .pt-banner-name {
          font-family:'Press Start 2P',monospace; font-size:.65rem; letter-spacing:2px; font-weight:bold;
        }
        .pt-banner-away .pt-banner-name { color:#87CEEB; text-shadow:0 0 8px rgba(135,206,235,.6); }
        .pt-banner-home .pt-banner-name { color:#FF8C00; text-shadow:0 0 8px rgba(255,140,0,.6); }
        .pt-banner-tag  { font-family:'Press Start 2P',monospace; font-size:.35rem; color:rgba(255,255,255,.35); letter-spacing:1px; }

        /* Data rows */
        .pt-row-lbl {
          font-family:'Press Start 2P',monospace; font-size:.44rem; letter-spacing:1px;
          color:rgba(255,255,255,.6); padding:.22rem .55rem; text-align:left; white-space:nowrap;
        }
        .pt-sog-lbl { color:rgba(255,255,255,.35); font-size:.38rem; }

        .pt-cell   { font-family:'VT323',monospace; font-size:1.7rem; line-height:1; text-align:center; padding:.1rem .25rem; color:rgba(255,255,255,.9); }
        .pt-s      { font-size:1.15rem; color:rgba(255,255,255,.38); }
        .pt-tot    { font-size:2.1rem; font-weight:bold; }
        .pt-away-tot { color:#87CEEB; text-shadow:0 0 10px rgba(135,206,235,.5); }
        .pt-home-tot { color:#FF8C00; text-shadow:0 0 10px rgba(255,140,0,.5); }
        .pt-data-row td { border-top:1px solid rgba(255,255,255,.05); padding-top:.2rem; }
        .pt-sog-row td  { border-bottom:1px solid rgba(255,255,255,.04); padding-bottom:.25rem; }
        .pt-spacer td   { height:10px; }

        /* ── Stat sections ── */
        .tsc-sec { padding:.8rem 1.3rem; border-bottom:1px solid rgba(255,255,255,.04); }
        .tsc-sec:last-child { border-bottom:none; }
        .tsc-sec-ttl {
          font-family:'Press Start 2P',monospace; font-size:.65rem; letter-spacing:2px; color:#FF8C00;
          margin-bottom:.55rem; padding-bottom:.35rem;
          border-bottom:1px solid rgba(255,140,0,.22);
          text-shadow:0 0 10px rgba(255,140,0,.45);
        }

        /* Stat bar */
        .sb { display:grid; grid-template-columns:68px 1fr 68px; align-items:center; gap:.5rem; padding:.3rem .1rem; border-radius:4px; transition:background .1s; }
        .sb:hover { background:rgba(255,255,255,.025); }
        .sb-v { font-family:'VT323',monospace; font-size:1.6rem; line-height:1; color:rgba(255,255,255,.85); }
        .sb-a { text-align:right; } .sb-h { text-align:left; }
        .sb-w { color:#FFD700 !important; text-shadow:0 0 10px rgba(255,215,0,.5); }
        .sb-d { color:rgba(255,255,255,.22) !important; }
        .sb-m { display:flex; flex-direction:column; gap:3px; }
        .sb-track { display:flex; height:4px; border-radius:3px; overflow:hidden; background:rgba(255,255,255,.07); }
        .sb-fill  { height:100%; transition:width .6s ease; }
        .sb-fa { background:rgba(135,206,235,.38); border-radius:3px 0 0 3px; }
        .sb-fh { background:rgba(255,140,0,.38);   border-radius:0 3px 3px 0; }
        .sb-bright.sb-fa { background:#87CEEB; }
        .sb-bright.sb-fh { background:#FF8C00; }
        .sb-lbl {
          font-family:'Press Start 2P',monospace; font-size:.4rem; letter-spacing:.5px;
          color:rgba(255,255,255,.58); text-align:center;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }

        /* ════════════════════════════════════════════════════════════════════
           SCORING COLUMN
        ════════════════════════════════════════════════════════════════════ */
        .sc-col { display:flex; flex-direction:column; }
        .sc-plays { padding:.25rem 0 1rem; }

        .sc-empty {
          flex:1; display:flex; flex-direction:column; align-items:center;
          justify-content:center; gap:.85rem; padding:3.5rem 2rem; min-height:260px;
        }
        .sc-empty-txt { font-family:'Press Start 2P',monospace; font-size:.65rem; color:rgba(255,255,255,.22); letter-spacing:3px; }

        /* Period divider */
        .sc-period { margin-bottom:.15rem; }
        .sc-per-hdr { display:flex; align-items:center; gap:.65rem; padding:.65rem 1.3rem .4rem; }
        .sc-per-line { flex:1; height:1px; background:rgba(255,255,255,.1); }
        .sc-per-name { font-family:'Press Start 2P',monospace; font-size:.52rem; color:rgba(255,255,255,.5); letter-spacing:2px; white-space:nowrap; }

        /* ── Individual goal row ── */
        .gr {
          display:grid; grid-template-columns:62px 1fr 78px;
          align-items:center; gap:.65rem;
          padding:.65rem 1.3rem;
          border-bottom:1px solid rgba(255,255,255,.04);
          transition:background .12s;
        }
        .gr:last-child { border-bottom:none; }
        .gr:hover { background:rgba(255,255,255,.03); }
        .gr-away { border-left:3px solid rgba(135,206,235,.55); }
        .gr-home { border-left:3px solid rgba(255,140,0,.55); }

        /* Time + type pill */
        .gr-time-col { display:flex; flex-direction:column; align-items:center; gap:.3rem; }
        .gr-time { font-family:'VT323',monospace; font-size:1.5rem; line-height:1; color:rgba(255,255,255,.8); }
        .gr-tag {
          font-family:'Press Start 2P',monospace; font-size:.3rem;
          padding:.1rem .22rem; border-radius:3px; letter-spacing:1px;
        }
        .gr-tag-PP { color:#FFD700; border:1px solid rgba(255,215,0,.45); background:rgba(255,215,0,.12); }
        .gr-tag-SH { color:#87CEEB; border:1px solid rgba(135,206,235,.45); background:rgba(135,206,235,.12); }
        .gr-tag-EN { color:#FF4455; border:1px solid rgba(255,68,85,.45);   background:rgba(255,68,85,.12); }
        .gr-tag-PS { color:#CC44FF; border:1px solid rgba(204,68,255,.45);  background:rgba(204,68,255,.12); }

        /* Logo + text */
        .gr-body { display:flex; align-items:center; gap:.6rem; min-width:0; }
        .gr-logo-wrap { flex-shrink:0; display:flex; align-items:center; justify-content:center; width:44px; height:44px; background:rgba(0,0,0,.3); border-radius:8px; padding:3px; border:1px solid rgba(255,255,255,.08); }
        .gr-logo-wrap img { filter:drop-shadow(0 0 6px rgba(255,255,255,.15)); }
        .gr-away .gr-logo-wrap { border-color:rgba(135,206,235,.25); box-shadow:0 0 10px rgba(135,206,235,.12); }
        .gr-home .gr-logo-wrap { border-color:rgba(255,140,0,.25); box-shadow:0 0 10px rgba(255,140,0,.12); }
        .gr-text { display:flex; flex-direction:column; gap:.25rem; min-width:0; }

        .gr-scorer {
          font-family:'VT323',monospace; font-size:1.5rem; line-height:1.1;
          color:#fff; font-weight:bold;
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .gr-away .gr-scorer { color:#87CEEB; text-shadow:0 0 8px rgba(135,206,235,.4); }
        .gr-home .gr-scorer { color:#FF8C00; text-shadow:0 0 8px rgba(255,140,0,.4); }

        .gr-assists {
          font-family:'VT323',monospace; font-size:1.1rem; line-height:1;
          color:rgba(255,255,255,.5);
          display:flex; flex-wrap:wrap; align-items:center; gap:.2rem;
        }
        .gr-a-lbl    { color:rgba(255,255,255,.3); font-size:1rem; }
        .gr-a-name   { color:rgba(255,255,255,.72); }
        .gr-a-sep    { color:rgba(255,255,255,.22); }
        .gr-unassisted { color:rgba(255,255,255,.3); font-style:italic; }

        /* Running score bubble */
        .gr-score {
          display:flex; align-items:center; justify-content:center; gap:.2rem;
          background:rgba(0,0,0,.35); border-radius:8px;
          padding:.3rem .45rem; border:1px solid rgba(255,255,255,.08);
        }
        .gr-rs { font-family:'VT323',monospace; font-size:1.8rem; line-height:1; color:rgba(255,255,255,.28); min-width:20px; text-align:center; }
        .gr-rs-lit { color:#FFD700; text-shadow:0 0 10px rgba(255,215,0,.55); }
        .gr-rs-dash { font-family:'VT323',monospace; font-size:1.3rem; color:rgba(255,255,255,.15); }

        /* ════════════════════════════════════════════════════════════════════
           PAGE STATES
        ════════════════════════════════════════════════════════════════════ */
        .sp-loading { display:flex; gap:8px; align-items:center; justify-content:center; padding:5rem; }
        .sp-loading .dot { width:8px; height:8px; background:#FF8C00; }
        .sp-empty-page {
          text-align:center; font-family:'Press Start 2P',monospace; font-size:.75rem;
          color:rgba(255,255,255,.15); padding:5rem; letter-spacing:2px;
        }

        /* ════════════════════════════════════════════════════════════════════
           RESPONSIVE
        ════════════════════════════════════════════════════════════════════ */
        @media(max-width:960px){
          .gsp-2col { grid-template-columns:1fr; }
          .sc-col   { display:none; }
          .tsc      { border-right:none; }
        }
        @media(max-width:640px){
          .sp { padding:1rem 1rem 4rem; }
          .sp-led { font-size:1.5rem; letter-spacing:3px; }
          .gc-row { grid-template-columns:44px 1fr 150px 1fr 22px; gap:.45rem; padding:.8rem .7rem; }
          .gc-code { font-size:.64rem; }
          .gc-num  { font-size:2.6rem; }
          .sb { grid-template-columns:56px 1fr 56px; }
          .sb-lbl { font-size:.34rem; }
          .tsc-sec { padding:.7rem .9rem; }
          .tsc-period-wrap { padding:.8rem .9rem .6rem; }
        }
      `}</style>

      {/* ── HEADER ── */}
      <div className="sp-hw">
        <div className="sp-hb">
          <div className="sp-led">SCORES</div>
        </div>
      </div>

      {/* ── FILTERS ── */}
      <div className="sp-fx">
        <div className="sp-fg">
          <span className="sp-flbl">SEASON</span>
          <select
            className="sp-sel"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
          >
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="sp-fg">
          <span className="sp-flbl">MODE</span>
          <select
            className="sp-sel"
            value={mode}
            onChange={(e) => setMode(e.target.value)}
          >
            <option value="Season">Season</option>
            <option value="Playoffs">Playoffs</option>
          </select>
        </div>
        <div className="sp-fg">
          <span className="sp-flbl">TEAM</span>
          <select
            className="sp-sel"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
          >
            {teams.map((t) => (
              <option key={t.abr} value={t.abr}>
                {t.name} ({t.abr})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── RECORD STRIP ── */}
      {!loading && games.length > 0 && (
        <div className="sp-record">
          <div className="sp-rec w">
            <span className="sp-rec-num">{rec.w}</span>
            <span className="sp-rec-lbl">WINS</span>
          </div>
          <div className="sp-rec l">
            <span className="sp-rec-num">{rec.l}</span>
            <span className="sp-rec-lbl">LOSSES</span>
          </div>
          {rec.otl > 0 && (
            <div className="sp-rec otl">
              <span className="sp-rec-num">{rec.otl}</span>
              <span className="sp-rec-lbl">OTL</span>
            </div>
          )}
          {rec.t > 0 && (
            <div className="sp-rec t">
              <span className="sp-rec-num">{rec.t}</span>{' '}
              <span className="sp-rec-lbl">TIES</span>
            </div>
          )}
        </div>
      )}

      {/* ── GAME LIST ── */}
      {loading ? (
        <div className="sp-loading">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
      ) : games.length === 0 ? (
        <div className="sp-empty-page">NO GAMES FOUND</div>
      ) : (
        <div className="sp-list">
          {games.map((g, i) => (
            <GameCard key={g.id} game={g} selectedTeam={team} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

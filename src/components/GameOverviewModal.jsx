// GameOverviewModal.jsx — Cinematic broadcast-style game overview modal
import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../utils/supabaseClient';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtTOI(timeStr) {
  if (!timeStr) return '—';
  const parts = timeStr.split(':');
  if (parts.length === 3) return `${parts[0]}:${parts[1]}`;
  return timeStr;
}
function fmtTime(timeStr) {
  if (!timeStr) return '—';
  const [hh, mm] = timeStr.split(':');
  return `${hh}:${mm}`;
}

const isBetter = (a, h, lowerWins = false) => {
  const av = parseFloat(a), hv = parseFloat(h);
  if (isNaN(av) || isNaN(hv) || av === hv) return null;
  return lowerWins ? av < hv : av > hv;
};

const TYPE_TAG     = { PP: 'PP', SH: 'SH', EN: 'EN', PS: 'PS' };
const PERIOD_LABEL = { 1: '1ST', 2: '2ND', 3: '3RD', 4: 'OT', 5: 'SO' };

const Logo = ({ team, size = 32 }) => (
  <img src={`/assets/teamLogos/${team}.png`} alt={team}
    style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, display: 'block' }}
    onError={e => { e.currentTarget.style.opacity = '0'; }} />
);

// ─── Stat bar ────────────────────────────────────────────────────────────────
function StatBar({ label, awayVal, homeVal, lowerWins = false }) {
  const a = parseFloat(awayVal) || 0;
  const h = parseFloat(homeVal) || 0;
  const total = a + h;
  const awayPct = total > 0 ? (a / total) * 100 : 50;
  const winner = isBetter(awayVal, homeVal, lowerWins);
  return (
    <div className="mod-sb">
      <span className={`mod-sb-v mod-sb-a${winner === true ? ' mod-sb-w' : winner === false ? ' mod-sb-d' : ''}`}>{awayVal ?? '—'}</span>
      <div className="mod-sb-m">
        <div className="mod-sb-track">
          <div className={`mod-sb-fill mod-sb-fa${winner === true  ? ' mod-sb-bright' : ''}`} style={{ width: `${awayPct}%` }} />
          <div className={`mod-sb-fill mod-sb-fh${winner === false ? ' mod-sb-bright' : ''}`} style={{ width: `${100 - awayPct}%` }} />
        </div>
        <span className="mod-sb-lbl">{label}</span>
      </div>
      <span className={`mod-sb-v mod-sb-h${winner === false ? ' mod-sb-w' : winner === true ? ' mod-sb-d' : ''}`}>{homeVal ?? '—'}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB: BOX SCORE
// ═══════════════════════════════════════════════════════════════════
function BoxScoreTab({ skaters, goalies, awayTeam, homeTeam }) {
  const noData = (!skaters || skaters.length === 0) && (!goalies || goalies.length === 0);
  if (noData) return (
    <div className="mod-empty-state">
      <div style={{ fontSize: '2.5rem', opacity: 0.2 }}>📋</div>
      <div>NO PLAYER DATA AVAILABLE</div>
    </div>
  );

  const awaySkaters = (skaters || []).filter(p => p.team_code === awayTeam);
  const homeSkaters = (skaters || []).filter(p => p.team_code === homeTeam);
  const awayGoalies = (goalies  || []).filter(p => p.team_code === awayTeam);
  const homeGoalies = (goalies  || []).filter(p => p.team_code === homeTeam);

  const sortSkaters = arr =>
    [...arr].sort((a, b) => (b.points ?? 0) - (a.points ?? 0) || (b.goals ?? 0) - (a.goals ?? 0));

  const TeamBlock = ({ skaterList, goalieList, team, side }) => (
    <div className={`mod-bs-block mod-bs-${side}`}>
      <div className={`mod-bs-team-hdr mod-bs-hdr-${side}`}>
        <Logo team={team} size={22} />
        <span className="mod-bs-team-name">{team}</span>
        <span className="mod-bs-loc-tag">{side === 'away' ? 'AWAY' : 'HOME'}</span>
      </div>
      <div className="mod-bs-table-scroll">
        <table className="mod-bs-table">
          <thead>
            <tr>
              <th className="mod-bs-th mod-bs-th-player">PLAYER</th>
              <th className="mod-bs-th mod-bs-th-num" title="Goals">G</th>
              <th className="mod-bs-th mod-bs-th-num" title="Assists">A</th>
              <th className="mod-bs-th mod-bs-th-num" title="Points">PTS</th>
              <th className="mod-bs-th mod-bs-th-num" title="Shots on Goal">SOG</th>
              <th className="mod-bs-th mod-bs-th-num" title="Checks">CHK</th>
              <th className="mod-bs-th mod-bs-th-num" title="Penalty Minutes">PIM</th>
              <th className="mod-bs-th mod-bs-th-toi" title="Time on Ice">TOI</th>
            </tr>
          </thead>
          <tbody>
            {sortSkaters(skaterList).map((p, i) => {
              const pts = p.points ?? 0;
              return (
                <tr key={p.id ?? i} className={`mod-bs-row${pts > 0 ? ' mod-bs-row-scorer' : ''}`}>
                  <td className="mod-bs-td mod-bs-td-player">
                    <span className="mod-bs-name">
                      {p.player_name}
                    </span>
                  </td>
                  <td className={`mod-bs-td mod-bs-td-num${(p.goals ?? 0) > 0 ? ' mod-bs-g' : ' mod-bs-dim'}`}>{p.goals ?? 0}</td>
                  <td className={`mod-bs-td mod-bs-td-num${(p.assists ?? 0) > 0 ? ' mod-bs-a' : ' mod-bs-dim'}`}>{p.assists ?? 0}</td>
                  <td className={`mod-bs-td mod-bs-td-num mod-bs-pts${pts > 0 ? ' mod-bs-pts-hi' : ' mod-bs-dim'}`}>{pts}</td>
                  <td className="mod-bs-td mod-bs-td-num mod-bs-dim">{p.shots ?? 0}</td>
                  <td className="mod-bs-td mod-bs-td-num mod-bs-dim">{p.chk ?? 0}</td>
                  <td className={`mod-bs-td mod-bs-td-num${(p.pim ?? 0) > 0 ? ' mod-bs-pim' : ' mod-bs-dim'}`}>{p.pim ?? 0}</td>
                  <td className="mod-bs-td mod-bs-td-toi mod-bs-dim">{fmtTOI(p.toi)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {goalieList.length > 0 && (
        <div className="mod-goalie-section">
          <div className="mod-goalie-section-lbl">GOALTENDER</div>
          {goalieList.map((g, i) => {
            const sa = g.shots_against ?? 0;
            const ga = g.goals_against ?? 0;
            const sv = g.saves ?? (sa > 0 ? sa - ga : 0);
            const actualSA = sa > 0 ? sa : (sv + ga);
            const svPct = actualSA > 0 ? (sv / actualSA).toFixed(3).replace(/^0/, '') : '—';
            const isHot = svPct !== '—' && parseFloat('0' + svPct) >= 0.9;
            const isShutout = ga === 0 && actualSA > 0;
            return (
              <div key={g.id ?? i} className={`mod-goalie-row mod-goalie-${side}`}>
                <div className="mod-goalie-name-wrap">
                  <span className="mod-goalie-pos-badge">G</span>
                  <span className="mod-goalie-name">{g.player_name}</span>
                  {isShutout && <span className="mod-goalie-so-badge">SO</span>}
                </div>
                <div className="mod-goalie-stats-row">
                  <div className="mod-goalie-stat"><span className="mod-goalie-stat-val">{sv}</span><span className="mod-goalie-stat-lbl">SV</span></div>
                  <div className="mod-goalie-stat"><span className="mod-goalie-stat-val">{actualSA}</span><span className="mod-goalie-stat-lbl">SA</span></div>
                  <div className="mod-goalie-stat"><span className="mod-goalie-stat-val mod-bs-pim-light">{ga}</span><span className="mod-goalie-stat-lbl">GA</span></div>
                  <div className="mod-goalie-stat"><span className={`mod-goalie-stat-val mod-goalie-svpct${isHot ? ' mod-goalie-hot' : ''}`}>{svPct}</span><span className="mod-goalie-stat-lbl">SV%</span></div>
                  <div className="mod-goalie-stat"><span className="mod-goalie-stat-val mod-bs-dim">{fmtTOI(g.toi)}</span><span className="mod-goalie-stat-lbl">TOI</span></div>
                  {(g.assists ?? 0) > 0 && (
                    <div className="mod-goalie-stat"><span className="mod-goalie-stat-val mod-bs-a">{g.assists}</span><span className="mod-goalie-stat-lbl">A</span></div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div className="mod-tab-content mod-bs-content">
      <div className="mod-bs-grid">
        <TeamBlock skaterList={awaySkaters} goalieList={awayGoalies} team={awayTeam} side="away" />
        <div className="mod-bs-divider" />
        <TeamBlock skaterList={homeSkaters} goalieList={homeGoalies} team={homeTeam} side="home" />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB: SCORING
// ═══════════════════════════════════════════════════════════════════
function ScoringTab({ stats, plays, awayTeam, homeTeam, seasonGoalsBefore }) {
  // seasonGoalsBefore: { [player_name]: goalsBeforeThisGame }
  const awayScore = stats?.away_score ?? 0;
  const homeScore = stats?.home_score ?? 0;
  const awayWon   = awayScore > homeScore;

  // ── Identify GWG ──────────────────────────────────────────────
  let gwgId = null;
  if (plays && plays.length > 0) {
    const loserFinal    = awayWon ? homeScore : awayScore;
    const gwgThreshold  = loserFinal + 1;
    let rAway = 0, rHome = 0;
    for (const p of plays) {
      if (p.g_team === awayTeam) rAway++; else rHome++;
      const winnerCurrent = awayWon ? rAway : rHome;
      if (winnerCurrent === gwgThreshold && gwgId === null) {
        gwgId = p.id;
        break;
      }
    }
  }

  const hasOT = stats?.ot_flag === 1 || (stats?.away_ot_g ?? 0) > 0 || (stats?.home_ot_g ?? 0) > 0;
  const periods = stats ? [
    { lbl:'1ST', ag:stats.away_1p_g, hg:stats.home_1p_g, as:stats.away_1p_s, hs:stats.home_1p_s },
    { lbl:'2ND', ag:stats.away_2p_g, hg:stats.home_2p_g, as:stats.away_2p_s, hs:stats.home_2p_s },
    { lbl:'3RD', ag:stats.away_3p_g, hg:stats.home_3p_g, as:stats.away_3p_s, hs:stats.home_3p_s },
    ...(hasOT ? [{ lbl:'OT', ag:stats.away_ot_g, hg:stats.home_ot_g, as:stats.away_ot_s, hs:stats.home_ot_s }] : []),
  ] : [];

  // Build goal log:
  // - seasonGoalsBefore[name] = goals scored in earlier games this season
  // - inGameCount tracks goals scored so far in this game (per player)
  // - seasonTotal = seasonGoalsBefore[name] + inGameCount  → shown as (N)
  // - inGameCount itself → shown as ×N badge (only when > 1)
  let rAway = 0, rHome = 0;
  const inGameCount = {}; // goals in THIS game per player (running)
  const grouped = {};

  (plays || []).forEach(p => {
    if (p.g_team === awayTeam) rAway++; else rHome++;

    const name = p.goal_player_name;
    if (name) inGameCount[name] = (inGameCount[name] || 0) + 1;

    const priorSeasonGoals = (name && seasonGoalsBefore) ? (seasonGoalsBefore[name] ?? 0) : 0;
    const seasonTotal = name ? priorSeasonGoals + (inGameCount[name] || 0) : null;

    const key = p.period;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      ...p,
      rAway,
      rHome,
      inGameCount: name ? inGameCount[name] : null, // how many in this game so far (for ×N badge)
      seasonTotal,                                   // cumulative season goals at time of this goal
    });
  });

  const periodNums = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  return (
    <div className="mod-tab-content">
      {/* Period grid */}
      {stats && (
        <div className="mod-period-grid-wrap">
          <table className="mod-pt">
            <thead>
              <tr>
                <th className="mod-pt-th mod-pt-team-col" />
                {periods.map(p => <th key={p.lbl} className="mod-pt-th mod-pt-p-col">{p.lbl}</th>)}
                <th className="mod-pt-th mod-pt-tot-col">TOT</th>
              </tr>
            </thead>
            <tbody>
              <tr className="mod-pt-team-row">
                <td className="mod-pt-name-cell">
                  <div className="mod-pt-team-info">
                    <Logo team={awayTeam} size={20} />
                    <span className="mod-pt-code mod-pt-away-code">{awayTeam}</span>
                    <span className="mod-pt-loc">AWAY</span>
                  </div>
                </td>
                {periods.map(p => <td key={p.lbl} className="mod-pt-cell">{p.ag ?? 0}</td>)}
                <td className="mod-pt-cell mod-pt-tot mod-pt-away-tot">{stats.away_score}</td>
              </tr>
              <tr className="mod-pt-sog-row">
                <td className="mod-pt-sog-lbl">SHOTS</td>
                {periods.map(p => <td key={p.lbl} className="mod-pt-sog">{p.as ?? 0}</td>)}
                <td className="mod-pt-sog mod-pt-sog-tot">{stats.away_shots}</td>
              </tr>
              <tr className="mod-pt-spacer"><td colSpan={periods.length + 2} /></tr>
              <tr className="mod-pt-team-row">
                <td className="mod-pt-name-cell">
                  <div className="mod-pt-team-info">
                    <Logo team={homeTeam} size={20} />
                    <span className="mod-pt-code mod-pt-home-code">{homeTeam}</span>
                    <span className="mod-pt-loc">HOME</span>
                  </div>
                </td>
                {periods.map(p => <td key={p.lbl} className="mod-pt-cell">{p.hg ?? 0}</td>)}
                <td className="mod-pt-cell mod-pt-tot mod-pt-home-tot">{stats.home_score}</td>
              </tr>
              <tr className="mod-pt-sog-row">
                <td className="mod-pt-sog-lbl">SHOTS</td>
                {periods.map(p => <td key={p.lbl} className="mod-pt-sog">{p.hs ?? 0}</td>)}
                <td className="mod-pt-sog mod-pt-sog-tot">{stats.home_shots}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Goal log */}
      {plays && plays.length > 0 ? (
        <div className="mod-goal-log">
          <div className="mod-scoring-section-lbl">GOAL LOG</div>
          {periodNums.map(per => (
            <div key={per} className="mod-period-block">
              <div className="mod-per-divider">
                <div className="mod-per-line" />
                <span className="mod-per-label">{PERIOD_LABEL[per] ?? `P${per}`} PERIOD</span>
                <div className="mod-per-line" />
              </div>
              {grouped[per].map(p => {
                const isAway     = p.g_team === awayTeam;
                const tag        = TYPE_TAG[p.score_type];
                const isGWG      = p.id === gwgId;
                const isMulti    = p.inGameCount > 1; // ×N badge: scored 2+ in this game

                return (
                  <div key={p.id} className={`mod-goal-row mod-goal-${isAway ? 'away' : 'home'}${isGWG ? ' mod-goal-gwg' : ''}`}>
                    {/* Time + type tags — stacked vertically */}
                    <div className="mod-goal-time-col">
                      <span className="mod-goal-time">{p.g_time}</span>
                      <div className="mod-goal-tags">
                        {tag && <span className={`mod-goal-tag mod-goal-tag-${p.score_type}`}>{tag}</span>}
                        {isGWG && <span className="mod-goal-tag mod-goal-tag-GWG">GWG</span>}
                      </div>
                    </div>

                    {/* Team logo */}
                    <div className="mod-goal-logo-wrap">
                      <Logo team={p.g_team} size={38} />
                    </div>

                    {/* Scorer + season cumulative total in parens + ×N in-game badge */}
                    <div className="mod-goal-text">
                      <div className="mod-goal-scorer-line">
                        <span className="mod-goal-scorer">
                          {p.goal_player_name}
                          {p.seasonTotal != null && (
                            <span className="mod-goal-season-total"> ({p.seasonTotal})</span>
                          )}
                        </span>
                        {isMulti && (
                          <span className="mod-goal-multi" title={`Goal #${p.inGameCount} this game`}>×{p.inGameCount}</span>
                        )}
                      </div>
                      <div className="mod-goal-assists">
                        {p.assist_primary_name || p.assist_secondary_name ? (
                          <>
                            <span className="mod-goal-a-lbl">Assists: </span>
                            {[p.assist_primary_name, p.assist_secondary_name].filter(Boolean).map((n, i) => (
                              <span key={i}>
                                {i > 0 && <span className="mod-goal-sep"> · </span>}
                                <span className="mod-goal-a-name">{n}</span>
                              </span>
                            ))}
                          </>
                        ) : (
                          <span className="mod-goal-unassisted">Unassisted</span>
                        )}
                      </div>
                    </div>

                    {/* Running score */}
                    <div className="mod-goal-running">
                      <span className={`mod-rs-num${isAway ? ' mod-rs-away' : ''}`}>{p.rAway}</span>
                      <span className="mod-rs-dash">–</span>
                      <span className={`mod-rs-num${!isAway ? ' mod-rs-home' : ''}`}>{p.rHome}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <div className="mod-empty-state">
          <div style={{ fontSize: '2.5rem', opacity: 0.2 }}>🏒</div>
          <div>NO SCORING DATA</div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// TAB: TEAM STATS
// ═══════════════════════════════════════════════════════════════════
function TeamStatsTab({ stats, awayTeam, homeTeam }) {
  if (!stats) return (
    <div className="mod-empty-state">
      <div style={{ fontSize: '2.5rem', opacity: 0.2 }}>📊</div>
      <div>NO TEAM STATS AVAILABLE</div>
    </div>
  );
  const a = k => stats[`away_${k}`] ?? '—';
  const h = k => stats[`home_${k}`] ?? '—';
  const awayPP = stats.away_pp_amt > 0 ? `${Math.round((stats.away_pp_g / stats.away_pp_amt) * 100)}%` : '0%';
  const homePP = stats.home_pp_amt > 0 ? `${Math.round((stats.home_pp_g / stats.home_pp_amt) * 100)}%` : '0%';
  const awayPass = stats.away_pass_attempts > 0 ? `${Math.round((stats.away_pass_complete / stats.away_pass_attempts) * 100)}%` : '—';
  const homePass = stats.home_pass_attempts > 0 ? `${Math.round((stats.home_pass_complete / stats.home_pass_attempts) * 100)}%` : '—';

  return (
    <div className="mod-tab-content mod-ts-content">
      <div className="mod-ts-cols">
        <div className="mod-ts-col">
          <div className="mod-ts-sec">
            <div className="mod-section-title">SHOOTING</div>
            <StatBar label="SHOTS ON GOAL"         awayVal={a('shots')}          homeVal={h('shots')} />
            <StatBar label="EXPECTED GOALS (xG)"   awayVal={a('1xg')}            homeVal={h('1xg')} />
            <StatBar label="EXPECTED ASSISTS (xA)" awayVal={a('1xa')}            homeVal={h('1xa')} />
            <StatBar label="BREAKAWAY ATTEMPTS"    awayVal={a('break_attempts')} homeVal={h('break_attempts')} />
            <StatBar label="BREAKAWAY GOALS"       awayVal={a('break_goals')}    homeVal={h('break_goals')} />
          </div>
          <div className="mod-ts-sec">
            <div className="mod-section-title">POSSESSION</div>
            <StatBar label="ATTACK TIME"           awayVal={fmtTime(a('attack'))}    homeVal={fmtTime(h('attack'))} />
            <StatBar label="FACEOFFS WON"          awayVal={a('fow')}                homeVal={h('fow')} />
            <StatBar label="PASS COMPLETION %"     awayVal={awayPass}                homeVal={homePass} />
            <StatBar label="PASSES COMPLETED"      awayVal={a('pass_complete')}      homeVal={h('pass_complete')} />
            <StatBar label="PASS ATTEMPTS"         awayVal={a('pass_attempts')}      homeVal={h('pass_attempts')} />
            <StatBar label="CHECKS"                awayVal={a('chk')}                homeVal={h('chk')} />
          </div>
        </div>
        <div className="mod-ts-col">
          <div className="mod-ts-sec">
            <div className="mod-section-title">SPECIAL TEAMS</div>
            <StatBar label="POWER PLAY (G/OPP)"   awayVal={`${a('pp_g')}/${a('pp_amt')}`} homeVal={`${h('pp_g')}/${h('pp_amt')}`} />
            <StatBar label="PP %"                  awayVal={awayPP}              homeVal={homePP} />
            <StatBar label="PP SHOTS"              awayVal={a('pp_shots')}       homeVal={h('pp_shots')} />
            <StatBar label="PP TIME"               awayVal={fmtTime(a('pp_mins'))} homeVal={fmtTime(h('pp_mins'))} />
            <StatBar label="SHORTHANDED GOALS"     awayVal={a('shg')}            homeVal={h('shg')} />
            {(stats.away_ps > 0 || stats.home_ps > 0) && (
              <StatBar label="SHOOTOUT (G/ATT)"    awayVal={`${a('psg')}/${a('ps')}`} homeVal={`${h('psg')}/${h('ps')}`} />
            )}
          </div>
          <div className="mod-ts-sec">
            <div className="mod-section-title">DISCIPLINE</div>
            <StatBar label="PENALTIES"             awayVal={a('pens')} homeVal={h('pens')} lowerWins />
            <StatBar label="PENALTY MINUTES"       awayVal={a('pim')}  homeVal={h('pim')}  lowerWins />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN MODAL
// ═══════════════════════════════════════════════════════════════════
export default function GameOverviewModal({ game, onClose }) {
  const [activeTab, setActiveTab] = useState('scoring');
  const [stats,              setStats]             = useState(null);
  const [plays,              setPlays]             = useState(null);
  const [skaters,            setSkaters]           = useState(null);
  const [goalies,            setGoalies]           = useState(null);
  const [seasonGoalsBefore,  setSeasonGoalsBefore] = useState(null);
  const [loading,            setLoading]           = useState(true);

  const { id: gameId, away, home, score_away, score_home, ot, isPlayoff, round, game_number, season } = game;
  const isOT    = Number(ot) === 1;
  const awayWon = score_away > score_home;
  const homeWon = score_home > score_away;

  // ESC + scroll lock
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
  }, [onClose]);

  // Parallel fetch — 5 queries
  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    setLoading(true);

    const col      = isPlayoff ? 'playoff_game_id' : 'game_id';
    const id       = Number(gameId);
    // Season filter: prefer explicit season prop on game object, fall back to
    // querying all rows with game_id < current and same season column if present.
    // We use two strategies depending on whether the game row carries a season field:
    //   Strategy A (season known): filter by season AND game_id < id
    //   Strategy B (season unknown): filter by game_id < id only
    // Both count goals per goal_player_name from game_raw_scoring.
    const hasSeason = season != null;

    // Build the prior-games scoring query.
    // We select only the scorer name column; we'll count client-side.
    let priorQuery = supabase
      .from('game_raw_scoring')
      .select('goal_player_name')
      .eq('season', game.lg)           // ← use game.lg directly, always
      .lt(col, id)
      .not('goal_player_name', 'is', null);

    if (isPlayoff) {
      priorQuery = priorQuery.not('playoff_game_id', 'is', null);
    } else {
      priorQuery = priorQuery.is('playoff_game_id', null);  // season only
    }

    Promise.all([
      supabase.from('game_stats_team')   .select('*').eq(col, id).limit(1),
      supabase.from('game_raw_scoring')  .select('*').eq(col, id).order('goal_num', { ascending: true }),
      supabase.from('game_stats_skaters').select('*').eq(col, id),
      supabase.from('game_stats_goalies').select('*').eq(col, id),
      priorQuery,
    ]).then(([tRes, pRes, sRes, gRes, priorRes]) => {
      if (cancelled) return;

      // Build { playerName -> goalCountBeforeThisGame } map
      const goalsBeforeMap = {};
      (priorRes.data || []).forEach(row => {
        const name = row.goal_player_name;
        if (name) goalsBeforeMap[name] = (goalsBeforeMap[name] || 0) + 1;
      });

      setStats(tRes.data?.[0] ?? null);
      setPlays(pRes.data   ?? []);
      setSkaters(sRes.data ?? []);
      setGoalies(gRes.data ?? []);
      setSeasonGoalsBefore(goalsBeforeMap);
      setLoading(false);
    }).catch(err => {
      console.error('Modal fetch:', err);
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [gameId, isPlayoff, season]);

  const TABS = [
    { id: 'scoring',   label: 'SCORING',    icon: '🏒' },
    { id: 'boxscore',  label: 'BOX SCORE',  icon: '📋' },
    { id: 'teamstats', label: 'TEAM STATS', icon: '📊' },
  ];

  const modal = (
    <>
      <style>{`
        /* ══ OVERLAY ══════════════════════════════════════════ */
        .mod-overlay {
          position:fixed;inset:0;z-index:9999;
          background:rgba(0,0,10,.88);
          backdrop-filter:blur(14px) saturate(.55);
          display:flex;align-items:flex-start;justify-content:center;
          padding:1.5rem;overflow-y:auto;
          animation:modFade .2s ease;
        }
        @keyframes modFade{from{opacity:0}to{opacity:1}}

        .mod-shell {
          width:100%;max-width:1120px;
          background:#04040f;
          border:1px solid rgba(255,255,255,.09);
          border-radius:16px;overflow:hidden;
          box-shadow:0 0 0 1px rgba(255,215,0,.06),0 40px 90px rgba(0,0,0,.85),0 0 140px rgba(255,140,0,.05);
          animation:modSlide .26s cubic-bezier(.34,1.56,.64,1);
          position:relative;
        }
        @keyframes modSlide{
          from{opacity:0;transform:translateY(28px) scale(.97)}
          to  {opacity:1;transform:translateY(0)    scale(1)}
        }

        /* ══ HERO ═════════════════════════════════════════════ */
        .mod-hero{position:relative;overflow:hidden;background:#000;}
        .mod-hero-bg{
          position:absolute;inset:0;z-index:0;
          background:
            radial-gradient(ellipse 70% 120% at 20% 50%,rgba(135,206,235,.1) 0%,transparent 60%),
            radial-gradient(ellipse 70% 120% at 80% 50%,rgba(255,140,0,.1) 0%,transparent 60%),
            repeating-linear-gradient(0deg,rgba(255,255,255,.012) 0,rgba(255,255,255,.012) 1px,transparent 1px,transparent 6px);
        }
        .mod-hero-scan{
          position:absolute;inset:0;z-index:1;pointer-events:none;
          background:repeating-linear-gradient(0deg,transparent 0,transparent 3px,rgba(0,0,0,.1) 3px,rgba(0,0,0,.1) 4px);
        }
        .mod-hero-inner{
          position:relative;z-index:2;
          display:grid;grid-template-columns:1fr auto 1fr;
          align-items:center;gap:1.5rem;
          padding:2rem 2rem 1.6rem;
        }
        .mod-hero-team{display:flex;flex-direction:column;align-items:center;gap:.6rem;}
        .mod-hero-logo-away{filter:drop-shadow(0 0 28px rgba(135,206,235,.4));}
        .mod-hero-logo-home{filter:drop-shadow(0 0 28px rgba(255,140,0,.4));}
        .mod-hero-code{font-family:'Press Start 2P',monospace;font-size:.9rem;letter-spacing:3px;font-weight:bold;}
        .mod-hero-code-away{color:#87CEEB;text-shadow:0 0 18px rgba(135,206,235,.65);}
        .mod-hero-code-home{color:#FF8C00;text-shadow:0 0 18px rgba(255,140,0,.65);}
        .mod-hero-tag{font-family:'Press Start 2P',monospace;font-size:.38rem;padding:.2rem .42rem;border-radius:4px;letter-spacing:1.5px;}
        .mod-hero-tag-win {color:#00CC55;border:1px solid rgba(0,204,85,.5);background:rgba(0,204,85,.1);}
        .mod-hero-tag-loss{color:rgba(255,255,255,.28);border:1px solid rgba(255,255,255,.1);}
        .mod-hero-center{display:flex;flex-direction:column;align-items:center;gap:.5rem;}
        .mod-hero-score{display:flex;align-items:center;gap:1rem;}
        .mod-hero-snum{font-family:'VT323',monospace;font-size:6rem;line-height:1;color:rgba(255,255,255,.2);min-width:52px;text-align:center;}
        .mod-hero-snum-win{color:#FFD700;text-shadow:0 0 32px rgba(255,215,0,.55),0 0 70px rgba(255,215,0,.18);}
        .mod-hero-sdash{font-family:'VT323',monospace;font-size:3rem;color:rgba(255,255,255,.12);}
        .mod-hero-ot{font-family:'Press Start 2P',monospace;font-size:.42rem;color:#FF8C00;border:1px solid rgba(255,140,0,.5);background:rgba(255,140,0,.1);padding:.2rem .5rem;border-radius:4px;}
        .mod-hero-playoff{font-family:'Press Start 2P',monospace;font-size:.38rem;color:rgba(255,255,255,.3);letter-spacing:1.5px;}

        .mod-close{
          position:absolute;top:1rem;right:1rem;z-index:10;
          width:36px;height:36px;
          background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
          border-radius:8px;color:rgba(255,255,255,.45);
          cursor:pointer;display:flex;align-items:center;justify-content:center;
          font-size:1rem;line-height:1;transition:all .15s;
        }
        .mod-close:hover{background:rgba(255,68,68,.15);border-color:rgba(255,68,68,.4);color:#FF4444;}

        /* ══ TABS ═════════════════════════════════════════════ */
        .mod-tabs{
          display:flex;
          border-bottom:2px solid rgba(255,255,255,.1);
          background:rgba(0,0,0,.7);
          position:sticky;top:0;z-index:5;
        }
        .mod-tab-btn{
          flex:1;
          padding:.9rem .5rem .75rem;
          font-family:'Press Start 2P',monospace;font-size:.48rem;
          letter-spacing:1.5px;
          color:rgba(255,255,255,.55);
          background:rgba(255,255,255,.03);
          border:none;
          border-bottom:3px solid transparent;
          border-right:1px solid rgba(255,255,255,.06);
          cursor:pointer;
          transition:all .18s;
          display:flex;flex-direction:column;align-items:center;gap:.3rem;
        }
        .mod-tab-btn:last-child{border-right:none;}
        .mod-tab-icon{font-size:.85rem;line-height:1;opacity:.55;transition:opacity .18s;}
        .mod-tab-btn:hover{color:rgba(255,255,255,.85);background:rgba(255,255,255,.07);}
        .mod-tab-btn:hover .mod-tab-icon{opacity:.85;}
        .mod-tab-btn.active{
          color:#FFD700;
          background:rgba(255,215,0,.08);
          border-bottom:3px solid #FFD700;
          text-shadow:0 0 12px rgba(255,215,0,.5);
        }
        .mod-tab-btn.active .mod-tab-icon{opacity:1;}

        /* ══ LOADING / EMPTY ══════════════════════════════════ */
        .mod-loading{display:flex;gap:8px;align-items:center;justify-content:center;padding:5rem;}
        .mod-dot{display:inline-block;width:8px;height:8px;border-radius:50%;animation:modDot 1.2s ease-in-out infinite;}
        .mod-dot:nth-child(1){background:#87CEEB;}
        .mod-dot:nth-child(2){background:#FFD700;animation-delay:.15s;}
        .mod-dot:nth-child(3){background:#FF8C00;animation-delay:.3s;}
        @keyframes modDot{0%,100%{opacity:.15;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
        .mod-empty-state{
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          gap:1rem;padding:5rem 2rem;
          font-family:'Press Start 2P',monospace;font-size:.6rem;
          color:rgba(255,255,255,.18);letter-spacing:2px;
        }

        /* ══ SECTION LABELS ═══════════════════════════════════ */
        .mod-section-title{
          font-family:'Press Start 2P',monospace;font-size:.58rem;
          letter-spacing:2px;color:#FF8C00;
          padding:1.1rem 1.4rem .55rem;
          border-bottom:1px solid rgba(255,140,0,.16);
          text-shadow:0 0 10px rgba(255,140,0,.38);
        }
        .mod-scoring-section-lbl{
          font-family:'Press Start 2P',monospace;font-size:.58rem;
          letter-spacing:2px;color:#FF8C00;
          padding:.6rem 1.4rem .45rem;
          border-top:1px solid rgba(255,255,255,.06);
          border-bottom:1px solid rgba(255,140,0,.16);
          text-shadow:0 0 10px rgba(255,140,0,.38);
        }

        /* ══ BOX SCORE ════════════════════════════════════════ */
        .mod-bs-content{padding-bottom:2rem;}
        .mod-bs-grid{display:grid;grid-template-columns:1fr 1px 1fr;}
        @media(max-width:800px){.mod-bs-grid{grid-template-columns:1fr;}.mod-bs-divider{display:none;}}
        .mod-bs-divider{background:rgba(255,255,255,.07);width:1px;align-self:stretch;}
        .mod-bs-block{display:flex;flex-direction:column;min-width:0;}
        .mod-bs-team-hdr{
          display:flex;align-items:center;gap:.6rem;
          padding:.85rem 1.25rem;
          font-family:'Press Start 2P',monospace;font-size:.68rem;letter-spacing:2px;font-weight:bold;
          border-bottom:2px solid transparent;
        }
        .mod-bs-hdr-away{color:#87CEEB;background:rgba(135,206,235,.055);border-bottom-color:rgba(135,206,235,.28);text-shadow:0 0 12px rgba(135,206,235,.5);}
        .mod-bs-hdr-home{color:#FF8C00;background:rgba(255,140,0,.055);border-bottom-color:rgba(255,140,0,.28);text-shadow:0 0 12px rgba(255,140,0,.5);}
        .mod-bs-team-name{flex:1;}
        .mod-bs-loc-tag{font-size:.3rem;color:rgba(255,255,255,.28);letter-spacing:1px;}
        .mod-bs-table-scroll{overflow-x:auto;}
        .mod-bs-table{width:100%;border-collapse:collapse;}
        .mod-bs-th{
          font-family:'Press Start 2P',monospace;font-size:.36rem;
          color:rgba(255,255,255,.32);padding:.42rem .45rem;text-align:center;
          border-bottom:1px solid rgba(255,255,255,.07);
          letter-spacing:.8px;white-space:nowrap;
          background:rgba(0,0,0,.28);position:sticky;top:0;z-index:1;
        }
        .mod-bs-th-player{text-align:left;padding-left:1.2rem;min-width:130px;}
        .mod-bs-th-num{min-width:34px;}
        .mod-bs-th-toi{min-width:50px;}
        .mod-bs-row{transition:background .1s;border-top:1px solid rgba(255,255,255,.035);}
        .mod-bs-row:hover{background:rgba(255,255,255,.025);}
        .mod-bs-row-scorer{background:rgba(255,215,0,.03);}
        .mod-bs-td{font-family:'VT323',monospace;font-size:1.45rem;text-align:center;padding:.32rem .45rem;color:rgba(255,255,255,.6);line-height:1;}
        .mod-bs-td-player{text-align:left;padding-left:1.2rem;display:flex;align-items:center;gap:.4rem;}
        .mod-bs-td-toi{font-size:1.2rem;}
        .mod-bs-name{font-size:1.38rem;color:rgba(255,255,255,.82);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;display:inline-flex;align-items:center;gap:.3rem;}
        .mod-bs-dim{color:rgba(255,255,255,.3);}
        .mod-bs-g  {color:#FFD700;text-shadow:0 0 10px rgba(255,215,0,.45);font-size:1.6rem;}
        .mod-bs-a  {color:#87CEEB;text-shadow:0 0 8px rgba(135,206,235,.35);}
        .mod-bs-pts{font-size:1.6rem;}
        .mod-bs-pts-hi{color:#FFD700;text-shadow:0 0 14px rgba(255,215,0,.5);}
        .mod-bs-pim{color:rgba(255,80,80,.75);}
        .mod-bs-pim-light{color:rgba(255,80,80,.6);}
        .mod-goalie-section{border-top:1px solid rgba(255,255,255,.07);background:rgba(0,0,0,.22);}
        .mod-goalie-section-lbl{font-family:'Press Start 2P',monospace;font-size:.36rem;letter-spacing:2px;color:rgba(255,255,255,.28);padding:.6rem 1.25rem .3rem;}
        .mod-goalie-row{display:flex;align-items:center;justify-content:space-between;padding:.72rem 1.25rem;border-top:1px solid rgba(255,255,255,.04);}
        .mod-goalie-away{border-left:3px solid rgba(135,206,235,.4);}
        .mod-goalie-home{border-left:3px solid rgba(255,140,0,.4);}
        .mod-goalie-name-wrap{display:flex;align-items:center;gap:.5rem;}
        .mod-goalie-pos-badge{font-family:'Press Start 2P',monospace;font-size:.3rem;color:rgba(255,255,255,.28);background:rgba(255,255,255,.08);padding:.1rem .28rem;border-radius:3px;}
        .mod-goalie-name{font-family:'VT323',monospace;font-size:1.45rem;color:rgba(255,255,255,.82);}
        .mod-goalie-so-badge{font-family:'Press Start 2P',monospace;font-size:.3rem;color:#FFD700;border:1px solid rgba(255,215,0,.5);background:rgba(255,215,0,.1);padding:.1rem .25rem;border-radius:3px;letter-spacing:1px;}
        .mod-goalie-stats-row{display:flex;gap:1.1rem;align-items:flex-end;}
        .mod-goalie-stat{display:flex;flex-direction:column;align-items:center;gap:.1rem;}
        .mod-goalie-stat-val{font-family:'VT323',monospace;font-size:1.7rem;line-height:1;color:rgba(255,255,255,.82);}
        .mod-goalie-stat-lbl{font-family:'Press Start 2P',monospace;font-size:.3rem;color:rgba(255,255,255,.28);letter-spacing:.8px;}
        .mod-goalie-svpct{font-size:1.5rem;}
        .mod-goalie-hot{color:#00CC55;text-shadow:0 0 12px rgba(0,204,85,.5);}

        /* ══ SCORING TAB ══════════════════════════════════════ */
        .mod-tab-content{min-height:200px;}
        .mod-period-grid-wrap{padding:.7rem 1.4rem .6rem;overflow-x:auto;border-bottom:1px solid rgba(255,255,255,.06);}
        .mod-pt{border-collapse:collapse;width:100%;}
        .mod-pt-th{font-family:'Press Start 2P',monospace;font-size:.4rem;color:rgba(255,255,255,.38);padding:.2rem .55rem;text-align:center;letter-spacing:1px;}
        .mod-pt-team-col{text-align:left;min-width:130px;}
        .mod-pt-p-col{min-width:50px;}
        .mod-pt-tot-col{color:rgba(255,215,0,.6);}
        .mod-pt-team-row td{border-top:1px solid rgba(255,255,255,.06);padding:.28rem .55rem;}
        .mod-pt-name-cell{padding-left:0!important;}
        .mod-pt-team-info{display:flex;align-items:center;gap:.48rem;}
        .mod-pt-code{font-family:'Press Start 2P',monospace;font-size:.7rem;font-weight:bold;letter-spacing:2px;}
        .mod-pt-away-code{color:#87CEEB;text-shadow:0 0 8px rgba(135,206,235,.5);}
        .mod-pt-home-code{color:#FF8C00;text-shadow:0 0 8px rgba(255,140,0,.5);}
        .mod-pt-loc{font-family:'Press Start 2P',monospace;font-size:.28rem;color:rgba(255,255,255,.28);}
        .mod-pt-cell{font-family:'VT323',monospace;font-size:1.9rem;line-height:1;text-align:center;color:rgba(255,255,255,.82);padding:.1rem .4rem;}
        .mod-pt-tot{font-size:2.3rem;font-weight:bold;}
        .mod-pt-away-tot{color:#87CEEB;text-shadow:0 0 12px rgba(135,206,235,.5);}
        .mod-pt-home-tot{color:#FF8C00;text-shadow:0 0 12px rgba(255,140,0,.5);}
        .mod-pt-sog-row td{border-bottom:1px solid rgba(255,255,255,.04);padding:.04rem .55rem .16rem;}
        .mod-pt-sog-lbl{font-family:'Press Start 2P',monospace;font-size:.34rem;color:rgba(255,255,255,.28);letter-spacing:1px;}
        .mod-pt-sog{font-family:'VT323',monospace;font-size:1.15rem;color:rgba(255,255,255,.28);text-align:center;}
        .mod-pt-sog-tot{color:rgba(255,255,255,.38);}
        .mod-pt-spacer td{height:6px;}

        .mod-per-divider{display:flex;align-items:center;gap:.7rem;padding:.35rem 1.4rem .25rem;}
        .mod-per-line{flex:1;height:1px;background:rgba(255,255,255,.08);}
        .mod-per-label{font-family:'Press Start 2P',monospace;font-size:.46rem;color:rgba(255,255,255,.38);letter-spacing:2px;white-space:nowrap;}

        /* Goal rows */
        .mod-goal-row{
          display:grid;grid-template-columns:64px 50px 1fr auto;
          align-items:center;gap:.55rem;
          padding:.4rem 1.4rem;
          border-bottom:1px solid rgba(255,255,255,.03);
          transition:background .1s;
          position:relative;
        }
        .mod-goal-row:last-child{border-bottom:none;}
        .mod-goal-row:hover{background:rgba(255,255,255,.025);}
        .mod-goal-away{border-left:3px solid rgba(135,206,235,.5);}
        .mod-goal-home{border-left:3px solid rgba(255,140,0,.5);}

        .mod-goal-gwg{
          background:rgba(255,215,0,.04)!important;
          border-left-color:#FFD700!important;
        }
        .mod-goal-gwg::before{
          content:'';position:absolute;inset:0;pointer-events:none;
          background:linear-gradient(90deg,rgba(255,215,0,.06) 0%,transparent 55%);
        }

        .mod-goal-time-col{display:flex;flex-direction:column;align-items:center;gap:.22rem;}
        .mod-goal-time{font-family:'VT323',monospace;font-size:1.5rem;line-height:1;color:rgba(255,255,255,.78);}
        .mod-goal-tags{display:flex;flex-direction:column;align-items:center;gap:.18rem;}

        .mod-goal-tag{
          font-family:'Press Start 2P',monospace;
          padding:.08rem .22rem;
          border-radius:3px;
          letter-spacing:.8px;
          line-height:1.3;
          display:inline-block;
          text-align:center;
        }
        .mod-goal-tag-PP {font-size:.28rem;color:#FFD700;border:1px solid rgba(255,215,0,.4);background:rgba(255,215,0,.1);}
        .mod-goal-tag-SH {font-size:.28rem;color:#87CEEB;border:1px solid rgba(135,206,235,.4);background:rgba(135,206,235,.1);}
        .mod-goal-tag-EN {font-size:.28rem;color:#FF4455;border:1px solid rgba(255,68,85,.4);background:rgba(255,68,85,.1);}
        .mod-goal-tag-PS {font-size:.28rem;color:#CC44FF;border:1px solid rgba(204,68,255,.4);background:rgba(204,68,255,.1);}
        .mod-goal-tag-GWG{
          font-size:.42rem;
          color:#000;
          background:#FFD700;
          border:1px solid rgba(255,215,0,.9);
          letter-spacing:1px;
          font-weight:bold;
          padding:.1rem .28rem;
          text-shadow:none;
          box-shadow:0 0 8px rgba(255,215,0,.5);
        }

        .mod-goal-logo-wrap{
          width:42px;height:42px;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          background:rgba(0,0,0,.4);border-radius:7px;padding:3px;
          border:1px solid rgba(255,255,255,.07);
        }
        .mod-goal-away .mod-goal-logo-wrap{border-color:rgba(135,206,235,.2);box-shadow:0 0 12px rgba(135,206,235,.1);}
        .mod-goal-home .mod-goal-logo-wrap{border-color:rgba(255,140,0,.2);box-shadow:0 0 12px rgba(255,140,0,.1);}

        .mod-goal-text{display:flex;flex-direction:column;gap:.14rem;min-width:0;}
        .mod-goal-scorer-line{display:flex;align-items:baseline;gap:.35rem;flex-wrap:nowrap;min-width:0;}
        .mod-goal-scorer{
          font-family:'VT323',monospace;font-size:1.55rem;line-height:1.1;font-weight:bold;
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        }
        .mod-goal-away .mod-goal-scorer{color:#87CEEB;text-shadow:0 0 8px rgba(135,206,235,.4);}
        .mod-goal-home .mod-goal-scorer{color:#FF8C00;text-shadow:0 0 8px rgba(255,140,0,.4);}

        /* Season cumulative goal count in parens — dim, same VT323 size */
        .mod-goal-season-total{
          font-family:'VT323',monospace;
          font-size:1.4rem;
          color:rgba(255,255,255,.38);
          flex-shrink:0;
        }

        /* ×N in-game multi-goal badge */
        .mod-goal-multi{
          font-family:'Press Start 2P',monospace;font-size:.32rem;
          color:#FFD700;background:rgba(255,215,0,.12);
          border:1px solid rgba(255,215,0,.35);border-radius:4px;
          padding:.1rem .25rem;letter-spacing:1px;flex-shrink:0;
        }

        .mod-goal-assists{font-family:'VT323',monospace;font-size:1.05rem;color:rgba(255,255,255,.42);display:flex;flex-wrap:wrap;gap:.15rem;}
        .mod-goal-a-lbl{color:rgba(255,255,255,.25);font-size:1rem;}
        .mod-goal-a-name{color:rgba(255,255,255,.68);}
        .mod-goal-sep{color:rgba(255,255,255,.2);}
        .mod-goal-unassisted{color:rgba(255,255,255,.25);font-style:italic;}

        .mod-goal-running{
          display:flex;align-items:center;gap:.18rem;flex-shrink:0;
          background:rgba(0,0,0,.4);border-radius:8px;
          padding:.28rem .48rem;border:1px solid rgba(255,255,255,.07);
        }
        .mod-rs-num{font-family:'VT323',monospace;font-size:1.85rem;line-height:1;color:rgba(255,255,255,.2);min-width:18px;text-align:center;}
        .mod-rs-away{color:#87CEEB;text-shadow:0 0 10px rgba(135,206,235,.55);}
        .mod-rs-home{color:#FF8C00;text-shadow:0 0 10px rgba(255,140,0,.55);}
        .mod-rs-dash{font-family:'VT323',monospace;font-size:1.25rem;color:rgba(255,255,255,.12);}

        /* ══ TEAM STATS TAB ═══════════════════════════════════ */
        .mod-ts-content{padding-bottom:1rem;}
        .mod-ts-cols{display:grid;grid-template-columns:1fr 1fr;}
        @media(max-width:700px){.mod-ts-cols{grid-template-columns:1fr;}}
        .mod-ts-col{display:flex;flex-direction:column;}
        .mod-ts-col+.mod-ts-col{border-left:1px solid rgba(255,255,255,.06);}
        .mod-ts-sec{border-bottom:1px solid rgba(255,255,255,.04);}
        .mod-ts-sec:last-child{border-bottom:none;}
        .mod-sb{display:grid;grid-template-columns:68px 1fr 68px;align-items:center;gap:.5rem;padding:.3rem 1.15rem;border-radius:4px;transition:background .1s;}
        .mod-sb:hover{background:rgba(255,255,255,.022);}
        .mod-sb-v{font-family:'VT323',monospace;font-size:1.6rem;line-height:1;color:rgba(255,255,255,.82);}
        .mod-sb-a{text-align:right;}.mod-sb-h{text-align:left;}
        .mod-sb-w{color:#FFD700!important;text-shadow:0 0 10px rgba(255,215,0,.5);}
        .mod-sb-d{color:rgba(255,255,255,.2)!important;}
        .mod-sb-m{display:flex;flex-direction:column;gap:3px;}
        .mod-sb-track{display:flex;height:4px;border-radius:3px;overflow:hidden;background:rgba(255,255,255,.07);}
        .mod-sb-fill{height:100%;transition:width .6s ease;}
        .mod-sb-fa{background:rgba(135,206,235,.38);border-radius:3px 0 0 3px;}
        .mod-sb-fh{background:rgba(255,140,0,.38);border-radius:0 3px 3px 0;}
        .mod-sb-bright.mod-sb-fa{background:#87CEEB;}
        .mod-sb-bright.mod-sb-fh{background:#FF8C00;}
        .mod-sb-lbl{font-family:'Press Start 2P',monospace;font-size:.37rem;letter-spacing:.5px;color:rgba(255,255,255,.48);text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}

        /* ══ RESPONSIVE ═══════════════════════════════════════ */
        @media(max-width:640px){
          .mod-overlay{padding:.5rem;}
          .mod-hero-inner{padding:1.5rem 1rem 1.2rem;gap:1rem;}
          .mod-hero-snum{font-size:4rem;}
          .mod-hero-code{font-size:.7rem;}
          .mod-tab-btn{font-size:.38rem;padding:.7rem .25rem .6rem;}
          .mod-tab-icon{font-size:.7rem;}
          .mod-goal-row{grid-template-columns:58px 44px 1fr auto;gap:.4rem;padding:.38rem 1rem;}
          .mod-bs-th-player{min-width:100px;}
          .mod-bs-name{max-width:100px;}
          .mod-goalie-stats-row{gap:.8rem;}
          .mod-goalie-stat-val{font-size:1.4rem;}
        }
      `}</style>

      <div className="mod-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="mod-shell">
          <button className="mod-close" onClick={onClose} aria-label="Close">✕</button>

          {/* HERO */}
          <div className="mod-hero">
            <div className="mod-hero-bg" /><div className="mod-hero-scan" />
            <div className="mod-hero-inner">
              <div className="mod-hero-team">
                <img src={`/assets/teamLogos/${away}.png`} alt={away} width={80} height={80}
                  className="mod-hero-logo-away" style={{ objectFit:'contain' }}
                  onError={e => { e.currentTarget.style.opacity='0'; }} />
                <span className="mod-hero-code mod-hero-code-away">{away}</span>
                <span className={`mod-hero-tag${awayWon ? ' mod-hero-tag-win' : ' mod-hero-tag-loss'}`}>{awayWon ? 'WINNER' : 'AWAY'}</span>
              </div>
              <div className="mod-hero-center">
                <div className="mod-hero-score">
                  <span className={`mod-hero-snum${awayWon ? ' mod-hero-snum-win' : ''}`}>{score_away ?? '—'}</span>
                  <span className="mod-hero-sdash">–</span>
                  <span className={`mod-hero-snum${homeWon ? ' mod-hero-snum-win' : ''}`}>{score_home ?? '—'}</span>
                </div>
                {isOT      && <div className="mod-hero-ot">OVERTIME</div>}
                {isPlayoff && <div className="mod-hero-playoff">PLAYOFFS · ROUND {round} · GAME {game_number}</div>}
              </div>
              <div className="mod-hero-team">
                <img src={`/assets/teamLogos/${home}.png`} alt={home} width={80} height={80}
                  className="mod-hero-logo-home" style={{ objectFit:'contain' }}
                  onError={e => { e.currentTarget.style.opacity='0'; }} />
                <span className="mod-hero-code mod-hero-code-home">{home}</span>
                <span className={`mod-hero-tag${homeWon ? ' mod-hero-tag-win' : ' mod-hero-tag-loss'}`}>{homeWon ? 'WINNER' : 'HOME'}</span>
              </div>
            </div>
          </div>

          {/* TABS */}
          <div className="mod-tabs">
            {TABS.map(t => (
              <button key={t.id} className={`mod-tab-btn${activeTab === t.id ? ' active' : ''}`}
                onClick={() => setActiveTab(t.id)}>
                <span className="mod-tab-icon">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* CONTENT */}
          {loading ? (
            <div className="mod-loading">
              <span className="mod-dot"/><span className="mod-dot"/><span className="mod-dot"/>
            </div>
          ) : (
            <>
              {activeTab === 'scoring'   && <ScoringTab   stats={stats} plays={plays} awayTeam={away} homeTeam={home} seasonGoalsBefore={seasonGoalsBefore} />}
              {activeTab === 'boxscore'  && <BoxScoreTab  skaters={skaters} goalies={goalies} awayTeam={away} homeTeam={home} />}
              {activeTab === 'teamstats' && <TeamStatsTab stats={stats} awayTeam={away} homeTeam={home} />}
            </>
          )}
        </div>
      </div>
    </>
  );

  return ReactDOM.createPortal(modal, document.body);
}

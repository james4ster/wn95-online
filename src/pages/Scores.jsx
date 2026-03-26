// Scores.jsx — NHL95 Arcade Scores Page
import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from '../components/LeagueContext';
import GameOverviewModal from '../components/GameOverviewModal';

const TYPE_TAG    = { PP: 'PP', SH: 'SH', EN: 'EN', PS: 'PS' };

// ─── Shared logo component ────────────────────────────────────────────────────
const Logo = ({ team, size = 32 }) => (
  <img
    src={`/assets/teamLogos/${team}.png`}
    alt={team}
    style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0, display: 'block' }}
    onError={e => { e.currentTarget.style.opacity = '0'; }}
  />
);

// ─── Streak badge ─────────────────────────────────────────────────────────────
// streak: { type: 'W'|'L'|'OTL'|'T', count: number }
function StreakBadge({ streak }) {
  if (!streak) return null;
  const colors = {
    W:   { text: '#00CC55', border: 'rgba(0,204,85,.45)',   bg: 'rgba(0,204,85,.12)'   },
    L:   { text: '#5588FF', border: 'rgba(85,136,255,.45)', bg: 'rgba(85,136,255,.1)'  },
    OTL: { text: '#FF8C00', border: 'rgba(255,140,0,.45)',  bg: 'rgba(255,140,0,.1)'   },
    T:   { text: '#888',    border: 'rgba(128,128,128,.4)', bg: 'rgba(128,128,128,.08)'},
  };
  const c = colors[streak.type] ?? colors.T;
  return (
    <div className="streak-badge" style={{ color: c.text, borderColor: c.border, background: c.bg }}>
      {streak.type}{streak.count}
    </div>
  );
}

// ─── Collapsed game row ───────────────────────────────────────────────────────
function GameCard({ game, selectedTeam, index, onOpenModal, streak }) {
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
    win:  { c: '#00CC55', g: 'rgba(0,204,85,.13)',    s: '#00CC55' },
    loss: { c: '#5588FF', g: 'rgba(85,136,255,.08)',   s: '#3B6FE8' },
    otl:  { c: '#FF8C00', g: 'rgba(255,140,0,.10)',    s: '#FF8C00' },
    tie:  { c: '#888',    g: 'rgba(128,128,128,.05)',  s: '#555'    },
  }[result];

  return (
    <div
      className={`gc gc-${result}`}
      style={{ '--stripe': RC.s, '--glow': RC.g, animationDelay: `${index * 0.04}s` }}
    >
      <div className="gc-row">
        {/* Result badge */}
        <div className="gc-badge" style={{ color: RC.c, borderColor: `${RC.c}60`, background: `${RC.c}14` }}>
          {game.isPlayoff ? (
            <>
              <div>{BADGE[result]}</div>
              <div style={{ fontSize: '.42rem', opacity: 0.85, marginTop: 3, letterSpacing: 1 }}>
                R{game.round}·G{game.game_number}
              </div>
            </>
          ) : BADGE[result]}
        </div>

        {/* Away team + streak if selected */}
        <div className="gc-side gc-away">
          {game.away === selectedTeam && <StreakBadge streak={streak} />}
          <Logo team={game.away} size={42} />
          <span className={`gc-code${game.away === selectedTeam ? ' gc-sel' : ''}`}>{game.away}</span>
        </div>

        {/* Score pill — clicking opens modal */}
        <button
          className="gc-score-pill"
          onClick={() => onOpenModal(game)}
          title="Open Game Overview"
        >
          <span className={`gc-num${game.score_away > game.score_home ? ' gc-hi' : ''}`}>
            {game.score_away ?? '—'}
          </span>
          <div className="gc-sep">
            {isOT
              ? <span className="gc-ot">OT</span>
              : <span className="gc-dash">–</span>}
          </div>
          <span className={`gc-num${game.score_home > game.score_away ? ' gc-hi' : ''}`}>
            {game.score_home ?? '—'}
          </span>
        </button>

        {/* Home team + streak if selected */}
        <div className="gc-side gc-home">
          <span className={`gc-code${game.home === selectedTeam ? ' gc-sel' : ''}`}>{game.home}</span>
          <Logo team={game.home} size={42} />
          {game.home === selectedTeam && <StreakBadge streak={streak} />}
        </div>

        {/* Overview button */}
        <div className="gc-actions">
  <button
    className="gc-overview-btn"
    onClick={() => onOpenModal(game)}
    title="Game Overview"
  >
    OVERVIEW
  </button>
</div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Scores() {
  const { selectedLeague } = useLeague();
  const [seasons, setSeasons]   = useState([]);
  const [season, setSeason]     = useState('');
  const [mode, setMode]         = useState('Season');
  const [teams, setTeams]       = useState([]);
  const [team, setTeam]         = useState('');
  const [games, setGames]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [modalGame, setModalGame] = useState(null);

  useEffect(() => {
    if (!selectedLeague) return;
    (async () => {
      const { data } = await supabase
        .from('seasons').select('lg,year').ilike('lg', `${selectedLeague}%`).order('year', { ascending: false });
      const codes = (data || []).map(r => r.lg);
      setSeasons(codes);
      setSeason(codes[0] ?? '');
    })();
  }, [selectedLeague]);

  useEffect(() => {
    if (!season) { setTeams([]); setTeam(''); return; }
    (async () => {
      const { data } = await supabase.from('teams').select('abr,team').eq('lg', season).order('team', { ascending: true });
      const list = (data || []).map(r => ({ abr: r.abr, name: r.team }));
      setTeams(list);
      setTeam(t => (list.find(x => x.abr === t) ? t : list[0]?.abr ?? ''));
    })();
  }, [season]);

  useEffect(() => {
    if (!season || !team) return;
    setLoading(true);
    (async () => {
      let data, error;
      if (mode === 'Playoffs') {
        const res = await supabase
          .from('playoff_games')
          .select('id,lg,round,series_number,game_number,team_code_a,team_code_b,seed_a,seed_b,team_a_score,team_b_score')
          .eq('lg', season)
          .or(`team_code_a.eq.${team},team_code_b.eq.${team}`)
          .not('team_a_score', 'is', null)
          .order('round', { ascending: true })
          .order('series_number', { ascending: true })
          .order('game_number', { ascending: true });
        error = res.error;
        data = (res.data || []).map(g => ({
          id: g.id, lg: g.lg, mode: 'Playoffs',
          home: g.team_code_a, away: g.team_code_b,
          score_home: g.team_a_score, score_away: g.team_b_score,
          ot: 0, round: g.round, series_number: g.series_number,
          game_number: g.game_number, isPlayoff: true,
        }));
      } else {
        const res = await supabase
          .from('games')
          .select('id,lg,legacy_game_id,mode,home,away,score_home,score_away,ot')
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

  // ── Compute running streak per game for selected team ──────────────────────
  // Returns an array of { type, count } aligned to games[]
  const streaks = React.useMemo(() => {
    if (!games.length || !team) return [];
    const result = [];
    let currentType = null;
    let currentCount = 0;
    games.forEach(g => {
      const isHome = team === g.home;
      const my = isHome ? g.score_home : g.score_away;
      const op = isHome ? g.score_away : g.score_home;
      const isOT = Number(g.ot) === 1;
      let type;
      if (my > op)            type = 'W';
      else if (my < op && isOT) type = 'OTL';
      else if (my < op)         type = 'L';
      else                      type = 'T';

      if (type === currentType) {
        currentCount++;
      } else {
        currentType  = type;
        currentCount = 1;
      }
      result.push({ type, count: currentCount });
    });
    return result;
  }, [games, team]);

  const rec = games.reduce((acc, g) => {
    const isHome = team === g.home;
    const my = isHome ? g.score_home : g.score_away;
    const op = isHome ? g.score_away : g.score_home;
    if (my > op) acc.w++;
    else if (my < op && Number(g.ot)) acc.otl++;
    else if (my < op) acc.l++;
    else acc.t++;
    return acc;
  }, { w: 0, l: 0, otl: 0, t: 0 });

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
        .sp-rec.w   .sp-rec-num,.sp-rec.w   .sp-rec-lbl { color:#00CC55; }
        .sp-rec.l   .sp-rec-num,.sp-rec.l   .sp-rec-lbl { color:#5588FF; }
        .sp-rec.otl .sp-rec-num,.sp-rec.otl .sp-rec-lbl { color:#FF8C00; }
        .sp-rec.t   .sp-rec-num,.sp-rec.t   .sp-rec-lbl { color:#888; }

        /* ── GAME LIST ──────────────────────────────────────────────────── */
        .sp-list { max-width:1160px; margin:0 auto; display:flex; flex-direction:column; gap:.55rem; }

        /* ════════════════════════════════════════════════════════════════════
           GAME CARD
        ════════════════════════════════════════════════════════════════════ */
        .gc {
          border-radius:12px; overflow:hidden;
          border:1px solid rgba(255,255,255,.07);
          border-left:4px solid var(--stripe);
          box-shadow:inset 0 0 50px var(--glow);
          animation:gcIn .3s ease both;
        }
        @keyframes gcIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }

        /* Card row — no longer a button, just a div */
        .gc-row {
          display: grid;
          grid-template-columns: 58px 1fr 180px 1fr 120px;
          align-items: center;
          gap: .8rem;
        }

        .gc-badge {
          font-family:'Press Start 2P',monospace; font-size:.58rem;
          padding:.32rem .42rem; border-radius:5px; text-align:center;
          border:1px solid; line-height:1.4; white-space:nowrap;
        }

        .gc-side { display:flex; align-items:center; gap:.55rem; }
        .gc-away { justify-content:flex-end; }
        .gc-home { justify-content:flex-start; }

        .gc-code { font-family:'Press Start 2P',monospace; font-size:.78rem; color:rgba(255,255,255,.55); letter-spacing:1px; }
        .gc-sel  { color:#FFD700; text-shadow:0 0 10px rgba(255,215,0,.5); }

        /* Streak badge */
        .streak-badge {
          font-family:'Press Start 2P',monospace;
          font-size:.5rem;
          letter-spacing:1px;
          padding:.22rem .38rem;
          border-radius:5px;
          border:1px solid;
          white-space:nowrap;
          flex-shrink:0;
        }

        /* Score pill — now a clickable button */
        .gc-score-pill {
          display:flex; align-items:center; justify-content:center; gap:.55rem;
          background:rgba(0,0,0,.4); border-radius:10px; padding:.45rem .7rem;
          border:1px solid rgba(255,255,255,.08);
          cursor:pointer;
          transition:border-color .15s, box-shadow .15s, background .15s;
          width:100%;
        }
        .gc-score-pill:hover {
          border-color:rgba(255,215,0,.4);
          background:rgba(255,215,0,.06);
          box-shadow:0 0 14px rgba(255,215,0,.15);
        }
        .gc-num  { font-family:'VT323',monospace; font-size:3.2rem; line-height:1; color:rgba(255,255,255,.45); min-width:28px; text-align:center; }
        .gc-hi   { color:#FFD700; text-shadow:0 0 16px rgba(255,215,0,.6); }
        .gc-sep  { min-width:36px; text-align:center; }
        .gc-dash { font-family:'VT323',monospace; font-size:2.2rem; color:rgba(255,255,255,.12); display:block; }
        .gc-ot   { display:inline-block; font-family:'Press Start 2P',monospace; font-size:.38rem; color:#FF8C00; border:1px solid rgba(255,140,0,.55); border-radius:4px; padding:.16rem .3rem; background:rgba(255,140,0,.12); }

        /* Overview button */
        .gc-overview-btn {
          font-family:'Press Start 2P',monospace; font-size:.36rem;
          letter-spacing:1.5px; color:rgba(135,206,235,.6);
          background:rgba(135,206,235,.06);
          border:1px solid rgba(135,206,235,.2);
          border-radius:5px; padding:.38rem .65rem;
          cursor:pointer; transition:all .15s;
          white-space:nowrap; flex-shrink:0;
          width: 100%;
          text-align: center;
          grid-column: 5;
  justify-self: end;
        }
        .gc-overview-btn:hover {
          color:#87CEEB; background:rgba(135,206,235,.15);
          border-color:rgba(135,206,235,.5);
          box-shadow:0 0 10px rgba(135,206,235,.2);
        }
        /* Align Overview btn */
        .gc-actions {
          display: flex;
  justify-content: center;
  align-items: center;
          width: 100%;
        }

        /* ════════════════════════════════════════════════════════════════════
           PAGE STATES
        ════════════════════════════════════════════════════════════════════ */
        .dot {
          display:inline-block; width:6px; height:6px; border-radius:50%;
          background:#87CEEB; animation:dotP 1.2s ease-in-out infinite;
        }
        .dot:nth-child(2){animation-delay:.15s} .dot:nth-child(3){animation-delay:.3s}
        @keyframes dotP { 0%,100%{opacity:.15} 50%{opacity:1} }

        .sp-loading { display:flex; gap:8px; align-items:center; justify-content:center; padding:5rem; }
        .sp-loading .dot { width:8px; height:8px; background:#FF8C00; }
        .sp-empty-page { text-align:center; font-family:'Press Start 2P',monospace; font-size:.75rem; color:rgba(255,255,255,.15); padding:5rem; letter-spacing:2px; }

        /* ════════════════════════════════════════════════════════════════════
           RESPONSIVE
        ════════════════════════════════════════════════════════════════════ */
        @media(max-width:640px){
          .sp { padding:1rem 1rem 4rem; }
          .sp-led { font-size:1.5rem; letter-spacing:3px; }
          .gc-row { grid-template-columns:44px 1fr 150px 1fr auto; gap:.45rem; padding:.8rem .7rem; }
          .gc-code { font-size:.64rem; }
          .gc-num  { font-size:2.6rem; }
          .streak-badge { font-size:.4rem; padding:.18rem .28rem; }
        }
      `}</style>

      {/* ── HEADER ── */}
      <div className="sp-hw">
        <div className="sp-hb"><div className="sp-led">SCORES</div></div>
      </div>

      {/* ── FILTERS ── */}
      <div className="sp-fx">
        <div className="sp-fg">
          <span className="sp-flbl">SEASON</span>
          <select className="sp-sel" value={season} onChange={e => setSeason(e.target.value)}>
            {seasons.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="sp-fg">
          <span className="sp-flbl">MODE</span>
          <select className="sp-sel" value={mode} onChange={e => setMode(e.target.value)}>
            <option value="Season">Season</option>
            <option value="Playoffs">Playoffs</option>
          </select>
        </div>
        <div className="sp-fg">
          <span className="sp-flbl">TEAM</span>
          <select className="sp-sel" value={team} onChange={e => setTeam(e.target.value)}>
            {teams.map(t => <option key={t.abr} value={t.abr}>{t.name} ({t.abr})</option>)}
          </select>
        </div>
      </div>

      {/* ── RECORD STRIP ── */}
      {!loading && games.length > 0 && (
        <div className="sp-record">
          <div className="sp-rec w"><span className="sp-rec-num">{rec.w}</span><span className="sp-rec-lbl">WINS</span></div>
          <div className="sp-rec l"><span className="sp-rec-num">{rec.l}</span><span className="sp-rec-lbl">LOSSES</span></div>
          {rec.otl > 0 && <div className="sp-rec otl"><span className="sp-rec-num">{rec.otl}</span><span className="sp-rec-lbl">OTL</span></div>}
          {rec.t   > 0 && <div className="sp-rec t"><span className="sp-rec-num">{rec.t}</span><span className="sp-rec-lbl">TIES</span></div>}
        </div>
      )}

      {/* ── GAME LIST ── */}
      {loading ? (
        <div className="sp-loading"><span className="dot" /><span className="dot" /><span className="dot" /></div>
      ) : games.length === 0 ? (
        <div className="sp-empty-page">NO GAMES FOUND</div>
      ) : (
        <div className="sp-list">
          {games.map((g, i) => (
            <GameCard
              key={g.id}
              game={g}
              selectedTeam={team}
              index={i}
              onOpenModal={setModalGame}
              streak={streaks[i]}
            />
          ))}
        </div>
      )}

      {/* ── GAME OVERVIEW MODAL ── */}
      {modalGame && (
        <GameOverviewModal
          game={modalGame}
          onClose={() => setModalGame(null)}
        />
      )}
    </div>
  );
}

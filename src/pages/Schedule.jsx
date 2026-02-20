import React, { useEffect, useState } from 'react';
import { useLeague } from '../components/LeagueContext';
import { supabase } from '../utils/supabaseClient';

export default function Schedule() {
  const { selectedLeague } = useLeague();

  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [teams, setTeams] = useState([]);
  const [selectedTeamAbr, setSelectedTeamAbr] = useState('');
  const [completedGames, setCompletedGames] = useState([]);
  const [remainingOpponents, setRemainingOpponents] = useState([]);
  const [h2hRecords, setH2hRecords] = useState({});
  const [seasonStats, setSeasonStats] = useState(null);
  const [loading, setLoading] = useState(false);

  // ==============================
  // Fetch seasons
  // ==============================
  useEffect(() => {
    if (!selectedLeague) { setSeasons([]); setSelectedSeason(''); return; }
    const go = async () => {
      const { data, error } = await supabase.from('seasons').select('lg, year').order('year', { ascending: false });
      if (error) return;
      const filtered = data.filter(s => s.lg.startsWith(selectedLeague));
      setSeasons(filtered);
      if (filtered.length > 0) setSelectedSeason(filtered[0].lg);
    };
    go();
  }, [selectedLeague]);

  // ==============================
  // Fetch teams
  // ==============================
  useEffect(() => {
    if (!selectedSeason) { setTeams([]); setSelectedTeamAbr(''); return; }
    const go = async () => {
      const { data, error } = await supabase
        .from('teams').select('team, abr').eq('lg', selectedSeason).order('team', { ascending: true });
      if (error || !data || data.length === 0) { setTeams([]); setSelectedTeamAbr(''); return; }
      setTeams(data);
      setSelectedTeamAbr(data[0].abr);
    };
    go();
  }, [selectedSeason]);

  // ==============================
  // Fetch everything when team/season changes
  // ==============================
  useEffect(() => {
    if (!selectedSeason || !selectedTeamAbr) {
      setCompletedGames([]); setRemainingOpponents([]); setH2hRecords({}); setSeasonStats(null); return;
    }

    const fetchAll = async () => {
      setLoading(true);

      // 1. Season stats from standings
      const { data: standingsData } = await supabase
        .from('standings').select('*')
        .eq('season', selectedSeason).ilike('team', selectedTeamAbr).single();
      setSeasonStats(standingsData || null);

      // 2. Completed games for this team this season (games that exist in the table)
      const [homeRes, awayRes] = await Promise.all([
        supabase.from('games').select('*').eq('lg', selectedSeason).eq('mode', 'Season').ilike('home', selectedTeamAbr),
        supabase.from('games').select('*').eq('lg', selectedSeason).eq('mode', 'Season').ilike('away', selectedTeamAbr),
      ]);
      const played = [
        ...(homeRes.data || []),
        ...(awayRes.data || []),
      ].sort((a, b) => a.game - b.game);
      setCompletedGames(played);

      // 3. Derive remaining opponents:
      //    All teams in this season EXCEPT the selected team,
      //    minus those who already appear in played games
      const playedOpponentAbrs = new Set(
        played.map(g =>
          g.home.toLowerCase() === selectedTeamAbr.toLowerCase()
            ? g.away.toLowerCase()
            : g.home.toLowerCase()
        )
      );

      // Get all season teams (already fetched in `teams` state, but fetch fresh here
      // so this effect doesn't depend on the teams state timing)
      const { data: allTeamsData } = await supabase
        .from('teams').select('team, abr').eq('lg', selectedSeason);

      const remaining = (allTeamsData || []).filter(t =>
        t.abr.toLowerCase() !== selectedTeamAbr.toLowerCase() &&
        !playedOpponentAbrs.has(t.abr.toLowerCase())
      );

      setRemainingOpponents(remaining);

      console.log('Played opponents:', [...playedOpponentAbrs]);
      console.log('Remaining opponents:', remaining.map(t => t.abr));

      // 4. All-time H2H — pull all season games involving this team across all seasons
      const [allHome, allAway] = await Promise.all([
        supabase.from('games').select('home,away,score_home,score_away,result_home,result_away,ot')
          .eq('mode', 'Season').ilike('home', selectedTeamAbr),
        supabase.from('games').select('home,away,score_home,score_away,result_home,result_away,ot')
          .eq('mode', 'Season').ilike('away', selectedTeamAbr),
      ]);
      const allGames = [...(allHome.data || []), ...(allAway.data || [])];

      // Build H2H for every opponent — both played and remaining
      const allOpponentAbrs = [
        ...new Set([
          ...played.map(g =>
            g.home.toLowerCase() === selectedTeamAbr.toLowerCase() ? g.away : g.home
          ),
          ...remaining.map(t => t.abr),
        ])
      ];

      const records = {};
      allOpponentAbrs.forEach(opp => {
        const oppLower = opp.toLowerCase();
        const h2h = allGames.filter(g =>
          g.home.toLowerCase() === oppLower || g.away.toLowerCase() === oppLower
        );
        let w = 0, l = 0, t = 0, otl = 0, gf = 0, ga = 0;
        h2h.forEach(g => {
          const isHome = g.home.toLowerCase() === selectedTeamAbr.toLowerCase();
          const result = isHome ? g.result_home : g.result_away;
          const myScore    = isHome ? g.score_home  : g.score_away;
          const theirScore = isHome ? g.score_away  : g.score_home;
          if (myScore    != null) gf += myScore;
          if (theirScore != null) ga += theirScore;
          if (!result) return;
          const r = result.toUpperCase();
          if (r === 'W' || r === 'OTW') w++;
          else if (r === 'L')   l++;
          else if (r === 'OTL') otl++;
          else if (r === 'T')   t++;
        });
        records[oppLower] = { w, l, t, otl, gf, ga, gd: gf - ga, gp: h2h.length };
      });

      setH2hRecords(records);
      setLoading(false);
    };

    fetchAll();
  }, [selectedSeason, selectedTeamAbr]);

  // ==============================
  // Helpers
  // ==============================
  const getResult = (game) => {
    const isHome = game.home.toLowerCase() === selectedTeamAbr.toLowerCase();
    return (isHome ? game.result_home : game.result_away) || null;
  };

  const getResultMeta = (result) => {
    if (!result) return { cls: '', label: '' };
    const r = result.toUpperCase();
    if (r === 'W')   return { cls: 'win',  label: 'W' };
    if (r === 'OTW') return { cls: 'win',  label: 'OTW' };
    if (r === 'L')   return { cls: 'loss', label: 'L' };
    if (r === 'OTL') return { cls: 'otl',  label: 'OTL' };
    if (r === 'T')   return { cls: 'tie',  label: 'T' };
    return { cls: '', label: result };
  };

  // Group completed games by opponent abr
  const groupCompletedByOpponent = () => {
    const map = {};
    completedGames.forEach(g => {
      const opp = g.home.toLowerCase() === selectedTeamAbr.toLowerCase() ? g.away : g.home;
      const key = opp.toLowerCase();
      if (!map[key]) map[key] = { opp, games: [] };
      map[key].games.push(g);
    });
    return Object.values(map);
  };

  const completedGroups = groupCompletedByOpponent();

  // ==============================
  // SUB-COMPONENTS
  // ==============================

  const StatHero = ({ stats }) => {
    if (!stats) return null;
    const gd   = (stats.gf || 0) - (stats.ga || 0);
    const gfPG = stats.gp > 0 ? (stats.gf / stats.gp).toFixed(2) : '—';
    const gaPG = stats.gp > 0 ? (stats.ga / stats.gp).toFixed(2) : '—';

    const statItems = [
      { label: 'RANK', value: `#${stats.season_rank || '—'}`, cls: 'hero-rank' },
      { label: 'GP',   value: stats.gp   ?? '—', cls: '' },
      { label: 'W',    value: stats.w    ?? '—', cls: 'hero-w' },
      { label: 'L',    value: stats.l    ?? '—', cls: 'hero-l' },
      { label: 'T',    value: stats.t    ?? '—', cls: '' },
      { label: 'OTL',  value: stats.otl  ?? '—', cls: 'hero-otl' },
      { label: 'PTS',  value: stats.pts  ?? '—', cls: 'hero-pts' },
      { label: 'GF',   value: stats.gf   ?? '—', cls: '' },
      { label: 'GA',   value: stats.ga   ?? '—', cls: '' },
      { label: 'GD',   value: gd > 0 ? `+${gd}` : gd, cls: gd > 0 ? 'hero-pos' : gd < 0 ? 'hero-neg' : '' },
      { label: 'GF/G', value: gfPG, cls: 'hero-sub' },
      { label: 'GA/G', value: gaPG, cls: 'hero-sub' },
    ];

    return (
      <div className="hero-strip">
        <div className="hero-banner-bg">
          <img src={`/assets/banners/${selectedTeamAbr}.png`} alt="" className="hero-banner-img"
            onError={e => { e.target.style.display = 'none'; }} />
        </div>
        <div className="hero-logo-col">
          <img src={`/assets/teamLogos/${selectedTeamAbr}.png`} alt={selectedTeamAbr} className="hero-logo"
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
          <div className="hero-logo-fallback" style={{ display: 'none' }}>{selectedTeamAbr}</div>
        </div>
        <div className="hero-stats-row">
          {statItems.map(s => (
            <div key={s.label} className="hero-stat">
              <div className={`hero-val ${s.cls}`}>{s.value}</div>
              <div className="hero-lbl">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // H2H boxes — always show all 7, always 0 if missing
  const OppHeader = ({ opp }) => {
    const h2h = h2hRecords[opp.toLowerCase()] || { w:0, l:0, t:0, otl:0, gf:0, ga:0, gd:0, gp:0 };
    const gd  = h2h.gf - h2h.ga;
    const statBoxes = [
      { val: h2h.w,   lbl: 'W',   cls: 'h2h-w'   },
      { val: h2h.l,   lbl: 'L',   cls: 'h2h-l'   },
      { val: h2h.t,   lbl: 'T',   cls: 'h2h-t'   },
      { val: h2h.otl, lbl: 'OTL', cls: 'h2h-otl' },
      { val: h2h.gf,  lbl: 'GF',  cls: 'h2h-gf'  },
      { val: h2h.ga,  lbl: 'GA',  cls: 'h2h-ga'  },
      { val: gd > 0 ? `+${gd}` : gd, lbl: 'GD', cls: gd > 0 ? 'h2h-gd-pos' : gd < 0 ? 'h2h-gd-neg' : 'h2h-ga' },
    ];

    return (
      <div className="opp-header">
        <div className="opp-banner-bg">
          <img src={`/assets/banners/${opp}.png`} alt="" className="opp-banner-img"
            onError={e => { e.target.style.display = 'none'; }} />
        </div>
        <div className="opp-logo-wrap">
          <img src={`/assets/teamLogos/${opp}.png`} alt={opp} className="opp-logo"
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }} />
          <div className="opp-fallback" style={{ display: 'none' }}>{opp}</div>
        </div>
        <div className="opp-h2h">
          <div className="opp-h2h-label">ALL TIME</div>
          {h2h.gp > 0 ? (
            <div className="opp-h2h-stats">
              {statBoxes.map((s, i) => (
                <div key={i} className="h2h-stat-item">
                  <span className={`h2h-stat-val ${s.cls}`}>{s.val}</span>
                  <span className="h2h-stat-lbl">{s.lbl}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="h2h-first">FIRST MEETING</div>
          )}
        </div>
      </div>
    );
  };

  const GameRow = ({ game }) => {
    const isHome = game.home.toLowerCase() === selectedTeamAbr.toLowerCase();
    const result = getResult(game);
    const { cls, label } = getResultMeta(result);
    const myScore    = isHome ? game.score_home : game.score_away;
    const theirScore = isHome ? game.score_away : game.score_home;
    return (
      <div className={`game-row ${cls}`}>
        <div className={`venue-pip ${isHome ? 'pip-home' : 'pip-away'}`} />
        <div className="venue-tag">{isHome ? 'H' : 'A'}</div>
        <div className={`game-score ${cls}`}>
          <span className="gs-mine">{myScore}</span>
          <span className="gs-dash">–</span>
          <span className="gs-theirs">{theirScore}</span>
          {game.ot ? <span className="gs-ot">OT</span> : null}
        </div>
        <div className={`game-result-badge ${cls}`}>{label}</div>
      </div>
    );
  };

  // Completed section — grouped by opponent with games underneath
  const CompletedOpponentBlock = ({ group }) => (
    <div className="opp-block">
      <OppHeader opp={group.opp} />
      <div className="opp-games">
        {group.games.map(g => <GameRow key={g.game} game={g} />)}
      </div>
    </div>
  );

  // Remaining section — one block per opponent, no game rows (just H2H)
  const RemainingOpponentBlock = ({ team }) => (
    <div className="opp-block">
      <OppHeader opp={team.abr} />
    </div>
  );

  const SectionPanel = ({ title, accentColor, count, children }) => (
    <div className="section-panel">
      <div className="section-panel-header" style={{ '--accent': accentColor }}>
        <span className="sp-title">{title}</span>
        <span className="sp-count">{count} {count === 1 ? 'OPPONENT' : 'OPPONENTS'}</span>
      </div>
      {count === 0 ? (
        <div className="section-empty">NONE</div>
      ) : (
        <div className="opp-list">{children}</div>
      )}
    </div>
  );

  return (
    <div className="schedule-page">

      {/* HEADER */}
      <div className="scoreboard-header-container">
        <div className="scoreboard-header">
          <div className="led-text">LEAGUE SCHEDULE</div>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="control-panel">
        <div className="control-group">
          <label>SEASON</label>
          <select className="arcade-select" value={selectedSeason}
            onChange={e => setSelectedSeason(e.target.value)}
            disabled={!selectedLeague || seasons.length === 0}>
            <option value="">SELECT SEASON</option>
            {seasons.map(s => <option key={s.lg} value={s.lg}>{s.lg} ({s.year})</option>)}
          </select>
        </div>
        <div className="control-group">
          <label>TEAM</label>
          <select className="arcade-select" value={selectedTeamAbr}
            onChange={e => setSelectedTeamAbr(e.target.value)}
            disabled={teams.length === 0}>
            <option value="">SELECT TEAM</option>
            {teams.map(t => <option key={t.abr} value={t.abr}>{t.team}</option>)}
          </select>
        </div>
      </div>

      {/* BODY */}
      {loading ? (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <div className="loading-text">LOADING...</div>
        </div>
      ) : completedGames.length === 0 && remainingOpponents.length === 0 && !seasonStats ? (
        <div className="no-data"><div className="no-data-text">NO DATA</div></div>
      ) : (
        <div className="page-body">

          {seasonStats && <StatHero stats={seasonStats} />}

          <div className="split-layout">

            <SectionPanel title="REMAINING" accentColor="#87CEEB" count={remainingOpponents.length}>
              {remainingOpponents.map(t => (
                <RemainingOpponentBlock key={t.abr} team={t} />
              ))}
            </SectionPanel>

            <SectionPanel title="COMPLETED" accentColor="#FFD700" count={completedGroups.length}>
              {completedGroups.map(g => (
                <CompletedOpponentBlock key={g.opp} group={g} />
              ))}
            </SectionPanel>

          </div>
        </div>
      )}

      <style>{`
        /* ===========================  PAGE  =========================== */
        .schedule-page {
          padding: 1rem 2rem;
          min-height: 100vh;
          background: radial-gradient(ellipse at top, #0a0a15 0%, #000000 100%);
        }

        /* ===========================  HEADER  =========================== */
        .scoreboard-header-container { display:flex; justify-content:center; margin-bottom:1rem; }
        .scoreboard-header {
          background:#000; border:6px solid #333; border-radius:8px; padding:1rem 2rem;
          box-shadow:0 0 0 2px #000,inset 0 0 20px rgba(0,0,0,0.8),0 8px 16px rgba(0,0,0,0.5),0 0 40px rgba(255,215,0,0.3);
          position:relative; overflow:hidden;
        }
        .scoreboard-header::before {
          content:''; position:absolute; inset:0;
          background:
            repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(255,215,0,0.03) 2px,rgba(255,215,0,0.03) 4px),
            repeating-linear-gradient(90deg,transparent 0px,transparent 2px,rgba(255,215,0,0.03) 2px,rgba(255,215,0,0.03) 4px);
          pointer-events:none;
        }
        .scoreboard-header::after {
          content:''; position:absolute; top:-50%; left:-50%; width:200%; height:200%;
          background:linear-gradient(45deg,transparent 30%,rgba(255,215,0,0.1) 50%,transparent 70%);
          animation:shimmer 3s infinite;
        }
        @keyframes shimmer {
          0%  { transform:translateX(-100%) translateY(-100%) rotate(45deg); }
          100%{ transform:translateX(100%)  translateY(100%)  rotate(45deg); }
        }
        .led-text {
          font-family:'Press Start 2P',monospace; font-size:2rem; color:#FF8C00; letter-spacing:6px;
          text-shadow:0 0 10px #FF8C00,0 0 20px #FF8C00,0 0 30px #FFD700;
          filter:contrast(1.3) brightness(1.2); position:relative;
        }

        /* ===========================  CONTROLS  =========================== */
        .control-panel { display:flex; gap:2rem; justify-content:center; margin-bottom:1.5rem; flex-wrap:wrap; }
        .control-group { display:flex; flex-direction:column; gap:0.5rem; }
        .control-group label {
          font-family:'Press Start 2P',monospace; font-size:0.7rem; color:#FF8C00; letter-spacing:2px; text-shadow:0 0 5px #FF8C00;
        }
        .arcade-select {
          background:linear-gradient(180deg,#1a1a2e 0%,#0a0a15 100%); color:#87CEEB;
          border:3px solid #87CEEB; padding:0.75rem 1rem;
          font-family:'VT323',monospace; font-size:1.2rem; cursor:pointer; border-radius:8px;
          box-shadow:0 0 10px rgba(135,206,235,0.3),inset 0 0 10px rgba(135,206,235,0.1);
          transition:all 0.3s ease; letter-spacing:1px;
        }
        .arcade-select:hover:not(:disabled) {
          border-color:#FF8C00; color:#FF8C00;
          box-shadow:0 0 15px rgba(255,140,0,0.5),inset 0 0 15px rgba(255,140,0,0.1); transform:translateY(-2px);
        }
        .arcade-select:disabled { opacity:0.4; cursor:not-allowed; }

        /* ===========================  LOADING / NO DATA  =========================== */
        .loading-screen { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:400px; gap:2rem; }
        .loading-spinner {
          width:60px; height:60px; border:6px solid rgba(255,140,0,0.2); border-top:6px solid #FF8C00;
          border-radius:50%; animation:spin 1s linear infinite; box-shadow:0 0 20px rgba(255,140,0,0.5);
        }
        @keyframes spin { to { transform:rotate(360deg); } }
        .loading-text { font-family:'Press Start 2P',monospace; font-size:1rem; color:#87CEEB; letter-spacing:2px; animation:pulse 1.5s ease-in-out infinite; }
        @keyframes pulse { 0%,100%{opacity:0.5} 50%{opacity:1;text-shadow:0 0 20px #FF8C00} }
        .no-data { display:flex; justify-content:center; align-items:center; min-height:400px; }
        .no-data-text { font-family:'Press Start 2P',monospace; font-size:1.2rem; color:#FF8C00; text-shadow:0 0 10px #FF8C00; letter-spacing:3px; }

        /* ===========================  HERO STRIP  =========================== */
        .page-body { max-width:1400px; margin:0 auto; }
        .hero-strip {
          position:relative; display:flex; align-items:center; gap:2rem;
          background:linear-gradient(135deg,#0d0d1a 0%,#111125 50%,#0a0a15 100%);
          border:3px solid rgba(255,140,0,0.5); border-radius:20px;
          padding:1.75rem 2rem; margin-bottom:2rem; overflow:hidden;
          box-shadow:0 0 40px rgba(255,140,0,0.15),inset 0 0 40px rgba(255,140,0,0.04);
        }
        .hero-strip::before {
          content:''; position:absolute; top:0; left:0; right:0; height:3px;
          background:linear-gradient(90deg,transparent,#FF8C00,#FFD700,#FF8C00,transparent);
          box-shadow:0 0 12px #FF8C00;
        }
        .hero-banner-bg { position:absolute; inset:0; z-index:0; overflow:hidden; pointer-events:none; }
        .hero-banner-img {
          position:absolute; right:-30px; top:50%; transform:translateY(-50%);
          height:180%; opacity:0.08; filter:blur(2px) brightness(1.5);
          mask-image:linear-gradient(to left,rgba(0,0,0,0.9) 0%,transparent 65%);
          -webkit-mask-image:linear-gradient(to left,rgba(0,0,0,0.9) 0%,transparent 65%);
        }
        .hero-logo-col {
          position:relative; z-index:2; flex-shrink:0;
          width:110px; height:110px;
          background:rgba(0,0,0,0.6); border-radius:20px; padding:10px;
          border:2px solid rgba(255,140,0,0.6);
          box-shadow:0 0 30px rgba(255,140,0,0.4);
          display:flex; align-items:center; justify-content:center;
        }
        .hero-logo { width:100%; height:100%; object-fit:contain; }
        .hero-logo-fallback {
          display:flex; align-items:center; justify-content:center;
          font-family:'Press Start 2P',monospace; font-size:0.65rem; color:#FF8C00; text-align:center;
        }
        .hero-stats-row { position:relative; z-index:2; display:flex; flex-wrap:wrap; flex:1; align-items:flex-start; }
        .hero-stat {
          display:flex; flex-direction:column; align-items:center; justify-content:flex-start;
          width:80px; padding:0.4rem 0;
          border-right:1px solid rgba(255,140,0,0.18);
        }
        .hero-stat:last-child { border-right:none; }
        .hero-val {
          font-family:'VT323',monospace; font-size:2.2rem; line-height:1; color:#E0E0E0; letter-spacing:1px;
          height:2.4rem; display:flex; align-items:center; justify-content:center;
        }
        .hero-lbl {
          font-family:'Press Start 2P',monospace; font-size:0.52rem;
          color:rgba(255,140,0,0.85); letter-spacing:1px; margin-top:6px; white-space:nowrap;
        }
        .hero-rank { color:#FFD700; text-shadow:0 0 15px #FFD700; font-size:2.4rem; }
        .hero-pts  { color:#FFD700; text-shadow:0 0 15px #FFD700; font-size:2.4rem; }
        .hero-w    { color:#00FF64; text-shadow:0 0 10px #00FF64; }
        .hero-l    { color:#FF3C3C; text-shadow:0 0 10px #FF3C3C; }
        .hero-otl  { color:#FFA500; text-shadow:0 0 10px #FFA500; }
        .hero-pos  { color:#00FF64; text-shadow:0 0 10px #00FF64; }
        .hero-neg  { color:#FF3C3C; text-shadow:0 0 10px #FF3C3C; }
        .hero-sub  { color:#87CEEB; font-size:1.9rem !important; }

        /* ===========================  SPLIT LAYOUT  =========================== */
        .split-layout { display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; align-items:start; }

        /* ===========================  SECTION PANEL  =========================== */
        .section-panel {
          background:linear-gradient(180deg,#0d0d1a 0%,#080812 100%);
          border:2px solid rgba(255,140,0,0.2); border-radius:14px; overflow:hidden;
        }
        .section-panel-header {
          display:flex; align-items:center; justify-content:space-between;
          padding:0.85rem 1.25rem;
          background:linear-gradient(90deg,rgba(0,0,0,0.6),rgba(255,140,0,0.05));
          border-bottom:2px solid var(--accent,#FF8C00);
        }
        .sp-title {
          font-family:'Press Start 2P',monospace; font-size:0.75rem;
          color:var(--accent,#FF8C00); letter-spacing:3px; text-shadow:0 0 10px var(--accent,#FF8C00);
        }
        .sp-count { font-family:'VT323',monospace; font-size:1.1rem; color:rgba(255,255,255,0.3); letter-spacing:1px; }
        .section-empty {
          padding:2.5rem; text-align:center;
          font-family:'Press Start 2P',monospace; font-size:0.55rem; color:rgba(255,255,255,0.2); letter-spacing:2px;
        }

        /* ===========================  OPPONENT BLOCKS  =========================== */
        .opp-list { padding:0.6rem; display:flex; flex-direction:column; gap:0.6rem; }
        .opp-block { border-radius:10px; overflow:hidden; border:1px solid rgba(255,140,0,0.15); transition:border-color 0.2s ease; }
        .opp-block:hover { border-color:rgba(255,140,0,0.45); }

        .opp-header {
          position:relative; display:flex; align-items:center; gap:0.9rem; padding:0.75rem 1rem;
          background:linear-gradient(135deg,rgba(0,0,0,0.85) 0%,rgba(20,20,35,0.9) 100%);
          border-bottom:1px solid rgba(255,140,0,0.12); overflow:hidden; min-height:68px;
        }
        .opp-banner-bg { position:absolute; inset:0; z-index:0; overflow:hidden; pointer-events:none; }
        .opp-banner-img {
          position:absolute; right:-10px; top:50%; transform:translateY(-50%);
          height:160%; opacity:0.15; filter:blur(0.5px) brightness(1.3);
          mask-image:linear-gradient(to left,rgba(0,0,0,0.95) 0%,rgba(0,0,0,0.4) 40%,transparent 100%);
          -webkit-mask-image:linear-gradient(to left,rgba(0,0,0,0.95) 0%,rgba(0,0,0,0.4) 40%,transparent 100%);
        }
        .opp-logo-wrap {
          position:relative; z-index:2; flex-shrink:0;
          width:46px; height:46px; background:rgba(0,0,0,0.5); border-radius:9px; padding:4px;
          border:1.5px solid rgba(135,206,235,0.3); box-shadow:0 0 10px rgba(135,206,235,0.1);
          display:flex; align-items:center; justify-content:center; transition:all 0.3s ease;
        }
        .opp-block:hover .opp-logo-wrap { border-color:rgba(255,140,0,0.6); box-shadow:0 0 15px rgba(255,140,0,0.3); }
        .opp-logo { width:100%; height:100%; object-fit:contain; filter:drop-shadow(0 0 4px rgba(135,206,235,0.3)); transition:all 0.3s ease; }
        .opp-block:hover .opp-logo { filter:drop-shadow(0 0 10px rgba(255,140,0,0.8)); transform:scale(1.1); }
        .opp-fallback { font-family:'Press Start 2P',monospace; font-size:0.4rem; color:#87CEEB; text-align:center; }

        .opp-h2h { position:relative; z-index:2; flex:1; }
        .opp-h2h-label {
          font-family:'Press Start 2P',monospace; font-size:0.38rem;
          color:rgba(255,140,0,0.5); letter-spacing:2px; margin-bottom:0.45rem;
        }
        .opp-h2h-stats { display:flex; flex-wrap:wrap; gap:0.5rem; align-items:center; }
        .h2h-stat-item {
          display:flex; flex-direction:column; align-items:center;
          background:rgba(0,0,0,0.4); border:1px solid rgba(255,140,0,0.18);
          border-radius:7px; padding:0.22rem 0.6rem; min-width:38px;
        }
        .h2h-stat-val { font-family:'VT323',monospace; font-size:1.55rem; line-height:1; letter-spacing:1px; }
        .h2h-stat-lbl { font-family:'Press Start 2P',monospace; font-size:0.34rem; color:rgba(255,255,255,0.35); letter-spacing:1px; margin-top:2px; }
        .h2h-w      { color:#00FF64; text-shadow:0 0 8px #00FF64; }
        .h2h-l      { color:#FF3C3C; text-shadow:0 0 8px #FF3C3C; }
        .h2h-t      { color:#87CEEB; text-shadow:0 0 8px #87CEEB; }
        .h2h-otl    { color:#FFA500; text-shadow:0 0 8px #FFA500; }
        .h2h-gf     { color:#FFD700; }
        .h2h-ga     { color:rgba(255,255,255,0.45); }
        .h2h-gd-pos { color:#00FF64; text-shadow:0 0 8px #00FF64; }
        .h2h-gd-neg { color:#FF3C3C; text-shadow:0 0 8px #FF3C3C; }
        .h2h-first  { font-family:'Press Start 2P',monospace; font-size:0.4rem; color:rgba(135,206,235,0.4); letter-spacing:1px; }

        /* ===========================  GAME ROWS  =========================== */
        .opp-games { background:rgba(0,0,0,0.3); }
        .game-row {
          display:flex; align-items:center; gap:0.65rem;
          padding:0.5rem 1rem 0.5rem 0.75rem;
          border-bottom:1px solid rgba(255,255,255,0.04); transition:background 0.2s ease;
        }
        .game-row:last-child { border-bottom:none; }
        .game-row:hover      { background:rgba(255,140,0,0.07); }
        .game-row.win        { background:rgba(0,255,100,0.04); }
        .game-row.win:hover  { background:rgba(0,255,100,0.09); }
        .game-row.loss       { background:rgba(255,60,60,0.04); }
        .game-row.loss:hover { background:rgba(255,60,60,0.09); }
        .game-row.otl        { background:rgba(255,165,0,0.04); }

        .venue-pip { width:3px; height:30px; border-radius:3px; flex-shrink:0; }
        .pip-home  { background:linear-gradient(180deg,#00C864,#007A3D); box-shadow:0 0 6px #00C864; }
        .pip-away  { background:linear-gradient(180deg,#87CEEB,#4682B4); box-shadow:0 0 6px #87CEEB; }
        .venue-tag { font-family:'Press Start 2P',monospace; font-size:0.42rem; color:rgba(255,255,255,0.3); letter-spacing:1px; width:12px; flex-shrink:0; }
        .game-score { display:flex; align-items:center; gap:0.3rem; font-family:'VT323',monospace; font-size:1.5rem; letter-spacing:1px; flex:1; }
        .game-score.win  .gs-mine { color:#00FF64; text-shadow:0 0 10px #00FF64; }
        .game-score.loss .gs-mine { color:#FF3C3C; text-shadow:0 0 10px #FF3C3C; }
        .game-score.otl  .gs-mine { color:#FFA500; text-shadow:0 0 10px #FFA500; }
        .game-score.tie  .gs-mine { color:#87CEEB; }
        .gs-mine   { color:#FFD700; font-weight:bold; }
        .gs-dash   { color:rgba(255,255,255,0.25); }
        .gs-theirs { color:rgba(255,255,255,0.55); }
        .gs-ot {
          font-family:'Press Start 2P',monospace; font-size:0.38rem; color:#87CEEB;
          background:rgba(135,206,235,0.1); border:1px solid rgba(135,206,235,0.3);
          border-radius:3px; padding:1px 4px; margin-left:2px; letter-spacing:1px;
        }
        .game-result-badge { font-family:'Press Start 2P',monospace; font-size:0.48rem; letter-spacing:1px; padding:3px 7px; border-radius:5px; flex-shrink:0; }
        .game-result-badge.win  { color:#00FF64; background:rgba(0,255,100,0.1);   border:1px solid rgba(0,255,100,0.3);   text-shadow:0 0 6px #00FF64; }
        .game-result-badge.loss { color:#FF3C3C; background:rgba(255,60,60,0.1);   border:1px solid rgba(255,60,60,0.3);   text-shadow:0 0 6px #FF3C3C; }
        .game-result-badge.otl  { color:#FFA500; background:rgba(255,165,0,0.1);   border:1px solid rgba(255,165,0,0.3);   text-shadow:0 0 6px #FFA500; }
        .game-result-badge.tie  { color:#87CEEB; background:rgba(135,206,235,0.1); border:1px solid rgba(135,206,235,0.3); }

        /* ===========================  RESPONSIVE  =========================== */
        @media (max-width:1100px) { .split-layout { grid-template-columns:1fr; } }
        @media (max-width:768px) {
          .led-text { font-size:1.2rem; letter-spacing:3px; }
          .scoreboard-header { padding:1rem 1.5rem; }
          .control-panel { flex-direction:column; gap:1rem; }
          .hero-stat { width:64px; }
          .hero-val { font-size:1.8rem; }
          .hero-lbl { font-size:0.44rem; }
          .hero-logo-col { width:80px; height:80px; }
        }
      `}</style>
    </div>
  );
}
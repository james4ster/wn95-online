import React, { useEffect, useState } from 'react';
import { useLeague } from '../components/LeagueContext';
import { supabase } from '../utils/supabaseClient';

const GAMES_PER_OPPONENT = 2; // adjust if format changes

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
  const [activeTab, setActiveTab] = useState('remaining');
  const [playedCountByOpp, setPlayedCountByOpp] = useState({});

  useEffect(() => {
    if (!selectedLeague) { setSeasons([]); setSelectedSeason(''); return; }
    (async () => {
      const { data, error } = await supabase.from('seasons').select('lg, year').order('year', { ascending: false });
      if (error) return;
      const filtered = data.filter(s => s.lg.startsWith(selectedLeague));
      setSeasons(filtered);
      if (filtered.length > 0) setSelectedSeason(filtered[0].lg);
    })();
  }, [selectedLeague]);

  useEffect(() => {
    if (!selectedSeason) { setTeams([]); setSelectedTeamAbr(''); return; }
    (async () => {
      const { data, error } = await supabase
        .from('teams').select('team, abr').eq('lg', selectedSeason).order('team', { ascending: true });
      if (error || !data || data.length === 0) { setTeams([]); setSelectedTeamAbr(''); return; }
      setTeams(data);
      setSelectedTeamAbr(data[0].abr);
    })();
  }, [selectedSeason]);

  useEffect(() => {
    if (!selectedSeason || !selectedTeamAbr) {
      setCompletedGames([]); setRemainingOpponents([]); setH2hRecords({}); setSeasonStats(null); return;
    }
    (async () => {
      setLoading(true);

      const { data: standingsData } = await supabase
        .from('standings').select('*')
        .eq('season', selectedSeason).ilike('team', selectedTeamAbr).single();
      setSeasonStats(standingsData || null);

      // Season games — still by team abr (correct for this season series)
      const [homeRes, awayRes] = await Promise.all([
        supabase.from('games').select('*').eq('lg', selectedSeason).or('mode.eq.Season,mode.eq.season').ilike('home', selectedTeamAbr).not('score_home', 'is', null),
        supabase.from('games').select('*').eq('lg', selectedSeason).or('mode.eq.Season,mode.eq.season').ilike('away', selectedTeamAbr).not('score_home', 'is', null),
      ]);
      const played = [...(homeRes.data || []), ...(awayRes.data || [])].sort((a, b) => a.id - b.id);
      setCompletedGames(played);

      // Count played games per opponent
// Current season teams — needed for remaining + coach lookups
const { data: allTeamsData } = await supabase
  .from('teams').select('team, abr, coach').eq('lg', selectedSeason);

// Count played games per opponent
// Count played games per opponent
const playedCountByOpp = {};
played.forEach(g => {
  const opp = (g.home.toLowerCase() === selectedTeamAbr.toLowerCase() ? g.away : g.home).toLowerCase();
  playedCountByOpp[opp] = (playedCountByOpp[opp] || 0) + 1;
  setPlayedCountByOpp(playedCountByOpp);
});

// Fetch total scheduled games per opponent (all games, played or not)
const [scheduledHomeRes, scheduledAwayRes] = await Promise.all([
  supabase.from('games').select('home,away').eq('lg', selectedSeason).or('mode.eq.Season,mode.eq.season').ilike('home', selectedTeamAbr),
  supabase.from('games').select('home,away').eq('lg', selectedSeason).or('mode.eq.Season,mode.eq.season').ilike('away', selectedTeamAbr),
]);

const scheduledCountByOpp = {};
[...(scheduledHomeRes.data || []), ...(scheduledAwayRes.data || [])].forEach(g => {
  const opp = (g.home.toLowerCase() === selectedTeamAbr.toLowerCase() ? g.away : g.home).toLowerCase();
  scheduledCountByOpp[opp] = (scheduledCountByOpp[opp] || 0) + 1;
});

// Remaining = opponents not fully played + opponents not in schedule at all
      const remaining = (allTeamsData || []).filter(t => {
        const key = t.abr.toLowerCase();
        if (key === selectedTeamAbr.toLowerCase()) return false;
        const done = playedCountByOpp[key] || 0;
        return done < GAMES_PER_OPPONENT;
      }).sort((a, b) => a.abr.localeCompare(b.abr));

setRemainingOpponents(remaining);

      // Get selected team's coach name — stable identifier across rebrands
      const selectedTeamRow = (allTeamsData || []).find(t => t.abr.toLowerCase() === selectedTeamAbr.toLowerCase());
      const selectedCoach = selectedTeamRow?.coach;

   // Guard: if no coach found, skip all-time queries
      if (!selectedCoach) {
        setRemainingOpponents(remaining);
        setH2hRecords({});
        setLoading(false);
        return;
      }

      // All-time games: query by coach_home / coach_away — works across rebrands
      // Scoped to same league prefix (e.g. 'W%') so we don't mix leagues
      const leaguePrefix = selectedLeague + '%';
      const [allHome, allAway] = await Promise.all([
        supabase.from('games').select('home,away,coach_home,coach_away,score_home,score_away,result_home,result_away,ot')
  .or('mode.eq.Season,mode.eq.season').like('lg', leaguePrefix).ilike('coach_home', selectedCoach),
supabase.from('games').select('home,away,coach_home,coach_away,score_home,score_away,result_home,result_away,ot')
  .or('mode.eq.Season,mode.eq.season').like('lg', leaguePrefix).ilike('coach_away', selectedCoach),
      ]);
      const allGames = [...(allHome.data || []), ...(allAway.data || [])];

      // Build map: coach name -> current abr (from this season) for keying records
      const coachToCurrentAbr = {};
      (allTeamsData || []).forEach(t => {
        if (t.coach) coachToCurrentAbr[t.coach.toLowerCase()] = t.abr.toLowerCase();
      });

      // For each opponent in the current season, compute all-time H2H by coach name
      const allOpponentAbrs = [...new Set([
        ...played.map(g => g.home.toLowerCase() === selectedTeamAbr.toLowerCase() ? g.away : g.home),
        ...remaining.map(t => t.abr),
      ])];

      // Build reverse map: current abr -> coach (for this season)
      const abrToCoach = {};
      (allTeamsData || []).forEach(t => {
        if (t.coach) abrToCoach[t.abr.toLowerCase()] = t.coach.toLowerCase();
      });

      const records = {};
      allOpponentAbrs.forEach(opp => {
        const oppLower = opp.toLowerCase();
        const oppCoach = abrToCoach[oppLower];

        // Filter all-time games to those involving this opponent's coach
        const h2h = oppCoach
          ? allGames.filter(g =>
              g.coach_home?.toLowerCase() === oppCoach || g.coach_away?.toLowerCase() === oppCoach
            )
          : allGames.filter(g =>
              g.home.toLowerCase() === oppLower || g.away.toLowerCase() === oppLower
            );

        let w = 0, l = 0, t = 0, otl = 0, gf = 0, ga = 0;
        h2h.forEach(g => {
          const isHome = g.coach_home?.toLowerCase() === selectedCoach?.toLowerCase();
          const result = isHome ? g.result_home : g.result_away;
          const myScore = isHome ? g.score_home : g.score_away;
          const theirScore = isHome ? g.score_away : g.score_home;
          if (myScore != null) gf += myScore;
          if (theirScore != null) ga += theirScore;
          if (!result) return;
          const r = result.toUpperCase();
          if (r === 'W' || r === 'OTW') w++;
          else if (r === 'L') l++;
          else if (r === 'OTL') otl++;
          else if (r === 'T') t++;
        });
        records[oppLower] = { w, l, t, otl, gf, ga, gd: gf - ga, gp: h2h.length };
      });
      setH2hRecords(records);
      setLoading(false);
    })();
  }, [selectedSeason, selectedTeamAbr]);

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

  const groupCompletedByOpponent = () => {
    const map = {};
    completedGames.forEach(g => {
      const opp = g.home.toLowerCase() === selectedTeamAbr.toLowerCase() ? g.away : g.home;
      const key = opp.toLowerCase();
      if (!map[key]) map[key] = { opp, games: [] };
      map[key].games.push(g);
    });
    return Object.values(map).sort((a, b) => a.opp.localeCompare(b.opp));
  };

  const completedGroups = groupCompletedByOpponent();

  const seasonRecord = completedGames.reduce((acc, g) => {
    const result = getResult(g);
    if (!result) return acc;
    const r = result.toUpperCase();
    if (r === 'W' || r === 'OTW') acc.w++;
    else if (r === 'L') acc.l++;
    else if (r === 'OTL') acc.otl++;
    else if (r === 'T') acc.t++;
    return acc;
  }, { w: 0, l: 0, otl: 0, t: 0 });

  // ── H2H stat block (always shown inline) ──
  const H2HStats = ({ h2h }) => {
    if (!h2h || h2h.gp === 0) {
      return <span className="first-meeting">FIRST MEETING</span>;
    }
    const gd = h2h.gf - h2h.ga;
    const stats = [
      { val: h2h.w,   lbl: 'W',   cls: 'sv-w'   },
      { val: h2h.l,   lbl: 'L',   cls: 'sv-l'   },
      { val: h2h.t,   lbl: 'T',   cls: ''        },
      { val: h2h.otl, lbl: 'OTL', cls: 'sv-otl' },
      { val: h2h.gf,  lbl: 'GF',  cls: 'sv-gf'  },
      { val: h2h.ga,  lbl: 'GA',  cls: ''        },
      { val: gd > 0 ? `+${gd}` : gd, lbl: 'GD', cls: gd > 0 ? 'sv-pos' : gd < 0 ? 'sv-neg' : '' },
      { val: h2h.gp,  lbl: 'GP',  cls: ''        },
    ];
    return (
      <div className="h2h-inline">
        {stats.map((s, i) => (
          <div key={i} className="sv">
            <span className={`sv-val ${s.cls}`}>{s.val}</span>
            <span className="sv-lbl">{s.lbl}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="schedule-page">

      {/* HEADER */}
      <div className="page-header">
        <div className="header-box">
          <div className="led-text">SCHEDULE</div>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="controls">
        <div className="control-group">
          <label>SEASON</label>
          <select className="sel" value={selectedSeason}
            onChange={e => setSelectedSeason(e.target.value)}
            disabled={!selectedLeague || seasons.length === 0}>
            <option value="">SELECT SEASON</option>
            {seasons.map(s => <option key={s.lg} value={s.lg}>{s.lg} ({s.year})</option>)}
          </select>
        </div>
        <div className="control-group">
          <label>TEAM</label>
          <select className="sel" value={selectedTeamAbr}
            onChange={e => setSelectedTeamAbr(e.target.value)}
            disabled={teams.length === 0}>
            <option value="">SELECT TEAM</option>
            {teams.map(t => <option key={t.abr} value={t.abr}>{t.team}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <div className="loading-text">LOADING...</div>
        </div>
      ) : (
        <div className="page-body">

          {/* COMPACT HERO */}
          {seasonStats && (
            <div className="hero">
              <div className="hero-left">
                <div className="hero-logo-wrap">
                  <img src={`/assets/teamLogos/${selectedTeamAbr}.png`} alt={selectedTeamAbr}
                    className="hero-logo" onError={e => { e.target.style.opacity = '0'; }} />
                </div>
                <div className="hero-team-info">
                  <div className="hero-abr">{selectedTeamAbr}</div>
                  <div className="hero-rank">#{seasonStats.season_rank || '—'}</div>
                </div>
              </div>
              <div className="hero-record">
                <span className="rec-w">{seasonRecord.w}<span className="rec-lbl">W</span></span>
                <span className="rec-sep">–</span>
                <span className="rec-l">{seasonRecord.l}<span className="rec-lbl">L</span></span>
                {seasonRecord.t > 0 && <><span className="rec-sep">–</span><span className="rec-t">{seasonRecord.t}<span className="rec-lbl">T</span></span></>}
                {seasonRecord.otl > 0 && <><span className="rec-sep">–</span><span className="rec-otl">{seasonRecord.otl}<span className="rec-lbl">OTL</span></span></>}
              </div>
              <div className="hero-stats">
                {[
                  { l: 'GP',   v: seasonStats.gp  ?? '—' },
                  { l: 'PTS',  v: seasonStats.pts ?? '—', hi: true },
                  { l: 'GF',   v: seasonStats.gf  ?? '—' },
                  { l: 'GA',   v: seasonStats.ga  ?? '—' },
                  { l: 'GD',   v: seasonStats.gd > 0 ? `+${seasonStats.gd}` : seasonStats.gd ?? '—',
                    pos: seasonStats.gd > 0, neg: seasonStats.gd < 0 },
                  { l: 'GF/G', v: seasonStats.gp > 0 ? (seasonStats.gf / seasonStats.gp).toFixed(2) : '—', sm: true },
                  { l: 'GA/G', v: seasonStats.gp > 0 ? (seasonStats.ga / seasonStats.gp).toFixed(2) : '—', sm: true },
                ].map(s => (
                  <div key={s.l} className="hs">
                    <div className={`hs-v${s.hi ? ' hi' : s.pos ? ' pos' : s.neg ? ' neg' : s.sm ? ' sm' : ''}`}>{s.v}</div>
                    <div className="hs-l">{s.l}</div>
                  </div>
                ))}
              </div>

              {/* Mobile-only: 3 key stats below the record */}
              <div className="hero-stats-mobile">
                {[
                  { l: 'PTS', v: seasonStats.pts ?? '—', cls: 'hi' },
                  { l: 'GF',  v: seasonStats.gf  ?? '—', cls: '' },
                  { l: 'GA',  v: seasonStats.ga  ?? '—', cls: '' },
                  { l: 'GD',  v: seasonStats.gd > 0 ? `+${seasonStats.gd}` : seasonStats.gd ?? '—',
                    cls: seasonStats.gd > 0 ? 'pos' : seasonStats.gd < 0 ? 'neg' : '' },
                  { l: 'GP',  v: seasonStats.gp  ?? '—', cls: '' },
                ].map(s => (
                  <div key={s.l} className="hsm">
                    <div className={`hsm-v${s.cls ? ' ' + s.cls : ''}`}>{s.v}</div>
                    <div className="hsm-l">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TABS */}
          <div className="tabs">
            <button className={`tab${activeTab === 'remaining' ? ' tab-active' : ''}`}
              onClick={() => setActiveTab('remaining')}>
              🕐 REMAINING
              <span className="tab-count">{remainingOpponents.length}</span>
            </button>
            <button className={`tab${activeTab === 'completed' ? ' tab-active' : ''}`}
              onClick={() => setActiveTab('completed')}>
              ✅ COMPLETED
              <span className="tab-count">{completedGroups.length}</span>
            </button>
          </div>

          {/* TABLE */}
          <div className="opp-table">

            {/* Column headers */}
            <div className="table-head">
              <div className="th th-opp">OPPONENT</div>
              <div className="th th-season">THIS SEASON</div>
              <div className="th-divider-head" />
              <div className="th th-h2h">ALL-TIME</div>
            </div>

            {activeTab === 'completed' && (
              completedGroups.length === 0
                ? <div className="empty">NO COMPLETED GAMES</div>
                : completedGroups.map(group => {
                    const key = group.opp.toLowerCase();
                    const h2h = h2hRecords[key] || { w:0, l:0, t:0, otl:0, gf:0, ga:0, gd:0, gp:0 };
                    return (
                      <div key={key} className="opp-row">
                        {/* Logo + name */}
                        <div className="cell-opp">
                          <div className="opp-logo-wrap">
                            <img src={`/assets/teamLogos/${group.opp}.png`} alt={group.opp}
                              className="opp-logo" onError={e => { e.target.style.opacity='0'; }} />
                          </div>
                          <span className="opp-abr">{group.opp}</span>
                        </div>

                        {/* This season chips */}
                        <div className="cell-season">
                          <div className="game-chips">
                            {group.games.map(g => {
                              const isHome = g.home.toLowerCase() === selectedTeamAbr.toLowerCase();
                              const result = isHome ? g.result_home : g.result_away;
                              const { cls, label } = getResultMeta(result);
                              // Always display as away–home regardless of who selected team is
                              const awayScore = g.score_away;
                              const homeScore = g.score_home;
                              return (
                                <div key={g.game || g.id} className={`game-chip game-chip-${cls}`}>
                                  <span className="chip-score">{awayScore}–{homeScore}</span>
                                  <span className="chip-result">{label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Visual divider */}
                        <div className="cell-divider" />

                        {/* All-time inline stats */}
                        <div className="cell-h2h">
                          <H2HStats h2h={h2h} />
                        </div>
                      </div>
                    );
                  })
            )}

            {activeTab === 'remaining' && (
              remainingOpponents.length === 0
                ? <div className="empty">NO REMAINING GAMES — SEASON COMPLETE!</div>
                : remainingOpponents.map(team => {
                    const key = team.abr.toLowerCase();
                    const h2h = h2hRecords[key] || { w:0, l:0, t:0, otl:0, gf:0, ga:0, gd:0, gp:0 };
                    return (
                      <div key={key} className="opp-row">
                        <div className="cell-opp">
                          <div className="opp-logo-wrap">
                            <img src={`/assets/teamLogos/${team.abr}.png`} alt={team.abr}
                              className="opp-logo" onError={e => { e.target.style.opacity='0'; }} />
                          </div>
                          <span className="opp-abr">{team.abr}</span>
                        </div>

                        <div className="cell-season">
                            {(() => {
                              const done = playedCountByOpp[team.abr.toLowerCase()] || 0;
                              return done > 0
                                ? <span className="unplayed">{GAMES_PER_OPPONENT - done} GAME{GAMES_PER_OPPONENT - done !== 1 ? 'S' : ''} REMAINING</span>
                                : <span className="unplayed">NOT YET PLAYED</span>;
                            })()}
                          </div>

                        <div className="cell-divider" />

                        <div className="cell-h2h">
                          <H2HStats h2h={h2h} />
                        </div>
                      </div>
                    );
                  })
            )}

          </div>
        </div>
      )}

      <style>{`
        .schedule-page {
          padding: 1rem 1.5rem;
          min-height: 100vh;
          background: radial-gradient(ellipse at top, #0a0a15 0%, #000 100%);
        }

        /* ── HEADER ── */
        .page-header { display:flex; justify-content:center; margin-bottom:1rem; }
        .header-box {
          background:#000; border:6px solid #333; border-radius:8px; padding:1rem 2rem;
          box-shadow:0 0 0 2px #000,inset 0 0 20px rgba(0,0,0,.8),0 8px 16px rgba(0,0,0,.5),0 0 40px rgba(255,215,0,.3);
          position:relative; overflow:hidden;
        }
        .header-box::before {
          content:''; position:absolute; inset:0;
          background:repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px),
            repeating-linear-gradient(90deg,transparent 0px,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px);
          pointer-events:none;
        }
        .header-box::after {
          content:''; position:absolute; top:-50%; left:-50%; width:200%; height:200%;
          background:linear-gradient(45deg,transparent 30%,rgba(255,215,0,.1) 50%,transparent 70%);
          animation:shimmer 3s infinite; pointer-events:none;
        }
        @keyframes shimmer { 0%{transform:translateX(-100%) translateY(-100%) rotate(45deg)} 100%{transform:translateX(100%) translateY(100%) rotate(45deg)} }
        .led-text {
          font-family:'Press Start 2P',monospace; font-size:2rem; color:#FFD700; letter-spacing:6px;
          text-shadow:0 0 10px #FF8C00,0 0 20px #FF8C00,0 0 30px #FFD700;
          filter:contrast(1.3) brightness(1.2); position:relative; z-index:1;
        }

        /* ── CONTROLS ── */
        .controls { display:flex; gap:1.5rem; justify-content:center; margin-bottom:1.25rem; flex-wrap:wrap; }
        .control-group { display:flex; flex-direction:column; gap:.4rem; }
        .control-group label { font-family:'Press Start 2P',monospace; font-size:.6rem; color:#FF8C00; letter-spacing:2px; }
        .sel {
          background:linear-gradient(180deg,#1a1a2e,#0a0a15); color:#87CEEB;
          border:3px solid #87CEEB; padding:.55rem .9rem;
          font-family:'VT323',monospace; font-size:1.2rem; cursor:pointer; border-radius:8px;
          transition:all .2s; min-width:200px;
        }
        .sel:hover:not(:disabled) { border-color:#FFD700; color:#FFD700; }
        .sel:disabled { opacity:.4; cursor:not-allowed; }

        /* ── LOADING ── */
        .loading-screen { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:300px; gap:1.5rem; }
        .loading-spinner { width:50px; height:50px; border:5px solid rgba(255,140,0,.2); border-top:5px solid #FF8C00; border-radius:50%; animation:spin 1s linear infinite; }
        @keyframes spin { to{transform:rotate(360deg)} }
        .loading-text { font-family:'Press Start 2P',monospace; font-size:.8rem; color:#87CEEB; animation:blink 1.5s ease-in-out infinite; }
        @keyframes blink { 0%,100%{opacity:.5} 50%{opacity:1} }

        /* ── PAGE BODY ── */
        .page-body { max-width:1200px; margin:0 auto; }

        /* ── COMPACT HERO ── */
        .hero {
          display:flex; align-items:center; gap:1rem; flex-wrap:wrap;
          background:linear-gradient(135deg,#0d0d1a,#111125);
          border:2px solid rgba(255,140,0,.4); border-radius:14px;
          padding:1rem 1.25rem; margin-bottom:1rem; position:relative; overflow:hidden;
        }
        .hero::before {
          content:''; position:absolute; top:0; left:0; right:0; height:2px;
          background:linear-gradient(90deg,transparent,#FF8C00,#FFD700,#FF8C00,transparent);
        }
        .hero-left { display:flex; align-items:center; gap:.75rem; flex-shrink:0; }
        .hero-logo-wrap {
          width:60px; height:60px; background:rgba(0,0,0,.5); border-radius:10px; padding:5px;
          border:2px solid rgba(255,140,0,.5); box-shadow:0 0 20px rgba(255,140,0,.3);
          display:flex; align-items:center; justify-content:center;
        }
        .hero-logo { width:100%; height:100%; object-fit:contain; }
        .hero-team-info { display:flex; flex-direction:column; }
        .hero-abr { font-family:'Press Start 2P',monospace; font-size:.8rem; color:#FFD700; }
        .hero-rank { font-family:'VT323',monospace; font-size:1.4rem; color:rgba(255,215,0,.5); }
        .hero-record { display:flex; align-items:baseline; gap:.4rem; flex-shrink:0; }
        .hero-record > span { font-family:'VT323',monospace; font-size:2.2rem; display:flex; align-items:baseline; gap:.15rem; }
        .rec-lbl { font-family:'Press Start 2P',monospace; font-size:.42rem; opacity:.7; margin-left:1px; }
        .rec-w { color:#00FF64 !important; }
        .rec-l { color:#FF3C3C !important; }
        .rec-t { color:#87CEEB !important; }
        .rec-otl { color:#FFA500 !important; }
        .rec-sep { color:rgba(255,255,255,.2) !important; font-size:1.6rem !important; }
        .hero-stats { display:flex; flex-wrap:wrap; gap:0; flex:1; }
        .hs { display:flex; flex-direction:column; align-items:center; padding:.2rem .6rem; border-right:1px solid rgba(255,140,0,.15); }
        .hs:last-child { border-right:none; }
        .hs-v { font-family:'VT323',monospace; font-size:1.8rem; line-height:1; color:#E0E0E0; }
        .hs-v.hi  { color:#FFD700; text-shadow:0 0 10px #FFD700; }
        .hs-v.pos { color:#00FF64; }
        .hs-v.neg { color:#FF3C3C; }
        .hs-v.sm  { font-size:1.5rem; color:#87CEEB; }
        .hs-l { font-family:'Press Start 2P',monospace; font-size:.38rem; color:rgba(255,140,0,.7); margin-top:2px; }

        /* mobile hero stats — hidden on desktop */
        .hero-stats-mobile { display:none; }

        /* ── TABS ── */
        .tabs { display:flex; gap:.5rem; margin-bottom:.75rem; }
        .tab {
          flex:1; display:flex; align-items:center; justify-content:center; gap:.5rem;
          padding:.65rem 1rem; background:rgba(0,0,0,.5); border:2px solid rgba(255,255,255,.1);
          border-radius:8px; color:rgba(255,255,255,.4); cursor:pointer;
          font-family:'Press Start 2P',monospace; font-size:.52rem; letter-spacing:1px;
          transition:all .2s;
        }
        .tab:hover { border-color:rgba(255,140,0,.4); color:rgba(255,255,255,.7); }
        .tab-active { background:rgba(255,140,0,.1); border-color:#FF8C00; color:#FF8C00; text-shadow:0 0 10px rgba(255,140,0,.5); }
        .tab-count {
          background:rgba(0,0,0,.5); border:1px solid rgba(255,255,255,.15);
          border-radius:10px; padding:.1rem .45rem;
          font-family:'VT323',monospace; font-size:1rem; color:rgba(255,255,255,.5);
        }
        .tab-active .tab-count { border-color:rgba(255,140,0,.4); color:#FF8C00; }

        /* ── TABLE ── */
        .opp-table {
          background:linear-gradient(180deg,#0a0a15,#080810);
          border:2px solid rgba(255,140,0,.2); border-radius:12px; overflow:hidden;
        }

        /* Grid: logo+name | season chips | divider | all-time stats */
        .table-head {
          display:grid;
          grid-template-columns: 130px minmax(180px,1fr) 2px minmax(360px,1.6fr);
          gap: .5rem;
          padding: .6rem 1rem;
          background: rgba(255,140,0,.1);
          border-bottom: 2px solid rgba(255,140,0,.3);
          align-items: center;
        }
        .th {
          font-family:'Press Start 2P',monospace; font-size:.58rem;
          color:#FFD700; letter-spacing:2px;
          text-shadow:0 0 8px rgba(255,200,0,.4);
        }
        .th-divider-head { /* no label, just spacing */ }

        .opp-row {
          display:grid;
          grid-template-columns: 130px minmax(180px,1fr) 2px minmax(360px,1.6fr);
          gap: .5rem;
          padding: .65rem 1rem;
          align-items: center;
          border-bottom: 1px solid rgba(255,255,255,.05);
          transition: background .15s;
        }
        .opp-row:last-child { border-bottom: none; }
        .opp-row:hover { background: rgba(255,140,0,.04); }

        /* ── CELLS ── */
        .cell-opp { display:flex; align-items:center; gap:.6rem; }
        .opp-logo-wrap {
          width:38px; height:38px; background:rgba(0,0,0,.4); border-radius:7px; padding:3px;
          border:1px solid rgba(135,206,235,.25); display:flex; align-items:center; justify-content:center; flex-shrink:0;
        }
        .opp-logo { width:100%; height:100%; object-fit:contain; }
        .opp-abr { font-family:'Press Start 2P',monospace; font-size:.62rem; color:#E0E0E0; letter-spacing:1px; }

        /* vertical rule divider */
        .cell-divider {
          width: 1px;
          align-self: stretch;
          background: linear-gradient(180deg, transparent, rgba(255,140,0,.35) 20%, rgba(255,140,0,.35) 80%, transparent);
        }

        .cell-season { display:flex; align-items:center; }
        .game-chips { display:flex; flex-wrap:wrap; gap:.35rem; }
        .game-chip {
          display:flex; align-items:center; gap:.3rem;
          padding:.28rem .55rem; border-radius:6px; border:1px solid rgba(255,255,255,.1);
          background:rgba(0,0,0,.3);
        }
        .game-chip-win  { border-color:rgba(0,255,100,.35);  background:rgba(0,255,100,.08); }
        .game-chip-loss { border-color:rgba(255,60,60,.35);   background:rgba(255,60,60,.08); }
        .game-chip-otl  { border-color:rgba(255,165,0,.35);   background:rgba(255,165,0,.08); }
        .game-chip-tie  { border-color:rgba(135,206,235,.35); background:rgba(135,206,235,.08); }
        .chip-venue { font-family:'Press Start 2P',monospace; font-size:.38rem; color:rgba(255,255,255,.35); }
        .chip-score { font-family:'VT323',monospace; font-size:1.45rem; line-height:1; color:#E0E0E0; }
        .game-chip-win  .chip-score { color:#00FF64; }
        .game-chip-loss .chip-score { color:#FF3C3C; }
        .game-chip-otl  .chip-score { color:#FFA500; }
        .chip-result { font-family:'Press Start 2P',monospace; font-size:.38rem; }
        .game-chip-win  .chip-result { color:#00FF64; }
        .game-chip-loss .chip-result { color:#FF3C3C; }
        .game-chip-otl  .chip-result { color:#FFA500; }
        .game-chip-tie  .chip-result { color:#87CEEB; }
        .unplayed { font-family:'Press Start 2P',monospace; font-size:.42rem; color:rgba(255,255,255,.2); letter-spacing:1px; }

        /* ── ALL-TIME INLINE STATS ── */
        .cell-h2h { display:flex; align-items:center; min-width:0; }
        .h2h-inline { display:flex; flex-wrap:nowrap; gap:.25rem; align-items:center; }

        .sv {
          display:flex; flex-direction:column; align-items:center;
          background:rgba(0,0,0,.35); border:1px solid rgba(255,140,0,.18);
          border-radius:6px; padding:.2rem .45rem; min-width:36px; flex-shrink:0;
        }
        .sv-val {
          font-family:'VT323',monospace; font-size:1.45rem; line-height:1;
          color:rgba(255,255,255,.75);
        }
        .sv-lbl {
          font-family:'Press Start 2P',monospace; font-size:.36rem;
          color:rgba(255,190,0,.75); letter-spacing:1px; margin-top:1px;
        }
        /* value colors */
        .sv-w   { color:#00FF64; text-shadow:0 0 8px rgba(0,255,100,.5); }
        .sv-l   { color:#FF3C3C; text-shadow:0 0 8px rgba(255,60,60,.5); }
        .sv-otl { color:#FFA500; }
        .sv-gf  { color:#FFD700; }
        .sv-pos { color:#00FF64; text-shadow:0 0 8px rgba(0,255,100,.5); }
        .sv-neg { color:#FF3C3C; text-shadow:0 0 8px rgba(255,60,60,.5); }

        .first-meeting { font-family:'Press Start 2P',monospace; font-size:.42rem; color:rgba(135,206,235,.45); letter-spacing:1px; }

        .empty {
          padding:2.5rem; text-align:center;
          font-family:'Press Start 2P',monospace; font-size:.55rem;
          color:rgba(255,255,255,.2); letter-spacing:2px;
        }

        /* ── RESPONSIVE ── */
        @media (max-width:768px) {
          .schedule-page { padding:.65rem; }
          .led-text { font-size:1.2rem; letter-spacing:3px; }

          /* HERO: compact stacked layout */
          .hero { flex-direction:column; align-items:stretch; gap:.65rem; padding:.85rem; }
          .hero-left { justify-content:flex-start; }
          .hero-record { justify-content:flex-start; }
          .hero-record > span { font-size:2rem; }
          .rec-lbl { font-size:.45rem; }

          /* hide full stat grid, show mobile 3-stat row */
          .hero-stats { display:none; }
          .hero-stats-mobile {
            display:flex; gap:0;
            border-top:1px solid rgba(255,140,0,.2); padding-top:.6rem;
          }
          .hsm {
            display:flex; flex-direction:column; align-items:center; flex:1;
            border-right:1px solid rgba(255,140,0,.15);
          }
          .hsm:last-child { border-right:none; }
          .hsm-v { font-family:'VT323',monospace; font-size:2rem; line-height:1; color:#E0E0E0; }
          .hsm-v.hi  { color:#FFD700; text-shadow:0 0 10px #FFD700; }
          .hsm-v.pos { color:#00FF64; }
          .hsm-v.neg { color:#FF3C3C; }
          .hsm-l { font-family:'Press Start 2P',monospace; font-size:.4rem; color:rgba(255,140,0,.7); margin-top:3px; }

          /* TABS */
          .tab { font-size:.45rem; padding:.6rem .5rem; }

          /* TABLE: hide column headers, switch to stacked cards */
          .table-head { display:none; }

          .opp-row {
            display:flex; flex-direction:column; gap:0;
            padding:0; border-bottom:2px solid rgba(255,140,0,.12);
          }
          .opp-row:last-child { border-bottom:none; }

          /* Card row 1: logo + team name */
          .cell-opp {
            display:flex; align-items:center; gap:.65rem;
            padding:.7rem .85rem .35rem;
          }
          .opp-logo-wrap { width:44px; height:44px; }
          .opp-abr { font-size:.7rem; }

          /* Card row 2: season chips */
          .cell-season { display:flex; padding:.1rem .85rem .45rem; }
          .game-chips { gap:.35rem; }
          .chip-score { font-size:1.3rem; }
          .chip-result { font-size:.4rem; }
          .game-chip { padding:.25rem .5rem; }

          /* Horizontal rule divider */
          .cell-divider {
            width:auto; height:1px; align-self:auto;
            margin:0 .85rem;
            background:linear-gradient(90deg,transparent,rgba(255,140,0,.3) 20%,rgba(255,140,0,.3) 80%,transparent);
          }

          /* Card row 3: all-time stats (scrollable if needed) */
          .cell-h2h {
            padding:.45rem .85rem .75rem;
            overflow-x:auto;
            -webkit-overflow-scrolling:touch;
          }
          .h2h-inline { flex-wrap:nowrap; gap:.28rem; }
          .sv { min-width:33px; padding:.18rem .36rem; border-radius:5px; }
          .sv-val { font-size:1.25rem; }
          .sv-lbl { font-size:.33rem; }

          .first-meeting { font-size:.4rem; }
          .unplayed { font-size:.4rem; padding:.5rem 0; }
        }
      `}</style>
    </div>
  );
}
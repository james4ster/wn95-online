import React, { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

export default function Managers() {
  const [managers, setManagers]           = useState([]);
  const [managerMeta, setManagerMeta]     = useState({});
  const [selectedMgr, setSelectedMgr]     = useState('');
  const [teams, setTeams]                 = useState([]);
  const [careerStats, setCareerStats]     = useState(null);
  const [leagueStats, setLeagueStats]     = useState({});
  const [championships, setChampionships] = useState([]);
  const [loading, setLoading]             = useState(false);
  const [activeTab, setActiveTab]         = useState('overview');
  const [twitchLive, setTwitchLive]       = useState(false);
  const [bannerAbr, setBannerAbr]         = useState(null);

  // ─── Load managers + meta ───────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const [{ data: coachData }, { data: metaData }] = await Promise.all([
        supabase.from('unique_managers_vw').select('coach').order('coach', { ascending: true }),
        supabase.from('managers').select('*'),
      ]);
      const unique = [...new Set((coachData || []).map(r => r.coach).filter(Boolean))];
      setManagers(unique);
            const map = {};
            const mapLower = {};
            (metaData || []).forEach(m => { 
              map[m.coach_name] = m; 
              mapLower[m.coach_name?.toLowerCase().trim()] = m;
            });
            setManagerMeta(map);
      if (unique.length > 0) setSelectedMgr(unique[0]);
    })();
  }, []);

  // ─── Load selected manager data ─────────────────────────────────────────────
  useEffect(() => {
    if (!selectedMgr) {
      setTeams([]); setCareerStats(null); setLeagueStats({});
      setChampionships([]); setTwitchLive(false); setBannerAbr(null);
      return;
    }
    (async () => {
      setLoading(true);

      const { data: teamsData } = await supabase
        .from('unique_teams_vw').select('*').eq('coach', selectedMgr).order('lg', { ascending: false });
      setTeams(teamsData || []);

      // Find the W-league team for the banner (lg starts with 'W')
      const wTeam = (teamsData || []).find(t => t.lg && t.lg.toUpperCase().startsWith('W'));
      setBannerAbr(wTeam?.abr || teamsData?.[0]?.abr || null);

      // Standings
      const { data: rows } = await supabase.from('standings').select('*').eq('coach', selectedMgr);
      if (rows?.length) {
        const sf = ['season','lg','season_id','year'].find(f => rows[0][f] !== undefined) || null;

        const tot = rows.reduce((a, s) => ({
          gp:a.gp+(s.gp||0), w:a.w+(s.w||0), l:a.l+(s.l||0),
          t:a.t+(s.t||0), otl:a.otl+(s.otl||0), pts:a.pts+(s.pts||0),
          gf:a.gf+(s.gf||0), ga:a.ga+(s.ga||0), seasons:a.seasons+1,
        }), { gp:0,w:0,l:0,t:0,otl:0,pts:0,gf:0,ga:0,seasons:0 });
        tot.gd   = tot.gf - tot.ga;
        tot.wpct = tot.gp > 0 ? ((tot.w/tot.gp)*100).toFixed(1) : '0.0';
        tot.gfpg = tot.gp > 0 ? (tot.gf/tot.gp).toFixed(2) : '0.00';
        tot.gapg = tot.gp > 0 ? (tot.ga/tot.gp).toFixed(2) : '0.00';
        tot.teams = (teamsData||[]).length; tot.sf = sf;
        setCareerStats(tot);

        const byLg = {};
        rows.forEach(s => {
          const val = sf ? (s[sf] || '') : '';
          const prefix = val.replace(/\d.*/, '').trim() || 'MAIN';
          if (!byLg[prefix]) byLg[prefix] = { rows: [], sf };
          byLg[prefix].rows.push(s);
        });
        Object.values(byLg).forEach(g => {
          g.rows.sort((a, b) => String(g.sf ? (b[g.sf]||'') : '').localeCompare(String(g.sf ? (a[g.sf]||'') : ''), undefined, { numeric:true }));
          g.totals = g.rows.reduce((a, s) => ({
            gp:a.gp+(s.gp||0), w:a.w+(s.w||0), l:a.l+(s.l||0),
            t:a.t+(s.t||0), otl:a.otl+(s.otl||0), pts:a.pts+(s.pts||0),
            gf:a.gf+(s.gf||0), ga:a.ga+(s.ga||0),
          }), { gp:0,w:0,l:0,t:0,otl:0,pts:0,gf:0,ga:0 });
          const t2 = g.totals;
          t2.gd = t2.gf - t2.ga;
          t2.wpct = t2.gp > 0 ? ((t2.w/t2.gp)*100).toFixed(1) : '0.0';
        });
        setLeagueStats(byLg);
      } else { setCareerStats(null); setLeagueStats({}); }

      try {
        const { data: champs } = await supabase.from('championships').select('*').eq('coach', selectedMgr);
        if (champs?.length) {
          const byLg = {};
          champs.forEach(c => {
            const key = (c.season||c.lg||c.season_id||'').replace(/\d.*/,'') || 'MAIN';
            if (!byLg[key]) byLg[key] = [];
            byLg[key].push(c);
          });
          setChampionships(Object.entries(byLg).map(([lg,wins]) => ({ lg, count:wins.length, wins })));
        } else setChampionships([]);
      } catch { setChampionships([]); }

      const mMeta = managerMeta[selectedMgr] || {};
      setTwitchLive(!!mMeta.is_live);
      setLoading(false);
    })();
  }, [selectedMgr]); // eslint-disable-line

  // ─── Derived ─────────────────────────────────────────────────────────────────
  const normalize = s => s?.toLowerCase()
  .replace(/\./g, '')        // remove periods
  .replace(/_/g, ' ')        // convert underscores to spaces
  .replace(/\s+/g, ' ')     // normalize spaces
  .trim();

  const meta = managerMeta[selectedMgr]
    || Object.values(managerMeta).find(m => 
        normalize(m.coach_name) === normalize(selectedMgr) ||
        normalize(m.coach_name)?.includes(normalize(selectedMgr)) ||
        normalize(selectedMgr)?.includes(normalize(m.coach_name))
      )
    || {};
  const latestTeam  = teams[0];
  const totalChamps = championships.reduce((a, c) => a + c.count, 0);

  // Discord avatar — use discord_id directly with the avatar.png endpoint
  // If discord_avatar hash is stored, use it; otherwise use the default avatar
  const discordAvatarUrl = meta.discord_url || null;

  const seenAbr = new Set();
const uniqueTeams = teams.filter(t => {
  if (seenAbr.has(t.abr)) return false;
  seenAbr.add(t.abr);
  return true;
});

const leagueGroups = uniqueTeams.reduce((acc, t) => {
  const prefix = (t.lg||'').replace(/\d.*/,'').toUpperCase()||'OTHER';
  if (!acc[prefix]) acc[prefix] = [];
  acc[prefix].push(t);
  return acc;
}, {});

  // ─── HERO ────────────────────────────────────────────────────────────────────
  const ManagerHero = () => (
    <div className="mgr-hero">
      {/* BANNER — simple img as CSS background, always works */}
      {bannerAbr && (
        <div className="mgr-banner-bg"
          style={{ backgroundImage: `url('/assets/banners/${bannerAbr}.png')` }} />
      )}
      {/* Gradient overlays */}
      <div className="mgr-banner-wave-overlay" />
      <div className="mgr-banner-gradient" />

      {/* Content */}
      <div className="mgr-hero-content">
        <div className="mgr-avatar-stack">
          <div className="mgr-avatar-ring">
            {discordAvatarUrl ? (
              <img src={discordAvatarUrl} alt={selectedMgr}
                className="mgr-avatar-real"
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                onError={e => {
                  console.warn('Avatar failed to load:', e.currentTarget.src);
                  e.currentTarget.style.display = 'none';
                  const sib = e.currentTarget.nextElementSibling;
                  if (sib) sib.style.display = 'flex';
                }}/>
            ) : null}
            <div className="mgr-avatar-placeholder"
              style={{ display: discordAvatarUrl ? 'none' : 'flex' }}>
              <span className="mgr-avatar-initials">
                {selectedMgr.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
              </span>
            </div>
          </div>
          {latestTeam && (
            <div className="mgr-team-badge">
              <img src={`/assets/teamLogos/${latestTeam.abr}.png`}
                alt={latestTeam.abr} className="mgr-team-badge-img"
                onError={e => { e.currentTarget.style.display='none'; }} />
            </div>
          )}
        </div>

        <div className="mgr-identity">
          <div className="mgr-name-row">
            <h1 className="mgr-name">{selectedMgr}</h1>
            {meta.location && <span className="mgr-location">📍 {meta.location}</span>}
          </div>

          {/* Media badges */}
          <div className="mgr-media-badges">
          {meta.discord_username && meta.discord_id && (
  <a href={`https://discord.com/users/${meta.discord_id}`}
     target="_blank" rel="noopener noreferrer"
     className="media-badge media-badge--discord"
     title={`Discord: ${meta.discord_username}`}>
    <span className="media-icon">➤</span>
    <span className="media-lbl">{meta.discord_username}</span>
  </a>
)}

            {meta.twitch_username && (
              <a href={`https://twitch.tv/${meta.twitch_username}`}
                target="_blank" rel="noopener noreferrer"
                className={`media-badge media-badge--twitch${twitchLive?' media-badge--live':''}`}>
                {twitchLive && <span className="live-dot"/>}
                <span className="media-icon">📺</span>
                <span className="media-lbl">{twitchLive ? '🔴 LIVE' : meta.twitch_username}</span>
              </a>
            )}
            {meta.youtube_channel && (
              <a href={meta.youtube_channel} target="_blank" rel="noopener noreferrer"
                className="media-badge media-badge--youtube">
                <span className="media-icon">▶</span>
                <span className="media-lbl">YOUTUBE</span>
              </a>
            )}
          </div>

          <div className="mgr-meta-row">
            {[
              { val: teams.length,                   lbl: 'TEAMS'   },
              { val: Object.keys(leagueGroups).length,lbl: 'LEAGUES' },
              careerStats && { val: careerStats.seasons, lbl: 'SEASONS' },
              careerStats && { val: `${careerStats.wpct}%`, lbl: 'WIN %', hi: true },
              totalChamps > 0 && { val: `🏆 ${totalChamps}`, lbl: 'TITLES', champ: true },
            ].filter(Boolean).map((p,i) => (
              <div key={i} className={`mgr-meta-pill${p.hi?' mgr-meta-highlight':''}${p.champ?' mgr-meta-champ':''}`}>
                <span className="mgr-meta-val">{p.val}</span>
                <span className="mgr-meta-lbl">{p.lbl}</span>
              </div>
            ))}
          </div>

          {championships.length > 0 && (
            <div className="hero-champ-ribbon">
              {championships.map((c,i) => (
                <div key={i} className="hero-champ-chip">
                  <span>🏆</span>
                  <span className="hero-champ-count">{c.count}×</span>
                  <span className="hero-champ-lg">{c.lg}</span>
                </div>
              ))}
            </div>
          )}

          {latestTeam && (
            <div className="mgr-arena-tag">
              🏟 {latestTeam.arena} · {latestTeam.team} · {latestTeam.lg}
            </div>
          )}
        </div>
      </div>

      {/* Tabs — inside hero, at the bottom */}
      <div className="mgr-tabs">
        {[
          { id:'overview', icon:'⚡', label:'OVERVIEW'    },
          { id:'history',  icon:'📜', label:'HISTORY'     },
          { id:'stats',    icon:'📊', label:'CAREER STATS'},
          { id:'media',    icon:'🎙', label:'MEDIA'       },
        ].map(tab => (
          <button key={tab.id}
            className={`mgr-tab${activeTab===tab.id?' mgr-tab--active':''}`}
            onClick={() => setActiveTab(tab.id)}>
            <span className="mgr-tab-icon">{tab.icon}</span>
            <span className="mgr-tab-label">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // ─── Championships full section ───────────────────────────────────────────────
  const ChampSection = ({ compact=false }) => {
    if (!championships.length) return null;
    return (
      <div className={`champ-banner${compact?' champ-banner--compact':''}`}>
        <div className="champ-banner-title">
          <span className="champ-trophy-anim">🏆</span>
          {compact ? 'TITLE HAUL' : 'CHAMPIONSHIPS'}
          <span className="champ-trophy-anim" style={{animationDelay:'0.75s'}}>🏆</span>
        </div>
        <div className={`champ-league-row${compact?' champ-league-row--compact':''}`}>
          {championships.map((c,i) => compact ? (
            <div key={i} className="champ-compact-block">
              <span className="champ-compact-count">{c.count}×</span>
              <span className="champ-compact-lg">{c.lg}</span>
            </div>
          ) : (
            <div key={i} className="champ-league-block">
              <div className="champ-count">{c.count}</div>
              <div className="champ-league-name">{c.lg}</div>
              <div className="champ-cups">
                {Array.from({length:Math.min(c.count,8)}).map((_,j) => (
                  <span key={j} className="champ-cup-icon"
                    style={{animationDelay:`${j*0.18}s`}}>🏆</span>
                ))}
              </div>
              <div className="champ-season-list">
                {c.wins.map((w,j) => (
                  <span key={j} className="champ-season-tag">
                    {w.season||w.lg||w.season_id||''}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ─── Overview ─────────────────────────────────────────────────────────────────
  const OverviewTab = () => (
    <div className="tab-content">
      <ChampSection />
      {careerStats && (
        <div className="career-strip">
          <div className="career-strip-title">CAREER AT A GLANCE</div>
          <div className="career-stats-row">
            {[
              {lbl:'GP',  val:careerStats.gp,  cls:''},
              {lbl:'W',   val:careerStats.w,   cls:'cs-w'},
              {lbl:'L',   val:careerStats.l,   cls:'cs-l'},
              {lbl:'T',   val:careerStats.t,   cls:''},
              {lbl:'OTL', val:careerStats.otl, cls:'cs-otl'},
              {lbl:'PTS', val:careerStats.pts, cls:'cs-pts'},
              {lbl:'GF',  val:careerStats.gf,  cls:''},
              {lbl:'GA',  val:careerStats.ga,  cls:''},
              {lbl:'GD',  val:careerStats.gd>0?`+${careerStats.gd}`:careerStats.gd,
               cls:careerStats.gd>0?'cs-pos':careerStats.gd<0?'cs-neg':''},
              {lbl:'GF/G',val:careerStats.gfpg,cls:'cs-sub'},
              {lbl:'GA/G',val:careerStats.gapg,cls:'cs-sub'},
            ].map(s => (
              <div key={s.lbl} className="cs-cell">
                <div className={`cs-val ${s.cls}`}>{s.val}</div>
                <div className="cs-lbl">{s.lbl}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="section-block">
        <div className="section-block-title"><span className="sbt-icon">🏒</span> TEAMS COACHED</div>
        {Object.entries(leagueGroups).map(([lg, lgTeams]) => (
          <div key={lg} className="league-team-group">
            <div className="league-team-group-header">
              {lg} LEAGUE · {lgTeams.length} TEAM{lgTeams.length>1?'S':''}
            </div>
            <div className="league-team-strip">
              {lgTeams.map((t,i) => (
                <div key={i} className="strip-card" title={`${t.team} · ${t.lg} · ${t.arena}`}>
                  <div className="strip-logo-wrap">
                    <img src={`/assets/teamLogos/${t.abr}.png`} alt={t.abr} className="strip-logo"
                      onError={e => {
                        e.currentTarget.style.display='none';
                        e.currentTarget.nextElementSibling.style.display='flex';
                      }} />
                    <div className="strip-logo-fallback" style={{display:'none'}}>{t.abr}</div>
                  </div>
                  <div className="strip-abr">{t.abr}</div>
                  <div className="strip-season">{t.lg}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ─── History ──────────────────────────────────────────────────────────────────
  const HistoryTab = () => (
    <div className="tab-content">
      <div className="section-block">
        <div className="section-block-title"><span className="sbt-icon">📜</span> FRANCHISE TIMELINE</div>
        <div className="timeline">
          {teams.map((t,i) => (
            <div key={i} className="timeline-row">
              <div className="tl-connector">
                <div className="tl-dot"/>
                {i<teams.length-1 && <div className="tl-line"/>}
              </div>
              <div className="tl-card">
                <div className="tl-banner">
                  <img src={`/assets/banners/${t.abr}.png`} alt="" className="tl-banner-img"
                    onError={e=>{e.currentTarget.style.display='none';}} />
                </div>
                <div className="tl-logo-wrap">
                  <img src={`/assets/teamLogos/${t.abr}.png`} alt={t.abr} className="tl-logo"
                    onError={e=>{e.currentTarget.style.display='none';}} />
                </div>
                <div className="tl-info">
                  <div className="tl-season">{t.lg}</div>
                  <div className="tl-team">{t.team}</div>
                  <div className="tl-detail">{t.arena}</div>
                  <div className="tl-coming">Season record coming soon...</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ─── Stats ────────────────────────────────────────────────────────────────────
  const StatsTab = () => (
    <div className="tab-content">
      <ChampSection compact />
      {!Object.keys(leagueStats).length && (
        <div className="no-data" style={{minHeight:'160px'}}>
          <div className="no-data-text" style={{fontSize:'0.7rem'}}>NO STATS FOUND</div>
        </div>
      )}
      {Object.entries(leagueStats).map(([lg, data]) => (
        <div key={lg} className="section-block">
          <div className="section-block-title">
            <span className="sbt-icon">📊</span> {lg||'MAIN'} LEAGUE
            <div className="lg-stat-pills">
              <span className="lg-pill cs-w">{data.totals.w}W</span>
              <span className="lg-pill cs-l">{data.totals.l}L</span>
              <span className="lg-pill cs-pts">{data.totals.pts}PTS</span>
              <span className="lg-pill">{data.totals.wpct}%</span>
            </div>
          </div>
          <div className="stats-table-wrap">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>SEASON</th><th>TEAM</th><th>GP</th><th>W</th><th>L</th>
                  <th>T</th><th>OTL</th><th>PTS</th><th>PTS%</th><th>GF</th><th>GA</th><th>GD</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((s,i) => {
                  const gd = (s.gf||0)-(s.ga||0);
                  const ptspct = s.gp>0 ? ((s.pts/(s.gp*2))*100).toFixed(1)+'%' : '—';
                  const seasonLabel = data.sf ? (s[data.sf]||'—') : (s.season||s.lg||'—');
                  const teamAbr = s.abr||s.team_abr||s.team||'';
                  return (
                    <tr key={i}>
                      <td className="s-season">{seasonLabel}</td>
                      <td className="s-team">
                        <div className="s-team-cell">
                          <img src={`/assets/teamLogos/${teamAbr}.png`} alt=""
                            className="s-logo"
                            onError={e=>{e.currentTarget.style.display='none';}} />
                        </div>
                      </td>
                      <td>{s.gp||0}</td>
                      <td className="s-w">{s.w||0}</td>
                      <td className="s-l">{s.l||0}</td>
                      <td>{s.t||0}</td>
                      <td>{s.otl||0}</td>
                      <td className="s-pts">{s.pts||0}</td>
                      <td>{ptspct}</td>
                      <td>{s.gf||0}</td>
                      <td>{s.ga||0}</td>
                      <td className={gd>0?'s-pos':gd<0?'s-neg':''}>{gd>0?`+${gd}`:gd}</td>
                    </tr>
                  );
                })}
                <tr className="stats-totals-row">
                  <td className="s-season">TOTAL</td><td>—</td>
                  <td><strong>{data.totals.gp}</strong></td>
                  <td className="s-w"><strong>{data.totals.w}</strong></td>
                  <td className="s-l"><strong>{data.totals.l}</strong></td>
                  <td><strong>{data.totals.t||0}</strong></td>
                  <td><strong>{data.totals.otl||0}</strong></td>
                  <td className="s-pts"><strong>{data.totals.pts}</strong></td>
                  <td><strong>{data.totals.wpct}%</strong></td>
                  <td><strong>{data.totals.gf}</strong></td>
                  <td><strong>{data.totals.ga}</strong></td>
                  <td className={data.totals.gd>0?'s-pos':data.totals.gd<0?'s-neg':''}>
                    <strong>{data.totals.gd>0?`+${data.totals.gd}`:data.totals.gd}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );

  // ─── Media ────────────────────────────────────────────────────────────────────
  const MediaTab = () => (
    <div className="tab-content">
      <div className="media-grid">

        <div className={`media-card media-card--discord${!meta.discord_id?' media-card--inactive':''}`}>
          <div className="media-card-icon">▶</div>
          <div className="media-card-title">DISCORD</div>
          <div className="media-card-body">
            <div className="media-avatar-wrap">
              {discordAvatarUrl ? (
                <img src={discordAvatarUrl} alt={selectedMgr}
                  className="media-discord-avatar"
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                  onError={e => {
                    e.currentTarget.style.display='none';
                    e.currentTarget.nextElementSibling.style.display='flex';
                  }} />
              ) : null}
              <div style={{
                display: discordAvatarUrl ? 'none' : 'flex',
                width:'100%', height:'100%',
                alignItems:'center', justifyContent:'center'
              }}>
                {selectedMgr.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}
              </div>
            </div>
            <div className="media-card-name">{meta.discord_username||selectedMgr}</div>
            {!meta.discord_id && <div className="todo-note">Add <code>discord_id</code></div>}
          </div>
        </div>

        <div className={`media-card media-card--twitch${!meta.twitch_username?' media-card--inactive':''}`}>
          <div className="media-card-icon">📺</div>
          <div className="media-card-title">TWITCH</div>
          <div className="media-card-body">
            {meta.twitch_username ? (
              <>
                <div className={`media-live-badge${twitchLive?' media-live-badge--on':''}`}>
                  <span className={`media-live-dot${twitchLive?' media-live-dot--on':''}`}/>
                  {twitchLive ? 'LIVE NOW' : 'OFFLINE'}
                </div>
                <div className="media-card-name">{meta.twitch_username}</div>
                <a href={`https://twitch.tv/${meta.twitch_username}`}
                  target="_blank" rel="noopener noreferrer"
                  className="media-visit-btn media-visit-btn--twitch">
                  {twitchLive ? '▶ WATCH LIVE' : 'VISIT CHANNEL'}
                </a>
              </>
            ) : <div className="todo-note">Add <code>twitch_username</code></div>}
          </div>
        </div>

        <div className={`media-card media-card--youtube${!meta.youtube_channel?' media-card--inactive':''}`}>
          <div className="media-card-icon">▶</div>
          <div className="media-card-title">YOUTUBE</div>
          <div className="media-card-body">
            {meta.youtube_channel ? (
              <>
                <div className="media-yt-icon">▶</div>
                <div className="media-card-name">YouTube Channel</div>
                <a href={meta.youtube_channel} target="_blank" rel="noopener noreferrer"
                  className="media-visit-btn media-visit-btn--youtube">VISIT CHANNEL</a>
              </>
            ) : <div className="todo-note">Add <code>youtube_channel</code></div>}
          </div>
        </div>

        <div className="media-card media-card--podcast media-card--inactive">
          <div className="media-card-icon">🎙</div>
          <div className="media-card-title">PODCAST</div>
          <div className="media-card-body">
            <div className="media-podcast-placeholder">🎙</div>
            <div className="media-card-name" style={{color:'rgba(255,255,255,0.2)'}}>Coming Soon</div>
            <div className="todo-note">Add <code>podcast_name</code> + <code>podcast_url</code></div>
          </div>
        </div>

      </div>

      {twitchLive && meta.twitch_username && (
        <div style={{marginTop:'2rem'}}>
          <div className="section-block-title">
            <span className="sbt-icon">📺</span> LIVE NOW ON TWITCH
            <span className="live-badge-pill">🔴 LIVE</span>
          </div>
          <iframe
            src={`https://player.twitch.tv/?channel=${meta.twitch_username}&parent=${window.location.hostname}&muted=true`}
            frameBorder="0" allowFullScreen scrolling="no"
            style={{width:'100%',height:'400px',borderRadius:'12px',border:'2px solid rgba(145,70,255,0.4)',display:'block'}}
            title="Twitch Stream"
          />
        </div>
      )}
    </div>
  );

  const tabMap = {
    overview:<OverviewTab/>, history:<HistoryTab/>,
    stats:<StatsTab/>, media:<MediaTab/>
  };

  // ─── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="managers-page">

      <div className="scoreboard-header-container">
        <div className="scoreboard-header">
          <div className="led-text">MANAGERS</div>
        </div>
      </div>

      <div className="control-panel">
        <div className="control-group">
          <label>SELECT MANAGER</label>
          <select className="arcade-select arcade-select--wide" value={selectedMgr}
            onChange={e => { setSelectedMgr(e.target.value); setActiveTab('overview'); }}
            disabled={!managers.length}>
            <option value="">SELECT A MANAGER</option>
            {managers.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen">
          <div className="loading-spinner"/>
          <div className="loading-text">LOADING MANAGER DATA...</div>
        </div>
      ) : !selectedMgr ? (
        <div className="no-data"><div className="no-data-text">SELECT A MANAGER</div></div>
      ) : (
        <div className="page-body">
          <ManagerHero />
          <div className="tab-body">{tabMap[activeTab]}</div>
        </div>
      )}

      <style>{`
        /* ===== PAGE ===== */
        .managers-page { padding:1rem 2rem; min-height:100vh; background:radial-gradient(ellipse at top,#0a0a15 0%,#000 100%); }

        /* ===== HEADER ===== */
        .scoreboard-header-container { display:flex; justify-content:center; margin-bottom:1rem; }
        .scoreboard-header { background:#000; border:6px solid #333; border-radius:8px; padding:1rem 2rem; box-shadow:0 0 0 2px #000,inset 0 0 20px rgba(0,0,0,.8),0 8px 16px rgba(0,0,0,.5),0 0 40px rgba(255,215,0,.3); position:relative; overflow:hidden; }
        .scoreboard-header::before { content:''; position:absolute; inset:0; background:repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px),repeating-linear-gradient(90deg,transparent 0px,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px); pointer-events:none; }
        .scoreboard-header::after { content:''; position:absolute; top:-50%; left:-50%; width:200%; height:200%; background:linear-gradient(45deg,transparent 30%,rgba(255,215,0,.1) 50%,transparent 70%); animation:shimmer 3s infinite; }
        @keyframes shimmer { 0%{transform:translateX(-100%) translateY(-100%) rotate(45deg)} 100%{transform:translateX(100%) translateY(100%) rotate(45deg)} }
        .led-text {
          font-family:'Press Start 2P',monospace; font-size:2rem; color:#FFD700; letter-spacing:6px;
          text-shadow:0 0 10px #FF8C00,0 0 20px #FF8C00,0 0 30px #FFD700;
          filter:contrast(1.3) brightness(1.2); position:relative;
        }

        /* ===== CONTROLS ===== */
        .control-panel { display:flex; gap:2rem; justify-content:center; margin-bottom:1.5rem; flex-wrap:wrap; }
        .control-group { display:flex; flex-direction:column; gap:.5rem; }
        .control-group label { font-family:'Press Start 2P',monospace; font-size:.7rem; color:#FFD700; letter-spacing:2px; }
        .arcade-select { background:linear-gradient(180deg,#1a1a2e,#0a0a15); color:#87CEEB; border:3px solid #87CEEB; padding:.75rem 1rem; font-family:'VT323',monospace; font-size:1.2rem; cursor:pointer; border-radius:8px; transition:all .3s; }
        .arcade-select--wide { min-width:320px; }
        .arcade-select:hover:not(:disabled) { border-color:#FFD700; color:#FFD700; transform:translateY(-2px); }
        .arcade-select:disabled { opacity:.4; cursor:not-allowed; }

        /* ===== LOADING ===== */
        .loading-screen { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:400px; gap:2rem; }
        .loading-spinner { width:60px; height:60px; border:6px solid rgba(255,215,0,.2); border-top:6px solid #FFD700; border-radius:50%; animation:spin 1s linear infinite; }
        @keyframes spin { to{transform:rotate(360deg)} }
        .loading-text { font-family:'Press Start 2P',monospace; font-size:1rem; color:#87CEEB; animation:blink 1.5s ease-in-out infinite; }
        @keyframes blink { 0%,100%{opacity:.5} 50%{opacity:1} }
        .no-data { display:flex; justify-content:center; align-items:center; min-height:400px; }
        .no-data-text { font-family:'Press Start 2P',monospace; font-size:1.2rem; color:#FFD700; letter-spacing:3px; }
        .page-body { margin-top:0; }

        /* ===== HERO ===== */
        /*
          Layout:
            .mgr-hero               — relative container, clips everything
              .mgr-banner-bg         — absolute, fills hero, background-image (the banner PNG)
              .mgr-banner-wave-overlay — absolute, CSS pseudo-wave shimmer on top of banner
              .mgr-banner-gradient   — absolute, fades banner into page bg (bottom)
              .mgr-hero-content      — relative z-index:2, the avatar+identity row
              .mgr-tabs              — relative z-index:2, tab row at bottom
        */
        .mgr-hero {
          position: relative;
          overflow: hidden;
          border-radius: 16px;
        }

        /* The actual banner image — no canvas, no JS, just CSS background */
        .mgr-banner-bg {
          position: absolute;
          inset: 0;
          background-size: cover;
          background-position: center 30%;
          background-repeat: no-repeat;
          /* Visible but not overwhelming — tweak opacity here */
          opacity: 0.35;
          /* Subtle CSS animation to simulate gentle wave/shimmer */
          animation: bannerDrift 12s ease-in-out infinite alternate;
          transform-origin: center;
        }
        @keyframes bannerDrift {
          0%   { transform: scale(1.08) translateX(0px)   skewX(0deg);    }
          20%  { transform: scale(1.06) translateX(-8px)  skewX(-1.5deg); }
          40%  { transform: scale(1.09) translateX(4px)   skewX(0.8deg);  }
          60%  { transform: scale(1.07) translateX(-5px)  skewX(-0.5deg); }
          80%  { transform: scale(1.08) translateX(7px)   skewX(1.2deg);  }
          100% { transform: scale(1.06) translateX(-3px)  skewX(-0.3deg); }
        }

        /* Shimmering light sweep over the banner */
        /* Light leak streaks */
.mgr-banner-wave-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.mgr-banner-wave-overlay::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -60%;
  width: 40%;
  height: 200%;
  background: linear-gradient(
    105deg,
    transparent 0%,
    rgba(255,255,255,0.06) 30%,
    rgba(255,255,255,0.18) 50%,
    rgba(255,255,255,0.06) 70%,
    transparent 100%
  );
  transform: skewX(-15deg);
  animation: lightLeak1 7s ease-in-out infinite;
}

.mgr-banner-wave-overlay::after {
  content: '';
  position: absolute;
  top: -50%;
  left: -80%;
  width: 25%;
  height: 200%;
  background: linear-gradient(
    105deg,
    transparent 0%,
    rgba(255,215,0,0.08) 40%,
    rgba(255,215,0,0.16) 50%,
    rgba(255,215,0,0.08) 60%,
    transparent 100%
  );
  transform: skewX(-15deg);
  animation: lightLeak2 11s ease-in-out infinite 2s;
}

@keyframes lightLeak1 {
  0%   { left: -60%;  opacity: 0;   }
  15%  { opacity: 1;               }
  85%  { opacity: 1;               }
  100% { left: 130%;  opacity: 0;  }
}

@keyframes lightLeak2 {
  0%   { left: -80%;  opacity: 0;  }
  15%  { opacity: 1;               }
  85%  { opacity: 1;               }
  100% { left: 120%;  opacity: 0;  }
}
       

        /* Gradient: transparent top → solid page-bg at bottom */
        .mgr-banner-gradient {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(
            180deg,
            rgba(6,6,16,0.05) 0%,
            rgba(6,6,16,0.35) 35%,
            rgba(6,6,16,0.80) 65%,
            rgba(6,6,16,1.00) 100%
          );
        }

        /* Content row — sits above banner layers */
        .mgr-hero-content {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: flex-end;
          gap: 1.5rem;
          padding: 10rem 1.75rem 0.85rem;
        }

        /* Avatar */
        .mgr-avatar-stack { position:relative; flex-shrink:0; }
        .mgr-avatar-ring { width:100px; height:100px; border-radius:50%; border:3px solid rgba(255,215,0,.85); box-shadow:0 0 25px rgba(255,215,0,.5),0 0 50px rgba(255,215,0,.2); overflow:hidden; background:#0d0d1a; display:flex; align-items:center; justify-content:center; }
        .mgr-avatar-real { width:100%; height:100%; object-fit:cover; display:block; }
        .mgr-avatar-placeholder { width:100%; height:100%; background:linear-gradient(135deg,#1a1a3e,#0d0d25); display:flex; align-items:center; justify-content:center; }
        .mgr-avatar-initials { font-family:'Press Start 2P',monospace; font-size:1.4rem; color:#FFD700; text-shadow:0 0 15px #FFD700; }
        .mgr-team-badge { position:absolute; bottom:-6px; right:-6px; width:40px; height:40px; background:rgba(0,0,0,.9); border-radius:9px; padding:3px; border:2px solid rgba(135,206,235,.65); box-shadow:0 0 12px rgba(135,206,235,.35); display:flex; align-items:center; justify-content:center; }
        .mgr-team-badge-img { width:100%; height:100%; object-fit:contain; }

        /* Identity */
        .mgr-identity { flex:1; min-width:0; }
        .mgr-name-row { display:flex; align-items:center; gap:.75rem; flex-wrap:wrap; margin-bottom:.35rem; }
        .mgr-name { font-family:'Press Start 2P',monospace; font-size:1.35rem; color:#FFD700; letter-spacing:2px; margin:0; text-shadow:0 0 18px rgba(255,215,0,.9),0 0 36px rgba(255,215,0,.4); }
        .mgr-location { font-family:'VT323',monospace; font-size:.95rem; color:rgba(135,206,235,.55); }

        /* Media badges — z-index ensures they're always clickable */
        .mgr-media-badges { display:flex; gap:.4rem; flex-wrap:wrap; margin-bottom:.45rem; }
        .media-badge {
          display:inline-flex; align-items:center; gap:.35rem;
          padding:.3rem .65rem; border-radius:6px;
          font-family:'Press Start 2P',monospace; font-size:.38rem; letter-spacing:1px;
          transition:all .2s; text-decoration:none;
          white-space:nowrap; cursor:pointer;
          position:relative; z-index:10;
        }
        .media-badge--discord { background:rgba(88,101,242,.2); border:1px solid rgba(88,101,242,.55); color:#7289DA; }
        .media-badge--twitch  { background:rgba(145,70,255,.2); border:1px solid rgba(145,70,255,.55); color:#9146FF; }
        .media-badge--youtube { background:rgba(255,0,0,.2); border:1px solid rgba(255,0,0,.55); color:#FF4444; }
        .media-badge--live { background:rgba(145,70,255,.45)!important; border-color:rgba(145,70,255,1)!important; box-shadow:0 0 14px rgba(145,70,255,.7); animation:liveBadge 1.2s ease-in-out infinite; }
        @keyframes liveBadge { 0%,100%{box-shadow:0 0 8px rgba(145,70,255,.5)} 50%{box-shadow:0 0 22px rgba(145,70,255,1)} }
        .media-badge:hover { transform:translateY(-2px); filter:brightness(1.3); }
        .live-dot { width:6px; height:6px; border-radius:50%; background:#FF4444; display:inline-block; margin-right:1px; animation:blink 1s ease-in-out infinite; }
        .media-icon { font-size:.85rem; }

        /* Meta pills */
        .mgr-meta-row { display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:.35rem; }
        .mgr-meta-pill { display:flex; align-items:center; gap:.35rem; background:rgba(0,0,0,.6); border:1px solid rgba(255,215,0,.22); border-radius:20px; padding:.22rem .7rem; backdrop-filter:blur(6px); }
        .mgr-meta-highlight { background:rgba(255,215,0,.12); border-color:rgba(255,215,0,.55); }
        .mgr-meta-champ { background:rgba(255,215,0,.16); border-color:rgba(255,215,0,.7); animation:champPill 2s ease-in-out infinite; }
        @keyframes champPill { 0%,100%{box-shadow:0 0 10px rgba(255,215,0,.3)} 50%{box-shadow:0 0 26px rgba(255,215,0,.7)} }
        .mgr-meta-val { font-family:'VT323',monospace; font-size:1.2rem; color:#FFD700; }
        .mgr-meta-lbl { font-family:'Press Start 2P',monospace; font-size:.36rem; color:rgba(255,165,0,.75); letter-spacing:1px; }

        /* Champ ribbon */
        .hero-champ-ribbon { display:flex; gap:.5rem; flex-wrap:wrap; margin-bottom:.35rem; }
        .hero-champ-chip { display:flex; align-items:center; gap:.3rem; background:rgba(255,215,0,.12); border:1px solid rgba(255,215,0,.4); border-radius:20px; padding:.2rem .6rem; }
        .hero-champ-count { font-family:'Press Start 2P',monospace; font-size:.45rem; color:#FFD700; }
        .hero-champ-lg { font-family:'Press Start 2P',monospace; font-size:.38rem; color:rgba(255,165,0,.8); letter-spacing:1px; }
        .mgr-arena-tag { font-family:'VT323',monospace; font-size:.9rem; color:rgba(135,206,235,.4); margin-bottom:.25rem; }

        /* Tabs — relative, not absolute, so they just flow after content */
        .mgr-tabs { position:relative; z-index:2; display:flex; border-top:1px solid rgba(255,215,0,.15); background:rgba(0,0,0,.75); backdrop-filter:blur(14px); }
        .mgr-tab { flex:1; display:flex; align-items:center; justify-content:center; gap:.5rem; padding:.85rem .5rem; background:transparent; border:none; border-right:1px solid rgba(255,215,0,.1); color:rgba(255,255,255,.35); cursor:pointer; font-family:'Press Start 2P',monospace; font-size:.52rem; letter-spacing:1px; transition:all .2s; }
        .mgr-tab:last-child { border-right:none; }
        .mgr-tab:hover:not(.mgr-tab--active) { background:rgba(255,215,0,.05); color:rgba(255,255,255,.7); }
        .mgr-tab--active { color:#FFD700; background:rgba(255,215,0,.07); border-bottom:3px solid #FFD700; text-shadow:0 0 10px rgba(255,215,0,.6); }
        .mgr-tab-icon { font-size:.9rem; }

        /* Tab body */
        .tab-body { animation:fadeIn .3s ease; }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .tab-content { padding:1.25rem 0; }

        /* ===== CHAMPIONSHIPS ===== */
        .champ-banner { background:linear-gradient(135deg,#1a1200,#110d00,#1a1200); border:2px solid rgba(255,215,0,.5); border-radius:16px; padding:1.5rem 2rem; margin-bottom:2rem; position:relative; overflow:hidden; box-shadow:0 0 40px rgba(255,215,0,.12); }
        .champ-banner::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg,transparent,#FFD700,#FFA500,#FFD700,transparent); }
        .champ-banner-title { font-family:'Press Start 2P',monospace; font-size:.75rem; color:#FFD700; letter-spacing:4px; text-align:center; margin-bottom:1.25rem; text-shadow:0 0 15px rgba(255,215,0,.7); display:flex; align-items:center; justify-content:center; gap:1rem; }
        .champ-trophy-anim { font-size:1.2rem; display:inline-block; animation:trophyBob 1.5s ease-in-out infinite; }
        @keyframes trophyBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        .champ-league-row { display:flex; gap:2rem; justify-content:center; flex-wrap:wrap; }
        .champ-league-block { display:flex; flex-direction:column; align-items:center; gap:.5rem; background:rgba(0,0,0,.4); border:1px solid rgba(255,215,0,.25); border-radius:12px; padding:1rem 1.5rem; min-width:130px; }
        .champ-count { font-family:'Press Start 2P',monospace; font-size:2.2rem; color:#FFD700; text-shadow:0 0 20px rgba(255,215,0,.9); line-height:1; }
        .champ-league-name { font-family:'Press Start 2P',monospace; font-size:.5rem; color:rgba(255,165,0,.85); letter-spacing:2px; }
        .champ-cups { display:flex; gap:.2rem; flex-wrap:wrap; justify-content:center; }
        .champ-cup-icon { font-size:1.1rem; display:inline-block; animation:cupFloat 2s ease-in-out infinite; }
        @keyframes cupFloat { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-4px) scale(1.1)} }
        .champ-season-list { display:flex; flex-wrap:wrap; gap:.25rem; justify-content:center; }
        .champ-season-tag { font-family:'VT323',monospace; font-size:.85rem; color:rgba(255,215,0,.45); background:rgba(255,215,0,.06); border-radius:4px; padding:0 .3rem; }
        .champ-banner--compact { padding:.75rem 1.5rem; margin-bottom:1.25rem; }
        .champ-league-row--compact { gap:.75rem; }
        .champ-compact-block { display:flex; align-items:center; gap:.4rem; background:rgba(0,0,0,.4); border:1px solid rgba(255,215,0,.2); border-radius:8px; padding:.4rem .8rem; }
        .champ-compact-count { font-family:'Press Start 2P',monospace; font-size:.9rem; color:#FFD700; }
        .champ-compact-lg { font-family:'Press Start 2P',monospace; font-size:.45rem; color:#FFA500; letter-spacing:1px; }

        /* ===== CAREER STRIP ===== */
        .career-strip { background:linear-gradient(135deg,#0d0d1a,#111125); border:2px solid rgba(255,165,0,.3); border-radius:16px; padding:1.25rem 1.75rem; margin-bottom:2rem; position:relative; overflow:hidden; }
        .career-strip::before { content:''; position:absolute; top:0; left:0; right:0; height:2px; background:linear-gradient(90deg,transparent,#FFA500,#FFD700,#FFA500,transparent); }
        .career-strip-title { font-family:'Press Start 2P',monospace; font-size:.58rem; color:rgba(255,165,0,.6); letter-spacing:3px; margin-bottom:1rem; }
        .career-stats-row { display:flex; flex-wrap:wrap; }
        .cs-cell { display:flex; flex-direction:column; align-items:center; width:80px; padding:.35rem 0; border-right:1px solid rgba(255,165,0,.15); }
        .cs-cell:last-child { border-right:none; }
        .cs-val { font-family:'VT323',monospace; font-size:2rem; line-height:1; color:#E0E0E0; height:2.1rem; display:flex; align-items:center; justify-content:center; }
        .cs-lbl { font-family:'Press Start 2P',monospace; font-size:.42rem; color:rgba(255,165,0,.75); letter-spacing:1px; margin-top:4px; }
        .cs-w  { color:#00FF64; text-shadow:0 0 10px #00FF64; }
        .cs-l  { color:#FF3C3C; text-shadow:0 0 10px #FF3C3C; }
        .cs-otl{ color:#FFA500; text-shadow:0 0 10px #FFA500; }
        .cs-pts{ color:#FFD700; text-shadow:0 0 10px #FFD700; font-size:2.2rem !important; }
        .cs-pos{ color:#00FF64; text-shadow:0 0 10px #00FF64; }
        .cs-neg{ color:#FF3C3C; text-shadow:0 0 10px #FF3C3C; }
        .cs-sub{ color:#87CEEB; font-size:1.75rem !important; }

        /* ===== SECTIONS ===== */
        .section-block { margin-bottom:2rem; }
        .section-block-title { font-family:'Press Start 2P',monospace; font-size:.68rem; color:#FFA500; letter-spacing:3px; margin-bottom:1.1rem; padding-bottom:.7rem; border-bottom:1px solid rgba(255,165,0,.2); display:flex; align-items:center; gap:.6rem; flex-wrap:wrap; }
        .sbt-icon { font-size:1rem; }
        .lg-stat-pills { display:flex; gap:.4rem; margin-left:auto; flex-wrap:wrap; }
        .lg-pill { font-family:'VT323',monospace; font-size:1.1rem; background:rgba(0,0,0,.5); border:1px solid rgba(255,165,0,.2); border-radius:6px; padding:.1rem .5rem; color:#E0E0E0; }

        /* ===== CONDENSED TEAMS ===== */
        .league-team-group { margin-bottom:1.25rem; }
        .league-team-group-header { font-family:'Press Start 2P',monospace; font-size:.48rem; color:rgba(135,206,235,.6); letter-spacing:2px; margin-bottom:.65rem; padding-left:.5rem; border-left:3px solid rgba(135,206,235,.4); }
        .league-team-strip { display:flex; flex-wrap:wrap; gap:.5rem; }
        .strip-card { display:flex; flex-direction:column; align-items:center; gap:.25rem; background:linear-gradient(180deg,#0d0d1a,#060610); border:1px solid rgba(255,165,0,.15); border-radius:10px; padding:.55rem .65rem; width:68px; transition:all .2s; cursor:default; }
        .strip-card:hover { border-color:rgba(255,165,0,.5); transform:translateY(-3px); box-shadow:0 6px 18px rgba(0,0,0,.4); }
        .strip-logo-wrap { width:38px; height:38px; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.4); border-radius:7px; padding:3px; border:1px solid rgba(135,206,235,.2); }
        .strip-logo { width:100%; height:100%; object-fit:contain; }
        .strip-logo-fallback { display:flex; align-items:center; justify-content:center; font-family:'Press Start 2P',monospace; font-size:.38rem; color:#87CEEB; width:100%; height:100%; }
        .strip-abr { font-family:'Press Start 2P',monospace; font-size:.38rem; color:#FFD700; text-align:center; }
        .strip-season { font-family:'VT323',monospace; font-size:.8rem; color:rgba(255,165,0,.6); }

        /* ===== TIMELINE ===== */
        .timeline { display:flex; flex-direction:column; }
        .timeline-row { display:flex; gap:1.25rem; }
        .tl-connector { display:flex; flex-direction:column; align-items:center; flex-shrink:0; width:24px; padding-top:1.5rem; }
        .tl-dot { width:14px; height:14px; border-radius:50%; flex-shrink:0; background:radial-gradient(circle,#FFD700,#FFA500); box-shadow:0 0 10px rgba(255,215,0,.8); }
        .tl-line { flex:1; width:2px; background:linear-gradient(180deg,rgba(255,165,0,.5),rgba(255,165,0,.05)); min-height:30px; margin-top:4px; }
        .tl-card { flex:1; position:relative; overflow:hidden; background:linear-gradient(135deg,rgba(13,13,26,.9),rgba(6,6,16,.95)); border:1px solid rgba(255,165,0,.2); border-radius:12px; display:flex; align-items:center; gap:1rem; padding:.9rem 1.1rem; margin-bottom:.65rem; transition:all .3s; }
        .tl-card:hover { border-color:rgba(255,165,0,.45); transform:translateX(4px); }
        .tl-banner { position:absolute; inset:0; z-index:0; overflow:hidden; pointer-events:none; }
        .tl-banner-img { position:absolute; right:-20px; top:50%; transform:translateY(-50%); height:150%; opacity:.1; mask-image:linear-gradient(to left,rgba(0,0,0,.8),transparent 70%); -webkit-mask-image:linear-gradient(to left,rgba(0,0,0,.8),transparent 70%); }
        .tl-logo-wrap { position:relative; z-index:2; flex-shrink:0; width:48px; height:48px; background:rgba(0,0,0,.5); border-radius:9px; padding:4px; border:1.5px solid rgba(135,206,235,.3); display:flex; align-items:center; justify-content:center; }
        .tl-logo { width:100%; height:100%; object-fit:contain; }
        .tl-info { position:relative; z-index:2; flex:1; }
        .tl-season { font-family:'Press Start 2P',monospace; font-size:.5rem; color:#FFA500; margin-bottom:.25rem; }
        .tl-team   { font-family:'Press Start 2P',monospace; font-size:.6rem; color:#FFD700; margin-bottom:.2rem; }
        .tl-detail { font-family:'VT323',monospace; font-size:.95rem; color:rgba(255,255,255,.3); }
        .tl-coming { font-family:'VT323',monospace; font-size:.85rem; color:rgba(255,165,0,.25); font-style:italic; margin-top:.3rem; }

        /* ===== STATS TABLE ===== */
        .stats-table-wrap { overflow-x:auto; border-radius:12px; border:2px solid rgba(255,165,0,.2); margin-bottom:.75rem; }
        .stats-table { width:100%; border-collapse:collapse; font-family:'VT323',monospace; }
        .stats-table thead { background:linear-gradient(180deg,#FF8C00,#FF6347); }
        .stats-table th { padding:.55rem .7rem; font-family:'Press Start 2P',monospace; font-size:.43rem; color:#FFF; text-align:center; border-right:1px solid rgba(255,255,255,.15); white-space:nowrap; }
        .stats-table th:last-child { border-right:none; }
        .stats-table td { padding:.45rem .7rem; text-align:center; font-size:1.15rem; color:#E0E0E0; border-bottom:1px solid rgba(255,165,0,.1); }
        .stats-table tbody tr:nth-child(even):not(.stats-totals-row) { background:rgba(0,30,60,.3); }
        .stats-table tbody tr:hover:not(.stats-totals-row) { background:rgba(255,165,0,.07)!important; }
        .stats-totals-row { background:rgba(255,165,0,.11)!important; border-top:2px solid rgba(255,165,0,.4); }
        .stats-totals-row td { color:#FFD700; }
        .s-season { font-family:'Press Start 2P',monospace; font-size:.46rem; color:#FFA500; white-space:nowrap; }
        .s-team-cell { display:flex; align-items:center; justify-content:center; }
        .s-logo { width:30px; height:30px; object-fit:contain; }
        .s-w  { color:#00FF64; } .s-l { color:#FF3C3C; } .s-pts{ color:#FFD700; }
        .s-pos{ color:#00FF64; } .s-neg{ color:#FF3C3C; }
        .todo-note { font-family:'VT323',monospace; font-size:.9rem; color:rgba(255,165,0,.4); padding:.35rem; border:1px dashed rgba(255,165,0,.2); border-radius:5px; margin-top:.4rem; }
        .todo-note code { color:#87CEEB; }

        /* ===== MEDIA ===== */
        .media-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(250px,1fr)); gap:1.1rem; }
        .media-card { position:relative; overflow:hidden; background:linear-gradient(135deg,#0d0d1a,#060610); border-radius:14px; padding:1.5rem; border:1px solid rgba(255,255,255,.07); transition:all .3s; }
        .media-card--inactive { opacity:.4; pointer-events:none; }
        .media-card:not(.media-card--inactive):hover { transform:translateY(-4px); }
        .media-card--discord { border-color:rgba(88,101,242,.35); }
        .media-card--discord:hover { box-shadow:0 10px 35px rgba(88,101,242,.2); }
        .media-card--twitch  { border-color:rgba(145,70,255,.35); }
        .media-card--twitch:hover  { box-shadow:0 10px 35px rgba(145,70,255,.2); }
        .media-card--youtube { border-color:rgba(255,0,0,.35); }
        .media-card--youtube:hover { box-shadow:0 10px 35px rgba(255,0,0,.2); }
        .media-card--podcast { border-color:rgba(255,165,0,.35); }
        .media-card-icon { font-size:1.8rem; margin-bottom:.4rem; }
        .media-card-title { font-family:'Press Start 2P',monospace; font-size:.55rem; letter-spacing:2px; color:rgba(255,255,255,.45); margin-bottom:.85rem; }
        .media-card-body { display:flex; flex-direction:column; align-items:center; gap:.65rem; }
        .media-avatar-wrap { width:68px; height:68px; border-radius:50%; background:linear-gradient(135deg,#1a1a3e,#0d0d25); border:2px solid rgba(88,101,242,.5); display:flex; align-items:center; justify-content:center; font-family:'Press Start 2P',monospace; font-size:.95rem; color:#7289DA; overflow:hidden; }
        .media-discord-avatar { width:100%; height:100%; object-fit:cover; border-radius:50%; display:block; }
        .media-yt-icon { font-size:2.5rem; color:rgba(255,0,0,.65); }
        .media-podcast-placeholder { width:64px; height:64px; border-radius:12px; background:linear-gradient(135deg,#1a1a15,#2a1500); border:2px solid rgba(255,165,0,.3); display:flex; align-items:center; justify-content:center; font-size:1.8rem; }
        .media-card-name { font-family:'VT323',monospace; font-size:1.05rem; color:#E0E0E0; }
        .media-live-badge { display:flex; align-items:center; gap:.4rem; font-family:'Press Start 2P',monospace; font-size:.4rem; color:rgba(255,255,255,.3); letter-spacing:1px; }
        .media-live-badge--on { color:#9146FF !important; }
        .media-live-dot { width:7px; height:7px; border-radius:50%; background:rgba(255,255,255,.2); flex-shrink:0; }
        .media-live-dot--on { background:#FF4444; box-shadow:0 0 7px #FF4444; animation:blink 1s ease-in-out infinite; }
        .media-visit-btn { display:inline-block; margin-top:.3rem; padding:.45rem .9rem; font-family:'Press Start 2P',monospace; font-size:.42rem; letter-spacing:1px; border-radius:7px; text-decoration:none; transition:all .2s; cursor:pointer; }
        .media-visit-btn--twitch  { background:rgba(145,70,255,.2); border:1px solid rgba(145,70,255,.6); color:#9146FF; }
        .media-visit-btn--twitch:hover  { background:rgba(145,70,255,.35); transform:translateY(-2px); box-shadow:0 4px 18px rgba(145,70,255,.4); }
        .media-visit-btn--youtube { background:rgba(255,0,0,.2); border:1px solid rgba(255,0,0,.6); color:#FF4444; }
        .media-visit-btn--youtube:hover { background:rgba(255,0,0,.35); transform:translateY(-2px); box-shadow:0 4px 18px rgba(255,0,0,.4); }
        .live-badge-pill { font-family:'Press Start 2P',monospace; font-size:.42rem; color:#FF4444; background:rgba(255,0,0,.15); border:1px solid rgba(255,0,0,.4); border-radius:4px; padding:.18rem .38rem; animation:blink 1s ease-in-out infinite; }

        /* ===== RESPONSIVE ===== */
        @media (max-width:900px) {
          .mgr-hero-content { flex-direction:column; align-items:flex-start; gap:.75rem; padding-top:6rem; }
          .mgr-name { font-size:1rem; }
          .mgr-tabs { flex-wrap:wrap; }
          .mgr-tab { flex:none; width:50%; font-size:.42rem; }
          .cs-cell { width:60px; }
        }
        @media (max-width:600px) {
          .led-text { font-size:1.2rem; letter-spacing:3px; }
          .control-panel { flex-direction:column; gap:1rem; }
          .mgr-tab { width:100%; }
          .managers-page { padding:.75rem; }
          .mgr-hero-content { padding-top:4rem; }
        }
      `}</style>
    </div>
  );
}
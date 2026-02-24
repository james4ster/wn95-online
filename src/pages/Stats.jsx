// Stats.jsx — Manager Stats
//
// DATA MODEL:
//   managers  : id, coach_name, discord_id, discord_username, discord_url (avatar)
//   teams     : lg, abr, coach (= managers.coach_name), manager_id
//   games     : lg, game, mode, home, away, coach_home, coach_away,
//               result_home, result_away, score_home, score_away, ot
//
// AGGREGATION STRATEGY:
//   games.coach_home / games.coach_away already contain the coach name.
//   We aggregate directly by coach name — no team join needed.
//   managers table is fetched separately for avatar (discord_url) + display name.
//   Coach name keys are normalised (trimmed, lowercased) when building the map
//   so minor case differences don't create duplicate rows.
//
// MODE FILTER:
//   games.mode column — sample value observed: "Season"
//   SEASON_VALS includes "SEASON" so this should now match.
//   PLAYOFF_VALS covers common playoff variants.
//
// CHAMPS:
//   standings table: season_rank=1 for a given lg → look up which coach
//   played for that team in that lg via teams table.

import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from '../components/LeagueContext';

const lgPrefix = lg => (lg || '').replace(/[0-9]/g, '').trim();
const norm     = s  => (s || '').toString().trim().toLowerCase();

// Columns where first-click sorts ascending (lower = worse)
const ASC_DEFAULT = new Set(['l','t','hl','htie','al','atie','otl','hotl','aotl','ga','gapg']);

// ─── Column definitions ───────────────────────────────────────────────────────
const MANAGER_COLS = [
  { key:'rank',  label:'#',      tip:'Rank',                               sortable:false, align:'center', group:'core'   },
  { key:'mgr',   label:'COACH',  tip:'Manager / Coach',                    sortable:true,  align:'left',   group:'core'   },
  { key:'gp',    label:'GP',     tip:'Games Played',                       sortable:true,  align:'center', group:'record' },
  { key:'w',     label:'W',      tip:'Wins',                               sortable:true,  align:'center', group:'record' },
  { key:'l',     label:'L',      tip:'Losses',                             sortable:true,  align:'center', group:'record' },
  { key:'t',     label:'T',      tip:'Ties',                               sortable:true,  align:'center', group:'record' },
  { key:'otl',   label:'OTL',    tip:'Overtime Losses',                    sortable:true,  align:'center', group:'record' },
  { key:'pct',   label:'WIN%',   tip:'Win Percentage',                     sortable:true,  align:'center', group:'record' },
  { key:'gf',    label:'GF',     tip:'Goals For',                          sortable:true,  align:'center', group:'goals'  },
  { key:'ga',    label:'GA',     tip:'Goals Against',                      sortable:true,  align:'center', group:'goals'  },
  { key:'diff',  label:'+/-',    tip:'Goal Differential',                  sortable:true,  align:'center', group:'goals'  },
  { key:'gfpg',  label:'GF/G',   tip:'Goals For per Game',                 sortable:true,  align:'center', group:'goals'  },
  { key:'gapg',  label:'GA/G',   tip:'Goals Against per Game',             sortable:true,  align:'center', group:'goals'  },
  { key:'hw',    label:'W',      tip:'Home Wins',                          sortable:true,  align:'center', group:'home'   },
  { key:'hl',    label:'L',      tip:'Home Losses',                        sortable:true,  align:'center', group:'home'   },
  { key:'htie',  label:'T',      tip:'Home Ties',                          sortable:true,  align:'center', group:'home'   },
  { key:'hotl',  label:'OTL',    tip:'Home OT Losses',                     sortable:true,  align:'center', group:'home'   },
  { key:'aw',    label:'W',      tip:'Away Wins',                          sortable:true,  align:'center', group:'away'   },
  { key:'al',    label:'L',      tip:'Away Losses',                        sortable:true,  align:'center', group:'away'   },
  { key:'atie',  label:'T',      tip:'Away Ties',                          sortable:true,  align:'center', group:'away'   },
  { key:'aotl',  label:'OTL',    tip:'Away OT Losses',                     sortable:true,  align:'center', group:'away'   },
  { key:'so',    label:'SO',     tip:'Shutouts (opponent scored 0)',        sortable:true,  align:'center', group:'extra'  },
  { key:'maxgf', label:'MAX G',  tip:'Most Goals Scored in a Single Game', sortable:true,  align:'center', group:'extra'  },
  { key:'champs',label:'🏆',     tip:'Championships Won',                  sortable:true,  align:'center', group:'extra'  },
];

const GROUPS = {
  core:   { label:'',        headerBg:'#07071a',                  cellBg:'#07071a',                  groupBg:'#07071a',                  groupText:'rgba(255,255,255,.3)',  borderLeft:'none'                          },
  record: { label:'RECORD',  headerBg:'rgba(160,170,255,.09)',    cellBg:'rgba(100,110,200,.055)',    groupBg:'rgba(160,170,255,.17)',    groupText:'rgba(185,195,255,.9)', borderLeft:'3px solid rgba(140,150,255,.5)' },
  goals:  { label:'GOALS',   headerBg:'rgba(255,140,0,.11)',      cellBg:'rgba(255,120,0,.065)',      groupBg:'rgba(255,140,0,.2)',       groupText:'rgba(255,175,75,.95)', borderLeft:'3px solid rgba(255,140,0,.6)'   },
  home:   { label:'HOME',    headerBg:'rgba(80,165,255,.11)',     cellBg:'rgba(60,140,255,.065)',     groupBg:'rgba(100,175,255,.2)',     groupText:'rgba(145,215,255,.95)', borderLeft:'3px solid rgba(100,170,255,.6)' },
  away:   { label:'AWAY',    headerBg:'rgba(170,110,255,.11)',    cellBg:'rgba(150,90,240,.065)',     groupBg:'rgba(180,120,255,.2)',     groupText:'rgba(205,165,255,.95)', borderLeft:'3px solid rgba(175,115,255,.6)' },
  extra:  { label:'EXTRA',   headerBg:'rgba(255,215,0,.09)',      cellBg:'rgba(230,195,0,.05)',       groupBg:'rgba(255,215,0,.17)',      groupText:'rgba(255,220,60,.95)', borderLeft:'3px solid rgba(255,215,0,.5)'   },
};

// ─── Result helpers ───────────────────────────────────────────────────────────
const isWin = r => ['W','OTW'].includes((r||'').toUpperCase());
const isOTL = r => (r||'').toUpperCase() === 'OTL';
const isTie = r => (r||'').toUpperCase() === 'T';

// Mode matching — games.mode observed value: "Season"
const SEASON_VALS  = new Set(['REG','REGULAR','SEASON','S','RS','REGULAR SEASON']);
const PLAYOFF_VALS = new Set(['PO','PLAYOFF','PLAYOFFS','P','POST','POSTSEASON']);

// ─── Aggregation by coach name ────────────────────────────────────────────────
// games has coach_home and coach_away — aggregate on those directly.
// coachKey: normalised(coach_name) → canonical coach_name (for display)
function buildManagerStats(games, champMap) {
  // slot keyed by normalised coach name
  const m = new Map();
  const slot = normKey => {
    if (!normKey) return null;
    if (!m.has(normKey)) m.set(normKey, {
      normKey,
      gp:0, w:0, l:0, t:0, otl:0,
      gf:0, ga:0,
      hw:0, hl:0, htie:0, hotl:0,
      aw:0, al:0, atie:0, aotl:0,
      so:0, maxgf:0,
      // track the "display" coach name (first seen non-empty value)
      _displayName: '',
    });
    return m.get(normKey);
  };

  for (const g of games) {
    const hCoach = (g.coach_home || '').trim();
    const aCoach = (g.coach_away || '').trim();
    if (!hCoach || !aCoach) continue; // skip games missing coach

    const hKey = norm(hCoach), aKey = norm(aCoach);
    const h = slot(hKey), a = slot(aKey);
    if (!h || !a) continue;

    // Preserve a display name (keep first non-empty)
    if (!h._displayName) h._displayName = hCoach;
    if (!a._displayName) a._displayName = aCoach;

    const sh = Number(g.score_home || 0), sa = Number(g.score_away || 0);
    h.gp++; a.gp++;
    h.gf += sh; h.ga += sa; h.maxgf = Math.max(h.maxgf, sh);
    a.gf += sa; a.ga += sh; a.maxgf = Math.max(a.maxgf, sa);

    if      (isWin(g.result_home)) { h.w++;   h.hw++; }
    else if (isTie(g.result_home)) { h.t++;   h.htie++; }
    else if (isOTL(g.result_home)) { h.otl++; h.hotl++; }
    else                           { h.l++;   h.hl++; }

    if      (isWin(g.result_away)) { a.w++;   a.aw++; }
    else if (isTie(g.result_away)) { a.t++;   a.atie++; }
    else if (isOTL(g.result_away)) { a.otl++; a.aotl++; }
    else                           { a.l++;   a.al++; }

    if (sa === 0) h.so++;
    if (sh === 0) a.so++;
  }

  return Array.from(m.values()).map(s => ({
    ...s,
    mgr:  s.normKey,   // used as row key
    pct:  s.gp ? s.w / s.gp : 0,
    gfpg: s.gp ? +(s.gf / s.gp).toFixed(2) : 0,
    gapg: s.gp ? +(s.ga / s.gp).toFixed(2) : 0,
    diff: s.gf - s.ga,
    champs: champMap.get(s.normKey) || 0,
  }));
}

function fmtVal(v, key) {
  if (v === null || v === undefined) return '–';
  if (key === 'pct') {
    const n = Number(v);
    if (!isFinite(n)) return '–';
    return n === 1 ? '1.000' : n.toFixed(3).replace(/^0/, '');
  }
  if (key === 'gfpg' || key === 'gapg') return Number(v).toFixed(2);
  if (key === 'diff') return v > 0 ? `+${v}` : String(v);
  if (key === 'champs') return v === 0 ? '–' : `${'🏆'.repeat(Math.min(v,3))}${v>3?` ×${v}`:''}`;
  return String(v);
}

const LOSS_KEYS = new Set(['l','t','htie','atie','hl','al','otl','hotl','aotl','ga','gapg']);

// ─── Component ────────────────────────────────────────────────────────────────
export default function Stats() {
  const { selectedLeague } = useLeague();

  const [tab,          setTab]          = useState('managers');
  const [allSeasons,   setAllSeasons]   = useState([]);
  const [seasonFilter, setSeasonFilter] = useState('ALL');
  const [modeFilter,   setModeFilter]   = useState('ALL');
  const [allGames,     setAllGames]     = useState([]);   // raw — all rows from games
  const [managers,     setManagers]     = useState([]);   // raw managers table rows
  const [champMap,     setChampMap]     = useState(new Map());
  const [loading,      setLoading]      = useState(true);
  const [sortKey,      setSortKey]      = useState('pct');
  const [sortDir,      setSortDir]      = useState('desc');
  const [modeValues,   setModeValues]   = useState([]);   // distinct mode vals for debug

  // ── 1. Fetch managers (for avatar + display name) ─────────────────────────
  // Columns: id, coach_name, discord_id, discord_username, discord_url
  useEffect(() => {
    supabase.from('managers')
      .select('id, coach_name, discord_id, discord_username, discord_url')
      .then(({ data, error }) => {
        if (error) console.warn('[Stats] managers fetch error:', error.message);
        else console.log('[Stats] managers loaded:', (data||[]).length, 'rows');
        setManagers(data || []);
      });
  }, []);

  // ── 2. Build a map: norm(coach_name) → manager meta ──────────────────────
  // Key is normalised so it matches the normalised keys from games.coach_home/away
  const mgrMeta = useMemo(() => {
    const m = new Map();
    for (const mgr of managers) {
      if (!mgr.coach_name) continue;
      const key = norm(mgr.coach_name);
      m.set(key, {
        displayName: mgr.coach_name,
        discordName: mgr.discord_username || mgr.coach_name,
        avatar_url:  mgr.discord_url || null,
      });
    }
    return m;
  }, [managers]);

  // ── 3. Fetch ALL games once ───────────────────────────────────────────────
  // coach_home / coach_away are the aggregation keys.
  // mode column present (observed value: "Season").
  useEffect(() => {
    setLoading(true);
    setAllGames([]); setModeValues([]);

    supabase.from('games')
      .select('lg, game, mode, home, away, coach_home, coach_away, result_home, result_away, score_home, score_away, ot')
      .then(({ data, error }) => {
        if (error) {
          console.error('[Stats] games fetch error:', error.message);
          setLoading(false);
          return;
        }
        const rows = data || [];
        setAllGames(rows);
        // Log distinct mode values so we can confirm filter matching
        const vals = [...new Set(rows.map(g => g.mode).filter(Boolean))];
        console.log('[Stats] distinct mode values:', vals);
        setModeValues(vals);
        setLoading(false);
      });
  }, []);

  // ── 4. Derive league games + season list when league or allGames changes ──
  const leagueGames = useMemo(() => {
    if (!selectedLeague || !allGames.length) return [];
    return allGames.filter(g => g.lg && lgPrefix(g.lg) === selectedLeague);
  }, [allGames, selectedLeague]);

  useEffect(() => {
    setSeasonFilter('ALL');
    if (!leagueGames.length) { setAllSeasons([]); return; }
    const codes = [...new Set(leagueGames.map(g => g.lg).filter(Boolean))];
    codes.sort((a, b) => {
      const na = parseInt(a.replace(/\D/g,''), 10) || 0;
      const nb = parseInt(b.replace(/\D/g,''), 10) || 0;
      return nb - na; // newest first
    });
    setAllSeasons(codes);
  }, [leagueGames]);

  // ── 5. Championships — join via teams table ───────────────────────────────
  // standings (season_rank=1, lg) → teams (abr, lg, coach) → norm(coach) key
  useEffect(() => {
    if (!allSeasons.length) return;

    Promise.all([
      supabase.from('standings').select('team, season').in('season', allSeasons).eq('season_rank', 1),
      supabase.from('teams').select('abr, lg, coach').in('lg', allSeasons),
    ]).then(([{ data: standData }, { data: teamsData }]) => {
      // Build abr+lg → norm(coach) lookup
      const abrLgToCoach = new Map();
      for (const t of (teamsData || [])) {
        if (t.abr && t.lg) abrLgToCoach.set(`${t.abr}:${t.lg}`, norm(t.coach));
      }
      const cm = new Map();
      for (const s of (standData || [])) {
        const coachKey = abrLgToCoach.get(`${s.team}:${s.season}`);
        if (coachKey) cm.set(coachKey, (cm.get(coachKey) || 0) + 1);
      }
      setChampMap(cm);
    });
  }, [allSeasons]);

  // ── 6. Filter games by season + mode ─────────────────────────────────────
  const filteredGames = useMemo(() => {
    if (!leagueGames.length) return [];
    let r = seasonFilter === 'ALL' ? leagueGames : leagueGames.filter(g => g.lg === seasonFilter);

    if (modeFilter === 'SEASON') {
      r = r.filter(g => SEASON_VALS.has((g.mode || '').trim().toUpperCase()));
    } else if (modeFilter === 'PLAYOFFS') {
      r = r.filter(g => PLAYOFF_VALS.has((g.mode || '').trim().toUpperCase()));
    }
    return r;
  }, [leagueGames, seasonFilter, modeFilter]);

  // ── 7. Sort ───────────────────────────────────────────────────────────────
  const handleSort = (key) => {
    if (!key || key === 'rank') return;
  
    setSortDir(prevDir => sortKey === key
      ? (prevDir === 'desc' ? 'asc' : 'desc')   // flip
      : (ASC_DEFAULT.has(key) ? 'asc' : 'desc') // default for new column
    );
    setSortKey(key);
  };
  
  useEffect(() => { setSortKey('pct'); setSortDir('desc'); }, [tab]);

  // ── 8. Build rows ─────────────────────────────────────────────────────────
  const managerRows = useMemo(() => {
    if (!filteredGames.length) return [];
    return buildManagerStats(filteredGames, champMap);
  }, [filteredGames, champMap]);

  const sortedRows = useMemo(() => {
    const rows = tab === 'managers' ? managerRows : [];
    return [...rows].sort((a, b) => {
      let av = a[sortKey], bv = b[sortKey];
      if (typeof av === 'string') { av = av.toLowerCase(); bv = (bv||'').toLowerCase(); }
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (sortDir === 'desc' ? -1 : 1);
    });
  }, [managerRows, tab, sortKey, sortDir]);

  // ── 9. Group layout helpers ───────────────────────────────────────────────
  const groupSpans = useMemo(() => {
    const out = []; let cur = null, span = 0;
    for (const c of MANAGER_COLS) {
      if (c.group !== cur) { if (cur !== null) out.push({ group:cur, span }); cur = c.group; span = 1; }
      else span++;
    }
    if (cur !== null) out.push({ group:cur, span });
    return out;
  }, []);

  const isFirstInGroup = useMemo(() => {
    const s = new Set(); let prev = null;
    for (const c of MANAGER_COLS) { if (c.group !== prev) { s.add(c.key); prev = c.group; } }
    return s;
  }, []);

  const maxVals = useMemo(() => {
    const mv = {};
    for (const c of MANAGER_COLS) {
      if (!['rank','mgr','champs'].includes(c.key)) {
        const vals = sortedRows.map(r => Number(r[c.key]||0)).filter(isFinite);
        mv[c.key] = vals.length ? Math.max(...vals) : 1;
      }
    }
    return mv;
  }, [sortedRows]);

  const hasModeData = modeValues.length > 0;
  const leagueColor = selectedLeague === 'W' ? '#87CEEB' : selectedLeague === 'Q' ? '#FFD700' : '#FF6B35';

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="sp">
      <div className="scanlines" aria-hidden />

      {/* Header */}
      <div className="scoreboard-header-container">
        <div className="scoreboard-header">
          <div className="led-text">STATS</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sp-tabs">
  <div style={{ display:'flex', gap:'.5rem', alignItems:'flex-end', flex:1 }}>
    <button className={`sp-tab ${tab==='managers'?'on':''}`} onClick={()=>setTab('managers')}>👔 MANAGERS</button>
    <button className={`sp-tab ${tab==='players'?'on':''}`}  onClick={()=>setTab('players')}>🏒 PLAYERS</button>
  </div>

  {/* Legend on far right */}
  {sortedRows.length > 0 && (
    <div className="sp-legend" style={{ marginLeft:'auto' }}>
      <div className="leg-item"><span className="leg-sw" style={{background:'rgba(255,210,0,.38)',border:'1px solid rgba(255,215,0,.6)'}}/>BEST</div>
      <div className="leg-item"><span className="leg-sw" style={{background:'rgba(255,55,55,.32)',border:'1px solid rgba(255,80,80,.5)'}}/>WORST</div>
    </div>
  )}

  <div className="sp-tabs-line" />
</div>

      {/* Filters */}
      <div className="sp-filters">
        <div className="sp-filters-inner">
          <div className="sf-group">
            <span className="sf-lbl">MODE</span>
            <div className="sf-btns">
              {['ALL','SEASON','PLAYOFFS'].map(mo => (
                <button key={mo}
                  className={`sf-btn ${modeFilter===mo?'sf-on':''}${!hasModeData&&mo!=='ALL'?' sf-dim':''}`}
                  onClick={() => setModeFilter(mo)}
                  title={!hasModeData&&mo!=='ALL'?'games.mode column empty or missing':''}
                >{mo}</button>
              ))}
            </div>
           
          </div>
          <div className="sf-group">
            <span className="sf-lbl">SEASON</span>
            <div className="sf-sel-wrap">
              <select className="sf-sel" value={seasonFilter} onChange={e=>setSeasonFilter(e.target.value)}>
                <option value="ALL">ALL SEASONS</option>
                {allSeasons.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <span className="sf-caret">▾</span>
            </div>
          </div>
          {!loading && sortedRows.length > 0 && (
            <div className="sf-count">
              {filteredGames.length.toLocaleString()} GAMES · {sortedRows.length} COACHES
            </div>
          )}
        </div>
      </div>

      {/* Players placeholder */}
      {tab === 'players' ? (
        <div className="sp-placeholder">
          <div style={{fontSize:50,opacity:.18}}>🏒</div>
          <div className="sp-ph-title">PLAYER STATS COMING SOON</div>
          <div className="sp-ph-sub">Will appear once <code>player_stats</code> table is populated.</div>
          <div className="sp-ph-preview">
            {['GP','G','A','PTS','P/G','G/G','A/G','+/-','HAT TRICKS','MAX G'].map(c=>(
              <span key={c} className="sp-ph-col">{c}</span>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="sp-table-outer">
  {loading ? (
    <div className="sp-state">
      <div className="sp-spinner" />
      <span className="sp-state-txt">CRUNCHING NUMBERS…</span>
    </div>
  ) : sortedRows.length === 0 ? (
    <div className="sp-state">
      <span style={{ fontSize: 44, opacity: 0.18 }}>📊</span>
      <span className="sp-state-txt">NO STATS FOUND</span>
      <span className="sp-state-sub">
        {modeFilter !== 'ALL' && !filteredGames.length
          ? `Mode "${modeFilter}" — no games matched. DB values: ${modeValues.join(', ')}`
          : 'Check that game data exists for this league.'}
      </span>
    </div>
  ) : (
      <table className="sp-table">
        <thead>
          <tr>
            {groupSpans.map(({ group, span }, i) => {
              const g = GROUPS[group] || {};
              return (
                <th
                  key={i}
                  colSpan={span}
                  className="sp-gh"
                  style={{
                    background: g.groupBg,
                    color: g.groupText,
                    borderLeft: i > 0 ? g.borderLeft : 'none',
                  }}
                >
                  {g.label}
                </th>
              );
            })}
          </tr>
          <tr>
            {MANAGER_COLS.map((col) => {
              const g = GROUPS[col.group] || {};
              const active = sortKey === col.key;
              const first = isFirstInGroup.has(col.key);
              return (
                <th
                  key={col.key}
                  className={`sp-th${col.sortable ? ' sortable' : ''}${
                    active ? ' active' : ''
                  }`}
                  style={{
                    background: g.headerBg,
                    textAlign: col.align,
                    borderLeft:
                      first && col.group !== 'core' ? g.borderLeft : 'none',
                  }}
                  onClick={() => col.sortable && handleSort(col.key)}
                  title={col.tip}
                >
                  {col.label}
                  {col.sortable && (
                    <span className="sort-icon">
                      {active ? (sortDir === 'desc' ? ' ▼' : ' ▲') : ' ⇅'}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, idx) => {
            const meta = mgrMeta.get(row.normKey);
            return (
              <tr key={row.mgr} className={idx % 2 === 0 ? 'sp-even' : 'sp-odd'}>
                {MANAGER_COLS.map((col) => {
                  const raw = col.key === 'rank' ? idx + 1 : row[col.key];
                  const num = Number(raw);
                  const g = GROUPS[col.group] || {};
                  const mx = maxVals[col.key] || 1;
                  const first = isFirstInGroup.has(col.key);

                  let heatBg = g.cellBg;
                  if (isFinite(num) && !['rank', 'mgr', 'champs'].includes(col.key)) {
                    const pct = Math.min(Math.abs(num) / mx, 1);
                    if (LOSS_KEYS.has(col.key) && num > 0) {
                      heatBg = `rgba(255,55,55,${(pct * 0.22).toFixed(3)})`;
                    } else if (!LOSS_KEYS.has(col.key) && pct > 0.7) {
                      heatBg = `rgba(255,210,0,${((pct - 0.7) * 0.65).toFixed(3)})`;
                    }
                  }

                  return (
                    <td
                      key={col.key}
                      className={`sp-td${sortKey === col.key ? ' sorted' : ''}`}
                      style={{
                        textAlign: col.align,
                        background: heatBg,
                        borderLeft:
                          first && col.group !== 'core' ? g.borderLeft : 'none',
                      }}
                    >
                      {col.key === 'mgr' ? (
                        <div className="td-mgr">
                          {meta?.avatar_url ? (
                            <img
                              src={meta.avatar_url}
                              alt=""
                              className="td-avatar"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="td-avatar-fb">
                              {(meta?.displayName || row._displayName || row.normKey)
                                .replace(/\s+/g, '')
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                          )}
                          <div className="td-mgr-names">
                            <span className="td-mgrname">
                              {meta?.displayName || row._displayName || row.normKey}
                            </span>
                            {meta?.discordName &&
                              meta.discordName !==
                                (meta?.displayName || row._displayName) && (
                                <span className="td-discord">@{meta.discordName}</span>
                              )}
                          </div>
                        </div>
                      ) : col.key === 'rank' ? (
                        <span className="td-rank">{raw}</span>
                      ) : col.key === 'pct' ? (
                        <span className={`td-val${num >= 0.65 ? ' great' : ''}`}>
                          {fmtVal(raw, col.key)}
                        </span>
                      ) : col.key === 'diff' ? (
                        <span className={`td-val${num > 0 ? ' pos' : num < 0 ? ' neg' : ''}`}>
                          {fmtVal(raw, col.key)}
                        </span>
                      ) : (
                        <span className="td-val">{fmtVal(raw, col.key)}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
   
  )}
</div>

          {sortedRows.length > 0 && (
            <div className="sp-legend">
              <div className="leg-item"><span className="leg-sw" style={{background:GROUPS.record.groupBg,borderLeft:GROUPS.record.borderLeft}}/>RECORD</div>
              <div className="leg-item"><span className="leg-sw" style={{background:GROUPS.goals.groupBg, borderLeft:GROUPS.goals.borderLeft }}/>GOALS</div>
              <div className="leg-item"><span className="leg-sw" style={{background:GROUPS.home.groupBg,  borderLeft:GROUPS.home.borderLeft  }}/>HOME</div>
              <div className="leg-item"><span className="leg-sw" style={{background:GROUPS.away.groupBg,  borderLeft:GROUPS.away.borderLeft  }}/>AWAY</div>
              <div className="leg-item"><span className="leg-sw" style={{background:'rgba(255,210,0,.38)',border:'1px solid rgba(255,215,0,.6)'}}/>TOP</div>
              <div className="leg-item"><span className="leg-sw" style={{background:'rgba(255,55,55,.32)',border:'1px solid rgba(255,80,80,.5)'}}/>WORST</div>
              <span className="leg-note">Aggregated by coach across all team names · Click column to sort · click again to flip</span>
            </div>
          )}
        </>
      )}

      <style>{`
        *,*::before,*::after{box-sizing:border-box;}
        html,body{background:#00000a!important;}
        .sp{min-height:100vh;background:radial-gradient(ellipse 100% 35% at 50% 0%,#0a0a22 0%,transparent 55%),#00000a;padding-bottom:80px;}
        .scanlines{position:fixed;inset:0;pointer-events:none;z-index:9997;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.05) 2px,rgba(0,0,0,.05) 4px);}


        .scoreboard-header-container {
          display: flex;
          justify-content: center;
          margin-bottom: 1rem;
        }

        .scoreboard-header {
          background: #000000;
          border: 6px solid #333;
          border-radius: 8px;
          padding: 1rem 2rem;
          box-shadow: 0 0 0 2px #000, inset 0 0 20px rgba(0, 0, 0, 0.8), 0 8px 16px rgba(0, 0, 0, 0.5), 0 0 40px rgba(255, 215, 0, 0.3);
          position: relative;
          overflow: hidden;
        }

        .scoreboard-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: repeating-linear-gradient(0deg, transparent 0px, transparent 2px, rgba(255, 215, 0, 0.03) 2px, rgba(255, 215, 0, 0.03) 4px), repeating-linear-gradient(90deg, transparent 0px, transparent 2px, rgba(255, 215, 0, 0.03) 2px, rgba(255, 215, 0, 0.03) 4px);
          pointer-events: none;
        }

        .scoreboard-header::after {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: linear-gradient(45deg, transparent 30%, rgba(255, 215, 0, 0.1) 50%, transparent 70%);
          animation: shimmer 3s infinite;
        }

        @keyframes shimmer {
          0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
          100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }

        .led-text {
          font-family: 'Press Start 2P', monospace;
          font-size: 2rem;
          color: #FFD700;
          letter-spacing: 6px;
          text-shadow: 0 0 10px #FF8C00, 0 0 20px #FF8C00, 0 0 30px #FFD700;
          filter: contrast(1.3) brightness(1.2);
          position: relative;
        }


        .sp-header{padding:1.4rem 2rem 1rem;border-bottom:1px solid rgba(255,140,0,.14);}
        .sp-hrow{display:flex;align-items:center;justify-content:space-between;max-width:1600px;margin:0 auto;gap:1rem;}
        .sp-eyebrow{font-family:'Press Start 2P',monospace;font-size:11px;color:rgba(255,140,0,.5);letter-spacing:4px;margin-bottom:.5rem;}
        .sp-h1{font-family:'Press Start 2P',monospace;font-size:30px;color:#fff;letter-spacing:4px;margin:0;line-height:1.1;}
        .sp-lpill{font-family:'Press Start 2P',monospace;font-size:20px;color:var(--lc);border:2px solid color-mix(in srgb,var(--lc) 55%,transparent);border-radius:10px;padding:.55rem 1.1rem;box-shadow:0 0 18px color-mix(in srgb,var(--lc) 25%,transparent);text-shadow:0 0 12px var(--lc);letter-spacing:3px;}

        .sp-tabs{display:flex;align-items:flex-end;gap:.5rem;padding:1rem 2rem 0;max-width:1600px;margin:0 auto;position:relative;}
        .sp-tabs-line{position:absolute;bottom:0;left:2rem;right:2rem;height:2px;background:rgba(255,140,0,.2);}
        .sp-tab{font-family:'Press Start 2P',monospace;font-size:14px;letter-spacing:2px;padding:.8rem 1.6rem;background:rgba(255,255,255,.03);border:2px solid rgba(255,255,255,.1);border-bottom:none;border-radius:10px 10px 0 0;color:rgba(255,255,255,.32);cursor:pointer;transition:all .18s;position:relative;z-index:1;}
        .sp-tab:hover{background:rgba(255,140,0,.07);color:rgba(255,140,0,.7);border-color:rgba(255,140,0,.3);}
        .sp-tab.on{background:rgba(255,140,0,.11);border-color:rgba(255,140,0,.6);color:#FF8C00;text-shadow:0 0 14px rgba(255,140,0,.45);margin-bottom:-2px;padding-bottom:calc(.8rem + 2px);}

        .sp-filters{background:rgba(0,0,12,.75);border-bottom:1px solid rgba(255,255,255,.06);padding:.9rem 2rem;}
        .sp-filters-inner{display:flex;align-items:center;flex-wrap:wrap;gap:.65rem 1.8rem;max-width:1600px;margin:0 auto;}
        .sf-group{display:flex;align-items:center;gap:.55rem;}
        .sf-lbl{font-family:'Press Start 2P',monospace;font-size:11px;color:rgba(255,255,255,.3);letter-spacing:2px;white-space:nowrap;}
        .sf-btns{display:flex;gap:.3rem;}
        .sf-btn{font-family:'Press Start 2P',monospace;font-size:12px;padding:.5rem .9rem;background:rgba(255,255,255,.04);border:1.5px solid rgba(255,255,255,.12);border-radius:6px;color:rgba(255,255,255,.38);cursor:pointer;transition:all .14s;letter-spacing:1px;}
        .sf-btn:hover{background:rgba(255,140,0,.09);border-color:rgba(255,140,0,.4);color:rgba(255,140,0,.85);}
        .sf-btn.sf-on{background:rgba(255,140,0,.15);border-color:#FF8C00;color:#FF8C00;text-shadow:0 0 10px rgba(255,140,0,.4);}
        .sf-btn.sf-dim{opacity:.45;}
        .sf-mode-vals{font-family:'VT323',monospace;font-size:14px;color:rgba(0,255,150,.45);border:1px solid rgba(0,255,150,.18);border-radius:4px;padding:.1rem .38rem;white-space:nowrap;}
        .sf-sel-wrap{position:relative;display:inline-flex;align-items:center;}
        .sf-sel{font-family:'Press Start 2P',monospace;font-size:12px;padding:.5rem 2.2rem .5rem .9rem;background:rgba(0,0,20,.85);border:1.5px solid rgba(255,255,255,.2);border-radius:6px;color:rgba(255,255,255,.78);cursor:pointer;appearance:none;-webkit-appearance:none;letter-spacing:1px;transition:border-color .15s;min-width:155px;}
        .sf-sel:hover,.sf-sel:focus{border-color:rgba(255,140,0,.55);outline:none;color:#FF8C00;}
        .sf-sel option{background:#0a0a18;color:#fff;}
        .sf-caret{position:absolute;right:.6rem;font-size:14px;color:rgba(255,255,255,.4);pointer-events:none;}
        .sf-count{font-family:'Press Start 2P',monospace;font-size:10px;color:rgba(255,255,255,.2);letter-spacing:1px;margin-left:auto;}

        .sp-table {
          width: max-content; /* table width grows naturally */
          border-collapse: collapse;
        }
        .sp-table-outer {
          width: 100%; /* just full width */
          /* no overflow-x here! */
        }

        .sp-gh{font-family:'Press Start 2P',monospace;font-size:10px;letter-spacing:3px;padding:.5rem .65rem .4rem;text-align:center;border-bottom:2px solid rgba(255,255,255,.1);}
        .sp-th{font-family:'Press Start 2P',monospace;font-size:11px;padding:.65rem .65rem;white-space:nowrap;position:sticky;top:0;z-index:10;border-bottom:2px solid rgba(255,255,255,.12);user-select:none;color:rgba(255,255,255,.5);transition:color .12s,background .12s;}
        .sp-th.sortable{cursor:pointer;}
        .sp-th.sortable:hover{color:#FF8C00!important;filter:brightness(1.25);}
        .sp-th.active{color:#FF8C00!important;}
        .sort-icon{opacity:.5;font-size:10px;}
        .sp-th.active .sort-icon{opacity:1;}

        .sp-even{background:rgba(0,0,22,.88);}
        .sp-odd{background:rgba(0,0,10,.92);}
        .sp-table tbody tr:hover td{filter:brightness(1.3);}
        .sp-td{font-family:'VT323',monospace;font-size:22px;color:rgba(255,255,255,.82);padding:.38rem .65rem;border-bottom:1px solid rgba(255,255,255,.04);white-space:nowrap;transition:filter .08s;}

        /* Manager cell */
        .td-mgr{display:flex;align-items:center;gap:.45rem;min-width:160px;}
        .td-avatar{width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid rgba(255,255,255,.2);box-shadow:0 0 6px rgba(255,255,255,.12);}
        .td-avatar-fb{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(135,206,235,.12);border:1.5px solid rgba(135,206,235,.28);font-family:'Press Start 2P',monospace;font-size:8px;color:#87CEEB;flex-shrink:0;letter-spacing:0;}
        .td-mgr-names{display:flex;flex-direction:column;gap:1px;overflow:hidden;}
        .td-mgrname{font-family:'Press Start 2P',monospace;font-size:11px;color:rgba(255,255,255,.9);letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;}
        .td-discord{font-family:'VT323',monospace;font-size:14px;color:rgba(88,101,242,.6);letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px;}

        .td-rank{font-family:'Press Start 2P',monospace;font-size:11px;color:rgba(255,255,255,.22);}
        .td-val.great{color:#FFD700;text-shadow:0 0 10px rgba(255,215,0,.5);}
        .td-val.pos{color:#00DD55;text-shadow:0 0 8px rgba(0,221,85,.4);}
        .td-val.neg{color:#FF5555;text-shadow:0 0 8px rgba(255,85,85,.3);}

        .sp-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:5rem 2rem;max-width:1600px;margin:0 auto;}
        .sp-spinner{width:44px;height:44px;border-radius:50%;border:3px solid rgba(255,140,0,.15);border-top-color:#FF8C00;animation:spin .8s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .sp-state-txt{font-family:'Press Start 2P',monospace;font-size:16px;color:rgba(255,255,255,.28);letter-spacing:3px;}
        .sp-state-sub{font-family:'VT323',monospace;font-size:20px;color:rgba(255,255,255,.2);text-align:center;max-width:520px;letter-spacing:1px;}

        .sp-placeholder{display:flex;flex-direction:column;align-items:center;gap:1.2rem;padding:5rem 2rem;max-width:1600px;margin:0 auto;}
        .sp-ph-title{font-family:'Press Start 2P',monospace;font-size:18px;color:rgba(255,255,255,.22);letter-spacing:4px;text-align:center;}
        .sp-ph-sub{font-family:'VT323',monospace;font-size:22px;color:rgba(255,255,255,.18);text-align:center;max-width:500px;letter-spacing:1px;}
        .sp-ph-sub code{background:rgba(255,255,255,.08);padding:.1rem .3rem;border-radius:3px;font-size:18px;}
        .sp-ph-preview{display:flex;flex-wrap:wrap;gap:.5rem;justify-content:center;margin-top:.5rem;}
        .sp-ph-col{font-family:'Press Start 2P',monospace;font-size:10px;color:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.08);border-radius:4px;padding:.4rem .7rem;}

        .sp-legend{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem 1.4rem;padding:.75rem 2rem;max-width:1600px;margin:0 auto;}
        .leg-item{display:flex;align-items:center;gap:.4rem;font-family:'Press Start 2P',monospace;font-size:10px;color:rgba(255,255,255,.28);}
        .leg-sw{display:inline-block;width:16px;height:14px;border-radius:3px;flex-shrink:0;}
        .leg-note{font-family:'VT323',monospace;font-size:15px;color:rgba(255,255,255,.16);margin-left:auto;text-align:right;}

        @media(max-width:900px){
          .sp-header{padding:1rem 1.25rem .75rem;} .sp-h1{font-size:22px;}
          .sp-tabs{padding:.75rem 1.25rem 0;} .sp-tabs-line{left:1.25rem;right:1.25rem;}
          .sp-tab{font-size:12px;padding:.65rem 1.1rem;}
          .sp-filters{padding:.7rem 1.25rem;}
          .sp-table-outer{padding:0 1.25rem .75rem;}
          .sp-legend{padding:.6rem 1.25rem;}
        }
        @media(max-width:600px){
          .sp-hrow{flex-direction:column;align-items:flex-start;gap:.6rem;} .sp-h1{font-size:18px;}
          .sp-tab{font-size:11px;padding:.6rem .9rem;}
          .sf-btn{font-size:11px;padding:.4rem .7rem;}
          .sp-td{font-size:20px;padding:.3rem .45rem;}
          .td-mgrname{font-size:10px;max-width:90px;} .td-discord{display:none;}
          .sf-count,.sf-mode-vals{display:none;}
        }
      `}</style>
    </div>
  );
}
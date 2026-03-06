// Stats.jsx — Manager Stats + H2H
import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from '../components/LeagueContext';

const lgPrefix = lg => (lg || '').replace(/[0-9]/g, '').trim();
const norm     = s  => (s || '').toString().trim().toLowerCase();

const ASC_DEFAULT = new Set(['l','t','hl','htie','al','atie','otl','hotl','aotl','ga','gapg']);

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

// H2H columns — same groups/layout as managers, opponent instead of coach, streak replaces champs
const H2H_COLS = [
  { key:'rank',   label:'#',      tip:'Rank',                               sortable:false, align:'center', group:'core'   },
  { key:'opp',    label:'OPP',    tip:'Opponent Coach',                     sortable:true,  align:'left',   group:'core'   },
  { key:'gp',     label:'GP',     tip:'Games Played',                       sortable:true,  align:'center', group:'record' },
  { key:'w',      label:'W',      tip:'Wins',                               sortable:true,  align:'center', group:'record' },
  { key:'l',      label:'L',      tip:'Losses',                             sortable:true,  align:'center', group:'record' },
  { key:'t',      label:'T',      tip:'Ties',                               sortable:true,  align:'center', group:'record' },
  { key:'otl',    label:'OTL',    tip:'Overtime Losses',                    sortable:true,  align:'center', group:'record' },
  { key:'pct',    label:'WIN%',   tip:'Win Percentage',                     sortable:true,  align:'center', group:'record' },
  { key:'gf',     label:'GF',     tip:'Goals For',                          sortable:true,  align:'center', group:'goals'  },
  { key:'ga',     label:'GA',     tip:'Goals Against',                      sortable:true,  align:'center', group:'goals'  },
  { key:'diff',   label:'+/-',    tip:'Goal Differential',                  sortable:true,  align:'center', group:'goals'  },
  { key:'gfpg',   label:'GF/G',   tip:'Goals For per Game',                 sortable:true,  align:'center', group:'goals'  },
  { key:'gapg',   label:'GA/G',   tip:'Goals Against per Game',             sortable:true,  align:'center', group:'goals'  },
  { key:'hw',     label:'W',      tip:'Home Wins',                          sortable:true,  align:'center', group:'home'   },
  { key:'hl',     label:'L',      tip:'Home Losses',                        sortable:true,  align:'center', group:'home'   },
  { key:'htie',   label:'T',      tip:'Home Ties',                          sortable:true,  align:'center', group:'home'   },
  { key:'hotl',   label:'OTL',    tip:'Home OT Losses',                     sortable:true,  align:'center', group:'home'   },
  { key:'aw',     label:'W',      tip:'Away Wins',                          sortable:true,  align:'center', group:'away'   },
  { key:'al',     label:'L',      tip:'Away Losses',                        sortable:true,  align:'center', group:'away'   },
  { key:'atie',   label:'T',      tip:'Away Ties',                          sortable:true,  align:'center', group:'away'   },
  { key:'aotl',   label:'OTL',    tip:'Away OT Losses',                     sortable:true,  align:'center', group:'away'   },
  { key:'so',     label:'SO',     tip:'Shutouts (opponent scored 0)',            sortable:true,  align:'center', group:'extra'  },
  { key:'maxgf',  label:'MAX G',  tip:'Most Goals Scored in a Single Game',     sortable:true,  align:'center', group:'extra'  },
  { key:'streak', label:'STK',    tip:'Current streak vs this opponent',         sortable:true,  align:'center', group:'extra'  },
  { key:'longW',  label:'LNG W',  tip:'Longest winning streak vs this opponent', sortable:true,  align:'center', group:'extra'  },
  { key:'longL',  label:'LNG L',  tip:'Longest losing streak vs this opponent',  sortable:true,  align:'center', group:'extra'  },
];

const GROUPS = {
  core:   { label:'',       headerBg:'#07071a',               cellBg:'#07071a',               groupBg:'#07071a',               groupText:'rgba(255,255,255,.3)',  borderLeft:'none' },
  record: { label:'RECORD', headerBg:'rgba(160,170,255,.09)', cellBg:'rgba(100,110,200,.055)', groupBg:'rgba(160,170,255,.17)', groupText:'rgba(185,195,255,.9)', borderLeft:'3px solid rgba(140,150,255,.5)' },
  goals:  { label:'GOALS',  headerBg:'rgba(255,140,0,.11)',   cellBg:'rgba(255,120,0,.065)',   groupBg:'rgba(255,140,0,.2)',    groupText:'rgba(255,175,75,.95)', borderLeft:'3px solid rgba(255,140,0,.6)' },
  home:   { label:'HOME',   headerBg:'rgba(80,165,255,.11)',  cellBg:'rgba(60,140,255,.065)',  groupBg:'rgba(100,175,255,.2)', groupText:'rgba(145,215,255,.95)', borderLeft:'3px solid rgba(100,170,255,.6)' },
  away:   { label:'AWAY',   headerBg:'rgba(170,110,255,.11)', cellBg:'rgba(150,90,240,.065)',  groupBg:'rgba(180,120,255,.2)', groupText:'rgba(205,165,255,.95)', borderLeft:'3px solid rgba(175,115,255,.6)' },
  extra:  { label:'EXTRA',  headerBg:'rgba(255,215,0,.09)',   cellBg:'rgba(230,195,0,.05)',    groupBg:'rgba(255,215,0,.17)',  groupText:'rgba(255,220,60,.95)', borderLeft:'3px solid rgba(255,215,0,.5)' },
};

const LOSS_KEYS = new Set(['l','t','htie','atie','hl','al','otl','hotl','aotl','ga','gapg']);
const SEASON_VALS  = new Set(['REG','REGULAR','SEASON','S','RS','REGULAR SEASON']);
const PLAYOFF_VALS = new Set(['PO','PLAYOFF','PLAYOFFS','P','POST','POSTSEASON']);

const isWin = (sh, sa, ot, side) => side === 'home' ? sh > sa : sa > sh;
const isLoss= (sh, sa, ot, side) => side === 'home' ? sh < sa : sa < sh;
const isTie = (sh, sa)           => sh === sa;
const isOT  = (g)                => !!g.ot;

// Derive result for a team from scores
function deriveResult(sh, sa, ot, side) {
  if (sh === sa) return 'T';
  const won = side === 'home' ? sh > sa : sa > sh;
  if (won) return ot ? 'OTW' : 'W';
  return ot ? 'OTL' : 'L';
}

// ─── Manager stats aggregation (score-derived) ────────────────────────────
function buildManagerStats(games, champMap) {
  const m = new Map();
  const slot = normKey => {
    if (!normKey) return null;
    if (!m.has(normKey)) m.set(normKey, {
      normKey, gp:0, w:0, l:0, t:0, otl:0,
      gf:0, ga:0, hw:0, hl:0, htie:0, hotl:0,
      aw:0, al:0, atie:0, aotl:0, so:0, maxgf:0, _displayName:'',
    });
    return m.get(normKey);
  };

  for (const g of games) {
    const hCoach = (g.coach_home||'').trim();
    const aCoach = (g.coach_away||'').trim();
    if (!hCoach || !aCoach) continue;
    const h = slot(norm(hCoach)), a = slot(norm(aCoach));
    if (!h || !a) continue;
    if (!h._displayName) h._displayName = hCoach;
    if (!a._displayName) a._displayName = aCoach;

    const sh = Number(g.score_home||0), sa = Number(g.score_away||0);
    const ot = !!g.ot;
    h.gp++; a.gp++;
    h.gf += sh; h.ga += sa; h.maxgf = Math.max(h.maxgf, sh);
    a.gf += sa; a.ga += sh; a.maxgf = Math.max(a.maxgf, sa);

    const hr = deriveResult(sh, sa, ot, 'home');
    const ar = deriveResult(sh, sa, ot, 'away');

    if      (hr==='W'  ){ h.w++;   h.hw++;   }
    else if (hr==='OTW'){ h.w++;   h.hw++;   }
    else if (hr==='T'  ){ h.t++;   h.htie++; }
    else if (hr==='OTL'){ h.otl++; h.hotl++; }
    else                { h.l++;   h.hl++;   }

    if      (ar==='W'  ){ a.w++;   a.aw++;   }
    else if (ar==='OTW'){ a.w++;   a.aw++;   }
    else if (ar==='T'  ){ a.t++;   a.atie++; }
    else if (ar==='OTL'){ a.otl++; a.aotl++; }
    else                { a.l++;   a.al++;   }

    if (sa === 0) h.so++;
    if (sh === 0) a.so++;
  }

  return Array.from(m.values()).map(s => ({
    ...s, mgr: s.normKey,
    pct:  s.gp ? s.w / s.gp : 0,
    gfpg: s.gp ? +(s.gf / s.gp).toFixed(2) : 0,
    gapg: s.gp ? +(s.ga / s.gp).toFixed(2) : 0,
    diff: s.gf - s.ga,
    champs: champMap.get(s.normKey) ?? null,
  }));
}

// ─── H2H aggregation ─────────────────────────────────────────────────────
// Returns rows from mgrA's perspective vs each opponent (or a single opp)
function buildH2HStats(games, mgrANorm, mgrBNorm) {
  // Filter to only games involving mgrA
  const relevant = games.filter(g => {
    const h = norm(g.coach_home || '');
    const a = norm(g.coach_away || '');
    if (h !== mgrANorm && a !== mgrANorm) return false;
    if (mgrBNorm && mgrBNorm !== 'ALL') {
      return h === mgrBNorm || a === mgrBNorm;
    }
    return h !== mgrANorm || a !== mgrANorm; // exclude mirror games
  });

  // Group by opponent
  const oppMap = new Map();

  // Sort by game id ascending so streak is computed in order
  const sorted = [...relevant].sort((a, b) => (a.id || 0) - (b.id || 0));

  for (const g of sorted) {
    const hCoach = norm(g.coach_home || '');
    const aCoach = norm(g.coach_away || '');
    const aIsHome = hCoach === mgrANorm;
    const oppNorm = aIsHome ? aCoach : hCoach;
    const oppDisplay = aIsHome ? (g.coach_away||'').trim() : (g.coach_home||'').trim();
    if (!oppNorm || oppNorm === mgrANorm) continue;

    if (!oppMap.has(oppNorm)) {
      oppMap.set(oppNorm, {
        oppNorm, oppDisplay,
        gp:0, w:0, l:0, t:0, otl:0,
        gf:0, ga:0,
        hw:0, hl:0, htie:0, hotl:0,
        aw:0, al:0, atie:0, aotl:0,
        so:0, maxgf:0,
        _results: [], // chronological: 'W'|'L'|'T'|'OTL'
      });
    }
    const row = oppMap.get(oppNorm);

    const sh = Number(g.score_home||0), sa = Number(g.score_away||0);
    const ot = !!g.ot;

    // mgrA's perspective
    const myScore  = aIsHome ? sh : sa;
    const oppScore = aIsHome ? sa : sh;
    const side     = aIsHome ? 'home' : 'away';
    const res      = deriveResult(sh, sa, ot, side);

    row.gp++;
    row.gf += myScore; row.ga += oppScore;
    row.maxgf = Math.max(row.maxgf, myScore);
    if (oppScore === 0) row.so++;

    if (aIsHome) {
      if      (res==='W'||res==='OTW'){ row.w++; row.hw++; }
      else if (res==='T'             ){ row.t++; row.htie++; }
      else if (res==='OTL'           ){ row.otl++; row.hotl++; }
      else                            { row.l++; row.hl++; }
    } else {
      if      (res==='W'||res==='OTW'){ row.w++; row.aw++; }
      else if (res==='T'             ){ row.t++; row.atie++; }
      else if (res==='OTL'           ){ row.otl++; row.aotl++; }
      else                            { row.l++; row.al++; }
    }

    // Track result for streak calc — treat OTW as W
    row._results.push(res === 'OTW' ? 'W' : res);
  }

  // Compute streak from most recent result backward
  const computeStreak = (results) => {
    if (!results.length) return '–';
    const last = results[results.length - 1];
    let count = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      if (results[i] === last) count++;
      else break;
    }
    return `${last}${count}`;
  };

  // Compute longest W or L streak from results array
  const computeLongest = (results, target) => {
    let max = 0, cur = 0;
    for (const r of results) {
      if (r === target) { cur++; max = Math.max(max, cur); }
      else cur = 0;
    }
    return max;
  };

  return Array.from(oppMap.values()).map(({ _results, ...s }) => ({
    ...s,
    opp:    s.oppNorm,
    pct:    s.gp ? s.w / s.gp : 0,
    gfpg:   s.gp ? +(s.gf / s.gp).toFixed(2) : 0,
    gapg:   s.gp ? +(s.ga / s.gp).toFixed(2) : 0,
    diff:   s.gf - s.ga,
    streak: computeStreak(_results),
    longW:  computeLongest(_results, 'W'),
    longL:  computeLongest(_results, 'L'),
    _streakVal: (() => {
      if (!_results.length) return 0;
      const last = _results[_results.length - 1];
      let count = 0;
      for (let i = _results.length - 1; i >= 0; i--) {
        if (_results[i] === last) count++; else break;
      }
      return last === 'W' ? count : last === 'L' ? -count : 0;
    })(),
  }));
}

// ─── Formatting helpers ───────────────────────────────────────────────────
function fmtChamps(v, isAllSeasons) {
  if (v === null || v === undefined) return '–';
  if (isAllSeasons) { const n = Number(v); if (!n) return '–'; if (n <= 3) return '🏆'.repeat(n); return `🏆 ×${n}`; }
  return v ? '🏆' : '–';
}

function fmtVal(v, key, isAllSeasons) {
  if (v===null||v===undefined) return '–';
  if (key==='champs') return fmtChamps(v, isAllSeasons);
  if (key==='streak') return v || '–';
  if (key==='longW') return Number(v) > 0 ? String(v) : '–';
  if (key==='longL') return Number(v) > 0 ? String(v) : '–';
  if (key==='pct'){ const n=Number(v); if(!isFinite(n))return'–'; return n===1?'1.000':n.toFixed(3).replace(/^0/,''); }
  if (key==='gfpg'||key==='gapg') return Number(v).toFixed(2);
  if (key==='diff') return v>0?`+${v}`:String(v);
  return String(v);
}

function streakColor(streak) {
  if (!streak || streak === '–') return undefined;
  if (streak.startsWith('W')) return '#00DD55';
  if (streak.startsWith('L')) return '#FF5555';
  return '#87CEEB';
}

// ─── Shared table renderer ────────────────────────────────────────────────
function StatsTable({ cols, rows, sortKey, sortDir, onSort, isAllSeasons, mgrMeta, isH2H }) {
  const groupSpans = useMemo(() => {
    const out=[]; let cur=null, span=0;
    for (const c of cols) {
      if (c.group!==cur) { if(cur!==null) out.push({group:cur,span}); cur=c.group; span=1; }
      else span++;
    }
    if (cur!==null) out.push({group:cur,span});
    return out;
  }, [cols]);

  const isFirstInGroup = useMemo(() => {
    const s=new Set(); let prev=null;
    for (const c of cols) { if(c.group!==prev){s.add(c.key);prev=c.group;} }
    return s;
  }, [cols]);

  const maxVals = useMemo(() => {
    const mv={};
    for (const c of cols) {
      if (!['rank','mgr','opp','champs','streak'].includes(c.key)) {
        const vals = rows.map(r=>Number(r[c.key]||0)).filter(isFinite);
        mv[c.key] = vals.length ? Math.max(...vals) : 1;
      }
    }
    return mv;
  }, [rows, cols]);

  return (
    <table className="sp-table">
      <thead>
        <tr>
          {groupSpans.map(({group,span},i) => {
            const g = GROUPS[group]||{};
            return (
              <th key={i} colSpan={span} className="sp-gh"
                style={{background:g.groupBg,color:g.groupText,borderLeft:i>0?g.borderLeft:'none'}}
              >{g.label}</th>
            );
          })}
        </tr>
        <tr>
          {cols.map(col => {
            const g = GROUPS[col.group]||{};
            const active = sortKey===col.key;
            const first = isFirstInGroup.has(col.key);
            return (
              <th key={col.key}
                className={`sp-th${col.sortable?' sortable':''}${active?' active':''}`}
                style={{
                  background: active?'rgba(255,180,0,0.18)':g.headerBg,
                  textAlign: col.align,
                  borderLeft: first&&col.group!=='core'?g.borderLeft:'none',
                }}
                onClick={() => col.sortable && onSort(col.key)}
                title={col.tip}
              >
                {col.label}
                {col.sortable && (
                  <span className="sort-icon">{active?(sortDir==='desc'?' ▼':' ▲'):' ⇅'}</span>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => {
          const nameKey   = isH2H ? row.oppNorm : row.normKey;
          const meta      = mgrMeta.get(nameKey);
          const displayName = isH2H
            ? (meta?.displayName || row.oppDisplay || row.oppNorm)
            : (meta?.displayName || row._displayName || row.normKey);
          const discordName  = meta?.discordName || null;
          const discordIsSame = discordName && norm(discordName)===norm(displayName);

          return (
            <tr key={isH2H ? row.oppNorm : row.mgr} className={`sp-row ${idx%2===0?'sp-even':'sp-odd'}`}>
              {cols.map(col => {
                const cellKey = isH2H ? col.key : col.key;
                const raw  = col.key==='rank' ? idx+1 : row[col.key];
                const num  = Number(raw);
                const g    = GROUPS[col.group]||{};
                const mx   = maxVals[col.key]||1;
                const first= isFirstInGroup.has(col.key);
                const isSorted = sortKey===col.key;

                let heatBg = g.cellBg;
                if (isFinite(num) && !['rank','mgr','opp','champs','streak'].includes(col.key)) {
                  const pct = Math.min(Math.abs(num)/mx, 1);
                  if (LOSS_KEYS.has(col.key) && num>0)
                    heatBg = `rgba(255,55,55,${(pct*0.22).toFixed(3)})`;
                  else if (!LOSS_KEYS.has(col.key) && pct>0.7)
                    heatBg = `rgba(255,210,0,${((pct-0.7)*0.65).toFixed(3)})`;
                }

                const nameColKey = isH2H ? 'opp' : 'mgr';

                return (
                  <td key={col.key}
                    className={`sp-td${isSorted?' sorted':''}`}
                    style={{
                      textAlign: col.align,
                      background: heatBg,
                      borderLeft: first&&col.group!=='core'?g.borderLeft:'none',
                    }}
                  >
                    {col.key===nameColKey ? (
                      <div className="td-mgr">
                        {meta?.avatar_url ? (
                          <img src={meta.avatar_url} alt="" className="td-avatar"
                            onError={e=>{e.currentTarget.style.display='none';}}/>
                        ) : (
                          <div className="td-avatar-fb">
                            {displayName.replace(/\s+/g,'').slice(0,2).toUpperCase()}
                          </div>
                        )}
                        <div className="td-mgr-names">
                          <span className="td-mgrname">{displayName}</span>
                          {discordName && (
                            <span className="td-discord" style={{opacity:discordIsSame?0.3:0.85}}>
                              @{discordName}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : col.key==='rank' ? (
                      <span className="td-rank">{raw}</span>
                    ) : col.key==='streak' ? (
                      <span className="td-val" style={{color:streakColor(raw),textShadow:streakColor(raw)?`0 0 8px ${streakColor(raw)}44`:undefined,fontWeight:'bold'}}>
                        {fmtVal(raw, col.key, isAllSeasons)}
                      </span>
                    ) : col.key==='longW' ? (
                      <span className="td-val" style={{color: Number(raw)>0?'#00DD55':undefined, textShadow: Number(raw)>0?'0 0 8px rgba(0,221,85,.4)':undefined}}>
                        {fmtVal(raw, col.key, isAllSeasons)}
                      </span>
                    ) : col.key==='longL' ? (
                      <span className="td-val" style={{color: Number(raw)>0?'#FF5555':undefined, textShadow: Number(raw)>0?'0 0 8px rgba(255,85,85,.3)':undefined}}>
                        {fmtVal(raw, col.key, isAllSeasons)}
                      </span>
                    ) : col.key==='champs' ? (
                      <span className={`td-val${raw?' td-champ':''}`}>
                        {fmtVal(raw, col.key, isAllSeasons)}
                      </span>
                    ) : col.key==='pct' ? (
                      <span className={`td-val${num>=0.65?' great':''}`}>{fmtVal(raw, col.key)}</span>
                    ) : col.key==='diff' ? (
                      <span className={`td-val${num>0?' pos':num<0?' neg':''}`}>{fmtVal(raw, col.key)}</span>
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
  );
}

// ─── Main component ───────────────────────────────────────────────────────
export default function Stats() {
  const { selectedLeague } = useLeague();

  const [tab,           setTab]         = useState('managers');
  const [allSeasons,    setAllSeasons]  = useState([]);
  const [seasonFilter,  setSeasonFilter]= useState('ALL');
  const [modeFilter,    setModeFilter]  = useState('ALL');
  const [allGames,      setAllGames]    = useState([]);
  const [managers,      setManagers]    = useState([]);
  const [champData,     setChampData]   = useState({ allSeasonsMap: new Map(), perSeasonMap: new Map() });
  const [loading,       setLoading]     = useState(true);
  const [modeValues,    setModeValues]  = useState([]);

  // H2H state
  const [h2hMgrA,  setH2hMgrA]  = useState('');
  const [h2hMgrB,  setH2hMgrB]  = useState('ALL');

  const [sort,      dispatchSort] = useState({ key:'pct', dir:'desc' });
  const [h2hSort,   dispatchH2hSort] = useState({ key:'pct', dir:'desc' });

  const sortKey = sort.key; const sortDir = sort.dir;
  const h2hSortKey = h2hSort.key; const h2hSortDir = h2hSort.dir;

  // ── Fetch managers ───────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('managers')
      .select('id,coach_name,discord_id,discord_username,discord_url')
      .then(({ data, error }) => {
        if (error) console.warn('[Stats] managers error:', error.message);
        setManagers(data||[]);
      });
  }, []);

  const mgrMeta = useMemo(() => {
    const m = new Map();
    for (const mgr of managers) {
      if (!mgr.coach_name) continue;
      m.set(norm(mgr.coach_name), {
        displayName: mgr.coach_name,
        discordName: (mgr.discord_username||'').trim() || null,
        avatar_url:  mgr.discord_url || null,
      });
    }
    return m;
  }, [managers]);

  // ── Fetch all games ──────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true); setAllGames([]); setModeValues([]);
    supabase.from('games')
      .select('id,lg,mode,home,away,coach_home,coach_away,score_home,score_away,ot')
      .then(({ data, error }) => {
        if (error) { console.error('[Stats] games error:', error.message); setLoading(false); return; }
        const rows = data||[];
        setAllGames(rows);
        setModeValues([...new Set(rows.map(g=>g.mode).filter(Boolean))]);
        setLoading(false);
      });
  }, []);

  const leagueGames = useMemo(() => {
    if (!selectedLeague||!allGames.length) return [];
    return allGames.filter(g=>g.lg&&lgPrefix(g.lg)===selectedLeague);
  }, [allGames, selectedLeague]);

  useEffect(() => {
    setSeasonFilter('ALL');
    if (!leagueGames.length) { setAllSeasons([]); return; }
    const codes = [...new Set(leagueGames.map(g=>g.lg).filter(Boolean))];
    codes.sort((a,b) => {
      const na=parseInt(a.replace(/\D/g,''),10)||0, nb=parseInt(b.replace(/\D/g,''),10)||0;
      return nb-na;
    });
    setAllSeasons(codes);
  }, [leagueGames]);

  // ── Championships ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!allSeasons.length) return;
    Promise.all([
      supabase.from('standings').select('team,season').in('season',allSeasons).eq('season_rank',1),
      supabase.from('teams').select('abr,lg,coach').in('lg',allSeasons),
    ]).then(([{data:sd},{data:td}]) => {
      const abrLg = new Map();
      for (const t of (td||[])) if (t.abr&&t.lg) abrLg.set(`${t.abr}:${t.lg}`, norm(t.coach));
      const allMap = new Map(), perMap = new Map();
      for (const s of (sd||[])) {
        const ck = abrLg.get(`${s.team}:${s.season}`);
        if (!ck) continue;
        allMap.set(ck, (allMap.get(ck)||0)+1);
        if (!perMap.has(s.season)) perMap.set(s.season, new Map());
        perMap.get(s.season).set(ck, true);
      }
      setChampData({ allSeasonsMap: allMap, perSeasonMap: perMap });
    });
  }, [allSeasons]);

  const isAllSeasons = seasonFilter === 'ALL';
  const champMap = useMemo(() => {
    if (isAllSeasons) return champData.allSeasonsMap;
    return champData.perSeasonMap.get(seasonFilter) || new Map();
  }, [champData, seasonFilter, isAllSeasons]);

  // ── Filtered games ───────────────────────────────────────────────────────
  const filteredGames = useMemo(() => {
    if (!leagueGames.length) return [];
    let r = isAllSeasons ? leagueGames : leagueGames.filter(g=>g.lg===seasonFilter);
    if (modeFilter==='SEASON')   r = r.filter(g=>SEASON_VALS.has((g.mode||'').trim().toUpperCase()));
    if (modeFilter==='PLAYOFFS') r = r.filter(g=>PLAYOFF_VALS.has((g.mode||'').trim().toUpperCase()));
    return r;
  }, [leagueGames, seasonFilter, isAllSeasons, modeFilter]);

  // ── Sort handlers ────────────────────────────────────────────────────────
  const handleSort = useCallback((key) => {
    if (!key||key==='rank') return;
    dispatchSort(prev => prev.key===key
      ? { key, dir: prev.dir==='desc'?'asc':'desc' }
      : { key, dir: ASC_DEFAULT.has(key)?'asc':'desc' });
  }, []);

  const handleH2hSort = useCallback((key) => {
    if (!key||key==='rank') return;
    dispatchH2hSort(prev => prev.key===key
      ? { key, dir: prev.dir==='desc'?'asc':'desc' }
      : { key, dir: ASC_DEFAULT.has(key)?'asc':'desc' });
  }, []);

  useEffect(() => { dispatchSort({ key:'pct', dir:'desc' }); }, [tab]);
  useEffect(() => { dispatchH2hSort({ key:'pct', dir:'desc' }); }, [tab]);

  // ── Manager list for H2H dropdowns ──────────────────────────────────────
  const h2hManagerList = useMemo(() => {
    const coaches = new Set();
    for (const g of filteredGames) {
      if (g.coach_home) coaches.add((g.coach_home).trim());
      if (g.coach_away) coaches.add((g.coach_away).trim());
    }
    return [...coaches].sort((a,b) => a.localeCompare(b));
  }, [filteredGames]);

  // Reset mgrA if they disappear from filtered games
  useEffect(() => {
    if (h2hMgrA && !h2hManagerList.map(norm).includes(norm(h2hMgrA))) {
      setH2hMgrA('');
    }
  }, [h2hManagerList, h2hMgrA]);

  // ── Manager rows ─────────────────────────────────────────────────────────
  const managerRows = useMemo(() => {
    if (!filteredGames.length) return [];
    return buildManagerStats(filteredGames, champMap);
  }, [filteredGames, champMap]);

  const sortedManagerRows = useMemo(() => {
    return [...managerRows].sort((a,b) => {
      let av=a[sortKey], bv=b[sortKey];
      if (sortKey==='champs') { av=av==null?-1:(av===true?1:Number(av)); bv=bv==null?-1:(bv===true?1:Number(bv)); }
      if (typeof av==='string') { av=av.toLowerCase(); bv=(bv||'').toLowerCase(); }
      if (av===bv) return 0;
      return (av>bv?1:-1)*(sortDir==='desc'?-1:1);
    });
  }, [managerRows, sortKey, sortDir]);

  // ── H2H rows ──────────────────────────────────────────────────────────────
  const h2hRows = useMemo(() => {
    if (!h2hMgrA || !filteredGames.length) return [];
    const mgrANorm = norm(h2hMgrA);
    const mgrBNorm = h2hMgrB === 'ALL' ? 'ALL' : norm(h2hMgrB);
    return buildH2HStats(filteredGames, mgrANorm, mgrBNorm);
  }, [filteredGames, h2hMgrA, h2hMgrB]);

  const sortedH2hRows = useMemo(() => {
    return [...h2hRows].sort((a,b) => {
      let av = h2hSortKey==='streak' ? a._streakVal : a[h2hSortKey];
      let bv = h2hSortKey==='streak' ? b._streakVal : b[h2hSortKey];
      if (typeof av==='string') { av=av.toLowerCase(); bv=(bv||'').toLowerCase(); }
      if (av===bv) return 0;
      return (av>bv?1:-1)*(h2hSortDir==='desc'?-1:1);
    });
  }, [h2hRows, h2hSortKey, h2hSortDir]);

  const hasModeData = modeValues.length > 0;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="sp">
      <div className="scanlines" aria-hidden />

      <div className="scoreboard-header-container">
        <div className="scoreboard-header">
          <div className="led-text">STATS</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="sp-tabs">
        <div style={{display:'flex',gap:'.5rem',alignItems:'flex-end',flex:1}}>
          <button className={`sp-tab ${tab==='managers'?'on':''}`} onClick={()=>setTab('managers')}>👔 MANAGERS</button>
          <button className={`sp-tab ${tab==='h2h'?'on':''}`}      onClick={()=>setTab('h2h')}>⚔️ H2H</button>
          <button className={`sp-tab ${tab==='players'?'on':''}`}  onClick={()=>setTab('players')}>🏒 PLAYERS</button>
        </div>
        {((tab==='managers'&&sortedManagerRows.length>0)||(tab==='h2h'&&sortedH2hRows.length>0)) && (
          <div className="sp-legend-inline">
            <div className="leg-item"><span className="leg-sw" style={{background:'rgba(255,210,0,.38)',border:'1px solid rgba(255,215,0,.6)'}}/>BEST</div>
            <div className="leg-item"><span className="leg-sw" style={{background:'rgba(255,55,55,.32)',border:'1px solid rgba(255,80,80,.5)'}}/>WORST</div>
          </div>
        )}
        <div className="sp-tabs-line"/>
      </div>

      {/* ── Filters ── */}
      <div className="sp-filters">
        <div className="sp-filters-inner">
          <div className="sf-group">
            <span className="sf-lbl">MODE</span>
            <div className="sf-btns">
              {['ALL','SEASON','PLAYOFFS'].map(mo => (
                <button key={mo}
                  className={`sf-btn ${modeFilter===mo?'sf-on':''}${!hasModeData&&mo!=='ALL'?' sf-dim':''}`}
                  onClick={() => setModeFilter(mo)}
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
          {tab==='managers' && !loading && sortedManagerRows.length>0 && (
            <div className="sf-count">{filteredGames.length.toLocaleString()} GAMES · {sortedManagerRows.length} COACHES</div>
          )}
          {tab==='h2h' && h2hMgrA && sortedH2hRows.length>0 && (
            <div className="sf-count">{sortedH2hRows.reduce((s,r)=>s+r.gp,0)} GAMES · {sortedH2hRows.length} OPPONENTS</div>
          )}
        </div>
      </div>

      {/* ── H2H dropdowns (only shown on h2h tab) ── */}
      {tab==='h2h' && (
        <div className="h2h-selectors">
          <div className="h2h-sel-group">
            <span className="sf-lbl">MANAGER A</span>
            <div className="sf-sel-wrap">
              <select className="sf-sel h2h-sel" value={h2hMgrA} onChange={e=>{setH2hMgrA(e.target.value); setH2hMgrB('ALL');}}>
                <option value="">— SELECT MANAGER —</option>
                {h2hManagerList.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
              <span className="sf-caret">▾</span>
            </div>
          </div>
          <div className="h2h-vs">VS</div>
          <div className="h2h-sel-group">
            <span className="sf-lbl">MANAGER B</span>
            <div className="sf-sel-wrap">
              <select className="sf-sel h2h-sel" value={h2hMgrB}
                onChange={e=>setH2hMgrB(e.target.value)}
                disabled={!h2hMgrA}
              >
                <option value="ALL">ALL OPPONENTS</option>
                {h2hManagerList
                  .filter(m => norm(m) !== norm(h2hMgrA))
                  .map(m=><option key={m} value={m}>{m}</option>)}
              </select>
              <span className="sf-caret">▾</span>
            </div>
          </div>
          {h2hMgrA && (
            <div className="h2h-headline">
              <span className="h2h-name-a">{h2hMgrA}</span>
              <span className="h2h-vs-txt">vs</span>
              <span className="h2h-name-b">{h2hMgrB==='ALL'?'ALL OPPONENTS':h2hMgrB}</span>
              {sortedH2hRows.length>0&&(
                <span className="h2h-record">
                  {sortedH2hRows.reduce((s,r)=>s+r.w,0)}W–{sortedH2hRows.reduce((s,r)=>s+r.l,0)}L–{sortedH2hRows.reduce((s,r)=>s+r.t,0)}T
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Content ── */}
      {tab==='players' ? (
        <div className="sp-placeholder">
          <div style={{fontSize:50,opacity:.18}}>🏒</div>
          <div className="sp-ph-title">PLAYER STATS COMING SOON</div>
          <div className="sp-ph-sub">Will appear once <code>player_stats</code> table is populated.</div>
        </div>
      ) : tab==='h2h' ? (
        <div className="sp-table-outer">
          {loading ? (
            <div className="sp-state"><div className="sp-spinner"/><span className="sp-state-txt">CRUNCHING NUMBERS…</span></div>
          ) : !h2hMgrA ? (
            <div className="sp-state">
              <span style={{fontSize:44,opacity:.18}}>⚔️</span>
              <span className="sp-state-txt">SELECT A MANAGER</span>
              <span className="sp-state-sub">Choose Manager A to see their head-to-head record against all opponents.</span>
            </div>
          ) : sortedH2hRows.length===0 ? (
            <div className="sp-state">
              <span style={{fontSize:44,opacity:.18}}>📊</span>
              <span className="sp-state-txt">NO H2H DATA FOUND</span>
              <span className="sp-state-sub">No games found for this combination of filters.</span>
            </div>
          ) : (
            <StatsTable
              cols={H2H_COLS}
              rows={sortedH2hRows}
              sortKey={h2hSortKey}
              sortDir={h2hSortDir}
              onSort={handleH2hSort}
              isAllSeasons={isAllSeasons}
              mgrMeta={mgrMeta}
              isH2H={true}
            />
          )}
        </div>
      ) : (
        <div className="sp-table-outer">
          {loading ? (
            <div className="sp-state"><div className="sp-spinner"/><span className="sp-state-txt">CRUNCHING NUMBERS…</span></div>
          ) : sortedManagerRows.length===0 ? (
            <div className="sp-state">
              <span style={{fontSize:44,opacity:.18}}>📊</span>
              <span className="sp-state-txt">NO STATS FOUND</span>
              <span className="sp-state-sub">
                {modeFilter!=='ALL'&&!filteredGames.length
                  ?`Mode "${modeFilter}" — no games matched. DB values: ${modeValues.join(', ')}`
                  :'Check that game data exists for this league.'}
              </span>
            </div>
          ) : (
            <StatsTable
              cols={MANAGER_COLS}
              rows={sortedManagerRows}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={handleSort}
              isAllSeasons={isAllSeasons}
              mgrMeta={mgrMeta}
              isH2H={false}
            />
          )}
        </div>
      )}

      {/* ── Legends ── */}
      {tab==='managers'&&sortedManagerRows.length>0&&(
        <div className="sp-legend-footer">
          <div className="leg-item"><span className="leg-sw" style={{background:GROUPS.record.groupBg,borderLeft:GROUPS.record.borderLeft}}/>RECORD</div>
          <div className="leg-item"><span className="leg-sw" style={{background:GROUPS.goals.groupBg,borderLeft:GROUPS.goals.borderLeft}}/>GOALS</div>
          <div className="leg-item"><span className="leg-sw" style={{background:GROUPS.home.groupBg,borderLeft:GROUPS.home.borderLeft}}/>HOME</div>
          <div className="leg-item"><span className="leg-sw" style={{background:GROUPS.away.groupBg,borderLeft:GROUPS.away.borderLeft}}/>AWAY</div>
          <div className="leg-item"><span className="leg-sw" style={{background:'rgba(255,210,0,.38)',border:'1px solid rgba(255,215,0,.6)'}}/>TOP</div>
          <div className="leg-item"><span className="leg-sw" style={{background:'rgba(255,55,55,.32)',border:'1px solid rgba(255,80,80,.5)'}}/>WORST</div>
          <span className="leg-note">
            {isAllSeasons?'All-time champs shown':`${seasonFilter} champion only`}
            {' · '}Click column to sort · click again to reverse
          </span>
        </div>
      )}
      {tab==='h2h'&&sortedH2hRows.length>0&&(
        <div className="sp-legend-footer">
          <div className="leg-item"><span className="leg-sw" style={{background:GROUPS.record.groupBg,borderLeft:GROUPS.record.borderLeft}}/>RECORD</div>
          <div className="leg-item"><span className="leg-sw" style={{background:GROUPS.goals.groupBg,borderLeft:GROUPS.goals.borderLeft}}/>GOALS</div>
          <div className="leg-item"><span className="leg-sw" style={{background:GROUPS.home.groupBg,borderLeft:GROUPS.home.borderLeft}}/>HOME</div>
          <div className="leg-item"><span className="leg-sw" style={{background:GROUPS.away.groupBg,borderLeft:GROUPS.away.borderLeft}}/>AWAY</div>
          <div className="leg-item" style={{color:'#00DD55'}}><span style={{fontSize:16}}>W3</span> = Win streak</div>
          <div className="leg-item" style={{color:'#FF5555'}}><span style={{fontSize:16}}>L2</span> = Loss streak</div>
          <span className="leg-note">Stats shown from Manager A's perspective · Click column to sort</span>
        </div>
      )}

      <style>{`
        *,*::before,*::after{box-sizing:border-box;}
        html{overflow-x:auto;}
        body{background:#00000a!important;overflow-x:auto;}
        .sp{min-height:100vh;background:radial-gradient(ellipse 100% 35% at 50% 0%,#0a0a22 0%,transparent 55%),#00000a;padding-bottom:80px;overflow-x:visible;}
        .scanlines{position:fixed;inset:0;pointer-events:none;z-index:9997;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.05) 2px,rgba(0,0,0,.05) 4px);}

        .scoreboard-header-container{display:flex;justify-content:center;margin-bottom:1rem;}
        .scoreboard-header{background:#000;border:6px solid #333;border-radius:8px;padding:1rem 2rem;box-shadow:0 0 0 2px #000,inset 0 0 20px rgba(0,0,0,.8),0 8px 16px rgba(0,0,0,.5),0 0 40px rgba(255,215,0,.3);position:relative;overflow:hidden;}
        .scoreboard-header::before{content:'';position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px),repeating-linear-gradient(90deg,transparent 0px,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px);}
        .scoreboard-header::after{content:'';position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:linear-gradient(45deg,transparent 30%,rgba(255,215,0,.1) 50%,transparent 70%);animation:shimmerHdr 3s infinite;}
        @keyframes shimmerHdr{0%{transform:translateX(-100%) translateY(-100%) rotate(45deg);}100%{transform:translateX(100%) translateY(100%) rotate(45deg);}}
        .led-text{font-family:'Press Start 2P',monospace;font-size:2rem;color:#FFD700;letter-spacing:6px;text-shadow:0 0 10px #FF8C00,0 0 20px #FF8C00,0 0 30px #FFD700;filter:contrast(1.3) brightness(1.2);position:relative;}

        .sp-tabs{display:flex;align-items:flex-end;gap:.5rem;padding:0 2rem;max-width:1600px;margin:0 auto;position:relative;}
        .sp-tabs-line{position:absolute;bottom:0;left:2rem;right:2rem;height:2px;background:rgba(255,140,0,.2);}
        .sp-tab{font-family:'Press Start 2P',monospace;font-size:14px;letter-spacing:2px;padding:.8rem 1.6rem;background:rgba(255,255,255,.03);border:2px solid rgba(255,255,255,.1);border-bottom:none;border-radius:10px 10px 0 0;color:rgba(255,255,255,.32);cursor:pointer;transition:all .18s;position:relative;z-index:1;}
        .sp-tab:hover{background:rgba(255,140,0,.07);color:rgba(255,140,0,.7);border-color:rgba(255,140,0,.3);}
        .sp-tab.on{background:rgba(255,140,0,.11);border-color:rgba(255,140,0,.6);color:#FF8C00;text-shadow:0 0 14px rgba(255,140,0,.45);margin-bottom:-2px;padding-bottom:calc(.8rem + 2px);}
        .sp-legend-inline{display:flex;align-items:center;gap:.8rem;padding:.4rem .8rem;margin-bottom:4px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:6px;position:relative;z-index:1;}

        .sp-filters{background:rgba(0,0,12,.75);border-bottom:1px solid rgba(255,255,255,.06);padding:.9rem 2rem;}
        .sp-filters-inner{display:flex;align-items:center;flex-wrap:wrap;gap:.65rem 1.8rem;max-width:1600px;margin:0 auto;}
        .sf-group{display:flex;align-items:center;gap:.55rem;}
        .sf-lbl{font-family:'Press Start 2P',monospace;font-size:11px;color:rgba(255,255,255,.3);letter-spacing:2px;white-space:nowrap;}
        .sf-btns{display:flex;gap:.3rem;}
        .sf-btn{font-family:'Press Start 2P',monospace;font-size:12px;padding:.5rem .9rem;background:rgba(255,255,255,.04);border:1.5px solid rgba(255,255,255,.12);border-radius:6px;color:rgba(255,255,255,.38);cursor:pointer;transition:all .14s;letter-spacing:1px;}
        .sf-btn:hover{background:rgba(255,140,0,.09);border-color:rgba(255,140,0,.4);color:rgba(255,140,0,.85);}
        .sf-btn.sf-on{background:rgba(255,140,0,.15);border-color:#FF8C00;color:#FF8C00;text-shadow:0 0 10px rgba(255,140,0,.4);}
        .sf-btn.sf-dim{opacity:.45;}
        .sf-sel-wrap{position:relative;display:inline-flex;align-items:center;}
        .sf-sel{font-family:'Press Start 2P',monospace;font-size:12px;padding:.5rem 2.2rem .5rem .9rem;background:rgba(0,0,20,.85);border:1.5px solid rgba(255,255,255,.2);border-radius:6px;color:rgba(255,255,255,.78);cursor:pointer;appearance:none;-webkit-appearance:none;letter-spacing:1px;transition:border-color .15s;min-width:155px;}
        .sf-sel:hover,.sf-sel:focus{border-color:rgba(255,140,0,.55);outline:none;color:#FF8C00;}
        .sf-sel option{background:#0a0a18;color:#fff;}
        .sf-caret{position:absolute;right:.6rem;font-size:14px;color:rgba(255,255,255,.4);pointer-events:none;}
        .sf-count{font-family:'Press Start 2P',monospace;font-size:10px;color:rgba(255,255,255,.2);letter-spacing:1px;margin-left:auto;}

        /* H2H selectors bar */
        .h2h-selectors{display:flex;align-items:center;flex-wrap:wrap;gap:1rem 2rem;padding:1rem 2rem;background:rgba(0,0,18,.6);border-bottom:1px solid rgba(255,140,0,.15);max-width:100%;}
        .h2h-sel-group{display:flex;align-items:center;gap:.6rem;}
        .h2h-sel{min-width:200px;font-size:11px!important;}
        .h2h-vs{font-family:'Press Start 2P',monospace;font-size:14px;color:rgba(255,140,0,.6);letter-spacing:3px;padding:0 .5rem;}
        .h2h-headline{display:flex;align-items:center;gap:.75rem;flex-wrap:wrap;margin-left:auto;}
        .h2h-name-a{font-family:'Press Start 2P',monospace;font-size:12px;color:#87CEEB;text-shadow:0 0 10px rgba(135,206,235,.5);}
        .h2h-vs-txt{font-family:'VT323',monospace;font-size:20px;color:rgba(255,255,255,.3);}
        .h2h-name-b{font-family:'Press Start 2P',monospace;font-size:12px;color:#FFD700;text-shadow:0 0 10px rgba(255,215,0,.5);}
        .h2h-record{font-family:'VT323',monospace;font-size:22px;color:rgba(255,255,255,.5);margin-left:.5rem;letter-spacing:1px;}

        .sp-table-outer{width:100%;}
        .sp-table{width:max-content;min-width:100%;border-collapse:collapse;}
        .sp-gh{font-family:'Press Start 2P',monospace;font-size:10px;letter-spacing:3px;padding:.5rem .65rem .4rem;text-align:center;border-bottom:2px solid rgba(255,255,255,.1);}
        .sp-th{font-family:'Press Start 2P',monospace;font-size:11px;padding:.65rem .65rem;white-space:nowrap;position:sticky;top:0;z-index:10;border-bottom:2px solid rgba(255,255,255,.12);user-select:none;color:rgba(255,255,255,.5);transition:color .12s,background .12s,box-shadow .12s;}
        .sp-th.sortable{cursor:pointer;}
        .sp-th.sortable:hover{color:#FF8C00!important;}
        .sp-th.active{color:#FFD700!important;box-shadow:inset 0 -3px 0 rgba(255,215,0,.7);}
        .sort-icon{opacity:.5;font-size:10px;}
        .sp-th.active .sort-icon{opacity:1;}
        .sp-td.sorted{box-shadow:inset 2px 0 0 rgba(255,215,0,.18),inset -1px 0 0 rgba(255,215,0,.08);}
        .sp-even{background:rgba(0,0,22,.88);}
        .sp-odd {background:rgba(0,0,10,.92);}
        .sp-row{transition:background .1s;}
        .sp-row:hover td{background:rgba(255,130,0,0.14)!important;box-shadow:inset 0 1px 0 rgba(255,140,0,.25),inset 0 -1px 0 rgba(255,140,0,.25);}
        .sp-row:hover td:first-child{box-shadow:inset 4px 0 0 #FF8C00,inset 0 1px 0 rgba(255,140,0,.25),inset 0 -1px 0 rgba(255,140,0,.25);}
        .sp-row:hover .td-mgrname{color:#FF8C00!important;text-shadow:0 0 12px rgba(255,130,0,.6);}
        .sp-row:hover .td-rank{color:rgba(255,180,0,.65);}
        .sp-row:hover .td-val{color:rgba(255,255,255,.98);}
        .sp-td{font-family:'VT323',monospace;font-size:22px;color:rgba(255,255,255,.82);padding:.38rem .65rem;border-bottom:1px solid rgba(255,255,255,.04);white-space:nowrap;transition:background .1s,box-shadow .1s,color .1s;}

        .td-mgr{display:flex;align-items:center;gap:.45rem;min-width:165px;}
        .td-avatar{width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;border:1.5px solid rgba(255,255,255,.2);}
        .td-avatar-fb{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(135,206,235,.12);border:1.5px solid rgba(135,206,235,.28);font-family:'Press Start 2P',monospace;font-size:8px;color:#87CEEB;flex-shrink:0;}
        .td-mgr-names{display:flex;flex-direction:column;gap:1px;overflow:hidden;}
        .td-mgrname{font-family:'Press Start 2P',monospace;font-size:11px;color:rgba(255,255,255,.9);letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;transition:color .1s,text-shadow .1s;}
        .td-discord{font-family:'VT323',monospace;font-size:15px;color:rgba(114,137,218,.8);letter-spacing:.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;}
        .td-rank{font-family:'Press Start 2P',monospace;font-size:11px;color:rgba(255,255,255,.22);transition:color .1s;}
        .td-val{transition:color .1s;}
        .td-champ{font-size:16px;}
        .td-val.great{color:#FFD700;text-shadow:0 0 10px rgba(255,215,0,.5);}
        .td-val.pos{color:#00DD55;text-shadow:0 0 8px rgba(0,221,85,.4);}
        .td-val.neg{color:#FF5555;text-shadow:0 0 8px rgba(255,85,85,.3);}

        .sp-state{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;padding:5rem 2rem;max-width:1600px;margin:0 auto;}
        .sp-spinner{width:44px;height:44px;border-radius:50%;border:3px solid rgba(255,140,0,.15);border-top-color:#FF8C00;animation:spin .8s linear infinite;}
        @keyframes spin{to{transform:rotate(360deg);}}
        .sp-state-txt{font-family:'Press Start 2P',monospace;font-size:16px;color:rgba(255,255,255,.28);letter-spacing:3px;}
        .sp-state-sub{font-family:'VT323',monospace;font-size:20px;color:rgba(255,255,255,.2);text-align:center;max-width:520px;}
        .sp-placeholder{display:flex;flex-direction:column;align-items:center;gap:1.2rem;padding:5rem 2rem;max-width:1600px;margin:0 auto;}
        .sp-ph-title{font-family:'Press Start 2P',monospace;font-size:18px;color:rgba(255,255,255,.22);letter-spacing:4px;text-align:center;}
        .sp-ph-sub{font-family:'VT323',monospace;font-size:22px;color:rgba(255,255,255,.18);text-align:center;max-width:500px;}
        .sp-ph-sub code{background:rgba(255,255,255,.08);padding:.1rem .3rem;border-radius:3px;font-size:18px;}

        .leg-item{display:flex;align-items:center;gap:.4rem;font-family:'Press Start 2P',monospace;font-size:10px;color:rgba(255,255,255,.28);}
        .leg-sw{display:inline-block;width:16px;height:14px;border-radius:3px;flex-shrink:0;}
        .sp-legend-footer{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem 1.4rem;padding:.75rem 2rem;max-width:1600px;margin:0 auto;}
        .leg-note{font-family:'VT323',monospace;font-size:15px;color:rgba(255,255,255,.16);margin-left:auto;text-align:right;}

        @media(max-width:900px){
          .led-text{font-size:1.5rem;letter-spacing:4px;}
          .sp-tabs{padding:0 1.25rem;} .sp-tabs-line{left:1.25rem;right:1.25rem;}
          .sp-tab{font-size:12px;padding:.65rem 1.1rem;}
          .sp-filters{padding:.7rem 1.25rem;}
          .h2h-selectors{padding:.75rem 1.25rem;}
          .h2h-headline{margin-left:0;width:100%;}
        }
        @media(max-width:600px){
          .sp-tab{font-size:11px;padding:.6rem .9rem;}
          .sf-btn{font-size:11px;padding:.4rem .7rem;}
          .sp-td{font-size:20px;padding:.3rem .45rem;}
          .td-mgrname{font-size:10px;max-width:90px;}
          .td-discord{display:none;}
          .sf-count{display:none;}
          .sp-legend-inline{display:none;}
          .h2h-sel{min-width:150px;}
        }
      `}</style>
    </div>
  );
}
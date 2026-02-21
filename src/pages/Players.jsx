import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 40;

const STAT_DEFS = [
  { key: 'ovr',     label: 'OVR', desc: 'Overall'         },
  { key: 'wgt',     label: 'WGT', desc: 'Weight'          },
  { key: 'agl',     label: 'AGL', desc: 'Agility'         },
  { key: 'spd',     label: 'SPD', desc: 'Speed'           },
  { key: 'ofa',     label: 'OFA', desc: 'Offensive Aware' },
  { key: 'dfa',     label: 'DFA', desc: 'Defensive Aware' },
  { key: 'shp_pkc', label: 'SHP', desc: 'Shot Power'      },
  { key: 'chk',     label: 'CHK', desc: 'Checking'        },
  { key: 'sth',     label: 'STH', desc: 'Stick Handling'  },
  { key: 'sha',     label: 'SHA', desc: 'Shot Accuracy'   },
  { key: 'end_str', label: 'END', desc: 'Endurance'       },
  { key: 'rgh_stl', label: 'RGH', desc: 'Roughness'       },
  { key: 'pas_gvr', label: 'PAS', desc: 'Passing'         },
  { key: 'agr_gvl', label: 'AGR', desc: 'Aggression'      },
];

const STATS_ONLY = STAT_DEFS.filter(s => s.key !== 'ovr');

const handLabel = h => (h === '0' || h === 0) ? 'L' : (h === '1' || h === 1) ? 'R' : String(h);
const ovrClass  = o => o >= 80 ? 'ovr-elite' : o >= 65 ? 'ovr-good' : o >= 50 ? 'ovr-avg' : 'ovr-low';
const barClass  = p => p >= 80 ? 'bar-elite' : p >= 55 ? 'bar-good' : p >= 30 ? 'bar-avg' : 'bar-low';
const avg       = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

// ─── Sub-components ──────────────────────────────────────────────────────────

const Stars = ({ n, max = 5 }) => (
  <span className="stars">
    {Array.from({ length: max }).map((_, i) => (
      <span key={i} className={i < n ? 'star-on' : 'star-off'}>★</span>
    ))}
  </span>
);

const OvrBadge = ({ ovr }) => (
  <span className={`ovr-badge ${ovrClass(ovr)}`}>{ovr}</span>
);

const StatBar = ({ value, max = 9 }) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="sbar">
      <span className="sbar-val">{value}</span>
      <div className="sbar-bg"><div className={`sbar-fill ${barClass(pct)}`} style={{ width: `${pct}%` }} /></div>
    </div>
  );
};

const PosBadge = ({ pos }) => <span className={`pos-badge pos-${pos}`}>{pos}</span>;

// ─── Main ────────────────────────────────────────────────────────────────────

export default function Players() {
  const [tab, setTab]         = useState('scout');
  const [cmpView, setCmpView] = useState('side'); // 'side' | 'year'

  // ── Scout ──
  const [players, setPlayers]                 = useState([]);
  const [loading, setLoading]                 = useState(false);
  const [page, setPage]                       = useState(0);
  const [totalPages, setTotalPages]           = useState(0);
  const [expandedId, setExpandedId]           = useState(null);
  const [expandedSeasons, setExpandedSeasons] = useState([]);
  const [expandLoading, setExpandLoading]     = useState(false);

  const [search, setSearch]     = useState('');
  const [dsearch, setDsearch]   = useState('');
  const [posFilter, setPos]     = useState('');
  const [handFilter, setHand]   = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo]     = useState('');

  // ── Compare ──
  const [compareList, setCompareList]   = useState([]);
  const [compareSearch, setCmpSearch]   = useState('');
  const [compareResults, setCmpResults] = useState([]);
  const [cmpSearching, setCmpSearching] = useState(false);
  const [compareSeasons, setCmpSeasons] = useState({});

  const sTimer = useRef(null);
  const cTimer = useRef(null);

  // Player color palette
  const CMP_COLORS = [
    { main: '#00C8FF', bg: 'rgba(0,200,255,.08)',  border: 'rgba(0,200,255,.4)'  },
    { main: '#FF6B35', bg: 'rgba(255,107,53,.08)', border: 'rgba(255,107,53,.4)' },
    { main: '#A855F7', bg: 'rgba(168,85,247,.08)', border: 'rgba(168,85,247,.4)' },
    { main: '#10B981', bg: 'rgba(16,185,129,.08)', border: 'rgba(16,185,129,.4)' },
  ];

  // Debounce search
  useEffect(() => {
    clearTimeout(sTimer.current);
    sTimer.current = setTimeout(() => { setDsearch(search); setPage(0); }, 350);
  }, [search]);

  useEffect(() => { setPage(0); }, [posFilter, handFilter, yearFrom, yearTo]);

  useEffect(() => {
    const go = async () => {
      setLoading(true);
      const offset = page * PAGE_SIZE;
  
      // 1️⃣ fetch master list
      let { data: masterData, error: masterError } = await supabase
        .from('player_master')
        .select('player_master_id, player_name')
        .ilike('player_name', dsearch ? `%${dsearch}%` : '%') // search if any
        .order('player_name', { ascending: true });
  
      if (masterError) {
        console.error('Error fetching player_master:', masterError);
        setLoading(false);
        return;
      }
  
      const masterIds = masterData.map(p => p.player_master_id);
  
      // 2️⃣ fetch attributes for the filtered master ids
      let attrQuery = supabase
        .from('player_attributes_by_season')
        .select('player_master_id, year, pos, hand, ovr')
        .in('player_master_id', masterIds);
  
      if (posFilter)  attrQuery = attrQuery.eq('pos', posFilter);
      if (handFilter) attrQuery = attrQuery.eq('hand', handFilter);
      if (yearFrom)   attrQuery = attrQuery.gte('year', parseInt(yearFrom));
      if (yearTo)     attrQuery = attrQuery.lte('year', parseInt(yearTo));
  
      const { data: attrData, error: attrError } = await attrQuery;
  
      if (attrError) {
        console.error('Error fetching player_attributes_by_season:', attrError);
        setLoading(false);
        return;
      }
  
      // 3️⃣ merge master + latest attributes
      const grouped = {};
      for (const r of attrData) {
        if (!grouped[r.player_master_id]) grouped[r.player_master_id] = { ...masterData.find(m => m.player_master_id === r.player_master_id), allOvr: [] };
        grouped[r.player_master_id].allOvr.push(r.ovr);
        grouped[r.player_master_id].pos = r.pos;  // optional: latest overwrites
        grouped[r.player_master_id].hand = r.hand;
        grouped[r.player_master_id].year = r.year;
      }
  
      const unique = Object.values(grouped).map(p => ({ ...p, avgOvr: avg(p.allOvr) }));
  
      setTotalPages(Math.ceil(unique.length / PAGE_SIZE));
      setPlayers(unique.slice(offset, offset + PAGE_SIZE));
  
      setLoading(false);
    };
  
    go();
  }, [dsearch, posFilter, handFilter, yearFrom, yearTo, page]);
  

  // ── Expand seasons ──
  const handleExpand = async (player_master_id) => {
    if (expandedId === player_master_id) { setExpandedId(null); setExpandedSeasons([]); return; }
    setExpandedId(player_master_id);
    setExpandLoading(true);
    const { data } = await supabase
        .from('player_attributes_by_season')
        .select('*')
        .eq('player_master_id', player_master_id)
        .order('year', { ascending: true });

    setExpandedSeasons(data || []);
    setExpandLoading(false);
  };

  // ── Compare search ──
  useEffect(() => {
    clearTimeout(cTimer.current);
    if (!compareSearch.trim()) { 
      setCmpResults([]);
      return;
    }
  
    cTimer.current = setTimeout(async () => {
      setCmpSearching(true);
  
      const { data, error } = await supabase
  .from('player_attributes_by_season')
  .select(`
    player_master_id,
    ovr,
    pos,
    hand,
    player_name
  `)
  .ilike('player_name', `%${compareSearch}%`)
  .order('ovr', { ascending: false })
  .limit(80);

  
      if (error) console.error(error);
  
      // remove duplicates by player_master_id
      const seen = new Set(); 
      const unique = [];
      for (const r of (data || [])) {
        if (!seen.has(r.player_master_id)) { 
          seen.add(r.player_master_id); 
          unique.push(r); 
        }
      }
  
      setCmpResults(unique.slice(0, 10));
      setCmpSearching(false);
    }, 300);
  }, [compareSearch]);
  

  const addToCompare = async (player) => {
    if (compareList.find(p => p.player_master_id === player.player_master_id)) return;
    setCompareList(prev => [...prev, player]);
    setCmpSearch(''); setCmpResults([]);
    const { data } = await supabase.from('player_attributes_by_season')
            .select('*')
            .eq('player_master_id', player.player_master_id)
            .order('year', { ascending: true });
  
    setCmpSeasons(prev => ({ ...prev, [player.player_master_id]: data || [] }));
  };

  const removeFromCompare = (pid) => {
    setCompareList(prev => prev.filter(p => p.player_master_id !== player_master_id));
    setCmpSeasons(prev => { const n = { ...prev }; delete n[player_master_id]; return n; });

  };

  const addFromScout = async (e, player) => {
    e.stopPropagation();
    setTab('compare');
    await addToCompare(player);
  };

  const clearFilters = () => {
    setSearch(''); setDsearch(''); setPos(''); setHand(''); setYearFrom(''); setYearTo(''); setPage(0);
  };

  const hasFilters = dsearch || posFilter || handFilter || yearFrom || yearTo;

  // Shared compare helpers
  const allCmpYears = [...new Set(
    Object.values(compareSeasons).flat().map(s => s.year)
  )].sort((a, b) => a - b);

  const playerAvgOvr = (pid) => {
    const ss = compareSeasons[pid] || [];
    return ss.length ? avg(ss.map(s => s.ovr)) : 0;
  };

  // ─── SCOUT TAB ─────────────────────────────────────────────────────────────
  const ScoutTab = () => (
    <div>
      <div className="filter-panel">
        <div className="search-wrap">
          <span className="ico">🔍</span>
          <input className="search-inp" placeholder="SEARCH PLAYER NAME..."
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="clr-x" onClick={() => setSearch('')}>✕</button>}
        </div>
        <div className="filter-row">
          <div className="fg"><label>POS</label>
            <select className="f-sel" value={posFilter} onChange={e => setPos(e.target.value)}>
              <option value="">ALL</option><option>F</option><option>D</option><option>G</option>
            </select>
          </div>
          <div className="fg"><label>HAND</label>
            <select className="f-sel" value={handFilter} onChange={e => setHand(e.target.value)}>
              <option value="">ALL</option><option value="1">RIGHT</option><option value="0">LEFT</option>
            </select>
          </div>
          <div className="fg"><label>YR FROM</label>
            <input className="f-inp" type="number" placeholder="1917" value={yearFrom} onChange={e => setYearFrom(e.target.value)} />
          </div>
          <div className="fg"><label>YR TO</label>
            <input className="f-inp" type="number" placeholder="2025" value={yearTo} onChange={e => setYearTo(e.target.value)} />
          </div>
          {hasFilters && <button className="clear-btn" onClick={clearFilters}>✕ CLEAR</button>}
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /><div className="load-txt">SCANNING DATABASE...</div></div>
      ) : players.length === 0 ? (
        <div className="no-data"><div className="no-data-txt">NO PLAYERS FOUND</div></div>
      ) : (
        <div className="player-list">
          <div className="list-hdr">
            <div className="lh-name">PLAYER</div>
            <div className="lh-c">POS</div>
            <div className="lh-c">HAND</div>
            <div className="lh-c lh-ovr">AVG OVR</div>
            <div className="lh-c"></div>
          </div>

          {players.map((p, i) => {
            const isExp = expandedId === p.player_master_id;
            const inCmp = !!compareList.find(c => c.player_master_id === p.player_master_id);
            return (
              <div key={p.player_master_id} className={`p-entry ${i % 2 === 0 ? 'pe-even' : 'pe-odd'}`}>
                <div className={`p-row ${isExp ? 'p-row--open' : ''}`} onClick={() => handleExpand(p.player_master_id)}>
                  <div className="pr-name">
                    <span className="chevron">{isExp ? '▼' : '▶'}</span>
                    <span className="pr-name-txt">{p.player_name}</span>
                  </div>
                  <div className="pr-c"><PosBadge pos={p.pos} /></div>
                  <div className="pr-c pr-hand">{handLabel(p.hand)}</div>
                  <div className="pr-c"><OvrBadge ovr={p.avgOvr} /></div>
                  <div className="pr-c">
                    <button className={`cmp-btn ${inCmp ? 'cmp-btn--in' : ''}`}
                      disabled={compareList.length >= 4 || inCmp}
                      onClick={e => addFromScout(e, p)}>
                      {inCmp ? '✓' : '+ CMP'}
                    </button>
                  </div>
                </div>

                {isExp && (
                  <div className="seasons-panel">
                    {expandLoading ? (
                      <div className="exp-load">LOADING HISTORY...</div>
                    ) : (
                      <div className="seasons-scroll">
                        <div className="s-hdr">
                          <div className="sh-yr">YEAR</div>
                          <div className="sh-stars">STARS</div>
                          <div className="sh-ov">OVR</div>
                          {STATS_ONLY.map(s => <div key={s.key} className="sh-st" title={s.desc}>{s.label}</div>)}
                        </div>
                        {expandedSeasons.map((s, si) => {
                          const prev  = si > 0 ? expandedSeasons[si - 1].ovr : null;
                          const delta = prev !== null ? s.ovr - prev : null;
                          return (
                            <div key={s.year} className={`s-row ${si % 2 === 0 ? 'sr-even' : 'sr-odd'}`}>
                              <div className="sr-yr">
                                {s.year}
                                {delta !== null && (
                                  <span className={`delta ${delta > 0 ? 'd-up' : delta < 0 ? 'd-dn' : 'd-eq'}`}>
                                    {delta > 0 ? `+${delta}` : delta === 0 ? '—' : delta}
                                  </span>
                                )}
                              </div>
                              <div className="sr-stars"><Stars n={s.star_rating || 0} /></div>
                              <div className="sr-ov"><OvrBadge ovr={s.ovr} /></div>
                              {STATS_ONLY.map(sd => (
                                <div key={sd.key} className="sr-st"><StatBar value={s[sd.key] ?? 0} /></div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button className="pg" onClick={() => setPage(0)} disabled={page === 0}>«</button>
          <button className="pg" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹</button>
          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            let p = totalPages <= 7 ? i : page < 4 ? i : page > totalPages - 5 ? totalPages - 7 + i : page - 3 + i;
            return <button key={p} className={`pg${p === page ? ' pg--on' : ''}`} onClick={() => setPage(p)}>{p + 1}</button>;
          })}
          <button className="pg" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>›</button>
          <button className="pg" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>»</button>
        </div>
      )}
    </div>
  );

  // ─── COMPARE: SIDE-BY-SIDE VIEW ────────────────────────────────────────────
  // Split players into pairs. Each pair = its own table with player columns.
  const SideView = () => {
    const pairs = [];
    for (let i = 0; i < compareList.length; i += 2) pairs.push(compareList.slice(i, i + 2));

    return (
      <div className="cmp-body">
        {pairs.map((pairPlayers, pi) => {
          const pairIdx  = pairPlayers.map(p => compareList.findIndex(c => c.player_master_id === p.player_master_id));
          const pairYears = [...new Set(
            pairPlayers.flatMap(p => (compareSeasons[p.player_master_id] || []).map(s => s.year))
          )].sort((a, b) => a - b);

          return (
            <div key={pi} className="cmp-section">
              {pairs.length > 1 && (
                <div className="sec-pair-banner">
                  {pairPlayers.map((p, ii) => {
                    const ci = pairIdx[ii];
                    return (
                      <span key={p.player_master_id} style={{ color: CMP_COLORS[ci].main }}>
                        {ii > 0 && <span style={{ color: 'rgba(255,165,0,.3)', margin: '0 .5rem' }}>VS</span>}
                        {p.player_name}
                      </span>
                    );
                  })}
                </div>
              )}

              <div className="pair-table">
                {/* Column headers */}
                <div className="pair-hdrs" style={{ gridTemplateColumns: `56px repeat(${pairPlayers.length}, 1fr)` }}>
                  <div className="pair-yr-hd">YEAR</div>
                  {pairPlayers.map((p, ii) => {
                    const col = CMP_COLORS[pairIdx[ii]];
                    return (
                      <div key={p.player_master_id} className="pair-player-hd" style={{ borderBottomColor: col.main }}>
                        <button className="pair-rm" onClick={() => removeFromCompare(p.player_master_id)}>✕</button>
                        <div className="pair-player-name" style={{ color: col.main }}>{p.player_name}</div>
                        <div className="pair-player-meta">
                          <PosBadge pos={p.pos} />
                          <span className="pair-hand" style={{ color: col.main }}>{handLabel(p.hand)}</span>
                          <span className="pair-avg-lbl">AVG OVR:</span>
                          <OvrBadge ovr={playerAvgOvr(p.player_master_id)} />
                        </div>
                        <div className="pair-col-hdrs">
                          <span className="pch pch-stars">STARS</span>
                          <span className="pch pch-ovr">OVR</span>
                          {STATS_ONLY.map(s => <span key={s.key} className="pch" title={s.desc}>{s.label}</span>)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Data rows */}
                {pairYears.map((yr, ri) => {
                  const rowSeasons = pairPlayers.map(p =>
                    (compareSeasons[p.player_master_id] || []).find(s => s.year === yr) || null
                  );
                  if (!rowSeasons.some(Boolean)) return null;
                  const validOvrs = rowSeasons.filter(Boolean).map(s => s.ovr);
                  const maxOvr = Math.max(...validOvrs);

                  return (
                    <div key={yr} className={`pair-row ${ri % 2 === 0 ? 'pair-even' : 'pair-odd'}`}
                      style={{ gridTemplateColumns: `56px repeat(${pairPlayers.length}, 1fr)` }}>
                      <div className="pair-yr-cell">{yr}</div>
                      {pairPlayers.map((p, pi2) => {
                        const s   = rowSeasons[pi2];
                        const col = CMP_COLORS[pairIdx[pi2]];
                        if (!s) return (
                          <div key={p.player_master_id} className="pair-data-cell pair-absent"
                            style={{ borderLeftColor: col.border }}>
                            <span className="absent-dash">—</span>
                          </div>
                        );
                        const isBestOvr = s.ovr === maxOvr && validOvrs.length > 1;
                        return (
                          <div key={p.player_master_id} className="pair-data-cell"
                            style={{ borderLeftColor: col.border, background: isBestOvr ? col.bg : 'transparent' }}>
                            <div className="pair-cell-row">
                              <div className="pair-stars-cell"><Stars n={s.star_rating || 0} /></div>
                              <div className="pair-ovr-cell">
                                <OvrBadge ovr={s.ovr} />
                                {isBestOvr && <span className="best-crown" style={{ color: col.main }}>▲</span>}
                              </div>
                              {STATS_ONLY.map(sd => {
                                const myVal  = s[sd.key] ?? 0;
                                const others = rowSeasons.filter((_, i2) => i2 !== pi2 && rowSeasons[i2]).map(x => x[sd.key] ?? 0);
                                const wins   = others.length > 0 && others.every(o => myVal >= o) && myVal > 0;
                                return (
                                  <div key={sd.key} className={`pair-stat-cell ${wins ? 'stat-win' : ''}`}
                                    style={wins ? { color: col.main } : {}}>
                                    {myVal}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── COMPARE: YEAR-BY-YEAR BOX SCORE VIEW ─────────────────────────────────
  // Grouped by year. Each year = sticky banner + stat grid (rows = stats, cols = players).
  // Winner gets highlighted cell + advantage gap shown. Loser dims slightly.
  const YearView = () => {
    return (
      <div className="cmp-body">
        {allCmpYears.map((year) => {
          // Gather each player's season for this year
          const yearSeasons = compareList.map((p) =>
            (compareSeasons[p.player_master_id] || []).find((s) => s.year === year) || null
          );
  
          if (!yearSeasons.some(Boolean)) return null;
  
          return (
            <div key={year} className="yv-year-block">
              {/* Year Banner */}
              <div className="yv-year-banner">
                <span className="yv-year-num">{year}</span>
              </div>
  
              {/* Player table */}
              <div
                className="yv-player-table"
                style={{
                  display: "grid",
                  gridTemplateColumns: `200px repeat(${STAT_DEFS.length + 2}, 1fr)`,
                }}
              >
                {/* Header row */}
                <div className="yv-header">PLAYER</div>
                <div className="yv-header">STARS</div>
                <div className="yv-header">Avg OVR</div>
                {STAT_DEFS.map((s) => (
                  <div key={s.key} className="yv-header" title={s.desc}>
                    {s.label}
                  </div>
                ))}
  
               {/* Player rows */}
{compareList.map((p, pi) => {
  const s = yearSeasons[pi];
  const col = CMP_COLORS[pi];

  const avgOvr = playerAvgOvr(p.player_master_id); // your existing function
  const statVals = STAT_DEFS.map((sd) => (s ? s[sd.key] ?? 0 : null));
  
  return (
    <React.Fragment key={p.player_master_id}>
      {/* Player info */}
      <div className="yv-player-info" style={{ color: col.main }}>
        {p.player_name} <PosBadge pos={p.pos} /> {handLabel(p.hand)}
      </div>

      {/* Stars */}
      <div>
        {s ? <Stars n={s.star_rating || 0} /> : <span className="yv-absent-val">—</span>}
      </div>

      {/* Avg OVR column */}
      <div>
        {s ? <OvrBadge ovr={avgOvr} /> : <span className="yv-absent-val">—</span>}
      </div>

      {/* Stat columns */}
      {STAT_DEFS.map((sd, sdi) => {
        const val = s ? s[sd.key] ?? 0 : null;
        const isBest = val !== null && val === Math.max(...yearSeasons.filter(Boolean).map((x) => x[sd.key] ?? 0));
        return (
          <div
            key={sd.key}
            className={`yv-stat-val ${isBest ? "yv-val-win" : ""}`}
            style={{ borderLeftColor: col.border, background: isBest ? col.bg : "transparent" }}
          >
            {val === null ? (
              <span className="yv-absent-val">—</span>
            ) : (
              <div className="yv-val-inner">
                <span className="yv-num" style={{ color: isBest ? col.main : undefined }}>{val}</span>
                {sd.key !== "wgt" && (
                  <div className="yv-bar-bg">
                    <div
                      className="yv-bar-fill"
                      style={{
                        width: `${Math.min(100, Math.round((val / 9) * 100))}%`,
                        background: isBest ? col.main : "rgba(255,255,255,.15)",
                        boxShadow: isBest ? `0 0 6px ${col.border}` : "none",
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </React.Fragment>
  );
})}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  

  // ─── COMPARE TAB SHELL ─────────────────────────────────────────────────────
  const CompareTab = () => (
    <div className="cmp-wrap">
      {/* Search panel */}
      <div className="filter-panel" style={{ position: 'relative' }}>
        <div className="cmp-add-label">
          ADD PLAYERS TO COMPARE
          <span className="cmp-cnt-badge">{compareList.length} / 4</span>
          {compareList.length > 0 && (
            <div className="cmp-player-pills">
              {compareList.map((p, i) => (
                <span key={p.player_master_id} className="cmp-pill"
                  style={{ borderColor: CMP_COLORS[i].main, color: CMP_COLORS[i].main }}>
                  {p.player_name.split(' ').pop()}
                  <button className="cmp-pill-rm" onClick={() => removeFromCompare(p.player_master_id)}>✕</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="search-wrap">
          <span className="ico">🔍</span>
          <input className="search-inp" placeholder="SEARCH AND ADD A PLAYER..."
            value={compareSearch} onChange={e => setCmpSearch(e.target.value)}
            disabled={compareList.length >= 4} />
          {cmpSearching && <span className="cmp-searching">...</span>}
        </div>
        {compareResults.length > 0 && (
          <div className="cmp-drop">
            {compareResults.map(p => {
              const inList = !!compareList.find(c => c.player_master_id === p.player_master_id);
              return (
                <button key={p.player_master_id} className="cmp-res"
                  onClick={() => addToCompare(p)} disabled={inList || compareList.length >= 4}>
                  <span className="crd-name">{p.player_name}</span>
                  <span className="crd-meta"><PosBadge pos={p.pos} /><OvrBadge ovr={p.ovr} /></span>
                  <span className={inList ? 'crd-added' : 'crd-add'}>{inList ? '✓ ADDED' : '+ ADD'}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {compareList.length === 0 ? (
        <div className="cmp-empty">
          <div className="cmp-empty-ico">📋</div>
          <div className="cmp-empty-ttl">NO PLAYERS ADDED</div>
          <div className="cmp-empty-sub">Search above to add up to 4 players to compare</div>
        </div>
      ) : (
        <>
          {/* View mode toggle */}
          <div className="view-toggle-bar">
            <span className="view-toggle-label">VIEW</span>
            <div className="view-toggle-btns">
              <button className={`vtbtn ${cmpView === 'side' ? 'vtbtn--on' : ''}`}
                onClick={() => setCmpView('side')}>
                <span className="vtbtn-ico">▐▌</span> SIDE BY SIDE
              </button>
              <button className={`vtbtn ${cmpView === 'year' ? 'vtbtn--on' : ''}`}
                onClick={() => setCmpView('year')}>
                <span className="vtbtn-ico">≡</span> YEAR BY YEAR
              </button>
            </div>
            <span className="view-toggle-hint">
              {cmpView === 'side'
                ? 'Player columns · great for 2 players'
                : 'Year blocks · all players per stat · great for 3–4'}
            </span>
          </div>

          {cmpView === 'side' ? SideView() : YearView()}
        </>
      )}
    </div>
  );

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="players-page">
      <div className="scoreboard-header-container">
        <div className="scoreboard-header">
          <div className="led-text">PLAYER DATABASE</div>
        </div>
      </div>

      <div className="page-tabs">
        <button className={`ptab ${tab === 'scout' ? 'ptab--on' : ''}`} onClick={() => setTab('scout')}>🔭 SCOUT</button>
        <button className={`ptab ${tab === 'compare' ? 'ptab--on' : ''}`} onClick={() => setTab('compare')}>
          ⚖️ COMPARE {compareList.length > 0 && <span className="tab-pip">{compareList.length}</span>}
        </button>
      </div>

      {tab === 'scout' ? ScoutTab() : CompareTab()}

      <style>{`
        /* ══ PAGE ══════════════════════════════════════════════════════════════ */
        .players-page{padding:1rem 2rem 3rem;min-height:100vh;background:radial-gradient(ellipse at top,#0a0a15 0%,#000 100%)}

        /* ══ HEADER ════════════════════════════════════════════════════════════ */
        .scoreboard-header-container{display:flex;justify-content:center;margin-bottom:1rem}
        .scoreboard-header{background:#000;border:6px solid #333;border-radius:8px;padding:1rem 2rem;box-shadow:0 0 0 2px #000,inset 0 0 20px rgba(0,0,0,.8),0 8px 16px rgba(0,0,0,.5),0 0 40px rgba(255,215,0,.3);position:relative;overflow:hidden}
        .scoreboard-header::before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent 0,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px),repeating-linear-gradient(90deg,transparent 0,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px);pointer-events:none}
        .scoreboard-header::after{content:'';position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:linear-gradient(45deg,transparent 30%,rgba(255,215,0,.1) 50%,transparent 70%);animation:shimmer 3s infinite}
        @keyframes shimmer{0%{transform:translateX(-100%) translateY(-100%) rotate(45deg)}100%{transform:translateX(100%) translateY(100%) rotate(45deg)}}
        .led-text {
            font-family:'Press Start 2P',monospace; font-size:2rem; color:#FFD700; letter-spacing:6px;
            text-shadow:0 0 10px #FF8C00,0 0 20px #FF8C00,0 0 30px #FFD700;
            filter:contrast(1.3) brightness(1.2); position:relative;
          }

        /* ══ TABS ══════════════════════════════════════════════════════════════ */
        .page-tabs{display:flex;gap:.5rem;margin-bottom:1.25rem;border-bottom:2px solid rgba(255,165,0,.2);padding-bottom:.5rem}
        .ptab{display:flex;align-items:center;gap:.5rem;padding:.7rem 1.5rem;background:transparent;border:2px solid rgba(255,165,0,.2);border-radius:10px 10px 0 0;color:rgba(255,165,0,.45);font-family:'Press Start 2P',monospace;font-size:.6rem;letter-spacing:2px;cursor:pointer;transition:all .2s}
        .ptab:hover{color:rgba(255,165,0,.8);border-color:rgba(255,165,0,.5);background:rgba(255,165,0,.05)}
        .ptab--on{color:#FFD700;border-color:#FFD700;background:rgba(255,215,0,.08);border-bottom-color:transparent;text-shadow:0 0 10px rgba(255,215,0,.5)}
        .tab-pip{background:#FFD700;color:#000;border-radius:10px;padding:.1rem .4rem;font-size:.5rem;margin-left:.25rem;font-weight:bold}

        /* ══ FILTERS ═══════════════════════════════════════════════════════════ */
        .filter-panel{background:linear-gradient(180deg,#0d0d1a,#080812);border:2px solid rgba(255,165,0,.2);border-radius:12px;padding:1.1rem 1.4rem;margin-bottom:1rem}
        .search-wrap{display:flex;align-items:center;gap:.75rem;background:rgba(0,0,0,.6);border:2px solid rgba(135,206,235,.22);border-radius:10px;padding:.65rem 1rem;transition:border-color .2s;margin-bottom:.85rem}
        .search-wrap:focus-within{border-color:rgba(255,215,0,.6);box-shadow:0 0 18px rgba(255,215,0,.1)}
        .ico{font-size:1rem;opacity:.4;flex-shrink:0}
        .search-inp{flex:1;background:transparent;border:none;outline:none;font-family:'VT323',monospace;font-size:1.4rem;color:#FFD700;letter-spacing:2px}
        .search-inp::placeholder{color:rgba(255,215,0,.2)}
        .search-inp:disabled{opacity:.3;cursor:not-allowed}
        .clr-x{background:none;border:none;color:rgba(255,255,255,.3);cursor:pointer;font-size:1rem;padding:0 .2rem;transition:color .2s}
        .clr-x:hover{color:#FF3C3C}
        .filter-row{display:flex;flex-wrap:wrap;gap:.65rem;align-items:flex-end}
        .fg{display:flex;flex-direction:column;gap:.3rem}
        .fg label{font-family:'Press Start 2P',monospace;font-size:.45rem;color:rgba(255,165,0,.5);letter-spacing:2px}
        .f-sel,.f-inp{background:linear-gradient(180deg,#1a1a2e,#0a0a15);color:#87CEEB;border:2px solid rgba(135,206,235,.28);padding:.5rem .7rem;font-family:'VT323',monospace;font-size:1.15rem;cursor:pointer;border-radius:7px;transition:all .2s;letter-spacing:1px;outline:none}
        .f-inp{width:85px}
        .f-sel:hover,.f-inp:hover,.f-sel:focus,.f-inp:focus{border-color:rgba(255,215,0,.55);color:#FFD700}
        .f-inp::placeholder{color:rgba(135,206,235,.22)}
        .clear-btn{background:rgba(255,60,60,.1);border:2px solid rgba(255,60,60,.32);color:#FF6B6B;border-radius:7px;padding:.5rem .85rem;font-family:'Press Start 2P',monospace;font-size:.45rem;letter-spacing:1px;cursor:pointer;transition:all .2s;align-self:flex-end}
        .clear-btn:hover{background:rgba(255,60,60,.2);border-color:#FF3C3C}

        /* ══ SCOUT LIST ════════════════════════════════════════════════════════ */
        .player-list{border:2px solid rgba(255,165,0,.15);border-radius:12px;overflow:hidden;margin-bottom:1.25rem}
        .list-hdr{display:grid;grid-template-columns:1fr 70px 70px 90px 90px;background:linear-gradient(180deg,#1a0f00,#110900);border-bottom:2px solid rgba(255,165,0,.35);padding:.65rem 1.25rem}
        .lh-name,.lh-c{font-family:'Press Start 2P',monospace;font-size:.6rem;color:rgba(255,165,0,.85);letter-spacing:1px;display:flex;align-items:center;justify-content:center}
        .lh-name{justify-content:flex-start}
        .lh-ovr{color:#FFD700}
        .p-entry{border-bottom:1px solid rgba(255,165,0,.07)}
        .p-entry:last-child{border-bottom:none}
        .pe-even{background:rgba(10,10,20,.95)}
        .pe-odd{background:rgba(6,6,14,.95)}
        .p-row{display:grid;grid-template-columns:1fr 70px 70px 90px 90px;padding:.65rem 1.25rem;cursor:pointer;transition:background .12s;align-items:center}
        .p-row:hover{background:rgba(255,165,0,.07)!important}
        .p-row--open{background:rgba(255,215,0,.05)!important;border-bottom:1px solid rgba(255,215,0,.12)}
        .pr-name{display:flex;align-items:center;gap:.5rem}
        .chevron{font-size:.5rem;color:rgba(255,165,0,.35);transition:color .15s;flex-shrink:0;width:10px}
        .p-row:hover .chevron,.p-row--open .chevron{color:rgba(255,165,0,.9)}
        .pr-name-txt{font-family:'VT323',monospace;font-size:1.35rem;color:#E8E8E8;letter-spacing:.5px}
        .pr-c{display:flex;align-items:center;justify-content:center}
        .pr-hand{font-family:'Press Start 2P',monospace;font-size:.55rem;color:rgba(255,255,255,.5);letter-spacing:1px}
        .cmp-btn{background:rgba(255,215,0,.07);border:1px solid rgba(255,215,0,.28);color:rgba(255,215,0,.65);font-family:'Press Start 2P',monospace;font-size:.38rem;letter-spacing:1px;padding:.28rem .5rem;border-radius:5px;cursor:pointer;transition:all .2s;white-space:nowrap}
        .cmp-btn:hover:not(:disabled){background:rgba(255,215,0,.18);border-color:#FFD700;color:#FFD700}
        .cmp-btn--in,.cmp-btn:disabled{opacity:.4;cursor:not-allowed}
        .cmp-btn--in{opacity:1!important;background:rgba(0,255,100,.08);border-color:rgba(0,255,100,.3);color:rgba(0,255,100,.7)}

        /* ══ EXPANDED SEASONS ══════════════════════════════════════════════════ */
        .seasons-panel{background:rgba(0,0,0,.55);border-top:1px solid rgba(255,215,0,.1);animation:expIn .18s ease;overflow-x:auto}
        @keyframes expIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        .exp-load{font-family:'Press Start 2P',monospace;font-size:.48rem;color:rgba(255,165,0,.35);padding:1.5rem;text-align:center;letter-spacing:2px}
        .seasons-scroll{min-width:920px}
        .s-hdr,.s-row{display:grid;grid-template-columns:80px 95px 72px repeat(13,1fr);align-items:center;padding:.5rem 1rem}
        .s-hdr{background:linear-gradient(180deg,#120c00,#0a0800);border-bottom:2px solid rgba(255,165,0,.25);position:sticky;top:0}
        .sh-yr,.sh-st,.sh-ov,.sh-stars{font-family:'Press Start 2P',monospace;font-size:.52rem;color:rgba(255,165,0,.75);letter-spacing:1px;text-align:center}
        .sh-yr{text-align:left;font-size:.55rem;color:rgba(255,165,0,.9)}
        .sh-ov{color:#FFD700;font-size:.55rem}
        .sr-even{background:rgba(255,165,0,.02)}
        .sr-odd{background:rgba(0,0,0,.18)}
        .s-row:hover{background:rgba(255,165,0,.06)!important}
        .sr-yr{font-family:'Press Start 2P',monospace;font-size:.65rem;color:rgba(255,255,255,.75);display:flex;align-items:center;gap:.45rem}
        .sr-stars,.sr-ov,.sr-st{display:flex;justify-content:center;align-items:center}
        .delta{font-family:'Press Start 2P',monospace;font-size:.42rem;padding:.08rem .28rem;border-radius:3px}
        .d-up{color:#00FF64;background:rgba(0,255,100,.1)}
        .d-dn{color:#FF3C3C;background:rgba(255,60,60,.1)}
        .d-eq{color:rgba(255,255,255,.2)}

        /* ══ STAT BARS ═════════════════════════════════════════════════════════ */
        .sbar{display:flex;align-items:center;gap:.25rem;min-width:34px}
        .sbar-val{font-family:'VT323',monospace;font-size:1.2rem;color:rgba(255,255,255,.7);width:13px;text-align:right;flex-shrink:0}
        .sbar-bg{flex:1;height:6px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden}
        .sbar-fill{height:100%;border-radius:3px;transition:width .3s}
        .bar-elite{background:linear-gradient(90deg,#00FF64,#00C864);box-shadow:0 0 5px rgba(0,255,100,.4)}
        .bar-good{background:linear-gradient(90deg,#FFD700,#FFA500);box-shadow:0 0 4px rgba(255,215,0,.35)}
        .bar-avg{background:linear-gradient(90deg,#87CEEB,#4682B4)}
        .bar-low{background:rgba(255,255,255,.18)}
        
        /* ══ BADGES ════════════════════════════════════════════════════════════ */
        .ovr-badge{display:inline-block;font-family:'Press Start 2P',monospace;font-size:.62rem;padding:.22rem .48rem;border-radius:5px;letter-spacing:1px}
        .ovr-elite{background:rgba(0,255,100,.12);border:2px solid rgba(0,255,100,.5);color:#00FF64;text-shadow:0 0 8px rgba(0,255,100,.6)}
        .ovr-good{background:rgba(255,215,0,.12);border:2px solid rgba(255,215,0,.5);color:#FFD700}
        .ovr-avg{background:rgba(135,206,235,.1);border:2px solid rgba(135,206,235,.28);color:#87CEEB}
        .ovr-low{background:rgba(255,255,255,.05);border:2px solid rgba(255,255,255,.12);color:rgba(255,255,255,.35)}
        .pos-badge{font-family:'Press Start 2P',monospace;font-size:.42rem;border-radius:4px;padding:.16rem .38rem;letter-spacing:1px}
        .pos-F{background:rgba(0,200,100,.12);border:1px solid rgba(0,200,100,.4);color:#00C864}
        .pos-D{background:rgba(135,206,235,.12);border:1px solid rgba(135,206,235,.4);color:#87CEEB}
        .pos-G{background:rgba(255,165,0,.12);border:1px solid rgba(255,165,0,.4);color:#FFA500}
        .stars{display:inline-flex;gap:.08rem}
        .star-on{color:#FFD700;font-size:1rem;text-shadow:0 0 5px rgba(255,215,0,.6)}
        .star-off{color:rgba(255,255,255,.1);font-size:1rem}

        /* ══ PAGINATION ════════════════════════════════════════════════════════ */
        .pagination{display:flex;justify-content:center;gap:.4rem;margin-bottom:2rem;flex-wrap:wrap;padding-top:1rem}
        .pg{background:linear-gradient(180deg,#1a1a2e,#0a0a15);color:#87CEEB;border:2px solid rgba(135,206,235,.22);padding:.5rem .7rem;font-family:'Press Start 2P',monospace;font-size:.48rem;cursor:pointer;border-radius:6px;transition:all .2s;min-width:34px}
        .pg:hover:not(:disabled){border-color:rgba(255,215,0,.6);color:#FFD700;transform:translateY(-1px)}
        .pg:disabled{opacity:.2;cursor:not-allowed}
        .pg--on{background:linear-gradient(180deg,#2a1800,#1a0f00)!important;border-color:#FFD700!important;color:#FFD700!important;box-shadow:0 0 10px rgba(255,215,0,.28)!important}

        /* ══ LOADING ═══════════════════════════════════════════════════════════ */
        .loading-screen{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:350px;gap:2rem}
        .spinner{width:55px;height:55px;border:5px solid rgba(255,215,0,.15);border-top:5px solid #FFD700;border-radius:50%;animation:spin 1s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .load-txt{font-family:'Press Start 2P',monospace;font-size:.8rem;color:#87CEEB;animation:blink 1.5s ease-in-out infinite;letter-spacing:3px}
        @keyframes blink{0%,100%{opacity:.4}50%{opacity:1}}
        .no-data{display:flex;justify-content:center;align-items:center;min-height:280px}
        .no-data-txt{font-family:'Press Start 2P',monospace;font-size:.85rem;color:rgba(255,215,0,.3);letter-spacing:3px}

        /* ══ COMPARE SHELL ══════════════════════════════════════════════════════ */
        .cmp-wrap{display:flex;flex-direction:column;gap:1.25rem}
        .cmp-body{display:flex;flex-direction:column;gap:1.25rem}
        .cmp-add-label{font-family:'Press Start 2P',monospace;font-size:.55rem;color:rgba(255,165,0,.55);letter-spacing:2px;margin-bottom:.85rem;display:flex;align-items:center;gap:.75rem;flex-wrap:wrap}
        .cmp-cnt-badge{background:rgba(255,215,0,.14);border:1px solid rgba(255,215,0,.38);color:#FFD700;font-size:.48rem;padding:.1rem .4rem;border-radius:4px}
        .cmp-player-pills{display:flex;gap:.4rem;flex-wrap:wrap}
        .cmp-pill{font-family:'Press Start 2P',monospace;font-size:.4rem;border:1px solid;border-radius:12px;padding:.2rem .5rem;display:flex;align-items:center;gap:.35rem;letter-spacing:1px}
        .cmp-pill-rm{background:none;border:none;cursor:pointer;opacity:.5;font-size:.6rem;padding:0;line-height:1;transition:opacity .15s}
        .cmp-pill-rm:hover{opacity:1}
        .cmp-searching{font-family:'VT323',monospace;font-size:1.2rem;color:rgba(255,165,0,.5);animation:blink 1s ease-in-out infinite}
        .cmp-drop{position:absolute;top:calc(100% + 4px);left:0;right:0;z-index:200;background:linear-gradient(180deg,#1a1a2e,#08080f);border:2px solid rgba(255,165,0,.4);border-radius:10px;box-shadow:0 12px 40px rgba(0,0,0,.9);overflow:hidden;animation:dropIn .15s ease}
        @keyframes dropIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        .cmp-res{width:100%;display:flex;align-items:center;justify-content:space-between;padding:.72rem 1rem;background:transparent;border:none;border-bottom:1px solid rgba(255,165,0,.08);cursor:pointer;transition:background .15s;text-align:left;gap:1rem}
        .cmp-res:last-child{border-bottom:none}
        .cmp-res:hover:not(:disabled){background:rgba(255,165,0,.07)}
        .cmp-res:disabled{opacity:.38;cursor:not-allowed}
        .crd-name{font-family:'VT323',monospace;font-size:1.25rem;color:#E8E8E8;flex:1}
        .crd-meta{display:flex;align-items:center;gap:.5rem}
        .crd-add{font-family:'Press Start 2P',monospace;font-size:.42rem;color:#FFD700;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.3);border-radius:4px;padding:.15rem .4rem}
        .crd-added{font-family:'Press Start 2P',monospace;font-size:.42rem;color:#00FF64}
        .cmp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:280px;gap:1rem}
        .cmp-empty-ico{font-size:3rem;opacity:.25}
        .cmp-empty-ttl{font-family:'Press Start 2P',monospace;font-size:.72rem;color:rgba(255,165,0,.28);letter-spacing:3px}
        .cmp-empty-sub{font-family:'VT323',monospace;font-size:1.1rem;color:rgba(255,255,255,.2)}

        /* ══ VIEW TOGGLE ═══════════════════════════════════════════════════════ */
        .view-toggle-bar{display:flex;align-items:center;gap:1rem;flex-wrap:wrap;background:linear-gradient(180deg,#0f0f1e,#08080f);border:2px solid rgba(255,165,0,.2);border-radius:12px;padding:.85rem 1.25rem}
        .view-toggle-label{font-family:'Press Start 2P',monospace;font-size:.48rem;color:rgba(255,165,0,.45);letter-spacing:2px;white-space:nowrap}
        .view-toggle-btns{display:flex;gap:.5rem}
        .vtbtn{display:flex;align-items:center;gap:.45rem;padding:.6rem 1.1rem;background:rgba(0,0,0,.4);border:2px solid rgba(255,165,0,.2);border-radius:8px;color:rgba(255,165,0,.45);font-family:'Press Start 2P',monospace;font-size:.5rem;letter-spacing:1px;cursor:pointer;transition:all .22s;white-space:nowrap}
        .vtbtn:hover{color:rgba(255,165,0,.85);border-color:rgba(255,165,0,.55);background:rgba(255,165,0,.06)}
        .vtbtn--on{color:#FFD700;border-color:#FFD700;background:rgba(255,215,0,.1);text-shadow:0 0 8px rgba(255,215,0,.4);box-shadow:0 0 14px rgba(255,215,0,.12)}
        .vtbtn-ico{font-size:.8rem;letter-spacing:0}
        .view-toggle-hint{font-family:'VT323',monospace;font-size:1rem;color:rgba(255,255,255,.22);flex:1;text-align:right}

        /* ══ COMPARE SECTION ═══════════════════════════════════════════════════ */
        .cmp-section{background:linear-gradient(180deg,#0a0a18,#060610);border:2px solid rgba(255,165,0,.16);border-radius:14px;padding:1.25rem 1.5rem;overflow-x:auto}
        .sec-pair-banner{font-family:'Press Start 2P',monospace;font-size:.58rem;letter-spacing:1px;margin-bottom:.9rem;padding-bottom:.7rem;border-bottom:1px solid rgba(255,165,0,.14)}

        /* ══ SIDE VIEW ═════════════════════════════════════════════════════════ */
        .pair-table{min-width:680px}
        .pair-hdrs{display:grid;border-bottom:2px solid rgba(255,165,0,.2)}
        .pair-yr-hd{font-family:'Press Start 2P',monospace;font-size:.48rem;color:rgba(255,165,0,.45);padding:.5rem .35rem;display:flex;align-items:flex-end}
        .pair-player-hd{padding:.75rem 1rem;position:relative;border-bottom:3px solid;background:rgba(255,255,255,.02)}
        .pair-rm{position:absolute;top:.45rem;right:.45rem;background:rgba(255,60,60,.1);border:1px solid rgba(255,60,60,.28);color:#FF6B6B;border-radius:4px;width:20px;height:20px;cursor:pointer;font-size:.6rem;display:flex;align-items:center;justify-content:center;transition:all .2s}
        .pair-rm:hover{background:rgba(255,60,60,.25)}
        .pair-player-name{font-family:'Press Start 2P',monospace;font-size:.72rem;letter-spacing:1px;margin-bottom:.45rem;padding-right:1.5rem;line-height:1.5}
        .pair-player-meta{display:flex;align-items:center;gap:.5rem;margin-bottom:.55rem;flex-wrap:wrap}
        .pair-hand{font-family:'Press Start 2P',monospace;font-size:.42rem}
        .pair-avg-lbl{font-family:'Press Start 2P',monospace;font-size:.42rem;color:rgba(255,165,0,.5)}
        .pair-col-hdrs{display:flex;border-top:1px solid rgba(255,165,0,.15);padding-top:.45rem;gap:0}
        .pch{font-family:'Press Start 2P',monospace;font-size:.43rem;color:rgba(255,165,0,.65);flex:1;text-align:center;min-width:22px;letter-spacing:.5px}
        .pch-stars{flex:0 0 66px}
        .pch-ovr{flex:0 0 60px;color:#FFD700;font-size:.47rem}
        .pair-row{display:grid;border-bottom:1px solid rgba(255,165,0,.07);transition:filter .1s}
        .pair-row:hover{filter:brightness(1.1)}
        .pair-even{background:rgba(10,10,20,.85)}
        .pair-odd{background:rgba(5,5,12,.85)}
        .pair-yr-cell{font-family:'Press Start 2P',monospace;font-size:.5rem;color:rgba(255,255,255,.52);padding:.5rem .35rem;display:flex;align-items:center}
        .pair-data-cell{border-left:2px solid transparent;padding:.42rem .55rem;transition:background .15s}
        .pair-absent{display:flex;align-items:center;justify-content:center}
        .absent-dash{font-family:'VT323',monospace;font-size:1.4rem;color:rgba(255,255,255,.1)}
        .pair-cell-row{display:flex;align-items:center;gap:0}
        .pair-stars-cell{flex:0 0 66px;display:flex;align-items:center}
        .pair-ovr-cell{flex:0 0 60px;display:flex;align-items:center;gap:.28rem}
        .best-crown{font-size:.58rem;text-shadow:0 0 6px currentColor}
        .pair-stat-cell{flex:1;font-family:'VT323',monospace;font-size:1.3rem;color:rgba(255,255,255,.5);text-align:center;min-width:22px}
        .stat-win{font-size:1.45rem;font-weight:bold}

        /* ══ YEAR-BY-YEAR VIEW ══════════════════════════════════════════════════ */
        .yv-legend{display:flex;flex-wrap:wrap;gap:.75rem;margin-bottom:1.5rem}
        .yv-legend-item{display:flex;align-items:center;gap:.75rem;border:2px solid;border-radius:10px;padding:.65rem 1rem;flex:1;min-width:200px}
        .yv-legend-swatch{width:6px;border-radius:3px;align-self:stretch;flex-shrink:0}
        .yv-legend-info{flex:1}
        .yv-legend-name{font-family:'Press Start 2P',monospace;font-size:.62rem;letter-spacing:1px;margin-bottom:.38rem;line-height:1.5}
        .yv-legend-meta{display:flex;align-items:center;gap:.45rem;flex-wrap:wrap}
        .yv-legend-hand{font-family:'Press Start 2P',monospace;font-size:.4rem}
        .yv-legend-avg{font-family:'Press Start 2P',monospace;font-size:.4rem;color:rgba(255,165,0,.5);display:flex;align-items:center;gap:.3rem}
        .yv-rm{background:rgba(255,60,60,.1);border:1px solid rgba(255,60,60,.28);color:#FF6B6B;border-radius:4px;width:22px;height:22px;cursor:pointer;font-size:.65rem;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}
        .yv-rm:hover{background:rgba(255,60,60,.28)}

        /* Year block */
        .yv-year-block{margin-bottom:2rem}
        .yv-year-block:last-child{margin-bottom:0}

        /* Sticky year banner */
        .yv-year-banner{display:flex;align-items:center;gap:1rem;background:linear-gradient(180deg,#1c1000,#100900);border:2px solid rgba(255,165,0,.4);border-radius:10px 10px 0 0;padding:.75rem 1.1rem;flex-wrap:wrap;position:sticky;top:0;z-index:10;box-shadow:0 4px 16px rgba(0,0,0,.6)}
        .yv-year-num{font-family:'Press Start 2P',monospace;font-size:.95rem;color:#FFD700;text-shadow:0 0 10px rgba(255,215,0,.5);flex-shrink:0;min-width:52px}
        .yv-year-ovrs{display:flex;gap:.55rem;flex-wrap:wrap;align-items:center}
        .yv-yr-chip{display:flex;align-items:center;gap:.4rem;border:2px solid;border-radius:7px;padding:.3rem .65rem;transition:all .18s}
        .yv-chip-best{box-shadow:0 0 12px rgba(255,215,0,.18)}
        .yv-chip-name{font-family:'Press Start 2P',monospace;font-size:.44rem;letter-spacing:1px}
        .yv-chip-crown{font-size:.62rem;text-shadow:0 0 8px currentColor}
        .yv-yr-absent{display:flex;align-items:center;gap:.3rem;opacity:.3;padding:.3rem .5rem}
        .yv-absent-name{font-family:'Press Start 2P',monospace;font-size:.4rem}
        .yv-yr-dash{font-family:'VT323',monospace;font-size:1.2rem}

        /* Stat grid */
        .yv-stat-table{border:1px solid rgba(255,165,0,.18);border-top:none;border-radius:0 0 10px 10px;overflow:hidden}
        .yv-stat-hdr{display:grid;background:linear-gradient(180deg,#130a00,#0a0500);padding:.45rem .75rem;border-bottom:1px solid rgba(255,165,0,.2)}
        .yv-sh-label{font-family:'Press Start 2P',monospace;font-size:.45rem;color:rgba(255,165,0,.6);letter-spacing:1px;display:flex;align-items:center}
        .yv-sh-player{font-family:'Press Start 2P',monospace;font-size:.5rem;letter-spacing:1px;text-align:center;padding:.08rem .2rem}
        .yv-stat-row{display:grid;border-bottom:1px solid rgba(255,165,0,.06);transition:filter .1s}
        .yv-stat-row:last-child{border-bottom:none}
        .yv-stat-row:hover{filter:brightness(1.1)}
        .yv-row-even{background:rgba(10,10,20,.8)}
        .yv-row-odd{background:rgba(4,4,10,.8)}
        .yv-stars-row{background:rgba(20,15,0,.7)!important}
        .yv-stat-name{display:flex;flex-direction:column;justify-content:center;padding:.5rem .75rem;gap:.12rem;border-right:1px solid rgba(255,165,0,.08)}
        .yv-stat-lbl{font-family:'Press Start 2P',monospace;font-size:.5rem;color:rgba(255,165,0,.85);letter-spacing:1px}
        .yv-stat-desc{font-family:'VT323',monospace;font-size:.88rem;color:rgba(255,255,255,.28)}
        .yv-stat-val{display:flex;align-items:center;justify-content:center;border-left:2px solid transparent;padding:.42rem .45rem;transition:background .15s}
        .yv-absent-val{font-family:'VT323',monospace;font-size:1.3rem;color:rgba(255,255,255,.1)}
        .yv-val-inner{display:flex;flex-direction:column;align-items:center;gap:.15rem;width:100%}
        .yv-num{font-family:'VT323',monospace;font-size:1.55rem;font-weight:bold;line-height:1;color:rgba(255,255,255,.65)}
        .yv-val-win .yv-num{font-size:1.75rem;color:inherit}
        .yv-val-low .yv-num{color:rgba(255,255,255,.28)!important;font-size:1.3rem}
        .yv-gap{font-family:'Press Start 2P',monospace;font-size:.38rem;letter-spacing:.5px;line-height:1;opacity:.9}
        .yv-bar-bg{width:88%;height:5px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden}
        .yv-bar-fill{height:100%;border-radius:3px;transition:width .35s}

        /* ══ RESPONSIVE ════════════════════════════════════════════════════════ */
        @media(max-width:900px){
          .players-page{padding:.75rem}
          .led-text{font-size:1.2rem;letter-spacing:3px}
          .list-hdr,.p-row{grid-template-columns:1fr 60px 60px 80px 80px}
          .yv-legend-item{min-width:160px}
        }
        @media(max-width:600px){
          .list-hdr,.p-row{grid-template-columns:1fr 55px 55px 75px}
          .lh-c:last-child,.pr-c:last-child{display:none}
          .ptab{padding:.6rem .9rem;font-size:.5rem}
          .vtbtn{font-size:.42rem;padding:.5rem .75rem}
          .view-toggle-hint{display:none}
        }
      `}</style>
    </div>
  );
}
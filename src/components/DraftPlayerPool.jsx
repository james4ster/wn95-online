import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';

// All 13 attributes shown as columns in the main list
const ALL_STATS = [
  { key: 'wgt', label: 'WGT' },
  { key: 'agl', label: 'AGL' },
  { key: 'spd', label: 'SPD' },
  { key: 'ofa', label: 'OFA' },
  { key: 'dfa', label: 'DFA' },
  { key: 'shp_pkc', label: 'SHP' },
  { key: 'chk', label: 'CHK' },
  { key: 'sth', label: 'STH' },
  { key: 'sha', label: 'SHA' },
  { key: 'end_str', label: 'END' },
  { key: 'rgh_stl', label: 'RGH' },
  { key: 'pas_gvr', label: 'PAS' },
  { key: 'agr_gvl', label: 'AGR' },
];

const OVR_TIER = (v) => {
  if (v >= 80)
    return { color: '#FFD700', glow: 'rgba(255,215,0,.4)', label: 'ELITE' };
  if (v >= 65)
    return { color: '#00E676', glow: 'rgba(0,230,118,.35)', label: 'SOLID' };
  if (v >= 50)
    return { color: '#40C4FF', glow: 'rgba(64,196,255,.3)', label: 'AVG' };
  return { color: '#90A4AE', glow: 'rgba(144,164,174,.2)', label: 'DEPTH' };
};

const PC = { F: '#FF8C00', D: '#40C4FF', G: '#FFD700' };
const sc = (v) =>
  v >= 7
    ? '#FFD700'
    : v >= 5
    ? '#40C4FF'
    : v >= 3
    ? 'rgba(255,255,255,.72)'
    : 'rgba(255,255,255,.3)';

// Grid: OVR(44) POS(28) PLAYER(180px) then 13 stats each 1fr, then +CMP(40px)
const GRID = `44px 28px 180px repeat(13, 1fr) 40px`;

// ─── COMPARE POPUP ────────────────────────────────────────────────────────────
// Layout: sticky left col = stat label
//         column groups by YEAR, each group has OVR + 13 stats = 14 rows per year
//         years go left to right as columns
function ComparePopup({
  players,
  allYearsMap,
  rosters,
  draftYear,
  onClose,
  onRemove,
}) {
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (players.length === 0) return null;

  // Collect all years across all players from draftYear onward, sorted
  const yearSet = new Set();
  players.forEach((p) => {
    (allYearsMap[p.player_master_id] ?? []).forEach((r) => {
      if (r.year >= draftYear) yearSet.add(r.year);
    });
  });
  const years = [...yearSet].sort((a, b) => a - b);

  // For each player, build a year->row lookup
  const byYearByPlayer = {};
  players.forEach((p) => {
    byYearByPlayer[p.player_master_id] = {};
    (allYearsMap[p.player_master_id] ?? []).forEach((r) => {
      byYearByPlayer[p.player_master_id][r.year] = r;
    });
  });

  // Rows to display: OVR + all 13 stats
  const ROWS = [
    { key: 'ovr', label: 'OVR', isOvr: true },
    ...ALL_STATS.map((s) => ({ ...s, isOvr: false })),
  ];

  return (
    <div
      className="cmp-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="cmp-popup">
        {/* Header bar */}
        <div className="cmp-popup-hdr">
          <div className="cmp-popup-title">COMPARE PLAYERS</div>
          <div className="cmp-popup-sub">
            {players.length} PLAYERS · SEASONS {draftYear}–
            {years[years.length - 1] ?? draftYear}
          </div>
          <button className="cmp-popup-close" onClick={onClose}>
            ✕ CLOSE
          </button>
        </div>

        {/* Player identity cards — one per player, full width split */}
        <div
          className="cmp-ident-row"
          style={{ gridTemplateColumns: `repeat(${players.length}, 1fr)` }}
        >
          {players.map((p) => {
            const tier = OVR_TIER(p.ovr ?? 0);
            const posClr = PC[p.pos] || '#aaa';
            const drafted = rosters[p.player_master_id];
            return (
              <div
                key={p.player_master_id}
                className="cmp-ident-card"
                style={{ '--tier': tier.color, '--tg': tier.glow }}
              >
                <button
                  className="cmp-ident-remove"
                  onClick={() => onRemove(p.player_master_id)}
                  title="Remove"
                >
                  ✕
                </button>
                <div className="cmp-ident-top">
                  <span
                    className="cmp-ident-ovr"
                    style={{
                      color: tier.color,
                      textShadow: `0 0 16px ${tier.glow}`,
                    }}
                  >
                    {p.ovr ?? '—'}
                  </span>
                  <span className="cmp-ident-pos" style={{ color: posClr }}>
                    {p.pos}
                  </span>
                  {p.rookie_flag === 1 && (
                    <span className="cmp-ident-rc">RC</span>
                  )}
                </div>
                <div className="cmp-ident-name">{p.player_name}</div>
                <div className="cmp-ident-team">{p.nhl_team}</div>
                {drafted && (
                  <div className="cmp-ident-drafted">
                    <img
                      src={`/assets/teamLogos/${drafted}.png`}
                      alt={drafted}
                      style={{
                        width: 13,
                        height: 13,
                        objectFit: 'contain',
                        opacity: 0.6,
                      }}
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    DRAFTED · {drafted}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Main table: rows = stats, columns = years, sub-columns = players */}
        <div className="cmp-table-wrap">
          <table className="cmp-table">
            <thead>
              {/* Year group headers */}
              <tr className="cmp-thead-yr">
                <th className="cmp-th-sticky cmp-th-stat-lbl">STAT</th>
                {years.map((yr) => (
                  <th
                    key={yr}
                    className={`cmp-th-yr-grp ${
                      yr === draftYear ? 'cmp-yr-now' : ''
                    }`}
                    colSpan={players.length}
                  >
                    '{String(yr).slice(-2)}
                  </th>
                ))}
              </tr>
              {/* Player sub-headers under each year */}
              <tr className="cmp-thead-player">
                <th className="cmp-th-sticky cmp-th-empty" />
                {years.map((yr) =>
                  players.map((p) => (
                    <th
                      key={`${yr}-${p.player_master_id}`}
                      className={`cmp-th-player-sub ${
                        yr === draftYear ? 'cmp-yr-now-sub' : ''
                      }`}
                    >
                      {p.player_name.split(' ').pop()}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => {
                // Compute best value per year for highlight
                const bestByYear = {};
                years.forEach((yr) => {
                  const vals = players
                    .map((p) => {
                      const r = byYearByPlayer[p.player_master_id]?.[yr];
                      return r ? r[row.key] ?? null : null;
                    })
                    .filter((v) => v !== null);
                  bestByYear[yr] = vals.length > 0 ? Math.max(...vals) : null;
                });

                return (
                  <tr
                    key={row.key}
                    className={`cmp-tr ${
                      row.isOvr ? 'cmp-tr-ovr' : 'cmp-tr-stat'
                    }`}
                  >
                    <td className="cmp-th-sticky cmp-td-stat-lbl">
                      {row.label}
                    </td>
                    {years.map((yr) =>
                      players.map((p) => {
                        const r = byYearByPlayer[p.player_master_id]?.[yr];
                        const v = r ? r[row.key] ?? null : null;
                        const isBest =
                          v !== null &&
                          v === bestByYear[yr] &&
                          players.length > 1;
                        const tier = row.isOvr ? OVR_TIER(v ?? 0) : null;
                        const color =
                          v === null
                            ? 'rgba(255,255,255,.1)'
                            : row.isOvr
                            ? tier.color
                            : sc(v);
                        return (
                          <td
                            key={`${yr}-${p.player_master_id}`}
                            className={`cmp-td-val ${
                              yr === draftYear ? 'cmp-td-now' : ''
                            } ${isBest ? 'cmp-td-best' : ''}`}
                            style={{ color }}
                          >
                            {v ?? '—'}
                          </td>
                        );
                      })
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── PLAYER CARD ──────────────────────────────────────────────────────────────
function PlayerCard({
  player,
  allYearData,
  draftedByTeam,
  onClose,
  onPin,
  isPinned,
  draftYear,
}) {
  const tier = OVR_TIER(player.ovr ?? 0);
  const posClr = PC[player.pos] || '#aaa';
  const years = allYearData
    .map((r) => r.year)
    .filter((y) => y >= draftYear)
    .sort((a, b) => a - b);
  const byYear = Object.fromEntries(allYearData.map((r) => [r.year, r]));

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      className="dpc-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="dpc-card"
        style={{ '--tier': tier.color, '--tg': tier.glow }}
      >
        <div className="dpc-hdr">
          <div className="dpc-hdr-left">
            <div
              className="dpc-pos-badge"
              style={{
                background: `${posClr}22`,
                border: `1px solid ${posClr}66`,
                color: posClr,
              }}
            >
              {player.pos}
            </div>
            {player.rookie_flag === 1 && <div className="dpc-rc">RC</div>}
            {draftedByTeam && (
              <div className="dpc-drafted-badge">
                <img
                  src={`/assets/teamLogos/${draftedByTeam}.png`}
                  alt=""
                  style={{ width: 14, height: 14, objectFit: 'contain' }}
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
                DRAFTED · {draftedByTeam}
              </div>
            )}
          </div>
          <div className="dpc-hdr-right">
            <button
              className={`dpc-pin-btn ${isPinned ? 'dpc-pin-on' : ''}`}
              onMouseDown={(e) => {
                e.stopPropagation();
                onPin(player);
              }}
            >
              {isPinned ? '📌 IN COMPARE' : '+ ADD TO COMPARE'}
            </button>
            <button
              className="dpc-close-btn"
              onMouseDown={(e) => {
                e.stopPropagation();
                onClose();
              }}
            >
              ✕ CLOSE
            </button>
          </div>
        </div>

        <div className="dpc-name-row">
          <div className="dpc-name">{player.player_name}</div>
          <div className="dpc-meta">
            <span>{player.nhl_team}</span>
            <span className="dpc-sep">·</span>
            <span>#{player.jersey_number}</span>
            <span className="dpc-sep">·</span>
            <span>{player.hand === '1' ? 'R' : 'L'}</span>
            <span className="dpc-sep">·</span>
            <span>{'★'.repeat(player.star_rating ?? 0)}</span>
          </div>
        </div>

        <div className="dpc-ovr-strip">
          <div className="dpc-ovr-block">
            <span className="dpc-ovr-lbl">OVR</span>
            <span
              className="dpc-ovr-val"
              style={{ color: tier.color, textShadow: `0 0 24px ${tier.glow}` }}
            >
              {player.ovr ?? '—'}
            </span>
            <span
              className="dpc-tier"
              style={{ color: tier.color, borderColor: `${tier.color}44` }}
            >
              {tier.label}
            </span>
          </div>
          <div className="dpc-bars">
            {ALL_STATS.map((s) => {
              const v = player[s.key] ?? 0;
              const c = sc(v);
              return (
                <div key={s.key} className="dpc-bar-cell">
                  <span className="dpc-bar-lbl">{s.label}</span>
                  <span className="dpc-bar-val" style={{ color: c }}>
                    {v}
                  </span>
                  <div className="dpc-bar-bg">
                    <div
                      className="dpc-bar-fill"
                      style={{
                        width: `${Math.min(100, Math.round((v / 9) * 100))}%`,
                        background: c,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {years.length > 0 && (
          <div className="dpc-years">
            <div className="dpc-years-lbl">
              CAREER PROJECTION · {draftYear} → {years[years.length - 1]}
            </div>
            <div className="dpc-years-scroll">
              <table className="dpc-ytable">
                <thead>
                  <tr>
                    <th className="dpc-yt-sh">STAT</th>
                    {years.map((y) => (
                      <th
                        key={y}
                        className={`dpc-yt-yh ${
                          y === draftYear ? 'dpc-yt-now' : ''
                        }`}
                      >
                        '{String(y).slice(-2)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="dpc-yt-ovr">
                    <td className="dpc-yt-sl">OVR</td>
                    {years.map((y) => {
                      const r = byYear[y];
                      const t2 = OVR_TIER(r?.ovr ?? 0);
                      return (
                        <td
                          key={y}
                          className="dpc-yt-v"
                          style={{ color: t2.color }}
                        >
                          {r?.ovr ?? '—'}
                        </td>
                      );
                    })}
                  </tr>
                  {ALL_STATS.map((s) => (
                    <tr key={s.key} className="dpc-yt-row">
                      <td className="dpc-yt-sl">{s.label}</td>
                      {years.map((y) => {
                        const r = byYear[y];
                        const v = r?.[s.key] ?? null;
                        return (
                          <td
                            key={y}
                            className="dpc-yt-v"
                            style={{
                              color:
                                v !== null ? sc(v) : 'rgba(255,255,255,.12)',
                            }}
                          >
                            {v ?? '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="dpc-footer">
          <span>{player.pro_league ?? 'NHL'}</span>
          <span>DRAFT YEAR · {draftYear}</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN EXPORT
// ═══════════════════════════════════════════════════════════════
export default function DraftPlayerPool({
  draftLg,
  draftYear,
  className = '',
}) {
  const [players, setPlayers] = useState([]);
  const [allYears, setAllYears] = useState({});
  const [rosters, setRosters] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState('ALL');
  const [showFilter, setShowFilter] = useState('AVAILABLE');
  const [rookieOnly, setRookieOnly] = useState(false);
  const [sortKey, setSortKey] = useState('ovr');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState(null);
  const [selYears, setSelYears] = useState([]);
  const [pinned, setPinned] = useState([]);
  const [showCompare, setShowCompare] = useState(false);

  const load = useCallback(async () => {
    if (!draftLg || !draftYear) return;
    setLoading(true);
    const [{ data: base }, { data: future }, { data: ros }] = await Promise.all(
      [
        supabase
          .from('player_attributes_by_season')
          .select(
            'player_master_id,player_name,player_id,nhl_team,pos,ovr,star_rating,rookie_flag,hand,jersey_number,pro_league,year,wgt,agl,spd,ofa,dfa,shp_pkc,chk,sth,sha,end_str,rgh_stl,pas_gvr,agr_gvl'
          )
          .eq('year', draftYear)
          .order('ovr', { ascending: false }),
        supabase
          .from('player_attributes_by_season')
          .select(
            'player_master_id,year,ovr,wgt,agl,spd,ofa,dfa,shp_pkc,chk,sth,sha,end_str,rgh_stl,pas_gvr,agr_gvl'
          )
          .gte('year', draftYear)
          .order('year', { ascending: true }),
        supabase
          .from('rosters')
          .select('player_master_id,team_code')
          .eq('lg', draftLg),
      ]
    );
    const rMap = {};
    (ros ?? []).forEach((r) => {
      rMap[r.player_master_id] = r.team_code;
    });
    const ayMap = {};
    (future ?? []).forEach((r) => {
      if (!ayMap[r.player_master_id]) ayMap[r.player_master_id] = [];
      ayMap[r.player_master_id].push(r);
    });
    setPlayers(base ?? []);
    setAllYears(ayMap);
    setRosters(rMap);
    setLoading(false);
  }, [draftLg, draftYear]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!draftLg) return;
    const ch = supabase
      .channel(`pool-ros-${draftLg}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'rosters',
          filter: `lg=eq.${draftLg}`,
        },
        (p) => {
          if (p.eventType === 'INSERT')
            setRosters((prev) => ({
              ...prev,
              [p.new.player_master_id]: p.new.team_code,
            }));
          if (p.eventType === 'DELETE')
            setRosters((prev) => {
              const n = { ...prev };
              delete n[p.old.player_master_id];
              return n;
            });
        }
      )
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [draftLg]);

  const filtered = useMemo(() => {
    let list = players.map((p) => ({
      ...p,
      _drafted: rosters[p.player_master_id] ?? null,
    }));
    if (posFilter !== 'ALL') list = list.filter((p) => p.pos === posFilter);
    if (showFilter === 'AVAILABLE') list = list.filter((p) => !p._drafted);
    if (showFilter === 'DRAFTED') list = list.filter((p) => !!p._drafted);
    if (rookieOnly) list = list.filter((p) => p.rookie_flag === 1);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.player_name.toLowerCase().includes(q) ||
          (p.nhl_team ?? '').toLowerCase().includes(q)
      );
    }
    list.sort((a, b) => {
      const av = a[sortKey] ?? 0,
        bv = b[sortKey] ?? 0;
      return sortDir === 'desc' ? bv - av : av - bv;
    });
    return list;
  }, [
    players,
    rosters,
    posFilter,
    showFilter,
    rookieOnly,
    search,
    sortKey,
    sortDir,
  ]);

  const availCount = players.filter((p) => !rosters[p.player_master_id]).length;
  const draftedCount = players.filter(
    (p) => rosters[p.player_master_id]
  ).length;

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else {
      setSortKey(key);
      setSortDir('desc');
    }
  };
  const openCard = (p) => {
    setSelected(p);
    setSelYears(allYears[p.player_master_id] ?? []);
  };
  const togglePin = (p) => {
    setPinned((prev) => {
      const exists = prev.find(
        (x) => x.player_master_id === p.player_master_id
      );
      if (exists)
        return prev.filter((x) => x.player_master_id !== p.player_master_id);
      if (prev.length >= 4) return prev;
      return [...prev, p];
    });
  };
  const pinnedIds = new Set(pinned.map((p) => p.player_master_id));

  return (
    <div className={`dpp-wrap ${className}`}>
      {/* ── Header ── */}
      <div className="dpp-hdr">
        <div className="dpp-hdr-left">
          <span className="dpp-title">PLAYER POOL</span>
          <span className="dpp-lg-tag">{draftLg}</span>
        </div>
        <div className="dpp-counts">
          <button
            className={`dpp-cnt ${
              showFilter === 'AVAILABLE' ? 'dpp-cnt-avail-on' : ''
            }`}
            onClick={() =>
              setShowFilter((v) => (v === 'AVAILABLE' ? 'ALL' : 'AVAILABLE'))
            }
          >
            <span className="dpp-dot dpp-dot-g" />
            <span className="dpp-cnt-n">{availCount}</span>
            <span className="dpp-cnt-l">AVAIL</span>
          </button>
          <button
            className={`dpp-cnt ${
              showFilter === 'DRAFTED' ? 'dpp-cnt-draft-on' : ''
            }`}
            onClick={() =>
              setShowFilter((v) => (v === 'DRAFTED' ? 'ALL' : 'DRAFTED'))
            }
          >
            <span className="dpp-dot dpp-dot-r" />
            <span className="dpp-cnt-n">{draftedCount}</span>
            <span className="dpp-cnt-l">DRAFTED</span>
          </button>
          <button
            className={`dpp-cnt ${rookieOnly ? 'dpp-cnt-rc-on' : ''}`}
            onClick={() => setRookieOnly((v) => !v)}
          >
            <span
              className="dpp-cnt-n"
              style={{ fontSize: 8, color: '#FF8C00' }}
            >
              RC
            </span>
            <span className="dpp-cnt-l">ONLY</span>
          </button>
          {pinned.length > 0 && (
            <button
              className="dpp-cmp-open-btn"
              onClick={() => setShowCompare(true)}
            >
              📊 COMPARE ({pinned.length})
            </button>
          )}
        </div>
      </div>

      {/* ── Filter row ── */}
      <div className="dpp-filters">
        <div className="dpp-search-wrap">
          <span className="dpp-si">⌕</span>
          <input
            className="dpp-search"
            placeholder="Search name or team…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="dpp-sc" onClick={() => setSearch('')}>
              ✕
            </button>
          )}
        </div>
        <div className="dpp-btn-grp">
          {['ALL', 'F', 'D', 'G'].map((p) => (
            <button
              key={p}
              className={`dpp-fb ${posFilter === p ? 'dpp-fb-on' : ''}`}
              style={posFilter === p && p !== 'ALL' ? { '--fc': PC[p] } : {}}
              onClick={() => setPosFilter(p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ── Column headers — all clickable to sort ── */}
      <div className="dpp-col-hdr" style={{ gridTemplateColumns: GRID }}>
        <span
          className={`dpp-ch dpp-ch-s ${sortKey === 'ovr' ? 'dpp-ch-a' : ''}`}
          onClick={() => toggleSort('ovr')}
        >
          OVR{sortKey === 'ovr' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
        </span>
        <span className="dpp-ch">POS</span>
        <span className="dpp-ch" style={{ paddingLeft: '.3rem' }}>
          PLAYER
        </span>
        {ALL_STATS.map((s) => (
          <span
            key={s.key}
            className={`dpp-ch dpp-ch-s dpp-ch-c ${
              sortKey === s.key ? 'dpp-ch-a' : ''
            }`}
            onClick={() => toggleSort(s.key)}
          >
            {s.label}
            {sortKey === s.key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
          </span>
        ))}
        <span className="dpp-ch dpp-ch-r">CMP</span>
      </div>

      {/* ── Player list ── */}
      <div className="dpp-list">
        {loading ? (
          [...Array(8)].map((_, i) => (
            <div
              key={i}
              className="dpp-skel"
              style={{ opacity: 1 - i * 0.1 }}
            />
          ))
        ) : filtered.length === 0 ? (
          <div className="dpp-empty">
            <span style={{ fontSize: 24, opacity: 0.2 }}>🏒</span>
            <span className="dpp-empty-txt">NO PLAYERS MATCH</span>
          </div>
        ) : (
          filtered.map((p) => {
            const tier = OVR_TIER(p.ovr ?? 0);
            const posClr = PC[p.pos] || '#aaa';
            const isDrafted = !!p._drafted;
            const isPinned_ = pinnedIds.has(p.player_master_id);

            return (
              <div
                key={p.player_master_id}
                className={`dpr-row ${isDrafted ? 'dpr-drafted' : 'dpr-avail'}`}
                style={{ gridTemplateColumns: GRID }}
              >
                {/* OVR */}
                <div
                  className="dpr-ovr"
                  style={{
                    color: isDrafted ? 'rgba(255,255,255,.18)' : tier.color,
                    borderColor: isDrafted
                      ? 'rgba(255,255,255,.08)'
                      : `${tier.color}44`,
                    boxShadow: isDrafted ? 'none' : `0 0 8px ${tier.glow}`,
                  }}
                >
                  {p.ovr ?? '—'}
                </div>

                {/* POS */}
                <div
                  className="dpr-pos"
                  style={{ color: isDrafted ? 'rgba(255,255,255,.2)' : posClr }}
                >
                  {p.pos}
                </div>

                {/* Name */}
                <div className="dpr-info" onClick={() => openCard(p)}>
                  <span
                    className="dpr-name"
                    style={{
                      opacity: isDrafted ? 0.3 : 1,
                      textDecoration: isDrafted ? 'line-through' : 'none',
                    }}
                  >
                    {p.player_name}
                  </span>
                  <div className="dpr-sub">
                    <span
                      className="dpr-nhl"
                      style={{ opacity: isDrafted ? 0.3 : 0.62 }}
                    >
                      {p.nhl_team}
                    </span>
                    {p.rookie_flag === 1 && !isDrafted && (
                      <span className="dpr-rc">RC</span>
                    )}
                    {(p.star_rating ?? 0) >= 4 && !isDrafted && (
                      <span className="dpr-stars">
                        {'★'.repeat(p.star_rating)}
                      </span>
                    )}
                  </div>
                </div>

                {/* All 13 stat columns */}
                {isDrafted ? (
                  // Drafted: show team logo spanning all stat cols
                  <div
                    className="dpr-drafted-by"
                    style={{ gridColumn: 'span 13' }}
                    onClick={() => openCard(p)}
                  >
                    <img
                      src={`/assets/teamLogos/${p._drafted}.png`}
                      alt={p._drafted}
                      className="dpr-dl"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                    <span className="dpr-dt">{p._drafted}</span>
                  </div>
                ) : (
                  ALL_STATS.map((s) => {
                    const v = p[s.key] ?? 0;
                    return (
                      <div
                        key={s.key}
                        className="dpr-stat-cell"
                        onClick={() => openCard(p)}
                      >
                        <span className="dpr-sv" style={{ color: sc(v) }}>
                          {v}
                        </span>
                      </div>
                    );
                  })
                )}

                {/* +CMP */}
                <div className="dpr-actions">
                  {!isDrafted && (
                    <button
                      className={`dpr-pin ${isPinned_ ? 'dpr-pin-on' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        togglePin(p);
                      }}
                      title={
                        isPinned_ ? 'Remove from compare' : 'Add to compare'
                      }
                    >
                      {isPinned_ ? '📌' : '+'}
                    </button>
                  )}
                  {isDrafted && <span className="dpr-gone">GONE</span>}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {!loading && (
        <div className="dpp-footer">
          {filtered.length} of {players.length} players
          {search && ` · "${search}"`}
          {pinned.length > 0 && (
            <span className="dpp-footer-cmp">
              {' '}
              · {pinned.length} in compare —{' '}
              <button
                className="dpp-footer-open"
                onClick={() => setShowCompare(true)}
              >
                OPEN ▶
              </button>
            </span>
          )}
        </div>
      )}

      {/* Compare popup */}
      {showCompare && pinned.length > 0 && (
        <ComparePopup
          players={pinned}
          allYearsMap={allYears}
          rosters={rosters}
          draftYear={draftYear}
          onClose={() => setShowCompare(false)}
          onRemove={(id) => {
            setPinned((prev) => {
              const next = prev.filter((p) => p.player_master_id !== id);
              if (next.length === 0) setShowCompare(false);
              return next;
            });
          }}
        />
      )}

      {/* Player card */}
      {selected && (
        <PlayerCard
          player={selected}
          allYearData={selYears}
          draftedByTeam={rosters[selected.player_master_id] ?? null}
          draftYear={draftYear}
          isPinned={pinnedIds.has(selected.player_master_id)}
          onPin={togglePin}
          onClose={() => {
            setSelected(null);
            setSelYears([]);
          }}
        />
      )}

      <style>{`
        .dpp-wrap { --bg:#0b0c14; --bdr:rgba(135,206,235,.1); --or:#FF8C00; font-family:'VT323',monospace; background:var(--bg); border:1.5px solid var(--bdr); display:flex; flex-direction:column; overflow:hidden; height:100%; color:rgba(230,225,210,.92); position:relative; }

        /* Header */
        .dpp-hdr { display:flex; align-items:center; justify-content:space-between; padding:.42rem .8rem; background:linear-gradient(90deg,rgba(255,140,0,.09),transparent); border-bottom:1px solid rgba(255,140,0,.12); flex-shrink:0; }
        .dpp-hdr-left { display:flex; align-items:baseline; gap:.42rem; }
        .dpp-title { font-family:'Press Start 2P',monospace; font-size:9px; color:var(--or); letter-spacing:2px; text-shadow:0 0 10px rgba(255,140,0,.4); }
        .dpp-lg-tag { font-family:'Press Start 2P',monospace; font-size:6px; color:rgba(255,255,255,.2); letter-spacing:2px; }
        .dpp-counts { display:flex; gap:.3rem; align-items:center; flex-wrap:wrap; }
        .dpp-cnt { display:flex; align-items:center; gap:.2rem; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:4px; padding:.16rem .38rem; cursor:pointer; transition:all .13s; }
        .dpp-cnt:hover { background:rgba(255,255,255,.06); }
        .dpp-cnt-avail-on { background:rgba(0,230,118,.08)!important; border-color:rgba(0,230,118,.3)!important; }
        .dpp-cnt-draft-on { background:rgba(255,80,80,.08)!important;  border-color:rgba(255,80,80,.3)!important;  }
        .dpp-cnt-rc-on    { background:rgba(255,140,0,.12)!important;  border-color:rgba(255,140,0,.4)!important;  }
        .dpp-dot { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
        .dpp-dot-g { background:#00E676; box-shadow:0 0 5px rgba(0,230,118,.7); animation:dppP 2s ease-in-out infinite; }
        .dpp-dot-r { background:#555; }
        @keyframes dppP { 0%,100%{opacity:1} 50%{opacity:.3} }
        .dpp-cnt-n { font-family:'Press Start 2P',monospace; font-size:9px; color:#fff; }
        .dpp-cnt-l { font-family:'Press Start 2P',monospace; font-size:5.5px; color:rgba(255,255,255,.28); letter-spacing:1.5px; }
        .dpp-cmp-open-btn { font-family:'Press Start 2P',monospace; font-size:6px; color:#FFD700; background:rgba(255,215,0,.1); border:1px solid rgba(255,215,0,.28); border-radius:4px; padding:.18rem .42rem; cursor:pointer; transition:all .13s; letter-spacing:1px; white-space:nowrap; }
        .dpp-cmp-open-btn:hover { background:rgba(255,215,0,.18); }

        /* Filters */
        .dpp-filters { display:flex; align-items:center; gap:.32rem; padding:.28rem .8rem; background:rgba(0,0,0,.18); border-bottom:1px solid var(--bdr); flex-shrink:0; }
        .dpp-search-wrap { position:relative; display:flex; align-items:center; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.09); border-radius:4px; flex:1; min-width:100px; max-width:170px; }
        .dpp-si { position:absolute; left:.32rem; font-size:16px; color:rgba(255,255,255,.22); pointer-events:none; }
        .dpp-search { width:100%; background:transparent; border:none; outline:none; font-family:'VT323',monospace; font-size:16px; color:rgba(255,255,255,.85); padding:.16rem .32rem .16rem 1.35rem; }
        .dpp-search::placeholder { color:rgba(255,255,255,.2); }
        .dpp-sc { position:absolute; right:.26rem; background:none; border:none; color:rgba(255,255,255,.22); cursor:pointer; font-size:10px; padding:.06rem; line-height:1; }
        .dpp-btn-grp { display:flex; align-items:center; gap:.14rem; }
        .dpp-fb { font-family:'Press Start 2P',monospace; font-size:6px; color:rgba(255,255,255,.35); background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:3px; padding:.16rem .28rem; cursor:pointer; transition:all .12s; line-height:1; white-space:nowrap; flex-shrink:0; }
        .dpp-fb:hover { color:rgba(255,255,255,.7); background:rgba(255,255,255,.06); }
        .dpp-fb-on { color:var(--fc,var(--or))!important; background:rgba(255,140,0,.09)!important; border-color:rgba(255,140,0,.3)!important; }

        /* Column headers — grid-aligned with rows */
        .dpp-col-hdr { display:grid; gap:.15rem; padding:.14rem .8rem; background:rgba(0,0,0,.32); border-bottom:1px solid var(--bdr); flex-shrink:0; }
        .dpp-ch { font-family:'Press Start 2P',monospace; font-size:5.5px; color:rgba(255,255,255,.22); letter-spacing:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dpp-ch-s { cursor:pointer; transition:color .12s; display:flex; align-items:center; gap:1px; }
        .dpp-ch-s:hover { color:rgba(255,255,255,.55); }
        .dpp-ch-a { color:var(--or)!important; }
        .dpp-ch-c { justify-content:center; }
        .dpp-ch-r { justify-content:flex-end; }

        /* Player list */
        .dpp-list { flex:1; overflow-y:auto; min-height:0; }
        .dpp-list::-webkit-scrollbar { width:3px; }
        .dpp-list::-webkit-scrollbar-thumb { background:rgba(255,140,0,.2); border-radius:2px; }

        /* Player rows */
        .dpr-row { display:grid; gap:.15rem; align-items:center; padding:.22rem .8rem; border-bottom:1px solid rgba(255,255,255,.035); transition:background .1s; }
        .dpr-avail:hover  { background:rgba(255,140,0,.032); cursor:pointer; }
        .dpr-drafted      { background:rgba(0,0,0,.1); }
        .dpr-drafted:hover{ background:rgba(255,255,255,.013); cursor:pointer; }

        .dpr-ovr { font-family:'Press Start 2P',monospace; font-size:10px; border:1px solid; border-radius:3px; padding:.12rem .14rem; text-align:center; line-height:1; }
        .dpr-pos { font-family:'Press Start 2P',monospace; font-size:7px; text-align:center; letter-spacing:1px; }
        .dpr-info { display:flex; flex-direction:column; gap:1px; min-width:0; }
        .dpr-name { font-family:'VT323',monospace; font-size:19px; color:rgba(230,225,210,.9); line-height:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .dpr-sub  { display:flex; align-items:center; gap:.22rem; }
        .dpr-nhl  { font-family:'Press Start 2P',monospace; font-size:5.5px; color:rgba(255,255,255,.5); letter-spacing:.8px; }
        .dpr-rc   { font-family:'Press Start 2P',monospace; font-size:5px; background:rgba(255,140,0,.14); border:1px solid rgba(255,140,0,.32); color:#FF8C00; padding:.02rem .14rem; border-radius:2px; }
        .dpr-stars { font-size:8px; color:#FFD700; letter-spacing:1px; }
        .dpr-stat-cell { display:flex; align-items:center; justify-content:center; }
        .dpr-sv { font-family:'Press Start 2P',monospace; font-size:8.5px; }
        .dpr-drafted-by { display:flex; align-items:center; gap:.26rem; }
        .dpr-dl { width:17px; height:17px; object-fit:contain; opacity:.4; }
        .dpr-dt { font-family:'Press Start 2P',monospace; font-size:6px; color:rgba(255,255,255,.2); letter-spacing:1px; }
        .dpr-actions { display:flex; justify-content:flex-end; align-items:center; }
        .dpr-pin { font-family:'Press Start 2P',monospace; font-size:7px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09); border-radius:3px; padding:.12rem .26rem; cursor:pointer; transition:all .12s; color:rgba(255,255,255,.3); line-height:1; }
        .dpr-pin:hover { background:rgba(255,140,0,.1); border-color:rgba(255,140,0,.28); color:#FF8C00; }
        .dpr-pin-on { background:rgba(255,140,0,.15)!important; border-color:rgba(255,140,0,.5)!important; color:#FFD700!important; }
        .dpr-gone { font-family:'Press Start 2P',monospace; font-size:5.5px; color:rgba(255,80,80,.3); letter-spacing:1px; }

        .dpp-skel { height:36px; margin:.1rem .8rem; border-radius:3px; background:linear-gradient(90deg,rgba(255,255,255,.025),rgba(255,255,255,.05),rgba(255,255,255,.025)); background-size:200% 100%; animation:dppSh 1.8s infinite; }
        @keyframes dppSh { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .dpp-empty { display:flex; flex-direction:column; align-items:center; gap:.4rem; padding:2rem 1rem; }
        .dpp-empty-txt { font-family:'Press Start 2P',monospace; font-size:7.5px; color:rgba(255,255,255,.15); letter-spacing:2px; }
        .dpp-footer { font-family:'Press Start 2P',monospace; font-size:5.5px; color:rgba(255,255,255,.17); letter-spacing:1px; padding:.22rem .8rem; border-top:1px solid var(--bdr); background:rgba(0,0,0,.18); flex-shrink:0; }
        .dpp-footer-cmp { color:rgba(255,140,0,.5); }
        .dpp-footer-open { font-family:'Press Start 2P',monospace; font-size:5.5px; background:none; border:none; color:#FFD700; cursor:pointer; text-decoration:underline; padding:0; }

        /* ══ COMPARE POPUP ══════════════════════════════════════ */
        .cmp-overlay { position:fixed; inset:0; z-index:1300; background:rgba(0,0,5,.9); backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:center; padding:.75rem; animation:cmpFd .18s ease; }
        @keyframes cmpFd { from{opacity:0} to{opacity:1} }
        .cmp-popup { background:#0c0c18; border:2px solid rgba(255,215,0,.2); border-radius:12px; width:100%; max-width:min(98vw,1400px); max-height:92vh; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 0 80px rgba(255,215,0,.07),0 30px 80px rgba(0,0,0,.95); animation:cmpSl .2s ease; }
        @keyframes cmpSl { from{transform:translateY(14px);opacity:0} to{transform:translateY(0);opacity:1} }

        .cmp-popup-hdr { display:flex; align-items:center; gap:1rem; padding:.65rem 1.1rem; background:rgba(255,215,0,.04); border-bottom:1px solid rgba(255,215,0,.1); flex-shrink:0; }
        .cmp-popup-title { font-family:'Press Start 2P',monospace; font-size:12px; color:#FFD700; letter-spacing:2px; text-shadow:0 0 18px rgba(255,215,0,.4); }
        .cmp-popup-sub   { font-family:'Press Start 2P',monospace; font-size:7px; color:rgba(255,255,255,.22); letter-spacing:1.5px; }
        .cmp-popup-close { margin-left:auto; font-family:'Press Start 2P',monospace; font-size:10px; letter-spacing:1.5px; color:#fff; background:rgba(255,80,80,.18); border:1.5px solid rgba(255,80,80,.45); border-radius:6px; padding:.38rem .85rem; cursor:pointer; transition:all .15s; }
        .cmp-popup-close:hover { background:rgba(255,80,80,.35); border-color:rgba(255,80,80,.7); }

        /* Player identity cards */
        .cmp-ident-row { display:grid; gap:1px; background:rgba(255,255,255,.06); border-bottom:2px solid rgba(255,215,0,.12); flex-shrink:0; }
        .cmp-ident-card { background:#0e0e1e; border-top:3px solid var(--tier,rgba(255,255,255,.2)); padding:.45rem .75rem; position:relative; }
        .cmp-ident-remove { position:absolute; top:.28rem; right:.32rem; background:none; border:none; color:rgba(255,255,255,.22); cursor:pointer; font-size:12px; padding:.08rem; transition:color .12s; }
        .cmp-ident-remove:hover { color:rgba(255,80,80,.85); }
        .cmp-ident-top { display:flex; align-items:baseline; gap:.3rem; margin-bottom:2px; }
        .cmp-ident-ovr  { font-family:'Press Start 2P',monospace; font-size:20px; line-height:1; }
        .cmp-ident-pos  { font-family:'Press Start 2P',monospace; font-size:8px; letter-spacing:1px; }
        .cmp-ident-rc   { font-family:'Press Start 2P',monospace; font-size:6px; background:rgba(255,140,0,.15); border:1px solid rgba(255,140,0,.35); color:#FF8C00; padding:.04rem .18rem; border-radius:2px; }
        .cmp-ident-name { font-family:'VT323',monospace; font-size:22px; color:rgba(240,235,220,.92); line-height:1.2; word-break:break-word; }
        .cmp-ident-team { font-family:'Press Start 2P',monospace; font-size:6.5px; color:rgba(255,255,255,.32); letter-spacing:1.5px; margin-top:2px; }
        .cmp-ident-drafted { display:flex; align-items:center; gap:.24rem; font-family:'Press Start 2P',monospace; font-size:6px; color:rgba(255,80,80,.52); margin-top:3px; letter-spacing:1px; }

        /* Table */
        .cmp-table-wrap { flex:1; overflow:auto; min-height:0; }
        .cmp-table-wrap::-webkit-scrollbar { width:5px; height:5px; }
        .cmp-table-wrap::-webkit-scrollbar-thumb { background:rgba(255,215,0,.18); border-radius:2px; }

        .cmp-table { border-collapse:collapse; min-width:max-content; width:100%; }
        .cmp-table th, .cmp-table td { padding:.24rem .5rem; text-align:center; white-space:nowrap; border-bottom:1px solid rgba(255,255,255,.04); }

        /* Sticky left column */
        .cmp-th-sticky { position:sticky; left:0; z-index:3; background:#0c0c18; }

        /* Year group header row */
        .cmp-thead-yr .cmp-th-stat-lbl { font-family:'Press Start 2P',monospace; font-size:6.5px; color:rgba(255,255,255,.18); letter-spacing:1.5px; text-align:left!important; border-bottom:1px solid rgba(255,255,255,.08); padding-right:1.2rem!important; }
        .cmp-th-yr-grp { font-family:'Press Start 2P',monospace; font-size:11px; color:rgba(255,255,255,.38); letter-spacing:2px; border-bottom:1px solid rgba(255,255,255,.08); border-left:1px solid rgba(255,255,255,.06); padding:.35rem .5rem; }
        .cmp-yr-now { color:#FFD700!important; text-shadow:0 0 10px rgba(255,215,0,.4); background:rgba(255,215,0,.06)!important; border-bottom-color:rgba(255,215,0,.2)!important; }

        /* Player name sub-header row */
        .cmp-thead-player .cmp-th-empty { border-bottom:1px solid rgba(255,255,255,.05); }
        .cmp-th-player-sub { font-family:'VT323',monospace; font-size:14px; color:rgba(255,255,255,.35); letter-spacing:.5px; border-bottom:1px solid rgba(255,255,255,.07); border-left:1px solid rgba(255,255,255,.03); }
        .cmp-yr-now-sub { background:rgba(255,215,0,.04)!important; }

        /* Data cells */
        .cmp-td-stat-lbl { font-family:'Press Start 2P',monospace; font-size:6.5px; color:rgba(255,255,255,.38); letter-spacing:1px; text-align:left!important; padding-right:1.2rem!important; background:#0c0c18; }
        .cmp-td-val { font-family:'VT323',monospace; font-size:22px; line-height:1; border-left:1px solid rgba(255,255,255,.025); }
        .cmp-td-now { background:rgba(255,215,0,.03)!important; }
        .cmp-td-best { font-weight:bold; text-shadow:0 0 8px currentColor; position:relative; }
        .cmp-td-best::after { content:''; position:absolute; inset:0; background:rgba(255,255,255,.04); pointer-events:none; }

        /* OVR rows stand out */
        .cmp-tr-ovr td { background:rgba(255,255,255,.025); border-bottom:1px solid rgba(255,255,255,.07)!important; }
        .cmp-tr-ovr .cmp-th-sticky { background:#111122!important; }
        .cmp-tr-ovr .cmp-td-stat-lbl { color:#FFD700!important; background:#111122!important; font-size:7.5px!important; }

        .cmp-tr-stat:nth-child(even) td { background:rgba(255,255,255,.01); }
        .cmp-tr-stat:hover td { background:rgba(255,255,255,.025)!important; }
        .cmp-tr-stat:hover .cmp-th-sticky { background:rgba(255,255,255,.03)!important; }

        /* ══ PLAYER CARD MODAL ══════════════════════════════════ */
        .dpc-overlay { position:fixed; inset:0; z-index:1200; background:rgba(0,0,5,.86); backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; padding:1rem; animation:dpcFd .16s ease; }
        @keyframes dpcFd { from{opacity:0} to{opacity:1} }
        .dpc-card { background:#0c0c18; border:1.5px solid rgba(255,255,255,.1); border-top:2.5px solid var(--tier); border-radius:12px; width:100%; max-width:820px; max-height:88vh; overflow:hidden; display:flex; flex-direction:column; box-shadow:0 0 80px var(--tg),0 24px 70px rgba(0,0,0,.95); animation:dpcUp .2s ease; }
        @keyframes dpcUp { from{transform:translateY(14px);opacity:0} to{transform:translateY(0);opacity:1} }
        .dpc-hdr { display:flex; align-items:center; justify-content:space-between; padding:.5rem .85rem .4rem; flex-shrink:0; }
        .dpc-hdr-left  { display:flex; align-items:center; gap:.36rem; }
        .dpc-hdr-right { display:flex; align-items:center; gap:.42rem; flex-shrink:0; }
        .dpc-pos-badge { font-family:'Press Start 2P',monospace; font-size:8px; padding:.17rem .38rem; border-radius:3px; letter-spacing:1px; }
        .dpc-rc  { font-family:'Press Start 2P',monospace; font-size:6px; background:rgba(255,140,0,.14); border:1px solid rgba(255,140,0,.33); color:#FF8C00; padding:.12rem .26rem; border-radius:3px; }
        .dpc-drafted-badge { display:flex; align-items:center; gap:.26rem; background:rgba(255,80,80,.08); border:1px solid rgba(255,80,80,.22); border-radius:4px; padding:.12rem .35rem; font-family:'Press Start 2P',monospace; font-size:6px; color:rgba(255,120,120,.62); letter-spacing:1px; }
        .dpc-pin-btn { font-family:'Press Start 2P',monospace; font-size:6.5px; letter-spacing:1px; color:rgba(255,255,255,.36); background:rgba(255,255,255,.05); border:1.5px solid rgba(255,255,255,.12); border-radius:5px; padding:.24rem .55rem; cursor:pointer; transition:all .14s; line-height:1; }
        .dpc-pin-btn:hover { background:rgba(255,140,0,.12); border-color:rgba(255,140,0,.4); color:#FF8C00; }
        .dpc-pin-on   { background:rgba(255,140,0,.18)!important; border-color:rgba(255,140,0,.6)!important; color:#FFD700!important; }
        .dpc-close-btn { font-family:'Press Start 2P',monospace; font-size:7px; letter-spacing:1.5px; color:rgba(255,255,255,.48); background:rgba(255,255,255,.06); border:1.5px solid rgba(255,255,255,.14); border-radius:5px; padding:.26rem .6rem; cursor:pointer; transition:all .14s; line-height:1; }
        .dpc-close-btn:hover { color:#fff; background:rgba(255,80,80,.18); border-color:rgba(255,80,80,.5); }
        .dpc-name-row { padding:.08rem .85rem .42rem; border-bottom:1px solid rgba(255,255,255,.06); flex-shrink:0; }
        .dpc-name { font-family:'Press Start 2P',monospace; font-size:clamp(10px,2vw,14px); color:#fff; letter-spacing:1.5px; line-height:1.4; margin-bottom:.26rem; }
        .dpc-meta { display:flex; align-items:center; gap:.32rem; flex-wrap:wrap; font-family:'VT323',monospace; font-size:19px; color:rgba(255,255,255,.42); }
        .dpc-sep { color:rgba(255,255,255,.16); }
        .dpc-ovr-strip { display:flex; align-items:center; gap:1rem; padding:.5rem .85rem; border-bottom:1px solid rgba(255,255,255,.06); flex-shrink:0; }
        .dpc-ovr-block { display:flex; flex-direction:column; align-items:center; gap:.1rem; flex-shrink:0; min-width:62px; }
        .dpc-ovr-lbl { font-family:'Press Start 2P',monospace; font-size:6px; color:rgba(255,255,255,.2); letter-spacing:2px; }
        .dpc-ovr-val { font-family:'Press Start 2P',monospace; font-size:34px; line-height:1; }
        .dpc-tier    { font-family:'Press Start 2P',monospace; font-size:5.5px; letter-spacing:2px; border:1px solid; border-radius:3px; padding:.08rem .26rem; }
        .dpc-bars { display:grid; grid-template-columns:repeat(13,1fr); gap:.18rem; flex:1; }
        .dpc-bar-cell { display:flex; flex-direction:column; align-items:center; gap:2px; }
        .dpc-bar-lbl  { font-family:'Press Start 2P',monospace; font-size:4.5px; color:rgba(255,255,255,.26); }
        .dpc-bar-val  { font-family:'Press Start 2P',monospace; font-size:8.5px; line-height:1; }
        .dpc-bar-bg   { width:100%; height:3px; background:rgba(255,255,255,.07); border-radius:2px; overflow:hidden; }
        .dpc-bar-fill { height:100%; border-radius:2px; }
        .dpc-years { flex:1; overflow:hidden; display:flex; flex-direction:column; padding:.42rem .85rem .5rem; min-height:0; }
        .dpc-years-lbl { font-family:'Press Start 2P',monospace; font-size:6px; color:rgba(255,140,0,.5); letter-spacing:2px; margin-bottom:.32rem; flex-shrink:0; }
        .dpc-years-scroll { flex:1; overflow:auto; min-height:0; }
        .dpc-years-scroll::-webkit-scrollbar { height:3px; width:3px; }
        .dpc-years-scroll::-webkit-scrollbar-thumb { background:rgba(255,140,0,.2); }
        .dpc-ytable { border-collapse:collapse; width:100%; min-width:max-content; }
        .dpc-ytable th,.dpc-ytable td { padding:.16rem .38rem; text-align:center; border-bottom:1px solid rgba(255,255,255,.04); white-space:nowrap; }
        .dpc-yt-sh { text-align:left!important; position:sticky; left:0; background:#0c0c18; z-index:2; font-family:'Press Start 2P',monospace; font-size:5.5px; color:rgba(255,255,255,.18); border-bottom:1px solid rgba(255,255,255,.08); }
        .dpc-yt-sl { text-align:left!important; position:sticky; left:0; background:#0c0c18; z-index:1; font-family:'Press Start 2P',monospace; font-size:5.5px; color:rgba(255,255,255,.35); padding-right:.55rem!important; }
        .dpc-yt-yh { font-family:'Press Start 2P',monospace; font-size:6px; color:rgba(255,255,255,.28); border-bottom:1px solid rgba(255,255,255,.08); }
        .dpc-yt-now { color:var(--tier)!important; text-shadow:0 0 8px var(--tg); }
        .dpc-yt-ovr td { font-family:'Press Start 2P',monospace; font-size:8px; background:rgba(255,255,255,.02); border-bottom:1px solid rgba(255,255,255,.07)!important; }
        .dpc-yt-v { font-family:'VT323',monospace; font-size:19px; line-height:1; }
        .dpc-yt-row:hover td { background:rgba(255,255,255,.016); }
        .dpc-footer { display:flex; justify-content:space-between; padding:.22rem .85rem; background:rgba(0,0,0,.22); font-family:'Press Start 2P',monospace; font-size:5.5px; color:rgba(255,255,255,.15); letter-spacing:1.5px; flex-shrink:0; }
      `}</style>
    </div>
  );
}

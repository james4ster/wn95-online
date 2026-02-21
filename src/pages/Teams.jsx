import React, { useEffect, useState, useRef, useCallback } from "react";
import { useLeague } from "../components/LeagueContext";
import { supabase } from "../utils/supabaseClient";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ovrClass = (o) => {
  if (o == null) return "";
  if (o >= 80) return "ovr-elite";
  if (o >= 65) return "ovr-good";
  if (o >= 50) return "ovr-avg";
  return "ovr-low";
};

// BUG FIX 1: was ovrClass(o) — 'o' is undefined in this scope, must be 'ovr'
const OvrBadge = ({ ovr }) =>
  ovr != null ? (
    <span className={`ovr-badge ${ovrClass(ovr)}`}>{ovr}</span>
  ) : (
    <span className="ovr-empty">—</span>
  );

const PosBadge = ({ pos }) =>
  pos ? <span className={`pos-badge pos-${pos}`}>{pos}</span> : null;

const handLabel = (h) => {
  if (h === "L" || h === "l") return "L";
  if (h === "R" || h === "r") return "R";
  if (h === 0   || h === "0" || h === false) return "L";
  if (h === 1   || h === "1" || h === true)  return "R";
  return h ? String(h).toUpperCase() : "";
};

const TOOLTIP_ATTRS = [
  { key: "agl",     label: "AGL" },
  { key: "spd",     label: "SPD" },
  { key: "ofa",     label: "OFA" },
  { key: "dfa",     label: "DFA" },
  { key: "shp_pkc", label: "SHP" },
  { key: "chk",     label: "CHK" },
  { key: "sth",     label: "STH" },
  { key: "sha",     label: "SHA" },
  { key: "end_str", label: "END" },
  { key: "rgh_stl", label: "RGH" },
  { key: "pas_gvr", label: "PAS" },
  { key: "agr_gvl", label: "AGR" },
];

const POS_ORDER = { F: 0, D: 1, G: 2 };

// ─── Paginated RPC fetch ──────────────────────────────────────────────────────
async function rpcAllPages(rpcName, params) {
  let rows = [], from = 0;
  while (true) {
    const { data, error } = await supabase.rpc(rpcName, params).range(from, from + 999);
    if (error) { console.error("RPC error:", rpcName, error.message); break; }
    if (!data?.length) break;
    rows = rows.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

// ─── Paginated table fetch ────────────────────────────────────────────────────
async function tableAllPages(builtQuery) {
  let rows = [], from = 0;
  while (true) {
    const { data, error } = await builtQuery.range(from, from + 999);
    if (error) { console.error("Table fetch error:", error.message); break; }
    if (!data?.length) break;
    rows = rows.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return rows;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────
function AttrTooltip({ playerName, seasonLabel, attrs, anchorEl }) {
  const ref = useRef(null);
  const [pos, setPos] = useState({ top: -9999, left: -9999, ready: false });

  useEffect(() => {
    if (!anchorEl || !ref.current) return;
    const cell = anchorEl.getBoundingClientRect();
    const tip  = ref.current.getBoundingClientRect();
    const sy   = window.scrollY || 0;
    let left   = cell.left + (window.scrollX || 0) + cell.width / 2 - tip.width / 2;
    let top    = cell.top + sy - tip.height - 10;
    if (left < 8) left = 8;
    if (left + tip.width > window.innerWidth - 8) left = window.innerWidth - tip.width - 8;
    if (top < sy + 8) top = cell.bottom + sy + 10;
    setPos({ top, left, ready: true });
  }, [anchorEl]);

  const present = TOOLTIP_ATTRS.filter((a) => attrs[a.key] != null);

  return (
    <div className="attr-tooltip" ref={ref}
      style={{ top: pos.top, left: pos.left, opacity: pos.ready ? 1 : 0 }}>
      <div className="tt-header">
        <span className="tt-name">{playerName}</span>
        <span className="tt-season">{seasonLabel}</span>
      </div>
      <div className="tt-ovr-row">
        OVR&nbsp;
        {/* BUG FIX 2: was ovrClass(attrs.o) — must be attrs.ovr */}
        <span className={`ovr-badge ${ovrClass(attrs.ovr)}`}>{attrs.ovr}</span>
        {attrs.star_rating != null && (
          <span className="tt-stars">
            {"★".repeat(attrs.star_rating)}{"☆".repeat(Math.max(0, 5 - attrs.star_rating))}
          </span>
        )}
      </div>
      {present.length > 0 && (
        <div className="tt-grid">
          {present.map(({ key, label }) => (
            <div key={key} className="tt-stat">
              <span className="tt-label">{label}</span>
              <span className={`tt-val ${ovrClass(attrs[key])}`}>{attrs[key]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Team stat strip ──────────────────────────────────────────────────────────
function TeamStatStrip({ stat }) {
  if (!stat) return null;
  const gfg = stat.gp > 0 ? (stat.gf / stat.gp).toFixed(2) : "—";
  const gag = stat.gp > 0 ? (stat.ga / stat.gp).toFixed(2) : "—";
  const items = [
    { label: "RANK", value: stat.season_rank ?? "—", cls: "sv-rank" },
    { label: "W",    value: stat.w   ?? 0, cls: "sv-win"  },
    { label: "L",    value: stat.l   ?? 0, cls: "sv-loss" },
    { label: "T",    value: stat.t   ?? 0 },
    { label: "OTL",  value: stat.otl ?? 0, cls: "sv-loss" },
    { label: "PTS",  value: stat.pts ?? 0, cls: "sv-pts"  },
    { label: "GF",   value: stat.gf  ?? 0 },
    { label: "GA",   value: stat.ga  ?? 0 },
    { label: "GF/G", value: gfg },
    { label: "GA/G", value: gag },
  ];
  return (
    <div className="team-stat-strip">
      {items.map(({ label, value, cls }) => (
        <div key={label} className="tss-item">
          <span className="tss-label">{label}</span>
          <span className={`tss-val ${cls || ""}`}>{value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Teams() {
  const { selectedLeague } = useLeague();

  const [seasons, setSeasons]               = useState([]);
  const [selectedSeason, setSelectedSeason] = useState("");
  const [teamPlayers,  setTeamPlayers]      = useState({});
  const [attrLookup,   setAttrLookup]       = useState({});
  const [displayYears, setDisplayYears]     = useState([]);
  const [yearToLabel,  setYearToLabel]      = useState({});
  const [standingsMap, setStandingsMap]     = useState({});
  const [loading, setLoading]               = useState(false);
  const [expandedTeams, setExpandedTeams]   = useState(new Set());
  const [tooltip, setTooltip]               = useState(null);

  // ── Seasons ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedLeague) { setSeasons([]); setSelectedSeason(""); return; }
    (async () => {
      const { data } = await supabase
        .from("seasons").select("lg, year").order("year", { ascending: false });
      const filtered = (data || []).filter(s => s.lg.startsWith(selectedLeague));
      setSeasons(filtered);
      if (filtered.length) setSelectedSeason(filtered[0].lg);
    })();
  }, [selectedLeague]);

  // ── Single combined fetch ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedSeason || !seasons.length) {
      setTeamPlayers({}); setAttrLookup({}); setDisplayYears([]); return;
    }
    const selSeasonObj = seasons.find(s => s.lg === selectedSeason);
    if (!selSeasonObj) return;
    const selYear = selSeasonObj.year;

    const y2l = {};
    seasons.forEach(s => { y2l[s.year] = s.lg; });
    setYearToLabel(y2l);

    (async () => {
      setLoading(true);

      const rosterRows = await rpcAllPages("get_roster_with_attributes", {
        season_lg: selectedSeason,
      });

      console.log(`[Stage 1] ${rosterRows.length} rows for ${selectedSeason} (year ${selYear})`);
      if (rosterRows.length) {
        const s = rosterRows[0];
        console.log("  keys:", Object.keys(s).join(", "));
        console.log("  player_master_id:", s.player_master_id, "  pos:", s.pos, "  hand:", s.hand);
      }

      if (!rosterRows.length) {
        setTeamPlayers({}); setAttrLookup({}); setDisplayYears([]); setLoading(false); return;
      }

      const tp = {};
      rosterRows.forEach(r => {
        if (!r.team_code || !r.player_name) return;
        if (!tp[r.team_code]) tp[r.team_code] = {};
        if (!tp[r.team_code][r.player_name]) {
          tp[r.team_code][r.player_name] = {
            name: r.player_name, pos: r.pos, hand: r.hand,
            id: r.player_master_id ?? null,
          };
        }
      });

      const al = {};
      rosterRows.forEach(r => {
        if (!r.player_name) return;
        if (!al[r.player_name]) al[r.player_name] = {};
        al[r.player_name][r.year] = r;
      });

      const ids   = [...new Set(rosterRows.map(r => r.player_master_id).filter(Boolean))];
      const names = [...new Set(rosterRows.map(r => r.player_name).filter(Boolean))];
      console.log(`[Stage 2] ids: ${ids.length}, names: ${names.length}`);

      let futureRows = [];

      if (ids.length > 0) {
        console.log("  Using player_master_id join");
        const CHUNK = 400;
        for (let i = 0; i < ids.length; i += CHUNK) {
          const chunk = ids.slice(i, i + CHUNK);
          const rows = await tableAllPages(
            supabase
              .from("player_attributes_by_season")
              .select("player_master_id, year, ovr, agl, spd, ofa, dfa, shp_pkc, chk, sth, sha, end_str, rgh_stl, pas_gvr, agr_gvl, star_rating")
              .in("player_master_id", chunk)
              .gt("year", selYear)
              .order("year", { ascending: true })
          );
          futureRows = futureRows.concat(rows);
        }
        const idToName = {};
        rosterRows.forEach(r => { if (r.player_master_id) idToName[r.player_master_id] = r.player_name; });
        futureRows.forEach(r => {
          const name = idToName[r.player_master_id];
          if (!name) return;
          if (!al[name]) al[name] = {};
          al[name][r.year] = r;
        });
      } else {
        console.log("  Falling back to player_name join");
        const CHUNK = 200;
        for (let i = 0; i < names.length; i += CHUNK) {
          const chunk = names.slice(i, i + CHUNK);
          const rows = await tableAllPages(
            supabase
              .from("player_attributes_by_season")
              .select("player_name, year, ovr, agl, spd, ofa, dfa, shp_pkc, chk, sth, sha, end_str, rgh_stl, pas_gvr, agr_gvl, star_rating")
              .in("player_name", chunk)
              .gt("year", selYear)
              .order("year", { ascending: true })
          );
          futureRows = futureRows.concat(rows);
        }
        futureRows.forEach(r => {
          if (!r.player_name) return;
          if (!al[r.player_name]) al[r.player_name] = {};
          al[r.player_name][r.year] = r;
        });
      }

      console.log(`[Stage 2] ${futureRows.length} future rows`);

      const allYears = [...new Set(
        Object.values(al).flatMap(byYear => Object.keys(byYear).map(Number))
      )].sort((a, b) => a - b);

      console.log(`[Derived] ${Object.keys(tp).length} teams, years: ${allYears.join(", ")}`);

      setTeamPlayers(tp);
      setAttrLookup(al);
      setDisplayYears(allYears);
      setLoading(false);
    })();
  }, [selectedSeason, seasons]);

  // ── Standings ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedSeason) { setStandingsMap({}); return; }
    (async () => {
      const { data } = await supabase
        .from("standings")
        .select("team, season_rank, gp, w, l, t, otl, pts, gf, ga")
        .eq("season", selectedSeason);
      const map = {};
      (data || []).forEach(s => { map[s.team] = s; });
      setStandingsMap(map);
    })();
  }, [selectedSeason]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selSeasonObj = seasons.find(s => s.lg === selectedSeason);
  const selYear      = selSeasonObj?.year ?? null;
  const colLabel     = y => yearToLabel[y] ?? String(y);
  const sortedTeams  = Object.keys(teamPlayers).sort();

  const toggleTeam  = code => setExpandedTeams(prev => {
    const n = new Set(prev); n.has(code) ? n.delete(code) : n.add(code); return n;
  });
  const expandAll   = () => setExpandedTeams(new Set(sortedTeams));
  const collapseAll = () => setExpandedTeams(new Set());

  const showTooltip = useCallback((e, playerName, year, attrs) => {
    if (!attrs) return;
    e.stopPropagation();
    setTooltip({ playerName, seasonLabel: colLabel(year), attrs, anchorEl: e.currentTarget });
  }, [yearToLabel]);
  const hideTooltip = useCallback(() => setTooltip(null), []);

  useEffect(() => {
    const h = () => setTooltip(null);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  const W = { pos: 54, hand: 30, name: 185, season: 62 };
  const thS = (w, extra = {}) => ({ width: w, minWidth: w, maxWidth: w, textAlign: "center", ...extra });
  const tdS = (w, extra = {}) => ({ width: w, minWidth: w, maxWidth: w, textAlign: "center", overflow: "hidden", ...extra });

  return (
    <div className="teams-page" onClick={() => setTooltip(null)}>

      {/* HEADER */}
      <div className="scoreboard-header-container">
        <div className="scoreboard-header">
          <div className="led-text">TEAM ROSTERS</div>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="control-panel">
        <div className="control-group">
          <label>SEASON</label>
          <select
            className="arcade-select"
            value={selectedSeason}
            onChange={e => setSelectedSeason(e.target.value)}
            disabled={!selectedLeague || !seasons.length}
          >
            <option value="">SELECT SEASON</option>
            {seasons.map(s => (
              <option key={s.lg} value={s.lg}>{s.lg} ({s.year})</option>
            ))}
          </select>
        </div>
        {sortedTeams.length > 0 && (
          <div className="control-group">
            <label>&nbsp;</label>
            <div className="expand-btns">
              <button className="expand-btn" onClick={expandAll}>▼ EXPAND ALL</button>
              <button className="expand-btn" onClick={collapseAll}>▲ COLLAPSE ALL</button>
            </div>
          </div>
        )}
      </div>

      {/* BODY */}
      {loading ? (
        <div className="loading-screen">
          <div className="loading-spinner" />
          <div className="loading-text">LOADING ROSTERS...</div>
        </div>
      ) : !selectedSeason ? (
        <div className="no-data"><div className="no-data-text">SELECT A SEASON</div></div>
      ) : sortedTeams.length === 0 ? (
        <div className="no-data"><div className="no-data-text">NO ROSTER DATA FOUND</div></div>
      ) : (
        <div className="teams-list">
          {sortedTeams.map(teamCode => {
            const playersByName = teamPlayers[teamCode];
            const isOpen        = expandedTeams.has(teamCode);
            const teamStat      = standingsMap[teamCode];

            const sortedPlayers = Object.values(playersByName).sort((a, b) => {
              const pa = POS_ORDER[a.pos] ?? 9;
              const pb = POS_ORDER[b.pos] ?? 9;
              return pa !== pb ? pa - pb : a.name.localeCompare(b.name);
            });

            return (
              <div key={teamCode} className="team-block">
                <div
                  className={`team-header-row ${isOpen ? "team-header-row--open" : ""}`}
                  onClick={e => { e.stopPropagation(); toggleTeam(teamCode); }}
                >
                  <div className="thdr-banner">
                    <img src={`/assets/banners/${teamCode}.png`} alt=""
                      className="thdr-banner-img"
                      onError={e => { e.currentTarget.style.display = "none"; }} />
                  </div>
                  <div className="thdr-left">
                    <div className="logo-container">
                      <img src={`/assets/teamLogos/${teamCode}.png`} alt={teamCode}
                        className="team-logo"
                        onError={e => {
                          e.currentTarget.style.display = "none";
                          e.currentTarget.nextElementSibling.style.display = "flex";
                        }} />
                      <div className="logo-fallback" style={{ display: "none" }}>{teamCode}</div>
                    </div>
                    <div className="thdr-identity">
                      <span className="thdr-code">{teamCode}</span>
                      <span className="thdr-count">{sortedPlayers.length} PLAYERS</span>
                    </div>
                    <TeamStatStrip stat={teamStat} />
                  </div>
                  <div className="thdr-right">
                    <span className="thdr-chevron">{isOpen ? "▼" : "▶"}</span>
                  </div>
                </div>

                {isOpen && (
                  <div className="roster-panel" onClick={e => e.stopPropagation()}>
                    <div className="roster-scroll">
                      <table className="roster-table">
                        <thead>
                          <tr>
                            <th style={thS(W.pos)}>POS</th>
                            <th style={thS(W.hand)}>H</th>
                            <th style={thS(W.name, { textAlign: "left", paddingLeft: 12 })}>PLAYER</th>
                            {displayYears.map(y => (
                              <th key={y} style={{
                                ...thS(W.season),
                                ...(y === selYear ? {
                                  background: "linear-gradient(180deg,#FFD700 0%,#FFA500 100%)",
                                  color: "#000",
                                  boxShadow: "inset 0 0 8px rgba(255,255,255,.2)",
                                } : y < selYear ? { opacity: 0.4 } : {}),
                              }}>
                                {colLabel(y)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedPlayers.map((player, pi) => {
                            const byYear = attrLookup[player.name] || {};
                            return (
                              <tr key={player.name}
                                className={pi % 2 === 0 ? "row-even" : "row-odd"}>
                                <td style={tdS(W.pos)}>
                                  <PosBadge pos={player.pos} />
                                </td>
                                <td style={tdS(W.hand)} className="cell-hand">
                                  {handLabel(player.hand)}
                                </td>
                                <td style={tdS(W.name, { textAlign: "left", paddingLeft: 12 })}
                                  className="cell-name">
                                  {player.name}
                                </td>
                                {displayYears.map(y => {
                                  const row = byYear[y];
                                  const ovr = row?.ovr ?? null;
                                  const isCur = y === selYear;
                                  // BUG FIX 3: was ovrClass(row?.o) and OvrClass(row.o)
                                  // 'o' doesn't exist — must be row?.ovr; OvrClass → ovrClass
                                  const tierCls = ovrClass(ovr);
                                  return (
                                    <td key={y}
                                      style={tdS(W.season)}
                                      className={[
                                        "cell-ovr",
                                        tierCls,
                                        isCur       ? "cell-ovr-cur"  : "",
                                        y < selYear ? "cell-ovr-past" : "",
                                        row         ? "cell-hoverable" : "",
                                      ].filter(Boolean).join(" ")}
                                      onMouseEnter={row ? e => showTooltip(e, player.name, y, row) : undefined}
                                      onMouseLeave={row ? hideTooltip : undefined}
                                    >
                                      <OvrBadge ovr={ovr} />
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tooltip && (
        <AttrTooltip
          playerName={tooltip.playerName}
          seasonLabel={tooltip.seasonLabel}
          attrs={tooltip.attrs}
          anchorEl={tooltip.anchorEl}
        />
      )}

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }

        .teams-page {
          padding: 1rem 2rem; min-height: 100vh;
          background: radial-gradient(ellipse at top, #0a0a15 0%, #000000 100%);
        }

        /* HEADER */
        .scoreboard-header-container { display:flex; justify-content:center; margin-bottom:1rem; }
        .scoreboard-header {
          background:#000; border:6px solid #333; border-radius:8px; padding:1rem 2rem;
          box-shadow:0 0 0 2px #000,inset 0 0 20px rgba(0,0,0,.8),0 8px 16px rgba(0,0,0,.5),0 0 40px rgba(255,215,0,.3);
          position:relative; overflow:hidden;
        }
        .scoreboard-header::before {
          content:''; position:absolute; inset:0; pointer-events:none;
          background:
            repeating-linear-gradient(0deg,transparent 0,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px),
            repeating-linear-gradient(90deg,transparent 0,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px);
        }
        .scoreboard-header::after {
          content:''; position:absolute; top:-50%; left:-50%; width:200%; height:200%;
          background:linear-gradient(45deg,transparent 30%,rgba(255,215,0,.1) 50%,transparent 70%);
          animation:shimmer 3s infinite;
        }
        @keyframes shimmer {
          0%{transform:translateX(-100%) translateY(-100%) rotate(45deg)}
          100%{transform:translateX(100%) translateY(100%) rotate(45deg)}
        }
        .led-text {
          font-family:'Press Start 2P',monospace; font-size:2rem; color:#FFD700;
          letter-spacing:6px; text-shadow:0 0 10px #FF8C00,0 0 20px #FF8C00,0 0 30px #FFD700;
          filter:contrast(1.3) brightness(1.2); position:relative;
        }

        /* CONTROLS */
        .control-panel {
          display:flex; gap:1.5rem; justify-content:center; align-items:flex-end;
          flex-wrap:wrap; margin-bottom:1.5rem;
        }
        .control-group { display:flex; flex-direction:column; gap:.5rem; }
        .control-group label {
          font-family:'Press Start 2P',monospace; font-size:.7rem;
          color:#FF8C00; letter-spacing:2px; text-shadow:0 0 5px #FF8C00;
        }
        .arcade-select {
          background:linear-gradient(180deg,#1a1a2e 0%,#0a0a15 100%);
          color:#87CEEB; border:3px solid #87CEEB; padding:.75rem 1rem;
          font-family:'VT323',monospace; font-size:1.2rem; cursor:pointer;
          border-radius:8px; transition:all .3s ease; letter-spacing:1px; min-width:200px;
          box-shadow:0 0 10px rgba(135,206,235,.3),inset 0 0 10px rgba(135,206,235,.1);
        }
        .arcade-select:hover:not(:disabled) {
          border-color:#FF8C00; color:#FF8C00;
          box-shadow:0 0 15px rgba(255,140,0,.5),inset 0 0 15px rgba(255,140,0,.1);
          transform:translateY(-2px);
        }
        .arcade-select:disabled { opacity:.4; cursor:not-allowed; }

        .expand-btns { display:flex; gap:.5rem; }
        .expand-btn {
          background:linear-gradient(180deg,#1a1a2e 0%,#0a0a15 100%);
          color:#87CEEB; border:2px solid rgba(135,206,235,.4);
          padding:.65rem 1.1rem; font-family:'Press Start 2P',monospace; font-size:.5rem;
          letter-spacing:1px; cursor:pointer; border-radius:6px;
          transition:all .25s ease; white-space:nowrap;
        }
        .expand-btn:hover {
          border-color:#FFD700; color:#FFD700;
          box-shadow:0 0 12px rgba(255,215,0,.4); transform:translateY(-2px);
        }

        /* LOADING / EMPTY */
        .loading-screen {
          display:flex; flex-direction:column; align-items:center;
          justify-content:center; min-height:400px; gap:2rem;
        }
        .loading-spinner {
          width:60px; height:60px; border:6px solid rgba(255,140,0,.2);
          border-top:6px solid #FF8C00; border-radius:50%;
          animation:spin 1s linear infinite; box-shadow:0 0 20px rgba(255,140,0,.5);
        }
        @keyframes spin { to{transform:rotate(360deg)} }
        .loading-text {
          font-family:'Press Start 2P',monospace; font-size:1rem; color:#87CEEB;
          letter-spacing:2px; animation:pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0%,100%{opacity:.5;text-shadow:0 0 5px #87CEEB}
          50%{opacity:1;text-shadow:0 0 20px #FF8C00}
        }
        .no-data { display:flex; justify-content:center; align-items:center; min-height:400px; }
        .no-data-text {
          font-family:'Press Start 2P',monospace; font-size:1.2rem; color:#FF8C00;
          text-shadow:0 0 10px #FF8C00,0 0 20px #FF8C00; letter-spacing:3px;
        }

        /* TEAMS */
        .teams-list { display:flex; flex-direction:column; gap:1rem; }
        .team-block {
          background:linear-gradient(180deg,#0a0a15 0%,#1a1a2e 100%);
          border:4px solid #FF0000; border-radius:12px; overflow:hidden;
          box-shadow:0 0 20px rgba(255,0,0,.4),0 0 40px rgba(255,0,0,.2),inset 0 0 20px rgba(255,0,0,.1);
        }

        /* TEAM HEADER ROW */
        .team-header-row {
          display:flex; align-items:center; justify-content:space-between;
          padding:.75rem 1.25rem; cursor:pointer; user-select:none;
          position:relative; overflow:hidden; min-height:72px;
          background:linear-gradient(180deg,rgba(255,140,0,.06) 0%,transparent 100%);
          transition:background .2s ease; border-bottom:2px solid rgba(255,140,0,.15);
        }
        .team-header-row:hover {
          background:linear-gradient(180deg,rgba(255,140,0,.13) 0%,rgba(255,140,0,.04) 100%);
        }
        .team-header-row--open { border-bottom-color:#FF8C00; border-left:5px solid #FFD700; }

        .thdr-banner {
          position:absolute; inset:0; pointer-events:none; z-index:0;
          overflow:hidden; opacity:.12; transition:opacity .2s;
        }
        .team-header-row:hover .thdr-banner { opacity:.2; }
        .thdr-banner-img {
          position:absolute; right:-10px; top:50%; transform:translateY(-50%);
          height:160%; width:auto; object-fit:contain;
          filter:blur(1px) brightness(1.3);
          mask-image:linear-gradient(to left,rgba(0,0,0,.9) 0%,transparent 70%);
          -webkit-mask-image:linear-gradient(to left,rgba(0,0,0,.9) 0%,transparent 70%);
        }
        .thdr-left {
          display:flex; align-items:center; gap:1rem;
          position:relative; z-index:2; flex:1; min-width:0; flex-wrap:wrap;
        }
        .logo-container {
          width:50px; height:50px; flex-shrink:0;
          background:rgba(0,0,0,.6); border-radius:8px; padding:3px;
          border:2px solid rgba(135,206,235,.4);
          box-shadow:0 0 10px rgba(135,206,235,.3); transition:all .3s ease;
          display:flex; align-items:center; justify-content:center;
        }
        .team-header-row:hover .logo-container {
          border-color:rgba(255,140,0,.8); box-shadow:0 0 15px rgba(255,140,0,.6);
        }
        .team-logo {
          width:100%; height:100%; object-fit:contain;
          filter:drop-shadow(0 0 6px rgba(135,206,235,.4)); transition:all .3s ease;
        }
        .team-header-row:hover .team-logo {
          filter:drop-shadow(0 0 15px rgba(255,140,0,1)) drop-shadow(0 0 25px rgba(255,140,0,.6));
          transform:scale(1.12);
        }
        .logo-fallback {
          display:flex; align-items:center; justify-content:center;
          width:100%; height:100%;
          background:linear-gradient(135deg,#87CEEB 0%,#4682B4 100%);
          border-radius:6px; font-family:'Press Start 2P',monospace;
          font-size:.5rem; color:#000; font-weight:bold;
        }
        .thdr-identity { display:flex; flex-direction:column; gap:.25rem; flex-shrink:0; min-width:70px; }
        .thdr-code {
          font-family:'Press Start 2P',monospace; font-size:.95rem; color:#FFD700;
          letter-spacing:2px; text-shadow:0 0 8px rgba(255,215,0,.5);
        }
        .thdr-count {
          font-family:'Press Start 2P',monospace; font-size:.38rem;
          color:rgba(135,206,235,.55); letter-spacing:1px;
        }
        .thdr-right { position:relative; z-index:2; flex-shrink:0; padding-left:.75rem; }
        .thdr-chevron {
          font-family:'Press Start 2P',monospace; font-size:.6rem;
          color:rgba(255,165,0,.4); transition:color .2s ease;
        }
        .team-header-row:hover .thdr-chevron,
        .team-header-row--open .thdr-chevron { color:#FFD700; text-shadow:0 0 8px rgba(255,215,0,.7); }

        /* TEAM STAT STRIP */
        .team-stat-strip { display:flex; gap:.3rem; flex-wrap:nowrap; align-items:stretch; }
        .tss-item {
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          gap:.1rem; padding:.3rem .65rem;
          border:1px solid rgba(255,140,0,.25); border-radius:6px;
          background:rgba(0,0,0,.4); min-width:44px;
        }
        .tss-label {
          font-family:'Press Start 2P',monospace; font-size:.34rem;
          color:rgba(135,206,235,.55); letter-spacing:1px; white-space:nowrap;
        }
        .tss-val { font-family:'VT323',monospace; font-size:1.5rem; color:#E0E0E0; line-height:1; }
        .sv-rank { color:#FFD700 !important; text-shadow:0 0 8px rgba(255,215,0,.6); }
        .sv-pts  { color:#FFD700 !important; }
        .sv-win  { color:#00FF64 !important; }
        .sv-loss { color:#FF6B6B !important; }

        /* ROSTER PANEL */
        .roster-panel {
          background:linear-gradient(180deg,#0a0a15 0%,#1a1a2e 100%);
          border-top:2px solid rgba(255,140,0,.2); animation:panelIn .15s ease;
        }
        @keyframes panelIn {
          from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)}
        }
        .roster-scroll { overflow-x:auto; }

        .roster-table { border-collapse:collapse; table-layout:fixed; }
        .roster-table thead tr { background:linear-gradient(180deg,#FF8C00 0%,#FF6347 100%); }
        .roster-table th {
          padding:.6rem .4rem; font-family:'Press Start 2P',monospace;
          font-size:.46rem; color:#FFF; border-right:1px solid rgba(255,255,255,.2);
          white-space:nowrap; letter-spacing:.5px; overflow:hidden; vertical-align:middle;
        }
        .roster-table th:last-child { border-right:none; }

        .roster-table tbody tr { transition:background .12s ease; }
        .row-even { background:rgba(0,30,60,.4); }
        .row-odd  { background:rgba(0,20,40,.6); }
        .roster-table tbody tr:hover { background:rgba(255,140,0,.08) !important; }

        .roster-table td {
          padding:.32rem .4rem; font-size:1.15rem; color:#E0E0E0;
          border-bottom:1px solid rgba(255,140,0,.12);
          border-right:1px solid rgba(255,140,0,.06);
          vertical-align:middle; overflow:hidden;
        }
        .roster-table td:last-child { border-right:none; }

        .cell-hand {
          font-family:'Press Start 2P',monospace; font-size:.46rem; color:rgba(255,255,255,.5);
        }
        .cell-name { font-size:1.2rem; color:#E0E0E0; white-space:nowrap; text-overflow:ellipsis; }

        .cell-ovr { }
        .cell-ovr-cur  { background:rgba(255,215,0,.07) !important; }
        .cell-ovr-past { opacity:.4; }
        .cell-hoverable { cursor:pointer; }

        /* Tier-tinted cell hover — tierCls is on the <td> so these compound selectors work */
        .cell-hoverable.ovr-elite:hover {
          background:rgba(0,255,100,.22) !important; opacity:1 !important;
          box-shadow:0 0 10px rgba(0,255,100,.5);
        }
        .cell-hoverable.ovr-good:hover {
          background:rgba(255,215,0,.22) !important; opacity:1 !important;
          box-shadow:0 0 10px rgba(255,215,0,.5);
        }
        .cell-hoverable.ovr-avg:hover {
          background:rgba(255,215,0,.12) !important; opacity:1 !important;
          box-shadow:0 0 8px rgba(255,215,0,.3);
        }
        .cell-hoverable.ovr-low:hover {
          background:rgba(255,255,255,.08) !important; opacity:1 !important;
        }

        /* ── OVR BADGE TIERS ── */
        .ovr-badge {
          display:inline-block; font-family:'Press Start 2P',monospace;
          font-size:.5rem; padding:.16rem .38rem; border-radius:4px; letter-spacing:1px;
        }
        /* Elite (80+) — Green, highest */
        .ovr-elite {
          background:rgba(0,255,100,.15);
          border:1px solid rgba(0,255,100,.55);
          color:#00FF64;
          text-shadow:0 0 6px rgba(0,255,100,.5);
        }
        /* Good (65–79) — Gold/Yellow */
        .ovr-good {
          background:rgba(255,215,0,.15);
          border:1px solid rgba(255,215,0,.55);
          color:#FFD700;
        }
        /* Average (50–64) — Softer yellow */
        .ovr-avg {
          background:rgba(255,215,0,.08);
          border:1px solid rgba(255,215,0,.30);
          color:#E6C200;
        }
        /* Low (<50) — Gray */
        .ovr-low {
          background:rgba(255,255,255,.05);
          border:1px solid rgba(255,255,255,.12);
          color:rgba(255,255,255,.4);
        }
        .ovr-empty { font-family:'VT323',monospace; font-size:1rem; color:rgba(255,255,255,.1); }

        .pos-badge {
          font-family:'Press Start 2P',monospace; font-size:.42rem;
          border-radius:4px; padding:.16rem .38rem; letter-spacing:1px; display:inline-block;
        }
        .pos-F { background:rgba(0,200,100,.12);   border:1px solid rgba(0,200,100,.4);   color:#00C864; }
        .pos-D { background:rgba(135,206,235,.12); border:1px solid rgba(135,206,235,.4); color:#87CEEB; }
        .pos-G { background:rgba(255,165,0,.12);   border:1px solid rgba(255,165,0,.4);   color:#FFA500; }

        /* TOOLTIP */
        .attr-tooltip {
          position:absolute; z-index:9999;
          background:linear-gradient(180deg,#0d0d20 0%,#1a1a35 100%);
          border:2px solid #FF8C00; border-radius:10px; padding:.75rem 1rem;
          min-width:230px; pointer-events:none;
          box-shadow:0 0 20px rgba(255,140,0,.5),0 0 40px rgba(255,140,0,.2),inset 0 0 20px rgba(255,140,0,.05);
          transition:opacity .1s ease;
        }
        .tt-header {
          display:flex; justify-content:space-between; align-items:baseline;
          margin-bottom:.45rem; border-bottom:1px solid rgba(255,140,0,.3);
          padding-bottom:.4rem; gap:.75rem;
        }
        .tt-name {
          font-family:'Press Start 2P',monospace; font-size:.5rem; color:#FFD700;
          letter-spacing:1px; text-shadow:0 0 8px rgba(255,215,0,.5);
          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .tt-season { font-family:'VT323',monospace; font-size:1.1rem; color:rgba(135,206,235,.7); white-space:nowrap; flex-shrink:0; }
        .tt-ovr-row {
          font-family:'Press Start 2P',monospace; font-size:.44rem;
          color:rgba(255,255,255,.45); letter-spacing:2px; margin-bottom:.5rem;
          display:flex; align-items:center; gap:.5rem;
        }
        .tt-stars { font-size:.75rem; color:#FFD700; letter-spacing:1px; }
        .tt-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:.3rem .4rem; }
        .tt-stat {
          display:flex; flex-direction:column; align-items:center; gap:.1rem;
          background:rgba(0,0,0,.3); border:1px solid rgba(255,140,0,.15);
          border-radius:4px; padding:.22rem .28rem;
        }
        .tt-label { font-family:'Press Start 2P',monospace; font-size:.33rem; color:rgba(135,206,235,.5); letter-spacing:1px; }
        .tt-val { font-family:'VT323',monospace; font-size:1.05rem; line-height:1; color:#E0E0E0; }
        /* Tooltip stat values — aligned with badge tier colors (FIXED from old scheme) */
        .tt-val.ovr-elite { color:#00FF64; }            /* Green  — highest */
        .tt-val.ovr-good  { color:#FFD700; }            /* Gold   — above avg */
        .tt-val.ovr-avg   { color:#E6C200; }            /* Soft yellow — average */
        .tt-val.ovr-low   { color:rgba(255,255,255,.4); } /* Gray — low */

        /* RESPONSIVE */
        @media (max-width:900px) {
          .teams-page { padding:.75rem; }
          .led-text { font-size:1.2rem; letter-spacing:3px; }
          .scoreboard-header { padding:1rem 1.5rem; }
          .team-stat-strip { display:none; }
        }
        @media (max-width:600px) {
          .teams-page { padding:.5rem; }
          .led-text { font-size:1rem; letter-spacing:2px; }
          .control-panel { flex-direction:column; align-items:stretch; }
          .arcade-select { min-width:unset; width:100%; }
          .expand-btns { width:100%; }
          .expand-btn { flex:1; font-size:.42rem; padding:.5rem; }
          .thdr-code { font-size:.7rem; }
          .attr-tooltip { display:none; }
        }
      `}</style>
    </div>
  );
}
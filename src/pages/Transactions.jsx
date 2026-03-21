// Transactions.jsx — Draft History + Trades (placeholder)
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from '../components/LeagueContext';

const lgPrefix = (lg) => (lg || '').replace(/[0-9]/g, '').trim();

// ─── Team Logo ────────────────────────────────────────────────────────────
function TeamLogo({ code, size = 28 }) {
  const [err, setErr] = useState(false);
  if (!code) return null;
  const clean = code.trim().toUpperCase();
  return err ? (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 5,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(135,206,235,.1)',
        border: '1.5px solid rgba(135,206,235,.25)',
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 6,
        color: '#87CEEB',
      }}
    >
      {clean.slice(0, 3)}
    </div>
  ) : (
    <img
      src={`/assets/teamLogos/${clean}.png`}
      alt={clean}
      onError={() => setErr(true)}
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
        filter: 'drop-shadow(0 0 3px rgba(255,255,255,.12))',
      }}
    />
  );
}

// ─── Transaction badge ────────────────────────────────────────────────────
function TxnBadge({ flag, details }) {
  const [hovered, setHovered] = useState(false);
  if (!flag && !details) return null;
  const label = (details || 'TXN').toUpperCase();
  const MAX = 15;
  const truncated = label.length > MAX ? label.slice(0, MAX) + '…' : label;
  const needsTooltip = label.length > MAX;
  return (
    <div
      className="txn-badge-wrap"
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        marginLeft: 4,
      }}
      onMouseEnter={() => needsTooltip && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 7,
          padding: '2px 5px',
          borderRadius: 3,
          letterSpacing: 1,
          background: 'rgba(255,140,0,.18)',
          border: '1px solid rgba(255,140,0,.45)',
          color: '#FF8C00',
          whiteSpace: 'nowrap',
          maxWidth: 140,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          display: 'inline-block',
          cursor: needsTooltip ? 'help' : 'default',
        }}
      >
        {truncated}
      </span>
      {hovered && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            right: 0,
            background: '#0a0a18',
            border: '1px solid rgba(255,140,0,.6)',
            color: '#FF8C00',
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 7,
            letterSpacing: 1,
            padding: '6px 9px',
            borderRadius: 5,
            whiteSpace: 'normal',
            width: 260,
            lineHeight: 1.7,
            boxShadow: '0 4px 16px rgba(0,0,0,.8)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

// ─── Position badge ───────────────────────────────────────────────────────
const POS_COLORS = {
  F: {
    bg: 'rgba(0,200,100,.4)',
    border: 'rgba(0,200,100,.4)',
    color: '#00FF88',
  },
  C: {
    bg: 'rgba(0,200,100,.4)',
    border: 'rgba(0,200,100,.4)',
    color: '#00FF88',
  },
  LW: {
    bg: 'rgba(0,200,100,.4)',
    border: 'rgba(0,200,100,.4)',
    color: '#00FF88',
  },
  RW: {
    bg: 'rgba(0,200,100,.4)',
    border: 'rgba(0,200,100,.4)',
    color: '#00FF88',
  },
  D: {
    bg: 'rgba(135,206,235,.4)',
    border: 'rgba(135,206,235,.4)',
    color: '#87CEEB',
  },
  G: {
    bg: 'rgba(255,215,0,.13)',
    border: 'rgba(255,215,0,.4)',
    color: '#FFD700',
  },
  '-': {
    bg: 'rgba(255,255,255,.05)',
    border: 'rgba(255,255,255,.1)',
    color: 'rgba(255,255,255,.3)',
  },
};
function PosBadge({ pos }) {
  const p = (pos || '-').trim().toUpperCase();
  const c = POS_COLORS[p] || {
    bg: 'rgba(255,255,255,.07)',
    border: 'rgba(255,255,255,.2)',
    color: 'rgba(255,255,255,.5)',
  };
  return (
    <span
      style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: 8,
        padding: '3px 6px',
        borderRadius: 4,
        letterSpacing: 1,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        display: 'inline-block',
        minWidth: 28,
        textAlign: 'center',
      }}
    >
      {p || '?'}
    </span>
  );
}

// ─── Round header ─────────────────────────────────────────────────────────
function RoundHeader({ round, pickCount }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '.65rem 1.2rem',
        margin: '0',
        background:
          'linear-gradient(90deg, rgba(255,140,0,.13) 0%, rgba(255,140,0,.04) 60%, transparent 100%)',
        borderLeft: '3px solid rgba(255,140,0,.7)',
        borderBottom: '1px solid rgba(255,140,0,.15)',
      }}
    >
      <span
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 10,
          color: '#FF8C00',
          letterSpacing: 3,
          textShadow: '0 0 10px rgba(255,140,0,.5)',
        }}
      >
        ROUND {round}
      </span>
      <span
        style={{
          fontFamily: "'VT323', monospace",
          fontSize: 16,
          color: 'rgba(255,255,255,.3)',
          letterSpacing: 1,
        }}
      >
        {pickCount} PICK{pickCount !== 1 ? 'S' : ''}
      </span>
    </div>
  );
}

// ─── Season header (for By Manager view) ─────────────────────────────────
function SeasonHeader({ season, totalPicks }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '.7rem 1.2rem',
        background:
          'linear-gradient(90deg, rgba(135,206,235,.12) 0%, rgba(135,206,235,.03) 60%, transparent 100%)',
        borderLeft: '3px solid rgba(135,206,235,.6)',
        borderBottom: '1px solid rgba(135,206,235,.12)',
      }}
    >
      <span
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 11,
          color: '#87CEEB',
          letterSpacing: 3,
          textShadow: '0 0 10px rgba(135,206,235,.4)',
        }}
      >
        {season}
      </span>
      <span
        style={{
          fontFamily: "'VT323', monospace",
          fontSize: 16,
          color: 'rgba(255,255,255,.3)',
          letterSpacing: 1,
        }}
      >
        {totalPicks} PICK{totalPicks !== 1 ? 'S' : ''}
      </span>
    </div>
  );
}

// ─── Single pick row ──────────────────────────────────────────────────────
function PickRow({ pick, idx }) {
  const even = idx % 2 === 0;
  return (
    <div
      className="txn-pick-row txn-season-row"
      style={{
        display: 'grid',
        gridTemplateColumns: '52px 52px 90px 46px 1fr auto',
        alignItems: 'center',
        gap: '0 .5rem',
        padding: '.38rem 1.2rem',
        background: even ? 'rgba(0,0,22,.75)' : 'rgba(0,0,10,.85)',
        borderBottom: '1px solid rgba(255,255,255,.04)',
        transition: 'background .1s',
        cursor: 'default',
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = 'rgba(255,130,0,.1)')
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = even
          ? 'rgba(0,0,22,.75)'
          : 'rgba(0,0,10,.85)')
      }
    >
      {/* Round */}
      <span
        className="txn-rnd"
        style={{
          fontFamily: "'VT323', monospace",
          fontSize: 20,
          color: 'rgba(255,140,0,.7)',
          textAlign: 'center',
        }}
      >
        R{pick.round}
      </span>

      {/* Pick # */}
      <span
        className="txn-pick-num"
        style={{
          fontFamily: "'Press Start 2P', monospace",
          fontSize: 10,
          color: 'rgba(255,255,255,.4)',
          textAlign: 'center',
        }}
      >
        #{pick.pick ?? '-'}
      </span>

      {/* Team logo + code */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
        <TeamLogo code={pick.team} size={22} />
        <span
          className="txn-team-code"
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: 8,
            color: 'rgba(255,255,255,.7)',
            letterSpacing: 0.5,
          }}
        >
          {pick.team}
        </span>
      </div>

      {/* Position */}
      <div style={{ display: 'flex', justifyContent: 'center' }}>
      <PosBadge pos={pick.player ? pick.pos : '-'} />
      </div>

      {/* Player name */}
      <span
        className="txn-player-name"
        style={{
          fontFamily: "'VT323', monospace",
          fontSize: 22,
          color: 'rgba(255,255,255,.88)',
          letterSpacing: 0.5,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {pick.player || 'PASS'}
      </span>

      {/* Transaction badge */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <TxnBadge
          flag={pick.transaction_flag}
          details={pick.transaction_details}
        />
      </div>
    </div>
  );
}

// ─── Draft By Season ──────────────────────────────────────────────────────
function DraftBySeason({ selectedLeague }) {
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState('');
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch available seasons for this league from draft table
  useEffect(() => {
    if (!selectedLeague) {
      setSeasons([]);
      setSelectedSeason('');
      return;
    }
    const prefix = selectedLeague.replace(/[0-9]/g, '').trim();
    console.log('[Draft] selectedLeague:', selectedLeague, 'prefix:', prefix);
    supabase
      .from('draft')
      .select('lg')
      .ilike('lg', `${prefix}%`)
      .then(({ data, error }) => {
        console.log('[Draft] seasons data:', data, 'error:', error);
        if (error) console.error('[Draft] seasons fetch error:', error.message);
        const codes = [
          ...new Set((data || []).map((r) => r.lg).filter(Boolean)),
        ];
        codes.sort((a, b) => {
          const na = parseInt(a.replace(/\D/g, ''), 10) || 0;
          const nb = parseInt(b.replace(/\D/g, ''), 10) || 0;
          return nb - na;
        });
        setSeasons(codes);
        if (codes.length > 0) setSelectedSeason(codes[0]);
      });
  }, [selectedLeague]);

  // Fetch picks for selected season
  useEffect(() => {
    if (!selectedSeason) {
      setPicks([]);
      return;
    }
    setLoading(true);
    supabase
      .from('draft')
      .select('*')
      .eq('lg', selectedSeason)
      .order('round', { ascending: true })
      .order('pick', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[Draft] season fetch error:', error.message);
        setPicks(data || []);
        setLoading(false);
      });
  }, [selectedSeason]);

  // Group by round
  const byRound = useMemo(() => {
    const map = new Map();
    for (const p of picks) {
      const r = p.round ?? 0;
      if (!map.has(r)) map.set(r, []);
      map.get(r).push(p);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [picks]);

  return (
    <div>
      {/* Season selector */}
      <div className="txn-filter-bar">
        <span className="txn-filter-lbl">SEASON</span>
        <div className="txn-sel-wrap">
          <select
            className="txn-sel"
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(e.target.value)}
            disabled={seasons.length === 0}
          >
            {seasons.length === 0 && <option value="">— NO SEASONS —</option>}
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span className="txn-caret">▾</span>
        </div>
        {picks.length > 0 && (
          <span className="txn-count">
            {picks.length} PICKS · {byRound.length} ROUND
            {byRound.length !== 1 ? 'S' : ''}
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="txn-state">
          <div className="txn-spinner" />
          <span className="txn-state-txt">LOADING DRAFT…</span>
        </div>
      ) : !selectedSeason ? (
        <div className="txn-state">
          <span style={{ fontSize: 40, opacity: 0.18 }}>📋</span>
          <span className="txn-state-txt">SELECT A SEASON</span>
        </div>
      ) : picks.length === 0 ? (
        <div className="txn-state">
          <span style={{ fontSize: 40, opacity: 0.18 }}>📋</span>
          <span className="txn-state-txt">NO DRAFT DATA</span>
          <span className="txn-state-sub">
            No draft records found for {selectedSeason}.
          </span>
        </div>
      ) : (
        <div className="txn-draft-table">
          {/* Column headers */}
          <div
            className="txn-draft-colhdr txn-season-colhdr"
            style={{ gridTemplateColumns: '52px 52px 90px 46px 1fr auto' }}
          >
            <span>RND</span>
            <span>#</span>
            <span>TEAM</span>
            <span>POS</span>
            <span>PLAYER</span>
            <span />
          </div>
          {byRound.map(([round, roundPicks]) => (
            <div key={round}>
              <RoundHeader round={round} pickCount={roundPicks.length} />
              {roundPicks.map((p, i) => (
                <PickRow
                  key={`${p.lg}-${p.round}-${p.pick}-${i}`}
                  pick={p}
                  idx={i}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Draft By Manager ─────────────────────────────────────────────────────
function DraftByManager({ selectedLeague }) {
  const [coaches, setCoaches] = useState([]);
  const [selectedCoach, setSelectedCoach] = useState('');
  const [coachTeams, setCoachTeams] = useState([]);
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(false);
  const prefix = (selectedLeague || '').replace(/[0-9]/g, '').trim();

  // Fetch coaches who have at least one team in this league
  useEffect(() => {
    if (!selectedLeague) {
      setCoaches([]);
      setSelectedCoach('');
      return;
    }
    supabase
      .from('unique_teams_vw')
      .select('coach')
      .ilike('lg', `${prefix}%`)
      .then(({ data, error }) => {
        if (error) console.error('[Draft] coaches fetch error:', error.message);
        const list = [
          ...new Set((data || []).map((r) => r.coach).filter(Boolean)),
        ].sort();
        setCoaches(list);
        if (list.length > 0) setSelectedCoach(list[0]);
      });
  }, [selectedLeague]);

  // When coach changes, fetch all their teams for this league via unique_teams_vw
  useEffect(() => {
    if (!selectedCoach || !prefix) {
      setCoachTeams([]);
      return;
    }
    supabase
      .from('unique_teams_vw')
      .select('abr, lg, team')
      .eq('coach', selectedCoach)
      .ilike('lg', `${prefix}%`)
      .then(({ data, error }) => {
        if (error)
          console.error('[Draft] coachTeams fetch error:', error.message);
        setCoachTeams(data || []);
      });
  }, [selectedCoach, prefix]);

  // Build season -> team info map for logo/name lookup
  const seasonTeamMap = useMemo(() => {
    const m = new Map();
    for (const t of coachTeams) m.set(t.lg, t);
    return m;
  }, [coachTeams]);

  // Fetch draft picks for all team codes this coach has coached
  useEffect(() => {
    if (!selectedCoach || !coachTeams.length) {
      setPicks([]);
      return;
    }
    const abrs = [...new Set(coachTeams.map((t) => t.abr).filter(Boolean))];
    if (!abrs.length) {
      setPicks([]);
      return;
    }
    setLoading(true);
    supabase
      .from('draft')
      .select('*')
      .ilike('lg', `${prefix}%`)
      .in('team', abrs)
      .then(({ data, error }) => {
        if (error) console.error('[Draft] manager picks error:', error.message);
        const sorted = (data || []).sort((a, b) => {
          const na = parseInt((a.lg || '').replace(/\D/g, ''), 10) || 0;
          const nb = parseInt((b.lg || '').replace(/\D/g, ''), 10) || 0;
          if (nb !== na) return nb - na;
          if (a.round !== b.round) return a.round - b.round;
          return (a.pick ?? 0) - (b.pick ?? 0);
        });
        setPicks(sorted);
        setLoading(false);
      });
  }, [coachTeams, selectedCoach, prefix]);

  // Group by season
  const bySeason = useMemo(() => {
    const map = new Map();
    for (const p of picks) {
      if (!map.has(p.lg)) map.set(p.lg, []);
      map.get(p.lg).push(p);
    }
    return [...map.entries()];
  }, [picks]);

  // Most recent team for header
  const latestTeam =
    coachTeams.length > 0
      ? [...coachTeams].sort((a, b) => {
          const na = parseInt((a.lg || '').replace(/\D/g, ''), 10) || 0;
          const nb = parseInt((b.lg || '').replace(/\D/g, ''), 10) || 0;
          return nb - na;
        })[0]
      : null;

  // Unique teams deduplicated by abr, sorted newest first
  const uniqueTeamLogos = useMemo(() => {
    return [...new Map(coachTeams.map((t) => [t.abr, t])).values()].sort(
      (a, b) => {
        const na = parseInt((a.lg || '').replace(/\D/g, ''), 10) || 0;
        const nb = parseInt((b.lg || '').replace(/\D/g, ''), 10) || 0;
        return nb - na;
      }
    );
  }, [coachTeams]);

  return (
    <div>
      {/* Manager selector */}
      <div className="txn-filter-bar">
        <span className="txn-filter-lbl">MANAGER</span>
        <div className="txn-sel-wrap">
          <select
            className="txn-sel"
            value={selectedCoach}
            onChange={(e) => setSelectedCoach(e.target.value)}
            disabled={coaches.length === 0}
            style={{ minWidth: 200 }}
          >
            {coaches.length === 0 && <option value="">— NO MANAGERS —</option>}
            {coaches.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <span className="txn-caret">▾</span>
        </div>
        {picks.length > 0 && (
          <span className="txn-count">
            {picks.length} TOTAL PICKS · {bySeason.length} SEASON
            {bySeason.length !== 1 ? 'S' : ''}
          </span>
        )}
      </div>

      {/* Manager identity header */}
      {selectedCoach && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '.75rem 1.5rem',
            background: 'rgba(0,0,20,.6)',
            borderBottom: '1px solid rgba(255,255,255,.06)',
            flexWrap: 'wrap',
          }}
        >
          {latestTeam && <TeamLogo code={latestTeam.abr} size={36} />}
          <span
            style={{
              fontFamily: "'Press Start 2P', monospace",
              fontSize: 13,
              color: 'rgba(255,255,255,.85)',
              letterSpacing: 2,
            }}
          >
            {selectedCoach}
          </span>
          {uniqueTeamLogos.length > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '.5rem',
                marginLeft: '.5rem',
                flexWrap: 'wrap',
              }}
            >
              <span
                style={{
                  fontFamily: "'VT323', monospace",
                  fontSize: 15,
                  color: 'rgba(255,255,255,.25)',
                }}
              >
                TEAMS:
              </span>
              {uniqueTeamLogos.map((t, i) => (
                <div
                  key={i}
                  title={`${t.team} · ${t.lg}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <TeamLogo code={t.abr} size={24} />
                  <span
                    style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: 6,
                      color: 'rgba(255,255,255,.3)',
                    }}
                  >
                    {t.lg}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="txn-state">
          <div className="txn-spinner" />
          <span className="txn-state-txt">LOADING…</span>
        </div>
      ) : !selectedCoach ? (
        <div className="txn-state">
          <span style={{ fontSize: 40, opacity: 0.18 }}>👔</span>
          <span className="txn-state-txt">SELECT A MANAGER</span>
        </div>
      ) : picks.length === 0 && !loading ? (
        <div className="txn-state">
          <span style={{ fontSize: 40, opacity: 0.18 }}>📋</span>
          <span className="txn-state-txt">NO DRAFT DATA</span>
          <span className="txn-state-sub">
            No draft records found for {selectedCoach}.
          </span>
        </div>
      ) : (
        <div className="txn-draft-table">
          <div
            className="txn-draft-colhdr txn-mgr-colhdr"
            style={{ gridTemplateColumns: '52px 52px 46px 1fr auto' }}
          >
            <span>RND</span>
            <span>#</span>
            <span>POS</span>
            <span>PLAYER</span>
            <span />
          </div>
          {bySeason.map(([season, seasonPicks]) => {
            const teamInfo = seasonTeamMap.get(season);
            return (
              <div key={season}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '.65rem 1.2rem',
                    background:
                      'linear-gradient(90deg, rgba(135,206,235,.1) 0%, rgba(135,206,235,.03) 60%, transparent 100%)',
                    borderLeft: '3px solid rgba(135,206,235,.6)',
                    borderBottom: '1px solid rgba(135,206,235,.12)',
                  }}
                >
                  {teamInfo && <TeamLogo code={teamInfo.abr} size={26} />}
                  <span
                    style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: 11,
                      color: '#87CEEB',
                      letterSpacing: 3,
                      textShadow: '0 0 10px rgba(135,206,235,.4)',
                    }}
                  >
                    {season}
                  </span>
                  {teamInfo && (
                    <span
                      style={{
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: 8,
                        color: 'rgba(255,140,0,.7)',
                        letterSpacing: 1,
                      }}
                    >
                      {teamInfo.abr}
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: "'VT323', monospace",
                      fontSize: 15,
                      color: 'rgba(255,255,255,.25)',
                    }}
                  >
                    {seasonPicks.length} PICK
                    {seasonPicks.length !== 1 ? 'S' : ''}
                  </span>
                </div>
                {seasonPicks.map((p, i) => (
                  <div
                    key={`${p.lg}-${p.round}-${p.pick}-${i}`}
                    className="txn-pick-row txn-mgr-row"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '52px 52px 46px 1fr auto',
                      alignItems: 'center',
                      gap: '0 .5rem',
                      padding: '.38rem 1.2rem',
                      background:
                        i % 2 === 0 ? 'rgba(0,0,22,.75)' : 'rgba(0,0,10,.85)',
                      borderBottom: '1px solid rgba(255,255,255,.04)',
                      transition: 'background .1s',
                      cursor: 'default',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'rgba(255,130,0,.1)')
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background =
                        i % 2 === 0 ? 'rgba(0,0,22,.75)' : 'rgba(0,0,10,.85)')
                    }
                  >
                    <span
                      className="txn-rnd"
                      style={{
                        fontFamily: "'VT323', monospace",
                        fontSize: 20,
                        color: 'rgba(255,140,0,.7)',
                        textAlign: 'center',
                      }}
                    >
                      R{p.round}
                    </span>
                    <span
                      className="txn-pick-num"
                      style={{
                        fontFamily: "'Press Start 2P', monospace",
                        fontSize: 10,
                        color: 'rgba(255,255,255,.4)',
                        textAlign: 'center',
                      }}
                    >
                      #{p.pick ?? '–'}
                    </span>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <PosBadge pos={p.player && p.player.trim() ? p.pos : '-'} />
                    </div>
                    <span
                      className="txn-player-name"
                      style={{
                        fontFamily: "'VT323', monospace",
                        fontSize: 22,
                        color: 'rgba(255,255,255,.88)',
                        letterSpacing: 0.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {p.player && p.player.trim() ? p.player : 'PASS'}
                    </span>
                    <div
                      style={{ display: 'flex', justifyContent: 'flex-end' }}
                    >
                      <TxnBadge
                        flag={p.transaction_flag}
                        details={p.transaction_details}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Transactions page ───────────────────────────────────────────────
export default function Transactions() {
  const { selectedLeague } = useLeague();
  const [mainTab, setMainTab] = useState('draft');
  const [draftView, setDraftView] = useState('season');

  return (
    <div className="txn-page">
      <div className="scanlines" aria-hidden />

      {/* ── Page header ── */}
      <div className="scoreboard-header-container">
        <div className="scoreboard-header">
          <div className="led-text">TRANSACTIONS</div>
        </div>
      </div>

      {/* ── Main tabs: DRAFT / TRADES ── */}
      <div className="txn-main-tabs">
        <div
          style={{
            display: 'flex',
            gap: '.5rem',
            alignItems: 'flex-end',
            flex: 1,
          }}
        >
          <button
            className={`txn-tab ${mainTab === 'draft' ? 'on' : ''}`}
            onClick={() => setMainTab('draft')}
          >
            📋 DRAFT
          </button>
          <button
            className={`txn-tab ${mainTab === 'trades' ? 'on' : ''}`}
            onClick={() => setMainTab('trades')}
          >
            🔄 TRADES
          </button>
        </div>
        <div className="txn-tabs-line" />
      </div>

      {/* ── TRADES placeholder ── */}
      {mainTab === 'trades' && (
        <div className="txn-state" style={{ paddingTop: '5rem' }}>
          <span style={{ fontSize: 48, opacity: 0.18 }}>🔄</span>
          <span className="txn-state-txt">TRADES COMING SOON</span>
          <span className="txn-state-sub">
            Trade history will appear here once data is loaded.
          </span>
        </div>
      )}

      {/* ── DRAFT tab ── */}
      {mainTab === 'draft' && (
        <div>
          {/* Draft view toggle */}
          <div className="txn-view-toggle">
            <button
              className={`txn-view-btn ${draftView === 'season' ? 'on' : ''}`}
              onClick={() => setDraftView('season')}
            >
              BY SEASON
            </button>
            <button
              className={`txn-view-btn ${draftView === 'manager' ? 'on' : ''}`}
              onClick={() => setDraftView('manager')}
            >
              BY TEAM
            </button>
          </div>

          {!selectedLeague ? (
            <div className="txn-state">
              <span style={{ fontSize: 40, opacity: 0.18 }}>🏒</span>
              <span className="txn-state-txt">SELECT A LEAGUE</span>
              <span className="txn-state-sub">
                Choose a league from the menu to view draft history.
              </span>
            </div>
          ) : draftView === 'season' ? (
            <DraftBySeason selectedLeague={selectedLeague} />
          ) : (
            <DraftByManager selectedLeague={selectedLeague} />
          )}
        </div>
      )}

      <style>{`
        *,*::before,*::after { box-sizing: border-box; }
        html { overflow-x: auto; }
        body { background: #00000a !important; overflow-x: auto; }

        .txn-page {
          min-height: 100vh;
          background: radial-gradient(ellipse 100% 35% at 50% 0%, #0a0a22 0%, transparent 55%), #00000a;
          padding-bottom: 80px;
          overflow-x: visible;
        }
        .scanlines {
          position: fixed; inset: 0; pointer-events: none; z-index: 9997;
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,.05) 2px, rgba(0,0,0,.05) 4px);
        }

        /* ── Scoreboard header (shared site style) ── */
        .scoreboard-header-container { display: flex; justify-content: center; margin-bottom: 1rem; }
        .scoreboard-header {
          background: #000; border: 6px solid #333; border-radius: 8px; padding: 1rem 2rem;
          box-shadow: 0 0 0 2px #000, inset 0 0 20px rgba(0,0,0,.8), 0 8px 16px rgba(0,0,0,.5), 0 0 40px rgba(255,215,0,.3);
          position: relative; overflow: hidden;
        }
        .scoreboard-header::before {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: repeating-linear-gradient(0deg,transparent 0px,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px),
                      repeating-linear-gradient(90deg,transparent 0px,transparent 2px,rgba(255,215,0,.03) 2px,rgba(255,215,0,.03) 4px);
        }
        .scoreboard-header::after {
          content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
          background: linear-gradient(45deg, transparent 30%, rgba(255,215,0,.1) 50%, transparent 70%);
          animation: shimmerHdr 3s infinite;
        }
        @keyframes shimmerHdr {
          0% { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
          100% { transform: translateX(100%) translateY(100%) rotate(45deg); }
        }
        .led-text {
          font-family: 'Press Start 2P', monospace; font-size: 2rem; color: #FFD700;
          letter-spacing: 6px; text-shadow: 0 0 10px #FF8C00, 0 0 20px #FF8C00, 0 0 30px #FFD700;
          filter: contrast(1.3) brightness(1.2); position: relative;
        }

        /* ── Main tabs ── */
        .txn-main-tabs {
          display: flex; align-items: flex-end; gap: .5rem;
          padding: 0 2rem; max-width: 1400px; margin: 0 auto;
          position: relative;
        }
        .txn-tabs-line {
          position: absolute; bottom: 0; left: 2rem; right: 2rem;
          height: 2px; background: rgba(255,140,0,.2);
        }
        .txn-tab {
          font-family: 'Press Start 2P', monospace; font-size: 14px; letter-spacing: 2px;
          padding: .8rem 1.6rem;
          background: rgba(255,255,255,.03); border: 2px solid rgba(255,255,255,.1);
          border-bottom: none; border-radius: 10px 10px 0 0;
          color: rgba(255,255,255,.32); cursor: pointer; transition: all .18s;
          position: relative; z-index: 1;
        }
        .txn-tab:hover { background: rgba(255,140,0,.07); color: rgba(255,140,0,.7); border-color: rgba(255,140,0,.3); }
        .txn-tab.on {
          background: rgba(255,140,0,.11); border-color: rgba(255,140,0,.6); color: #FF8C00;
          text-shadow: 0 0 14px rgba(255,140,0,.45);
          margin-bottom: -2px; padding-bottom: calc(.8rem + 2px);
        }

        /* ── Draft view toggle ── */
        .txn-view-toggle {
          display: flex; gap: .5rem; padding: .85rem 2rem;
          background: rgba(0,0,12,.6);
          border-bottom: 1px solid rgba(255,255,255,.06);
          max-width: 1400px; margin: 0 auto;
        }
        .txn-view-btn {
          font-family: 'Press Start 2P', monospace; font-size: 11px; letter-spacing: 2px;
          padding: .5rem 1.2rem;
          background: rgba(255,255,255,.04); border: 1.5px solid rgba(255,255,255,.12);
          border-radius: 6px; color: rgba(255,255,255,.38);
          cursor: pointer; transition: all .14s;
        }
        .txn-view-btn:hover { background: rgba(135,206,235,.09); border-color: rgba(135,206,235,.4); color: rgba(135,206,235,.85); }
        .txn-view-btn.on {
          background: rgba(135,206,235,.14); border-color: #87CEEB;
          color: #87CEEB; text-shadow: 0 0 10px rgba(135,206,235,.4);
        }

        /* ── Filter bar ── */
        .txn-filter-bar {
          display: flex; align-items: center; gap: .75rem;
          padding: .85rem 2rem; flex-wrap: wrap;
          background: rgba(0,0,12,.75);
          border-bottom: 1px solid rgba(255,255,255,.06);
          max-width: 1400px; margin: 0 auto;
        }
        .txn-filter-lbl {
          font-family: 'Press Start 2P', monospace; font-size: 11px;
          color: rgba(255,255,255,.3); letter-spacing: 2px; white-space: nowrap;
        }
        .txn-sel-wrap { position: relative; display: inline-flex; align-items: center; }
        .txn-sel {
          font-family: 'Press Start 2P', monospace; font-size: 12px;
          padding: .5rem 2.2rem .5rem .9rem;
          background: rgba(0,0,20,.85); border: 1.5px solid rgba(255,255,255,.2);
          border-radius: 6px; color: rgba(255,255,255,.78);
          cursor: pointer; appearance: none; -webkit-appearance: none;
          letter-spacing: 1px; transition: border-color .15s; min-width: 140px;
        }
        .txn-sel:hover, .txn-sel:focus { border-color: rgba(255,140,0,.55); outline: none; color: #FF8C00; }
        .txn-sel option { background: #0a0a18; color: #fff; }
        .txn-caret { position: absolute; right: .6rem; font-size: 14px; color: rgba(255,255,255,.4); pointer-events: none; }
        .txn-count {
          font-family: 'Press Start 2P', monospace; font-size: 10px;
          color: rgba(255,255,255,.2); letter-spacing: 1px; margin-left: auto;
        }

        /* ── Draft table ── */
        .txn-draft-table {
          max-width: 1400px; margin: 0 auto;
          border: 1px solid rgba(255,255,255,.07);
          border-top: none;
          border-radius: 0 0 8px 8px;
          overflow: hidden;
        }
        .txn-draft-colhdr {
          display: grid;
          align-items: center;
          gap: 0 .5rem;
          padding: .5rem 1.2rem;
          background: rgba(255,140,0,.08);
          border-bottom: 2px solid rgba(255,140,0,.2);
        }
        .txn-draft-colhdr span {
          font-family: 'Press Start 2P', monospace; font-size: 9px;
          color: rgba(255,255,255,.7); letter-spacing: 2px; text-align: center;
          overflow: hidden; white-space: nowrap;
        }
        /* PLAYER header left-aligned — 4th child on season (RND # TEAM POS PLAYER), 4th on mgr (RND # POS PLAYER) */
        .txn-season-colhdr span:nth-child(5),
        .txn-mgr-colhdr span:nth-child(4) { text-align: left; }

        /* ── Transaction badge tooltip ── */
        .txn-badge-wrap { position: relative; display: flex; align-items: center; }
        .txn-badge--tip::after {
          content: attr(data-tip);
          position: absolute;
          bottom: calc(100% + 8px);
          right: 0;
          left: auto;
          transform: none;
          background: #0a0a18;
          border: 1px solid rgba(255,140,0,.6);
          color: #FF8C00;
          font-family: 'Press Start 2P', monospace;
          font-size: 7px;
          letter-spacing: 1px;
          padding: 6px 9px;
          border-radius: 5px;
          white-space: normal;
          width: 260px;
          line-height: 1.7;
          text-align: left;
          box-shadow: 0 4px 16px rgba(0,0,0,.8);
          z-index: 9999;
          pointer-events: none;
          opacity: 0;
          transition: opacity .15s;
        }
        .txn-badge--tip::before {
          content: '';
          position: absolute;
          bottom: calc(100% + 3px);
          right: 12px;
          left: auto;
          transform: none;
          border: 5px solid transparent;
          border-top-color: rgba(255,140,0,.6);
          z-index: 9999;
          pointer-events: none;
          opacity: 0;
          transition: opacity .15s;
        }
        .txn-badge--tip:hover::after,
        .txn-badge--tip:hover::before { opacity: 1; }

        /* ── States ── */
        .txn-state {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 1rem; padding: 5rem 2rem;
          max-width: 1400px; margin: 0 auto;
        }
        .txn-spinner {
          width: 44px; height: 44px; border-radius: 50%;
          border: 3px solid rgba(255,140,0,.15); border-top-color: #FF8C00;
          animation: spin .8s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .txn-state-txt {
          font-family: 'Press Start 2P', monospace; font-size: 16px;
          color: rgba(255,255,255,.28); letter-spacing: 3px;
        }
        .txn-state-sub {
          font-family: 'VT323', monospace; font-size: 20px;
          color: rgba(255,255,255,.2); text-align: center; max-width: 480px;
        }

        /* ── Responsive ── */
        @media (max-width: 900px) {
          .led-text { font-size: 1.5rem; letter-spacing: 4px; }
          .txn-main-tabs { padding: 0 1.25rem; }
          .txn-tabs-line { left: 1.25rem; right: 1.25rem; }
          .txn-tab { font-size: 12px; padding: .65rem 1.1rem; }
          .txn-filter-bar { padding: .7rem 1.25rem; }
          .txn-view-toggle { padding: .7rem 1.25rem; }
        }
        @media (max-width: 600px) {
          .txn-tab { font-size: 11px; padding: .6rem .9rem; }
          .txn-count { display: none; }
          .led-text { font-size: 1.2rem; letter-spacing: 3px; }

          /* Header labels smaller on mobile */
          .txn-draft-colhdr span { font-size: 7px !important; letter-spacing: 1px !important; }

          /* Hide txn badge and team code text entirely on mobile */
          .txn-badge-wrap { display: none !important; }
          .txn-team-code { display: none !important; }

          /* Tighten padding */
          .txn-pick-row {
            gap: 0 .3rem !important;
            padding-left: .5rem !important;
            padding-right: .5rem !important;
          }
          .txn-draft-colhdr {
            padding-left: .5rem !important;
            padding-right: .5rem !important;
            gap: 0 .3rem !important;
          }

          /* By Season: RND(40) #(40) TEAM-logo(32) POS(36) PLAYER(1fr) */
          .txn-season-colhdr { grid-template-columns: 40px 40px 32px 36px 1fr !important; }
          .txn-season-row    { grid-template-columns: 40px 40px 32px 36px 1fr !important; }

          /* By Manager: RND(40) #(40) POS(36) PLAYER(1fr) */
          .txn-mgr-colhdr    { grid-template-columns: 40px 40px 36px 1fr !important; }
          .txn-mgr-row       { grid-template-columns: 40px 40px 36px 1fr !important; }

          /* Bigger player name on mobile */
          .txn-player-name { font-size: 20px !important; }
          .txn-rnd { font-size: 17px !important; }
          .txn-pick-num { font-size: 9px !important; }
        }
      `}</style>
    </div>
  );
}

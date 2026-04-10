import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const CURRENT_LG = 'W17';

const RankArrow = ({ change }) => {
  if (change === null || change === undefined) return (
    <span className="pr-new">NEW</span>
  );
  if (change === 0) return <span style={{ color: '#888', fontSize: '1rem' }}>—</span>;
  if (change > 0) return <span className="pr-up">▲{change}</span>;
  return <span className="pr-dn">▼{Math.abs(change)}</span>;
};

export default function PowerRankings() {
  const [allRankings, setAllRankings] = useState([]);
  const [rankings, setRankings]       = useState([]);
  const [weeks, setWeeks]             = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [teamLogos, setTeamLogos]     = useState({});

  useEffect(() => {
    async function load() {
      const { data: rankData, error } = await supabase
        .from('power_rankings')
        .select('*')
        .eq('lg', CURRENT_LG)
        .order('week_of', { ascending: false })
        .order('rank',    { ascending: true });

      if (error) { console.error(error); setLoading(false); return; }
      if (!rankData?.length) { setLoading(false); return; }

      const uniqueWeeks = [...new Set(rankData.map(r => r.week_of))];
      setWeeks(uniqueWeeks);
      setAllRankings(rankData);

      const latestWeek = uniqueWeeks[0];
      setSelectedWeek(latestWeek);
      setRankings(rankData.filter(r => r.week_of === latestWeek));

      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('abr, team')
        .eq('lg', CURRENT_LG);

      if (teamsError) console.error('Teams error:', teamsError);

      const logoMap = {};
      for (const t of teamsData || []) {
        logoMap[t.abr] = t;
      }
      setTeamLogos(logoMap);
      setLoading(false);
    }
    load();
  }, []);

  const handleWeekChange = (week) => {
    setSelectedWeek(week);
    setRankings(allRankings.filter(r => r.week_of === week));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const isPlayoff = (r) => r.composite_score > 2.0;

  const getStreakLabel = (r) => {
    if (r.current_streak === null || r.current_streak === undefined) return '—';
    if (r.current_streak === 0) return '—';
    return r.current_streak > 0 ? `W${r.current_streak}` : `L${Math.abs(r.current_streak)}`;
  };

  return (
    <div className="pr">
      <style>{`
        /* ══════════════════════════════════════════════════════
           PAGE
        ══════════════════════════════════════════════════════ */
        .pr {
          padding: 1.5rem 2rem 6rem;
          min-height: 100vh;
          background: radial-gradient(ellipse 130% 30% at 50% 0%, rgba(15,15,40,.95) 0%, transparent 60%), #020208;
        }

        /* ── HEADER ─────────────────────────────────────────── */
        .pr-hw { display: flex; justify-content: center; margin-bottom: 1.8rem; }
        .pr-hb {
          background: #000;
          border: 6px solid #333;
          border-radius: 8px;
          padding: .9rem 2.5rem;
          box-shadow: 0 0 0 2px #000, inset 0 0 20px rgba(0,0,0,.8), 0 8px 16px rgba(0,0,0,.5), 0 0 40px rgba(255,215,0,.28);
          position: relative;
          overflow: hidden;
          background-image:
            repeating-linear-gradient(0deg,   rgba(255,215,0,.03) 0, rgba(255,215,0,.03) 1px, transparent 1px, transparent 4px),
            repeating-linear-gradient(90deg,  rgba(255,215,0,.03) 0, rgba(255,215,0,.03) 1px, transparent 1px, transparent 4px);
        }
        .pr-hb::after {
          content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
          background: linear-gradient(45deg, transparent 30%, rgba(255,215,0,.1) 50%, transparent 70%);
          animation: shimmer 3s infinite; pointer-events: none;
        }
        @keyframes shimmer {
          0%   { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
          100% { transform: translateX(100%)  translateY(100%)  rotate(45deg); }
        }
        .pr-led {
          font-family: 'Press Start 2P', monospace;
          font-size: 1.6rem;
          color: #FFD700;
          letter-spacing: 5px;
          text-shadow: 0 0 10px #FF8C00, 0 0 20px #FF8C00, 0 0 30px #FFD700;
          filter: contrast(1.3) brightness(1.2);
          position: relative; z-index: 1;
        }

        /* ── FILTERS ─────────────────────────────────────────── */
        .pr-fx { display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap; margin-bottom: 1.5rem; }
        .pr-fg { display: flex; flex-direction: column; gap: .4rem; }
        .pr-flbl {
          font-family: 'Press Start 2P', monospace;
          font-size: .6rem;
          color: #FF8C00;
          letter-spacing: 2px;
        }
        .pr-sel {
          background: rgba(5,5,20,.9);
          color: #87CEEB;
          border: 2px solid rgba(135,206,235,.3);
          padding: .55rem 1.1rem;
          font-family: 'VT323', monospace;
          font-size: 1.3rem;
          border-radius: 8px;
          cursor: pointer;
          outline: none;
          min-width: 200px;
          transition: border-color .2s, box-shadow .2s;
        }
        .pr-sel:hover, .pr-sel:focus {
          border-color: #87CEEB;
          box-shadow: 0 0 12px rgba(135,206,235,.2);
        }
        .pr-sel option { background: #0a0a18; }

        /* ── SUBTITLE ────────────────────────────────────────── */
        .pr-sub {
          text-align: center;
          font-family: 'Press Start 2P', monospace;
          font-size: .5rem;
          color: #556;
          letter-spacing: 2px;
          margin-bottom: 1.5rem;
        }

        /* ── RANKINGS LIST ───────────────────────────────────── */
        .pr-list {
          max-width: 860px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: .55rem;
        }

        /* ── RANKING CARD ────────────────────────────────────── */
        .pr-card {
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,.07);
          border-left: 4px solid var(--stripe);
          box-shadow: inset 0 0 50px var(--glow);
          animation: prIn .3s ease both;
        }
        .pr-card.playoff {
          --stripe: #dc2626;
          --glow: rgba(220,38,38,.08);
          border-color: rgba(220,38,38,.3);
        }
        .pr-card.regular {
          --stripe: #334155;
          --glow: rgba(255,255,255,.02);
        }
        @keyframes prIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        .pr-row {
          display: grid;
          grid-template-columns: 52px 40px 48px 1fr auto;
          align-items: center;
          gap: .8rem;
          padding: .85rem 1rem;
        }

        /* Rank number */
        .pr-rank {
          font-family: 'VT323', monospace;
          font-size: 2.8rem;
          line-height: 1;
          text-align: center;
        }
       

        /* Arrow */
        .pr-arrow { text-align: center; }
        .pr-new { color: #FF8C00; font-family: 'Press Start 2P', monospace; font-size: .48rem; letter-spacing: 1px; }
        .pr-up   { color: #00CC55; font-family: 'Press Start 2P', monospace; font-size: .58rem; font-weight: 700; }
        .pr-dn   { color: #ef4444; font-family: 'Press Start 2P', monospace; font-size: .58rem; font-weight: 700; }

        /* Logo */
        .pr-logo { display: flex; align-items: center; justify-content: center; }
        .pr-logo img { width: 38px; height: 38px; object-fit: contain; display: block; }

        /* Team info */
        .pr-info { min-width: 0; }
        .pr-name {
          font-family: 'Press Start 2P', monospace;
          font-size: .65rem;
          color: #f1f5f9;
          letter-spacing: 1px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .pr-playoff-badge {
          display: inline-block;
          font-family: 'Press Start 2P', monospace;
          font-size: .38rem;
          letter-spacing: 1px;
          color: #fca5a5;
          background: rgba(220,38,38,.2);
          border: 1px solid rgba(220,38,38,.4);
          border-radius: 3px;
          padding: 2px 5px;
          margin-left: 6px;
          vertical-align: middle;
        }
        .pr-blurb {
          font-family: 'VT323', monospace;
          font-size: 1.05rem;
         
          margin-top: 3px;
          white-space: normal;
          overflow: visible;
          text-overflow: unset;
          font-style: italic;
        }

        /* Stats */
        .pr-stats { display: flex; gap: 6px; flex-shrink: 0; }
        .pr-pill {
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 4px;
          padding: 3px 10px;
          min-width: 50px;
        }
        .pr-pill.danger {
          background: rgba(220,38,38,.12);
          border-color: rgba(220,38,38,.35);
        }
        .pr-pill.win    { background: rgba(0,204,85,.12);  border-color: rgba(0,204,85,.35); }
        .pr-pill.win .pr-pill-val  { color: #00CC55; }
        .pr-pill.neutral .pr-pill-val { color: #888; }
        .pr-pill-lbl {
          font-family: 'Press Start 2P', monospace;
          font-size: .42rem;
          color: #556;
          letter-spacing: 1px;
          text-transform: uppercase;
        }
        .pr-pill-val {
          font-family: 'VT323', monospace;
          font-size: 1.3rem;
          color: #e2e8f0;
          line-height: 1.1;
        }
        .pr-pill.danger .pr-pill-val { color: #f87171; }

        /* ── LOADING / EMPTY ─────────────────────────────────── */
        .pr-loading {
          display: flex; gap: 8px; align-items: center;
          justify-content: center; padding: 5rem;
        }
        .dot {
          display: inline-block; width: 8px; height: 8px; border-radius: 50%;
          background: #FF8C00; animation: dotP 1.2s ease-in-out infinite;
        }
        .dot:nth-child(2) { animation-delay: .15s; }
        .dot:nth-child(3) { animation-delay: .3s;  }
        @keyframes dotP { 0%,100%{opacity:.15} 50%{opacity:1} }
        .pr-empty {
          text-align: center;
          font-family: 'Press Start 2P', monospace;
          font-size: .75rem;
          color: rgba(255,255,255,.15);
          padding: 5rem;
          letter-spacing: 2px;
        }

        /* ── FOOTER ──────────────────────────────────────────── */
        .pr-footer {
          text-align: center;
          margin-top: 1.5rem;
          font-family: 'Press Start 2P', monospace;
          font-size: .42rem;
          color: #1e293b;
          letter-spacing: 1.5px;
          line-height: 2;
          max-width: 860px;
          margin-left: auto;
          margin-right: auto;
        }

        /* ══════════════════════════════════════════════════════
           RESPONSIVE
        ══════════════════════════════════════════════════════ */
        @media (max-width: 640px) {
          .pr { padding: 1rem .6rem 4rem; }
          .pr-led { font-size: 1.1rem; letter-spacing: 3px; }
          .pr-sel { min-width: 160px; font-size: 1.1rem; padding: .45rem .7rem; }

          .pr-row {
            grid-template-columns: 52px 40px 48px 1fr auto;
            align-items: start;
            gap: .45rem;
            padding: .7rem .6rem;
          }
          .pr-rank     { font-size: 2rem; }
          .pr-logo img { width: 30px; height: 30px; }
          .pr-name     { font-size: .52rem; }
          .pr-blurb    { display: none; }
          .pr-pill     { min-width: 38px; padding: 2px 6px; }
          .pr-pill-lbl { font-size: .36rem; }
          .pr-pill-val { font-size: 1.1rem; }
          .pr-new, .pr-up, .pr-dn { font-size: .42rem; }
        }
      `}</style>

      {/* ── HEADER ── */}
      <div className="pr-hw">
        <div className="pr-hb">
          <div className="pr-led">POWER RANKINGS</div>
        </div>
      </div>

      {/* ── WEEK SELECTOR ── */}
      <div className="pr-fx">
        <div className="pr-fg">
          <span className="pr-flbl">WEEK OF</span>
          <select
            className="pr-sel"
            value={selectedWeek || ''}
            onChange={e => handleWeekChange(e.target.value)}
            disabled={weeks.length === 0}
          >
            {weeks.map((w, i) => (
              <option key={w} value={w} style={{ background: '#0a0a18' }}>
                {formatDate(w)}{i === 0 ? '  [LATEST]' : ''}
              </option>
            ))}
            {weeks.length === 0 && <option value="">NO DATA YET</option>}
          </select>
        </div>
      </div>

      <div className="pr-sub">RESETS EVERY MONDAY AT 5AM</div>

      {/* ── CONTENT ── */}
      {loading ? (
        <div className="pr-loading">
          <span className="dot" /><span className="dot" /><span className="dot" />
        </div>
      ) : !rankings.length ? (
        <div className="pr-empty">NO RANKINGS GENERATED YET</div>
      ) : (
        <>
          <div className="pr-list">
            {rankings.map((r, i) => {
              const playoff    = isPlayoff(r);
              const team       = teamLogos[r.team_code];
              const streakLbl  = getStreakLabel(r);
              const rankClass  = r.rank === 1 ? 'gold' : r.rank <= 3 ? 'silver' : 'rest';
              const streakClass = r.current_streak < 0 ? 'danger'
                  : r.current_streak > 0 ? 'win'
                  : 'neutral';  

              return (
                <div
                  key={r.id}
                  className={`pr-card ${playoff ? 'playoff' : 'regular'}`}
                  style={{ animationDelay: `${i * 0.04}s` }}
                >
                  <div className="pr-row">

                    {/* Rank */}
                    <div className={`pr-rank ${rankClass}`}>{r.rank}</div>

                    {/* Arrow */}
                    <div className="pr-arrow">
                      <RankArrow change={r.rank_change} />
                    </div>

                    {/* Logo */}
                    <div className="pr-logo">
                      <img
                        src={`/assets/teamLogos/${r.team_code}.png`}
                        alt={r.team_code}
                        onError={e => { e.currentTarget.style.opacity = '0'; }}
                      />
                    </div>

                    {/* Team name + blurb */}
                    <div className="pr-info">
                      <div className="pr-name">
                        {team?.team || r.team_code}
                        {playoff && <span className="pr-playoff-badge">PLAYOFFS</span>}
                      </div>
                      {r.blurb && (
                        <div className="pr-blurb">{r.blurb}</div>
                      )}
                    </div>

                    {/* Stat pills */}
                    <div className="pr-stats">
                      <div className="pr-pill">
                        <span className="pr-pill-lbl">WEEK</span>
                        <span className="pr-pill-val">{r.recent_record || '—'}</span>
                      </div>
                      <div className={`pr-pill ${streakClass}`}>
                        <span className="pr-pill-lbl">STK</span>
                        <span className="pr-pill-val">{streakLbl}</span>
                      </div>
                    </div>

                  </div>
                </div>
              );
            })}
          </div>

          <div className="pr-footer">
            SEASON STANDING 40% · RECENT RECORD 30% · GOAL DIFF 20% · STREAK 10%
            <br />
            PLAYOFF TEAMS RECEIVE AUTOMATIC BOOST ABOVE NON-PLAYOFF TEAMS
          </div>
        </>
      )}
    </div>
  );
}

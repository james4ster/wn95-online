import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from './LeagueContext';

const lgPrefix = lg => (lg || '').replace(/[0-9]/g, '').trim();

const LEAGUE_CFG = {
  W: { label: 'WN95',    color: '#87CEEB', glow: 'rgba(135,206,235,.45)' },
  Q: { label: 'THE Q',   color: '#FFD700', glow: 'rgba(255,215,0,.45)'   },
  V: { label: 'VINTAGE', color: '#FF6B35', glow: 'rgba(255,107,53,.45)'  },
};

// ─── DefendingChampion ────────────────────────────────────────────────────────
// Add this to MainNavigation.jsx right after the discord-btn:
//   import DefendingChampion from './DefendingChampion';
//   ...
//   <DefendingChampion />   ← after discord button in nav-links div
export default function DefendingChampion() {
  const { selectedLeague } = useLeague();
  const [champ, setChamp]   = useState(null);
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedLeague) return;
    setLoading(true);
    setChamp(null);

    (async () => {
      // Find most recent season for this league prefix
      const { data: seasons } = await supabase
        .from('seasons')
        .select('lg, end_date, year')
        .order('year', { ascending: false })
        .limit(20);

      const prefixSeasons = (seasons || []).filter(
        s => lgPrefix(s.lg) === selectedLeague
      );
      if (!prefixSeasons.length) { setLoading(false); return; }

      // Most recent by end_date
      const latestSeason = prefixSeasons.reduce((best, s) =>
        new Date(s.end_date) > new Date(best.end_date) ? s : best
      );

      // Find the #1 ranked team in that season
      const { data: standingRows } = await supabase
        .from('standings')
        .select('team, season, season_rank')
        .eq('season', latestSeason.lg)
        .eq('season_rank', 1)
        .limit(1);

      const champRow = standingRows?.[0];
      if (champRow) {
        setChamp(champRow.team);
        setSeason(champRow.season);
      }
      setLoading(false);
    })();
  }, [selectedLeague]);

  const cfg = LEAGUE_CFG[selectedLeague] ?? { label: selectedLeague, color: '#aaa', glow: 'rgba(170,170,170,.3)' };

  // Don't render anything while loading or if no champ found
  if (loading || !champ) return null;

  return (
    <>
      <div className="dc-wrap" style={{ '--dc': cfg.color, '--dcg': cfg.glow }}>
        {/* Banner ribbon in top-left */}
        <div className="dc-ribbon">
          <span className="dc-ribbon-txt">🏆</span>
        </div>

        {/* Team logo */}
        <div className="dc-logo-wrap">
          <img
            src={`/assets/teamLogos/${champ}.png`}
            alt={champ}
            className="dc-logo"
            onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextElementSibling.style.display='flex'; }}
          />
          <div className="dc-logo-fb">{champ.slice(0, 3)}</div>
        </div>

        {/* Text stack */}
        <div className="dc-text">
          <span className="dc-league">{cfg.label}</span>
          <span className="dc-team">{champ}</span>
          <span className="dc-season">{season}</span>
        </div>

        {/* Subtle animated glow ring around the whole badge */}
        <div className="dc-glow" />
      </div>

      <style>{`
        /* ══ DEFENDING CHAMPION BADGE ════════════════════════════════════════ */
        .dc-wrap {
          position: relative;
          display: flex;
          align-items: center;
          gap: .45rem;
          padding: .4rem .7rem .4rem .5rem;
          background: linear-gradient(135deg,
            color-mix(in srgb, var(--dc) 8%, #0a0a1e) 0%,
            rgba(5,5,15,.9) 100%);
          border: 1px solid color-mix(in srgb, var(--dc) 40%, transparent);
          border-radius: 8px;
          cursor: default;
          overflow: hidden;
          margin-left: .5rem;
          transition: border-color .3s, box-shadow .3s;
          min-width: 0;
        }
        .dc-wrap:hover {
          border-color: color-mix(in srgb, var(--dc) 70%, transparent);
          box-shadow: 0 0 18px var(--dcg), inset 0 0 12px color-mix(in srgb, var(--dc) 5%, transparent);
        }

        /* Championship ribbon tab — top-left corner */
        .dc-ribbon {
          position: absolute;
          top: 0; left: 0;
          width: 22px; height: 22px;
          background: linear-gradient(135deg, var(--dc), color-mix(in srgb, var(--dc) 60%, #000));
          clip-path: polygon(0 0, 100% 0, 0 100%);
          display: flex;
          align-items: flex-start;
          justify-content: flex-start;
          padding: 1px 0 0 2px;
        }
        .dc-ribbon-txt { font-size: .55rem; line-height: 1; filter: brightness(0) invert(1); opacity: .85; }

        /* Team logo */
        .dc-logo-wrap { position: relative; width: 32px; height: 32px; flex-shrink: 0; }
        .dc-logo {
          width: 32px; height: 32px; object-fit: contain;
          filter: drop-shadow(0 0 6px var(--dcg));
          transition: filter .3s;
        }
        .dc-wrap:hover .dc-logo { filter: drop-shadow(0 0 10px var(--dcg)) brightness(1.1); }
        .dc-logo-fb {
          position: absolute; inset: 0;
          display: none; align-items: center; justify-content: center;
          background: color-mix(in srgb, var(--dc) 15%, rgba(0,0,0,.5));
          border: 1px solid color-mix(in srgb, var(--dc) 30%, transparent);
          border-radius: 4px;
          font-family: 'Press Start 2P', monospace; font-size: .26rem;
          color: var(--dc);
        }

        /* Text */
        .dc-text {
          display: flex; flex-direction: column; gap: .04rem; min-width: 0;
        }
        .dc-league {
          font-family: 'Press Start 2P', monospace; font-size: .28rem;
          color: color-mix(in srgb, var(--dc) 70%, rgba(255,255,255,.4));
          letter-spacing: 1px; line-height: 1;
        }
        .dc-team {
          font-family: 'Press Start 2P', monospace; font-size: .42rem;
          color: var(--dc);
          text-shadow: 0 0 8px var(--dcg);
          letter-spacing: .5px; line-height: 1;
          white-space: nowrap;
        }
        .dc-season {
          font-family: 'VT323', monospace; font-size: .82rem;
          color: rgba(255,255,255,.3);
          line-height: 1;
        }

        /* Subtle shimmer sweep on load */
        .dc-glow {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(105deg,
            transparent 40%,
            color-mix(in srgb, var(--dc) 6%, transparent) 50%,
            transparent 60%);
          animation: dcShimmer 4s ease-in-out infinite;
        }
        @keyframes dcShimmer {
          0%,100% { opacity: 0; transform: translateX(-100%); }
          50%      { opacity: 1; transform: translateX(100%); }
        }

        @media (max-width: 768px) {
          .dc-text { display: none; }
          .dc-wrap { padding: .4rem .45rem; margin-left: .25rem; }
          .dc-ribbon { width: 18px; height: 18px; }
        }
      `}</style>
    </>
  );
}
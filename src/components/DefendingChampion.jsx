// DefendingChampion.jsx
// Rendered inside ScoresBar on the far right — not a fixed overlay.
// Shows: league logo | waving banner fabric with trophy + team logo + season
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';
import { useLeague } from './LeagueContext';

const lgPrefix = lg => (lg || '').replace(/[0-9]/g, '').trim();

export const LEAGUE_CFG = {
  W: { label: 'WN95',    color: '#87CEEB', glow: 'rgba(135,206,235,.6)',  trophy: '/assets/awards/w_champ.png', leagueLogo: '/assets/leagueLogos/wn95.png'    },
  Q: { label: 'THE Q',   color: '#FFD700', glow: 'rgba(255,215,0,.6)',    trophy: '/assets/awards/q_champ.png', leagueLogo: '/assets/leagueLogos/theq.png'    },
  V: { label: 'VINTAGE', color: '#FF6B35', glow: 'rgba(255,107,53,.6)',   trophy: null,                         leagueLogo: '/assets/leagueLogos/vintage.png' },
};

export default function DefendingChampion() {
  const { selectedLeague } = useLeague();
  const [champ,   setChamp]   = useState(null);
  const [season,  setSeason]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [logoIn,  setLogoIn]  = useState(false);

  useEffect(() => {
    if (!selectedLeague) return;
    setLoading(true); setChamp(null); setSeason(null); setLogoIn(false);
    (async () => {
      const { data: seasons } = await supabase
        .from('seasons').select('lg, end_date, year')
        .order('year', { ascending: false }).limit(20);
      const ps = (seasons || []).filter(s => lgPrefix(s.lg) === selectedLeague);
      if (!ps.length) { setLoading(false); return; }
      const latest = ps.reduce((b, s) =>
        new Date(s.end_date) > new Date(b.end_date) ? s : b);
      const { data: rows } = await supabase
        .from('standings').select('team, season, season_rank')
        .eq('season', latest.lg).eq('season_rank', 1).limit(1);
      if (rows?.[0]) { setChamp(rows[0].team); setSeason(rows[0].season); }
      setLoading(false);
    })();
  }, [selectedLeague]);

  const cfg = LEAGUE_CFG[selectedLeague] ??
    { label: selectedLeague, color: '#aaa', glow: 'rgba(170,170,170,.3)', trophy: null, leagueLogo: null };

  // Render a placeholder skeleton while loading so the bar doesn't jump
  if (loading) {
    return (
      <div className="dc-shell dc-loading" style={{ '--dc': '#87CEEB', '--dcg': 'rgba(135,206,235,.3)' }}>
        <div className="dc-skel dc-skel-banner" />
      </div>
    );
  }

  if (!champ) return null;

  return (
    <>
      <div className="dc-shell" style={{ '--dc': cfg.color, '--dcg': cfg.glow }}>

        {/* ── Waving banner — team banner image as background ── */}
        <div className="dc-shell dc-with-trophy" style={{ '--dc': cfg.color, '--dcg': cfg.glow }}>

        {/* Trophy outside the banner */}
        {cfg.trophy && (
          <img
            src={cfg.trophy}
            alt="trophy"
            className="dc-trophy-left"
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
        )}

        {/* ── Waving banner — team banner image as background ── */}
        <div className="dc-banner-wrap">
          <img
            src={`/assets/banners/${champ}.png`}
            alt={champ}
            className="dc-banner-img"
            onError={e => { e.currentTarget.style.display = 'none'; }}
          />
          <div className="dc-banner-tint" />
          <div className="dc-fabric">
            <span className="dc-fold f1" />
            <span className="dc-fold f2" />
            <span className="dc-fold f3" />
            <span className="dc-shimmer" />
          </div>

          {/* Banner content: team logo + season */}
          <div className="dc-banner-inner">
            <div className="dc-team-logo-ring">
              <img
                src={`/assets/teamLogos/${champ}.png`}
                alt={champ}
                className={`dc-team-logo ${logoIn ? 'dc-logo-in' : ''}`}
                onLoad={() => setLogoIn(true)}
                onError={e => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling.style.display = 'flex';
                }}
              />
              <div className="dc-logo-fb">{champ.slice(0, 3)}</div>
            </div>

            <div className="dc-text-stack">
              <span className="dc-champ-label">CHAMP</span>
              <span className="dc-season-label">{season}</span>
      </div>
    </div>
  </div>
</div>
      </div>

      <style>{`
        /* ══ DEFENDING CHAMP — lives inside ScoresBar flex row ═══════════════ */
        .dc-shell {
          display: flex;
          align-items: center;
          flex-shrink: 0;
          padding: .2rem .65rem .2rem .45rem;
          border-left: 1px solid color-mix(in srgb, var(--dc) 28%, transparent);
        }
        /* Ensure the shell aligns items horizontally */
          .dc-shell.dc-with-trophy {
            display: flex;
            align-items: center;
            gap: 6px; /* space between trophy and banner */
          }

          /* Trophy positioned to the left of banner */
          .dc-trophy-left {
            width: 68px;
            height: 68px;
            object-fit: contain;
            filter: drop-shadow(0 1px 5px rgba(0,0,0,.8)) brightness(1.1);
            animation: trophyFloat 4.2s ease-in-out infinite;
            flex-shrink: 0;
          }

        /* Loading skeleton */
        .dc-loading { opacity: .2; pointer-events: none; }
        .dc-skel {
          background: linear-gradient(90deg,
            rgba(255,255,255,.04) 0%, rgba(255,255,255,.09) 50%, rgba(255,255,255,.04) 100%);
          background-size: 200% 100%;
          animation: dcSkelShimmer 1.6s infinite;
          border-radius: 6px;
        }
        .dc-skel-banner { width: 170px; height: 68px; }
        @keyframes dcSkelShimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }

        /* ── Banner wrapper  ── */
        .dc-banner-wrap {
          position: relative;
          width: 250px;
          height: 72px;
          flex-shrink: 0;
          border-radius: 7px;
          overflow: hidden;
          border: none
          box-shadow:
            0 0 14px color-mix(in srgb, var(--dc) 18%, transparent),
            inset 0 0 10px rgba(0,0,0,.3);
        }
        .dc-banner-wrap:hover {
          box-shadow:
            0 0 22px color-mix(in srgb, var(--dc) 32%, transparent),
            inset 0 0 10px rgba(0,0,0,.3);
        }

        /* Team banner image — fills background */
        .dc-banner-img {
          position: absolute;
          top: 50%;             /* start in the middle of container */
          left: 0;
          width: 100%;          /* fill width */
          height: auto;         /* preserve aspect ratio */
          max-height: 100%;     /* don’t overflow vertically */
          transform: translateY(-50%);  /* truly center vertically */
          object-fit: cover;    /* cover horizontally */
          object-position: center; /* center image inside its own box */
        }

        /* Colour tint overlay — blends league colour lightly over banner */
        .dc-banner-tint {
          position: absolute; inset: 0;
          background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--dc) 22%, transparent) 0%,
            rgba(0,0,0,.42) 100%
          );
          mix-blend-mode: multiply;
        }

        /* Waving fold layers */
        .dc-fabric {
          position: absolute; inset: 0;
          overflow: hidden;
          pointer-events: none;
        }
        .dc-fold {
          position: absolute;
          left: -20%; width: 140%;
          height: 7px;
          background: linear-gradient(180deg,
            rgba(255,255,255,.09) 0%, transparent 50%, rgba(0,0,0,.06) 100%);
          border-radius: 50%;
          transform-origin: center;
        }
        .f1 { top: 18%; animation: bannerWave 3.4s ease-in-out infinite 0s; }
        .f2 { top: 52%; animation: bannerWave 3.4s ease-in-out infinite .44s; opacity: .65; }
        .f3 { top: 82%; animation: bannerWave 3.4s ease-in-out infinite .88s; opacity: .4; }

        @keyframes bannerWave {
          0%   { transform: scaleY(1)   translateX(0px)  skewX(0deg); }
          20%  { transform: scaleY(1.5) translateX(6px)  skewX(.8deg); }
          50%  { transform: scaleY(.6)  translateX(-5px) skewX(-.8deg); }
          78%  { transform: scaleY(1.3) translateX(4px)  skewX(.4deg); }
          100% { transform: scaleY(1)   translateX(0px)  skewX(0deg); }
        }

        .dc-shimmer {
          position: absolute; inset: 0;
          background: linear-gradient(
            108deg,
            transparent 28%,
            rgba(255,255,255,.18) 46%,
            rgba(255,255,255,.05) 54%,
            transparent 66%
          );
          animation: bannerShimmer 5.2s ease-in-out infinite;
        }
        @keyframes bannerShimmer {
          0%,100% { transform: translateX(-115%); opacity: 0; }
          30%      { opacity: 1; }
          70%      { opacity: 1; }
          50%      { transform: translateX(115%); opacity: 1; }
        }

        /* Content over the banner */
        .dc-banner-inner {
          position: absolute; inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: .5rem;
          padding: 0 .65rem;
          z-index: 2;
        }

        /* Trophy */
        .dc-trophy {
          width: 34px; height: 34px;
          object-fit: contain;
          flex-shrink: 0;
          filter: drop-shadow(0 1px 5px rgba(0,0,0,.8)) brightness(1.1);
          animation: trophyFloat 4.2s ease-in-out infinite;
        }
        @keyframes trophyFloat {
          0%,100% { transform: translateY(0); }
          45%      { transform: translateY(-2.5px); }
        }

        /* Team logo ring */
        .dc-team-logo-ring {
          position: relative;
          width: 46px; height: 46px;
          flex-shrink: 0;
        }
        .dc-team-logo-ring::before {
          content: '';
          position: absolute; inset: -2px;
          border-radius: 50%;
          border: 2px solid rgba(0,0,0,.5);
          box-shadow: 0 0 8px rgba(0,0,0,.6), inset 0 0 5px rgba(0,0,0,.4);
        }
        .dc-team-logo {
          width: 46px; height: 46px;
          object-fit: contain; display: block;
          opacity: 0; transform: scale(.72);
          transition: opacity .5s ease, transform .5s ease;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,.75));
          border-radius: 50%;
        }
        .dc-logo-in { opacity: 1 !important; transform: scale(1) !important; }
        .dc-logo-fb {
          position: absolute; inset: 0;
          display: none; align-items: center; justify-content: center;
          background: rgba(0,0,0,.55); border-radius: 50%;
          font-family: 'Press Start 2P', monospace; font-size: .22rem;
          color: rgba(255,255,255,.6);
        }

        /* Text labels */
        .dc-text-stack {
          display: flex; flex-direction: column;
          align-items: flex-start; gap: .06rem;
        }
        .dc-champ-label {
          font-family: 'Press Start 2P', monospace;
          font-size: .28rem;
          color: rgba(255,255,255,.55);
          text-shadow: 0 1px 3px rgba(0,0,0,.8);
          letter-spacing: 1px; line-height: 1;
        }
        .dc-season-label {
          font-family: 'Press Start 2P', monospace;
          font-size: .42rem;
          color: #fff;
          text-shadow: 0 1px 4px rgba(0,0,0,.9),
                       0 0 8px color-mix(in srgb, var(--dc) 60%, transparent);
          letter-spacing: .5px; line-height: 1;
        }

        /* ── Mobile ── */
        @media (max-width: 900px) {
          .dc-banner-wrap { width: 140px; height: 60px; }
          .dc-trophy { width: 26px; height: 26px; }
          .dc-team-logo, .dc-team-logo-ring { width: 36px; height: 36px; }
        }
        @media (max-width: 600px) {
          .dc-text-stack { display: none; }
          .dc-banner-wrap { width: 110px; height: 54px; }
          .dc-trophy { width: 20px; height: 20px; }
          .dc-team-logo, .dc-team-logo-ring { width: 28px; height: 28px; }
        }
        /* Hide the banner on small screens, keep team logo + trophy visible */
        @media (max-width: 600px) {
          .dc-banner-wrap {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabaseClient';

const CURRENT_LG = 'W17';

const RankArrow = ({ change }) => {
  if (change === null || change === undefined) return (
    <span style={{ color: '#666', fontSize: '0.75rem', fontFamily: 'Barlow Condensed, sans-serif' }}>NEW</span>
  );
  if (change === 0) return <span style={{ color: '#888', fontSize: '1rem' }}>—</span>;
  if (change > 0) return (
    <span style={{ color: '#22c55e', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>
      ▲{change}
    </span>
  );
  return (
    <span style={{ color: '#ef4444', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>
      ▼{Math.abs(change)}
    </span>
  );
};

const StatPill = ({ label, value, highlight }) => (
  <span style={{
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: highlight ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.05)',
    border: `1px solid ${highlight ? 'rgba(220,38,38,0.4)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: '4px',
    padding: '3px 10px',
    minWidth: '48px',
  }}>
    <span style={{ fontSize: '0.7rem', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
    <span style={{ fontSize: '0.95rem', color: highlight ? '#f87171' : '#e2e8f0', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>{value}</span>
  </span>
);

export default function PowerRankings() {
  const [rankings, setRankings] = useState([]);
  const [weekOf, setWeekOf] = useState(null);
  const [loading, setLoading] = useState(true);
  const [teamLogos, setTeamLogos] = useState({});

  useEffect(() => {
    async function load() {
      // Fetch latest week's rankings
      const { data: rankData, error } = await supabase
        .from('power_rankings')
        .select('*')
        .eq('lg', CURRENT_LG)
        .order('week_of', { ascending: false })
        .order('rank', { ascending: true })
        .limit(100);

      if (error) { console.error(error); setLoading(false); return; }
      if (!rankData?.length) { setLoading(false); return; }

      // Only show the most recent week
      const latestWeek = rankData[0].week_of;
      const latest = rankData.filter(r => r.week_of === latestWeek);
      setWeekOf(latestWeek);

      // Fetch team info for logos
      const { data: teamsData } = await supabase
        .from('teams')
        .select('team_code, team, abr')
        .eq('lg', CURRENT_LG);

      const logoMap = {};
      for (const t of teamsData || []) {
        logoMap[t.team_code] = t;
      }
      setTeamLogos(logoMap);
      setRankings(latest);
      setLoading(false);
    }
    load();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const isPlayoff = (r) => r.composite_score > 2.0;

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
      <div style={{ color: '#888', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', fontSize: '1rem' }}>
        LOADING POWER RANKINGS...
      </div>
    </div>
  );

  if (!rankings.length) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
      <div style={{ color: '#666', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '1rem' }}>
        No rankings generated yet. Check back Monday.
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: '24px 16px' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{
          fontFamily: 'Barlow Condensed, sans-serif',
          fontSize: '2rem',
          fontWeight: 800,
          letterSpacing: '0.08em',
          color: '#f1f5f9',
          textTransform: 'uppercase',
        }}>
          ⚡ WN95HL Power Rankings
        </div>
        {weekOf && (
          <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '4px', letterSpacing: '0.05em' }}>
            Updated {formatDate(weekOf)} · Resets every Monday at 5am
          </div>
        )}
      </div>

      {/* Rankings list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {rankings.map((r) => {
          const playoff = isPlayoff(r);
          const team = teamLogos[r.team_code];
          const streakLabel = r.streak_score !== null
            ? (() => {
                // Reconstruct approximate streak from score: (score - 0.5) / 0.1
                const raw = Math.round((r.streak_score - 0.5) / 0.1);
                if (raw === 0) return '—';
                return raw > 0 ? `W${raw}` : `L${Math.abs(raw)}`;
              })()
            : '—';

          return (
            <div key={r.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              background: playoff
                ? 'linear-gradient(135deg, rgba(30,10,10,0.95) 0%, rgba(40,15,15,0.95) 100%)'
                : 'rgba(15,15,20,0.85)',
              border: playoff
                ? '1px solid rgba(220,38,38,0.35)'
                : '1px solid rgba(255,255,255,0.07)',
              borderRadius: '8px',
              padding: '14px 16px',
              position: 'relative',
              overflow: 'hidden',
            }}>

              {/* Playoff accent bar */}
              {playoff && (
                <div style={{
                  position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px',
                  background: 'linear-gradient(180deg, #dc2626, #7f1d1d)',
                }} />
              )}

              {/* Rank number */}
              <div style={{
                minWidth: '36px',
                textAlign: 'center',
                fontFamily: 'Barlow Condensed, sans-serif',
                fontSize: r.rank <= 9 ? '2rem' : '1.6rem',
                fontWeight: 900,
                color: r.rank === 1 ? '#fbbf24' : r.rank <= 3 ? '#94a3b8' : '#475569',
                lineHeight: 1,
              }}>
                {r.rank}
              </div>

              {/* Arrow */}
              <div style={{ minWidth: '32px', textAlign: 'center' }}>
                <RankArrow change={r.rank_change} />
              </div>

              {/* Team logo */}
              <div style={{ minWidth: '40px', textAlign: 'center' }}>
                <img
                  src={`/assets/teamLogos/${r.team_code}.png`}
                  alt={r.team_code}
                  style={{ width: '36px', height: '36px', objectFit: 'contain' }}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>

              {/* Team name + blurb */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontFamily: 'Barlow Condensed, sans-serif',
                    fontWeight: 700,
                    fontSize: '1.05rem',
                    color: '#f1f5f9',
                    letterSpacing: '0.03em',
                  }}>
                    {team?.team || r.team_code}
                  </span>
                  {playoff && (
                    <span style={{
                      fontSize: '0.6rem',
                      fontFamily: 'Barlow Condensed, sans-serif',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      color: '#fca5a5',
                      background: 'rgba(220,38,38,0.2)',
                      border: '1px solid rgba(220,38,38,0.4)',
                      borderRadius: '3px',
                      padding: '1px 5px',
                    }}>
                      🏒 PLAYOFFS
                    </span>
                  )}
                </div>
                {r.blurb && (
                  <div style={{
                    color: '#64748b',
                    fontSize: '0.8rem',
                    fontStyle: 'italic',
                    marginTop: '3px',
                    fontFamily: 'Barlow Condensed, sans-serif',
                    letterSpacing: '0.02em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    "{r.blurb}"
                  </div>
                )}
              </div>

              {/* Stat pills */}
              <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <StatPill
                  label="Week"
                  value={`${r.games_played_week > 0 ? `${Math.round(r.recent_score * r.games_played_week)}-${Math.round((1 - r.recent_score) * r.games_played_week)}` : '—'}`}
                />
                <StatPill label="STK" value={streakLabel} highlight={streakLabel.startsWith('L')} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div style={{
        textAlign: 'center',
        marginTop: '20px',
        color: '#334155',
        fontSize: '0.75rem',
        fontFamily: 'Barlow Condensed, sans-serif',
        letterSpacing: '0.04em',
      }}>
        Rankings weighted: Season standing 40% · Recent record 30% · Goal diff 20% · Streak 10%
        <br />Playoff teams receive automatic boost above non-playoff teams.
      </div>
    </div>
  );
}

import React, { useRef, useState, useLayoutEffect, useCallback } from 'react';

/* ═══════════════════════════════════════════════════════════════
   SEED BRACKET MATH
═══════════════════════════════════════════════════════════════ */
const FIRST_ROUND_PAIRS = {
  2:  [[1,2]],
  4:  [[1,4],[2,3]],
  8:  [[1,8],[4,5],[3,6],[2,7]],
  16: [[1,16],[8,9],[4,13],[5,12],[6,11],[3,14],[7,10],[2,15]],
};

function bracketSize(n) {
  for (const s of [2,4,8,16]) if (n <= s) return s;
  return 16;
}

function buildBracket(playoffGames, numTeams) {
  const size   = bracketSize(numTeams || 8);
  const pairs  = FIRST_ROUND_PAIRS[size];
  const nR     = Math.log2(size);

  const byRound = new Map();
  (playoffGames || []).forEach(g => {
    const r = g.round;
    if (!byRound.has(r)) byRound.set(r, new Map());
    const rMap = byRound.get(r);
    const addTo = (key) => {
      if (!rMap.has(key)) rMap.set(key, []);
      if (!rMap.get(key).find(x => x.game_number === g.game_number && x.team_code_a === g.team_code_a)) {
        rMap.get(key).push(g);
      }
    };
    if (g.series_number != null) addTo(g.series_number);
    if (g.team_code_a && g.team_code_b) {
      addTo(`${g.team_code_a}-${g.team_code_b}`);
      addTo(`${g.team_code_b}-${g.team_code_a}`);
    }
  });
  byRound.forEach(rMap => {
    rMap.forEach((games, k) => {
      rMap.set(k, games.sort((a,b) => (a.game_number ?? 0) - (b.game_number ?? 0)));
    });
  });

  function getGames(round, seriesNum, topTeam, botTeam) {
    const rMap = byRound.get(round);
    if (!rMap) return [];
    if (seriesNum != null && rMap.has(seriesNum)) return rMap.get(seriesNum);
    if (topTeam && botTeam) {
      const k1 = `${topTeam}-${botTeam}`;
      if (rMap.has(k1)) return rMap.get(k1);
    }
    return [];
  }
  function getSeriesLength(games) {
    for (const g of games) {
      if (g.series_length != null && g.series_length > 0) return g.series_length;
    }
    return 7;
  }
  function record(games, topTeam, botTeam) {
    let tW = 0, bW = 0;
    (games || []).forEach(g => {
      const aT = g.team_code_a === topTeam;
      const ts = aT ? g.team_a_score : g.team_b_score;
      const bs = aT ? g.team_b_score : g.team_a_score;
      if (ts > bs) tW++; else if (bs > ts) bW++;
    });
    return { tW, bW };
  }
  function winner(games, topTeam, botTeam, winsNeeded) {
    if (!topTeam || !botTeam) return null;
    const { tW, bW } = record(games, topTeam, botTeam);
    if (tW >= winsNeeded) return topTeam;
    if (bW >= winsNeeded) return botTeam;
    return null;
  }

  const allRounds = [];
  const seedPairToSN = new Map();
  (playoffGames || []).forEach(g => {
    if (g.round !== 1) return;
    const lo = Math.min(g.seed_a ?? 99, g.seed_b ?? 99);
    const hi = Math.max(g.seed_a ?? 99, g.seed_b ?? 99);
    const key = `${lo}-${hi}`;
    if (!seedPairToSN.has(key)) seedPairToSN.set(key, g.series_number);
  });

  const r1 = pairs.map((pair, si) => {
    const [sA, sB] = pair;
    const key = `${sA}-${sB}`;
    const actualSN = seedPairToSN.get(key) ?? null;
    const games = getGames(1, actualSN, null, null);
    let top = null, bot = null;
    if (games.length) {
      const g0 = games[0];
      if ((g0.seed_a ?? 99) <= (g0.seed_b ?? 99)) { top = g0.team_code_a; bot = g0.team_code_b; }
      else                                          { top = g0.team_code_b; bot = g0.team_code_a; }
    }
    const seriesLength = getSeriesLength(games);
    const winsNeeded   = Math.ceil(seriesLength / 2);
    const rec          = record(games, top, bot);
    return {
      round: 1, si, topSeed: sA, botSeed: sB,
      topTeam: top, botTeam: bot,
      topW: rec.tW, botW: rec.bW,
      games, seriesLength, winsNeeded,
      winner: winner(games, top, bot, winsNeeded),
      sn: actualSN,
    };
  });
  allRounds.push(r1);

  for (let r = 2; r <= nR; r++) {
    const prev = allRounds[r - 2];
    const n    = Math.floor(prev.length / 2);
    const rnd  = [];
    for (let i = 0; i < n; i++) {
      const topPrev = prev[i * 2];
      const botPrev = prev[i * 2 + 1];
      const top     = topPrev.winner || null;
      const bot     = botPrev.winner || null;
      const topSeed = top ? (top === topPrev.topTeam ? topPrev.topSeed : topPrev.botSeed) : null;
      const botSeed = bot ? (bot === botPrev.topTeam ? botPrev.topSeed : botPrev.botSeed) : null;
      const games        = getGames(r, null, top, bot);
      const seriesLength = getSeriesLength(games);
      const winsNeeded   = Math.ceil(seriesLength / 2);
      const rec          = record(games, top, bot);
      rnd.push({
        round: r, si: i, topSeed, botSeed,
        topTeam: top, botTeam: bot,
        topW: rec.tW, botW: rec.bW,
        games, seriesLength, winsNeeded,
        winner: winner(games, top, bot, winsNeeded),
        sn: null,
      });
    }
    allRounds.push(rnd);
  }

  const champSlot = allRounds[allRounds.length - 1][0];
  const leftRounds = allRounds.slice(0, -1).map((rnd) => {
    const h = Math.ceil(rnd.length / 2);
    return rnd.slice(0, h);
  });
  const rightRounds = allRounds.slice(0, -1).map((rnd) => {
    const h = Math.ceil(rnd.length / 2);
    return rnd.slice(h);
  });

  return { leftRounds, rightRounds, champSlot, nRounds: nR, allRounds };
}

/* ═══════════════════════════════════════════════════════════════
   RS RECORD
═══════════════════════════════════════════════════════════════ */
function getRsRec(t1, t2, sg) {
  if (!t1 || !t2 || !sg?.length) return null;
  const gs = sg.filter(g => (g.home === t1 && g.away === t2) || (g.home === t2 && g.away === t1));
  if (!gs.length) return null;
  let w1 = 0, w2 = 0;
  gs.forEach(g => {
    const h  = g.home === t1;
    const s1 = h ? g.score_home : g.score_away;
    const s2 = h ? g.score_away : g.score_home;
    if (s1 > s2) w1++; else if (s2 > s1) w2++;
  });
  return { w1, w2 };
}

/* ═══════════════════════════════════════════════════════════════
   DESKTOP UI PRIMITIVES (unchanged)
═══════════════════════════════════════════════════════════════ */
function Logo({ team, size = 24 }) {
  const [err, setErr] = useState(false);
  const s = {
    width: size, height: size, flexShrink: 0, borderRadius: 4,
    background: 'rgba(0,0,0,.5)', padding: 2, objectFit: 'contain',
    display: 'block', filter: 'drop-shadow(0 0 4px rgba(135,206,235,.4))',
  };
  if (!team) return (
    <div style={{ ...s, border: '1px dashed rgba(255,255,255,.1)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.15)', fontSize: 10 }}>?</div>
  );
  if (err) return (
    <div style={{ ...s, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#87CEEB', fontSize: '.36rem', fontFamily: "'Press Start 2P',monospace" }}>{team.slice(0, 3)}</div>
  );
  return <img src={`/assets/teamLogos/${team}.png`} alt={team} style={s} onError={() => setErr(true)} />;
}

function TeamRow({ team, seed, wins, isWinner, winsNeeded = 4, flipped = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '4px 7px', minHeight: 28,
      background: isWinner ? 'linear-gradient(90deg,rgba(0,210,90,.15),rgba(0,210,90,.03))' : 'transparent',
      borderLeft:  !flipped && isWinner ? '3px solid #00FF88' : '3px solid transparent',
      borderRight:  flipped && isWinner ? '3px solid #00FF88' : '3px solid transparent',
      flexDirection: flipped ? 'row-reverse' : 'row', boxSizing: 'border-box',
    }}>
      {seed != null && (
        <span style={{
          color: '#FF8C00', fontFamily: "'Press Start 2P',monospace",
          fontSize: '.7rem', minWidth: 18, textAlign: flipped ? 'left' : 'right',
          textShadow: '0 0 6px rgba(255,140,0,.6)',
        }}>{seed}</span>
      )}
      <Logo team={team} size={22} />
      <span style={{
        flex: 1,
        color: isWinner ? '#FFD700' : team ? '#D0D0D0' : 'rgba(255,255,255,.22)',
        fontFamily: "'VT323',monospace", fontSize: '1.05rem', letterSpacing: 1,
        textShadow: isWinner ? '0 0 10px rgba(255,215,0,.6)' : 'none',
        textAlign: flipped ? 'right' : 'left',
      }}>{team || 'TBD'}</span>
      <div style={{ display: 'flex', gap: 3, flexDirection: flipped ? 'row-reverse' : 'row' }}>
        {Array.from({ length: winsNeeded }).map((_, i) => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%',
            background: i < wins
              ? (isWinner ? 'linear-gradient(135deg,#FFD700,#FF8C00)' : 'linear-gradient(135deg,#87CEEB,#4a9ec4)')
              : 'rgba(255,255,255,.07)',
            boxShadow: i < wins
              ? (isWinner ? '0 0 8px rgba(255,215,0,.9)' : '0 0 6px rgba(135,206,235,.7)')
              : 'none',
          }} />
        ))}
      </div>
    </div>
  );
}

function ScoreGrid({ games, topTeam, botTeam, flipped = false, seriesLength = 7 }) {
  if (!games?.length) return null;
  const gCapped = games.slice(0, seriesLength);
  return (
    <div style={{
      background: 'rgba(0,0,0,.5)',
      borderTop: '1px solid rgba(255,140,0,.1)',
      borderBottom: '1px solid rgba(255,140,0,.1)',
      padding: '3px 7px',
    }}>
      <div style={{ display: 'flex', marginBottom: 2, flexDirection: flipped ? 'row-reverse' : 'row' }}>
        <div style={{ width: 24 }} />
        {gCapped.map((_, i) => (
          <div key={i} style={{
            flex: 1, textAlign: 'center', color: 'rgba(255,255,255,.35)',
            fontFamily: "'Press Start 2P',monospace", fontSize: '.44rem',
          }}>{i + 1}</div>
        ))}
      </div>
      {[topTeam, botTeam].map((team, idx) => (
        <div key={idx} style={{
          display: 'flex', alignItems: 'center', marginBottom: idx === 0 ? 2 : 0,
          flexDirection: flipped ? 'row-reverse' : 'row',
        }}>
          <div style={{
            width: 24, fontFamily: "'Press Start 2P',monospace", fontSize: '.34rem',
            color: 'rgba(135,206,235,.65)', textAlign: flipped ? 'right' : 'left',
          }}>{team?.slice(0, 3)}</div>
          {gCapped.map((g, i) => {
            const aT  = idx === 0;
            const ts  = g.team_code_a === topTeam ? g.team_a_score : g.team_b_score;
            const bs  = g.team_code_a === topTeam ? g.team_b_score : g.team_a_score;
            const val = aT ? ts : bs;
            const won = (aT ? ts : bs) > (aT ? bs : ts);
            return (
              <div key={i} style={{
                flex: 1, textAlign: 'center', fontFamily: "'VT323',monospace", fontSize: '1rem',
                color: won ? '#FFD700' : 'rgba(255,255,255,.28)',
                textShadow: won ? '0 0 7px rgba(255,215,0,.8)' : 'none',
                fontWeight: won ? 'bold' : 'normal',
              }}>{val ?? '-'}</div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function BottomBar({ topW, botW, winner, topTeam, botTeam, seasonGames }) {
  if (!topTeam || !botTeam) return null;
  const rsRec = getRsRec(topTeam, botTeam, seasonGames);
  if (winner) {
    const winnerW = winner === topTeam ? topW : botW;
    const loserW  = winner === topTeam ? botW : topW;
    return (
      <div style={{
        textAlign: 'center', padding: '4px 5px',
        fontFamily: "'Press Start 2P',monospace", fontSize: '.52rem',
        color: '#FFD700', background: 'rgba(255,215,0,.09)',
        borderTop: '1px solid rgba(255,215,0,.25)',
        letterSpacing: 1, textShadow: '0 0 10px rgba(255,215,0,.8)',
      }}>{winner} WINS {winnerW}-{loserW}</div>
    );
  }
  const hasGames = (topW + botW) > 0;
  return (
    <div>
      {hasGames && (() => {
        let label, color;
        if (topW > botW)      { label = `${topTeam} LEADS ${topW}-${botW}`; color = '#00FF88'; }
        else if (botW > topW) { label = `${botTeam} LEADS ${botW}-${topW}`; color = '#00FF88'; }
        else                  { label = `TIED ${topW}-${botW}`;              color = '#87CEEB'; }
        return (
          <div style={{
            textAlign: 'center', padding: '2px 5px',
            fontFamily: "'Press Start 2P',monospace", fontSize: '.37rem',
            color, background: `${color}11`, borderTop: `1px solid ${color}22`,
            letterSpacing: 1, textShadow: `0 0 7px ${color}88`,
          }}>{label}</div>
        );
      })()}
      {rsRec && (() => {
        const { w1, w2 } = rsRec;
        const tied  = w1 === w2;
        const color = tied ? '#87CEEB' : '#FFD700';
        const text  = tied
          ? `RS TIED ${w1}-${w2}`
          : `${w1 > w2 ? topTeam : botTeam} LED RS ${Math.max(w1,w2)}-${Math.min(w1,w2)}`;
        return (
          <div style={{
            textAlign: 'center', padding: '3px 5px',
            fontFamily: "'Press Start 2P',monospace", fontSize: '.44rem',
            color, background: 'rgba(0,0,0,.25)',
            borderTop: hasGames ? '1px solid rgba(255,255,255,.07)' : '1px solid rgba(255,255,255,.1)',
            letterSpacing: 1, textShadow: `0 0 8px ${color}`,
          }}>{text}</div>
        );
      })()}
    </div>
  );
}

function MatchupCard({ slot, seasonGames, cardRef, flipped = false, onSeriesClick }) {
  const {
    topTeam, botTeam, topSeed, botSeed, topW, botW, games, winner,
    winsNeeded = 4,
    seriesLength = 7,
  } = slot;

  const done   = !!winner;
  const active = !done && (topW + botW) > 0;
  const bdr    = done   ? 'rgba(255,215,0,.5)'   : active ? 'rgba(0,255,136,.25)' : 'rgba(135,206,235,.15)';
  const glw    = done   ? 'rgba(255,215,0,.13)'  : active ? 'rgba(0,255,136,.07)' : 'rgba(135,206,235,.04)';

  return (
    <div ref={cardRef} style={{
      width: '100%', border: `1px solid ${bdr}`, borderRadius: 9,
      background: 'linear-gradient(155deg,rgba(8,8,22,.98),rgba(16,16,38,.98))',
      boxShadow: `0 0 12px ${glw},0 3px 16px rgba(0,0,0,.5),inset 0 0 14px rgba(0,0,0,.4)`,
      overflow: 'hidden', position: 'relative', boxSizing: 'border-box',
      cursor: onSeriesClick && topTeam && botTeam ? 'pointer' : 'default',
    }}
      onClick={() => {
        if (onSeriesClick && topTeam && botTeam) onSeriesClick(topTeam, botTeam);
      }}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 36, height: 36,
        background: `radial-gradient(circle at top right,${done ? 'rgba(255,215,0,.08)' : 'rgba(135,206,235,.04)'},transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <TeamRow team={topTeam} seed={topSeed} wins={topW} isWinner={winner === topTeam}
        winsNeeded={winsNeeded} flipped={flipped} />
      <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,140,0,.18),transparent)' }} />
      {games.length > 0
        ? <ScoreGrid games={games} topTeam={topTeam} botTeam={botTeam}
            flipped={false} seriesLength={seriesLength} />
        : <div style={{
            textAlign: 'center', padding: '3px 0', color: 'rgba(135,206,235,.2)',
            fontFamily: "'Press Start 2P',monospace", fontSize: '.38rem', letterSpacing: 3,
          }}>— VS —</div>
      }
      <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,140,0,.18),transparent)' }} />
      <TeamRow team={botTeam} seed={botSeed} wins={botW} isWinner={winner === botTeam}
        winsNeeded={winsNeeded} flipped={flipped} />
      <BottomBar topW={topW} botW={botW} winner={winner} topTeam={topTeam} botTeam={botTeam} seasonGames={seasonGames} />
    </div>
  );
}

function ChampCard({ slot, selectedLeague, cardRef, seasonGames, onSeriesClick }) {
  const [tErr, setTErr] = useState(false);
  const tSrc = selectedLeague?.toUpperCase().startsWith('Q')
    ? '/assets/awards/q_champ.png'
    : '/assets/awards/w_champ.png';

  const {
    topTeam, botTeam, topSeed, botSeed, topW, botW, games, winner,
    winsNeeded = 4,
    seriesLength = 7,
  } = slot || {};

  function CRow({ team, seed, wins, isWinner }) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', minHeight: 42,
        background: isWinner ? 'linear-gradient(90deg,rgba(0,210,90,.18),rgba(0,210,90,.04))' : 'transparent',
        borderLeft: isWinner ? '4px solid #00FF88' : '4px solid transparent',
        boxSizing: 'border-box',
      }}>
        {seed != null && (
          <span style={{
            color: '#FF8C00', fontFamily: "'Press Start 2P',monospace",
            fontSize: '.6rem', minWidth: 20, textAlign: 'right',
            textShadow: '0 0 8px rgba(255,140,0,.7)',
          }}>{seed}</span>
        )}
        <Logo team={team} size={32} />
        <span style={{
          flex: 1,
          color: isWinner ? '#FFD700' : team ? '#D8D8D8' : 'rgba(255,255,255,.22)',
          fontFamily: "'VT323',monospace", fontSize: '1.25rem', letterSpacing: 1.5,
          textShadow: isWinner ? '0 0 12px rgba(255,215,0,.7)' : 'none',
        }}>{team || 'TBD'}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: winsNeeded }).map((_, i) => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: i < wins
                ? (isWinner ? 'linear-gradient(135deg,#FFD700,#FF8C00)' : 'linear-gradient(135deg,#87CEEB,#4a9ec4)')
                : 'rgba(255,255,255,.07)',
              boxShadow: i < wins
                ? (isWinner ? '0 0 9px rgba(255,215,0,.9)' : '0 0 7px rgba(135,206,235,.7)')
                : 'none',
            }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <div style={{ textAlign: 'center' }}>
        {!tErr
          ? <img src={tSrc} alt="Trophy" onError={() => setTErr(true)}
              style={{ width: 52, height: 52, filter: 'drop-shadow(0 0 18px rgba(255,215,0,.92))' }} />
          : <div style={{ fontSize: '2.2rem', filter: 'drop-shadow(0 0 14px rgba(255,215,0,.9))' }}>🏆</div>
        }
      </div>

      <div ref={cardRef} style={{
        width: 188, border: '2px solid rgba(255,215,0,.65)', borderRadius: 10,
        background: 'linear-gradient(155deg,rgba(14,11,30,.99),rgba(30,22,6,.99))',
        boxShadow: '0 0 28px rgba(255,215,0,.26),0 0 56px rgba(255,140,0,.12),inset 0 0 28px rgba(255,215,0,.07)',
        overflow: 'hidden', position: 'relative',
        cursor: onSeriesClick && topTeam && botTeam ? 'pointer' : 'default',
      }}
        onClick={() => {
          if (onSeriesClick && topTeam && botTeam) onSeriesClick(topTeam, botTeam);
        }}
      >
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(45deg,transparent 30%,rgba(255,215,0,.04) 50%,transparent 70%)',
          animation: 'champShimmer 4s infinite',
        }} />
        <div style={{
          textAlign: 'center', padding: '8px 0 5px',
          fontFamily: "'Press Start 2P',monospace", fontSize: '.44rem',
          color: '#FFD700', letterSpacing: 2,
          textShadow: '0 0 10px #FFD700,0 0 20px #FF8C00',
        }}>CHAMPIONSHIP</div>
        <div style={{
          height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(255,215,0,.4),transparent)',
          margin: '2px 0',
        }} />
        <CRow team={topTeam} seed={topSeed} wins={topW || 0} isWinner={winner === topTeam} />
        <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,140,0,.2),transparent)' }} />
        {(games || []).length > 0
          ? <ScoreGrid games={games} topTeam={topTeam} botTeam={botTeam} seriesLength={seriesLength} />
          : <div style={{
              textAlign: 'center', padding: '6px 0', color: 'rgba(255,215,0,.2)',
              fontFamily: "'Press Start 2P',monospace", fontSize: '.38rem', letterSpacing: 3,
            }}>— VS —</div>
        }
        <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,140,0,.2),transparent)' }} />
        <CRow team={botTeam} seed={botSeed} wins={botW || 0} isWinner={winner === botTeam} />
        {!winner && <BottomBar topW={topW || 0} botW={botW || 0} winner={winner} topTeam={topTeam} botTeam={botTeam} seasonGames={seasonGames} />}

        {winner && (
          <div style={{
            textAlign: 'center', padding: '16px 8px 18px',
            borderTop: '1px solid rgba(255,215,0,.28)',
            background: 'rgba(255,215,0,.09)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <Logo team={winner} size={66} />
            </div>
            <div style={{
              fontFamily: "'Press Start 2P',monospace", fontSize: '.46rem',
              color: '#FF8C00', letterSpacing: 2,
              textShadow: '0 0 10px #FF8C00,0 0 20px #FFD700',
            }}>CHAMPION</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SVG CONNECTOR LINES
═══════════════════════════════════════════════════════════════ */
function BracketLines({ getBox, leftRefs, rightRefs, champRef, leftRounds, rightRounds }) {
  const [segs, setSegs] = useState([]);

  const compute = useCallback(() => {
    const newSegs = [];

    function half(refsGrid, rounds, flipped) {
      for (let r = 0; r < rounds.length - 1; r++) {
        const curRefs  = refsGrid[r]   || [];
        const nextRefs = refsGrid[r + 1] || [];
        const nNext    = nextRefs.length;

        for (let ni = 0; ni < nNext; ni++) {
          const rTop  = curRefs[ni * 2];
          const rBot  = curRefs[ni * 2 + 1];
          const rNext = nextRefs[ni];
          if (!rTop?.current || !rNext?.current) continue;

          const bTop  = getBox(rTop.current);
          const bBot  = rBot?.current ? getBox(rBot.current) : null;
          const bNext = getBox(rNext.current);
          if (!bTop || !bNext) continue;

          const stubFrom  = flipped ? bTop.left  : bTop.right;
          const stubFromB = bBot    ? (flipped ? bBot.left  : bBot.right) : stubFrom;
          const stubTo    = flipped ? bNext.right : bNext.left;
          const spineX    = (stubFrom + stubTo) / 2;
          const topY      = bTop.midY;
          const botY      = bBot ? bBot.midY : topY;
          const midY      = (topY + botY) / 2;
          const id        = `${flipped ? 'R' : 'L'}-${r}-${ni}`;

          newSegs.push({ key: `${id}-ht`, x1: stubFrom,  y1: topY, x2: spineX, y2: topY });
          if (bBot) newSegs.push({ key: `${id}-hb`, x1: stubFromB, y1: botY, x2: spineX, y2: botY });
          newSegs.push({ key: `${id}-v`,  x1: spineX, y1: topY, x2: spineX, y2: botY, isV: true });
          newSegs.push({ key: `${id}-hn`, x1: spineX, y1: midY, x2: stubTo,  y2: midY, arrow: true, flipped });
          newSegs.push({ key: `${id}-dot`, dot: true, cx: spineX, cy: midY });
        }
      }

      const lastRefs = refsGrid[rounds.length - 1];
      if (lastRefs?.length === 1 && champRef?.current) {
        const bLast  = getBox(lastRefs[0].current);
        const bChamp = getBox(champRef.current);
        if (bLast && bChamp) {
          const from = flipped ? bLast.left  : bLast.right;
          const to   = flipped ? bChamp.right : bChamp.left;
          const id   = `${flipped ? 'R' : 'L'}-champ`;
          newSegs.push({ key: `${id}-h`, x1: from, y1: bLast.midY, x2: to, y2: bLast.midY, arrow: true, flipped });
          newSegs.push({ key: `${id}-dot`, dot: true, cx: to, cy: bLast.midY });
        }
      }
    }

    half(leftRefs,  leftRounds,  false);
    half(rightRefs, rightRounds, true);
    setSegs(newSegs);
  }, [getBox, leftRefs, rightRefs, champRef, leftRounds, rightRounds]);

  useLayoutEffect(() => {
    const t = setTimeout(compute, 80);
    window.addEventListener('resize', compute);
    return () => { clearTimeout(t); window.removeEventListener('resize', compute); };
  }, [compute]);

  return (
    <svg style={{
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      pointerEvents: 'none', overflow: 'visible', zIndex: 2,
    }}>
      <defs>
        <filter id="lnGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="lnHalo" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      {segs.map(s => {
        if (s.dot) return (
          <g key={s.key}>
            <circle cx={s.cx} cy={s.cy} r={6}   fill="#FFD700" opacity={0.14} filter="url(#lnHalo)" />
            <circle cx={s.cx} cy={s.cy} r={3.2} fill="#FFD700" filter="url(#lnGlow)" />
            <circle cx={s.cx} cy={s.cy} r={1.3} fill="#FFFFFF" opacity={0.95} />
          </g>
        );
        const d = `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`;
        return (
          <g key={s.key}>
            <path d={d} fill="none" stroke="#FFD700" strokeWidth={6} opacity={0.08} filter="url(#lnHalo)" />
            <path d={d} fill="none" stroke="rgba(0,0,0,.5)" strokeWidth={3} />
            <path d={d} fill="none" stroke="#FF8C00" strokeWidth={1.8} opacity={0.6} />
            <path d={d} fill="none" stroke="#FFD700" strokeWidth={1.2} filter="url(#lnGlow)"
              strokeLinecap="round" opacity={0.95} />
          </g>
        );
      })}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MOBILE PRIMITIVES
═══════════════════════════════════════════════════════════════ */

/** Small logo for mobile — seed only, no team code */
function MobileLogo({ team, size = 28 }) {
  const [err, setErr] = useState(false);
  const s = {
    width: size, height: size, flexShrink: 0, borderRadius: 4,
    background: 'rgba(0,0,0,.5)', padding: 2, objectFit: 'contain',
    display: 'block',
  };
  if (!team) return (
    <div style={{ ...s, border: '1px dashed rgba(255,255,255,.15)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,.2)', fontSize: 9 }}>?</div>
  );
  if (err) return (
    <div style={{ ...s, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(135,206,235,.1)', borderRadius: 4,
      color: '#87CEEB', fontSize: 8, fontFamily: "'Press Start 2P',monospace" }}>{team.slice(0,3)}</div>
  );
  return <img src={`/assets/teamLogos/${team}.png`} alt={team} style={s} onError={() => setErr(true)} />;
}

/**
 * A single team row inside a mobile matchup — logo + seed on one side, bold win number on the other.
 * flipped=true mirrors it (right-side bracket).
 */
function MobileTeamRow({ team, seed, wins, isWinner, flipped = false, isPortrait = false }) {
  const winColor = isWinner
    ? '#FFD700'
    : wins > 0 ? '#87CEEB' : 'rgba(255,255,255,.28)';

  // ── PORTRAIT: stacked vertical (logo → seed → wins) ──────────
  if (isPortrait) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 2px',
        minHeight: 48,
        gap: 1,
        background: isWinner ? 'rgba(0,210,90,.1)' : 'transparent',
        borderBottom: isWinner ? '2px solid #00FF88' : '2px solid transparent',
        boxSizing: 'border-box',
      }}>
        <MobileLogo team={team} size={22} />
        {seed != null && (
          <span style={{
            fontFamily: "'Press Start 2P',monospace",
            fontSize: '.36rem',
            color: '#FF8C00',
            textShadow: '0 0 4px rgba(255,140,0,.5)',
            lineHeight: 1,
          }}>{seed}</span>
        )}
        <span style={{
          fontFamily: "'VT323',monospace",
          fontSize: '1.35rem',
          color: winColor,
          lineHeight: 1,
          textShadow: isWinner
            ? '0 0 10px rgba(255,215,0,.8)'
            : wins > 0 ? '0 0 6px rgba(135,206,235,.4)' : 'none',
        }}>{team ? wins : '—'}</span>
      </div>
    );
  }

  // ── LANDSCAPE / ORIGINAL: horizontal row (seed | logo | name | win dots) ──
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '5px 7px', minHeight: 34,
      background: isWinner
        ? 'linear-gradient(90deg,rgba(0,210,90,.13),rgba(0,210,90,.02))'
        : 'transparent',
      borderLeft:  !flipped && isWinner ? '2px solid #00FF88' : '2px solid transparent',
      borderRight:  flipped && isWinner ? '2px solid #00FF88' : '2px solid transparent',
      flexDirection: flipped ? 'row-reverse' : 'row',
      boxSizing: 'border-box',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        flexDirection: flipped ? 'row-reverse' : 'row',
      }}>
        <MobileLogo team={team} size={26} />
        {seed != null && (
          <span style={{
            fontFamily: "'Press Start 2P',monospace",
            fontSize: '.55rem',
            color: '#FF8C00',
            textShadow: '0 0 5px rgba(255,140,0,.5)',
            lineHeight: 1,
          }}>{seed}</span>
        )}
      </div>
      <span style={{
        fontFamily: "'VT323',monospace",
        fontSize: '1.7rem',
        fontWeight: 'bold',
        color: winColor,
        textShadow: isWinner
          ? '0 0 12px rgba(255,215,0,.8)'
          : wins > 0 ? '0 0 8px rgba(135,206,235,.5)' : 'none',
        lineHeight: 1,
        minWidth: 18,
        textAlign: 'right',
        marginLeft: 'auto',
      }}>{team ? wins : '—'}</span>
    </div>
  );
}

/**
 * Compact matchup card for mobile.
 * Shows: top team row / divider / bottom team row.
 * No score grid, no bottom bar.
 */
function MobileMatchupCard({ slot, onSeriesClick, style = {}, isPortrait = false }) {
  const { topTeam, botTeam, topSeed, botSeed, topW, botW, winner } = slot;
  const done   = !!winner;
  const active = !done && (topW + botW) > 0;
  const bdr = done   ? 'rgba(255,215,0,.55)'
            : active ? 'rgba(0,255,136,.3)'
            :          'rgba(135,206,235,.18)';
  const glow = done   ? '0 0 10px rgba(255,215,0,.2)'
             : active ? '0 0 8px rgba(0,255,136,.1)'
             :          'none';

  return (
    <div
      onClick={() => { if (onSeriesClick && topTeam && botTeam) onSeriesClick(topTeam, botTeam); }}
      style={{
        border: `1px solid ${bdr}`,
        borderRadius: 8,
        background: 'linear-gradient(155deg,rgba(8,8,22,.97),rgba(16,16,38,.97))',
        boxShadow: glow,
        overflow: 'hidden',
        cursor: onSeriesClick && topTeam && botTeam ? 'pointer' : 'default',
        ...style,
      }}
    >
      <MobileTeamRow team={topTeam} seed={topSeed} wins={topW} isWinner={winner === topTeam} isPortrait={isPortrait} />
      <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,140,0,.2),transparent)' }} />
      <MobileTeamRow team={botTeam} seed={botSeed} wins={botW} isWinner={winner === botTeam} isPortrait={isPortrait} />
    </div>
  );
}

/**
 * Grouped R1 card — two matchups stacked in one bordered container,
 * matching the NHL screenshot style.
 */
function MobileR1GroupCard({ slotA, slotB, onSeriesClick, isPortrait = false }) {
  return (
    <div style={{
      border: '1px solid rgba(135,206,235,.12)',
      borderRadius: 10,
      background: 'rgba(0,0,0,.3)',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <MobileMatchupCard slot={slotA} onSeriesClick={onSeriesClick} isPortrait={isPortrait} />
      <div style={{ height: 2, background: 'rgba(135,206,235,.08)' }} />
      <MobileMatchupCard slot={slotB} onSeriesClick={onSeriesClick} isPortrait={isPortrait} />
    </div>
  );
}

/**
 * Round label badge
 */
function MobileRoundLabel({ label, isChampion = false }) {
  return (
    <div style={{
      textAlign: 'center',
      fontFamily: "'Press Start 2P',monospace",
      fontSize: '.4rem',
      letterSpacing: 2,
      color: isChampion ? '#FFD700' : '#87CEEB',
      textShadow: isChampion ? '0 0 8px #FFD700' : '0 0 6px #87CEEB',
      marginBottom: 5,
      paddingTop: 2,
    }}>{label}</div>
  );
}

/**
 * Mobile championship card — centered, trophy + two teams, bold win numbers
 */
function MobileChampCard({ slot, selectedLeague, onSeriesClick }) {
  const [tErr, setTErr] = useState(false);
  const tSrc = selectedLeague?.toUpperCase().startsWith('Q')
    ? '/assets/awards/q_champ.png'
    : '/assets/awards/w_champ.png';

  const { topTeam, botTeam, topSeed, botSeed, topW, botW, winner } = slot || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {/* Trophy */}
      <div>
        {!tErr
          ? <img src={tSrc} alt="Trophy" onError={() => setTErr(true)}
              style={{ width: 40, height: 40, filter: 'drop-shadow(0 0 14px rgba(255,215,0,.9))' }} />
          : <div style={{ fontSize: '1.8rem' }}>🏆</div>
        }
      </div>

      {/* Card */}
      <div
        onClick={() => { if (onSeriesClick && topTeam && botTeam) onSeriesClick(topTeam, botTeam); }}
        style={{
          width: '100%',
          border: '2px solid rgba(255,215,0,.6)',
          borderRadius: 10,
          background: 'linear-gradient(155deg,rgba(14,11,30,.99),rgba(30,22,6,.99))',
          boxShadow: '0 0 20px rgba(255,215,0,.2),inset 0 0 20px rgba(255,215,0,.05)',
          overflow: 'hidden',
          cursor: onSeriesClick && topTeam && botTeam ? 'pointer' : 'default',
        }}
      >
        <div style={{
          textAlign: 'center', padding: '5px 0 4px',
          fontFamily: "'Press Start 2P',monospace", fontSize: '.38rem',
          color: '#FFD700', letterSpacing: 2,
          textShadow: '0 0 8px #FFD700,0 0 16px #FF8C00',
        }}>CHAMPIONSHIP</div>
        <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,215,0,.4),transparent)' }} />

        {/* Top team */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 8px', minHeight: 38,
          background: winner === topTeam ? 'linear-gradient(90deg,rgba(0,210,90,.15),rgba(0,210,90,.03))' : 'transparent',
          borderLeft: winner === topTeam ? '3px solid #00FF88' : '3px solid transparent',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <MobileLogo team={topTeam} size={28} />
            {topSeed != null && (
              <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: '.5rem', color: '#FF8C00' }}>{topSeed}</span>
            )}
          </div>
          <span style={{
            fontFamily: "'VT323',monospace", fontSize: '1.8rem', fontWeight: 'bold',
            color: winner === topTeam ? '#FFD700' : topW > 0 ? '#87CEEB' : 'rgba(255,255,255,.25)',
            textShadow: winner === topTeam ? '0 0 12px rgba(255,215,0,.8)' : 'none',
          }}>{topTeam ? topW : '—'}</span>
        </div>

        <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,140,0,.2),transparent)' }} />

        {/* Bottom team */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 8px', minHeight: 38,
          background: winner === botTeam ? 'linear-gradient(90deg,rgba(0,210,90,.15),rgba(0,210,90,.03))' : 'transparent',
          borderLeft: winner === botTeam ? '3px solid #00FF88' : '3px solid transparent',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <MobileLogo team={botTeam} size={28} />
            {botSeed != null && (
              <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: '.5rem', color: '#FF8C00' }}>{botSeed}</span>
            )}
          </div>
          <span style={{
            fontFamily: "'VT323',monospace", fontSize: '1.8rem', fontWeight: 'bold',
            color: winner === botTeam ? '#FFD700' : botW > 0 ? '#87CEEB' : 'rgba(255,255,255,.25)',
            textShadow: winner === botTeam ? '0 0 12px rgba(255,215,0,.8)' : 'none',
          }}>{botTeam ? botW : '—'}</span>
        </div>

        {/* Winner banner */}
        {winner && (
          <div style={{
            textAlign: 'center', padding: '10px 8px 12px',
            borderTop: '1px solid rgba(255,215,0,.25)',
            background: 'rgba(255,215,0,.08)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
              <MobileLogo team={winner} size={48} />
            </div>
            <div style={{
              fontFamily: "'Press Start 2P',monospace", fontSize: '.4rem',
              color: '#FF8C00', letterSpacing: 2,
              textShadow: '0 0 8px #FF8C00,0 0 16px #FFD700',
            }}>CHAMPION</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MOBILE BRACKET LAYOUT
   
   Layout (mirrors NHL app):
   
   [Left half]    [Champ]    [Right half]
   
   Each half is a vertical column of rounds.
   R1: grouped card (2 matchups per card, pairs of slots)
   R2+: individual matchup cards
   Championship: centered column
═══════════════════════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════════════════════
   MOBILE BRACKET LAYOUT  — horizontal flow, mirrors NHL app
   
   Structure per half (left example, 4-team = 2 rounds + CF):
     [R1 col] → [R2 col] → [CF col]   Championship   [CF col] ← [R2 col] ← [R1 col]
   
   Each column is a vertical flex of cards.
   Cards get taller each round so they vertically span their
   two "feeder" matchups (implicit bracket alignment).
═══════════════════════════════════════════════════════════════ */
function MobileBracket({ leftRounds, rightRounds, champSlot, selectedLeague, nRounds, onSeriesClick }) {
  const [isPortrait, setIsPortrait] = useState(
    () => window.matchMedia('(orientation: portrait)').matches
  );
  useLayoutEffect(() => {
    const mql = window.matchMedia('(orientation: portrait)');
    const update = () => setIsPortrait(mql.matches);
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  function getRoundLabel(ri, totalHalfRounds) {
    if (ri === 0) return 'R1';
    if (ri === totalHalfRounds - 1) return 'CF';
    return `R${ri + 1}`;
  }

  function renderHalf(rounds, isRight) {
    const orderedRounds = isRight ? [...rounds].reverse() : rounds;
    const totalHalfRounds = rounds.length;

    return (
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'row',
        gap: 4,
        minWidth: 0,
        justifyContent: isRight ? 'flex-end' : 'flex-start',
        alignItems: 'stretch',
      }}>
        {orderedRounds.map((rnd, colIdx) => {
          const origRi = isRight ? (rounds.length - 1 - colIdx) : colIdx;
          const label = getRoundLabel(origRi, totalHalfRounds);
          const isR1 = origRi === 0;

          return (
            <div key={colIdx} style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              flex: 1,
              minWidth: 0,
              alignItems: 'stretch',
            }}>
              <div style={{
                textAlign: 'center',
                fontFamily: "'Press Start 2P',monospace",
                fontSize: '.38rem',
                letterSpacing: 2,
                color: label === 'CF' ? '#FFD700' : '#87CEEB',
                textShadow: label === 'CF' ? '0 0 8px #FFD700' : '0 0 6px #87CEEB',
                paddingBottom: 3,
                flexShrink: 0,
              }}>{label}</div>

              {isR1 ? (
                <>
                  {Array.from({ length: Math.ceil(rnd.length / 2) }).map((_, gi) => {
                    const slotA = rnd[gi * 2];
                    const slotB = rnd[gi * 2 + 1];
                    return slotB
                      ? <MobileR1GroupCard key={gi} slotA={slotA} slotB={slotB}
                          onSeriesClick={onSeriesClick} isPortrait={isPortrait} />
                      : <MobileMatchupCard key={gi} slot={slotA}
                          onSeriesClick={onSeriesClick} isPortrait={isPortrait} />;
                  })}
                </>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-around',
                  flex: 1,
                  gap: 4,
                }}>
                  {rnd.map((slot, mi) => (
                    <MobileMatchupCard key={mi} slot={slot}
                      onSeriesClick={onSeriesClick} isPortrait={isPortrait} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ padding: '10px 6px 20px', background: 'transparent' }}>
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 6,
        alignItems: 'flex-start',
        width: '100%',
      }}>
        {renderHalf(leftRounds, false)}

        <div style={{
          flexShrink: 0,
          width: 82,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'stretch',
          paddingTop: 20,
        }}>
          <MobileChampCard
            slot={champSlot}
            selectedLeague={selectedLeague}
            onSeriesClick={onSeriesClick}
          />
        </div>

        {renderHalf(rightRounds, true)}
      </div>

      <style>{`
        @keyframes champShimmer {
          0%  { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
          100%{ transform: translateX(100%)  translateY(100%)  rotate(45deg); }
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════════════════════ */
export default function PlayoffBracket({
  playoffGames = [], seasonGames = [], selectedSeason, selectedLeague, playoffTeams, onSeriesClick,
}) {
  const containerRef = useRef(null);
  const champRef     = useRef(null);
  const leftRefs     = useRef([]);
  const rightRefs    = useRef([]);

  // Mobile detection — portrait or landscape phone
  const [isMobile, setIsMobile] = useState(
    () => window.matchMedia('(max-width: 932px)').matches
  );
  useLayoutEffect(() => {
    const mql = window.matchMedia('(max-width: 932px)');
    const update = () => setIsMobile(mql.matches);
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  const getBox = useCallback((el) => {
    if (!el || !containerRef.current) return null;
    const cr = containerRef.current.getBoundingClientRect();
    const r  = el.getBoundingClientRect();
    return { left: r.left - cr.left, right: r.right - cr.left, midY: r.top - cr.top + r.height / 2 };
  }, []);

  if (!playoffGames?.length) return (
    <div style={{
      textAlign: 'center', padding: '3rem', color: 'rgba(255,255,255,.3)',
      fontFamily: "'Press Start 2P',monospace", fontSize: '.8rem',
    }}>NO PLAYOFF DATA</div>
  );

  const numTeams = playoffTeams || (() => {
    let maxSeed = 0;
    (playoffGames || []).forEach(g => {
      if (g.seed_a != null) maxSeed = Math.max(maxSeed, g.seed_a);
      if (g.seed_b != null) maxSeed = Math.max(maxSeed, g.seed_b);
    });
    if (maxSeed > 0) {
      return Math.pow(2, Math.ceil(Math.log2(Math.max(maxSeed, 2))));
    }
    const teams = new Set(playoffGames.flatMap(g => [g.team_code_a, g.team_code_b].filter(Boolean)));
    return Math.pow(2, Math.ceil(Math.log2(Math.max(teams.size, 2))));
  })();

  const { leftRounds, rightRounds, champSlot, nRounds } = buildBracket(playoffGames, numTeams);

  // ── MOBILE RENDER PATH ──────────────────────────────────────
  if (isMobile) {
    return (
      <MobileBracket
        leftRounds={leftRounds}
        rightRounds={rightRounds}
        champSlot={champSlot}
        selectedLeague={selectedLeague}
        nRounds={nRounds}
        onSeriesClick={onSeriesClick}
      />
    );
  }

  // ── DESKTOP RENDER PATH (unchanged) ─────────────────────────
  const CARD_W = 192, COL_GAP = 42;

  leftRounds.forEach((rnd, ri) => {
    if (!leftRefs.current[ri]) leftRefs.current[ri] = [];
    rnd.forEach((_, mi) => { if (!leftRefs.current[ri][mi]) leftRefs.current[ri][mi] = React.createRef(); });
  });
  rightRounds.forEach((rnd, ri) => {
    if (!rightRefs.current[ri]) rightRefs.current[ri] = [];
    rnd.forEach((_, mi) => { if (!rightRefs.current[ri][mi]) rightRefs.current[ri][mi] = React.createRef(); });
  });

  function col(rounds, refsGrid, ri, flipped) {
    const rnd = rounds[ri];
    if (!rnd) return null;
    const cardGap = Math.pow(2, ri) * 12;
    const isInner = ri === rounds.length - 1;

    const label = (() => {
      if (ri === 0) return 'FIRST ROUND';
      if (isInner) {
        if (nRounds === 2) return 'SEMIFINALS';
        if (nRounds === 3) return 'CONF. FINALS';
        if (nRounds === 4) return 'CONF. FINALS';
        return `ROUND ${ri + 1}`;
      }
      return `ROUND ${ri + 1}`;
    })();

    return (
      <div key={`${flipped ? 'R' : 'L'}-${ri}`} style={{
        display: 'flex', flexDirection: 'column', gap: `${cardGap}px`,
        width: CARD_W, flexShrink: 0, position: 'relative', zIndex: 1,
        alignSelf: 'stretch', justifyContent: 'space-around',
      }}>
        <div style={{
          position: 'absolute', top: -32, left: 0, right: 0, textAlign: 'center',
          fontFamily: "'Press Start 2P',monospace", fontSize: '.44rem',
          color: isInner ? '#FFD700' : '#87CEEB', letterSpacing: 2, whiteSpace: 'nowrap',
          textShadow: isInner ? '0 0 10px #FFD700,0 0 20px #FF8C00' : '0 0 8px #87CEEB',
        }}>{label}</div>

        {rnd.map((slot, mi) => {
          if (!refsGrid[ri]) refsGrid[ri] = [];
          if (!refsGrid[ri][mi]) refsGrid[ri][mi] = React.createRef();
          return (
            <MatchupCard
              key={`${ri}-${mi}`}
              slot={slot}
              seasonGames={seasonGames}
              cardRef={refsGrid[ri][mi]}
              flipped={flipped}
              onSeriesClick={onSeriesClick}
            />
          );
        })}
      </div>
    );
  }

  const leftCols  = leftRounds.map((_, ri) => col(leftRounds,  leftRefs.current,  ri, false));
  const rightCols = rightRounds.map((_, ri) => col(rightRounds, rightRefs.current, ri, true)).reverse();

  return (
    <div style={{
      padding: '1.5rem 1.5rem 2rem',
      width: '100vw',
      minWidth: 2000,
      overflowX: 'auto',
      overflowY: 'hidden',
    }}>
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: `${COL_GAP}px`,
          paddingTop: 36,
          position: 'relative',
          minHeight: 10,
          minWidth: 1400,
        }}
      >
        <BracketLines
          getBox={getBox}
          leftRefs={leftRefs.current}
          rightRefs={rightRefs.current}
          champRef={champRef}
          leftRounds={leftRounds}
          rightRounds={rightRounds}
        />

        <div style={{
          display: 'flex', flexDirection: 'row', gap: `${COL_GAP}px`,
          alignItems: 'center', position: 'relative', zIndex: 1,
        }}>
          {leftCols}
        </div>

        <div style={{ flexShrink: 0, zIndex: 1, position: 'relative', alignSelf: 'center' }}>
          <ChampCard slot={champSlot} selectedLeague={selectedLeague} cardRef={champRef} seasonGames={seasonGames} onSeriesClick={onSeriesClick} />
        </div>

        <div style={{
          display: 'flex', flexDirection: 'row', gap: `${COL_GAP}px`,
          alignItems: 'center', position: 'relative', zIndex: 1,
        }}>
          {rightCols}
        </div>
      </div>

      <style>{`
        @keyframes champShimmer {
          0%  { transform: translateX(-100%) translateY(-100%) rotate(45deg); }
          100%{ transform: translateX(100%)  translateY(100%)  rotate(45deg); }
        }
      `}</style>
    </div>
  );
}

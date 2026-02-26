// PlayoffBracket.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Full playoff bracket: 4/8/16/32 teams, SVG connector lines,
// horizontal game scores (G1 G2 … left→right), RS-series blurb,
// league trophy image, bulletproof split logic.
//
// Props:
//   seeds          – standings sorted by season_rank (sliced to playoffTeams)
//   playoffGames   – games with mode='Playoffs'
//   seasonGames    – games with mode='Season' (for RS head-to-head blurb)
//   selectedSeason – label string
//   playoffTeams   – total bracket size
//   selectedLeague – 'W' | 'Q' | etc.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useRef, useEffect, useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
//  Pure data helpers
// ═══════════════════════════════════════════════════════════════════════════

function makeFirstRound(seeds) {
  const n = seeds.length, out = [];
  for (let i = 0; i < n / 2; i++) out.push({ top: seeds[i], bot: seeds[n - 1 - i] });
  return out;
}

function sortedGamesFor(t1, t2, list) {
  if (!t1 || !t2 || !list?.length) return [];
  return list
    .filter(g => (g.home === t1 && g.away === t2) || (g.home === t2 && g.away === t1))
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
}

function computeRecord(topTeam, botTeam, gamesList) {
  const games = sortedGamesFor(topTeam, botTeam, gamesList);
  if (!games.length) return null;
  let topW = 0, botW = 0;
  for (const g of games) {
    const h = g.home === topTeam;
    const ts = h ? g.score_home : g.score_away;
    const bs = h ? g.score_away : g.score_home;
    if (ts > bs) topW++; else if (bs > ts) botW++;
  }
  return { topW, botW, games };
}

function getWinner(topTeam, botTeam, rec, winsNeeded) {
  if (!rec) return null;
  if (rec.topW >= winsNeeded) return topTeam;
  if (rec.botW >= winsNeeded) return botTeam;
  return null;
}

function buildAllRounds(seeds, playoffGames, winsNeeded) {
  let round = makeFirstRound(seeds);
  const all = [round];
  while (round.length > 1) {
    const next = [];
    for (let i = 0; i < round.length; i += 2) {
      const m1 = round[i], m2 = round[i + 1];
      const r1 = computeRecord(m1.top?.team, m1.bot?.team, playoffGames);
      const w1 = getWinner(m1.top?.team, m1.bot?.team, r1, winsNeeded);
      const r2 = computeRecord(m2?.top?.team, m2?.bot?.team, playoffGames);
      const w2 = getWinner(m2?.top?.team, m2?.bot?.team, r2, winsNeeded);
      next.push({
        top: w1 ? (w1 === m1.top?.team ? m1.top : m1.bot) : null,
        bot: w2 ? (w2 === m2?.top?.team ? m2?.top : m2?.bot) : null,
      });
    }
    all.push(next);
    round = next;
  }
  return all;
}

function roundLabel(rIdx, total) {
  const d = total - 1 - rIdx;
  if (d === 0) return 'CHAMPIONSHIP';
  if (d === 1) return 'SEMIFINALS';
  if (d === 2) return 'QUARTERFINALS';
  return `ROUND ${rIdx + 1}`;
}

// Regular-season head-to-head blurb
function rsBlurb(topTeam, botTeam, seasonGames) {
  if (!topTeam || !botTeam) return null;
  const games = sortedGamesFor(topTeam, botTeam, seasonGames);
  if (!games.length) return { text: `${topTeam} / ${botTeam}`, detail: 'DNP', color: 'rgba(255,255,255,.32)' };
  let topW = 0, botW = 0;
  for (const g of games) {
    const h = g.home === topTeam;
    const ts = h ? g.score_home : g.score_away;
    const bs = h ? g.score_away : g.score_home;
    if (ts > bs) topW++; else if (bs > ts) botW++;
  }
  if (topW === botW) return { text: 'RS TIED', detail: `${topW}-${botW}`, color: '#87CEEB' };
  const ldr = topW > botW ? topTeam : botTeam;
  const lW  = Math.max(topW, botW), lL = Math.min(topW, botW);
  return { text: `${ldr} RS LEAD`, detail: `${lW}-${lL}`, color: '#FFD700' };
}

// ═══════════════════════════════════════════════════════════════════════════
//  Atom components
// ═══════════════════════════════════════════════════════════════════════════

function TeamLogo({ team, size = 24 }) {
  const [err, setErr] = useState(false);
  const base = { width: size, height: size, flexShrink: 0, borderRadius: 4,
    background: 'rgba(0,0,0,.35)', padding: 2 };
  if (err) return (
    <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(135,206,235,.1)', border: '1px solid rgba(135,206,235,.2)',
      fontFamily: "'Press Start 2P',monospace", fontSize: '.18rem', color: '#87CEEB' }}>
      {team?.slice(0, 3)}
    </div>
  );
  return (
    <img src={`/assets/teamLogos/${team}.png`} alt={team}
      style={{ ...base, objectFit: 'contain', display: 'block' }}
      onError={() => setErr(true)} />
  );
}

function TeamRow({ teamObj, wins, isWinner, isTbd, showSeed }) {
  const row = {
    display: 'flex', alignItems: 'center', gap: '0.36rem',
    padding: '0.38rem 0.48rem', minHeight: 32,
    background: isWinner ? 'linear-gradient(90deg,rgba(0,200,80,.12) 0%,transparent 100%)' : 'transparent',
  };
  if (isTbd || !teamObj) return (
    <div style={row}>
      <div style={{ width: 22, height: 22, borderRadius: 4, flexShrink: 0,
        border: '1px dashed rgba(255,255,255,.13)', background: 'rgba(255,255,255,.02)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'VT323',monospace", fontSize: '.85rem', color: 'rgba(255,255,255,.16)' }}>?</div>
      <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: '.28rem',
        color: 'rgba(255,255,255,.2)', letterSpacing: 1 }}>TBD</span>
    </div>
  );
  return (
    <div style={row}>
      {showSeed && (
        <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: '.24rem',
          color: '#FF8C00', minWidth: 18, flexShrink: 0,
          textShadow: '0 0 5px rgba(255,140,0,.4)' }}>#{teamObj.season_rank}</span>
      )}
      <TeamLogo team={teamObj.team} size={22} />
      <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: '.34rem',
        color: isWinner ? '#7FFF8A' : 'rgba(255,255,255,.82)',
        flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        letterSpacing: 1,
        textShadow: isWinner ? '0 0 8px rgba(0,255,80,.3)' : 'none' }}>{teamObj.team}</span>
      {wins > 0 && (
        <span style={{ fontFamily: "'VT323',monospace", fontSize: '1.15rem', lineHeight: 1,
          color: isWinner ? '#FFD700' : 'rgba(255,255,255,.26)',
          textShadow: isWinner ? '0 0 8px rgba(255,215,0,.4)' : 'none',
          minWidth: 14, textAlign: 'right', flexShrink: 0 }}>{wins}</span>
      )}
    </div>
  );
}

// Horizontal scores: each game = one column, top team above, bot team below
function HorizontalScores({ games, topTeam, botTeam }) {
  if (!games?.length) return null;
  return (
    <div style={{ background: 'rgba(0,0,0,.42)',
      borderTop: '1px solid rgba(255,255,255,.05)', borderBottom: '1px solid rgba(255,255,255,.05)',
      padding: '.22rem .42rem' }}>

      {/* Game labels row */}
      <div style={{ display: 'flex', marginBottom: '.1rem' }}>
        <div style={{ width: 24, flexShrink: 0 }} />
        {games.map((_, i) => (
          <div key={i} style={{ flex: 1, textAlign: 'center',
            fontFamily: "'Press Start 2P',monospace", fontSize: '.18rem',
            color: 'rgba(255,255,255,.2)', letterSpacing: 0 }}>G{i + 1}</div>
        ))}
      </div>

      {/* Top team row */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '.05rem' }}>
        <div style={{ width: 24, flexShrink: 0, fontFamily: "'Press Start 2P',monospace",
          fontSize: '.22rem', color: 'rgba(255,255,255,.35)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 2 }}>
          {topTeam?.slice(0, 3)}
        </div>
        {games.map((g, i) => {
          const h  = g.home === topTeam;
          const ts = h ? g.score_home : g.score_away;
          const bs = h ? g.score_away : g.score_home;
          const w  = ts > bs;
          return (
            <div key={i} style={{ flex: 1, textAlign: 'center',
              fontFamily: "'VT323',monospace", fontSize: '1.3rem', lineHeight: 1,
              color: w ? '#FFD700' : 'rgba(255,255,255,.24)',
              textShadow: w ? '0 0 8px rgba(255,215,0,.45)' : 'none',
              fontWeight: w ? 'bold' : 'normal' }}>{ts}</div>
          );
        })}
      </div>

      {/* Bot team row */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ width: 24, flexShrink: 0, fontFamily: "'Press Start 2P',monospace",
          fontSize: '.22rem', color: 'rgba(255,255,255,.35)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 2 }}>
          {botTeam?.slice(0, 3)}
        </div>
        {games.map((g, i) => {
          const h  = g.home === topTeam;
          const bs = h ? g.score_away  : g.score_home;
          const ts = h ? g.score_home  : g.score_away;
          const w  = bs > ts;
          const ot = Number(g.ot) === 1;
          return (
            <div key={i} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
              <span style={{ fontFamily: "'VT323',monospace", fontSize: '1.3rem', lineHeight: 1,
                color: w ? '#FFD700' : 'rgba(255,255,255,.24)',
                textShadow: w ? '0 0 8px rgba(255,215,0,.45)' : 'none',
                fontWeight: w ? 'bold' : 'normal' }}>{bs}</span>
              {ot && <span style={{ position: 'absolute', top: -2, right: 0,
                fontFamily: "'Press Start 2P',monospace", fontSize: '.14rem',
                color: '#FF8C00' }}>OT</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Full matchup card
function MatchupCard({ matchup, playoffGames, seasonGames, roundIdx, totalRounds, winsNeeded, cardId }) {
  const { top, bot } = matchup;
  const rec    = computeRecord(top?.team, bot?.team, playoffGames);
  const winner = getWinner(top?.team, bot?.team, rec, winsNeeded);
  const topW   = rec?.topW ?? 0;
  const botW   = rec?.botW ?? 0;
  const games  = rec?.games ?? [];
  const done   = !!winner;
  const blurb  = rsBlurb(top?.team, bot?.team, seasonGames);
  const bdrCol = done ? 'rgba(0,210,90,.32)' : 'rgba(255,140,0,.26)';
  const accCol = done
    ? 'linear-gradient(90deg,transparent,rgba(0,210,90,.42),transparent)'
    : 'linear-gradient(90deg,transparent,rgba(255,140,0,.38),transparent)';

  return (
    <div data-card-id={cardId} style={{ width: '100%', borderRadius: 10, overflow: 'hidden',
      position: 'relative',
      background: 'linear-gradient(160deg,rgba(5,12,35,.94) 0%,rgba(0,5,18,.97) 100%)',
      border: `1px solid ${bdrCol}` }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: accCol, zIndex: 1 }} />

      <TeamRow teamObj={top} wins={topW} isWinner={winner === top?.team}
        isTbd={!top} showSeed={roundIdx === 0} />

      {games.length > 0 ? (
        <HorizontalScores games={games} topTeam={top?.team} botTeam={bot?.team} />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '.26rem 0',
          borderTop: '1px solid rgba(255,255,255,.04)', borderBottom: '1px solid rgba(255,255,255,.04)',
          background: 'rgba(0,0,0,.2)' }}>
          <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: '.24rem',
            color: 'rgba(135,206,235,.28)', letterSpacing: 3 }}>VS</span>
        </div>
      )}

      <TeamRow teamObj={bot} wins={botW} isWinner={winner === bot?.team}
        isTbd={!bot} showSeed={roundIdx === 0} />

      {/* RS blurb — always shown when both teams are known */}
      {blurb && top && bot && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: '.28rem', padding: '.18rem .42rem',
          background: 'rgba(0,0,0,.3)', borderTop: '1px solid rgba(255,255,255,.04)' }}>
          <span style={{ fontFamily: "'Press Start 2P',monospace", fontSize: '.22rem',
            color: blurb.color, letterSpacing: 1, whiteSpace: 'nowrap' }}>{blurb.text}</span>
          <span style={{ fontFamily: "'VT323',monospace", fontSize: '.95rem', lineHeight: 1,
            color: blurb.color }}>{blurb.detail}</span>
        </div>
      )}
    </div>
  );
}

// Champion box
function ChampionBox({ teamObj, selectedLeague }) {
  const [tErr, setTErr] = useState(false);
  const tSrc = selectedLeague?.toUpperCase().startsWith('Q')
    ? '/assets/awards/q_champ.png'
    : '/assets/awards/w_champ.png';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.5rem',
      padding: '.95rem .75rem 1.2rem',
      background: 'radial-gradient(ellipse at center,rgba(255,215,0,.1) 0%,transparent 70%)',
      border: '2px solid rgba(255,215,0,.4)', borderRadius: 14,
      minWidth: 126, position: 'relative', overflow: 'hidden' }}>

      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg,transparent,#FFD700,transparent)',
        animation: 'champShim 2.5s ease-in-out infinite' }} />
      <div style={{ position: 'absolute', width: 86, height: 86, borderRadius: '50%',
        top: 8, left: '50%', transform: 'translateX(-50%)',
        background: 'radial-gradient(circle,rgba(255,215,0,.28) 0%,transparent 70%)',
        animation: 'glowPulse 2s ease-in-out infinite', pointerEvents: 'none' }} />

      {!tErr ? (
        <img src={tSrc} alt="Trophy" onError={() => setTErr(true)}
          style={{ width: 66, height: 66, objectFit: 'contain', position: 'relative', zIndex: 1,
            filter: 'drop-shadow(0 0 14px rgba(255,215,0,.9))',
            animation: 'trophyBob 3s ease-in-out infinite' }} />
      ) : (
        <div style={{ fontSize: '2.9rem', position: 'relative', zIndex: 1,
          filter: 'drop-shadow(0 0 14px rgba(255,215,0,.9))',
          animation: 'trophyBob 3s ease-in-out infinite' }}>🏆</div>
      )}

      {teamObj ? (
        <>
          <div style={{ borderRadius: 9, background: 'rgba(0,0,0,.6)',
            border: '2px solid rgba(255,215,0,.65)', padding: 3,
            boxShadow: '0 0 14px rgba(255,215,0,.26)' }}>
            <TeamLogo team={teamObj.team} size={46} />
          </div>
          <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: '.46rem',
            color: '#FFD700', letterSpacing: 2,
            textShadow: '0 0 10px rgba(255,215,0,.55)', textAlign: 'center', maxWidth: 106 }}>
            {teamObj.team}
          </div>
        </>
      ) : (
        <div style={{ fontFamily: "'VT323',monospace", fontSize: '2.5rem',
          color: 'rgba(255,255,255,.17)' }}>?</div>
      )}

      <div style={{ fontFamily: "'Press Start 2P',monospace", fontSize: '.26rem',
        color: 'rgba(255,215,0,.48)', letterSpacing: 3 }}>CHAMPION</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
//  Main export
// ═══════════════════════════════════════════════════════════════════════════
export default function PlayoffBracket({
  seeds, playoffGames = [], seasonGames = [],
  selectedSeason, playoffTeams, selectedLeague,
}) {
  const wrapRef  = useRef(null);
  const [lines, setLines] = useState([]);

  // ── Guard
  if (!seeds || seeds.length < 2 || !playoffTeams || playoffTeams < 2) return (
    <div style={{ textAlign: 'center', padding: '3rem',
      fontFamily: "'Press Start 2P',monospace", color: 'rgba(255,255,255,.3)', fontSize: '.7rem' }}>
      NOT ENOUGH TEAMS FOR BRACKET
    </div>
  );

  // ── Bracket math
  const snap2      = n => Math.pow(2, Math.floor(Math.log2(n)));
  const bSize      = snap2(Math.min(seeds.length, playoffTeams));
  const bSeeds     = seeds.slice(0, bSize);
  const winsNeeded = bSize <= 4 ? 3 : 4;
  const allRounds  = buildAllRounds(bSeeds, playoffGames, winsNeeded);
  const T          = allRounds.length;
  const bestOf     = winsNeeded * 2 - 1;

  // ── Champion
  const fin     = allRounds[T - 1][0];
  const finRec  = computeRecord(fin?.top?.team, fin?.bot?.team, playoffGames);
  const champT  = getWinner(fin?.top?.team, fin?.bot?.team, finRec, winsNeeded);
  const champObj = champT ? (champT === fin?.top?.team ? fin.top : fin.bot) : null;

  // ── Column descriptors
  // For round r, allRounds[r].length is always a power of 2.
  // Left half  = indices [0 .. half-1]   (half = length/2, always integer)
  // Right half = indices [half .. end-1]
  // Layout order: [L0][L1]…[L(T-2)] [FINAL] [CHAMP] [R(T-2)]…[R1][R0]
  const colDescs = [];
  for (let r = 0; r < T - 1; r++) {
    const ms   = allRounds[r];
    const half = ms.length / 2; // exact integer guaranteed
    colDescs.push({ kind: 'left',  r, matchups: ms.slice(0, half) });
  }
  colDescs.push({ kind: 'final', r: T - 1, matchups: [fin] });
  colDescs.push({ kind: 'champ', r: -1,    matchups: [] });
  for (let r = T - 2; r >= 0; r--) {
    const ms   = allRounds[r];
    const half = ms.length / 2;
    colDescs.push({ kind: 'right', r, matchups: ms.slice(half) });
  }

  // ── Card ID scheme
  // left:  L-{r}-{localIndex}   (localIndex = 0..half-1)
  // right: R-{r}-{localIndex}   (localIndex = 0..half-1, half = allRounds[r].length/2)
  // final: F
  const cardId = (kind, r, mi) => {
    if (kind === 'final') return 'F';
    return `${kind === 'left' ? 'L' : 'R'}-${r}-${mi}`;
  };

  // ── SVG connector line computation (runs after every render)
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const tid = setTimeout(() => {
      const wR = wrap.getBoundingClientRect();

      const el = id => wrap.querySelector(`[data-card-id="${id}"]`);
      const midY = id => {
        const e = el(id); if (!e) return null;
        const r = e.getBoundingClientRect();
        return (r.top + r.bottom) / 2 - wR.top;
      };
      const rx = id => { const e = el(id); return e ? e.getBoundingClientRect().right - wR.left : null; };
      const lx = id => { const e = el(id); return e ? e.getBoundingClientRect().left  - wR.left : null; };

      const newLines = [];
      const addLine = (x1, y1, x2, y2) => {
        if (x1 == null || x2 == null || y1 == null || y2 == null) return;
        const mx = (x1 + x2) / 2;
        newLines.push(`M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`);
      };

      // Left side: card L-{r}-{i} → L-{r+1}-{floor(i/2)}  (or F when r+1 === T-1)
      for (let r = 0; r < T - 1; r++) {
        const half = allRounds[r].length / 2;
        for (let i = 0; i < half; i++) {
          const src   = `L-${r}-${i}`;
          const nextR = r + 1;
          const nextI = Math.floor(i / 2);
          const dst   = nextR === T - 1 ? 'F' : `L-${nextR}-${nextI}`;
          addLine(rx(src), midY(src), lx(dst), midY(dst));
        }
      }

      // Right side: card R-{r}-{i} → R-{r+1}-{floor(i/2)} (or F when r+1 === T-1)
      // Right local index maps: global index = half + i
      // Next round global index = floor((half + i) / 2)
      // Next round local index  = globalNextIdx - nextHalf
      for (let r = 0; r < T - 1; r++) {
        const ms        = allRounds[r];
        const half      = ms.length / 2;
        for (let i = 0; i < half; i++) {
          const src      = `R-${r}-${i}`;
          const globalI  = half + i;
          const nextR    = r + 1;
          const nextGI   = Math.floor(globalI / 2);
          let dst;
          if (nextR === T - 1) {
            dst = 'F';
          } else {
            const nextHalf = allRounds[nextR].length / 2;
            dst = `R-${nextR}-${nextGI - nextHalf}`;
          }
          // Right-side lines go right←left: src.left → dst.right
          addLine(lx(src), midY(src), rx(dst), midY(dst));
        }
      }

      setLines(newLines);
    }, 100);
    return () => clearTimeout(tid);
  });

  const COL_W = 188;

  return (
    <div style={{ fontFamily: "'Press Start 2P',monospace",
      padding: '2rem 1.5rem 4rem', overflowX: 'auto' }}>

      <style>{`
        @keyframes champShim { 0%,100%{opacity:.35} 50%{opacity:1} }
        @keyframes glowPulse { 0%,100%{transform:translateX(-50%) scale(1);opacity:.48}
                               50%{transform:translateX(-50%) scale(1.45);opacity:1} }
        @keyframes trophyBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div style={{ fontSize: '.95rem', color: '#FFD700', letterSpacing: 4,
          textShadow: '0 0 12px #FFD700, 0 0 24px #FF8C00' }}>
          {selectedSeason} PLAYOFF BRACKET
        </div>
        <div style={{ fontFamily: "'VT323',monospace", fontSize: '1.2rem',
          color: '#87CEEB', letterSpacing: 2, marginTop: '.4rem', opacity: .62 }}>
          {bSize}-TEAM FIELD · BEST OF {bestOf}
        </div>
      </div>

      {/* Bracket wrapper — relative so SVG lines overlay correctly */}
      <div ref={wrapRef} style={{ position: 'relative', overflowX: 'auto' }}>

        {/* SVG connector lines */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 0, overflow: 'visible' }}>
          {lines.map((d, i) => (
            <path key={i} d={d} fill="none"
              stroke="rgba(255,140,0,.22)" strokeWidth={1.5}
              strokeDasharray="4 3" strokeLinecap="round" />
          ))}
        </svg>

        {/* Column flex row */}
        <div style={{ display: 'flex', alignItems: 'stretch', justifyContent: 'center',
          minWidth: 'max-content', gap: 0, position: 'relative', zIndex: 1 }}>

          {colDescs.map((col, ci) => {

            // ── Champion column
            if (col.kind === 'champ') return (
              <div key={ci} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 12px', flexShrink: 0 }}>
                <ChampionBox teamObj={champObj} selectedLeague={selectedLeague} />
              </div>
            );

            const isFinal   = col.kind === 'final';
            const lblColor  = isFinal ? 'rgba(255,215,0,.68)' : 'rgba(135,206,235,.52)';
            const lblBorder = isFinal ? 'rgba(255,215,0,.2)'  : 'rgba(135,206,235,.16)';

            return (
              <div key={ci} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                width: COL_W, flexShrink: 0, padding: '0 5px' }}>

                {/* Round label */}
                <div style={{ fontFamily: "'Press Start 2P',monospace",
                  fontSize: '.28rem', letterSpacing: 2, whiteSpace: 'nowrap',
                  padding: '.22rem .5rem', borderRadius: 4,
                  border: `1px solid ${lblBorder}`,
                  background: 'rgba(0,0,0,.35)', color: lblColor,
                  marginBottom: '.6rem', flexShrink: 0 }}>
                  {roundLabel(col.r, T)}
                </div>

                {/* Cards — evenly spaced */}
                <div style={{ display: 'flex', flexDirection: 'column',
                  flex: 1, width: '100%', justifyContent: 'space-around' }}>
                  {col.matchups.map((m, mi) => (
                    <div key={mi} style={{ flex: 1, display: 'flex',
                      flexDirection: 'column', justifyContent: 'center', padding: '7px 0' }}>
                      <MatchupCard
                        matchup={m}
                        playoffGames={playoffGames}
                        seasonGames={seasonGames}
                        roundIdx={col.r}
                        totalRounds={T}
                        winsNeeded={winsNeeded}
                        cardId={cardId(col.kind, col.r, mi)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ textAlign: 'center', fontFamily: "'VT323',monospace",
        fontSize: '1rem', color: 'rgba(135,206,235,.26)', marginTop: '1.25rem', letterSpacing: 2 }}>
        ← SCROLL TO VIEW FULL BRACKET →
      </div>
    </div>
  );
}
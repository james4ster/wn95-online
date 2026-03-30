import React, { useRef, useState, useLayoutEffect, useCallback, useEffect, useMemo } from 'react'
import { supabase } from '../../utils/supabaseClient'

/* ═══════════════════════════════════════════════════════════════
   SEED BRACKET MATH — identical logic to your PlayoffBracket.jsx
═══════════════════════════════════════════════════════════════ */
const FIRST_ROUND_PAIRS = {
  2:  [[1,2]],
  4:  [[1,4],[2,3]],
  8:  [[1,8],[4,5],[3,6],[2,7]],
  16: [[1,16],[8,9],[4,13],[5,12],[6,11],[3,14],[7,10],[2,15]],
}

function bracketSize(n) {
  for (const s of [2,4,8,16]) if (n <= s) return s
  return 16
}

function buildBracket(playoffGames, numTeams) {
  const size  = bracketSize(numTeams || 8)
  const pairs = FIRST_ROUND_PAIRS[size]
  const nR    = Math.log2(size)
  const byRound = new Map()

  ;(playoffGames || []).forEach(g => {
    const r = g.round
    if (!byRound.has(r)) byRound.set(r, new Map())
    const rMap = byRound.get(r)
    const addTo = (key) => {
      if (!rMap.has(key)) rMap.set(key, [])
      if (!rMap.get(key).find(x => x.game_number === g.game_number && x.team_code_a === g.team_code_a))
        rMap.get(key).push(g)
    }
    if (g.series_number != null) addTo(g.series_number)
    if (g.team_code_a && g.team_code_b) {
      addTo(`${g.team_code_a}-${g.team_code_b}`)
      addTo(`${g.team_code_b}-${g.team_code_a}`)
    }
  })
  byRound.forEach(rMap => {
    rMap.forEach((games, k) => rMap.set(k, games.sort((a,b) => (a.game_number??0)-(b.game_number??0))))
  })

  function getGames(round, seriesNum, top, bot) {
    const rMap = byRound.get(round)
    if (!rMap) return []
    if (seriesNum != null && rMap.has(seriesNum)) return rMap.get(seriesNum)
    if (top && bot) { const k1 = `${top}-${bot}`; if (rMap.has(k1)) return rMap.get(k1) }
    return []
  }
  function getSeriesLength(games) {
    for (const g of games) if (g.series_length != null && g.series_length > 0) return g.series_length
    return 7
  }
  function record(games, top, bot) {
    let tW = 0, bW = 0
    ;(games||[]).forEach(g => {
      const aT = g.team_code_a === top
      const ts = aT ? g.team_a_score : g.team_b_score
      const bs = aT ? g.team_b_score : g.team_a_score
      if (ts > bs) tW++; else if (bs > ts) bW++
    })
    return { tW, bW }
  }
  function winnerOf(games, top, bot, winsNeeded) {
    if (!top || !bot) return null
    const { tW, bW } = record(games, top, bot)
    if (tW >= winsNeeded) return top
    if (bW >= winsNeeded) return bot
    return null
  }

  const seedPairToSN = new Map()
  ;(playoffGames||[]).forEach(g => {
    if (g.round !== 1) return
    const lo = Math.min(g.seed_a??99, g.seed_b??99)
    const hi = Math.max(g.seed_a??99, g.seed_b??99)
    const key = `${lo}-${hi}`
    if (!seedPairToSN.has(key)) seedPairToSN.set(key, g.series_number)
  })

  const allRounds = []
  const r1 = pairs.map((pair) => {
    const [sA, sB] = pair
    const actualSN = seedPairToSN.get(`${sA}-${sB}`) ?? null
    const games    = getGames(1, actualSN, null, null)
    let top = null, bot = null
    if (games.length) {
      const g0 = games[0]
      if ((g0.seed_a??99) <= (g0.seed_b??99)) { top = g0.team_code_a; bot = g0.team_code_b }
      else                                     { top = g0.team_code_b; bot = g0.team_code_a }
    }
    const seriesLength = getSeriesLength(games)
    const winsNeeded   = Math.ceil(seriesLength / 2)
    const rec          = record(games, top, bot)
    return {
      round: 1, topSeed: sA, botSeed: sB, topTeam: top, botTeam: bot,
      topW: rec.tW, botW: rec.bW, games, seriesLength, winsNeeded,
      winner: winnerOf(games, top, bot, winsNeeded), sn: actualSN,
    }
  })
  allRounds.push(r1)

  for (let r = 2; r <= nR; r++) {
    const prev = allRounds[r-2]
    const rnd  = []
    for (let i = 0; i < Math.floor(prev.length/2); i++) {
      const tP = prev[i*2], bP = prev[i*2+1]
      const top = tP.winner || null, bot = bP.winner || null
      const topSeed = top ? (top===tP.topTeam ? tP.topSeed : tP.botSeed) : null
      const botSeed = bot ? (bot===bP.topTeam ? bP.topSeed : bP.botSeed) : null
      const games        = getGames(r, null, top, bot)
      const seriesLength = getSeriesLength(games)
      const winsNeeded   = Math.ceil(seriesLength / 2)
      const rec          = record(games, top, bot)
      rnd.push({
        round: r, topSeed, botSeed, topTeam: top, botTeam: bot,
        topW: rec.tW, botW: rec.bW, games, seriesLength, winsNeeded,
        winner: winnerOf(games, top, bot, winsNeeded), sn: null,
      })
    }
    allRounds.push(rnd)
  }

  const champSlot   = allRounds[allRounds.length-1][0]
  const leftRounds  = allRounds.slice(0,-1).map(rnd => rnd.slice(0, Math.ceil(rnd.length/2)))
  const rightRounds = allRounds.slice(0,-1).map(rnd => rnd.slice(Math.ceil(rnd.length/2)))
  return { leftRounds, rightRounds, champSlot, nRounds: nR }
}

/* ═══════════════════════════════════════════════════════════════
   H2H LOGIC — season games only, all-time
═══════════════════════════════════════════════════════════════ */
function computeH2H(teamA, teamB, games) {
  let wA = 0, wB = 0, t = 0, gfA = 0, gfB = 0, soA = 0, soB = 0
  const all = []
  ;(games||[]).forEach(g => {
    const aIsHome = g.home === teamA && g.away === teamB
    const aIsAway = g.home === teamB && g.away === teamA
    if (!aIsHome && !aIsAway) return
    const sA = aIsHome ? g.score_home : g.score_away
    const sB = aIsHome ? g.score_away : g.score_home
    gfA += sA; gfB += sB
    if (sB === 0) soA++
    if (sA === 0) soB++
    if (sA > sB)      { wA++; all.push({ winner: teamA, sA, sB, ot: g.ot, id: g.id }) }
    else if (sB > sA) { wB++; all.push({ winner: teamB, sA, sB, ot: g.ot, id: g.id }) }
    else              { t++;  all.push({ winner: null,  sA, sB, ot: g.ot, id: g.id }) }
  })
  all.sort((a,b) => b.id - a.id)
  return { wA, wB, t, gfA, gfB, soA, soB, gp: wA+wB+t, last10: all.slice(0,10) }
}

/* ═══════════════════════════════════════════════════════════════
   BnB THEME
═══════════════════════════════════════════════════════════════ */
const T = {
  accent:   '#cc1a1a',
  accentBr: '#ff4444',
  win:      '#22c55e',
  loss:     '#ef4444',
  text:     '#ffffff',
  textDim:  'rgba(255,255,255,0.55)',
  textFnt:  'rgba(255,255,255,0.18)',
  bg:       '#0a0a0a',
  bgCard:   'linear-gradient(155deg,#0a0505 0%,#110808 100%)',
  font:     "'Barlow Condensed', sans-serif",
  mono:     "'VT323', monospace",
}

/* ═══════════════════════════════════════════════════════════════
   BRACKET PRIMITIVES
═══════════════════════════════════════════════════════════════ */
function Logo({ team, size=22 }) {
  const [err, setErr] = useState(false)
  const base = { width: size, height: size, flexShrink: 0, borderRadius: 3, background: 'rgba(0,0,0,0.5)', padding: 2, objectFit: 'contain', display: 'block' }
  if (!team) return <div style={{ ...base, border: '1px dashed rgba(204,26,26,0.25)', display:'flex', alignItems:'center', justifyContent:'center', color: T.textFnt, fontSize: 9 }}>?</div>
  if (err)   return <div style={{ ...base, display:'flex', alignItems:'center', justifyContent:'center', color: T.accent, fontSize: 10, fontFamily: T.font, fontWeight: 900 }}>{team.slice(0,3)}</div>
  return <img src={`/assets/teamLogos/${team}.png`} alt={team} style={base} onError={() => setErr(true)} />
}

function TeamRow({ team, seed, wins, isWinner, winsNeeded=4, flipped=false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5, padding: '4px 7px', minHeight: 26,
      background: isWinner ? 'linear-gradient(90deg,rgba(34,197,94,0.1),rgba(34,197,94,0.02))' : 'transparent',
      borderLeft:  !flipped && isWinner ? '2px solid #22c55e' : !flipped ? '2px solid transparent' : 'none',
      borderRight:  flipped && isWinner ? '2px solid #22c55e' :  flipped ? '2px solid transparent' : 'none',
      flexDirection: flipped ? 'row-reverse' : 'row', boxSizing: 'border-box',
    }}>
      {seed != null && <span style={{ color: T.accent, fontFamily: T.font, fontWeight: 900, fontSize: 11, minWidth: 16, textAlign: flipped ? 'left' : 'right' }}>{seed}</span>}
      <Logo team={team} size={20} />
      <span style={{ flex: 1, color: isWinner ? T.win : team ? T.text : T.textFnt, fontFamily: T.font, fontSize: 15, fontWeight: 700, letterSpacing: 1, textAlign: flipped ? 'right' : 'left' }}>{team || 'TBD'}</span>
      <div style={{ display: 'flex', gap: 3, flexDirection: flipped ? 'row-reverse' : 'row' }}>
        {Array.from({ length: winsNeeded }).map((_,i) => (
          <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i < wins ? (isWinner ? '#22c55e' : T.accent) : 'rgba(255,255,255,0.07)', boxShadow: i < wins ? `0 0 5px ${isWinner ? '#22c55e' : T.accent}` : 'none' }} />
        ))}
      </div>
    </div>
  )
}

function ScoreGrid({ games, topTeam, botTeam, seriesLength=7 }) {
  if (!games?.length) return null
  const gC = games.slice(0, seriesLength)
  return (
    <div style={{ background: 'rgba(0,0,0,0.4)', padding: '3px 7px', borderTop: '1px solid rgba(204,26,26,0.1)', borderBottom: '1px solid rgba(204,26,26,0.1)' }}>
      <div style={{ display: 'flex', marginBottom: 2 }}>
        <div style={{ width: 22 }} />
        {gC.map((_,i) => <div key={i} style={{ flex: 1, textAlign: 'center', color: 'rgba(255,255,255,0.28)', fontFamily: T.font, fontSize: 10, fontWeight: 700 }}>{i+1}</div>)}
      </div>
      {[topTeam, botTeam].map((team, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: idx===0 ? 2 : 0 }}>
          <div style={{ width: 22, fontFamily: T.font, fontSize: 11, fontWeight: 700, color: T.textDim }}>{team?.slice(0,3)}</div>
          {gC.map((g, i) => {
            const aT  = idx === 0
            const ts  = g.team_code_a === topTeam ? g.team_a_score : g.team_b_score
            const bs  = g.team_code_a === topTeam ? g.team_b_score : g.team_a_score
            const val = aT ? ts : bs
            const won = (aT ? ts : bs) > (aT ? bs : ts)
            return <div key={i} style={{ flex: 1, textAlign: 'center', fontFamily: T.mono, fontSize: 16, color: won ? T.win : T.textFnt, fontWeight: won ? 'bold' : 'normal' }}>{val ?? '-'}</div>
          })}
        </div>
      ))}
    </div>
  )
}

function BottomBar({ topW, botW, winner: w, topTeam, botTeam }) {
  if (!topTeam || !botTeam) return null
  if (w) {
    const wW = w===topTeam ? topW : botW
    const lW = w===topTeam ? botW : topW
    return <div style={{ textAlign:'center', padding:'4px 5px', fontFamily: T.font, fontSize: 12, fontWeight: 900, color: T.win, background:'rgba(34,197,94,0.07)', borderTop:'1px solid rgba(34,197,94,0.18)', letterSpacing: 1 }}>{w} WINS {wW}-{lW}</div>
  }
  if ((topW+botW) === 0) return null
  const leading = topW > botW ? topTeam : botTeam
  const label   = topW === botW ? `TIED ${topW}-${botW}` : `${leading} LEADS ${Math.max(topW,botW)}-${Math.min(topW,botW)}`
  return <div style={{ textAlign:'center', padding:'3px 5px', fontFamily: T.font, fontSize: 11, fontWeight: 700, color: T.accent, background:'rgba(204,26,26,0.05)', borderTop:'1px solid rgba(204,26,26,0.1)', letterSpacing: 1 }}>{label}</div>
}

function MatchupCard({ slot, cardRef, flipped=false, onSelect, isSelected }) {
  const { topTeam, botTeam, topSeed, botSeed, topW, botW, games, winner: w, winsNeeded=4, seriesLength=7 } = slot
  const done   = !!w
  const active = !done && (topW+botW) > 0
  const bdr    = isSelected ? 'rgba(204,26,26,0.8)' : done ? 'rgba(34,197,94,0.45)' : active ? 'rgba(204,26,26,0.45)' : 'rgba(204,26,26,0.18)'
  const glow   = isSelected ? 'rgba(204,26,26,0.15)' : done ? 'rgba(34,197,94,0.07)' : 'rgba(204,26,26,0.03)'

  return (
    <div ref={cardRef} onClick={() => topTeam && botTeam && onSelect && onSelect(slot)} style={{
      width: '100%', border: `1px solid ${bdr}`, borderRadius: 7,
      background: T.bgCard,
      boxShadow: `0 0 10px ${glow}, 0 3px 12px rgba(0,0,0,0.5), inset 0 0 12px rgba(0,0,0,0.4)`,
      overflow: 'hidden', boxSizing: 'border-box',
      cursor: (topTeam && botTeam) ? 'pointer' : 'default',
      transition: 'border-color 0.15s',
    }}>
      <TeamRow team={topTeam} seed={topSeed} wins={topW} isWinner={w===topTeam} winsNeeded={winsNeeded} flipped={flipped} />
      <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(204,26,26,0.18),transparent)' }} />
      {games.length > 0
        ? <ScoreGrid games={games} topTeam={topTeam} botTeam={botTeam} seriesLength={seriesLength} />
        : <div style={{ textAlign:'center', padding:'3px 0', color: T.textFnt, fontFamily: T.font, fontSize: 11, letterSpacing: 3 }}>— VS —</div>
      }
      <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(204,26,26,0.18),transparent)' }} />
      <TeamRow team={botTeam} seed={botSeed} wins={botW} isWinner={w===botTeam} winsNeeded={winsNeeded} flipped={flipped} />
      <BottomBar topW={topW} botW={botW} winner={w} topTeam={topTeam} botTeam={botTeam} />
    </div>
  )
}

function ChampCard({ slot, cardRef }) {
  const { topTeam, botTeam, topSeed, botSeed, topW, botW, games, winner: w, winsNeeded=4, seriesLength=7 } = slot || {}
  function CRow({ team, seed, wins, isWinner }) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 10px', minHeight:36, background: isWinner ? 'linear-gradient(90deg,rgba(34,197,94,0.12),rgba(34,197,94,0.03))' : 'transparent', borderLeft: isWinner ? '3px solid #22c55e' : '3px solid transparent', boxSizing:'border-box' }}>
        {seed != null && <span style={{ color: T.accent, fontFamily: T.font, fontWeight: 900, fontSize: 12, minWidth: 20, textAlign:'right' }}>{seed}</span>}
        <Logo team={team} size={26} />
        <span style={{ flex:1, color: isWinner ? T.win : team ? T.text : T.textFnt, fontFamily: T.font, fontSize: 17, fontWeight: 900, letterSpacing: 1 }}>{team || 'TBD'}</span>
        <div style={{ display:'flex', gap:4 }}>
          {Array.from({ length: winsNeeded }).map((_,i) => <div key={i} style={{ width:7, height:7, borderRadius:'50%', background: i < wins ? (isWinner ? '#22c55e' : T.accent) : 'rgba(255,255,255,0.07)', boxShadow: i < wins ? `0 0 6px ${isWinner ? '#22c55e' : T.accent}` : 'none' }} />)}
        </div>
      </div>
    )
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, flexShrink:0 }}>
      <div style={{ fontSize:26, lineHeight:1 }}>🏆</div>
      <div ref={cardRef} style={{ width:185, border:'2px solid rgba(204,26,26,0.6)', borderRadius:8, background: T.bgCard, boxShadow:'0 0 20px rgba(204,26,26,0.18),inset 0 0 20px rgba(204,26,26,0.04)', overflow:'hidden' }}>
        <div style={{ textAlign:'center', padding:'7px 0 4px', fontFamily: T.font, fontSize:11, fontWeight:900, color: T.accent, letterSpacing:3, textShadow:`0 0 8px ${T.accent}` }}>CHAMPIONSHIP</div>
        <div style={{ height:1, background:`linear-gradient(90deg,transparent,${T.accent},transparent)`, margin:'2px 0' }} />
        <CRow team={topTeam} seed={topSeed} wins={topW||0} isWinner={w===topTeam} />
        <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(204,26,26,0.2),transparent)' }} />
        {(games||[]).length > 0 ? <ScoreGrid games={games} topTeam={topTeam} botTeam={botTeam} seriesLength={seriesLength} /> : <div style={{ textAlign:'center', padding:'4px 0', color: T.textFnt, fontFamily: T.font, fontSize:11, letterSpacing:3 }}>— VS —</div>}
        <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(204,26,26,0.2),transparent)' }} />
        <CRow team={botTeam} seed={botSeed} wins={botW||0} isWinner={w===botTeam} />
        {!w && <BottomBar topW={topW||0} botW={botW||0} winner={w} topTeam={topTeam} botTeam={botTeam} />}
        {w && (
          <div style={{ textAlign:'center', padding:'12px 8px 14px', borderTop:`1px solid rgba(204,26,26,0.3)`, background:'rgba(204,26,26,0.07)' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:7 }}><Logo team={w} size={52} /></div>
            <div style={{ fontFamily: T.font, fontSize:13, fontWeight:900, color: T.accent, letterSpacing:3, textShadow:`0 0 8px ${T.accent}` }}>CHAMPION</div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   SVG CONNECTOR LINES
═══════════════════════════════════════════════════════════════ */
function BracketLines({ getBox, leftRefs, rightRefs, champRef, leftRounds, rightRounds }) {
  const [segs, setSegs] = useState([])
  const compute = useCallback(() => {
    const ns = []
    function half(refsGrid, rounds, flipped) {
      for (let r = 0; r < rounds.length-1; r++) {
        const curRefs = refsGrid[r] || [], nextRefs = refsGrid[r+1] || []
        for (let ni = 0; ni < nextRefs.length; ni++) {
          const rTop = curRefs[ni*2], rBot = curRefs[ni*2+1], rNext = nextRefs[ni]
          if (!rTop?.current || !rNext?.current) continue
          const bTop = getBox(rTop.current), bBot = rBot?.current ? getBox(rBot.current) : null, bNext = getBox(rNext.current)
          if (!bTop || !bNext) continue
          const sF  = flipped ? bTop.left  : bTop.right
          const sFB = bBot    ? (flipped ? bBot.left  : bBot.right) : sF
          const sT  = flipped ? bNext.right : bNext.left
          const spX = (sF + sT) / 2
          const tY  = bTop.midY, bY = bBot ? bBot.midY : tY, mY = (tY+bY)/2
          const id  = `${flipped?'R':'L'}-${r}-${ni}`
          ns.push({ key:`${id}-ht`, x1:sF,  y1:tY, x2:spX, y2:tY })
          if (bBot) ns.push({ key:`${id}-hb`, x1:sFB, y1:bY, x2:spX, y2:bY })
          ns.push({ key:`${id}-v`,  x1:spX, y1:tY, x2:spX, y2:bY })
          ns.push({ key:`${id}-hn`, x1:spX, y1:mY, x2:sT,  y2:mY })
          ns.push({ key:`${id}-dot`, dot:true, cx:spX, cy:mY })
        }
      }
      const lastRefs = refsGrid[rounds.length-1]
      if (lastRefs?.length===1 && champRef?.current) {
        const bL = getBox(lastRefs[0].current), bC = getBox(champRef.current)
        if (bL && bC) {
          const from = flipped ? bL.left : bL.right, to = flipped ? bC.right : bC.left
          const id = `${flipped?'R':'L'}-champ`
          ns.push({ key:`${id}-h`, x1:from, y1:bL.midY, x2:to, y2:bL.midY })
          ns.push({ key:`${id}-dot`, dot:true, cx:to, cy:bL.midY })
        }
      }
    }
    half(leftRefs, leftRounds, false)
    half(rightRefs, rightRounds, true)
    setSegs(ns)
  }, [getBox, leftRefs, rightRefs, champRef, leftRounds, rightRounds])

  useLayoutEffect(() => {
    const t = setTimeout(compute, 80)
    window.addEventListener('resize', compute)
    return () => { clearTimeout(t); window.removeEventListener('resize', compute) }
  }, [compute])

  return (
    <svg style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', pointerEvents:'none', overflow:'visible', zIndex:2 }}>
      <defs>
        <filter id="bnbLnGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {segs.map(s => {
        if (s.dot) return (
          <g key={s.key}>
            <circle cx={s.cx} cy={s.cy} r={5} fill={T.accent} opacity={0.15} />
            <circle cx={s.cx} cy={s.cy} r={2.8} fill={T.accent} filter="url(#bnbLnGlow)" />
            <circle cx={s.cx} cy={s.cy} r={1.2} fill="#fff" opacity={0.9} />
          </g>
        )
        const d = `M ${s.x1} ${s.y1} L ${s.x2} ${s.y2}`
        return (
          <g key={s.key}>
            <path d={d} fill="none" stroke={T.accent} strokeWidth={4} opacity={0.05} />
            <path d={d} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth={2.5} />
            <path d={d} fill="none" stroke={T.accent} strokeWidth={1.2} opacity={0.5} filter="url(#bnbLnGlow)" strokeLinecap="round" />
          </g>
        )
      })}
    </svg>
  )
}

/* ═══════════════════════════════════════════════════════════════
   BRACKET CANVAS
═══════════════════════════════════════════════════════════════ */
function BracketCanvas({ leftRounds, rightRounds, champSlot, nRounds, onSelectSlot, selectedSlot }) {
  const containerRef = useRef(null)
  const champRef     = useRef(null)
  const leftRefs     = useRef([])
  const rightRefs    = useRef([])
  const CARD_W = 178, COL_GAP = 32

  const getBox = useCallback((el) => {
    if (!el || !containerRef.current) return null
    const cr = containerRef.current.getBoundingClientRect()
    const r  = el.getBoundingClientRect()
    return { left: r.left-cr.left, right: r.right-cr.left, midY: r.top-cr.top+r.height/2 }
  }, [])

  leftRounds.forEach((rnd, ri) => {
    if (!leftRefs.current[ri]) leftRefs.current[ri] = []
    rnd.forEach((_, mi) => { if (!leftRefs.current[ri][mi]) leftRefs.current[ri][mi] = React.createRef() })
  })
  rightRounds.forEach((rnd, ri) => {
    if (!rightRefs.current[ri]) rightRefs.current[ri] = []
    rnd.forEach((_, mi) => { if (!rightRefs.current[ri][mi]) rightRefs.current[ri][mi] = React.createRef() })
  })

  const LABELS = ['FIRST ROUND','SECOND ROUND','CONF. FINALS','SEMIFINALS']

  function col(rounds, refsGrid, ri, flipped) {
    const rnd = rounds[ri]
    if (!rnd) return null
    const cardGap  = Math.pow(2, ri) * 10
    const isInner  = ri === rounds.length-1

    return (
      <div key={`${flipped?'R':'L'}-${ri}`} style={{ display:'flex', flexDirection:'column', gap:`${cardGap}px`, width:CARD_W, flexShrink:0, position:'relative', zIndex:1, alignSelf:'stretch', justifyContent:'space-around' }}>
        <div style={{ position:'absolute', top:-26, left:0, right:0, textAlign:'center', fontFamily: T.font, fontSize:10, fontWeight:900, color: isInner ? T.accent : 'rgba(204,26,26,0.45)', letterSpacing:2, whiteSpace:'nowrap', textShadow: isInner ? `0 0 8px ${T.accent}` : 'none' }}>
          {LABELS[ri] || `ROUND ${ri+1}`}
        </div>
        {rnd.map((slot, mi) => {
          if (!refsGrid[ri]) refsGrid[ri] = []
          if (!refsGrid[ri][mi]) refsGrid[ri][mi] = React.createRef()
          const isSel = selectedSlot && slot.topTeam && slot.botTeam &&
            slot.topTeam === selectedSlot.topTeam && slot.botTeam === selectedSlot.botTeam && slot.round === selectedSlot.round
          return (
            <MatchupCard key={`${ri}-${mi}`} slot={slot} cardRef={refsGrid[ri][mi]} flipped={flipped} onSelect={onSelectSlot} isSelected={isSel} />
          )
        })}
      </div>
    )
  }

  const leftCols  = leftRounds.map((_, ri) => col(leftRounds,  leftRefs.current,  ri, false))
  const rightCols = rightRounds.map((_, ri) => col(rightRounds, rightRefs.current, ri, true)).reverse()

  return (
    <div style={{ padding:'0 16px 8px', overflowX:'auto', overflowY:'hidden', width:'100%', boxSizing:'border-box', height:'100%' }}>
      <div ref={containerRef} style={{ display:'flex', alignItems:'center', justifyContent:'flex-start', gap:`${COL_GAP}px`, paddingTop:30, position:'relative', minHeight:10, minWidth:1200 }}>
        <BracketLines getBox={getBox} leftRefs={leftRefs.current} rightRefs={rightRefs.current} champRef={champRef} leftRounds={leftRounds} rightRounds={rightRounds} />
        <div style={{ display:'flex', flexDirection:'row', gap:`${COL_GAP}px`, alignItems:'center', position:'relative', zIndex:1 }}>{leftCols}</div>
        <div style={{ flexShrink:0, zIndex:1, position:'relative', alignSelf:'center' }}><ChampCard slot={champSlot} cardRef={champRef} /></div>
        <div style={{ display:'flex', flexDirection:'row', gap:`${COL_GAP}px`, alignItems:'center', position:'relative', zIndex:1 }}>{rightCols}</div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   H2H PANEL
═══════════════════════════════════════════════════════════════ */
function H2HPanel({ slot, allGames }) {
  const teamA = slot?.topTeam
  const teamB = slot?.botTeam

  if (!slot || !teamA || !teamB) {
    return (
      <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:10 }}>
        <div style={{ fontSize:30, opacity:0.05 }}>⚔</div>
        <div style={{ fontFamily: T.font, fontSize:14, fontWeight:700, color:'#282828', letterSpacing:'0.2em' }}>CLICK A MATCHUP TO LOAD H2H</div>
      </div>
    )
  }

  const h2h = useMemo(() => computeH2H(teamA, teamB, allGames), [teamA, teamB, allGames])
  const { wA, wB, t, gfA, gfB, soA, soB, gp, last10 } = h2h
  const aLeads = wA > wB, bLeads = wB > wA
  const aBar = gp === 0 ? 50 : Math.round((wA / Math.max(wA+wB, 1)) * 100)

  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>
      {/* VS header */}
      <div style={{ flexShrink:0, padding:'10px 20px 8px', borderBottom:'1px solid rgba(204,26,26,0.2)', background:'linear-gradient(180deg,rgba(204,26,26,0.06) 0%,transparent 100%)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          {/* Team A */}
          <div style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
            <img src={`/assets/teamLogos/${teamA}.png`} alt={teamA} style={{ width:38, height:38, objectFit:'contain' }} onError={e => e.target.style.display='none'} />
            <div>
              <div style={{ fontFamily: T.font, fontSize:24, fontWeight:900, color:'#fff', letterSpacing:'0.1em', lineHeight:1 }}>{teamA}</div>
              <div style={{ fontFamily: T.font, fontSize:12, fontWeight:700, color: aLeads ? T.win : '#555', letterSpacing:'0.1em', marginTop:2 }}>{wA}W · {gfA}GF · {soA} SO</div>
            </div>
          </div>
          {/* Center */}
          <div style={{ flexShrink:0, padding:'0 16px', textAlign:'center' }}>
            <div style={{ fontFamily: T.font, fontSize:10, fontWeight:900, color: T.accent, letterSpacing:'0.3em', marginBottom:2 }}>ALL-TIME H2H</div>
            <div style={{ fontFamily: T.font, fontSize:26, fontWeight:900, color: T.accent }}>VS</div>
            <div style={{ fontFamily: T.font, fontSize:10, color:'#444', letterSpacing:'0.15em', marginTop:2 }}>{gp} GP{t > 0 ? ` · ${t}T` : ''}</div>
          </div>
          {/* Team B */}
          <div style={{ display:'flex', alignItems:'center', gap:10, flex:1, justifyContent:'flex-end' }}>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily: T.font, fontSize:24, fontWeight:900, color:'#fff', letterSpacing:'0.1em', lineHeight:1 }}>{teamB}</div>
              <div style={{ fontFamily: T.font, fontSize:12, fontWeight:700, color: bLeads ? T.win : '#555', letterSpacing:'0.1em', marginTop:2 }}>{wB}W · {gfB}GF · {soB} SO</div>
            </div>
            <img src={`/assets/teamLogos/${teamB}.png`} alt={teamB} style={{ width:38, height:38, objectFit:'contain' }} onError={e => e.target.style.display='none'} />
          </div>
        </div>
        {/* Win bar */}
        <div style={{ marginTop:8, display:'flex', height:5, borderRadius:3, overflow:'hidden' }}>
          <div style={{ width:`${aBar}%`, background: aLeads ? `linear-gradient(90deg,${T.accent},${T.accentBr})` : '#1e1e1e', transition:'width 0.5s ease' }} />
          <div style={{ width:`${100-aBar}%`, background: bLeads ? `linear-gradient(90deg,${T.accentBr},${T.accent})` : '#1e1e1e', transition:'width 0.5s ease' }} />
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
          <span style={{ fontFamily: T.font, fontSize:10, color:'#444' }}>{aBar}%</span>
          <span style={{ fontFamily: T.font, fontSize:10, color:'#444' }}>{100-aBar}%</span>
        </div>
      </div>

      {/* Last 10 */}
      <div style={{ flex:1, padding:'8px 20px', overflow:'hidden' }}>
        <div style={{ fontFamily: T.font, fontSize:10, fontWeight:900, color: T.accent, letterSpacing:'0.2em', marginBottom:6 }}>
          LAST {Math.min(10, last10.length)} MEETINGS (SEASON GAMES)
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
          {last10.length === 0 && <div style={{ fontFamily: T.font, fontSize:13, color:'#333', letterSpacing:'0.15em' }}>NO GAMES PLAYED</div>}
          {last10.map((g, i) => {
            const aWon = g.winner === teamA, bWon = g.winner === teamB
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px', background: i%2===0 ? 'rgba(255,255,255,0.02)' : 'transparent', borderRadius:3 }}>
                <div style={{ fontFamily: T.font, fontSize:10, color:'#333', width:22, flexShrink:0 }}>G{last10.length-i}</div>
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6 }}>
                  <span style={{ fontFamily: T.font, fontSize:14, fontWeight: aWon?900:600, color: aWon?'#fff':'#3a3a3a' }}>{teamA}</span>
                  <span style={{ fontFamily: T.mono, fontSize:22, fontWeight:900, color: aWon ? T.win : g.winner===null ? '#555' : T.loss, minWidth:22, textAlign:'right' }}>{g.sA}</span>
                </div>
                <div style={{ fontFamily: T.font, fontSize:13, color:'#2a2a2a', flexShrink:0 }}>—</div>
                <div style={{ flex:1, display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontFamily: T.mono, fontSize:22, fontWeight:900, color: bWon ? T.win : g.winner===null ? '#555' : T.loss, minWidth:22 }}>{g.sB}</span>
                  <span style={{ fontFamily: T.font, fontSize:14, fontWeight: bWon?900:600, color: bWon?'#fff':'#3a3a3a' }}>{teamB}</span>
                </div>
                {g.ot ? <div style={{ fontFamily: T.font, fontSize:9, fontWeight:900, color: T.accent, width:20, textAlign:'right', flexShrink:0 }}>OT</div> : <div style={{ width:20 }} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════════════════════ */
export default function PodcastBracket() {
  const [playoffGames, setPlayoffGames] = useState([])
  const [allGames,     setAllGames]     = useState([])
  const [bracketLg,    setBracketLg]    = useState('')
  const [loading,      setLoading]      = useState(true)
  const [selectedSlot, setSelectedSlot] = useState(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: seasons } = await supabase
        .from('seasons').select('*').ilike('lg','W%')
        .order('lg', { ascending: false }).limit(10)

      // Use most recent completed season for bracket, or current if in playoffs
      const current   = seasons?.find(s => s.status === 'season')
      const completed = seasons?.find(s => s.status === 'complete')
      // If current season is in playoffs mode, use it; otherwise use last complete
      const target = completed || current || seasons?.[0]
      if (!target) { setLoading(false); return }
      setBracketLg(target.lg)

      const [{ data: pgames }, { data: hist }] = await Promise.all([
        supabase.from('playoff_games').select('*').eq('lg', target.lg)
          .order('round').order('series_number').order('game_number'),
        supabase.from('games')
          .select('id,home,away,score_home,score_away,ot')
          .not('score_home','is',null)
          .or('mode.eq.Season,mode.eq.season,mode.ilike.season%,mode.ilike.regular%'),
      ])

      setPlayoffGames(pgames || [])
      setAllGames(hist || [])
      setLoading(false)
    }
    load()
  }, [])

  const { leftRounds, rightRounds, champSlot, nRounds } = useMemo(() => {
    if (!playoffGames.length) return { leftRounds:[], rightRounds:[], champSlot:null, nRounds:0 }
    let maxSeed = 0
    playoffGames.forEach(g => {
      if (g.seed_a != null) maxSeed = Math.max(maxSeed, g.seed_a)
      if (g.seed_b != null) maxSeed = Math.max(maxSeed, g.seed_b)
    })
    const numTeams = maxSeed > 0 ? Math.pow(2, Math.ceil(Math.log2(Math.max(maxSeed, 2)))) : 16
    return buildBracket(playoffGames, numTeams)
  }, [playoffGames])

  if (loading) return (
    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ fontFamily: T.font, fontSize:18, color: T.accent, letterSpacing:'0.2em' }}>LOADING BRACKET...</div>
    </div>
  )

  if (!playoffGames.length) return (
    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
      <div style={{ fontSize:30, opacity:0.06 }}>🏒</div>
      <div style={{ fontFamily: T.font, fontSize:14, color:'#282828', letterSpacing:'0.2em' }}>NO PLAYOFF DATA IN playoff_games TABLE</div>
    </div>
  )

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=VT323&display=swap" rel="stylesheet" />
      <style>{`@keyframes bnbChampShimmer { 0%{transform:translateX(-100%) translateY(-100%) rotate(45deg)} 100%{transform:translateX(100%) translateY(100%) rotate(45deg)} }`}</style>

      <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', background: T.bg, fontFamily: T.font }}>

        {/* ══ TOP 52%: BRACKET ══ */}
        <div style={{ flex:'0 0 52%', borderBottom:'1px solid rgba(204,26,26,0.3)', overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:12, padding:'8px 16px 5px', borderBottom:'1px solid rgba(204,26,26,0.12)' }}>
            <div style={{ width:3, height:20, background: T.accent, borderRadius:2 }} />
            <div style={{ fontSize:18, fontWeight:900, color:'#fff', letterSpacing:'0.18em' }}>PLAYOFF BRACKET</div>
            {bracketLg && <div style={{ fontSize:11, color: T.accent, letterSpacing:'0.2em', fontWeight:700 }}>{bracketLg}</div>}
            <div style={{ flex:1, height:1, background:'linear-gradient(90deg,rgba(204,26,26,0.3),transparent)' }} />
            <div style={{ fontSize:10, color:'#333', letterSpacing:'0.15em' }}>CLICK MATCHUP FOR H2H ↓</div>
          </div>
          <div style={{ flex:1, overflow:'auto' }}>
            <BracketCanvas leftRounds={leftRounds} rightRounds={rightRounds} champSlot={champSlot} nRounds={nRounds} onSelectSlot={setSelectedSlot} selectedSlot={selectedSlot} />
          </div>
        </div>

        {/* ══ BOTTOM 48%: H2H ══ */}
        <div style={{ flex:'0 0 48%', overflow:'hidden', display:'flex', flexDirection:'column', background:'rgba(0,0,0,0.25)' }}>
          <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:12, padding:'7px 16px 5px', borderBottom:'1px solid rgba(204,26,26,0.12)' }}>
            <div style={{ width:3, height:20, background: selectedSlot?.topTeam ? T.accent : '#1e1e1e', borderRadius:2, transition:'background 0.2s' }} />
            <div style={{ fontSize:16, fontWeight:900, color: selectedSlot?.topTeam ? '#fff' : '#282828', letterSpacing:'0.18em', transition:'color 0.2s' }}>
              {selectedSlot?.topTeam && selectedSlot?.botTeam
                ? `${selectedSlot.topTeam} vs ${selectedSlot.botTeam} — ALL-TIME H2H`
                : 'H2H MATCHUP DETAIL'}
            </div>
            {selectedSlot?.topTeam && (
              <button onClick={() => setSelectedSlot(null)} style={{ marginLeft:'auto', background:'transparent', border:'1px solid #1e1e1e', borderRadius:4, padding:'3px 10px', cursor:'pointer', fontFamily: T.font, fontSize:10, color:'#444', letterSpacing:'0.15em' }}>✕ CLEAR</button>
            )}
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <H2HPanel slot={selectedSlot} allGames={allGames} />
          </div>
        </div>
      </div>
    </>
  )
}

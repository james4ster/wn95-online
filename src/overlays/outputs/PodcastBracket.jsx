import React, { useRef, useState, useLayoutEffect, useCallback, useEffect, useMemo } from 'react'
import { supabase } from '../../utils/supabaseClient'

/* ═══════════════════════════════════════════════════════════════
   SEED BRACKET MATH
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
   H2H LOGIC
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
   GAME STATS H2H LOGIC
   Aggregates game_stats_team rows for teamA vs teamB this season
═══════════════════════════════════════════════════════════════ */
function computeGameStatsH2H(teamA, teamB, gameStatRows) {
  const aRows = [], bRows = []
  console.log('[BnB H2H] ' + teamA + ' vs ' + teamB + ' rows:' + (gameStatRows?.length||0))
  console.log('[BnB H2H] sample:', (gameStatRows||[]).slice(0,3).map(r => r.home+'v'+r.away+' s:'+r.season))
  ;(gameStatRows||[]).forEach(r => {
    const aIsHome = r.home === teamA && r.away === teamB
    const aIsAway = r.home === teamB && r.away === teamA
    if (!aIsHome && !aIsAway) return
    console.log('[BnB H2H] matched:', r.home+'v'+r.away)
    // For teamA: collect their stats whether home or away
    if (aIsHome) {
      aRows.push({ shots: r.home_shots, score: r.home_score, fow: r.home_fow, fo_total: r.fo_total,
        chk: r.home_chk, pass_att: r.home_pass_attempts, pass_com: r.home_pass_complete,
        pp_g: r.home_pp_g, pp_amt: r.home_pp_amt, shg: r.home_shg,
        break_att: r.home_break_attempts, break_g: r.home_break_goals,
        oxa: r.home_1xa, oxg: r.home_1xg, attack: r.home_attack, opp_shots: r.away_shots })
      bRows.push({ shots: r.away_shots, score: r.away_score, fow: r.away_fow, fo_total: r.fo_total,
        chk: r.away_chk, pass_att: r.away_pass_attempts, pass_com: r.away_pass_complete,
        pp_g: r.away_pp_g, pp_amt: r.away_pp_amt, shg: r.away_shg,
        break_att: r.away_break_attempts, break_g: r.away_break_goals,
        oxa: r.away_1xa, oxg: r.away_1xg, attack: r.away_attack, opp_shots: r.home_shots })
    } else {
      aRows.push({ shots: r.away_shots, score: r.away_score, fow: r.away_fow, fo_total: r.fo_total,
        chk: r.away_chk, pass_att: r.away_pass_attempts, pass_com: r.away_pass_complete,
        pp_g: r.away_pp_g, pp_amt: r.away_pp_amt, shg: r.away_shg,
        break_att: r.away_break_attempts, break_g: r.away_break_goals,
        oxa: r.away_1xa, oxg: r.away_1xg, attack: r.away_attack, opp_shots: r.home_shots })
      bRows.push({ shots: r.home_shots, score: r.home_score, fow: r.home_fow, fo_total: r.fo_total,
        chk: r.home_chk, pass_att: r.home_pass_attempts, pass_com: r.home_pass_complete,
        pp_g: r.home_pp_g, pp_amt: r.home_pp_amt, shg: r.home_shg,
        break_att: r.home_break_attempts, break_g: r.home_break_goals,
        oxa: r.home_1xa, oxg: r.home_1xg, attack: r.home_attack, opp_shots: r.away_shots })
    }
  })

  function agg(rows) {
    if (!rows.length) return null
    const sum = (f) => rows.reduce((s, r) => s + (r[f] || 0), 0)
    const shots      = sum('shots')
    const score      = sum('score')
    const opp_shots  = sum('opp_shots')
    const fow        = sum('fow')
    const fo_total   = sum('fo_total')
    const chk        = sum('chk')
    const pass_att   = sum('pass_att')
    const pass_com   = sum('pass_com')
    const pp_g       = sum('pp_g')
    const pp_amt     = sum('pp_amt')
    const shg        = sum('shg')
    const break_att  = sum('break_att')
    const break_g    = sum('break_g')
    const oxa        = sum('oxa')
    const oxg        = sum('oxg')

    // Parse attack time strings "HH:MM:SS" -> total seconds
    const attackSecs = rows.reduce((s, r) => {
      if (!r.attack) return s
      const parts = String(r.attack).split(':').map(Number)
      return s + (parts[0]||0)*3600 + (parts[1]||0)*60 + (parts[2]||0)
    }, 0)
    const avgAttackSecs = attackSecs / rows.length
    const atkMins = Math.floor(avgAttackSecs / 60)
    const atkSecs = Math.round(avgAttackSecs % 60)
    const atkStr  = `${atkMins}:${String(atkSecs).padStart(2,'0')}`

    return {
      sh:   shots,
      shPct: shots > 0 ? Math.round((score / shots) * 100) : 0,
      oxPct: oxa  > 0 ? Math.round((oxg  / oxa)  * 100) : 0,
      sd:   shots - opp_shots,
      foPct: fo_total > 0 ? Math.round((fow / fo_total) * 100) : 0,
      baPct: break_att > 0 ? Math.round((break_g / break_att) * 100) : 0,
      psPct: pass_att  > 0 ? Math.round((pass_com / pass_att) * 100) : 0,
      chk,
      ppg:  pp_g,
      ppa:  pp_amt,
      shg,
      atk:  atkStr,
      gp:   rows.length,
    }
  }

  return { a: agg(aRows), b: agg(bRows), gp: aRows.length }
}

/* ═══════════════════════════════════════════════════════════════
   THEME
═══════════════════════════════════════════════════════════════ */
const T = {
  accent:   '#cc1a1a',
  accentBr: '#ff4444',
  win:      '#22c55e',
  loss:     '#ef4444',
  text:     '#ffffff',
  textDim:  'rgba(255,255,255,0.55)',
  textMid:  'rgba(255,255,255,0.38)',  // minimum dim — no gray below this
  bg:       '#0a0a0a',
  bgCard:   'linear-gradient(155deg,#0a0505 0%,#110808 100%)',
  font:     "'Barlow Condensed', sans-serif",
  mono:     "'VT323', monospace",
}

/* ═══════════════════════════════════════════════════════════════
   BRACKET PRIMITIVES
═══════════════════════════════════════════════════════════════ */
function Logo({ team, size=20 }) {
  const [err, setErr] = useState(false)
  const base = { width: size, height: size, flexShrink: 0, borderRadius: 3, background: 'rgba(0,0,0,0.5)', padding: 2, objectFit: 'contain', display: 'block' }
  if (!team) return <div style={{ ...base, border: '1px dashed rgba(204,26,26,0.25)', display:'flex', alignItems:'center', justifyContent:'center', color: T.textMid, fontSize: 8 }}>?</div>
  if (err)   return <div style={{ ...base, display:'flex', alignItems:'center', justifyContent:'center', color: T.accent, fontSize: 9, fontFamily: T.font, fontWeight: 900 }}>{team.slice(0,3)}</div>
  return <img src={`/assets/teamLogos/${team}.png`} alt={team} style={base} onError={() => setErr(true)} />
}

function TeamRow({ team, seed, wins, isWinner, winsNeeded=4, flipped=false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '3px 6px', minHeight: 22,
      background: isWinner ? 'linear-gradient(90deg,rgba(34,197,94,0.1),rgba(34,197,94,0.02))' : 'transparent',
      borderLeft:  !flipped && isWinner ? '2px solid #22c55e' : !flipped ? '2px solid transparent' : 'none',
      borderRight:  flipped && isWinner ? '2px solid #22c55e' :  flipped ? '2px solid transparent' : 'none',
      flexDirection: flipped ? 'row-reverse' : 'row', boxSizing: 'border-box',
    }}>
      {seed != null && <span style={{ color: T.accent, fontFamily: T.font, fontWeight: 900, fontSize: 10, minWidth: 14, textAlign: flipped ? 'left' : 'right' }}>{seed}</span>}
      <Logo team={team} size={18} />
      <span style={{ flex: 1, color: isWinner ? T.win : team ? T.text : T.textMid, fontFamily: T.font, fontSize: 13, fontWeight: 700, letterSpacing: 1, textAlign: flipped ? 'right' : 'left' }}>{team || 'TBD'}</span>
      <div style={{ display: 'flex', gap: 2, flexDirection: flipped ? 'row-reverse' : 'row' }}>
        {Array.from({ length: winsNeeded }).map((_,i) => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i < wins ? (isWinner ? '#22c55e' : T.accent) : 'rgba(255,255,255,0.1)', boxShadow: i < wins ? `0 0 4px ${isWinner ? '#22c55e' : T.accent}` : 'none' }} />
        ))}
      </div>
    </div>
  )
}

function ScoreGrid({ games, topTeam, botTeam, seriesLength=7 }) {
  if (!games?.length) return null
  const gC = games.slice(0, seriesLength)
  return (
    <div style={{ background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderTop: '1px solid rgba(204,26,26,0.1)', borderBottom: '1px solid rgba(204,26,26,0.1)' }}>
      <div style={{ display: 'flex', marginBottom: 1 }}>
        <div style={{ width: 20 }} />
        {gC.map((_,i) => <div key={i} style={{ flex: 1, textAlign: 'center', color: T.textMid, fontFamily: T.font, fontSize: 9, fontWeight: 700 }}>{i+1}</div>)}
      </div>
      {[topTeam, botTeam].map((team, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: idx===0 ? 1 : 0 }}>
          <div style={{ width: 20, fontFamily: T.font, fontSize: 10, fontWeight: 700, color: T.textDim }}>{team?.slice(0,3)}</div>
          {gC.map((g, i) => {
            const aT  = idx === 0
            const ts  = g.team_code_a === topTeam ? g.team_a_score : g.team_b_score
            const bs  = g.team_code_a === topTeam ? g.team_b_score : g.team_a_score
            const val = aT ? ts : bs
            const won = (aT ? ts : bs) > (aT ? bs : ts)
            return <div key={i} style={{ flex: 1, textAlign: 'center', fontFamily: T.mono, fontSize: 14, color: won ? T.win : T.textMid, fontWeight: won ? 'bold' : 'normal' }}>{val ?? '-'}</div>
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
    return <div style={{ textAlign:'center', padding:'3px 5px', fontFamily: T.font, fontSize: 11, fontWeight: 900, color: T.win, background:'rgba(34,197,94,0.07)', borderTop:'1px solid rgba(34,197,94,0.18)', letterSpacing: 1 }}>{w} WINS {wW}-{lW}</div>
  }
  if ((topW+botW) === 0) return null
  const leading = topW > botW ? topTeam : botTeam
  const label   = topW === botW ? `TIED ${topW}-${botW}` : `${leading} LEADS ${Math.max(topW,botW)}-${Math.min(topW,botW)}`
  return <div style={{ textAlign:'center', padding:'2px 5px', fontFamily: T.font, fontSize: 10, fontWeight: 700, color: T.accent, background:'rgba(204,26,26,0.05)', borderTop:'1px solid rgba(204,26,26,0.1)', letterSpacing: 1 }}>{label}</div>
}

function MatchupCard({ slot, cardRef, flipped=false, onSelect, isSelected }) {
  const { topTeam, botTeam, topSeed, botSeed, topW, botW, games, winner: w, winsNeeded=4, seriesLength=7 } = slot
  const done   = !!w
  const active = !done && (topW+botW) > 0
  const bdr    = isSelected ? 'rgba(204,26,26,0.8)' : done ? 'rgba(34,197,94,0.45)' : active ? 'rgba(204,26,26,0.45)' : 'rgba(204,26,26,0.18)'
  const glow   = isSelected ? 'rgba(204,26,26,0.15)' : done ? 'rgba(34,197,94,0.07)' : 'rgba(204,26,26,0.03)'

  return (
    <div ref={cardRef} onClick={() => topTeam && botTeam && onSelect && onSelect(slot)} style={{
      width: '100%', border: `1px solid ${bdr}`, borderRadius: 6,
      background: T.bgCard,
      boxShadow: `0 0 8px ${glow}, 0 2px 8px rgba(0,0,0,0.5), inset 0 0 10px rgba(0,0,0,0.4)`,
      overflow: 'hidden', boxSizing: 'border-box',
      cursor: (topTeam && botTeam) ? 'pointer' : 'default',
      transition: 'border-color 0.15s',
    }}>
      <TeamRow team={topTeam} seed={topSeed} wins={topW} isWinner={w===topTeam} winsNeeded={winsNeeded} flipped={flipped} />
      <div style={{ height: 1, background: 'linear-gradient(90deg,transparent,rgba(204,26,26,0.18),transparent)' }} />
      {games.length > 0
        ? <ScoreGrid games={games} topTeam={topTeam} botTeam={botTeam} seriesLength={seriesLength} />
        : <div style={{ textAlign:'center', padding:'2px 0', color: T.textMid, fontFamily: T.font, fontSize: 10, letterSpacing: 3 }}>— VS —</div>
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
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px', minHeight:30, background: isWinner ? 'linear-gradient(90deg,rgba(34,197,94,0.12),rgba(34,197,94,0.03))' : 'transparent', borderLeft: isWinner ? '3px solid #22c55e' : '3px solid transparent', boxSizing:'border-box' }}>
        {seed != null && <span style={{ color: T.accent, fontFamily: T.font, fontWeight: 900, fontSize: 11, minWidth: 16, textAlign:'right' }}>{seed}</span>}
        <Logo team={team} size={22} />
        <span style={{ flex:1, color: isWinner ? T.win : team ? T.text : T.textMid, fontFamily: T.font, fontSize: 15, fontWeight: 900, letterSpacing: 1 }}>{team || 'TBD'}</span>
        <div style={{ display:'flex', gap:3 }}>
          {Array.from({ length: winsNeeded }).map((_,i) => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background: i < wins ? (isWinner ? '#22c55e' : T.accent) : 'rgba(255,255,255,0.1)', boxShadow: i < wins ? `0 0 5px ${isWinner ? '#22c55e' : T.accent}` : 'none' }} />)}
        </div>
      </div>
    )
  }
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:5, flexShrink:0 }}>
      <div style={{ fontSize:22, lineHeight:1 }}>🏆</div>
      <div ref={cardRef} style={{ width:165, border:'2px solid rgba(204,26,26,0.6)', borderRadius:7, background: T.bgCard, boxShadow:'0 0 18px rgba(204,26,26,0.18),inset 0 0 18px rgba(204,26,26,0.04)', overflow:'hidden' }}>
        <div style={{ textAlign:'center', padding:'5px 0 3px', fontFamily: T.font, fontSize:10, fontWeight:900, color: T.accent, letterSpacing:3, textShadow:`0 0 8px ${T.accent}` }}>CHAMPIONSHIP</div>
        <div style={{ height:1, background:`linear-gradient(90deg,transparent,${T.accent},transparent)`, margin:'1px 0' }} />
        <CRow team={topTeam} seed={topSeed} wins={topW||0} isWinner={w===topTeam} />
        <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(204,26,26,0.2),transparent)' }} />
        {(games||[]).length > 0 ? <ScoreGrid games={games} topTeam={topTeam} botTeam={botTeam} seriesLength={seriesLength} /> : <div style={{ textAlign:'center', padding:'3px 0', color: T.textMid, fontFamily: T.font, fontSize:10, letterSpacing:3 }}>— VS —</div>}
        <div style={{ height:1, background:'linear-gradient(90deg,transparent,rgba(204,26,26,0.2),transparent)' }} />
        <CRow team={botTeam} seed={botSeed} wins={botW||0} isWinner={w===botTeam} />
        {!w && <BottomBar topW={topW||0} botW={botW||0} winner={w} topTeam={topTeam} botTeam={botTeam} />}
        {w && (
          <div style={{ textAlign:'center', padding:'10px 6px 12px', borderTop:`1px solid rgba(204,26,26,0.3)`, background:'rgba(204,26,26,0.07)' }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:5 }}><Logo team={w} size={44} /></div>
            <div style={{ fontFamily: T.font, fontSize:11, fontWeight:900, color: T.accent, letterSpacing:3, textShadow:`0 0 8px ${T.accent}` }}>CHAMPION</div>
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
  const CARD_W = 148, COL_GAP = 26

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
    const cardGap  = Math.pow(2, ri) * 8
    const isInner  = ri === rounds.length-1

    return (
      <div key={`${flipped?'R':'L'}-${ri}`} style={{ display:'flex', flexDirection:'column', gap:`${cardGap}px`, width:CARD_W, flexShrink:0, position:'relative', zIndex:1, alignSelf:'stretch', justifyContent:'space-around' }}>
        <div style={{ position:'absolute', top:-24, left:0, right:0, textAlign:'center', fontFamily: T.font, fontSize:9, fontWeight:900, color: isInner ? T.accent : 'rgba(204,26,26,0.45)', letterSpacing:2, whiteSpace:'nowrap', textShadow: isInner ? `0 0 8px ${T.accent}` : 'none' }}>
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
    <div style={{ padding:'0 12px 8px', overflowX:'auto', overflowY:'hidden', width:'100%', boxSizing:'border-box', height:'100%' }}>
      <div ref={containerRef} style={{ display:'flex', alignItems:'center', justifyContent:'flex-start', gap:`${COL_GAP}px`, paddingTop:28, position:'relative', minHeight:10, minWidth:1050 }}>
        <BracketLines getBox={getBox} leftRefs={leftRefs.current} rightRefs={rightRefs.current} champRef={champRef} leftRounds={leftRounds} rightRounds={rightRounds} />
        <div style={{ display:'flex', flexDirection:'row', gap:`${COL_GAP}px`, alignItems:'center', position:'relative', zIndex:1 }}>{leftCols}</div>
        <div style={{ flexShrink:0, zIndex:1, position:'relative', alignSelf:'center' }}><ChampCard slot={champSlot} cardRef={champRef} /></div>
        <div style={{ display:'flex', flexDirection:'row', gap:`${COL_GAP}px`, alignItems:'center', position:'relative', zIndex:1 }}>{rightCols}</div>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   H2H SECTION HEADER
═══════════════════════════════════════════════════════════════ */
function SectionHeader({ label, sub }) {
  return (
    <div style={{
      flexShrink: 0, padding: '5px 14px',
      background: 'rgba(204,26,26,0.06)',
      borderBottom: '1px solid rgba(204,26,26,0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ fontFamily: T.font, fontSize: 13, fontWeight: 900, color: T.accent, letterSpacing: '0.25em' }}>{label}</div>
      {sub && <div style={{ fontFamily: T.font, fontSize: 12, color: T.textMid, letterSpacing: '0.15em' }}>{sub}</div>}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   TEAM IDENTITY HEADER — logo + name shown above each column
═══════════════════════════════════════════════════════════════ */
function TeamHeader({ team, align = 'left' }) {
  const [err, setErr] = useState(false)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
      padding: '4px 10px 3px',
      borderBottom: '1px solid rgba(204,26,26,0.15)',
      background: 'rgba(0,0,0,0.2)',
      flexShrink: 0,
    }}>
      {align === 'right' && (
        <span style={{ fontFamily: T.font, fontSize: 20, fontWeight: 900, color: T.text, letterSpacing: '0.1em' }}>{team}</span>
      )}
      {!err
        ? <img src={`/assets/teamLogos/${team}.png`} alt={team}
            style={{ width: 28, height: 28, objectFit: 'contain', filter: 'drop-shadow(0 0 4px rgba(204,26,26,0.4))' }}
            onError={() => setErr(true)} />
        : <div style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.font, fontSize: 13, fontWeight: 900, color: T.accent }}>{team?.slice(0,3)}</div>
      }
      {align === 'left' && (
        <span style={{ fontFamily: T.font, fontSize: 20, fontWeight: 900, color: T.text, letterSpacing: '0.1em' }}>{team}</span>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   H2H RECORD PANEL — This Season or All-Time
   Layout: [Logo + TeamA name] stat | LABEL | stat [TeamB name + Logo]
═══════════════════════════════════════════════════════════════ */
function H2HRecordPanel({ label, h2h, teamA, teamB, gp }) {
  const { wA, wB, t, gfA, gfB, soA, soB } = h2h

  // No L5 — only 2 games per season
  const rows = [
    { stat: 'W',  vA: wA,   vB: wB,   lowerBetter: false },
    { stat: 'GF', vA: gfA,  vB: gfB,  lowerBetter: false },
    { stat: 'GA', vA: gfB,  vB: gfA,  lowerBetter: true  },
    { stat: 'SO', vA: soA,  vB: soB,  lowerBetter: false },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      <SectionHeader label={label} sub={`${gp} GP${t > 0 ? ` · ${t}T` : ''}`} />

      {/* Team identity row */}
      <div style={{ display: 'flex', flexShrink: 0 }}>
        <div style={{ flex: 1 }}><TeamHeader team={teamA} align="left" /></div>
        <div style={{ width: 38, flexShrink: 0, borderBottom: '1px solid rgba(204,26,26,0.15)', background: 'rgba(0,0,0,0.2)' }} />
        <div style={{ flex: 1 }}><TeamHeader team={teamB} align="right" /></div>
      </div>

      {/* Stat rows */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: '4px 10px' }}>
        {rows.map(({ stat, vA, vB, lowerBetter }) => {
          const aWins = lowerBetter ? vA < vB : vA > vB
          const bWins = lowerBetter ? vB < vA : vB > vA
          return (
            <div key={stat} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {/* Team A value */}
              <div style={{
                flex: 1, textAlign: 'right',
                fontFamily: T.font, fontSize: 36, fontWeight: 900, lineHeight: 1,
                color: aWins ? '#fff' : T.textMid,
                textShadow: aWins ? '0 0 12px rgba(255,255,255,0.15)' : 'none',
              }}>{vA}</div>

              {/* Stat label */}
              <div style={{
                flexShrink: 0, width: 38, textAlign: 'center',
                fontFamily: T.font, fontSize: 12, fontWeight: 900,
                color: 'rgba(204,26,26,0.7)', letterSpacing: '0.1em',
              }}>{stat}</div>

              {/* Team B value */}
              <div style={{
                flex: 1, textAlign: 'left',
                fontFamily: T.font, fontSize: 36, fontWeight: 900, lineHeight: 1,
                color: bWins ? '#fff' : T.textMid,
                textShadow: bWins ? '0 0 12px rgba(255,255,255,0.15)' : 'none',
              }}>{vB}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   GAME STATS PANEL — aggregated season h2h game stats
═══════════════════════════════════════════════════════════════ */
function GameStatsPanel({ teamA, teamB, statsA, statsB, gp }) {
  if (!statsA || !statsB) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, borderLeft: '1px solid rgba(204,26,26,0.2)', borderRight: '1px solid rgba(204,26,26,0.2)' }}>
        <SectionHeader label="GAME STATS" sub={`${gp} GP`} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontFamily: T.font, fontSize: 13, color: T.textMid, letterSpacing: '0.2em' }}>NO GAME STATS</div>
        </div>
      </div>
    )
  }

  const rows = [
    { label: 'SH',   vA: statsA.sh,    vB: statsB.sh,    fmt: v => v,       lowerBetter: false },
    { label: 'SH%',  vA: statsA.shPct, vB: statsB.shPct, fmt: v => `${v}%`, lowerBetter: false },
    { label: '1X%',  vA: statsA.oxPct, vB: statsB.oxPct, fmt: v => `${v}%`, lowerBetter: false },
    { label: 'SD',   vA: statsA.sd,    vB: statsB.sd,    fmt: v => (v > 0 ? `+${v}` : `${v}`), lowerBetter: false },
    { label: 'FO%',  vA: statsA.foPct, vB: statsB.foPct, fmt: v => `${v}%`, lowerBetter: false },
    { label: 'BA%',  vA: statsA.baPct, vB: statsB.baPct, fmt: v => `${v}%`, lowerBetter: false },
    { label: 'PS%',  vA: statsA.psPct, vB: statsB.psPct, fmt: v => `${v}%`, lowerBetter: false },
    { label: 'CHK',  vA: statsA.chk,   vB: statsB.chk,   fmt: v => v,       lowerBetter: false },
    { label: 'PPG',  vA: statsA.ppg,   vB: statsB.ppg,   fmt: v => v,       lowerBetter: false },
    { label: 'PPA',  vA: statsA.ppa,   vB: statsB.ppa,   fmt: v => v,       lowerBetter: true  },
    { label: 'SHG',  vA: statsA.shg,   vB: statsB.shg,   fmt: v => v,       lowerBetter: false },
    { label: 'ATK',  vA: statsA.atk,   vB: statsB.atk,   fmt: v => v,       lowerBetter: false, isStr: true },
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, borderLeft: '1px solid rgba(204,26,26,0.2)', borderRight: '1px solid rgba(204,26,26,0.2)' }}>
      <SectionHeader label="GAME STATS" sub={`${gp} GP`} />

      {/* Team identity row */}
      <div style={{ display: 'flex', flexShrink: 0 }}>
        <div style={{ flex: 1 }}><TeamHeader team={teamA} align="left" /></div>
        <div style={{ width: 38, flexShrink: 0, borderBottom: '1px solid rgba(204,26,26,0.15)', background: 'rgba(0,0,0,0.2)' }} />
        <div style={{ flex: 1 }}><TeamHeader team={teamB} align="right" /></div>
      </div>

      {/* Stat rows — smaller font to fit 12 rows */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', padding: '2px 10px', overflow: 'hidden' }}>
        {rows.map(({ label, vA, vB, fmt, lowerBetter, isStr }) => {
          const aWins = isStr ? false : (lowerBetter ? vA < vB : vA > vB)
          const bWins = isStr ? false : (lowerBetter ? vB < vA : vB > vA)
          // For ATK compare seconds
          const aWinsAtk = isStr && statsA && statsB ? (() => {
            const toSec = s => { const p = String(s).split(':').map(Number); return (p[0]||0)*60+(p[1]||0) }
            return toSec(statsA.atk) > toSec(statsB.atk)
          })() : false
          const bWinsAtk = isStr && statsA && statsB ? (() => {
            const toSec = s => { const p = String(s).split(':').map(Number); return (p[0]||0)*60+(p[1]||0) }
            return toSec(statsB.atk) > toSec(statsA.atk)
          })() : false

          const aBright = isStr ? aWinsAtk : aWins
          const bBright = isStr ? bWinsAtk : bWins

          return (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                flex: 1, textAlign: 'right',
                fontFamily: T.font, fontSize: 20, fontWeight: 900, lineHeight: 1,
                color: aBright ? '#fff' : T.textMid,
                textShadow: aBright ? '0 0 10px rgba(255,255,255,0.12)' : 'none',
              }}>{fmt(vA)}</div>

              <div style={{
                flexShrink: 0, width: 38, textAlign: 'center',
                fontFamily: T.font, fontSize: 10, fontWeight: 900,
                color: 'rgba(204,26,26,0.7)', letterSpacing: '0.08em',
              }}>{label}</div>

              <div style={{
                flex: 1, textAlign: 'left',
                fontFamily: T.font, fontSize: 20, fontWeight: 900, lineHeight: 1,
                color: bBright ? '#fff' : T.textMid,
                textShadow: bBright ? '0 0 10px rgba(255,255,255,0.12)' : 'none',
              }}>{fmt(vB)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   H2H PANEL — full bottom strip
   LEFT = This Season  |  CENTER = Game Stats  |  RIGHT = All-Time
═══════════════════════════════════════════════════════════════ */
function H2HPanel({ slot, allGames, seasonGames, gameStats, onClear }) {
  const teamA = slot?.topTeam
  const teamB = slot?.botTeam

  if (!slot || !teamA || !teamB) {
    return (
      <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <div style={{ fontFamily: T.font, fontSize: 16, fontWeight: 700, color: T.textMid, letterSpacing: '0.25em' }}>
          ← CLICK ANY MATCHUP TO SEE H2H STATS
        </div>
      </div>
    )
  }

  const h2hAll    = useMemo(() => computeH2H(teamA, teamB, allGames),    [teamA, teamB, allGames])
  const h2hSeason = useMemo(() => computeH2H(teamA, teamB, seasonGames), [teamA, teamB, seasonGames])
  const gsH2H     = useMemo(() => computeGameStatsH2H(teamA, teamB, gameStats), [teamA, teamB, gameStats])

  return (
    <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'row', overflow:'hidden', position:'relative' }}>

      {/* Clear button — top right corner */}
      {onClear && (
        <button onClick={onClear} style={{
          position: 'absolute', top: 6, right: 10, zIndex: 10,
          background: 'transparent', border: '1px solid rgba(204,26,26,0.3)',
          borderRadius: 3, padding: '3px 10px', cursor: 'pointer',
          fontFamily: T.font, fontSize: 11, color: T.textMid, letterSpacing: '0.15em',
        }}>✕ CLEAR</button>
      )}

      {/* ── LEFT: THIS SEASON ── */}
      <H2HRecordPanel label="THIS SEASON" h2h={h2hSeason} teamA={teamA} teamB={teamB} gp={h2hSeason.gp} />

      {/* ── CENTER: GAME STATS ── */}
      <GameStatsPanel teamA={teamA} teamB={teamB} statsA={gsH2H.a} statsB={gsH2H.b} gp={gsH2H.gp} />

      {/* ── RIGHT: ALL-TIME ── */}
      <H2HRecordPanel label="ALL-TIME" h2h={h2hAll} teamA={teamA} teamB={teamB} gp={h2hAll.gp} />

    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════════════════════ */
export default function PodcastBracket() {
  const [availableLgs, setAvailableLgs] = useState([])
  const [playoffGames, setPlayoffGames] = useState([])
  const [allGames,     setAllGames]     = useState([])
  const [seasonGames,  setSeasonGames]  = useState([])
  const [gameStats,    setGameStats]    = useState([])
  const [bracketLg,    setBracketLg]    = useState('')
  const [loading,      setLoading]      = useState(true)
  const [selectedSlot, setSelectedSlot] = useState(null)

  // Step 1: on mount, fetch all lgs that have playoff data and default to latest
  useEffect(() => {
    const init = async () => {
      const { data } = await supabase
        .from('playoff_games')
        .select('lg')
        .ilike('lg', 'W%')
        .order('lg', { ascending: false })
      if (!data?.length) { setLoading(false); return }
      // dedupe
      const lgs = [...new Set(data.map(r => r.lg))]
      setAvailableLgs(lgs)
      setBracketLg(lgs[0]) // default to latest
    }
    init()
  }, [])

  // Step 2: whenever bracketLg changes, reload all data for that season
  useEffect(() => {
    if (!bracketLg) return
    const load = async () => {
      setLoading(true)
      setSelectedSlot(null)

      const [
        { data: pgames },
        { data: regSeasonAll },
        { data: regSeasonCurrent },
        { data: gStats },
        { data: playoffStatsAll },
      ] = await Promise.all([
        // Bracket data — full playoff_games row for this lg
        supabase.from('playoff_games').select('*').eq('lg', bracketLg)
          .order('round').order('series_number').order('game_number'),
        // All-time reg season games (all lgs)
        supabase.from('games')
          .select('id,home,away,score_home,score_away,ot,lg')
          .not('score_home', 'is', null),
        // This season reg season games
        supabase.from('games')
          .select('id,home,away,score_home,score_away,ot,lg')
          .eq('lg', bracketLg)
          .not('score_home', 'is', null),
        // Game stats for this lg — reg season + playoffs (no type filter)
        supabase.from('game_stats_team')
          .select('*')
          .eq('season', bracketLg),
        // All-time playoff scores via game_stats_team — has correct home/away + scores for all lgs
        supabase.from('game_stats_team')
          .select('id,season,home,away,home_score,away_score,ot_flag,playoff_game_id')
          .not('playoff_game_id', 'is', null),
      ])

      // Normalize game_stats_team playoff rows to the same shape as games rows for computeH2H
      // game_stats_team already has correct home/away designation + scores
      const normalizePOStats = (rows) => (rows||[]).map(g => ({
        id:         g.playoff_game_id,  // use playoff_game_id as the unique id
        home:       g.home,
        away:       g.away,
        score_home: g.home_score,
        score_away: g.away_score,
        ot:         g.ot_flag,
        lg:         g.season,           // season col = lg
      }))

      const allPlayoffNorm    = normalizePOStats(playoffStatsAll)
      const seasonPlayoffNorm = allPlayoffNorm.filter(g => g.lg === bracketLg)

      // Merge reg season + playoff rows for H2H consumption
      const allGamesMerged    = [...(regSeasonAll||[]),     ...allPlayoffNorm]
      const seasonGamesMerged = [...(regSeasonCurrent||[]), ...seasonPlayoffNorm]

      console.log('[BnB] lg:', bracketLg,
        '| pgames:', pgames?.length,
        '| seasonGames (reg+po):', seasonGamesMerged.length,
        '| allGames (reg+po):', allGamesMerged.length,
        '| gameStats:', gStats?.length,
        '| playoffStats all-time:', allPlayoffNorm.length)

      setPlayoffGames(pgames || [])
      setAllGames(allGamesMerged)
      setSeasonGames(seasonGamesMerged)
      setGameStats(gStats || [])
      setLoading(false)
    }
    load()
  }, [bracketLg])

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
      <div style={{ fontFamily: T.font, fontSize:16, color: T.accent, letterSpacing:'0.2em' }}>LOADING BRACKET...</div>
    </div>
  )

  if (!playoffGames.length) return (
    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:12 }}>
      <div style={{ fontSize:26, opacity:0.06 }}>🏒</div>
      <div style={{ fontFamily: T.font, fontSize:12, color: T.textMid, letterSpacing:'0.2em' }}>NO PLAYOFF DATA IN playoff_games TABLE</div>
    </div>
  )

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;900&family=VT323&display=swap" rel="stylesheet" />

      <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', background: T.bg, fontFamily: T.font }}>

        {/* ══ TOP 65%: BRACKET ══ */}
        <div style={{ flex:'0 0 65%', borderBottom:'2px solid rgba(204,26,26,0.4)', overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:12, padding:'5px 14px 3px', borderBottom:'1px solid rgba(204,26,26,0.15)' }}>
            <div style={{ width:3, height:20, background: T.accent, borderRadius:2 }} />
            <div style={{ fontSize:18, fontWeight:900, color:'#fff', letterSpacing:'0.18em' }}>PLAYOFF BRACKET</div>
            {/* Season selector */}
            {availableLgs.length > 0 && (
              <select
                value={bracketLg}
                onChange={e => setBracketLg(e.target.value)}
                style={{
                  background: '#0f0f0f',
                  border: '1px solid rgba(204,26,26,0.4)',
                  borderRadius: 3,
                  color: T.accent,
                  fontFamily: T.font,
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.15em',
                  padding: '3px 8px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {availableLgs.map(lg => (
                  <option key={lg} value={lg} style={{ background: '#0f0f0f', color: T.accent }}>{lg}</option>
                ))}
              </select>
            )}
            <div style={{ flex:1, height:1, background:'linear-gradient(90deg,rgba(204,26,26,0.3),transparent)' }} />
            <div style={{ fontSize:11, color: T.textMid, letterSpacing:'0.15em', fontWeight:700 }}>CLICK MATCHUP → H2H BELOW</div>
          </div>
          <div style={{ flex:1, overflow:'auto' }}>
            <BracketCanvas leftRounds={leftRounds} rightRounds={rightRounds} champSlot={champSlot} nRounds={nRounds} onSelectSlot={setSelectedSlot} selectedSlot={selectedSlot} />
          </div>
        </div>

        {/* ══ BOTTOM 35%: H2H STATS ══ */}
        <div style={{ flex:'0 0 35%', overflow:'hidden', display:'flex', flexDirection:'column', background:'rgba(0,0,0,0.3)' }}>
          <H2HPanel
            slot={selectedSlot}
            allGames={allGames}
            seasonGames={seasonGames}
            gameStats={gameStats}
            onClear={() => setSelectedSlot(null)}
          />
        </div>
      </div>
    </>
  )
}
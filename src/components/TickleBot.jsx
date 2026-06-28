import { useState, useRef, useEffect } from "react";
import { supabase } from "../utils/supabaseClient";

const TICKLEBOT_AVATAR = '/assets/TickleBot.png';
const PLAYOFF_SPOTS = 16;
const WINS_TO_CLINCH = 4; // best-of-7

// ─── Season detection ──────────────────────────────────────────────────────
async function fetchCurrentSeason() {
  const { data, error } = await supabase
    .from("games")
    .select("lg")
    .order("lg", { ascending: false })
    .limit(1)
    .single();
  if (error) console.error("[TickleBot] season fetch error:", error);
  return data?.lg ?? null;
}

// ─── All data fetch ────────────────────────────────────────────────────────
// ─── All data fetch ────────────────────────────────────────────────────────
async function fetchAllData(season) {
    const [
      { data: played,    error: e1 },
      { data: unplayed,  error: e2 },
      { data: poNow,     error: e3 },
      { data: poHistory, error: e4 },
      { data: teams,     error: e5 },
    ] = await Promise.all([
      supabase.from("games")
        .select("home, away, score_home, score_away")
        .eq("lg", season)
        .not("score_home", "is", null),
      supabase.from("games")
        .select("home, away")
        .eq("lg", season)
        .is("score_home", null),
      supabase.from("playoff_games")
        .select("lg, round, series_number, game_number, team_code_a, team_code_b, team_a_score, team_b_score, seed_a, seed_b, series_length")
        .eq("lg", season)
        .order("round").order("series_number").order("game_number"),
      supabase.from("playoff_games")
        .select("lg, round, series_number, game_number, team_code_a, team_code_b, team_a_score, team_b_score, seed_a, seed_b")
        .neq("lg", season)
        .order("lg").order("round").order("series_number").order("game_number"),
      supabase.from("teams")
        .select("lg, abr, manager_id"),
    ]);
  
    [e1,e2,e3,e4,e5].forEach((e,i) => e && console.error(`[TickleBot] fetch error ${i+1}:`, e));
    console.log("[TickleBot] season:", season, "| RS played:", played?.length, "| RS unplayed:", unplayed?.length, "| PO now:", poNow?.length, "| PO history:", poHistory?.length, "| teams:", teams?.length);
  
    // ── Build code -> manager_id lookup (season-scoped) ─────────────────────
    const codeToManager = {}; // key: `${lg}_${abr}` -> manager_id
    for (const t of teams ?? []) {
      codeToManager[`${t.lg}_${t.abr}`] = t.manager_id;
    }
  
    // ── Build manager_id -> canonical code ──────────────────────────────────
    // Prefer the code they're using THIS season; if inactive this season,
    // fall back to their most recent code across all seasons.
    const managerCurrentCode = {};
    const managerLatestCode = {}; // manager_id -> { lg, abr } of most recent season seen
    for (const t of teams ?? []) {
      if (t.lg === season) managerCurrentCode[t.manager_id] = t.abr;
      const prev = managerLatestCode[t.manager_id];
      if (!prev || t.lg > prev.lg) managerLatestCode[t.manager_id] = { lg: t.lg, abr: t.abr };
    }
    function canonicalCode(lg, code) {
      const mgr = codeToManager[`${lg}_${code}`];
      if (!mgr) return code; // unknown mapping, leave as-is
      return managerCurrentCode[mgr] ?? managerLatestCode[mgr]?.abr ?? code;
    }
  
    // ── Regular season standings ───────────────────────────────────────────
    const teamMap = {};
    const ensure = (code) => {
      if (!teamMap[code]) teamMap[code] = { team_code: code, wins: 0, losses: 0, gf: 0, ga: 0, gp: 0 };
    };
    for (const g of played ?? []) {
      ensure(g.home); ensure(g.away);
      const hw = g.score_home > g.score_away;
      teamMap[g.home].gp++; teamMap[g.away].gp++;
      teamMap[g.home].gf += g.score_home; teamMap[g.home].ga += g.score_away;
      teamMap[g.away].gf += g.score_away; teamMap[g.away].ga += g.score_home;
      if (hw) { teamMap[g.home].wins++; teamMap[g.away].losses++; }
      else    { teamMap[g.away].wins++; teamMap[g.home].losses++; }
    }
    const remainingByTeam = {};
    const remainingGames = unplayed ?? [];
    for (const g of remainingGames) {
      remainingByTeam[g.home] = remainingByTeam[g.home] ?? [];
      remainingByTeam[g.away] = remainingByTeam[g.away] ?? [];
      remainingByTeam[g.home].push(g.away);
      remainingByTeam[g.away].push(g.home);
    }
    const standings = Object.values(teamMap)
      .map((t) => ({
        ...t,
        points: t.wins * 2,
        gd: t.gf - t.ga,
        gamesRemaining: (remainingByTeam[t.team_code] ?? []).length,
        remainingOpponents: remainingByTeam[t.team_code] ?? [],
      }))
      .sort((a, b) => b.points - a.points || b.gd - a.gd);
  
    // ── Current season playoff series (source of truth from playoff_games) ──
    const seriesMap = {};
    for (const g of poNow ?? []) {
      const key = `R${g.round}_S${g.series_number}`;
      if (!seriesMap[key]) {
        seriesMap[key] = {
          round: g.round,
          seriesNumber: g.series_number,
          teamA: g.team_code_a,
          teamB: g.team_code_b,
          seedA: g.seed_a,
          seedB: g.seed_b,
          seriesLength: g.series_length ?? 7,
          winsA: 0, winsB: 0,
          games: [],
        };
      }
      const s = seriesMap[key];
      const wasPlayed = g.team_a_score !== null && g.team_b_score !== null;
      if (wasPlayed) {
        if (g.team_a_score > g.team_b_score) s.winsA++;
        else s.winsB++;
      }
      s.games.push({ num: g.game_number, sA: g.team_a_score, sB: g.team_b_score, played: wasPlayed });
    }
    const playoffSeries = Object.values(seriesMap)
      .sort((a, b) => a.round - b.round || a.seriesNumber - b.seriesNumber);
  
    // ── Historical series — canonicalize team codes via manager lineage ────
    const histMap = {};
    for (const g of poHistory ?? []) {
      const key = `${g.lg}_R${g.round}_S${g.series_number}`;
      if (!histMap[key]) {
        histMap[key] = {
          lg: g.lg, round: g.round,
          teamA: canonicalCode(g.lg, g.team_code_a),
          teamB: canonicalCode(g.lg, g.team_code_b),
          seedA: g.seed_a, seedB: g.seed_b,
          winsA: 0, winsB: 0, totalGames: 0,
        };
      }
      const h = histMap[key];
      if (g.team_a_score !== null && g.team_b_score !== null) {
        h.totalGames++;
        if (g.team_a_score > g.team_b_score) h.winsA++;
        else h.winsB++;
      }
    }
    const historicalSeries = Object.values(histMap)
      .sort((a, b) => a.lg.localeCompare(b.lg) || a.round - b.round);
  
    // ── H2H win rates — keyed on canonical (current-era) codes ──────────────
    const h2hMap = {};
    for (const s of historicalSeries) {
      const pairKey = [s.teamA, s.teamB].sort().join("_");
      if (!h2hMap[pairKey]) h2hMap[pairKey] = { teams: [s.teamA, s.teamB], wins: { [s.teamA]: 0, [s.teamB]: 0 }, series: 0 };
      const winner = s.winsA >= WINS_TO_CLINCH ? s.teamA : s.winsB >= WINS_TO_CLINCH ? s.teamB : null;
      if (winner) h2hMap[pairKey].wins[winner]++;
      h2hMap[pairKey].series++;
    }
  
    // ── Per-team historical playoff stats — canonicalized ──────────────────
    const teamPoStats = {};
    for (const s of historicalSeries) {
      const winner = s.winsA >= WINS_TO_CLINCH ? s.teamA : s.winsB >= WINS_TO_CLINCH ? s.teamB : null;
      if (!winner) continue;
      for (const team of [s.teamA, s.teamB]) {
        if (!teamPoStats[team]) teamPoStats[team] = { seriesWins: 0, seriesLosses: 0, gamesWon: 0, gamesLost: 0 };
        const isWinner = team === winner;
        teamPoStats[team].seriesWins   += isWinner ? 1 : 0;
        teamPoStats[team].seriesLosses += isWinner ? 0 : 1;
        teamPoStats[team].gamesWon      += team === s.teamA ? s.winsA : s.winsB;
        teamPoStats[team].gamesLost     += team === s.teamA ? s.winsB : s.winsA;
      }
    }
  
    return { standings, remainingGames, remainingByTeam, playoffSeries, historicalSeries, h2hMap, teamPoStats };
  }

// ─── Intent detection — figures out what data the question needs ───────────
// ─── Intent detection ───────────────────────────────────────────────────
function detectIntent(userMessages) {
    const lastMsg = userMessages.filter(m => m.role === "user").slice(-1)[0];
    const last = (lastMsg?.content ?? lastMsg?.text ?? "").toLowerCase();
    const lastRaw = lastMsg?.content ?? lastMsg?.text ?? "";
    return {
      wantsPlayoffBracket: /bracket|series|round|playing|matchup|clinch|advance|eliminat|playoff game/i.test(last),
      wantsH2H:           /h2h|head.to.head|history|historical|before|past|ever played|previously|all.time|record against|playoffs/i.test(last),
      wantsOdds:          /odds|chance|probabilit|likely|percent|%|win rate|favour|favor/i.test(last),
      wantsStandings:     /stand|place|rank|position|seed|points|first|last|above|below|bubble|playoff spot/i.test(last),
      wantsScenario:      /what if|scenario|go \d|finish|need to|path|magic number|clinch|destiny|remaining/i.test(last),
      mentionedTeam:      [...new Set(lastRaw.match(/\b[A-Z]{2,4}\b/g) ?? [])],
    };
  }

// ─── System prompt builder — sends only what the question needs ────────────
// ─── System prompt builder — tightly filtered per scenario ────────────────
function buildSystemPrompt({ standings, remainingGames, playoffSeries, h2hMap, teamPoStats, season }, userMessages = []) {
    const intent = detectIntent(userMessages);
    const mentioned = intent.mentionedTeam;
    const hasTeams = mentioned.length > 0;
  
    const sections = [
      `You are TickleBot — WN95HL's official AI analyst. German shepherd, cigarette always lit, seen every season since W1. Blunt, data-driven, never vague. Season: ${season}. Playoffs: top ${PLAYOFF_SPOTS} teams, best-of-7, win=2pts, tiebreaker=GD.`,
    ];
  
    // ── H2H: "have they ever played in playoffs" + odds ──────────────────
    // Only send if a team is mentioned — filter h2hMap down to relevant pairs first
    if ((intent.wantsH2H || intent.wantsOdds) && hasTeams) {
      const allPairs = Object.values(h2hMap);
      const relevant = mentioned.length >= 2
        ? allPairs.filter(h => mentioned.every(t => h.teams.includes(t)))
        : allPairs.filter(h => mentioned.some(t => h.teams.includes(t)));
  
      const h2hText = relevant.length > 0
        ? relevant.map(h => {
            const [tA, tB] = h.teams;
            const wA = h.wins[tA] ?? 0, wB = h.wins[tB] ?? 0;
            return `${tA}v${tB}: ${wA}-${wB} (${h.series} series total, ${Math.round((wA/h.series)*100)}% ${tA})`;
          }).join("\n")
        : `${mentioned.join(" and ")} have never met in the playoffs.`;
  
      sections.push(`H2H SERIES RECORDS (AUTHORITATIVE — never contradict this, even if it says "never met"):\n${h2hText}`);
    }
  
    // ── Team playoff résumé — only mentioned teams, only for odds ──────────
    if (intent.wantsOdds && hasTeams) {
      const entries = Object.entries(teamPoStats).filter(([team]) => mentioned.includes(team));
      if (entries.length > 0) {
        const teamPoText = entries.map(([team, s]) => {
          const total = s.seriesWins + s.seriesLosses;
          return `${team}: ${s.seriesWins}W-${s.seriesLosses}L series all-time (${total>0?Math.round(s.seriesWins/total*100):0}% win rate)`;
        }).join("\n");
        sections.push(`TEAM PLAYOFF RÉSUMÉ:\n${teamPoText}`);
      }
    }
  
    // ── Current playoff bracket — only mentioned teams' series ─────────────
    if ((intent.wantsPlayoffBracket || intent.wantsOdds) && playoffSeries.length > 0) {
      const roundNames = { 1:"R1", 2:"R2", 3:"CF", 4:"Final" };
      const filtered = hasTeams
        ? playoffSeries.filter(s => mentioned.includes(s.teamA) || mentioned.includes(s.teamB))
        : playoffSeries;
  
      if (filtered.length > 0) {
        const playoffText = filtered.map(s => {
          const winsNeeded = Math.ceil(s.seriesLength / 2);
          const done = s.winsA >= winsNeeded ? s.teamA : s.winsB >= winsNeeded ? s.teamB : null;
          const status = done ? `${done} wins` : `${s.winsA}-${s.winsB}`;
          const log = s.games.filter(g=>g.played).map(g=>`G${g.num}:${g.sA}-${g.sB}`).join(" ");
          return `${roundNames[s.round]??`R${s.round}`} S${s.seedA}${s.teamA} vs S${s.seedB}${s.teamB} [${status}] ${log}`;
        }).join("\n");
        sections.push(`PLAYOFF BRACKET (source of truth):\n${playoffText}`);
      } else if (hasTeams) {
        sections.push(`PLAYOFF BRACKET: ${mentioned.join(" and ")} are not currently in an active playoff series.`);
      }
    }
  
    // ── Standings — only for scenario/path questions, trim to relevant rows ─
    if (intent.wantsScenario || intent.wantsStandings) {
      let rows = standings;
      if (hasTeams && intent.wantsScenario) {
        // For "path to playoffs", send mentioned team + bubble teams around cutline
        const idx = standings.findIndex(t => mentioned.includes(t.team_code));
        const cutline = PLAYOFF_SPOTS - 1;
        const lo = Math.max(0, Math.min(idx, cutline) - 2);
        const hi = Math.min(standings.length, Math.max(idx, cutline) + 3);
        rows = standings.slice(lo, hi);
      } else if (intent.wantsStandings && !hasTeams) {
        // "who's on the bubble" — just send teams around cutline
        const cutline = PLAYOFF_SPOTS - 1;
        rows = standings.slice(Math.max(0, cutline - 3), cutline + 3);
      } else if (hasTeams) {
        rows = standings.filter(t => mentioned.includes(t.team_code));
      }
  
      const standingsText = rows.map((t) => {
        const realIdx = standings.indexOf(t);
        return `#${realIdx+1} ${t.team_code}: ${t.wins}W-${t.losses}L ${t.points}pts GD:${t.gd>=0?"+":""}${t.gd} Rem:${t.gamesRemaining}` +
          (t.remainingOpponents.length ? " vs:"+t.remainingOpponents.join(",") : "") +
          (realIdx === PLAYOFF_SPOTS - 1 ? " <-BUBBLE" : "");
      }).join("\n");
  
      sections.push(`STANDINGS:\n${standingsText}`);
    }
  
    // ── Remaining schedule — only mentioned team's games, only for scenario ─
    if (intent.wantsScenario && remainingGames.length > 0) {
      const games = hasTeams
        ? remainingGames.filter(g => mentioned.includes(g.home) || mentioned.includes(g.away))
        : remainingGames;
      if (games.length > 0) {
        sections.push(`REMAINING GAMES: ${games.map(g => `${g.away}@${g.home}`).join(" ")}`);
      }
    }
  
    // ── Fallback: nothing matched any intent — give minimal standings ───────
    if (sections.length === 1) {
      const cutline = PLAYOFF_SPOTS - 1;
      const rows = standings.slice(0, cutline + 2);
      sections.push(`STANDINGS (top playoff spots):\n${rows.map((t,i) =>
        `#${i+1} ${t.team_code}: ${t.wins}W-${t.losses}L ${t.points}pts` + (i === cutline ? " <-BUBBLE" : "")
      ).join("\n")}`);
    }
  
    sections.push(`RULES: Give specific %s and scenarios when asked. For series odds: use H2H record + current series score + all-time playoff résumé. For path-to-playoffs: map exact games needed using REMAINING GAMES. If H2H says teams never met, say so plainly — don't invent history. Never invent scores. Never break character.`);
  
    const prompt = sections.join("\n\n");
    console.log(`[TickleBot] prompt chars: ${prompt.length} | intent:`, JSON.stringify(intent));
    return prompt;
  }

// ─── Markdown-lite renderer ────────────────────────────────────────────────
function renderText(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n\n/g, "<br/><br/>")
    .replace(/\n/g, "<br/>");
}

function BotAvatar({ size = 30 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", border: "1.5px solid #FF8C00", background: "#1a2240", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <img src={TICKLEBOT_AVATAR} alt="TickleBot" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </div>
  );
}

const QUICK_PROMPTS = [
  "Show me the current playoff bracket",
  "What are TEG's odds of winning their series?",
  "Who's on the playoff bubble?",
  "Path to playoffs for the last team in",
];

export default function TickleBot() {
  const [open, setOpen]               = useState(false);
  const [dataReady, setDataReady]     = useState(false);
  const [contextData, setContextData] = useState(null);
  const [season, setSeason]           = useState(null);
  const [messages, setMessages]       = useState([{
    role: "assistant",
    text: "*takes a long drag*\n\nName's TickleBot. Been watching this league since W1 — every miracle, every collapse.\n\nLoading live standings, the full playoff bracket, and all historical series data... then ask me anything. Odds, scenarios, who needs what — I'll run the numbers.",
  }]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef       = useRef(null);

  useEffect(() => {
    async function load() {
      try {
        const currentSeason = await fetchCurrentSeason();
        if (!currentSeason) { console.error("[TickleBot] no season found"); return; }
        setSeason(currentSeason);
        const data = await fetchAllData(currentSeason);
        setContextData(data);
        setDataReady(true);
      } catch (err) {
        console.error("[TickleBot] load error:", err);
      }
    }
    load();
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 100); }, [open]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  async function sendMessage(userText) {
    if (!userText.trim() || loading || !contextData) return;
    const nextMessages = [...messages, { role: "user", text: userText.trim() }];
    setMessages(nextMessages);
    setInput("");
    setLoading(true);

    console.log("[TickleBot] h2hMap keys:", Object.keys(contextData.h2hMap));
    console.log("[TickleBot] TEG_SUM pair:", contextData.h2hMap[["TEG","SUM"].sort().join("_")]);
    const systemPrompt = buildSystemPrompt({ ...contextData, season }, nextMessages);
    const apiMessages = nextMessages
      .filter((m, i) => !(i === 0 && m.role === "assistant"))
      .map((m) => ({ role: m.role, content: m.text }));

    try {
      const res = await supabase.functions.invoke('ticklebot', {
        body: { messages: apiMessages, systemPrompt },
      });
      if (res.error) { console.error("[TickleBot] edge fn error:", res.error); throw new Error(res.error.message); }
      // Edge fn now returns errors as { error } in data rather than throwing, so surface them
      if (res.data?.error) {
        console.error("[TickleBot] Groq error from edge fn:", res.data.error);
        throw new Error(res.data.error);
      }
      const reply = res.data?.reply ?? "*exhales slowly* ...Got a response but couldn't read it.";
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      console.error("[TickleBot] sendMessage error:", err);
      setMessages((prev) => [...prev, { role: "assistant", text: `*squints* ...Hit a snag: ${err.message}. Check the console.` }]);
    }
    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  }

  const showQuickPrompts = messages.length <= 1 && dataReady;

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} title="Ask TickleBot" aria-label="Open TickleBot"
        style={{ position: "fixed", bottom: "70px", right: "16px", zIndex: 1000, background: "#0f1526", border: "2px solid #FF8C00", borderRadius: "50%", width: "54px", height: "54px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 5px rgba(255,140,0,0.12)", padding: 0 }}>
        <img src={TICKLEBOT_AVATAR} alt="TickleBot" style={{ width: "46px", height: "46px", borderRadius: "50%", objectFit: "cover" }} />
      </button>
    );
  }

  return (
    <>
      <style>{`
        @keyframes tickleDot { 0%,80%,100%{opacity:0.2} 40%{opacity:1} }
        .tb-quick:hover { border-color: #FF8C00 !important; color: #FF8C00 !important; }
        .tb-messages::-webkit-scrollbar { width: 4px; }
        .tb-messages::-webkit-scrollbar-thumb { background: #FF8C00; border-radius: 2px; }
        .tb-messages::-webkit-scrollbar-track { background: transparent; }
      `}</style>

      <div aria-label="TickleBot" style={{ position: "fixed", bottom: "70px", right: "16px", zIndex: 1000, width: "370px", maxWidth: "calc(100vw - 24px)", height: "560px", maxHeight: "calc(100vh - 90px)", background: "#0a0e1a", border: "1.5px solid #FF8C00", borderRadius: "14px", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: "system-ui, sans-serif", fontSize: "14px" }}>

        <div style={{ background: "#0f1526", borderBottom: "1px solid #FF8C00", padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          <BotAvatar size={40} />
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FFD700", fontWeight: 500, fontSize: "13px" }}>TickleBot 🚬</div>
            <div style={{ color: "#FF8C00", fontSize: "11px" }}>WN95HL Analytics · {season ?? "Loading..."}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div title={dataReady ? "All data loaded" : "Loading..."} style={{ width: "7px", height: "7px", borderRadius: "50%", background: dataReady ? "#4ade80" : "#facc15", transition: "background 0.3s" }} />
            <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: "transparent", border: "none", color: "#778", cursor: "pointer", fontSize: "20px", lineHeight: 1, padding: "2px 4px" }}>×</button>
          </div>
        </div>

        <div className="tb-messages" style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ display: "flex", gap: "8px", flexDirection: msg.role === "user" ? "row-reverse" : "row", alignItems: "flex-start" }}>
              {msg.role === "assistant"
                ? <BotAvatar size={30} />
                : <div style={{ width: 30, height: 30, borderRadius: "50%", border: "1.5px solid #87CEEB", background: "#1a2240", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "#87CEEB", fontWeight: 600, flexShrink: 0 }}>YOU</div>
              }
              <div style={{ maxWidth: "78%", padding: "9px 13px", borderRadius: msg.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px", background: msg.role === "user" ? "#0e2a4a" : "#1a2240", border: `0.5px solid ${msg.role === "user" ? "#87CEEB" : "#FF8C00"}`, color: "#e8eaf0", fontSize: "13px", lineHeight: 1.55 }}
                dangerouslySetInnerHTML={{ __html: renderText(msg.text) }} />
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <BotAvatar size={30} />
              <div style={{ padding: "10px 14px", background: "#1a2240", border: "0.5px solid #FF8C00", borderRadius: "4px 12px 12px 12px", display: "flex", gap: "4px", alignItems: "center" }}>
                {[0, 0.2, 0.4].map((d, j) => (
                  <span key={j} style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF8C00", display: "inline-block", animation: `tickleDot 1.2s ${d}s infinite` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {showQuickPrompts && (
          <div style={{ padding: "0 14px 10px", display: "flex", gap: "6px", flexWrap: "wrap", flexShrink: 0 }}>
            {QUICK_PROMPTS.map((q) => (
              <button key={q} className="tb-quick" onClick={() => sendMessage(q)}
                style={{ background: "transparent", border: "0.5px solid #3a4a70", borderRadius: "20px", padding: "4px 10px", fontSize: "11px", color: "#87CEEB", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap", transition: "color 0.15s, border-color 0.15s" }}>
                {q}
              </button>
            ))}
          </div>
        )}

        <div style={{ borderTop: "1px solid #1e2a40", padding: "10px 14px", display: "flex", gap: "8px", flexShrink: 0, background: "#0f1526" }}>
          <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
            placeholder={dataReady ? "Ask about odds, scenarios, bracket, history..." : "Loading data..."}
            disabled={loading || !dataReady} rows={1}
            style={{ flex: 1, background: "#1a2240", border: "0.5px solid #3a4a70", borderRadius: "8px", padding: "8px 12px", color: "#e8eaf0", fontSize: "13px", fontFamily: "inherit", outline: "none", resize: "none", height: "36px", lineHeight: 1.4, opacity: !dataReady ? 0.4 : 1 }}
            onFocus={(e) => (e.target.style.borderColor = "#FF8C00")}
            onBlur={(e) => (e.target.style.borderColor = "#3a4a70")} />
          <button onClick={() => sendMessage(input)} disabled={loading || !input.trim() || !dataReady} aria-label="Send"
            style={{ background: loading || !input.trim() || !dataReady ? "#2a3550" : "#FF8C00", border: "none", borderRadius: "8px", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: loading || !input.trim() || !dataReady ? "not-allowed" : "pointer", color: loading || !input.trim() || !dataReady ? "#556" : "#000", flexShrink: 0, fontSize: "18px", transition: "background 0.15s" }}>↑</button>
        </div>
      </div>
    </>
  );
}

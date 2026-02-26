import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from "../utils/supabaseClient";
import TwitchLiveWidget from "../components/TwitchLiveWidget";
import { useLeague } from "../components/LeagueContext";

const lgPrefix = lg => (lg || '').replace(/[0-9]/g, '').trim();
const LEAGUE_CONFIG = [
  { prefix: 'W', label: 'WN95',    color: '#87CEEB' },
  { prefix: 'Q', label: 'THE Q',   color: '#FFD700' },
  { prefix: 'V', label: 'VINTAGE', color: '#FF6B35' },
];
const leagueCfg = prefix => LEAGUE_CONFIG.find(l => l.prefix === prefix) ??
  { prefix, label: prefix, color: '#aaa' };

const getFullTeamName = (teamCode, teams) => {
  const t = teams.find(t => t.code === teamCode);
  return t ? t.team : teamCode;
};

function useLeagueCountdown(season) {
  const [tick, setTick] = useState(null);
  useEffect(() => {
    if (!season) return;
    const calc = () => {
      if (!season.end_date) { setTick({ done: true, seasonLabel: season.lg }); return; }
      const diff = new Date(season.end_date) - Date.now();
      if (diff <= 0) { setTick({ done: true, seasonLabel: season.lg }); return; }
      setTick({ done:false, seasonLabel:season.lg,
        d:Math.floor(diff/86400000), h:Math.floor((diff%86400000)/3600000),
        m:Math.floor((diff%3600000)/60000), s:Math.floor((diff%60000)/1000),
        urgent:diff<48*3600000, warning:diff<7*86400000 });
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [season]);
  return tick;
}

const p2 = n => String(n ?? 0).padStart(2, '0');

function daysUntil(iso) {
  if (!iso) return null;
  const norm = /[Zz]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z';
  const evMs = new Date(norm).getTime();
  if (isNaN(evMs) || evMs < Date.now()) return null;
  const now = new Date(), ev = new Date(evMs);
  const todayMid = new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime();
  const evMid    = new Date(ev.getFullYear(),ev.getMonth(),ev.getDate()).getTime();
  const days = Math.round((evMid - todayMid) / 86400000);
  if (days === 0) return 'TODAY';
  if (days === 1) return 'TMRW';
  return `${days}D`;
}

function ClockDisplay() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'}));
    update();
    const id = setInterval(update, 10000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="ht-clock-inner">
      <span className="ht-clock-time">{time}</span>
      <span className="ht-clock-label">ET</span>
    </div>
  );
}

function InlineCountdown({ cfg, tick }) {
  const uc = tick?.urgent ? '#FF3B3B' : tick?.warning ? '#FFB800' : cfg.color;
  return (
    <div className="icd" style={{ '--ic': uc }}>
      <div className="icd-left">
        <span className="icd-eyebrow">⏱ SEASON COUNTDOWN</span>
        <div className="icd-meta">
          <span className="icd-dot" />
          <span className="icd-league">{cfg.label}</span>
          {tick?.seasonLabel && <span className="icd-season">{tick.seasonLabel}</span>}
        </div>
      </div>
      <div className="icd-right">
        {!tick ? <span className="icd-awaiting">AWAITING</span>
        : tick.done ? (
          <div className="icd-complete">
            <span style={{fontSize:15}}>🏆</span>
            <span className="icd-done-txt">COMPLETE</span>
          </div>
        ) : (
          <div className="icd-clock">
            {[{v:tick.d,u:'D'},{v:tick.h,u:'H'},{v:tick.m,u:'M'},{v:tick.s,u:'S'}].map(({v,u})=>(
              <div key={u} className="icd-unit">
                <span className="icd-n">{p2(v)}</span>
                <span className="icd-u">{u}</span>
              </div>
            ))}
            {tick.d<7&&<span style={{fontSize:15,marginLeft:2}}>{tick.urgent?'🚨':'⚡'}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

function PanelHeader({ icon, title, action }) {
  return (
    <div className="ph">
      <span className="ph-icon">{icon}</span>
      <span className="ph-title">{title}</span>
      {action && <div className="ph-action">{action}</div>}
    </div>
  );
}

const SL_PANELS = [
  { id:'hot',     icon:'🔥', label:'HOTTEST TEAMS',  sub:'Best record last 10' },
  { id:'cold',    icon:'🥶', label:'COLDEST TEAMS',  sub:'Worst record last 10' },
  { id:'wstreak', icon:'🏆', label:'WIN STREAKS',    sub:'Active win streaks' },
  { id:'lstreak', icon:'💀', label:'LOSS STREAKS',   sub:'Active loss streaks' },
  { id:'scorers', icon:'⭐', label:'TOP SCORERS',    sub:'Season leaders' },
];

function Spotlight({ recentForm, winStreaks, lossStreaks, loading }) {
  const [idx, setIdx] = useState(0);
  const timerRef = useRef(null);
  const startTimer = useCallback(()=>{
    clearInterval(timerRef.current);
    timerRef.current = setInterval(()=>setIdx(i=>(i+1)%SL_PANELS.length), 8000);
  },[]);
  useEffect(()=>{ startTimer(); return()=>clearInterval(timerRef.current); },[startTimer]);
  const goTo = i => { setIdx(i); startTimer(); };
  const p = SL_PANELS[idx];

  const rows = () => {
    if(loading) return [1,2,3,4].map(i=>(<div key={i} className="skel" style={{height:24,margin:'.12rem .65rem'}}/>));
    if(p.id==='hot'||p.id==='cold'){
      const list=p.id==='hot'?recentForm.hot:recentForm.cold;
      if(!list.length) return <div className="sl-empty">No data available</div>;
      return list.map((t,i)=>(
        <div key={t.team} className="sl-row">
          <span className="sl-rank">#{i+1}</span>
          <img src={`/assets/teamLogos/${t.team}.png`} alt="" className="sl-logo" onError={e=>{e.currentTarget.style.display='none';}}/>
          <span className="sl-team">{t.team}</span>
          <div className="sl-dots">{t.last10.map((w,j)=><span key={j} className={`sl-dot ${w?'sl-dot-w':'sl-dot-l'}`}/>)}</div>
          <span className={`sl-val ${p.id==='hot'?'sl-val-hot':'sl-val-cold'}`}>{t.w}-{t.l}</span>
        </div>
      ));
    }
    if(p.id==='wstreak'){
      if(!winStreaks.length) return <div className="sl-empty">No active win streaks</div>;
      return winStreaks.slice(0,5).map((s,i)=>(
        <div key={s.team} className="sl-row">
          <span className="sl-rank">#{i+1}</span>
          <img src={`/assets/teamLogos/${s.team}.png`} alt="" className="sl-logo" onError={e=>{e.currentTarget.style.display='none';}}/>
          <span className="sl-team">{s.team}</span>
          <div className="sl-dots">
            {Array.from({length:Math.min(s.count,10)},(_,j)=><span key={j} className="sl-dot sl-dot-w"/>)}
            {s.count>10&&<span className="sl-dots-more">+{s.count-10}</span>}
          </div>
          <span className="sl-val sl-val-hot">{s.count}W</span>
        </div>
      ));
    }
    if(p.id==='lstreak'){
      if(!lossStreaks.length) return <div className="sl-empty">No active loss streaks</div>;
      return lossStreaks.slice(0,5).map((s,i)=>(
        <div key={s.team} className="sl-row">
          <span className="sl-rank">#{i+1}</span>
          <img src={`/assets/teamLogos/${s.team}.png`} alt="" className="sl-logo" onError={e=>{e.currentTarget.style.display='none';}}/>
          <span className="sl-team">{s.team}</span>
          <div className="sl-dots">
            {Array.from({length:Math.min(s.count,10)},(_,j)=><span key={j} className="sl-dot sl-dot-l"/>)}
            {s.count>10&&<span className="sl-dots-more">+{s.count-10}</span>}
          </div>
          <span className="sl-val sl-val-cold">{s.count}L</span>
        </div>
      ));
    }
    return (
      <div>
        {[1,2,3,4,5].map(i=>(
          <div key={i} className="sl-row" style={{opacity:1-i*.15}}>
            <span className="sl-rank">#{i}</span>
            <div className="sl-bar-wrap"><div className="sl-bar" style={{width:`${100-i*13}%`}}/></div>
            <span className="sl-val" style={{color:'rgba(255,255,255,.18)'}}>—</span>
          </div>
        ))}
        <div className="sl-coming">PLAYER STATS COMING SOON</div>
      </div>
    );
  };

  return (
    <section className="panel sl-panel">
      <div className="sl-tabs">
        {SL_PANELS.map((sp,i)=>(
          <button key={sp.id} className={`sl-tab ${i===idx?'sl-tab-on':''}`} onClick={()=>goTo(i)} title={sp.label}>{sp.icon}</button>
        ))}
      </div>
      <div className="sl-titlebar">
        <span className="sl-title">{p.icon} {p.label}</span>
        <span className="sl-sub">{p.sub}</span>
      </div>
      <div className="sl-body">{rows()}</div>
      <div className="sl-prog-wrap"><div className="sl-prog" key={`${idx}-${loading}`}/></div>
    </section>
  );
}

export default function Home() {
  const { selectedLeague } = useLeague();
  const cfg = leagueCfg(selectedLeague);

  const [currentSeason,setCurrentSeason]=useState(null);
  const [winStreaks,setWinStreaks]=useState([]);
  const [lossStreaks,setLossStreaks]=useState([]);
  const [recentForm,setRecentForm]=useState({hot:[],cold:[]});
  const [discordEvents,setDiscordEvents]=useState([]);
  const [recentTrades,setRecentTrades]=useState([]);
  const [loading,setLoading]=useState(true);
  const [evtLoading,setEvtLoading]=useState(true);
  const [tickerItems,setTickerItems]=useState([]);
  const [teams,setTeams]=useState([]);

  const tick = useLeagueCountdown(currentSeason);

  useEffect(()=>{
    supabase.from('teams').select('code,team').then(({data})=>{ if(data) setTeams(data); });
  },[]);

  const loadLeagueData = useCallback(async(prefix)=>{
    if(!prefix) return;
    setLoading(true);
    setCurrentSeason(null); setWinStreaks([]); setLossStreaks([]); setRecentForm({hot:[],cold:[]});

    const {data:seasons}=await supabase.from('seasons').select('*').order('year',{ascending:false}).limit(20);
    const ps=(seasons||[]).filter(s=>lgPrefix(s.lg)===prefix);
    if(!ps.length){setLoading(false);return;}
    const latest=ps.reduce((b,s)=>new Date(s.end_date)>new Date(b.end_date)?s:b);
    setCurrentSeason(latest);

    const {data:allGames}=await supabase.from('games')
      .select('lg,legacy_game_id,home,away,result_home,result_away')
      .eq('lg',latest.lg).order('legacy_game_id',{ascending:false});
    const games=allGames||[];

    const teamHist={};
    games.forEach(g=>{
      const hW=['W','OTW'].includes((g.result_home||'').toUpperCase());
      const aW=['W','OTW'].includes((g.result_away||'').toUpperCase());
      if(!teamHist[g.home]) teamHist[g.home]=[];
      if(!teamHist[g.away]) teamHist[g.away]=[];
      teamHist[g.home].push({win:hW});
      teamHist[g.away].push({win:aW});
    });
    const wins=[],losses=[];
    Object.entries(teamHist).forEach(([team,hist])=>{
      if(!hist.length) return;
      const first=hist[0].win; let count=0;
      for(const h of hist){if(h.win===first)count++;else break;}
      if(first) wins.push({team,count}); else losses.push({team,count});
    });
    wins.sort((a,b)=>b.count-a.count); losses.sort((a,b)=>b.count-a.count);
    setWinStreaks(wins.slice(0,5)); setLossStreaks(losses.slice(0,5));

    const last10={};
    games.forEach(g=>{
      const hW=['W','OTW'].includes((g.result_home||'').toUpperCase());
      const aW=['W','OTW'].includes((g.result_away||'').toUpperCase());
      [[g.home,hW],[g.away,aW]].forEach(([t,w])=>{
        if(!last10[t]) last10[t]=[];
        if(last10[t].length<10) last10[t].push(w);
      });
    });
    const form=Object.entries(last10).filter(([,a])=>a.length>=3).map(([team,arr])=>{
      const w=arr.filter(Boolean).length;
      return{team,w,l:arr.length-w,last10:arr,pct:w/arr.length};
    });
    form.sort((a,b)=>b.pct-a.pct);
    setRecentForm({hot:form.slice(0,5),cold:[...form].sort((a,b)=>a.pct-b.pct).slice(0,5)});
    setLoading(false);

    // Ticker items
    const lastGames=games.slice(0,15).reverse();
    const tickerEvents=[]; const teamStk={}; const evSet=new Set();
    lastGames.forEach(g=>{
      const hS=Number(g.result_home||0),aS=Number(g.result_away||0);
      const hName=getFullTeamName(g.home,teams),aName=getFullTeamName(g.away,teams);
      [[g.home,hS>aS,hName],[g.away,aS>hS,aName]].forEach(([team,win,name])=>{
        if(!teamStk[team]) teamStk[team]=[];
        teamStk[team].push(win);
        if(teamStk[team].length>5) teamStk[team].shift();
        const l3=teamStk[team].slice(-3);
        if(l3.length===3){
          const msg=l3.every(Boolean)?`🔥 ${name} — 3-GAME WIN STREAK`:l3.every(v=>!v)?`📉 ${name} — 3 STRAIGHT LOSSES`:null;
          if(msg&&!evSet.has(msg)){tickerEvents.push(msg);evSet.add(msg);}
        }
      });
      if(hS+aS>=4){
        const msg=`⚡ FINAL: ${hName} ${hS} — ${aS} ${aName}`;
        if(!evSet.has(msg)){tickerEvents.push(msg);evSet.add(msg);}
      }
    });
    form.slice(0,3).forEach(t=>{
      const msg=`📈 ${getFullTeamName(t.team,teams)} — PLAYOFF POSITION`;
      if(!evSet.has(msg)){tickerEvents.push(msg);evSet.add(msg);}
    });
    setTickerItems(tickerEvents);
  },[]);

  useEffect(()=>{loadLeagueData(selectedLeague);},[selectedLeague,loadLeagueData]);

  useEffect(()=>{
    const refresh=async()=>{
      setEvtLoading(true);
      const result=await supabase.functions.invoke('discord-events');
      if(!result.error&&Array.isArray(result.data)) setDiscordEvents(result.data.slice(0,6));
      else if(result.error) console.warn('[discord-events]',result.error.message);
      setEvtLoading(false);
      supabase.functions.invoke('hyper-endpoint').catch(console.error);
    };
    refresh();
    const id=setInterval(refresh,10*60*1000);
    return()=>clearInterval(id);
  },[]);

  const fmtTime=iso=>iso?new Date(iso).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'}):'';
  const displayItems=tickerItems.length>0?tickerItems:['LEAGUE NEWS','TRADE ANNOUNCEMENTS','DRAFT NEWS','SEASON EVENTS','SCHEDULE UPDATES'];

  return (
    <div className="hp">
      <div className="scanlines" aria-hidden />

      <div className="cg">
        <div className="cg-a">
          <InlineCountdown cfg={cfg} tick={tick}/>
          <Spotlight recentForm={recentForm} winStreaks={winStreaks} lossStreaks={lossStreaks} loading={loading}/>
          <section className="panel">
            <PanelHeader icon="🔄" title="TRANSACTIONS"/>
            <div className="tx-body">
              {recentTrades.length===0?(
                <div className="tx-ph">
                  <span style={{fontSize:18,opacity:.2}}>📋</span>
                  <span className="tx-ph-msg">TRADE TRACKER COMING SOON</span>
                </div>
              ):recentTrades.slice(0,5).map((t,i)=>(
                <div key={i} className="tx-row">
                  <div className="tx-teams"><span className="tx-team">{t.from_team}</span><span className="tx-arr">⇄</span><span className="tx-team">{t.to_team}</span></div>
                  <span className="tx-player">{t.player_name}</span>
                  <span className="tx-date">{t.trade_date}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="cg-b"/>

        <div className="cg-c">
          <div className="media-cluster">
            <section className="panel twg-panel"><TwitchLiveWidget/></section>
            <section className="panel">
              <PanelHeader
                icon={<svg style={{width:12,height:12,color:'#5865F2',verticalAlign:'middle',flexShrink:0}} viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.62.874-1.395 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.1.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>}
                title="UPCOMING EVENTS"
                action={<a href="https://discord.gg/YOUR_INVITE" target="_blank" rel="noopener noreferrer" className="discord-join">JOIN →</a>}
              />
              <div className="events">
                {evtLoading?([1,2,3].map(i=><div key={i} className="skel" style={{height:52,margin:'.2rem .72rem'}}/>))
                :discordEvents.length===0?(
                  <div className="panel-empty ev-cta">
                    <p>🎮 No upcoming events.</p>
                    <p className="ev-setup">Deploy <code>discord-events</code> edge fn.</p>
                  </div>
                ):discordEvents.map(ev=>{
                  const du=daysUntil(ev.startTime);
                  const isToday=du==='TODAY',isTmrw=du==='TMRW';
                  return(
                    <a key={ev.id} href={ev.url} target="_blank" rel="noopener noreferrer" className="ev-row">
                      <div className="ev-cal">
                        <span className="ev-mon">{new Date(ev.startTime).toLocaleDateString('en-US',{month:'short'})}</span>
                        <span className="ev-day">{new Date(ev.startTime).getDate()}</span>
                      </div>
                      <div className="ev-info">
                        <span className="ev-name">{ev.name}</span>
                        <span className="ev-time">{fmtTime(ev.startTime)}</span>
                      </div>
                      <div className="ev-right">
                        {ev.status===2?<span className="ev-live">● LIVE</span>
                        :du?<span className={`ev-du${isToday?' ev-today':isTmrw?' ev-tmrw':''}`}>{du}</span>:null}
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          HDTV BROADCAST TICKER — NHL Network / ESPN Lower Third style
          3 zones: brand bug | scrolling belt | live clock
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="hdtv-ticker">

        {/* Zone 1: Brand bug */}
        <div className="ht-brand">
          <div className="ht-brand-top">{cfg.label}</div>
          <div className="ht-brand-bottom">
            <span className="ht-live-dot"/>
            <span>LIVE</span>
          </div>
        </div>

        {/* Zone 2: Scrolling content belt */}
        <div className="ht-stage">
          <div className="ht-fade-l"/>
          <div className="ht-fade-r"/>
          <div className="ht-rail">
            <div className="ht-belt">
              {displayItems.concat(displayItems).map((item,i)=>(
                <span key={i} className="ht-story">
                  <span className={`ht-text ht-c${i%4}`}>{item}</span>
                  <span className="ht-sep">
                    <span className="ht-sep-line"/>
                    <span className="ht-sep-gem">◆</span>
                    <span className="ht-sep-line"/>
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Zone 3: Clock */}
        <div className="ht-clock">
          <ClockDisplay/>
        </div>

      </div>

      <style>{`
        *,*::before,*::after{box-sizing:border-box;}
        html,body{background:#00000a!important;}
        .hp{min-height:100vh;background:radial-gradient(ellipse 120% 40% at 50% -5%,#0f0f28 0%,transparent 60%),#00000a;padding-bottom:56px;overflow-x:hidden;position:relative;}
        .scanlines{position:fixed;inset:0;pointer-events:none;z-index:9997;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.055) 2px,rgba(0,0,0,.055) 4px);}

        .icd{display:flex;align-items:center;justify-content:space-between;gap:.55rem;padding:.58rem .82rem;background:color-mix(in srgb,var(--ic) 8%,rgba(0,0,0,.65));border:1.5px solid color-mix(in srgb,var(--ic) 32%,transparent);border-radius:10px;position:relative;overflow:hidden;}
        .icd::before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse 65% 100% at 0% 50%,color-mix(in srgb,var(--ic) 12%,transparent),transparent 70%);}
        .icd-left{display:flex;flex-direction:column;gap:.2rem;}
        .icd-eyebrow{font-family:'Press Start 2P',monospace;font-size:9px;color:rgba(255,140,0,.5);letter-spacing:2px;}
        .icd-meta{display:flex;align-items:center;gap:.38rem;}
        .icd-dot{width:6px;height:6px;border-radius:50%;background:var(--ic);box-shadow:0 0 5px var(--ic);animation:icPulse 2s ease-in-out infinite;flex-shrink:0;}
        @keyframes icPulse{0%,100%{opacity:1}50%{opacity:.35}}
        .icd-league{font-family:'Press Start 2P',monospace;font-size:12px;color:var(--ic);letter-spacing:2px;}
        .icd-season{font-family:'VT323',monospace;font-size:17px;color:color-mix(in srgb,var(--ic) 55%,rgba(255,255,255,.25));}
        .icd-right{display:flex;align-items:center;flex-shrink:0;}
        .icd-awaiting{font-family:'Press Start 2P',monospace;font-size:10px;color:rgba(255,255,255,.2);letter-spacing:1px;}
        .icd-complete{display:flex;align-items:center;gap:.3rem;}
        .icd-done-txt{font-family:'Press Start 2P',monospace;font-size:10px;color:color-mix(in srgb,var(--ic) 70%,rgba(255,255,255,.3));letter-spacing:1px;}
        .icd-clock{display:flex;align-items:center;gap:.25rem;}
        .icd-unit{display:flex;flex-direction:column;align-items:center;background:rgba(0,0,0,.6);border:1px solid color-mix(in srgb,var(--ic) 22%,transparent);border-radius:5px;padding:.2rem .38rem;min-width:38px;}
        .icd-n{font-family:'VT323',monospace;font-size:27px;line-height:1;color:var(--ic);text-shadow:0 0 11px color-mix(in srgb,var(--ic) 65%,transparent);}
        .icd-u{font-family:'Press Start 2P',monospace;font-size:8px;color:rgba(255,255,255,.22);letter-spacing:2px;margin-top:1px;}

        .cg{display:grid;grid-template-columns:370px 1fr 370px;grid-template-areas:"a b c";gap:.82rem;padding:.88rem 1.1rem;max-width:1560px;margin:0 auto;align-items:start;}
        .cg-a{grid-area:a;display:flex;flex-direction:column;gap:.72rem;}
        .cg-b{grid-area:b;min-height:1px;}
        .cg-c{grid-area:c;display:flex;flex-direction:column;align-self:start;}

        .panel{border:1.5px solid rgba(135,206,235,.1);border-radius:10px;overflow:hidden;background:linear-gradient(155deg,rgba(255,255,255,.02) 0%,rgba(0,0,0,.3) 100%);}
        .ph{display:flex;align-items:center;gap:.38rem;padding:.48rem .82rem;background:linear-gradient(90deg,rgba(255,140,0,.07) 0%,transparent 100%);border-bottom:1px solid rgba(255,140,0,.1);flex-wrap:wrap;}
        .ph-icon{font-size:13px;flex-shrink:0;}
        .ph-title{flex:1;font-family:'Press Start 2P',monospace;font-size:11px;color:#FF8C00;letter-spacing:2px;text-shadow:0 0 6px rgba(255,140,0,.3);}
        .ph-action{flex-shrink:0;}
        .discord-join{font-family:'Press Start 2P',monospace;font-size:9px;color:#5865F2;text-decoration:none;letter-spacing:1px;border:1px solid rgba(88,101,242,.3);border-radius:4px;padding:.2rem .42rem;background:rgba(88,101,242,.07);transition:all .15s;white-space:nowrap;}
        .discord-join:hover{color:#7289DA;border-color:rgba(88,101,242,.55);}
        .panel-empty{padding:.82rem;font-family:'VT323',monospace;font-size:17px;color:rgba(255,255,255,.2);text-align:center;letter-spacing:2px;}
        .skel{background:linear-gradient(90deg,rgba(255,255,255,.03),rgba(255,255,255,.07),rgba(255,255,255,.03));background-size:200% 100%;animation:shimmer 1.6s infinite;border-radius:4px;}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}

        .sl-panel{overflow:visible;}
        .sl-tabs{display:flex;border-bottom:1px solid rgba(255,140,0,.1);background:rgba(0,0,0,.25);}
        .sl-tab{flex:1;padding:.35rem .15rem;font-size:14px;background:transparent;border:none;border-right:1px solid rgba(255,255,255,.04);cursor:pointer;transition:all .14s;color:rgba(255,255,255,.3);line-height:1;}
        .sl-tab:last-child{border-right:none;}
        .sl-tab:hover{background:rgba(255,140,0,.07);filter:brightness(1.4);}
        .sl-tab-on{background:rgba(255,140,0,.1)!important;border-bottom:2px solid #FF8C00!important;filter:brightness(1.6)!important;}
        .sl-titlebar{display:flex;flex-direction:column;gap:.07rem;padding:.38rem .68rem .3rem;background:linear-gradient(90deg,rgba(255,140,0,.06) 0%,transparent 100%);border-bottom:1px solid rgba(255,255,255,.04);}
        .sl-title{font-family:'Press Start 2P',monospace;font-size:10px;color:#FF8C00;letter-spacing:1.5px;text-shadow:0 0 8px rgba(255,140,0,.3);}
        .sl-sub{font-family:'VT323',monospace;font-size:14px;color:rgba(255,255,255,.22);letter-spacing:.5px;}
        .sl-body{padding:.18rem 0 .06rem;min-height:115px;}
        .sl-prog-wrap{height:3px;background:rgba(255,255,255,.05);overflow:hidden;}
        .sl-prog{height:100%;background:linear-gradient(90deg,#FF8C00,#FFD700);animation:slp 8s linear forwards;}
        @keyframes slp{from{width:0%}to{width:100%}}
        .sl-row{display:flex;align-items:center;gap:.3rem;padding:.2rem .62rem;border-bottom:1px solid rgba(255,255,255,.04);transition:background .1s;}
        .sl-row:last-child{border-bottom:none;}
        .sl-row:hover{background:rgba(255,140,0,.04);}
        .sl-rank{font-family:'Press Start 2P',monospace;font-size:9px;color:rgba(255,255,255,.2);min-width:16px;flex-shrink:0;}
        .sl-logo{width:20px;height:20px;object-fit:contain;flex-shrink:0;filter:drop-shadow(0 0 3px rgba(255,255,255,.15));}
        .sl-team{font-family:'Press Start 2P',monospace;font-size:9px;color:rgba(255,255,255,.55);min-width:24px;flex-shrink:0;}
        .sl-dots{display:flex;gap:2px;flex:1;align-items:center;flex-wrap:wrap;}
        .sl-dot{width:5px;height:5px;border-radius:2px;flex-shrink:0;}
        .sl-dot-w{background:#00CC55;box-shadow:0 0 3px rgba(0,204,85,.5);}
        .sl-dot-l{background:#4477CC;box-shadow:0 0 3px rgba(68,119,204,.4);}
        .sl-dots-more{font-family:'VT323',monospace;font-size:14px;color:rgba(255,255,255,.3);margin-left:1px;}
        .sl-val{font-family:'Press Start 2P',monospace;font-size:10px;flex-shrink:0;min-width:26px;text-align:right;}
        .sl-val-hot{color:#00CC55;text-shadow:0 0 7px rgba(0,204,85,.4);}
        .sl-val-cold{color:#6B9FFF;text-shadow:0 0 7px rgba(107,159,255,.35);}
        .sl-empty{font-family:'VT323',monospace;font-size:17px;color:rgba(255,255,255,.2);text-align:center;padding:1.2rem;letter-spacing:1px;}
        .sl-bar-wrap{flex:1;height:4px;background:rgba(255,255,255,.05);border-radius:3px;overflow:hidden;}
        .sl-bar{height:100%;background:linear-gradient(90deg,rgba(255,140,0,.3),rgba(255,215,0,.2));border-radius:3px;}
        .sl-coming{font-family:'Press Start 2P',monospace;font-size:8px;color:rgba(255,255,255,.13);letter-spacing:1px;text-align:center;padding:.4rem;}

        .tx-body{padding:.12rem 0;}
        .tx-ph{display:flex;flex-direction:column;align-items:center;gap:.28rem;padding:.62rem .8rem;}
        .tx-ph-msg{font-family:'Press Start 2P',monospace;font-size:9px;color:rgba(255,255,255,.14);letter-spacing:1px;text-align:center;}
        .tx-row{display:flex;align-items:center;gap:.28rem;padding:.22rem .66rem;border-bottom:1px solid rgba(255,255,255,.03);}
        .tx-row:last-child{border-bottom:none;}
        .tx-teams{display:flex;align-items:center;gap:.14rem;}
        .tx-team{font-family:'Press Start 2P',monospace;font-size:9px;color:#87CEEB;}
        .tx-arr{color:#FF8C00;font-size:15px;}
        .tx-player{flex:1;font-family:'VT323',monospace;font-size:16px;color:#E0E0E0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .tx-date{font-family:'VT323',monospace;font-size:14px;color:rgba(255,255,255,.2);flex-shrink:0;}

        .media-cluster{display:flex;flex-direction:column;gap:0;border:1.5px solid rgba(88,101,242,.18);border-radius:10px;overflow:hidden;}
        .media-cluster>.panel{border:none;border-radius:0;border-bottom:1px solid rgba(88,101,242,.12);}
        .media-cluster>.panel:last-child{border-bottom:none;}
        .media-cluster>.twg-panel{border-bottom:1px solid rgba(0,255,100,.1);}

        .events{padding:.04rem 0;}
        .ev-row{display:flex;align-items:flex-start;gap:.48rem;padding:.38rem .72rem;text-decoration:none;border-bottom:1px solid rgba(255,255,255,.03);transition:background .12s;}
        .ev-row:last-child{border-bottom:none;}
        .ev-row:hover{background:rgba(88,101,242,.07);}
        .ev-cal{display:flex;flex-direction:column;align-items:center;background:rgba(88,101,242,.1);border:1px solid rgba(88,101,242,.25);border-radius:5px;padding:.16rem .36rem;min-width:33px;flex-shrink:0;margin-top:2px;}
        .ev-mon{font-family:'Press Start 2P',monospace;font-size:8px;color:#7289DA;text-transform:uppercase;}
        .ev-day{font-family:'VT323',monospace;font-size:25px;color:#fff;line-height:1;}
        .ev-info{flex:1;display:flex;flex-direction:column;gap:.08rem;min-width:0;}
        .ev-name{font-family:'Press Start 2P',monospace;font-size:9px;color:#E0E0E0;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
        .ev-time{font-family:'VT323',monospace;font-size:15px;color:rgba(135,206,235,.5);margin-top:.04rem;}
        .ev-right{display:flex;flex-direction:column;align-items:flex-end;gap:.14rem;flex-shrink:0;padding-top:2px;}
        .ev-live{font-family:'Press Start 2P',monospace;font-size:8px;background:rgba(0,255,100,.12);border:1px solid rgba(0,255,100,.38);color:#00FF64;padding:.1rem .28rem;border-radius:3px;animation:blink 1.4s ease-in-out infinite;}
        .ev-du{font-family:'Press Start 2P',monospace;font-size:9px;color:rgba(255,255,255,.28);letter-spacing:1px;}
        .ev-today{color:#00FF64;text-shadow:0 0 8px rgba(0,255,100,.4);animation:blink 1.4s ease-in-out infinite;}
        .ev-tmrw{color:#FFD700;}
        .ev-cta{text-align:left!important;padding:.8rem!important;}
        .ev-cta p{margin:0 0 .22rem;font-size:15px!important;}
        .ev-setup{font-size:13px!important;color:rgba(255,255,255,.15)!important;}
        .ev-setup code{background:rgba(255,255,255,.07);padding:.05rem .18rem;border-radius:3px;}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.45}}

        /* ═════════════════════════════════════════════════════════════════
           HDTV BROADCAST TICKER
           Design: NHL Network / ESPN bottom ticker lower-third.
           Three distinct zones with sharp visual hierarchy.
        ═════════════════════════════════════════════════════════════════ */

        /* Outer shell */
        .hdtv-ticker {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: 48px;
          display: flex;
          align-items: stretch;
          z-index: 200;
          background: #060a16;
          /* Triple border stack: orange main, gold hairline, deep shadow */
          border-top: 3px solid #D95E00;
          box-shadow:
            0 -1px 0 rgba(255,185,70,0.6),
            0 -2px 0 rgba(0,0,0,0.9),
            0 -10px 40px rgba(200,75,0,0.22),
            inset 0 1px 0 rgba(255,140,50,0.1);
          overflow: hidden;
          font-family: 'Helvetica Neue', 'Arial', sans-serif;
        }

        /* ── Zone 1: Brand / Network bug ── */
        .ht-brand {
          flex-shrink: 0;
          width: 96px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          /* Deeper red on left darkening to right */
          background: linear-gradient(150deg, #B50000 0%, #6E0000 100%);
          border-right: 2px solid rgba(0,0,0,0.5);
          position: relative;
          overflow: hidden;
        }
        /* Top-left diagonal gloss */
        .ht-brand::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 60%; bottom: 40%;
          background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent);
          pointer-events: none;
        }
        /* Subtle right-edge inner shadow for depth */
        .ht-brand::after {
          content: '';
          position: absolute;
          top: 0; right: 0; bottom: 0;
          width: 8px;
          background: linear-gradient(-90deg, rgba(0,0,0,0.35), transparent);
          pointer-events: none;
        }
        .ht-brand-top {
          font-family: 'Press Start 2P', monospace;
          font-size: 9.5px;
          font-weight: 700;
          color: #fff;
          letter-spacing: 1px;
          text-shadow: 0 1px 4px rgba(0,0,0,0.9);
          position: relative;
          z-index: 1;
          line-height: 1;
        }
        .ht-brand-bottom {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 8.5px;
          font-weight: 800;
          color: rgba(255,255,255,0.55);
          letter-spacing: 3.5px;
          text-transform: uppercase;
          line-height: 1;
          position: relative;
          z-index: 1;
        }
        .ht-live-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #00FF88;
          box-shadow: 0 0 8px #00FF88, 0 0 2px #00FF88;
          flex-shrink: 0;
          animation: livePulse 2s ease-in-out infinite;
        }
        @keyframes livePulse {
          0%,100% { opacity:1; box-shadow:0 0 8px #00FF88, 0 0 2px #00FF88; }
          50%      { opacity:0.35; box-shadow:0 0 2px #00FF88; }
        }

        /* ── Zone 2: Content stage ── */
        .ht-stage {
          flex: 1;
          position: relative;
          overflow: hidden;
          /* Faint horizontal rule at top for Z-depth */
          border-top: 1px solid rgba(255,255,255,0.04);
          /* Very subtle column rhythm — real broadcast texture */
          background: repeating-linear-gradient(
            90deg,
            transparent 0, transparent 149px,
            rgba(255,255,255,0.018) 149px, rgba(255,255,255,0.018) 150px
          );
        }
        .ht-fade-l, .ht-fade-r {
          position: absolute; top:0; bottom:0; z-index:2; pointer-events:none;
          width: 52px;
        }
        .ht-fade-l { left:0;  background: linear-gradient(90deg,  #060a16 20%, transparent); }
        .ht-fade-r { right:0; background: linear-gradient(-90deg, #060a16 20%, transparent); }

        .ht-rail { width:100%; overflow:hidden; }
        .ht-belt {
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          animation: beltRoll 50s linear infinite;
          will-change: transform;
        }
        @keyframes beltRoll {
          0%   { transform: translateX(60vw); }
          100% { transform: translateX(-100%); }
        }

        .ht-story { display: inline-flex; align-items: center; }

        .ht-text {
          font-size: 14.5px;
          font-weight: 600;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          line-height: 1;
          padding: 0 0.5rem;
        }
        /* Broadcast color rhythm: white → gold → sky → dim white, repeating */
        .ht-c0 { color: #EEF3FF; }
        .ht-c1 { color: #FFD166; text-shadow: 0 0 12px rgba(255,200,80,0.25); }
        .ht-c2 { color: #87CEEB; text-shadow: 0 0 12px rgba(135,206,235,0.2); }
        .ht-c3 { color: rgba(220,230,255,0.65); }

        /* Story separator: line–diamond–line */
        .ht-sep {
          display: inline-flex; align-items: center; gap: 5px;
          margin: 0 0.5rem; flex-shrink:0;
        }
        .ht-sep-line {
          display: inline-block; width: 20px; height: 1px;
          background: rgba(210,95,0,0.55); flex-shrink:0;
        }
        .ht-sep-gem {
          font-size: 7px;
          color: #D95E00;
          text-shadow: 0 0 10px rgba(217,94,0,0.9);
          flex-shrink: 0;
          line-height: 1;
        }

        /* ── Zone 3: Clock ── */
        .ht-clock {
          flex-shrink: 0;
          width: 80px;
          display: flex; align-items: center; justify-content: center;
          border-left: 1.5px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.022);
          position: relative;
        }
        /* Thin top accent line matching brand color */
        .ht-clock::before {
          content:''; position:absolute; top:0; left:0; right:0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(217,94,0,0.5), transparent);
        }
        .ht-clock-inner { display:flex; flex-direction:column; align-items:center; gap:2px; }
        .ht-clock-time {
          font-size: 15px; font-weight:700;
          color: #ECF1FF; letter-spacing:1.5px;
          font-variant-numeric: tabular-nums; line-height:1;
        }
        .ht-clock-label {
          font-size: 8px; font-weight:700;
          color: rgba(255,255,255,0.28); letter-spacing:3px; line-height:1;
        }

        /* ── Responsive ── */
        @media(max-width:1200px){
          .cg{grid-template-columns:370px 370px;grid-template-areas:"a c";gap:.75rem;}
          .cg-b{display:none;}
        }
        @media(max-width:820px){
          .cg{grid-template-columns:1fr;grid-template-areas:"a" "c";}
        }
        @media(max-width:600px){
          .cg{padding:.6rem .7rem;gap:.6rem;}
          .icd{flex-direction:column;gap:.3rem;padding:.48rem .68rem;}
          .icd-clock{flex-wrap:wrap;gap:.2rem;}
          .icd-unit{min-width:35px;} .icd-n{font-size:24px;}
          html,body,.panel,.media-cluster{background:rgba(0,0,12,.95)!important;}
          .ht-brand{width:72px;} .ht-brand-top{font-size:8px;}
          .ht-clock{width:62px;} .ht-clock-time{font-size:13px;}
          .ht-text{font-size:13px;}
        }
      `}</style>
    </div>
  );
}
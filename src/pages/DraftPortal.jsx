import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import DraftPlayerPool from '../components/DraftPlayerPool';

function now() {
  return Date.now();
}
function useClockTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
}
function windowStatus(slot) {
  if (!slot.window_opens_at) return 'upcoming';
  const open = new Date(slot.window_opens_at).getTime();
  const close = new Date(slot.window_closes_at).getTime();
  const n = now();
  if (n < open) return 'upcoming';
  if (n > close) return 'overdue';
  return 'active';
}
function smartCountdown(ms) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400),
    h = Math.floor((s % 86400) / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}
function timeLeft(slot) {
  if (!slot.window_closes_at) return null;
  const d = new Date(slot.window_closes_at).getTime() - now();
  return d > 0 ? smartCountdown(d) : null;
}
function timeUntil(slot) {
  if (!slot.window_opens_at) return null;
  const d = new Date(slot.window_opens_at).getTime() - now();
  return d > 0 ? smartCountdown(d) : null;
}
function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
function isLiveClock(s) {
  return s ? /^\d+:\d{2}$/.test(s) : false;
}

function OnTheClock({ slot, pick }) {
  useClockTick();
  if (!slot) return null;
  const tl = timeLeft(slot);
  const live = isLiveClock(tl);
  const mins = tl && live ? parseInt(tl.split(':')[0]) : 99;
  const cc = mins <= 1 ? '#FF3B3B' : mins <= 5 ? '#FFB800' : '#00C853';
  return (
    <div className="otc-wrap" style={{ '--cc': cc }}>
      <div className="otc-bg">
        <img
          src={`/assets/banners/${slot.team_code}.png`}
          alt=""
          className="otc-banner-bg"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
        <div className="otc-vignette" />
      </div>
      <div className="otc-content">
        <div className="otc-left">
          <div className="otc-eyebrow">
            <span className="otc-dot" />
            NOW ON THE CLOCK
          </div>
          <div className="otc-pick-meta">
            <span className="otc-lbl">RD {slot.round}</span>
            <span className="otc-sep">·</span>
            <span className="otc-lbl">PICK {slot.pick_in_round}</span>
            <span className="otc-sep">·</span>
            <span className="otc-sub">#{slot.pick} OVERALL</span>
          </div>
          {slot.original_team !== slot.team_code && (
            <div className="otc-trade-badge">
              VIA TRADE · FROM {slot.original_team}
            </div>
          )}
        </div>
        <div className="otc-center">
          <img
            src={`/assets/teamLogos/${slot.team_code}.png`}
            alt={slot.team_code}
            className="otc-logo"
            onError={(e) => (e.currentTarget.style.opacity = 0)}
          />
          <div>
            <div className="otc-team">{slot.team_code}</div>
            <div className="otc-mgr">{slot.manager_name}</div>
          </div>
        </div>
        <div className="otc-right">
          {tl ? (
            <>
              <div className="otc-clock-label">TIME REMAINING</div>
              <div
                className="otc-clock"
                style={{ color: cc, textShadow: `0 0 20px ${cc}66` }}
              >
                {tl}
              </div>
              <div className="otc-window">
                WINDOW CLOSES {fmtTime(slot.window_closes_at)}
              </div>
            </>
          ) : (
            <>
              <div className="otc-clock-label">WINDOW OPENS</div>
              <div className="otc-clock" style={{ color: '#87CEEB' }}>
                {timeUntil(slot) ?? fmtTime(slot.window_opens_at)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TradePill({ originalTeam }) {
  const [show, setShow] = useState(false);
  return (
    <div
      className="pr-trade-wrap"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <div className="pr-trade-tag">TRADE</div>
      {show && <div className="pr-trade-tooltip">FROM {originalTeam}</div>}
    </div>
  );
}

function PickRow({ slot, pick, isActive, isNext, justPicked, onClick }) {
  useClockTick();
  const hasPick = !!pick?.player;
  const status = windowStatus(slot);
  const tl = !hasPick && isActive ? timeLeft(slot) : null;
  const traded = slot.original_team !== slot.team_code;
  const live = isLiveClock(tl);
  const mins = tl && live ? parseInt(tl.split(':')[0]) : 99;
  const cc = mins <= 1 ? '#FF3B3B' : mins <= 5 ? '#FFB800' : '#00C853';
  const tu =
    !hasPick && !isActive && status === 'upcoming' ? timeUntil(slot) : null;

  return (
    <div
      id={`pick-${slot.pick}`}
      className={[
        'pr-row',
        hasPick ? 'pr-done' : '',
        isActive ? 'pr-active' : '',
        isNext ? 'pr-next' : '',
        justPicked ? 'pr-flash' : '',
      ].join(' ')}
      onClick={onClick}
    >
      <div className="pr-num-wrap">
        <span className="pr-pick-num">{slot.pick_in_round}</span>
        <span className="pr-overall">#{slot.pick}</span>
      </div>
      <div className="pr-time">{fmtTime(slot.window_opens_at)}</div>
      <div className="pr-team-cell">
        <div className="pr-banner-wrap">
          <img
            src={`/assets/banners/${slot.team_code}.png`}
            alt=""
            className="pr-banner"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <div className="pr-banner-overlay" />
        </div>
        <img
          src={`/assets/teamLogos/${slot.team_code}.png`}
          alt={slot.team_code}
          className="pr-logo"
          onError={(e) => (e.currentTarget.style.display = 'none')}
        />
        <div className="pr-team-info">
          <span className="pr-team-code">{slot.team_code}</span>
          <span className="pr-mgr">{slot.manager_name}</span>
        </div>
        {traded && <TradePill originalTeam={slot.original_team} />}
      </div>
      <div className="pr-sel">
        {hasPick ? (
          <div className="pr-player-wrap">
            <span className="pr-player-name">{pick.player}</span>
            <div className="pr-player-meta">
              <span className="pr-pos-badge">{pick.pos?.trim()}</span>
              {pick.transaction_flag === 1 && pick.transaction_details && (
                <span className="pr-tx-tag">
                  {pick.transaction_details.split('/')[0]}
                </span>
              )}
              {pick.dropped_player && (
                <span className="pr-drop-tag">↓ {pick.dropped_player}</span>
              )}
            </div>
          </div>
        ) : isActive ? (
          <div className="pr-otc">
            <span
              className="pr-otc-dot"
              style={{ background: cc, boxShadow: `0 0 6px ${cc}` }}
            />
            <span className="pr-otc-txt" style={{ color: cc }}>
              ON THE CLOCK
            </span>
            {tl && (
              <span className="pr-otc-time" style={{ color: cc }}>
                {tl}
              </span>
            )}
          </div>
        ) : isNext ? (
          <span className="pr-next-txt">UP NEXT</span>
        ) : status === 'upcoming' ? (
          <span className="pr-upcoming-txt">
            {tu ? `IN ${tu}` : fmtTime(slot.window_opens_at)}
          </span>
        ) : (
          <span className="pr-overdue-txt">
            {fmtTime(slot.window_opens_at)}
          </span>
        )}
      </div>
    </div>
  );
}

function RosterPopover({ teamCode, draftLg, picks, onClose }) {
  const tp = picks.filter((p) => p.team === teamCode);
  return (
    <div className="rp-overlay" onClick={onClose}>
      <div className="rp-card" onClick={(e) => e.stopPropagation()}>
        <div className="rp-header">
          <img
            src={`/assets/teamLogos/${teamCode}.png`}
            alt={teamCode}
            className="rp-logo"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <div>
            <div className="rp-team">{teamCode}</div>
            <div className="rp-sub">DRAFT SELECTIONS · {draftLg}</div>
          </div>
          <button className="rp-close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="rp-picks">
          {tp.length === 0 ? (
            <div className="rp-empty">No picks yet</div>
          ) : (
            tp.map((p, i) => (
              <div key={i} className="rp-pick-row">
                <span className="rp-rd">
                  R{p.round} · #{p.pick}
                </span>
                <span className="rp-name">{p.player}</span>
                <span className="rp-pos">{p.pos?.trim()}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function DraftPortal() {
  const [schedule, setSchedule] = useState([]);
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draftLg] = useState('W17');
  const [draftYear] = useState(2012);
  const [justPicked, setJustPicked] = useState(null);
  const [rosterTeam, setRosterTeam] = useState(null);
  useClockTick();

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: sched }, { data: dp }] = await Promise.all([
      supabase
        .from('draft_schedule')
        .select('*')
        .eq('lg', draftLg)
        .order('pick', { ascending: true }),
      supabase
        .from('draft')
        .select('*')
        .eq('lg', draftLg)
        .order('pick', { ascending: true }),
    ]);
    setSchedule(sched ?? []);
    setPicks(dp ?? []);
    setLoading(false);
  }, [draftLg]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const dc = supabase
      .channel(`draft-${draftLg}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'draft',
          filter: `lg=eq.${draftLg}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPicks((prev) => {
              const next = [...prev, payload.new].sort(
                (a, b) => a.pick - b.pick
              );
              setJustPicked(payload.new.pick);
              setTimeout(() => setJustPicked(null), 3000);
              setTimeout(
                () =>
                  document
                    .getElementById(`pick-${payload.new.pick}`)
                    ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                100
              );
              return next;
            });
          }
          if (payload.eventType === 'UPDATE')
            setPicks((prev) =>
              prev.map((p) => (p.pick === payload.new.pick ? payload.new : p))
            );
        }
      )
      .subscribe((status, err) => {
        console.log('[sched channel]', status, err ?? '');
      });
    const sc = supabase
      .channel(`sched-${draftLg}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'draft_schedule',
          filter: `lg=eq.${draftLg}`,
        },
        (payload) => {
          setSchedule((prev) =>
            prev.map((s) => (s.pick === payload.new.pick ? payload.new : s))
          );
        }
      )
      .subscribe((status, err) => {
        console.log('[draft channel]', status, err ?? '');
      });
    return () => {
      supabase.removeChannel(dc);
      supabase.removeChannel(sc);
    };
  }, [draftLg]);

  const pickMap = Object.fromEntries(picks.map((p) => [p.pick, p]));
  const nextUnpicked = schedule.find((s) => !pickMap[s.pick]);
  const afterNext = schedule.find(
    (s) => !pickMap[s.pick] && s.pick !== nextUnpicked?.pick
  );
  const r1 = schedule.filter((s) => s.round === 1);
  const r2 = schedule.filter((s) => s.round === 2);
  const total = schedule.length,
    made = picks.length;
  const pct = total > 0 ? (made / total) * 100 : 0;

  const renderSlot = (slot) => (
    <PickRow
      key={slot.pick}
      slot={slot}
      pick={pickMap[slot.pick]}
      isActive={nextUnpicked?.pick === slot.pick}
      isNext={afterNext?.pick === slot.pick}
      justPicked={justPicked === slot.pick}
      onClick={() => {
        if (pickMap[slot.pick]) setRosterTeam(slot.team_code);
      }}
    />
  );

  return (
    <div className="dp-page">
      <div className="scanlines" aria-hidden />

      {/* sticky top bar */}
      <header className="dp-topbar">
        <div className="dp-topbar-left">
          <img
            src="/assets/leagueLogos/w.png"
            alt="WN95"
            className="dp-hdr-logo"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <div>
            <div className="dp-hdr-title">ENTRY DRAFT</div>
            <div className="dp-hdr-sub">
              {draftLg} · {draftYear} SEASON
            </div>
          </div>
        </div>
        <div className="dp-topbar-center">
          <div className="dp-prog-wrap">
            <div className="dp-prog-bar" style={{ width: `${pct}%` }} />
          </div>
          <div className="dp-prog-label">
            <span className="dp-prog-n">{made}</span>
            <span className="dp-prog-of">OF</span>
            <span className="dp-prog-tot">{total}</span>
            <span className="dp-prog-txt">PICKS COMPLETE</span>
          </div>
        </div>
        <div className="dp-topbar-right" />
      </header>

      {nextUnpicked && (
        <OnTheClock slot={nextUnpicked} pick={pickMap[nextUnpicked.pick]} />
      )}

      {/* always-split layout */}
      <div className="dp-body">
        {/* LEFT: pick list */}
        <div className="dp-left">
          {loading ? (
            <div className="dp-loading">
              {[...Array(8)].map((_, i) => (
                <div
                  key={i}
                  className="dp-skel"
                  style={{ opacity: 1 - i * 0.1 }}
                />
              ))}
            </div>
          ) : (
            <>
              <div className="dp-rd-divider">
                <div className="dp-rd-line" />
                <div className="dp-rd-badge">
                  <span className="dp-rd-num">ROUND 1</span>
                  <span className="dp-rd-sub">
                    {r1.filter((s) => pickMap[s.pick]).length} / {r1.length}
                  </span>
                </div>
                <div className="dp-rd-line" />
              </div>
              <div className="dp-col-hdr">
                <span className="dp-ch">#</span>
                <span className="dp-ch">TIME</span>
                <span className="dp-ch">TEAM</span>
                <span className="dp-ch">SELECTION</span>
              </div>
              {r1.map(renderSlot)}
              <div className="dp-rd-divider" style={{ marginTop: '.75rem' }}>
                <div className="dp-rd-line" />
                <div className="dp-rd-badge">
                  <span className="dp-rd-num">ROUND 2</span>
                  <span className="dp-rd-sub">
                    {r2.filter((s) => pickMap[s.pick]).length} / {r2.length}
                  </span>
                </div>
                <div className="dp-rd-line" />
              </div>
              {r2.map(renderSlot)}
              {made === total && total > 0 && (
                <div className="dp-complete">
                  <span>🏆</span>
                  <span className="dp-complete-txt">
                    {draftLg} DRAFT COMPLETE
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT: pool — always visible */}
        <div className="dp-right">
          <DraftPlayerPool draftLg={draftLg} draftYear={draftYear} />
        </div>
      </div>

      {rosterTeam && (
        <RosterPopover
          teamCode={rosterTeam}
          draftLg={draftLg}
          picks={picks}
          onClose={() => setRosterTeam(null)}
        />
      )}

      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        html, body { background: #00000a !important; margin: 0; }
        .dp-page { min-height: 100vh; background: radial-gradient(ellipse 120% 35% at 50% -5%, #0a0a28 0%, transparent 55%), #00000a; overflow-x: hidden; position: relative; }
        .scanlines { position: fixed; inset: 0; pointer-events: none; z-index: 9997; background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,.04) 2px, rgba(0,0,0,.04) 4px); }

        .dp-topbar { display: flex; align-items: center; gap: 1rem; padding: .55rem 1rem; background: rgba(0,0,0,.65); border-bottom: 1px solid rgba(135,206,235,.07); backdrop-filter: blur(10px); position: sticky; top: 0; z-index: 100; }
        .dp-topbar-left  { display: flex; align-items: center; gap: .55rem; flex-shrink: 0; }
        .dp-hdr-logo  { width: 32px; height: 32px; object-fit: contain; filter: drop-shadow(0 0 8px rgba(255,255,255,.2)); }
        .dp-hdr-title { font-family: 'Press Start 2P', monospace; font-size: 12px; color: #fff; letter-spacing: 2px; line-height: 1; }
        .dp-hdr-sub   { font-family: 'Press Start 2P', monospace; font-size: 6.5px; color: rgba(135,206,235,.45); letter-spacing: 2px; margin-top: 4px; }
        .dp-topbar-center { flex: 1; display: flex; flex-direction: column; gap: .22rem; align-items: center; }
        .dp-prog-wrap { width: 100%; max-width: 340px; height: 3px; background: rgba(255,255,255,.07); border-radius: 2px; overflow: hidden; }
        .dp-prog-bar  { height: 100%; background: linear-gradient(90deg, #87CEEB, #FFD700); transition: width .6s; box-shadow: 0 0 8px rgba(135,206,235,.4); }
        .dp-prog-label { display: flex; align-items: baseline; gap: .28rem; }
        .dp-prog-n   { font-family: 'Press Start 2P', monospace; font-size: 12px; color: #FFD700; }
        .dp-prog-of  { font-family: 'Press Start 2P', monospace; font-size: 6.5px; color: rgba(255,255,255,.18); }
        .dp-prog-tot { font-family: 'Press Start 2P', monospace; font-size: 12px; color: rgba(255,255,255,.32); }
        .dp-prog-txt { font-family: 'Press Start 2P', monospace; font-size: 6.5px; color: rgba(255,255,255,.18); letter-spacing: 1.5px; }
        .dp-topbar-right { flex-shrink: 0; width: 80px; }

        /* OTC */
        .otc-wrap { position: relative; overflow: hidden; min-height: 100px; border-bottom: 2px solid var(--cc, #00C853); }
        .otc-bg   { position: absolute; inset: 0; }
        .otc-banner-bg { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .1; filter: saturate(2) blur(8px); }
        .otc-vignette  { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(0,0,10,.93) 0%, rgba(0,0,10,.65) 40%, rgba(0,0,10,.65) 60%, rgba(0,0,10,.93) 100%), linear-gradient(0deg, rgba(0,0,10,.8) 0%, transparent 60%); }
        .otc-content { position: relative; z-index: 1; display: flex; align-items: center; gap: 1.2rem; padding: .75rem 1rem; }
        .otc-left  { flex: 1; display: flex; flex-direction: column; gap: .28rem; }
        .otc-eyebrow { display: flex; align-items: center; gap: .35rem; font-family: 'Press Start 2P', monospace; font-size: 7.5px; color: var(--cc); letter-spacing: 2px; text-shadow: 0 0 12px var(--cc); }
        .otc-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--cc); box-shadow: 0 0 8px var(--cc); animation: otcP 1.2s ease-in-out infinite; flex-shrink: 0; }
        @keyframes otcP { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.8)} }
        .otc-pick-meta { display: flex; align-items: center; gap: .4rem; }
        .otc-lbl  { font-family: 'Press Start 2P', monospace; font-size: 10px; color: rgba(255,255,255,.6); }
        .otc-sub  { font-family: 'Press Start 2P', monospace; font-size: 8px; color: rgba(255,255,255,.28); }
        .otc-sep  { color: rgba(255,255,255,.15); }
        .otc-trade-badge { font-family: 'Press Start 2P', monospace; font-size: 7px; color: #FFD700; background: rgba(255,215,0,.1); border: 1px solid rgba(255,215,0,.25); padding: .12rem .35rem; border-radius: 3px; letter-spacing: 1.5px; align-self: flex-start; }
        .otc-center { display: flex; align-items: center; gap: .8rem; flex-shrink: 0; }
        .otc-logo { width: 64px; height: 64px; object-fit: contain; filter: drop-shadow(0 0 16px rgba(255,255,255,.2)); animation: otcFloat 4s ease-in-out infinite; }
        @keyframes otcFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
        .otc-team { font-family: 'Press Start 2P', monospace; font-size: 14px; color: #fff; letter-spacing: 2px; line-height: 1; }
        .otc-mgr  { font-family: 'VT323', monospace; font-size: 20px; color: rgba(200,195,180,.5); letter-spacing: 1px; }
        .otc-right { flex: 1; display: flex; flex-direction: column; align-items: flex-end; gap: .18rem; }
        .otc-clock-label { font-family: 'Press Start 2P', monospace; font-size: 7px; color: rgba(255,255,255,.2); letter-spacing: 2px; }
        .otc-clock  { font-family: 'Press Start 2P', monospace; font-size: 30px; line-height: 1; letter-spacing: 2px; transition: color .3s; }
        .otc-window { font-family: 'VT323', monospace; font-size: 14px; color: rgba(255,255,255,.2); }

        /* MAIN BODY — always split, left narrow, right wide */
        .dp-body { display: grid; grid-template-columns: 420px 1fr; height: calc(100vh - 160px); overflow: hidden; }
        .dp-left { overflow-y: auto; padding: .5rem .6rem; }
        .dp-left::-webkit-scrollbar { width: 3px; }
        .dp-left::-webkit-scrollbar-thumb { background: rgba(255,140,0,.2); }
        .dp-right { overflow: hidden; display: flex; flex-direction: column; border-left: 1px solid rgba(255,255,255,.05); }
        .dp-right > * { flex: 1; min-height: 0; }

        /* Round dividers */
        .dp-rd-divider { display: flex; align-items: center; gap: .6rem; padding: .5rem 0 .35rem; }
        .dp-rd-line { flex: 1; height: 1px; background: rgba(255,255,255,.07); }
        .dp-rd-badge { display: flex; align-items: baseline; gap: .4rem; flex-shrink: 0; }
        .dp-rd-num { font-family: 'Press Start 2P', monospace; font-size: 10px; color: rgba(255,140,0,.65); letter-spacing: 2px; }
        .dp-rd-sub { font-family: 'Press Start 2P', monospace; font-size: 6.5px; color: rgba(255,255,255,.18); letter-spacing: 1px; }
        .dp-col-hdr { display: grid; grid-template-columns: 44px 58px 1fr auto; gap: .3rem; padding: .15rem .3rem; margin-bottom: .08rem; }
        .dp-ch { font-family: 'Press Start 2P', monospace; font-size: 6.5px; color: rgba(255,255,255,.14); letter-spacing: 1.5px; }

        /* Pick rows */
        .pr-row { display: grid; grid-template-columns: 44px 58px 1fr auto; gap: .3rem; align-items: center; padding: .28rem .3rem; border-bottom: 1px solid rgba(255,255,255,.03); border-radius: 4px; cursor: default; transition: background .1s; position: relative; overflow: visible; min-height: 40px; }
        .pr-row:hover { background: rgba(255,255,255,.022); }
        .pr-done  { background: rgba(0,200,83,.02); }
        .pr-active { background: rgba(0,200,83,.055) !important; box-shadow: inset 0 0 0 1px rgba(0,200,83,.1); }
        .pr-next  { background: rgba(135,206,235,.025) !important; }
        .pr-flash { animation: pFlash 3s ease-out forwards; }
        @keyframes pFlash { 0%{background:rgba(255,215,0,.22)} 100%{background:rgba(0,200,83,.02)} }

        .pr-num-wrap { display: flex; flex-direction: column; align-items: center; gap: 1px; }
        .pr-pick-num { font-family: 'Press Start 2P', monospace; font-size: 12px; color: rgba(255,255,255,.6); line-height: 1; }
        .pr-done .pr-pick-num { color: rgba(255,255,255,.3); }
        .pr-overall { font-family: 'VT323', monospace; font-size: 12px; color: rgba(255,255,255,.18); }
        .pr-time    { font-family: 'VT323', monospace; font-size: 16px; color: rgba(255,255,255,.52); }

        .pr-team-cell { display: flex; align-items: center; gap: .35rem; position: relative; overflow: visible; border-radius: 3px; padding: .14rem .35rem; min-height: 36px; }
        .pr-banner-wrap { position: absolute; inset: 0; border-radius: 3px; overflow: hidden; }
        .pr-banner { width: 100%; height: 100%; object-fit: cover; opacity: .16; filter: saturate(1.5); }
        .pr-banner-overlay { position: absolute; inset: 0; background: linear-gradient(90deg, rgba(0,0,10,.4) 0%, transparent 100%); }
        .pr-logo { width: 23px; height: 23px; object-fit: contain; flex-shrink: 0; position: relative; z-index: 1; }
        .pr-team-info { display: flex; flex-direction: column; gap: 1px; position: relative; z-index: 1; min-width: 0; }
        .pr-team-code { font-family: 'Press Start 2P', monospace; font-size: 8px; color: rgba(255,255,255,.8); letter-spacing: 1.5px; line-height: 1; }
        .pr-mgr { font-family: 'VT323', monospace; font-size: 13px; color: rgba(255,255,255,.42); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 80px; }

        .pr-trade-wrap { position: relative; z-index: 9998; flex-shrink: 0; margin-left: auto; }
        .pr-trade-tag  { font-family: 'Press Start 2P', monospace; font-size: 5.5px; color: #FFD700; background: rgba(255,215,0,.1); border: 1px solid rgba(255,215,0,.28); padding: .09rem .22rem; border-radius: 2px; letter-spacing: 1px; cursor: default; white-space: nowrap; }
        .pr-trade-tooltip { position: absolute; bottom: calc(100% + 6px); right: 0; background: #0f1020; border: 1px solid rgba(255,215,0,.5); border-radius: 4px; padding: .28rem .55rem; font-family: 'Press Start 2P', monospace; font-size: 7px; color: #FFD700; letter-spacing: 1.5px; white-space: nowrap; box-shadow: 0 6px 20px rgba(0,0,0,.9); z-index: 9999; pointer-events: none; }
        .pr-trade-tooltip::after { content: ''; position: absolute; top: 100%; right: 7px; border: 4px solid transparent; border-top-color: rgba(255,215,0,.5); }

        .pr-sel { display: flex; align-items: center; min-width: 0; padding-left: .25rem; min-width: 120px; }
        .pr-player-wrap { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .pr-player-name { font-family: 'VT323', monospace; font-size: 21px; color: #FFD700; line-height: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 0 10px rgba(255,215,0,.28); }
        .pr-player-meta { display: flex; align-items: center; gap: .3rem; flex-wrap: wrap; }
        .pr-pos-badge { font-family: 'Press Start 2P', monospace; font-size: 6.5px; color: rgba(135,206,235,.55); background: rgba(135,206,235,.08); border: 1px solid rgba(135,206,235,.18); padding: .07rem .22rem; border-radius: 2px; }
        .pr-tx-tag    { font-family: 'Press Start 2P', monospace; font-size: 6px; color: #FFD700; background: rgba(255,215,0,.08); border: 1px solid rgba(255,215,0,.2); padding: .07rem .22rem; border-radius: 2px; }
        .pr-drop-tag  { font-family: 'Press Start 2P', monospace; font-size: 6px; color: rgba(255,80,80,.65); border: 1px solid rgba(255,80,80,.18); padding: .07rem .22rem; border-radius: 2px; }

        .pr-otc { display: flex; align-items: center; gap: .35rem; }
        .pr-otc-dot  { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; animation: otcP 1.2s ease-in-out infinite; }
        .pr-otc-txt  { font-family: 'Press Start 2P', monospace; font-size: 8px; letter-spacing: 1.5px; }
        .pr-otc-time { font-family: 'Press Start 2P', monospace; font-size: 10px; }
        .pr-next-txt     { font-family: 'Press Start 2P', monospace; font-size: 7.5px; color: rgba(135,206,235,.5); letter-spacing: 1.5px; }
        .pr-upcoming-txt { font-family: 'VT323', monospace; font-size: 16px; color: rgba(255,255,255,.48); }
        .pr-overdue-txt  { font-family: 'VT323', monospace; font-size: 16px; color: rgba(255,255,255,.28); }

        .dp-loading { display: flex; flex-direction: column; gap: .25rem; padding: .4rem 0; }
        .dp-skel { height: 42px; border-radius: 4px; background: linear-gradient(90deg, rgba(255,255,255,.025), rgba(255,255,255,.05), rgba(255,255,255,.025)); background-size: 200% 100%; animation: shimmer 1.8s infinite; }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        .dp-complete { display: flex; align-items: center; justify-content: center; gap: .6rem; padding: 1.2rem; margin-top: .8rem; border: 1px solid rgba(255,215,0,.18); border-radius: 6px; }
        .dp-complete-txt { font-family: 'Press Start 2P', monospace; font-size: 11px; color: #FFD700; letter-spacing: 2px; }

        .rp-overlay { position: fixed; inset: 0; z-index: 500; background: rgba(0,0,0,.7); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; }
        .rp-card { background: #0a0a16; border: 1.5px solid rgba(255,255,255,.1); border-radius: 10px; width: 100%; max-width: 340px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.8); }
        .rp-header { display: flex; align-items: center; gap: .55rem; padding: .55rem .75rem; background: rgba(255,255,255,.03); border-bottom: 1px solid rgba(255,255,255,.07); }
        .rp-logo  { width: 28px; height: 28px; object-fit: contain; }
        .rp-team  { font-family: 'Press Start 2P', monospace; font-size: 10px; color: #fff; letter-spacing: 2px; }
        .rp-sub   { font-family: 'Press Start 2P', monospace; font-size: 6.5px; color: rgba(255,255,255,.22); letter-spacing: 1.5px; margin-top: 3px; }
        .rp-close { margin-left: auto; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); color: rgba(255,255,255,.3); border-radius: 4px; font-size: 10px; cursor: pointer; padding: .16rem .32rem; line-height: 1; }
        .rp-picks { padding: .35rem 0; max-height: 360px; overflow-y: auto; }
        .rp-pick-row { display: flex; align-items: center; gap: .45rem; padding: .28rem .75rem; border-bottom: 1px solid rgba(255,255,255,.03); }
        .rp-rd   { font-family: 'Press Start 2P', monospace; font-size: 6.5px; color: rgba(255,140,0,.5); letter-spacing: 1px; flex-shrink: 0; }
        .rp-name { flex: 1; font-family: 'VT323', monospace; font-size: 19px; color: rgba(220,215,200,.85); }
        .rp-pos  { font-family: 'Press Start 2P', monospace; font-size: 6.5px; color: rgba(135,206,235,.45); flex-shrink: 0; }
        .rp-empty { font-family: 'VT323', monospace; font-size: 17px; color: rgba(255,255,255,.2); text-align: center; padding: 1rem; }

        @media(max-width:900px) {
          .dp-body { grid-template-columns: 1fr; grid-template-rows: auto 1fr; height: auto; }
          .dp-left { max-height: 40vh; }
          .dp-right { height: 60vh; border-left: none; border-top: 1px solid rgba(255,255,255,.05); }
        }
      `}</style>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';

// ─── Auth gate ────────────────────────────────────────────────────────────────
function LoginGate({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    const { error: e } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (e) {
      setError(e.message);
      setLoading(false);
    } else {
      onLogin();
    }
  };

  return (
    <div className="da-login-wrap">
      <div className="da-login-card">
        <div className="da-login-logo">🏒</div>
        <div className="da-login-title">DRAFT ADMIN</div>
        <div className="da-login-sub">COMMISSIONER ACCESS ONLY</div>
        <div className="da-field-wrap">
          <label className="da-label">EMAIL</label>
          <input
            className="da-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>
        <div className="da-field-wrap">
          <label className="da-label">PASSWORD</label>
          <input
            className="da-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
        </div>
        {error && <div className="da-error">{error}</div>}
        <button
          className="da-btn da-btn-primary"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? 'SIGNING IN…' : 'SIGN IN →'}
        </button>
      </div>
      <style>{loginStyles}</style>
    </div>
  );
}

const loginStyles = `
  .da-login-wrap {
    min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:radial-gradient(ellipse 80% 60% at 50% 0%,#0a0a28,#00000a);
    font-family:'Press Start 2P',monospace;
  }
  .da-login-card {
    background:#0d0d18; border:1.5px solid rgba(255,140,0,.2);
    border-radius:12px; padding:2.2rem 2rem; width:100%; max-width:360px;
    display:flex; flex-direction:column; gap:1rem; align-items:center;
    box-shadow:0 0 60px rgba(255,140,0,.08);
  }
  .da-login-logo { font-size:36px; }
  .da-login-title { font-size:14px; color:#FF8C00; letter-spacing:2px; text-shadow:0 0 12px rgba(255,140,0,.4); }
  .da-login-sub   { font-size:7px; color:rgba(255,255,255,.2); letter-spacing:2px; }
  .da-field-wrap  { width:100%; display:flex; flex-direction:column; gap:.35rem; }
  .da-label       { font-size:7px; color:rgba(255,255,255,.3); letter-spacing:2px; }
  .da-input {
    width:100%; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.1);
    border-radius:5px; padding:.5rem .6rem; color:#fff;
    font-family:'VT323',monospace; font-size:20px; letter-spacing:1px;
    outline:none; transition:border-color .15s;
  }
  .da-input:focus { border-color:rgba(255,140,0,.4); }
  .da-error { font-size:7px; color:#FF4444; letter-spacing:1px; text-align:center; }
`;

// ─── Player search ─────────────────────────────────────────────────────────────
function PlayerSearch({ draftYear, draftLg, onSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      // Search available players only
      const { data } = await supabase
        .from('player_attributes_by_season')
        .select('player_master_id,player_name,pos,nhl_team,ovr')
        .eq('year', draftYear)
        .ilike('player_name', `%${query}%`)
        .order('ovr', { ascending: false })
        .limit(12);

      // Filter out already rostered
      const { data: rostered } = await supabase
        .from('rosters')
        .select('player_master_id')
        .eq('lg', draftLg);

      const rosteredIds = new Set(
        (rostered ?? []).map((r) => r.player_master_id)
      );
      setResults(
        (data ?? []).filter((p) => !rosteredIds.has(p.player_master_id))
      );
      setLoading(false);
    }, 280);
    return () => clearTimeout(t);
  }, [query, draftYear, draftLg]);

  return (
    <div className="ps-wrap">
      <div className="ps-search-wrap">
        <span className="ps-icon">⌕</span>
        <input
          className="ps-input"
          placeholder="Search available players…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading && <span className="ps-loading">…</span>}
        {query && (
          <button
            className="ps-clear"
            onClick={() => {
              setQuery('');
              setResults([]);
            }}
          >
            ✕
          </button>
        )}
      </div>
      {results.length > 0 && (
        <div className="ps-results">
          {results.map((p) => (
            <div
              key={p.player_master_id}
              className="ps-result-row"
              onClick={() => {
                onSelect(p);
                setQuery('');
                setResults([]);
              }}
            >
              <span
                className="ps-ovr"
                style={{
                  color:
                    p.ovr >= 80
                      ? '#FFD700'
                      : p.ovr >= 65
                      ? '#00C853'
                      : p.ovr >= 50
                      ? '#87CEEB'
                      : '#888',
                }}
              >
                {p.ovr}
              </span>
              <span className="ps-name">{p.player_name}</span>
              <span className="ps-pos">{p.pos?.trim()}</span>
              <span className="ps-nhl">{p.nhl_team}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN ADMIN PANEL
// ═══════════════════════════════════════════════════════════════
export default function DraftAdmin() {
  const [authed, setAuthed] = useState(false);
  const [schedule, setSchedule] = useState([]);
  const [picks, setPicks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('picks'); // picks | trades | schedule
  const [draftLg] = useState('W17');
  const [draftYear] = useState(2012);

  // Pick form state
  const [selPick, setSelPick] = useState(null); // selected schedule slot
  const [selPlayer, setSelPlayer] = useState(null); // selected player from search
  const [dropPlayer, setDropPlayer] = useState('');
  const [txFlag, setTxFlag] = useState(false);
  const [txDetails, setTxDetails] = useState('');

  // Trade form state
  const [tradePick, setTradePick] = useState('');
  const [tradeFrom, setTradeFrom] = useState('');
  const [tradeTo, setTradeTo] = useState('');
  const [tradeNote, setTradeNote] = useState('');

  // ── Auth check ──────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setAuthed(true);
    });
  }, []);

  // ── Load data ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: sched }, { data: draftPicks }, { data: teamData }] =
      await Promise.all([
        supabase
          .from('draft_schedule')
          .select('*')
          .eq('lg', draftLg)
          .order('pick'),
        supabase.from('draft').select('*').eq('lg', draftLg).order('pick'),
        supabase.from('teams').select('abr,team,coach').eq('lg', draftLg),
      ]);
    setSchedule(sched ?? []);
    setPicks(draftPicks ?? []);
    setTeams(teamData ?? []);
    setLoading(false);
  }, [draftLg]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const pickMap = Object.fromEntries(picks.map((p) => [p.pick, p]));
  const unpickedSlots = schedule.filter((s) => !pickMap[s.pick]);
  const nextSlot = unpickedSlots[0] ?? null;

  // ── Auto-select next unpicked slot ──────────────────────────────────────
  useEffect(() => {
    if (nextSlot && !selPick) setSelPick(nextSlot);
  }, [nextSlot]);

  // ── Submit pick ──────────────────────────────────────────────────────────
  const submitPick = async () => {
    if (!selPick || !selPlayer) {
      showToast('Select a pick slot and player', 'err');
      return;
    }
    if (pickMap[selPick.pick]) {
      showToast(`Pick #${selPick.pick} already submitted`, 'err');
      return;
    }

    setSaving(true);
    try {
      // 1. Write to draft table
      const { error: draftErr } = await supabase.from('draft').insert({
        lg: draftLg,
        team: selPick.team_code,
        round: selPick.round,
        pick: selPick.pick,
        player: selPlayer.player_name,
        player_master_id: selPlayer.player_master_id,
        pos: selPlayer.pos,
        transaction_flag: txFlag ? 1 : null,
        transaction_details: txFlag ? txDetails : null,
        dropped_player: dropPlayer || null,
        entity_type: 'player',
      });
      if (draftErr) throw draftErr;

      // 2. Write to rosters (makes player unavailable in pool)
      const { error: rosterErr } = await supabase.from('rosters').insert({
        lg: draftLg,
        player_master_id: selPlayer.player_master_id,
        player_name: selPlayer.player_name,
        player_id: selPlayer.player_id,
        team_code: selPick.team_code,
      });
      if (rosterErr) throw rosterErr;

      showToast(`✓ ${selPlayer.player_name} → ${selPick.team_code}`, 'ok');

      // Advance to next slot
      const nextUnpicked = unpickedSlots.find((s) => s.pick > selPick.pick);
      setSelPick(nextUnpicked ?? null);
      setSelPlayer(null);
      setDropPlayer('');
      setTxFlag(false);
      setTxDetails('');
      await load();
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  // ── Undo last pick ────────────────────────────────────────────────────────
  const undoLastPick = async () => {
    const lastPick = [...picks].sort((a, b) => b.pick - a.pick)[0];
    if (!lastPick) return;
    if (!window.confirm(`Undo pick #${lastPick.pick}: ${lastPick.player}?`))
      return;

    setSaving(true);
    try {
      await Promise.all([
        supabase
          .from('draft')
          .delete()
          .eq('lg', draftLg)
          .eq('pick', lastPick.pick),
        supabase
          .from('rosters')
          .delete()
          .eq('lg', draftLg)
          .eq('player_master_id', lastPick.player_master_id),
      ]);
      showToast(`↩ Undid pick #${lastPick.pick}`, 'ok');
      await load();
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  // ── Submit trade ──────────────────────────────────────────────────────────
  const submitTrade = async () => {
    if (!tradePick || !tradeFrom || !tradeTo) {
      showToast('Fill in all trade fields', 'err');
      return;
    }
    const pickNum = parseInt(tradePick);
    const slot = schedule.find((s) => s.pick === pickNum);
    if (!slot) {
      showToast(`Pick #${pickNum} not found`, 'err');
      return;
    }
    if (pickMap[pickNum]) {
      showToast(`Pick #${pickNum} already used`, 'err');
      return;
    }

    setSaving(true);
    try {
      // Update current owner in schedule
      const { error: schedErr } = await supabase
        .from('draft_schedule')
        .update({ team_code: tradeTo })
        .eq('lg', draftLg)
        .eq('pick', pickNum);
      if (schedErr) throw schedErr;

      // Log the trade
      const { error: tradeErr } = await supabase
        .from('draft_pick_trades')
        .insert({
          lg: draftLg,
          pick: pickNum,
          round: slot.round,
          from_team: tradeFrom,
          to_team: tradeTo,
          note: tradeNote || `from${tradeFrom}/${tradeTo}`,
        });
      if (tradeErr) throw tradeErr;

      showToast(`✓ Pick #${pickNum} traded: ${tradeFrom} → ${tradeTo}`, 'ok');
      setTradePick('');
      setTradeFrom('');
      setTradeTo('');
      setTradeNote('');
      await load();
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  if (!authed) return <LoginGate onLogin={() => setAuthed(true)} />;

  return (
    <div className="da-wrap">
      <div className="scanlines" aria-hidden />

      {/* Toast */}
      {toast && (
        <div className={`da-toast da-toast-${toast.type}`}>{toast.msg}</div>
      )}

      {/* Header */}
      <header className="da-header">
        <div className="da-hdr-left">
          <span className="da-hdr-icon">🏒</span>
          <div>
            <div className="da-hdr-title">DRAFT ADMIN</div>
            <div className="da-hdr-sub">{draftLg} COMMISSIONER PANEL</div>
          </div>
        </div>
        <div className="da-hdr-stats">
          <div className="da-stat-chip">
            <span className="da-sc-n">{picks.length}</span>
            <span className="da-sc-l">PICKS IN</span>
          </div>
          <div className="da-stat-chip">
            <span className="da-sc-n">{schedule.length - picks.length}</span>
            <span className="da-sc-l">REMAINING</span>
          </div>
        </div>
        <button
          className="da-btn da-btn-ghost da-signout"
          onClick={() => {
            supabase.auth.signOut();
            setAuthed(false);
          }}
        >
          SIGN OUT
        </button>
      </header>

      {/* Tabs */}
      <div className="da-tabs">
        {[
          { id: 'picks', label: '🏒 ENTER PICK' },
          { id: 'trades', label: '🔄 RECORD TRADE' },
          { id: 'schedule', label: '📋 PICK ORDER' },
        ].map((t) => (
          <button
            key={t.id}
            className={`da-tab ${activeTab === t.id ? 'da-tab-on' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <button
          className="da-tab da-tab-undo"
          onClick={undoLastPick}
          disabled={saving || picks.length === 0}
        >
          ↩ UNDO LAST
        </button>
      </div>

      <div className="da-body">
        {/* ── PICK ENTRY ─────────────────────────────────────────────────── */}
        {activeTab === 'picks' && (
          <div className="da-panel">
            <div className="da-section">
              <div className="da-section-title">PICK SLOT</div>
              <div className="da-slot-grid">
                {schedule
                  .filter((s) => !pickMap[s.pick])
                  .slice(0, 12)
                  .map((s) => (
                    <button
                      key={s.pick}
                      className={`da-slot-btn ${
                        selPick?.pick === s.pick ? 'da-slot-on' : ''
                      }`}
                      onClick={() => setSelPick(s)}
                    >
                      <span className="da-slot-rd">R{s.round}</span>
                      <span className="da-slot-pk">#{s.pick_in_round}</span>
                      <span className="da-slot-team">{s.team_code}</span>
                    </button>
                  ))}
              </div>
              {selPick && (
                <div className="da-slot-detail">
                  <img
                    src={`/assets/teamLogos/${selPick.team_code}.png`}
                    alt={selPick.team_code}
                    className="da-slot-logo"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <div>
                    <div className="da-slot-team-name">{selPick.team_code}</div>
                    <div className="da-slot-meta">
                      Round {selPick.round} · Pick {selPick.pick_in_round} · #
                      {selPick.pick} Overall
                    </div>
                    <div className="da-slot-mgr">{selPick.manager_name}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="da-section">
              <div className="da-section-title">PLAYER SELECTION</div>
              <PlayerSearch
                draftYear={draftYear}
                draftLg={draftLg}
                onSelect={setSelPlayer}
              />
              {selPlayer && (
                <div className="da-selected-player">
                  <span
                    className="da-sp-ovr"
                    style={{
                      color:
                        selPlayer.ovr >= 80
                          ? '#FFD700'
                          : selPlayer.ovr >= 65
                          ? '#00C853'
                          : '#87CEEB',
                    }}
                  >
                    {selPlayer.ovr}
                  </span>
                  <span className="da-sp-name">{selPlayer.player_name}</span>
                  <span className="da-sp-pos">{selPlayer.pos?.trim()}</span>
                  <span className="da-sp-nhl">{selPlayer.nhl_team}</span>
                  <button
                    className="da-sp-clear"
                    onClick={() => setSelPlayer(null)}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <div className="da-section">
              <div className="da-section-title">OPTIONAL DETAILS</div>
              <div className="da-field-row">
                <div className="da-field-wrap">
                  <label className="da-label">PLAYER DROPPED</label>
                  <input
                    className="da-input da-input-sm"
                    placeholder="Name if dropping a player…"
                    value={dropPlayer}
                    onChange={(e) => setDropPlayer(e.target.value)}
                  />
                </div>
              </div>
              <div className="da-field-row">
                <label className="da-check-wrap">
                  <input
                    type="checkbox"
                    checked={txFlag}
                    onChange={(e) => setTxFlag(e.target.checked)}
                  />
                  <span className="da-check-lbl">TRADE PICK</span>
                </label>
                {txFlag && (
                  <input
                    className="da-input da-input-sm"
                    placeholder="e.g. fromHAM/ITA"
                    value={txDetails}
                    onChange={(e) => setTxDetails(e.target.value)}
                  />
                )}
              </div>
            </div>

            <button
              className="da-btn da-btn-primary da-submit"
              onClick={submitPick}
              disabled={saving || !selPick || !selPlayer}
            >
              {saving
                ? 'SUBMITTING…'
                : `SUBMIT PICK #${selPick?.pick ?? '—'} →`}
            </button>
          </div>
        )}

        {/* ── TRADE ENTRY ────────────────────────────────────────────────── */}
        {activeTab === 'trades' && (
          <div className="da-panel">
            <div className="da-section">
              <div className="da-section-title">RECORD PICK TRADE</div>
              <p className="da-help">
                Use this to transfer ownership of a future pick before it is
                used. The draft board will update immediately for all viewers.
              </p>

              <div className="da-trade-grid">
                <div className="da-field-wrap">
                  <label className="da-label">PICK # (OVERALL)</label>
                  <input
                    className="da-input"
                    type="number"
                    min="1"
                    max="54"
                    placeholder="e.g. 18"
                    value={tradePick}
                    onChange={(e) => setTradePick(e.target.value)}
                  />
                  {tradePick &&
                    schedule.find((s) => s.pick === parseInt(tradePick)) && (
                      <div className="da-trade-pick-info">
                        Round{' '}
                        {
                          schedule.find((s) => s.pick === parseInt(tradePick))
                            ?.round
                        }{' '}
                        · Currently:{' '}
                        {
                          schedule.find((s) => s.pick === parseInt(tradePick))
                            ?.team_code
                        }
                      </div>
                    )}
                </div>

                <div className="da-field-wrap">
                  <label className="da-label">FROM TEAM</label>
                  <select
                    className="da-input da-select"
                    value={tradeFrom}
                    onChange={(e) => setTradeFrom(e.target.value)}
                  >
                    <option value="">Select team…</option>
                    {teams.map((t) => (
                      <option key={t.abr} value={t.abr}>
                        {t.abr} — {t.team}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="da-field-wrap">
                  <label className="da-label">TO TEAM</label>
                  <select
                    className="da-input da-select"
                    value={tradeTo}
                    onChange={(e) => setTradeTo(e.target.value)}
                  >
                    <option value="">Select team…</option>
                    {teams.map((t) => (
                      <option key={t.abr} value={t.abr}>
                        {t.abr} — {t.team}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="da-field-wrap">
                  <label className="da-label">NOTE (OPTIONAL)</label>
                  <input
                    className="da-input"
                    placeholder="e.g. fromHAM/ITA"
                    value={tradeNote}
                    onChange={(e) => setTradeNote(e.target.value)}
                  />
                </div>
              </div>

              <button
                className="da-btn da-btn-primary da-submit"
                onClick={submitTrade}
                disabled={saving || !tradePick || !tradeFrom || !tradeTo}
              >
                {saving ? 'RECORDING…' : 'RECORD TRADE →'}
              </button>
            </div>
          </div>
        )}

        {/* ── PICK ORDER / SCHEDULE ──────────────────────────────────────── */}
        {activeTab === 'schedule' && (
          <div className="da-panel">
            <div className="da-section">
              <div className="da-section-title">FULL PICK SCHEDULE</div>
              {loading ? (
                <div className="da-loading">Loading…</div>
              ) : (
                <div className="da-sched-table">
                  <div className="da-sched-hdr">
                    <span>#</span>
                    <span>RD</span>
                    <span>TEAM</span>
                    <span>MANAGER</span>
                    <span>WINDOW</span>
                    <span>STATUS</span>
                  </div>
                  {schedule.map((s) => {
                    const done = !!pickMap[s.pick];
                    const traded = s.original_team !== s.team_code;
                    return (
                      <div
                        key={s.pick}
                        className={`da-sched-row ${
                          done ? 'da-sched-done' : ''
                        } ${traded ? 'da-sched-traded' : ''}`}
                      >
                        <span className="da-sched-pick">{s.pick}</span>
                        <span className="da-sched-rd">R{s.round}</span>
                        <span className="da-sched-team">
                          {s.team_code}
                          {traded && (
                            <span className="da-traded-badge">TRADE</span>
                          )}
                        </span>
                        <span className="da-sched-mgr">{s.manager_name}</span>
                        <span className="da-sched-time">
                          {s.window_opens_at
                            ? new Date(s.window_opens_at).toLocaleTimeString(
                                'en-US',
                                { hour: 'numeric', minute: '2-digit' }
                              )
                            : '—'}
                        </span>
                        <span
                          className={`da-sched-status ${
                            done ? 'da-st-done' : 'da-st-open'
                          }`}
                        >
                          {done ? `✓ ${pickMap[s.pick]?.player}` : 'OPEN'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        *, *::before, *::after { box-sizing:border-box; }
        html, body { background:#00000a !important; }

        .da-wrap {
          min-height:100vh;
          background:radial-gradient(ellipse 100% 30% at 50% 0%,#100a20,#00000a);
          font-family:'Press Start 2P',monospace;
          color:rgba(220,215,200,.85);
          padding-bottom:3rem;
          position:relative;
        }
        .scanlines {
          position:fixed;inset:0;pointer-events:none;z-index:9997;
          background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.04) 2px,rgba(0,0,0,.04) 4px);
        }

        /* Toast */
        .da-toast {
          position:fixed;top:1rem;right:1rem;z-index:9999;
          font-family:'Press Start 2P',monospace;font-size:9px;letter-spacing:1px;
          padding:.6rem 1rem;border-radius:6px;
          animation:toastIn .2s ease;
        }
        @keyframes toastIn{from{transform:translateX(20px);opacity:0}to{transform:translateX(0);opacity:1}}
        .da-toast-ok  { background:rgba(0,200,83,.15);border:1px solid rgba(0,200,83,.4);color:#00C853; }
        .da-toast-err { background:rgba(255,60,60,.15);border:1px solid rgba(255,60,60,.4);color:#FF4444; }

        /* Header */
        .da-header {
          display:flex;align-items:center;gap:1rem;
          padding:.7rem 1.2rem;
          background:rgba(0,0,0,.6);
          border-bottom:1px solid rgba(255,140,0,.12);
          backdrop-filter:blur(10px);
          position:sticky;top:0;z-index:100;
        }
        .da-hdr-left { display:flex;align-items:center;gap:.6rem;flex:1; }
        .da-hdr-icon { font-size:22px; }
        .da-hdr-title { font-size:12px;color:#FF8C00;letter-spacing:2px;text-shadow:0 0 10px rgba(255,140,0,.35); }
        .da-hdr-sub   { font-size:7px;color:rgba(255,255,255,.22);letter-spacing:2px;margin-top:3px; }
        .da-hdr-stats { display:flex;gap:.75rem;flex-shrink:0; }
        .da-stat-chip { display:flex;flex-direction:column;align-items:center;gap:1px;
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);
          border-radius:5px;padding:.3rem .6rem;min-width:55px; }
        .da-sc-n { font-size:18px;color:#fff;line-height:1; }
        .da-sc-l { font-size:6px;color:rgba(255,255,255,.2);letter-spacing:1.5px; }

        /* Tabs */
        .da-tabs {
          display:flex;align-items:center;gap:0;
          border-bottom:1px solid rgba(255,255,255,.06);
          background:rgba(0,0,0,.3);
          padding:0 1.2rem;
          flex-wrap:wrap;
        }
        .da-tab {
          font-family:'Press Start 2P',monospace;font-size:8px;letter-spacing:1px;
          color:rgba(255,255,255,.3);background:transparent;
          border:none;border-bottom:2px solid transparent;
          padding:.6rem .9rem;cursor:pointer;transition:all .14s;
          white-space:nowrap;
        }
        .da-tab:hover { color:rgba(255,255,255,.6); }
        .da-tab-on    { color:#FF8C00 !important;border-bottom-color:#FF8C00 !important; }
        .da-tab-undo  { margin-left:auto;color:rgba(255,100,100,.5); }
        .da-tab-undo:hover { color:rgba(255,100,100,.8); }
        .da-tab-undo:disabled { opacity:.25;cursor:not-allowed; }

        /* Body */
        .da-body { padding:1.2rem;max-width:860px;margin:0 auto; }
        .da-panel { display:flex;flex-direction:column;gap:1.2rem; }

        .da-section {
          background:rgba(255,255,255,.025);
          border:1px solid rgba(255,255,255,.07);
          border-radius:8px;padding:1rem;
          display:flex;flex-direction:column;gap:.8rem;
        }
        .da-section-title {
          font-size:9px;color:rgba(255,140,0,.65);
          letter-spacing:2.5px;
          border-bottom:1px solid rgba(255,140,0,.1);
          padding-bottom:.5rem;
        }
        .da-help {
          font-family:'VT323',monospace;font-size:17px;
          color:rgba(255,255,255,.35);line-height:1.5;margin:0;
        }

        /* Slot grid */
        .da-slot-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:.4rem; }
        .da-slot-btn {
          display:flex;flex-direction:column;align-items:center;gap:2px;
          background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);
          border-radius:5px;padding:.4rem .3rem;cursor:pointer;transition:all .12s;
        }
        .da-slot-btn:hover { background:rgba(255,140,0,.07);border-color:rgba(255,140,0,.2); }
        .da-slot-on { background:rgba(255,140,0,.12) !important;border-color:rgba(255,140,0,.4) !important;
          box-shadow:0 0 10px rgba(255,140,0,.15); }
        .da-slot-rd   { font-size:6px;color:rgba(255,255,255,.25);letter-spacing:1px; }
        .da-slot-pk   { font-size:12px;color:#fff;line-height:1; }
        .da-slot-team { font-size:7px;color:rgba(135,206,235,.55);letter-spacing:1px; }

        .da-slot-detail {
          display:flex;align-items:center;gap:.7rem;
          background:rgba(255,140,0,.06);border:1px solid rgba(255,140,0,.15);
          border-radius:6px;padding:.55rem .8rem;
        }
        .da-slot-logo { width:32px;height:32px;object-fit:contain; }
        .da-slot-team-name { font-size:13px;color:#fff;letter-spacing:2px;margin-bottom:2px; }
        .da-slot-meta { font-family:'VT323',monospace;font-size:17px;color:rgba(255,255,255,.4); }
        .da-slot-mgr  { font-family:'VT323',monospace;font-size:15px;color:rgba(135,206,235,.45); }

        /* Player search */
        .ps-wrap { display:flex;flex-direction:column;gap:.4rem; }
        .ps-search-wrap {
          position:relative;display:flex;align-items:center;
          background:rgba(255,255,255,.04);
          border:1px solid rgba(255,255,255,.1);border-radius:5px;
        }
        .ps-icon  { position:absolute;left:.5rem;font-size:18px;color:rgba(255,255,255,.2);pointer-events:none; }
        .ps-input {
          width:100%;background:transparent;border:none;outline:none;
          font-family:'VT323',monospace;font-size:20px;
          color:rgba(255,255,255,.8);padding:.35rem .5rem .35rem 1.7rem;
        }
        .ps-loading { position:absolute;right:2rem;color:rgba(255,255,255,.2);font-family:'VT323',monospace;font-size:18px; }
        .ps-clear   { position:absolute;right:.4rem;background:none;border:none;color:rgba(255,255,255,.2);cursor:pointer;font-size:11px; }
        .ps-results {
          background:#0d0d18;border:1px solid rgba(255,255,255,.1);
          border-radius:5px;overflow:hidden;max-height:260px;overflow-y:auto;
        }
        .ps-results::-webkit-scrollbar{width:3px;}
        .ps-results::-webkit-scrollbar-thumb{background:rgba(255,140,0,.2);}
        .ps-result-row {
          display:flex;align-items:center;gap:.5rem;
          padding:.35rem .7rem;border-bottom:1px solid rgba(255,255,255,.04);
          cursor:pointer;transition:background .1s;
        }
        .ps-result-row:hover { background:rgba(255,140,0,.06); }
        .ps-ovr  { font-size:11px;min-width:26px;text-align:center; }
        .ps-name { flex:1;font-family:'VT323',monospace;font-size:19px;color:rgba(220,215,200,.85); }
        .ps-pos  { font-size:7px;color:rgba(135,206,235,.5);background:rgba(135,206,235,.08);border:1px solid rgba(135,206,235,.15);padding:.1rem .25rem;border-radius:2px; }
        .ps-nhl  { font-size:7px;color:rgba(255,255,255,.25); }

        .da-selected-player {
          display:flex;align-items:center;gap:.5rem;
          background:rgba(0,200,83,.08);border:1px solid rgba(0,200,83,.25);
          border-radius:5px;padding:.45rem .7rem;
        }
        .da-sp-ovr  { font-size:12px;min-width:26px; }
        .da-sp-name { flex:1;font-family:'VT323',monospace;font-size:20px;color:#fff; }
        .da-sp-pos  { font-size:7px;color:rgba(135,206,235,.6);background:rgba(135,206,235,.1);border:1px solid rgba(135,206,235,.2);padding:.1rem .3rem;border-radius:2px; }
        .da-sp-nhl  { font-size:7px;color:rgba(255,255,255,.3); }
        .da-sp-clear{ background:none;border:none;color:rgba(255,255,255,.25);cursor:pointer;font-size:12px;padding:.1rem; }

        /* Fields */
        .da-field-row { display:flex;align-items:center;gap:.75rem;flex-wrap:wrap; }
        .da-field-wrap { display:flex;flex-direction:column;gap:.3rem;flex:1;min-width:160px; }
        .da-label { font-size:7px;color:rgba(255,255,255,.3);letter-spacing:2px; }
        .da-input {
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);
          border-radius:5px;padding:.42rem .6rem;
          color:#fff;font-family:'VT323',monospace;font-size:19px;
          outline:none;transition:border-color .15s;width:100%;
        }
        .da-input:focus { border-color:rgba(255,140,0,.4); }
        .da-input-sm { font-size:17px;padding:.32rem .5rem; }
        .da-select { cursor:pointer; }
        .da-select option { background:#0d0d18;color:#fff; }

        .da-check-wrap { display:flex;align-items:center;gap:.4rem;cursor:pointer;flex-shrink:0; }
        .da-check-wrap input { accent-color:#FF8C00;width:14px;height:14px; }
        .da-check-lbl { font-size:8px;color:rgba(255,255,255,.4);letter-spacing:1.5px; }

        /* Trade grid */
        .da-trade-grid { display:grid;grid-template-columns:1fr 1fr;gap:.8rem; }
        .da-trade-pick-info { font-family:'VT323',monospace;font-size:15px;color:rgba(135,206,235,.5);margin-top:2px; }

        /* Buttons */
        .da-btn {
          font-family:'Press Start 2P',monospace;letter-spacing:1.5px;
          border-radius:5px;cursor:pointer;transition:all .15s;line-height:1;
        }
        .da-btn-primary {
          font-size:9px;padding:.6rem 1.2rem;
          background:rgba(255,140,0,.15);border:1.5px solid rgba(255,140,0,.4);color:#FF8C00;
        }
        .da-btn-primary:hover:not(:disabled) { background:rgba(255,140,0,.25);border-color:rgba(255,140,0,.7);color:#FFB84D; }
        .da-btn-primary:disabled { opacity:.35;cursor:not-allowed; }
        .da-btn-ghost {
          font-size:7px;padding:.35rem .7rem;
          background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.08);color:rgba(255,255,255,.3);
        }
        .da-btn-ghost:hover { border-color:rgba(255,255,255,.18);color:rgba(255,255,255,.6); }
        .da-submit { align-self:flex-start;margin-top:.3rem; }
        .da-signout { flex-shrink:0; }

        /* Schedule table */
        .da-sched-table { display:flex;flex-direction:column;gap:0;border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,.06); }
        .da-sched-hdr,.da-sched-row { display:grid;grid-template-columns:44px 32px 100px 1fr 90px 1fr;gap:.5rem;align-items:center;padding:.3rem .7rem; }
        .da-sched-hdr { background:rgba(0,0,0,.4);font-size:7px;color:rgba(255,255,255,.18);letter-spacing:1.5px;border-bottom:1px solid rgba(255,255,255,.06); }
        .da-sched-row { border-bottom:1px solid rgba(255,255,255,.03);transition:background .1s; }
        .da-sched-row:last-child { border-bottom:none; }
        .da-sched-row:hover { background:rgba(255,255,255,.02); }
        .da-sched-done { background:rgba(0,200,83,.02) !important; }
        .da-sched-traded { border-left:2px solid rgba(255,215,0,.3); }
        .da-sched-pick { font-size:11px;color:rgba(255,255,255,.45); }
        .da-sched-rd   { font-size:8px;color:rgba(255,140,0,.4); }
        .da-sched-team { font-family:'VT323',monospace;font-size:17px;color:rgba(135,206,235,.6);display:flex;align-items:center;gap:.3rem;flex-wrap:wrap; }
        .da-traded-badge { font-family:'Press Start 2P',monospace;font-size:5.5px;color:#FFD700;background:rgba(255,215,0,.1);border:1px solid rgba(255,215,0,.25);padding:.08rem .2rem;border-radius:2px; }
        .da-sched-mgr  { font-family:'VT323',monospace;font-size:16px;color:rgba(255,255,255,.3); }
        .da-sched-time { font-family:'VT323',monospace;font-size:16px;color:rgba(255,255,255,.3); }
        .da-st-done { font-family:'VT323',monospace;font-size:16px;color:rgba(0,200,83,.6); }
        .da-st-open { font-size:7px;color:rgba(255,255,255,.2);letter-spacing:1px; }

        .da-loading { font-family:'VT323',monospace;font-size:18px;color:rgba(255,255,255,.2);padding:1rem;text-align:center; }

        @media(max-width:600px){
          .da-trade-grid { grid-template-columns:1fr; }
          .da-sched-hdr,.da-sched-row { grid-template-columns:36px 28px 72px 1fr 70px; }
          .da-sched-mgr { display:none; }
        }
      `}</style>
    </div>
  );
}

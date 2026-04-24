import React, { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  getDoctorDashboard,
  startOPD,
  nextToken,
  skipToken,
  endOPD,
  staffConfirmAttendance,
  resendOPDNotification,
  pauseOPD,
  resumeOPD,
} from "../services/allApi";

const SESSIONS = ["morning", "evening"];

const STATUS_BG = {
  pending:    "#fef9c3", waiting:    "#ede9fe",
  consulting: "#d1fae5", done:       "#f3f4f6",
  approved:   "#dbeafe", skipped:    "#fee2e2",
};
const STATUS_FG = {
  pending:    "#92400e", waiting:    "#5b21b6",
  consulting: "#065f46", done:       "#6b7280",
  approved:   "#1e40af", skipped:    "#991b1b",
};

const GRACE_POSITION = 5;

function buildCallingOrder(tokens, startedAt) {
  const startTime  = startedAt ? new Date(startedAt) : null;
  const lateCutoff = startTime
    ? new Date(startTime.getTime() + 10 * 60 * 1000)
    : null;

  const consulting = tokens.filter(t => t.status === "consulting");
  const done       = tokens.filter(t => t.status === "done");
  const skipped    = tokens.filter(t => t.status === "skipped");
  const waiting    = tokens.filter(t => t.status === "waiting");
  const currentTokenNum = consulting[0]?.token ?? 0;

  const isLate = (t) => {
    if (t.patient_type !== "online" || !t.is_confirmed) return false;
    if (!lateCutoff) return false;
    const ct = t.confirmation_time ? new Date(t.confirmation_time) : null;
    return ct && ct > lateCutoff;
  };

  const mainQueue = waiting
    .filter(t => {
      if (t.patient_type === "walkin") return true;
      if (!t.is_confirmed) return false;
      if (!isLate(t)) return true;
      return t.token >= currentTokenNum;
    })
    .sort((a, b) => a.token - b.token);

  const lateMissed = waiting
    .filter(t => isLate(t) && t.token < currentTokenNum)
    .sort((a, b) => a.token - b.token);

  const unconfirmed = waiting
    .filter(t => t.patient_type === "online" && !t.is_confirmed)
    .sort((a, b) => a.token - b.token);

  const mainWithGroups = mainQueue.map(t => ({ ...t, _queueGroup: isLate(t) ? "late" : "main" }));
  const insertAt = Math.min(GRACE_POSITION, mainWithGroups.length);
  lateMissed.forEach((t, i) => {
    mainWithGroups.splice(insertAt + i, 0, { ...t, _queueGroup: "grace" });
  });

  const queue = [
    ...mainWithGroups,
    ...unconfirmed.map(t => ({ ...t, _queueGroup: "unconfirmed" })),
  ];

  return {
    consulting,
    queue,
    done:    done.sort((a, b)    => a.token - b.token),
    skipped: skipped.sort((a, b) => a.token - b.token),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// extractSessionState: read per-session OPD active flags from backend response.
//
// Backend shape A (modern):
//   data.opd_sessions = { morning: { is_active, started_at, is_paused, pause_reason }, evening: { is_active, started_at, is_paused, pause_reason } }
//
// Backend shape B (legacy):
//   data.opd_started = true, data.started_at = "..."
//   → ONLY morning is considered active. Evening is NEVER inferred from this.
//
// Returns:
//   active:    { morning: bool,    evening: bool    }
//   startedAt: { morning: str|null, evening: str|null }
//   paused:    { morning: bool,    evening: bool    }
//   pauseReason: { morning: str|null, evening: str|null }
// ─────────────────────────────────────────────────────────────────────────────
function extractSessionState(data) {
  const active    = { morning: false, evening: false };
  const startedAt = { morning: null,  evening: null  };
  const paused    = { morning: false, evening: false };
  const pauseReason = { morning: null, evening: null };

  if (!data) return { active, startedAt, paused, pauseReason };

  if (data.opd_sessions) {
    // Shape A — modern per-session flags from backend
    SESSIONS.forEach(sess => {
      active[sess]    = data.opd_sessions[sess]?.is_active  ?? false;
      startedAt[sess] = data.opd_sessions[sess]?.started_at ?? null;
      paused[sess]    = data.opd_sessions[sess]?.is_paused  ?? false;
      pauseReason[sess] = data.opd_sessions[sess]?.pause_reason ?? null;
    });
  } else if (data.opd_started) {
    // Shape B — legacy single flag: morning only, evening stays false
    active.morning    = true;
    startedAt.morning = data.started_at ?? null;
    paused.morning    = data.is_paused ?? false;
    pauseReason.morning = data.pause_reason ?? null;
    // NOTE: active.evening intentionally left false — do NOT read it from here
  }

  return { active, startedAt, paused, pauseReason };
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DoctorDashboard() {
  const navigate = useNavigate();
  const today    = new Date().toISOString().split("T")[0];
  const pollRef  = useRef(null);

  const [date,          setDate]          = useState(today);
  const [dashboard,     setDashboard]     = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [acting,        setActing]        = useState(null);
  const [autoRefresh,   setAutoRefresh]   = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [confirmEnd,    setConfirmEnd]    = useState(null); // null | { session }

  // ── Strictly isolated per-session OPD state ──────────────────────────────
  // These are the ONLY source of truth for active/startedAt.
  // They are set from extractSessionState() on every fetch.
  // Starting/ending one session NEVER touches the other.
  const [sessActive,    setSessActive]    = useState({ morning: false, evening: false });
  const [sessStartedAt, setSessStartedAt] = useState({ morning: null,  evening: null  });
  const [sessPaused,    setSessPaused]    = useState({ morning: false, evening: false });
  const [sessPauseReason, setSessPauseReason] = useState({ morning: null, evening: null });
  const [pauseModal, setPauseModal] = useState(null); // null | { session, action: 'pause'|'resume' }

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await getDoctorDashboard(date);
      const data = res.data;
      setDashboard(data);
      setLastRefreshed(new Date());

      const { active, startedAt, paused, pauseReason } = extractSessionState(data);
      setSessActive(active);
      setSessStartedAt(startedAt);
      setSessPaused(paused);
      setSessPauseReason(pauseReason);
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      if (!silent) toast.error("Failed to load dashboard");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [date, navigate]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  useEffect(() => {
    if (autoRefresh) {
      pollRef.current = setInterval(() => fetchDashboard(true), 15000);
    }
    return () => clearInterval(pollRef.current);
  }, [autoRefresh, fetchDashboard]);

  // ── Actions — all scoped to the session argument ──────────────────────────

  const handleStartOPD = async (session) => {
    setActing(`start_${session}`);
    try {
      const res = await startOPD({ date, session });
      toast.success(res.data.message || `${session} OPD started!`);
      // Optimistic update for THIS session only — other session untouched
      setSessActive(prev => ({ ...prev, [session]: true }));
      setSessStartedAt(prev => ({ ...prev, [session]: new Date().toISOString() }));
      fetchDashboard(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to start OPD");
    } finally { setActing(null); }
  };

  const handleNextToken = async (session) => {
    setActing(`next_${session}`);
    try {
      const res = await nextToken(date, session);
      toast.success(res.data.message || "Next token called!");
      fetchDashboard(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "No patients in queue");
    } finally { setActing(null); }
  };

  const handleSkip = async (id, tokenNum) => {
    if (!window.confirm(`Skip Token #${tokenNum}?`)) return;
    setActing("skip_" + id);
    try {
      await skipToken(id);
      toast.warning(`Token #${tokenNum} skipped`);
      fetchDashboard(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "Skip failed");
    } finally { setActing(null); }
  };

  const handleConfirm = async (id, tokenNum) => {
    setActing("confirm_" + id);
    try {
      const res = await staffConfirmAttendance(id);
      toast.success(res.data.message || `Token #${tokenNum} confirmed`);
      fetchDashboard(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "Confirm failed");
    } finally { setActing(null); }
  };

  const handleResend = async (id, tokenNum) => {
    setActing("resend_" + id);
    try {
      const res = await resendOPDNotification(id);
      toast.success(res.data.message || `Notification resent for #${tokenNum}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Resend failed");
    } finally { setActing(null); }
  };

  const handleEndOPD = async (session) => {
    setConfirmEnd(null);
    setActing(`end_${session}`);
    try {
      const res = await endOPD({ date, session });
      toast.success(res.data.message || `${session} OPD ended`);
      // Optimistic: only mark THIS session inactive, other stays as-is
      setSessActive(prev => ({ ...prev, [session]: false }));
      fetchDashboard(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to end OPD");
    } finally { setActing(null); }
  };

  const handlePauseOPD = async (session, reason) => {
    setActing(`pause_${session}`);
    try {
      const res = await pauseOPD({ date, session, reason: reason || null });
      toast.info(res.data.message || "OPD paused");
      setSessPaused(prev => ({ ...prev, [session]: true }));
      setSessPauseReason(prev => ({ ...prev, [session]: reason || null }));
      fetchDashboard(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to pause OPD");
    } finally { setActing(null); setPauseModal(null); }
  };

  const handleResumeOPD = async (session) => {
    setActing(`resume_${session}`);
    try {
      const res = await resumeOPD({ date, session });
      toast.success(res.data.message || "OPD resumed");
      setSessPaused(prev => ({ ...prev, [session]: false }));
      setSessPauseReason(prev => ({ ...prev, [session]: null }));
      fetchDashboard(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to resume OPD");
    } finally { setActing(null); }
  };

  // ── Derived per-session display data ──────────────────────────────────────
  const avgMin = dashboard?.avg_consult_minutes || 7;

  const sessionData = SESSIONS.map(sess => {
    const tokens = (dashboard?.tokens || []).filter(t => t.session === sess);

    // Read ONLY from isolated state — no fallback to dashboard flags
    const opdActive = sessActive[sess];
    const startedAt = sessStartedAt[sess];
    const isSessPaused = sessPaused[sess];
    const pauseReason = sessPauseReason[sess];

    const { consulting, queue, done, skipped } = buildCallingOrder(tokens, startedAt);
    const currentToken     = consulting[0] || null;
    const waitingCount     = queue.filter(t => t._queueGroup !== "unconfirmed").length;
    const unconfirmedCount = queue.filter(t => t._queueGroup === "unconfirmed").length;
    const urgentCount      = queue.filter(t => t._queueGroup === "grace").length;
    const nextUp           = queue.find(t => t._queueGroup !== "unconfirmed") || null;

    return { sess, tokens, opdActive, startedAt, consulting, queue, done, skipped,
             currentToken, waitingCount, unconfirmedCount, urgentCount, nextUp,
             isSessPaused, pauseReason };
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* ── Top Bar ── */}
      <div style={S.topBar}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={S.logoCircle}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
            </svg>
          </div>
          <div>
            <h1 style={S.topTitle}>Doctor Dashboard</h1>
            <p style={S.topSub}>MedQueue OPD Management</p>
          </div>
        </div>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <button
            onClick={() => setAutoRefresh(r => !r)}
            style={{ ...S.iconBtn,
              background: autoRefresh ? "#d1fae5" : "#f1f5f9",
              color:      autoRefresh ? "#065f46" : "#64748b" }}>
            {autoRefresh ? "🔄 Live" : "⏸ Paused"}
          </button>
          {lastRefreshed && (
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.65)" }}>
              Updated {lastRefreshed.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
            </span>
          )}
          <button onClick={() => fetchDashboard()} style={S.iconBtn}>↻ Refresh</button>
        </div>
      </div>

      {/* ── Date / Doctor Info Bar ── */}
      <div style={S.filterBar}>
        <div style={{ display:"flex", gap:14, alignItems:"center", flexWrap:"wrap" }}>
          <div>
            <label style={S.filterLabel}>Date</label>
            <input type="date" value={date}
              onChange={e => setDate(e.target.value)} style={S.input} />
          </div>
          {dashboard && (
            <>
              <span style={{ fontSize:13, color:"#0f4c75", fontWeight:600 }}>
                Dr. {dashboard.doctor}
              </span>
              <span style={{ fontSize:12, color:"#64748b" }}>Avg consult: {avgMin} min</span>
            </>
          )}
        </div>
      </div>

      {loading ? <Spinner /> : !dashboard ? <Empty text="No data found" /> : (
        <div style={S.content}>

          {/* ════════════════════════════════════════════
              One card per session — fully independent
          ════════════════════════════════════════════ */}
          {sessionData.map(({
            sess, opdActive, startedAt,
            consulting, queue, done, skipped,
            currentToken, waitingCount, unconfirmedCount, urgentCount, nextUp,
            isSessPaused, pauseReason,
          }) => {
            const startKey   = `start_${sess}`;
            const nextKey    = `next_${sess}`;
            const endKey     = `end_${sess}`;
            const pauseKey   = `pause_${sess}`;
            const resumeKey  = `resume_${sess}`;
            const isStarting = acting === startKey;
            const isNexting  = acting === nextKey;
            const isEnding   = acting === endKey;
            const isPausing  = acting === pauseKey;
            const isResuming = acting === resumeKey;

            return (
              <div key={sess} style={S.sessionCard}>

                {/* Session header — each has its own independent Start/Next/End */}
                <div style={{
                  ...S.sessionHeader,
                  background: sess === "morning"
                    ? "linear-gradient(90deg,#0f4c75,#1b6ca8)"
                    : "linear-gradient(90deg,#1a3a5c,#0f4c75)",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                    <span style={{ fontSize:26 }}>{sess === "morning" ? "🌅" : "🌆"}</span>
                    <div>
                      <div style={{ fontSize:16, fontWeight:700, color:"#fff" }}>
                        {sess.charAt(0).toUpperCase() + sess.slice(1)} Session OPD
                      </div>
                      {opdActive && startedAt && (
                        <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)", marginTop:2 }}>
                          Started at{" "}
                          {new Date(startedAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
                        </div>
                      )}
                    </div>
                    {/* Status pill is per-session — reads only its own opdActive */}
                    {!opdActive
                      ? <span style={S.pillInactive}>⚪ Not Started</span>
                      : isSessPaused
                      ? <span style={{...S.pillActive, background: "#fbbf24", color: "#92400e"}}>⏸ Paused</span>
                      : <span style={S.pillActive}>🟢 Active</span>
                    }
                  </div>

                  {/* Buttons — scoped to this session only */}
                  <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                    {!opdActive ? (
                      <button
                        onClick={() => handleStartOPD(sess)}
                        disabled={!!acting}
                        style={S.startBtn}>
                        {isStarting ? "Starting..." : "▶ Start OPD"}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleNextToken(sess)}
                          disabled={!!acting}
                          style={S.nextBtnWhite}>
                          {isNexting ? "Calling..." : "⏭ Next Token"}
                        </button>
                        {!isSessPaused ? (
                          <button
                            onClick={() => setPauseModal({ session: sess, action: 'pause' })}
                            disabled={!!acting}
                            style={{...S.endBtnWhite, background: "#fbbf24", color: "#92400e"}}>
                            ⏸ Pause
                          </button>
                        ) : (
                          <button
                            onClick={() => handleResumeOPD(sess)}
                            disabled={!!acting}
                            style={{...S.nextBtnWhite, background: "#86efac", color: "#166534"}}>
                            {isResuming ? "Resuming..." : "▶ Resume"}
                          </button>
                        )}
                        <button
                          onClick={() => setConfirmEnd({ session: sess })}
                          disabled={!!acting}
                          style={S.endBtnWhite}>
                          {isEnding ? "Ending..." : "⏹ End OPD"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Not started placeholder */}
                {!opdActive && (
                  <div style={S.notStartedBox}>
                    <div style={{ fontSize:40, marginBottom:10 }}>
                      {sess === "morning" ? "🌅" : "🌆"}
                    </div>
                    <h4 style={{ color:"#0f4c75", margin:"0 0 6px" }}>
                      {sess.charAt(0).toUpperCase() + sess.slice(1)} OPD Not Started
                    </h4>
                    <p style={{ color:"#64748b", margin:"0 0 18px", fontSize:13 }}>
                      Click below to begin the {sess} session for {date}
                    </p>
                    <button
                      onClick={() => handleStartOPD(sess)}
                      disabled={!!acting}
                      style={{ ...S.startBtn, padding:"11px 30px", fontSize:14 }}>
                      {isStarting
                        ? "Starting..."
                        : `▶ Start ${sess.charAt(0).toUpperCase() + sess.slice(1)} OPD`}
                    </button>
                  </div>
                )}

                {/* Active OPD content */}
                {opdActive && (
                  <div style={S.sessionContent}>

                    {/* Stats row */}
                    <div style={S.statsRow}>
                      {[
                        { label:"Waiting",     val: waitingCount,        color:"#5b21b6", bg:"#ede9fe", icon:"⏳" },
                        { label:"Consulting",  val: currentToken ? 1 : 0,color:"#065f46", bg:"#d1fae5", icon:"🩺" },
                        { label:"Done",        val: done.length,         color:"#0f4c75", bg:"#dbeafe", icon:"✅" },
                        { label:"Skipped",     val: skipped.length,      color:"#991b1b", bg:"#fee2e2", icon:"⏭" },
                        { label:"Unconfirmed", val: unconfirmedCount,    color:"#92400e", bg:"#fef9c3", icon:"⚠️" },
                        { label:"Avg Time",    val: `${avgMin}m`,        color:"#0369a1", bg:"#e0f2fe", icon:"⏱" },
                      ].map(s => (
                        <div key={s.label} style={{ ...S.statCard, background:s.bg }}>
                          <div style={{ fontSize:18 }}>{s.icon}</div>
                          <div style={{ fontWeight:800, fontSize:20, color:s.color }}>{s.val}</div>
                          <div style={{ fontSize:11, color:s.color, opacity:0.8 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Grace banner */}
                    {urgentCount > 0 && (
                      <div style={S.graceBanner}>
                        <span style={{ fontSize:16 }}>⚡</span>
                        <span style={{ fontSize:13, color:"#6d28d9", fontWeight:600 }}>
                          {urgentCount} patient{urgentCount !== 1 ? "s" : ""} confirmed late — placed at grace position (+5)
                        </span>
                      </div>
                    )}

                    {/* Currently consulting */}
                    {currentToken ? (
                      <div style={S.currentCard}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
                            <div style={S.tokenBig}>#{currentToken.token}</div>
                            <div>
                              <div style={{ fontSize:11, color:"rgba(255,255,255,0.7)", marginBottom:2 }}>NOW CONSULTING</div>
                              <div style={{ fontSize:20, fontWeight:700, color:"#fff" }}>{currentToken.patient_name}</div>
                              <div style={{ display:"flex", gap:8, marginTop:4 }}>
                                <span style={{
                                  fontSize:11, padding:"2px 10px", borderRadius:20, fontWeight:600,
                                  background: currentToken.patient_type === "walkin" ? "#dcfce7" : "#dbeafe",
                                  color:      currentToken.patient_type === "walkin" ? "#166534" : "#1d4ed8",
                                }}>
                                  {currentToken.patient_type === "walkin" ? "🚶 Walk-in" : "🌐 Online"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div style={{ display:"flex", gap:10 }}>
                            <button onClick={() => handleNextToken(sess)} disabled={!!acting} style={S.nextBtnWhite}>
                              {isNexting ? "Calling..." : "⏭ Next Patient"}
                            </button>
                            <button onClick={() => handleSkip(currentToken.id, currentToken.token)}
                              disabled={!!acting} style={S.skipBtnWhite}>
                              Skip
                            </button>
                          </div>
                        </div>
                        {nextUp && (
                          <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid rgba(255,255,255,0.2)" }}>
                            <span style={{ fontSize:12, color:"rgba(255,255,255,0.7)" }}>
                              Next up:{" "}
                              <b style={{ color:"#fff" }}>#{nextUp.token} — {nextUp.patient_name}</b>
                              {nextUp._queueGroup === "grace" && (
                                <span style={{ marginLeft:6, fontSize:11, background:"#faf5ff",
                                  color:"#6d28d9", padding:"1px 8px", borderRadius:10, fontWeight:600 }}>
                                  GRACE +5
                                </span>
                              )}
                              {" "}· {waitingCount} waiting · Est. ~{waitingCount * avgMin} min
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ ...S.currentCard, background:"linear-gradient(135deg,#475569,#334155)" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div>
                            <div style={{ fontSize:13, color:"rgba(255,255,255,0.6)", marginBottom:4 }}>
                              NO PATIENT CONSULTING
                            </div>
                            <div style={{ fontSize:16, color:"#fff" }}>
                              {waitingCount > 0
                                ? `${waitingCount} patient(s) waiting — press Next Token`
                                : "Queue is empty"}
                            </div>
                          </div>
                          {waitingCount > 0 && (
                            <button onClick={() => handleNextToken(sess)} disabled={!!acting} style={S.nextBtnWhite}>
                              {isNexting ? "Calling..." : "⏭ Call Next"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Queue Table */}
                    <div style={S.queueCard}>
                      <div style={S.queueHeader}>
                        <h4 style={{ margin:0, fontSize:14, color:"#0f4c75" }}>
                          📋 Queue — {sess} session
                        </h4>
                        <div style={{ display:"flex", gap:8 }}>
                          {urgentCount > 0 && (
                            <span style={{ ...S.countBadge, background:"#faf5ff", color:"#6d28d9" }}>
                              {urgentCount} grace
                            </span>
                          )}
                          <span style={{ ...S.countBadge, background:"#ede9fe", color:"#5b21b6" }}>
                            {waitingCount} waiting
                          </span>
                          {unconfirmedCount > 0 && (
                            <span style={{ ...S.countBadge, background:"#fef9c3", color:"#92400e" }}>
                              {unconfirmedCount} unconfirmed
                            </span>
                          )}
                        </div>
                      </div>

                      {queue.length === 0 && done.length === 0 && skipped.length === 0 ? (
                        <EmptyQueue text="No tokens booked for this session" />
                      ) : (
                        <div style={{ overflowX:"auto" }}>
                          <table style={S.table}>
                            <thead>
                              <tr style={{ background:"#f8fafc" }}>
                                {["#","Token","Patient","Type","Status","Confirmed","Queue Time","Actions"].map(h => (
                                  <th key={h} style={S.th}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {consulting.map(t => (
                                <QueueRow key={t.id} t={t} pos="🩺" acting={acting}
                                  rowBg="#ecfdf5"
                                  onSkip={handleSkip}
                                  onNext={() => handleNextToken(sess)}
                                  onConfirm={handleConfirm}
                                  onResend={handleResend}
                                  isNexting={isNexting} />
                              ))}

                              {queue.map((t, i) => (
                                <QueueRow key={t.id} t={t}
                                  pos={i + 1 + (consulting.length ? 1 : 0)}
                                  acting={acting}
                                  rowBg={
                                    t._queueGroup === "unconfirmed" ? "#fffbeb"
                                    : t._queueGroup === "grace"     ? "#faf5ff"
                                    : t._queueGroup === "late"      ? "#f0fdf4"
                                    : "#fff"
                                  }
                                  onSkip={handleSkip}
                                  onNext={() => handleNextToken(sess)}
                                  onConfirm={handleConfirm}
                                  onResend={handleResend}
                                  isNexting={isNexting} />
                              ))}

                              {(done.length > 0 || skipped.length > 0) && (
                                <tr>
                                  <td colSpan={8} style={{ padding:"6px 12px", background:"#f1f5f9",
                                    fontSize:11, color:"#94a3b8", fontWeight:600, letterSpacing:1 }}>
                                    COMPLETED
                                  </td>
                                </tr>
                              )}

                              {done.map(t => (
                                <QueueRow key={t.id} t={t} pos="✅" acting={acting}
                                  rowBg="#f8fafc"
                                  onSkip={handleSkip}
                                  onNext={() => handleNextToken(sess)}
                                  onConfirm={handleConfirm}
                                  onResend={handleResend}
                                  isNexting={isNexting} />
                              ))}
                              {skipped.map(t => (
                                <QueueRow key={t.id} t={t} pos="⏭" acting={acting}
                                  rowBg="#fff5f5"
                                  onSkip={handleSkip}
                                  onNext={() => handleNextToken(sess)}
                                  onConfirm={handleConfirm}
                                  onResend={handleResend}
                                  isNexting={isNexting} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            );
          })}

          {/* Doctor Info Footer */}
          {dashboard && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14 }}>
              <div style={S.infoCard}>
                <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>Doctor</div>
                <div style={{ fontWeight:700, color:"#0f4c75" }}>Dr. {dashboard.doctor}</div>
              </div>
              <div style={S.infoCard}>
                <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>Sessions</div>
                <div style={{ fontSize:13, color:"#0f4c75", fontWeight:600 }}>
                  🌅 {sessActive.morning ? "Morning Active" : "Morning Not Started"}
                  &nbsp;·&nbsp;
                  🌆 {sessActive.evening ? "Evening Active" : "Evening Not Started"}
                </div>
              </div>
              <div style={S.infoCard}>
                <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4 }}>Avg Consult Time</div>
                <div style={{ fontWeight:700, color:"#0f4c75" }}>{avgMin} minutes</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pause OPD Modal */}
      {pauseModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ fontSize:40, marginBottom:12, textAlign:"center" }}>⏸</div>
            <h3 style={{ textAlign:"center", color:"#0f4c75", margin:"0 0 8px" }}>
              Pause {pauseModal.session.charAt(0).toUpperCase() + pauseModal.session.slice(1)} OPD?
            </h3>
            <p style={{ textAlign:"center", color:"#64748b", fontSize:14, margin:"0 0 16px" }}>
              The queue will be paused. Patients will see the pause status.
            </p>
            <input
              type="text"
              placeholder="Reason for pause (optional)"
              style={{ width:"100%", padding:"10px", marginBottom:"16px", border:"1px solid #e2e8f0", borderRadius:"6px", fontSize:"14px" }}
              id="pauseReason"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const reason = document.getElementById("pauseReason").value;
                  handlePauseOPD(pauseModal.session, reason);
                }
              }}
            />
            <div style={{ display:"flex", gap:12 }}>
              <button
                onClick={() => {
                  const reason = document.getElementById("pauseReason").value;
                  handlePauseOPD(pauseModal.session, reason);
                }}
                style={{ ...S.endBtnRed, flex:1, padding:"12px", fontSize:15, background:"#fbbf24", color:"#92400e" }}>
                {isPausing ? "Pausing..." : "Pause OPD"}
              </button>
              <button
                onClick={() => setPauseModal(null)}
                style={{ flex:1, padding:"12px", border:"none", borderRadius:10,
                  background:"#f1f5f9", color:"#475569", fontWeight:600, fontSize:15, cursor:"pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End OPD Confirm Modal — shows which session is being ended */}
      {confirmEnd && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ fontSize:40, marginBottom:12, textAlign:"center" }}>⏹</div>
            <h3 style={{ textAlign:"center", color:"#0f4c75", margin:"0 0 8px" }}>
              End {confirmEnd.session.charAt(0).toUpperCase() + confirmEnd.session.slice(1)} OPD?
            </h3>
            <p style={{ textAlign:"center", color:"#64748b", fontSize:14, margin:"0 0 24px" }}>
              This will close the <b>{confirmEnd.session}</b> OPD for {date}.
              Remaining patients will not be called.
            </p>
            <div style={{ display:"flex", gap:12 }}>
              <button
                onClick={() => handleEndOPD(confirmEnd.session)}
                style={{ ...S.endBtnRed, flex:1, padding:"12px", fontSize:15 }}>
                Yes, End OPD
              </button>
              <button
                onClick={() => setConfirmEnd(null)}
                style={{ flex:1, padding:"12px", border:"none", borderRadius:10,
                  background:"#f1f5f9", color:"#475569", fontWeight:600, fontSize:15, cursor:"pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Queue Row ─────────────────────────────────────────────────────────────────
function QueueRow({ t, pos, rowBg, acting, onSkip, onNext, onConfirm, onResend, isNexting }) {
  const isActingSkip    = acting === "skip_"    + t.id;
  const isActingConfirm = acting === "confirm_" + t.id;
  const isActingResend  = acting === "resend_"  + t.id;

  return (
    <tr style={{ background: rowBg }}>
      <td style={{ ...S.td, width:36, textAlign:"center", color:"#94a3b8", fontSize:12, fontWeight:600 }}>
        {pos}
      </td>
      <td style={S.td}>
        <b style={{ color:"#0f4c75", fontSize:14 }}>#{t.token}</b>
        {t._queueGroup === "grace" && (
          <span style={{ marginLeft:4, fontSize:10, color:"#6d28d9", fontWeight:700 }}>GRACE</span>
        )}
        {t._queueGroup === "late" && (
          <span style={{ marginLeft:4, fontSize:10, color:"#059669", fontWeight:600 }}>LATE</span>
        )}
      </td>
      <td style={S.td}>{t.patient_name}</td>
      <td style={S.td}>
        <span style={{
          fontSize:11, padding:"2px 8px", borderRadius:10, fontWeight:600,
          background: t.patient_type === "walkin" ? "#dcfce7" : "#dbeafe",
          color:      t.patient_type === "walkin" ? "#166534" : "#1d4ed8",
        }}>
          {t.patient_type === "walkin" ? "🚶 Walk-in" : "🌐 Online"}
        </span>
      </td>
      <td style={S.td}>
        <span style={{
          fontSize:11, padding:"2px 8px", borderRadius:10, fontWeight:600,
          background: STATUS_BG[t.status] || "#f1f5f9",
          color:      STATUS_FG[t.status] || "#475569",
        }}>
          {t.status}
        </span>
      </td>
      <td style={{ ...S.td, textAlign:"center" }}>
        {t.is_confirmed
          ? <span style={{ color:"#10b981", fontWeight:700 }}>✅</span>
          : <span style={{ color:"#f59e0b", fontWeight:700 }}>⏳</span>}
      </td>
      <td style={{ ...S.td, fontSize:12, color:"#64748b" }}>
        {t.queue_insert_time
          ? new Date(t.queue_insert_time).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })
          : "—"}
      </td>
      <td style={{ ...S.td, whiteSpace:"nowrap" }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {t.status === "waiting" && t.is_confirmed && (
            <button onClick={() => onSkip(t.id, t.token)} disabled={!!acting} style={S.skipSmall}>
              {isActingSkip ? "..." : "Skip"}
            </button>
          )}
          {t.status === "waiting" && !t.is_confirmed && t.patient_type === "online" && (
            <>
              <button onClick={() => onConfirm(t.id, t.token)} disabled={!!acting} style={S.confirmSmall}>
                {isActingConfirm ? "..." : "✔ Confirm"}
              </button>
              <button onClick={() => onResend(t.id, t.token)} disabled={!!acting} style={S.resendSmall}>
                {isActingResend ? "..." : "📧 Resend"}
              </button>
              <button onClick={() => onSkip(t.id, t.token)} disabled={!!acting} style={S.skipSmall}>
                {isActingSkip ? "..." : "Skip"}
              </button>
            </>
          )}
          {t.status === "consulting" && (
            <button onClick={onNext} disabled={!!acting}
              style={{ ...S.skipSmall, background:"#d1fae5", color:"#065f46" }}>
              {isNexting ? "..." : "✓ Done"}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
const Spinner = () => (
  <div style={{ textAlign:"center", padding:80 }}>
    <div style={{ width:40, height:40, borderRadius:"50%", border:"3px solid #e2e8f0",
      borderTopColor:"#0f4c75", animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }} />
    <p style={{ color:"#94a3b8" }}>Loading dashboard...</p>
  </div>
);
const Empty = ({ text }) => (
  <div style={{ textAlign:"center", padding:"80px 40px" }}>
    <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
    <h4 style={{ color:"#1e293b", margin:0 }}>{text}</h4>
  </div>
);
const EmptyQueue = ({ text }) => (
  <div style={{ textAlign:"center", padding:"24px", color:"#94a3b8", fontSize:13,
    background:"#f8fafc", borderRadius:8, border:"1px dashed #e2e8f0" }}>
    {text}
  </div>
);

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page:            { minHeight:"100vh", background:"#f0f4f8", display:"flex", flexDirection:"column" },
  topBar:          { background:"linear-gradient(90deg,#0f4c75,#1b6ca8)", padding:"16px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 },
  logoCircle:      { width:40, height:40, borderRadius:"50%", background:"rgba(255,255,255,0.2)", display:"flex", alignItems:"center", justifyContent:"center" },
  topTitle:        { margin:0, fontSize:18, fontWeight:700, color:"#fff" },
  topSub:          { margin:0, fontSize:12, color:"rgba(255,255,255,0.65)" },
  filterBar:       { background:"#fff", padding:"14px 24px", display:"flex", alignItems:"center", flexWrap:"wrap", gap:14, borderBottom:"1px solid #e2e8f0", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" },
  filterLabel:     { display:"block", fontSize:11, fontWeight:600, color:"#64748b", marginBottom:4 },
  input:           { border:"1.5px solid #e2e8f0", borderRadius:8, padding:"8px 12px", fontSize:13, background:"#fff", outline:"none" },
  content:         { padding:"20px 24px", display:"flex", flexDirection:"column", gap:20, maxWidth:1200, width:"100%", margin:"0 auto", boxSizing:"border-box" },

  sessionCard:     { background:"#fff", borderRadius:16, boxShadow:"0 2px 16px rgba(0,0,0,0.07)", overflow:"hidden", border:"1px solid #e2e8f0" },
  sessionHeader:   { padding:"16px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 },
  sessionContent:  { padding:"20px 24px", display:"flex", flexDirection:"column", gap:14 },
  notStartedBox:   { textAlign:"center", padding:"44px 24px", background:"#f8fafc", borderTop:"1px solid #e2e8f0" },

  pillActive:      { padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600, background:"#d1fae5", color:"#065f46" },
  pillInactive:    { padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600, background:"rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.75)" },

  statsRow:        { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))", gap:12 },
  statCard:        { borderRadius:12, padding:"12px", textAlign:"center", display:"flex", flexDirection:"column", gap:4, alignItems:"center" },
  graceBanner:     { background:"#faf5ff", border:"1.5px solid #c4b5fd", borderRadius:10, padding:"10px 16px", display:"flex", alignItems:"center", gap:10 },
  currentCard:     { background:"linear-gradient(135deg,#0f4c75,#1b6ca8)", borderRadius:14, padding:"20px 24px", boxShadow:"0 4px 20px rgba(15,76,117,0.3)" },
  tokenBig:        { fontSize:36, fontWeight:800, color:"#fff", background:"rgba(255,255,255,0.2)", borderRadius:12, padding:"8px 16px", minWidth:80, textAlign:"center" },
  queueCard:       { background:"#fff", borderRadius:14, boxShadow:"0 1px 8px rgba(0,0,0,0.05)", overflow:"hidden", border:"1px solid #e2e8f0" },
  queueHeader:     { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 16px", borderBottom:"1px solid #e2e8f0" },
  countBadge:      { fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:600 },
  infoCard:        { background:"#fff", borderRadius:12, padding:"14px 18px", border:"1px solid #e2e8f0" },
  table:           { width:"100%", borderCollapse:"collapse", fontSize:13 },
  th:              { padding:"10px 12px", textAlign:"left", fontSize:11, color:"#94a3b8", fontWeight:600, borderBottom:"1px solid #e2e8f0", whiteSpace:"nowrap" },
  td:              { padding:"10px 12px", borderBottom:"1px solid #f1f5f9", verticalAlign:"middle" },

  startBtn:        { background:"#059669", color:"#fff", border:"none", borderRadius:10, padding:"10px 20px", fontWeight:700, fontSize:14, cursor:"pointer" },
  nextBtnWhite:    { background:"#fff", color:"#0f4c75", border:"none", borderRadius:10, padding:"10px 20px", fontWeight:700, fontSize:14, cursor:"pointer" },
  endBtnWhite:     { background:"rgba(255,255,255,0.12)", color:"#fff", border:"1.5px solid rgba(255,255,255,0.35)", borderRadius:10, padding:"10px 16px", fontWeight:600, fontSize:13, cursor:"pointer" },
  endBtnRed:       { background:"#fef2f2", color:"#dc2626", border:"1.5px solid #fca5a5", borderRadius:10, fontWeight:700, cursor:"pointer" },
  skipBtnWhite:    { background:"rgba(255,255,255,0.2)", color:"#fff", border:"1px solid rgba(255,255,255,0.4)", borderRadius:10, padding:"10px 16px", fontWeight:600, fontSize:13, cursor:"pointer" },
  skipSmall:       { background:"#fee2e2", color:"#991b1b", border:"none", borderRadius:6, padding:"4px 10px", fontSize:12, fontWeight:600, cursor:"pointer" },
  confirmSmall:    { background:"#d1fae5", color:"#065f46", border:"none", borderRadius:6, padding:"4px 10px", fontSize:12, fontWeight:600, cursor:"pointer" },
  resendSmall:     { background:"#dbeafe", color:"#1d4ed8", border:"none", borderRadius:6, padding:"4px 10px", fontSize:12, fontWeight:600, cursor:"pointer" },
  iconBtn:         { border:"none", borderRadius:8, padding:"7px 14px", fontSize:13, fontWeight:600, cursor:"pointer" },
  overlay:         { position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 },
  modal:           { background:"#fff", borderRadius:16, padding:"32px", width:"100%", maxWidth:400, boxShadow:"0 20px 60px rgba(0,0,0,0.2)" },
};

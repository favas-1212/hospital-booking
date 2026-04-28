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
  getPrescription,
  savePrescription,
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
  const lateCutoff = startTime ? new Date(startTime.getTime() + 10 * 60 * 1000) : null;

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
    consulting, queue,
    done:    done.sort((a, b)    => a.token - b.token),
    skipped: skipped.sort((a, b) => a.token - b.token),
  };
}

function extractSessionState(data) {
  const active      = { morning: false, evening: false };
  const startedAt   = { morning: null,  evening: null  };
  const paused      = { morning: false, evening: false };
  const pauseReason = { morning: null,  evening: null  };

  if (!data) return { active, startedAt, paused, pauseReason };

  if (data.opd_sessions) {
    SESSIONS.forEach(sess => {
      active[sess]      = data.opd_sessions[sess]?.is_active   ?? false;
      startedAt[sess]   = data.opd_sessions[sess]?.started_at  ?? null;
      paused[sess]      = data.opd_sessions[sess]?.is_paused   ?? false;
      pauseReason[sess] = data.opd_sessions[sess]?.pause_reason ?? null;
    });
  } else if (data.opd_started) {
    active.morning      = true;
    startedAt.morning   = data.started_at ?? null;
    paused.morning      = data.is_paused ?? false;
    pauseReason.morning = data.pause_reason ?? null;
  }

  return { active, startedAt, paused, pauseReason };
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DoctorDashboard() {
  const navigate = useNavigate();
  const today    = new Date().toISOString().split("T")[0];
  const pollRef  = useRef(null);

  const [date,            setDate]            = useState(today);
  const [dashboard,       setDashboard]       = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [acting,          setActing]          = useState(null);
  const [autoRefresh,     setAutoRefresh]     = useState(true);
  const [lastRefreshed,   setLastRefreshed]   = useState(null);
  const [confirmEnd,      setConfirmEnd]      = useState(null);

  const [sessActive,      setSessActive]      = useState({ morning: false, evening: false });
  const [sessStartedAt,   setSessStartedAt]   = useState({ morning: null,  evening: null  });
  const [sessPaused,      setSessPaused]      = useState({ morning: false, evening: false });
  const [sessPauseReason, setSessPauseReason] = useState({ morning: null,  evening: null  });
  const [pauseModal,      setPauseModal]      = useState(null);

  const [rxModal,      setRxModal]      = useState(null);
  const [rxData,       setRxData]       = useState({ diagnosis: "", medicines: "" });
  const [rxLoadingFor, setRxLoadingFor] = useState(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
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

  // ── Rx Modal ─────────────────────────────────────────────────────────────
  const openRxModal = async (currentToken, session, mode = "finish") => {
    if (!currentToken) return;
    setRxLoadingFor(currentToken.id);
    setRxData({ diagnosis: "", medicines: "" });
    setRxModal({ booking: currentToken, session, mode });
    try {
      const res = await getPrescription(currentToken.id);
      setRxData({ diagnosis: res.data?.diagnosis || "", medicines: res.data?.medicines || "" });
    } catch {}
    finally { setRxLoadingFor(null); }
  };

  const closeRxModal = () => { setRxModal(null); setRxData({ diagnosis: "", medicines: "" }); };

  const handleSaveRx = async ({ andCallNext }) => {
    if (!rxModal?.booking) return;
    const { diagnosis, medicines } = rxData;
    if (!diagnosis.trim() && !medicines.trim()) return toast.warning("Please enter a diagnosis or prescription.");
    setActing(`save_rx_${rxModal.booking.id}`);
    try {
      await savePrescription(rxModal.booking.id, { diagnosis, medicines });
      toast.success(`Prescription saved for #${rxModal.booking.token}`);
      if (andCallNext) {
        await nextToken(date, rxModal.session);
        toast.success("Patient marked done. Next patient called.");
      }
      closeRxModal();
      fetchDashboard(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save prescription");
    } finally { setActing(null); }
  };

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleStartOPD = async (session) => {
    setActing(`start_${session}`);
    try {
      const res = await startOPD({ date, session });
      toast.success(res.data.message || `${session} OPD started!`);
      setSessActive(prev => ({ ...prev, [session]: true }));
      setSessStartedAt(prev => ({ ...prev, [session]: new Date().toISOString() }));
      fetchDashboard(true);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to start OPD");
    } finally { setActing(null); }
  };

  const handleNextToken = async (session) => {
    const currentForSession = (dashboard?.tokens || []).find(t => t.session === session && t.status === "consulting");
    if (currentForSession) { openRxModal(currentForSession, session, "finish"); return; }
    setActing(`next_${session}`);
    try {
      const res = await nextToken(date, session);
      toast.success(res.data.message || "Next token called!");
      fetchDashboard(true);
    } catch (err) {
      const errData = err.response?.data;
      if (errData?.needs_prescription && errData.current_booking_id) {
        const cur = (dashboard?.tokens || []).find(t => t.id === errData.current_booking_id);
        if (cur) openRxModal(cur, session, "finish");
        else toast.error(errData.error);
      } else { toast.error(errData?.error || "No patients in queue"); }
    } finally { setActing(null); }
  };

  const handleSkip = async (id, tokenNum) => {
    if (!window.confirm(`Skip Token #${tokenNum}?`)) return;
    setActing("skip_" + id);
    try { await skipToken(id); toast.warning(`Token #${tokenNum} skipped`); fetchDashboard(true); }
    catch (err) { toast.error(err.response?.data?.error || "Skip failed"); }
    finally { setActing(null); }
  };

  const handleConfirm = async (id, tokenNum) => {
    setActing("confirm_" + id);
    try { const res = await staffConfirmAttendance(id); toast.success(res.data.message || `Token #${tokenNum} confirmed`); fetchDashboard(true); }
    catch (err) { toast.error(err.response?.data?.error || "Confirm failed"); }
    finally { setActing(null); }
  };

  const handleResend = async (id, tokenNum) => {
    setActing("resend_" + id);
    try { const res = await resendOPDNotification(id); toast.success(res.data.message || `Notification resent for #${tokenNum}`); }
    catch (err) { toast.error(err.response?.data?.error || "Resend failed"); }
    finally { setActing(null); }
  };

  const handleEndOPD = async (session) => {
    setConfirmEnd(null);
    setActing(`end_${session}`);
    try { const res = await endOPD({ date, session }); toast.success(res.data.message || `${session} OPD ended`); setSessActive(prev => ({ ...prev, [session]: false })); fetchDashboard(true); }
    catch (err) { toast.error(err.response?.data?.error || "Failed to end OPD"); }
    finally { setActing(null); }
  };

  const handlePauseOPD = async (session, reason) => {
    setActing(`pause_${session}`);
    try {
      const res = await pauseOPD({ date, session, reason: reason || null });
      toast.info(res.data.message || "OPD paused");
      setSessPaused(prev => ({ ...prev, [session]: true }));
      setSessPauseReason(prev => ({ ...prev, [session]: reason || null }));
      fetchDashboard(true);
    } catch (err) { toast.error(err.response?.data?.error || "Failed to pause OPD"); }
    finally { setActing(null); setPauseModal(null); }
  };

  const handleResumeOPD = async (session) => {
    setActing(`resume_${session}`);
    try {
      const res = await resumeOPD({ date, session });
      toast.success(res.data.message || "OPD resumed");
      setSessPaused(prev => ({ ...prev, [session]: false }));
      setSessPauseReason(prev => ({ ...prev, [session]: null }));
      fetchDashboard(true);
    } catch (err) { toast.error(err.response?.data?.error || "Failed to resume OPD"); }
    finally { setActing(null); }
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const avgMin = dashboard?.avg_consult_minutes || 7;

  const sessionData = SESSIONS.map(sess => {
    const tokens       = (dashboard?.tokens || []).filter(t => t.session === sess);
    const opdActive    = sessActive[sess];
    const startedAt    = sessStartedAt[sess];
    const isSessPaused = sessPaused[sess];
    const pauseReason  = sessPauseReason[sess];
    const { consulting, queue, done, skipped } = buildCallingOrder(tokens, startedAt);
    const currentToken     = consulting[0] || null;
    const waitingCount     = queue.filter(t => t._queueGroup !== "unconfirmed").length;
    const unconfirmedCount = queue.filter(t => t._queueGroup === "unconfirmed").length;
    const urgentCount      = queue.filter(t => t._queueGroup === "grace").length;
    const nextUp           = queue.find(t => t._queueGroup !== "unconfirmed") || null;
    return { sess, tokens, opdActive, startedAt, consulting, queue, done, skipped, currentToken, waitingCount, unconfirmedCount, urgentCount, nextUp, isSessPaused, pauseReason };
  });

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>

      {/* Decorative bg circles — matches Login */}
      <div style={S.bgCircle1} />
      <div style={S.bgCircle2} />

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div style={S.topBar}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          {/* Portal badge — matches Login header badge */}
          <div style={S.portalBadge}>
            <span style={S.greenDot} />
            <span style={{ color:"#e0f2fe", fontSize:13, fontWeight:500, fontFamily:"'DM Sans',sans-serif" }}>
              MedQueue Portal
            </span>
          </div>
          <div>
            <h1 style={S.topTitle}>Doctor Dashboard</h1>
            <p style={S.topSub}>OPD Management System</p>
          </div>
        </div>

        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <button
            onClick={() => setAutoRefresh(r => !r)}
            style={{
              ...S.topBtn,
              background: autoRefresh ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)",
              color: autoRefresh ? "#d1fae5" : "rgba(255,255,255,0.6)",
              border: autoRefresh ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.15)",
            }}>
            {autoRefresh ? "🔄 Live" : "⏸ Paused"}
          </button>
          {lastRefreshed && (
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.5)", fontFamily:"'DM Sans',sans-serif" }}>
              Updated {lastRefreshed.toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
            </span>
          )}
          <button onClick={() => fetchDashboard()} style={S.topBtn}>↻ Refresh</button>
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div style={S.filterBar}>
        <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap" }}>
          <div>
            <label style={S.filterLabel}>Date</label>
            <input type="date" value={date}
              onChange={e => setDate(e.target.value)} style={S.dateInput} />
          </div>
          {dashboard && (
            <>
              <div style={S.doctorChip}>
                <span style={{ fontSize:13 }}>🩺</span>
                <span style={{ fontSize:13, color:"#0f4c75", fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>
                  Dr. {dashboard.doctor}
                </span>
              </div>
              <div style={{ ...S.doctorChip, background:"#e0f2fe" }}>
                <span style={{ fontSize:12, color:"#0369a1", fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}>
                  ⏱ Avg {avgMin} min / patient
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      {loading ? <Spinner /> : !dashboard ? <Empty text="No data found" /> : (
        <div style={S.content}>

          {sessionData.map(({
            sess, opdActive, startedAt,
            consulting, queue, done, skipped,
            currentToken, waitingCount, unconfirmedCount, urgentCount, nextUp,
            isSessPaused, pauseReason,
          }) => {
            const isStarting = acting === `start_${sess}`;
            const isNexting  = acting === `next_${sess}`;
            const isEnding   = acting === `end_${sess}`;
            const isResuming = acting === `resume_${sess}`;

            return (
              <div key={sess} style={S.card}>

                {/* Session header — gradient same as Login header */}
                <div style={{
                  ...S.cardHeader,
                  background: sess === "morning"
                    ? "linear-gradient(135deg, #0f4c75 0%, #1b6ca8 60%, #118a7e 100%)"
                    : "linear-gradient(135deg, #1a3a5c 0%, #0f4c75 60%, #118a7e 100%)",
                }}>
                  <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
                    <div style={S.sessionIcon}>{sess === "morning" ? "🌅" : "🌆"}</div>
                    <div>
                      <div style={{ fontSize:17, fontWeight:800, color:"#fff", fontFamily:"'DM Sans',sans-serif" }}>
                        {sess === "morning" ? "Morning" : "Evening"} Session OPD
                      </div>
                      {opdActive && startedAt && (
                        <div style={{ fontSize:12, color:"#bae6fd", marginTop:2, fontFamily:"'DM Sans',sans-serif" }}>
                          Started at {new Date(startedAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
                        </div>
                      )}
                    </div>
                    {!opdActive
                      ? <span style={S.pillOff}>⚪ Not Started</span>
                      : isSessPaused
                      ? <span style={{ ...S.pillOn, background:"#fef3c7", color:"#92400e" }}>⏸ Paused</span>
                      : <span style={S.pillOn}>🟢 Active</span>
                    }
                  </div>

                  <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
                    {!opdActive ? (
                      <button onClick={() => handleStartOPD(sess)} disabled={!!acting} style={S.btnPrimary}>
                        {isStarting ? "Starting..." : "▶ Start OPD"}
                      </button>
                    ) : (
                      <>
                        <button onClick={() => handleNextToken(sess)} disabled={!!acting} style={S.btnGlass}>
                          {isNexting ? "Calling..." : "⏭ Next Token"}
                        </button>
                        {!isSessPaused ? (
                          <button onClick={() => setPauseModal({ session: sess, action:"pause" })}
                            disabled={!!acting}
                            style={{ ...S.btnGlass, background:"rgba(251,191,36,0.2)", color:"#fef3c7", borderColor:"rgba(251,191,36,0.5)" }}>
                            ⏸ Pause
                          </button>
                        ) : (
                          <button onClick={() => handleResumeOPD(sess)} disabled={!!acting}
                            style={{ ...S.btnGlass, background:"rgba(134,239,172,0.2)", color:"#d1fae5", borderColor:"rgba(134,239,172,0.5)" }}>
                            {isResuming ? "Resuming..." : "▶ Resume"}
                          </button>
                        )}
                        <button onClick={() => setConfirmEnd({ session: sess })}
                          disabled={!!acting} style={S.btnDanger}>
                          {isEnding ? "Ending..." : "⏹ End OPD"}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Not started state */}
                {!opdActive && (
                  <div style={S.notStartedBox}>
                    <div style={{ fontSize:52, marginBottom:12 }}>{sess === "morning" ? "🌅" : "🌆"}</div>
                    <h4 style={S.notStartedTitle}>
                      {sess === "morning" ? "Morning" : "Evening"} OPD Not Started
                    </h4>
                    <p style={S.notStartedSub}>
                      Click below to begin the {sess} session for {date}
                    </p>
                    <button onClick={() => handleStartOPD(sess)} disabled={!!acting} style={{ ...S.btnPrimary, padding:"12px 32px", fontSize:15 }}>
                      {isStarting ? "Starting..." : `▶ Start ${sess === "morning" ? "Morning" : "Evening"} OPD`}
                    </button>
                  </div>
                )}

                {opdActive && (
                  <div style={S.cardBody}>

                    {/* Stats row */}
                    <div style={S.statsGrid}>
                      {[
                        { label:"Waiting",     val: waitingCount,        color:"#5b21b6", bg:"#f5f3ff", icon:"⏳" },
                        { label:"Consulting",  val: currentToken ? 1 : 0,color:"#065f46", bg:"#ecfdf5", icon:"🩺" },
                        { label:"Done",        val: done.length,         color:"#1d4ed8", bg:"#eff6ff", icon:"✅" },
                        { label:"Skipped",     val: skipped.length,      color:"#dc2626", bg:"#fff5f5", icon:"⏭" },
                        { label:"Unconfirmed", val: unconfirmedCount,    color:"#92400e", bg:"#fffbeb", icon:"⚠️" },
                        { label:"Avg Time",    val: `${avgMin}m`,        color:"#0369a1", bg:"#f0f9ff", icon:"⏱" },
                      ].map(s => (
                        <div key={s.label} style={{ ...S.statCard, background:s.bg }}>
                          <div style={{ fontSize:20 }}>{s.icon}</div>
                          <div style={{ fontWeight:800, fontSize:22, color:s.color, fontFamily:"'DM Sans',sans-serif" }}>{s.val}</div>
                          <div style={{ fontSize:11, color:s.color, opacity:0.75, fontWeight:600, letterSpacing:0.3 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {urgentCount > 0 && (
                      <div style={S.graceBanner}>
                        <span style={{ fontSize:16 }}>⚡</span>
                        <span style={{ fontSize:13, color:"#6d28d9", fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}>
                          {urgentCount} patient{urgentCount !== 1 ? "s" : ""} confirmed late — placed at grace position (+5)
                        </span>
                      </div>
                    )}

                    {/* Currently consulting card */}
                    {currentToken ? (
                      <div style={S.consultingCard}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:14 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:18 }}>
                            <div style={S.tokenBig}>#{currentToken.token}</div>
                            <div>
                              <div style={{ fontSize:11, color:"rgba(255,255,255,0.6)", marginBottom:3, letterSpacing:1, fontFamily:"'DM Sans',sans-serif" }}>
                                NOW CONSULTING
                              </div>
                              <div style={{ fontSize:22, fontWeight:800, color:"#fff", fontFamily:"'DM Sans',sans-serif" }}>
                                {currentToken.patient_name}
                              </div>
                              <div style={{ display:"flex", gap:8, marginTop:6 }}>
                                <span style={{
                                  fontSize:11, padding:"3px 12px", borderRadius:20, fontWeight:700,
                                  background: currentToken.patient_type === "walkin" ? "rgba(209,250,229,0.9)" : "rgba(219,234,254,0.9)",
                                  color:      currentToken.patient_type === "walkin" ? "#065f46" : "#1d4ed8",
                                  fontFamily:"'DM Sans',sans-serif",
                                }}>
                                  {currentToken.patient_type === "walkin" ? "🚶 Walk-in" : "🌐 Online"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                            <button onClick={() => openRxModal(currentToken, sess, "edit")} disabled={!!acting}
                              style={{ ...S.btnGlass, background:"rgba(254,243,199,0.25)", color:"#fef3c7", borderColor:"rgba(254,243,199,0.4)" }}>
                              📝 Add Diagnosis
                            </button>
                            <button onClick={() => handleNextToken(sess)} disabled={!!acting} style={S.btnGlass}>
                              {isNexting ? "Calling..." : "✓ Done & Next"}
                            </button>
                            <button onClick={() => handleSkip(currentToken.id, currentToken.token)}
                              disabled={!!acting} style={S.btnDanger}>
                              Skip
                            </button>
                          </div>
                        </div>
                        {nextUp && (
                          <div style={{ marginTop:14, paddingTop:14, borderTop:"1px solid rgba(255,255,255,0.18)" }}>
                            <span style={{ fontSize:12, color:"rgba(255,255,255,0.65)", fontFamily:"'DM Sans',sans-serif" }}>
                              Next up:{" "}
                              <b style={{ color:"#fff" }}>#{nextUp.token} — {nextUp.patient_name}</b>
                              {nextUp._queueGroup === "grace" && (
                                <span style={{ marginLeft:8, fontSize:11, background:"rgba(250,245,255,0.25)",
                                  color:"#e9d5ff", padding:"2px 10px", borderRadius:10, fontWeight:700 }}>
                                  GRACE +5
                                </span>
                              )}
                              {" "}· {waitingCount} waiting · Est. ~{waitingCount * avgMin} min
                            </span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ ...S.consultingCard, background:"linear-gradient(135deg,#334155,#475569)" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                          <div>
                            <div style={{ fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:6, letterSpacing:1, fontFamily:"'DM Sans',sans-serif" }}>
                              NO PATIENT CONSULTING
                            </div>
                            <div style={{ fontSize:16, color:"#fff", fontWeight:600, fontFamily:"'DM Sans',sans-serif" }}>
                              {waitingCount > 0 ? `${waitingCount} patient(s) waiting — press Next Token` : "Queue is empty"}
                            </div>
                          </div>
                          {waitingCount > 0 && (
                            <button onClick={() => handleNextToken(sess)} disabled={!!acting} style={S.btnGlass}>
                              {isNexting ? "Calling..." : "⏭ Call Next"}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Queue Table */}
                    <div style={S.tableCard}>
                      <div style={S.tableHeader}>
                        <h4 style={{ margin:0, fontSize:14, color:"#0f4c75", fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>
                          📋 Queue — {sess} session
                        </h4>
                        <div style={{ display:"flex", gap:8 }}>
                          {urgentCount > 0 && <span style={{ ...S.badge, background:"#f5f3ff", color:"#6d28d9" }}>{urgentCount} grace</span>}
                          <span style={{ ...S.badge, background:"#f5f3ff", color:"#5b21b6" }}>{waitingCount} waiting</span>
                          {unconfirmedCount > 0 && <span style={{ ...S.badge, background:"#fffbeb", color:"#92400e" }}>{unconfirmedCount} unconfirmed</span>}
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
                                  onSkip={handleSkip} onNext={() => handleNextToken(sess)}
                                  onConfirm={handleConfirm} onResend={handleResend}
                                  onAddRx={() => openRxModal(t, sess, "edit")}
                                  isNexting={isNexting} />
                              ))}
                              {queue.map((t, i) => (
                                <QueueRow key={t.id} t={t}
                                  pos={i + 1 + (consulting.length ? 1 : 0)}
                                  acting={acting}
                                  rowBg={t._queueGroup === "unconfirmed" ? "#fffbeb" : t._queueGroup === "grace" ? "#f5f3ff" : t._queueGroup === "late" ? "#f0fdf4" : "#fff"}
                                  onSkip={handleSkip} onNext={() => handleNextToken(sess)}
                                  onConfirm={handleConfirm} onResend={handleResend}
                                  onAddRx={() => openRxModal(t, sess, "edit")}
                                  isNexting={isNexting} />
                              ))}
                              {(done.length > 0 || skipped.length > 0) && (
                                <tr>
                                  <td colSpan={8} style={{ padding:"7px 16px", background:"#f1f5f9", fontSize:11, color:"#94a3b8", fontWeight:700, letterSpacing:1.5, fontFamily:"'DM Sans',sans-serif" }}>
                                    COMPLETED
                                  </td>
                                </tr>
                              )}
                              {done.map(t => (
                                <QueueRow key={t.id} t={t} pos="✅" acting={acting} rowBg="#f8fafc"
                                  onSkip={handleSkip} onNext={() => handleNextToken(sess)}
                                  onConfirm={handleConfirm} onResend={handleResend}
                                  onAddRx={() => openRxModal(t, sess, "edit")} isNexting={isNexting} />
                              ))}
                              {skipped.map(t => (
                                <QueueRow key={t.id} t={t} pos="⏭" acting={acting} rowBg="#fff5f5"
                                  onSkip={handleSkip} onNext={() => handleNextToken(sess)}
                                  onConfirm={handleConfirm} onResend={handleResend}
                                  onAddRx={() => openRxModal(t, sess, "edit")} isNexting={isNexting} />
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

          {/* Footer info cards */}
          {dashboard && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:14 }}>
              {[
                { label:"Doctor", val:`Dr. ${dashboard.doctor}` },
                {
                  label:"Sessions",
                  val:`🌅 ${sessActive.morning ? "Morning Active" : "Morning Not Started"}  ·  🌆 ${sessActive.evening ? "Evening Active" : "Evening Not Started"}`,
                },
                { label:"Avg Consult Time", val:`${avgMin} minutes` },
              ].map(item => (
                <div key={item.label} style={S.infoCard}>
                  <div style={{ fontSize:11, color:"#94a3b8", marginBottom:4, fontWeight:600, letterSpacing:0.5, fontFamily:"'DM Sans',sans-serif" }}>
                    {item.label.toUpperCase()}
                  </div>
                  <div style={{ fontWeight:700, color:"#0f4c75", fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>
                    {item.val}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Rx / Prescription Modal ──────────────────────────────────────── */}
      {rxModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            {/* Modal header — gradient matches Login */}
            <div style={S.modalHeader}>
              <div style={{ display:"flex", justifyContent:"center", marginBottom:12 }}>
                <div style={S.portalBadge}>
                  <span style={S.greenDot} />
                  <span style={{ color:"#e0f2fe", fontSize:12, fontWeight:500, fontFamily:"'DM Sans',sans-serif" }}>
                    MedQueue Portal
                  </span>
                </div>
              </div>
              <div style={{ textAlign:"center" }}>
                <h3 style={{ margin:0, color:"#fff", fontSize:20, fontWeight:800, fontFamily:"'DM Sans',sans-serif" }}>
                  💊 Diagnosis & Prescription
                </h3>
                <p style={{ color:"#bae6fd", fontSize:13, margin:"6px 0 0", fontFamily:"'DM Sans',sans-serif" }}>
                  Token #{rxModal.booking.token} · {rxModal.booking.patient_name}
                </p>
              </div>
            </div>

            <div style={{ padding:"24px 28px 28px" }}>
              {rxLoadingFor === rxModal.booking.id ? (
                <div style={{ textAlign:"center", padding:"40px 0", color:"#94a3b8" }}>
                  <Spinner />
                </div>
              ) : (
                <>
                  <div style={{ marginBottom:14 }}>
                    <label style={S.modalLabel}>DIAGNOSIS</label>
                    <textarea
                      value={rxData.diagnosis}
                      onChange={e => setRxData(prev => ({ ...prev, diagnosis: e.target.value }))}
                      placeholder="e.g. Acute viral fever with mild dehydration"
                      rows={3} style={S.textarea} />
                  </div>
                  <div style={{ marginBottom:20 }}>
                    <label style={S.modalLabel}>PRESCRIPTION (MEDICINES & DOSAGE)</label>
                    <textarea
                      value={rxData.medicines}
                      onChange={e => setRxData(prev => ({ ...prev, medicines: e.target.value }))}
                      placeholder={"1. Paracetamol 500mg — 1-1-1 × 5 days\n2. ORS sachets — prn\n3. Plenty of fluids and rest"}
                      rows={6} style={{ ...S.textarea, fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace" }} />
                  </div>

                  <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                    {rxModal.mode === "finish" ? (
                      <>
                        <button onClick={() => handleSaveRx({ andCallNext: true })} disabled={!!acting}
                          style={{ ...S.modalBtnPrimary, flex:2 }}>
                          {acting?.startsWith("save_rx_") ? "Saving..." : "💾 Save & Call Next"}
                        </button>
                        <button onClick={() => handleSaveRx({ andCallNext: false })} disabled={!!acting}
                          style={{ ...S.modalBtnSecondary, flex:1 }}>
                          Save Only
                        </button>
                        <button onClick={closeRxModal} disabled={!!acting}
                          style={{ ...S.modalBtnCancel, flex:1 }}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => handleSaveRx({ andCallNext: false })} disabled={!!acting}
                          style={{ ...S.modalBtnPrimary, flex:2 }}>
                          {acting?.startsWith("save_rx_") ? "Saving..." : "💾 Save Prescription"}
                        </button>
                        <button onClick={closeRxModal} disabled={!!acting}
                          style={{ ...S.modalBtnCancel, flex:1 }}>
                          Close
                        </button>
                      </>
                    )}
                  </div>

                  <p style={{ fontSize:11, color:"#94a3b8", marginTop:14, lineHeight:1.5, fontFamily:"'DM Sans',sans-serif" }}>
                    💡 The patient will see this diagnosis and prescription on their dashboard once you mark the consultation as done.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Pause Modal ──────────────────────────────────────────────────── */}
      {pauseModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={S.modalHeader}>
              <h3 style={{ textAlign:"center", color:"#fff", margin:0, fontSize:20, fontWeight:800, fontFamily:"'DM Sans',sans-serif" }}>
                ⏸ Pause {pauseModal.session === "morning" ? "Morning" : "Evening"} OPD?
              </h3>
              <p style={{ textAlign:"center", color:"#bae6fd", fontSize:13, margin:"8px 0 0", fontFamily:"'DM Sans',sans-serif" }}>
                The queue will be paused. Patients will see the pause status.
              </p>
            </div>
            <div style={{ padding:"24px 28px 28px" }}>
              <input type="text" placeholder="Reason for pause (optional)"
                style={{ ...S.textarea, resize:"none", rows:1, height:46, marginBottom:18 }}
                id="pauseReason"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const reason = document.getElementById("pauseReason").value;
                    handlePauseOPD(pauseModal.session, reason);
                  }
                }}
              />
              <div style={{ display:"flex", gap:12 }}>
                <button onClick={() => {
                  const reason = document.getElementById("pauseReason").value;
                  handlePauseOPD(pauseModal.session, reason);
                }} style={{ ...S.modalBtnPrimary, flex:1, background:"linear-gradient(90deg,#f59e0b,#d97706)" }}>
                  ⏸ Pause OPD
                </button>
                <button onClick={() => setPauseModal(null)}
                  style={{ ...S.modalBtnCancel, flex:1 }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── End OPD Modal ────────────────────────────────────────────────── */}
      {confirmEnd && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={S.modalHeader}>
              <h3 style={{ textAlign:"center", color:"#fff", margin:0, fontSize:20, fontWeight:800, fontFamily:"'DM Sans',sans-serif" }}>
                ⏹ End {confirmEnd.session === "morning" ? "Morning" : "Evening"} OPD?
              </h3>
              <p style={{ textAlign:"center", color:"#bae6fd", fontSize:13, margin:"8px 0 0", fontFamily:"'DM Sans',sans-serif" }}>
                This will close the <b>{confirmEnd.session}</b> OPD for {date}.<br />
                Remaining patients will not be called.
              </p>
            </div>
            <div style={{ padding:"24px 28px 28px" }}>
              <div style={{ display:"flex", gap:12 }}>
                <button onClick={() => handleEndOPD(confirmEnd.session)}
                  style={{ ...S.modalBtnPrimary, flex:1, background:"linear-gradient(90deg,#dc2626,#b91c1c)" }}>
                  Yes, End OPD
                </button>
                <button onClick={() => setConfirmEnd(null)}
                  style={{ ...S.modalBtnCancel, flex:1 }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        input[type="date"]:focus, textarea:focus {
          border-color: #1b6ca8 !important;
          box-shadow: 0 0 0 3px rgba(27,108,168,0.15) !important;
          outline: none;
          background: #fff !important;
        }
      `}</style>
    </div>
  );
}

// ── Queue Row ─────────────────────────────────────────────────────────────────
function QueueRow({ t, pos, rowBg, acting, onSkip, onNext, onConfirm, onResend, onAddRx, isNexting }) {
  const isActingSkip    = acting === "skip_"    + t.id;
  const isActingConfirm = acting === "confirm_" + t.id;
  const isActingResend  = acting === "resend_"  + t.id;

  return (
    <tr style={{ background: rowBg }}>
      <td style={{ ...S.td, width:36, textAlign:"center", color:"#94a3b8", fontSize:12, fontWeight:700 }}>
        {pos}
      </td>
      <td style={S.td}>
        <b style={{ color:"#0f4c75", fontSize:14, fontFamily:"'DM Sans',sans-serif" }}>#{t.token}</b>
        {t._queueGroup === "grace" && <span style={{ marginLeft:4, fontSize:10, color:"#6d28d9", fontWeight:800 }}>GRACE</span>}
        {t._queueGroup === "late"  && <span style={{ marginLeft:4, fontSize:10, color:"#059669", fontWeight:700 }}>LATE</span>}
      </td>
      <td style={{ ...S.td, fontFamily:"'DM Sans',sans-serif" }}>{t.patient_name}</td>
      <td style={S.td}>
        <span style={{
          fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:700,
          background: t.patient_type === "walkin" ? "#dcfce7" : "#dbeafe",
          color:      t.patient_type === "walkin" ? "#166534" : "#1d4ed8",
          fontFamily:"'DM Sans',sans-serif",
        }}>
          {t.patient_type === "walkin" ? "🚶 Walk-in" : "🌐 Online"}
        </span>
      </td>
      <td style={S.td}>
        <span style={{
          fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:700,
          background: STATUS_BG[t.status] || "#f1f5f9",
          color:      STATUS_FG[t.status] || "#475569",
          fontFamily:"'DM Sans',sans-serif",
        }}>
          {t.status}
        </span>
      </td>
      <td style={{ ...S.td, textAlign:"center" }}>
        {t.is_confirmed
          ? <span style={{ color:"#10b981", fontWeight:700 }}>✅</span>
          : <span style={{ color:"#f59e0b", fontWeight:700 }}>⏳</span>}
      </td>
      <td style={{ ...S.td, fontSize:12, color:"#64748b", fontFamily:"'DM Sans',sans-serif" }}>
        {t.queue_insert_time
          ? new Date(t.queue_insert_time).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })
          : "—"}
      </td>
      <td style={{ ...S.td, whiteSpace:"nowrap" }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {(t.status === "consulting" || t.status === "done") && onAddRx && (
            <button onClick={onAddRx} disabled={!!acting} style={S.actionBtnAmber}>📝 Rx</button>
          )}
          {t.status === "waiting" && t.is_confirmed && (
            <button onClick={() => onSkip(t.id, t.token)} disabled={!!acting} style={S.actionBtnRed}>
              {isActingSkip ? "..." : "Skip"}
            </button>
          )}
          {t.status === "waiting" && !t.is_confirmed && t.patient_type === "online" && (
            <>
              <button onClick={() => onConfirm(t.id, t.token)} disabled={!!acting} style={S.actionBtnGreen}>
                {isActingConfirm ? "..." : "✔ Confirm"}
              </button>
              <button onClick={() => onResend(t.id, t.token)} disabled={!!acting} style={S.actionBtnBlue}>
                {isActingResend ? "..." : "📧 Resend"}
              </button>
              <button onClick={() => onSkip(t.id, t.token)} disabled={!!acting} style={S.actionBtnRed}>
                {isActingSkip ? "..." : "Skip"}
              </button>
            </>
          )}
          {t.status === "consulting" && (
            <button onClick={onNext} disabled={!!acting}
              style={{ ...S.actionBtnGreen, background:"#d1fae5", color:"#065f46" }}>
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
    <p style={{ color:"#94a3b8", fontFamily:"'DM Sans',sans-serif" }}>Loading dashboard...</p>
  </div>
);
const Empty = ({ text }) => (
  <div style={{ textAlign:"center", padding:"80px 40px" }}>
    <div style={{ fontSize:48, marginBottom:12 }}>📋</div>
    <h4 style={{ color:"#1e293b", margin:0, fontFamily:"'DM Sans',sans-serif" }}>{text}</h4>
  </div>
);
const EmptyQueue = ({ text }) => (
  <div style={{ textAlign:"center", padding:"24px", color:"#94a3b8", fontSize:13,
    background:"#f8fafc", borderRadius:10, border:"1px dashed #e2e8f0",
    fontFamily:"'DM Sans',sans-serif" }}>
    {text}
  </div>
);

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  // Layout
  page:         { minHeight:"100vh", background:"linear-gradient(135deg, #0f4c75 0%, #1b6ca8 50%, #118a7e 100%)", display:"flex", flexDirection:"column", fontFamily:"'DM Sans',sans-serif", position:"relative", overflow:"hidden" },
  bgCircle1:    { position:"fixed", width:500, height:500, borderRadius:"50%", background:"rgba(255,255,255,0.04)", top:-100, right:-100, pointerEvents:"none", zIndex:0 },
  bgCircle2:    { position:"fixed", width:320, height:320, borderRadius:"50%", background:"rgba(255,255,255,0.04)", bottom:20, left:-80, pointerEvents:"none", zIndex:0 },
  content:      { padding:"20px 24px 32px", display:"flex", flexDirection:"column", gap:20, maxWidth:1200, width:"100%", margin:"0 auto", boxSizing:"border-box", position:"relative", zIndex:1 },

  // Top bar
  topBar:       { background:"rgba(255,255,255,0.07)", backdropFilter:"blur(12px)", padding:"14px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12, borderBottom:"1px solid rgba(255,255,255,0.12)", position:"relative", zIndex:1 },
  portalBadge:  { display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.12)", borderRadius:30, padding:"5px 14px" },
  greenDot:     { width:8, height:8, borderRadius:"50%", background:"#4ade80", display:"inline-block" },
  topTitle:     { margin:0, fontSize:18, fontWeight:800, color:"#fff", fontFamily:"'DM Sans',sans-serif" },
  topSub:       { margin:0, fontSize:12, color:"#bae6fd", fontFamily:"'DM Sans',sans-serif" },
  topBtn:       { border:"1px solid rgba(255,255,255,0.25)", borderRadius:10, padding:"7px 16px", fontSize:13, fontWeight:600, cursor:"pointer", background:"rgba(255,255,255,0.12)", color:"#fff", fontFamily:"'DM Sans',sans-serif", backdropFilter:"blur(4px)" },

  // Filter bar
  filterBar:    { background:"rgba(255,255,255,0.95)", padding:"14px 24px", display:"flex", alignItems:"center", flexWrap:"wrap", gap:14, borderBottom:"1px solid rgba(255,255,255,0.3)", boxShadow:"0 2px 12px rgba(15,76,117,0.12)", position:"relative", zIndex:1 },
  filterLabel:  { display:"block", fontSize:11, fontWeight:700, color:"#64748b", marginBottom:4, letterSpacing:0.5 },
  dateInput:    { border:"1.5px solid #e2e8f0", borderRadius:10, padding:"9px 13px", fontSize:13, background:"#f8fafc", outline:"none", fontFamily:"'DM Sans',sans-serif", color:"#0f172a" },
  doctorChip:   { display:"inline-flex", alignItems:"center", gap:6, background:"#eff6ff", borderRadius:20, padding:"5px 14px", border:"1px solid #bfdbfe" },

  // Cards
  card:         { background:"rgba(255,255,255,0.97)", borderRadius:20, boxShadow:"0 8px 40px rgba(15,76,117,0.18)", overflow:"hidden", border:"1px solid rgba(255,255,255,0.6)" },
  cardHeader:   { padding:"18px 24px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 },
  cardBody:     { padding:"20px 24px", display:"flex", flexDirection:"column", gap:16 },
  sessionIcon:  { fontSize:28, width:48, height:48, background:"rgba(255,255,255,0.15)", borderRadius:12, display:"flex", alignItems:"center", justifyContent:"center" },
  pillOn:       { padding:"4px 14px", borderRadius:20, fontSize:12, fontWeight:700, background:"rgba(209,250,229,0.9)", color:"#065f46", fontFamily:"'DM Sans',sans-serif" },
  pillOff:      { padding:"4px 14px", borderRadius:20, fontSize:12, fontWeight:600, background:"rgba(255,255,255,0.15)", color:"rgba(255,255,255,0.75)", fontFamily:"'DM Sans',sans-serif" },

  // Not started
  notStartedBox:   { textAlign:"center", padding:"52px 24px", background:"#f8fafc", borderTop:"1px solid #e2e8f0" },
  notStartedTitle: { color:"#0f4c75", margin:"0 0 8px", fontSize:18, fontWeight:800, fontFamily:"'DM Sans',sans-serif" },
  notStartedSub:   { color:"#64748b", margin:"0 0 20px", fontSize:13, fontFamily:"'DM Sans',sans-serif" },

  // Buttons
  btnPrimary:   { background:"linear-gradient(90deg, #0f4c75, #118a7e)", color:"#fff", border:"none", borderRadius:12, padding:"11px 24px", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 4px 20px rgba(15,76,117,0.35)" },
  btnGlass:     { background:"rgba(255,255,255,0.18)", color:"#fff", border:"1.5px solid rgba(255,255,255,0.4)", borderRadius:12, padding:"10px 20px", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", backdropFilter:"blur(4px)" },
  btnDanger:    { background:"rgba(254,242,242,0.25)", color:"#fecaca", border:"1.5px solid rgba(252,165,165,0.4)", borderRadius:12, padding:"10px 16px", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },

  // Stats
  statsGrid:    { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))", gap:12 },
  statCard:     { borderRadius:14, padding:"14px 12px", textAlign:"center", display:"flex", flexDirection:"column", gap:5, alignItems:"center", border:"1px solid rgba(255,255,255,0.6)", boxShadow:"0 1px 4px rgba(0,0,0,0.04)" },
  graceBanner:  { background:"#f5f3ff", border:"1.5px solid #c4b5fd", borderRadius:12, padding:"10px 16px", display:"flex", alignItems:"center", gap:10 },

  // Consulting card
  consultingCard: { background:"linear-gradient(135deg, #0f4c75 0%, #1b6ca8 60%, #118a7e 100%)", borderRadius:16, padding:"20px 24px", boxShadow:"0 8px 32px rgba(15,76,117,0.35)" },
  tokenBig:       { fontSize:34, fontWeight:800, color:"#fff", background:"rgba(255,255,255,0.18)", borderRadius:14, padding:"8px 16px", minWidth:80, textAlign:"center", fontFamily:"'DM Sans',sans-serif", backdropFilter:"blur(4px)" },

  // Table
  tableCard:    { background:"#fff", borderRadius:16, boxShadow:"0 2px 12px rgba(15,76,117,0.07)", overflow:"hidden", border:"1px solid #e2e8f0" },
  tableHeader:  { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"14px 18px", borderBottom:"1px solid #e2e8f0" },
  badge:        { fontSize:11, padding:"3px 12px", borderRadius:20, fontWeight:700, fontFamily:"'DM Sans',sans-serif" },
  table:        { width:"100%", borderCollapse:"collapse", fontSize:13 },
  th:           { padding:"10px 14px", textAlign:"left", fontSize:11, color:"#94a3b8", fontWeight:700, borderBottom:"1px solid #e2e8f0", whiteSpace:"nowrap", fontFamily:"'DM Sans',sans-serif", letterSpacing:0.4 },
  td:           { padding:"10px 14px", borderBottom:"1px solid #f1f5f9", verticalAlign:"middle" },

  // Action buttons (table rows)
  actionBtnRed:   { background:"#fee2e2", color:"#991b1b", border:"none", borderRadius:8, padding:"4px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  actionBtnGreen: { background:"#d1fae5", color:"#065f46", border:"none", borderRadius:8, padding:"4px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  actionBtnBlue:  { background:"#dbeafe", color:"#1d4ed8", border:"none", borderRadius:8, padding:"4px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  actionBtnAmber: { background:"#fef3c7", color:"#92400e", border:"none", borderRadius:8, padding:"4px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },

  // Footer info
  infoCard:     { background:"rgba(255,255,255,0.95)", borderRadius:14, padding:"16px 20px", border:"1px solid rgba(255,255,255,0.5)", boxShadow:"0 2px 12px rgba(15,76,117,0.1)" },

  // Modal
  overlay:      { position:"fixed", inset:0, background:"rgba(15,76,117,0.55)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 },
  modal:        { background:"#fff", borderRadius:24, width:"100%", maxWidth:480, boxShadow:"0 20px 60px rgba(15,76,117,0.3)", maxHeight:"90vh", overflowY:"auto", overflow:"hidden" },
  modalHeader:  { background:"linear-gradient(135deg, #0f4c75 0%, #1b6ca8 60%, #118a7e 100%)", padding:"24px 28px 22px" },
  modalLabel:   { display:"block", fontSize:11, fontWeight:700, color:"#475569", marginBottom:6, letterSpacing:0.8, fontFamily:"'DM Sans',sans-serif" },
  textarea:     { width:"100%", padding:"11px 14px", border:"1.5px solid #e2e8f0", borderRadius:12, fontSize:14, fontFamily:"'DM Sans',sans-serif", resize:"vertical", outline:"none", boxSizing:"border-box", background:"#f8fafc", color:"#0f172a" },
  modalBtnPrimary:   { background:"linear-gradient(90deg, #0f4c75, #118a7e)", color:"#fff", border:"none", borderRadius:12, padding:"12px 16px", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 4px 20px rgba(15,76,117,0.35)" },
  modalBtnSecondary: { background:"#f1f5f9", color:"#0f4c75", border:"1.5px solid #cbd5e1", borderRadius:12, padding:"12px 14px", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  modalBtnCancel:    { background:"#fff", color:"#64748b", border:"1.5px solid #e2e8f0", borderRadius:12, padding:"12px 14px", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
};
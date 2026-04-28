import React, { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  getOPDDashboard, startOPD, approveBooking, rejectStaffBooking,
  bookWalkinToken, fetchTokenAvailability,
  getPendingDoctors, approveDoctor, rejectDoctor,
  getConsultationHistory, getApprovedDoctors,
  resendOPDNotification, staffConfirmAttendance,
  pauseOPD, resumeOPD,
  applyDoctorLeave, cancelDoctorLeave, getDoctorLeaves,
} from "../services/allApi";

const TABS      = ["OPD Management", "Doctor Leave", "Doctor Approvals", "Consultation History"];
const SESSIONS  = ["morning", "evening"];
const STATUS_BG = { pending:"#fef9c3", waiting:"#ede9fe", consulting:"#d1fae5", done:"#f3f4f6", approved:"#dbeafe", skipped:"#fee2e2" };
const STATUS_FG = { pending:"#92400e", waiting:"#5b21b6", consulting:"#065f46", done:"#6b7280", approved:"#1e40af", skipped:"#991b1b" };
const PAY_COLOR = { pending:"#f59e0b", paid:"#10b981", failed:"#ef4444", offline:"#6366f1" };

function extractDocSessionActive(doc, sessTokens) {
  const result = { morning: false, evening: false };
  if (!doc.opd_status) {
    SESSIONS.forEach(sess => {
      result[sess] = (sessTokens[sess] || []).some(t => t.status === "consulting");
    });
    return result;
  }
  if (typeof doc.opd_status.morning === "object" || typeof doc.opd_status.evening === "object") {
    SESSIONS.forEach(sess => { result[sess] = doc.opd_status[sess]?.is_active ?? false; });
    return result;
  }
  if (typeof doc.opd_status.is_active === "boolean") {
    result.morning = doc.opd_status.is_active;
    return result;
  }
  return result;
}

function extractDocSessionLeave(doc) {
  const result = { morning: null, evening: null };
  if (!doc.opd_status) return result;
  SESSIONS.forEach(sess => {
    if (typeof doc.opd_status[sess] === "object" && doc.opd_status[sess]?.on_leave) {
      result[sess] = { on_leave: true, reason: doc.opd_status[sess].leave_reason || null };
    }
  });
  return result;
}

function extractDocSessionPause(doc) {
  const result = { morning: null, evening: null };
  if (!doc.opd_status) return result;
  SESSIONS.forEach(sess => {
    if (typeof doc.opd_status[sess] === "object" && doc.opd_status[sess]?.is_paused) {
      result[sess] = {
        is_paused:    true,
        pause_reason: doc.opd_status[sess].pause_reason || null,
        paused_at:    doc.opd_status[sess].paused_at    || null,
      };
    }
  });
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
function OpDashboard() {
  const navigate = useNavigate();
  const today    = new Date().toISOString().split("T")[0];

  const [activeTab,     setActiveTab]     = useState(0);
  const [doctors,       setDoctors]       = useState([]);
  const [date,          setDate]          = useState(today);
  const [loading,       setLoading]       = useState(true);
  const [acting,        setActing]        = useState(null);

  const [walkinModal,   setWalkinModal]   = useState(null);
  const [walkinName,    setWalkinName]    = useState("");
  const [walkinToken,   setWalkinToken]   = useState("");
  const [availTokens,   setAvailTokens]   = useState([]);
  const [bookingWalkin, setBookingWalkin] = useState(false);

  const [pendingDocs,   setPendingDocs]   = useState([]);
  const [docsLoading,   setDocsLoading]   = useState(false);

  const [history,       setHistory]       = useState([]);
  const [histLoading,   setHistLoading]   = useState(false);
  const [histDate,      setHistDate]      = useState(today);
  const [histDoctor,    setHistDoctor]    = useState("");
  const [histType,      setHistType]      = useState("");
  const [allDoctors,    setAllDoctors]    = useState([]);

  const [detailModal,   setDetailModal]   = useState(null);
  const [pauseModal,    setPauseModal]    = useState(null);
  const [pauseReason,   setPauseReason]   = useState("");

  const [optimisticActive, setOptimisticActive] = useState({});

  const [leaveDoctor,   setLeaveDoctor]   = useState("");
  const [leaveDate,     setLeaveDate]     = useState(today);
  const [leaveSession,  setLeaveSession]  = useState("all");
  const [leaveReason,   setLeaveReason]   = useState("");
  const [leaves,        setLeaves]        = useState([]);
  const [leavesLoading, setLeavesLoading] = useState(false);
  const [leaveBusy,     setLeaveBusy]     = useState(false);

  // ── TAB 1 — OPD MANAGEMENT ───────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOPDDashboard(date);
      setDoctors(res.data);
      setOptimisticActive({});
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      toast.error("Failed to load OPD dashboard");
    } finally { setLoading(false); }
  }, [date, navigate]);

  useEffect(() => { if (activeTab === 0) fetchDashboard(); }, [activeTab, fetchDashboard]);

  const openWalkin = async (doctor, session) => {
    setWalkinModal({ doctor, session });
    setWalkinName(""); setWalkinToken("");
    try {
      const res   = await fetchTokenAvailability(doctor.doctor_id, session, date);
      const avail = res.data?.walkin_tokens?.available || [];
      setAvailTokens(avail);
      setWalkinToken(avail[0] || "");
    } catch { setAvailTokens([]); }
  };

  const handleWalkin = async () => {
    if (!walkinName.trim()) { toast.error("Patient name is required"); return; }
    if (!walkinToken)       { toast.error("Select a token number");    return; }
    setBookingWalkin(true);
    try {
      const res = await bookWalkinToken({
        doctor_id:    walkinModal.doctor.doctor_id,
        session:      walkinModal.session,
        booking_date: date,
        token_number: Number(walkinToken),
        patient_name: walkinName.trim(),
      });
      toast.success(`✅ Walk-in #${res.data.token_number} booked for ${res.data.patient_name}`);
      setWalkinModal(null);
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.error || "Walk-in booking failed");
    } finally { setBookingWalkin(false); }
  };

  const handleStartOPD = async (doctor, session) => {
    const key = `${doctor.doctor_id}_${session}_start`;
    setActing(key);
    try {
      const res = await startOPD({ date, doctor_id: doctor.doctor_id, session });
      toast.success(res.data.message || `OPD started for ${doctor.doctor_name} — ${session}!`);
      setOptimisticActive(prev => ({
        ...prev,
        [doctor.doctor_id]: { ...(prev[doctor.doctor_id] || { morning: false, evening: false }), [session]: true },
      }));
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to start OPD");
    } finally { setActing(null); }
  };

  const handlePauseOPD = async (doctor_id, session, reason) => {
    const key = `${doctor_id}_${session}_pause`;
    setActing(key);
    try {
      const res = await pauseOPD({ date, session, reason: reason || null, doctor_id });
      toast.info(res.data.message || "OPD paused");
      setPauseModal(null); setPauseReason("");
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to pause OPD");
    } finally { setActing(null); }
  };

  const handleResumeOPD = async (doctor_id, session) => {
    const key = `${doctor_id}_${session}_resume`;
    setActing(key);
    try {
      const res = await resumeOPD({ date, session, doctor_id });
      toast.success(res.data.message || "OPD resumed");
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to resume OPD");
    } finally { setActing(null); }
  };

  const handleApprove = async (id) => {
    setActing(id + "_approve");
    try { await approveBooking(id); toast.success("Token moved to consulting"); fetchDashboard(); }
    catch (err) { toast.error(err.response?.data?.error || "Approve failed"); }
    finally { setActing(null); }
  };

  const handleReject = async (id) => {
    if (!window.confirm("Reject this token?")) return;
    setActing(id + "_reject");
    try { await rejectStaffBooking(id); toast.warning("Token rejected"); fetchDashboard(); }
    catch (err) { toast.error(err.response?.data?.error || "Reject failed"); }
    finally { setActing(null); }
  };

  const handleResendNotification = async (id) => {
    setActing(id + "_resend");
    try { const res = await resendOPDNotification(id); toast.success(`📧 ${res.data.message}`); }
    catch (err) { toast.error(err.response?.data?.error || "Failed to resend notification"); }
    finally { setActing(null); }
  };

  const handleStaffConfirm = async (id, tokenNum) => {
    setActing(id + "_confirm");
    try { await staffConfirmAttendance(id); toast.success(`✅ Token #${tokenNum} confirmed`); fetchDashboard(); }
    catch (err) { toast.error(err.response?.data?.error || "Confirm failed"); }
    finally { setActing(null); }
  };

  // ── TAB 2 — DOCTOR LEAVE ────────────────────────────────────────────────
  const fetchLeaves = useCallback(async () => {
    setLeavesLoading(true);
    try { const res = await getDoctorLeaves(); setLeaves(res.data || []); }
    catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      if (err.response?.status === 403) toast.error("Only OPD staff can manage doctor leaves");
      else toast.error("Failed to load leaves");
    } finally { setLeavesLoading(false); }
  }, [navigate]);

  useEffect(() => {
    if (activeTab === 1) {
      fetchLeaves();
      getApprovedDoctors().then(r => setAllDoctors(r.data)).catch(() => {});
    }
  }, [activeTab, fetchLeaves]);

  const handleApplyLeave = async () => {
    if (!leaveDoctor)  { toast.error("Please select a doctor");  return; }
    if (!leaveDate)    { toast.error("Please pick a date");      return; }
    if (!leaveSession) { toast.error("Please choose a session"); return; }
    setLeaveBusy(true);
    try {
      const res = await applyDoctorLeave({ doctor_id: Number(leaveDoctor), date: leaveDate, session: leaveSession, reason: leaveReason.trim() || undefined });
      toast.success(res.data.message || "Leave applied");
      if (res.data.cancelled_bookings > 0)
        toast.info(`${res.data.cancelled_bookings} existing booking(s) cancelled · ${res.data.notified} patient(s) notified`);
      setLeaveDoctor(""); setLeaveReason(""); setLeaveSession("all");
      fetchLeaves();
    } catch (err) { toast.error(err.response?.data?.error || "Failed to apply leave"); }
    finally { setLeaveBusy(false); }
  };

  const handleCancelLeave = async (leave) => {
    if (!window.confirm(
      `Cancel leave for Dr. ${leave.doctor_name} on ${leave.date} (${leave.session})?\n\nBookings will re-open but cancelled bookings are NOT auto-restored.`
    )) return;
    setActing(leave.id + "_lcancel");
    try {
      await cancelDoctorLeave({ doctor_id: leave.doctor_id, date: leave.date, session: leave.session });
      toast.success("Leave cancelled"); fetchLeaves();
    } catch (err) { toast.error(err.response?.data?.error || "Failed to cancel leave"); }
    finally { setActing(null); }
  };

  // ── TAB 3 — DOCTOR APPROVALS ─────────────────────────────────────────────
  const fetchPendingDoctors = useCallback(async () => {
    setDocsLoading(true);
    try { const res = await getPendingDoctors(); setPendingDocs(res.data); }
    catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      toast.error("Failed to load pending doctors");
    } finally { setDocsLoading(false); }
  }, [navigate]);

  useEffect(() => { if (activeTab === 2) fetchPendingDoctors(); }, [activeTab, fetchPendingDoctors]);

  const handleApproveDoctor = async (id, name) => {
    setActing(id + "_dapprove");
    try { await approveDoctor(id); toast.success(`✅ Dr. ${name} approved!`); fetchPendingDoctors(); }
    catch (err) { toast.error(err.response?.data?.error || "Approval failed"); }
    finally { setActing(null); }
  };

  const handleRejectDoctor = async (id, name) => {
    if (!window.confirm(`Reject Dr. ${name}? This will permanently delete their registration.`)) return;
    setActing(id + "_dreject");
    try { await rejectDoctor(id); toast.warning(`Dr. ${name}'s registration rejected`); fetchPendingDoctors(); }
    catch (err) { toast.error(err.response?.data?.error || "Rejection failed"); }
    finally { setActing(null); }
  };

  // ── TAB 4 — CONSULTATION HISTORY ─────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setHistLoading(true);
    try { const res = await getConsultationHistory(histDate, histDoctor, histType); setHistory(res.data); }
    catch { toast.error("Failed to load consultation history"); }
    finally { setHistLoading(false); }
  }, [histDate, histDoctor, histType]);

  useEffect(() => {
    if (activeTab === 3) {
      fetchHistory();
      getApprovedDoctors().then(r => setAllDoctors(r.data)).catch(() => {});
    }
  }, [activeTab, fetchHistory]);

  const totalDuration = history.reduce((s, h) => s + (h.duration_minutes || 0), 0);
  const avgMin        = history.length ? (totalDuration / history.length) : 0;
  const avgDisplay    = (() => {
    const m = Math.round(avgMin);
    if (m === 0) return "0m";
    const h = Math.floor(m / 60), mm = m % 60;
    return h ? (mm ? `${h}h ${mm}m` : `${h}h`) : `${mm}m`;
  })();
  const onlineCount = history.filter(h => h.patient_type === "online").length;
  const walkinCount = history.filter(h => h.patient_type === "walkin").length;

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      {/* Decorative bg circles — matches Login */}
      <div style={S.bgCircle1} />
      <div style={S.bgCircle2} />

      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <div style={S.topBar}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={S.portalBadge}>
            <span style={S.greenDot} />
            <span style={{ color:"#e0f2fe", fontSize:13, fontWeight:500, fontFamily:"'DM Sans',sans-serif" }}>MedQueue Portal</span>
          </div>
          <div>
            <h2 style={S.topTitle}>OPD Staff Dashboard</h2>
            <p style={S.topSub}>Manage sessions, leaves, approvals &amp; history</p>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
      <div style={S.tabBarWrap}>
        <div style={S.tabBar}>
          {TABS.map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(i)} style={{
              ...S.tabBtn,
              background: activeTab === i ? "linear-gradient(90deg,#0f4c75,#118a7e)" : "transparent",
              color:      activeTab === i ? "#fff" : "#64748b",
              fontWeight: activeTab === i ? 700 : 500,
              boxShadow:  activeTab === i ? "0 2px 12px rgba(15,76,117,0.3)" : "none",
            }}>
              {tab === "OPD Management"       && "🗂 "}
              {tab === "Doctor Leave"         && "🛌 "}
              {tab === "Doctor Approvals"     && "👨‍⚕️ "}
              {tab === "Consultation History" && "📋 "}
              {tab}
              {tab === "Doctor Approvals" && pendingDocs.length > 0 && (
                <span style={S.notifBadge}>{pendingDocs.length}</span>
              )}
              {tab === "Doctor Leave" && leaves.length > 0 && (
                <span style={{ ...S.notifBadge, background:"#f59e0b" }}>{leaves.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════
          TAB 1 — OPD MANAGEMENT
      ══════════════════════════════════════════ */}
      {activeTab === 0 && (
        <div style={S.tabContent}>
          <div style={S.sectionHeader}>
            <h3 style={S.sectionTitle}>OPD Sessions — {date}</h3>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <label style={S.filterLabel}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={S.input} />
            </div>
          </div>

          {loading ? <Spinner /> : doctors.length === 0 ? (
            <Empty text={`No doctors for ${date}`} />
          ) : doctors.map(doc => {
            const leaveState = extractDocSessionLeave(doc);
            const pauseState = extractDocSessionPause(doc);
            return (
              <div key={doc.doctor_id} style={S.card}>
                {/* Doctor header — gradient matches Login */}
                <div style={S.cardHeader}>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    <div style={S.avatar}>{(doc.doctor_name||"D")[0].toUpperCase()}</div>
                    <div>
                      <h3 style={{ margin:0, color:"#fff", fontSize:16, fontWeight:800, fontFamily:"'DM Sans',sans-serif" }}>
                        {doc.doctor_name}
                      </h3>
                      <p style={{ margin:"3px 0 0", color:"#bae6fd", fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>
                        {doc.hospital} · {doc.department}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:14 }}>
                  {SESSIONS.map(sess => {
                    const sessData  = doc.sessions?.[sess] || { online:[], walkin:[], total_booked:0 };
                    const allTokens = [...(sessData.online||[]), ...(sessData.walkin||[])].sort((a,b) => a.token - b.token);

                    const sessTokenMap = {};
                    SESSIONS.forEach(s => {
                      const sd = doc.sessions?.[s] || { online:[], walkin:[] };
                      sessTokenMap[s] = [...(sd.online||[]), ...(sd.walkin||[])];
                    });
                    const backendActive = extractDocSessionActive(doc, sessTokenMap);
                    const optimistic    = optimisticActive[doc.doctor_id];
                    const sessOpdActive = optimistic?.[sess] !== undefined ? optimistic[sess] : backendActive[sess];
                    const sessLeave     = leaveState[sess];
                    const sessPause     = pauseState[sess];
                    const isPaused      = !!sessPause?.is_paused;
                    const isStarting    = acting === `${doc.doctor_id}_${sess}_start`;
                    const isResuming    = acting === `${doc.doctor_id}_${sess}_resume`;

                    return (
                      <div key={sess} style={S.sessionBlock}>
                        {sessLeave?.on_leave && (
                          <div style={S.leaveBanner}>
                            <span style={{ fontSize:16 }}>🛌</span>
                            <div style={{ flex:1 }}>
                              <b>On Leave</b>
                              {sessLeave.reason && <span style={{ marginLeft:6, fontSize:12 }}>· {sessLeave.reason}</span>}
                            </div>
                            <span style={{ fontSize:11, fontWeight:700 }}>Bookings frozen</span>
                          </div>
                        )}

                        {isPaused && (
                          <div style={S.pauseBanner}>
                            <span style={{ fontSize:16 }}>⏸</span>
                            <div style={{ flex:1 }}>
                              <b>OPD Paused</b>
                              {sessPause.pause_reason && <span style={{ marginLeft:6, fontSize:12 }}>· {sessPause.pause_reason}</span>}
                            </div>
                            <span style={{ fontSize:11, fontWeight:700 }}>Queue paused</span>
                          </div>
                        )}

                        <div style={S.sessionOPDHeader}>
                          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                            <h4 style={{ margin:0, color:"#0f4c75", fontSize:14, fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>
                              {sess === "morning" ? "🌅" : "🌆"} {sess === "morning" ? "Morning" : "Evening"} Session OPD
                            </h4>
                            <span style={{
                              fontSize:11, padding:"3px 12px", borderRadius:20, fontWeight:700,
                              background: allTokens.length > 0 ? "#dbeafe" : "#f1f5f9",
                              color:      allTokens.length > 0 ? "#1d4ed8" : "#94a3b8",
                              fontFamily:"'DM Sans',sans-serif",
                            }}>
                              {allTokens.length} booked
                            </span>
                            {allTokens.length > 0 && (
                              <span style={{ fontSize:11, color:"#94a3b8", fontFamily:"'DM Sans',sans-serif" }}>
                                ({sessData.online?.length||0} online · {sessData.walkin?.length||0} walk-in)
                              </span>
                            )}
                          </div>

                          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                            {sessOpdActive ? (
                              <>
                                {isPaused
                                  ? <span style={{ ...S.pill, background:"#fef3c7", color:"#92400e" }}>⏸ Paused</span>
                                  : <span style={{ ...S.pill, background:"#d1fae5", color:"#065f46" }}>🟢 OPD Active</span>
                                }
                                {isPaused ? (
                                  <button onClick={() => handleResumeOPD(doc.doctor_id, sess)} disabled={!!acting}
                                    style={{ ...S.btnSmall, background:"#059669", color:"#fff" }}>
                                    {isResuming ? "Resuming..." : "▶ Resume"}
                                  </button>
                                ) : (
                                  <button onClick={() => { setPauseReason(""); setPauseModal({ doctor_id: doc.doctor_id, session: sess }); }}
                                    disabled={!!acting}
                                    style={{ ...S.btnSmall, background:"#fbbf24", color:"#92400e" }}>
                                    ⏸ Pause
                                  </button>
                                )}
                              </>
                            ) : sessLeave?.on_leave ? (
                              <button disabled style={{ ...S.btnStart, background:"#94a3b8", cursor:"not-allowed" }}>
                                ▶ Start OPD
                              </button>
                            ) : (
                              <button onClick={() => handleStartOPD(doc, sess)} disabled={!!acting} style={S.btnStart}>
                                {isStarting ? "Starting..." : "▶ Start OPD"}
                              </button>
                            )}
                            {!sessLeave?.on_leave && (
                              <button onClick={() => openWalkin(doc, sess)} style={S.btnWalkin}>
                                + Walk-in
                              </button>
                            )}
                          </div>
                        </div>

                        {allTokens.length === 0 ? (
                          <div style={{ textAlign:"center", padding:"16px", color:"#94a3b8", fontSize:13,
                            background:"#f8fafc", borderRadius:10, border:"1px dashed #e2e8f0", marginTop:10,
                            fontFamily:"'DM Sans',sans-serif" }}>
                            No tokens booked for {sess} session
                          </div>
                        ) : (
                          <div style={{ overflowX:"auto", marginTop:10 }}>
                            <table style={S.table}>
                              <thead>
                                <tr style={{ background:"#f8fafc" }}>
                                  {["Token","Patient","Type","Status","Payment","Confirmed","Actions"].map(h => (
                                    <th key={h} style={S.th}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {allTokens.map(t => (
                                  <tr key={t.id} style={{
                                    background: t.status==="consulting" ? "#ecfdf5" : t.status==="done" ? "#f8fafc" : "#fff",
                                  }}>
                                    <td style={S.td}><b style={{ color:"#0f4c75", fontFamily:"'DM Sans',sans-serif" }}>#{t.token}</b></td>
                                    <td style={{ ...S.td, fontFamily:"'DM Sans',sans-serif" }}>{t.patient_name}</td>
                                    <td style={S.td}>
                                      <span style={{
                                        fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:700,
                                        background: t.type==="online" ? "#dbeafe" : "#f3f4f6",
                                        color:      t.type==="online" ? "#1d4ed8" : "#6b7280",
                                        fontFamily:"'DM Sans',sans-serif",
                                      }}>{t.type}</span>
                                    </td>
                                    <td style={S.td}>
                                      <span style={{
                                        fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:700,
                                        background: STATUS_BG[t.status]||"#f1f5f9",
                                        color:      STATUS_FG[t.status]||"#475569",
                                        fontFamily:"'DM Sans',sans-serif",
                                      }}>{t.status}</span>
                                    </td>
                                    <td style={{ ...S.td, fontFamily:"'DM Sans',sans-serif" }}>
                                      <span style={{ fontSize:12, color:PAY_COLOR[t.payment]||"#475569", fontWeight:700 }}>
                                        {t.payment}
                                      </span>
                                    </td>
                                    <td style={{ ...S.td, textAlign:"center" }}>
                                      {t.is_confirmed
                                        ? <span style={{ color:"#10b981", fontWeight:700 }}>✅</span>
                                        : <span style={{ color:"#f59e0b", fontWeight:700 }}>⏳</span>}
                                    </td>
                                    <td style={S.td}>
                                      <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                                        {!t.is_confirmed && t.type==="online" && ["pending","waiting"].includes(t.status) && (
                                          <button onClick={() => handleStaffConfirm(t.id, t.token)} disabled={!!acting} style={S.actionBtnPurple}>
                                            {acting===t.id+"_confirm" ? "..." : "✔ Confirm"}
                                          </button>
                                        )}
                                        {t.status==="waiting" && sessOpdActive && !isPaused && (
                                          <>
                                            <button onClick={() => handleApprove(t.id)} disabled={!!acting} style={S.actionBtnGreen}>
                                              {acting===t.id+"_approve" ? "..." : "▶ Call"}
                                            </button>
                                            <button onClick={() => handleReject(t.id)} disabled={!!acting} style={S.actionBtnRed}>
                                              {acting===t.id+"_reject" ? "..." : "✗"}
                                            </button>
                                          </>
                                        )}
                                        {!t.is_confirmed && t.type==="online" && ["pending","waiting"].includes(t.status) && (
                                          <button onClick={() => handleResendNotification(t.id)} disabled={!!acting} style={S.actionBtnBlue}>
                                            {acting===t.id+"_resend" ? "..." : "📧"}
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB 2 — DOCTOR LEAVE
      ══════════════════════════════════════════ */}
      {activeTab === 1 && (
        <div style={S.tabContent}>
          <h3 style={S.sectionTitle}>🛌 Apply Leave for a Doctor</h3>

          <div style={S.formCard}>
            <div style={S.leaveGrid}>
              <div>
                <label style={S.filterLabel}>Doctor *</label>
                <select value={leaveDoctor} onChange={e => setLeaveDoctor(e.target.value)} style={{ ...S.input, width:"100%" }}>
                  <option value="">— Select Doctor —</option>
                  {allDoctors.map(d => (
                    <option key={d.id} value={d.id}>Dr. {d.name || d.full_name} · {d.department}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.filterLabel}>Date *</label>
                <input type="date" value={leaveDate} min={today} onChange={e => setLeaveDate(e.target.value)} style={{ ...S.input, width:"100%" }} />
                <div style={{ fontSize:11, color:"#94a3b8", marginTop:4, fontFamily:"'DM Sans',sans-serif" }}>Only today / tomorrow / day-after allowed</div>
              </div>
              <div>
                <label style={S.filterLabel}>Session *</label>
                <select value={leaveSession} onChange={e => setLeaveSession(e.target.value)} style={{ ...S.input, width:"100%" }}>
                  <option value="all">Full Day (both sessions)</option>
                  <option value="morning">Morning only</option>
                  <option value="evening">Evening only</option>
                </select>
              </div>
            </div>
            <div style={{ marginTop:14 }}>
              <label style={S.filterLabel}>Reason (optional)</label>
              <input type="text" value={leaveReason} onChange={e => setLeaveReason(e.target.value)}
                placeholder="e.g. Medical conference, personal emergency"
                style={{ ...S.input, width:"100%" }} />
            </div>
            <div style={{ marginTop:16, display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
              <button onClick={handleApplyLeave} disabled={leaveBusy} style={{
                ...S.btnPrimary, padding:"10px 22px",
                background: leaveBusy ? "#94a3b8" : "linear-gradient(90deg,#0f4c75,#118a7e)",
                cursor: leaveBusy ? "not-allowed" : "pointer",
              }}>
                {leaveBusy ? "Applying..." : "🛌 Apply Leave"}
              </button>
              <button onClick={fetchLeaves} style={S.btnRefresh}>🔄 Refresh</button>
              <div style={{ fontSize:12, color:"#94a3b8", marginLeft:"auto", fontFamily:"'DM Sans',sans-serif" }}>
                ⚠ Existing bookings for the slot will be cancelled and patients notified by email.
              </div>
            </div>
          </div>

          <h3 style={{ ...S.sectionTitle, marginTop:28 }}>Active &amp; Upcoming Leaves</h3>

          {leavesLoading ? <Spinner /> : leaves.length === 0 ? (
            <Empty text="No active leaves" icon="✅" />
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table style={S.table}>
                <thead>
                  <tr style={{ background:"#f8fafc" }}>
                    {["Doctor","Hospital","Department","Date","Session","Reason","Applied By","Actions"].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leaves.map(l => (
                    <tr key={l.id}>
                      <td style={S.td}><b style={{ color:"#0f4c75", fontFamily:"'DM Sans',sans-serif" }}>Dr. {l.doctor_name}</b></td>
                      <td style={{ ...S.td, fontFamily:"'DM Sans',sans-serif" }}>{l.hospital}</td>
                      <td style={{ ...S.td, fontFamily:"'DM Sans',sans-serif" }}>{l.department}</td>
                      <td style={{ ...S.td, fontFamily:"'DM Sans',sans-serif" }}>{l.date}</td>
                      <td style={S.td}>
                        <span style={{ fontSize:11, padding:"3px 12px", borderRadius:20, fontWeight:700, background:"#fef3c7", color:"#92400e", fontFamily:"'DM Sans',sans-serif" }}>
                          {l.session === "all" ? "🛌 Full Day" : l.session === "morning" ? "🌅 Morning" : "🌆 Evening"}
                        </span>
                      </td>
                      <td style={{ ...S.td, fontFamily:"'DM Sans',sans-serif" }}>{l.reason || "—"}</td>
                      <td style={{ ...S.td, fontFamily:"'DM Sans',sans-serif" }}>{l.applied_by || "—"}</td>
                      <td style={S.td}>
                        <button onClick={() => handleCancelLeave(l)} disabled={!!acting} style={S.actionBtnRed}>
                          {acting === l.id + "_lcancel" ? "..." : "✗ Cancel"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB 3 — DOCTOR APPROVALS
      ══════════════════════════════════════════ */}
      {activeTab === 2 && (
        <div style={S.tabContent}>
          <div style={S.sectionHeader}>
            <h3 style={S.sectionTitle}>👨‍⚕️ Pending Doctor Registrations</h3>
            <button onClick={fetchPendingDoctors} style={S.btnRefresh}>🔄 Refresh</button>
          </div>

          {docsLoading ? <Spinner /> : pendingDocs.length === 0 ? (
            <Empty text="No pending doctor registrations" icon="✅" />
          ) : (
            <div style={{ display:"grid", gap:14 }}>
              {pendingDocs.map(doc => (
                <div key={doc.id} style={S.card}>
                  <div style={{ padding:"20px 24px", display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:14 }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:8 }}>
                        <div style={S.avatar}>{(doc.name||"D")[0].toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight:800, fontSize:16, color:"#0f4c75", fontFamily:"'DM Sans',sans-serif" }}>Dr. {doc.name}</div>
                          <div style={{ fontSize:13, color:"#64748b", fontFamily:"'DM Sans',sans-serif" }}>{doc.email}</div>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:16, fontSize:13, color:"#475569", marginLeft:50, fontFamily:"'DM Sans',sans-serif" }}>
                        <span>🏥 {doc.hospital}</span>
                        <span>🏷 {doc.department}</span>
                        <span>📅 {new Date(doc.joined).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:10 }}>
                      <button onClick={() => handleApproveDoctor(doc.id, doc.name)} disabled={!!acting}
                        style={{ ...S.btnPrimary, padding:"10px 20px", fontSize:14 }}>
                        {acting===doc.id+"_dapprove" ? "Approving..." : "✅ Approve"}
                      </button>
                      <button onClick={() => handleRejectDoctor(doc.id, doc.name)} disabled={!!acting}
                        style={{ ...S.btnDanger, padding:"10px 20px", fontSize:14 }}>
                        {acting===doc.id+"_dreject" ? "Rejecting..." : "❌ Reject"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB 4 — CONSULTATION HISTORY
      ══════════════════════════════════════════ */}
      {activeTab === 3 && (
        <div style={S.tabContent}>
          <div style={{ display:"flex", gap:12, alignItems:"flex-end", marginBottom:20, flexWrap:"wrap" }}>
            <div>
              <label style={S.filterLabel}>Date</label>
              <input type="date" value={histDate} onChange={e => setHistDate(e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.filterLabel}>Doctor</label>
              <select value={histDoctor} onChange={e => setHistDoctor(e.target.value)} style={S.input}>
                <option value="">All Doctors</option>
                {allDoctors.map(d => <option key={d.id} value={d.id}>{d.name || d.full_name}</option>)}
              </select>
            </div>
            <div>
              <label style={S.filterLabel}>Patient Type</label>
              <select value={histType} onChange={e => setHistType(e.target.value)} style={S.input}>
                <option value="">All Types</option>
                <option value="online">Online</option>
                <option value="walkin">Walk-in</option>
              </select>
            </div>
            <button onClick={fetchHistory} style={{ ...S.btnPrimary, padding:"9px 20px" }}>🔍 Search</button>
          </div>

          {history.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:20 }}>
              {[
                { label:"Total",        val: history.length,    icon:"📋", color:"#0f4c75" },
                { label:"Morning",      val: history.filter(h=>h.session==="morning").length, icon:"🌅", color:"#6366f1" },
                { label:"Evening",      val: history.filter(h=>h.session==="evening").length, icon:"🌆", color:"#f59e0b" },
                { label:"Online",       val: onlineCount,       icon:"🌐", color:"#1d4ed8" },
                { label:"Walk-in",      val: walkinCount,       icon:"🚶", color:"#059669" },
                { label:"Avg Duration", val: avgDisplay,        icon:"⏱",  color:"#10b981" },
              ].map(s => (
                <div key={s.label} style={{ ...S.statCard, borderTop:`3px solid ${s.color}` }}>
                  <div style={{ fontSize:18 }}>{s.icon}</div>
                  <div style={{ fontWeight:800, fontSize:20, color:s.color, fontFamily:"'DM Sans',sans-serif" }}>{s.val}</div>
                  <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"'DM Sans',sans-serif" }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}

          {histLoading ? <Spinner /> : history.length === 0 ? (
            <Empty text="No consultations found" icon="📋" />
          ) : (
            SESSIONS.map(sess => {
              const sessHistory = history.filter(h => h.session === sess);
              return (
                <div key={sess} style={{ marginBottom: sess==="morning" ? 24 : 0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                    <h4 style={{ margin:0, color:"#0f4c75", fontSize:15, fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>
                      {sess==="morning" ? "🌅" : "🌆"} {sess==="morning" ? "Morning" : "Evening"} Session
                    </h4>
                    <span style={{
                      fontSize:11, padding:"3px 12px", borderRadius:20, fontWeight:700,
                      background: sessHistory.length > 0 ? "#dbeafe" : "#f1f5f9",
                      color:      sessHistory.length > 0 ? "#1d4ed8" : "#94a3b8",
                      fontFamily:"'DM Sans',sans-serif",
                    }}>{sessHistory.length} consultations</span>
                  </div>

                  {sessHistory.length === 0 ? (
                    <div style={{ padding:"16px", color:"#94a3b8", fontSize:13,
                      background:"#f8fafc", borderRadius:10, border:"1px dashed #e2e8f0",
                      textAlign:"center", marginBottom:8, fontFamily:"'DM Sans',sans-serif" }}>
                      No consultations for {sess} session on this date
                    </div>
                  ) : (
                    <div style={{ overflowX:"auto", marginBottom:8 }}>
                      <table style={S.table}>
                        <thead>
                          <tr style={{ background:"#f8fafc" }}>
                            {["Token","Patient","Type","Doctor","Dept","Date","Started","Ended","Duration","Payment","Details"].map(h => (
                              <th key={h} style={S.th}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sessHistory.map(h => (
                            <tr key={h.id} style={{ background: h.patient_type==="walkin" ? "#f0fdf4" : "#fff" }}>
                              <td style={S.td}><b style={{ color:"#0f4c75", fontFamily:"'DM Sans',sans-serif" }}>#{h.token}</b></td>
                              <td style={{ ...S.td, fontFamily:"'DM Sans',sans-serif" }}>
                                <span style={{ color: h.patient_type==="walkin" ? "#059669" : "#1e293b", fontWeight:600 }}>
                                  {h.patient_name}
                                </span>
                              </td>
                              <td style={S.td}>
                                <span style={{
                                  fontSize:11, padding:"3px 10px", borderRadius:20, fontWeight:700,
                                  background: h.patient_type==="online" ? "#dbeafe" : "#dcfce7",
                                  color:      h.patient_type==="online" ? "#1d4ed8" : "#166534",
                                  fontFamily:"'DM Sans',sans-serif",
                                }}>
                                  {h.patient_type==="walkin" ? "🚶 Walk-in" : "🌐 Online"}
                                </span>
                              </td>
                              <td style={{ ...S.td, fontFamily:"'DM Sans',sans-serif" }}>{h.doctor_name}</td>
                              <td style={{ ...S.td, fontFamily:"'DM Sans',sans-serif" }}>{h.department}</td>
                              <td style={{ ...S.td, fontFamily:"'DM Sans',sans-serif" }}>{h.booking_date}</td>
                              <td style={{ ...S.td, fontFamily:"'DM Sans',sans-serif" }}>
                                {h.consulting_started_at ? new Date(h.consulting_started_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "—"}
                              </td>
                              <td style={{ ...S.td, fontFamily:"'DM Sans',sans-serif" }}>
                                {h.consulting_ended_at ? new Date(h.consulting_ended_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "—"}
                              </td>
                              <td style={S.td}>
                                {h.duration?.display
                                  ? <span style={{ color:"#059669", fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>{h.duration.display}</span>
                                  : (h.duration_minutes != null
                                      ? <span style={{ color:"#059669", fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>{h.duration_minutes.toFixed(1)} min</span>
                                      : "—")}
                              </td>
                              <td style={S.td}>
                                <span style={{ fontSize:12, color:PAY_COLOR[h.payment_status]||"#475569", fontWeight:700, fontFamily:"'DM Sans',sans-serif" }}>
                                  {h.payment_status}
                                </span>
                              </td>
                              <td style={S.td}>
                                <button onClick={() => setDetailModal(h)} style={S.actionBtnGrey}>👁 View</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── Walk-in Modal ──────────────────────────────────────────────── */}
      {walkinModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={S.modalHeader}>
              <h3 style={{ margin:0, color:"#fff", fontSize:18, fontWeight:800, fontFamily:"'DM Sans',sans-serif" }}>
                🚶 Walk-in Token Booking
              </h3>
              <p style={{ color:"#bae6fd", fontSize:13, margin:"6px 0 0", fontFamily:"'DM Sans',sans-serif" }}>
                {walkinModal.doctor.doctor_name} · {walkinModal.session} · {date}
              </p>
            </div>
            <div style={{ padding:"24px 28px 28px" }}>
              <div style={{ marginBottom:16 }}>
                <label style={S.modalLabel}>Patient Name *</label>
                <input value={walkinName} onChange={e => setWalkinName(e.target.value)}
                  placeholder="Enter full name" style={S.modalInput} />
              </div>
              <div style={{ marginBottom:22 }}>
                <label style={S.modalLabel}>Walk-in Token Number *</label>
                {availTokens.length > 0 ? (
                  <select value={walkinToken} onChange={e => setWalkinToken(e.target.value)} style={S.modalInput}>
                    <option value="">— Select token —</option>
                    {availTokens.map(t => <option key={t} value={t}>Token #{t}</option>)}
                  </select>
                ) : (
                  <div style={{ color:"#ef4444", fontSize:13, fontFamily:"'DM Sans',sans-serif" }}>❌ No walk-in tokens available</div>
                )}
                <div style={{ fontSize:11, color:"#94a3b8", marginTop:4, fontFamily:"'DM Sans',sans-serif" }}>Walk-in range: 1–15 and 36–60</div>
              </div>
              <div style={{ display:"flex", gap:10 }}>
                <button onClick={handleWalkin} disabled={bookingWalkin || availTokens.length===0}
                  style={{ ...S.btnPrimary, flex:1, padding:"12px" }}>
                  {bookingWalkin ? "Booking..." : "Book Walk-in Token"}
                </button>
                <button onClick={() => setWalkinModal(null)} style={{ ...S.btnGhost, flex:1 }}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Patient Detail Modal ──────────────────────────────────────── */}
      {detailModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth:480 }}>
            <div style={S.modalHeader}>
              <h3 style={{ margin:0, color:"#fff", fontSize:18, fontWeight:800, fontFamily:"'DM Sans',sans-serif" }}>
                {detailModal.patient_type==="walkin" ? "🚶 Walk-in" : "🌐 Online"} Patient Details
              </h3>
              <p style={{ color:"#bae6fd", fontSize:13, margin:"6px 0 0", fontFamily:"'DM Sans',sans-serif" }}>
                Token #{detailModal.token} · {detailModal.patient_name}
              </p>
            </div>
            <div style={{ padding:"24px 28px 28px" }}>
              <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:18 }}>
                <span style={{ background:"linear-gradient(90deg,#0f4c75,#118a7e)", color:"#fff", borderRadius:10, padding:"6px 16px", fontWeight:800, fontSize:18, fontFamily:"'DM Sans',sans-serif" }}>
                  #{detailModal.token}
                </span>
                <span style={{
                  fontSize:12, padding:"4px 14px", borderRadius:20, fontWeight:700,
                  background: detailModal.patient_type==="online" ? "#dbeafe" : "#dcfce7",
                  color:      detailModal.patient_type==="online" ? "#1d4ed8" : "#166534",
                  fontFamily:"'DM Sans',sans-serif",
                }}>
                  {detailModal.patient_type==="walkin" ? "Walk-in Patient" : "Online Booking"}
                </span>
              </div>

              <div style={{ background:"#f8fafc", borderRadius:12, padding:"14px 16px", marginBottom:14 }}>
                <div style={{ fontSize:11, color:"#94a3b8", marginBottom:2, fontFamily:"'DM Sans',sans-serif" }}>Patient Name</div>
                <div style={{ fontWeight:800, fontSize:16, color:"#1e293b", marginBottom:10, fontFamily:"'DM Sans',sans-serif" }}>
                  {detailModal.patient_name}
                </div>
                {detailModal.patient_type === "online" && (
                  <>
                    <div style={{ fontSize:11, color:"#94a3b8", marginBottom:2, fontFamily:"'DM Sans',sans-serif" }}>Email</div>
                    <div style={{ fontSize:14, color:"#1e293b", marginBottom:10, fontFamily:"'DM Sans',sans-serif" }}>
                      {detailModal.patient_email || "—"}
                    </div>
                  </>
                )}
                {detailModal.patient_type === "walkin" && (
                  <div style={{ background:"#dcfce7", borderRadius:8, padding:"8px 12px", fontSize:12, color:"#166534", display:"flex", alignItems:"center", gap:6, fontFamily:"'DM Sans',sans-serif" }}>
                    🚶 Walk-in patients are registered at the counter — no account linked.
                  </div>
                )}
              </div>

              <div style={{ background:"#f8fafc", borderRadius:12, padding:"14px 16px", marginBottom:18 }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, fontSize:13 }}>
                  {[
                    ["Doctor",   detailModal.doctor_name],
                    ["Hospital", detailModal.hospital],
                    ["Dept",     detailModal.department],
                    ["Date",     detailModal.booking_date],
                    ["Session",  detailModal.session],
                    ["Payment",  detailModal.payment_status],
                    ["Started",  detailModal.consulting_started_at ? new Date(detailModal.consulting_started_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}) : "—"],
                    ["Ended",    detailModal.consulting_ended_at   ? new Date(detailModal.consulting_ended_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})   : "—"],
                    ["Duration", detailModal.duration?.display ? detailModal.duration.display : (detailModal.duration_minutes != null ? `${detailModal.duration_minutes.toFixed(1)} min` : "—")],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <div style={{ fontSize:11, color:"#94a3b8", fontFamily:"'DM Sans',sans-serif" }}>{label}</div>
                      <div style={{ fontWeight:700, color:"#1e293b", fontFamily:"'DM Sans',sans-serif" }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={() => setDetailModal(null)} style={{ ...S.btnGhost, width:"100%" }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Pause OPD Modal ────────────────────────────────────────────── */}
      {pauseModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={S.modalHeader}>
              <h3 style={{ textAlign:"center", color:"#fff", margin:0, fontSize:20, fontWeight:800, fontFamily:"'DM Sans',sans-serif" }}>
                ⏸ Pause OPD?
              </h3>
              <p style={{ textAlign:"center", color:"#bae6fd", fontSize:13, margin:"8px 0 0", fontFamily:"'DM Sans',sans-serif" }}>
                The queue will be paused. You can resume anytime.
              </p>
            </div>
            <div style={{ padding:"24px 28px 28px" }}>
              <label style={S.modalLabel}>Reason (optional)</label>
              <input
                type="text" value={pauseReason}
                onChange={e => setPauseReason(e.target.value)}
                placeholder="e.g. Emergency, short break, equipment issue"
                style={S.modalInput} autoFocus
                onKeyDown={e => {
                  if (e.key === "Enter") handlePauseOPD(pauseModal.doctor_id, pauseModal.session, pauseReason);
                }}
              />
              <div style={{ display:"flex", gap:12, marginTop:18 }}>
                <button
                  onClick={() => handlePauseOPD(pauseModal.doctor_id, pauseModal.session, pauseReason)}
                  disabled={!!acting}
                  style={{ ...S.btnPrimary, flex:1, padding:"12px", background:"linear-gradient(90deg,#f59e0b,#d97706)" }}>
                  {acting ? "Pausing..." : "⏸ Pause OPD"}
                </button>
                <button onClick={() => { setPauseModal(null); setPauseReason(""); }} disabled={!!acting}
                  style={{ ...S.btnGhost, flex:1 }}>
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
        input:focus, select:focus, textarea:focus {
          border-color: #1b6ca8 !important;
          box-shadow: 0 0 0 3px rgba(27,108,168,0.15) !important;
          outline: none;
          background: #fff !important;
        }
      `}</style>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
const Spinner = () => (
  <div style={{ textAlign:"center", padding:60 }}>
    <div style={{ width:36, height:36, borderRadius:"50%", border:"3px solid rgba(255,255,255,0.3)",
      borderTopColor:"#fff", animation:"spin 0.8s linear infinite", margin:"0 auto" }} />
    <p style={{ color:"rgba(255,255,255,0.7)", marginTop:14, fontFamily:"'DM Sans',sans-serif" }}>Loading...</p>
  </div>
);

const Empty = ({ text, icon="📋" }) => (
  <div style={{ textAlign:"center", padding:"60px 40px", background:"rgba(255,255,255,0.95)",
    borderRadius:20, boxShadow:"0 8px 40px rgba(15,76,117,0.18)", border:"1px solid rgba(255,255,255,0.6)" }}>
    <div style={{ fontSize:48, marginBottom:12 }}>{icon}</div>
    <h4 style={{ color:"#1e293b", margin:0, fontFamily:"'DM Sans',sans-serif" }}>{text}</h4>
  </div>
);

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  // Layout
  page:         { minHeight:"100vh", background:"linear-gradient(135deg,#0f4c75 0%,#1b6ca8 50%,#118a7e 100%)", padding:"0 0 32px", display:"flex", flexDirection:"column", alignItems:"center", gap:0, fontFamily:"'DM Sans',sans-serif", position:"relative", overflow:"hidden" },
  bgCircle1:    { position:"fixed", width:500, height:500, borderRadius:"50%", background:"rgba(255,255,255,0.04)", top:-100, right:-100, pointerEvents:"none", zIndex:0 },
  bgCircle2:    { position:"fixed", width:320, height:320, borderRadius:"50%", background:"rgba(255,255,255,0.04)", bottom:20, left:-80, pointerEvents:"none", zIndex:0 },

  // Top bar
  topBar:       { width:"100%", background:"rgba(255,255,255,0.07)", backdropFilter:"blur(12px)", padding:"16px 28px", display:"flex", alignItems:"center", gap:14, borderBottom:"1px solid rgba(255,255,255,0.12)", position:"relative", zIndex:1 },
  portalBadge:  { display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.12)", borderRadius:30, padding:"5px 14px" },
  greenDot:     { width:8, height:8, borderRadius:"50%", background:"#4ade80", display:"inline-block" },
  topTitle:     { margin:0, fontSize:18, fontWeight:800, color:"#fff", fontFamily:"'DM Sans',sans-serif" },
  topSub:       { margin:0, fontSize:12, color:"#bae6fd", fontFamily:"'DM Sans',sans-serif" },

  // Tab bar
  tabBarWrap:   { width:"100%", background:"rgba(255,255,255,0.95)", backdropFilter:"blur(12px)", borderBottom:"1px solid rgba(255,255,255,0.3)", boxShadow:"0 2px 12px rgba(15,76,117,0.12)", position:"relative", zIndex:1 },
  tabBar:       { maxWidth:1100, margin:"0 auto", display:"flex", gap:4, padding:"8px 16px" },
  tabBtn:       { flex:1, padding:"11px 8px", border:"none", cursor:"pointer", fontSize:13, transition:"all 0.2s", borderRadius:10, fontFamily:"'DM Sans',sans-serif" },
  notifBadge:   { display:"inline-flex", alignItems:"center", justifyContent:"center", background:"#ef4444", color:"#fff", borderRadius:"50%", width:18, height:18, fontSize:11, fontWeight:700, marginLeft:6 },

  // Content
  tabContent:   { width:"100%", maxWidth:1100, padding:"24px 20px 0", position:"relative", zIndex:1 },
  sectionHeader:{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 },
  sectionTitle: { margin:"0 0 14px", color:"#fff", fontSize:16, fontWeight:800, fontFamily:"'DM Sans',sans-serif" },

  // Cards
  card:         { background:"rgba(255,255,255,0.97)", borderRadius:20, boxShadow:"0 8px 40px rgba(15,76,117,0.18)", overflow:"hidden", border:"1px solid rgba(255,255,255,0.6)", marginBottom:16 },
  cardHeader:   { background:"linear-gradient(135deg,#0f4c75 0%,#1b6ca8 60%,#118a7e 100%)", padding:"16px 22px", display:"flex", alignItems:"center" },
  avatar:       { width:42, height:42, borderRadius:"50%", background:"rgba(255,255,255,0.2)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:18, flexShrink:0, backdropFilter:"blur(4px)" },
  sessionBlock: { background:"#f8fafc", borderRadius:14, padding:"14px 16px", border:"1.5px solid #e2e8f0" },
  sessionOPDHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 },
  formCard:     { background:"rgba(255,255,255,0.97)", borderRadius:20, padding:"22px 24px", boxShadow:"0 8px 40px rgba(15,76,117,0.18)", border:"1px solid rgba(255,255,255,0.6)", marginBottom:8 },
  leaveGrid:    { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12 },
  statCard:     { background:"rgba(255,255,255,0.97)", borderRadius:14, padding:"14px", textAlign:"center", boxShadow:"0 2px 12px rgba(15,76,117,0.1)" },

  // Banners
  leaveBanner:  { background:"#fef3c7", border:"1px solid #fcd34d", borderRadius:10, padding:"8px 14px", marginBottom:10, display:"flex", alignItems:"center", gap:10, color:"#92400e", fontSize:13, fontFamily:"'DM Sans',sans-serif" },
  pauseBanner:  { background:"#fffbeb", border:"1px solid #fde68a", borderRadius:10, padding:"8px 14px", marginBottom:10, display:"flex", alignItems:"center", gap:10, color:"#92400e", fontSize:13, fontFamily:"'DM Sans',sans-serif" },
  pill:         { padding:"4px 14px", borderRadius:20, fontSize:12, fontWeight:700, fontFamily:"'DM Sans',sans-serif" },

  // Buttons
  btnPrimary:   { background:"linear-gradient(90deg,#0f4c75,#118a7e)", color:"#fff", border:"none", borderRadius:12, padding:"10px 22px", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 4px 20px rgba(15,76,117,0.3)" },
  btnDanger:    { background:"#fef2f2", color:"#dc2626", border:"1.5px solid #fca5a5", borderRadius:12, padding:"10px 22px", fontWeight:700, fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  btnRefresh:   { background:"rgba(255,255,255,0.18)", color:"#fff", border:"1px solid rgba(255,255,255,0.35)", borderRadius:10, padding:"9px 18px", fontWeight:600, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", backdropFilter:"blur(4px)" },
  btnStart:     { background:"linear-gradient(90deg,#059669,#047857)", color:"#fff", border:"none", borderRadius:10, padding:"8px 18px", fontWeight:700, fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", boxShadow:"0 2px 8px rgba(5,150,105,0.3)", whiteSpace:"nowrap" },
  btnWalkin:    { background:"linear-gradient(90deg,#0f4c75,#1b6ca8)", color:"#fff", border:"none", borderRadius:10, padding:"8px 16px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" },
  btnSmall:     { border:"none", borderRadius:10, padding:"7px 14px", fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" },
  btnGhost:     { background:"#f1f5f9", color:"#475569", border:"1.5px solid #e2e8f0", borderRadius:12, padding:"12px", fontWeight:600, fontSize:14, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },

  // Action buttons (table)
  actionBtnGreen:  { background:"#d1fae5", color:"#065f46", border:"none", borderRadius:8, padding:"4px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  actionBtnRed:    { background:"#fee2e2", color:"#991b1b", border:"none", borderRadius:8, padding:"4px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  actionBtnBlue:   { background:"#dbeafe", color:"#1d4ed8", border:"none", borderRadius:8, padding:"4px 10px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  actionBtnPurple: { background:"#ede9fe", color:"#5b21b6", border:"none", borderRadius:8, padding:"4px 12px", fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  actionBtnGrey:   { background:"#f1f5f9", color:"#475569", border:"none", borderRadius:8, padding:"4px 12px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },

  // Table
  table:        { width:"100%", borderCollapse:"collapse", fontSize:13, background:"#fff", borderRadius:12, overflow:"hidden" },
  th:           { padding:"10px 14px", textAlign:"left", fontSize:11, color:"#94a3b8", fontWeight:700, borderBottom:"1px solid #e2e8f0", whiteSpace:"nowrap", fontFamily:"'DM Sans',sans-serif", letterSpacing:0.4 },
  td:           { padding:"10px 14px", borderBottom:"1px solid #f1f5f9", verticalAlign:"middle" },

  // Inputs
  input:        { border:"1.5px solid #e2e8f0", borderRadius:10, padding:"9px 13px", fontSize:13, background:"#f8fafc", outline:"none", fontFamily:"'DM Sans',sans-serif", color:"#0f172a" },
  filterLabel:  { display:"block", fontSize:11, fontWeight:700, color:"rgba(255,255,255,0.8)", marginBottom:4, letterSpacing:0.5, fontFamily:"'DM Sans',sans-serif" },

  // Modal
  overlay:      { position:"fixed", inset:0, background:"rgba(15,76,117,0.55)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 },
  modal:        { background:"#fff", borderRadius:24, width:"100%", maxWidth:460, boxShadow:"0 20px 60px rgba(15,76,117,0.3)", maxHeight:"90vh", overflowY:"auto", overflow:"hidden" },
  modalHeader:  { background:"linear-gradient(135deg,#0f4c75 0%,#1b6ca8 60%,#118a7e 100%)", padding:"22px 28px 20px" },
  modalLabel:   { display:"block", fontSize:11, fontWeight:700, color:"#475569", marginBottom:6, letterSpacing:0.8, fontFamily:"'DM Sans',sans-serif" },
  modalInput:   { width:"100%", border:"1.5px solid #e2e8f0", borderRadius:12, padding:"10px 14px", fontSize:14, outline:"none", boxSizing:"border-box", background:"#f8fafc", fontFamily:"'DM Sans',sans-serif", color:"#0f172a" },
};

export default OpDashboard;
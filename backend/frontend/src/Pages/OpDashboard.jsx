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
  // [NEW]
  applyDoctorLeave, cancelDoctorLeave, getDoctorLeaves,
} from "../services/allApi";

// [NEW] "Doctor Leave" tab added
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
    SESSIONS.forEach(sess => {
      result[sess] = doc.opd_status[sess]?.is_active ?? false;
    });
    return result;
  }
  if (typeof doc.opd_status.is_active === "boolean") {
    result.morning = doc.opd_status.is_active;
    return result;
  }
  return result;
}

// [NEW] Extract leave state per session from doc.opd_status
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

// ─────────────────────────────────────────────────────────────────────────────
function OPDDashboard() {
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
  const [docPauseState, setDocPauseState] = useState({});

  const [optimisticActive, setOptimisticActive] = useState({});

  // ── [NEW] Leave tab state ──
  const [leaveDoctor,  setLeaveDoctor]  = useState("");
  const [leaveDate,    setLeaveDate]    = useState(today);
  const [leaveSession, setLeaveSession] = useState("all");
  const [leaveReason,  setLeaveReason]  = useState("");
  const [leaves,       setLeaves]       = useState([]);
  const [leavesLoading,setLeavesLoading]= useState(false);
  const [leaveBusy,    setLeaveBusy]    = useState(false);

  // ══════════════════════════════════════════════════
  // TAB 1 — OPD MANAGEMENT
  // ══════════════════════════════════════════════════

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

  useEffect(() => {
    if (activeTab === 0) fetchDashboard();
  }, [activeTab, fetchDashboard]);

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
        [doctor.doctor_id]: {
          ...(prev[doctor.doctor_id] || { morning: false, evening: false }),
          [session]: true,
        },
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
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to pause OPD");
    } finally { setActing(null); setPauseModal(null); }
  };

  const handleApprove = async (id) => {
    setActing(id + "_approve");
    try {
      await approveBooking(id);
      toast.success("Token moved to consulting");
      fetchDashboard();
    } catch (err) { toast.error(err.response?.data?.error || "Approve failed"); }
    finally { setActing(null); }
  };

  const handleReject = async (id) => {
    if (!window.confirm("Reject this token?")) return;
    setActing(id + "_reject");
    try {
      await rejectStaffBooking(id);
      toast.warning("Token rejected");
      fetchDashboard();
    } catch (err) { toast.error(err.response?.data?.error || "Reject failed"); }
    finally { setActing(null); }
  };

  const handleResendNotification = async (id) => {
    setActing(id + "_resend");
    try {
      const res = await resendOPDNotification(id);
      toast.success(`📧 ${res.data.message}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to resend notification");
    } finally { setActing(null); }
  };

  const handleStaffConfirm = async (id, tokenNum) => {
    setActing(id + "_confirm");
    try {
      await staffConfirmAttendance(id);
      toast.success(`✅ Token #${tokenNum} confirmed`);
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.error || "Confirm failed");
    } finally { setActing(null); }
  };

  // ══════════════════════════════════════════════════
  // TAB 2 — [NEW] DOCTOR LEAVE (staff manages)
  // ══════════════════════════════════════════════════

  const fetchLeaves = useCallback(async () => {
    setLeavesLoading(true);
    try {
      const res = await getDoctorLeaves();
      setLeaves(res.data || []);
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      if (err.response?.status === 403) {
        toast.error("Only OPD staff can manage doctor leaves");
      } else {
        toast.error("Failed to load leaves");
      }
    } finally { setLeavesLoading(false); }
  }, [navigate]);

  useEffect(() => {
    if (activeTab === 1) {
      fetchLeaves();
      // Also load doctor list for the dropdown
      getApprovedDoctors().then(r => setAllDoctors(r.data)).catch(() => {});
    }
  }, [activeTab, fetchLeaves]);

  const handleApplyLeave = async () => {
    if (!leaveDoctor)  { toast.error("Please select a doctor"); return; }
    if (!leaveDate)    { toast.error("Please pick a date");     return; }
    if (!leaveSession) { toast.error("Please choose a session"); return; }

    setLeaveBusy(true);
    try {
      const res = await applyDoctorLeave({
        doctor_id: Number(leaveDoctor),
        date:      leaveDate,
        session:   leaveSession,
        reason:    leaveReason.trim() || undefined,
      });
      toast.success(res.data.message || "Leave applied");
      if (res.data.cancelled_bookings > 0) {
        toast.info(`${res.data.cancelled_bookings} existing booking(s) cancelled · ${res.data.notified} patient(s) notified`);
      }
      // Reset form
      setLeaveDoctor(""); setLeaveReason(""); setLeaveSession("all");
      fetchLeaves();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to apply leave");
    } finally { setLeaveBusy(false); }
  };

  const handleCancelLeave = async (leave) => {
    if (!window.confirm(
      `Cancel leave for Dr. ${leave.doctor_name} on ${leave.date} (${leave.session})?\n\n` +
      `Bookings will re-open but cancelled bookings are NOT auto-restored.`
    )) return;
    setActing(leave.id + "_lcancel");
    try {
      await cancelDoctorLeave({
        doctor_id: leave.doctor_id,
        date:      leave.date,
        session:   leave.session,
      });
      toast.success("Leave cancelled");
      fetchLeaves();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to cancel leave");
    } finally { setActing(null); }
  };

  // ══════════════════════════════════════════════════
  // TAB 3 — DOCTOR APPROVALS
  // ══════════════════════════════════════════════════

  const fetchPendingDoctors = useCallback(async () => {
    setDocsLoading(true);
    try {
      const res = await getPendingDoctors();
      setPendingDocs(res.data);
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      toast.error("Failed to load pending doctors");
    } finally { setDocsLoading(false); }
  }, [navigate]);

  useEffect(() => {
    if (activeTab === 2) fetchPendingDoctors();
  }, [activeTab, fetchPendingDoctors]);

  const handleApproveDoctor = async (id, name) => {
    setActing(id + "_dapprove");
    try {
      await approveDoctor(id);
      toast.success(`✅ Dr. ${name} approved!`);
      fetchPendingDoctors();
    } catch (err) { toast.error(err.response?.data?.error || "Approval failed"); }
    finally { setActing(null); }
  };

  const handleRejectDoctor = async (id, name) => {
    if (!window.confirm(`Reject Dr. ${name}? This will permanently delete their registration.`)) return;
    setActing(id + "_dreject");
    try {
      await rejectDoctor(id);
      toast.warning(`Dr. ${name}'s registration rejected`);
      fetchPendingDoctors();
    } catch (err) { toast.error(err.response?.data?.error || "Rejection failed"); }
    finally { setActing(null); }
  };

  // ══════════════════════════════════════════════════
  // TAB 4 — CONSULTATION HISTORY
  // ══════════════════════════════════════════════════

  const fetchHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await getConsultationHistory(histDate, histDoctor, histType);
      setHistory(res.data);
    } catch { toast.error("Failed to load consultation history"); }
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
  // [NEW] hours + minutes display
  const avgDisplay    = (() => {
    const m = Math.round(avgMin);
    if (m === 0) return "0m";
    const h = Math.floor(m / 60), mm = m % 60;
    return h ? (mm ? `${h}h ${mm}m` : `${h}h`) : `${mm}m`;
  })();
  const onlineCount   = history.filter(h => h.patient_type === "online").length;
  const walkinCount   = history.filter(h => h.patient_type === "walkin").length;

  // ══════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════

  return (
    <div style={S.page}>

      <div style={S.header}>
        <div>
          <h2 style={S.title}>🏥 OPD Staff Dashboard</h2>
          <p style={{ color:"#94a3b8", margin:0, fontSize:13 }}>Manage OPD sessions, doctor leaves, approvals, and history</p>
        </div>
      </div>

      <div style={S.tabBar}>
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)} style={{
            ...S.tabBtn,
            borderBottom: activeTab===i ? "3px solid #0f4c75" : "3px solid transparent",
            color:        activeTab===i ? "#0f4c75" : "#64748b",
            fontWeight:   activeTab===i ? 700 : 500,
          }}>
            {tab === "OPD Management"       && "🗂 "}
            {tab === "Doctor Leave"         && "🛌 "}
            {tab === "Doctor Approvals"     && "👨‍⚕️ "}
            {tab === "Consultation History" && "📋 "}
            {tab}
            {tab === "Doctor Approvals" && pendingDocs.length > 0 && (
              <span style={S.badge}>{pendingDocs.length}</span>
            )}
            {tab === "Doctor Leave" && leaves.length > 0 && (
              <span style={{ ...S.badge, background:"#f59e0b" }}>{leaves.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          TAB 1 — OPD MANAGEMENT
      ══════════════════════════════════════════ */}
      {activeTab === 0 && (
        <div style={S.tabContent}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16, flexWrap:"wrap", gap:10 }}>
            <h3 style={{ margin:0, color:"#0f4c75", fontSize:16 }}>OPD Sessions — {date}</h3>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <label style={{ fontSize:12, fontWeight:600, color:"#64748b" }}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} style={S.input} />
            </div>
          </div>

          {loading ? <Spinner /> : doctors.length === 0 ? (
            <Empty text={`No doctors for ${date}`} />
          ) : doctors.map(doc => {
            const leaveState = extractDocSessionLeave(doc);
            return (
              <div key={doc.doctor_id} style={S.doctorCard}>
                <div style={S.doctorHeader}>
                  <div>
                    <h3 style={{ margin:0, color:"#fff", fontSize:16 }}>{doc.doctor_name}</h3>
                    <p style={{ margin:"4px 0 0", color:"#bfdbfe", fontSize:13 }}>
                      {doc.hospital} · {doc.department}
                    </p>
                  </div>
                </div>

                <div style={{ padding:"16px 20px", display:"flex", flexDirection:"column", gap:16 }}>
                  {SESSIONS.map(sess => {
                    const sessData  = doc.sessions?.[sess] || { online:[], walkin:[], total_booked:0 };
                    const allTokens = [...(sessData.online||[]), ...(sessData.walkin||[])]
                      .sort((a, b) => a.token - b.token);

                    const sessTokenMap = {};
                    SESSIONS.forEach(s => {
                      const sd = doc.sessions?.[s] || { online:[], walkin:[] };
                      sessTokenMap[s] = [...(sd.online||[]), ...(sd.walkin||[])];
                    });
                    const backendActive = extractDocSessionActive(doc, sessTokenMap);
                    const optimistic    = optimisticActive[doc.doctor_id];

                    const sessOpdActive =
                      optimistic?.[sess] !== undefined
                        ? optimistic[sess]
                        : backendActive[sess];

                    const sessLeave  = leaveState[sess];
                    const startKey   = `${doc.doctor_id}_${sess}_start`;
                    const isStarting = acting === startKey;

                    return (
                      <div key={sess} style={S.sessionBlock}>

                        {/* [NEW] Leave banner */}
                        {sessLeave?.on_leave && (
                          <div style={S.leaveBanner}>
                            <span style={{ fontSize:16 }}>🛌</span>
                            <div style={{ flex:1 }}>
                              <b>On Leave</b>
                              {sessLeave.reason && <span style={{ marginLeft:6, fontSize:12, color:"#92400e" }}>
                                · {sessLeave.reason}
                              </span>}
                            </div>
                            <span style={{ fontSize:11, color:"#92400e", fontWeight:600 }}>
                              Bookings frozen
                            </span>
                          </div>
                        )}

                        <div style={S.sessionOPDHeader}>
                          <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                            <h4 style={{ margin:0, color:"#0f4c75", fontSize:14 }}>
                              {sess === "morning" ? "🌅" : "🌆"}{" "}
                              {sess.charAt(0).toUpperCase() + sess.slice(1)} Session OPD
                            </h4>
                            <span style={{
                              fontSize:11, padding:"2px 10px", borderRadius:10, fontWeight:600,
                              background: allTokens.length > 0 ? "#dbeafe" : "#f1f5f9",
                              color:      allTokens.length > 0 ? "#1d4ed8" : "#94a3b8",
                            }}>
                              {allTokens.length} booked
                            </span>
                            {allTokens.length > 0 && (
                              <span style={{ fontSize:11, color:"#94a3b8" }}>
                                ({sessData.online?.length||0} online · {sessData.walkin?.length||0} walk-in)
                              </span>
                            )}
                          </div>

                          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                            {sessOpdActive ? (
                              <>
                                <span style={{ ...S.pill, background:"#d1fae5", color:"#065f46" }}>
                                  🟢 OPD Active
                                </span>
                                <button onClick={() => setPauseModal({ doctor_id: doc.doctor_id, session: sess, action: 'pause' })} style={{...S.walkinBtn, background:"#fbbf24", color:"#92400e"}}>
                                  ⏸ Pause
                                </button>
                              </>
                            ) : sessLeave?.on_leave ? (
                              <button
                                disabled
                                style={{ ...S.startOPDBtn, background:"#94a3b8", cursor:"not-allowed" }}
                                title="Cancel the leave first">
                                ▶ Start OPD
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStartOPD(doc, sess)}
                                disabled={!!acting}
                                style={S.startOPDBtn}>
                                {isStarting ? "Starting..." : "▶ Start OPD"}
                              </button>
                            )}
                            {!sessLeave?.on_leave && (
                              <button onClick={() => openWalkin(doc, sess)} style={S.walkinBtn}>
                                + Walk-in
                              </button>
                            )}
                          </div>
                        </div>

                        {allTokens.length === 0 ? (
                          <div style={{ textAlign:"center", padding:"18px", color:"#94a3b8", fontSize:13,
                            background:"#fff", borderRadius:8, border:"1px dashed #e2e8f0", marginTop:10 }}>
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
                                    background: t.status==="consulting" ? "#ecfdf5"
                                              : t.status==="done"       ? "#f8fafc" : "#fff",
                                  }}>
                                    <td style={S.td}><b style={{ color:"#0f4c75" }}>#{t.token}</b></td>
                                    <td style={S.td}>{t.patient_name}</td>
                                    <td style={S.td}>
                                      <span style={{
                                        fontSize:11, padding:"2px 8px", borderRadius:10,
                                        background: t.type==="online" ? "#dbeafe" : "#f3f4f6",
                                        color:      t.type==="online" ? "#1d4ed8" : "#6b7280",
                                      }}>{t.type}</span>
                                    </td>
                                    <td style={S.td}>
                                      <span style={{
                                        fontSize:11, padding:"2px 8px", borderRadius:10,
                                        background: STATUS_BG[t.status]||"#f1f5f9",
                                        color:      STATUS_FG[t.status]||"#475569",
                                        fontWeight: 600,
                                      }}>{t.status}</span>
                                    </td>
                                    <td style={S.td}>
                                      <span style={{ fontSize:12, color:PAY_COLOR[t.payment]||"#475569", fontWeight:600 }}>
                                        {t.payment}
                                      </span>
                                    </td>
                                    <td style={S.td}>
                                      {t.is_confirmed
                                        ? <span style={{ color:"#10b981", fontWeight:700 }}>✅ Yes</span>
                                        : <span style={{ color:"#f59e0b", fontWeight:700 }}>⏳ No</span>}
                                    </td>
                                    <td style={S.td}>
                                      <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                                        {!t.is_confirmed && t.type==="online" &&
                                          ["pending","waiting"].includes(t.status) && (
                                          <button
                                            onClick={() => handleStaffConfirm(t.id, t.token)}
                                            disabled={!!acting} style={S.confirmBtn}
                                            title="Manually confirm attendance">
                                            {acting===t.id+"_confirm" ? "..." : "✔ Confirm"}
                                          </button>
                                        )}
                                        {t.status==="waiting" && sessOpdActive && (
                                          <>
                                            <button onClick={() => handleApprove(t.id)}
                                              disabled={!!acting} style={S.approveBtn}
                                              title="Move to consulting">
                                              {acting===t.id+"_approve" ? "..." : "▶ Call"}
                                            </button>
                                            <button onClick={() => handleReject(t.id)}
                                              disabled={!!acting} style={S.rejectBtn}
                                              title="Reject token">
                                              {acting===t.id+"_reject" ? "..." : "✗"}
                                            </button>
                                          </>
                                        )}
                                        {!t.is_confirmed && t.type==="online" &&
                                          ["pending","waiting"].includes(t.status) && (
                                          <button
                                            onClick={() => handleResendNotification(t.id)}
                                            disabled={!!acting} style={S.resendBtn}
                                            title="Resend OPD notification email">
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
          TAB 2 — [NEW] DOCTOR LEAVE MANAGEMENT
      ══════════════════════════════════════════ */}
      {activeTab === 1 && (
        <div style={S.tabContent}>
          <h3 style={{ margin:"0 0 12px", color:"#0f4c75", fontSize:16 }}>
            🛌 Apply Leave for a Doctor
          </h3>

          <div style={S.leaveCard}>
            <div style={S.leaveGrid}>
              <div>
                <label style={S.filterLabel}>Doctor *</label>
                <select value={leaveDoctor}
                  onChange={e => setLeaveDoctor(e.target.value)}
                  style={{ ...S.input, width:"100%" }}>
                  <option value="">— Select Doctor —</option>
                  {allDoctors.map(d => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.name || d.full_name} · {d.department}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={S.filterLabel}>Date *</label>
                <input type="date" value={leaveDate} min={today}
                  onChange={e => setLeaveDate(e.target.value)}
                  style={{ ...S.input, width:"100%" }} />
                <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>
                  Only today / tomorrow / day-after allowed
                </div>
              </div>
              <div>
                <label style={S.filterLabel}>Session *</label>
                <select value={leaveSession}
                  onChange={e => setLeaveSession(e.target.value)}
                  style={{ ...S.input, width:"100%" }}>
                  <option value="all">Full Day (both sessions)</option>
                  <option value="morning">Morning only</option>
                  <option value="evening">Evening only</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop:12 }}>
              <label style={S.filterLabel}>Reason (optional)</label>
              <input type="text" value={leaveReason}
                onChange={e => setLeaveReason(e.target.value)}
                placeholder="e.g. Medical conference, personal emergency"
                style={{ ...S.input, width:"100%" }} />
            </div>

            <div style={{ marginTop:14, display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
              <button
                onClick={handleApplyLeave}
                disabled={leaveBusy}
                style={{ ...S.greenBtn, padding:"10px 22px",
                  background: leaveBusy ? "#94a3b8" : "#059669", cursor: leaveBusy ? "not-allowed" : "pointer" }}>
                {leaveBusy ? "Applying..." : "🛌 Apply Leave"}
              </button>
              <button onClick={fetchLeaves} style={S.refreshBtn}>🔄 Refresh</button>
              <div style={{ fontSize:12, color:"#94a3b8", marginLeft:"auto" }}>
                ⚠ Existing bookings for the slot will be cancelled and patients notified by email.
              </div>
            </div>
          </div>

          {/* Active leaves list */}
          <h3 style={{ margin:"26px 0 12px", color:"#0f4c75", fontSize:16 }}>
            Active & Upcoming Leaves
          </h3>

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
                      <td style={S.td}><b style={{ color:"#0f4c75" }}>Dr. {l.doctor_name}</b></td>
                      <td style={S.td}>{l.hospital}</td>
                      <td style={S.td}>{l.department}</td>
                      <td style={S.td}>{l.date}</td>
                      <td style={S.td}>
                        <span style={{
                          fontSize:11, padding:"2px 10px", borderRadius:10, fontWeight:600,
                          background:"#fef3c7", color:"#92400e",
                        }}>
                          {l.session === "all" ? "🛌 Full Day" : l.session === "morning" ? "🌅 Morning" : "🌆 Evening"}
                        </span>
                      </td>
                      <td style={S.td}>{l.reason || "—"}</td>
                      <td style={S.td}>{l.applied_by || "—"}</td>
                      <td style={S.td}>
                        <button
                          onClick={() => handleCancelLeave(l)}
                          disabled={!!acting}
                          style={S.rejectBtn}
                          title="Cancel this leave">
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
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <h3 style={{ margin:0, color:"#0f4c75", fontSize:16 }}>👨‍⚕️ Pending Doctor Registrations</h3>
            <button onClick={fetchPendingDoctors} style={S.refreshBtn}>🔄 Refresh</button>
          </div>

          {docsLoading ? <Spinner /> : pendingDocs.length === 0 ? (
            <Empty text="No pending doctor registrations" icon="✅" />
          ) : (
            <div style={{ display:"grid", gap:14 }}>
              {pendingDocs.map(doc => (
                <div key={doc.id} style={S.docCard}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:6 }}>
                        <div style={S.avatar}>{(doc.name||"D")[0].toUpperCase()}</div>
                        <div>
                          <div style={{ fontWeight:700, fontSize:16, color:"#0f4c75" }}>Dr. {doc.name}</div>
                          <div style={{ fontSize:13, color:"#64748b" }}>{doc.email}</div>
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:16, fontSize:13, color:"#475569", marginLeft:46 }}>
                        <span>🏥 {doc.hospital}</span>
                        <span>🏷 {doc.department}</span>
                        <span>📅 {new Date(doc.joined).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:10 }}>
                      <button onClick={() => handleApproveDoctor(doc.id, doc.name)}
                        disabled={!!acting}
                        style={{ ...S.greenBtn, padding:"10px 20px", fontSize:14 }}>
                        {acting===doc.id+"_dapprove" ? "Approving..." : "✅ Approve"}
                      </button>
                      <button onClick={() => handleRejectDoctor(doc.id, doc.name)}
                        disabled={!!acting}
                        style={{ ...S.dangerBtn, padding:"10px 20px", fontSize:14 }}>
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
              <input type="date" value={histDate}
                onChange={e => setHistDate(e.target.value)} style={S.input} />
            </div>
            <div>
              <label style={S.filterLabel}>Doctor</label>
              <select value={histDoctor} onChange={e => setHistDoctor(e.target.value)} style={S.input}>
                <option value="">All Doctors</option>
                {allDoctors.map(d => (
                  <option key={d.id} value={d.id}>{d.name || d.full_name}</option>
                ))}
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
            <button onClick={fetchHistory} style={{ ...S.greenBtn, padding:"9px 18px" }}>
              🔍 Search
            </button>
          </div>

          {history.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:12, marginBottom:20 }}>
              {[
                { label:"Total",        val: history.length,    icon:"📋", color:"#0f4c75" },
                { label:"Morning",      val: history.filter(h=>h.session==="morning").length, icon:"🌅", color:"#6366f1" },
                { label:"Evening",      val: history.filter(h=>h.session==="evening").length, icon:"🌆", color:"#f59e0b" },
                { label:"Online",       val: onlineCount,       icon:"🌐", color:"#1d4ed8" },
                { label:"Walk-in",      val: walkinCount,       icon:"🚶", color:"#059669" },
                // [NEW] avg duration in hours + minutes
                { label:"Avg Duration", val: avgDisplay, icon:"⏱",  color:"#10b981" },
              ].map(s => (
                <div key={s.label} style={{ ...S.statCard, borderTop:`3px solid ${s.color}` }}>
                  <div style={{ fontSize:18 }}>{s.icon}</div>
                  <div style={{ fontWeight:800, fontSize:20, color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:11, color:"#94a3b8" }}>{s.label}</div>
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
                    <h4 style={{ margin:0, color:"#0f4c75", fontSize:15 }}>
                      {sess==="morning" ? "🌅" : "🌆"} {sess.charAt(0).toUpperCase()+sess.slice(1)} Session
                    </h4>
                    <span style={{
                      fontSize:11, padding:"2px 10px", borderRadius:10, fontWeight:600,
                      background: sessHistory.length > 0 ? "#dbeafe" : "#f1f5f9",
                      color:      sessHistory.length > 0 ? "#1d4ed8" : "#94a3b8",
                    }}>{sessHistory.length} consultations</span>
                  </div>

                  {sessHistory.length === 0 ? (
                    <div style={{ padding:"16px", color:"#94a3b8", fontSize:13,
                      background:"#f8fafc", borderRadius:10, border:"1px dashed #e2e8f0",
                      textAlign:"center", marginBottom:8 }}>
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
                              <td style={S.td}><b style={{ color:"#0f4c75" }}>#{h.token}</b></td>
                              <td style={S.td}>
                                <span style={{ color: h.patient_type==="walkin" ? "#059669" : "#1e293b", fontWeight:500 }}>
                                  {h.patient_name}
                                </span>
                              </td>
                              <td style={S.td}>
                                <span style={{
                                  fontSize:11, padding:"2px 8px", borderRadius:10, fontWeight:600,
                                  background: h.patient_type==="online" ? "#dbeafe" : "#dcfce7",
                                  color:      h.patient_type==="online" ? "#1d4ed8" : "#166534",
                                }}>
                                  {h.patient_type==="walkin" ? "🚶 Walk-in" : "🌐 Online"}
                                </span>
                              </td>
                              <td style={S.td}>{h.doctor_name}</td>
                              <td style={S.td}>{h.department}</td>
                              <td style={S.td}>{h.booking_date}</td>
                              <td style={S.td}>
                                {h.consulting_started_at
                                  ? new Date(h.consulting_started_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})
                                  : "—"}
                              </td>
                              <td style={S.td}>
                                {h.consulting_ended_at
                                  ? new Date(h.consulting_ended_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})
                                  : "—"}
                              </td>
                              <td style={S.td}>
                                {/* [NEW] Prefer hours+minutes display from backend */}
                                {h.duration?.display
                                  ? <span style={{ color:"#059669", fontWeight:600 }}>{h.duration.display}</span>
                                  : (h.duration_minutes != null
                                      ? <span style={{ color:"#059669", fontWeight:600 }}>{h.duration_minutes.toFixed(1)} min</span>
                                      : "—")}
                              </td>
                              <td style={S.td}>
                                <span style={{ fontSize:12, color:PAY_COLOR[h.payment_status]||"#475569", fontWeight:600 }}>
                                  {h.payment_status}
                                </span>
                              </td>
                              <td style={S.td}>
                                <button onClick={() => setDetailModal(h)} style={S.detailBtn} title="View patient details">
                                  👁 View
                                </button>
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

      {/* Walk-in Booking Modal */}
      {walkinModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h3 style={{ margin:0, color:"#0f4c75" }}>Walk-in Token Booking</h3>
              <button onClick={() => setWalkinModal(null)}
                style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#94a3b8" }}>✕</button>
            </div>
            <div style={{ background:"#f8fafc", borderRadius:10, padding:"12px 14px", marginBottom:18, fontSize:13 }}>
              <div><b>Doctor:</b> {walkinModal.doctor.doctor_name}</div>
              <div><b>Session:</b> {walkinModal.session} · <b>Date:</b> {date}</div>
            </div>
            <div style={{ marginBottom:14 }}>
              <label style={S.label}>Patient Name *</label>
              <input value={walkinName} onChange={e => setWalkinName(e.target.value)}
                placeholder="Enter full name" style={S.modalInput} />
            </div>
            <div style={{ marginBottom:20 }}>
              <label style={S.label}>Walk-in Token Number *</label>
              {availTokens.length > 0 ? (
                <select value={walkinToken} onChange={e => setWalkinToken(e.target.value)} style={S.modalInput}>
                  <option value="">— Select token —</option>
                  {availTokens.map(t => <option key={t} value={t}>Token #{t}</option>)}
                </select>
              ) : (
                <div style={{ color:"#ef4444", fontSize:13 }}>❌ No walk-in tokens available</div>
              )}
              <div style={{ fontSize:11, color:"#94a3b8", marginTop:4 }}>Walk-in range: 1–15 and 36–60</div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={handleWalkin} disabled={bookingWalkin || availTokens.length===0}
                style={{ ...S.greenBtn, flex:1, padding:"12px" }}>
                {bookingWalkin ? "Booking..." : "Book Walk-in Token"}
              </button>
              <button onClick={() => setWalkinModal(null)} style={{ ...S.ghostBtn, flex:1 }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Patient Detail Modal */}
      {detailModal && (
        <div style={S.overlay}>
          <div style={{ ...S.modal, maxWidth:480 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h3 style={{ margin:0, color:"#0f4c75" }}>
                {detailModal.patient_type==="walkin" ? "🚶 Walk-in" : "🌐 Online"} Patient Details
              </h3>
              <button onClick={() => setDetailModal(null)}
                style={{ background:"none", border:"none", fontSize:20, cursor:"pointer", color:"#94a3b8" }}>✕</button>
            </div>

            <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:16 }}>
              <span style={{ background:"#0f4c75", color:"#fff", borderRadius:8, padding:"6px 14px", fontWeight:700, fontSize:18 }}>
                #{detailModal.token}
              </span>
              <span style={{
                fontSize:12, padding:"4px 12px", borderRadius:20, fontWeight:600,
                background: detailModal.patient_type==="online" ? "#dbeafe" : "#dcfce7",
                color:      detailModal.patient_type==="online" ? "#1d4ed8" : "#166534",
              }}>
                {detailModal.patient_type==="walkin" ? "Walk-in Patient" : "Online Booking"}
              </span>
            </div>

            <div style={{ background:"#f8fafc", borderRadius:10, padding:"14px 16px", marginBottom:14 }}>
              <div style={{ fontSize:12, color:"#94a3b8", marginBottom:2 }}>Patient Name</div>
              <div style={{ fontWeight:700, fontSize:16, color:"#1e293b", marginBottom:10 }}>
                {detailModal.patient_name}
              </div>
              {detailModal.patient_type === "online" && (
                <>
                  <div style={{ fontSize:12, color:"#94a3b8", marginBottom:2 }}>Email</div>
                  <div style={{ fontSize:14, color:"#1e293b", marginBottom:10 }}>
                    {detailModal.patient_email || "—"}
                  </div>
                </>
              )}
              {detailModal.patient_type === "walkin" && (
                <div style={{
                  background:"#dcfce7", borderRadius:8, padding:"8px 12px",
                  fontSize:12, color:"#166534", display:"flex", alignItems:"center", gap:6,
                }}>
                  🚶 Walk-in patients are registered at the counter — no account linked.
                </div>
              )}
            </div>

            <div style={{ background:"#f8fafc", borderRadius:10, padding:"14px 16px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, fontSize:13 }}>
                {[
                  ["Doctor",   detailModal.doctor_name],
                  ["Hospital", detailModal.hospital],
                  ["Dept",     detailModal.department],
                  ["Date",     detailModal.booking_date],
                  ["Session",  detailModal.session],
                  ["Payment",  detailModal.payment_status],
                  ["Started",  detailModal.consulting_started_at
                                ? new Date(detailModal.consulting_started_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})
                                : "—"],
                  ["Ended",    detailModal.consulting_ended_at
                                ? new Date(detailModal.consulting_ended_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})
                                : "—"],
                  // [NEW] hours + minutes display
                  ["Duration", detailModal.duration?.display
                                ? detailModal.duration.display
                                : (detailModal.duration_minutes != null
                                    ? `${detailModal.duration_minutes.toFixed(1)} min` : "—")],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize:11, color:"#94a3b8" }}>{label}</div>
                    <div style={{ fontWeight:600, color:"#1e293b" }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => setDetailModal(null)}
              style={{ ...S.ghostBtn, width:"100%", marginTop:16 }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* Pause OPD Modal */}
      {pauseModal && (
        <div style={S.overlay}>
          <div style={S.modal}>
            <div style={{ fontSize:40, marginBottom:12, textAlign:"center" }}>⏸</div>
            <h3 style={{ textAlign:"center", color:"#0f4c75", margin:"0 0 8px" }}>
              Pause OPD?
            </h3>
            <p style={{ textAlign:"center", color:"#64748b", fontSize:14, margin:"0 0 16px" }}>
              The queue will be paused. Patients will see the pause status.
            </p>
            <input
              type="text"
              placeholder="Reason for pause (optional)"
              style={{ width:"100%", padding:"10px", marginBottom:"16px", border:"1px solid #e2e8f0", borderRadius:"6px", fontSize:"14px", boxSizing:"border-box" }}
              id="opPauseReason"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const reason = document.getElementById("opPauseReason").value;
                  handlePauseOPD(pauseModal.doctor_id, pauseModal.session, reason);
                }
              }}
            />
            <div style={{ display:"flex", gap:12 }}>
              <button
                onClick={() => {
                  const reason = document.getElementById("opPauseReason").value;
                  handlePauseOPD(pauseModal.doctor_id, pauseModal.session, reason);
                }}
                style={{ ...S.startOPDBtn, flex:1, padding:"12px", fontSize:15, background:"#fbbf24", color:"#92400e" }}>
                Pause OPD
              </button>
              <button
                onClick={() => setPauseModal(null)}
                style={{ flex:1, padding:"12px", border:"none", borderRadius:8,
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

const Spinner = () => (
  <div style={{ textAlign:"center", padding:60 }}>
    <div style={{ width:36, height:36, borderRadius:"50%", border:"3px solid #e2e8f0",
      borderTopColor:"#0f4c75", animation:"spin 0.8s linear infinite", margin:"0 auto" }} />
    <p style={{ color:"#94a3b8", marginTop:14 }}>Loading...</p>
  </div>
);

const Empty = ({ text, icon="📋" }) => (
  <div style={{ textAlign:"center", padding:"60px 40px", background:"#fff",
    borderRadius:16, boxShadow:"0 2px 16px rgba(0,0,0,0.06)" }}>
    <div style={{ fontSize:48, marginBottom:12 }}>{icon}</div>
    <h4 style={{ color:"#1e293b", margin:0 }}>{text}</h4>
  </div>
);

const S = {
  page:             { minHeight:"100vh", background:"#f0f4f8", padding:"24px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:16 },
  header:           { width:"100%", maxWidth:1100, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 },
  title:            { fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:"#0f4c75", margin:0 },
  tabBar:           { width:"100%", maxWidth:1100, display:"flex", gap:0, background:"#fff", borderRadius:12, padding:"4px", boxShadow:"0 1px 8px rgba(0,0,0,0.06)" },
  tabBtn:           { flex:1, padding:"12px 8px", border:"none", background:"transparent", cursor:"pointer", fontSize:14, transition:"all 0.2s", borderRadius:8 },
  badge:            { display:"inline-flex", alignItems:"center", justifyContent:"center", background:"#ef4444", color:"#fff", borderRadius:"50%", width:18, height:18, fontSize:11, fontWeight:700, marginLeft:6 },
  tabContent:       { width:"100%", maxWidth:1100 },
  input:            { border:"1.5px solid #e2e8f0", borderRadius:8, padding:"8px 12px", fontSize:13, background:"#fff", outline:"none" },
  filterLabel:      { display:"block", fontSize:12, fontWeight:600, color:"#64748b", marginBottom:4 },
  doctorCard:       { background:"#fff", borderRadius:14, boxShadow:"0 2px 16px rgba(0,0,0,0.07)", overflow:"hidden", marginBottom:16 },
  doctorHeader:     { background:"linear-gradient(90deg,#0f4c75,#1b6ca8)", padding:"14px 20px" },
  sessionBlock:     { background:"#f8fafc", borderRadius:12, padding:"14px 16px", border:"1.5px solid #e2e8f0" },
  sessionOPDHeader: { display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 },
  startOPDBtn:      { background:"#059669", color:"#fff", border:"none", borderRadius:8, padding:"8px 18px", fontWeight:700, fontSize:13, cursor:"pointer", whiteSpace:"nowrap" },
  // [NEW]
  leaveBanner:      { background:"#fef3c7", border:"1px solid #fcd34d", borderRadius:8, padding:"8px 14px", marginBottom:10, display:"flex", alignItems:"center", gap:10, color:"#92400e", fontSize:13 },
  leaveCard:        { background:"#fff", borderRadius:14, padding:"20px 22px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #e2e8f0" },
  leaveGrid:        { display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(220px, 1fr))", gap:12 },

  docCard:          { background:"#fff", borderRadius:14, padding:"20px 24px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #e2e8f0" },
  avatar:           { width:38, height:38, borderRadius:"50%", background:"linear-gradient(135deg,#0f4c75,#118a7e)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:16, flexShrink:0 },
  statCard:         { background:"#fff", borderRadius:12, padding:"14px", textAlign:"center", boxShadow:"0 1px 8px rgba(0,0,0,0.05)" },
  pill:             { padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600 },
  table:            { width:"100%", borderCollapse:"collapse", fontSize:13, background:"#fff", borderRadius:10, overflow:"hidden" },
  th:               { padding:"10px 12px", textAlign:"left", fontSize:12, color:"#94a3b8", fontWeight:600, borderBottom:"1px solid #e2e8f0", whiteSpace:"nowrap" },
  td:               { padding:"10px 12px", borderBottom:"1px solid #f1f5f9", verticalAlign:"middle" },
  greenBtn:         { background:"#059669", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", fontWeight:600, fontSize:13, cursor:"pointer" },
  dangerBtn:        { background:"#fef2f2", color:"#dc2626", border:"1px solid #fca5a5", borderRadius:8, padding:"8px 16px", fontWeight:600, fontSize:13, cursor:"pointer" },
  refreshBtn:       { background:"#f1f5f9", color:"#475569", border:"none", borderRadius:8, padding:"8px 16px", fontWeight:600, fontSize:13, cursor:"pointer" },
  walkinBtn:        { background:"#0f4c75", color:"#fff", border:"none", borderRadius:8, padding:"7px 14px", fontSize:13, fontWeight:600, cursor:"pointer" },
  approveBtn:       { background:"#d1fae5", color:"#065f46", border:"none", borderRadius:6, padding:"5px 10px", fontSize:12, fontWeight:700, cursor:"pointer" },
  rejectBtn:        { background:"#fee2e2", color:"#991b1b", border:"none", borderRadius:6, padding:"5px 10px", fontSize:12, fontWeight:700, cursor:"pointer" },
  confirmBtn:       { background:"#ede9fe", color:"#5b21b6", border:"none", borderRadius:6, padding:"5px 10px", fontSize:12, fontWeight:700, cursor:"pointer" },
  resendBtn:        { background:"#f0f9ff", color:"#0369a1", border:"none", borderRadius:6, padding:"5px 8px",  fontSize:12, fontWeight:700, cursor:"pointer" },
  detailBtn:        { background:"#f1f5f9", color:"#475569", border:"none", borderRadius:6, padding:"5px 10px", fontSize:12, fontWeight:600, cursor:"pointer" },
  overlay:          { position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 },
  modal:            { background:"#fff", borderRadius:16, padding:"28px", width:"100%", maxWidth:440, boxShadow:"0 20px 60px rgba(0,0,0,0.2)" },
  label:            { fontWeight:600, fontSize:13, color:"#374151", display:"block", marginBottom:6 },
  modalInput:       { width:"100%", border:"1.5px solid #e2e8f0", borderRadius:8, padding:"10px 12px", fontSize:14, outline:"none", boxSizing:"border-box", background:"#f8fafc" },
  ghostBtn:         { background:"#f1f5f9", color:"#475569", border:"none", borderRadius:8, padding:"12px", fontWeight:600, fontSize:14, cursor:"pointer" },
};

export default OPDDashboard;

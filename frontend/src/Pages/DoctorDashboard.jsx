import React, { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  getOPDDashboard, startOPD, approveBooking, rejectStaffBooking,
  bookWalkinToken, fetchTokenAvailability,
  getPendingDoctors, approveDoctor, rejectDoctor,
  getConsultationHistory, getApprovedDoctors,
  resendOPDNotification, staffConfirmAttendance,
} from "../services/allApi";

const TABS     = ["OPD Management", "Doctor Approvals", "Consultation History"];
const SESSIONS = ["morning", "evening"];
const STATUS_BG = { pending:"#fef9c3", waiting:"#ede9fe", consulting:"#d1fae5", done:"#f3f4f6", approved:"#dbeafe", skipped:"#fee2e2" };
const STATUS_FG = { pending:"#92400e", waiting:"#5b21b6", consulting:"#065f46", done:"#6b7280", approved:"#1e40af", skipped:"#991b1b" };
const PAY_COLOR = { pending:"#f59e0b", paid:"#10b981", failed:"#ef4444", offline:"#6366f1" };

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
  const [allDoctors,    setAllDoctors]    = useState([]);

  // ══════════════════════════════════════════════════
  // TAB 1 — OPD MANAGEMENT
  // ══════════════════════════════════════════════════

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getOPDDashboard(date);
      setDoctors(res.data);
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

  const handleStartOPD = async (doctor) => {
    setActing(doctor.doctor_id + "_start");
    try {
      const res = await startOPD({ date, doctor_id: doctor.doctor_id });
      toast.success(res.data.message || "OPD started!");
      fetchDashboard();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to start OPD");
    } finally { setActing(null); }
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

  const handleResendNotification = async (id, patientName) => {
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
  // TAB 2 — DOCTOR APPROVALS
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
    if (activeTab === 1) fetchPendingDoctors();
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
  // TAB 3 — CONSULTATION HISTORY
  // ══════════════════════════════════════════════════

  const fetchHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await getConsultationHistory(histDate, histDoctor);
      setHistory(res.data);
    } catch { toast.error("Failed to load consultation history"); }
    finally { setHistLoading(false); }
  }, [histDate, histDoctor]);

  useEffect(() => {
    if (activeTab === 2) {
      fetchHistory();
      getApprovedDoctors().then(r => setAllDoctors(r.data)).catch(() => {});
    }
  }, [activeTab, fetchHistory]);

  const totalDuration = history.reduce((s, h) => s + (h.duration_minutes || 0), 0);
  const avgDuration   = history.length ? (totalDuration / history.length).toFixed(1) : 0;

  // ══════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════

  return (
    <div style={S.page}>

      <div style={S.header}>
        <div>
          <h2 style={S.title}>🏥 OPD Staff Dashboard</h2>
          <p style={{ color:"#94a3b8", margin:0, fontSize:13 }}>Manage OPD sessions, approvals, and history</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={S.tabBar}>
        {TABS.map((tab, i) => (
          <button key={tab} onClick={() => setActiveTab(i)} style={{
            ...S.tabBtn,
            borderBottom: activeTab===i ? "3px solid #0f4c75" : "3px solid transparent",
            color:        activeTab===i ? "#0f4c75" : "#64748b",
            fontWeight:   activeTab===i ? 700 : 500,
          }}>
            {tab === "OPD Management"       && "🗂 "}
            {tab === "Doctor Approvals"     && "👨‍⚕️ "}
            {tab === "Consultation History" && "📋 "}
            {tab}
            {tab === "Doctor Approvals" && pendingDocs.length > 0 && (
              <span style={S.badge}>{pendingDocs.length}</span>
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
            <input type="date" value={date} onChange={e => setDate(e.target.value)} style={S.input} />
          </div>

          {loading ? <Spinner /> : doctors.length === 0 ? (
            <Empty text={`No doctors for ${date}`} />
          ) : doctors.map(doc => {
            const totalTokens = SESSIONS.reduce((s, sess) =>
              s + (doc.sessions[sess]?.total_booked || 0), 0);

            return (
              <div key={doc.doctor_id} style={S.doctorCard}>

                {/* Doctor header */}
                <div style={S.doctorHeader}>
                  <div>
                    <h3 style={{ margin:0, color:"#fff", fontSize:16 }}>{doc.doctor_name}</h3>
                    <p style={{ margin:"4px 0 0", color:"#bfdbfe", fontSize:13 }}>
                      {doc.hospital} · {doc.department} ·{" "}
                      <span style={{ color:"#7dd3fc" }}>{totalTokens} total tokens</span>
                    </p>
                  </div>
                  <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                    {doc.opd_status?.is_active ? (
                      <span style={{ ...S.pill, background:"#d1fae5", color:"#065f46" }}>🟢 OPD Active</span>
                    ) : (
                      <button
                        onClick={() => handleStartOPD(doc)}
                        disabled={acting === doc.doctor_id + "_start"}
                        style={S.greenBtn}
                      >
                        {acting === doc.doctor_id + "_start" ? "Starting..." : "▶ Start OPD"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Both sessions always */}
                <div style={{ padding:"16px 20px" }}>
                  {SESSIONS.map(sess => {
                    const sessData  = doc.sessions[sess] || { online:[], walkin:[], total_booked:0 };
                    const allTokens = [...(sessData.online||[]), ...(sessData.walkin||[])]
                      .sort((a, b) => a.token - b.token);

                    return (
                      <div key={sess} style={{ ...S.sessionBlock, marginBottom: sess==="morning" ? 16 : 0 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <h4 style={{ margin:0, color:"#0f4c75", fontSize:14 }}>
                              {sess==="morning" ? "🌅" : "🌆"} {sess.charAt(0).toUpperCase()+sess.slice(1)} Session
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
                          <button onClick={() => openWalkin(doc, sess)} style={S.walkinBtn}>
                            + Walk-in
                          </button>
                        </div>

                        {allTokens.length === 0 ? (
                          <div style={{ textAlign:"center", padding:"18px", color:"#94a3b8", fontSize:13,
                            background:"#fff", borderRadius:8, border:"1px dashed #e2e8f0" }}>
                            No tokens booked for {sess} session
                          </div>
                        ) : (
                          <div style={{ overflowX:"auto" }}>
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

                                        {/* Staff confirm — unconfirmed online patients */}
                                        {!t.is_confirmed && t.type==="online" &&
                                          ["pending","waiting"].includes(t.status) && (
                                          <button
                                            onClick={() => handleStaffConfirm(t.id, t.token)}
                                            disabled={!!acting}
                                            style={S.confirmBtn}
                                            title="Manually confirm attendance"
                                          >
                                            {acting===t.id+"_confirm" ? "..." : "✔ Confirm"}
                                          </button>
                                        )}

                                        {/* Approve / Reject — waiting + OPD active */}
                                        {t.status==="waiting" && doc.opd_status?.is_active && (
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

                                        {/* Resend notification — unconfirmed online only */}
                                        {!t.is_confirmed && t.type==="online" &&
                                          ["pending","waiting"].includes(t.status) && (
                                          <button
                                            onClick={() => handleResendNotification(t.id, t.patient_name)}
                                            disabled={!!acting}
                                            style={S.resendBtn}
                                            title="Resend OPD notification email"
                                          >
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
          TAB 2 — DOCTOR APPROVALS
      ══════════════════════════════════════════ */}
      {activeTab === 1 && (
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
          TAB 3 — CONSULTATION HISTORY
      ══════════════════════════════════════════ */}
      {activeTab === 2 && (
        <div style={S.tabContent}>

          {/* Filters */}
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
            <button onClick={fetchHistory} style={{ ...S.greenBtn, padding:"9px 18px" }}>
              🔍 Search
            </button>
          </div>

          {/* Summary stats */}
          {history.length > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12, marginBottom:20 }}>
              {[
                { label:"Total",        val: history.length,                        icon:"📋", color:"#0f4c75" },
                { label:"Morning",      val: history.filter(h=>h.session==="morning").length, icon:"🌅", color:"#6366f1" },
                { label:"Evening",      val: history.filter(h=>h.session==="evening").length, icon:"🌆", color:"#f59e0b" },
                { label:"Avg Duration", val: `${avgDuration} min`,                  icon:"⏱",  color:"#10b981" },
              ].map(s => (
                <div key={s.label} style={{ ...S.statCard, borderTop:`3px solid ${s.color}` }}>
                  <div style={{ fontSize:20 }}>{s.icon}</div>
                  <div style={{ fontWeight:800, fontSize:22, color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:12, color:"#94a3b8" }}>{s.label}</div>
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
                            {["Token","Patient","Doctor","Dept","Date","Started","Duration","Payment","Type"].map(h => (
                              <th key={h} style={S.th}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sessHistory.map(h => (
                            <tr key={h.id}>
                              <td style={S.td}><b style={{ color:"#0f4c75" }}>#{h.token}</b></td>
                              <td style={S.td}>{h.patient_name}</td>
                              <td style={S.td}>{h.doctor_name}</td>
                              <td style={S.td}>{h.department}</td>
                              <td style={S.td}>{h.booking_date}</td>
                              <td style={S.td}>
                                {h.consulting_started_at
                                  ? new Date(h.consulting_started_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})
                                  : "—"}
                              </td>
                              <td style={S.td}>
                                {h.duration_minutes != null ? `${h.duration_minutes.toFixed(1)} min` : "—"}
                              </td>
                              <td style={S.td}>
                                <span style={{ fontSize:12, color:PAY_COLOR[h.payment_status]||"#475569", fontWeight:600 }}>
                                  {h.payment_status}
                                </span>
                              </td>
                              <td style={S.td}>
                                <span style={{
                                  fontSize:11, padding:"2px 8px", borderRadius:10,
                                  background: h.type==="online" ? "#dbeafe" : "#f3f4f6",
                                  color:      h.type==="online" ? "#1d4ed8" : "#6b7280",
                                }}>{h.type}</span>
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

      {/* Walk-in Modal */}
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
  page:        { minHeight:"100vh", background:"#f0f4f8", padding:"24px 20px", display:"flex", flexDirection:"column", alignItems:"center", gap:16 },
  header:      { width:"100%", maxWidth:1100, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 },
  title:       { fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:"#0f4c75", margin:0 },
  tabBar:      { width:"100%", maxWidth:1100, display:"flex", gap:0, background:"#fff", borderRadius:12, padding:"4px", boxShadow:"0 1px 8px rgba(0,0,0,0.06)" },
  tabBtn:      { flex:1, padding:"12px 8px", border:"none", background:"transparent", cursor:"pointer", fontSize:14, transition:"all 0.2s", borderRadius:8 },
  badge:       { display:"inline-flex", alignItems:"center", justifyContent:"center", background:"#ef4444", color:"#fff", borderRadius:"50%", width:18, height:18, fontSize:11, fontWeight:700, marginLeft:6 },
  tabContent:  { width:"100%", maxWidth:1100 },
  input:       { border:"1.5px solid #e2e8f0", borderRadius:8, padding:"8px 12px", fontSize:13, background:"#fff", outline:"none" },
  filterLabel: { display:"block", fontSize:12, fontWeight:600, color:"#64748b", marginBottom:4 },
  doctorCard:  { background:"#fff", borderRadius:14, boxShadow:"0 2px 16px rgba(0,0,0,0.07)", overflow:"hidden", marginBottom:16 },
  doctorHeader:{ background:"linear-gradient(90deg,#0f4c75,#1b6ca8)", padding:"16px 20px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 },
  sessionBlock:{ padding:"14px", background:"#f8fafc", borderRadius:10 },
  docCard:     { background:"#fff", borderRadius:14, padding:"20px 24px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #e2e8f0" },
  avatar:      { width:38, height:38, borderRadius:"50%", background:"linear-gradient(135deg,#0f4c75,#118a7e)", color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:16, flexShrink:0 },
  statCard:    { background:"#fff", borderRadius:12, padding:"16px", textAlign:"center", boxShadow:"0 1px 8px rgba(0,0,0,0.05)" },
  pill:        { padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:600 },
  table:       { width:"100%", borderCollapse:"collapse", fontSize:13, background:"#fff", borderRadius:10, overflow:"hidden" },
  th:          { padding:"10px 12px", textAlign:"left", fontSize:12, color:"#94a3b8", fontWeight:600, borderBottom:"1px solid #e2e8f0", whiteSpace:"nowrap" },
  td:          { padding:"10px 12px", borderBottom:"1px solid #f1f5f9", verticalAlign:"middle" },
  greenBtn:    { background:"#059669", color:"#fff", border:"none", borderRadius:8, padding:"8px 16px", fontWeight:600, fontSize:13, cursor:"pointer" },
  dangerBtn:   { background:"#fef2f2", color:"#dc2626", border:"1px solid #fca5a5", borderRadius:8, padding:"8px 16px", fontWeight:600, fontSize:13, cursor:"pointer" },
  refreshBtn:  { background:"#f1f5f9", color:"#475569", border:"none", borderRadius:8, padding:"8px 16px", fontWeight:600, fontSize:13, cursor:"pointer" },
  walkinBtn:   { background:"#0f4c75", color:"#fff", border:"none", borderRadius:8, padding:"7px 14px", fontSize:13, fontWeight:600, cursor:"pointer" },
  approveBtn:  { background:"#d1fae5", color:"#065f46", border:"none", borderRadius:6, padding:"5px 10px", fontSize:12, fontWeight:700, cursor:"pointer" },
  rejectBtn:   { background:"#fee2e2", color:"#991b1b", border:"none", borderRadius:6, padding:"5px 10px", fontSize:12, fontWeight:700, cursor:"pointer" },
  confirmBtn:  { background:"#ede9fe", color:"#5b21b6", border:"none", borderRadius:6, padding:"5px 10px", fontSize:12, fontWeight:700, cursor:"pointer" },
  resendBtn:   { background:"#f0f9ff", color:"#0369a1", border:"none", borderRadius:6, padding:"5px 8px",  fontSize:12, fontWeight:700, cursor:"pointer" },
  overlay:     { position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:16 },
  modal:       { background:"#fff", borderRadius:16, padding:"28px", width:"100%", maxWidth:440, boxShadow:"0 20px 60px rgba(0,0,0,0.2)" },
  label:       { fontWeight:600, fontSize:13, color:"#374151", display:"block", marginBottom:6 },
  modalInput:  { width:"100%", border:"1.5px solid #e2e8f0", borderRadius:8, padding:"10px 12px", fontSize:14, outline:"none", boxSizing:"border-box", background:"#f8fafc" },
  ghostBtn:    { background:"#f1f5f9", color:"#475569", border:"none", borderRadius:8, padding:"12px", fontWeight:600, fontSize:14, cursor:"pointer" },
};

export default OPDDashboard;
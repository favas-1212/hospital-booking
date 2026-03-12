import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { getPatientTokenStatus, confirmAttendance, rejectBooking } from "../services/allApi";

const STATUS_META = {
  pending:    { color:"#f59e0b", bg:"#fef9c3", icon:"⏳", label:"Pending — OPD not started yet" },
  waiting:    { color:"#6366f1", bg:"#ede9fe", icon:"🪑", label:"Waiting in queue" },
  consulting: { color:"#10b981", bg:"#d1fae5", icon:"👨‍⚕️", label:"You are being consulted" },
  done:       { color:"#6b7280", bg:"#f3f4f6", icon:"✅", label:"Consultation done" },
  approved:   { color:"#3b82f6", bg:"#dbeafe", icon:"✔️", label:"Approved" },
};

function PatientDashboard() {
  const navigate  = useNavigate();
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [opdMsg,   setOpdMsg]   = useState("");   // "OPD not started yet" from backend
  const [acting,   setActing]   = useState(false);

  const token = sessionStorage.getItem("token");

  // ── Fetch token status ───────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res = await getPatientTokenStatus(); // GET /booking/patient/token-status/
      if (res.data.error) {
        // Backend returns 200 with {error:...} when OPD not started
        setOpdMsg(res.data.error);
        setData(null);
      } else {
        setData(res.data);
        setOpdMsg("");
      }
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      if (err.response?.status === 404) { setData(null); setOpdMsg("No booking found for today."); }
    } finally { setLoading(false); }
  }, [navigate]);

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000); // poll every 15s
    return () => clearInterval(interval);
  }, [token, fetchStatus, navigate]);

  // Auto redirect when done
  useEffect(() => {
    if (data?.status === "done") {
      toast.success("✅ Consultation completed!");
      setTimeout(() => navigate("/mybookings"), 2000);
    }
  }, [data, navigate]);

  // ── Confirm attendance ───────────────────────────────────
  const handleConfirm = async () => {
    if (!data?.id) return;
    setActing(true);
    try {
      const res = await confirmAttendance(data.id); // POST /booking/patient/confirm/<id>/
      toast.success(`✅ Confirmed! You are #${res.data.queue_position} in queue. ~${res.data.estimated_wait} min wait.`);
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.error || "Confirmation failed");
    } finally { setActing(false); }
  };

  // ── Reject booking ───────────────────────────────────────
  const handleReject = async () => {
    if (!window.confirm("Are you sure you want to withdraw from this booking?")) return;
    setActing(true);
    try {
      await rejectBooking(data.id);               // POST /booking/patient/reject/<id>/
      toast.info("Booking withdrawn");
      navigate("/mybookings");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to reject booking");
    } finally { setActing(false); }
  };

  // ── Render ───────────────────────────────────────────────
  if (loading) return (
    <div style={S.centerPage}>
      <div style={S.spinner}></div>
      <p style={{ color:"#64748b", marginTop:16 }}>Checking your token status...</p>
    </div>
  );

  if (!data) return (
    <div style={S.centerPage}>
      <div style={{ fontSize:64 }}>🏥</div>
      <h3 style={{ color:"#1e293b", marginTop:16 }}>{opdMsg || "No active booking today"}</h3>
      <p style={{ color:"#64748b", fontSize:14 }}>
        {opdMsg?.includes("not started") ? "Your token status will appear here once the doctor starts OPD." : ""}
      </p>
      {!opdMsg?.includes("not started") && (
        <button onClick={() => navigate("/booking")} style={S.primaryBtn}>Book a Token</button>
      )}
    </div>
  );

  const meta     = STATUS_META[data.status] || STATUS_META.waiting;
  const ahead    = data.tokens_ahead ?? 0;
  const wait     = data.estimated_wait_minutes ?? 0;
  const avgMin   = data.avg_consult_minutes ?? 7;
  const progress = data.current_token && data.token_number
    ? Math.min(100, Math.round((data.current_token / data.token_number) * 100))
    : 0;
  const isConfirmed = data.is_confirmed;

  return (
    <div style={S.page}>
      <div style={{ width:"100%", maxWidth:600 }}>

        {/* Title */}
        <h2 style={S.pageTitle}>Live Token Status</h2>
        <p style={{ color:"#94a3b8", fontSize:14, marginBottom:28, textAlign:"center" }}>
          Updates every 15 seconds automatically
        </p>

        {/* Main token card */}
        <div style={{ ...S.card, borderTop:`4px solid ${meta.color}` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
            <div>
              <p style={{ color:"#94a3b8", fontSize:12, margin:0 }}>MY TOKEN</p>
              <h1 style={{ fontSize:56, fontWeight:800, color:"#0f4c75", margin:0, lineHeight:1 }}>
                #{data.token_number}
              </h1>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ ...S.badge, background:meta.bg, color:meta.color, fontSize:13, padding:"8px 14px" }}>
                {meta.icon} {data.status?.toUpperCase()}
              </div>
              {isConfirmed
                ? <div style={{ fontSize:11, color:"#10b981", marginTop:6 }}>✅ Attendance confirmed</div>
                : <div style={{ fontSize:11, color:"#f59e0b", marginTop:6 }}>⚠️ Not confirmed yet</div>
              }
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:24 }}>
            {[
              { label:"Current Token", val: data.current_token ? `#${data.current_token}` : "—", icon:"🔔" },
              { label:"People Ahead",  val: ahead > 0 ? ahead : "Your Turn!", icon:"👥" },
              { label:"Est. Wait",     val: ahead > 0 ? `~${wait} min` : "Now", icon:"⏱" },
            ].map(({ label, val, icon }) => (
              <div key={label} style={S.statBox}>
                <div style={{ fontSize:18, marginBottom:4 }}>{icon}</div>
                <div style={{ fontWeight:800, fontSize:18, color:"#0f4c75" }}>{val}</div>
                <div style={{ fontSize:11, color:"#94a3b8" }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom:20 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#94a3b8", marginBottom:6 }}>
              <span>Queue progress</span>
              <span>Avg: {avgMin} min/patient</span>
            </div>
            <div style={{ height:8, background:"#e2e8f0", borderRadius:8 }}>
              <div style={{
                height:"100%", borderRadius:8, transition:"width 0.6s ease",
                background: "linear-gradient(90deg,#0f4c75,#118a7e)",
                width: `${progress}%`,
              }}></div>
            </div>
          </div>

          {/* Status message */}
          <div style={{ ...S.infoBox, borderColor: meta.color + "40", background: meta.bg }}>
            <span style={{ fontSize:18 }}>{meta.icon}</span>
            <span style={{ fontSize:14, color: meta.color, fontWeight:600 }}>{meta.label}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ ...S.card, marginTop:16 }}>
          {/* If OPD started and not yet confirmed — show CONFIRM button */}
          {data.status === "waiting" && !isConfirmed && (
            <div style={{ marginBottom:16, padding:14, background:"#fffbeb", borderRadius:10, border:"1px solid #fcd34d" }}>
              <p style={{ margin:0, fontSize:13, color:"#92400e", fontWeight:600 }}>
                ⚡ OPD has started! Confirm your attendance to join the active queue.
              </p>
            </div>
          )}

          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
            {/* CONFIRM attendance */}
            {data.status === "waiting" && !isConfirmed && (
              <button onClick={handleConfirm} disabled={acting} style={{ ...S.primaryBtn, flex:1 }}>
                {acting ? "Confirming..." : "✅ Confirm Attendance"}
              </button>
            )}

            {/* Withdraw / reject */}
            {["pending","waiting"].includes(data.status) && (
              <button onClick={handleReject} disabled={acting} style={{ ...S.dangerBtn, flex:1 }}>
                {acting ? "Processing..." : "❌ Withdraw"}
              </button>
            )}

            {data.status === "consulting" && (
              <div style={{ ...S.infoBox, flex:1, borderColor:"#6ee7b7", background:"#ecfdf5" }}>
                <span style={{ fontSize:16 }}>👨‍⚕️</span>
                <span style={{ color:"#065f46", fontWeight:600 }}>You are currently being consulted</span>
              </div>
            )}

            {data.status === "done" && (
              <div style={{ ...S.infoBox, flex:1, borderColor:"#c7d2fe", background:"#eef2ff" }}>
                <span style={{ fontSize:16 }}>✅</span>
                <span style={{ color:"#3730a3", fontWeight:600 }}>Consultation complete — redirecting...</span>
              </div>
            )}
          </div>
        </div>

        {/* Refresh hint */}
        <p style={{ textAlign:"center", fontSize:12, color:"#cbd5e1", marginTop:16 }}>
          🔄 Auto-refreshes every 15 seconds
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const S = {
  page:       { minHeight:"100vh", background:"#f8fafc", display:"flex", flexDirection:"column", alignItems:"center", padding:"40px 20px" },
  centerPage: { minHeight:"100vh", background:"#f8fafc", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 20px", textAlign:"center" },
  spinner:    { width:40, height:40, borderRadius:"50%", border:"3px solid #e2e8f0", borderTopColor:"#0f4c75", animation:"spin 0.8s linear infinite" },
  card:       { background:"#fff", borderRadius:16, padding:"24px", boxShadow:"0 2px 16px rgba(0,0,0,0.07)" },
  pageTitle:  { fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, color:"#0f4c75", margin:0, textAlign:"center" },
  statBox:    { background:"#f8fafc", borderRadius:10, padding:"14px 10px", textAlign:"center" },
  badge:      { display:"inline-block", padding:"4px 12px", borderRadius:20, fontSize:12, fontWeight:700 },
  infoBox:    { display:"flex", alignItems:"center", gap:10, padding:"12px 16px", borderRadius:10, border:"1px solid" },
  primaryBtn: { background:"linear-gradient(90deg,#0f4c75,#118a7e)", color:"#fff", border:"none", borderRadius:10, padding:"12px 20px", fontWeight:600, fontSize:14, cursor:"pointer" },
  dangerBtn:  { background:"#fef2f2", color:"#dc2626", border:"1px solid #fca5a5", borderRadius:10, padding:"12px 20px", fontWeight:600, fontSize:14, cursor:"pointer" },
};

export default PatientDashboard;

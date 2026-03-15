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
  skipped:    { color:"#ef4444", bg:"#fee2e2", icon:"⏭",  label:"Your token was skipped" },
};

export default function PatientDashboard() {
  const navigate = useNavigate();

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [opdMsg,  setOpdMsg]  = useState("");
  const [acting,  setActing]  = useState(false);

  const token = sessionStorage.getItem("token");

  // ── Fetch token status ──────────────────────────────────
  const fetchStatus = useCallback(async (silent = false) => {
    try {
      const res = await getPatientTokenStatus();
      if (res.data?.error) {
        setOpdMsg(res.data.error);
        setData(null);
      } else {
        setData(res.data);
        setOpdMsg("");
      }
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      if (err.response?.status === 404) {
        setData(null);
        setOpdMsg("No booking found for today.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    fetchStatus();
    const interval = setInterval(() => fetchStatus(true), 15000);
    return () => clearInterval(interval);
  }, [token, fetchStatus, navigate]);

  // Auto redirect when done
  useEffect(() => {
    if (data?.status === "done") {
      toast.success("✅ Consultation completed!");
      setTimeout(() => navigate("/mybookings"), 3000);
    }
  }, [data, navigate]);

  // ── Confirm attendance ──────────────────────────────────
  const handleConfirm = async () => {
    if (!data?.id) return;
    setActing(true);
    try {
      const res = await confirmAttendance(data.id);
      toast.success(
        `✅ Confirmed! You are #${res.data.queue_position} in queue. ~${res.data.estimated_wait} min wait.`
      );
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.error || "Confirmation failed");
    } finally { setActing(false); }
  };

  // ── Withdraw booking ────────────────────────────────────
  const handleReject = async () => {
    if (!window.confirm("Are you sure you want to withdraw from this booking?")) return;
    setActing(true);
    try {
      await rejectBooking(data.id);
      toast.info("Booking withdrawn");
      navigate("/mybookings");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to withdraw booking");
    } finally { setActing(false); }
  };

  // ── Loading ─────────────────────────────────────────────
  if (loading) return (
    <div style={S.centerPage}>
      <div style={S.spinner}></div>
      <p style={{ color:"#64748b", marginTop:16 }}>Checking your token status...</p>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );

  // ── No booking / OPD not started ────────────────────────
  if (!data) return (
    <div style={S.centerPage}>
      <div style={{ fontSize:64, marginBottom:16 }}>🏥</div>
      <h3 style={{ color:"#1e293b", margin:"0 0 8px" }}>
        {opdMsg || "No active booking today"}
      </h3>
      <p style={{ color:"#64748b", fontSize:14, margin:"0 0 24px", maxWidth:360, textAlign:"center" }}>
        {opdMsg?.includes("not started")
          ? "Your token status will appear here once the doctor starts OPD."
          : opdMsg?.includes("No booking")
          ? "You don't have a booking for today."
          : ""}
      </p>
      {opdMsg?.includes("not started") ? (
        <button onClick={() => fetchStatus()} style={S.secondaryBtn}>🔄 Refresh</button>
      ) : (
        <button onClick={() => navigate("/booking")} style={S.primaryBtn}>Book a Token</button>
      )}
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );

  // ── Derived values ──────────────────────────────────────
  const meta        = STATUS_META[data.status] || STATUS_META.waiting;
  const ahead       = data.tokens_ahead ?? 0;
  const wait        = data.estimated_wait_minutes ?? 0;
  const avgMin      = data.avg_consult_minutes ?? 7;
  const isConfirmed = data.is_confirmed;

  // FIX: confirm button shows for BOTH pending and waiting when not confirmed
  const canConfirm  = ["pending", "waiting"].includes(data.status) && !isConfirmed;
  const canWithdraw = ["pending", "waiting"].includes(data.status);

  const progress = data.current_token && data.token_number
    ? Math.min(100, Math.round((data.current_token / data.token_number) * 100))
    : 0;

  return (
    <div style={S.page}>
      <div style={{ width:"100%", maxWidth:600 }}>

        {/* ── Header ── */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <h2 style={S.pageTitle}>Live Token Status</h2>
          <p style={{ color:"#94a3b8", fontSize:13, margin:0 }}>
            Auto-refreshes every 15 seconds
          </p>
        </div>

        {/* ── Main Token Card ── */}
        <div style={{ ...S.card, borderTop:`4px solid ${meta.color}`, marginBottom:14 }}>

          {/* Token number + status badge */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
            <div>
              <p style={{ color:"#94a3b8", fontSize:11, fontWeight:600, letterSpacing:1, margin:"0 0 4px" }}>
                MY TOKEN
              </p>
              <h1 style={{ fontSize:60, fontWeight:800, color:"#0f4c75", margin:0, lineHeight:1 }}>
                #{data.token_number}
              </h1>
              <p style={{ color:"#64748b", fontSize:13, margin:"6px 0 0" }}>
                {data.session?.charAt(0).toUpperCase() + data.session?.slice(1)} Session · {data.booking_date}
              </p>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{
                display:"inline-flex", alignItems:"center", gap:6,
                background:meta.bg, color:meta.color,
                fontSize:12, fontWeight:700, padding:"8px 14px",
                borderRadius:20, marginBottom:8,
              }}>
                <span>{meta.icon}</span>
                <span>{data.status?.toUpperCase()}</span>
              </div>
              <div style={{ fontSize:12 }}>
                {isConfirmed
                  ? <span style={{ color:"#10b981", fontWeight:600 }}>✅ Attendance confirmed</span>
                  : <span style={{ color:"#f59e0b", fontWeight:600 }}>⚠️ Not confirmed yet</span>
                }
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
            {[
              { label:"Current Token", val: data.current_token ? `#${data.current_token}` : "—", icon:"🔔" },
              { label:"Ahead of you",  val: ahead > 0 ? ahead : "Your Turn!",                    icon:"👥" },
              { label:"Est. Wait",     val: ahead > 0 ? `~${wait} min` : "Soon",                  icon:"⏱" },
            ].map(({ label, val, icon }) => (
              <div key={label} style={S.statBox}>
                <div style={{ fontSize:20, marginBottom:4 }}>{icon}</div>
                <div style={{ fontWeight:800, fontSize:18, color:"#0f4c75" }}>{val}</div>
                <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom:18 }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"#94a3b8", marginBottom:6 }}>
              <span>Queue progress</span>
              <span>~{avgMin} min per patient</span>
            </div>
            <div style={{ height:8, background:"#e2e8f0", borderRadius:8, overflow:"hidden" }}>
              <div style={{
                height:"100%", borderRadius:8,
                background:"linear-gradient(90deg,#0f4c75,#118a7e)",
                width:`${progress}%`,
                transition:"width 0.6s ease",
              }} />
            </div>
          </div>

          {/* Status label */}
          <div style={{
            display:"flex", alignItems:"center", gap:10,
            padding:"12px 16px", borderRadius:10,
            background:meta.bg, border:`1px solid ${meta.color}30`,
          }}>
            <span style={{ fontSize:18 }}>{meta.icon}</span>
            <span style={{ fontSize:13, color:meta.color, fontWeight:600 }}>{meta.label}</span>
          </div>
        </div>

        {/* ── Action Card ── */}
        <div style={S.card}>

          {/* OPD started — waiting but not confirmed */}
          {canConfirm && data.status === "waiting" && (
            <div style={{
              marginBottom:16, padding:"12px 16px",
              background:"#fffbeb", borderRadius:10,
              border:"1px solid #fcd34d",
              display:"flex", alignItems:"flex-start", gap:10,
            }}>
              <span style={{ fontSize:20 }}>⚡</span>
              <div>
                <p style={{ margin:0, fontSize:13, color:"#92400e", fontWeight:700 }}>
                  OPD has started!
                </p>
                <p style={{ margin:"2px 0 0", fontSize:12, color:"#a16207" }}>
                  Confirm your attendance now to join the active queue.
                  You may miss your turn if you don't confirm.
                </p>
              </div>
            </div>
          )}

          {/* Pending — not yet confirmed */}
          {canConfirm && data.status === "pending" && (
            <div style={{
              marginBottom:16, padding:"12px 16px",
              background:"#f0f9ff", borderRadius:10,
              border:"1px solid #bae6fd",
              display:"flex", alignItems:"flex-start", gap:10,
            }}>
              <span style={{ fontSize:20 }}>ℹ️</span>
              <div>
                <p style={{ margin:0, fontSize:13, color:"#0369a1", fontWeight:700 }}>
                  Booking confirmed
                </p>
                <p style={{ margin:"2px 0 0", fontSize:12, color:"#0284c7" }}>
                  Once the doctor starts OPD, confirm your attendance to join the queue.
                </p>
              </div>
            </div>
          )}

          {/* Consulting */}
          {data.status === "consulting" && (
            <div style={{
              marginBottom:16, padding:"14px 16px",
              background:"#ecfdf5", borderRadius:10,
              border:"1px solid #6ee7b7",
              display:"flex", alignItems:"center", gap:10,
            }}>
              <span style={{ fontSize:24 }}>👨‍⚕️</span>
              <div>
                <p style={{ margin:0, fontSize:14, color:"#065f46", fontWeight:700 }}>
                  You are currently being consulted
                </p>
                <p style={{ margin:"2px 0 0", fontSize:12, color:"#059669" }}>
                  Please proceed to the doctor's room.
                </p>
              </div>
            </div>
          )}

          {/* Done */}
          {data.status === "done" && (
            <div style={{
              marginBottom:16, padding:"14px 16px",
              background:"#eef2ff", borderRadius:10,
              border:"1px solid #c7d2fe",
              display:"flex", alignItems:"center", gap:10,
            }}>
              <span style={{ fontSize:24 }}>✅</span>
              <div>
                <p style={{ margin:0, fontSize:14, color:"#3730a3", fontWeight:700 }}>
                  Consultation complete!
                </p>
                <p style={{ margin:"2px 0 0", fontSize:12, color:"#4f46e5" }}>
                  Redirecting to your bookings...
                </p>
              </div>
            </div>
          )}

          {/* Skipped */}
          {data.status === "skipped" && (
            <div style={{
              marginBottom:16, padding:"14px 16px",
              background:"#fef2f2", borderRadius:10,
              border:"1px solid #fca5a5",
              display:"flex", alignItems:"center", gap:10,
            }}>
              <span style={{ fontSize:24 }}>⏭</span>
              <div>
                <p style={{ margin:0, fontSize:14, color:"#991b1b", fontWeight:700 }}>
                  Your token was skipped
                </p>
                <p style={{ margin:"2px 0 0", fontSize:12, color:"#dc2626" }}>
                  Please contact the OPD staff for assistance.
                </p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>

            {/* CONFIRM — pending OR waiting, not yet confirmed */}
            {canConfirm && (
              <button
                onClick={handleConfirm}
                disabled={acting}
                style={{ ...S.primaryBtn, flex:1, opacity: acting ? 0.7 : 1 }}>
                {acting ? "Confirming..." : "✅ Confirm Attendance"}
              </button>
            )}

            {/* WITHDRAW */}
            {canWithdraw && (
              <button
                onClick={handleReject}
                disabled={acting}
                style={{ ...S.dangerBtn, flex: canConfirm ? "0 0 auto" : 1 }}>
                {acting ? "..." : "❌ Withdraw"}
              </button>
            )}

            {/* REFRESH */}
            <button
              onClick={() => fetchStatus()}
              disabled={acting}
              title="Refresh now"
              style={S.secondaryBtn}>
              🔄
            </button>

          </div>
        </div>

        <p style={{ textAlign:"center", fontSize:12, color:"#cbd5e1", marginTop:16 }}>
          🔄 Auto-refreshes every 15 seconds
        </p>

      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
    </div>
  );
}

const S = {
  page:        { minHeight:"100vh", background:"#f8fafc", display:"flex", flexDirection:"column", alignItems:"center", padding:"40px 20px" },
  centerPage:  { minHeight:"100vh", background:"#f8fafc", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"40px 20px", textAlign:"center" },
  spinner:     { width:44, height:44, borderRadius:"50%", border:"3px solid #e2e8f0", borderTopColor:"#0f4c75", animation:"spin 0.8s linear infinite" },
  card:        { background:"#fff", borderRadius:16, padding:"24px", boxShadow:"0 2px 16px rgba(0,0,0,0.07)" },
  pageTitle:   { fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, color:"#0f4c75", margin:0 },
  statBox:     { background:"#f8fafc", borderRadius:12, padding:"14px 10px", textAlign:"center" },
  primaryBtn:  { background:"linear-gradient(90deg,#0f4c75,#118a7e)", color:"#fff", border:"none", borderRadius:10, padding:"12px 20px", fontWeight:700, fontSize:14, cursor:"pointer" },
  dangerBtn:   { background:"#fef2f2", color:"#dc2626", border:"1px solid #fca5a5", borderRadius:10, padding:"12px 16px", fontWeight:600, fontSize:14, cursor:"pointer" },
  secondaryBtn:{ background:"#f1f5f9", color:"#475569", border:"none", borderRadius:10, padding:"12px 16px", fontWeight:600, fontSize:14, cursor:"pointer" },
};

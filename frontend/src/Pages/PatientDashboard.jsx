import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import {
  getPatientTokenStatus,
  confirmAttendance,
  rejectBooking,
  getMyPrescriptions,
} from "../services/allApi";

const STATUS_META = {
  pending:    { color:"#f59e0b", bg:"#fffbeb", border:"#fde68a", icon:"⏳", label:"Waiting for OPD to start" },
  waiting:    { color:"#1b6ca8", bg:"#eff6ff", border:"#bfdbfe", icon:"🪑", label:"You are in the queue" },
  consulting: { color:"#118a7e", bg:"#f0fdf9", border:"#6ee7b7", icon:"👨‍⚕️", label:"You are being consulted now" },
  done:       { color:"#6b7280", bg:"#f9fafb", border:"#e5e7eb", icon:"✅", label:"Consultation complete" },
  skipped:    { color:"#ef4444", bg:"#fef2f2", border:"#fca5a5", icon:"⏭",  label:"Your token was skipped" },
};

function formatWaitDisplay(value) {
  if (value && typeof value === "object" && value.display) return value.display;
  if (typeof value === "number" && !isNaN(value)) {
    const total = Math.round(value);
    if (total <= 0) return "0m";
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }
  return null;
}

export default function PatientDashboard() {
  const navigate = useNavigate();

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [opdMsg,  setOpdMsg]  = useState("");
  const [acting,  setActing]  = useState(false);
  const [pulse,   setPulse]   = useState(false);

  const [prescriptions, setPrescriptions] = useState([]);
  const [rxLoading,     setRxLoading]     = useState(false);
  const [rxOpen,        setRxOpen]        = useState(false);

  const token = sessionStorage.getItem("token");

  const fetchStatus = useCallback(async (silent = false) => {
    try {
      const res = await getPatientTokenStatus();
      if (res.data?.error) {
        setOpdMsg(res.data.error);
        setData(null);
      } else if (res.data && res.data.token_number) {
        setData(res.data);
        setOpdMsg("");
        if (silent) { setPulse(true); setTimeout(() => setPulse(false), 600); }
      } else {
        setOpdMsg("Status unavailable. Please try again.");
        setData(null);
      }
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      if (err.response?.status === 404) { setData(null); setOpdMsg("No booking found for today."); }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [navigate]);

  const fetchPrescriptions = useCallback(async () => {
    setRxLoading(true);
    try {
      const res = await getMyPrescriptions();
      setPrescriptions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      if (err.response?.status !== 404) console.warn("Failed to load prescriptions", err);
      setPrescriptions([]);
    } finally {
      setRxLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) { navigate("/login"); return; }
    fetchStatus();
    fetchPrescriptions();
    const id = setInterval(() => fetchStatus(true), 15000);
    return () => clearInterval(id);
  }, [token, fetchStatus, fetchPrescriptions, navigate]);

  useEffect(() => {
    if (data?.status === "done") {
      fetchPrescriptions();
      toast.success("✅ Consultation completed!");
    }
  }, [data?.status, fetchPrescriptions]);

  const handleConfirm = async () => {
    if (!data?.id) return toast.error("Booking ID not found. Please refresh.");
    if (!data.opd_started)
      return toast.info("You can only confirm attendance after the doctor starts OPD.");
    setActing(true);
    try {
      const res = await confirmAttendance(data.id);
      const waitDisplay =
        formatWaitDisplay(res.data.estimated_wait) ||
        formatWaitDisplay(res.data.estimated_wait_min) || "—";
      toast.success(`✅ Confirmed! Position #${res.data.queue_position} · ~${waitDisplay} wait`);
      fetchStatus();
    } catch (err) {
      toast.error(err.response?.data?.error || "Confirmation failed");
    } finally { setActing(false); }
  };

  const handleReject = async () => {
    if (!window.confirm("Are you sure you want to withdraw from this booking?")) return;
    setActing(true);
    try {
      await rejectBooking(data.id);
      toast.info("Booking withdrawn");
      navigate("/mybookings");
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to withdraw");
    } finally { setActing(false); }
  };

  // ── Loading ──────────────────────────────────────────
  if (loading) return (
    <div style={S.page}>
      <style>{KF}</style>
      <div style={S.loadingCard}>
        <div style={S.headerBand}>
          <div style={S.headerLogo}>🏥</div>
          <h4 style={S.headerTitle}>MedQueue Portal</h4>
          <p style={S.headerSub}>Patient Dashboard</p>
        </div>
        <div style={{ padding:"40px 36px", textAlign:"center" }}>
          <div style={S.spinner} />
          <p style={{ color:"#64748b", marginTop:20, fontSize:14 }}>Checking your token status...</p>
        </div>
      </div>
    </div>
  );

  // ── No booking ───────────────────────────────────────
  if (!data) {
    const isNotStarted = opdMsg?.toLowerCase().includes("not started");
    const isNoBooking  = opdMsg?.toLowerCase().includes("no booking");

    return (
      <div style={S.page}>
        <style>{KF}</style>
        <div style={S.outerCard}>
          {/* Header band */}
          <div style={S.headerBand}>
            <div style={S.liveChip}>
              <span style={S.liveDot} /> MedQueue Portal
            </div>
            <div style={{ fontSize:56, margin:"14px 0 8px" }}>
              {isNotStarted ? "⏰" : isNoBooking ? "📋" : "🏥"}
            </div>
            <h4 style={S.headerTitle}>
              {isNotStarted ? "OPD Hasn't Started Yet"
               : isNoBooking ? "No Booking Today"
               : opdMsg || "Status Unavailable"}
            </h4>
            <p style={S.headerSub}>
              {isNotStarted
                ? "The doctor will start OPD soon."
                : isNoBooking
                ? "You don't have an active booking for today."
                : "Please refresh or contact OPD staff."}
            </p>
          </div>

          <div style={{ padding:"28px 32px 32px" }}>
            {isNotStarted ? (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14 }}>
                <div style={S.autoRefreshChip}>
                  <div style={S.liveDot} /> Auto-refreshing every 15 seconds
                </div>
                <button onClick={() => fetchStatus()} style={S.outlineBtn}>
                  🔄 Refresh Now
                </button>
              </div>
            ) : (
              <button onClick={() => navigate("/booking")} style={S.primaryBtn}>
                Book a Token →
              </button>
            )}

            <PrescriptionsSection
              prescriptions={prescriptions}
              loading={rxLoading}
              open={rxOpen}
              onToggle={() => setRxOpen(o => !o)}
              style={{ marginTop:24 }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Derived ───────────────────────────────────────────
  const meta        = STATUS_META[data.status] || STATUS_META.waiting;
  const isConfirmed = !!data.is_confirmed;
  const opdStarted  = !!data.opd_started;

  const confirmationWindowOpen =
    typeof data.confirmation_window_open === "boolean"
      ? data.confirmation_window_open : true;

  const canConfirmNow     = confirmationWindowOpen && opdStarted && !isConfirmed && ["pending","waiting"].includes(data.status);
  const confirmationMissed = opdStarted && !isConfirmed && !confirmationWindowOpen && ["pending","waiting"].includes(data.status);
  const isPending         = !opdStarted && !isConfirmed && confirmationWindowOpen;

  const ahead       = data.tokens_ahead;
  const waitDisplay = formatWaitDisplay(data.estimated_wait) || formatWaitDisplay(data.estimated_wait_minutes);
  const avgDisplay  = formatWaitDisplay(data.avg_consult_time) || formatWaitDisplay(data.avg_consult_minutes);

  const showQueue = isConfirmed && ahead !== null && ahead !== undefined;
  const showWait  = isConfirmed && waitDisplay !== null;
  const isMyTurn  = showQueue && ahead === 0 && data.status === "waiting";

  const progress = data.status === "consulting" || data.status === "done"
    ? 100
    : data.current_token && data.token_number
    ? Math.min(100, Math.round((data.current_token / data.token_number) * 100))
    : 0;

  const todaysRx = data.prescription;

  return (
    <div style={S.page}>
      <style>{KF}</style>
      <div style={{ width:"100%", maxWidth:520 }}>

        {/* ── Header card ── */}
        <div style={S.outerCard}>
          <div style={S.headerBand}>
            <div style={S.liveChip}>
              <span style={S.liveDot} />
              Live · updates every 15s
              {pulse && <span style={{ color:"#4ade80", fontWeight:700, marginLeft:4 }}>↻</span>}
            </div>
            <div style={{ marginTop:16, display:"flex", alignItems:"flex-end",
              justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.6)",
                  letterSpacing:2, marginBottom:6 }}>MY TOKEN NUMBER</div>
                <div style={{ fontSize:76, fontWeight:900, color:"#fff", lineHeight:1 }}>
                  #{data.token_number}
                </div>
                <div style={{ fontSize:13, color:"#bae6fd", marginTop:6 }}>
                  {data.session?.charAt(0).toUpperCase()+data.session?.slice(1)} Session · {data.booking_date}
                </div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end" }}>
                <div style={{
                  display:"inline-flex", alignItems:"center", gap:6,
                  background:"rgba(255,255,255,0.15)", backdropFilter:"blur(8px)",
                  border:"1.5px solid rgba(255,255,255,0.25)",
                  fontSize:12, fontWeight:700, padding:"7px 14px", borderRadius:20, color:"#fff",
                }}>
                  <span>{meta.icon}</span>
                  <span>{data.status?.toUpperCase()}</span>
                </div>
                <div style={{
                  display:"inline-flex", alignItems:"center", gap:5,
                  fontSize:12, fontWeight:600,
                  color:      isConfirmed ? "#fff" : "#fef08a",
                  background: isConfirmed ? "rgba(74,222,128,0.2)" : "rgba(253,224,71,0.15)",
                  border:     `1px solid ${isConfirmed ? "rgba(74,222,128,0.5)" : "rgba(253,224,71,0.4)"}`,
                  padding:"4px 12px", borderRadius:12,
                }}>
                  {isConfirmed ? "✅ Confirmed" : "⚠️ Not Confirmed"}
                </div>
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ padding:"24px 28px 28px" }}>

            {/* Banners */}
            {isMyTurn && (
              <div style={{ ...S.banner, background:"linear-gradient(90deg,#059669,#0891b2)",
                animation:"glow 2s ease-in-out infinite", marginBottom:16 }}>
                <span style={{ fontSize:24 }}>🔔</span>
                <div>
                  <div style={{ fontWeight:800, fontSize:15 }}>It's Your Turn!</div>
                  <div style={{ fontSize:12, opacity:0.9, marginTop:2 }}>Please proceed to the doctor's room</div>
                </div>
              </div>
            )}
            {data.opd_paused && (
              <div style={{ ...S.banner, background:"linear-gradient(90deg,#f59e0b,#d97706)", marginBottom:16 }}>
                <span style={{ fontSize:24 }}>⏸</span>
                <div>
                  <div style={{ fontWeight:800, fontSize:15 }}>OPD Paused</div>
                  <div style={{ fontSize:12, opacity:0.9, marginTop:2 }}>
                    {data.pause_reason || "The OPD is temporarily paused. It will resume shortly."}
                  </div>
                </div>
              </div>
            )}
            {data.doctor_on_leave && (
              <div style={{ ...S.banner, background:"linear-gradient(90deg,#f59e0b,#ea580c)", marginBottom:16 }}>
                <span style={{ fontSize:24 }}>🛌</span>
                <div>
                  <div style={{ fontWeight:800, fontSize:15 }}>Doctor is on Leave</div>
                  <div style={{ fontSize:12, opacity:0.9, marginTop:2 }}>
                    {data.leave_reason || "Your booking has been cancelled. Please rebook for another date."}
                  </div>
                </div>
              </div>
            )}
            {confirmationMissed && (
              <div style={{ ...S.banner, background:"linear-gradient(90deg,#dc2626,#991b1b)", marginBottom:16 }}>
                <span style={{ fontSize:24 }}>⏰</span>
                <div>
                  <div style={{ fontWeight:800, fontSize:15 }}>Confirmation Window Closed</div>
                  <div style={{ fontSize:12, opacity:0.9, marginTop:2 }}>
                    You did not confirm in time. Please contact OPD staff at the counter.
                  </div>
                </div>
              </div>
            )}
            {data.status === "consulting" && (
              <div style={{ ...S.banner, background:"linear-gradient(90deg,#118a7e,#0891b2)", marginBottom:16 }}>
                <span style={{ fontSize:24 }}>👨‍⚕️</span>
                <div>
                  <div style={{ fontWeight:800, fontSize:15 }}>You're Being Consulted</div>
                  <div style={{ fontSize:12, opacity:0.9, marginTop:2 }}>You are currently with the doctor</div>
                </div>
              </div>
            )}
            {data.status === "skipped" && (
              <div style={{ ...S.banner, background:"linear-gradient(90deg,#ef4444,#dc2626)", marginBottom:16 }}>
                <span style={{ fontSize:24 }}>⏭</span>
                <div>
                  <div style={{ fontWeight:800, fontSize:15 }}>Your Token Was Skipped</div>
                  <div style={{ fontSize:12, opacity:0.9, marginTop:2 }}>Please contact OPD staff for help</div>
                </div>
              </div>
            )}

            {/* Stats row */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
              <StatBox
                icon="🔔" label="Now Calling"
                value={data.current_token ? `#${data.current_token}` : "—"}
              />
              <StatBox
                icon="👥" label="Ahead of You"
                highlight={isMyTurn}
                value={
                  data.opd_paused
                    ? <span style={{ fontSize:11, color:"#f59e0b", fontWeight:600 }}>⏸ Paused</span>
                    : !isConfirmed
                    ? <span style={{ fontSize:11, color:"#f59e0b", fontWeight:600 }}>Confirm first</span>
                    : !showQueue ? "—"
                    : isMyTurn  ? <span style={{ fontSize:12 }}>You're Next!</span>
                    : ahead
                }
              />
              <StatBox
                icon="⏱" label="Est. Wait"
                highlight={isMyTurn || data.status === "consulting"}
                value={
                  data.opd_paused
                    ? <span style={{ fontSize:11, color:"#f59e0b" }}>Paused</span>
                    : data.status === "consulting" ? "Now!"
                    : data.status === "done"       ? "Done"
                    : !isConfirmed || !showWait    ? "—"
                    : isMyTurn                     ? "Soon!"
                    : `~${waitDisplay}`
                }
              />
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom:20 }}>
              <div style={{ display:"flex", justifyContent:"space-between",
                fontSize:11, color:"#94a3b8", fontWeight:600, marginBottom:8 }}>
                <span>Queue Progress</span>
                {avgDisplay
                  ? <span>~{avgDisplay} per patient</span>
                  : <span style={{ color:"#e2e8f0" }}>OPD not started</span>}
              </div>
              <div style={{ height:8, background:"#f1f5f9", borderRadius:10, overflow:"hidden" }}>
                <div style={{
                  height:"100%", borderRadius:10,
                  background: data.status === "consulting" || data.status === "done"
                    ? "linear-gradient(90deg,#118a7e,#0891b2)"
                    : "linear-gradient(90deg,#0f4c75,#1b6ca8)",
                  width:`${progress}%`, transition:"width 1s ease",
                }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between",
                fontSize:11, color:"#94a3b8", marginTop:6 }}>
                <span>Token #1</span>
                <span>Your Token #{data.token_number}</span>
              </div>
            </div>

            {/* Status pill */}
            <div style={{
              display:"flex", alignItems:"center", gap:12, padding:"14px 16px",
              borderRadius:14, background:meta.bg, border:`1.5px solid ${meta.border}`,
            }}>
              <span style={{ fontSize:22 }}>{meta.icon}</span>
              <span style={{ fontSize:13, color:meta.color, fontWeight:600, lineHeight:1.4 }}>
                {meta.label}
              </span>
            </div>

            {/* ── Action area ── */}
            <div style={{ marginTop:16 }}>
              {canConfirmNow && (
                <>
                  <div style={{ ...S.alertBox, background:"#fffbeb",
                    border:"1.5px solid #fde68a", marginBottom:12 }}>
                    <span style={{ fontSize:20 }}>⚡</span>
                    <div>
                      <div style={{ fontWeight:700, color:"#92400e", fontSize:13 }}>OPD Has Started!</div>
                      <div style={{ color:"#a16207", fontSize:12, marginTop:2 }}>
                        Confirm your attendance now to join the active queue.
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={handleConfirm} disabled={acting}
                      style={{ ...S.primaryBtn, flex:1, opacity: acting ? 0.7 : 1 }}>
                      {acting
                        ? <span style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"center" }}>
                            <span style={S.btnSpinner} /> Confirming...
                          </span>
                        : "✅ Confirm Attendance"}
                    </button>
                    <button onClick={handleReject} disabled={acting} style={S.dangerBtn}>❌ Withdraw</button>
                    <button onClick={() => fetchStatus()} disabled={acting} style={S.iconBtn}>🔄</button>
                  </div>
                </>
              )}

              {confirmationMissed && (
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={handleReject} disabled={acting}
                    style={{ ...S.dangerBtn, flex:1 }}>❌ Withdraw Booking</button>
                  <button onClick={() => fetchStatus()} disabled={acting} style={S.iconBtn}>🔄</button>
                </div>
              )}

              {isPending && (
                <>
                  <div style={{ ...S.alertBox, background:"#f0f9ff",
                    border:"1.5px solid #bae6fd", marginBottom:12 }}>
                    <span style={{ fontSize:20 }}>ℹ️</span>
                    <div>
                      <div style={{ fontWeight:700, color:"#0369a1", fontSize:13 }}>
                        Waiting for OPD to Start
                      </div>
                      <div style={{ color:"#0284c7", fontSize:12, marginTop:2 }}>
                        Once the doctor starts OPD, you'll be prompted to confirm your attendance.
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={handleReject} disabled={acting}
                      style={{ ...S.dangerBtn, flex:1 }}>❌ Withdraw Booking</button>
                    <button onClick={() => fetchStatus()} disabled={acting} style={S.iconBtn}>🔄</button>
                  </div>
                </>
              )}

              {isConfirmed && ["waiting","pending"].includes(data.status) && (
                <div style={{ display:"flex", gap:10 }}>
                  <button onClick={handleReject} disabled={acting}
                    style={{ ...S.dangerBtn, flex:1 }}>❌ Withdraw</button>
                  <button onClick={() => fetchStatus()} disabled={acting} style={S.iconBtn}>🔄</button>
                </div>
              )}

              {["consulting","done","skipped"].includes(data.status) && (
                <div style={{ display:"flex", justifyContent:"center" }}>
                  <button onClick={() => fetchStatus()} disabled={acting} style={S.iconBtn}>
                    🔄 Refresh
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Doctor info card */}
        {data.doctor_name && (
          <div style={{ ...S.infoCard, marginTop:14, display:"flex", alignItems:"center", gap:14 }}>
            <div style={{
              width:46, height:46, borderRadius:"50%",
              background:"linear-gradient(135deg,#0f4c75,#118a7e)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:22, color:"#fff", flexShrink:0,
            }}>👨‍⚕️</div>
            <div>
              <div style={{ fontWeight:700, color:"#0f4c75", fontSize:15 }}>{data.doctor_name}</div>
              <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>
                {data.hospital} · {data.department}
              </div>
            </div>
          </div>
        )}

        {/* Today's prescription */}
        {todaysRx && (todaysRx.diagnosis || todaysRx.medicines) && (
          <div style={{ ...S.infoCard, marginTop:14, borderTop:"4px solid #118a7e" }}>
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
              <span style={{ fontSize:24 }}>💊</span>
              <h3 style={{ margin:0, color:"#0f4c75", fontSize:16, fontWeight:700 }}>
                Today's Prescription
              </h3>
              <span style={{
                marginLeft:"auto", fontSize:11, fontWeight:600,
                background:"#ecfdf5", color:"#065f46",
                padding:"3px 10px", borderRadius:12, border:"1px solid #6ee7b7",
              }}>✅ Just issued</span>
            </div>
            <RxBlock label="Diagnosis"    body={todaysRx.diagnosis} />
            <RxBlock label="Prescription" body={todaysRx.medicines} mono />
          </div>
        )}

        {/* Past prescriptions */}
        <div style={{ marginTop:14 }}>
          <PrescriptionsSection
            prescriptions={prescriptions.filter(p => !(todaysRx && p.booking_id === data?.id))}
            loading={rxLoading}
            open={rxOpen}
            onToggle={() => setRxOpen(o => !o)}
          />
        </div>

        <p style={{ textAlign:"center", fontSize:12, color:"#94a3b8", marginTop:16, marginBottom:8 }}>
          🔄 Auto-refreshes every 15 seconds
        </p>
      </div>
    </div>
  );
}

// ── Stat Box ──────────────────────────────────────────────────────────────────
function StatBox({ icon, label, value, highlight }) {
  return (
    <div style={{
      background:  highlight ? "linear-gradient(135deg,#ecfdf5,#f0fdf9)" : "#f8fafc",
      border:      `1px solid ${highlight ? "#6ee7b7" : "#e2e8f0"}`,
      borderRadius:14, padding:"14px 10px", textAlign:"center", transition:"all 0.3s",
    }}>
      <div style={{ fontSize:20, marginBottom:6 }}>{icon}</div>
      <div style={{ fontWeight:800, fontSize:17, color: highlight ? "#118a7e" : "#0f4c75", minHeight:26 }}>
        {value}
      </div>
      <div style={{ fontSize:11, color:"#94a3b8", marginTop:4, fontWeight:500 }}>{label}</div>
    </div>
  );
}

// ── Prescriptions Section ─────────────────────────────────────────────────────
function PrescriptionsSection({ prescriptions, loading, open, onToggle, style }) {
  const count = prescriptions?.length ?? 0;
  return (
    <div style={{ ...S.infoCard, ...style }}>
      <button onClick={onToggle} style={{
        width:"100%", display:"flex", alignItems:"center", gap:12,
        background:"transparent", border:"none", cursor:"pointer", padding:0, textAlign:"left",
      }}>
        <div style={{
          width:40, height:40, borderRadius:12, flexShrink:0,
          background:"linear-gradient(135deg,#0f4c75,#1b6ca8)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:18, color:"#fff",
        }}>📋</div>
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, color:"#0f4c75", fontSize:14 }}>My Prescriptions</div>
          <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>
            {loading ? "Loading…" : count === 0
              ? "No past prescriptions"
              : `${count} prescription${count === 1 ? "" : "s"} on file`}
          </div>
        </div>
        <span style={{
          fontSize:20, color:"#94a3b8",
          transform: open ? "rotate(90deg)" : "rotate(0deg)",
          transition:"transform 0.2s",
        }}>›</span>
      </button>

      {open && !loading && count > 0 && (
        <div style={{ marginTop:16, display:"flex", flexDirection:"column", gap:12 }}>
          {prescriptions.map(rx => (
            <div key={rx.id} style={{
              background:"#f8fafc", border:"1px solid #e2e8f0",
              borderRadius:14, padding:"14px 16px",
            }}>
              <div style={{ display:"flex", justifyContent:"space-between",
                alignItems:"flex-start", marginBottom:10, gap:8, flexWrap:"wrap" }}>
                <div>
                  <div style={{ fontWeight:700, color:"#0f4c75", fontSize:14 }}>
                    Dr. {rx.doctor_name}
                  </div>
                  <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>
                    {rx.hospital} · {rx.department}
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:12, color:"#0f4c75", fontWeight:600 }}>{rx.booking_date}</div>
                  <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>Token #{rx.token_number}</div>
                </div>
              </div>
              <RxBlock label="Diagnosis"    body={rx.diagnosis} small />
              <RxBlock label="Prescription" body={rx.medicines} small mono />
            </div>
          ))}
        </div>
      )}

      {open && !loading && count === 0 && (
        <div style={{
          marginTop:14, padding:"20px 16px", textAlign:"center",
          background:"#f8fafc", borderRadius:12, color:"#94a3b8", fontSize:13,
        }}>
          Your prescriptions will appear here after your consultations.
        </div>
      )}
    </div>
  );
}

// ── Rx Block ──────────────────────────────────────────────────────────────────
function RxBlock({ label, body, small, mono }) {
  if (!body || !body.trim()) return (
    <div style={{ marginBottom: small ? 6 : 10 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#94a3b8",
        letterSpacing:1, marginBottom:4, textTransform:"uppercase" }}>{label}</div>
      <div style={{ fontSize: small ? 12 : 13, color:"#cbd5e1", fontStyle:"italic" }}>—</div>
    </div>
  );
  return (
    <div style={{ marginBottom: small ? 6 : 10 }}>
      <div style={{ fontSize:11, fontWeight:700, color:"#475569",
        letterSpacing:1, marginBottom:4, textTransform:"uppercase" }}>{label}</div>
      <div style={{
        fontSize: small ? 13 : 14, color:"#1e293b", lineHeight:1.55,
        whiteSpace:"pre-wrap", wordBreak:"break-word",
        fontFamily: mono ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "inherit",
        background: mono ? "#fff" : "transparent",
        border: mono ? "1px solid #e2e8f0" : "none",
        borderRadius: mono ? 10 : 0,
        padding: mono ? "10px 12px" : 0,
      }}>{body}</div>
    </div>
  );
}

// ── Keyframes ─────────────────────────────────────────────────────────────────
const KF = `
  @keyframes spin  { to { transform: rotate(360deg); } }
  @keyframes blink { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
  @keyframes glow  { 0%,100% { box-shadow: 0 4px 20px rgba(17,138,126,0.3); }
                     50%      { box-shadow: 0 4px 32px rgba(17,138,126,0.6); } }
  @keyframes flash { 0%,100% { opacity:1; } 50% { opacity:0.85; } }
`;

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight:"100vh",
    background:"linear-gradient(135deg, #0f4c75 0%, #1b6ca8 50%, #118a7e 100%)",
    display:"flex", flexDirection:"column", alignItems:"center",
    padding:"36px 20px 48px", fontFamily:"'DM Sans', sans-serif",
  },

  // Main card wrapper — matches login card exactly
  outerCard: {
    width:"100%", maxWidth:520,
    background:"#ffffff",
    borderRadius:24,
    boxShadow:"0 8px 40px rgba(0,0,0,0.25)",
    overflow:"hidden",
  },

  // Secondary info cards below main card
  infoCard: {
    width:"100%", maxWidth:520,
    background:"#ffffff",
    borderRadius:20,
    boxShadow:"0 4px 20px rgba(0,0,0,0.12)",
    padding:"20px 24px",
    overflow:"hidden",
  },

  // Gradient header band — same gradient as login header
  headerBand: {
    background:"linear-gradient(135deg, #0f4c75 0%, #1b6ca8 60%, #118a7e 100%)",
    padding:"28px 32px 24px",
  },

  headerTitle: {
    fontWeight:800, fontSize:22, color:"#fff", margin:"8px 0 4px",
  },

  headerSub: {
    color:"#bae6fd", fontSize:13, margin:0,
  },

  liveChip: {
    display:"inline-flex", alignItems:"center", gap:8,
    background:"rgba(255,255,255,0.12)", borderRadius:30,
    padding:"6px 14px", color:"#e0f2fe", fontSize:13, fontWeight:500,
  },

  liveDot: {
    width:8, height:8, borderRadius:"50%", background:"#4ade80",
    display:"inline-block", animation:"blink 1.5s ease-in-out infinite",
  },

  autoRefreshChip: {
    display:"inline-flex", alignItems:"center", gap:8,
    background:"#f0fdf9", color:"#065f46", border:"1px solid #6ee7b7",
    borderRadius:20, padding:"6px 14px", fontSize:12, fontWeight:500,
  },

  banner: {
    display:"flex", alignItems:"center", gap:14, color:"#fff",
    padding:"14px 18px", borderRadius:14,
    boxShadow:"0 4px 16px rgba(0,0,0,0.15)",
  },

  alertBox: {
    display:"flex", alignItems:"flex-start", gap:12,
    padding:"14px 16px", borderRadius:12,
  },

  // Buttons — same style as Login's Sign In button
  primaryBtn: {
    background:"linear-gradient(90deg, #0f4c75, #118a7e)",
    border:"none", width:"100%", padding:"13px 20px",
    borderRadius:12, fontWeight:700, fontSize:14, color:"#fff",
    fontFamily:"'DM Sans', sans-serif",
    boxShadow:"0 4px 20px rgba(15,76,117,0.35)",
    cursor:"pointer",
  },

  dangerBtn: {
    background:"#fef2f2", color:"#dc2626",
    border:"1.5px solid #fca5a5", borderRadius:12,
    padding:"13px 16px", fontWeight:600, fontSize:14,
    fontFamily:"'DM Sans', sans-serif", cursor:"pointer",
  },

  outlineBtn: {
    background:"rgba(255,255,255,0.12)", color:"#fff",
    border:"2px solid rgba(255,255,255,0.4)", borderRadius:12,
    padding:"11px 28px", fontWeight:700, fontSize:14,
    fontFamily:"'DM Sans', sans-serif", cursor:"pointer",
    backdropFilter:"blur(8px)",
  },

  iconBtn: {
    background:"#f1f5f9", color:"#475569",
    border:"1px solid #e2e8f0", borderRadius:12,
    padding:"13px 16px", fontWeight:600, fontSize:16,
    fontFamily:"'DM Sans', sans-serif", cursor:"pointer",
  },

  spinner: {
    width:44, height:44, borderRadius:"50%",
    border:"3px solid #e2e8f0", borderTopColor:"#0f4c75",
    animation:"spin 0.8s linear infinite", margin:"0 auto",
  },

  btnSpinner: {
    width:14, height:14, borderRadius:"50%",
    border:"2px solid rgba(255,255,255,0.4)",
    borderTopColor:"#fff", animation:"spin 0.8s linear infinite",
    display:"inline-block",
  },

  loadingCard: {
    width:"100%", maxWidth:440,
    background:"#ffffff", borderRadius:24,
    boxShadow:"0 8px 40px rgba(0,0,0,0.25)",
    overflow:"hidden",
  },
};
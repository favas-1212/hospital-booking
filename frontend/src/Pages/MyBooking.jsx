import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { getBookingHistory, cancelBooking } from "../services/allApi";
import AppNavbar from "../components/AppNavbar";

const STATUS_COLOR = {
  pending:    { bg:"#fef9c3", color:"#92400e", label:"Pending" },
  approved:   { bg:"#dbeafe", color:"#1e40af", label:"Approved" },
  waiting:    { bg:"#ede9fe", color:"#5b21b6", label:"Waiting" },
  consulting: { bg:"#d1fae5", color:"#065f46", label:"Consulting" },
  done:       { bg:"#f0fdf4", color:"#166534", label:"Done" },
  skipped:    { bg:"#fee2e2", color:"#991b1b", label:"Skipped" },
};

const PAY_COLOR = {
  pending: "#f59e0b", paid: "#10b981", failed: "#ef4444", offline: "#6366f1",
};

function MyBookings() {
  const navigate    = useNavigate();
  const [bookings,   setBookings]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await getBookingHistory();
      setBookings(res.data);
    } catch (err) {
      if (err.response?.status === 401) { navigate("/login"); return; }
      toast.error("Failed to load bookings");
    } finally { setLoading(false); }
  };

  const handleCancel = async (id) => {
    if (!window.confirm("Cancel this booking?")) return;
    setCancelling(id);
    try {
      await cancelBooking(id);
      toast.success("Booking cancelled");
      setBookings(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.error || "Cancellation failed");
    } finally { setCancelling(null); }
  };

  if (loading) return (
    <>
      <AppNavbar />
      <div style={S.pageWrap}>
        <div style={S.orb1} /><div style={S.orb2} />
        <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
          <div style={S.spinner} />
          <p style={{ color:"#bae6fd", fontSize:14, fontFamily:"'DM Sans',sans-serif", margin:0 }}>Loading your bookings…</p>
        </div>
      </div>
    </>
  );

  return (
    <>
      <AppNavbar />
      <div style={S.pageWrap}>
        {/* Decorative orbs — same as Login */}
        <div style={S.orb1} />
        <div style={S.orb2} />

        <div style={{ position:"relative", zIndex:1, width:"100%", maxWidth:1200, padding:"0 16px" }}>

          {/* ── Portal card ── */}
          <div style={S.portalCard}>

            {/* Card header — mirrors Login header */}
            <div style={S.cardHeader}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:16 }}>
                <div>
                  <div style={S.pill}>
                    <span style={S.pillDot} />
                    <span style={{ color:"#e0f2fe", fontSize:13, fontWeight:500 }}>MedQueue Portal</span>
                  </div>
                  <h2 style={S.headerTitle}>My Bookings</h2>
                  <p style={S.headerSub}>
                    {bookings.length} total booking{bookings.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <button onClick={() => navigate("/booking")} style={S.newBtn}>
                  + New Booking
                </button>
              </div>
            </div>

            {/* Card body */}
            <div style={S.cardBody}>
              {bookings.length === 0 ? (
                <div style={S.emptyState}>
                  <div style={{ fontSize:52, marginBottom:14 }}>📋</div>
                  <h4 style={{ color:"#0f172a", margin:0, fontFamily:"'DM Sans',sans-serif", fontWeight:800 }}>No bookings yet</h4>
                  <p style={{ color:"#64748b", margin:"8px 0 24px", fontSize:14 }}>Book your first OPD token now</p>
                  <button onClick={() => navigate("/booking")} style={S.primaryBtn}>Book Now</button>
                </div>
              ) : (
                <div style={S.grid}>
                  {bookings.map(b => {
                    const st = STATUS_COLOR[b.status] || { bg:"#f1f5f9", color:"#475569", label: b.status };
                    const canCancel = ["pending","waiting"].includes(b.status);
                    return (
                      <div key={b.id} style={S.bookingCard}>

                        {/* Token + status */}
                        <div style={S.cardTop}>
                          <div>
                            <div style={S.tokenNum}>#{b.token_number}</div>
                            <div style={S.tokenLabel}>Token</div>
                          </div>
                          <span style={{ ...S.badge, background:st.bg, color:st.color }}>{st.label}</span>
                        </div>

                        <div style={S.divider} />

                        {/* Info rows */}
                        {[
                          { label:"Hospital",   val: b.hospital },
                          { label:"Department", val: b.department },
                          { label:"Doctor",     val: b.doctor_name },
                          { label:"Date",       val: b.booking_date },
                          { label:"Session",    val: b.session_display || b.session },
                        ].map(({ label, val }) => (
                          <div key={label} style={S.infoRow}>
                            <span style={S.infoLabel}>{label}</span>
                            <span style={S.infoVal}>{val || "—"}</span>
                          </div>
                        ))}

                        {/* Payment row */}
                        <div style={{ ...S.infoRow, marginTop:10, paddingTop:10, borderTop:"1px solid #f1f5f9" }}>
                          <span style={{ ...S.infoLabel, fontSize:12 }}>Payment</span>
                          <span style={{ fontSize:12, fontWeight:700, color: PAY_COLOR[b.payment_status] || "#475569", textTransform:"capitalize" }}>
                            {b.payment_status}
                          </span>
                        </div>

                        {/* Confirmation notice */}
                        {b.payment_status === "paid" && (
                          <div style={{ marginTop:6, fontSize:12, color: b.is_confirmed ? "#10b981" : "#f59e0b", fontFamily:"'DM Sans',sans-serif" }}>
                            {b.is_confirmed ? "Attendance confirmed" : "Confirm attendance when OPD starts"}
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ marginTop:16, display:"flex", gap:8 }}>
                          {canCancel && (
                            <button
                              onClick={() => handleCancel(b.id)}
                              disabled={cancelling === b.id}
                              style={{ ...S.dangerBtn, flex:1 }}
                            >
                              {cancelling === b.id ? "Cancelling…" : "Cancel"}
                            </button>
                          )}
                          {b.status === "waiting" && b.payment_status === "paid" && !b.is_confirmed && (
                            <button
                              onClick={() => navigate("/patient/status")}
                              style={{ ...S.primaryBtn, flex:1, padding:"9px 10px", fontSize:13 }}
                            >
                              Confirm Now
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

/* ── Styles (mirroring Login's palette & shapes) ── */
const S = {
  /* Page */
  pageWrap: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #0f4c75 0%, #1b6ca8 50%, #118a7e 100%)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    padding: "48px 0 64px",
    fontFamily: "'DM Sans', sans-serif",
    position: "relative",
    overflow: "hidden",
  },

  /* Decorative orbs — same radii/positions as Login */
  orb1: {
    position:"absolute", width:400, height:400, borderRadius:"50%",
    background:"rgba(255,255,255,0.04)", top:-80, right:-80, pointerEvents:"none",
  },
  orb2: {
    position:"absolute", width:250, height:250, borderRadius:"50%",
    background:"rgba(255,255,255,0.04)", bottom:40, left:-60, pointerEvents:"none",
  },

  /* Portal card */
  portalCard: {
    width:"100%",
    background:"#ffffff",
    borderRadius:24,
    boxShadow:"0 8px 40px rgba(0,0,0,0.25)",
    overflow:"hidden",
    animation:"fadeUp 0.45s ease both",
  },

  /* Card header — identical gradient to Login header */
  cardHeader: {
    background:"linear-gradient(135deg, #0f4c75 0%, #1b6ca8 60%, #118a7e 100%)",
    padding:"28px 36px 24px",
  },

  pill: {
    display:"inline-flex", alignItems:"center", gap:8,
    background:"rgba(255,255,255,0.12)", borderRadius:30, padding:"6px 16px", marginBottom:14,
  },
  pillDot: {
    width:8, height:8, borderRadius:"50%", background:"#4ade80", display:"inline-block",
  },

  headerTitle: {
    fontWeight:800, fontSize:26, color:"#fff", margin:"0 0 4px",
    fontFamily:"'DM Sans',sans-serif",
  },
  headerSub: { color:"#bae6fd", fontSize:14, margin:0 },

  /* "+ New Booking" button — matches Login's Sign In style */
  newBtn: {
    background:"rgba(255,255,255,0.15)",
    border:"1.5px solid rgba(255,255,255,0.35)",
    color:"#fff",
    borderRadius:12,
    padding:"10px 22px",
    fontWeight:700,
    fontSize:14,
    cursor:"pointer",
    fontFamily:"'DM Sans',sans-serif",
    backdropFilter:"blur(4px)",
    transition:"background 0.2s",
  },

  /* Card body */
  cardBody: { padding:"28px 36px 36px" },

  /* Grid of booking cards */
  grid: {
    display:"grid",
    gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))",
    gap:20,
  },

  /* Individual booking card */
  bookingCard: {
    background:"#f8fafc",
    borderRadius:14,
    padding:"20px",
    border:"1px solid #e2e8f0",
    boxShadow:"0 2px 12px rgba(15,76,117,0.06)",
    transition:"box-shadow 0.2s, transform 0.2s",
  },

  cardTop: {
    display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14,
  },

  tokenNum: { fontSize:28, fontWeight:800, color:"#0f4c75", lineHeight:1 },
  tokenLabel: { fontSize:11, color:"#94a3b8", marginTop:2 },

  divider: { height:1, background:"#e2e8f0", marginBottom:12 },

  badge: {
    padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700,
    fontFamily:"'DM Sans',sans-serif",
  },

  infoRow: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 },
  infoLabel: { fontSize:13, color:"#94a3b8", minWidth:90 },
  infoVal: { fontSize:13, fontWeight:600, color:"#1e293b", textAlign:"right" },

  /* Buttons — same gradient as Login's Sign In */
  primaryBtn: {
    background:"linear-gradient(90deg, #0f4c75, #118a7e)",
    color:"#fff",
    border:"none",
    borderRadius:10,
    padding:"10px 20px",
    fontWeight:700,
    fontSize:14,
    cursor:"pointer",
    fontFamily:"'DM Sans',sans-serif",
    boxShadow:"0 4px 20px rgba(15,76,117,0.25)",
  },
  dangerBtn: {
    background:"#fef2f2",
    color:"#dc2626",
    border:"1px solid #fca5a5",
    borderRadius:10,
    padding:"9px 10px",
    fontWeight:700,
    fontSize:13,
    cursor:"pointer",
    fontFamily:"'DM Sans',sans-serif",
  },

  /* Empty state */
  emptyState: {
    background:"#fff",
    borderRadius:16,
    padding:"60px 40px",
    textAlign:"center",
    border:"1px solid #e2e8f0",
    boxShadow:"0 2px 16px rgba(15,76,117,0.06)",
    maxWidth:400,
    margin:"0 auto",
  },

  /* Spinner */
  spinner: {
    width:40, height:40, borderRadius:"50%",
    border:"3px solid rgba(255,255,255,0.2)",
    borderTopColor:"#fff",
    animation:"spin 0.8s linear infinite",
  },
};

export default MyBookings;
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { getBookingHistory, cancelBooking } from "../services/allApi";

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
  const navigate  = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [cancelling, setCancelling] = useState(null);

  useEffect(() => {
    const token = sessionStorage.getItem("token");
    if (!token) { navigate("/login"); return; }
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await getBookingHistory();   // GET /booking/patient/history/
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
      await cancelBooking(id);               // DELETE /booking/patient/cancel/<id>/
      toast.success("Booking cancelled");
      setBookings(prev => prev.filter(b => b.id !== id));
    } catch (err) {
      toast.error(err.response?.data?.error || "Cancellation failed");
    } finally { setCancelling(null); }
  };

  if (loading) return (
    <div style={S.page}>
      <div style={S.spinner}></div>
      <p style={{ color:"#64748b", marginTop:16 }}>Loading your bookings...</p>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={{ width:"100%", maxWidth:900 }}>
        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:32 }}>
          <div>
            <h2 style={S.pageTitle}>My Bookings</h2>
            <p style={S.pageSub}>{bookings.length} total booking{bookings.length !== 1 ? "s" : ""}</p>
          </div>
          <button onClick={() => navigate("/booking")} style={S.primaryBtn}>
            + New Booking
          </button>
        </div>

        {bookings.length === 0 ? (
          <div style={S.emptyCard}>
            <div style={{ fontSize:48, marginBottom:16 }}>📋</div>
            <h4 style={{ color:"#1e293b", margin:0 }}>No bookings yet</h4>
            <p style={{ color:"#64748b", margin:"8px 0 20px" }}>Book your first OPD token now</p>
            <button onClick={() => navigate("/booking")} style={S.primaryBtn}>Book Now</button>
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:20 }}>
            {bookings.map(b => {
              const st = STATUS_COLOR[b.status] || { bg:"#f1f5f9", color:"#475569", label: b.status };
              const canCancel = ["pending","waiting"].includes(b.status);
              return (
                <div key={b.id} style={S.bookingCard}>
                  {/* Top row */}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
                    <div>
                      <div style={{ fontSize:28, fontWeight:800, color:"#0f4c75", lineHeight:1 }}>
                        #{b.token_number}
                      </div>
                      <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>Token</div>
                    </div>
                    <span style={{ ...S.badge, background:st.bg, color:st.color }}>{st.label}</span>
                  </div>

                  {/* Info rows */}
                  {[
                    { icon:"🏥", label:"Hospital",   val: b.hospital },
                    { icon:"🧬", label:"Department", val: b.department },
                    { icon:"👨‍⚕️", label:"Doctor",     val: b.doctor_name },
                    { icon:"📅", label:"Date",       val: b.booking_date },
                    { icon:"🕐", label:"Session",    val: b.session_display || b.session },
                  ].map(({ icon, label, val }) => (
                    <div key={label} style={S.infoRow}>
                      <span style={{ fontSize:13, color:"#94a3b8", minWidth:88 }}>{icon} {label}</span>
                      <span style={{ fontSize:13, fontWeight:600, color:"#1e293b", textAlign:"right" }}>{val || "—"}</span>
                    </div>
                  ))}

                  {/* Payment */}
                  <div style={{ ...S.infoRow, marginTop:10, paddingTop:10, borderTop:"1px solid #f1f5f9" }}>
                    <span style={{ fontSize:12, color:"#94a3b8" }}>💳 Payment</span>
                    <span style={{ fontSize:12, fontWeight:700, color: PAY_COLOR[b.payment_status] || "#475569", textTransform:"capitalize" }}>
                      {b.payment_status}
                    </span>
                  </div>

                  {/* Confirmation */}
                  {b.payment_status === "paid" && (
                    <div style={{ marginTop:6, fontSize:12, color: b.is_confirmed ? "#10b981" : "#f59e0b" }}>
                      {b.is_confirmed ? "✅ Attendance confirmed" : "⚠️ Confirm attendance when OPD starts"}
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ marginTop:14, display:"flex", gap:8 }}>
                    {canCancel && (
                      <button
                        onClick={() => handleCancel(b.id)}
                        disabled={cancelling === b.id}
                        style={{ ...S.dangerBtn, flex:1 }}
                      >
                        {cancelling === b.id ? "Cancelling..." : "Cancel"}
                      </button>
                    )}
                    {b.status === "waiting" && b.payment_status === "paid" && !b.is_confirmed && (
                      <button
                        onClick={() => navigate("/patient/status")}
                        style={{ ...S.primaryBtn, flex:1, padding:"8px 10px", fontSize:13 }}
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
  );
}

const S = {
  page:        { minHeight:"100vh", background:"#f8fafc", display:"flex", flexDirection:"column", alignItems:"center", padding:"40px 20px" },
  pageTitle:   { fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:700, color:"#0f4c75", margin:0 },
  pageSub:     { color:"#94a3b8", fontSize:14, marginTop:4 },
  spinner:     { width:40, height:40, borderRadius:"50%", border:"3px solid #e2e8f0", borderTopColor:"#0f4c75", animation:"spin 0.8s linear infinite" },
  emptyCard:   { background:"#fff", borderRadius:16, padding:"60px 40px", textAlign:"center", boxShadow:"0 2px 16px rgba(0,0,0,0.06)" },
  bookingCard: { background:"#fff", borderRadius:14, padding:"20px", boxShadow:"0 2px 12px rgba(0,0,0,0.07)", border:"1px solid #f1f5f9", transition:"box-shadow 0.2s" },
  infoRow:     { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 },
  badge:       { padding:"4px 10px", borderRadius:20, fontSize:11, fontWeight:700 },
  primaryBtn:  { background:"linear-gradient(90deg,#0f4c75,#118a7e)", color:"#fff", border:"none", borderRadius:10, padding:"10px 20px", fontWeight:600, fontSize:14, cursor:"pointer" },
  dangerBtn:   { background:"#fef2f2", color:"#dc2626", border:"1px solid #fca5a5", borderRadius:10, padding:"8px 10px", fontWeight:600, fontSize:13, cursor:"pointer" },
};

export default MyBookings;

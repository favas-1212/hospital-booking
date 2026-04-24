// BookingDetails.jsx — shown after online booking succeeds
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PayButton from "../components/PayButton";

export function BookingDetails() {
  const { state: b } = useLocation();
  const navigate = useNavigate();

  if (!b?.id) return (
    <div style={S.page}>
      <div style={S.card}>
        <h4 style={{ color:"#dc2626" }}>No booking details found.</h4>
        <button onClick={() => navigate("/booking")} style={S.btn}>Go Back</button>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Success icon */}
        <div style={S.successCircle}>✓</div>
        <h2 style={S.title}>Token Booked!</h2>
        <p style={{ color:"#64748b", fontSize:14, margin:"0 0 24px" }}>
          Your OPD ticket has been emailed to you.
        </p>

        {/* Big token number */}
        <div style={S.tokenBox}>
          <div style={{ fontSize:12, color:"#94a3b8", marginBottom:4 }}>YOUR TOKEN</div>
          <div style={{ fontSize:56, fontWeight:800, color:"#0f4c75", lineHeight:1 }}>
            #{b.token_number}
          </div>
          <div style={{ fontSize:12, color:"#94a3b8", marginTop:4 }}>Online Token</div>
        </div>

        {/* Details */}
        <div style={{ marginBottom:20 }}>
          {[
            { icon:"🏥", label:"Hospital",   val: b.hospital },
            { icon:"🧬", label:"Department", val: b.department },
            { icon:"👨‍⚕️", label:"Doctor",     val: b.doctor },
            { icon:"📅", label:"Date",       val: b.date },
            { icon:"🕐", label:"Session",    val: b.session === "morning" ? "Morning (10AM–12PM)" : "Evening (3PM–5PM)" },
          ].map(({ icon, label, val }) => (
            <div key={label} style={S.row}>
              <span style={{ color:"#94a3b8", fontSize:13 }}>{icon} {label}</span>
              <span style={{ fontSize:13, fontWeight:600, color:"#1e293b" }}>{val}</span>
            </div>
          ))}
        </div>

        {/* Payment */}
        {b.payment_status === "pending" && (
          <div style={{ marginBottom:20 }}>
            <div style={{ background:"#fef9c3", border:"1px solid #fcd34d", borderRadius:10, padding:"12px 14px", marginBottom:14, fontSize:13, color:"#92400e" }}>
              ⚠️ <b>Payment pending.</b> Complete payment to confirm your slot. Token is held for 10 minutes.
            </div>
            <PayButton
              bookingId={b.id}
              amount={b.amount || 50}
              onSuccess={(data) => {
                navigate("/bookingdetails", {
                  state: { ...b, payment_status: "paid" },
                  replace: true,
                });
              }}
            />
          </div>
        )}
        {b.payment_status === "paid" && (
          <div style={{ background:"#ecfdf5", border:"1px solid #6ee7b7", borderRadius:10, padding:"12px 14px", marginBottom:20, fontSize:13, color:"#065f46" }}>
            ✅ Payment confirmed! You will receive a reminder 30 minutes before OPD starts.
          </div>
        )}

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => navigate("/mybookings")} style={{ ...S.btn, flex:1 }}>
            My Bookings
          </button>
          <button onClick={() => navigate("/patient/status")} style={{ ...S.outlineBtn, flex:1 }}>
            Track Status
          </button>
        </div>
      </div>
    </div>
  );
}

export function OfflineBookingDetails() {
  const { state: b } = useLocation();
  const navigate = useNavigate();

  if (!b?.id) return (
    <div style={S.page}>
      <div style={S.card}>
        <h4 style={{ color:"#dc2626" }}>No booking details found.</h4>
        <button onClick={() => navigate(-1)} style={S.btn}>Go Back</button>
      </div>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={{ ...S.successCircle, background:"#059669" }}>✓</div>
        <h2 style={S.title}>Walk-in Token Booked</h2>
        <p style={{ color:"#64748b", fontSize:14, margin:"0 0 24px" }}>
          Token issued at the OPD counter
        </p>

        <div style={S.tokenBox}>
          <div style={{ fontSize:12, color:"#94a3b8", marginBottom:4 }}>TOKEN NUMBER</div>
          <div style={{ fontSize:56, fontWeight:800, color:"#0f4c75", lineHeight:1 }}>#{b.token}</div>
          <div style={{ fontSize:12, color:"#94a3b8", marginTop:4 }}>Walk-in Token</div>
        </div>

        <div style={{ marginBottom:20 }}>
          {[
            { icon:"👤", label:"Patient",    val: b.patient_name },
            { icon:"👨‍⚕️", label:"Doctor",     val: b.doctor },
            { icon:"🧬", label:"Department", val: b.department },
            { icon:"🏥", label:"Hospital",   val: b.hospital },
            { icon:"📅", label:"Date",       val: b.date },
            { icon:"🕐", label:"Session",    val: b.session === "morning" ? "Morning (10AM–12PM)" : "Evening (3PM–5PM)" },
          ].map(({ icon, label, val }) => (
            <div key={label} style={S.row}>
              <span style={{ color:"#94a3b8", fontSize:13 }}>{icon} {label}</span>
              <span style={{ fontSize:13, fontWeight:600, color:"#1e293b" }}>{val}</span>
            </div>
          ))}
        </div>

        <div style={{ background:"#ecfdf5", border:"1px solid #6ee7b7", borderRadius:10, padding:"12px 14px", marginBottom:20, fontSize:13, color:"#065f46" }}>
          ✅ Walk-in token is pre-approved and added to the queue.
        </div>

        <button onClick={() => navigate(-1)} style={{ ...S.btn, width:"100%" }}>
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
}

const S = {
  page:         { minHeight:"100vh", background:"linear-gradient(135deg,#0f4c75,#118a7e)", display:"flex", alignItems:"center", justifyContent:"center", padding:"32px 16px" },
  card:         { width:"100%", maxWidth:440, background:"#fff", borderRadius:20, padding:"36px 32px", boxShadow:"0 20px 60px rgba(0,0,0,0.18)", textAlign:"center" },
  successCircle:{ width:60, height:60, borderRadius:"50%", background:"linear-gradient(135deg,#0f4c75,#118a7e)", color:"#fff", fontSize:28, display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:16 },
  title:        { fontFamily:"'Playfair Display',serif", fontSize:24, fontWeight:700, color:"#0f4c75", margin:"0 0 8px" },
  tokenBox:     { background:"#f0f9ff", border:"2px dashed #bae6fd", borderRadius:14, padding:"20px", marginBottom:24 },
  row:          { display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:"1px solid #f1f5f9" },
  btn:          { background:"linear-gradient(90deg,#0f4c75,#118a7e)", color:"#fff", border:"none", borderRadius:10, padding:"12px 20px", fontWeight:600, fontSize:14, cursor:"pointer" },
  outlineBtn:   { background:"transparent", color:"#0f4c75", border:"2px solid #0f4c75", borderRadius:10, padding:"12px 20px", fontWeight:600, fontSize:14, cursor:"pointer" },
};

// BookingDetails.jsx — shown after online booking succeeds
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PayButton from "../components/PayButton";

// ── Shared decorative page wrapper ──────────────────────────
function PageWrapper({ children }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0f4c75 0%, #1b6ca8 50%, #118a7e 100%)",
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'DM Sans', sans-serif",
      position: "relative",
      overflow: "hidden",
      padding: "32px 16px",
    }}>
      <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:"rgba(255,255,255,0.04)", top:-80, right:-80, pointerEvents:"none" }} />
      <div style={{ position:"absolute", width:250, height:250, borderRadius:"50%", background:"rgba(255,255,255,0.04)", bottom:40, left:-60, pointerEvents:"none" }} />
      <div style={{
        width: "100%",
        maxWidth: 480,
        background: "#ffffff",
        borderRadius: 24,
        boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
        overflow: "hidden",
        position: "relative",
        zIndex: 1,
      }}>
        {children}
      </div>
    </div>
  );
}

// ── Shared card header ───────────────────────────────────────
function CardHeader({ icon, title, subtitle }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #0f4c75 0%, #1b6ca8 60%, #118a7e 100%)",
      padding: "28px 36px 24px",
      textAlign: "center",
    }}>
      <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
        <div style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(255,255,255,0.12)",
          borderRadius: 30,
          padding: "6px 16px",
        }}>
          <span style={{ width:8, height:8, borderRadius:"50%", background:"#4ade80", display:"inline-block" }} />
          <span style={{ color:"#e0f2fe", fontSize:13, fontWeight:500 }}>MedQueue Portal</span>
        </div>
      </div>
      <div style={{
        width: 56, height: 56, borderRadius: "50%",
        background: "rgba(255,255,255,0.18)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 26, marginBottom: 12,
      }}>
        {icon}
      </div>
      <h4 style={{ fontWeight:800, fontSize:26, color:"#fff", margin:"0 0 6px" }}>{title}</h4>
      <p style={{ color:"#bae6fd", fontSize:14, margin:0 }}>{subtitle}</p>
    </div>
  );
}

// ── Detail row ───────────────────────────────────────────────
function DetailRow({ icon, label, val }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "10px 0",
      borderBottom: "1px solid #f1f5f9",
    }}>
      <span style={{ color:"#64748b", fontSize:13 }}>{icon} {label}</span>
      <span style={{ fontSize:13, fontWeight:600, color:"#0f172a" }}>{val}</span>
    </div>
  );
}

// ── Online Booking Details ───────────────────────────────────
export function BookingDetails() {
  const { state: b } = useLocation();
  const navigate = useNavigate();

  if (!b?.id) return (
    <PageWrapper>
      <CardHeader icon="⚠️" title="Oops!" subtitle="No booking details found" />
      <div style={{ padding:"28px 36px 32px", textAlign:"center" }}>
        <p style={{ color:"#64748b", fontSize:14, marginBottom:24 }}>
          We couldn't find any booking information to display.
        </p>
        <button onClick={() => navigate("/booking")} style={S.btn}>
          ← Go Back to Booking
        </button>
      </div>
    </PageWrapper>
  );

  return (
    <PageWrapper>
      <CardHeader
        icon="✅"
        title="Token Booked!"
        subtitle="Your OPD ticket has been emailed to you"
      />

      <div style={{ padding:"28px 36px 32px" }}>

        {/* Token number box */}
        <div style={{
          background: "#f0f9ff",
          border: "1.5px dashed #bae6fd",
          borderRadius: 14,
          padding: "20px",
          marginBottom: 24,
          textAlign: "center",
        }}>
          <div style={{ fontSize:12, color:"#94a3b8", marginBottom:4, fontWeight:500, letterSpacing:1, textTransform:"uppercase" }}>Your Token</div>
          <div style={{ fontSize:56, fontWeight:800, color:"#0f4c75", lineHeight:1 }}>#{b.token_number}</div>
          <div style={{ fontSize:12, color:"#94a3b8", marginTop:6, fontWeight:500 }}>Online Token</div>
        </div>

        {/* Details */}
        <div style={{ marginBottom: 20 }}>
          {[
            {  label:"Hospital",   val: b.hospital },
            {  label:"Department", val: b.department },
            {  label:"Doctor",     val: b.doctor },
            {  label:"Date",       val: b.date },
            {  label:"Session",    val: b.session === "morning" ? "Morning (10AM–12PM)" : "Evening (3PM–5PM)" },
          ].map(row => <DetailRow key={row.label} {...row} />)}
        </div>

        {/* Payment */}
        {b.payment_status === "pending" && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              background: "#fef9c3",
              border: "1px solid #fcd34d",
              borderRadius: 10,
              padding: "12px 14px",
              marginBottom: 14,
              fontSize: 13,
              color: "#92400e",
            }}>
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
          <div style={{
            background: "#ecfdf5",
            border: "1px solid #6ee7b7",
            borderRadius: 10,
            padding: "12px 14px",
            marginBottom: 20,
            fontSize: 13,
            color: "#065f46",
            fontWeight: 500,
          }}>
            ✅ Payment confirmed! You will receive a reminder 30 minutes before OPD starts.
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display:"flex", gap:10 }}>
          <button onClick={() => navigate("/mybookings")} style={{ ...S.btn, flex:1 }}>
            My Bookings
          </button>
          <button onClick={() => navigate("/patient/status")} style={{ ...S.outlineBtn, flex:1 }}>
            Track Status
          </button>
        </div>
      </div>
    </PageWrapper>
  );
}

// ── Offline / Walk-in Booking Details ───────────────────────
export function OfflineBookingDetails() {
  const { state: b } = useLocation();
  const navigate = useNavigate();

  if (!b?.id) return (
    <PageWrapper>
      <CardHeader icon="" title="Oops!" subtitle="No booking details found" />
      <div style={{ padding:"28px 36px 32px", textAlign:"center" }}>
        <p style={{ color:"#64748b", fontSize:14, marginBottom:24 }}>
          We couldn't find any booking information to display.
        </p>
        <button onClick={() => navigate(-1)} style={S.btn}>
          ← Go Back
        </button>
      </div>
    </PageWrapper>
  );

  return (
    <PageWrapper>
      <CardHeader
        icon=""
        title="Walk-in Token Booked"
        subtitle="Token issued at the OPD counter"
      />

      <div style={{ padding:"28px 36px 32px" }}>

        {/* Token number box */}
        <div style={{
          background: "#f0fdf4",
          border: "1.5px dashed #6ee7b7",
          borderRadius: 14,
          padding: "20px",
          marginBottom: 24,
          textAlign: "center",
        }}>
          <div style={{ fontSize:12, color:"#94a3b8", marginBottom:4, fontWeight:500, letterSpacing:1, textTransform:"uppercase" }}>Token Number</div>
          <div style={{ fontSize:56, fontWeight:800, color:"#059669", lineHeight:1 }}>#{b.token}</div>
          <div style={{ fontSize:12, color:"#94a3b8", marginTop:6, fontWeight:500 }}>Walk-in Token</div>
        </div>

        {/* Details */}
        <div style={{ marginBottom: 20 }}>
          {[
            {  label:"Patient",    val: b.patient_name },
            {  label:"Doctor",     val: b.doctor },
            {  label:"Department", val: b.department },
            {  label:"Hospital",   val: b.hospital },
            {  label:"Date",       val: b.date },
            { label:"Session",    val: b.session === "morning" ? "Morning (10AM–12PM)" : "Evening (3PM–5PM)" },
          ].map(row => <DetailRow key={row.label} {...row} />)}
        </div>

        <div style={{
          background: "#ecfdf5",
          border: "1px solid #6ee7b7",
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 24,
          fontSize: 13,
          color: "#065f46",
          fontWeight: 500,
        }}>
          ✅ Walk-in token is pre-approved and added to the queue.
        </div>

        <button onClick={() => navigate(-1)} style={{ ...S.btn, width:"100%" }}>
          ← Back to Dashboard
        </button>
      </div>
    </PageWrapper>
  );
}

const S = {
  btn: {
    background: "linear-gradient(90deg, #0f4c75, #118a7e)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    padding: "12px 20px",
    fontWeight: 700,
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    boxShadow: "0 4px 20px rgba(15,76,117,0.3)",
    transition: "all 0.2s",
  },
  outlineBtn: {
    background: "transparent",
    color: "#1b6ca8",
    border: "1.5px solid #1b6ca8",
    borderRadius: 12,
    padding: "12px 20px",
    fontWeight: 700,
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    transition: "all 0.2s",
  },
};
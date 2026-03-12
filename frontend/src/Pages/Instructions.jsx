import React, { useState } from "react";
import { Link } from "react-router-dom";
import AppNavbar from "../components/AppNavbar";
import Footer from "../components/Footer";

const sections = [
  {
    icon: "🎟️",
    title: "Token System",
    color: "#0f4c75",
    items: [
      "Each doctor has 60 tokens per session: Morning (10AM–12PM) and Evening (3PM–5PM).",
      "Tokens 1–15 and 36–60 are reserved for walk-in patients at the OPD counter.",
      "Tokens 16–35 (20 slots) are available for online booking.",
      "Token numbers are fixed once booked and cannot be changed.",
    ],
  },
  {
    icon: "⏰",
    title: "Booking Cutoff Times",
    color: "#1b6ca8",
    items: [
      "Online booking for Morning sessions closes at 8:00 AM on the day of the appointment.",
      "Online booking for Evening sessions closes at 1:00 PM on the same day.",
      "Bookings can be made up to 7 days in advance.",
      "Once the cutoff passes, no new online tokens can be issued for that session.",
    ],
  },
  {
    icon: "💳",
    title: "Payment Policy",
    color: "#118a7e",
    items: [
      "Booking is confirmed only after successful Razorpay payment.",
      "Your PDF ticket is automatically emailed after payment.",
      "Unpaid bookings will not hold your token slot.",
      "Refunds are subject to the hospital's cancellation policy.",
    ],
  },
  {
    icon: "✅",
    title: "Attendance & Confirmation",
    color: "#0ea5e9",
    items: [
      "Once the doctor starts OPD, you will receive an email/notification.",
      "You must tap 'Confirm Attendance' in the app to join the active queue.",
      "Patients who do not confirm may be skipped when their token is called.",
      "You will receive a reminder email 30 minutes before OPD starts.",
    ],
  },
  {
    icon: "📡",
    title: "Live Queue Tracking",
    color: "#8b5cf6",
    items: [
      "After confirming attendance, open 'Track My Token' to see real-time updates.",
      "The page auto-refreshes every 15 seconds — no manual reload needed.",
      "You can see your estimated wait time based on average consultation duration.",
      "You will be notified when you are the next patient.",
    ],
  },
  {
    icon: "❌",
    title: "Cancellation Policy",
    color: "#ef4444",
    items: [
      "You can cancel your booking any time before OPD starts.",
      "After OPD starts, use the 'Withdraw' option on the token status page.",
      "Walk-in tokens booked by staff cannot be cancelled by patients.",
      "Cancelled tokens are freed up and may be reassigned as walk-in slots.",
    ],
  },
];

export default function Instructions() {
  const [open, setOpen] = useState(0);

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", background:"#f8fafc", minHeight:"100vh" }}>
      <AppNavbar />

      {/* Header */}
      <div style={{
        background:"linear-gradient(135deg,#0f4c75,#118a7e)",
        padding:"64px 24px 48px", textAlign:"center",
      }}>
        <div style={{ fontSize:48, marginBottom:12 }}>📖</div>
        <h1 style={{ color:"#fff", fontSize:34, fontWeight:800, margin:"0 0 12px" }}>
          OPD Booking Instructions
        </h1>
        <p style={{ color:"#bae6fd", fontSize:16, maxWidth:520, margin:"0 auto" }}>
          Read these guidelines carefully before booking your token. Knowing the rules ensures a smooth experience.
        </p>
      </div>

      {/* Quick summary pills */}
      <div style={{ background:"#fff", borderBottom:"1px solid #e2e8f0", padding:"16px 24px", display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
        {["60 tokens/session", "2 sessions/day", "20 online slots", "Cutoff: 2h before"].map(t => (
          <span key={t} style={{ background:"#f0f9ff", color:"#0f4c75", padding:"6px 14px", borderRadius:20, fontSize:13, fontWeight:600, border:"1px solid #bae6fd" }}>{t}</span>
        ))}
      </div>

      {/* Accordion */}
      <div style={{ maxWidth:780, margin:"40px auto", padding:"0 24px 80px" }}>
        {sections.map((s, i) => (
          <div key={i} style={{
            background:"#fff", borderRadius:14, marginBottom:12,
            boxShadow:"0 2px 10px rgba(0,0,0,0.05)",
            border: open===i ? `1.5px solid ${s.color}30` : "1.5px solid transparent",
            overflow:"hidden", transition:"border 0.2s",
          }}>
            {/* Accordion header */}
            <button onClick={() => setOpen(open===i ? -1 : i)} style={{
              width:"100%", background:"none", border:"none", cursor:"pointer",
              padding:"18px 22px", display:"flex", alignItems:"center", gap:14, textAlign:"left",
            }}>
              <div style={{ width:44, height:44, borderRadius:12, background:`${s.color}15`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
                {s.icon}
              </div>
              <span style={{ fontWeight:700, fontSize:16, color:"#0f172a", flex:1 }}>{s.title}</span>
              <span style={{ fontSize:18, color:"#94a3b8", transform: open===i?"rotate(180deg)":"rotate(0)", transition:"transform 0.2s" }}>
                ▾
              </span>
            </button>

            {/* Accordion body */}
            {open === i && (
              <div style={{ padding:"0 22px 20px 80px" }}>
                {s.items.map((item, j) => (
                  <div key={j} style={{ display:"flex", gap:10, marginBottom:10, alignItems:"flex-start" }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:s.color, marginTop:7, flexShrink:0 }}></div>
                    <p style={{ margin:0, fontSize:14, color:"#475569", lineHeight:1.65 }}>{item}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Token map visual */}
        <div style={{ background:"#fff", borderRadius:14, padding:"24px", boxShadow:"0 2px 10px rgba(0,0,0,0.05)", marginTop:24 }}>
          <h4 style={{ margin:"0 0 16px", color:"#0f172a", fontSize:16, fontWeight:700 }}>🗺️ Token Number Map (Per Session)</h4>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {Array.from({ length:60 }, (_, i) => i+1).map(n => {
              const isOnline = n >= 16 && n <= 35;
              return (
                <div key={n} style={{
                  width:36, height:36, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:11, fontWeight:700,
                  background: isOnline ? "#dbeafe" : "#f0fdf4",
                  color:      isOnline ? "#1d4ed8" : "#166534",
                  border:     isOnline ? "1.5px solid #93c5fd" : "1.5px solid #86efac",
                }}>
                  {n}
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:20, marginTop:14 }}>
            <span style={{ fontSize:12, color:"#64748b" }}>
              <span style={{ display:"inline-block", width:12, height:12, borderRadius:3, background:"#dbeafe", border:"1px solid #93c5fd", marginRight:4 }}></span>
              Online (16–35)
            </span>
            <span style={{ fontSize:12, color:"#64748b" }}>
              <span style={{ display:"inline-block", width:12, height:12, borderRadius:3, background:"#f0fdf4", border:"1px solid #86efac", marginRight:4 }}></span>
              Walk-in (1–15, 36–60)
            </span>
          </div>
        </div>

        {/* CTA */}
        <div style={{ textAlign:"center", marginTop:40 }}>
          <p style={{ color:"#64748b", marginBottom:20 }}>Ready to book your token?</p>
          <Link to="/booking" style={{ textDecoration:"none" }}>
            <button style={{
              background:"linear-gradient(90deg,#0f4c75,#118a7e)", color:"#fff", border:"none",
              borderRadius:12, padding:"14px 36px", fontSize:16, fontWeight:700, cursor:"pointer",
              boxShadow:"0 4px 16px rgba(15,76,117,0.3)",
            }}>
              Continue to Booking →
            </button>
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}

import React, { useState } from "react";
import { Link } from "react-router-dom";
import AppNavbar from "../components/AppNavbar";
import Footer from "../components/Footer";

const sections = [
  {
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
    title: "Live Queue Tracking",
    color: "#1b6ca8",
    items: [
      "After confirming attendance, open 'Track My Token' to see real-time updates.",
      "The page auto-refreshes every 15 seconds — no manual reload needed.",
      "You can see your estimated wait time based on average consultation duration.",
      "You will be notified when you are the next patient.",
    ],
  },
  {
    title: "Cancellation Policy",
    color: "#0f4c75",
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
    <div style={{ fontFamily:"'DM Sans',sans-serif", minHeight:"100vh" }}>
      <AppNavbar />

      {/* Full-page gradient background — same as Login/MyBookings */}
      <div style={S.pageWrap}>
        <div style={S.orb1} />
        <div style={S.orb2} />

        <div style={{ position:"relative", zIndex:1, width:"100%", maxWidth:1200, padding:"0 16px" }}>

          {/* Portal card */}
          <div style={S.portalCard}>

            {/* Card header */}
            <div style={S.cardHeader}>
              <div style={S.pill}>
                <span style={S.pillDot} />
                <span style={{ color:"#e0f2fe", fontSize:13, fontWeight:500 }}>MedQueue Portal</span>
              </div>
              <h1 style={S.headerTitle}>OPD Booking Instructions</h1>
              <p style={S.headerSub}>
                Read these guidelines carefully before booking your token. Knowing the rules ensures a smooth experience.
              </p>
            </div>

            {/* Card body */}
            <div style={S.cardBody}>

              {/* Quick summary pills */}
              <div style={S.pillsRow}>
                {["60 tokens / session", "2 sessions / day", "20 online slots", "Cutoff: 2 h before"].map(t => (
                  <span key={t} style={S.summaryPill}>{t}</span>
                ))}
              </div>

              {/* Accordion */}
              <div style={{ marginBottom:32 }}>
                {sections.map((s, i) => (
                  <div key={i} style={{
                    ...S.accordionItem,
                    border: open === i ? `1.5px solid ${s.color}40` : "1.5px solid #e2e8f0",
                  }}>
                    <button
                      onClick={() => setOpen(open === i ? -1 : i)}
                      style={S.accordionBtn}
                    >
                      <div style={{ ...S.accordionDot, background: s.color }} />
                      <span style={S.accordionTitle}>{s.title}</span>
                      <span style={{
                        fontSize:16, color:"#94a3b8",
                        transform: open === i ? "rotate(180deg)" : "rotate(0)",
                        transition:"transform 0.2s", flexShrink:0,
                      }}>▾</span>
                    </button>

                    {open === i && (
                      <div style={S.accordionBody}>
                        {s.items.map((item, j) => (
                          <div key={j} style={{ display:"flex", gap:10, marginBottom:10, alignItems:"flex-start" }}>
                            <div style={{ width:5, height:5, borderRadius:"50%", background:s.color, marginTop:8, flexShrink:0 }} />
                            <p style={{ margin:0, fontSize:14, color:"#475569", lineHeight:1.7 }}>{item}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Token map */}
              <div style={S.tokenMapCard}>
                <h4 style={S.tokenMapTitle}>Token Number Map (Per Session)</h4>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {Array.from({ length:60 }, (_, i) => i + 1).map(n => {
                    const isOnline = n >= 16 && n <= 35;
                    return (
                      <div key={n} style={{
                        width:34, height:34, borderRadius:8,
                        display:"flex", alignItems:"center", justifyContent:"center",
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
                <div style={{ display:"flex", gap:24, marginTop:16 }}>
                  <span style={S.legendItem}>
                    <span style={{ ...S.legendSwatch, background:"#dbeafe", border:"1px solid #93c5fd" }} />
                    Online (16–35)
                  </span>
                  <span style={S.legendItem}>
                    <span style={{ ...S.legendSwatch, background:"#f0fdf4", border:"1px solid #86efac" }} />
                    Walk-in (1–15, 36–60)
                  </span>
                </div>
              </div>

              {/* CTA */}
              <div style={{ textAlign:"center", marginTop:40 }}>
                <p style={{ color:"#64748b", marginBottom:20, fontSize:14 }}>Ready to book your token?</p>
                <Link to="/booking" style={{ textDecoration:"none" }}>
                  <button style={S.ctaBtn}>Continue to Booking →</button>
                </Link>
              </div>

            </div>
          </div>
        </div>
      </div>

      <Footer />

      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>
    </div>
  );
}

const S = {
  pageWrap: {
    background:"linear-gradient(135deg, #0f4c75 0%, #1b6ca8 50%, #118a7e 100%)",
    minHeight:"100vh",
    display:"flex",
    alignItems:"flex-start",
    justifyContent:"center",
    padding:"48px 0 64px",
    position:"relative",
    overflow:"hidden",
  },

  orb1: {
    position:"absolute", width:400, height:400, borderRadius:"50%",
    background:"rgba(255,255,255,0.04)", top:-80, right:-80, pointerEvents:"none",
  },
  orb2: {
    position:"absolute", width:250, height:250, borderRadius:"50%",
    background:"rgba(255,255,255,0.04)", bottom:40, left:-60, pointerEvents:"none",
  },

  portalCard: {
    width:"100%",
    background:"#ffffff",
    borderRadius:24,
    boxShadow:"0 8px 40px rgba(0,0,0,0.25)",
    overflow:"hidden",
    animation:"fadeUp 0.45s ease both",
  },

  cardHeader: {
    background:"linear-gradient(135deg, #0f4c75 0%, #1b6ca8 60%, #118a7e 100%)",
    padding:"28px 36px 28px",
  },

  pill: {
    display:"inline-flex", alignItems:"center", gap:8,
    background:"rgba(255,255,255,0.12)", borderRadius:30,
    padding:"6px 16px", marginBottom:14,
  },
  pillDot: {
    width:8, height:8, borderRadius:"50%", background:"#4ade80", display:"inline-block",
  },

  headerTitle: {
    fontWeight:800, fontSize:26, color:"#fff",
    margin:"0 0 6px", fontFamily:"'DM Sans',sans-serif",
  },
  headerSub: {
    color:"#bae6fd", fontSize:14, margin:0, maxWidth:560,
  },

  cardBody: { padding:"28px 36px 40px" },

  pillsRow: {
    display:"flex", gap:10, flexWrap:"wrap", marginBottom:28,
  },
  summaryPill: {
    background:"#f0f9ff", color:"#0f4c75",
    padding:"6px 16px", borderRadius:20,
    fontSize:13, fontWeight:600,
    border:"1px solid #bae6fd",
    fontFamily:"'DM Sans',sans-serif",
  },

  /* Accordion */
  accordionItem: {
    background:"#f8fafc",
    borderRadius:12,
    marginBottom:10,
    overflow:"hidden",
    transition:"border 0.2s",
  },
  accordionBtn: {
    width:"100%", background:"none", border:"none", cursor:"pointer",
    padding:"16px 20px",
    display:"flex", alignItems:"center", gap:12, textAlign:"left",
  },
  accordionDot: {
    width:10, height:10, borderRadius:"50%", flexShrink:0,
  },
  accordionTitle: {
    fontWeight:700, fontSize:15, color:"#0f172a",
    flex:1, fontFamily:"'DM Sans',sans-serif",
  },
  accordionBody: {
    padding:"0 20px 18px 42px",
  },

  /* Token map */
  tokenMapCard: {
    background:"#f8fafc",
    borderRadius:14,
    padding:"24px",
    border:"1px solid #e2e8f0",
  },
  tokenMapTitle: {
    margin:"0 0 16px", color:"#0f172a",
    fontSize:15, fontWeight:700, fontFamily:"'DM Sans',sans-serif",
  },
  legendItem: {
    display:"inline-flex", alignItems:"center", gap:6,
    fontSize:12, color:"#64748b", fontFamily:"'DM Sans',sans-serif",
  },
  legendSwatch: {
    display:"inline-block", width:12, height:12, borderRadius:3,
  },

  /* CTA */
  ctaBtn: {
    background:"linear-gradient(90deg, #0f4c75, #118a7e)",
    color:"#fff", border:"none",
    borderRadius:12, padding:"13px 36px",
    fontSize:15, fontWeight:700, cursor:"pointer",
    fontFamily:"'DM Sans',sans-serif",
    boxShadow:"0 4px 20px rgba(15,76,117,0.3)",
  },
};
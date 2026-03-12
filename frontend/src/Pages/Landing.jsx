import React from "react";
import { Link } from "react-router-dom";
import AppNavbar from "../components/AppNavbar";
import Footer from "../components/Footer";

const features = [
  { icon: "🗓️", title: "Easy Online Token Booking", desc: "Reserve your OPD slot from home in under 2 minutes." },
  { icon: "📋", title: "Clear Booking Rules", desc: "Know the guidelines, cutoff times, and priority rules upfront." },
  { icon: "📡", title: "Live Queue Tracking", desc: "See real-time updates — know exactly when it's your turn." },
];

const process = [
  { step: "01", title: "Choose Hospital & Doctor", desc: "Select your district, hospital, department, and doctor." },
  { step: "02", title: "Pick Session & Date", desc: "Book a morning or evening slot up to 7 days ahead." },
  { step: "03", title: "Pay & Receive Ticket", desc: "Complete payment and get your PDF ticket instantly by email." },
  { step: "04", title: "Confirm & Consult", desc: "Confirm attendance when OPD starts and walk in at your turn." },
];

const fair = [
  { icon: "🧓", title: "Priority for Seniors", desc: "Seniors and emergencies are handled by staff with full transparency in the live queue." },
  { icon: "⏰", title: "Fixed Time Slots", desc: "Arrive exactly at your scheduled time — no hours of waiting." },
  { icon: "🎟️", title: "Limited Daily Tokens", desc: "Only 60 tokens per session per doctor. No overcrowding." },
];

export default function Landing() {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#fff" }}>
      <AppNavbar />

      {/* ── HERO ─────────────────────────────────────── */}
      <section style={{
        background: "linear-gradient(135deg,#0f4c75 0%,#1b6ca8 50%,#118a7e 100%)",
        minHeight: "92vh", display: "flex", alignItems: "center",
        padding: "80px 24px", position: "relative", overflow: "hidden",
      }}>
        {/* Decorative circles */}
        <div style={{ position:"absolute", width:400, height:400, borderRadius:"50%", background:"rgba(255,255,255,0.04)", top:-80, right:-80 }} />
        <div style={{ position:"absolute", width:250, height:250, borderRadius:"50%", background:"rgba(255,255,255,0.04)", bottom:40, left:-60 }} />

        <div style={{ maxWidth:1100, margin:"0 auto", width:"100%", display:"flex", alignItems:"center", gap:60, flexWrap:"wrap" }}>
          {/* Left */}
          <div style={{ flex:1, minWidth:280 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.12)", borderRadius:30, padding:"6px 16px", marginBottom:24 }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:"#4ade80", display:"inline-block" }}></span>
              <span style={{ color:"#e0f2fe", fontSize:13, fontWeight:500 }}>Live queue tracking enabled</span>
            </div>

            <h1 style={{ color:"#fff", fontSize:"clamp(32px,5vw,52px)", fontWeight:800, lineHeight:1.15, margin:"0 0 20px" }}>
              Skip the Wait.<br/>
              <span style={{ color:"#7dd3fc" }}>Book Your Hospital</span><br/>
              Visit Online.
            </h1>

            <p style={{ color:"#bae6fd", fontSize:17, lineHeight:1.7, margin:"0 0 36px", maxWidth:440 }}>
              MedQueue gives you an OPD token, a PDF ticket, and a live seat in the queue — all from your phone.
            </p>

            <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
              <Link to="/booking" style={{ textDecoration:"none" }}>
                <button style={HB.primary}>Book a Token →</button>
              </Link>
              <Link to="/patient/status" style={{ textDecoration:"none" }}>
                <button style={HB.outline}>Track My Token</button>
              </Link>
            </div>

            {/* Stats */}
            <div style={{ display:"flex", gap:32, marginTop:48, flexWrap:"wrap" }}>
              {[["60", "Tokens/Session"], ["2", "Daily Sessions"], ["15s", "Queue Update"]].map(([val, label]) => (
                <div key={label}>
                  <div style={{ fontSize:28, fontWeight:800, color:"#fff" }}>{val}</div>
                  <div style={{ fontSize:12, color:"#93c5fd" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — visual token card */}
          <div style={{ flex:1, minWidth:280, display:"flex", justifyContent:"center" }}>
            <div style={{
              background:"rgba(255,255,255,0.1)", backdropFilter:"blur(20px)",
              border:"1px solid rgba(255,255,255,0.2)", borderRadius:24,
              padding:"32px 28px", width:"100%", maxWidth:340,
            }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20 }}>
                <span style={{ color:"#7dd3fc", fontSize:13, fontWeight:600 }}>YOUR TOKEN</span>
                <span style={{ background:"#4ade8022", color:"#4ade80", fontSize:12, padding:"3px 10px", borderRadius:20, fontWeight:600 }}>ACTIVE</span>
              </div>
              <div style={{ fontSize:80, fontWeight:900, color:"#fff", lineHeight:1, marginBottom:8 }}>23</div>
              <div style={{ color:"#93c5fd", fontSize:13, marginBottom:24 }}>Morning Session · Today</div>
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {[["🏥 Hospital","General Hospital, Kochi"],["👨‍⚕️ Doctor","Dr. Priya Nair"],["⏱ Est. Wait","~14 minutes"]].map(([k,v]) => (
                  <div key={k} style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                    <span style={{ color:"#93c5fd" }}>{k}</span>
                    <span style={{ color:"#fff", fontWeight:600 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop:20, height:6, background:"rgba(255,255,255,0.15)", borderRadius:6 }}>
                <div style={{ height:"100%", width:"60%", background:"linear-gradient(90deg,#4ade80,#22d3ee)", borderRadius:6 }}></div>
              </div>
              <div style={{ color:"#93c5fd", fontSize:11, marginTop:6, textAlign:"right" }}>6 people ahead</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────── */}
      <section style={{ padding:"80px 24px", background:"#f8fafc" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:56 }}>
            <h2 style={{ fontSize:32, fontWeight:800, color:"#0f172a", margin:0 }}>
              What <span style={{ color:"#0f4c75" }}>MedQueue</span> Solves
            </h2>
            <p style={{ color:"#64748b", marginTop:10, fontSize:16 }}>
              Everything you need for a smooth OPD experience
            </p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:24 }}>
            {features.map(f => (
              <div key={f.title} style={S.featureCard}>
                <div style={{ fontSize:40, marginBottom:16 }}>{f.icon}</div>
                <h4 style={{ fontSize:17, fontWeight:700, color:"#0f172a", margin:"0 0 8px" }}>{f.title}</h4>
                <p style={{ color:"#64748b", fontSize:14, lineHeight:1.6, margin:0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────── */}
      <section style={{ padding:"80px 24px", background:"#fff" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:56 }}>
            <h2 style={{ fontSize:32, fontWeight:800, color:"#0f172a", margin:0 }}>How It Works</h2>
            <p style={{ color:"#64748b", marginTop:10, fontSize:16 }}>From booking to consultation in 4 simple steps</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:24 }}>
            {process.map((p, i) => (
              <div key={p.step} style={{ position:"relative" }}>
                <div style={{ ...S.stepCard, borderTop:`3px solid ${["#0f4c75","#1b6ca8","#118a7e","#0ea5e9"][i]}` }}>
                  <div style={{ fontSize:40, fontWeight:900, color:"#e2e8f0", marginBottom:12 }}>{p.step}</div>
                  <h4 style={{ fontSize:16, fontWeight:700, color:"#0f172a", margin:"0 0 8px" }}>{p.title}</h4>
                  <p style={{ color:"#64748b", fontSize:13, lineHeight:1.6, margin:0 }}>{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAIR PROCESS ─────────────────────────────── */}
      <section style={{ padding:"80px 24px", background:"#f0f9ff" }}>
        <div style={{ maxWidth:1100, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:56 }}>
            <h2 style={{ fontSize:32, fontWeight:800, color:"#0f172a", margin:0 }}>Fair & Transparent</h2>
            <p style={{ color:"#64748b", marginTop:10, fontSize:16 }}>A queue system you can trust</p>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:24 }}>
            {fair.map(f => (
              <div key={f.title} style={S.fairCard}>
                <div style={{ fontSize:36, marginBottom:14 }}>{f.icon}</div>
                <h4 style={{ fontSize:17, fontWeight:700, color:"#0f4c75", margin:"0 0 8px" }}>{f.title}</h4>
                <p style={{ color:"#64748b", fontSize:14, lineHeight:1.6, margin:0 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────── */}
      <section style={{
        background:"linear-gradient(90deg,#0f4c75,#118a7e)",
        padding:"72px 24px", textAlign:"center",
      }}>
        <h2 style={{ color:"#fff", fontSize:34, fontWeight:800, margin:"0 0 12px" }}>
          Ready to Skip the Queue?
        </h2>
        <p style={{ color:"#bae6fd", fontSize:16, margin:"0 0 36px" }}>
          Book your OPD token in under 2 minutes.
        </p>
        <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
          <Link to="/booking" style={{ textDecoration:"none" }}>
            <button style={{ ...HB.primary, background:"#fff", color:"#0f4c75", boxShadow:"0 4px 20px rgba(0,0,0,0.15)" }}>
              Book Now →
            </button>
          </Link>
          <Link to="/instructions" style={{ textDecoration:"none" }}>
            <button style={{ ...HB.outline, borderColor:"rgba(255,255,255,0.5)", color:"#fff" }}>
              How It Works
            </button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}

const HB = {
  primary: { background:"linear-gradient(90deg,#fff,#e0f2fe)", color:"#0f4c75", border:"none", borderRadius:12, padding:"14px 28px", fontWeight:700, fontSize:15, cursor:"pointer", boxShadow:"0 4px 20px rgba(0,0,0,0.2)" },
  outline: { background:"transparent", color:"#fff", border:"2px solid rgba(255,255,255,0.5)", borderRadius:12, padding:"14px 28px", fontWeight:700, fontSize:15, cursor:"pointer" },
};
const S = {
  featureCard: { background:"#fff", borderRadius:16, padding:"28px 24px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)", border:"1px solid #f1f5f9" },
  stepCard:    { background:"#f8fafc", borderRadius:14, padding:"24px 20px", height:"100%" },
  fairCard:    { background:"#fff", borderRadius:16, padding:"28px 24px", boxShadow:"0 2px 12px rgba(0,0,0,0.06)" },
};

// Footer.jsx — place in src/components/
import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer style={F.footer}>
      <div style={F.inner}>
        {/* Brand */}
        <div style={{ maxWidth:280 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <div style={F.logo}>🏥</div>
            <span style={{ fontWeight:800, fontSize:18, color:"#fff" }}>MedQueue</span>
          </div>
          <p style={{ color:"#94a3b8", fontSize:13, lineHeight:1.7, margin:0 }}>
            Kerala's hospital OPD queue management system. Book tokens, skip waits, consult doctors.
          </p>
        </div>

        {/* Links */}
        <div>
          <div style={F.colTitle}>Quick Links</div>
          {[["Home","/"], ["Book Token","/booking"], ["My Bookings","/mybookings"], ["Track Token","/patient/status"], ["Instructions","/instructions"]].map(([l,to]) => (
            <Link key={to} to={to} style={F.link}>{l}</Link>
          ))}
        </div>

        <div>
          <div style={F.colTitle}>Support</div>
          {[["Contact Us","/contact"], ["How It Works","/instructions"]].map(([l,to]) => (
            <Link key={to} to={to} style={F.link}>{l}</Link>
          ))}
        </div>

        {/* Contact */}
        <div>
          <div style={F.colTitle}>Contact</div>
          {[["📍 Kerala, India",""],["📞 +91 98765 43210",""],["✉️ support@medqueue.com",""]].map(([t]) => (
            <div key={t} style={{ color:"#94a3b8", fontSize:13, marginBottom:8 }}>{t}</div>
          ))}
        </div>
      </div>

      <div style={F.bottom}>
        <span>© {new Date().getFullYear()} MedQueue. All rights reserved.</span>
        <span>Made in Kerala 🌿</span>
      </div>
    </footer>
  );
}

const F = {
  footer: { background:"#0f172a", padding:"56px 24px 0" },
  inner:  { maxWidth:1100, margin:"0 auto", display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:40, paddingBottom:48 },
  logo:   { width:34, height:34, borderRadius:9, background:"linear-gradient(135deg,#0f4c75,#118a7e)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:17 },
  colTitle:{ color:"#fff", fontWeight:700, fontSize:14, marginBottom:14 },
  link:   { display:"block", color:"#94a3b8", fontSize:13, textDecoration:"none", marginBottom:8, transition:"color 0.15s" },
  bottom: { borderTop:"1px solid #1e293b", padding:"20px 0", maxWidth:1100, margin:"0 auto", display:"flex", justifyContent:"space-between", flexWrap:"wrap", gap:8, color:"#475569", fontSize:13 },
};

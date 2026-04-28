import React, { useState } from "react";
import AppNavbar from "../components/AppNavbar";
import Footer from "../components/Footer";

export default function ContactUs() {
  const [form, setForm] = useState({ name:"", email:"", subject:"", message:"" });
  const [sent, setSent]  = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;
    // Replace with your actual contact form submission
    setSent(true);
  };

  const info = [
    { icon:"📍", label:"Address",        val:"123 Medical Street, Ernakulam, Kerala 682 001" },
    { icon:"📞", label:"Phone",          val:"+91 98765 43210" },
    { icon:"✉️", label:"Email",          val:"support@medqueue.com" },
    { icon:"🕐", label:"Support Hours", val:"Mon–Fri, 9:00 AM – 6:00 PM IST" },
  ];

  return (
    <div style={{ fontFamily:"'DM Sans',sans-serif", background:"#f8fafc", minHeight:"100vh" }}>
      <AppNavbar />

      {/* Header */}
      <div style={{
        background:"linear-gradient(135deg,#0f4c75,#118a7e)",
        padding:"64px 24px 48px", textAlign:"center",
      }}>
        <div style={{ fontSize:48, marginBottom:12 }}>💬</div>
        <h1 style={{ color:"#fff", fontSize:34, fontWeight:800, margin:"0 0 12px" }}>Contact Us</h1>
        <p style={{ color:"#bae6fd", fontSize:16, maxWidth:480, margin:"0 auto" }}>
          Have a question or need help? We're here for you.
        </p>
      </div>

      {/* Body */}
      <div style={{ maxWidth:1000, margin:"48px auto", padding:"0 24px 80px", display:"grid", gridTemplateColumns:"1fr 1.4fr", gap:28, flexWrap:"wrap" }}>

        {/* Left — Contact info */}
        <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
          {/* Info card */}
          <div style={S.card}>
            <h3 style={{ margin:"0 0 20px", color:"#0f172a", fontSize:18, fontWeight:700 }}>Get in Touch</h3>
            {info.map(({ icon, label, val }) => (
              <div key={label} style={{ display:"flex", gap:14, marginBottom:18, alignItems:"flex-start" }}>
                <div style={S.iconBox}>{icon}</div>
                <div>
                  <div style={{ fontSize:12, color:"#94a3b8", fontWeight:600, marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:14, color:"#1e293b", fontWeight:500 }}>{val}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Map placeholder */}
          <div style={{ ...S.card, padding:0, overflow:"hidden", flex:1, minHeight:180 }}>
            <iframe
              title="location"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d125311.97714316627!2d76.23921665!3d9.98934665!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3b080d514abec6bf%3A0xbd582caa5f6c2fd1!2sErnakulam%2C%20Kerala!5e0!3m2!1sen!2sin!4v1700000000000"
              width="100%" height="100%" style={{ border:0, minHeight:180 }}
              allowFullScreen loading="lazy"
            />
          </div>
        </div>

        {/* Right — Form */}
        <div style={S.card}>
          {sent ? (
            <div style={{ textAlign:"center", padding:"40px 20px" }}>
              <div style={{ fontSize:56, marginBottom:16 }}>✅</div>
              <h3 style={{ color:"#0f172a", margin:"0 0 10px" }}>Message Sent!</h3>
              <p style={{ color:"#64748b" }}>We'll get back to you within 1–2 business days.</p>
              <button onClick={() => { setSent(false); setForm({ name:"",email:"",subject:"",message:"" }); }} style={S.btn}>
                Send Another
              </button>
            </div>
          ) : (
            <>
              <h3 style={{ margin:"0 0 20px", color:"#0f172a", fontSize:18, fontWeight:700 }}>Send Us a Message</h3>
              <form onSubmit={handleSubmit}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
                  <div>
                    <label style={S.label}>Name *</label>
                    <input value={form.name} onChange={e => setForm(p=>({...p, name:e.target.value}))}
                      placeholder="Your full name" style={S.input} required />
                  </div>
                  <div>
                    <label style={S.label}>Email *</label>
                    <input type="email" value={form.email} onChange={e => setForm(p=>({...p, email:e.target.value}))}
                      placeholder="your@email.com" style={S.input} required />
                  </div>
                </div>

                <div style={{ marginBottom:14 }}>
                  <label style={S.label}>Subject</label>
                  <select value={form.subject} onChange={e => setForm(p=>({...p, subject:e.target.value}))} style={S.input}>
                    <option value="">Select a topic</option>
                    <option>Booking Issue</option>
                    <option>Payment Problem</option>
                    <option>Token Not Received</option>
                    <option>Technical Support</option>
                    <option>Other</option>
                  </select>
                </div>

                <div style={{ marginBottom:22 }}>
                  <label style={S.label}>Message *</label>
                  <textarea value={form.message} onChange={e => setForm(p=>({...p, message:e.target.value}))}
                    placeholder="Describe your issue or question..."
                    rows={5} style={{ ...S.input, resize:"vertical" }} required />
                </div>

                <button type="submit" style={{ ...S.btn, width:"100%" }}>
                  Send Message →
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}

const S = {
  card:    { background:"#fff", borderRadius:16, padding:"28px 24px", boxShadow:"0 2px 14px rgba(0,0,0,0.07)" },
  iconBox: { width:40, height:40, borderRadius:10, background:"#f0f9ff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 },
  label:   { display:"block", fontWeight:600, fontSize:13, color:"#374151", marginBottom:6 },
  input:   { width:"100%", border:"1.5px solid #e2e8f0", borderRadius:9, padding:"10px 12px", fontSize:14, outline:"none", background:"#f8fafc", boxSizing:"border-box", color:"#1e293b" },
  btn:     { background:"linear-gradient(90deg,#0f4c75,#118a7e)", color:"#fff", border:"none", borderRadius:10, padding:"13px 24px", fontWeight:700, fontSize:15, cursor:"pointer", boxShadow:"0 4px 14px rgba(15,76,117,0.25)" },
};
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  getDistricts, getHospitals, getDepartments,
  getDoctorsByDepartment, fetchTokenAvailability, bookToken,
} from "../services/allApi";

function Booking() {
  const navigate = useNavigate();

  const [districts,    setDistricts]    = useState([]);
  const [hospitals,    setHospitals]    = useState([]);
  const [departments,  setDepartments]  = useState([]);
  const [doctors,      setDoctors]      = useState([]);
  const [availability, setAvailability] = useState(null);

  const [district,    setDistrict]    = useState("");
  const [hospital,    setHospital]    = useState("");
  const [department,  setDepartment]  = useState("");
  const [doctor,      setDoctor]      = useState("");
  const [session,     setSession]     = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  const today   = new Date().toISOString().split("T")[0];
  const maxDate = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

  // ── Load chain ─────────────────────────────────────────
  useEffect(() => {
    getDistricts()
      .then(r => setDistricts(r.data))
      .catch(() => toast.error("Failed to load districts"));
  }, []);

  useEffect(() => {
    if (!district) return;
    setHospital(""); setDepartment(""); setDoctor("");
    setHospitals([]); setDepartments([]); setDoctors([]);
    getHospitals(district).then(r => setHospitals(r.data)).catch(() => toast.error("Failed to load hospitals"));
  }, [district]);

  useEffect(() => {
    if (!hospital) return;
    setDepartment(""); setDoctor(""); setDepartments([]); setDoctors([]);
    getDepartments(hospital).then(r => setDepartments(r.data)).catch(() => toast.error("Failed to load departments"));
  }, [hospital]);

  useEffect(() => {
    if (!department) return;
    setDoctor(""); setDoctors([]);
    getDoctorsByDepartment(department).then(r => setDoctors(r.data)).catch(() => toast.error("Failed to load doctors"));
  }, [department]);

  // ── Token availability ──────────────────────────────────
  useEffect(() => {
    if (!doctor || !session || !bookingDate) { setAvailability(null); return; }
    fetchTokenAvailability(doctor, session, bookingDate)
      .then(r => setAvailability(r.data))
      .catch(() => setAvailability(null));
  }, [doctor, session, bookingDate]);

  // ── Submit ──────────────────────────────────────────────
  const handleBooking = async () => {
    if (!district || !hospital || !department || !doctor || !session || !bookingDate) {
      toast.error("Please fill all fields"); return;
    }
    if (availability && !availability.booking_open) {
      toast.error("Booking closed — cutoff time has passed for this session"); return;
    }
    if (availability && availability.online_tokens?.available === 0) {
      toast.error("No online tokens available for this session"); return;
    }
    setSubmitting(true);
    try {
      const res = await bookToken({ doctor_id: Number(doctor), session, booking_date: bookingDate });
      const b = res.data;
      navigate("/bookingdetails", {
        state: {
          district:       districts.find(d  => d.id  == district)?.name   || "",
          hospital:       hospitals.find(h  => h.id  == hospital)?.name   || "",
          department:     departments.find(d => d.id == department)?.name || "",
          doctor:         doctors.find(d    => d.id  == doctor)?.name     || "",
          session, date: bookingDate,
          token_number:  b.token_number,
          id:            b.id,
          status:        b.status,
          payment_status: b.payment_status,
        },
      });
    } catch (err) {
      const d = err.response?.data;
      toast.error(
        d?.non_field_errors?.[0] || d?.detail || d?.error ||
        Object.values(d || {})[0]?.[0] || "Booking failed"
      );
    } finally { setSubmitting(false); }
  };

  const field = (label, value, setter, items, disabled) => (
    <div key={label} style={{ marginBottom: 16 }}>
      <label style={S.label}>{label}</label>
      <select value={value} onChange={e => setter(e.target.value)} disabled={disabled}
        style={{ ...S.input, opacity: disabled ? 0.45 : 1, cursor: disabled ? "not-allowed" : "pointer" }}>
        <option value="">— Select {label} —</option>
        {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
    </div>
  );

  return (
    <div style={S.page}>
      <div style={S.card}>
        {/* Header */}
        <div style={{ textAlign:"center", marginBottom:28 }}>
          <div style={S.iconWrap}>🏥</div>
          <h2 style={S.title}>Book Your Token</h2>
          <p style={S.sub}>Schedule your OPD consultation — online tokens 16–35</p>
        </div>

        {/* Availability banner */}
        {availability && (
          <div style={{
            ...S.banner,
            background:   availability.booking_open ? "#ecfdf5" : "#fef2f2",
            borderColor:  availability.booking_open ? "#6ee7b7" : "#fca5a5",
            color:        availability.booking_open ? "#065f46" : "#991b1b",
          }}>
            <span>{availability.booking_open ? "✅ Booking open" : "🔒 Booking closed (cutoff passed)"}</span>
            {availability.booking_open && (
              <span><b>{availability.online_tokens?.available}</b> / 20 tokens left</span>
            )}
          </div>
        )}

        {field("District",   district,   setDistrict,   districts,   false)}
        {field("Hospital",   hospital,   setHospital,   hospitals,   !district)}
        {field("Department", department, setDepartment, departments, !hospital)}
        {field("Doctor",     doctor,     setDoctor,     doctors,     !department)}

        <div style={{ marginBottom:16 }}>
          <label style={S.label}>Booking Date</label>
          <input type="date" value={bookingDate} min={today} max={maxDate}
            onChange={e => setBookingDate(e.target.value)} style={S.input} />
        </div>

        {/* Session */}
        <div style={{ marginBottom:24 }}>
          <label style={S.label}>Select Session</label>
          <div style={{ display:"flex", gap:12 }}>
            {[
              { val:"morning",  label:"Morning", sub:"10 AM – 12 PM", color:"#f59e0b" },
              { val:"evening",  label:"Evening", sub:"3 PM – 5 PM",   color:"#3b82f6" },
            ].map(s => (
              <div key={s.val} onClick={() => setSession(s.val)} style={{
                flex:1, padding:"14px 10px", textAlign:"center", borderRadius:12,
                cursor:"pointer", transition:"all 0.2s",
                border: session===s.val ? `2px solid ${s.color}` : "1.5px solid #e5e7eb",
                background: session===s.val ? `${s.color}15` : "#f8fafc",
                boxShadow: session===s.val ? `0 2px 14px ${s.color}30` : "none",
              }}>
                <div style={{ fontSize:22 }}>{s.icon}</div>
                <div style={{ fontWeight:700, fontSize:14, color:session===s.val?s.color:"#374151" }}>{s.label}</div>
                <div style={{ fontSize:11, color:"#9ca3af" }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>

        <button onClick={handleBooking} disabled={submitting} style={{
          ...S.btn,
          background: submitting ? "#94a3b8" : "linear-gradient(90deg,#0f4c75,#118a7e)",
          cursor: submitting ? "not-allowed" : "pointer",
        }}>
          {submitting ? "⏳ Booking..." : "Book Token →"}
        </button>
      </div>
    </div>
  );
}

const S = {
  page:     { minHeight:"100vh", background:"linear-gradient(135deg,#0f4c75 0%,#1b6ca8 40%,#118a7e 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:"32px 16px" },
  card:     { width:"100%", maxWidth:520, background:"#fff", borderRadius:20, boxShadow:"0 20px 60px rgba(0,0,0,0.18)", padding:"36px 32px" },
  iconWrap: { width:52, height:52, borderRadius:"50%", background:"linear-gradient(135deg,#0f4c75,#118a7e)", display:"inline-flex", alignItems:"center", justifyContent:"center", marginBottom:12, fontSize:24 },
  title:    { fontFamily:"'Playfair Display',serif", color:"#0f4c75", margin:0, fontSize:26, fontWeight:700 },
  sub:      { color:"#64748b", fontSize:13, marginTop:6 },
  label:    { fontWeight:600, color:"#374151", marginBottom:6, display:"block", fontSize:14 },
  input:    { borderRadius:10, border:"1.5px solid #e0e7ef", padding:"10px 14px", fontSize:15, width:"100%", outline:"none", background:"#f8fafc", color:"#1e293b", boxSizing:"border-box" },
  banner:   { borderRadius:10, border:"1px solid", padding:"10px 14px", marginBottom:20, fontSize:13, display:"flex", justifyContent:"space-between" },
  btn:      { width:"100%", padding:"13px", borderRadius:12, border:"none", color:"#fff", fontWeight:700, fontSize:16, boxShadow:"0 4px 15px rgba(15,76,117,0.3)", transition:"all 0.2s" },
};

export default Booking;

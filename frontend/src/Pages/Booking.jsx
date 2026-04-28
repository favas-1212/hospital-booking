import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import {
  getDistricts, getHospitals, getDepartments,
  getDoctorsByDepartment, fetchTokenAvailability, bookToken,
  getAvailableBookingDates,
  createPaymentOrder, verifyPayment,        // [NEW]
} from "../services/allApi";

// ─────────────────────────────────────────────────────────────────────────────
// [NEW] Lazy-load Razorpay checkout.js SDK once.
// Returns a promise that resolves true if loaded, false if blocked/failed.
// ─────────────────────────────────────────────────────────────────────────────
function loadRazorpayScript() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload  = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function Booking() {
  const navigate = useNavigate();

  const [districts,    setDistricts]    = useState([]);
  const [hospitals,    setHospitals]    = useState([]);
  const [departments,  setDepartments]  = useState([]);
  const [doctors,      setDoctors]      = useState([]);
  const [availability, setAvailability] = useState(null);
  const [allowedDates, setAllowedDates] = useState([]);

  const [district,    setDistrict]    = useState("");
  const [hospital,    setHospital]    = useState("");
  const [department,  setDepartment]  = useState("");
  const [doctor,      setDoctor]      = useState("");
  const [session,     setSession]     = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  // [NEW] Track payment stage for nicer button labels:
  //   ""        idle
  //   "booking" creating booking row
  //   "order"   creating Razorpay order
  //   "paying"  Razorpay checkout open
  //   "verify"  verifying signature
  const [stage, setStage] = useState("");

  // ── Load allowed dates ──────────────────────────────────
  useEffect(() => {
    getAvailableBookingDates()
      .then(r => {
        setAllowedDates(r.data);
        const today = r.data.find(d => d.value === "today");
        if (today) setBookingDate(today.date);
      })
      .catch(() => {
        const toDate = (offset) => {
          const d = new Date();
          d.setDate(d.getDate() + offset);
          return d.toISOString().split("T")[0];
        };
        const fallback = [
          { date: toDate(0), label: "Today",              value: "today" },
          { date: toDate(1), label: "Tomorrow",           value: "tomorrow" },
          { date: toDate(2), label: "Day After Tomorrow", value: "day_after_tomorrow" },
        ];
        setAllowedDates(fallback);
        setBookingDate(fallback[0].date);
      });
  }, []);

  // ── Cascading lookups (unchanged) ─────────────────────
  useEffect(() => {
    getDistricts()
      .then(r => setDistricts(r.data))
      .catch(() => toast.error("Failed to load districts"));
  }, []);

  useEffect(() => {
    if (!district) return;
    setHospital(""); setDepartment(""); setDoctor("");
    setHospitals([]); setDepartments([]); setDoctors([]);
    getHospitals(district).then(r => setHospitals(r.data))
      .catch(() => toast.error("Failed to load hospitals"));
  }, [district]);

  useEffect(() => {
    if (!hospital) return;
    setDepartment(""); setDoctor(""); setDepartments([]); setDoctors([]);
    getDepartments(hospital).then(r => setDepartments(r.data))
      .catch(() => toast.error("Failed to load departments"));
  }, [hospital]);

  useEffect(() => {
    if (!department) return;
    setDoctor(""); setDoctors([]);
    getDoctorsByDepartment(department).then(r => setDoctors(r.data))
      .catch(() => toast.error("Failed to load doctors"));
  }, [department]);

  // ── Token availability ──────────────────────────────────
  useEffect(() => {
    if (!doctor || !session || !bookingDate) { setAvailability(null); return; }
    fetchTokenAvailability(doctor, session, bookingDate)
      .then(r => setAvailability(r.data))
      .catch(() => setAvailability(null));
  }, [doctor, session, bookingDate]);

  // ─────────────────────────────────────────────────────────────────────────
  // [NEW] Razorpay payment flow
  // ─────────────────────────────────────────────────────────────────────────
  const startRazorpayCheckout = (booking, orderInfo) => {
    return new Promise((resolve, reject) => {
      const options = {
        key      : orderInfo.razorpay_key,
        amount   : orderInfo.amount * 100,    // backend sends rupees → paise
        currency : "INR",
        name     : "MedQueue",
        description: `OPD Token #${booking.token_number} · ${booking.doctor_name || "Consultation"}`,
        order_id : orderInfo.order_id,

        handler: async (response) => {
          // Razorpay returns: razorpay_payment_id, razorpay_order_id, razorpay_signature
          setStage("verify");
          try {
            const verifyRes = await verifyPayment({
              razorpay_payment_id : response.razorpay_payment_id,
              razorpay_order_id   : response.razorpay_order_id,
              razorpay_signature  : response.razorpay_signature,
            });
            resolve({ verified: true, response, verifyRes: verifyRes.data });
          } catch (err) {
            reject(err);
          }
        },

        modal: {
          ondismiss: () => reject(new Error("Payment cancelled by user")),
        },

        theme: { color: "#0f4c75" },

        // Prefill — best-effort, falls back gracefully if patient profile
        // isn't in localStorage. Razorpay shows them but they're editable.
        prefill: (() => {
          try {
            const u = JSON.parse(sessionStorage.getItem("user") || "{}");
            return {
              name    : u.name  || u.full_name || "",
              email   : u.email || "",
              contact : u.phone || u.contact   || "",
            };
          } catch {
            return {};
          }
        })(),
      };

      const rzp = new window.Razorpay(options);

      rzp.on("payment.failed", (resp) => {
        reject(new Error(resp.error?.description || "Payment failed"));
      });

      rzp.open();
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // [REWRITTEN] handleBooking — booking → order → checkout → verify → navigate
  // ─────────────────────────────────────────────────────────────────────────
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

    // 1. Make sure Razorpay SDK is ready before we even create the booking
    const sdkReady = await loadRazorpayScript();
    if (!sdkReady) {
      toast.error("Could not load payment gateway. Check your internet connection.");
      return;
    }

    setSubmitting(true);
    let booking = null;

    try {
      // 2. Create booking (status=PENDING, payment_status=PENDING)
      setStage("booking");
      const bookRes = await bookToken({
        doctor_id    : Number(doctor),
        session,
        booking_date : bookingDate,
      });
      booking = bookRes.data;

      // 3. Create Razorpay order for THIS booking
      setStage("order");
      const orderRes = await createPaymentOrder(booking.id);
      const orderInfo = orderRes.data;
      // Expected shape: { order_id, amount, razorpay_key }

      // 4. Open Razorpay checkout — resolves on success, rejects on dismiss/fail
      setStage("paying");
      await startRazorpayCheckout(booking, orderInfo);

      // 5. Payment verified server-side. Navigate to details.
      toast.success("✅ Payment successful! Booking confirmed.");
      navigate("/bookingdetails", {
        state: {
          district       : districts.find(d   => d.id == district)?.name    || "",
          hospital       : hospitals.find(h   => h.id == hospital)?.name    || "",
          department     : departments.find(d => d.id == department)?.name  || "",
          doctor         : doctors.find(d     => d.id == doctor)?.name      || "",
          session,
          date           : bookingDate,
          token_number   : booking.token_number,
          id             : booking.id,
          status         : booking.status,
          payment_status : "paid",   // we just verified it
        },
      });
    } catch (err) {
      // Distinguish booking-creation errors from payment errors
      const apiErr = err.response?.data;
      const errMsg =
        apiErr?.non_field_errors?.[0] ||
        apiErr?.detail ||
        apiErr?.error ||
        (apiErr ? Object.values(apiErr)[0]?.[0] : null) ||
        err.message ||
        "Booking failed";

      if (booking && (stage === "paying" || stage === "verify" || stage === "order")) {
        // Booking row exists but payment didn't complete.
        // Send patient to history so they can see/cancel/retry the unpaid booking.
        toast.error(`Payment incomplete: ${errMsg}. Your token is held briefly — pay or cancel from My Bookings.`);
        navigate("/mybookings");
      } else {
        toast.error(errMsg);
      }
    } finally {
      setSubmitting(false);
      setStage("");
    }
  };

  // ── Button label by stage ───────────────────────────────
  const buttonLabel = () => {
    if (!submitting) return "Pay & Book Token →";
    switch (stage) {
      case "booking": return "⏳ Reserving token...";
      case "order"  : return "💳 Preparing payment...";
      case "paying" : return "💳 Awaiting payment...";
      case "verify" : return "🔐 Verifying payment...";
      default       : return "⏳ Processing...";
    }
  };

  const DATE_ICONS = {
    today:               "📅",
    tomorrow:            "🗓️",
    day_after_tomorrow:  "📆",
  };

  const selectStyle = (disabled) => ({
    width: "100%",
    borderRadius: 10,
    background: disabled ? "#f1f5f9" : "#f8fafc",
    border: "1px solid #e2e8f0",
    color: disabled ? "#94a3b8" : "#0f172a",
    padding: "11px 14px",
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    outline: "none",
    cursor: disabled ? "not-allowed" : "pointer",
    boxSizing: "border-box",
    appearance: "auto",
    opacity: disabled ? 0.7 : 1,
  });

  const labelStyle = {
    color: "#0f172a",
    fontWeight: 600,
    fontSize: 13,
    marginBottom: 6,
    display: "block",
  };

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
        maxWidth: 520,
        background: "#ffffff",
        borderRadius: 24,
        boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
        overflow: "hidden",
        position: "relative",
        zIndex: 1,
      }}>

        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #0f4c75 0%, #1b6ca8 60%, #118a7e 100%)",
          padding: "28px 36px 24px",
          textAlign: "center",
        }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:16 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(255,255,255,0.12)", borderRadius: 30, padding: "6px 16px",
            }}>
              <span style={{ width:8, height:8, borderRadius:"50%", background:"#4ade80", display:"inline-block" }} />
              <span style={{ color:"#e0f2fe", fontSize:13, fontWeight:500 }}>MedQueue Portal</span>
            </div>
          </div>
          <h4 style={{ fontWeight:800, fontSize:26, color:"#fff", margin:"0 0 6px" }}>
            Book Your Token
          </h4>
          <p style={{ color:"#bae6fd", fontSize:14, margin:0 }}>
            Schedule your OPD consultation — online tokens 16–35
          </p>
        </div>

        {/* Body */}
        <div style={{ padding:"28px 36px 32px" }}>

          {/* Availability banner */}
          {availability && (
            <div style={{
              borderRadius: 10,
              border: `1px solid ${availability.booking_open ? "#6ee7b7" : "#fca5a5"}`,
              background: availability.booking_open ? "#ecfdf5" : "#fef2f2",
              color: availability.booking_open ? "#065f46" : "#991b1b",
              padding: "10px 14px", marginBottom: 20, fontSize: 13,
              display: "flex", justifyContent: "space-between",
              alignItems: "center", fontWeight: 500,
            }}>
              <span>{availability.booking_open ? "✅ Booking open" : "🔒 Booking closed (cutoff passed)"}</span>
              {availability.booking_open && (
                <span><b>{availability.online_tokens?.available}</b> / 20 tokens left</span>
              )}
            </div>
          )}

          {/* District */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>District</label>
            <select value={district} onChange={e => setDistrict(e.target.value)}
              style={selectStyle(false)} className="booking-select">
              <option value="">— Select District —</option>
              {districts.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>

          {/* Hospital */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Hospital</label>
            <select value={hospital} onChange={e => setHospital(e.target.value)}
              disabled={!district} style={selectStyle(!district)} className="booking-select">
              <option value="">— Select Hospital —</option>
              {hospitals.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>

          {/* Department */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Department</label>
            <select value={department} onChange={e => setDepartment(e.target.value)}
              disabled={!hospital} style={selectStyle(!hospital)} className="booking-select">
              <option value="">— Select Department —</option>
              {departments.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>

          {/* Doctor */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Doctor</label>
            <select value={doctor} onChange={e => setDoctor(e.target.value)}
              disabled={!department} style={selectStyle(!department)} className="booking-select">
              <option value="">— Select Doctor —</option>
              {doctors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>

          {/* Booking Date */}
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Booking Date</label>
            <div style={{ display:"flex", gap:10 }}>
              {allowedDates.map(d => {
                const selected = bookingDate === d.date;
                return (
                  <div key={d.value} onClick={() => setBookingDate(d.date)}
                    style={{
                      flex: 1, padding: "12px 8px", textAlign: "center",
                      borderRadius: 12, cursor: "pointer",
                      border: selected ? "1.5px solid #1b6ca8" : "1px solid #e2e8f0",
                      background: selected ? "#eff8ff" : "#f8fafc",
                      boxShadow: selected ? "0 2px 10px rgba(27,108,168,0.18)" : "none",
                      transition: "all 0.15s",
                    }}>
                    <div style={{ fontSize:20, marginBottom:4 }}>{DATE_ICONS[d.value] || "📅"}</div>
                    <div style={{ fontWeight:700, fontSize:13, color: selected ? "#1b6ca8" : "#374151" }}>{d.label}</div>
                    <div style={{ fontSize:11, color:"#94a3b8", marginTop:2 }}>{d.date}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Session */}
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Select Session</label>
            <div style={{ display:"flex", gap:12 }}>
              {[
                { val:"morning", label:"Morning", sub:"10 AM – 12 PM", color:"#f59e0b", icon:"🌅" },
                { val:"evening", label:"Evening", sub:"2 PM – 4 PM",   color:"#1b6ca8", icon:"🌆" },
              ].map(s => (
                <div key={s.val} onClick={() => setSession(s.val)} style={{
                  flex: 1, padding: "14px 10px", textAlign: "center",
                  borderRadius: 12, cursor: "pointer", transition: "all 0.2s",
                  border: session === s.val ? `1.5px solid ${s.color}` : "1px solid #e2e8f0",
                  background: session === s.val ? `${s.color}18` : "#f8fafc",
                  boxShadow: session === s.val ? `0 2px 14px ${s.color}30` : "none",
                }}>
                  <div style={{ fontSize:22 }}>{s.icon}</div>
                  <div style={{ fontWeight:700, fontSize:14, color: session === s.val ? s.color : "#374151" }}>{s.label}</div>
                  <div style={{ fontSize:11, color:"#94a3b8" }}>{s.sub}</div>
                </div>
              ))}
            </div>
          </div>

          {/* [NEW] Payment notice */}
          <div style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 10,
            padding: "10px 14px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}>
            <span style={{ fontSize:18 }}>💳</span>
            <div style={{ fontSize:12, color:"#1e40af", lineHeight:1.4 }}>
              <b>Payment is required to confirm your token.</b><br />
              You'll be redirected to a secure Razorpay checkout after clicking below.
            </div>
          </div>

          {/* Submit */}
          <button
            onClick={handleBooking}
            disabled={submitting}
            style={{
              background: submitting ? "#94a3b8" : "linear-gradient(90deg, #0f4c75, #118a7e)",
              border: "none", width: "100%", padding: "14px",
              borderRadius: 12, fontWeight: 700, fontSize: 15, color: "#fff",
              fontFamily: "'DM Sans', sans-serif",
              boxShadow: submitting ? "none" : "0 4px 20px rgba(15,76,117,0.35)",
              cursor: submitting ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {buttonLabel()}
          </button>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        .booking-select:focus {
          background: #fff !important;
          border-color: #1b6ca8 !important;
          box-shadow: 0 0 0 3px rgba(27,108,168,0.15) !important;
          outline: none;
        }
      `}</style>
    </div>
  );
}

export default Booking;

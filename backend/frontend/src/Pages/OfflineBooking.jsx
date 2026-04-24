import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { bookWalkinToken, fetchTokenAvailability } from "../services/allApi";

// OfflineBooking is used as a modal inside OPDDashboard
function OfflineBooking({ doctor, session, date, onClose }) {
  const navigate = useNavigate();

  const [availTokens,  setAvailTokens]  = useState([]);
  const [onlineBooked, setOnlineBooked] = useState([]);
  const [walkinBooked, setWalkinBooked] = useState([]);
  const [selectedToken, setSelectedToken] = useState("");
  const [patientName,   setPatientName]  = useState("");
  const [loading,       setLoading]      = useState(false);
  const [loadingTokens, setLoadingTokens]= useState(false);

  // ── Load available tokens ────────────────────────────────
  const loadTokens = async () => {
    if (!doctor || !session || !date) return;
    setLoadingTokens(true);
    try {
      // GET /booking/tokens/availability/?doctor_id=&session=&date=
      const res  = await fetchTokenAvailability(doctor.doctor_id, session, date);
      const data = res.data;

      // Backend returns:
      // { walkin_tokens: { available: [1,2,...], booked: [...] },
      //   online_tokens: { available: [...], booked: [...] }, booking_open: bool }
      const avail = data?.walkin_tokens?.available || [];
      setAvailTokens(avail);
      setSelectedToken(avail[0] ?? "");
      setOnlineBooked(data?.online_tokens?.booked || []);
      setWalkinBooked(data?.walkin_tokens?.booked  || []);
    } catch (err) {
      console.error("Token load error:", err);
      toast.error("Failed to fetch available tokens");
    } finally { setLoadingTokens(false); }
  };

  useEffect(() => { loadTokens(); }, [doctor, session, date]);

  // ── Book walk-in ─────────────────────────────────────────
  const handleBook = async () => {
    if (!patientName.trim()) { toast.error("Patient name is required"); return; }
    if (!selectedToken)      { toast.error("Please select a token"); return; }

    setLoading(true);
    try {
      const res = await bookWalkinToken({
        doctor_id:    doctor.doctor_id,
        session,
        booking_date: date,
        token_number: Number(selectedToken),
        patient_name: patientName.trim(),
      });
      const b = res.data;
      if (!b?.id) { toast.error("Unexpected server response"); return; }

      toast.success(`✅ Walk-in token #${b.token_number} booked for ${b.patient_name}`);

      navigate("/offlinebookingdetails", {
        state: {
          id:           b.id,
          token:        b.token_number,
          patient_name: b.patient_name,
          doctor:       doctor.doctor_name,
          department:   doctor.department_name || doctor.department,
          hospital:     doctor.hospital_name  || doctor.hospital,
          district:     doctor.district_name  || "",
          session,
          date,
        },
      });
    } catch (err) {
      toast.error(err.response?.data?.error || "Booking failed");
    } finally { setLoading(false); }
  };

  if (!doctor) return null;

  return (
    <div style={S.wrap}>
      {/* Doctor info strip */}
      <div style={S.infoStrip}>
        <div style={{ fontSize:13 }}>
          <b style={{ color:"#0f4c75" }}>{doctor.doctor_name}</b>
          <span style={{ color:"#64748b" }}> · {doctor.department_name || doctor.department}</span>
        </div>
        <div style={{ fontSize:12, color:"#94a3b8", marginTop:3 }}>
          📅 {date} · {session === "morning" ? "🌅 Morning" : "🌆 Evening"}
        </div>
      </div>

      {/* Patient name */}
      <div style={{ marginBottom:16 }}>
        <label style={S.label}>Patient Name *</label>
        <input
          value={patientName}
          onChange={e => setPatientName(e.target.value)}
          placeholder="Enter full patient name"
          style={S.input}
          autoFocus
        />
      </div>

      {/* Token selection */}
      <div style={{ marginBottom:16 }}>
        <label style={S.label}>Walk-in Token *</label>
        {loadingTokens ? (
          <div style={{ color:"#94a3b8", fontSize:13 }}>Loading tokens...</div>
        ) : availTokens.length > 0 ? (
          <>
            {/* Token grid */}
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:8 }}>
              {availTokens.map(t => (
                <button key={t} onClick={() => setSelectedToken(t)} style={{
                  width:42, height:42, borderRadius:8, border:"none", cursor:"pointer",
                  fontWeight:700, fontSize:13, transition:"all 0.15s",
                  background: selectedToken===t ? "#0f4c75" : "#f0f9ff",
                  color:      selectedToken===t ? "#fff"    : "#0f4c75",
                  boxShadow:  selectedToken===t ? "0 2px 8px rgba(15,76,117,0.3)" : "none",
                }}>{t}</button>
              ))}
            </div>
            <div style={{ fontSize:11, color:"#94a3b8" }}>
              Walk-in range: 1–15 and 36–60 · {availTokens.length} available
            </div>
          </>
        ) : (
          <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, padding:"10px 12px", color:"#dc2626", fontSize:13 }}>
            ❌ No walk-in tokens available for this session
          </div>
        )}
      </div>

      {/* Booked overview */}
      {(onlineBooked.length > 0 || walkinBooked.length > 0) && (
        <div style={{ background:"#f8fafc", borderRadius:10, padding:"12px 14px", marginBottom:16, fontSize:12, color:"#64748b" }}>
          {onlineBooked.length > 0 && <div><b>Online booked:</b> {onlineBooked.join(", ")}</div>}
          {walkinBooked.length > 0 && <div style={{ marginTop:4 }}><b>Walk-in booked:</b> {walkinBooked.join(", ")}</div>}
        </div>
      )}

      {/* Actions */}
      <div style={{ display:"flex", gap:10, marginTop:4 }}>
        <button
          onClick={handleBook}
          disabled={loading || !selectedToken || loadingTokens || availTokens.length===0}
          style={{
            flex:1, padding:"12px", borderRadius:10, border:"none", fontWeight:700, fontSize:14, cursor:"pointer",
            background: (loading||!selectedToken||availTokens.length===0) ? "#e2e8f0" : "linear-gradient(90deg,#0f4c75,#118a7e)",
            color:      (loading||!selectedToken||availTokens.length===0) ? "#94a3b8" : "#fff",
          }}
        >
          {loading ? "Booking..." : "Book Walk-in Token"}
        </button>
        <button onClick={onClose} style={{ flex:1, padding:"12px", borderRadius:10, border:"1.5px solid #e2e8f0", background:"#f8fafc", fontWeight:600, fontSize:14, cursor:"pointer", color:"#475569" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const S = {
  wrap:      { padding:"4px 0" },
  infoStrip: { background:"#f0f9ff", border:"1px solid #bae6fd", borderRadius:10, padding:"12px 14px", marginBottom:18 },
  label:     { display:"block", fontWeight:600, fontSize:13, color:"#374151", marginBottom:6 },
  input:     { width:"100%", border:"1.5px solid #e2e8f0", borderRadius:9, padding:"10px 12px", fontSize:14, outline:"none", background:"#f8fafc", boxSizing:"border-box", color:"#1e293b" },
};

export default OfflineBooking;

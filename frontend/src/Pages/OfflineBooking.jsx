import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { fetchTokens, bookWalkinToken } from "../services/allApi"; // API functions
import { useNavigate } from "react-router-dom";

function OfflineBooking({ doctor, session, date, onClose }) {
  const navigate = useNavigate();

  const [availableTokens, setAvailableTokens] = useState([]);
  const [bookedOnlineTokens, setBookedOnlineTokens] = useState([]);
  const [bookedWalkinTokens, setBookedWalkinTokens] = useState([]);
  const [selectedToken, setSelectedToken] = useState(null);
  const [patientName, setPatientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingTokens, setLoadingTokens] = useState(false);

  // ==============================
  // Load Tokens
  // ==============================
  const loadTokens = async () => {
    if (!doctor || !session || !date) return;
    setLoadingTokens(true);
    try {
      const res = await fetchTokens(doctor.doctor_id, session, date);
      
      // Some API wrappers return data directly, some in res.data
      const data = res?.data || res;

      setAvailableTokens(data.available_walkin_tokens || []);
      setBookedOnlineTokens(data.booked_online_tokens || []);
      setBookedWalkinTokens(data.booked_walkin_tokens || []);
      setSelectedToken((data.available_walkin_tokens || [])[0] || null);
    } catch (err) {
      console.error("Token load error:", err);
      toast.error("Failed to fetch tokens");
    } finally {
      setLoadingTokens(false);
    }
  };

  useEffect(() => {
    loadTokens();
  }, [doctor, session, date]);

  // ==============================
  // Handle Walk-in Booking
  // ==============================
  const handleOfflineBooking = async () => {
    if (!patientName) {
      toast.error("Patient name is required");
      return;
    }
    if (!selectedToken) {
      toast.error("Please select a token");
      return;
    }

    setLoading(true);
    try {
      const res = await bookWalkinToken({
        doctor_id: doctor.doctor_id,
        session,
        booking_date: date,
        token_number: selectedToken,
        patient_name: patientName,
      });

      // Normalize response
      const bookingData = res?.data || res;

      if (!bookingData?.id) {
        toast.error("Booking failed: Invalid server response");
        setLoading(false);
        return;
      }

      toast.success(
        `Walk-in token #${bookingData.token_number} booked for ${bookingData.patient_name}`
      );

      // Navigate to booking details page (similar to online booking)
      navigate("/offlinebookingdetails", {
        state: {
          district: doctor.district_name || "",
          hospital: doctor.hospital_name || "",
          department: doctor.department_name || "",
          doctor: doctor.name,
          session,
          date,
          token: bookingData.token_number,
          patient_name: bookingData.patient_name,
          id: bookingData.id,
        },
      });

      setPatientName("");
      await loadTokens();
    } catch (err) {
      console.error("Booking error:", err.response || err);
      toast.error(err.response?.data?.error || "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  if (!doctor) return <div>No doctor selected</div>;

  return (
    <div className="container my-5">
      <div className="card shadow-sm p-4 mx-auto" style={{ maxWidth: "500px" }}>
        <h2 className="card-title text-center mb-4">Walk-in Token Booking</h2>

        {/* Doctor Info */}
        <div className="mb-3">
          <strong>Doctor:</strong> {doctor.name}
        </div>
        <div className="mb-3">
          <strong>Department:</strong> {doctor.department_name}
        </div>
        <div className="mb-3">
          <strong>Hospital:</strong> {doctor.hospital_name}
        </div>
        <div className="mb-3">
          <strong>Date:</strong> {date}
        </div>
        <div className="mb-3">
          <strong>Session:</strong> {session}
        </div>

        {/* Patient Name */}
        <div className="mb-3">
          <label className="form-label">Patient Name</label>
          <input
            type="text"
            className="form-control"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            placeholder="Enter patient name"
          />
        </div>

        {/* Token Selection */}
        <div className="mb-3">
          <label className="form-label">Select Walk-in Token</label>
          {loadingTokens ? (
            <div>Loading tokens...</div>
          ) : availableTokens.length > 0 ? (
            <select
              className="form-select"
              value={selectedToken || ""}
              onChange={(e) => setSelectedToken(Number(e.target.value))}
            >
              {availableTokens.map((token) => (
                <option key={token} value={token}>
                  {token}
                </option>
              ))}
            </select>
          ) : (
            <div>No walk-in tokens available</div>
          )}
        </div>

        {/* Already Booked Tokens */}
        <div className="mb-3">
          <label className="form-label">Booked Online Tokens</label>
          <div>{bookedOnlineTokens.length ? bookedOnlineTokens.join(", ") : "None"}</div>
        </div>
        <div className="mb-3">
          <label className="form-label">Booked Walk-in Tokens</label>
          <div>{bookedWalkinTokens.length ? bookedWalkinTokens.join(", ") : "None"}</div>
        </div>

        {/* Buttons */}
        <div className="d-flex gap-2">
          <button
            className="btn btn-primary flex-grow-1"
            onClick={handleOfflineBooking}
            disabled={loading || !selectedToken || loadingTokens}
          >
            {loading ? "Booking..." : "Book Walk-in Token"}
          </button>
          <button className="btn btn-secondary flex-grow-1" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default OfflineBooking;
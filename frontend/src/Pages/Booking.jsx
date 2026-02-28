import React, { useEffect, useState } from "react";
import commonApi from "../services/commonApi";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

function Booking() {
  const navigate = useNavigate();

  const [districts, setDistricts] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [departments, setDepartments] = useState([]);

  const [district, setDistrict] = useState("");
  const [hospital, setHospital] = useState("");
  const [department, setDepartment] = useState("");
  const [session, setSession] = useState("");
  const [bookingDate, setBookingDate] = useState("");

  useEffect(() => {
    commonApi("/booking/districts/", "GET")
      .then(res => setDistricts(res.data))
      .catch(() => toast.error("Failed to load districts"));
  }, []);

  useEffect(() => {
    if (district) {
      commonApi(`/booking/hospitals/?district_id=${district}`, "GET")
        .then(res => setHospitals(res.data))
        .catch(() => toast.error("Failed to load hospitals"));
    }
  }, [district]);

  useEffect(() => {
    if (hospital) {
      commonApi(`/booking/departments/?hospital_id=${hospital}`, "GET")
        .then(res => setDepartments(res.data))
        .catch(() => toast.error("Failed to load departments"));
    }
  }, [hospital]);

  const handleBooking = async () => {
    if (!district || !hospital || !department || !session || !bookingDate) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      const res = await commonApi("/booking/book-token/", "POST", {
        department_id: department,
        session,
        booking_date: bookingDate,
      });

      const selectedDistrict = districts.find(d => d.id == district);
      const selectedHospital = hospitals.find(h => h.id == hospital);
      const selectedDepartment = departments.find(dep => dep.id == department);

      navigate("/bookingdetails", {
        state: {
          district: selectedDistrict?.name || "",
          hospital: selectedHospital?.name || "",
          department: selectedDepartment?.name || "",
          session,
          date: bookingDate,
          token: res.data.token_number,
          id: res.data.id || res.data.booking_id,
        },
      });

    } catch (err) {
      toast.error(
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        "Booking failed"
      );
    }
  };

  return (
    <div
      style={{
        background: "linear-gradient(135deg, #E6FFFA, #F0FDFA)",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        className="shadow"
        style={{
          background: "#ffffff",
          borderRadius: "20px",
          padding: "40px",
          width: "100%",
          maxWidth: "520px",
        }}
      >
        {/* Heading */}
        <h3
          className="text-center fw-bold mb-2"
          style={{
            background: "linear-gradient(90deg, #0E7490, #14B8A6)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Book Your Appointment
        </h3>

        <p className="text-center text-muted mb-4">
          Choose your hospital and preferred session
        </p>

        {/* District */}
        <div className="mb-3">
          <label className="form-label fw-semibold">District</label>
          <select
            className="form-select"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            style={{ borderRadius: "10px", padding: "10px" }}
          >
            <option value="">Select District</option>
            {districts.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Hospital */}
        <div className="mb-3">
          <label className="form-label fw-semibold">Hospital</label>
          <select
            className="form-select"
            value={hospital}
            onChange={(e) => setHospital(e.target.value)}
            style={{ borderRadius: "10px", padding: "10px" }}
          >
            <option value="">Select Hospital</option>
            {hospitals.map(h => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </div>

        {/* Department */}
        <div className="mb-3">
          <label className="form-label fw-semibold">Department</label>
          <select
            className="form-select"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            style={{ borderRadius: "10px", padding: "10px" }}
          >
            <option value="">Select Department</option>
            {departments.map(dep => (
              <option key={dep.id} value={dep.id}>{dep.name}</option>
            ))}
          </select>
        </div>

        {/* Booking Date */}
        <div className="mb-3">
          <label className="form-label fw-semibold">Booking Date</label>
          <input
            type="date"
            className="form-control"
            value={bookingDate}
            onChange={(e) => setBookingDate(e.target.value)}
            style={{ borderRadius: "10px", padding: "10px" }}
          />
        </div>

        {/* Session */}
        <div className="mb-4">
          <label className="form-label fw-semibold d-block">
            Select Session
          </label>

          <div className="d-flex gap-3">
            {/* Morning */}
            <div
              onClick={() => setSession("morning")}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "10px",
                textAlign: "center",
                cursor: "pointer",
                transition: "0.3s ease",
                background:
                  session === "morning"
                    ? "linear-gradient(90deg, #0EA5A4, #2DD4BF)"
                    : "#E6FFFA",
                border:
                  session === "morning"
                    ? "none"
                    : "1px solid #B2F5EA",
                color: session === "morning" ? "white" : "#0E7490",
                fontWeight: "600",
              }}
            >
               Morning
            </div>

            {/* Evening */}
            <div
              onClick={() => setSession("evening")}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: "10px",
                textAlign: "center",
                cursor: "pointer",
                transition: "0.3s ease",
                background:
                  session === "evening"
                    ? "linear-gradient(90deg, #0F766E, #14B8A6)"
                    : "#E6FFFA",
                border:
                  session === "evening"
                    ? "none"
                    : "1px solid #B2F5EA",
                color: session === "evening" ? "white" : "#0E7490",
                fontWeight: "600",
              }}
            >
               Evening
            </div>
          </div>
        </div>

        {/* Button */}
        <button
          onClick={handleBooking}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: "12px",
            border: "none",
            fontWeight: "600",
            background: "linear-gradient(90deg, #0E7490, #14B8A6)",
            color: "white",
            fontSize: "16px",
          }}
        >
          Confirm Booking
        </button>
      </div>
    </div>
  );
}

export default Booking;
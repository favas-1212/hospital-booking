import React, { useEffect, useState } from "react";
import commonApi from "../services/commonApi";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

function Booking() {
  const navigate = useNavigate();

  const [districts, setDistricts] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);

  const [district, setDistrict] = useState("");
  const [hospital, setHospital] = useState("");
  const [department, setDepartment] = useState("");
  const [doctor, setDoctor] = useState("");
  const [session, setSession] = useState("");
  const [bookingDate, setBookingDate] = useState("");

  // ==============================
  // Load Districts
  // ==============================
  useEffect(() => {
    commonApi("/booking/districts/", "GET")
      .then(res => setDistricts(res.data))
      .catch(() => toast.error("Failed to load districts"));
  }, []);

  // ==============================
  // Load Hospitals
  // ==============================
  useEffect(() => {
    if (district) {
      setHospital("");
      setDepartment("");
      setDoctor("");

      commonApi(`/booking/hospitals/?district_id=${district}`, "GET")
        .then(res => setHospitals(res.data))
        .catch(() => toast.error("Failed to load hospitals"));
    }
  }, [district]);

  // ==============================
  // Load Departments
  // ==============================
  useEffect(() => {
    if (hospital) {
      setDepartment("");
      setDoctor("");

      commonApi(`/booking/departments/?hospital_id=${hospital}`, "GET")
        .then(res => setDepartments(res.data))
        .catch(() => toast.error("Failed to load departments"));
    }
  }, [hospital]);

  // ==============================
  // Load Doctors
  // ==============================
  useEffect(() => {
    if (department) {
      setDoctor("");

      const token = sessionStorage.getItem("token");

      commonApi(
        `/booking/doctors/?department_id=${department}`,
        "GET",
        null,
        { Authorization: `Token ${token}` }
      )
        .then(res => setDoctors(res.data))
        .catch(() => toast.error("Failed to load doctors"));
    }
  }, [department]);

  // ==============================
  // Handle Booking
  // ==============================
  const handleBooking = async () => {
    if (!district || !hospital || !department || !doctor || !session || !bookingDate) {
      toast.error("Please fill all fields");
      return;
    }

    try {
      const res = await commonApi("/booking/book-token/", "POST", {
        doctor_id: doctor,
        session,
        booking_date: bookingDate,
      });

      const selectedDistrict = districts.find(d => d.id == district);
      const selectedHospital = hospitals.find(h => h.id == hospital);
      const selectedDepartment = departments.find(dep => dep.id == department);
      const selectedDoctor = doctors.find(doc => doc.id == doctor);

      navigate("/bookingdetails", {
        state: {
          district: selectedDistrict?.name || "",
          hospital: selectedHospital?.name || "",
          department: selectedDepartment?.name || "",
          doctor: selectedDoctor?.name || "",
          session,
          date: bookingDate,
          token: res.data.token_number,
          id: res.data.id,
        },
      });

    } catch (err) {
      toast.error(
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.doctor_id?.[0] ||
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
          width: "100%",
          maxWidth: "520px",
          background: "#ffffff",
          borderRadius: "18px",
          padding: "30px",
        }}
      >
        <h2
          className="text-center mb-2 fw-bold"
          style={{ color: "#0E7490" }}
        >
          Book Your Token
        </h2>

        <p className="text-center text-muted mb-4">
          Schedule your consultation easily
        </p>

        {/* District */}
        <div className="mb-3">
          <label className="form-label fw-semibold">District</label>
          <select
            className="form-select"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            style={{ borderRadius: "10px" }}
          >
            <option value="">Select District</option>
            {districts.map(d => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
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
            disabled={!district}
            style={{ borderRadius: "10px" }}
          >
            <option value="">Select Hospital</option>
            {hospitals.map(h => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
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
            disabled={!hospital}
            style={{ borderRadius: "10px" }}
          >
            <option value="">Select Department</option>
            {departments.map(dep => (
              <option key={dep.id} value={dep.id}>
                {dep.name}
              </option>
            ))}
          </select>
        </div>

        {/* Doctor */}
        <div className="mb-3">
          <label className="form-label fw-semibold">Doctor</label>
          <select
            className="form-select"
            value={doctor}
            onChange={(e) => setDoctor(e.target.value)}
            disabled={!department}
            style={{ borderRadius: "10px" }}
          >
            <option value="">Select Doctor</option>
            {doctors.map(doc => (
              <option key={doc.id} value={doc.id}>
                {doc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Booking Date */}
        <div className="mb-4">
          <label className="form-label fw-semibold">Booking Date</label>
          <input
            type="date"
            className="form-control"
            value={bookingDate}
            onChange={(e) => setBookingDate(e.target.value)}
            style={{ borderRadius: "10px" }}
          />
        </div>

        {/* Session Selection */}
        <div className="mb-4">
          <label className="form-label fw-semibold d-block mb-3">
            Select Session
          </label>

          <div className="d-flex gap-3">

            {/* Morning */}
            <div
              onClick={() => setSession("morning")}
              style={{
                flex: 1,
                padding: "14px",
                textAlign: "center",
                borderRadius: "12px",
                cursor: "pointer",
                border:
                  session === "morning"
                    ? "2px solid #FACC15"
                    : "1px solid #E5E7EB",
                background:
                  session === "morning"
                    ? "linear-gradient(135deg, #FEF9C3, #FDE68A)"
                    : "#ffffff",
                transition: "0.3s",
              }}
            >
              <div
                style={{
                  fontWeight: "600",
                  color:
                    session === "morning"
                      ? "#92400E"
                      : "#374151",
                }}
              >
                 Morning
              </div>
            </div>

            {/* Evening */}
            <div
              onClick={() => setSession("evening")}
              style={{
                flex: 1,
                padding: "14px",
                textAlign: "center",
                borderRadius: "12px",
                cursor: "pointer",
                border:
                  session === "evening"
                    ? "2px solid #0EA5E9"
                    : "1px solid #E5E7EB",
                background:
                  session === "evening"
                    ? "linear-gradient(135deg, #DBEAFE, #BFDBFE)"
                    : "#ffffff",
                transition: "0.3s",
              }}
            >
              <div
                style={{
                  fontWeight: "600",
                  color:
                    session === "evening"
                      ? "#1E3A8A"
                      : "#374151",
                }}
              >
                 Evening
              </div>
            </div>

          </div>
        </div>

        <button
          className="w-100"
          onClick={handleBooking}
          style={{
            background: "linear-gradient(90deg, #0E7490, #14B8A6)",
            border: "none",
            color: "white",
            padding: "12px",
            borderRadius: "12px",
            fontWeight: "600",
            fontSize: "16px",
          }}
        >
          Book Token
        </button>
      </div>
    </div>
  );
}

export default Booking;
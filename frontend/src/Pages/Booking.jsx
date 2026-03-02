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
      commonApi(`/booking/doctors/?department_id=${department}`, "GET")
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

      console.log("BOOKING RESPONSE:", res.data);

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
      console.log("ERROR RESPONSE:", err.response?.data);

      toast.error(
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        err.response?.data?.doctor_id?.[0] ||
        "Booking failed"
      );
    }
  };

  return (
    <div className="container my-5">
      <div className="card shadow-sm p-4 mx-auto" style={{ maxWidth: "500px" }}>
        <h2 className="card-title text-center mb-4">Book Your Token</h2>

        {/* District */}
        <div className="mb-3">
          <label className="form-label">District</label>
          <select
            className="form-select"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
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
          <label className="form-label">Hospital</label>
          <select
            className="form-select"
            value={hospital}
            onChange={(e) => setHospital(e.target.value)}
            disabled={!district}
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
          <label className="form-label">Department</label>
          <select
            className="form-select"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            disabled={!hospital}
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
          <label className="form-label">Doctor</label>
          <select
            className="form-select"
            value={doctor}
            onChange={(e) => setDoctor(e.target.value)}
            disabled={!department}
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
        <div className="mb-3">
          <label className="form-label">Booking Date</label>
          <input
            type="date"
            className="form-control"
            value={bookingDate}
            onChange={(e) => setBookingDate(e.target.value)}
          />
        </div>

        {/* Session */}
        <div className="mb-4">
          <label className="form-label d-block">Session</label>

          <div className="form-check form-check-inline">
            <input
              type="radio"
              className="form-check-input"
              name="session"
              value="morning"
              checked={session === "morning"}
              onChange={(e) => setSession(e.target.value)}
            />
            <label className="form-check-label">Morning</label>
          </div>

          <div className="form-check form-check-inline">
            <input
              type="radio"
              className="form-check-input"
              name="session"
              value="evening"
              checked={session === "evening"}
              onChange={(e) => setSession(e.target.value)}
            />
            <label className="form-check-label">Evening</label>
          </div>
        </div>

        <button
          className="btn btn-primary w-100"
          onClick={handleBooking}
        >
          Book Token
        </button>
      </div>
    </div>
  );
}

export default Booking;
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

  // Load districts
  useEffect(() => {
    commonApi("/booking/districts/", "GET")
      .then(res => setDistricts(res.data))
      .catch(() => toast.error("Failed to load districts"));
  }, []);

  // Load hospitals based on district
  useEffect(() => {
    if (district) {
      commonApi(`/booking/hospitals/?district_id=${district}`, "GET")
        .then(res => setHospitals(res.data))
        .catch(() => toast.error("Failed to load hospitals"));
    }
  }, [district]);

  // Load departments based on hospital
  useEffect(() => {
    if (hospital) {
      commonApi(`/booking/departments/?hospital_id=${hospital}`, "GET")
        .then(res => setDepartments(res.data))
        .catch(() => toast.error("Failed to load departments"));
    }
  }, [hospital]);

  // Book token
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

      // Get actual names before navigating
      const selectedDistrict = districts.find(d => d.id.toString() === district.toString());
      const selectedHospital = hospitals.find(h => h.id.toString() === hospital.toString());
      const selectedDepartment = departments.find(dep => dep.id.toString() === department.toString());

      navigate("/bookingdetails", {
        state: {
          district: selectedDistrict?.name || "",
          hospital: selectedHospital?.name || "",
          department: selectedDepartment?.name || "",
          session,
          date: bookingDate,
          token: res.data.token_number,
          
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
          >
            <option value="">Select Department</option>
            {departments.map(dep => (
              <option key={dep.id} value={dep.id}>
                {dep.name}
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
              className="form-check-input"
              type="radio"
              name="session"
              id="morning"
              value="morning"
              checked={session === "morning"}
              onChange={(e) => setSession(e.target.value)}
            />
            <label className="form-check-label" htmlFor="morning">
              Morning
            </label>
          </div>
          <div className="form-check form-check-inline">
            <input
              className="form-check-input"
              type="radio"
              name="session"
              id="evening"
              value="evening"
              checked={session === "evening"}
              onChange={(e) => setSession(e.target.value)}
            />
            <label className="form-check-label" htmlFor="evening">
              Evening
            </label>
          </div>
        </div>

        {/* Book Button */}
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

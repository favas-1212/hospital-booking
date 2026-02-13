import React, { useEffect, useState } from "react";
import commonApi from "../services/commonApi";
import { toast } from "react-toastify";

function Booking() {

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

  // Load hospitals
  useEffect(() => {

    if (district) {

      commonApi(`/booking/hospitals/?district_id=${district}`, "GET")
        .then(res => setHospitals(res.data))
        .catch(() => toast.error("Failed to load hospitals"));

    }

  }, [district]);

  // Load departments
  useEffect(() => {

    if (hospital) {

      commonApi(`/booking/departments/?hospital_id=${hospital}`, "GET")
        .then(res => setDepartments(res.data))
        .catch(() => toast.error("Failed to load departments"));

    }

  }, [hospital]);

  // Book token
  const handleBooking = async () => {

    if (!department || !session || !bookingDate) {
      toast.error("Please fill all fields");
      return;
    }

    try {

      const res = await commonApi(
        "/booking/book-token/",
        "POST",
        {
          department_id: department,
          session: session,
          booking_date: bookingDate
        }
      );

      toast.success(`Token booked! Token No: ${res.data.token_number}`);

    }
    catch (err) {

      toast.error(
        err.response?.data?.detail ||
        err.response?.data?.non_field_errors?.[0] ||
        "Booking failed"
      );

    }

  };

  return (

    <div>

      <select onChange={(e) => setDistrict(e.target.value)}>
        <option>Select District</option>

        {districts.map(d => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}

      </select>


      <select onChange={(e) => setHospital(e.target.value)}>
        <option>Select Hospital</option>

        {hospitals.map(h => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}

      </select>


      <select onChange={(e) => setDepartment(e.target.value)}>
        <option>Select Department</option>

        {departments.map(dep => (
          <option key={dep.id} value={dep.id}>
            {dep.name}
          </option>
        ))}

      </select>


      <input
        type="date"
        onChange={(e) => setBookingDate(e.target.value)}
      />


      <button onClick={() => setSession("morning")}>
        Morning
      </button>

      <button onClick={() => setSession("evening")}>
        Evening
      </button>


      <button onClick={handleBooking}>
        Book Token
      </button>

    </div>

  );
}

export default Booking;

import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

function OfflineBookingDetails() {
  const location = useLocation();
  const navigate = useNavigate();

  // Data passed from navigate
  const booking = location.state || {};

  if (!booking.id) {
    return (
      <div className="container my-5">
        <div className="alert alert-warning">No booking details available.</div>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="container my-5">
      <div className="card shadow-sm p-4 mx-auto" style={{ maxWidth: "500px" }}>
        <h2 className="card-title text-center mb-4">Offline Booking Details</h2>

        <div className="mb-3">
          <strong>Patient Name:</strong> {booking.patient_name}
        </div>
        <div className="mb-3">
          <strong>Doctor:</strong> {booking.doctor}
        </div>
        <div className="mb-3">
          <strong>Department:</strong> {booking.department}
        </div>
        <div className="mb-3">
          <strong>Hospital:</strong> {booking.hospital}
        </div>
        <div className="mb-3">
          <strong>District:</strong> {booking.district}
        </div>
        <div className="mb-3">
          <strong>Date:</strong> {booking.date}
        </div>
        <div className="mb-3">
          <strong>Session:</strong> {booking.session}
        </div>
        <div className="mb-3">
          <strong>Token Number:</strong> {booking.token}
        </div>

        <button className="btn btn-primary w-100" onClick={() => navigate(-1)}>
          Back
        </button>
      </div>
    </div>
  );
}

export default OfflineBookingDetails;
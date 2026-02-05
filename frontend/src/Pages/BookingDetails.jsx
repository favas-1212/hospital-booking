import React from "react";

function BookingDetails() {
  // Temporary sample data (later pass via navigate or backend)
  const bookingData = {
    district: "District 1",
    hospital: "Government Hospital",
    department: "General Medicine",
    session: "Morning",
    token: 5,
    date: "Tomorrow",
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6 col-lg-5">
          <div className="card shadow border-0">
            <div className="card-body p-4">

              <h4 className="text-center text-success mb-3">
                Booking Confirmed
              </h4>

              <p className="text-center text-muted small mb-4">
                Please reach the hospital at least <strong>15 minutes early</strong>
              </p>

              <ul className="list-group list-group-flush mb-4">
                <li className="list-group-item d-flex justify-content-between">
                  <span>District</span>
                  <strong>{bookingData.district}</strong>
                </li>

                <li className="list-group-item d-flex justify-content-between">
                  <span>Hospital</span>
                  <strong>{bookingData.hospital}</strong>
                </li>

                <li className="list-group-item d-flex justify-content-between">
                  <span>Department</span>
                  <strong>{bookingData.department}</strong>
                </li>

                <li className="list-group-item d-flex justify-content-between">
                  <span>OPD Session</span>
                  <strong>{bookingData.session}</strong>
                </li>

                <li className="list-group-item d-flex justify-content-between">
                  <span>Token Number</span>
                  <strong className="text-primary fs-5">
                    {bookingData.token}
                  </strong>
                </li>

                <li className="list-group-item d-flex justify-content-between">
                  <span>Consultation Date</span>
                  <strong>{bookingData.date}</strong>
                </li>
              </ul>

              <button className="btn btn-outline-primary w-100 mb-2">
                Payment/Confirm
              </button>

              <button className="btn btn-primary w-100">
                Cancel
              </button>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BookingDetails;

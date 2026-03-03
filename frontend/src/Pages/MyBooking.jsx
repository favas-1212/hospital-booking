import React, { useEffect, useState } from "react";
import commonApi from "../services/commonApi";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const token = localStorage.getItem("token");

        if (!token) {
          navigate("/login");
          return;
        }

        const response = await commonApi(
          "/bookings/my-bookings/",
          "GET",
          null,
          { Authorization: `Token ${token}` }
        );

        setBookings(response.data);

      } catch (err) {
        console.log("ERROR:", err.response?.data || err);
        toast.error("Failed to load bookings");
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [navigate]);

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary"></div>
        <p className="mt-3">Loading your bookings...</p>
      </div>
    );
  }

  if (bookings.length === 0) {
    return (
      <div className="container py-5 text-center">
        <h4>No Bookings Found</h4>
        <button
          className="btn btn-primary mt-3"
          onClick={() => navigate("/booking")}
        >
          Book Now
        </button>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <h3 className="text-center mb-4">My Bookings</h3>

      <div className="row">
        {bookings.map((booking) => (
          <div key={booking.id} className="col-md-6 col-lg-4 mb-4">
            <div className="card shadow-sm h-100">
              <div className="card-body">

                <h5 className="card-title mb-3">
                  {booking.hospital}
                </h5>

                <ul className="list-group list-group-flush mb-3">

                  <li className="list-group-item d-flex justify-content-between">
                    <span>Department</span>
                    <strong>{booking.department}</strong>
                  </li>

                  <li className="list-group-item d-flex justify-content-between">
                    <span>Doctor</span>
                    <strong>{booking.doctor}</strong>
                  </li>

                  <li className="list-group-item d-flex justify-content-between">
                    <span>Date</span>
                    <strong>{booking.date}</strong>
                  </li>

                  <li className="list-group-item d-flex justify-content-between">
                    <span>Session</span>
                    <strong>{booking.session}</strong>
                  </li>

                  <li className="list-group-item d-flex justify-content-between">
                    <span>Token</span>
                    <strong className="text-primary">
                      {booking.token}
                    </strong>
                  </li>

                  <li className="list-group-item d-flex justify-content-between">
                    <span>Status</span>
                    <strong
                      className={
                        booking.status === "Paid"
                          ? "text-success"
                          : "text-warning"
                      }
                    >
                      {booking.status}
                    </strong>
                  </li>

                </ul>

              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MyBookings;
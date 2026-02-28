import React, { useEffect, useState } from "react";
import axios from "axios";

const MyBooking = () => {
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const token = localStorage.getItem("access");

      const response = await axios.get(
        "http://127.0.0.1:8000/api/booking-history/",  // ✅ FIXED URL
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setBookings(response.data);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  return (
    <div className="container mt-4">
      <h2>My Bookings</h2>

      {bookings.length === 0 ? (
        <p>No bookings found.</p>
      ) : (
        <table className="table table-bordered mt-3">
          <thead>
            <tr>
              <th>District</th>
              <th>Hospital</th>
              <th>Department</th>
              <th>Session</th>
              <th>Date</th>
              <th>Token</th>
              <th>Payment</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((booking) => (
              <tr key={booking.id}>
                <td>{booking.district}</td>
                <td>{booking.hospital}</td>
                <td>{booking.department_name}</td>
                <td>{booking.session}</td>
                <td>{booking.booking_date}</td>
                <td>{booking.token_number}</td>
                <td>{booking.payment_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default MyBooking;
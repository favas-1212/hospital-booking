import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

function BookingDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const bookingData = location.state;

  // ✅ Load Razorpay Script Properly
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  if (!bookingData) {
    return (
      <div className="container py-5 text-center">
        <p className="text-danger">
          No booking data found. Go back to book a token.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => navigate("/booking")}
        >
          Go to Booking
        </button>
      </div>
    );
  }

  // ✅ PAYMENT FUNCTION
  const handlePayment = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        alert("Login required");
        navigate("/login");
        return;
      }

      // 1️⃣ Create Order from Backend
      const res = await axios.post(
        "http://127.0.0.1:8000/api/payments/create-order/",
        { booking_id: bookingData.id },
        {
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      const { order_id, amount, razorpay_key } = res.data;

      // ⚠️ IMPORTANT:
      // If backend already multiplies by 100 → DO NOT multiply here.
      // If backend sends normal rupees → multiply here.
      // Assuming backend sends RUPEES:
      
      const options = {
        key: razorpay_key,
        amount: amount * 100, // convert to paise ONLY if backend sends rupees
        currency: "INR",
        name: "CareQueue Hospital Booking",
        description: `Token ${bookingData.token}`,
        order_id: order_id,

        handler: async function (response) {
          try {
            // 2️⃣ Verify Payment
            await axios.post(
              "http://127.0.0.1:8000/api/payments/verify/",
              {
                razorpay_order_id: order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
              {
                headers: {
                  Authorization: `Token ${token}`,
                },
              }
            );

            alert("Payment Successful 🎉");
            navigate("/");
          } catch (err) {
            console.error(err);
            alert("Payment verification failed");
          }
        },

        prefill: {
          name: "Patient",
        },

        theme: {
          color: "#0d6efd",
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Payment Error:", err.response?.data || err);
      alert("Payment failed to start");
    }
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <h4 className="text-center text-success mb-3">
                Booking Confirmed
              </h4>

              <p className="text-center text-muted small mb-4">
                Please reach hospital at least <strong>15 minutes early</strong>.
              </p>

              <ul className="list-group mb-4">
                {[
                  "district",
                  "hospital",
                  "department",
                  "session",
                  "token",
                  "date",
                ].map((field) => (
                  <li
                    key={field}
                    className="list-group-item d-flex justify-content-between"
                  >
                    <span>
                      {field.charAt(0).toUpperCase() + field.slice(1)}
                    </span>
                    <strong
                      className={field === "token" ? "text-primary" : ""}
                    >
                      {bookingData[field]}
                    </strong>
                  </li>
                ))}
              </ul>

              <button
                className="btn btn-primary w-100"
                onClick={handlePayment}
              >
                Pay & Confirm
              </button>

              <button
                className="btn btn-secondary w-100 mt-2"
                onClick={() => navigate("/booking")}
              >
                Back to Booking
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BookingDetails;
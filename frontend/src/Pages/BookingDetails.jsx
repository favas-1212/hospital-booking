import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

function BookingDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const bookingData = location.state;

  if (!bookingData) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #E6FFFA, #CCFBF1)",
        }}
      >
        <div
          className="card shadow"
          style={{
            width: "400px",
            borderRadius: "16px",
            border: "none",
          }}
        >
          <div className="card-body text-center p-4">
            <p className="text-danger mb-3">
              No booking data found. Go back to book a token.
            </p>
            <button
              className="btn w-100"
              style={{
                background: "linear-gradient(90deg, #0E7490, #14B8A6)",
                border: "none",
                color: "white",
                fontWeight: "600",
              }}
              onClick={() => navigate("/booking")}
            >
              Go to Booking
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleBackWithPayment = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        alert("Login required");
        navigate("/login");
        return;
      }

      const res = await axios.post(
        "http://127.0.0.1:8000/api/payments/create-order/",
        { booking_id: Number(bookingData.id) },
        {
          headers: {
            Authorization: `Token ${token}`,
          },
        }
      );

      const { order_id, amount, razorpay_key } = res.data;

      const options = {
        key: razorpay_key,
        amount: amount * 100,
        currency: "INR",
        name: "Hospital Booking",
        description: `Token ${bookingData.token}`,
        order_id: order_id,

        handler: async function (response) {
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

          alert("Payment success 🎉");
          navigate("/my-booking");
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error(err.response?.data || err);
      alert("Payment failed to start");
    }
  };

  return (
    <div
      className="d-flex justify-content-center align-items-center"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #E6FFFA, #CCFBF1)",
      }}
    >
      <div
        className="card shadow-lg"
        style={{
          width: "100%",
          maxWidth: "520px",
          borderRadius: "18px",
          border: "none",
        }}
      >
        <div className="card-body p-4">
          
          {/* Header */}
          <div className="text-center mb-4">
            <h3
              style={{
                fontWeight: "700",
                background: "linear-gradient(90deg, #0E7490, #14B8A6)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Booking Confirmed
            </h3>
            <p className="text-muted small">
              Please reach the hospital at least{" "}
              <strong>15 minutes early</strong>.
            </p>
          </div>

          {/* Booking Details with Divider Lines */}
          <div
            style={{
              background: "#F0FDFA",
              borderRadius: "12px",
              border: "1px solid #CCFBF1",
              overflow: "hidden",
            }}
          >
            {["district", "hospital", "department", "session", "token", "date"].map(
              (field, index) => (
                <div key={field}>
                  <div className="d-flex justify-content-between align-items-center px-3 py-3">
                    <span
                      style={{
                        fontWeight: "500",
                        color: "#0E7490",
                        textTransform: "capitalize",
                      }}
                    >
                      {field}
                    </span>

                    <span
                      style={{
                        fontWeight: "600",
                        color: field === "token" ? "#0F766E" : "#1F2937",
                      }}
                    >
                      {bookingData[field]}
                    </span>
                  </div>

                  {index !== 5 && (
                    <div
                      style={{
                        height: "1px",
                        background:
                          "linear-gradient(90deg, #CCFBF1, #A7F3D0)",
                      }}
                    />
                  )}
                </div>
              )
            )}
          </div>

          {/* Payment Button */}
          <button
            className="btn w-100 mt-4"
            style={{
              background: "linear-gradient(90deg, #0E7490, #14B8A6)",
              border: "none",
              color: "white",
              fontWeight: "600",
              padding: "10px",
              borderRadius: "10px",
              transition: "0.3s ease",
            }}
            onClick={handleBackWithPayment}
          >
            Back to Booking & Pay
          </button>

        </div>
      </div>
    </div>
  );
}

export default BookingDetails;
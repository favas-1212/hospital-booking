import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

function BookingDetails() {
  const location = useLocation();
  const navigate = useNavigate();
  const bookingData = location.state;

  // Load Razorpay script
  // useEffect(() => {
  //   const script = document.createElement("script");
  //   script.src = "https://checkout.razorpay.com/v1/checkout.js";
  //   script.async = true;
  //   document.body.appendChild(script);
  //   return () => document.body.removeChild(script);
  // }, []);

  if (!bookingData) {
    return (
      <div className="container py-5 text-center">
        <p className="text-danger">No booking data found. Go back to book a token.</p>
        <button className="btn btn-primary" onClick={() => navigate("/booking")}>
          Go to Booking
        </button>
      </div>
    );
  }

  // const handlePayment = async () => {
  //   try {
  //     const amount = 50000; // ₹500 = 50000 paise
  //     const orderRes = await axios.post(
  //       "http://127.0.0.1:8000/api/booking/create-payment-order/",
  //       { amount }
  //     );

      // const options = {
      //   key: "YOUR_RAZORPAY_KEY_ID",
      //   amount: orderRes.data.amount,
      //   currency: orderRes.data.currency,
      //   name: "Hospital Booking",
      //   description: `Booking Token ${bookingData.token}`,
      //   order_id: orderRes.data.order_id,
      //   handler: async function (response) {
      //     try {
      //       await axios.post("http://127.0.0.1:8000/api/booking/book-token/", {
      //         department_id: bookingData.department_id,
      //         session: bookingData.session,
      //         token_number: bookingData.token,
      //         payment_id: response.razorpay_payment_id,
      //       });

      //       alert("Payment successful & Booking confirmed!");
      //       navigate("/booking-success");
      //     } catch (err) {
      //       console.error("Booking failed after payment:", err);
      //       alert("Booking failed after payment. Contact support.");
      //     }
      //   },
      //   prefill: {
      //     name: bookingData.full_name,
      //     email: bookingData.email,
      //     contact: bookingData.phone,
      //   },
      //   theme: { color: "#3399cc" },
      // };

  //     const rzp = new window.Razorpay(options);
  //     rzp.open();
  //   } catch (err) {
  //     console.error("Payment initialization failed:", err);
  //     alert("Payment failed. Try again.");
  //   }
  // };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-6">
          <div className="card shadow-sm">
            <div className="card-body">
              <h4 className="text-center text-success mb-3">Booking Confirmed</h4>
              <p className="text-center text-muted small mb-4">
                Please reach the hospital at least <strong>15 minutes early</strong>.
              </p>

              <ul className="list-group mb-4">
                {["district", "hospital", "department", "session", "token", "date"].map((field) => (
                  <li key={field} className="list-group-item d-flex justify-content-between">
                    <span>{field.charAt(0).toUpperCase() + field.slice(1)}</span>
                    <strong className={field === "token" ? "text-primary" : ""}>
                      {bookingData[field]}
                    </strong>
                  </li>
                ))}
              </ul>

              {/* <button className="btn btn-outline-primary w-100 mb-2" onClick={handlePayment}>
                Pay & Confirm
              </button> */}

              <button className="btn btn-secondary w-100" onClick={() => navigate("/booking")}>
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

import { createOrder, verifyPayment } from "../services/paymentApi";

export default function PayButton({ bookingId, token, onSuccess }) {
  const handlePay = async () => {
    try {
      // 1. Create order
      const { data } = await createOrder(bookingId, token);

      const options = {
        key: data.razorpay_key,
        amount: data.amount * 100,
        currency: "INR",
        name: "Hospital Booking",
        description: "OPD Token Payment",
        order_id: data.order_id,

        handler: async (response) => {
          await verifyPayment(response, token);
          alert("Payment successful");
          onSuccess(); // refresh UI
        },

        theme: { color: "#0d6efd" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      alert(err.response?.data?.error || "Payment failed");
    }
  };

  return (
    <button onClick={handlePay} className="btn btn-success btn-sm">
      Pay Now
    </button>
  );
}

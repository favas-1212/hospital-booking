import axios from "axios";

const BASE = "http://127.0.0.1:8000/api/payments/";

export const createOrder = (bookingId, token) =>
  axios.post(
    BASE + "create-order/",
    { booking_id: bookingId },
    { headers: { Authorization: `Bearer ${token}` } }
  );

export const verifyPayment = (data, token) =>
  axios.post(BASE + "verify-payment/", data, {
    headers: { Authorization: `Bearer ${token}` },
  });

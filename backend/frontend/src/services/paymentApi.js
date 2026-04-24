// services/paymentApi.js
import axios from "axios";


export const BASE_URL = "http://127.0.0.1:8000/api/payments";


export const createOrder = (bookingId) => {
  const token = sessionStorage.getItem("token");
  return axios.post(
    `${BASE_URL}/create-order/`,
    { booking_id: bookingId },
    {
      headers: {
        Authorization: `Token ${token}`,
      },
    }
  );
};

export const verifyPayment = (paymentData) => {
  const token = sessionStorage.getItem("token");
  return axios.post(
    `${BASE_URL}/verify/`,  // ← was verify-payment/, correct is verify/
    paymentData,
    {
      headers: {
        Authorization: `Token ${token}`,
      },
    }
  );
};
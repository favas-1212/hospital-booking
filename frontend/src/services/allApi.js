import commonApi from "./commonApi";
import axios from "axios";

// Base URL for Django API
const BASE_URL = "http://127.0.0.1:8000/api";

// ===================== PATIENT =====================

export const registerPatient = (data) => commonApi("/patients/", "POST", data);
export const verifyOtp = (data) => commonApi("/patients/verify_otp/", "POST", data);
export const resendOtp = (data) => commonApi("/patients/resend_otp/", "POST", data);
export const loginPatient = (data) => commonApi("/patients/login/", "POST", data);

// ===================== DOCTOR =====================
export const registerDoctor = (data) => commonApi("/doctors/", "POST", data);
export const loginDoctor = (data) => commonApi("/doctors/login/", "POST", data);

// ===================== OPD STAFF =====================
export const registerOPD = (data) => commonApi(`${BASE_URL}/opdstaff/`, "POST", data);
export const loginOPD = (data) => commonApi(`${BASE_URL}/opdstaff/login/`, "POST", data);

// ===================== DRF TOKEN LOGIN =====================
export const obtainToken = (data) => commonApi(`${BASE_URL}/token/`, "POST", data);

// ===================== OPD DASHBOARD =====================
export const getDoctors = (token) =>
  commonApi(`${BASE_URL}/booking/doctors/`, "GET", null, { Authorization: `Token ${token}` });

export const approveDoctor = (id, token) =>
  commonApi(`${BASE_URL}/booking/doctors/${id}/approve/`, "PATCH", null, { Authorization: `Token ${token}` });

// ======================== BOOKING =====================
export const getDistricts = () => axios.get(`${BASE_URL}/booking/districts/`);
export const getHospitals = (districtId) =>
  axios.get(`${BASE_URL}/booking/hospitals/?district=${districtId}`);
export const getDepartments = (hospitalId) =>
  axios.get(`${BASE_URL}/booking/departments/?hospital=${hospitalId}`);
export const getSessions = () => axios.get(`${BASE_URL}/booking/opd-sessions/`);
export const getAvailableTokens = (departmentId, session) =>
  axios.get(`${BASE_URL}/booking/available-tokens/?department=${departmentId}&session=${session}`);

// Book online token (paid)
export const bookToken = (payload) => {
  const token = localStorage.getItem("token");
  if (!token) throw new Error("No auth token found. Please login first.");
  return axios.post(`${BASE_URL}/booking/book-token/`, payload, {
    headers: { Authorization: `Token ${token}` },
  });
};


// ===================== PAYMENT =====================
export const createPaymentOrder = (amount) =>
  axios.post(`${BASE_URL}/booking/create-payment-order/`, { amount });

// ===================== TOKENS BY DATE =====================
export const getTokensByDate = (departmentId, session, bookingDate) => {
  const token = localStorage.getItem("token");
  return axios.get(
    `${BASE_URL}/booking/tokens/?department_id=${departmentId}&session=${session}&booking_date=${bookingDate}`,
    { headers: { Authorization: `Token ${token}` } }
  );
};

// Doctor dashboard
export const getDoctorDashboard = (date) =>
  commonApi(`/booking/doctor/dashboard/?date=${date}`);




// ------------------ Walk-in Token ------------------
export const fetchOPDDashboard = async (date) => {
  const token = localStorage.getItem("token");
  const res = await axios.get(`${BASE_URL}/booking/opd/dashboard/`, {
    headers: { Authorization: `Token ${token}` },
    params: { date },
  });
  return res.data;
};

// src/services/allApi.js


const API_BASE = "http://127.0.0.1:8000/api/booking";

// Fetch tokens (online + walk-in)
export const fetchTokens = async (doctorId, session, date) => {
  const res = await axios.get(`${API_BASE}/fetch-tokens/`, {
    params: {
      doctor_id: doctorId,
      session: session,
      date: date,
    },
  });
  return res.data;
};

// Book a walk-in token
export const bookWalkinToken = async (data) => {
  const res = await axios.post(`${API_BASE}/book-walkin-token/`, data, {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("access_token")}`, // if using JWT
    },
  });
  return res.data;
};
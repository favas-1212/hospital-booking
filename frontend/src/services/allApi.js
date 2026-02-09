import commonApi from "./commonApi";
import axios from "axios";

// Base URL for Django API
const BASE_URL = "http://127.0.0.1:8000/api";


//  ===================== PATIENT =====================

// Register patient + send OTP

// Patient registration
export const registerPatient = (data) => {
  return commonApi("http://127.0.0.1:8000/api/patients/", "POST", data);
}

// Verify OTP
export const verifyOtp = (data) => {
  return commonApi("http://127.0.0.1:8000/api/patients/verify_otp/", "POST", data);
}

// Resend OTP
export const resendOtp = (data) => {
  return commonApi("http://127.0.0.1:8000/api/patients/resend_otp/", "POST", data);
}

//login patient
export const loginPatient = (data) => {
  // Expects { username, password }
  return commonApi("http://127.0.0.1:8000/api/patients/login/", "POST", data);
};

// ===================== DOCTOR =====================

// Register doctor
export const registerDoctor = (data) =>
  commonApi(`${BASE_URL}/doctors/`, "POST", data);

// Login doctor
export const loginDoctor = (data) =>
  commonApi(`${BASE_URL}/doctors/login/`, "POST", data);


// ===================== OPD STAFF =====================

// Register OPD
export const registerOPD = (data) =>
  commonApi(`${BASE_URL}/opdstaff/`, "POST", data);

// Login OPD and get token
export const loginOPD = (data) =>
  commonApi(`${BASE_URL}/opdstaff/login/`, "POST", data);

// ===================== DRF TOKEN LOGIN (optional) =====================

// Default DRF token login
export const obtainToken = (data) =>
  commonApi(`${BASE_URL}token/`, "POST", data);


// ===================== OPD DASHBOARD =====================

// Get all doctors (OPD only)
export const getDoctors = (token) =>
  commonApi(
    `${BASE_URL}doctors/`,
    "GET",
    null,
    { Authorization: `Token ${token}` }
  );

// Approve doctor
export const approveDoctor = (id, token) =>
  commonApi(
    `${BASE_URL}doctors/${id}/approve/`,
    "PATCH",
    null,
    { Authorization: `Token ${token}` }
  );


//========================BOOKING====================
// ======================== BOOKING =====================

export const getDistricts = () => axios.get(`${BASE_URL}/booking/districts/`);

export const getHospitals = (districtId) =>
  axios.get(`${BASE_URL}/booking/hospitals/?district=${districtId}`);

export const getDepartments = (hospitalId) =>
  axios.get(`${BASE_URL}/booking/departments/?hospital=${hospitalId}`);

// select opd session
export const getSessions = () =>
  axios.get(`${BASE_URL}/booking/opd-sessions/`); // <-- added missing slash

// select token
export const getAvailableTokens = (departmentId, session) =>
  axios.get(
    `${BASE_URL}/booking/available-tokens/?department=${departmentId}&session=${session}` // <-- added missing slash
  );

export const bookToken = (payload) => {
  const token = localStorage.getItem("token"); // ✅ read here

  if (!token) {
    throw new Error("No auth token found. Please login first.");
  }

  return axios.post(`${BASE_URL}/booking/book-token/`, payload, {
    headers: { Authorization: `Token ${token}` },
  });
};


// ===================== PAYMENT =====================

// allApi.js
export const createPaymentOrder = (amount) => {
  return axios.post(
    "http://127.0.0.1:8000/api/booking/create-payment-order/",
    { amount }
  );
};

import commonApi from "./commonApi";
import axios from "axios";

// Base URL for Django API
const BASE_URL = "http://127.0.0.1:8000/api/";


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

// ===================== DOCTOR =====================

// Register doctor
export const registerDoctor = (data) =>
  commonApi(`${BASE_URL}doctors/`, "POST", data);

// Login doctor
export const loginDoctor = (data) =>
  commonApi(`${BASE_URL}doctors/login/`, "POST", data);

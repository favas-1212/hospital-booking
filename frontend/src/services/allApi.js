/**
 * allApi.js — MedQueue frontend API calls
 */

import commonApi from "./commonApi";

// ═══════════════════════════════════════════════════════
// AUTH — PATIENT
// ═══════════════════════════════════════════════════════
export const registerPatient         = (data) => commonApi("/patients/",                   "POST", data);
export const verifyOtp               = (data) => commonApi("/patients/verify_otp/",        "POST", data);
export const resendOtp               = (data) => commonApi("/patients/resend_otp/",        "POST", data);
export const loginPatient            = (data) => commonApi("/patients/login/",             "POST", data);
export const getPatientProfile       = ()     => commonApi("/patients/profile/",           "GET");
export const forgotPasswordPatient   = (data) => commonApi("/patients/forgot_password/",   "POST", data);
export const verifyResetOtpPatient   = (data) => commonApi("/patients/verify_reset_otp/",  "POST", data);

// ═══════════════════════════════════════════════════════
// AUTH — DOCTOR
// ═══════════════════════════════════════════════════════
export const registerDoctor         = (data) => commonApi("/doctors/",                   "POST", data);
export const loginDoctor            = (data) => commonApi("/doctors/login/",             "POST", data);
export const forgotPasswordDoctor   = (data) => commonApi("/doctors/forgot_password/",   "POST", data);
export const verifyResetOtpDoctor   = (data) => commonApi("/doctors/verify_reset_otp/",  "POST", data);

// OPD Pause / Resume (doctor-controlled)
export const pauseOPD  = (data) => commonApi("/booking/opd/pause/",  "POST", data);
export const resumeOPD = (data) => commonApi("/booking/opd/resume/", "POST", data);

// ═══════════════════════════════════════════════════════
// AUTH — OPD STAFF
// ═══════════════════════════════════════════════════════
export const registerOPDStaff         = (data) => commonApi("/opdstaff/",                   "POST", data);
export const loginOPDStaff            = (data) => commonApi("/opdstaff/login/",             "POST", data);
export const forgotPasswordOPDStaff   = (data) => commonApi("/opdstaff/forgot_password/",   "POST", data);
export const verifyResetOtpOPDStaff   = (data) => commonApi("/opdstaff/verify_reset_otp/",  "POST", data);

// ═══════════════════════════════════════════════════════
// PUBLIC / LOOKUP
// ═══════════════════════════════════════════════════════
export const getDistricts   = ()           => commonApi("/booking/districts/",                              "GET");
export const getHospitals   = (districtId) => commonApi(`/booking/hospitals/?district_id=${districtId}`,   "GET");
export const getDepartments = (hospitalId) => commonApi(`/booking/departments/?hospital_id=${hospitalId}`, "GET");
export const getOPDSessions = ()           => commonApi("/booking/opd-sessions/",                          "GET");

export const getApprovedDoctors     = (params = "") => commonApi(`/booking/doctors/all/${params}`,             "GET");
export const getDoctorsByDepartment = (deptId)      => commonApi(`/booking/doctors/?department_id=${deptId}`,  "GET");

export const fetchTokenAvailability = (doctorId, session, date) =>
  commonApi(`/booking/tokens/availability/?doctor_id=${doctorId}&session=${session}&date=${date}`, "GET");

export const getQueueStatus = (doctorId, session, date) =>
  commonApi(`/booking/queue/status/?doctor_id=${doctorId}&session=${session}&date=${date}`, "GET");

// ═══════════════════════════════════════════════════════
// PATIENT — BOOKING
// ═══════════════════════════════════════════════════════
export const bookToken             = (payload) => commonApi("/booking/patient/book/",           "POST",   payload);
export const getBookingHistory     = ()        => commonApi("/booking/patient/history/",        "GET");
export const cancelBooking         = (id)      => commonApi(`/booking/patient/cancel/${id}/`,   "DELETE");
export const getPatientTokenStatus = ()        => commonApi("/booking/patient/token-status/",   "GET");
export const confirmAttendance     = (id)      => commonApi(`/booking/patient/confirm/${id}/`,  "POST");
export const rejectBooking         = (id)      => commonApi(`/booking/patient/reject/${id}/`,   "POST");

// ═══════════════════════════════════════════════════════
// DOCTOR
// ═══════════════════════════════════════════════════════
export const getDoctorDashboard = (date, session = "") =>
  commonApi(`/booking/doctor/dashboard/?date=${date}${session ? `&session=${session}` : ""}`, "GET");

export const startOPD = (data) =>
  commonApi("/booking/doctor/start-opd/", "POST", data);

export const nextToken = (date, session = "") =>
  commonApi(`/booking/doctor/next-token/?date=${date}${session ? `&session=${session}` : ""}`, "POST");

export const skipToken = (id)   => commonApi(`/booking/doctor/skip/${id}/`, "POST");
export const endOPD    = (data) => commonApi("/booking/doctor/end-opd/",    "POST", data);

// ═══════════════════════════════════════════════════════
// STAFF — OPD MANAGEMENT
// ═══════════════════════════════════════════════════════
export const bookWalkinToken       = (data)      => commonApi("/booking/staff/walkin/",                                                       "POST", data);
export const getTokensByDate       = (dId, s, d) => commonApi(`/booking/staff/tokens/?doctor_id=${dId}&session=${s}&booking_date=${d}`,        "GET");
export const getOPDDashboard       = (date = "") => commonApi(`/booking/staff/opd-dashboard/${date ? `?date=${date}` : ""}`,                   "GET");
export const getDoctorTokensByDate = (dId, d)    => commonApi(`/booking/staff/doctor-tokens/?doctor_id=${dId}&date=${d}`,                      "GET");
export const approveBooking        = (id)        => commonApi(`/booking/staff/approve/${id}/`,                                                 "POST");
export const rejectStaffBooking    = (id)        => commonApi(`/booking/staff/reject/${id}/`,                                                  "POST");

// ═══════════════════════════════════════════════════════
// STAFF — MANUAL PATIENT ACTIONS
// ═══════════════════════════════════════════════════════
export const resendOPDNotification  = (id) => commonApi(`/booking/staff/resend-notification/${id}/`,  "POST");
export const staffConfirmAttendance = (id) => commonApi(`/booking/staff/confirm-attendance/${id}/`,   "POST");

// ═══════════════════════════════════════════════════════
// STAFF — DOCTOR REGISTRATION APPROVALS
// ═══════════════════════════════════════════════════════
export const getPendingDoctors = ()   => commonApi("/booking/staff/pending-doctors/",       "GET");
export const approveDoctor     = (id) => commonApi(`/booking/staff/approve-doctor/${id}/`,  "POST");
export const rejectDoctor      = (id) => commonApi(`/booking/staff/reject-doctor/${id}/`,   "POST");

// ═══════════════════════════════════════════════════════
// STAFF — CONSULTATION HISTORY
// ═══════════════════════════════════════════════════════
export const getConsultationHistory = (date = "", doctorId = "", type = "") => {
  const params = [
    date     ? `date=${date}`          : "",
    doctorId ? `doctor_id=${doctorId}` : "",
    type     ? `type=${type}`          : "",
  ].filter(Boolean).join("&");
  return commonApi(`/booking/staff/consultation-history/${params ? `?${params}` : ""}`, "GET");
};

// ═══════════════════════════════════════════════════════
// [NEW] STAFF — DOCTOR LEAVE MANAGEMENT
// ═══════════════════════════════════════════════════════
// applyDoctorLeave  body: { doctor_id, date: "YYYY-MM-DD", session: "morning"|"evening"|"all", reason?: string }
// cancelDoctorLeave body: { doctor_id, date: "YYYY-MM-DD", session: "morning"|"evening"|"all" }
// getDoctorLeaves   optional query: { doctor_id?, date?, include_past? }
export const applyDoctorLeave  = (data)          => commonApi("/booking/staff/leave/apply/",  "POST", data);
export const cancelDoctorLeave = (data)          => commonApi("/booking/staff/leave/cancel/", "POST", data);
export const getDoctorLeaves   = (params = "")   => commonApi(`/booking/staff/leave/list/${params}`, "GET");

// ═══════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════
export const createPaymentOrder = (bookingId) => commonApi("/payments/create-order/", "POST", { booking_id: bookingId });
export const verifyPayment      = (data)      => commonApi("/payments/verify/",       "POST", data);

// ═══════════════════════════════════════════════════════
// BOOKING — AVAILABLE DATES
// ═══════════════════════════════════════════════════════
export const getAvailableBookingDates = () => commonApi("/booking/available-dates/", "GET");

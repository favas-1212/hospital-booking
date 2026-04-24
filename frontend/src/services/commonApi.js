/**
 * commonApi.js
 * ─────────────────────────────────────────────
 * Single axios wrapper used by all API calls.
 * - Auth token read from sessionStorage ("token")
 * - Always uses  Authorization: Token <token>  (DRF TokenAuth)
 * - Content-Type defaults to application/json
 * - Public endpoints (auth/register/reset) skip the token so a
 *   stale/invalid token in sessionStorage doesn't trigger 401.
 */

import axios from "axios";

export const BASE_URL = "http://127.0.0.1:8000/api";

// ───────────────────────────────────────────────────────
// Public endpoints — never send Authorization header here.
// URLs use underscores because DRF's @action decorator
// converts method names (forgot_password) into URL segments
// (forgot_password/) by default.
// ───────────────────────────────────────────────────────
const PUBLIC_ENDPOINTS = [
  // Patient
  "/patients/login/",
  "/patients/verify_otp/",
  "/patients/resend_otp/",
  "/patients/forgot_password/",
  "/patients/verify_reset_otp/",
  // Doctor
  "/doctors/login/",
  "/doctors/forgot_password/",
  "/doctors/verify_reset_otp/",
  // OPD Staff
  "/opdstaff/login/",
  "/opdstaff/forgot_password/",
  "/opdstaff/verify_reset_otp/",
  // Public lookups (safe to leave as public)
  "/booking/districts/",
  "/booking/hospitals/",
  "/booking/departments/",
  "/booking/opd-sessions/",
  "/booking/doctors/",
  "/booking/doctors/all/",
  "/booking/tokens/availability/",
  "/booking/queue/status/",
];

// Registration endpoints are POST-only public.
// GET/PUT/PATCH/DELETE on these URLs require auth.
const PUBLIC_POST_ONLY = [
  "/patients/",
  "/doctors/",
  "/opdstaff/",
];

const isPublicEndpoint = (url, method) => {
  if (PUBLIC_ENDPOINTS.some((p) => url.startsWith(p))) return true;
  if (
    method.toUpperCase() === "POST" &&
    PUBLIC_POST_ONLY.some((p) => url === p || url.startsWith(p + "?"))
  ) {
    return true;
  }
  return false;
};

const commonApi = (url, method = "GET", data = null, extraHeaders = {}) => {
  const token = sessionStorage.getItem("token");
  const isPublic = isPublicEndpoint(url, method);

  // 🛡️ Guard: warn if URL contains unresolved params
  if (url.includes("undefined") || url.includes("null")) {
    console.error(`🚨 commonApi called with bad URL: ${url}`);
    return Promise.reject(new Error(`Invalid API URL: ${url}`));
  }

  return axios({
    url: `${BASE_URL}${url}`,
    method,
    data,
    headers: {
      "Content-Type": "application/json",
      // Attach token only for non-public endpoints
      ...(token && !isPublic && { Authorization: `Token ${token}` }),
      ...extraHeaders,
    },
  });
};

export default commonApi;

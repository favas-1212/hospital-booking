/**
 * commonApi.js
 * ─────────────────────────────────────────────
 * Single axios wrapper used by all API calls.
 * - Auth token read from sessionStorage ("token")
 * - Always uses  Authorization: Token <token>  (DRF TokenAuth)
 * - Content-Type defaults to application/json
 */

import axios from "axios";

export const BASE_URL = "http://127.0.0.1:8000/api";

const commonApi = (url, method = "GET", data = null, extraHeaders = {}) => {
  const token = sessionStorage.getItem("token");

  return axios({
    url: `${BASE_URL}${url}`,
    method,
    data,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Token ${token}` }),
      ...extraHeaders,
    },
  });
};

export default commonApi;

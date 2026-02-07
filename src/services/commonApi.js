import axios from "axios";

const commonApi = (url, method, data = {}, headers = {}) => {
  const config = {
    url,
    method,
    data,
    headers: {
      "Content-Type": "application/json",
      ...headers, // 👈 merge instead of replace
    },
  };

  return axios(config);
};

export default commonApi;

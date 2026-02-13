import axios from "axios";

const BASE_URL = "http://127.0.0.1:8000/api"; // your Django backend

const commonApi = (url, method = "GET", data = null) => {

  const token = localStorage.getItem("token");

  return axios({
    url: `${BASE_URL}${url}`,
    method: method,
    data: data,

    headers: {
      "Content-Type": "application/json",

      ...(token && {
        Authorization: `Token ${token}`
      })

    }

  });

};

export default commonApi;


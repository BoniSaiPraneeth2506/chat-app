// import axios from 'axios';

// const axiosInstance = axios.create({
//     baseURL: "http://localhost:5001/api4",
//     withCredentials: true
// });

// export default axiosInstance;


import axios from "axios";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.MODE === "development" ? "http://localhost:5001/api" : "/api"),
  withCredentials: true,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// A session revoked from another device invalidates this client immediately.
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const isRevoked =
      error.response?.status === 401 &&
      error.response?.data?.message === "Unauthorized: Session has been logged out";

    if (isRevoked) {
      localStorage.removeItem("token");
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;

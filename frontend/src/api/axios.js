import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token") || localStorage.getItem("crm_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = String(error.config?.url || "");
    const isAuthAttempt =
      requestUrl.includes("/auth/login") || requestUrl.includes("/auth/signup");

    if (error.response?.status === 401 && !isAuthAttempt) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("crm_token");
      localStorage.removeItem("crm_user");
      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;

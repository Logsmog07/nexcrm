import axios from "axios";
import { getApiBaseUrl } from "./baseUrl";

const client = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token") || localStorage.getItem("crm_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = String(error.config?.url || "");
    const isAuthAttempt =
      requestUrl.includes("/auth/login") || requestUrl.includes("/auth/signup");

    if (
      error.response?.status === 401 &&
      typeof window !== "undefined" &&
      !isAuthAttempt
    ) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("crm_token");
      localStorage.removeItem("crm_user");
      localStorage.removeItem("crm_impersonation_active");
      localStorage.removeItem("crm_impersonator_token");
      localStorage.removeItem("crm_impersonator_user");
      window.dispatchEvent(new CustomEvent("crm:unauthorized"));
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Request failed";
    return Promise.reject(new Error(message));
  }
);

export default client;

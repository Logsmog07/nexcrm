import axios from "axios";

const devApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3001/api",
  timeout: 10000,
});

devApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("devToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export const authenticateDevConsole = async (accessKey) => {
  const { data } = await devApi.post("/dev/auth", { accessKey });
  return data;
};

export const validateDevSession = async () => {
  const { data } = await devApi.get("/dev/session");
  return data;
};

export const getDevTables = async () => {
  const { data } = await devApi.get("/dev/tables");
  return data;
};

export const getDevTable = async (tableName, params = {}) => {
  const { data } = await devApi.get(`/dev/table/${tableName}`, { params });
  return data;
};

export const getDevSchema = async () => {
  const { data } = await devApi.get("/dev/schema");
  return data;
};

export const getDevRelations = async () => {
  const { data } = await devApi.get("/dev/relations");
  return data;
};

export const getDevStats = async () => {
  const { data } = await devApi.get("/dev/stats");
  return data;
};

export const getDevCompanies = async () => {
  const { data } = await devApi.get("/dev/companies");
  return data;
};

export const getDevUsers = async (params = {}) => {
  const { data } = await devApi.get("/dev/users", { params });
  return data;
};

export const runDevQuery = async (queryText) => {
  const { data } = await devApi.post("/dev/query", { query: queryText });
  return data;
};

export default devApi;

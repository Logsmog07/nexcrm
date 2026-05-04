const localApiUrl = "http://localhost:3001/api";
const productionApiUrl = "https://nexcrm-4.onrender.com/api";

export const getApiBaseUrl = () =>
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? productionApiUrl : localApiUrl);
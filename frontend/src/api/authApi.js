import client from "./client";

const authApi = {
  login: async (payload) => {
    const { data } = await client.post("/auth/login", payload);
    return data;
  },
  signup: async (payload) => {
    const { data } = await client.post("/auth/signup", payload);
    return data;
  },
  me: async () => {
    const { data } = await client.get("/auth/me");
    return data;
  },
  impersonate: async (userId) => {
    const { data } = await client.post(`/auth/impersonate/${userId}`);
    return data;
  },
};

export default authApi;

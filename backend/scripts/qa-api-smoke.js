const axios = require("axios");

const BASE_URL = "http://localhost:3001/api";

async function login(email, password) {
  const response = await axios.post(`${BASE_URL}/auth/login`, { email, password });
  const token = response.data && response.data.token;

  if (!token) {
    throw new Error(`No token returned for ${email}`);
  }

  return { headers: { Authorization: `Bearer ${token}` } };
}

async function runChecks(label, auth, checks) {
  console.log(`\n${label}`);

  for (const [name, fn] of checks) {
    try {
      const response = await fn(auth);
      console.log(`  PASS ${name} -> ${response.status}`);
    } catch (error) {
      const status = error && error.response ? error.response.status : "ERR";
      const message =
        (error && error.response && error.response.data && error.response.data.message) ||
        error.message;
      console.error(`  FAIL ${name} -> ${status} (${message})`);
      process.exit(1);
    }
  }
}

async function main() {
  const adminAuth = await login("admin@crm.local", "Password123!");
  await runChecks("Platform admin endpoint smoke", adminAuth, [
    ["GET /analytics/dashboard", (auth) => axios.get(`${BASE_URL}/analytics/dashboard`, auth)],
    ["GET /users", (auth) => axios.get(`${BASE_URL}/users`, auth)],
    ["GET /audit/logs", (auth) => axios.get(`${BASE_URL}/audit/logs`, auth)],
    ["GET /settings", (auth) => axios.get(`${BASE_URL}/settings`, auth)],
  ]);

  const managerAuth = await login("manager@crm.local", "Password123!");
  await runChecks("Manager endpoint smoke", managerAuth, [
    ["GET /analytics/dashboard", (auth) => axios.get(`${BASE_URL}/analytics/dashboard`, auth)],
    ["GET /leads", (auth) => axios.get(`${BASE_URL}/leads`, auth)],
    ["GET /customers", (auth) => axios.get(`${BASE_URL}/customers`, auth)],
    ["GET /deals", (auth) => axios.get(`${BASE_URL}/deals`, auth)],
    ["GET /activities", (auth) => axios.get(`${BASE_URL}/activities`, auth)],
    ["GET /notifications", (auth) => axios.get(`${BASE_URL}/notifications`, auth)],
    ["GET /settings", (auth) => axios.get(`${BASE_URL}/settings`, auth)],
  ]);

  console.log("\nRole-based API smoke checks passed");
}

main().catch((error) => {
  console.error("QA API smoke failed:", error.message);
  process.exit(1);
});

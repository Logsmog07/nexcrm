const app = require("./src/app");
const env = require("./src/config/env");
const { pool } = require("./src/config/db");

const start = async () => {
  try {
    await pool.query("SELECT 1");

    app.listen(env.port, () => {
      console.log(`CRM backend listening on port ${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start backend", error);
    process.exit(1);
  }
};

start();

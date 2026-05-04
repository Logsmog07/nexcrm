const { Pool } = require("pg");
const env = require("./env");

const pool = new Pool(env.db);

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL client error", error);
});

const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query,
};

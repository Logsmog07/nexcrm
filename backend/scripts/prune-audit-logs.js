const { pool } = require("../src/config/db");
const env = require("../src/config/env");

const run = async () => {
  const retentionDays = env.security.auditLogRetentionDays;

  try {
    const result = await pool.query("SELECT prune_audit_logs($1::int) AS deleted_count", [
      retentionDays,
    ]);

    const deletedCount = Number(result.rows?.[0]?.deleted_count || 0);

    console.log(
      JSON.stringify(
        {
          success: true,
          retentionDays,
          deletedCount,
        },
        null,
        2
      )
    );
  } finally {
    await pool.end();
  }
};

run().catch((error) => {
  console.error("Failed to prune audit logs", error);
  process.exit(1);
});

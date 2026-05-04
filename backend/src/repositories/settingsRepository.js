const { query } = require("../config/db");

const findByUserId = async (userId) => {
  const { rows } = await query(
    `
      SELECT user_id, settings, created_at, updated_at
      FROM user_settings
      WHERE user_id = $1
    `,
    [userId]
  );

  return rows[0] || null;
};

const upsertByUserId = async (userId, settings) => {
  const { rows } = await query(
    `
      INSERT INTO user_settings (user_id, settings)
      VALUES ($1, $2::jsonb)
      ON CONFLICT (user_id)
      DO UPDATE SET
        settings = EXCLUDED.settings,
        updated_at = NOW()
      RETURNING user_id, settings, created_at, updated_at
    `,
    [userId, JSON.stringify(settings || {})]
  );

  return rows[0] || null;
};

module.exports = {
  findByUserId,
  upsertByUserId,
};
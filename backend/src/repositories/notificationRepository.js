const { query } = require("../config/db");

const create = async ({ userId, companyId, type, title, message, remindAt, metadata }) => {
  const { rows } = await query(
    `
      INSERT INTO notifications (user_id, company_id, type, title, message, remind_at, metadata)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING *
    `,
    [userId, companyId || null, type, title, message, remindAt || null, metadata || {}]
  );
  return rows[0];
};

const listForUser = async (userId) => {
  const { rows } = await query(
    `
      SELECT *
      FROM notifications
      WHERE user_id = $1
      ORDER BY is_read ASC, created_at DESC
    `,
    [userId]
  );
  return rows;
};

const markAsRead = async (id, userId) => {
  const { rows } = await query(
    `
      UPDATE notifications
      SET is_read = TRUE
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `,
    [id, userId]
  );
  return rows[0] || null;
};

const listPendingReminders = async ({ companyId, userIds } = {}) => {
  const params = [];
  const conditions = [
    "n.remind_at IS NOT NULL",
    "n.remind_at <= NOW()",
    "n.is_read = FALSE",
  ];

  if (companyId) {
    params.push(companyId);
    conditions.push(`n.company_id = $${params.length}`);
  }

  if (userIds?.length) {
    params.push(userIds);
    conditions.push(`n.user_id = ANY($${params.length}::int[])`);
  }

  const { rows } = await query(
    `
      SELECT n.*
      FROM notifications n
      WHERE ${conditions.join(" AND ")}
      ORDER BY n.remind_at ASC
    `,
    params
  );
  return rows;
};

module.exports = {
  create,
  listForUser,
  markAsRead,
  listPendingReminders,
};

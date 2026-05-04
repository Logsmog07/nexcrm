const { query } = require("../config/db");

const selectFragment = `
  SELECT
    a.*,
    u.full_name AS user_name,
    l.name AS lead_name,
    c.name AS customer_name,
    d.title AS deal_title
  FROM activities a
  LEFT JOIN users u ON u.id = a.user_id
  LEFT JOIN leads l ON l.id = a.related_lead_id
  LEFT JOIN customers c ON c.id = a.related_customer_id
  LEFT JOIN deals d ON d.id = a.related_deal_id
`;

const create = async ({
  type,
  subject,
  notes,
  dueAt,
  completedAt,
  relatedLeadId,
  relatedCustomerId,
  relatedDealId,
  userId,
  companyId,
}) => {
  const { rows } = await query(
    `
      INSERT INTO activities (
        type, subject, notes, due_at, completed_at,
        related_lead_id, related_customer_id, related_deal_id, user_id, company_id
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `,
    [
      type,
      subject,
      notes || null,
      dueAt || null,
      completedAt || null,
      relatedLeadId || null,
      relatedCustomerId || null,
      relatedDealId || null,
      userId,
      companyId || null,
    ]
  );

  return rows[0];
};

const list = async ({
  relatedLeadId,
  relatedCustomerId,
  relatedDealId,
  userId,
  companyId,
  userIds,
} = {}) => {
  const params = [];
  const conditions = [];

  if (companyId) {
    params.push(companyId);
    conditions.push(`a.company_id = $${params.length}`);
  }

  if (relatedLeadId) {
    params.push(relatedLeadId);
    conditions.push(`a.related_lead_id = $${params.length}`);
  }

  if (relatedCustomerId) {
    params.push(relatedCustomerId);
    conditions.push(`a.related_customer_id = $${params.length}`);
  }

  if (relatedDealId) {
    params.push(relatedDealId);
    conditions.push(`a.related_deal_id = $${params.length}`);
  }

  if (userId) {
    params.push(userId);
    conditions.push(`a.user_id = $${params.length}`);
  }

  if (userIds?.length) {
    params.push(userIds);
    conditions.push(`a.user_id = ANY($${params.length}::int[])`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await query(
    `${selectFragment} ${whereClause} ORDER BY COALESCE(a.due_at, a.created_at) DESC`,
    params
  );

  return rows;
};

const findById = async (id) => {
  const { rows } = await query(`${selectFragment} WHERE a.id = $1`, [id]);
  return rows[0] || null;
};

const updateCompletion = async (id, completedAt) => {
  const { rows } = await query(
    `
      UPDATE activities
      SET completed_at = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, completedAt]
  );
  return rows[0] || null;
};

module.exports = {
  create,
  list,
  findById,
  updateCompletion,
};

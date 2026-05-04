const { query } = require("../config/db");

const selectFragment = `
  SELECT
    d.*,
    u.full_name AS owner_name,
    c.name AS customer_name,
    l.name AS lead_name
  FROM deals d
  LEFT JOIN users u ON u.id = d.owner_id
  LEFT JOIN customers c ON c.id = d.customer_id
  LEFT JOIN leads l ON l.id = d.lead_id
`;

const create = async ({
  title,
  customerId,
  leadId,
  ownerId,
  companyId,
  stage,
  value,
  probability,
  expectedCloseDate,
  status,
}) => {
  const { rows } = await query(
    `
      INSERT INTO deals (
        title, customer_id, lead_id, owner_id, company_id, stage, value,
        probability, expected_close_date, status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `,
    [
      title,
      customerId || null,
      leadId || null,
      ownerId || null,
      companyId || null,
      stage,
      value || 0,
      probability || 0,
      expectedCloseDate || null,
      status || "open",
    ]
  );

  return rows[0];
};

const update = async (
  id,
  {
    title,
    customerId,
    leadId,
    ownerId,
    stage,
    value,
    probability,
    expectedCloseDate,
    status,
  }
) => {
  const { rows } = await query(
    `
      UPDATE deals
      SET
        title = $2,
        customer_id = $3,
        lead_id = $4,
        owner_id = $5,
        stage = $6,
        value = $7,
        probability = $8,
        expected_close_date = $9,
        status = $10,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      title,
      customerId || null,
      leadId || null,
      ownerId || null,
      stage,
      value || 0,
      probability || 0,
      expectedCloseDate || null,
      status || "open",
    ]
  );

  return rows[0] || null;
};

const updateStage = async (id, stage) => {
  const status = stage === "won" ? "won" : stage === "lost" ? "lost" : "open";
  const { rows } = await query(
    `
      UPDATE deals
      SET stage = $2, status = $3, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, stage, status]
  );

  return rows[0] || null;
};

const findById = async (id) => {
  const { rows } = await query(`${selectFragment} WHERE d.id = $1`, [id]);
  return rows[0] || null;
};

const list = async ({ ownerId, companyId, ownerIds, stage } = {}) => {
  const params = [];
  const conditions = [];

  if (companyId) {
    params.push(companyId);
    conditions.push(`d.company_id = $${params.length}`);
  }

  if (ownerId) {
    params.push(ownerId);
    conditions.push(`d.owner_id = $${params.length}`);
  }

  if (ownerIds?.length) {
    params.push(ownerIds);
    conditions.push(`d.owner_id = ANY($${params.length}::int[])`);
  }

  if (stage) {
    params.push(stage);
    conditions.push(`d.stage = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await query(
    `${selectFragment} ${whereClause} ORDER BY d.updated_at DESC`,
    params
  );
  return rows;
};

const remove = async (id) => {
  const { rowCount } = await query("DELETE FROM deals WHERE id = $1", [id]);
  return rowCount > 0;
};

module.exports = {
  create,
  update,
  updateStage,
  findById,
  list,
  remove,
};

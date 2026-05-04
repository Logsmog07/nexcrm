const { query } = require("../config/db");
const { buildContainsPattern } = require("../utils/search");

const selectFragment = `
  SELECT
    c.*,
    u.full_name AS owner_name,
    l.name AS source_lead_name
  FROM customers c
  LEFT JOIN users u ON u.id = c.owner_id
  LEFT JOIN leads l ON l.id = c.lead_id
`;

const create = async ({
  leadId,
  name,
  email,
  phone,
  company,
  industry,
  ownerId,
  companyId,
  lifecycleStage,
  totalRevenue,
  notes,
}) => {
  const { rows } = await query(
    `
      INSERT INTO customers (
        lead_id, name, email, phone, company, industry, owner_id,
        company_id, lifecycle_stage, total_revenue, notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *
    `,
    [
      leadId || null,
      name,
      email,
      phone || null,
      company || null,
      industry || null,
      ownerId || null,
      companyId || null,
      lifecycleStage || "active",
      totalRevenue || 0,
      notes || null,
    ]
  );
  return rows[0];
};

const update = async (
  id,
  {
    name,
    email,
    phone,
    company,
    industry,
    ownerId,
    lifecycleStage,
    totalRevenue,
    notes,
  }
) => {
  const { rows } = await query(
    `
      UPDATE customers
      SET
        name = $2,
        email = $3,
        phone = $4,
        company = $5,
        industry = $6,
        owner_id = $7,
        lifecycle_stage = $8,
        total_revenue = $9,
        notes = $10,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      name,
      email,
      phone || null,
      company || null,
      industry || null,
      ownerId || null,
      lifecycleStage || "active",
      totalRevenue || 0,
      notes || null,
    ]
  );
  return rows[0] || null;
};

const findById = async (id) => {
  const { rows } = await query(`${selectFragment} WHERE c.id = $1`, [id]);
  return rows[0] || null;
};

const list = async ({ ownerId, companyId, ownerIds, search } = {}) => {
  const params = [];
  const conditions = [];

  if (companyId) {
    params.push(companyId);
    conditions.push(`c.company_id = $${params.length}`);
  }

  if (ownerId) {
    params.push(ownerId);
    conditions.push(`c.owner_id = $${params.length}`);
  }

  if (ownerIds?.length) {
    params.push(ownerIds);
    conditions.push(`c.owner_id = ANY($${params.length}::int[])`);
  }

  const searchPattern = buildContainsPattern(search);
  if (searchPattern) {
    params.push(searchPattern);
    conditions.push(
      `(c.name ILIKE $${params.length} ESCAPE '\\' OR c.email ILIKE $${params.length} ESCAPE '\\' OR COALESCE(c.company, '') ILIKE $${params.length} ESCAPE '\\')`
    );
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await query(
    `${selectFragment} ${whereClause} ORDER BY c.created_at DESC`,
    params
  );

  return rows;
};

const remove = async (id) => {
  const { rowCount } = await query("DELETE FROM customers WHERE id = $1", [id]);
  return rowCount > 0;
};

const updateRevenue = async (id, totalRevenue) => {
  const { rows } = await query(
    `
      UPDATE customers
      SET total_revenue = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, totalRevenue]
  );
  return rows[0] || null;
};

module.exports = {
  create,
  update,
  findById,
  list,
  remove,
  updateRevenue,
};

const { query } = require("../config/db");
const { buildContainsPattern } = require("../utils/search");

const buildLeadFilters = ({ status, assignedTo, createdBy, companyId, ownerIds, search }) => {
  const conditions = [];
  const params = [];

  if (companyId) {
    params.push(companyId);
    conditions.push(`l.company_id = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`l.status = $${params.length}`);
  }

  if (assignedTo) {
    params.push(assignedTo);
    conditions.push(`l.assigned_to = $${params.length}`);
  }

  if (createdBy) {
    params.push(createdBy);
    conditions.push(`l.created_by = $${params.length}`);
  }

  if (ownerIds?.length) {
    params.push(ownerIds);
    conditions.push(
      `(l.assigned_to = ANY($${params.length}::int[]) OR l.created_by = ANY($${params.length}::int[]))`
    );
  }

  const searchPattern = buildContainsPattern(search);
  if (searchPattern) {
    params.push(searchPattern);
    conditions.push(
      `(l.name ILIKE $${params.length} ESCAPE '\\' OR l.email ILIKE $${params.length} ESCAPE '\\' OR COALESCE(l.company, '') ILIKE $${params.length} ESCAPE '\\')`
    );
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
};

const selectFragment = `
  SELECT
    l.*,
    u.full_name AS assigned_user_name,
    c.full_name AS created_by_name
  FROM leads l
  LEFT JOIN users u ON u.id = l.assigned_to
  LEFT JOIN users c ON c.id = l.created_by
`;

const create = async ({
  name,
  email,
  phone,
  company,
  source,
  status,
  score,
  estimatedValue,
  notes,
  assignedTo,
  createdBy,
  companyId,
  lastContactedAt,
}) => {
  const { rows } = await query(
    `
      INSERT INTO leads (
        name, email, phone, company, source, status, score, estimated_value,
        notes, assigned_to, created_by, company_id, last_contacted_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *
    `,
    [
      name,
      email,
      phone || null,
      company || null,
      source || null,
      status,
      score || 0,
      estimatedValue || 0,
      notes || null,
      assignedTo || null,
      createdBy,
      companyId || null,
      lastContactedAt || null,
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
    source,
    status,
    score,
    estimatedValue,
    notes,
    assignedTo,
    lastContactedAt,
  }
) => {
  const { rows } = await query(
    `
      UPDATE leads
      SET
        name = $2,
        email = $3,
        phone = $4,
        company = $5,
        source = $6,
        status = $7,
        score = $8,
        estimated_value = $9,
        notes = $10,
        assigned_to = $11,
        last_contacted_at = $12,
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
      source || null,
      status,
      score || 0,
      estimatedValue || 0,
      notes || null,
      assignedTo || null,
      lastContactedAt || null,
    ]
  );

  return rows[0] || null;
};

const remove = async (id) => {
  const { rowCount } = await query("DELETE FROM leads WHERE id = $1", [id]);
  return rowCount > 0;
};

const findById = async (id) => {
  const { rows } = await query(`${selectFragment} WHERE l.id = $1`, [id]);
  return rows[0] || null;
};

const list = async (filters = {}) => {
  const { whereClause, params } = buildLeadFilters(filters);
  const { rows } = await query(
    `${selectFragment} ${whereClause} ORDER BY l.created_at DESC`,
    params
  );
  return rows;
};

const updateStatus = async (id, status) => {
  const { rows } = await query(
    `
      UPDATE leads
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, status]
  );

  return rows[0] || null;
};

module.exports = {
  create,
  update,
  remove,
  findById,
  list,
  updateStatus,
};

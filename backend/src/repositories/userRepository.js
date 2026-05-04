const { query } = require("../config/db");

const baseSelect = `
  SELECT
    u.id,
    u.full_name,
    u.email,
    u.avatar_url,
    u.is_active,
    COALESCE(u.platform_role::text, u.company_role::text) AS role,
    u.platform_role,
    u.company_role,
    u.company_id,
    u.manager_id,
    c.name AS company_name,
    m.full_name AS manager_name,
    u.created_at,
    u.updated_at
  FROM users u
  LEFT JOIN companies c ON c.id = u.company_id
  LEFT JOIN users m ON m.id = u.manager_id
`;

const baseSelectWithPassword = `
  SELECT
    u.id,
    u.full_name,
    u.email,
    u.avatar_url,
    u.password_hash,
    u.is_active,
    COALESCE(u.platform_role::text, u.company_role::text) AS role,
    u.platform_role,
    u.company_role,
    u.company_id,
    u.manager_id,
    c.name AS company_name,
    m.full_name AS manager_name,
    u.created_at,
    u.updated_at
  FROM users u
  LEFT JOIN companies c ON c.id = u.company_id
  LEFT JOIN users m ON m.id = u.manager_id
`;

const create = async ({
  fullName,
  email,
  passwordHash,
  platformRole,
  companyRole,
  companyId,
  managerId,
  avatarUrl,
}) => {
  const { rows } = await query(
    `
      INSERT INTO users (
        full_name, email, password_hash, platform_role, company_role, company_id, manager_id, avatar_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, full_name, email, avatar_url, is_active,
        COALESCE(platform_role::text, company_role::text) AS role,
        platform_role, company_role, company_id, manager_id, created_at, updated_at
    `,
    [
      fullName,
      email,
      passwordHash,
      platformRole || null,
      companyRole || null,
      companyId || null,
      managerId || null,
      avatarUrl || null,
    ]
  );

  return rows[0];
};

const findByEmail = async (email) => {
  const { rows } = await query(`${baseSelectWithPassword} WHERE u.email = $1`, [
    email,
  ]);
  return rows[0] || null;
};

const findById = async (id) => {
  const { rows } = await query(`${baseSelect} WHERE u.id = $1`, [id]);
  return rows[0] || null;
};

const list = async ({ companyId, managerId } = {}) => {
  const conditions = [];
  const params = [];

  if (companyId) {
    params.push(companyId);
    conditions.push(`u.company_id = $${params.length}`);
  }

  if (managerId) {
    params.push(managerId);
    conditions.push(`u.manager_id = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows } = await query(
    `${baseSelect} ${whereClause} ORDER BY u.created_at DESC`,
    params
  );
  return rows;
};

const listManagedRepIds = async (managerId) => {
  const { rows } = await query(
    `
      SELECT id
      FROM users
      WHERE manager_id = $1
      ORDER BY created_at DESC
    `,
    [managerId]
  );

  return rows.map((row) => row.id);
};

const updateActiveStatus = async (id, isActive) => {
  const { rows } = await query(
    `
      UPDATE users
      SET is_active = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, full_name, email, avatar_url, is_active,
        COALESCE(platform_role::text, company_role::text) AS role,
        platform_role, company_role, company_id, manager_id, created_at, updated_at
    `,
    [id, isActive]
  );

  return rows[0] || null;
};

const updatePasswordHash = async (id, passwordHash) => {
  const { rows } = await query(
    `
      UPDATE users
      SET password_hash = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, full_name, email, avatar_url, is_active,
        COALESCE(platform_role::text, company_role::text) AS role,
        platform_role, company_role, company_id, manager_id, created_at, updated_at
    `,
    [id, passwordHash]
  );

  return rows[0] || null;
};

const updateManagerAssignment = async (id, managerId) => {
  const { rows } = await query(
    `
      UPDATE users
      SET manager_id = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING id, full_name, email, avatar_url, is_active,
        COALESCE(platform_role::text, company_role::text) AS role,
        platform_role, company_role, company_id, manager_id, created_at, updated_at
    `,
    [id, managerId || null]
  );

  return rows[0] || null;
};

module.exports = {
  create,
  findByEmail,
  findById,
  list,
  listManagedRepIds,
  updateActiveStatus,
  updatePasswordHash,
  updateManagerAssignment,
};

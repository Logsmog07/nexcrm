const { query } = require("../config/db");

const selectFragment = `
  SELECT
    c.id,
    c.name,
    c.email,
    c.phone,
    c.industry,
    c.company_size,
    c.address,
    c.subscription_plan,
    c.status,
    c.created_at,
    c.updated_at
  FROM companies c
`;

const create = async ({
  name,
  email,
  phone,
  industry,
  companySize,
  address,
  subscriptionPlan,
  status,
}) => {
  const { rows } = await query(
    `
      INSERT INTO companies (
        name, email, phone, industry, company_size, address, subscription_plan, status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `,
    [
      name,
      email,
      phone || null,
      industry || null,
      companySize || null,
      address || null,
      subscriptionPlan || "starter",
      status || "trial",
    ]
  );
  return rows[0];
};

const findByEmail = async (email) => {
  const { rows } = await query(`${selectFragment} WHERE c.email = $1`, [email]);
  return rows[0] || null;
};

const findById = async (id) => {
  const { rows } = await query(`${selectFragment} WHERE c.id = $1`, [id]);
  return rows[0] || null;
};

const list = async () => {
  const { rows } = await query(`${selectFragment} ORDER BY c.created_at DESC`);
  return rows;
};

const listWithSummaries = async () => {
  const { rows } = await query(`
    SELECT
      c.id,
      c.name,
      c.email,
      c.phone,
      c.industry,
      c.company_size,
      c.address,
      c.subscription_plan,
      c.status,
      c.created_at,
      c.updated_at,
      COUNT(DISTINCT u.id)::int AS total_users,
      COUNT(DISTINCT l.id)::int AS total_leads,
      COUNT(DISTINCT cu.id)::int AS total_customers,
      COUNT(DISTINCT d.id)::int AS total_deals,
      COALESCE(SUM(CASE WHEN d.status = 'won' THEN d.value ELSE 0 END), 0) AS revenue
    FROM companies c
    LEFT JOIN users u ON u.company_id = c.id
    LEFT JOIN leads l ON l.company_id = c.id
    LEFT JOIN customers cu ON cu.company_id = c.id
    LEFT JOIN deals d ON d.company_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);

  return rows;
};

const update = async (
  id,
  { name, email, phone, industry, companySize, address, subscriptionPlan, status }
) => {
  const { rows } = await query(
    `
      UPDATE companies
      SET
        name = $2,
        email = $3,
        phone = $4,
        industry = $5,
        company_size = $6,
        address = $7,
        subscription_plan = $8,
        status = $9,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      name,
      email,
      phone || null,
      industry || null,
      companySize || null,
      address || null,
      subscriptionPlan || "starter",
      status || "trial",
    ]
  );

  return rows[0] || null;
};

const updateStatus = async (id, status) => {
  const { rows } = await query(
    `
      UPDATE companies
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, status]
  );

  return rows[0] || null;
};

const remove = async (id) => {
  const { rowCount } = await query("DELETE FROM companies WHERE id = $1", [id]);
  return rowCount > 0;
};

module.exports = {
  create,
  findByEmail,
  findById,
  list,
  listWithSummaries,
  update,
  updateStatus,
  remove,
};

const { query } = require("../config/db");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");

const SENSITIVE_COLUMNS = new Set([
  "password_hash",
  "token",
  "secret",
  "refresh_token",
  "access_token",
]);

const quoteIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;

const parseLimit = (limit) => {
  const parsed = Number.parseInt(limit, 10);
  const fallback = env.developerPortal.defaultPreviewRows;
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(parsed, env.developerPortal.maxPreviewRows);
};

const listTables = async () => {
  const { rows } = await query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name ASC
    `
  );

  return rows.map((row) => row.table_name);
};

const listColumnsForTables = async (tableNames) => {
  if (!tableNames.length) {
    return [];
  }

  const { rows } = await query(
    `
      SELECT
        table_name,
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
      ORDER BY table_name ASC, ordinal_position ASC
    `,
    [tableNames]
  );

  return rows;
};

const listForeignKeys = async () => {
  const { rows } = await query(
    `
      SELECT
        tc.table_name AS from_table,
        kcu.column_name AS from_column,
        ccu.table_name AS to_table,
        ccu.column_name AS to_column,
        tc.constraint_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name ASC, tc.constraint_name ASC
    `
  );

  return rows;
};

const listTableEstimates = async () => {
  const { rows } = await query(
    `
      SELECT relname AS table_name, COALESCE(n_live_tup, 0)::bigint AS estimated_rows
      FROM pg_stat_user_tables
      ORDER BY relname ASC
    `
  );

  return rows;
};

const getCompanyBreakdown = async () => {
  const { rows } = await query(
    `
      SELECT
        c.id,
        c.name,
        c.status,
        (SELECT COUNT(*)::int FROM users u WHERE u.company_id = c.id) AS users_count,
        (SELECT COUNT(*)::int FROM leads l WHERE l.company_id = c.id) AS leads_count,
        (SELECT COUNT(*)::int FROM customers cu WHERE cu.company_id = c.id) AS customers_count,
        (SELECT COUNT(*)::int FROM deals d WHERE d.company_id = c.id) AS deals_count,
        (SELECT COUNT(*)::int FROM activities a WHERE a.company_id = c.id) AS activities_count,
        (SELECT COUNT(*)::int FROM notifications n WHERE n.company_id = c.id) AS notifications_count,
        (SELECT COALESCE(SUM(d.value), 0)::numeric(14,2) FROM deals d WHERE d.company_id = c.id) AS pipeline_value
      FROM companies c
      ORDER BY c.name ASC
    `
  );

  return rows;
};

const getLoginDirectory = async () => {
  const { rows } = await query(
    `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.is_active,
        COALESCE(u.platform_role::text, u.company_role::text, 'unknown') AS role,
        c.id AS company_id,
        c.name AS company_name,
        m.full_name AS manager_name,
        u.created_at,
        u.updated_at
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      LEFT JOIN users m ON m.id = u.manager_id
      ORDER BY c.name NULLS FIRST, u.full_name ASC
    `
  );

  return rows;
};

const getRoleDistribution = async () => {
  const { rows } = await query(
    `
      SELECT
        COALESCE(platform_role::text, company_role::text, 'unknown') AS role,
        COUNT(*)::int AS count
      FROM users
      GROUP BY 1
      ORDER BY count DESC, role ASC
    `
  );

  return rows;
};

const buildSchemaMap = async () => {
  const tableNames = await listTables();
  const [columns, relationships] = await Promise.all([
    listColumnsForTables(tableNames),
    listForeignKeys(),
  ]);

  const tableMap = new Map(
    tableNames.map((tableName) => [
      tableName,
      {
        name: tableName,
        columns: [],
      },
    ])
  );

  for (const column of columns) {
    tableMap.get(column.table_name)?.columns.push({
      name: column.column_name,
      dataType: column.data_type,
      udtName: column.udt_name,
      nullable: column.is_nullable === "YES",
      defaultValue: column.column_default,
      ordinalPosition: column.ordinal_position,
    });
  }

  return {
    tables: Array.from(tableMap.values()),
    relationships,
  };
};

const getOverview = async () => {
  const [schema, tableEstimates, companyBreakdown, loginDirectory, roleDistribution] =
    await Promise.all([
      buildSchemaMap(),
      listTableEstimates(),
      getCompanyBreakdown(),
      getLoginDirectory(),
      getRoleDistribution(),
    ]);

  const totalColumns = schema.tables.reduce(
    (accumulator, table) => accumulator + table.columns.length,
    0
  );
  const estimatedRows = tableEstimates.reduce(
    (accumulator, table) => accumulator + Number(table.estimated_rows || 0),
    0
  );

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      tables: schema.tables.length,
      columns: totalColumns,
      relationships: schema.relationships.length,
      estimatedRows,
      companies: companyBreakdown.length,
      users: loginDirectory.length,
    },
    tableEstimates,
    companyBreakdown,
    roleDistribution,
    loginDirectory,
    topRelationships: schema.relationships.slice(0, 18),
  };
};

const getCompanySnapshot = async (companyId) => {
  const { rows: companyRows } = await query(
    `
      SELECT id, name, email, industry, status, subscription_plan, created_at, updated_at
      FROM companies
      WHERE id = $1
      LIMIT 1
    `,
    [companyId]
  );

  const company = companyRows[0] || null;
  if (!company) {
    throw new ApiError(404, "Company not found");
  }

  const [users, leads, customers, deals, activities, notifications, auditEvents] =
    await Promise.all([
      query(
        `
          SELECT id, full_name, email, is_active,
            COALESCE(platform_role::text, company_role::text, 'unknown') AS role,
            manager_id,
            created_at
          FROM users
          WHERE company_id = $1
          ORDER BY full_name ASC
        `,
        [companyId]
      ),
      query(
        "SELECT id, name, status, score, estimated_value, created_at FROM leads WHERE company_id = $1 ORDER BY created_at DESC LIMIT 40",
        [companyId]
      ),
      query(
        "SELECT id, name, email, lifecycle_stage, total_revenue, created_at FROM customers WHERE company_id = $1 ORDER BY created_at DESC LIMIT 40",
        [companyId]
      ),
      query(
        "SELECT id, title, stage, status, value, probability, expected_close_date, created_at FROM deals WHERE company_id = $1 ORDER BY created_at DESC LIMIT 40",
        [companyId]
      ),
      query(
        "SELECT id, type, subject, due_at, completed_at, user_id, created_at FROM activities WHERE company_id = $1 ORDER BY created_at DESC LIMIT 40",
        [companyId]
      ),
      query(
        "SELECT id, type, title, is_read, created_at FROM notifications WHERE company_id = $1 ORDER BY created_at DESC LIMIT 40",
        [companyId]
      ),
      query(
        "SELECT id, action, entity_type, entity_id, outcome, actor_user_id, created_at FROM audit_logs WHERE company_id = $1 ORDER BY created_at DESC LIMIT 40",
        [companyId]
      ).catch(() => ({ rows: [] })),
    ]);

  return {
    company,
    users: users.rows,
    leads: leads.rows,
    customers: customers.rows,
    deals: deals.rows,
    activities: activities.rows,
    notifications: notifications.rows,
    auditEvents: auditEvents.rows,
  };
};

const sanitizeRow = (row) => {
  if (!row || typeof row !== "object") {
    return row;
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(row)) {
    if (SENSITIVE_COLUMNS.has(String(key || "").toLowerCase())) {
      sanitized[key] = "[redacted]";
      continue;
    }

    sanitized[key] = value;
  }

  return sanitized;
};

const getTablePreview = async ({ tableName, companyId, limit }) => {
  const normalizedTable = String(tableName || "").trim().toLowerCase();
  if (!normalizedTable) {
    throw new ApiError(400, "A table name is required");
  }

  const tables = await listTables();
  if (!tables.includes(normalizedTable)) {
    throw new ApiError(404, "Table not found");
  }

  const columns = await listColumnsForTables([normalizedTable]);
  const columnNames = columns.map((column) => column.column_name);
  const hasCompanyId = columnNames.includes("company_id");
  const hasCreatedAt = columnNames.includes("created_at");
  const hasId = columnNames.includes("id");

  const sanitizedLimit = parseLimit(limit);
  const params = [];
  const where = [];

  if (companyId && hasCompanyId) {
    params.push(companyId);
    where.push(`company_id = $${params.length}`);
  }

  params.push(sanitizedLimit);

  const quotedTableName = quoteIdentifier(normalizedTable);
  const orderByColumn = hasCreatedAt ? "created_at" : hasId ? "id" : null;

  let sql = `SELECT * FROM ${quotedTableName}`;
  if (where.length) {
    sql += ` WHERE ${where.join(" AND ")}`;
  }

  if (orderByColumn) {
    sql += ` ORDER BY ${quoteIdentifier(orderByColumn)} DESC NULLS LAST`;
  }

  sql += ` LIMIT $${params.length}`;

  const { rows } = await query(sql, params);

  return {
    tableName: normalizedTable,
    columns: columns.map((column) => ({
      name: column.column_name,
      dataType: column.data_type,
      nullable: column.is_nullable === "YES",
      defaultValue: column.column_default,
    })),
    hasCompanyScope: hasCompanyId,
    rows: rows.map((row) => sanitizeRow(row)),
    rowCount: rows.length,
    limit: sanitizedLimit,
  };
};

module.exports = {
  buildSchemaMap,
  getOverview,
  getCompanySnapshot,
  getTablePreview,
};

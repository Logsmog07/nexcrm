const { query } = require("../config/db");
const ApiError = require("../utils/ApiError");

const FORBIDDEN_QUERY_TOKENS = [
  "drop",
  "delete",
  "update",
  "insert",
  "truncate",
  "alter",
  "grant",
  "revoke",
];

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const quoteIdentifier = (value) => `"${String(value || "").replaceAll('"', '""')}"`;

const maskSensitiveRow = (row) => {
  const masked = { ...row };

  for (const key of Object.keys(masked)) {
    const normalized = String(key || "").toLowerCase();
    if (normalized === "password_hash" || normalized === "password") {
      masked[key] = "••••••••";
    }
  }

  return masked;
};

const getPublicTables = async () => {
  const { rows } = await query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `
  );

  return rows.map((row) => row.table_name);
};

const getColumnsForTable = async (tableName) => {
  const { rows } = await query(
    `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `,
    [tableName]
  );

  return rows;
};

const getTableCount = async (tableName) => {
  const { rows } = await query(
    `SELECT COUNT(*)::bigint AS count FROM ${quoteIdentifier(tableName)}`
  );
  return Number(rows[0]?.count || 0);
};

const listTablesWithCounts = async () => {
  const tables = await getPublicTables();

  const entries = await Promise.all(
    tables.map(async (tableName) => ({
      tableName,
      rowCount: await getTableCount(tableName),
    }))
  );

  return entries;
};

const getTableData = async ({ tableName, page, limit, search, companyId }) => {
  const normalizedTable = String(tableName || "").trim().toLowerCase();
  const tableExists = (await getPublicTables()).includes(normalizedTable);
  if (!tableExists) {
    throw new ApiError(404, "Table not found");
  }

  const currentPage = toPositiveInt(page, 1);
  const perPage = Math.min(toPositiveInt(limit, 25), 100);
  const offset = (currentPage - 1) * perPage;

  const columns = await getColumnsForTable(normalizedTable);
  const textColumns = columns
    .filter((column) => {
      const type = String(column.data_type || "").toLowerCase();
      return type.includes("char") || type === "text" || type === "citext";
    })
    .map((column) => column.column_name);

  const params = [];
  const where = [];

  const normalizedSearch = String(search || "").trim();
  if (normalizedSearch && textColumns.length) {
    params.push(`%${normalizedSearch}%`);
    const searchParam = `$${params.length}`;
    where.push(
      `(${textColumns
        .map((column) => `${quoteIdentifier(column)}::text ILIKE ${searchParam}`)
        .join(" OR ")})`
    );
  }

  const hasCompanyId = columns.some((column) => column.column_name === "company_id");
  const normalizedCompanyId = String(companyId || "").trim();
  if (hasCompanyId && normalizedCompanyId) {
    params.push(normalizedCompanyId);
    where.push(`${quoteIdentifier("company_id")}::text = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countSql = `
    SELECT COUNT(*)::bigint AS total
    FROM ${quoteIdentifier(normalizedTable)}
    ${whereClause}
  `;

  const countResult = await query(countSql, params);
  const total = Number(countResult.rows[0]?.total || 0);

  const hasCreatedAt = columns.some((column) => column.column_name === "created_at");
  const hasId = columns.some((column) => column.column_name === "id");

  let orderClause = "";
  if (hasCreatedAt) {
    orderClause = `ORDER BY ${quoteIdentifier("created_at")} DESC NULLS LAST`;
  } else if (hasId) {
    orderClause = `ORDER BY ${quoteIdentifier("id")} DESC NULLS LAST`;
  }

  params.push(perPage, offset);
  const limitParam = `$${params.length - 1}`;
  const offsetParam = `$${params.length}`;

  const dataSql = `
    SELECT *
    FROM ${quoteIdentifier(normalizedTable)}
    ${whereClause}
    ${orderClause}
    LIMIT ${limitParam}
    OFFSET ${offsetParam}
  `;

  const dataResult = await query(dataSql, params);

  return {
    tableName: normalizedTable,
    page: currentPage,
    limit: perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
    columns: columns.map((column) => ({
      name: column.column_name,
      dataType: column.data_type,
      isNullable: column.is_nullable === "YES",
      defaultValue: column.column_default,
    })),
    rows: dataResult.rows.map(maskSensitiveRow),
  };
};

const getSchema = async () => {
  const { rows } = await query(
    `
      SELECT
        c.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default,
        EXISTS (
          SELECT 1
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY'
            AND tc.table_schema = c.table_schema
            AND tc.table_name = c.table_name
            AND kcu.column_name = c.column_name
        ) AS is_primary_key,
        EXISTS (
          SELECT 1
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = c.table_schema
            AND tc.table_name = c.table_name
            AND kcu.column_name = c.column_name
        ) AS is_foreign_key
      FROM information_schema.columns
      c
      WHERE c.table_schema = 'public'
      ORDER BY c.table_name, c.ordinal_position
    `
  );

  return rows;
};

const getRelations = async () => {
  const { rows } = await query(
    `
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.column_name
    `
  );

  return rows;
};

const getLatestRecordTimestamp = async ({ tableName, hasCreatedAt }) => {
  if (!hasCreatedAt) {
    return null;
  }

  const { rows } = await query(
    `
      SELECT created_at
      FROM ${quoteIdentifier(tableName)}
      ORDER BY created_at DESC NULLS LAST
      LIMIT 1
    `
  );

  return rows[0]?.created_at || null;
};

const getCompanyBreakdownForTable = async ({ tableName, hasCompanyId }) => {
  if (!hasCompanyId) {
    return [];
  }

  const { rows } = await query(
    `
      SELECT company_id, COUNT(*)::bigint AS count
      FROM ${quoteIdentifier(tableName)}
      WHERE company_id IS NOT NULL
      GROUP BY company_id
      ORDER BY count DESC
    `
  );

  return rows.map((row) => ({
    companyId: row.company_id,
    count: Number(row.count || 0),
  }));
};

const getStats = async () => {
  const tables = await getPublicTables();

  const tableStats = await Promise.all(
    tables.map(async (tableName) => {
      const [rowCount, columns] = await Promise.all([
        getTableCount(tableName),
        getColumnsForTable(tableName),
      ]);

      const hasCreatedAt = columns.some((column) => column.column_name === "created_at");
      const hasCompanyId = columns.some((column) => column.column_name === "company_id");

      const [latestRecordCreatedAt, companyBreakdown] = await Promise.all([
        getLatestRecordTimestamp({ tableName, hasCreatedAt }),
        getCompanyBreakdownForTable({ tableName, hasCompanyId }),
      ]);

      return {
        tableName,
        rowCount,
        latestRecordCreatedAt,
        companyBreakdown,
      };
    })
  );

  const totalRows = tableStats.reduce((accumulator, item) => accumulator + item.rowCount, 0);

  const { rows: dbRows } = await query(
    `
      SELECT
        pg_database_size(current_database())::bigint AS size_bytes,
        pg_size_pretty(pg_database_size(current_database())) AS size_pretty
    `
  );

  return {
    totalRows,
    databaseSize: {
      bytes: Number(dbRows[0]?.size_bytes || 0),
      pretty: dbRows[0]?.size_pretty || "0 bytes",
    },
    tables: tableStats,
  };
};

const getCompaniesBreakdown = async () => {
  const { rows } = await query(
    `
      SELECT
        c.id,
        c.name,
        c.created_at,
        (SELECT COUNT(*)::bigint FROM users u WHERE u.company_id = c.id) AS users_count,
        (SELECT COUNT(*)::bigint FROM leads l WHERE l.company_id = c.id) AS leads_count,
        (SELECT COUNT(*)::bigint FROM customers cu WHERE cu.company_id = c.id) AS customers_count,
        (SELECT COUNT(*)::bigint FROM deals d WHERE d.company_id = c.id) AS deals_count,
        (SELECT COUNT(*)::bigint FROM activities a WHERE a.company_id = c.id) AS activities_count
      FROM companies c
      ORDER BY c.created_at DESC
    `
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    usersCount: Number(row.users_count || 0),
    leadsCount: Number(row.leads_count || 0),
    customersCount: Number(row.customers_count || 0),
    dealsCount: Number(row.deals_count || 0),
    activitiesCount: Number(row.activities_count || 0),
  }));
};

const listSignedUpUsers = async ({ search, isActive, companyId }) => {
  const where = [];
  const params = [];

  const normalizedSearch = String(search || "").trim();
  if (normalizedSearch) {
    params.push(`%${normalizedSearch}%`);
    const searchParam = `$${params.length}`;
    where.push(`(
      u.email::text ILIKE ${searchParam}
      OR u.full_name ILIKE ${searchParam}
      OR COALESCE(c.name, '') ILIKE ${searchParam}
    )`);
  }

  const normalizedIsActive = String(isActive || "").trim().toLowerCase();
  if (normalizedIsActive === "true" || normalizedIsActive === "false") {
    params.push(normalizedIsActive === "true");
    where.push(`u.is_active = $${params.length}`);
  }

  const normalizedCompanyId = String(companyId || "").trim();
  if (normalizedCompanyId) {
    params.push(normalizedCompanyId);
    where.push(`u.company_id::text = $${params.length}`);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { rows } = await query(
    `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.avatar_url,
        u.is_active,
        u.created_at,
        u.updated_at,
        u.platform_role::text AS platform_role,
        u.company_role::text AS company_role,
        u.role::text AS legacy_role,
        u.company_id,
        c.name AS company_name,
        u.manager_id,
        manager.email AS manager_email
      FROM users u
      LEFT JOIN companies c ON c.id = u.company_id
      LEFT JOIN users manager ON manager.id = u.manager_id
      ${whereClause}
      ORDER BY u.created_at DESC, u.id DESC
      LIMIT 1000
    `,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    platformRole: row.platform_role || null,
    companyRole: row.company_role || null,
    legacyRole: row.legacy_role || null,
    effectiveRole: row.platform_role || row.company_role || row.legacy_role || null,
    companyId: row.company_id || null,
    companyName: row.company_name || null,
    managerId: row.manager_id || null,
    managerEmail: row.manager_email || null,
  }));
};

const normalizeQuery = (rawQuery) => String(rawQuery || "").trim().replace(/;+\s*$/, "");

const validateReadOnlyQuery = (rawQuery) => {
  const normalized = normalizeQuery(rawQuery);
  if (!normalized) {
    throw new ApiError(400, "Query is required");
  }

  if (!/^select\b/i.test(normalized)) {
    throw new ApiError(400, "Only SELECT statements are allowed");
  }

  if (normalized.includes(";")) {
    throw new ApiError(400, "Only one statement is allowed");
  }

  const lowered = normalized.toLowerCase();
  for (const token of FORBIDDEN_QUERY_TOKENS) {
    const matcher = new RegExp(`\\b${token}\\b`, "i");
    if (matcher.test(lowered)) {
      throw new ApiError(400, `Forbidden keyword detected: ${token.toUpperCase()}`);
    }
  }

  return normalized;
};

const runReadOnlyQuery = async (rawQuery) => {
  const normalized = validateReadOnlyQuery(rawQuery);
  const startedAt = Date.now();

  const result = await query(
    `SELECT * FROM (${normalized}) AS dev_console_query LIMIT 100`
  );

  const durationMs = Date.now() - startedAt;

  return {
    query: normalized,
    durationMs,
    columns: result.fields.map((field) => field.name),
    rowCount: result.rows.length,
    rows: result.rows.map(maskSensitiveRow),
  };
};

module.exports = {
  listTablesWithCounts,
  getTableData,
  getSchema,
  getRelations,
  getStats,
  getCompaniesBreakdown,
  listSignedUpUsers,
  runReadOnlyQuery,
};

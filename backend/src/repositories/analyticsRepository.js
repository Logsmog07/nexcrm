const { query } = require("../config/db");

const buildScopedClause = (scope = {}, alias = "", options = {}) => {
  const conditions = [];
  const params = [];
  const prefix = alias ? `${alias}.` : "";
  const ownerColumn = options.ownerColumn || `${prefix}owner_id`;

  if (scope.companyId) {
    params.push(scope.companyId);
    conditions.push(`${prefix}company_id = $${params.length}`);
  }

  if (scope.ownerIds?.length) {
    params.push(scope.ownerIds);
    conditions.push(`${ownerColumn} = ANY($${params.length}::int[])`);
  } else if (scope.ownerId) {
    params.push(scope.ownerId);
    conditions.push(`${ownerColumn} = $${params.length}`);
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
};

const buildDealScope = (scope = {}, alias = "") =>
  buildScopedClause(scope, alias, { ownerColumn: `${alias ? `${alias}.` : ""}owner_id` });

const buildLeadScope = (scope = {}, alias = "") => {
  const prefix = alias ? `${alias}.` : "";
  const conditions = [];
  const params = [];

  if (scope.companyId) {
    params.push(scope.companyId);
    conditions.push(`${prefix}company_id = $${params.length}`);
  }

  if (scope.ownerIds?.length) {
    params.push(scope.ownerIds);
    conditions.push(
      `(${prefix}assigned_to = ANY($${params.length}::int[]) OR ${prefix}created_by = ANY($${params.length}::int[]))`
    );
  } else if (scope.ownerId) {
    params.push(scope.ownerId);
    conditions.push(`(${prefix}assigned_to = $${params.length} OR ${prefix}created_by = $${params.length})`);
  }

  return {
    clause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
};

const getKpis = async (scope = {}) => {
  const dealScope = buildDealScope(scope, "d");
  const leadScope = buildLeadScope(scope, "l");
  const customerScope = buildScopedClause(scope, "c");

  const { rows } = await query(`
    SELECT
      COALESCE(SUM(CASE WHEN d.status = 'won' THEN d.value ELSE 0 END), 0) AS revenue,
      COUNT(*) FILTER (WHERE d.status = 'open') AS open_deals,
      COUNT(*) FILTER (WHERE d.status = 'won') AS won_deals,
      COUNT(*)::int AS total_deals,
      COALESCE(AVG(NULLIF(d.value, 0)) FILTER (WHERE d.status = 'won'), 0) AS avg_won_deal_size,
      (SELECT COUNT(*) FROM leads l ${leadScope.clause} ${leadScope.clause ? "AND" : "WHERE"} l.status IN ('new', 'contacted', 'qualified')) AS active_leads,
      (SELECT COUNT(*) FROM leads l ${leadScope.clause}) AS total_leads,
      (SELECT COUNT(*) FROM leads l ${leadScope.clause} ${leadScope.clause ? "AND" : "WHERE"} l.status = 'qualified') AS qualified_leads,
      (SELECT COUNT(*) FROM customers c ${customerScope.clause}) AS total_customers,
      CASE
        WHEN (SELECT COUNT(*) FROM leads l ${leadScope.clause}) = 0 THEN 0
        ELSE ROUND(
          (
            (SELECT COUNT(*) FROM leads l ${leadScope.clause} ${leadScope.clause ? "AND" : "WHERE"} l.status = 'converted')::numeric /
            (SELECT COUNT(*) FROM leads l ${leadScope.clause})::numeric
          ) * 100,
          2
        )
      END AS conversion_rate
    FROM deals d
    ${dealScope.clause}
  `, dealScope.params.length ? dealScope.params : leadScope.params.length ? leadScope.params : customerScope.params);
  return rows[0];
};

const getLeadAging = async (scope = {}) => {
  const leadScope = buildLeadScope(scope);
  const { rows } = await query(`
    SELECT
      status AS label,
      ROUND(AVG(EXTRACT(EPOCH FROM (NOW() - created_at)) / 86400), 1) AS avg_days_open
    FROM leads
    ${leadScope.clause}
    ${leadScope.clause ? "AND" : "WHERE"} status IN ('new', 'contacted', 'qualified')
    GROUP BY status
    ORDER BY avg_days_open DESC
  `, leadScope.params);
  return rows;
};

const getUpcomingClosures = async (scope = {}) => {
  const dealScope = buildDealScope(scope, "d");
  const { rows } = await query(`
    SELECT
      d.id,
      d.title,
      d.stage,
      d.value,
      d.probability,
      d.expected_close_date,
      COALESCE(c.name, l.name) AS account_name
    FROM deals d
    LEFT JOIN customers c ON c.id = d.customer_id
    LEFT JOIN leads l ON l.id = d.lead_id
    ${dealScope.clause}
    ${dealScope.clause ? "AND" : "WHERE"} d.status = 'open'
      AND d.expected_close_date IS NOT NULL
    ORDER BY d.expected_close_date ASC, d.probability DESC
    LIMIT 5
  `, dealScope.params);
  return rows;
};

const getRevenueTrend = async (scope = {}) => {
  const dealScope = buildDealScope(scope);
  const { rows } = await query(`
    SELECT
      TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS period,
      COALESCE(SUM(CASE WHEN status = 'won' THEN value ELSE 0 END), 0) AS revenue
    FROM deals
    ${dealScope.clause}
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY DATE_TRUNC('month', created_at)
  `, dealScope.params);
  return rows;
};

const getLeadStatusDistribution = async (scope = {}) => {
  const leadScope = buildLeadScope(scope);
  const { rows } = await query(`
    SELECT status AS label, COUNT(*)::int AS value
    FROM leads
    ${leadScope.clause}
    GROUP BY status
    ORDER BY value DESC
  `, leadScope.params);
  return rows;
};

const getSalesPerformance = async (scope = {}) => {
  const params = [];
  const conditions = [];

  if (scope.companyId) {
    params.push(scope.companyId);
    conditions.push(`u.company_id = $${params.length}`);
  }

  if (scope.ownerIds?.length) {
    params.push(scope.ownerIds);
    conditions.push(`u.id = ANY($${params.length}::int[])`);
  } else if (scope.ownerId) {
    params.push(scope.ownerId);
    conditions.push(`u.id = $${params.length}`);
  }

  const userClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await query(`
    SELECT
      u.id,
      u.full_name AS rep_name,
      COUNT(d.id)::int AS total_deals,
      COALESCE(SUM(CASE WHEN d.status = 'won' THEN d.value ELSE 0 END), 0) AS revenue,
      ROUND(AVG(CASE WHEN d.probability IS NULL THEN 0 ELSE d.probability END), 2) AS avg_probability
    FROM users u
    LEFT JOIN deals d ON d.owner_id = u.id
    ${userClause}
    GROUP BY u.id, u.full_name
    ORDER BY revenue DESC, total_deals DESC
  `, params);
  return rows;
};

const getDropoffAnalysis = async (scope = {}) => {
  const dealScope = buildDealScope(scope);
  const { rows } = await query(`
    SELECT
      stage AS label,
      COUNT(*)::int AS total,
      COALESCE(SUM(value), 0) AS pipeline_value
    FROM deals
    ${dealScope.clause}
    GROUP BY stage
    ORDER BY total DESC
  `, dealScope.params);
  return rows;
};

const getRecentActivity = async (scope = {}) => {
  const activityScope = buildScopedClause(scope, "a", {
    ownerColumn: "a.user_id",
  });
  const { rows } = await query(`
    SELECT
      a.id,
      a.type,
      a.subject,
      a.created_at,
      u.full_name AS user_name
    FROM activities a
    LEFT JOIN users u ON u.id = a.user_id
    ${activityScope.clause}
    ORDER BY a.created_at DESC
    LIMIT 10
  `, activityScope.params);
  return rows;
};

module.exports = {
  getKpis,
  getRevenueTrend,
  getLeadStatusDistribution,
  getSalesPerformance,
  getDropoffAnalysis,
  getRecentActivity,
  getLeadAging,
  getUpcomingClosures,
};

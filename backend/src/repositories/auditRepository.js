const { query } = require("../config/db");

const create = async ({
  action,
  entityType,
  entityId,
  actorUserId,
  companyId,
  outcome,
  ipAddress,
  userAgent,
  metadata,
}) => {
  const { rows } = await query(
    `
      INSERT INTO audit_logs (
        action,
        entity_type,
        entity_id,
        actor_user_id,
        company_id,
        outcome,
        ip_address,
        user_agent,
        metadata
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      RETURNING *
    `,
    [
      action,
      entityType,
      entityId || null,
      actorUserId || null,
      companyId || null,
      outcome || "success",
      ipAddress || null,
      userAgent || null,
      metadata || {},
    ]
  );

  return rows[0] || null;
};

const buildListConditions = ({ companyId, action, entityType, outcome, actorUserId, from, to }) => {
  const conditions = [];
  const params = [];

  if (companyId) {
    params.push(companyId);
    conditions.push(`al.company_id = $${params.length}`);
  }

  if (action) {
    params.push(action);
    conditions.push(`al.action = $${params.length}`);
  }

  if (entityType) {
    params.push(entityType);
    conditions.push(`al.entity_type = $${params.length}`);
  }

  if (outcome) {
    params.push(outcome);
    conditions.push(`al.outcome = $${params.length}`);
  }

  if (actorUserId) {
    params.push(actorUserId);
    conditions.push(`al.actor_user_id = $${params.length}`);
  }

  if (from) {
    params.push(from);
    conditions.push(`al.created_at >= $${params.length}`);
  }

  if (to) {
    params.push(to);
    conditions.push(`al.created_at <= $${params.length}`);
  }

  return {
    whereClause: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
};

const list = async ({
  page = 1,
  pageSize = 25,
  companyId,
  action,
  entityType,
  outcome,
  actorUserId,
  from,
  to,
}) => {
  const offset = (page - 1) * pageSize;
  const { whereClause, params } = buildListConditions({
    companyId,
    action,
    entityType,
    outcome,
    actorUserId,
    from,
    to,
  });

  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM audit_logs al ${whereClause}`,
    params
  );

  const dataParams = [...params, pageSize, offset];
  const { rows } = await query(
    `
      SELECT
        al.*,
        u.full_name AS actor_name,
        u.email AS actor_email
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.actor_user_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${dataParams.length - 1}
      OFFSET $${dataParams.length}
    `,
    dataParams
  );

  return {
    total: countResult.rows[0]?.total || 0,
    rows,
  };
};

const listForExport = async ({
  limit = 1000,
  companyId,
  action,
  entityType,
  outcome,
  actorUserId,
  from,
  to,
}) => {
  const { whereClause, params } = buildListConditions({
    companyId,
    action,
    entityType,
    outcome,
    actorUserId,
    from,
    to,
  });

  const dataParams = [...params, limit];
  const { rows } = await query(
    `
      SELECT
        al.*,
        u.full_name AS actor_name,
        u.email AS actor_email
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.actor_user_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${dataParams.length}
    `,
    dataParams
  );

  return {
    rows,
  };
};

module.exports = {
  create,
  list,
  listForExport,
};

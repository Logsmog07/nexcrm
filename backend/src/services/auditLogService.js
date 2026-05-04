const ApiError = require("../utils/ApiError");
const auditRepository = require("../repositories/auditRepository");
const { isCompanyAdmin, isPlatformAdmin } = require("../utils/access");

const parsePositiveInt = (value, fallback, { min = 1, max = 200 } = {}) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  if (parsed < min) {
    return min;
  }

  if (parsed > max) {
    return max;
  }

  return parsed;
};

const parseDate = (value, fieldName) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, `${fieldName} must be a valid datetime`);
  }

  return date.toISOString();
};

const normalizeFilter = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const parseOptionalInt = (value, fieldName) => {
  const normalized = normalizeFilter(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new ApiError(400, `${fieldName} must be a positive integer`);
  }

  return parsed;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  throw new ApiError(400, "compress must be a boolean");
};

const parseExportFormat = (value) => {
  const normalized = normalizeFilter(value);
  if (!normalized) {
    return "csv";
  }

  const lowered = normalized.toLowerCase();
  if (lowered !== "csv" && lowered !== "json") {
    throw new ApiError(400, "format must be one of: csv, json");
  }

  return lowered;
};

const parseScopedFilters = (query, actor) => {
  const platformAdmin = isPlatformAdmin(actor);
  const companyAdmin = isCompanyAdmin(actor);

  if (!platformAdmin && !companyAdmin) {
    throw new ApiError(403, "You do not have permission to view audit logs");
  }

  const companyIdFilter = parseOptionalInt(query.companyId, "companyId");

  if (companyAdmin && companyIdFilter && String(companyIdFilter) !== String(actor.company_id)) {
    throw new ApiError(403, "Company admins can only access logs for their own company");
  }

  const scopedCompanyId = platformAdmin ? companyIdFilter : actor.company_id;

  const from = parseDate(query.from, "from");
  const to = parseDate(query.to, "to");

  if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
    throw new ApiError(400, "from must be earlier than or equal to to");
  }

  return {
    companyId: scopedCompanyId,
    action: normalizeFilter(query.action),
    entityType: normalizeFilter(query.entityType),
    outcome: normalizeFilter(query.outcome),
    actorUserId: parseOptionalInt(query.actorUserId, "actorUserId"),
    from,
    to,
  };
};

const listAuditLogs = async (query, actor) => {
  const page = parsePositiveInt(query.page, 1, { min: 1, max: 100000 });
  const pageSize = parsePositiveInt(query.pageSize, 25, { min: 1, max: 200 });
  const filters = parseScopedFilters(query, actor);

  let result;
  try {
    result = await auditRepository.list({
      page,
      pageSize,
      ...filters,
    });
  } catch (error) {
    if (error?.code === "42P01") {
      throw new ApiError(
        503,
        "Audit log storage is not initialized. Apply migration 005_audit_logs.sql."
      );
    }

    throw error;
  }

  return {
    data: result.rows,
    pagination: {
      page,
      pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
    },
  };
};

const listAuditLogsForExport = async (query, actor) => {
  const exportLimit = parsePositiveInt(query.exportLimit, 1000, { min: 1, max: 5000 });
  const format = parseExportFormat(query.format);
  const compress = parseBoolean(query.compress, false);

  if (compress && format !== "csv") {
    throw new ApiError(400, "compress is supported only when format=csv");
  }

  const filters = parseScopedFilters(query, actor);

  try {
    const result = await auditRepository.listForExport({
      limit: exportLimit,
      ...filters,
    });

    return {
      data: result.rows,
      exportLimit,
      format,
      compress,
    };
  } catch (error) {
    if (error?.code === "42P01") {
      throw new ApiError(
        503,
        "Audit log storage is not initialized. Apply migration 005_audit_logs.sql."
      );
    }

    throw error;
  }
};

module.exports = {
  listAuditLogs,
  listAuditLogsForExport,
};

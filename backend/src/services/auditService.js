const auditRepository = require("../repositories/auditRepository");

let warnedTableMissing = false;

const buildRequestContext = (req) => ({
  ipAddress:
    req?.headers?.["x-forwarded-for"]?.split(",")?.[0]?.trim() ||
    req?.ip ||
    req?.socket?.remoteAddress ||
    null,
  userAgent: req?.headers?.["user-agent"] || null,
});

const safeMetadata = (metadata) => {
  if (!metadata || typeof metadata !== "object") {
    return {};
  }

  const json = JSON.stringify(metadata);
  if (json.length <= 4000) {
    return metadata;
  }

  return {
    truncated: true,
    preview: json.slice(0, 3800),
  };
};

const recordEvent = async ({
  action,
  entityType,
  entityId,
  actorUserId,
  companyId,
  outcome = "success",
  ipAddress,
  userAgent,
  metadata,
}) => {
  if (!action || !entityType) {
    return;
  }

  try {
    await auditRepository.create({
      action,
      entityType,
      entityId,
      actorUserId,
      companyId,
      outcome,
      ipAddress,
      userAgent,
      metadata: safeMetadata(metadata),
    });
  } catch (error) {
    if (error?.code === "42P01") {
      if (!warnedTableMissing) {
        warnedTableMissing = true;
        console.warn("Audit log table not found. Run DB migrations to enable audit logging.");
      }
      return;
    }

    console.warn("Audit logging failed", error.message || error);
  }
};

module.exports = {
  buildRequestContext,
  recordEvent,
};

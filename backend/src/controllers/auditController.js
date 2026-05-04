const catchAsync = require("../utils/catchAsync");
const zlib = require("zlib");
const auditLogService = require("../services/auditLogService");

const CSV_COLUMNS = [
  ["id", "id"],
  ["action", "action"],
  ["entity_type", "entity_type"],
  ["entity_id", "entity_id"],
  ["outcome", "outcome"],
  ["actor_user_id", "actor_user_id"],
  ["actor_name", "actor_name"],
  ["actor_email", "actor_email"],
  ["company_id", "company_id"],
  ["ip_address", "ip_address"],
  ["user_agent", "user_agent"],
  ["metadata", "metadata"],
  ["created_at", "created_at"],
];

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return "";
  }

  const normalized =
    typeof value === "object" ? JSON.stringify(value) : String(value).replace(/\r?\n/g, " ");

  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
};

const buildCsv = (rows) => {
  const header = CSV_COLUMNS.map(([columnName]) => columnName).join(",");
  const lines = rows.map((row) =>
    CSV_COLUMNS.map(([, rowKey]) => escapeCsvValue(row[rowKey])).join(",")
  );

  return [header, ...lines].join("\n");
};

const listAuditLogs = catchAsync(async (req, res) => {
  const result = await auditLogService.listAuditLogs(req.query, req.user);
  res.json({
    success: true,
    data: result.data,
    pagination: result.pagination,
  });
});

const exportAuditLogsCsv = catchAsync(async (req, res) => {
  const result = await auditLogService.listAuditLogsForExport(req.query, req.user);
  const dateStamp = new Date().toISOString().slice(0, 10);

  if (result.format === "json") {
    const filename = `audit-logs-${dateStamp}.json`;
    const payload = JSON.stringify(
      {
        exported_at: new Date().toISOString(),
        export_limit: result.exportLimit,
        count: Array.isArray(result.data) ? result.data.length : 0,
        data: result.data || [],
      },
      null,
      2
    );

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
    res.setHeader("X-Audit-Export-Format", "json");
    res.setHeader("X-Audit-Export-Limit", String(result.exportLimit));
    res.status(200).send(payload);
    return;
  }

  const csv = buildCsv(result.data || []);
  const filename = result.compress ? `audit-logs-${dateStamp}.csv.gz` : `audit-logs-${dateStamp}.csv`;

  res.setHeader(
    "Content-Type",
    result.compress ? "application/gzip" : "text/csv; charset=utf-8"
  );
  res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
  res.setHeader("X-Audit-Export-Format", result.compress ? "csv-gzip" : "csv");
  res.setHeader("X-Audit-Export-Limit", String(result.exportLimit));

  if (result.compress) {
    const zipped = zlib.gzipSync(Buffer.from(csv, "utf8"));
    res.status(200).send(zipped);
    return;
  }

  res.status(200).send(csv);
});

module.exports = {
  listAuditLogs,
  exportAuditLogsCsv,
};

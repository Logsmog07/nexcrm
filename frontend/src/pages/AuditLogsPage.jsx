import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import crmApi from "../api/crmApi";
import { AppShell } from "../components/layout/AppShell";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { LoadingState } from "../components/common/LoadingState";
import { EmptyState } from "../components/common/EmptyState";
import { DataTable } from "../components/tables/DataTable";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { formatDateTime } from "../lib/formatters";

const ACTION_LABELS = {
  "auth.login": "Sign in",
  "auth.signup": "Sign up",
  "auth.impersonate": "Account access",
  "company.create": "Company created",
  "company.update": "Company updated",
  "company.status.update": "Company status updated",
  "company.delete": "Company deleted",
  "user.create": "User created",
  "user.status.update": "User status updated",
  "user.password.reset": "User password reset",
  "user.reassign": "User reassigned",
  "settings.update": "Preferences updated",
};

const ENTITY_LABELS = {
  session: "Session",
  user: "User",
  company: "Company",
};

const SETTINGS_KEY_LABELS = {
  startRoute: "Start page",
  pipelineView: "Pipeline view",
  analyticsWindow: "Analytics window",
  leadsSort: "Lead sort order",
  forecastReviewCadence: "Forecast review cadence",
  followUpSlaDays: "Follow-up SLA",
  leadResponseSlaHours: "Lead response SLA",
  leadEscalationHours: "Lead escalation SLA",
  managerWeeklyDigest: "Manager weekly digest",
  compactSidebar: "Compact sidebar",
  timezone: "Timezone",
  weekStartsOn: "Week start day",
  emailDigest: "Email digest",
  desktopAlerts: "Desktop alerts",
  dealAlerts: "Deal alerts",
  activityAlerts: "Activity alerts",
};

const toSentenceCase = (value) => {
  const normalized = String(value || "")
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getActionLabel = (value) => ACTION_LABELS[value] || toSentenceCase(value);
const getEntityLabel = (value) => ENTITY_LABELS[value] || toSentenceCase(value);

const formatSettingKey = (value) => SETTINGS_KEY_LABELS[value] || toSentenceCase(value);

const normalizeUpdatedKeys = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
};

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  ...Object.keys(ACTION_LABELS).map((value) => ({
    value,
    label: getActionLabel(value),
  })),
];

const ENTITY_OPTIONS = [
  { value: "", label: "All entities" },
  { value: "session", label: "Session" },
  { value: "user", label: "User" },
  { value: "company", label: "Company" },
];

const OUTCOME_OPTIONS = [
  { value: "", label: "All outcomes" },
  { value: "success", label: "Success" },
  { value: "failure", label: "Failure" },
];

const defaultFilters = {
  action: "",
  entityType: "",
  outcome: "",
  actorUserId: "",
  from: "",
  to: "",
};

const EXPORT_LIMIT = 5000;

const EXPORT_OPTIONS = [
  { value: "csv", label: "CSV (.csv)" },
  { value: "csv-gzip", label: "CSV gzip (.csv.gz)" },
  { value: "json", label: "JSON (.json)" },
];

const buildParams = (filters, page, pageSize) => {
  const params = {
    page,
    pageSize,
  };

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params[key] = value;
    }
  });

  return params;
};

const formatMetadata = (value) => {
  if (!value || typeof value !== "object") {
    return "-";
  }

  const updatedKeys = normalizeUpdatedKeys(value.updatedKeys);
  if (updatedKeys.length) {
    const friendlyKeys = updatedKeys.map(formatSettingKey);
    if (friendlyKeys.length <= 4) {
      return `Updated: ${friendlyKeys.join(", ")}`;
    }

    return `Updated: ${friendlyKeys.slice(0, 4).join(", ")} +${friendlyKeys.length - 4} more`;
  }

  if (value.email) {
    return `Email: ${String(value.email)}`;
  }

  if (value.reason) {
    return `Reason: ${String(value.reason)}`;
  }

  const entries = Object.entries(value).filter(([, item]) => item !== null && item !== undefined);
  if (!entries.length) {
    return "-";
  }

  return entries
    .slice(0, 2)
    .map(([key, item]) => `${toSentenceCase(key)}: ${String(item)}`)
    .join(" | ");
};

const parseFileNameFromDisposition = (headerValue) => {
  if (!headerValue || typeof headerValue !== "string") {
    return null;
  }

  const utf8Match = headerValue.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const asciiMatch = headerValue.match(/filename="?([^";]+)"?/i);
  return asciiMatch?.[1] || null;
};

export function AuditLogsPage() {
  const user = useSelector((state) => state.auth.user);
  const [filters, setFilters] = useState(defaultFilters);
  const [auditRows, setAuditRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState("");
  const [exportFormat, setExportFormat] = useState("csv");
  const [error, setError] = useState("");

  const loadLogs = async ({ page = pagination.page, resetPage = false } = {}) => {
    const targetPage = resetPage ? 1 : page;

    setLoading(true);
    setError("");

    try {
      const response = await crmApi.listAuditLogs(
        buildParams(filters, targetPage, pagination.pageSize)
      );
      setAuditRows(response.data || []);
      setPagination((current) => ({
        ...current,
        ...(response.pagination || {}),
        page: response.pagination?.page || targetPage,
      }));
    } catch (requestError) {
      setError(requestError.message || "Unable to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs({ resetPage: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const downloadBlobResponse = (response, fallbackName) => {
    const dispositionHeader = response.headers?.["content-disposition"];
    const filename = parseFileNameFromDisposition(dispositionHeader) || fallbackName;
    const blob =
      response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: "application/octet-stream" });

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  };

  const runExport = async ({ type, fallbackName, request }) => {
    setExporting(type);
    setError("");

    try {
      const response = await request();
      downloadBlobResponse(response, fallbackName);
    } catch (requestError) {
      setError(requestError.message || "Unable to export audit logs");
    } finally {
      setExporting("");
    }
  };

  const handleExport = async () => {
    const dateStamp = new Date().toISOString().slice(0, 10);
    const params = buildParams({ ...filters, exportLimit: EXPORT_LIMIT }, 1, pagination.pageSize);

    if (exportFormat === "json") {
      await runExport({
        type: "json",
        fallbackName: `audit-logs-${dateStamp}.json`,
        request: () => crmApi.downloadAuditLogsJson(params),
      });
      return;
    }

    if (exportFormat === "csv-gzip") {
      await runExport({
        type: "csv-gzip",
        fallbackName: `audit-logs-${dateStamp}.csv.gz`,
        request: () => crmApi.downloadAuditLogsCsvGzip(params),
      });
      return;
    }

    await runExport({
      type: "csv",
      fallbackName: `audit-logs-${dateStamp}.csv`,
      request: () => crmApi.downloadAuditLogsCsv(params),
    });
  };

  const stats = useMemo(() => {
    const success = auditRows.filter((row) => row.outcome === "success").length;
    const failure = auditRows.filter((row) => row.outcome === "failure").length;
    const uniqueActors = new Set(
      auditRows.map((row) => row.actor_user_id).filter((id) => id !== null && id !== undefined)
    ).size;

    return {
      success,
      failure,
      uniqueActors,
    };
  }, [auditRows]);

  const subtitle =
    user?.role === "platform_admin"
      ? "Platform-wide immutable-style trail for authentication and administrative actions."
      : "Company-scoped operational trail for sensitive authentication and management events.";

  return (
    <AppShell title="Audit Logs" subtitle={subtitle}>
      <ErrorBanner message={error} />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Current page events</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{auditRows.length}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Successful operations</div>
          <div className="mt-2 text-2xl font-semibold text-emerald-400">{stats.success}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Failed operations</div>
          <div className="mt-2 text-2xl font-semibold text-rose-400">{stats.failure}</div>
        </Card>
      </div>

      <Card className="mt-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Action
            </span>
            <Select
              value={filters.action}
              onChange={(event) =>
                setFilters((current) => ({ ...current, action: event.target.value }))
              }
            >
              {ACTION_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Entity
            </span>
            <Select
              value={filters.entityType}
              onChange={(event) =>
                setFilters((current) => ({ ...current, entityType: event.target.value }))
              }
            >
              {ENTITY_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Outcome
            </span>
            <Select
              value={filters.outcome}
              onChange={(event) =>
                setFilters((current) => ({ ...current, outcome: event.target.value }))
              }
            >
              {OUTCOME_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Actor user ID
            </span>
            <Input
              value={filters.actorUserId}
              onChange={(event) =>
                setFilters((current) => ({ ...current, actorUserId: event.target.value }))
              }
              placeholder="e.g. 12"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              From
            </span>
            <Input
              type="datetime-local"
              value={filters.from}
              onChange={(event) =>
                setFilters((current) => ({ ...current, from: event.target.value }))
              }
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              To
            </span>
            <Input
              type="datetime-local"
              value={filters.to}
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => loadLogs({ resetPage: true })}>
            Apply filters
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setFilters(defaultFilters);
              setTimeout(() => loadLogs({ page: 1, resetPage: true }), 0);
            }}
          >
            Reset
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={handleExport}
            disabled={loading || Boolean(exporting)}
          >
            {exporting
              ? `Exporting ${exporting === "csv-gzip" ? "CSV.gz" : exporting.toUpperCase()}...`
              : "Export"}
          </Button>
          <label className="block min-w-[190px]">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
              Export format
            </span>
            <Select
              value={exportFormat}
              onChange={(event) => setExportFormat(event.target.value)}
              disabled={Boolean(exporting)}
            >
              {EXPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <p className="mt-3 text-xs text-[var(--text-muted)]">
          Export includes up to {EXPORT_LIMIT.toLocaleString()} most recent events for the active filters.
        </p>
      </Card>

      <div className="mt-5">
        {loading ? (
          <LoadingState label="Loading audit events..." />
        ) : auditRows.length ? (
          <>
            <DataTable
              rowKey="id"
              rows={auditRows}
              columns={[
                {
                  key: "action",
                  label: "Action",
                  render: (row) => (
                    <span className="font-semibold text-[var(--text-primary)]">{getActionLabel(row.action)}</span>
                  ),
                },
                {
                  key: "entity_type",
                  label: "Entity",
                  render: (row) => (
                    <div>
                      <div className="text-sm text-[var(--text-primary)]">{getEntityLabel(row.entity_type)}</div>
                      <div className="text-xs text-[var(--text-secondary)]">#{row.entity_id || "-"}</div>
                    </div>
                  ),
                },
                {
                  key: "outcome",
                  label: "Outcome",
                  render: (row) => (
                    <Badge tone={row.outcome === "success" ? "success" : "danger"}>
                      {row.outcome === "success" ? "Success" : "Failure"}
                    </Badge>
                  ),
                },
                {
                  key: "actor_name",
                  label: "Actor",
                  render: (row) => (
                    <div>
                      <div className="text-sm text-[var(--text-primary)]">{row.actor_name || "System"}</div>
                      <div className="text-xs text-[var(--text-secondary)]">{row.actor_email || "-"}</div>
                    </div>
                  ),
                },
                {
                  key: "metadata",
                  label: "Metadata",
                  render: (row) => (
                    <span className="text-xs text-[var(--text-secondary)]">{formatMetadata(row.metadata)}</span>
                  ),
                },
                {
                  key: "created_at",
                  label: "Timestamp",
                  render: (row) => (
                    <span className="text-xs text-[var(--text-secondary)]">{formatDateTime(row.created_at)}</span>
                  ),
                },
              ]}
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm">
              <div className="text-[var(--text-secondary)]">
                Page {pagination.page} of {pagination.totalPages} · {pagination.total} total events · {stats.uniqueActors} actors on current page
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page <= 1 || loading}
                  onClick={() => loadLogs({ page: pagination.page - 1 })}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages || loading}
                  onClick={() => loadLogs({ page: pagination.page + 1 })}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title="No audit events matched"
            description="Try broadening your filters or generating an authentication/admin action first."
          />
        )}
      </div>
    </AppShell>
  );
}

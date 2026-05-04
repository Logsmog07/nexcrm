import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-hot-toast";
import crmApi from "../api/crmApi";
import { AppShell } from "../components/layout/AppShell";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { useNavigate } from "../hooks/useNavigate";
import {
  canManageUsers,
  getRoleLabel,
  isCompanyAdmin,
  isPlatformAdmin,
} from "../lib/roles";
import {
  ANALYTICS_WINDOW_OPTIONS,
  buildPagePreferenceDefaults,
  DEFAULT_APP_SETTINGS,
  FORECAST_REVIEW_CADENCE_OPTIONS,
  FOLLOW_UP_SLA_OPTIONS,
  LEAD_ESCALATION_OPTIONS,
  LEAD_RESPONSE_SLA_OPTIONS,
  LEADS_SORT_OPTIONS,
  PIPELINE_VIEW_OPTIONS,
  START_ROUTE_OPTIONS,
  loadAppSettings,
  saveAppSettings,
} from "../lib/settings";
import {
  logout,
  setNotifications,
  toggleSidebarCollapsed,
  toggleTheme,
} from "../store";

const EXPORT_LIMIT = 5000;

const EXPORT_OPTIONS = [
  { value: "csv", label: "CSV (.csv)" },
  { value: "csv-gzip", label: "CSV gzip (.csv.gz)" },
  { value: "json", label: "JSON (.json)" },
];

const AUDIT_TIME_WINDOWS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last 12 months" },
];

const WEEK_OPTIONS = [
  { value: "monday", label: "Monday" },
  { value: "sunday", label: "Sunday" },
];

const TIMEZONE_OPTIONS = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
];

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

const getFromDateIso = (days) => {
  const parsedDays = Number(days);
  if (!Number.isFinite(parsedDays) || parsedDays <= 0) {
    return undefined;
  }

  return new Date(Date.now() - parsedDays * 24 * 60 * 60 * 1000).toISOString();
};

const validatePasswordStrength = (password) => {
  if (String(password || "").length < 8) {
    return "Password must be at least 8 characters";
  }

  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include at least one uppercase letter and one number";
  }

  return "";
};

function SettingsToggle({ label, description, checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 text-left transition hover:border-[var(--accent)]/30 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{description}</p>
        </div>
        <span
          className={`inline-flex h-6 w-11 items-center rounded-full transition ${
            checked ? "bg-[var(--accent)]" : "bg-[var(--border-strong)]"
          }`}
        >
          <span
            className={`h-4 w-4 rounded-full bg-white shadow transition ${
              checked ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </span>
      </div>
    </button>
  );
}

export function SettingsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const { notifications, users } = useSelector((state) => state.crm);
  const { theme, sidebarCollapsed } = useSelector((state) => state.ui);

  const [error, setError] = useState("");
  const [preferences, setPreferences] = useState(() => loadAppSettings());
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [syncingPreferences, setSyncingPreferences] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [exporting, setExporting] = useState("");
  const [exportFormat, setExportFormat] = useState("csv");
  const [auditWindow, setAuditWindow] = useState("30");
  const [targetUserId, setTargetUserId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);

  const unreadCount = notifications.filter((item) => !item.is_read).length;
  const canOpenAudit = isPlatformAdmin(user) || isCompanyAdmin(user);
  const canResetPasswords = isPlatformAdmin(user) || isCompanyAdmin(user);

  const manageableUsers = useMemo(() => {
    if (!canResetPasswords) {
      return [];
    }

    if (isPlatformAdmin(user)) {
      return users.filter((item) => item.role !== "platform_admin");
    }

    return users.filter(
      (item) =>
        String(item.company_id || "") === String(user?.company_id || "") &&
        item.company_role !== "company_admin"
    );
  }, [canResetPasswords, user, users]);

  const updatePreference = (key, value) => {
    setPreferences((current) => ({ ...current, [key]: value }));
  };

  const syncSidebarPreference = (nextPreferences) => {
    if (Boolean(nextPreferences.compactSidebar) !== Boolean(sidebarCollapsed)) {
      dispatch(toggleSidebarCollapsed());
    }
  };

  useEffect(() => {
    let active = true;

    const loadRemoteSettings = async () => {
      if (!user?.id) {
        return;
      }

      setSyncingPreferences(true);
      try {
        const response = await crmApi.getMySettings();
        if (!active) {
          return;
        }

        const normalized = saveAppSettings(response.data || {});
        setPreferences(normalized);
        syncSidebarPreference(normalized);
      } catch (requestError) {
        if (active) {
          setError((current) => current || requestError.message || "Unable to sync settings");
        }
      } finally {
        if (active) {
          setSyncingPreferences(false);
        }
      }
    };

    loadRemoteSettings();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleSavePreferences = async () => {
    setError("");
    setSavingPreferences(true);

    try {
      const normalized = saveAppSettings(preferences);
      setPreferences(normalized);
      syncSidebarPreference(normalized);

      const response = await crmApi.updateMySettings(normalized);
      if (response?.data) {
        const synced = saveAppSettings(response.data);
        setPreferences(synced);
        syncSidebarPreference(synced);
      }

      toast.success("Workspace preferences saved");
    } catch (saveError) {
      setError(saveError.message || "Unable to save workspace preferences");
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleResetPreferences = async () => {
    setError("");
    setSavingPreferences(true);
    try {
      const normalized = saveAppSettings(DEFAULT_APP_SETTINGS);
      setPreferences(normalized);
      syncSidebarPreference(normalized);

      const response = await crmApi.updateMySettings(normalized);
      if (response?.data) {
        const synced = saveAppSettings(response.data);
        setPreferences(synced);
        syncSidebarPreference(synced);
      }

      toast.success("Preferences reset to default");
    } catch (requestError) {
      setError(requestError.message || "Unable to reset preferences");
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleResetPagePreferences = async () => {
    setError("");
    setSavingPreferences(true);

    try {
      const normalized = saveAppSettings(buildPagePreferenceDefaults(preferences));
      setPreferences(normalized);

      const response = await crmApi.updateMySettings(normalized);
      if (response?.data) {
        const synced = saveAppSettings(response.data);
        setPreferences(synced);
      }

      toast.success("Page defaults reset");
    } catch (requestError) {
      setError(requestError.message || "Unable to reset page defaults");
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications
      .filter((notification) => !notification.is_read)
      .map((notification) => notification.id);

    if (!unreadIds.length || markingAllRead) {
      return;
    }

    const previousNotifications = notifications;
    setError("");
    setMarkingAllRead(true);

    dispatch(setNotifications(notifications.map((item) => ({ ...item, is_read: true }))));

    try {
      await Promise.all(unreadIds.map((id) => crmApi.markNotificationRead(id)));
      toast.success("All notifications marked as read");
    } catch (requestError) {
      dispatch(setNotifications(previousNotifications));
      setError(requestError.message || "Unable to update notifications");
    } finally {
      setMarkingAllRead(false);
    }
  };

  const handleAuditExport = async () => {
    if (exporting || !canOpenAudit) {
      return;
    }

    const dateStamp = new Date().toISOString().slice(0, 10);
    const params = {
      exportLimit: EXPORT_LIMIT,
      from: getFromDateIso(auditWindow),
    };

    setError("");
    setExporting(exportFormat);

    try {
      if (exportFormat === "json") {
        const response = await crmApi.downloadAuditLogsJson(params);
        downloadBlobResponse(response, `audit-logs-${dateStamp}.json`);
      } else if (exportFormat === "csv-gzip") {
        const response = await crmApi.downloadAuditLogsCsvGzip(params);
        downloadBlobResponse(response, `audit-logs-${dateStamp}.csv.gz`);
      } else {
        const response = await crmApi.downloadAuditLogsCsv(params);
        downloadBlobResponse(response, `audit-logs-${dateStamp}.csv`);
      }

      toast.success("Audit export downloaded");
    } catch (requestError) {
      setError(requestError.message || "Unable to export audit logs");
    } finally {
      setExporting("");
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();

    if (!canResetPasswords) {
      return;
    }

    const validationError = validatePasswordStrength(newPassword);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!targetUserId) {
      setError("Select a user before resetting password");
      return;
    }

    setResettingPassword(true);
    setError("");

    try {
      await crmApi.resetUserPassword(targetUserId, newPassword);
      setNewPassword("");
      setTargetUserId("");
      toast.success("Password reset completed");
    } catch (requestError) {
      setError(requestError.message || "Unable to reset password");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleLogoutCurrentDevice = () => {
    dispatch(logout());
    navigate("/login");
  };

  return (
    <AppShell
      title="Settings"
      subtitle="Manage workspace preferences, notification behavior, and security controls."
    >
      <ErrorBanner message={error} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Signed in as</div>
          <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {user?.full_name || "Workspace user"}
          </div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">{user?.email || "No email"}</div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Role</div>
          <div className="mt-2">
            <Badge tone={isPlatformAdmin(user) ? "danger" : "info"}>{getRoleLabel(user)}</Badge>
          </div>
          <div className="mt-2 text-sm text-[var(--text-secondary)]">
            {isPlatformAdmin(user)
              ? "Global platform scope"
              : canManageUsers(user)
              ? "Team-level management enabled"
              : "Standard workspace access"}
          </div>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Theme</div>
          <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
            {theme === "dark" ? "Dark mode" : "Light mode"}
          </div>
          <Button className="mt-3" variant="secondary" onClick={() => dispatch(toggleTheme())}>
            Switch theme
          </Button>
        </Card>
        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Unread alerts</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{unreadCount}</div>
          <Button
            className="mt-3"
            variant="secondary"
            disabled={!unreadCount || markingAllRead}
            onClick={handleMarkAllRead}
          >
            {markingAllRead ? "Updating..." : "Mark all read"}
          </Button>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">
                Workspace preferences
              </div>
              <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
                Personal defaults and behavior
              </h2>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Default start page
              </span>
              <Select
                value={preferences.startRoute}
                onChange={(event) => updatePreference("startRoute", event.target.value)}
              >
                {START_ROUTE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Timezone
              </span>
              <Select
                value={preferences.timezone}
                onChange={(event) => updatePreference("timezone", event.target.value)}
              >
                {TIMEZONE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Pipeline default view
              </span>
              <Select
                value={preferences.pipelineView}
                onChange={(event) => updatePreference("pipelineView", event.target.value)}
              >
                {PIPELINE_VIEW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Analytics default range
              </span>
              <Select
                value={preferences.analyticsWindow}
                onChange={(event) => updatePreference("analyticsWindow", event.target.value)}
              >
                {ANALYTICS_WINDOW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Leads default sort
              </span>
              <Select
                value={preferences.leadsSort}
                onChange={(event) => updatePreference("leadsSort", event.target.value)}
              >
                {LEADS_SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Forecast review cadence
              </span>
              <Select
                value={preferences.forecastReviewCadence}
                onChange={(event) => updatePreference("forecastReviewCadence", event.target.value)}
              >
                {FORECAST_REVIEW_CADENCE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Follow-up SLA window
              </span>
              <Select
                value={String(preferences.followUpSlaDays)}
                onChange={(event) => updatePreference("followUpSlaDays", Number(event.target.value))}
              >
                {FOLLOW_UP_SLA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Lead response SLA
              </span>
              <Select
                value={String(preferences.leadResponseSlaHours)}
                onChange={(event) => updatePreference("leadResponseSlaHours", Number(event.target.value))}
              >
                {LEAD_RESPONSE_SLA_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Lead escalation window
              </span>
              <Select
                value={String(preferences.leadEscalationHours)}
                onChange={(event) => updatePreference("leadEscalationHours", Number(event.target.value))}
              >
                {LEAD_ESCALATION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Week starts on
              </span>
              <Select
                value={preferences.weekStartsOn}
                onChange={(event) => updatePreference("weekStartsOn", event.target.value)}
              >
                {WEEK_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)]">
                Workspace role
              </span>
              <Input value={getRoleLabel(user)} readOnly />
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <SettingsToggle
              label="Compact sidebar"
              description="Shrink navigation width for denser page layout."
              checked={Boolean(preferences.compactSidebar)}
              onChange={(value) => updatePreference("compactSidebar", value)}
            />
            <SettingsToggle
              label="Email digest"
              description="Receive a daily workspace digest summary."
              checked={Boolean(preferences.emailDigest)}
              onChange={(value) => updatePreference("emailDigest", value)}
            />
            <SettingsToggle
              label="Deal stage alerts"
              description="Prioritize pipeline change notifications in-app."
              checked={Boolean(preferences.dealAlerts)}
              onChange={(value) => updatePreference("dealAlerts", value)}
            />
            <SettingsToggle
              label="Activity due alerts"
              description="Highlight reminders when follow-ups are due."
              checked={Boolean(preferences.activityAlerts)}
              onChange={(value) => updatePreference("activityAlerts", value)}
            />
            <SettingsToggle
              label="Desktop alerts"
              description="Enable browser popups for urgent notifications."
              checked={Boolean(preferences.desktopAlerts)}
              onChange={(value) => updatePreference("desktopAlerts", value)}
            />
            <SettingsToggle
              label="Manager weekly digest"
              description="Enable weekly digest export mode for manager-level reporting."
              checked={Boolean(preferences.managerWeeklyDigest)}
              onChange={(value) => updatePreference("managerWeeklyDigest", value)}
            />
          </div>

          <div className="mt-5 border-t border-[var(--border-soft)] pt-5">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)]">
              Preference actions
            </div>

            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                <div className="text-sm font-semibold text-[var(--text-primary)]">Save current preferences</div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Applies all current values in this section and syncs them to your account.
                </p>
                <Button
                  type="button"
                  className="mt-3 w-full"
                  onClick={handleSavePreferences}
                  disabled={savingPreferences}
                >
                  {savingPreferences ? "Saving..." : "Save preferences"}
                </Button>
              </div>

              <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                <div className="text-sm font-semibold text-[var(--text-primary)]">Reset page defaults</div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Resets page behavior only: start page, pipeline view, analytics range, and leads sort.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={handleResetPagePreferences}
                  disabled={savingPreferences}
                >
                  Reset page defaults
                </Button>
              </div>

              <div className="rounded-2xl border border-rose-400/35 bg-rose-500/10 p-4">
                <div className="text-sm font-semibold text-[var(--text-primary)]">Reset all defaults</div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Restores every preference in this section to default values.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3 w-full border-rose-300/50"
                  onClick={handleResetPreferences}
                  disabled={savingPreferences}
                >
                  Reset defaults
                </Button>
              </div>
            </div>

            {syncingPreferences ? (
              <span className="mt-3 inline-flex items-center text-xs text-[var(--text-secondary)]">
                Syncing settings...
              </span>
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Quick actions</div>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">Operational shortcuts</h2>

          <div className="mt-4 space-y-3">
            <Button type="button" className="w-full" variant="secondary" onClick={() => navigate("/activities")}>
              Open activities board
            </Button>
            {canManageUsers(user) ? (
              <Button type="button" className="w-full" variant="secondary" onClick={() => navigate("/team")}>
                Manage team users
              </Button>
            ) : null}
            {canOpenAudit ? (
              <Button type="button" className="w-full" variant="secondary" onClick={() => navigate("/audit")}>
                Open audit logs
              </Button>
            ) : null}
          </div>

          <div className="mt-6 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
            <div className="text-sm font-semibold text-[var(--text-primary)]">Audit export</div>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Download up to {EXPORT_LIMIT.toLocaleString()} audit records for compliance snapshots.
            </p>

            <div className="mt-3 grid gap-3">
              <Select
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value)}
                disabled={!canOpenAudit || Boolean(exporting)}
              >
                {EXPORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select
                value={auditWindow}
                onChange={(event) => setAuditWindow(event.target.value)}
                disabled={!canOpenAudit || Boolean(exporting)}
              >
                {AUDIT_TIME_WINDOWS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                disabled={!canOpenAudit || Boolean(exporting)}
                onClick={handleAuditExport}
              >
                {exporting ? "Exporting..." : "Export audit snapshot"}
              </Button>
            </div>
            {!canOpenAudit ? (
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                Audit exports are available to company admins and platform admins.
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Security</div>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">Session controls</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            End your current authenticated session on this device when needed.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="button" variant="danger" onClick={handleLogoutCurrentDevice}>
              Logout this device
            </Button>
          </div>
        </Card>

        <Card>
          <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Admin tools</div>
          <h2 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">User password reset</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Reset credentials for workspace users from settings.
          </p>

          {canResetPasswords ? (
            <form className="mt-4 grid gap-3" onSubmit={handleResetPassword}>
              <Select value={targetUserId} onChange={(event) => setTargetUserId(event.target.value)}>
                <option value="">Select user</option>
                {manageableUsers.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name} ({item.email})
                  </option>
                ))}
              </Select>
              <Input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
              <p className="text-xs text-[var(--text-secondary)]">
                Must contain at least 8 characters, one uppercase letter, and one number.
              </p>
              <Button type="submit" disabled={resettingPassword}>
                {resettingPassword ? "Resetting..." : "Reset password"}
              </Button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-[var(--text-secondary)]">
              Password reset is restricted to company admins and platform admins.
            </p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

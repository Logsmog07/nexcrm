export const SETTINGS_STORAGE_KEY = "crm_settings_v1";

export const START_ROUTE_OPTIONS = [
  { value: "/dashboard", label: "Dashboard" },
  { value: "/leads", label: "Leads" },
  { value: "/customers", label: "Customers" },
  { value: "/pipeline", label: "Pipeline" },
  { value: "/activities", label: "Activities" },
  { value: "/analytics", label: "Analytics" },
  { value: "/reports", label: "Reports" },
];

export const PIPELINE_VIEW_OPTIONS = [
  { value: "list", label: "List" },
  { value: "board", label: "Board" },
];

export const ANALYTICS_WINDOW_OPTIONS = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "12m", label: "12M" },
];

export const LEADS_SORT_OPTIONS = [
  { value: "updated_desc", label: "Recently updated" },
  { value: "value_desc", label: "Highest value" },
  { value: "name_asc", label: "Name A-Z" },
];

export const FORECAST_REVIEW_CADENCE_OPTIONS = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

export const FOLLOW_UP_SLA_OPTIONS = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 21, label: "21 days" },
  { value: 30, label: "30 days" },
];

export const LEAD_RESPONSE_SLA_OPTIONS = [
  { value: 4, label: "4 hours" },
  { value: 8, label: "8 hours" },
  { value: 12, label: "12 hours" },
  { value: 24, label: "24 hours" },
  { value: 48, label: "48 hours" },
];

export const LEAD_ESCALATION_OPTIONS = [
  { value: 24, label: "24 hours" },
  { value: 48, label: "48 hours" },
  { value: 72, label: "72 hours" },
  { value: 96, label: "96 hours" },
];

const DEFAULT_TIMEZONE =
  typeof Intl !== "undefined"
    ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
    : "UTC";

export const DEFAULT_APP_SETTINGS = {
  startRoute: "/dashboard",
  pipelineView: "list",
  analyticsWindow: "6m",
  leadsSort: "updated_desc",
  forecastReviewCadence: "weekly",
  followUpSlaDays: 14,
  leadResponseSlaHours: 24,
  leadEscalationHours: 48,
  managerWeeklyDigest: false,
  compactSidebar: false,
  timezone: DEFAULT_TIMEZONE,
  weekStartsOn: "monday",
  emailDigest: false,
  desktopAlerts: false,
  dealAlerts: true,
  activityAlerts: true,
};

export const PAGE_PREFERENCE_KEYS = [
  "startRoute",
  "pipelineView",
  "analyticsWindow",
  "leadsSort",
];

const normalizePipelineView = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "board" ? "board" : "list";
};

const normalizeAnalyticsWindow = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["1m", "3m", "6m", "12m"].includes(normalized)) {
    return normalized;
  }
  return DEFAULT_APP_SETTINGS.analyticsWindow;
};

const normalizeLeadsSort = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["updated_desc", "value_desc", "name_asc"].includes(normalized)) {
    return normalized;
  }
  return DEFAULT_APP_SETTINGS.leadsSort;
};

const normalizeForecastReviewCadence = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (["weekly", "biweekly", "monthly"].includes(normalized)) {
    return normalized;
  }
  return DEFAULT_APP_SETTINGS.forecastReviewCadence;
};

const normalizeFollowUpSlaDays = (value) => {
  const parsed = Number(value);
  if ([7, 14, 21, 30].includes(parsed)) {
    return parsed;
  }
  return DEFAULT_APP_SETTINGS.followUpSlaDays;
};

const normalizeLeadResponseSlaHours = (value) => {
  const parsed = Number(value);
  if ([4, 8, 12, 24, 48].includes(parsed)) {
    return parsed;
  }
  return DEFAULT_APP_SETTINGS.leadResponseSlaHours;
};

const normalizeLeadEscalationHours = (value) => {
  const parsed = Number(value);
  if ([24, 48, 72, 96].includes(parsed)) {
    return parsed;
  }
  return DEFAULT_APP_SETTINGS.leadEscalationHours;
};

const toBoolean = (value, fallback) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  return fallback;
};

const normalizeStartRoute = (value) => {
  const fallback = DEFAULT_APP_SETTINGS.startRoute;
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith("/")) {
    return fallback;
  }

  const allowed = START_ROUTE_OPTIONS.some((option) => option.value === trimmed);
  return allowed ? trimmed : fallback;
};

const normalizeTimezone = (value) => {
  if (typeof value !== "string") {
    return DEFAULT_APP_SETTINGS.timezone;
  }

  const trimmed = value.trim();
  return trimmed || DEFAULT_APP_SETTINGS.timezone;
};

const normalizeWeekStartsOn = (value) => {
  return value === "sunday" ? "sunday" : "monday";
};

export const normalizeAppSettings = (input) => {
  const payload = input && typeof input === "object" ? input : {};

  return {
    ...DEFAULT_APP_SETTINGS,
    startRoute: normalizeStartRoute(payload.startRoute),
    pipelineView: normalizePipelineView(payload.pipelineView),
    analyticsWindow: normalizeAnalyticsWindow(payload.analyticsWindow),
    leadsSort: normalizeLeadsSort(payload.leadsSort),
    forecastReviewCadence: normalizeForecastReviewCadence(payload.forecastReviewCadence),
    followUpSlaDays: normalizeFollowUpSlaDays(payload.followUpSlaDays),
    leadResponseSlaHours: normalizeLeadResponseSlaHours(payload.leadResponseSlaHours),
    leadEscalationHours: normalizeLeadEscalationHours(payload.leadEscalationHours),
    managerWeeklyDigest: toBoolean(
      payload.managerWeeklyDigest,
      DEFAULT_APP_SETTINGS.managerWeeklyDigest
    ),
    compactSidebar: toBoolean(payload.compactSidebar, DEFAULT_APP_SETTINGS.compactSidebar),
    timezone: normalizeTimezone(payload.timezone),
    weekStartsOn: normalizeWeekStartsOn(payload.weekStartsOn),
    emailDigest: toBoolean(payload.emailDigest, DEFAULT_APP_SETTINGS.emailDigest),
    desktopAlerts: toBoolean(payload.desktopAlerts, DEFAULT_APP_SETTINGS.desktopAlerts),
    dealAlerts: toBoolean(payload.dealAlerts, DEFAULT_APP_SETTINGS.dealAlerts),
    activityAlerts: toBoolean(payload.activityAlerts, DEFAULT_APP_SETTINGS.activityAlerts),
  };
};

export const loadAppSettings = () => {
  if (typeof window === "undefined") {
    return { ...DEFAULT_APP_SETTINGS };
  }

  const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
  if (!raw) {
    return { ...DEFAULT_APP_SETTINGS };
  }

  try {
    const parsed = JSON.parse(raw);
    return normalizeAppSettings(parsed);
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
};

export const saveAppSettings = (input) => {
  const normalized = normalizeAppSettings(input);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
};

export const buildPagePreferenceDefaults = (currentSettings = {}) => {
  const normalized = normalizeAppSettings(currentSettings);

  return {
    ...normalized,
    startRoute: DEFAULT_APP_SETTINGS.startRoute,
    pipelineView: DEFAULT_APP_SETTINGS.pipelineView,
    analyticsWindow: DEFAULT_APP_SETTINGS.analyticsWindow,
    leadsSort: DEFAULT_APP_SETTINGS.leadsSort,
  };
};

export const getPreferredStartRoute = () => {
  return loadAppSettings().startRoute || DEFAULT_APP_SETTINGS.startRoute;
};
const ApiError = require("../utils/ApiError");
const settingsRepository = require("../repositories/settingsRepository");

const START_ROUTE_OPTIONS = new Set([
  "/dashboard",
  "/leads",
  "/customers",
  "/pipeline",
  "/activities",
  "/analytics",
  "/reports",
]);

const TIMEZONE_OPTIONS = new Set([
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Australia/Sydney",
]);

const DEFAULT_SETTINGS = {
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
  timezone: "UTC",
  weekStartsOn: "monday",
  emailDigest: false,
  desktopAlerts: false,
  dealAlerts: true,
  activityAlerts: true,
};

const normalizePipelineView = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "board" ? "board" : "list";
};

const normalizeAnalyticsWindow = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return ["1m", "3m", "6m", "12m"].includes(normalized)
    ? normalized
    : DEFAULT_SETTINGS.analyticsWindow;
};

const normalizeLeadsSort = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return ["updated_desc", "value_desc", "name_asc"].includes(normalized)
    ? normalized
    : DEFAULT_SETTINGS.leadsSort;
};

const normalizeForecastReviewCadence = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  return ["weekly", "biweekly", "monthly"].includes(normalized)
    ? normalized
    : DEFAULT_SETTINGS.forecastReviewCadence;
};

const normalizeFollowUpSlaDays = (value) => {
  const parsed = Number(value);
  return [7, 14, 21, 30].includes(parsed)
    ? parsed
    : DEFAULT_SETTINGS.followUpSlaDays;
};

const normalizeLeadResponseSlaHours = (value) => {
  const parsed = Number(value);
  return [4, 8, 12, 24, 48].includes(parsed)
    ? parsed
    : DEFAULT_SETTINGS.leadResponseSlaHours;
};

const normalizeLeadEscalationHours = (value) => {
  const parsed = Number(value);
  return [24, 48, 72, 96].includes(parsed)
    ? parsed
    : DEFAULT_SETTINGS.leadEscalationHours;
};

let warnedMissingTable = false;

const toBoolean = (value, fallback) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["1", "true", "yes", "on"].includes(normalized)) {
      return true;
    }

    if (["0", "false", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return fallback;
};

const normalizeStartRoute = (value) => {
  if (typeof value !== "string") {
    return DEFAULT_SETTINGS.startRoute;
  }

  const normalized = value.trim();
  if (!START_ROUTE_OPTIONS.has(normalized)) {
    return DEFAULT_SETTINGS.startRoute;
  }

  return normalized;
};

const normalizeTimezone = (value) => {
  if (typeof value !== "string") {
    return DEFAULT_SETTINGS.timezone;
  }

  const normalized = value.trim();
  if (!normalized) {
    return DEFAULT_SETTINGS.timezone;
  }

  if (TIMEZONE_OPTIONS.has(normalized)) {
    return normalized;
  }

  return DEFAULT_SETTINGS.timezone;
};

const normalizeWeekStartsOn = (value) => {
  return value === "sunday" ? "sunday" : "monday";
};

const normalizeSettings = (input) => {
  const payload = input && typeof input === "object" ? input : {};

  return {
    ...DEFAULT_SETTINGS,
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
      DEFAULT_SETTINGS.managerWeeklyDigest
    ),
    compactSidebar: toBoolean(payload.compactSidebar, DEFAULT_SETTINGS.compactSidebar),
    timezone: normalizeTimezone(payload.timezone),
    weekStartsOn: normalizeWeekStartsOn(payload.weekStartsOn),
    emailDigest: toBoolean(payload.emailDigest, DEFAULT_SETTINGS.emailDigest),
    desktopAlerts: toBoolean(payload.desktopAlerts, DEFAULT_SETTINGS.desktopAlerts),
    dealAlerts: toBoolean(payload.dealAlerts, DEFAULT_SETTINGS.dealAlerts),
    activityAlerts: toBoolean(payload.activityAlerts, DEFAULT_SETTINGS.activityAlerts),
  };
};

const withMissingTableFallback = async (executor) => {
  try {
    return await executor();
  } catch (error) {
    if (error?.code === "42P01") {
      if (!warnedMissingTable) {
        warnedMissingTable = true;
        console.warn(
          "User settings table not found. Run DB migration 007_user_settings.sql to enable settings sync."
        );
      }
      return null;
    }

    throw error;
  }
};

const getUserSettings = async (userId) => {
  if (!userId) {
    return { ...DEFAULT_SETTINGS };
  }

  const record = await withMissingTableFallback(() => settingsRepository.findByUserId(userId));
  if (!record) {
    return { ...DEFAULT_SETTINGS };
  }

  return normalizeSettings(record.settings);
};

const updateUserSettings = async (userId, payload) => {
  if (!userId) {
    throw new ApiError(400, "A valid user session is required");
  }

  if (!payload || typeof payload !== "object") {
    throw new ApiError(400, "settings payload must be an object");
  }

  const normalized = normalizeSettings(payload);
  const record = await withMissingTableFallback(() =>
    settingsRepository.upsertByUserId(userId, normalized)
  );

  if (!record) {
    return normalized;
  }

  return normalizeSettings(record.settings);
};

module.exports = {
  DEFAULT_SETTINGS,
  normalizeSettings,
  getUserSettings,
  updateUserSettings,
};
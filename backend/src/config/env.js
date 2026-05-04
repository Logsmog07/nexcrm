const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
};

const parseClientUrls = (value) =>
  String(value || "http://localhost:5174,http://127.0.0.1:5174")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const defaultJwtSecret = "replace-this-in-production";
const configuredJwtSecret = process.env.JWT_SECRET || (isProduction ? "" : defaultJwtSecret);

if (
  isProduction &&
  (!configuredJwtSecret ||
    configuredJwtSecret === defaultJwtSecret ||
    configuredJwtSecret.length < 32)
) {
  throw new Error(
    "JWT_SECRET must be explicitly set with a strong value in production"
  );
}

const clientUrls = parseClientUrls(
  process.env.CLIENT_URLS ||
    process.env.CLIENT_URL ||
    "http://localhost:5174,http://127.0.0.1:5174"
);

let devConsoleEnabled = parseBoolean(process.env.DEV_CONSOLE_ENABLED, true);
const devConsolePassword = String(process.env.DEV_CONSOLE_PASSWORD || "").trim();
const defaultDevJwtSecret = "replace-dev-console-jwt-secret";
const configuredDevJwtSecret =
  process.env.DEV_JWT_SECRET || (isProduction ? "" : defaultDevJwtSecret);

if (devConsoleEnabled && !devConsolePassword) {
  devConsoleEnabled = false;
  console.warn(
    "Dev console is disabled because DEV_CONSOLE_PASSWORD is missing"
  );
}

if (
  devConsoleEnabled &&
  isProduction &&
  (!configuredDevJwtSecret ||
    configuredDevJwtSecret === defaultDevJwtSecret ||
    configuredDevJwtSecret.length < 32)
) {
  throw new Error(
    "DEV_JWT_SECRET must be explicitly set with a strong value in production when dev console is enabled"
  );
}

let developerPortalEnabled = parseBoolean(process.env.DEVELOPER_PORTAL_ENABLED, false);
const developerPortalEmail = String(process.env.DEVELOPER_PORTAL_EMAIL || "")
  .trim()
  .toLowerCase();
const developerPortalPassword = String(process.env.DEVELOPER_PORTAL_PASSWORD || "").trim();

if (developerPortalEnabled && (!developerPortalEmail || !developerPortalPassword)) {
  developerPortalEnabled = false;
  console.warn(
    "Developer portal is disabled because DEVELOPER_PORTAL_EMAIL or DEVELOPER_PORTAL_PASSWORD is missing"
  );
}

const env = {
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT || 3001),
  clientUrl: process.env.CLIENT_URL || clientUrls[0] || "http://localhost:5174",
  clientUrls,
  jwtSecret: configuredJwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  security: {
    jsonLimit: process.env.JSON_LIMIT || "1mb",
    authRateLimitWindowMs: parsePositiveInt(
      process.env.AUTH_RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000
    ),
    authRateLimitMax: parsePositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 20),
    apiRateLimitWindowMs: parsePositiveInt(
      process.env.API_RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000
    ),
    apiRateLimitMax: parsePositiveInt(process.env.API_RATE_LIMIT_MAX, 300),
    auditLogRetentionDays: parsePositiveInt(
      process.env.AUDIT_LOG_RETENTION_DAYS,
      365
    ),
  },
  db: {
    user: process.env.DB_USER || "postgres",
    host: process.env.DB_HOST || "localhost",
    database: process.env.DB_NAME || "crm_db",
    password: process.env.DB_PASSWORD || "Param@123",
    port: Number(process.env.DB_PORT || 5432),
    ssl:
      process.env.DB_SSL === "true"
        ? { rejectUnauthorized: false }
        : false,
  },
  developerPortal: {
    enabled: developerPortalEnabled,
    email: developerPortalEmail,
    password: developerPortalPassword,
    fullName: String(process.env.DEVELOPER_PORTAL_NAME || "Developer Console").trim(),
    defaultPreviewRows: parsePositiveInt(process.env.DEVELOPER_PORTAL_DEFAULT_PREVIEW_ROWS, 40),
    maxPreviewRows: parsePositiveInt(process.env.DEVELOPER_PORTAL_MAX_PREVIEW_ROWS, 200),
  },
  devConsole: {
    enabled: devConsoleEnabled,
    password: devConsolePassword,
    jwtSecret: configuredDevJwtSecret,
    jwtExpiresIn: process.env.DEV_JWT_EXPIRES_IN || "2h",
    authRateLimitWindowMs: parsePositiveInt(
      process.env.DEV_AUTH_RATE_LIMIT_WINDOW_MS,
      15 * 60 * 1000
    ),
    authRateLimitMax: parsePositiveInt(process.env.DEV_AUTH_RATE_LIMIT_MAX, 5),
  },
};

module.exports = env;

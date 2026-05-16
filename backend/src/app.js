const express = require("express");
const cors = require("cors");
const env = require("./config/env");
const routes = require("./routes");
const securityHeaders = require("./middleware/securityHeaders");
const { createRateLimiter } = require("./middleware/rateLimit");
const errorHandler = require("./middleware/errorHandler");
const notFound = require("./middleware/notFound");

const app = express();
app.disable("x-powered-by");

const localDevOrigins = [
  "http://localhost:5175",
  "http://127.0.0.1:5175",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const allowedOrigins = [...new Set([
  ...localDevOrigins,
  ...env.clientUrls,
  ...env.clientUrls.flatMap((origin) => {
    if (origin.includes("localhost")) {
      return [origin.replace("localhost", "127.0.0.1")];
    }

    if (origin.includes("127.0.0.1")) {
      return [origin.replace("127.0.0.1", "localhost")];
    }

    return [];
  }),
])];

const vercelPrefix = String(process.env.CORS_VERCEL_PREFIX || "")
  .trim()
  .toLowerCase();

function isAllowedVercelOrigin(origin) {
  if (!vercelPrefix) {
    return false;
  }

  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (!hostname.endsWith(".vercel.app")) {
      return false;
    }

    return hostname === `${vercelPrefix}.vercel.app` || hostname.startsWith(`${vercelPrefix}-`);
  } catch {
    return false;
  }
}

function isLocalDevelopmentOrigin(origin) {
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
      return true;
    }

    if (/^10\./.test(hostname)) {
      return true;
    }

    if (/^192\.168\./.test(hostname)) {
      return true;
    }

    const private172Match = hostname.match(/^172\.(1[6-9]|2\d|3[0-1])\./);
    return Boolean(private172Match);
  } catch {
    return false;
  }
}

const corsOptions = {
  origin(origin, callback) {
    if (
      !origin ||
      allowedOrigins.includes(origin) ||
      isAllowedVercelOrigin(origin) ||
      (!env.isProduction && isLocalDevelopmentOrigin(origin))
    ) {
      return callback(null, true);
    }

    // Deny the request without throwing, so we don't surface this as a 500.
    // The browser will still block the call due to missing CORS headers.
    return callback(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
});
app.use(securityHeaders);
app.use(express.json({ limit: env.security.jsonLimit }));
app.use(express.urlencoded({ extended: true, limit: env.security.jsonLimit }));

app.get("/health", (_req, res) => {
  res.json({
    success: true,
    message: "CRM backend is healthy",
    timestamp: new Date().toISOString(),
  });
});

app.use(
  "/api",
  createRateLimiter({
    windowMs: env.security.apiRateLimitWindowMs,
    max: env.security.apiRateLimitMax,
    keyPrefix: "api",
    message: "Too many API requests. Please retry shortly.",
  }),
  routes
);
app.use(notFound);
app.use(errorHandler);

module.exports = app;

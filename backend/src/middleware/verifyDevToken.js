const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const env = require("../config/env");

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
};

const logDevAccess = (req, outcome) => {
  const timestamp = new Date().toISOString();
  const ip = getClientIp(req);
  console.log(`[DEV_CONSOLE] ${timestamp} ip=${ip} ${outcome} ${req.method} ${req.originalUrl}`);
};

const verifyDevToken = (req, _res, next) => {
  if (!env.devConsole.enabled) {
    return next(new ApiError(404, "Dev console is disabled"));
  }

  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    logDevAccess(req, "DENIED_NO_TOKEN");
    return next(new ApiError(401, "Dev console token is required"));
  }

  try {
    const decoded = jwt.verify(token, env.devConsole.jwtSecret);
    if (decoded?.role !== "dev_console") {
      logDevAccess(req, "DENIED_BAD_ROLE");
      return next(new ApiError(403, "Invalid dev console role"));
    }

    req.devSession = {
      role: decoded.role,
      issuedAt: decoded.iat,
      expiresAt: decoded.exp,
    };

    logDevAccess(req, "ALLOW");
    return next();
  } catch (_error) {
    logDevAccess(req, "DENIED_INVALID_TOKEN");
    return next(new ApiError(401, "Invalid or expired dev console token"));
  }
};

module.exports = verifyDevToken;

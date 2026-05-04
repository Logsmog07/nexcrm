const crypto = require("crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const verifyDevToken = require("../middleware/verifyDevToken");
const { createRateLimiter } = require("../middleware/rateLimit");
const devConsoleService = require("../services/devConsoleService");
const env = require("../config/env");

const router = express.Router();

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
};

const logAuthAttempt = (req, outcome) => {
  const timestamp = new Date().toISOString();
  const ip = getClientIp(req);
  console.log(`[DEV_CONSOLE_AUTH] ${timestamp} ip=${ip} ${outcome}`);
};

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const devAuthRateLimiter = createRateLimiter({
  windowMs: env.devConsole.authRateLimitWindowMs,
  max: env.devConsole.authRateLimitMax,
  keyPrefix: "dev-auth",
  keyGenerator: (req) => getClientIp(req),
  message: "Too many dev console login attempts. Please wait before retrying.",
});

router.post("/auth", devAuthRateLimiter, (req, res, next) => {
  try {
    if (!env.devConsole.enabled) {
      throw new ApiError(404, "Dev console is disabled");
    }

    const accessKey = String(req.body?.accessKey || "").trim();
    if (!accessKey) {
      logAuthAttempt(req, "DENIED_EMPTY_KEY");
      throw new ApiError(400, "Master access key is required");
    }

    if (!safeEqual(accessKey, env.devConsole.password)) {
      logAuthAttempt(req, "DENIED_BAD_KEY");
      throw new ApiError(401, "ACCESS DENIED");
    }

    const token = jwt.sign(
      { role: "dev_console" },
      env.devConsole.jwtSecret,
      { expiresIn: env.devConsole.jwtExpiresIn }
    );

    logAuthAttempt(req, "ALLOW");
    res.json({
      success: true,
      token,
      expiresIn: env.devConsole.jwtExpiresIn,
      role: "dev_console",
    });
  } catch (error) {
    next(error);
  }
});

router.use(verifyDevToken);

router.get("/session", (req, res) => {
  res.json({
    success: true,
    session: req.devSession,
  });
});

router.get(
  "/tables",
  catchAsync(async (_req, res) => {
    const data = await devConsoleService.listTablesWithCounts();
    res.json({ success: true, data });
  })
);

router.get(
  "/table/:tableName",
  catchAsync(async (req, res) => {
    const data = await devConsoleService.getTableData({
      tableName: req.params.tableName,
      page: req.query.page,
      limit: req.query.limit,
      search: req.query.search,
      companyId: req.query.companyId,
    });

    res.json({ success: true, ...data });
  })
);

router.get(
  "/schema",
  catchAsync(async (_req, res) => {
    const data = await devConsoleService.getSchema();
    res.json({ success: true, data });
  })
);

router.get(
  "/relations",
  catchAsync(async (_req, res) => {
    const data = await devConsoleService.getRelations();
    res.json({ success: true, data });
  })
);

router.get(
  "/stats",
  catchAsync(async (_req, res) => {
    const data = await devConsoleService.getStats();
    res.json({ success: true, ...data });
  })
);

router.get(
  "/companies",
  catchAsync(async (_req, res) => {
    const data = await devConsoleService.getCompaniesBreakdown();
    res.json({ success: true, data });
  })
);

router.get(
  "/users",
  catchAsync(async (req, res) => {
    const data = await devConsoleService.listSignedUpUsers({
      search: req.query.search,
      isActive: req.query.isActive,
      companyId: req.query.companyId,
    });

    res.json({ success: true, data });
  })
);

router.post(
  "/query",
  catchAsync(async (req, res) => {
    const timestamp = new Date().toISOString();
    const ip = getClientIp(req);
    const queryText = String(req.body?.query || "").replace(/\s+/g, " ").slice(0, 240);
    console.log(`[DEV_CONSOLE_QUERY] ${timestamp} ip=${ip} query=${queryText}`);

    const data = await devConsoleService.runReadOnlyQuery(req.body?.query);
    res.json({ success: true, ...data });
  })
);

module.exports = router;

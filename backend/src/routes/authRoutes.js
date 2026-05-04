const express = require("express");
const authController = require("../controllers/authController");
const authenticate = require("../middleware/authenticate");
const authorize = require("../middleware/authorize");
const { PLATFORM_ROLES, COMPANY_ROLES } = require("../config/constants");
const env = require("../config/env");
const { createRateLimiter } = require("../middleware/rateLimit");

const router = express.Router();

const authRateLimiter = createRateLimiter({
  windowMs: env.security.authRateLimitWindowMs,
  max: env.security.authRateLimitMax,
  keyPrefix: "auth",
  keyGenerator: (req) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    return `${req.ip}:${email}`;
  },
  message: "Too many authentication attempts. Please wait before retrying.",
});

router.post("/signup", authRateLimiter, authController.signup);
router.post("/login", authRateLimiter, authController.login);
router.get("/me", authenticate, authController.me);
router.post(
  "/impersonate/:id",
  authenticate,
  authorize(PLATFORM_ROLES.PLATFORM_ADMIN, COMPANY_ROLES.COMPANY_ADMIN),
  authController.impersonate
);

module.exports = router;

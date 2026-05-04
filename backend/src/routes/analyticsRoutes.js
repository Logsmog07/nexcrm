const express = require("express");
const analyticsController = require("../controllers/analyticsController");
const authorize = require("../middleware/authorize");
const { PLATFORM_ROLES, COMPANY_ROLES } = require("../config/constants");

const router = express.Router();

router.get(
  "/dashboard",
  authorize(
    PLATFORM_ROLES.PLATFORM_ADMIN,
    COMPANY_ROLES.COMPANY_ADMIN,
    COMPANY_ROLES.MANAGER
  ),
  analyticsController.getDashboard
);

module.exports = router;

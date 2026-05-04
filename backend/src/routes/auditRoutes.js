const express = require("express");
const auditController = require("../controllers/auditController");
const authorize = require("../middleware/authorize");
const { PLATFORM_ROLES, COMPANY_ROLES } = require("../config/constants");

const router = express.Router();

router.get(
  "/logs/export",
  authorize(PLATFORM_ROLES.PLATFORM_ADMIN, COMPANY_ROLES.COMPANY_ADMIN),
  auditController.exportAuditLogsCsv
);

router.get(
  "/logs",
  authorize(PLATFORM_ROLES.PLATFORM_ADMIN, COMPANY_ROLES.COMPANY_ADMIN),
  auditController.listAuditLogs
);

module.exports = router;

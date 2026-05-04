const express = require("express");
const activityController = require("../controllers/activityController");
const authorize = require("../middleware/authorize");
const { PLATFORM_ROLES, COMPANY_ROLES } = require("../config/constants");

const router = express.Router();

router
  .route("/")
  .get(
    authorize(
      COMPANY_ROLES.COMPANY_ADMIN,
      COMPANY_ROLES.MANAGER,
      COMPANY_ROLES.SALES_REP
    ),
    activityController.listActivities
  )
  .post(
    authorize(
      COMPANY_ROLES.COMPANY_ADMIN,
      COMPANY_ROLES.MANAGER,
      COMPANY_ROLES.SALES_REP
    ),
    activityController.createActivity
  );

router.patch(
  "/:id/complete",
  authorize(
    COMPANY_ROLES.COMPANY_ADMIN,
    COMPANY_ROLES.MANAGER,
    COMPANY_ROLES.SALES_REP
  ),
  activityController.markActivityCompleted
);

module.exports = router;

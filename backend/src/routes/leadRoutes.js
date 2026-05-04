const express = require("express");
const leadController = require("../controllers/leadController");
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
    leadController.listLeads
  )
  .post(
    authorize(
      COMPANY_ROLES.COMPANY_ADMIN,
      COMPANY_ROLES.MANAGER,
      COMPANY_ROLES.SALES_REP
    ),
    leadController.createLead
  );

router.post(
  "/:id/convert",
  authorize(
    COMPANY_ROLES.COMPANY_ADMIN,
    COMPANY_ROLES.MANAGER,
    COMPANY_ROLES.SALES_REP
  ),
  leadController.convertLead
);

router
  .route("/:id")
  .get(
    authorize(
      COMPANY_ROLES.COMPANY_ADMIN,
      COMPANY_ROLES.MANAGER,
      COMPANY_ROLES.SALES_REP
    ),
    leadController.getLead
  )
  .put(
    authorize(
      COMPANY_ROLES.COMPANY_ADMIN,
      COMPANY_ROLES.MANAGER,
      COMPANY_ROLES.SALES_REP
    ),
    leadController.updateLead
  )
  .delete(
    authorize(
      COMPANY_ROLES.COMPANY_ADMIN,
      COMPANY_ROLES.MANAGER
    ),
    leadController.deleteLead
  );

module.exports = router;

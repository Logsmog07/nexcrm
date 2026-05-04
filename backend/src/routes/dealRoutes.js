const express = require("express");
const dealController = require("../controllers/dealController");
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
    dealController.listDeals
  )
  .post(
    authorize(
      COMPANY_ROLES.COMPANY_ADMIN,
      COMPANY_ROLES.MANAGER,
      COMPANY_ROLES.SALES_REP
    ),
    dealController.createDeal
  );

router.patch(
  "/:id/stage",
  authorize(
    COMPANY_ROLES.COMPANY_ADMIN,
    COMPANY_ROLES.MANAGER,
    COMPANY_ROLES.SALES_REP
  ),
  dealController.moveDeal
);

router
  .route("/:id")
  .get(
    authorize(
      COMPANY_ROLES.COMPANY_ADMIN,
      COMPANY_ROLES.MANAGER,
      COMPANY_ROLES.SALES_REP
    ),
    dealController.getDeal
  )
  .put(
    authorize(
      COMPANY_ROLES.COMPANY_ADMIN,
      COMPANY_ROLES.MANAGER,
      COMPANY_ROLES.SALES_REP
    ),
    dealController.updateDeal
  )
  .delete(
    authorize(
      COMPANY_ROLES.COMPANY_ADMIN,
      COMPANY_ROLES.MANAGER
    ),
    dealController.deleteDeal
  );

module.exports = router;

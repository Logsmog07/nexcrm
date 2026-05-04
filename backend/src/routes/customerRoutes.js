const express = require("express");
const customerController = require("../controllers/customerController");
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
    customerController.listCustomers
  )
  .post(
    authorize(
      COMPANY_ROLES.COMPANY_ADMIN,
      COMPANY_ROLES.MANAGER,
      COMPANY_ROLES.SALES_REP
    ),
    customerController.createCustomer
  );

router
  .route("/:id")
  .get(
    authorize(
      COMPANY_ROLES.COMPANY_ADMIN,
      COMPANY_ROLES.MANAGER,
      COMPANY_ROLES.SALES_REP
    ),
    customerController.getCustomer
  )
  .put(
    authorize(
      COMPANY_ROLES.COMPANY_ADMIN,
      COMPANY_ROLES.MANAGER,
      COMPANY_ROLES.SALES_REP
    ),
    customerController.updateCustomer
  )
  .delete(
    authorize(
      COMPANY_ROLES.COMPANY_ADMIN,
      COMPANY_ROLES.MANAGER
    ),
    customerController.deleteCustomer
  );

module.exports = router;

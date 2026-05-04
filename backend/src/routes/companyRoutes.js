const express = require("express");
const companyController = require("../controllers/companyController");
const authorize = require("../middleware/authorize");
const { PLATFORM_ROLES } = require("../config/constants");

const router = express.Router();

router
  .route("/")
  .get(authorize(PLATFORM_ROLES.PLATFORM_ADMIN), companyController.listCompanies)
  .post(authorize(PLATFORM_ROLES.PLATFORM_ADMIN), companyController.createCompany);

router
  .route("/:id")
  .put(authorize(PLATFORM_ROLES.PLATFORM_ADMIN), companyController.updateCompany)
  .delete(authorize(PLATFORM_ROLES.PLATFORM_ADMIN), companyController.deleteCompany);

router.patch(
  "/:id/status",
  authorize(PLATFORM_ROLES.PLATFORM_ADMIN),
  companyController.updateCompanyStatus
);

router.get(
  "/:id/overview",
  authorize(PLATFORM_ROLES.PLATFORM_ADMIN),
  companyController.getCompanyOverview
);

module.exports = router;

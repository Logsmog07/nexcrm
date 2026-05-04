const express = require("express");
const userController = require("../controllers/userController");
const authorize = require("../middleware/authorize");
const { PLATFORM_ROLES, COMPANY_ROLES } = require("../config/constants");

const router = express.Router();

router.get(
  "/",
  authorize(
    PLATFORM_ROLES.PLATFORM_ADMIN,
    COMPANY_ROLES.COMPANY_ADMIN,
    COMPANY_ROLES.MANAGER
  ),
  userController.listUsers
);

router.post(
  "/",
  authorize(PLATFORM_ROLES.PLATFORM_ADMIN, COMPANY_ROLES.COMPANY_ADMIN),
  userController.createUser
);

router.patch(
  "/:id/status",
  authorize(PLATFORM_ROLES.PLATFORM_ADMIN, COMPANY_ROLES.COMPANY_ADMIN),
  userController.updateUserStatus
);

router.patch(
  "/:id/password",
  authorize(PLATFORM_ROLES.PLATFORM_ADMIN, COMPANY_ROLES.COMPANY_ADMIN),
  userController.resetUserPassword
);

router.patch(
  "/:id/manager",
  authorize(PLATFORM_ROLES.PLATFORM_ADMIN, COMPANY_ROLES.COMPANY_ADMIN),
  userController.reassignSalesRep
);

module.exports = router;

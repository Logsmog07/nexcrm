const express = require("express");
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const companyRoutes = require("./companyRoutes");
const leadRoutes = require("./leadRoutes");
const customerRoutes = require("./customerRoutes");
const dealRoutes = require("./dealRoutes");
const activityRoutes = require("./activityRoutes");
const analyticsRoutes = require("./analyticsRoutes");
const notificationRoutes = require("./notificationRoutes");
const auditRoutes = require("./auditRoutes");
const settingsRoutes = require("./settingsRoutes");
const devConsoleRoutes = require("./devConsole");
const authenticate = require("../middleware/authenticate");

const router = express.Router();

router.use("/dev", devConsoleRoutes);
router.use("/auth", authRoutes);
router.use(authenticate);
router.use("/companies", companyRoutes);
router.use("/users", userRoutes);
router.use("/leads", leadRoutes);
router.use("/customers", customerRoutes);
router.use("/deals", dealRoutes);
router.use("/activities", activityRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/notifications", notificationRoutes);
router.use("/audit", auditRoutes);
router.use("/settings", settingsRoutes);

module.exports = router;

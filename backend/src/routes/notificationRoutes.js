const express = require("express");
const notificationController = require("../controllers/notificationController");

const router = express.Router();

router.get("/", notificationController.listNotifications);
router.patch("/:id/read", notificationController.markAsRead);

module.exports = router;

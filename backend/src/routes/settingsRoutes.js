const express = require("express");
const settingsController = require("../controllers/settingsController");

const router = express.Router();

router.get("/", settingsController.getMySettings);
router.patch("/", settingsController.updateMySettings);

module.exports = router;
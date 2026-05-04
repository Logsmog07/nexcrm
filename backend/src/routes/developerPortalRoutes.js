const express = require("express");
const developerPortalController = require("../controllers/developerPortalController");
const requireDeveloper = require("../middleware/requireDeveloper");

const router = express.Router();

router.use(requireDeveloper);
router.get("/overview", developerPortalController.getOverview);
router.get("/schema", developerPortalController.getSchema);
router.get("/companies/:id", developerPortalController.getCompanySnapshot);
router.get("/table/:tableName", developerPortalController.getTablePreview);

module.exports = router;

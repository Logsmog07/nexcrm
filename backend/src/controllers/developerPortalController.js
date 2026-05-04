const catchAsync = require("../utils/catchAsync");
const developerPortalService = require("../services/developerPortalService");

const getOverview = catchAsync(async (_req, res) => {
  const payload = await developerPortalService.getOverview();
  res.json({ success: true, ...payload });
});

const getSchema = catchAsync(async (_req, res) => {
  const payload = await developerPortalService.buildSchemaMap();
  res.json({ success: true, ...payload });
});

const getCompanySnapshot = catchAsync(async (req, res) => {
  const payload = await developerPortalService.getCompanySnapshot(req.params.id);
  res.json({ success: true, ...payload });
});

const getTablePreview = catchAsync(async (req, res) => {
  const payload = await developerPortalService.getTablePreview({
    tableName: req.params.tableName,
    companyId: req.query.companyId,
    limit: req.query.limit,
  });

  res.json({ success: true, ...payload });
});

module.exports = {
  getOverview,
  getSchema,
  getCompanySnapshot,
  getTablePreview,
};

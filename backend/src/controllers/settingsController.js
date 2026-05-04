const catchAsync = require("../utils/catchAsync");
const auditService = require("../services/auditService");
const settingsService = require("../services/settingsService");

const getMySettings = catchAsync(async (req, res) => {
  const settings = await settingsService.getUserSettings(req.user.id);

  res.json({
    success: true,
    data: settings,
  });
});

const updateMySettings = catchAsync(async (req, res) => {
  const context = auditService.buildRequestContext(req);
  try {
    const settings = await settingsService.updateUserSettings(req.user.id, req.body || {});

    await auditService.recordEvent({
      action: "settings.update",
      entityType: "user",
      entityId: String(req.user.id),
      actorUserId: req.user.id,
      companyId: req.user.company_id || null,
      outcome: "success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        updatedKeys: Object.keys(req.body || {}).slice(0, 30),
      },
    });

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    await auditService.recordEvent({
      action: "settings.update",
      entityType: "user",
      entityId: String(req.user.id),
      actorUserId: req.user.id,
      companyId: req.user.company_id || null,
      outcome: "failure",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        reason: error.message,
      },
    });

    throw error;
  }
});

module.exports = {
  getMySettings,
  updateMySettings,
};
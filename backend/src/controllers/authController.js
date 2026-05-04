const catchAsync = require("../utils/catchAsync");
const authService = require("../services/authService");
const auditService = require("../services/auditService");
const settingsService = require("../services/settingsService");

const signup = catchAsync(async (req, res) => {
  const context = auditService.buildRequestContext(req);
  const email = String(req.body?.email || "").trim().toLowerCase();

  try {
    const result = await authService.signup(req.body);

    await auditService.recordEvent({
      action: "auth.signup",
      entityType: "user",
      entityId: result.user?.id ? String(result.user.id) : null,
      actorUserId: result.user?.id || null,
      companyId: result.user?.company_id || null,
      outcome: "success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        email,
      },
    });

    res.status(201).json({ success: true, ...result });
  } catch (error) {
    await auditService.recordEvent({
      action: "auth.signup",
      entityType: "user",
      outcome: "failure",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        email,
        reason: error.message,
      },
    });

    throw error;
  }
});

const login = catchAsync(async (req, res) => {
  const context = auditService.buildRequestContext(req);
  const email = String(req.body?.email || "").trim().toLowerCase();

  try {
    const result = await authService.login(req.body);

    await auditService.recordEvent({
      action: "auth.login",
      entityType: "session",
      entityId: result.user?.id ? String(result.user.id) : null,
      actorUserId: result.user?.id || null,
      companyId: result.user?.company_id || null,
      outcome: "success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        email,
      },
    });

    res.json({ success: true, ...result });
  } catch (error) {
    await auditService.recordEvent({
      action: "auth.login",
      entityType: "session",
      outcome: "failure",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        email,
        reason: error.message,
      },
    });

    throw error;
  }
});

const impersonate = catchAsync(async (req, res) => {
  const context = auditService.buildRequestContext(req);
  const targetUserId = String(req.params?.id || "").trim();

  try {
    const result = await authService.impersonate({
      targetUserId,
      actor: req.user,
    });

    await auditService.recordEvent({
      action: "auth.impersonate",
      entityType: "session",
      entityId: result.user?.id ? String(result.user.id) : targetUserId || null,
      actorUserId: req.user.id,
      companyId: req.user.company_id || null,
      outcome: "success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        targetUserId,
        targetEmail: result.user?.email || null,
      },
    });

    res.json({ success: true, ...result });
  } catch (error) {
    await auditService.recordEvent({
      action: "auth.impersonate",
      entityType: "session",
      entityId: targetUserId || null,
      actorUserId: req.user.id,
      companyId: req.user.company_id || null,
      outcome: "failure",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        targetUserId,
        reason: error.message,
      },
    });

    throw error;
  }
});

const me = catchAsync(async (req, res) => {
  const settings = await settingsService.getUserSettings(req.user.id);
  res.json({ success: true, user: authService.sanitizeUser(req.user), settings });
});

module.exports = {
  signup,
  login,
  impersonate,
  me,
};

const catchAsync = require("../utils/catchAsync");
const userRepository = require("../repositories/userRepository");
const userService = require("../services/userService");
const auditService = require("../services/auditService");
const { isPlatformAdmin, isCompanyAdmin, isManager } = require("../utils/access");

const listUsers = catchAsync(async (req, res) => {
  let filters = {};

  if (isPlatformAdmin(req.user)) {
    filters = {};
  } else if (isCompanyAdmin(req.user)) {
    filters = { companyId: req.user.company_id };
  } else if (isManager(req.user)) {
    filters = { companyId: req.user.company_id, managerId: req.user.id };
  } else {
    filters = { companyId: req.user.company_id };
  }

  const users = await userRepository.list(filters);
  res.json({ success: true, data: users });
});

const createUser = catchAsync(async (req, res) => {
  const context = auditService.buildRequestContext(req);
  try {
    const user = await userService.createWorkspaceUser(req.body, req.user);

    await auditService.recordEvent({
      action: "user.create",
      entityType: "user",
      entityId: user?.id ? String(user.id) : null,
      actorUserId: req.user.id,
      companyId: user?.company_id || req.user.company_id || null,
      outcome: "success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        companyRole: user?.company_role || null,
      },
    });

    res.status(201).json({ success: true, data: user });
  } catch (error) {
    await auditService.recordEvent({
      action: "user.create",
      entityType: "user",
      actorUserId: req.user.id,
      companyId: req.user.company_id || null,
      outcome: "failure",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        targetCompanyId: req.body?.companyId || null,
        reason: error.message,
      },
    });

    throw error;
  }
});

const updateUserStatus = catchAsync(async (req, res) => {
  const context = auditService.buildRequestContext(req);
  try {
    const user = await userService.updateUserStatus(
      req.params.id,
      req.body.isActive,
      req.user
    );

    await auditService.recordEvent({
      action: "user.status.update",
      entityType: "user",
      entityId: String(req.params.id),
      actorUserId: req.user.id,
      companyId: user?.company_id || req.user.company_id || null,
      outcome: "success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        isActive: Boolean(req.body.isActive),
      },
    });

    res.json({ success: true, data: user });
  } catch (error) {
    await auditService.recordEvent({
      action: "user.status.update",
      entityType: "user",
      entityId: String(req.params.id),
      actorUserId: req.user.id,
      companyId: req.user.company_id || null,
      outcome: "failure",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        isActive: Boolean(req.body.isActive),
        reason: error.message,
      },
    });

    throw error;
  }
});

const resetUserPassword = catchAsync(async (req, res) => {
  const context = auditService.buildRequestContext(req);
  try {
    const user = await userService.resetUserPassword(
      req.params.id,
      req.body.password,
      req.user
    );

    await auditService.recordEvent({
      action: "user.password.reset",
      entityType: "user",
      entityId: String(req.params.id),
      actorUserId: req.user.id,
      companyId: user?.company_id || req.user.company_id || null,
      outcome: "success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    res.json({ success: true, data: user });
  } catch (error) {
    await auditService.recordEvent({
      action: "user.password.reset",
      entityType: "user",
      entityId: String(req.params.id),
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

const reassignSalesRep = catchAsync(async (req, res) => {
  const context = auditService.buildRequestContext(req);
  try {
    const user = await userService.reassignSalesRep(
      req.params.id,
      req.body.managerId,
      req.user
    );

    await auditService.recordEvent({
      action: "user.reassign",
      entityType: "user",
      entityId: String(req.params.id),
      actorUserId: req.user.id,
      companyId: user?.company_id || req.user.company_id || null,
      outcome: "success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        managerId: req.body.managerId || null,
      },
    });

    res.json({ success: true, data: user });
  } catch (error) {
    await auditService.recordEvent({
      action: "user.reassign",
      entityType: "user",
      entityId: String(req.params.id),
      actorUserId: req.user.id,
      companyId: req.user.company_id || null,
      outcome: "failure",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        managerId: req.body.managerId || null,
        reason: error.message,
      },
    });

    throw error;
  }
});

module.exports = {
  listUsers,
  createUser,
  updateUserStatus,
  resetUserPassword,
  reassignSalesRep,
};

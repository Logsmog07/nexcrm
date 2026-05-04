const catchAsync = require("../utils/catchAsync");
const companyService = require("../services/companyService");
const userService = require("../services/userService");
const auditService = require("../services/auditService");

const listCompanies = catchAsync(async (req, res) => {
  const companies = await companyService.listCompanies(req.user);
  res.json({ success: true, data: companies });
});

const getCompanyOverview = catchAsync(async (req, res) => {
  const overview = await companyService.getCompanyOverview(req.params.id, req.user);
  res.json({ success: true, data: overview });
});

const createCompany = catchAsync(async (req, res) => {
  const context = auditService.buildRequestContext(req);
  try {
    const company = await userService.createCompany(req.body, req.user);

    await auditService.recordEvent({
      action: "company.create",
      entityType: "company",
      entityId: company?.id ? String(company.id) : null,
      actorUserId: req.user.id,
      companyId: company?.id || null,
      outcome: "success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        status: company?.status || null,
      },
    });

    res.status(201).json({ success: true, data: company });
  } catch (error) {
    await auditService.recordEvent({
      action: "company.create",
      entityType: "company",
      actorUserId: req.user.id,
      outcome: "failure",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        email: String(req.body?.email || "").trim().toLowerCase() || null,
        reason: error.message,
      },
    });

    throw error;
  }
});

const updateCompany = catchAsync(async (req, res) => {
  const context = auditService.buildRequestContext(req);
  try {
    const company = await userService.updateCompany(req.params.id, req.body, req.user);

    await auditService.recordEvent({
      action: "company.update",
      entityType: "company",
      entityId: String(req.params.id),
      actorUserId: req.user.id,
      companyId: company?.id || null,
      outcome: "success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    res.json({ success: true, data: company });
  } catch (error) {
    await auditService.recordEvent({
      action: "company.update",
      entityType: "company",
      entityId: String(req.params.id),
      actorUserId: req.user.id,
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

const updateCompanyStatus = catchAsync(async (req, res) => {
  const context = auditService.buildRequestContext(req);
  try {
    const company = await userService.updateCompanyStatus(
      req.params.id,
      req.body.status,
      req.user
    );

    await auditService.recordEvent({
      action: "company.status.update",
      entityType: "company",
      entityId: String(req.params.id),
      actorUserId: req.user.id,
      companyId: company?.id || null,
      outcome: "success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        status: req.body.status,
      },
    });

    res.json({ success: true, data: company });
  } catch (error) {
    await auditService.recordEvent({
      action: "company.status.update",
      entityType: "company",
      entityId: String(req.params.id),
      actorUserId: req.user.id,
      outcome: "failure",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        status: req.body.status,
        reason: error.message,
      },
    });

    throw error;
  }
});

const deleteCompany = catchAsync(async (req, res) => {
  const context = auditService.buildRequestContext(req);
  try {
    const result = await companyService.deleteCompany(req.params.id, req.user);

    await auditService.recordEvent({
      action: "company.delete",
      entityType: "company",
      entityId: String(req.params.id),
      actorUserId: req.user.id,
      outcome: "success",
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    await auditService.recordEvent({
      action: "company.delete",
      entityType: "company",
      entityId: String(req.params.id),
      actorUserId: req.user.id,
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
  listCompanies,
  getCompanyOverview,
  createCompany,
  updateCompany,
  updateCompanyStatus,
  deleteCompany,
};

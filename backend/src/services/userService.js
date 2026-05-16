const ApiError = require("../utils/ApiError");
const userRepository = require("../repositories/userRepository");
const companyRepository = require("../repositories/companyRepository");
const { hashPassword } = require("../utils/password");
const { COMPANY_ROLES, COMPANY_STATUSES } = require("../config/constants");
const { ensureEmail, requireFields } = require("../utils/validators");
const { isPlatformAdmin, isCompanyAdmin } = require("../utils/access");

const validatePassword = (password) => {
  if (String(password || "").length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters long");
  }

  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new ApiError(
      400,
      "Password must include at least one uppercase letter and one number"
    );
  }
};

const normalizeCompanyInput = (payload) => {
  requireFields(
    payload,
    [
      "name",
      "email",
      "phone",
      "industry",
      "companySize",
      "address",
      "subscriptionPlan",
      "status",
    ]
  );
  ensureEmail(payload.email);

  return {
    name: String(payload.name).trim(),
    email: String(payload.email).trim().toLowerCase(),
    phone: String(payload.phone).trim(),
    industry: String(payload.industry).trim(),
    companySize: String(payload.companySize).trim(),
    address: String(payload.address).trim(),
    subscriptionPlan: String(payload.subscriptionPlan).trim(),
    status: payload.status,
  };
};

const createCompany = async (payload, actor) => {
  if (!isPlatformAdmin(actor)) {
    throw new ApiError(403, "Only the platform admin can create companies");
  }

  const normalized = normalizeCompanyInput(payload);
  if (!Object.values(COMPANY_STATUSES).includes(normalized.status)) {
    throw new ApiError(400, "Invalid company status");
  }

  const existingCompany = await companyRepository.findByEmail(normalized.email);
  if (existingCompany) {
    throw new ApiError(409, "A company with that email already exists");
  }

  return companyRepository.create(normalized);
};

const updateCompany = async (id, payload, actor) => {
  if (!isPlatformAdmin(actor)) {
    throw new ApiError(403, "Only the platform admin can edit companies");
  }

  const existingCompany = await companyRepository.findById(id);
  if (!existingCompany) {
    throw new ApiError(404, "Company not found");
  }

  const normalized = normalizeCompanyInput(payload);
  if (!Object.values(COMPANY_STATUSES).includes(normalized.status)) {
    throw new ApiError(400, "Invalid company status");
  }

  const emailOwner = await companyRepository.findByEmail(normalized.email);
  if (emailOwner && String(emailOwner.id) !== String(id)) {
    throw new ApiError(409, "Another company already uses that email");
  }

  return companyRepository.update(id, normalized);
};

const updateCompanyStatus = async (id, status, actor) => {
  if (!isPlatformAdmin(actor)) {
    throw new ApiError(403, "Only the platform admin can change company status");
  }

  if (!Object.values(COMPANY_STATUSES).includes(status)) {
    throw new ApiError(400, "Invalid company status");
  }

  const updated = await companyRepository.updateStatus(id, status);
  if (!updated) {
    throw new ApiError(404, "Company not found");
  }

  return updated;
};

const createWorkspaceUser = async (payload, actor) => {
  requireFields(payload, ["fullName", "email", "password", "companyId", "companyRole"]);
  ensureEmail(payload.email);
  validatePassword(payload.password);

  const fullName = String(payload.fullName).trim();
  const email = String(payload.email).trim().toLowerCase();
  const companyRole = payload.companyRole;
  const companyId = String(payload.companyId);

  if (!Object.values(COMPANY_ROLES).includes(companyRole)) {
    throw new ApiError(400, "Invalid company role");
  }

  if (companyRole === COMPANY_ROLES.COMPANY_ADMIN && !isPlatformAdmin(actor)) {
    throw new ApiError(403, "Only the platform admin can create company admins");
  }

  if (!isPlatformAdmin(actor) && !isCompanyAdmin(actor)) {
    throw new ApiError(403, "You do not have permission to create users");
  }

  if (isCompanyAdmin(actor) && String(actor.company_id) !== companyId) {
    throw new ApiError(403, "Company admins can only create users in their own company");
  }

  const company = await companyRepository.findById(companyId);
  if (!company) {
    throw new ApiError(404, "Company not found");
  }

  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    throw new ApiError(409, "A user with that email already exists");
  }

  let managerId = payload.managerId || null;

  if (companyRole === COMPANY_ROLES.SALES_REP && !managerId) {
    throw new ApiError(400, "Sales reps must be assigned to a manager");
  }

  if (managerId) {
    const manager = await userRepository.findById(managerId);
    if (!manager || String(manager.company_id) !== companyId) {
      throw new ApiError(400, "Selected manager does not belong to this company");
    }

    if (manager.company_role !== COMPANY_ROLES.MANAGER) {
      throw new ApiError(400, "Selected manager must have manager role");
    }
  }

  const user = await userRepository.create({
    fullName,
    email,
    passwordHash: await hashPassword(payload.password),
    companyRole,
    companyId,
    managerId,
    avatarUrl: payload.avatarUrl || null,
  });

  return userRepository.findById(user.id);
};

const updateUserStatus = async (id, isActive, actor) => {
  const targetUser = await userRepository.findById(id);
  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  if (isPlatformAdmin(actor)) {
    if (targetUser.platform_role) {
      throw new ApiError(403, "Platform admin accounts cannot be deactivated here");
    }
  } else if (isCompanyAdmin(actor)) {
    if (String(targetUser.company_id) !== String(actor.company_id)) {
      throw new ApiError(403, "You can only manage users in your company");
    }

    if (targetUser.company_role === COMPANY_ROLES.COMPANY_ADMIN) {
      throw new ApiError(403, "Company admins cannot deactivate another company admin");
    }
  } else {
    throw new ApiError(403, "You do not have permission to update users");
  }

  const updated = await userRepository.updateActiveStatus(id, Boolean(isActive));
  return userRepository.findById(updated.id);
};

const resetUserPassword = async (id, password, actor) => {
  validatePassword(password);

  const targetUser = await userRepository.findById(id);
  if (!targetUser) {
    throw new ApiError(404, "User not found");
  }

  if (isPlatformAdmin(actor)) {
    // Platform admins may rotate credentials for any account, including
    // another platform admin. Deactivation/impersonation remains restricted.
  } else if (isCompanyAdmin(actor)) {
    if (String(targetUser.company_id) !== String(actor.company_id)) {
      throw new ApiError(403, "You can only manage users in your company");
    }

    if (targetUser.company_role === COMPANY_ROLES.COMPANY_ADMIN) {
      throw new ApiError(403, "Company admins cannot reset another company admin password");
    }
  } else {
    throw new ApiError(403, "You do not have permission to reset passwords");
  }

  const updated = await userRepository.updatePasswordHash(
    id,
    await hashPassword(password)
  );

  return userRepository.findById(updated.id);
};

const reassignSalesRep = async (id, managerId, actor) => {
  const rep = await userRepository.findById(id);
  if (!rep) {
    throw new ApiError(404, "User not found");
  }

  if (rep.company_role !== COMPANY_ROLES.SALES_REP) {
    throw new ApiError(400, "Only sales reps can be reassigned to managers");
  }

  if (!managerId) {
    throw new ApiError(400, "A destination manager is required");
  }

  const manager = await userRepository.findById(managerId);
  if (!manager) {
    throw new ApiError(404, "Manager not found");
  }

  if (manager.company_role !== COMPANY_ROLES.MANAGER) {
    throw new ApiError(400, "Selected destination user is not a manager");
  }

  if (String(manager.company_id) !== String(rep.company_id)) {
    throw new ApiError(400, "Sales reps can only be reassigned within the same company");
  }

  if (isPlatformAdmin(actor)) {
    // allowed
  } else if (isCompanyAdmin(actor)) {
    if (String(actor.company_id) !== String(rep.company_id)) {
      throw new ApiError(403, "You can only manage users in your company");
    }
  } else {
    throw new ApiError(403, "You do not have permission to reassign users");
  }

  const updated = await userRepository.updateManagerAssignment(id, managerId);
  return userRepository.findById(updated.id);
};

module.exports = {
  createCompany,
  updateCompany,
  updateCompanyStatus,
  createWorkspaceUser,
  updateUserStatus,
  resetUserPassword,
  reassignSalesRep,
};

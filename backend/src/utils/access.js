const { PLATFORM_ROLES, COMPANY_ROLES } = require("../config/constants");
const env = require("../config/env");
const ApiError = require("./ApiError");

const getEffectiveRole = (user) =>
  user?.platform_role || user?.company_role || user?.role || null;

const isPlatformAdmin = (user) =>
  getEffectiveRole(user) === PLATFORM_ROLES.PLATFORM_ADMIN;

const isDeveloper = (user) => {
  const configuredDeveloperEmail = String(env.developerPortal?.email || "")
    .trim()
    .toLowerCase();

  if (!configuredDeveloperEmail) {
    return false;
  }

  return String(user?.email || "").trim().toLowerCase() === configuredDeveloperEmail;
};

const isCompanyAdmin = (user) =>
  user?.company_role === COMPANY_ROLES.COMPANY_ADMIN;

const isManager = (user) => user?.company_role === COMPANY_ROLES.MANAGER;

const isSalesRep = (user) => user?.company_role === COMPANY_ROLES.SALES_REP;

const isCompanyUser = (user) =>
  Boolean(user?.company_id) && !isPlatformAdmin(user);

const canAccessAnalytics = (user) =>
  isPlatformAdmin(user) || isCompanyAdmin(user) || isManager(user);

const canManageUsers = (user) => isPlatformAdmin(user) || isCompanyAdmin(user);

const canDeleteRecords = (user) => isPlatformAdmin(user) || isCompanyAdmin(user);

const canViewAllRecords = (user) =>
  isPlatformAdmin(user) || isCompanyAdmin(user) || isManager(user);

const ensureSameCompany = (user, resourceCompanyId, resourceLabel = "resource") => {
  if (isPlatformAdmin(user)) {
    return;
  }

  if (!user?.company_id || !resourceCompanyId || String(user.company_id) !== String(resourceCompanyId)) {
    throw new ApiError(403, `You do not have access to this ${resourceLabel}`);
  }
};

const ensureOwnershipOrElevated = ({
  user,
  ownerId,
  fallbackOwnerId,
  resourceCompanyId,
  allowedOwnerIds = [],
  resourceLabel = "resource",
}) => {
  if (resourceCompanyId) {
    ensureSameCompany(user, resourceCompanyId, resourceLabel);
  }

  if (canViewAllRecords(user)) {
    return;
  }

  const allowedIds = [ownerId, fallbackOwnerId, ...(allowedOwnerIds || [])]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value));

  if (!allowedIds.includes(String(user.id))) {
    throw new ApiError(403, `You do not have access to this ${resourceLabel}`);
  }
};

const buildScopeForUser = async (user, userRepository) => {
  if (isPlatformAdmin(user)) {
    return {};
  }

  if (!user?.company_id) {
    throw new ApiError(403, "This account is not linked to a company workspace");
  }

  const scope = {
    companyId: user.company_id,
  };

  if (isCompanyAdmin(user)) {
    return scope;
  }

  if (isManager(user)) {
    const managedIds = await userRepository.listManagedRepIds(user.id);
    scope.ownerIds = [user.id, ...managedIds];
    scope.managerId = user.id;
    return scope;
  }

  scope.ownerId = user.id;
  scope.ownerIds = [user.id];
  return scope;
};

module.exports = {
  getEffectiveRole,
  isDeveloper,
  isPlatformAdmin,
  isCompanyAdmin,
  isManager,
  isSalesRep,
  isCompanyUser,
  canAccessAnalytics,
  canManageUsers,
  canDeleteRecords,
  canViewAllRecords,
  ensureSameCompany,
  ensureOwnershipOrElevated,
  buildScopeForUser,
};

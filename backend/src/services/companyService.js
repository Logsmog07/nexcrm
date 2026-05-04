const ApiError = require("../utils/ApiError");
const companyRepository = require("../repositories/companyRepository");
const userRepository = require("../repositories/userRepository");
const activityRepository = require("../repositories/activityRepository");
const analyticsService = require("./analyticsService");
const { isPlatformAdmin } = require("../utils/access");

const ensurePlatformAdmin = (user) => {
  if (!isPlatformAdmin(user)) {
    throw new ApiError(403, "Only platform admins can access company control center data");
  }
};

const listCompanies = async (user) => {
  ensurePlatformAdmin(user);
  return companyRepository.listWithSummaries();
};

const getCompanyOverview = async (companyId, user) => {
  ensurePlatformAdmin(user);

  const company = await companyRepository.findById(companyId);
  if (!company) {
    throw new ApiError(404, "Company not found");
  }

  const [dashboard, users, recentActivity] = await Promise.all([
    analyticsService.getCompanyDashboardAnalytics(companyId, user),
    userRepository.list({ companyId }),
    activityRepository.list({ companyId }),
  ]);

  return {
    company,
    dashboard,
    users,
    recentActivity: recentActivity.slice(0, 8),
  };
};

const deleteCompany = async (companyId, user) => {
  ensurePlatformAdmin(user);

  const company = await companyRepository.findById(companyId);
  if (!company) {
    throw new ApiError(404, "Company not found");
  }

  const users = await userRepository.list({ companyId });
  if (users.length > 0) {
    throw new ApiError(
      400,
      "Delete all workspace users or reassign them before permanently deleting this company"
    );
  }

  const removed = await companyRepository.remove(companyId);
  if (!removed) {
    throw new ApiError(404, "Company not found");
  }

  return { deleted: true };
};

module.exports = {
  listCompanies,
  getCompanyOverview,
  deleteCompany,
};

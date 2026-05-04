const ApiError = require("../utils/ApiError");
const { comparePassword, hashPassword } = require("../utils/password");
const { signToken } = require("../utils/token");
const userRepository = require("../repositories/userRepository");
const companyRepository = require("../repositories/companyRepository");
const { PLATFORM_ROLES, COMPANY_ROLES, COMPANY_STATUSES } = require("../config/constants");
const { ensureEmail, requireFields } = require("../utils/validators");
const {
  getEffectiveRole,
  isPlatformAdmin,
  isCompanyAdmin,
  isDeveloper,
} = require("../utils/access");
const settingsService = require("./settingsService");
const env = require("../config/env");

const sanitizeUser = (user) => ({
  id: user.id,
  full_name: user.full_name,
  email: user.email,
  role: getEffectiveRole(user),
  platform_role: user.platform_role || null,
  company_role: user.company_role || null,
  company_id: user.company_id || null,
  company_name: user.company_name || null,
  manager_id: user.manager_id || null,
  manager_name: user.manager_name || null,
  is_developer: isDeveloper(user),
  avatar_url: user.avatar_url,
  is_active: user.is_active,
  created_at: user.created_at,
  updated_at: user.updated_at,
});

const buildAuthResponse = async (user, options = {}) => {
  const impersonator = options.impersonator || null;

  return {
    token: signToken({
      sub: user.id,
      role: getEffectiveRole(user),
      platform_role: user.platform_role || null,
      company_role: user.company_role || null,
      company_id: user.company_id || null,
      impersonated_by: impersonator?.id || null,
    }),
    expires_in: env.jwtExpiresIn,
    user: sanitizeUser(user),
    settings: await settingsService.getUserSettings(user.id),
    impersonation: impersonator
      ? {
          active: true,
          actor: sanitizeUser(impersonator),
        }
      : {
          active: false,
        },
  };
};

const normalizeCompanyPayload = ({
  companyName,
  companyEmail,
  companyPhone,
  industry,
  companySize,
  address,
  subscriptionPlan,
  status,
}) => {
  requireFields(
    { companyName, companyEmail, companyPhone, industry, companySize, address, subscriptionPlan },
    [
      "companyName",
      "companyEmail",
      "companyPhone",
      "industry",
      "companySize",
      "address",
      "subscriptionPlan",
    ]
  );
  ensureEmail(companyEmail);

  return {
    name: String(companyName).trim(),
    email: String(companyEmail).trim().toLowerCase(),
    phone: String(companyPhone).trim(),
    industry: String(industry).trim(),
    companySize: String(companySize).trim(),
    address: String(address).trim(),
    subscriptionPlan: String(subscriptionPlan).trim(),
    status: status || COMPANY_STATUSES.TRIAL,
  };
};

const validatePassword = (password) => {
  if (password.length < 8) {
    throw new ApiError(400, "Password must be at least 8 characters long");
  }

  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new ApiError(
      400,
      "Password must include at least one uppercase letter and one number"
    );
  }
};

const signup = async ({
  fullName,
  email,
  password,
  avatarUrl,
  companyName,
  companyEmail,
  companyPhone,
  industry,
  companySize,
  address,
  subscriptionPlan,
}) => {
  requireFields({ fullName, email, password }, ["fullName", "email", "password"]);
  ensureEmail(email);

  const normalizedName = String(fullName || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedCompany = normalizeCompanyPayload({
    companyName,
    companyEmail,
    companyPhone,
    industry,
    companySize,
    address,
    subscriptionPlan,
  });

  if (normalizedName.length < 2) {
    throw new ApiError(400, "Full name must be at least 2 characters long");
  }

  validatePassword(password);

  const existingUser = await userRepository.findByEmail(normalizedEmail);
  if (existingUser) {
    throw new ApiError(409, "A user with that email already exists");
  }

  const existingCompany = await companyRepository.findByEmail(normalizedCompany.email);
  if (existingCompany) {
    throw new ApiError(409, "A company with that email already exists");
  }

  const company = await companyRepository.create(normalizedCompany);

  const user = await userRepository.create({
    fullName: normalizedName,
    email: normalizedEmail,
    passwordHash: await hashPassword(password),
    companyRole: COMPANY_ROLES.COMPANY_ADMIN,
    companyId: company.id,
    avatarUrl,
  });

  const createdUser = await userRepository.findById(user.id);
  return buildAuthResponse(createdUser);
};

const login = async ({ email, password }) => {
  requireFields({ email, password }, ["email", "password"]);

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (!user.is_active) {
    throw new ApiError(403, "This account has been deactivated");
  }

  const passwordMatches = await comparePassword(password, user.password_hash);
  if (!passwordMatches) {
    throw new ApiError(401, "Invalid email or password");
  }

  return buildAuthResponse(user);
};

const impersonate = async ({ targetUserId, actor }) => {
  if (!actor?.id) {
    throw new ApiError(401, "A valid authenticated user is required");
  }

  const target = await userRepository.findById(targetUserId);
  if (!target) {
    throw new ApiError(404, "Target user not found");
  }

  if (!target.is_active) {
    throw new ApiError(403, "Target account is deactivated");
  }

  if (String(target.id) === String(actor.id)) {
    throw new ApiError(400, "You are already logged in as this user");
  }

  if (target.platform_role === PLATFORM_ROLES.PLATFORM_ADMIN) {
    throw new ApiError(403, "Platform admin accounts cannot be impersonated");
  }

  if (isPlatformAdmin(actor)) {
    return buildAuthResponse(target, { impersonator: actor });
  }

  if (isCompanyAdmin(actor)) {
    if (String(target.company_id || "") !== String(actor.company_id || "")) {
      throw new ApiError(403, "You can only access users in your company");
    }

    return buildAuthResponse(target, { impersonator: actor });
  }

  throw new ApiError(403, "You do not have permission to access this account");
};

module.exports = {
  signup,
  login,
  impersonate,
  sanitizeUser,
};

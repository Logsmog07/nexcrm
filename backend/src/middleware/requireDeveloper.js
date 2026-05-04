const ApiError = require("../utils/ApiError");
const env = require("../config/env");
const { isDeveloper } = require("../utils/access");

const requireDeveloper = (req, _res, next) => {
  if (!env.developerPortal.enabled) {
    return next(new ApiError(404, "Developer portal is disabled"));
  }

  if (!req.user) {
    return next(new ApiError(401, "Authentication required"));
  }

  if (!isDeveloper(req.user)) {
    return next(new ApiError(403, "Developer portal access denied"));
  }

  return next();
};

module.exports = requireDeveloper;

const ApiError = require("../utils/ApiError");
const { getEffectiveRole } = require("../utils/access");

const authorize =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "Authentication required"));
    }

    const effectiveRole = getEffectiveRole(req.user);

    if (!roles.includes(effectiveRole)) {
      return next(new ApiError(403, "You do not have permission to do that"));
    }

    next();
  };

module.exports = authorize;

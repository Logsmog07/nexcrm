const ApiError = require("./ApiError");

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));

const requireFields = (payload, fields) => {
  const missing = fields.filter((field) => {
    const value = payload[field];
    return value === undefined || value === null || value === "";
  });

  if (missing.length) {
    throw new ApiError(400, `Missing required fields: ${missing.join(", ")}`);
  }
};

const ensureEnum = (value, allowed, fieldName) => {
  if (!Object.values(allowed).includes(value)) {
    throw new ApiError(
      400,
      `${fieldName} must be one of: ${Object.values(allowed).join(", ")}`
    );
  }
};

const ensureEmail = (value, fieldName = "email") => {
  if (value && !isEmail(value)) {
    throw new ApiError(400, `${fieldName} must be a valid email address`);
  }
};

module.exports = {
  requireFields,
  ensureEnum,
  ensureEmail,
};

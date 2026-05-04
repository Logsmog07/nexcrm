const ApiError = require("../utils/ApiError");
const env = require("../config/env");

const errorHandler = (error, _req, res, _next) => {
  const isApiError = error instanceof ApiError;
  const statusCode = isApiError ? error.statusCode : 500;
  const exposeMessage = isApiError || !env.isProduction;
  const responseMessage = exposeMessage
    ? error.message || "Something went wrong"
    : "Internal server error";
  const responseDetails = isApiError
    ? error.details || null
    : !env.isProduction
      ? { stack: error.stack || null }
      : null;

  if (statusCode === 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    success: false,
    message: responseMessage,
    details: responseDetails,
  });
};

module.exports = errorHandler;

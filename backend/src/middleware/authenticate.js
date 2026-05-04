const ApiError = require("../utils/ApiError");
const catchAsync = require("../utils/catchAsync");
const { verifyToken } = require("../utils/token");
const userRepository = require("../repositories/userRepository");

const authenticate = catchAsync(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "Authentication token is required");
  }

  let decoded;
  try {
    decoded = verifyToken(token);
  } catch (_error) {
    throw new ApiError(401, "Invalid or expired authentication token");
  }

  const user = await userRepository.findById(decoded.sub);

  if (!user || !user.is_active) {
    throw new ApiError(401, "User session is invalid");
  }

  req.user = user;
  next();
});

module.exports = authenticate;

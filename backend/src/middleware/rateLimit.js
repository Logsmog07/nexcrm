const ApiError = require("../utils/ApiError");

const rateLimitStore = new Map();
let lastPruneAt = 0;

const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
};

const pruneExpiredEntries = (now) => {
  if (now - lastPruneAt < 60_000) {
    return;
  }

  lastPruneAt = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
};

const createRateLimiter = ({
  windowMs,
  max,
  keyPrefix = "default",
  keyGenerator,
  message = "Too many requests. Please try again later.",
  skip,
}) => {
  return (req, res, next) => {
    if (typeof skip === "function" && skip(req)) {
      return next();
    }

    const now = Date.now();
    pruneExpiredEntries(now);

    const keyPart =
      typeof keyGenerator === "function" ? keyGenerator(req) : getClientIp(req);
    const normalizedKeyPart = String(keyPart || "unknown").toLowerCase();
    const storageKey = `${keyPrefix}:${normalizedKeyPart}`;

    const currentEntry = rateLimitStore.get(storageKey);
    const entry =
      !currentEntry || currentEntry.resetAt <= now
        ? { count: 0, resetAt: now + windowMs }
        : currentEntry;

    entry.count += 1;
    rateLimitStore.set(storageKey, entry);

    const remaining = Math.max(max - entry.count, 0);
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfterSeconds));
      return next(new ApiError(429, message));
    }

    return next();
  };
};

module.exports = {
  createRateLimiter,
};

const securityHeaders = (req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");

  const forwardedProto = req.headers["x-forwarded-proto"];
  const isSecure = req.secure || forwardedProto === "https";
  if (isSecure) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
  }

  next();
};

module.exports = securityHeaders;

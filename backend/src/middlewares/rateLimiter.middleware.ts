import rateLimit from "express-rate-limit";

export const rateLimiterMiddleware = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000"), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100"), // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health check endpoint
    return req.path === "/health";
  },
});

// Stricter rate limit for authentication routes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: "Too many authentication attempts, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

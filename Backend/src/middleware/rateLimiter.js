/**
 * ExamGuard - Authentication Abuse & Login Rate Limiter (Module 17)
 *
 * Protects POST /api/auth/login against brute-force credential stuffing and DoS attacks.
 *
 * Invariants:
 * - Emits standard RateLimit headers (RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset).
 * - Returns sanitized HTTP 429 Too Many Requests response without leaking credentials or internal state.
 * - Test isolation: Bypasses rate limiting during 'test' runs to avoid test flakiness, unless explicitly forced.
 * - Proxy trust: Relies on Express 'trust proxy' setting configured in server.js.
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Creates an Express rate limiter for the authentication login route.
 *
 * @param {Object} [customOptions]
 * @param {number} [customOptions.windowMinutes] - Throttling window in minutes
 * @param {number} [customOptions.maxAttempts] - Max allowed attempts per window
 * @param {boolean} [customOptions.forceEnable] - Forces rate limiter active even in test mode
 * @returns {Function} Express rate limit middleware
 */
function createLoginRateLimiter(customOptions = {}) {
  const env = config.nodeEnv || process.env.NODE_ENV || 'development';
  const isTest = env === 'test';

  const windowMinutes = customOptions.windowMinutes || config.rateLimit?.windowMinutes || 15;
  const windowMs = windowMinutes * 60 * 1000;
  const maxAttempts = isTest && !customOptions.forceEnable
    ? 10000
    : customOptions.maxAttempts || config.rateLimit?.maxAttempts || 10;

  return rateLimit({
    windowMs,
    max: maxAttempts,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => isTest && !customOptions.forceEnable,
    handler: (req, res /*, next, options */) => {
      const retryAfterSeconds = Math.ceil(windowMs / 1000);
      return res.status(429).json({
        success: false,
        message: `Too many login attempts from this IP. Access temporarily throttled. Please try again in ${windowMinutes} minutes.`,
        retryAfter: retryAfterSeconds,
      });
    },
  });
}

// Default singleton instance for standard route mounting
const defaultLoginLimiter = createLoginRateLimiter();

module.exports = {
  createLoginRateLimiter,
  defaultLoginLimiter,
};

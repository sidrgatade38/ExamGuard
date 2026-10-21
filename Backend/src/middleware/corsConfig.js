/**
 * ExamGuard - CORS & Origin Hardening Middleware (Module 17)
 *
 * Implements strict, environment-aware origin validation:
 * - Production: Strictly validates browser Origin against explicit ALLOWED_ORIGINS allowlist.
 * - Development/Test: Permits localhost/127.0.0.1 origins for ease of development.
 * - Non-browser clients (probes, curl, mobile, server-to-server) with no Origin header are safely permitted.
 * - Disallows wildcard origins with credentialed requests.
 */

const cors = require('cors');
const config = require('../config');

// Standard local development origins
const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

/**
 * Parses and normalizes configured origin allowlist.
 *
 * @param {string} [rawOrigins] - Comma-separated string of permitted origins
 * @returns {string[]} Array of normalized origins
 */
function parseAllowedOrigins(rawOrigins) {
  if (!rawOrigins || typeof rawOrigins !== 'string') return [];
  return rawOrigins
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/**
 * Creates configured CORS middleware instance based on environment.
 *
 * @param {Object} [overrideConfig]
 * @returns {Function} Express CORS middleware
 */
function createCorsMiddleware(overrideConfig = null) {
  const currentConfig = overrideConfig || config;
  const env = currentConfig.nodeEnv || process.env.NODE_ENV || 'development';
  const isProduction = env === 'production';

  const configuredList = parseAllowedOrigins(currentConfig.allowedOrigins || process.env.ALLOWED_ORIGINS);
  const allowedList = isProduction
    ? configuredList
    : Array.from(new Set([...configuredList, ...DEFAULT_DEV_ORIGINS]));

  const corsOptions = {
    origin: (origin, callback) => {
      // 1. Requests with no origin (curl, server-to-server, health check probes) are permitted
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.trim().replace(/\/+$/, '');

      // 2. Exact match against allowlist
      if (allowedList.includes(normalizedOrigin)) {
        return callback(null, true);
      }

      // 3. In non-production, permit any localhost / 127.0.0.1 port
      if (!isProduction) {
        const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin);
        if (isLocalhost) {
          return callback(null, true);
        }
      }

      // 4. Disallowed origin
      const corsErr = new Error(`CORS policy: Origin "${normalizedOrigin}" is not authorized.`);
      corsErr.statusCode = 403;
      return callback(corsErr, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    exposedHeaders: ['Content-Disposition'],
    maxAge: 86400, // 24 hours preflight cache
  };

  return cors(corsOptions);
}

module.exports = {
  createCorsMiddleware,
  parseAllowedOrigins,
  DEFAULT_DEV_ORIGINS,
};

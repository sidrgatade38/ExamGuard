const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Validates and retrieves the JWT secret.
 * @returns {string} JWT_SECRET
 */
function getJwtSecret() {
  const secret = config.jwtSecret;
  if (!secret) {
    throw new Error('JWT configuration error: JWT_SECRET must be configured in Backend/.env');
  }
  return secret;
}

/**
 * Generates a signed JWT with the provided payload.
 * Strictly includes only minimal required identity attributes.
 *
 * @param {Object} payload - { userId, roleId, email }
 * @returns {string} Encoded JWT token string
 */
function generateToken(payload) {
  const secret = getJwtSecret();
  const expiresIn = config.jwtExpiresIn || '1h';

  // Explicitly whitelisted payload attributes
  const sanitizedPayload = {
    userId: payload.userId,
    roleId: payload.roleId,
    email: payload.email,
  };

  return jwt.sign(sanitizedPayload, secret, { expiresIn });
}

/**
 * Verifies a JWT token signature and expiration.
 *
 * @param {string} token - The raw JWT token string
 * @returns {Object} Decoded token payload
 * @throws {jwt.TokenExpiredError | jwt.JsonWebTokenError} If token is invalid or expired
 */
function verifyToken(token) {
  const secret = getJwtSecret();
  return jwt.verify(token, secret);
}

module.exports = {
  generateToken,
  verifyToken,
};

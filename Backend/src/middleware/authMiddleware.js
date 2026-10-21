const { verifyToken } = require('../utils/jwt');

/**
 * Express middleware to authenticate and verify incoming Bearer JWT tokens.
 * Attaches decoded user identity to `req.user`.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Missing Authorization header.',
    });
  }

  // Expect standard Bearer scheme: "Bearer <token>"
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      message: 'Malformed Authorization header. Format must be Bearer <token>.',
    });
  }

  const token = parts[1];

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    return next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Authentication token has expired. Please log in again.',
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid or malformed authentication token.',
    });
  }
}

module.exports = {
  authenticateToken,
};

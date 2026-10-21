const authService = require('../services/authService');
const auditLogService = require('../services/auditLogService');

/**
 * Basic email format verification.
 */
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Handles POST /api/auth/login
 */
async function login(req, res, next) {
  const { email, password } = req.body || {};
  try {
    // Validate required fields
    if (!email || !password) {
      await auditLogService.logAuditEvent({
        action: 'FAILED_LOGIN',
        resourceType: 'AUTH',
        outcome: 'FAILURE',
        summary: 'Login attempt missing email or password',
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
        metadata: { reason: 'Missing credentials' },
      });
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    if (!isValidEmail(email)) {
      await auditLogService.logAuditEvent({
        action: 'FAILED_LOGIN',
        resourceType: 'AUTH',
        outcome: 'FAILURE',
        summary: `Login attempt with invalid email format: ${String(email).slice(0, 50)}`,
        ipAddress: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
        metadata: { reason: 'Invalid email format' },
      });
      return res.status(400).json({
        success: false,
        message: 'Invalid email address format',
      });
    }

    if (typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Password must be a non-empty string',
      });
    }

    const result = await authService.loginUser(email, password);

    // Audit log successful login
    await auditLogService.logAuditEvent({
      userId: result.user.id,
      role: result.user.role,
      action: 'LOGIN',
      resourceType: 'AUTH',
      resourceId: result.user.id,
      outcome: 'SUCCESS',
      summary: `User ${result.user.email} successfully logged in`,
      ipAddress: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      metadata: { email: result.user.email },
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      token: result.token,
      user: result.user,
    });
  } catch (error) {
    // Audit log failed login
    await auditLogService.logAuditEvent({
      userId: null,
      role: null,
      action: 'FAILED_LOGIN',
      resourceType: 'AUTH',
      resourceId: null,
      outcome: 'FAILURE',
      summary: `Failed login attempt for: ${typeof email === 'string' ? email.slice(0, 100) : 'unknown'}`,
      ipAddress: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
      metadata: {
        email: typeof email === 'string' ? email.slice(0, 100) : null,
        reason: error.message,
      },
    });

    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
}

/**
 * Handles GET /api/auth/me
 */
async function getMe(req, res, next) {
  try {
    // req.user is populated by authenticateToken middleware
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access',
      });
    }

    const user = await authService.getUserById(userId);

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }
    return next(error);
  }
}

module.exports = {
  login,
  getMe,
};

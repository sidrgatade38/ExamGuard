const authorizationService = require('../services/authorizationService');
const auditLogService = require('../services/auditLogService');

/**
 * Role-Based Access Control (RBAC) middleware factory.
 * Enforces that an authenticated user possesses one of the allowed roles.
 * Must be mounted AFTER authenticateToken middleware.
 *
 * @param {...string} allowedRoles - Permitted role names, e.g. 'ADMIN', 'TEACHER', 'EXAM_COORDINATOR'
 * @returns {Function} Express middleware handler
 */
function authorizeRoles(...allowedRoles) {
  const normalizedAllowedRoles = allowedRoles.map((r) => String(r).toUpperCase());

  return async (req, res, next) => {
    // 1. Verify user identity from preceding authenticateToken middleware
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Missing user identity.',
      });
    }

    try {
      // 2. Fetch authoritative role from database (never trust client claims)
      const userAuth = await authorizationService.getUserRole(userId);

      // 3. Verify user active status
      if (!userAuth.isActive) {
        auditLogService.logAuditEvent({
          userId,
          role: userAuth.roleName,
          action: 'UNAUTHORIZED_ACCESS',
          resourceType: 'RBAC',
          resourceId: req.originalUrl,
          outcome: 'DENIED',
          summary: `Access forbidden: account is inactive for user ${userId}`,
          ipAddress: req.ip || req.headers['x-forwarded-for'],
          userAgent: req.headers['user-agent'],
          metadata: { reason: 'Inactive account', path: req.originalUrl },
        });
        return res.status(403).json({
          success: false,
          message: 'Access forbidden. Account is inactive.',
        });
      }

      // 4. Compare user's role against allowed roles
      if (!normalizedAllowedRoles.includes(userAuth.roleName)) {
        auditLogService.logAuditEvent({
          userId,
          role: userAuth.roleName,
          action: 'UNAUTHORIZED_ACCESS',
          resourceType: 'RBAC',
          resourceId: req.originalUrl,
          outcome: 'DENIED',
          summary: `Access forbidden for user with role ${userAuth.roleName} to ${req.method} ${req.originalUrl}`,
          ipAddress: req.ip || req.headers['x-forwarded-for'],
          userAgent: req.headers['user-agent'],
          metadata: {
            requiredRoles: normalizedAllowedRoles,
            userRole: userAuth.roleName,
            path: req.originalUrl,
            method: req.method,
          },
        });
        return res.status(403).json({
          success: false,
          message: 'Access forbidden',
        });
      }

      // 5. Attach authoritative role details to request object for downstream use
      req.userRole = userAuth.roleName;
      req.userRoleId = userAuth.roleId;

      return next();
    } catch (err) {
      // Differentiate between 403 (forbidden/inactive/unknown) and 500
      if (err.statusCode === 403) {
        return res.status(403).json({
          success: false,
          message: 'Access forbidden',
        });
      }

      console.error('[roleMiddleware] Authorization error:', err.message);
      return res.status(500).json({
        success: false,
        message: 'Internal authorization error',
      });
    }
  };
}

module.exports = {
  authorizeRoles,
};

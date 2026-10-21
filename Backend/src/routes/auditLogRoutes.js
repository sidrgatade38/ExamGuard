/**
 * ExamGuard - Audit Log Routes (Module 13)
 *
 * Exclusively accessible to authenticated users possessing the authoritative ADMIN role.
 * Read-only interface: modification (POST, PUT, PATCH, DELETE) is strictly prohibited.
 */

const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const auditLogController = require('../controllers/auditLogController');

const router = express.Router();

// Enforce authentication & authoritative ADMIN role check across all audit log routes
router.use(authenticateToken);
router.use(authorizeRoles('ADMIN'));

// Aggregate summary endpoint (placed before /:id to prevent ID collision)
router.get('/summary', auditLogController.getAuditSummary);

// Paginated listing endpoint with filters
router.get('/', auditLogController.listAuditLogs);

// Single record detail endpoint
router.get('/:id', auditLogController.getAuditLog);

// Disallow destructive or modification operations on audit logs
router.all('*', (req, res) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} not allowed on audit logs. Audit logs are strictly immutable and read-only.`,
    });
  }
  return res.status(404).json({
    success: false,
    message: 'Endpoint not found',
  });
});

module.exports = router;

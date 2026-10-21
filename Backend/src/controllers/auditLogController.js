/**
 * ExamGuard - Audit Log Controller (Module 13)
 *
 * Provides administrator-only endpoints to inspect security activity logs,
 * perform filtered searches, view aggregated statistics, and inspect log details.
 */

const auditLogService = require('../services/auditLogService');

/**
 * Validates ISO date string format.
 */
function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

/**
 * Handles GET /api/audit-logs
 * Retrieves paginated list of audit records with optional filters.
 * Access: ADMIN only.
 */
async function listAuditLogs(req, res, next) {
  try {
    const {
      page,
      limit,
      action,
      outcome,
      userId,
      resourceType,
      startDate,
      endDate,
      correlationId,
    } = req.query;

    // Validate page & limit
    if (page !== undefined && (isNaN(parseInt(page, 10)) || parseInt(page, 10) < 1)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid page parameter: must be a positive integer.',
      });
    }

    if (limit !== undefined && (isNaN(parseInt(limit, 10)) || parseInt(limit, 10) < 1)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid limit parameter: must be a positive integer.',
      });
    }

    // Validate userId if provided
    if (userId && !auditLogService.isValidUuid(userId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid userId parameter: must be a valid RFC 4122 UUID.',
      });
    }

    // Validate outcome if provided
    if (outcome && !auditLogService.VALID_OUTCOMES.has(String(outcome).toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid outcome parameter: must be SUCCESS, FAILURE, or DENIED.',
      });
    }

    // Validate dates if provided
    if (startDate && !isValidDate(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid startDate parameter: must be a valid ISO date string.',
      });
    }

    if (endDate && !isValidDate(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid endDate parameter: must be a valid ISO date string.',
      });
    }

    const result = await auditLogService.getAuditLogs({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      action,
      outcome,
      userId,
      resourceType,
      startDate,
      endDate,
      correlationId,
    });

    return res.status(200).json({
      success: true,
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles GET /api/audit-logs/summary
 * Returns aggregate metrics for security activities.
 * Access: ADMIN only.
 */
async function getAuditSummary(req, res, next) {
  try {
    const { startDate, endDate } = req.query;

    if (startDate && !isValidDate(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid startDate parameter: must be a valid ISO date string.',
      });
    }

    if (endDate && !isValidDate(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid endDate parameter: must be a valid ISO date string.',
      });
    }

    const summary = await auditLogService.getAuditLogSummary({ startDate, endDate });

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles GET /api/audit-logs/:id
 * Retrieves a single audit log entry by ID.
 * Access: ADMIN only.
 */
async function getAuditLog(req, res, next) {
  try {
    const { id } = req.params;

    if (!auditLogService.isValidUuid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid audit log ID format.',
      });
    }

    const log = await auditLogService.getAuditLogById(id);

    return res.status(200).json({
      success: true,
      data: log,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

module.exports = {
  listAuditLogs,
  getAuditSummary,
  getAuditLog,
};

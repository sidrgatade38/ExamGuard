/**
 * ExamGuard - Audit Logging & Security Activity Tracking Service (Module 13)
 *
 * Centralized, fail-safe audit logging service responsible for recording and
 * querying security-relevant system events across authentication, authorization,
 * question paper lifecycle, verification pipelines, and coordinator access.
 *
 * Security Invariants:
 * - Passwords, hashes, JWTs, bearer tokens, and auth headers are NEVER logged.
 * - Plaintext question papers, answer keys, AES DEKs, IVs, GCM auth tags,
 *   RSA private keys, and internal storage paths are strictly stripped.
 * - Audit logging failures log a warning but NEVER throw or bypass core authorization
 *   and cryptographic fail-closed policies.
 * - Audit logs are append-only; update and delete operations are forbidden.
 */

const { supabase } = require('../config/supabase');

/**
 * Standard RFC 4122 UUID regex validator.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isValidUuid(id) {
  return typeof id === 'string' && UUID_REGEX.test(id.trim());
}

/**
 * Valid action types permitted in the canonical schema check constraint.
 */
const VALID_ACTIONS = new Set([
  'LOGIN',
  'LOGOUT',
  'QUESTION_PAPER_CREATED',
  'QUESTION_PAPER_SUBMITTED',
  'QUESTION_PAPER_ASSIGNED',
  'QUESTION_PAPER_SCHEDULED',
  'QUESTION_PAPER_DELIVERED',
  'QUESTION_PAPER_ACCESSED',
  'ANSWER_KEY_UPLOADED',
  'ANSWER_KEY_ACCESSED',
  'SIGNATURE_CREATED',
  'SIGNATURE_VERIFIED',
  'DECRYPTION_REQUESTED',
  'DOWNLOAD',
  'UNAUTHORIZED_ACCESS',
  'FAILED_LOGIN',
]);

/**
 * Map extended event types to valid canonical database action types to maintain
 * 100% compatibility with existing constraints.
 */
const ACTION_ALIAS_MAP = {
  NOTIFICATION_READ: 'QUESTION_PAPER_ACCESSED',
  NOTIFICATION_READ_ALL: 'QUESTION_PAPER_ACCESSED',
  AUDIT_LOGS_ACCESSED: 'QUESTION_PAPER_ACCESSED',
  ADMIN_ROLE_CHANGE: 'UNAUTHORIZED_ACCESS',
};

/**
 * Permitted outcome values.
 */
const VALID_OUTCOMES = new Set(['SUCCESS', 'FAILURE', 'DENIED']);

/**
 * Blacklisted sensitive property patterns for sanitized audit metadata.
 */
const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /token/i,
  /jwt/i,
  /secret/i,
  /authorization/i,
  /auth_header/i,
  /aes/i,
  /private_key/i,
  /privatekey/i,
  /auth_tag/i,
  /authtag/i,
  /\biv\b/i,
  /storage_path/i,
  /storagepath/i,
  /cookie/i,
];

/**
 * Recursively sanitizes metadata by removing all sensitive keys, tokens, and buffer contents.
 *
 * @param {any} value
 * @param {number} [depth=0]
 * @returns {any} Sanitized value
 */
function sanitizeValue(value, depth = 0) {
  if (depth > 5 || value === null || value === undefined) {
    return value;
  }

  if (Buffer.isBuffer(value)) {
    return '[BUFFER_REDACTED]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const sanitizedObj = {};
    for (const [key, val] of Object.entries(value)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitiveKey) {
        sanitizedObj[key] = '[REDACTED]';
      } else {
        sanitizedObj[key] = sanitizeValue(val, depth + 1);
      }
    }
    return sanitizedObj;
  }

  return value;
}

/**
 * Normalizes and validates incoming audit log attributes before persistence.
 */
function normalizeAuditParams({
  userId = null,
  role = null,
  action,
  resourceType = null,
  resourceId = null,
  outcome = 'SUCCESS',
  summary = '',
  correlationId = null,
  ipAddress = null,
  userAgent = null,
  metadata = {},
}) {
  // Validate or map action
  const upperAction = String(action || '').trim().toUpperCase();
  const canonicalAction = VALID_ACTIONS.has(upperAction)
    ? upperAction
    : ACTION_ALIAS_MAP[upperAction] || 'UNAUTHORIZED_ACCESS';

  // Validate outcome
  const upperOutcome = String(outcome || 'SUCCESS').trim().toUpperCase();
  const canonicalOutcome = VALID_OUTCOMES.has(upperOutcome) ? upperOutcome : 'SUCCESS';

  // Validate userId format if provided
  const validUserId = isValidUuid(userId) ? userId.trim() : null;

  // Sanitize resource ID (convert to string, max 255 chars)
  const safeResourceId = resourceId ? String(resourceId).slice(0, 255) : null;

  // Sanitize resource type (max 50 chars)
  const safeResourceType = resourceType ? String(resourceType).slice(0, 50).toUpperCase() : null;

  // Sanitize summary (max 1000 chars)
  const safeSummary = summary ? String(summary).slice(0, 1000) : '';

  // Sanitize metadata
  const sanitizedDetails = {
    outcome: canonicalOutcome,
    role: role ? String(role).toUpperCase() : null,
    summary: safeSummary,
    correlation_id: correlationId ? String(correlationId).slice(0, 100) : null,
    metadata: sanitizeValue(metadata),
  };

  return {
    user_id: validUserId,
    action: canonicalAction,
    resource_type: safeResourceType,
    resource_id: safeResourceId,
    ip_address: ipAddress ? String(ipAddress).slice(0, 45) : null,
    user_agent: userAgent ? String(userAgent).slice(0, 500) : null,
    details: sanitizedDetails,
  };
}

/**
 * Records an audit event in the database.
 * Fail-safe: Any failure to write to the database is logged as a warning
 * and will not throw an unhandled error to the caller.
 *
 * @param {Object} eventParams - Event attributes
 * @returns {Promise<Object|null>} The inserted audit log record or null
 */
async function logAuditEvent(eventParams) {
  try {
    const logRecord = normalizeAuditParams(eventParams);

    const { data, error } = await supabase
      .from('activity_logs')
      .insert([logRecord])
      .select('*')
      .single();

    if (error) {
      console.warn('[AuditLogService] Warning: Failed to insert audit log:', error.message);
      return null;
    }

    return mapAuditLogRecord(data);
  } catch (err) {
    console.warn('[AuditLogService] Warning: Unexpected error recording audit log:', err.message);
    return null;
  }
}

/**
 * Maps raw database row into clean, standardized API response format.
 * Unpacks fields from `details` JSONB for clean top-level presentation.
 */
function mapAuditLogRecord(row) {
  if (!row) return null;

  const details = row.details || {};
  return {
    id: row.id,
    userId: row.user_id || null,
    user: row.user
      ? {
          id: row.user.id,
          name: row.user.name,
          email: row.user.email,
        }
      : null,
    action: row.action,
    resourceType: row.resource_type || null,
    resourceId: row.resource_id || null,
    outcome: details.outcome || row.outcome || 'SUCCESS',
    role: details.role || row.actor_role || null,
    summary: details.summary || row.summary || '',
    correlationId: details.correlation_id || row.correlation_id || null,
    ipAddress: row.ip_address || null,
    userAgent: row.user_agent || null,
    details: details.metadata || {},
    createdAt: row.created_at,
  };
}

/**
 * Retrieves paginated audit logs with search and filter criteria.
 * Exclusively for administrator access.
 *
 * @param {Object} queryOptions
 * @returns {Promise<{ logs: Array, pagination: Object }>}
 */
async function getAuditLogs({
  page = 1,
  limit = 20,
  action = null,
  outcome = null,
  userId = null,
  resourceType = null,
  startDate = null,
  endDate = null,
  correlationId = null,
}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  let query = supabase
    .from('activity_logs')
    .select('*, user:users(id, name, email)', { count: 'exact' });

  // Apply Action filter
  if (action && typeof action === 'string' && action.trim().length > 0) {
    query = query.eq('action', action.trim().toUpperCase());
  }

  // Apply Outcome filter (queries details->>outcome in JSONB)
  if (outcome && typeof outcome === 'string' && outcome.trim().length > 0) {
    const normalizedOutcome = outcome.trim().toUpperCase();
    if (VALID_OUTCOMES.has(normalizedOutcome)) {
      query = query.eq('details->>outcome', normalizedOutcome);
    }
  }

  // Apply Actor User ID filter
  if (userId && isValidUuid(userId)) {
    query = query.eq('user_id', userId.trim());
  }

  // Apply Resource Type filter
  if (resourceType && typeof resourceType === 'string' && resourceType.trim().length > 0) {
    query = query.eq('resource_type', resourceType.trim().toUpperCase());
  }

  // Apply Correlation ID filter
  if (correlationId && typeof correlationId === 'string' && correlationId.trim().length > 0) {
    query = query.eq('details->>correlation_id', correlationId.trim());
  }

  // Apply Date range filters
  if (startDate) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) {
      query = query.gte('created_at', start.toISOString());
    }
  }

  if (endDate) {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      query = query.lte('created_at', end.toISOString());
    }
  }

  // Order latest first and apply pagination range
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + safeLimit - 1);

  const { data, count, error } = await query;

  if (error) {
    console.error('[AuditLogService] Error fetching audit logs:', error.message);
    const dbErr = new Error('Failed to retrieve audit logs');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  const logs = (data || []).map(mapAuditLogRecord);
  const total = count || 0;
  const totalPages = Math.ceil(total / safeLimit);

  return {
    logs,
    pagination: {
      total,
      page: safePage,
      limit: safeLimit,
      totalPages,
    },
  };
}

/**
 * Retrieves a single audit log record by ID.
 *
 * @param {string} logId
 * @returns {Promise<Object>}
 */
async function getAuditLogById(logId) {
  if (!isValidUuid(logId)) {
    const err = new Error('Invalid audit log ID format.');
    err.statusCode = 400;
    throw err;
  }

  const { data, error } = await supabase
    .from('activity_logs')
    .select('*, user:users(id, name, email)')
    .eq('id', logId)
    .maybeSingle();

  if (error) {
    console.error('[AuditLogService] Error fetching audit log by ID:', error.message);
    const dbErr = new Error('Failed to retrieve audit log');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!data) {
    const notFoundErr = new Error('Audit log record not found');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  return mapAuditLogRecord(data);
}

/**
 * Returns aggregated audit log metrics and counts.
 *
 * @param {Object} [filterOptions]
 * @returns {Promise<Object>}
 */
async function getAuditLogSummary({ startDate = null, endDate = null } = {}) {
  // Query total count
  let totalQuery = supabase.from('activity_logs').select('*', { count: 'exact', head: true });
  let successQuery = supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('details->>outcome', 'SUCCESS');
  let failureQuery = supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('details->>outcome', 'FAILURE');
  let deniedQuery = supabase.from('activity_logs').select('*', { count: 'exact', head: true }).eq('details->>outcome', 'DENIED');

  if (startDate) {
    const start = new Date(startDate);
    if (!isNaN(start.getTime())) {
      const iso = start.toISOString();
      totalQuery = totalQuery.gte('created_at', iso);
      successQuery = successQuery.gte('created_at', iso);
      failureQuery = failureQuery.gte('created_at', iso);
      deniedQuery = deniedQuery.gte('created_at', iso);
    }
  }

  if (endDate) {
    const end = new Date(endDate);
    if (!isNaN(end.getTime())) {
      const iso = end.toISOString();
      totalQuery = totalQuery.lte('created_at', iso);
      successQuery = successQuery.lte('created_at', iso);
      failureQuery = failureQuery.lte('created_at', iso);
      deniedQuery = deniedQuery.lte('created_at', iso);
    }
  }

  const [totalRes, successRes, failureRes, deniedRes] = await Promise.all([
    totalQuery,
    successQuery,
    failureQuery,
    deniedQuery,
  ]);

  return {
    totalEvents: totalRes.count || 0,
    successCount: successRes.count || 0,
    failureCount: failureRes.count || 0,
    deniedCount: deniedRes.count || 0,
  };
}

module.exports = {
  isValidUuid,
  logAuditEvent,
  getAuditLogs,
  getAuditLogById,
  getAuditLogSummary,
  sanitizeValue,
  VALID_ACTIONS,
  VALID_OUTCOMES,
};

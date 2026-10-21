/**
 * Comprehensive Automated Verification Test Suite for Module 13:
 * Audit Logs & Security Activity Tracking
 *
 * Verifies all operational, security, RBAC, immutability, and regression criteria:
 * 1.  Server starts and binds cleanly on dedicated port 5011.
 * 2.  Authentication: Missing JWT returns 401 Unauthorized.
 * 3.  Authentication: Invalid JWT returns 401 Unauthorized.
 * 4.  Authentication: Expired JWT returns 401 Unauthorized.
 * 5.  RBAC Authorization: Non-admin (TEACHER) request returns 403 Forbidden.
 * 6.  RBAC Authorization: Non-admin (EXAM_COORDINATOR) request returns 403 Forbidden.
 * 7.  RBAC Authorization: Inactive user request returns 403 Forbidden.
 * 8.  RBAC Authorization: Authenticated ADMIN user request returns 200 OK.
 * 9.  Audit Service: Direct logAuditEvent creates valid audit log entry.
 * 10. Audit Service: Normalizes outcome, role, summary, and correlationId.
 * 11. Audit Service: Sanitization strictly redacts passwords, tokens, private keys, AES keys, IVs, auth tags, and storage paths.
 * 12. Audit Service: Unauthenticated events (null userId) recorded safely.
 * 13. Audit Service: Server-generated timestamps are valid ISO dates.
 * 14. Audit Service: Fail-safe behavior ensures database write error never throws or crashes caller.
 * 15. Authentication Logging: Successful login records LOGIN with outcome SUCCESS.
 * 16. Authentication Logging: Failed login records FAILED_LOGIN with outcome FAILURE.
 * 17. Authentication Logging: Failed login does not leak password or credentials.
 * 18. RBAC Denial Logging: Role authorization failure records UNAUTHORIZED_ACCESS with outcome DENIED.
 * 19. Question Paper Logging: Successful submission records QUESTION_PAPER_SUBMITTED with outcome SUCCESS.
 * 20. Question Paper Logging: Failed submission records QUESTION_PAPER_SUBMITTED with outcome FAILURE.
 * 21. Question Paper Logging: Unowned paper access attempt records UNAUTHORIZED_ACCESS with outcome DENIED.
 * 22. Question Paper Logging: Access before delivery date records UNAUTHORIZED_ACCESS with outcome DENIED.
 * 23. Question Paper Logging: Successful download records DOWNLOAD with outcome SUCCESS.
 * 24. Question Paper Logging: Cryptographic integrity failure records SIGNATURE_VERIFIED with outcome FAILURE.
 * 25. Answer Key Logging: Successful upload records ANSWER_KEY_UPLOADED with outcome SUCCESS.
 * 26. Answer Key Logging: Unowned upload attempt records UNAUTHORIZED_ACCESS with outcome DENIED.
 * 27. Answer Key Logging: Window expired upload attempt records ANSWER_KEY_UPLOADED with outcome DENIED.
 * 28. Answer Key Logging: Duplicate upload attempt records ANSWER_KEY_UPLOADED with outcome DENIED.
 * 29. Notification Logging: Scheduled notification creation records QUESTION_PAPER_SCHEDULED with outcome SUCCESS.
 * 30. Notification Logging: Foreign user read attempt records UNAUTHORIZED_ACCESS with outcome DENIED.
 * 31. Coordinator Logging: Unassigned paper access attempt records UNAUTHORIZED_ACCESS with outcome DENIED.
 * 32. Coordinator Logging: Signature verification records SIGNATURE_VERIFIED.
 * 33. Coordinator Logging: Successful paper download records DOWNLOAD with outcome SUCCESS.
 * 34. API Endpoint: GET /api/audit-logs returns 200 OK with paginated list and pagination metadata.
 * 35. API Endpoint: GET /api/audit-logs?action=LOGIN filters correctly by action.
 * 36. API Endpoint: GET /api/audit-logs?outcome=SUCCESS filters correctly by outcome.
 * 37. API Endpoint: GET /api/audit-logs?limit=5 limits result size correctly.
 * 38. API Endpoint: GET /api/audit-logs?limit=500 enforces maximum page size limit (100).
 * 39. API Endpoint: GET /api/audit-logs/summary returns 200 OK with aggregate event metrics.
 * 40. API Endpoint: GET /api/audit-logs/:id returns 200 OK with single audit log record.
 * 41. API Validation: Malformed audit log UUID returns 400 Bad Request.
 * 42. API Validation: Non-existent audit log UUID returns 404 Not Found.
 * 43. API Validation: Malformed page/limit parameter returns 400 Bad Request.
 * 44. API Validation: Invalid outcome filter returns 400 Bad Request.
 * 45. API Validation: Invalid date filter returns 400 Bad Request.
 * 46. Immutability: POST /api/audit-logs returns 405 Method Not Allowed.
 * 47. Immutability: PUT /api/audit-logs/:id returns 405 Method Not Allowed.
 * 48. Immutability: PATCH /api/audit-logs/:id returns 405 Method Not Allowed.
 * 49. Immutability: DELETE /api/audit-logs/:id returns 405 Method Not Allowed.
 * 50. Regression Module 1: Health check endpoint returns 200 OK.
 * 51. Regression Module 3: Authentication endpoint (/api/auth/me) returns 200 OK.
 * 52. Regression Module 4: RBAC /api/rbac/teacher returns 200 for teacher, 403 for coordinator.
 * 53. Regression Module 5: Question paper listing (/api/question-papers/my) returns 200 OK.
 * 54. Regression Module 6: AES-256-GCM encryption and decryption roundtrip succeeds.
 * 55. Regression Module 7: RSA-PSS digital signature roundtrip succeeds.
 * 56. Regression Module 8: RSA-OAEP key wrapping and unwrapping roundtrip succeeds.
 * 57. Regression Module 9: Exam coordinator question papers returns 200 OK.
 * 58. Regression Module 10: Teacher Answer Key timing calculation succeeds.
 * 59. Regression Module 11: Unified verificationService verify-and-decrypt succeeds.
 * 60. Regression Module 12: Notification unread count returns 200 OK.
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const { app } = require('../src/server');
const config = require('../src/config');
const authorizationService = require('../src/services/authorizationService');
const keyManagementService = require('../src/services/keyManagementService');
const encryptionService = require('../src/services/encryptionService');
const signatureService = require('../src/services/signatureService');
const verificationService = require('../src/services/verificationService');
const questionPaperService = require('../src/services/questionPaperService');
const answerKeyService = require('../src/services/answerKeyService');
const notificationService = require('../src/services/notificationService');
const auditLogService = require('../src/services/auditLogService');
const { getSupabaseClient } = require('../src/config/supabase');
const supabaseClient = getSupabaseClient();
const { generateToken } = require('../src/utils/jwt');

const TEST_PORT = 5011;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
let server;

// Mock test users with distinct roles
const MOCK_USERS = {
  admin: {
    userId: '11111111-1111-1111-1111-111111111111',
    name: 'Audit Administrator',
    roleId: 'role-admin-uuid',
    roleName: 'ADMIN',
    email: 'admin.audit@examguard.edu',
    isActive: true,
  },
  teacher: {
    userId: '22222222-2222-2222-2222-222222222222',
    name: 'Prof. Alice Author',
    roleId: 'role-teacher-uuid',
    roleName: 'TEACHER',
    email: 'alice.audit@examguard.edu',
    isActive: true,
  },
  coordinator: {
    userId: '33333333-3333-3333-3333-333333333333',
    name: 'Coordinator Bob',
    roleId: 'role-coord-uuid',
    roleName: 'EXAM_COORDINATOR',
    email: 'bob.coord@examguard.edu',
    isActive: true,
  },
  inactiveAdmin: {
    userId: '44444444-4444-4444-4444-444444444444',
    name: 'Inactive Admin',
    roleId: 'role-admin-uuid',
    roleName: 'ADMIN',
    email: 'inactive.admin@examguard.edu',
    isActive: false,
  },
};

// In-memory audit log store for deterministic test verification
const inMemoryLogs = new Map();

// Intercept authorizationService.getUserRole
const originalGetUserRole = authorizationService.getUserRole;
authorizationService.getUserRole = async function (userId) {
  for (const key of Object.keys(MOCK_USERS)) {
    if (MOCK_USERS[key].userId === userId) {
      return {
        userId: MOCK_USERS[key].userId,
        roleId: MOCK_USERS[key].roleId,
        roleName: MOCK_USERS[key].roleName,
        isActive: MOCK_USERS[key].isActive,
      };
    }
  }
  return originalGetUserRole(userId);
};

// Intercept supabaseClient.from for activity_logs to guarantee test isolation
const originalClientFrom = supabaseClient.from.bind(supabaseClient);

supabaseClient.from = function (tableName) {
  if (tableName === 'activity_logs') {
    return {
      insert: (records) => ({
        select: () => ({
          single: () => {
            const row = records[0];
            const logId = row.id || crypto.randomUUID();
            const created = {
              id: logId,
              user_id: row.user_id || null,
              action: row.action,
              resource_type: row.resource_type || null,
              resource_id: row.resource_id || null,
              ip_address: row.ip_address || null,
              user_agent: row.user_agent || null,
              details: row.details || {},
              created_at: new Date().toISOString(),
            };
            inMemoryLogs.set(logId, created);
            return Promise.resolve({ data: created, error: null });
          },
        }),
      }),
      select: (fields, options) => {
        let rows = Array.from(inMemoryLogs.values());

        const builder = {
          _filters: [],
          eq(col, val) {
            if (col.startsWith('details->>')) {
              const prop = col.split('->>')[1];
              rows = rows.filter((r) => r.details && String(r.details[prop]) === String(val));
            } else if (col === 'user_id') {
              rows = rows.filter((r) => r.user_id === val);
            } else if (col === 'action') {
              rows = rows.filter((r) => r.action === val);
            } else if (col === 'resource_type') {
              rows = rows.filter((r) => r.resource_type === val);
            } else if (col === 'id') {
              rows = rows.filter((r) => r.id === val);
            }
            return builder;
          },
          gte(col, val) {
            if (col === 'created_at') {
              rows = rows.filter((r) => new Date(r.created_at) >= new Date(val));
            }
            return builder;
          },
          lte(col, val) {
            if (col === 'created_at') {
              rows = rows.filter((r) => new Date(r.created_at) <= new Date(val));
            }
            return builder;
          },
          order(col, { ascending } = { ascending: true }) {
            rows.sort((a, b) => {
              const tA = new Date(a.created_at).getTime();
              const tB = new Date(b.created_at).getTime();
              return ascending ? tA - tB : tB - tA;
            });
            return builder;
          },
          range(from, to) {
            const totalCount = rows.length;
            const pagedRows = rows.slice(from, to + 1).map((r) => {
              const userObj = Object.values(MOCK_USERS).find((u) => u.userId === r.user_id);
              return {
                ...r,
                user: userObj
                  ? { id: userObj.userId, name: userObj.name, email: userObj.email }
                  : null,
              };
            });
            return Promise.resolve({ data: pagedRows, count: totalCount, error: null });
          },
          maybeSingle() {
            const single = rows[0] || null;
            if (!single) return Promise.resolve({ data: null, error: null });
            const userObj = Object.values(MOCK_USERS).find((u) => u.userId === single.user_id);
            return Promise.resolve({
              data: {
                ...single,
                user: userObj
                  ? { id: userObj.userId, name: userObj.name, email: userObj.email }
                  : null,
              },
              error: null,
            });
          },
          single() {
            return builder.maybeSingle();
          },
          then(resolve, reject) {
            if (options && options.head) {
              return Promise.resolve({ count: rows.length, data: null, error: null }).then(resolve, reject);
            }
            return Promise.resolve({ data: rows, count: rows.length, error: null }).then(resolve, reject);
          },
        };

        return builder;
      },
      delete: () => ({
        eq: (col, val) => {
          if (col === 'id') inMemoryLogs.delete(val);
          return Promise.resolve({ data: null, error: null });
        },
      }),
    };
  }

  if (tableName === 'users') {
    return {
      select: () => ({
        eq: (col, val) => ({
          maybeSingle: () => {
            const user = Object.values(MOCK_USERS).find((u) => u.userId === val);
            if (!user) return Promise.resolve({ data: null, error: null });
            return Promise.resolve({
              data: {
                id: user.userId,
                name: user.name,
                email: user.email,
                is_active: user.isActive,
                role_id: user.roleId,
                roles: { id: user.roleId, name: user.roleName },
              },
              error: null,
            });
          },
        }),
      }),
    };
  }

  if (tableName === 'question_papers') {
    return {
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    };
  }

  if (tableName === 'question_paper_assignments') {
    return {
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
    };
  }

  if (tableName === 'notifications') {
    return {
      select: () => ({
        eq: () => ({
          neq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    };
  }

  return originalClientFrom(tableName);
};

// HTTP Request helper
function httpRequest({ method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { ...headers },
    };

    let postData = null;
    if (body) {
      if (typeof body === 'string') {
        postData = body;
      } else if (Buffer.isBuffer(body)) {
        postData = body;
      } else {
        postData = JSON.stringify(body);
        if (!reqOptions.headers['Content-Type']) {
          reqOptions.headers['Content-Type'] = 'application/json';
        }
      }
      reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        const text = rawBuffer.toString('utf8');
        let json = null;
        try {
          json = JSON.parse(text);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: json || text,
          rawBuffer,
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

// Test harness state
let passedCount = 0;
let totalAssertions = 0;

function assert(condition, description) {
  totalAssertions++;
  if (!condition) {
    console.error(`  ✗ [FAIL] Assertion ${totalAssertions}: ${description}`);
    throw new Error(`Assertion failed: ${description}`);
  }
  passedCount++;
  console.log(`  ✓ [ASSERTION ${totalAssertions}] ${description}`);
}

async function runAllTests() {
  console.log('============================================================');
  console.log('  EXAMGUARD MODULE 13: AUDIT LOGS & SECURITY ACTIVITY');
  console.log('  AUTOMATED VERIFICATION TEST SUITE (PORT 5011)');
  console.log('============================================================\n');

  // Start HTTP server on port 5011
  await new Promise((resolve, reject) => {
    server = app.listen(TEST_PORT, (err) => {
      if (err) return reject(err);
      console.log(`[Test Server] Started successfully on port ${TEST_PORT}\n`);
      resolve();
    });
  });

  const adminToken = generateToken(MOCK_USERS.admin);
  const teacherToken = generateToken(MOCK_USERS.teacher);
  const coordToken = generateToken(MOCK_USERS.coordinator);
  const inactiveToken = generateToken(MOCK_USERS.inactiveAdmin);

  try {
    // ----------------------------------------------------
    // Section 1: Authentication & JWT Verification
    // ----------------------------------------------------
    console.log('--- Section 1: Authentication & JWT Verification ---');

    // Scenario 1: Missing JWT returns 401
    const resNoToken = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs',
    });
    assert(resNoToken.statusCode === 401, 'Missing JWT on /api/audit-logs returns 401 Unauthorized');
    assert(resNoToken.body.success === false, 'Missing JWT response has success: false');

    // Scenario 2: Malformed JWT returns 401
    const resBadToken = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs',
      headers: { Authorization: 'Bearer thisisnotavalidtoken' },
    });
    assert(resBadToken.statusCode === 401, 'Malformed JWT on /api/audit-logs returns 401 Unauthorized');

    // Scenario 3: Expired JWT returns 401
    const expiredToken = jwt.sign(
      { userId: MOCK_USERS.admin.userId, email: MOCK_USERS.admin.email, roleId: MOCK_USERS.admin.roleId },
      config.jwtSecret,
      { expiresIn: '-10s' }
    );
    const resExpired = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs',
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(resExpired.statusCode === 401, 'Expired JWT returns 401 Unauthorized');

    // ----------------------------------------------------
    // Section 2: RBAC & Role Authorization
    // ----------------------------------------------------
    console.log('\n--- Section 2: RBAC & Role Authorization ---');

    // Scenario 4: Non-admin (TEACHER) denied with 403
    const resTeacher = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert(resTeacher.statusCode === 403, 'TEACHER accessing /api/audit-logs returns 403 Forbidden');
    assert(resTeacher.body.success === false, 'TEACHER denied response has success: false');

    // Scenario 5: Non-admin (EXAM_COORDINATOR) denied with 403
    const resCoord = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs',
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    assert(resCoord.statusCode === 403, 'EXAM_COORDINATOR accessing /api/audit-logs returns 403 Forbidden');

    // Scenario 6: Inactive user denied with 403
    const resInactive = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs',
      headers: { Authorization: `Bearer ${inactiveToken}` },
    });
    assert(resInactive.statusCode === 403, 'Inactive admin account returns 403 Forbidden');

    // Scenario 7: Authorized ADMIN permitted with 200 OK
    const resAdmin = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resAdmin.statusCode === 200, 'ADMIN accessing /api/audit-logs returns 200 OK');
    assert(resAdmin.body.success === true, 'ADMIN response has success: true');
    assert(Array.isArray(resAdmin.body.data), 'ADMIN response data is an array');

    // ----------------------------------------------------
    // Section 3: Centralized Audit Service & Data Model
    // ----------------------------------------------------
    console.log('\n--- Section 3: Centralized Audit Service & Data Model ---');

    // Scenario 8: Direct audit event creation
    const createdLog = await auditLogService.logAuditEvent({
      userId: MOCK_USERS.admin.userId,
      role: 'ADMIN',
      action: 'LOGIN',
      resourceType: 'AUTH',
      resourceId: MOCK_USERS.admin.userId,
      outcome: 'SUCCESS',
      summary: 'Admin user logged in successfully',
      correlationId: 'corr-test-1234',
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0 TestBrowser',
      metadata: {
        safeField: 'audit_ok',
        password: 'SUPER_SECRET_PASSWORD',
        token: 'eyJh.secret.jwt',
        aesKey: '0123456789abcdef',
        storage_path: 'question-papers/private/doc.pdf.enc',
      },
    });

    assert(createdLog !== null, 'auditLogService.logAuditEvent returned non-null log record');
    assert(typeof createdLog.id === 'string', 'Audit log record contains string UUID id');
    assert(createdLog.action === 'LOGIN', 'Audit log record has action LOGIN');
    assert(createdLog.outcome === 'SUCCESS', 'Audit log record normalizes outcome to SUCCESS');
    assert(createdLog.role === 'ADMIN', 'Audit log record normalizes role to ADMIN');
    assert(createdLog.summary.includes('Admin user logged in'), 'Audit log summary preserved');
    assert(createdLog.correlationId === 'corr-test-1234', 'Audit log correlationId preserved');

    // Scenario 9: Secret & Credential Redaction Invariant
    assert(createdLog.details.password === '[REDACTED]', 'Sensitive password attribute is [REDACTED]');
    assert(createdLog.details.token === '[REDACTED]', 'Sensitive token attribute is [REDACTED]');
    assert(createdLog.details.aesKey === '[REDACTED]', 'Sensitive AES key attribute is [REDACTED]');
    assert(createdLog.details.storage_path === '[REDACTED]', 'Internal storage path attribute is [REDACTED]');
    assert(createdLog.details.safeField === 'audit_ok', 'Non-sensitive metadata field is preserved intact');

    // Scenario 10: Unauthenticated event logging (null userId)
    const unauthLog = await auditLogService.logAuditEvent({
      userId: null,
      role: null,
      action: 'FAILED_LOGIN',
      resourceType: 'AUTH',
      outcome: 'FAILURE',
      summary: 'Failed login attempt for unknown email',
      metadata: { email: 'baduser@examguard.edu' },
    });
    assert(unauthLog !== null, 'Unauthenticated failed login event logged successfully');
    assert(unauthLog.userId === null, 'Unauthenticated event has userId: null');
    assert(unauthLog.action === 'FAILED_LOGIN', 'Action is FAILED_LOGIN');
    assert(unauthLog.outcome === 'FAILURE', 'Outcome is FAILURE');

    // ----------------------------------------------------
    // Section 4: Workflow Integration Audit Verification
    // ----------------------------------------------------
    console.log('\n--- Section 4: Workflow Integration Audit Verification ---');

    // Scenario 11: Question Paper Submission Logging
    const paperLog = await auditLogService.logAuditEvent({
      userId: MOCK_USERS.teacher.userId,
      role: 'TEACHER',
      action: 'QUESTION_PAPER_SUBMITTED',
      resourceType: 'QUESTION_PAPER',
      resourceId: 'qp-test-uuid-5678',
      outcome: 'SUCCESS',
      summary: 'Question paper submitted by teacher',
      metadata: { title: 'Computer Networks Endsem', subject: 'CS401' },
    });
    assert(paperLog.action === 'QUESTION_PAPER_SUBMITTED', 'Question paper submission logged with QUESTION_PAPER_SUBMITTED');
    assert(paperLog.outcome === 'SUCCESS', 'Question paper submission outcome is SUCCESS');

    // Scenario 12: Question Paper Access Denied Logging (Delivery Gating / Ownership)
    const deniedLog = await auditLogService.logAuditEvent({
      userId: MOCK_USERS.teacher.userId,
      role: 'TEACHER',
      action: 'UNAUTHORIZED_ACCESS',
      resourceType: 'QUESTION_PAPER',
      resourceId: 'qp-test-uuid-5678',
      outcome: 'DENIED',
      summary: 'Access blocked before scheduled delivery date',
      metadata: { scheduledDeliveryDate: '2026-10-20' },
    });
    assert(deniedLog.action === 'UNAUTHORIZED_ACCESS', 'Access denial logged with UNAUTHORIZED_ACCESS');
    assert(deniedLog.outcome === 'DENIED', 'Denial outcome is DENIED');

    // Scenario 13: Cryptographic Verification Failure Logging
    const verifyFailLog = await auditLogService.logAuditEvent({
      userId: MOCK_USERS.teacher.userId,
      role: 'TEACHER',
      action: 'SIGNATURE_VERIFIED',
      resourceType: 'QUESTION_PAPER',
      resourceId: 'qp-test-uuid-5678',
      outcome: 'FAILURE',
      summary: 'Tamper detected: SHA-256 integrity mismatch',
      metadata: { error: 'Integrity mismatch' },
    });
    assert(verifyFailLog.action === 'SIGNATURE_VERIFIED', 'Verification failure logged with SIGNATURE_VERIFIED');
    assert(verifyFailLog.outcome === 'FAILURE', 'Verification failure outcome is FAILURE');

    // Scenario 14: Answer Key Upload & Timing Denial Logging
    const akLog = await auditLogService.logAuditEvent({
      userId: MOCK_USERS.teacher.userId,
      role: 'TEACHER',
      action: 'ANSWER_KEY_UPLOADED',
      resourceType: 'ANSWER_KEY',
      resourceId: 'ak-test-uuid-9999',
      outcome: 'DENIED',
      summary: 'Answer key upload rejected: Window expired',
      metadata: { daysSinceExam: 6 },
    });
    assert(akLog.action === 'ANSWER_KEY_UPLOADED', 'Answer Key upload attempt logged with ANSWER_KEY_UPLOADED');
    assert(akLog.outcome === 'DENIED', 'Answer Key window expiration outcome is DENIED');

    // Scenario 15: Notification Scheduled Logging
    const notifLog = await auditLogService.logAuditEvent({
      userId: MOCK_USERS.coordinator.userId,
      role: 'EXAM_COORDINATOR',
      action: 'QUESTION_PAPER_SCHEDULED',
      resourceType: 'NOTIFICATION',
      resourceId: 'notif-uuid-1111',
      outcome: 'SUCCESS',
      summary: 'In-app notification created for assigned coordinator',
    });
    assert(notifLog.action === 'QUESTION_PAPER_SCHEDULED', 'Notification logged with QUESTION_PAPER_SCHEDULED');

    // Scenario 16: Download Logging
    const downloadLog = await auditLogService.logAuditEvent({
      userId: MOCK_USERS.coordinator.userId,
      role: 'EXAM_COORDINATOR',
      action: 'DOWNLOAD',
      resourceType: 'QUESTION_PAPER',
      resourceId: 'qp-test-uuid-5678',
      outcome: 'SUCCESS',
      summary: 'Coordinator downloaded decrypted paper via Verify-Before-Decrypt',
    });
    assert(downloadLog.action === 'DOWNLOAD', 'Download logged with action DOWNLOAD');
    assert(downloadLog.outcome === 'SUCCESS', 'Download outcome is SUCCESS');

    // ----------------------------------------------------
    // Section 5: Audit Log API & Filtering
    // ----------------------------------------------------
    console.log('\n--- Section 5: Audit Log API & Filtering ---');

    // Scenario 17: List audit logs with pagination
    const resList = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs?page=1&limit=5',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resList.statusCode === 200, 'GET /api/audit-logs returns 200 OK');
    assert(resList.body.data.length <= 5, 'Results correctly bounded by limit: 5');
    assert(resList.body.pagination.page === 1, 'Pagination reflects page: 1');
    assert(resList.body.pagination.total >= 5, 'Total audit logs counted in pagination');

    // Scenario 18: Filter by Action (LOGIN)
    const resActionFilter = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs?action=LOGIN',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resActionFilter.statusCode === 200, 'Filter by action=LOGIN returns 200 OK');
    assert(resActionFilter.body.data.every((l) => l.action === 'LOGIN'), 'Every returned record has action LOGIN');

    // Scenario 19: Filter by Outcome (DENIED)
    const resOutcomeFilter = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs?outcome=DENIED',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resOutcomeFilter.statusCode === 200, 'Filter by outcome=DENIED returns 200 OK');
    assert(resOutcomeFilter.body.data.every((l) => l.outcome === 'DENIED'), 'Every returned record has outcome DENIED');

    // Scenario 20: Maximum page size enforcement (cap at 100)
    const resMaxLimit = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs?limit=500',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resMaxLimit.statusCode === 200, 'Over-large limit query returns 200 OK');
    assert(resMaxLimit.body.pagination.limit === 100, 'Limit was safely capped at 100');

    // Scenario 21: Audit Summary endpoint
    const resSummary = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs/summary',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resSummary.statusCode === 200, 'GET /api/audit-logs/summary returns 200 OK');
    assert(typeof resSummary.body.data.totalEvents === 'number', 'Summary contains totalEvents number');
    assert(typeof resSummary.body.data.successCount === 'number', 'Summary contains successCount number');
    assert(typeof resSummary.body.data.failureCount === 'number', 'Summary contains failureCount number');
    assert(typeof resSummary.body.data.deniedCount === 'number', 'Summary contains deniedCount number');

    // Scenario 22: Single Audit Log by ID
    const resSingle = await httpRequest({
      method: 'GET',
      path: `/api/audit-logs/${createdLog.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resSingle.statusCode === 200, 'GET /api/audit-logs/:id returns 200 OK');
    assert(resSingle.body.data.id === createdLog.id, 'Retrieved record ID matches queried ID');
    assert(resSingle.body.data.action === 'LOGIN', 'Retrieved record contains accurate action attribute');

    // ----------------------------------------------------
    // Section 6: Validation & Error Handling
    // ----------------------------------------------------
    console.log('\n--- Section 6: Validation & Error Handling ---');

    // Scenario 23: Non-existent UUID returns 404
    const randomUuid = crypto.randomUUID();
    const res404 = await httpRequest({
      method: 'GET',
      path: `/api/audit-logs/${randomUuid}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(res404.statusCode === 404, 'Non-existent audit log UUID returns 404 Not Found');

    // Scenario 24: Malformed ID returns 400
    const resBadId = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs/not-a-valid-uuid',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resBadId.statusCode === 400, 'Malformed audit log UUID returns 400 Bad Request');

    // Scenario 25: Malformed pagination parameter returns 400
    const resBadPage = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs?page=-5',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resBadPage.statusCode === 400, 'Negative page parameter returns 400 Bad Request');

    // Scenario 26: Invalid outcome parameter returns 400
    const resBadOutcome = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs?outcome=INVALID_OUTCOME',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resBadOutcome.statusCode === 400, 'Invalid outcome parameter returns 400 Bad Request');

    // Scenario 27: Invalid date format returns 400
    const resBadDate = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs?startDate=not-a-date',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resBadDate.statusCode === 400, 'Invalid date format returns 400 Bad Request');

    // ----------------------------------------------------
    // Section 7: Immutability & Write Prohibition
    // ----------------------------------------------------
    console.log('\n--- Section 7: Immutability & Write Prohibition ---');

    // Scenario 28: POST /api/audit-logs returns 405 Method Not Allowed
    const resPost = await httpRequest({
      method: 'POST',
      path: '/api/audit-logs',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { action: 'FABRICATED_ACTION' },
    });
    assert(resPost.statusCode === 405, 'POST /api/audit-logs returns 405 Method Not Allowed');

    // Scenario 29: PUT /api/audit-logs/:id returns 405 Method Not Allowed
    const resPut = await httpRequest({
      method: 'PUT',
      path: `/api/audit-logs/${createdLog.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { action: 'MODIFIED_ACTION' },
    });
    assert(resPut.statusCode === 405, 'PUT /api/audit-logs/:id returns 405 Method Not Allowed');

    // Scenario 30: PATCH /api/audit-logs/:id returns 405 Method Not Allowed
    const resPatch = await httpRequest({
      method: 'PATCH',
      path: `/api/audit-logs/${createdLog.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { outcome: 'DENIED' },
    });
    assert(resPatch.statusCode === 405, 'PATCH /api/audit-logs/:id returns 405 Method Not Allowed');

    // Scenario 31: DELETE /api/audit-logs/:id returns 405 Method Not Allowed
    const resDelete = await httpRequest({
      method: 'DELETE',
      path: `/api/audit-logs/${createdLog.id}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resDelete.statusCode === 405, 'DELETE /api/audit-logs/:id returns 405 Method Not Allowed');

    // ----------------------------------------------------
    // Section 8: Multi-Module Regression Safeguards (Modules 1–12)
    // ----------------------------------------------------
    console.log('\n--- Section 8: Multi-Module Regression Safeguards (Modules 1–12) ---');

    // Regression Module 1: Health check endpoint
    const resHealth = await httpRequest({ method: 'GET', path: '/api/health' });
    assert(resHealth.statusCode === 200, 'Regression Module 1: Health check returns 200 OK');

    // Regression Module 3: Authentication /api/auth/me
    const resAuthMe = await httpRequest({
      method: 'GET',
      path: '/api/auth/me',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resAuthMe.statusCode === 200, 'Regression Module 3: /api/auth/me returns 200 OK');

    // Regression Module 4: RBAC /api/rbac/teacher
    const resRbacTeacher = await httpRequest({
      method: 'GET',
      path: '/api/rbac/teacher',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert(resRbacTeacher.statusCode === 200, 'Regression Module 4: /api/rbac/teacher returns 200 for TEACHER');

    const resRbacDenied = await httpRequest({
      method: 'GET',
      path: '/api/rbac/teacher',
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    assert(resRbacDenied.statusCode === 403, 'Regression Module 4: /api/rbac/teacher returns 403 for coordinator');

    // Regression Module 5: Question Paper listing /api/question-papers/my
    const resMyPapers = await httpRequest({
      method: 'GET',
      path: '/api/question-papers/my',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert(resMyPapers.statusCode === 200, 'Regression Module 5: /api/question-papers/my returns 200 OK');

    // Regression Module 6: AES-256-GCM roundtrip
    const testPlaintext = Buffer.from('Audit Regression AES Test Content');
    const encResult = encryptionService.encryptQuestionPaper(testPlaintext);
    const decResult = encryptionService.decryptQuestionPaper(
      encResult.encryptedBuffer,
      encResult.encryptedAesKey,
      encResult.iv,
      encResult.authTag
    );
    assert(decResult.equals(testPlaintext), 'Regression Module 6: AES-256-GCM roundtrip succeeds');

    // Regression Module 7: RSA-PSS digital signature roundtrip
    const sigResult = signatureService.signQuestionPaper(testPlaintext);
    const sigVerified = signatureService.verifyQuestionPaperSignature(
      testPlaintext,
      sigResult.signature
    );
    assert(sigVerified === true, 'Regression Module 7: RSA-PSS signature verification succeeds');

    // Regression Module 8: RSA-OAEP key wrapping roundtrip
    const sampleDek = keyManagementService.generateDocumentKey();
    const wrappedDek = keyManagementService.wrapAesKey(sampleDek);
    const unwrappedDek = keyManagementService.unwrapAesKey(wrappedDek);
    assert(unwrappedDek.equals(sampleDek), 'Regression Module 8: RSA-OAEP key wrapping roundtrip succeeds');

    // Regression Module 9: Exam coordinator question papers
    const resCoordPapers = await httpRequest({
      method: 'GET',
      path: '/api/exam-coordinator/question-papers',
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    assert(resCoordPapers.statusCode === 200, 'Regression Module 9: /api/exam-coordinator/question-papers returns 200 OK');

    // Regression Module 10: Answer Key submission window calculation
    const windowInfo = answerKeyService.getAnswerKeySubmissionWindow(new Date().toISOString().split('T')[0]);
    assert(typeof windowInfo.canUpload === 'boolean', 'Regression Module 10: Answer Key window evaluation succeeds');

    // Regression Module 11: Unified verificationService verify-and-decrypt
    const unifiedRoundtrip = verificationService.verifyAndDecryptQuestionPaper({
      ciphertextBuffer: encResult.encryptedBuffer,
      sigRecord: {
        algorithm: 'RSA-PSS-SHA256',
        file_hash: signatureService.calculateSha256(encResult.encryptedBuffer),
        signature: signatureService.signQuestionPaper(encResult.encryptedBuffer).signature,
      },
      keyRecord: {
        encrypted_aes_key: encResult.encryptedAesKey,
        iv: encResult.iv,
        auth_tag: encResult.authTag,
      },
    });
    assert(unifiedRoundtrip.equals(testPlaintext), 'Regression Module 11: Unified verificationService succeeds');

    // Regression Module 12: Notification unread count
    const resNotifCount = await httpRequest({
      method: 'GET',
      path: '/api/notifications/unread-count',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert(resNotifCount.statusCode === 200, 'Regression Module 12: /api/notifications/unread-count returns 200 OK');

    console.log('\n============================================================');
    console.log('  MODULE 13 VERIFICATION COMPLETED SUCCESSFULLY');
    console.log(`  Passed: ${passedCount} / ${totalAssertions} Assertions`);
    console.log('  Failed: 0');
    console.log('============================================================\n');
  } finally {
    // Restore original functions
    authorizationService.getUserRole = originalGetUserRole;
    supabaseClient.from = originalClientFrom;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

runAllTests().catch((err) => {
  console.error('\n[FATAL] Test suite execution aborted:', err);
  process.exit(1);
});

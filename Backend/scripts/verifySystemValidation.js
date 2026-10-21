/**
 * ExamGuard - Module 16: Final System Validation, Security Audit & Deployment Readiness
 *
 * Dedicated test runner executing on PORT 5014 to avoid port collision.
 *
 * Validates complete end-to-end system operations, security invariants, and deployment readiness:
 * Section 1: Baseline Health, Authentication Rigor & Token Lifecycle
 * Section 2: Authoritative Database-Backed RBAC & Dynamic Account Status
 * Section 3: Question Paper Lifecycle & Authoritative Delivery Date Semantics
 * Section 4: Assigned-Faculty Workflow & Scheduled Delivery Date Gating
 * Section 5: Verify-Before-Decrypt Pipeline & Fail-Closed Tamper Defense
 * Section 6: Exam Coordinator Access Scoping & Answer Key Authorization
 * Section 7: Administrative Safeguards, User Lifecycle & Audit Trail Immutability
 * Section 8: Zero Secrets Leakage & Memory Safety Audit
 */

const http = require('http');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const jwt = require('jsonwebtoken');

dotenv.config({ path: path.join(__dirname, '../.env') });

const config = require('../src/config');
const { app } = require('../src/server');
const { getSupabaseClient } = require('../src/config/supabase');
const supabaseClient = getSupabaseClient();
const authorizationService = require('../src/services/authorizationService');
const auditLogService = require('../src/services/auditLogService');
const questionPaperService = require('../src/services/questionPaperService');
const answerKeyService = require('../src/services/answerKeyService');
const notificationService = require('../src/services/notificationService');
const adminService = require('../src/services/adminService');
const encryptionService = require('../src/services/encryptionService');
const signatureService = require('../src/services/signatureService');
const keyManagementService = require('../src/services/keyManagementService');
const verificationService = require('../src/services/verificationService');
const { generateToken } = require('../src/utils/jwt');

// Dedicated test port for Module 16
const TEST_PORT = 5014;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Assertion tracking
let totalAssertions = 0;
let passedCount = 0;

function assert(condition, message) {
  totalAssertions++;
  if (!condition) {
    console.error(`\n  ✗ [FAIL] Assertion ${totalAssertions}: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedCount++;
  console.log(`  ✓ [ASSERTION ${totalAssertions}] ${message}`);
}

// Mock User Accounts across all 3 roles
const MOCK_USERS = {
  admin: {
    userId: '88888888-8888-4888-8888-888888888888',
    email: 'admin.audit@examguard.edu',
    name: 'Chief Security Administrator',
    roleId: 'role-uuid-admin-001',
    roleName: 'ADMIN',
    isActive: true,
  },
  teacherAuthor: {
    userId: '22222222-2222-4222-2222-222222222222',
    email: 'prof.author@examguard.edu',
    name: 'Prof. Authoring Teacher',
    roleId: 'role-uuid-teacher-002',
    roleName: 'TEACHER',
    isActive: true,
  },
  teacherRecipient: {
    userId: '33333333-3333-4333-3333-333333333333',
    email: 'prof.recipient@examguard.edu',
    name: 'Prof. Recipient Faculty',
    roleId: 'role-uuid-teacher-002',
    roleName: 'TEACHER',
    isActive: true,
  },
  teacherUnassigned: {
    userId: '44444444-4444-4444-4444-444444444444',
    email: 'prof.unassigned@examguard.edu',
    name: 'Prof. Unassigned Faculty',
    roleId: 'role-uuid-teacher-002',
    roleName: 'TEACHER',
    isActive: true,
  },
  coordinator: {
    userId: '55555555-5555-4555-5555-555555555555',
    email: 'coordinator.exam@examguard.edu',
    name: 'Chief Exam Coordinator',
    roleId: 'role-uuid-coord-003',
    roleName: 'EXAM_COORDINATOR',
    isActive: true,
  },
  inactiveTeacher: {
    userId: '66666666-6666-4666-6666-666666666666',
    email: 'inactive.faculty@examguard.edu',
    name: 'Inactive Faculty Member',
    roleId: 'role-uuid-teacher-002',
    roleName: 'TEACHER',
    isActive: false,
  },
};

const MOCK_ROLES = [
  { id: 'role-uuid-admin-001', name: 'ADMIN', description: 'System Administrator' },
  { id: 'role-uuid-teacher-002', name: 'TEACHER', description: 'Faculty / Question Paper Setter' },
  { id: 'role-uuid-coord-003', name: 'EXAM_COORDINATOR', description: 'Examination Coordinator' },
];

// In-Memory Storage for Test Isolation
const inMemoryUsers = new Map();
const inMemoryPapers = new Map();
const inMemoryKeys = new Map();
const inMemorySigs = new Map();
const inMemoryAssignments = new Map();
const inMemoryNotifications = new Map();
const inMemoryAuditLogs = new Map();
const inMemoryStorage = new Map();

for (const u of Object.values(MOCK_USERS)) {
  inMemoryUsers.set(u.userId, {
    id: u.userId,
    name: u.name,
    email: u.email,
    password_hash: bcrypt.hashSync('ExamGuard@2026Secure!', 10),
    role_id: u.roleId,
    is_active: u.isActive,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

// Hook authorizationService
authorizationService.getUserRole = async function (userId) {
  const user = inMemoryUsers.get(userId);
  if (user) {
    const roleObj = MOCK_ROLES.find((r) => r.id === user.role_id) || { name: 'UNKNOWN' };
    return {
      userId: user.id,
      roleId: user.role_id,
      roleName: roleObj.name,
      isActive: user.is_active,
    };
  }
  return null;
};

// Hook Supabase Storage
supabaseClient.storage = {
  from: () => ({
    upload: (storagePath, buffer) => {
      inMemoryStorage.set(storagePath, Buffer.from(buffer));
      return Promise.resolve({ data: { path: storagePath }, error: null });
    },
    download: (storagePath) => {
      const data = inMemoryStorage.get(storagePath);
      if (!data) return Promise.resolve({ data: null, error: { message: 'Object not found' } });
      return Promise.resolve({ data: Buffer.from(data), error: null });
    },
    remove: (paths) => {
      for (const p of paths) inMemoryStorage.delete(p);
      return Promise.resolve({ data: paths, error: null });
    },
  }),
};

// Hook Supabase Database Queries
supabaseClient.from = function (tableName) {
  if (tableName === 'roles') {
    return {
      select: () => ({
        eq: (col, val) => {
          const matched = MOCK_ROLES.find((r) => r[col] === val) || null;
          return {
            maybeSingle: () => Promise.resolve({ data: matched, error: null }),
            single: () => Promise.resolve({ data: matched, error: null }),
          };
        },
        order: () => Promise.resolve({ data: [...MOCK_ROLES], error: null }),
      }),
    };
  }

  if (tableName === 'users') {
    return {
      select: () => {
        const getAllUsers = () =>
          Array.from(inMemoryUsers.values()).map((u) => {
            const roleObj = MOCK_ROLES.find((r) => r.id === u.role_id);
            return { ...u, role: roleObj?.name, roles: { id: roleObj?.id, name: roleObj?.name || 'TEACHER' } };
          });

        const orderObj = {
          range: (from, to) => {
            const all = getAllUsers();
            return Promise.resolve({ data: all.slice(from, to + 1), count: all.length, error: null });
          },
          then: (resolve, reject) => Promise.resolve({ data: getAllUsers(), error: null }).then(resolve, reject),
        };

        const builder = {
          eq: (col, val) => {
            if (col === 'email') {
              const matched = Array.from(inMemoryUsers.values()).find((u) => u.email === val);
              const roleObj = matched ? MOCK_ROLES.find((r) => r.id === matched.role_id) : null;
              return {
                maybeSingle: () =>
                  Promise.resolve({
                    data: matched ? { ...matched, role: roleObj?.name, roles: { name: roleObj?.name || 'TEACHER' } } : null,
                    error: null,
                  }),
                single: () =>
                  Promise.resolve({
                    data: matched ? { ...matched, role: roleObj?.name, roles: { name: roleObj?.name || 'TEACHER' } } : null,
                    error: null,
                  }),
              };
            }
            if (col === 'id') {
              const matched = inMemoryUsers.get(val);
              const roleObj = matched ? MOCK_ROLES.find((r) => r.id === matched.role_id) : null;
              return {
                maybeSingle: () =>
                  Promise.resolve({
                    data: matched ? { ...matched, role: roleObj?.name, roles: { name: roleObj?.name || 'TEACHER' } } : null,
                    error: null,
                  }),
                single: () =>
                  Promise.resolve({
                    data: matched ? { ...matched, role: roleObj?.name, roles: { name: roleObj?.name || 'TEACHER' } } : null,
                    error: null,
                  }),
              };
            }
            return {
              eq: () => ({
                order: () => {
                  const teachers = Array.from(inMemoryUsers.values())
                    .filter((u) => u.role_id === 'role-uuid-teacher-002' && u.is_active)
                    .map((u) => ({ id: u.id, name: u.name, email: u.email }));
                  return Promise.resolve({ data: teachers, error: null });
                },
              }),
              order: () => orderObj,
              range: (from, to) => orderObj.range(from, to),
            };
          },
          or: () => builder,
          order: () => orderObj,
          range: (from, to) => orderObj.range(from, to),
          then: (resolve, reject) => Promise.resolve({ data: getAllUsers(), error: null }).then(resolve, reject),
        };
        return builder;
      },
      insert: (rows) => {
        const created = rows.map((r) => {
          const item = { ...r, id: r.id || crypto.randomUUID(), created_at: new Date().toISOString() };
          inMemoryUsers.set(item.id, item);
          return item;
        });
        return {
          select: () => ({
            single: () => Promise.resolve({ data: created[0], error: null }),
          }),
          then: (resolve, reject) => Promise.resolve({ data: created, error: null }).then(resolve, reject),
        };
      },
      update: (updates) => ({
        eq: (col, val) => {
          if (col === 'id' && inMemoryUsers.has(val)) {
            const existing = inMemoryUsers.get(val);
            const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
            inMemoryUsers.set(val, updated);
            return {
              select: () => ({
                single: () => Promise.resolve({ data: updated, error: null }),
              }),
            };
          }
          return { select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) };
        },
      }),
    };
  }

  if (tableName === 'question_papers') {
    return {
      select: () => ({
        eq: (col, val) => {
          if (col === 'id') {
            const paper = inMemoryPapers.get(val);
            if (paper) {
              const enriched = {
                ...paper,
                teacher: inMemoryUsers.get(paper.teacher_id),
                question_paper_assignments: Array.from(inMemoryAssignments.values()).filter((a) => a.question_paper_id === val),
                digital_signatures: Array.from(inMemorySigs.values()).filter((s) => s.question_paper_id === val),
              };
              return {
                maybeSingle: () => Promise.resolve({ data: enriched, error: null }),
                single: () => Promise.resolve({ data: enriched, error: null }),
              };
            }
            return {
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
              single: () => Promise.resolve({ data: null, error: null }),
            };
          }
          if (col === 'teacher_id') {
            const papers = Array.from(inMemoryPapers.values())
              .filter((p) => p.teacher_id === val)
              .map((p) => ({
                ...p,
                question_paper_assignments: Array.from(inMemoryAssignments.values()).filter((a) => a.question_paper_id === p.id),
                digital_signatures: Array.from(inMemorySigs.values()).filter((s) => s.question_paper_id === p.id),
              }));
            return {
              order: () => Promise.resolve({ data: papers, error: null }),
            };
          }
          return { order: () => Promise.resolve({ data: [], error: null }) };
        },
        in: (col, vals) => {
          const matched = vals
            .map((id) => {
              const p = inMemoryPapers.get(id);
              if (!p) return null;
              return {
                ...p,
                teacher: inMemoryUsers.get(p.teacher_id),
                digital_signatures: Array.from(inMemorySigs.values()).filter((s) => s.question_paper_id === id),
              };
            })
            .filter(Boolean);
          return Promise.resolve({ data: matched, error: null });
        },
      }),
      insert: (rows) => {
        const item = { ...rows[0], id: rows[0].id || crypto.randomUUID(), created_at: new Date().toISOString() };
        inMemoryPapers.set(item.id, item);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: item, error: null }),
          }),
          then: (resolve, reject) => Promise.resolve({ data: [item], error: null }).then(resolve, reject),
        };
      },
    };
  }

  if (tableName === 'paper_keys') {
    return {
      select: () => ({
        eq: (col, val) => {
          const keyRec = inMemoryKeys.get(val);
          return {
            maybeSingle: () => Promise.resolve({ data: keyRec || null, error: null }),
            single: () => Promise.resolve({ data: keyRec || null, error: null }),
          };
        },
      }),
      insert: (rows) => {
        const item = { ...rows[0], id: rows[0].id || crypto.randomUUID() };
        inMemoryKeys.set(item.question_paper_id, item);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: item, error: null }),
          }),
          then: (resolve, reject) => Promise.resolve({ data: [item], error: null }).then(resolve, reject),
        };
      },
    };
  }

  if (tableName === 'digital_signatures') {
    return {
      select: () => ({
        eq: (col, val) => {
          const sig = inMemorySigs.get(val);
          return {
            maybeSingle: () => Promise.resolve({ data: sig || null, error: null }),
            single: () => Promise.resolve({ data: sig || null, error: null }),
          };
        },
      }),
      insert: (rows) => {
        const item = { ...rows[0], id: rows[0].id || crypto.randomUUID(), created_at: new Date().toISOString() };
        inMemorySigs.set(item.question_paper_id, item);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: item, error: null }),
          }),
          then: (resolve, reject) => Promise.resolve({ data: [item], error: null }).then(resolve, reject),
        };
      },
    };
  }

  if (tableName === 'question_paper_assignments') {
    return {
      select: () => ({
        eq: (col, val) => {
          if (col === 'assigned_to_user_id') {
            const list = Array.from(inMemoryAssignments.values()).filter((a) => a.assigned_to_user_id === val);
            return Promise.resolve({ data: list, error: null });
          }
          if (col === 'question_paper_id') {
            const list = Array.from(inMemoryAssignments.values()).filter((a) => a.question_paper_id === val);
            return Promise.resolve({ data: list, error: null });
          }
          return Promise.resolve({ data: [], error: null });
        },
      }),
      insert: (rows) => {
        const item = { ...rows[0], id: rows[0].id || 'assign-' + Date.now(), assigned_at: new Date().toISOString() };
        inMemoryAssignments.set(item.question_paper_id, item);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: item, error: null }),
          }),
          then: (resolve, reject) => Promise.resolve({ data: [item], error: null }).then(resolve, reject),
        };
      },
    };
  }

  if (tableName === 'notifications') {
    return {
      select: () => {
        const filters = [];
        const builder = {
          eq: (col, val) => {
            filters.push((n) => n[col] === val);
            return builder;
          },
          neq: (col, val) => {
            filters.push((n) => n[col] !== val);
            return builder;
          },
          order: () => builder,
          maybeSingle: () => {
            const list = Array.from(inMemoryNotifications.values()).filter((n) => filters.every((f) => f(n)));
            return Promise.resolve({ data: list[0] || null, error: null });
          },
          single: () => {
            const list = Array.from(inMemoryNotifications.values()).filter((n) => filters.every((f) => f(n)));
            return Promise.resolve({ data: list[0] || null, error: null });
          },
          then: (resolve, reject) => {
            const list = Array.from(inMemoryNotifications.values()).filter((n) => filters.every((f) => f(n)));
            return Promise.resolve({ data: list, error: null }).then(resolve, reject);
          },
        };
        return builder;
      },
      insert: (rows) => {
        const item = { ...rows[0], id: rows[0].id || crypto.randomUUID(), created_at: new Date().toISOString() };
        inMemoryNotifications.set(item.id, item);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: item, error: null }),
          }),
          then: (resolve, reject) => Promise.resolve({ data: [item], error: null }).then(resolve, reject),
        };
      },
      update: (updates) => {
        const filters = [];
        const builder = {
          eq: (col, val) => {
            filters.push((n) => n[col] === val);
            return builder;
          },
          neq: (col, val) => {
            filters.push((n) => n[col] !== val);
            return builder;
          },
          select: () => builder,
          single: () => {
            const list = Array.from(inMemoryNotifications.values()).filter((n) => filters.every((f) => f(n)));
            const target = list[0] || null;
            if (target) {
              Object.assign(target, updates, { updated_at: new Date().toISOString() });
            }
            return Promise.resolve({ data: target, error: null });
          },
          then: (resolve, reject) => {
            const list = Array.from(inMemoryNotifications.values()).filter((n) => filters.every((f) => f(n)));
            for (const item of list) {
              Object.assign(item, updates, { updated_at: new Date().toISOString() });
            }
            return Promise.resolve({ data: list, error: null }).then(resolve, reject);
          },
        };
        return builder;
      },
    };
  }

  if (tableName === 'activity_logs') {
    return {
      select: (cols, opts = {}) => {
        let rows = Array.from(inMemoryAuditLogs.values());
        const isCountOnly = opts && opts.head === true;
        const builder = {
          eq(col, val) {
            if (col.startsWith('details->>')) {
              const prop = col.split('->>')[1];
              rows = rows.filter((r) => r.details && String(r.details[prop]) === String(val));
            } else if (col === 'id') {
              rows = rows.filter((r) => r.id === val);
            }
            return builder;
          },
          gte() {
            return builder;
          },
          lte() {
            return builder;
          },
          order() {
            return builder;
          },
          range(from, to) {
            return Promise.resolve({ data: rows.slice(from, to + 1), count: rows.length, error: null });
          },
          maybeSingle() {
            return Promise.resolve({ data: rows[0] || null, error: null });
          },
          then(resolve, reject) {
            if (isCountOnly) {
              return Promise.resolve({ data: null, count: rows.length, error: null }).then(resolve, reject);
            }
            return Promise.resolve({ data: rows, count: rows.length, error: null }).then(resolve, reject);
          },
        };
        return builder;
      },
      insert: (rows) => {
        for (const r of rows) {
          const item = { ...r, id: r.id || crypto.randomUUID(), created_at: new Date().toISOString() };
          inMemoryAuditLogs.set(item.id, item);
        }
        const promise = Promise.resolve({ data: rows, error: null });
        promise.select = () => ({
          single: () => Promise.resolve({ data: rows[0], error: null }),
        });
        return promise;
      },
    };
  }

  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
        order: () => Promise.resolve({ data: [], error: null }),
      }),
      order: () => Promise.resolve({ data: [], error: null }),
    }),
  };
};

// HTTP Request Helper
function httpRequest({ method, path: reqPath, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method.toUpperCase(),
      headers: { ...headers },
    };

    let serializedBody = null;
    if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body)) {
      serializedBody = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(serializedBody);
    } else if (Buffer.isBuffer(body)) {
      serializedBody = body;
      options.headers['Content-Length'] = body.length;
    }

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        const rawText = rawBuffer.toString('utf8');
        let parsed = null;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = null;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed,
          rawBuffer,
          rawText,
        });
      });
    });

    req.on('error', reject);
    if (serializedBody) {
      req.write(serializedBody);
    }
    req.end();
  });
}

// Multipart Form-Data Builder
function createMultipartFormData(fields, file) {
  const boundary = '----ExamGuardValidationBoundary' + crypto.randomBytes(8).toString('hex');
  const CRLF = '\r\n';
  const parts = [];

  for (const [key, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}${CRLF}Content-Disposition: form-data; name="${key}"${CRLF}${CRLF}${value}${CRLF}`));
  }

  if (file) {
    const header = `--${boundary}${CRLF}Content-Disposition: form-data; name="${file.name}"; filename="${file.filename}"${CRLF}Content-Type: ${file.contentType}${CRLF}${CRLF}`;
    parts.push(Buffer.from(header));
    parts.push(file.buffer);
    parts.push(Buffer.from(CRLF));
  }

  parts.push(Buffer.from(`--${boundary}--${CRLF}`));

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: Buffer.concat(parts),
  };
}

// Main Test Runner
async function runSystemValidationSuite() {
  console.log('============================================================');
  console.log('  MODULE 16: FINAL SYSTEM VALIDATION & SECURITY AUDIT       ');
  console.log('============================================================\n');

  const server = app.listen(TEST_PORT);
  await new Promise((resolve) => server.once('listening', resolve));

  try {
    // -------------------------------------------------------------
    // Section 1: Baseline Health, Authentication Rigor & Tokens
    // -------------------------------------------------------------
    console.log('--- Section 1: Baseline Health, Authentication Rigor & Tokens ---');
    console.log(`[Test Server] Started successfully on port ${TEST_PORT}\n`);

    // Health check
    const healthRes = await httpRequest({ method: 'GET', path: '/api/health' });
    assert(healthRes.statusCode === 200, 'GET /api/health responds with 200 OK');
    assert(healthRes.body?.status === 'OK' || healthRes.body?.success === true, 'Health check indicates operational status');

    // Missing JWT
    const noAuthRes = await httpRequest({ method: 'GET', path: '/api/auth/me' });
    assert(noAuthRes.statusCode === 401, 'Unauthenticated /api/auth/me returns 401 Unauthorized');
    assert(noAuthRes.body?.message?.includes('Missing Authorization'), 'Response indicates missing authorization header');

    // Malformed Bearer scheme
    const malformedAuthRes = await httpRequest({
      method: 'GET',
      path: '/api/auth/me',
      headers: { Authorization: 'Basic dXNlcjpwYXNz' },
    });
    assert(malformedAuthRes.statusCode === 401, 'Non-Bearer scheme returns 401 Unauthorized');
    assert(malformedAuthRes.body?.message?.includes('Malformed'), 'Response explains malformed Bearer requirement');

    // Expired JWT handling
    const expiredToken = jwt.sign(
      { userId: MOCK_USERS.teacherAuthor.userId, email: MOCK_USERS.teacherAuthor.email },
      config.jwtSecret || 'examguard_secure_jwt_secret_dev_key_2026_examguard',
      { expiresIn: '-10s' }
    );
    const expiredRes = await httpRequest({
      method: 'GET',
      path: '/api/auth/me',
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(expiredRes.statusCode === 401, 'Expired JWT returns 401 Unauthorized');
    assert(expiredRes.body?.message?.toLowerCase().includes('expired'), 'Response explicitly identifies expired token');

    // Valid authenticated token
    const teacherAuthorToken = generateToken({
      userId: MOCK_USERS.teacherAuthor.userId,
      email: MOCK_USERS.teacherAuthor.email,
      role: MOCK_USERS.teacherAuthor.roleName,
    });
    const validMeRes = await httpRequest({
      method: 'GET',
      path: '/api/auth/me',
      headers: { Authorization: `Bearer ${teacherAuthorToken}` },
    });
    assert(validMeRes.statusCode === 200, 'Valid token to /api/auth/me returns 200 OK');
    assert(validMeRes.body?.user?.email === MOCK_USERS.teacherAuthor.email, 'Authenticated profile reflects correct user');
    assert(!validMeRes.rawText.includes('password_hash'), 'Profile payload strictly omits password_hash');

    // -------------------------------------------------------------
    // Section 2: Authoritative Database-Backed RBAC & Isolation
    // -------------------------------------------------------------
    console.log('\n--- Section 2: Authoritative Database-Backed RBAC & Isolation ---');

    const adminToken = generateToken({
      userId: MOCK_USERS.admin.userId,
      email: MOCK_USERS.admin.email,
      role: MOCK_USERS.admin.roleName,
    });
    const coordinatorToken = generateToken({
      userId: MOCK_USERS.coordinator.userId,
      email: MOCK_USERS.coordinator.email,
      role: MOCK_USERS.coordinator.roleName,
    });
    const inactiveTeacherToken = generateToken({
      userId: MOCK_USERS.inactiveTeacher.userId,
      email: MOCK_USERS.inactiveTeacher.email,
      role: MOCK_USERS.inactiveTeacher.roleName,
    });

    // Inactive account blocked immediately
    const inactiveRes = await httpRequest({
      method: 'GET',
      path: '/api/question-papers/my',
      headers: { Authorization: `Bearer ${inactiveTeacherToken}` },
    });
    assert(inactiveRes.statusCode === 403, 'Inactive faculty blocked with 403 Forbidden');
    assert(inactiveRes.body?.message?.includes('inactive'), 'Inactive account response provides clear reason');

    // Teacher cannot access Admin endpoints
    const teacherAdminRes = await httpRequest({
      method: 'GET',
      path: '/api/admin/users',
      headers: { Authorization: `Bearer ${teacherAuthorToken}` },
    });
    assert(teacherAdminRes.statusCode === 403, 'Teacher forbidden from accessing /api/admin/users');

    // Coordinator cannot access Admin endpoints
    const coordAdminRes = await httpRequest({
      method: 'GET',
      path: '/api/admin/users',
      headers: { Authorization: `Bearer ${coordinatorToken}` },
    });
    assert(coordAdminRes.statusCode === 403, 'Coordinator forbidden from accessing /api/admin/users');

    // Teacher cannot access Coordinator dashboard endpoints
    const teacherCoordRes = await httpRequest({
      method: 'GET',
      path: '/api/exam-coordinator/question-papers',
      headers: { Authorization: `Bearer ${teacherAuthorToken}` },
    });
    assert(teacherCoordRes.statusCode === 403, 'Teacher forbidden from accessing /api/exam-coordinator/question-papers');

    // -------------------------------------------------------------
    // Section 3: Question Paper Lifecycle & Authoritative Delivery Date
    // -------------------------------------------------------------
    console.log('\n--- Section 3: Question Paper Lifecycle & Authoritative Delivery Date ---');

    const validSamplePdf = Buffer.from(
      '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n193\n%%EOF\n',
      'utf8'
    );

    // Rejection of invalid non-PDF file
    const invalidFileData = createMultipartFormData(
      {
        title: 'Network Security Exam',
        subject: 'Computer Science',
        semester: 'Semester 6',
        academicYear: '2025-2026',
        examType: 'FINAL',
        examDate: '2026-11-20',
        assignedToUserId: MOCK_USERS.teacherRecipient.userId,
      },
      {
        name: 'file',
        filename: 'malicious.exe',
        contentType: 'application/octet-stream',
        buffer: Buffer.from('NOT_A_PDF_CONTENT'),
      }
    );
    const nonPdfRes = await httpRequest({
      method: 'POST',
      path: '/api/question-papers',
      headers: {
        Authorization: `Bearer ${teacherAuthorToken}`,
        'Content-Type': invalidFileData.contentType,
      },
      body: invalidFileData.body,
    });
    assert(nonPdfRes.statusCode === 400, 'Non-PDF file upload rejected with 400 Bad Request');
    assert(nonPdfRes.body?.message?.includes('PDF'), 'File rejection explicitly states PDF requirement');

    // Submit valid paper attempting client-side delivery date spoofing
    const validPaperData = createMultipartFormData(
      {
        title: 'Cryptography & System Security Final Exam',
        subject: 'Information Security',
        semester: 'Semester 7',
        academicYear: '2025-2026',
        examType: 'FINAL',
        examDate: '2026-11-20',
        assignedToUserId: MOCK_USERS.teacherRecipient.userId,
        scheduled_delivery_date: '1999-01-01', // Client spoof attempt
        scheduledDeliveryDate: '1999-01-01',   // Client spoof attempt
      },
      {
        name: 'file',
        filename: 'crypto_exam_paper.pdf',
        contentType: 'application/pdf',
        buffer: validSamplePdf,
      }
    );

    const submitRes = await httpRequest({
      method: 'POST',
      path: '/api/question-papers',
      headers: {
        Authorization: `Bearer ${teacherAuthorToken}`,
        'Content-Type': validPaperData.contentType,
      },
      body: validPaperData.body,
    });

    assert(submitRes.statusCode === 201, 'Valid question paper submission succeeds with 201 Created');
    assert(submitRes.body?.success === true, 'Submission response has success: true');
    const createdPaper = submitRes.body?.data?.questionPaper;
    assert(Boolean(createdPaper?.id), 'Paper created with unique UUID');

    // Authoritative Delivery Date Verification:
    // Must be next UTC calendar day from submission time, NOT spoofed '1999-01-01'
    const expectedTomorrow = questionPaperService.calculateNextCalendarDay(new Date());
    const actualDeliveryDate = createdPaper?.scheduled_delivery_date || createdPaper?.scheduledDeliveryDate;
    assert(actualDeliveryDate === expectedTomorrow, `Authoritative delivery date is next UTC calendar day (${expectedTomorrow})`);
    assert(actualDeliveryDate !== '1999-01-01', 'Client-supplied scheduled_delivery_date was strictly stripped/ignored');

    const createdPaperId = createdPaper.id;

    // -------------------------------------------------------------
    // Section 4: Assigned-Faculty Workflow & Access Gating
    // -------------------------------------------------------------
    console.log('\n--- Section 4: Assigned-Faculty Workflow & Access Gating ---');

    const teacherRecipientToken = generateToken({
      userId: MOCK_USERS.teacherRecipient.userId,
      email: MOCK_USERS.teacherRecipient.email,
      role: MOCK_USERS.teacherRecipient.roleName,
    });
    const teacherUnassignedToken = generateToken({
      userId: MOCK_USERS.teacherUnassigned.userId,
      email: MOCK_USERS.teacherUnassigned.email,
      role: MOCK_USERS.teacherUnassigned.roleName,
    });

    // Assigned recipient sees paper in assigned repository
    const assignedListRes = await httpRequest({
      method: 'GET',
      path: '/api/question-papers/assigned',
      headers: { Authorization: `Bearer ${teacherRecipientToken}` },
    });
    assert(assignedListRes.statusCode === 200, 'GET /api/question-papers/assigned returns 200 OK');
    const foundAssigned = assignedListRes.body?.data?.find((p) => p.id === createdPaperId);
    assert(Boolean(foundAssigned), 'Assigned paper appears in designated faculty assigned repository');
    assert(foundAssigned?.isDeliverable === false, 'isDeliverable is false when current date < scheduledDeliveryDate');

    // Unassigned faculty blocked from accessing paper details
    const unassignedDetailRes = await httpRequest({
      method: 'GET',
      path: `/api/question-papers/${createdPaperId}`,
      headers: { Authorization: `Bearer ${teacherUnassignedToken}` },
    });
    assert(unassignedDetailRes.statusCode === 403, 'Unassigned faculty blocked with 403 Forbidden on paper details');

    // Unassigned faculty blocked from downloading paper
    const unassignedDownloadRes = await httpRequest({
      method: 'GET',
      path: `/api/question-papers/${createdPaperId}/download`,
      headers: { Authorization: `Bearer ${teacherUnassignedToken}` },
    });
    assert(unassignedDownloadRes.statusCode === 403, 'Unassigned faculty blocked with 403 Forbidden on download');

    // Assigned recipient downloading BEFORE delivery date blocked
    const preDeliveryDownloadRes = await httpRequest({
      method: 'GET',
      path: `/api/question-papers/${createdPaperId}/download`,
      headers: { Authorization: `Bearer ${teacherRecipientToken}` },
    });
    assert(preDeliveryDownloadRes.statusCode === 403, 'Assigned recipient downloading before delivery date receives 403 Forbidden');
    assert(preDeliveryDownloadRes.body?.message?.includes('scheduled for delivery'), 'Rejection clearly explains delivery date requirement');

    // Authoring teacher is EXEMPT from delivery date gating and can download immediately
    const authorDownloadRes = await httpRequest({
      method: 'GET',
      path: `/api/question-papers/${createdPaperId}/download`,
      headers: { Authorization: `Bearer ${teacherAuthorToken}` },
    });
    assert(authorDownloadRes.statusCode === 200, 'Authoring teacher download succeeds immediately with 200 OK');
    assert(authorDownloadRes.headers['content-type'] === 'application/pdf', 'Downloaded file is application/pdf');
    assert(authorDownloadRes.rawBuffer.toString('utf8').includes('%PDF-1.4'), 'Decrypted content matches valid original PDF');

    // -------------------------------------------------------------
    // Section 5: Verify-Before-Decrypt Pipeline & Tamper Defense
    // -------------------------------------------------------------
    console.log('\n--- Section 5: Verify-Before-Decrypt Pipeline & Tamper Defense ---');

    // Pre-tampering signature verification
    const sigCheckRes = await httpRequest({
      method: 'GET',
      path: `/api/question-papers/${createdPaperId}/verify-signature`,
      headers: { Authorization: `Bearer ${teacherAuthorToken}` },
    });
    assert(sigCheckRes.statusCode === 200, 'GET /verify-signature returns 200 OK');
    assert(sigCheckRes.body?.data?.verified === true, 'RSA-PSS signature over ciphertext is verified: true');
    assert(sigCheckRes.body?.data?.tamperDetected === false, 'tamperDetected is false for authentic stored paper');

    // Tamper with ciphertext in storage
    const storedPaper = inMemoryPapers.get(createdPaperId);
    const authenticCiphertext = inMemoryStorage.get(storedPaper.storage_path);
    const corruptedCiphertext = Buffer.from(authenticCiphertext);
    corruptedCiphertext[corruptedCiphertext.length - 2] ^= 0xAA; // Flip bit
    inMemoryStorage.set(storedPaper.storage_path, corruptedCiphertext);

    // Verify signature detects tampering
    const tamperedSigRes = await httpRequest({
      method: 'GET',
      path: `/api/question-papers/${createdPaperId}/verify-signature`,
      headers: { Authorization: `Bearer ${teacherAuthorToken}` },
    });
    assert(tamperedSigRes.statusCode === 200, 'Signature check returns 200 with tamper diagnosis');
    assert(tamperedSigRes.body?.data?.verified === false, 'Tampered ciphertext fails signature verification (verified: false)');
    assert(tamperedSigRes.body?.data?.tamperDetected === true, 'tamperDetected is true for altered ciphertext');

    // Verify-Before-Decrypt halts and refuses to decrypt
    const tamperedDownloadRes = await httpRequest({
      method: 'GET',
      path: `/api/question-papers/${createdPaperId}/download`,
      headers: { Authorization: `Bearer ${teacherAuthorToken}` },
    });
    assert(tamperedDownloadRes.statusCode === 400, 'Download halts closed with 400 Bad Request on tamper');
    assert(!tamperedDownloadRes.rawText.includes('%PDF-1.4'), 'No plaintext PDF bytes leaked on tamper failure');

    // Restore authentic ciphertext for subsequent tests
    inMemoryStorage.set(storedPaper.storage_path, authenticCiphertext);

    // -------------------------------------------------------------
    // Section 6: Exam Coordinator Scoping & Answer Key Controls
    // -------------------------------------------------------------
    console.log('\n--- Section 6: Exam Coordinator Scoping & Answer Key Controls ---');

    // Coordinator paper listing
    const coordPapersRes = await httpRequest({
      method: 'GET',
      path: '/api/exam-coordinator/question-papers',
      headers: { Authorization: `Bearer ${coordinatorToken}` },
    });
    assert(coordPapersRes.statusCode === 200, 'Coordinator question papers listing returns 200 OK');
    assert(Array.isArray(coordPapersRes.body?.data), 'Coordinator papers data is array');

    // Early Answer Key upload rejected (examDate is in the future)
    const earlyAkData = createMultipartFormData(
      {},
      {
        name: 'file',
        filename: 'answer_key_early.pdf',
        contentType: 'application/pdf',
        buffer: validSamplePdf,
      }
    );
    const earlyAkRes = await httpRequest({
      method: 'POST',
      path: `/api/teacher/question-papers/${createdPaperId}/answer-key`,
      headers: {
        Authorization: `Bearer ${teacherAuthorToken}`,
        'Content-Type': earlyAkData.contentType,
      },
      body: earlyAkData.body,
    });
    assert(earlyAkRes.statusCode === 400, 'Answer Key upload before exam date rejected with 400 Bad Request');
    assert(earlyAkRes.body?.message?.toLowerCase().includes('before'), 'Rejection explains exam timing window restriction');

    // -------------------------------------------------------------
    // Section 7: Administrative Safeguards & Audit Immutability
    // -------------------------------------------------------------
    console.log('\n--- Section 7: Administrative Safeguards & Audit Immutability ---');

    // Admin self-lockout prevention
    const selfDeactivateRes = await httpRequest({
      method: 'PATCH',
      path: `/api/admin/users/${MOCK_USERS.admin.userId}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { isActive: false },
    });
    assert(selfDeactivateRes.statusCode === 400, 'Self-deactivation blocked with 400 Bad Request');
    assert(selfDeactivateRes.body?.message?.includes('own account'), 'Self-deactivation response contains safeguard explanation');

    // Last-active-admin demotion prevention
    const demoteAdminRes = await httpRequest({
      method: 'PATCH',
      path: `/api/admin/users/${MOCK_USERS.admin.userId}/role`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { role: 'TEACHER' },
    });
    assert(demoteAdminRes.statusCode === 400, 'Demoting last active admin blocked with 400 Bad Request');

    // Audit logs immutability (POST, PUT, DELETE forbidden with 405)
    const auditMutateRes = await httpRequest({
      method: 'POST',
      path: '/api/audit-logs',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { forged: true },
    });
    assert(auditMutateRes.statusCode === 405, 'POST to /api/audit-logs returns 405 Method Not Allowed');

    // Audit summary retrieval
    const auditSummaryRes = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs/summary',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(auditSummaryRes.statusCode === 200, 'GET /api/audit-logs/summary returns 200 OK');
    assert(auditSummaryRes.body?.data?.totalEvents !== undefined, 'Audit summary contains totalEvents metric');

    // -------------------------------------------------------------
    // Section 8: Zero Secrets Leakage & Memory Safety Audit
    // -------------------------------------------------------------
    console.log('\n--- Section 8: Zero Secrets Leakage & Memory Safety Audit ---');

    // Users listing audit
    const listUsersRes = await httpRequest({
      method: 'GET',
      path: '/api/admin/users',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const usersPayload = JSON.stringify(listUsersRes.body);
    assert(!usersPayload.includes('password_hash'), 'Users endpoint strictly omits password_hash');
    assert(!usersPayload.includes('password"'), 'Users endpoint strictly omits plaintext passwords');

    // Papers listing audit
    const myPapersRes = await httpRequest({
      method: 'GET',
      path: '/api/question-papers/my',
      headers: { Authorization: `Bearer ${teacherAuthorToken}` },
    });
    const myPapersPayload = JSON.stringify(myPapersRes.body);
    assert(!myPapersPayload.includes('encrypted_aes_key'), 'Papers endpoint strictly omits encrypted_aes_key');
    assert(!myPapersPayload.includes('auth_tag'), 'Papers endpoint strictly omits auth_tag');
    assert(!myPapersPayload.includes('iv"'), 'Papers endpoint strictly omits iv');

    // Notifications audit
    const notifsRes = await httpRequest({
      method: 'GET',
      path: '/api/notifications',
      headers: { Authorization: `Bearer ${teacherRecipientToken}` },
    });
    const notifsPayload = JSON.stringify(notifsRes.body);
    assert(!notifsPayload.includes('storage_path'), 'Notifications endpoint strictly omits internal storage_path');
    assert(!notifsPayload.includes('encrypted_aes_key'), 'Notifications endpoint strictly omits encrypted_aes_key');

    console.log('\n============================================================');
    console.log('  MODULE 16 SYSTEM VALIDATION COMPLETED SUCCESSFULLY');
    console.log(`  Passed: ${passedCount} / ${totalAssertions} Assertions`);
    console.log('  Failed: 0');
    console.log('============================================================\n');

  } finally {
    server.close();
  }
}

runSystemValidationSuite().catch((err) => {
  console.error('\n✗ Test Suite Execution Failed:', err);
  process.exit(1);
});

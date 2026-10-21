/**
 * ExamGuard - Module 15: Frontend Integration & System-Wide Polish Verification Suite
 *
 * Dedicated test runner executing on PORT 5013 to avoid port collision.
 *
 * Validates complete end-to-end integration and security guarantees:
 * Section 1: Authentication, Session Management & RBAC Isolation
 * Section 2: Question Paper Lifecycle & Next-Day Delivery Gating
 * Section 3: Assigned Faculty Workflow & Delivery Date Restraints
 * Section 4: Verify-Before-Decrypt Cryptographic Pipeline & Tamper Defense
 * Section 5: Answer Key Submission Window, Verification & Access Control
 * Section 6: Notification Lifecycle & Read State Management
 * Section 7: Administrative Safeguards & Credential Management
 * Section 8: Zero Secrets Leakage & Data Sanitization Audit
 */

const http = require('http');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

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

// Dedicated test port for Module 15
const TEST_PORT = 5013;
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
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'admin.m15@examguard.edu',
    name: 'Admin Director',
    roleId: 'role-uuid-admin-001',
    roleName: 'ADMIN',
    isActive: true,
  },
  admin2: {
    userId: '11111111-1111-4111-8111-222222222222',
    email: 'admin2.m15@examguard.edu',
    name: 'Admin Secondary',
    roleId: 'role-uuid-admin-001',
    roleName: 'ADMIN',
    isActive: true,
  },
  teacherAuthor: {
    userId: '22222222-2222-4222-8222-111111111111',
    email: 'author.m15@examguard.edu',
    name: 'Prof. Alan Turing',
    roleId: 'role-uuid-teacher-002',
    roleName: 'TEACHER',
    isActive: true,
  },
  teacherRecipient: {
    userId: '22222222-2222-4222-8222-222222222222',
    email: 'recipient.m15@examguard.edu',
    name: 'Prof. Grace Hopper',
    roleId: 'role-uuid-teacher-002',
    roleName: 'TEACHER',
    isActive: true,
  },
  examCoordinator: {
    userId: '33333333-3333-4333-8333-111111111111',
    email: 'coordinator.m15@examguard.edu',
    name: 'Coordinator Charles Babbage',
    roleId: 'role-uuid-coord-003',
    roleName: 'EXAM_COORDINATOR',
    isActive: true,
  },
  inactiveTeacher: {
    userId: '44444444-4444-4444-8444-111111111111',
    email: 'inactive.m15@examguard.edu',
    name: 'Inactive Faculty',
    roleId: 'role-uuid-teacher-002',
    roleName: 'TEACHER',
    isActive: false,
  },
};

const MOCK_ROLES = [
  { id: 'role-uuid-admin-001', name: 'ADMIN', description: 'System Administrator' },
  { id: 'role-uuid-teacher-002', name: 'TEACHER', description: 'Question Paper Author' },
  { id: 'role-uuid-coord-003', name: 'EXAM_COORDINATOR', description: 'Exam Coordinator' },
];

// Issue tokens
const adminToken = generateToken({
  userId: MOCK_USERS.admin.userId,
  email: MOCK_USERS.admin.email,
  roleId: MOCK_USERS.admin.roleId,
});

const teacherAuthorToken = generateToken({
  userId: MOCK_USERS.teacherAuthor.userId,
  email: MOCK_USERS.teacherAuthor.email,
  roleId: MOCK_USERS.teacherAuthor.roleId,
});

const teacherRecipientToken = generateToken({
  userId: MOCK_USERS.teacherRecipient.userId,
  email: MOCK_USERS.teacherRecipient.email,
  roleId: MOCK_USERS.teacherRecipient.roleId,
});

const coordToken = generateToken({
  userId: MOCK_USERS.examCoordinator.userId,
  email: MOCK_USERS.examCoordinator.email,
  roleId: MOCK_USERS.examCoordinator.roleId,
});

const inactiveTeacherToken = generateToken({
  userId: MOCK_USERS.inactiveTeacher.userId,
  email: MOCK_USERS.inactiveTeacher.email,
  roleId: MOCK_USERS.inactiveTeacher.roleId,
});

// In-memory mock storage
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
    password_hash: bcrypt.hashSync('ExamGuard@2026Secure', 10),
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
                maybeSingle: () => Promise.resolve({
                  data: matched ? { ...matched, role: roleObj?.name, roles: { name: roleObj?.name || 'TEACHER' } } : null,
                  error: null,
                }),
                single: () => Promise.resolve({
                  data: matched ? { ...matched, role: roleObj?.name, roles: { name: roleObj?.name || 'TEACHER' } } : null,
                  error: null,
                }),
              };
            }
            if (col === 'id') {
              const matched = inMemoryUsers.get(val);
              const roleObj = matched ? MOCK_ROLES.find((r) => r.id === matched.role_id) : null;
              return {
                maybeSingle: () => Promise.resolve({
                  data: matched ? { ...matched, role: roleObj?.name, roles: { name: roleObj?.name || 'TEACHER' } } : null,
                  error: null,
                }),
                single: () => Promise.resolve({
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
        const res = {
          select: () => ({
            single: () => Promise.resolve({ data: created[0], error: null }),
          }),
          then: (resolve, reject) => Promise.resolve({ data: created, error: null }).then(resolve, reject),
        };
        return res;
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
          const matched = vals.map((id) => {
            const p = inMemoryPapers.get(id);
            if (!p) return null;
            return {
              ...p,
              teacher: inMemoryUsers.get(p.teacher_id),
              digital_signatures: Array.from(inMemorySigs.values()).filter((s) => s.question_paper_id === id),
            };
          }).filter(Boolean);
          return Promise.resolve({ data: matched, error: null });
        },
      }),
      insert: (rows) => {
        const item = { ...rows[0], id: rows[0].id || crypto.randomUUID(), created_at: new Date().toISOString() };
        inMemoryPapers.set(item.id, item);
        const res = {
          select: () => ({
            single: () => Promise.resolve({ data: item, error: null }),
          }),
          then: (resolve, reject) => Promise.resolve({ data: [item], error: null }).then(resolve, reject),
        };
        return res;
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
        const res = {
          select: () => ({
            single: () => Promise.resolve({ data: item, error: null }),
          }),
          then: (resolve, reject) => Promise.resolve({ data: [item], error: null }).then(resolve, reject),
        };
        return res;
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
        const res = {
          select: () => ({
            single: () => Promise.resolve({ data: item, error: null }),
          }),
          then: (resolve, reject) => Promise.resolve({ data: [item], error: null }).then(resolve, reject),
        };
        return res;
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
        const res = {
          select: () => ({
            single: () => Promise.resolve({ data: item, error: null }),
          }),
          then: (resolve, reject) => Promise.resolve({ data: [item], error: null }).then(resolve, reject),
        };
        return res;
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
            const list = Array.from(inMemoryNotifications.values()).filter((n) =>
              filters.every((f) => f(n))
            );
            return Promise.resolve({ data: list[0] || null, error: null });
          },
          single: () => {
            const list = Array.from(inMemoryNotifications.values()).filter((n) =>
              filters.every((f) => f(n))
            );
            return Promise.resolve({ data: list[0] || null, error: null });
          },
          then: (resolve, reject) => {
            const list = Array.from(inMemoryNotifications.values()).filter((n) =>
              filters.every((f) => f(n))
            );
            return Promise.resolve({ data: list, error: null }).then(resolve, reject);
          },
        };
        return builder;
      },
      insert: (rows) => {
        const item = { ...rows[0], id: rows[0].id || crypto.randomUUID(), created_at: new Date().toISOString() };
        inMemoryNotifications.set(item.id, item);
        const res = {
          select: () => ({
            single: () => Promise.resolve({ data: item, error: null }),
          }),
          then: (resolve, reject) => Promise.resolve({ data: [item], error: null }).then(resolve, reject),
        };
        return res;
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
            const list = Array.from(inMemoryNotifications.values()).filter((n) =>
              filters.every((f) => f(n))
            );
            const target = list[0] || null;
            if (target) {
              Object.assign(target, updates, { updated_at: new Date().toISOString() });
            }
            return Promise.resolve({ data: target, error: null });
          },
          then: (resolve, reject) => {
            const list = Array.from(inMemoryNotifications.values()).filter((n) =>
              filters.every((f) => f(n))
            );
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
      select: () => ({
        order: () => Promise.resolve({ data: Array.from(inMemoryAuditLogs.values()), error: null }),
      }),
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

    let postData = null;
    if (body) {
      if (Buffer.isBuffer(body)) {
        postData = body;
        options.headers['Content-Length'] = body.length;
      } else if (typeof body === 'object') {
        postData = JSON.stringify(body);
        options.headers['Content-Type'] = 'application/json';
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      } else {
        postData = String(body);
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }
    }

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
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

// Helper to construct multipart payload
function createMultipartFormData(fields, fileField) {
  const boundary = '----ExamGuardTestBoundary' + crypto.randomBytes(8).toString('hex');
  const CRLF = '\r\n';
  const parts = [];

  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${k}"${CRLF}${CRLF}${v}${CRLF}`
    ));
  }

  if (fileField) {
    parts.push(Buffer.from(
      `--${boundary}${CRLF}Content-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"${CRLF}Content-Type: ${fileField.contentType}${CRLF}${CRLF}`
    ));
    parts.push(fileField.buffer);
    parts.push(Buffer.from(CRLF));
  }

  parts.push(Buffer.from(`--${boundary}--${CRLF}`));
  return {
    boundary,
    body: Buffer.concat(parts),
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

async function runSystemIntegrationSuite() {
  console.log('============================================================');
  console.log('  MODULE 15: FRONTEND INTEGRATION & SYSTEM POLISH SUITE     ');
  console.log('============================================================\n');

  const server = app.listen(TEST_PORT, () => {
    console.log(`[Test Server] Started successfully on port ${TEST_PORT}\n`);
  });

  try {
    // -------------------------------------------------------------
    // Section 1: Authentication, Session Management & RBAC Isolation
    // -------------------------------------------------------------
    console.log('--- Section 1: Authentication, Session Management & RBAC Isolation ---');

    // Assertion 1: Unauthenticated request rejected
    const unauthRes = await httpRequest({ method: 'GET', path: '/api/auth/me' });
    assert(unauthRes.statusCode === 401, 'Unauthenticated request to /api/auth/me returns 401 Unauthorized');
    assert(unauthRes.body?.success === false, '401 payload contains success: false');

    // Assertion 3: Active session returns safe profile
    const meRes = await httpRequest({
      method: 'GET',
      path: '/api/auth/me',
      headers: { Authorization: `Bearer ${teacherAuthorToken}` },
    });
    assert(meRes.statusCode === 200, 'Authenticated session returns 200 OK');
    assert(meRes.body?.user?.email === MOCK_USERS.teacherAuthor.email, 'Authenticated profile reflects current teacher email');
    assert(meRes.body?.user?.role === 'TEACHER', 'Authenticated profile reflects authoritative database role');
    assert(!meRes.body?.user?.password_hash, 'Authenticated profile strictly omits password_hash');

    // Assertion 7: Inactive user blocked by RBAC
    const inactiveRes = await httpRequest({
      method: 'GET',
      path: '/api/question-papers/my',
      headers: { Authorization: `Bearer ${inactiveTeacherToken}` },
    });
    assert(inactiveRes.statusCode === 403, 'Inactive teacher blocked with 403 Forbidden on protected route');

    // Assertion 8: Role-based isolation across boundaries
    const teacherAdminRes = await httpRequest({
      method: 'GET',
      path: '/api/admin/users',
      headers: { Authorization: `Bearer ${teacherAuthorToken}` },
    });
    assert(teacherAdminRes.statusCode === 403, 'Teacher attempting to access /api/admin/users blocked with 403 Forbidden');

    const coordAdminRes = await httpRequest({
      method: 'GET',
      path: '/api/admin/users',
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    assert(coordAdminRes.statusCode === 403, 'Coordinator attempting to access /api/admin/users blocked with 403 Forbidden');

    const teacherCoordRes = await httpRequest({
      method: 'GET',
      path: '/api/exam-coordinator/question-papers',
      headers: { Authorization: `Bearer ${teacherAuthorToken}` },
    });
    assert(teacherCoordRes.statusCode === 403, 'Teacher attempting to access /api/exam-coordinator/question-papers blocked with 403 Forbidden');

    // -------------------------------------------------------------
    // Section 2: Question Paper Lifecycle & Recipient Assignment
    // -------------------------------------------------------------
    console.log('\n--- Section 2: Question Paper Lifecycle & Recipient Assignment ---');

    const samplePdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\n0000000000 65535 f \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF');

    const paperFormData = createMultipartFormData(
      {
        title: 'Network Security End Semester Exam',
        subject: 'Computer Networks',
        semester: 'Semester 6',
        academicYear: '2026-2027',
        examType: 'End Semester Examination',
        examDate: '2026-11-20',
        assignedToUserId: MOCK_USERS.teacherRecipient.userId,
      },
      {
        name: 'file',
        filename: 'network_security_exam.pdf',
        contentType: 'application/pdf',
        buffer: samplePdfBuffer,
      }
    );

    const submitRes = await httpRequest({
      method: 'POST',
      path: '/api/question-papers',
      headers: {
        Authorization: `Bearer ${teacherAuthorToken}`,
        'Content-Type': paperFormData.contentType,
      },
      body: paperFormData.body,
    });

    assert(submitRes.statusCode === 201, 'POST /api/question-papers succeeds with 201 Created');
    assert(submitRes.body?.success === true, 'Submission response has success: true');
    const createdPaperId = submitRes.body?.data?.questionPaper?.id;
    assert(Boolean(createdPaperId), 'Submission returned valid questionPaper UUID id');
    const createdPaperObj = submitRes.body?.data?.questionPaper;
    assert(Boolean(createdPaperObj?.scheduled_delivery_date || createdPaperObj?.scheduledDeliveryDate), 'Server automatically calculated scheduledDeliveryDate');

    // -------------------------------------------------------------
    // Section 3: Assigned Faculty Workflow & Delivery Date Gating
    // -------------------------------------------------------------
    console.log('\n--- Section 3: Assigned Faculty Workflow & Delivery Date Gating ---');

    // Fetch assigned question papers for the designated recipient faculty
    const assignedRes = await httpRequest({
      method: 'GET',
      path: '/api/question-papers/assigned',
      headers: { Authorization: `Bearer ${teacherRecipientToken}` },
    });

    assert(assignedRes.statusCode === 200, 'GET /api/question-papers/assigned returns 200 OK');
    assert(Array.isArray(assignedRes.body?.data), 'Assigned endpoint returns data array');
    const assignedPaper = assignedRes.body?.data?.find((p) => p.id === createdPaperId);
    assert(Boolean(assignedPaper), 'Submitted paper appears in recipient faculty assigned papers list');
    assert(assignedPaper?.teacher?.name === MOCK_USERS.teacherAuthor.name, 'Assigned paper reflects author faculty details');
    assert(assignedPaper?.isDeliverable === false, 'isDeliverable evaluates to false when current date < scheduledDeliveryDate');
    assert(assignedPaper?.deliveryStatus === 'SCHEDULED', 'deliveryStatus reflects SCHEDULED when gated');

    // Verify next-day delivery gating: Assigned recipient attempting to download gated paper returns 403 Forbidden
    const gatedDownloadRes = await httpRequest({
      method: 'GET',
      path: `/api/question-papers/${createdPaperId}/download`,
      headers: { Authorization: `Bearer ${teacherRecipientToken}` },
    });

    assert(gatedDownloadRes.statusCode === 403, 'Assigned recipient downloading before delivery date receives 403 Forbidden');
    assert(gatedDownloadRes.body?.success === false, 'Gated download response contains success: false');
    assert(gatedDownloadRes.body?.message?.includes('scheduled for delivery'), 'Gated response explains delivery date restriction clearly');

    // Authoring teacher is exempt from delivery date gating and can download immediately
    const authorDownloadRes = await httpRequest({
      method: 'GET',
      path: `/api/question-papers/${createdPaperId}/download`,
      headers: { Authorization: `Bearer ${teacherAuthorToken}` },
    });

    assert(authorDownloadRes.statusCode === 200, 'Authoring teacher downloading paper returns 200 OK');
    assert(authorDownloadRes.headers['content-type'] === 'application/pdf', 'Download returns application/pdf content type');
    assert(authorDownloadRes.rawBuffer.toString('utf8').includes('%PDF-1.4'), 'Decrypted stream matches original PDF binary');

    // -------------------------------------------------------------
    // Section 4: Verify-Before-Decrypt Pipeline & Tamper Defense
    // -------------------------------------------------------------
    console.log('\n--- Section 4: Verify-Before-Decrypt Pipeline & Tamper Defense ---');

    // Live signature verification on stored paper
    const sigVerifyRes = await httpRequest({
      method: 'GET',
      path: `/api/question-papers/${createdPaperId}/verify-signature`,
      headers: { Authorization: `Bearer ${teacherAuthorToken}` },
    });

    assert(sigVerifyRes.statusCode === 200, 'GET /api/question-papers/:id/verify-signature returns 200 OK');
    assert(sigVerifyRes.body?.data?.verified === true, 'RSA-PSS signature over ciphertext is verified: true');
    assert(sigVerifyRes.body?.data?.tamperDetected === false, 'tamperDetected is false for authentic stored paper');
    assert(sigVerifyRes.body?.data?.algorithm === 'RSA-PSS-SHA256', 'Verified algorithm is RSA-PSS-SHA256');

    // Simulate tampering with stored ciphertext in storage
    const paperRec = inMemoryPapers.get(createdPaperId);
    const originalCiphertext = inMemoryStorage.get(paperRec.storage_path);
    const tamperedCiphertext = Buffer.from(originalCiphertext);
    tamperedCiphertext[tamperedCiphertext.length - 1] ^= 0x55; // Flip byte
    inMemoryStorage.set(paperRec.storage_path, tamperedCiphertext);

    // Verify signature on tampered ciphertext
    const tamperedVerifyRes = await httpRequest({
      method: 'GET',
      path: `/api/question-papers/${createdPaperId}/verify-signature`,
      headers: { Authorization: `Bearer ${teacherAuthorToken}` },
    });

    assert(tamperedVerifyRes.statusCode === 200, 'Verification check executes without unhandled crash');
    assert(tamperedVerifyRes.body?.data?.verified === false, 'Tampered ciphertext fails signature verification (verified: false)');
    assert(tamperedVerifyRes.body?.data?.tamperDetected === true, 'tamperDetected evaluates to true for altered ciphertext');

    // Verify-Before-Decrypt stops execution and refuses to decrypt tampered paper
    const tamperedDownloadRes = await httpRequest({
      method: 'GET',
      path: `/api/question-papers/${createdPaperId}/download`,
      headers: { Authorization: `Bearer ${teacherAuthorToken}` },
    });

    assert(tamperedDownloadRes.statusCode === 400, 'Tampered download halts with 400 Bad Request');
    assert(tamperedDownloadRes.body?.success === false, 'Tampered response indicates failure');
    assert(!tamperedDownloadRes.rawBuffer.toString('utf8').includes('%PDF-1.4'), 'Decrypted plaintext is NEVER returned on tamper failure');

    // Restore authentic ciphertext
    inMemoryStorage.set(paperRec.storage_path, originalCiphertext);

    // -------------------------------------------------------------
    // Section 5: Answer Key Submission Window & Gating
    // -------------------------------------------------------------
    console.log('\n--- Section 5: Answer Key Submission Window & Gating ---');

    // Answer Key upload before exam date is blocked
    const earlyAnswerKeyData = createMultipartFormData(
      {},
      {
        name: 'file',
        filename: 'answer_key_early.pdf',
        contentType: 'application/pdf',
        buffer: samplePdfBuffer,
      }
    );

    const earlyAkRes = await httpRequest({
      method: 'POST',
      path: `/api/teacher/question-papers/${createdPaperId}/answer-key`,
      headers: {
        Authorization: `Bearer ${teacherAuthorToken}`,
        'Content-Type': earlyAnswerKeyData.contentType,
      },
      body: earlyAnswerKeyData.body,
    });

    assert(earlyAkRes.statusCode === 400, 'Answer Key upload before exam date rejected with 400 Bad Request');
    assert(earlyAkRes.body?.success === false, 'Early Answer Key response has success: false');
    assert(earlyAkRes.body?.message?.toLowerCase().includes('before'), 'Rejection message explains upload before examination date is prohibited');

    // -------------------------------------------------------------
    // Section 6: Notification Lifecycle & Read State
    // -------------------------------------------------------------
    console.log('\n--- Section 6: Notification Lifecycle & Read State ---');

    // Check notifications for recipient
    const notifRes = await httpRequest({
      method: 'GET',
      path: '/api/notifications',
      headers: { Authorization: `Bearer ${teacherRecipientToken}` },
    });

    assert(notifRes.statusCode === 200, 'GET /api/notifications returns 200 OK');
    assert(Array.isArray(notifRes.body?.data), 'Notifications response contains array');
    assert(notifRes.body?.data?.length > 0, 'Recipient has received question paper assignment notification');
    const targetNotif = notifRes.body?.data?.[0];

    // Check unread count
    const unreadRes = await httpRequest({
      method: 'GET',
      path: '/api/notifications/unread-count',
      headers: { Authorization: `Bearer ${teacherRecipientToken}` },
    });
    assert(unreadRes.statusCode === 200, 'GET /api/notifications/unread-count returns 200 OK');
    assert(unreadRes.body?.data?.count > 0, 'Unread notification count is positive');

    // Mark single notification as read
    const markReadRes = await httpRequest({
      method: 'PATCH',
      path: `/api/notifications/${targetNotif.id}/read`,
      headers: { Authorization: `Bearer ${teacherRecipientToken}` },
    });
    assert(markReadRes.statusCode === 200, 'PATCH /api/notifications/:id/read returns 200 OK');

    // Mark all as read
    const markAllRes = await httpRequest({
      method: 'PATCH',
      path: '/api/notifications/read-all',
      headers: { Authorization: `Bearer ${teacherRecipientToken}` },
    });
    assert(markAllRes.statusCode === 200, 'PATCH /api/notifications/read-all returns 200 OK');

    // -------------------------------------------------------------
    // Section 7: Administrative Safeguards & Credential Management
    // -------------------------------------------------------------
    console.log('\n--- Section 7: Administrative Safeguards & Credential Management ---');

    // Self-lockout prevention
    const selfLockoutRes = await httpRequest({
      method: 'PATCH',
      path: `/api/admin/users/${MOCK_USERS.admin.userId}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { isActive: false },
    });
    assert(selfLockoutRes.statusCode === 400, 'Admin attempting self-deactivation blocked with 400 Bad Request');
    assert(selfLockoutRes.body?.message?.includes('own account'), 'Self-lockout response contains clear policy warning');

    // Last-active-admin protection
    const lastAdminRes = await httpRequest({
      method: 'PATCH',
      path: `/api/admin/users/${MOCK_USERS.admin.userId}/role`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { role: 'TEACHER' },
    });
    assert(lastAdminRes.statusCode === 400, 'Self-demotion blocked with 400 Bad Request');

    // Audit logs immutability (405 Method Not Allowed)
    const auditMutateRes = await httpRequest({
      method: 'POST',
      path: '/api/audit-logs',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { action: 'FORGED_LOG' },
    });
    assert(auditMutateRes.statusCode === 405, 'POST to /api/audit-logs returns 405 Method Not Allowed');

    // -------------------------------------------------------------
    // Section 8: Zero Secrets Leakage Audit
    // -------------------------------------------------------------
    console.log('\n--- Section 8: Zero Secrets Leakage Audit ---');

    // Audit Users API for secret exposure
    const usersRes = await httpRequest({
      method: 'GET',
      path: '/api/admin/users',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const usersJson = JSON.stringify(usersRes.body);
    assert(!usersJson.includes('password_hash'), 'Users endpoint strictly omits password_hash');
    assert(!usersJson.includes('password"'), 'Users endpoint strictly omits plaintext password');

    // Audit Assigned Papers API for secret exposure
    const assignedPapersJson = JSON.stringify(assignedRes.body);
    assert(!assignedPapersJson.includes('storage_path'), 'Assigned papers endpoint strictly omits internal storage_path');
    assert(!assignedPapersJson.includes('encrypted_aes_key'), 'Assigned papers endpoint strictly omits encrypted_aes_key');
    assert(!assignedPapersJson.includes('auth_tag'), 'Assigned papers endpoint strictly omits auth_tag');
    assert(!assignedPapersJson.includes('iv"'), 'Assigned papers endpoint strictly omits iv');

    // Audit Notifications API for secret exposure
    const notifsJson = JSON.stringify(notifRes.body);
    assert(!notifsJson.includes('storage_path'), 'Notifications endpoint strictly omits internal storage_path');
    assert(!notifsJson.includes('encrypted_aes_key'), 'Notifications endpoint strictly omits encrypted_aes_key');

    console.log('\n============================================================');
    console.log('  MODULE 15 VERIFICATION COMPLETED SUCCESSFULLY');
    console.log(`  Passed: ${passedCount} / ${totalAssertions} Assertions`);
    console.log('  Failed: 0');
    console.log('============================================================\n');

  } finally {
    server.close();
  }
}

runSystemIntegrationSuite().catch((err) => {
  console.error('\n✗ Test Suite Execution Failed:', err);
  process.exit(1);
});

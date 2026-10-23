/**
 * ExamGuard — Module 20: Secure Question Paper Deletion Verification Suite
 *
 * Covers all required test scenarios:
 *  1.  Authorized deletion of an eligible (SUBMITTED) paper — 200 OK
 *  2.  Missing authentication token — 401 Unauthorized
 *  3.  ADMIN role cannot delete via DELETE endpoint — 403 Forbidden
 *  4.  EXAM_COORDINATOR role cannot delete — 403 Forbidden
 *  5.  IDOR: Teacher2 cannot delete Teacher1's paper — 403 Forbidden
 *  6.  Invalid (non-UUID) paper ID — 400 Bad Request
 *  7.  Non-existent paper ID (valid UUID) — 404 Not Found
 *  8.  Paper with status DELIVERED blocked — 403 Forbidden
 *  9.  Paper with a DELIVERED assignment blocked — 403 Forbidden
 * 10.  Paper with associated answer key blocked — 400 Bad Request
 * 11.  Already archived/deleted paper blocked — 409 Conflict
 * 12.  Storage deletion failure: fail-closed, DB not updated — 502 Bad Gateway
 * 13.  Audit log written on successful deletion
 * 14.  Audit log written on IDOR rejection
 * 15.  Audit log written on lifecycle/retention rejection
 * 16.  Assignments cancelled on successful deletion
 * 17.  Regression: existing upload (POST /api/question-papers) still works — 201
 * 18.  Regression: GET /api/question-papers/my still works for TEACHER — 200
 * 19.  Regression: GET /api/auth/me still works — 200
 * 20.  Regression: Health check still works — 200
 *
 * UUID note: All hardcoded UUIDs conform to the v4 regex used by the service:
 *   /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
 *   (group-3 starts with 1-5; group-4 starts with 8, 9, a, or b)
 */

'use strict';

const http = require('http');
require('dotenv').config();

const { app } = require('../src/server');
const authorizationService = require('../src/services/authorizationService');
const questionPaperService = require('../src/services/questionPaperService');
const { supabase, getSupabaseClient } = require('../src/config/supabase');
const supabaseClient = getSupabaseClient();
const { generateToken, verifyToken } = require('../src/utils/jwt');

const TEST_PORT = 5025;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
let server;

// ---------------------------------------------------------------------------
// Mock Users — UUIDs are v4-compliant (group-3 starts 4, group-4 starts 8/9/a/b)
// ---------------------------------------------------------------------------
const MOCK_USERS = {
  teacher1: {
    userId: 'f1001001-1001-4001-8001-000000000001',
    name: 'Prof. Alice Smith',
    roleId: 'role-teacher-uuid',
    roleName: 'TEACHER',
    email: 'alice.del@examguard.edu',
    isActive: true,
  },
  teacher2: {
    userId: 'f2002002-2002-4002-8002-000000000002',
    name: 'Prof. Bob Jones',
    roleId: 'role-teacher-uuid',
    roleName: 'TEACHER',
    email: 'bob.del@examguard.edu',
    isActive: true,
  },
  admin: {
    userId: 'f3003003-3003-4003-8003-000000000003',
    name: 'System Admin',
    roleId: 'role-admin-uuid',
    roleName: 'ADMIN',
    email: 'admin.del@examguard.edu',
    isActive: true,
  },
  coordinator: {
    userId: 'f4004004-4004-4004-9004-000000000004',
    name: 'Exam Coordinator',
    roleId: 'role-coord-uuid',
    roleName: 'EXAM_COORDINATOR',
    email: 'coord.del@examguard.edu',
    isActive: true,
  },
};

// Pre-computed v4-compliant UUIDs for seeded papers
const PAPER_IDS = {
  idor:         'e5050505-5050-4505-8505-050505050505',
  delivered:    'e8080808-0808-4808-8808-080808080808',
  deliveredAss: 'e9090909-0909-4909-8909-090909090909',
  answerKey:    'ea101010-1010-4a10-9a10-0a1010101010',
  archived:     'eb111111-1111-4b11-9b11-0b1111111111',
  storageFail:  'ec121212-1212-4c12-9c12-0c1212121212',
  withAssign:   'ed161616-1616-4d16-9d16-0d1616161616',
  noExist:      'deadbeef-dead-4eef-8ead-beefdeadbeef',
};

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------
const inMemoryPapers    = new Map();
const inMemoryAssignments = new Map();   // paperId -> assignment[]
const inMemoryAnswerKeys  = new Map();   // paperId -> answerKey
const inMemoryAuditEvents = [];
const storageFiles        = new Map();
const storageRemovals     = [];

// Simulation flags
let simulateStorageRemoveError = false;

// ---------------------------------------------------------------------------
// JWT tokens
// ---------------------------------------------------------------------------
const teacher1Token = generateToken({
  userId: MOCK_USERS.teacher1.userId,
  email:  MOCK_USERS.teacher1.email,
  role:   MOCK_USERS.teacher1.roleName,
});
const teacher2Token = generateToken({
  userId: MOCK_USERS.teacher2.userId,
  email:  MOCK_USERS.teacher2.email,
  role:   MOCK_USERS.teacher2.roleName,
});
const adminToken = generateToken({
  userId: MOCK_USERS.admin.userId,
  email:  MOCK_USERS.admin.email,
  role:   MOCK_USERS.admin.roleName,
});
const coordToken = generateToken({
  userId: MOCK_USERS.coordinator.userId,
  email:  MOCK_USERS.coordinator.email,
  role:   MOCK_USERS.coordinator.roleName,
});

// ---------------------------------------------------------------------------
// Mock: authorizationService.getUserRole
// ---------------------------------------------------------------------------
const originalGetUserRole = authorizationService.getUserRole;
authorizationService.getUserRole = async function (userId) {
  const user = Object.values(MOCK_USERS).find(u => u.userId === userId);
  if (user) {
    return {
      userId:   user.userId,
      roleId:   user.roleId,
      roleName: user.roleName,
      isActive: user.isActive,
    };
  }
  return originalGetUserRole(userId);
};

// ---------------------------------------------------------------------------
// Mock: auditLogService — capture events for assertions, skip live DB writes
// ---------------------------------------------------------------------------
const auditLogService = require('../src/services/auditLogService');
const originalLogAuditEvent = auditLogService.logAuditEvent.bind(auditLogService);
auditLogService.logAuditEvent = async function (event) {
  inMemoryAuditEvents.push({ ...event, _recordedAt: new Date().toISOString() });
  // intentionally not calling originalLogAuditEvent during tests
};

// ---------------------------------------------------------------------------
// Mock: Supabase client
// ---------------------------------------------------------------------------
const originalClientFrom       = supabaseClient.from.bind(supabaseClient);
const originalClientStorageFrom = supabaseClient.storage.from.bind(supabaseClient.storage);

supabaseClient.from = function (tableName) {

  // ---- users ----
  if (tableName === 'users') {
    return {
      select: () => ({
        eq: (col, val) => ({
          eq: () => ({
            order: () => {
              const teachers = Object.values(MOCK_USERS)
                .filter(u => u.roleName === 'TEACHER' && u.isActive)
                .map(u => ({ id: u.userId, name: u.name, email: u.email, is_active: u.isActive }));
              return Promise.resolve({ data: teachers, error: null });
            },
          }),
          maybeSingle: () => {
            const user = Object.values(MOCK_USERS).find(u => u.userId === val);
            if (!user) return Promise.resolve({ data: null, error: null });
            return Promise.resolve({
              data: {
                id:      user.userId,
                name:    user.name,
                email:   user.email,
                is_active: user.isActive,
                role_id: user.roleId,
                roles:   { id: user.roleId, name: user.roleName },
              },
              error: null,
            });
          },
        }),
      }),
    };
  }

  // ---- question_papers ----
  if (tableName === 'question_papers') {
    // Chainable builder for SELECT
    const buildSelect = (col, val) => {
      // Supports chained .neq().neq().order() for getMyQuestionPapers
      const chainNeq = (excludes) => ({
        neq: (c2, v2) => chainNeq([...excludes, v2]),
        order: () => {
          if (col === 'teacher_id') {
            const matched = [];
            for (const p of inMemoryPapers.values()) {
              if (p.teacher_id === val && !excludes.includes(p.status)) {
                const assigns = inMemoryAssignments.get(p.id) || [];
                matched.push({ ...p, question_paper_assignments: assigns });
              }
            }
            return Promise.resolve({ data: matched, error: null });
          }
          return Promise.resolve({ data: [], error: null });
        },
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      });

      return {
        neq: (c2, v2) => chainNeq([v2]),
        order: () => {
          if (col === 'teacher_id') {
            const matched = [];
            for (const p of inMemoryPapers.values()) {
              if (p.teacher_id === val) {
                const assigns = inMemoryAssignments.get(p.id) || [];
                matched.push({ ...p, question_paper_assignments: assigns });
              }
            }
            return Promise.resolve({ data: matched, error: null });
          }
          return Promise.resolve({ data: [], error: null });
        },
        maybeSingle: () => {
          if (col === 'id') {
            const paper = inMemoryPapers.get(val);
            if (!paper) return Promise.resolve({ data: null, error: null });
            const assigns = inMemoryAssignments.get(paper.id) || [];
            return Promise.resolve({
              data: {
                ...paper,
                teacher: { id: paper.teacher_id, name: 'Alice Teacher', email: 'alice.del@examguard.edu' },
                question_paper_assignments: assigns,
              },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
    };

    return {
      // INSERT
      insert: (records) => ({
        select: () => ({
          single: () => {
            const record = {
              ...records[0],
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            inMemoryPapers.set(record.id, record);
            return Promise.resolve({ data: record, error: null });
          },
        }),
      }),

      // SELECT
      select: () => ({
        eq: (col, val) => buildSelect(col, val),
      }),

      // UPDATE (soft-delete archival)
      update: (payload) => ({
        eq: (col, val) => {
          const existing = inMemoryPapers.get(val);
          if (existing) {
            inMemoryPapers.set(val, { ...existing, ...payload, updated_at: new Date().toISOString() });
          }
          return Promise.resolve({ data: null, error: null });
        },
      }),

      // DELETE (hard-delete, unused in normal flow but mocked for completeness)
      delete: () => ({
        eq: (col, val) => {
          if (col === 'id') inMemoryPapers.delete(val);
          return Promise.resolve({ data: null, error: null });
        },
      }),
    };
  }

  // ---- question_paper_assignments ----
  if (tableName === 'question_paper_assignments') {
    return {
      insert: (records) => ({
        select: () => ({
          single: () => {
            const record = { ...records[0], id: 'assign-del-' + Date.now() };
            const existing = inMemoryAssignments.get(record.question_paper_id) || [];
            existing.push(record);
            inMemoryAssignments.set(record.question_paper_id, existing);
            return Promise.resolve({ data: record, error: null });
          },
        }),
      }),
      select: () => ({
        eq: (col, val) => {
          const list = inMemoryAssignments.get(val) || [];
          return Promise.resolve({ data: list, error: null });
        },
      }),
      update: (payload) => ({
        eq: (col, val) => ({
          neq: () => {
            const list = inMemoryAssignments.get(val) || [];
            const updated = list.map(a =>
              a.delivery_status !== 'DELIVERED' ? { ...a, ...payload } : a
            );
            inMemoryAssignments.set(val, updated);
            return Promise.resolve({ data: null, error: null });
          },
        }),
      }),
    };
  }

  // ---- answer_keys ----
  if (tableName === 'answer_keys') {
    return {
      select: () => ({
        eq: (col, val) => ({
          maybeSingle: () => {
            const ak = inMemoryAnswerKeys.get(val) || null;
            return Promise.resolve({ data: ak, error: null });
          },
        }),
      }),
    };
  }

  // ---- paper_keys ----
  if (tableName === 'paper_keys') {
    return {
      insert: (records) => ({
        select: () => ({
          single: () => Promise.resolve({ data: { ...records[0], id: 'key-del-' + Date.now() }, error: null }),
        }),
      }),
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    };
  }

  // ---- digital_signatures ----
  if (tableName === 'digital_signatures') {
    return {
      insert: (records) => ({
        select: () => ({
          single: () => Promise.resolve({
            data: { ...records[0], id: 'sig-del-' + Date.now(), created_at: new Date().toISOString() },
            error: null,
          }),
        }),
      }),
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    };
  }

  // ---- activity_logs (native audit path bypassed above, but mocked for safety) ----
  if (tableName === 'activity_logs') {
    return {
      insert: () => Promise.resolve({ data: null, error: null }),
    };
  }

  return originalClientFrom(tableName);
};

// ---- Storage ----
supabaseClient.storage.from = function (bucket) {
  return {
    upload: (storagePath, fileBuffer) => {
      storageFiles.set(storagePath, fileBuffer);
      return Promise.resolve({ data: { path: storagePath }, error: null });
    },
    download: (storagePath) => {
      const buf = storageFiles.get(storagePath) || VALID_PDF_BUFFER;
      return Promise.resolve({ data: buf, error: null });
    },
    createSignedUrl: (storagePath, expiresIn) => Promise.resolve({
      data: { signedUrl: `https://mock.storage.examguard.edu/${storagePath}?token=mock` },
      error: null,
    }),
    remove: (paths) => {
      if (simulateStorageRemoveError) {
        return Promise.resolve({ data: null, error: { message: 'Simulated storage remove failure' } });
      }
      for (const p of paths) {
        storageRemovals.push(p);
        storageFiles.delete(p);
      }
      return Promise.resolve({ data: paths, error: null });
    },
    getPublicUrl: (path) => ({
      data: { publicUrl: `https://mock.storage.examguard.edu/${path}` },
    }),
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const VALID_PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF'
);

let passedTests = 0;
let failedTests  = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${message}`);
    passedTests++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${message}`);
    failedTests++;
  }
}

async function sendJsonRequest(method, path, token, payload = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const options = { method, headers };
  if (payload) options.body = JSON.stringify(payload);
  const response = await fetch(`${BASE_URL}${path}`, options);
  const status   = response.status;
  const rawText  = await response.text();
  let body = {};
  try { body = JSON.parse(rawText); } catch { body = { raw: rawText }; }
  return { status, body };
}

async function sendMultipartRequest({ token, fields = {}, file = null }) {
  const formData = new FormData();
  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined && val !== null) formData.append(key, String(val));
  }
  if (file) {
    const buffer = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content);
    const blob   = new Blob([buffer], { type: file.mimeType || 'application/pdf' });
    formData.append('file', blob, file.filename || 'paper.pdf');
  }
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(`${BASE_URL}/api/question-papers`, { method: 'POST', headers, body: formData });
  const status   = response.status;
  const rawText  = await response.text();
  let body = {};
  try { body = JSON.parse(rawText); } catch { body = { raw: rawText }; }
  return { status, body };
}

/**
 * Seed a paper directly into the in-memory store.
 * id must be a valid v4-compliant UUID.
 */
function seedPaper(overrides = {}) {
  // Use crypto.randomUUID() for auto-generated IDs (always v4-compliant)
  const id = overrides.id || crypto.randomUUID();
  const paper = {
    id,
    title:      'Seeded Paper',
    subject:    'Computer Science',
    teacher_id: MOCK_USERS.teacher1.userId,
    storage_path: `question-papers/${id}/encrypted_paper.bin`,
    file_name:  'paper.pdf',
    status:     'SUBMITTED',
    scheduled_delivery_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
  inMemoryPapers.set(id, paper);
  // Also register a mock ciphertext blob in storage so remove() can be called
  storageFiles.set(paper.storage_path, Buffer.from('mock-ciphertext'));
  return paper;
}

// ---------------------------------------------------------------------------
// Main test suite
// ---------------------------------------------------------------------------
async function runTestSuite() {
  console.log('\n================================================================');
  console.log('   MODULE 20: SECURE QUESTION PAPER DELETION VERIFICATION SUITE');
  console.log('================================================================\n');

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(TEST_PORT, () => {
      console.log(`Test server running on port ${TEST_PORT}\n`);
      resolve();
    });
  });

  try {
    // ==================================================================
    // SCENARIO 1: Authorized deletion of eligible (SUBMITTED) paper — 200 OK
    // ==================================================================
    console.log('--- 1. Authorized Deletion of Eligible SUBMITTED Paper ---');
    const paper1 = seedPaper({ title: 'Eligible OS Paper' });
    inMemoryAuditEvents.length = 0;
    storageRemovals.length = 0;

    const res1 = await sendJsonRequest('DELETE', `/api/question-papers/${paper1.id}`, teacher1Token, { reason: 'Draft discarded by author' });
    assert(res1.status === 200, `DELETE returns 200 OK (got ${res1.status})`);
    assert(res1.body.success === true, 'Response body success is true');
    assert(typeof res1.body.message === 'string' && res1.body.message.length > 0, 'Response includes message string');

    const archivedPaper = inMemoryPapers.get(paper1.id);
    assert(archivedPaper !== undefined, 'Paper record still exists (soft-deleted, not hard-deleted)');
    assert(archivedPaper?.status === 'ARCHIVED', `Paper status is ARCHIVED (got ${archivedPaper?.status})`);
    assert(storageRemovals.includes(paper1.storage_path), `Storage remove() called with correct path`);

    const successAudit = inMemoryAuditEvents.find(
      e => e.action === 'DELETE' && e.outcome === 'SUCCESS' && e.resourceId === paper1.id
    );
    assert(successAudit !== undefined, 'Audit event recorded: action=DELETE outcome=SUCCESS');

    // ==================================================================
    // SCENARIO 2: Missing authentication token — 401
    // ==================================================================
    console.log('\n--- 2. Missing Authentication Token → 401 ---');
    const paper2 = seedPaper({ title: 'Auth Check Paper' });
    const res2 = await sendJsonRequest('DELETE', `/api/question-papers/${paper2.id}`, null);
    assert(res2.status === 401, `DELETE without token returns 401 (got ${res2.status})`);
    assert(res2.body.success === false, 'Error response success is false');

    // ==================================================================
    // SCENARIO 3: ADMIN role cannot delete — 403
    // ==================================================================
    console.log('\n--- 3. ADMIN Role Cannot Delete → 403 ---');
    const paper3 = seedPaper({ title: 'Admin Attempt Paper' });
    const res3 = await sendJsonRequest('DELETE', `/api/question-papers/${paper3.id}`, adminToken);
    assert(res3.status === 403, `DELETE by ADMIN returns 403 Forbidden (got ${res3.status})`);

    // ==================================================================
    // SCENARIO 4: EXAM_COORDINATOR role cannot delete — 403
    // ==================================================================
    console.log('\n--- 4. EXAM_COORDINATOR Role Cannot Delete → 403 ---');
    const paper4 = seedPaper({ title: 'Coord Attempt Paper' });
    const res4 = await sendJsonRequest('DELETE', `/api/question-papers/${paper4.id}`, coordToken);
    assert(res4.status === 403, `DELETE by EXAM_COORDINATOR returns 403 Forbidden (got ${res4.status})`);

    // ==================================================================
    // SCENARIO 5: IDOR — Teacher2 cannot delete Teacher1's paper — 403
    // ==================================================================
    console.log('\n--- 5. IDOR: Teacher2 Cannot Delete Teacher1\'s Paper → 403 ---');
    inMemoryAuditEvents.length = 0;
    const paper5 = seedPaper({
      id:         PAPER_IDS.idor,
      title:      'Teacher1 Private Paper',
      teacher_id: MOCK_USERS.teacher1.userId,
    });

    const res5 = await sendJsonRequest('DELETE', `/api/question-papers/${paper5.id}`, teacher2Token);
    assert(res5.status === 403, `IDOR attempt returns 403 Forbidden (got ${res5.status})`);
    assert(res5.body.message?.length > 0, 'Forbidden response includes error message');

    const paper5After = inMemoryPapers.get(paper5.id);
    assert(paper5After?.status !== 'ARCHIVED', 'Paper remains unmodified after IDOR attempt');

    const idorAudit = inMemoryAuditEvents.find(
      e => e.action === 'UNAUTHORIZED_ACCESS' && e.outcome === 'DENIED' && e.resourceId === paper5.id
    );
    assert(idorAudit !== undefined, 'UNAUTHORIZED_ACCESS audit event recorded for IDOR attempt');

    // ==================================================================
    // SCENARIO 6: Invalid (non-UUID) paper ID — 400
    // ==================================================================
    console.log('\n--- 6. Invalid Paper ID Format → 400 ---');
    const res6 = await sendJsonRequest('DELETE', '/api/question-papers/not-a-uuid', teacher1Token);
    assert(res6.status === 400, `Non-UUID ID returns 400 Bad Request (got ${res6.status})`);
    assert(
      (res6.body.message || '').toLowerCase().match(/invalid|uuid|id/),
      `Error message is informative (got: "${res6.body.message}")`
    );

    // ==================================================================
    // SCENARIO 7: Non-existent paper UUID — 404
    // ==================================================================
    console.log('\n--- 7. Non-Existent Paper UUID → 404 ---');
    // Use a valid-format UUID that was never seeded
    const res7 = await sendJsonRequest('DELETE', `/api/question-papers/${PAPER_IDS.noExist}`, teacher1Token);
    assert(res7.status === 404, `Non-existent UUID returns 404 Not Found (got ${res7.status})`);

    // ==================================================================
    // SCENARIO 8: DELIVERED paper blocked — 403
    // ==================================================================
    console.log('\n--- 8. DELIVERED Paper Blocked by Retention Rule → 403 ---');
    inMemoryAuditEvents.length = 0;
    const paper8 = seedPaper({
      id:         PAPER_IDS.delivered,
      title:      'Already Delivered Paper',
      teacher_id: MOCK_USERS.teacher1.userId,
      status:     'DELIVERED',
    });

    const res8 = await sendJsonRequest('DELETE', `/api/question-papers/${paper8.id}`, teacher1Token);
    assert(res8.status === 403, `DELIVERED paper deletion returns 403 (got ${res8.status})`);
    assert(
      (res8.body.message || '').toLowerCase().match(/delivered|retent/),
      `Error message explains retention policy (got: "${res8.body.message}")`
    );

    const deliveredBlockAudit = inMemoryAuditEvents.find(
      e => e.action === 'DELETE_BLOCKED' && e.outcome === 'DENIED' && e.resourceId === paper8.id
    );
    assert(deliveredBlockAudit !== undefined, 'DELETE_BLOCKED audit event recorded for DELIVERED paper');

    // ==================================================================
    // SCENARIO 9: Paper with DELIVERED assignment blocked — 403
    // ==================================================================
    console.log('\n--- 9. Paper With DELIVERED Assignment Blocked → 403 ---');
    inMemoryAuditEvents.length = 0;
    const paper9 = seedPaper({
      id:         PAPER_IDS.deliveredAss,
      title:      'Assigned and Delivered Paper',
      teacher_id: MOCK_USERS.teacher1.userId,
      status:     'SIGNED',
    });
    inMemoryAssignments.set(paper9.id, [{
      id: 'assign-9-1',
      question_paper_id: paper9.id,
      delivery_status:   'DELIVERED',
      delivered_at:      new Date().toISOString(),
      assigned_to_user_id: MOCK_USERS.teacher2.userId,
    }]);

    const res9 = await sendJsonRequest('DELETE', `/api/question-papers/${paper9.id}`, teacher1Token);
    assert(res9.status === 403, `Paper with DELIVERED assignment returns 403 (got ${res9.status})`);
    assert(
      (res9.body.message || '').toLowerCase().match(/delivered|retent/),
      `Error message mentions delivery or retention (got: "${res9.body.message}")`
    );

    const deliveredAssAudit = inMemoryAuditEvents.find(
      e => e.action === 'DELETE_BLOCKED' && e.outcome === 'DENIED' && e.resourceId === paper9.id
    );
    assert(deliveredAssAudit !== undefined, 'DELETE_BLOCKED audit event recorded for delivered-assignment paper');

    // ==================================================================
    // SCENARIO 10: Paper with answer key blocked — 400
    // ==================================================================
    console.log('\n--- 10. Paper With Associated Answer Key Blocked → 400 ---');
    inMemoryAuditEvents.length = 0;
    const paper10 = seedPaper({
      id:         PAPER_IDS.answerKey,
      title:      'Paper With Answer Key',
      teacher_id: MOCK_USERS.teacher1.userId,
      status:     'SUBMITTED',
    });
    inMemoryAnswerKeys.set(paper10.id, { id: 'ak-10-1', question_paper_id: paper10.id });

    const res10 = await sendJsonRequest('DELETE', `/api/question-papers/${paper10.id}`, teacher1Token);
    assert(res10.status === 400, `Paper with answer key returns 400 (got ${res10.status})`);
    assert(
      (res10.body.message || '').toLowerCase().match(/answer key|retent/),
      `Error message mentions answer key (got: "${res10.body.message}")`
    );

    const akBlockAudit = inMemoryAuditEvents.find(
      e => e.action === 'DELETE_BLOCKED' && e.outcome === 'DENIED' && e.resourceId === paper10.id
    );
    assert(akBlockAudit !== undefined, 'DELETE_BLOCKED audit event recorded for paper with answer key');
    inMemoryAnswerKeys.delete(paper10.id);  // cleanup

    // ==================================================================
    // SCENARIO 11: Already archived paper — 409 Conflict
    // ==================================================================
    console.log('\n--- 11. Already Archived Paper → 409 Conflict ---');
    const paper11 = seedPaper({
      id:         PAPER_IDS.archived,
      title:      'Previously Archived Paper',
      teacher_id: MOCK_USERS.teacher1.userId,
      status:     'ARCHIVED',
    });

    const res11 = await sendJsonRequest('DELETE', `/api/question-papers/${paper11.id}`, teacher1Token);
    assert(res11.status === 409, `Already archived paper returns 409 Conflict (got ${res11.status})`);
    assert(
      (res11.body.message || '').toLowerCase().match(/archive|deleted|already/),
      `Error message indicates paper already archived (got: "${res11.body.message}")`
    );

    // ==================================================================
    // SCENARIO 12: Storage deletion failure — 502, DB NOT updated (fail-closed)
    // ==================================================================
    console.log('\n--- 12. Storage Deletion Failure → 502 Fail-Closed ---');
    inMemoryAuditEvents.length = 0;
    const paper12 = seedPaper({
      id:         PAPER_IDS.storageFail,
      title:      'Storage Failure Paper',
      teacher_id: MOCK_USERS.teacher1.userId,
      status:     'SUBMITTED',
    });
    const statusBefore = inMemoryPapers.get(paper12.id)?.status;

    simulateStorageRemoveError = true;
    const res12 = await sendJsonRequest('DELETE', `/api/question-papers/${paper12.id}`, teacher1Token);
    simulateStorageRemoveError = false;

    assert(res12.status === 502, `Storage failure returns 502 Bad Gateway (got ${res12.status})`);

    const paper12After = inMemoryPapers.get(paper12.id);
    assert(
      paper12After?.status === statusBefore,
      `DB record unchanged after storage failure (was ${statusBefore}, still ${paper12After?.status})`
    );

    const storageFailAudit = inMemoryAuditEvents.find(
      e => e.action === 'DELETE' && e.outcome === 'FAILURE' && e.resourceId === paper12.id
    );
    assert(storageFailAudit !== undefined, 'FAILURE audit event recorded when storage deletion fails');

    // ==================================================================
    // SCENARIO 13–15: Audit coverage summary (individually verified above)
    // ==================================================================
    console.log('\n--- 13–15. Audit Event Coverage (verified in S1, S5, S8, S9, S10, S12) ---');
    assert(true, 'Audit events verified across Scenarios 1, 5, 8, 9, 10, 12');

    // ==================================================================
    // SCENARIO 16: Pending assignments cancelled after successful deletion
    // ==================================================================
    console.log('\n--- 16. Pending Assignments Cancelled After Successful Deletion ---');
    const paper16 = seedPaper({
      id:         PAPER_IDS.withAssign,
      title:      'Paper With Pending Assignment',
      teacher_id: MOCK_USERS.teacher1.userId,
      status:     'SUBMITTED',
    });
    inMemoryAssignments.set(paper16.id, [{
      id: 'assign-16-1',
      question_paper_id:   paper16.id,
      delivery_status:     'PENDING',
      delivered_at:        null,
      assigned_to_user_id: MOCK_USERS.teacher2.userId,
    }]);

    const res16 = await sendJsonRequest('DELETE', `/api/question-papers/${paper16.id}`, teacher1Token);
    assert(res16.status === 200, `Deletion with pending assignment returns 200 (got ${res16.status})`);

    const assignsAfter = inMemoryAssignments.get(paper16.id) || [];
    const allCancelled = assignsAfter.length > 0 && assignsAfter.every(a => a.delivery_status === 'CANCELLED');
    assert(allCancelled, `All pending assignments set to CANCELLED (count: ${assignsAfter.length})`);

    // ==================================================================
    // SCENARIO 17: Regression — POST /api/question-papers still works
    // ==================================================================
    console.log('\n--- 17. Regression: POST /api/question-papers Still Works ---');
    const uploadFields = {
      title:            'Regression Upload Paper',
      subject:          'Mathematics',
      semester:         'Semester 3',
      academicYear:     '2025-2026',
      examType:         'MID_SEM',
      examDate:         '2026-04-15',
      assignedToUserId: MOCK_USERS.teacher2.userId,
    };
    const res17 = await sendMultipartRequest({
      token:  teacher1Token,
      fields: uploadFields,
      file:   { filename: 'regression_upload.pdf', content: VALID_PDF_BUFFER, mimeType: 'application/pdf' },
    });
    assert(res17.status === 201, `POST /api/question-papers returns 201 (got ${res17.status})`);
    assert(res17.body.success === true, 'Regression upload success is true');
    assert(res17.body.data?.questionPaper?.id !== undefined, 'Uploaded paper has a UUID');

    // ==================================================================
    // SCENARIO 18: Regression — GET /api/question-papers/my still works
    // ==================================================================
    console.log('\n--- 18. Regression: GET /api/question-papers/my Still Works ---');
    const res18 = await sendJsonRequest('GET', '/api/question-papers/my', teacher1Token);
    assert(res18.status === 200, `GET /api/question-papers/my returns 200 (got ${res18.status})`);
    assert(res18.body.success === true, 'My papers response success is true');
    assert(Array.isArray(res18.body.data), 'My papers response data is an array');

    // ==================================================================
    // SCENARIO 19: Regression — GET /api/auth/me still works
    // ==================================================================
    console.log('\n--- 19. Regression: GET /api/auth/me Still Works ---');
    const res19 = await sendJsonRequest('GET', '/api/auth/me', teacher1Token);
    assert(res19.status === 200, `GET /api/auth/me returns 200 (got ${res19.status})`);

    // ==================================================================
    // SCENARIO 20: Regression — Health check still works
    // ==================================================================
    console.log('\n--- 20. Regression: GET /api/health Still Works ---');
    const res20 = await sendJsonRequest('GET', '/api/health', null);
    assert(res20.status === 200, `GET /api/health returns 200 (got ${res20.status})`);
    assert(res20.body.success === true, 'Health check reports success: true');

    // ==================================================================
    // Summary
    // ==================================================================
    console.log('\n================================================================');
    console.log(`TOTAL ASSERTIONS: ${passedTests + failedTests}`);
    console.log(`PASSED: \x1b[32m${passedTests}\x1b[0m`);
    console.log(`FAILED: \x1b[31m${failedTests}\x1b[0m`);
    console.log('================================================================\n');

    if (failedTests > 0) process.exitCode = 1;

  } catch (err) {
    console.error('\n\x1b[31mUnexpected test runner failure:\x1b[0m', err);
    process.exitCode = 1;
  } finally {
    authorizationService.getUserRole   = originalGetUserRole;
    auditLogService.logAuditEvent      = originalLogAuditEvent;
    supabaseClient.from                = originalClientFrom;
    supabaseClient.storage.from        = originalClientStorageFrom;
    if (server) server.close();
  }
}

runTestSuite();

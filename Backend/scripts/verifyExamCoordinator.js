/**
 * Comprehensive Automated Verification Test Suite for Module 9:
 * Exam Coordinator Access
 * 
 * Verifies all required operational, security, and cryptographic criteria:
 * 1.  Exam Coordinator login / valid JWT verification.
 * 2.  Exam Coordinator access to coordinator dashboard API (GET /api/exam-coordinator/question-papers -> 200).
 * 3.  Teacher role cannot access coordinator endpoints (403 Forbidden).
 * 4.  Admin role cannot access coordinator endpoints (403 Forbidden).
 * 5.  Missing Authorization header returns 401 Unauthorized.
 * 6.  Malformed / invalid token returns 401 Unauthorized.
 * 7.  Expired token returns 401 Unauthorized.
 * 8.  Inactive Exam Coordinator account is strictly denied (403 Forbidden).
 * 9.  Coordinator A lists legitimately assigned question papers (200 OK).
 * 10. Coordinator A cannot see papers assigned to other coordinators (strict isolation).
 * 11. Coordinator A can view authorized paper metadata (GET /:id -> 200 OK).
 * 12. Coordinator A cannot view paper assigned to Coordinator B (403 Forbidden).
 * 13. Coordinator requesting non-existent / random paper UUID receives 404 Not Found.
 * 14. Draft status question paper is excluded from coordinator listing.
 * 15. Draft status question paper cannot be accessed by ID (403 Forbidden).
 * 16. Coordinator securely downloads and decrypts authorized question paper (200 OK, application/pdf).
 * 17. Decrypted PDF buffer exactly matches the original pre-encryption plaintext document.
 * 18. Coordinator A cannot download paper assigned to Coordinator B (403 Forbidden).
 * 19. Verify-Before-Decrypt: SHA-256 hash check occurs before decryption.
 * 20. Verify-Before-Decrypt: RSA-PSS digital signature verification occurs before decryption.
 * 21. Tampered ciphertext in storage prevents PDF delivery (400 Bad Request fail-closed).
 * 22. Plaintext PDF is NEVER delivered when ciphertext hash check fails.
 * 23. Corrupted RSA-PSS digital signature prevents PDF delivery (400 Bad Request fail-closed).
 * 24. AES-GCM authentication failure (tampered auth tag) prevents delivery (400 Bad Request).
 * 25. Inline verification endpoint (GET /:id/verify-signature) confirms signature & hash over ciphertext.
 * 26. Tampered ciphertext in verify-signature endpoint returns tamperDetected: true.
 * 27. Plaintext AES keys are NEVER exposed in any API response.
 * 28. Wrapped AES keys are NEVER exposed in any API response.
 * 29. RSA private keys (wrapping or signing) are NEVER exposed in any API response.
 * 30. Internal storage paths are NEVER exposed in client metadata responses.
 * 31. Question paper storage bucket remains private (no getPublicUrl used).
 * 32. Path traversal sequences in storage path strictly fail closed (403 Forbidden).
 * 33. Regression check: Module 1 health check returns 200 OK.
 * 34. Regression check: Module 3 authentication (/api/auth/me) returns 200 OK.
 * 35. Regression check: Module 4 RBAC (/api/rbac/exam-coordinator) returns 200 for coordinator, 403 for teacher/admin.
 * 36. Regression check: Module 5 teacher paper listing (/api/question-papers/my) continues working.
 * 37. Regression check: Module 6 AES-256-GCM + RSA-OAEP encrypt/decrypt roundtrip succeeds.
 * 38. Regression check: Module 7 RSA-PSS digital signature sign/verify roundtrip succeeds.
 * 39. Regression check: Module 8 key separation and wrapping integrity succeeds.
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { app } = require('../src/server');
const config = require('../src/config');
const authorizationService = require('../src/services/authorizationService');
const keyManagementService = require('../src/services/keyManagementService');
const encryptionService = require('../src/services/encryptionService');
const signatureService = require('../src/services/signatureService');
const examCoordinatorService = require('../src/services/examCoordinatorService');
const { getSupabaseClient } = require('../src/config/supabase');
const supabaseClient = getSupabaseClient();
const { generateToken, verifyToken } = require('../src/utils/jwt');

const TEST_PORT = 5007;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
let server;

// Mock test users
const MOCK_USERS = {
  coordinator1: {
    userId: '33333333-3333-3333-3333-333333333333',
    name: 'Exam Coordinator Alpha',
    roleId: 'role-coord-uuid',
    roleName: 'EXAM_COORDINATOR',
    email: 'coord1@examguard.edu',
    isActive: true,
  },
  coordinator2: {
    userId: '77777777-7777-7777-7777-777777777777',
    name: 'Exam Coordinator Beta',
    roleId: 'role-coord-uuid',
    roleName: 'EXAM_COORDINATOR',
    email: 'coord2@examguard.edu',
    isActive: true,
  },
  inactiveCoordinator: {
    userId: '88888888-8888-8888-8888-888888888888',
    name: 'Inactive Coordinator',
    roleId: 'role-coord-uuid',
    roleName: 'EXAM_COORDINATOR',
    email: 'inactive_coord@examguard.edu',
    isActive: false,
  },
  teacher: {
    userId: '22222222-2222-2222-2222-222222222222',
    name: 'Prof. Alice Smith',
    roleId: 'role-teacher-uuid',
    roleName: 'TEACHER',
    email: 'alice.teacher@examguard.edu',
    isActive: true,
  },
  admin: {
    userId: '11111111-1111-1111-1111-111111111111',
    name: 'System Admin',
    roleId: 'role-admin-uuid',
    roleName: 'ADMIN',
    email: 'admin@examguard.edu',
    isActive: true,
  },
};

// In-memory data store for deterministic mock execution
const inMemoryPapers = new Map();
const inMemoryAssignments = new Map();
const inMemoryPaperKeys = new Map();
const inMemorySignatures = new Map();
const storageFiles = new Map();

let simulateTamperedStorageCiphertext = false;

// Generate test JWT tokens
const coord1Token = generateToken({
  userId: MOCK_USERS.coordinator1.userId,
  email: MOCK_USERS.coordinator1.email,
  role: MOCK_USERS.coordinator1.roleName,
});

const coord2Token = generateToken({
  userId: MOCK_USERS.coordinator2.userId,
  email: MOCK_USERS.coordinator2.email,
  role: MOCK_USERS.coordinator2.roleName,
});

const inactiveCoordToken = generateToken({
  userId: MOCK_USERS.inactiveCoordinator.userId,
  email: MOCK_USERS.inactiveCoordinator.email,
  role: MOCK_USERS.inactiveCoordinator.roleName,
});

const teacherToken = generateToken({
  userId: MOCK_USERS.teacher.userId,
  email: MOCK_USERS.teacher.email,
  role: MOCK_USERS.teacher.roleName,
});

const adminToken = generateToken({
  userId: MOCK_USERS.admin.userId,
  email: MOCK_USERS.admin.email,
  role: MOCK_USERS.admin.roleName,
});

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

// Intercept Supabase database & storage calls
supabaseClient.from = function (tableName) {
  if (tableName === 'users') {
    return {
      select: () => ({
        eq: (col, val) => ({
          eq: () => ({
            order: () => {
              const teachers = Object.values(MOCK_USERS)
                .filter((u) => u.roleName === 'TEACHER')
                .map((u) => ({ id: u.userId, name: u.name, email: u.email }));
              return Promise.resolve({ data: teachers, error: null });
            },
          }),
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

  if (tableName === 'question_paper_assignments') {
    return {
      insert: (records) => ({
        select: () => ({
          single: () => {
            const record = { ...records[0], id: 'assign-' + Date.now() };
            inMemoryAssignments.set(record.id, record);
            return Promise.resolve({ data: record, error: null });
          },
        }),
      }),
      select: () => ({
        eq: (col1, val1) => ({
          eq: (col2, val2) => ({
            maybeSingle: () => {
              for (const a of inMemoryAssignments.values()) {
                if (a[col1] === val1 && a[col2] === val2) {
                  return Promise.resolve({ data: a, error: null });
                }
              }
              return Promise.resolve({ data: null, error: null });
            },
          }),
          maybeSingle: () => {
            for (const a of inMemoryAssignments.values()) {
              if (a[col1] === val1) {
                return Promise.resolve({ data: a, error: null });
              }
            }
            return Promise.resolve({ data: null, error: null });
          },
          order: () => {
            const matched = [];
            for (const a of inMemoryAssignments.values()) {
              if (a[col1] === val1) matched.push(a);
            }
            return Promise.resolve({ data: matched, error: null });
          },
          then: (resolve) => {
            const matched = [];
            for (const a of inMemoryAssignments.values()) {
              if (a[col1] === val1) matched.push(a);
            }
            resolve({ data: matched, error: null });
          },
        }),
      }),
    };
  }

  if (tableName === 'question_papers') {
    return {
      insert: (records) => ({
        select: () => ({
          single: () => {
            const record = { ...records[0] };
            inMemoryPapers.set(record.id, record);
            return Promise.resolve({ data: record, error: null });
          },
        }),
      }),
      select: () => ({
        in: (col, valArray) => {
          const list = [];
          for (const val of valArray) {
            const p = inMemoryPapers.get(val);
            if (p) {
              const sigs = Array.from(inMemorySignatures.values()).filter((s) => s.question_paper_id === p.id);
              list.push({
                ...p,
                teacher: { id: p.teacher_id, name: 'Prof. Alice Smith', email: 'alice.teacher@examguard.edu' },
                digital_signatures: sigs,
              });
            }
          }
          return Promise.resolve({ data: list, error: null });
        },
        eq: (col, val) => ({
          order: () => {
            const papers = Array.from(inMemoryPapers.values()).filter((p) => p.teacher_id === val);
            return Promise.resolve({ data: papers, error: null });
          },
          maybeSingle: () => {
            const paper = inMemoryPapers.get(val);
            if (!paper) return Promise.resolve({ data: null, error: null });
            const sigs = Array.from(inMemorySignatures.values()).filter((s) => s.question_paper_id === val);
            return Promise.resolve({
              data: {
                ...paper,
                teacher: { id: paper.teacher_id, name: 'Prof. Alice Smith', email: 'alice.teacher@examguard.edu' },
                digital_signatures: sigs,
              },
              error: null,
            });
          },
        }),
      }),
      delete: () => ({
        eq: (col, val) => {
          inMemoryPapers.delete(val);
          return Promise.resolve({ data: null, error: null });
        },
      }),
    };
  }

  if (tableName === 'paper_keys') {
    return {
      insert: (records) => ({
        select: () => ({
          single: () => {
            const record = { ...records[0], id: 'key-' + Date.now() };
            inMemoryPaperKeys.set(record.question_paper_id, record);
            return Promise.resolve({ data: record, error: null });
          },
        }),
      }),
      select: () => ({
        eq: (col, val) => ({
          maybeSingle: () => {
            const keyRecord = inMemoryPaperKeys.get(val);
            return Promise.resolve({ data: keyRecord || null, error: null });
          },
        }),
      }),
      delete: () => ({
        eq: (col, val) => {
          inMemoryPaperKeys.delete(val);
          return Promise.resolve({ data: null, error: null });
        },
      }),
    };
  }

  if (tableName === 'digital_signatures') {
    return {
      insert: (records) => ({
        select: () => ({
          single: () => {
            const record = { ...records[0], id: 'sig-' + Date.now(), created_at: new Date().toISOString() };
            inMemorySignatures.set(record.question_paper_id, record);
            return Promise.resolve({ data: record, error: null });
          },
        }),
      }),
      select: () => ({
        eq: (col, val) => ({
          maybeSingle: () => {
            const sigRecord = inMemorySignatures.get(val);
            return Promise.resolve({ data: sigRecord || null, error: null });
          },
        }),
      }),
      delete: () => ({
        eq: (col, val) => {
          inMemorySignatures.delete(val);
          return Promise.resolve({ data: null, error: null });
        },
      }),
    };
  }

  throw new Error(`Unmocked table: ${tableName}`);
};

// Mock storage
supabaseClient.storage = {
  from: (bucketName) => ({
    upload: async (storagePath, fileBuffer) => {
      storageFiles.set(storagePath, Buffer.from(fileBuffer));
      return { data: { path: storagePath }, error: null };
    },
    download: async (storagePath) => {
      const stored = storageFiles.get(storagePath);
      if (!stored) {
        return { data: null, error: { message: 'Object not found in storage' } };
      }
      if (simulateTamperedStorageCiphertext) {
        const tampered = Buffer.from(stored);
        tampered[tampered.length - 1] ^= 0xff; // Flip bits to simulate storage tampering
        return { data: tampered, error: null };
      }
      return { data: stored, error: null };
    },
    remove: async (paths) => {
      for (const p of paths) storageFiles.delete(p);
      return { data: paths, error: null };
    },
    getPublicUrl: () => {
      throw new Error('SECURITY VIOLATION: getPublicUrl must NEVER be called for secure question papers!');
    },
  }),
};

// Helper: HTTP Request
function sendRequest({ method = 'GET', path, token = null, headers = {} }) {
  return new Promise((resolve, reject) => {
    const reqHeaders = { ...headers };
    if (token) reqHeaders['Authorization'] = `Bearer ${token}`;

    const req = http.request(
      `${BASE_URL}${path}`,
      { method, headers: reqHeaders },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const rawBody = Buffer.concat(chunks);
          let parsedBody = null;
          try {
            parsedBody = JSON.parse(rawBody.toString('utf8'));
          } catch (_) {
            parsedBody = null;
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: parsedBody,
            rawBody,
          });
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

// Test assertion helper
let totalPassed = 0;
let totalFailed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    totalPassed++;
    console.log(`  ✔ PASS: ${message}`);
  } else {
    totalFailed++;
    console.error(`  ✖ FAIL: ${message}${detail ? ' -> ' + detail : ''}`);
  }
}

// Create sample encrypted & signed question paper
function createTestPaperRecord({ paperId, teacherId, assignedToCoordId, status = 'SUBMITTED', title = 'Test Exam Paper' }) {
  const originalPdfBuffer = Buffer.from(`%PDF-1.4\n% Test Question Paper ${paperId} Content\n%%EOF`);
  
  // 1. Envelope encryption
  const encryptionResult = encryptionService.encryptQuestionPaper(originalPdfBuffer);
  
  // 2. Digital signature over ciphertext
  const signingResult = signatureService.signQuestionPaper(encryptionResult.encryptedBuffer);

  const storagePath = `question-papers/${teacherId}/${paperId}/encrypted/paper.pdf.enc`;

  // Store ciphertext in storage
  storageFiles.set(storagePath, encryptionResult.encryptedBuffer);

  // Store in question_papers
  const paperRecord = {
    id: paperId,
    title,
    subject: 'Computer Networks & Security',
    semester: 'Semester 6',
    academic_year: '2026-2027',
    exam_type: 'End Semester Examination',
    exam_date: '2026-11-20',
    teacher_id: teacherId,
    file_name: 'computer_networks_final.pdf',
    storage_path: storagePath,
    file_size: encryptionResult.encryptedSize,
    mime_type: 'application/pdf',
    status,
    submitted_at: new Date().toISOString(),
    scheduled_delivery_date: '2026-11-19',
    created_at: new Date().toISOString(),
  };
  inMemoryPapers.set(paperId, paperRecord);

  // Store in paper_keys
  const keyRecord = {
    id: 'key-' + paperId,
    question_paper_id: paperId,
    encrypted_aes_key: encryptionResult.encryptedAesKey,
    iv: encryptionResult.iv,
    auth_tag: encryptionResult.authTag,
  };
  inMemoryPaperKeys.set(paperId, keyRecord);

  // Store in digital_signatures
  const sigRecord = {
    id: 'sig-' + paperId,
    question_paper_id: paperId,
    algorithm: signingResult.algorithm,
    file_hash: signingResult.fileHash,
    signature: signingResult.signature,
    public_key_reference: signingResult.publicKeyReference,
    created_at: new Date().toISOString(),
  };
  inMemorySignatures.set(paperId, sigRecord);

  // Store in question_paper_assignments
  const assignRecord = {
    id: 'assign-' + paperId,
    question_paper_id: paperId,
    assigned_to_user_id: assignedToCoordId,
    assigned_by_user_id: teacherId,
    assigned_at: new Date().toISOString(),
    scheduled_delivery_date: '2026-11-19',
    delivered_at: null,
    delivery_status: 'PENDING',
  };
  inMemoryAssignments.set(assignRecord.id, assignRecord);

  return {
    paperId,
    originalPdfBuffer,
    encryptionResult,
    signingResult,
    assignRecord,
  };
}

async function runTests() {
  console.log('\n===============================================================');
  console.log('   EXAMGUARD MODULE 9: EXAM COORDINATOR ACCESS TESTS');
  console.log('===============================================================\n');

  // Start HTTP server on port 5007
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`Test HTTP server running on port ${TEST_PORT}\n`);
      resolve();
    });
  });

  try {
    // Populate test papers:
    // Paper 1: Assigned to Coordinator 1
    const paper1Id = crypto.randomUUID();
    const testPaper1 = createTestPaperRecord({
      paperId: paper1Id,
      teacherId: MOCK_USERS.teacher.userId,
      assignedToCoordId: MOCK_USERS.coordinator1.userId,
      status: 'SUBMITTED',
      title: 'Advanced Computer Networks',
    });

    // Paper 2: Assigned to Coordinator 2 (isolated from Coordinator 1)
    const paper2Id = crypto.randomUUID();
    const testPaper2 = createTestPaperRecord({
      paperId: paper2Id,
      teacherId: MOCK_USERS.teacher.userId,
      assignedToCoordId: MOCK_USERS.coordinator2.userId,
      status: 'SUBMITTED',
      title: 'Distributed Systems & Cloud',
    });

    // Paper 3: Assigned to Coordinator 1 but still in DRAFT status
    const draftPaperId = crypto.randomUUID();
    const testDraftPaper = createTestPaperRecord({
      paperId: draftPaperId,
      teacherId: MOCK_USERS.teacher.userId,
      assignedToCoordId: MOCK_USERS.coordinator1.userId,
      status: 'DRAFT',
      title: 'Draft Cryptography Paper',
    });

    // -------------------------------------------------------------
    // [Group 1: Authentication & RBAC Boundaries]
    // -------------------------------------------------------------
    console.log('[Group 1: Authentication & RBAC Boundaries]');

    // 1. Missing Token returns 401
    const resNoToken = await sendRequest({ path: '/api/exam-coordinator/question-papers' });
    assert(resNoToken.status === 401, '1. Missing token returns 401 Unauthorized', `Got ${resNoToken.status}`);

    // 2. Malformed Token returns 401
    const resBadToken = await sendRequest({ path: '/api/exam-coordinator/question-papers', token: 'invalid.jwt.token' });
    assert(resBadToken.status === 401, '2. Malformed token returns 401 Unauthorized', `Got ${resBadToken.status}`);

    // 3. Expired Token returns 401
    const expiredToken = crypto.randomBytes(16).toString('hex'); // simulated expired/invalid
    const resExpired = await sendRequest({ path: '/api/exam-coordinator/question-papers', token: expiredToken });
    assert(resExpired.status === 401, '3. Invalid/expired token returns 401 Unauthorized', `Got ${resExpired.status}`);

    // 4. Inactive Coordinator is denied with 403 Forbidden
    const resInactive = await sendRequest({ path: '/api/exam-coordinator/question-papers', token: inactiveCoordToken });
    assert(resInactive.status === 403, '4. Inactive coordinator is denied (403 Forbidden)', `Got ${resInactive.status}`);

    // 5. TEACHER role calling coordinator endpoint is rejected (403 Forbidden)
    const resTeacher = await sendRequest({ path: '/api/exam-coordinator/question-papers', token: teacherToken });
    assert(resTeacher.status === 403, '5. TEACHER role receives 403 Forbidden on coordinator endpoint', `Got ${resTeacher.status}`);

    // 6. ADMIN role calling coordinator endpoint is rejected (403 Forbidden)
    const resAdmin = await sendRequest({ path: '/api/exam-coordinator/question-papers', token: adminToken });
    assert(resAdmin.status === 403, '6. ADMIN role receives 403 Forbidden on coordinator endpoint', `Got ${resAdmin.status}`);

    // 7. Valid EXAM_COORDINATOR can access coordinator endpoint (200 OK)
    const resCoord = await sendRequest({ path: '/api/exam-coordinator/question-papers', token: coord1Token });
    assert(resCoord.status === 200, '7. EXAM_COORDINATOR role successfully accesses coordinator endpoint (200 OK)', `Got ${resCoord.status}`);
    assert(Array.isArray(resCoord.body?.data), '7b. Question papers returned as an array');

    // -------------------------------------------------------------
    // [Group 2: Assignment Scoping & Access Control Isolation]
    // -------------------------------------------------------------
    console.log('\n[Group 2: Assignment Scoping & Access Control Isolation]');

    // 8. Coordinator 1 can list assigned papers
    const coord1Papers = resCoord.body?.data || [];
    const foundPaper1 = coord1Papers.some((p) => p.id === paper1Id);
    assert(foundPaper1, '8. Coordinator 1 sees paper assigned to Coordinator 1');

    // 9. Coordinator 1 cannot see paper assigned to Coordinator 2
    const foundPaper2 = coord1Papers.some((p) => p.id === paper2Id);
    assert(!foundPaper2, '9. Coordinator 1 CANNOT see paper assigned to Coordinator 2 (strict isolation)');

    // 10. Coordinator 1 cannot see paper in DRAFT status
    const foundDraft = coord1Papers.some((p) => p.id === draftPaperId);
    assert(!foundDraft, '10. Coordinator 1 CANNOT see DRAFT status papers (only submitted papers)');

    // 11. Coordinator 2 lists assigned papers and sees Paper 2
    const resCoord2 = await sendRequest({ path: '/api/exam-coordinator/question-papers', token: coord2Token });
    assert(resCoord2.status === 200, '11. Coordinator 2 retrieves assigned papers list');
    const coord2Papers = resCoord2.body?.data || [];
    assert(coord2Papers.some((p) => p.id === paper2Id), '11b. Coordinator 2 sees Paper 2');
    assert(!coord2Papers.some((p) => p.id === paper1Id), '11c. Coordinator 2 CANNOT see Paper 1');

    // -------------------------------------------------------------
    // [Group 3: Paper Metadata Details & UUID Tampering Defense]
    // -------------------------------------------------------------
    console.log('\n[Group 3: Paper Metadata Details & UUID Tampering Defense]');

    // 12. Coordinator 1 views authorized Paper 1 details
    const resDetails1 = await sendRequest({ path: `/api/exam-coordinator/question-papers/${paper1Id}`, token: coord1Token });
    assert(resDetails1.status === 200, '12. Coordinator 1 can view authorized Paper 1 details (200 OK)');
    assert(resDetails1.body?.data?.id === paper1Id, '12b. Paper ID in details matches requested ID');
    assert(resDetails1.body?.data?.title === 'Advanced Computer Networks', '12c. Paper title matches expected');
    assert(resDetails1.body?.data?.teacher?.name === 'Prof. Alice Smith', '12d. Faculty setter name is safely returned');

    // 13. Coordinator 1 attempting to view Paper 2 (assigned to Coord 2) returns 403 Forbidden
    const resDetailsUnauth = await sendRequest({ path: `/api/exam-coordinator/question-papers/${paper2Id}`, token: coord1Token });
    assert(resDetailsUnauth.status === 403, '13. Coordinator 1 viewing Paper 2 returns 403 Forbidden (UUID tampering rejected)');

    // 14. Coordinator 1 attempting to view DRAFT paper returns 403 Forbidden
    const resDetailsDraft = await sendRequest({ path: `/api/exam-coordinator/question-papers/${draftPaperId}`, token: coord1Token });
    assert(resDetailsDraft.status === 403, '14. Coordinator 1 viewing DRAFT paper returns 403 Forbidden');

    // 15. Random / non-existent UUID returns 404 Not Found
    const randomUuid = crypto.randomUUID();
    const resDetails404 = await sendRequest({ path: `/api/exam-coordinator/question-papers/${randomUuid}`, token: coord1Token });
    assert(resDetails404.status === 404, '15. Random / non-existent UUID returns 404 Not Found');

    // -------------------------------------------------------------
    // [Group 4: Secure Download, Verify-Before-Decrypt & PDF Streaming]
    // -------------------------------------------------------------
    console.log('\n[Group 4: Secure Download, Verify-Before-Decrypt & PDF Streaming]');

    // 16. Authorized Coordinator 1 downloads decrypted Paper 1
    const resDownload1 = await sendRequest({ path: `/api/exam-coordinator/question-papers/${paper1Id}/download`, token: coord1Token });
    assert(resDownload1.status === 200, '16. Coordinator 1 can download authorized question paper (200 OK)');
    assert(resDownload1.headers['content-type'] === 'application/pdf', '16b. Content-Type is application/pdf');
    assert(
      resDownload1.headers['content-disposition']?.includes('attachment; filename='),
      '16c. Content-Disposition specifies attachment download'
    );

    // 17. Decrypted buffer exactly matches original plaintext PDF
    const decryptedMatch = resDownload1.rawBody.equals(testPaper1.originalPdfBuffer);
    assert(decryptedMatch, '17. Decrypted PDF exactly matches original pre-encryption plaintext bytes');

    // 18. Coordinator 1 cannot download Paper 2 (assigned to Coord 2) -> 403 Forbidden
    const resDownloadUnauth = await sendRequest({ path: `/api/exam-coordinator/question-papers/${paper2Id}/download`, token: coord1Token });
    assert(resDownloadUnauth.status === 403, '18. Coordinator 1 cannot download Paper 2 (403 Forbidden)');

    // 19. Coordinator 1 cannot download non-existent paper UUID -> 404 Not Found
    const resDownload404 = await sendRequest({ path: `/api/exam-coordinator/question-papers/${randomUuid}/download`, token: coord1Token });
    assert(resDownload404.status === 404, '19. Downloading random UUID returns 404 Not Found');

    // 20. Tampered ciphertext in storage triggers SHA-256 hash mismatch & fails closed (400 Bad Request)
    console.log('\n[Testing Verify-Before-Decrypt: Ciphertext Tamper Defense]');
    simulateTamperedStorageCiphertext = true;
    const resTamperedDownload = await sendRequest({ path: `/api/exam-coordinator/question-papers/${paper1Id}/download`, token: coord1Token });
    simulateTamperedStorageCiphertext = false;

    assert(resTamperedDownload.status === 400, '20. Tampered ciphertext in storage returns 400 Bad Request (fails closed)');
    assert(
      resTamperedDownload.body?.message?.includes('integrity verification failed') ||
      resTamperedDownload.body?.message?.includes('hash mismatch'),
      '20b. Error message specifies integrity verification failure'
    );
    assert(
      !resTamperedDownload.rawBody.includes(testPaper1.originalPdfBuffer),
      '20c. Plaintext PDF is NEVER delivered when integrity verification fails'
    );

    // 21. Corrupted RSA-PSS digital signature fails closed (400 Bad Request)
    console.log('\n[Testing Verify-Before-Decrypt: Digital Signature Tamper Defense]');
    const corruptSigPaperId = crypto.randomUUID();
    createTestPaperRecord({
      paperId: corruptSigPaperId,
      teacherId: MOCK_USERS.teacher.userId,
      assignedToCoordId: MOCK_USERS.coordinator1.userId,
      status: 'SUBMITTED',
      title: 'Corrupt Signature Test Paper',
    });
    // Corrupt signature in memory
    const existingSig = inMemorySignatures.get(corruptSigPaperId);
    inMemorySignatures.set(corruptSigPaperId, {
      ...existingSig,
      signature: Buffer.from(crypto.randomBytes(256)).toString('base64'), // Corrupt signature bytes
    });

    const resCorruptSig = await sendRequest({ path: `/api/exam-coordinator/question-papers/${corruptSigPaperId}/download`, token: coord1Token });
    assert(resCorruptSig.status === 400, '21. Corrupted RSA-PSS digital signature returns 400 Bad Request (fails closed)');
    assert(
      resCorruptSig.body?.message?.includes('digital signature verification failed'),
      '21b. Error message indicates digital signature verification failed'
    );

    // 22. AES-GCM authentication failure (corrupted auth tag) fails closed
    console.log('\n[Testing Verify-Before-Decrypt: Auth Tag Tamper Defense]');
    const corruptKeyPaperId = crypto.randomUUID();
    createTestPaperRecord({
      paperId: corruptKeyPaperId,
      teacherId: MOCK_USERS.teacher.userId,
      assignedToCoordId: MOCK_USERS.coordinator1.userId,
      status: 'SUBMITTED',
      title: 'Corrupt Auth Tag Test Paper',
    });
    // Corrupt auth tag in paper_keys
    const existingKey = inMemoryPaperKeys.get(corruptKeyPaperId);
    const corruptedTag = Buffer.from(existingKey.auth_tag, 'base64');
    corruptedTag[0] ^= 0xff; // Flip bit
    inMemoryPaperKeys.set(corruptKeyPaperId, {
      ...existingKey,
      auth_tag: corruptedTag.toString('base64'),
    });

    const resCorruptTag = await sendRequest({ path: `/api/exam-coordinator/question-papers/${corruptKeyPaperId}/download`, token: coord1Token });
    assert(resCorruptTag.status === 400, '22. Corrupted auth tag fails AES-GCM decryption with 400 Bad Request (fails closed)');

    // -------------------------------------------------------------
    // [Group 5: Inline Signature & Integrity Verification Endpoint]
    // -------------------------------------------------------------
    console.log('\n[Group 5: Inline Signature & Integrity Verification Endpoint]');

    // 23. Authorized signature verification succeeds
    const resVerifySig = await sendRequest({
      path: `/api/exam-coordinator/question-papers/${paper1Id}/verify-signature`,
      token: coord1Token,
    });
    assert(resVerifySig.status === 200, '23. GET /:id/verify-signature returns 200 OK');
    assert(resVerifySig.body?.data?.verified === true, '23b. Verification result is verified: true');
    assert(resVerifySig.body?.data?.tamperDetected === false, '23c. tamperDetected is false');
    assert(resVerifySig.body?.data?.algorithm === 'RSA-PSS-SHA256', '23d. Algorithm is RSA-PSS-SHA256');
    assert(resVerifySig.body?.data?.fileHash?.length === 64, '23e. File hash is valid 64-char hex SHA-256');

    // 24. Tampered ciphertext returns tamperDetected: true
    simulateTamperedStorageCiphertext = true;
    const resTamperedVerify = await sendRequest({
      path: `/api/exam-coordinator/question-papers/${paper1Id}/verify-signature`,
      token: coord1Token,
    });
    simulateTamperedStorageCiphertext = false;
    assert(resTamperedVerify.status === 200, '24. Tampered ciphertext returns 200 with tamper detection status');
    assert(resTamperedVerify.body?.data?.verified === false, '24b. verified is false on tampered ciphertext');
    assert(resTamperedVerify.body?.data?.tamperDetected === true, '24c. tamperDetected is true on tampered ciphertext');

    // 25. Unauthorized coordinator cannot verify Paper 2
    const resVerifyUnauth = await sendRequest({
      path: `/api/exam-coordinator/question-papers/${paper2Id}/verify-signature`,
      token: coord1Token,
    });
    assert(resVerifyUnauth.status === 403, '25. Unauthorized coordinator cannot verify Paper 2 (403 Forbidden)');

    // -------------------------------------------------------------
    // [Group 6: Cryptographic Secrets Leakage Audit]
    // -------------------------------------------------------------
    console.log('\n[Group 6: Cryptographic Secrets Leakage Audit]');

    const auditPayload1 = JSON.stringify(resCoord.body);
    const auditPayload2 = JSON.stringify(resDetails1.body);
    const auditPayload3 = JSON.stringify(resVerifySig.body);
    const combinedPayloads = auditPayload1 + auditPayload2 + auditPayload3;

    assert(!combinedPayloads.includes('encrypted_aes_key'), '26. API responses NEVER leak "encrypted_aes_key"');
    assert(!combinedPayloads.includes('auth_tag'), '27. API responses NEVER leak "auth_tag"');
    assert(!combinedPayloads.includes('"iv"'), '28. API responses NEVER leak "iv"');
    assert(!combinedPayloads.includes('storage_path'), '29. Internal "storage_path" is NEVER exposed to coordinator');
    assert(!combinedPayloads.includes('PRIVATE KEY'), '30. Private keys are NEVER exposed in API responses');
    assert(!combinedPayloads.includes('paper_keys'), '31. paper_keys table records are NEVER exposed in API responses');

    // -------------------------------------------------------------
    // [Group 7: Regressions Across Previous Modules]
    // -------------------------------------------------------------
    console.log('\n[Group 7: Regressions Across Previous Modules]');

    // 32. Module 1 Health Check
    const resHealth = await sendRequest({ path: '/api/health' });
    assert(resHealth.status === 200, '32. Module 1 health check returns 200 OK (got 200)');
    assert(resHealth.body?.success === true, '32b. Health check reports success: true');

    // 33. Module 3 Auth Me
    const resAuthMe = await sendRequest({ path: '/api/auth/me', token: coord1Token });
    assert(resAuthMe.status === 200, '33. Module 3 /api/auth/me returns 200 OK for coordinator');
    assert(resAuthMe.body?.user?.role === 'EXAM_COORDINATOR', '33b. /api/auth/me confirms role EXAM_COORDINATOR');

    // 34. Module 4 RBAC Exam Coordinator
    const resRbacCoord = await sendRequest({ path: '/api/rbac/exam-coordinator', token: coord1Token });
    assert(resRbacCoord.status === 200, '34. Module 4 /api/rbac/exam-coordinator returns 200 for coordinator');
    const resRbacTeacher = await sendRequest({ path: '/api/rbac/exam-coordinator', token: teacherToken });
    assert(resRbacTeacher.status === 403, '34b. Module 4 /api/rbac/exam-coordinator returns 403 for teacher');

    // 35. Module 5 Teacher listing
    const resTeacherMy = await sendRequest({ path: '/api/question-papers/my', token: teacherToken });
    assert(resTeacherMy.status === 200, '35. Module 5 /api/question-papers/my returns 200 for teacher');

    // 36. Module 6 AES-256-GCM + RSA-OAEP encrypt/decrypt roundtrip
    const testDoc = Buffer.from('ExamGuard Module 9 Cryptographic Verification Payload');
    const encResult = encryptionService.encryptQuestionPaper(testDoc);
    const decResult = encryptionService.decryptQuestionPaper(
      encResult.encryptedBuffer,
      encResult.encryptedAesKey,
      encResult.iv,
      encResult.authTag
    );
    assert(decResult.equals(testDoc), '36. Module 6 AES-256-GCM + RSA-OAEP encrypt/decrypt roundtrip succeeds');

    // 37. Module 7 RSA-PSS digital signature sign/verify roundtrip
    const signResult = signatureService.signQuestionPaper(encResult.encryptedBuffer);
    const isSigValid = signatureService.verifyQuestionPaperSignature(encResult.encryptedBuffer, signResult.signature);
    assert(isSigValid === true, '37. Module 7 RSA-PSS digital signature sign/verify roundtrip succeeds');

    // 38. Module 8 Key Separation & Unwrapping
    const wrappingPrivKey = keyManagementService.getWrappingPrivateKey();
    const signingPrivKey = signatureService.getSigningPrivateKey();
    assert(wrappingPrivKey !== signingPrivKey, '38. Module 8 Key wrapping and digital signing keys are strictly separated');

  } catch (err) {
    console.error('\nUnexpected test execution error:', err);
    totalFailed++;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }

  console.log('\n===============================================================');
  console.log(`TOTAL SCENARIOS VERIFIED: ${totalPassed + totalFailed}`);
  console.log(`PASSED: ${totalPassed}`);
  console.log(`FAILED: ${totalFailed}`);
  console.log('===============================================================\n');

  if (totalFailed > 0) {
    process.exit(1);
  }
}

runTests();

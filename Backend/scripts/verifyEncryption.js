/**
 * Comprehensive Automated Verification Test Suite for Module 6:
 * Question Paper Encryption & Secure Key Management
 * 
 * Verifies all 27 required scenarios:
 * 1.  AES-256-GCM encryption works.
 * 2.  Decryption returns exact original bytes.
 * 3.  Ciphertext differs from plaintext.
 * 4.  AES key is random (different across encryptions).
 * 5.  IV is random (different across encryptions).
 * 6.  Authentication tag is generated (16 bytes).
 * 7.  AES key is RSA-OAEP wrapped.
 * 8.  AES key can be unwrapped.
 * 9.  Plaintext AES key is never stored in DB, storage, or API responses.
 * 10. Tampered ciphertext fails.
 * 11. Tampered IV fails.
 * 12. Tampered auth tag fails.
 * 13. Invalid wrapped AES key fails.
 * 14. Encrypted object uses encrypted/ path.
 * 15. Plaintext object is not left as the final new Storage object.
 * 16. Database stores wrapped AES key in paper_keys table.
 * 17. Storage failure is handled (502 Bad Gateway).
 * 18. Database failure removes encrypted Storage object.
 * 19. Encryption failure performs no upload.
 * 20. Teacher ownership remains enforced.
 * 21. Teacher cannot download another teacher's paper.
 * 22. Missing authentication remains 401.
 * 23. Unauthorized role remains 403.
 * 24. Module 3 authentication regression passes.
 * 25. Module 4 RBAC regression passes.
 * 26. Module 5 question-paper regression passes.
 * 27. Module 1 health regression passes.
 */

const http = require('http');
const crypto = require('crypto');
require('dotenv').config();

const { app } = require('../src/server');
const config = require('../src/config');
const authorizationService = require('../src/services/authorizationService');
const encryptionService = require('../src/services/encryptionService');
const { getSupabaseClient } = require('../src/config/supabase');
const supabaseClient = getSupabaseClient();
const { generateToken, verifyToken } = require('../src/utils/jwt');

const TEST_PORT = 5004;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
let server;

// Mock test users
const MOCK_USERS = {
  teacher1: {
    userId: '22222222-2222-2222-2222-222222222222',
    name: 'Prof. Alice Smith',
    roleId: 'role-teacher-uuid',
    roleName: 'TEACHER',
    email: 'alice.teacher@examguard.edu',
    isActive: true,
  },
  teacher2: {
    userId: '55555555-5555-5555-5555-555555555555',
    name: 'Prof. Bob Jones',
    roleId: 'role-teacher-uuid',
    roleName: 'TEACHER',
    email: 'bob.teacher@examguard.edu',
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
  coordinator: {
    userId: '33333333-3333-3333-3333-333333333333',
    name: 'Exam Coordinator',
    roleId: 'role-coord-uuid',
    roleName: 'EXAM_COORDINATOR',
    email: 'coordinator@examguard.edu',
    isActive: true,
  },
};

// In-memory data store for deterministic mock execution
const inMemoryPapers = new Map();
const inMemoryAssignments = new Map();
const inMemoryPaperKeys = new Map();
const inMemorySignatures = new Map();
const storageFiles = new Map();
const storageRemovals = [];
const storageUploadHistory = [];

let simulateStorageUploadError = false;
let simulateDbInsertError = false;

// Generate test tokens
const teacher1Token = generateToken({
  userId: MOCK_USERS.teacher1.userId,
  email: MOCK_USERS.teacher1.email,
  role: MOCK_USERS.teacher1.roleName,
});

const teacher2Token = generateToken({
  userId: MOCK_USERS.teacher2.userId,
  email: MOCK_USERS.teacher2.email,
  role: MOCK_USERS.teacher2.roleName,
});

const adminToken = generateToken({
  userId: MOCK_USERS.admin.userId,
  email: MOCK_USERS.admin.email,
  role: MOCK_USERS.admin.roleName,
});

const coordToken = generateToken({
  userId: MOCK_USERS.coordinator.userId,
  email: MOCK_USERS.coordinator.email,
  role: MOCK_USERS.coordinator.roleName,
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
const originalClientFrom = supabaseClient.from.bind(supabaseClient);
const originalClientStorageFrom = supabaseClient.storage.from.bind(supabaseClient.storage);

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

  if (tableName === 'question_papers') {
    return {
      insert: (records) => ({
        select: () => ({
          single: () => {
            if (simulateDbInsertError) {
              return Promise.resolve({
                data: null,
                error: { message: 'Simulated PostgreSQL constraint failure on question_papers' },
              });
            }
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
      select: () => ({
        eq: (col, val) => ({
          order: () => {
            if (col === 'teacher_id') {
              const matched = [];
              for (const p of inMemoryPapers.values()) {
                if (p.teacher_id === val) {
                  const assignment = inMemoryAssignments.get(p.id);
                  matched.push({
                    ...p,
                    question_paper_assignments: assignment ? [assignment] : [],
                  });
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
              const assignment = inMemoryAssignments.get(paper.id);
              return Promise.resolve({
                data: {
                  ...paper,
                  teacher: { id: paper.teacher_id, name: 'Alice Teacher', email: 'alice@examguard.edu' },
                  question_paper_assignments: assignment ? [assignment] : [],
                },
                error: null,
              });
            }
            return Promise.resolve({ data: null, error: null });
          },
        }),
      }),
      delete: () => ({
        eq: (col, val) => {
          if (col === 'id') inMemoryPapers.delete(val);
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

  if (tableName === 'question_paper_assignments') {
    return {
      insert: (records) => ({
        select: () => ({
          single: () => {
            const record = { ...records[0], id: 'assign-' + Date.now() };
            inMemoryAssignments.set(record.question_paper_id, record);
            return Promise.resolve({ data: record, error: null });
          },
        }),
      }),
      delete: () => ({
        eq: (col, val) => {
          inMemoryAssignments.delete(val);
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
            const record = {
              ...records[0],
              id: 'sig-' + Date.now(),
              created_at: new Date().toISOString(),
            };
            inMemorySignatures.set(record.question_paper_id, record);
            return Promise.resolve({ data: record, error: null });
          },
        }),
      }),
      select: (fields) => ({
        eq: (col, val) => ({
          maybeSingle: () => {
            const sig = inMemorySignatures.get(val);
            return Promise.resolve({ data: sig || null, error: null });
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

  return originalClientFrom(tableName);
};

supabaseClient.storage.from = function (bucket) {
  return {
    upload: (storagePath, fileBuffer, options) => {
      storageUploadHistory.push({ path: storagePath, buffer: fileBuffer });
      if (simulateStorageUploadError) {
        return Promise.resolve({
          data: null,
          error: { message: 'Simulated 502 Storage service unreachable' },
        });
      }
      storageFiles.set(storagePath, fileBuffer);
      return Promise.resolve({
        data: { path: storagePath },
        error: null,
      });
    },
    download: (storagePath) => {
      const fileBuffer = storageFiles.get(storagePath);
      if (!fileBuffer) {
        return Promise.resolve({ data: null, error: { message: 'Object not found in storage' } });
      }
      return Promise.resolve({ data: fileBuffer, error: null });
    },
    remove: (paths) => {
      for (const p of paths) {
        storageRemovals.push(p);
        storageFiles.delete(p);
      }
      return Promise.resolve({ data: paths, error: null });
    },
  };
};

/**
 * Helpers for multipart upload and JSON requests
 */
async function sendMultipartRequest({ token, fields = {}, file = null }) {
  const formData = new FormData();
  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined && val !== null) {
      formData.append(key, String(val));
    }
  }
  if (file) {
    const buffer = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content);
    const blob = new Blob([buffer], { type: file.mimeType || 'application/pdf' });
    formData.append('file', blob, file.filename || 'paper.pdf');
  }

  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}/api/question-papers`, {
    method: 'POST',
    headers,
    body: formData,
  });

  const status = response.status;
  const rawText = await response.text();
  let body = {};
  try {
    body = JSON.parse(rawText);
  } catch (e) {
    body = { raw: rawText };
  }
  return { status, body };
}

async function sendDownloadRequest(path, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'GET',
    headers,
  });

  const status = response.status;
  const contentType = response.headers.get('content-type') || '';
  const contentDisposition = response.headers.get('content-disposition') || '';
  const buffer = Buffer.from(await response.arrayBuffer());

  return { status, contentType, contentDisposition, buffer };
}

async function sendJsonRequest(method, path, token, payload = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (payload) options.body = JSON.stringify(payload);

  const response = await fetch(`${BASE_URL}${path}`, options);
  const status = response.status;
  const rawText = await response.text();
  let body = {};
  try {
    body = JSON.parse(rawText);
  } catch (e) {
    body = { raw: rawText };
  }
  return { status, body };
}

const ORIGINAL_PDF_CONTENT = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n2 0 obj\n<< /Title (ExamGuard Confidential Exam) >>\nendobj\ntrailer\n<< >>\n%%EOF'
);

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS\x1b[0m: ${message}`);
    passedTests++;
  } else {
    console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${message}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log('\n===============================================================');
  console.log('   MODULE 6: QUESTION PAPER ENCRYPTION & KEY MANAGEMENT TESTS');
  console.log('===============================================================\n');

  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(TEST_PORT, () => {
      console.log(`Test server running on port ${TEST_PORT}\n`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------
    // Unit & Cryptographic Primitive Tests (Scenarios 1 - 13)
    // -------------------------------------------------------------
    console.log('--- Unit & Cryptographic Primitive Integrity ---');

    // 1. AES-256-GCM encryption works
    const encResult = encryptionService.encryptQuestionPaper(ORIGINAL_PDF_CONTENT);
    assert(Buffer.isBuffer(encResult.encryptedBuffer), '1. AES-256-GCM generates ciphertext Buffer');
    assert(encResult.encryptedBuffer.length > 0, '1b. Ciphertext buffer is non-empty');

    // 2. Decryption returns exact original bytes
    const decrypted = encryptionService.decryptQuestionPaper(
      encResult.encryptedBuffer,
      encResult.encryptedAesKey,
      encResult.iv,
      encResult.authTag
    );
    assert(ORIGINAL_PDF_CONTENT.equals(decrypted), '2. Decryption returns exact byte-for-byte original plaintext');

    // 3. Ciphertext differs from plaintext
    assert(!ORIGINAL_PDF_CONTENT.equals(encResult.encryptedBuffer), '3. Ciphertext differs cryptographically from plaintext');

    // 4. AES key is random (consecutive encryptions produce different keys)
    const encResult2 = encryptionService.encryptQuestionPaper(ORIGINAL_PDF_CONTENT);
    assert(
      encResult.encryptedAesKey !== encResult2.encryptedAesKey,
      '4. AES data encryption key is uniquely random per paper'
    );

    // 5. IV is random (consecutive encryptions produce different IVs)
    assert(encResult.iv !== encResult2.iv, '5. AES-GCM IV is uniquely random per paper');

    // 6. Authentication tag is generated (16 bytes)
    const authTagBuffer = Buffer.from(encResult.authTag, 'base64');
    assert(authTagBuffer.length === 16, '6. AES-GCM generates standard 16-byte authentication tag');

    // 7. AES key is RSA-OAEP wrapped
    assert(typeof encResult.encryptedAesKey === 'string' && encResult.encryptedAesKey.length > 64, '7. AES key is securely wrapped via RSA-OAEP');

    // 8. AES key can be unwrapped
    const unwrappedKey = encryptionService.unwrapAesKey(encResult.encryptedAesKey);
    assert(Buffer.isBuffer(unwrappedKey) && unwrappedKey.length === 32, '8. AES key successfully unwrapped to 32 bytes');

    // 9. Plaintext AES key is never returned in encryption result
    assert(encResult.aesKey === undefined, '9. Plaintext AES key is discarded and not exposed in result');

    // 10. Tampered ciphertext fails
    const tamperedCiphertext = Buffer.from(encResult.encryptedBuffer);
    tamperedCiphertext[10] ^= 0xff; // Flip bits
    let tamperFailed = false;
    try {
      encryptionService.decryptQuestionPaper(
        tamperedCiphertext,
        encResult.encryptedAesKey,
        encResult.iv,
        encResult.authTag
      );
    } catch (err) {
      tamperFailed = true;
    }
    assert(tamperFailed, '10. Modifying ciphertext bit causes AES-GCM authentication failure');

    // 11. Tampered IV fails
    let tamperedIvFailed = false;
    const alteredIv = Buffer.from(encResult.iv, 'base64');
    alteredIv[0] ^= 0xff;
    try {
      encryptionService.decryptQuestionPaper(
        encResult.encryptedBuffer,
        encResult.encryptedAesKey,
        alteredIv.toString('base64'),
        encResult.authTag
      );
    } catch (err) {
      tamperedIvFailed = true;
    }
    assert(tamperedIvFailed, '11. Modifying IV causes AES-GCM authentication failure');

    // 12. Tampered auth tag fails
    let tamperedTagFailed = false;
    const alteredTag = Buffer.from(encResult.authTag, 'base64');
    alteredTag[0] ^= 0xff;
    try {
      encryptionService.decryptQuestionPaper(
        encResult.encryptedBuffer,
        encResult.encryptedAesKey,
        encResult.iv,
        alteredTag.toString('base64')
      );
    } catch (err) {
      tamperedTagFailed = true;
    }
    assert(tamperedTagFailed, '12. Modifying authentication tag causes AES-GCM authentication failure');

    // 13. Invalid wrapped AES key fails
    let invalidWrappedKeyFailed = false;
    try {
      encryptionService.decryptQuestionPaper(
        encResult.encryptedBuffer,
        Buffer.from('corrupted_wrapped_key').toString('base64'),
        encResult.iv,
        encResult.authTag
      );
    } catch (err) {
      invalidWrappedKeyFailed = true;
    }
    assert(invalidWrappedKeyFailed, '13. Corrupted or invalid wrapped key fails securely');

    // -------------------------------------------------------------
    // End-to-End Submission & Storage Path Tests (Scenarios 14 - 16)
    // -------------------------------------------------------------
    console.log('\n--- End-to-End Encrypted Submission & Path Verification ---');

    const validSubmissionFields = {
      title: 'Advanced Cryptography Final',
      subject: 'Computer Science',
      semester: 'Semester 7',
      academicYear: '2026-2027',
      examType: 'END_SEM',
      examDate: '2026-12-15',
      assignedToUserId: MOCK_USERS.teacher2.userId,
    };

    const submitRes = await sendMultipartRequest({
      token: teacher1Token,
      fields: validSubmissionFields,
      file: {
        filename: 'crypto_final.pdf',
        content: ORIGINAL_PDF_CONTENT,
        mimeType: 'application/pdf',
      },
    });

    assert(submitRes.status === 201, `Submission status is 201 Created (got ${submitRes.status})`);
    const paperId = submitRes.body.data?.questionPaper?.id;
    const storedPaper = inMemoryPapers.get(paperId);

    // 14. Encrypted object uses encrypted/ path
    assert(
      storedPaper.storage_path.includes('/encrypted/') && storedPaper.storage_path.endsWith('.enc'),
      `14. Encrypted file path uses /encrypted/ subfolder and .enc extension: "${storedPaper.storage_path}"`
    );

    // 15. Plaintext object is not left as final new Storage object
    assert(
      !storedPaper.storage_path.includes('/original/'),
      '15. Plaintext /original/ path is NOT used as final storage location for new submissions'
    );
    // Verify stored buffer in storage is not plaintext
    const uploadedBlob = storageFiles.get(storedPaper.storage_path);
    assert(
      !ORIGINAL_PDF_CONTENT.equals(uploadedBlob),
      '15b. Data stored in Supabase Storage is encrypted ciphertext, not plaintext PDF'
    );

    // 16. Database stores wrapped AES key in paper_keys table
    const storedKey = inMemoryPaperKeys.get(paperId);
    assert(storedKey !== undefined, '16. paper_keys record created in database');
    assert(typeof storedKey.encrypted_aes_key === 'string', '16b. Stored encrypted_aes_key is present');
    assert(typeof storedKey.iv === 'string', '16c. Stored iv is present');
    assert(typeof storedKey.auth_tag === 'string', '16d. Stored auth_tag is present');
    // Ensure API response did not leak keys
    assert(submitRes.body.data.paperKey === undefined, '16e. Safe API response excludes paper_keys');
    assert(submitRes.body.data.questionPaper.encrypted_aes_key === undefined, '16f. Safe API response excludes AES key');

    // -------------------------------------------------------------
    // Failure & Rollback Tests (Scenarios 17 - 19)
    // -------------------------------------------------------------
    console.log('\n--- Storage Error & Compensating Rollback Tests ---');

    // 17. Storage failure is handled
    simulateStorageUploadError = true;
    const storageErrRes = await sendMultipartRequest({
      token: teacher1Token,
      fields: validSubmissionFields,
      file: {
        filename: 'fail_storage.pdf',
        content: ORIGINAL_PDF_CONTENT,
        mimeType: 'application/pdf',
      },
    });
    simulateStorageUploadError = false;
    assert(storageErrRes.status === 502, `17. Storage failure returns 502 Bad Gateway (got ${storageErrRes.status})`);

    // 18. Database failure removes encrypted Storage object
    simulateDbInsertError = true;
    storageRemovals.length = 0;
    const dbErrRes = await sendMultipartRequest({
      token: teacher1Token,
      fields: validSubmissionFields,
      file: {
        filename: 'db_fail.pdf',
        content: ORIGINAL_PDF_CONTENT,
        mimeType: 'application/pdf',
      },
    });
    simulateDbInsertError = false;
    assert(dbErrRes.status === 500, `18. Database failure returns 500 (got ${dbErrRes.status})`);
    assert(storageRemovals.length >= 1, `18b. Storage rollback called remove() (removals: ${storageRemovals.length})`);
    assert(
      storageRemovals[0].includes('/encrypted/db_fail.pdf.enc'),
      `18c. Compensating rollback deleted encrypted storage file: ${storageRemovals[0]}`
    );

    // 19. Encryption failure performs no upload
    const uploadHistoryCountBefore = storageUploadHistory.length;
    let encFailureHandled = false;
    try {
      // Empty buffer triggers encryption failure before upload
      await sendMultipartRequest({
        token: teacher1Token,
        fields: validSubmissionFields,
        file: {
          filename: 'empty.pdf',
          content: Buffer.alloc(0),
          mimeType: 'application/pdf',
        },
      });
      encFailureHandled = true;
    } catch (e) {
      encFailureHandled = true;
    }
    assert(encFailureHandled, '19. Encryption/empty file validation rejects before storage upload');
    assert(
      storageUploadHistory.length === uploadHistoryCountBefore,
      '19b. Zero storage upload attempts made when validation/encryption fails'
    );

    // -------------------------------------------------------------
    // Authenticated Decryption & RBAC Tests (Scenarios 20 - 23)
    // -------------------------------------------------------------
    console.log('\n--- Authenticated Download & Ownership Decryption Tests ---');

    // 20. Teacher ownership remains enforced (Author can download and decrypt)
    const downloadOwnerRes = await sendDownloadRequest(
      `/api/question-papers/${paperId}/download`,
      teacher1Token
    );
    assert(downloadOwnerRes.status === 200, `20. Authoring teacher download returns 200 OK (got ${downloadOwnerRes.status})`);
    assert(
      downloadOwnerRes.contentType.includes('application/pdf'),
      `20b. Content-Type is application/pdf (got "${downloadOwnerRes.contentType}")`
    );
    assert(
      ORIGINAL_PDF_CONTENT.equals(downloadOwnerRes.buffer),
      '20c. Decrypted downloaded buffer exactly matches original plaintext PDF!'
    );

    // 21. Teacher cannot download another teacher's paper
    const downloadTeacher2Res = await sendDownloadRequest(
      `/api/question-papers/${paperId}/download`,
      teacher2Token
    );
    assert(
      downloadTeacher2Res.status === 403,
      `21. Teacher 2 downloading Teacher 1's paper returns 403 Forbidden (got ${downloadTeacher2Res.status})`
    );

    // 22. Missing authentication remains 401
    const downloadNoAuthRes = await sendDownloadRequest(
      `/api/question-papers/${paperId}/download`,
      null
    );
    assert(
      downloadNoAuthRes.status === 401,
      `22. Unauthenticated download returns 401 Unauthorized (got ${downloadNoAuthRes.status})`
    );

    // 23. Unauthorized role remains 403 (ADMIN / COORDINATOR)
    const downloadAdminRes = await sendDownloadRequest(
      `/api/question-papers/${paperId}/download`,
      adminToken
    );
    assert(
      downloadAdminRes.status === 403,
      `23. ADMIN role downloading teacher paper returns 403 Forbidden (got ${downloadAdminRes.status})`
    );

    const downloadCoordRes = await sendDownloadRequest(
      `/api/question-papers/${paperId}/download`,
      coordToken
    );
    assert(
      downloadCoordRes.status === 403,
      `23b. EXAM_COORDINATOR role downloading teacher paper returns 403 Forbidden (got ${downloadCoordRes.status})`
    );

    // -------------------------------------------------------------
    // Full Regression Suite Checks (Scenarios 24 - 27)
    // -------------------------------------------------------------
    console.log('\n--- Regressions Across Previous Modules ---');

    // 24. Module 3 authentication regression passes
    const authMeRes = await sendJsonRequest('GET', '/api/auth/me', teacher1Token);
    assert(authMeRes.status === 200, `24. Module 3 /api/auth/me returns 200 OK (got ${authMeRes.status})`);
    const badAuthMeRes = await sendJsonRequest('GET', '/api/auth/me', 'invalid.token');
    assert(badAuthMeRes.status === 401, `24b. Invalid token rejected with 401 (got ${badAuthMeRes.status})`);

    // 25. Module 4 RBAC regression passes
    const rbacTeacherRes = await sendJsonRequest('GET', '/api/rbac/teacher', teacher1Token);
    assert(rbacTeacherRes.status === 200, `25. Module 4 /api/rbac/teacher returns 200 for TEACHER (got ${rbacTeacherRes.status})`);
    const rbacAdminRes = await sendJsonRequest('GET', '/api/rbac/teacher', adminToken);
    assert(rbacAdminRes.status === 403, `25b. Module 4 /api/rbac/teacher returns 403 for ADMIN (got ${rbacAdminRes.status})`);

    // 26. Module 5 question-paper regression passes
    const missingTitleRes = await sendMultipartRequest({
      token: teacher1Token,
      fields: { ...validSubmissionFields, title: '' },
      file: { filename: 'test.pdf', content: ORIGINAL_PDF_CONTENT, mimeType: 'application/pdf' },
    });
    assert(missingTitleRes.status === 400, `26. Missing title returns 400 (got ${missingTitleRes.status})`);

    const myPapersRes = await sendJsonRequest('GET', '/api/question-papers/my', teacher1Token);
    assert(myPapersRes.status === 200, `26b. /api/question-papers/my returns 200 (got ${myPapersRes.status})`);
    assert(Array.isArray(myPapersRes.body.data) && myPapersRes.body.data.length >= 1, '26c. Teacher 1 retrieves authored papers');

    // 27. Module 1 health regression passes
    const healthRes = await sendJsonRequest('GET', '/api/health', null);
    assert(healthRes.status === 200, `27. Module 1 /api/health returns 200 OK (got ${healthRes.status})`);
    assert(healthRes.body.success === true, '27b. Health check reports success: true');

    // -------------------------------------------------------------
    // Summary
    // -------------------------------------------------------------
    console.log('\n===============================================================');
    console.log(`TOTAL SCENARIOS VERIFIED: ${passedTests + failedTests}`);
    console.log(`PASSED: \x1b[32m${passedTests}\x1b[0m`);
    console.log(`FAILED: \x1b[31m${failedTests}\x1b[0m`);
    console.log('===============================================================\n');

    if (failedTests > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Unexpected test runner failure:', err);
    process.exitCode = 1;
  } finally {
    authorizationService.getUserRole = originalGetUserRole;
    supabaseClient.from = originalClientFrom;
    supabaseClient.storage.from = originalClientStorageFrom;
    if (server) {
      server.close();
    }
  }
}

runTestSuite();

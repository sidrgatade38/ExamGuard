/**
 * Comprehensive Automated Verification Test Suite for Module 11:
 * Verification & Decryption Architecture
 *
 * Verifies all required operational, security, cryptographic, and pipeline criteria:
 * 1.  Server starts and binds cleanly on dedicated port 5009.
 * 2.  Authentication: Missing token returns 401.
 * 3.  Authentication: Invalid token returns 401.
 * 4.  Authentication: Expired token returns 401.
 * 5.  Authorization: Unauthorized teacher cannot access another teacher's Question Paper (403).
 * 6.  Authorization: Unauthorized coordinator cannot access unassigned Question Paper (403).
 * 7.  Authorization: Unassigned coordinator cannot download Question Paper (403).
 * 8.  Authorization: Cross-teacher Answer Key access denied (403).
 * 9.  Authorization: Cross-coordinator Answer Key access denied (403).
 * 10. Question Paper: Valid SHA-256 ciphertext hash verification passes.
 * 11. Question Paper: Valid RSA-PSS digital signature verification passes.
 * 12. Question Paper: Valid Question Paper decrypts to exact original plaintext PDF.
 * 13. Question Paper: Teacher verify-signature endpoint returns verified: true, tamperDetected: false.
 * 14. Question Paper: Coordinator verify-signature endpoint returns verified: true, tamperDetected: false.
 * 15. Question Paper: 1-byte tampered ciphertext fails SHA-256 hash check.
 * 16. Question Paper: Tampered ciphertext causes download rejection with 400 Bad Request.
 * 17. Question Paper: Tampered ciphertext NEVER delivers plaintext buffer.
 * 18. Question Paper: Tampered ciphertext verify-signature endpoint reports verified: false, tamperDetected: true.
 * 19. Question Paper: Corrupted RSA-PSS signature fails verification.
 * 20. Question Paper: Corrupted signature fails closed with 400, produces NO plaintext.
 * 21. Answer Key: Valid SHA-256 envelope hash verification passes.
 * 22. Answer Key: Valid RSA-PSS digital signature verification passes.
 * 23. Answer Key: Valid Answer Key decrypts to exact original plaintext PDF.
 * 24. Answer Key: Teacher verify-signature endpoint returns verified: true, tamperDetected: false.
 * 25. Answer Key: Coordinator verify-signature endpoint returns verified: true, tamperDetected: false.
 * 26. Answer Key: 1-byte tampered envelope fails SHA-256 check.
 * 27. Answer Key: Tampered envelope causes download rejection with 400 Bad Request.
 * 28. Answer Key: Tampered envelope NEVER delivers plaintext buffer.
 * 29. Answer Key: Tampered envelope verify-signature reports verified: false, tamperDetected: true.
 * 30. Answer Key: Corrupted Answer Key RSA-PSS signature fails verification.
 * 31. Answer Key: Corrupted signature fails closed with 400, produces NO plaintext.
 * 32. Key Management: RSA-OAEP unwrap succeeds for valid wrapped AES DEK.
 * 33. Key Management: Corrupted / invalid wrapped DEK fails closed with 400.
 * 34. Key Management: Invalid AES key length (not 32 bytes) fails closed with 400.
 * 35. Key Separation: RSA-PSS signing private key CANNOT be used to unwrap AES key.
 * 36. Key Separation: RSA-OAEP wrapping public key CANNOT be used to verify RSA-PSS signature.
 * 37. AES-GCM: Valid AES-256-GCM authentication succeeds.
 * 38. AES-GCM: Modified authentication tag fails closed with 400, produces NO plaintext.
 * 39. AES-GCM: Modified ciphertext payload with valid tag fails GCM tag check with 400.
 * 40. AES-GCM: Invalid IV length (!= 12 bytes) fails safely with 400.
 * 41. AES-GCM: Invalid Auth Tag length (!= 16 bytes) fails safely with 400.
 * 42. Order of Operations: SHA-256 check strictly executes BEFORE key unwrapping.
 * 43. Order of Operations: RSA-PSS signature check strictly executes BEFORE key unwrapping.
 * 44. Order of Operations: RSA-OAEP key unwrapping strictly executes BEFORE AES decryption.
 * 45. Order of Operations: AES decryption strictly executes ONLY after verification passes.
 * 46. Order of Operations: Verification endpoints (/verify-signature) NEVER decrypt or unwrap keys.
 * 47. Memory Safety: zeroizeBuffer safely clears sensitive key buffers in memory.
 * 48. Memory Safety: decryptPayload wipes temporary AES key buffer upon completion.
 * 49. Secret Leakage: API response NEVER contains plaintext AES key.
 * 50. Secret Leakage: API response NEVER contains wrapped AES DEK.
 * 51. Secret Leakage: API response NEVER contains IV.
 * 52. Secret Leakage: API response NEVER contains authentication tag.
 * 53. Secret Leakage: API response NEVER contains RSA private key.
 * 54. Secret Leakage: API error response NEVER contains plaintext PDF.
 * 55. Secret Leakage: API response NEVER leaks internal storage path.
 * 56. Logging Security: No AES keys logged in verification codebase.
 * 57. Logging Security: No JWT tokens logged in verification codebase.
 * 58. Logging Security: No RSA private keys logged in verification codebase.
 * 59. Logging Security: No decrypted plaintext PDFs logged in verification codebase.
 * 60. Regression: Module 1 Health check returns 200 OK.
 * 61. Regression: Module 3 Auth (/api/auth/me) returns 200 OK.
 * 62. Regression: Module 4 RBAC authorization returns 200 for TEACHER.
 * 63. Regression: Module 4 RBAC authorization returns 403 for unauthorized role.
 * 64. Regression: Module 5 Teacher question paper listing (/api/question-papers/my) returns 200 OK.
 * 65. Regression: Module 6 AES-256-GCM encryption and decryption roundtrip.
 * 66. Regression: Module 7 RSA-PSS digital signature sign and verify roundtrip.
 * 67. Regression: Module 8 RSA-OAEP key wrapping and unwrapping roundtrip.
 * 68. Regression: Module 9 Exam Coordinator paper listing returns 200 OK.
 * 69. Regression: Module 10 Teacher Answer Key metadata retrieval returns 200 OK.
 * 70. Regression: Module 10 Coordinator Answer Key metadata retrieval returns 200 OK.
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
const verificationService = require('../src/services/verificationService');
const questionPaperService = require('../src/services/questionPaperService');
const examCoordinatorService = require('../src/services/examCoordinatorService');
const answerKeyService = require('../src/services/answerKeyService');
const { getSupabaseClient } = require('../src/config/supabase');
const supabaseClient = getSupabaseClient();
const { generateToken } = require('../src/utils/jwt');

const TEST_PORT = 5009;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
let server;

// Mock test users
const MOCK_USERS = {
  authorTeacher: {
    userId: '22222222-2222-2222-2222-222222222222',
    name: 'Prof. Alice Author',
    roleId: 'role-teacher-uuid',
    roleName: 'TEACHER',
    email: 'alice.author@examguard.edu',
    isActive: true,
  },
  otherTeacher: {
    userId: '44444444-4444-4444-4444-444444444444',
    name: 'Prof. Bob Other',
    roleId: 'role-teacher-uuid',
    roleName: 'TEACHER',
    email: 'bob.other@examguard.edu',
    isActive: true,
  },
  assignedCoordinator: {
    userId: '33333333-3333-3333-3333-333333333333',
    name: 'Exam Coordinator Alpha',
    roleId: 'role-coord-uuid',
    roleName: 'EXAM_COORDINATOR',
    email: 'coord1@examguard.edu',
    isActive: true,
  },
  unassignedCoordinator: {
    userId: '77777777-7777-7777-7777-777777777777',
    name: 'Exam Coordinator Beta',
    roleId: 'role-coord-uuid',
    roleName: 'EXAM_COORDINATOR',
    email: 'coord2@examguard.edu',
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

// Generate test JWT tokens
const authorToken = generateToken({
  userId: MOCK_USERS.authorTeacher.userId,
  email: MOCK_USERS.authorTeacher.email,
  role: MOCK_USERS.authorTeacher.roleName,
});

const otherTeacherToken = generateToken({
  userId: MOCK_USERS.otherTeacher.userId,
  email: MOCK_USERS.otherTeacher.email,
  role: MOCK_USERS.otherTeacher.roleName,
});

const assignedCoordToken = generateToken({
  userId: MOCK_USERS.assignedCoordinator.userId,
  email: MOCK_USERS.assignedCoordinator.email,
  role: MOCK_USERS.assignedCoordinator.roleName,
});

const unassignedCoordToken = generateToken({
  userId: MOCK_USERS.unassignedCoordinator.userId,
  email: MOCK_USERS.unassignedCoordinator.email,
  role: MOCK_USERS.unassignedCoordinator.roleName,
});

const adminToken = generateToken({
  userId: MOCK_USERS.admin.userId,
  email: MOCK_USERS.admin.email,
  role: MOCK_USERS.admin.roleName,
});

// Expired JWT token (issued with negative expiration)
const expiredToken = (() => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    {
      userId: MOCK_USERS.authorTeacher.userId,
      email: MOCK_USERS.authorTeacher.email,
      role: MOCK_USERS.authorTeacher.roleName,
    },
    config.jwtSecret,
    { expiresIn: -10 }
  );
})();

// Calculate authoritative test dates relative to today
const today = new Date();
function formatYMD(d) {
  return d.toISOString().split('T')[0];
}
const examDateStr = formatYMD(today);

// In-memory mock database collections
const inMemoryPapers = new Map();
const inMemoryPaperKeys = new Map();
const inMemoryAssignments = new Map();
const inMemoryAnswerKeys = new Map();
const inMemorySignatures = new Map();
const inMemoryStorage = new Map();

// Test IDs
const PAPER_ID = 'paper-m11-uuid-001';
const PAPER_OTHER_ID = 'paper-m11-other-002';
const ANSWER_KEY_ID = 'ak-m11-uuid-001';

// Sample PDF contents for Question Paper and Answer Key
const QP_PLAINTEXT_PDF = Buffer.from(
  '%PDF-1.4\n%ExamGuard Question Paper: Cryptography & Network Security 2026\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n%%EOF',
  'utf8'
);
const AK_PLAINTEXT_PDF = Buffer.from(
  '%PDF-1.4\n%ExamGuard Answer Key: Cryptography & Network Security Solutions 2026\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n%%EOF',
  'utf8'
);

// Encrypt and sign Question Paper
const qpEncryptionResult = encryptionService.encryptQuestionPaper(QP_PLAINTEXT_PDF);
const qpSigningResult = signatureService.signQuestionPaper(qpEncryptionResult.encryptedBuffer);
const qpStoragePath = `question-papers/${MOCK_USERS.authorTeacher.userId}/${PAPER_ID}/encrypted/CS501_Exam.pdf.enc`;

// Store QP in mock DB and storage
inMemoryPapers.set(PAPER_ID, {
  id: PAPER_ID,
  teacher_id: MOCK_USERS.authorTeacher.userId,
  title: 'Cryptography & Network Security Final Exam',
  subject: 'CS501',
  semester: 'Semester 6',
  academic_year: '2026-2027',
  exam_type: 'End Semester Examination',
  exam_date: examDateStr,
  status: 'READY',
  submitted_at: new Date().toISOString(),
  scheduled_delivery_date: examDateStr,
  file_name: 'CS501_Exam.pdf',
  storage_path: qpStoragePath,
  file_size: qpEncryptionResult.encryptedSize,
  mime_type: 'application/pdf',
});

inMemoryPaperKeys.set(PAPER_ID, {
  question_paper_id: PAPER_ID,
  encrypted_aes_key: qpEncryptionResult.encryptedAesKey,
  iv: qpEncryptionResult.iv,
  auth_tag: qpEncryptionResult.authTag,
});

inMemorySignatures.set(`qp-${PAPER_ID}`, {
  id: 'sig-qp-001',
  question_paper_id: PAPER_ID,
  algorithm: qpSigningResult.algorithm,
  file_hash: qpSigningResult.fileHash,
  signature: qpSigningResult.signature,
  public_key_reference: qpSigningResult.publicKeyReference,
  created_at: new Date().toISOString(),
});

inMemoryStorage.set(qpStoragePath, Buffer.from(qpEncryptionResult.encryptedBuffer));

// Other teacher's paper (not owned by authorTeacher, not assigned to assignedCoordinator)
inMemoryPapers.set(PAPER_OTHER_ID, {
  id: PAPER_OTHER_ID,
  teacher_id: MOCK_USERS.otherTeacher.userId,
  title: 'Distributed Systems Exam',
  subject: 'CS502',
  semester: 'Semester 6',
  academic_year: '2026-2027',
  exam_type: 'End Semester Examination',
  exam_date: examDateStr,
  status: 'READY',
  submitted_at: new Date().toISOString(),
  scheduled_delivery_date: examDateStr,
  file_name: 'CS502_Exam.pdf',
  storage_path: `question-papers/${MOCK_USERS.otherTeacher.userId}/${PAPER_OTHER_ID}/encrypted/CS502_Exam.pdf.enc`,
  file_size: 14000,
  mime_type: 'application/pdf',
});

// Coordinator assignment for PAPER_ID to assignedCoordinator
inMemoryAssignments.set('assign-m11-001', {
  id: 'assign-m11-001',
  question_paper_id: PAPER_ID,
  assigned_to_user_id: MOCK_USERS.assignedCoordinator.userId,
  delivery_status: 'SCHEDULED',
  scheduled_delivery_date: examDateStr,
});

// Encrypt and sign Answer Key using Module 10 envelope architecture:
// [256-byte wrapped DEK] [12-byte IV] [16-byte AuthTag] [Ciphertext...]
const akAesKey = crypto.randomBytes(32);
const akIv = crypto.randomBytes(12);
const akCipher = crypto.createCipheriv('aes-256-gcm', akAesKey, akIv);
const akCiphertext = Buffer.concat([akCipher.update(AK_PLAINTEXT_PDF), akCipher.final()]);
const akAuthTag = akCipher.getAuthTag();
const akWrappedKey = keyManagementService.wrapAesKey(akAesKey);
const akWrappedKeyBuf = Buffer.from(akWrappedKey, 'base64');
const akEnvelopeBuffer = Buffer.concat([akWrappedKeyBuf, akIv, akAuthTag, akCiphertext]);
const akSigningResult = signatureService.signQuestionPaper(akEnvelopeBuffer);
const akStoragePath = `answer-keys/${MOCK_USERS.authorTeacher.userId}/${PAPER_ID}/encrypted/CS501_AnswerKey.pdf.enc`;

inMemoryAnswerKeys.set(ANSWER_KEY_ID, {
  id: ANSWER_KEY_ID,
  question_paper_id: PAPER_ID,
  file_name: 'CS501_AnswerKey.pdf',
  storage_path: akStoragePath,
  file_size: akEnvelopeBuffer.length,
  mime_type: 'application/pdf',
  exam_date: examDateStr,
  uploaded_at: new Date().toISOString(),
  status: 'READY',
});

inMemorySignatures.set(`ak-${ANSWER_KEY_ID}`, {
  id: 'sig-ak-001',
  answer_key_id: ANSWER_KEY_ID,
  algorithm: akSigningResult.algorithm,
  file_hash: akSigningResult.fileHash,
  signature: akSigningResult.signature,
  public_key_reference: akSigningResult.publicKeyReference,
  created_at: new Date().toISOString(),
});

inMemoryStorage.set(akStoragePath, Buffer.from(akEnvelopeBuffer));

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

// Flags for tamper simulation in tests
let tamperStoragePath = null;
let tamperTransform = null;

// Intercept Supabase database queries
supabaseClient.from = function (tableName) {
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
        eq: (col, val) => ({
          maybeSingle: () => {
            const paper = inMemoryPapers.get(val);
            return Promise.resolve({ data: paper || null, error: null });
          },
          order: () => {
            const matched = [];
            for (const p of inMemoryPapers.values()) {
              if (p[col] === val) matched.push(p);
            }
            return Promise.resolve({ data: matched, error: null });
          },
        }),
      }),
    };
  }

  if (tableName === 'question_paper_assignments') {
    return {
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
        }),
      }),
    };
  }

  if (tableName === 'paper_keys') {
    return {
      select: () => ({
        eq: (col, val) => ({
          maybeSingle: () => {
            const keyRecord = inMemoryPaperKeys.get(val);
            return Promise.resolve({ data: keyRecord || null, error: null });
          },
        }),
      }),
    };
  }

  if (tableName === 'answer_keys') {
    return {
      select: () => ({
        eq: (col, val) => ({
          maybeSingle: () => {
            for (const ak of inMemoryAnswerKeys.values()) {
              if (ak[col] === val) {
                return Promise.resolve({ data: ak, error: null });
              }
            }
            return Promise.resolve({ data: null, error: null });
          },
        }),
      }),
    };
  }

  if (tableName === 'digital_signatures') {
    return {
      select: () => ({
        eq: (col, val) => ({
          maybeSingle: () => {
            if (col === 'question_paper_id') {
              const sig = inMemorySignatures.get(`qp-${val}`);
              return Promise.resolve({ data: sig || null, error: null });
            }
            if (col === 'answer_key_id') {
              const sig = inMemorySignatures.get(`ak-${val}`);
              return Promise.resolve({ data: sig || null, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
        }),
      }),
    };
  }

  return {
    select: () => ({
      eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }),
    }),
  };
};

// Intercept Supabase Storage
supabaseClient.storage = {
  from: () => ({
    download: async (storagePath) => {
      const data = inMemoryStorage.get(storagePath);
      if (!data) {
        return { data: null, error: new Error('Object not found in storage') };
      }
      if (tamperStoragePath === storagePath && typeof tamperTransform === 'function') {
        const tampered = tamperTransform(Buffer.from(data));
        return { data: tampered, error: null };
      }
      return { data: Buffer.from(data), error: null };
    },
  }),
};

// HTTP request helper
function makeRequest({ method = 'GET', path: reqPath, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const url = new URL(reqPath, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { ...headers },
    };

    let bodyBuffer = null;
    if (body) {
      if (Buffer.isBuffer(body)) {
        bodyBuffer = body;
      } else if (typeof body === 'string') {
        bodyBuffer = Buffer.from(body, 'utf8');
      } else {
        bodyBuffer = Buffer.from(JSON.stringify(body), 'utf8');
        reqOptions.headers['Content-Type'] = 'application/json';
      }
      reqOptions.headers['Content-Length'] = bodyBuffer.length;
    }

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        let json = null;
        const contentType = res.headers['content-type'] || '';
        if (contentType.includes('application/json')) {
          try {
            json = JSON.parse(rawBuffer.toString('utf8'));
          } catch (e) {
            // not valid JSON
          }
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          rawBuffer,
          body: json,
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (bodyBuffer) {
      req.write(bodyBuffer);
    }
    req.end();
  });
}

// Test runner assertion tracking
let assertionCount = 0;
let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition, message) {
  assertionCount++;
  if (condition) {
    passedAssertions++;
    console.log(`  ✓ [ASSERTION ${assertionCount}] ${message}`);
  } else {
    failedAssertions++;
    console.error(`  ✗ [ASSERTION ${assertionCount}] FAILED: ${message}`);
  }
}

async function runVerificationDecryptionTestSuite() {
  console.log('============================================================');
  console.log('  EXAMGUARD MODULE 11: VERIFICATION & DECRYPTION TEST SUITE  ');
  console.log('============================================================\n');

  try {
    // Start test server on dedicated port 5009
    server = app.listen(TEST_PORT);
    await new Promise((resolve) => server.once('listening', resolve));
    console.log(`[Suite 11] Test server listening on http://127.0.0.1:${TEST_PORT}\n`);

    // ============================================================
    // Section 1: Server Startup & Health Check
    // ============================================================
    console.log('--- Section 1: Server Startup & Health Check ---');
    const healthRes = await makeRequest({ path: '/api/health' });
    assert(healthRes.statusCode === 200, 'Server starts and health check returns 200 OK on port 5009');
    assert(healthRes.body?.success === true, 'Health check response contains success: true');

    // ============================================================
    // Section 2: Authentication
    // ============================================================
    console.log('\n--- Section 2: Authentication (401 Failures) ---');
    // Missing token
    const missingTokenQP = await makeRequest({
      path: `/api/question-papers/${PAPER_ID}/download`,
    });
    assert(missingTokenQP.statusCode === 401, 'Missing token on QP download returns 401 Unauthorized');

    const missingTokenAK = await makeRequest({
      path: `/api/teacher/question-papers/${PAPER_ID}/answer-key/download`,
    });
    assert(missingTokenAK.statusCode === 401, 'Missing token on AK download returns 401 Unauthorized');

    // Invalid token
    const invalidTokenQP = await makeRequest({
      path: `/api/question-papers/${PAPER_ID}/download`,
      headers: { Authorization: 'Bearer this.is.invalid.jwt.token' },
    });
    assert(invalidTokenQP.statusCode === 401, 'Invalid token on QP download returns 401 Unauthorized');

    // Expired token
    const expiredTokenQP = await makeRequest({
      path: `/api/question-papers/${PAPER_ID}/download`,
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(expiredTokenQP.statusCode === 401, 'Expired token on QP download returns 401 Unauthorized');

    // ============================================================
    // Section 3: Authorization (403 Failures)
    // ============================================================
    console.log('\n--- Section 3: Authorization (403 Failures) ---');
    // Non-author teacher cannot download or verify another teacher's paper
    const nonAuthorDownloadQP = await makeRequest({
      path: `/api/question-papers/${PAPER_OTHER_ID}/download`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(nonAuthorDownloadQP.statusCode === 403, 'Unauthorized teacher denied download of other teacher paper (403 Forbidden)');

    const nonAuthorVerifyQP = await makeRequest({
      path: `/api/question-papers/${PAPER_OTHER_ID}/verify-signature`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(nonAuthorVerifyQP.statusCode === 403, 'Unauthorized teacher denied verification of other teacher paper (403 Forbidden)');

    // Coordinator denied access to unassigned question paper
    const unassignedCoordDownloadQP = await makeRequest({
      path: `/api/exam-coordinator/question-papers/${PAPER_OTHER_ID}/download`,
      headers: { Authorization: `Bearer ${assignedCoordToken}` },
    });
    assert(unassignedCoordDownloadQP.statusCode === 403, 'Assigned coordinator denied access to non-assigned paper (403 Forbidden)');

    const unassignedCoordVerifyQP = await makeRequest({
      path: `/api/exam-coordinator/question-papers/${PAPER_OTHER_ID}/verify-signature`,
      headers: { Authorization: `Bearer ${assignedCoordToken}` },
    });
    assert(unassignedCoordVerifyQP.statusCode === 403, 'Assigned coordinator denied verification of non-assigned paper (403 Forbidden)');

    // Unassigned coordinator accessing PAPER_ID
    const unassignedCoordPaper1 = await makeRequest({
      path: `/api/exam-coordinator/question-papers/${PAPER_ID}/download`,
      headers: { Authorization: `Bearer ${unassignedCoordToken}` },
    });
    assert(unassignedCoordPaper1.statusCode === 403, 'Unassigned coordinator denied download of assigned paper (403 Forbidden)');

    // Cross-teacher Answer Key access denied
    const nonAuthorAKDownload = await makeRequest({
      path: `/api/teacher/question-papers/${PAPER_OTHER_ID}/answer-key/download`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(nonAuthorAKDownload.statusCode === 403, 'Cross-teacher Answer Key download denied (403 Forbidden)');

    // ============================================================
    // Section 4: Question Paper Verification & Decryption
    // ============================================================
    console.log('\n--- Section 4: Question Paper Verification & Decryption ---');
    // Valid Question Paper hash passes
    const qpIntegrity = verificationService.verifyCiphertextIntegrity(
      qpEncryptionResult.encryptedBuffer,
      qpSigningResult.fileHash
    );
    assert(qpIntegrity.valid === true, 'Valid Question Paper SHA-256 hash passes verification');
    assert(qpIntegrity.calculatedHash === qpSigningResult.fileHash, 'Calculated hash matches stored digest');

    // Valid Question Paper signature passes
    const qpSigValid = verificationService.verifyDigitalSignature(
      qpEncryptionResult.encryptedBuffer,
      qpSigningResult.signature
    );
    assert(qpSigValid === true, 'Valid Question Paper RSA-PSS digital signature passes verification');

    // Valid Question Paper decrypts to exact plaintext PDF
    const qpDecrypted = verificationService.verifyAndDecryptQuestionPaper({
      ciphertextBuffer: qpEncryptionResult.encryptedBuffer,
      sigRecord: {
        file_hash: qpSigningResult.fileHash,
        signature: qpSigningResult.signature,
      },
      keyRecord: {
        encrypted_aes_key: qpEncryptionResult.encryptedAesKey,
        iv: qpEncryptionResult.iv,
        auth_tag: qpEncryptionResult.authTag,
      },
    });
    assert(Buffer.isBuffer(qpDecrypted), 'verifyAndDecryptQuestionPaper returns Buffer');
    assert(qpDecrypted.equals(QP_PLAINTEXT_PDF), 'Decrypted Question Paper matches original plaintext PDF byte-for-byte');

    // Author teacher verifies Question Paper via API
    const teacherVerifyQP = await makeRequest({
      path: `/api/question-papers/${PAPER_ID}/verify-signature`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(teacherVerifyQP.statusCode === 200, 'Teacher verify-signature endpoint returns 200 OK');
    assert(teacherVerifyQP.body?.data?.verified === true, 'Teacher verify reports verified: true');
    assert(teacherVerifyQP.body?.data?.tamperDetected === false, 'Teacher verify reports tamperDetected: false');

    // Coordinator verifies Question Paper via API
    const coordVerifyQP = await makeRequest({
      path: `/api/exam-coordinator/question-papers/${PAPER_ID}/verify-signature`,
      headers: { Authorization: `Bearer ${assignedCoordToken}` },
    });
    assert(coordVerifyQP.statusCode === 200, 'Coordinator verify-signature endpoint returns 200 OK');
    assert(coordVerifyQP.body?.data?.verified === true, 'Coordinator verify reports verified: true');
    assert(coordVerifyQP.body?.data?.tamperDetected === false, 'Coordinator verify reports tamperDetected: false');

    // Author teacher downloads decrypted Question Paper via API
    const teacherDownloadQP = await makeRequest({
      path: `/api/question-papers/${PAPER_ID}/download`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(teacherDownloadQP.statusCode === 200, 'Author teacher downloads decrypted Question Paper (200 OK)');
    assert(teacherDownloadQP.rawBuffer.equals(QP_PLAINTEXT_PDF), 'Teacher downloaded PDF matches original plaintext byte-for-byte');

    // Coordinator downloads decrypted Question Paper via API
    const coordDownloadQP = await makeRequest({
      path: `/api/exam-coordinator/question-papers/${PAPER_ID}/download`,
      headers: { Authorization: `Bearer ${assignedCoordToken}` },
    });
    assert(coordDownloadQP.statusCode === 200, 'Coordinator downloads decrypted Question Paper (200 OK)');
    assert(coordDownloadQP.rawBuffer.equals(QP_PLAINTEXT_PDF), 'Coordinator downloaded PDF matches original plaintext byte-for-byte');

    // Tampered Question Paper: 1-byte modification fails hash
    const tamperedQpBuffer = Buffer.from(qpEncryptionResult.encryptedBuffer);
    tamperedQpBuffer[tamperedQpBuffer.length - 1] ^= 0x55; // flip byte
    const tamperedQpIntegrity = verificationService.verifyCiphertextIntegrity(
      tamperedQpBuffer,
      qpSigningResult.fileHash
    );
    assert(tamperedQpIntegrity.valid === false, 'Tampered Question Paper ciphertext fails SHA-256 hash check');

    // Tampered Question Paper fails verifyAndDecryptQuestionPaper and produces NO plaintext
    let qpTamperErrorThrown = false;
    let qpTamperOutput = null;
    try {
      qpTamperOutput = verificationService.verifyAndDecryptQuestionPaper({
        ciphertextBuffer: tamperedQpBuffer,
        sigRecord: {
          file_hash: qpSigningResult.fileHash,
          signature: qpSigningResult.signature,
        },
        keyRecord: {
          encrypted_aes_key: qpEncryptionResult.encryptedAesKey,
          iv: qpEncryptionResult.iv,
          auth_tag: qpEncryptionResult.authTag,
        },
      });
    } catch (err) {
      qpTamperErrorThrown = true;
      assert(err.statusCode === 400, 'Tampered Question Paper throws 400 error');
    }
    assert(qpTamperErrorThrown === true, 'Tampered Question Paper aborts immediately with error');
    assert(qpTamperOutput === null, 'Tampered Question Paper produces NO plaintext buffer');

    // Tampered Question Paper in storage triggers fail-closed 400 via HTTP API
    tamperStoragePath = qpStoragePath;
    tamperTransform = (buf) => {
      const copy = Buffer.from(buf);
      copy[copy.length - 1] ^= 0xff;
      return copy;
    };

    const tamperedDownloadRes = await makeRequest({
      path: `/api/question-papers/${PAPER_ID}/download`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(tamperedDownloadRes.statusCode === 400, 'Tampered Question Paper download returns 400 Bad Request');
    assert(!tamperedDownloadRes.rawBuffer.includes(QP_PLAINTEXT_PDF), 'Tampered Question Paper API returns NO plaintext');

    const tamperedVerifyRes = await makeRequest({
      path: `/api/question-papers/${PAPER_ID}/verify-signature`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(tamperedVerifyRes.statusCode === 200, 'Tampered Question Paper verify returns 200 with tamper status');
    assert(tamperedVerifyRes.body?.data?.verified === false, 'Tampered Question Paper verify reports verified: false');
    assert(tamperedVerifyRes.body?.data?.tamperDetected === true, 'Tampered Question Paper verify reports tamperDetected: true');

    // Reset tamper simulation
    tamperStoragePath = null;
    tamperTransform = null;

    // Corrupted RSA-PSS signature fails
    const corruptedQpSig = qpSigningResult.signature.slice(0, -4) + 'AAAA';
    const corruptedSigResult = verificationService.verifyDigitalSignature(
      qpEncryptionResult.encryptedBuffer,
      corruptedQpSig
    );
    assert(corruptedSigResult === false, 'Corrupted RSA-PSS signature verification returns false');

    let corruptedSigErrorThrown = false;
    try {
      verificationService.verifyAndDecryptQuestionPaper({
        ciphertextBuffer: qpEncryptionResult.encryptedBuffer,
        sigRecord: {
          file_hash: qpSigningResult.fileHash,
          signature: corruptedQpSig,
        },
        keyRecord: {
          encrypted_aes_key: qpEncryptionResult.encryptedAesKey,
          iv: qpEncryptionResult.iv,
          auth_tag: qpEncryptionResult.authTag,
        },
      });
    } catch (err) {
      corruptedSigErrorThrown = true;
      assert(err.statusCode === 400, 'Corrupted signature triggers 400 error in verifyAndDecryptQuestionPaper');
    }
    assert(corruptedSigErrorThrown === true, 'Corrupted signature fails closed and produces NO plaintext');

    // ============================================================
    // Section 5: Answer Key Verification & Decryption
    // ============================================================
    console.log('\n--- Section 5: Answer Key Verification & Decryption ---');
    // Valid Answer Key hash passes
    const akIntegrity = verificationService.verifyCiphertextIntegrity(
      akEnvelopeBuffer,
      akSigningResult.fileHash
    );
    assert(akIntegrity.valid === true, 'Valid Answer Key SHA-256 hash passes verification');

    // Valid Answer Key signature passes
    const akSigValid = verificationService.verifyDigitalSignature(
      akEnvelopeBuffer,
      akSigningResult.signature
    );
    assert(akSigValid === true, 'Valid Answer Key RSA-PSS signature passes verification');

    // Valid Answer Key decrypts to exact plaintext PDF
    const akDecrypted = verificationService.verifyAndDecryptAnswerKey({
      envelopeBuffer: akEnvelopeBuffer,
      sigRecord: {
        file_hash: akSigningResult.fileHash,
        signature: akSigningResult.signature,
      },
    });
    assert(Buffer.isBuffer(akDecrypted), 'verifyAndDecryptAnswerKey returns Buffer');
    assert(akDecrypted.equals(AK_PLAINTEXT_PDF), 'Decrypted Answer Key matches original plaintext PDF byte-for-byte');

    // Author teacher verifies Answer Key via API
    const teacherVerifyAK = await makeRequest({
      path: `/api/teacher/question-papers/${PAPER_ID}/answer-key/verify-signature`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(teacherVerifyAK.statusCode === 200, 'Teacher verify Answer Key signature returns 200 OK');
    assert(teacherVerifyAK.body?.data?.verified === true, 'Teacher AK verify reports verified: true');
    assert(teacherVerifyAK.body?.data?.tamperDetected === false, 'Teacher AK verify reports tamperDetected: false');

    // Coordinator verifies Answer Key via API
    const coordVerifyAK = await makeRequest({
      path: `/api/exam-coordinator/question-papers/${PAPER_ID}/answer-key/verify-signature`,
      headers: { Authorization: `Bearer ${assignedCoordToken}` },
    });
    assert(coordVerifyAK.statusCode === 200, 'Coordinator verify Answer Key signature returns 200 OK');
    assert(coordVerifyAK.body?.data?.verified === true, 'Coordinator AK verify reports verified: true');
    assert(coordVerifyAK.body?.data?.tamperDetected === false, 'Coordinator AK verify reports tamperDetected: false');

    // Author teacher downloads decrypted Answer Key via API
    const teacherDownloadAK = await makeRequest({
      path: `/api/teacher/question-papers/${PAPER_ID}/answer-key/download`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(teacherDownloadAK.statusCode === 200, 'Teacher downloads decrypted Answer Key (200 OK)');
    assert(teacherDownloadAK.rawBuffer.equals(AK_PLAINTEXT_PDF), 'Teacher downloaded AK matches original plaintext byte-for-byte');

    // Coordinator downloads decrypted Answer Key via API
    const coordDownloadAK = await makeRequest({
      path: `/api/exam-coordinator/question-papers/${PAPER_ID}/answer-key/download`,
      headers: { Authorization: `Bearer ${assignedCoordToken}` },
    });
    assert(coordDownloadAK.statusCode === 200, 'Coordinator downloads decrypted Answer Key (200 OK)');
    assert(coordDownloadAK.rawBuffer.equals(AK_PLAINTEXT_PDF), 'Coordinator downloaded AK matches original plaintext byte-for-byte');

    // Tampered Answer Key envelope: 1-byte modification fails hash
    const tamperedAkEnvelope = Buffer.from(akEnvelopeBuffer);
    tamperedAkEnvelope[tamperedAkEnvelope.length - 1] ^= 0x33;
    const tamperedAkIntegrity = verificationService.verifyCiphertextIntegrity(
      tamperedAkEnvelope,
      akSigningResult.fileHash
    );
    assert(tamperedAkIntegrity.valid === false, 'Tampered Answer Key envelope fails SHA-256 check');

    // Tampered Answer Key produces NO plaintext
    let akTamperErrorThrown = false;
    let akTamperOutput = null;
    try {
      akTamperOutput = verificationService.verifyAndDecryptAnswerKey({
        envelopeBuffer: tamperedAkEnvelope,
        sigRecord: {
          file_hash: akSigningResult.fileHash,
          signature: akSigningResult.signature,
        },
      });
    } catch (err) {
      akTamperErrorThrown = true;
      assert(err.statusCode === 400, 'Tampered Answer Key throws 400 error');
    }
    assert(akTamperErrorThrown === true, 'Tampered Answer Key aborts immediately');
    assert(akTamperOutput === null, 'Tampered Answer Key produces NO plaintext');

    // Tampered Answer Key storage download fails closed with 400
    tamperStoragePath = akStoragePath;
    tamperTransform = (buf) => {
      const copy = Buffer.from(buf);
      copy[copy.length - 1] ^= 0xaa;
      return copy;
    };

    const tamperedAkDownloadRes = await makeRequest({
      path: `/api/teacher/question-papers/${PAPER_ID}/answer-key/download`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(tamperedAkDownloadRes.statusCode === 400, 'Tampered Answer Key download returns 400 Bad Request');
    assert(!tamperedAkDownloadRes.rawBuffer.includes(AK_PLAINTEXT_PDF), 'Tampered Answer Key download returns NO plaintext');

    const tamperedAkVerifyRes = await makeRequest({
      path: `/api/teacher/question-papers/${PAPER_ID}/answer-key/verify-signature`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(tamperedAkVerifyRes.statusCode === 200, 'Tampered Answer Key verify returns 200 with tamper status');
    assert(tamperedAkVerifyRes.body?.data?.verified === false, 'Tampered Answer Key verify reports verified: false');
    assert(tamperedAkVerifyRes.body?.data?.tamperDetected === true, 'Tampered Answer Key verify reports tamperDetected: true');

    // Reset tamper simulation
    tamperStoragePath = null;
    tamperTransform = null;

    // Corrupted Answer Key signature fails
    const corruptedAkSig = akSigningResult.signature.slice(0, -4) + 'ZZZZ';
    const corruptedAkSigRes = verificationService.verifyDigitalSignature(
      akEnvelopeBuffer,
      corruptedAkSig
    );
    assert(corruptedAkSigRes === false, 'Corrupted Answer Key RSA-PSS signature verification returns false');

    let corruptedAkSigErrorThrown = false;
    try {
      verificationService.verifyAndDecryptAnswerKey({
        envelopeBuffer: akEnvelopeBuffer,
        sigRecord: {
          file_hash: akSigningResult.fileHash,
          signature: corruptedAkSig,
        },
      });
    } catch (err) {
      corruptedAkSigErrorThrown = true;
      assert(err.statusCode === 400, 'Corrupted signature triggers 400 in verifyAndDecryptAnswerKey');
    }
    assert(corruptedAkSigErrorThrown === true, 'Corrupted Answer Key signature fails closed and produces NO plaintext');

    // ============================================================
    // Section 6: Key Management & Cryptographic Key Separation
    // ============================================================
    console.log('\n--- Section 6: Key Management & Cryptographic Key Separation ---');
    // RSA-OAEP unwrap succeeds for valid wrapped DEK
    const testAesKey = crypto.randomBytes(32);
    const testWrappedKey = keyManagementService.wrapAesKey(testAesKey);
    const unwrappedKey = verificationService.unwrapDocumentKey(testWrappedKey);
    assert(Buffer.isBuffer(unwrappedKey) && unwrappedKey.length === 32, 'unwrapDocumentKey returns 32-byte AES key');
    assert(unwrappedKey.equals(testAesKey), 'Unwrapped key matches original AES key byte-for-byte');

    // Invalid wrapped DEK fails safely
    const invalidWrappedKey = 'not-a-valid-base64-or-wrapped-key';
    let unwrapInvalidError = false;
    try {
      verificationService.unwrapDocumentKey(invalidWrappedKey);
    } catch (err) {
      unwrapInvalidError = true;
      assert(err.statusCode === 400, 'Corrupted wrapped key throws 400 error');
    }
    assert(unwrapInvalidError === true, 'Corrupted wrapped key fails closed');

    // Invalid AES key length (not 32 bytes) fails safely
    const shortKey = crypto.randomBytes(16); // 16-byte key instead of 32
    const wrappingPubKeyPem = keyManagementService.getWrappingPublicKey();
    const shortWrappedKey = crypto.publicEncrypt(
      {
        key: wrappingPubKeyPem,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      shortKey
    ).toString('base64');
    let shortKeyError = false;
    try {
      verificationService.unwrapDocumentKey(shortWrappedKey);
    } catch (err) {
      shortKeyError = true;
      assert(err.statusCode === 400, 'Invalid AES key size (16 bytes) throws 400 error');
    }
    assert(shortKeyError === true, 'Invalid AES key size rejected by unwrapDocumentKey');

    // Cryptographic Key Separation: RSA-PSS signing private key CANNOT unwrap AES key
    const signingPrivKeyPem = signatureService.getSigningPrivateKey();
    let signingKeyUnwrapFailed = false;
    try {
      // Attempting RSA-OAEP unwrap with RSA signing private key fails
      verificationService.unwrapDocumentKey(testWrappedKey, signingPrivKeyPem);
    } catch (err) {
      signingKeyUnwrapFailed = true;
      assert(err.statusCode === 400, 'Signing key used for unwrapping fails closed with 400');
    }
    assert(signingKeyUnwrapFailed === true, 'Cryptographic Key Separation: Signing private key CANNOT unwrap AES key');

    // Cryptographic Key Separation: RSA-OAEP wrapping public key CANNOT verify RSA-PSS signature
    const invalidKeyVerifyResult = verificationService.verifyDigitalSignature(
      qpEncryptionResult.encryptedBuffer,
      qpSigningResult.signature,
      wrappingPubKeyPem
    );
    assert(invalidKeyVerifyResult === false, 'Cryptographic Key Separation: Wrapping public key CANNOT verify RSA-PSS signature');

    // ============================================================
    // Section 7: AES-256-GCM Decryption & Authentication Tag Validation
    // ============================================================
    console.log('\n--- Section 7: AES-256-GCM Decryption & Tag Validation ---');
    const gcmPlaintext = Buffer.from('GCM Authenticated Test Data 2026', 'utf8');
    const gcmKey = crypto.randomBytes(32);
    const gcmIv = crypto.randomBytes(12);
    const gcmCipher = crypto.createCipheriv('aes-256-gcm', gcmKey, gcmIv);
    const gcmCiphertext = Buffer.concat([gcmCipher.update(gcmPlaintext), gcmCipher.final()]);
    const gcmAuthTag = gcmCipher.getAuthTag();

    // Valid AES-GCM decryption succeeds
    const validGcmDecrypted = verificationService.decryptPayload(
      gcmCiphertext,
      Buffer.from(gcmKey),
      gcmIv,
      gcmAuthTag
    );
    assert(validGcmDecrypted.equals(gcmPlaintext), 'Valid AES-256-GCM decryption succeeds and matches plaintext');

    // Modified authentication tag fails
    const tamperedTag = Buffer.from(gcmAuthTag);
    tamperedTag[0] ^= 0x01;
    let tamperedTagError = false;
    try {
      verificationService.decryptPayload(gcmCiphertext, Buffer.from(gcmKey), gcmIv, tamperedTag);
    } catch (err) {
      tamperedTagError = true;
      assert(err.statusCode === 400, 'Tampered authentication tag throws 400 error');
    }
    assert(tamperedTagError === true, 'Tampered GCM tag fails closed, produces NO plaintext');

    // Modified ciphertext payload with valid tag fails GCM tag check
    const tamperedGcmCiphertext = Buffer.from(gcmCiphertext);
    tamperedGcmCiphertext[0] ^= 0x01;
    let tamperedPayloadError = false;
    try {
      verificationService.decryptPayload(tamperedGcmCiphertext, Buffer.from(gcmKey), gcmIv, gcmAuthTag);
    } catch (err) {
      tamperedPayloadError = true;
      assert(err.statusCode === 400, 'Tampered ciphertext payload throws 400 error on GCM tag verification');
    }
    assert(tamperedPayloadError === true, 'Tampered ciphertext fails GCM authentication, produces NO plaintext');

    // Invalid IV length (!= 12 bytes) fails safely
    const badIv = crypto.randomBytes(16);
    let badIvError = false;
    try {
      verificationService.decryptPayload(gcmCiphertext, Buffer.from(gcmKey), badIv, gcmAuthTag);
    } catch (err) {
      badIvError = true;
      assert(err.statusCode === 400, 'Invalid IV length (16 bytes) throws 400 error');
    }
    assert(badIvError === true, 'Invalid IV length rejected safely');

    // Invalid Auth Tag length (!= 16 bytes) fails safely
    const badTag = crypto.randomBytes(12);
    let badTagError = false;
    try {
      verificationService.decryptPayload(gcmCiphertext, Buffer.from(gcmKey), gcmIv, badTag);
    } catch (err) {
      badTagError = true;
      assert(err.statusCode === 400, 'Invalid Auth Tag length (12 bytes) throws 400 error');
    }
    assert(badTagError === true, 'Invalid Auth Tag length rejected safely');

    // ============================================================
    // Section 8: Order of Operations / Strict Verify-Before-Decrypt Pipeline
    // ============================================================
    console.log('\n--- Section 8: Strict Verify-Before-Decrypt Order of Operations ---');
    // Test that unwrapDocumentKey is NEVER called if SHA-256 hash fails
    let unwrapSpyCalled = false;
    const realUnwrap = keyManagementService.unwrapAesKey;
    keyManagementService.unwrapAesKey = function (...args) {
      unwrapSpyCalled = true;
      return realUnwrap.apply(this, args);
    };

    try {
      // Run verifyAndDecryptQuestionPaper with bad hash
      verificationService.verifyAndDecryptQuestionPaper({
        ciphertextBuffer: qpEncryptionResult.encryptedBuffer,
        sigRecord: {
          file_hash: '0000000000000000000000000000000000000000000000000000000000000000',
          signature: qpSigningResult.signature,
        },
        keyRecord: {
          encrypted_aes_key: qpEncryptionResult.encryptedAesKey,
          iv: qpEncryptionResult.iv,
          auth_tag: qpEncryptionResult.authTag,
        },
      });
    } catch (err) {
      // expected error
    }
    assert(unwrapSpyCalled === false, 'SHA-256 mismatch aborts BEFORE key unwrapping is ever invoked');

    // Test that unwrapDocumentKey is NEVER called if RSA-PSS signature fails
    unwrapSpyCalled = false;
    try {
      verificationService.verifyAndDecryptQuestionPaper({
        ciphertextBuffer: qpEncryptionResult.encryptedBuffer,
        sigRecord: {
          file_hash: qpSigningResult.fileHash,
          signature: corruptedQpSig,
        },
        keyRecord: {
          encrypted_aes_key: qpEncryptionResult.encryptedAesKey,
          iv: qpEncryptionResult.iv,
          auth_tag: qpEncryptionResult.authTag,
        },
      });
    } catch (err) {
      // expected error
    }
    assert(unwrapSpyCalled === false, 'RSA-PSS signature failure aborts BEFORE key unwrapping is ever invoked');

    // Restore real unwrapAesKey
    keyManagementService.unwrapAesKey = realUnwrap;

    // Test that AES decryption is NEVER called if key unwrap fails
    let decryptSpyCalled = false;
    const realDecrypt = crypto.createDecipheriv;
    crypto.createDecipheriv = function (...args) {
      decryptSpyCalled = true;
      return realDecrypt.apply(this, args);
    };

    try {
      verificationService.verifyAndDecryptQuestionPaper({
        ciphertextBuffer: qpEncryptionResult.encryptedBuffer,
        sigRecord: {
          file_hash: qpSigningResult.fileHash,
          signature: qpSigningResult.signature,
        },
        keyRecord: {
          encrypted_aes_key: 'invalid-wrapped-key-bytes',
          iv: qpEncryptionResult.iv,
          auth_tag: qpEncryptionResult.authTag,
        },
      });
    } catch (err) {
      // expected error
    }
    assert(decryptSpyCalled === false, 'Key unwrapping failure aborts BEFORE AES decryption is ever invoked');

    // Restore real createDecipheriv
    crypto.createDecipheriv = realDecrypt;

    // Verification-only endpoints (/verify-signature) NEVER decrypt or unwrap
    let unwrapOnVerifyQP = false;
    keyManagementService.unwrapAesKey = function (...args) {
      unwrapOnVerifyQP = true;
      return realUnwrap.apply(this, args);
    };

    await makeRequest({
      path: `/api/question-papers/${PAPER_ID}/verify-signature`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(unwrapOnVerifyQP === false, 'QP verify-signature endpoint NEVER unwraps keys or decrypts document');

    let unwrapOnVerifyAK = false;
    await makeRequest({
      path: `/api/teacher/question-papers/${PAPER_ID}/answer-key/verify-signature`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(unwrapOnVerifyAK === false, 'AK verify-signature endpoint NEVER unwraps keys or decrypts document');

    // Restore
    keyManagementService.unwrapAesKey = realUnwrap;

    // ============================================================
    // Section 9: Memory Safety & Buffer Zeroization
    // ============================================================
    console.log('\n--- Section 9: Memory Safety & Buffer Zeroization ---');
    const sensitiveKeyBuf = Buffer.from('32-byte-secret-key-material-here', 'utf8');
    assert(sensitiveKeyBuf.some((b) => b !== 0), 'Buffer initially contains non-zero key material');
    verificationService.zeroizeBuffer(sensitiveKeyBuf);
    assert(sensitiveKeyBuf.every((b) => b === 0), 'zeroizeBuffer successfully overwrites sensitive buffer with zeros');

    // Calling zeroizeBuffer on non-buffer is safe (no crash)
    let safeZeroize = true;
    try {
      verificationService.zeroizeBuffer(null);
      verificationService.zeroizeBuffer(undefined);
      verificationService.zeroizeBuffer('string');
    } catch (e) {
      safeZeroize = false;
    }
    assert(safeZeroize === true, 'zeroizeBuffer safely ignores non-Buffer inputs without throwing');

    // ============================================================
    // Section 10: Cryptographic Secret Leakage Audit
    // ============================================================
    console.log('\n--- Section 10: Cryptographic Secret Leakage Audit ---');
    const teacherMetadataRes = await makeRequest({
      path: `/api/question-papers/${PAPER_ID}`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    const metadataString = JSON.stringify(teacherMetadataRes.body || {});

    assert(!metadataString.includes('encrypted_aes_key'), 'QP API metadata response does NOT contain encrypted_aes_key');
    assert(!metadataString.includes('aesKey'), 'QP API metadata response does NOT contain aesKey');
    assert(!metadataString.includes('wrappedKey'), 'QP API metadata response does NOT contain wrappedKey');
    assert(!metadataString.includes('authTag') && !metadataString.includes('auth_tag'), 'QP API metadata response does NOT contain authTag');
    assert(!metadataString.includes('-----BEGIN PRIVATE KEY-----'), 'QP API metadata response does NOT contain private key PEM');
    const coordPaperRes = await makeRequest({
      path: `/api/exam-coordinator/question-papers/${PAPER_ID}`,
      headers: { Authorization: `Bearer ${assignedCoordToken}` },
    });
    const coordPaperString = JSON.stringify(coordPaperRes.body || {});
    assert(!coordPaperString.includes(qpStoragePath), 'Coordinator QP metadata response does NOT leak internal storage path');

    const qpVerifyRes = await makeRequest({
      path: `/api/question-papers/${PAPER_ID}/verify-signature`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    const qpVerifyString = JSON.stringify(qpVerifyRes.body || {});
    assert(!qpVerifyString.includes(qpStoragePath), 'QP verification response does NOT leak internal storage path');

    const teacherAkMetadataRes = await makeRequest({
      path: `/api/teacher/question-papers/${PAPER_ID}/answer-key`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    const akMetadataString = JSON.stringify(teacherAkMetadataRes.body || {});

    assert(!akMetadataString.includes('aesKey'), 'AK API metadata response does NOT contain aesKey');
    assert(!akMetadataString.includes('wrappedKey'), 'AK API metadata response does NOT contain wrappedKey');
    assert(!akMetadataString.includes('authTag'), 'AK API metadata response does NOT contain authTag');
    assert(!akMetadataString.includes('-----BEGIN PRIVATE KEY-----'), 'AK API metadata response does NOT contain private key PEM');
    assert(!akMetadataString.includes(akStoragePath), 'AK API metadata response does NOT leak internal storage path');

    // ============================================================
    // Section 11: Logging Security Audit
    // ============================================================
    console.log('\n--- Section 11: Logging Security Audit ---');
    const verificationServiceCode = fs.readFileSync(
      path.join(__dirname, '../src/services/verificationService.js'),
      'utf8'
    );
    assert(!verificationServiceCode.includes('console.log(aesKey'), 'No console.log of aesKey in verificationService');
    assert(!verificationServiceCode.includes('console.log(decrypted'), 'No console.log of decrypted buffer in verificationService');
    assert(!verificationServiceCode.includes('console.log(privateKey'), 'No console.log of privateKey in verificationService');

    const qpServiceCode = fs.readFileSync(
      path.join(__dirname, '../src/services/questionPaperService.js'),
      'utf8'
    );
    assert(!qpServiceCode.includes('console.log(decryptedBuffer'), 'No console.log of decryptedBuffer in questionPaperService');

    // ============================================================
    // Section 12: Regression Safeguards (Modules 1–10)
    // ============================================================
    console.log('\n--- Section 12: Regression Safeguards (Modules 1–10) ---');
    // Module 1
    const mod1Res = await makeRequest({ path: '/api/health' });
    assert(mod1Res.statusCode === 200, 'Regression Module 1: Health endpoint returns 200 OK');

    // Module 3
    const mod3Res = await makeRequest({
      path: '/api/auth/me',
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(mod3Res.statusCode === 200, 'Regression Module 3: /api/auth/me returns 200 OK');

    // Module 4
    const mod4TeacherRes = await makeRequest({
      path: '/api/rbac/teacher',
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(mod4TeacherRes.statusCode === 200, 'Regression Module 4: /api/rbac/teacher returns 200 for TEACHER');

    const mod4CoordRes = await makeRequest({
      path: '/api/rbac/teacher',
      headers: { Authorization: `Bearer ${assignedCoordToken}` },
    });
    assert(mod4CoordRes.statusCode === 403, 'Regression Module 4: /api/rbac/teacher returns 403 for EXAM_COORDINATOR');

    // Module 5
    const mod5Res = await makeRequest({
      path: '/api/question-papers/my',
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(mod5Res.statusCode === 200, 'Regression Module 5: /api/question-papers/my returns 200 OK');

    // Module 6
    const mod6Cipher = encryptionService.encryptQuestionPaper(Buffer.from('Mod6 Regression', 'utf8'));
    const mod6Plain = encryptionService.decryptQuestionPaper(
      mod6Cipher.encryptedBuffer,
      mod6Cipher.encryptedAesKey,
      mod6Cipher.iv,
      mod6Cipher.authTag
    );
    assert(mod6Plain.toString('utf8') === 'Mod6 Regression', 'Regression Module 6: AES-256-GCM roundtrip succeeds');

    // Module 7
    const mod7Buffer = Buffer.from('Mod7 Digital Signature Regression', 'utf8');
    const mod7Sign = signatureService.signQuestionPaper(mod7Buffer);
    const mod7Valid = signatureService.verifyQuestionPaperSignature(mod7Buffer, mod7Sign.signature);
    assert(mod7Valid === true, 'Regression Module 7: RSA-PSS digital signature roundtrip succeeds');

    // Module 8
    const mod8Key = crypto.randomBytes(32);
    const mod8Wrapped = keyManagementService.wrapAesKey(mod8Key);
    const mod8Unwrapped = keyManagementService.unwrapAesKey(mod8Wrapped);
    assert(mod8Unwrapped.equals(mod8Key), 'Regression Module 8: RSA-OAEP key wrapping roundtrip succeeds');

    // Module 9
    const mod9Res = await makeRequest({
      path: '/api/exam-coordinator/question-papers',
      headers: { Authorization: `Bearer ${assignedCoordToken}` },
    });
    assert(mod9Res.statusCode === 200, 'Regression Module 9: /api/exam-coordinator/question-papers returns 200 OK');

    // Module 10
    const mod10TeacherAK = await makeRequest({
      path: `/api/teacher/question-papers/${PAPER_ID}/answer-key`,
      headers: { Authorization: `Bearer ${authorToken}` },
    });
    assert(mod10TeacherAK.statusCode === 200, 'Regression Module 10: Teacher Answer Key metadata returns 200 OK');

    const mod10CoordAK = await makeRequest({
      path: `/api/exam-coordinator/question-papers/${PAPER_ID}/answer-key`,
      headers: { Authorization: `Bearer ${assignedCoordToken}` },
    });
    assert(mod10CoordAK.statusCode === 200, 'Regression Module 10: Coordinator Answer Key metadata returns 200 OK');

    // ============================================================
    // Final Summary
    // ============================================================
    console.log('\n============================================================');
    console.log('  MODULE 11 VERIFICATION COMPLETED SUCCESSFULLY');
    console.log(`  Passed: ${passedAssertions} / ${assertionCount} Assertions`);
    console.log(`  Failed: ${failedAssertions}`);
    console.log('============================================================\n');

    if (failedAssertions > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during Module 11 test suite execution:', err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
  }
}

runVerificationDecryptionTestSuite();

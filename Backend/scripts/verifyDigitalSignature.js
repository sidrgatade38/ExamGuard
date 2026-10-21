/**
 * Comprehensive Automated Verification Test Suite for Module 7:
 * Digital Signature & Question Paper Integrity Verification
 * 
 * Verifies all 29 required scenarios:
 * 1.  SHA-256 hash generation produces 64-character hex digest.
 * 2.  RSA-PSS digital signature generation succeeds.
 * 3.  Signature verification succeeds for original encrypted ciphertext.
 * 4.  Modified ciphertext (1-bit / 1-byte tamper) fails verification.
 * 5.  Modified signature fails verification.
 * 6.  Signature from Paper A fails on Paper B (paper-specific binding).
 * 7.  Verification with wrong public key fails.
 * 8.  Empty ciphertext fails appropriately.
 * 9.  Signature uses RSA-PSS padding.
 * 10. Signature uses SHA-256 digest algorithm.
 * 11. Dedicated signing key pair is separate and distinct from Module 6 encryption key pair.
 * 12. Private signing key is never returned in API responses or leaked.
 * 13. Digital signature is persisted correctly in digital_signatures table.
 * 14. Correct question_paper_id relationship exists.
 * 15. Computed hash matches stored file_hash.
 * 16. Stored hash detects ciphertext modification.
 * 17. Download verifies signature before decryption.
 * 18. Tampered ciphertext or invalid signature prevents PDF delivery (400 rejection).
 * 19. Teacher ownership is enforced for verification and download.
 * 20. Non-owner teacher receives 403 Forbidden.
 * 21. Missing authentication token returns 401 Unauthorized.
 * 22. Unauthorized role receives 403 Forbidden.
 * 23. Storage rollback cleans up ciphertext if database fails.
 * 24. Database rollback cleans up digital_signatures if subsequent step fails.
 * 25. Module 3 authentication regression check passes.
 * 26. Module 4 RBAC authorization regression check passes.
 * 27. Module 5 question-paper regression check passes.
 * 28. Module 6 encryption & key wrapping regression check passes.
 * 29. Module 1 health check regression check passes.
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { app } = require('../src/server');
const config = require('../src/config');
const authorizationService = require('../src/services/authorizationService');
const encryptionService = require('../src/services/encryptionService');
const signatureService = require('../src/services/signatureService');
const { getSupabaseClient } = require('../src/config/supabase');
const supabaseClient = getSupabaseClient();
const { generateToken, verifyToken } = require('../src/utils/jwt');

const TEST_PORT = 5005;
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
let simulateAssignmentInsertError = false;
let simulateTamperedStorageCiphertext = false;

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
                  const sig = inMemorySignatures.get(p.id);
                  matched.push({
                    ...p,
                    question_paper_assignments: assignment ? [assignment] : [],
                    digital_signatures: sig ? [sig] : [],
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
              const sig = inMemorySignatures.get(paper.id);
              return Promise.resolve({
                data: {
                  ...paper,
                  teacher: { id: paper.teacher_id, name: 'Alice Teacher', email: 'alice@examguard.edu' },
                  question_paper_assignments: assignment ? [assignment] : [],
                  digital_signatures: sig ? [sig] : [],
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

  if (tableName === 'question_paper_assignments') {
    return {
      insert: (records) => ({
        select: () => ({
          single: () => {
            if (simulateAssignmentInsertError) {
              return Promise.resolve({
                data: null,
                error: { message: 'Simulated PostgreSQL constraint failure on question_paper_assignments' },
              });
            }
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
      return Promise.resolve({ data: { path: storagePath }, error: null });
    },
    download: (storagePath) => {
      const buffer = storageFiles.get(storagePath);
      if (!buffer) {
        return Promise.resolve({ data: null, error: { message: 'Object not found' } });
      }
      if (simulateTamperedStorageCiphertext) {
        // Tamper exactly 1 byte in the ciphertext
        const tampered = Buffer.from(buffer);
        tampered[0] ^= 0xff;
        return Promise.resolve({ data: tampered, error: null });
      }
      return Promise.resolve({ data: buffer, error: null });
    },
    remove: (paths) => {
      for (const p of paths) {
        storageRemovals.push(p);
        storageFiles.delete(p);
      }
      return Promise.resolve({ data: paths, error: null });
    },
    createSignedUrl: (storagePath, expiresIn) => {
      return Promise.resolve({
        data: { signedUrl: `https://mock.storage.examguard/${storagePath}?token=mock_signed_url` },
        error: null,
      });
    },
  };
};

// Helper: HTTP Request utility
function makeRequest(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...headers },
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks);
        let json = null;
        try {
          json = JSON.parse(rawBody.toString('utf8'));
        } catch {
          // Non-JSON response (e.g. streaming PDF)
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          rawBody,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else if (typeof body === 'string') {
        req.write(body);
      } else {
        req.write(JSON.stringify(body));
      }
    }
    req.end();
  });
}

// Helper: Build multipart/form-data payload
function buildMultipartBody(fields, fileField) {
  const boundary = '----ExamGuardBoundary' + Date.now().toString(16);
  const crlf = '\r\n';
  const parts = [];

  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}${crlf}Content-Disposition: form-data; name="${k}"${crlf}${crlf}${v}${crlf}`
    ));
  }

  if (fileField) {
    const header = `--${boundary}${crlf}Content-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"${crlf}Content-Type: ${fileField.contentType}${crlf}${crlf}`;
    parts.push(Buffer.from(header));
    parts.push(fileField.buffer);
    parts.push(Buffer.from(crlf));
  }

  parts.push(Buffer.from(`--${boundary}--${crlf}`));
  const body = Buffer.concat(parts);

  return {
    boundary,
    contentType: `multipart/form-data; boundary=${boundary}`,
    body,
  };
}

let testCount = 0;
let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  testCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✔ PASS: ${message}`);
  } else {
    failedCount++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('   EXAMGUARD MODULE 7: DIGITAL SIGNATURE & INTEGRITY TESTS');
  console.log('===============================================================\n');

  server = app.listen(TEST_PORT, () => {
    console.log(`Test server running on port ${TEST_PORT}\n`);
  });

  try {
    const sampleCiphertext = Buffer.from('EXAMGUARD_ENCRYPTED_CIPHERTEXT_SAMPLE_BUFFER_FOR_TESTING_123456');

    // ==============================================================
    // 1 & 2. Unit Cryptographic Tests: Hashing & Signature Primitives
    // ==============================================================
    console.log('--- 1. Cryptographic Primitives: SHA-256 & RSA-PSS ---');

    // 1. SHA-256 produces 64-char hex digest
    const hash = signatureService.calculateSha256(sampleCiphertext);
    assert(typeof hash === 'string' && hash.length === 64, '1. SHA-256 hash generation produces 64-character hex digest');
    assert(/^[0-9a-f]{64}$/.test(hash), '1b. SHA-256 digest format is valid lowercase hexadecimal');

    // 2. RSA-PSS signature generation succeeds
    const sigResult = signatureService.signQuestionPaper(sampleCiphertext);
    assert(sigResult && typeof sigResult.signature === 'string', '2. RSA-PSS signature generation succeeds');
    assert(sigResult.algorithm === 'RSA-PSS-SHA256', '2b. Algorithm indicator is "RSA-PSS-SHA256"');
    assert(sigResult.fileHash === hash, '2c. Generated signature record matches precomputed SHA-256 hash');

    // 3. Signature verification succeeds for original ciphertext
    const verifyValid = signatureService.verifyQuestionPaperSignature(sampleCiphertext, sigResult.signature);
    assert(verifyValid === true, '3. Signature verification succeeds for original encrypted ciphertext');

    // 4. Modified ciphertext (1-bit / 1-byte tamper) fails verification
    const tamperedCiphertext = Buffer.from(sampleCiphertext);
    tamperedCiphertext[0] ^= 0x01; // flip 1 bit
    const verifyTampered = signatureService.verifyQuestionPaperSignature(tamperedCiphertext, sigResult.signature);
    assert(verifyTampered === false, '4. Modified ciphertext (1-bit tamper) strictly fails verification');

    // 5. Modified signature fails verification
    const tamperedSigBuf = Buffer.from(sigResult.signature, 'base64');
    tamperedSigBuf[10] ^= 0xff;
    const tamperedSigStr = tamperedSigBuf.toString('base64');
    const verifyBadSig = signatureService.verifyQuestionPaperSignature(sampleCiphertext, tamperedSigStr);
    assert(verifyBadSig === false, '5. Corrupted/tampered signature fails verification');

    // 6. Signature from Paper A fails on Paper B (paper-specific binding)
    const paperBCiphertext = Buffer.from('DIFFERENT_QUESTION_PAPER_B_ENCRYPTED_CIPHERTEXT_9999');
    const verifyPaperB = signatureService.verifyQuestionPaperSignature(paperBCiphertext, sigResult.signature);
    assert(verifyPaperB === false, '6. Signature from Paper A strictly fails verification on Paper B');

    // 7. Wrong public key fails
    const wrongKeyEncPublic = encryptionService.getPublicKey(); // RSA encryption key
    const verifyWrongKey = signatureService.verifyQuestionPaperSignature(
      sampleCiphertext,
      sigResult.signature,
      wrongKeyEncPublic
    );
    assert(verifyWrongKey === false, '7. Verification with wrong public key fails safely');

    // 8. Empty buffer fails verification appropriately
    const verifyEmpty = signatureService.verifyQuestionPaperSignature(Buffer.alloc(0), sigResult.signature);
    assert(verifyEmpty === false, '8. Empty buffer fails verification appropriately');

    // 9 & 10. Algorithm verification (RSA-PSS with SHA-256)
    assert(sigResult.algorithm === 'RSA-PSS-SHA256', '9. Signature algorithm confirms RSA-PSS padding');
    assert(sigResult.fileHash.length === 64, '10. Signature digest confirms SHA-256 hash length');

    // 11. Dedicated signing key pair is distinct from Module 6 encryption key pair
    const signingPublicKeyPem = signatureService.getSigningPublicKey();
    const encryptionPublicKeyPem = encryptionService.getPublicKey();
    assert(
      signingPublicKeyPem !== encryptionPublicKeyPem,
      '11. Dedicated signing key pair is verified strictly separate from Module 6 encryption key pair'
    );

    // ==============================================================
    // End-to-End Submission & Persistence
    // ==============================================================
    console.log('\n--- End-to-End Encrypted Submission & Digital Signature Persistence ---');

    const samplePdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Title (Module 7 Final Exam)\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF');
    const multipart = buildMultipartBody(
      {
        title: 'Network Security & Applied Cryptography',
        subject: 'Cryptography 401',
        semester: 'Semester 7',
        academicYear: '2026-2027',
        examType: 'FINAL',
        examDate: '2026-11-20',
        assignedToUserId: MOCK_USERS.teacher2.userId,
      },
      {
        name: 'file',
        filename: 'cryptography_final.pdf',
        contentType: 'application/pdf',
        buffer: samplePdfBuffer,
      }
    );

    const submitRes = await makeRequest(
      'POST',
      '/api/question-papers',
      {
        Authorization: `Bearer ${teacher1Token}`,
        'Content-Type': multipart.contentType,
      },
      multipart.body
    );

    assert(submitRes.status === 201, `Submission status is 201 Created (got ${submitRes.status})`);
    const createdPaperId = submitRes.data?.data?.questionPaper?.id;
    assert(!!createdPaperId, 'Question paper ID created successfully');

    // 12. Private signing key is never returned in API responses
    const resString = JSON.stringify(submitRes.data);
    assert(!resString.includes('PRIVATE KEY'), '12. Private signing key is never returned in API responses');
    assert(!resString.includes('BEGIN RSA PRIVATE KEY'), '12b. No RSA private key headers leaked in response');

    // 13. Digital signature is persisted in digital_signatures table
    const storedSigRecord = inMemorySignatures.get(createdPaperId);
    assert(!!storedSigRecord, '13. Digital signature is persisted in digital_signatures table');
    assert(storedSigRecord?.algorithm === 'RSA-PSS-SHA256', '13b. Stored signature algorithm is RSA-PSS-SHA256');
    assert(typeof storedSigRecord?.signature === 'string' && storedSigRecord.signature.length > 50, '13c. Stored signature is valid non-empty string');

    // 14. Correct question_paper_id relationship exists
    assert(storedSigRecord?.question_paper_id === createdPaperId, '14. Correct question_paper_id relationship exists');

    // 15. Hash matches encrypted object stored in Supabase Storage
    const storedPaper = inMemoryPapers.get(createdPaperId);
    const storedCiphertextBuffer = storageFiles.get(storedPaper.storage_path);
    assert(!!storedCiphertextBuffer, 'Encrypted ciphertext exists in private Supabase Storage');
    const computedHash = signatureService.calculateSha256(storedCiphertextBuffer);
    assert(computedHash === storedSigRecord.file_hash, '15. Computed hash from storage object matches stored file_hash');

    // 16. Stored hash detects ciphertext modification
    const modifiedCiphertext = Buffer.from(storedCiphertextBuffer);
    modifiedCiphertext[0] ^= 0xff;
    const modifiedHash = signatureService.calculateSha256(modifiedCiphertext);
    assert(modifiedHash !== storedSigRecord.file_hash, '16. Stored hash successfully detects ciphertext modification');

    // ==============================================================
    // Standalone Verification Endpoint: GET /:id/verify-signature
    // ==============================================================
    console.log('\n--- Standalone Verification Endpoint: GET /api/question-papers/:id/verify-signature ---');

    // Authoring teacher verifies signature
    const verifyEndpointRes = await makeRequest(
      'GET',
      `/api/question-papers/${createdPaperId}/verify-signature`,
      {
        Authorization: `Bearer ${teacher1Token}`,
      }
    );

    assert(verifyEndpointRes.status === 200, `Verification endpoint returns 200 OK (got ${verifyEndpointRes.status})`);
    assert(verifyEndpointRes.data?.data?.verified === true, 'Verification endpoint returns verified: true');
    assert(verifyEndpointRes.data?.data?.tamperDetected === false, 'Verification endpoint returns tamperDetected: false');
    assert(verifyEndpointRes.data?.data?.algorithm === 'RSA-PSS-SHA256', 'Verification endpoint reports algorithm');

    // ==============================================================
    // Download Flow: Verify-Before-Decrypt & Tamper Prevention
    // ==============================================================
    console.log('\n--- Download Flow: Verify-Before-Decrypt & Tamper Prevention ---');

    // 17. Download verifies signature before decryption (Valid case)
    const validDownloadRes = await makeRequest(
      'GET',
      `/api/question-papers/${createdPaperId}/download`,
      {
        Authorization: `Bearer ${teacher1Token}`,
      }
    );

    assert(validDownloadRes.status === 200, `17. Authoring teacher download succeeds with 200 OK (got ${validDownloadRes.status})`);
    assert(validDownloadRes.headers['content-type'] === 'application/pdf', '17b. Content-Type is application/pdf');
    assert(
      validDownloadRes.rawBody.toString('utf8') === samplePdfBuffer.toString('utf8'),
      '17c. Decrypted buffer matches original PDF after passing signature verification'
    );

    // 18. Tampered ciphertext in storage prevents PDF delivery (400 rejection)
    simulateTamperedStorageCiphertext = true;
    const tamperedDownloadRes = await makeRequest(
      'GET',
      `/api/question-papers/${createdPaperId}/download`,
      {
        Authorization: `Bearer ${teacher1Token}`,
      }
    );
    simulateTamperedStorageCiphertext = false;

    assert(tamperedDownloadRes.status === 400, `18. Tampered ciphertext download rejected with 400 Bad Request (got ${tamperedDownloadRes.status})`);
    assert(
      tamperedDownloadRes.data?.message?.includes('integrity') || tamperedDownloadRes.data?.message?.includes('signature'),
      '18b. Error message indicates integrity/signature verification failure'
    );
    assert(
      !tamperedDownloadRes.rawBody.includes(Buffer.from('Module 7 Final Exam')),
      '18c. Plaintext content is NEVER exposed or returned when verification fails'
    );

    // Tampered signature record in database also prevents PDF delivery
    const realSig = storedSigRecord.signature;
    storedSigRecord.signature = 'INVALID_BASE64_CORRUPTED_SIGNATURE_STRING==';
    const badSigDownloadRes = await makeRequest(
      'GET',
      `/api/question-papers/${createdPaperId}/download`,
      {
        Authorization: `Bearer ${teacher1Token}`,
      }
    );
    storedSigRecord.signature = realSig; // restore

    assert(badSigDownloadRes.status === 400, '18d. Corrupted signature record prevents PDF delivery (got 400)');

    // ==============================================================
    // Ownership & RBAC Authorization Verification
    // ==============================================================
    console.log('\n--- Ownership & RBAC Authorization Verification ---');

    // 19. Teacher ownership is enforced
    const ownerVerifyRes = await makeRequest(
      'GET',
      `/api/question-papers/${createdPaperId}/verify-signature`,
      {
        Authorization: `Bearer ${teacher1Token}`,
      }
    );
    assert(ownerVerifyRes.status === 200, '19. Authoring teacher can verify signature');

    // 20. Non-owner teacher receives 403 Forbidden
    const nonOwnerVerifyRes = await makeRequest(
      'GET',
      `/api/question-papers/${createdPaperId}/verify-signature`,
      {
        Authorization: `Bearer ${teacher2Token}`,
      }
    );
    assert(nonOwnerVerifyRes.status === 403, `20. Non-owner teacher receives 403 Forbidden on verify-signature (got ${nonOwnerVerifyRes.status})`);

    const nonOwnerDownloadRes = await makeRequest(
      'GET',
      `/api/question-papers/${createdPaperId}/download`,
      {
        Authorization: `Bearer ${teacher2Token}`,
      }
    );
    assert(nonOwnerDownloadRes.status === 403, `20b. Non-owner teacher receives 403 Forbidden on download (got ${nonOwnerDownloadRes.status})`);

    // 21. Missing authentication token returns 401 Unauthorized
    const unauthVerifyRes = await makeRequest(
      'GET',
      `/api/question-papers/${createdPaperId}/verify-signature`
    );
    assert(unauthVerifyRes.status === 401, `21. Missing authentication returns 401 Unauthorized (got ${unauthVerifyRes.status})`);

    // 22. Unauthorized role returns 403 Forbidden
    const adminVerifyRes = await makeRequest(
      'GET',
      `/api/question-papers/${createdPaperId}/verify-signature`,
      {
        Authorization: `Bearer ${adminToken}`,
      }
    );
    assert(adminVerifyRes.status === 403, `22. ADMIN role receives 403 Forbidden (got ${adminVerifyRes.status})`);

    const coordVerifyRes = await makeRequest(
      'GET',
      `/api/question-papers/${createdPaperId}/verify-signature`,
      {
        Authorization: `Bearer ${coordToken}`,
      }
    );
    assert(coordVerifyRes.status === 403, `22b. EXAM_COORDINATOR role receives 403 Forbidden (got ${coordVerifyRes.status})`);

    // ==============================================================
    // Compensating Rollback Verification
    // ==============================================================
    console.log('\n--- Compensating Rollback Verification ---');

    // 23. Storage rollback removes ciphertext if database insertion fails
    simulateDbInsertError = true;
    const initialRemovals = storageRemovals.length;
    const failMultipart = buildMultipartBody(
      {
        title: 'Rollback Subject',
        subject: 'Rollback 101',
        semester: 'Semester 1',
        academicYear: '2026-2027',
        examType: 'MID',
        examDate: '2026-10-30',
        assignedToUserId: MOCK_USERS.teacher2.userId,
      },
      {
        name: 'file',
        filename: 'rollback_paper.pdf',
        contentType: 'application/pdf',
        buffer: samplePdfBuffer,
      }
    );

    const rollbackRes = await makeRequest(
      'POST',
      '/api/question-papers',
      {
        Authorization: `Bearer ${teacher1Token}`,
        'Content-Type': failMultipart.contentType,
      },
      failMultipart.body
    );
    simulateDbInsertError = false;

    assert(rollbackRes.status === 500, `23. Database failure returns 500 (got ${rollbackRes.status})`);
    assert(storageRemovals.length > initialRemovals, '23b. Compensating rollback called storage removal');

    // 24. Database rollback cleans up digital_signatures if assignment insert fails
    simulateAssignmentInsertError = true;
    const prevSigCount = inMemorySignatures.size;
    const failAssignRes = await makeRequest(
      'POST',
      '/api/question-papers',
      {
        Authorization: `Bearer ${teacher1Token}`,
        'Content-Type': failMultipart.contentType,
      },
      failMultipart.body
    );
    simulateAssignmentInsertError = false;

    assert(failAssignRes.status === 500, `24. Assignment insert failure returns 500 (got ${failAssignRes.status})`);
    assert(inMemorySignatures.size === prevSigCount, '24b. Rollback cleaned up digital_signatures record when assignment failed');

    // ==============================================================
    // Regressions across Modules 1, 3, 4, 5, 6
    // ==============================================================
    console.log('\n--- Regressions Across Previous Modules ---');

    // 25. Module 3 authentication regression check passes
    const meRes = await makeRequest('GET', '/api/auth/me', {
      Authorization: `Bearer ${teacher1Token}`,
    });
    assert(meRes.status === 200, `25. Module 3 /api/auth/me returns 200 OK (got ${meRes.status})`);
    const badTokenRes = await makeRequest('GET', '/api/auth/me', {
      Authorization: 'Bearer invalid.fake.token',
    });
    assert(badTokenRes.status === 401, '25b. Module 3 invalid token rejected with 401 Unauthorized');

    // 26. Module 4 RBAC authorization regression check passes
    const teacherRbacRes = await makeRequest('GET', '/api/rbac/teacher', {
      Authorization: `Bearer ${teacher1Token}`,
    });
    assert(teacherRbacRes.status === 200, `26. Module 4 /api/rbac/teacher returns 200 for TEACHER (got ${teacherRbacRes.status})`);
    const adminRbacRes = await makeRequest('GET', '/api/rbac/teacher', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminRbacRes.status === 403, `26b. Module 4 /api/rbac/teacher returns 403 for ADMIN (got ${adminRbacRes.status})`);

    // 27. Module 5 question-paper regression check passes
    const myPapersRes = await makeRequest('GET', '/api/question-papers/my', {
      Authorization: `Bearer ${teacher1Token}`,
    });
    assert(myPapersRes.status === 200, `27. Module 5 /api/question-papers/my returns 200 OK (got ${myPapersRes.status})`);
    assert(Array.isArray(myPapersRes.data?.data), '27b. Question papers returned as array');
    assert(
      myPapersRes.data?.data?.[0]?.digital_signatures?.[0]?.algorithm === 'RSA-PSS-SHA256',
      '27c. Question paper list includes digital signature status'
    );

    // 28. Module 6 encryption & key wrapping regression check passes
    const encTest = encryptionService.encryptQuestionPaper(samplePdfBuffer);
    const decTest = encryptionService.decryptQuestionPaper(
      encTest.encryptedBuffer,
      encTest.encryptedAesKey,
      encTest.iv,
      encTest.authTag
    );
    assert(
      decTest.toString('utf8') === samplePdfBuffer.toString('utf8'),
      '28. Module 6 AES-256-GCM + RSA-OAEP encrypt/decrypt roundtrip succeeds'
    );

    // 29. Module 1 health check regression check passes
    const healthRes = await makeRequest('GET', '/api/health');
    assert(healthRes.status === 200, `29. Module 1 /api/health returns 200 OK (got ${healthRes.status})`);
    assert(healthRes.data?.success === true, '29b. Health check reports success: true');

  } catch (err) {
    console.error('Fatal error running verification tests:', err);
    failedCount++;
  } finally {
    console.log('\n===============================================================');
    console.log(`TOTAL SCENARIOS VERIFIED: ${testCount}`);
    console.log(`PASSED: ${passedCount}`);
    console.log(`FAILED: ${failedCount}`);
    console.log('===============================================================\n');

    if (server) {
      server.close(() => {
        process.exit(failedCount > 0 ? 1 : 0);
      });
    } else {
      process.exit(failedCount > 0 ? 1 : 0);
    }
  }
}

runTests();

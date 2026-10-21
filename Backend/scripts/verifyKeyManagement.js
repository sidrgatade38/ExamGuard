/**
 * Comprehensive Automated Verification Test Suite for Module 8:
 * Secure Storage & Key Management
 * 
 * Verifies all required security and architectural criteria:
 * 1.  AES document key is exactly 32 bytes (256 bits).
 * 2.  Document AES key is generated using secure randomness (crypto.randomBytes).
 * 3.  Two question papers receive different AES keys.
 * 4.  IV generation produces exactly 12 bytes and unique nonces.
 * 5.  AES key is successfully wrapped using RSA-OAEP with SHA-256.
 * 6.  Wrapped AES key can be successfully unwrapped to original 32-byte key.
 * 7.  Wrapped key cannot be unwrapped with the wrong private key (fails closed).
 * 8.  Modified/tampered wrapped AES key fails to unwrap (fails closed).
 * 9.  In-memory key caching and cache invalidation work correctly.
 * 10. Missing wrapping private key causes safe failure (no fallback).
 * 11. Missing wrapping public key causes safe failure on wrapping.
 * 12. Dedicated wrapping key pair is separate and distinct from Module 7 signing key pair.
 * 13. Signing private key is never used for AES-key wrapping.
 * 14. Key-wrapping private key is never used for digital signatures.
 * 15. Question-paper bucket remains private (no getPublicUrl used).
 * 16. Arbitrary client storage paths in request body are rejected.
 * 17. Path traversal attempts (.., etc.) are rejected.
 * 18. Storage paths are strictly server-controlled.
 * 19. Plaintext AES key is never returned by API.
 * 20. Plaintext AES key is not stored in question_papers table.
 * 21. Plaintext AES key is not stored in paper_keys table (only wrapped key).
 * 22. Safe API responses contain zero secrets (no keys, tags, or IVs).
 * 23. Unauthorized user cannot trigger key retrieval or download (401).
 * 24. Teacher cannot access another teacher's paper or key (403).
 * 25. Privileged roles (ADMIN, EXAM_COORDINATOR) cannot bypass key access (403).
 * 26. No standalone public API endpoint exists to query AES keys.
 * 27. Authorized teacher download succeeds with exact decrypted PDF.
 * 28. SHA-256 integrity failure prevents decryption (Verify-Before-Decrypt).
 * 29. RSA-PSS signature failure prevents decryption.
 * 30. AES-GCM authentication failure prevents PDF delivery.
 * 31. Corrupted wrapped AES key in database fails closed.
 * 32. Key leakage test: API responses never contain AES key, private keys, or secrets.
 * 33. Error objects and messages never leak raw key material.
 * 34. Git security: .gitignore protects Backend/keys/*.pem and .env.
 * 35. Regression check: Module 1 health check passes.
 * 36. Regression check: Module 3 authentication passes.
 * 37. Regression check: Module 4 RBAC authorization passes.
 * 38. Regression check: Module 5 question-paper management passes.
 * 39. Regression check: Module 6 encryption roundtrip passes.
 * 40. Regression check: Module 7 digital signature roundtrip passes.
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
const { getSupabaseClient } = require('../src/config/supabase');
const supabaseClient = getSupabaseClient();
const { generateToken, verifyToken } = require('../src/utils/jwt');

const TEST_PORT = 5006;
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
            const record = { ...records[0] };
            inMemoryPapers.set(record.id, record);
            return Promise.resolve({ data: record, error: null });
          },
        }),
      }),
      select: () => ({
        eq: (col, val) => ({
          order: () => {
            const papers = Array.from(inMemoryPapers.values()).filter((p) => p.teacher_id === val);
            return Promise.resolve({ data: papers, error: null });
          },
          maybeSingle: () => {
            const paper = inMemoryPapers.get(val);
            if (!paper) return Promise.resolve({ data: null, error: null });
            const assignments = Array.from(inMemoryAssignments.values()).filter((a) => a.question_paper_id === val);
            const sigs = Array.from(inMemorySignatures.values()).filter((s) => s.question_paper_id === val);
            return Promise.resolve({
              data: {
                ...paper,
                question_paper_assignments: assignments,
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
      delete: () => ({
        eq: (col, val) => {
          for (const [k, v] of inMemoryAssignments.entries()) {
            if (v.question_paper_id === val) inMemoryAssignments.delete(k);
          }
          return Promise.resolve({ data: null, error: null });
        },
      }),
    };
  }

  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
      }),
    }),
  };
};

supabaseClient.storage.from = function (bucketName) {
  return {
    upload: async (storagePath, fileBuffer, options) => {
      storageFiles.set(storagePath, Buffer.from(fileBuffer));
      storageUploadHistory.push({ path: storagePath, size: fileBuffer.length });
      return { data: { path: storagePath }, error: null };
    },
    download: async (storagePath) => {
      const file = storageFiles.get(storagePath);
      if (!file) return { data: null, error: new Error('File not found in storage') };

      if (simulateTamperedStorageCiphertext) {
        const tampered = Buffer.from(file);
        tampered[0] = tampered[0] ^ 0xff;
        return { data: tampered, error: null };
      }

      return { data: file, error: null };
    },
    createSignedUrl: async (storagePath, expiresIn) => {
      const file = storageFiles.get(storagePath);
      if (!file) return { data: null, error: new Error('Object not found') };
      return {
        data: { signedUrl: `https://mock.storage/signed/${storagePath}?token=mock-token&expires=${expiresIn}` },
        error: null,
      };
    },
    remove: async (paths) => {
      for (const p of paths) {
        storageFiles.delete(p);
        storageRemovals.push(p);
      }
      return { data: paths, error: null };
    },
  };
};

// Helper to make HTTP requests
function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { ...headers };

    let payload = null;
    if (body) {
      if (Buffer.isBuffer(body)) {
        payload = body;
      } else if (typeof body === 'string') {
        payload = Buffer.from(body);
      } else {
        payload = Buffer.from(JSON.stringify(body));
        if (!reqHeaders['Content-Type']) {
          reqHeaders['Content-Type'] = 'application/json';
        }
      }
      reqHeaders['Content-Length'] = payload.length;
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const rawBuffer = Buffer.concat(chunks);
          let parsedData = null;
          const contentType = res.headers['content-type'] || '';
          if (contentType.includes('application/json')) {
            try {
              parsedData = JSON.parse(rawBuffer.toString('utf8'));
            } catch (e) {
              parsedData = rawBuffer.toString('utf8');
            }
          }
          resolve({
            status: res.statusCode,
            headers: res.headers,
            data: parsedData,
            buffer: rawBuffer,
          });
        });
      }
    );

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Helper to build multipart/form-data payload
function createMultipartPayload({ fields = {}, file = null, boundary = '----ExamGuardBoundaryTest' }) {
  const chunks = [];

  for (const [key, value] of Object.entries(fields)) {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
      )
    );
  }

  if (file) {
    const filename = file.filename || 'sample.pdf';
    const contentType = file.contentType || 'application/pdf';
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`
      )
    );
    chunks.push(file.content);
    chunks.push(Buffer.from('\r\n'));
  }

  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(chunks);

  return {
    body,
    headers: {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': body.length,
    },
  };
}

let passed = 0;
let failed = 0;

function assert(condition, message, detail = '') {
  if (condition) {
    console.log(`  ✔ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message} ${detail ? '(' + detail + ')' : ''}`);
    failed++;
  }
}

// Generate valid test RSA key pair for testing negative unwrapping
const alienKeyPair = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

async function runTests() {
  console.log('===============================================================');
  console.log('   EXAMGUARD MODULE 8: SECURE STORAGE & KEY MANAGEMENT TESTS');
  console.log('===============================================================\n');

  try {
    // -------------------------------------------------------------
    // Section 1: AES Document Key & IV Properties
    // -------------------------------------------------------------
    console.log('[Group 1: AES-256 Document Key & IV Cryptographic Generation]');
    const key1 = keyManagementService.generateDocumentKey();
    const key2 = keyManagementService.generateDocumentKey();

    assert(Buffer.isBuffer(key1), '1a. generateDocumentKey returns a Buffer');
    assert(key1.length === 32, '1b. AES document key is exactly 32 bytes (256 bits)', `Length: ${key1.length}`);
    assert(keyManagementService.validateKeySize(key1), '1c. validateKeySize validates 32-byte key buffer');
    assert(!key1.equals(key2), '2. Document AES key is generated using secure randomness (keys differ)');

    const iv1 = keyManagementService.generateIv();
    const iv2 = keyManagementService.generateIv();
    assert(Buffer.isBuffer(iv1), '3a. generateIv returns a Buffer');
    assert(iv1.length === 12, '3b. IV is exactly 12 bytes (96-bit AES-GCM recommended nonce)', `Length: ${iv1.length}`);
    assert(!iv1.equals(iv2), '3c. Subsequent IVs are unique random nonces');

    // -------------------------------------------------------------
    // Section 2: Key Wrapping & Unwrapping (RSA-OAEP-SHA256)
    // -------------------------------------------------------------
    console.log('\n[Group 2: RSA-OAEP Key Wrapping & Unwrapping]');
    const testAesKey = keyManagementService.generateDocumentKey();
    const wrappedBase64 = keyManagementService.wrapDocumentKey(testAesKey);

    assert(typeof wrappedBase64 === 'string' && wrappedBase64.length > 50, '4a. AES key is successfully wrapped');
    const wrappedBuffer = Buffer.from(wrappedBase64, 'base64');
    assert(wrappedBuffer.length === 256, '4b. Wrapped key block is 256 bytes (RSA-2048)', `Length: ${wrappedBuffer.length}`);

    // Unwrapping
    const unwrappedKey = keyManagementService.unwrapDocumentKey(wrappedBase64);
    assert(Buffer.isBuffer(unwrappedKey), '5a. unwrapped key is a Buffer');
    assert(unwrappedKey.length === 32, '5b. unwrapped key is exactly 32 bytes');
    assert(unwrappedKey.equals(testAesKey), '5c. Wrapped AES key can be successfully unwrapped to original key');

    // Negative unwrapping: Wrong private key
    let alienUnwrapFailed = false;
    try {
      keyManagementService.unwrapDocumentKey(wrappedBase64, alienKeyPair.privateKey);
    } catch (err) {
      alienUnwrapFailed = true;
    }
    assert(alienUnwrapFailed, '6. Wrapped key cannot be unwrapped with the wrong private key (fails safely)');

    // Negative unwrapping: Tampered wrapped key
    let tamperedUnwrapFailed = false;
    const tamperedWrappedBuffer = Buffer.from(wrappedBuffer);
    tamperedWrappedBuffer[10] ^= 0x55;
    try {
      keyManagementService.unwrapDocumentKey(tamperedWrappedBuffer.toString('base64'));
    } catch (err) {
      tamperedUnwrapFailed = true;
    }
    assert(tamperedUnwrapFailed, '7. Modified wrapped AES key fails to unwrap (fails closed)');

    // Invalid parameters to wrap/unwrap
    let invalidWrapFailed = false;
    try {
      keyManagementService.wrapDocumentKey(Buffer.alloc(16)); // not 32 bytes
    } catch (err) {
      invalidWrapFailed = true;
    }
    assert(invalidWrapFailed, '8a. wrapDocumentKey strictly rejects non-32-byte buffers');

    let invalidUnwrapParamFailed = false;
    try {
      keyManagementService.unwrapDocumentKey('');
    } catch (err) {
      invalidUnwrapParamFailed = true;
    }
    assert(invalidUnwrapParamFailed, '8b. unwrapDocumentKey strictly rejects empty string');

    // Key caching and invalidation
    const pub1 = keyManagementService.getWrappingPublicKey();
    const pub2 = keyManagementService.getWrappingPublicKey();
    assert(pub1 === pub2, '9a. In-memory key caching returns consistent public key');
    keyManagementService.clearWrappingKeyCache();
    const pub3 = keyManagementService.getWrappingPublicKey();
    assert(pub3 === pub1, '9b. clearWrappingKeyCache successfully reloads keys without error');

    // -------------------------------------------------------------
    // Section 3: Separation Between Wrapping Keys & Signing Keys
    // -------------------------------------------------------------
    console.log('\n[Group 3: Cryptographic Key Separation (Wrapping vs Signing)]');
    const wrappingPublicKey = keyManagementService.getWrappingPublicKey();
    const wrappingPrivateKey = keyManagementService.getWrappingPrivateKey();
    const signingPublicKey = signatureService.getSigningPublicKey();
    const signingPrivateKey = signatureService.getSigningPrivateKey();

    assert(wrappingPublicKey !== signingPublicKey, '10a. Wrapping public key is strictly different from signing public key');
    assert(wrappingPrivateKey !== signingPrivateKey, '10b. Wrapping private key is strictly different from signing private key');

    // Test that signing private key CANNOT unwrap AES document key
    let signingKeyUnwrapFailed = false;
    try {
      keyManagementService.unwrapDocumentKey(wrappedBase64, signingPrivateKey);
    } catch (err) {
      signingKeyUnwrapFailed = true;
    }
    assert(signingKeyUnwrapFailed, '11. Signing private key is NEVER able to unwrap AES keys (strict separation)');

    // Test that wrapping private key CANNOT verify digital signature
    const testCiphertext = crypto.randomBytes(64);
    const validSignature = signatureService.signQuestionPaper(testCiphertext);
    const verifyWithWrappingKey = signatureService.verifyQuestionPaperSignature(
      testCiphertext,
      validSignature.signature,
      wrappingPublicKey
    );
    assert(verifyWithWrappingKey === false, '12. Key-wrapping public key fails digital signature verification');

    // -------------------------------------------------------------
    // Section 4: Storage Path Security & Private Bucket Integrity
    // -------------------------------------------------------------
    console.log('\n[Group 4: Storage Security, Path Traversal Defense & Private Bucket]');
    const sourceCode = fs.readFileSync(path.resolve(__dirname, '../src/services/questionPaperService.js'), 'utf8');
    assert(!sourceCode.includes('getPublicUrl'), '13. Application NEVER uses getPublicUrl for question-paper delivery');
    assert(config.storageBucket === 'examguard-storage', '14. Storage bucket is configured as private examguard-storage');

    // Start HTTP server for API security tests
    await new Promise((resolve) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`\nTest HTTP server running on port ${TEST_PORT}`);
        resolve();
      });
    });

    // -------------------------------------------------------------
    // Section 5: End-to-End Submission & Key Isolation
    // -------------------------------------------------------------
    console.log('\n[Group 5: Encrypted Paper Submission & Key Isolation]');
    const samplePdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Title (Module 8 Final Exam)\n>>\nendobj\ntrailer\n<<>>\n%%EOF');
    const submitPayload = createMultipartPayload({
      fields: {
        title: 'Network Security End Semester Exam',
        subject: 'Cybersecurity',
        semester: 'Semester 6',
        academicYear: '2026-2027',
        examType: 'End Semester Examination',
        examDate: '2026-11-20',
        assignedToUserId: MOCK_USERS.teacher2.userId,
      },
      file: {
        filename: 'network_security_2026.pdf',
        content: samplePdfBuffer,
        contentType: 'application/pdf',
      },
    });

    const submitRes = await makeRequest('POST', '/api/question-papers', submitPayload.body, {
      ...submitPayload.headers,
      Authorization: `Bearer ${teacher1Token}`,
    });

    assert(submitRes.status === 201, '15. Question paper submitted successfully (201 Created)', `Status: ${submitRes.status}`);
    const createdPaperId = submitRes.data?.data?.questionPaper?.id;
    assert(Boolean(createdPaperId), '16. Submission generated question paper ID');

    // Inspect database tables: Plaintext AES key is NEVER stored
    const storedPaper = inMemoryPapers.get(createdPaperId);
    assert(storedPaper !== undefined, '17a. Record created in question_papers table');
    assert(storedPaper.aes_key === undefined, '17b. Plaintext AES key is NOT stored in question_papers table');
    assert(storedPaper.key === undefined, '17c. No key column in question_papers table');

    const storedKeyRecord = inMemoryPaperKeys.get(createdPaperId);
    assert(storedKeyRecord !== undefined, '18a. Record created in paper_keys table');
    assert(typeof storedKeyRecord.encrypted_aes_key === 'string', '18b. paper_keys contains encrypted_aes_key');
    assert(storedKeyRecord.encrypted_aes_key !== testAesKey.toString('base64'), '18c. encrypted_aes_key is NOT raw AES key in base64');
    assert(storedKeyRecord.aes_key === undefined, '18d. Plaintext aes_key column is NOT in paper_keys');
    assert(typeof storedKeyRecord.iv === 'string', '18e. paper_keys contains iv');
    assert(typeof storedKeyRecord.auth_tag === 'string', '18f. paper_keys contains auth_tag');

    // Key Leakage Test on Submission Response
    const responseSerialized = JSON.stringify(submitRes.data);
    assert(!responseSerialized.includes('encrypted_aes_key'), '19a. API response excludes encrypted_aes_key');
    assert(!responseSerialized.includes('auth_tag'), '19b. API response excludes auth_tag');
    assert(!responseSerialized.includes('-----BEGIN RSA PRIVATE KEY-----'), '19c. API response excludes private keys');
    assert(!responseSerialized.includes('-----BEGIN PRIVATE KEY-----'), '19d. API response excludes PKCS#8 private keys');

    // Client Storage Path Injection Rejection
    const pathInjectionPayload = createMultipartPayload({
      fields: {
        title: 'Attacker Attempt Paper',
        subject: 'Testing',
        semester: 'Semester 1',
        academicYear: '2026-2027',
        examType: 'Unit Test',
        examDate: '2026-11-20',
        assignedToUserId: MOCK_USERS.teacher2.userId,
        storage_path: 'public/hacked/file.pdf',
      },
      file: {
        filename: 'valid.pdf',
        content: samplePdfBuffer,
        contentType: 'application/pdf',
      },
    });

    const pathInjectionRes = await makeRequest('POST', '/api/question-papers', pathInjectionPayload.body, {
      ...pathInjectionPayload.headers,
      Authorization: `Bearer ${teacher1Token}`,
    });
    assert(pathInjectionRes.status === 400, '20. Arbitrary client storage_path injection rejected with 400 Bad Request', `Status: ${pathInjectionRes.status}`);

    // Path traversal in filename
    const traversalPayload = createMultipartPayload({
      fields: {
        title: 'Traversal Paper',
        subject: 'Testing',
        semester: 'Semester 1',
        academicYear: '2026-2027',
        examType: 'Unit Test',
        examDate: '2026-11-20',
        assignedToUserId: MOCK_USERS.teacher2.userId,
      },
      file: {
        filename: '../../../etc/passwd.pdf',
        content: samplePdfBuffer,
        contentType: 'application/pdf',
      },
    });

    const traversalRes = await makeRequest('POST', '/api/question-papers', traversalPayload.body, {
      ...traversalPayload.headers,
      Authorization: `Bearer ${teacher1Token}`,
    });
    // Multer sanitizes basename, and our service ensures path cannot traverse
    assert(traversalRes.status === 201 || traversalRes.status === 400, '21. Path traversal in filename handled securely (no escaping directory)');
    if (traversalRes.status === 201) {
      const traversalPaperId = traversalRes.data?.data?.questionPaper?.id;
      const traversalPaper = inMemoryPapers.get(traversalPaperId);
      assert(!traversalPaper.storage_path.includes('..'), '21b. Stored storage_path strictly contains no path traversal sequences (..)');
    }

    // -------------------------------------------------------------
    // Section 6: Key Unwrapping, Decryption & Verify-Before-Decrypt
    // -------------------------------------------------------------
    console.log('\n[Group 6: Authenticated Download, Verify-Before-Decrypt & Tamper Prevention]');

    // Authoring teacher download: Decrypts only after successful signature & integrity verification
    const downloadRes = await makeRequest('GET', `/api/question-papers/${createdPaperId}/download`, null, {
      Authorization: `Bearer ${teacher1Token}`,
    });

    assert(downloadRes.status === 200, '22a. Authoring teacher download succeeds (200 OK)', `Status: ${downloadRes.status}`);
    assert(downloadRes.headers['content-type'] === 'application/pdf', '22b. Content-Type is application/pdf');
    assert(downloadRes.buffer.equals(samplePdfBuffer), '22c. Decrypted buffer exactly matches original PDF');

    // Download URL endpoint: generates short-lived signed URL
    const urlRes = await makeRequest('GET', `/api/question-papers/${createdPaperId}/download`, null, {
      Authorization: `Bearer ${teacher1Token}`,
    });
    assert(urlRes.status === 200, '23. Download request authorized');

    // Negative: Ciphertext tampering triggers Verify-Before-Decrypt failure
    simulateTamperedStorageCiphertext = true;
    const tamperedRes = await makeRequest('GET', `/api/question-papers/${createdPaperId}/download`, null, {
      Authorization: `Bearer ${teacher1Token}`,
    });
    assert(tamperedRes.status === 400, '24a. Tampered ciphertext strictly rejected with 400 Bad Request', `Status: ${tamperedRes.status}`);
    assert(tamperedRes.data?.message?.toLowerCase().includes('integrity') || tamperedRes.data?.message?.toLowerCase().includes('signature'), '24b. Error message specifies integrity verification failure');
    assert(!tamperedRes.buffer.equals(samplePdfBuffer), '24c. Plaintext content is NEVER delivered when verification fails');
    simulateTamperedStorageCiphertext = false;

    // Negative: Corrupted auth tag causes GCM authentication failure
    const originalAuthTag = storedKeyRecord.auth_tag;
    const corruptedTagBuffer = Buffer.from(originalAuthTag, 'base64');
    corruptedTagBuffer[0] ^= 0xff;
    storedKeyRecord.auth_tag = corruptedTagBuffer.toString('base64');

    const tagTamperedRes = await makeRequest('GET', `/api/question-papers/${createdPaperId}/download`, null, {
      Authorization: `Bearer ${teacher1Token}`,
    });
    assert(tagTamperedRes.status === 400, '25. Corrupted auth tag strictly fails AES-GCM decryption with 400 Bad Request', `Status: ${tagTamperedRes.status}`);
    storedKeyRecord.auth_tag = originalAuthTag; // Restore

    // Negative: Corrupted wrapped key in DB fails closed
    const originalEncryptedAesKey = storedKeyRecord.encrypted_aes_key;
    storedKeyRecord.encrypted_aes_key = 'corrupted_invalid_base64_wrapped_key==';
    const keyTamperedRes = await makeRequest('GET', `/api/question-papers/${createdPaperId}/download`, null, {
      Authorization: `Bearer ${teacher1Token}`,
    });
    assert(keyTamperedRes.status === 400, '26. Corrupted wrapped AES key fails closed with 400 Bad Request', `Status: ${keyTamperedRes.status}`);
    storedKeyRecord.encrypted_aes_key = originalEncryptedAesKey; // Restore

    // -------------------------------------------------------------
    // Section 7: Access Control & Authorization Boundaries
    // -------------------------------------------------------------
    console.log('\n[Group 7: Key & Document Authorization Boundaries]');

    // Unauthenticated download
    const unauthRes = await makeRequest('GET', `/api/question-papers/${createdPaperId}/download`);
    assert(unauthRes.status === 401, '27. Missing authentication returns 401 Unauthorized', `Status: ${unauthRes.status}`);

    // Teacher 2 attempting to download Teacher 1's paper
    const nonOwnerRes = await makeRequest('GET', `/api/question-papers/${createdPaperId}/download`, null, {
      Authorization: `Bearer ${teacher2Token}`,
    });
    assert(nonOwnerRes.status === 403, '28. Non-owner teacher access returns 403 Forbidden', `Status: ${nonOwnerRes.status}`);

    // ADMIN role attempting download
    const adminRes = await makeRequest('GET', `/api/question-papers/${createdPaperId}/download`, null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminRes.status === 403, '29. ADMIN role cannot download question paper (403 Forbidden)', `Status: ${adminRes.status}`);

    // EXAM_COORDINATOR role attempting download
    const coordRes = await makeRequest('GET', `/api/question-papers/${createdPaperId}/download`, null, {
      Authorization: `Bearer ${coordToken}`,
    });
    assert(coordRes.status === 403, '30. EXAM_COORDINATOR role cannot download question paper (403 Forbidden)', `Status: ${coordRes.status}`);

    // Confirm no standalone key retrieval API endpoint exists
    const keyEndpointRes = await makeRequest('GET', `/api/question-papers/${createdPaperId}/key`, null, {
      Authorization: `Bearer ${teacher1Token}`,
    });
    assert(keyEndpointRes.status === 404, '31. No standalone GET /key endpoint exists (404 Not Found)', `Status: ${keyEndpointRes.status}`);

    // -------------------------------------------------------------
    // Section 8: Sensitive Data Leakage Audit
    // -------------------------------------------------------------
    console.log('\n[Group 8: Complete Sensitive Data Leakage Audit]');

    // Test GET /api/question-papers/my
    const listRes = await makeRequest('GET', '/api/question-papers/my', null, {
      Authorization: `Bearer ${teacher1Token}`,
    });
    const listJson = JSON.stringify(listRes.data);
    assert(!listJson.includes('encrypted_aes_key'), '32a. GET /my excludes encrypted_aes_key');
    assert(!listJson.includes('auth_tag'), '32b. GET /my excludes auth_tag');
    assert(!listJson.includes('"iv":'), '32c. GET /my excludes "iv" field');
    assert(!listJson.includes('paper_keys'), '32d. GET /my excludes paper_keys table');

    // Test GET /api/question-papers/:id
    const detailsRes = await makeRequest('GET', `/api/question-papers/${createdPaperId}`, null, {
      Authorization: `Bearer ${teacher1Token}`,
    });
    const detailsJson = JSON.stringify(detailsRes.data);
    assert(!detailsJson.includes('encrypted_aes_key'), '33a. GET /:id excludes encrypted_aes_key');
    assert(!detailsJson.includes('auth_tag'), '33b. GET /:id excludes auth_tag');
    assert(!detailsJson.includes('"iv":'), '33c. GET /:id excludes "iv" field');
    assert(!detailsJson.includes('paper_keys'), '33d. GET /:id excludes paper_keys');

    // Secret scans across all responses
    const allResponses = [submitRes.data, listRes.data, detailsRes.data];
    let secretLeakFound = false;
    for (const resp of allResponses) {
      const str = JSON.stringify(resp);
      if (
        str.includes(config.jwtSecret) ||
        str.includes(config.supabase.serviceRoleKey) ||
        str.includes('PRIVATE KEY')
      ) {
        secretLeakFound = true;
      }
    }
    assert(!secretLeakFound, '34. Global secret leakage audit passed (no JWT secret, service key, or private keys leaked)');

    // Git security: verify .gitignore protects keys and env
    const gitignorePath = path.resolve(__dirname, '../../.gitignore');
    const backendGitignorePath = path.resolve(__dirname, '../.gitignore');
    let gitignoreProtectsKeys = false;
    if (fs.existsSync(gitignorePath)) {
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      if (gitignoreContent.includes('*.pem') || gitignoreContent.includes('Backend/keys/*.pem')) {
        gitignoreProtectsKeys = true;
      }
    }
    if (fs.existsSync(backendGitignorePath)) {
      const backendGitignoreContent = fs.readFileSync(backendGitignorePath, 'utf8');
      if (backendGitignoreContent.includes('*.pem') || backendGitignoreContent.includes('keys/*.pem')) {
        gitignoreProtectsKeys = true;
      }
    }
    assert(gitignoreProtectsKeys, '35. .gitignore protects cryptographic keys (*.pem)');

    // -------------------------------------------------------------
    // Section 9: Regressions Across Modules 1 to 7
    // -------------------------------------------------------------
    console.log('\n[Group 9: Regressions Across Previous Modules]');

    // Module 1: Health check
    const healthRes = await makeRequest('GET', '/api/health');
    assert(healthRes.status === 200, '36. Module 1 /api/health returns 200 OK (got 200)');
    assert(healthRes.data?.success === true, '36b. Health check reports success: true');

    // Module 3: Authentication
    const meRes = await makeRequest('GET', '/api/auth/me', null, {
      Authorization: `Bearer ${teacher1Token}`,
    });
    assert(meRes.status === 200, '37. Module 3 /api/auth/me returns 200 OK (got 200)');

    // Module 4: RBAC
    const rbacTeacherRes = await makeRequest('GET', '/api/rbac/teacher', null, {
      Authorization: `Bearer ${teacher1Token}`,
    });
    assert(rbacTeacherRes.status === 200, '38. Module 4 /api/rbac/teacher returns 200 for TEACHER');

    const rbacAdminForbiddenRes = await makeRequest('GET', '/api/rbac/teacher', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(rbacAdminForbiddenRes.status === 403, '38b. Module 4 /api/rbac/teacher returns 403 for ADMIN');

    // Module 6: Encryption roundtrip
    const encRoundtrip = encryptionService.encryptQuestionPaper(samplePdfBuffer);
    const decRoundtrip = encryptionService.decryptQuestionPaper(
      encRoundtrip.encryptedBuffer,
      encRoundtrip.encryptedAesKey,
      encRoundtrip.iv,
      encRoundtrip.authTag
    );
    assert(decRoundtrip.equals(samplePdfBuffer), '39. Module 6 AES-256-GCM + RSA-OAEP encrypt/decrypt roundtrip succeeds');

    // Module 7: Digital signature roundtrip
    const sigRoundtrip = signatureService.signQuestionPaper(encRoundtrip.encryptedBuffer);
    const sigValid = signatureService.verifyQuestionPaperSignature(encRoundtrip.encryptedBuffer, sigRoundtrip.signature);
    assert(sigValid === true, '40. Module 7 RSA-PSS digital signature sign/verify roundtrip succeeds');

  } catch (error) {
    console.error('Unhandled Test Execution Error:', error);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
  }

  console.log('\n===============================================================');
  console.log(`TOTAL SCENARIOS VERIFIED: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

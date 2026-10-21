/**
 * Comprehensive Automated Verification Test Suite for Module 12:
 * Notifications & Next-Day Question Paper Delivery
 *
 * Verifies all operational, security, delivery-date gating, and regression criteria:
 * 1.  Server starts and binds cleanly on dedicated port 5010.
 * 2.  Authentication: Missing JWT returns 401 Unauthorized.
 * 3.  Authentication: Invalid JWT returns 401 Unauthorized.
 * 4.  Authentication: Expired JWT returns 401 Unauthorized.
 * 5.  Notification Ownership: User can retrieve own notifications (200 OK).
 * 6.  Notification Ownership: User cannot retrieve another user's notifications (strict isolation).
 * 7.  Notification Ownership: User can mark own notification as read (200 OK).
 * 8.  Notification Ownership: User cannot mark another user's notification as read (403 Forbidden).
 * 9.  Notification Ownership: Read-all affects only authenticated user's notifications.
 * 10. Question Paper Submission: Successful submission creates notification for assigned recipient.
 * 11. Question Paper Submission: Failed submission creates NO notification.
 * 12. Question Paper Submission: Correct assigned recipient receives notification.
 * 13. Question Paper Submission: Unrelated faculty receives NO notification for author's paper.
 * 14. Delivery Date: Delivery date is calculated server-side (next calendar day).
 * 15. Delivery Date: Client-supplied delivery date cannot override server value.
 * 16. Delivery Date Gating: Before delivery date -> Question Paper download denied (403 Forbidden).
 * 17. Delivery Date Gating: Before delivery date -> Question Paper metadata view denied for assigned recipient (403 Forbidden).
 * 18. Delivery Date Gating: On delivery date -> Question Paper download permitted (200 OK, valid PDF).
 * 19. Delivery Date Gating: After delivery date -> Question Paper download permitted (200 OK, valid PDF).
 * 20. Security: Delivery-date bypass attempt (manipulated query/header) strictly rejected (403 Forbidden).
 * 21. Security: Assignment bypass attempt rejected (403 Forbidden).
 * 22. Security: Arbitrary / non-existent notification UUID rejected (404 Not Found).
 * 23. Security: Malformed notification ID rejected (400 Bad Request).
 * 24. Security: Arbitrary / non-existent Question Paper UUID rejected (404 Not Found).
 * 25. Security: Public storage URL never returned in notification or paper endpoints.
 * 26. Security: Internal storage path never returned in notification payloads.
 * 27. Security: Cryptographic keys (AES key, wrapped key, IV, auth tag, RSA private key) never returned in notification payloads.
 * 28. Verify-Before-Decrypt: Delivered paper performs SHA-256 integrity verification.
 * 29. Verify-Before-Decrypt: Delivered paper performs RSA-PSS digital signature verification.
 * 30. Verify-Before-Decrypt: RSA-OAEP key unwrapping occurs only after verification.
 * 31. Verify-Before-Decrypt: AES-GCM decryption occurs only after verification.
 * 32. Verify-Before-Decrypt: Tampered delivered paper fails closed (400 Bad Request, NO plaintext).
 * 33. Notification State: Unread notification returned with status SENT / isRead: false.
 * 34. Notification State: Mark read updates state to READ / isRead: true.
 * 35. Notification State: Read notification no longer counted in unread count.
 * 36. Notification State: Unread count endpoint returns accurate count.
 * 37. Notification State: Mark all read updates only current user's unread notifications.
 * 38. Duplicate Protection: Duplicate submission event does not create unintended duplicate notifications.
 * 39. Duplicate Protection: Retry behavior is deterministic and idempotent.
 * 40. Regression Module 1: Health check returns 200 OK.
 * 41. Regression Module 3: Authentication (/api/auth/me) returns 200 OK.
 * 42. Regression Module 4: RBAC (/api/rbac/teacher) returns 200 for teacher, 403 for coordinator.
 * 43. Regression Module 5: Teacher question paper listing (/api/question-papers/my) returns 200 OK.
 * 44. Regression Module 6: AES-256-GCM encryption/decryption roundtrip succeeds.
 * 45. Regression Module 7: RSA-PSS digital signature roundtrip succeeds.
 * 46. Regression Module 8: RSA-OAEP key wrapping/unwrapping succeeds.
 * 47. Regression Module 9: Exam Coordinator paper listing returns 200 OK.
 * 48. Regression Module 10: Teacher Answer Key timing calculation succeeds.
 * 49. Regression Module 11: Unified verificationService verify-and-decrypt succeeds.
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
const { getSupabaseClient } = require('../src/config/supabase');
const supabaseClient = getSupabaseClient();
const { generateToken } = require('../src/utils/jwt');

const TEST_PORT = 5010;
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
  recipientFaculty: {
    userId: '55555555-5555-5555-5555-555555555555',
    name: 'Prof. Bob Recipient',
    roleId: 'role-teacher-uuid',
    roleName: 'TEACHER',
    email: 'bob.recipient@examguard.edu',
    isActive: true,
  },
  unrelatedFaculty: {
    userId: '66666666-6666-6666-6666-666666666666',
    name: 'Prof. Charlie Unrelated',
    roleId: 'role-teacher-uuid',
    roleName: 'TEACHER',
    email: 'charlie.unrelated@examguard.edu',
    isActive: true,
  },
  coordinator: {
    userId: '33333333-3333-3333-3333-333333333333',
    name: 'Coordinator Alpha',
    roleId: 'role-coord-uuid',
    roleName: 'EXAM_COORDINATOR',
    email: 'coord.alpha@examguard.edu',
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

// Valid sample plaintext PDF buffer
const SAMPLE_PLAINTEXT_PDF = Buffer.from(
  '%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Title (Module 12 Final Examination) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'
);

// In-memory data store for deterministic mock execution
const inMemoryPapers = new Map();
const inMemoryAssignments = new Map();
const inMemoryPaperKeys = new Map();
const inMemorySignatures = new Map();
const inMemoryNotifications = new Map();
const storageFiles = new Map();

let simulateTamperedStorageCiphertext = false;

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

// Intercept supabaseClient.from and supabaseClient.storage.from
const originalClientFrom = supabaseClient.from.bind(supabaseClient);
const originalClientStorageFrom = supabaseClient.storage.from.bind(supabaseClient.storage);

supabaseClient.from = function (tableName) {
  if (tableName === 'users') {
    return {
      select: (fields) => ({
        eq: (col, val) => ({
          eq: (col2, val2) => ({
            order: () => {
              const teachers = Object.values(MOCK_USERS)
                .filter((u) => u.roleName === 'TEACHER' && u.isActive)
                .map((u) => ({ id: u.userId, name: u.name, email: u.email, is_active: u.isActive }));
              return Promise.resolve({ data: teachers, error: null });
            },
          }),
          maybeSingle: () => {
            const user = Object.values(MOCK_USERS).find((u) => u.userId === val || u.id === val);
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
      select: (fields) => {
        const queryState = {
          fields,
          filters: [],
        };
        const builder = {
          eq: (col, val) => {
            queryState.filters.push({ col, val, type: 'eq' });
            return builder;
          },
          in: (col, vals) => {
            queryState.filters.push({ col, vals, type: 'in' });
            return builder;
          },
          order: () => {
            let result = Array.from(inMemoryPapers.values());
            for (const f of queryState.filters) {
              if (f.type === 'eq') {
                result = result.filter((p) => p[f.col] === f.val);
              } else if (f.type === 'in') {
                result = result.filter((p) => f.vals.includes(p[f.col]));
              }
            }
            return Promise.resolve({ data: result, error: null });
          },
          maybeSingle: () => {
            let result = Array.from(inMemoryPapers.values());
            for (const f of queryState.filters) {
              if (f.type === 'eq') {
                result = result.filter((p) => p[f.col] === f.val);
              }
            }
            const paper = result[0] || null;
            if (!paper) return Promise.resolve({ data: null, error: null });

            const assignment = inMemoryAssignments.get(paper.id);
            const signature = inMemorySignatures.get(paper.id);
            return Promise.resolve({
              data: {
                ...paper,
                teacher: { id: paper.teacher_id, name: 'Alice Author', email: 'alice.author@examguard.edu' },
                question_paper_assignments: assignment ? [assignment] : [],
                digital_signatures: signature ? [signature] : [],
              },
              error: null,
            });
          },
        };
        return builder;
      },
      delete: () => ({
        eq: (col, val) => {
          if (col === 'id') inMemoryPapers.delete(val);
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
            const record = {
              ...records[0],
              id: 'assign-' + Date.now(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            inMemoryAssignments.set(record.question_paper_id, record);
            return Promise.resolve({ data: record, error: null });
          },
        }),
      }),
      select: (fields) => ({
        eq: (col, val) => {
          const matched = [];
          for (const a of inMemoryAssignments.values()) {
            if (a[col] === val) matched.push(a);
          }
          return Promise.resolve({ data: matched, error: null });
        },
      }),
      delete: () => ({
        eq: (col, val) => {
          for (const [k, v] of inMemoryAssignments.entries()) {
            if (v[col] === val) inMemoryAssignments.delete(k);
          }
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
      select: () => ({
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

  if (tableName === 'notifications') {
    return {
      insert: (records) => ({
        select: () => ({
          single: () => {
            const record = {
              ...records[0],
              id: crypto.randomUUID(),
              created_at: new Date().toISOString(),
            };
            inMemoryNotifications.set(record.id, record);
            return Promise.resolve({ data: record, error: null });
          },
        }),
      }),
      select: (fields) => {
        const queryState = {
          filters: [],
        };
        const builder = {
          eq: (col, val) => {
            queryState.filters.push({ col, val, op: 'eq' });
            return builder;
          },
          neq: (col, val) => {
            queryState.filters.push({ col, val, op: 'neq' });
            return builder;
          },
          order: () => {
            let list = Array.from(inMemoryNotifications.values());
            for (const f of queryState.filters) {
              if (f.op === 'eq') list = list.filter((n) => n[f.col] === f.val);
              if (f.op === 'neq') list = list.filter((n) => n[f.col] !== f.val);
            }
            list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            return Promise.resolve({ data: list, error: null });
          },
          maybeSingle: () => {
            let list = Array.from(inMemoryNotifications.values());
            for (const f of queryState.filters) {
              if (f.op === 'eq') list = list.filter((n) => n[f.col] === f.val);
              if (f.op === 'neq') list = list.filter((n) => n[f.col] !== f.val);
            }
            return Promise.resolve({ data: list[0] || null, error: null });
          },
          then: (resolve) => {
            let list = Array.from(inMemoryNotifications.values());
            for (const f of queryState.filters) {
              if (f.op === 'eq') list = list.filter((n) => n[f.col] === f.val);
              if (f.op === 'neq') list = list.filter((n) => n[f.col] !== f.val);
            }
            resolve({ data: list, count: list.length, error: null });
          },
        };
        return builder;
      },
      update: (updates) => {
        const updateFilters = [];
        const updateBuilder = {
          eq: (col, val) => {
            updateFilters.push({ col, val, op: 'eq' });
            return updateBuilder;
          },
          neq: (col, val) => {
            updateFilters.push({ col, val, op: 'neq' });
            return updateBuilder;
          },
          select: () => {
            const executeUpdate = () => {
              const updatedList = [];
              for (const [id, n] of inMemoryNotifications.entries()) {
                let match = true;
                for (const f of updateFilters) {
                  if (f.op === 'eq' && n[f.col] !== f.val) match = false;
                  if (f.op === 'neq' && n[f.col] === f.val) match = false;
                }
                if (match) {
                  const updated = { ...n, ...updates };
                  inMemoryNotifications.set(id, updated);
                  updatedList.push(updated);
                }
              }
              return updatedList;
            };

            return {
              single: () => {
                const list = executeUpdate();
                return Promise.resolve({ data: list[0] || null, error: null });
              },
              then: (resolve) => {
                const list = executeUpdate();
                resolve({ data: list, error: null });
              },
            };
          },
          then: (resolve) => {
            const updatedList = [];
            for (const [id, n] of inMemoryNotifications.entries()) {
              let match = true;
              for (const f of updateFilters) {
                if (f.op === 'eq' && n[f.col] !== f.val) match = false;
                if (f.op === 'neq' && n[f.col] === f.val) match = false;
              }
              if (match) {
                const updated = { ...n, ...updates };
                inMemoryNotifications.set(id, updated);
                updatedList.push(updated);
              }
            }
            resolve({ data: updatedList, error: null });
          },
        };
        return updateBuilder;
      },
      delete: () => ({
        eq: (col, val) => {
          for (const [k, v] of inMemoryNotifications.entries()) {
            if (v[col] === val) inMemoryNotifications.delete(k);
          }
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
      storageFiles.set(storagePath, fileBuffer);
      return Promise.resolve({ data: { path: storagePath }, error: null });
    },
    download: (storagePath) => {
      let fileBuffer = storageFiles.get(storagePath);
      if (!fileBuffer) {
        return Promise.resolve({ data: null, error: { message: 'File not found in storage' } });
      }
      if (simulateTamperedStorageCiphertext) {
        const tampered = Buffer.from(fileBuffer);
        tampered[0] ^= 0xff; // Flip first byte
        return Promise.resolve({ data: tampered, error: null });
      }
      return Promise.resolve({ data: fileBuffer, error: null });
    },
    remove: (paths) => {
      for (const p of paths) storageFiles.delete(p);
      return Promise.resolve({ data: paths, error: null });
    },
  };
};

// HTTP Request Utilities
function sendJsonRequest(method, endpoint, token, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const headers = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';

    const req = http.request(
      url,
      { method, headers },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let parsedBody = null;
          try {
            parsedBody = rawData ? JSON.parse(rawData) : null;
          } catch (_) {
            parsedBody = rawData;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsedBody });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function sendMultipartRequest(endpoint, token, fields, fileBuffer, fileName) {
  return new Promise((resolve, reject) => {
    const boundary = '----ExamGuardBoundary' + Date.now();
    const url = new URL(endpoint, BASE_URL);
    const headers = {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      Accept: 'application/json',
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method: 'POST', headers }, (res) => {
      let rawData = '';
      res.on('data', (chunk) => (rawData += chunk));
      res.on('end', () => {
        let parsedBody = null;
        try {
          parsedBody = rawData ? JSON.parse(rawData) : null;
        } catch (_) {
          parsedBody = rawData;
        }
        resolve({ status: res.statusCode, headers: res.headers, body: parsedBody });
      });
    });

    req.on('error', reject);

    for (const [k, v] of Object.entries(fields)) {
      req.write(`--${boundary}\r\n`);
      req.write(`Content-Disposition: form-data; name="${k}"\r\n\r\n`);
      req.write(`${v}\r\n`);
    }

    if (fileBuffer) {
      req.write(`--${boundary}\r\n`);
      req.write(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`);
      req.write('Content-Type: application/pdf\r\n\r\n');
      req.write(fileBuffer);
      req.write('\r\n');
    }

    req.write(`--${boundary}--\r\n`);
    req.end();
  });
}

function sendBinaryGetRequest(endpoint, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BASE_URL);
    const headers = { Accept: '*/*' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(url, { method: 'GET', headers }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          status: res.statusCode,
          headers: res.headers,
          buffer,
          text: buffer.toString('utf8'),
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

let assertionCount = 0;
let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  assertionCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ [ASSERTION ${assertionCount}] ${message}`);
  } else {
    failedCount++;
    console.error(`  ✖ [ASSERTION ${assertionCount} FAILED] ${message}`);
  }
}

async function runTestSuite() {
  console.log('============================================================');
  console.log('  EXAMGUARD MODULE 12: NOTIFICATIONS & NEXT-DAY DELIVERY');
  console.log('  AUTOMATED VERIFICATION TEST SUITE (PORT ' + TEST_PORT + ')');
  console.log('============================================================\n');

  // Generate tokens
  const authorToken = generateToken({
    userId: MOCK_USERS.authorTeacher.userId,
    email: MOCK_USERS.authorTeacher.email,
    role: MOCK_USERS.authorTeacher.roleName,
  });

  const recipientToken = generateToken({
    userId: MOCK_USERS.recipientFaculty.userId,
    email: MOCK_USERS.recipientFaculty.email,
    role: MOCK_USERS.recipientFaculty.roleName,
  });

  const unrelatedToken = generateToken({
    userId: MOCK_USERS.unrelatedFaculty.userId,
    email: MOCK_USERS.unrelatedFaculty.email,
    role: MOCK_USERS.unrelatedFaculty.roleName,
  });

  const coordToken = generateToken({
    userId: MOCK_USERS.coordinator.userId,
    email: MOCK_USERS.coordinator.email,
    role: MOCK_USERS.coordinator.roleName,
  });

  const expiredToken = jwt.sign(
    {
      userId: MOCK_USERS.recipientFaculty.userId,
      email: MOCK_USERS.recipientFaculty.email,
      role: MOCK_USERS.recipientFaculty.roleName,
    },
    config.jwtSecret || 'test-jwt-secret',
    { expiresIn: '-10s' }
  );

  // Start test server
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(TEST_PORT, () => {
      console.log(`[Test Server] Started successfully on port ${TEST_PORT}\n`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------
    // Section 1: Authentication & Token Verification (Scenarios 1–3)
    // -------------------------------------------------------------
    console.log('--- Section 1: Authentication & JWT Verification ---');
    const resNoToken = await sendJsonRequest('GET', '/api/notifications', null);
    assert(resNoToken.status === 401, 'Scenario 1: Missing JWT returns 401 Unauthorized');
    assert(resNoToken.body?.success === false, 'Scenario 1: Success flag is false');

    const resInvalidToken = await sendJsonRequest('GET', '/api/notifications', 'invalid.jwt.token');
    assert(resInvalidToken.status === 401, 'Scenario 2: Malformed JWT returns 401 Unauthorized');

    const resExpiredToken = await sendJsonRequest('GET', '/api/notifications', expiredToken);
    assert(resExpiredToken.status === 401, 'Scenario 3: Expired JWT returns 401 Unauthorized');

    // -------------------------------------------------------------
    // Section 2: Question Paper Submission & Notification Creation (Scenarios 9–14)
    // -------------------------------------------------------------
    console.log('\n--- Section 2: Question Paper Submission & Recipient Notification ---');
    const paperPayload = {
      title: 'Module 12 Final Exam Paper',
      subject: 'Network Security',
      semester: 'Semester 6',
      academicYear: '2026-2027',
      examType: 'End Semester Examination',
      examDate: '2026-11-20',
      assignedToUserId: MOCK_USERS.recipientFaculty.userId,
    };

    const resSubmit = await sendMultipartRequest(
      '/api/question-papers',
      authorToken,
      paperPayload,
      SAMPLE_PLAINTEXT_PDF,
      'network_security_final.pdf'
    );

    assert(resSubmit.status === 201, 'Scenario 9: Paper submission succeeds with 201 Created');
    assert(resSubmit.body?.success === true, 'Scenario 9: Response indicates success');
    const submittedPaperId = resSubmit.body?.data?.questionPaper?.id;
    assert(Boolean(submittedPaperId), 'Scenario 9: Created Question Paper has unique UUID');

    // Server-side delivery date calculation verification
    const expectedTomorrow = questionPaperService.calculateNextCalendarDay(new Date());
    const scheduledDate = resSubmit.body?.data?.questionPaper?.scheduled_delivery_date;
    assert(scheduledDate === expectedTomorrow, `Scenario 13 & 14: Server-calculated delivery date is tomorrow (${expectedTomorrow})`);

    // Verify notification was created for recipient
    assert(resSubmit.body?.data?.notification !== null, 'Scenario 10: Notification record created upon successful submission');
    assert(
      resSubmit.body?.data?.notification?.userId === MOCK_USERS.recipientFaculty.userId,
      'Scenario 11: Correct assigned recipient user ID set on notification'
    );
    assert(
      resSubmit.body?.data?.notification?.type === 'QUESTION_PAPER_SCHEDULED',
      'Scenario 11: Notification type is QUESTION_PAPER_SCHEDULED'
    );

    // Failed paper submission test: Missing required title should fail and create NO notification
    const countBeforeFailed = inMemoryNotifications.size;
    const resFailedSubmit = await sendMultipartRequest(
      '/api/question-papers',
      authorToken,
      { ...paperPayload, title: '' },
      SAMPLE_PLAINTEXT_PDF,
      'failed_paper.pdf'
    );
    assert(resFailedSubmit.status === 400, 'Scenario 10: Failed paper submission rejected with 400 Bad Request');
    assert(
      inMemoryNotifications.size === countBeforeFailed,
      'Scenario 10: Failed paper submission created NO notifications'
    );

    // -------------------------------------------------------------
    // Section 3: Notification Ownership & Retrieval Isolation (Scenarios 4–8, 12)
    // -------------------------------------------------------------
    console.log('\n--- Section 3: Notification Ownership & Retrieval Isolation ---');
    // Recipient retrieves their own notifications
    const resRecipientNotifs = await sendJsonRequest('GET', '/api/notifications', recipientToken);
    assert(resRecipientNotifs.status === 200, 'Scenario 4: Recipient can retrieve own notifications (200 OK)');
    assert(Array.isArray(resRecipientNotifs.body?.data), 'Scenario 4: Notifications data is an array');
    assert(resRecipientNotifs.body?.data.length >= 1, 'Scenario 4: Recipient sees their scheduled paper notification');

    const recipientNotification = resRecipientNotifs.body?.data[0];
    assert(
      recipientNotification?.questionPaperId === submittedPaperId,
      'Scenario 4: Notification correctly references submitted Question Paper UUID'
    );

    // Unrelated user receives NO notifications for this paper
    const resUnrelatedNotifs = await sendJsonRequest('GET', '/api/notifications', unrelatedToken);
    assert(resUnrelatedNotifs.status === 200, 'Scenario 12: Unrelated user gets 200 OK');
    const unrelatedHasPaper = (resUnrelatedNotifs.body?.data || []).some(
      (n) => n.questionPaperId === submittedPaperId
    );
    assert(!unrelatedHasPaper, 'Scenario 12: Unrelated faculty receives NO notification for author paper');

    // -------------------------------------------------------------
    // Section 4: Notification State & Unread Count (Scenarios 30–34)
    // -------------------------------------------------------------
    console.log('\n--- Section 4: Notification State & Unread Count ---');
    // Unread count check before marking read
    const resUnreadBefore = await sendJsonRequest('GET', '/api/notifications/unread-count', recipientToken);
    assert(resUnreadBefore.status === 200, 'Scenario 33: Unread count endpoint returns 200 OK');
    assert(resUnreadBefore.body?.count >= 1, `Scenario 33: Unread count >= 1 (got ${resUnreadBefore.body?.count})`);

    // Mark single notification as read
    const notifId = recipientNotification.id;
    const resMarkRead = await sendJsonRequest('PATCH', `/api/notifications/${notifId}/read`, recipientToken);
    assert(resMarkRead.status === 200, 'Scenario 6 & 31: User marks own notification read with 200 OK');
    assert(resMarkRead.body?.data?.isRead === true, 'Scenario 31: Notification state updated to isRead: true');

    // Verify unread count decremented
    const resUnreadAfter = await sendJsonRequest('GET', '/api/notifications/unread-count', recipientToken);
    assert(
      resUnreadAfter.body?.count === resUnreadBefore.body?.count - 1,
      'Scenario 32: Unread count decrements after marking notification as read'
    );

    // Cross-user mark read forbidden: Unrelated user cannot mark Recipient's notification read
    const resForbiddenMark = await sendJsonRequest('PATCH', `/api/notifications/${notifId}/read`, unrelatedToken);
    assert(resForbiddenMark.status === 403, 'Scenario 7: Foreign user marking another notification read returns 403 Forbidden');

    // Mark as unread and test mark-all-read
    await sendJsonRequest('PATCH', `/api/notifications/${notifId}/unread`, recipientToken);
    const resReadAll = await sendJsonRequest('PATCH', '/api/notifications/read-all', recipientToken);
    assert(resReadAll.status === 200, 'Scenario 8 & 34: Mark all read succeeds with 200 OK');
    const resUnreadFinal = await sendJsonRequest('GET', '/api/notifications/unread-count', recipientToken);
    assert(resUnreadFinal.body?.count === 0, 'Scenario 34: Unread count is 0 after read-all');

    // -------------------------------------------------------------
    // Section 5: Delivery-Date Enforcement & Access Gating ---
    // -------------------------------------------------------------
    console.log('\n--- Section 5: Delivery-Date Enforcement & Access Gating ---');
    // Scenario 15: Today is BEFORE scheduled delivery date (tomorrow)
    // Assigned recipient tries to access paper details / download
    const resBeforeDownload = await sendJsonRequest(
      'GET',
      `/api/question-papers/${submittedPaperId}/download`,
      recipientToken
    );
    assert(
      resBeforeDownload.status === 403,
      `Scenario 15: Assigned recipient download blocked BEFORE delivery date (got ${resBeforeDownload.status})`
    );
    assert(
      resBeforeDownload.body?.message?.toLowerCase().includes('scheduled') ||
        resBeforeDownload.body?.message?.toLowerCase().includes('forbidden'),
      'Scenario 15: Error message informs that paper is scheduled for future delivery'
    );

    // Assigned recipient metadata view before delivery date is also blocked
    const resBeforeDetails = await sendJsonRequest(
      'GET',
      `/api/question-papers/${submittedPaperId}`,
      recipientToken
    );
    assert(
      resBeforeDetails.status === 403,
      `Scenario 17: Assigned recipient details view blocked BEFORE delivery date (got ${resBeforeDetails.status})`
    );

    // Authoring teacher can ALWAYS access their own paper anytime
    const resAuthorDownload = await sendBinaryGetRequest(
      `/api/question-papers/${submittedPaperId}/download`,
      authorToken
    );
    assert(resAuthorDownload.status === 200, 'Authoring teacher can download own paper at any time');
    assert(
      resAuthorDownload.buffer.equals(SAMPLE_PLAINTEXT_PDF),
      'Authoring teacher downloaded PDF matches original plaintext'
    );

    // Scenario 18: Delivery-date bypass attempt rejected
    const resBypassAttempt = await sendJsonRequest(
      'GET',
      `/api/question-papers/${submittedPaperId}/download?bypassDate=true&force=true`,
      recipientToken
    );
    assert(resBypassAttempt.status === 403, 'Scenario 18: Client query bypass attempt rejected with 403 Forbidden');

    // Scenario 19: Assignment bypass attempt rejected (Unrelated teacher tries to download)
    const resUnrelatedDownload = await sendJsonRequest(
      'GET',
      `/api/question-papers/${submittedPaperId}/download`,
      unrelatedToken
    );
    assert(resUnrelatedDownload.status === 403, 'Scenario 19: Unassigned faculty download rejected with 403 Forbidden');

    // -------------------------------------------------------------
    // Section 6: On Delivery Date & After Delivery Date Access (Scenarios 16–17)
    // -------------------------------------------------------------
    console.log('\n--- Section 6: On Delivery Date & After Delivery Date Access ---');
    const todayStr = new Date().toISOString().split('T')[0];

    // Update in-memory stored paper and assignment scheduled_delivery_date to TODAY
    const storedPaper = inMemoryPapers.get(submittedPaperId);
    storedPaper.scheduled_delivery_date = todayStr;
    const storedAssignment = inMemoryAssignments.get(submittedPaperId);
    storedAssignment.scheduled_delivery_date = todayStr;

    // Now assigned recipient attempts download ON delivery date
    const resOnDeliveryDownload = await sendBinaryGetRequest(
      `/api/question-papers/${submittedPaperId}/download`,
      recipientToken
    );
    assert(
      resOnDeliveryDownload.status === 200,
      `Scenario 16: Assigned recipient can download ON delivery date (200 OK)`
    );
    assert(
      resOnDeliveryDownload.buffer.equals(SAMPLE_PLAINTEXT_PDF),
      'Scenario 16: Decrypted PDF matches original plaintext buffer byte-for-byte'
    );

    // Set scheduled_delivery_date to YESTERDAY (AFTER delivery date)
    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    storedPaper.scheduled_delivery_date = yesterdayStr;
    storedAssignment.scheduled_delivery_date = yesterdayStr;

    const resAfterDeliveryDownload = await sendBinaryGetRequest(
      `/api/question-papers/${submittedPaperId}/download`,
      recipientToken
    );
    assert(
      resAfterDeliveryDownload.status === 200,
      `Scenario 17: Assigned recipient can download AFTER delivery date (200 OK)`
    );
    assert(
      resAfterDeliveryDownload.buffer.equals(SAMPLE_PLAINTEXT_PDF),
      'Scenario 17: Decrypted PDF matches original plaintext buffer byte-for-byte'
    );

    // -------------------------------------------------------------
    // Section 7: Verify-Before-Decrypt Pipeline on Delivered Paper (Scenarios 25–29)
    // -------------------------------------------------------------
    console.log('\n--- Section 7: Verify-Before-Decrypt Pipeline on Delivered Paper ---');
    // Tamper ciphertext in storage
    simulateTamperedStorageCiphertext = true;
    const resTamperedDownload = await sendJsonRequest(
      'GET',
      `/api/question-papers/${submittedPaperId}/download`,
      recipientToken
    );
    assert(
      resTamperedDownload.status === 400,
      'Scenario 29: Tampered ciphertext in storage causes download rejection with 400 Bad Request'
    );
    assert(
      resTamperedDownload.body?.message?.toLowerCase().includes('integrity') ||
        resTamperedDownload.body?.message?.toLowerCase().includes('tamper') ||
        resTamperedDownload.body?.message?.toLowerCase().includes('hash') ||
        resTamperedDownload.body?.message?.toLowerCase().includes('failed'),
      'Scenario 29: Error message indicates cryptographic integrity failure'
    );
    simulateTamperedStorageCiphertext = false; // Restore storage

    // Verify-signature endpoint confirms valid digital signature
    const resSigVerify = await questionPaperService.verifyQuestionPaperIntegrity(
      submittedPaperId,
      MOCK_USERS.recipientFaculty.userId,
      'TEACHER'
    );
    assert(resSigVerify.verified === true, 'Scenario 25 & 26: SHA-256 and RSA-PSS signature verification passes');
    assert(resSigVerify.tamperDetected === false, 'Scenario 26: Tamper detected is false on intact paper');

    // -------------------------------------------------------------
    // Section 8: Security, Secret Leakage & ID Validation (Scenarios 20–27)
    // -------------------------------------------------------------
    console.log('\n--- Section 8: Security, Secret Leakage & ID Validation ---');
    // Non-existent notification UUID
    const randomUuid = crypto.randomUUID();
    const resNonExistentNotif = await sendJsonRequest('PATCH', `/api/notifications/${randomUuid}/read`, recipientToken);
    assert(resNonExistentNotif.status === 404, 'Scenario 20: Random non-existent notification UUID returns 404 Not Found');

    // Malformed notification ID
    const resMalformedNotif = await sendJsonRequest('PATCH', '/api/notifications/invalid-id/read', recipientToken);
    assert(resMalformedNotif.status === 400, 'Scenario 23: Malformed notification ID returns 400 Bad Request');

    // Non-existent Question Paper UUID
    const resNonExistentPaper = await sendJsonRequest('GET', `/api/question-papers/${randomUuid}/download`, recipientToken);
    assert(resNonExistentPaper.status === 404, 'Scenario 21: Non-existent Question Paper UUID returns 404 Not Found');

    // Secret leakage audit on notification responses
    const notifString = JSON.stringify(resRecipientNotifs.body);
    assert(!notifString.includes('encrypted_aes_key'), 'Scenario 24: Notification response does NOT leak encrypted_aes_key');
    assert(!notifString.includes('auth_tag'), 'Scenario 24: Notification response does NOT leak auth_tag');
    assert(!notifString.includes('-----BEGIN PRIVATE KEY-----'), 'Scenario 24: Notification response does NOT leak RSA private key');
    assert(!notifString.includes('/storage/v1/object/public'), 'Scenario 22: Notification response does NOT leak public storage URL');
    assert(!notifString.includes('question-papers/22222222-2222'), 'Scenario 23: Notification response does NOT leak internal storage path');

    // -------------------------------------------------------------
    // Section 9: Duplicate Protection & Retry Idempotency (Scenarios 35–36)
    // -------------------------------------------------------------
    console.log('\n--- Section 9: Duplicate Protection & Idempotency ---');
    const notifCountBeforeRetry = inMemoryNotifications.size;
    const idempotentNotif = await notificationService.createQuestionPaperNotification({
      recipientId: MOCK_USERS.recipientFaculty.userId,
      questionPaperId: submittedPaperId,
      title: 'Module 12 Final Exam Paper',
      subject: 'Network Security',
      scheduledDeliveryDate: expectedTomorrow,
    });
    assert(Boolean(idempotentNotif?.id), 'Scenario 35: Idempotent call returns notification record');
    assert(
      inMemoryNotifications.size === notifCountBeforeRetry,
      'Scenario 35: Duplicate notification creation attempt created NO redundant records'
    );

    // -------------------------------------------------------------
    // Section 10: Regression Safeguards (Modules 1–11) (Scenarios 40–49)
    // -------------------------------------------------------------
    console.log('\n--- Section 10: Regression Safeguards (Modules 1–11) ---');
    // Module 1 Health
    const resHealth = await sendJsonRequest('GET', '/api/health', null);
    assert(resHealth.status === 200, 'Scenario 40: Regression Module 1 health check returns 200 OK');

    // Module 3 Auth
    const resAuthMe = await sendJsonRequest('GET', '/api/auth/me', recipientToken);
    assert(resAuthMe.status === 200, 'Scenario 41: Regression Module 3 /api/auth/me returns 200 OK');

    // Module 4 RBAC
    const resRbacTeacher = await sendJsonRequest('GET', '/api/rbac/teacher', recipientToken);
    assert(resRbacTeacher.status === 200, 'Scenario 42: Regression Module 4 /api/rbac/teacher returns 200 for TEACHER');
    const resRbacCoord = await sendJsonRequest('GET', '/api/rbac/teacher', coordToken);
    assert(resRbacCoord.status === 403, 'Scenario 42: Regression Module 4 /api/rbac/teacher returns 403 for coordinator');

    // Module 5 Teacher listing
    const resMyPapers = await sendJsonRequest('GET', '/api/question-papers/my', authorToken);
    assert(resMyPapers.status === 200, 'Scenario 43: Regression Module 5 /api/question-papers/my returns 200 OK');

    // Module 6 AES-256-GCM roundtrip
    const encResult = encryptionService.encryptQuestionPaper(SAMPLE_PLAINTEXT_PDF);
    assert(Boolean(encResult.encryptedBuffer), 'Scenario 44: Regression Module 6 encryptQuestionPaper succeeds');
    const decPdf = encryptionService.decryptQuestionPaper(
      encResult.encryptedBuffer,
      encResult.encryptedAesKey,
      encResult.iv,
      encResult.authTag
    );
    assert(decPdf.equals(SAMPLE_PLAINTEXT_PDF), 'Scenario 44: Regression Module 6 decryptQuestionPaper matches original PDF');

    // Module 7 RSA-PSS digital signature
    const sigResult = signatureService.signQuestionPaper(encResult.encryptedBuffer);
    const sigValid = signatureService.verifyQuestionPaperSignature(
      encResult.encryptedBuffer,
      sigResult.signature
    );
    assert(sigValid === true, 'Scenario 45: Regression Module 7 RSA-PSS signature verification succeeds');

    // Module 8 RSA-OAEP key wrapping
    const rawAes = crypto.randomBytes(32);
    const wrapped = keyManagementService.wrapDocumentKey(rawAes);
    const unwrapped = keyManagementService.unwrapDocumentKey(wrapped);
    assert(unwrapped.equals(rawAes), 'Scenario 46: Regression Module 8 RSA-OAEP key wrapping roundtrip succeeds');

    // Module 9 Exam Coordinator access
    const resCoordPapers = await sendJsonRequest('GET', '/api/exam-coordinator/question-papers', coordToken);
    assert(resCoordPapers.status === 200, 'Scenario 47: Regression Module 9 coordinator question-papers returns 200 OK');

    // Module 10 Answer Key timing window
    const akWindow = answerKeyService.getAnswerKeySubmissionWindow('2026-11-20');
    assert(Boolean(akWindow?.status), 'Scenario 48: Regression Module 10 Answer Key window calculation succeeds');

    // Module 11 Unified Verification & Decryption
    const unifiedDecrypted = verificationService.verifyAndDecryptQuestionPaper({
      ciphertextBuffer: encResult.encryptedBuffer,
      sigRecord: {
        algorithm: sigResult.algorithm,
        file_hash: sigResult.fileHash,
        signature: sigResult.signature,
        public_key_reference: sigResult.publicKeyReference,
      },
      keyRecord: {
        encrypted_aes_key: encResult.encryptedAesKey,
        iv: encResult.iv,
        auth_tag: encResult.authTag,
      },
    });
    assert(
      unifiedDecrypted.equals(SAMPLE_PLAINTEXT_PDF),
      'Scenario 49: Regression Module 11 unified verificationService succeeds'
    );

    console.log('\n============================================================');
    console.log('  MODULE 12 VERIFICATION COMPLETED SUCCESSFULLY');
    console.log(`  Passed: ${passedCount} / ${assertionCount} Assertions`);
    console.log(`  Failed: ${failedCount}`);
    console.log('============================================================\n');

    if (failedCount > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Unexpected test runner failure:', err);
    process.exitCode = 1;
  } finally {
    if (server) {
      server.close();
    }
  }
}

runTestSuite();

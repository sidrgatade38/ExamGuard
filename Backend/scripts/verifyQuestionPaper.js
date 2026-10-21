/**
 * Comprehensive Automated Test Suite for Module 5: Question Paper Management
 * 
 * Verifies all 22 required scenarios:
 * 1.  Valid submission by TEACHER -> 201 Created
 * 2.  Missing token rejected -> 401 Unauthorized
 * 3.  Non-teacher role rejected on upload -> 403 Forbidden (ADMIN / EXAM_COORDINATOR)
 * 4.  Missing required metadata rejected -> 400 Bad Request
 * 5.  Missing file rejected -> 400 Bad Request
 * 6.  Non-PDF rejected (MIME/ext or invalid magic bytes) -> 400 Bad Request
 * 7.  Oversized file rejected (>10MB) -> 400 Bad Request
 * 8.  Teacher retrieves own papers -> 200 OK
 * 9.  Teacher cannot retrieve another teacher's paper metadata -> 403 Forbidden
 * 10. Teacher cannot download another teacher's paper -> 403 Forbidden
 * 11. Invalid paper ID returns 404 Not Found
 * 12. Invalid recipient user ID rejected -> 400 Bad Request
 * 13. Inactive recipient rejected -> 400 Bad Request
 * 14. Server-controlled teacher ownership (req.user.userId used)
 * 15. Client-supplied teacher_id rejected / ignored -> 400 Bad Request
 * 16. scheduled_delivery_date generated server-side
 * 17. scheduled_delivery_date is exactly next calendar day (including boundary tests)
 * 18. Storage upload error handling -> 502 Bad Gateway
 * 19. Compensating cleanup of storage file if DB insert fails -> remove() invoked
 * 20. Module 3 authentication regression check -> 200 / 401
 * 21. Module 4 RBAC regression check -> 200 for TEACHER, 403 for ADMIN
 * 22. Module 1 health check regression check -> 200 UP
 */

const http = require('http');
require('dotenv').config();

const { app } = require('../src/server');
const config = require('../src/config');
const authorizationService = require('../src/services/authorizationService');
const questionPaperService = require('../src/services/questionPaperService');
const { supabase, getSupabaseClient } = require('../src/config/supabase');
const supabaseClient = getSupabaseClient();
const { generateToken, verifyToken } = require('../src/utils/jwt');

const TEST_PORT = 5003;
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
  inactiveTeacher: {
    userId: '44444444-4444-4444-4444-444444444444',
    name: 'Inactive Faculty',
    roleId: 'role-teacher-uuid',
    roleName: 'TEACHER',
    email: 'inactive@examguard.edu',
    isActive: false,
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

// In-memory paper and assignment store for test execution
const inMemoryPapers = new Map();
const inMemoryAssignments = new Map();
const inMemoryPaperKeys = new Map();
const inMemorySignatures = new Map();
const storageFiles = new Map();
const storageRemovals = [];

// Flags to simulate service / storage failures
let simulateStorageUploadError = false;
let simulateDbInsertError = false;

// Generate tokens for testing
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

// Intercept supabase client queries and storage for reliable test execution
const originalClientFrom = supabaseClient.from.bind(supabaseClient);
const originalClientStorageFrom = supabaseClient.storage.from.bind(supabaseClient.storage);

supabaseClient.from = function (tableName) {
  if (tableName === 'users') {
    return {
      select: (fields) => ({
        eq: (col, val) => {
          return {
            eq: (col2, val2) => ({
              order: () => {
                // Return active teachers
                const teachers = Object.values(MOCK_USERS).filter(
                  (u) => u.roleName === 'TEACHER' && u.isActive
                ).map(u => ({ id: u.userId, name: u.name, email: u.email, is_active: u.isActive }));
                return Promise.resolve({ data: teachers, error: null });
              }
            }),
            maybeSingle: () => {
              const user = Object.values(MOCK_USERS).find((u) => u.userId === val || u.id === val);
              if (!user) {
                return Promise.resolve({ data: null, error: null });
              }
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
          };
        },
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
            const record = { ...records[0], created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
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
          if (col === 'id') {
            inMemoryPapers.delete(val);
          }
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

  return originalClientFrom(tableName);
};

supabaseClient.storage.from = function (bucket) {
  return {
    upload: (storagePath, fileBuffer, options) => {
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
      const fileBuffer = storageFiles.get(storagePath) || VALID_PDF_BUFFER;
      return Promise.resolve({
        data: fileBuffer,
        error: null,
      });
    },
    createSignedUrl: (storagePath, expiresIn) => {
      return Promise.resolve({
        data: {
          signedUrl: `https://mock.storage.examguard.edu/${storagePath}?token=mock-signed-token&expires=${expiresIn}`,
        },
        error: null,
      });
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
 * Helper to perform HTTP multipart upload requests using native fetch and FormData
 */
async function sendMultipartRequest({
  token,
  fields = {},
  file = null, // { filename, content, mimeType }
}) {
  const formData = new FormData();

  for (const [key, val] of Object.entries(fields)) {
    if (val !== undefined && val !== null) {
      formData.append(key, String(val));
    }
  }

  if (file) {
    const buffer = Buffer.isBuffer(file.content)
      ? file.content
      : Buffer.from(file.content);
    const blob = new Blob([buffer], { type: file.mimeType || 'application/pdf' });
    formData.append('file', blob, file.filename || 'paper.pdf');
  }

  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

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

/**
 * Helper to perform JSON requests
 */
async function sendJsonRequest(method, path, token, payload = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };
  if (payload) {
    options.body = JSON.stringify(payload);
  }

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

// Minimal valid PDF content
const VALID_PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF'
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
  console.log('   MODULE 5: QUESTION PAPER MANAGEMENT VERIFICATION SUITE');
  console.log('===============================================================\n');

  // Start test server
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(TEST_PORT, () => {
      console.log(`Test server running on port ${TEST_PORT}\n`);
      resolve();
    });
  });

  try {
    // -------------------------------------------------------------
    // Scenario 1: Valid submission by TEACHER (201 Created)
    // -------------------------------------------------------------
    console.log('--- 1. Valid Question Paper Submission by TEACHER ---');
    const validFields = {
      title: 'Operating Systems End-Sem',
      subject: 'Computer Science',
      semester: 'Semester 5',
      academicYear: '2025-2026',
      examType: 'END_SEM',
      examDate: '2026-05-15',
      assignedToUserId: MOCK_USERS.teacher2.userId,
    };

    const res1 = await sendMultipartRequest({
      token: teacher1Token,
      fields: validFields,
      file: {
        filename: 'os_paper.pdf',
        content: VALID_PDF_BUFFER,
        mimeType: 'application/pdf',
      },
    });

    assert(res1.status === 201, `Status is 201 Created (got ${res1.status})`);
    assert(res1.body.success === true, 'Response body success is true');
    assert(res1.body.data?.questionPaper?.id !== undefined, 'Created question paper has unique ID');
    assert(res1.body.data?.questionPaper?.status === 'SUBMITTED', 'Status is SUBMITTED');
    assert(
      res1.body.data?.questionPaper?.teacher_id === MOCK_USERS.teacher1.userId,
      'Paper owner teacher_id matches authenticated user'
    );
    assert(
      res1.body.data?.assignment?.assigned_to_user_id === MOCK_USERS.teacher2.userId,
      'Recipient faculty matches assignedToUserId'
    );

    const createdPaperId = res1.body.data?.questionPaper?.id;

    // -------------------------------------------------------------
    // Scenario 2: Missing token rejected (401 Unauthorized)
    // -------------------------------------------------------------
    console.log('\n--- 2. Missing Token Rejection ---');
    const res2 = await sendMultipartRequest({
      token: null,
      fields: validFields,
      file: {
        filename: 'os_paper.pdf',
        content: VALID_PDF_BUFFER,
        mimeType: 'application/pdf',
      },
    });
    assert(res2.status === 401, `Status is 401 Unauthorized (got ${res2.status})`);
    assert(res2.body.success === false, 'Rejected without token');

    // -------------------------------------------------------------
    // Scenario 3: Non-teacher role rejected on upload (403 Forbidden)
    // -------------------------------------------------------------
    console.log('\n--- 3. Non-Teacher Role Rejection ---');
    const res3Admin = await sendMultipartRequest({
      token: adminToken,
      fields: validFields,
      file: {
        filename: 'os_paper.pdf',
        content: VALID_PDF_BUFFER,
        mimeType: 'application/pdf',
      },
    });
    assert(res3Admin.status === 403, `ADMIN token rejected with 403 Forbidden (got ${res3Admin.status})`);

    const res3Coord = await sendMultipartRequest({
      token: coordToken,
      fields: validFields,
      file: {
        filename: 'os_paper.pdf',
        content: VALID_PDF_BUFFER,
        mimeType: 'application/pdf',
      },
    });
    assert(res3Coord.status === 403, `EXAM_COORDINATOR token rejected with 403 Forbidden (got ${res3Coord.status})`);

    // -------------------------------------------------------------
    // Scenario 4: Missing required metadata rejected (400 Bad Request)
    // -------------------------------------------------------------
    console.log('\n--- 4. Missing Required Metadata Rejection ---');
    const incompleteFields = { ...validFields };
    delete incompleteFields.title;
    const res4 = await sendMultipartRequest({
      token: teacher1Token,
      fields: incompleteFields,
      file: {
        filename: 'paper.pdf',
        content: VALID_PDF_BUFFER,
        mimeType: 'application/pdf',
      },
    });
    assert(res4.status === 400, `Status is 400 Bad Request when title is missing (got ${res4.status})`);
    assert(res4.body.message.includes('title'), `Error message mentions missing title: "${res4.body.message}"`);

    // -------------------------------------------------------------
    // Scenario 5: Missing file rejected (400 Bad Request)
    // -------------------------------------------------------------
    console.log('\n--- 5. Missing File Rejection ---');
    const res5 = await sendMultipartRequest({
      token: teacher1Token,
      fields: validFields,
      file: null,
    });
    assert(res5.status === 400, `Status is 400 Bad Request when file is missing (got ${res5.status})`);
    assert(res5.body.message.toLowerCase().includes('file'), `Error message indicates missing file: "${res5.body.message}"`);

    // -------------------------------------------------------------
    // Scenario 6: Non-PDF rejected (400 Bad Request)
    // -------------------------------------------------------------
    console.log('\n--- 6. Non-PDF File Rejection ---');
    // Test 6a: Wrong extension (.txt)
    const res6Txt = await sendMultipartRequest({
      token: teacher1Token,
      fields: validFields,
      file: {
        filename: 'document.txt',
        content: 'This is not a PDF file',
        mimeType: 'text/plain',
      },
    });
    assert(res6Txt.status === 400, `Text file rejected with 400 (got ${res6Txt.status})`);

    // Test 6b: .pdf extension with spoofed content (missing %PDF- magic bytes)
    const res6Spoofed = await sendMultipartRequest({
      token: teacher1Token,
      fields: validFields,
      file: {
        filename: 'malicious.pdf',
        content: 'INVALID_HEADER_NOT_A_REAL_PDF',
        mimeType: 'application/pdf',
      },
    });
    assert(res6Spoofed.status === 400, `Spoofed non-PDF rejected with 400 (got ${res6Spoofed.status})`);
    assert(res6Spoofed.body.message.includes('PDF header'), 'Rejected specifically for invalid PDF magic bytes header');

    // -------------------------------------------------------------
    // Scenario 7: Oversized file rejected (400 Bad Request)
    // -------------------------------------------------------------
    console.log('\n--- 7. Oversized File Rejection (> 10MB) ---');
    // 10.5 MB buffer starting with valid PDF header
    const oversizedBuffer = Buffer.alloc(10.5 * 1024 * 1024);
    oversizedBuffer.write('%PDF-1.4\n');
    const res7 = await sendMultipartRequest({
      token: teacher1Token,
      fields: validFields,
      file: {
        filename: 'huge_paper.pdf',
        content: oversizedBuffer,
        mimeType: 'application/pdf',
      },
    });
    assert(res7.status === 400, `File exceeding 10MB limit rejected with 400 (got ${res7.status})`);
    assert(res7.body.message.toLowerCase().includes('exceeds'), `Message indicates size limit exceeded: "${res7.body.message}"`);

    // -------------------------------------------------------------
    // Scenario 8: Teacher retrieves own papers (200 OK)
    // -------------------------------------------------------------
    console.log('\n--- 8. Teacher Retrieves Own Question Papers ---');
    const res8 = await sendJsonRequest('GET', '/api/question-papers/my', teacher1Token);
    assert(res8.status === 200, `Status is 200 OK (got ${res8.status})`);
    assert(Array.isArray(res8.body.data), 'Data is an array');
    assert(res8.body.data.length >= 1, `Teacher 1 sees their submitted paper (count: ${res8.body.data.length})`);
    assert(
      res8.body.data[0].id === createdPaperId,
      'Retrieved paper matches created paper ID'
    );

    // -------------------------------------------------------------
    // Scenario 9: Teacher cannot retrieve another teacher's paper (403 Forbidden)
    // -------------------------------------------------------------
    console.log('\n--- 9. Cross-Teacher Paper Metadata Access Forbidden ---');
    // Teacher 2 attempts to fetch metadata of Teacher 1's paper
    const res9 = await sendJsonRequest(
      'GET',
      `/api/question-papers/${createdPaperId}`,
      teacher2Token
    );
    assert(res9.status === 403, `Teacher 2 accessing Teacher 1 paper returns 403 (got ${res9.status})`);
    assert(res9.body.message.toLowerCase().includes('forbidden') || res9.body.message.toLowerCase().includes('own'), 'Message indicates unauthorized ownership');

    // -------------------------------------------------------------
    // Scenario 10: Teacher cannot download another teacher's paper (403 Forbidden)
    // -------------------------------------------------------------
    console.log('\n--- 10. Cross-Teacher Paper Download Forbidden ---');
    // Teacher 2 attempts to generate download URL for Teacher 1's paper
    const res10 = await sendJsonRequest(
      'GET',
      `/api/question-papers/${createdPaperId}/download`,
      teacher2Token
    );
    assert(res10.status === 403, `Teacher 2 downloading Teacher 1 paper returns 403 (got ${res10.status})`);

    // Authoring teacher (Teacher 1) CAN download their own paper (200 OK)
    const res10Owner = await sendJsonRequest(
      'GET',
      `/api/question-papers/${createdPaperId}/download`,
      teacher1Token
    );
    assert(res10Owner.status === 200, `Authoring Teacher 1 download returns 200 OK (got ${res10Owner.status})`);
    assert(
      Boolean(res10Owner.body?.raw && res10Owner.body.raw.startsWith('%PDF-')),
      'Decrypted PDF document stream returned to authorized owner'
    );

    // -------------------------------------------------------------
    // Scenario 11: Invalid paper ID returns 404 Not Found
    // -------------------------------------------------------------
    console.log('\n--- 11. Non-Existent Paper ID Returns 404 ---');
    const res11 = await sendJsonRequest(
      'GET',
      '/api/question-papers/00000000-0000-0000-0000-000000000000',
      teacher1Token
    );
    assert(res11.status === 404, `Non-existent paper returns 404 (got ${res11.status})`);
    assert(res11.body.message.includes('not found'), 'Message indicates paper not found');

    // -------------------------------------------------------------
    // Scenario 12: Invalid recipient user ID rejected (400 Bad Request)
    // -------------------------------------------------------------
    console.log('\n--- 12. Invalid Recipient Faculty Rejection ---');
    const invalidRecipientFields = {
      ...validFields,
      title: 'Invalid Recipient Paper',
      assignedToUserId: '99999999-9999-9999-9999-999999999999', // Unknown user
    };
    const res12 = await sendMultipartRequest({
      token: teacher1Token,
      fields: invalidRecipientFields,
      file: {
        filename: 'paper.pdf',
        content: VALID_PDF_BUFFER,
        mimeType: 'application/pdf',
      },
    });
    assert(res12.status === 400, `Unknown recipient returns 400 (got ${res12.status})`);
    assert(res12.body.message.includes('not exist'), `Message indicates user does not exist: "${res12.body.message}"`);

    // -------------------------------------------------------------
    // Scenario 13: Inactive recipient rejected (400 Bad Request)
    // -------------------------------------------------------------
    console.log('\n--- 13. Inactive Recipient Faculty Rejection ---');
    const inactiveRecipientFields = {
      ...validFields,
      title: 'Inactive Recipient Paper',
      assignedToUserId: MOCK_USERS.inactiveTeacher.userId,
    };
    const res13 = await sendMultipartRequest({
      token: teacher1Token,
      fields: inactiveRecipientFields,
      file: {
        filename: 'paper.pdf',
        content: VALID_PDF_BUFFER,
        mimeType: 'application/pdf',
      },
    });
    assert(res13.status === 400, `Inactive recipient returns 400 (got ${res13.status})`);
    assert(res13.body.message.includes('inactive'), `Message indicates recipient is inactive: "${res13.body.message}"`);

    // -------------------------------------------------------------
    // Scenario 14: Server-controlled teacher ownership
    // -------------------------------------------------------------
    console.log('\n--- 14. Server-Controlled Teacher Ownership ---');
    assert(
      inMemoryPapers.get(createdPaperId).teacher_id === MOCK_USERS.teacher1.userId,
      `Stored paper.teacher_id is strictly req.user.userId (${MOCK_USERS.teacher1.userId})`
    );

    // -------------------------------------------------------------
    // Scenario 15: Client-supplied teacher_id rejected / ignored
    // -------------------------------------------------------------
    console.log('\n--- 15. Client-Supplied teacher_id Rejection / Protection ---');
    const spoofedFields = {
      ...validFields,
      title: 'Spoofed Teacher Submission',
      teacher_id: MOCK_USERS.teacher2.userId, // Attacker trying to spoof author
      teacherId: MOCK_USERS.teacher2.userId,
    };
    const res15 = await sendMultipartRequest({
      token: teacher1Token,
      fields: spoofedFields,
      file: {
        filename: 'paper.pdf',
        content: VALID_PDF_BUFFER,
        mimeType: 'application/pdf',
      },
    });
    assert(
      res15.status === 400,
      `Attempt to spoof teacherId rejected with 400 (got ${res15.status})`
    );
    assert(
      res15.body.message.includes('override authenticated'),
      `Security message returned: "${res15.body.message}"`
    );

    // -------------------------------------------------------------
    // Scenario 16: scheduled_delivery_date generated server-side
    // -------------------------------------------------------------
    console.log('\n--- 16. Server-Controlled Delivery Date Scheduling ---');
    const customScheduleFields = {
      ...validFields,
      title: 'Custom Schedule Injection Attempt',
      scheduled_delivery_date: '2099-01-01', // Client attempting to force custom date
      scheduledDeliveryDate: '2099-01-01',
    };
    const res16 = await sendMultipartRequest({
      token: teacher1Token,
      fields: customScheduleFields,
      file: {
        filename: 'paper.pdf',
        content: VALID_PDF_BUFFER,
        mimeType: 'application/pdf',
      },
    });
    assert(res16.status === 201, `Submission created with 201 (got ${res16.status})`);
    assert(
      res16.body.data.questionPaper.scheduled_delivery_date !== '2099-01-01',
      'Client custom scheduled_delivery_date ignored'
    );

    // -------------------------------------------------------------
    // Scenario 17: scheduled_delivery_date is exactly next calendar day
    // -------------------------------------------------------------
    console.log('\n--- 17. Delivery Date Next-Day Calendar Calculation ---');
    const now = new Date();
    const expectedTomorrow = new Date(now);
    expectedTomorrow.setUTCDate(expectedTomorrow.getUTCDate() + 1);
    const expectedDateStr = expectedTomorrow.toISOString().split('T')[0];

    assert(
      res16.body.data.questionPaper.scheduled_delivery_date === expectedDateStr,
      `Calculated date matches next calendar day: ${expectedDateStr}`
    );

    // Calendar boundary tests
    const endOfMonth = questionPaperService.calculateNextCalendarDay(new Date('2026-01-31T12:00:00Z'));
    assert(endOfMonth === '2026-02-01', `Jan 31 rolls over to Feb 01 (got ${endOfMonth})`);

    const leapDay = questionPaperService.calculateNextCalendarDay(new Date('2024-02-28T12:00:00Z'));
    assert(leapDay === '2024-02-29', `Leap year Feb 28 rolls over to Feb 29 (got ${leapDay})`);

    const yearEnd = questionPaperService.calculateNextCalendarDay(new Date('2026-12-31T23:59:59Z'));
    assert(yearEnd === '2027-01-01', `Dec 31 rolls over to Jan 01 next year (got ${yearEnd})`);

    // -------------------------------------------------------------
    // Scenario 18: Storage upload error handling (502 Bad Gateway)
    // -------------------------------------------------------------
    console.log('\n--- 18. Storage Upload Error Handling (502) ---');
    simulateStorageUploadError = true;
    const res18 = await sendMultipartRequest({
      token: teacher1Token,
      fields: validFields,
      file: {
        filename: 'paper.pdf',
        content: VALID_PDF_BUFFER,
        mimeType: 'application/pdf',
      },
    });
    simulateStorageUploadError = false; // Reset

    assert(res18.status === 502, `Storage error returns 502 Bad Gateway (got ${res18.status})`);
    assert(res18.body.message.includes('store question paper'), `Error message indicates storage failure: "${res18.body.message}"`);

    // -------------------------------------------------------------
    // Scenario 19: Compensating cleanup of storage file if DB fails
    // -------------------------------------------------------------
    console.log('\n--- 19. Compensating Rollback Cleanup When DB Fails ---');
    simulateDbInsertError = true;
    storageRemovals.length = 0; // Clear removal history

    const res19 = await sendMultipartRequest({
      token: teacher1Token,
      fields: validFields,
      file: {
        filename: 'rollback_test.pdf',
        content: VALID_PDF_BUFFER,
        mimeType: 'application/pdf',
      },
    });
    simulateDbInsertError = false; // Reset

    assert(res19.status === 500, `DB failure returns 500 (got ${res19.status})`);
    assert(
      storageRemovals.length >= 1,
      `Compensating cleanup called storage remove() (removals: ${storageRemovals.length})`
    );
    assert(
      storageRemovals[0].includes('rollback_test.pdf'),
      `Cleaned up orphaned storage file: ${storageRemovals[0]}`
    );

    // -------------------------------------------------------------
    // Scenario 20: Module 3 authentication regression check
    // -------------------------------------------------------------
    console.log('\n--- 20. Module 3 Authentication Regression Check ---');
    // Valid token decoding
    const decoded = verifyToken(teacher1Token);
    assert(decoded.userId === MOCK_USERS.teacher1.userId, 'JWT token successfully verifies and decodes');
    // Auth route check
    const authRes = await sendJsonRequest('GET', '/api/auth/me', teacher1Token);
    assert(authRes.status === 200, `GET /api/auth/me returns 200 OK (got ${authRes.status})`);
    const badTokenRes = await sendJsonRequest('GET', '/api/auth/me', 'invalid.jwt.token');
    assert(badTokenRes.status === 401, `Invalid token rejected with 401 (got ${badTokenRes.status})`);

    // -------------------------------------------------------------
    // Scenario 21: Module 4 RBAC regression check
    // -------------------------------------------------------------
    console.log('\n--- 21. Module 4 RBAC Regression Check ---');
    const rbacTeacherRes = await sendJsonRequest('GET', '/api/rbac/teacher', teacher1Token);
    assert(rbacTeacherRes.status === 200, `GET /api/rbac/teacher for TEACHER returns 200 (got ${rbacTeacherRes.status})`);

    const rbacAdminOnTeacherRes = await sendJsonRequest('GET', '/api/rbac/teacher', adminToken);
    assert(
      rbacAdminOnTeacherRes.status === 403,
      `GET /api/rbac/teacher for ADMIN returns 403 Forbidden (got ${rbacAdminOnTeacherRes.status})`
    );

    // -------------------------------------------------------------
    // Scenario 22: Module 1 health check regression check
    // -------------------------------------------------------------
    console.log('\n--- 22. Module 1 Health Check Regression Check ---');
    const healthRes = await sendJsonRequest('GET', '/api/health', null);
    assert(healthRes.status === 200, `GET /api/health returns 200 OK (got ${healthRes.status})`);
    assert(healthRes.body.success === true, 'Health check reports success: true');

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
    // Teardown
    authorizationService.getUserRole = originalGetUserRole;
    supabaseClient.from = originalClientFrom;
    supabaseClient.storage.from = originalClientStorageFrom;
    if (server) {
      server.close();
    }
  }
}

runTestSuite();

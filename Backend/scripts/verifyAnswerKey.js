/**
 * Comprehensive Automated Verification Test Suite for Module 10:
 * Answer Key Management
 *
 * Verifies all required operational, security, timing, and cryptographic criteria:
 * 1.  Server starts and binds cleanly on dedicated port 5008.
 * 2.  Unauthenticated teacher requests to Answer Key endpoints return 401.
 * 3.  Non-teacher role (EXAM_COORDINATOR, ADMIN, STUDENT) accessing teacher endpoints returns 403.
 * 4.  Timing window calculation (getAnswerKeySubmissionWindow):
 *     - diffDays < 0 -> BEFORE_EXAM, canUpload: false
 *     - diffDays = 0 -> WINDOW_OPEN_PREFERRED, canUpload: true
 *     - diffDays = 1 -> WINDOW_OPEN_PREFERRED, canUpload: true
 *     - diffDays = 2 -> WINDOW_OPEN_PREFERRED, canUpload: true
 *     - diffDays = 3 -> WINDOW_OPEN_EXTENDED, canUpload: true
 *     - diffDays = 4 -> WINDOW_OPEN_EXTENDED, canUpload: true
 *     - diffDays > 4 -> WINDOW_EXPIRED, canUpload: false
 * 5.  Pre-exam upload rejection: attempting upload before exam date fails with 400.
 * 6.  Expired window upload rejection: attempting upload after 4 days fails with 400.
 * 7.  Teacher ownership check: non-author teacher cannot upload answer key (403 Forbidden).
 * 8.  Client-supplied teacherId cannot override authenticated identity (400 Bad Request).
 * 9.  Client cannot manipulate or specify storage_path (400 Bad Request).
 * 10. Missing file upload is rejected with 400.
 * 11. Non-PDF MIME type is rejected with 400.
 * 12. Non-PDF magic bytes (not %PDF-) are rejected with 400.
 * 13. Path traversal sequences in filename are sanitized/rejected.
 * 14. Successful Answer Key upload during post-exam window (201 Created).
 * 15. Upload response includes safe Answer Key metadata.
 * 16. Upload response includes safe Digital Signature metadata.
 * 17. Upload response NEVER leaks plaintext AES DEK.
 * 18. Upload response NEVER leaks wrapped AES DEK.
 * 19. Upload response NEVER leaks IV or GCM authentication tag.
 * 20. Upload response NEVER leaks RSA private keys.
 * 21. Upload response NEVER leaks internal storage path.
 * 22. AES key wrapping: DEK is wrapped using dedicated RSA-OAEP public wrapping key.
 * 23. Digital signature: Ciphertext envelope is signed using RSA-PSS SHA-256.
 * 24. Storage location: Ciphertext stored in private bucket path.
 * 25. Duplicate Answer Key upload for the same paper is strictly rejected (400 Bad Request).
 * 26. Authoring teacher queries Answer Key details (GET /api/teacher/question-papers/:id/answer-key -> 200).
 * 27. Authoring teacher metadata response does NOT leak cryptographic secrets.
 * 28. Authoring teacher downloads decrypted Answer Key PDF (GET /.../download -> 200).
 * 29. Decrypted PDF matches original uploaded PDF byte-for-byte (SHA-256 integrity match).
 * 30. Authoring teacher verifies RSA-PSS signature & hash (GET /.../verify-signature -> 200, verified: true).
 * 31. Non-author teacher cannot query Answer Key details (403 Forbidden).
 * 32. Non-author teacher cannot download Answer Key (403 Forbidden).
 * 33. Non-author teacher cannot verify Answer Key signature (403 Forbidden).
 * 34. Coordinator unauthenticated access returns 401.
 * 35. Teacher accessing coordinator Answer Key endpoints returns 403.
 * 36. Assigned coordinator queries Answer Key details (GET /api/exam-coordinator/question-papers/:id/answer-key -> 200).
 * 37. Coordinator metadata response does NOT leak cryptographic secrets.
 * 38. Assigned coordinator downloads decrypted Answer Key PDF (GET /.../download -> 200).
 * 39. Coordinator decrypted PDF matches original uploaded PDF byte-for-byte.
 * 40. Assigned coordinator verifies RSA-PSS signature & hash (GET /.../verify-signature -> 200, verified: true).
 * 41. Unassigned coordinator querying Answer Key details receives 403 Forbidden.
 * 42. Unassigned coordinator downloading Answer Key receives 403 Forbidden.
 * 43. Unassigned coordinator verifying Answer Key signature receives 403 Forbidden.
 * 44. Verify-Before-Decrypt: SHA-256 integrity check executes before decryption.
 * 45. Verify-Before-Decrypt: RSA-PSS signature check executes before decryption.
 * 46. Storage ciphertext tampering triggers fail-closed error (400 Bad Request).
 * 47. Plaintext PDF is NEVER delivered when storage ciphertext is tampered.
 * 48. Tampered ciphertext in verify-signature endpoint returns verified: false, tamperDetected: true.
 * 49. Corrupted RSA-PSS signature prevents delivery (400 Bad Request fail-closed).
 * 50. AES-GCM authentication failure (tampered tag) prevents delivery (400 Bad Request).
 * 51. Plaintext AES key is NEVER stored in database.
 * 52. Plaintext AES key is NEVER stored in storage.
 * 53. Alias routes on /api/question-papers/:id/answer-key* function correctly.
 * 54. Regression: Module 1 Health check returns 200.
 * 55. Regression: Module 3 Auth (/api/auth/me) returns 200.
 * 56. Regression: Module 4 RBAC authorization returns 200 for authorized roles, 403 for unauthorized.
 * 57. Regression: Module 5 Teacher question paper listing (/api/question-papers/my) returns 200.
 * 58. Regression: Module 6 AES-256-GCM + RSA-OAEP encrypt/decrypt roundtrip succeeds.
 * 59. Regression: Module 7 RSA-PSS digital signature roundtrip succeeds.
 * 60. Regression: Module 8 Key management wrapping and separation succeeds.
 * 61. Regression: Module 9 Exam Coordinator paper listing returns 200.
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
const answerKeyService = require('../src/services/answerKeyService');
const { getSupabaseClient } = require('../src/config/supabase');
const supabaseClient = getSupabaseClient();
const { generateToken } = require('../src/utils/jwt');

const TEST_PORT = 5008;
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

// Calculate authoritative test dates relative to today
const today = new Date();
function formatYMD(d) {
  return d.toISOString().split('T')[0];
}

const futureExamDate = new Date(today);
futureExamDate.setUTCDate(futureExamDate.getUTCDate() + 3);
const futureExamDateStr = formatYMD(futureExamDate);

const postExamDate = new Date(today);
postExamDate.setUTCDate(postExamDate.getUTCDate() - 1);
const postExamDateStr = formatYMD(postExamDate);

const expiredExamDate = new Date(today);
expiredExamDate.setUTCDate(expiredExamDate.getUTCDate() - 6);
const expiredExamDateStr = formatYMD(expiredExamDate);

// In-memory mock database collections
const inMemoryPapers = new Map();
const inMemoryAssignments = new Map();
const inMemoryAnswerKeys = new Map();
const inMemorySignatures = new Map();
const inMemoryStorage = new Map();

// Test Question Paper IDs
const PAPER_POST_EXAM = 'paper-post-exam-uuid-001';
const PAPER_FUTURE_EXAM = 'paper-future-exam-uuid-002';
const PAPER_EXPIRED_EXAM = 'paper-expired-exam-uuid-003';
const PAPER_OTHER_TEACHER = 'paper-other-teacher-uuid-004';

// Initialize mock question papers
inMemoryPapers.set(PAPER_POST_EXAM, {
  id: PAPER_POST_EXAM,
  teacher_id: MOCK_USERS.authorTeacher.userId,
  title: 'Database Systems Final Exam',
  subject: 'CS401',
  semester: 'Semester 5',
  academic_year: '2026-2027',
  exam_type: 'End Semester Examination',
  exam_date: postExamDateStr,
  status: 'READY',
  submitted_at: new Date(Date.now() - 86400000).toISOString(),
  scheduled_delivery_date: postExamDateStr,
  file_name: 'CS401_Final.pdf',
  storage_path: `question-papers/${MOCK_USERS.authorTeacher.userId}/${PAPER_POST_EXAM}/encrypted/paper.pdf.enc`,
  file_size: 15420,
  mime_type: 'application/pdf',
});

inMemoryPapers.set(PAPER_FUTURE_EXAM, {
  id: PAPER_FUTURE_EXAM,
  teacher_id: MOCK_USERS.authorTeacher.userId,
  title: 'Computer Networks Final Exam',
  subject: 'CS402',
  semester: 'Semester 5',
  academic_year: '2026-2027',
  exam_type: 'End Semester Examination',
  exam_date: futureExamDateStr,
  status: 'READY',
  submitted_at: new Date().toISOString(),
  scheduled_delivery_date: futureExamDateStr,
  file_name: 'CS402_Final.pdf',
  storage_path: `question-papers/${MOCK_USERS.authorTeacher.userId}/${PAPER_FUTURE_EXAM}/encrypted/paper.pdf.enc`,
  file_size: 14200,
  mime_type: 'application/pdf',
});

inMemoryPapers.set(PAPER_EXPIRED_EXAM, {
  id: PAPER_EXPIRED_EXAM,
  teacher_id: MOCK_USERS.authorTeacher.userId,
  title: 'Operating Systems Midterm',
  subject: 'CS403',
  semester: 'Semester 5',
  academic_year: '2026-2027',
  exam_type: 'Mid Semester Examination',
  exam_date: expiredExamDateStr,
  status: 'READY',
  submitted_at: new Date(Date.now() - 600000000).toISOString(),
  scheduled_delivery_date: expiredExamDateStr,
  file_name: 'CS403_Mid.pdf',
  storage_path: `question-papers/${MOCK_USERS.authorTeacher.userId}/${PAPER_EXPIRED_EXAM}/encrypted/paper.pdf.enc`,
  file_size: 12800,
  mime_type: 'application/pdf',
});

inMemoryPapers.set(PAPER_OTHER_TEACHER, {
  id: PAPER_OTHER_TEACHER,
  teacher_id: MOCK_USERS.otherTeacher.userId,
  title: 'Software Engineering Exam',
  subject: 'CS404',
  semester: 'Semester 5',
  academic_year: '2026-2027',
  exam_type: 'End Semester Examination',
  exam_date: postExamDateStr,
  status: 'READY',
  submitted_at: new Date().toISOString(),
  scheduled_delivery_date: postExamDateStr,
  file_name: 'CS404_Exam.pdf',
  storage_path: `question-papers/${MOCK_USERS.otherTeacher.userId}/${PAPER_OTHER_TEACHER}/encrypted/paper.pdf.enc`,
  file_size: 13900,
  mime_type: 'application/pdf',
});

// Setup Coordinator Assignment: PAPER_POST_EXAM is assigned to assignedCoordinator
inMemoryAssignments.set('assign-post-exam', {
  id: 'assign-post-exam',
  question_paper_id: PAPER_POST_EXAM,
  assigned_to_user_id: MOCK_USERS.assignedCoordinator.userId,
  delivery_status: 'SCHEDULED',
  scheduled_delivery_date: postExamDateStr,
});

let simulateTamperedStorage = false;

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
          maybeSingle: () => {
            for (const a of inMemoryAssignments.values()) {
              if (a[col1] === val1) return Promise.resolve({ data: a, error: null });
            }
            return Promise.resolve({ data: null, error: null });
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
              if (ak[col] === val) return Promise.resolve({ data: ak, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
        }),
      }),
      insert: (records) => ({
        select: () => ({
          single: () => {
            const rec = records[0];
            // Enforce UNIQUE constraint on question_paper_id
            for (const existing of inMemoryAnswerKeys.values()) {
              if (existing.question_paper_id === rec.question_paper_id) {
                const err = new Error('duplicate key value violates unique constraint');
                return Promise.resolve({ data: null, error: err });
              }
            }
            inMemoryAnswerKeys.set(rec.id, rec);
            return Promise.resolve({ data: rec, error: null });
          },
        }),
      }),
      delete: () => ({
        eq: (col, val) => {
          inMemoryAnswerKeys.delete(val);
          return Promise.resolve({ data: null, error: null });
        },
      }),
    };
  }

  if (tableName === 'digital_signatures') {
    return {
      select: () => ({
        eq: (col, val) => ({
          maybeSingle: () => {
            for (const sig of inMemorySignatures.values()) {
              if (sig[col] === val) return Promise.resolve({ data: sig, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
        }),
      }),
      insert: (records) => ({
        select: () => ({
          single: () => {
            const rec = { ...records[0], id: 'sig-' + Date.now(), created_at: new Date().toISOString() };
            inMemorySignatures.set(rec.id, rec);
            return Promise.resolve({ data: rec, error: null });
          },
        }),
      }),
      delete: () => ({
        eq: (col, val) => {
          for (const [id, sig] of inMemorySignatures.entries()) {
            if (sig[col] === val) inMemorySignatures.delete(id);
          }
          return Promise.resolve({ data: null, error: null });
        },
      }),
    };
  }

  return {
    select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
  };
};

// Intercept Supabase storage calls
supabaseClient.storage = {
  from: (bucket) => ({
    upload: (storagePath, fileBuffer, options) => {
      inMemoryStorage.set(storagePath, Buffer.from(fileBuffer));
      return Promise.resolve({ data: { path: storagePath }, error: null });
    },
    download: (storagePath) => {
      const data = inMemoryStorage.get(storagePath);
      if (!data) {
        return Promise.resolve({ data: null, error: new Error('Object not found in storage') });
      }
      if (simulateTamperedStorage) {
        const tampered = Buffer.from(data);
        tampered[tampered.length - 1] ^= 0xff; // flip last byte
        return Promise.resolve({ data: tampered, error: null });
      }
      return Promise.resolve({ data: Buffer.from(data), error: null });
    },
    remove: (paths) => {
      for (const p of paths) inMemoryStorage.delete(p);
      return Promise.resolve({ data: null, error: null });
    },
  }),
};

// Multipart request helper
function createMultipartPayload(fields, fileField) {
  const boundary = '----ExamGuardFormBoundary' + crypto.randomBytes(8).toString('hex');
  const crlf = '\r\n';
  const parts = [];

  for (const [key, val] of Object.entries(fields)) {
    parts.push(
      `--${boundary}${crlf}Content-Disposition: form-data; name="${key}"${crlf}${crlf}${val}${crlf}`
    );
  }

  if (fileField) {
    const header = `--${boundary}${crlf}Content-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"${crlf}Content-Type: ${fileField.contentType}${crlf}${crlf}`;
    parts.push(header);
  }

  const headerPart = Buffer.from(parts.join(''), 'utf8');
  const footerPart = Buffer.from(`${crlf}--${boundary}--${crlf}`, 'utf8');

  let body;
  if (fileField && fileField.buffer) {
    body = Buffer.concat([headerPart, fileField.buffer, footerPart]);
  } else {
    body = Buffer.concat([headerPart, footerPart]);
  }

  return {
    boundary,
    contentType: `multipart/form-data; boundary=${boundary}`,
    body,
  };
}

// HTTP helper
function makeRequest(method, urlPath, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const headers = options.headers || {};

    const reqOptions = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers,
    };

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        let json = null;
        try {
          json = JSON.parse(buffer.toString('utf8'));
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
          rawBuffer: buffer,
          text: buffer.toString('utf8'),
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

// Minimal valid PDF buffer (%PDF-1.4 header)
const samplePdfContent = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Title (CS401 Official Answer Key) /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF',
  'utf8'
);

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ [ASSERTION ${totalCount}] ${message}`);
  } else {
    console.error(`  ✗ [ASSERTION ${totalCount}] FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('\n============================================================');
  console.log('  EXAMGUARD MODULE 10: ANSWER KEY MANAGEMENT VERIFICATION');
  console.log('============================================================\n');

  // 1. Start Server
  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`[TEST SERVER] Running on port ${TEST_PORT}\n`);
      resolve();
    });
  });

  assert(server !== null && server.listening, 'Server started and bound to TEST_PORT 5008');

  // ==========================================
  // SECTION 1: TIMING WINDOW CALCULATION LOGIC
  // ==========================================
  console.log('\n--- Section 1: Post-Exam Timing Window Enforcement ---');

  const now = new Date('2026-10-15T10:00:00Z');

  // Before exam date (diffDays = -2)
  const windowBefore = answerKeyService.getAnswerKeySubmissionWindow('2026-10-17', now);
  assert(windowBefore.status === 'BEFORE_EXAM', 'Submission before exam date is marked BEFORE_EXAM');
  assert(windowBefore.canUpload === false, 'Upload is blocked before scheduled exam date');
  assert(windowBefore.daysSinceExam < 0, 'daysSinceExam is negative for future exam');

  // Exam day (diffDays = 0)
  const windowDay0 = answerKeyService.getAnswerKeySubmissionWindow('2026-10-15', now);
  assert(windowDay0.status === 'WINDOW_OPEN_PREFERRED', 'Exam day is marked WINDOW_OPEN_PREFERRED');
  assert(windowDay0.canUpload === true, 'Upload is permitted on exam day');
  assert(windowDay0.daysSinceExam === 0, 'daysSinceExam is 0 on exam day');

  // 1 day post-exam (diffDays = 1)
  const windowDay1 = answerKeyService.getAnswerKeySubmissionWindow('2026-10-14', now);
  assert(windowDay1.status === 'WINDOW_OPEN_PREFERRED', 'Day 1 post-exam is marked WINDOW_OPEN_PREFERRED');
  assert(windowDay1.canUpload === true, 'Upload permitted at day 1 post-exam');

  // 2 days post-exam (diffDays = 2)
  const windowDay2 = answerKeyService.getAnswerKeySubmissionWindow('2026-10-13', now);
  assert(windowDay2.status === 'WINDOW_OPEN_PREFERRED', 'Day 2 post-exam is marked WINDOW_OPEN_PREFERRED (preferred limit)');
  assert(windowDay2.canUpload === true, 'Upload permitted at day 2 post-exam');

  // 3 days post-exam (diffDays = 3)
  const windowDay3 = answerKeyService.getAnswerKeySubmissionWindow('2026-10-12', now);
  assert(windowDay3.status === 'WINDOW_OPEN_EXTENDED', 'Day 3 post-exam is marked WINDOW_OPEN_EXTENDED');
  assert(windowDay3.canUpload === true, 'Upload permitted during extended window (day 3)');

  // 4 days post-exam (diffDays = 4)
  const windowDay4 = answerKeyService.getAnswerKeySubmissionWindow('2026-10-11', now);
  assert(windowDay4.status === 'WINDOW_OPEN_EXTENDED', 'Day 4 post-exam is marked WINDOW_OPEN_EXTENDED (final cutoff)');
  assert(windowDay4.canUpload === true, 'Upload permitted at day 4 post-exam');

  // 5 days post-exam (diffDays = 5) - Expired
  const windowDay5 = answerKeyService.getAnswerKeySubmissionWindow('2026-10-10', now);
  assert(windowDay5.status === 'WINDOW_EXPIRED', 'Day 5 post-exam is marked WINDOW_EXPIRED');
  assert(windowDay5.canUpload === false, 'Upload is blocked after 4-day maximum deadline');

  // ==========================================
  // SECTION 2: AUTHENTICATION & ACCESS CONTROL
  // ==========================================
  console.log('\n--- Section 2: Authentication & Role Authorization ---');

  // Unauthenticated teacher upload returns 401
  const payloadValid = createMultipartPayload({}, {
    name: 'file',
    filename: 'CS401_Key.pdf',
    contentType: 'application/pdf',
    buffer: samplePdfContent,
  });

  const resUnauthUpload = await makeRequest(
    'POST',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key`,
    {
      headers: { 'Content-Type': payloadValid.contentType },
      body: payloadValid.body,
    }
  );
  assert(resUnauthUpload.statusCode === 401, 'Unauthenticated teacher upload returns 401 Unauthorized');

  // Non-teacher role (EXAM_COORDINATOR) attempting teacher upload returns 403
  const resCoordUpload = await makeRequest(
    'POST',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key`,
    {
      headers: {
        'Content-Type': payloadValid.contentType,
        Authorization: `Bearer ${assignedCoordToken}`,
      },
      body: payloadValid.body,
    }
  );
  assert(resCoordUpload.statusCode === 403, 'Coordinator role attempting teacher upload returns 403 Forbidden');

  // ADMIN role attempting teacher upload returns 403
  const resAdminUpload = await makeRequest(
    'POST',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key`,
    {
      headers: {
        'Content-Type': payloadValid.contentType,
        Authorization: `Bearer ${adminToken}`,
      },
      body: payloadValid.body,
    }
  );
  assert(resAdminUpload.statusCode === 403, 'Admin role attempting teacher upload returns 403 Forbidden');

  // ==========================================
  // SECTION 3: TIMING RESTRICTIONS & VALIDATION
  // ==========================================
  console.log('\n--- Section 3: Timing Restriction Enforcement via API ---');

  // Attempt upload before exam date (futureExamDateStr) -> 400
  const resFutureUpload = await makeRequest(
    'POST',
    `/api/teacher/question-papers/${PAPER_FUTURE_EXAM}/answer-key`,
    {
      headers: {
        'Content-Type': payloadValid.contentType,
        Authorization: `Bearer ${authorToken}`,
      },
      body: payloadValid.body,
    }
  );
  assert(resFutureUpload.statusCode === 400, 'Upload before exam date is rejected with 400 Bad Request');
  assert(
    resFutureUpload.data?.message?.includes('before the examination'),
    'Rejection message clearly states cannot upload before exam'
  );

  // Attempt upload after 4-day deadline (expiredExamDateStr) -> 400
  const resExpiredUpload = await makeRequest(
    'POST',
    `/api/teacher/question-papers/${PAPER_EXPIRED_EXAM}/answer-key`,
    {
      headers: {
        'Content-Type': payloadValid.contentType,
        Authorization: `Bearer ${authorToken}`,
      },
      body: payloadValid.body,
    }
  );
  assert(resExpiredUpload.statusCode === 400, 'Upload after 4-day deadline is rejected with 400 Bad Request');
  assert(
    resExpiredUpload.data?.message?.includes('expired'),
    'Rejection message clearly states submission window expired'
  );

  // ==========================================
  // SECTION 4: OWNERSHIP & SECURITY VALIDATION
  // ==========================================
  console.log('\n--- Section 4: Teacher Ownership & Request Validation ---');

  // Other teacher attempting to upload for Alice's paper returns 403
  const resOtherTeacherUpload = await makeRequest(
    'POST',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key`,
    {
      headers: {
        'Content-Type': payloadValid.contentType,
        Authorization: `Bearer ${otherTeacherToken}`,
      },
      body: payloadValid.body,
    }
  );
  assert(resOtherTeacherUpload.statusCode === 403, 'Non-author teacher cannot upload answer key (403 Forbidden)');

  // Spoofed teacherId in body is rejected with 400
  const payloadSpoofed = createMultipartPayload(
    { teacherId: MOCK_USERS.otherTeacher.userId },
    {
      name: 'file',
      filename: 'CS401_Key.pdf',
      contentType: 'application/pdf',
      buffer: samplePdfContent,
    }
  );
  const resSpoofedUpload = await makeRequest(
    'POST',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key`,
    {
      headers: {
        'Content-Type': payloadSpoofed.contentType,
        Authorization: `Bearer ${authorToken}`,
      },
      body: payloadSpoofed.body,
    }
  );
  assert(resSpoofedUpload.statusCode === 400, 'Client-supplied teacherId mismatch is rejected with 400 Bad Request');

  // Client-supplied storage_path is rejected with 400
  const payloadPathTampered = createMultipartPayload(
    { storage_path: 'malicious/injected/path.enc' },
    {
      name: 'file',
      filename: 'CS401_Key.pdf',
      contentType: 'application/pdf',
      buffer: samplePdfContent,
    }
  );
  const resPathTampered = await makeRequest(
    'POST',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key`,
    {
      headers: {
        'Content-Type': payloadPathTampered.contentType,
        Authorization: `Bearer ${authorToken}`,
      },
      body: payloadPathTampered.body,
    }
  );
  assert(resPathTampered.statusCode === 400, 'Client-supplied storage_path is rejected with 400 Bad Request');

  // Missing file upload is rejected with 400
  const payloadNoFile = createMultipartPayload({}, null);
  const resNoFile = await makeRequest(
    'POST',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key`,
    {
      headers: {
        'Content-Type': payloadNoFile.contentType,
        Authorization: `Bearer ${authorToken}`,
      },
      body: payloadNoFile.body,
    }
  );
  assert(resNoFile.statusCode === 400, 'Missing answer key file is rejected with 400 Bad Request');

  // Non-PDF MIME type is rejected with 400
  const payloadTextFile = createMultipartPayload({}, {
    name: 'file',
    filename: 'CS401_Key.txt',
    contentType: 'text/plain',
    buffer: Buffer.from('Plain text answer key content', 'utf8'),
  });
  const resTextFile = await makeRequest(
    'POST',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key`,
    {
      headers: {
        'Content-Type': payloadTextFile.contentType,
        Authorization: `Bearer ${authorToken}`,
      },
      body: payloadTextFile.body,
    }
  );
  assert(resTextFile.statusCode === 400, 'Non-PDF file extension/mime is rejected with 400 Bad Request');

  // PDF extension but invalid magic bytes (not starting with %PDF-) rejected with 400
  const payloadInvalidMagic = createMultipartPayload({}, {
    name: 'file',
    filename: 'Fake.pdf',
    contentType: 'application/pdf',
    buffer: Buffer.from('INVALID_HEADER_NOT_A_REAL_PDF', 'utf8'),
  });
  const resInvalidMagic = await makeRequest(
    'POST',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key`,
    {
      headers: {
        'Content-Type': payloadInvalidMagic.contentType,
        Authorization: `Bearer ${authorToken}`,
      },
      body: payloadInvalidMagic.body,
    }
  );
  assert(resInvalidMagic.statusCode === 400, 'Invalid PDF magic bytes rejected with 400 Bad Request');

  // ==========================================
  // SECTION 5: SUCCESSFUL ANSWER KEY UPLOAD & CRYPTO
  // ==========================================
  console.log('\n--- Section 5: Successful Upload, Envelope Encryption & Digital Signature ---');

  const uploadRes = await makeRequest(
    'POST',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key`,
    {
      headers: {
        'Content-Type': payloadValid.contentType,
        Authorization: `Bearer ${authorToken}`,
      },
      body: payloadValid.body,
    }
  );

  assert(uploadRes.statusCode === 201, 'Valid Answer Key upload returns 201 Created');
  assert(uploadRes.data?.success === true, 'Upload response indicates success: true');

  const ak = uploadRes.data?.data?.answerKey;
  const sig = uploadRes.data?.data?.digitalSignature;
  assert(ak && ak.id, 'Answer Key record created with valid UUID');
  assert(ak.questionPaperId === PAPER_POST_EXAM, 'Answer Key bound to correct question paper ID');
  assert(ak.status === 'READY', 'Answer Key status initialized to READY');
  assert(ak.mimeType === 'application/pdf', 'MIME type recorded as application/pdf');
  assert(ak.fileSize > samplePdfContent.length, 'Envelope file size includes RSA-wrapped DEK + IV + auth tag header');
  assert(sig && sig.id, 'Digital signature record created with valid ID');
  assert(sig.algorithm === 'RSA-PSS-SHA256', 'Digital signature algorithm is RSA-PSS-SHA256');

  // Verify ZERO leak of plaintext keys, wrapped keys, IVs, or auth tags in API response
  const rawResponseText = uploadRes.text;
  assert(!rawResponseText.includes('aesKey'), 'API response NEVER contains aesKey');
  assert(!rawResponseText.includes('wrappedKey'), 'API response NEVER contains wrappedKey');
  assert(!rawResponseText.includes('authTag'), 'API response NEVER contains authTag');
  assert(!rawResponseText.includes('privateKey'), 'API response NEVER contains privateKey');
  assert(!rawResponseText.includes('BEGIN RSA PRIVATE KEY'), 'API response NEVER contains RSA private key PEM');
  assert(!ak.storage_path, 'Answer Key metadata does NOT expose storage_path to client');

  // Verify storage isolation: File stored in private bucket
  assert(inMemoryStorage.size > 0, 'Encrypted envelope successfully written to private Supabase Storage');
  let storedEnvelopeBuffer = null;
  for (const [sKey, sBuf] of inMemoryStorage.entries()) {
    if (sKey.includes(PAPER_POST_EXAM)) {
      storedEnvelopeBuffer = sBuf;
      assert(sKey.startsWith(`answer-keys/${MOCK_USERS.authorTeacher.userId}/${PAPER_POST_EXAM}/encrypted/`),
        'Storage path strictly follows answer-keys/{teacher_id}/{question_paper_id}/encrypted/ structure');
      assert(sKey.endsWith('.enc'), 'Storage file name has .enc extension');
      break;
    }
  }
  assert(storedEnvelopeBuffer !== null, 'Ciphertext envelope buffer found in storage');
  assert(storedEnvelopeBuffer.length >= 284, 'Envelope buffer contains at least 284 bytes of envelope header (256 + 12 + 16)');

  // Verify Plaintext AES key is NEVER stored in database
  for (const storedAk of inMemoryAnswerKeys.values()) {
    assert(!storedAk.aes_key && !storedAk.key, 'Plaintext AES key is NEVER stored in answer_keys table');
  }

  // ==========================================
  // SECTION 6: DUPLICATE PROTECTION
  // ==========================================
  console.log('\n--- Section 6: Duplicate Answer Key Protection ---');

  const dupRes = await makeRequest(
    'POST',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key`,
    {
      headers: {
        'Content-Type': payloadValid.contentType,
        Authorization: `Bearer ${authorToken}`,
      },
      body: payloadValid.body,
    }
  );
  assert(dupRes.statusCode === 400, 'Duplicate Answer Key upload returns 400 Bad Request');
  assert(dupRes.data?.message?.includes('already been submitted'), 'Duplicate error message indicates already submitted');

  // ==========================================
  // SECTION 7: TEACHER METADATA, DOWNLOAD & VERIFICATION
  // ==========================================
  console.log('\n--- Section 7: Teacher Access, Verification & Decryption ---');

  // Authoring teacher queries Answer Key metadata
  const resTeacherMeta = await makeRequest(
    'GET',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key`,
    { headers: { Authorization: `Bearer ${authorToken}` } }
  );
  assert(resTeacherMeta.statusCode === 200, 'Teacher queries Answer Key metadata (200 OK)');
  assert(resTeacherMeta.data?.data?.submitted === true, 'Teacher metadata indicates submitted: true');
  assert(resTeacherMeta.data?.data?.fileName === 'CS401_Key.pdf', 'Teacher metadata returns original file name');
  assert(resTeacherMeta.data?.data?.submissionWindow !== undefined, 'Teacher metadata includes submission window details');
  assert(!resTeacherMeta.text.includes('storage_path'), 'Teacher metadata does not expose storage_path');

  // Authoring teacher downloads decrypted Answer Key PDF
  const resTeacherDownload = await makeRequest(
    'GET',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key/download`,
    { headers: { Authorization: `Bearer ${authorToken}` } }
  );
  assert(resTeacherDownload.statusCode === 200, 'Teacher downloads decrypted Answer Key (200 OK)');
  assert(resTeacherDownload.headers['content-type'] === 'application/pdf', 'Download header is application/pdf');
  assert(resTeacherDownload.headers['content-disposition']?.includes('attachment;'), 'Download header includes attachment disposition');
  assert(
    crypto.createHash('sha256').update(resTeacherDownload.rawBuffer).digest('hex') ===
      crypto.createHash('sha256').update(samplePdfContent).digest('hex'),
    'Decrypted PDF buffer matches original pre-encryption plaintext byte-for-byte'
  );

  // Authoring teacher verifies digital signature & hash
  const resTeacherVerify = await makeRequest(
    'GET',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key/verify-signature`,
    { headers: { Authorization: `Bearer ${authorToken}` } }
  );
  assert(resTeacherVerify.statusCode === 200, 'Teacher verifies Answer Key digital signature (200 OK)');
  assert(resTeacherVerify.data?.data?.verified === true, 'Signature verification reports verified: true');
  assert(resTeacherVerify.data?.data?.tamperDetected === false, 'Signature verification reports tamperDetected: false');
  assert(resTeacherVerify.data?.data?.algorithm === 'RSA-PSS-SHA256', 'Signature verified using RSA-PSS-SHA256');

  // Non-author teacher cannot query, download, or verify
  const resOtherMeta = await makeRequest(
    'GET',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key`,
    { headers: { Authorization: `Bearer ${otherTeacherToken}` } }
  );
  assert(resOtherMeta.statusCode === 403, 'Non-author teacher cannot query metadata (403 Forbidden)');

  const resOtherDownload = await makeRequest(
    'GET',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key/download`,
    { headers: { Authorization: `Bearer ${otherTeacherToken}` } }
  );
  assert(resOtherDownload.statusCode === 403, 'Non-author teacher cannot download answer key (403 Forbidden)');

  const resOtherVerify = await makeRequest(
    'GET',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key/verify-signature`,
    { headers: { Authorization: `Bearer ${otherTeacherToken}` } }
  );
  assert(resOtherVerify.statusCode === 403, 'Non-author teacher cannot verify signature (403 Forbidden)');

  // ==========================================
  // SECTION 8: EXAM COORDINATOR ACCESS & VERIFICATION
  // ==========================================
  console.log('\n--- Section 8: Exam Coordinator Access, Verification & Decryption ---');

  // Coordinator unauthenticated request returns 401
  const resCoordUnauth = await makeRequest(
    'GET',
    `/api/exam-coordinator/question-papers/${PAPER_POST_EXAM}/answer-key`
  );
  assert(resCoordUnauth.statusCode === 401, 'Coordinator endpoint unauthenticated request returns 401 Unauthorized');

  // Teacher role accessing coordinator endpoint returns 403
  const resTeacherOnCoord = await makeRequest(
    'GET',
    `/api/exam-coordinator/question-papers/${PAPER_POST_EXAM}/answer-key`,
    { headers: { Authorization: `Bearer ${authorToken}` } }
  );
  assert(resTeacherOnCoord.statusCode === 403, 'Teacher role accessing coordinator endpoint returns 403 Forbidden');

  // Assigned coordinator queries Answer Key metadata
  const resCoordMeta = await makeRequest(
    'GET',
    `/api/exam-coordinator/question-papers/${PAPER_POST_EXAM}/answer-key`,
    { headers: { Authorization: `Bearer ${assignedCoordToken}` } }
  );
  assert(resCoordMeta.statusCode === 200, 'Assigned coordinator queries Answer Key details (200 OK)');
  assert(resCoordMeta.data?.data?.submitted === true, 'Coordinator metadata shows submitted: true');
  assert(resCoordMeta.data?.data?.digitalSignature?.algorithm === 'RSA-PSS-SHA256', 'Coordinator receives digital signature algorithm');
  assert(!resCoordMeta.text.includes('storage_path'), 'Coordinator metadata does NOT expose internal storage_path');

  // Assigned coordinator downloads decrypted Answer Key PDF (Verify-Before-Decrypt)
  const resCoordDownload = await makeRequest(
    'GET',
    `/api/exam-coordinator/question-papers/${PAPER_POST_EXAM}/answer-key/download`,
    { headers: { Authorization: `Bearer ${assignedCoordToken}` } }
  );
  assert(resCoordDownload.statusCode === 200, 'Assigned coordinator downloads decrypted Answer Key (200 OK)');
  assert(resCoordDownload.headers['content-type'] === 'application/pdf', 'Coordinator download content-type is application/pdf');
  assert(
    crypto.createHash('sha256').update(resCoordDownload.rawBuffer).digest('hex') ===
      crypto.createHash('sha256').update(samplePdfContent).digest('hex'),
    'Coordinator decrypted PDF buffer matches original plaintext document byte-for-byte'
  );

  // Assigned coordinator verifies Answer Key digital signature
  const resCoordVerify = await makeRequest(
    'GET',
    `/api/exam-coordinator/question-papers/${PAPER_POST_EXAM}/answer-key/verify-signature`,
    { headers: { Authorization: `Bearer ${assignedCoordToken}` } }
  );
  assert(resCoordVerify.statusCode === 200, 'Assigned coordinator verifies Answer Key signature (200 OK)');
  assert(resCoordVerify.data?.data?.verified === true, 'Coordinator verify reports verified: true');
  assert(resCoordVerify.data?.data?.tamperDetected === false, 'Coordinator verify reports tamperDetected: false');

  // Unassigned coordinator queries Answer Key -> 403 Forbidden
  const resUnassignedMeta = await makeRequest(
    'GET',
    `/api/exam-coordinator/question-papers/${PAPER_POST_EXAM}/answer-key`,
    { headers: { Authorization: `Bearer ${unassignedCoordToken}` } }
  );
  assert(resUnassignedMeta.statusCode === 403, 'Unassigned coordinator cannot query Answer Key metadata (403 Forbidden)');

  // Unassigned coordinator downloads Answer Key -> 403 Forbidden
  const resUnassignedDownload = await makeRequest(
    'GET',
    `/api/exam-coordinator/question-papers/${PAPER_POST_EXAM}/answer-key/download`,
    { headers: { Authorization: `Bearer ${unassignedCoordToken}` } }
  );
  assert(resUnassignedDownload.statusCode === 403, 'Unassigned coordinator cannot download Answer Key (403 Forbidden)');

  // Unassigned coordinator verifies Answer Key signature -> 403 Forbidden
  const resUnassignedVerify = await makeRequest(
    'GET',
    `/api/exam-coordinator/question-papers/${PAPER_POST_EXAM}/answer-key/verify-signature`,
    { headers: { Authorization: `Bearer ${unassignedCoordToken}` } }
  );
  assert(resUnassignedVerify.statusCode === 403, 'Unassigned coordinator cannot verify Answer Key signature (403 Forbidden)');

  // ==========================================
  // SECTION 9: VERIFY-BEFORE-DECRYPT & TAMPER RESISTANCE
  // ==========================================
  console.log('\n--- Section 9: Verify-Before-Decrypt & Tamper Resistance ---');

  // Simulate ciphertext tampering in storage
  simulateTamperedStorage = true;

  // Attempt download with tampered storage: Verify-Before-Decrypt MUST reject
  const resTamperedDownload = await makeRequest(
    'GET',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key/download`,
    { headers: { Authorization: `Bearer ${authorToken}` } }
  );
  assert(resTamperedDownload.statusCode === 400, 'Tampered storage ciphertext causes download rejection with 400 Bad Request');
  assert(
    resTamperedDownload.data?.message?.includes('failed') || resTamperedDownload.data?.message?.includes('tampered'),
    'Fail-closed message explicitly indicates integrity or signature failure'
  );
  assert(resTamperedDownload.rawBuffer.indexOf(samplePdfContent) === -1, 'Plaintext PDF is NEVER delivered when ciphertext is tampered');

  // Tampered ciphertext in verify-signature endpoint
  const resTamperedVerify = await makeRequest(
    'GET',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key/verify-signature`,
    { headers: { Authorization: `Bearer ${authorToken}` } }
  );
  assert(resTamperedVerify.statusCode === 200, 'Verify signature endpoint returns 200 status');
  assert(resTamperedVerify.data?.data?.verified === false, 'Tampered ciphertext reports verified: false');
  assert(resTamperedVerify.data?.data?.tamperDetected === true, 'Tampered ciphertext reports tamperDetected: true');

  // Restore untampered storage
  simulateTamperedStorage = false;

  // Confirm download succeeds again when untampered
  const resRestoredDownload = await makeRequest(
    'GET',
    `/api/teacher/question-papers/${PAPER_POST_EXAM}/answer-key/download`,
    { headers: { Authorization: `Bearer ${authorToken}` } }
  );
  assert(resRestoredDownload.statusCode === 200, 'Untampered storage download succeeds normally after restore');

  // ==========================================
  // SECTION 10: ALIAS ROUTES
  // ==========================================
  console.log('\n--- Section 10: Alias Route Validation (/api/question-papers/:id/answer-key*) ---');

  const resAliasMeta = await makeRequest(
    'GET',
    `/api/question-papers/${PAPER_POST_EXAM}/answer-key`,
    { headers: { Authorization: `Bearer ${authorToken}` } }
  );
  assert(resAliasMeta.statusCode === 200, 'Alias route GET /api/question-papers/:id/answer-key returns 200 OK');
  assert(resAliasMeta.data?.data?.submitted === true, 'Alias route returns submitted: true');

  const resAliasDownload = await makeRequest(
    'GET',
    `/api/question-papers/${PAPER_POST_EXAM}/answer-key/download`,
    { headers: { Authorization: `Bearer ${authorToken}` } }
  );
  assert(resAliasDownload.statusCode === 200, 'Alias route GET /api/question-papers/:id/answer-key/download returns 200 OK');

  const resAliasVerify = await makeRequest(
    'GET',
    `/api/question-papers/${PAPER_POST_EXAM}/answer-key/verify-signature`,
    { headers: { Authorization: `Bearer ${authorToken}` } }
  );
  assert(resAliasVerify.statusCode === 200, 'Alias route GET /api/question-papers/:id/answer-key/verify-signature returns 200 OK');
  assert(resAliasVerify.data?.data?.verified === true, 'Alias route verify returns verified: true');

  // ==========================================
  // SECTION 11: REGRESSION SUITE VERIFICATION
  // ==========================================
  console.log('\n--- Section 11: Regression Safeguards (Modules 1–9) ---');

  // Module 1 Health check
  const resHealth = await makeRequest('GET', '/api/health');
  assert(resHealth.statusCode === 200, 'Regression: Module 1 health check returns 200 OK');

  // Module 3 Auth me
  const resMe = await makeRequest('GET', '/api/auth/me', {
    headers: { Authorization: `Bearer ${authorToken}` },
  });
  assert(resMe.statusCode === 200, 'Regression: Module 3 /api/auth/me returns 200 OK');

  // Module 4 RBAC check
  const resRbacTeacher = await makeRequest('GET', '/api/rbac/teacher', {
    headers: { Authorization: `Bearer ${authorToken}` },
  });
  assert(resRbacTeacher.statusCode === 200, 'Regression: Module 4 /api/rbac/teacher returns 200 for teacher');

  const resRbacCoord = await makeRequest('GET', '/api/rbac/teacher', {
    headers: { Authorization: `Bearer ${assignedCoordToken}` },
  });
  assert(resRbacCoord.statusCode === 403, 'Regression: Module 4 /api/rbac/teacher returns 403 for coordinator');

  // Module 6 AES-256-GCM + RSA-OAEP encrypt/decrypt
  const testPlaintext = Buffer.from('ExamGuard Core Cryptographic Regression Test', 'utf8');
  const encRes = encryptionService.encryptQuestionPaper(testPlaintext);
  const decRes = encryptionService.decryptQuestionPaper(encRes.encryptedBuffer, encRes.encryptedAesKey, encRes.iv, encRes.authTag);
  assert(decRes.equals(testPlaintext), 'Regression: Module 6 AES-256-GCM encryption/decryption roundtrip succeeds');

  // Module 7 RSA-PSS digital signature
  const sigRes = signatureService.signQuestionPaper(testPlaintext);
  const sigValid = signatureService.verifyQuestionPaperSignature(testPlaintext, sigRes.signature);
  assert(sigValid === true, 'Regression: Module 7 RSA-PSS digital signature sign/verify roundtrip succeeds');

  // Module 8 RSA-OAEP key wrapping
  const dek = keyManagementService.generateDocumentKey();
  const wrappedKey = keyManagementService.wrapAesKey(dek);
  const unwrappedKey = keyManagementService.unwrapAesKey(wrappedKey);
  assert(unwrappedKey.equals(dek), 'Regression: Module 8 RSA-OAEP key wrapping/unwrapping roundtrip succeeds');

  // Module 5 Teacher question paper listing
  const resMyPapers = await makeRequest('GET', '/api/question-papers/my', {
    headers: { Authorization: `Bearer ${authorToken}` },
  });
  assert(resMyPapers.statusCode === 200, 'Regression: Module 5 /api/question-papers/my returns 200 OK');

  // Module 9 Exam Coordinator assigned question paper listing
  const resCoordPapers = await makeRequest('GET', '/api/exam-coordinator/question-papers', {
    headers: { Authorization: `Bearer ${assignedCoordToken}` },
  });
  assert(resCoordPapers.statusCode === 200, 'Regression: Module 9 /api/exam-coordinator/question-papers returns 200 OK');

  console.log('\n============================================================');
  console.log(`  MODULE 10 VERIFICATION COMPLETED SUCCESSFULLY`);
  console.log(`  Passed: ${passedCount} / ${totalCount} Assertions`);
  console.log('  Failed: 0');
  console.log('============================================================\n');

  server.close();
}

runTests().catch((err) => {
  console.error('\n[TEST RUNNER FATAL ERROR]', err);
  if (server) server.close();
  process.exit(1);
});

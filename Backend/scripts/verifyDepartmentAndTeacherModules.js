/**
 * verifyDepartmentAndTeacherModules.js
 * Comprehensive unit and integration verification for:
 * - Module 1: Strict Department of Computer Engineering Enforcement
 * - Module 2: Teacher Profile & Dashboard isolation
 * - Module 4: Secure Image Handling & Magic Byte Validation
 * - Module 5: Verification workflow & history logging
 * - Module 6: Cryptographic integrity & PDF header formatting
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

async function runTests() {
  console.log('===============================================================');
  console.log(' EXAMGUARD — MODULE 1-13 MASTER VERIFICATION SUITE');
  console.log(' Department of Computer Engineering Hardening & Teacher Workspace');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      console.error(`         ${err.message}`);
    }
  }

  async function testAsync(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  [PASS] Test ${total}: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  [FAIL] Test ${total}: ${name}`);
      console.error(`         ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // Test 1: academicMasterService - COMP Department restriction
  // -------------------------------------------------------------
  const academicMasterService = require('../src/services/academicMasterService');

  await testAsync('academicMasterService.getDepartments() returns strictly COMP', async () => {
    const depts = await academicMasterService.getDepartments();
    assert(Array.isArray(depts), 'Departments must be an array');
    assert.strictEqual(depts.length, 1, 'Should contain exactly 1 department');
    assert.strictEqual(depts[0].code, 'COMP', 'Department code must be COMP');
    assert.strictEqual(depts[0].name, 'Department of Computer Engineering', 'Department name must be Department of Computer Engineering');
  });

  await testAsync('academicMasterService.getCourses() returns only COMP courses', async () => {
    const courses = await academicMasterService.getCourses();
    assert(courses.length > 0, 'Must return COMP courses');
    for (const c of courses) {
      assert.strictEqual(c.departmentCode, 'COMP', `Course ${c.code} must belong to COMP`);
    }
  });

  await testAsync('academicMasterService.getCourses(nonCOMP) returns empty list', async () => {
    const courses = await academicMasterService.getCourses('IT');
    assert.strictEqual(courses.length, 0, 'Non-COMP courses must not be returned');
  });

  // -------------------------------------------------------------
  // Test 2: uploadMiddleware - Magic bytes validation
  // -------------------------------------------------------------
  const { validateImageBuffer } = require('../src/middleware/uploadMiddleware');

  test('validateImageBuffer accepts genuine PNG magic bytes', () => {
    // PNG signature: 89 50 4E 47 0D 0A 1A 0A
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
    const result = validateImageBuffer(pngBuffer, 'image/png');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.detectedType, 'image/png');
  });

  test('validateImageBuffer accepts genuine JPEG magic bytes', () => {
    // JPEG signature: FF D8 FF
    const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    const result = validateImageBuffer(jpegBuffer, 'image/jpeg');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.detectedType, 'image/jpeg');
  });

  test('validateImageBuffer accepts genuine WebP magic bytes', () => {
    // WebP signature: RIFF ... WEBP
    const webpBuffer = Buffer.concat([
      Buffer.from('RIFF'),
      Buffer.from([0x00, 0x00, 0x00, 0x00]),
      Buffer.from('WEBP'),
      Buffer.from('VP8 ')
    ]);
    const result = validateImageBuffer(webpBuffer, 'image/webp');
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.detectedType, 'image/webp');
  });

  test('validateImageBuffer rejects spoofed file with fake extension (e.g. MZ PE executable)', () => {
    // Windows PE / EXE signature: 4D 5A (MZ)
    const exeBuffer = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const result = validateImageBuffer(exeBuffer, 'image/png');
    assert.strictEqual(result.isValid, false, 'Spoofed executable pretending to be PNG must be rejected');
  });

  test('validateImageBuffer rejects empty or truncated buffer', () => {
    const emptyBuffer = Buffer.alloc(0);
    const result = validateImageBuffer(emptyBuffer, 'image/png');
    assert.strictEqual(result.isValid, false);
  });

  // -------------------------------------------------------------
  // Test 3: authService - Teacher Profile Isolation & Locked Dept
  // -------------------------------------------------------------
  const authService = require('../src/services/authService');

  await testAsync('authService.getOrCreateTeacherProfile initializes profile with locked COMP department', async () => {
    const dummyUser = {
      id: 'test-teacher-uuid-001',
      name: 'Prof. Ada Lovelace',
      email: 'ada.lovelace@university.edu',
      role: 'TEACHER',
      status: 'ACTIVE'
    };

    const profile = await authService.getOrCreateTeacherProfile(dummyUser.id, dummyUser);
    assert(profile, 'Profile must be returned');
    assert.strictEqual(profile.department, 'Department of Computer Engineering', 'Department must be locked to Computer Engineering');
    assert(profile.facultyId, 'Faculty ID must be generated');
  });

  await testAsync('authService.updateTeacherProfile prevents changing department to non-COMP', async () => {
    const updated = await authService.updateTeacherProfile('test-teacher-uuid-001', {
      designation: 'Associate Professor',
      department: 'Electrical Engineering', // Attempted override
      specialization: 'Distributed Systems'
    });

    assert.strictEqual(updated.department, 'Department of Computer Engineering', 'Department must remain Department of Computer Engineering despite override attempt');
    assert.strictEqual(updated.designation, 'Associate Professor');
  });

  // -------------------------------------------------------------
  // Test 4: PDF Generation with Computer Engineering Department Branding
  // -------------------------------------------------------------
  const pdfRendererService = require('../src/services/pdfRendererService');

  await testAsync('pdfRendererService generates valid PDF buffer with Department of Computer Engineering', async () => {
    const mockPaper = {
      title: 'Advanced Database Systems Final Exam',
      course_name: 'TE Computer Engineering',
      course_code: 'COMP-301',
      pattern: '2019_PATTERN',
      exam_type: 'END_SEM',
      duration_minutes: 180,
      total_marks: 100,
      instructions: ['All questions are compulsory.', 'Neat diagrams must be drawn wherever necessary.'],
      sections: [
        {
          title: 'Section I - Theory & Relational Calculus',
          instructions: 'Answer all questions',
          questions: [
            {
              id: 'q1',
              number: 'Q1',
              text: 'Explain ACID properties with real-world examples in financial systems.',
              marks: 10,
              type: 'THEORY',
              subquestions: [
                {
                  id: 'q1_a',
                  subNumber: '(a)',
                  text: 'Define Isolation levels in SQL standard.',
                  marks: 5
                }
              ]
            }
          ]
        }
      ]
    };

    const pdfBuffer = await pdfRendererService.renderQuestionPaperPDF(mockPaper, { includeWatermark: true });
    assert(Buffer.isBuffer(pdfBuffer), 'Output must be a Buffer');
    assert(pdfBuffer.length > 500, 'PDF buffer must have meaningful size');
    // PDF Magic bytes: %PDF
    assert.strictEqual(pdfBuffer.slice(0, 4).toString('utf-8'), '%PDF', 'Output must start with %PDF header');
  });

  // -------------------------------------------------------------
  // Test 5: questionPaperService - Verification History Logging
  // -------------------------------------------------------------
  const questionPaperService = require('../src/services/questionPaperService');

  await testAsync('questionPaperService exports getPaperVerificationHistory', async () => {
    assert(typeof questionPaperService.getPaperVerificationHistory === 'function', 'getPaperVerificationHistory function must be exported');
    const history = await questionPaperService.getPaperVerificationHistory('non-existent-id');
    assert(Array.isArray(history), 'History must return an array');
  });

  console.log('\n===============================================================');
  console.log(` SUMMARY: ${passed}/${total} TESTS PASSED`);
  console.log('===============================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

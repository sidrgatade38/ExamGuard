const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const academicMasterService = require('../src/services/academicMasterService');
const draftService = require('../src/services/draftService');
const questionBankService = require('../src/services/questionBankService');
const auditLogService = require('../src/services/auditLogService');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runSprintVerification() {
  console.log('\n======================================================');
  console.log('  EXAMGUARD SINGLE SPRINT MASTER VERIFICATION SUITE');
  console.log('======================================================\n');

  // Test 1: Department Constraint (Only COMP)
  console.log('[1. Department & Academic Architecture Restriction]');
  const depts = await academicMasterService.getDepartments();
  const compOnly = depts.filter(d => d.is_active !== false);
  assert(compOnly.length === 1 && compOnly[0].code === 'COMP', 'Only Department of Computer Engineering is active');

  // Test 2: Academic Patterns (2019, 2024, 2025)
  console.log('\n[2. Academic Patterns (2019, 2024, 2025)]');
  const patterns = await academicMasterService.getPatterns();
  const patCodes = patterns.map(p => p.code);
  assert(patCodes.includes('PAT_2019'), '2019 Pattern is present and active');
  assert(patCodes.some(c => c.includes('2024')), '2024 NEP Pattern is present and active');
  assert(patCodes.includes('PAT_2025'), '2025 Pattern is present and active');
  assert(!patCodes.includes('PAT_2015'), '2015 Pattern is removed/deactivated');

  // Test 3: Four Years of Engineering Subjects Catalog
  console.log('\n[3. Four Years Computer Engineering Subjects]');
  const subjects = await academicMasterService.getSubjects({ departmentCode: 'COMP' });
  assert(subjects.length >= 25, `Subject catalog contains ${subjects.length} official Computer Engineering subjects`);
  const codes = subjects.map(s => s.code);
  assert(codes.includes('310243'), 'SPOS (310243) present');
  assert(codes.includes('310241'), 'DBMS (310241) present');
  assert(codes.includes('310242'), 'CNS (310242) present');
  assert(codes.includes('310252'), 'WT (310252) present');
  assert(codes.includes('410241'), 'DAA (410241) present');

  // Test 4: Dynamic Designations CRUD
  console.log('\n[4. Dynamic Designations Management]');
  const designations = await academicMasterService.getDesignations();
  const dNames = designations.map(d => typeof d === 'string' ? d : d.name);
  assert(dNames.includes('Assistant Professor'), 'Assistant Professor designation supported');
  assert(dNames.includes('Professor'), 'Professor designation supported');
  assert(dNames.includes('Associate Professor'), 'Associate Professor designation supported');
  assert(dNames.includes('Lecturer'), 'Lecturer designation supported');

  // Test 5: Draft Service Exact Marks & Structure Persistence
  console.log('\n[5. Draft Persistence & Exact Restoration]');
  const mock30Draft = {
    userId: '00000000-0000-0000-0000-000000000001',
    subject: 'Systems Programming and Operating System',
    classYear: 'SE',
    semester: 'Semester 4',
    academicPattern: '2024',
    totalMarks: 30,
    durationHours: 1.0,
    blueprint: {
      subject: 'Systems Programming and Operating System',
      totalMarks: 30,
      classYear: 'SE',
      semester: 'Semester 4',
      academicPattern: '2024',
      sections: [{ groupOrder: 1, targetMarks: 15 }, { groupOrder: 2, targetMarks: 15 }]
    }
  };
  const formattedDraft = draftService.formatDraftRecord({
    id: 'test-draft-uuid',
    user_id: mock30Draft.userId,
    title: 'In-Sem 30M Draft',
    subject: mock30Draft.subject,
    form_data: mock30Draft,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  assert(formattedDraft.totalMarks === 30, 'Draft 30M remains exactly 30M without reset');
  assert(formattedDraft.classYear === 'SE', 'Draft classYear SE preserved');
  assert(formattedDraft.semester === 'Semester 4', 'Draft semester Semester 4 preserved');
  assert(formattedDraft.academicPattern === '2024', 'Draft pattern 2024 preserved');
  assert(formattedDraft.blueprint?.sections?.length === 2, 'Draft dynamic sections preserved');

  // Test 6: Question Bank Image & Collaborative Permissions
  console.log('\n[6. Question Bank Diagrams & Subject Collaboration]');
  const mockNormalized = questionBankService.normalizeQuestion({
    id: 'q-test-1',
    subject: 'SPOS',
    answer_scheme: JSON.stringify({
      scheme: 'Full answer scheme',
      image: { dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', name: 'architecture.png' }
    })
  });
  assert(mockNormalized.answerScheme === 'Full answer scheme', 'Answer scheme text extracted cleanly from wrapper');
  assert(mockNormalized.image?.name === 'architecture.png', 'Question image diagram extracted correctly');

  // Test 7: Audit Log Caching & Fast Summary
  console.log('\n[7. Security Audit Log Caching & Resilience]');
  const t0 = Date.now();
  const summary1 = await auditLogService.getAuditLogSummary();
  const d1 = Date.now() - t0;
  const t1 = Date.now();
  const summary2 = await auditLogService.getAuditLogSummary();
  const d2 = Date.now() - t1;
  assert(summary1.totalEvents >= 0, `Audit log summary returned ${summary1.totalEvents} events`);
  assert(d2 < 50, `Subsequent cached audit summary returned in ${d2}ms (< 50ms)`);

  console.log('\n======================================================');
  console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runSprintVerification().catch(err => {
  console.error('Master verification script failed:', err);
  process.exit(1);
});

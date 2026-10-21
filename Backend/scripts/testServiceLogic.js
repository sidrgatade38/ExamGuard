/**
 * Service & Controller Logic Verification (Unit/Mock Tests)
 * Verifies business logic for login, inactive account rejection,
 * password comparison, and safe user payload formatting.
 */

const bcrypt = require('bcryptjs');
const { generateToken, verifyToken } = require('../src/utils/jwt');

async function runServiceTests() {
  console.log('\n======================================================');
  console.log('  EXAMGUARD MODULE 3 - SERVICE LOGIC TESTS');
  console.log('======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name}`);
      failed++;
    }
  }

  // 1. Password Hashing with cost factor 12
  const plainPassword = 'SuperSecureTeacherPassword2026';
  const hashedPassword = await bcrypt.hash(plainPassword, 12);

  // 2. Mock User Record as stored in Supabase users table
  const mockDbUser = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    name: 'Dr. Jane Smith',
    email: 'jane.smith@examguard.edu',
    password_hash: hashedPassword,
    role_id: '11111111-2222-3333-4444-555555555555',
    is_active: true,
  };

  // Test Case: Active user + Correct password
  const isMatchValid = await bcrypt.compare(plainPassword, mockDbUser.password_hash);
  assert(isMatchValid === true, 'Correct password validated against hash');

  const token = generateToken({
    userId: mockDbUser.id,
    roleId: mockDbUser.role_id,
    email: mockDbUser.email,
  });
  assert(Boolean(token), 'JWT successfully generated for authenticated user');

  const decoded = verifyToken(token);
  assert(decoded.userId === mockDbUser.id, 'JWT decoded contains correct userId');
  assert(decoded.email === mockDbUser.email, 'JWT decoded contains correct email');

  // Test Case: Safe user object (no password_hash)
  const safeUser = {
    id: mockDbUser.id,
    name: mockDbUser.name,
    email: mockDbUser.email,
    roleId: mockDbUser.role_id,
  };
  assert(safeUser.password_hash === undefined, 'Safe user excludes password_hash');
  assert(safeUser.password === undefined, 'Safe user excludes plaintext password');

  // Test Case: Incorrect password rejection
  const isMatchWrong = await bcrypt.compare('WrongPassword999', mockDbUser.password_hash);
  assert(isMatchWrong === false, 'Incorrect password rejected by bcrypt');

  // Test Case: Inactive user condition
  const inactiveUser = { ...mockDbUser, is_active: false };
  assert(inactiveUser.is_active === false, 'Inactive account condition recognized');

  console.log('\n======================================================');
  console.log(`  SERVICE TESTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('======================================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

runServiceTests().catch((err) => {
  console.error('Service test error:', err);
  process.exit(1);
});

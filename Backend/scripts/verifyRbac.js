/**
 * Comprehensive Automated Test Suite for Module 4: RBAC & Authorization
 * 
 * Verifies all scenarios required by Section 25, 26, and 27:
 * A. TEACHER user permissions:
 *    - GET /api/rbac/teacher -> 200 OK
 *    - GET /api/rbac/admin -> 403 Forbidden
 *    - GET /api/rbac/exam-coordinator -> 403 Forbidden
 * B. ADMIN user permissions:
 *    - GET /api/rbac/admin -> 200 OK
 *    - GET /api/rbac/teacher -> 403 Forbidden
 *    - GET /api/rbac/exam-coordinator -> 403 Forbidden
 * C. EXAM_COORDINATOR user permissions:
 *    - GET /api/rbac/exam-coordinator -> 200 OK
 *    - GET /api/rbac/admin -> 403 Forbidden
 *    - GET /api/rbac/teacher -> 403 Forbidden
 * D. No Token on all 3 RBAC endpoints -> 401 Unauthorized
 * E. Invalid Token on all 3 RBAC endpoints -> 401 Unauthorized
 * F. Expired Token on all 3 RBAC endpoints -> 401 Unauthorized
 * G. Role Tampering Test:
 *    - Attacker modifies token claims or payload, but server-side authority detects real role -> 403
 * H. Inactive User Account Test:
 *    - Authenticated inactive user denied access -> 403 Forbidden
 * I. Regression Check:
 *    - Module 1 Health Check (/api/health) -> 200 OK
 */

const http = require('http');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const config = require('../src/config');
const authorizationService = require('../src/services/authorizationService');
const { generateToken } = require('../src/utils/jwt');
const { app } = require('../src/server');

const TEST_PORT = 5002;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
let server;

// Mock database users for deterministic authorization tests
const MOCK_USERS = {
  admin: {
    userId: '11111111-1111-1111-1111-111111111111',
    roleId: 'role-admin-uuid',
    roleName: 'ADMIN',
    email: 'admin.demo@examguard.edu',
    isActive: true,
  },
  teacher: {
    userId: '22222222-2222-2222-2222-222222222222',
    roleId: 'role-teacher-uuid',
    roleName: 'TEACHER',
    email: 'teacher.demo@examguard.edu',
    isActive: true,
  },
  coordinator: {
    userId: '33333333-3333-3333-3333-333333333333',
    roleId: 'role-coordinator-uuid',
    roleName: 'EXAM_COORDINATOR',
    email: 'coord.demo@examguard.edu',
    isActive: true,
  },
  inactiveTeacher: {
    userId: '44444444-4444-4444-4444-444444444444',
    roleId: 'role-teacher-uuid',
    roleName: 'TEACHER',
    email: 'inactive.demo@examguard.edu',
    isActive: false,
  },
};

// Intercept getUserRole for deterministic testing
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
  // Fall back to original implementation if real Supabase user
  return originalGetUserRole(userId);
};

function makeRequest(method, path, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode, data: parsed });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runRbacTests() {
  console.log('\n==========================================================');
  console.log('  EXAMGUARD MODULE 4 - RBAC & AUTHORIZATION TEST SUITE');
  console.log('==========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${name} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // Generate tokens for each role
  const adminToken = generateToken(MOCK_USERS.admin);
  const teacherToken = generateToken(MOCK_USERS.teacher);
  const coordinatorToken = generateToken(MOCK_USERS.coordinator);
  const inactiveToken = generateToken(MOCK_USERS.inactiveTeacher);

  server = app.listen(TEST_PORT);
  await new Promise((r) => setTimeout(r, 200));

  try {
    // ----------------------------------------------------
    // Regression Check: Module 1 Health Endpoint
    // ----------------------------------------------------
    console.log('[Group 0: Module 1 Health Check Regression]');
    const health = await makeRequest('GET', '/api/health');
    assert(health.status === 200, 'GET /api/health returns 200 OK');

    // ----------------------------------------------------
    // Scenario A: TEACHER Permissions
    // ----------------------------------------------------
    console.log('\n[Group A: TEACHER Permissions]');
    const t1 = await makeRequest('GET', '/api/rbac/teacher', { Authorization: `Bearer ${teacherToken}` });
    assert(t1.status === 200, 'TEACHER accessing /api/rbac/teacher returns 200 OK');
    assert(t1.data?.message?.includes('TEACHER'), 'TEACHER receives success message');

    const t2 = await makeRequest('GET', '/api/rbac/admin', { Authorization: `Bearer ${teacherToken}` });
    assert(t2.status === 403, 'TEACHER accessing /api/rbac/admin returns 403 Forbidden', `Status: ${t2.status}`);
    assert(t2.data?.message === 'Access forbidden', 'TEACHER receives generic 403 error');

    const t3 = await makeRequest('GET', '/api/rbac/exam-coordinator', { Authorization: `Bearer ${teacherToken}` });
    assert(t3.status === 403, 'TEACHER accessing /api/rbac/exam-coordinator returns 403 Forbidden', `Status: ${t3.status}`);

    // ----------------------------------------------------
    // Scenario B: ADMIN Permissions
    // ----------------------------------------------------
    console.log('\n[Group B: ADMIN Permissions]');
    const a1 = await makeRequest('GET', '/api/rbac/admin', { Authorization: `Bearer ${adminToken}` });
    assert(a1.status === 200, 'ADMIN accessing /api/rbac/admin returns 200 OK');
    assert(a1.data?.message?.includes('ADMIN'), 'ADMIN receives success message');

    const a2 = await makeRequest('GET', '/api/rbac/teacher', { Authorization: `Bearer ${adminToken}` });
    assert(a2.status === 403, 'ADMIN accessing /api/rbac/teacher returns 403 Forbidden', `Status: ${a2.status}`);

    const a3 = await makeRequest('GET', '/api/rbac/exam-coordinator', { Authorization: `Bearer ${adminToken}` });
    assert(a3.status === 403, 'ADMIN accessing /api/rbac/exam-coordinator returns 403 Forbidden', `Status: ${a3.status}`);

    // ----------------------------------------------------
    // Scenario C: EXAM_COORDINATOR Permissions
    // ----------------------------------------------------
    console.log('\n[Group C: EXAM_COORDINATOR Permissions]');
    const c1 = await makeRequest('GET', '/api/rbac/exam-coordinator', { Authorization: `Bearer ${coordinatorToken}` });
    assert(c1.status === 200, 'EXAM_COORDINATOR accessing /api/rbac/exam-coordinator returns 200 OK');
    assert(c1.data?.message?.includes('EXAM_COORDINATOR'), 'EXAM_COORDINATOR receives success message');

    const c2 = await makeRequest('GET', '/api/rbac/admin', { Authorization: `Bearer ${coordinatorToken}` });
    assert(c2.status === 403, 'EXAM_COORDINATOR accessing /api/rbac/admin returns 403 Forbidden', `Status: ${c2.status}`);

    const c3 = await makeRequest('GET', '/api/rbac/teacher', { Authorization: `Bearer ${coordinatorToken}` });
    assert(c3.status === 403, 'EXAM_COORDINATOR accessing /api/rbac/teacher returns 403 Forbidden', `Status: ${c3.status}`);

    // ----------------------------------------------------
    // Scenario D: Missing Token (Authentication Failure -> 401)
    // ----------------------------------------------------
    console.log('\n[Group D: Missing Token (401 Unauthorized)]');
    const nt1 = await makeRequest('GET', '/api/rbac/admin');
    assert(nt1.status === 401, 'No token on /api/rbac/admin returns 401');

    const nt2 = await makeRequest('GET', '/api/rbac/teacher');
    assert(nt2.status === 401, 'No token on /api/rbac/teacher returns 401');

    const nt3 = await makeRequest('GET', '/api/rbac/exam-coordinator');
    assert(nt3.status === 401, 'No token on /api/rbac/exam-coordinator returns 401');

    // ----------------------------------------------------
    // Scenario E: Invalid Signature Token (Authentication Failure -> 401)
    // ----------------------------------------------------
    console.log('\n[Group E: Invalid Token (401 Unauthorized)]');
    const forgedToken = jwt.sign(
      { userId: MOCK_USERS.admin.userId, roleId: 'forged', email: 'forged@hack.com' },
      'forged_secret_key_99999'
    );
    const it1 = await makeRequest('GET', '/api/rbac/admin', { Authorization: `Bearer ${forgedToken}` });
    assert(it1.status === 401, 'Forged token on /api/rbac/admin returns 401');

    const it2 = await makeRequest('GET', '/api/rbac/teacher', { Authorization: `Bearer ${forgedToken}` });
    assert(it2.status === 401, 'Forged token on /api/rbac/teacher returns 401');

    const it3 = await makeRequest('GET', '/api/rbac/exam-coordinator', { Authorization: `Bearer ${forgedToken}` });
    assert(it3.status === 401, 'Forged token on /api/rbac/exam-coordinator returns 401');

    // ----------------------------------------------------
    // Scenario F: Expired Token (Authentication Failure -> 401)
    // ----------------------------------------------------
    console.log('\n[Group F: Expired Token (401 Unauthorized)]');
    const expiredToken = jwt.sign(
      { userId: MOCK_USERS.admin.userId, email: MOCK_USERS.admin.email },
      config.jwtSecret,
      { expiresIn: '-10s' }
    );
    const et1 = await makeRequest('GET', '/api/rbac/admin', { Authorization: `Bearer ${expiredToken}` });
    assert(et1.status === 401, 'Expired token on /api/rbac/admin returns 401');

    const et2 = await makeRequest('GET', '/api/rbac/teacher', { Authorization: `Bearer ${expiredToken}` });
    assert(et2.status === 401, 'Expired token on /api/rbac/teacher returns 401');

    // ----------------------------------------------------
    // Scenario G: Role Tampering Test
    // ----------------------------------------------------
    console.log('\n[Group G: Client Role Tampering Protection]');
    // Malicious teacher crafts or tampers with token claim claiming role is 'ADMIN'
    const tamperedPayloadToken = jwt.sign(
      {
        userId: MOCK_USERS.teacher.userId, // Real user in DB is TEACHER
        roleId: 'claimed-admin-uuid',
        role: 'ADMIN', // Client tries to claim ADMIN role
        email: MOCK_USERS.teacher.email,
      },
      config.jwtSecret,
      { expiresIn: '1h' }
    );

    const tamperRes = await makeRequest('GET', '/api/rbac/admin', {
      Authorization: `Bearer ${tamperedPayloadToken}`,
    });
    assert(
      tamperRes.status === 403,
      'Tampered client claim rejected by authoritative database role lookup (403 Forbidden)',
      `Status: ${tamperRes.status}`
    );
    assert(tamperRes.data?.message === 'Access forbidden', 'Tamper attempt receives generic 403');

    // ----------------------------------------------------
    // Scenario H: Inactive User Rejection (403 Forbidden)
    // ----------------------------------------------------
    console.log('\n[Group H: Inactive User Protection]');
    const inactiveRes = await makeRequest('GET', '/api/rbac/teacher', {
      Authorization: `Bearer ${inactiveToken}`,
    });
    assert(
      inactiveRes.status === 403,
      'Inactive user rejected even on their assigned role route (403 Forbidden)',
      `Status: ${inactiveRes.status}`
    );

    console.log('\n==========================================================');
    console.log(`  RBAC TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('==========================================================\n');
  } catch (err) {
    console.error('Fatal error during RBAC test execution:', err);
    failed++;
  } finally {
    authorizationService.getUserRole = originalGetUserRole;
    if (server) {
      server.close(() => {
        process.exit(failed > 0 ? 1 : 0);
      });
    } else {
      process.exit(failed > 0 ? 1 : 0);
    }
  }
}

runRbacTests();

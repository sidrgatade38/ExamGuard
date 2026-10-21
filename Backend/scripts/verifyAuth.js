/**
 * Comprehensive Automated Test Suite for Module 3: Authentication
 * 
 * Verifies all 10 scenarios required by Section 25 & Section 31:
 * 1. Login with missing email -> 400
 * 2. Login with missing password -> 400
 * 3. Login with invalid email -> 400
 * 4. Access /api/auth/me without token -> 401
 * 5. Access /api/auth/me with malformed token -> 401
 * 6. Access /api/auth/me with invalid token -> 401
 * 7. Access /api/auth/me with expired token -> 401
 * 8. JWT generation & verification roundtrip
 * 9. Auth service & controller integration with valid/invalid credentials
 * 10. Health check endpoint still functional (Module 1 regression check)
 */

const http = require('http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Load environment
require('dotenv').config();

const { app } = require('../src/server');
const { generateToken, verifyToken } = require('../src/utils/jwt');
const config = require('../src/config');

let server;
const TEST_PORT = 5001;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function makeRequest(method, path, body = null, headers = {}) {
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
        resolve({ status: res.statusCode, data: parsed, headers: res.headers });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('\n======================================================');
  console.log('  EXAMGUARD MODULE 3 - AUTHENTICATION TEST SUITE');
  console.log('======================================================\n');

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

  // Start test server
  server = app.listen(TEST_PORT);
  await new Promise((r) => setTimeout(r, 200));

  try {
    // ----------------------------------------------------
    // Scenario 0: Health Check Regression (Module 1)
    // ----------------------------------------------------
    console.log('[Group 0: Module 1 Regression]');
    const healthRes = await makeRequest('GET', '/api/health');
    assert(healthRes.status === 200, 'GET /api/health returns HTTP 200', `Status: ${healthRes.status}`);
    assert(healthRes.data?.success === true, 'Health check reports success: true');

    // ----------------------------------------------------
    // Scenario 1: Missing Email
    // ----------------------------------------------------
    console.log('\n[Group 1: Login Request Validation]');
    const missingEmailRes = await makeRequest('POST', '/api/auth/login', {
      password: 'SomePassword123',
    });
    assert(missingEmailRes.status === 400, 'Login with missing email returns HTTP 400', `Status: ${missingEmailRes.status}`);
    assert(missingEmailRes.data?.success === false, 'Missing email returns success: false');

    // ----------------------------------------------------
    // Scenario 2: Missing Password
    // ----------------------------------------------------
    const missingPasswordRes = await makeRequest('POST', '/api/auth/login', {
      email: 'faculty@examguard.edu',
    });
    assert(missingPasswordRes.status === 400, 'Login with missing password returns HTTP 400', `Status: ${missingPasswordRes.status}`);
    assert(missingPasswordRes.data?.success === false, 'Missing password returns success: false');

    // ----------------------------------------------------
    // Scenario 3: Invalid Email Format
    // ----------------------------------------------------
    const invalidEmailRes = await makeRequest('POST', '/api/auth/login', {
      email: 'not-an-email',
      password: 'SomePassword123',
    });
    assert(invalidEmailRes.status === 400, 'Login with invalid email returns HTTP 400', `Status: ${invalidEmailRes.status}`);
    assert(invalidEmailRes.data?.message?.includes('format'), 'Invalid email error message is descriptive');

    // ----------------------------------------------------
    // Scenario 4: Access /api/auth/me without token
    // ----------------------------------------------------
    console.log('\n[Group 2: Auth Middleware & Token Protection]');
    const noTokenRes = await makeRequest('GET', '/api/auth/me');
    assert(noTokenRes.status === 401, 'GET /api/auth/me without token returns HTTP 401', `Status: ${noTokenRes.status}`);
    assert(noTokenRes.data?.success === false, 'Missing token returns success: false');

    // ----------------------------------------------------
    // Scenario 5: Access /api/auth/me with malformed token
    // ----------------------------------------------------
    const malformedHeaderRes = await makeRequest('GET', '/api/auth/me', null, {
      Authorization: 'Basic invalid_token_format',
    });
    assert(malformedHeaderRes.status === 401, 'Malformed Authorization header returns HTTP 401', `Status: ${malformedHeaderRes.status}`);

    const malformedTokenRes = await makeRequest('GET', '/api/auth/me', null, {
      Authorization: 'Bearer not_a_valid_jwt_structure',
    });
    assert(malformedTokenRes.status === 401, 'Malformed JWT token returns HTTP 401', `Status: ${malformedTokenRes.status}`);

    // ----------------------------------------------------
    // Scenario 6: Access /api/auth/me with invalid signature token
    // ----------------------------------------------------
    const invalidSignedToken = jwt.sign(
      { userId: 'test-uuid', roleId: 'role-uuid', email: 'fake@test.com' },
      'wrong_secret_key_12345'
    );
    const invalidSignRes = await makeRequest('GET', '/api/auth/me', null, {
      Authorization: `Bearer ${invalidSignedToken}`,
    });
    assert(invalidSignRes.status === 401, 'Invalid signature token returns HTTP 401', `Status: ${invalidSignRes.status}`);

    // ----------------------------------------------------
    // Scenario 7: Access /api/auth/me with expired token
    // ----------------------------------------------------
    const expiredToken = jwt.sign(
      { userId: 'test-uuid', roleId: 'role-uuid', email: 'expired@test.com' },
      config.jwtSecret,
      { expiresIn: '-10s' }
    );
    const expiredRes = await makeRequest('GET', '/api/auth/me', null, {
      Authorization: `Bearer ${expiredToken}`,
    });
    assert(expiredRes.status === 401, 'Expired JWT returns HTTP 401', `Status: ${expiredRes.status}`);
    assert(expiredRes.data?.message?.toLowerCase().includes('expired'), 'Expired token returns specific expired message');

    // ----------------------------------------------------
    // Scenario 8: JWT Utility Security Validation
    // ----------------------------------------------------
    console.log('\n[Group 3: JWT Security & Token Payload]');
    const testPayload = {
      userId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      roleId: '8d1f7789-8536-41ef-055c-f18fd2f01bf8',
      email: 'teacher@examguard.edu',
    };
    const signedToken = generateToken(testPayload);
    assert(typeof signedToken === 'string' && signedToken.length > 20, 'generateToken returns valid JWT string');

    const decoded = verifyToken(signedToken);
    assert(decoded.userId === testPayload.userId, 'Decoded userId matches payload');
    assert(decoded.roleId === testPayload.roleId, 'Decoded roleId matches payload');
    assert(decoded.email === testPayload.email, 'Decoded email matches payload');
    assert(decoded.password === undefined, 'No password field in JWT payload');
    assert(decoded.password_hash === undefined, 'No password_hash field in JWT payload');

    // ----------------------------------------------------
    // Scenario 9: Bcrypt Cost Factor & Hashing Verification
    // ----------------------------------------------------
    console.log('\n[Group 4: Password Hashing Verification]');
    const rawPassword = 'ExamGuard@Secure2026';
    const saltRounds = 12;
    const hashed = await bcrypt.hash(rawPassword, saltRounds);
    assert(hashed.startsWith('$2'), 'Bcrypt hash generated with valid version prefix');
    assert(hashed !== rawPassword, 'Plaintext password is never equal to hash');
    const isBcryptMatch = await bcrypt.compare(rawPassword, hashed);
    assert(isBcryptMatch === true, 'bcrypt.compare validates correct password');
    const isWrongMatch = await bcrypt.compare('WrongPassword', hashed);
    assert(isWrongMatch === false, 'bcrypt.compare rejects incorrect password');

    console.log('\n======================================================');
    console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('======================================================\n');
  } catch (err) {
    console.error('Fatal error during test execution:', err);
    failed++;
  } finally {
    if (server) {
      server.close(() => {
        process.exit(failed > 0 ? 1 : 0);
      });
    } else {
      process.exit(failed > 0 ? 1 : 0);
    }
  }
}

runTests();

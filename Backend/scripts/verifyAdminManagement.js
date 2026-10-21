/**
 * ExamGuard - Module 14: Admin Management Automated Verification Test Suite
 *
 * Dedicated test runner executing on PORT 5012 to avoid port collision.
 *
 * Verifies all Module 14 Admin Management requirements:
 * 1. Authentication & RBAC guards (401 unauthenticated, 403 non-admin/inactive admin, 200 active admin).
 * 2. User listing with search, filtering (by role and status), and pagination.
 * 3. Safe user profile retrieval (no password hashes exposed).
 * 4. Secure administrative user creation with bcrypt password hashing (12 rounds) and duplicate rejection.
 * 5. Account activation & deactivation with self-lockout and last-admin safeguards.
 * 6. Role delegation & changes with self-demotion and last-admin safeguards.
 * 7. Administrator-assisted password reset with bcrypt hashing and validation.
 * 8. Audit logging integration for all admin operations without secret leakage.
 * 9. Multi-module regression safeguards (Modules 1–13).
 */

const http = require('http');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const config = require('../src/config');
const { app } = require('../src/server');
const { getSupabaseClient } = require('../src/config/supabase');
const supabaseClient = getSupabaseClient();
const authorizationService = require('../src/services/authorizationService');
const auditLogService = require('../src/services/auditLogService');
const adminService = require('../src/services/adminService');
const encryptionService = require('../src/services/encryptionService');
const signatureService = require('../src/services/signatureService');
const keyManagementService = require('../src/services/keyManagementService');
const answerKeyService = require('../src/services/answerKeyService');
const verificationService = require('../src/services/verificationService');
const { generateToken } = require('../src/utils/jwt');

// Dedicated test port
const TEST_PORT = 5012;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Test Tracking
let totalAssertions = 0;
let passedCount = 0;

function assert(condition, message) {
  totalAssertions++;
  if (!condition) {
    console.error(`\n  ✗ [FAIL] Assertion ${totalAssertions}: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passedCount++;
  console.log(`  ✓ [ASSERTION ${totalAssertions}] ${message}`);
}

// Fixed UUIDs for Mock Identities
const MOCK_USERS = {
  admin: {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'admin.m14@examguard.edu',
    name: 'Admin Chief',
    roleId: 'role-uuid-admin-001',
    roleName: 'ADMIN',
    isActive: true,
  },
  admin2: {
    userId: '11111111-1111-4111-8111-222222222222',
    email: 'admin2.m14@examguard.edu',
    name: 'Second Administrator',
    roleId: 'role-uuid-admin-001',
    roleName: 'ADMIN',
    isActive: true,
  },
  inactiveAdmin: {
    userId: '11111111-1111-4111-8111-333333333333',
    email: 'inactive.admin@examguard.edu',
    name: 'Inactive Admin',
    roleId: 'role-uuid-admin-001',
    roleName: 'ADMIN',
    isActive: false,
  },
  teacher: {
    userId: '22222222-2222-4222-8222-222222222222',
    email: 'teacher.m14@examguard.edu',
    name: 'Prof. Ada Lovelace',
    roleId: 'role-uuid-teacher-002',
    roleName: 'TEACHER',
    isActive: true,
  },
  coord: {
    userId: '33333333-3333-4333-8333-333333333333',
    email: 'coord.m14@examguard.edu',
    name: 'Coordinator Charles',
    roleId: 'role-uuid-coord-003',
    roleName: 'EXAM_COORDINATOR',
    isActive: true,
  },
};

const MOCK_ROLES = [
  { id: 'role-uuid-admin-001', name: 'ADMIN', description: 'System Administrator' },
  { id: 'role-uuid-teacher-002', name: 'TEACHER', description: 'Question Paper Author' },
  { id: 'role-uuid-coord-003', name: 'EXAM_COORDINATOR', description: 'Exam Materials Coordinator' },
];

// Issue valid JWT tokens
const adminToken = generateToken({
  userId: MOCK_USERS.admin.userId,
  email: MOCK_USERS.admin.email,
  roleId: MOCK_USERS.admin.roleId,
});

const admin2Token = generateToken({
  userId: MOCK_USERS.admin2.userId,
  email: MOCK_USERS.admin2.email,
  roleId: MOCK_USERS.admin2.roleId,
});

const inactiveAdminToken = generateToken({
  userId: MOCK_USERS.inactiveAdmin.userId,
  email: MOCK_USERS.inactiveAdmin.email,
  roleId: MOCK_USERS.inactiveAdmin.roleId,
});

const teacherToken = generateToken({
  userId: MOCK_USERS.teacher.userId,
  email: MOCK_USERS.teacher.email,
  roleId: MOCK_USERS.teacher.roleId,
});

const coordToken = generateToken({
  userId: MOCK_USERS.coord.userId,
  email: MOCK_USERS.coord.email,
  roleId: MOCK_USERS.coord.roleId,
});

// Expired JWT token
const expiredToken = (() => {
  const jwt = require('jsonwebtoken');
  return jwt.sign(
    { userId: MOCK_USERS.admin.userId, email: MOCK_USERS.admin.email },
    config.jwtSecret,
    { expiresIn: -10 }
  );
})();

// In-memory collections for test isolation
const inMemoryUsers = new Map();
const inMemoryLogs = new Map();

// Initialize mock users in memory
for (const u of Object.values(MOCK_USERS)) {
  inMemoryUsers.set(u.userId, {
    id: u.userId,
    name: u.name,
    email: u.email,
    password_hash: bcrypt.hashSync('ExamGuard@Initial2026', 10),
    role_id: u.roleId,
    is_active: u.isActive,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

// Intercept authorizationService.getUserRole
const originalGetUserRole = authorizationService.getUserRole;
authorizationService.getUserRole = async function (userId) {
  const user = inMemoryUsers.get(userId);
  if (user) {
    const roleObj = MOCK_ROLES.find((r) => r.id === user.role_id) || { name: 'UNKNOWN' };
    return {
      userId: user.id,
      roleId: user.role_id,
      roleName: roleObj.name,
      isActive: user.is_active,
    };
  }
  return originalGetUserRole(userId);
};

// Intercept Supabase database queries
const originalClientFrom = supabaseClient.from.bind(supabaseClient);

supabaseClient.from = function (tableName) {
  if (tableName === 'roles') {
    return {
      select: () => {
        const builder = {
          eq: (col, val) => {
            const matched = MOCK_ROLES.find((r) => r[col] === val) || null;
            return {
              maybeSingle: () => Promise.resolve({ data: matched, error: null }),
              single: () => Promise.resolve({ data: matched, error: null }),
            };
          },
          order: () => Promise.resolve({ data: [...MOCK_ROLES], error: null }),
        };
        return builder;
      },
    };
  }

  if (tableName === 'users') {
    return {
      insert: (records) => {
        const row = records[0];
        const newId = row.id || crypto.randomUUID();
        const created = {
          ...row,
          id: newId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        inMemoryUsers.set(newId, created);

        return {
          select: () => ({
            single: () => {
              const roleObj = MOCK_ROLES.find((r) => r.id === created.role_id) || { id: created.role_id, name: 'TEACHER' };
              return Promise.resolve({
                data: {
                  ...created,
                  roles: roleObj,
                },
                error: null,
              });
            },
          }),
        };
      },
      select: (fields, options) => {
        let rows = Array.from(inMemoryUsers.values());

        const builder = {
          _filters: [],
          eq(col, val) {
            rows = rows.filter((r) => r[col] === val);
            return builder;
          },
          or(clause) {
            // e.g. name.ilike.%search%,email.ilike.%search%
            const parts = clause.split(',');
            const searchMatch = (parts[0] || '').split('.%')[1]?.replace('%', '')?.toLowerCase() || '';
            if (searchMatch) {
              rows = rows.filter(
                (r) =>
                  (r.name && r.name.toLowerCase().includes(searchMatch)) ||
                  (r.email && r.email.toLowerCase().includes(searchMatch))
              );
            }
            return builder;
          },
          order(col, { ascending } = { ascending: true }) {
            rows.sort((a, b) => {
              const vA = a[col] || '';
              const vB = b[col] || '';
              return ascending ? (vA > vB ? 1 : -1) : (vA < vB ? 1 : -1);
            });
            return builder;
          },
          range(from, to) {
            const count = rows.length;
            const paged = rows.slice(from, to + 1).map((r) => {
              const roleObj = MOCK_ROLES.find((ro) => ro.id === r.role_id) || { id: r.role_id, name: 'UNKNOWN' };
              return { ...r, roles: roleObj };
            });
            return Promise.resolve({ data: paged, count, error: null });
          },
          maybeSingle() {
            const single = rows[0] || null;
            if (!single) return Promise.resolve({ data: null, error: null });
            const roleObj = MOCK_ROLES.find((ro) => ro.id === single.role_id) || { id: single.role_id, name: 'UNKNOWN' };
            return Promise.resolve({ data: { ...single, roles: roleObj }, error: null });
          },
          single() {
            return builder.maybeSingle();
          },
          then(resolve, reject) {
            const count = rows.length;
            const populated = rows.map((r) => {
              const roleObj = MOCK_ROLES.find((ro) => ro.id === r.role_id) || { id: r.role_id, name: 'UNKNOWN' };
              return { ...r, roles: roleObj };
            });
            return Promise.resolve({ data: populated, count, error: null }).then(resolve, reject);
          },
        };
        return builder;
      },
      update: (updates) => ({
        eq: (col, val) => {
          let updated = null;
          if (col === 'id' && inMemoryUsers.has(val)) {
            const current = inMemoryUsers.get(val);
            updated = { ...current, ...updates, updated_at: new Date().toISOString() };
            inMemoryUsers.set(val, updated);
          }
          return {
            select: () => ({
              single: () => {
                if (!updated) return Promise.resolve({ data: null, error: new Error('User not found') });
                const roleObj = MOCK_ROLES.find((ro) => ro.id === updated.role_id) || { id: updated.role_id, name: 'UNKNOWN' };
                return Promise.resolve({ data: { ...updated, roles: roleObj }, error: null });
              },
            }),
            then(resolve, reject) {
              return Promise.resolve({ data: updated, error: null }).then(resolve, reject);
            },
          };
        },
      }),
    };
  }

  if (tableName === 'activity_logs') {
    return {
      insert: (records) => {
        const row = records[0];
        const logId = row.id || crypto.randomUUID();
        const created = {
          id: logId,
          user_id: row.user_id || null,
          action: row.action,
          resource_type: row.resource_type || null,
          resource_id: row.resource_id || null,
          ip_address: row.ip_address || null,
          user_agent: row.user_agent || null,
          details: row.details || {},
          created_at: new Date().toISOString(),
        };
        inMemoryLogs.set(logId, created);
        return {
          select: () => ({
            single: () => Promise.resolve({ data: created, error: null }),
          }),
        };
      },
      select: () => {
        let rows = Array.from(inMemoryLogs.values());
        const builder = {
          eq: (col, val) => {
            rows = rows.filter((r) => r[col] === val);
            return builder;
          },
          order: () => builder,
          range: (from, to) => Promise.resolve({ data: rows.slice(from, to + 1), count: rows.length, error: null }),
          maybeSingle: () => Promise.resolve({ data: rows[0] || null, error: null }),
          then: (resolve, reject) => Promise.resolve({ data: rows, count: rows.length, error: null }).then(resolve, reject),
        };
        return builder;
      },
    };
  }

  if (tableName === 'question_papers') {
    return {
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    };
  }

  if (tableName === 'question_paper_assignments') {
    return {
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
    };
  }

  if (tableName === 'notifications') {
    return {
      select: () => ({
        eq: () => ({
          neq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    };
  }

  return originalClientFrom(tableName);
};

// HTTP Request Helper
function httpRequest({ method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { ...headers },
    };

    let postData = null;
    if (body) {
      postData = JSON.stringify(body);
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed,
        });
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Main Test Execution
async function runAllTests() {
  console.log('\n============================================================');
  console.log('  EXAMGUARD MODULE 14: ADMIN MANAGEMENT');
  console.log('  AUTOMATED VERIFICATION TEST SUITE (PORT 5012)');
  console.log('============================================================\n');

  let server;

  try {
    // Start HTTP Server on dedicated port
    await new Promise((resolve, reject) => {
      server = app.listen(TEST_PORT, () => {
        console.log(`[Test Server] Started successfully on port ${TEST_PORT}\n`);
        resolve();
      });
      server.on('error', reject);
    });

    // ----------------------------------------------------
    // Section 1: Authentication & RBAC Authorization Guards
    // ----------------------------------------------------
    console.log('--- Section 1: Authentication & Authorization Safeguards ---');

    // 1. Unauthenticated request to /api/admin/users
    const resNoAuth = await httpRequest({ method: 'GET', path: '/api/admin/users' });
    assert(resNoAuth.statusCode === 401, 'Unauthenticated access to /api/admin/users returns 401');
    assert(resNoAuth.body.success === false, '401 response contains success: false');

    // 2. Malformed JWT
    const resBadToken = await httpRequest({
      method: 'GET',
      path: '/api/admin/users',
      headers: { Authorization: 'Bearer this.is.invalid' },
    });
    assert(resBadToken.statusCode === 401, 'Malformed JWT returns 401');

    // 3. Expired JWT
    const resExpired = await httpRequest({
      method: 'GET',
      path: '/api/admin/users',
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    assert(resExpired.statusCode === 401, 'Expired JWT returns 401');

    // 4. TEACHER role accessing /api/admin/users
    const resTeacher = await httpRequest({
      method: 'GET',
      path: '/api/admin/users',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert(resTeacher.statusCode === 403, 'TEACHER accessing /api/admin/users returns 403 Forbidden');
    assert(resTeacher.body.success === false, 'TEACHER denied response contains success: false');

    // 5. EXAM_COORDINATOR role accessing /api/admin/users
    const resCoord = await httpRequest({
      method: 'GET',
      path: '/api/admin/users',
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    assert(resCoord.statusCode === 403, 'EXAM_COORDINATOR accessing /api/admin/users returns 403 Forbidden');

    // 6. Inactive administrator accessing /api/admin/users
    const resInactiveAdmin = await httpRequest({
      method: 'GET',
      path: '/api/admin/users',
      headers: { Authorization: `Bearer ${inactiveAdminToken}` },
    });
    assert(resInactiveAdmin.statusCode === 403, 'Inactive administrator returns 403 Forbidden');

    // 7. Active administrator accessing /api/admin/users
    const resAdmin = await httpRequest({
      method: 'GET',
      path: '/api/admin/users',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resAdmin.statusCode === 200, 'Active ADMIN accessing /api/admin/users returns 200 OK');
    assert(resAdmin.body.success === true, 'ADMIN response has success: true');
    assert(Array.isArray(resAdmin.body.users), 'Response data contains users array');

    // ----------------------------------------------------
    // Section 2: User Listing, Filtering & Pagination
    // ----------------------------------------------------
    console.log('\n--- Section 2: User Listing, Filtering & Pagination ---');

    // 8. Pagination bounds
    const resPaged = await httpRequest({
      method: 'GET',
      path: '/api/admin/users?page=1&limit=2',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resPaged.statusCode === 200, 'Paginated query returns 200 OK');
    assert(resPaged.body.users.length <= 2, 'Page size correctly constrained by limit parameter');
    assert(resPaged.body.pagination.page === 1, 'Pagination reflects page: 1');
    assert(resPaged.body.pagination.total >= 4, 'Pagination includes total user count');

    // 9. Search by name or email
    const resSearch = await httpRequest({
      method: 'GET',
      path: '/api/admin/users?search=Lovelace',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resSearch.statusCode === 200, 'Search query returns 200 OK');
    assert(resSearch.body.users.length >= 1, 'Search finds matching user');
    assert(resSearch.body.users[0].name.includes('Lovelace'), 'Search result contains queried name');

    // 10. Filter by role
    const resRoleFilter = await httpRequest({
      method: 'GET',
      path: '/api/admin/users?role=TEACHER',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resRoleFilter.statusCode === 200, 'Role filter query returns 200 OK');
    assert(
      resRoleFilter.body.users.every((u) => u.role === 'TEACHER'),
      'All returned users have TEACHER role'
    );

    // 11. Filter by status
    const resStatusFilter = await httpRequest({
      method: 'GET',
      path: '/api/admin/users?status=inactive',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resStatusFilter.statusCode === 200, 'Status filter query returns 200 OK');
    assert(
      resStatusFilter.body.users.every((u) => u.isActive === false),
      'All returned users have isActive: false'
    );

    // 12. Safe user response (zero password hash leakage)
    for (const u of resAdmin.body.users) {
      assert(u.password_hash === undefined, 'User record strictly excludes password_hash');
      assert(u.password === undefined, 'User record strictly excludes plaintext password');
      assert(typeof u.id === 'string', 'User record contains UUID id');
      assert(typeof u.email === 'string', 'User record contains email');
      assert(typeof u.role === 'string', 'User record contains role name');
      assert(typeof u.isActive === 'boolean', 'User record contains isActive boolean');
    }

    // 13. System roles endpoint
    const resRoles = await httpRequest({
      method: 'GET',
      path: '/api/admin/roles',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resRoles.statusCode === 200, 'GET /api/admin/roles returns 200 OK');
    assert(Array.isArray(resRoles.body.roles), 'Roles endpoint returns array');
    assert(resRoles.body.roles.length === 3, 'Returns all 3 system roles');

    // ----------------------------------------------------
    // Section 3: User Details Retrieval
    // ----------------------------------------------------
    console.log('\n--- Section 3: User Details Retrieval ---');

    // 14. Retrieve valid user by ID
    const resUserDetail = await httpRequest({
      method: 'GET',
      path: `/api/admin/users/${MOCK_USERS.teacher.userId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resUserDetail.statusCode === 200, 'GET /api/admin/users/:id returns 200 OK');
    assert(resUserDetail.body.user.id === MOCK_USERS.teacher.userId, 'Returned user ID matches target');
    assert(resUserDetail.body.user.email === MOCK_USERS.teacher.email, 'Returned email matches target');
    assert(resUserDetail.body.user.password_hash === undefined, 'Single user lookup strictly omits password_hash');

    // 15. Non-existent user UUID returns 404
    const nonExistentUuid = crypto.randomUUID();
    const resNotFound = await httpRequest({
      method: 'GET',
      path: `/api/admin/users/${nonExistentUuid}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resNotFound.statusCode === 404, 'Non-existent user UUID returns 404 Not Found');

    // 16. Malformed UUID returns 400
    const resMalformed = await httpRequest({
      method: 'GET',
      path: '/api/admin/users/not-a-valid-uuid',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resMalformed.statusCode === 400, 'Malformed UUID returns 400 Bad Request');

    // ----------------------------------------------------
    // Section 4: Administrative User Creation
    // ----------------------------------------------------
    console.log('\n--- Section 4: Administrative User Creation ---');

    const createdEmail = `new.faculty.${Date.now()}@examguard.edu`;
    const resCreate = await httpRequest({
      method: 'POST',
      path: '/api/admin/users',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Dr. Grace Hopper',
        email: createdEmail,
        password: 'ExamGuard@Secure2026',
        role: 'TEACHER',
      },
    });

    assert(resCreate.statusCode === 201, 'POST /api/admin/users returns 201 Created');
    assert(resCreate.body.success === true, 'Create response has success: true');
    assert(resCreate.body.user.email === createdEmail, 'Created user email matches request');
    assert(resCreate.body.user.role === 'TEACHER', 'Created user assigned requested TEACHER role');
    assert(resCreate.body.user.isActive === true, 'Newly created user is active by default');
    assert(resCreate.body.user.password_hash === undefined, 'Created user response omits password_hash');

    const createdUserId = resCreate.body.user.id;
    assert(typeof createdUserId === 'string', 'Created user assigned UUID');

    // Verify stored password hash with bcrypt
    const storedCreated = inMemoryUsers.get(createdUserId);
    assert(Boolean(storedCreated?.password_hash), 'Password hash stored in database');
    assert(storedCreated.password_hash.startsWith('$2'), 'Password hashed using bcrypt format');
    const isBcryptMatch = await bcrypt.compare('ExamGuard@Secure2026', storedCreated.password_hash);
    assert(isBcryptMatch === true, 'Stored bcrypt hash authenticates plaintext password');

    // Duplicate email rejected with 409 Conflict
    const resDuplicate = await httpRequest({
      method: 'POST',
      path: '/api/admin/users',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Another Hopper',
        email: createdEmail,
        password: 'ExamGuard@Duplicate2026',
        role: 'TEACHER',
      },
    });
    assert(resDuplicate.statusCode === 409, 'Duplicate email returns 409 Conflict');

    // Short password rejected
    const resShortPass = await httpRequest({
      method: 'POST',
      path: '/api/admin/users',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Short Pass User',
        email: 'short.pass@examguard.edu',
        password: 'short',
        role: 'TEACHER',
      },
    });
    assert(resShortPass.statusCode === 400, 'Password < 8 chars returns 400 Bad Request');

    // Invalid role rejected
    const resInvalidRole = await httpRequest({
      method: 'POST',
      path: '/api/admin/users',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Invalid Role User',
        email: 'bad.role@examguard.edu',
        password: 'ExamGuard@Secure2026',
        role: 'SUPER_ROOT_ADMIN',
      },
    });
    assert(resInvalidRole.statusCode === 400, 'Invalid role returns 400 Bad Request');

    // ----------------------------------------------------
    // Section 5: Account Status Management & Safeguards
    // ----------------------------------------------------
    console.log('\n--- Section 5: Account Status Management & Safeguards ---');

    // Deactivate user
    const resDeact = await httpRequest({
      method: 'PATCH',
      path: `/api/admin/users/${createdUserId}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { isActive: false },
    });
    assert(resDeact.statusCode === 200, 'Deactivate user returns 200 OK');
    assert(resDeact.body.user.isActive === false, 'User status updated to isActive: false');

    // Verify deactivated user cannot access protected endpoints
    const deactivatedToken = generateToken({
      userId: createdUserId,
      email: createdEmail,
      roleId: resCreate.body.user.roleId,
    });
    const resDeactAccess = await httpRequest({
      method: 'GET',
      path: '/api/rbac/teacher',
      headers: { Authorization: `Bearer ${deactivatedToken}` },
    });
    assert(resDeactAccess.statusCode === 403, 'Deactivated user blocked by roleMiddleware with 403 Forbidden');

    // Reactivate user
    const resReact = await httpRequest({
      method: 'PATCH',
      path: `/api/admin/users/${createdUserId}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { isActive: true },
    });
    assert(resReact.statusCode === 200, 'Reactivate user returns 200 OK');
    assert(resReact.body.user.isActive === true, 'User status updated to isActive: true');

    // Self-deactivation safeguard
    const resSelfDeact = await httpRequest({
      method: 'PATCH',
      path: `/api/admin/users/${MOCK_USERS.admin.userId}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { isActive: false },
    });
    assert(resSelfDeact.statusCode === 400, 'Admin self-deactivation blocked with 400 Bad Request');

    // Last-admin protection: deactivating admin2 when admin is temporarily inactive
    inMemoryUsers.get(MOCK_USERS.admin.userId).is_active = false;
    const resLastAdminDeact = await httpRequest({
      method: 'PATCH',
      path: `/api/admin/users/${MOCK_USERS.admin2.userId}/status`,
      headers: { Authorization: `Bearer ${admin2Token}` },
      body: { isActive: false },
    });
    assert(resLastAdminDeact.statusCode === 400, 'Deactivating last active admin blocked with 400 Bad Request');
    // Restore admin
    inMemoryUsers.get(MOCK_USERS.admin.userId).is_active = true;

    // Non-boolean status input returns 400
    const resBadStatusInput = await httpRequest({
      method: 'PATCH',
      path: `/api/admin/users/${createdUserId}/status`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { isActive: 'yes' },
    });
    assert(resBadStatusInput.statusCode === 400, 'Non-boolean isActive returns 400 Bad Request');

    // ----------------------------------------------------
    // Section 6: Role Management & Safeguards
    // ----------------------------------------------------
    console.log('\n--- Section 6: Role Management & Safeguards ---');

    // Change role from TEACHER to EXAM_COORDINATOR
    const resRoleChange = await httpRequest({
      method: 'PATCH',
      path: `/api/admin/users/${createdUserId}/role`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { role: 'EXAM_COORDINATOR' },
    });
    assert(resRoleChange.statusCode === 200, 'PATCH /api/admin/users/:id/role returns 200 OK');
    assert(resRoleChange.body.user.role === 'EXAM_COORDINATOR', 'User role updated to EXAM_COORDINATOR');

    // Verify role changed in storage
    const storedUpdated = inMemoryUsers.get(createdUserId);
    assert(storedUpdated.role_id === 'role-uuid-coord-003', 'Stored role_id updated in database');

    // Self-demotion safeguard
    const resSelfDemote = await httpRequest({
      method: 'PATCH',
      path: `/api/admin/users/${MOCK_USERS.admin.userId}/role`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { role: 'TEACHER' },
    });
    assert(resSelfDemote.statusCode === 400, 'Admin self-demotion blocked with 400 Bad Request');

    // Last-admin demotion safeguard
    inMemoryUsers.get(MOCK_USERS.admin.userId).is_active = false;
    const resLastAdminDemote = await httpRequest({
      method: 'PATCH',
      path: `/api/admin/users/${MOCK_USERS.admin2.userId}/role`,
      headers: { Authorization: `Bearer ${admin2Token}` },
      body: { role: 'TEACHER' },
    });
    assert(resLastAdminDemote.statusCode === 400, 'Demoting last active admin blocked with 400 Bad Request');
    // Restore admin
    inMemoryUsers.get(MOCK_USERS.admin.userId).is_active = true;

    // Invalid role in role change returns 400
    const resInvalidNewRole = await httpRequest({
      method: 'PATCH',
      path: `/api/admin/users/${createdUserId}/role`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { role: 'UNKNOWN_ROLE' },
    });
    assert(resInvalidNewRole.statusCode === 400, 'Invalid role change returns 400 Bad Request');

    // ----------------------------------------------------
    // Section 7: Administrator-Assisted Password Reset
    // ----------------------------------------------------
    console.log('\n--- Section 7: Administrator-Assisted Password Reset ---');

    const resReset = await httpRequest({
      method: 'POST',
      path: `/api/admin/users/${createdUserId}/reset-password`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { newPassword: 'ExamGuard@Reset2026' },
    });
    assert(resReset.statusCode === 200, 'POST /api/admin/users/:id/reset-password returns 200 OK');
    assert(resReset.body.success === true, 'Reset response has success: true');

    // Verify updated password hash authenticates new password
    const userAfterReset = inMemoryUsers.get(createdUserId);
    const isNewPassValid = await bcrypt.compare('ExamGuard@Reset2026', userAfterReset.password_hash);
    assert(isNewPassValid === true, 'New password successfully authenticates against updated bcrypt hash');

    // Old password no longer authenticates
    const isOldPassValid = await bcrypt.compare('ExamGuard@Secure2026', userAfterReset.password_hash);
    assert(isOldPassValid === false, 'Previous password no longer valid');

    // Weak reset password rejected
    const resWeakReset = await httpRequest({
      method: 'POST',
      path: `/api/admin/users/${createdUserId}/reset-password`,
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { newPassword: 'weak' },
    });
    assert(resWeakReset.statusCode === 400, 'Weak reset password returns 400 Bad Request');

    // ----------------------------------------------------
    // Section 8: Audit Log Integration
    // ----------------------------------------------------
    console.log('\n--- Section 8: Audit Log Integration ---');

    // Verify audit logs were captured
    const loggedEvents = Array.from(inMemoryLogs.values());
    assert(loggedEvents.length > 0, 'Admin actions captured in audit log');

    // Find user creation audit log
    const createLog = loggedEvents.find(
      (l) => l.details?.metadata?.adminAction === 'USER_CREATED'
    );
    assert(Boolean(createLog), 'USER_CREATED audit event recorded');
    assert(createLog.details.outcome === 'SUCCESS', 'Creation audit outcome is SUCCESS');
    assert(
      !JSON.stringify(createLog.details).includes('ExamGuard@Secure2026'),
      'Audit log strictly excludes plaintext password'
    );
    assert(
      !JSON.stringify(createLog.details).includes('$2'),
      'Audit log strictly excludes password hash'
    );

    // Find status change audit log
    const statusLog = loggedEvents.find(
      (l) => l.details?.metadata?.adminAction === 'USER_DEACTIVATED'
    );
    assert(Boolean(statusLog), 'USER_DEACTIVATED audit event recorded');

    // Find password reset audit log
    const resetLog = loggedEvents.find(
      (l) => l.details?.metadata?.adminAction === 'PASSWORD_RESET'
    );
    assert(Boolean(resetLog), 'PASSWORD_RESET audit event recorded');
    assert(
      !JSON.stringify(resetLog.details).includes('ExamGuard@Reset2026'),
      'Password reset audit log strictly excludes plaintext password'
    );

    // Find self-demotion denial audit log
    const denialLog = loggedEvents.find(
      (l) => l.details?.outcome === 'DENIED' && (l.details?.summary || '').includes('demote')
    );
    assert(Boolean(denialLog), 'Safeguard denial recorded in audit log with outcome DENIED');

    // Verify audit logs remain read-only
    const resAuditPost = await httpRequest({
      method: 'POST',
      path: '/api/audit-logs',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { action: 'FORGERY' },
    });
    assert(resAuditPost.statusCode === 405, 'POST /api/audit-logs returns 405 Method Not Allowed');

    // ----------------------------------------------------
    // Section 9: Multi-Module Regression Safeguards (Modules 1–13)
    // ----------------------------------------------------
    console.log('\n--- Section 9: Multi-Module Regression Safeguards (Modules 1–13) ---');

    // Module 1: Health check endpoint
    const resHealth = await httpRequest({ method: 'GET', path: '/api/health' });
    assert(resHealth.statusCode === 200, 'Regression Module 1: Health check returns 200 OK');

    // Module 3: Authentication /api/auth/me
    const resAuthMe = await httpRequest({
      method: 'GET',
      path: '/api/auth/me',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resAuthMe.statusCode === 200, 'Regression Module 3: /api/auth/me returns 200 OK');

    // Module 4: RBAC /api/rbac/teacher
    const resRbacTeacher = await httpRequest({
      method: 'GET',
      path: '/api/rbac/teacher',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert(resRbacTeacher.statusCode === 200, 'Regression Module 4: /api/rbac/teacher returns 200 for TEACHER');

    const resRbacDenied = await httpRequest({
      method: 'GET',
      path: '/api/rbac/teacher',
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    assert(resRbacDenied.statusCode === 403, 'Regression Module 4: /api/rbac/teacher returns 403 for coordinator');

    // Module 5: Question Paper listing /api/question-papers/my
    const resMyPapers = await httpRequest({
      method: 'GET',
      path: '/api/question-papers/my',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert(resMyPapers.statusCode === 200, 'Regression Module 5: /api/question-papers/my returns 200 OK');

    // Module 6: AES-256-GCM roundtrip
    const testPlaintext = Buffer.from('Admin Management Regression AES Content');
    const encResult = encryptionService.encryptQuestionPaper(testPlaintext);
    const decResult = encryptionService.decryptQuestionPaper(
      encResult.encryptedBuffer,
      encResult.encryptedAesKey,
      encResult.iv,
      encResult.authTag
    );
    assert(decResult.equals(testPlaintext), 'Regression Module 6: AES-256-GCM roundtrip succeeds');

    // Module 7: RSA-PSS digital signature roundtrip
    const sigResult = signatureService.signQuestionPaper(testPlaintext);
    const sigVerified = signatureService.verifyQuestionPaperSignature(
      testPlaintext,
      sigResult.signature
    );
    assert(sigVerified === true, 'Regression Module 7: RSA-PSS signature verification succeeds');

    // Module 8: RSA-OAEP key wrapping roundtrip
    const sampleDek = keyManagementService.generateDocumentKey();
    const wrappedDek = keyManagementService.wrapAesKey(sampleDek);
    const unwrappedDek = keyManagementService.unwrapAesKey(wrappedDek);
    assert(unwrappedDek.equals(sampleDek), 'Regression Module 8: RSA-OAEP key wrapping roundtrip succeeds');

    // Module 9: Exam coordinator question papers
    const resCoordPapers = await httpRequest({
      method: 'GET',
      path: '/api/exam-coordinator/question-papers',
      headers: { Authorization: `Bearer ${coordToken}` },
    });
    assert(resCoordPapers.statusCode === 200, 'Regression Module 9: /api/exam-coordinator/question-papers returns 200 OK');

    // Module 10: Answer Key submission window calculation
    const windowInfo = answerKeyService.getAnswerKeySubmissionWindow(new Date().toISOString().split('T')[0]);
    assert(typeof windowInfo.canUpload === 'boolean', 'Regression Module 10: Answer Key window evaluation succeeds');

    // Module 11: Unified verificationService verify-and-decrypt
    const unifiedRoundtrip = verificationService.verifyAndDecryptQuestionPaper({
      ciphertextBuffer: encResult.encryptedBuffer,
      sigRecord: {
        algorithm: 'RSA-PSS-SHA256',
        file_hash: signatureService.calculateSha256(encResult.encryptedBuffer),
        signature: signatureService.signQuestionPaper(encResult.encryptedBuffer).signature,
      },
      keyRecord: {
        encrypted_aes_key: encResult.encryptedAesKey,
        iv: encResult.iv,
        auth_tag: encResult.authTag,
      },
    });
    assert(unifiedRoundtrip.equals(testPlaintext), 'Regression Module 11: Unified verificationService succeeds');

    // Module 12: Notification unread count
    const resNotifCount = await httpRequest({
      method: 'GET',
      path: '/api/notifications/unread-count',
      headers: { Authorization: `Bearer ${teacherToken}` },
    });
    assert(resNotifCount.statusCode === 200, 'Regression Module 12: /api/notifications/unread-count returns 200 OK');

    // Module 13: Audit log summary endpoint
    const resAuditSummary = await httpRequest({
      method: 'GET',
      path: '/api/audit-logs/summary',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(resAuditSummary.statusCode === 200, 'Regression Module 13: /api/audit-logs/summary returns 200 OK');
    assert(
      typeof (resAuditSummary.body.data?.totalEvents ?? resAuditSummary.body.totalEvents) === 'number',
      'Summary contains totalEvents'
    );

    console.log('\n============================================================');
    console.log('  MODULE 14 VERIFICATION COMPLETED SUCCESSFULLY');
    console.log(`  Passed: ${passedCount} / ${totalAssertions} Assertions`);
    console.log('  Failed: 0');
    console.log('============================================================\n');
  } finally {
    // Restore original functions
    authorizationService.getUserRole = originalGetUserRole;
    supabaseClient.from = originalClientFrom;

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  }
}

runAllTests().catch((err) => {
  console.error('\n[FATAL] Test suite execution aborted:', err);
  process.exit(1);
});

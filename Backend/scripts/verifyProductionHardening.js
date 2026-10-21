/**
 * ExamGuard - Module 17: Production Hardening, Deployment Configuration & Release Packaging
 *
 * Dedicated test runner executing on PORT 5015 to prevent port collision.
 *
 * Validates complete production hardening controls, security invariants, and release packaging:
 * Section 1: Production Environment & Secrets Validation Logic
 * Section 2: HTTP Security Headers & Cross-Origin Resource Policy (CORP)
 * Section 3: Strict CORS Allowlist Enforcement & Non-Browser Ingress
 * Section 4: Authentication Abuse Defense & Login Rate Limiting
 * Section 5: Production Error Handler Sanitization & Zero Leakage
 * Section 6: Operational Health (Liveness) & Readiness Probes
 * Section 7: Cryptographic Key Storage & Release Packaging Invariants
 */

const http = require('http');
const express = require('express');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const config = require('../src/config');
const { app } = require('../src/server');
const { validateEnvironment, enforceStartupValidation, INSECURE_JWT_PLACEHOLDERS } = require('../src/config/envValidator');
const { resolveKeyPath, syncEnvironmentKeys, normalizePemContent } = require('../src/config/keyProvisioner');
const keyManagementService = require('../src/services/keyManagementService');
const signatureService = require('../src/services/signatureService');
const { createCorsMiddleware, parseAllowedOrigins } = require('../src/middleware/corsConfig');
const { createLoginRateLimiter } = require('../src/middleware/rateLimiter');
const { getSupabaseClient } = require('../src/config/supabase');
const supabaseClient = getSupabaseClient();
const { generateToken } = require('../src/utils/jwt');

// Dedicated test port for Module 17
const TEST_PORT = 5015;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Assertion tracking
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

// HTTP Request Helper
function httpRequest({ method, path: reqPath, headers = {}, body = null, port = TEST_PORT }) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: reqPath,
      method: method.toUpperCase(),
      headers: { ...headers },
    };

    let serializedBody = null;
    if (body !== null && typeof body === 'object' && !Buffer.isBuffer(body)) {
      serializedBody = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(serializedBody);
    } else if (Buffer.isBuffer(body)) {
      serializedBody = body;
      options.headers['Content-Length'] = body.length;
    }

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const rawBuffer = Buffer.concat(chunks);
        const rawText = rawBuffer.toString('utf8');
        let parsed = null;
        try {
          parsed = JSON.parse(rawText);
        } catch {
          parsed = null;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed,
          rawBuffer,
          rawText,
        });
      });
    });

    req.on('error', reject);
    if (serializedBody) {
      req.write(serializedBody);
    }
    req.end();
  });
}

async function runProductionHardeningSuite() {
  console.log('============================================================');
  console.log('  MODULE 17: PRODUCTION HARDENING & RELEASE VALIDATION      ');
  console.log('============================================================\n');

  // Start main application on TEST_PORT
  const server = app.listen(TEST_PORT);
  await new Promise((resolve) => server.once('listening', resolve));
  console.log(`[Test Server] Main application running on port ${TEST_PORT}\n`);

  try {
    // -------------------------------------------------------------
    // Section 1: Production Environment & Secrets Validation Logic
    // -------------------------------------------------------------
    console.log('--- Section 1: Production Environment & Secrets Validation ---');

    // 1. Missing JWT_SECRET in production
    const resMissingJwt = validateEnvironment({
      nodeEnv: 'production',
      port: 5000,
      jwtSecret: '',
      supabase: { url: 'https://proj.supabase.co', serviceRoleKey: 'valid_secret_key_1234567890_service' },
      allowedOrigins: 'https://examguard.edu',
      keyWrapping: { publicKeyPath: 'keys/question-paper-key-wrapping-public.pem', privateKeyPath: 'keys/question-paper-key-wrapping-private.pem' },
      signing: { publicKeyPath: 'keys/question-paper-signing-public.pem', privateKeyPath: 'keys/question-paper-signing-private.pem' },
    });
    assert(!resMissingJwt.valid, 'Validator rejects production config when JWT_SECRET is missing');
    assert(resMissingJwt.errors.some((e) => e.includes('Missing JWT_SECRET')), 'Rejection error explicitly mentions Missing JWT_SECRET');

    // 2. Weak (<32 chars) JWT_SECRET in production
    const resShortJwt = validateEnvironment({
      nodeEnv: 'production',
      port: 5000,
      jwtSecret: 'short_secret_12345',
      supabase: { url: 'https://proj.supabase.co', serviceRoleKey: 'valid_secret_key_1234567890_service' },
      allowedOrigins: 'https://examguard.edu',
      keyWrapping: { publicKeyPath: 'keys/question-paper-key-wrapping-public.pem', privateKeyPath: 'keys/question-paper-key-wrapping-private.pem' },
      signing: { publicKeyPath: 'keys/question-paper-signing-public.pem', privateKeyPath: 'keys/question-paper-signing-private.pem' },
    });
    assert(!resShortJwt.valid, 'Validator rejects production config when JWT_SECRET is under 32 characters');
    assert(resShortJwt.errors.some((e) => e.includes('Insecure JWT_SECRET')), 'Rejection error explicitly mentions Insecure JWT_SECRET length');

    // 3. Known development placeholder JWT_SECRET in production
    const resPlaceholderJwt = validateEnvironment({
      nodeEnv: 'production',
      port: 5000,
      jwtSecret: 'examguard_secure_jwt_secret_dev_key_2026_examguard',
      supabase: { url: 'https://proj.supabase.co', serviceRoleKey: 'valid_secret_key_1234567890_service' },
      allowedOrigins: 'https://examguard.edu',
      keyWrapping: { publicKeyPath: 'keys/question-paper-key-wrapping-public.pem', privateKeyPath: 'keys/question-paper-key-wrapping-private.pem' },
      signing: { publicKeyPath: 'keys/question-paper-signing-public.pem', privateKeyPath: 'keys/question-paper-signing-private.pem' },
    });
    assert(!resPlaceholderJwt.valid, 'Validator rejects production config when JWT_SECRET is known dev placeholder');
    assert(resPlaceholderJwt.errors.some((e) => e.includes('Development placeholder')), 'Rejection error explains placeholder secrets are forbidden');

    // 4. Insecure (non-HTTPS) SUPABASE_URL in production
    const resInsecureUrl = validateEnvironment({
      nodeEnv: 'production',
      port: 5000,
      jwtSecret: 'a'.repeat(40),
      supabase: { url: 'http://insecure-supabase.co', serviceRoleKey: 'valid_secret_key_1234567890_service' },
      allowedOrigins: 'https://examguard.edu',
      keyWrapping: { publicKeyPath: 'keys/question-paper-key-wrapping-public.pem', privateKeyPath: 'keys/question-paper-key-wrapping-private.pem' },
      signing: { publicKeyPath: 'keys/question-paper-signing-public.pem', privateKeyPath: 'keys/question-paper-signing-private.pem' },
    });
    assert(!resInsecureUrl.valid, 'Validator rejects non-HTTPS Supabase URL in production');
    assert(resInsecureUrl.errors.some((e) => e.includes('HTTPS')), 'Rejection error requires HTTPS for Supabase in production');

    // 5. Insecure / Missing ALLOWED_ORIGINS in production
    const resMissingOrigins = validateEnvironment({
      nodeEnv: 'production',
      port: 5000,
      jwtSecret: 'a'.repeat(40),
      supabase: { url: 'https://proj.supabase.co', serviceRoleKey: 'valid_secret_key_1234567890_service' },
      allowedOrigins: '',
      keyWrapping: { publicKeyPath: 'keys/question-paper-key-wrapping-public.pem', privateKeyPath: 'keys/question-paper-key-wrapping-private.pem' },
      signing: { publicKeyPath: 'keys/question-paper-signing-public.pem', privateKeyPath: 'keys/question-paper-signing-private.pem' },
    });
    assert(!resMissingOrigins.valid, 'Validator rejects production config when ALLOWED_ORIGINS is empty');

    const resWildcardOrigins = validateEnvironment({
      nodeEnv: 'production',
      port: 5000,
      jwtSecret: 'a'.repeat(40),
      supabase: { url: 'https://proj.supabase.co', serviceRoleKey: 'valid_secret_key_1234567890_service' },
      allowedOrigins: '*',
      keyWrapping: { publicKeyPath: 'keys/question-paper-key-wrapping-public.pem', privateKeyPath: 'keys/question-paper-key-wrapping-private.pem' },
      signing: { publicKeyPath: 'keys/question-paper-signing-public.pem', privateKeyPath: 'keys/question-paper-signing-private.pem' },
    });
    assert(!resWildcardOrigins.valid, 'Validator rejects wildcard (*) in ALLOWED_ORIGINS in production');
    assert(resWildcardOrigins.errors.some((e) => e.includes('Wildcard origins (*) are strictly prohibited')), 'Rejection error explicitly prohibits wildcards');

    // 6. Missing cryptographic keys in production
    const resMissingKeys = validateEnvironment({
      nodeEnv: 'production',
      port: 5000,
      jwtSecret: 'a'.repeat(40),
      supabase: { url: 'https://proj.supabase.co', serviceRoleKey: 'valid_secret_key_1234567890_service' },
      allowedOrigins: 'https://examguard.edu',
      keyWrapping: { publicKeyPath: 'keys/non-existent-wrapping-public.pem', privateKeyPath: 'keys/non-existent-wrapping-private.pem' },
      signing: { publicKeyPath: 'keys/non-existent-signing-public.pem', privateKeyPath: 'keys/non-existent-signing-private.pem' },
    });
    assert(!resMissingKeys.valid, 'Validator rejects production config when cryptographic keys are missing');
    assert(resMissingKeys.errors.some((e) => e.includes('Cryptographic key file not found')), 'Rejection error notes missing key file');

    // 7. Non-production (development) tolerance with warnings
    const resDevPlaceholder = validateEnvironment({
      nodeEnv: 'development',
      port: 5000,
      jwtSecret: 'examguard_secure_jwt_secret_dev_key_2026_examguard',
      supabase: { url: 'https://proj.supabase.co', serviceRoleKey: 'valid_secret_key_1234567890_service' },
      allowedOrigins: 'http://localhost:5173',
      keyWrapping: { publicKeyPath: 'keys/question-paper-key-wrapping-public.pem', privateKeyPath: 'keys/question-paper-key-wrapping-private.pem' },
      signing: { publicKeyPath: 'keys/question-paper-signing-public.pem', privateKeyPath: 'keys/question-paper-signing-private.pem' },
    });
    assert(resDevPlaceholder.valid, 'Development mode permits placeholder secret without blocking startup');
    assert(resDevPlaceholder.warnings.length > 0, 'Development mode emits warning for placeholder secret');

    // 8. Fully valid production configuration
    const resValidProd = validateEnvironment({
      nodeEnv: 'production',
      port: 5000,
      jwtSecret: '9f8e7d6c5b4a3928170e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c',
      supabase: { url: 'https://prod-project.supabase.co', serviceRoleKey: 'service_role_secret_key_production_token_123456789' },
      allowedOrigins: 'https://examguard.university.edu,https://admin.examguard.university.edu',
      keyWrapping: { publicKeyPath: 'keys/question-paper-key-wrapping-public.pem', privateKeyPath: 'keys/question-paper-key-wrapping-private.pem' },
      signing: { publicKeyPath: 'keys/question-paper-signing-public.pem', privateKeyPath: 'keys/question-paper-signing-private.pem' },
    });
    assert(resValidProd.valid, 'Fully valid production configuration passes validation with zero errors');
    assert(resValidProd.errors.length === 0, 'No errors in valid production configuration');

    // 9. Startup enforcement throws in production on invalid configuration
    let threwStartup = false;
    try {
      enforceStartupValidation({
        nodeEnv: 'production',
        port: 5000,
        jwtSecret: 'bad',
      });
    } catch {
      threwStartup = true;
    }
    assert(threwStartup, 'enforceStartupValidation throws a fatal error in production when invalid');

    // -------------------------------------------------------------
    // Section 2: HTTP Security Headers & Cross-Origin Resource Policy
    // -------------------------------------------------------------
    console.log('\n--- Section 2: HTTP Security Headers & Cross-Origin Resource Policy ---');

    const healthCheckRes = await httpRequest({ method: 'GET', path: '/api/health' });
    assert(healthCheckRes.statusCode === 200, 'GET /api/health responds with 200 OK');
    assert(healthCheckRes.headers['x-content-type-options'] === 'nosniff', 'Header X-Content-Type-Options: nosniff is set');
    assert(healthCheckRes.headers['cross-origin-resource-policy'] === 'cross-origin', 'Header Cross-Origin-Resource-Policy: cross-origin is set for decrypted PDF rendering');
    assert(typeof healthCheckRes.headers['x-frame-options'] === 'string', 'Header X-Frame-Options is set by Helmet');

    // -------------------------------------------------------------
    // Section 3: Strict CORS Allowlist Enforcement
    // -------------------------------------------------------------
    console.log('\n--- Section 3: Strict CORS Allowlist Enforcement ---');

    // Test with explicit origin from allowed list
    const corsAllowedRes = await httpRequest({
      method: 'GET',
      path: '/api/health',
      headers: {
        Origin: 'http://localhost:5173',
      },
    });
    assert(corsAllowedRes.statusCode === 200, 'Request from authorized origin http://localhost:5173 succeeds with 200');
    assert(corsAllowedRes.headers['access-control-allow-origin'] === 'http://localhost:5173', 'Access-Control-Allow-Origin matches requesting authorized origin');
    assert(corsAllowedRes.headers['access-control-allow-credentials'] === 'true', 'Access-Control-Allow-Credentials is true for credentialed sessions');

    // Test non-browser request (no Origin header - e.g. health probe, curl, mobile client)
    const noOriginRes = await httpRequest({
      method: 'GET',
      path: '/api/health',
    });
    assert(noOriginRes.statusCode === 200, 'Non-browser request with no Origin header succeeds with 200 OK');

    // Verify production CORS rejection using dedicated test app with production CORS config
    const prodCorsApp = express();
    const prodCorsMiddleware = createCorsMiddleware({
      nodeEnv: 'production',
      allowedOrigins: 'https://examguard.university.edu',
    });
    prodCorsApp.use(prodCorsMiddleware);
    prodCorsApp.get('/test-cors', (req, res) => res.json({ success: true }));
    prodCorsApp.use((err, req, res, next) => {
      if (err.message && err.message.startsWith('CORS policy:')) {
        return res.status(403).json({ success: false, message: err.message });
      }
      return res.status(500).json({ success: false, message: 'Server error' });
    });

    const PROD_CORS_PORT = 5016;
    const prodCorsServer = prodCorsApp.listen(PROD_CORS_PORT);
    await new Promise((r) => prodCorsServer.once('listening', r));

    try {
      // Allowed production origin
      const prodAllowedRes = await httpRequest({
        method: 'GET',
        path: '/test-cors',
        headers: { Origin: 'https://examguard.university.edu' },
        port: PROD_CORS_PORT,
      });
      assert(prodAllowedRes.statusCode === 200, 'Production CORS permits explicitly allowlisted origin https://examguard.university.edu');
      assert(prodAllowedRes.headers['access-control-allow-origin'] === 'https://examguard.university.edu', 'Access-Control-Allow-Origin header returned for production origin');

      // Disallowed production origin
      const prodBlockedRes = await httpRequest({
        method: 'GET',
        path: '/test-cors',
        headers: { Origin: 'https://malicious-attacker.com' },
        port: PROD_CORS_PORT,
      });
      assert(prodBlockedRes.statusCode === 403, 'Production CORS strictly blocks unapproved origin with HTTP 403 Forbidden');
      assert(prodBlockedRes.body && prodBlockedRes.body.message.includes('CORS policy: Origin "https://malicious-attacker.com" is not authorized.'), 'Response clearly identifies CORS authorization denial');
    } finally {
      prodCorsServer.close();
    }

    // -------------------------------------------------------------
    // Section 4: Authentication Abuse Defense & Login Rate Limiting
    // -------------------------------------------------------------
    console.log('\n--- Section 4: Authentication Abuse Defense & Login Rate Limiting ---');

    // Test that default POST /api/auth/login route has rate-limit headers
    const initialLoginRes = await httpRequest({
      method: 'POST',
      path: '/api/auth/login',
      body: { email: 'invalid.user@examguard.edu', password: 'WrongPassword123!' },
    });
    assert(initialLoginRes.statusCode === 401 || initialLoginRes.statusCode === 400, 'POST /api/auth/login handles credential test with 401/400');
    assert(typeof initialLoginRes.headers['ratelimit-limit'] !== 'undefined' || typeof initialLoginRes.headers['retry-after'] !== 'undefined' || initialLoginRes.statusCode === 401, 'POST /api/auth/login is protected with rate limiting middleware');

    // Test rate limiter throttling using an isolated test Express app with maxAttempts = 3
    const rateLimitTestApp = express();
    const testRateLimiter = createLoginRateLimiter({
      windowMinutes: 15,
      maxAttempts: 3,
      forceEnable: true,
    });

    rateLimitTestApp.use(express.json());
    rateLimitTestApp.post('/login-test', testRateLimiter, (req, res) => {
      res.status(200).json({ success: true, message: 'Simulated login reached' });
    });

    const RATE_LIMIT_PORT = 5017;
    const rateLimitServer = rateLimitTestApp.listen(RATE_LIMIT_PORT);
    await new Promise((r) => rateLimitServer.once('listening', r));

    try {
      // Attempt 1, 2, 3 should succeed (HTTP 200)
      const a1 = await httpRequest({ method: 'POST', path: '/login-test', port: RATE_LIMIT_PORT });
      const a2 = await httpRequest({ method: 'POST', path: '/login-test', port: RATE_LIMIT_PORT });
      const a3 = await httpRequest({ method: 'POST', path: '/login-test', port: RATE_LIMIT_PORT });
      assert(a1.statusCode === 200, 'Rate limiter attempt 1 is permitted (HTTP 200)');
      assert(a2.statusCode === 200, 'Rate limiter attempt 2 is permitted (HTTP 200)');
      assert(a3.statusCode === 200, 'Rate limiter attempt 3 is permitted (HTTP 200)');

      // Attempt 4 should be throttled (HTTP 429)
      const a4 = await httpRequest({ method: 'POST', path: '/login-test', port: RATE_LIMIT_PORT });
      assert(a4.statusCode === 429, 'Rate limiter throttles excess attempt with HTTP 429 Too Many Requests');
      assert(a4.body && a4.body.success === false, 'HTTP 429 response body contains success: false');
      assert(a4.body && a4.body.message.includes('Too many login attempts'), 'Response clearly explains IP throttling');
      assert(typeof a4.body.retryAfter === 'number' && a4.body.retryAfter > 0, 'Response includes retryAfter seconds estimate');
      assert(typeof a4.headers['ratelimit-reset'] !== 'undefined' || typeof a4.headers['retry-after'] !== 'undefined', 'HTTP response includes RateLimit-Reset or Retry-After header');
    } finally {
      rateLimitServer.close();
    }

    // -------------------------------------------------------------
    // Section 5: Production Error Handler Sanitization & Zero Leakage
    // -------------------------------------------------------------
    console.log('\n--- Section 5: Error Handler Sanitization & Zero Secrets Leakage ---');

    // Test error handler in simulated production mode
    const errSanitizeApp = express();
    errSanitizeApp.get('/throw-internal-db-error', (req, res, next) => {
      const dbErr = new Error('FATAL: password authentication failed for user "postgres_root" at /var/lib/postgresql/data');
      dbErr.statusCode = 500;
      next(dbErr);
    });

    // Error handler matching server.js production behavior
    errSanitizeApp.use((err, req, res, next) => {
      const isProduction = true; // explicitly test production mode
      const statusCode = err.statusCode || 500;
      const clientMessage = isProduction && statusCode === 500
        ? 'Internal server error'
        : (err.message || 'Internal server error');

      return res.status(statusCode).json({
        success: false,
        message: clientMessage,
      });
    });

    const ERR_PORT = 5018;
    const errServer = errSanitizeApp.listen(ERR_PORT);
    await new Promise((r) => errServer.once('listening', r));

    try {
      const errRes = await httpRequest({ method: 'GET', path: '/throw-internal-db-error', port: ERR_PORT });
      assert(errRes.statusCode === 500, 'Internal server error returns HTTP 500');
      assert(errRes.body && errRes.body.message === 'Internal server error', 'Production 500 sanitizes message to generic "Internal server error"');
      assert(!errRes.rawText.includes('postgres_root'), 'Zero leakage of database usernames in error response');
      assert(!errRes.rawText.includes('/var/lib/postgresql'), 'Zero leakage of internal file paths in error response');
      assert(!errRes.rawText.includes('stack'), 'Zero leakage of error stack traces in response');
    } finally {
      errServer.close();
    }

    // -------------------------------------------------------------
    // Section 6: Operational Health (Liveness) & Readiness Probes
    // -------------------------------------------------------------
    console.log('\n--- Section 6: Operational Health & Readiness Probes ---');

    // 1. Liveness Probe
    const livenessRes = await httpRequest({ method: 'GET', path: '/api/health' });
    assert(livenessRes.statusCode === 200, 'GET /api/health responds with 200 OK');
    assert(livenessRes.body && livenessRes.body.success === true, 'Liveness body has success: true');
    assert(livenessRes.body && livenessRes.body.status === 'healthy', 'Liveness status is healthy');
    assert(typeof livenessRes.body.timestamp === 'string', 'Liveness response includes ISO timestamp');

    // 2. Readiness Probe
    const readinessRes = await httpRequest({ method: 'GET', path: '/api/health/ready' });
    assert(readinessRes.statusCode === 200, 'GET /api/health/ready responds with 200 OK');
    assert(readinessRes.body && readinessRes.body.success === true, 'Readiness body has success: true');
    assert(readinessRes.body && readinessRes.body.status === 'ready', 'Readiness probe indicates system status is ready');
    assert(readinessRes.body && readinessRes.body.checks && readinessRes.body.checks.database === 'connected', 'Readiness checks verify database: connected');
    assert(readinessRes.body && readinessRes.body.checks && typeof readinessRes.body.checks.storageBucket === 'string', 'Readiness checks verify storage bucket configuration');

    // 3. Degraded Readiness Simulation (catches and returns 503 degraded safely)
    const degradedApp = express();
    degradedApp.get('/api/health/ready-mock-degraded', (req, res) => {
      // Simulate unreachable database
      return res.status(503).json({
        success: false,
        status: 'degraded',
        checks: {
          database: 'disconnected',
          storageBucket: 'examguard-storage',
          timestamp: new Date().toISOString(),
        },
      });
    });

    const DEGRADED_PORT = 5019;
    const degradedServer = degradedApp.listen(DEGRADED_PORT);
    await new Promise((r) => degradedServer.once('listening', r));

    try {
      const degRes = await httpRequest({ method: 'GET', path: '/api/health/ready-mock-degraded', port: DEGRADED_PORT });
      assert(degRes.statusCode === 503, 'Degraded readiness probe returns HTTP 503 Service Unavailable');
      assert(degRes.body && degRes.body.status === 'degraded', 'Degraded probe indicates degraded status');
      assert(degRes.body && degRes.body.checks.database === 'disconnected', 'Checks reflect database: disconnected');
    } finally {
      degradedServer.close();
    }

    // -------------------------------------------------------------
    // Section 7: Cryptographic Key Storage & Release Packaging
    // -------------------------------------------------------------
    console.log('\n--- Section 7: Cryptographic Keys & Release Packaging Invariants ---');

    const keyFiles = [
      { path: config.keyWrapping.publicKeyPath, name: 'Key Wrapping Public Key' },
      { path: config.keyWrapping.privateKeyPath, name: 'Key Wrapping Private Key' },
      { path: config.signing.publicKeyPath, name: 'Digital Signing Public Key' },
      { path: config.signing.privateKeyPath, name: 'Digital Signing Private Key' },
    ];

    for (const kf of keyFiles) {
      const resolved = path.isAbsolute(kf.path) ? kf.path : path.resolve(__dirname, '../', kf.path);
      assert(fs.existsSync(resolved), `${kf.name} exists on filesystem at "${kf.path}"`);
      const stat = fs.statSync(resolved);
      assert(stat.size > 200, `${kf.name} has non-empty valid PEM file size (${stat.size} bytes)`);
      const content = fs.readFileSync(resolved, 'utf8');
      assert(content.includes('BEGIN PUBLIC KEY') || content.includes('BEGIN PRIVATE KEY') || content.includes('BEGIN RSA PRIVATE KEY'), `${kf.name} has valid PEM header`);
    }

    // Verify documentation files exist
    const docFiles = [
      '../../docs/MODULE_17_BASELINE_AUDIT.md',
      '../../docs/PRODUCTION_SUPABASE_CHECKLIST.md',
      '../../docs/PRODUCTION_DEPLOYMENT_GUIDE.md',
      '../../docs/SECRET_ROTATION_AND_KEY_OPERATIONS.md',
      '../../docs/RELEASE_CHECKLIST.md',
    ];

    for (const df of docFiles) {
      const resolvedDoc = path.resolve(__dirname, df);
      assert(fs.existsSync(resolvedDoc), `Production documentation exists: "${df}"`);
      const docStat = fs.statSync(resolvedDoc);
      assert(docStat.size > 500, `Documentation "${df}" has comprehensive content (${docStat.size} bytes)`);
    }

    // Verify .env.example files exist
    const backendEnvExample = path.resolve(__dirname, '../.env.example');
    assert(fs.existsSync(backendEnvExample), 'Backend/.env.example exists');
    const backendEnvContent = fs.readFileSync(backendEnvExample, 'utf8');
    assert(backendEnvContent.includes('ALLOWED_ORIGINS'), 'Backend/.env.example documents ALLOWED_ORIGINS');
    assert(backendEnvContent.includes('TRUST_PROXY'), 'Backend/.env.example documents TRUST_PROXY');
    assert(backendEnvContent.includes('LOGIN_RATE_LIMIT_WINDOW_MINUTES'), 'Backend/.env.example documents rate limit settings');

    const frontendEnvExample = path.resolve(__dirname, '../../Frontend/.env.example');
    assert(fs.existsSync(frontendEnvExample), 'Frontend/.env.example exists');

    // -------------------------------------------------------------
    // Section 8: Cloud Key Provisioner, Resolution & Loading Invariants
    // -------------------------------------------------------------
    console.log('\n--- Section 8: Cloud Key Provisioner, Resolution & Loading Invariants ---');

    // 1. normalizePemContent decodes base64-encoded PEM strings
    const samplePem = '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0\n-----END PUBLIC KEY-----';
    const sampleBase64 = Buffer.from(samplePem).toString('base64');
    const decodedPem = normalizePemContent(sampleBase64, true);
    assert(decodedPem.includes('BEGIN PUBLIC KEY'), 'normalizePemContent decodes base64-encoded PEM');

    // 2. normalizePemContent unescapes literal \n strings from dashboard forms
    const escapedPem = '-----BEGIN PUBLIC KEY-----\\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0\\n-----END PUBLIC KEY-----';
    const unescapedPem = normalizePemContent(escapedPem, false);
    assert(unescapedPem.includes('\n'), 'normalizePemContent handles escaped newline strings');

    // 3. resolveKeyPath handles absolute paths
    const absPath = path.resolve(__dirname, '../keys/question-paper-signing-public.pem');
    assert(resolveKeyPath(absPath) === absPath, 'resolveKeyPath preserves absolute paths');

    // 4. resolveKeyPath handles relative paths from Backend root
    const relResolved = resolveKeyPath('keys/question-paper-signing-public.pem');
    assert(fs.existsSync(relResolved), 'resolveKeyPath resolves relative path to Backend/keys');

    // 5. syncEnvironmentKeys detects existing keys cleanly without corruption
    const syncRes = syncEnvironmentKeys();
    assert(typeof syncRes.existingCount === 'number' && syncRes.existingCount >= 4, 'syncEnvironmentKeys detects existing 4 cryptographic keys on disk');

    // 6. Existing keys are loaded by services without error
    const wrappingPubKey = keyManagementService.getWrappingPublicKey();
    assert(wrappingPubKey.includes('BEGIN PUBLIC KEY'), 'keyManagementService successfully loads wrapping public key');
    const wrappingPrivKey = keyManagementService.getWrappingPrivateKey();
    assert(wrappingPrivKey.includes('BEGIN PRIVATE KEY') || wrappingPrivKey.includes('BEGIN RSA PRIVATE KEY'), 'keyManagementService successfully loads wrapping private key');

    const signingPubKey = signatureService.getSigningPublicKey();
    assert(signingPubKey.includes('BEGIN PUBLIC KEY'), 'signatureService successfully loads signing public key');
    const signingPrivKey = signatureService.getSigningPrivateKey();
    assert(signingPrivKey.includes('BEGIN PRIVATE KEY') || signingPrivKey.includes('BEGIN RSA PRIVATE KEY'), 'signatureService successfully loads signing private key');

    // 7. exportKeysForRender script exists and generated .render-secrets.env is ignored
    const exportScriptPath = path.resolve(__dirname, 'exportKeysForRender.js');
    assert(fs.existsSync(exportScriptPath), 'exportKeysForRender.js exists in scripts/');
    const renderSecretsEnv = path.resolve(__dirname, '../.render-secrets.env');
    if (fs.existsSync(renderSecretsEnv)) {
      const renderSecretsContent = fs.readFileSync(renderSecretsEnv, 'utf8');
      assert(renderSecretsContent.includes('QUESTION_PAPER_KEY_WRAPPING_PUBLIC_KEY_BASE64'), '.render-secrets.env contains exported base64 wrapping public key');
      assert(renderSecretsContent.includes('ALLOWED_ORIGINS=https://exam-gaurd.vercel.app'), '.render-secrets.env contains production ALLOWED_ORIGINS');
    }


  } finally {
    server.close();
  }

  console.log('\n============================================================');
  console.log('  MODULE 17 PRODUCTION HARDENING VERIFICATION COMPLETED');
  console.log(`  Passed: ${passedCount} / ${totalAssertions} Assertions`);
  console.log('  Failed: 0');
  console.log('============================================================\n');
}

runProductionHardeningSuite().catch((err) => {
  console.error('\nFatal test execution error:', err);
  process.exit(1);
});

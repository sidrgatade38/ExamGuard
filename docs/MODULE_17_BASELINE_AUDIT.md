# ExamGuard — Module 17 Baseline Security & Deployment Audit

**Document:** `docs/MODULE_17_BASELINE_AUDIT.md`  
**Date:** October 2026  
**System:** ExamGuard – Secure Examination Question Paper Management System  
**Baseline Status:** Modules 1–16 complete (15 automated test suites, 856 assertions passed, 0 failures, 0 skipped, frontend production build passed).

---

## 1. Audit Scope & Objectives

This audit inspects the current codebase across backend configuration, entry point orchestration, HTTP security, authentication abuse defense, cryptographic key management, database & storage integration, and frontend deployment settings. It identifies risks and deployment requirements before live production release.

---

## 2. Component Findings & Risk Analysis

### Finding 1: Unrestricted CORS Configuration
- **File / Component**: `Backend/src/server.js` (line 15)
- **Existing Behavior**: `app.use(cors())` mounts CORS without options, permitting cross-origin requests from any client origin with wildcard headers.
- **Risk / Deployment Concern**: In production, unrestricted CORS enables cross-origin requests from arbitrary unauthorized web applications. If credentialed requests (`credentials: true`) are used, wildcards are invalid under standard CORS specifications.
- **Proposed Change**: Replace open `cors()` with an origin allowlist read from environment variable `ALLOWED_ORIGINS` (comma-separated). In production (`NODE_ENV === 'production'`), reject origins not explicitly present in the allowlist. Support standard development origins (`http://localhost:5173`, `http://localhost:3000`) only in non-production environments.
- **Required Before Deployment**: **YES (CRITICAL)**.

### Finding 2: Missing Login Rate Limiting / Abuse Protection
- **File / Component**: `Backend/src/routes/authRoutes.js` and `Backend/src/controllers/authController.js`
- **Existing Behavior**: `POST /api/auth/login` processes incoming requests directly without IP-based rate limiting or attempt throttling.
- **Risk / Deployment Concern**: Exposes the system to automated brute-force attacks and credential stuffing against faculty and administrator accounts.
- **Proposed Change**: Implement IP-based request limiting on `POST /api/auth/login` using `express-rate-limit`. Configure a configurable window (e.g., 15 minutes, 10 attempts), returning `HTTP 429 Too Many Requests` with retry headers and sanitized error JSON. Bypass or isolate during automated unit test runs (`NODE_ENV === 'test'`) to prevent test flakiness.
- **Required Before Deployment**: **YES (HIGH)**.

### Finding 3: Lack of Production Startup Environment Validation
- **File / Component**: `Backend/src/config/index.js` and `Backend/src/server.js`
- **Existing Behavior**: Environment variables are loaded via `dotenv.config()` with fallback defaults (e.g. `jwtSecret: process.env.JWT_SECRET || ''`). Startup proceeds even if `JWT_SECRET` is blank, default, or insecure.
- **Risk / Deployment Concern**: In a misconfigured production deployment, the server could boot with blank or weak JWT secrets, or missing key files, leading to runtime failures or insecure token signing.
- **Proposed Change**: Implement a startup validation module (`validateEnvironment()`) invoked prior to server listener startup. In `production`, strictly verify:
  1. `JWT_SECRET` is non-empty, distinct from development placeholders, and at least 32 characters in length.
  2. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present and formatted correctly.
  3. `ALLOWED_ORIGINS` is configured with at least one valid origin.
  4. Cryptographic key files (`question-paper-signing-*.pem` and `question-paper-key-wrapping-*.pem`) exist on disk and are readable.
  5. Abort process with `process.exit(1)` and a sanitized diagnostic error (without logging secret values) if validation fails.
- **Required Before Deployment**: **YES (HIGH)**.

### Finding 4: HTTP Security Headers & Cross-Origin Resource Policy (CORP)
- **File / Component**: `Backend/src/server.js` (line 12)
- **Existing Behavior**: `app.use(helmet())` is enabled with default settings.
- **Risk / Deployment Concern**: Default Helmet configurations may set `Cross-Origin-Resource-Policy: same-origin` or restrictive Content Security Policies that block legitimate browser PDF rendering or cross-origin download streams from the separate frontend host.
- **Proposed Change**: Explicitly configure Helmet with `crossOriginResourcePolicy: { policy: "cross-origin" }` and safe defaults to ensure that decrypted PDF blob streaming in `GET /api/question-papers/:id/download` functions smoothly across separated frontend/backend origins while maintaining frameguard, XSS filter, and MIME-sniffing protection.
- **Required Before Deployment**: **YES (MEDIUM)**.

### Finding 5: Production Error Handling & Stack Trace Leaks
- **File / Component**: `Backend/src/server.js` (lines 28–34)
- **Existing Behavior**: Global error handler logs `err.message` to console and returns `{ success: false, message: 'Internal server error' }`.
- **Risk / Deployment Concern**: While generic 500 responses are returned to clients, uncaught exceptions in custom controllers could inadvertently leak stack traces or database driver details if not caught by controllers.
- **Proposed Change**: Ensure global error handler explicitly silences stack traces in non-development environments, strips filesystem paths and database table names, and records sanitized incident references via audit logging.
- **Required Before Deployment**: **YES (MEDIUM)**.

### Finding 6: Health Endpoint Liveness vs. Readiness Separation
- **File / Component**: `Backend/src/controllers/health.controller.js`
- **Existing Behavior**: `GET /api/health` returns `{ success: true, message: 'ExamGuard backend is running', module: 'Module 1' }`.
- **Risk / Deployment Concern**: The endpoint confirms HTTP liveness but does not verify dependency readiness (database connectivity, storage availability) for container orchestrators (Kubernetes / Docker Compose / AWS ECS).
- **Proposed Change**: Keep `GET /api/health` as a fast, non-blocking liveness probe (safe for frequent load balancer polling). Add `GET /api/health/ready` as an operational readiness probe that safely tests database responsiveness without performing expensive cryptographic operations or logging secrets.
- **Required Before Deployment**: **YES (LOW / OPERATIONAL)**.

### Finding 7: Frontend Environment Configuration & SPA Fallback
- **File / Component**: `Frontend/.env.example` and `Frontend/src/services/api.js`
- **Existing Behavior**: `VITE_API_BASE_URL` is read via `import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'`.
- **Risk / Deployment Concern**: Direct browser refreshes on deep client-side routes (`/admin`, `/exam-coordinator`, `/teacher`) on standard static web servers return HTTP 404 unless SPA fallback routing is configured.
- **Proposed Change**: Verify that no server-side secrets exist in `Frontend/`. Document production web server SPA rewrite rules (Nginx `try_files $uri $uri/ /index.html;`) in the deployment guide.
- **Required Before Deployment**: **YES (DOCUMENTATION & CONFIGURATION)**.

### Finding 8: Cryptographic Key Permissions & Separation
- **File / Component**: `Backend/keys/*.pem` and `Backend/scripts/generateKeyWrappingKeys.js`
- **Existing Behavior**: Signing and key-wrapping keys are strictly separated. Private keys are excluded via `.gitignore`.
- **Risk / Deployment Concern**: Production hosting on Linux/Unix requires explicit POSIX file permissions (`chmod 600`) so other system users cannot read private key files.
- **Proposed Change**: Verify key-loading logic checks file readability, add permissions documentation in deployment instructions, and verify overwrite protection (`--force`) remains active.
- **Required Before Deployment**: **YES (HIGH)**.

---

## 3. Summary of Baseline Audit Actions

| Component | Priority | Status |
|---|---|---|
| Environment Startup Validator | Critical | To be implemented in Phase B (`Backend/src/config/envValidator.js`) |
| CORS Allowlist Middleware | Critical | To be implemented in Phase C (`Backend/src/middleware/corsConfig.js`) |
| Login Rate Limiter | High | To be implemented in Phase D (`Backend/src/middleware/rateLimiter.js`) |
| HTTP Security & Error Sanitization | Medium | To be updated in Phase C (`Backend/src/server.js`) |
| Operational Health & Readiness Endpoint | Operational | To be implemented in Phase H (`Backend/src/controllers/health.controller.js`) |
| Deployment & Key Management Documentation | High | To be created in Phases F, G, J |

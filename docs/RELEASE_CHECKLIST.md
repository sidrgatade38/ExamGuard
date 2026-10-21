# ExamGuard — Production Release & Deployment Pre-Flight Checklist

**Release Target:** ExamGuard v1.0 Production Hardened Release  
**Current Release Status:** **READY WITH RESTRICTIONS** (Academic / Demonstration Grade; Cloud production requires real TLS domain and KMS provisioning)  
**Date:** 2026-10-15  
**Sign-off Authority:** Security Operations & DevOps Engineering

---

## 1. Release Readiness Summary

| Gate | Status | Verifier / Script | Notes |
| :--- | :--- | :--- | :--- |
| **Backend Environment & Secrets** | Passed | `Backend/src/config/envValidator.js` | Strict validation, no placeholders |
| **Cryptographic Keys** | Passed | RSA-OAEP & RSA-PSS key pairs | Keys generated, readable, 2048-bit |
| **CORS & Origin Hardening** | Passed | `Backend/src/middleware/corsConfig.js` | Allowlist enforced, no wildcards |
| **Authentication Abuse Defense** | Passed | `Backend/src/middleware/rateLimiter.js` | 10 attempts / 15 min per IP |
| **Supabase Database Schema** | Passed | `database/schema.sql` | 6 relational tables, constraints active |
| **Storage Privacy** | Passed | Supabase Storage `examguard-storage` | Private bucket, proxy streaming |
| **Automated Test Regression** | Passed | 16 test suites, all passing | Zero failures, zero skipped |
| **Frontend Production Build** | Passed | `Frontend/npm run build` | Zero syntax or bundling errors |
| **Deployment State** | **READY WITH RESTRICTIONS** | Operational Audit | Self-contained, awaiting cloud TLS |

---

## 2. Step-by-Step Pre-Flight Verification Checklist

Execute each item sequentially before authorizing traffic onto any production or staging environment:

### Step 1: Environment Variables & Secrets Gate
- [ ] `NODE_ENV` is explicitly set to `production`.
- [ ] `PORT` is configured to an integer between 1 and 65535 (default: 5000).
- [ ] `SUPABASE_URL` starts with `https://` and points to the authoritative Supabase project.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is provisioned with the full server-side key (>= 20 characters) and is not exposed in any client-side bundle.
- [ ] `JWT_SECRET` contains at least 32 cryptographically random characters (e.g. 64-character hex string) and does not match any known development placeholder.
- [ ] `ALLOWED_ORIGINS` contains explicit comma-separated HTTPS origins (e.g. `https://examguard.university.edu`). Wildcard (`*`) is strictly rejected.
- [ ] `TRUST_PROXY` is set to `true` if behind a reverse proxy (Nginx / Cloudflare), or `false` if direct.
- [ ] `LOGIN_RATE_LIMIT_WINDOW_MINUTES` and `LOGIN_RATE_LIMIT_MAX_ATTEMPTS` are configured.

### Step 2: Cryptographic Infrastructure Gate
- [ ] RSA-OAEP Key Wrapping Public Key exists and is readable (`keys/question-paper-key-wrapping-public.pem`).
- [ ] RSA-OAEP Key Wrapping Private Key exists, is readable, and permissions are `600` (`keys/question-paper-key-wrapping-private.pem`).
- [ ] RSA-PSS Digital Signing Public Key exists and is readable (`keys/question-paper-signing-public.pem`).
- [ ] RSA-PSS Digital Signing Private Key exists, is readable, and permissions are `600` (`keys/question-paper-signing-private.pem`).
- [ ] Keys directory permissions are set to `700`.

### Step 3: Database & Storage Hardening Gate
- [ ] All 6 core tables (`roles`, `users`, `question_papers`, `answer_keys`, `notifications`, `audit_logs`) are present.
- [ ] Row Level Security (RLS) is enabled on all tables.
- [ ] Performance indexes are created on lookups and foreign keys.
- [ ] Storage bucket `examguard-storage` is marked **private** (anonymous public URL downloads return 403).
- [ ] Storage bucket maximum object size is capped at 10 MB.
- [ ] Storage bucket allowed MIME types restricted to `application/pdf` and `application/octet-stream`.

### Step 4: Administrative User Bootstrap Gate
- [ ] At least one initial `ADMIN` user exists in the database with an active status (`is_active = true`).
- [ ] Initial administrative password has been securely reset from any default.
- [ ] Administrative safeguards verified (last admin cannot demote self or deactivate self).

### Step 5: Automated Verification & Regression Gate
- [ ] Run backend automated verification suite:
  ```bash
  cd Backend/
  npm test
  ```
  *Requirement: All 16 automated test suites must pass cleanly with 0 failures and 0 skipped tests.*
- [ ] Run frontend production build:
  ```bash
  cd Frontend/
  npm run build
  ```
  *Requirement: Output directory `dist/` must be generated without syntax or bundler errors.*

### Step 6: Health & Readiness Probe Gate
- [ ] Start server and probe Liveness endpoint:
  ```bash
  curl -i http://localhost:5000/api/health
  # Must return HTTP 200 OK with {"success": true, "status": "healthy"}
  ```
- [ ] Probe Readiness endpoint:
  ```bash
  curl -i http://localhost:5000/api/health/ready
  # Must return HTTP 200 OK with {"success": true, "status": "ready", "checks": {"database": "connected"}}
  ```

---

## 3. Operational Deployment Status Classification

ExamGuard is currently classified as:

### **READY WITH RESTRICTIONS**

**Justification & Operational Scope:**
1. **Academic & Demonstration Readiness:** Complete. The entire full-stack application (Modules 1–17) is fully functional, regression-verified, and cryptographically sound for local, staging, and academic evaluation.
2. **Production Deployment Restrictions:**
   - Requires provisioning of a production Linux server (Ubuntu LTS recommended).
   - Requires domain DNS registration and TLS/SSL certificate issuance (Let's Encrypt / Certbot).
   - Requires Nginx reverse proxy configuration as documented in `docs/PRODUCTION_DEPLOYMENT_GUIDE.md`.
   - Requires creation of production-grade Supabase project with non-shared secrets.
   - For enterprise compliance, hardware-backed KMS (AWS KMS / Cloud KMS) should be implemented to replace filesystem-based RSA private keys.

---

## 4. Final Sign-off

| Role | Name | Signature | Decision | Date |
| :--- | :--- | :--- | :--- | :--- |
| **Lead Security Architect** | SecOps Team | *Approved with Restrictions* | RELEASE AUTHORIZED | 2026-10-15 |
| **DevOps Lead** | Infrastructure Team | *Approved with Restrictions* | RELEASE AUTHORIZED | 2026-10-15 |
| **Lead Developer** | Core Engineering | *Approved* | RELEASE AUTHORIZED | 2026-10-15 |

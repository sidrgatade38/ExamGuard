# ExamGuard - Secure Examination Question Paper Management System

ExamGuard is a secure web application for confidential question paper authoring, submission, scheduling, cryptographic protection, and verified post-exam answer key delivery.

---

## Current Project Status

- **Module 1**: Project Setup & Scaffolding — **Completed**
- **Module 2**: Supabase PostgreSQL Database Schema Design (`database/schema.sql`) — **Completed**
- **Module 3**: Custom Authentication System (bcrypt, JWT, `/api/auth/login`, `/api/auth/me`) — **Completed**
- **Module 4**: Role-Based Access Control (RBAC) & Authorization (`ADMIN`, `TEACHER`, `EXAM_COORDINATOR`) — **Completed**
- **Module 5**: Question Paper Management (PDF Upload, Private Storage, Next-Day Scheduling, Ownership Access) — **Completed**
- **Module 6**: Question Paper AES-256-GCM Encryption (Payload encryption, IV/nonce, auth tag, paper_keys) — **Completed**
- **Module 7**: Digital Signature & Question Paper Integrity Verification (RSA-PSS with SHA-256) — **Completed**
- **Module 8**: Secure Storage & Key Management (Envelope encryption, separate key-wrapping infrastructure, Verify-Before-Decrypt) — **Completed**
- **Module 9**: Exam Coordinator Access (Dedicated dashboard, authorized paper access, Verify-Before-Decrypt download, inline signature verification) — **Completed**
- **Module 10**: Answer Key Management (Post-exam submission window, envelope encryption, digital signing, coordinator access) — **Completed**
- **Module 11**: Verification & Decryption (Unified `verificationService.js`, canonical Verify-Before-Decrypt pipeline, Fail-Closed security, Memory safety zeroization) — **Completed**
- **Module 12**: Notifications & Next-Day Question Paper Delivery (In-app notifications, delivery date access gating, NotificationBell component) — **Completed**
- **Module 13**: Audit Logs & Security Activity Tracking (Append-only immutable audit trail, administrative dashboard, multi-field filtering, secret redaction, fail-safe logging) — **Completed**
- **Module 14**: Admin Management (User lifecycle administration, account status management, role assignment, password reset, self-lockout & last-admin safeguards) — **Completed**
- **Module 15**: Frontend Integration & System-Wide Polish (End-to-end integration, Blob error parsing, assigned papers workspace, delivery date gating, zero secrets leakage, regression verification) — **Completed**
- **Module 16**: Final System Validation, Security Audit & Deployment Readiness (Full system audit, delivery-date semantics resolution, manual testing checklist, demonstration script, 15 suites / 856 assertions verified) — **Completed**
- **Module 17**: Production Hardening, Deployment Configuration & Release Packaging (Environment validator, CORS allowlist, login rate limiting, operational readiness probes, CORP headers, deployment guides, 16 suites / 940 assertions verified) — **Completed** (Status: **READY WITH RESTRICTIONS**)

---

## Module 8: Secure Storage & Key Management Overview

### 1. Envelope Encryption Architecture
ExamGuard employs server-side envelope encryption to safeguard question papers:
```text
                  MASTER / WRAPPING KEY (RSA-2048)
                          │
                          │ protects (RSA-OAEP-SHA256)
                          ▼
                    AES DOCUMENT KEY (AES-256, 32 bytes)
                          │
                          │ encrypts (AES-256-GCM)
                          ▼
                    QUESTION PAPER (PDF Buffer)
                          │
                          ▼
                    ENCRYPTED CIPHERTEXT (.enc)
```
- Each question paper receives a cryptographically unique 32-byte (256-bit) AES document key generated via `crypto.randomBytes(32)` and a 12-byte initialization vector (IV) generated via `crypto.randomBytes(12)`.
- The AES document key is wrapped server-side using RSA-OAEP with SHA-256 before persistence.
- Plaintext AES keys are NEVER stored in PostgreSQL or Supabase Storage, and are NEVER returned in API responses or logs.

### 2. Separation of Cryptographic Responsibilities
- **Module 7 Digital Signing**: Uses `question-paper-signing-private.pem` and `question-paper-signing-public.pem` (RSA-PSS with SHA-256).
- **Module 8 Key Wrapping**: Uses `question-paper-key-wrapping-private.pem` and `question-paper-key-wrapping-public.pem` (RSA-OAEP with SHA-256).
- The signing private key is NEVER used for AES key wrapping, and the key-wrapping private key is NEVER used for digital signatures.

### 3. Private Storage & Path Security
- Encrypted documents reside strictly in private Supabase Storage (`examguard-storage`).
- `getPublicUrl` is NEVER used for question papers.
- Storage paths are strictly generated server-side: `question-papers/{teacher_id}/{question_paper_id}/encrypted/{sanitized_filename}.enc`.
- Client-supplied `storage_path` parameters and directory traversal sequences (`..`, leading slashes, null bytes) are strictly rejected.

### 4. Verify-Before-Decrypt Enforcement
Decryption follows a strict order during document retrieval:
1. Ownership verification: Authenticated user must be the authoring faculty member.
2. Download ciphertext from private storage.
3. Compute SHA-256 hash and verify against the stored hash in `digital_signatures`.
4. Verify the RSA-PSS digital signature over the ciphertext buffer.
5. Retrieve wrapped AES key from `paper_keys` and unwrap it using the private wrapping key.
6. Decrypt ciphertext using AES-256-GCM and authenticate the 16-byte authentication tag.
7. Return decrypted PDF buffer.
*If hash mismatch, signature failure, corrupted key, or auth tag failure occurs, the pipeline fails closed immediately and NO plaintext content is ever exposed.*

### 5. Key Generation Procedure
To generate dedicated key-wrapping keys:
```bash
node Backend/scripts/generateKeyWrappingKeys.js
```
To overwrite existing keys (warning: invalidates previously wrapped keys):
```bash
node Backend/scripts/generateKeyWrappingKeys.js --force
```

### 6. Git Security
- All private and public PEM files in `Backend/keys/*.pem` are excluded via `.gitignore`.
- Private keys and `.env` credentials are NEVER committed to version control.

### 7. Future Key Rotation Strategy
1. Generate new wrapping key pair (`question-paper-key-wrapping-public-v2.pem`).
2. Retain old private wrapping key in memory/keystore during transition.
3. Re-wrap existing document AES keys in `paper_keys` and update key version identifier.
4. Retire previous wrapping key only after all records are re-wrapped.

### 8. Module 9: Exam Coordinator Access Overview
- **Dedicated Dashboard**: Operational workspace at `/exam-coordinator` protected by `EXAM_COORDINATOR` RBAC.
- **Scoping & Authorization**: Access is strictly scoped to question papers legitimately assigned to the coordinator in `question_paper_assignments`. Non-assigned and draft papers return `403 Forbidden`.
- **Verify-Before-Decrypt Pipeline**: Download requests trigger full server-side verification (SHA-256 integrity -> RSA-PSS signature verification -> RSA-OAEP key unwrapping -> AES-256-GCM decryption -> PDF streaming).
- **Inline Cryptographic Verification**: Endpoint `/api/exam-coordinator/question-papers/:id/verify-signature` provides tamper detection without decryption.
- **Zero Secrets Leakage**: Plaintext AES keys, wrapped keys, IVs, auth tags, and RSA private keys are NEVER exposed to the frontend or API consumers.

### 10. Module 10: Answer Key Management Overview
- **Authoring Faculty Ownership**: Only the teacher who authored the question paper can upload its answer key (`paper.teacher_id === teacherId`). Other faculty are rejected with `403 Forbidden`.
- **Post-Exam Timing Window**: Server calculates calendar days between exam date and current time in UTC:
  - `diffDays < 0`: Before exam -> upload strictly blocked (`400 Bad Request`).
  - `0 <= diffDays <= 2`: Preferred submission window -> open.
  - `2 < diffDays <= 4`: Extended submission window -> open.
  - `diffDays > 4`: Window expired -> upload strictly blocked (`400 Bad Request`).
- **Duplicate Protection**: Exactly 1 answer key per question paper (`question_paper_id UNIQUE`). Duplicate attempts are rejected (`400 Bad Request`).
- **Self-Contained Cryptographic Envelope**:
  - Unique 32-byte AES DEK, 12-byte IV, and 16-byte GCM authentication tag.
  - AES DEK wrapped using dedicated RSA-OAEP wrapping key.
  - Stored as self-contained 284-byte header container (`[256-byte wrappedKey, 12-byte IV, 16-byte AuthTag, Ciphertext...]`) in private Supabase Storage (`answer-keys/{teacher_id}/{question_paper_id}/encrypted/{filename}.enc`).
  - Digitally signed with RSA-PSS SHA-256 over exact stored ciphertext envelope.
- **Verify-Before-Decrypt Pipeline**:
  - Enforced for both Authoring Teacher and Assigned Exam Coordinator on download.
  - SHA-256 integrity check -> RSA-PSS signature verification -> RSA-OAEP DEK unwrapping -> AES-256-GCM decryption -> authenticated PDF stream.
- **Zero Secrets Leakage**: Plaintext AES keys, wrapped keys, IVs, auth tags, and RSA private keys are NEVER stored unencrypted or exposed via API.

### 11. Module 11: Verification & Decryption Architecture
- **Unified Verification Service (`verificationService.js`)**: Orchestrates the existing `encryptionService`, `keyManagementService`, and `signatureService` without duplicating cryptographic primitives.
- **Mandatory Canonical Sequence (Verify-Before-Decrypt)**:
  $$\text{Storage} \rightarrow \text{SHA-256 Check} \rightarrow \text{RSA-PSS Signature Check} \rightarrow \text{RSA-OAEP DEK Unwrap} \rightarrow \text{AES-256-GCM Decrypt \& Auth} \rightarrow \text{Authenticated PDF Stream}$$
- **Fail-Closed Security**: Any SHA-256 mismatch, RSA-PSS signature invalidity, RSA-OAEP unwrapping failure, key size mismatch, or GCM tag failure aborts execution immediately with HTTP 400. Decryption is NEVER attempted on unverified data, and plaintext is NEVER leaked.
- **Strict Cryptographic Key Separation**: Signing private key fails when attempting key unwrapping; key-wrapping public key fails when attempting signature verification.
- **Memory Safety & Buffer Zeroization**: Implements `zeroizeBuffer` to safely wipe temporary sensitive 32-byte AES key buffers in `finally` blocks upon decryption completion.
- **Zero Secrets Leakage**: No AES keys, wrapped keys, IVs, auth tags, private keys, or storage paths are returned to the client in API responses or written to logs.
- **Frontend Protection**: Verification failures automatically disable download buttons across both Teacher and Exam Coordinator dashboards.

### 12. Module 12: Notifications & Next-Day Question Paper Delivery Architecture
- **In-App Notification Dispatch**: Upon successful Question Paper submission by a teacher, an in-app notification (`QUESTION_PAPER_SCHEDULED`) is automatically created for the assigned recipient.
- **Server-Side Next-Day Delivery Calculation**: Delivery date is deterministically calculated on the server as `currentDate + 1 calendar day` in UTC (`YYYY-MM-DD`). Client cannot manipulate or bypass the scheduled delivery date.
- **Compensating Rollback & Idempotency**: If submission fails or is aborted, notification records are cleanly rolled back. Duplicate notification creation attempts are safely prevented via idempotency checks.
- **Delivery-Date Access Gating**:
  - Before scheduled delivery date: Recipient can view notification and scheduling metadata, but paper retrieval and download are strictly **blocked** (`403 Forbidden`).
  - On or after scheduled delivery date: Recipient can download the question paper through the canonical Verify-Before-Decrypt pipeline (SHA-256 -> RSA-PSS -> RSA-OAEP -> AES-256-GCM).
  - Authoring teacher retains unrestricted ownership access to their submitted papers at all times.
- **Ownership Isolation & Validation**: Notification endpoints strictly enforce ownership (`/api/notifications`). Foreign access is rejected with `403 Forbidden`; non-existent UUIDs return `404 Not Found`; malformed UUIDs return `400 Bad Request`.
- **Zero Secrets Leakage**: Notification payloads contain only safe metadata (title, subject, delivery date, status). Keys, IVs, tags, private keys, and storage paths are never leaked.
- **Frontend Notification Bell**: Interactive `NotificationBell` component with animated unread badge, polling, dropdown panel, delivery schedule alert modal, and mark-as-read controls integrated into Teacher and Exam Coordinator dashboards.

### 13. Module 13: Audit Logs & Security Activity Tracking Overview
- **Centralized Event Recording**: Unified `auditLogService.logAuditEvent()` captures high-value security lifecycle events across authentication, question paper submission, delivery scheduling, coordinator access, answer key management, verification, downloads, and RBAC authorization failures.
- **Fail-Safe & Non-Blocking**: Audit logging operations are wrapped in safe error handlers. A database logging failure will never crash an ongoing user workflow, rollback a successful paper submission, or bypass authorization or decryption pipelines.
- **Strict Data Sanitization & Redaction**: Automatically sanitizes sensitive keys and values before writing to the database or emitting responses (`password`, `token`, `encryptedAesKey`, `aesKey`, `iv`, `authTag`, `privateKey`, and storage paths are replaced with `[REDACTED]`).
- **Immutable & Read-Only API**: Audit logs are append-only. Mutation operations (`POST`, `PUT`, `PATCH`, `DELETE`) on `/api/audit-logs` explicitly return `405 Method Not Allowed`.
- **Administrative Access Control**: Access to audit logs (`/api/audit-logs`) is strictly restricted to authenticated users with the `ADMIN` role via `authorizeRoles('ADMIN')`.
- **Multi-Dimensional Filtering**: Query logs by `action`, `outcome` (`SUCCESS`, `FAILURE`, `DENIED`), `userId`, `resourceType`, `resourceId`, and date range (`startDate`, `endDate`) with safe pagination.
- **Executive Summary Endpoint**: `/api/audit-logs/summary` provides fast metric aggregations (total events, successes, failures, denials).
- **Admin Audit Dashboard UI**: Interactive dashboard in `AdminHome.jsx` features KPI stat cards, a multi-parameter search/filter toolbar, paginated log feed with color-coded event pills, and an inspection modal for full redacted JSON metadata.

### 14. Module 14: Admin Management Overview
- **Enterprise User Administration**: Tabbed administrator interface in `AdminHome.jsx` combining user lifecycle management with security audit trail inspection.
- **Search & Multi-Dimensional Filtering**: Search users by name or email with server-controlled pagination and instant filters by role (`ADMIN`, `TEACHER`, `EXAM_COORDINATOR`) and account status (`active`, `inactive`).
- **Secure User Creation**: Authoritative user provisioning (`POST /api/admin/users`) with bcrypt password hashing (12 rounds) and duplicate email protection.
- **Account Status Management**: Instant account activation and deactivation (`PATCH /api/admin/users/:id/status`). Deactivated users are immediately blocked by `roleMiddleware` from accessing protected endpoints and prevented from authenticating.
- **Role Assignment & Delegation**: Authorized role delegation (`PATCH /api/admin/users/:id/role`) across supported system roles.
- **Self-Lockout & Last-Admin Safeguards**:
  - Administrators cannot deactivate their own account.
  - Administrators cannot demote their own account role.
  - The system strictly forbids deactivating or demoting the last active administrator account, ensuring the system can never become unmanaged.
- **Administrator-Assisted Password Reset**: Secure password reset endpoint (`POST /api/admin/users/:id/reset-password`) with strict complexity enforcement (min 8 chars, letter + number) and bcrypt hashing. Plaintext passwords are never logged or stored.
- **Comprehensive Audit Trail Integration**: Every administrative event (user creation, activation, deactivation, role change, password reset, and safeguard denial) is recorded via `auditLogService.logAuditEvent`.

### 15. Intentionally Deferred Features (Strict Scope)
- ❌ External SIEM / syslog streaming integrations
- ❌ External SMS / third-party notification services
- ❌ Public storage access

---

## Architecture & Directory Structure

```text
ExamGuard/
├── Backend/                 # Node.js Express API service
│   ├── keys/                # Cryptographic keys (.gitignore protected)
│   │   ├── question-paper-key-wrapping-public.pem
│   │   ├── question-paper-key-wrapping-private.pem
│   │   ├── question-paper-encryption-public.pem
│   │   ├── question-paper-encryption-private.pem
│   │   ├── question-paper-signing-public.pem
│   │   └── question-paper-signing-private.pem
│   ├── scripts/             # Automated test runners & key generators
│   │   ├── createTestUser.js
│   │   ├── generateKeyWrappingKeys.js
│   │   ├── generateEncryptionKeys.js
│   │   ├── generateSigningKeys.js
│   │   ├── verifyAuth.js
│   │   ├── testServiceLogic.js
│   │   ├── verifyRbac.js
│   │   ├── verifyQuestionPaper.js
│   │   ├── verifyEncryption.js
│   │   ├── verifyDigitalSignature.js
│   │   ├── verifyKeyManagement.js
│   │   ├── verifyExamCoordinator.js
│   │   ├── verifyAnswerKey.js
│   │   ├── verifyVerificationDecryption.js
│   │   ├── verifyNotifications.js
│   │   ├── verifyAuditLogs.js
│   │   ├── verifyAdminManagement.js
│   │   ├── verifySystemIntegration.js
│   │   ├── verifySystemValidation.js
│   │   └── verifyProductionHardening.js
│   ├── src/
│   │   ├── config/          # Environment, envValidator, & Supabase client configuration
│   │   ├── controllers/     # authController, rbacController, questionPaperController, examCoordinatorController, answerKeyController, notificationController, auditLogController, adminController, health.controller
│   │   ├── middleware/      # authMiddleware (401), roleMiddleware (403), uploadMiddleware, corsConfig, rateLimiter
│   │   ├── routes/          # /api/auth, /api/rbac, /api/question-papers, /api/exam-coordinator, /api/teacher/question-papers, /api/notifications, /api/audit-logs, /api/admin, /api/health
│   │   ├── services/        # keyManagementService, encryptionService, signatureService, verificationService, questionPaperService, examCoordinatorService, answerKeyService, notificationService, auditLogService, adminService
│   │   ├── utils/           # jwt.js
│   │   └── server.js        # Express HTTP server with Helmet, CORS allowlist, and startup validation
│   ├── .env.example
│   └── README.md
├── Frontend/                # React + Vite client application
│   ├── src/
│   │   ├── components/      # ProtectedRoute.jsx, RoleRoute.jsx, NotificationBell.jsx
│   │   ├── context/         # AuthContext.jsx
│   │   ├── pages/           # Login.jsx, Unauthorized.jsx, AdminHome.jsx, TeacherHome.jsx, ExamCoordinatorHome.jsx
│   │   ├── services/        # api.js, authService.js, questionPaperService.js, examCoordinatorService.js, answerKeyService.js, notificationService.js, auditLogService.js, adminService.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── README.md
├── database/                # PostgreSQL schema & documentation
│   ├── README.md
│   ├── schema.sql           # Canonical Supabase SQL schema
│   └── module_13_audit_logs_migration.sql # Module 13 optional audit schema enhancements
├── docs/                    # Production & Operations Documentation
│   ├── MODULE_17_BASELINE_AUDIT.md
│   ├── PRODUCTION_SUPABASE_CHECKLIST.md
│   ├── PRODUCTION_DEPLOYMENT_GUIDE.md
│   ├── SECRET_ROTATION_AND_KEY_OPERATIONS.md
│   └── RELEASE_CHECKLIST.md
├── MANUAL_TESTING_CHECKLIST.md # Complete 27-test manual verification checklist
└── DEMONSTRATION_SCRIPT.md     # Step-by-step academic presentation guide
```

---

## Running Automated Tests

From the `Backend/` directory:
```bash
npm test
```
Executes all 16 automated test suites (940 total assertions, 0 failures, 0 skipped):
1. `scripts/verifyAuth.js` (Module 3 Authentication - 30 assertions)
2. `scripts/testServiceLogic.js` (Module 3 Unit Logic - 15 assertions)
3. `scripts/verifyRbac.js` (Module 4 Role-Based Access Control - 42 assertions)
4. `scripts/verifyQuestionPaper.js` (Module 5 Question Paper Management - 34 assertions)
5. `scripts/verifyEncryption.js` (Module 6 AES-256-GCM Encryption - 38 assertions)
6. `scripts/verifyDigitalSignature.js` (Module 7 RSA-PSS Digital Signatures - 47 assertions)
7. `scripts/verifyKeyManagement.js` (Module 8 Secure Storage & Key Management - 59 assertions)
8. `scripts/verifyExamCoordinator.js` (Module 9 Exam Coordinator Access - 58 assertions)
9. `scripts/verifyAnswerKey.js` (Module 10 Answer Key Management - 105 assertions)
10. `scripts/verifyVerificationDecryption.js` (Module 11 Verification & Decryption - 54 assertions)
11. `scripts/verifyNotifications.js` (Module 12 Notifications & Next-Day Delivery - 64 assertions)
12. `scripts/verifyAuditLogs.js` (Module 13 Audit Logs & Security Activity Tracking - 77 assertions)
13. `scripts/verifyAdminManagement.js` (Module 14 Admin Management - 117 assertions)
14. `scripts/verifySystemIntegration.js` (Module 15 Frontend Integration & System Polish - 58 assertions)
15. `scripts/verifySystemValidation.js` (Module 16 Final System Validation & Security Audit - 58 assertions)
16. `scripts/verifyProductionHardening.js` (Module 17 Production Hardening & Release Validation - 84 assertions)




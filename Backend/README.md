# ExamGuard Backend - Module 17: Production Hardening, Deployment Configuration & Release Packaging

Backend service for **ExamGuard (Secure Examination Question Paper Management System)**.

---

## 1. Module 8-17 Scope & Responsibilities

Module 17 implements **Production Hardening, Deployment Configuration & Release Packaging**:
- **Environment & Secrets Validation**: Pre-flight validation (`envValidator.js`) rejecting weak/placeholder JWT secrets, non-HTTPS endpoints, or missing key files before server boot in production.
- **Strict CORS & Origin Allowlist**: Environment-aware origin filtering (`corsConfig.js`) enforcing explicit allowed frontend origins, rejecting unauthorized browser origins with HTTP 403, and safely permitting non-browser health probes.
- **Authentication Abuse Defense**: IP-based rate limiting on `POST /api/auth/login` (`rateLimiter.js`) returning HTTP 429 Too Many Requests with retry hints and test-mode bypass.
- **Operational Health & Readiness Probes**: Liveness probe (`GET /api/health`) and database readiness probe (`GET /api/health/ready`) with sanitized responses and degraded 503 handling.
- **Security Headers & Cross-Origin Resource Policy (CORP)**: Helmet integration configuring `Cross-Origin-Resource-Policy: cross-origin` to ensure secure streaming of decrypted PDF blobs without cross-site embedding risks.
- **Production Operations Documentation**: Complete guides for Supabase database verification (`docs/PRODUCTION_SUPABASE_CHECKLIST.md`), Nginx/PM2 deployment (`docs/PRODUCTION_DEPLOYMENT_GUIDE.md`), key operations and compromise recovery (`docs/SECRET_ROTATION_AND_KEY_OPERATIONS.md`), and release pre-flight verification (`docs/RELEASE_CHECKLIST.md`).

Module 16 implements **Final System Validation, Security Audit & Deployment Readiness**:
- **Comprehensive Verification**: End-to-end audit across Teacher, Assigned Faculty, Exam Coordinator, and Administrator workflows.
- **Delivery-Date Consistency**: Formally establishes authoritative delivery date semantics as the next UTC calendar day following submission (`calculateNextCalendarDay(submissionTimestamp)`).
- **Cryptographic & Storage Invariants**: Verifies Fail-Closed Verify-Before-Decrypt pipeline order, zero plaintext leak on tamper, memory zeroization of temporary key buffers, and private bucket isolation.
- **Administrative Safeguards**: Rigorously tests self-lockout prevention, last-active-admin demotion prevention, dynamic `is_active` account status enforcement, and immutable audit logs (`405 Method Not Allowed`).
- **Production Readiness**: Validates environment configuration, key-generation overwrite protection (`--force`), and zero secrets exposure.

Module 15 implements **Frontend Integration & System-Wide Polish**:
- **End-to-End System Reliability**: Hardens integration across React client and Express API across all workflows.
- **Assigned Faculty Access**: Full support for `GET /api/question-papers/assigned` allowing designated recipient faculty to view their assigned papers.
- **Scheduled Next-Day Delivery Gating**: Server-enforced date gating where assigned faculty cannot download question papers until current calendar date >= `scheduled_delivery_date`.
- **Zero Secrets Exposure**: Verifies that `password_hash`, plaintext passwords, `storage_path`, `encrypted_aes_key`, `auth_tag`, `iv`, and RSA private keys are strictly absent from client responses and logs.
- **Tamper Rejection via Verify-Before-Decrypt**: Guarantees that any modified ciphertext in storage fails RSA-PSS verification and immediately halts before decryption without leaking plaintext.

Module 14 implements **Admin Management**:
- **Administrative User Management**: Search, filter, inspect, create, activate/deactivate, and reassign roles for system users.
- **Strict Administrative Safeguards**: Self-lockout prevention (admins cannot deactivate themselves) and Last-Active-Admin protection (the final active administrator cannot be deactivated or demoted).
- **Secure Password Reset**: Administrator-assisted password reset using bcrypt (12 salt rounds) with strong complexity validation.
- **Audit Logging Integration**: All administrative actions (`USER_CREATED`, `USER_STATUS_UPDATED`, `USER_ROLE_UPDATED`, `PASSWORD_RESET`) are recorded to `activity_logs` with sanitized details.
- **Zero Secrets Leakage**: Passwords, hashes, tokens, AES keys, wrapped keys, IVs, auth tags, private keys, and internal storage paths are never returned in responses or logs.

Module 13 implements **Audit Logs & Security Activity Tracking**:
- **Comprehensive Audit Trail**: Records security-critical actions (LOGIN, FAILED_LOGIN, UNAUTHORIZED_ACCESS, QUESTION_PAPER_SUBMITTED, QUESTION_PAPER_SCHEDULED, DOWNLOAD, SIGNATURE_VERIFIED, ANSWER_KEY_UPLOADED).
- **Fail-Safe & Non-Blocking**: Audit logging errors never disrupt client requests or compromise authorization/decryption pipelines.
- **Strict Data Sanitization**: Passwords, tokens, AES keys, wrapped keys, IVs, auth tags, private keys, and internal storage paths are redacted before storage or display.
- **Immutable & Read-Only**: Mutation requests (`POST`, `PUT`, `PATCH`, `DELETE`) to `/api/audit-logs` return `405 Method Not Allowed`.
- **Administrative Access**: Endpoints restricted strictly to `ADMIN` role. Multi-field search, filtering, and summary statistics.

---

## 2. API Endpoints

### Authentication & Health
- `GET /api/health` — Liveness health check endpoint (`200 OK`).
- `GET /api/health/ready` — Readiness probe verifying database and storage connectivity (`200 OK` / `503 Degraded`).
- `POST /api/auth/login` — Authenticates credentials, rate-limited against brute force abuse, returns JWT bearer token.
- `GET /api/auth/me` — Returns authenticated user details and authoritative role.

### Question Paper Management (`/api/question-papers`)
All endpoints require `Authorization: Bearer <token>` and `TEACHER` role.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/question-papers` | `TEACHER` | Uploads PDF paper, encrypts in memory with AES-256-GCM, wraps AES key with RSA-OAEP, signs ciphertext with RSA-PSS, uploads to private storage, schedules next-day delivery, and dispatches in-app notification. |
| `GET` | `/api/question-papers/my` | `TEACHER` | Lists all papers authored by the authenticated teacher. Excludes key secrets. |
| `GET` | `/api/question-papers/assigned` | `TEACHER` | Lists all papers assigned to the authenticated faculty member. Excludes secrets. |
| `GET` | `/api/question-papers/recipients` | `TEACHER` | Lists active faculty members eligible for recipient assignment. |
| `GET` | `/api/question-papers/:id` | `TEACHER` (Owner/Assigned) | Retrieves detailed metadata. Enforces ownership or delivery-date gated access. |
| `GET` | `/api/question-papers/:id/download` | `TEACHER` (Owner/Assigned) | Enforces delivery date gating for assigned recipients; executes Verify-Before-Decrypt pipeline and streams decrypted PDF. |
| `GET` | `/api/question-papers/:id/verify-signature` | `TEACHER` (Owner/Assigned) | Verifies RSA-PSS digital signature & SHA-256 hash without decrypting. |

### Exam Coordinator Access (`/api/exam-coordinator`)
All endpoints require `Authorization: Bearer <token>` and `EXAM_COORDINATOR` role.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/exam-coordinator/question-papers` | `EXAM_COORDINATOR` | Lists all submitted question papers legitimately assigned to the authenticated coordinator. Excludes secrets. |
| `GET` | `/api/exam-coordinator/question-papers/:id` | `EXAM_COORDINATOR` | Retrieves safe metadata for an authorized assigned paper (`403 Forbidden` if not assigned). |
| `GET` | `/api/exam-coordinator/question-papers/:id/download` | `EXAM_COORDINATOR` | Downloads ciphertext from private storage, executes Verify-Before-Decrypt (SHA-256 -> RSA-PSS -> RSA-OAEP unwrap -> AES-GCM decrypt), and streams PDF. |
| `GET` | `/api/exam-coordinator/question-papers/:id/verify-signature` | `EXAM_COORDINATOR` | Verifies RSA-PSS digital signature and SHA-256 hash over stored ciphertext without decrypting. |
| `GET` | `/api/exam-coordinator/question-papers/:id/answer-key` | `EXAM_COORDINATOR` | Retrieves safe metadata for submitted Answer Key on assigned paper (`403 Forbidden` if unassigned). |
| `GET` | `/api/exam-coordinator/question-papers/:id/answer-key/download` | `EXAM_COORDINATOR` | Downloads decrypted Answer Key PDF via Verify-Before-Decrypt pipeline (`403 Forbidden` if unassigned). |
| `GET` | `/api/exam-coordinator/question-papers/:id/answer-key/verify-signature` | `EXAM_COORDINATOR` | Verifies RSA-PSS digital signature and SHA-256 hash of Answer Key without exposing secrets. |

### Answer Key Management (`/api/teacher/question-papers` & `/api/question-papers`)
Endpoints require `Authorization: Bearer <token>` and `TEACHER` role.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `POST` | `/api/teacher/question-papers/:id/answer-key` | `TEACHER` (Author) | Uploads PDF answer key during post-exam window (0–4 days post-exam), encrypts in envelope, wraps DEK with RSA-OAEP, signs with RSA-PSS. |
| `GET` | `/api/teacher/question-papers/:id/answer-key` | `TEACHER` (Author) | Returns safe Answer Key metadata and submission timing window details. |
| `GET` | `/api/teacher/question-papers/:id/answer-key/download` | `TEACHER` (Author) | Secure download executing Verify-Before-Decrypt pipeline and streaming decrypted PDF. |
| `GET` | `/api/teacher/question-papers/:id/answer-key/verify-signature` | `TEACHER` (Author) | Verifies RSA-PSS digital signature and SHA-256 ciphertext hash. |

### Notification Management (`/api/notifications`)
All endpoints require `Authorization: Bearer <token>`.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/notifications` | Authenticated | Lists all notifications for the authenticated user, sorted latest first. Excludes secrets. |
| `GET` | `/api/notifications/unread-count` | Authenticated | Returns integer count of unread notifications for the caller. |
| `PATCH` | `/api/notifications/:id/read` | Authenticated (Owner) | Marks specified notification as read. Strict ownership: foreign ID returns `403 Forbidden`, non-existent returns `404 Not Found`. |
| `PATCH` | `/api/notifications/:id/unread` | Authenticated (Owner) | Marks specified notification as unread. Enforces ownership and UUID validation. |
| `PATCH` | `/api/notifications/read-all` | Authenticated | Bulk marks all notifications belonging to caller as read. |

### Audit Log & Security Activity Tracking (`/api/audit-logs`)
All endpoints require `Authorization: Bearer <token>` and `ADMIN` role.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/audit-logs` | `ADMIN` | Returns paginated audit logs with multi-parameter filtering (`action`, `outcome`, `userId`, `resourceType`, `resourceId`, `startDate`, `endDate`, `page`, `limit`). Sensitive data is redacted. |
| `GET` | `/api/audit-logs/summary` | `ADMIN` | Returns aggregated metrics (`totalEvents`, `successCount`, `failureCount`, `deniedCount`). |
| `GET` | `/api/audit-logs/:id` | `ADMIN` | Retrieves single audit log record by UUID with full sanitized details. |
| `POST` / `PUT` / `PATCH` / `DELETE` | `/api/audit-logs` | Any | Mutation strictly prohibited. Returns `405 Method Not Allowed`. |

### Admin Management (`/api/admin`)
All endpoints require `Authorization: Bearer <token>` and `ADMIN` role.

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/admin/users` | `ADMIN` | Lists users with search query (`search`), role filter (`role`), status filter (`status`), and pagination (`page`, `limit`). Passwords and secrets are omitted. |
| `GET` | `/api/admin/users/:id` | `ADMIN` | Retrieves safe user details including role and activity summary. |
| `POST` | `/api/admin/users` | `ADMIN` | Creates new user with bcrypt-hashed password (12 salt rounds) and role assignment. Validates email format, duplicate email prevention, password complexity. |
| `PATCH` | `/api/admin/users/:id/status` | `ADMIN` | Updates user status (`active` / `inactive`). Enforces self-lockout prevention and last-active-admin protection. |
| `PATCH` | `/api/admin/users/:id/role` | `ADMIN` | Assigns/updates user role. Validates role against valid roles, prevents self-demotion and demotion of the last active administrator. |
| `POST` | `/api/admin/users/:id/reset-password` | `ADMIN` | Resets user password with bcrypt hashing (12 salt rounds). Enforces complexity requirements. Never returns new password or hash in responses or logs. |
| `GET` | `/api/admin/roles` | `ADMIN` | Lists all available system roles (`ADMIN`, `TEACHER`, `EXAM_COORDINATOR`). |

---

## 3. Key Generation & Management

To generate dedicated key-wrapping keys:
```bash
node scripts/generateKeyWrappingKeys.js
```
Options:
- `--force`: Overwrites existing key files in `Backend/keys/` (Warning: makes existing encrypted papers unrecoverable).

### Key Files in `Backend/keys/`:
- `question-paper-key-wrapping-public.pem` (RSA-2048 SPKI PEM)
- `question-paper-key-wrapping-private.pem` (RSA-2048 PKCS#8 PEM, Mode 0600)
- `question-paper-signing-public.pem` (RSA-2048 SPKI PEM)
- `question-paper-signing-private.pem` (RSA-2048 PKCS#8 PEM, Mode 0600)

---

## 4. Module 11: Verification & Decryption Service

Module 11 formalizes and unifies the server-side cryptographic verification and decryption workflow via `src/services/verificationService.js`:
- **Verify-Before-Decrypt Canonical Pipeline**:
  1. Download ciphertext / envelope from private Supabase Storage.
  2. Compute SHA-256 hash over exact storage bytes and compare to stored hash in `digital_signatures`.
  3. Verify RSA-PSS digital signature over exact storage bytes.
  4. Retrieve and unwrap 32-byte AES DEK using dedicated RSA-OAEP private wrapping key.
  5. Decrypt ciphertext payload and authenticate 16-byte GCM authentication tag.
  6. Safely zeroize temporary key buffers with `zeroizeBuffer()`.
  7. Stream authenticated plaintext PDF to authorized client.
- **Fail-Closed Security**: Hash mismatch, signature failure, corrupted key, invalid IV/tag size, or GCM authentication failure immediately halts execution with HTTP 400. Decryption is NEVER attempted on unverified data, and plaintext is NEVER returned.
- **Zero Secrets Leakage**: Plaintext AES keys, wrapped keys, IVs, auth tags, private keys, and internal storage paths are never returned in API responses or logs.

---

## 5. Module 12: Notifications & Delivery Gating

Module 12 integrates notification dispatch and scheduled delivery date access gating:
- **Automatic Dispatch**: Submission triggers `notificationService.createQuestionPaperNotification` for the assigned faculty.
- **Compensating Rollbacks**: Paper submission errors roll back any created notifications.
- **Delivery Date Comparison**: Server strictly enforces `currentDateUtc < scheduled_delivery_date` gating on assigned faculty downloads (`403 Forbidden`). Authoring teachers are exempt.
- **No Client Manipulation**: Delivery dates and recipient assignments are server-controlled.

---

## 6. Module 13: Audit Logs & Security Activity Tracking

Module 13 maintains a tamper-resistant, append-only, searchable log of security-sensitive events:
- **Centralized Event Recording**: `auditLogService.logAuditEvent({ userId, action, outcome, role, resourceType, resourceId, details, ipAddress, userAgent, summary, correlationId })` records all system events.
- **Fail-Safe Operation**: Audit logging operations are safely caught; failures to persist logs never impede user authentication, paper submission, or decryption workflows.
- **Zero Secrets Leakage**: Strict redaction replaces passwords, JWTs, AES keys, wrapped keys, IVs, auth tags, and private keys with `[REDACTED]`.
- **Read-Only API**: Mutation requests on `/api/audit-logs` explicitly return `405 Method Not Allowed`.

---

## 7. Module 14: Admin Management

Module 14 provides centralized, secure administration for system users and credentials:
- **Administrative User Management**: Comprehensive operations to search, filter, inspect, create, activate/deactivate, and reassign roles for users.
- **Self-Lockout Prevention**: Prevents administrators from deactivating or demoting their own accounts (`HTTP 400: Cannot deactivate your own account`).
- **Last-Admin Protection**: Guarantees system continuity by prohibiting deactivation or role demotion of the final remaining active administrator (`HTTP 400: Cannot deactivate/demote the last active administrator`).
- **Secure Password Reset**: Administrator-assisted reset hashing passwords with bcrypt (12 rounds) and enforcing password complexity (minimum 8 characters, at least one letter and one number).
- **Integrated Security Audit Logging**: Every administrative event is recorded via `auditLogService` under dedicated actions: `USER_CREATED`, `USER_STATUS_UPDATED`, `USER_ROLE_UPDATED`, and `PASSWORD_RESET`.
- **Zero Secrets Leakage**: Plaintext passwords, password hashes, and tokens are never returned in responses or recorded in audit metadata.

---

## 8. Automated Testing

Run the full multi-module automated regression suite (940 total assertions, 0 failures, 0 skipped):

```bash
npm test
```

### Test Suites:
1. `scripts/verifyAuth.js` — Module 3 Authentication tests (30 assertions)
2. `scripts/testServiceLogic.js` — Module 3 unit logic tests (15 assertions)
3. `scripts/verifyRbac.js` — Module 4 RBAC & Authorization tests (42 assertions)
4. `scripts/verifyQuestionPaper.js` — Module 5 Question Paper Management tests (34 assertions)
5. `scripts/verifyEncryption.js` — Module 6 AES-256-GCM Encryption tests (38 assertions)
6. `scripts/verifyDigitalSignature.js` — Module 7 RSA-PSS Digital Signature tests (47 assertions)
7. `scripts/verifyKeyManagement.js` — Module 8 Secure Storage & Key Management tests (59 assertions)
8. `scripts/verifyExamCoordinator.js` — Module 9 Exam Coordinator Access tests (58 assertions)
9. `scripts/verifyAnswerKey.js` — Module 10 Answer Key Management tests (105 assertions)
10. `scripts/verifyVerificationDecryption.js` — Module 11 Verification & Decryption tests (54 assertions)
11. `scripts/verifyNotifications.js` — Module 12 Notifications & Delivery tests (64 assertions)
12. `scripts/verifyAuditLogs.js` — Module 13 Audit Logs & Security Activity Tracking (77 assertions)
13. `scripts/verifyAdminManagement.js` — Module 14 Admin Management tests (117 assertions)
14. `scripts/verifySystemIntegration.js` — Module 15 Frontend Integration & System Polish (58 assertions)
15. `scripts/verifySystemValidation.js` — Module 16 Final System Validation & Security Audit (58 assertions)
16. `scripts/verifyProductionHardening.js` — Module 17 Production Hardening & Release Validation (84 assertions)




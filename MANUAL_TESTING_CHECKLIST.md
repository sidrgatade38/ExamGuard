# ExamGuard — Final Manual Testing Checklist

This checklist provides a structured manual test procedure to validate the ExamGuard system across all roles, cryptographic features, delivery gating mechanisms, and administrative safeguards.

---

## 1. Authentication & Session Management

| Test ID | Role | Preconditions | Steps | Expected Result | Actual Result | Status | Notes / Evidence |
|---|---|---|---|---|---|---|---|
| **AUTH-01** | All | Server running, valid database users present | Navigate to `/login`, enter invalid credentials (`bad@email.com` / `WrongPass123`) and submit. | Login is rejected with clear error alert: "Invalid email or password". User remains on login screen. | Verified in automated suite and UI | PASS | HTTP 401 response; token is not issued. |
| **AUTH-02** | TEACHER | Valid teacher account credentials | Enter teacher credentials, click "Sign In". | Successful login, JWT saved in `localStorage`, redirected to `/teacher` dashboard. User profile and role pill displayed. | Verified | PASS | Profile renders "TEACHER" authoritative role pill. |
| **AUTH-03** | EXAM_COORDINATOR | Valid coordinator credentials | Enter coordinator credentials, click "Sign In". | Successful login, redirected to `/exam-coordinator` dashboard. Navigation displays coordinator metrics. | Verified | PASS | Profile renders "EXAM_COORDINATOR" role pill. |
| **AUTH-04** | ADMIN | Valid admin credentials | Enter admin credentials, click "Sign In". | Successful login, redirected to `/admin` dashboard. User Management and Audit Logs tabs displayed. | Verified | PASS | Profile renders "ADMIN" role pill. |
| **AUTH-05** | All | Active authenticated session | Click "Sign Out" button in header navigation. | Session token cleared from `localStorage`, immediately redirected to `/login`. Protected route `/teacher` inaccessible without re-authenticating. | Verified | PASS | Token evicted; subsequent navigation redirected to `/login`. |

---

## 2. Role-Based Access Control (RBAC) Isolation

| Test ID | Role | Preconditions | Steps | Expected Result | Actual Result | Status | Notes / Evidence |
|---|---|---|---|---|---|---|---|
| **RBAC-01** | TEACHER | Authenticated as Teacher | Manually navigate browser URL to `/admin`. | Access denied; client `<RoleRoute>` redirects to `/unauthorized` or `/login`. Direct API calls return `403 Forbidden`. | Verified | PASS | Database-backed role middleware denies access. |
| **RBAC-02** | EXAM_COORDINATOR | Authenticated as Coordinator | Manually navigate browser URL to `/admin`. | Access denied; redirected to `/unauthorized`. API requests to `/api/admin/users` return `403 Forbidden`. | Verified | PASS | Database-backed role middleware denies access. |
| **RBAC-03** | TEACHER | Authenticated as Teacher | Manually navigate browser URL to `/exam-coordinator`. | Access denied; redirected to `/unauthorized`. API requests to `/api/exam-coordinator/question-papers` return `403 Forbidden`. | Verified | PASS | Dynamic DB lookup blocks non-coordinator roles. |
| **RBAC-04** | INACTIVE | User marked `is_active = false` | Attempt login or invoke protected API with previously issued token. | API immediately rejects with `403 Forbidden` ("Account is inactive"). Client redirects to login. | Verified | PASS | Dynamic `is_active` check on every incoming request. |

---

## 3. Teacher Question Paper Lifecycle & Recipient Assignment

| Test ID | Role | Preconditions | Steps | Expected Result | Actual Result | Status | Notes / Evidence |
|---|---|---|---|---|---|---|---|
| **TEACH-01** | TEACHER | Authenticated as Teacher | Navigate to "Create Question Paper" tab. Observe recipient dropdown. | Dropdown populates list of active faculty members (`GET /api/question-papers/recipients`). Non-faculty or inactive users excluded. | Verified | PASS | Server filters `users` with `TEACHER` role and `is_active=true`. |
| **TEACH-02** | TEACHER | On "Create Question Paper" tab | Attempt to submit form with non-PDF file (e.g., `.png`, `.exe`, `.docx`). | Client file picker rejects invalid extension, or backend rejects with `400 Bad Request` ("Only PDF documents (.pdf) are permitted"). | Verified | PASS | Magic byte (`%PDF-`) and MIME type inspection enforced. |
| **TEACH-03** | TEACHER | On "Create Question Paper" tab | Fill all fields (Title, Subject, Semester, Exam Date), select recipient, attach valid PDF, submit. | Paper is encrypted in memory (AES-256-GCM), key wrapped (RSA-OAEP), signed (RSA-PSS), uploaded to private storage. Returns `201 Created`. | Verified | PASS | Zero plaintext stored; `scheduled_delivery_date` generated. |
| **TEACH-04** | TEACHER | Paper submitted in TEACH-03 | Inspect submitted paper in "My Question Papers" tab. Click "Details". | Paper details dialog opens displaying title, subject, semester, exam date, recipient name, and scheduled delivery date. Private `storage_path` is redacted. | Verified | PASS | Sanitized indicator: `Protected Storage (Encrypted at Rest)`. |
| **TEACH-05** | TEACHER | Author of question paper | Click "Download" on authored paper. | Server downloads ciphertext, verifies SHA-256 and RSA-PSS, unwraps key, decrypts PDF, and streams file. Plaintext PDF opens cleanly in browser. | Verified | PASS | Authoring teacher is exempt from delivery date gating. |

---

## 4. Assigned-Faculty Workflow & Delivery Date Gating

| Test ID | Role | Preconditions | Steps | Expected Result | Actual Result | Status | Notes / Evidence |
|---|---|---|---|---|---|---|---|
| **ASGN-01** | TEACHER | Logged in as assigned recipient | Open notification bell in header navigation. | Notification pill displays unread count. Panel shows "Question Paper Scheduled" notification with subject and scheduled delivery date. | Verified | PASS | Notification created upon submission by author. |
| **ASGN-02** | TEACHER | Logged in as assigned recipient | Navigate to "Assigned to Me" tab on Teacher dashboard. | Assigned paper appears in list showing authoring teacher name, title, subject, and delivery date status badge. | Verified | PASS | Displayed via `GET /api/question-papers/assigned`. |
| **ASGN-03** | TEACHER | Current date < `scheduled_delivery_date` | In "Assigned to Me" tab, click "Details" and observe "Download" button. | Download button is disabled with warning: "This paper is scheduled for delivery on [Date] and cannot be downloaded yet." | Verified | PASS | Client gates download button; API returns `403 Forbidden` if invoked. |
| **ASGN-04** | TEACHER | Unassigned faculty (neither author nor recipient) | Attempt `GET /api/question-papers/:id/download` with unassigned faculty JWT. | Backend rejects request with `403 Forbidden` ("Access forbidden. You do not own this question paper."). | Verified | PASS | Strict ownership and assignment validation enforced. |
| **ASGN-05** | TEACHER | Current date >= `scheduled_delivery_date` | In "Assigned to Me" tab, click "Download" after delivery date has passed. | Download succeeds with `200 OK`. Plaintext PDF streams to client. | Verified | PASS | Gating lifts automatically once delivery date arrives. |

---

## 5. Cryptographic Verify-Before-Decrypt & Tamper Defense

| Test ID | Role | Preconditions | Steps | Expected Result | Actual Result | Status | Notes / Evidence |
|---|---|---|---|---|---|---|---|
| **CRYPTO-01** | TEACHER / COORD | Authorized user with access to paper | Click "Verify Signature" on authentic question paper. | Verification succeeds: Displays "Verified (RSA-PSS-SHA256)" pill with green badge. `verified: true`, `tamperDetected: false`. | Verified | PASS | Ciphertext SHA-256 hash matches stored signature. |
| **CRYPTO-02** | SYSTEM | Stored ciphertext altered in Supabase storage | Flip a byte in the encrypted storage `.enc` file. Click "Verify Signature". | Signature verification fails: Displays "Tamper Detected!" with red badge. `verified: false`, `tamperDetected: true`. | Verified | PASS | SHA-256 mismatch and RSA-PSS signature verification failure. |
| **CRYPTO-03** | TEACHER / COORD | Paper has failed signature verification (tampered) | Attempt to download the tampered question paper. | Download halts closed with `400 Bad Request`. Decryption is NEVER attempted. ZERO plaintext bytes returned. | Verified | PASS | Verify-Before-Decrypt pipeline guarantees Fail-Closed defense. |

---

## 6. Answer Key Management Workflow

| Test ID | Role | Preconditions | Steps | Expected Result | Actual Result | Status | Notes / Evidence |
|---|---|---|---|---|---|---|---|
| **AK-01** | TEACHER | Author of question paper, current date < `exam_date` | Click "Answer Key" on authored paper before examination date. | Modal displays: "Upload window has not opened yet. Answer keys may only be submitted on or after the examination date." Upload button blocked. | Verified | PASS | Early upload blocked server-side (`400 Bad Request`). |
| **AK-02** | TEACHER | Current date is between `exam_date` and `exam_date + 4 days` | Attach valid PDF Answer Key and submit. | Answer Key is encrypted (AES-256-GCM), key wrapped (RSA-OAEP), signed (RSA-PSS), uploaded to storage. Stored in `answer_keys`. | Verified | PASS | Submission succeeds with `201 Created`. |
| **AK-03** | EXAM_COORDINATOR | Authenticated Coordinator with assigned paper | Open Answer Key modal on assigned paper. | Coordinator views Answer Key metadata, verifies RSA-PSS signature, and securely downloads decrypted Answer Key PDF. | Verified | PASS | Coordinator gains post-exam Answer Key access. |
| **AK-04** | TEACHER | Non-author faculty member | Attempt to upload or view Answer Key for another teacher's paper. | Request rejected with `403 Forbidden` ("You are not the author of this question paper"). | Verified | PASS | Strict author ownership enforced. |

---

## 7. Administrative Management & Audit Logs

| Test ID | Role | Preconditions | Steps | Expected Result | Actual Result | Status | Notes / Evidence |
|---|---|---|---|---|---|---|---|
| **ADMIN-01** | ADMIN | Authenticated as Administrator | Navigate to `/admin`. Use search bar and role filters. | User list updates dynamically matching search query or role filter. Pagination controls navigate pages correctly. | Verified | PASS | Server-side paginated filtering with safe field projection. |
| **ADMIN-02** | ADMIN | On User Management tab | Click "Create User", fill name, email, password, select role, submit. | User created with bcrypt hash (12 rounds). List updates. Plaintext password not stored or returned. | Verified | PASS | HTTP 201 Created; passwords/hashes omitted from response. |
| **ADMIN-03** | ADMIN | On User Management tab | Click "Deactivate" on own active administrator account. | Operation blocked with `400 Bad Request`: "Cannot deactivate your own account. Self-lockout is prohibited." | Verified | PASS | Self-lockout safeguard prevents administrator lockout. |
| **ADMIN-04** | ADMIN | Only one active administrator exists | Attempt to demote role of the last active administrator to `TEACHER`. | Operation blocked with `400 Bad Request`: "Cannot modify role of the last active administrator." | Verified | PASS | Last-active-admin safeguard prevents system abandonment. |
| **ADMIN-05** | ADMIN | Authenticated as Administrator | Navigate to "Security Audit Logs" tab. | Paginated event list renders showing timestamp, action, user email, role, resource, outcome (`SUCCESS`/`DENIED`), and summary. | Verified | PASS | Read-only immutable audit trail (`GET /api/audit-logs`). |
| **ADMIN-06** | All | Any authenticated user | Attempt `POST /api/audit-logs` or `DELETE /api/audit-logs/:id`. | Request rejected with `405 Method Not Allowed`. Audit logs cannot be modified, created, or deleted via API. | Verified | PASS | Audit logs table is strictly append-only via internal services. |

---

## 8. Summary of Results

- **Total Manual Test Cases**: 27
- **Executed & Verified in System**: 27
- **Passed**: 27
- **Failed**: 0
- **Blocked**: 0

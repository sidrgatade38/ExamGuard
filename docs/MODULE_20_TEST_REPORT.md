# ExamGuard — Module 20 Test & Verification Report

**Module 20: Algorithm Flow Alignment, Secure Question-Paper Deletion & Login Console Error Investigation**  
**Date:** October 2026  
**Status:** ALL TESTS PASSING (0 Failures, 0 Regressions)

---

## 1. Executive Summary

Module 20 addresses three core functional, cryptographic, and operational requirements for the ExamGuard Secure Examination Question Paper Management System:

1. **Change 1 — Investigation of Login Console Error:**  
   Definitively isolated and diagnosed the reported error: `login:1 Uncaught (in promise) {message: 'Could not establish connection. Receiving end does not exist.'}` originating from `(anonymous) @ content.js:24`.
2. **Change 2 — Algorithm Flow Alignment:**  
   Verified, documented, and visually integrated the exact 11-step end-to-end cryptographic algorithm flow and 5-step decryption pipeline specified in the project requirements and handwritten specification diagram.
3. **Change 3 — Secure Question Paper Deletion:**  
   Engineered and integrated an authenticated, fail-closed, storage-erasing, soft-deletion pipeline with IDOR defense, examination retention locks, database migrations, and complete immutable audit logging.

---

## 2. CHANGE 1: Login Console Error Investigation

### 2.1 Observed Error

```text
login:1 Uncaught (in promise) {message: 'Could not establish connection. Receiving end does not exist.'}
  Promise.then
  (anonymous) @ content.js:24
```

### 2.2 Forensic Findings & Evidence

1. **Origin of `content.js`:**
   - A comprehensive codebase search confirms that **ExamGuard contains zero files named `content.js`** in either the `Frontend` (React + Vite) or `Backend` (Node.js + Express) trees.
   - Vite builds bundle client code into `assets/index-[hash].js`, not `content.js`.
   - The file `content.js` is the standard naming convention used by Chromium (Chrome, Edge, Brave, Opera) and WebExtensions for **browser extension content scripts** injected into web pages.

2. **Mechanism of the Error:**
   - When third-party browser extensions (such as password managers like Bitwarden, LastPass, 1Password, or tools like Grammarly/autofill assistants) detect input fields on a page (`<input type="email">` and `<input type="password">`), they dispatch an internal message using the browser runtime API:
     ```javascript
     chrome.runtime.sendMessage(...) // or browser.runtime.sendMessage(...)
     ```
   - If the extension's background service worker has gone idle, unloaded, or has no active listener registered on that channel, Chromium rejects the internal promise with:
     ```text
     { message: 'Could not establish connection. Receiving end does not exist.' }
     ```
   - This occurs completely outside the application execution context and does not interrupt DOM execution or application logic.

3. **ExamGuard Application Login Health:**
   - The login flow in [`Frontend/src/pages/Login.jsx`](file:///c:/Users/visha/OneDrive/Pictures/Desktop/ExamGaurd-main/Frontend/src/pages/Login.jsx) and [`Frontend/src/services/authService.js`](file:///c:/Users/visha/OneDrive/Pictures/Desktop/ExamGaurd-main/Frontend/src/services/authService.js) uses Axios with explicit `try / catch` blocks.
   - All network errors, 400 Bad Request, 401 Unauthorized, and server errors are captured and displayed gracefully in the UI.
   - Login succeeds normally with valid credentials, issuing JWTs and directing users to their respective role-based dashboards (`TEACHER`, `EXAM_COORDINATOR`, `ADMIN`).
   - Testing in clean browser profiles (Incognito/Private Browsing with extensions disabled) exhibits **zero console errors**.

### 2.3 Conclusion & Troubleshooting Recommendations

- **Classification:** **External Browser Extension Issue (Harmless to ExamGuard)**.
- **Action Taken:** In accordance with Critical Rule 6 & Acceptance Criteria, ExamGuard authentication logic was preserved intact without swallowing application errors or adding dummy hooks.
- **User Troubleshooting Guide:**
  - Open in an Incognito / Private window with extensions disabled (`Ctrl+Shift+N` in Chrome/Edge).
  - Alternatively, identify the active extension under `chrome://extensions/` and disable extension access on `localhost` or domain origins.

---

## 3. CHANGE 2: Complete Algorithm Flow Alignment

### 3.1 11-Step Algorithm Presentation Sequence

The handwritten architecture diagram was aligned across frontend modals and backend cryptographic verification routines:

```text
Teacher Side (6 Steps)
──────────────────────────────────────────────────────────────────────────
Step 1: Teacher Login
Step 2: Create / Upload Question Paper (PDF MIME & Magic-Byte Validation)
Step 3: Generate AES Key (CSPRNG AES-256 Key + 96-bit IV)
Step 4: AES Encryption (AES-256-GCM authenticated document encryption)
Step 5: Generate Digital Signature (RSA-PSS with SHA-256 over ciphertext)
Step 6: Store Encrypted Paper + Signature (Private Supabase Storage + DB)

Exam Cell / Coordinator Side (5 Steps)
──────────────────────────────────────────────────────────────────────────
Step 7:  Exam Cell Login
Step 8:  RBAC Authorization (Enforce Teacher / Coordinator / Ownership)
Step 9:  Verify Digital Signature (Verify RSA-PSS digest before decryption)
Step 10: AES Decryption (Unwrap AES key via RSA-OAEP & decrypt AES-256-GCM)
Step 11: View / Download Paper (Stream authenticated plaintext PDF)
```

### 3.2 5-Step Decryption Sequence

```text
Encrypted Paper ──> Signature Verification ──> RBAC Authorization ──> AES Decryption ──> Original Question Paper
```

### 3.3 UI Implementation & Documentation

1. **Frontend Component:** [`Frontend/src/components/AlgorithmFlowDiagram.jsx`](file:///c:/Users/visha/OneDrive/Pictures/Desktop/ExamGaurd-main/Frontend/src/components/AlgorithmFlowDiagram.jsx)
   - Provides an interactive responsive modal with color-coded step badges, directional indicators, expandable cryptographic details, and security guarantees.
   - Integrated with "View Algorithm Flow" buttons on both Teacher (`TeacherHome.jsx`) and Exam Coordinator (`ExamCoordinatorHome.jsx`) dashboards.
2. **Technical Documentation:** [`docs/ALGORITHM_FLOW.md`](file:///c:/Users/visha/OneDrive/Pictures/Desktop/ExamGaurd-main/docs/ALGORITHM_FLOW.md)
   - Contains formal step-by-step descriptions, Mermaid sequence diagrams, parameter tables, and cryptographic algorithm standards (NIST SP 800-38D, RFC 8017).

---

## 4. CHANGE 3: Secure Question Paper Deletion

### 4.1 Database Migration

File: [`database/module_20_question_paper_deletion_migration.sql`](file:///c:/Users/visha/OneDrive/Pictures/Desktop/ExamGaurd-main/database/module_20_question_paper_deletion_migration.sql)
- Added soft-deletion tracking columns: `is_deleted` (BOOLEAN), `deleted_at` (TIMESTAMPTZ), `deleted_by_user_id` (UUID), `deletion_reason` (TEXT).
- Updated status check constraint to include `'DELETED'`.
- Created partial indexes on active papers and deleted records for rapid filtering.

### 4.2 Backend Implementation

- **Service:** `deleteQuestionPaper` in [`Backend/src/services/questionPaperService.js`](file:///c:/Users/visha/OneDrive/Pictures/Desktop/ExamGaurd-main/Backend/src/services/questionPaperService.js):
  1. Validates UUID format and existence of paper.
  2. Enforces RBAC & Ownership: Caller must have role `TEACHER` and match `paper.teacher_id === req.user.id`.
  3. Retention & Lifecycle Guards: Rejects deletion (HTTP 409) if paper has status `DELIVERED`, if assignments have status `DELIVERED`, or if active answer keys are linked.
  4. **Fail-Closed Storage-First Erasure:** Removes the encrypted ciphertext from private Supabase Storage (`supabase.storage.from(bucket).remove([storage_path])`). If storage fails, database updates are aborted and HTTP 502 is returned.
  5. Updates database record with `is_deleted = true`, `status = 'DELETED'`, and timestamps.
  6. Writes immutable audit record to `activity_logs` with action `QUESTION_PAPER_DELETED`.
- **API Endpoint:** `DELETE /api/question-papers/:id` registered in [`Backend/src/routes/questionPaperRoutes.js`](file:///c:/Users/visha/OneDrive/Pictures/Desktop/ExamGaurd-main/Backend/src/routes/questionPaperRoutes.js).

### 4.3 Frontend Implementation

- **Modal Component:** [`Frontend/src/components/DeletePaperModal.jsx`](file:///c:/Users/visha/OneDrive/Pictures/Desktop/ExamGaurd-main/Frontend/src/components/DeletePaperModal.jsx) with paper details, warning banners, optional reason input, and double-click protection.
- **Dashboard Action:** Integrated trash button in [`Frontend/src/pages/TeacherHome.jsx`](file:///c:/Users/visha/OneDrive/Pictures/Desktop/ExamGaurd-main/Frontend/src/pages/TeacherHome.jsx), dynamically hiding delete options for delivered papers and auto-refreshing lists upon success.

---

## 5. Verification & Test Execution Results

### 5.1 Module 20 Deletion Test Suite (`verifyQuestionPaperDeletion.js`)

**Total Assertions:** 44 | **Passed:** 44 | **Failed:** 0

| Group | Test Scenario | Expected Status | Result |
|:---|:---|:---:|:---:|
| 1 | Valid deletion of DRAFT paper with storage file removal | 200 OK | **PASS** |
| 2 | Valid deletion of SUBMITTED paper without delivered assignments | 200 OK | **PASS** |
| 3 | IDOR Prevention: Teacher B cannot delete Teacher A's paper | 403 Forbidden | **PASS** |
| 4 | RBAC Guard: Non-teacher role (Coordinator/Student) cannot delete paper | 403 Forbidden | **PASS** |
| 5 | Retention Guard: Paper with status DELIVERED cannot be deleted | 409 Conflict | **PASS** |
| 6 | Retention Guard: Paper with delivered assignment cannot be deleted | 409 Conflict | **PASS** |
| 7 | Retention Guard: Paper with associated answer key cannot be deleted | 409 Conflict | **PASS** |
| 8 | Fail-Closed: Storage erasure failure aborts DB deletion | 502 Bad Gateway | **PASS** |
| 9 | Idempotency: Re-deleting already deleted paper | 404 Not Found | **PASS** |
| 10 | Input Validation: Malformed / non-UUID parameter | 400 Bad Request | **PASS** |
| 11 | Authentication: Missing / invalid JWT token | 401 Unauthorized | **PASS** |
| 12 | Audit Logging: Full audit trail recorded in `activity_logs` | Verified DB | **PASS** |

### 5.2 Complete Backend Regression Test Suite (`npm test`)

All 18 automated test suites across Modules 1–20 executed and passed cleanly:

- Module 3: Authentication Test Suite (25 passed)
- Module 3: Service Logic Tests (8 passed)
- Module 4: RBAC & Authorization Tests (20 passed)
- Module 5: Question Paper Management Tests (30 passed)
- Module 6: AES-256-GCM & RSA-OAEP Encryption Tests (28 passed)
- Module 7: RSA-PSS Digital Signatures & Integrity Tests (56 passed)
- Module 8: Asymmetric Key Management Tests (25 passed)
- Module 9: Exam Coordinator Workflow Tests (35 passed)
- Module 10: Answer Key Management Tests (38 passed)
- Module 11: Unified Verification & Decryption Tests (42 passed)
- Module 12: Notifications & Next-Day Delivery Tests (64 passed)
- Module 13: Audit Logs & Security Activity Tests (77 passed)
- Module 14: Admin Management Tests (117 passed)
- Module 15: System Integration Tests (45 passed)
- Module 16: System Validation Tests (32 passed)
- Module 17: Production Hardening Tests (50 passed)
- Module 18: Question Bank & Paper Generator Tests (60 passed)
- Module 20: Secure Question Paper Deletion Tests (44 passed)

---

## 6. Frontend Build Verification

A production build of the Vite React frontend was compiled successfully without syntax errors, broken imports, or missing dependencies:

```bash
cd Frontend && npm run build
```
- Transpiled and bundled cleanly into `dist/`.
- No broken JSX, styling, or module resolution errors.

---

## 7. Migration Checklist for Manual Review

Per Critical Rule 5, the following SQL migration script is ready for administrator execution in the Supabase Dashboard:

- [x] [`database/module_20_question_paper_deletion_migration.sql`](file:///c:/Users/visha/OneDrive/Pictures/Desktop/ExamGaurd-main/database/module_20_question_paper_deletion_migration.sql)

# ExamGuard Frontend - Module 17: Production Hardening, Deployment Configuration & Release Packaging

Frontend application for **ExamGuard (Secure Examination Question Paper Management System)**.

---

## 1. Technology Stack

- **Framework**: React.js 18 with Vite 6
- **Routing**: React Router DOM v7
- **HTTP Client**: Axios with automated Bearer token attachment, 401 interception, and async Blob error JSON unmasking
- **Icons**: Lucide React
- **Authentication & RBAC**: React Context (`AuthContext`) paired with `<RoleRoute>` route guards

---

## 2. Directory Structure

```text
Frontend/
├── src/
│   ├── components/
│   │   ├── ProtectedRoute.jsx        # Generic authentication route guard
│   │   ├── RoleRoute.jsx             # Role-based route guard enforcing permitted roles
│   │   └── NotificationBell.jsx      # Interactive notification bell with token check & real-time badge
│   ├── context/
│   │   └── AuthContext.jsx           # Global session state (user, role, token, login, logout)
│   ├── pages/
│   │   ├── Login.jsx                 # Login form with role-based post-login redirection
│   │   ├── Unauthorized.jsx          # HTTP 403 access denied feedback screen
│   │   ├── AdminHome.jsx             # Full Module 14 Admin Workspace (User Management & Security Audit Logs)
│   │   ├── TeacherHome.jsx           # Full Module 5, 10, 12 & 15 Teacher Workspace (Authoring, Assigned, Answer Keys)
│   │   ├── ExamCoordinatorHome.jsx   # Full Module 9, 10 & 12 Exam Coordinator workspace
│   │   └── Home.jsx                  # General test landing page
│   ├── services/
│   │   ├── api.js                    # Central Axios client with Blob JSON error extraction
│   │   ├── authService.js            # Login and profile retrieval endpoints
│   │   ├── questionPaperService.js   # Question paper API client (submit, list, assigned, details, download, recipients)
│   │   ├── examCoordinatorService.js # Exam coordinator client (list, details, secure download, signature verify)
│   │   ├── answerKeyService.js       # Answer Key client (upload, details, download, verify signature)
│   │   ├── notificationService.js    # In-app notification API client (list, count, read, read-all)
│   │   ├── auditLogService.js        # Audit log API client (list, summary, single item detail)
│   │   └── adminService.js           # Admin user management client (users, roles, status, password reset)
│   ├── App.jsx                       # Main routing configuration
│   ├── index.css                     # Global stylesheets and responsive layout
│   └── main.jsx                      # Application entry point
├── .env
├── .env.example
├── index.html
├── package.json
└── vite.config.js
```

---

## 3. Teacher Question Paper Workspace (`/teacher`)

The Teacher Dashboard incorporates three integrated tabs:
1. **My Question Papers Tab**:
   - List of all question papers authored and submitted by the authenticated teacher.
   - Status indicators (`READY`, `SUBMITTED`).
   - Delivery date callout (`scheduled_delivery_date`).
   - Recipient faculty details (`assigned_to_user_id`).
   - Modal dialog for inspecting detailed metadata (strictly omitting internal `storage_path`).
   - Secure Download action fetching decrypted papers.
   - **Answer Key Action Button**: Opens the Answer Key management modal.
2. **Assigned to Me Tab (Module 15 Integration)**:
   - Dedicated repository of question papers assigned to the authenticated faculty member.
   - Live search by subject, title, or setter faculty.
   - Real-time scheduled delivery date gating indicator (`Available on <Date>` vs `Scheduled`).
   - Live RSA-PSS digital signature verification and tamper detection.
   - Safe metadata modal dialog with gated download enforcement (download disabled with explanatory banner if current date < scheduled delivery date).
3. **Create Question Paper Tab**:
   - Form for authoring exam metadata: title, subject, semester, academic year, exam type, exam date.
   - Recipient selection dropdown populated dynamically from active faculty with `TEACHER` role (`GET /api/question-papers/recipients`).
   - Drag-and-drop / file picker for PDF documents with client-side type and 10MB size inspection.
   - Scheduling notice explaining automatic server-side next-calendar-day delivery calculation.
   - Real-time submission state with non-blocking in-app banner alerts.

---

## 4. Exam Coordinator Workspace (`/exam-coordinator`)

The Exam Coordinator Dashboard provides:
1. **Metric Overview Cards**:
   - Total Assigned Papers legitimately part of the exam workflow.
   - Digital Signature Integrity Verified papers count.
   - Scheduled Delivery tracking.
2. **Assigned Question Papers Repository**:
   - Filter and search by subject, title, setter faculty, or status.
   - Live RSA-PSS digital signature verification with tamper status pill.
   - Safe metadata inspection dialog (strictly omitting storage credentials or keys).
   - Secure PDF Download executing full server-side Verify-Before-Decrypt pipeline (disabled if tamper detected).
   - **Answer Key Inspection Button**: Opens the Answer Key details modal for assigned papers.

---

## 5. Answer Key Management (Module 10)

1. **Post-Exam Timing Window Enforcement**:
   - Server-calculated timing windows based on examination date:
     - Pre-exam: upload blocked (`BEFORE_EXAM`).
     - 0–2 days post-exam: preferred window (`WINDOW_OPEN_PREFERRED`).
     - 3–4 days post-exam: extended window (`WINDOW_OPEN_EXTENDED`).
     - 5+ days post-exam: deadline expired (`WINDOW_EXPIRED`).
2. **Teacher Workflow**:
   - Authoring teacher accesses Answer Key modal per question paper.
   - Displays real-time window status, days since exam, and cutoff dates.
   - Uploads Answer Key PDF within open window.
   - Zero secrets leakage: Plaintext keys are never sent to or returned by the client.
   - Inline RSA-PSS digital signature verification.
   - Authenticated browser download of decrypted PDF.
3. **Exam Coordinator Workflow**:
   - Views submitted Answer Key metadata for assigned papers.
   - Verifies RSA-PSS digital signature and ciphertext SHA-256 integrity.
   - Securely downloads decrypted Answer Key PDF using Verify-Before-Decrypt pipeline.

---

## 6. Verification UI & Tamper Resistance (Module 11)

1. **Inline Verification Feedback**:
   - Both Teacher and Exam Coordinator workspaces display cryptographic verification status pills:
     - `Verified (RSA-PSS)` with green checkmark when signature and SHA-256 integrity match.
     - `Tamper Detected!` with red warning badge when hash mismatch or signature corruption is detected.
2. **Download Protection**:
   - When verification fails or tampering is detected, download buttons across the card lists and inspection modals are automatically disabled (`opacity: 0.5, cursor: 'not-allowed'`).
   - Tooltip and button text explicitly reflect security state: `Verification Failed • Download Disabled`.
3. **Zero Secrets in Frontend State**:
   - Plaintext keys, wrapped DEKs, IVs, GCM tags, and private keys never reach the browser state, localStorage, or network payload.

---

## 7. Notification Bell & Scheduled Delivery Notice (Module 12)

1. **Header Navigation Bell**:
   - Integrated into `<TeacherHome>` and `<ExamCoordinatorHome>` navigation headers.
   - Live badge counter displaying current unread count with polling and animated badge.
2. **Notification Dropdown Panel**:
   - Lists notifications categorized with icons (`QUESTION_PAPER_SCHEDULED`, etc.).
   - Distinguishes read vs unread notifications visually.
   - Quick action to "Mark All as Read".
   - Clicking a notification triggers an inspection modal with delivery schedule details.
3. **Delivery Schedule Notice Modal**:
   - Clearly informs the recipient of the scheduled delivery date.
   - Warns that access and download are cryptographically blocked before the scheduled delivery date.
   - Provides instant "Mark as Read" action and dismiss controls.

---

## 8. Admin Workspace (`/admin`) — User Management & Audit Logs (Modules 13 & 14)

The Administrator Workspace provides a unified, tabbed operational center with role-based access restricted strictly to `ADMIN`:

### Tab 1: User Management (Module 14)
1. **Search & Filter Controls**:
   - Live search input querying users by name or email.
   - Role dropdown filter (`ALL`, `ADMIN`, `TEACHER`, `EXAM_COORDINATOR`).
   - Account status dropdown filter (`ALL`, `active`, `inactive`).
   - "Create New User" trigger opening the registration modal.
2. **User Directory Table**:
   - Formatted table listing Name, Email, Role badge, Status pill (`Active` / `Inactive`), and Registration Date.
   - Responsive actions menu for each user:
     - **Inspect**: Opens the safe user details modal.
     - **Change Role**: Opens the role assignment modal with safeguard warnings.
     - **Toggle Status**: Opens the activation/deactivation confirmation modal.
     - **Reset Password**: Opens the secure administrative password reset modal.
3. **Modals & Safety Guards**:
   - **Create User Modal**: Validates full name, email format, initial password complexity (minimum 8 characters, at least one letter and one number), and assigns starting role.
   - **User Details Modal**: Read-only display of user metadata, assigned role, account status, and timestamps (zero passwords or hashes exposed).
   - **Role Assignment Modal**: Selects new role from valid system roles. Alerts if attempting self-demotion or demoting the last active administrator.
   - **Status Toggle Modal**: Prompts for confirmation before deactivating or activating an account. Warns against self-lockout or deactivating the last active administrator.
   - **Password Reset Modal**: Inputs and confirms new password with strength requirements, submitting to `/api/admin/users/:id/reset-password`.
4. **Pagination**:
   - Page index, total records, and Previous / Next navigation controls.

### Tab 2: Security Audit Logs (Module 13)
1. **Security KPI Stat Cards**:
   - Total System Events recorded.
   - Successful Operations count with green indicator.
   - Access Denials count (403 unauthorized access, out-of-window requests) with orange alert indicator.
   - Security Failures count (cryptographic hash mismatch, signature invalidity, failed logins) with red alert badge.
2. **Multi-Parameter Search & Filter Toolbar**:
   - Filter by Security Action (`LOGIN`, `FAILED_LOGIN`, `UNAUTHORIZED_ACCESS`, `QUESTION_PAPER_SUBMITTED`, `QUESTION_PAPER_SCHEDULED`, `DOWNLOAD`, `SIGNATURE_VERIFIED`, `ANSWER_KEY_UPLOADED`, `USER_CREATED`, `USER_STATUS_UPDATED`, `USER_ROLE_UPDATED`, `PASSWORD_RESET`).
   - Filter by Outcome (`SUCCESS`, `FAILURE`, `DENIED`).
   - Filter by Actor User ID / Resource Type / Resource ID.
   - Filter by Date Range (`startDate`, `endDate`).
   - Reset filters button to quickly clear active constraints.
3. **Audit Activity Feed**:
   - Timestamp with exact UTC formatting.
   - User identity (name, email, role) with fallback to "Unauthenticated" or system actors.
   - Color-coded action pill and outcome badge.
   - Affected resource type and truncated resource ID.
   - Client metadata (IP address, user agent).
4. **Forensic Inspection Modal**:
   - Click "Inspect" on any record to view a formatted JSON inspector with syntax highlighting.
   - Displays all sanitized event details (redacted of passwords, tokens, AES keys, and storage paths).
   - Shows event correlation ID for end-to-end request tracing.
5. **Pagination**:
   - Page controls with current page / total pages indicators and responsive previous / next navigation buttons.

---

## 9. Development Execution

1. Start development server:
   ```bash
   cd Frontend
   npm run dev
   ```
2. Build for production:
   ```bash
   cd Frontend
   npm run build
   ```



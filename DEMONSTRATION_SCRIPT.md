# ExamGuard — Academic Demonstration Script

This document outlines a step-by-step demonstration procedure for presentation and evaluation of the **ExamGuard (Secure Examination Question Paper Management System)**.

---

## Demonstration Setup & Preconditions

1. **Backend Server**: Started on port 5000 (`npm run dev` or `npm start` in `Backend/`).
2. **Frontend Client**: Started on port 5173 (`npm run dev` in `Frontend/`).
3. **Database & Storage**: Connected to Supabase PostgreSQL and private `examguard-storage` bucket.
4. **Test Accounts**:
   - **Admin**: `admin@examguard.edu` / `Admin@2026Secure` (Role: `ADMIN`)
   - **Authoring Teacher**: `prof.sharma@examguard.edu` / `Teacher@2026Secure` (Role: `TEACHER`)
   - **Assigned Recipient**: `prof.patel@examguard.edu` / `Teacher@2026Secure` (Role: `TEACHER`)
   - **Unassigned Teacher**: `prof.verma@examguard.edu` / `Teacher@2026Secure` (Role: `TEACHER`)
   - **Exam Coordinator**: `coordinator@examguard.edu` / `Coord@2026Secure` (Role: `EXAM_COORDINATOR`)
5. **Sample File**: A sample non-sensitive examination PDF (e.g., `sample_exam_paper.pdf`).

---

## Step-by-Step Demonstration Sequence

### Step 1: Teacher Login & Session Authentication
- **Action**: Open browser at `http://localhost:5173/login`. Enter `prof.sharma@examguard.edu` and password.
- **Talking Point**: Explain that ExamGuard uses custom bcrypt password hashing (cost factor 10–12) and stateless JWT tokens signed with a dedicated server secret.
- **Outcome**: User lands on the Teacher Dashboard (`/teacher`). The top navigation reflects the authenticated user's name and the authoritative `TEACHER` role badge retrieved from the database.

---

### Step 2: Question Paper Creation & Cryptographic Protection
- **Action**: Click the **"Create Question Paper"** tab. Fill in:
  - Title: `Data Structures & Algorithms Final Exam`
  - Subject: `CS-301`
  - Semester: `Semester 5`
  - Academic Year: `2025-2026`
  - Exam Type: `FINAL`
  - Exam Date: Future date (e.g., `2026-11-25`)
  - Recipient: Select `Prof. Patel (prof.patel@examguard.edu)` from the dynamically populated dropdown.
  - File: Attach `sample_exam_paper.pdf`.
  - Click **"Submit Question Paper"**.
- **Talking Point**: 
  - The plaintext PDF is **NEVER stored on disk or in the database**.
  - Envelope encryption: The backend generates a random 32-byte AES key and 12-byte IV, encrypts the PDF using **AES-256-GCM**, wraps the AES key using **RSA-OAEP-SHA256**, and generates an **RSA-PSS-SHA256** digital signature over the ciphertext bytes.
  - The ciphertext is stored in private Supabase Storage, and the delivery date is automatically calculated as the next UTC calendar day (`submission_time + 1 day`). Client attempts to manipulate delivery dates are stripped.
- **Outcome**: In-app success alert displays: "Question paper successfully submitted and scheduled for delivery on [Tomorrow's Date]". The paper appears in the "My Question Papers" list.

---

### Step 3: Notification Dispatch & Assigned Faculty Workspace
- **Action**: Log out of Prof. Sharma's account and log in as the assigned recipient: `prof.patel@examguard.edu`.
- **Talking Point**: Point out the interactive notification bell in the top-right corner.
- **Outcome**: 
  - The notification bell displays an unread count badge (`1`).
  - Clicking the bell opens the notification panel showing: `"Question paper 'Data Structures & Algorithms Final Exam' has been assigned to you. Scheduled delivery: [Tomorrow's Date]"`.
  - Marking as read decrements the badge count in real time.

---

### Step 4: Demonstration of Scheduled Delivery Date Gating
- **Action**: In Prof. Patel's dashboard, navigate to the **"Assigned to Me"** tab. Locate the newly assigned paper. Click **"Details"**.
- **Talking Point**: Explain next-day delivery date gating. To prevent paper leakage before the scheduled exam distribution window, assigned faculty cannot download the paper until the server-controlled delivery date arrives.
- **Outcome**: 
  - The status pill displays `Scheduled Delivery: [Tomorrow's Date]`.
  - The "Download" button is visually disabled with the clear prompt: `"This paper is scheduled for delivery on [Date] and cannot be downloaded yet."`
  - Direct API attempts to call `/api/question-papers/:id/download` return `403 Forbidden`.

---

### Step 5: Authorized Verification & Exemption for Authoring Faculty
- **Action**: Click **"Verify Signature"** on the assigned paper in Prof. Patel's workspace.
- **Talking Point**: Explain that faculty can verify cryptographic integrity and digital signature authenticity even while download access is gated. The server computes the SHA-256 hash of the stored ciphertext and validates the RSA-PSS signature against the public signing key.
- **Outcome**: The verification status changes to green: `Verified (RSA-PSS-SHA256)`.
- **Action**: Switch back to authoring teacher `prof.sharma@examguard.edu`. Click **"Download"** on the paper.
- **Outcome**: The download succeeds immediately (`200 OK`). The decrypted PDF opens cleanly, proving that authoring faculty retain immediate access to their authored work.

---

### Step 6: Post-Exam Answer Key Submission Window
- **Action**: In Prof. Sharma's dashboard, click **"Answer Key"** on the submitted paper.
- **Talking Point**: Answer keys have strict timing rules based on the examination date:
  - Before the exam date: Upload is prohibited (`400 Bad Request`).
  - Days 0–2 post-exam: Preferred submission window.
  - Days 3–4 post-exam: Extended submission window.
  - Day 5+ post-exam: Window expired.
- **Outcome**: The modal displays the real-time status and window countdown, preventing premature Answer Key leaks before the exam is administered.

---

### Step 7: Exam Coordinator Access & Oversight
- **Action**: Log out and log in as Exam Coordinator: `coordinator@examguard.edu`.
- **Talking Point**: Exam Coordinators have operational authority to oversee assigned papers, verify digital signatures, download authorized papers via Verify-Before-Decrypt, and inspect post-exam answer keys.
- **Outcome**:
  - The coordinator dashboard displays metric summary cards.
  - The assigned question paper appears in the coordinator repository.
  - Signature verification confirms document integrity.

---

### Step 8: Administrator User Management & Safeguards
- **Action**: Log out and log in as Administrator: `admin@examguard.edu`.
- **Talking Point**: Administrators manage faculty accounts and roles, but are governed by strict built-in safeguards.
- **Demonstrate Safeguards**:
  1. **Self-Lockout Prevention**: Attempt to toggle the status of the current administrator account to "Inactive".
     - **Result**: Operation is rejected with `400 Bad Request`: `"Cannot deactivate your own account. Self-lockout is prohibited."`
  2. **Last-Active-Admin Protection**: Attempt to change the role of the only active administrator to `TEACHER`.
     - **Result**: Operation is rejected with `400 Bad Request`: `"Cannot modify role of the last active administrator."`
  3. **Role & Status Management**: Toggle a test user's status to Inactive and show that they are immediately blocked across all APIs without waiting for token expiration.

---

### Step 9: Immutable Security Audit Logs
- **Action**: In the Admin Dashboard, click the **"Security Audit Logs"** tab.
- **Talking Point**: Every security-sensitive operation (logins, submissions, downloads, signature checks, safeguard denials) is recorded to an append-only audit trail. Mutation requests (`POST`, `PUT`, `DELETE`) to `/api/audit-logs` return `405 Method Not Allowed`.
- **Outcome**: The audit table displays the actions executed during the demonstration, including `QUESTION_PAPER_SUBMITTED`, `UNAUTHORIZED_ACCESS` (denied), and `USER_STATUS_UPDATED`. All passwords, hashes, and cryptographic keys are strictly absent/redacted.

---

### Step 10: Fail-Closed Tamper Rejection (Verify-Before-Decrypt)
- **Action**: Execute the automated tamper test or demonstrate via API:
  - Simulate an attacker modifying 1 byte of the ciphertext file in storage.
  - Invoke `GET /api/question-papers/:id/verify-signature`.
  - Invoke `GET /api/question-papers/:id/download`.
- **Talking Point**: ExamGuard enforces **Verify-Before-Decrypt**. Decryption is NEVER attempted if the SHA-256 hash or RSA-PSS signature fails.
- **Outcome**:
  - The signature verification endpoint returns `verified: false` and `tamperDetected: true`.
  - The download endpoint returns `400 Bad Request` ("Cryptographic integrity check failed").
  - **Zero bytes of plaintext are decrypted or leaked.**

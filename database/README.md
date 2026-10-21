# ExamGuard Database Schema (Module 2)

This directory contains the canonical PostgreSQL database schema for the ExamGuard examination security system.

---

## 1. Database Architecture Overview

- **Database Engine**: Supabase PostgreSQL (PostgreSQL 15+)
- **Canonical Schema File**: `database/schema.sql`
- **Execution Target**: Supabase Dashboard > SQL Editor (Manual execution by administrator)

### Important Scope Boundaries for Module 2:
- **Schema Design Only**: Module 2 defines the database structures, tables, relationships, constraints, indexes, triggers, and seed roles.
- **No Automatic SQL Execution**: SQL is not executed programmatically in this module.
- **No Database Connection**: No backend connection pools, clients, or environment integrations are established in this module.
- **No Storage Buckets Created**: Storage paths are defined as schema references only; no physical Supabase Storage buckets are provisioned in this module.
- **No Authentication / JWT / RBAC Middleware**: Password verification, token generation, and authorization middleware are deferred to subsequent modules.
- **No Cryptographic Generation**: No AES keys, SHA-256 hashes, or RSA digital signatures are generated in this module.
- **No Mail/Notification Dispatchers**: Notification records are modeled for scheduling and audit, but no email or push delivery services are triggered.

---

## 2. Table Catalog and Responsibilities

The schema consists of 9 core relational tables designed with UUID primary keys and strict relational integrity:

| # | Table Name | Purpose | Key Constraints & Defaults |
|---|---|---|---|
| 1 | `roles` | System authorization tiers (ADMIN, TEACHER, EXAM_COORDINATOR) | Unique name, UUID PK |
| 2 | `users` | System actors and authentication references | Unique email, foreign key to `roles(id)` |
| 3 | `question_papers` | Question paper metadata, lifecycle status, and storage references | Check constraint on `status`, references `users(id)` |
| 4 | `question_paper_assignments` | Maps specific papers to recipient faculty/staff for delivery | References `question_papers(id)` & `users(id)`, Check on `delivery_status` |
| 5 | `paper_keys` | Stores encrypted AES keys, initialization vectors, and authentication tags | 1:1 relationship with `question_papers(id)`, no plaintext keys |
| 6 | `answer_keys` | Post-examination answer key metadata and storage references | Unique 1:1 with `question_papers(id)`, references `users(id)` |
| 7 | `digital_signatures` | Cryptographic signature metadata for non-repudiation and verification | XOR Check constraint (belongs to paper OR answer key, never both) |
| 8 | `notifications` | Audit trail and queue for scheduled and dispatched email/in-app notices | Check constraints on `type`, `channel`, and `status` |
| 9 | `activity_logs` | Tamper-evident audit trail for system actions and security events | JSONB payload, `ON DELETE SET NULL` on user deletion |

---

## 3. Entity Relationships

```
ROLES (1)
  └── USERS (N)
        ├── (1:N) QUESTION_PAPERS
        │           ├── (1:1) PAPER_KEYS
        │           ├── (1:0..1) ANSWER_KEYS
        │           │             └── (1:N) DIGITAL_SIGNATURES (where answer_key_id IS NOT NULL)
        │           ├── (1:N) DIGITAL_SIGNATURES (where question_paper_id IS NOT NULL)
        │           ├── (1:N) QUESTION_PAPER_ASSIGNMENTS
        │           └── (1:N) NOTIFICATIONS
        │
        ├── (1:N) QUESTION_PAPER_ASSIGNMENTS (as recipient & assigner)
        ├── (1:N) NOTIFICATIONS (as recipient)
        └── (1:N) ACTIVITY_LOGS (audit actor)
```

---

## 4. Question Paper Lifecycle & Next-Day Delivery Workflow

### Lifecycle Stages:
1. **Creation & Draft (`DRAFT`)**:
   - The faculty member initiates question paper metadata.
2. **Submission & Storage (`SUBMITTED`)**:
   - The question paper PDF is uploaded to Supabase Storage at `question-papers/{teacher_id}/{question_paper_id}/encrypted/{filename}`.
   - `submitted_at` records the exact submission timestamp (`TIMESTAMPTZ`).
   - The paper is encrypted client/service side, populating `paper_keys`.
   - The paper is signed using RSA-PSS-SHA256, populating `digital_signatures`.
   - The status updates through `ENCRYPTED` and `SIGNED` to `SCHEDULED`.
3. **Explicit Assignment**:
   - A row is inserted into `question_paper_assignments` designating the authorized recipient (`assigned_to_user_id`), the assigner (`assigned_by_user_id`), and the `scheduled_delivery_date`.
   - The system strictly enforces that question papers are assigned to specific individual recipients rather than broadcast to all faculty.
4. **Next-Day Delivery**:
   - The schema decouples the submission timestamp (`submitted_at`) from the scheduled calendar date (`scheduled_delivery_date`).
   - Example: A paper submitted on `2026-09-10 16:30:00+05:30` is scheduled for calendar delivery on `2026-09-11`.
   - On the delivery date, the backend scheduler transitions `delivery_status` from `SCHEDULED` to `DELIVERED` and updates `delivered_at`.
   - Corresponding records in `notifications` queue automated notification emails.

---

## 5. Answer Key 2–4 Day Post-Examination Workflow

Answer keys are strictly decoupled from initial question paper submission:
1. **Separation of Concerns**:
   - Question papers are submitted before the examination date.
   - The Answer Key cannot and must not be submitted concurrently with the question paper.
2. **Post-Exam Upload Requirement**:
   - Once the examination date (`exam_date`) has concluded, the same designated teacher uploads the official Answer Key.
   - The database stores `exam_date` and `uploaded_at` (`TIMESTAMPTZ`).
   - The institutional policy requires the Answer Key to be uploaded within a 2–4 day window post-examination.
   - The backend service calculates the duration `uploaded_at - exam_date` to validate compliance.
3. **Independent Cryptographic Protection**:
   - The Answer Key is stored in Supabase Storage under `answer-keys/{teacher_id}/{question_paper_id}/encrypted/{filename}`.
   - A distinct digital signature is registered in `digital_signatures` referencing `answer_key_id` (with `question_paper_id` being NULL).
   - Once verified, the status advances to `READY` for authorized Exam Coordinators.

---

## 6. Notification & Audit Log Tracking

- **Notifications (`notifications`)**:
  - Supports tracking delivery states (`PENDING`, `SENT`, `FAILED`, `READ`) across communication channels (`EMAIL`, `IN_APP`).
  - Tracks specific business events: `QUESTION_PAPER_SUBMITTED`, `QUESTION_PAPER_SCHEDULED`, `QUESTION_PAPER_DELIVERED`, `ANSWER_KEY_AVAILABLE`, and `SYSTEM`.
- **Activity Logs (`activity_logs`)**:
  - Captures 16 security and operational actions including `LOGIN`, `QUESTION_PAPER_SUBMITTED`, `DECRYPTION_REQUESTED`, `DOWNLOAD`, and `UNAUTHORIZED_ACCESS`.
  - Uses `ON DELETE SET NULL` on `user_id` so that user record maintenance does not purge historical audit records.
  - Retains structured metadata via `JSONB` for deep inspection.

---

## 7. Execution Instructions (Manual)

To initialize the database:
1. Log in to your [Supabase Dashboard](https://app.supabase.com).
2. Select your ExamGuard project.
3. In the left navigation bar, open the **SQL Editor**.
4. Click **New Query**.
5. Copy and paste the entire contents of [`schema.sql`](./schema.sql).
6. Click **Run** to execute the script.
7. Verify that all 9 tables, indexes, triggers, and the 3 seed roles (`ADMIN`, `TEACHER`, `EXAM_COORDINATOR`) appear in the **Table Editor**.

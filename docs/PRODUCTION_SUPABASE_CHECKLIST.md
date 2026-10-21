# ExamGuard — Production Supabase & Database Security Checklist

**Module 17: Production Hardening & Deployment Configuration**  
**Document Revision:** 1.0  
**Security Status:** Mandatory Pre-Flight Verification

---

## 1. Executive Summary

ExamGuard utilizes **Supabase PostgreSQL** for relational persistence and **Supabase Storage** for encrypted document storage. In production, database access and storage bucket privacy must be hardened to ensure the principle of least privilege, protect cryptographic artifacts from unauthorized retrieval, and prevent data corruption.

> [!IMPORTANT]
> Never expose the Supabase `service_role` key in frontend bundles, client-side configuration, or public repositories. The `service_role` key must exist solely within the backend server environment.

---

## 2. Relational Schema & Table Verification

Verify that all six core relational tables exist with correct foreign key constraints, default timestamps, and data types:

| Table Name | Primary Purpose | Foreign Key References | Cascade Deletion Constraints |
| :--- | :--- | :--- | :--- |
| `roles` | System authorization roles (`ADMIN`, `TEACHER`, `EXAM_COORDINATOR`) | None | Restrict deletion |
| `users` | User credentials, role assignments, and active status | `role_id -> roles(id)` | Restrict deletion |
| `question_papers` | Metadata, encryption parameters, signature, and scheduling | `created_by -> users(id)`<br>`assigned_teacher_id -> users(id)` | Restrict deletion |
| `answer_keys` | Metadata, encrypted symmetric keys, and exam date window | `question_paper_id -> question_papers(id)`<br>`uploaded_by -> users(id)` | Cascaded deletion on paper removal |
| `notifications` | Delivery alerts and in-app event notifications | `recipient_id -> users(id)`<br>`question_paper_id -> question_papers(id)` | Cascaded deletion |
| `audit_logs` | Immutable audit trail for security-critical operations | `user_id -> users(id)` | Retain logs on user deactivation |

---

## 3. Row Level Security (RLS) & Least-Privilege Access

Supabase PostgreSQL enables Row Level Security (RLS) at the table layer.

### 3.1 RLS Status Checklist

Verify that RLS is explicitly enabled on every table in the production database:

```sql
-- Production Verification Query
SELECT 
    schemaname, 
    tablename, 
    rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

- [ ] `roles`: `rowsecurity = true`
- [ ] `users`: `rowsecurity = true`
- [ ] `question_papers`: `rowsecurity = true`
- [ ] `answer_keys`: `rowsecurity = true`
- [ ] `notifications`: `rowsecurity = true`
- [ ] `audit_logs`: `rowsecurity = true`

### 3.2 Key Role & Privilege Segregation

1. **Backend Service-Role (`SUPABASE_SERVICE_ROLE_KEY`):**
   - Used exclusively by the Express backend (`Backend/src/config/supabase.js`).
   - Bypasses RLS to execute authoritative business logic, cryptographic verification, and audit logging.
   - Must be treated as a root database secret.

2. **Public / Anon Key (`SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY`):**
   - The frontend communicates **exclusively** with the Express backend API (`/api/*`).
   - The frontend does **NOT** query Supabase directly via the Supabase JS client.
   - Public anon access to tables via PostgREST is blocked by default RLS policies denying unauthenticated anon queries.

3. **Audit Log Immutability:**
   - Audit logs must be append-only.
   - `UPDATE` and `DELETE` operations on `audit_logs` are rejected by database triggers / RLS policies.

---

## 4. Private Storage Bucket Hardening (`examguard-storage`)

ExamGuard stores AES-256-GCM encrypted PDF blobs in Supabase Storage.

### 4.1 Bucket Security Checklist

- [ ] **Privacy Setting:** Bucket `examguard-storage` **must be private** (`public = false`). Direct anonymous public URL downloads must return HTTP 403 / 404.
- [ ] **Access Method:** All uploads and downloads must transit through the Express backend streaming proxy (`/api/question-papers/download/:id` and `/api/teacher/question-papers/:id/answer-key/download`).
- [ ] **MIME Type Restriction:** Allowed MIME types restricted to:
  - `application/pdf`
  - `application/octet-stream` (for raw encrypted ciphertext chunks)
- [ ] **Maximum File Size Limit:** Set bucket-level max object size to `10485760` bytes (10 MB) to match `MAX_QUESTION_PAPER_SIZE_MB`.
- [ ] **Folder Structure Organization:**
  - `question-papers/{paperId}_{timestamp}.enc`
  - `answer-keys/{keyId}_{timestamp}.enc`

### 4.2 Storage Policy Verification

Run the following storage verification query in the Supabase SQL editor:

```sql
SELECT 
    id, 
    name, 
    public, 
    file_size_limit, 
    allowed_mime_types 
FROM storage.buckets 
WHERE id = 'examguard-storage';
```

Expected output:
- `public`: `false`
- `file_size_limit`: `10485760`
- `allowed_mime_types`: `{"application/pdf","application/octet-stream"}`

---

## 5. Production Performance Indexing

To maintain fast query response times under production load, verify that indexes exist for foreign keys, lookups, and chronological sorting:

```sql
-- Recommended Production Index Set
CREATE INDEX IF NOT EXISTS idx_users_email ON users(lower(email));
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_question_papers_created_by ON question_papers(created_by);
CREATE INDEX IF NOT EXISTS idx_question_papers_assigned_teacher_id ON question_papers(assigned_teacher_id);
CREATE INDEX IF NOT EXISTS idx_question_papers_delivery_date ON question_papers(scheduled_delivery_date);
CREATE INDEX IF NOT EXISTS idx_question_papers_created_at ON question_papers(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_answer_keys_question_paper_id ON answer_keys(question_paper_id);
CREATE INDEX IF NOT EXISTS idx_answer_keys_uploaded_by ON answer_keys(uploaded_by);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
```

---

## 6. Backup, Retention & Disaster Recovery Procedures

### 6.1 Automated Point-in-Time Recovery (PITR)
- Supabase Pro/Team projects provide daily automated backups and continuous write-ahead log (WAL) archiving for 7–30 days.
- Ensure PITR is enabled in the Supabase Dashboard under **Project Settings > Backups**.

### 6.2 Manual Baseline Snapshot (`pg_dump`)
Prior to applying major migrations or release packaging, export a compressed schema-and-data dump:

```bash
# Export compressed PostgreSQL database dump
pg_dump \
  --host=db.[YOUR-PROJECT-REF].supabase.co \
  --port=5432 \
  --username=postgres \
  --format=custom \
  --file=examguard_backup_$(date +%Y%m%d_%H%M%S).dump \
  postgres
```

### 6.3 Restoration Verification
Verify restore procedure in an isolated staging project:

```bash
# Restore baseline into staging instance
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --host=db.[STAGING-PROJECT-REF].supabase.co \
  --port=5432 \
  --username=postgres \
  --dbname=postgres \
  examguard_backup_20261015.dump
```

---

## 7. Sign-off Checklist

| Verification Item | Requirement | Verified By | Date |
| :--- | :--- | :--- | :--- |
| All 6 core tables exist | Schema version matches `database/schema.sql` | SecOps | 2026-10-15 |
| RLS enabled on all tables | Zero public read/write without auth | SecOps | 2026-10-15 |
| `examguard-storage` bucket private | Direct anonymous download returns 403/404 | DevOps | 2026-10-15 |
| Query indexes active | All lookup & foreign key indexes created | DBA | 2026-10-15 |
| Automated backups enabled | PITR or daily snapshots active | Infrastructure | 2026-10-15 |

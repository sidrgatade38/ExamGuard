-- ============================================================================
-- ExamGuard - Module 25: Consolidated Sprint Migration
-- Secure Examination Question Paper Management System
-- Database Engine: Supabase PostgreSQL (PostgreSQL 15+)
-- File: database/module_25_consolidated_sprint_migration.sql
-- ============================================================================
-- PURPOSE:
-- 1. Soft-delete and archival columns for users (safe deletion preserving papers & audit).
-- 2. Complete teacher profile attributes (qualification, specialization, experience, mobile).
-- 3. Exact exam scheduling: exam_time, finalized_at, coordinator timestamps, 1-hour release gating.
-- 4. Shared A/B question pool attributes: source_set, author_name, subquestions, image_url.
-- 5. Email notification delivery tracking with Resend (channel, resend_email_id, status).
-- 6. Canonical paper titles and academic patterns seed data.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. USER ACCOUNT MANAGEMENT (SAFE DELETION & ARCHIVAL)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_deleted') THEN
        ALTER TABLE users ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'deleted_at') THEN
        ALTER TABLE users ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'deleted_by') THEN
        ALTER TABLE users ADD COLUMN deleted_by UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'phone') THEN
        ALTER TABLE users ADD COLUMN phone VARCHAR(20);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================================================
-- 2. TEACHER PROFILES (COMPLETE & PERSISTENT INFORMATION)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_profiles' AND column_name = 'qualification') THEN
        ALTER TABLE teacher_profiles ADD COLUMN qualification VARCHAR(100) DEFAULT 'M.E. (Computer Engineering)';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_profiles' AND column_name = 'specialization') THEN
        ALTER TABLE teacher_profiles ADD COLUMN specialization VARCHAR(255) DEFAULT 'Computer Engineering & System Architecture';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_profiles' AND column_name = 'experience_years') THEN
        ALTER TABLE teacher_profiles ADD COLUMN experience_years NUMERIC(4,1) DEFAULT 5.0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_profiles' AND column_name = 'mobile_number') THEN
        ALTER TABLE teacher_profiles ADD COLUMN mobile_number VARCHAR(20);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teacher_profiles' AND column_name = 'profile_photo_url') THEN
        ALTER TABLE teacher_profiles ADD COLUMN profile_photo_url TEXT;
    END IF;
END $$;

-- Synchronize phone and mobile_number where appropriate
UPDATE teacher_profiles 
SET mobile_number = phone 
WHERE mobile_number IS NULL AND phone IS NOT NULL;

UPDATE teacher_profiles 
SET phone = mobile_number 
WHERE phone IS NULL AND mobile_number IS NOT NULL;

-- ============================================================================
-- 3. QUESTION PAPERS & SCHEDULING (EXAM TIME & 1-HOUR RELEASE GATING)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_papers' AND column_name = 'exam_time') THEN
        ALTER TABLE question_papers ADD COLUMN exam_time TIME DEFAULT '10:00:00';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_papers' AND column_name = 'finalized_at') THEN
        ALTER TABLE question_papers ADD COLUMN finalized_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_papers' AND column_name = 'coordinator_notified_at') THEN
        ALTER TABLE question_papers ADD COLUMN coordinator_notified_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_papers' AND column_name = 'coordinator_available_at') THEN
        ALTER TABLE question_papers ADD COLUMN coordinator_available_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_papers' AND column_name = 'is_archived_by_coordinator') THEN
        ALTER TABLE question_papers ADD COLUMN is_archived_by_coordinator BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_papers' AND column_name = 'is_deleted') THEN
        ALTER TABLE question_papers ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Populate finalized_at for existing submitted papers
UPDATE question_papers 
SET finalized_at = COALESCE(submitted_at, created_at),
    coordinator_available_at = COALESCE(submitted_at, created_at)
WHERE status IN ('SUBMITTED', 'ENCRYPTED', 'SIGNED', 'SCHEDULED', 'DELIVERED') AND finalized_at IS NULL;

-- ============================================================================
-- 4. QUESTION PAPER ASSIGNMENTS (COORDINATOR REMOVE & ARCHIVAL)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_paper_assignments' AND column_name = 'is_archived') THEN
        ALTER TABLE question_paper_assignments ADD COLUMN is_archived BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_paper_assignments' AND column_name = 'is_deleted_by_coordinator') THEN
        ALTER TABLE question_paper_assignments ADD COLUMN is_deleted_by_coordinator BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_paper_assignments' AND column_name = 'exam_date') THEN
        ALTER TABLE question_paper_assignments ADD COLUMN exam_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_paper_assignments' AND column_name = 'exam_time') THEN
        ALTER TABLE question_paper_assignments ADD COLUMN exam_time TIME DEFAULT '10:00:00';
    END IF;
END $$;

-- Sync assignment exam dates with papers
UPDATE question_paper_assignments a
SET exam_date = q.exam_date,
    exam_time = COALESCE(q.exam_time, '10:00:00'::TIME)
FROM question_papers q
WHERE a.question_paper_id = q.id AND a.exam_date IS NULL;

-- ============================================================================
-- 5. QUESTION BANK & A/B SHARED POOL (SOURCE SET & TRACEABILITY)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_bank' AND column_name = 'source_set') THEN
        ALTER TABLE question_bank ADD COLUMN source_set VARCHAR(50) DEFAULT 'SET_A';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_bank' AND column_name = 'author_name') THEN
        ALTER TABLE question_bank ADD COLUMN author_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_bank' AND column_name = 'image_url') THEN
        ALTER TABLE question_bank ADD COLUMN image_url TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_bank' AND column_name = 'subquestions') THEN
        ALTER TABLE question_bank ADD COLUMN subquestions JSONB DEFAULT '[]'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_bank' AND column_name = 'pattern_year') THEN
        ALTER TABLE question_bank ADD COLUMN pattern_year VARCHAR(20) DEFAULT '2019';
    END IF;
END $$;

-- Update author_name in question_bank from users
UPDATE question_bank q
SET author_name = u.name
FROM users u
WHERE q.author_id = u.id AND q.author_name IS NULL;

-- ============================================================================
-- 6. NOTIFICATIONS (RESEND EMAIL DELIVERY TRACKING)
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'resend_email_id') THEN
        ALTER TABLE notifications ADD COLUMN resend_email_id VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'recipient_email') THEN
        ALTER TABLE notifications ADD COLUMN recipient_email VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'recipient_name') THEN
        ALTER TABLE notifications ADD COLUMN recipient_name VARCHAR(255);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'delivery_attempts') THEN
        ALTER TABLE notifications ADD COLUMN delivery_attempts INT DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'last_attempt_at') THEN
        ALTER TABLE notifications ADD COLUMN last_attempt_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'metadata') THEN
        ALTER TABLE notifications ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Relax notifications check constraints if needed to permit email-based event types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_type;
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_type_sprint CHECK (
    type IN (
        'ACCOUNT_CREATED',
        'TEACHER_REGISTERED',
        'ACCOUNT_ACTIVATED',
        'ACCOUNT_DEACTIVATED',
        'ACCOUNT_DELETED',
        'PROFILE_UPDATED',
        'QUESTION_PAPER_DRAFT_SAVED',
        'QUESTION_PAPER_CREATED',
        'QUESTION_PAPER_SUBMITTED',
        'QUESTION_PAPER_SCHEDULED',
        'QUESTION_PAPER_DELIVERED',
        'QUESTION_PAPER_FINALIZED',
        'SET_FINALIZED',
        'COORDINATOR_ASSIGNED',
        'COORDINATOR_NOTIFIED',
        'VERIFICATION_APPROVED',
        'VERIFICATION_REJECTED',
        'RETURN_FOR_REVISION',
        'REVISION_RESUBMITTED',
        'EXAM_SCHEDULED',
        'EXAM_SCHEDULE_CHANGED',
        'SECURE_PAPER_RELEASED',
        'ADMIN_CHANGE',
        'ANSWER_KEY_AVAILABLE',
        'SYSTEM'
    )
);

-- ============================================================================
-- 7. CANONICAL ACADEMIC CONFIGURATION (PAPER TITLES & ACADEMIC PATTERNS)
-- ============================================================================
CREATE TABLE IF NOT EXISTS academic_paper_titles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Canonical Exam Titles: Open Book Test, CCE Exam, End Sem Exam
INSERT INTO academic_paper_titles (code, title, is_active)
VALUES 
    ('OBT', 'Open Book Test', TRUE),
    ('CCE', 'CCE Exam', TRUE),
    ('END_SEM', 'End Sem Exam', TRUE)
ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, is_active = TRUE;

-- Canonical Academic Patterns: 2019, 2024, 2025
INSERT INTO academic_patterns (code, name, revision_year, is_active)
VALUES 
    ('PAT_2019', '2019', 2019, TRUE),
    ('PAT_2024', '2024', 2024, TRUE),
    ('PAT_2025', '2025', 2025, TRUE)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = TRUE;

-- Update pattern names to canonical numbers if prefixed
UPDATE academic_patterns SET name = '2019' WHERE code = 'PAT_2019' OR name = '2019 Pattern';
UPDATE academic_patterns SET name = '2024' WHERE code = 'PAT_2024' OR name = '2024 Pattern';
UPDATE academic_patterns SET name = '2025' WHERE code = 'PAT_2025' OR name = '2025 Pattern';

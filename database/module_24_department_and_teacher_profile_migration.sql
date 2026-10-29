-- ============================================================================
-- ExamGuard - Module 24: Strict Computer Engineering Department Restriction,
-- Teacher Profile Management & Verification History Migration
-- Database Engine: Supabase PostgreSQL (PostgreSQL 15+)
-- File: database/module_24_department_and_teacher_profile_migration.sql
-- ============================================================================
--
-- PURPOSE:
-- 1. Strictly restrict the entire ExamGuard academic hierarchy to the
--    "Department of Computer Engineering" (COMP).
-- 2. Deactivate any non-Computer Engineering department, course, or subject records.
-- 3. Establish the teacher_profiles table for independent faculty profiles,
--    linking authentication users with faculty IDs, designations, and COMP department.
-- 4. Automatically populate teacher_profiles for all existing TEACHER accounts.
-- 5. Add department column with check constraint to question_papers if missing.
-- 6. Establish the paper_verifications table for traceable, immutable verification history.
-- 7. Add performance indexes and row-level security (RLS) policies.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. STRICT COMPUTER ENGINEERING RESTRICTION ON ACADEMIC MASTER
-- ============================================================================

-- Ensure Department of Computer Engineering exists
INSERT INTO academic_institutions (code, name, is_active)
VALUES ('ENGG_COLL', 'Pune Institute of Computer Technology (SPPU Affiliated)', TRUE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO academic_departments (institution_id, code, name, is_active)
SELECT id, 'COMP', 'Department of Computer Engineering', TRUE 
FROM academic_institutions WHERE code = 'ENGG_COLL'
ON CONFLICT (code) DO UPDATE SET is_active = TRUE, name = 'Department of Computer Engineering';

-- Deactivate all departments other than Computer Engineering
UPDATE academic_departments 
SET is_active = FALSE 
WHERE code != 'COMP';

-- Ensure Computer Engineering courses exist and are active
INSERT INTO academic_courses (department_id, code, name, degree, duration_years, is_active)
SELECT id, 'TE_COMP', 'T.E. (Computer Engineering)', 'B.E.', 4, TRUE 
FROM academic_departments WHERE code = 'COMP'
ON CONFLICT (code) DO UPDATE SET is_active = TRUE;

INSERT INTO academic_courses (department_id, code, name, degree, duration_years, is_active)
SELECT id, 'BE_COMP', 'B.E. (Computer Engineering)', 'B.E.', 4, TRUE 
FROM academic_departments WHERE code = 'COMP'
ON CONFLICT (code) DO UPDATE SET is_active = TRUE;

-- Deactivate non-Computer Engineering courses
UPDATE academic_courses
SET is_active = FALSE
WHERE department_id NOT IN (SELECT id FROM academic_departments WHERE code = 'COMP');

-- Deactivate non-Computer Engineering subjects
UPDATE academic_subjects
SET is_active = FALSE
WHERE department_id NOT IN (SELECT id FROM academic_departments WHERE code = 'COMP');

-- ============================================================================
-- 2. TEACHER PROFILES TABLE (INDEPENDENT TEACHER ACCOUNTS & WORKSPACES)
-- ============================================================================

CREATE TABLE IF NOT EXISTS teacher_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    faculty_id VARCHAR(50) NOT NULL UNIQUE,
    department VARCHAR(100) NOT NULL DEFAULT 'Department of Computer Engineering'
        CONSTRAINT chk_teacher_profiles_dept CHECK (
            department IN ('Department of Computer Engineering', 'Computer Engineering')
        ),
    designation VARCHAR(100) NOT NULL DEFAULT 'Assistant Professor',
    specialization VARCHAR(255) DEFAULT 'Computer Engineering & System Architecture',
    phone VARCHAR(20),
    is_profile_complete BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_profiles_user_id ON teacher_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_profiles_faculty_id ON teacher_profiles(faculty_id);

-- Auto-provision teacher profiles for all existing users with TEACHER role
INSERT INTO teacher_profiles (user_id, faculty_id, department, designation, specialization, is_profile_complete)
SELECT 
    u.id,
    'COMP-FAC-' || UPPER(SUBSTRING(REPLACE(u.id::text, '-', '') FROM 1 FOR 6)),
    'Department of Computer Engineering',
    'Assistant Professor',
    'Computer Engineering & Distributed Systems',
    TRUE
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE r.name = 'TEACHER'
ON CONFLICT (user_id) DO NOTHING;

-- Trigger to maintain updated_at on teacher_profiles
DROP TRIGGER IF EXISTS trg_teacher_profiles_updated_at ON teacher_profiles;
CREATE TRIGGER trg_teacher_profiles_updated_at
    BEFORE UPDATE ON teacher_profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 3. STRICT DEPARTMENT ENFORCEMENT ON QUESTION PAPERS
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_papers' AND column_name = 'department'
    ) THEN
        ALTER TABLE question_papers ADD COLUMN department VARCHAR(100) NOT NULL DEFAULT 'Department of Computer Engineering';
        COMMENT ON COLUMN question_papers.department IS 'Academic department, strictly Department of Computer Engineering';
    END IF;
END $$;

-- Update any existing question papers to Department of Computer Engineering
UPDATE question_papers 
SET department = 'Department of Computer Engineering'
WHERE department IS NULL OR department != 'Department of Computer Engineering';

-- Ensure draft papers also default to Department of Computer Engineering
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables WHERE table_name = 'exam_paper_drafts'
    ) THEN
        UPDATE exam_paper_drafts 
        SET department = 'Department of Computer Engineering'
        WHERE department IS NULL OR department != 'Department of Computer Engineering';
    END IF;
END $$;

-- ============================================================================
-- 4. TRACEABLE VERIFICATION HISTORY TABLE (MODULE 5)
-- ============================================================================

CREATE TABLE IF NOT EXISTS paper_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_paper_id UUID NOT NULL REFERENCES question_papers(id) ON DELETE CASCADE,
    verifier_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    previous_status VARCHAR(50) NOT NULL,
    new_status VARCHAR(50) NOT NULL,
    decision VARCHAR(50) NOT NULL,
    comments TEXT,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_paper_verifications_paper_id ON paper_verifications(question_paper_id);
CREATE INDEX IF NOT EXISTS idx_paper_verifications_verifier_id ON paper_verifications(verifier_id);
CREATE INDEX IF NOT EXISTS idx_paper_verifications_verified_at ON paper_verifications(verified_at DESC);

-- Populate paper_verifications from any historical review decisions in question_papers
INSERT INTO paper_verifications (question_paper_id, verifier_id, previous_status, new_status, decision, comments, verified_at)
SELECT 
    id,
    reviewer_id,
    'SUBMITTED',
    review_status,
    review_status,
    review_comments,
    COALESCE(reviewed_at, updated_at, NOW())
FROM question_papers
WHERE reviewer_id IS NOT NULL AND review_status IS NOT NULL
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. ROW-LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE teacher_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_teacher_profiles_select ON teacher_profiles;
CREATE POLICY p_teacher_profiles_select ON teacher_profiles
    FOR SELECT
    USING (user_id = auth.uid() OR auth.jwt() ->> 'role' IN ('ADMIN', 'EXAM_COORDINATOR'));

DROP POLICY IF EXISTS p_teacher_profiles_update ON teacher_profiles;
CREATE POLICY p_teacher_profiles_update ON teacher_profiles
    FOR UPDATE
    USING (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'ADMIN')
    WITH CHECK (user_id = auth.uid() OR auth.jwt() ->> 'role' = 'ADMIN');

ALTER TABLE paper_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS p_paper_verifications_select ON paper_verifications;
CREATE POLICY p_paper_verifications_select ON paper_verifications
    FOR SELECT
    USING (TRUE);

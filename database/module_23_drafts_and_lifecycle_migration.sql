-- ============================================================================
-- ExamGuard - Module 23: Exam Paper Drafts & Multi-Day Persistence Migration
-- Database Engine: Supabase PostgreSQL (PostgreSQL 15+)
-- File: database/module_23_drafts_and_lifecycle_migration.sql
-- ============================================================================
--
-- This migration creates:
--   1. exam_paper_drafts (Multi-day draft persistence for Question Paper Wizard)
--   2. Performance indexes on teacher_id and updated_at
--   3. Row-Level Security (RLS) policies enforcing teacher data isolation
--   4. Trigger to maintain updated_at timestamps automatically
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Create exam_paper_drafts table
CREATE TABLE IF NOT EXISTS exam_paper_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    subject_code VARCHAR(50),
    course VARCHAR(255) NOT NULL DEFAULT 'Computer Engineering',
    department VARCHAR(255) NOT NULL DEFAULT 'Department of Computer Engineering',
    class_year VARCHAR(20) NOT NULL DEFAULT 'TE' CHECK (class_year IN ('FE', 'SE', 'TE', 'BE', 'ME')),
    academic_pattern VARCHAR(50) NOT NULL DEFAULT '2019 Pattern',
    semester VARCHAR(50) NOT NULL DEFAULT 'Semester 5',
    duration_hours NUMERIC(3, 1) NOT NULL DEFAULT 2.5,
    total_marks INT NOT NULL DEFAULT 70 CHECK (total_marks IN (20, 30, 60, 70, 80, 100)),
    step INT NOT NULL DEFAULT 1 CHECK (step >= 1 AND step <= 5),
    blueprint_id UUID REFERENCES exam_blueprints(id) ON DELETE SET NULL,
    form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    sections JSONB NOT NULL DEFAULT '[]'::jsonb,
    generated_sets JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'GENERATED', 'SUBMITTED', 'ARCHIVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- 2. Indexes for fast lookup and owner-isolated queries
CREATE INDEX IF NOT EXISTS idx_exam_paper_drafts_teacher_id ON exam_paper_drafts(teacher_id);
CREATE INDEX IF NOT EXISTS idx_exam_paper_drafts_status ON exam_paper_drafts(status);
CREATE INDEX IF NOT EXISTS idx_exam_paper_drafts_updated_at ON exam_paper_drafts(updated_at DESC);

-- 3. Row-Level Security (RLS)
ALTER TABLE exam_paper_drafts ENABLE ROW LEVEL SECURITY;

-- Allow teachers to read only their own drafts
DROP POLICY IF EXISTS p_exam_paper_drafts_select ON exam_paper_drafts;
CREATE POLICY p_exam_paper_drafts_select ON exam_paper_drafts
    FOR SELECT
    USING (teacher_id = auth.uid() OR auth.jwt() ->> 'role' = 'ADMIN');

-- Allow teachers to insert their own drafts
DROP POLICY IF EXISTS p_exam_paper_drafts_insert ON exam_paper_drafts;
CREATE POLICY p_exam_paper_drafts_insert ON exam_paper_drafts
    FOR INSERT
    WITH CHECK (teacher_id = auth.uid());

-- Allow teachers to update only their own drafts
DROP POLICY IF EXISTS p_exam_paper_drafts_update ON exam_paper_drafts;
CREATE POLICY p_exam_paper_drafts_update ON exam_paper_drafts
    FOR UPDATE
    USING (teacher_id = auth.uid() OR auth.jwt() ->> 'role' = 'ADMIN')
    WITH CHECK (teacher_id = auth.uid() OR auth.jwt() ->> 'role' = 'ADMIN');

-- Allow teachers to delete only their own drafts
DROP POLICY IF EXISTS p_exam_paper_drafts_delete ON exam_paper_drafts;
CREATE POLICY p_exam_paper_drafts_delete ON exam_paper_drafts
    FOR DELETE
    USING (teacher_id = auth.uid() OR auth.jwt() ->> 'role' = 'ADMIN');

-- 4. Automatic updated_at timestamp trigger
CREATE OR REPLACE FUNCTION update_exam_paper_drafts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_exam_paper_drafts_updated_at ON exam_paper_drafts;
CREATE TRIGGER trg_exam_paper_drafts_updated_at
    BEFORE UPDATE ON exam_paper_drafts
    FOR EACH ROW
    EXECUTE FUNCTION update_exam_paper_drafts_timestamp();

-- ============================================================================
-- DOWN MIGRATION (ROLLBACK INSTRUCTIONS)
-- ============================================================================
-- DROP TRIGGER IF EXISTS trg_exam_paper_drafts_updated_at ON exam_paper_drafts;
-- DROP FUNCTION IF EXISTS update_exam_paper_drafts_timestamp();
-- DROP TABLE IF EXISTS exam_paper_drafts;

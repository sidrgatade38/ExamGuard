-- ============================================================================
-- ExamGuard - Module 18: Question Bank, Blueprint & Paper Generator Migration
-- Database Engine: Supabase PostgreSQL (PostgreSQL 15+)
-- File: database/module_18_question_bank_and_generator_migration.sql
-- ============================================================================
-- IMPORTANT NOTICE:
-- As per ExamGuard project security guidelines, this migration file is provided
-- for manual review and execution by the database administrator in the Supabase
-- SQL Editor. Do NOT execute automatically via untrusted scripts.
--
-- This migration creates:
--   1. question_bank (Reusable, categorized questions with approval status)
--   2. exam_blueprints (Standardized curriculum exam structure specifications)
--   3. exam_blueprint_sections (Numbered question groups with university OR pairs)
--   4. generated_exam_papers (Audit log of generation runs & reproducible seeds)
--   5. generated_exam_sets (Immutable snapshots of generated exam papers & sets)
--   6. Updated_at triggers and performance indexes
-- ============================================================================

-- Ensure pgcrypto is enabled for UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. QUESTION BANK TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS question_bank (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    subject VARCHAR(255) NOT NULL,
    course VARCHAR(255) NOT NULL DEFAULT 'Computer Engineering',
    semester VARCHAR(50) NOT NULL DEFAULT 'Semester 5',
    academic_pattern VARCHAR(50) NOT NULL DEFAULT '2019 Pattern',
    exam_type VARCHAR(50) NOT NULL DEFAULT 'End Semester Examination',
    unit_number INT NOT NULL CHECK (unit_number >= 1 AND unit_number <= 10),
    unit_title VARCHAR(255) NOT NULL,
    topic VARCHAR(255),
    question_text TEXT NOT NULL,
    question_type VARCHAR(50) NOT NULL DEFAULT 'DESCRIPTIVE'
        CONSTRAINT chk_question_bank_type CHECK (
            question_type IN ('DESCRIPTIVE', 'SHORT_ANSWER', 'NUMERICAL', 'MCQ', 'DIAGRAMMATIC')
        ),
    marks INT NOT NULL CHECK (marks > 0 AND marks <= 100),
    difficulty VARCHAR(20) NOT NULL DEFAULT 'MEDIUM'
        CONSTRAINT chk_question_bank_difficulty CHECK (
            difficulty IN ('EASY', 'MEDIUM', 'HARD')
        ),
    answer_scheme TEXT,
    approval_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED'
        CONSTRAINT chk_question_bank_approval CHECK (
            approval_status IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED')
        ),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. EXAM BLUEPRINTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS exam_blueprints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    course VARCHAR(255) NOT NULL DEFAULT 'Computer Engineering',
    semester VARCHAR(50) NOT NULL DEFAULT 'Semester 5',
    academic_pattern VARCHAR(50) NOT NULL DEFAULT '2019 Pattern',
    subject_code VARCHAR(50),
    duration_hours NUMERIC(3,1) NOT NULL DEFAULT 2.5,
    total_marks INT NOT NULL DEFAULT 70,
    instructions TEXT[] NOT NULL DEFAULT ARRAY[
        'Answer Q1 or Q2, Q3 or Q4, Q5 or Q6, Q7 or Q8.',
        'Neat diagrams must be drawn wherever necessary.',
        'Figures to the right indicate full marks.',
        'Assume suitable data if necessary.'
    ]::TEXT[],
    num_sets INT NOT NULL DEFAULT 2 CHECK (num_sets >= 1 AND num_sets <= 5),
    max_overlap_percentage INT NOT NULL DEFAULT 40 CHECK (max_overlap_percentage >= 0 AND max_overlap_percentage <= 100),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
        CONSTRAINT chk_exam_blueprints_status CHECK (
            status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')
        ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. EXAM BLUEPRINT SECTIONS TABLE (QUESTION GROUPS & OR ALTERNATIVES)
-- ============================================================================

CREATE TABLE IF NOT EXISTS exam_blueprint_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES exam_blueprints(id) ON DELETE CASCADE,
    group_order INT NOT NULL,
    group_label VARCHAR(100) NOT NULL,
    primary_question_number INT NOT NULL,
    alternative_question_number INT,
    target_marks INT NOT NULL,
    target_unit INT NOT NULL,
    subquestions_config JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. GENERATED EXAM PAPERS TABLE (GENERATION AUDIT & RUNS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS generated_exam_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blueprint_id UUID NOT NULL REFERENCES exam_blueprints(id) ON DELETE RESTRICT,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    generation_seed VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'GENERATED'
        CONSTRAINT chk_generated_papers_status CHECK (
            status IN ('GENERATED', 'APPROVED', 'SUBMITTED', 'REJECTED')
        ),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. GENERATED EXAM SETS TABLE (IMMUTABLE SNAPSHOTS & STORED SELECTIONS)
-- ============================================================================

CREATE TABLE IF NOT EXISTS generated_exam_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generated_exam_paper_id UUID NOT NULL REFERENCES generated_exam_papers(id) ON DELETE CASCADE,
    set_code VARCHAR(10) NOT NULL,
    set_order INT NOT NULL,
    paper_structure_snapshot JSONB NOT NULL,
    total_marks INT NOT NULL,
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    question_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. UPDATED_AT TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_question_bank_updated_at ON question_bank;
CREATE TRIGGER trg_question_bank_updated_at
    BEFORE UPDATE ON question_bank
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_exam_blueprints_updated_at ON exam_blueprints;
CREATE TRIGGER trg_exam_blueprints_updated_at
    BEFORE UPDATE ON exam_blueprints
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_generated_exam_papers_updated_at ON generated_exam_papers;
CREATE TRIGGER trg_generated_exam_papers_updated_at
    BEFORE UPDATE ON generated_exam_papers
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- 7. PERFORMANCE INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_question_bank_author_id ON question_bank(author_id);
CREATE INDEX IF NOT EXISTS idx_question_bank_query ON question_bank(subject, semester, unit_number, is_active, approval_status);
CREATE INDEX IF NOT EXISTS idx_question_bank_difficulty ON question_bank(difficulty);
CREATE INDEX IF NOT EXISTS idx_question_bank_marks ON question_bank(marks);

CREATE INDEX IF NOT EXISTS idx_exam_blueprints_author ON exam_blueprints(author_id);
CREATE INDEX IF NOT EXISTS idx_exam_blueprints_subject ON exam_blueprints(subject, semester);

CREATE INDEX IF NOT EXISTS idx_exam_blueprint_sections_bp ON exam_blueprint_sections(blueprint_id, group_order);

CREATE INDEX IF NOT EXISTS idx_generated_exam_papers_teacher ON generated_exam_papers(teacher_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_generated_exam_papers_bp ON generated_exam_papers(blueprint_id);

CREATE INDEX IF NOT EXISTS idx_generated_exam_sets_paper ON generated_exam_sets(generated_exam_paper_id, set_order);

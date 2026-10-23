-- ============================================================================
-- ExamGuard - Module 20: Question Paper Deletion & Archival Migration
-- Database Engine: Supabase PostgreSQL (PostgreSQL 15+)
-- File: database/module_20_question_paper_deletion_migration.sql
-- ============================================================================
-- IMPORTANT NOTICE:
-- As per ExamGuard project critical rules (Rule 5):
-- "Do not execute SQL against the live Supabase database.
--  Create migration SQL files for me to review and execute manually."
--
-- This script adds deletion and archival tracking columns to the question_papers
-- table, updates check constraints safely, adds indexes for query performance,
-- and preserves foreign key referential integrity with child tables.
-- ============================================================================

-- 1. Add deleted_at timestamp column (if not present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_papers' AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE question_papers ADD COLUMN deleted_at TIMESTAMPTZ;
        COMMENT ON COLUMN question_papers.deleted_at IS 'Timestamp when paper was soft-deleted/archived';
    END IF;
END $$;

-- 2. Add is_deleted boolean flag (if not present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_papers' AND column_name = 'is_deleted'
    ) THEN
        ALTER TABLE question_papers ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE;
        COMMENT ON COLUMN question_papers.is_deleted IS 'Soft-delete flag to filter out deleted papers from active queries';
    END IF;
END $$;

-- 3. Add deleted_by_user_id foreign key column (if not present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_papers' AND column_name = 'deleted_by_user_id'
    ) THEN
        ALTER TABLE question_papers ADD COLUMN deleted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
        COMMENT ON COLUMN question_papers.deleted_by_user_id IS 'User ID of authoring faculty who initiated deletion';
    END IF;
END $$;

-- 4. Add deletion_reason column (if not present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_papers' AND column_name = 'deletion_reason'
    ) THEN
        ALTER TABLE question_papers ADD COLUMN deletion_reason TEXT;
        COMMENT ON COLUMN question_papers.deletion_reason IS 'Faculty reason or audit note for deletion';
    END IF;
END $$;

-- 5. Update status check constraint on question_papers to explicitly include 'DELETED'
DO $$
BEGIN
    -- Drop existing constraint if it exists to allow recreation with DELETED
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'question_papers' AND constraint_name = 'chk_question_papers_status'
    ) THEN
        ALTER TABLE question_papers DROP CONSTRAINT chk_question_papers_status;
    END IF;

    ALTER TABLE question_papers ADD CONSTRAINT chk_question_papers_status
        CHECK (status IN ('DRAFT', 'SUBMITTED', 'ENCRYPTED', 'SIGNED', 'SCHEDULED', 'DELIVERED', 'ARCHIVED', 'DELETED'));
END $$;

-- 6. Create performance indexes for filtering active vs deleted papers
CREATE INDEX IF NOT EXISTS idx_question_papers_is_deleted
    ON question_papers(is_deleted)
    WHERE is_deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_question_papers_teacher_active
    ON question_papers(teacher_id, status)
    WHERE status NOT IN ('ARCHIVED', 'DELETED');

-- ============================================================================
-- VERIFICATION QUERY:
-- Run to confirm successful migration execution:
--
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'question_papers'
--   AND column_name IN ('is_deleted', 'deleted_at', 'deleted_by_user_id', 'deletion_reason');
-- ============================================================================

-- ============================================================================
-- ROLLBACK PROCEDURE:
-- If rollback is required:
--
-- ALTER TABLE question_papers DROP CONSTRAINT IF EXISTS chk_question_papers_status;
-- ALTER TABLE question_papers ADD CONSTRAINT chk_question_papers_status
--     CHECK (status IN ('DRAFT', 'SUBMITTED', 'ENCRYPTED', 'SIGNED', 'SCHEDULED', 'DELIVERED', 'ARCHIVED'));
-- DROP INDEX IF EXISTS idx_question_papers_is_deleted;
-- DROP INDEX IF EXISTS idx_question_papers_teacher_active;
-- ALTER TABLE question_papers DROP COLUMN IF EXISTS deletion_reason;
-- ALTER TABLE question_papers DROP COLUMN IF EXISTS deleted_by_user_id;
-- ALTER TABLE question_papers DROP COLUMN IF EXISTS is_deleted;
-- ALTER TABLE question_papers DROP COLUMN IF EXISTS deleted_at;
-- ============================================================================

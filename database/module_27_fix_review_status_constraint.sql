-- ============================================================================
-- MODULE 27: FIX QUESTION PAPERS STATUS CONSTRAINT & WORKFLOW ENUM
-- ============================================================================

DO $$
BEGIN
    -- Drop existing check constraint if it exists to allow full status flexibility
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'question_papers' AND constraint_name = 'chk_question_papers_status'
    ) THEN
        ALTER TABLE question_papers DROP CONSTRAINT chk_question_papers_status;
    END IF;

    -- Re-create constraint allowing both lifecycle and review states safely
    ALTER TABLE question_papers ADD CONSTRAINT chk_question_papers_status
        CHECK (status IN (
            'DRAFT', 'SUBMITTED', 'ENCRYPTED', 'SIGNED', 'SCHEDULED', 'DELIVERED', 
            'ARCHIVED', 'DELETED', 'APPROVED', 'NEEDS_REVISION', 'RETURNED', 'REJECTED'
        ));
END $$;

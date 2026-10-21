-- ============================================================================
-- ExamGuard - Module 13: Audit Logs & Security Activity Tracking Migration
-- Database Engine: Supabase PostgreSQL (PostgreSQL 15+)
-- File: database/module_13_audit_logs_migration.sql
-- ============================================================================
-- IMPORTANT NOTICE:
-- As per ExamGuard project security guidelines, this migration file is provided
-- for manual review and execution by the database administrator.
-- The ExamGuard application is designed to be fully backward-compatible with
-- the canonical schema in `database/schema.sql` by utilizing the `details` JSONB
-- column to store outcome, role, summary, and correlation attributes if these
-- dedicated columns are not yet present.
--
-- Running this migration enhances query performance with dedicated indexed
-- columns and expands the activity log action constraints.
-- ============================================================================

-- 1. Add dedicated columns for outcome, actor role, summary, and correlation ID (if not already present)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'activity_logs' AND column_name = 'outcome'
    ) THEN
        ALTER TABLE activity_logs ADD COLUMN outcome VARCHAR(20) DEFAULT 'SUCCESS';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'activity_logs' AND column_name = 'actor_role'
    ) THEN
        ALTER TABLE activity_logs ADD COLUMN actor_role VARCHAR(50);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'activity_logs' AND column_name = 'summary'
    ) THEN
        ALTER TABLE activity_logs ADD COLUMN summary TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'activity_logs' AND column_name = 'correlation_id'
    ) THEN
        ALTER TABLE activity_logs ADD COLUMN correlation_id VARCHAR(100);
    END IF;
END $$;

-- 2. Add check constraint for outcome (SUCCESS, FAILURE, DENIED)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage
        WHERE table_name = 'activity_logs' AND constraint_name = 'chk_activity_logs_outcome'
    ) THEN
        ALTER TABLE activity_logs ADD CONSTRAINT chk_activity_logs_outcome
            CHECK (outcome IN ('SUCCESS', 'FAILURE', 'DENIED'));
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 3. Update action check constraint to include all system event types
DO $$
BEGIN
    ALTER TABLE activity_logs DROP CONSTRAINT IF EXISTS chk_activity_logs_action;
    ALTER TABLE activity_logs ADD CONSTRAINT chk_activity_logs_action CHECK (
        action IN (
            'LOGIN',
            'LOGOUT',
            'QUESTION_PAPER_CREATED',
            'QUESTION_PAPER_SUBMITTED',
            'QUESTION_PAPER_ASSIGNED',
            'QUESTION_PAPER_SCHEDULED',
            'QUESTION_PAPER_DELIVERED',
            'QUESTION_PAPER_ACCESSED',
            'ANSWER_KEY_UPLOADED',
            'ANSWER_KEY_ACCESSED',
            'SIGNATURE_CREATED',
            'SIGNATURE_VERIFIED',
            'DECRYPTION_REQUESTED',
            'DOWNLOAD',
            'UNAUTHORIZED_ACCESS',
            'FAILED_LOGIN',
            'NOTIFICATION_READ',
            'NOTIFICATION_READ_ALL',
            'AUDIT_LOGS_ACCESSED'
        )
    );
END $$;

-- 4. Create performance indexes for common administrator audit filter queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_outcome ON activity_logs(outcome);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_role ON activity_logs(actor_role);
CREATE INDEX IF NOT EXISTS idx_activity_logs_correlation_id ON activity_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource_type ON activity_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_composite_filter ON activity_logs(created_at DESC, action, outcome);

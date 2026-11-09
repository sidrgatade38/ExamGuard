-- ============================================================================
-- ExamGuard - Module 26: Complete Resend Email Service Integration Migration
-- Department of Computer Engineering
-- ============================================================================
-- Adds delivery tracking fields, indices, and constraints for Resend webhook
-- lifecycle events (sent, delivered, bounced, complained, retried).
-- ============================================================================

DO $$
BEGIN
    -- 1. Resend Email Tracking Columns
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

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'delivered_at') THEN
        ALTER TABLE notifications ADD COLUMN delivered_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'bounced_at') THEN
        ALTER TABLE notifications ADD COLUMN bounced_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'metadata') THEN
        ALTER TABLE notifications ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Performance Index for Resend Webhook Lookups & Outbox Processing
CREATE INDEX IF NOT EXISTS idx_notifications_resend_id ON notifications (resend_email_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_email ON notifications (recipient_email);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications (status);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications (scheduled_at);

-- 3. Relax Type Constraints to Support All Institutional Email Events
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_type;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_type_sprint;

ALTER TABLE notifications ADD CONSTRAINT chk_notifications_type_complete CHECK (
    type IN (
        'ACCOUNT_CREATED',
        'TEACHER_REGISTERED',
        'ACCOUNT_ACTIVATED',
        'ACCOUNT_DEACTIVATED',
        'ACCOUNT_BLOCKED',
        'ACCOUNT_REACTIVATED',
        'ACCOUNT_DELETED',
        'ACCOUNT_ARCHIVED',
        'PASSWORD_RESET',
        'SECURITY_ALERT',
        'PROFILE_UPDATED',
        'MOBILE_NUMBER_CHANGED',
        'QUESTION_PAPER_CREATED',
        'QUESTION_PAPER_DRAFT_SAVED',
        'QUESTION_PAPER_SUBMITTED',
        'QUESTION_PAPER_SCHEDULED',
        'QUESTION_PAPER_DELIVERED',
        'QUESTION_PAPER_FINALIZED',
        'QUESTION_PAPER_DELETED',
        'SET_FINALIZED',
        'SETS_READY_FOR_POOL',
        'PAPER_GENERATION_SUCCESS',
        'PAPER_GENERATION_FAILED',
        'COORDINATOR_ASSIGNED',
        'COORDINATOR_NOTIFIED',
        'COORDINATOR_REVIEW_AVAILABLE',
        'VERIFICATION_APPROVED',
        'VERIFICATION_REJECTED',
        'RETURN_FOR_REVISION',
        'REVISION_RESUBMITTED',
        'EXAMINATION_SCHEDULED',
        'EXAMINATION_DATE_CHANGED',
        'EXAMINATION_TIME_CHANGED',
        'EXAMINATION_RESCHEDULED',
        'EXAMINATION_CANCELLED',
        'SECURE_RELEASE_AVAILABLE',
        'SYSTEM'
    )
);

-- 4. Status Constraints (PENDING, SENT, DELIVERED, FAILED, RETRY_PENDING, BOUNCED)
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS chk_notifications_status;
ALTER TABLE notifications ADD CONSTRAINT chk_notifications_status_complete CHECK (
    status IN (
        'PENDING',
        'SENT',
        'DELIVERED',
        'FAILED',
        'RETRY_PENDING',
        'BOUNCED',
        'READ',
        'UNREAD'
    )
);

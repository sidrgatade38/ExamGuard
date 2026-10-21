-- ============================================================================
-- ExamGuard - Canonical Database Schema
-- Database Engine: Supabase PostgreSQL (PostgreSQL 15+)
-- Module: Module 2 - Database Schema Design Only
-- ============================================================================
-- Organization:
--   1. Extensions
--   2. Roles
--   3. Users
--   4. Question Papers
--   5. Question Paper Assignments
--   6. Paper Keys
--   7. Answer Keys
--   8. Digital Signatures
--   9. Notifications
--  10. Activity Logs
--  11. Updated-at function
--  12. Updated-at triggers
--  13. Indexes
--  14. Role seed data
-- ============================================================================


-- ============================================================================
-- SECTION 1: EXTENSIONS
-- ============================================================================

-- Enable pgcrypto extension for cryptographic functions and UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================================
-- SECTION 2: ROLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION 3: USERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION 4: QUESTION PAPERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS question_papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    semester VARCHAR(50) NOT NULL,
    academic_year VARCHAR(50) NOT NULL,
    exam_type VARCHAR(50) NOT NULL,
    exam_date DATE NOT NULL,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT'
        CONSTRAINT chk_question_papers_status CHECK (
            status IN ('DRAFT', 'SUBMITTED', 'ENCRYPTED', 'SIGNED', 'SCHEDULED', 'DELIVERED', 'ARCHIVED')
        ),
    submitted_at TIMESTAMPTZ,
    scheduled_delivery_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION 5: QUESTION PAPER ASSIGNMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS question_paper_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_paper_id UUID NOT NULL REFERENCES question_papers(id) ON DELETE RESTRICT,
    assigned_to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scheduled_delivery_date DATE NOT NULL,
    delivered_at TIMESTAMPTZ,
    delivery_status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CONSTRAINT chk_paper_assignments_delivery_status CHECK (
            delivery_status IN ('PENDING', 'SCHEDULED', 'DELIVERED', 'FAILED', 'CANCELLED')
        ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION 6: PAPER KEYS
-- ============================================================================

CREATE TABLE IF NOT EXISTS paper_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_paper_id UUID NOT NULL UNIQUE REFERENCES question_papers(id) ON DELETE RESTRICT,
    encrypted_aes_key TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION 7: ANSWER KEYS
-- ============================================================================

CREATE TABLE IF NOT EXISTS answer_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_paper_id UUID NOT NULL UNIQUE REFERENCES question_papers(id) ON DELETE RESTRICT,
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    file_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    exam_date DATE NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CONSTRAINT chk_answer_keys_status CHECK (
            status IN ('PENDING', 'UPLOADED', 'ENCRYPTED', 'SIGNED', 'READY', 'ARCHIVED')
        ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION 8: DIGITAL SIGNATURES
-- ============================================================================

CREATE TABLE IF NOT EXISTS digital_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_paper_id UUID REFERENCES question_papers(id) ON DELETE RESTRICT,
    answer_key_id UUID REFERENCES answer_keys(id) ON DELETE RESTRICT,
    algorithm VARCHAR(50) NOT NULL DEFAULT 'RSA-PSS-SHA256',
    file_hash VARCHAR(64) NOT NULL,
    signature TEXT NOT NULL,
    public_key_reference TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_signature_target CHECK (
        (question_paper_id IS NOT NULL AND answer_key_id IS NULL) OR
        (question_paper_id IS NULL AND answer_key_id IS NOT NULL)
    )
);


-- ============================================================================
-- SECTION 9: NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    question_paper_id UUID REFERENCES question_papers(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL
        CONSTRAINT chk_notifications_type CHECK (
            type IN (
                'QUESTION_PAPER_SUBMITTED',
                'QUESTION_PAPER_SCHEDULED',
                'QUESTION_PAPER_DELIVERED',
                'ANSWER_KEY_AVAILABLE',
                'SYSTEM'
            )
        ),
    channel VARCHAR(20) NOT NULL DEFAULT 'EMAIL'
        CONSTRAINT chk_notifications_channel CHECK (
            channel IN ('EMAIL', 'IN_APP')
        ),
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CONSTRAINT chk_notifications_status CHECK (
            status IN ('PENDING', 'SENT', 'FAILED', 'READ')
        ),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION 10: ACTIVITY LOGS
-- ============================================================================

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL
        CONSTRAINT chk_activity_logs_action CHECK (
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
                'FAILED_LOGIN'
            )
        ),
    resource_type VARCHAR(50),
    resource_id VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================================
-- SECTION 11: UPDATED_AT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================================
-- SECTION 12: UPDATED_AT TRIGGERS
-- ============================================================================

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_question_papers_updated_at ON question_papers;
CREATE TRIGGER trg_question_papers_updated_at
    BEFORE UPDATE ON question_papers
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_question_paper_assignments_updated_at ON question_paper_assignments;
CREATE TRIGGER trg_question_paper_assignments_updated_at
    BEFORE UPDATE ON question_paper_assignments
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_paper_keys_updated_at ON paper_keys;
CREATE TRIGGER trg_paper_keys_updated_at
    BEFORE UPDATE ON paper_keys
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_answer_keys_updated_at ON answer_keys;
CREATE TRIGGER trg_answer_keys_updated_at
    BEFORE UPDATE ON answer_keys
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();


-- ============================================================================
-- SECTION 13: INDEXES
-- ============================================================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- Question papers table indexes
CREATE INDEX IF NOT EXISTS idx_question_papers_teacher_id ON question_papers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_question_papers_subject ON question_papers(subject);
CREATE INDEX IF NOT EXISTS idx_question_papers_exam_date ON question_papers(exam_date);
CREATE INDEX IF NOT EXISTS idx_question_papers_status ON question_papers(status);
CREATE INDEX IF NOT EXISTS idx_question_papers_scheduled_delivery_date ON question_papers(scheduled_delivery_date);

-- Question paper assignments table indexes
CREATE INDEX IF NOT EXISTS idx_assignments_question_paper_id ON question_paper_assignments(question_paper_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_to_user_id ON question_paper_assignments(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_scheduled_delivery_date ON question_paper_assignments(scheduled_delivery_date);
CREATE INDEX IF NOT EXISTS idx_assignments_delivery_status ON question_paper_assignments(delivery_status);

-- Answer keys table indexes
CREATE INDEX IF NOT EXISTS idx_answer_keys_question_paper_id ON answer_keys(question_paper_id);
CREATE INDEX IF NOT EXISTS idx_answer_keys_teacher_id ON answer_keys(teacher_id);
CREATE INDEX IF NOT EXISTS idx_answer_keys_exam_date ON answer_keys(exam_date);
CREATE INDEX IF NOT EXISTS idx_answer_keys_status ON answer_keys(status);

-- Digital signatures table indexes
CREATE INDEX IF NOT EXISTS idx_digital_signatures_question_paper_id ON digital_signatures(question_paper_id);
CREATE INDEX IF NOT EXISTS idx_digital_signatures_answer_key_id ON digital_signatures(answer_key_id);

-- Notifications table indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_question_paper_id ON notifications(question_paper_id);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_at ON notifications(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- Activity logs table indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource_id ON activity_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);


-- ============================================================================
-- SECTION 14: ROLE SEED DATA
-- ============================================================================

INSERT INTO roles (name, description)
VALUES 
    ('ADMIN', 'System administrator with full system oversight, audit capabilities, and user management privileges'),
    ('TEACHER', 'Faculty member responsible for creating and submitting question papers and uploading post-examination answer keys'),
    ('EXAM_COORDINATOR', 'Examination coordinator responsible for managing paper distribution, scheduling delivery, and receiving exam materials')
ON CONFLICT (name) DO NOTHING;

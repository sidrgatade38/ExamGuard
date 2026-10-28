-- ============================================================================
-- ExamGuard - Module 22: Workflow Approval, CO/PO/BT Outcomes & Teacher Subject Authorization Migration
-- Database Engine: Supabase PostgreSQL (PostgreSQL 15+)
-- File: database/module_22_workflow_and_outcomes_migration.sql
-- ============================================================================
-- PURPOSE:
-- 1. Adds CO (Course Outcome), PO (Program Outcome), and BT (Bloom's Taxonomy)
--    metadata columns to the question_bank table.
-- 2. Establishes the teacher_subjects authorization table, binding faculty profiles
--    strictly to their authorized academic subjects.
-- 3. Adds short_name (e.g. DAA, SPOS, DBMS) to academic_subjects for fast search.
-- 4. Extends question_papers with auditable reviewer (Exam Coordinator) and
--    administrative (Admin) approval workflow state columns.
-- 5. Seeds question bank items for Design and Analysis of Algorithms (DAA).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================================
-- 1. ADD SHORT_NAME TO ACADEMIC SUBJECTS & POPULATE ACRONYMS
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'academic_subjects' AND column_name = 'short_name'
    ) THEN
        ALTER TABLE academic_subjects ADD COLUMN short_name VARCHAR(50);
        COMMENT ON COLUMN academic_subjects.short_name IS 'Subject acronym or short code e.g. DAA, SPOS, DBMS';
    END IF;
END $$;

-- Populate canonical short names for search
UPDATE academic_subjects SET short_name = 'SPOS' WHERE code = '310243';
UPDATE academic_subjects SET short_name = 'DBMS' WHERE code = '310241';
UPDATE academic_subjects SET short_name = 'CNS'  WHERE code = '310242';
UPDATE academic_subjects SET short_name = 'WT'   WHERE code = '310252';
UPDATE academic_subjects SET short_name = 'DAA'  WHERE code = '410241';
UPDATE academic_subjects SET short_name = 'OSSA' WHERE code = 'NEP-301';

CREATE INDEX IF NOT EXISTS idx_academic_subjects_short_name ON academic_subjects(short_name);
CREATE INDEX IF NOT EXISTS idx_academic_subjects_code ON academic_subjects(code);

-- ============================================================================
-- 2. TEACHER SUBJECTS AUTHORIZATION TABLE (RBAC SCOPING)
-- ============================================================================
CREATE TABLE IF NOT EXISTS teacher_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES academic_subjects(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_teacher_subject UNIQUE (teacher_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_subjects_teacher ON teacher_subjects(teacher_id, is_active);
CREATE INDEX IF NOT EXISTS idx_teacher_subjects_subject ON teacher_subjects(subject_id);

-- Authorize existing faculty (e.g. teacher@examguard.edu) for subjects
INSERT INTO teacher_subjects (teacher_id, subject_id, is_active)
SELECT u.id, s.id, TRUE
FROM users u
CROSS JOIN academic_subjects s
JOIN roles r ON u.role_id = r.id
WHERE r.name = 'TEACHER'
ON CONFLICT (teacher_id, subject_id) DO NOTHING;

-- ============================================================================
-- 3. CO / PO / BT COLUMNS ON QUESTION BANK TABLE
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_bank' AND column_name = 'course_outcome'
    ) THEN
        ALTER TABLE question_bank ADD COLUMN course_outcome VARCHAR(50) DEFAULT 'CO1';
        COMMENT ON COLUMN question_bank.course_outcome IS 'Course Outcome identifier e.g. CO1, CO2, CO3, CO4, CO5, CO6';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_bank' AND column_name = 'program_outcome'
    ) THEN
        ALTER TABLE question_bank ADD COLUMN program_outcome VARCHAR(50) DEFAULT 'PO1';
        COMMENT ON COLUMN question_bank.program_outcome IS 'Program Outcome identifier e.g. PO1, PO2, PO3... PO12, PSO1, PSO2';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_bank' AND column_name = 'bloom_taxonomy'
    ) THEN
        ALTER TABLE question_bank ADD COLUMN bloom_taxonomy VARCHAR(50) DEFAULT 'L2 - Understand';
        COMMENT ON COLUMN question_bank.bloom_taxonomy IS 'Blooms Taxonomy Level e.g. L1 - Remember, L2 - Understand, L3 - Apply, L4 - Analyze, L5 - Evaluate, L6 - Create';
    END IF;
END $$;

-- Update existing SPOS questions to appropriate default outcomes if null
UPDATE question_bank 
SET 
    course_outcome = CASE 
        WHEN unit_number = 1 THEN 'CO1'
        WHEN unit_number = 2 THEN 'CO2'
        WHEN unit_number = 3 THEN 'CO3'
        WHEN unit_number = 4 THEN 'CO4'
        WHEN unit_number = 5 THEN 'CO5'
        ELSE 'CO6'
    END,
    program_outcome = CASE 
        WHEN difficulty = 'HARD' THEN 'PO3'
        WHEN difficulty = 'MEDIUM' THEN 'PO2'
        ELSE 'PO1'
    END,
    bloom_taxonomy = CASE 
        WHEN difficulty = 'HARD' THEN 'L4 - Analyze'
        WHEN difficulty = 'MEDIUM' THEN 'L3 - Apply'
        ELSE 'L2 - Understand'
    END
WHERE course_outcome IS NULL OR bloom_taxonomy IS NULL;

-- Link existing SPOS question_bank items to academic_subjects
UPDATE question_bank qb
SET subject_id = s.id
FROM academic_subjects s
WHERE s.code = '310243' AND qb.subject_id IS NULL AND qb.subject ILIKE '%Systems Programming%';

-- ============================================================================
-- 4. QUESTION PAPERS WORKFLOW APPROVAL COLUMNS
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_papers' AND column_name = 'review_status'
    ) THEN
        ALTER TABLE question_papers ADD COLUMN review_status VARCHAR(50) DEFAULT 'PENDING_REVIEW';
        COMMENT ON COLUMN question_papers.review_status IS 'Coordinator review status: PENDING_REVIEW, REVIEWED, RECOMMENDED, RETURNED, REJECTED';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_papers' AND column_name = 'reviewer_id'
    ) THEN
        ALTER TABLE question_papers ADD COLUMN reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL;
        COMMENT ON COLUMN question_papers.reviewer_id IS 'Exam Coordinator user who reviewed the submission';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_papers' AND column_name = 'reviewed_at'
    ) THEN
        ALTER TABLE question_papers ADD COLUMN reviewed_at TIMESTAMPTZ;
        COMMENT ON COLUMN question_papers.reviewed_at IS 'Timestamp of coordinator review';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_papers' AND column_name = 'review_comments'
    ) THEN
        ALTER TABLE question_papers ADD COLUMN review_comments TEXT;
        COMMENT ON COLUMN question_papers.review_comments IS 'Notes or correction comments from the Exam Coordinator';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_papers' AND column_name = 'admin_approval_status'
    ) THEN
        ALTER TABLE question_papers ADD COLUMN admin_approval_status VARCHAR(50) DEFAULT 'PENDING_APPROVAL';
        COMMENT ON COLUMN question_papers.admin_approval_status IS 'Administrative approval status: PENDING_APPROVAL, APPROVED, REJECTED, RETURNED';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_papers' AND column_name = 'admin_approver_id'
    ) THEN
        ALTER TABLE question_papers ADD COLUMN admin_approver_id UUID REFERENCES users(id) ON DELETE SET NULL;
        COMMENT ON COLUMN question_papers.admin_approver_id IS 'Admin user who approved/rejected the paper';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_papers' AND column_name = 'admin_approved_at'
    ) THEN
        ALTER TABLE question_papers ADD COLUMN admin_approved_at TIMESTAMPTZ;
        COMMENT ON COLUMN question_papers.admin_approved_at IS 'Timestamp of administrative approval decision';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'question_papers' AND column_name = 'admin_comments'
    ) THEN
        ALTER TABLE question_papers ADD COLUMN admin_comments TEXT;
        COMMENT ON COLUMN question_papers.admin_comments IS 'Administrative audit notes or justification';
    END IF;
END $$;

-- Indexes for fast workflow queries
CREATE INDEX IF NOT EXISTS idx_question_papers_review_status ON question_papers(review_status);
CREATE INDEX IF NOT EXISTS idx_question_papers_admin_status ON question_papers(admin_approval_status);

-- ============================================================================
-- 5. SEED CURRICULUM QUESTIONS FOR DESIGN AND ANALYSIS OF ALGORITHMS (DAA)
-- ============================================================================
-- Ensure DAA academic_units exist
INSERT INTO academic_units (subject_id, unit_number, unit_title, target_marks)
SELECT s.id, 1, 'Algorithm Analysis and Recurrence Relations', 17 
FROM academic_subjects s WHERE s.code = '410241'
ON CONFLICT (subject_id, unit_number) DO NOTHING;

INSERT INTO academic_units (subject_id, unit_number, unit_title, target_marks)
SELECT s.id, 2, 'Divide-and-Conquer and Dynamic Programming', 17 
FROM academic_subjects s WHERE s.code = '410241'
ON CONFLICT (subject_id, unit_number) DO NOTHING;

INSERT INTO academic_units (subject_id, unit_number, unit_title, target_marks)
SELECT s.id, 3, 'Greedy Techniques and Graph Algorithms', 18 
FROM academic_subjects s WHERE s.code = '410241'
ON CONFLICT (subject_id, unit_number) DO NOTHING;

INSERT INTO academic_units (subject_id, unit_number, unit_title, target_marks)
SELECT s.id, 4, 'NP-Completeness and Approximation Algorithms', 18 
FROM academic_subjects s WHERE s.code = '410241'
ON CONFLICT (subject_id, unit_number) DO NOTHING;

-- Seed DAA questions with author set to existing teacher
INSERT INTO question_bank (
    author_id, subject, course, semester, academic_pattern, exam_type,
    unit_number, unit_title, topic, question_text, question_type,
    marks, difficulty, answer_scheme, approval_status, is_active,
    subject_id, course_outcome, program_outcome, bloom_taxonomy
)
SELECT 
    u.id,
    'Design and Analysis of Algorithms',
    'B.E. (Computer Engineering)',
    'Semester 7',
    '2019 Pattern',
    'End Semester Examination',
    1,
    'Algorithm Analysis and Recurrence Relations',
    'Asymptotic Notation & Master Theorem',
    'Explain Big-Oh, Big-Omega, and Big-Theta asymptotic notations with mathematical definitions and graphical representations.',
    'DESCRIPTIVE',
    8,
    'MEDIUM',
    'Definitions of f(n) <= c*g(n), lower bounds, tight bounds. Graphical representation and formal proofs.',
    'APPROVED',
    TRUE,
    s.id,
    'CO1',
    'PO1',
    'L2 - Understand'
FROM users u, academic_subjects s
WHERE u.email = 'teacher@examguard.edu' AND s.code = '410241'
AND NOT EXISTS (
    SELECT 1 FROM question_bank q WHERE q.subject = 'Design and Analysis of Algorithms' AND q.topic = 'Asymptotic Notation & Master Theorem'
);

INSERT INTO question_bank (
    author_id, subject, course, semester, academic_pattern, exam_type,
    unit_number, unit_title, topic, question_text, question_type,
    marks, difficulty, answer_scheme, approval_status, is_active,
    subject_id, course_outcome, program_outcome, bloom_taxonomy
)
SELECT 
    u.id,
    'Design and Analysis of Algorithms',
    'B.E. (Computer Engineering)',
    'Semester 7',
    '2019 Pattern',
    'End Semester Examination',
    1,
    'Algorithm Analysis and Recurrence Relations',
    'Master Theorem Recurrence',
    'Solve the recurrence relation T(n) = 2T(n/2) + n*log(n) using Master Theorem or state why Master Theorem cannot be applied directly.',
    'NUMERICAL',
    9,
    'HARD',
    'Analysis of a=2, b=2, f(n)=n log n. Case analysis, extended master theorem comparison, O(n log^2 n) derivation.',
    'APPROVED',
    TRUE,
    s.id,
    'CO1',
    'PO2',
    'L4 - Analyze'
FROM users u, academic_subjects s
WHERE u.email = 'teacher@examguard.edu' AND s.code = '410241'
AND NOT EXISTS (
    SELECT 1 FROM question_bank q WHERE q.subject = 'Design and Analysis of Algorithms' AND q.topic = 'Master Theorem Recurrence'
);

INSERT INTO question_bank (
    author_id, subject, course, semester, academic_pattern, exam_type,
    unit_number, unit_title, topic, question_text, question_type,
    marks, difficulty, answer_scheme, approval_status, is_active,
    subject_id, course_outcome, program_outcome, bloom_taxonomy
)
SELECT 
    u.id,
    'Design and Analysis of Algorithms',
    'B.E. (Computer Engineering)',
    'Semester 7',
    '2019 Pattern',
    'End Semester Examination',
    2,
    'Divide-and-Conquer and Dynamic Programming',
    'Dynamic Programming 0/1 Knapsack',
    'Explain the principle of Dynamic Programming. Formulate the recurrence relation and solve the 0/1 Knapsack problem for W=5, items: weights={2,3,4}, values={3,4,5}.',
    'NUMERICAL',
    8,
    'MEDIUM',
    'Overlapping subproblems, optimal substructure, 2D DP matrix filling, backtracking to identify selected items.',
    'APPROVED',
    TRUE,
    s.id,
    'CO2',
    'PO3',
    'L3 - Apply'
FROM users u, academic_subjects s
WHERE u.email = 'teacher@examguard.edu' AND s.code = '410241'
AND NOT EXISTS (
    SELECT 1 FROM question_bank q WHERE q.subject = 'Design and Analysis of Algorithms' AND q.topic = 'Dynamic Programming 0/1 Knapsack'
);

INSERT INTO question_bank (
    author_id, subject, course, semester, academic_pattern, exam_type,
    unit_number, unit_title, topic, question_text, question_type,
    marks, difficulty, answer_scheme, approval_status, is_active,
    subject_id, course_outcome, program_outcome, bloom_taxonomy
)
SELECT 
    u.id,
    'Design and Analysis of Algorithms',
    'B.E. (Computer Engineering)',
    'Semester 7',
    '2019 Pattern',
    'End Semester Examination',
    2,
    'Divide-and-Conquer and Dynamic Programming',
    'Longest Common Subsequence (LCS)',
    'Write the algorithm to find Longest Common Subsequence (LCS) using Dynamic Programming. Trace for X = "ABCBDAB" and Y = "BDCABA".',
    'DESCRIPTIVE',
    9,
    'HARD',
    'Recurrence relation for LCS[i,j], dynamic programming table construction, arrow pointer traceback.',
    'APPROVED',
    TRUE,
    s.id,
    'CO2',
    'PO3',
    'L4 - Analyze'
FROM users u, academic_subjects s
WHERE u.email = 'teacher@examguard.edu' AND s.code = '410241'
AND NOT EXISTS (
    SELECT 1 FROM question_bank q WHERE q.subject = 'Design and Analysis of Algorithms' AND q.topic = 'Longest Common Subsequence (LCS)'
);

INSERT INTO question_bank (
    author_id, subject, course, semester, academic_pattern, exam_type,
    unit_number, unit_title, topic, question_text, question_type,
    marks, difficulty, answer_scheme, approval_status, is_active,
    subject_id, course_outcome, program_outcome, bloom_taxonomy
)
SELECT 
    u.id,
    'Design and Analysis of Algorithms',
    'B.E. (Computer Engineering)',
    'Semester 7',
    '2019 Pattern',
    'End Semester Examination',
    3,
    'Greedy Techniques and Graph Algorithms',
    'Dijkstras Shortest Path Algorithm',
    'Explain Dijkstra algorithm for Single Source Shortest Path with priority queue implementation. Analyze its time complexity.',
    'DESCRIPTIVE',
    9,
    'MEDIUM',
    'Greedy choice property, relaxation step, min-heap priority queue complexity O((V+E) log V).',
    'APPROVED',
    TRUE,
    s.id,
    'CO3',
    'PO2',
    'L3 - Apply'
FROM users u, academic_subjects s
WHERE u.email = 'teacher@examguard.edu' AND s.code = '410241'
AND NOT EXISTS (
    SELECT 1 FROM question_bank q WHERE q.subject = 'Design and Analysis of Algorithms' AND q.topic = 'Dijkstras Shortest Path Algorithm'
);

INSERT INTO question_bank (
    author_id, subject, course, semester, academic_pattern, exam_type,
    unit_number, unit_title, topic, question_text, question_type,
    marks, difficulty, answer_scheme, approval_status, is_active,
    subject_id, course_outcome, program_outcome, bloom_taxonomy
)
SELECT 
    u.id,
    'Design and Analysis of Algorithms',
    'B.E. (Computer Engineering)',
    'Semester 7',
    '2019 Pattern',
    'End Semester Examination',
    4,
    'NP-Completeness and Approximation Algorithms',
    'P vs NP and NP-Complete Reductions',
    'Define class P, NP, NP-Hard, and NP-Complete. Describe the polynomial-time reduction process to prove Circuit-SAT <= 3-SAT.',
    'DESCRIPTIVE',
    9,
    'HARD',
    'Nondeterministic Turing machines, verification in polynomial time, Cook-Levin theorem, reduction gadget.',
    'APPROVED',
    TRUE,
    s.id,
    'CO4',
    'PO1',
    'L4 - Analyze'
FROM users u, academic_subjects s
WHERE u.email = 'teacher@examguard.edu' AND s.code = '410241'
AND NOT EXISTS (
    SELECT 1 FROM question_bank q WHERE q.subject = 'Design and Analysis of Algorithms' AND q.topic = 'P vs NP and NP-Complete Reductions'
);

-- ============================================================================
-- 6. REVERSIBILITY DOCUMENTATION (DOWN MIGRATION)
-- ============================================================================
/*
To roll back this migration in the Supabase SQL Editor:
ALTER TABLE academic_subjects DROP COLUMN IF EXISTS short_name;
DROP TABLE IF EXISTS teacher_subjects;
ALTER TABLE question_bank DROP COLUMN IF EXISTS course_outcome;
ALTER TABLE question_bank DROP COLUMN IF EXISTS program_outcome;
ALTER TABLE question_bank DROP COLUMN IF EXISTS bloom_taxonomy;
ALTER TABLE question_papers DROP COLUMN IF EXISTS review_status;
ALTER TABLE question_papers DROP COLUMN IF EXISTS reviewer_id;
ALTER TABLE question_papers DROP COLUMN IF EXISTS reviewed_at;
ALTER TABLE question_papers DROP COLUMN IF EXISTS review_comments;
ALTER TABLE question_papers DROP COLUMN IF EXISTS admin_approval_status;
ALTER TABLE question_papers DROP COLUMN IF EXISTS admin_approver_id;
ALTER TABLE question_papers DROP COLUMN IF EXISTS admin_approved_at;
ALTER TABLE question_papers DROP COLUMN IF EXISTS admin_comments;
DELETE FROM question_bank WHERE subject = 'Design and Analysis of Algorithms';
*/

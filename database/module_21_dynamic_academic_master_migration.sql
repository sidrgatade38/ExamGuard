-- ============================================================================
-- ExamGuard - Module 21: Dynamic Academic Master Structure Migration
-- Database Engine: Supabase PostgreSQL (PostgreSQL 15+)
-- File: database/module_21_dynamic_academic_master_migration.sql
-- ============================================================================
-- PURPOSE:
-- Establishes a normalized, database-driven academic hierarchy supporting
-- multiple departments, courses, subjects, semesters, and examination patterns
-- for the college Examination Cell.
--
-- ENTITY HIERARCHY:
--   academic_institutions -> academic_departments -> academic_courses
--     -> academic_patterns & academic_semesters -> academic_subjects
--     -> academic_units
--
-- IMPORTANT NOTICE:
-- As per ExamGuard project guidelines, execute this script manually in the
-- Supabase SQL Editor.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. INSTITUTIONS / COLLEGES
CREATE TABLE IF NOT EXISTS academic_institutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ACADEMIC DEPARTMENTS
CREATE TABLE IF NOT EXISTS academic_departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institution_id UUID REFERENCES academic_institutions(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. ACADEMIC COURSES / DEGREES
CREATE TABLE IF NOT EXISTS academic_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES academic_departments(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    degree VARCHAR(50) NOT NULL DEFAULT 'B.E.',
    duration_years INT NOT NULL DEFAULT 4,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. ACADEMIC PATTERNS / CURRICULA
CREATE TABLE IF NOT EXISTS academic_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    revision_year INT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. ACADEMIC SEMESTERS
CREATE TABLE IF NOT EXISTS academic_semesters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES academic_courses(id) ON DELETE CASCADE,
    semester_number INT NOT NULL CHECK (semester_number >= 1 AND semester_number <= 10),
    semester_label VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. ACADEMIC SUBJECTS
CREATE TABLE IF NOT EXISTS academic_subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID NOT NULL REFERENCES academic_departments(id) ON DELETE RESTRICT,
    course_id UUID NOT NULL REFERENCES academic_courses(id) ON DELETE RESTRICT,
    pattern_id UUID NOT NULL REFERENCES academic_patterns(id) ON DELETE RESTRICT,
    code VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    semester_label VARCHAR(50) NOT NULL DEFAULT 'Semester 5',
    total_marks INT NOT NULL DEFAULT 70,
    duration_hours NUMERIC(3,1) NOT NULL DEFAULT 2.5,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_subject_code_pattern UNIQUE (code, pattern_id)
);

-- 7. ACADEMIC UNITS / MODULES
CREATE TABLE IF NOT EXISTS academic_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES academic_subjects(id) ON DELETE CASCADE,
    unit_number INT NOT NULL CHECK (unit_number >= 1 AND unit_number <= 10),
    unit_title VARCHAR(255) NOT NULL,
    target_marks INT NOT NULL DEFAULT 17,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_subject_unit_number UNIQUE (subject_id, unit_number)
);

-- Indexes for lightning-fast dependent query lookups
CREATE INDEX IF NOT EXISTS idx_academic_dept_inst ON academic_departments(institution_id);
CREATE INDEX IF NOT EXISTS idx_academic_courses_dept ON academic_courses(department_id);
CREATE INDEX IF NOT EXISTS idx_academic_subjects_lookup ON academic_subjects(department_id, course_id, pattern_id, is_active);
CREATE INDEX IF NOT EXISTS idx_academic_units_sub ON academic_units(subject_id);

-- Optional linkage to question_bank and exam_blueprints if columns do not already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'question_bank' AND column_name = 'subject_id') THEN
        ALTER TABLE question_bank ADD COLUMN subject_id UUID REFERENCES academic_subjects(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'exam_blueprints' AND column_name = 'subject_id') THEN
        ALTER TABLE exam_blueprints ADD COLUMN subject_id UUID REFERENCES academic_subjects(id) ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- SEED INITIAL ACADEMIC MASTER DATA
-- ============================================================================

-- 1. Default College / Institution
INSERT INTO academic_institutions (code, name, is_active)
VALUES ('ENGG_COLL', 'Pune Institute of Computer Technology (SPPU Affiliated)', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 2. Departments
INSERT INTO academic_departments (institution_id, code, name, is_active)
SELECT id, 'COMP', 'Department of Computer Engineering', TRUE FROM academic_institutions WHERE code = 'ENGG_COLL'
ON CONFLICT (code) DO NOTHING;

INSERT INTO academic_departments (institution_id, code, name, is_active)
SELECT id, 'IT', 'Department of Information Technology', TRUE FROM academic_institutions WHERE code = 'ENGG_COLL'
ON CONFLICT (code) DO NOTHING;

INSERT INTO academic_departments (institution_id, code, name, is_active)
SELECT id, 'ENTC', 'Department of Electronics & Telecommunication', TRUE FROM academic_institutions WHERE code = 'ENGG_COLL'
ON CONFLICT (code) DO NOTHING;

-- 3. Courses / Degrees
INSERT INTO academic_courses (department_id, code, name, degree, duration_years, is_active)
SELECT id, 'TE_COMP', 'T.E. (Computer Engineering)', 'B.E.', 4, TRUE FROM academic_departments WHERE code = 'COMP'
ON CONFLICT (code) DO NOTHING;

INSERT INTO academic_courses (department_id, code, name, degree, duration_years, is_active)
SELECT id, 'BE_COMP', 'B.E. (Computer Engineering)', 'B.E.', 4, TRUE FROM academic_departments WHERE code = 'COMP'
ON CONFLICT (code) DO NOTHING;

INSERT INTO academic_courses (department_id, code, name, degree, duration_years, is_active)
SELECT id, 'TE_IT', 'T.E. (Information Technology)', 'B.Tech', 4, TRUE FROM academic_departments WHERE code = 'IT'
ON CONFLICT (code) DO NOTHING;

-- 4. Academic Patterns
INSERT INTO academic_patterns (code, name, revision_year, is_active)
VALUES 
    ('PAT_2019', '2019 Pattern', 2019, TRUE),
    ('PAT_2024_NEP', '2024 NEP Pattern', 2024, TRUE),
    ('PAT_2015', '2015 Pattern (Backlog)', 2015, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 5. Subjects for Computer Engineering
INSERT INTO academic_subjects (department_id, course_id, pattern_id, code, title, semester_label, total_marks, duration_hours, is_active)
SELECT 
    d.id, c.id, p.id, '310243', 'Systems Programming and Operating System', 'Semester 5', 70, 2.5, TRUE
FROM academic_departments d, academic_courses c, academic_patterns p
WHERE d.code = 'COMP' AND c.code = 'TE_COMP' AND p.code = 'PAT_2019'
ON CONFLICT (code, pattern_id) DO NOTHING;

INSERT INTO academic_subjects (department_id, course_id, pattern_id, code, title, semester_label, total_marks, duration_hours, is_active)
SELECT 
    d.id, c.id, p.id, '310241', 'Database Management Systems', 'Semester 5', 70, 2.5, TRUE
FROM academic_departments d, academic_courses c, academic_patterns p
WHERE d.code = 'COMP' AND c.code = 'TE_COMP' AND p.code = 'PAT_2019'
ON CONFLICT (code, pattern_id) DO NOTHING;

INSERT INTO academic_subjects (department_id, course_id, pattern_id, code, title, semester_label, total_marks, duration_hours, is_active)
SELECT 
    d.id, c.id, p.id, '310242', 'Computer Networks and Security', 'Semester 5', 70, 2.5, TRUE
FROM academic_departments d, academic_courses c, academic_patterns p
WHERE d.code = 'COMP' AND c.code = 'TE_COMP' AND p.code = 'PAT_2019'
ON CONFLICT (code, pattern_id) DO NOTHING;

INSERT INTO academic_subjects (department_id, course_id, pattern_id, code, title, semester_label, total_marks, duration_hours, is_active)
SELECT 
    d.id, c.id, p.id, '310252', 'Web Technology', 'Semester 6', 70, 2.5, TRUE
FROM academic_departments d, academic_courses c, academic_patterns p
WHERE d.code = 'COMP' AND c.code = 'TE_COMP' AND p.code = 'PAT_2019'
ON CONFLICT (code, pattern_id) DO NOTHING;

INSERT INTO academic_subjects (department_id, course_id, pattern_id, code, title, semester_label, total_marks, duration_hours, is_active)
SELECT 
    d.id, c.id, p.id, '410241', 'Design and Analysis of Algorithms', 'Semester 7', 70, 2.5, TRUE
FROM academic_departments d, academic_courses c, academic_patterns p
WHERE d.code = 'COMP' AND c.code = 'BE_COMP' AND p.code = 'PAT_2019'
ON CONFLICT (code, pattern_id) DO NOTHING;

-- Subjects for 2024 NEP Pattern
INSERT INTO academic_subjects (department_id, course_id, pattern_id, code, title, semester_label, total_marks, duration_hours, is_active)
SELECT 
    d.id, c.id, p.id, 'NEP-301', 'Operating Systems & System Architecture', 'Semester 5', 70, 2.5, TRUE
FROM academic_departments d, academic_courses c, academic_patterns p
WHERE d.code = 'COMP' AND c.code = 'TE_COMP' AND p.code = 'PAT_2024_NEP'
ON CONFLICT (code, pattern_id) DO NOTHING;

-- 6. Units for Systems Programming & OS (310243)
INSERT INTO academic_units (subject_id, unit_number, unit_title, target_marks)
SELECT s.id, 1, 'Loaders and Linkers', 17 FROM academic_subjects s WHERE s.code = '310243'
ON CONFLICT (subject_id, unit_number) DO NOTHING;

INSERT INTO academic_units (subject_id, unit_number, unit_title, target_marks)
SELECT s.id, 2, 'Compilers, Interpreters and Lexical Analysis', 17 FROM academic_subjects s WHERE s.code = '310243'
ON CONFLICT (subject_id, unit_number) DO NOTHING;

INSERT INTO academic_units (subject_id, unit_number, unit_title, target_marks)
SELECT s.id, 3, 'Operating System Overview & Process Management', 18 FROM academic_subjects s WHERE s.code = '310243'
ON CONFLICT (subject_id, unit_number) DO NOTHING;

INSERT INTO academic_units (subject_id, unit_number, unit_title, target_marks)
SELECT s.id, 4, 'Memory Management', 18 FROM academic_subjects s WHERE s.code = '310243'
ON CONFLICT (subject_id, unit_number) DO NOTHING;

-- Units for Database Management Systems (310241)
INSERT INTO academic_units (subject_id, unit_number, unit_title, target_marks)
SELECT s.id, 1, 'ER Modeling and Relational Database Design', 17 FROM academic_subjects s WHERE s.code = '310241'
ON CONFLICT (subject_id, unit_number) DO NOTHING;

INSERT INTO academic_units (subject_id, unit_number, unit_title, target_marks)
SELECT s.id, 2, 'SQL, Relational Algebra, and Normalization', 17 FROM academic_subjects s WHERE s.code = '310241'
ON CONFLICT (subject_id, unit_number) DO NOTHING;

INSERT INTO academic_units (subject_id, unit_number, unit_title, target_marks)
SELECT s.id, 3, 'Transaction Processing, Concurrency, and ACID', 18 FROM academic_subjects s WHERE s.code = '310241'
ON CONFLICT (subject_id, unit_number) DO NOTHING;

INSERT INTO academic_units (subject_id, unit_number, unit_title, target_marks)
SELECT s.id, 4, 'Query Processing, Indexing, and NoSQL', 18 FROM academic_subjects s WHERE s.code = '310241'
ON CONFLICT (subject_id, unit_number) DO NOTHING;

-- Units for Computer Networks and Security (310242)
INSERT INTO academic_units (subject_id, unit_number, unit_title, target_marks)
SELECT s.id, 1, 'Network Layer and IPv4/IPv6 Routing', 17 FROM academic_subjects s WHERE s.code = '310242'
ON CONFLICT (subject_id, unit_number) DO NOTHING;

INSERT INTO academic_units (subject_id, unit_number, unit_title, target_marks)
SELECT s.id, 2, 'Transport Layer Protocols (TCP/UDP)', 17 FROM academic_subjects s WHERE s.code = '310242'
ON CONFLICT (subject_id, unit_number) DO NOTHING;

INSERT INTO academic_units (subject_id, unit_number, unit_title, target_marks)
SELECT s.id, 3, 'Application Layer Protocols (DNS, HTTP, TLS)', 18 FROM academic_subjects s WHERE s.code = '310242'
ON CONFLICT (subject_id, unit_number) DO NOTHING;

INSERT INTO academic_units (subject_id, unit_number, unit_title, target_marks)
SELECT s.id, 4, 'Network Security, Firewalls, and Cryptography', 18 FROM academic_subjects s WHERE s.code = '310242'
ON CONFLICT (subject_id, unit_number) DO NOTHING;

# ExamGuard — Module 18: Question Bank & Blueprint Design Specification

## Overview

Module 18 introduces curriculum-driven question paper design and randomized set generation to ExamGuard. It complements the existing manual PDF upload pipeline (Option A) by providing an academic blueprint-driven generator (Option B) that models Indian university examination structures (such as Savitribai Phule Pune University / SPPU 2019 pattern).

---

## 1. Relational Database Schema Architecture

The database architecture is built purely in Supabase PostgreSQL, defined in `database/module_18_question_bank_and_generator_migration.sql`.

```
+-----------------------------------------------------------------------------------------+
|                                     question_bank                                       |
|-----------------------------------------------------------------------------------------|
| id (UUID, PK)                                                                           |
| author_id (UUID, FK -> users.id)                                                        |
| subject (VARCHAR)                                                                       |
| course (VARCHAR)                                                                        |
| semester (VARCHAR)                                                                      |
| exam_type (VARCHAR)                                                                     |
| syllabus_pattern (VARCHAR)                                                              |
| unit_number (INT)                                                                       |
| unit_title (VARCHAR)                                                                    |
| topic (VARCHAR)                                                                         |
| subtopic (VARCHAR)                                                                      |
| question_text (TEXT)                                                                    |
| question_type (VARCHAR) -- descriptive, numerical, short-answer, mcq                     |
| marks (INT)                                                                             |
| difficulty (VARCHAR)    -- easy, medium, hard                                           |
| optional_diagram_desc (TEXT)                                                            |
| answer_key (TEXT)       -- restricted to author/coordinator/admin                      |
| marking_scheme (TEXT)   -- restricted to author/coordinator/admin                      |
| approval_status (VARCHAR) -- draft, pending_review, approved, rejected                  |
| is_active (BOOLEAN)                                                                     |
| created_at / updated_at (TIMESTAMPTZ)                                                   |
+-----------------------------------------------------------------------------------------+
                                           |
                                           | (Referenced during generation & snapshotting)
                                           v
+------------------------------------+          +------------------------------------+
|          exam_blueprints           | 1 ---- * |       exam_blueprint_sections      |
|------------------------------------|          |------------------------------------|
| id (UUID, PK)                      |          | id (UUID, PK)                      |
| teacher_id (UUID, FK -> users.id)  |          | blueprint_id (UUID, FK)            |
| title (VARCHAR)                    |          | section_name (VARCHAR)             |
| subject, course, semester          |          | question_number (INT)              |
| exam_type, syllabus_pattern        |          | unit_number (INT)                  |
| duration_minutes (INT)             |          | required_marks (INT)               |
| total_marks (INT)                  |          | question_type (VARCHAR)            |
| instructions (TEXT[])              |          | difficulty (VARCHAR)               |
| total_questions (INT)              |          | or_group_id (VARCHAR)              |
| sets_to_generate (INT)             |          | is_mandatory_choice (BOOLEAN)      |
| max_overlap_percentage (INT)       |          | created_at / updated_at            |
| is_active (BOOLEAN)                |          +------------------------------------+
+------------------------------------+
                 |
                 | 1
                 |
                 *
+-----------------------------------------------------------------------------------------+
|                                 generated_exam_papers                                   |
|-----------------------------------------------------------------------------------------|
| id (UUID, PK)                                                                           |
| blueprint_id (UUID, FK -> exam_blueprints.id)                                           |
| teacher_id (UUID, FK -> users.id)                                                       |
| generation_identifier (VARCHAR, UNIQUE)                                                 |
| subject, course, semester, exam_type, syllabus_pattern                                   |
| duration_minutes (INT)                                                                  |
| total_marks (INT)                                                                       |
| instructions (TEXT[])                                                                   |
| sets_count (INT)                                                                        |
| status (VARCHAR) -- draft, generated, approved, submitted                               |
| question_paper_id (UUID, FK -> question_papers.id)                                      |
| submitted_at (TIMESTAMPTZ)                                                              |
| created_at / updated_at (TIMESTAMPTZ)                                                   |
+-----------------------------------------------------------------------------------------+
                                           | 1
                                           |
                                           *
+-----------------------------------------------------------------------------------------+
|                                  generated_exam_sets                                    |
|-----------------------------------------------------------------------------------------|
| id (UUID, PK)                                                                           |
| generated_paper_id (UUID, FK -> generated_exam_papers.id)                               |
| set_name (VARCHAR) -- 'Set A', 'Set B', etc.                                            |
| set_index (INT)                                                                         |
| total_marks (INT)                                                                       |
| selected_question_ids (UUID[])                                                          |
| questions_snapshot (JSONB)                                                              |
| created_at / updated_at (TIMESTAMPTZ)                                                   |
+-----------------------------------------------------------------------------------------+
```

---

## 2. University Examination Structure & OR-Group Modeling

Standard university examinations (e.g., SPPU T.E. Computer Engineering) structure questions using internal alternative groups:
- **Total Questions**: 8 numbered questions (Q.1 through Q.8).
- **Alternative Groups**:
  - Q.1 OR Q.2 (Unit 1 & Unit 2, 18 Marks total: 9 + 9 or 8 + 10)
  - Q.3 OR Q.4 (Unit 3, 17 Marks total: 9 + 8)
  - Q.5 OR Q.6 (Unit 4, 18 Marks total: 9 + 9)
  - Q.7 OR Q.8 (Unit 5 & 6, 17 Marks total: 9 + 8)
- **Total Maximum Marks**: 70 Marks.
- **Duration**: 2.5 Hours (150 minutes).

### Answered Marks vs Gross Marks Calculation

In an OR-pair structure:
1. `Q1` has required marks `M1`
2. `Q2` has required marks `M2` (where `M1 == M2`)
3. The student answers *either* Q1 or Q2.
4. **Calculated Answered Marks**: `M1` is counted once towards `total_marks`.
5. If non-alternative questions exist (e.g. Q9 mandatory), its marks are added directly.
6. The blueprint validation verifies that:
   $$\text{Calculated Marks} = \sum_{\text{Unique OR groups}} \text{Marks}(\text{Group}) + \sum_{\text{Mandatory questions}} \text{Marks}(Q) == \text{Blueprint.total\_marks}$$
7. Within each OR-group, all alternatives must have identical total marks to ensure grading parity.

---

## 3. RBAC & Data Isolation Model

| Entity | Role: TEACHER | Role: EXAM_COORDINATOR | Role: ADMIN |
|---|---|---|---|
| **Question Bank** | Full CRUD on own questions; view approved questions in department/subject. | View all questions; approve/reject pending questions. | System oversight; audit logs. |
| **Answer Key & Marking Scheme** | Visible only to question author, coordinator, and admin. Stripped from candidate views. | Visible for syllabus auditing. | Visible for administrative audits. |
| **Blueprints** | Create, view, update, delete own blueprints. | View blueprints for exam scheduling. | System auditing. |
| **Generated Sets & Snapshots** | View, edit, preview, swap, approve own generated sets. | View approved sets for delivery verification. | System auditing. |
| **Submitted Papers** | Encrypted via AES-256-GCM; key wrapped via RSA-OAEP; signed via RSA-PSS. Author cannot decrypt once submitted. | Can decrypt on or after scheduled delivery date. | Cannot decrypt plaintext. |

---

## 4. Immutability of Generated Snapshots

A critical flaw in naive generators is referencing live question IDs by pointer alone. If an instructor alters a question's text, marks, or options later, previously generated papers change retroactively.

Module 18 prevents this by storing an **immutable JSONB snapshot** (`questions_snapshot`) at generation time:
- Each question in the snapshot stores its `id`, `question_number`, `sub_question`, `question_text`, `marks`, `unit_number`, `unit_title`, `topic`, `difficulty`, `or_group_id`, and `diagram_desc`.
- When rendering previews or PDFs, the engine renders solely from the snapshot.
- When an instructor uses the "Swap Question" feature, the system generates an updated snapshot and revalidates total marks and unit constraints before persisting.

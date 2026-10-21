# ExamGuard — Module 18 Manual Testing Checklist

This checklist guides manual quality assurance and verification for **Module 18: Question Bank, Exam Blueprint & Randomized Question Paper Generator**.

---

## Prerequisites

1. **Database Migration**:
   - Open your Supabase Dashboard -> **SQL Editor**.
   - Copy and paste the contents of `database/module_18_question_bank_and_generator_migration.sql`.
   - Click **Run** to execute the migration.
2. **Server & Client Startup**:
   - Backend:
     ```bash
     cd Backend
     npm start
     ```
   - Frontend:
     ```bash
     cd Frontend
     npm run dev
     ```
3. **Test Accounts**:
   - **Teacher**: `teacher@examguard.edu` / `Teacher@ExamGuard2026`
   - **Exam Coordinator**: `coordinator@examguard.edu` / `Coord@ExamGuard2026`
   - **Admin**: `admin@examguard.edu` / `Admin@ExamGuard2026`

---

## Test Scenarios

### 1. Dual-Option UI Presentation
- [ ] Log in as Teacher (`teacher@examguard.edu`).
- [ ] Navigate to the **Create** tab in Teacher Dashboard.
- [ ] Verify two distinct, professional cards appear:
  - **Option A: Upload Prepared Question Paper (PDF)**
  - **Option B: Generate Paper from Blueprint**
- [ ] Click **Option A**: Verify the original multipart PDF upload form opens with all file selection and metadata fields intact.
- [ ] Click **Option B**: Verify the guided 5-step Question Paper Generator Wizard opens.

### 2. Option A Regression Test
- [ ] Under Option A, select an existing PDF (e.g. `May_Jun_2022.pdf`).
- [ ] Fill in Subject, Course, Semester, Exam Type, and Instructions.
- [ ] Submit the form.
- [ ] Verify that:
  - Encryption (AES-256-GCM) occurs without error.
  - Digital signature (RSA-PSS) is generated.
  - Paper appears under "My Question Papers" list.

### 3. Option B — Step 1: Exam Blueprint Configuration
- [ ] Open Option B Wizard.
- [ ] In Step 1, select a sample blueprint preset: **SPPU 2019 Pattern (70 Marks, 4 OR-pairs)**.
- [ ] Observe the calculated marks table:
  - Total Questions: 8
  - Total Answered Marks: 70
  - OR-pairs configured:
    - Q1 (Unit 1 & 2: 9+9=18m) OR Q2 (Unit 1 & 2: 9+9=18m)
    - Q3 (Unit 3: 9+8=17m) OR Q4 (Unit 3: 9+8=17m)
    - Q5 (Unit 4: 9+9=18m) OR Q6 (Unit 4: 9+9=18m)
    - Q7 (Unit 5: 9+8=17m) OR Q8 (Unit 5: 9+8=17m)
- [ ] Change a section mark so total answered marks do not equal Total Marks (e.g. 71 vs 70).
- [ ] Verify a warning alert appears and "Next" is disabled until marks balance.
- [ ] Restore marks to 70 and click **Save & Proceed to Question Bank**.

### 4. Option B — Step 2: Question Bank Management
- [ ] Verify that the question list displays standard curriculum questions.
- [ ] Test filtering by Unit (Unit 1, Unit 2, Unit 3, Unit 4) and Difficulty (Easy, Medium, Hard).
- [ ] Click **Add New Question**:
  - Fill in Subject, Unit Number, Topic, Question Text, Marks (e.g., 9 marks), Difficulty.
  - Save the question.
  - Verify the new question appears with "Approved" status for testing.
- [ ] Click **Next: Feasibility & Sets Configuration**.

### 5. Option B — Step 3: Feasibility & Set Configuration
- [ ] Set "Number of Sets to Generate" = `2` (Set A and Set B).
- [ ] Set "Max Target Overlap" = `40%`.
- [ ] Click **Run Feasibility Pre-Flight Check**.
- [ ] Verify that each section shows:
  - Required pool count.
  - Available pool count in Question Bank.
  - Status indicator (Green checkmark if sufficient, warning if low).
- [ ] Click **Generate Question Paper Sets**.
- [ ] Verify a loading spinner appears, followed by transition to Step 4.

### 6. Option B — Step 4: University Layout Preview & Question Swap
- [ ] Observe the university examination layout:
  - University header: Savitribai Phule Pune University.
  - Seat No. box: `[  ][  ][  ][  ][  ][  ][  ]`.
  - Examination Title, Date, Duration (2.5 Hours), Max Marks (70).
  - Instructions section.
  - Numbered questions with clean right-aligned marks: `[9]`, `[8]`.
  - Centered `--- OR ---` dividers between Q1/Q2, Q3/Q4, Q5/Q6, Q7/Q8.
- [ ] Toggle between **Set A** and **Set B** tabs.
  - Verify both sets follow identical structure but have different questions where pool permits.
- [ ] Test Question Replacement:
  - Click **Replace Question** on Q1a.
  - Select an alternative eligible question from the dropdown.
  - Click **Confirm Swap**.
  - Verify Q1a updates immediately with identical marks and total marks remain 70.
- [ ] Click **Next: Review & Final Approval**.

### 7. Option B — Step 5: Final Approval & Secure Submission
- [ ] Review the submission confirmation checklist:
  - Blueprint: SPPU 2019 Pattern (70 Marks).
  - Selected Set: Set A (or Set B).
  - Delivery Schedule: Automatically assigned to tomorrow (scheduled delivery).
  - Encryption: AES-256-GCM + RSA-OAEP.
  - Digital Signature: RSA-PSS (Teacher Private Key).
- [ ] Check the acknowledgment box: "I approve the generated question paper structure and content".
- [ ] Click **Approve & Submit Securely**.
- [ ] Verify:
  - Loading state indicates encryption, signing, and storage upload.
  - Success banner displays generated paper ID and confirmation.
  - Status transitions to `submitted`.
  - Teacher is returned to the dashboard.

### 8. Verification & Decryption Gating
- [ ] Log in as Exam Coordinator (`coordinator@examguard.edu`).
- [ ] Navigate to Question Papers.
- [ ] Locate the submitted generated question paper.
- [ ] Check the Delivery Date:
  - If before the scheduled delivery date/time: Verify that "Download & Decrypt" is locked with a delivery countdown.
  - Verify that premature decryption is strictly blocked on the backend.

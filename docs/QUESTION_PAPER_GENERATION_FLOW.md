# ExamGuard — Module 18: Question Paper Generation Flow

## End-to-End Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Teacher
    participant UI as React Frontend (Option B Wizard)
    participant API as Express API Router
    participant GenSvc as QuestionPaperGeneratorService
    participant BlueSvc as BlueprintService
    participant QBank as QuestionBankService
    participant PDFSvc as PDFRendererService
    participant SecSvc as QuestionPaperService (Module 6 & 7)
    participant Storage as Supabase Storage (Private Bucket)
    participant DB as Supabase PostgreSQL

    Teacher->>UI: Selects "Create Question Paper" (Option B)
    UI->>BlueSvc: Configure Blueprint (Exam details, units, marks, OR-pairs)
    BlueSvc-->>UI: Validates structure (Total Answered Marks == Total Marks)

    Teacher->>UI: Pre-flight pool feasibility check
    UI->>GenSvc: POST /api/question-paper-generator/check-feasibility
    GenSvc->>QBank: Count eligible approved questions matching each blueprint section
    GenSvc-->>UI: Return feasibility analysis (sufficient pool per section & target overlap)

    Teacher->>UI: Click "Generate Question Paper Sets"
    UI->>GenSvc: POST /api/question-paper-generator/generate
    Note over GenSvc: Executes Fisher-Yates server-side randomization.<br/>Strict intra-set deduplication.<br/>Inter-set overlap minimization.<br/>Stores immutable JSONB snapshot per set.
    GenSvc->>DB: Insert generated_exam_papers & generated_exam_sets (Status: 'generated')
    GenSvc-->>UI: Returns generated sets with questions snapshots

    Teacher->>UI: Preview university-style paper layout
    opt Question Replacement (Optional)
        Teacher->>UI: Click "Replace Question"
        UI->>GenSvc: POST /api/question-paper-generator/replace-question
        GenSvc-->>UI: Swaps with eligible question, preserves marks, updates snapshot
    end

    Teacher->>UI: Click "Approve & Submit Securely"
    UI->>GenSvc: POST /api/question-paper-generator/approve-and-submit
    GenSvc->>PDFSvc: renderUniversityExamPaper(setSnapshot, examMetadata)
    PDFSvc-->>GenSvc: In-memory PDF Buffer (Vector formatted with seat no, headers, OR-dividers)
    
    Note over GenSvc,SecSvc: Pipeline Handoff into ExamGuard Secure Architecture
    GenSvc->>SecSvc: submitQuestionPaper(pdfBuffer, metadata, teacherId)
    SecSvc->>SecSvc: Generate AES-256-GCM DEK & encrypt PDF buffer
    SecSvc->>SecSvc: RSA-PSS Sign ciphertext buffer using Teacher's private key
    SecSvc->>SecSvc: RSA-OAEP wrap DEK using Coordinator's public key
    SecSvc->>Storage: Store ciphertext in private 'exam-papers' bucket (${id}.pdf.enc)
    SecSvc->>DB: Store metadata, signature, wrapped DEK, assignment, and scheduled date
    GenSvc->>DB: Update generated_exam_papers (status: 'submitted', question_paper_id)
    GenSvc-->>UI: Submission confirmed with question_paper_id & tracking metadata
```

---

## Randomized Selection Algorithm Details

1. **Pre-flight Feasibility Check**:
   - For each blueprint section $S_i$, queries active questions where:
     - `subject == blueprint.subject`
     - `unit_number == S_i.unit_number`
     - `marks == S_i.required_marks`
     - `approval_status == 'approved'`
   - Computes minimum pool required across all sets:
     $$\text{RequiredPool}(S_i) = \text{UniqueNeeded}(S_i) = \lceil \text{sets\_count} \times (1 - \text{max\_overlap}) \rceil$$
   - If pool is insufficient, detailed diagnostics report which unit, question number, and mark value lacks questions.

2. **Server-Side Randomization**:
   - Cryptographically secure pseudo-random numbers (or Fisher-Yates array shuffling) select questions from the pool.
   - For Set 0: Picks randomly from available pool matching section criteria.
   - For Set $k > 0$:
     - Attempts to pick questions not used in sets $0 \dots k-1$.
     - If non-overlapping pool is depleted, gracefully samples with minimal overlap while keeping $\text{Overlap} \le \text{max\_overlap\_percentage}$.
     - Emits audit warnings if requested overlap constraints cannot be strictly maintained due to question-bank pool size.

3. **Intra-Set Uniqueness Guarantee**:
   - Under no circumstances does a single generated set contain the same `question_id` more than once, even across different sections or OR-groups.

---

## Security Pipeline Integration

Generated papers do not take shortcuts or bypass the production security pipeline:
1. **No Disk Exposure**: The rendered university PDF buffer exists strictly in backend memory (`Buffer.from(...)`). It is never written to unencrypted temporary disk files.
2. **AES-256-GCM Envelope Encryption**:
   - Random 256-bit Data Encryption Key (DEK).
   - 12-byte random Initialization Vector (IV).
   - 16-byte Authentication Tag ensuring ciphertext integrity and authenticity.
3. **RSA-PSS Digital Signature**:
   - SHA-256 hash calculated across the ciphertext buffer.
   - Signed using RSA-PSS with 2048-bit teacher signing key and salt length 32.
4. **RSA-OAEP Key Wrapping**:
   - DEK encrypted with Coordinator's RSA-2048 public key using OAEP padding (SHA-256).
5. **Private Supabase Storage**:
   - Ciphertext stored as `${paperId}.pdf.enc`.
   - Access denied to public and unauthenticated requests.
6. **Scheduled Delivery Enforcement**:
   - Coordinator and recipients cannot decrypt the paper until the scheduled delivery date/time passes.

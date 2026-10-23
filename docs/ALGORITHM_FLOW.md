# ExamGuard — Algorithm Flow

**Module 20 Documentation | Secure Examination Question Paper Management System**

---

## 1. Overview

ExamGuard enforces a strict, multi-party cryptographic workflow for every examination question paper.
The workflow splits into two phases: the **Teacher Side** (paper creation and secure submission) and
the **Exam Cell Side** (controlled receipt and scheduled delivery). These phases are bridged by a
five-step **decryption sequence** executed only by authorised exam-cell personnel at the moment of delivery.

The complete 11-step algorithm is:

```
Teacher Side (6 steps)            Exam Cell Side (5 steps)
─────────────────────────         ─────────────────────────────────
1. Prepare paper (PDF)            7.  Receive encrypted paper
2. AES-256-GCM encrypt            8.  Verify RSA-PSS signature
3. RSA-OAEP key wrap              9.  Confirm RBAC authorisation
4. RSA-PSS sign                   10. RSA-OAEP key unwrap + AES decrypt
5. Upload to private storage      11. Deliver original plaintext
6. Assign to Exam Cell
```

---

## 2. Teacher Side — 6 Steps

### Step 1 · Paper Preparation
The authoring faculty member composes the question paper as a PDF document and submits it
through the Teacher portal. The file is validated server-side for MIME type and PDF magic bytes
before any cryptographic processing begins.

**Implementation:** `Frontend/src/pages/TeacherHome.jsx`  
**Validation:** `Backend/src/middleware/uploadMiddleware.js`

---

### Step 2 · AES-256-GCM Encryption
A cryptographically secure, unique 256-bit AES session key and 96-bit IV are generated for each
paper. The plaintext PDF is encrypted with AES-256-GCM, producing:
- `ciphertext` — the encrypted PDF bytes
- `authTag` — the GCM authentication tag (128 bits)
- `iv` — the initialisation vector (96 bits)

**Implementation:** `Backend/src/services/encryptionService.js → encryptDocument()`  
**Algorithm:** AES-256-GCM  

---

### Step 3 · RSA-OAEP AES Key Wrapping
The AES session key is wrapped (encrypted) using the Exam Cell's RSA public key with OAEP padding
and SHA-256 as the MGF hash. The wrapped key is stored separately from the ciphertext so that
only the holder of the RSA private key can unwrap it.

**Implementation:** `Backend/src/services/encryptionService.js → wrapAesKey()`  
**Algorithm:** RSA-OAEP / SHA-256  
**Storage:** `paper_keys` table

---

### Step 4 · RSA-PSS Digital Signature
A SHA-256 digest of the ciphertext is computed and signed using the Teacher's RSA private key with
PSS padding. This binds the paper's identity to the authoring faculty member and makes any later
tampering detectable.

**Implementation:** `Backend/src/services/signatureService.js → signDocument()`  
**Algorithm:** RSA-PSS / SHA-256  
**Storage:** `digital_signatures` table

---

### Step 5 · Upload to Private Supabase Storage
The encrypted ciphertext blob is uploaded to a private Supabase Storage bucket under a
teacher-scoped, paper-scoped path. No public URLs are ever generated; all downloads require
server-mediated authentication.

**Implementation:** `Backend/src/services/questionPaperService.js → submitQuestionPaper()`  
**Path format:** `question-papers/{teacherId}/{paperId}/encrypted/{filename}.enc`

---

### Step 6 · Assignment and Scheduled Delivery
An assignment record is created, linking the question paper to an Exam Coordinator. The delivery
date is computed **server-side** (always the next calendar day), preventing any client-side
manipulation of the delivery schedule.

**Implementation:** `Backend/src/services/questionPaperService.js → calculateNextCalendarDay()`  
**Storage:** `question_paper_assignments` table

---

## 3. Exam Cell Side — 5 Steps

### Step 7 · Receive Encrypted Paper
The Exam Coordinator receives a notification of the assigned paper. They can view its metadata
(title, subject, semester, scheduled date) without any access to the plaintext. No decryption
occurs at this stage.

**Implementation:** `Backend/src/services/questionPaperService.js → getAssignedQuestionPapers()`

---

### Step 8 · Verify RSA-PSS Signature (Signature Verification)
Before any key or content access, the server verifies the RSA-PSS digital signature against
the stored SHA-256 digest. If the signature is invalid — indicating tampering, corruption, or
key mismatch — the request is rejected with 403. **Decryption never proceeds past a failed
signature check.**

**Implementation:** `Backend/src/services/verificationService.js → verifyQuestionPaperIntegrity()`  
**Guarantee:** Authenticity + Integrity

---

### Step 9 · RBAC Authorisation Check
Only after signature verification passes does the server confirm that the requesting user holds
the required role (`EXAM_COORDINATOR` or authoring `TEACHER` for download). Role is looked up
authoritatively from the database — JWT role claims alone are insufficient.

**Implementation:** `Backend/src/middleware/roleMiddleware.js`  
**Database check:** `Backend/src/services/authorizationService.js → getUserRole()`

---

### Step 10 · RSA-OAEP Key Unwrap + AES-256-GCM Decryption
The wrapped AES session key is fetched from `paper_keys` and decrypted with the Exam Cell RSA
private key (RSA-OAEP). The recovered session key is then used to AES-256-GCM-decrypt the
ciphertext. The GCM authentication tag is verified as part of decryption, providing a final
integrity check.

**Implementation:**  
- `Backend/src/services/encryptionService.js → unwrapAesKey()`  
- `Backend/src/services/encryptionService.js → decryptDocument()`

---

### Step 11 · Deliver Original Plaintext
The recovered PDF bytes are streamed to the authorised requester. All access is recorded in the
immutable audit log with user ID, role, resource ID, timestamp, and outcome.

**Implementation:** `Backend/src/controllers/questionPaperController.js → downloadPaper()`  
**Audit:** `Backend/src/services/auditLogService.js`

---

## 4. Decryption Sequence — Detailed View

```
Encrypted Paper (from Storage)
         │
         ▼
┌─────────────────────────────┐
│  Step 1: Signature          │  ← RSA-PSS verify(SHA-256(ciphertext), teacherPublicKey)
│  Verification               │    FAIL → 403 Forbidden (request aborted)
└──────────────┬──────────────┘
               │ PASS
               ▼
┌─────────────────────────────┐
│  Step 2: RBAC               │  ← JWT verified; role confirmed from database
│  Authorisation              │    FAIL → 403 Forbidden (request aborted)
└──────────────┬──────────────┘
               │ PASS
               ▼
┌─────────────────────────────┐
│  Step 3: AES Key Recovery   │  ← RSA-OAEP decrypt(wrappedKey, examCellPrivateKey)
│  (RSA-OAEP Unwrap)          │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Step 4: AES-256-GCM        │  ← decrypt(ciphertext, sessionKey, IV) + verify GCM tag
│  Decryption                 │    FAIL → 500 (tag mismatch = corruption)
└──────────────┬──────────────┘
               │
               ▼
       Original Paper (PDF)
```

**Security invariants:**
- Verify-before-decrypt order is strictly enforced — no shortcut paths exist.
- A failed signature or RBAC check halts the pipeline immediately.
- The GCM authentication tag provides a final tamper-check independent of the RSA-PSS signature.
- All outcomes (PASS or FAIL) are written to the immutable `activity_logs` audit table.

---

## 5. Cryptographic Guarantees

| Security Property | Mechanism | Primitive |
|-------------------|-----------|-----------|
| **Confidentiality** | Symmetric encryption of paper content | AES-256-GCM |
| **Key Confidentiality** | Asymmetric wrapping of session key | RSA-OAEP / SHA-256 |
| **Authenticity** | Author-private-key signature | RSA-PSS / SHA-256 |
| **Integrity** | Hash-and-sign + GCM authentication tag | SHA-256 + 128-bit GCM tag |
| **Access Control** | JWT + authoritative DB role lookup | HS256 JWT + RBAC middleware |
| **Non-repudiation** | Immutable audit trail | `activity_logs` table (append-only) |
| **IDOR Protection** | Server-side ownership verification | `teacher_id === req.user.userId` |

---

## 6. Interactive UI Component

The algorithm flow is presented interactively within the ExamGuard application:

| Attribute | Value |
|-----------|-------|
| **Component** | `Frontend/src/components/AlgorithmFlowDiagram.jsx` |
| **Teacher Home** | "View Algorithm Flow" button (desktop nav + mobile drawer) |
| **Exam Coordinator Home** | "View Algorithm Flow" button (desktop nav + mobile drawer) |
| **Content** | 6-step Teacher Side, 5-step Exam Cell Side, decryption breakdown, cryptographic guarantees |

---

## 7. Key Implementation Files

| File | Responsibility |
|------|----------------|
| `Backend/src/services/encryptionService.js` | AES-256-GCM encrypt/decrypt, RSA-OAEP wrap/unwrap |
| `Backend/src/services/signatureService.js` | RSA-PSS sign with teacher private key |
| `Backend/src/services/verificationService.js` | RSA-PSS verify + SHA-256 integrity check |
| `Backend/src/services/questionPaperService.js` | Upload, download, delete orchestration |
| `Backend/src/middleware/authMiddleware.js` | JWT verification |
| `Backend/src/middleware/roleMiddleware.js` | RBAC role enforcement |
| `Backend/src/services/auditLogService.js` | Immutable audit event recording |
| `Frontend/src/components/AlgorithmFlowDiagram.jsx` | Interactive algorithm flow modal |

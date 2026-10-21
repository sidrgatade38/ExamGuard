# ExamGuard — Module 6: Question Paper Encryption & Secure Key Management

## 1. Why Encryption is Required

In the ExamGuard system, examination question papers represent high-stakes, confidential institutional assets. While access controls (JWT, RBAC) and private cloud storage prevent unauthorized endpoint calls, data-at-rest encryption ensures **zero-trust confidentiality**:

1. **Storage Infrastructure Isolation**: Even if cloud storage credentials, bucket backups, or internal infrastructure are breached, adversaries only obtain AES-256-GCM encrypted ciphertext (`.enc`), which is completely unreadable without the wrapped cryptographic keys and private key pair.
2. **Cryptographic Integrity & Tamper Proofing**: Unauthenticated encryption (such as AES-CBC or AES-ECB) is vulnerable to bit-flipping and padding oracle attacks. AES-256-GCM provides authenticated encryption with associated data (AEAD), ensuring any unauthorized modification to the ciphertext, initialization vector (IV), or authentication tag immediately invalidates decryption.
3. **No Plaintext Persistence**: Plaintext question papers exist exclusively in volatile memory buffers during ingestion and decryption. They are never written to disk or persistently stored in cloud storage.

---

## 2. AES-256-GCM Architecture

Question paper documents are encrypted using **Advanced Encryption Standard in Galois/Counter Mode (AES-256-GCM)**:

- **Key Size**: 256 bits (32 bytes), generated per-paper via `crypto.randomBytes(32)`.
- **Initialization Vector (IV)**: 96 bits (12 bytes), cryptographically random per-paper via `crypto.randomBytes(12)`.
- **Authentication Tag**: 128 bits (16 bytes), produced by `cipher.getAuthTag()`.
- **Mode Characteristics**: High throughput, hardware acceleration support, and built-in message authentication. Decryption automatically fails if any single bit of ciphertext, IV, or tag is altered.

---

## 3. RSA-OAEP Key Wrapping

To avoid storing symmetric AES keys in plaintext or relying on a single static master key, ExamGuard employs **envelope encryption**:

- **Key-Wrapping Algorithm**: `RSA-OAEP` (Optimal Asymmetric Encryption Padding) with `SHA-256` hashing.
- **Padding**: `crypto.constants.RSA_PKCS1_OAEP_PADDING`.
- **Mechanism**: The 32-byte AES key is encrypted using the public key of a dedicated RSA-2048 key pair.
- **Unwrapping**: The resulting ciphertext (`encrypted_aes_key`, base64-encoded) can only be unwrapped using the corresponding RSA private key during authorized backend decryption.

---

## 4. Envelope Encryption Overview

```text
[ Incoming PDF Buffer ] ──► AES-256-GCM (Unique DEK + IV) ──► [ Encrypted Object (.enc) ]
                                  │                                      │
                         (32-Byte DEK)                                   ▼
                                  │                          [ Private Supabase Storage ]
                                  ▼
                         RSA-OAEP-SHA256 (Public Key)
                                  │
                                  ▼
                       [ Wrapped AES Key ] ──────────────────► [ paper_keys Table ]
```

1. **Data Encryption Key (DEK)**: Encrypts the large data payload (PDF buffer).
2. **Key Encryption Key (KEK)**: Dedicated RSA key pair that encrypts/decrypts the DEK.
3. **Separation of Concerns**: Supabase Storage holds only ciphertext (`.enc`); PostgreSQL `paper_keys` holds only the wrapped AES key, IV, and auth tag. Neither possesses the full secret independently.

---

## 5. Key Generation

Keys are generated deterministically using the built-in Node.js `crypto` module:

```bash
# In Backend/ directory:
node scripts/generateEncryptionKeys.js
```

### Specifications:
- **Algorithm**: RSA (2048-bit minimum modulus length).
- **Public Key Encoding**: SPKI format in PEM (`question-paper-encryption-public.pem`).
- **Private Key Encoding**: PKCS#8 format in PEM (`question-paper-encryption-private.pem`).
- **Safety Safeguard**: The script refuses to overwrite existing keys unless invoked with `--force`.
- **Zero Console Leakage**: Private key bytes are never written to stdout.

---

## 6. Key Storage & Git Security

- **Location**: `Backend/keys/`
  - Public Key: `Backend/keys/question-paper-encryption-public.pem` (mode 0644)
  - Private Key: `Backend/keys/question-paper-encryption-private.pem` (mode 0600)
- **Version Control Exclusions**:
  - The `Backend/keys/*.pem` pattern is strictly excluded in both `.gitignore` and `Backend/.gitignore`.
  - Only `.gitkeep` is tracked to preserve directory structure.
- **Digital Signature Isolation**:
  - These keys are strictly dedicated to question-paper envelope encryption.
  - Future digital signature keys (Module 7) will use independent key pairs for distinct cryptographic domains.

---

## 7. Supabase Storage Structure

Encrypted question paper objects are stored in the existing private bucket:

- **Bucket**: `examguard-storage` (Private)
- **Object Path Hierarchy**:
  ```text
  question-papers/{teacher_id}/{question_paper_id}/encrypted/{sanitized_filename}.enc
  ```
- **Example**:
  ```text
  question-papers/22222222-2222-2222-2222-222222222222/7cd5e06d-884e-4c54-9644-43324be41897/encrypted/crypto_final.pdf.enc
  ```
- **MIME Type in Storage**: Uploaded with `Content-Type: application/pdf`, seamlessly matching the bucket's existing allowed MIME type configuration without requiring bucket modification.

---

## 8. Encryption Workflow (Submission Flow)

When an authenticated `TEACHER` posts a paper (`POST /api/question-papers`):

1. **Authentication & Authorization**: `authenticateToken` verifies JWT; `authorizeRoles('TEACHER')` enforces role.
2. **File & Metadata Validation**: Multer validates 10MB ceiling, `.pdf` extension, `application/pdf` MIME type, and `%PDF-` magic header bytes.
3. **In-Memory Encryption**: `encryptionService.encryptQuestionPaper(buffer)` generates a 32-byte AES key and 12-byte IV, encrypts the buffer using AES-256-GCM, extracts the 16-byte auth tag, and wraps the AES key using RSA-OAEP.
4. **Storage Ingestion**: The encrypted ciphertext is uploaded to `question-papers/{teacher_id}/{question_paper_id}/encrypted/{filename}.enc`.
5. **Database Transaction / Insertion**:
   - `question_papers`: Inserts metadata (`status: 'SUBMITTED'`, `storage_path` pointing to encrypted object).
   - `paper_keys`: Inserts `{ question_paper_id, encrypted_aes_key, iv, auth_tag }`.
   - `question_paper_assignments`: Inserts recipient record with `delivery_status: 'PENDING'`.
6. **Safe Response**: Returns paper metadata. Cryptographic keys and tags are completely omitted.

---

## 9. Decryption Workflow (Download Flow)

When an authorized authoring `TEACHER` requests their paper (`GET /api/question-papers/:id/download`):

1. **Authentication & Authorization**: `authenticateToken` + `authorizeRoles('TEACHER')`.
2. **Ownership Verification**: Confirms `paper.teacher_id === req.user.userId` (`403 Forbidden` if mismatched).
3. **Key Retrieval**: Queries `paper_keys` for `encrypted_aes_key`, `iv`, and `auth_tag`.
4. **Ciphertext Fetch**: Downloads encrypted `.enc` buffer from private Supabase Storage using server-side `service_role`.
5. **In-Memory Decryption**:
   - RSA private key unwraps `encrypted_aes_key` to recover the 32-byte DEK.
   - AES-256-GCM decipher decrypts ciphertext and authenticates the GCM auth tag.
6. **Decrypted Stream**: Decrypted PDF buffer is streamed directly to client HTTP response with:
   - `Content-Type: application/pdf`
   - `Content-Disposition: attachment; filename="${paper.file_name}"`
7. **Zero Plaintext Disk Writes**: Plaintext is streamed directly from RAM to the HTTP connection.

---

## 10. Compensating Rollback Handling

To guarantee database and storage consistency:

```text
[ Encrypt Buffer ] ──► [ Upload Storage ] ──► [ Insert question_papers ] ──► [ Insert paper_keys ] ──► [ Insert assignments ]
       │                      │                              │                            │                           │
  Fails: No Upload       Fails: Exit 502             Fails: Remove Storage       Fails: Clean Paper +       Fails: Clean All +
                                                                                    Remove Storage             Remove Storage
```

If database insertion into `question_papers`, `paper_keys`, or `question_paper_assignments` throws:
1. Created assignment records are deleted.
2. Created `paper_keys` records are deleted.
3. Created `question_papers` records are deleted.
4. `supabase.storage.from(bucket).remove([storagePath])` deletes the uploaded `.enc` file.
5. `500 Internal Server Error` returned without leaving orphaned storage objects or partial state.

---

## 11. Security Considerations

- **No Ciphertext Direct Download**: Browsers are never handed signed URLs directly to encrypted `.enc` files, preventing clients from receiving unusable raw ciphertext.
- **Timing & Tamper Defense**: Any modification to ciphertext, IV, auth tag, or wrapped key fails cryptographically via AES-GCM and throws a sanitized error without revealing cryptographic internals.
- **Log Sanitation**: Neither loggers nor error handlers output raw keys, PEM contents, IVs, or plaintext buffers.

---

## 12. Local Setup & Key Generation Command

To set up Module 6 on a fresh clone:

1. Ensure dependencies are installed:
   ```bash
   cd Backend
   npm install
   ```
2. Generate the dedicated RSA encryption key pair:
   ```bash
   node scripts/generateEncryptionKeys.js
   ```
3. Configure environment variables in `Backend/.env`:
   ```dotenv
   QUESTION_PAPER_ENCRYPTION_PUBLIC_KEY_PATH=keys/question-paper-encryption-public.pem
   QUESTION_PAPER_ENCRYPTION_PRIVATE_KEY_PATH=keys/question-paper-encryption-private.pem
   ```
4. Run the automated test suite:
   ```bash
   npm test
   ```

---

## 13. Supabase Configuration Changes Required

**NO CHANGES REQUIRED.**
- The existing private `examguard-storage` bucket continues to be used.
- Encrypted payloads are uploaded with `Content-Type: application/pdf`, fully satisfying the existing allowed MIME types configuration.
- The `paper_keys` table was already created in Module 2 (`database/schema.sql`). No SQL migrations are needed.

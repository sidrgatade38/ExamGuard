# Module 7: Digital Signature & Question Paper Integrity Verification

## 1. Digital Signature Purpose & Security Objectives
The purpose of Module 7 in **ExamGuard** is to provide cryptographic integrity, origin authenticity, and non-repudiation for all examination question papers stored in the system. While Module 6 implemented payload encryption (AES-256-GCM) and key wrapping (RSA-OAEP), Module 7 introduces digital signatures to guarantee that:
1. **Integrity**: The encrypted document stored in Supabase Storage has not been altered, truncated, corrupted, or tampered with by any party or process.
2. **Authenticity & Non-Repudiation**: The encrypted ciphertext was authored and approved through the authenticated authoring teacher's submission process.
3. **Tamper Detection**: Any modification—even altering a single bit in the stored ciphertext or in the signature metadata—is mathematically detected before document delivery.

---

## 2. Why Encrypted Ciphertext is Signed
In ExamGuard, the digital signature is computed directly over the **encrypted ciphertext buffer**, **never** over the plaintext PDF.

### Rationale:
1. **End-to-End Storage Protection**: The object stored in Supabase Storage is the encrypted ciphertext (`.../encrypted/*.enc`). By signing the exact bytes stored in the storage bucket, the signature verifies the exact artifact at rest.
2. **Verify-Before-Decrypt Pipeline**: When a question paper is requested for download, the system verifies the SHA-256 hash and RSA-PSS digital signature over the ciphertext **before** unwrapping the AES key or decrypting the payload. If the ciphertext has been tampered with, decryption is aborted immediately, preventing chosen-ciphertext attacks or malformed plaintext exposure.
3. **Zero Plaintext Leakage**: The signing and verification pipeline operates entirely on ciphertext, guaranteeing that cryptographic integrity can be asserted without ever exposing the underlying exam questions.

---

## 3. SHA-256 Cryptographic Hashing
Prior to signing and storage upload, ExamGuard computes the SHA-256 cryptographic hash of the ciphertext:
```javascript
const fileHash = crypto
  .createHash('sha256')
  .update(encryptedBuffer)
  .digest('hex');
```
- **Digest Format**: 64-character lowercase hexadecimal string.
- **Role**: Provides a fast, deterministic secondary integrity check against the `digital_signatures.file_hash` column.

---

## 4. RSA-PSS Digital Signature Algorithm
ExamGuard implements **RSA-PSS** (Probabilistic Signature Scheme) using SHA-256 as the digest algorithm:
- **Algorithm Standard**: RSA-PSS (RFC 8017 / PKCS #1 v2.2)
- **Hash Function**: SHA-256
- **Mask Generation Function (MGF1)**: SHA-256
- **Salt Length**: `crypto.constants.RSA_PSS_SALTLEN_DIGEST` (32 bytes for SHA-256)
- **Signature Output**: Base64-encoded string stored in `digital_signatures.signature`.

### Node.js Implementation:
```javascript
// Signing
const signer = crypto.createSign('sha256');
signer.update(encryptedBuffer);
signer.end();
const signature = signer.sign({
  key: privateKeyPem,
  padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
}).toString('base64');

// Verification
const verifier = crypto.createVerify('sha256');
verifier.update(encryptedBuffer);
verifier.end();
const isValid = verifier.verify({
  key: publicKeyPem,
  padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
  saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
}, Buffer.from(signature, 'base64'));
```

---

## 5. Dedicated Signing Key Pair
ExamGuard employs a dedicated RSA-2048 signing key pair located in `Backend/keys/`:
- **Public Key**: `keys/question-paper-signing-public.pem` (SPKI format, PEM)
- **Private Key**: `keys/question-paper-signing-private.pem` (PKCS#8 format, PEM)

### Generation:
Generated using the standalone CLI script:
```bash
node scripts/generateSigningKeys.js
```
The script enforces:
- Minimum 2048-bit modulus length.
- Accidental overwrite protection (requires explicit `--force` flag).
- Restrictive file permissions (`0600` for private key).
- Zero console printing of private key contents.

---

## 6. Cryptographic Key Separation (Module 6 vs Module 7)
A fundamental tenet of cryptographic engineering is **key separation**: a single key pair must never be used for both public-key encryption and digital signing.

| Dimension | Module 6 (Envelope Encryption) | Module 7 (Digital Signature) |
| :--- | :--- | :--- |
| **Purpose** | Symmetric AES-256 key wrapping | Ciphertext authenticity & integrity verification |
| **Algorithm** | RSA-OAEP with SHA-256 | RSA-PSS with SHA-256 |
| **Padding** | `RSA_PKCS1_OAEP_PADDING` | `RSA_PKCS1_PSS_PADDING` |
| **Public Key Path** | `keys/question-paper-encryption-public.pem` | `keys/question-paper-signing-public.pem` |
| **Private Key Path** | `keys/question-paper-encryption-private.pem` | `keys/question-paper-signing-private.pem` |
| **Cross-Usage** | Prohibited | Prohibited |

---

## 7. Submission Workflow (Signing Pipeline)
1. **Teacher Authentication & Validation**: Enforce `TEACHER` role and validate paper metadata + PDF magic bytes (`%PDF-`).
2. **In-Memory AES-256-GCM Encryption**: Generate unique 32-byte AES key and 12-byte IV; encrypt PDF buffer to produce ciphertext.
3. **RSA-OAEP Key Wrapping**: Encrypt the AES key with the Module 6 encryption public key.
4. **Compute SHA-256 Hash**: Hash the exact ciphertext buffer (`fileHash`).
5. **RSA-PSS Digital Signature**: Sign the ciphertext buffer with the Module 7 signing private key (`signature`).
6. **Upload Ciphertext to Private Supabase Storage**: Upload to `question-papers/{teacher_id}/{paper_id}/encrypted/{filename}.enc`.
7. **Database Transaction Persistence**:
   - Insert metadata into `question_papers`.
   - Insert key material into `paper_keys` (`encrypted_aes_key`, `iv`, `auth_tag`).
   - Insert signature record into `digital_signatures` (`algorithm: 'RSA-PSS-SHA256'`, `file_hash`, `signature`, `public_key_reference`).
   - Insert assignment record into `question_paper_assignments`.
8. **Compensating Rollback**: If any database insert fails, delete records from all tables and delete the uploaded object from Supabase Storage.

---

## 8. Verification Workflow (Standalone Endpoint)
Endpoint: `GET /api/question-papers/:id/verify-signature`
1. Authenticate user and verify that requester is the authoring `TEACHER`.
2. Retrieve `digital_signatures` record for the paper ID.
3. Download the stored ciphertext buffer from Supabase Storage.
4. Compute the current SHA-256 hash of the downloaded buffer.
5. Verify that `currentHash === storedRecord.file_hash`.
6. Verify the RSA-PSS digital signature over the buffer using the signing public key.
7. Return `{ success: true, data: { verified: true, algorithm: 'RSA-PSS-SHA256', fileHash, signedAt } }`.

---

## 9. Download Security (Verify-Before-Decrypt Pipeline)
Endpoint: `GET /api/question-papers/:id/download`
```
                    [ Download Request ]
                             ↓
              [ Ownership & Role Verification ]
                             ↓
           [ Download Ciphertext from Storage ]
                             ↓
            [ Retrieve digital_signatures Record ]
                             ↓
                 [ Compute SHA-256 Hash ]
                             ↓
             [ Hash == Stored Hash? ] ──(No)──→ [ 400 Bad Request: Tamper Detected ]
                             ↓ (Yes)
          [ Verify RSA-PSS Digital Signature ]
                             ↓
                 [ Signature Valid? ] ──(No)──→ [ 400 Bad Request: Tamper Detected ]
                             ↓ (Yes)
              [ Unwrap AES Key with RSA-OAEP ]
                             ↓
             [ Decrypt Payload via AES-256-GCM ]
                             ↓
                  [ Stream PDF to Owner ]
```
Decryption is **never** attempted if either the SHA-256 digest check or RSA-PSS signature check fails.

---

## 10. Tamper Detection Capabilities
The Module 7 cryptographic design detects and halts:
- **Bit-Flipping / Ciphertext Modification**: Any altered byte in storage immediately causes signature verification and hash comparison to fail.
- **Signature Swapping**: A signature from Paper A will fail on Paper B even if both were authored by the same teacher.
- **Corrupted Signatures**: Any malformed base64 or altered signature byte is rejected.
- **Key Substitution**: Verifying with any key other than the designated public key returns `false`.

---

## 11. Key Storage & Security Configuration
- Private signing keys are stored exclusively in `Backend/keys/` and configured via environment variables:
  - `QUESTION_PAPER_SIGNING_PUBLIC_KEY_PATH=keys/question-paper-signing-public.pem`
  - `QUESTION_PAPER_SIGNING_PRIVATE_KEY_PATH=keys/question-paper-signing-private.pem`
- Both root `.gitignore` and `Backend/.gitignore` ignore `keys/*.pem`, `*.pem`, and `*.key`.
- In-memory key caching loads the PEM file once and reuses it across requests.
- Private key material is never logged, printed, or included in API payloads.

---

## 12. Failure Handling
- **Missing / Corrupted Signing Key**: Rejects submission with 500 error before storage upload is attempted.
- **Ciphertext Hash Mismatch on Download**: Returns `400 Bad Request` with message `"Question paper integrity verification failed. Ciphertext hash mismatch."`
- **Invalid RSA-PSS Signature on Download**: Returns `400 Bad Request` with message `"Question paper digital signature verification failed. Encrypted document has been tampered with."`
- **Compensating Rollback**: Cleanly cascades deletions across `question_paper_assignments`, `digital_signatures`, `paper_keys`, `question_papers`, and Supabase Storage.

---

## 13. Automated Test Suite Results
Test suite: `Backend/scripts/verifyDigitalSignature.js`
- **Total Test Suites**: 6 suites (`verifyAuth.js`, `testServiceLogic.js`, `verifyRbac.js`, `verifyQuestionPaper.js`, `verifyEncryption.js`, `verifyDigitalSignature.js`)
- **Total Tests / Assertions**: 205
- **Passed**: 205
- **Failed**: 0

---

## 14. Supabase Configuration Audit
- **Database Schema**: The existing `digital_signatures` table in `database/schema.sql` completely supports Module 7 as originally designed.
- **Manual SQL Migrations Required**: **NONE**.
- **Supabase Storage Bucket**: `examguard-storage` (private).

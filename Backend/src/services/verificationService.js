/**
 * ExamGuard - Cryptographic Verification & Decryption Service (Module 11)
 *
 * Formalizes, hardens, and unifies the server-side verification and decryption workflow
 * for both Question Papers and Answer Keys:
 *
 * Mandatory Canonical Order (Verify-Before-Decrypt):
 *   1. Storage: Download ciphertext / encrypted envelope from private storage
 *   2. SHA-256: Compute SHA-256 hash over exact storage bytes
 *   3. Hash Check: Compare computed SHA-256 hash against stored digest
 *      --> FAIL-CLOSED on mismatch: stop immediately, NO key unwrap, NO decryption
 *   4. RSA-PSS: Verify RSA-PSS digital signature over exact storage bytes
 *      --> FAIL-CLOSED on invalid signature: stop immediately, NO key unwrap, NO decryption
 *   5. Key Retrieval: Retrieve wrapped AES DEK (from paper_keys for Question Papers,
 *      or from the 284-byte header for Answer Keys)
 *   6. RSA-OAEP: Unwrap AES document key using dedicated wrapping private key
 *      --> FAIL-CLOSED on unwrap error or invalid key size (must be exactly 32 bytes)
 *   7. AES-256-GCM: Decrypt ciphertext payload and authenticate 16-byte GCM tag
 *      --> FAIL-CLOSED on GCM tag mismatch / tampering
 *   8. Memory Safety: Zeroize sensitive temporary key buffers
 *   9. Deliver: Return authenticated decrypted PDF to authorized caller
 *
 * Reuses existing services:
 * - encryptionService
 * - keyManagementService
 * - signatureService
 * Does NOT duplicate cryptographic primitives.
 */

const crypto = require('crypto');
const encryptionService = require('./encryptionService');
const keyManagementService = require('./keyManagementService');
const signatureService = require('./signatureService');

/**
 * Safely wipes sensitive key material buffer from memory by filling with zeros.
 *
 * @param {Buffer} buf - Sensitive buffer to zeroize
 */
function zeroizeBuffer(buf) {
  if (Buffer.isBuffer(buf)) {
    buf.fill(0);
  }
}

/**
 * Verifies SHA-256 integrity of exact ciphertext bytes against stored expected digest.
 *
 * @param {Buffer} ciphertextBuffer - Raw ciphertext or envelope bytes from storage
 * @param {string} expectedHash - 64-character lowercase hexadecimal hash
 * @returns {{ valid: boolean, calculatedHash: string, expectedHash: string }}
 */
function verifyCiphertextIntegrity(ciphertextBuffer, expectedHash) {
  if (!Buffer.isBuffer(ciphertextBuffer) || ciphertextBuffer.length === 0) {
    const err = new Error('Invalid ciphertext buffer for integrity verification: expected non-empty Buffer.');
    err.statusCode = 400;
    throw err;
  }

  if (!expectedHash || typeof expectedHash !== 'string' || expectedHash.trim().length === 0) {
    const err = new Error('Invalid expected file hash: expected non-empty string.');
    err.statusCode = 400;
    throw err;
  }

  const calculatedHash = signatureService.calculateSha256(ciphertextBuffer);
  const normalizedExpected = expectedHash.trim().toLowerCase();
  const normalizedCalculated = calculatedHash.toLowerCase();

  const isValid = normalizedCalculated === normalizedExpected;

  return {
    valid: isValid,
    calculatedHash: normalizedCalculated,
    expectedHash: normalizedExpected,
  };
}

/**
 * Verifies RSA-PSS digital signature over exact ciphertext bytes.
 *
 * @param {Buffer} ciphertextBuffer - Raw ciphertext or envelope bytes
 * @param {string} signatureBase64 - Base64-encoded RSA-PSS signature
 * @param {string} [customPublicKeyPem=null] - Optional custom public signing key PEM
 * @returns {boolean} True if signature is valid, false otherwise
 */
function verifyDigitalSignature(ciphertextBuffer, signatureBase64, customPublicKeyPem = null) {
  if (!Buffer.isBuffer(ciphertextBuffer) || ciphertextBuffer.length === 0) {
    return false;
  }

  if (!signatureBase64 || typeof signatureBase64 !== 'string' || signatureBase64.trim().length === 0) {
    return false;
  }

  return signatureService.verifyQuestionPaperSignature(
    ciphertextBuffer,
    signatureBase64,
    customPublicKeyPem
  );
}

/**
 * Unwraps an encrypted AES-256 document key using RSA-OAEP with SHA-256.
 * Enforces strict 32-byte key length validation. Fails closed on any error.
 *
 * @param {string|Buffer} wrappedKey - Base64 string or Buffer of wrapped AES key
 * @param {string} [customPrivateKeyPem=null] - Optional custom private wrapping key PEM
 * @returns {Buffer} 32-byte plaintext AES DEK
 */
function unwrapDocumentKey(wrappedKey, customPrivateKeyPem = null) {
  if (!wrappedKey) {
    const err = new Error('Wrapped AES key is required for unwrapping.');
    err.statusCode = 400;
    throw err;
  }

  let aesKey;
  try {
    aesKey = keyManagementService.unwrapAesKey(wrappedKey, customPrivateKeyPem);
  } catch (unwrapErr) {
    const safeErr = new Error('Failed to unwrap encryption key: invalid or tampered key material.');
    safeErr.statusCode = 400;
    throw safeErr;
  }

  if (!keyManagementService.validateKeySize(aesKey)) {
    zeroizeBuffer(aesKey);
    const err = new Error('Decrypted AES key length is invalid. Expected 32 bytes.');
    err.statusCode = 400;
    throw err;
  }

  return aesKey;
}

/**
 * Decrypts an AES-256-GCM payload and verifies the 16-byte authentication tag.
 * Wipes the temporary AES key buffer upon completion.
 *
 * @param {Buffer} ciphertextBuffer - Encrypted payload buffer
 * @param {Buffer} aesKey - 32-byte plaintext AES key
 * @param {string|Buffer} iv - 12-byte IV (Base64 string or Buffer)
 * @param {string|Buffer} authTag - 16-byte GCM authentication tag (Base64 string or Buffer)
 * @returns {Buffer} Authenticated plaintext PDF buffer
 */
function decryptPayload(ciphertextBuffer, aesKey, iv, authTag) {
  if (!Buffer.isBuffer(ciphertextBuffer) || ciphertextBuffer.length === 0) {
    const err = new Error('Invalid or missing ciphertext buffer.');
    err.statusCode = 400;
    throw err;
  }

  if (!Buffer.isBuffer(aesKey) || aesKey.length !== 32) {
    const err = new Error('Invalid AES key for decryption. Expected a 32-byte Buffer.');
    err.statusCode = 400;
    throw err;
  }

  const ivBuffer = Buffer.isBuffer(iv) ? iv : Buffer.from(iv, 'base64');
  const authTagBuffer = Buffer.isBuffer(authTag) ? authTag : Buffer.from(authTag, 'base64');

  if (ivBuffer.length !== 12) {
    const err = new Error('Invalid IV length. Expected 12 bytes.');
    err.statusCode = 400;
    throw err;
  }

  if (authTagBuffer.length !== 16) {
    const err = new Error('Invalid authentication tag length. Expected 16 bytes.');
    err.statusCode = 400;
    throw err;
  }

  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, ivBuffer);
    decipher.setAuthTag(authTagBuffer);
    const decryptedBuffer = Buffer.concat([decipher.update(ciphertextBuffer), decipher.final()]);
    return decryptedBuffer;
  } catch (err) {
    // Fail-closed on GCM tag verification failure or corrupted ciphertext
    const tamperErr = new Error(
      'Decryption failed: cryptographic integrity check failed. The file or key material has been modified or corrupted.'
    );
    tamperErr.statusCode = 400;
    throw tamperErr;
  } finally {
    // Best-effort memory cleanup of sensitive key material
    zeroizeBuffer(aesKey);
  }
}

/**
 * Enforces the full Verify-Before-Decrypt workflow for a Question Paper.
 * 
 * Order of operations:
 *   1. Calculate SHA-256 hash of ciphertextBuffer
 *   2. Compare with sigRecord.file_hash --> fail closed if mismatch (400)
 *   3. Verify RSA-PSS signature over ciphertextBuffer --> fail closed if invalid (400)
 *   4. RSA-OAEP unwrap keyRecord.encrypted_aes_key --> fail closed if corrupted (400)
 *   5. Decrypt ciphertextBuffer with AES-256-GCM using keyRecord.iv and keyRecord.auth_tag
 *   6. Validate GCM auth tag --> fail closed if authentication fails (400)
 *   7. Return plaintext Buffer
 *
 * @param {Object} params
 * @param {Buffer} params.ciphertextBuffer - Encrypted question paper buffer
 * @param {Object} [params.sigRecord] - Digital signature database record
 * @param {Object} [params.keyRecord] - Paper keys database record
 * @param {string} [params.customPrivateKeyPem] - Optional custom private wrapping key
 * @param {string} [params.customPublicKeyPem] - Optional custom public signing key
 * @returns {Buffer} Decrypted plaintext PDF buffer
 */
function verifyAndDecryptQuestionPaper({
  ciphertextBuffer,
  sigRecord,
  keyRecord,
  customPrivateKeyPem = null,
  customPublicKeyPem = null,
}) {
  if (!Buffer.isBuffer(ciphertextBuffer) || ciphertextBuffer.length === 0) {
    const err = new Error('Invalid or missing question paper ciphertext buffer.');
    err.statusCode = 400;
    throw err;
  }

  // 1. STEP 1 & 2: SHA-256 Integrity Verification
  if (sigRecord && sigRecord.file_hash) {
    const integrityResult = verifyCiphertextIntegrity(ciphertextBuffer, sigRecord.file_hash);
    if (!integrityResult.valid) {
      const err = new Error('Question paper integrity verification failed. Ciphertext hash mismatch.');
      err.statusCode = 400;
      throw err;
    }
  }

  // 2. STEP 3 & 4: RSA-PSS Digital Signature Verification
  if (sigRecord && sigRecord.signature) {
    const isSignatureValid = verifyDigitalSignature(
      ciphertextBuffer,
      sigRecord.signature,
      customPublicKeyPem
    );
    if (!isSignatureValid) {
      const err = new Error(
        'Question paper digital signature verification failed. Encrypted document has been tampered with.'
      );
      err.statusCode = 400;
      throw err;
    }
  }

  // 3. STEP 5: Check if document is encrypted with envelope keys
  if (!keyRecord) {
    // Legacy unencrypted paper (Module 5 backward compatibility)
    return ciphertextBuffer;
  }

  // 4. STEP 6: RSA-OAEP Key Unwrapping (Executed ONLY after successful hash & signature checks)
  const aesKey = unwrapDocumentKey(keyRecord.encrypted_aes_key, customPrivateKeyPem);

  // 5. STEP 7: AES-256-GCM Decryption and Authentication Tag Verification
  return decryptPayload(ciphertextBuffer, aesKey, keyRecord.iv, keyRecord.auth_tag);
}

/**
 * Enforces the full Verify-Before-Decrypt workflow for an Answer Key.
 *
 * The Answer Key uses the self-contained 284-byte encrypted envelope header:
 *   [256-byte RSA-OAEP wrapped AES DEK] [12-byte IV] [16-byte AuthTag] [Ciphertext...]
 *
 * Order of operations:
 *   1. Calculate SHA-256 hash of envelopeBuffer
 *   2. Compare with sigRecord.file_hash --> fail closed if mismatch (400)
 *   3. Verify RSA-PSS signature over envelopeBuffer --> fail closed if invalid (400)
 *   4. Extract envelope header components
 *   5. RSA-OAEP unwrap AES DEK --> fail closed if corrupted (400)
 *   6. Decrypt ciphertext payload with AES-256-GCM and authenticate GCM tag
 *   7. Return plaintext Buffer
 *
 * @param {Object} params
 * @param {Buffer} params.envelopeBuffer - Full encrypted envelope buffer from storage
 * @param {Object} [params.sigRecord] - Digital signature database record
 * @param {string} [params.customPrivateKeyPem] - Optional custom private wrapping key
 * @param {string} [params.customPublicKeyPem] - Optional custom public signing key
 * @returns {Buffer} Decrypted plaintext PDF buffer
 */
function verifyAndDecryptAnswerKey({
  envelopeBuffer,
  sigRecord,
  customPrivateKeyPem = null,
  customPublicKeyPem = null,
}) {
  if (!Buffer.isBuffer(envelopeBuffer) || envelopeBuffer.length === 0) {
    const err = new Error('Invalid or missing answer key envelope buffer.');
    err.statusCode = 400;
    throw err;
  }

  // 1. STEP 1 & 2: SHA-256 Integrity Verification over exact storage bytes
  if (sigRecord && sigRecord.file_hash) {
    const integrityResult = verifyCiphertextIntegrity(envelopeBuffer, sigRecord.file_hash);
    if (!integrityResult.valid) {
      const err = new Error('Answer key integrity verification failed. Ciphertext hash mismatch.');
      err.statusCode = 400;
      throw err;
    }
  }

  // 2. STEP 3 & 4: RSA-PSS Digital Signature Verification over exact storage bytes
  if (sigRecord && sigRecord.signature) {
    const isSignatureValid = verifyDigitalSignature(
      envelopeBuffer,
      sigRecord.signature,
      customPublicKeyPem
    );
    if (!isSignatureValid) {
      const err = new Error(
        'Answer key digital signature verification failed. Encrypted document has been tampered with.'
      );
      err.statusCode = 400;
      throw err;
    }
  }

  // 3. STEP 5: Validate 284-byte Envelope Header
  const HEADER_SIZE = 256 + 12 + 16; // 284 bytes
  if (envelopeBuffer.length < HEADER_SIZE) {
    const corruptErr = new Error('Corrupted answer key envelope. Buffer smaller than cryptographic header.');
    corruptErr.statusCode = 400;
    throw corruptErr;
  }

  const wrappedKeyBuf = envelopeBuffer.subarray(0, 256);
  const ivBuf = envelopeBuffer.subarray(256, 268);
  const authTagBuf = envelopeBuffer.subarray(268, 284);
  const ciphertextBuf = envelopeBuffer.subarray(284);

  // 4. STEP 6: RSA-OAEP Key Unwrapping (Executed ONLY after verification passes)
  const wrappedKeyBase64 = wrappedKeyBuf.toString('base64');
  let aesKey;
  try {
    aesKey = unwrapDocumentKey(wrappedKeyBase64, customPrivateKeyPem);
  } catch (unwrapErr) {
    const err = new Error('Answer key key-unwrapping failed: cryptographic envelope is corrupted or invalid.');
    err.statusCode = 400;
    throw err;
  }

  // 5. STEP 7: AES-256-GCM Decryption and Authentication Tag Verification
  return decryptPayload(ciphertextBuf, aesKey, ivBuf, authTagBuf);
}

/**
 * Evaluates Question Paper integrity and RSA-PSS signature without decrypting.
 *
 * @param {Object} params
 * @param {Buffer} params.ciphertextBuffer - Encrypted question paper buffer
 * @param {Object} params.sigRecord - Digital signature record
 * @param {string} [params.customPublicKeyPem] - Optional custom public signing key
 * @returns {Object} Safe verification summary
 */
function verifyQuestionPaperIntegrityOnly({
  ciphertextBuffer,
  sigRecord,
  customPublicKeyPem = null,
}) {
  if (!Buffer.isBuffer(ciphertextBuffer) || ciphertextBuffer.length === 0) {
    return {
      verified: false,
      tamperDetected: true,
      error: 'Invalid or empty ciphertext buffer.',
    };
  }

  if (!sigRecord) {
    return {
      verified: false,
      tamperDetected: false,
      message: 'No digital signature record exists for this question paper.',
    };
  }

  const currentHash = signatureService.calculateSha256(ciphertextBuffer);
  const hashMatches = currentHash.toLowerCase() === (sigRecord.file_hash || '').toLowerCase();
  const isSignatureValid = verifyDigitalSignature(
    ciphertextBuffer,
    sigRecord.signature,
    customPublicKeyPem
  );

  const isVerified = isSignatureValid && hashMatches;

  return {
    verified: isVerified,
    tamperDetected: !isVerified,
    algorithm: sigRecord.algorithm || 'RSA-PSS-SHA256',
    fileHash: currentHash,
    storedHash: sigRecord.file_hash,
    signedAt: sigRecord.created_at,
    publicKeyReference: sigRecord.public_key_reference,
  };
}

/**
 * Evaluates Answer Key integrity and RSA-PSS signature without decrypting.
 *
 * @param {Object} params
 * @param {Buffer} params.envelopeBuffer - Encrypted answer key envelope buffer
 * @param {Object} params.sigRecord - Digital signature record
 * @param {string} [params.customPublicKeyPem] - Optional custom public signing key
 * @returns {Object} Safe verification summary
 */
function verifyAnswerKeyIntegrityOnly({
  envelopeBuffer,
  sigRecord,
  customPublicKeyPem = null,
}) {
  if (!Buffer.isBuffer(envelopeBuffer) || envelopeBuffer.length === 0) {
    return {
      verified: false,
      tamperDetected: true,
      error: 'Invalid or empty answer key envelope buffer.',
    };
  }

  if (!sigRecord) {
    return {
      verified: false,
      tamperDetected: false,
      message: 'No digital signature record exists for this answer key.',
    };
  }

  const currentHash = signatureService.calculateSha256(envelopeBuffer);
  const hashMatches = currentHash.toLowerCase() === (sigRecord.file_hash || '').toLowerCase();
  const isSignatureValid = verifyDigitalSignature(
    envelopeBuffer,
    sigRecord.signature,
    customPublicKeyPem
  );

  const isVerified = isSignatureValid && hashMatches;

  return {
    verified: isVerified,
    tamperDetected: !isVerified,
    algorithm: sigRecord.algorithm || 'RSA-PSS-SHA256',
    fileHash: currentHash,
    storedHash: sigRecord.file_hash,
    signedAt: sigRecord.created_at,
    publicKeyReference: sigRecord.public_key_reference,
  };
}

module.exports = {
  zeroizeBuffer,
  verifyCiphertextIntegrity,
  verifyDigitalSignature,
  unwrapDocumentKey,
  decryptPayload,
  verifyAndDecryptQuestionPaper,
  verifyAndDecryptAnswerKey,
  verifyQuestionPaperIntegrityOnly,
  verifyAnswerKeyIntegrityOnly,
};

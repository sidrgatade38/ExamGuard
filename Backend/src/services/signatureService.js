/**
 * ExamGuard - Cryptographic Digital Signature & Integrity Service (Module 7)
 * 
 * Implements digital signature creation, verification, and tamper detection:
 * 1. Payload: Signs the exact encrypted ciphertext buffer (never plaintext PDF or keys).
 * 2. Hash Algorithm: SHA-256 producing a 64-character hexadecimal digest.
 * 3. Signature Algorithm: RSA-PSS with SHA-256 and RSA_PSS_SALTLEN_DIGEST.
 * 4. Key Management: Uses a dedicated RSA-2048 signing key pair strictly separated from Module 6 encryption keys.
 * 5. Zero Secrets Leakage: Private signing keys are never exposed in responses or logged.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// In-memory key cache for fast repeated operations
let cachedPublicKey = null;
let cachedPrivateKey = null;

const { resolveKeyPath } = require('../config/keyProvisioner');

/**
 * Loads the RSA public key for digital signature verification.
 * @returns {string} Public key in PEM format
 */
function getSigningPublicKey() {
  if (cachedPublicKey) return cachedPublicKey;
  const keyPath = resolveKeyPath(config.signing?.publicKeyPath || 'keys/question-paper-signing-public.pem');
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new Error(
      `Question paper digital signing public key not found. Run "node scripts/generateSigningKeys.js" to create signing keys.`
    );
  }
  cachedPublicKey = fs.readFileSync(keyPath, 'utf8');
  return cachedPublicKey;
}

/**
 * Loads the RSA private key for digital signature creation.
 * @returns {string} Private key in PEM format
 */
function getSigningPrivateKey() {
  if (cachedPrivateKey) return cachedPrivateKey;
  const keyPath = resolveKeyPath(config.signing?.privateKeyPath || 'keys/question-paper-signing-private.pem');
  if (!keyPath || !fs.existsSync(keyPath)) {
    throw new Error(
      `Question paper digital signing private key not found. Run "node scripts/generateSigningKeys.js" to create signing keys.`
    );
  }
  cachedPrivateKey = fs.readFileSync(keyPath, 'utf8');
  return cachedPrivateKey;
}

/**
 * Clears the in-memory cached signing keys (useful for testing).
 */
function clearKeyCache() {
  cachedPublicKey = null;
  cachedPrivateKey = null;
}

/**
 * Computes the SHA-256 cryptographic hash of a given Buffer.
 *
 * @param {Buffer} buffer - Data buffer
 * @returns {string} 64-character lowercase hexadecimal hash
 */
function calculateSha256(buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Invalid input for SHA-256 calculation: expected Buffer.');
  }
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Generates an RSA-PSS digital signature over the encrypted question paper ciphertext buffer.
 *
 * @param {Buffer} encryptedBuffer - Encrypted question paper ciphertext
 * @param {string} [customPrivateKeyPem] - Optional custom private key PEM
 * @returns {{ signature: string, fileHash: string, algorithm: string, publicKeyReference: string }}
 */
function signQuestionPaper(encryptedBuffer, customPrivateKeyPem = null) {
  if (!Buffer.isBuffer(encryptedBuffer) || encryptedBuffer.length === 0) {
    throw new Error('Invalid encrypted buffer. Expected a non-empty Buffer for digital signing.');
  }

  const privateKey = customPrivateKeyPem || getSigningPrivateKey();

  // Compute SHA-256 digest of ciphertext
  const fileHash = calculateSha256(encryptedBuffer);

  // Generate RSA-PSS signature with SHA-256
  const signer = crypto.createSign('sha256');
  signer.update(encryptedBuffer);
  signer.end();

  const signature = signer.sign({
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
  }).toString('base64');

  return {
    signature,
    fileHash,
    algorithm: 'RSA-PSS-SHA256',
    publicKeyReference: 'question-paper-signing-public.pem',
  };
}

/**
 * Verifies an RSA-PSS digital signature over an encrypted question paper ciphertext buffer.
 *
 * @param {Buffer} encryptedBuffer - Encrypted ciphertext buffer
 * @param {string} signatureBase64 - Base64-encoded signature
 * @param {string} [customPublicKeyPem] - Optional custom public key PEM
 * @returns {boolean} True if signature is cryptographically valid, false otherwise
 */
function verifyQuestionPaperSignature(encryptedBuffer, signatureBase64, customPublicKeyPem = null) {
  if (!Buffer.isBuffer(encryptedBuffer) || encryptedBuffer.length === 0) {
    return false;
  }
  if (!signatureBase64 || typeof signatureBase64 !== 'string') {
    return false;
  }

  try {
    const publicKey = customPublicKeyPem || getSigningPublicKey();
    const verifier = crypto.createVerify('sha256');
    verifier.update(encryptedBuffer);
    verifier.end();

    const signatureBuffer = Buffer.from(signatureBase64, 'base64');
    return verifier.verify(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
        saltLength: crypto.constants.RSA_PSS_SALTLEN_DIGEST,
      },
      signatureBuffer
    );
  } catch (err) {
    // Return false on malformed keys, invalid padding, or corrupted signature bytes
    return false;
  }
}

module.exports = {
  calculateSha256,
  signQuestionPaper,
  verifyQuestionPaperSignature,
  getSigningPublicKey,
  getSigningPrivateKey,
  clearKeyCache,
};

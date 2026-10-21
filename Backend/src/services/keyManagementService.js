/**
 * ExamGuard - Secure Key Management Service (Module 8)
 * 
 * Implements server-side envelope key management for Question Papers:
 * 1. Document Key Generation: Generates cryptographically secure, unique 32-byte (256-bit)
 *    random AES keys and 12-byte IVs for each question paper using crypto.randomBytes.
 * 2. Key Wrapping (Key Encapsulation): Wraps the document AES key using RSA-OAEP with SHA-256
 *    using a dedicated RSA-2048 public key.
 * 3. Key Unwrapping: Recovers the document AES key server-side using the private wrapping key.
 *    Validates exact 32-byte length and fails closed on corrupted or tampered key material.
 * 4. Key Separation: Strictly separates the key-wrapping infrastructure from the Module 7
 *    RSA-PSS signing key pair. The signing key is NEVER used for AES key wrapping.
 * 5. In-Memory Caching: Safely caches wrapping keys in process memory to minimize filesystem I/O.
 * 6. Zero Secrets Leakage: Plaintext AES keys and RSA private keys are NEVER persisted to the database,
 *    stored in Supabase Storage, returned by APIs, or emitted in log statements.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// In-memory key cache for fast repeated operations
let cachedWrappingPublicKey = null;
let cachedWrappingPrivateKey = null;

const { resolveKeyPath } = require('../config/keyProvisioner');

/**
 * Loads the RSA public key for question paper key wrapping.
 * Searches configured path, dedicated wrapping key path, and fallback encryption key path.
 *
 * @returns {string} Public key in PEM format
 */
function getWrappingPublicKey() {
  if (cachedWrappingPublicKey) return cachedWrappingPublicKey;

  // 1. Check explicit configuration
  let keyPath = resolveKeyPath(config.keyWrapping?.publicKeyPath || config.encryption?.publicKeyPath);

  // 2. If not found at configured path, check standard locations
  if (!keyPath || !fs.existsSync(keyPath)) {
    const dedicatedWrappingPath = resolveKeyPath('keys/question-paper-key-wrapping-public.pem');
    const existingEncryptionPath = resolveKeyPath('keys/question-paper-encryption-public.pem');

    if (dedicatedWrappingPath && fs.existsSync(dedicatedWrappingPath)) {
      keyPath = dedicatedWrappingPath;
    } else if (existingEncryptionPath && fs.existsSync(existingEncryptionPath)) {
      keyPath = existingEncryptionPath;
    }
  }

  if (!keyPath || !fs.existsSync(keyPath)) {
    const err = new Error(
      `Question paper key wrapping public key not found. Run "node scripts/generateKeyWrappingKeys.js" to create keys.`
    );
    err.statusCode = 500;
    throw err;
  }

  cachedWrappingPublicKey = fs.readFileSync(keyPath, 'utf8');
  return cachedWrappingPublicKey;
}

/**
 * Loads the RSA private key for question paper key unwrapping.
 * Searches configured path, dedicated wrapping key path, and fallback encryption key path.
 *
 * @returns {string} Private key in PEM format
 */
function getWrappingPrivateKey() {
  if (cachedWrappingPrivateKey) return cachedWrappingPrivateKey;

  // 1. Check explicit configuration
  let keyPath = resolveKeyPath(config.keyWrapping?.privateKeyPath || config.encryption?.privateKeyPath);

  // 2. If not found at configured path, check standard locations
  if (!keyPath || !fs.existsSync(keyPath)) {
    const dedicatedWrappingPath = resolveKeyPath('keys/question-paper-key-wrapping-private.pem');
    const existingEncryptionPath = resolveKeyPath('keys/question-paper-encryption-private.pem');

    if (dedicatedWrappingPath && fs.existsSync(dedicatedWrappingPath)) {
      keyPath = dedicatedWrappingPath;
    } else if (existingEncryptionPath && fs.existsSync(existingEncryptionPath)) {
      keyPath = existingEncryptionPath;
    }
  }

  if (!keyPath || !fs.existsSync(keyPath)) {
    const err = new Error(
      `Question paper key wrapping private key not found. Run "node scripts/generateKeyWrappingKeys.js" to create keys.`
    );
    err.statusCode = 500;
    throw err;
  }

  cachedWrappingPrivateKey = fs.readFileSync(keyPath, 'utf8');
  return cachedWrappingPrivateKey;
}

/**
 * Clears the in-memory cached wrapping keys (useful for testing and key reload).
 */
function clearWrappingKeyCache() {
  cachedWrappingPublicKey = null;
  cachedWrappingPrivateKey = null;
}

/**
 * Generates a cryptographically secure random 32-byte (256-bit) AES document encryption key.
 * Strictly uses crypto.randomBytes (never derived from user metadata, filenames, or Math.random).
 *
 * @returns {Buffer} 32-byte AES key Buffer
 */
function generateDocumentKey() {
  const key = crypto.randomBytes(32);
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw new Error('Key generation failed: invalid document key produced.');
  }
  return key;
}

/**
 * Generates a cryptographically secure random 12-byte (96-bit) initialization vector (IV) for AES-GCM.
 *
 * @returns {Buffer} 12-byte IV Buffer
 */
function generateIv() {
  const iv = crypto.randomBytes(12);
  if (!Buffer.isBuffer(iv) || iv.length !== 12) {
    throw new Error('IV generation failed: invalid IV produced.');
  }
  return iv;
}

/**
 * Wraps (encrypts) an AES-256 document key using RSA-OAEP with SHA-256.
 *
 * @param {Buffer} aesKeyBuffer - 32-byte plaintext AES key
 * @param {string} [customPublicKeyPem] - Optional custom public key PEM (for testing)
 * @returns {string} Base64-encoded encrypted AES key
 */
function wrapDocumentKey(aesKeyBuffer, customPublicKeyPem = null) {
  if (!Buffer.isBuffer(aesKeyBuffer) || aesKeyBuffer.length !== 32) {
    const err = new Error('Invalid AES key for wrapping. Expected a 32-byte Buffer.');
    err.statusCode = 400;
    throw err;
  }

  const publicKey = customPublicKeyPem || getWrappingPublicKey();

  try {
    const wrappedBuffer = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      aesKeyBuffer
    );

    return wrappedBuffer.toString('base64');
  } catch (err) {
    const wrapErr = new Error(`Key wrapping failed: ${err.message}`);
    wrapErr.statusCode = 500;
    throw wrapErr;
  }
}

/**
 * Unwraps (decrypts) an encrypted AES-256 document key using RSA-OAEP with SHA-256.
 * Enforces fail-closed security: any corruption, wrong private key, or size mismatch
 * throws a safe error and aborts recovery.
 *
 * @param {string} encryptedAesKeyBase64 - Base64-encoded wrapped AES key
 * @param {string} [customPrivateKeyPem] - Optional custom private key PEM (for testing)
 * @returns {Buffer} 32-byte plaintext AES key Buffer
 */
function unwrapDocumentKey(encryptedAesKey, customPrivateKeyPem = null) {
  let encryptedBuffer;
  if (Buffer.isBuffer(encryptedAesKey)) {
    encryptedBuffer = encryptedAesKey;
  } else if (typeof encryptedAesKey === 'string' && encryptedAesKey.trim().length > 0) {
    encryptedBuffer = Buffer.from(encryptedAesKey, 'base64');
  } else {
    const err = new Error('Invalid encrypted AES key format. Expected non-empty Base64 string or Buffer.');
    err.statusCode = 400;
    throw err;
  }

  const privateKey = customPrivateKeyPem || getWrappingPrivateKey();

  if (encryptedBuffer.length === 0) {
    const err = new Error('Invalid encrypted AES key: empty buffer after decoding.');
    err.statusCode = 400;
    throw err;
  }

  try {
    const aesKey = crypto.privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      encryptedBuffer
    );

    if (aesKey.length !== 32) {
      const err = new Error('Decrypted AES key length is invalid. Expected 32 bytes.');
      err.statusCode = 400;
      throw err;
    }

    return aesKey;
  } catch (err) {
    // Fail closed without revealing cryptographic internals
    const unwrapErr = new Error('Failed to unwrap encryption key: invalid or tampered key material.');
    unwrapErr.statusCode = 400;
    throw unwrapErr;
  }
}

/**
 * Validates that an AES key buffer satisfies strict 32-byte AES-256 requirements.
 *
 * @param {Buffer} keyBuffer
 * @returns {boolean}
 */
function validateKeySize(keyBuffer) {
  return Buffer.isBuffer(keyBuffer) && keyBuffer.length === 32;
}

module.exports = {
  generateDocumentKey,
  generateIv,
  wrapDocumentKey,
  unwrapDocumentKey,
  wrapAesKey: wrapDocumentKey,
  unwrapAesKey: unwrapDocumentKey,
  getWrappingPublicKey,
  getWrappingPrivateKey,
  clearWrappingKeyCache,
  validateKeySize,
};

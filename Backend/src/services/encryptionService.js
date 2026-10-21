/**
 * ExamGuard - Cryptographic Encryption & Key Management Service (Module 6)
 * 
 * Implements envelope encryption for Question Papers:
 * 1. Payload Encryption: AES-256-GCM with a unique, cryptographically random 32-byte data encryption key (DEK)
 *    and a random 12-byte initialization vector (IV).
 * 2. Key Wrapping: The DEK is encrypted using RSA-OAEP with SHA-256 using a dedicated RSA-2048 public key.
 * 3. Integrity & Authentication: AES-256-GCM generates a 16-byte authentication tag ensuring ciphertext integrity.
 *    Any tampering with ciphertext, IV, or auth tag causes decryption to fail.
 * 4. Zero Secrets Leakage: Plaintext AES keys and RSA private keys are never stored on disk, returned to clients,
 *    or printed to logs.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const keyManagementService = require('./keyManagementService');

/**
 * Loads the RSA public key for question paper key wrapping.
 * @returns {string} Public key in PEM format
 */
function getPublicKey() {
  return keyManagementService.getWrappingPublicKey();
}

/**
 * Loads the RSA private key for question paper key unwrapping.
 * @returns {string} Private key in PEM format
 */
function getPrivateKey() {
  return keyManagementService.getWrappingPrivateKey();
}

/**
 * Clears the in-memory cached keys (useful for testing).
 */
function clearKeyCache() {
  keyManagementService.clearWrappingKeyCache();
}

/**
 * Generates a cryptographically secure random 32-byte (256-bit) AES key.
 * @returns {Buffer}
 */
function generateDataEncryptionKey() {
  return keyManagementService.generateDocumentKey();
}

/**
 * Generates a cryptographically secure random 12-byte (96-bit) IV for AES-GCM.
 * @returns {Buffer}
 */
function generateIv() {
  return keyManagementService.generateIv();
}

/**
 * Wraps (encrypts) an AES-256 data encryption key using RSA-OAEP with SHA-256.
 *
 * @param {Buffer} aesKeyBuffer - 32-byte AES key
 * @param {string} [customPublicKeyPem] - Optional custom public key PEM
 * @returns {string} Base64-encoded encrypted AES key
 */
function wrapAesKey(aesKeyBuffer, customPublicKeyPem = null) {
  return keyManagementService.wrapDocumentKey(aesKeyBuffer, customPublicKeyPem);
}

/**
 * Unwraps (decrypts) an encrypted AES-256 key using RSA-OAEP with SHA-256.
 *
 * @param {string} encryptedAesKeyBase64 - Base64-encoded wrapped AES key
 * @param {string} [customPrivateKeyPem] - Optional custom private key PEM
 * @returns {Buffer} 32-byte plaintext AES key
 */
function unwrapAesKey(encryptedAesKeyBase64, customPrivateKeyPem = null) {
  return keyManagementService.unwrapDocumentKey(encryptedAesKeyBase64, customPrivateKeyPem);
}

/**
 * Encrypts a question paper buffer using envelope encryption (AES-256-GCM + RSA-OAEP).
 *
 * @param {Buffer} plaintextBuffer - Raw question paper PDF buffer
 * @param {string} [customPublicKeyPem] - Optional custom public key PEM
 * @returns {Object} Encryption artifacts:
 *   - encryptedBuffer: Buffer of AES-256-GCM ciphertext
 *   - encryptedAesKey: Base64-encoded RSA-wrapped AES key
 *   - iv: Base64-encoded 12-byte IV
 *   - authTag: Base64-encoded 16-byte GCM authentication tag
 *   - originalSize: Number of bytes of plaintext
 *   - encryptedSize: Number of bytes of ciphertext
 */
function encryptQuestionPaper(plaintextBuffer, customPublicKeyPem = null) {
  if (!Buffer.isBuffer(plaintextBuffer) || plaintextBuffer.length === 0) {
    const err = new Error('Cannot encrypt empty or invalid question paper buffer.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Generate unique 32-byte AES key and 12-byte IV
  const aesKey = generateDataEncryptionKey();
  const iv = generateIv();

  // 2. Encrypt plaintext buffer with AES-256-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const encryptedBuffer = Buffer.concat([cipher.update(plaintextBuffer), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  // 3. Wrap AES key with RSA-OAEP
  const encryptedAesKey = wrapAesKey(aesKey, customPublicKeyPem);

  return {
    encryptedBuffer,
    encryptedAesKey,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    originalSize: plaintextBuffer.length,
    encryptedSize: encryptedBuffer.length,
  };
}

/**
 * Decrypts an encrypted question paper buffer with AES-256-GCM and verifies cryptographic authenticity.
 *
 * @param {Buffer} encryptedBuffer - Ciphertext buffer
 * @param {string} encryptedAesKeyBase64 - Base64 RSA-wrapped AES key
 * @param {string} ivBase64 - Base64 12-byte IV
 * @param {string} authTagBase64 - Base64 16-byte GCM auth tag
 * @param {string} [customPrivateKeyPem] - Optional custom private key PEM
 * @returns {Buffer} Decrypted plaintext question paper PDF buffer
 */
function decryptQuestionPaper(
  encryptedBuffer,
  encryptedAesKeyBase64,
  ivBase64,
  authTagBase64,
  customPrivateKeyPem = null
) {
  if (!Buffer.isBuffer(encryptedBuffer) || encryptedBuffer.length === 0) {
    const err = new Error('Invalid or missing encrypted question paper buffer.');
    err.statusCode = 400;
    throw err;
  }

  if (!encryptedAesKeyBase64 || !ivBase64 || !authTagBase64) {
    const err = new Error('Missing encryption key parameters (encryptedAesKey, iv, or authTag).');
    err.statusCode = 400;
    throw err;
  }

  // 1. Unwrap AES key using RSA private key
  const aesKey = unwrapAesKey(encryptedAesKeyBase64, customPrivateKeyPem);

  // 2. Decode IV and Auth Tag
  const iv = Buffer.from(ivBase64, 'base64');
  const authTag = Buffer.from(authTagBase64, 'base64');

  if (iv.length !== 12) {
    const err = new Error('Invalid IV length. Expected 12 bytes.');
    err.statusCode = 400;
    throw err;
  }

  if (authTag.length !== 16) {
    const err = new Error('Invalid authentication tag length. Expected 16 bytes.');
    err.statusCode = 400;
    throw err;
  }

  // 3. Decrypt ciphertext with AES-256-GCM and authenticate tag
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
    decipher.setAuthTag(authTag);
    const decryptedBuffer = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
    return decryptedBuffer;
  } catch (err) {
    // GCM authentication failure / ciphertext tampering
    const tamperErr = new Error(
      'Decryption failed: cryptographic integrity check failed. The file or key material has been modified or corrupted.'
    );
    tamperErr.statusCode = 400;
    throw tamperErr;
  }
}

module.exports = {
  generateDataEncryptionKey,
  generateIv,
  wrapAesKey,
  unwrapAesKey,
  encryptQuestionPaper,
  decryptQuestionPaper,
  getPublicKey,
  getPrivateKey,
  clearKeyCache,
};

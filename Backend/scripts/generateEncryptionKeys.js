/**
 * ExamGuard - Cryptographic Key Generation Utility (Module 6)
 * 
 * Generates a dedicated RSA-2048 key pair for Question Paper Envelope Encryption (RSA-OAEP-SHA256).
 * 
 * Usage:
 *   node scripts/generateEncryptionKeys.js [--force]
 * 
 * Flags:
 *   --force   Overwrite existing keys in Backend/keys/
 * 
 * Security:
 *   - The private key is strictly saved to Backend/keys/ and never printed to stdout.
 *   - Both keys are generated with standard PKCS#8 (private) and SPKI (public) PEM formats.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEYS_DIR = path.resolve(__dirname, '../keys');
const PUBLIC_KEY_FILE = path.join(KEYS_DIR, 'question-paper-encryption-public.pem');
const PRIVATE_KEY_FILE = path.join(KEYS_DIR, 'question-paper-encryption-private.pem');

const isForce = process.argv.includes('--force');

function generateKeys() {
  console.log('===============================================================');
  console.log('   EXAMGUARD MODULE 6 - RSA ENCRYPTION KEY GENERATOR');
  console.log('===============================================================\n');

  // Ensure keys directory exists
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  // Check if keys already exist
  const publicKeyExists = fs.existsSync(PUBLIC_KEY_FILE);
  const privateKeyExists = fs.existsSync(PRIVATE_KEY_FILE);

  if ((publicKeyExists || privateKeyExists) && !isForce) {
    console.error('❌ Keys already exist in Backend/keys:');
    if (publicKeyExists) console.error(`   - ${path.basename(PUBLIC_KEY_FILE)}`);
    if (privateKeyExists) console.error(`   - ${path.basename(PRIVATE_KEY_FILE)}`);
    console.error('\nTo overwrite existing keys, re-run with the --force flag:');
    console.error('   node scripts/generateEncryptionKeys.js --force\n');
    console.error('⚠️  WARNING: Overwriting keys will make previously encrypted question papers unrecoverable!');
    process.exit(1);
  }

  console.log('Generating 2048-bit RSA key pair for envelope encryption...');

  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  // Write keys to disk with restrictive file permissions
  fs.writeFileSync(PUBLIC_KEY_FILE, publicKey, { mode: 0o644 });
  fs.writeFileSync(PRIVATE_KEY_FILE, privateKey, { mode: 0o600 });

  console.log('\n✔ RSA-2048 Key Pair Generated Successfully!');
  console.log(`  Public Key:  ${path.relative(process.cwd(), PUBLIC_KEY_FILE)}`);
  console.log(`  Private Key: ${path.relative(process.cwd(), PRIVATE_KEY_FILE)} (Permissions: 0600)`);
  console.log('\n===============================================================');
  console.log('SECURITY NOTICE:');
  console.log('  1. The private key must NEVER be committed to version control.');
  console.log('  2. Verify that Backend/keys/*.pem is listed in your .gitignore.');
  console.log('  3. In production, protect the private key with strict file ACLs or KMS.');
  console.log('===============================================================\n');
}

generateKeys();

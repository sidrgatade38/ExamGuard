/**
 * ExamGuard - Cryptographic Key Wrapping Key Generator (Module 8)
 * 
 * Generates a dedicated RSA-2048 key pair for Question Paper Envelope Key Wrapping (RSA-OAEP with SHA-256).
 * Strictly separate from Module 7 digital signing keys.
 * 
 * Usage:
 *   node scripts/generateKeyWrappingKeys.js [--force]
 * 
 * Flags:
 *   --force   Overwrite existing key-wrapping keys in Backend/keys/
 * 
 * Security:
 *   - The private key is strictly saved to Backend/keys/ and NEVER printed to stdout.
 *   - Both keys are generated with standard PKCS#8 (private) and SPKI (public) PEM formats.
 *   - Accidental overwrite is strictly prevented without the --force flag.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEYS_DIR = path.resolve(__dirname, '../keys');
const PUBLIC_KEY_FILE = path.join(KEYS_DIR, 'question-paper-key-wrapping-public.pem');
const PRIVATE_KEY_FILE = path.join(KEYS_DIR, 'question-paper-key-wrapping-private.pem');

const isForce = process.argv.includes('--force');

function generateWrappingKeys() {
  console.log('===============================================================');
  console.log('   EXAMGUARD MODULE 8 - RSA KEY-WRAPPING KEY GENERATOR');
  console.log('===============================================================\n');

  // Ensure keys directory exists
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  // Check if keys already exist
  const publicKeyExists = fs.existsSync(PUBLIC_KEY_FILE);
  const privateKeyExists = fs.existsSync(PRIVATE_KEY_FILE);

  if ((publicKeyExists || privateKeyExists) && !isForce) {
    console.error('❌ Key-wrapping keys already exist in Backend/keys:');
    if (publicKeyExists) console.error(`   - ${path.basename(PUBLIC_KEY_FILE)}`);
    if (privateKeyExists) console.error(`   - ${path.basename(PRIVATE_KEY_FILE)}`);
    console.error('\nTo overwrite existing keys, re-run with the --force flag:');
    console.error('   node scripts/generateKeyWrappingKeys.js --force\n');
    console.error('⚠️  WARNING: Overwriting keys will make previously encrypted question papers unrecoverable!');
    process.exit(1);
  }

  console.log('Generating 2048-bit RSA key pair for AES key wrapping (RSA-OAEP-SHA256)...');

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

  console.log('\n✔ RSA-2048 Key-Wrapping Key Pair Generated Successfully!');
  console.log(`  Public Key:  ${path.relative(process.cwd(), PUBLIC_KEY_FILE)}`);
  console.log(`  Private Key: ${path.relative(process.cwd(), PRIVATE_KEY_FILE)} (Permissions: 0600)`);
  console.log('\n===============================================================');
  console.log('SECURITY NOTICE:');
  console.log('  1. The private wrapping key must NEVER be committed to version control.');
  console.log('  2. Verify that Backend/keys/*.pem is listed in your .gitignore.');
  console.log('  3. In production, protect the private key with strict file ACLs or KMS.');
  console.log('  4. These keys are strictly dedicated to RSA-OAEP key wrapping.');
  console.log('     Do NOT interchange them with Module 7 digital signing keys.');
  console.log('===============================================================\n');
}

generateWrappingKeys();

/**
 * ExamGuard - Cryptographic Signing Key Generation Utility (Module 7)
 * 
 * Generates a dedicated RSA-2048 key pair for Question Paper Digital Signatures (RSA-PSS with SHA-256).
 * Strictly separate from Module 6 encryption keys.
 * 
 * Usage:
 *   node scripts/generateSigningKeys.js [--force]
 * 
 * Flags:
 *   --force   Overwrite existing signing keys in Backend/keys/
 * 
 * Security:
 *   - The private key is strictly saved to Backend/keys/ and never printed to stdout.
 *   - Both keys are generated with standard PKCS#8 (private) and SPKI (public) PEM formats.
 *   - Existing keys are protected from accidental overwrite.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KEYS_DIR = path.resolve(__dirname, '../keys');
const PUBLIC_KEY_FILE = path.join(KEYS_DIR, 'question-paper-signing-public.pem');
const PRIVATE_KEY_FILE = path.join(KEYS_DIR, 'question-paper-signing-private.pem');

const isForce = process.argv.includes('--force');

function generateSigningKeys() {
  console.log('===============================================================');
  console.log('   EXAMGUARD MODULE 7 - RSA DIGITAL SIGNING KEY GENERATOR');
  console.log('===============================================================\n');

  // Ensure keys directory exists
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }

  // Check if keys already exist
  const publicKeyExists = fs.existsSync(PUBLIC_KEY_FILE);
  const privateKeyExists = fs.existsSync(PRIVATE_KEY_FILE);

  if ((publicKeyExists || privateKeyExists) && !isForce) {
    console.error('❌ Signing keys already exist in Backend/keys:');
    if (publicKeyExists) console.error(`   - ${path.basename(PUBLIC_KEY_FILE)}`);
    if (privateKeyExists) console.error(`   - ${path.basename(PRIVATE_KEY_FILE)}`);
    console.error('\nTo overwrite existing keys, re-run with the --force flag:');
    console.error('   node scripts/generateSigningKeys.js --force\n');
    console.error('⚠️  WARNING: Overwriting keys will invalidate existing digital signatures!');
    process.exit(1);
  }

  console.log('Generating 2048-bit RSA key pair for digital signatures (RSA-PSS)...');

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

  console.log('\n✔ RSA-2048 Digital Signing Key Pair Generated Successfully!');
  console.log(`  Public Key:  ${path.relative(process.cwd(), PUBLIC_KEY_FILE)}`);
  console.log(`  Private Key: ${path.relative(process.cwd(), PRIVATE_KEY_FILE)} (Permissions: 0600)`);
  console.log('\n===============================================================');
  console.log('SECURITY NOTICE:');
  console.log('  1. The signing private key must NEVER be committed to version control.');
  console.log('  2. Verify that Backend/keys/*.pem is listed in your .gitignore.');
  console.log('  3. These keys are strictly dedicated to RSA-PSS digital signing.');
  console.log('     Do NOT interchange them with Module 6 encryption keys.');
  console.log('===============================================================\n');
}

generateSigningKeys();

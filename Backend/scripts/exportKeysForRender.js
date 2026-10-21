/**
 * ExamGuard - Export Existing RSA Keys for Render Cloud Deployment
 *
 * This utility reads your existing local RSA keys (preserving full cryptographic
 * compatibility with any documents already encrypted or signed in your database)
 * and formats them for the Render Dashboard.
 *
 * Output:
 * Generates a local, git-ignored file "Backend/.render-secrets.env".
 *
 * Security:
 * - Never commits or pushes .render-secrets.env.
 * - Never prints private key contents to shared logs or chat.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BACKEND_ROOT = path.resolve(__dirname, '../');
const KEYS_DIR = path.join(BACKEND_ROOT, 'keys');
const OUTPUT_FILE = path.join(BACKEND_ROOT, '.render-secrets.env');

const REQUIRED_KEYS = [
  {
    name: 'Key-Wrapping Public Key',
    file: 'question-paper-key-wrapping-public.pem',
    envName: 'QUESTION_PAPER_KEY_WRAPPING_PUBLIC_KEY_BASE64',
  },
  {
    name: 'Key-Wrapping Private Key',
    file: 'question-paper-key-wrapping-private.pem',
    envName: 'QUESTION_PAPER_KEY_WRAPPING_PRIVATE_KEY_BASE64',
  },
  {
    name: 'Signing Public Key',
    file: 'question-paper-signing-public.pem',
    envName: 'QUESTION_PAPER_SIGNING_PUBLIC_KEY_BASE64',
  },
  {
    name: 'Signing Private Key',
    file: 'question-paper-signing-private.pem',
    envName: 'QUESTION_PAPER_SIGNING_PRIVATE_KEY_BASE64',
  },
];

function exportKeys() {
  console.log('============================================================');
  console.log('  ExamGuard — Render Cloud Key Export Utility              ');
  console.log('============================================================\n');

  const lines = [
    '# ==============================================================================',
    '# ExamGuard — Render Cloud Deployment Environment Variables',
    '# Generated automatically by scripts/exportKeysForRender.js',
    '# DO NOT COMMIT THIS FILE TO VERSION CONTROL',
    '# ==============================================================================\n',
    'NODE_ENV=production',
    'ALLOWED_ORIGINS=https://exam-gaurd.vercel.app',
    'TRUST_PROXY=true',
    'STORAGE_BUCKET=examguard-storage',
    'MAX_QUESTION_PAPER_SIZE_MB=10',
    'LOGIN_RATE_LIMIT_WINDOW_MINUTES=15',
    'LOGIN_RATE_LIMIT_MAX_ATTEMPTS=10',
    `JWT_SECRET=${crypto.randomBytes(32).toString('hex')}`,
    'JWT_EXPIRES_IN=1h',
    '\n# Cryptographic Key Material (Base64 Encoded for Render Environment Variables):',
  ];

  let missingCount = 0;

  for (const item of REQUIRED_KEYS) {
    const keyPath = path.join(KEYS_DIR, item.file);
    if (!fs.existsSync(keyPath)) {
      console.error(`  ✗ [MISSING] ${item.name} not found at "${keyPath}"`);
      missingCount++;
      continue;
    }

    const content = fs.readFileSync(keyPath, 'utf8').trim();
    const base64 = Buffer.from(content).toString('base64');
    lines.push(`${item.envName}=${base64}`);
    console.log(`  ✓ [ENCODED] ${item.name} (${content.length} chars -> base64)`);
  }

  if (missingCount > 0) {
    console.error(`\nError: ${missingCount} key(s) missing. Cannot generate complete Render configuration.`);
    process.exit(1);
  }

  // Pull existing Supabase configuration from local Backend/.env if available
  const localEnvPath = path.join(BACKEND_ROOT, '.env');
  if (fs.existsSync(localEnvPath)) {
    const localEnvContent = fs.readFileSync(localEnvPath, 'utf8');
    const getVal = (key) => {
      const match = localEnvContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
      return match ? match[1].trim() : '';
    };

    const supabaseUrl = getVal('SUPABASE_URL');
    const supabaseAnon = getVal('SUPABASE_ANON_KEY');
    const supabaseService = getVal('SUPABASE_SERVICE_ROLE_KEY');

    if (supabaseUrl) lines.splice(5, 0, `SUPABASE_URL=${supabaseUrl}`);
    if (supabaseAnon) lines.splice(6, 0, `SUPABASE_ANON_KEY=${supabaseAnon}`);
    if (supabaseService) lines.splice(7, 0, `SUPABASE_SERVICE_ROLE_KEY=${supabaseService}`);
  }

  fs.writeFileSync(OUTPUT_FILE, lines.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });

  console.log('\n============================================================');
  console.log(`  SUCCESS: Configuration written to:`);
  console.log(`  ${OUTPUT_FILE}`);
  console.log('============================================================');
  console.log('\nNext Steps for Render Deployment:');
  console.log('1. Open your Render Dashboard -> Your ExamGuard Web Service.');
  console.log('2. Navigate to "Environment".');
  console.log('3. Open the generated file "Backend/.render-secrets.env" on your local computer.');
  console.log('4. Copy the environment variables into the Render Dashboard.');
  console.log('5. Trigger a Manual Deploy -> "Deploy latest commit".\n');
}

exportKeys();

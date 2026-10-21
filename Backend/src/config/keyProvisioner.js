/**
 * ExamGuard - Cryptographic Key Provisioner & Path Resolver
 *
 * Facilitates zero-downtime, cloud-native key provisioning for containerized
 * and cloud platforms (such as Render, Railway, AWS, Docker) while preserving
 * cryptographic continuity with existing database records.
 *
 * Security Invariants:
 * - Real key contents are NEVER logged, printed, or exposed in error messages.
 * - Filesystem permissions on created private keys are locked down to 0600 on POSIX.
 * - Never overwrites existing valid key files on disk unless explicitly instructed.
 * - Fails closed if keys are malformed or missing in production.
 */

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '../../');

/**
 * Resolves a key path with support for:
 * 1. Absolute filesystem paths
 * 2. Relative paths from Backend root
 * 3. Render Secret Files mount path (/etc/secrets/<basename>)
 *
 * @param {string} configPath - Configured file path
 * @returns {string|null} Resolved absolute path or null
 */
function resolveKeyPath(configPath) {
  if (!configPath) return null;

  // 1. If path is already absolute, return directly
  if (path.isAbsolute(configPath)) {
    return configPath;
  }

  // 2. Standard resolution relative to Backend root
  const localPath = path.resolve(BACKEND_ROOT, configPath);
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  // 3. Render Secret Files fallback (/etc/secrets/<basename>)
  const basename = path.basename(configPath);
  const renderSecretPath = path.join('/etc/secrets', basename);
  if (fs.existsSync(renderSecretPath)) {
    return renderSecretPath;
  }

  return localPath;
}

/**
 * Key definitions and their corresponding environment variables and target paths.
 */
const KEY_DEFINITIONS = [
  {
    name: 'RSA Key-Wrapping Public Key',
    isPrivate: false,
    defaultPath: 'keys/question-paper-key-wrapping-public.pem',
    envVars: [
      'QUESTION_PAPER_KEY_WRAPPING_PUBLIC_KEY_BASE64',
      'QUESTION_PAPER_KEY_WRAPPING_PUBLIC_KEY',
      'QUESTION_PAPER_ENCRYPTION_PUBLIC_KEY_BASE64',
      'QUESTION_PAPER_ENCRYPTION_PUBLIC_KEY',
    ],
  },
  {
    name: 'RSA Key-Wrapping Private Key',
    isPrivate: true,
    defaultPath: 'keys/question-paper-key-wrapping-private.pem',
    envVars: [
      'QUESTION_PAPER_KEY_WRAPPING_PRIVATE_KEY_BASE64',
      'QUESTION_PAPER_KEY_WRAPPING_PRIVATE_KEY',
      'QUESTION_PAPER_ENCRYPTION_PRIVATE_KEY_BASE64',
      'QUESTION_PAPER_ENCRYPTION_PRIVATE_KEY',
    ],
  },
  {
    name: 'RSA Digital Signing Public Key',
    isPrivate: false,
    defaultPath: 'keys/question-paper-signing-public.pem',
    envVars: [
      'QUESTION_PAPER_SIGNING_PUBLIC_KEY_BASE64',
      'QUESTION_PAPER_SIGNING_PUBLIC_KEY',
    ],
  },
  {
    name: 'RSA Digital Signing Private Key',
    isPrivate: true,
    defaultPath: 'keys/question-paper-signing-private.pem',
    envVars: [
      'QUESTION_PAPER_SIGNING_PRIVATE_KEY_BASE64',
      'QUESTION_PAPER_SIGNING_PRIVATE_KEY',
    ],
  },
];

/**
 * Normalizes PEM string from raw environment variable input.
 * Handles base64 encoding or escaped newlines.
 */
function normalizePemContent(rawVal, isBase64 = false) {
  if (!rawVal || typeof rawVal !== 'string') return null;

  const trimmed = rawVal.trim();
  if (isBase64 || (!trimmed.includes('BEGIN') && /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed))) {
    try {
      const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
      if (decoded.includes('BEGIN')) {
        return decoded.trim();
      }
    } catch {
      // Fall through to raw handling
    }
  }

  // Handle escaped newlines (often produced when pasting multi-line strings into dashboard forms)
  const unescaped = trimmed.replace(/\\n/g, '\n').replace(/\\r/g, '');
  return unescaped.trim();
}

/**
 * Synchronizes key files from cloud environment variables to disk if not already present.
 *
 * @param {Object} [cfg] - Application configuration
 * @returns {{ provisionedCount: number, existingCount: number }}
 */
function syncEnvironmentKeys(cfg) {
  let provisionedCount = 0;
  let existingCount = 0;

  for (const def of KEY_DEFINITIONS) {
    const targetPath = path.resolve(BACKEND_ROOT, def.defaultPath);

    // If file already exists and is non-empty, keep existing
    if (fs.existsSync(targetPath)) {
      try {
        const stat = fs.statSync(targetPath);
        if (stat.size > 100) {
          existingCount++;
          continue;
        }
      } catch {
        // Proceed to attempt environment provisioning if file unreadable
      }
    }

    // Also check if already mounted at Render Secret Files (/etc/secrets)
    const renderSecretPath = path.join('/etc/secrets', path.basename(def.defaultPath));
    if (fs.existsSync(renderSecretPath)) {
      existingCount++;
      continue;
    }

    // Look for key content in defined environment variables
    let keyContent = null;
    for (const envVarName of def.envVars) {
      const envVal = process.env[envVarName];
      if (envVal && envVal.trim().length > 0) {
        const isBase64 = envVarName.endsWith('_BASE64');
        const parsed = normalizePemContent(envVal, isBase64);
        if (parsed && (parsed.includes('BEGIN PUBLIC KEY') || parsed.includes('BEGIN PRIVATE KEY') || parsed.includes('BEGIN RSA PRIVATE KEY'))) {
          keyContent = parsed;
          break;
        }
      }
    }

    // If valid key content found in environment variables, write to disk
    if (keyContent) {
      try {
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) {
          fs.mkdirSync(targetDir, { recursive: true, mode: 0o700 });
        }

        fs.writeFileSync(targetPath, keyContent + '\n', {
          encoding: 'utf8',
          mode: def.isPrivate ? 0o600 : 0o644,
        });

        // Ensure permissions on POSIX
        try {
          fs.chmodSync(targetPath, def.isPrivate ? 0o600 : 0o644);
        } catch {
          // chmod might fail on some Windows filesystems; safe to ignore
        }

        console.log(`[ExamGuard Security] Provisioned ${def.name} from environment configuration.`);
        provisionedCount++;
      } catch (writeErr) {
        console.error(`[ExamGuard Security Error] Failed to write key file "${targetPath}":`, writeErr.message);
      }
    }
  }

  return { provisionedCount, existingCount };
}

module.exports = {
  resolveKeyPath,
  syncEnvironmentKeys,
  normalizePemContent,
  KEY_DEFINITIONS,
};

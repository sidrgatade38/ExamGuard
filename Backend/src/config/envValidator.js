/**
 * ExamGuard - Production Environment Validator (Module 17)
 *
 * Validates mandatory environment variables, secrets, origins, and key files
 * at server startup to prevent insecure or misconfigured production execution.
 *
 * Security Invariants:
 * - Real secrets and credentials are NEVER logged or printed.
 * - Distinguishes between 'development', 'test', and 'production' environments.
 * - Fails startup immediately in 'production' if any mandatory security invariant is violated.
 */

const fs = require('fs');
const path = require('path');

// Known development/sample placeholders that are forbidden in production
const INSECURE_JWT_PLACEHOLDERS = [
  'examguard_secure_jwt_secret_dev_key_2026_examguard',
  'change_this_in_production',
  'your_jwt_secret_here',
  'secret',
  'jwt_secret',
  'default_secret',
];

const { resolveKeyPath, syncEnvironmentKeys } = require('./keyProvisioner');

/**
 * Validates system environment configuration.
 *
 * @param {Object} [cfg] - Configuration object to validate (defaults to loaded config)
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
function validateEnvironment(cfg) {
  const config = cfg || require('./index');
  const env = config.nodeEnv || process.env.NODE_ENV || 'development';
  const errors = [];
  const warnings = [];

  const isProduction = env === 'production';
  const isTest = env === 'test';

  // 1. Port Validation
  const port = parseInt(config.port, 10);
  if (isNaN(port) || port <= 0 || port > 65535) {
    errors.push('Invalid PORT: Must be an integer between 1 and 65535.');
  }

  // In test mode, bypass live external credential and key checks
  if (isTest) {
    return { valid: errors.length === 0, errors, warnings };
  }

  // 2. JWT Secret Validation
  const jwtSecret = cfg && typeof cfg.jwtSecret !== 'undefined'
    ? cfg.jwtSecret
    : (config.jwtSecret || process.env.JWT_SECRET || '');

  if (!jwtSecret || jwtSecret.trim().length === 0) {
    errors.push('Missing JWT_SECRET: A cryptographically secure secret is required for token signing.');
  } else if (isProduction) {
    if (jwtSecret.length < 32) {
      errors.push('Insecure JWT_SECRET: Production secret must be at least 32 characters in length.');
    }
    const lowerSecret = jwtSecret.trim().toLowerCase();
    if (INSECURE_JWT_PLACEHOLDERS.some((p) => lowerSecret.includes(p))) {
      errors.push('Insecure JWT_SECRET: Development placeholder secrets are strictly forbidden in production.');
    }
  } else if (INSECURE_JWT_PLACEHOLDERS.some((p) => jwtSecret.trim().toLowerCase().includes(p))) {
    warnings.push('JWT_SECRET is using a known development placeholder. Ensure a strong secret is provisioned before production deployment.');
  }

  // 3. Supabase Credentials Validation
  const supabaseUrl = cfg && cfg.supabase && typeof cfg.supabase.url !== 'undefined'
    ? cfg.supabase.url
    : (config.supabase?.url || process.env.SUPABASE_URL || '');

  const serviceRoleKey = cfg && cfg.supabase && typeof cfg.supabase.serviceRoleKey !== 'undefined'
    ? cfg.supabase.serviceRoleKey
    : (config.supabase?.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '');

  if (!supabaseUrl || supabaseUrl.trim().length === 0) {
    errors.push('Missing SUPABASE_URL: Backend requires a valid Supabase project endpoint.');
  } else if (isProduction && !supabaseUrl.startsWith('https://')) {
    errors.push('Insecure SUPABASE_URL: Production Supabase endpoint must use HTTPS.');
  }

  if (!serviceRoleKey || serviceRoleKey.trim().length === 0) {
    errors.push('Missing SUPABASE_SERVICE_ROLE_KEY: Backend requires server-side service-role credentials for authorized data operations.');
  } else if (serviceRoleKey.length < 20) {
    errors.push('Malformed SUPABASE_SERVICE_ROLE_KEY: Expected valid service role JWT.');
  }

  // 4. CORS Allowed Origins Validation
  const rawOrigins = cfg && typeof cfg.allowedOrigins !== 'undefined'
    ? cfg.allowedOrigins
    : (config.allowedOrigins || process.env.ALLOWED_ORIGINS || '');

  if (isProduction) {
    if (!rawOrigins || rawOrigins.trim().length === 0) {
      errors.push('Missing ALLOWED_ORIGINS: Production requires an explicit, comma-separated frontend origin allowlist.');
    } else if (rawOrigins.includes('*')) {
      errors.push('Insecure ALLOWED_ORIGINS: Wildcard origins (*) are strictly prohibited in production when credentials are used.');
    }
  }

  // 5. Cryptographic Key File Readiness
  const keyConfigs = [
    { name: 'RSA Signing Public Key', path: config.signing?.publicKeyPath },
    { name: 'RSA Signing Private Key', path: config.signing?.privateKeyPath },
    { name: 'RSA Key-Wrapping Public Key', path: config.keyWrapping?.publicKeyPath },
    { name: 'RSA Key-Wrapping Private Key', path: config.keyWrapping?.privateKeyPath },
  ];

  for (const kc of keyConfigs) {
    if (!kc.path) {
      errors.push(`Missing key configuration: ${kc.name} path is not configured.`);
      continue;
    }
    const resolved = resolveKeyPath(kc.path);
    if (!fs.existsSync(resolved)) {
      if (isProduction) {
        errors.push(`Cryptographic key file not found: ${kc.name} does not exist at "${kc.path}".`);
      } else {
        warnings.push(`Cryptographic key file not found at "${kc.path}". Run key generation script before using encryption features.`);
      }
    } else {
      try {
        fs.accessSync(resolved, fs.constants.R_OK);
      } catch {
        errors.push(`Cryptographic key unreadable: Permission denied for ${kc.name} at "${kc.path}".`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Enforces environment validation on server boot.
 * In production, exits process with code 1 if validation fails.
 */
function enforceStartupValidation(cfg) {
  // Sync keys from environment variables or cloud secret mounts if not present on disk
  syncEnvironmentKeys(cfg);

  const result = validateEnvironment(cfg);
  const env = (cfg && cfg.nodeEnv) || process.env.NODE_ENV || 'development';

  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      console.warn(`[Config Warning] ${w}`);
    }
  }

  if (!result.valid) {
    console.error('\n============================================================');
    console.error('  CRITICAL CONFIGURATION ERROR: SERVER STARTUP ABORTED      ');
    console.error('============================================================');
    for (const err of result.errors) {
      console.error(`  ✗ ${err}`);
    }
    console.error('============================================================\n');

    if (env === 'production') {
      const startupErr = new Error('Production environment validation failed.');
      startupErr.errors = result.errors;
      throw startupErr;
    }
  }

  return result;
}

module.exports = {
  validateEnvironment,
  enforceStartupValidation,
  INSECURE_JWT_PLACEHOLDERS,
};

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file with robust path resolution
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../Backend/.env') });

const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  supabase: {
    url: process.env.SUPABASE_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.RESEND_FROM_EMAIL || 'ExamGuard <onboarding@resend.dev>',
    webhookSecret: process.env.RESEND_WEBHOOK_SECRET || '',
  },
  frontendUrl: process.env.FRONTEND_URL || 'https://examguardapp.vercel.app',
  jwtSecret: process.env.JWT_SECRET || '',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  storageBucket: process.env.STORAGE_BUCKET || 'examguard-storage',
  maxQuestionPaperSizeMb: parseInt(process.env.MAX_QUESTION_PAPER_SIZE_MB, 10) || 10,
  allowedOrigins: process.env.ALLOWED_ORIGINS || '',
  trustProxy: process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1',
  rateLimit: {
    windowMinutes: parseInt(process.env.LOGIN_RATE_LIMIT_WINDOW_MINUTES, 10) || 15,
    maxAttempts: parseInt(process.env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS, 10) || 10,
  },
  keyWrapping: {
    publicKeyPath: process.env.QUESTION_PAPER_KEY_WRAPPING_PUBLIC_KEY_PATH || process.env.QUESTION_PAPER_ENCRYPTION_PUBLIC_KEY_PATH || 'keys/question-paper-key-wrapping-public.pem',
    privateKeyPath: process.env.QUESTION_PAPER_KEY_WRAPPING_PRIVATE_KEY_PATH || process.env.QUESTION_PAPER_ENCRYPTION_PRIVATE_KEY_PATH || 'keys/question-paper-key-wrapping-private.pem',
  },
  encryption: {
    publicKeyPath: process.env.QUESTION_PAPER_ENCRYPTION_PUBLIC_KEY_PATH || process.env.QUESTION_PAPER_KEY_WRAPPING_PUBLIC_KEY_PATH || 'keys/question-paper-encryption-public.pem',
    privateKeyPath: process.env.QUESTION_PAPER_ENCRYPTION_PRIVATE_KEY_PATH || process.env.QUESTION_PAPER_KEY_WRAPPING_PRIVATE_KEY_PATH || 'keys/question-paper-encryption-private.pem',
  },
  signing: {
    publicKeyPath: process.env.QUESTION_PAPER_SIGNING_PUBLIC_KEY_PATH || 'keys/question-paper-signing-public.pem',
    privateKeyPath: process.env.QUESTION_PAPER_SIGNING_PRIVATE_KEY_PATH || 'keys/question-paper-signing-private.pem',
  },
};

module.exports = config;

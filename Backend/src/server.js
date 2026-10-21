const express = require('express');
const helmet = require('helmet');
const config = require('./config');
const apiRoutes = require('./routes');
const notFound = require('./middleware/notFound.middleware');
const { createCorsMiddleware } = require('./middleware/corsConfig');
const { enforceStartupValidation } = require('./config/envValidator');

// Initialize Express application
const app = express();

// Trust reverse proxy if configured (e.g. Nginx, Cloudflare, load balancers)
if (config.trustProxy) {
  app.set('trust proxy', 1);
}

// Security middleware - permit cross-origin resource policy for streaming decrypted PDF blobs
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration (environment-aware allowlist, blocks untrusted browser origins)
app.use(createCorsMiddleware());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mount API routes
app.use('/api', apiRoutes);

// 404 Not Found handler
app.use(notFound);

// Global error handler (sanitized production error formatting)
app.use((err, req, res, next) => {
  const isProduction = (config.nodeEnv || process.env.NODE_ENV) === 'production';
  const statusCode = err.statusCode || err.status || 500;

  // Handle CORS rejection specifically
  if (err.message && err.message.startsWith('CORS policy:')) {
    return res.status(403).json({
      success: false,
      message: err.message,
    });
  }

  // Log error details safely on server
  if (statusCode === 500) {
    console.error('[Unhandled Server Error]', isProduction ? err.message : err);
  }

  // In production, sanitize internal 500 error messages to prevent leakage of internal stack details
  const clientMessage = isProduction && statusCode === 500
    ? 'Internal server error'
    : (err.message || 'Internal server error');

  return res.status(statusCode).json({
    success: false,
    message: clientMessage,
  });
});

// Start the server if executed directly
const PORT = config.port || 5000;
let server = null;

if (require.main === module) {
  try {
    enforceStartupValidation(config);
  } catch (startupErr) {
    console.error('[ExamGuard] Fatal startup validation error:', startupErr.message);
    process.exit(1);
  }

  server = app.listen(PORT, () => {
    console.log(`[ExamGuard] Backend server running on port ${PORT}`);
    console.log(`[ExamGuard] Health check available at http://localhost:${PORT}/api/health`);
    console.log(`[ExamGuard] Readiness probe available at http://localhost:${PORT}/api/health/ready`);
  });
}

module.exports = { app, server };

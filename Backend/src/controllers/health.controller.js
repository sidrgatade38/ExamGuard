const { supabase } = require('../config/supabase');
const config = require('../config');

/**
 * Health check controller (Liveness probe)
 * Endpoint: GET /api/health
 */
const getHealthStatus = (req, res) => {
  return res.status(200).json({
    success: true,
    status: 'healthy',
    message: 'ExamGuard backend is running',
    module: 'Module 1',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Readiness probe controller
 * Endpoint: GET /api/health/ready
 *
 * Verifies that the service is ready to accept production traffic by probing
 * database connectivity without leaking credentials or internal error traces.
 */
const getReadinessStatus = async (req, res) => {
  const checks = {
    database: 'unknown',
    storageBucket: config.storageBucket || 'examguard-storage',
    timestamp: new Date().toISOString(),
  };

  let isReady = true;

  try {
    // Ping Supabase PostgreSQL via lightweight roles query
    const { error } = await supabase.from('roles').select('id').limit(1);
    if (error) {
      checks.database = 'error';
      isReady = false;
    } else {
      checks.database = 'connected';
    }
  } catch (err) {
    checks.database = 'disconnected';
    isReady = false;
  }

  const statusCode = isReady ? 200 : 503;
  return res.status(statusCode).json({
    success: isReady,
    status: isReady ? 'ready' : 'degraded',
    checks,
  });
};

module.exports = {
  getHealthStatus,
  getReadinessStatus,
};


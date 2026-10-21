const express = require('express');
const { getHealthStatus, getReadinessStatus } = require('../controllers/health.controller');

const router = express.Router();

// GET /api/health (Liveness probe)
router.get('/health', getHealthStatus);

// GET /api/health/ready (Readiness probe)
router.get('/health/ready', getReadinessStatus);

module.exports = router;

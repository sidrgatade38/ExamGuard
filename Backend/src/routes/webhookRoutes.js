/**
 * ExamGuard - Webhook Routes
 * Endpoints for external service webhooks (Resend, etc.)
 */

const express = require('express');
const { handleResendWebhook } = require('../controllers/webhookController');

const router = express.Router();

// POST /api/webhooks/resend
router.post('/resend', handleResendWebhook);

module.exports = router;

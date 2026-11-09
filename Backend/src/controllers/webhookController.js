/**
 * ExamGuard - Webhook Controller
 * Handles external webhook integrations, specifically Resend delivery callbacks.
 */

const { verifyResendWebhookSignature, processResendWebhookEvent } = require('../services/emailService');

async function handleResendWebhook(req, res) {
  try {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    const headers = req.headers;

    // Verify webhook authenticity using Svix signature
    const isValid = verifyResendWebhookSignature(rawBody, headers);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid webhook signature or expired timestamp',
      });
    }

    // Process event payload (delivery, bounce, complaint)
    const result = await processResendWebhookEvent(req.body);

    return res.status(200).json({
      success: true,
      processed: result.processed,
      status: result.status || 'acknowledged',
    });
  } catch (error) {
    console.error('[WebhookController] Error handling Resend webhook:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal error processing webhook event',
    });
  }
}

module.exports = {
  handleResendWebhook,
};

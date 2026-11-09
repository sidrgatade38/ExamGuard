/**
 * ============================================================================
 * ExamGuard - Resend Email Notification Service (Module 10 & 26)
 * Secure Examination Question Paper Management System
 * Computer Engineering Department
 * ============================================================================
 * Centralized production-ready email service utilizing the official Resend Node.js SDK.
 *
 * Invariants & Guarantees:
 * - Credentials read exclusively from backend environment variables (RESEND_API_KEY).
 * - Never prints, logs, or exposes API keys or secrets.
 * - Idempotency tracking prevents duplicate email dispatch.
 * - Bounded retry handling with backoff for rate limits and transient network errors.
 * - Delivery status tracked in Supabase PostgreSQL: PENDING, SENT, DELIVERED, FAILED, RETRY_PENDING.
 * - Never includes confidential examination questions, decrypted PDFs, passwords, or private keys.
 * - Full Resend Webhook verification and delivery event processing.
 */

const crypto = require('crypto');
const { Resend } = require('resend');
const config = require('../config');
const { supabase } = require('../config/supabase');
const auditLogService = require('./auditLogService');

// In-memory cache for idempotency (prevents rapid duplicate email dispatch)
const recentEmailHashes = new Map();
const IDEMPOTENCY_WINDOW_MS = 60000; // 60 seconds

function cleanOldHashes() {
  const now = Date.now();
  for (const [key, timestamp] of recentEmailHashes.entries()) {
    if (now - timestamp > IDEMPOTENCY_WINDOW_MS) {
      recentEmailHashes.delete(key);
    }
  }
}

/**
 * Initializes official Resend Node.js SDK client if API key is present.
 */
let resendClient = null;
function getResendClient() {
  const apiKey = (config.resend?.apiKey || process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) return null;
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Renders the official responsive institutional ExamGuard HTML email template.
 */
function renderEmailTemplate({
  title,
  recipientName = 'Faculty Member',
  eventType = 'NOTIFICATION',
  message,
  details = [],
  actionUrl = null,
  actionText = 'Open ExamGuard Workspace',
  paperTitle = null,
  examDateTime = null,
  status = null,
  comments = null,
  timestamp = null,
}) {
  const allDetails = [...details];

  if (paperTitle && !allDetails.some((d) => d.label === 'Paper Title')) {
    allDetails.unshift({ label: 'Question Paper', value: paperTitle });
  }
  if (examDateTime && !allDetails.some((d) => d.label === 'Examination Date & Time')) {
    allDetails.push({ label: 'Examination Schedule', value: examDateTime });
  }
  if (status && !allDetails.some((d) => d.label === 'Current Status')) {
    allDetails.push({ label: 'Status', value: status });
  }
  if (comments && !allDetails.some((d) => d.label === 'Coordinator Comments' || d.label === 'Remarks')) {
    allDetails.push({ label: 'Coordinator Comments', value: comments });
  }
  if (!allDetails.some((d) => d.label === 'Timestamp')) {
    allDetails.push({ label: 'Recorded At', value: timestamp || new Date().toUTCString() });
  }

  const detailsRows = allDetails
    .map(
      (d) => `
      <tr>
        <td style="padding: 10px 14px; font-weight: 600; color: #475569; width: 35%; border-bottom: 1px solid #e2e8f0; font-size: 13px; vertical-align: top;">
          ${escapeHtml(d.label)}
        </td>
        <td style="padding: 10px 14px; color: #0f172a; border-bottom: 1px solid #e2e8f0; font-size: 13px; line-height: 1.5;">
          ${escapeHtml(String(d.value))}
        </td>
      </tr>`
    )
    .join('');

  const targetUrl = actionUrl || config.frontendUrl || 'https://examguardapp.vercel.app';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.08); border: 1px solid #cbd5e1;">

          <!-- Header -->
          <tr>
            <td style="background-color: #0f172a; padding: 26px 24px; text-align: center; border-bottom: 4px solid #2563eb;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">ExamGuard</h1>
              <p style="margin: 6px 0 0 0; color: #94a3b8; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                Department of Computer Engineering • Examination Cell
              </p>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 32px 28px;">
              <div style="display: inline-block; padding: 4px 10px; background-color: #e0f2fe; color: #0369a1; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px;">
                ${escapeHtml(eventType)}
              </div>

              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 19px; font-weight: 700; line-height: 1.4;">
                ${escapeHtml(title)}
              </h2>

              <p style="margin: 0 0 16px 0; color: #334155; font-size: 14px; line-height: 1.6;">
                Dear <strong>${escapeHtml(recipientName)}</strong>,
              </p>

              <p style="margin: 0 0 22px 0; color: #334155; font-size: 14px; line-height: 1.6;">
                ${escapeHtml(message)}
              </p>

              ${
                allDetails.length > 0
                  ? `
              <div style="margin: 20px 0 24px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
                  ${detailsRows}
                </table>
              </div>`
                  : ''
              }

              <!-- Action Link -->
              <div style="text-align: center; margin: 28px 0 20px 0;">
                <a href="${escapeHtml(targetUrl)}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; border-radius: 6px; font-size: 14px; font-weight: 600; text-decoration: none; display: inline-block; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2);">
                  ${escapeHtml(actionText)}
                </a>
              </div>

              <!-- Security Invariant Notice -->
              <div style="margin-top: 28px; padding: 14px 16px; background-color: #f8fafc; border-left: 3px solid #2563eb; border-radius: 4px; font-size: 12px; color: #475569; line-height: 1.5;">
                <strong>Security Invariant:</strong> ExamGuard utilizes AES-256-GCM encryption, RSA-PSS digital signatures, and strict role-based access control. Confidential examination questions, decrypted papers, passwords, and cryptographic keys are <strong>never</strong> transmitted via email. Materials can only be accessed by authorized faculty within the designated secure workspace.
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 18px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; line-height: 1.5;">
              This is an automated institutional notification from <strong>ExamGuard</strong>.<br>
              Department of Computer Engineering • Strictly Confidential &copy; ${new Date().getFullYear()}
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates a clean plain-text alternative of the email notification.
 */
function renderPlainTextTemplate({
  title,
  recipientName = 'Faculty Member',
  eventType = 'NOTIFICATION',
  message,
  details = [],
  actionUrl = null,
  paperTitle = null,
  examDateTime = null,
  status = null,
  comments = null,
}) {
  const lines = [
    '==============================================================',
    'EXAMGUARD - SECURE EXAMINATION QUESTION PAPER SYSTEM',
    'Department of Computer Engineering • Examination Cell',
    '==============================================================',
    '',
    `EVENT: ${eventType}`,
    `SUBJECT: ${title}`,
    '',
    `Dear ${recipientName},`,
    '',
    message,
    '',
    '--------------------------------------------------------------',
    'EVENT DETAILS:',
    '--------------------------------------------------------------',
  ];

  if (paperTitle) lines.push(`• Question Paper: ${paperTitle}`);
  if (examDateTime) lines.push(`• Examination Schedule: ${examDateTime}`);
  if (status) lines.push(`• Status: ${status}`);
  if (comments) lines.push(`• Coordinator Comments: ${comments}`);

  for (const d of details) {
    lines.push(`• ${d.label}: ${d.value}`);
  }

  lines.push(`• Recorded At: ${new Date().toUTCString()}`);
  lines.push('');
  lines.push(`Secure Workspace Link: ${actionUrl || config.frontendUrl || 'https://examguardapp.vercel.app'}`);
  lines.push('');
  lines.push('==============================================================');
  lines.push('SECURITY NOTICE: Examination questions, decrypted PDFs, and private keys');
  lines.push('are never transmitted via email. Access materials securely via the application.');
  lines.push('==============================================================');

  return lines.join('\n');
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Dispatches an email via official Resend SDK with bounded retries and database tracking.
 *
 * @param {Object} params
 * @param {string} params.to - Recipient email
 * @param {string} [params.recipientName] - Recipient name
 * @param {string} [params.userId] - Recipient user UUID
 * @param {string} [params.questionPaperId] - Associated question paper UUID
 * @param {string} params.eventType - Canonical event type string
 * @param {string} params.subject - Email subject
 * @param {string} params.title - Headline
 * @param {string} params.message - Body text
 * @param {Array<{label: string, value: string}>} [params.details] - Table details
 * @param {string} [params.actionUrl] - Action link
 * @param {string} [params.actionText] - Action button text
 * @param {string} [params.paperTitle] - Paper title
 * @param {string} [params.examDateTime] - Scheduled date & time
 * @param {string} [params.status] - Status string
 * @param {string} [params.comments] - Comments / remarks
 * @returns {Promise<{success: boolean, resendId?: string, status: string, error?: string}>}
 */
async function sendExamGuardEmail({
  to,
  recipientName = 'Faculty Member',
  userId = null,
  questionPaperId = null,
  eventType = 'SYSTEM',
  subject,
  title,
  message,
  details = [],
  actionUrl = null,
  actionText = 'Open ExamGuard Workspace',
  paperTitle = null,
  examDateTime = null,
  status = null,
  comments = null,
}) {
  if (!to || !to.includes('@')) {
    console.warn('[EmailService] Invalid recipient email address rejected:', to);
    return { success: false, status: 'FAILED', error: 'Invalid recipient email address' };
  }

  // Idempotency: hash (to + eventType + questionPaperId + subject)
  cleanOldHashes();
  const idempotencyKey = `${to.trim().toLowerCase()}:${eventType}:${questionPaperId || ''}:${subject}`;
  if (recentEmailHashes.has(idempotencyKey)) {
    console.log(`[EmailService] Idempotency: Suppressed duplicate email dispatch for: ${idempotencyKey}`);
    return { success: true, status: 'SENT', duplicateSuppressed: true };
  }
  recentEmailHashes.set(idempotencyKey, Date.now());

  const apiKey = (config.resend?.apiKey || process.env.RESEND_API_KEY || '').trim();
  const fromEmail = (config.resend?.fromEmail || process.env.RESEND_FROM_EMAIL || 'ExamGuard <onboarding@resend.dev>').trim();

  const templateParams = {
    title: title || subject,
    recipientName,
    eventType,
    message,
    details,
    actionUrl,
    actionText,
    paperTitle,
    examDateTime,
    status,
    comments,
    timestamp: new Date().toUTCString(),
  };

  const htmlContent = renderEmailTemplate(templateParams);
  const textContent = renderPlainTextTemplate(templateParams);

  let resendId = null;
  let deliveryStatus = 'SENT';
  let deliveryError = null;
  let attempts = 0;

  if (!apiKey) {
    console.warn(`[EmailService] RESEND_API_KEY not provisioned. Email logged to DB as PENDING: "${subject}" to ${to}`);
    deliveryStatus = 'PENDING';
    deliveryError = 'RESEND_API_KEY is not configured in backend environment.';
  } else {
    const resend = getResendClient();

    // Bounded retries: max 3 attempts for transient issues (rate limits HTTP 429, 5xx, or network timeouts)
    const MAX_ATTEMPTS = 3;
    let success = false;

    while (attempts < MAX_ATTEMPTS && !success) {
      attempts++;
      try {
        const result = await resend.emails.send({
          from: fromEmail,
          to: [to.trim()],
          subject: subject.trim(),
          html: htmlContent,
          text: textContent,
        });

        if (result.error) {
          deliveryStatus = 'FAILED';
          deliveryError = result.error.message || JSON.stringify(result.error);
          console.warn(`[EmailService] Resend SDK attempt ${attempts} returned error:`, deliveryError);

          // Retry on rate limit (429) or transient server errors
          const isRateLimit = deliveryError.toLowerCase().includes('rate') || deliveryError.includes('429');
          if (isRateLimit && attempts < MAX_ATTEMPTS) {
            deliveryStatus = 'RETRY_PENDING';
            const backoffMs = process.env.NODE_ENV === 'test' ? 10 : 1000 * attempts;
            await new Promise((r) => setTimeout(r, backoffMs));
            continue;
          }
          break;
        } else if (result.data?.id) {
          resendId = result.data.id;
          deliveryStatus = 'SENT';
          success = true;
          console.log(`[EmailService] Email successfully sent to ${to} (Resend Message ID: ${resendId})`);
        }
      } catch (sdkErr) {
        deliveryStatus = 'FAILED';
        deliveryError = sdkErr.message || 'Exception during Resend SDK dispatch';
        console.warn(`[EmailService] Resend SDK attempt ${attempts} threw exception:`, deliveryError);
        if (attempts < MAX_ATTEMPTS) {
          deliveryStatus = 'RETRY_PENDING';
          const backoffMs = process.env.NODE_ENV === 'test' ? 10 : 1000 * attempts;
          await new Promise((r) => setTimeout(r, backoffMs));
        }
      }
    }
  }

  // Persist delivery record in Supabase notifications table
  try {
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data: u } = await supabase
        .from('users')
        .select('id')
        .eq('email', to.trim().toLowerCase())
        .maybeSingle();
      if (u) resolvedUserId = u.id;
    }

    if (resolvedUserId) {
      await supabase.from('notifications').insert([
        {
          user_id: resolvedUserId,
          question_paper_id: questionPaperId,
          type: eventType,
          channel: 'EMAIL',
          subject: subject.trim(),
          message: message.trim(),
          scheduled_at: new Date().toISOString(),
          sent_at: deliveryStatus === 'SENT' ? new Date().toISOString() : null,
          status: deliveryStatus,
          error_message: deliveryError,
          resend_email_id: resendId,
          recipient_email: to.trim().toLowerCase(),
          recipient_name: recipientName,
          delivery_attempts: Math.max(1, attempts),
          last_attempt_at: new Date().toISOString(),
          metadata: { details, fromEmail, title, paperTitle },
        },
      ]);
    }
  } catch (dbErr) {
    console.warn('[EmailService] Failed to record email in notifications table:', dbErr.message);
  }

  // Security audit log
  try {
    if (userId) {
      await auditLogService.logAuditEvent({
        userId,
        action: 'EMAIL_DISPATCHED',
        resourceType: 'NOTIFICATION',
        resourceId: resendId || questionPaperId,
        outcome: deliveryStatus === 'SENT' ? 'SUCCESS' : 'FAILURE',
        summary: `Email "${subject}" dispatched to ${to} (Status: ${deliveryStatus})`,
        metadata: { to, eventType, resendId, attempts, error: deliveryError },
      });
    }
  } catch (_) {}

  return {
    success: deliveryStatus === 'SENT',
    resendId,
    status: deliveryStatus,
    attempts,
    error: deliveryError,
  };
}

/**
 * Cryptographic Svix / Resend Webhook Signature Verification
 * Ensures incoming webhooks genuinely originated from Resend.
 *
 * @param {Buffer|string} rawBody - Raw unparsed HTTP request body
 * @param {Object} headers - HTTP request headers
 * @param {string} [secret] - Configured RESEND_WEBHOOK_SECRET
 * @returns {boolean}
 */
function verifyResendWebhookSignature(rawBody, headers = {}, secret = null) {
  const webhookSecret = (secret || config.resend?.webhookSecret || process.env.RESEND_WEBHOOK_SECRET || '').trim();
  if (!webhookSecret) {
    console.warn('[EmailService Webhook] RESEND_WEBHOOK_SECRET not configured. Webhook rejected for security.');
    return false;
  }

  const svixId = headers['svix-id'] || headers['webhook-id'];
  const svixTimestamp = headers['svix-timestamp'] || headers['webhook-timestamp'];
  const svixSignature = headers['svix-signature'] || headers['webhook-signature'];

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn('[EmailService Webhook] Missing Svix signature headers.');
    return false;
  }

  // Check timestamp tolerance (prevent replay attacks, 5 minutes tolerance)
  const timestampNum = parseInt(svixTimestamp, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  if (isNaN(timestampNum) || Math.abs(nowSec - timestampNum) > 300) {
    console.warn('[EmailService Webhook] Timestamp outside 300s tolerance window.');
    return false;
  }

  // Format signature payload: `${id}.${timestamp}.${body}`
  const bodyString = typeof rawBody === 'string' ? rawBody : (rawBody ? rawBody.toString('utf8') : '');
  const toSign = `${svixId}.${svixTimestamp}.${bodyString}`;

  // Resend webhook secrets are typically prefixed with `whsec_`
  let cleanSecret = webhookSecret;
  if (cleanSecret.startsWith('whsec_')) {
    cleanSecret = cleanSecret.substring(6);
  }

  try {
    const secretBuffer = Buffer.from(cleanSecret, 'base64');
    const computedSignature = crypto
      .createHmac('sha256', secretBuffer)
      .update(toSign)
      .digest('base64');

    // Parse signatures from header (e.g. "v1,signature v1,signature2")
    const passedSignatures = svixSignature.split(' ').map((s) => {
      const parts = s.split(',');
      return parts.length === 2 ? parts[1] : parts[0];
    });

    const isValid = passedSignatures.some((sig) => {
      try {
        return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(computedSignature));
      } catch (_) {
        return false;
      }
    });

    return isValid;
  } catch (err) {
    console.error('[EmailService Webhook] Signature verification error:', err.message);
    return false;
  }
}

// Memory store for tracking delivery state across webhook calls
const webhookDeliveryCache = new Map();

/**
 * Processes incoming Resend webhook events and updates database delivery state.
 *
 * @param {Object} event - Resend event payload
 * @returns {Promise<{processed: boolean, status?: string, error?: string}>}
 */
async function processResendWebhookEvent(event) {
  if (!event || !event.type) {
    return { processed: false, error: 'Invalid event payload' };
  }

  const eventType = event.type; // e.g. 'email.delivered', 'email.bounced', 'email.complained'
  const emailId = event.data?.email_id || event.data?.id;

  if (!emailId) {
    console.warn('[EmailService Webhook] Event missing email_id identifier:', eventType);
    return { processed: false, error: 'Missing email_id' };
  }

  console.log(`[EmailService Webhook] Processing event "${eventType}" for Resend ID: ${emailId}`);

  let newStatus = null;
  let deliveredAt = null;
  let bouncedAt = null;
  let errorMessage = null;

  switch (eventType) {
    case 'email.delivered':
      newStatus = 'DELIVERED';
      deliveredAt = new Date().toISOString();
      break;
    case 'email.bounced':
      newStatus = 'FAILED';
      bouncedAt = new Date().toISOString();
      errorMessage = event.data?.bounce_message || event.data?.message || 'Email bounced by recipient mail server';
      break;
    case 'email.complained':
      newStatus = 'FAILED';
      errorMessage = 'Recipient marked notification as spam/complaint';
      break;
    case 'email.delivery_delayed':
      newStatus = 'RETRY_PENDING';
      errorMessage = 'Delivery delayed by recipient server';
      break;
    default:
      console.log(`[EmailService Webhook] Ignored non-delivery event type: ${eventType}`);
      return { processed: true, ignored: true };
  }

  // Cache in-memory delivery state immediately
  webhookDeliveryCache.set(emailId, {
    status: newStatus,
    eventType,
    deliveredAt,
    bouncedAt,
    errorMessage,
    updatedAt: new Date().toISOString(),
  });

  try {
    const updatePayload = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (deliveredAt) updatePayload.delivered_at = deliveredAt;
    if (bouncedAt) updatePayload.bounced_at = bouncedAt;
    if (errorMessage) updatePayload.error_message = errorMessage;

    const { error: dbErr } = await supabase
      .from('notifications')
      .update(updatePayload)
      .eq('resend_email_id', emailId);

    if (dbErr) {
      console.warn('[EmailService Webhook] Supabase update notice (cached in-memory):', dbErr.message);
    }

    return { processed: true, status: newStatus };
  } catch (err) {
    console.warn('[EmailService Webhook] Supabase connection notice (cached in-memory):', err.message);
    return { processed: true, status: newStatus };
  }
}

module.exports = {
  sendExamGuardEmail,
  renderEmailTemplate,
  renderPlainTextTemplate,
  verifyResendWebhookSignature,
  processResendWebhookEvent,
  webhookDeliveryCache,
};

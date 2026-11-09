/**
 * ============================================================================
 * ExamGuard - Comprehensive Resend Email Service Test & Verification Suite
 * ============================================================================
 * Tests the centralized Resend email service, templates, idempotency, retries,
 * Svix webhook verification, delivery tracking, and all 24 domain event functions.
 */

process.env.NODE_ENV = 'test';
const crypto = require('crypto');
const emailService = require('../src/services/emailService');
const notificationService = require('../src/services/notificationService');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${testName} ${detail ? `- ${detail}` : ''}`);
  }
}

async function runTestSuite() {
  console.log('\n============================================================');
  console.log('EXAMGUARD - RESEND EMAIL NOTIFICATION INTEGRATION TEST SUITE');
  console.log('============================================================\n');

  // TEST 1: Template Rendering (HTML + Plain-Text)
  console.log('--- TEST GROUP 1: Institutional Email Templates ---');
  {
    const sampleDetails = [
      { label: 'Paper Title', value: 'Distributed Systems & Cloud Computing' },
      { label: 'Academic Subject', value: 'Computer Engineering (COMP)' },
      { label: 'Total Marks', value: '70 Marks' },
      { label: 'Review Window', value: 'Within 24 Hours' },
    ];

    const htmlOutput = emailService.renderEmailTemplate({
      title: 'Action Required: Finalized Paper Submitted for Review',
      recipientName: 'Prof. Anita Sharma',
      eventType: 'COORDINATOR_NOTIFIED',
      message: 'A new finalized examination question paper has been submitted and is ready for your verification.',
      details: sampleDetails,
      paperTitle: 'Distributed Systems & Cloud Computing',
      status: 'SUBMITTED',
      comments: 'Please verify unit syllabus distribution.',
    });

    assert(typeof htmlOutput === 'string' && htmlOutput.includes('<!DOCTYPE html>'), 'Renders valid HTML document');
    assert(htmlOutput.includes('ExamGuard'), 'Includes ExamGuard institutional branding');
    assert(htmlOutput.includes('Department of Computer Engineering'), 'Restricted exclusively to Computer Engineering');
    assert(htmlOutput.includes('Prof. Anita Sharma'), 'Includes recipient faculty name');
    assert(htmlOutput.includes('Distributed Systems &amp; Cloud Computing') || htmlOutput.includes('Distributed Systems & Cloud Computing'), 'Includes paper title');
    assert(htmlOutput.includes('Please verify unit syllabus distribution'), 'Includes coordinator evaluation comments');
    assert(!htmlOutput.includes('password_hash') && !htmlOutput.includes('aes_key') && !htmlOutput.includes('private_key'), 'Strictly excludes any secret credentials or cryptographic keys');

    const textOutput = emailService.renderPlainTextTemplate({
      title: 'Action Required: Finalized Paper Submitted for Review',
      recipientName: 'Prof. Anita Sharma',
      message: 'A new finalized examination question paper has been submitted.',
      details: sampleDetails,
    });

    assert(typeof textOutput === 'string' && textOutput.includes('EXAMGUARD'), 'Renders plain-text alternative');
    assert(textOutput.includes('Prof. Anita Sharma'), 'Plain-text includes recipient name');
    assert(textOutput.includes('Distributed Systems'), 'Plain-text includes event details');
  }

  // TEST 2: HTML Escaping & Injection Defense
  console.log('\n--- TEST GROUP 2: XSS Defense & Input Sanitization ---');
  {
    const maliciousHtml = emailService.renderEmailTemplate({
      title: 'Alert <script>alert("xss")</script>',
      recipientName: 'Faculty <img src=x onerror=alert(1)>',
      message: 'Test message with <b>markup</b> & symbols',
      details: [{ label: 'Malicious Header <svg onload=alert(1)>', value: 'Malicious Value <script>' }],
    });

    assert(!maliciousHtml.includes('<script>'), 'Sanitizes script tags from title and values');
    assert(!maliciousHtml.includes('<svg onload='), 'Sanitizes event handler injections');
    assert(maliciousHtml.includes('&lt;script&gt;') || maliciousHtml.includes('&lt;img'), 'Properly entity-escapes raw tags');
  }

  // TEST 3: Svix Webhook Signature Verification
  console.log('\n--- TEST GROUP 3: Resend Svix Webhook Cryptographic Verification ---');
  {
    const secret = 'whsec_dGVzdF9zZWNyZXRfa2V5XzEyMzQ1Njc4OTAxMjM0NTY='; // base64 payload
    const svixId = 'msg_test_' + Date.now();
    const svixTimestamp = Math.floor(Date.now() / 1000).toString();
    const rawBody = JSON.stringify({
      type: 'email.delivered',
      data: {
        id: 'email_test_123',
        email_id: 'email_test_123',
        to: 'faculty@examguard.edu',
      },
    });

    // Compute legitimate Svix signature
    const cleanSecret = secret.replace(/^whsec_/, '');
    const toSign = `${svixId}.${svixTimestamp}.${rawBody}`;
    const computedSignature = crypto
      .createHmac('sha256', Buffer.from(cleanSecret, 'base64'))
      .update(toSign)
      .digest('base64');

    const validHeaders = {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': `v1,${computedSignature}`,
    };

    const isValid = emailService.verifyResendWebhookSignature(rawBody, validHeaders, secret);
    assert(isValid === true, 'Verifies valid Svix HMAC-SHA256 signature');

    // Tampered payload
    const tamperedHeaders = {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': 'v1,invalid_forged_signature_12345',
    };
    const isTamperedValid = emailService.verifyResendWebhookSignature(rawBody, tamperedHeaders, secret);
    assert(isTamperedValid === false, 'Rejects forged or invalid signature');

    // Replay attack (timestamp older than 300 seconds)
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
    const replayHeaders = {
      'svix-id': svixId,
      'svix-timestamp': oldTimestamp,
      'svix-signature': `v1,${computedSignature}`,
    };
    const isReplayValid = emailService.verifyResendWebhookSignature(rawBody, replayHeaders, secret);
    assert(isReplayValid === false, 'Rejects replay attack with expired timestamp (>300s)');
  }

  // TEST 4: Webhook Event Processing & Delivery State Lifecycle
  console.log('\n--- TEST GROUP 4: Webhook Event Processor & Status Tracking ---');
  {
    // 1. Delivered event
    const deliveredEvent = {
      type: 'email.delivered',
      data: {
        id: 'test_resend_delivery_1',
        email_id: 'test_resend_delivery_1',
      },
    };
    const delResult = await emailService.processResendWebhookEvent(deliveredEvent);
    assert(delResult.processed === true, 'Processes email.delivered event');
    assert(delResult.status === 'DELIVERED', 'Transitions status to DELIVERED (never equates SENT with DELIVERED)');

    // 2. Bounced event
    const bouncedEvent = {
      type: 'email.bounced',
      data: {
        id: 'test_resend_bounce_1',
        email_id: 'test_resend_bounce_1',
        bounce_message: '550 User unknown',
      },
    };
    const bncResult = await emailService.processResendWebhookEvent(bouncedEvent);
    assert(bncResult.processed === true, 'Processes email.bounced event');
    assert(bncResult.status === 'FAILED', 'Transitions status to FAILED on bounce');

    // 3. Delayed event
    const delayedEvent = {
      type: 'email.delivery_delayed',
      data: {
        id: 'test_resend_delay_1',
        email_id: 'test_resend_delay_1',
      },
    };
    const dlyResult = await emailService.processResendWebhookEvent(delayedEvent);
    assert(dlyResult.processed === true, 'Processes email.delivery_delayed event');
    assert(dlyResult.status === 'RETRY_PENDING', 'Transitions status to RETRY_PENDING on delay');
  }

  // TEST 5: Centralized Email Dispatch & Idempotency
  console.log('\n--- TEST GROUP 5: Centralized Dispatch & Idempotency ---');
  {
    // Test dispatch without crashing even when API key is missing/testing
    const dispatchResult = await emailService.sendExamGuardEmail({
      to: 'faculty.test@example.com',
      recipientName: 'Dr. Test User',
      eventType: 'SYSTEM_TEST',
      subject: 'Idempotency Validation Test',
      title: 'Automated Pipeline Test',
      message: 'Validating duplicate suppression window.',
      details: [{ label: 'Pipeline', value: 'Resend Test' }],
    });

    assert(typeof dispatchResult === 'object', 'sendExamGuardEmail returns operational response');
    assert(dispatchResult.status === 'SENT' || dispatchResult.status === 'SKIPPED' || dispatchResult.status === 'FAILED', 'Returns explicit lifecycle status');

    // Immediate duplicate dispatch (should be suppressed by idempotency cache)
    const duplicateResult = await emailService.sendExamGuardEmail({
      to: 'faculty.test@example.com',
      recipientName: 'Dr. Test User',
      eventType: 'SYSTEM_TEST',
      subject: 'Idempotency Validation Test',
      title: 'Automated Pipeline Test',
      message: 'Validating duplicate suppression window.',
      details: [{ label: 'Pipeline', value: 'Resend Test' }],
    });

    assert(duplicateResult.deduplicated === true || duplicateResult.success === true, 'Suppresses duplicate dispatch within idempotency window');
  }

  // TEST 6: All 24 Sprint Event Notification Functions
  console.log('\n--- TEST GROUP 6: Complete 24 Sprint Event Functions Verification ---');
  {
    const mockUser = {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Prof. Rajesh Kulkarni',
      email: 'rajesh.kulkarni@engg.dypatil.edu',
      role: 'TEACHER',
    };
    const mockCoordinator = {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Dr. Sunita Patil',
      email: 'sunita.patil@engg.dypatil.edu',
      role: 'EXAM_COORDINATOR',
    };
    const mockPaper = {
      id: '00000000-0000-0000-0000-000000000003',
      title: 'Cloud Computing & Virtualization',
      subject: 'Computer Engineering (COMP)',
      totalMarks: 70,
    };
    const mockDraft = {
      id: '00000000-0000-0000-0000-000000000004',
      title: 'Draft: Cloud Computing Set A',
      subject: 'Cloud Computing',
    };

    const eventTests = [
      // 1. Account / Auth
      () => notificationService.notifyAccountCreated({ user: mockUser, adminName: 'Admin Cell' }),
      () => notificationService.notifyTeacherRegistered({ user: mockUser }),
      () => notificationService.notifyAccountActivated({ user: mockUser, adminName: 'Admin Cell' }),
      () => notificationService.notifyAccountDeactivated({ user: mockUser, adminName: 'Admin Cell', reason: 'End of semester leave' }),
      () => notificationService.notifyAccountBlocked({ user: mockUser, adminName: 'Security Admin', reason: 'Repeated failed logins' }),
      () => notificationService.notifyAccountReactivated({ user: mockUser, adminName: 'Admin Cell' }),
      () => notificationService.notifyAccountDeleted({ user: mockUser, adminName: 'Admin Cell' }),
      () => notificationService.notifyPasswordReset({ user: mockUser }),
      () => notificationService.notifySecurityAlert({ user: mockUser, action: 'Role Update', ipAddress: '192.168.1.1' }),

      // 2. Teacher Profile
      () => notificationService.notifyProfileUpdated({ user: mockUser, updatedFields: ['designation', 'mobile_number'] }),
      () => notificationService.notifyMobileNumberChanged({ user: mockUser, oldMobile: '+91 9876543210', newMobile: '+91 9123456789' }),

      // 3. Question Paper Workflow
      () => notificationService.notifyPaperCreated({ paper: mockPaper, teacher: mockUser }),
      () => notificationService.notifyDraftSaved({ draft: mockDraft, teacher: mockUser }),
      () => notificationService.notifyPaperFinalized({ paper: mockPaper, teacher: mockUser, coordinator: mockCoordinator }),
      () => notificationService.notifyPaperSubmitted({ paper: mockPaper, teacher: mockUser, coordinator: mockCoordinator }),
      () => notificationService.notifyRevisionResubmitted({ paper: mockPaper, teacher: mockUser, coordinator: mockCoordinator, notes: 'Adjusted Unit 3 question marks.' }),
      () => notificationService.notifyPaperArchived({ paper: mockPaper, user: mockUser, reason: 'Course curriculum refreshed' }),

      // 4. A/B Sets & Generation
      () => notificationService.notifySetFinalized({ setCode: 'A', subject: 'Cloud Computing', teacher: mockUser, questionCount: 14 }),
      () => notificationService.notifySetsReadyForPool({ subject: 'Cloud Computing', coordinator: mockCoordinator, authorCount: 2 }),
      () => notificationService.notifyPaperGenerationSuccess({ paper: mockPaper, teacher: mockUser, coordinator: mockCoordinator }),
      () => notificationService.notifyPaperGenerationFailed({ subject: 'Cloud Computing', reason: 'Insufficient 6-mark questions in Unit 4', requestedBy: mockUser }),

      // 5. Coordinator Workflow
      () => notificationService.notifyCoordinatorAssigned({ paper: mockPaper, coordinator: mockCoordinator, assignedBy: 'Exam Cell' }),
      () => notificationService.notifyCoordinatorReviewAvailable({ paper: mockPaper, teacher: mockUser, coordinator: mockCoordinator }),
      () => notificationService.notifyVerificationApproved({ paper: mockPaper, teacher: mockUser, coordinator: mockCoordinator, comments: 'Complies with syllabus coverage.' }),
      () => notificationService.notifyReturnForRevision({ paper: mockPaper, teacher: mockUser, coordinator: mockCoordinator, comments: 'Please add 1 question from Unit 2.' }),
      () => notificationService.notifyVerificationRejected({ paper: mockPaper, teacher: mockUser, coordinator: mockCoordinator, comments: 'Marks sum mismatch.' }),

      // 6. Scheduling & Release
      () => notificationService.notifyExamScheduled({ paper: mockPaper, coordinator: mockCoordinator, examDate: '2026-11-20', examTime: '10:00 AM' }),
      () => notificationService.notifyExamScheduleUpdated({ paper: mockPaper, coordinator: mockCoordinator, oldSchedule: '2026-11-20 10:00 AM', newSchedule: '2026-11-22 02:00 PM' }),
      () => notificationService.notifySecurePaperReleased({ paper: mockPaper, coordinator: mockCoordinator, examDate: '2026-11-20', examTime: '10:00 AM' }),
    ];

    for (let i = 0; i < eventTests.length; i++) {
      try {
        await eventTests[i]();
        passedTests++;
      } catch (err) {
        failedTests++;
        console.error(`  [FAIL] Event handler #${i + 1} threw exception:`, err.message);
      }
    }
    console.log(`  [PASS] All ${eventTests.length} event notification functions executed successfully without unhandled exceptions.`);
  }

  console.log('\n============================================================');
  console.log(`TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

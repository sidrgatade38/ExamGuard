/**
 * ============================================================================
 * ExamGuard - Notification Service (Module 10 & 22 & 26)
 * Secure Examination Question Paper Management System
 * Computer Engineering Department
 * ============================================================================
 *
 * Implements authoritative email-based notifications via Resend for all critical system events.
 * Persists delivery status and tracking metadata in Supabase notifications table.
 *
 * All functions resolve recipient details (email, name) automatically from database if not supplied.
 * Strictly adheres to institutional security: never sends questions, plaintext exam data,
 * private keys, or passwords.
 */

const { supabase } = require('../config/supabase');
const auditLogService = require('./auditLogService');
const { sendExamGuardEmail } = require('./emailService');

function isValidUuid(id) {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Resolves user email and name by user ID
 */
async function resolveUserContact(userId) {
  if (!userId) return null;
  try {
    const { data: user } = await supabase
      .from('users')
      .select('id, name, email, role_id, is_active')
      .eq('id', userId)
      .maybeSingle();
    return user;
  } catch (_) {
    return null;
  }
}

/**
 * Helper to ensure recipient object has name, email, and id
 */
async function ensureContact(recipient) {
  if (!recipient) return null;
  if (typeof recipient === 'string') {
    return await resolveUserContact(recipient);
  }
  if (recipient.id && !recipient.email) {
    const resolved = await resolveUserContact(recipient.id);
    return resolved ? { ...recipient, ...resolved } : recipient;
  }
  return recipient;
}

/* ============================================================================
 * 1. ACCOUNT & AUTHENTICATION NOTIFICATIONS
 * ============================================================================ */

/**
 * New user account created by Admin
 */
async function notifyAccountCreated({ user, adminName }) {
  const target = await ensureContact(user);
  if (!target || !target.email) return;

  await sendExamGuardEmail({
    to: target.email,
    recipientName: target.name,
    userId: target.id,
    eventType: 'ACCOUNT_CREATED',
    subject: 'ExamGuard Account Created — Department of Computer Engineering',
    title: 'New Institutional Account Provisioned',
    message: `An institutional user account has been provisioned for you by Administrator ${adminName || 'Admin'}. You have been granted access to the ExamGuard platform for the Department of Computer Engineering.`,
    details: [
      { label: 'Full Name', value: target.name },
      { label: 'Email Address', value: target.email },
      { label: 'Role', value: target.role || 'Faculty Member' },
      { label: 'Academic Department', value: 'Department of Computer Engineering' },
      { label: 'Status', value: 'Active' },
    ],
  });
}

/**
 * Teacher self-registration or direct activation
 */
async function notifyTeacherRegistered({ user }) {
  const target = await ensureContact(user);
  if (!target || !target.email) return;

  await sendExamGuardEmail({
    to: target.email,
    recipientName: target.name,
    userId: target.id,
    eventType: 'TEACHER_REGISTERED',
    subject: 'Welcome to ExamGuard — Teacher Account Registered',
    title: 'Teacher Account Registered Successfully',
    message: 'Your faculty account has been registered in the ExamGuard Secure Examination System for the Department of Computer Engineering. You may now access your dashboard to author question papers, manage drafts, and configure examination blueprints.',
    details: [
      { label: 'Full Name', value: target.name },
      { label: 'Email Address', value: target.email },
      { label: 'Academic Department', value: 'Department of Computer Engineering' },
      { label: 'Role', value: 'TEACHER' },
      { label: 'Status', value: 'Active' },
    ],
  });
}

/**
 * Account Activated
 */
async function notifyAccountActivated({ user, adminName }) {
  const target = await ensureContact(user);
  if (!target || !target.email) return;

  await sendExamGuardEmail({
    to: target.email,
    recipientName: target.name,
    userId: target.id,
    eventType: 'ACCOUNT_ACTIVATED',
    subject: 'ExamGuard Account Activated',
    title: 'Your Account Has Been Activated',
    message: `Your ExamGuard account has been activated by ${adminName || 'the administrator'}. You now have full access to your authorized examination workspace in the Department of Computer Engineering.`,
    details: [
      { label: 'Account Name', value: target.name },
      { label: 'Email Address', value: target.email },
      { label: 'Status', value: 'Active' },
      { label: 'Activated At', value: new Date().toLocaleString() },
    ],
  });
}

/**
 * Account Deactivated
 */
async function notifyAccountDeactivated({ user, adminName, reason }) {
  const target = await ensureContact(user);
  if (!target || !target.email) return;

  await sendExamGuardEmail({
    to: target.email,
    recipientName: target.name,
    userId: target.id,
    eventType: 'ACCOUNT_DEACTIVATED',
    subject: 'ExamGuard Account Deactivated',
    title: 'Account Access Deactivated',
    message: `Your ExamGuard account has been deactivated by ${adminName || 'the administrator'}. Login access has been suspended. Please contact the Examination Cell or department administrator if you require reactivation.`,
    details: [
      { label: 'Account Name', value: target.name },
      { label: 'Email Address', value: target.email },
      { label: 'Status', value: 'Deactivated' },
      ...(reason ? [{ label: 'Reason', value: reason }] : []),
    ],
  });
}

/**
 * Account Blocked
 */
async function notifyAccountBlocked({ user, adminName, reason }) {
  const target = await ensureContact(user);
  if (!target || !target.email) return;

  await sendExamGuardEmail({
    to: target.email,
    recipientName: target.name,
    userId: target.id,
    eventType: 'ACCOUNT_BLOCKED',
    subject: 'Security Notice: ExamGuard Account Blocked',
    title: 'Account Access Blocked',
    message: `Your ExamGuard account has been blocked by ${adminName || 'security administration'}. All active sessions have been terminated.`,
    details: [
      { label: 'Account Name', value: target.name },
      { label: 'Email Address', value: target.email },
      { label: 'Status', value: 'Blocked' },
      { label: 'Reason', value: reason || 'Administrative / Security policy enforcement' },
    ],
  });
}

/**
 * Account Reactivated
 */
async function notifyAccountReactivated({ user, adminName }) {
  const target = await ensureContact(user);
  if (!target || !target.email) return;

  await sendExamGuardEmail({
    to: target.email,
    recipientName: target.name,
    userId: target.id,
    eventType: 'ACCOUNT_ACTIVATED',
    subject: 'ExamGuard Account Reactivated',
    title: 'Account Access Restored',
    message: `Your ExamGuard account has been reactivated by ${adminName || 'the administrator'}. You may now log in to access your examination workspace.`,
    details: [
      { label: 'Account Name', value: target.name },
      { label: 'Email Address', value: target.email },
      { label: 'Status', value: 'Active' },
    ],
  });
}

/**
 * Unified Account Status Changed handler (calls activated/deactivated)
 */
async function notifyAccountStatusChanged({ user, isActive, reason, adminName }) {
  if (isActive) {
    return notifyAccountActivated({ user, adminName });
  } else {
    return notifyAccountDeactivated({ user, adminName, reason });
  }
}

/**
 * Account Deleted / Access Revoked
 */
async function notifyAccountDeleted({ user, adminName }) {
  const target = await ensureContact(user);
  if (!target || !target.email) return;

  await sendExamGuardEmail({
    to: target.email,
    recipientName: target.name,
    userId: target.id,
    eventType: 'ACCOUNT_DELETED',
    subject: 'ExamGuard Account Access Revoked',
    title: 'Institutional Access Revoked',
    message: `Your active login access to the ExamGuard Examination System has been removed by ${adminName || 'the administrator'}. In accordance with institutional data retention requirements, your historical examination papers, cryptographic verification records, and audit logs remain securely preserved in institutional records.`,
    details: [
      { label: 'Account Name', value: target.name },
      { label: 'Email Address', value: target.email },
      { label: 'Records Retained', value: 'Historical Question Papers & Audit Trail' },
      { label: 'Department', value: 'Department of Computer Engineering' },
    ],
  });
}

/**
 * Password Reset notification
 */
async function notifyPasswordReset({ user }) {
  const target = await ensureContact(user);
  if (!target || !target.email) return;

  await sendExamGuardEmail({
    to: target.email,
    recipientName: target.name,
    userId: target.id,
    eventType: 'PASSWORD_RESET',
    subject: 'ExamGuard Security: Password Reset Confirmation',
    title: 'Account Password Changed',
    message: 'The password for your ExamGuard institutional account was recently updated. If you did not make this change, please contact your department administrator immediately.',
    details: [
      { label: 'Account Name', value: target.name },
      { label: 'Email Address', value: target.email },
      { label: 'Timestamp', value: new Date().toLocaleString() },
    ],
  });
}

/**
 * Security Alert Notification
 */
async function notifySecurityAlert({ user, action, ipAddress, userAgent }) {
  const target = await ensureContact(user);
  if (!target || !target.email) return;

  await sendExamGuardEmail({
    to: target.email,
    recipientName: target.name,
    userId: target.id,
    eventType: 'SECURITY_ALERT',
    subject: 'ExamGuard Security Alert: Important Account Activity',
    title: 'Security Alert on Your Account',
    message: `A security-sensitive action (${action || 'Security State Change'}) was performed on your ExamGuard account.`,
    details: [
      { label: 'Account', value: target.name },
      { label: 'Action', value: action || 'Security Policy Trigger' },
      ...(ipAddress ? [{ label: 'IP Address', value: ipAddress }] : []),
      ...(userAgent ? [{ label: 'Client', value: userAgent }] : []),
      { label: 'Timestamp', value: new Date().toLocaleString() },
    ],
  });
}

/* ============================================================================
 * 2. TEACHER PROFILE NOTIFICATIONS
 * ============================================================================ */

/**
 * Profile information updated
 */
async function notifyProfileUpdated({ user, updatedFields = [] }) {
  const target = await ensureContact(user);
  if (!target || !target.email) return;

  await sendExamGuardEmail({
    to: target.email,
    recipientName: target.name,
    userId: target.id,
    eventType: 'PROFILE_UPDATED',
    subject: 'ExamGuard Profile Updated',
    title: 'Faculty Profile Changes Saved',
    message: 'Your faculty profile settings have been successfully updated in the ExamGuard system.',
    details: [
      { label: 'Faculty Name', value: target.name },
      { label: 'Email Address', value: target.email },
      { label: 'Department', value: 'Department of Computer Engineering' },
      { label: 'Update Timestamp', value: new Date().toLocaleString() },
      ...(updatedFields.length > 0 ? [{ label: 'Modified Fields', value: updatedFields.join(', ') }] : []),
    ],
  });
}

/**
 * Mobile number changed
 */
async function notifyMobileNumberChanged({ user, oldMobile, newMobile }) {
  const target = await ensureContact(user);
  if (!target || !target.email) return;

  await sendExamGuardEmail({
    to: target.email,
    recipientName: target.name,
    userId: target.id,
    eventType: 'PROFILE_UPDATED',
    subject: 'ExamGuard Security: Faculty Mobile Number Changed',
    title: 'Contact Information Updated',
    message: 'Your registered faculty mobile phone number in ExamGuard has been updated. If you did not initiate this change, contact your administrator.',
    details: [
      { label: 'Faculty Name', value: target.name },
      { label: 'Email Address', value: target.email },
      { label: 'Updated Mobile', value: newMobile ? `${newMobile.slice(0, 3)}****${newMobile.slice(-3)}` : 'Updated' },
      { label: 'Timestamp', value: new Date().toLocaleString() },
    ],
  });
}

/* ============================================================================
 * 3. QUESTION PAPER WORKFLOW NOTIFICATIONS
 * ============================================================================ */

/**
 * Question Paper Created
 */
async function notifyPaperCreated({ paper, teacher }) {
  const author = await ensureContact(teacher || paper?.created_by);
  if (!author || !author.email) return;

  await sendExamGuardEmail({
    to: author.email,
    recipientName: author.name,
    userId: author.id,
    questionPaperId: paper.id,
    eventType: 'QUESTION_PAPER_CREATED',
    subject: `Question Paper Created: ${paper.title}`,
    title: 'Question Paper Initialized',
    message: `Your new question paper "${paper.title}" for ${paper.subject} has been initialized in your teacher workspace. You may proceed through the 5-step workflow to configure blueprint, add questions, review, and finalize.`,
    details: [
      { label: 'Paper Title', value: paper.title },
      { label: 'Academic Subject', value: paper.subject },
      { label: 'Pattern', value: paper.pattern || '2024 / 2025 Autonomous' },
      { label: 'Created At', value: new Date().toLocaleString() },
    ],
  });
}

/**
 * Draft Saved
 */
async function notifyDraftSaved({ draft, teacher }) {
  const author = await ensureContact(teacher || draft?.user_id);
  if (!author || !author.email) return;

  await sendExamGuardEmail({
    to: author.email,
    recipientName: author.name,
    userId: author.id,
    eventType: 'DRAFT_SAVED',
    subject: `Draft Saved: ${draft.title || 'Question Paper Draft'}`,
    title: 'Question Paper Draft Saved',
    message: `Your progress on draft "${draft.title || 'Question Paper'}" has been securely saved. You can resume editing anytime from your Drafts workspace.`,
    details: [
      { label: 'Draft Title', value: draft.title || 'Untitled Draft' },
      { label: 'Subject', value: draft.subject || 'Computer Engineering' },
      { label: 'Saved At', value: new Date().toLocaleString() },
    ],
  });
}

/**
 * Question Paper Finalized & Submitted for Verification
 */
async function notifyPaperFinalized({ paper, teacher, coordinator }) {
  const author = await ensureContact(teacher || paper?.created_by);
  const reviewer = await ensureContact(coordinator || paper?.assigned_coordinator_id);

  // 1. Notify Teacher
  if (author && author.email) {
    await sendExamGuardEmail({
      to: author.email,
      recipientName: author.name,
      userId: author.id,
      questionPaperId: paper.id,
      eventType: 'QUESTION_PAPER_FINALIZED',
      subject: `Question Paper Finalized: ${paper.title}`,
      title: 'Question Paper Cryptographically Secured & Submitted',
      message: `Your question paper "${paper.title}" for ${paper.subject} has been finalized, encrypted using AES-256-GCM, signed with RSA-PSS-SHA256, and submitted for coordinator verification. It is available for review within 24 hours.`,
      details: [
        { label: 'Paper Title', value: paper.title },
        { label: 'Subject', value: paper.subject },
        { label: 'Total Marks', value: `${paper.totalMarks || paper.total_marks || 70} Marks` },
        { label: 'Reviewer', value: reviewer?.name || 'Exam Coordinator' },
        { label: 'Finalized At', value: new Date().toLocaleString() },
      ],
    });
  }

  // 2. Notify Coordinator
  if (reviewer && reviewer.email) {
    await sendExamGuardEmail({
      to: reviewer.email,
      recipientName: reviewer.name,
      userId: reviewer.id,
      questionPaperId: paper.id,
      eventType: 'COORDINATOR_NOTIFIED',
      subject: `Action Required: Finalized Paper Submitted for Review — ${paper.title}`,
      title: 'New Examination Paper Available for Review',
      message: `Faculty member ${author?.name || 'Teacher'} has submitted the finalized question paper "${paper.title}" (${paper.subject}). It is now available in your Coordinator Review Workspace. Administrative review and verification must be completed within 24 hours. Decrypted content release is locked until 1 hour prior to the scheduled exam.`,
      details: [
        { label: 'Paper Title', value: paper.title },
        { label: 'Authoring Faculty', value: author?.name || 'Teacher' },
        { label: 'Academic Subject', value: paper.subject },
        { label: 'Review Window', value: 'Within 24 Hours of Finalization' },
        { label: 'Content Release', value: '1 Hour Prior to Scheduled Exam' },
      ],
    });
  }
}

/**
 * Alias for notifyPaperFinalized when submitting
 */
const notifyPaperSubmitted = notifyPaperFinalized;

/**
 * Question Paper Resubmitted after Revision
 */
async function notifyRevisionResubmitted({ paper, teacher, coordinator, notes }) {
  const author = await ensureContact(teacher || paper?.created_by);
  const reviewer = await ensureContact(coordinator || paper?.assigned_coordinator_id);

  // Notify Coordinator
  if (reviewer && reviewer.email) {
    await sendExamGuardEmail({
      to: reviewer.email,
      recipientName: reviewer.name,
      userId: reviewer.id,
      questionPaperId: paper.id,
      eventType: 'REVISION_RESUBMITTED',
      subject: `Revision Resubmitted: ${paper.title} (${paper.subject})`,
      title: 'Revised Question Paper Resubmitted for Review',
      message: `Faculty member ${author?.name || 'Teacher'} has addressed previous revision notes and resubmitted the question paper "${paper.title}" for your verification.`,
      details: [
        { label: 'Paper Title', value: paper.title },
        { label: 'Subject', value: paper.subject },
        { label: 'Authoring Faculty', value: author?.name || 'Teacher' },
        ...(notes ? [{ label: 'Faculty Response Notes', value: notes }] : []),
        { label: 'Resubmitted At', value: new Date().toLocaleString() },
      ],
    });
  }

  // Notify Teacher
  if (author && author.email) {
    await sendExamGuardEmail({
      to: author.email,
      recipientName: author.name,
      userId: author.id,
      questionPaperId: paper.id,
      eventType: 'REVISION_RESUBMITTED',
      subject: `Confirmation: Revised Paper Resubmitted — ${paper.title}`,
      title: 'Revised Question Paper Resubmitted',
      message: `Your revised question paper "${paper.title}" has been successfully resubmitted to Exam Coordinator ${reviewer?.name || 'Coordinator'} for verification.`,
      details: [
        { label: 'Paper Title', value: paper.title },
        { label: 'Subject', value: paper.subject },
        { label: 'Resubmitted At', value: new Date().toLocaleString() },
      ],
    });
  }
}

/**
 * Question Paper Archived or Deleted
 */
async function notifyPaperArchived({ paper, user, reason }) {
  const target = await ensureContact(user || paper?.created_by);
  if (!target || !target.email) return;

  await sendExamGuardEmail({
    to: target.email,
    recipientName: target.name,
    userId: target.id,
    questionPaperId: paper.id,
    eventType: 'QUESTION_PAPER_ARCHIVED',
    subject: `Notice: Question Paper Archived — ${paper.title}`,
    title: 'Question Paper Archived in Institutional Records',
    message: `The question paper "${paper.title}" for ${paper.subject} has been moved to archived status. It is safely retained in institutional records and audit history.`,
    details: [
      { label: 'Paper Title', value: paper.title },
      { label: 'Subject', value: paper.subject },
      { label: 'Archived At', value: new Date().toLocaleString() },
      ...(reason ? [{ label: 'Reason', value: reason }] : []),
    ],
  });
}

/* ============================================================================
 * 4. A/B SETS & PAPER GENERATION NOTIFICATIONS
 * ============================================================================ */

/**
 * Set Finalized into Shared Pool
 */
async function notifySetFinalized({ setCode, subject, teacher, questionCount }) {
  const author = await ensureContact(teacher);
  if (!author || !author.email) return;

  await sendExamGuardEmail({
    to: author.email,
    recipientName: author.name,
    userId: author.id,
    eventType: 'SET_FINALIZED',
    subject: `Set ${setCode} Finalized for Subject Pool: ${subject}`,
    title: `Examination Set ${setCode} Finalized`,
    message: `Your candidate questions for Set ${setCode} under subject "${subject}" have been successfully finalized and contributed to the shared subject-level question pool. Authorized paper generation will draw from both Set A and Set B to produce balanced, shuffled final sets with full author traceability.`,
    details: [
      { label: 'Subject', value: subject },
      { label: 'Set Designation', value: `Set ${setCode}` },
      { label: 'Authoring Faculty', value: author.name },
      { label: 'Questions Contributed', value: `${questionCount || 0} Questions` },
      { label: 'Status', value: 'Active in Shared Pool' },
    ],
  });
}

/**
 * Both Sets Ready for Pool Generation
 */
async function notifySetsReadyForPool({ subject, coordinator, authorCount }) {
  const reviewer = await ensureContact(coordinator);
  if (!reviewer || !reviewer.email) return;

  await sendExamGuardEmail({
    to: reviewer.email,
    recipientName: reviewer.name,
    userId: reviewer.id,
    eventType: 'SETS_READY_FOR_POOL',
    subject: `Shared Pool Ready: Both Set A and Set B Finalized for ${subject}`,
    title: 'Question Pool Ready for Automated Set Generation',
    message: `Both required question sets (Set A and Set B) have been finalized for subject "${subject}". The shared subject pool is now complete and ready for balanced automated paper generation and shuffling.`,
    details: [
      { label: 'Academic Subject', value: subject },
      { label: 'Contributing Authors', value: `${authorCount || 2} Faculty Members` },
      { label: 'Pool Status', value: 'Ready for Generation' },
      { label: 'Department', value: 'Department of Computer Engineering' },
    ],
  });
}

/**
 * Question Paper Generation Succeeded
 */
async function notifyPaperGenerationSuccess({ paper, teacher, coordinator }) {
  const author = await ensureContact(teacher || paper?.created_by);
  if (author && author.email) {
    await sendExamGuardEmail({
      to: author.email,
      recipientName: author.name,
      userId: author.id,
      questionPaperId: paper?.id,
      eventType: 'PAPER_GENERATION_SUCCESS',
      subject: `Paper Generation Succeeded: ${paper?.title || 'Question Paper'}`,
      title: 'Automated Question Paper Generation Complete',
      message: `The automated question paper generation for "${paper?.title || 'Paper'}" (${paper?.subject}) has completed successfully. Sets have been cryptographically balanced and secured with AES-256-GCM.`,
      details: [
        { label: 'Paper Title', value: paper?.title || 'Generated Paper' },
        { label: 'Subject', value: paper?.subject || 'Computer Engineering' },
        { label: 'Status', value: 'Generated & Encrypted' },
      ],
    });
  }
}

/**
 * Question Paper Generation Failed
 */
async function notifyPaperGenerationFailed({ subject, reason, requestedBy }) {
  const target = await ensureContact(requestedBy);
  if (!target || !target.email) return;

  await sendExamGuardEmail({
    to: target.email,
    recipientName: target.name,
    userId: target.id,
    eventType: 'PAPER_GENERATION_FAILED',
    subject: `Alert: Question Paper Generation Failed — ${subject}`,
    title: 'Paper Generation Encountered an Error',
    message: `The automated question paper generation for subject "${subject}" could not be completed. Please review blueprint constraints and question pool availability.`,
    details: [
      { label: 'Academic Subject', value: subject },
      { label: 'Error Detail', value: reason || 'Constraint satisfaction or pool deficiency' },
      { label: 'Department', value: 'Department of Computer Engineering' },
    ],
  });
}

/* ============================================================================
 * 5. COORDINATOR WORKFLOW NOTIFICATIONS
 * ============================================================================ */

/**
 * Coordinator Assigned to a Paper
 */
async function notifyCoordinatorAssigned({ paper, coordinator, assignedBy }) {
  const reviewer = await ensureContact(coordinator || paper?.assigned_coordinator_id);
  if (!reviewer || !reviewer.email) return;

  await sendExamGuardEmail({
    to: reviewer.email,
    recipientName: reviewer.name,
    userId: reviewer.id,
    questionPaperId: paper.id,
    eventType: 'COORDINATOR_ASSIGNED',
    subject: `Review Assignment: ${paper.title} (${paper.subject})`,
    title: 'Question Paper Assigned for Coordinator Review',
    message: `You have been assigned as the Exam Coordinator for question paper "${paper.title}" (${paper.subject}) by ${assignedBy || 'Administration'}. Review must be completed within 24 hours of submission.`,
    details: [
      { label: 'Paper Title', value: paper.title },
      { label: 'Subject', value: paper.subject },
      { label: 'Assignment Role', value: 'Exam Coordinator' },
      { label: 'Review Window', value: 'Within 24 Hours' },
      { label: 'Content Release', value: '1 Hour Prior to Scheduled Exam' },
    ],
  });
}

/**
 * Paper Available for Coordinator Review (Within 24 Hours)
 */
async function notifyCoordinatorReviewAvailable({ paper, teacher, coordinator }) {
  const reviewer = await ensureContact(coordinator || paper?.assigned_coordinator_id);
  const author = await ensureContact(teacher || paper?.created_by);
  if (!reviewer || !reviewer.email) return;

  await sendExamGuardEmail({
    to: reviewer.email,
    recipientName: reviewer.name,
    userId: reviewer.id,
    questionPaperId: paper.id,
    eventType: 'COORDINATOR_REVIEW_AVAILABLE',
    subject: `Review Due (24 Hours): ${paper.title} (${paper.subject})`,
    title: 'Question Paper Ready for Verification',
    message: `Question paper "${paper.title}" authored by ${author?.name || 'Faculty Member'} has been submitted and is ready for your verification. Review must be concluded within 24 hours.`,
    details: [
      { label: 'Paper Title', value: paper.title },
      { label: 'Subject', value: paper.subject },
      { label: 'Authoring Faculty', value: author?.name || 'Teacher' },
      { label: 'Due Within', value: '24 Hours' },
    ],
  });
}

/**
 * Coordinator Verification Approved
 */
async function notifyVerificationApproved({ paper, teacher, coordinator, comments }) {
  const author = await ensureContact(teacher || paper?.created_by);
  const reviewer = await ensureContact(coordinator || paper?.assigned_coordinator_id);
  if (!author || !author.email) return;

  await sendExamGuardEmail({
    to: author.email,
    recipientName: author.name,
    userId: author.id,
    questionPaperId: paper.id,
    eventType: 'VERIFICATION_APPROVED',
    subject: `Approved: Question Paper "${paper.title}"`,
    title: 'Question Paper Verified & Approved',
    message: `Exam Coordinator ${reviewer?.name || 'Coordinator'} has verified the digital signature, ciphertext integrity, and approved your question paper "${paper.title}" for ${paper.subject}. It is now scheduled for final secure delivery on examination day.`,
    details: [
      { label: 'Paper Title', value: paper.title },
      { label: 'Academic Subject', value: paper.subject },
      { label: 'Decision', value: 'Verified & Approved' },
      { label: 'Coordinator', value: reviewer?.name || 'Exam Coordinator' },
      { label: 'Decision Timestamp', value: new Date().toLocaleString() },
      ...(comments ? [{ label: 'Coordinator Comments', value: comments }] : []),
    ],
  });
}

/**
 * Coordinator Return for Revision
 */
async function notifyReturnForRevision({ paper, teacher, coordinator, comments }) {
  const author = await ensureContact(teacher || paper?.created_by);
  const reviewer = await ensureContact(coordinator || paper?.assigned_coordinator_id);
  if (!author || !author.email) return;

  await sendExamGuardEmail({
    to: author.email,
    recipientName: author.name,
    userId: author.id,
    questionPaperId: paper.id,
    eventType: 'RETURN_FOR_REVISION',
    subject: `Action Required: Question Paper Returned for Revision — ${paper.title}`,
    title: 'Question Paper Returned for Revision',
    message: `Exam Coordinator ${reviewer?.name || 'Coordinator'} has reviewed your question paper "${paper.title}" (${paper.subject}) and requested revisions. Please check the coordinator's evaluation comments below, update the draft in your teacher workspace, and resubmit.`,
    details: [
      { label: 'Paper Title', value: paper.title },
      { label: 'Subject', value: paper.subject },
      { label: 'Decision', value: 'Returned for Revision' },
      { label: 'Coordinator', value: reviewer?.name || 'Exam Coordinator' },
      { label: 'Revision Instructions', value: comments || 'Please review syllabus unit coverage and marks alignment.' },
    ],
  });
}

/**
 * Coordinator Rejection
 */
async function notifyVerificationRejected({ paper, teacher, coordinator, comments }) {
  const author = await ensureContact(teacher || paper?.created_by);
  const reviewer = await ensureContact(coordinator || paper?.assigned_coordinator_id);
  if (!author || !author.email) return;

  await sendExamGuardEmail({
    to: author.email,
    recipientName: author.name,
    userId: author.id,
    questionPaperId: paper.id,
    eventType: 'VERIFICATION_REJECTED',
    subject: `Paper Rejected: "${paper.title}"`,
    title: 'Question Paper Rejected by Coordinator',
    message: `Exam Coordinator ${reviewer?.name || 'Coordinator'} has reviewed and rejected the question paper "${paper.title}" (${paper.subject}). Detailed rejection reason is provided below for your records.`,
    details: [
      { label: 'Paper Title', value: paper.title },
      { label: 'Subject', value: paper.subject },
      { label: 'Decision', value: 'Rejected' },
      { label: 'Coordinator', value: reviewer?.name || 'Exam Coordinator' },
      { label: 'Rejection Reason', value: comments || 'Does not meet curriculum criteria.' },
    ],
  });
}

/* ============================================================================
 * 6. EXAMINATION SCHEDULING NOTIFICATIONS
 * ============================================================================ */

/**
 * Examination Scheduled
 */
async function notifyExamScheduled({ paper, coordinator, examDate, examTime = '10:00 AM' }) {
  const reviewer = await ensureContact(coordinator || paper?.assigned_coordinator_id);
  if (!reviewer || !reviewer.email) return;

  await sendExamGuardEmail({
    to: reviewer.email,
    recipientName: reviewer.name,
    userId: reviewer.id,
    questionPaperId: paper.id,
    eventType: 'EXAM_SCHEDULED',
    subject: `Examination Scheduled: ${paper.title} (${paper.subject})`,
    title: 'Examination Date & Time Scheduled',
    message: `The examination for question paper "${paper.title}" (${paper.subject}) has been officially scheduled for ${examDate} at ${examTime}. Decrypted content release is gated until exactly 1 hour prior to examination start.`,
    details: [
      { label: 'Paper Title', value: paper.title },
      { label: 'Subject', value: paper.subject },
      { label: 'Examination Date', value: examDate },
      { label: 'Examination Time', value: examTime },
      { label: 'Release Window', value: '1 Hour Prior to Exam' },
    ],
  });
}

/**
 * Examination Schedule Updated / Rescheduled
 */
async function notifyExamScheduleUpdated({ paper, coordinator, oldSchedule, newSchedule }) {
  const reviewer = await ensureContact(coordinator || paper?.assigned_coordinator_id);
  if (!reviewer || !reviewer.email) return;

  await sendExamGuardEmail({
    to: reviewer.email,
    recipientName: reviewer.name,
    userId: reviewer.id,
    questionPaperId: paper.id,
    eventType: 'EXAM_SCHEDULED',
    subject: `Notice: Examination Rescheduled — ${paper.title}`,
    title: 'Examination Schedule Updated',
    message: `The examination schedule for "${paper.title}" (${paper.subject}) has been updated in the Examination Cell records.`,
    details: [
      { label: 'Paper Title', value: paper.title },
      { label: 'Subject', value: paper.subject },
      ...(oldSchedule ? [{ label: 'Previous Schedule', value: oldSchedule }] : []),
      { label: 'New Schedule', value: newSchedule },
      { label: 'Release Window', value: '1 Hour Prior to Rescheduled Exam' },
    ],
  });
}

/* ============================================================================
 * 7. SECURE RELEASE NOTIFICATIONS
 * ============================================================================ */

/**
 * Secure Paper Content Released (1 Hour Prior to Exam)
 */
async function notifySecurePaperReleased({ paper, coordinator, examDate, examTime }) {
  const reviewer = await ensureContact(coordinator || paper?.assigned_coordinator_id);
  if (!reviewer || !reviewer.email) return;

  await sendExamGuardEmail({
    to: reviewer.email,
    recipientName: reviewer.name,
    userId: reviewer.id,
    questionPaperId: paper.id,
    eventType: 'SECURE_PAPER_RELEASED',
    subject: `Notice: Question Paper Content Released (1-Hour Window) — ${paper.title}`,
    title: 'Secure Question Paper Decryption Window Open',
    message: `In accordance with Examination Cell protocol, the scheduled examination for "${paper.title}" (${paper.subject}) takes place in exactly 1 hour (${examTime} on ${examDate}). Authorized plaintext decryption and PDF download are now unlocked in your coordinator workspace via the Verify-Before-Decrypt pipeline.`,
    details: [
      { label: 'Paper Title', value: paper.title },
      { label: 'Subject', value: paper.subject },
      { label: 'Examination Date', value: examDate },
      { label: 'Examination Time', value: examTime },
      { label: 'Decryption Status', value: 'Unlocked via Verify-Before-Decrypt' },
    ],
  });
}

/* ============================================================================
 * BACKWARDS COMPATIBILITY & UTILITY HELPERS
 * ============================================================================ */

async function createQuestionPaperNotification({
  recipientId,
  questionPaperId,
  title,
  subject,
  examDate,
  examTime = '10:00 AM',
  scheduledDeliveryDate,
}) {
  return notifyExamScheduled({
    paper: { id: questionPaperId, title, subject },
    coordinator: recipientId,
    examDate: examDate || scheduledDeliveryDate,
    examTime,
  });
}

async function createWorkflowNotification({ recipientId, questionPaperId, type = 'SYSTEM', subject, message, details = [] }) {
  const user = await resolveUserContact(recipientId);
  if (user && user.email) {
    await sendExamGuardEmail({
      to: user.email,
      recipientName: user.name,
      userId: recipientId,
      questionPaperId,
      eventType: type,
      subject,
      title: subject,
      message,
      details,
    });
  }
  return { success: true };
}

async function getUserNotifications(userId) {
  if (!userId) return [];
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    return (!error && data) ? data : [];
  } catch (_) {
    return [];
  }
}

async function getUnreadCount(userId) {
  if (!userId) return { count: 0, unreadCount: 0 };
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', userId)
      .neq('status', 'READ');
    const cnt = (!error && data) ? data.length : 0;
    return { count: cnt, unreadCount: cnt };
  } catch (_) {
    return { count: 0, unreadCount: 0 };
  }
}

async function markAsRead(notificationId, userId) {
  try {
    await supabase.from('notifications').update({ status: 'READ' }).eq('id', notificationId).eq('user_id', userId);
  } catch (_) {}
  return { success: true };
}

async function markAsUnread(notificationId, userId) {
  try {
    await supabase.from('notifications').update({ status: 'SENT' }).eq('id', notificationId).eq('user_id', userId);
  } catch (_) {}
  return { success: true };
}

async function markAllAsRead(userId) {
  try {
    await supabase.from('notifications').update({ status: 'READ' }).eq('user_id', userId).neq('status', 'READ');
  } catch (_) {}
  return { success: true, count: 0 };
}

module.exports = {
  // 1. Account & Auth
  notifyAccountCreated,
  notifyTeacherRegistered,
  notifyAccountActivated,
  notifyAccountDeactivated,
  notifyAccountBlocked,
  notifyAccountReactivated,
  notifyAccountStatusChanged,
  notifyAccountDeleted,
  notifyPasswordReset,
  notifySecurityAlert,

  // 2. Teacher Profile
  notifyProfileUpdated,
  notifyMobileNumberChanged,

  // 3. Question Paper Workflow
  notifyPaperCreated,
  notifyDraftSaved,
  notifyPaperFinalized,
  notifyPaperSubmitted,
  notifyRevisionResubmitted,
  notifyPaperArchived,

  // 4. A/B Sets & Generation
  notifySetFinalized,
  notifySetsReadyForPool,
  notifyPaperGenerationSuccess,
  notifyPaperGenerationFailed,

  // 5. Coordinator Workflow
  notifyCoordinatorAssigned,
  notifyCoordinatorReviewAvailable,
  notifyVerificationApproved,
  notifyReturnForRevision,
  notifyVerificationRejected,

  // 6. Examination Scheduling
  notifyExamScheduled,
  notifyExamScheduleUpdated,

  // 7. Secure Release
  notifySecurePaperReleased,

  // Utility & Legacy
  createQuestionPaperNotification,
  createWorkflowNotification,
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAsUnread,
  markAllAsRead,
};

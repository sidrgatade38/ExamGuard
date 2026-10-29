const crypto = require('crypto');
const config = require('../config');
const { supabase } = require('../config/supabase');
const encryptionService = require('./encryptionService');
const signatureService = require('./signatureService');
const verificationService = require('./verificationService');
const notificationService = require('./notificationService');
const auditLogService = require('./auditLogService');


/**
 * Calculates the next calendar day in YYYY-MM-DD format based on a given date.
 * Ensures consistent, deterministic server-side next-day calculation.
 *
 * @param {Date} [baseDate=new Date()]
 * @returns {string} Date string in YYYY-MM-DD
 */
function calculateNextCalendarDay(baseDate = new Date()) {
  const next = new Date(baseDate);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().split('T')[0];
}

/**
 * Validates whether a string is a valid ISO calendar date format (YYYY-MM-DD).
 */
function isValidDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isValidUuid(id) {
  return typeof id === 'string' && UUID_REGEX.test(id);
}

/**
 * Verifies that a target recipient faculty exists, is active, and possesses the TEACHER role.
 *
 * @param {string} recipientUserId - UUID of the recipient user
 * @returns {Promise<Object>} Recipient user record
 */
async function validateRecipientFaculty(recipientUserId) {
  if (!recipientUserId) {
    const err = new Error('Recipient faculty (assignedToUserId) is required.');
    err.statusCode = 400;
    throw err;
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, name, email, is_active, role_id, roles(id, name)')
    .eq('id', recipientUserId)
    .maybeSingle();

  if (error) {
    console.error('[QuestionPaperService] Error fetching recipient:', error.message);
    const dbErr = new Error('Failed to verify recipient faculty.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!user) {
    const notFoundErr = new Error('Assigned recipient user does not exist.');
    notFoundErr.statusCode = 400;
    throw notFoundErr;
  }

  if (!user.is_active) {
    const inactiveErr = new Error('Assigned recipient account is inactive.');
    inactiveErr.statusCode = 400;
    throw inactiveErr;
  }

  // Ensure role is TEACHER or EXAM_COORDINATOR
  const roleName = user.roles?.name?.toUpperCase();
  if (roleName !== 'TEACHER' && roleName !== 'EXAM_COORDINATOR') {
    const roleErr = new Error('Question papers can only be assigned to an active Exam Coordinator or Faculty member.');
    roleErr.statusCode = 400;
    throw roleErr;
  }

  return user;
}

/**
 * Creates and submits a question paper with multipart file upload to private Supabase Storage,
 * creates metadata record in question_papers, and creates assignment in question_paper_assignments.
 * Implements compensating rollback if any step fails.
 */
async function submitQuestionPaper({
  teacherId,
  title,
  subject,
  semester,
  academicYear,
  examType,
  examDate,
  assignedToUserId,
  file,
  sanitizedFileName,
}) {
  // 1. Validate required fields
  const missing = [];
  if (!title || !title.trim()) missing.push('title');
  if (!subject || !subject.trim()) missing.push('subject');
  if (!semester || !semester.trim()) missing.push('semester');
  if (!academicYear || !academicYear.trim()) missing.push('academicYear');
  if (!examType || !examType.trim()) missing.push('examType');
  if (!examDate || !examDate.trim()) missing.push('examDate');
  if (!assignedToUserId) missing.push('assignedToUserId');
  if (!file) missing.push('file');

  if (missing.length > 0) {
    const err = new Error(`Missing required fields: ${missing.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  // 2. Validate examDate format
  if (!isValidDateString(examDate)) {
    const err = new Error('Invalid examDate format. Expected YYYY-MM-DD.');
    err.statusCode = 400;
    throw err;
  }

  // 3. Verify recipient faculty exists, is active, and is TEACHER
  const recipient = await validateRecipientFaculty(assignedToUserId);

  // 4. Server-controlled timestamps
  const submissionTimestamp = new Date();
  const submittedAt = submissionTimestamp.toISOString();
  const scheduledDeliveryDate = calculateNextCalendarDay(submissionTimestamp);

  // 5. In-Memory Envelope Encryption (Module 6)
  // Plaintext PDF buffer is encrypted in memory with AES-256-GCM.
  // AES-256 key is wrapped with RSA-OAEP (SHA-256) using dedicated RSA public key.
  // The plaintext PDF is NEVER stored in Supabase Storage or written to disk.
  const encryptionResult = encryptionService.encryptQuestionPaper(file.buffer);

  // 5b. Generate RSA-PSS Digital Signature over Encrypted Ciphertext Buffer (Module 7)
  // Computes SHA-256 hash and signs exact ciphertext bytes BEFORE storage upload.
  // Fails safely if signing key is missing or signing operation fails.
  const signingResult = signatureService.signQuestionPaper(encryptionResult.encryptedBuffer);

  // 6. Generate deterministic ID and private encrypted storage path
  const questionPaperId = crypto.randomUUID();
  const bucketName = config.storageBucket || 'examguard-storage';
  const finalFileName = sanitizedFileName || `paper_${Date.now()}.pdf`;

  // Path traversal defense (Module 8): prevent .., directory separators, or null bytes
  if (finalFileName.includes('..') || finalFileName.includes('/') || finalFileName.includes('\\') || finalFileName.includes('\0')) {
    const err = new Error('Invalid filename. Path traversal sequences and directory separators are forbidden.');
    err.statusCode = 400;
    throw err;
  }

  const safeEncryptedFileName = `${finalFileName}.enc`;
  const storagePath = `question-papers/${teacherId}/${questionPaperId}/encrypted/${safeEncryptedFileName}`;

  // 7. Upload encrypted ciphertext buffer to private Supabase Storage
  let storageUploadSuccessful = false;
  try {
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, encryptionResult.encryptedBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('[QuestionPaperService] Storage upload failed:', uploadError.message);
      const storageErr = new Error(`Failed to store question paper file: ${uploadError.message}`);
      storageErr.statusCode = 502;
      throw storageErr;
    }
    storageUploadSuccessful = true;
  } catch (storageErr) {
    if (!storageErr.statusCode) storageErr.statusCode = 502;
    throw storageErr;
  }

  // 8. Insert record into question_papers table
  let paperRecordCreated = false;
  let paperKeyRecordCreated = false;
  let sigRecordCreated = false;
  let assignmentRecordCreated = false;
  let notificationRecord = null;
  let createdPaper = null;
  let createdSignature = null;

  try {
    const { data: paperData, error: paperError } = await supabase
      .from('question_papers')
      .insert([
        {
          id: questionPaperId,
          title: title.trim(),
          subject: subject.trim(),
          semester: semester.trim(),
          academic_year: academicYear.trim(),
          exam_type: examType.trim(),
          exam_date: examDate,
          teacher_id: teacherId,
          file_name: finalFileName,
          storage_path: storagePath,
          file_size: encryptionResult.encryptedSize,
          mime_type: 'application/pdf',
          status: 'SUBMITTED',
          submitted_at: submittedAt,
          scheduled_delivery_date: scheduledDeliveryDate,
        },
      ])
      .select('*')
      .single();

    if (paperError || !paperData) {
      console.error('[QuestionPaperService] Database insert failed for question_papers:', paperError?.message);
      throw new Error(paperError?.message || 'Database error creating question paper record');
    }

    paperRecordCreated = true;
    createdPaper = paperData;

    // 9. Insert record into paper_keys table (Module 6)
    // Stores wrapped AES key, IV, and GCM authentication tag. Plaintext AES key is discarded.
    const { data: keyData, error: keyError } = await supabase
      .from('paper_keys')
      .insert([
        {
          question_paper_id: questionPaperId,
          encrypted_aes_key: encryptionResult.encryptedAesKey,
          iv: encryptionResult.iv,
          auth_tag: encryptionResult.authTag,
        },
      ])
      .select('*')
      .single();

    if (keyError || !keyData) {
      console.error('[QuestionPaperService] Database insert failed for paper_keys:', keyError?.message);
      throw new Error(keyError?.message || 'Database error creating paper key record');
    }

    paperKeyRecordCreated = true;

    // 10. Insert record into digital_signatures table (Module 7)
    // Stores SHA-256 hash of ciphertext, RSA-PSS signature, algorithm, and public key reference.
    const { data: sigData, error: sigError } = await supabase
      .from('digital_signatures')
      .insert([
        {
          question_paper_id: questionPaperId,
          algorithm: signingResult.algorithm,
          file_hash: signingResult.fileHash,
          signature: signingResult.signature,
          public_key_reference: signingResult.publicKeyReference,
        },
      ])
      .select('*')
      .single();

    if (sigError || !sigData) {
      console.error('[QuestionPaperService] Database insert failed for digital_signatures:', sigError?.message);
      throw new Error(sigError?.message || 'Database error creating digital signature record');
    }

    sigRecordCreated = true;
    createdSignature = sigData;

    // 11. Insert record into question_paper_assignments table
    const { data: assignmentData, error: assignmentError } = await supabase
      .from('question_paper_assignments')
      .insert([
        {
          question_paper_id: questionPaperId,
          assigned_to_user_id: recipient.id,
          assigned_by_user_id: teacherId,
          assigned_at: submittedAt,
          scheduled_delivery_date: scheduledDeliveryDate,
          delivery_status: 'PENDING',
        },
      ])
      .select('*')
      .single();

    if (assignmentError || !assignmentData) {
      console.error('[QuestionPaperService] Assignment insert failed:', assignmentError?.message);
      throw new Error(assignmentError?.message || 'Database error creating paper assignment');
    }

    assignmentRecordCreated = true;

    // 12. Create in-app notification for the assigned recipient (Module 12)
    try {
      notificationRecord = await notificationService.createQuestionPaperNotification({
        recipientId: recipient.id,
        questionPaperId,
        title: title.trim(),
        subject: subject.trim(),
        examDate,
        scheduledDeliveryDate,
      });
    } catch (notifErr) {
      console.warn('[QuestionPaperService] Warning: notification creation error:', notifErr.message);
    }

    // Safe API response - NEVER leaks private keys, AES keys, auth tags, or IVs
    await auditLogService.logAuditEvent({
      userId: teacherId,
      role: 'TEACHER',
      action: 'QUESTION_PAPER_SUBMITTED',
      resourceType: 'QUESTION_PAPER',
      resourceId: questionPaperId,
      outcome: 'SUCCESS',
      summary: `Question paper "${title.trim()}" successfully submitted by teacher`,
      metadata: {
        title: title.trim(),
        subject: subject.trim(),
        examDate,
        scheduledDeliveryDate,
        assignedToUserId: recipient.id,
      },
    });

    return {
      questionPaper: createdPaper,
      assignment: assignmentData,
      digitalSignature: {
        id: createdSignature.id,
        algorithm: createdSignature.algorithm,
        fileHash: createdSignature.file_hash,
        createdAt: createdSignature.created_at,
      },
      recipient: {
        id: recipient.id,
        name: recipient.name,
        email: recipient.email,
      },
      notification: notificationRecord
        ? {
            id: notificationRecord.id,
            userId: notificationRecord.user_id,
            type: notificationRecord.type,
            channel: notificationRecord.channel,
            subject: notificationRecord.subject,
            scheduledAt: notificationRecord.scheduled_at,
            status: notificationRecord.status,
            createdAt: notificationRecord.created_at,
          }
        : null,
    };
  } catch (dbError) {
    // Compensating rollback cleanup across database tables and private storage
    console.warn('[QuestionPaperService] Initiating compensating cleanup for failed submission...');

    await auditLogService.logAuditEvent({
      userId: teacherId,
      role: 'TEACHER',
      action: 'QUESTION_PAPER_SUBMITTED',
      resourceType: 'QUESTION_PAPER',
      resourceId: questionPaperId,
      outcome: 'FAILURE',
      summary: `Question paper submission failed: ${dbError.message}`,
      metadata: {
        title: title ? String(title).slice(0, 100) : null,
        subject: subject ? String(subject).slice(0, 100) : null,
        error: dbError.message,
      },
    });

    if (notificationRecord) {
      try {
        await supabase.from('notifications').delete().eq('question_paper_id', questionPaperId);
      } catch (_) {}
    }

    if (assignmentRecordCreated) {
      await supabase.from('question_paper_assignments').delete().eq('question_paper_id', questionPaperId).catch(() => {});
    }

    if (sigRecordCreated) {
      await supabase.from('digital_signatures').delete().eq('question_paper_id', questionPaperId).catch(() => {});
    }

    if (paperKeyRecordCreated) {
      await supabase.from('paper_keys').delete().eq('question_paper_id', questionPaperId).catch(() => {});
    }

    if (paperRecordCreated) {
      await supabase.from('question_papers').delete().eq('id', questionPaperId).catch(() => {});
    }

    if (storageUploadSuccessful) {
      await supabase.storage.from(bucketName).remove([storagePath]).catch((cleanupErr) => {
        console.error('[QuestionPaperService] Rollback storage removal error:', cleanupErr.message);
      });
    }

    const failureErr = new Error(`Submission failed: ${dbError.message}`);
    failureErr.statusCode = 500;
    throw failureErr;
  }
}

/**
 * Retrieves all question papers set by the authenticated teacher.
 */
async function getMyQuestionPapers(teacherId) {
  const { data: papers, error } = await supabase
    .from('question_papers')
    .select(`
      id,
      title,
      subject,
      semester,
      academic_year,
      exam_type,
      exam_date,
      teacher_id,
      file_name,
      file_size,
      mime_type,
      status,
      submitted_at,
      scheduled_delivery_date,
      created_at,
      updated_at,
      department,
      review_status,
      reviewer_id,
      reviewed_at,
      review_comments,
      admin_approval_status,
      admin_approver_id,
      admin_approved_at,
      admin_comments,
      reviewer:users!reviewer_id (
        id,
        name,
        email
      ),
      admin_approver:users!admin_approver_id (
        id,
        name,
        email
      ),
      question_paper_assignments (
        id,
        assigned_to_user_id,
        scheduled_delivery_date,
        delivered_at,
        delivery_status,
        recipient:users!assigned_to_user_id (
          id,
          name,
          email
        )
      ),
      digital_signatures (
        id,
        algorithm,
        file_hash,
        created_at
      )
    `)
    .eq('teacher_id', teacherId)
    .neq('status', 'ARCHIVED')
    .neq('status', 'DELETED')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[QuestionPaperService] Error fetching teacher papers:', error.message);
    const dbErr = new Error('Failed to retrieve question papers.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  return papers || [];
}

/**
 * Retrieves metadata for a specific question paper with strict ownership verification.
 */
async function getQuestionPaperById(paperId, requesterId, requesterRole) {
  if (!paperId) {
    const err = new Error('Question paper ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const { data: paper, error } = await supabase
    .from('question_papers')
    .select(`
      id,
      title,
      subject,
      semester,
      academic_year,
      exam_type,
      exam_date,
      teacher_id,
      file_name,
      file_size,
      mime_type,
      status,
      submitted_at,
      scheduled_delivery_date,
      created_at,
      updated_at,
      department,
      review_status,
      reviewer_id,
      reviewed_at,
      review_comments,
      admin_approval_status,
      admin_approver_id,
      admin_approved_at,
      admin_comments,
      reviewer:users!reviewer_id (
        id,
        name,
        email
      ),
      admin_approver:users!admin_approver_id (
        id,
        name,
        email
      ),
      teacher:users!teacher_id (
        id,
        name,
        email
      ),
      question_paper_assignments (
        id,
        assigned_to_user_id,
        scheduled_delivery_date,
        delivered_at,
        delivery_status,
        recipient:users!assigned_to_user_id (
          id,
          name,
          email
        )
      ),
      digital_signatures (
        id,
        algorithm,
        file_hash,
        public_key_reference,
        created_at
      )
    `)
    .eq('id', paperId)
    .maybeSingle();

  if (error) {
    console.error('[QuestionPaperService] Error fetching paper details:', error.message);
    const dbErr = new Error('Failed to retrieve question paper details.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!paper) {
    const notFoundErr = new Error('Question paper not found.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  // Ownership & Authorization verification (Module 4, 5 & 12)
  if (requesterRole === 'TEACHER') {
    const isAuthor = paper.teacher_id === requesterId;
    const assignments = Array.isArray(paper.question_paper_assignments)
      ? paper.question_paper_assignments
      : (paper.question_paper_assignments ? [paper.question_paper_assignments] : []);
    const assignment = assignments.find((a) => a.assigned_to_user_id === requesterId);
    const isAssigned = !!assignment;

    if (!isAuthor && !isAssigned) {
      await auditLogService.logAuditEvent({
        userId: requesterId,
        role: requesterRole,
        action: 'UNAUTHORIZED_ACCESS',
        resourceType: 'QUESTION_PAPER',
        resourceId: paperId,
        outcome: 'DENIED',
        summary: `Unauthorized attempt to access question paper ${paperId}`,
        metadata: { requesterId, paperId },
      });
      const forbiddenErr = new Error('Access forbidden. You do not own this question paper.');
      forbiddenErr.statusCode = 403;
      throw forbiddenErr;
    }

    // Delivery date gating for assigned faculty (Module 12)
    if (!isAuthor && isAssigned) {
      const today = new Date().toISOString().split('T')[0];
      const deliveryDate = assignment.scheduled_delivery_date || paper.scheduled_delivery_date;
      if (deliveryDate && today < deliveryDate) {
        await auditLogService.logAuditEvent({
          userId: requesterId,
          role: requesterRole,
          action: 'UNAUTHORIZED_ACCESS',
          resourceType: 'QUESTION_PAPER',
          resourceId: paperId,
          outcome: 'DENIED',
          summary: `Access blocked before delivery date (${deliveryDate}) for question paper ${paperId}`,
          metadata: { scheduledDeliveryDate: deliveryDate, paperId },
        });
        const deliveryErr = new Error(`Access forbidden. Question paper is scheduled for delivery on ${deliveryDate} and is not accessible yet.`);
        deliveryErr.statusCode = 403;
        throw deliveryErr;
      }
    }
  } else if (requesterRole !== 'ADMIN' && requesterRole !== 'EXAM_COORDINATOR') {
    const forbiddenErr = new Error('Access forbidden. You do not own this question paper.');
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }

  return paper;
}

/**
 * Generates a short-lived signed URL (300 seconds) for downloading a question paper file from private storage.
 * Enforces ownership check before issuing download access.
 */
async function getQuestionPaperDownloadUrl(paperId, requesterId, requesterRole) {
  if (requesterRole === 'TEACHER') {
    const forbiddenErr = new Error('Access forbidden: Teachers cannot request question paper download links.');
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }
  const paper = await getQuestionPaperById(paperId, requesterId, requesterRole);

  // Storage path security check (Module 8): prevent directory traversal or foreign object access
  if (!paper.storage_path || paper.storage_path.includes('..') || !paper.storage_path.startsWith('question-papers/')) {
    const err = new Error('Invalid or corrupted storage path. Access forbidden.');
    err.statusCode = 403;
    throw err;
  }

  const bucketName = config.storageBucket || 'examguard-storage';
  const expiresInSeconds = 300; // 5 minutes

  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(paper.storage_path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error('[QuestionPaperService] Error creating signed URL:', error?.message);
    const storageErr = new Error('Failed to generate secure download link.');
    storageErr.statusCode = 502;
    throw storageErr;
  }

  return {
    downloadUrl: data.signedUrl,
    fileName: paper.file_name,
    storagePath: paper.storage_path,
    expiresIn: expiresInSeconds,
  };
}

/**
 * Downloads and decrypts an encrypted question paper using envelope decryption (Module 6).
 * Enforces strict ownership checks before fetching ciphertext or key material.
 * Returns decrypted Buffer with original filename.
 *
 * @param {string} paperId - UUID of the question paper
 * @param {string} requesterId - UUID of authenticated user
 * @param {string} requesterRole - Role of authenticated user
 * @returns {Promise<{ decryptedBuffer: Buffer, fileName: string, mimeType: string }>}
 */
async function downloadAndDecryptQuestionPaper(paperId, requesterId, requesterRole) {
  // Strict Exam Cell Security: Teachers must NEVER download or view final examination question papers
  if (requesterRole === 'TEACHER') {
    await auditLogService.logAuditEvent({
      userId: requesterId,
      role: requesterRole,
      action: 'UNAUTHORIZED_ACCESS',
      resourceType: 'QUESTION_PAPER',
      resourceId: paperId,
      outcome: 'DENIED',
      summary: `Teacher attempt to download final examination paper ${paperId} was blocked by strict Exam Cell policy.`,
      metadata: { requesterId, paperId },
    });
    const forbiddenErr = new Error(
      'Access forbidden: Teachers are strictly not permitted to download or view final examination question papers. Final paper decryption and download is exclusively reserved for authorized Exam Coordinators.'
    );
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }

  // 1. Verify paper exists and requester is authorized
  const paper = await getQuestionPaperById(paperId, requesterId, requesterRole);

  // Storage path security check (Module 8): prevent directory traversal or foreign object access
  if (!paper.storage_path || paper.storage_path.includes('..') || !paper.storage_path.startsWith('question-papers/')) {
    const err = new Error('Invalid or corrupted storage path. Access forbidden.');
    err.statusCode = 403;
    throw err;
  }

  const bucketName = config.storageBucket || 'examguard-storage';

  // 2. Fetch envelope encryption keys from paper_keys table
  const { data: keyRecord, error: keyError } = await supabase
    .from('paper_keys')
    .select('encrypted_aes_key, iv, auth_tag')
    .eq('question_paper_id', paperId)
    .maybeSingle();

  if (keyError) {
    console.error('[QuestionPaperService] Error fetching paper key:', keyError.message);
    const dbErr = new Error('Failed to retrieve question paper encryption keys.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // 3. Download the stored file buffer from private Supabase Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(bucketName)
    .download(paper.storage_path);

  if (downloadError || !fileData) {
    console.error('[QuestionPaperService] Error downloading paper from storage:', downloadError?.message);
    const storageErr = new Error('Failed to retrieve question paper from secure storage.');
    storageErr.statusCode = 502;
    throw storageErr;
  }

  let fileBuffer;
  if (Buffer.isBuffer(fileData)) {
    fileBuffer = fileData;
  } else if (fileData && typeof fileData.arrayBuffer === 'function') {
    fileBuffer = Buffer.from(await fileData.arrayBuffer());
  } else {
    fileBuffer = Buffer.from(fileData);
  }

  // 4. Verify-Before-Decrypt: Cryptographic Integrity & Digital Signature (Module 7 & Module 11)
  // Retrieve signature record for mandatory Verify-Before-Decrypt pipeline
  const { data: sigRecord, error: sigError } = await supabase
    .from('digital_signatures')
    .select('algorithm, file_hash, signature, public_key_reference')
    .eq('question_paper_id', paperId)
    .maybeSingle();

  if (sigError) {
    console.error('[QuestionPaperService] Error fetching digital signature:', sigError.message);
    const dbErr = new Error('Failed to retrieve question paper digital signature.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // 5. Enforce canonical Verify-Before-Decrypt pipeline via verificationService:
  // SHA-256 integrity -> RSA-PSS signature -> RSA-OAEP DEK unwrap -> AES-256-GCM decrypt & auth
  try {
    const decryptedBuffer = verificationService.verifyAndDecryptQuestionPaper({
      ciphertextBuffer: fileBuffer,
      sigRecord,
      keyRecord,
    });

    await auditLogService.logAuditEvent({
      userId: requesterId,
      role: requesterRole,
      action: 'DOWNLOAD',
      resourceType: 'QUESTION_PAPER',
      resourceId: paperId,
      outcome: 'SUCCESS',
      summary: `Question paper ${paperId} successfully decrypted and downloaded via Verify-Before-Decrypt pipeline`,
      metadata: { fileName: paper.file_name, title: paper.title },
    });

    return {
      decryptedBuffer,
      fileName: paper.file_name,
      mimeType: 'application/pdf',
    };
  } catch (verifyErr) {
    await auditLogService.logAuditEvent({
      userId: requesterId,
      role: requesterRole,
      action: 'SIGNATURE_VERIFIED',
      resourceType: 'QUESTION_PAPER',
      resourceId: paperId,
      outcome: 'FAILURE',
      summary: `Cryptographic verification failed during download of question paper ${paperId}: ${verifyErr.message}`,
      metadata: { error: verifyErr.message, paperId },
    });
    throw verifyErr;
  }
}

/**
 * Verifies the digital signature and SHA-256 integrity of an encrypted question paper (Module 7 & Module 11).
 * Enforces ownership: only authoring teacher can perform verification.
 * Does NOT decrypt document.
 * 
 * @param {string} paperId - UUID of question paper
 * @param {string} requesterId - UUID of authenticated user
 * @param {string} requesterRole - Role of authenticated user
 * @returns {Promise<{ verified: boolean, algorithm: string, fileHash: string, storedHash: string, signedAt: string, tamperDetected: boolean }>}
 */
async function verifyQuestionPaperIntegrity(paperId, requesterId, requesterRole) {
  const paper = await getQuestionPaperById(paperId, requesterId, requesterRole);

  // Storage path security check (Module 8): prevent directory traversal or foreign object access
  if (!paper.storage_path || paper.storage_path.includes('..') || !paper.storage_path.startsWith('question-papers/')) {
    const err = new Error('Invalid or corrupted storage path. Access forbidden.');
    err.statusCode = 403;
    throw err;
  }

  const bucketName = config.storageBucket || 'examguard-storage';

  // 1. Fetch digital signature record
  const { data: sigRecord, error: sigError } = await supabase
    .from('digital_signatures')
    .select('algorithm, file_hash, signature, public_key_reference, created_at')
    .eq('question_paper_id', paperId)
    .maybeSingle();

  if (sigError) {
    console.error('[QuestionPaperService] Error fetching digital signature:', sigError.message);
    const dbErr = new Error('Failed to retrieve question paper digital signature.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!sigRecord) {
    return {
      verified: false,
      tamperDetected: false,
      message: 'No digital signature record exists for this question paper.',
    };
  }

  // 2. Download encrypted ciphertext from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(bucketName)
    .download(paper.storage_path);

  if (downloadError || !fileData) {
    console.error('[QuestionPaperService] Error downloading ciphertext for signature verification:', downloadError?.message);
    const storageErr = new Error('Failed to retrieve question paper from storage for signature verification.');
    storageErr.statusCode = 502;
    throw storageErr;
  }

  let fileBuffer;
  if (Buffer.isBuffer(fileData)) {
    fileBuffer = fileData;
  } else if (fileData && typeof fileData.arrayBuffer === 'function') {
    fileBuffer = Buffer.from(await fileData.arrayBuffer());
  } else {
    fileBuffer = Buffer.from(fileData);
  }

  // 3. Evaluate SHA-256 integrity and RSA-PSS signature without decrypting (Module 11)
  const verificationResult = verificationService.verifyQuestionPaperIntegrityOnly({
    ciphertextBuffer: fileBuffer,
    sigRecord,
  });

  await auditLogService.logAuditEvent({
    userId: requesterId,
    role: requesterRole,
    action: 'SIGNATURE_VERIFIED',
    resourceType: 'QUESTION_PAPER',
    resourceId: paperId,
    outcome: verificationResult.verified ? 'SUCCESS' : 'FAILURE',
    summary: verificationResult.verified
      ? `Cryptographic signature & hash integrity verified for paper ${paperId}`
      : `Tamper detected or signature invalid for paper ${paperId}`,
    metadata: {
      verified: verificationResult.verified,
      tamperDetected: verificationResult.tamperDetected,
      algorithm: verificationResult.algorithm,
    },
  });

  return verificationResult;
}

/**
 * Retrieves eligible active recipients (EXAM_COORDINATOR and TEACHER) for assignment selection.
 */
async function getEligibleRecipients(requesterId) {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, email, is_active, roles!inner(name)')
    .in('roles.name', ['EXAM_COORDINATOR', 'TEACHER'])
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('[QuestionPaperService] Error fetching eligible recipients:', error.message);
    const dbErr = new Error('Failed to retrieve eligible recipients.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  return (users || []).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.roles?.name || 'TEACHER',
  }));
}

/**
 * Retrieves question papers assigned to the authenticated faculty member.
 * Formats safe metadata with delivery date status.
 *
 * @param {string} facultyId - UUID of authenticated faculty member
 * @returns {Promise<Array<Object>>}
 */
async function getAssignedQuestionPapers(facultyId) {
  if (!facultyId) {
    const err = new Error('Faculty ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const { data: assignments, error: assignError } = await supabase
    .from('question_paper_assignments')
    .select('id, question_paper_id, assigned_to_user_id, assigned_by_user_id, assigned_at, scheduled_delivery_date, delivered_at, delivery_status')
    .eq('assigned_to_user_id', facultyId);

  if (assignError) {
    console.error('[QuestionPaperService] Error fetching faculty assignments:', assignError.message);
    const dbErr = new Error('Failed to retrieve assigned question papers.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!assignments || assignments.length === 0) {
    return [];
  }

  const assignmentMap = new Map();
  for (const a of assignments) {
    assignmentMap.set(a.question_paper_id, a);
  }

  const paperIds = Array.from(assignmentMap.keys());
  const { data: papers, error: papersError } = await supabase
    .from('question_papers')
    .select(`
      id,
      title,
      subject,
      semester,
      academic_year,
      exam_type,
      exam_date,
      teacher_id,
      file_name,
      file_size,
      mime_type,
      status,
      submitted_at,
      scheduled_delivery_date,
      created_at,
      updated_at,
      department,
      review_status,
      reviewer_id,
      reviewed_at,
      review_comments,
      admin_approval_status,
      admin_approver_id,
      admin_approved_at,
      admin_comments,
      reviewer:users!reviewer_id (
        id,
        name,
        email
      ),
      admin_approver:users!admin_approver_id (
        id,
        name,
        email
      ),
      teacher:users!teacher_id (
        id,
        name,
        email
      ),
      digital_signatures (
        id,
        algorithm,
        file_hash,
        public_key_reference,
        created_at
      )
    `)
    .in('id', paperIds);

  if (papersError) {
    console.error('[QuestionPaperService] Error fetching assigned papers:', papersError.message);
    const dbErr = new Error('Failed to retrieve question paper details.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  const today = new Date().toISOString().split('T')[0];

  return (papers || [])
    .filter((paper) => paper.status !== 'DRAFT')
    .map((paper) => {
      const assignment = assignmentMap.get(paper.id);
      const deliveryDate = assignment?.scheduled_delivery_date || paper.scheduled_delivery_date;
      const isDeliverable = today >= deliveryDate;
      const signature = Array.isArray(paper.digital_signatures)
        ? paper.digital_signatures[0]
        : paper.digital_signatures;

      return {
        id: paper.id,
        title: paper.title,
        subject: paper.subject,
        semester: paper.semester,
        academicYear: paper.academic_year,
        examType: paper.exam_type,
        examDate: paper.exam_date,
        status: paper.status,
        submittedAt: paper.submitted_at,
        scheduledDeliveryDate: deliveryDate,
        fileName: paper.file_name,
        fileSize: paper.file_size,
        mimeType: paper.mime_type,
        isDeliverable,
        deliveryStatus: isDeliverable ? 'DELIVERED' : 'SCHEDULED',
        teacher: paper.teacher
          ? {
              id: paper.teacher.id,
              name: paper.teacher.name,
              email: paper.teacher.email,
            }
          : null,
        assignment: assignment
          ? {
              id: assignment.id,
              assignedAt: assignment.assigned_at,
              scheduledDeliveryDate: assignment.scheduled_delivery_date,
              deliveredAt: assignment.delivered_at,
              deliveryStatus: assignment.delivery_status,
            }
          : null,
        digitalSignature: signature
          ? {
              id: signature.id,
              algorithm: signature.algorithm,
              fileHash: signature.file_hash,
              signedAt: signature.created_at,
              publicKeyReference: signature.public_key_reference,
            }
          : null,
      };
    });
}

/**
 * Securely deletes an eligible question paper (Module 20).
 *
 * Authoritative Server-Side Checks:
 * 1. Valid UUID paper ID format.
 * 2. Authenticated user must have TEACHER role.
 * 3. Authoritative ownership: paper.teacher_id === requesterId (IDOR protection).
 * 4. Already deleted/archived check: rejects repeat deletion attempts.
 * 5. Lifecycle eligibility:
 *    - Rejects deletion if paper.status === 'DELIVERED'.
 *    - Rejects deletion if any assignment delivery_status === 'DELIVERED'.
 *    - Rejects deletion if any answer key is already submitted for this paper.
 * 6. Storage Deletion:
 *    - Removes ciphertext object from private Supabase Storage using trusted server storage_path.
 *    - Handles storage failure safely: fails closed without updating database.
 * 7. Soft Delete & Archival Database Update:
 *    - Updates question_papers status to 'ARCHIVED' (and is_deleted, deleted_at if migrated).
 *    - Updates pending question_paper_assignments to CANCELLED.
 * 8. Audit Logging:
 *    - Records immutable audit trail in activity_logs with action 'DELETE'.
 *
 * @param {string} paperId - UUID of the question paper to delete
 * @param {string} requesterId - UUID of the authenticated user
 * @param {string} requesterRole - Authoritative role of the authenticated user
 * @param {string} [reason] - Optional reason for deletion
 * @returns {Promise<{ success: boolean, paperId: string, message: string }>}
 */
async function deleteQuestionPaper(paperId, requesterId, requesterRole, reason = '') {
  if (!paperId || !isValidUuid(paperId)) {
    const err = new Error('Invalid question paper ID format. Expected valid UUID.');
    err.statusCode = 400;
    throw err;
  }

  if (!requesterId) {
    const err = new Error('Authentication required.');
    err.statusCode = 401;
    throw err;
  }

  if (requesterRole !== 'TEACHER') {
    const err = new Error('Access forbidden. Only faculty members with the TEACHER role can delete question papers.');
    err.statusCode = 403;
    throw err;
  }

  // 1. Fetch paper record with trusted server-side metadata
  const { data: paper, error: fetchErr } = await supabase
    .from('question_papers')
    .select('id, title, subject, teacher_id, storage_path, file_name, status, scheduled_delivery_date')
    .eq('id', paperId)
    .maybeSingle();

  if (fetchErr) {
    console.error('[QuestionPaperService] Error fetching paper for deletion:', fetchErr.message);
    const dbErr = new Error('Failed to retrieve question paper details.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!paper) {
    const notFoundErr = new Error('Question paper not found.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  // 2. Authoritative Ownership Validation (IDOR defense)
  if (paper.teacher_id !== requesterId) {
    await auditLogService.logAuditEvent({
      userId: requesterId,
      role: requesterRole,
      action: 'UNAUTHORIZED_ACCESS',
      resourceType: 'QUESTION_PAPER',
      resourceId: paperId,
      outcome: 'DENIED',
      summary: `Unauthorized attempt by user ${requesterId} to delete question paper ${paperId} owned by ${paper.teacher_id}`,
      metadata: { requesterId, paperId, ownerId: paper.teacher_id },
    });
    const forbiddenErr = new Error('Access forbidden. You do not own this question paper.');
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }

  // 3. Check if paper is already deleted or archived
  if (paper.status === 'ARCHIVED' || paper.status === 'DELETED') {
    const conflictErr = new Error('Question paper has already been deleted or archived.');
    conflictErr.statusCode = 409;
    throw conflictErr;
  }

  // 4. Lifecycle & Retention Policy Verification:
  // a) Rejection if paper status is DELIVERED
  if (paper.status === 'DELIVERED') {
    await auditLogService.logAuditEvent({
      userId: requesterId,
      role: requesterRole,
      action: 'DELETE_BLOCKED',
      resourceType: 'QUESTION_PAPER',
      resourceId: paperId,
      outcome: 'DENIED',
      summary: `Deletion rejected: question paper ${paperId} has status DELIVERED`,
      metadata: { paperId, status: paper.status },
    });
    const retentionErr = new Error('Deletion disallowed: Question paper has already been delivered and must be retained under university examination policy.');
    retentionErr.statusCode = 403;
    throw retentionErr;
  }

  // b) Check if any assignment has been DELIVERED
  const { data: assignments, error: assignErr } = await supabase
    .from('question_paper_assignments')
    .select('id, delivery_status, delivered_at')
    .eq('question_paper_id', paperId);

  if (assignErr) {
    console.error('[QuestionPaperService] Error checking assignments for deletion:', assignErr.message);
    const dbErr = new Error('Failed to verify question paper delivery status.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  const hasDeliveredAssignment = (assignments || []).some(
    (a) => a.delivery_status === 'DELIVERED' || a.delivered_at !== null
  );

  if (hasDeliveredAssignment) {
    await auditLogService.logAuditEvent({
      userId: requesterId,
      role: requesterRole,
      action: 'DELETE_BLOCKED',
      resourceType: 'QUESTION_PAPER',
      resourceId: paperId,
      outcome: 'DENIED',
      summary: `Deletion rejected: question paper ${paperId} has already been delivered to assigned coordinator`,
      metadata: { paperId },
    });
    const retentionErr = new Error('Deletion disallowed: Question paper has already been delivered to examination coordinators and must be retained under university audit policy.');
    retentionErr.statusCode = 403;
    throw retentionErr;
  }

  // c) Check if any Answer Key exists for this paper
  const { data: answerKey, error: akErr } = await supabase
    .from('answer_keys')
    .select('id')
    .eq('question_paper_id', paperId)
    .maybeSingle();

  if (akErr) {
    console.error('[QuestionPaperService] Error checking answer keys for deletion:', akErr.message);
    const dbErr = new Error('Failed to verify answer key status.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (answerKey) {
    await auditLogService.logAuditEvent({
      userId: requesterId,
      role: requesterRole,
      action: 'DELETE_BLOCKED',
      resourceType: 'QUESTION_PAPER',
      resourceId: paperId,
      outcome: 'DENIED',
      summary: `Deletion rejected: question paper ${paperId} has an associated answer key ${answerKey.id}`,
      metadata: { paperId, answerKeyId: answerKey.id },
    });
    const akRetentionErr = new Error('Deletion disallowed: An answer key has already been submitted for this examination paper. Retention policy requires preserving dependent records. Contact the Examination Cell administrator.');
    akRetentionErr.statusCode = 400;
    throw akRetentionErr;
  }

  // 5. Secure Storage Deletion
  const bucketName = config.storageBucket || 'examguard-storage';
  if (paper.storage_path) {
    // Validate storage path against path traversal
    if (paper.storage_path.includes('..') || !paper.storage_path.startsWith('question-papers/')) {
      const pathErr = new Error('Invalid or corrupted storage path. Deletion aborted for security.');
      pathErr.statusCode = 403;
      throw pathErr;
    }

    const { error: storageError } = await supabase.storage
      .from(bucketName)
      .remove([paper.storage_path]);

    if (storageError) {
      console.error('[QuestionPaperService] Storage removal failed:', storageError.message);
      await auditLogService.logAuditEvent({
        userId: requesterId,
        role: requesterRole,
        action: 'DELETE',
        resourceType: 'QUESTION_PAPER',
        resourceId: paperId,
        outcome: 'FAILURE',
        summary: `Storage deletion failed for paper ${paperId}: ${storageError.message}`,
        metadata: { paperId, storagePath: paper.storage_path, error: storageError.message },
      });
      const storageErr = new Error(`Failed to delete question paper from secure storage: ${storageError.message}`);
      storageErr.statusCode = 502;
      throw storageErr;
    }
  }

  // 6. Database Update (Soft Delete / Archival with backward-compatible fallback)
  const now = new Date().toISOString();

  // Try updating with dedicated Module 20 columns first
  const { error: fullUpdateErr } = await supabase
    .from('question_papers')
    .update({
      status: 'ARCHIVED',
      is_deleted: true,
      deleted_at: now,
      deleted_by_user_id: requesterId,
      deletion_reason: reason || 'Teacher requested deletion',
      updated_at: now,
    })
    .eq('id', paperId);

  if (fullUpdateErr) {
    // Check if failure is due to new columns not yet present in live Supabase DB
    const isColMissing = (fullUpdateErr.message || '').includes('column') ||
      fullUpdateErr.code === '42703' ||
      fullUpdateErr.code === 'PGRST204';

    if (isColMissing) {
      // Fallback: update status to ARCHIVED which is supported in the baseline schema
      const { error: fallbackErr } = await supabase
        .from('question_papers')
        .update({
          status: 'ARCHIVED',
          updated_at: now,
        })
        .eq('id', paperId);

      if (fallbackErr) {
        console.error('[QuestionPaperService] Database fallback update failed:', fallbackErr.message);
        const dbErr = new Error('Failed to update question paper record during deletion.');
        dbErr.statusCode = 500;
        throw dbErr;
      }
    } else {
      console.error('[QuestionPaperService] Database update failed:', fullUpdateErr.message);
      const dbErr = new Error('Failed to update question paper record during deletion.');
      dbErr.statusCode = 500;
      throw dbErr;
    }
  }

  // 7. Update pending/scheduled assignments to CANCELLED
  try {
    await supabase
      .from('question_paper_assignments')
      .update({
        delivery_status: 'CANCELLED',
        updated_at: now,
      })
      .eq('question_paper_id', paperId)
      .neq('delivery_status', 'DELIVERED');
  } catch (assignCancelErr) {
    console.warn('[QuestionPaperService] Non-critical assignment cancellation note:', assignCancelErr?.message);
  }

  // 8. Record Immutable Audit Event
  await auditLogService.logAuditEvent({
    userId: requesterId,
    role: requesterRole,
    action: 'DELETE',
    resourceType: 'QUESTION_PAPER',
    resourceId: paperId,
    outcome: 'SUCCESS',
    summary: `Question paper ${paperId} ("${paper.title}") was securely deleted and archived by authoring faculty`,
    metadata: {
      paperId,
      title: paper.title,
      fileName: paper.file_name,
      storagePath: paper.storage_path,
      reason: reason || 'Teacher requested deletion',
    },
  });

  return {
    success: true,
    paperId,
    message: `Question paper "${paper.title}" successfully deleted.`,
  };
}

/**
 * Exam Coordinator reviews an assigned question paper (Module 22 & Priority 2)
 */
async function reviewQuestionPaper({ paperId, coordinatorId, coordinatorName, action, comments }) {
  if (!paperId) throw new Error('Paper ID is required.');
  if (!coordinatorId) throw new Error('Coordinator ID is required.');
  if (!action) throw new Error('Review action is required (RECOMMEND, APPROVE, RETURN, or REJECT).');

  const normalizedAction = action.toUpperCase();
  if (!['RECOMMEND', 'APPROVE', 'FORWARD', 'RETURN', 'REJECT'].includes(normalizedAction)) {
    const err = new Error('Invalid review action. Allowed: RECOMMEND, APPROVE, RETURN, REJECT.');
    err.statusCode = 400;
    throw err;
  }

  // Fetch paper details
  const { data: paper, error: fetchErr } = await supabase
    .from('question_papers')
    .select('*, teacher:users!teacher_id(id, name, email)')
    .eq('id', paperId)
    .maybeSingle();

  if (fetchErr || !paper) {
    const err = new Error('Question paper not found.');
    err.statusCode = 404;
    throw err;
  }

  // Check coordinator role
  const { data: coordUser } = await supabase
    .from('users')
    .select('id, name, roles(name)')
    .eq('id', coordinatorId)
    .maybeSingle();

  if (!coordUser || coordUser.roles?.name !== 'EXAM_COORDINATOR') {
    const err = new Error('Unauthorized: Only an authorized Exam Coordinator can review question papers.');
    err.statusCode = 403;
    throw err;
  }

  const now = new Date().toISOString();
  let newReviewStatus = 'REVIEWED';
  let newPaperStatus = paper.status;

  if (normalizedAction === 'RETURN') {
    newReviewStatus = 'RETURNED';
  } else if (normalizedAction === 'REJECT') {
    newReviewStatus = 'REJECTED';
    newPaperStatus = 'ARCHIVED';
  } else {
    newReviewStatus = 'REVIEWED';
  }

  // Persist review transition
  const { data: updatedPaper, error: updateErr } = await supabase
    .from('question_papers')
    .update({
      review_status: newReviewStatus,
      status: newPaperStatus,
      reviewer_id: coordinatorId,
      reviewed_at: now,
      review_comments: comments ? comments.trim() : null,
      updated_at: now,
    })
    .eq('id', paperId)
    .select('*')
    .single();

  if (updateErr) {
    console.error('[QuestionPaperService] Error updating paper review status:', updateErr.message);
    const dbErr = new Error('Failed to record review decision in database.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // Record traceable verification history (Module 5)
  try {
    await supabase.from('paper_verifications').insert([
      {
        question_paper_id: paperId,
        verifier_id: coordinatorId,
        previous_status: paper.review_status || 'PENDING_REVIEW',
        new_status: newReviewStatus,
        decision: normalizedAction,
        comments: comments ? comments.trim() : null,
        verified_at: now,
      },
    ]);
  } catch (verifErr) {
    console.warn('[QuestionPaperService] Note: paper_verifications logging:', verifErr.message);
  }

  // Send Notifications
  if (newReviewStatus === 'REVIEWED') {
    try {
      const { data: admins } = await supabase
        .from('users')
        .select('id, roles!inner(name)')
        .eq('roles.name', 'ADMIN')
        .eq('is_active', true);

      if (admins && admins.length > 0) {
        for (const admin of admins) {
          await notificationService.createWorkflowNotification({
            recipientId: admin.id,
            questionPaperId: paperId,
            type: 'SYSTEM',
            subject: `Admin Approval Required: ${paper.title} (${paper.subject})`,
            message: `Exam Coordinator ${coordUser.name || 'Coordinator'} has reviewed and recommended question paper "${paper.title}" (${paper.subject}). Administrative approval is now required. Notes: ${comments || 'None'}`,
          }).catch(() => {});
        }
      }
    } catch (_) {}
  } else if (newReviewStatus === 'RETURNED' || newReviewStatus === 'REJECTED') {
    try {
      await notificationService.createWorkflowNotification({
        recipientId: paper.teacher_id,
        questionPaperId: paperId,
        type: 'SYSTEM',
        subject: `Question Paper ${newReviewStatus === 'RETURNED' ? 'Returned for Revision' : 'Rejected'}: ${paper.title}`,
        message: `Your question paper "${paper.title}" (${paper.subject}) has been ${newReviewStatus.toLowerCase()} by Exam Coordinator ${coordUser.name || 'Coordinator'}. Review comments: ${comments || 'No specific comments provided.'}`,
      }).catch(() => {});
    } catch (_) {}
  }

  // Audit log
  await auditLogService.logAuditEvent({
    userId: coordinatorId,
    role: 'EXAM_COORDINATOR',
    action: `QUESTION_PAPER_${newReviewStatus}`,
    resourceType: 'QUESTION_PAPER',
    resourceId: paperId,
    outcome: 'SUCCESS',
    summary: `Question paper ${paperId} was ${newReviewStatus.toLowerCase()} by coordinator`,
    metadata: {
      paperId,
      title: paper.title,
      reviewStatus: newReviewStatus,
      comments,
    },
  });

  return {
    success: true,
    message: `Question paper review completed successfully with decision: ${newReviewStatus}.`,
    paper: updatedPaper,
  };
}

/**
 * Administrator approves, returns, or rejects a question paper (Module 22 & Priority 2)
 */
async function adminApproveQuestionPaper({ paperId, adminId, adminName, action, comments }) {
  if (!paperId) throw new Error('Paper ID is required.');
  if (!adminId) throw new Error('Admin ID is required.');
  if (!action) throw new Error('Action is required (APPROVE, RETURN, or REJECT).');

  const normalizedAction = action.toUpperCase();
  if (!['APPROVE', 'RETURN', 'REJECT'].includes(normalizedAction)) {
    const err = new Error('Invalid action. Allowed: APPROVE, RETURN, REJECT.');
    err.statusCode = 400;
    throw err;
  }

  const { data: paper, error: fetchErr } = await supabase
    .from('question_papers')
    .select('*, teacher:users!teacher_id(id, name, email)')
    .eq('id', paperId)
    .maybeSingle();

  if (fetchErr || !paper) {
    const err = new Error('Question paper not found.');
    err.statusCode = 404;
    throw err;
  }

  const now = new Date().toISOString();
  let newAdminStatus = 'APPROVED';
  let newPaperStatus = 'SCHEDULED';

  if (normalizedAction === 'RETURN') {
    newAdminStatus = 'RETURNED';
    newPaperStatus = 'SUBMITTED';
  } else if (normalizedAction === 'REJECT') {
    newAdminStatus = 'REJECTED';
    newPaperStatus = 'ARCHIVED';
  } else {
    newAdminStatus = 'APPROVED';
    newPaperStatus = 'SCHEDULED';
  }

  const { data: updatedPaper, error: updateErr } = await supabase
    .from('question_papers')
    .update({
      admin_approval_status: newAdminStatus,
      status: newPaperStatus,
      admin_approver_id: adminId,
      admin_approved_at: now,
      admin_comments: comments ? comments.trim() : null,
      updated_at: now,
    })
    .eq('id', paperId)
    .select('*')
    .single();

  if (updateErr) {
    console.error('[QuestionPaperService] Error recording administrative decision:', updateErr.message);
    const dbErr = new Error('Failed to record administrative decision in database.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // Record traceable verification history (Module 5)
  try {
    await supabase.from('paper_verifications').insert([
      {
        question_paper_id: paperId,
        verifier_id: adminId,
        previous_status: paper.admin_approval_status || 'PENDING_APPROVAL',
        new_status: newAdminStatus,
        decision: normalizedAction,
        comments: comments ? comments.trim() : null,
        verified_at: now,
      },
    ]);
  } catch (verifErr) {
    console.warn('[QuestionPaperService] Note: admin paper_verifications logging:', verifErr.message);
  }

  // Notify Teacher and Coordinator
  try {
    await notificationService.createWorkflowNotification({
      recipientId: paper.teacher_id,
      questionPaperId: paperId,
      type: newAdminStatus === 'APPROVED' ? 'QUESTION_PAPER_SCHEDULED' : 'SYSTEM',
      subject: `Question Paper ${newAdminStatus === 'APPROVED' ? 'Approved' : newAdminStatus === 'RETURNED' ? 'Returned' : 'Rejected'}: ${paper.title}`,
      message: `Your question paper "${paper.title}" (${paper.subject}) has been ${newAdminStatus.toLowerCase()} by the Examination Cell Administrator. Notes: ${comments || 'Examination schedule verified.'}`,
    }).catch(() => {});

    if (paper.reviewer_id) {
      await notificationService.createWorkflowNotification({
        recipientId: paper.reviewer_id,
        questionPaperId: paperId,
        type: newAdminStatus === 'APPROVED' ? 'QUESTION_PAPER_SCHEDULED' : 'SYSTEM',
        subject: `Admin Decision on Paper: ${paper.title} (${newAdminStatus})`,
        message: `Question paper "${paper.title}" has been ${newAdminStatus.toLowerCase()} by the Administrator. Scheduled distribution can proceed accordingly.`,
      }).catch(() => {});
    }
  } catch (_) {}

  // Audit log
  await auditLogService.logAuditEvent({
    userId: adminId,
    role: 'ADMIN',
    action: `QUESTION_PAPER_ADMIN_${newAdminStatus}`,
    resourceType: 'QUESTION_PAPER',
    resourceId: paperId,
    outcome: 'SUCCESS',
    summary: `Question paper ${paperId} was ${newAdminStatus.toLowerCase()} by administrator`,
    metadata: {
      paperId,
      title: paper.title,
      adminStatus: newAdminStatus,
      paperStatus: newPaperStatus,
      comments,
    },
  });

  return {
    success: true,
    message: `Administrative decision recorded successfully: ${newAdminStatus}.`,
    paper: updatedPaper,
  };
}

/**
 * Retrieves question papers for administrative review and approval workspace (Module 22 & Priority 2)
 */
async function getAdminQuestionPapers({ status, reviewStatus, adminStatus, search, page = 1, limit = 50 } = {}) {
  let query = supabase
    .from('question_papers')
    .select(`
      id,
      title,
      subject,
      semester,
      academic_year,
      exam_type,
      exam_date,
      teacher_id,
      file_name,
      file_size,
      mime_type,
      status,
      submitted_at,
      scheduled_delivery_date,
      created_at,
      updated_at,
      department,
      review_status,
      reviewer_id,
      reviewed_at,
      review_comments,
      admin_approval_status,
      admin_approver_id,
      admin_approved_at,
      admin_comments,
      reviewer:users!reviewer_id (
        id,
        name,
        email
      ),
      admin_approver:users!admin_approver_id (
        id,
        name,
        email
      ),
      review_status,
      reviewer_id,
      reviewed_at,
      review_comments,
      admin_approval_status,
      admin_approver_id,
      admin_approved_at,
      admin_comments,
      teacher:users!teacher_id (
        id,
        name,
        email
      ),
      question_paper_assignments (
        id,
        assigned_to_user_id,
        delivery_status,
        recipient:users!assigned_to_user_id (
          id,
          name,
          email
        )
      )
    `, { count: 'exact' });

  if (status && status !== 'ALL') query = query.eq('status', status);
  if (reviewStatus && reviewStatus !== 'ALL') query = query.eq('review_status', reviewStatus);
  if (adminStatus && adminStatus !== 'ALL') query = query.eq('admin_approval_status', adminStatus);

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`title.ilike.${term},subject.ilike.${term}`);
  }

  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  query = query.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit, 10) - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('[QuestionPaperService] Error fetching admin question papers:', error.message);
    throw error;
  }

  return {
    papers: data || [],
    pagination: {
      total: count || (data ? data.length : 0),
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil((count || 1) / parseInt(limit, 10)),
    },
  };
}

/**
 * Retrieves the full verifiable history of review and verification decisions for a question paper (Module 5)
 */
async function getPaperVerificationHistory(paperId) {
  if (!paperId) throw new Error('Paper ID is required.');

  try {
    const { data, error } = await supabase
      .from('paper_verifications')
      .select(`
        id,
        question_paper_id,
        verifier_id,
        previous_status,
        new_status,
        decision,
        comments,
        verified_at,
        verifier:users!verifier_id (
          id,
          name,
          email,
          roles(name)
        )
      `)
      .eq('question_paper_id', paperId)
      .order('verified_at', { ascending: false });

    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (err) {
    console.warn('[QuestionPaperService] Error querying paper_verifications table:', err.message);
  }

  // Fallback to checking paper's reviewer_id directly
  try {
    const { data: paper } = await supabase
      .from('question_papers')
      .select('id, reviewer_id, reviewed_at, review_status, review_comments, reviewer:users!reviewer_id(id, name, email)')
      .eq('id', paperId)
      .maybeSingle();

    if (paper && paper.reviewer_id) {
      return [
        {
          id: `hist-${paper.id}`,
          question_paper_id: paper.id,
          verifier_id: paper.reviewer_id,
          previous_status: 'SUBMITTED',
          new_status: paper.review_status,
          decision: paper.review_status,
          comments: paper.review_comments,
          verified_at: paper.reviewed_at || new Date().toISOString(),
          verifier: paper.reviewer,
        },
      ];
    }
  } catch (_) {}

  return [];
}

module.exports = {
  submitQuestionPaper,
  getMyQuestionPapers,
  getAssignedQuestionPapers,
  getQuestionPaperById,
  getQuestionPaperDownloadUrl,
  downloadAndDecryptQuestionPaper,
  verifyQuestionPaperIntegrity,
  getEligibleRecipients,
  calculateNextCalendarDay,
  validateRecipientFaculty,
  deleteQuestionPaper,
  reviewQuestionPaper,
  adminApproveQuestionPaper,
  getAdminQuestionPapers,
  getPaperVerificationHistory,
};

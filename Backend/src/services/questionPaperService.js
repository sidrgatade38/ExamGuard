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

  // Ensure role is TEACHER
  const roleName = user.roles?.name?.toUpperCase();
  if (roleName !== 'TEACHER') {
    const roleErr = new Error('Question papers can only be assigned to a faculty member with the TEACHER role.');
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
      storage_path,
      file_size,
      mime_type,
      status,
      submitted_at,
      scheduled_delivery_date,
      created_at,
      updated_at,
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
      storage_path,
      file_size,
      mime_type,
      status,
      submitted_at,
      scheduled_delivery_date,
      created_at,
      updated_at,
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
  if (requesterRole !== 'TEACHER') {
    const forbiddenErr = new Error('Access forbidden. You do not own this question paper.');
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }

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

  return paper;
}

/**
 * Generates a short-lived signed URL (300 seconds) for downloading a question paper file from private storage.
 * Enforces ownership check before issuing download access.
 */
async function getQuestionPaperDownloadUrl(paperId, requesterId, requesterRole) {
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
  // 1. Verify paper exists and requester is authorized authoring TEACHER
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
 * Retrieves eligible active faculty members with role TEACHER for recipient selection.
 */
async function getEligibleRecipients(requesterId) {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, email, is_active, roles!inner(name)')
    .eq('roles.name', 'TEACHER')
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
};

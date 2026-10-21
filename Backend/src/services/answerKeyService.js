const crypto = require('crypto');
const config = require('../config');
const { supabase } = require('../config/supabase');
const keyManagementService = require('./keyManagementService');
const signatureService = require('./signatureService');
const verificationService = require('./verificationService');
const auditLogService = require('./auditLogService');

/**
 * Answer Key Service (Module 10)
 * 
 * Manages post-examination Answer Key lifecycle:
 * 1. Strict ownership validation: Only the teacher who authored the question paper can upload its answer key.
 * 2. Timing window enforcement:
 *    - Rejects uploads before the examination (diffDays < 0).
 *    - Preferred submission period: 0–2 days post-exam.
 *    - Maximum allowed submission period: up to 4 days post-exam.
 *    - Rejects uploads after 4 days deadline (diffDays > 4).
 * 3. Envelope Encryption & Key Wrapping:
 *    - 32-byte AES DEK, 12-byte IV, 16-byte GCM auth tag.
 *    - RSA-OAEP key wrapping of the AES DEK (256 bytes).
 *    - Plaintext AES key is NEVER stored in database or storage.
 * 4. Digital Signature & Integrity:
 *    - RSA-PSS with SHA-256 digital signature over exact stored ciphertext envelope.
 * 5. Verify-Before-Decrypt:
 *    - Enforces SHA-256 integrity check and RSA-PSS signature verification BEFORE unwrapping or decrypting.
 * 6. Access Control:
 *    - Owning teacher has full access (metadata, verify, download).
 *    - Assigned exam coordinator has operational access to submitted answer keys.
 *    - Unauthorized teachers or coordinators are strictly rejected with 403 Forbidden.
 */

/**
 * Computes the answer key submission window state based on authoritative exam date and server time.
 *
 * @param {string} examDateStr - Examination date string (YYYY-MM-DD)
 * @param {Date} [now=new Date()] - Current server time
 * @returns {Object} Submission window details
 */
function getAnswerKeySubmissionWindow(examDateStr, now = new Date()) {
  if (!examDateStr || typeof examDateStr !== 'string') {
    throw new Error('Valid exam date string is required to evaluate submission window.');
  }

  const currentDateStr = now.toISOString().split('T')[0];
  const examDateObj = new Date(examDateStr + 'T00:00:00Z');
  const nowDateObj = new Date(currentDateStr + 'T00:00:00Z');

  // Difference in calendar days
  const diffDays = Math.round((nowDateObj.getTime() - examDateObj.getTime()) / (1000 * 60 * 60 * 24));

  const preferredDeadlineObj = new Date(examDateObj);
  preferredDeadlineObj.setUTCDate(preferredDeadlineObj.getUTCDate() + 2);
  const preferredDeadlineStr = preferredDeadlineObj.toISOString().split('T')[0];

  const maxDeadlineObj = new Date(examDateObj);
  maxDeadlineObj.setUTCDate(maxDeadlineObj.getUTCDate() + 4);
  const maxDeadlineStr = maxDeadlineObj.toISOString().split('T')[0];

  let status = 'WINDOW_OPEN';
  let canUpload = true;
  let message = 'Answer key submission is open.';

  if (diffDays < 0) {
    status = 'BEFORE_EXAM';
    canUpload = false;
    message = 'Answer key cannot be uploaded before the examination.';
  } else if (diffDays <= 2) {
    status = 'WINDOW_OPEN_PREFERRED';
    canUpload = true;
    message = 'Answer key submission is open (preferred window: 0–2 days).';
  } else if (diffDays <= 4) {
    status = 'WINDOW_OPEN_EXTENDED';
    canUpload = true;
    message = 'Answer key submission is open (extended window: up to 4 days).';
  } else {
    status = 'WINDOW_EXPIRED';
    canUpload = false;
    message = 'Answer key submission window has expired.';
  }

  return {
    status,
    canUpload,
    message,
    daysSinceExam: diffDays,
    examDate: examDateStr,
    currentDate: currentDateStr,
    preferredDeadline: preferredDeadlineStr,
    maxDeadline: maxDeadlineStr,
  };
}

/**
 * Creates and submits an Answer Key for a question paper.
 * Enforces ownership, timing window, envelope encryption, digital signing, and storage isolation.
 */
async function uploadAnswerKey({
  teacherId,
  questionPaperId,
  file,
  sanitizedFileName,
}) {
  if (!teacherId) {
    const err = new Error('Authenticated teacher ID is required.');
    err.statusCode = 401;
    throw err;
  }

  if (!questionPaperId) {
    const err = new Error('Question paper ID is required.');
    err.statusCode = 400;
    throw err;
  }

  if (!file || !file.buffer) {
    const err = new Error('Answer key file buffer is required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Fetch Question Paper to verify ownership and exam scheduling
  const { data: paper, error: paperError } = await supabase
    .from('question_papers')
    .select('id, teacher_id, exam_date, status, title, subject')
    .eq('id', questionPaperId)
    .maybeSingle();

  if (paperError) {
    console.error('[AnswerKeyService] Database query error on question_papers:', paperError.message);
    const dbErr = new Error('Failed to retrieve question paper record.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!paper) {
    const notFoundErr = new Error('Question paper not found.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  // 2. Strict Teacher Ownership Validation:
  // Only the teacher who authored the question paper can upload its answer key
  if (paper.teacher_id !== teacherId) {
    await auditLogService.logAuditEvent({
      userId: teacherId,
      role: 'TEACHER',
      action: 'UNAUTHORIZED_ACCESS',
      resourceType: 'ANSWER_KEY',
      resourceId: questionPaperId,
      outcome: 'DENIED',
      summary: `Unauthorized attempt to upload answer key for unowned paper ${questionPaperId}`,
      metadata: { questionPaperId, paperTeacherId: paper.teacher_id },
    });
    const forbiddenErr = new Error('Access forbidden. You can only upload answer keys for question papers you authored.');
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }

  // 3. Draft question paper check: Cannot upload answer key for a DRAFT paper
  if (paper.status === 'DRAFT') {
    const draftErr = new Error('Cannot upload answer key for a draft question paper.');
    draftErr.statusCode = 400;
    throw draftErr;
  }

  // 4. Server-controlled Exam Timing Validation (0–4 days post-exam)
  const windowInfo = getAnswerKeySubmissionWindow(paper.exam_date);
  if (!windowInfo.canUpload) {
    await auditLogService.logAuditEvent({
      userId: teacherId,
      role: 'TEACHER',
      action: 'ANSWER_KEY_UPLOADED',
      resourceType: 'ANSWER_KEY',
      resourceId: questionPaperId,
      outcome: 'DENIED',
      summary: `Answer key upload rejected: ${windowInfo.message}`,
      metadata: { questionPaperId, examDate: paper.exam_date, windowStatus: windowInfo.status },
    });
    const timingErr = new Error(windowInfo.message);
    timingErr.statusCode = 400;
    throw timingErr;
  }

  // 5. Duplicate Answer Key Protection:
  // Exactly 1 answer key per question paper. Rejects duplicate submissions.
  const { data: existingAnswerKey, error: existingErr } = await supabase
    .from('answer_keys')
    .select('id')
    .eq('question_paper_id', questionPaperId)
    .maybeSingle();

  if (existingErr) {
    console.error('[AnswerKeyService] Database error checking existing answer key:', existingErr.message);
    const dbErr = new Error('Failed to verify answer key status.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (existingAnswerKey) {
    await auditLogService.logAuditEvent({
      userId: teacherId,
      role: 'TEACHER',
      action: 'ANSWER_KEY_UPLOADED',
      resourceType: 'ANSWER_KEY',
      resourceId: questionPaperId,
      outcome: 'DENIED',
      summary: 'Duplicate answer key submission rejected',
      metadata: { questionPaperId, existingAnswerKeyId: existingAnswerKey.id },
    });
    const dupErr = new Error('Answer key has already been submitted for this question paper.');
    dupErr.statusCode = 400;
    throw dupErr;
  }

  // 6. In-Memory Cryptographic Envelope Encryption
  // Unique 32-byte AES DEK + 12-byte IV + AES-256-GCM encryption
  const aesKey = keyManagementService.generateDocumentKey();
  const iv = keyManagementService.generateIv();

  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  const ciphertextBuffer = Buffer.concat([cipher.update(file.buffer), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16 bytes

  // Wrap AES DEK using dedicated RSA-OAEP public wrapping key
  const wrappedKeyBase64 = keyManagementService.wrapAesKey(aesKey);
  const wrappedKeyBuf = Buffer.from(wrappedKeyBase64, 'base64'); // 256 bytes

  // Construct self-contained envelope container buffer:
  // [256-byte wrappedKey] [12-byte IV] [16-byte AuthTag] [Ciphertext...]
  const encryptedEnvelopeBuffer = Buffer.concat([
    wrappedKeyBuf,
    iv,
    authTag,
    ciphertextBuffer,
  ]);

  // 7. RSA-PSS Digital Signature over exact stored ciphertext envelope
  const signingResult = signatureService.signQuestionPaper(encryptedEnvelopeBuffer);

  // 8. Storage Path & Filename Sanitation
  const answerKeyId = crypto.randomUUID();
  const bucketName = config.storageBucket || 'examguard-storage';
  const finalFileName = sanitizedFileName || `answer_key_${Date.now()}.pdf`;

  if (finalFileName.includes('..') || finalFileName.includes('/') || finalFileName.includes('\\') || finalFileName.includes('\0')) {
    const err = new Error('Invalid filename. Path traversal sequences and directory separators are forbidden.');
    err.statusCode = 400;
    throw err;
  }

  const safeEncryptedFileName = `${finalFileName}.enc`;
  const storagePath = `answer-keys/${teacherId}/${questionPaperId}/encrypted/${safeEncryptedFileName}`;

  // 9. Upload Encrypted Ciphertext Envelope to Private Storage
  let storageUploadSuccessful = false;
  try {
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, encryptedEnvelopeBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (uploadError) {
      console.error('[AnswerKeyService] Storage upload failed:', uploadError.message);
      const storageErr = new Error(`Failed to store answer key file: ${uploadError.message}`);
      storageErr.statusCode = 502;
      throw storageErr;
    }
    storageUploadSuccessful = true;
  } catch (storageErr) {
    if (!storageErr.statusCode) storageErr.statusCode = 502;
    throw storageErr;
  }

  // 10. Database Inserts: answer_keys and digital_signatures
  let answerKeyRecordCreated = false;
  let sigRecordCreated = false;
  let createdAnswerKey = null;
  let createdSignature = null;

  try {
    const { data: akData, error: akError } = await supabase
      .from('answer_keys')
      .insert([
        {
          id: answerKeyId,
          question_paper_id: questionPaperId,
          teacher_id: teacherId,
          file_name: finalFileName,
          storage_path: storagePath,
          file_size: encryptedEnvelopeBuffer.length,
          mime_type: 'application/pdf',
          exam_date: paper.exam_date,
          uploaded_at: new Date().toISOString(),
          status: 'READY',
        },
      ])
      .select('*')
      .single();

    if (akError || !akData) {
      console.error('[AnswerKeyService] Database insert failed for answer_keys:', akError?.message);
      throw new Error(akError?.message || 'Database error creating answer key record');
    }

    answerKeyRecordCreated = true;
    createdAnswerKey = akData;

    // 11. Insert record into digital_signatures table (with answer_key_id set)
    const { data: sigData, error: sigError } = await supabase
      .from('digital_signatures')
      .insert([
        {
          answer_key_id: answerKeyId,
          question_paper_id: null,
          algorithm: signingResult.algorithm,
          file_hash: signingResult.fileHash,
          signature: signingResult.signature,
          public_key_reference: signingResult.publicKeyReference,
        },
      ])
      .select('*')
      .single();

    if (sigError || !sigData) {
      console.error('[AnswerKeyService] Database insert failed for digital_signatures:', sigError?.message);
      throw new Error(sigError?.message || 'Database error creating digital signature record');
    }

    sigRecordCreated = true;
    createdSignature = sigData;

    // Log successful answer key upload
    await auditLogService.logAuditEvent({
      userId: teacherId,
      role: 'TEACHER',
      action: 'ANSWER_KEY_UPLOADED',
      resourceType: 'ANSWER_KEY',
      resourceId: createdAnswerKey.id,
      outcome: 'SUCCESS',
      summary: `Answer key successfully uploaded for question paper ${questionPaperId}`,
      metadata: { questionPaperId, answerKeyId: createdAnswerKey.id, fileName: finalFileName },
    });

    // Return safe metadata - NEVER leaks AES keys, wrapped keys, IVs, or private keys
    return {
      answerKey: {
        id: createdAnswerKey.id,
        questionPaperId: createdAnswerKey.question_paper_id,
        fileName: createdAnswerKey.file_name,
        fileSize: createdAnswerKey.file_size,
        mimeType: createdAnswerKey.mime_type,
        examDate: createdAnswerKey.exam_date,
        uploadedAt: createdAnswerKey.uploaded_at,
        status: createdAnswerKey.status,
      },
      digitalSignature: {
        id: createdSignature.id,
        algorithm: createdSignature.algorithm,
        fileHash: createdSignature.file_hash,
        createdAt: createdSignature.created_at,
      },
      submissionWindow: windowInfo,
    };
  } catch (dbError) {
    // Compensating rollback cleanup
    console.warn('[AnswerKeyService] Compensating rollback initiated for failed submission...');

    if (sigRecordCreated) {
      await supabase.from('digital_signatures').delete().eq('answer_key_id', answerKeyId).catch(() => {});
    }

    if (answerKeyRecordCreated) {
      await supabase.from('answer_keys').delete().eq('id', answerKeyId).catch(() => {});
    }

    if (storageUploadSuccessful) {
      await supabase.storage.from(bucketName).remove([storagePath]).catch(() => {});
    }

    const failureErr = new Error(`Submission failed: ${dbError.message}`);
    failureErr.statusCode = 500;
    throw failureErr;
  }
}

/**
 * Retrieves safe Answer Key metadata and submission window for the authoring teacher.
 */
async function getAnswerKeyForTeacher(questionPaperId, teacherId) {
  if (!questionPaperId) {
    const err = new Error('Question paper ID is required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Verify paper ownership
  const { data: paper, error: paperError } = await supabase
    .from('question_papers')
    .select('id, teacher_id, exam_date, title, subject, status')
    .eq('id', questionPaperId)
    .maybeSingle();

  if (paperError) {
    const dbErr = new Error('Failed to retrieve question paper record.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!paper) {
    const notFoundErr = new Error('Question paper not found.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  if (paper.teacher_id !== teacherId) {
    const forbiddenErr = new Error('Access forbidden. You do not own this question paper.');
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }

  const windowInfo = getAnswerKeySubmissionWindow(paper.exam_date);

  // 2. Fetch answer key record
  const { data: answerKey, error: akError } = await supabase
    .from('answer_keys')
    .select('id, question_paper_id, file_name, file_size, mime_type, exam_date, uploaded_at, status')
    .eq('question_paper_id', questionPaperId)
    .maybeSingle();

  if (akError) {
    const dbErr = new Error('Failed to retrieve answer key details.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!answerKey) {
    return {
      submitted: false,
      questionPaperId,
      submissionWindow: windowInfo,
    };
  }

  // 3. Fetch digital signature
  const { data: sigRecord } = await supabase
    .from('digital_signatures')
    .select('id, algorithm, file_hash, public_key_reference, created_at')
    .eq('answer_key_id', answerKey.id)
    .maybeSingle();

  return {
    submitted: true,
    id: answerKey.id,
    questionPaperId: answerKey.question_paper_id,
    fileName: answerKey.file_name,
    fileSize: answerKey.file_size,
    mimeType: answerKey.mime_type,
    examDate: answerKey.exam_date,
    uploadedAt: answerKey.uploaded_at,
    status: answerKey.status,
    submissionWindow: windowInfo,
    digitalSignature: sigRecord
      ? {
          id: sigRecord.id,
          algorithm: sigRecord.algorithm,
          fileHash: sigRecord.file_hash,
          signedAt: sigRecord.created_at,
          publicKeyReference: sigRecord.public_key_reference,
        }
      : null,
  };
}

/**
 * Downloads and decrypts an Answer Key for the authoring teacher.
 * Enforces Verify-Before-Decrypt: SHA-256 -> RSA-PSS -> RSA-OAEP -> AES-256-GCM.
 */
async function downloadAnswerKeyForTeacher(questionPaperId, teacherId) {
  if (!questionPaperId) {
    const err = new Error('Question paper ID is required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Verify paper ownership
  const { data: paper, error: paperError } = await supabase
    .from('question_papers')
    .select('id, teacher_id')
    .eq('id', questionPaperId)
    .maybeSingle();

  if (paperError || !paper) {
    const err = new Error('Question paper not found.');
    err.statusCode = 404;
    throw err;
  }

  if (paper.teacher_id !== teacherId) {
    const forbiddenErr = new Error('Access forbidden. You do not own this question paper.');
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }

  // 2. Fetch answer key record
  const { data: answerKey, error: akError } = await supabase
    .from('answer_keys')
    .select('id, question_paper_id, file_name, storage_path, status')
    .eq('question_paper_id', questionPaperId)
    .maybeSingle();

  if (akError) {
    const dbErr = new Error('Failed to retrieve answer key details.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!answerKey) {
    const notFoundErr = new Error('Answer key has not been submitted for this question paper yet.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  return downloadAndDecryptAnswerKeyRecord(answerKey);
}

/**
 * Verifies digital signature & SHA-256 integrity of an Answer Key for the authoring teacher.
 */
async function verifyAnswerKeySignatureForTeacher(questionPaperId, teacherId) {
  if (!questionPaperId) {
    const err = new Error('Question paper ID is required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Verify paper ownership
  const { data: paper, error: paperError } = await supabase
    .from('question_papers')
    .select('id, teacher_id')
    .eq('id', questionPaperId)
    .maybeSingle();

  if (paperError || !paper) {
    const err = new Error('Question paper not found.');
    err.statusCode = 404;
    throw err;
  }

  if (paper.teacher_id !== teacherId) {
    const forbiddenErr = new Error('Access forbidden. You do not own this question paper.');
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }

  // 2. Fetch answer key record
  const { data: answerKey, error: akError } = await supabase
    .from('answer_keys')
    .select('id, storage_path')
    .eq('question_paper_id', questionPaperId)
    .maybeSingle();

  if (akError || !answerKey) {
    const notFoundErr = new Error('Answer key has not been submitted for this question paper.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  return verifyAnswerKeyRecordIntegrity(answerKey);
}

/**
 * Retrieves safe Answer Key metadata for an authorized Exam Coordinator.
 * Checks that the question paper is legitimately assigned to the coordinator.
 */
async function getAnswerKeyForCoordinator(questionPaperId, coordinatorId) {
  if (!questionPaperId) {
    const err = new Error('Question paper ID is required.');
    err.statusCode = 400;
    throw err;
  }

  if (!coordinatorId) {
    const err = new Error('Coordinator ID is required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Verify coordinator assignment to this question paper
  const { data: assignment, error: assignError } = await supabase
    .from('question_paper_assignments')
    .select('id')
    .eq('question_paper_id', questionPaperId)
    .eq('assigned_to_user_id', coordinatorId)
    .maybeSingle();

  if (assignError) {
    const dbErr = new Error('Failed to verify question paper assignment.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // Check if paper exists first to distinguish 404 vs 403
  const { data: paper, error: paperError } = await supabase
    .from('question_papers')
    .select('id, status, exam_date')
    .eq('id', questionPaperId)
    .maybeSingle();

  if (paperError || !paper) {
    const notFoundErr = new Error('Question paper not found.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  if (!assignment || paper.status === 'DRAFT') {
    const forbiddenErr = new Error('Access forbidden. You are not authorized to access this question paper.');
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }

  // 2. Fetch answer key record
  const { data: answerKey, error: akError } = await supabase
    .from('answer_keys')
    .select('id, question_paper_id, file_name, file_size, mime_type, exam_date, uploaded_at, status')
    .eq('question_paper_id', questionPaperId)
    .maybeSingle();

  if (akError) {
    const dbErr = new Error('Failed to retrieve answer key details.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!answerKey) {
    return {
      submitted: false,
      questionPaperId,
      message: 'Answer key not yet submitted.',
    };
  }

  // 3. Fetch digital signature
  const { data: sigRecord } = await supabase
    .from('digital_signatures')
    .select('id, algorithm, file_hash, public_key_reference, created_at')
    .eq('answer_key_id', answerKey.id)
    .maybeSingle();

  return {
    submitted: true,
    id: answerKey.id,
    questionPaperId: answerKey.question_paper_id,
    fileName: answerKey.file_name,
    fileSize: answerKey.file_size,
    mimeType: answerKey.mime_type,
    examDate: answerKey.exam_date,
    uploadedAt: answerKey.uploaded_at,
    status: answerKey.status,
    digitalSignature: sigRecord
      ? {
          id: sigRecord.id,
          algorithm: sigRecord.algorithm,
          fileHash: sigRecord.file_hash,
          signedAt: sigRecord.created_at,
          publicKeyReference: sigRecord.public_key_reference,
        }
      : null,
  };
}

/**
 * Downloads and decrypts an Answer Key for an authorized Exam Coordinator.
 * Enforces Verify-Before-Decrypt: SHA-256 -> RSA-PSS -> RSA-OAEP -> AES-256-GCM.
 */
async function downloadAnswerKeyForCoordinator(questionPaperId, coordinatorId) {
  if (!questionPaperId) {
    const err = new Error('Question paper ID is required.');
    err.statusCode = 400;
    throw err;
  }

  if (!coordinatorId) {
    const err = new Error('Coordinator ID is required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Verify coordinator assignment
  const { data: assignment, error: assignError } = await supabase
    .from('question_paper_assignments')
    .select('id')
    .eq('question_paper_id', questionPaperId)
    .eq('assigned_to_user_id', coordinatorId)
    .maybeSingle();

  if (assignError) {
    const dbErr = new Error('Failed to verify question paper assignment.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  const { data: paper, error: paperError } = await supabase
    .from('question_papers')
    .select('id, status')
    .eq('id', questionPaperId)
    .maybeSingle();

  if (paperError || !paper) {
    const notFoundErr = new Error('Question paper not found.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  if (!assignment || paper.status === 'DRAFT') {
    const forbiddenErr = new Error('Access forbidden. You are not authorized to download this answer key.');
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }

  // 2. Fetch answer key record
  const { data: answerKey, error: akError } = await supabase
    .from('answer_keys')
    .select('id, question_paper_id, file_name, storage_path, status')
    .eq('question_paper_id', questionPaperId)
    .maybeSingle();

  if (akError) {
    const dbErr = new Error('Failed to retrieve answer key details.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!answerKey) {
    const notFoundErr = new Error('Answer key has not been submitted for this question paper yet.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  return downloadAndDecryptAnswerKeyRecord(answerKey);
}

/**
 * Verifies digital signature & SHA-256 integrity of an Answer Key for an authorized Exam Coordinator.
 */
async function verifyAnswerKeySignatureForCoordinator(questionPaperId, coordinatorId) {
  if (!questionPaperId) {
    const err = new Error('Question paper ID is required.');
    err.statusCode = 400;
    throw err;
  }

  if (!coordinatorId) {
    const err = new Error('Coordinator ID is required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Verify coordinator assignment
  const { data: assignment, error: assignError } = await supabase
    .from('question_paper_assignments')
    .select('id')
    .eq('question_paper_id', questionPaperId)
    .eq('assigned_to_user_id', coordinatorId)
    .maybeSingle();

  if (assignError) {
    const dbErr = new Error('Failed to verify question paper assignment.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  const { data: paper, error: paperError } = await supabase
    .from('question_papers')
    .select('id, status')
    .eq('id', questionPaperId)
    .maybeSingle();

  if (paperError || !paper) {
    const notFoundErr = new Error('Question paper not found.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  if (!assignment || paper.status === 'DRAFT') {
    const forbiddenErr = new Error('Access forbidden. You are not authorized to verify this answer key.');
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }

  // 2. Fetch answer key record
  const { data: answerKey, error: akError } = await supabase
    .from('answer_keys')
    .select('id, storage_path')
    .eq('question_paper_id', questionPaperId)
    .maybeSingle();

  if (akError || !answerKey) {
    const notFoundErr = new Error('Answer key has not been submitted for this question paper.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  return verifyAnswerKeyRecordIntegrity(answerKey);
}

/**
 * Internal helper to download, verify, and decrypt an Answer Key record.
 * Executes strict Verify-Before-Decrypt pipeline:
 * 1. Checks storage path.
 * 2. Downloads ciphertext from private storage.
 * 3. Verifies SHA-256 hash.
 * 4. Verifies RSA-PSS digital signature.
 * 5. Extracts envelope header: unwraps AES DEK with RSA-OAEP private key.
 * 6. Decrypts AES-256-GCM ciphertext and validates auth tag.
 * 7. Returns decrypted PDF buffer.
 */
async function downloadAndDecryptAnswerKeyRecord(answerKey) {
  // 1. Storage path validation
  if (!answerKey.storage_path || answerKey.storage_path.includes('..') || !answerKey.storage_path.startsWith('answer-keys/')) {
    const err = new Error('Invalid or corrupted storage path. Access forbidden.');
    err.statusCode = 403;
    throw err;
  }

  const bucketName = config.storageBucket || 'examguard-storage';

  // 2. Download ciphertext envelope buffer from private storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(bucketName)
    .download(answerKey.storage_path);

  if (downloadError || !fileData) {
    console.error('[AnswerKeyService] Storage download failed:', downloadError?.message);
    const storageErr = new Error('Failed to retrieve answer key from secure storage.');
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

  // 3. Retrieve digital signature record for Answer Key
  const { data: sigRecord, error: sigError } = await supabase
    .from('digital_signatures')
    .select('algorithm, file_hash, signature, public_key_reference')
    .eq('answer_key_id', answerKey.id)
    .maybeSingle();

  if (sigError) {
    console.error('[AnswerKeyService] Error fetching digital signature:', sigError.message);
    const dbErr = new Error('Failed to retrieve answer key digital signature.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // 4. Enforce canonical Verify-Before-Decrypt pipeline via verificationService (Module 11):
  // SHA-256 integrity -> RSA-PSS signature -> RSA-OAEP DEK unwrap -> AES-256-GCM decrypt & auth
  const decryptedBuffer = verificationService.verifyAndDecryptAnswerKey({
    envelopeBuffer: fileBuffer,
    sigRecord,
  });

  return {
    decryptedBuffer,
    fileName: answerKey.file_name,
    mimeType: 'application/pdf',
  };
}

/**
 * Internal helper to evaluate RSA-PSS digital signature and SHA-256 hash over an Answer Key record.
 * Does NOT decrypt document.
 */
async function verifyAnswerKeyRecordIntegrity(answerKey) {
  if (!answerKey.storage_path || answerKey.storage_path.includes('..') || !answerKey.storage_path.startsWith('answer-keys/')) {
    const err = new Error('Invalid or corrupted storage path. Access forbidden.');
    err.statusCode = 403;
    throw err;
  }

  const bucketName = config.storageBucket || 'examguard-storage';

  // 1. Fetch digital signature record
  const { data: sigRecord, error: sigError } = await supabase
    .from('digital_signatures')
    .select('algorithm, file_hash, signature, public_key_reference, created_at')
    .eq('answer_key_id', answerKey.id)
    .maybeSingle();

  if (sigError) {
    const dbErr = new Error('Failed to retrieve answer key digital signature.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!sigRecord) {
    return {
      verified: false,
      tamperDetected: false,
      message: 'No digital signature record exists for this answer key.',
    };
  }

  // 2. Download ciphertext envelope from storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(bucketName)
    .download(answerKey.storage_path);

  if (downloadError || !fileData) {
    const storageErr = new Error('Failed to retrieve answer key from storage for signature verification.');
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
  return verificationService.verifyAnswerKeyIntegrityOnly({
    envelopeBuffer: fileBuffer,
    sigRecord,
  });
}

module.exports = {
  getAnswerKeySubmissionWindow,
  uploadAnswerKey,
  getAnswerKeyForTeacher,
  downloadAnswerKeyForTeacher,
  verifyAnswerKeySignatureForTeacher,
  getAnswerKeyForCoordinator,
  downloadAnswerKeyForCoordinator,
  verifyAnswerKeySignatureForCoordinator,
  downloadAndDecryptAnswerKeyRecord,
  verifyAnswerKeyRecordIntegrity,
};

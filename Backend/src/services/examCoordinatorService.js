const crypto = require('crypto');
const config = require('../config');
const { supabase } = require('../config/supabase');
const encryptionService = require('./encryptionService');
const signatureService = require('./signatureService');
const verificationService = require('./verificationService');
const auditLogService = require('./auditLogService');

/**
 * Exam Coordinator Service (Module 9)
 * 
 * Manages operational access to examination question papers for the EXAM_COORDINATOR role:
 * 1. Retrieves question papers legitimately assigned to the coordinator.
 * 2. Enforces strict paper authorization (rejects non-assigned and draft papers).
 * 3. Enforces Verify-Before-Decrypt pipeline:
 *    Download ciphertext -> Verify SHA-256 hash -> Verify RSA-PSS signature ->
 *    Retrieve/unwrap AES DEK -> Decrypt AES-256-GCM -> Stream PDF.
 * 4. Ensures zero cryptographic leakage: Plaintext AES keys, wrapped keys, IVs, auth tags,
 *    and RSA private keys are NEVER exposed to client.
 */

/**
 * Retrieves all question papers legitimately assigned to the authenticated Exam Coordinator.
 * Returns safe metadata only.
 *
 * @param {string} coordinatorId - UUID of authenticated Exam Coordinator
 * @returns {Promise<Array<Object>>} List of sanitized question paper objects
 */
async function getAvailableQuestionPapers(coordinatorId) {
  if (!coordinatorId) {
    const err = new Error('Coordinator ID is required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Fetch assignments for this coordinator
  const { data: assignments, error: assignError } = await supabase
    .from('question_paper_assignments')
    .select('id, question_paper_id, assigned_to_user_id, assigned_by_user_id, assigned_at, scheduled_delivery_date, delivered_at, delivery_status')
    .eq('assigned_to_user_id', coordinatorId);

  if (assignError) {
    console.error('[ExamCoordinatorService] Error fetching coordinator assignments:', assignError.message);
    const dbErr = new Error('Failed to retrieve assigned question papers.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!assignments || assignments.length === 0) {
    return [];
  }

  // Map assignments by paperId for fast lookup
  const assignmentMap = new Map();
  for (const a of assignments) {
    assignmentMap.set(a.question_paper_id, a);
  }

  const paperIds = Array.from(assignmentMap.keys());

  // 2. Fetch paper metadata for all assigned papers (excluding DRAFT)
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
    console.error('[ExamCoordinatorService] Error fetching assigned papers:', papersError.message);
    const dbErr = new Error('Failed to retrieve question paper details.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // 3. Format safe metadata - strictly omit storage_path and all cryptographic secrets
  const availablePapers = (papers || [])
    .filter((paper) => paper.status !== 'DRAFT')
    .map((paper) => {
      const assignment = assignmentMap.get(paper.id);
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
        scheduledDeliveryDate: paper.scheduled_delivery_date,
        fileName: paper.file_name,
        fileSize: paper.file_size,
        mimeType: paper.mime_type,
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

  return availablePapers;
}

/**
 * Retrieves safe metadata for a specific authorized question paper.
 * Enforces strict authorization: paper must exist, cannot be DRAFT, and must be assigned
 * to the authenticated coordinator.
 *
 * @param {string} paperId - UUID of the question paper
 * @param {string} coordinatorId - UUID of authenticated Exam Coordinator
 * @returns {Promise<Object>} Safe question paper metadata
 */
async function getQuestionPaperById(paperId, coordinatorId) {
  if (!paperId) {
    const err = new Error('Question paper ID is required.');
    err.statusCode = 400;
    throw err;
  }

  if (!coordinatorId) {
    const err = new Error('Coordinator ID is required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Fetch paper record
  const { data: paper, error: paperError } = await supabase
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
    .eq('id', paperId)
    .maybeSingle();

  if (paperError) {
    console.error('[ExamCoordinatorService] Error fetching paper:', paperError.message);
    const dbErr = new Error('Failed to retrieve question paper details.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!paper) {
    const notFoundErr = new Error('Question paper not found.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  // 2. Fetch assignment for this paper and coordinator
  const { data: assignment, error: assignError } = await supabase
    .from('question_paper_assignments')
    .select('id, question_paper_id, assigned_to_user_id, assigned_by_user_id, assigned_at, scheduled_delivery_date, delivered_at, delivery_status')
    .eq('question_paper_id', paperId)
    .eq('assigned_to_user_id', coordinatorId)
    .maybeSingle();

  if (assignError) {
    console.error('[ExamCoordinatorService] Error fetching assignment:', assignError.message);
    const dbErr = new Error('Failed to verify question paper assignment.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // Strict ownership / assignment validation:
  if (!assignment || paper.status === 'DRAFT') {
    await auditLogService.logAuditEvent({
      userId: coordinatorId,
      role: 'EXAM_COORDINATOR',
      action: 'UNAUTHORIZED_ACCESS',
      resourceType: 'QUESTION_PAPER',
      resourceId: paperId,
      outcome: 'DENIED',
      summary: `Unauthorized attempt by coordinator to access unassigned question paper ${paperId}`,
      metadata: { coordinatorId, paperId },
    });
    const forbiddenErr = new Error('Access forbidden. You are not authorized to access this question paper.');
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }

  const signature = Array.isArray(paper.digital_signatures)
    ? paper.digital_signatures[0]
    : paper.digital_signatures;

  // Safe metadata response (storage_path and keys strictly omitted)
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
    scheduledDeliveryDate: paper.scheduled_delivery_date,
    fileName: paper.file_name,
    fileSize: paper.file_size,
    mimeType: paper.mime_type,
    teacher: paper.teacher
      ? {
          id: paper.teacher.id,
          name: paper.teacher.name,
          email: paper.teacher.email,
        }
      : null,
    assignment: {
      id: assignment.id,
      assignedAt: assignment.assigned_at,
      scheduledDeliveryDate: assignment.scheduled_delivery_date,
      deliveredAt: assignment.delivered_at,
      deliveryStatus: assignment.delivery_status,
    },
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
}

/**
 * Downloads and decrypts an authorized question paper for the Exam Coordinator.
 * Enforces Verify-Before-Decrypt:
 * 1. Checks authorization (404 if not found, 403 if not assigned).
 * 2. Checks storage path security (prevents directory traversal).
 * 3. Downloads ciphertext buffer from private storage.
 * 4. Verifies SHA-256 hash against stored file_hash.
 * 5. Verifies RSA-PSS digital signature over downloaded ciphertext.
 * 6. Retrieves wrapped AES key and unwraps with RSA-OAEP private key.
 * 7. Decrypts AES-256-GCM ciphertext and validates authentication tag.
 * 8. Returns decrypted PDF buffer.
 *
 * @param {string} paperId - UUID of the question paper
 * @param {string} coordinatorId - UUID of authenticated Exam Coordinator
 * @returns {Promise<{ decryptedBuffer: Buffer, fileName: string, mimeType: string }>}
 */
async function downloadAndDecryptQuestionPaper(paperId, coordinatorId) {
  if (!paperId) {
    const err = new Error('Question paper ID is required.');
    err.statusCode = 400;
    throw err;
  }

  if (!coordinatorId) {
    const err = new Error('Coordinator ID is required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Fetch paper record (internal lookup with storage_path)
  const { data: paper, error: paperError } = await supabase
    .from('question_papers')
    .select('id, file_name, storage_path, mime_type, status')
    .eq('id', paperId)
    .maybeSingle();

  if (paperError) {
    console.error('[ExamCoordinatorService] Error fetching paper:', paperError.message);
    const dbErr = new Error('Failed to retrieve question paper record.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!paper) {
    const notFoundErr = new Error('Question paper not found.');
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  // 2. Verify assignment to this coordinator
  const { data: assignment, error: assignError } = await supabase
    .from('question_paper_assignments')
    .select('id, delivery_status')
    .eq('question_paper_id', paperId)
    .eq('assigned_to_user_id', coordinatorId)
    .maybeSingle();

  if (assignError) {
    console.error('[ExamCoordinatorService] Error checking assignment:', assignError.message);
    const dbErr = new Error('Failed to verify paper authorization.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!assignment || paper.status === 'DRAFT') {
    await auditLogService.logAuditEvent({
      userId: coordinatorId,
      role: 'EXAM_COORDINATOR',
      action: 'UNAUTHORIZED_ACCESS',
      resourceType: 'QUESTION_PAPER',
      resourceId: paperId,
      outcome: 'DENIED',
      summary: `Unauthorized attempt by coordinator to download unassigned question paper ${paperId}`,
      metadata: { coordinatorId, paperId },
    });
    const forbiddenErr = new Error('Access forbidden. You are not authorized to download this question paper.');
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }

  // 3. Storage path security check: prevent directory traversal or foreign object access
  if (!paper.storage_path || paper.storage_path.includes('..') || !paper.storage_path.startsWith('question-papers/')) {
    const err = new Error('Invalid or corrupted storage path. Access forbidden.');
    err.statusCode = 403;
    throw err;
  }

  const bucketName = config.storageBucket || 'examguard-storage';

  // 4. Download encrypted ciphertext from private Supabase Storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(bucketName)
    .download(paper.storage_path);

  if (downloadError || !fileData) {
    console.error('[ExamCoordinatorService] Storage download failed:', downloadError?.message);
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

  // 5. VERIFY-BEFORE-DECRYPT (Module 7, 8, 9 & 11):
  // Check SHA-256 integrity and RSA-PSS digital signature BEFORE attempting key unwrapping or decryption.
  const { data: sigRecord, error: sigError } = await supabase
    .from('digital_signatures')
    .select('algorithm, file_hash, signature, public_key_reference')
    .eq('question_paper_id', paperId)
    .maybeSingle();

  if (sigError) {
    console.error('[ExamCoordinatorService] Error fetching digital signature:', sigError.message);
    const dbErr = new Error('Failed to retrieve question paper digital signature.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // 6. Fetch envelope encryption keys from paper_keys table
  const { data: keyRecord, error: keyError } = await supabase
    .from('paper_keys')
    .select('encrypted_aes_key, iv, auth_tag')
    .eq('question_paper_id', paperId)
    .maybeSingle();

  if (keyError) {
    console.error('[ExamCoordinatorService] Error fetching paper key:', keyError.message);
    const dbErr = new Error('Failed to retrieve question paper encryption keys.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  // 7. Enforce canonical Verify-Before-Decrypt pipeline via verificationService (Module 11)
  try {
    const decryptedBuffer = verificationService.verifyAndDecryptQuestionPaper({
      ciphertextBuffer: fileBuffer,
      sigRecord,
      keyRecord,
    });

    await auditLogService.logAuditEvent({
      userId: coordinatorId,
      role: 'EXAM_COORDINATOR',
      action: 'DOWNLOAD',
      resourceType: 'QUESTION_PAPER',
      resourceId: paperId,
      outcome: 'SUCCESS',
      summary: `Exam coordinator successfully decrypted and downloaded question paper ${paperId}`,
      metadata: { paperId, fileName: paper.file_name },
    });

    return {
      decryptedBuffer,
      fileName: paper.file_name,
      mimeType: 'application/pdf',
    };
  } catch (verifyErr) {
    await auditLogService.logAuditEvent({
      userId: coordinatorId,
      role: 'EXAM_COORDINATOR',
      action: 'SIGNATURE_VERIFIED',
      resourceType: 'QUESTION_PAPER',
      resourceId: paperId,
      outcome: 'FAILURE',
      summary: `Cryptographic verification failed during coordinator download of paper ${paperId}: ${verifyErr.message}`,
      metadata: { error: verifyErr.message, paperId },
    });
    throw verifyErr;
  }
}

/**
 * Verifies the digital signature and SHA-256 integrity of an encrypted question paper (Module 7, 9 & 11).
 * Evaluates RSA-PSS signature and SHA-256 hash over stored ciphertext without exposing secrets or decrypting.
 *
 * @param {string} paperId - UUID of question paper
 * @param {string} coordinatorId - UUID of authenticated Exam Coordinator
 * @returns {Promise<{ verified: boolean, algorithm: string, fileHash: string, storedHash: string, signedAt: string, tamperDetected: boolean }>}
 */
async function verifyQuestionPaperIntegrity(paperId, coordinatorId) {
  if (!paperId) {
    const err = new Error('Question paper ID is required.');
    err.statusCode = 400;
    throw err;
  }

  if (!coordinatorId) {
    const err = new Error('Coordinator ID is required.');
    err.statusCode = 400;
    throw err;
  }

  // 1. Fetch paper record
  const { data: paper, error: paperError } = await supabase
    .from('question_papers')
    .select('id, storage_path, status')
    .eq('id', paperId)
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

  // 2. Verify assignment to coordinator
  const { data: assignment, error: assignError } = await supabase
    .from('question_paper_assignments')
    .select('id')
    .eq('question_paper_id', paperId)
    .eq('assigned_to_user_id', coordinatorId)
    .maybeSingle();

  if (assignError) {
    const dbErr = new Error('Failed to verify paper authorization.');
    dbErr.statusCode = 500;
    throw dbErr;
  }

  if (!assignment || paper.status === 'DRAFT') {
    const forbiddenErr = new Error('Access forbidden. You are not authorized to verify this question paper.');
    forbiddenErr.statusCode = 403;
    throw forbiddenErr;
  }

  // 3. Storage path check
  if (!paper.storage_path || paper.storage_path.includes('..') || !paper.storage_path.startsWith('question-papers/')) {
    const err = new Error('Invalid or corrupted storage path. Access forbidden.');
    err.statusCode = 403;
    throw err;
  }

  const bucketName = config.storageBucket || 'examguard-storage';

  // 4. Fetch digital signature record
  const { data: sigRecord, error: sigError } = await supabase
    .from('digital_signatures')
    .select('algorithm, file_hash, signature, public_key_reference, created_at')
    .eq('question_paper_id', paperId)
    .maybeSingle();

  if (sigError) {
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

  // 5. Download encrypted ciphertext from private storage
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(bucketName)
    .download(paper.storage_path);

  if (downloadError || !fileData) {
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

  // 6. Evaluate SHA-256 integrity and RSA-PSS signature without decrypting (Module 11)
  const verificationResult = verificationService.verifyQuestionPaperIntegrityOnly({
    ciphertextBuffer: fileBuffer,
    sigRecord,
  });

  await auditLogService.logAuditEvent({
    userId: coordinatorId,
    role: 'EXAM_COORDINATOR',
    action: 'SIGNATURE_VERIFIED',
    resourceType: 'QUESTION_PAPER',
    resourceId: paperId,
    outcome: verificationResult.verified ? 'SUCCESS' : 'FAILURE',
    summary: verificationResult.verified
      ? `Exam coordinator verified signature and hash integrity for paper ${paperId}`
      : `Tamper detected or invalid signature for paper ${paperId}`,
    metadata: {
      verified: verificationResult.verified,
      tamperDetected: verificationResult.tamperDetected,
    },
  });

  return verificationResult;
}

module.exports = {
  getAvailableQuestionPapers,
  getQuestionPaperById,
  downloadAndDecryptQuestionPaper,
  verifyQuestionPaperIntegrity,
};

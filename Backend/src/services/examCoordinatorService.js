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
 * Supports searching, filtering, and pagination. Returns safe metadata only.
 *
 * @param {string} coordinatorId - UUID of authenticated Exam Coordinator
 * @param {Object} [options={}] - Query, filter, and pagination options
 * @returns {Promise<Array<Object>>} List of sanitized question paper objects (with .pagination metadata)
 */
async function getAvailableQuestionPapers(coordinatorId, options = {}) {
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
    const emptyResult = [];
    emptyResult.pagination = { total: 0, page: 1, limit: 10, totalPages: 1 };
    return emptyResult;
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

  // 3. Query recorded verification history from activity_logs for accurate verification status
  const verificationMap = new Map();
  try {
    const { data: verifLogs } = await supabase
      .from('activity_logs')
      .select('resource_id, details, created_at')
      .eq('action', 'SIGNATURE_VERIFIED')
      .in('resource_id', paperIds)
      .order('created_at', { ascending: false });

    if (verifLogs && Array.isArray(verifLogs)) {
      for (const log of verifLogs) {
        if (log.resource_id && !verificationMap.has(log.resource_id)) {
          const outcome = log.details?.outcome || (log.details?.metadata?.verified ? 'SUCCESS' : 'FAILURE');
          verificationMap.set(log.resource_id, {
            verified: outcome === 'SUCCESS',
            tamperDetected: outcome !== 'SUCCESS',
            verifiedAt: log.created_at,
            outcome,
          });
        }
      }
    }
  } catch (_) {
    // In-memory or fallback environments without activity_logs
  }

  const today = new Date().toISOString().split('T')[0];

  // 4. Format safe metadata - strictly omit storage_path and all cryptographic secrets
  const availablePapers = (papers || [])
    .filter((paper) => paper.status !== 'DRAFT')
    .map((paper) => {
      const assignment = assignmentMap.get(paper.id);
      const signature = Array.isArray(paper.digital_signatures)
        ? paper.digital_signatures[0]
        : paper.digital_signatures;

      const deliveryDate = assignment?.scheduled_delivery_date || paper.scheduled_delivery_date;
      const isDeliverable = !deliveryDate || today >= deliveryDate;
      const verif = verificationMap.get(paper.id) || null;
      const verificationStatus = verif ? (verif.verified ? 'VERIFIED' : 'FAILED') : 'PENDING';

      let effectiveStatus = 'SCHEDULED';
      if (paper.status === 'ARCHIVED') {
        effectiveStatus = 'ARCHIVED';
      } else if (assignment?.delivery_status === 'CANCELLED') {
        effectiveStatus = 'CANCELLED';
      } else if (isDeliverable) {
        effectiveStatus = 'AVAILABLE';
      } else {
        effectiveStatus = 'AWAITING_DELIVERY';
      }

      return {
        id: paper.id,
        title: paper.title,
        subject: paper.subject,
        semester: paper.semester,
        academicYear: paper.academic_year,
        examType: paper.exam_type,
        examDate: paper.exam_date,
        status: paper.status,
        effectiveStatus,
        isDeliverable,
        verificationStatus,
        lastVerification: verif,
        submittedAt: paper.submitted_at,
        scheduledDeliveryDate: deliveryDate,
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

  // 5. Apply filtering & search
  let filtered = availablePapers;
  const search = typeof options.search === 'string' ? options.search.trim().toLowerCase() : '';
  if (search) {
    filtered = filtered.filter((p) =>
      (p.title && p.title.toLowerCase().includes(search)) ||
      (p.subject && p.subject.toLowerCase().includes(search)) ||
      (p.examType && p.examType.toLowerCase().includes(search)) ||
      (p.semester && p.semester.toLowerCase().includes(search)) ||
      (p.academicYear && p.academicYear.toLowerCase().includes(search)) ||
      (p.teacher?.name && p.teacher.name.toLowerCase().includes(search))
    );
  }

  const status = typeof options.status === 'string' ? options.status.trim().toUpperCase() : 'ALL';
  if (status !== 'ALL') {
    if (status === 'AWAITING_DELIVERY' || status === 'SCHEDULED') {
      filtered = filtered.filter((p) => !p.isDeliverable && p.status !== 'ARCHIVED');
    } else if (status === 'AVAILABLE' || status === 'READY_FOR_ACCESS') {
      filtered = filtered.filter((p) => p.isDeliverable && p.verificationStatus !== 'FAILED' && p.status !== 'ARCHIVED');
    } else if (status === 'VERIFIED') {
      filtered = filtered.filter((p) => p.verificationStatus === 'VERIFIED');
    } else if (status === 'VERIFICATION_PENDING') {
      filtered = filtered.filter((p) => p.verificationStatus === 'PENDING');
    } else if (status === 'VERIFICATION_FAILED') {
      filtered = filtered.filter((p) => p.verificationStatus === 'FAILED');
    } else if (status === 'UNAVAILABLE' || status === 'EXPIRED') {
      filtered = filtered.filter((p) => p.status === 'ARCHIVED' || p.assignment?.deliveryStatus === 'CANCELLED');
    }
  }

  if (options.semester && typeof options.semester === 'string' && options.semester !== 'ALL') {
    filtered = filtered.filter((p) => p.semester && p.semester.toLowerCase().includes(options.semester.toLowerCase()));
  }

  // Sort by delivery date ascending (nearest first), then by submitted_at descending
  filtered.sort((a, b) => {
    const dateA = a.scheduledDeliveryDate || a.examDate || '';
    const dateB = b.scheduledDeliveryDate || b.examDate || '';
    return dateA.localeCompare(dateB);
  });

  const total = filtered.length;
  let pagedList = filtered;

  if (options.page) {
    const page = Math.max(1, parseInt(options.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(options.limit, 10) || 10));
    const offset = (page - 1) * limit;
    pagedList = filtered.slice(offset, offset + limit);
    pagedList.pagination = {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  } else {
    pagedList.pagination = {
      total,
      page: 1,
      limit: total,
      totalPages: 1,
    };
  }

  return pagedList;
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

  const today = new Date().toISOString().split('T')[0];
  const deliveryDate = assignment.scheduled_delivery_date || paper.scheduled_delivery_date;
  const isDeliverable = !deliveryDate || today >= deliveryDate;

  let lastVerification = null;
  try {
    const { data: verifLog } = await supabase
      .from('activity_logs')
      .select('details, created_at')
      .eq('action', 'SIGNATURE_VERIFIED')
      .eq('resource_id', paperId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (verifLog) {
      const outcome = verifLog.details?.outcome || (verifLog.details?.metadata?.verified ? 'SUCCESS' : 'FAILURE');
      lastVerification = {
        verified: outcome === 'SUCCESS',
        tamperDetected: outcome !== 'SUCCESS',
        verifiedAt: verifLog.created_at,
        outcome,
      };
    }
  } catch (_) {}

  const verificationStatus = lastVerification ? (lastVerification.verified ? 'VERIFIED' : 'FAILED') : 'PENDING';
  let effectiveStatus = 'SCHEDULED';
  if (paper.status === 'ARCHIVED') {
    effectiveStatus = 'ARCHIVED';
  } else if (assignment.delivery_status === 'CANCELLED') {
    effectiveStatus = 'CANCELLED';
  } else if (isDeliverable) {
    effectiveStatus = 'AVAILABLE';
  } else {
    effectiveStatus = 'AWAITING_DELIVERY';
  }

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
    effectiveStatus,
    isDeliverable,
    verificationStatus,
    lastVerification,
    submittedAt: paper.submitted_at,
    scheduledDeliveryDate: deliveryDate,
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

/**
 * Computes data-driven operational KPI statistics for the authenticated Exam Coordinator.
 *
 * @param {string} coordinatorId - UUID of authenticated Exam Coordinator
 * @returns {Promise<Object>} KPI statistics and operational metrics
 */
async function getDashboardStats(coordinatorId) {
  if (!coordinatorId) {
    const err = new Error('Coordinator ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const allPapers = await getAvailableQuestionPapers(coordinatorId);
  const totalAssigned = allPapers.length;

  const today = new Date().toISOString().split('T')[0];

  const readyForAccess = allPapers.filter(
    (p) => p.isDeliverable && p.status !== 'ARCHIVED' && p.assignment?.deliveryStatus !== 'CANCELLED' && p.verificationStatus !== 'FAILED'
  ).length;

  const awaitingDelivery = allPapers.filter(
    (p) => !p.isDeliverable && p.status !== 'ARCHIVED' && p.assignment?.deliveryStatus !== 'CANCELLED'
  ).length;

  // Upcoming deliveries sorted chronologically (earliest delivery date first)
  const upcomingList = allPapers
    .filter((p) => !p.isDeliverable && p.status !== 'ARCHIVED' && p.assignment?.deliveryStatus !== 'CANCELLED')
    .sort((a, b) => {
      const dateA = a.scheduledDeliveryDate || a.examDate || '';
      const dateB = b.scheduledDeliveryDate || b.examDate || '';
      return dateA.localeCompare(dateB);
    });

  const nextDelivery = upcomingList.length > 0
    ? {
        id: upcomingList[0].id,
        title: upcomingList[0].title,
        subject: upcomingList[0].subject,
        semester: upcomingList[0].semester,
        examDate: upcomingList[0].examDate,
        scheduledDeliveryDate: upcomingList[0].scheduledDeliveryDate,
        teacherName: upcomingList[0].teacher?.name,
      }
    : null;

  // Real integrity stats recorded in database activity logs
  const verifiedCount = allPapers.filter((p) => p.verificationStatus === 'VERIFIED').length;
  const failedCount = allPapers.filter((p) => p.verificationStatus === 'FAILED').length;
  const pendingCount = allPapers.filter((p) => p.verificationStatus === 'PENDING').length;

  // Workflow status distribution
  const statusCounts = {
    submitted: allPapers.filter((p) => p.status === 'SUBMITTED').length,
    scheduled: awaitingDelivery,
    available: readyForAccess,
    archived: allPapers.filter((p) => p.status === 'ARCHIVED').length,
  };

  return {
    totalAssigned,
    readyForAccess,
    awaitingDelivery,
    upcomingDeliveriesCount: upcomingList.length,
    nextDelivery,
    integrityStats: {
      verified: verifiedCount,
      pending: pendingCount,
      failed: failedCount,
      total: totalAssigned,
      verifiedRatePercent: totalAssigned > 0 ? Math.round((verifiedCount / totalAssigned) * 100) : 0,
    },
    statusCounts,
  };
}

/**
 * Retrieves recent coordinator security and examination activity from activity_logs.
 *
 * @param {string} coordinatorId - UUID of authenticated Exam Coordinator
 * @param {number} [limit=15] - Maximum events to retrieve
 * @returns {Promise<Array<Object>>} Sanitized audit activity events
 */
async function getRecentActivity(coordinatorId, limit = 15) {
  if (!coordinatorId) {
    const err = new Error('Coordinator ID is required.');
    err.statusCode = 400;
    throw err;
  }

  const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 15));

  const allPapers = await getAvailableQuestionPapers(coordinatorId);
  const paperIds = allPapers.map((p) => p.id);

  try {
    let query = supabase
      .from('activity_logs')
      .select('id, action, resource_type, resource_id, details, created_at')
      .order('created_at', { ascending: false })
      .limit(safeLimit);

    if (paperIds.length > 0) {
      query = query.or(`user_id.eq.${coordinatorId},resource_id.in.(${paperIds.join(',')})`);
    } else {
      query = query.eq('user_id', coordinatorId);
    }

    const { data: logs, error } = await query;
    if (error) {
      console.warn('[ExamCoordinatorService] Warning fetching recent activity:', error.message);
      return [];
    }

    const paperMap = new Map();
    for (const p of allPapers) {
      paperMap.set(p.id, p);
    }

    return (logs || []).map((item) => {
      const associatedPaper = item.resource_id ? paperMap.get(item.resource_id) : null;
      return {
        id: item.id,
        action: item.action,
        resourceType: item.resource_type,
        resourceId: item.resource_id,
        paperTitle: associatedPaper ? associatedPaper.title : null,
        subject: associatedPaper ? associatedPaper.subject : null,
        outcome: item.details?.outcome || 'SUCCESS',
        summary: item.details?.summary || `Action ${item.action} recorded`,
        createdAt: item.created_at,
      };
    });
  } catch (err) {
    console.warn('[ExamCoordinatorService] Fallback handling recent activity error:', err.message);
    return [];
  }
}

module.exports = {
  getAvailableQuestionPapers,
  getQuestionPaperById,
  downloadAndDecryptQuestionPaper,
  verifyQuestionPaperIntegrity,
  getDashboardStats,
  getRecentActivity,
};

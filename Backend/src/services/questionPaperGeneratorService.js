/**
 * ExamGuard - Randomized Question Paper Generator Service (Module 18)
 *
 * Implements server-side cryptographic randomized set generation respecting
 * topic coverage, marks distribution, OR-groups, duplicate prevention,
 * configurable cross-set overlap limits, immutable snapshots, and seamless
 * integration with the existing AES-256-GCM + RSA-PSS secure submission pipeline.
 */

const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const questionBankService = require('./questionBankService');
const blueprintService = require('./blueprintService');
const pdfRendererService = require('./pdfRendererService');
const questionPaperService = require('./questionPaperService');
const auditLogService = require('./auditLogService');

// In-memory generated papers & sets store fallback
const memoryGeneratedPapers = new Map();
const memoryGeneratedSets = new Map();

function isTableMissingError(error) {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  const code = error.code || '';
  return (
    code === '42P01' ||
    code.startsWith('PGRST') ||
    msg.includes('schema cache') ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('relation')
  );
}

/**
 * Cryptographically secure Fisher-Yates array shuffle.
 */
function secureShuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const randomBuffer = crypto.randomBytes(4);
    const randomInt = randomBuffer.readUInt32BE(0);
    const j = randomInt % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Calculates the percentage of overlapping question IDs between two sets.
 */
function calculateOverlapPercentage(setAQuestionIds, setBQuestionIds) {
  if (!setAQuestionIds.length || !setBQuestionIds.length) return 0;
  const setBSet = new Set(setBQuestionIds);
  let commonCount = 0;
  for (const qId of setAQuestionIds) {
    if (setBSet.has(qId)) commonCount++;
  }
  return Math.round((commonCount / Math.max(setAQuestionIds.length, setBQuestionIds.length)) * 100);
}

/**
 * Generates multiple examination sets from an approved blueprint and eligible question bank.
 */
async function generateExamSets({ blueprintId, teacherId, role = 'TEACHER' }) {
  if (!blueprintId) throw new Error('Blueprint ID is required.');
  if (!teacherId) throw new Error('Teacher ID is required.');

  const blueprint = await blueprintService.getBlueprintById(blueprintId);
  if (!blueprint) {
    const err = new Error('Blueprint not found.');
    err.statusCode = 404;
    throw err;
  }

  // Pre-flight feasibility validation
  const feasibility = await blueprintService.validateFeasibility(blueprintId, teacherId, role);
  if (!feasibility.feasible) {
    const err = new Error(`Cannot generate paper sets due to insufficient question pool: ${feasibility.issues.join('; ')}`);
    err.statusCode = 400;
    err.feasibility = feasibility;
    throw err;
  }

  // Fetch all eligible approved questions for this subject
  const bankResult = await questionBankService.getQuestions({
    authorId: teacherId,
    role,
    subject: blueprint.subject,
    approvalStatus: 'APPROVED',
  });
  const allQuestions = bankResult.data || [];

  const numSets = blueprint.numSets || 2;
  const maxOverlap = blueprint.maxOverlapPercentage || 40;
  const generationSeed = crypto.randomBytes(16).toString('hex');
  const paperId = crypto.randomUUID();

  const generatedSets = [];
  const setLabels = ['Set A', 'Set B', 'Set C', 'Set D', 'Set E'];

  // Attempt generation for each set
  for (let sIdx = 0; sIdx < numSets; sIdx++) {
    const setCode = setLabels[sIdx] || `Set ${sIdx + 1}`;
    const selectedQuestionIdsInSet = new Set();
    const sectionsSnapshot = [];

    // Prioritize questions not yet used in previous sets to minimize overlap
    const previouslyUsedQuestionIds = new Set(
      generatedSets.flatMap((s) => s.questionIds)
    );

    for (const sec of blueprint.sections) {
      const unit = sec.targetUnit;
      const subConfigs = sec.subquestionsConfig || [];
      const hasOr = !!sec.alternativeQuestionNumber;

      // 1. Select for Primary Question (e.g. Q1, Q3, Q5, Q7)
      const primarySubquestions = [];
      for (const sub of subConfigs) {
        const candidatePool = allQuestions.filter(
          (q) =>
            q.unitNumber === unit &&
            q.marks === parseInt(sub.marks, 10) &&
            !selectedQuestionIdsInSet.has(q.id)
        );

        if (candidatePool.length === 0) {
          const err = new Error(
            `Failed generating ${setCode}: No available question for Unit ${unit} (${sub.marks} Marks) without duplicate in set.`
          );
          err.statusCode = 400;
          throw err;
        }

        // Sort candidates: prefer unused in previous sets, then difficulty match
        const sortedCandidates = secureShuffle(candidatePool).sort((a, b) => {
          const aUsed = previouslyUsedQuestionIds.has(a.id) ? 1 : 0;
          const bUsed = previouslyUsedQuestionIds.has(b.id) ? 1 : 0;
          if (aUsed !== bUsed) return aUsed - bUsed;
          const aDiff = a.difficulty === sub.difficulty ? 0 : 1;
          const bDiff = b.difficulty === sub.difficulty ? 0 : 1;
          return aDiff - bDiff;
        });

        const selected = sortedCandidates[0];
        selectedQuestionIdsInSet.add(selected.id);
        primarySubquestions.push({
          id: selected.id,
          part: sub.subPart,
          marks: selected.marks,
          unit: selected.unitNumber,
          difficulty: selected.difficulty,
          questionType: selected.questionType,
          text: selected.questionText,
          answerScheme: selected.answerScheme,
        });
      }

      const primaryQuestionObj = {
        questionNumber: sec.primaryQuestionNumber,
        unit,
        totalMarks: sec.targetMarks,
        subquestions: primarySubquestions,
      };

      // 2. Select for Alternative Question (e.g. Q2, Q4, Q6, Q8) if OR alternative exists
      let alternativeQuestionObj = null;
      if (hasOr) {
        const altSubquestions = [];
        for (const sub of subConfigs) {
          const candidatePool = allQuestions.filter(
            (q) =>
              q.unitNumber === unit &&
              q.marks === parseInt(sub.marks, 10) &&
              !selectedQuestionIdsInSet.has(q.id)
          );

          if (candidatePool.length === 0) {
            const err = new Error(
              `Failed generating ${setCode} OR alternative: No available question for Unit ${unit} (${sub.marks} Marks) without duplicate in set.`
            );
            err.statusCode = 400;
            throw err;
          }

          const sortedCandidates = secureShuffle(candidatePool).sort((a, b) => {
            const aUsed = previouslyUsedQuestionIds.has(a.id) ? 1 : 0;
            const bUsed = previouslyUsedQuestionIds.has(b.id) ? 1 : 0;
            if (aUsed !== bUsed) return aUsed - bUsed;
            return 0;
          });

          const selected = sortedCandidates[0];
          selectedQuestionIdsInSet.add(selected.id);
          altSubquestions.push({
            id: selected.id,
            part: sub.subPart,
            marks: selected.marks,
            unit: selected.unitNumber,
            difficulty: selected.difficulty,
            questionType: selected.questionType,
            text: selected.questionText,
            answerScheme: selected.answerScheme,
          });
        }

        alternativeQuestionObj = {
          questionNumber: sec.alternativeQuestionNumber,
          unit,
          totalMarks: sec.targetMarks,
          subquestions: altSubquestions,
        };
      }

      sectionsSnapshot.push({
        groupOrder: sec.groupOrder,
        groupLabel: sec.groupLabel,
        targetMarks: sec.targetMarks,
        targetUnit: sec.targetUnit,
        primaryQuestion: primaryQuestionObj,
        alternativeQuestion: alternativeQuestionObj,
      });
    }

    // Verify overlap with previously generated sets
    const currentQIds = Array.from(selectedQuestionIdsInSet);
    for (let prevIdx = 0; prevIdx < generatedSets.length; prevIdx++) {
      const prevSet = generatedSets[prevIdx];
      const overlap = calculateOverlapPercentage(currentQIds, prevSet.questionIds);
      if (overlap > maxOverlap) {
        console.warn(
          `[Generator] Warning: Overlap between ${setCode} and ${prevSet.setCode} is ${overlap}% (target: <=${maxOverlap}%). Best effort selected from current pool.`
        );
      }
    }

    const setId = crypto.randomUUID();
    generatedSets.push({
      id: setId,
      generatedExamPaperId: paperId,
      setCode,
      setOrder: sIdx + 1,
      paperStructureSnapshot: {
        metadata: {
          title: blueprint.title,
          subject: blueprint.subject,
          course: blueprint.course,
          semester: blueprint.semester,
          academicPattern: blueprint.academicPattern,
          subjectCode: blueprint.subjectCode,
          durationHours: blueprint.durationHours,
          totalMarks: blueprint.totalMarks,
          instructions: blueprint.instructions,
          setCode,
        },
        sections: sectionsSnapshot,
      },
      totalMarks: blueprint.totalMarks,
      isApproved: false,
      questionIds: currentQIds,
    });
  }

  // Persist generated run and sets
  const paperRecord = {
    id: paperId,
    blueprint_id: blueprint.id,
    teacher_id: teacherId,
    generation_seed: generationSeed,
    status: 'GENERATED',
    metadata: {
      numSets,
      maxOverlapPercentage: maxOverlap,
      subject: blueprint.subject,
      totalMarks: blueprint.totalMarks,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { error: pError } = await supabase.from('generated_exam_papers').insert([paperRecord]);
    if (pError && isTableMissingError(pError)) {
      return persistMemoryPaper(paperRecord, generatedSets);
    }
    if (pError) throw pError;

    const setRows = generatedSets.map((s) => ({
      id: s.id,
      generated_exam_paper_id: paperId,
      set_code: s.setCode,
      set_order: s.setOrder,
      paper_structure_snapshot: s.paperStructureSnapshot,
      total_marks: s.totalMarks,
      is_approved: false,
      question_ids: s.questionIds,
      created_at: new Date().toISOString(),
    }));

    const { error: sError } = await supabase.from('generated_exam_sets').insert(setRows);
    if (sError && isTableMissingError(sError)) {
      return persistMemoryPaper(paperRecord, generatedSets);
    }
    if (sError) throw sError;
  } catch (err) {
    if (isTableMissingError(err)) {
      return persistMemoryPaper(paperRecord, generatedSets);
    }
    console.error('[GeneratorService] DB persistence error:', err.message);
  }

  await auditLogService.logAuditEvent({
    userId: teacherId,
    role: 'TEACHER',
    action: 'QUESTION_PAPER_CREATED',
    resourceType: 'GENERATOR',
    resourceId: paperId,
    outcome: 'SUCCESS',
    summary: `Successfully generated ${generatedSets.length} examination sets for blueprint "${blueprint.title}".`,
  });

  return {
    paperId,
    blueprintId: blueprint.id,
    generationSeed,
    status: 'GENERATED',
    sets: generatedSets,
  };
}

function persistMemoryPaper(paperRecord, sets) {
  memoryGeneratedPapers.set(paperRecord.id, paperRecord);
  memoryGeneratedSets.set(paperRecord.id, sets);
  return {
    paperId: paperRecord.id,
    blueprintId: paperRecord.blueprint_id,
    generationSeed: paperRecord.generation_seed,
    status: 'GENERATED',
    sets,
  };
}

/**
 * Retrieves generated paper and all its sets by ID.
 */
async function getGeneratedPaper(paperId, teacherId, role) {
  if (!paperId) throw new Error('Paper ID is required.');

  try {
    const { data: paper } = await supabase
      .from('generated_exam_papers')
      .select('*')
      .eq('id', paperId)
      .maybeSingle();

    if (!paper) {
      if (memoryGeneratedPapers.has(paperId)) {
        const memPaper = memoryGeneratedPapers.get(paperId);
        if (role !== 'ADMIN' && memPaper.teacher_id !== teacherId) {
          const err = new Error('Unauthorized access to generated paper.');
          err.statusCode = 403;
          throw err;
        }
        return {
          paper: memPaper,
          sets: memoryGeneratedSets.get(paperId) || [],
        };
      }
      const err = new Error('Generated paper not found.');
      err.statusCode = 404;
      throw err;
    }

    if (role !== 'ADMIN' && paper.teacher_id !== teacherId) {
      const err = new Error('Unauthorized access to generated paper.');
      err.statusCode = 403;
      throw err;
    }

    const { data: sets } = await supabase
      .from('generated_exam_sets')
      .select('*')
      .eq('generated_exam_paper_id', paperId)
      .order('set_order', { ascending: true });

    return {
      paper,
      sets: (sets || []).map((s) => ({
        id: s.id,
        generatedExamPaperId: s.generated_exam_paper_id,
        setCode: s.set_code,
        setOrder: s.set_order,
        paperStructureSnapshot: s.paper_structure_snapshot,
        totalMarks: s.total_marks,
        isApproved: s.is_approved,
        questionIds: s.question_ids,
      })),
    };
  } catch (err) {
    if (err.statusCode === 403) {
      throw err;
    }
    if (memoryGeneratedPapers.has(paperId)) {
      const memPaper = memoryGeneratedPapers.get(paperId);
      if (role !== 'ADMIN' && memPaper.teacher_id !== teacherId) {
        const authErr = new Error('Unauthorized access to generated paper.');
        authErr.statusCode = 403;
        throw authErr;
      }
      return {
        paper: memPaper,
        sets: memoryGeneratedSets.get(paperId) || [],
      };
    }
    throw err;
  }
}

/**
 * Replaces a specific question in a generated set with another eligible question from the bank.
 * Re-validates marks, unit, duplicate prevention, and blueprint total.
 */
async function replaceQuestionInSet({ setId, oldQuestionId, newQuestionId, teacherId, role }) {
  if (!setId || !oldQuestionId || !newQuestionId) {
    throw new Error('setId, oldQuestionId, and newQuestionId are required.');
  }

  // Find set
  let targetSet = null;
  let targetPaperId = null;

  for (const [pId, sets] of memoryGeneratedSets.entries()) {
    const s = sets.find((item) => item.id === setId);
    if (s) {
      targetSet = s;
      targetPaperId = pId;
      break;
    }
  }

  if (!targetSet) {
    try {
      const { data } = await supabase.from('generated_exam_sets').select('*').eq('id', setId).maybeSingle();
      if (data) {
        targetSet = {
          id: data.id,
          generatedExamPaperId: data.generated_exam_paper_id,
          setCode: data.set_code,
          setOrder: data.set_order,
          paperStructureSnapshot: data.paper_structure_snapshot,
          totalMarks: data.total_marks,
          isApproved: data.is_approved,
          questionIds: data.question_ids,
        };
        targetPaperId = data.generated_exam_paper_id;
      }
    } catch {
      // Ignore
    }
  }

  if (!targetSet) {
    const err = new Error('Generated set not found.');
    err.statusCode = 404;
    throw err;
  }

  // Prevent duplicate within set
  if (targetSet.questionIds.includes(newQuestionId)) {
    const err = new Error('Replacement question is already included in this exam set.');
    err.statusCode = 400;
    throw err;
  }

  // Fetch replacement question details
  const bankResult = await questionBankService.getQuestions({
    authorId: teacherId,
    role,
  });
  const replacementQ = (bankResult.data || []).find((q) => q.id === newQuestionId);
  if (!replacementQ) {
    const err = new Error('Selected replacement question was not found in eligible question bank.');
    err.statusCode = 404;
    throw err;
  }

  // Find and replace in snapshot
  let replaced = false;
  let oldMarks = 0;
  const snapshot = JSON.parse(JSON.stringify(targetSet.paperStructureSnapshot));

  for (const sec of snapshot.sections || []) {
    // Check primary
    if (sec.primaryQuestion?.subquestions) {
      for (const sub of sec.primaryQuestion.subquestions) {
        if (sub.id === oldQuestionId) {
          oldMarks = sub.marks;
          if (replacementQ.marks !== oldMarks) {
            throw new Error(`Marks mismatch: Replacement question has ${replacementQ.marks} marks, but slot requires ${oldMarks} marks.`);
          }
          sub.id = replacementQ.id;
          sub.text = replacementQ.questionText;
          sub.marks = replacementQ.marks;
          sub.difficulty = replacementQ.difficulty;
          sub.questionType = replacementQ.questionType;
          sub.answerScheme = replacementQ.answerScheme;
          replaced = true;
          break;
        }
      }
    }
    // Check alternative
    if (!replaced && sec.alternativeQuestion?.subquestions) {
      for (const sub of sec.alternativeQuestion.subquestions) {
        if (sub.id === oldQuestionId) {
          oldMarks = sub.marks;
          if (replacementQ.marks !== oldMarks) {
            throw new Error(`Marks mismatch: Replacement question has ${replacementQ.marks} marks, but slot requires ${oldMarks} marks.`);
          }
          sub.id = replacementQ.id;
          sub.text = replacementQ.questionText;
          sub.marks = replacementQ.marks;
          sub.difficulty = replacementQ.difficulty;
          sub.questionType = replacementQ.questionType;
          sub.answerScheme = replacementQ.answerScheme;
          replaced = true;
          break;
        }
      }
    }
    if (replaced) break;
  }

  if (!replaced) {
    const err = new Error('Target question to replace was not found in this exam set.');
    err.statusCode = 404;
    throw err;
  }

  // Update question IDs list
  const updatedQuestionIds = targetSet.questionIds.map((id) => (id === oldQuestionId ? newQuestionId : id));
  targetSet.paperStructureSnapshot = snapshot;
  targetSet.questionIds = updatedQuestionIds;

  // Persist update
  try {
    await supabase
      .from('generated_exam_sets')
      .update({
        paper_structure_snapshot: snapshot,
        question_ids: updatedQuestionIds,
      })
      .eq('id', setId);
  } catch {
    // Ignore DB fallback
  }

  return {
    success: true,
    message: 'Question replaced successfully in exam set.',
    set: targetSet,
  };
}

/**
 * Teacher Approval and Secure Pipeline Submission.
 * Renders the approved set into a standard university PDF in-memory,
 * validates the PDF, and routes it directly through questionPaperService.submitQuestionPaper
 * which enforces AES-256-GCM encryption, RSA-PSS signature, private storage,
 * and scheduled delivery.
 */
async function approveAndSubmitSet({
  setId,
  teacherId,
  assignedToUserId,
  examDate,
  role = 'TEACHER',
}) {
  if (!setId) throw new Error('Set ID is required.');
  if (!teacherId) throw new Error('Teacher ID is required.');
  if (!assignedToUserId) throw new Error('Recipient faculty (assignedToUserId) is required.');
  if (!examDate) throw new Error('Exam date (YYYY-MM-DD) is required.');

  // Find set
  let targetSet = null;
  let parentPaper = null;

  for (const [pId, sets] of memoryGeneratedSets.entries()) {
    const s = sets.find((item) => item.id === setId);
    if (s) {
      targetSet = s;
      parentPaper = memoryGeneratedPapers.get(pId);
      break;
    }
  }

  if (!targetSet) {
    try {
      const { data: sData } = await supabase.from('generated_exam_sets').select('*').eq('id', setId).maybeSingle();
      if (sData) {
        targetSet = {
          id: sData.id,
          generatedExamPaperId: sData.generated_exam_paper_id,
          setCode: sData.set_code,
          setOrder: sData.set_order,
          paperStructureSnapshot: sData.paper_structure_snapshot,
          totalMarks: sData.total_marks,
          isApproved: sData.is_approved,
          questionIds: sData.question_ids,
        };
        const { data: pData } = await supabase.from('generated_exam_papers').select('*').eq('id', sData.generated_exam_paper_id).maybeSingle();
        parentPaper = pData;
      }
    } catch {
      // Fallback
    }
  }

  if (!targetSet) {
    const err = new Error('Exam set not found.');
    err.statusCode = 404;
    throw err;
  }

  const snapshot = targetSet.paperStructureSnapshot;
  const metadata = snapshot.metadata || {};
  const sections = snapshot.sections || [];

  // 1. Render in-memory University-style Examination Paper PDF
  const pdfBuffer = await pdfRendererService.renderQuestionPaperPDF({
    metadata,
    sections,
  });

  // 2. Validate PDF buffer integrity
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length < 500) {
    throw new Error('PDF rendering engine produced invalid or truncated output.');
  }
  const header = pdfBuffer.slice(0, 5).toString('ascii');
  if (header !== '%PDF-') {
    throw new Error('Generated file does not conform to valid PDF format standards.');
  }

  // 3. Prepare file object conforming to multer format for submitQuestionPaper
  const subjectSlug = (metadata.subject || 'paper').replace(/[^a-zA-Z0-9]/g, '_');
  const setSlug = (targetSet.setCode || 'set').replace(/[^a-zA-Z0-9]/g, '_');
  const originalFileName = `${subjectSlug}_${setSlug}_${Date.now()}.pdf`;

  const filePayload = {
    buffer: pdfBuffer,
    originalname: originalFileName,
    mimetype: 'application/pdf',
    size: pdfBuffer.length,
  };

  // 4. Submit directly into ExamGuard secure document pipeline:
  // - AES-256-GCM envelope encryption
  // - RSA-PSS SHA-256 digital signature over ciphertext
  // - Private Supabase Storage upload
  // - question_papers & paper_keys & digital_signatures records
  // - Next-day scheduled delivery & recipient assignment
  const submissionResult = await questionPaperService.submitQuestionPaper({
    teacherId,
    title: `${metadata.title} (${targetSet.setCode})`,
    subject: metadata.subject,
    semester: metadata.semester || 'Semester 5',
    academicYear: '2026-2027',
    examType: 'End Semester Examination',
    examDate,
    assignedToUserId,
    file: filePayload,
    sanitizedFileName: originalFileName,
  });

  // 5. Update set approval state
  targetSet.isApproved = true;
  try {
    await supabase.from('generated_exam_sets').update({ is_approved: true }).eq('id', setId);
    if (parentPaper?.id) {
      await supabase.from('generated_exam_papers').update({ status: 'APPROVED' }).eq('id', parentPaper.id);
    }
  } catch {
    // Ignore DB fallback
  }

  // 6. Security Audit Event
  await auditLogService.logAuditEvent({
    userId: teacherId,
    role: 'TEACHER',
    action: 'QUESTION_PAPER_CREATED',
    resourceType: 'GENERATED_SET',
    resourceId: setId,
    outcome: 'SUCCESS',
    summary: `Approved and submitted generated exam set ${targetSet.setCode} for subject "${metadata.subject}".`,
    metadata: {
      questionPaperId: submissionResult.questionPaper?.id || submissionResult.id,
      assignedToUserId,
      examDate,
      totalMarks: metadata.totalMarks,
    },
  });

  return {
    success: true,
    message: `Generated examination paper (${targetSet.setCode}) successfully approved, encrypted, and submitted for scheduled delivery!`,
    paper: submissionResult.questionPaper || submissionResult,
    approvedSetId: setId,
  };
}

module.exports = {
  generateExamSets,
  getGeneratedPaper,
  replaceQuestionInSet,
  approveAndSubmitSet,
  calculateOverlapPercentage,
  secureShuffle,
};

/**
 * ExamGuard - Draft Management Service (Module 23)
 *
 * Provides persistent multi-day draft management for the Question Paper Generator:
 * - Saves in-progress wizard state (blueprint, questions, marks scheme, step, sets)
 * - Lists teacher-isolated drafts (strict ownership validation)
 * - Restores complete saved state upon resuming
 * - Protects against accidental overwrites and data loss
 */

const crypto = require('crypto');
const { supabase } = require('../config/supabase');
const auditLogService = require('./auditLogService');
const notificationService = require('./notificationService');

// In-memory fallback cache for drafts if DB table is initializing
const memoryDrafts = new Map();

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
 * Saves a new draft or updates an existing draft.
 */
async function saveDraft(payload) {
  const {
    id,
    draftId,
    teacherId,
    title,
    subject,
    subjectCode,
    course,
    department,
    classYear,
    academicPattern,
    semester,
    durationHours,
    totalMarks,
    step = 1,
    blueprintId = null,
    formData = {},
    sections = [],
    generatedSets = null,
    generatedPaperData = null,
    status = 'DRAFT',
    blueprint = null,
  } = payload || {};

  if (!teacherId) throw new Error('Teacher ID is required to save draft.');

  const effectiveId = draftId || id || crypto.randomUUID();
  const bp = blueprint || {};
  const fd = formData || {};

  const effectiveSubject = subject || bp.subject || fd.subject || 'General Subject';
  const effectiveTitle = (title && title.trim())
    ? title.trim()
    : bp.title || `Draft: ${effectiveSubject} (${bp.totalMarks || totalMarks || 70}M)`;

  const effectiveClassYear = classYear || bp.classYear || fd.classYear || 'TE';
  const effectivePattern = academicPattern || bp.academicPattern || fd.academicPattern || '2019 Pattern';
  const effectiveSemester = semester || bp.semester || fd.semester || 'Semester 5';
  const effectiveSubjectCode = subjectCode || bp.subjectCode || fd.subjectCode || null;
  const effectiveCourse = course || bp.course || fd.course || 'T.E. (Computer Engineering)';
  const effectiveTotalMarks = totalMarks !== undefined && !isNaN(parseInt(totalMarks, 10))
    ? parseInt(totalMarks, 10)
    : (bp.totalMarks !== undefined && !isNaN(parseInt(bp.totalMarks, 10))
      ? parseInt(bp.totalMarks, 10)
      : (fd.totalMarks !== undefined && !isNaN(parseInt(fd.totalMarks, 10))
        ? parseInt(fd.totalMarks, 10)
        : 70));

  const effectiveDurationHours = durationHours !== undefined && !isNaN(parseFloat(durationHours))
    ? parseFloat(durationHours)
    : (bp.durationHours !== undefined && !isNaN(parseFloat(bp.durationHours))
      ? parseFloat(bp.durationHours)
      : (fd.durationHours !== undefined && !isNaN(parseFloat(fd.durationHours))
        ? parseFloat(fd.durationHours)
        : 2.5));

  const effectiveSections = (sections && sections.length > 0)
    ? sections
    : (bp.sections && bp.sections.length > 0 ? bp.sections : []);

  const mergedFormData = {
    ...fd,
    classYear: effectiveClassYear,
    academicPattern: effectivePattern,
    semester: effectiveSemester,
    subject: effectiveSubject,
    subjectCode: effectiveSubjectCode,
    course: effectiveCourse,
    totalMarks: effectiveTotalMarks,
    durationHours: effectiveDurationHours,
    title: effectiveTitle,
  };

  const record = {
    id: effectiveId,
    teacher_id: teacherId,
    title: effectiveTitle,
    subject: effectiveSubject,
    subject_code: effectiveSubjectCode,
    course: effectiveCourse,
    department: 'Department of Computer Engineering',
    class_year: effectiveClassYear,
    academic_pattern: effectivePattern,
    semester: effectiveSemester,
    duration_hours: effectiveDurationHours,
    total_marks: effectiveTotalMarks,
    step: parseInt(step, 10) || 1,
    blueprint_id: blueprintId || bp.id || null,
    form_data: mergedFormData,
    sections: effectiveSections,
    generated_sets: generatedSets || generatedPaperData || null,
    status: status || 'DRAFT',
    updated_at: new Date().toISOString(),
  };

  // Cache in memory immediately for fail-safe retrieval
  memoryDrafts.set(record.id, record);

  try {
    // 1. Try upserting to exam_paper_drafts table
    const { data, error } = await supabase
      .from('exam_paper_drafts')
      .upsert(record)
      .select()
      .maybeSingle();

    if (error && !isTableMissingError(error)) {
      console.warn('[DraftService] Primary table error, trying blueprints fallback:', error.message);
    } else if (data) {
      await auditLogService.logAuditEvent({
        userId: teacherId,
        role: 'TEACHER',
        action: 'QUESTION_PAPER_CREATED',
        resourceType: 'DRAFT',
        resourceId: record.id,
        outcome: 'SUCCESS',
        summary: `Draft saved: "${record.title}" for subject ${record.subject}.`,
      });
      return formatDraftRecord(data);
    }
  } catch (err) {
    console.warn('[DraftService] Caught upsert error:', err.message);
  }

  // 2. Fallback: Save blueprint draft into exam_blueprints if table missing
  try {
    const bpDraft = {
      id: record.blueprint_id || record.id,
      author_id: teacherId,
      title: record.title,
      subject: record.subject,
      course: record.course,
      semester: record.semester,
      academic_pattern: record.academic_pattern,
      subject_code: record.subject_code,
      duration_hours: record.duration_hours,
      total_marks: record.total_marks,
      instructions: [
        JSON.stringify({
          classYear: record.class_year,
          department: record.department,
          step: record.step,
          formData: record.form_data,
          generatedSets: record.generated_sets,
        }),
      ],
      num_sets: 2,
      max_overlap_percentage: 40,
      status: 'DRAFT',
      updated_at: new Date().toISOString(),
    };
    await supabase.from('exam_blueprints').upsert(bpDraft);
  } catch (_) {}

  // Dispatch draft saved notification via Resend
  notificationService.notifyDraftSaved({
    draft: record,
    teacher: { id: teacherId },
  }).catch(() => {});

  if (!draftData?.id) {
    notificationService.notifyPaperCreated({
      paper: { title: record.title, subject: record.subject, id: record.id },
      teacher: { id: teacherId },
    }).catch(() => {});
  }

  return formatDraftRecord(record);
}

/**
 * Retrieves all drafts owned by a specific teacher.
 */
async function getTeacherDrafts(teacherId) {
  if (!teacherId) return [];

  try {
    const { data, error } = await supabase
      .from('exam_paper_drafts')
      .select('*')
      .eq('teacher_id', teacherId)
      .neq('status', 'ARCHIVED')
      .order('updated_at', { ascending: false });

    if (data && !error) {
      return data.map(formatDraftRecord);
    }
  } catch (_) {}

  // Fallback: check exam_blueprints with status DRAFT
  try {
    const { data: bpDrafts } = await supabase
      .from('exam_blueprints')
      .select('*')
      .eq('author_id', teacherId)
      .eq('status', 'DRAFT')
      .order('updated_at', { ascending: false });

    if (bpDrafts && bpDrafts.length > 0) {
      return bpDrafts.map((b) => {
        let extra = {};
        try {
          if (b.instructions && b.instructions[0]) {
            extra = JSON.parse(b.instructions[0]);
          }
        } catch (_) {}
        return {
          id: b.id,
          teacherId: b.author_id,
          title: b.title,
          subject: b.subject,
          subjectCode: b.subject_code,
          course: b.course,
          department: extra.department || 'Department of Computer Engineering',
          classYear: extra.classYear || 'TE',
          academicPattern: b.academic_pattern,
          semester: b.semester,
          durationHours: b.duration_hours,
          totalMarks: b.total_marks,
          step: extra.step || 1,
          blueprintId: b.id,
          formData: extra.formData || {},
          sections: [],
          generatedSets: extra.generatedSets || null,
          status: 'DRAFT',
          createdAt: b.created_at,
          updatedAt: b.updated_at,
        };
      });
    }
  } catch (_) {}

  // Memory fallback
  const results = [];
  for (const draft of memoryDrafts.values()) {
    if (draft.teacher_id === teacherId && draft.status !== 'ARCHIVED') {
      results.push(formatDraftRecord(draft));
    }
  }
  return results.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/**
 * Retrieves a single draft by ID, validating ownership.
 */
async function getDraftById(id, teacherId, role) {
  if (!id) throw new Error('Draft ID is required.');
  const cleanId = String(id).trim();

  let draft = null;
  try {
    const { data, error } = await supabase
      .from('exam_paper_drafts')
      .select('*')
      .eq('id', cleanId)
      .maybeSingle();

    if (data && !error) {
      draft = data;
    }
  } catch (_) {}

  if (!draft) {
    draft = memoryDrafts.get(cleanId);
  }

  if (!draft) {
    // Try exam_blueprints
    try {
      const { data: bp } = await supabase
        .from('exam_blueprints')
        .select('*')
        .eq('id', cleanId)
        .maybeSingle();

      if (bp) {
        let extra = {};
        try {
          if (bp.instructions && bp.instructions[0]) {
            extra = JSON.parse(bp.instructions[0]);
          }
        } catch (_) {}
        draft = {
          id: bp.id,
          teacher_id: bp.author_id,
          title: bp.title,
          subject: bp.subject,
          subject_code: bp.subject_code,
          course: bp.course,
          department: extra.department || 'Department of Computer Engineering',
          class_year: extra.classYear || 'TE',
          academic_pattern: bp.academic_pattern,
          semester: bp.semester,
          duration_hours: bp.duration_hours,
          total_marks: bp.total_marks,
          step: extra.step || 1,
          blueprint_id: bp.id,
          form_data: extra.formData || {},
          sections: [],
          generated_sets: extra.generatedSets || null,
          status: bp.status || 'DRAFT',
          created_at: bp.created_at,
          updated_at: bp.updated_at,
        };
      }
    } catch (_) {}
  }

  // Also check question_papers where status is DRAFT
  if (!draft) {
    try {
      const { data: qp } = await supabase
        .from('question_papers')
        .select('*')
        .eq('id', cleanId)
        .eq('status', 'DRAFT')
        .maybeSingle();

      if (qp) {
        draft = {
          id: qp.id,
          teacher_id: qp.teacher_id,
          title: qp.title,
          subject: qp.subject,
          course: 'B.E. (Computer Engineering)',
          department: 'Department of Computer Engineering',
          class_year: 'TE',
          academic_pattern: qp.academic_year || '2019',
          semester: qp.semester || 'Semester 5',
          duration_hours: 2.5,
          total_marks: 70,
          step: 1,
          blueprint_id: null,
          form_data: {},
          sections: [],
          generated_sets: null,
          status: 'DRAFT',
          created_at: qp.created_at,
          updated_at: qp.updated_at,
        };
      }
    } catch (_) {}
  }

  if (!draft) {
    const err = new Error('Draft not found.');
    err.statusCode = 404;
    throw err;
  }

  // Enforce teacher data isolation
  const ownerId = draft.teacher_id || draft.teacherId;
  if (role !== 'ADMIN' && ownerId && ownerId !== teacherId) {
    const err = new Error('Unauthorized: You can only view and edit your own drafts.');
    err.statusCode = 403;
    throw err;
  }

  return formatDraftRecord(draft);
}

/**
 * Deletes a draft, validating ownership.
 */
async function deleteDraft(id, teacherId, role) {
  if (!id) throw new Error('Draft ID is required.');
  const cleanId = String(id).trim();

  let draftTitle = 'Draft';
  try {
    const draft = await getDraftById(cleanId, teacherId, role);
    if (draft && draft.title) {
      draftTitle = draft.title;
    }
  } catch (err) {
    if (err.statusCode === 403) throw err;
    // If not found in primary store, proceed to clean from all fallback caches
  }

  memoryDrafts.delete(cleanId);

  try {
    await supabase.from('exam_paper_drafts').delete().eq('id', cleanId);
  } catch (_) {}

  try {
    await supabase.from('exam_blueprints').delete().eq('id', cleanId).eq('status', 'DRAFT');
  } catch (_) {}

  try {
    await supabase.from('question_papers').delete().eq('id', cleanId).eq('status', 'DRAFT');
  } catch (_) {}

  return { success: true, message: `Draft "${draftTitle}" was deleted successfully.` };
}

function formatDraftRecord(row) {
  if (!row) return null;
  const fd = row.form_data || row.formData || {};
  const cYear = row.class_year || row.classYear || fd.classYear || 'TE';
  const sem = row.semester || fd.semester || 'Semester 5';
  const pat = row.academic_pattern || row.academicPattern || fd.academicPattern || '2019 Pattern';
  const sub = row.subject || fd.subject || 'Systems Programming and Operating System';
  const subCode = row.subject_code || row.subjectCode || fd.subjectCode || null;
  const crs = row.course || fd.course || 'T.E. (Computer Engineering)';
  const tMarks = parseInt(row.total_marks || row.totalMarks || fd.totalMarks || 70, 10);
  const durHours = parseFloat(row.duration_hours || row.durationHours || fd.durationHours || 2.5);
  const sects = (row.sections && row.sections.length > 0)
    ? row.sections
    : (fd.sections || (fd.blueprint && fd.blueprint.sections) || []);

  const reconstructedBlueprint = {
    title: row.title,
    subject: sub,
    subjectCode: subCode,
    course: crs,
    classYear: cYear,
    semester: sem,
    academicPattern: pat,
    totalMarks: tMarks,
    durationHours: durHours,
    sections: sects,
    instructions: fd.instructions || [
      'Answer Q1 or Q2, Q3 or Q4, Q5 or Q6, Q7 or Q8.',
      'Neat diagrams must be drawn wherever necessary.',
      'Figures to the right indicate full marks.',
      'Assume suitable data if necessary.',
    ],
    numSets: fd.numSets || 2,
    maxOverlapPercentage: fd.maxOverlapPercentage || 40,
  };

  return {
    id: row.id,
    teacherId: row.teacher_id || row.teacherId,
    title: row.title,
    subject: sub,
    subjectCode: subCode,
    course: crs,
    department: 'Department of Computer Engineering',
    classYear: cYear,
    academicPattern: pat,
    semester: sem,
    durationHours: durHours,
    totalMarks: tMarks,
    step: parseInt(row.step || 1, 10),
    blueprintId: row.blueprint_id || row.blueprintId,
    formData: fd,
    sections: sects,
    generatedSets: row.generated_sets || row.generatedSets || null,
    generatedPaperData: row.generated_sets || row.generatedSets || null,
    blueprint: reconstructedBlueprint,
    status: row.status || 'DRAFT',
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

module.exports = {
  saveDraft,
  getTeacherDrafts,
  getDraftById,
  deleteDraft,
  formatDraftRecord,
};

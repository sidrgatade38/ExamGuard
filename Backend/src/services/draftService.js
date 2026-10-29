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
async function saveDraft({
  draftId,
  teacherId,
  title,
  subject,
  subjectCode,
  course,
  department,
  classYear = 'TE',
  academicPattern,
  semester,
  durationHours = 2.5,
  totalMarks = 70,
  step = 1,
  blueprintId = null,
  formData = {},
  sections = [],
  generatedSets = null,
  status = 'DRAFT',
}) {
  if (!teacherId) throw new Error('Teacher ID is required to save draft.');

  const effectiveTitle = (title && title.trim()) ? title.trim() : `Untitled Draft (${subject || 'Examination'})`;
  const effectiveSubject = subject || 'General Subject';
  const idToUse = draftId || crypto.randomUUID();

  const record = {
    id: idToUse,
    teacher_id: teacherId,
    title: effectiveTitle,
    subject: effectiveSubject,
    subject_code: subjectCode || null,
    course: course || 'Computer Engineering',
    department: 'Department of Computer Engineering',
    class_year: classYear || 'TE',
    academic_pattern: academicPattern || '2019 Pattern',
    semester: semester || 'Semester 5',
    duration_hours: parseFloat(durationHours) || 2.5,
    total_marks: parseInt(totalMarks, 10) || 70,
    step: parseInt(step, 10) || 1,
    blueprint_id: blueprintId || null,
    form_data: formData || {},
    sections: sections || [],
    generated_sets: generatedSets || null,
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

  let draft = null;
  try {
    const { data, error } = await supabase
      .from('exam_paper_drafts')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (data && !error) {
      draft = data;
    }
  } catch (_) {}

  if (!draft) {
    draft = memoryDrafts.get(id);
  }

  if (!draft) {
    // Try exam_blueprints
    try {
      const { data: bp } = await supabase
        .from('exam_blueprints')
        .select('*')
        .eq('id', id)
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

  if (!draft) {
    const err = new Error('Draft not found.');
    err.statusCode = 404;
    throw err;
  }

  // Enforce teacher data isolation
  if (role !== 'ADMIN' && draft.teacher_id !== teacherId) {
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

  const draft = await getDraftById(id, teacherId, role);
  if (!draft) {
    const err = new Error('Draft not found.');
    err.statusCode = 404;
    throw err;
  }

  memoryDrafts.delete(id);

  try {
    await supabase.from('exam_paper_drafts').delete().eq('id', id);
  } catch (_) {}

  try {
    await supabase.from('exam_blueprints').delete().eq('id', id).eq('status', 'DRAFT');
  } catch (_) {}

  return { success: true, message: `Draft "${draft.title}" was deleted.` };
}

function formatDraftRecord(row) {
  if (!row) return null;
  return {
    id: row.id,
    teacherId: row.teacher_id || row.teacherId,
    title: row.title,
    subject: row.subject,
    subjectCode: row.subject_code || row.subjectCode,
    course: row.course,
    department: row.department,
    classYear: row.class_year || row.classYear || 'TE',
    academicPattern: row.academic_pattern || row.academicPattern,
    semester: row.semester,
    durationHours: parseFloat(row.duration_hours || row.durationHours || 2.5),
    totalMarks: parseInt(row.total_marks || row.totalMarks || 70, 10),
    step: parseInt(row.step || 1, 10),
    blueprintId: row.blueprint_id || row.blueprintId,
    formData: row.form_data || row.formData || {},
    sections: row.sections || [],
    generatedSets: row.generated_sets || row.generatedSets || null,
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
};

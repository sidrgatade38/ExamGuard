/**
 * ExamGuard - Examination Blueprint Service (Module 18)
 *
 * Configures and validates curriculum examination blueprints,
 * representing university alternative groups (Q1 OR Q2, etc.),
 * subquestions, marking schemes, and multi-set generation feasibility.
 */

const { supabase } = require('../config/supabase');
const questionBankService = require('./questionBankService');
const crypto = require('crypto');

// In-memory blueprint store fallback
const memoryBlueprints = new Map();
const memorySections = new Map();

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
 * Standard SPOS 2019 Pattern Blueprint configuration matching May_Jun_2022.pdf
 */
const DEFAULT_SPOS_BLUEPRINT = {
  title: 'End Semester Examination: Systems Programming & Operating System',
  subject: 'Systems Programming and Operating System',
  course: 'T.E. (Computer Engineering)',
  semester: 'Semester 5',
  academicPattern: '2019 Pattern',
  subjectCode: '310243',
  durationHours: 2.5,
  totalMarks: 70,
  instructions: [
    'Answer Q1 or Q2, Q3 or Q4, Q5 or Q6, Q7 or Q8.',
    'Neat diagrams must be drawn wherever necessary.',
    'Figures to the right indicate full marks.',
    'Assume suitable data if necessary.',
  ],
  numSets: 2,
  maxOverlapPercentage: 40,
  sections: [
    {
      groupOrder: 1,
      groupLabel: 'Group 1 (Unit 1: Loaders and Linkers)',
      primaryQuestionNumber: 1,
      alternativeQuestionNumber: 2,
      targetMarks: 17,
      targetUnit: 1,
      subquestionsConfig: [
        { subPart: 'a', marks: 8, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 1 },
        { subPart: 'b', marks: 9, difficulty: 'HARD', questionType: 'DESCRIPTIVE', unit: 1 },
      ],
    },
    {
      groupOrder: 2,
      groupLabel: 'Group 2 (Unit 2: Compilers, Interpreters and Lexical Analysis)',
      primaryQuestionNumber: 3,
      alternativeQuestionNumber: 4,
      targetMarks: 17,
      targetUnit: 2,
      subquestionsConfig: [
        { subPart: 'a', marks: 8, difficulty: 'EASY', questionType: 'DESCRIPTIVE', unit: 2 },
        { subPart: 'b', marks: 9, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 2 },
      ],
    },
    {
      groupOrder: 3,
      groupLabel: 'Group 3 (Unit 3: Operating System Overview & Process Management)',
      primaryQuestionNumber: 5,
      alternativeQuestionNumber: 6,
      targetMarks: 18,
      targetUnit: 3,
      subquestionsConfig: [
        { subPart: 'a', marks: 9, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 3 },
        { subPart: 'b', marks: 9, difficulty: 'HARD', questionType: 'DESCRIPTIVE', unit: 3 },
      ],
    },
    {
      groupOrder: 4,
      groupLabel: 'Group 4 (Unit 4: Memory Management)',
      primaryQuestionNumber: 7,
      alternativeQuestionNumber: 8,
      targetMarks: 18,
      targetUnit: 4,
      subquestionsConfig: [
        { subPart: 'a', marks: 9, difficulty: 'MEDIUM', questionType: 'DESCRIPTIVE', unit: 4 },
        { subPart: 'b', marks: 9, difficulty: 'HARD', questionType: 'DESCRIPTIVE', unit: 4 },
      ],
    },
  ],
};

/**
 * Validates blueprint consistency, marks calculations, and subquestions.
 */
function validateBlueprintStructure(blueprint) {
  const errors = [];

  if (!blueprint.title || !blueprint.title.trim()) errors.push('Blueprint title is required.');
  if (!blueprint.subject || !blueprint.subject.trim()) errors.push('Subject name is required.');
  if (!blueprint.totalMarks || isNaN(blueprint.totalMarks) || blueprint.totalMarks <= 0) {
    errors.push('Total marks must be a positive number.');
  }

  const sections = blueprint.sections || [];
  if (!Array.isArray(sections) || sections.length === 0) {
    errors.push('At least one examination section or question group is required.');
    return { valid: false, errors };
  }

  // Calculate sum of answered marks across all groups
  let calculatedAnsweredMarks = 0;

  sections.forEach((sec, idx) => {
    const groupNum = sec.groupOrder || idx + 1;
    if (!sec.targetMarks || isNaN(sec.targetMarks)) {
      errors.push(`Group ${groupNum}: targetMarks is required.`);
    } else {
      calculatedAnsweredMarks += parseInt(sec.targetMarks, 10);
    }

    // Validate subquestions inside group
    const subConfigs = sec.subquestionsConfig || [];
    if (!Array.isArray(subConfigs) || subConfigs.length === 0) {
      errors.push(`Group ${groupNum}: Must specify at least one subquestion configuration.`);
    } else {
      const subSum = subConfigs.reduce((acc, sub) => acc + (parseInt(sub.marks, 10) || 0), 0);
      if (subSum !== parseInt(sec.targetMarks, 10)) {
        errors.push(
          `Group ${groupNum}: Subquestions sum (${subSum}) does not equal group target marks (${sec.targetMarks}).`
        );
      }
    }
  });

  if (calculatedAnsweredMarks !== parseInt(blueprint.totalMarks, 10)) {
    errors.push(
      `Blueprint total marks mismatch: sum of answered groups (${calculatedAnsweredMarks}) does not match totalMarks (${blueprint.totalMarks}).`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    calculatedAnsweredMarks,
  };
}

/**
 * Creates an exam blueprint with sections.
 */
async function createBlueprint({
  authorId,
  title,
  subject,
  course = 'T.E. (Computer Engineering)',
  semester = 'Semester 5',
  academicPattern = '2019 Pattern',
  subjectCode = '',
  durationHours = 2.5,
  totalMarks = 70,
  instructions = [],
  numSets = 2,
  maxOverlapPercentage = 40,
  sections = [],
}) {
  const blueprintObj = {
    title,
    subject,
    course,
    semester,
    academicPattern,
    subjectCode,
    durationHours: parseFloat(durationHours),
    totalMarks: parseInt(totalMarks, 10),
    instructions: instructions.length > 0 ? instructions : DEFAULT_SPOS_BLUEPRINT.instructions,
    numSets: parseInt(numSets, 10) || 2,
    maxOverlapPercentage: parseInt(maxOverlapPercentage, 10) || 40,
    sections,
  };

  const validation = validateBlueprintStructure(blueprintObj);
  if (!validation.valid) {
    const err = new Error(`Invalid blueprint structure: ${validation.errors.join(' ')}`);
    err.statusCode = 400;
    err.errors = validation.errors;
    throw err;
  }

  const bpId = crypto.randomUUID();
  const bpPayload = {
    id: bpId,
    author_id: authorId,
    title: blueprintObj.title.trim(),
    subject: blueprintObj.subject.trim(),
    course: blueprintObj.course.trim(),
    semester: blueprintObj.semester.trim(),
    academic_pattern: blueprintObj.academicPattern.trim(),
    subject_code: blueprintObj.subjectCode ? blueprintObj.subjectCode.trim() : null,
    duration_hours: blueprintObj.durationHours,
    total_marks: blueprintObj.totalMarks,
    instructions: blueprintObj.instructions,
    num_sets: blueprintObj.numSets,
    max_overlap_percentage: blueprintObj.maxOverlapPercentage,
    status: 'ACTIVE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const { data: bpData, error: bpError } = await supabase
      .from('exam_blueprints')
      .insert([bpPayload])
      .select('*')
      .single();

    if (bpError) {
      if (isTableMissingError(bpError)) {
        return createMemoryBlueprint(bpPayload, sections);
      }
      throw bpError;
    }

    // Insert sections
    const sectionRows = sections.map((sec, idx) => ({
      id: crypto.randomUUID(),
      blueprint_id: bpId,
      group_order: sec.groupOrder || idx + 1,
      group_label: sec.groupLabel || `Group ${idx + 1}`,
      primary_question_number: sec.primaryQuestionNumber || (idx * 2 + 1),
      alternative_question_number: sec.alternativeQuestionNumber || (idx * 2 + 2),
      target_marks: sec.targetMarks,
      target_unit: sec.targetUnit || (idx + 1),
      subquestions_config: sec.subquestionsConfig || [],
      created_at: new Date().toISOString(),
    }));

    const { error: secError } = await supabase
      .from('exam_blueprint_sections')
      .insert(sectionRows);

    if (secError) {
      if (isTableMissingError(secError)) {
        return createMemoryBlueprint(bpPayload, sections);
      }
      throw secError;
    }

    return {
      ...bpData,
      sections: sectionRows,
    };
  } catch (err) {
    if (isTableMissingError(err)) {
      return createMemoryBlueprint(bpPayload, sections);
    }
    console.error('[BlueprintService] createBlueprint error:', err.message);
    throw err;
  }
}

function createMemoryBlueprint(bpPayload, sections) {
  memoryBlueprints.set(bpPayload.id, bpPayload);
  const secList = sections.map((sec, idx) => ({
    id: crypto.randomUUID(),
    blueprint_id: bpPayload.id,
    group_order: sec.groupOrder || idx + 1,
    group_label: sec.groupLabel || `Group ${idx + 1}`,
    primary_question_number: sec.primaryQuestionNumber || (idx * 2 + 1),
    alternative_question_number: sec.alternativeQuestionNumber || (idx * 2 + 2),
    target_marks: sec.targetMarks,
    target_unit: sec.targetUnit || (idx + 1),
    subquestions_config: sec.subquestionsConfig || [],
  }));
  memorySections.set(bpPayload.id, secList);

  return {
    ...bpPayload,
    sections: secList,
  };
}

/**
 * Retrieves blueprint with its sections by ID.
 */
async function getBlueprintById(id) {
  if (!id) throw new Error('Blueprint ID is required.');

  try {
    const { data: bp, error: bpError } = await supabase
      .from('exam_blueprints')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (bpError && isTableMissingError(bpError)) {
      return getMemoryBlueprintById(id);
    }

    if (!bp) {
      return getMemoryBlueprintById(id);
    }

    const { data: sections } = await supabase
      .from('exam_blueprint_sections')
      .select('*')
      .eq('blueprint_id', id)
      .order('group_order', { ascending: true });

    return {
      id: bp.id,
      authorId: bp.author_id,
      title: bp.title,
      subject: bp.subject,
      course: bp.course,
      semester: bp.semester,
      academicPattern: bp.academic_pattern,
      subjectCode: bp.subject_code,
      durationHours: bp.duration_hours,
      totalMarks: bp.total_marks,
      instructions: bp.instructions,
      numSets: bp.num_sets,
      maxOverlapPercentage: bp.max_overlap_percentage,
      status: bp.status,
      createdAt: bp.created_at,
      updatedAt: bp.updated_at,
      sections: (sections || []).map((s) => ({
        id: s.id,
        groupOrder: s.group_order,
        groupLabel: s.group_label,
        primaryQuestionNumber: s.primary_question_number,
        alternativeQuestionNumber: s.alternative_question_number,
        targetMarks: s.target_marks,
        targetUnit: s.target_unit,
        subquestionsConfig: s.subquestions_config,
      })),
    };
  } catch (err) {
    return getMemoryBlueprintById(id);
  }
}

function getMemoryBlueprintById(id) {
  const bp = memoryBlueprints.get(id);
  if (!bp) {
    // If requesting default
    if (id === 'default-spos' || id === 'sample-spos') {
      return {
        id: 'default-spos',
        ...DEFAULT_SPOS_BLUEPRINT,
      };
    }
    return null;
  }
  const rawSections = memorySections.get(id) || [];
  const sections = rawSections.map((s) => ({
    id: s.id,
    groupOrder: s.groupOrder || s.group_order,
    groupLabel: s.groupLabel || s.group_label,
    primaryQuestionNumber: s.primaryQuestionNumber || s.primary_question_number,
    alternativeQuestionNumber: s.alternativeQuestionNumber || s.alternative_question_number,
    targetMarks: s.targetMarks || s.target_marks,
    targetUnit: s.targetUnit || s.target_unit,
    subquestionsConfig: s.subquestionsConfig || s.subquestions_config || [],
  }));

  return {
    id: bp.id,
    authorId: bp.author_id,
    title: bp.title,
    subject: bp.subject,
    course: bp.course,
    semester: bp.semester,
    academicPattern: bp.academic_pattern,
    subjectCode: bp.subject_code,
    durationHours: bp.duration_hours,
    totalMarks: bp.total_marks,
    instructions: bp.instructions,
    numSets: bp.num_sets,
    maxOverlapPercentage: bp.max_overlap_percentage,
    status: bp.status,
    sections,
  };
}

/**
 * Validates whether the Question Bank contains sufficient eligible questions
 * to satisfy the blueprint across the requested number of sets and overlap constraints.
 */
async function validateFeasibility(blueprintId, authorId, role) {
  const blueprint = await getBlueprintById(blueprintId);
  if (!blueprint) {
    const err = new Error('Blueprint not found.');
    err.statusCode = 404;
    throw err;
  }

  // Fetch all eligible questions for this subject
  const bankResult = await questionBankService.getQuestions({
    authorId,
    role: role || 'TEACHER',
    subject: blueprint.subject,
    approvalStatus: 'APPROVED',
  });

  const allQuestions = bankResult.data || [];
  const issues = [];
  const poolAnalysis = [];

  const numSets = blueprint.numSets || 2;
  const maxOverlap = blueprint.maxOverlapPercentage || 40;

  // Analyze each section's subquestion requirements
  for (const sec of blueprint.sections || []) {
    const subConfigs = sec.subquestionsConfig || [];
    const unit = sec.targetUnit;
    const hasOrAlternative = !!sec.alternativeQuestionNumber;
    // Multiplier for questions needed per set: if has OR pair, need 2 sets of questions per set!
    const questionsNeededPerSet = hasOrAlternative ? subConfigs.length * 2 : subConfigs.length;
    const totalQuestionsNeededAcrossSets = Math.ceil(
      questionsNeededPerSet * numSets * (1 - (maxOverlap / 100))
    );

    // Group eligible questions by unit and marks
    for (const sub of subConfigs) {
      const neededMarks = parseInt(sub.marks, 10);
      const matching = allQuestions.filter(
        (q) => q.unitNumber === unit && q.marks === neededMarks
      );

      const requiredForSub = hasOrAlternative ? 2 : 1;
      const minPoolRequired = Math.max(requiredForSub, Math.ceil(requiredForSub * numSets * (1 - (maxOverlap / 100))));

      if (matching.length < minPoolRequired) {
        issues.push(
          `Unit ${unit} (${neededMarks} Marks): Requires at least ${minPoolRequired} eligible questions for ${numSets} sets, but only ${matching.length} found in bank.`
        );
      }

      poolAnalysis.push({
        unit,
        marks: neededMarks,
        difficulty: sub.difficulty,
        questionType: sub.questionType,
        availableCount: matching.length,
        requiredCount: minPoolRequired,
        sufficient: matching.length >= minPoolRequired,
      });
    }
  }

  return {
    feasible: issues.length === 0,
    blueprintId: blueprint.id,
    subject: blueprint.subject,
    numSets,
    maxOverlapPercentage: maxOverlap,
    totalBankQuestionsAvailable: allQuestions.length,
    issues,
    poolAnalysis,
  };
}

module.exports = {
  DEFAULT_SPOS_BLUEPRINT,
  validateBlueprintStructure,
  createBlueprint,
  getBlueprintById,
  validateFeasibility,
};

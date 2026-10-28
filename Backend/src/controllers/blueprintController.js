/**
 * ExamGuard - Blueprint Controller (Module 18)
 */

const blueprintService = require('../services/blueprintService');
const draftService = require('../services/draftService');

async function createBlueprint(req, res, next) {
  try {
    const authorId = req.user?.userId;
    const {
      title,
      subject,
      course,
      semester,
      academicPattern,
      subjectCode,
      durationHours,
      totalMarks,
      instructions,
      numSets,
      maxOverlapPercentage,
      sections,
    } = req.body;

    const blueprint = await blueprintService.createBlueprint({
      authorId,
      title,
      subject,
      course,
      semester,
      academicPattern,
      subjectCode,
      durationHours,
      totalMarks,
      instructions,
      numSets,
      maxOverlapPercentage,
      sections,
    });

    return res.status(201).json({
      success: true,
      message: 'Blueprint created successfully',
      data: blueprint,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        errors: err.errors,
      });
    }
    next(err);
  }
}

async function getBlueprint(req, res, next) {
  try {
    const { id } = req.params;
    const blueprint = await blueprintService.getBlueprintById(id);

    if (!blueprint) {
      return res.status(404).json({ success: false, message: 'Blueprint not found' });
    }

    return res.status(200).json({
      success: true,
      data: blueprint,
    });
  } catch (err) {
    next(err);
  }
}

async function checkFeasibility(req, res, next) {
  try {
    const { id } = req.params;
    const authorId = req.user?.userId;
    const role = req.user?.role;

    const feasibility = await blueprintService.validateFeasibility(id, authorId, role);

    return res.status(200).json({
      success: true,
      data: feasibility,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
}

function getDefaultBlueprint(req, res) {
  const { subject, course, semester, academicPattern, subjectCode } = req.query;
  const data = blueprintService.getStandardCurriculumBlueprint({
    subject,
    course,
    semester,
    academicPattern,
    subjectCode,
  });
  return res.status(200).json({
    success: true,
    data,
  });
}

/**
 * Handles GET /api/exam-blueprints/marks-structure?totalMarks=20|30|60|70
 */
function getMarksStructure(req, res) {
  const { totalMarks } = req.query;
  const sections = blueprintService.getDefaultMarksStructure(totalMarks || 70);
  return res.status(200).json({
    success: true,
    totalMarks: parseInt(totalMarks, 10) || 70,
    sections,
  });
}

/**
 * Handles POST /api/exam-blueprints/drafts - Save or update draft
 */
async function saveDraft(req, res, next) {
  try {
    const teacherId = req.user?.userId;
    const result = await draftService.saveDraft({
      ...req.body,
      teacherId,
    });
    return res.status(200).json({
      success: true,
      message: 'Draft saved successfully.',
      data: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
}

/**
 * Handles GET /api/exam-blueprints/drafts - List authenticated teacher's drafts
 */
async function listDrafts(req, res, next) {
  try {
    const teacherId = req.user?.userId;
    const drafts = await draftService.getTeacherDrafts(teacherId);
    return res.status(200).json({
      success: true,
      data: drafts,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Handles GET /api/exam-blueprints/drafts/:id - Get specific draft
 */
async function getDraft(req, res, next) {
  try {
    const teacherId = req.user?.userId;
    const role = req.user?.role;
    const { id } = req.params;
    const draft = await draftService.getDraftById(id, teacherId, role);
    return res.status(200).json({
      success: true,
      data: draft,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
}

/**
 * Handles DELETE /api/exam-blueprints/drafts/:id - Delete draft
 */
async function deleteDraft(req, res, next) {
  try {
    const teacherId = req.user?.userId;
    const role = req.user?.role;
    const { id } = req.params;
    const result = await draftService.deleteDraft(id, teacherId, role);
    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
}

module.exports = {
  createBlueprint,
  getBlueprint,
  checkFeasibility,
  getDefaultBlueprint,
  getMarksStructure,
  saveDraft,
  listDrafts,
  getDraft,
  deleteDraft,
};

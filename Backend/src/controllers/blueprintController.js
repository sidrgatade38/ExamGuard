/**
 * ExamGuard - Blueprint Controller (Module 18)
 */

const blueprintService = require('../services/blueprintService');

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

module.exports = {
  createBlueprint,
  getBlueprint,
  checkFeasibility,
  getDefaultBlueprint,
};

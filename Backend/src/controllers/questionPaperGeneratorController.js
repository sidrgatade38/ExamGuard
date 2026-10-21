/**
 * ExamGuard - Question Paper Generator Controller (Module 18)
 */

const generatorService = require('../services/questionPaperGeneratorService');

async function generateSets(req, res, next) {
  try {
    const teacherId = req.user?.userId;
    const role = req.user?.role;
    const { blueprintId } = req.body;

    const result = await generatorService.generateExamSets({
      blueprintId,
      teacherId,
      role,
    });

    return res.status(201).json({
      success: true,
      message: 'Examination sets generated successfully',
      data: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
        feasibility: err.feasibility,
      });
    }
    next(err);
  }
}

async function getPaperSets(req, res, next) {
  try {
    const { paperId } = req.params;
    const teacherId = req.user?.userId;
    const role = req.user?.role;

    const result = await generatorService.getGeneratedPaper(paperId, teacherId, role);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
}

async function replaceQuestion(req, res, next) {
  try {
    const { setId } = req.params;
    const teacherId = req.user?.userId;
    const role = req.user?.role;
    const { oldQuestionId, newQuestionId } = req.body;

    const result = await generatorService.replaceQuestionInSet({
      setId,
      oldQuestionId,
      newQuestionId,
      teacherId,
      role,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
}

async function approveAndSubmit(req, res, next) {
  try {
    const { setId } = req.params;
    const teacherId = req.user?.userId;
    const role = req.user?.role;
    const { assignedToUserId, examDate } = req.body;

    const result = await generatorService.approveAndSubmitSet({
      setId,
      teacherId,
      assignedToUserId,
      examDate,
      role,
    });

    return res.status(201).json(result);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
}

module.exports = {
  generateSets,
  getPaperSets,
  replaceQuestion,
  approveAndSubmit,
};

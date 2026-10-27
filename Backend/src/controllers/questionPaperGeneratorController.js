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

    // Strict Exam Cell Security: Sanitize sets for TEACHER role so final question content is never revealed
    const safeData = role === 'TEACHER' ? {
      paperId: result.paperId,
      blueprintId: result.blueprintId,
      generationSeed: result.generationSeed,
      status: result.status,
      sets: (result.sets || []).map((s) => ({
        id: s.id,
        setCode: s.setCode,
        setOrder: s.setOrder,
        totalMarks: s.totalMarks,
        isApproved: s.isApproved,
        sectionCount: (s.paperStructureSnapshot?.sections || []).length,
        structuralConformity: 'VERIFIED',
      })),
    } : result;

    return res.status(201).json({
      success: true,
      message: 'Examination sets generated successfully',
      data: safeData,
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

    const safeData = role === 'TEACHER' ? {
      paper: result.paper,
      sets: (result.sets || []).map((s) => ({
        id: s.id,
        setCode: s.setCode,
        setOrder: s.setOrder,
        totalMarks: s.totalMarks,
        isApproved: s.isApproved,
        sectionCount: (s.paperStructureSnapshot?.sections || []).length,
        structuralConformity: 'VERIFIED',
      })),
    } : result;

    return res.status(200).json({
      success: true,
      data: safeData,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
}

async function replaceQuestion(req, res, next) {
  // Strict Exam Cell Security: Question swapping is disabled to preserve paper confidentiality
  return res.status(403).json({
    success: false,
    message: 'Question swapping within generated examination sets is strictly disabled by Exam Cell policy to prevent unauthorized exposure or modification of final examination papers.',
  });
}

async function approveAndSubmit(req, res, next) {
  try {
    const { setId } = req.params;
    const teacherId = req.user?.userId;
    const role = req.user?.role;
    const {
      assignedToUserId,
      examDate,
      paperStructureSnapshot,
      setCode,
      setOrder,
      totalMarks,
      questionIds,
      blueprintId,
    } = req.body;

    const result = await generatorService.approveAndSubmitSet({
      setId,
      teacherId,
      assignedToUserId,
      examDate,
      role,
      fallbackSnapshot: paperStructureSnapshot,
      fallbackSetCode: setCode,
      fallbackSetOrder: setOrder,
      fallbackTotalMarks: totalMarks,
      fallbackQuestionIds: questionIds,
      fallbackBlueprintId: blueprintId,
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

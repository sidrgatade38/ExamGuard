/**
 * ExamGuard - Question Bank Controller (Module 18)
 */

const questionBankService = require('../services/questionBankService');

async function listQuestions(req, res, next) {
  try {
    const authorId = req.user?.userId;
    const role = req.user?.role;
    const {
      subject,
      semester,
      unitNumber,
      difficulty,
      questionType,
      approvalStatus,
      search,
      limit,
      offset,
    } = req.query;

    const result = await questionBankService.getQuestions({
      authorId,
      role,
      subject,
      semester,
      unitNumber,
      difficulty,
      questionType,
      approvalStatus,
      search,
      limit: parseInt(limit, 10) || 100,
      offset: parseInt(offset, 10) || 0,
    });

    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function createQuestion(req, res, next) {
  try {
    const authorId = req.user?.userId;
    const {
      subject,
      course,
      semester,
      academicPattern,
      examType,
      unitNumber,
      unitTitle,
      topic,
      questionText,
      questionType,
      marks,
      difficulty,
      answerScheme,
      approvalStatus,
      courseOutcome,
      course_outcome,
      programOutcome,
      program_outcome,
      bloomTaxonomy,
      bloom_taxonomy,
    } = req.body;

    const question = await questionBankService.createQuestion({
      authorId,
      subject,
      course,
      semester,
      academicPattern,
      examType,
      unitNumber,
      unitTitle,
      topic,
      questionText,
      questionType,
      marks,
      difficulty,
      answerScheme,
      approvalStatus,
      courseOutcome: courseOutcome || course_outcome,
      programOutcome: programOutcome || program_outcome,
      bloomTaxonomy: bloomTaxonomy || bloom_taxonomy,
    });

    return res.status(201).json({
      success: true,
      message: 'Question created successfully',
      data: question,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
}

async function updateQuestion(req, res, next) {
  try {
    const { id } = req.params;
    const authorId = req.user?.userId;
    const role = req.user?.role;

    const updated = await questionBankService.updateQuestion(id, req.body, authorId, role);

    return res.status(200).json({
      success: true,
      message: 'Question updated successfully',
      data: updated,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    next(err);
  }
}

async function seedQuestions(req, res, next) {
  try {
    const authorId = req.user?.userId;
    const subject = req.body?.subject || req.query?.subject || 'Systems Programming and Operating System';
    const seeded = await questionBankService.seedSampleQuestions(authorId, subject);

    return res.status(201).json({
      success: true,
      message: `Successfully seeded ${seeded.length} standard curriculum questions for "${subject}" into Question Bank`,
      count: seeded.length,
      data: seeded,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listQuestions,
  createQuestion,
  updateQuestion,
  seedQuestions,
};

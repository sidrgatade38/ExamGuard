const answerKeyService = require('../services/answerKeyService');

/**
 * Answer Key Controller (Module 10)
 * Handles incoming HTTP requests for post-exam Answer Key lifecycle:
 * - Teacher:
 *   - POST   /api/teacher/question-papers/:id/answer-key
 *   - GET    /api/teacher/question-papers/:id/answer-key
 *   - GET    /api/teacher/question-papers/:id/answer-key/download
 *   - GET    /api/teacher/question-papers/:id/answer-key/verify-signature
 * - Exam Coordinator:
 *   - GET    /api/exam-coordinator/question-papers/:id/answer-key
 *   - GET    /api/exam-coordinator/question-papers/:id/answer-key/download
 *   - GET    /api/exam-coordinator/question-papers/:id/answer-key/verify-signature
 */

/**
 * Handles teacher answer key upload
 * (POST /api/teacher/question-papers/:id/answer-key)
 */
async function uploadAnswerKey(req, res, next) {
  try {
    const teacherId = req.user?.userId;
    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const questionPaperId = req.params.id || req.params.questionPaperId;
    if (!questionPaperId) {
      return res.status(400).json({
        success: false,
        message: 'Question paper ID is required',
      });
    }

    // Reject client-supplied teacherId spoofing
    if (
      (req.body.teacher_id && req.body.teacher_id !== teacherId) ||
      (req.body.teacherId && req.body.teacherId !== teacherId)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Client-supplied teacherId cannot override authenticated teacher identity.',
      });
    }

    // Reject client-supplied storage path manipulation
    if (req.body.storage_path || req.body.storagePath) {
      return res.status(400).json({
        success: false,
        message: 'Client cannot specify storage path. Storage paths are strictly server-controlled.',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Answer key file is required',
      });
    }

    const result = await answerKeyService.uploadAnswerKey({
      teacherId,
      questionPaperId,
      file: req.file,
      sanitizedFileName: req.sanitizedFileName,
    });

    return res.status(201).json({
      success: true,
      message: 'Answer key uploaded successfully',
      data: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles teacher getting answer key details and submission window
 * (GET /api/teacher/question-papers/:id/answer-key)
 */
async function getTeacherAnswerKey(req, res, next) {
  try {
    const teacherId = req.user?.userId;
    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const questionPaperId = req.params.id || req.params.questionPaperId;
    const result = await answerKeyService.getAnswerKeyForTeacher(questionPaperId, teacherId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles teacher downloading decrypted answer key PDF
 * (GET /api/teacher/question-papers/:id/answer-key/download)
 */
async function downloadTeacherAnswerKey(req, res, next) {
  try {
    const teacherId = req.user?.userId;
    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const questionPaperId = req.params.id || req.params.questionPaperId;
    const { decryptedBuffer, fileName, mimeType } = await answerKeyService.downloadAnswerKeyForTeacher(
      questionPaperId,
      teacherId
    );

    res.setHeader('Content-Type', mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', decryptedBuffer.length);

    return res.status(200).send(decryptedBuffer);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles teacher verifying answer key digital signature & hash
 * (GET /api/teacher/question-papers/:id/answer-key/verify-signature)
 */
async function verifyTeacherAnswerKeySignature(req, res, next) {
  try {
    const teacherId = req.user?.userId;
    if (!teacherId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const questionPaperId = req.params.id || req.params.questionPaperId;
    const result = await answerKeyService.verifyAnswerKeySignatureForTeacher(
      questionPaperId,
      teacherId
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles coordinator getting answer key details
 * (GET /api/exam-coordinator/question-papers/:id/answer-key)
 */
async function getCoordinatorAnswerKey(req, res, next) {
  try {
    const coordinatorId = req.user?.userId;
    if (!coordinatorId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const questionPaperId = req.params.id || req.params.questionPaperId;
    const result = await answerKeyService.getAnswerKeyForCoordinator(
      questionPaperId,
      coordinatorId
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles coordinator downloading decrypted answer key PDF
 * (GET /api/exam-coordinator/question-papers/:id/answer-key/download)
 */
async function downloadCoordinatorAnswerKey(req, res, next) {
  try {
    const coordinatorId = req.user?.userId;
    if (!coordinatorId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const questionPaperId = req.params.id || req.params.questionPaperId;
    const { decryptedBuffer, fileName, mimeType } = await answerKeyService.downloadAnswerKeyForCoordinator(
      questionPaperId,
      coordinatorId
    );

    res.setHeader('Content-Type', mimeType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', decryptedBuffer.length);

    return res.status(200).send(decryptedBuffer);
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

/**
 * Handles coordinator verifying answer key digital signature & hash
 * (GET /api/exam-coordinator/question-papers/:id/answer-key/verify-signature)
 */
async function verifyCoordinatorAnswerKeySignature(req, res, next) {
  try {
    const coordinatorId = req.user?.userId;
    if (!coordinatorId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const questionPaperId = req.params.id || req.params.questionPaperId;
    const result = await answerKeyService.verifyAnswerKeySignatureForCoordinator(
      questionPaperId,
      coordinatorId
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({
        success: false,
        message: err.message,
      });
    }
    return next(err);
  }
}

module.exports = {
  uploadAnswerKey,
  getTeacherAnswerKey,
  downloadTeacherAnswerKey,
  verifyTeacherAnswerKeySignature,
  getCoordinatorAnswerKey,
  downloadCoordinatorAnswerKey,
  verifyCoordinatorAnswerKeySignature,
};

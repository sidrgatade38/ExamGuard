const examCoordinatorService = require('../services/examCoordinatorService');

/**
 * Exam Coordinator Controller (Module 9)
 * Handles incoming HTTP requests for Exam Coordinator access:
 * - GET /api/exam-coordinator/question-papers
 * - GET /api/exam-coordinator/question-papers/:id
 * - GET /api/exam-coordinator/question-papers/:id/download
 * - GET /api/exam-coordinator/question-papers/:id/verify-signature
 */

/**
 * Handles fetching question papers assigned to the authenticated coordinator
 * (GET /api/exam-coordinator/question-papers)
 */
async function getAssignedPapers(req, res, next) {
  try {
    const coordinatorId = req.user?.userId;
    if (!coordinatorId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const papers = await examCoordinatorService.getAvailableQuestionPapers(coordinatorId, req.query);

    return res.status(200).json({
      success: true,
      data: papers,
      pagination: papers.pagination || { total: papers.length, page: 1, limit: papers.length, totalPages: 1 },
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
 * Handles fetching data-driven KPI metrics for the coordinator dashboard
 * (GET /api/exam-coordinator/dashboard-stats)
 */
async function getDashboardStats(req, res, next) {
  try {
    const coordinatorId = req.user?.userId;
    if (!coordinatorId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const stats = await examCoordinatorService.getDashboardStats(coordinatorId);

    return res.status(200).json({
      success: true,
      data: stats,
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
 * Handles fetching recent coordinator security & delivery activity
 * (GET /api/exam-coordinator/recent-activity)
 */
async function getRecentActivity(req, res, next) {
  try {
    const coordinatorId = req.user?.userId;
    if (!coordinatorId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const activities = await examCoordinatorService.getRecentActivity(coordinatorId, req.query?.limit);

    return res.status(200).json({
      success: true,
      data: activities,
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
 * Handles fetching specific question paper metadata with assignment validation
 * (GET /api/exam-coordinator/question-papers/:id)
 */
async function getPaperDetails(req, res, next) {
  try {
    const coordinatorId = req.user?.userId;
    if (!coordinatorId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const paper = await examCoordinatorService.getQuestionPaperById(
      req.params.id,
      coordinatorId
    );

    return res.status(200).json({
      success: true,
      data: paper,
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
 * Handles downloading and decrypting authorized question paper
 * (GET /api/exam-coordinator/question-papers/:id/download)
 * Streams authenticated decrypted PDF directly to client with attachment headers.
 */
async function downloadPaper(req, res, next) {
  try {
    const coordinatorId = req.user?.userId;
    if (!coordinatorId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const { decryptedBuffer, fileName, mimeType } = await examCoordinatorService.downloadAndDecryptQuestionPaper(
      req.params.id,
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
 * Handles verifying question paper digital signature and integrity
 * (GET /api/exam-coordinator/question-papers/:id/verify-signature)
 * Evaluates RSA-PSS signature and SHA-256 hash over stored ciphertext without exposing secrets.
 */
async function verifyPaperSignature(req, res, next) {
  try {
    const coordinatorId = req.user?.userId;
    if (!coordinatorId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    const result = await examCoordinatorService.verifyQuestionPaperIntegrity(
      req.params.id,
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
  getAssignedPapers,
  getDashboardStats,
  getRecentActivity,
  getPaperDetails,
  downloadPaper,
  verifyPaperSignature,
};

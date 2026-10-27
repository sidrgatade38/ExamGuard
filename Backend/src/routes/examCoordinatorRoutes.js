const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const {
  getAssignedPapers,
  getDashboardStats,
  getRecentActivity,
  getPaperDetails,
  downloadPaper,
  verifyPaperSignature,
} = require('../controllers/examCoordinatorController');
const {
  getCoordinatorAnswerKey,
  downloadCoordinatorAnswerKey,
  verifyCoordinatorAnswerKeySignature,
} = require('../controllers/answerKeyController');

const router = express.Router();

// Enforce authentication and EXAM_COORDINATOR role for all routes in this router
router.use(authenticateToken);
router.use(authorizeRoles('EXAM_COORDINATOR'));

// GET /api/exam-coordinator/dashboard-stats - Data-driven KPI metrics for coordinator workspace
router.get('/dashboard-stats', getDashboardStats);

// GET /api/exam-coordinator/recent-activity - Audit log security & delivery activity trail
router.get('/recent-activity', getRecentActivity);

// GET /api/exam-coordinator/question-papers - List question papers assigned to the authenticated coordinator
router.get('/question-papers', getAssignedPapers);

// GET /api/exam-coordinator/question-papers/:id - View safe question paper metadata (strict assignment check)
router.get('/question-papers/:id', getPaperDetails);

// GET /api/exam-coordinator/question-papers/:id/download - Secure download & decrypt (Verify-Before-Decrypt pipeline)
router.get('/question-papers/:id/download', downloadPaper);

// GET /api/exam-coordinator/question-papers/:id/verify-signature - Verify digital signature & integrity
router.get('/question-papers/:id/verify-signature', verifyPaperSignature);

// Answer Key endpoints (Assigned EXAM_COORDINATOR only)
router.get('/question-papers/:id/answer-key', getCoordinatorAnswerKey);
router.get('/question-papers/:id/answer-key/download', downloadCoordinatorAnswerKey);
router.get('/question-papers/:id/answer-key/verify-signature', verifyCoordinatorAnswerKeySignature);

module.exports = router;

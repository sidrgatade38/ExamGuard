const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { handleQuestionPaperUpload, handleAnswerKeyUpload } = require('../middleware/uploadMiddleware');
const {
  submitPaper,
  getMyPapers,
  getAssignedPapers,
  getPaperDetails,
  downloadPaper,
  getRecipients,
  verifyPaperSignature,
} = require('../controllers/questionPaperController');
const {
  uploadAnswerKey,
  getTeacherAnswerKey,
  downloadTeacherAnswerKey,
  verifyTeacherAnswerKeySignature,
} = require('../controllers/answerKeyController');

const router = express.Router();

// POST /api/question-papers - Create and submit a question paper (TEACHER only)
router.post(
  '/',
  authenticateToken,
  authorizeRoles('TEACHER'),
  handleQuestionPaperUpload,
  submitPaper
);

// GET /api/question-papers/my - List authenticated teacher's question papers (TEACHER only)
router.get(
  '/my',
  authenticateToken,
  authorizeRoles('TEACHER'),
  getMyPapers
);

// GET /api/question-papers/assigned - List question papers assigned to authenticated faculty member (TEACHER only)
router.get(
  '/assigned',
  authenticateToken,
  authorizeRoles('TEACHER'),
  getAssignedPapers
);

// GET /api/question-papers/recipients - List eligible faculty recipients for assignment dropdown
router.get(
  '/recipients',
  authenticateToken,
  authorizeRoles('TEACHER'),
  getRecipients
);

// GET /api/question-papers/:id - View question paper metadata (Ownership verified in service)
router.get(
  '/:id',
  authenticateToken,
  authorizeRoles('TEACHER'),
  getPaperDetails
);

// GET /api/question-papers/:id/download - Secure private download & decrypt (Ownership verified in service)
router.get(
  '/:id/download',
  authenticateToken,
  authorizeRoles('TEACHER'),
  downloadPaper
);

// GET /api/question-papers/:id/verify-signature - Verify digital signature & integrity (Ownership verified in service)
router.get(
  '/:id/verify-signature',
  authenticateToken,
  authorizeRoles('TEACHER'),
  verifyPaperSignature
);

// Answer Key Routes (TEACHER only, alias under /api/question-papers)
router.post(
  '/:id/answer-key',
  authenticateToken,
  authorizeRoles('TEACHER'),
  handleAnswerKeyUpload,
  uploadAnswerKey
);

router.get(
  '/:id/answer-key',
  authenticateToken,
  authorizeRoles('TEACHER'),
  getTeacherAnswerKey
);

router.get(
  '/:id/answer-key/download',
  authenticateToken,
  authorizeRoles('TEACHER'),
  downloadTeacherAnswerKey
);

router.get(
  '/:id/answer-key/verify-signature',
  authenticateToken,
  authorizeRoles('TEACHER'),
  verifyTeacherAnswerKeySignature
);

module.exports = router;

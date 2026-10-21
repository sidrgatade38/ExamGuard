const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const { handleAnswerKeyUpload } = require('../middleware/uploadMiddleware');
const {
  uploadAnswerKey,
  getTeacherAnswerKey,
  downloadTeacherAnswerKey,
  verifyTeacherAnswerKeySignature,
} = require('../controllers/answerKeyController');

const router = express.Router();

// Enforce authentication and TEACHER role for all routes in this router
router.use(authenticateToken);
router.use(authorizeRoles('TEACHER'));

// POST /api/teacher/question-papers/:id/answer-key - Upload Answer Key for paper
router.post(
  '/:id/answer-key',
  handleAnswerKeyUpload,
  uploadAnswerKey
);

// GET /api/teacher/question-papers/:id/answer-key - Get Answer Key metadata & submission window
router.get(
  '/:id/answer-key',
  getTeacherAnswerKey
);

// GET /api/teacher/question-papers/:id/answer-key/download - Download decrypted Answer Key PDF
router.get(
  '/:id/answer-key/download',
  downloadTeacherAnswerKey
);

// GET /api/teacher/question-papers/:id/answer-key/verify-signature - Verify Answer Key RSA-PSS signature & hash
router.get(
  '/:id/answer-key/verify-signature',
  verifyTeacherAnswerKeySignature
);

module.exports = router;

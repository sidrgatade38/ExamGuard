/**
 * ExamGuard - Question Paper Generator Routes (Module 18)
 */

const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const {
  generateSets,
  getPaperSets,
  replaceQuestion,
  approveAndSubmit,
} = require('../controllers/questionPaperGeneratorController');

const router = express.Router();

// POST /api/question-paper-generator/generate - Generate multiple sets
router.post(
  '/generate',
  authenticateToken,
  authorizeRoles('TEACHER'),
  generateSets
);

// GET /api/question-paper-generator/paper/:paperId - Retrieve generated paper & sets
router.get(
  '/paper/:paperId',
  authenticateToken,
  authorizeRoles('TEACHER', 'ADMIN'),
  getPaperSets
);

// PUT /api/question-paper-generator/sets/:setId/replace-question - Swap question in set
router.put(
  '/sets/:setId/replace-question',
  authenticateToken,
  authorizeRoles('TEACHER'),
  replaceQuestion
);

// POST /api/question-paper-generator/sets/:setId/approve-and-submit - Approve and securely submit
router.post(
  '/sets/:setId/approve-and-submit',
  authenticateToken,
  authorizeRoles('TEACHER'),
  approveAndSubmit
);

module.exports = router;

/**
 * ExamGuard - Question Bank Routes (Module 18)
 */

const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const {
  listQuestions,
  createQuestion,
  updateQuestion,
  seedQuestions,
} = require('../controllers/questionBankController');

const router = express.Router();

// GET /api/question-bank - List questions with filters (TEACHER and ADMIN)
router.get('/', authenticateToken, authorizeRoles('TEACHER', 'ADMIN'), listQuestions);

// POST /api/question-bank - Add new question (TEACHER and ADMIN)
router.post('/', authenticateToken, authorizeRoles('TEACHER', 'ADMIN'), createQuestion);

// PUT /api/question-bank/:id - Update question (Owner or ADMIN)
router.put('/:id', authenticateToken, authorizeRoles('TEACHER', 'ADMIN'), updateQuestion);

// POST /api/question-bank/seed-sample - Seed standard university questions (TEACHER only)
router.post('/seed-sample', authenticateToken, authorizeRoles('TEACHER', 'ADMIN'), seedQuestions);

module.exports = router;

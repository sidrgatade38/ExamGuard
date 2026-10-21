const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const {
  adminTest,
  teacherTest,
  examCoordinatorTest,
} = require('../controllers/rbacController');

const router = express.Router();

// GET /api/rbac/admin -> ADMIN only
router.get('/admin', authenticateToken, authorizeRoles('ADMIN'), adminTest);

// GET /api/rbac/teacher -> TEACHER only
router.get('/teacher', authenticateToken, authorizeRoles('TEACHER'), teacherTest);

// GET /api/rbac/exam-coordinator -> EXAM_COORDINATOR only
router.get(
  '/exam-coordinator',
  authenticateToken,
  authorizeRoles('EXAM_COORDINATOR'),
  examCoordinatorTest
);

module.exports = router;

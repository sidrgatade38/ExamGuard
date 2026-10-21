/**
 * ExamGuard - Blueprint Routes (Module 18)
 */

const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const {
  createBlueprint,
  getBlueprint,
  checkFeasibility,
  getDefaultBlueprint,
} = require('../controllers/blueprintController');

const router = express.Router();

// GET /api/exam-blueprints/default-spos - Get default SPOS 2019 reference blueprint
router.get(
  '/default-spos',
  authenticateToken,
  authorizeRoles('TEACHER', 'ADMIN'),
  getDefaultBlueprint
);

// POST /api/exam-blueprints - Create new blueprint (TEACHER and ADMIN)
router.post(
  '/',
  authenticateToken,
  authorizeRoles('TEACHER', 'ADMIN'),
  createBlueprint
);

// GET /api/exam-blueprints/:id - Get blueprint with sections
router.get(
  '/:id',
  authenticateToken,
  authorizeRoles('TEACHER', 'ADMIN'),
  getBlueprint
);

// GET /api/exam-blueprints/:id/feasibility - Check feasibility against bank pool
router.get(
  '/:id/feasibility',
  authenticateToken,
  authorizeRoles('TEACHER', 'ADMIN'),
  checkFeasibility
);

module.exports = router;

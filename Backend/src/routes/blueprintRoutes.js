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
  getMarksStructure,
  saveDraft,
  listDrafts,
  getDraft,
  deleteDraft,
} = require('../controllers/blueprintController');

const router = express.Router();

// GET /api/exam-blueprints/marks-structure - Get dynamic university marks structure for 20, 30, 60, 70M
router.get(
  '/marks-structure',
  authenticateToken,
  authorizeRoles('TEACHER', 'ADMIN'),
  getMarksStructure
);

// Drafts endpoints (Module 23 multi-day persistence)
router.post(
  '/drafts',
  authenticateToken,
  authorizeRoles('TEACHER', 'ADMIN'),
  saveDraft
);

router.get(
  '/drafts',
  authenticateToken,
  authorizeRoles('TEACHER', 'ADMIN'),
  listDrafts
);

router.get(
  '/drafts/:id',
  authenticateToken,
  authorizeRoles('TEACHER', 'ADMIN'),
  getDraft
);

router.delete(
  '/drafts/:id',
  authenticateToken,
  authorizeRoles('TEACHER', 'ADMIN'),
  deleteDraft
);

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

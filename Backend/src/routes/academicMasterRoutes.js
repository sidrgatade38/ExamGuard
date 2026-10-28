/**
 * ExamGuard - Academic Master Routes (Module 21 & 22)
 */

const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  getDepartments,
  getCourses,
  getPatterns,
  getSemesters,
  getSubjects,
  getUnits,
  getOutcomes,
  getTeacherProfile,
} = require('../controllers/academicMasterController');

const router = express.Router();

router.use(authenticateToken);

router.get('/departments', getDepartments);
router.get('/courses', getCourses);
router.get('/patterns', getPatterns);
router.get('/semesters', getSemesters);
router.get('/subjects', getSubjects);
router.get('/subjects/:subjectCode/units', getUnits);
router.get('/outcomes', getOutcomes);
router.get('/teacher-profile', getTeacherProfile);

module.exports = router;

/**
 * ExamGuard - Academic Master Routes (Module 21 & 22)
 */

const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const {
  getDepartments,
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getPatterns,
  createPattern,
  updatePattern,
  deletePattern,
  getSemesters,
  getSubjects,
  createSubject,
  updateSubject,
  deleteSubject,
  getUnits,
  getOutcomes,
  getTeacherProfile,
  getPaperTitles,
  createPaperTitle,
  updatePaperTitle,
  deletePaperTitle,
} = require('../controllers/academicMasterController');

const router = express.Router();

router.use(authenticateToken);

// Read endpoints accessible to authenticated users
router.get('/departments', getDepartments);
router.get('/courses', getCourses);
router.get('/patterns', getPatterns);
router.get('/semesters', getSemesters);
router.get('/subjects', getSubjects);
router.get('/subjects/:subjectCode/units', getUnits);
router.get('/outcomes', getOutcomes);
router.get('/teacher-profile', getTeacherProfile);
router.get('/paper-titles', getPaperTitles);

// Admin-only CRUD operations
router.post('/paper-titles', authorizeRoles('ADMIN'), createPaperTitle);
router.put('/paper-titles/:id', authorizeRoles('ADMIN'), updatePaperTitle);
router.delete('/paper-titles/:id', authorizeRoles('ADMIN'), deletePaperTitle);

router.post('/patterns', authorizeRoles('ADMIN'), createPattern);
router.put('/patterns/:id', authorizeRoles('ADMIN'), updatePattern);
router.delete('/patterns/:id', authorizeRoles('ADMIN'), deletePattern);

router.post('/subjects', authorizeRoles('ADMIN'), createSubject);
router.put('/subjects/:id', authorizeRoles('ADMIN'), updateSubject);
router.delete('/subjects/:id', authorizeRoles('ADMIN'), deleteSubject);

router.post('/courses', authorizeRoles('ADMIN'), createCourse);
router.put('/courses/:id', authorizeRoles('ADMIN'), updateCourse);
router.delete('/courses/:id', authorizeRoles('ADMIN'), deleteCourse);

module.exports = router;

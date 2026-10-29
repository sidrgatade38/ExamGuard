/**
 * ExamGuard - Academic Master Controller (Module 21 & 22)
 */

const academicService = require('../services/academicMasterService');

async function getDepartments(req, res, next) {
  try {
    const data = await academicService.getDepartments();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getCourses(req, res, next) {
  try {
    const { departmentCode } = req.query;
    if (departmentCode && departmentCode.trim().toUpperCase() !== 'COMP') {
      return res.status(400).json({
        success: false,
        message: 'ExamGuard is strictly restricted to the Computer Engineering Department.',
      });
    }
    const data = await academicService.getCourses('COMP');
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getPatterns(req, res, next) {
  try {
    const data = await academicService.getPatterns();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getSemesters(req, res, next) {
  try {
    const data = await academicService.getSemesters();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getSubjects(req, res, next) {
  try {
    const { departmentCode, courseCode, patternCode, semester, search } = req.query;
    if (departmentCode && departmentCode.trim().toUpperCase() !== 'COMP') {
      return res.status(400).json({
        success: false,
        message: 'ExamGuard is strictly restricted to the Computer Engineering Department.',
      });
    }
    const teacherId = req.user?.roleName === 'TEACHER' ? req.user.userId : undefined;
    const data = await academicService.getSubjects({
      departmentCode: 'COMP',
      courseCode,
      patternCode,
      semester,
      search,
      teacherId,
    });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getUnits(req, res, next) {
  try {
    const { subjectCode } = req.params;
    const data = await academicService.getUnitsForSubject(subjectCode);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getOutcomes(req, res, next) {
  try {
    const data = await academicService.getOutcomes();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getTeacherProfile(req, res, next) {
  try {
    const teacherId = req.user?.userId;
    const data = await academicService.getTeacherProfileWithSubjects(teacherId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getDepartments,
  getCourses,
  getPatterns,
  getSemesters,
  getSubjects,
  getUnits,
  getOutcomes,
  getTeacherProfile,
};

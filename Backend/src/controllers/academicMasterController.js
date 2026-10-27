/**
 * ExamGuard - Academic Master Controller (Module 21)
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
    const data = await academicService.getCourses(departmentCode);
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
    const { departmentCode, courseCode, patternCode, semester } = req.query;
    const data = await academicService.getSubjects({ departmentCode, courseCode, patternCode, semester });
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

module.exports = {
  getDepartments,
  getCourses,
  getPatterns,
  getSemesters,
  getSubjects,
  getUnits,
};

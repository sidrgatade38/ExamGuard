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

// Paper Titles
async function getPaperTitles(req, res, next) {
  try {
    const data = await academicService.getPaperTitles();
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createPaperTitle(req, res, next) {
  try {
    const { title, code } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title is required' });
    }
    const data = await academicService.createPaperTitle({ title, code });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updatePaperTitle(req, res, next) {
  try {
    const { id } = req.params;
    const data = await academicService.updatePaperTitle(id, req.body);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function deletePaperTitle(req, res, next) {
  try {
    const { id } = req.params;
    await academicService.deletePaperTitle(id);
    return res.status(200).json({ success: true, message: 'Paper title deleted' });
  } catch (err) {
    next(err);
  }
}

// Patterns CRUD
async function createPattern(req, res, next) {
  try {
    const { name, code, revisionYear } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Pattern name is required' });
    }
    const data = await academicService.createPattern({ name, code, revisionYear });
    return res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updatePattern(req, res, next) {
  try {
    const { id } = req.params;
    const data = await academicService.updatePattern(id, req.body);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function deletePattern(req, res, next) {
  try {
    const { id } = req.params;
    await academicService.deletePattern(id);
    return res.status(200).json({ success: true, message: 'Pattern deleted' });
  } catch (err) {
    next(err);
  }
}

// Subjects CRUD
async function createSubject(req, res, next) {
  try {
    const { title, code, courseCode, patternCode, totalMarks, durationHours } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Subject title is required' });
    }
    const data = await academicService.createSubject(req.body);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateSubject(req, res, next) {
  try {
    const { id } = req.params;
    const data = await academicService.updateSubject(id, req.body);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function deleteSubject(req, res, next) {
  try {
    const { id } = req.params;
    await academicService.deleteSubject(id);
    return res.status(200).json({ success: true, message: 'Subject deleted' });
  } catch (err) {
    next(err);
  }
}

// Courses CRUD
async function createCourse(req, res, next) {
  try {
    const { name, code, degree } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Course name is required' });
    }
    const data = await academicService.createCourse(req.body);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function updateCourse(req, res, next) {
  try {
    const { id } = req.params;
    const data = await academicService.updateCourse(id, req.body);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function deleteCourse(req, res, next) {
  try {
    const { id } = req.params;
    await academicService.deleteCourse(id);
    return res.status(200).json({ success: true, message: 'Course deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
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
};

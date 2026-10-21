/**
 * Temporary RBAC Verification Controllers
 * Used exclusively for validating role authorization middleware.
 */

function adminTest(req, res) {
  return res.status(200).json({
    success: true,
    message: 'ADMIN authorization successful',
  });
}

function teacherTest(req, res) {
  return res.status(200).json({
    success: true,
    message: 'TEACHER authorization successful',
  });
}

function examCoordinatorTest(req, res) {
  return res.status(200).json({
    success: true,
    message: 'EXAM_COORDINATOR authorization successful',
  });
}

module.exports = {
  adminTest,
  teacherTest,
  examCoordinatorTest,
};

const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./authRoutes');
const rbacRoutes = require('./rbacRoutes');
const questionPaperRoutes = require('./questionPaperRoutes');
const examCoordinatorRoutes = require('./examCoordinatorRoutes');
const teacherAnswerKeyRoutes = require('./teacherAnswerKeyRoutes');
const notificationRoutes = require('./notificationRoutes');
const auditLogRoutes = require('./auditLogRoutes');
const adminRoutes = require('./adminRoutes');
const questionBankRoutes = require('./questionBankRoutes');
const blueprintRoutes = require('./blueprintRoutes');
const questionPaperGeneratorRoutes = require('./questionPaperGeneratorRoutes');
const academicMasterRoutes = require('./academicMasterRoutes');

const router = express.Router();

// Mount API routes
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/rbac', rbacRoutes);
router.use('/question-papers', questionPaperRoutes);
router.use('/exam-coordinator', examCoordinatorRoutes);
router.use('/teacher/question-papers', teacherAnswerKeyRoutes);
router.use('/notifications', notificationRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/admin', adminRoutes);
router.use('/question-bank', questionBankRoutes);
router.use('/exam-blueprints', blueprintRoutes);
router.use('/question-paper-generator', questionPaperGeneratorRoutes);
router.use('/academic', academicMasterRoutes);

module.exports = router;

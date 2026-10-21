/**
 * ExamGuard - Admin Management Routes (Module 14)
 *
 * All routes mounted at /api/admin
 * Protected strictly by authenticateToken and authorizeRoles('ADMIN').
 */

const express = require('express');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/roleMiddleware');
const adminController = require('../controllers/adminController');

const router = express.Router();

// Enforce authentication and ADMIN role on all admin routes
router.use(authenticateToken);
router.use(authorizeRoles('ADMIN'));

// User listing, search, and pagination
router.get('/users', adminController.getUsers);

// Retrieve single user safe profile
router.get('/users/:id', adminController.getUser);

// Administrative user creation
router.post('/users', adminController.postUser);

// Account activation / deactivation
router.patch('/users/:id/status', adminController.updateStatus);

// Role change / assignment
router.patch('/users/:id/role', adminController.updateRole);

// Administrator-assisted password reset
router.post('/users/:id/reset-password', adminController.resetPassword);

// System roles listing
router.get('/roles', adminController.getRoles);

module.exports = router;

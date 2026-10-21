/**
 * ExamGuard - Admin Management Controller (Module 14)
 *
 * Exposes administrative HTTP endpoints:
 * - GET /api/admin/users (List, filter, paginate)
 * - GET /api/admin/users/:id (Retrieve user details)
 * - POST /api/admin/users (Create new user)
 * - PATCH /api/admin/users/:id/status (Activate / deactivate user)
 * - PATCH /api/admin/users/:id/role (Change user role)
 * - POST /api/admin/users/:id/reset-password (Admin password reset)
 * - GET /api/admin/roles (List supported system roles)
 */

const adminService = require('../services/adminService');

function getClientContext(req) {
  return {
    ipAddress: req.ip || req.headers['x-forwarded-for'],
    userAgent: req.headers['user-agent'],
  };
}

/**
 * Handles GET /api/admin/users
 */
async function getUsers(req, res, next) {
  try {
    const { search, role, status, page, limit, sortBy, sortOrder } = req.query;

    const result = await adminService.listUsers({
      search,
      role,
      status,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return res.status(200).json({
      success: true,
      users: result.users,
      pagination: result.pagination,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

/**
 * Handles GET /api/admin/users/:id
 */
async function getUser(req, res, next) {
  try {
    const { id } = req.params;
    const user = await adminService.getUserById(id);

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

/**
 * Handles POST /api/admin/users
 */
async function postUser(req, res, next) {
  try {
    const { name, email, password, role } = req.body || {};
    const adminUserId = req.user?.userId;
    const clientContext = getClientContext(req);

    const newUser = await adminService.createUser(
      { name, email, password, role },
      adminUserId,
      clientContext
    );

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: newUser,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

/**
 * Handles PATCH /api/admin/users/:id/status
 */
async function updateStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { isActive } = req.body || {};
    const adminUserId = req.user?.userId;
    const clientContext = getClientContext(req);

    const updatedUser = await adminService.setUserStatus(
      id,
      isActive,
      adminUserId,
      clientContext
    );

    return res.status(200).json({
      success: true,
      message: `User account successfully ${updatedUser.isActive ? 'activated' : 'deactivated'}`,
      user: updatedUser,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

/**
 * Handles PATCH /api/admin/users/:id/role
 */
async function updateRole(req, res, next) {
  try {
    const { id } = req.params;
    const { role } = req.body || {};
    const adminUserId = req.user?.userId;
    const clientContext = getClientContext(req);

    const updatedUser = await adminService.setUserRole(
      id,
      role,
      adminUserId,
      clientContext
    );

    return res.status(200).json({
      success: true,
      message: `User role successfully updated to ${updatedUser.role}`,
      user: updatedUser,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

/**
 * Handles POST /api/admin/users/:id/reset-password
 */
async function resetPassword(req, res, next) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body || {};
    const adminUserId = req.user?.userId;
    const clientContext = getClientContext(req);

    const result = await adminService.resetUserPassword(
      id,
      newPassword,
      adminUserId,
      clientContext
    );

    return res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

/**
 * Handles GET /api/admin/roles
 */
async function getRoles(req, res, next) {
  try {
    const roles = await adminService.listRoles();
    return res.status(200).json({
      success: true,
      roles,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, message: err.message });
    }
    return next(err);
  }
}

module.exports = {
  getUsers,
  getUser,
  postUser,
  updateStatus,
  updateRole,
  resetPassword,
  getRoles,
};
